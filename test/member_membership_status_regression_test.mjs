import assert from 'node:assert/strict';
import { mapMember, normalizeMembershipStatus, normalizeMemberStatus } from '../src/api/memberMappers.js';

// Case A: Active account, no MemberPackage
const caseA = mapMember({
  id: 5,
  code: 'MB-1005',
  name: 'Pham Ngoc Mai',
  email: 'mai@gmail.com',
  status: 'active',
  membershipStatus: 'none',
  currentPackageId: null,
  currentPackageName: null,
});
assert.equal(caseA.accountStatus, 'active');
assert.equal(caseA.status, 'active');
assert.equal(caseA.membershipStatus, 'none');
assert.equal(caseA.currentPackageId, null);

// Case B: Active account with Active package
const caseB = mapMember({
  id: 6,
  status: 'active',
  membershipStatus: 'active',
  currentPackageId: 10,
  currentPackageName: 'Gói 3 tháng',
});
assert.equal(caseB.membershipStatus, 'active');
assert.equal(caseB.currentPackageId, 10);
assert.equal(caseB.currentPackageName, 'Gói 3 tháng');

// Case C: Expired package
const caseC = mapMember({
  id: 7,
  status: 'active',
  membershipStatus: 'Expired',
  currentPackageId: 11,
});
assert.equal(caseC.membershipStatus, 'expired');
assert.notEqual(caseC.membershipStatus, 'active');

// Case D: Cancelled / Inactive package
const caseDCancelled = mapMember({ id: 8, status: 'active', membershipStatus: 'Cancelled', currentPackageId: 12 });
const caseDInactive = mapMember({ id: 9, status: 'active', membershipStatus: 'Inactive', currentPackageId: 13 });
assert.equal(caseDCancelled.membershipStatus, 'cancelled');
assert.equal(caseDInactive.membershipStatus, 'inactive');

// Case F: Locked account with Active package
const caseF = mapMember({
  id: 10,
  status: 'Locked',
  membershipStatus: 'Active',
  currentPackageId: 14,
});
assert.equal(caseF.accountStatus, 'locked');
assert.equal(caseF.membershipStatus, 'active');

// Case G: Missing membershipStatus / missing link never defaults to 'active'
assert.equal(normalizeMembershipStatus(null), 'none');
assert.equal(normalizeMembershipStatus(undefined), 'none');
assert.equal(normalizeMembershipStatus(''), 'none');
assert.equal(normalizeMemberStatus('Locked'), 'locked');

const list = [caseA, caseB, caseC, caseDCancelled, caseDInactive, caseF];
const activePackageCount = list.filter((m) => m.membershipStatus === 'active').length;
const noPackageCount = list.filter((m) => !m.membershipStatus || m.membershipStatus === 'none' || !m.currentPackageId).length;
assert.equal(activePackageCount, 2, 'Only Case B and Case F have active membership packages');
assert.equal(noPackageCount, 1, 'Only Case A has no package');

console.log('PASS: member_membership_status_regression_test (Cases A-G)');
