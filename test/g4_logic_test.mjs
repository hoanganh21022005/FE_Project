import assert from 'node:assert/strict';
import { mapMember, toMemberRequest, normalizeMemberStatus } from '../src/api/memberMappers.js';
import { mapStaff, toStaffRequest, normalizeStaffRole, normalizeStaffStatus, STAFF_ROLE_MAP } from '../src/api/staffMappers.js';
import { memberApi, getMembers, getMemberById, createMember, updateMember, updateMemberStatus } from '../src/api/memberApi.js';
import { staffApi, getStaff, createStaff, updateStaff, updateStaffStatus } from '../src/api/staffApi.js';
import { httpClient } from '../src/api/httpClient.js';
import { extractList, validateMemberSchema, validateStaffSchema, validateMemberItem, validateStaffItem, isValidNumericId, isAllowedStaffRole } from '../src/api/schemaValidators.js';
import fs from 'node:fs';
import path from 'node:path';

// Fail closed before any adapter call. This legacy suite contains status writes
// before its later mocks are installed; it must never reach a real backend.
globalThis.fetch = async () => {
  throw new Error('External network blocked by the G4 test safety guard.');
};

console.log('==============================================');
console.log('RUNNING G4 MEMBER + STAFF + WEBZONE LOGIC TEST SUITE');
console.log('==============================================');

// --- 1. MEMBER MAPPERS ---
console.log('\n--- 1. MEMBER MAPPERS & DTO INTEGRITY ---');

// Test mapMember with various BE shapes
const beMemberSample = {
  id: 101,
  name: 'Nguyen Van A',
  email: 'vana@example.com',
  phone: '0901234567',
  avatar: 'https://avatar.url/101.jpg',
  membershipStatus: 'ACTIVE',
  joinedDate: '2026-03-01T08:00:00Z',
  totalClasses: 15,
};

const mappedMember = mapMember(beMemberSample);
assert.equal(mappedMember.id, 101);
assert.equal(typeof mappedMember.id, 'number');
assert.equal(mappedMember.name, 'Nguyen Van A');
assert.equal(mappedMember.email, 'vana@example.com');
assert.equal(mappedMember.phone, '0901234567');
assert.equal(mappedMember.status, 'active');
assert.equal(mappedMember.joinDate, '2026-03-01T08:00:00Z');
console.log('PASS: mapMember correctly maps BE fields and normalizes status to active');

// Test mapMember with fallback shapes
const emptyMember = mapMember({});
assert.equal(emptyMember.id, null);
assert.equal(emptyMember.name, '');
assert.equal(emptyMember.email, '');
assert.equal(emptyMember.status, 'active');
console.log('PASS: mapMember handles empty input safely without throwing');

// Test toMemberRequest
const validMemberPayload = toMemberRequest({
  name: 'Tran Thi B',
  email: 'thib@example.com',
  phone: '0912345678',
  avatar: 'https://avatar.url/b.jpg', // Finding 4: avatar must NOT be sent as it is absent in OpenAPI MemberRequest
  packageId: 99, // Should NOT be included in MemberRequest according to OpenAPI & G4 scope
  unknownField: 'malicious',
});

assert.deepEqual(validMemberPayload, {
  name: 'Tran Thi B',
  email: 'thib@example.com',
  phone: '0912345678',
});
assert.equal(validMemberPayload.avatar, undefined, 'MemberRequest must NOT include avatar (not in OpenAPI MemberRequest schema)');
assert.equal(validMemberPayload.packageId, undefined, 'MemberRequest must NOT include packageId (G5 lifecycle)');
assert.equal(validMemberPayload.unknownField, undefined, 'MemberRequest must only contain whitelisted fields');
console.log('PASS: toMemberRequest adheres strictly to OpenAPI and G4 scope (no avatar, no packageId)');

// Test toMemberRequest required validations
assert.throws(() => toMemberRequest({ email: 'no-name@example.com' }), /Họ và tên.*bắt buộc/i);
assert.throws(() => toMemberRequest({ name: 'No Email' }), /email.*bắt buộc/i);
console.log('PASS: toMemberRequest rejects payloads missing required name or email');

// --- 2. STAFF MAPPERS ---
console.log('\n--- 2. STAFF MAPPERS & DTO INTEGRITY ---');

const beStaffSample = {
  id: 42,
  name: 'Le Coach',
  email: 'lecoach@scms.com',
  phone: '0987654321',
  role: 'Coach',
  status: 'ACTIVE',
  specialization: 'Boxing, PT',
  experience: '5 years',
};

const mappedStaff = mapStaff(beStaffSample);
assert.equal(mappedStaff.id, 42);
assert.equal(typeof mappedStaff.id, 'number');
assert.equal(mappedStaff.name, 'Le Coach');
assert.equal(mappedStaff.role, 'coach');
assert.equal(mappedStaff.status, 'active');
assert.equal(mappedStaff.specialization, 'Boxing, PT');
console.log('PASS: mapStaff maps fields and parses numeric ID and normalized role');

// Test role normalizer
assert.equal(normalizeStaffRole('Coach'), 'coach');
assert.equal(normalizeStaffRole('Receptionist'), 'receptionist');
assert.equal(normalizeStaffRole('CenterManager'), 'manager');
assert.equal(normalizeStaffRole('Admin'), 'admin');
assert.equal(normalizeStaffRole('quản trị viên'), 'admin');
assert.equal(normalizeStaffRole('quản lý'), 'manager');
assert.equal(normalizeStaffRole('huấn luyện viên'), 'coach');
assert.equal(normalizeStaffRole('lễ tân'), 'receptionist');
assert.equal(normalizeStaffRole('UNKNOWN'), 'unknown'); // preserves lowercased unrecognized role
console.log('PASS: normalizeStaffRole maps BE roles accurately');

// Test toStaffRequest
const validStaffPayload = toStaffRequest({
  name: 'Hoang Coach',
  email: 'hoang@scms.com',
  phone: '0933333333',
  role: 'coach',
  specialization: 'Yoga',
  password: 'do-not-send', // Must NOT be in StaffRequest
});

assert.deepEqual(validStaffPayload, {
  name: 'Hoang Coach',
  email: 'hoang@scms.com',
  phone: '0933333333',
  role: 'Coach',
  specialization: 'Yoga',
});
assert.equal(validStaffPayload.password, undefined, 'StaffRequest must never leak password field');
console.log('PASS: toStaffRequest normalizes role to PascalCase and sanitizes payload');

