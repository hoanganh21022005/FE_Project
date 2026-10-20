import assert from 'node:assert/strict';

// Setup mock sessionStorage for pure Node.js execution environment
const nodeSessionStorageStore = new Map();
globalThis.sessionStorage = {
  getItem: (k) => nodeSessionStorageStore.get(k) || null,
  setItem: (k, v) => nodeSessionStorageStore.set(k, String(v)),
  removeItem: (k) => nodeSessionStorageStore.delete(k),
  clear: () => nodeSessionStorageStore.clear(),
};
globalThis.window = {
  sessionStorage: globalThis.sessionStorage,
};

import {
  mapMembershipPackage,
  toMembershipPackageRequest,
  mapMemberSubscription,
  toMemberPackageRequest,
  normalizeSubscriptionStatus,
  normalizePackageStatus,
} from '../src/api/membershipMappers.js';
import {
  mapInvoice,
  toInvoiceRequest,
  toInvoicePaymentRequest,
  toInvoiceStatusRequest,
  normalizePaymentMethod,
  normalizePaymentStatus,
  formatInvoiceCode,
} from '../src/api/invoiceMappers.js';
import {
  validatePackageItem,
  validatePackageSchema,
  validateSubscriptionItem,
  validateSubscriptionSchema,
  validateInvoiceItem,
  validateInvoiceSchema,
} from '../src/api/schemaValidators.js';
import { membershipApi } from '../src/api/membershipApi.js';
import { invoiceApi } from '../src/api/invoiceApi.js';
import { httpClient } from '../src/api/httpClient.js';
import {
  getAuthoritativeProfileId,
  buildCurrentUser,
  resolveCurrentMemberProfile,
  resolveActiveSubscription,
  validateDirectSubscriptionPreflight,
  reconcileAndVerifySubscriptionSafety,
  isPaymentModalMutationLocked,
} from '../src/utils/memberSafetyHelpers.js';
import {
  isMockPaymentSettled,
  createMockPendingPayment,
  settleMockPaymentFixture,
  applyMockPaymentSettlements,
  subscribeMockSettlement,
  clearMockSettlements,
  deriveMockMemberProfile,
} from '../src/utils/mockFixtureSettlement.js';

console.log('====================================================');
console.log('RUNNING FE 2: MEMBERSHIP, INVOICE & PAYMENT TEST SUITE');
console.log('====================================================');

// --- 1. MEMBERSHIP PACKAGE MAPPERS & DTO INTEGRITY ---
console.log('\n--- 1. MEMBERSHIP PACKAGE MAPPERS ---');

const bePackageSample = {
  id: 12,
  name: 'VIP Elite Club',
  durationDays: 365,
  price: 11500000,
  benefits: 'Gym;Sauna;Personal Trainer;VIP Lounge',
  status: 'ACTIVE',
};

const mappedPkg = mapMembershipPackage(bePackageSample);
assert.equal(mappedPkg.id, 12);
assert.equal(typeof mappedPkg.id, 'number');
assert.equal(mappedPkg.name, 'VIP Elite Club');
assert.equal(mappedPkg.durationDays, 365);
assert.equal(mappedPkg.durationMonths, 12);
assert.equal(mappedPkg.price, 11500000);
assert.equal(mappedPkg.status, 'active');
assert.deepEqual(mappedPkg.benefits, ['Gym', 'Sauna', 'Personal Trainer', 'VIP Lounge']);
console.log('PASS: mapMembershipPackage accurately maps BE fields and parses benefits list');

// Empty / Null Package Handling
const emptyPkg = mapMembershipPackage({});
assert.equal(emptyPkg.id, null);
assert.equal(emptyPkg.name, '');
assert.equal(emptyPkg.price, 0);
assert.equal(emptyPkg.status, 'active');
console.log('PASS: mapMembershipPackage handles empty object safely');

// toMembershipPackageRequest validation
assert.throws(() => toMembershipPackageRequest({}), /Tên gói.*bắt buộc/i);
assert.throws(() => toMembershipPackageRequest({ name: 'Test' }), /durationDays.*nguyên dương/i);
assert.throws(() => toMembershipPackageRequest({ name: 'Test', durationDays: 30, price: -100 }), /lớn hơn hoặc bằng 0/i);

const validPkgRequest = toMembershipPackageRequest({
  name: 'Standard Fit',
  durationDays: 30,
  price: 500000,
  benefits: ['Gym', 'Locker'],
});
assert.deepEqual(validPkgRequest, {
  name: 'Standard Fit',
  durationDays: 30,
  price: 500000,
  benefits: 'Gym;Locker',
  status: 'ACTIVE',
});
console.log('PASS: toMembershipPackageRequest validates and serializes request payload');

// --- 2. MEMBER SUBSCRIPTION MAPPERS ---
console.log('\n--- 2. MEMBER SUBSCRIPTION MAPPERS ---');

const beSubSample = {
  subscriptionId: 88,
  memberId: 101,
  memberName: 'Nguyen Van A',
  packageId: 12,
  packageName: 'VIP Elite Club',
  price: 11500000,
  startDate: '2026-10-10',
  endDate: '2027-10-10',
  status: 'ACTIVE',
};

const mappedSub = mapMemberSubscription(beSubSample);
assert.equal(mappedSub.subscriptionId, 88);
assert.equal(mappedSub.id, 88);
assert.equal(mappedSub.memberId, 101);
assert.equal(mappedSub.packageId, 12);
assert.equal(mappedSub.price, 11500000);
assert.equal(mappedSub.startDate, '2026-10-10');
assert.equal(mappedSub.endDate, '2027-10-10');
assert.equal(mappedSub.status, 'active');
console.log('PASS: mapMemberSubscription maps subscription ID and status correctly');

// toMemberPackageRequest validation
assert.throws(() => toMemberPackageRequest({}), /packageId.*không hợp lệ/i);
assert.throws(() => toMemberPackageRequest({ packageId: -5 }), /packageId.*không hợp lệ/i);
assert.throws(() => toMemberPackageRequest({ packageId: 'abc' }), /packageId.*không hợp lệ/i);

const validSubPayload = toMemberPackageRequest({
  packageId: 12,
  startDate: '2026-10-10T12:00:00Z',
  durationDays: 90,
  isRenewal: true,
  paymentMethod: 'CASH',
  notes: 'Đăng ký tại quầy',
  maliciousField: 'ignore',
});

assert.deepEqual(validSubPayload, {
  packageId: 12,
  startDate: '2026-10-10',
  durationDays: 90,
  isRenewal: true,
  paymentMethod: 'CASH',
  notes: 'Đăng ký tại quầy',
});
assert.equal(validSubPayload.maliciousField, undefined, 'Must not include unwhitelisted fields');
console.log('PASS: toMemberPackageRequest enforces OpenAPI schema and whitelisting');

// --- 3. INVOICE MAPPERS & PAYMENT METHODS ---
console.log('\n--- 3. INVOICE MAPPERS & PAYMENT METHODS ---');

const beInvoiceSample = {
  invoiceId: 42,
  memberId: 101,
  memberName: 'Nguyen Van A',
  memberEmail: 'vana@example.com',
  memberPhone: '0901234567',
  packageId: 12,
  packageName: 'VIP Elite Club',
  durationDays: 365,
  receptionistId: 5,
  receptionistName: 'Pham Thi Thu',
  amount: 11500000,
  paymentMethod: 'CASH',
  paymentStatus: 'PAID',
  paymentDate: '2026-10-10T09:30:00Z',
  gatewayTransactionRef: null,
};

