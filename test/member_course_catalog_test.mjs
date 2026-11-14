import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { httpClient } from '../src/api/httpClient.js'
import { enrollCurrentMemberInClass } from '../src/api/classEnrollmentApi.js'
import { createAdvancedOrder, requestAdvancedRegistration } from '../src/api/advancedRegistrationApi.js'
import { coachIsActive, coachMatchesSubject, hasSellablePrice, readAdmissionCapacity, resolveCatalogSubjects, verifyNormalCourseClass } from '../src/utils/memberCourseCatalogRules.js'

const sportNames = ['Tennis', 'Swimming', 'Pickleball', 'Archery', 'Basketball', 'Football', 'Volleyball', 'Badminton', 'Table Tennis']
const subjects = sportNames.map((name, index) => ({ id: index + 19, name, slug: ['tennis', 'swimming', 'pickleball', 'archery', 'basketball', 'football', 'volleyball', 'badminton', 'table-tennis'][index], normalPrice: 1000000, advancedPrice: 3000000 }))
const resolved = resolveCatalogSubjects(subjects)
assert.equal(resolved.length, 9, 'catalog renders the nine requested sport categories')
assert.ok(resolved.every((row) => row.subject), 'unique subject slugs map without hardcoded IDs')
assert.equal(hasSellablePrice(1000000), true)
assert.equal(hasSellablePrice(0), false, 'zero is not presented as a valid selling price')
assert.equal(hasSellablePrice(null), false)
assert.equal(resolveCatalogSubjects([{ id: 1, name: 'Tennis' }, { id: 2, name: 'Tennis', slug: 'tennis' }])[0].subject.id, 2, 'exact canonical slug resolves an alias duplicate')
assert.equal(resolveCatalogSubjects([{ id: 1, name: 'Tennis', slug: 'tennis' }, { id: 2, name: 'Tennis', slug: 'tennis' }])[0].ambiguous, true, 'duplicate canonical subject records block enrollment')
assert.equal(resolveCatalogSubjects([{ id: 1, name: 'Table Tennis', slug: 'table-tennis' }]).find((row) => row.key === 'tennis').missing, true, 'Tennis does not match Table Tennis')

const sessions = Array.from({ length: 12 }, (_, index) => ({
  sessionDate: '2026-11-' + String(index + 1).padStart(2, '0'),
  startTime: '09:00',
  endTime: '10:00',
  status: 'Scheduled',
}))
const classItem = { id: 51, subjectId: 19, classType: 'Normal', status: 'Open', totalSessions: 12, maxCapacity: 10, enrolledCount: 7, tuitionFee: 1200000 }
assert.equal(verifyNormalCourseClass(classItem, sessions, 19).eligible, true)
assert.equal(verifyNormalCourseClass({ ...classItem, status: 'Closed' }, sessions, 19).eligible, false)
assert.equal(verifyNormalCourseClass({ ...classItem, enrolledCount: 10 }, sessions, 19).eligible, false)
assert.equal(verifyNormalCourseClass({ ...classItem, totalSessions: null }, sessions, 19).eligible, false)
assert.equal(verifyNormalCourseClass({ ...classItem, enrolledCount: null }, sessions, 19).eligible, false, 'missing enrollment count is not treated as zero')
assert.equal(verifyNormalCourseClass(classItem, sessions.slice(0, 11), 19).eligible, false)
assert.equal(verifyNormalCourseClass(classItem, [...sessions.slice(0, 11), sessions[0]], 19).eligible, false, 'duplicate timetable slots do not count as twelve sessions')
assert.equal(verifyNormalCourseClass(classItem, sessions, 20).eligible, false)

const specialization = { id: 9, subjectId: 19, name: 'Tennis' }
assert.equal(coachMatchesSubject({ specializationId: 9 }, specialization), true)
assert.equal(coachMatchesSubject({ specialization: 'Swimming' }, specialization), false)
assert.equal(coachIsActive({ status: 'Active' }), true)
assert.equal(coachIsActive({ status: 'Inactive' }), false)
assert.deepEqual(readAdmissionCapacity({ availableCapacity: 0 }), { verified: true, available: false, count: 0 })
assert.equal(readAdmissionCapacity({}).verified, false, 'unknown capacity shape blocks an Advanced request')
assert.equal(readAdmissionCapacity({ capacity: 8, currentMembers: null }).verified, false, 'null coach count is not treated as zero')

const originalPost = httpClient.post
const requests = []
httpClient.post = async (path, body) => { requests.push({ path, body }); return { status: 'Pending' } }
try {
  await enrollCurrentMemberInClass(51, 'VNPay')
  await requestAdvancedRegistration({ subjectId: 19, primaryCoachId: 7, requestKey: 'stable-key-001' })
  await createAdvancedOrder(21, 'Cash')
  assert.deepEqual(requests, [
    { path: '/api/classes/51/enroll', body: { paymentMethod: 'VNPay' } },
    { path: '/api/advanced-registrations', body: { subjectId: 19, primaryCoachId: 7, requestKey: 'stable-key-001' } },
    { path: '/api/advanced-registrations/21/order', body: { paymentMethod: 'Cash' } },
  ], 'Member self-service requests never send an arbitrary memberId')
  await assert.rejects(() => requestAdvancedRegistration({ subjectId: 19, primaryCoachId: 7, requestKey: 'not valid' }), /requestKey/)
} finally {
  httpClient.post = originalPost
}

const view = await readFile(new URL('../src/components/views/MemberCourseCatalog.jsx', import.meta.url), 'utf8')
assert.doesNotMatch(view, /bookClass|localStorage|member-course-waitlist/)
assert.match(view, /requestAdvancedRegistration/)
assert.match(view, /normalizeCatalogStatus\(registration\.status\) !== 'accepted'/)
assert.match(view, /getMemberOwnInvoiceById/)
assert.match(view, /item\.confirmationDeadline/)
assert.match(view, /parseVietnamDateTime/)
assert.match(view, /accepted && !hasOrder && confirmationExpired/)
assert.match(view, /disabled=\{submitting \|\| !canConfirmPurchase\}/)
assert.match(view, /Xác nhận và thanh toán/)
assert.match(view, /isConfirmationExpiredError\(error\)/)
assert.match(view, /await refreshRegistrations\(\)\.catch\(\(\) => \{\}\)/)
assert.match(view, /orderInFlightRef\.current\.has\(registrationKey\)/, 'double click is locked before another order POST')
assert.match(view, /function AdvancedInvoiceDetails/)
assert.match(view, /Math\.max\(0, expiry - now\)/, 'payment countdown uses the returned expiresAt timestamp')
assert.match(view, /invoiceApi\.getMemberOwnInvoiceById\(order\.invoiceId\)/)
assert.match(view, /expiresAt: order\.type === 'Advanced' \? invoice\?\.expiresAt \?\? null/)
assert.match(view, /expiredInvoiceChecksRef\.current\.add\(order\.key\)/)
assert.match(view, /order\.type === 'Advanced' && <AdvancedInvoiceDetails/)
assert.match(view, /if \(!latest\.invoiceId && latest\.subscriptionId\)/, 'order stays locked when the registration GET cannot identify its invoice')
assert.doesNotMatch(view, /expiresAt:\s*new Date\(Date\.now\(\)\s*\+\s*5\s*\*\s*60/)

console.log('PASS: member course catalog pricing, duplicate blocking, 12-session validation, Coach/capacity checks, self-service payloads, and no local demo enrollment.')
