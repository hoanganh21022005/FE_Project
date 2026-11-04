/**
 * Unified Status Label & Tone Mapping for Coach Portal (P1.1)
 */

const DEFAULT_VI_LABELS = {
  session: {
    scheduled: 'Sắp diễn ra',
    completed: 'Đã hoàn thành',
    cancelled: 'Đã hủy',
    canceled: 'Đã hủy',
    centerinvalidated: 'Hủy do sự cố trung tâm',
  },
  registration: {
    requested: 'Chờ duyệt',
    pending: 'Chờ duyệt',
    accepted: 'Chờ chọn gói',
    invoiced: 'Chờ thanh toán',
    active: 'Đang hoạt động',
    rejected: 'Đã từ chối',
    declined: 'Đã từ chối',
  },
  package: {
    pending: 'Chờ kích hoạt',
    active: 'Đang hoạt động',
    frozen: 'Đang bảo lưu',
    expired: 'Hết hạn',
    cancelled: 'Đã hủy',
    canceled: 'Đã hủy',
  },
  attendance: {
    present: 'Có mặt',
    checkedin: 'Có mặt',
    checked_in: 'Có mặt',
    late: 'Đi trễ',
    excused: 'Vắng có phép',
    absent: 'Vắng mặt',
    unmarked: 'Chưa điểm danh',
    not_recorded: 'Chưa điểm danh',
  },
};

const TRANSLATION_KEYS = {
  session: {
    scheduled: 'coachStatusScheduled',
    completed: 'coachStatusCompleted',
    cancelled: 'coachStatusCancelled',
    canceled: 'coachStatusCancelled',
    centerinvalidated: 'coachStatusCenterInvalidated',
  },
  registration: {
    requested: 'coachStatusRequested',
    pending: 'coachStatusPending',
    accepted: 'coachStatusAccepted',
    invoiced: 'coachStatusInvoiced',
    active: 'coachStatusActive',
    rejected: 'coachStatusRejected',
    declined: 'coachStatusDeclined',
  },
  package: {
    pending: 'coachStatusPending',
    active: 'coachStatusActive',
    frozen: 'coachStatusFrozen',
    expired: 'coachStatusExpired',
    cancelled: 'coachStatusCancelled',
    canceled: 'coachStatusCancelled',
  },
  attendance: {
    present: 'coachStatusPresent',
    checkedin: 'coachStatusCheckedIn',
    checked_in: 'coachStatusCheckedIn',
    late: 'coachStatusLate',
    excused: 'coachStatusExcused',
    absent: 'coachStatusAbsent',
    unmarked: 'coachStatusUnmarked',
    not_recorded: 'coachStatusUnmarked',
  },
};

export function statusLabel(type = 'session', value = '', t) {
  const normType = String(type || 'session').trim().toLowerCase();
  const normVal = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const compactVal = normVal.replace(/_/g, '');

  const keyMap = TRANSLATION_KEYS[normType] || {};
  const tKey = keyMap[normVal] || keyMap[compactVal];
  if (typeof t === 'function' && tKey) {
    const translated = t(tKey);
    if (translated && translated !== tKey) {
      return translated;
    }
  }

  const fallbackMap = DEFAULT_VI_LABELS[normType] || {};
  return (
    fallbackMap[normVal] ||
    fallbackMap[compactVal] ||
    DEFAULT_VI_LABELS.session[compactVal] ||
    DEFAULT_VI_LABELS.registration[compactVal] ||
    DEFAULT_VI_LABELS.package[compactVal] ||
    DEFAULT_VI_LABELS.attendance[compactVal] ||
    (value ? String(value) : 'Chưa xác định')
  );
}

/**
 * Returns semantic color tone: 'green' | 'amber' | 'red' | 'blue' | 'slate'
 */
export function statusTone(type = 'session', value = '') {
  const normVal = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

  if (
    normVal === 'completed' ||
    normVal === 'active' ||
    normVal === 'present' ||
    normVal === 'checkedin'
  ) {
    return 'green';
  }
  if (
    normVal === 'requested' ||
    normVal === 'pending' ||
    normVal === 'accepted' ||
    normVal === 'invoiced' ||
    normVal === 'late' ||
    normVal === 'excused'
  ) {
    return 'amber';
  }
  if (
    normVal === 'cancelled' ||
    normVal === 'canceled' ||
    normVal === 'centerinvalidated' ||
    normVal === 'rejected' ||
    normVal === 'declined' ||
    normVal === 'expired' ||
    normVal === 'absent'
  ) {
    return 'red';
  }
  if (normVal === 'scheduled' || normVal === 'upcoming' || normVal === 'frozen') {
    return 'blue';
  }
  return 'slate';
}