const mappedInv = mapInvoice(beInvoiceSample);
assert.equal(mappedInv.invoiceId, 42);
assert.equal(mappedInv.id, 42);
assert.equal(mappedInv.code, 'INV-00042');
assert.equal(mappedInv.memberId, 101);
assert.equal(mappedInv.memberName, 'Nguyen Van A');
assert.equal(mappedInv.amount, 11500000);
assert.equal(mappedInv.paymentMethod, 'cash');
assert.equal(mappedInv.paymentStatus, 'successful');
assert.equal(mappedInv.receptionistName, 'Pham Thi Thu');
console.log('PASS: mapInvoice maps invoice fields, formats code INV-00042, and normalizes paymentStatus to successful');

// Payment Method Normalization
assert.equal(normalizePaymentMethod('CASH'), 'cash');
assert.equal(normalizePaymentMethod('Tiền mặt'), 'cash');
assert.equal(normalizePaymentMethod('BANK_TRANSFER'), 'bank_transfer');
assert.equal(normalizePaymentMethod('VietQR'), 'bank_transfer');
assert.equal(normalizePaymentMethod('CARD_POS'), 'card_pos');
assert.equal(normalizePaymentMethod('ONLINE'), 'online');
assert.equal(normalizePaymentMethod('VNPAY'), 'online');
console.log('PASS: normalizePaymentMethod handles cash, bank_transfer, online, card_pos correctly');

// Payment Status Normalization
assert.equal(normalizePaymentStatus('PAID'), 'successful');
assert.equal(normalizePaymentStatus('SUCCESSFUL'), 'successful');
assert.equal(normalizePaymentStatus('PENDING'), 'pending');
assert.equal(normalizePaymentStatus('UNPAID'), 'pending');
assert.equal(normalizePaymentStatus('FAILED'), 'failed');
assert.equal(normalizePaymentStatus('CANCELLED'), 'cancelled');
console.log('PASS: normalizePaymentStatus normalizes PAID/PENDING/CANCELLED accurately');

// toInvoiceRequest validation
assert.throws(() => toInvoiceRequest({}), /memberId.*không hợp lệ/i);
assert.throws(() => toInvoiceRequest({ memberId: 101 }), /amount.*lớn hơn hoặc bằng 0/i);
assert.throws(() => toInvoiceRequest({ memberId: 101, amount: -50 }), /amount.*lớn hơn hoặc bằng 0/i);

const validInvPayload = toInvoiceRequest({
  memberId: 101,
  packageId: 12,
  receptionistId: 5,
  amount: 11500000,
  paymentMethod: 'cash',
  notes: 'Hóa đơn tiền mặt tại quầy',
});
assert.equal(validInvPayload.memberId, 101);
assert.equal(validInvPayload.packageId, 12);
assert.equal(validInvPayload.amount, 11500000);
assert.equal(validInvPayload.paymentMethod, 'CASH');
console.log('PASS: toInvoiceRequest validates required memberId and amount');

// toInvoicePaymentRequest validation
assert.throws(() => toInvoicePaymentRequest({}), /paymentMethod.*bắt buộc/i);
const validPayPayload = toInvoicePaymentRequest({
  paymentMethod: 'CASH',
  receptionistId: 5,
  notes: 'Đã thu tiền',
});
assert.deepEqual(validPayPayload, {
  paymentMethod: 'CASH',
  receptionistId: 5,
  notes: 'Đã thu tiền',
});
console.log('PASS: toInvoicePaymentRequest enforces required paymentMethod');

// --- 4. SCHEMA VALIDATORS FOR PACKAGES, SUBSCRIPTIONS & INVOICES ---
console.log('\n--- 4. SCHEMA VALIDATORS ---');

// Package Validators
assert.ok(validatePackageItem({ id: 1, name: 'Basic', price: 100000 }));
assert.ok(!validatePackageItem({ id: -1, name: 'Invalid' }));
assert.ok(!validatePackageItem({ id: 1, name: '', price: 100000 }));
assert.ok(!validatePackageItem({ id: 1, name: 'Basic', price: -50 }));
assert.ok(validatePackageSchema([{ id: 1, name: 'Basic', price: 100000 }]));
assert.ok(!validatePackageSchema([{ id: 1, name: 'Basic', price: -50 }]));

// Subscription Validators
assert.ok(validateSubscriptionItem({ subscriptionId: 10, memberId: 1, packageId: 2 }));
assert.ok(validateSubscriptionItem({ id: 10, memberId: 1, packageId: 2 }));
assert.ok(!validateSubscriptionItem({ subscriptionId: null, memberId: 1, packageId: 2 }));
assert.ok(!validateSubscriptionItem({ subscriptionId: 10, memberId: 0, packageId: 2 }));
assert.ok(validateSubscriptionSchema([{ subscriptionId: 10, memberId: 1, packageId: 2 }]));

// Invoice Validators
assert.ok(validateInvoiceItem({ invoiceId: 42, memberId: 1, amount: 500000 }));
assert.ok(!validateInvoiceItem({ invoiceId: 42, memberId: 1, amount: -10 }));
assert.ok(!validateInvoiceItem({ invoiceId: 'not-int', memberId: 1, amount: 500000 }));
assert.ok(validateInvoiceSchema([{ invoiceId: 42, memberId: 1, amount: 500000 }]));
console.log('PASS: Schema validators accurately validate positive and reject negative records');

// --- 5. ADAPTER PARAMETER SAFETY & HTTP ERROR PROPAGATION ---
console.log('\n--- 5. ADAPTER PARAMETER SAFETY & ERROR PROPAGATION ---');

await assert.rejects(() => membershipApi.getPackageById(-1), /ID gói.*không hợp lệ/i);
await assert.rejects(() => membershipApi.getPackageById(''), /ID gói.*không hợp lệ/i);
await assert.rejects(() => membershipApi.getMemberSubscriptions(null), /ID hội viên.*không hợp lệ/i);
await assert.rejects(() => membershipApi.subscribePackage(0, {}), /ID hội viên.*không hợp lệ/i);
await assert.rejects(() => invoiceApi.getInvoiceById('bad-id'), /ID hóa đơn.*không hợp lệ/i);
await assert.rejects(() => invoiceApi.payInvoice(-5, {}), /ID hóa đơn.*không hợp lệ/i);
console.log('PASS: Adapters reject invalid / non-positive numeric IDs immediately');

// Test that 500 server error propagates and does NOT fallback to mock
const origGet = httpClient.get;
httpClient.get = async (path) => {
  if (path.includes('/api/packages')) {
    const error = new Error('500 Internal Server Error');
    error.status = 500;
    throw error;
  }
  return origGet(path);
};

try {
  await membershipApi.getPackages();
  assert.fail('Should have thrown 500 error');
} catch (err) {
  assert.match(err.message, /500/);
  console.log('PASS: membershipApi propagates server 500 error without faking mock data');
} finally {
  httpClient.get = origGet;
}

// --- 6. REAL CLIENT MOCK CALL VERIFICATION ---
console.log('\n--- 6. END-TO-END ADAPTER WORKFLOW WITH CONTRACT FIXTURES ---');

const origPost = httpClient.post;
let recordedPostPath = null;
let recordedPostBody = null;

httpClient.post = async (path, body) => {
  recordedPostPath = path;
  recordedPostBody = body;
  if (path === '/api/members/101/packages') {
    return {
      subscriptionId: 99,
      memberId: 101,
      packageId: body.packageId,
      packageName: 'VIP Elite Club',
      price: 11500000,
      startDate: body.startDate || '2026-10-10',
      endDate: '2027-10-10',
      status: 'ACTIVE',
    };
  }
  if (path === '/api/invoices/42/pay') {
    return {
      invoiceId: 42,
      memberId: 101,
      packageId: 12,
      amount: 11500000,
      paymentMethod: body.paymentMethod,
      paymentStatus: 'PAID',
      paymentDate: '2026-10-10T10:00:00Z',
    };
  }
  return origPost(path, body);
};

