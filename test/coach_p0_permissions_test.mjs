import assert from 'node:assert/strict';
import {
  canCheckIn,
  canCorrectAttendance,
  canLogResult,
  canCoachActOnPackage,
  isSessionCancelled,
  getPackageActionBlockReason,
} from '../src/utils/permissions.js';

// 1. Session status matrix
const scheduledSession = { id: 1, status: 'Scheduled' };
const completedSession = { id: 2, status: 'Completed' };
const cancelledSession = { id: 3, status: 'Cancelled' };
const centerInvalidatedSession = { id: 4, status: 'Cancelled', centerInvalidated: true };

assert.equal(canCheckIn(scheduledSession), true);
assert.equal(canCheckIn(completedSession), false);
assert.equal(canCheckIn(cancelledSession), false);

assert.equal(canCorrectAttendance(scheduledSession), false);
assert.equal(canCorrectAttendance(completedSession), true);
assert.equal(canCorrectAttendance(cancelledSession), false);

assert.equal(canLogResult(scheduledSession), false);
assert.equal(canLogResult(completedSession), true);
assert.equal(canLogResult(cancelledSession), false);

assert.equal(isSessionCancelled(cancelledSession), true);
assert.equal(isSessionCancelled(centerInvalidatedSession), true);
assert.equal(isSessionCancelled(scheduledSession), false);

// 2. Package conditions
assert.equal(canCoachActOnPackage({ status: 'Active', remainingCredit: 5 }), true);
assert.equal(canCoachActOnPackage({ status: 'Active', remainingCredit: 0 }), false);
assert.equal(canCoachActOnPackage({ status: 'Frozen', remainingCredit: 5 }), false);
assert.equal(canCoachActOnPackage({ status: 'Expired', remainingCredit: 3 }), false);
assert.equal(canCoachActOnPackage({ status: 'Cancelled', remainingCredit: 3 }), false);
assert.equal(canCoachActOnPackage({ status: 'INVOICED', remainingCredit: 8 }), false);
assert.equal(canCoachActOnPackage(null), false);

assert.equal(getPackageActionBlockReason({ status: 'Active', remainingCredit: 2 }), null);
assert.ok(getPackageActionBlockReason({ status: 'Active', remainingCredit: 0 }));
assert.ok(getPackageActionBlockReason({ status: 'Frozen', remainingCredit: 4 }));

console.log('PASS: coach_p0_permissions_test.mjs');
