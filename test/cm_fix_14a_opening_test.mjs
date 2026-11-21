import assert from 'node:assert/strict'
import { confirmNormalClassOpening } from '../src/api/managerApi.js'
import {
  canSubmitNormalClassOpening,
  evaluateNormalClassOpening,
  getFirstNormalClassSession,
  getNormalClassOpeningError,
  getOpeningReasonRequirement,
  parseVietnamSessionStart,
  validNormalClassOpeningRequest,
} from '../src/api/normalClassOpening.js'

const session = {
  id: 90,
  classId: 71,
  sessionDate: '2026-01-02',
  startTime: '10:00:00',
  status: 'Scheduled',
  coachId: 8,
  roomId: 3,
}
const classItem = {
  id: 71,
  classType: 'Normal',
  status: 'open',
  apiStatus: 'Open',
  coachId: 8,
  minCapacity: 2,
  openingConfirmedAt: null,
  changePending: false,
}
const enrollments = [
  { status: 'Registered', paymentStatus: 'Paid' },
  { status: 'Registered', paymentStatus: 'Paid' },
  { status: 'Pending', paymentStatus: 'Paid' },
  { status: 'Registered', paymentStatus: 'Pending' },
]
const authorities = ['MANAGE_CLASSES']

assert.equal(parseVietnamSessionStart(session), Date.UTC(2026, 0, 2, 3))
assert.equal(parseVietnamSessionStart({ ...session, sessionDate: '2026-02-30' }), null)
assert.equal(getFirstNormalClassSession([{ ...session, status: 'Cancelled' }, session]).session.id, 90)

const outsideReasonWindow = getOpeningReasonRequirement({
  firstSession: session,
  now: new Date('2026-01-01T02:59:00Z'),
})
assert.equal(outsideReasonWindow.reasonRequired, false)
const insideReasonWindow = getOpeningReasonRequirement({
  firstSession: session,
  now: new Date('2026-01-01T03:01:00Z'),
})
assert.equal(insideReasonWindow.reasonRequired, true)
assert.equal(getOpeningReasonRequirement({ firstSession: null }).known, false)

const regularWindow = evaluateNormalClassOpening({
  classItem, sessions: [session], enrollments, authorities,
  now: new Date('2026-01-01T02:59:00Z'),
})
assert.equal(regularWindow.paidRegisteredCount, null, 'enrollment rows do not prove Backend payment eligibility')
assert.equal(regularWindow.reasonRequired, false, '48-hour member cutoff does not gate manager confirmation')
assert.equal(regularWindow.canSubmit, true)
assert.equal(regularWindow.eligibilityStatus, 'unverified', 'Backend eligibility remains authoritative')
assert.ok(!regularWindow.blockers.some((item) => item.includes('minimum')))
assert.deepEqual(regularWindow.payload, {})

const lateWithoutReason = evaluateNormalClassOpening({
  classItem, sessions: [session], enrollments, authorities,
  now: new Date('2026-01-01T03:01:00Z'),
})
assert.equal(lateWithoutReason.reasonRequired, true)
assert.equal(lateWithoutReason.canSubmit, false)
assert.ok(lateWithoutReason.blockers.some((item) => item.includes('lý do')))

const lateWithReason = evaluateNormalClassOpening({
  classItem, sessions: [session], enrollments, authorities, reason: 'Xác nhận sát giờ',
  now: new Date('2026-01-01T03:01:00Z'),
})
assert.equal(lateWithReason.canSubmit, true)
assert.deepEqual(lateWithReason.payload, { reason: 'Xác nhận sát giờ' })

const pendingOnly = evaluateNormalClassOpening({
  classItem, sessions: [session], enrollments: enrollments.slice(2), authorities,
  now: new Date('2026-01-01T02:00:00Z'),
})
assert.equal(pendingOnly.paidRegisteredCount, null)
assert.equal(pendingOnly.canSubmit, true, 'Frontend enrollment snapshots cannot veto Backend confirmation')

const backendInsufficient = evaluateNormalClassOpening({
  classItem: { ...classItem, openingConfirmationAllowed: false, openingConfirmationBlockReason: 'NORMAL_INSUFFICIENT_PAID' },
  sessions: [session], enrollments, authorities,
})
assert.equal(backendInsufficient.canSubmit, false, 'Backend opening eligibility blocks an insufficient paid count')
assert.equal(canSubmitNormalClassOpening({ canSubmit: false, openingConfirmationAllowed: false }), false)
assert.equal(canSubmitNormalClassOpening({ canSubmit: false, openingConfirmationAllowed: true }), true, 'Backend readiness overrides incomplete local checks')
assert.equal(canSubmitNormalClassOpening({ canSubmit: false, openingConfirmationAllowed: true, reasonRequired: true }), false, 'required reason remains a FE input requirement')
assert.equal(canSubmitNormalClassOpening({ canSubmit: false, openingConfirmationAllowed: true, reasonRequired: true, reason: 'Reviewed' }), true)

const alreadyStarted = evaluateNormalClassOpening({
  classItem, sessions: [session], enrollments, authorities,
  now: new Date('2026-01-02T03:00:00Z'),
})
assert.equal(alreadyStarted.canSubmit, false)
assert.ok(alreadyStarted.blockers.some((item) => item.includes('đã bắt đầu')))