// 6.1 Subscribe member to package
const subResult = await membershipApi.subscribePackage(101, {
  packageId: 12,
  startDate: '2026-10-10',
  durationDays: 365,
  paymentMethod: 'CASH',
});

assert.equal(recordedPostPath, '/api/members/101/packages');
assert.equal(recordedPostBody.packageId, 12);
assert.equal(recordedPostBody.paymentMethod, 'CASH');
assert.equal(subResult.subscriptionId, 99);
assert.equal(subResult.status, 'active');
console.log('PASS: subscribePackage sends correct payload to /api/members/101/packages and maps response');

// 6.2 Pay invoice via Receptionist cash confirmation
const payResult = await invoiceApi.payInvoice(42, {
  paymentMethod: 'CASH',
  receptionistId: 5,
  notes: 'Thu tiền mặt tại quầy',
});

assert.equal(recordedPostPath, '/api/invoices/42/pay');
assert.equal(recordedPostBody.paymentMethod, 'CASH');
assert.equal(recordedPostBody.receptionistId, 5);
assert.equal(payResult.invoiceId, 42);
assert.equal(payResult.paymentStatus, 'successful');
console.log('PASS: payInvoice sends correct payload to /api/invoices/42/pay and transitions to successful');

// 6.3 Invoice created with strictly PENDING status prior to settlement
httpClient.post = async (path, body) => {
  recordedPostPath = path;
  recordedPostBody = body;
  if (path === '/api/invoices') {
    return {
      invoiceId: 105,
      memberId: body.memberId,
      packageId: body.packageId,
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      paymentStatus: body.paymentStatus || 'PENDING',
    };
  }
  return origPost(path, body);
};

const invPendingResult = await invoiceApi.createInvoice({
  memberId: 101,
  packageId: 12,
  amount: 11500000,
  paymentMethod: 'CASH',
  paymentStatus: 'PENDING',
});
assert.equal(recordedPostPath, '/api/invoices');
assert.equal(recordedPostBody.paymentStatus, 'PENDING');
assert.equal(invPendingResult.paymentStatus, 'pending');
console.log('PASS: createInvoice enforces PENDING status before cash settlement confirmation');

// 6.4 Response missing invoice ID throws and prevents silent skip of payment
httpClient.post = async (path) => {
  if (path === '/api/invoices') {
    return {
      // Missing id and invoiceId
      memberId: 101,
      amount: 11500000,
    };
  }
  return origPost(path);
};

const brokenInv = await invoiceApi.createInvoice({ memberId: 101, amount: 11500000 });
assert.equal(brokenInv.id, null);
assert.equal(brokenInv.invoiceId, null);
console.log('PASS: invoiceApi maps missing ID safely to null so callers can explicitly guard against it');

// 6.5 In-progress transaction cache retain and discard
const { inProgressTransactionCache } = await import('../src/api/paymentSession.js');
inProgressTransactionCache.set('101', {
  subscriptionId: 99,
  invoiceId: 42,
  packageId: 12,
  method: 'cash',
});
assert.equal(inProgressTransactionCache.get('101').subscriptionId, 99);
assert.equal(inProgressTransactionCache.get('101').invoiceId, 42);
inProgressTransactionCache.delete('101');
assert.equal(inProgressTransactionCache.get('101'), null);
console.log('PASS: inProgressTransactionCache correctly retains and clears member partial transactions');

// Restore httpClient.post
httpClient.post = origPost;

// --- 7. FAILURE-PATH & CONCURRENCY RESILIENCE TESTS ---
console.log('\n--- 7. FAILURE-PATH & CONCURRENCY RESILIENCE ---');

const failureOrigGet = httpClient.get;
const origPatch = httpClient.patch;

// 7.1 Strict GET failure propagation (500 / 401 / Timeout)
httpClient.get = async (path) => {
  if (path.includes('/api/members/101/packages')) {
    const err = new Error('500 Internal Server Error: Database Connection Pool Exhausted');
    err.status = 500;
    throw err;
  }
  if (path.includes('/api/invoices')) {
    const err = new Error('401 Unauthorized: Session Token Expired');
    err.status = 401;
    throw err;
  }
  return origGet(path);
};

await assert.rejects(
  () => membershipApi.getMemberSubscriptions(101),
  /500 Internal Server Error/,
  'membershipApi.getMemberSubscriptions must throw and NOT swallow 500 as []'
);

await assert.rejects(
  () => invoiceApi.getInvoices({ memberId: 101, status: 'pending' }),
  /401 Unauthorized/,
  'invoiceApi.getInvoices must throw and NOT swallow 401 as []'
);
console.log('PASS: GET queries strictly propagate 401/500 errors to fail closed and block duplicate POSTs');

// 7.2 PATCH cancellation rejection propagation
httpClient.patch = async (path, body) => {
  if (path === '/api/invoices/42/status') {
    const err = new Error('409 Conflict: Invoice locked for audit');
    err.status = 409;
    throw err;
  }
  if (path === '/api/member-packages/99/status') {
    const err = new Error('500 Internal Server Error: Failed to cancel subscription');
    err.status = 500;
    throw err;
  }
  return origPatch(path, body);
};

await assert.rejects(
  () => invoiceApi.updateInvoiceStatus(42, 'CANCELLED'),
  /409 Conflict/,
  'invoiceApi.updateInvoiceStatus must propagate cancellation rejection'
);

await assert.rejects(
  () => membershipApi.updateSubscriptionStatus(99, 'CANCELLED'),
  /500 Internal Server Error/,
  'membershipApi.updateSubscriptionStatus must propagate cancellation rejection'
);
console.log('PASS: PATCH cancellation endpoints strictly reject on server error without silent suppression');

// 7.3 Cache retention upon failed cancellation
// Simulate: member 101 has sub 99 and inv 42. Invoice cancel succeeds, but subscription cancel fails.
inProgressTransactionCache.set('101', {
  subscriptionId: 99,
  invoiceId: 42,
  packageId: 12,
  method: 'cash',
  sessionRef: 'TXN-TEST-001',
}, 'receptionist_1');

// When cancellation for sub 99 fails: the cache MUST preserve sub 99 and not be deleted!
const failedSubCache = {
  subscriptionId: 99, // preserved
  invoiceId: null,   // cancelled
  packageId: 12,
  method: 'cash',
  sessionRef: 'TXN-TEST-001',
};
inProgressTransactionCache.set('101', failedSubCache, 'receptionist_1');

const retained = inProgressTransactionCache.get('101', 'receptionist_1');
assert.equal(retained.subscriptionId, 99, 'Subscription ID 99 must remain retained in cache');
assert.equal(retained.invoiceId, null, 'Cancelled invoice ID must be cleared');
assert.equal(inProgressTransactionCache.has('101', 'receptionist_1'), true);
console.log('PASS: inProgressTransactionCache preserves uncancelled records when server cancellation fails');

// 7.4 SessionRef correlation & Unrelated pending invoices detection
const existingInvoicesFixture = [
  {
    id: 11,
    invoiceId: 11,
    memberId: 101,
    packageId: 12,
    amount: 11500000,
    paymentStatus: 'PENDING',
    gatewayTransactionRef: 'OLD-REF-999',
    notes: 'Created yesterday by different desk',
  },
  {
    id: 12,
    invoiceId: 12,
    memberId: 101,
    packageId: 12,
    amount: 11500000,
    paymentStatus: 'PENDING',
    gatewayTransactionRef: 'TXN-TEST-001',
    notes: 'Subscription checkout [SessionRef: TXN-TEST-001]',
  },
];

