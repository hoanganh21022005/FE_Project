// Hạn thanh toán của đơn/hóa đơn: lấy từ `expiresAt` Backend đã lưu (giờ Việt Nam), không nêu số phút cứng.
import { parseBackendDate } from './datetime.js'

/**
 * Định dạng hạn thanh toán "HH:mm dd/MM/yyyy" theo giờ Việt Nam. Không đọc được thì trả '' (không để NaN
 * lọt vào Intl, không nêu số phút).
 */
export function formatPaymentDeadline(value, language = 'vi') {
  const ms = parseBackendDate(value)
  if (!Number.isFinite(ms)) return ''
  const parts = new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh',
  }).formatToParts(new Date(ms))
  const part = (type) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('hour')}:${part('minute')} ${part('day')}/${part('month')}/${part('year')}`
}

/** Câu báo sau khi tạo đơn thanh toán: nêu hạn theo `expiresAt` của đơn; không có hạn thì không nêu số phút. */
export function buildOrderCreatedMessage({ invoiceCode = null, paymentMethod = '', expiresAt = null, language = 'vi' } = {}) {
  const label = invoiceCode || paymentMethod || ''
  const deadline = formatPaymentDeadline(expiresAt, language)
  if (language === 'vi') {
    return `Đã tạo đơn thanh toán${label ? ` (${label})` : ''} thành công!${deadline ? ` Hạn thanh toán: ${deadline}.` : ''}`
  }
  return `Payment order created${label ? ` (${label})` : ''}.${deadline ? ` Pay before ${deadline}.` : ''}`
}
