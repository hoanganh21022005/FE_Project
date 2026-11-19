// Logic hủy buổi PT 1:1 của Member, dùng chung cho MemberMyCoachView và MemberScheduleView.
// Buổi học phía Member đọc THÔ từ memberPortalApi (không qua mapSession), nên các hàm ở đây tự áp
// quy tắc "thiếu field != false": chức năng cũ (hủy buổi) chỉ khóa khi cancellationAllowed === false.
import { describeBlockReason } from '../api/apiErrors.js'
import { parseBackendDate } from './datetime.js'

/** Đọc các field hạn hủy của một buổi học thô; field thiếu giữ null (không đổi thành false). */
export function readCancellationFields(raw) {
  const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null)
  return {
    allowed: typeof raw?.cancellationAllowed === 'boolean' ? raw.cancellationAllowed : null,
    blockReason: text(raw?.cancellationBlockReason),
    deadline: text(raw?.cancellationDeadline),
    serverTime: text(raw?.serverTime),
    creditReturned: typeof raw?.creditReturned === 'boolean' ? raw.creditReturned : null,
  }
}

/** Nút hủy chỉ bị khóa khi Backend nói rõ `cancellationAllowed === false`. */
export const isCancellationLocked = (raw) => raw?.cancellationAllowed === false

/** Backend nói rõ được hủy (`true`). Thiếu field thì không khẳng định gì. */
export const isCancellationConfirmed = (raw) => raw?.cancellationAllowed === true

/** Mốc "bây giờ" (mili giây): ưu tiên `serverTime` của Backend, không có thì đồng hồ trình duyệt. */
export function referenceNowMs(raw, fallbackMs = Date.now()) {
  const server = parseBackendDate(raw?.serverTime)
  return Number.isFinite(server) ? server : fallbackMs
}

/**
 * Lý do khóa nút hủy để hiển thị: chữ từ bảng mã lỗi chung theo `cancellationBlockReason`,
 * mã lạ hoặc thiếu mã thì dùng câu chung (không lộ mã kỹ thuật ra giao diện).
 */
export function describeCancellationBlock(raw, language = 'vi') {
  const fields = readCancellationFields(raw)
  return {
    code: fields.blockReason,
    reasonText: describeBlockReason(fields.blockReason, language),
    deadline: fields.deadline,
  }
}

const creditOf = (subscription) => {
  const value = subscription?.remainingCredit
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/**
 * Tổng credit còn lại của các gói Advanced đang dùng được. Trả null khi không đọc được số nào
 * (để không báo "11→12" từ dữ liệu thiếu).
 */
export function sumAdvancedCredits(subscriptions) {
  let total = 0
  let counted = 0
  for (const subscription of Array.isArray(subscriptions) ? subscriptions : []) {
    if (String(subscription?.packageType || '').toLowerCase() !== 'advanced') continue
    const status = String(subscription?.status || '').toLowerCase()
    if (status !== 'active' && status !== 'grace_period') continue
    const credit = creditOf(subscription)
    if (credit === null) continue
    total += credit
    counted += 1
  }
  return counted > 0 ? total : null
}

/**
 * Kết quả sau khi hủy thành công, quyết định câu báo:
 *  - 'refunded_verified': Backend báo creditReturned === true VÀ số đọc lại đúng bằng số trước + 1
 *    (chỉ khi đó mới được nêu "từ X sang Y");
 *  - 'refunded_unverified': Backend báo đã hoàn nhưng không đối chiếu được số;
 *  - 'no_refund_confirmed': Backend không xác nhận hoàn credit (false hoặc thiếu).
 */
export function resolveCancellationOutcome({ creditReturned, creditBefore, creditAfter }) {
  if (creditReturned === true) {
    if (
      Number.isFinite(creditBefore) &&
      Number.isFinite(creditAfter) &&
      creditAfter === creditBefore + 1
    ) {
      return { kind: 'refunded_verified', before: creditBefore, after: creditAfter }
    }
    return { kind: 'refunded_unverified', before: creditBefore ?? null, after: creditAfter ?? null }
  }
  return { kind: 'no_refund_confirmed', before: creditBefore ?? null, after: creditAfter ?? null }
}

/**
 * Quy tắc nút hủy / báo vắng của một buổi PT (giờ theo máy trình duyệt, ưu tiên `serverTime`):
 *  - cancellationAllowed === false: không cho hủy, `isCancelLocked` để khóa nút và nêu lý do;
 *  - cancellationAllowed === true: cho hủy khi buổi chưa kết thúc;
 *  - thiếu field (null): giữ quy tắc cũ, chỉ cho hủy khi còn >= 12 giờ; Backend từ chối khi lưu nếu sai.
 */
export function getPrivateSessionTimingRule(session, now = new Date()) {
  const status = String(session?.status || '').trim().toLowerCase()
  const none = { isCancellable: false, isCancelLocked: false, isAbsentApplicable: false }
  if (['cancelled', 'canceled', 'absent', 'completed'].includes(status)) return none
  const date = String(session?.sessionDate || '').slice(0, 10)
  const startTime = String(session?.startTime || '').slice(0, 8)
  const endTime = String(session?.endTime || '').slice(0, 8)
  const start = new Date(`${date} ${startTime}`)
  const end = new Date(`${date} ${endTime || startTime}`)
  if (!date || Number.isNaN(start.getTime())) return none
  const nowMs = referenceNowMs(session, now.getTime())
  const diffHours = (start.getTime() - nowMs) / 3600000
  const hasEnded = !Number.isNaN(end.getTime()) ? nowMs >= end.getTime() : diffHours <= 0
  const { allowed } = readCancellationFields(session)
  return {
    isCancellable: !hasEnded && (allowed === true || (allowed === null && diffHours >= 12)),
    isCancelLocked: !hasEnded && allowed === false,
    isAbsentApplicable: !hasEnded && diffHours < 12,
  }
}

/** Buổi đã hủy và Backend xác nhận đã hoàn 1 credit (chỉ `true`, thiếu field không tính). */
export const isCancelledWithRefund = (raw) => {
  const status = String(raw?.status ?? '').trim().toLowerCase()
  return (status === 'cancelled' || status === 'canceled') && raw?.creditReturned === true
}
