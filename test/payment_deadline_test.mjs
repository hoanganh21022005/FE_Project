import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// advancedRegistrationApi kéo httpClient: mock nhẹ để import trong node
globalThis.window = { dispatchEvent() { return true } }
globalThis.localStorage = { getItem: () => null }
globalThis.sessionStorage = { getItem: () => null }

const { buildOrderCreatedMessage, formatPaymentDeadline } = await import('../src/utils/paymentDeadline.js')
const { normalizeAdvancedOrderResponse } = await import('../src/api/advancedRegistrationApi.js')

// E2.1 Hạn theo expiresAt (giờ Việt Nam)
assert.equal(formatPaymentDeadline('2026-11-20T09:30:00+07:00', 'vi'), '09:30 20/11/2026')
assert.equal(formatPaymentDeadline('2026-11-20T02:30:00Z', 'vi'), '09:30 20/11/2026', 'quy về giờ Việt Nam')
assert.equal(formatPaymentDeadline('2026-11-20T09:30:00', 'vi'), '09:30 20/11/2026', 'không offset hiểu là giờ Việt Nam')
assert.equal(formatPaymentDeadline('2026-11-20T09:30:00+07:00', 'en'), '09:30 20/11/2026')
assert.equal(formatPaymentDeadline('2026-12-31T16:59:00Z', 'vi'), '23:59 31/12/2026')
// Không đọc được: rỗng, không NaN/Invalid
for (const bad of ['', '   ', null, undefined, 'không phải ngày', 'NaN', {}, []]) {
  assert.equal(formatPaymentDeadline(bad, 'vi'), '', `giá trị ${JSON.stringify(bad)}`)
}

// E2.2 Câu báo: có hạn thì nêu hạn; không có hạn thì KHÔNG nêu số phút
const withDeadline = buildOrderCreatedMessage({ invoiceCode: 'INV-77', paymentMethod: 'VNPay', expiresAt: '2026-11-20T09:30:00+07:00', language: 'vi' })
assert.equal(withDeadline, 'Đã tạo đơn thanh toán (INV-77) thành công! Hạn thanh toán: 09:30 20/11/2026.')
const withDeadlineEn = buildOrderCreatedMessage({ invoiceCode: 'INV-77', paymentMethod: 'VNPay', expiresAt: '2026-11-20T09:30:00+07:00', language: 'en' })
assert.equal(withDeadlineEn, 'Payment order created (INV-77). Pay before 09:30 20/11/2026.')
const noDeadline = buildOrderCreatedMessage({ invoiceCode: 'INV-77', paymentMethod: 'VNPay', expiresAt: null, language: 'vi' })
assert.equal(noDeadline, 'Đã tạo đơn thanh toán (INV-77) thành công!')
assert.ok(!/phút|minute|Hạn thanh toán/.test(noDeadline))
const noDeadlineEn = buildOrderCreatedMessage({ invoiceCode: null, paymentMethod: 'Cash', expiresAt: 'rác', language: 'en' })
assert.equal(noDeadlineEn, 'Payment order created (Cash).')
assert.ok(!/minute|NaN|Invalid/.test(noDeadlineEn))
assert.equal(buildOrderCreatedMessage({ language: 'vi' }), 'Đã tạo đơn thanh toán thành công!')
// Không phụ thuộc số phút: hóa đơn 30 phút hay giá trị khác đều chỉ theo expiresAt
assert.ok(buildOrderCreatedMessage({ expiresAt: '2026-11-20T10:00:00+07:00', language: 'vi' }).includes('10:00 20/11/2026'))

// E2.3 Response đơn thật có expiresAt nằm ở nhiều chỗ (gốc, invoice, order): normalize lấy được
assert.equal(normalizeAdvancedOrderResponse({ invoiceId: 5, invoiceCode: 'INV-5', expiresAt: '2026-11-20T09:30:00+07:00' }).expiresAt, '2026-11-20T09:30:00+07:00')
assert.equal(normalizeAdvancedOrderResponse({ invoice: { id: 5, invoiceCode: 'INV-5', expiresAt: '2026-11-20T09:30:00+07:00' } }).expiresAt, '2026-11-20T09:30:00+07:00')
assert.equal(normalizeAdvancedOrderResponse({ invoiceId: 5, invoiceExpiresAt: '2026-11-20T09:30:00+07:00' }).expiresAt, '2026-11-20T09:30:00+07:00')
assert.equal(normalizeAdvancedOrderResponse({ invoiceId: 5 }).expiresAt, null)
const created = normalizeAdvancedOrderResponse({ invoiceId: 5, invoiceCode: 'INV-5', expiresAt: '2026-11-20T09:30:00+07:00', serverTime: '2026-11-20T09:00:00+07:00' })
assert.equal(
  buildOrderCreatedMessage({ invoiceCode: created.invoiceCode, paymentMethod: 'VNPay', expiresAt: created.expiresAt, language: 'vi' }),
  'Đã tạo đơn thanh toán (INV-5) thành công! Hạn thanh toán: 09:30 20/11/2026.',
)

// E2.4 Màn "HLV của tôi" không còn câu "5 phút" cứng và dùng hàm định dạng hạn (lỗi trên mã cũ)
const view = readFileSync(new URL('../src/components/views/MemberMyCoachView.jsx', import.meta.url), 'utf8')
assert.ok(!/5 phút|5-minute|5 minute/i.test(view), 'còn câu 5 phút cứng trong MemberMyCoachView')
assert.match(view, /buildOrderCreatedMessage\(/)
assert.match(view, /normalizeAdvancedOrderResponse\(orderRes\)/)

console.log('payment_deadline_test.mjs: ALL PASSED')
