import assert from 'node:assert/strict'
import {
  getPurchaseConfirmationState,
  hasExistingInvoice,
  isInvoicePending,
  readPurchaseConfirmation,
  serverClockOffsetMs,
} from '../src/utils/advancedPurchase.js'
import { normalizeAdvancedRegistration } from '../src/api/advancedRegistrationApi.js'
import { translateErrorCode } from '../src/api/apiErrors.js'

const NOW = Date.parse('2026-11-20T08:00:00+07:00')
const FUTURE = Date.parse('2026-11-20T20:00:00+07:00')
const PAST = Date.parse('2026-11-19T08:00:00+07:00')

// C2.1 Field thiếu giữ null; chỉ boolean thật mới là true/false
assert.deepEqual(readPurchaseConfirmation({}), { allowed: null, blockReason: null, serverTime: null, invoiceStatus: null })
assert.equal(readPurchaseConfirmation({ purchaseConfirmationAllowed: false }).allowed, false)
assert.equal(readPurchaseConfirmation({ purchaseConfirmationAllowed: true }).allowed, true)
assert.equal(readPurchaseConfirmation({ purchaseConfirmationAllowed: 'false' }).allowed, null)
assert.equal(readPurchaseConfirmation(undefined).allowed, null)

// C2.2 Backend khóa (false): khóa nút, lý do qua bảng chung, kể cả khi hạn xác nhận (theo đồng hồ) còn
let state = getPurchaseConfirmationState(
  { purchaseConfirmationAllowed: false, purchaseConfirmationBlockReason: 'REGISTRATION_CONFIRMATION_EXPIRED' },
  { nowMs: NOW, confirmationDeadlineMs: FUTURE },
)
assert.equal(state.canConfirm, false)
assert.equal(state.source, 'backend')
assert.equal(state.expired, true)
assert.equal(state.reasonCode, 'REGISTRATION_CONFIRMATION_EXPIRED')
assert.equal(state.reasonText, translateErrorCode('REGISTRATION_CONFIRMATION_EXPIRED', 'vi'))
state = getPurchaseConfirmationState(
  { purchaseConfirmationAllowed: false, purchaseConfirmationBlockReason: 'BOOKING_BLOCKED' },
  { nowMs: NOW, confirmationDeadlineMs: FUTURE, language: 'en' },
)
assert.equal(state.canConfirm, false)
assert.equal(state.expired, false)
assert.equal(state.reasonText, translateErrorCode('BOOKING_BLOCKED', 'en'))
// Mã lạ hoặc thiếu mã: câu chung, không lộ mã kỹ thuật
state = getPurchaseConfirmationState({ purchaseConfirmationAllowed: false, purchaseConfirmationBlockReason: 'MA_LA' }, { nowMs: NOW })
assert.equal(state.canConfirm, false)
assert.equal(state.reasonText, 'Thao tác hiện chưa khả dụng. (MA_LA)')
state = getPurchaseConfirmationState({ purchaseConfirmationAllowed: false }, { nowMs: NOW, language: 'en' })
assert.equal(state.reasonText, 'This action is not available right now.')

// C2.3 Backend cho phép (true): mở nút, không dùng riêng confirmationDeadline
state = getPurchaseConfirmationState({ purchaseConfirmationAllowed: true }, { nowMs: NOW, confirmationDeadlineMs: PAST })
assert.equal(state.canConfirm, true)
assert.equal(state.source, 'backend')
state = getPurchaseConfirmationState({ purchaseConfirmationAllowed: true }, { nowMs: NOW, confirmationDeadlineMs: null })
assert.equal(state.canConfirm, true)

// C2.4 Thiếu field (null): giữ cách cũ theo hạn xác nhận; không khóa vì "thiếu"
state = getPurchaseConfirmationState({}, { nowMs: NOW, confirmationDeadlineMs: FUTURE })
assert.equal(state.canConfirm, true)
assert.equal(state.source, 'legacy')
state = getPurchaseConfirmationState({ purchaseConfirmationAllowed: null }, { nowMs: NOW, confirmationDeadlineMs: FUTURE })
assert.equal(state.canConfirm, true)
state = getPurchaseConfirmationState({}, { nowMs: NOW, confirmationDeadlineMs: PAST })
assert.equal(state.canConfirm, false)
assert.equal(state.expired, true)
assert.equal(state.deadlineUnknown, false)
state = getPurchaseConfirmationState({}, { nowMs: NOW, confirmationDeadlineMs: null })
assert.equal(state.canConfirm, false)
assert.equal(state.deadlineUnknown, true)
// Backend vừa từ chối vì hết hạn: khóa dù field mới nói gì
state = getPurchaseConfirmationState({ purchaseConfirmationAllowed: true }, { nowMs: NOW, confirmationDeadlineMs: FUTURE, expiredByRejection: true })
assert.equal(state.canConfirm, false)
assert.equal(state.source, 'rejection')

