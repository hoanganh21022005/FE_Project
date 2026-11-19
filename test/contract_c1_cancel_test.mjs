import assert from 'node:assert/strict'
import {
  describeCancellationBlock,
  getPrivateSessionTimingRule,
  isCancellationConfirmed,
  isCancellationLocked,
  isCancelledWithRefund,
  readCancellationFields,
  referenceNowMs,
  resolveCancellationOutcome,
  sumAdvancedCredits,
} from '../src/utils/sessionCancellation.js'
import { buildScheduleItems } from '../src/utils/scheduleModel.js'
import { getErrorMessage } from '../src/api/apiErrors.js'

// Mốc "bây giờ" cố định: 2026-11-20 08:00 giờ Việt Nam
const NOW = new Date('2026-11-20T08:00:00+07:00')
const session = (extra = {}) => ({
  id: 7,
  status: 'Scheduled',
  sessionDate: '2026-11-21',
  startTime: '15:00:00',
  endTime: '16:30:00',
  ...extra,
})

// C1.1 Field thiếu giữ null; chỉ === false mới khóa
assert.deepEqual(readCancellationFields({}), {
  allowed: null, blockReason: null, deadline: null, serverTime: null, creditReturned: null,
})
assert.equal(readCancellationFields({ cancellationAllowed: false }).allowed, false)
assert.equal(readCancellationFields({ cancellationAllowed: true }).allowed, true)
assert.equal(readCancellationFields({ cancellationAllowed: 'false' }).allowed, null)
assert.equal(readCancellationFields({ cancellationAllowed: undefined }).allowed, null)
assert.equal(isCancellationLocked({ cancellationAllowed: false }), true)
assert.equal(isCancellationLocked({ cancellationAllowed: null }), false)
assert.equal(isCancellationLocked({}), false)
assert.equal(isCancellationLocked(undefined), false)
assert.equal(isCancellationConfirmed({ cancellationAllowed: true }), true)
assert.equal(isCancellationConfirmed({}), false)

// C1.2 Quy tắc nút hủy theo cancellationAllowed (buổi còn 31 giờ)
let rule = getPrivateSessionTimingRule(session({ cancellationAllowed: false }), NOW)
assert.equal(rule.isCancelLocked, true)
assert.equal(rule.isCancellable, false)
rule = getPrivateSessionTimingRule(session({ cancellationAllowed: true }), NOW)
assert.equal(rule.isCancelLocked, false)
assert.equal(rule.isCancellable, true)
// Thiếu field: giữ quy tắc cũ (hủy khi >= 12 giờ), không bị khóa
rule = getPrivateSessionTimingRule(session(), NOW)
assert.equal(rule.isCancelLocked, false)
assert.equal(rule.isCancellable, true)
rule = getPrivateSessionTimingRule(session({ cancellationAllowed: null }), NOW)
assert.equal(rule.isCancelLocked, false)
assert.equal(rule.isCancellable, true)
// Thiếu field, còn 5 giờ: quy tắc cũ không cho hủy nhưng cũng không "khóa kèm lý do"
const soon = { sessionDate: '2026-11-20', startTime: '13:00:00', endTime: '14:30:00' }
rule = getPrivateSessionTimingRule(session(soon), NOW)
assert.equal(rule.isCancellable, false)
assert.equal(rule.isCancelLocked, false)
assert.equal(rule.isAbsentApplicable, true)
// Backend cho phép (true) thì cho hủy dù còn dưới 12 giờ
rule = getPrivateSessionTimingRule(session({ ...soon, cancellationAllowed: true }), NOW)
assert.equal(rule.isCancellable, true)
// Backend khóa (false) khi còn dưới 12 giờ: khóa kèm lý do
rule = getPrivateSessionTimingRule(session({ ...soon, cancellationAllowed: false }), NOW)
assert.equal(rule.isCancelLocked, true)
assert.equal(rule.isCancellable, false)
// Buổi đã kết thúc, đã hủy, đã hoàn thành: không có nút hủy, không khóa
for (const extra of [
  { sessionDate: '2026-11-19', startTime: '08:00:00', endTime: '09:30:00', cancellationAllowed: true },
  { status: 'Cancelled', cancellationAllowed: false },
  { status: 'Completed', cancellationAllowed: true },
]) {
  rule = getPrivateSessionTimingRule(session(extra), NOW)
  assert.equal(rule.isCancellable, false)
  assert.equal(rule.isCancelLocked, false)
}
// serverTime của Backend được ưu tiên hơn đồng hồ trình duyệt
assert.equal(referenceNowMs({ serverTime: '2026-11-20T08:00:00+07:00' }, 0), Date.parse('2026-11-20T01:00:00Z'))
assert.equal(referenceNowMs({ serverTime: 'không hợp lệ' }, 123), 123)
assert.equal(referenceNowMs({}, 456), 456)
const lateBrowserClock = new Date('2026-11-21T09:00:00+07:00') // máy khách lệch, tưởng đã gần giờ học
rule = getPrivateSessionTimingRule(session({ serverTime: '2026-11-20T08:00:00+07:00' }), lateBrowserClock)
assert.equal(rule.isCancellable, true)