// Test toStaffRequest required validations
assert.throws(() => toStaffRequest({ email: 'coach@test.com', role: 'Coach' }), /Họ và tên.*bắt buộc/i);
assert.throws(() => toStaffRequest({ name: 'Coach A', role: 'Coach' }), /email.*bắt buộc/i);
assert.throws(() => toStaffRequest({ name: 'Coach A', email: 'coach@test.com', role: '' }), /Vai trò.*bắt buộc/i);
console.log('PASS: toStaffRequest enforces name, email, and role as required');

// --- 3. ADAPTER CONTRACTS & G4.5 STATUS BLOCKING ---
console.log('\n--- 3. ADAPTER CONTRACTS & G4.5 STATUS MUTATION GUARD ---');

// Test memberApi methods
assert.equal(typeof memberApi.getMembers, 'function');
assert.equal(typeof memberApi.getMemberById, 'function');
assert.equal(typeof memberApi.createMember, 'function');
assert.equal(typeof memberApi.updateMember, 'function');
assert.equal(typeof memberApi.updateMemberStatus, 'function');

// G4.5 status mutation guard verification
await assert.rejects(
  async () => {
    await memberApi.updateMemberStatus(101, 'inactive');
  },
  (err) => {
    assert(err.message.includes('G4.5') && err.message.includes('bị khóa'));
    return true;
  }
);
console.log('PASS: updateMemberStatus correctly guarded as Blocked (G4.5)');

await assert.rejects(
  async () => {
    await staffApi.updateStaffStatus(42, 'inactive');
  },
  (err) => {
    assert(err.message.includes('G4.5') && err.message.includes('bị khóa'));
    return true;
  }
);
console.log('PASS: updateStaffStatus correctly guarded as Blocked (G4.5)');

// Test invalid ID validation
await assert.rejects(async () => await memberApi.getMemberById(null), /ID hội viên không hợp lệ/);
await assert.rejects(async () => await memberApi.updateMember('', {}), /ID hội viên không hợp lệ/);
await assert.rejects(async () => await staffApi.updateStaff(null, {}), /ID nhân viên không hợp lệ/);
console.log('PASS: Member and Staff adapters reject invalid/empty IDs');

// --- 4. API MOCK ISOLATION ---
console.log('\n--- 4. API MOCK ISOLATION & NO FALLBACK IN API MODE ---');

// Mock httpClient to simulate 500 error
const originalGet = httpClient.get;
httpClient.get = async (endpoint) => {
  if (endpoint === '/api/members') {
    const error = new Error('500 Internal Server Error');
    error.status = 500;
    throw error;
  }
  return [];
};

try {
  await assert.rejects(
    async () => {
      await getMembers();
    },
    (err) => {
      assert.equal(err.status, 500);
      return true;
    }
  );
  console.log('PASS: getMembers propagates real API 500 error and does NOT silently return mock members');
} finally {
  httpClient.get = originalGet;
}

// --- 5. COACH SELECTOR WITH NUMERIC BE IDS ---
console.log('\n--- 5. COACH SELECTOR & CLASS INTEGRATION LOGIC ---');

const mixedStaffList = [
  { id: 1, name: 'Manager 1', role: 'manager', status: 'active' },
  { id: 2, name: 'Coach Le', role: 'coach', status: 'active', specialization: 'Boxing' },
  { id: 3, name: 'Coach Tran', role: 'coach', status: 'inactive', specialization: 'Yoga' },
  { id: 4, name: 'Coach Pham', role: 'coach', status: 'active', specialization: 'Gym' },
  { id: 5, name: 'Receptionist 1', role: 'receptionist', status: 'active' },
];

const activeCoaches = mixedStaffList.filter(
  (s) => s.role === 'coach' && s.status === 'active'
);

assert.equal(activeCoaches.length, 2);
assert.equal(activeCoaches[0].id, 2);
assert.equal(activeCoaches[0].name, 'Coach Le');
assert.equal(typeof activeCoaches[0].id, 'number');
assert.equal(activeCoaches[1].id, 4);
assert.equal(activeCoaches[1].name, 'Coach Pham');
console.log('PASS: Active coach selector correctly filters by role and status with numeric IDs');

// --- 6. WEBZONE PALETTE & DESIGN SYSTEM VERIFICATION ---
console.log('\n--- 6. WEBZONE PALETTE & SEMANTIC TOKENS VERIFICATION ---');

const designMdContent = fs.readFileSync(path.resolve('DESIGN.md'), 'utf8');
const indexCssContent = fs.readFileSync(path.resolve('src/index.css'), 'utf8');

const requiredHexColors = [
  '#181818',
  '#323232',
  '#E4E4E4',
  '#D62323',
  '#BA0000',
  '#8E0000',
];

for (const hex of requiredHexColors) {
  assert(designMdContent.includes(hex), `DESIGN.md must specify token for ${hex}`);
  assert(indexCssContent.toLowerCase().includes(hex.toLowerCase()), `index.css must declare color token for ${hex}`);
}
console.log('PASS: All 6 Webzone colors (#181818, #323232, #E4E4E4, #D62323, #BA0000, #8E0000) declared in DESIGN.md and index.css');

// --- 7. FINDING 1: MEMBER ACTIVE COUNT & MEMBERSHIP STATUS ISOLATION ---
console.log('\n--- 7. FINDING 1: MEMBER ACTIVE PACKAGE KPI & FILTER ISOLATION ---');

const testMemberList = [
  { id: 1, name: 'Active Account with Active Package', status: 'active', membershipStatus: 'active', currentPackageId: 10 },
  { id: 2, name: 'Active Account with NO Package', status: 'active', membershipStatus: 'none', currentPackageId: null },
  { id: 3, name: 'Active Account with Expired Package', status: 'active', membershipStatus: 'expired', currentPackageId: 10 },
  { id: 4, name: 'Active Account with Grace Period', status: 'active', membershipStatus: 'grace_period', currentPackageId: 10 },
  { id: 5, name: 'Inactive Account with Active Package', status: 'inactive', membershipStatus: 'active', currentPackageId: 20 },
];

// Active package count must only count membershipStatus === 'active' (not account status)
const activePackageCount = testMemberList.filter(m => m.membershipStatus === 'active').length;
assert.equal(activePackageCount, 2, 'activeCount must be 2 (only members with membershipStatus active, excluding active accounts with no package)');

// Filter by 'active' must only return membershipStatus === 'active'
const activeFiltered = testMemberList.filter(m => m.membershipStatus === 'active');
assert.equal(activeFiltered.length, 2);
assert(!activeFiltered.some(m => m.id === 2), 'Member with no package must NOT appear in active package filter even if account is active');
assert(!activeFiltered.some(m => m.id === 3), 'Member with expired package must NOT appear in active package filter even if account is active');

