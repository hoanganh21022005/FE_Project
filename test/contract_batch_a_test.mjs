import assert from 'node:assert/strict'
import {
  CONTEXT_CODE_TEXT,
  ERROR_CODE_TEXT,
  errorHasCode,
  getErrorCode,
  readBackendMessage,
  translateErrorCode,
} from '../src/api/apiErrors.js'
import { mapClass, mapSession, optionalBoolean } from '../src/api/mappers.js'
import { normalizeAdvancedRegistration } from '../src/api/advancedRegistrationApi.js'
import { parseBackendDate } from '../src/utils/datetime.js'
import { isCashInvoiceConfirmable } from '../src/utils/paymentAccess.js'
import { convertWeekday } from '../src/utils/weekday.js'
import { toBackendDaysOfWeek } from '../src/api/normalClassCreation.js'
import { getPrivateSessionProposalErrorMessage } from '../src/utils/privateSessionProposalErrors.js'

// A.1 Bảng mã lỗi vi/en dùng chung
const CONTRACT_CODES = [
  'CANCEL_TOO_LATE', 'ADVANCED_BOOKING_TOO_LATE', 'NORMAL_OPENING_TOO_LATE', 'NORMAL_REGISTRATION_CLOSED',
  'REGISTRATION_CONFIRMATION_EXPIRED', 'PROPOSAL_EXPIRED', 'SESSION_ALREADY_ATTENDED', 'SESSION_COMPLETED',
  'PRIVATE_SESSION_REQUIRED', 'CHECKIN_WINDOW_CLOSED', 'ATTENDANCE_WINDOW_CLOSED', 'SESSION_NOT_HELD',
  'NORMAL_NOT_STARTED', 'SESSION_TIME_REQUIRED', 'COACH_REQUIRED', 'ALREADY_ENROLLED', 'WAITLIST_FULL',
  'WAITLIST_NOT_READY', 'LAST_ADMIN_REQUIRED', 'INVALID_PERMISSION_IDS',
]
const VIETNAMESE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i
for (const code of CONTRACT_CODES) {
  const vi = translateErrorCode(code, 'vi')
  const en = translateErrorCode(code, 'en')
  assert.ok(vi && VIETNAMESE.test(vi), `${code}: thiếu chữ tiếng Việt`)
  assert.ok(en && !VIETNAMESE.test(en) && en !== vi, `${code}: thiếu chữ tiếng Anh`)
  // BE chỉ trả mã hoặc câu tiếng Anh thì giao diện hiện chữ tiếng Việt của bảng
  assert.equal(readBackendMessage({ code, message: `${code}: English text` }, 409), vi)
  assert.equal(readBackendMessage({ code, message: code }, 409), vi)
  // Câu tiếng Việt cụ thể của BE không bị bảng đè
  assert.equal(readBackendMessage({ code, message: 'Câu riêng của Backend.' }, 409), 'Câu riêng của Backend.')
}
for (const [code, text] of Object.entries(ERROR_CODE_TEXT)) {
  assert.ok(text.vi && text.en, `${code}: thiếu vi hoặc en`)
}
assert.equal(translateErrorCode('KHONG_CO_MA_NAY', 'vi'), null)
assert.equal(translateErrorCode('', 'vi'), null)
assert.equal(translateErrorCode('cancel_too_late', 'en'), ERROR_CODE_TEXT.CANCEL_TOO_LATE.en)
// Ngữ cảnh riêng thắng chữ mặc định; mã không có chữ riêng rơi về chữ mặc định
assert.notEqual(
  translateErrorCode('NORMAL_NOT_STARTED', 'vi', 'attendance'),
  translateErrorCode('NORMAL_NOT_STARTED', 'vi'),
)
assert.equal(
  translateErrorCode('SESSION_NOT_HELD', 'vi', 'resultContent'),
  translateErrorCode('SESSION_NOT_HELD', 'vi'),
)
for (const [context, table] of Object.entries(CONTEXT_CODE_TEXT)) {
  for (const [code, text] of Object.entries(table)) {
    assert.ok(text.vi && text.en, `${context}/${code}: thiếu vi hoặc en`)
  }
}
// Hành vi bảng cũ ở màn đề xuất lịch được giữ
assert.equal(
  getPrivateSessionProposalErrorMessage({ code: 'PROPOSAL_EXPIRED' }, true),
  'Đề xuất đã hết hạn phản hồi. Trạng thái đã được tải lại; hãy nhờ Coach gửi lịch khác.',
)
assert.equal(
  getPrivateSessionProposalErrorMessage({ message: 'Hội viên đã có lịch trùng giờ' }, false),
  'You already have a session at this time. State was reloaded; agree on another schedule with your Coach.',
)
assert.equal(getErrorCode({ details: { errorCode: 'cancel_too_late' } }), 'CANCEL_TOO_LATE')
assert.equal(errorHasCode({ message: 'REGISTRATION_CONFIRMATION_EXPIRED: x' }, 'registration_confirmation_expired'), true)
assert.equal(errorHasCode({ message: 'khác' }, 'CANCEL_TOO_LATE'), false)