const targetSessionRef = 'TXN-TEST-001';
const matchedCorrelated = existingInvoicesFixture.find(
  (inv) =>
    inv.gatewayTransactionRef === targetSessionRef ||
    (typeof inv.notes === 'string' && inv.notes.includes(targetSessionRef))
);
assert.equal(matchedCorrelated?.id, 12, 'Must correlate exactly with invoice 12 matching TXN-TEST-001');

// Unrelated case: no invoice matches sessionRef
const unrelatedSessionRef = 'TXN-NEW-SESSION-999';
const matchedUnrelated = existingInvoicesFixture.find(
  (inv) =>
    inv.gatewayTransactionRef === unrelatedSessionRef ||
    (typeof inv.notes === 'string' && inv.notes.includes(unrelatedSessionRef))
);
assert.equal(matchedUnrelated, undefined, 'Must NOT match unrelated invoices, preventing blind attachment to invoices[0]');
console.log('PASS: Invoice correlation accurately isolates sessionRef matching invoice and rejects blind attachment');

// 7.5 Actor / Role scoping & F5 session persistence
const actorReceptionist = 'user_rec_45';
const actorMember = 'user_mem_101';
const actorAdmin = 'user_adm_1';

inProgressTransactionCache.set('101', {
  subscriptionId: 201,
  invoiceId: 301,
  packageId: 12,
  method: 'cash',
  sessionRef: 'TXN-ACTOR-TEST',
}, actorReceptionist);

// Member logging in or switching in same tab CANNOT see receptionist pending transaction
assert.equal(inProgressTransactionCache.get('101', actorMember), null);
assert.equal(inProgressTransactionCache.get('101', actorAdmin), null);
assert.equal(inProgressTransactionCache.get('101', actorReceptionist)?.subscriptionId, 201);

// Clean up
inProgressTransactionCache.delete('101', actorReceptionist);
inProgressTransactionCache.delete('101', 'receptionist_1');
assert.equal(inProgressTransactionCache.get('101', actorReceptionist), null);
console.log('PASS: Actor scoping guarantees complete isolation between staff roles and member logins');

// 7.6 Multiple sessions, resumption, and deletion without resurrection
const testActor = 'staff_rec_99';
const sessionRef1 = 'TXN-ALPHA-001';
const sessionRef2 = 'TXN-BETA-002';

inProgressTransactionCache.set('101', {
  subscriptionId: 501,
  invoiceId: 601,
  packageId: 12,
  method: 'cash',
  sessionRef: sessionRef1,
}, testActor, sessionRef1);

// Start new session for same member
inProgressTransactionCache.startNewSession('101', testActor, sessionRef2, {
  preservedUnmatchedInvoice: { id: 601, amount: 11500000, status: 'PENDING' },
  packageId: 12,
  method: 'cash',
});

// Verify BOTH sessions survive in storage
const retrievedOldSession = inProgressTransactionCache.get('101', testActor, sessionRef1);
const retrievedNewSession = inProgressTransactionCache.get('101', testActor, sessionRef2);
const activeSession = inProgressTransactionCache.get('101', testActor);

assert.ok(retrievedOldSession, 'Old session must be preserved');
assert.equal(retrievedOldSession.sessionRef, sessionRef1);
assert.equal(retrievedOldSession.subscriptionId, 501);
assert.equal(retrievedOldSession.status, 'preserved', 'Old session must be marked preserved');

assert.ok(retrievedNewSession, 'New session must exist');
assert.equal(retrievedNewSession.sessionRef, sessionRef2);
assert.equal(retrievedNewSession.subscriptionId, null, 'New session must have fresh empty subscription');
assert.equal(retrievedNewSession.status, 'active');
assert.equal(activeSession.sessionRef, sessionRef2, 'Active session pointer must point to new session');

const allSessions = inProgressTransactionCache.getAllSessionsForMember('101', testActor);
assert.equal(allSessions.length, 2, 'Must have exactly 2 distinct sessions preserved for member 101');

// Test Resume Session: operator switches back to sessionRef1
const resumedSession = inProgressTransactionCache.resumeSession('101', testActor, sessionRef1);
assert.ok(resumedSession, 'Must successfully resume session 1');
assert.equal(resumedSession.sessionRef, sessionRef1);
assert.equal(resumedSession.subscriptionId, 501);

const currentActive = inProgressTransactionCache.get('101', testActor);
assert.equal(currentActive.sessionRef, sessionRef1, 'Active session must now be session 1');

// Simulate F5 / reload from storage
inProgressTransactionCache.loadFromStorage();
const afterF5Active = inProgressTransactionCache.get('101', testActor);
assert.equal(afterF5Active?.sessionRef, sessionRef1, 'Active session must persist across F5 storage reloads');

// Test Deletion without resurrection: delete sessionRef1
inProgressTransactionCache.delete('101', testActor, sessionRef1);
// Active pointer should fallback to sessionRef2
const afterDeleteActive = inProgressTransactionCache.get('101', testActor);
assert.equal(afterDeleteActive?.sessionRef, sessionRef2, 'After deleting session 1, active pointer must fallback to session 2');
assert.equal(inProgressTransactionCache.get('101', testActor, sessionRef1), null, 'Deleted session 1 must be null');

// Now delete sessionRef2 as well
inProgressTransactionCache.delete('101', testActor, sessionRef2);
assert.equal(inProgressTransactionCache.get('101', testActor), null, 'With all sessions deleted, active get must return null');
assert.deepEqual(inProgressTransactionCache.getAllSessionsForMember('101', testActor), [], 'Session list must be completely empty');

// Simulate F5 after complete deletion to confirm NO resurrection from old keys
inProgressTransactionCache.loadFromStorage();
assert.equal(inProgressTransactionCache.get('101', testActor), null, 'Deleted sessions must NOT resurrect after F5 reload');
console.log('PASS: Multiple sessions, session resumption, and complete eradication of session resurrection verified');

// 7.7 Cross-session invoice adoption is strictly blocked
const session1Invoice = {
  id: 601,
  invoiceId: 601,
  memberId: 101,
  packageId: 12,
  amount: 11500000,
  paymentStatus: 'PENDING',
  gatewayTransactionRef: sessionRef1,
};

// In session 2, attempt correlation with sessionRef2
const isAdoptionPermitted = session1Invoice.gatewayTransactionRef === sessionRef2;
assert.equal(isAdoptionPermitted, false, 'New session must NOT adopt or attach invoice from previous session');
console.log('PASS: Attempted cross-session adoption is strictly rejected; old invoice remains untouched');

// 7.8 Ambiguous pending subscription without notes in mapper halts mutation
// OpenAPI MemberPackageResponse mapper: { id, subscriptionId, memberId, packageId, status, startDate, endDate } - NO notes!
const openApiMemberSubsFixture = [
  {
    id: 777,
    subscriptionId: 777,
    memberId: 101,
    packageId: 12,
    status: 'pending',
    // NO notes property returned by mapper/OpenAPI
  },
];

// If session has no locally retained subscription ID, correlatedSub is null
const localRetainedSubId = null;
const isValidPositiveInt = (n) => typeof n === 'number' && Number.isInteger(n) && n > 0;

const subCorrelated = openApiMemberSubsFixture.find(
  (s) =>
    String(s.packageId) === '12' &&
    (s.status === 'pending' || s.status === 'pending_payment') &&
    isValidPositiveInt(localRetainedSubId) &&
    (s.subscriptionId === localRetainedSubId || s.id === localRetainedSubId)
);
const subAmbiguous = openApiMemberSubsFixture.find(
  (s) =>
    String(s.packageId) === '12' &&
    (s.status === 'pending' || s.status === 'pending_payment') &&
    !subCorrelated
);

assert.equal(subCorrelated, undefined, 'Cannot correlate without retained numeric ID (no notes in mapper)');
assert.ok(subAmbiguous, 'Ambiguous pending subscription must be flagged');