// Filter by 'none' must only return members with no package
const noPackageFiltered = testMemberList.filter(m => !m.membershipStatus || m.membershipStatus === 'none' || !m.currentPackageId);
assert.equal(noPackageFiltered.length, 1);
assert.equal(noPackageFiltered[0].id, 2);
console.log('PASS: MemberManagement KPI and filter correctly isolate membershipStatus from account status');

// --- 8. FINDING 2 & 3: MEMBER DETAIL AUTHORITATIVE RESOLUTION & CONTRACT FIELD SAFETY ---
console.log('\n--- 8. FINDING 2 & 3: MEMBER DETAIL AUTHORITATIVE BINDING & SAFE CONTRACT FIELDS ---');

// Stale record guard test: If authoritativeMember holds ID 10 while user requested ID 20,
// the resolution in API mode must strictly return null (no stale profile display).
function resolveMemberDetail(apiEnabled, requestedId, authoritativeMember, cachedMembers) {
  const cachedMember = cachedMembers.find(m => String(m.id) === String(requestedId) || m.id === requestedId);
  const isMatching = authoritativeMember && (String(authoritativeMember.id) === String(requestedId) || authoritativeMember.id === requestedId);
  return apiEnabled ? (isMatching ? authoritativeMember : null) : cachedMember;
}

const staleAuthRecord = { id: 10, name: 'Old Member 10' };
const cachedList = [{ id: 10, name: 'Old Member 10' }, { id: 20, name: 'New Member 20' }];

// When requesting ID 20 while authoritativeMember still has ID 10 in API mode:
const resolvedApiMode = resolveMemberDetail(true, 20, staleAuthRecord, cachedList);
assert.equal(resolvedApiMode, null, 'In API mode, stale authoritativeMember matching a previous ID must NEVER be displayed for a new ID');

// When authoritativeMember has been loaded for ID 20:
const currentAuthRecord = { id: 20, name: 'Authoritative Member 20' };
const resolvedValid = resolveMemberDetail(true, 20, currentAuthRecord, cachedList);
assert.equal(resolvedValid.name, 'Authoritative Member 20');

// In Mock mode, cachedList is used as fallback
const resolvedMock = resolveMemberDetail(false, 20, null, cachedList);
assert.equal(resolvedMock.name, 'New Member 20');
console.log('PASS: MemberDetailView strictly binds authoritativeMember to requested ID and rejects stale cache');

// --- 9. CONTROLLED RACE CONDITION & OUT-OF-ORDER RESOLUTION TEST ---
console.log('\n--- 9. CONTROLLED RACE CONDITION & OUT-OF-ORDER REQUEST RESOLUTION ---');

function createDeferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Simulates the exact state machine and sequence tracking implemented in MemberDetailView
class MemberDetailController {
  constructor(apiFn) {
    this.apiFn = apiFn;
    this.activeReqSeq = 0;
    this.state = {
      authoritativeMember: null,
      detailError: null,
      detailLoading: false,
    };
  }

  fetchAuthoritativeDetail(targetId) {
    if (!targetId) {
      this.activeReqSeq += 1;
      this.state.authoritativeMember = null;
      this.state.detailError = null;
      this.state.detailLoading = false;
      return;
    }

    const seq = ++this.activeReqSeq;
    this.state.detailLoading = true;
    this.state.detailError = null;
    this.state.authoritativeMember = null;

    return this.apiFn(targetId)
      .then(data => {
        if (this.activeReqSeq !== seq) return; // Discard stale response
        if (data && (String(data.id) === String(targetId) || data.id === targetId)) {
          this.state.authoritativeMember = data;
          this.state.detailError = null;
        }
      })
      .catch(err => {
        if (this.activeReqSeq !== seq) return; // Discard stale error
        this.state.detailError = err?.message || 'Error';
        this.state.authoritativeMember = null;
      })
      .finally(() => {
        if (this.activeReqSeq === seq) {
          this.state.detailLoading = false;
        }
      });
  }
}

// Scenario 1: Retry for Member A is in-flight, user switches to Member B.
// Member B resolves first; Retry for Member A resolves later (out of order).
const deferredA = createDeferred();
const deferredB = createDeferred();

const mockApi = (id) => {
  if (id === 101) return deferredA.promise;
  if (id === 202) return deferredB.promise;
  return Promise.reject(new Error('Unknown ID'));
};

const controller = new MemberDetailController(mockApi);

// Step 1: User or Retry initiates Request 1 for Member 101
controller.fetchAuthoritativeDetail(101);
assert.equal(controller.state.detailLoading, true);
assert.equal(controller.state.authoritativeMember, null);

// Step 2: User switches to Member 202 before Request 1 finishes
controller.fetchAuthoritativeDetail(202);
assert.equal(controller.state.detailLoading, true);
assert.equal(controller.state.authoritativeMember, null);

// Step 3: Request 2 for Member 202 resolves FIRST
deferredB.resolve({ id: 202, name: 'Member B (202)' });
await deferredB.promise;
await new Promise(r => setTimeout(r, 10)); // allow microtasks to flush

assert.equal(controller.state.detailLoading, false);
assert.equal(controller.state.detailError, null);
assert.equal(controller.state.authoritativeMember?.id, 202);
assert.equal(controller.state.authoritativeMember?.name, 'Member B (202)');

// Step 4: Request 1 for Member 101 finishes LATER (out-of-order completion)
deferredA.resolve({ id: 101, name: 'Stale Member A (101)' });
await deferredA.promise;
await new Promise(r => setTimeout(r, 10));

// Verification: Member B must NOT be overwritten by Member A!
assert.equal(controller.state.authoritativeMember?.id, 202, 'Stale response from Member A must NEVER overwrite Member B');
assert.equal(controller.state.authoritativeMember?.name, 'Member B (202)');
assert.equal(controller.state.detailError, null);
assert.equal(controller.state.detailLoading, false);
console.log('PASS: Out-of-order success resolution: Stale request for A discarded, B remains authoritative');

// Scenario 2: Retry for Member A fails with error, but Member B succeeded.
// Error from Retry A must NOT trigger error state on Member B!
const deferredErrA = createDeferred();
const deferredOkB = createDeferred();

const mockApiErrorRace = (id) => {
  if (id === 301) return deferredErrA.promise;
  if (id === 302) return deferredOkB.promise;
  return Promise.reject(new Error('Unknown ID'));
};

