// Logic đăng ký lớp Normal của Member (màn Khóa học, chế độ thật), tách ra để kiểm bằng test .mjs không cần trình duyệt.
// Quy tắc: registrationAllowed === false thì khóa nút và nêu lý do; === true thì mở nút (kể cả lớp đầy: kết quả là danh sách chờ);
// thiếu field (null) thì giữ cách cũ và để Backend từ chối khi lưu. Không suy ra false từ field thiếu.
import { describeBlockReason } from '../api/apiErrors.js'
import { parseBackendDate } from './datetime.js'

const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null)

/** Đọc field đăng ký của một lớp thô; thiếu thì null. */
export function readNormalRegistration(courseClass) {
  return {
    allowed: typeof courseClass?.registrationAllowed === 'boolean' ? courseClass.registrationAllowed : null,
    blockReason: text(courseClass?.registrationBlockReason),
    deadline: text(courseClass?.registrationDeadline),
    serverTime: text(courseClass?.serverTime),
  }
}

/** Backend nói rõ cho đăng ký (lớp đầy vẫn được nhận, vào danh sách chờ). */
export const allowsFullClass = (courseClass) => courseClass?.registrationAllowed === true

/** Hạn đăng ký theo giờ Việt Nam; không đọc được thì trả '' (không để NaN lọt vào Intl). */
export function formatRegistrationDeadline(value, language = 'vi') {
  const ms = parseBackendDate(value)
  if (!Number.isFinite(ms)) return ''
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(ms))
}

/**
 * Quyết định nút "Đăng ký lớp":
 * - false: khóa, lý do qua bảng mã lỗi chung (mã lạ hoặc thiếu mã thì câu chung), kèm hạn đăng ký nếu có;
 * - true: mở khi lớp qua các kiểm tra khác (`checkEligible`, đã tính allowFull) và có giá; bỏ qua mốc 48 giờ phía trình duyệt;
 * - null: giữ cách cũ (`checkEligible`, có giá và chưa quá mốc 48 giờ phía trình duyệt).
 */
export function decideNormalEnroll(courseClass, { checkEligible = false, cutoffPassed = false, hasPrice = true, language = 'vi' } = {}) {
  const { allowed, blockReason, deadline } = readNormalRegistration(courseClass)
  if (allowed === false) {
    return {
      canEnroll: false,
      source: 'backend',
      reasonCode: blockReason,
      reasonText: describeBlockReason(blockReason, language),
      deadlineText: formatRegistrationDeadline(deadline, language),
    }
  }
  if (allowed === true) {
    return { canEnroll: Boolean(checkEligible && hasPrice), source: 'backend', reasonCode: null, reasonText: null, deadlineText: formatRegistrationDeadline(deadline, language) }
  }
  return { canEnroll: Boolean(checkEligible && hasPrice && !cutoffPassed), source: 'legacy', reasonCode: null, reasonText: null, deadlineText: '' }
}

/**
 * Đọc kết quả thật từ response POST đăng ký lớp:
 * - 'waitlisted': vào danh sách chờ, KHÔNG đi tiếp bước thanh toán (không hóa đơn/VNPay);
 * - 'pending': chờ thanh toán; 'registered': đã đăng ký; 'unknown': response không nêu trạng thái.
 */
export function readEnrollmentOutcome(response) {
  const raw = response?.status ?? response?.enrollmentStatus ?? null
  const status = typeof raw === 'string' ? raw.trim() : null
  const key = (status ?? '').toLowerCase().replace(/[\s_-]+/g, '')
  const kind = key === 'waitlisted' ? 'waitlisted' : key === 'pending' || key === 'pendingpayment' ? 'pending' : key === 'registered' ? 'registered' : 'unknown'
  const position = Number(response?.waitlistPosition ?? response?.position)
  return {
    kind,
    status,
    proceedToPayment: kind !== 'waitlisted',
    waitlistPosition: Number.isInteger(position) && position > 0 ? position : null,
  }
}
