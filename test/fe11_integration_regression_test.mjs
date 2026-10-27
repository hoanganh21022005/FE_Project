import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { getMemberSubscriptions, getPublicPackages } from '../src/api/membershipApi.js'
import { mapClass } from '../src/api/mappers.js'
import { mapMemberSubscription, mapMembershipPackage } from '../src/api/membershipMappers.js'
import { isNormalClassApiCreationBlocked } from '../src/api/normalClassCreation.js'
import { hasScheduledClassSession } from '../src/api/memberPortalApi.js'
import { partitionMemberMembershipData } from '../src/utils/memberMembershipData.js'

const originalFetch = globalThis.fetch
const requests = []
globalThis.fetch = async (url, options) => {
  requests.push({ url: String(url), method: options.method })
  return new Response(JSON.stringify([
    { id: 31, name: 'Missing price', durationDays: 45, price: null, status: 'Active', packageType: 'Advanced', totalCredit: 12 },
    { id: 32, name: 'Zero price', durationDays: 30, price: 0, status: 'Active', packageType: 'Normal', totalCredit: 12 },
  ]), { status: 200, headers: { 'content-type': 'application/json' } })
}

try {
  const publicPackages = await getPublicPackages()
  assert.equal(requests.length, 1)
  assert.equal(requests[0].method, 'GET')
  assert.equal(publicPackages[0].price, null, 'Missing Backend price remains missing')
  assert.equal(publicPackages[0].durationDays, 45, 'Advanced duration comes from Backend')
  assert.equal(publicPackages[0].durationMonths, 2)
  assert.equal(publicPackages[1].price, 0, 'Explicit Backend zero remains a valid zero')
  await getMemberSubscriptions(8, { strict: true })
  assert.match(requests[1].url, /\/api\/members\/8\/subscriptions$/)

  assert.equal(mapMembershipPackage({ id: 33, name: 'No price' }).price, null)
  assert.equal(mapMembershipPackage(null).price, null)
  assert.equal(mapMemberSubscription({ id: 7, memberId: 3, packageId: 31, price: null }).price, null)
  const mappedSubscription = mapMemberSubscription({ subscriptionId: 9, packageId: 31, subjectId: 4, primaryCoachId: 12, totalCredit: 12, remainingCredit: 0, activatedAt: '2026-10-01T09:00:00+07:00', expiresAt: '2026-11-15T09:00:00+07:00' })
  assert.equal(mappedSubscription.subjectId, 4)
  assert.equal(mappedSubscription.primaryCoachId, 12)
  assert.equal(mappedSubscription.totalCredit, 12)
  assert.equal(mappedSubscription.remainingCredit, 0)
  assert.equal(mappedSubscription.activatedAt, '2026-10-01T09:00:00+07:00')
  assert.equal(mapMemberSubscription(null).price, null)
  assert.equal(mapClass({ id: 3, name: 'Class', tuitionFee: null }, { apiMode: true }).price, null)
  assert.equal(hasScheduledClassSession(3, [{ classId: 3, status: 'Scheduled', isPrivate: false }]), true)
  assert.equal(hasScheduledClassSession(3, [{ classId: 3, status: 'Cancelled' }]), false)
  assert.equal(hasScheduledClassSession(3, []), false)

  assert.equal(isNormalClassApiCreationBlocked(true, 'Draft'), true, 'FE-10 Draft remains blocked in API mode')
  assert.equal(isNormalClassApiCreationBlocked(true, 'Open'), false, 'FE-10 Open creation unlocked via normal-with-sessions')

  const paymentSource = await readFile(new URL('../src/components/modals/PaymentModal.jsx', import.meta.url), 'utf8')
  const catalogSource = await readFile(new URL('../src/components/views/MemberClassCatalog.jsx', import.meta.url), 'utf8')
  const membershipSource = await readFile(new URL('../src/components/views/MyMembershipView.jsx', import.meta.url), 'utf8')
  const memberCourseCatalogSource = await readFile(new URL('../src/components/views/MemberCourseCatalog.jsx', import.meta.url), 'utf8')
  const memberDetailSource = await readFile(new URL('../src/components/views/MemberDetailView.jsx', import.meta.url), 'utf8')
  assert.match(paymentSource, /selectedPkg\.price == null/)
  assert.match(paymentSource, /payment is unavailable/)
  assert.match(catalogSource, /const hasCoursePrice = Number\.isFinite\(totalCourseFee\)/)
  assert.match(membershipSource, /Đang sử dụng/)
  assert.match(membershipSource, /Lịch sử/)
  assert.doesNotMatch(membershipSource, /getPublicPackages|getMemberSubjectCatalog|PaymentModal|subscribePackage/)
  assert.match(membershipSource, /getMemberSubscriptions\(memberId, \{ strict: true \}\)/)
  assert.match(membershipSource, /getMemberOwnInvoices\(\{ strict: true \}\)/)
  assert.match(membershipSource, /getMemberEnrollments\(memberId, \{ strict: true \}\)/)
  const partition = partitionMemberMembershipData({ subscriptions: [{ subscriptionId: 1, status: 'Active', remainingCredit: 0, invoiceId: 11 }, { subscriptionId: 2, status: 'Pending', invoiceId: 12 }, { subscriptionId: 3, status: 'Expired' }], enrollments: [{ id: 4, status: 'Registered', invoiceId: 11 }, { id: 5, status: 'Pending' }], invoices: [{ invoiceId: 11, paymentStatus: 'successful', reconciliationRequired: false }, { invoiceId: 12, paymentStatus: 'pending' }] })
  assert.deepEqual(partition.usableSubscriptions.map((item) => item.subscriptionId), [1])
  assert.deepEqual(partition.usableEnrollments.map((item) => item.id), [4])
  assert.deepEqual(partition.pendingInvoices.map((item) => item.invoiceId), [12])
  assert.deepEqual(partition.historySubscriptions.map((item) => item.subscriptionId), [3])

  assert.match(memberCourseCatalogSource, /getMemberSubjectCatalog\(\{ strict: true \}\)/)
  assert.match(memberCourseCatalogSource, /getClassCatalogSessions\(item\.id, \{ strict: true \}\)/)
  assert.match(memberCourseCatalogSource, /verifyNormalCourseClass/)
  assert.match(memberCourseCatalogSource, /enrollCurrentMemberInClass/)
  assert.match(memberCourseCatalogSource, /requestAdvancedRegistration/)
  assert.match(memberCourseCatalogSource, /createAdvancedOrder/)
  assert.match(memberCourseCatalogSource, /normalizeCatalogStatus\(registration\.status\) !== 'accepted'/)
  assert.doesNotMatch(memberCourseCatalogSource, /bookClass|member-course-waitlist|localStorage/)
  assert.match(memberCourseCatalogSource, /paymentUrlIsSafe/)
  assert.match(memberDetailSource, /currentPkg\.price == null/)

  console.log('PASS: FE-11 mock API and view checks preserve missing values, explicit zero, and FE-10 Draft guard.')
} finally {
  globalThis.fetch = originalFetch
}
