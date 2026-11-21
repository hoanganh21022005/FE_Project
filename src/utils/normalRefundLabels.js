const ORIGIN_LABELS = {
  memberchoice: { vi: 'Member từ chối đề xuất và yêu cầu hoàn tiền', en: 'Member declined the proposal and requested a refund' },
  centercancellation: { vi: 'Trung tâm hủy lớp', en: 'Class cancelled by the center' },
  latereceipt: { vi: 'Khoản thanh toán đến sau khi lớp bị hủy', en: 'Payment received after class cancellation' },
}

export const normalRefundOriginLabel = (origin, language = 'vi') => {
  if (typeof origin !== 'string' || !origin.trim()) return language === 'vi' ? 'Chưa có thông tin' : 'Unavailable'
  const key = origin.replace(/[^a-z]/gi, '').toLowerCase()
  return ORIGIN_LABELS[key]?.[language === 'vi' ? 'vi' : 'en'] ?? origin
}
