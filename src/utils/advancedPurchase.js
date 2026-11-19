// Logic "xác nhận mua gói Advanced" của Member (màn Khóa học), tách ra để kiểm bằng test .mjs không cần trình duyệt.
// Quy tắc: purchaseConfirmationAllowed === false thì khóa nút và nêu lý do; === true thì mở nút;
// thiếu field (null) thì giữ cách cũ (so hạn xác nhận) và để Backend từ chối khi lưu.
import { translateErrorCode } from '../api/apiErrors.js'
import { parseBackendDate } from './datetime.js'

const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null)

/** Đọc field xác nhận mua từ đăng ký Advanced; thiếu thì null (không đổi thành false). */
export function readPurchaseConfirmation(registration) {
  return {
    allowed:
      typeof registration?.purchaseConfirmationAllowed === 'boolean'
        ? registration.purchaseConfirmationAllowed
        : null,
    blockReason: text(registration?.purchaseConfirmationBlockReason),
    serverTime: text(registration?.serverTime),
    invoiceStatus: text(registration?.invoiceStatus),
  }
}

/**
 * Độ lệch (ms) giữa đồng hồ Backend và đồng hồ trình duyệt, lấy từ `serverTime` của danh sách đăng ký.
 * Cộng độ lệch này vào đồng hồ trình duyệt để so hạn theo giờ Backend; không có serverTime thì 0.
 */
export function serverClockOffsetMs(rows, browserNowMs = Date.now()) {
  for (const row of Array.isArray(rows) ? rows : []) {
    const serverMs = parseBackendDate(row?.serverTime)
    if (Number.isFinite(serverMs)) return serverMs - browserNowMs
  }
  return 0
}

/**
 * Trạng thái nút "Xác nhận và thanh toán" của một đăng ký đã được Coach chấp nhận.
 * - `canConfirm`: có mở nút hay không;
 * - `expired`: đã hết hạn xác nhận (để hiện thông báo hết hạn);
 * - `deadlineUnknown`: (chỉ khi thiếu field) không có hạn xác nhận để so;
 * - `source`: 'backend' (theo purchaseConfirmationAllowed), 'rejection' (Backend vừa từ chối vì hết hạn) hoặc 'legacy';
 * - `reasonCode`/`reasonText`: lý do khi Backend khóa, qua bảng mã lỗi chung.
 */
export function getPurchaseConfirmationState(
  registration,
  { nowMs = Date.now(), confirmationDeadlineMs = null, expiredByRejection = false, language = 'vi' } = {},
) {
  const { allowed, blockReason } = readPurchaseConfirmation(registration)
  if (expiredByRejection) {
    return {
      canConfirm: false,
      expired: true,
      deadlineUnknown: false,
      source: 'rejection',
      reasonCode: 'REGISTRATION_CONFIRMATION_EXPIRED',
      reasonText: translateErrorCode('REGISTRATION_CONFIRMATION_EXPIRED', language),
    }
  }
  if (allowed === false) {
    const known = translateErrorCode(blockReason, language)
    return {
      canConfirm: false,
      expired: blockReason === 'REGISTRATION_CONFIRMATION_EXPIRED',
      deadlineUnknown: false,
      source: 'backend',
      reasonCode: blockReason,
      reasonText:
        known ||
        (language === 'vi'
          ? 'Chưa thể xác nhận mua gói lúc này.'
          : 'The purchase cannot be confirmed right now.'),
    }
  }
  if (allowed === true) {
    return {
      canConfirm: true,
      expired: false,
      deadlineUnknown: false,
      source: 'backend',
      reasonCode: null,
      reasonText: null,
    }
  }
  const deadlineUnknown = !Number.isFinite(confirmationDeadlineMs)
  const expired = deadlineUnknown || confirmationDeadlineMs <= nowMs
  return {
    canConfirm: !expired,
    expired,
    deadlineUnknown,
    source: 'legacy',
    reasonCode: null,
    reasonText: null,
  }
}

/** Đăng ký đã có hóa đơn (Backend đã tạo): mở lại hóa đơn đó, không tạo hóa đơn mới. */
export const hasExistingInvoice = (registration, relatedOrder = null) => {
  const id = registration?.invoiceId ?? relatedOrder?.invoiceId
  return id !== null && id !== undefined && id !== '' && Number.isFinite(Number(id)) && Number(id) > 0
}

/** Hóa đơn của đăng ký còn chờ thanh toán (cần mở lại hóa đơn để thanh toán). */
export const isInvoicePending = (status) =>
  ['pending', 'pending_payment'].includes(String(status ?? '').trim().toLowerCase().replace(/\s+/g, '_'))
