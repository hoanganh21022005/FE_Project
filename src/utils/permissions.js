/**
 * Coach Portal Business Permission Rules (Single Source of Truth)
 */

export function normalizeSessionStatus(session) {
  if (!session) return '';
  if (typeof session === 'string') {
    const raw = session.trim().toLowerCase();
    if (raw === 'scheduled' || raw === 'upcoming') return 'Scheduled';
    if (raw === 'completed' || raw === 'done' || raw === 'finished') return 'Completed';
    if (raw === 'cancelled' || raw === 'canceled' || raw === 'invalidated') return 'Cancelled';
    return session.trim();
  }
  if (session.centerInvalidated === true) {
    const rawStatus = String(session.status || '').trim().toLowerCase();
    if (!rawStatus || rawStatus === 'cancelled' || rawStatus === 'canceled' || rawStatus === 'invalidated') {
      return 'Cancelled';
    }
  }
  const raw = String(session.status || '').trim().toLowerCase();
  if (raw === 'scheduled' || raw === 'upcoming') return 'Scheduled';
  if (raw === 'completed' || raw === 'done' || raw === 'finished') return 'Completed';
  if (raw === 'cancelled' || raw === 'canceled' || raw === 'invalidated') return 'Cancelled';
  if (!raw && session.sessionDate) {
    const dateStr = String(session.sessionDate).slice(0, 10);
    const todayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return dateStr < todayStr ? 'Completed' : 'Scheduled';
  }
  return String(session.status || '').trim();
}

export function isSessionScheduled(session) {
  return normalizeSessionStatus(session) === 'Scheduled';
}

export function isSessionCompleted(session) {
  return normalizeSessionStatus(session) === 'Completed';
}

export function isSessionCancelled(session) {
  return normalizeSessionStatus(session) === 'Cancelled';
}

/**
 * Check-in / bulk check-in / scan is ONLY allowed when session status is Scheduled
 */
export function canCheckIn(session) {
  return normalizeSessionStatus(session) === 'Scheduled';
}

/**
 * Attendance correction (with mandatory reason -> /api/attendances/correct) is ONLY allowed when session status is Completed
 */
export function canCorrectAttendance(session) {
  return normalizeSessionStatus(session) === 'Completed';
}

/**
 * Logging training results is ONLY allowed when session status is Completed
 */
export function canLogResult(session) {
  return normalizeSessionStatus(session) === 'Completed';
}

/**
 * Coach can only create training results / evaluations / book PT sessions when package is Active and remainingCredit > 0
 */
export function canCoachActOnPackage(pkg) {
  if (!pkg || typeof pkg !== 'object') return false;
  const rawStatus = String(
    pkg.subscriptionStatus || pkg.packageStatus || pkg.status || ''
  ).trim().toLowerCase();
  const isActive = rawStatus === 'active';
  const credits = Number(
    pkg.remainingCredit ?? pkg.remainingCredits ?? pkg.remainingSessions ?? pkg.credits ?? 0
  );
  return isActive && Number.isFinite(credits) && credits > 0;
}

/**
 * Returns localized reason why a coach cannot perform package-bound actions, or null if allowed
 */
export function getPackageActionBlockReason(pkg, t = (k) => k) {
  if (!pkg || typeof pkg !== 'object') {
    return t('coachPkgBlockNoPackage') !== 'coachPkgBlockNoPackage'
      ? t('coachPkgBlockNoPackage')
      : 'Hội viên chưa có gói tập hợp lệ';
  }
  const rawStatus = String(
    pkg.subscriptionStatus || pkg.packageStatus || pkg.status || ''
  ).trim().toLowerCase();
  const credits = Number(
    pkg.remainingCredit ?? pkg.remainingCredits ?? pkg.remainingSessions ?? pkg.credits ?? 0
  );

  if (rawStatus === 'pending' || rawStatus === 'requested') {
    return t('coachPkgBlockPending') !== 'coachPkgBlockPending'
      ? t('coachPkgBlockPending')
      : 'Yêu cầu đang chờ duyệt';
  }
  if (rawStatus === 'accepted' || rawStatus === 'invoiced') {
    return t('coachPkgBlockAwaitingPayment') !== 'coachPkgBlockAwaitingPayment'
      ? t('coachPkgBlockAwaitingPayment')
      : 'Chờ hội viên chọn gói & thanh toán';
  }
  if (rawStatus === 'frozen') {
    return t('coachPkgBlockFrozen') !== 'coachPkgBlockFrozen'
      ? t('coachPkgBlockFrozen')
      : 'Gói tập đang bảo lưu (Frozen)';
  }
  if (rawStatus === 'expired') {
    return t('coachPkgBlockExpired') !== 'coachPkgBlockExpired'
      ? t('coachPkgBlockExpired')
      : 'Gói tập đã hết hạn (Expired)';
  }
  if (rawStatus === 'cancelled' || rawStatus === 'canceled' || rawStatus === 'rejected' || rawStatus === 'declined') {
    return t('coachPkgBlockCancelled') !== 'coachPkgBlockCancelled'
      ? t('coachPkgBlockCancelled')
      : 'Gói tập hoặc yêu cầu đã hủy / từ chối';
  }
  if (rawStatus !== 'active') {
    return t('coachPkgBlockInactive') !== 'coachPkgBlockInactive'
      ? t('coachPkgBlockInactive')
      : 'Gói tập chưa kích hoạt';
  }
  if (!Number.isFinite(credits) || credits <= 0) {
    return t('coachPkgBlockNoCredit') !== 'coachPkgBlockNoCredit'
      ? t('coachPkgBlockNoCredit')
      : 'Gói tập đã hết số buổi (0 buổi còn lại)';
  }
  return null;
}