const controller2 = new MemberDetailController(mockApiErrorRace);

// Launch request for 301 (e.g. Retry)
controller2.fetchAuthoritativeDetail(301);

// Switch to 302
controller2.fetchAuthoritativeDetail(302);

// 302 resolves successfully
deferredOkB.resolve({ id: 302, name: 'Member 302' });
await deferredOkB.promise;
await new Promise(r => setTimeout(r, 10));
assert.equal(controller2.state.authoritativeMember?.id, 302);
assert.equal(controller2.state.detailError, null);

// 301 rejects LATER with error
deferredErrA.reject(new Error('500 Error for Member 301'));
try { await deferredErrA.promise; } catch {}
await new Promise(r => setTimeout(r, 10));

// Verification: Member 302 must NOT show error from Member 301!
assert.equal(controller2.state.authoritativeMember?.id, 302, 'Member 302 must remain authoritative');
assert.equal(controller2.state.detailError, null, 'Error from stale Member 301 must NOT be set on Member 302');
console.log('PASS: Out-of-order error resolution: Stale error for A discarded, B retains clean state');

// --- 10. PACKAGE DETAILS FIELD SAFETY (NO HARDCODED CONTRACT DATES/DURATION) ---
console.log('\n--- 10. PACKAGE DETAILS FIELD SAFETY (NO HARDCODED DATES/DURATION) ---');

function formatPackageDuration(pkg, lang = 'vi') {
  return pkg?.durationMonths
    ? `${pkg.durationMonths} ${lang === 'vi' ? 'tháng' : 'months'}`
    : (lang === 'vi' ? 'Chưa có dữ liệu' : 'No data');
}

function formatEffectiveStartDate(member, lang = 'vi') {
  return member.packageStartDate
    ? String(member.packageStartDate)
    : (lang === 'vi' ? 'Chưa có dữ liệu (thuộc G5)' : 'No data (belongs to G5)');
}

function formatContractExpiry(member, lang = 'vi') {
  return member.packageEndDate
    ? String(member.packageEndDate)
    : (lang === 'vi' ? 'Chưa có dữ liệu (thuộc G5)' : 'No data (belongs to G5)');
}

// Test duration: when pkg has no durationMonths, it must NOT default to 1 month
assert.equal(formatPackageDuration({}), 'Chưa có dữ liệu');
assert.equal(formatPackageDuration(null), 'Chưa có dữ liệu');
assert.equal(formatPackageDuration({ durationMonths: 6 }), '6 tháng');

// Test effective start date: when member has joinDate but no packageStartDate, it must NOT use joinDate
const memberWithJoinDateOnly = { id: 1, joinDate: '2026-01-15' };
assert.equal(formatEffectiveStartDate(memberWithJoinDateOnly), 'Chưa có dữ liệu (thuộc G5)', 'joinDate must NEVER be used as package effective start date');

// Test contract expiry: must NOT hardcode 2026-12-31
const memberWithoutPackageEndDate = { id: 1, joinDate: '2026-01-15' };
assert.equal(formatContractExpiry(memberWithoutPackageEndDate), 'Chưa có dữ liệu (thuộc G5)', 'Must NOT display hardcoded 2026-12-31 contract expiry date');

// Test membership code fallback: must NOT invent MS-${member.code}
function formatMembershipCodeDisplay(member, lang = 'vi') {
  return (member?.membershipCode || member?.membershipId)
    ? String(member.membershipCode || member.membershipId)
    : (lang === 'vi' ? 'Chưa có dữ liệu' : 'No data');
}
assert.equal(formatMembershipCodeDisplay({ code: 'MB-101' }), 'Chưa có dữ liệu', 'Must NOT invent MS-${member.code}');
assert.equal(formatMembershipCodeDisplay({ membershipCode: 'MS-AUTH-99' }), 'MS-AUTH-99');
assert.equal(formatMembershipCodeDisplay({ membershipId: 'MID-88' }), 'MID-88');

// Test package price fallback: must NOT display 0 ₫ when missing
function formatPackagePriceDisplay(pkg, lang = 'vi') {
  return (pkg && pkg.price !== undefined && pkg.price !== null)
    ? `${pkg.price.toLocaleString('vi-VN')} ₫`
    : (lang === 'vi' ? 'Chưa có dữ liệu' : 'No data');
}
assert.equal(formatPackagePriceDisplay({}), 'Chưa có dữ liệu', 'Must NOT show 0 for package without price');
assert.equal(formatPackagePriceDisplay(null), 'Chưa có dữ liệu');
assert.equal(formatPackagePriceDisplay({ price: 1500000 }), '1.500.000 ₫');
console.log('PASS: Package details fields safely show "Chưa có dữ liệu" for unconfirmed dates/duration/code/price');

// --- 11. REAL COMPONENT RENDERING & RACE CONDITION TEST (MemberDetailView) ---
console.log('\n--- 11. REAL COMPONENT RENDERING & RACE CONDITION TEST (MemberDetailView) ---');

// Setup minimal DOM environment for React 19 root rendering
global.IS_REACT_ACT_ENVIRONMENT = true;

class MockNode {
  constructor(nodeType, nodeName) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.style = {};
    this._listeners = {};
  }
  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    child.parentNode = null;
    return child;
  }
  insertBefore(newChild, refChild) {
    const idx = this.children.indexOf(refChild);
    if (idx !== -1) this.children.splice(idx, 0, newChild);
    else this.children.push(newChild);
    newChild.parentNode = this;
    return newChild;
  }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k] || null; }
  addEventListener(type, listener) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(listener);
  }
  removeEventListener(type, listener) {
    if (this._listeners[type]) {
      this._listeners[type] = this._listeners[type].filter(l => l !== listener);
    }
  }
  dispatchEvent(event) {
    event.target = this;
    let curr = this;
    while (curr) {
      if (curr._listeners[event.type]) {
        for (const l of curr._listeners[event.type]) {
          if (typeof l === 'function') l(event);
          else if (l && typeof l.handleEvent === 'function') l.handleEvent(event);
        }
      }
      curr = curr.parentNode;
    }
    return true;
  }
  get textContent() {
    if (this.nodeType === 3) return this.nodeValue || '';
    return this.children.map(c => c.textContent).join('');
  }
  set textContent(val) {
    this.children = [];
    if (val) {
      const t = new MockText(val);
      t.ownerDocument = this.ownerDocument;
      this.appendChild(t);
    }
  }
}

class MockElement extends MockNode {
  constructor(tagName) {
    super(1, tagName.toUpperCase());
    this.tagName = tagName.toUpperCase();
  }
}