// A.2 Thời gian có và không có offset
assert.equal(parseBackendDate('2026-11-20T09:00:00'), Date.parse('2026-11-20T09:00:00+07:00'))
assert.equal(parseBackendDate('2026-11-20T09:00:00+07:00'), Date.parse('2026-11-20T02:00:00Z'))
assert.equal(parseBackendDate('2026-11-20T02:00:00Z'), Date.parse('2026-11-20T09:00:00+07:00'))
assert.equal(parseBackendDate('2026-11-20T09:00:00+0700'), Date.parse('2026-11-20T09:00:00+07:00'))
assert.ok(Number.isNaN(parseBackendDate('')))
assert.ok(Number.isNaN(parseBackendDate(null)))
assert.ok(Number.isNaN(parseBackendDate('không phải ngày')))
// paymentAccess vẫn đọc hạn hóa đơn như trước
const invoice = {
  paymentStatus: 'Pending',
  paymentMethod: 'Cash',
  expiresAt: '2026-11-20T10:00:00',
  serverTime: '2026-11-20T09:00:00+07:00',
}
assert.equal(isCashInvoiceConfirmable(invoice), true)
assert.equal(isCashInvoiceConfirmable({ ...invoice, serverTime: '2026-11-20T10:30:00+07:00' }), false)

// A.5 Chủ nhật: JS 0 <-> API 7 <-> SUNDAY
assert.equal(convertWeekday(0, 'api'), 7)
assert.equal(convertWeekday(7, 'js'), 0)
assert.equal(convertWeekday('SUNDAY', 'js'), 0)
assert.equal(convertWeekday('SUN', 'api'), 7)
assert.equal(convertWeekday(0, 'key'), 'SUNDAY')
assert.equal(convertWeekday(7, 'key'), 'SUNDAY')
assert.equal(convertWeekday(1, 'api'), 1)
assert.equal(convertWeekday(6, 'key'), 'SATURDAY')
assert.equal(convertWeekday('MONDAY', 'api'), 1)
assert.equal(convertWeekday('8', 'api'), null)
assert.equal(convertWeekday(-1, 'js'), null)
assert.equal(convertWeekday('xyz', 'js'), null)
assert.equal(convertWeekday(null, 'js'), null)
assert.throws(() => convertWeekday(1, 'nope'))
assert.deepEqual(toBackendDaysOfWeek([6, 0]), [6, 7])
assert.deepEqual(toBackendDaysOfWeek(['6', '0']), ['6', '7'])
assert.deepEqual(toBackendDaysOfWeek([1, 3, 5]), [1, 3, 5])
assert.equal(toBackendDaysOfWeek(undefined), undefined)

// A.3 Mapper giữ null khi thiếu field, không đổi thành false
assert.equal(optionalBoolean(undefined), null)
assert.equal(optionalBoolean(null), null)
assert.equal(optionalBoolean('false'), null)
assert.equal(optionalBoolean(false), false)
assert.equal(optionalBoolean(true), true)

const bareSession = mapSession({ id: 1 })
for (const key of ['bookedMemberId', 'bookedMemberName', 'creditReturned', 'serverTime', 'correctionAllowed',
  'correctionDeadline', 'cancellationAllowed', 'cancellationDeadline', 'cancellationBlockReason',
  'attendanceAllowed', 'attendanceBlockReason']) {
  assert.equal(bareSession[key], null, `mapSession.${key} phải là null khi thiếu`)
}
const fullSession = mapSession({
  id: 2,
  bookedMemberId: '15',
  bookedMemberName: 'Học viên A',
  creditReturned: true,
  serverTime: '2026-11-20T09:00:00+07:00',
  correctionAllowed: false,
  correctionDeadline: '2026-11-21T00:00:00+07:00',
  cancellationAllowed: false,
  cancellationDeadline: '2026-11-19T09:00:00+07:00',
  cancellationBlockReason: 'CANCEL_TOO_LATE',
  attendanceAllowed: true,
  attendanceBlockReason: null,
})
assert.equal(fullSession.bookedMemberId, 15)
assert.equal(fullSession.bookedMemberName, 'Học viên A')
assert.equal(fullSession.creditReturned, true)
assert.equal(fullSession.correctionAllowed, false)
assert.equal(fullSession.correctionDeadline, '2026-11-21T00:00:00+07:00')
assert.equal(fullSession.cancellationAllowed, false)
assert.equal(fullSession.cancellationDeadline, '2026-11-19T09:00:00+07:00')
assert.equal(fullSession.cancellationBlockReason, 'CANCEL_TOO_LATE')
assert.equal(fullSession.attendanceAllowed, true)
assert.equal(fullSession.serverTime, '2026-11-20T09:00:00+07:00')