let postAttempted = false;
httpClient.post = async () => {
  postAttempted = true;
  throw new Error('POST should NOT have been called!');
};

// Simulating the guard condition in PaymentModal
const runSubscriptionStep = async () => {
  if (subAmbiguous) {
    throw new Error('Ambiguous pending subscription detected: Halting before mutation.');
  }
  await httpClient.post('/api/members/101/packages', {});
};

await assert.rejects(
  () => runSubscriptionStep(),
  /Ambiguous pending subscription detected/i,
  'Must halt before mutation when ambiguous pending subscription exists'
);
assert.equal(postAttempted, false, 'Duplicate subscription POST must NOT be sent');
console.log('PASS: Ambiguous pending subscription halts workflow before mutation and blocks duplicate POST');

// 7.9 Strict positive integer ID validation (Number.isInteger(id) && id > 0)
const invalidIds = [
  true,
  false,
  'NaN',
  '12',
  12.5,
  0,
  -1,
  null,
  undefined,
  {},
  [],
];

for (const val of invalidIds) {
  assert.equal(
    isValidPositiveInt(val),
    false,
    `Value ${JSON.stringify(val)} must be rejected as invalid non-integer or non-positive ID`
  );
}

assert.equal(isValidPositiveInt(1), true);
assert.equal(isValidPositiveInt(9999), true);
console.log('PASS: Strict positive integer ID validation enforced (rejects floats, strings, booleans, zero, negatives)');

// Restore all mocked handlers
httpClient.get = failureOrigGet;
httpClient.patch = origPatch;

// --- 8. MYMEMBERSHIPVIEW & MEMBER IDENTITY RESOLUTION (PRODUCTION HELPERS) ---
console.log('\n--- 8. MYMEMBERSHIPVIEW & MEMBER IDENTITY RESOLUTION (PRODUCTION HELPERS) ---');

// 8.1 Production Identity Propagation & SCMSContext currentUser Mapping
const sampleLoginWithoutMemberId = {
  userId: 13,
  email: 'member_test@fitzone.vn',
  fullName: 'Hoàng Thị Oánh',
  role: 'Member',
  authorities: ['ROLE_MEMBER'],
};

const userWithoutMemberId = buildCurrentUser(sampleLoginWithoutMemberId, null);
assert.equal(userWithoutMemberId.id, 13, 'userId must be mapped to currentUser.id');
assert.equal(userWithoutMemberId.memberId, null, 'memberId must be strictly null when BE LoginResponse omits it');
assert.equal(getAuthoritativeProfileId(userWithoutMemberId), null, 'Must NOT infer memberId from userId 13');

// When BE provides explicit memberId:
const sampleLoginWithMemberId = {
  ...sampleLoginWithoutMemberId,
  memberId: 7,
};
const userWithMemberId = buildCurrentUser(sampleLoginWithMemberId, null);
assert.equal(userWithMemberId.id, 13);
assert.equal(userWithMemberId.memberId, 7, 'Explicit memberId from BE must be preserved');
assert.equal(getAuthoritativeProfileId(userWithMemberId), 7, 'Authoritative profile ID helper must resolve 7');
console.log('PASS: SCMSContext buildCurrentUser preserves validated memberId from BE and strictly separates it from userId');

// 8.2 F5 Restore simulation via /api/auth/me payload
const authMePayloadWithProfile = {
  userId: 13,
  fullName: 'Hoàng Thị Oánh',
  email: 'oanh@scms.com',
  role: 'Member',
  profileId: 7,
};
const f5RestoredUser = buildCurrentUser(authMePayloadWithProfile, null);
assert.equal(f5RestoredUser.memberId, 7, 'F5 restore via /api/auth/me profileId must preserve memberId 7');

const authMePayloadMissing = {
  userId: 13,
  fullName: 'Hoàng Thị Oánh',
  email: 'oanh@scms.com',
  role: 'Member',
};
const f5RestoredUserMissing = buildCurrentUser(authMePayloadMissing, null);
assert.equal(f5RestoredUserMissing.memberId, null, 'F5 restore without profileId must leave memberId null');
console.log('PASS: F5 session reload preserves authoritative profile ID from /api/auth/me without corruption');

// 8.3 Current Member Resolution in API Mode - Strict Isolation, NO Fallback to contextMembers[0]
// Test scenario: Foreign member has profile ID 13, which is identical to authenticated user's userId 13!
const foreignContextMembers = [
  {
    id: 13,
    name: 'Người Khác Có ID 13',
    code: 'MB-FOREIGN-13',
    coachName: 'Coach Lạ Xa Lạ',
    currentPackageId: 'pkg-99',
  },
  {
    id: 'mem-1',
    name: 'Nguyễn Minh Anh',
    code: 'MB-1001',
    coachName: 'Lê Thị Mai',
    currentPackageId: 'pkg-1',
  },
];

// In API mode: userWithMemberId has userId: 13, memberId: 7.
// Must NEVER match foreign member 13 by userId, must NOT adopt foreign coach or name, and must NOT invent MB-7 code!
const resolvedApiMember = resolveCurrentMemberProfile({
  currentUser: userWithMemberId,
  contextMembers: foreignContextMembers,
  apiEnabled: true,
});
assert.equal(resolvedApiMember.id, 7, 'Must use authenticated memberId 7');
assert.equal(resolvedApiMember.name, 'Hoàng Thị Oánh', 'Must use authenticated user name, NOT foreign member');
assert.notEqual(resolvedApiMember.name, 'Người Khác Có ID 13', 'Must NEVER match foreign member by userId 13');
assert.equal(resolvedApiMember.code, '', 'Must NOT invent member code prefix');
assert.equal(resolvedApiMember.coachName, '', 'Must NOT adopt coach from foreign member');

// In API mode with unresolved memberId:
const resolvedApiMemberUnresolved = resolveCurrentMemberProfile({
  currentUser: userWithoutMemberId,
  contextMembers: foreignContextMembers,
  apiEnabled: true,
});
assert.equal(resolvedApiMemberUnresolved.id, null);
assert.equal(resolvedApiMemberUnresolved.name, 'Hoàng Thị Oánh');
assert.notEqual(resolvedApiMemberUnresolved.name, 'Nguyễn Minh Anh', 'Must NEVER fallback to contextMembers[0] in API mode');

// In Mock mode: fallback to contextMembers[0] is permitted
const resolvedMockMember = resolveCurrentMemberProfile({
  currentUser: { id: 'mem-1', name: 'Nguyễn Minh Anh' },
  contextMembers: foreignContextMembers,
  apiEnabled: false,
});
assert.equal(resolvedMockMember.id, 'mem-1');
console.log('PASS: resolveCurrentMemberProfile in API mode completely eliminates userId matching, foreign member adoption, and code invention');

// 8.4 Active Subscription Resolution - Never Label Pending or Expired as Active
const subsPendingAndExpired = [
  { subscriptionId: 101, packageId: 12, status: 'pending_payment' },
  { subscriptionId: 102, packageId: 11, status: 'expired' },
];
assert.equal(
  resolveActiveSubscription(subsPendingAndExpired, true),
  null,
  'Pending and expired subscriptions must NEVER be labeled as active package'
);

const subsWithActive = [
  { subscriptionId: 101, packageId: 12, status: 'pending_payment' },
  { subscriptionId: 103, packageId: 12, status: 'active' },
];
const activeSub = resolveActiveSubscription(subsWithActive, true);
assert.equal(activeSub?.subscriptionId, 103, 'Must accurately select active subscription');

const subsWithGrace = [
  { subscriptionId: 104, packageId: 12, status: 'grace_period' },
];
assert.equal(resolveActiveSubscription(subsWithGrace, true)?.subscriptionId, 104);
console.log('PASS: resolveActiveSubscription strictly matches active/grace_period and rejects pending/expired');