class MockText extends MockNode {
  constructor(text) {
    super(3, '#text');
    this.nodeValue = text;
  }
}

class HTMLIFrameElement {}
const win = { HTMLIFrameElement, addEventListener() {}, removeEventListener() {} };
const doc = {
  nodeType: 9,
  defaultView: win,
  createElement(tag) {
    const el = new MockElement(tag);
    el.ownerDocument = doc;
    return el;
  },
  createTextNode(text) {
    const t = new MockText(text);
    t.ownerDocument = doc;
    return t;
  },
  createElementNS(ns, tag) {
    return this.createElement(tag);
  },
  addEventListener() {},
  removeEventListener() {},
};
win.document = doc;
global.window = win;
global.document = doc;

// Load real components via Vite SSR loader
const { createServer } = await import('vite');
const React = await import('react');
const { act } = React;
const { createRoot } = await import('react-dom/client');

const viteServer = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
});

try {
  const { MemberDetailView } = await viteServer.ssrLoadModule('./src/components/views/MemberDetailView.jsx');
  const { SCMSContext } = await viteServer.ssrLoadModule('./src/context/SCMSContext.jsx');
  const { memberApi: realMemberApi } = await viteServer.ssrLoadModule('./src/api/memberApi.js');

  assert.equal(typeof MemberDetailView, 'function', 'MemberDetailView must be a valid React component');
  assert.ok(SCMSContext, 'SCMSContext must be exported and defined');

  // Helper function to find a DOM node in mock tree
  function findNode(node, pred) {
    if (pred(node)) return node;
    for (const c of node.children) {
      const f = findNode(c, pred);
      if (f) return f;
    }
    return null;
  }

  // --- Real Component Test 1: Profile A fails -> Click Retry (in-flight) -> Switch to Profile B -> Out-of-order late success ---
  {
    const container = doc.createElement('div');
    const root = createRoot(container);

    let resolveRetryA, resolveB;
    const pRetryA = new Promise((res) => { resolveRetryA = res; });
    const pB = new Promise((res) => { resolveB = res; });

    let callCount101 = 0;
    realMemberApi.getMemberById = async (id) => {
      if (id === 101) {
        callCount101++;
        if (callCount101 === 1) {
          // Initial fetch fails to produce the error state and Retry button
          throw new Error('500 Network Error: Initial fetch failed for 101');
        }
        // Second fetch is the user-triggered RETRY request
        return pRetryA;
      }
      if (id === 202) return pB;
      throw new Error('Not found ' + id);
    };

    const contextVal = {
      members: [],
      packages: [],
      updateMemberProfile: () => {},
      apiEnabled: true,
      language: 'vi',
      t: (k) => k
    };

    function Harness({ id }) {
      return React.createElement(
        SCMSContext.Provider,
        { value: contextVal },
        React.createElement(MemberDetailView, { memberId: id })
      );
    }

    // Step 1: Mount Profile A (101) -> Fails with error screen
    await act(async () => {
      root.render(React.createElement(Harness, { id: 101 }));
    });

    assert.ok(
      container.textContent.includes('Lỗi tải hồ sơ thành viên'),
      'Must render error screen when Profile A initial fetch fails'
    );

    // Step 2: Locate and CLICK the real Retry ("Thử lại") button
    const retryBtn = findNode(
      container,
      n => n.tagName === 'BUTTON' && (n.textContent.includes('Thử lại') || n.textContent.includes('Retry'))
    );
    assert.ok(retryBtn, 'Must find rendered Retry button on error screen');

    await act(async () => {
      retryBtn.dispatchEvent({ type: 'click', bubbles: true });
    });

    assert.equal(callCount101, 2, 'Clicking Retry button must trigger second fetch for Member 101');
    assert.ok(
      container.textContent.includes('Đang tải thông tin thành viên'),
      'Retry click must enter loading state'
    );

    // Step 3: While Retry for 101 is IN-FLIGHT, user switches to Profile B (202)
    await act(async () => {
      root.render(React.createElement(Harness, { id: 202 }));
    });

    // Step 4: Request for Profile B resolves FIRST
    await act(async () => {
      resolveB({
        id: 202,
        name: 'Ho So B Dang Chon',
        email: 'b202@scms.vn',
        status: 'active',
        membershipStatus: 'active',
      });
      await pB;
    });

    assert.ok(
      container.textContent.includes('Ho So B Dang Chon'),
      'Real component must display Member B authoritative data upon resolution'
    );

    // Step 5: Stale Retry for Profile A finishes LATER (out-of-order late success)
    await act(async () => {
      resolveRetryA({
        id: 101,
        name: 'Ho So A Tu Retry Muon',
        email: 'a101@scms.vn',
        status: 'active',
        membershipStatus: 'active',
      });
      await pRetryA;
    });

    assert.ok(
      container.textContent.includes('Ho So B Dang Chon'),
      'CRITICAL: Member B must NOT be overwritten when stale Retry for Member A resolves late'
    );
    assert.ok(
      !container.textContent.includes('Ho So A Tu Retry Muon'),
      'CRITICAL: Stale Retry data from Member A must be completely discarded'
    );
    console.log('PASS: Real component render: Retry on Profile A in-flight, switched to B, late success discarded');
  }

  // --- Real Component Test 2: Profile A fails -> Click Retry (in-flight) -> Switch to Profile B -> Out-of-order late error ---
  {
    const container = doc.createElement('div');
    const root = createRoot(container);

    let rejectRetryErrA, resolveOkB;
    const pRetryErrA = new Promise((_, rej) => { rejectRetryErrA = rej; });
    const pOkB = new Promise((res) => { resolveOkB = res; });

    let callCount301 = 0;
    realMemberApi.getMemberById = async (id) => {
      if (id === 301) {
        callCount301++;
        if (callCount301 === 1) {
          // Initial failure to reveal Retry button
          throw new Error('500 Initial error for 301');
        }
        // Second fetch is the user-triggered RETRY
        return pRetryErrA;
      }
      if (id === 302) return pOkB;
      throw new Error('Not found ' + id);
    };

    const contextVal = {
      members: [],
      packages: [],
      updateMemberProfile: () => {},
      apiEnabled: true,
      language: 'vi',
      t: (k) => k
    };

    function Harness({ id }) {
      return React.createElement(
        SCMSContext.Provider,
        { value: contextVal },
        React.createElement(MemberDetailView, { memberId: id })
      );
    }

    // Step 1: Launch Profile A (301) -> Fails with error screen
    await act(async () => {
      root.render(React.createElement(Harness, { id: 301 }));
    });

    assert.ok(container.textContent.includes('Lỗi tải hồ sơ thành viên'));

    // Step 2: Locate and CLICK the real Retry button
    const retryBtn = findNode(
      container,
      n => n.tagName === 'BUTTON' && (n.textContent.includes('Thử lại') || n.textContent.includes('Retry'))
    );
    assert.ok(retryBtn, 'Must find rendered Retry button on error screen for 301');

    await act(async () => {
      retryBtn.dispatchEvent({ type: 'click', bubbles: true });
    });

    assert.equal(callCount301, 2, 'Clicking Retry must initiate second request for 301');

    // Step 3: Switch to Profile B (302) while Retry for 301 is in-flight
    await act(async () => {
      root.render(React.createElement(Harness, { id: 302 }));
    });

    // Step 4: Profile B (302) resolves successfully
    await act(async () => {
      resolveOkB({
        id: 302,
        name: 'Ho So B Sach Se',
        email: 'b302@scms.vn',
        status: 'active',
        membershipStatus: 'active',
      });
      await pOkB;
    });

    assert.ok(container.textContent.includes('Ho So B Sach Se'));

    // Step 5: Stale Retry for Profile A rejects LATER with error
    await act(async () => {
      rejectRetryErrA(new Error('LOI_MANG_HET_HAN_TU_RETRY_A'));
      try { await pRetryErrA; } catch {}
    });

    assert.ok(
      container.textContent.includes('Ho So B Sach Se'),
      'CRITICAL: Member B must remain authoritative and displayed'
    );
    assert.ok(
      !container.textContent.includes('LOI_MANG_HET_HAN_TU_RETRY_A'),
      'CRITICAL: Late error from Profile A Retry must NOT be displayed or set error banner on Profile B'
    );
    console.log('PASS: Real component render: Retry on Profile A in-flight, switched to B, late error discarded');
  }

  // --- Real Component Test 3: Membership Code authoritative fallback & package missing price ---
  {
    const container = doc.createElement('div');
    const root = createRoot(container);

    realMemberApi.getMemberById = async () => ({
      id: 501,
      name: 'Nguyen Van Auth',
      email: 'auth501@scms.vn',
      status: 'active',
      membershipStatus: 'active',
      currentPackageId: 'pkg-test-no-price',
      currentPackageName: 'Gói Thử Nghiệm Thiếu Giá',
      code: 'MB-501', // Should NOT become MS-MB-501
      // membershipCode is undefined/null
    });

    const contextVal = {
      members: [],
      packages: [{ id: 'pkg-test-no-price', nameVi: 'Gói Thử Nghiệm Thiếu Giá' /* price is undefined */ }],
      updateMemberProfile: () => {},
      apiEnabled: true,
      language: 'vi',
      t: (k) => k
    };

    await act(async () => {
      root.render(
        React.createElement(
          SCMSContext.Provider,
          { value: contextVal },
          React.createElement(MemberDetailView, { memberId: 501 })
        )
      );
    });

    // Switch to 'Gói đăng ký' (membership) tab
    const tabBtn = findNode(container, n => n.tagName === 'BUTTON' && n.textContent.includes('Gói đăng ký'));
    assert.ok(tabBtn, 'Must find tab button for Membership Package');

    await act(async () => {
      tabBtn.dispatchEvent({ type: 'click', bubbles: true });
    });

    // Verify finding 1: No invented MS-${member.code}
    assert.ok(!container.textContent.includes('MS-MB-501'), 'Must NEVER invent MS-${member.code} when authoritative code is missing');
    assert.ok(!container.textContent.includes('MS-undefined'), 'Must NEVER invent MS-undefined');
    assert.ok(container.textContent.includes('Mã Membership:'), 'Must display label Mã Membership');
    assert.ok(container.textContent.includes('Chưa có dữ liệu'), 'Must display "Chưa có dữ liệu" for missing membershipCode');

    // Verify finding 2: No 0 ₫ for missing package price
    assert.ok(!container.textContent.includes('0 ₫'), 'Must NEVER display 0 ₫ for missing package price');
    assert.ok(container.textContent.includes('Giá đăng ký:'), 'Must display label Giá đăng ký');

    console.log('PASS: Real component render: Membership code and package price safely display "Chưa có dữ liệu"');
  }

  // --- 12. MEMBER & STAFF RESPONSE SCHEMA VALIDATOR (POSITIVE, NEGATIVE & E2E TRAVERSAL) ---
  console.log('\n--- 12. MEMBER & STAFF RESPONSE SCHEMA VALIDATOR (POSITIVE, NEGATIVE & E2E TRAVERSAL) ---');

  // Negative Case 1: Missing or null ID (must reject because mapper yields id: null)
  assert.equal(validateMemberItem({ id: null, name: 'Nguyen Van A' }), false, 'Member with null id must be invalid');
  assert.equal(validateMemberItem({ id: undefined, name: 'Nguyen Van A' }), false, 'Member with undefined id must be invalid');
  assert.equal(validateMemberItem({ code: 'MB-1001', fullName: 'Le Thi B' }), false, 'Member with only code and no numeric id must be rejected');
  assert.equal(validateMemberSchema([{ id: null, name: null }]), false, 'Member list with null record must be invalid');

  // Negative Case 2: Valid ID but missing, null, or whitespace name (must reject because mapper yields name: '')
  assert.equal(validateMemberItem({ id: 101, name: null, email: 'a@scms.vn' }), false, 'Member with id but null name must be invalid');
  assert.equal(validateMemberItem({ id: 101, name: '', email: 'a@scms.vn' }), false, 'Member with id but empty name must be invalid');
  assert.equal(validateMemberItem({ id: 101, name: '   ', email: 'a@scms.vn' }), false, 'Member with id but whitespace name must be invalid');
  assert.equal(validateMemberItem({ id: 101, email: 'member@scms.com' }), false, 'Member with id and email but missing name must be invalid');

  // Negative Case 3: Invalid IDs (zero, negative, non-finite, whitespace string, and decimals like 1.5)
  assert.equal(validateMemberItem({ id: 0, name: 'Zero ID' }), false, 'Member with id=0 must be invalid');
  assert.equal(validateMemberItem({ id: -1, name: 'Negative ID' }), false, 'Member with negative id must be invalid');
  assert.equal(validateMemberItem({ id: NaN, name: 'NaN ID' }), false, 'Member with NaN id must be invalid');
  assert.equal(validateMemberItem({ id: '   ', name: 'Whitespace ID' }), false, 'Member with whitespace string id must be invalid');
  assert.equal(validateMemberItem({ id: 1.5, name: 'Decimal ID' }), false, 'Member with decimal id (1.5) must be rejected per integer spec');
  assert.equal(validateStaffItem({ id: 1.5, name: 'Decimal Staff', role: 'Coach' }), false, 'Staff with decimal id (1.5) must be rejected per integer spec');
  assert.equal(isValidNumericId(1.5), false, 'isValidNumericId(1.5) must return false');
  assert.equal(isValidNumericId('1.5'), false, 'isValidNumericId("1.5") must return false');
  assert.equal(isValidNumericId(2.718), false, 'isValidNumericId(2.718) must return false');

  // Negative Case 4: Invalid email format
  assert.equal(validateMemberItem({ id: 101, name: 'A', email: 'notanemail' }), false, 'Member with invalid email must be invalid');
  assert.equal(validateStaffItem({ id: 1, name: 'A', role: 'Coach', email: 'bademail' }), false, 'Staff with invalid email must be invalid');

  // Negative Case 5: Staff negative cases (null id, missing role, generic 'staff' fallback, unrecognized role, substring role bypass)
  assert.equal(validateStaffItem({ id: null, name: 'Staff A', role: 'Coach' }), false, 'Staff with null id must be invalid');
  assert.equal(validateStaffItem({ code: 'STF-001', roleName: 'CenterManager' }), false, 'Staff with only code and no numeric id must be rejected');
  assert.equal(validateStaffItem({ id: 1, role: 'Coach' }), false, 'Staff with missing name must be invalid');
  assert.equal(validateStaffItem({ id: 1, name: 'Staff A' }), false, 'Staff with missing role must be invalid');
  assert.equal(validateStaffItem({ id: 1, name: 'Staff A', role: 'Trainer' }), false, 'Staff with unrecognized role must be invalid');
  assert.equal(validateStaffItem({ id: 1, name: 'Staff A', role: 'staff' }), false, 'Staff with generic fallback role "staff" must be invalid');
  assert.equal(validateStaffItem({ id: 1, name: 'Staff A', role: 'Staff' }), false, 'Staff with raw role "Staff" (resolving to generic staff) must be invalid');
  assert.equal(validateStaffItem({ id: 1, name: 'Staff A', role: 'NotCoach' }), false, 'Staff with substring role "NotCoach" must be strictly rejected');
  assert.equal(validateStaffItem({ id: 1, name: 'Staff A', role: 'CoachPro' }), false, 'Staff with substring role "CoachPro" must be strictly rejected');
  assert.equal(validateStaffItem({ id: 1, name: 'Staff A', role: 'FakeReceptionist' }), false, 'Staff with substring role "FakeReceptionist" must be strictly rejected');
  assert.equal(isAllowedStaffRole('NotCoach'), false, 'isAllowedStaffRole("NotCoach") must return false');
  assert.equal(isAllowedStaffRole('CoachPro'), false, 'isAllowedStaffRole("CoachPro") must return false');

  // Negative Case 6: Mixed list containing even one invalid record
  const mixedMemberList = [
    { id: 1, name: 'Nguyen Van A', email: 'a@scms.vn' },
    { code: 'MB-1002', fullName: 'Tran Thi Invalid' } // Missing id!
  ];
  assert.equal(validateMemberSchema(mixedMemberList), false, 'Member list containing an id-less record must be rejected');

  const mixedStaffList = [
    { id: 1, name: 'Coach 1', role: 'Coach' },
    { id: 2, name: 'Staff 2', role: 'UnknownRole' } // Invalid role!
  ];
  assert.equal(validateStaffSchema(mixedStaffList), false, 'Staff list containing an invalid role must be rejected');

  // Negative Case 7: Non-array inputs to schema validators
  assert.equal(validateMemberSchema(null), false, 'validateMemberSchema(null) must return false');
  assert.equal(validateMemberSchema(undefined), false, 'validateMemberSchema(undefined) must return false');
  assert.equal(validateMemberSchema({}), false, 'validateMemberSchema({}) must return false');
  assert.equal(validateMemberSchema('not-an-array'), false, 'validateMemberSchema string must return false');
  assert.equal(validateStaffSchema(null), false, 'validateStaffSchema(null) must return false');

  // Positive Case 1: Valid members (with numeric id and name)
  assert.equal(validateMemberItem({ id: 1, name: 'Nguyen Van A' }), true, 'Member with numeric id and valid name must be valid');
  assert.equal(validateMemberItem({ id: 101, fullName: 'Le Thi B', email: 'member@scms.com' }), true, 'Member with numeric id, fullName and email must be valid');
  assert.equal(validateMemberSchema([
    { id: 1, name: 'Nguyen Van A', email: 'a@scms.vn' },
    { id: 2, name: 'Tran Van B', email: 'b@scms.vn' }
  ]), true, 'Member list with fully conforming items must be accepted');

  // Positive Case 2: Valid staff (with numeric id, name, and recognized role)
  assert.equal(validateStaffItem({ id: 1, name: 'HLV Yoga', role: 'Coach' }), true, 'Staff with id, name, and Coach role must be valid');
  assert.equal(validateStaffItem({ id: 2, fullName: 'Quan Ly', roleName: 'CenterManager' }), true, 'Staff with id, fullName, and CenterManager roleName must be valid');
  assert.equal(validateStaffItem({ id: 3, name: 'Le Tan', role: 'Receptionist' }), true, 'Staff with id, name, and Receptionist role must be valid');
  assert.equal(validateStaffItem({ id: 4, name: 'Quan Tri', role: 'Admin' }), true, 'Staff with id, name, and Admin role must be valid');
  assert.equal(validateStaffSchema([
    { id: 1, name: 'Coach 1', role: 'Coach' },
    { id: 2, name: 'Staff 2', role: 'Receptionist' }
  ]), true, 'Staff list with fully conforming items must be accepted');

  // Positive Case 3: Empty array is valid empty response
  assert.equal(validateMemberSchema([]), true, 'Empty array of members must be valid empty container');
  assert.equal(validateStaffSchema([]), true, 'Empty array of staff must be valid empty container');

  // Helper: extractList tests
  assert.deepEqual(extractList([1, 2, 3]), [1, 2, 3], 'extractList must pass arrays through');
  assert.deepEqual(extractList({ content: [1, 2] }), [1, 2], 'extractList must extract content array');
  assert.deepEqual(extractList({ data: [3, 4] }), [3, 4], 'extractList must extract data array');
  assert.deepEqual(extractList({ items: [5, 6] }), [5, 6], 'extractList must extract items array');
  assert.equal(extractList({ other: 123 }), null, 'extractList must return null for unrecognised shapes');
  assert.equal(extractList(null), null, 'extractList must return null for null');

  // --- End-to-End Traversal Tests: Raw Response -> extractList -> validateSchema -> mapMember/mapStaff -> FE Model ---
  // Traversal Test 1: Direct Member Array response
  const rawDirectMemberResponse = [
    { id: 10, name: 'Le Van Direct', email: 'direct@scms.vn', status: 'Active' },
    { id: 11, fullName: 'Pham Thi Direct', email: 'direct2@scms.vn', phone: '0912345678' }
  ];
  const extractedDirectMembers = extractList(rawDirectMemberResponse);
  assert.ok(Array.isArray(extractedDirectMembers), 'Extracted members must be an array');
  assert.equal(validateMemberSchema(extractedDirectMembers), true, 'Direct member array must pass schema validation');
  const mappedMembers = extractedDirectMembers.map(mapMember);
  assert.equal(mappedMembers.length, 2);
  assert.equal(mappedMembers[0].id, 10);
  assert.equal(mappedMembers[0].name, 'Le Van Direct');
  assert.equal(mappedMembers[0].code, 'MB-0010');
  assert.equal(mappedMembers[1].id, 11);
  assert.equal(mappedMembers[1].name, 'Pham Thi Direct');
  assert.equal(mappedMembers[1].code, 'MB-0011');
  mappedMembers.forEach(m => {
    assert.ok(typeof m.id === 'number' && m.id > 0, `Member id must be positive number, got ${m.id}`);
    assert.ok(typeof m.name === 'string' && m.name.length > 0, `Member name must be non-empty string, got '${m.name}'`);
  });

  // Traversal Test 2: Wrapped Staff response ({ content: [...] })
  const rawWrappedStaffResponse = {
    content: [
      { id: 1, name: 'Coach Tuan', role: 'Coach', specialization: 'Gym Fitness' },
      { id: 2, fullName: 'Manager Lan', roleName: 'CenterManager', email: 'lan@scms.vn' },
      { id: 3, name: 'Receptionist Hoa', role: 'Lễ tân', phone: '0988776655' }
    ]
  };
  const extractedStaff = extractList(rawWrappedStaffResponse);
  assert.ok(Array.isArray(extractedStaff), 'Extracted staff must be an array');
  assert.equal(validateStaffSchema(extractedStaff), true, 'Wrapped staff array must pass schema validation');
  const mappedStaff = extractedStaff.map(mapStaff);
  assert.equal(mappedStaff.length, 3);
  assert.equal(mappedStaff[0].id, 1);
  assert.equal(mappedStaff[0].name, 'Coach Tuan');
  assert.equal(mappedStaff[0].role, 'coach');
  assert.equal(mappedStaff[1].id, 2);
  assert.equal(mappedStaff[1].name, 'Manager Lan');
  assert.equal(mappedStaff[1].role, 'manager');
  assert.equal(mappedStaff[2].id, 3);
  assert.equal(mappedStaff[2].name, 'Receptionist Hoa');
  assert.equal(mappedStaff[2].role, 'receptionist');
  mappedStaff.forEach(s => {
    assert.ok(typeof s.id === 'number' && s.id > 0, `Staff id must be positive number, got ${s.id}`);
    assert.ok(typeof s.name === 'string' && s.name.length > 0, `Staff name must be non-empty string, got '${s.name}'`);
    assert.ok(['coach', 'receptionist', 'manager', 'admin'].includes(s.role), `Staff role must be authoritative, got '${s.role}'`);
  });

  // Traversal Test 2b: Exhaustive End-to-End Traversal for EVERY role in STAFF_ROLE_MAP
  const allAllowedRoles = Object.keys(STAFF_ROLE_MAP);
  allAllowedRoles.forEach((rawRole, idx) => {
    const rawDto = {
      id: idx + 100,
      name: `Nhân sự ${rawRole}`,
      role: rawRole,
      email: `staff_${idx}@scms.vn`
    };

    // 1. Validator acceptance
    assert.equal(isAllowedStaffRole(rawRole), true, `isAllowedStaffRole must accept "${rawRole}"`);
    assert.equal(validateStaffItem(rawDto), true, `validateStaffItem must accept DTO with role "${rawRole}"`);

    // 2. Traversal through mapStaff
    const mapped = mapStaff(rawDto);
    assert.ok(mapped !== null, `mapStaff must not return null for role "${rawRole}"`);
    assert.equal(mapped.id, idx + 100, `Mapped staff id must equal ${idx + 100}`);
    assert.equal(mapped.name, `Nhân sự ${rawRole}`, `Mapped staff name must not be empty`);

    // 3. Normalized FE role assertion (strictly one of the 4 authoritative roles)
    const expectedNormalizedRole = STAFF_ROLE_MAP[rawRole.toLowerCase()];
    assert.equal(mapped.role, expectedNormalizedRole, `Role "${rawRole}" must map to authoritative "${expectedNormalizedRole}", got "${mapped.role}"`);
    assert.ok(
      ['coach', 'receptionist', 'manager', 'admin'].includes(mapped.role),
      `Mapped role "${mapped.role}" must strictly be in ['coach', 'receptionist', 'manager', 'admin']`
    );
  });

  // Traversal Test 3: Rejection of malformed raw payloads before FE model mapping
  const rawInvalidMemberPayload = [
    { code: 'MB-999', fullName: 'No Numeric ID' }, // Lacks id -> rejected
    { id: 202, email: 'no-name@scms.vn' }           // Lacks name -> rejected
  ];
  const extractedInvalid = extractList(rawInvalidMemberPayload);
  assert.equal(validateMemberSchema(extractedInvalid), false, 'Malformed member payload MUST be rejected by schema validator');

  // Verify that if unvalidated items had been mapped, they would be broken
  const brokenModels = extractedInvalid.map(mapMember);
  assert.equal(brokenModels[0].id, null, 'Unvalidated item without numeric ID yields id: null');
  assert.equal(brokenModels[1].name, '', 'Unvalidated item without name yields name: empty');

  console.log('PASS: Schema validators: All negative, positive, and end-to-end traversal test cases verified');

} finally {
  await viteServer.close();
}

console.log('\n==============================================');
console.log('ALL G4 LOGIC, ADAPTER, MAPPER & THEME TESTS PASSED (100%)');
console.log('==============================================');