const bareClass = mapClass({ id: 3, name: 'Lớp' }, { apiMode: true })
for (const key of ['advancedState', 'registrationDeadline', 'firstSessionAt', 'registrationAllowed',
  'registrationBlockReason', 'openingConfirmationDueAt', 'openingConfirmationDeadline', 'openingReasonRequired',
  'openingConfirmationAllowed', 'openingConfirmationBlockReason', 'serverTime']) {
  assert.equal(bareClass[key], null, `mapClass.${key} phải là null khi thiếu`)
}
const fullClass = mapClass({
  id: 4,
  name: 'Lớp',
  advancedState: 'Open',
  registrationDeadline: '2026-11-25T09:00:00+07:00',
  firstSessionAt: '2026-11-27T09:00:00+07:00',
  registrationAllowed: false,
  registrationBlockReason: 'NORMAL_REGISTRATION_CLOSED',
  openingConfirmationDueAt: '2026-11-26T09:00:00+07:00',
  openingConfirmationDeadline: '2026-11-26T21:00:00+07:00',
  openingReasonRequired: true,
  openingConfirmationAllowed: false,
  openingConfirmationBlockReason: 'NORMAL_OPENING_TOO_LATE',
  serverTime: '2026-11-20T09:00:00+07:00',
}, { apiMode: true })
assert.equal(fullClass.advancedState, 'Open')
assert.equal(fullClass.registrationAllowed, false)
assert.equal(fullClass.registrationBlockReason, 'NORMAL_REGISTRATION_CLOSED')
assert.equal(fullClass.registrationDeadline, '2026-11-25T09:00:00+07:00')
assert.equal(fullClass.openingReasonRequired, true)
assert.equal(fullClass.openingConfirmationAllowed, false)
assert.equal(fullClass.openingConfirmationBlockReason, 'NORMAL_OPENING_TOO_LATE')
assert.equal(fullClass.openingConfirmationDueAt, '2026-11-26T09:00:00+07:00')
assert.equal(fullClass.openingConfirmationDeadline, '2026-11-26T21:00:00+07:00')
assert.equal(fullClass.firstSessionAt, '2026-11-27T09:00:00+07:00')
assert.equal(fullClass.serverTime, '2026-11-20T09:00:00+07:00')

// A.4 Đăng ký Advanced: field mới giữ null khi thiếu
const bareRegistration = normalizeAdvancedRegistration({ id: 9, status: 'Accepted' })
assert.equal(bareRegistration.invoiceStatus, null)
assert.equal(bareRegistration.purchaseConfirmationAllowed, null)
assert.equal(bareRegistration.purchaseConfirmationBlockReason, null)
assert.equal(bareRegistration.serverTime, null)
const blockedRegistration = normalizeAdvancedRegistration({
  id: 10,
  status: 'Accepted',
  invoiceStatus: 'Pending',
  purchaseConfirmationAllowed: false,
  purchaseConfirmationBlockReason: 'REGISTRATION_CONFIRMATION_EXPIRED',
  serverTime: '2026-11-20T09:00:00+07:00',
})
assert.equal(blockedRegistration.invoiceStatus, 'Pending')
assert.equal(blockedRegistration.purchaseConfirmationAllowed, false)
assert.equal(blockedRegistration.purchaseConfirmationBlockReason, 'REGISTRATION_CONFIRMATION_EXPIRED')
assert.equal(blockedRegistration.serverTime, '2026-11-20T09:00:00+07:00')
assert.equal(normalizeAdvancedRegistration({ id: 11, purchaseConfirmationAllowed: true }).purchaseConfirmationAllowed, true)
assert.equal(normalizeAdvancedRegistration({ id: 12, invoice: { id: 5, status: 'Pending' } }).invoiceStatus, 'Pending')

console.log('contract_batch_a_test.mjs: ALL PASSED')