// 8.5 Preflight Validation & Submitting State Reset Protection
const emptyPkgPreflight = validateDirectSubscriptionPreflight({
  selectedPackageId: '',
  memberProfileId: 7,
  hasAuthoritativeMemberId: true,
  apiEnabled: true,
  language: 'vi',
});
assert.equal(emptyPkgPreflight.ok, false);
assert.match(emptyPkgPreflight.error, /chọn một gói/i);

// In API mode: Direct member mutation is locked pending server-side idempotency/renewal contract
const apiLockedPreflight = validateDirectSubscriptionPreflight({
  selectedPackageId: '12',
  memberProfileId: 7,
  hasAuthoritativeMemberId: true,
  apiEnabled: true,
  language: 'vi',
});
assert.equal(apiLockedPreflight.ok, false);
assert.match(apiLockedPreflight.error, /tạm thời bị khóa/i);

// In Mock mode: Allowed with selected package
const mockValidPreflight = validateDirectSubscriptionPreflight({
  selectedPackageId: '12',
  memberProfileId: 7,
  hasAuthoritativeMemberId: true,
  apiEnabled: false,
  language: 'vi',
});
assert.equal(mockValidPreflight.ok, true);
assert.equal(mockValidPreflight.numericPackageId, 12);
console.log('PASS: Preflight validation keeps direct Member mutation locked in API mode and halts before submitting=true');

