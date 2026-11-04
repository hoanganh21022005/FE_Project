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
