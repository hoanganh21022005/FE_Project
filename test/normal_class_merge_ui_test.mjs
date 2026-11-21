import assert from 'node:assert/strict'
import {
  evaluateNormalTransferTargetForUi,
  getNormalTransferRemainingSeats,
  summarizeNormalProposalChoices,
} from '../src/utils/normalClassMergeUi.js'

const source = { id: 23, centerId: 1, subjectId: 2, tuitionFee: 1000000, classType: 'Normal', apiStatus: 'Open' }
const target = { id: 3, centerId: 1, subjectId: 2, tuitionFee: 1000000, classType: 'Normal', apiStatus: 'Open', changePending: false }

assert.deepEqual(evaluateNormalTransferTargetForUi(source, target), { canSelect: true, reason: null, requiresBackendCheck: false })
assert.equal(evaluateNormalTransferTargetForUi(source, { ...target, id: source.id }).canSelect, false)
assert.equal(evaluateNormalTransferTargetForUi(source, { ...target, classType: 'Advanced' }).reason, 'not-normal')
assert.equal(evaluateNormalTransferTargetForUi(source, { ...target, apiStatus: 'Cancelled' }).reason, 'not-open')
assert.equal(evaluateNormalTransferTargetForUi(source, { ...target, changePending: true }).reason, 'change-pending')
assert.equal(evaluateNormalTransferTargetForUi(source, { ...target, centerId: 8 }).reason, 'different-center')
assert.equal(evaluateNormalTransferTargetForUi(source, { ...target, centerId: null }).requiresBackendCheck, true)
assert.equal(evaluateNormalTransferTargetForUi(source, { ...target, subjectId: 9 }).reason, 'different-subject')
assert.equal(evaluateNormalTransferTargetForUi(source, { ...target, tuitionFee: 900000 }).reason, 'different-fee')
assert.equal(evaluateNormalTransferTargetForUi(source, { ...target, centerId: null, subjectId: 9 }).reason, 'different-subject')
assert.equal(evaluateNormalTransferTargetForUi({ ...source, centerId: null }, { ...target, tuitionFee: 900000 }).reason, 'different-fee')
assert.equal(evaluateNormalTransferTargetForUi({ ...source, centerId: null }, { ...target, centerId: null }).requiresBackendCheck, true)
assert.equal(evaluateNormalTransferTargetForUi(
  { ...source, centerId: null, subjectName: 'Bắn cung' },
  { ...target, centerId: null, subjectName: 'Tennis' },
).reason, 'subject-name-mismatch')
assert.deepEqual(summarizeNormalProposalChoices({ choices: [
  { choice: 'Waiting' }, { choice: 'Accept' }, { choice: 'Refund' }, { choice: 'Accept' },
] }), { verified: true, total: 4, waiting: 1, accepted: 2, refunds: 1, unknown: 0 })
assert.equal(summarizeNormalProposalChoices({}).verified, false)
assert.equal(summarizeNormalProposalChoices({ choices: [{ choice: 'Unknown' }] }).verified, false)
assert.equal(getNormalTransferRemainingSeats({ maxCapacity: 10, enrolledCount: 6 }), 4)
assert.equal(getNormalTransferRemainingSeats({ maxCapacity: 3, enrolledCount: 4 }), 0)
assert.equal(getNormalTransferRemainingSeats({ maxCapacity: null, enrolledCount: 2 }), null)

console.log('normal_class_merge_ui_test: PASS')
