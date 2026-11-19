import assert from 'node:assert/strict'

// Mock nhẹ cho httpClient (đọc lớp của Member qua fetch giả)
globalThis.window = { dispatchEvent() { return true } }
globalThis.localStorage = { getItem: () => null }
globalThis.sessionStorage = { getItem: () => null }

const {
  allowsFullClass,
  decideNormalEnroll,
  formatRegistrationDeadline,
  readEnrollmentOutcome,
  readNormalRegistration,
} = await import('../src/utils/normalRegistration.js')
const { verifyNormalCourseClass } = await import('../src/utils/memberCourseCatalogRules.js')
const { translateErrorCode } = await import('../src/api/apiErrors.js')
const { getMemberCourseClasses } = await import('../src/api/memberCourseCatalogApi.js')

// C4m.1 Field thiếu giữ null; chỉ boolean thật là true/false
assert.deepEqual(readNormalRegistration({}), { allowed: null, blockReason: null, deadline: null, serverTime: null })
assert.equal(readNormalRegistration({ registrationAllowed: false }).allowed, false)
assert.equal(readNormalRegistration({ registrationAllowed: true }).allowed, true)
assert.equal(readNormalRegistration({ registrationAllowed: 'false' }).allowed, null)
assert.equal(readNormalRegistration(undefined).allowed, null)
assert.equal(allowsFullClass({ registrationAllowed: true }), true)
assert.equal(allowsFullClass({ registrationAllowed: null }), false)
assert.equal(allowsFullClass({}), false)

// C4m.2 false khóa nút, lý do qua bảng chung, kèm hạn đăng ký (giờ Việt Nam)
let d = decideNormalEnroll(
  { registrationAllowed: false, registrationBlockReason: 'NORMAL_REGISTRATION_CLOSED', registrationDeadline: '2026-11-25T09:30:00+07:00' },
  { checkEligible: true, cutoffPassed: false, hasPrice: true },
)
assert.equal(d.canEnroll, false)
assert.equal(d.source, 'backend')
assert.equal(d.reasonText, translateErrorCode('NORMAL_REGISTRATION_CLOSED', 'vi'))
assert.match(d.deadlineText, /25\/11\/2026/)
assert.match(d.deadlineText, /09:30/)
d = decideNormalEnroll({ registrationAllowed: false, registrationBlockReason: 'NORMAL_REGISTRATION_CLOSED' }, { checkEligible: true, language: 'en' })
assert.equal(d.reasonText, translateErrorCode('NORMAL_REGISTRATION_CLOSED', 'en'))
assert.equal(d.deadlineText, '')
d = decideNormalEnroll({ registrationAllowed: false, registrationBlockReason: 'MA_LA' }, { checkEligible: true })
assert.equal(d.canEnroll, false)
assert.equal(d.reasonText, 'Lớp này hiện không nhận đăng ký.')
assert.ok(!d.reasonText.includes('MA_LA'))
assert.equal(decideNormalEnroll({ registrationAllowed: false }, { checkEligible: true, language: 'en' }).reasonText, 'This class is not accepting registrations right now.')

// C4m.3 Hạn không đọc được: không NaN lọt vào Intl
assert.equal(formatRegistrationDeadline('', 'vi'), '')
assert.equal(formatRegistrationDeadline(null, 'vi'), '')
assert.equal(formatRegistrationDeadline('không phải ngày', 'vi'), '')
assert.doesNotThrow(() => decideNormalEnroll({ registrationAllowed: false, registrationDeadline: 'rác' }, {}))
assert.equal(decideNormalEnroll({ registrationAllowed: false, registrationDeadline: 'rác' }, {}).deadlineText, '')
// Hạn không offset hiểu là giờ Việt Nam; có offset khác vẫn quy về giờ Việt Nam
assert.match(formatRegistrationDeadline('2026-11-25T09:30:00', 'vi'), /09:30/)
assert.match(formatRegistrationDeadline('2026-11-25T02:30:00Z', 'vi'), /09:30/)

// C4m.4 true mở nút kể cả lớp đầy; bỏ qua mốc 48 giờ phía trình duyệt; vẫn cần các kiểm tra khác
d = decideNormalEnroll({ registrationAllowed: true }, { checkEligible: true, cutoffPassed: true, hasPrice: true })
assert.equal(d.canEnroll, true)
assert.equal(d.source, 'backend')
assert.equal(decideNormalEnroll({ registrationAllowed: true }, { checkEligible: false, hasPrice: true }).canEnroll, false)
assert.equal(decideNormalEnroll({ registrationAllowed: true }, { checkEligible: true, hasPrice: false }).canEnroll, false)

