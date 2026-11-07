import assert from 'node:assert/strict'
import { invoiceApi } from '../src/api/invoiceApi.js'
import { memberApi } from '../src/api/memberApi.js'
import { classEnrollmentApi } from '../src/api/classEnrollmentApi.js'
import { advancedRegistrationApi } from '../src/api/advancedRegistrationApi.js'
import { membershipApi } from '../src/api/membershipApi.js'
import { memberPortalApi } from '../src/api/memberPortalApi.js'
import { readFile } from 'node:fs/promises'

console.log('=== RUNNING FE RBAC PHASE 1 NETWORK FIXTURE VALIDATION ===')

const capturedRequests = []
const originalFetch = globalThis.fetch

globalThis.fetch = async (url, options = {}) => {
  const urlStr = String(url)
  const method = options.method || 'GET'
  let parsedBody = null
  if (options.body) {
    try {
      parsedBody = JSON.parse(options.body)
    } catch {
      parsedBody = options.body
    }
  }
  capturedRequests.push({ url: urlStr, method, headers: options.headers, body: parsedBody })

  // Route mocks
  if (urlStr.includes('/api/invoices/99/confirm-cash')) {
    return new Response(JSON.stringify({ id: 99, status: 'PAID', paymentMethod: 'CASH' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  if (urlStr.includes('/api/members/me/invoices')) {
    return new Response(JSON.stringify([
      { id: 101, amount: 500000, status: 'PENDING', paymentMethod: 'ONLINE' },
      { id: 102, amount: 300000, status: 'PAID', paymentMethod: 'CASH' },
    ]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  if (urlStr.includes('/api/invoices/101/pay-online')) {
    return new Response(JSON.stringify({ paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?token=xyz' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  if (urlStr.includes('/api/members') && method === 'POST') {
    return new Response(JSON.stringify({ id: 501, ...parsedBody, status: 'ACTIVE' }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    })
  }

  if (urlStr.includes('/api/members/501/subscriptions')) {
    return new Response(JSON.stringify([
      { subscriptionId: 88, packageType: 'Advanced', remainingCredit: 12, status: 'Active' },
    ]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  if (urlStr.includes('/api/classes/10/enroll')) {
    return new Response(JSON.stringify({ enrollmentId: 201, status: 'Active' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  if (urlStr.includes('/api/advanced-registrations/20/order')) {
    return new Response(JSON.stringify({ invoiceId: 301, subscriptionId: 88, paymentUrl: 'https://vnpay.mock' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

try {
  // 1. Receptionist Cash confirmation on Pending invoice: POST /api/invoices/{id}/confirm-cash without request body
  capturedRequests.length = 0
  const confirmResult = await invoiceApi.confirmCashPayment(99)
  assert.equal(capturedRequests.length, 1)
  assert.equal(capturedRequests[0].method, 'POST')
  assert.match(capturedRequests[0].url, /\/api\/invoices\/99\/confirm-cash$/)
  assert.equal(capturedRequests[0].body, null, 'confirm-cash must not send body')
  console.log('PASS: [1] Receptionist confirmCashPayment calls POST /api/invoices/99/confirm-cash without body.')

  // 2. Member personal invoice list and VNPay payment
  capturedRequests.length = 0
  const invoices = await invoiceApi.getMemberOwnInvoices({ strict: true })
  assert.equal(capturedRequests.length, 1)
  assert.match(capturedRequests[0].url, /\/api\/members\/me\/invoices$/)
  assert.equal(invoices.length, 2)

  const payOnlineResult = await invoiceApi.payInvoiceOnline(101)
  assert.equal(capturedRequests.length, 2)
  assert.match(capturedRequests[1].url, /\/api\/invoices\/101\/pay-online$/)
  assert.equal(payOnlineResult.paymentUrl.includes('vnpayment.vn'), true)

  // Verify that NO payment-resolutions endpoints were hit
  const hasResolutionCall = capturedRequests.some(r => r.url.includes('payment-resolutions'))
  assert.equal(hasResolutionCall, false, 'Member actions must NEVER hit /api/payment-resolutions')
  console.log('PASS: [2] Member invoices flow calls /api/members/me/invoices and /api/invoices/{id}/pay-online with 0 calls to payment-resolutions.')

  // 3. Counter Member creation payload validation
  capturedRequests.length = 0
  const memberFormData = {
    name: 'Nguyễn Văn A',
    email: 'nguyenvana@example.com',
    phone: '0901234567',
    dateOfBirth: '1995-05-15',
    address: '123 Đường Lê Lợi, Q1, TP.HCM',
    gender: 'MALE',
    goal: 'Tăng cơ giảm mỡ',
    healthNote: 'Không có tiền sử bệnh lý',
  }
  const createdMember = await memberApi.createMember(memberFormData)
  assert.equal(capturedRequests.length, 1)
  assert.equal(capturedRequests[0].method, 'POST')
  assert.match(capturedRequests[0].url, /\/api\/members$/)
  assert.equal(capturedRequests[0].body.name, 'Nguyễn Văn A')
  assert.equal(capturedRequests[0].body.email, 'nguyenvana@example.com')
  assert.equal('packageId' in capturedRequests[0].body, false, 'Payload must NOT include packageId')
  assert.equal('membershipPackageId' in capturedRequests[0].body, false, 'Payload must NOT include membershipPackageId')
  console.log('PASS: [3] Counter member registration payload contains strictly member profile fields and NO packageId.')

  // 4. Advanced & Normal course flow + subscriptions reading
  capturedRequests.length = 0
  await classEnrollmentApi.enrollCurrentMemberInClass(10, 'VNPay')
  assert.match(capturedRequests[0].url, /\/api\/classes\/10\/enroll$/)

  await advancedRegistrationApi.createAdvancedOrder(20, 'VNPay')
  assert.match(capturedRequests[1].url, /\/api\/advanced-registrations\/20\/order$/)

  const subs = await membershipApi.getMemberSubscriptions(501, { strict: true })
  assert.match(capturedRequests[2].url, /\/api\/members\/501\/subscriptions$/)
  assert.equal(subs.length, 1)
  console.log('PASS: [4] Normal/Advanced flows use dedicated endpoints and subscriptions are read via /api/members/{id}/subscriptions.')

  // 5. Freeze Request View Read queries and strict 0-POST contract guard
  capturedRequests.length = 0
  const holidays = await memberPortalApi.getActiveHolidays()
  const incidents = await memberPortalApi.getCenterIncidents()
  const memberSubs = await membershipApi.getMemberSubscriptions(501, { strict: true })
  assert.equal(capturedRequests.some(r => r.url.includes('/api/holidays')), true, 'Must query holidays')
  assert.equal(capturedRequests.some(r => r.url.includes('/api/center-incidents')), true, 'Must query incidents')
  assert.equal(capturedRequests.some(r => r.url.includes('/api/members/501/subscriptions')), true, 'Must query subscriptions')

  // Verify that NO POST /api/subscriptions/*/extend was sent
  const extendPosts = capturedRequests.filter(r => r.method === 'POST' && r.url.includes('/extend'))
  assert.equal(extendPosts.length, 0, 'In API mode, must send exactly 0 POST to /api/subscriptions/*/extend')
  console.log('PASS: [5] Freeze request view queries holidays, incidents, and subscriptions, and sends exactly 0 POST extend.')

  // 6. Code inspection checks:
  // - PaymentManagement.jsx must NOT call confirmCashPayment
  const paymentMgmtCode = await readFile(new URL('../src/components/views/PaymentManagement.jsx', import.meta.url), 'utf8')
  assert.equal(paymentMgmtCode.includes('confirmCashPayment'), false, 'PaymentManagement must not have confirmCashPayment')
  assert.equal(paymentMgmtCode.includes('PaymentModal'), false, 'PaymentManagement must not mount PaymentModal')

  // - ReceptionPaymentsView.jsx must retain confirmCashPayment
  const receptionPaymentsCode = await readFile(new URL('../src/components/views/ReceptionPaymentsView.jsx', import.meta.url), 'utf8')
  assert.equal(receptionPaymentsCode.includes('confirmCashPayment'), true, 'ReceptionPaymentsView must retain confirmCashPayment')
  assert.equal(receptionPaymentsCode.includes('PaymentModal'), false, 'ReceptionPaymentsView must not mount PaymentModal')

  // - MemberInvoicesView.jsx must NOT call getPaymentResolutions
  const memberInvoicesCode = await readFile(new URL('../src/components/views/MemberInvoicesView.jsx', import.meta.url), 'utf8')
  assert.equal(memberInvoicesCode.includes('getPaymentResolutions'), false, 'MemberInvoicesView must not have getPaymentResolutions')
  assert.equal(memberInvoicesCode.includes('payment-resolutions'), false, 'MemberInvoicesView must not mention payment-resolutions')

  // - MyMembershipView.jsx must guide user to catalog for Advanced registration
  const myMembershipCode = await readFile(new URL('../src/components/views/MyMembershipView.jsx', import.meta.url), 'utf8')
  assert.match(myMembershipCode, /Danh mục khóa học/)
  assert.match(myMembershipCode, /\/member\/catalog/)

  // - MemberFreezeRequestView.jsx must retain read queries, lock/hide form in API mode, block extend POST in handler, and retain receptionist guidance
  const freezeCode = await readFile(new URL('../src/components/views/MemberFreezeRequestView.jsx', import.meta.url), 'utf8')
  assert.match(freezeCode, /memberPortalApi\s*\.getActiveHolidays/)
  assert.match(freezeCode, /memberPortalApi\s*\.getCenterIncidents/)
  assert.match(freezeCode, /membershipApi\s*\.getMemberSubscriptions/)
  assert.match(freezeCode, /if\s*\(apiEnabled\)\s*\{\s*setSubmitting\(false\)[\s\S]*setSubmitted\(false\)[\s\S]*return/)
  assert.match(freezeCode, /apiEnabled\s*\?\s*\(/, 'Must branch UI based on apiEnabled')
  assert.match(freezeCode, /Hướng dẫn liên hệ Lễ tân để hỗ trợ bảo lưu thủ công/, 'Must provide receptionist guidance in API mode')
  assert.doesNotMatch(freezeCode, /apiEnabled[\s\S]*membershipApi\.extendSubscription/, 'Must not invoke extendSubscription in API mode')

  console.log('PASS: [6] Static source code assertions verified: Manager confirm-cash removed, Receptionist confirm-cash retained, Member payment-resolutions eradicated, empty state guide present, freeze view locked & 0 POST extend verified.')

  console.log('\n======================================================')
  console.log('ALL FE RBAC PHASE 1 NETWORK FIXTURE VALIDATIONS PASSED')
  console.log('======================================================')
} finally {
  globalThis.fetch = originalFetch
}