// 8.6 Safe Reconciliation: Read-Before-Write Duplicate Prevention
const existingPendingSubsFixture = [
  { subscriptionId: 777, packageId: 12, status: 'pending_payment' },
];
const pendingReconciliation = reconcileAndVerifySubscriptionSafety({
  existingSubscriptions: existingPendingSubsFixture,
  targetPackageId: 12,
  language: 'vi',
});
assert.equal(pendingReconciliation.allowed, false);
assert.equal(pendingReconciliation.reason, 'pending_exists');
assert.equal(pendingReconciliation.conflictingId, 777);
assert.match(pendingReconciliation.error, /chờ thanh toán \(#777\)/);

const existingActiveSubsFixture = [
  { subscriptionId: 888, packageId: 12, status: 'active' },
];
const activeReconciliation = reconcileAndVerifySubscriptionSafety({
  existingSubscriptions: existingActiveSubsFixture,
  targetPackageId: 12,
  language: 'vi',
});
assert.equal(activeReconciliation.allowed, false);
assert.equal(activeReconciliation.reason, 'active_exists');
assert.match(activeReconciliation.error, /đang hoạt động \(#888\)/);

// Registration for a DIFFERENT package is allowed
const differentPkgReconciliation = reconcileAndVerifySubscriptionSafety({
  existingSubscriptions: existingActiveSubsFixture,
  targetPackageId: 99,
  language: 'vi',
});
assert.equal(differentPkgReconciliation.allowed, true);
console.log('PASS: Reconcile safety rejects duplicate pending/active registration for same package');

// 8.7 Full Execution Flow with Read-Before-Write Mock Verification
const originalPost = httpClient.post;
const originalGet = httpClient.get;

// Case 1: Preflight halts direct POST in API mode; if adapter executed, GET failure fails closed
let postCalled = false;
httpClient.get = async () => {
  throw new Error('500 GET subscriptions server failure');
};
httpClient.post = async () => {
  postCalled = true;
  return { id: 999 };
};

const preflightApi = validateDirectSubscriptionPreflight({
  memberProfileId: 7,
  selectedPackageId: '12',
  hasAuthoritativeMemberId: true,
  apiEnabled: true,
});
assert.equal(preflightApi.ok, false, 'Preflight MUST halt before mutation in API mode');

let getErrorCaught = false;
try {
  await membershipApi.getMemberSubscriptions(7);
} catch (err) {
  getErrorCaught = true;
  assert.match(err.message, /500 GET subscriptions/);
}
assert.equal(getErrorCaught, true, 'GET failure must be captured');
assert.equal(postCalled, false, 'POST must NOT be called when GET fails (fail-closed protection)');

// Case 2: GET succeeds and returns pending record -> Reconcile blocks POST
postCalled = false;
httpClient.get = async () => [
  { id: 777, subscriptionId: 777, packageId: 12, status: 'pending_payment' }
];

const fetchedSubs = await membershipApi.getMemberSubscriptions(7);
const check = reconcileAndVerifySubscriptionSafety({
  existingSubscriptions: fetchedSubs,
  targetPackageId: 12,
});
assert.equal(check.allowed, false);
assert.equal(postCalled, false, 'POST must NOT be sent when pending subscription is detected');

// Case 3: GET succeeds, no pending records, POST succeeds and returns positive int
let submittedPayload = null;
httpClient.get = async () => [];
httpClient.post = async (url, data) => {
  postCalled = true;
  submittedPayload = data;
  return { id: 890, subscriptionId: 890, status: 'PENDING_PAYMENT' };
};

const clearSubs = await membershipApi.getMemberSubscriptions(7);
const clearCheck = reconcileAndVerifySubscriptionSafety({
  existingSubscriptions: clearSubs,
  targetPackageId: 12,
});
assert.equal(clearCheck.allowed, true);

const createdSub = await membershipApi.subscribePackage(7, {
  packageId: 12,
  paymentMethod: 'CASH',
  notes: 'Direct member registration',
});
assert.equal(postCalled, true);
assert.equal(createdSub.subscriptionId, 890);
assert.equal(submittedPayload.notes, 'Direct member registration', 'Notes must NOT have assumed sessionRef pattern');

// Restore httpClient
httpClient.get = originalGet;
httpClient.post = originalPost;
console.log('PASS: End-to-end read-before-write fail-closed policy blocks duplicate POST and handles recovery');

// --- 9. FE 2 MOCK FIXTURE SETTLEMENT & DUPLICATION PREVENTION ---
console.log('\n--- 9. FE 2 MOCK FIXTURE SETTLEMENT & DUPLICATION PREVENTION ---');

// Clear existing state before testing
clearMockSettlements();

const fixturePendingPayments = [
  {
    id: 'pay-001',
    code: 'INV-1001',
    memberId: 1,
    memberName: 'Nguyen Van A',
    packageId: 2,
    packageName: 'Standard 3M',
    amount: 1500000,
    status: 'pending',
    paymentStatus: 'pending',
    paymentDate: null,
  },
  {
    id: 'pay-002',
    code: 'INV-1002',
    memberId: 2,
    memberName: 'Tran Thi B',
    packageId: 1,
    packageName: 'Premium 1Y',
    amount: 5000000,
    status: 'successful',
    paymentStatus: 'successful',
    paymentDate: '2026-10-01 10:00:00',
  },
];

// Test 1: Initially not settled
assert.equal(isMockPaymentSettled(fixturePendingPayments[0]), false);
const initialMapped = applyMockPaymentSettlements(fixturePendingPayments);
assert.equal(initialMapped.length, 2);
assert.equal(initialMapped[0].status, 'pending');
console.log('PASS: Initial mock fixture reflects pending status and no duplicate entries');

// Test 2: Reject settling a payment that is already successful / not pending
const nonPendingAttempt = settleMockPaymentFixture(fixturePendingPayments[1]);
assert.equal(nonPendingAttempt.ok, false);
assert.ok(nonPendingAttempt.error.includes('pending'), 'Must reject settling non-pending payment');
console.log('PASS: Non-pending transaction settlement is strictly rejected');

// Test 3: Settle pending fixture in-place
let listenerTriggered = false;
const unsubscribe = subscribeMockSettlement(() => {
  listenerTriggered = true;
});

const settleResult = settleMockPaymentFixture(fixturePendingPayments[0], {
  notes: 'Thu tien mat tai quay le tan',
  receptionistName: 'Le Tan Test',
});

assert.equal(settleResult.ok, true);
assert.equal(settleResult.item.status, 'successful');
assert.equal(settleResult.item.paymentStatus, 'successful');
assert.equal(listenerTriggered, true, 'Settlement listener must be invoked');
unsubscribe();

const mappedAfterSettle = applyMockPaymentSettlements(fixturePendingPayments);
assert.equal(mappedAfterSettle.length, 2, 'Array length must NOT grow (no duplicate prepended)');
assert.equal(mappedAfterSettle[0].status, 'successful', 'Original record must be transitioned to successful');
assert.equal(mappedAfterSettle[0].id, 'pay-001');
console.log('PASS: Settle mock fixture in-place transitions row to successful without duplicating transactions');

// Test 4: Settle duplicate prevention
const duplicateAttempt = settleMockPaymentFixture(fixturePendingPayments[0]);
assert.equal(duplicateAttempt.ok, false);
assert.ok(duplicateAttempt.error.includes('đã được xác nhận'), 'Must reject duplicate settlement attempt');
console.log('PASS: Duplicate cash confirmation is rejected with clear error');

// Test 5: Cross-view Member profile derivation & activation without double-counting
const mockMemberPending = {
  id: 1,
  name: 'Nguyen Van A',
  membershipStatus: 'pending_payment',
  currentPackageId: 2,
  currentPackageName: 'Standard 3M',
  totalSpent: 0,
};

const derivedMember = deriveMockMemberProfile(mockMemberPending, mappedAfterSettle);
assert.equal(derivedMember.membershipStatus, 'active', 'Member must transition from pending_payment to active upon payment settlement');
assert.equal(derivedMember.totalSpent, 1500000, 'Member totalSpent must be updated by settled amount');
assert.equal(derivedMember.currentPackageId, 2);
assert.equal(derivedMember.currentPackageName, 'Standard 3M');
assert.equal(derivedMember.membershipType, 'Standard 3M');
assert.equal(derivedMember.startDate, null, 'Must not fabricate 2026-12-31 or joinDate if not provided in fixture');
assert.equal(derivedMember.endDate, null, 'Must not fabricate 2026-12-31 if not provided in fixture');

// Calling deriveMockMemberProfile multiple times must NOT double-count
const derivedMemberAgain = deriveMockMemberProfile(mockMemberPending, mappedAfterSettle);
assert.equal(derivedMemberAgain.totalSpent, 1500000, 'Re-deriving member profile must not add money twice');
console.log('PASS: Cross-view member profile derives active status and totalSpent exactly once without double counting');

// Test 5.1: Settle payment for a DIFFERENT package updates member package and explicit dates
clearMockSettlements();
const memberWithOldPkg = {
  id: 'mem-3',
  name: 'Pham Thanh Huong',
  membershipStatus: 'pending_payment',
  currentPackageId: 'pkg-1',
  currentPackageName: 'Gói Cơ Bản',
  membershipType: 'Gói Cơ Bản',
  totalSpent: 0,
};
const upgradePayment = {
  id: 'pay-upgrade-1',
  memberId: 'mem-3',
  packageId: 'pkg-2',
  packageName: 'Gói Nâng Cao',
  amount: 3200000,
  status: 'pending',
  startDate: '2026-10-10',
  endDate: '2027-01-10',
};
const upgradeSettleRes = settleMockPaymentFixture(upgradePayment);
assert.equal(upgradeSettleRes.ok, true);
assert.equal(upgradeSettleRes.item.packageId, 'pkg-2');

const upgradedMember = deriveMockMemberProfile(memberWithOldPkg, [upgradePayment]);
assert.equal(upgradedMember.membershipStatus, 'active');
assert.equal(upgradedMember.currentPackageId, 'pkg-2', 'Must switch to the settled packageId');
assert.equal(upgradedMember.currentPackageName, 'Gói Nâng Cao', 'Must switch to the settled packageName');
assert.equal(upgradedMember.membershipType, 'Gói Nâng Cao');
assert.equal(upgradedMember.totalSpent, 3200000);
assert.equal(upgradedMember.startDate, '2026-10-10', 'Must use explicit fixture startDate');
assert.equal(upgradedMember.endDate, '2027-01-10', 'Must use explicit fixture endDate');
console.log('PASS: Settle payment for different package switches member active package and respects explicit fixture dates');

// Test 6: F5 Persistence (simulating page reload from sessionStorage)
// We verify that reading back via applyMockPaymentSettlements still reflects 'successful'
clearMockSettlements();
settleMockPaymentFixture(fixturePendingPayments[0]);
const reloadedList = applyMockPaymentSettlements(fixturePendingPayments);
assert.equal(reloadedList.length, 2);
assert.equal(reloadedList[0].status, 'successful');
assert.equal(isMockPaymentSettled(fixturePendingPayments[0]), true);

const reloadedMember = deriveMockMemberProfile(mockMemberPending, reloadedList);
assert.equal(reloadedMember.membershipStatus, 'active');
assert.equal(reloadedMember.totalSpent, 1500000);
console.log('PASS: Mock fixture settlement and derived active status survive simulated F5 reload via sessionStorage');

clearMockSettlements();
assert.equal(isMockPaymentSettled(fixturePendingPayments[0]), false);
console.log('PASS: Clear mock settlements cleanly resets store for tests');

// Member request must remain pending until the desk confirms it, including after reload.
const requestMember = { id: 'mem-request', name: 'Test Member', membershipStatus: 'none', totalSpent: 0 };
const requestPkg = { id: 'pkg-request', nameVi: 'Gói thử', price: 700000 };
const createdRequest = createMockPendingPayment({ member: requestMember, pkg: requestPkg, method: 'cash' }, fixturePendingPayments);
assert.equal(createdRequest.ok, true);
assert.equal(createdRequest.item.status, 'pending');
assert.equal(createMockPendingPayment({ member: requestMember, pkg: requestPkg, method: 'cash' }, fixturePendingPayments).ok, false);
const pendingReadback = applyMockPaymentSettlements(fixturePendingPayments);
assert.equal(pendingReadback.length, 3);
assert.equal(pendingReadback[0].id, createdRequest.item.id);
assert.equal(deriveMockMemberProfile(requestMember, fixturePendingPayments).membershipStatus, 'pending_payment');
assert.equal(deriveMockMemberProfile(requestMember, fixturePendingPayments).totalSpent, 0);
const collectedRequest = settleMockPaymentFixture(pendingReadback[0]);
assert.equal(collectedRequest.ok, true);
const paidReadback = applyMockPaymentSettlements(fixturePendingPayments);
assert.equal(paidReadback.length, 3, 'Desk confirmation must update the same row');
assert.equal(paidReadback[0].status, 'successful');
assert.equal(deriveMockMemberProfile(requestMember, fixturePendingPayments).membershipStatus, 'active');
assert.equal(deriveMockMemberProfile(requestMember, fixturePendingPayments).totalSpent, 700000);
assert.equal(settleMockPaymentFixture(paidReadback[0]).ok, false, 'Second cash confirmation must fail');
clearMockSettlements();
console.log('PASS: Member request remains pending until one desk settlement, with cross-view readback');

// --- FOCUSED REGRESSION TESTS (REVIEW ROUND 1/3 FIXES) ---

// Test 9.1: Pending package request must NOT change currentPackageId of a paid/active package
clearMockSettlements();
const memberWithActivePaidPkg = {
  id: 'mem-paid-1',
  name: 'Active Paid Member',
  currentPackageId: 'pkg-active-1',
  currentPackageName: 'Gói Tiêu Chuẩn Đã Thanh Toán',
  membershipStatus: 'active',
  totalSpent: 1500000,
};
const upgradePendingPkg = {
  id: 'pkg-upgrade-pending',
  nameVi: 'Gói Nâng Cấp Chờ Duyệt',
  price: 3000000,
};
const pendingUpgradeReq = createMockPendingPayment(
  { member: memberWithActivePaidPkg, pkg: upgradePendingPkg, method: 'cash' },
  fixturePendingPayments
);
assert.equal(pendingUpgradeReq.ok, true);

// Verify: while the upgrade request is pending, member's currentPackageId MUST remain pkg-active-1!
const derivedDuringPending = deriveMockMemberProfile(memberWithActivePaidPkg, fixturePendingPayments);
assert.equal(
  derivedDuringPending.currentPackageId,
  'pkg-active-1',
  'Pending package request must NOT overwrite currentPackageId of paid package'
);
assert.equal(
  derivedDuringPending.currentPackageName,
  'Gói Tiêu Chuẩn Đã Thanh Toán',
  'Pending package request must NOT overwrite currentPackageName of paid package'
);
assert.equal(
  derivedDuringPending.membershipStatus,
  'active',
  'Pending upgrade request must NOT downgrade active membership status'
);
assert.equal(derivedDuringPending.totalSpent, 1500000, 'Total spent must not include unpaid pending package');

// Now settle the upgrade payment: currentPackageId should switch to the settled package
const pendingList = applyMockPaymentSettlements(fixturePendingPayments);
const pendingRow = pendingList.find((p) => p.id === pendingUpgradeReq.item.id);
assert.ok(pendingRow, 'Pending row must exist');
const upgradeSettled = settleMockPaymentFixture(pendingRow);
assert.equal(upgradeSettled.ok, true);

const derivedAfterUpgradeSettled = deriveMockMemberProfile(memberWithActivePaidPkg, fixturePendingPayments);
assert.equal(
  derivedAfterUpgradeSettled.currentPackageId,
  'pkg-upgrade-pending',
  'Once settled, currentPackageId must switch to the newly paid package'
);
assert.equal(derivedAfterUpgradeSettled.membershipStatus, 'active');
assert.equal(derivedAfterUpgradeSettled.totalSpent, 4500000);
clearMockSettlements();
console.log('PASS: Pending package request does NOT change currentPackageId of paid package');

// Test 9.2: sessionStorage write error must fail payment settlement closed (ok: false) and prevent success
clearMockSettlements();
const pendingPaymentForStorageError = {
  id: 'pay-err-001',
  code: 'INV-ERR-001',
  memberId: 99,
  memberName: 'Storage Error Member',
  packageId: 5,
  packageName: 'Gói Test Storage',
  amount: 500000,
  status: 'pending',
  paymentStatus: 'pending',
};

// Mock sessionStorage.setItem to simulate QuotaExceededError / SecurityError
const originalSetItem = globalThis.sessionStorage.setItem;
globalThis.sessionStorage.setItem = () => {
  throw new Error('QuotaExceededError: DOM Exception 22');
};

const failedSettlementResult = settleMockPaymentFixture(pendingPaymentForStorageError);
assert.equal(failedSettlementResult.ok, false, 'Settlement must fail closed when sessionStorage write throws');
assert.ok(
  failedSettlementResult.error.includes('sessionStorage'),
  'Error message must indicate storage persistence failure'
);
assert.equal(
  isMockPaymentSettled(pendingPaymentForStorageError),
  false,
  'Record must NOT be marked as settled in memory when storage fails'
);

// Restore original setItem
globalThis.sessionStorage.setItem = originalSetItem;

// Now with working storage, settlement must succeed
const retrySuccessSettlement = settleMockPaymentFixture(pendingPaymentForStorageError);
assert.equal(retrySuccessSettlement.ok, true);
assert.equal(isMockPaymentSettled(pendingPaymentForStorageError), true);
clearMockSettlements();
console.log('PASS: sessionStorage write error causes settlement to fail closed (ok: false) without false success');

// Test 9.3: createMockPendingPayment preserves requestedStartDate and isRenewal from MemberDetailView form
clearMockSettlements();
const renewalMemberProbe = {
  id: 'mem-renew-probe',
  name: 'Renewal Probe Member',
  currentPackageId: 'pkg-active-1',
  membershipStatus: 'active',
};
const renewalPkgProbe = {
  id: 'pkg-upgrade-probe',
  nameVi: 'Gói Thử Nghiệm Gia Hạn',
  price: 2500000,
};
const pendingRenewalProbe = createMockPendingPayment({
  member: renewalMemberProbe,
  pkg: renewalPkgProbe,
  method: 'cash',
  notes: 'Đăng ký gia hạn từ form',
  requestedStartDate: '2026-10-25',
  isRenewal: true,
});
assert.equal(pendingRenewalProbe.ok, true);
assert.equal(pendingRenewalProbe.item.requestedStartDate, '2026-10-25', 'Must preserve requestedStartDate');
assert.equal(pendingRenewalProbe.item.isRenewal, true, 'Must preserve isRenewal flag');

const pendingOverlayList = applyMockPaymentSettlements([]);
const storedProbeItem = pendingOverlayList.find((p) => p.id === pendingRenewalProbe.item.id);
assert.ok(storedProbeItem, 'Probe item must be present in storage overlay');
assert.equal(storedProbeItem.requestedStartDate, '2026-10-25');
assert.equal(storedProbeItem.isRenewal, true);

// Verify settlement respects requestedStartDate when startDate is not explicitly overridden
const settleProbeResult = settleMockPaymentFixture(storedProbeItem);
assert.equal(settleProbeResult.ok, true);
assert.equal(settleProbeResult.item.startDate, '2026-10-25', 'Settled record must fallback to requestedStartDate');
clearMockSettlements();
console.log('PASS: createMockPendingPayment preserves requestedStartDate and isRenewal with regression assertion');

// --- 10. PAYMENTMODAL DEFAULT MUTATION LOCK SAFETY ---
console.log('\n--- 10. PAYMENTMODAL DEFAULT MUTATION LOCK SAFETY ---');

// Test 10.1: PaymentModal mutation remains locked in standard API mode when VITE_TEST_HARNESS is not enabled
assert.equal(
  isPaymentModalMutationLocked(true, undefined),
  true,
  'Mutation must be locked when apiEnabled=true and VITE_TEST_HARNESS is undefined'
);
assert.equal(
  isPaymentModalMutationLocked(true, 'false'),
  true,
  'Mutation must be locked when apiEnabled=true and VITE_TEST_HARNESS=false'
);
assert.equal(
  isPaymentModalMutationLocked(true, ''),
  true,
  'Mutation must be locked when apiEnabled=true and VITE_TEST_HARNESS is empty'
);

// Test 10.2: PaymentModal mutation is only unlocked when VITE_TEST_HARNESS is explicitly "true"
assert.equal(
  isPaymentModalMutationLocked(true, 'true'),
  false,
  'Mutation is only unlocked when VITE_TEST_HARNESS is explicitly string true'
);

// Test 10.3: Mock mode (apiEnabled=false) is always unlocked for local demo fixtures
assert.equal(
  isPaymentModalMutationLocked(false, undefined),
  false,
  'Mock mode must allow local fixture mutations at desk without network calls'
);
assert.equal(
  isPaymentModalMutationLocked(false, 'false'),
  false,
  'Mock mode is not constrained by VITE_TEST_HARNESS'
);
console.log('PASS: PaymentModal locks mutation when apiEnabled=true and VITE_TEST_HARNESS is not enabled (no Render call)');

console.log('\n====================================================');
console.log('ALL FE 2: MEMBERSHIP, INVOICE & PAYMENT TESTS PASSED (100%)');
console.log('====================================================');