// C4m.5 null (thiếu field hoặc không phải Member): giữ cách cũ, KHÔNG suy ra false
for (const cls of [{}, { registrationAllowed: null }, { registrationAllowed: undefined }]) {
  assert.equal(decideNormalEnroll(cls, { checkEligible: true, cutoffPassed: false, hasPrice: true }).canEnroll, true)
  assert.equal(decideNormalEnroll(cls, { checkEligible: true, cutoffPassed: false, hasPrice: true }).source, 'legacy')
  assert.equal(decideNormalEnroll(cls, { checkEligible: true, cutoffPassed: true, hasPrice: true }).canEnroll, false)
  assert.equal(decideNormalEnroll(cls, { checkEligible: false, cutoffPassed: false, hasPrice: true }).canEnroll, false)
}

// C4m.6 Lớp đầy: bị loại khi null/false, KHÔNG bị loại khi allowFull (registrationAllowed === true)
const sessions = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, sessionDate: `2027-02-${String(i + 1).padStart(2, '0')}`, startTime: '18:00', endTime: '19:30', status: 'Scheduled' }))
const fullClass = { id: 51, subjectId: 2, classType: 'Normal', status: 'Open', totalSessions: 12, maxCapacity: 10, enrolledCount: 10, tuitionFee: 800000 }
const plain = verifyNormalCourseClass(fullClass, sessions, 2)
assert.equal(plain.eligible, false)
assert.ok(plain.reasons.includes('Lớp đã đủ chỗ.'))
assert.equal(verifyNormalCourseClass(fullClass, sessions, 2, { allowFull: false }).eligible, false)
const open = verifyNormalCourseClass(fullClass, sessions, 2, { allowFull: true })
assert.equal(open.eligible, true)
assert.deepEqual(open.reasons, [])
// allowFull không nới các điều kiện khác
assert.equal(verifyNormalCourseClass({ ...fullClass, totalSessions: 8 }, sessions, 2, { allowFull: true }).eligible, false)
assert.equal(verifyNormalCourseClass({ ...fullClass, tuitionFee: 0 }, sessions, 2, { allowFull: true }).eligible, false)
assert.equal(verifyNormalCourseClass({ ...fullClass, status: 'Closed' }, sessions, 2, { allowFull: true }).eligible, false)
assert.equal(verifyNormalCourseClass({ ...fullClass, maxCapacity: null }, sessions, 2, { allowFull: true }).eligible, false)
// Lớp còn chỗ: đủ điều kiện
assert.equal(verifyNormalCourseClass({ ...fullClass, enrolledCount: 3 }, sessions, 2).eligible, true)

// C4m.7 Đọc trạng thái thật từ response: Pending / Waitlisted / Registered
let o = readEnrollmentOutcome({ status: 'Waitlisted', enrollmentId: 9 })
assert.equal(o.kind, 'waitlisted')
assert.equal(o.proceedToPayment, false)
o = readEnrollmentOutcome({ enrollmentStatus: 'waitlisted', waitlistPosition: 3 })
assert.equal(o.kind, 'waitlisted')
assert.equal(o.waitlistPosition, 3)
assert.equal(readEnrollmentOutcome({ status: 'WAITLISTED' }).proceedToPayment, false)
assert.equal(readEnrollmentOutcome({ status: 'Wait_listed' }).kind, 'waitlisted')
o = readEnrollmentOutcome({ status: 'Pending', invoiceId: 5, paymentUrl: 'https://pay.example.invalid/x' })
assert.equal(o.kind, 'pending')
assert.equal(o.proceedToPayment, true)
assert.equal(readEnrollmentOutcome({ status: 'PendingPayment' }).kind, 'pending')
assert.equal(readEnrollmentOutcome({ status: 'pending_payment' }).kind, 'pending')
assert.equal(readEnrollmentOutcome({ status: 'Registered' }).kind, 'registered')
assert.equal(readEnrollmentOutcome({ status: 'Registered' }).proceedToPayment, true)
for (const empty of [null, undefined, {}, { status: null }, { status: 5 }]) {
  const e = readEnrollmentOutcome(empty)
  assert.equal(e.kind, 'unknown')
  assert.equal(e.proceedToPayment, true, 'không nêu trạng thái: giữ hành vi cũ')
  assert.equal(e.waitlistPosition, null)
}
assert.equal(readEnrollmentOutcome({ status: 'Waitlisted', waitlistPosition: 'x' }).waitlistPosition, null)