// C1.3 Lý do khóa qua bảng mã lỗi chung, không lộ mã kỹ thuật
const tooLate = describeCancellationBlock({
  cancellationAllowed: false,
  cancellationBlockReason: 'CANCEL_TOO_LATE',
  cancellationDeadline: '2026-11-20T03:00:00+07:00',
}, 'vi')
assert.equal(tooLate.code, 'CANCEL_TOO_LATE')
assert.match(tooLate.reasonText, /quá hạn hủy/)
assert.equal(tooLate.deadline, '2026-11-20T03:00:00+07:00')
assert.match(describeCancellationBlock({ cancellationBlockReason: 'CANCEL_TOO_LATE' }, 'en').reasonText, /cancellation deadline/)
assert.match(describeCancellationBlock({ cancellationBlockReason: 'SESSION_ALREADY_ATTENDED' }, 'vi').reasonText, /điểm danh/)
const unknown = describeCancellationBlock({ cancellationBlockReason: 'MA_LA_CHUA_CO' }, 'vi')
// Mã lạ: câu chung kèm mã nhỏ trong ngoặc (lớp lót chung), không chỉ mã thô
assert.equal(unknown.reasonText, 'Thao tác hiện chưa khả dụng. (MA_LA_CHUA_CO)')
assert.equal(describeCancellationBlock({}, 'en').reasonText, 'This action is not available right now.')

// C1.4 Credit: chỉ báo "X→Y" khi creditReturned === true và số đọc lại đúng bằng số trước + 1
const adv = (credit, extra = {}) => ({ packageType: 'Advanced', status: 'active', remainingCredit: credit, ...extra })
assert.equal(sumAdvancedCredits([adv(11)]), 11)
assert.equal(sumAdvancedCredits([adv(11), adv(2, { status: 'grace_period' })]), 13)
assert.equal(sumAdvancedCredits([adv(11), adv(5, { packageType: 'Normal' }), adv(4, { status: 'expired' })]), 11)
assert.equal(sumAdvancedCredits([adv(null)]), null)
assert.equal(sumAdvancedCredits([adv(undefined)]), null)
assert.equal(sumAdvancedCredits([]), null)
assert.equal(sumAdvancedCredits(undefined), null)
assert.equal(sumAdvancedCredits([adv(0)]), 0)
assert.deepEqual(
  resolveCancellationOutcome({ creditReturned: true, creditBefore: 11, creditAfter: 12 }),
  { kind: 'refunded_verified', before: 11, after: 12 },
)
assert.equal(resolveCancellationOutcome({ creditReturned: true, creditBefore: 0, creditAfter: 1 }).kind, 'refunded_verified')
// Số đọc lại không khớp: không được nêu "X→Y"
assert.equal(resolveCancellationOutcome({ creditReturned: true, creditBefore: 11, creditAfter: 11 }).kind, 'refunded_unverified')
assert.equal(resolveCancellationOutcome({ creditReturned: true, creditBefore: 11, creditAfter: 14 }).kind, 'refunded_unverified')
assert.equal(resolveCancellationOutcome({ creditReturned: true, creditBefore: null, creditAfter: 12 }).kind, 'refunded_unverified')
assert.equal(resolveCancellationOutcome({ creditReturned: true, creditBefore: 11, creditAfter: null }).kind, 'refunded_unverified')
// Backend không xác nhận hoàn: không bao giờ báo đã hoàn, dù số có tăng
assert.equal(resolveCancellationOutcome({ creditReturned: false, creditBefore: 11, creditAfter: 12 }).kind, 'no_refund_confirmed')
assert.equal(resolveCancellationOutcome({ creditReturned: undefined, creditBefore: 11, creditAfter: 12 }).kind, 'no_refund_confirmed')
assert.equal(resolveCancellationOutcome({ creditReturned: null, creditBefore: 11, creditAfter: 12 }).kind, 'no_refund_confirmed')