assert.equal(evaluateNormalClassOpening({ classItem: { ...classItem, classType: 'Advanced' }, sessions: [session], enrollments, authorities }).canSubmit, false)
assert.equal(evaluateNormalClassOpening({ classItem: { ...classItem, openingConfirmedAt: '2026-01-01T00:00:00Z' }, sessions: [session], enrollments, authorities }).canSubmit, false)
assert.equal(evaluateNormalClassOpening({ classItem: { ...classItem, changePending: true }, sessions: [session], enrollments, authorities }).canSubmit, false)
assert.equal(evaluateNormalClassOpening({ classItem, sessions: [session], enrollments, authorities: [] }).canSubmit, false)
assert.equal(evaluateNormalClassOpening({ classItem, sessions: null, enrollments, authorities }).eligibilityStatus, 'unverified')

const blockedKnownReason = evaluateNormalClassOpening({
  classItem: {
    ...classItem,
    openingConfirmationAllowed: false,
    openingConfirmationBlockReason: 'NORMAL_OPENING_TOO_LATE',
  },
  sessions: [session],
  enrollments,
  authorities,
  now: new Date('2026-01-01T02:59:00Z'),
})
assert.equal(blockedKnownReason.canSubmit, false)
assert.ok(blockedKnownReason.blockers.length > 0)
assert.ok(!blockedKnownReason.blockers.some((item) => item.includes('NORMAL_OPENING_TOO_LATE')))

const blockedUnknownReason = evaluateNormalClassOpening({
  classItem: {
    ...classItem,
    openingConfirmationAllowed: false,
    openingConfirmationBlockReason: 'SOME_NEW_CODE',
  },
  sessions: [session],
  enrollments,
  authorities,
  now: new Date('2026-01-01T02:59:00Z'),
})
assert.equal(blockedUnknownReason.canSubmit, false)
assert.ok(blockedUnknownReason.blockers.includes('Thao tác hiện chưa khả dụng. (SOME_NEW_CODE)'))

const blockedEmptyReason = evaluateNormalClassOpening({
  classItem: {
    ...classItem,
    openingConfirmationAllowed: false,
    openingConfirmationBlockReason: '   ',
  },
  sessions: [session],
  enrollments,
  authorities,
  now: new Date('2026-01-01T02:59:00Z'),
})
assert.equal(blockedEmptyReason.canSubmit, false)
assert.ok(blockedEmptyReason.blockers.includes('Không thể xác nhận khai giảng lớp học ở thời điểm hiện tại.'))
const missingMinimum = evaluateNormalClassOpening({ classItem: { ...classItem, minCapacity: null }, sessions: [session], enrollments, authorities, now: new Date('2026-01-01T02:00:00Z') })
assert.equal(missingMinimum.minimum, null)
assert.equal(missingMinimum.eligibilityStatus, 'unverified')
assert.deepEqual(validNormalClassOpeningRequest({ reason: '  reviewed  ' }), { reason: 'reviewed' })
assert.deepEqual(validNormalClassOpeningRequest({ reason: '' }), {})
assert.throws(() => validNormalClassOpeningRequest({ reason: 'ok', unexpected: true }), /Unsupported/)
assert.equal(getNormalClassOpeningError({ status: 409, code: 'STALE_VERSION', message: 'Conflict' }).status, 409)
assert.equal(getNormalClassOpeningError({ status: 0, message: 'Request timed out' }).uncertain, true, 'network timeout requires status reconciliation before another mutation')
assert.equal(getNormalClassOpeningError({ status: 409, code: 'CONFLICT', message: 'Conflict' }).uncertain, false)

const originalFetch = globalThis.fetch
const requests = []
let resolveFetch
try {
  globalThis.fetch = (url, options) => {
    requests.push({ url: String(url), method: options.method, body: JSON.parse(options.body) })
    return new Promise((resolve) => { resolveFetch = resolve })
  }
  const firstCall = confirmNormalClassOpening(71, { reason: '  approved  ' })
  const duplicateCall = confirmNormalClassOpening(71, { reason: 'different reason' })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(requests.length, 1, 'concurrent duplicate requests are coalesced')
  assert.equal(new URL(requests[0].url, 'http://localhost').pathname, '/api/classes/71/confirm-opening')
  assert.equal(requests[0].method, 'POST')
  assert.deepEqual(requests[0].body, { reason: 'approved' })
  const response = { id: 71, status: 'Open', openingConfirmedAt: '2026-01-01T03:30:00Z' }
  resolveFetch(new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  assert.deepEqual(await firstCall, response)
  assert.deepEqual(await duplicateCall, response)

  await assert.rejects(() => confirmNormalClassOpening(0, {}), /positive integer/)
  await assert.rejects(() => confirmNormalClassOpening(71, { reason: 'ok', extra: 1 }), /Unsupported/)

  for (const status of [400, 401, 403, 404, 409, 500]) {
    globalThis.fetch = async () => new Response(JSON.stringify({ code: `E${status}`, message: 'rejected' }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
    await assert.rejects(() => confirmNormalClassOpening(71, {}), (error) => error.status === status)
  }
} finally {
  globalThis.fetch = originalFetch
}

console.log('CM-FIX-14A Normal opening API and logic tests passed')