/**
 * Verify coach permission for a given session and class.
 * Ensures session-level assignments (e.g. substitute coach) take precedence.
 * Blocks mismatched pairs (e.g. session classId != classItem id, or PT virtual class with non-private session).
 * Preserves primary coach and PT flows.
 */
export function verifyCoachSessionPermission({ session, classItem, coachId } = {}) {
  const numericCoachId = Number(coachId);
  if (!Number.isInteger(numericCoachId) || numericCoachId <= 0 || !session || typeof session !== 'object') {
    return {
      allowed: false,
      reason: 'invalid_params',
      isMismatched: false,
      isOutsidePermission: true,
      messageVi: 'Không xác định được huấn luyện viên hoặc thông tin buổi học.',
      messageEn: 'Could not identify coach or session details.',
    };
  }

  const isPtClass = classItem?.id === 'PT_1ON1' || classItem?.isPrivateVirtualClass === true;
  const isPrivateSession = session.isPrivate === true;

  // 1. Mismatched pair check ("Chặn ca sai cặp")
  if (isPtClass) {
    if (!isPrivateSession && session.classId != null) {
      return {
        allowed: false,
        reason: 'mismatched_pair',
        isMismatched: true,
        isOutsidePermission: false,
        messageVi: 'Ca kèm PT 1:1 không khớp với buổi học của lớp nhóm.',
        messageEn: 'PT 1:1 class does not match group class session.',
      };
    }
  } else {
    if (isPrivateSession) {
      return {
        allowed: false,
        reason: 'mismatched_pair',
        isMismatched: true,
        isOutsidePermission: false,
        messageVi: 'Buổi học này là ca kèm PT 1:1, không thuộc lớp nhóm đã chọn.',
        messageEn: 'This session is a PT 1:1 session and does not belong to the selected group class.',
      };
    }
    if (
      session.classId != null &&
      classItem?.id != null &&
      String(session.classId) !== String(classItem.id)
    ) {
      return {
        allowed: false,
        reason: 'mismatched_pair',
        isMismatched: true,
        isOutsidePermission: false,
        messageVi: 'Buổi học không thuộc lớp đã chọn.',
        messageEn: 'This session does not belong to the selected class.',
      };
    }
  }

  // 2. Permission check according to actual session assignment ("Xác minh quyền theo phân công thực tế từng buổi")
  if (isPtClass || isPrivateSession) {
    const assignedCoachId = session.coachId != null ? Number(session.coachId) : numericCoachId;
    if (assignedCoachId !== numericCoachId) {
      return {
        allowed: false,
        reason: 'outside_permission',
        isMismatched: false,
        isOutsidePermission: true,
        messageVi: 'Bạn không được phân công phụ trách ca kèm PT này.',
        messageEn: 'You are not assigned to this PT session.',
      };
    }
    return {
      allowed: true,
      reason: null,
      isMismatched: false,
      isOutsidePermission: false,
      isPrimary: false,
      isSubstitute: false,
      isPt: true,
    };
  }

  // Group class session:
  // Actual assigned coach: session-level coachId takes precedence over class coachId
  const sessionCoachId = session.coachId != null ? Number(session.coachId) : null;
  const classCoachId = classItem?.coachId != null ? Number(classItem.coachId) : null;
  const actualCoachId = sessionCoachId ?? classCoachId;

  if (actualCoachId == null || actualCoachId !== numericCoachId) {
    return {
      allowed: false,
      reason: 'outside_permission',
      isMismatched: false,
      isOutsidePermission: true,
      messageVi: 'Bạn không được phân công dạy buổi học này.',
      messageEn: 'You are not assigned to teach this session.',
    };
  }

  const isPrimary = classCoachId === numericCoachId && (sessionCoachId == null || sessionCoachId === numericCoachId);
  const isSubstitute = sessionCoachId === numericCoachId && classCoachId !== numericCoachId;

  return {
    allowed: true,
    reason: null,
    isMismatched: false,
    isOutsidePermission: false,
    isPrimary,
    isSubstitute,
    isPt: false,
  };
}

/**
 * Gate bulk attendance action.
 * Blocks opening and confirming bulk if roster or either attendance status source
 * is loading, in error, or belongs to an old class/session.
 */
export function canPerformBulkAttendance({
  apiEnabled = true,
  sessionReady,
  hasSessionPermission,
  sessionCancelled,
  allowCheckIn,
  loadingRoster,
  rosterError,
  attendancesError,
  trainingResultsError,
  loadedClassId,
  selectedClassId,
  loadedSessionId,
  selectedSessionId,
  unmarkedCount,
  bulkSaving,
} = {}) {
  if (!sessionReady || !hasSessionPermission || sessionCancelled || !allowCheckIn) {
    return false;
  }
  if (bulkSaving) {
    return false;
  }
  if (!unmarkedCount || unmarkedCount <= 0) {
    return false;
  }
  if (!apiEnabled) {
    return true;
  }
  if (loadingRoster) {
    return false;
  }
  if (rosterError || attendancesError || trainingResultsError) {
    return false;
  }
  if (
    loadedClassId == null ||
    selectedClassId == null ||
    String(loadedClassId) !== String(selectedClassId)
  ) {
    return false;
  }
  if (
    loadedSessionId == null ||
    selectedSessionId == null ||
    String(loadedSessionId) !== String(selectedSessionId)
  ) {
    return false;
  }
  return true;
}