// C4m.8 Danh sách chờ đầy và đóng đăng ký qua bảng mã lỗi chung
for (const code of ['WAITLIST_FULL', 'NORMAL_REGISTRATION_CLOSED', 'ALREADY_ENROLLED', 'WAITLIST_NOT_READY']) {
  assert.ok(translateErrorCode(code, 'vi'), `${code}: thiếu vi`)
  assert.ok(translateErrorCode(code, 'en'), `${code}: thiếu en`)
}

// C4m.9 API lớp của Member giữ field mới, thiếu giữ null (không đổi thành false)
const rows = [
  { id: 1, name: 'A', classType: 'Normal' },
  { id: 2, name: 'B', classType: 'Normal', registrationAllowed: false, registrationBlockReason: 'NORMAL_REGISTRATION_CLOSED', registrationDeadline: '2026-11-25T09:30:00+07:00', serverTime: '2026-11-26T08:00:00+07:00' },
  { id: 3, name: 'C', classType: 'Normal', registrationAllowed: true, maxCapacity: 10, enrolledCount: 10 },
]
globalThis.fetch = async () => new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } })
const [a, b, c] = await getMemberCourseClasses()
assert.equal(a.registrationAllowed, null)
assert.equal(a.registrationBlockReason, null)
assert.equal(a.registrationDeadline, null)
assert.equal(a.serverTime, null)
assert.equal(b.registrationAllowed, false)
assert.equal(b.registrationBlockReason, 'NORMAL_REGISTRATION_CLOSED')
assert.equal(b.registrationDeadline, '2026-11-25T09:30:00+07:00')
assert.equal(c.registrationAllowed, true)
assert.equal(allowsFullClass(c), true)

// C4m.10 Chi tiết lớp (GET /api/classes/{id}) là nơi duy nhất có giá trị theo Member; danh sách luôn null
const { getMemberCourseClassRegistration } = await import('../src/api/memberCourseCatalogApi.js')
const requested = []
const respondDetail = (status, body) => {
  globalThis.fetch = async (url) => {
    requested.push(String(url))
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  }
}
// thiếu field: null, không đổi thành false
respondDetail(200, { id: 51, name: 'Lớp' })
let detail = await getMemberCourseClassRegistration(51)
assert.deepEqual(detail, { registrationAllowed: null, registrationBlockReason: null, registrationDeadline: null, serverTime: null, loaded: true })
assert.ok(requested.at(-1).endsWith('/api/classes/51'))
// field danh sách là null (đúng BE thật) cũng là null
respondDetail(200, { id: 51, registrationAllowed: null, registrationBlockReason: null, registrationDeadline: null, serverTime: null })
detail = await getMemberCourseClassRegistration(51)
assert.equal(detail.registrationAllowed, null)
assert.equal(detail.loaded, true)
// false + lý do + hạn giữ đúng
respondDetail(200, { id: 51, registrationAllowed: false, registrationBlockReason: ' ALREADY_ENROLLED ', registrationDeadline: '2026-11-25T09:30:00+07:00', serverTime: '2026-11-20T08:00:00+07:00' })
detail = await getMemberCourseClassRegistration(51)
assert.equal(detail.registrationAllowed, false)
assert.equal(detail.registrationBlockReason, 'ALREADY_ENROLLED')
assert.equal(detail.registrationDeadline, '2026-11-25T09:30:00+07:00')
assert.equal(detail.serverTime, '2026-11-20T08:00:00+07:00')
// true giữ true
respondDetail(200, { id: 51, registrationAllowed: true })
assert.equal((await getMemberCourseClassRegistration(51)).registrationAllowed, true)
// Thiết kế lỗi: không bao giờ ném; 500, 403, 404, 401 và lỗi mạng đều trả 4 field null và loaded: false
for (const status of [500, 503, 403, 404, 401]) {
  respondDetail(status, { message: 'lỗi' })
  const failed = await getMemberCourseClassRegistration(51)
  assert.deepEqual(failed, { registrationAllowed: null, registrationBlockReason: null, registrationDeadline: null, serverTime: null, loaded: false }, `HTTP ${status}`)
}
globalThis.fetch = async () => { throw new Error('network down') }
assert.equal((await getMemberCourseClassRegistration(51)).loaded, false)
// Phản hồi không phải đối tượng, id không hợp lệ: null, không gọi mạng
respondDetail(200, [1, 2])
assert.equal((await getMemberCourseClassRegistration(51)).loaded, false)
requested.length = 0
respondDetail(200, {})
assert.equal((await getMemberCourseClassRegistration('abc')).loaded, false)
assert.equal((await getMemberCourseClassRegistration(null)).registrationAllowed, null)
assert.equal(requested.length, 0)

console.log('contract_c4m_normal_test.mjs: ALL PASSED')