// C1.5 Nhãn buổi đã hủy: chỉ khi creditReturned === true
assert.equal(isCancelledWithRefund({ status: 'Cancelled', creditReturned: true }), true)
assert.equal(isCancelledWithRefund({ status: 'cancelled', creditReturned: true }), true)
assert.equal(isCancelledWithRefund({ status: 'Cancelled', creditReturned: false }), false)
assert.equal(isCancelledWithRefund({ status: 'Cancelled' }), false)
assert.equal(isCancelledWithRefund({ status: 'Scheduled', creditReturned: true }), false)

// C1.6 Lỗi 409 hiện câu từ bảng mã lỗi chung
const attended = { status: 409, code: 'SESSION_ALREADY_ATTENDED', details: { code: 'SESSION_ALREADY_ATTENDED', message: 'Session already attended' } }
assert.match(getErrorMessage(attended, 'x'), /đã được điểm danh/)
const late = { status: 409, code: 'CANCEL_TOO_LATE', details: { code: 'CANCEL_TOO_LATE', message: 'CANCEL_TOO_LATE: too late' } }
assert.match(getErrorMessage(late, 'x'), /quá hạn hủy/)

// C1.7 Lịch học (scheduleModel) mang field hủy buổi, thiếu thì null
const ptRaw = (extra = {}) => ({
  id: 41, classId: null, status: 'Scheduled', isPrivate: true, sessionDate: '2026-11-21',
  startTime: '15:00:00', endTime: '16:30:00', subjectName: 'Tennis', coachName: 'Coach A', ...extra,
})
const build = (raw) => buildScheduleItems({ ptSessions: [raw], now: NOW.getTime() }).find((item) => item.kind === 'pt')
const bare = build(ptRaw())
assert.ok(bare, 'buổi PT phải có trong lịch')
assert.equal(bare.cancellationAllowed, null)
assert.equal(bare.cancellationBlockReason, null)
assert.equal(bare.cancellationDeadline, null)
assert.equal(bare.canCancelPt, true)
const blocked = build(ptRaw({ cancellationAllowed: false, cancellationBlockReason: 'CANCEL_TOO_LATE', cancellationDeadline: '2026-11-20T03:00:00+07:00' }))
assert.equal(blocked.cancellationAllowed, false)
assert.equal(blocked.cancellationBlockReason, 'CANCEL_TOO_LATE')
assert.equal(blocked.cancellationDeadline, '2026-11-20T03:00:00+07:00')
assert.equal(build(ptRaw({ cancellationAllowed: true })).cancellationAllowed, true)
const refunded = build(ptRaw({ status: 'Cancelled', creditReturned: true }))
assert.equal(refunded.status, 'Cancelled')
assert.equal(refunded.creditReturned, true)
assert.equal(build(ptRaw({ status: 'Cancelled' })).creditReturned, false)

console.log('contract_c1_cancel_test.mjs: ALL PASSED')