// C2.5 serverTime của Backend được ưu tiên hơn đồng hồ trình duyệt khi so hạn
const rows = [{ id: 1 }, { id: 2, serverTime: '2026-11-20T08:00:00+07:00' }]
const browserNow = Date.parse('2026-11-21T09:00:00+07:00') // máy khách lệch 25 giờ
const offset = serverClockOffsetMs(rows, browserNow)
assert.equal(offset, NOW - browserNow)
assert.equal(serverClockOffsetMs([{ id: 1 }], browserNow), 0)
assert.equal(serverClockOffsetMs([{ serverTime: 'không hợp lệ' }], browserNow), 0)
assert.equal(serverClockOffsetMs(undefined, browserNow), 0)
state = getPurchaseConfirmationState({}, { nowMs: browserNow + offset, confirmationDeadlineMs: FUTURE })
assert.equal(state.canConfirm, true, 'theo giờ Backend hạn còn, dù đồng hồ máy khách đã quá hạn')
state = getPurchaseConfirmationState({}, { nowMs: browserNow, confirmationDeadlineMs: FUTURE })
assert.equal(state.canConfirm, false, 'đối chứng: đồng hồ máy khách lệch sẽ khóa nhầm')

// C2.6 Hóa đơn đã có: mở lại, không tạo mới
assert.equal(hasExistingInvoice({ invoiceId: 55 }), true)
assert.equal(hasExistingInvoice({ invoiceId: '55' }), true)
assert.equal(hasExistingInvoice({}, { invoiceId: 9 }), true)
assert.equal(hasExistingInvoice({ invoiceId: null }), false)
assert.equal(hasExistingInvoice({ invoiceId: 0 }), false)
assert.equal(hasExistingInvoice({ invoiceId: 'abc' }), false)
assert.equal(hasExistingInvoice({}), false)
assert.equal(hasExistingInvoice(undefined), false)
assert.equal(isInvoicePending('Pending'), true)
assert.equal(isInvoicePending('pending_payment'), true)
assert.equal(isInvoicePending('Paid'), false)
assert.equal(isInvoicePending(null), false)

// C2.7 normalizeAdvancedRegistration giữ invoiceId/invoiceStatus/field xác nhận mua khớp helper
const reg = normalizeAdvancedRegistration({
  id: 3, status: 'Accepted', invoiceId: 55, invoiceStatus: 'Pending',
  purchaseConfirmationAllowed: false, purchaseConfirmationBlockReason: 'REGISTRATION_CONFIRMATION_EXPIRED',
  serverTime: '2026-11-20T08:00:00+07:00',
})
assert.equal(reg.invoiceId, 55)
assert.equal(hasExistingInvoice(reg), true)
assert.equal(isInvoicePending(reg.invoiceStatus), true)
assert.equal(getPurchaseConfirmationState(reg, { nowMs: NOW, confirmationDeadlineMs: FUTURE }).canConfirm, false)
const bare = normalizeAdvancedRegistration({ id: 4, status: 'Accepted', confirmationDeadline: '2026-11-20T20:00:00+07:00' })
assert.equal(bare.purchaseConfirmationAllowed, null)
assert.equal(getPurchaseConfirmationState(bare, { nowMs: NOW, confirmationDeadlineMs: FUTURE }).canConfirm, true)

// C2.8 Mã lý do khóa theo contract đều có chữ vi/en trong bảng chung
for (const code of ['COACH_ACCEPTANCE_REQUIRED', 'REGISTRATION_CONFIRMATION_EXPIRED', 'SUBJECT_UNAVAILABLE', 'MEMBER_NOT_ACTIVE', 'BOOKING_BLOCKED']) {
  assert.ok(translateErrorCode(code, 'vi'), `${code}: thiếu chữ vi`)
  assert.ok(translateErrorCode(code, 'en'), `${code}: thiếu chữ en`)
}

console.log('contract_c2_advanced_test.mjs: ALL PASSED')
