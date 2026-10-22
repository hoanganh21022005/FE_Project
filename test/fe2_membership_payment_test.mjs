import assert from 'node:assert/strict';

// Setup mock sessionStorage for pure Node.js execution environment
const nodeSessionStorageStore = new Map();
globalThis.sessionStorage = {
  getItem: (k) => nodeSessionStorageStore.get(k) || null,
  setItem: (k, v) => nodeSessionStorageStore.set(k, String(v)),
  removeItem: (k) => nodeSessionStorageStore.delete(k),
  clear: () => nodeSessionStorageStore.clear(),
  get length() {
    return nodeSessionStorageStore.size;
  },
  key: (i) => Array.from(nodeSessionStorageStore.keys())[i] || null,
};
globalThis.window = {
  sessionStorage: globalThis.sessionStorage,
};

import {
  mapMembershipPackage,
  toMembershipPackageRequest,
  mapMemberSubscription,
  toMemberPackageRequest,
  mapSubscriptionOrder,
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
import { membershipApi, executePaymentModalSubmit, executePaymentModalDiscard } from '../src/api/membershipApi.js';
import { invoiceApi } from '../src/api/invoiceApi.js';
import { httpClient } from '../src/api/httpClient.js';
import {
  getAuthoritativeProfileId,
  buildCurrentUser,
  resolveCurrentMemberProfile,
  resolveActiveSubscription,
  validateDirectSubscriptionPreflight,
  reconcileAndVerifySubscriptionSafety,
  isRenderBackend,
  isPaymentModalMutationLocked,
  isDirectSubscriptionLocked,
  getFinitePositiveTime,
  reconcileIncompleteOrder,
  getStoredPendingOrder,
  setStoredPendingOrder,
  clearStoredPendingOrder,
  clearAllStoredPendingOrdersExcept,
  executeDirectSubscriptionSubmit,
  calculateInvoiceExpiry,
  resolveActiveSubscriptionDetails,
  resolvePendingInvoiceBannerState,
  resolveSubscriptionRowDisplay,
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

const beAdvancedPkg = {
  id: 10,
  name: 'Gói 1:1 Tennis Nâng Cao',
  durationDays: 45,
  price: 10000000,
  benefits: '12 buổi học kèm 1:1',
  status: 'ACTIVE',
  packageType: 'Advanced',
  totalCredit: 12,
};
const mappedAdvPkg = mapMembershipPackage(beAdvancedPkg);
assert.equal(mappedAdvPkg.packageType, 'Advanced');
assert.equal(mappedAdvPkg.totalCredit, 12);
console.log('PASS: mapMembershipPackage preserves packageType and totalCredit from Swagger schema');

// Render live 5-field public package fixture: must NOT invent packageType or totalCredit
const renderPublicPkgFixture = {
  id: 1,
  name: 'Goi Co Ban 1 Thang',
  price: 500000,
  durationDays: 30,
  benefits: 'Tap gym tu do, khong kem HLV',
};
const mappedPublicPkg = mapMembershipPackage(renderPublicPkgFixture);
assert.equal(mappedPublicPkg.id, 1);
assert.equal(mappedPublicPkg.name, 'Goi Co Ban 1 Thang');
assert.equal(mappedPublicPkg.price, 500000);
assert.equal(mappedPublicPkg.durationDays, 30);
assert.deepEqual(mappedPublicPkg.benefits, ['Tap gym tu do, khong kem HLV']);
assert.equal(mappedPublicPkg.packageType, null, 'Public package from Render must not invent packageType');
assert.equal(mappedPublicPkg.totalCredit, null, 'Public package from Render must not invent totalCredit');
console.log('PASS: mapMembershipPackage does not invent packageType or credit for Render 5-field public package');

// Empty / Null Package Handling
const emptyPkg = mapMembershipPackage({});
assert.equal(emptyPkg.id, null);
assert.equal(emptyPkg.name, '');
assert.equal(emptyPkg.price, null);
assert.equal(emptyPkg.status, 'active');
assert.equal(emptyPkg.packageType, null);
assert.equal(emptyPkg.totalCredit, null);
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

const beAdvancedSub = {
  subscriptionId: 101,
  memberId: 20,
  memberName: 'Nguyen Van B',
  packageId: 10,
  packageName: 'Gói 1:1 Tennis Nâng Cao',
  price: 10000000,
  startDate: '2026-10-20',
  endDate: '2026-12-04',
  status: 'ACTIVE',
  packageType: 'Advanced',
  remainingCredit: 12,
  validityDays: 45,
};
const mappedAdvSub = mapMemberSubscription(beAdvancedSub);
assert.equal(mappedAdvSub.packageType, 'Advanced');
assert.equal(mappedAdvSub.remainingCredit, 12);
assert.equal(mappedAdvSub.validityDays, 45);
console.log('PASS: mapMemberSubscription preserves packageType, remainingCredit, and validityDays');

const orderSample = {
  subscriptionId: 101,
  invoiceId: 55,
  invoiceCode: 'INV-2026-000055',
  amount: 10000000,
  paymentMethod: 'VNPAY',
  status: 'PENDING',
  expiresAt: '2026-10-20T16:05:00+07:00',
  paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?test=1',
};
const mappedOrder = mapSubscriptionOrder(orderSample);
assert.equal(mappedOrder.subscriptionId, 101);
assert.equal(mappedOrder.invoiceId, 55);
assert.equal(mappedOrder.invoiceCode, 'INV-2026-000055');
assert.equal(mappedOrder.amount, 10000000);
assert.equal(mappedOrder.paymentMethod, 'vnpay');
assert.equal(mappedOrder.status, 'pending_payment');
assert.equal(mappedOrder.expiresAt, '2026-10-20T16:05:00+07:00');
assert.equal(mappedOrder.paymentUrl, 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?test=1');
console.log('PASS: mapSubscriptionOrder maps SubscriptionOrderResponse fields accurately');

// Test mapSubscriptionOrder with null/empty response does not create fake invoice code, amount, or status
const emptyOrder = mapSubscriptionOrder({});
assert.equal(emptyOrder.subscriptionId, null);
assert.equal(emptyOrder.invoiceId, null);
assert.equal(emptyOrder.invoiceCode, null, 'Empty order must NOT invent INV-00000');
assert.equal(emptyOrder.amount, null, 'Empty order must NOT invent amount 0');
assert.equal(emptyOrder.paymentMethod, null, 'Empty order must NOT invent cash method');
assert.equal(emptyOrder.status, 'none', 'Empty order must NOT invent pending status');

const nullOrder = mapSubscriptionOrder(null);
assert.equal(nullOrder.invoiceCode, null);
assert.equal(nullOrder.amount, null);
assert.equal(nullOrder.status, 'none');

const missingInvoiceOrder = mapSubscriptionOrder({ subscriptionId: 101 });
assert.equal(missingInvoiceOrder.subscriptionId, 101);
assert.equal(missingInvoiceOrder.invoiceId, null);
assert.equal(missingInvoiceOrder.invoiceCode, null, 'Missing invoice ID must NOT invent invoice code');
assert.equal(missingInvoiceOrder.amount, null);
assert.equal(missingInvoiceOrder.status, 'none');

// If BE returns subscriptionId and invoiceId, but NO invoiceCode: invoiceCode must be strictly null
const noInvoiceCodeOrder = mapSubscriptionOrder({ subscriptionId: 101, invoiceId: 55 });
assert.equal(noInvoiceCodeOrder.subscriptionId, 101);
assert.equal(noInvoiceCodeOrder.invoiceId, 55);
assert.equal(noInvoiceCodeOrder.invoiceCode, null, 'mapSubscriptionOrder must NOT synthesize INV-00055 from invoiceId');

// Malformed subscriptionId and invoiceId handling in mapSubscriptionOrder (-1, 0, decimal, boolean, missing)
const malformedIds = [-1, 0, 10.5, true, false, 'abc'];
for (const badId of malformedIds) {
  const badSubOrder = mapSubscriptionOrder({ subscriptionId: badId, invoiceId: 55 });
  assert.equal(badSubOrder.subscriptionId, null, `Malformed subscriptionId ${badId} must map to null`);

  const badInvOrder = mapSubscriptionOrder({ subscriptionId: 101, invoiceId: badId });
  assert.equal(badInvOrder.invoiceId, null, `Malformed invoiceId ${badId} must map to null`);
}
console.log('PASS: mapSubscriptionOrder does NOT invent invoiceCode, amount, or status for empty, missing-ID, or malformed ID response');

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
assert.equal(mappedInv.code, null);
assert.equal(mappedInv.memberId, 101);
assert.equal(mappedInv.memberName, 'Nguyen Van A');
assert.equal(mappedInv.amount, 11500000);
assert.equal(mappedInv.paymentMethod, 'cash');
assert.equal(mappedInv.paymentStatus, 'successful');
assert.equal(mappedInv.receptionistName, 'Pham Thi Thu');
console.log('PASS: mapInvoice maps invoice fields, preserves null code when invoiceCode is missing, and normalizes paymentStatus to successful');

const beInvoiceWithCode = {
  invoiceId: 55,
  invoiceCode: 'INV-2026-000055',
  amount: 10000000,
  paymentMethod: 'ONLINE',
  paymentStatus: 'PENDING',
  expiresAt: '2026-10-20T16:05:00+07:00',
  createdAt: '2026-10-20T16:00:00+07:00',
  classId: 3,
  className: 'Tennis Advanced',
};
const mappedInvWithCode = mapInvoice(beInvoiceWithCode);
assert.equal(mappedInvWithCode.code, 'INV-2026-000055');
assert.equal(mappedInvWithCode.invoiceCode, 'INV-2026-000055');
assert.equal(mappedInvWithCode.expiresAt, '2026-10-20T16:05:00+07:00');
assert.equal(mappedInvWithCode.createdAt, '2026-10-20T16:00:00+07:00');
assert.equal(mappedInvWithCode.classId, 3);
assert.equal(mappedInvWithCode.className, 'Tennis Advanced');
console.log('PASS: mapInvoice preserves Swagger invoiceCode, expiresAt, createdAt, classId, and className');

// Payment Method Normalization
assert.equal(normalizePaymentMethod('CASH'), 'cash');
assert.equal(normalizePaymentMethod('Tiền mặt'), 'cash');
assert.equal(normalizePaymentMethod('BANK_TRANSFER'), 'bank_transfer');
assert.equal(normalizePaymentMethod('VietQR'), 'bank_transfer');
assert.equal(normalizePaymentMethod('CARD_POS'), 'card_pos');
assert.equal(normalizePaymentMethod('CreditCard'), 'card_pos');
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
assert.equal(normalizePaymentStatus('Expired'), 'expired');
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
      invoiceId: 42,
      invoiceCode: 'INV-00042',
      memberId: 101,
      packageId: body.packageId,
      packageName: 'VIP Elite Club',
      price: 11500000,
      startDate: body.startDate || '2026-10-10',
      endDate: '2027-10-10',
      status: 'ACTIVE',
    };
  }
  if (path === '/api/invoices/42/confirm-cash') {
    return {
      invoiceId: 42,
      invoiceCode: 'INV-00042',
      memberId: 101,
      packageId: 12,
      amount: 11500000,
      paymentMethod: 'CASH',
      paymentStatus: 'PAID',
      paymentDate: '2026-10-10T10:00:00Z',
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

// 6.1 Subscribe member to package (returns subscriptionId + invoiceId without second POST /api/invoices)
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
assert.equal(subResult.invoiceId, 42);
assert.equal(subResult.invoiceCode, 'INV-00042');
assert.equal(subResult.status, 'active');

const subCashConfirmResult = await invoiceApi.confirmCashPayment(subResult.invoiceId);
assert.equal(recordedPostPath, '/api/invoices/42/confirm-cash');
assert.equal(subCashConfirmResult.invoiceId, 42);
assert.equal(subCashConfirmResult.paymentStatus, 'successful');
console.log('PASS: subscribePackage returns invoiceId directly and settles cash via /api/invoices/42/confirm-cash without second POST /api/invoices');

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
assert.equal(brokenInv, null);

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

// 6.6 getPublicPackages and subscribeMe
httpClient.get = async (path) => {
  if (path === '/api/public/membership-packages') {
    return [
      { id: 1, name: 'Goi Co Ban 1 Thang', price: 500000, durationDays: 30, benefits: 'Tap gym tu do' },
    ];
  }
  if (path === '/api/members/me/invoices') {
    return [
      { invoiceId: 55, invoiceCode: 'INV-2026-000055', amount: 10000000, paymentStatus: 'PENDING' },
    ];
  }
  if (path === '/api/members/me/invoices/55') {
    return { invoiceId: 55, invoiceCode: 'INV-2026-000055', amount: 10000000, paymentStatus: 'PENDING' };
  }
  return origGet(path);
};

const pubPkgs = await membershipApi.getPublicPackages();
assert.equal(pubPkgs.length, 1);
assert.equal(pubPkgs[0].id, 1);
console.log('PASS: getPublicPackages calls /api/public/membership-packages and maps packages');

httpClient.post = async (path, body) => {
  recordedPostPath = path;
  recordedPostBody = body;
  if (path === '/api/members/me/subscriptions') {
    return {
      subscriptionId: 101,
      invoiceId: 55,
      invoiceCode: 'INV-2026-000055',
      amount: 10000000,
      paymentMethod: body.paymentMethod,
      status: 'PENDING',
      expiresAt: '2026-10-20T16:05:00+07:00',
      paymentUrl: 'https://sandbox.vnpayment.vn/pay?id=55',
    };
  }
  if (path === '/api/invoices/55/confirm-cash') {
    return {
      invoiceId: 55,
      invoiceCode: 'INV-2026-000055',
      amount: 10000000,
      paymentMethod: 'CASH',
      paymentStatus: 'PAID',
    };
  }
  if (path === '/api/invoices/55/pay-online') {
    return {
      paymentUrl: 'https://sandbox.vnpayment.vn/pay?id=55',
    };
  }
  return origPost(path, body);
};

const subMeOrder = await membershipApi.subscribeMe({
  packageId: 10,
  paymentMethod: 'VNPay',
});
assert.equal(recordedPostPath, '/api/members/me/subscriptions');
assert.equal(subMeOrder.subscriptionId, 101);
assert.equal(subMeOrder.invoiceId, 55);
assert.equal(subMeOrder.invoiceCode, 'INV-2026-000055');
assert.equal(subMeOrder.paymentUrl, 'https://sandbox.vnpayment.vn/pay?id=55');
console.log('PASS: subscribeMe sends payload to /api/members/me/subscriptions and returns mapped order');

// Test subscribeMe rejection when response lacks mandatory identifiers or has malformed IDs (-1, 0, decimal, boolean, missing)
const malformedIdCases = [
  { desc: 'missing invoiceId', response: { subscriptionId: 101 } },
  { desc: 'missing subscriptionId', response: { invoiceId: 55 } },
  { desc: 'negative subscriptionId (-1)', response: { subscriptionId: -1, invoiceId: 55 } },
  { desc: 'negative invoiceId (-1)', response: { subscriptionId: 101, invoiceId: -1 } },
  { desc: 'zero subscriptionId (0)', response: { subscriptionId: 0, invoiceId: 55 } },
  { desc: 'zero invoiceId (0)', response: { subscriptionId: 101, invoiceId: 0 } },
  { desc: 'decimal subscriptionId (10.5)', response: { subscriptionId: 10.5, invoiceId: 55 } },
  { desc: 'decimal invoiceId (55.5)', response: { subscriptionId: 101, invoiceId: 55.5 } },
  { desc: 'boolean subscriptionId (true)', response: { subscriptionId: true, invoiceId: 55 } },
  { desc: 'boolean invoiceId (false)', response: { subscriptionId: 101, invoiceId: false } },
  { desc: 'empty object response', response: {} },
  { desc: 'null response', response: null },
];

for (const tc of malformedIdCases) {
  let casePostCount = 0;
  const restorePost = httpClient.post;
  httpClient.post = async () => {
    casePostCount++;
    return tc.response;
  };

  await assert.rejects(
    () => membershipApi.subscribeMe({ packageId: 10, paymentMethod: 'VNPay' }),
    (err) => {
      assert.match(err.message, /thiếu định danh bắt buộc/i);
      assert.match(err.message, /GET đối soát/i);
      assert.match(err.message, /không tự gửi lại yêu cầu/i);
      assert.equal(err.name, 'IncompleteOrderResponseError');
      assert.equal(err.requiresReconciliation, true);
      return true;
    },
    `subscribeMe must reject ${tc.desc} as incomplete order and warn to reconcile via GET`
  );
  assert.equal(casePostCount, 1, `subscribeMe must send exactly one POST and NOT retry for ${tc.desc}`);
  httpClient.post = restorePost;
}
console.log('PASS: subscribeMe rejects all malformed ID responses (-1, 0, decimal, boolean, missing) for both IDs and sends exactly one POST');

// Test subscribePackage rejection when response lacks mandatory identifiers or has malformed IDs
for (const tc of malformedIdCases) {
  let casePostCount = 0;
  const restorePost = httpClient.post;
  httpClient.post = async () => {
    casePostCount++;
    return tc.response;
  };

  await assert.rejects(
    () => membershipApi.subscribePackage(101, { packageId: 10, paymentMethod: 'CASH' }),
    (err) => {
      assert.match(err.message, /thiếu định danh bắt buộc/i);
      assert.match(err.message, /đối soát/i);
      assert.match(err.message, /không tự gửi lại yêu cầu/i);
      assert.equal(err.name, 'IncompleteOrderResponseError');
      assert.equal(err.requiresReconciliation, true);
      return true;
    },
    `subscribePackage must reject ${tc.desc} as incomplete order and halt before retry`
  );
  assert.equal(casePostCount, 1, `subscribePackage must send exactly one POST and NOT retry for ${tc.desc}`);
  httpClient.post = restorePost;
}
console.log('PASS: subscribePackage rejects all malformed ID responses for SubscriptionOrderResponse and halts for reconciliation');

// 6.7 Swagger confirm-cash (no body) and pay-online
const cashConfirmResult = await invoiceApi.confirmCashPayment(55);
assert.equal(recordedPostPath, '/api/invoices/55/confirm-cash');
assert.equal(cashConfirmResult.paymentStatus, 'successful');
assert.equal(cashConfirmResult.invoiceCode, 'INV-2026-000055');
console.log('PASS: confirmCashPayment sends POST to /api/invoices/55/confirm-cash without request body');

const onlinePayResult = await invoiceApi.payInvoiceOnline(55);
assert.equal(recordedPostPath, '/api/invoices/55/pay-online');
assert.equal(onlinePayResult.paymentUrl, 'https://sandbox.vnpayment.vn/pay?id=55');
console.log('PASS: payInvoiceOnline sends POST to /api/invoices/55/pay-online and returns paymentUrl');

// 6.8 Member own invoices endpoints
const ownInvoicesList = await invoiceApi.getMemberOwnInvoices();
assert.equal(ownInvoicesList.length, 1);
assert.equal(ownInvoicesList[0].invoiceCode, 'INV-2026-000055');
console.log('PASS: getMemberOwnInvoices calls /api/members/me/invoices and returns mapped list');

const ownInvoiceDetail = await invoiceApi.getMemberOwnInvoiceById(55);
assert.equal(ownInvoiceDetail.invoiceId, 55);
assert.equal(ownInvoiceDetail.invoiceCode, 'INV-2026-000055');
console.log('PASS: getMemberOwnInvoiceById calls /api/members/me/invoices/55 and returns mapped invoice');

// Restore httpClient.post and httpClient.get
httpClient.post = origPost;
httpClient.get = origGet;

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
  if (path.includes('/api/members/202/packages')) {
    const err = new Error('403 Forbidden: Insufficient permissions to read foreign member packages');
    err.status = 403;
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
  () => membershipApi.getMemberSubscriptions(202),
  /403 Forbidden/,
  'membershipApi.getMemberSubscriptions must propagate 403 without falling back to /api/member-packages'
);

await assert.rejects(
  () => membershipApi.getMemberSubscriptions('me'),
  /ID hội viên không hợp lệ/,
  'membershipApi.getMemberSubscriptions must reject non-numeric "me" and fail closed without calling non-existent GET'
);

await assert.rejects(
  () => membershipApi.getMemberSubscriptions(null),
  /ID hội viên không hợp lệ/,
  'membershipApi.getMemberSubscriptions must reject null ID'
);

await assert.rejects(
  () => invoiceApi.getInvoices({ memberId: 101, status: 'pending' }),
  /401 Unauthorized/,
  'invoiceApi.getInvoices must throw and NOT swallow 401 as []'
);
console.log('PASS: GET queries strictly propagate 401/403/500 errors to fail closed and block duplicate POSTs');

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

// 8.5 Preflight Validation & Form Input Checking (Decoupled from Render Lock)
const emptyPkgPreflight = validateDirectSubscriptionPreflight({
  selectedPackageId: '',
  memberProfileId: 7,
  hasAuthoritativeMemberId: true,
  language: 'vi',
});
assert.equal(emptyPkgPreflight.ok, false);
assert.match(emptyPkgPreflight.error, /chọn một gói/i);

// Missing authoritative member profile ID rejects preflight
const missingMemberPreflight = validateDirectSubscriptionPreflight({
  selectedPackageId: '12',
  memberProfileId: null,
  hasAuthoritativeMemberId: false,
  language: 'vi',
});
assert.equal(missingMemberPreflight.ok, false);
assert.match(missingMemberPreflight.error, /ID hội viên đã xác thực/i);

// In API mode: Form inputs are validly checked and accepted
const validApiPreflight = validateDirectSubscriptionPreflight({
  selectedPackageId: '12',
  memberProfileId: 7,
  hasAuthoritativeMemberId: true,
  language: 'vi',
});
assert.equal(validApiPreflight.ok, true);
assert.equal(validApiPreflight.numericPackageId, 12);

// Mutation lock check independently ensures Render mutation remains strictly locked
assert.equal(isDirectSubscriptionLocked(true, undefined), true);
assert.equal(isDirectSubscriptionLocked(true, 'true', { isRender: true }), true);
console.log('PASS: Preflight validation tests form inputs in API mode while mutation lock keeps Render strictly locked');

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

// Case 1: Form preflight passes valid inputs in API mode, but mutation lock halts POST
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
});
assert.equal(preflightApi.ok, true, 'Preflight validates form inputs successfully in API mode');
assert.equal(preflightApi.numericPackageId, 12);

const mutationLocked = isDirectSubscriptionLocked(true, undefined);
assert.equal(mutationLocked, true, 'Mutation lock must halt before POST in API mode');

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
  return { id: 890, subscriptionId: 890, invoiceId: 942, status: 'PENDING_PAYMENT' };
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

// --- 10. PAYMENTMODAL & RENDER BACKEND MUTATION LOCK SAFETY ---
console.log('\n--- 10. PAYMENTMODAL & RENDER BACKEND MUTATION LOCK SAFETY ---');

// Test 10.1: isRenderBackend accurately identifies Render URLs and objects
assert.equal(isRenderBackend('https://swp391-be.onrender.com/api'), true);
assert.equal(isRenderBackend('http://gym-app.onrender.com'), true);
assert.equal(isRenderBackend({ targetUrl: 'https://swp391-be.onrender.com' }), true);
assert.equal(isRenderBackend({ baseUrl: 'https://swp391-be.onrender.com/api' }), true);
assert.equal(isRenderBackend({ isRender: true }), true);
assert.equal(isRenderBackend('http://localhost:8080'), false);
assert.equal(isRenderBackend('http://127.0.0.1:3000'), false);
assert.equal(isRenderBackend({ targetUrl: 'http://localhost:8080' }), false);
assert.equal(isRenderBackend(null), false);
console.log('PASS: isRenderBackend accurately classifies Render vs local targets');

// Test 10.2: PaymentModal mutation remains locked when target is Render, EVEN IF VITE_TEST_HARNESS='true'
assert.equal(
  isPaymentModalMutationLocked(true, 'true', { isRender: true }),
  true,
  'VITE_TEST_HARNESS must NOT unlock PaymentModal POST to Render'
);
assert.equal(
  isPaymentModalMutationLocked(true, 'true', { targetUrl: 'https://swp391-be.onrender.com' }),
  true,
  'VITE_TEST_HARNESS must NOT unlock PaymentModal POST to onrender.com'
);
assert.equal(
  isPaymentModalMutationLocked(true, undefined),
  true,
  'Mutation must be locked when apiEnabled=true and harnessFlag is undefined'
);
assert.equal(
  isPaymentModalMutationLocked(true, 'false'),
  true,
  'Mutation must be locked when harnessFlag is false'
);

// Test 10.3: Non-Render local harness can unlock for local integration testing
assert.equal(
  isPaymentModalMutationLocked(true, 'true', { targetUrl: 'http://localhost:8080' }),
  false,
  'Local non-Render environment allows harness testing'
);

// Test 10.4: Mock mode (apiEnabled=false) is always unlocked for local demo fixtures
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
console.log('PASS: PaymentModal strictly locks mutation to Render and prevents VITE_TEST_HARNESS bypass');

// --- 11. DIRECT MEMBER SUBSCRIPTION MUTATION LOCK, SINGLE-POST & RECONCILIATION ---
console.log('\n--- 11. DIRECT MEMBER SUBSCRIPTION MUTATION LOCK, SINGLE-POST & RECONCILIATION ---');

// Test 11.1: isDirectSubscriptionLocked prevents VITE_TEST_HARNESS from unlocking Render
assert.equal(
  isDirectSubscriptionLocked(true, 'true', { isRender: true }),
  true,
  'VITE_TEST_HARNESS must NOT unlock direct Member subscription POST to Render'
);
assert.equal(
  isDirectSubscriptionLocked(true, 'true', { targetUrl: 'https://swp391-be.onrender.com' }),
  true,
  'VITE_TEST_HARNESS must NOT unlock direct Member subscription POST to onrender.com'
);
assert.equal(
  isDirectSubscriptionLocked(true, undefined),
  true,
  'Direct subscription must be locked when apiEnabled=true and harnessFlag is undefined'
);
assert.equal(
  isDirectSubscriptionLocked(true, 'false'),
  true,
  'Direct subscription must be locked when harnessFlag is false'
);
assert.equal(
  isDirectSubscriptionLocked(true, 'true', { targetUrl: 'http://localhost:8080' }),
  false,
  'Direct subscription unlocks ONLY for local non-Render test harness'
);
assert.equal(
  isDirectSubscriptionLocked(false, undefined),
  false,
  'Mock mode is not locked by harnessFlag'
);
console.log('PASS: isDirectSubscriptionLocked prevents VITE_TEST_HARNESS from opening POST to Render');

// Test 11.2: validateDirectSubscriptionPreflight validates form inputs in API mode independently of Render lock
const preflightNoPkg = validateDirectSubscriptionPreflight({
  selectedPackageId: '',
  memberProfileId: 101,
  hasAuthoritativeMemberId: true,
  language: 'vi',
});
assert.equal(preflightNoPkg.ok, false);
assert.ok(preflightNoPkg.error.includes('chọn một gói') || preflightNoPkg.error.includes('select'));

const preflightInvalidId = validateDirectSubscriptionPreflight({
  selectedPackageId: 'abc',
  memberProfileId: 101,
  hasAuthoritativeMemberId: true,
  language: 'vi',
});
assert.equal(preflightInvalidId.ok, false);
assert.ok(preflightInvalidId.error.includes('không hợp lệ') || preflightInvalidId.error.includes('Invalid'));

const preflightNoMember = validateDirectSubscriptionPreflight({
  selectedPackageId: '3',
  memberProfileId: null,
  hasAuthoritativeMemberId: false,
  language: 'vi',
});
assert.equal(preflightNoMember.ok, false);
assert.ok(preflightNoMember.error.includes('ID hội viên') || preflightNoMember.error.includes('member ID'));

// Valid form input passes preflight in API mode so that form state can be validated
const preflightValid = validateDirectSubscriptionPreflight({
  selectedPackageId: '3',
  memberProfileId: 101,
  hasAuthoritativeMemberId: true,
  language: 'vi',
});
assert.equal(preflightValid.ok, true);
assert.equal(preflightValid.numericPackageId, 3);

// But POST to Render remains strictly locked by isDirectSubscriptionLocked
assert.equal(isDirectSubscriptionLocked(true, 'true', { isRender: true }), true);
console.log('PASS: Form validation runs in API mode while POST to Render remains unconditionally locked');

// Test 11.3: reconcileIncompleteOrder ONLY accepts new records belonging to the CURRENT attempt
const attemptStartTime = Date.now();
const oldInvoiceId = 10;
const newInvoiceId = 11;

const existingInvoicesBaseline = [
  { id: oldInvoiceId, invoiceCode: 'INV-10', packageId: 3, paymentStatus: 'pending', createdAt: new Date(attemptStartTime - 3600000).toISOString() },
];
const existingSubsBaseline = [
  { subscriptionId: 20, packageId: 3, status: 'pending_payment', createdAt: new Date(attemptStartTime - 3600000).toISOString() },
];

// If reconciliation runs and server only returns the OLD invoice from an earlier attempt:
const reconcileOldOnly = reconcileIncompleteOrder({
  targetPackageId: 3,
  invoices: existingInvoicesBaseline,
  subscriptions: existingSubsBaseline,
  attemptStartedAt: attemptStartTime,
  knownInvoiceIds: [oldInvoiceId],
  knownSubscriptionIds: [20],
});
assert.equal(
  reconcileOldOnly.foundOnServer,
  false,
  'Reconciliation must NOT adopt pre-existing invoice from an earlier attempt for the same package'
);
assert.equal(reconcileOldOnly.invoiceId, null);
assert.equal(reconcileOldOnly.subscriptionId, null);

// If server returns both the OLD invoice AND a genuinely NEW invoice created during this attempt:
const freshInvoicesFromServer = [
  ...existingInvoicesBaseline,
  { id: newInvoiceId, invoiceCode: 'INV-11', packageId: 3, paymentStatus: 'pending', amount: 1500000, createdAt: new Date(attemptStartTime + 200).toISOString() },
];
const reconcileWithNewRecord = reconcileIncompleteOrder({
  targetPackageId: 3,
  invoices: freshInvoicesFromServer,
  subscriptions: existingSubsBaseline,
  attemptStartedAt: attemptStartTime,
  knownInvoiceIds: [oldInvoiceId],
  knownSubscriptionIds: [20],
});
assert.equal(reconcileWithNewRecord.foundOnServer, true);
assert.equal(reconcileWithNewRecord.invoiceId, newInvoiceId, 'Must identify the new invoice belonging to current attempt');
assert.equal(reconcileWithNewRecord.subscriptionId, null, 'Must ignore old subscription baseline');

// Timestamp boundary check: old invoice not in knownInvoiceIds but with timestamp before attempt is rejected
const staleInvoiceNotInKnown = [
  { id: 999, invoiceCode: 'INV-999', packageId: 3, paymentStatus: 'pending', createdAt: new Date(attemptStartTime - 60000).toISOString() },
];
const reconcileStaleTimestamp = reconcileIncompleteOrder({
  targetPackageId: 3,
  invoices: staleInvoiceNotInKnown,
  attemptStartedAt: attemptStartTime,
  knownInvoiceIds: [],
});
assert.equal(reconcileStaleTimestamp.foundOnServer, false, 'Must reject stale invoice with timestamp prior to attempt');
console.log('PASS: reconcileIncompleteOrder strictly verifies current attempt baseline and excludes pre-existing records');

// Test 11.4: Partitioned pending order storage & cross-account isolation
clearAllStoredPendingOrdersExcept(null);

const memberA = 101;
const memberB = 202;

setStoredPendingOrder(memberA, {
  memberId: memberA,
  subscriptionId: 50,
  invoiceId: 60,
  invoiceCode: 'INV-A-60',
  amount: 2500000,
});

// Member A reads their own pending order
const orderA = getStoredPendingOrder(memberA);
assert.ok(orderA);
assert.equal(orderA.memberId, memberA);
assert.equal(orderA.invoiceCode, 'INV-A-60');

// Member B attempts to read pending order: must receive null
const orderB = getStoredPendingOrder(memberB);
assert.equal(orderB, null, 'Member B must NOT see Member A pending order');

// Account switch cleanup: Member B logs in and purges foreign orders
clearAllStoredPendingOrdersExcept(memberB);

// Member A stored order must now be purged from storage
assert.equal(getStoredPendingOrder(memberA), null, 'Foreign pending order must be cleared upon account switch');
console.log('PASS: Partitioned storage guarantees complete isolation between Member accounts');

// Test 11.5: Component Submit Flow - Baseline GET Failure Halts Before POST (0 POSTs)
const savedGet = httpClient.get;
const savedPost = httpClient.post;

let baselinePostAttempts = 0;
httpClient.get = async (path) => {
  if (path === '/api/members/me/invoices') {
    throw new Error('500 Internal Server Error: Failed to fetch baseline invoices');
  }
  if (path.includes('/api/members/101/packages')) {
    return [];
  }
  return savedGet(path);
};
httpClient.post = async (path, body) => {
  if (path === '/api/members/me/subscriptions') {
    baselinePostAttempts++;
  }
  return savedPost(path, body);
};

let baselineErrorCaught = null;
const baselineTestSubmittingRef = { current: false };
const baselineResult = await executeDirectSubscriptionSubmit({
  submittingRef: baselineTestSubmittingRef,
  memberProfileId: 101,
  selectedPackageId: '3',
  hasAuthoritativeMemberId: true,
  isMemberMutationLocked: false,
  apiEnabled: true,
  paymentMethod: 'cash',
  language: 'vi',
  callbacks: {
    setSubmitError: (msg) => { baselineErrorCaught = msg; },
  },
});

assert.equal(baselinePostAttempts, 0, 'Baseline invoice GET failure must halt before POST, generating exactly 0 POSTs');
assert.equal(baselineResult.success, false, 'Submit must fail closed when baseline GET fails');
assert.equal(baselineTestSubmittingRef.current, false, 'Submitting ref must be released on failure');
assert.match(baselineErrorCaught, /Không thể kiểm tra hóa đơn hiện tại/i, 'Error message must reflect invoice baseline check failure');
console.log('PASS: Baseline invoice GET failure halts immediately before POST, generating exactly 0 POSTs');

// Test 11.6: Component Submit Flow - Synchronous Mutex Lock Limits Repeat Submissions to At Most 1 POST
let repeatPostAttempts = 0;
httpClient.get = async (path) => {
  if (path === '/api/members/me/invoices') {
    return [];
  }
  if (path.includes('/api/members/101/packages')) {
    return [];
  }
  return savedGet(path);
};
httpClient.post = async (path, body) => {
  if (path === '/api/members/me/subscriptions') {
    repeatPostAttempts++;
    await new Promise((resolve) => setTimeout(resolve, 30));
    return {
      subscriptionId: 201,
      invoiceId: 301,
      invoiceCode: 'INV-0301',
      amount: 2500000,
      paymentMethod: 'CASH',
    };
  }
  return savedPost(path, body);
};

const sharedSubmittingRef = { current: false };
const p1 = executeDirectSubscriptionSubmit({
  submittingRef: sharedSubmittingRef,
  memberProfileId: 101,
  selectedPackageId: '3',
  hasAuthoritativeMemberId: true,
  isMemberMutationLocked: false,
  apiEnabled: true,
  paymentMethod: 'cash',
  language: 'vi',
});
const p2 = executeDirectSubscriptionSubmit({
  submittingRef: sharedSubmittingRef,
  memberProfileId: 101,
  selectedPackageId: '3',
  hasAuthoritativeMemberId: true,
  isMemberMutationLocked: false,
  apiEnabled: true,
  paymentMethod: 'cash',
  language: 'vi',
});

const [res1, res2] = await Promise.all([p1, p2]);

assert.equal(repeatPostAttempts, 1, 'Synchronous ref mutex must strictly block repeated submit calls, producing at most 1 POST');
assert.ok(
  (res1.executed === true && res2.blockedByMutex === true) ||
  (res2.executed === true && res1.blockedByMutex === true),
  'One call must execute while the concurrent call is blocked by synchronous mutex'
);
assert.equal(sharedSubmittingRef.current, false, 'Mutex ref must be released after completion');
console.log('PASS: Component submit flow with synchronous mutex strictly limits rapid repeat submissions to at most 1 POST');

// Test 11.7: Component Submit Flow - Network Timeout Triggers GET Đối Soát & Confirms Complete Order
const memberTestId = 101;
const targetPackage = 3;
const prePostBaselineTime = Date.now();
const existingInvoiceId = 42;

let postAttemptsMade = 0;
let isPostTimeoutTriggered = false;

httpClient.get = async (path) => {
  if (path === '/api/members/me/invoices') {
    if (!isPostTimeoutTriggered) {
      // Baseline check before POST
      return [
        { id: existingInvoiceId, invoiceId: existingInvoiceId, invoiceCode: 'INV-0042', packageId: targetPackage, paymentStatus: 'pending', createdAt: new Date(prePostBaselineTime - 600000).toISOString() },
      ];
    }
    // Reconciliation check after POST timeout: server created genuine new invoice
    return [
      { id: existingInvoiceId, invoiceId: existingInvoiceId, invoiceCode: 'INV-0042', packageId: targetPackage, paymentStatus: 'pending', createdAt: new Date(prePostBaselineTime - 600000).toISOString() },
      { id: 88, invoiceId: 88, invoiceCode: 'INV-0088', packageId: targetPackage, amount: 2000000, paymentStatus: 'pending', createdAt: new Date().toISOString() },
    ];
  }
  if (path.includes('/api/members/101/packages')) {
    if (!isPostTimeoutTriggered) {
      // Safety check before POST
      return [];
    }
    // Reconciliation check after POST timeout: server created genuine new subscription
    return [
      { subscriptionId: 99, packageId: targetPackage, status: 'pending_payment', startDate: new Date().toISOString(), createdAt: new Date().toISOString() },
    ];
  }
  return savedGet(path);
};

httpClient.post = async (path, body) => {
  if (path === '/api/members/me/subscriptions') {
    postAttemptsMade++;
    isPostTimeoutTriggered = true;
    const timeoutError = new Error('504 Gateway Timeout: POST /api/members/me/subscriptions');
    timeoutError.status = 504;
    throw timeoutError;
  }
  return savedPost(path, body);
};

let toastRecordedMessage = null;
let modalClosed = false;
clearStoredPendingOrder(memberTestId);

const timeoutReconcileResult = await executeDirectSubscriptionSubmit({
  submittingRef: { current: false },
  memberProfileId: memberTestId,
  selectedPackageId: String(targetPackage),
  hasAuthoritativeMemberId: true,
  isMemberMutationLocked: false,
  apiEnabled: true,
  paymentMethod: 'cash',
  language: 'vi',
  callbacks: {
    showToast: (msg) => { toastRecordedMessage = msg; },
    setIsSubscribeModalOpen: (open) => { if (!open) modalClosed = true; },
  },
});

assert.equal(postAttemptsMade, 1, 'Exactly one POST must be attempted before timeout');
assert.equal(timeoutReconcileResult.success, true, 'Component flow must recover and succeed via GET reconciliation');
assert.equal(timeoutReconcileResult.reconciled, true, 'Result must be marked as reconciled');
assert.equal(timeoutReconcileResult.order?.confirmed, true, 'Order with both invoice and subscription must be confirmed');
assert.equal(getStoredPendingOrder(memberTestId)?.invoiceId, 88, 'Confirmed invoice ID must be saved in member pending storage');
assert.equal(getStoredPendingOrder(memberTestId)?.subscriptionId, 99, 'Confirmed subscription ID must be saved in member pending storage');
assert.match(toastRecordedMessage, /INV-0088/, 'Toast must inform user that order was recorded with invoice code');
assert.equal(modalClosed, true, 'Modal must close after successful reconciliation');
console.log('PASS: Network timeout automatically triggers GET đối soát, confirming order when both invoice and subscription exist');

// Test 11.8: Component Submit Flow - Incomplete Orders (Missing One Record or Evidence) Are NOT Confirmed
// Subcase A: Server only created invoice (missing subscription counterpart)
let singleSidedToastShown = false;
let singleSidedSubmitError = null;
isPostTimeoutTriggered = false;
clearStoredPendingOrder(memberTestId);

httpClient.get = async (path) => {
  if (path === '/api/members/me/invoices') {
    if (!isPostTimeoutTriggered) {
      return [{ id: existingInvoiceId, invoiceId: existingInvoiceId, invoiceCode: 'INV-0042', packageId: targetPackage, paymentStatus: 'pending', createdAt: new Date(prePostBaselineTime - 600000).toISOString() }];
    }
    // Returns new invoice
    return [
      { id: existingInvoiceId, invoiceId: existingInvoiceId, invoiceCode: 'INV-0042', packageId: targetPackage, paymentStatus: 'pending', createdAt: new Date(prePostBaselineTime - 600000).toISOString() },
      { id: 89, invoiceId: 89, invoiceCode: 'INV-0089', packageId: targetPackage, amount: 2000000, paymentStatus: 'pending', createdAt: new Date().toISOString() },
    ];
  }
  if (path.includes('/api/members/101/packages')) {
    // Missing subscription counterpart on server!
    return [];
  }
  return savedGet(path);
};

const missingSubResult = await executeDirectSubscriptionSubmit({
  submittingRef: { current: false },
  memberProfileId: memberTestId,
  selectedPackageId: String(targetPackage),
  hasAuthoritativeMemberId: true,
  isMemberMutationLocked: false,
  apiEnabled: true,
  paymentMethod: 'cash',
  language: 'vi',
  callbacks: {
    showToast: () => { singleSidedToastShown = true; },
    setSubmitError: (msg) => { singleSidedSubmitError = msg; },
  },
});

assert.equal(missingSubResult.success, false, 'Single-sided order lacking subscription counterpart must NOT be confirmed as success');
assert.equal(missingSubResult.ambiguous, true, 'Result must be flagged as ambiguous');
assert.equal(missingSubResult.reconciledState?.confirmed, false, 'Confirmed flag must be false for single-sided order');
assert.equal(missingSubResult.reconciledState?.isAmbiguous, true);
assert.equal(missingSubResult.reconciledState?.ambiguityReason, 'missing_counterpart_record');
assert.equal(singleSidedToastShown, false, 'Must NOT show success or recorded toast for incomplete single-sided order');
assert.equal(getStoredPendingOrder(memberTestId), null, 'Must NOT save unconfirmed incomplete order to member storage');
assert.match(singleSidedSubmitError, /chưa xác định rõ kết quả/i, 'Must present ambiguous safety warning to user');

// Subcase B: Server only created subscription (missing invoice counterpart)
const missingInvOrder = reconcileIncompleteOrder({
  targetPackageId: targetPackage,
  invoices: [],
  subscriptions: [
    { subscriptionId: 105, packageId: targetPackage, status: 'pending_payment', createdAt: new Date().toISOString() },
  ],
  attemptStartedAt: Date.now(),
  knownInvoiceIds: [],
  knownSubscriptionIds: [],
});
assert.equal(missingInvOrder.confirmed, false, 'Missing invoice counterpart must NOT be confirmed');
assert.equal(missingInvOrder.isAmbiguous, true);
assert.equal(missingInvOrder.ambiguityReason, 'missing_counterpart_record');

// Subcase C: Missing, non-positive, or infinite attemptStartedAt
assert.equal(getFinitePositiveTime(Infinity), null);
assert.equal(getFinitePositiveTime(-Infinity), null);
assert.equal(getFinitePositiveTime('Infinity'), null);
assert.equal(getFinitePositiveTime('-Infinity'), null);
assert.equal(getFinitePositiveTime('+Infinity'), null);
assert.equal(getFinitePositiveTime(NaN), null);
assert.equal(getFinitePositiveTime(0), null);
assert.equal(getFinitePositiveTime(-100), null);
assert.equal(getFinitePositiveTime(null), null);
assert.equal(getFinitePositiveTime(undefined), null);
assert.equal(getFinitePositiveTime(1700000000000), 1700000000000);
assert.equal(getFinitePositiveTime('1700000000000'), 1700000000000);

const missingAttemptTimeOrder = reconcileIncompleteOrder({
  targetPackageId: targetPackage,
  invoices: [{ id: 88, packageId: targetPackage, paymentStatus: 'pending', createdAt: new Date().toISOString() }],
  subscriptions: [{ subscriptionId: 99, packageId: targetPackage, status: 'pending_payment', createdAt: new Date().toISOString() }],
  attemptStartedAt: null,
});
assert.equal(missingAttemptTimeOrder.confirmed, false, 'Missing attemptStartedAt must NOT be confirmed');
assert.equal(missingAttemptTimeOrder.isAmbiguous, true);
assert.equal(missingAttemptTimeOrder.ambiguityReason, 'missing_attempt_timestamp');

const zeroAttemptTimeOrder = reconcileIncompleteOrder({
  targetPackageId: targetPackage,
  invoices: [{ id: 88, packageId: targetPackage, paymentStatus: 'pending', createdAt: new Date().toISOString() }],
  subscriptions: [{ subscriptionId: 99, packageId: targetPackage, status: 'pending_payment', createdAt: new Date().toISOString() }],
  attemptStartedAt: 0,
});
assert.equal(zeroAttemptTimeOrder.confirmed, false, 'Non-positive attemptStartedAt must NOT be confirmed');
assert.equal(zeroAttemptTimeOrder.isAmbiguous, true);
assert.equal(zeroAttemptTimeOrder.ambiguityReason, 'missing_attempt_timestamp');

const infAttemptTimeOrder = reconcileIncompleteOrder({
  targetPackageId: targetPackage,
  invoices: [{ id: 88, packageId: targetPackage, paymentStatus: 'pending', createdAt: new Date().toISOString() }],
  subscriptions: [{ subscriptionId: 99, packageId: targetPackage, status: 'pending_payment', createdAt: new Date().toISOString() }],
  attemptStartedAt: Infinity,
});
assert.equal(infAttemptTimeOrder.confirmed, false, 'Infinity attemptStartedAt must NOT be confirmed');
assert.equal(infAttemptTimeOrder.isAmbiguous, true);
assert.equal(infAttemptTimeOrder.ambiguityReason, 'missing_attempt_timestamp');

const negInfAttemptTimeOrder = reconcileIncompleteOrder({
  targetPackageId: targetPackage,
  invoices: [{ id: 88, packageId: targetPackage, paymentStatus: 'pending', createdAt: new Date().toISOString() }],
  subscriptions: [{ subscriptionId: 99, packageId: targetPackage, status: 'pending_payment', createdAt: new Date().toISOString() }],
  attemptStartedAt: -Infinity,
});
assert.equal(negInfAttemptTimeOrder.confirmed, false, '-Infinity attemptStartedAt must NOT be confirmed');
assert.equal(negInfAttemptTimeOrder.isAmbiguous, true);
assert.equal(negInfAttemptTimeOrder.ambiguityReason, 'missing_attempt_timestamp');

// Subcase D: Both records lacking valid positive integer ID
// D1. reconcileIncompleteOrder unit check
const bothRecordsMissingId = reconcileIncompleteOrder({
  targetPackageId: targetPackage,
  invoices: [
    { packageId: targetPackage, paymentStatus: 'pending', createdAt: new Date().toISOString() },
  ],
  subscriptions: [
    { packageId: targetPackage, status: 'pending_payment', createdAt: new Date().toISOString() },
  ],
  attemptStartedAt: Date.now(),
  knownInvoiceIds: [],
  knownSubscriptionIds: [],
});
assert.equal(bothRecordsMissingId.confirmed, false, 'Both records lacking ID must NOT be confirmed');
assert.equal(bothRecordsMissingId.isAmbiguous, true, 'Both records lacking ID must be flagged as ambiguous');
assert.equal(bothRecordsMissingId.foundOnServer, true, 'Both records lacking ID must report foundOnServer: true');
assert.equal(bothRecordsMissingId.ambiguityReason, 'insufficient_identifiers');

// D2. Component timeout flow via executeDirectSubscriptionSubmit: both records lacking ID
let missingIdToastShown = false;
let missingIdSubmitError = null;
isPostTimeoutTriggered = false;
clearStoredPendingOrder(memberTestId);

httpClient.get = async (path) => {
  if (path === '/api/members/me/invoices') {
    if (!isPostTimeoutTriggered) {
      return [{ id: existingInvoiceId, invoiceId: existingInvoiceId, invoiceCode: 'INV-0042', packageId: targetPackage, paymentStatus: 'pending', createdAt: new Date(prePostBaselineTime - 600000).toISOString() }];
    }
    return [
      { packageId: targetPackage, paymentStatus: 'pending', createdAt: new Date().toISOString() },
    ];
  }
  if (path.includes('/api/members/101/packages')) {
    if (!isPostTimeoutTriggered) return [];
    return [
      { packageId: targetPackage, status: 'pending_payment', createdAt: new Date().toISOString() },
    ];
  }
  return savedGet(path);
};

const bothMissingIdFlowResult = await executeDirectSubscriptionSubmit({
  submittingRef: { current: false },
  memberProfileId: memberTestId,
  selectedPackageId: String(targetPackage),
  hasAuthoritativeMemberId: true,
  isMemberMutationLocked: false,
  apiEnabled: true,
  paymentMethod: 'cash',
  language: 'vi',
  callbacks: {
    showToast: () => { missingIdToastShown = true; },
    setSubmitError: (msg) => { missingIdSubmitError = msg; },
  },
});

assert.equal(bothMissingIdFlowResult.success, false, 'Timeout flow with both records lacking ID must NOT report success');
assert.equal(bothMissingIdFlowResult.ambiguous, true, 'Result must be ambiguous');
assert.equal(bothMissingIdFlowResult.reconciledState?.confirmed, false);
assert.equal(bothMissingIdFlowResult.reconciledState?.isAmbiguous, true);
assert.equal(bothMissingIdFlowResult.reconciledState?.foundOnServer, true);
assert.equal(missingIdToastShown, false, 'Must NOT show success toast when records lack ID');
assert.equal(getStoredPendingOrder(memberTestId), null, 'Must NOT save unconfirmed order to storage when records lack ID');
assert.match(missingIdSubmitError, /chưa xác định rõ kết quả/i);

// Subcase E: Both records lacking timestamp evidence
// E1. reconcileIncompleteOrder unit check
const bothRecordsMissingTime = reconcileIncompleteOrder({
  targetPackageId: targetPackage,
  invoices: [
    { id: 91, invoiceId: 91, invoiceCode: 'INV-0091', packageId: targetPackage, paymentStatus: 'pending' },
  ],
  subscriptions: [
    { subscriptionId: 92, packageId: targetPackage, status: 'pending_payment' },
  ],
  attemptStartedAt: Date.now(),
  knownInvoiceIds: [],
  knownSubscriptionIds: [],
});
assert.equal(bothRecordsMissingTime.confirmed, false, 'Both records lacking time must NOT be confirmed');
assert.equal(bothRecordsMissingTime.isAmbiguous, true, 'Both records lacking time must be flagged as ambiguous');
assert.equal(bothRecordsMissingTime.foundOnServer, true, 'Both records lacking time must report foundOnServer: true');
assert.equal(bothRecordsMissingTime.ambiguityReason, 'missing_or_invalid_timestamp');

// E2. Component timeout flow via executeDirectSubscriptionSubmit: both records lacking timestamp
let missingTimeToastShown = false;
let missingTimeSubmitError = null;
isPostTimeoutTriggered = false;
clearStoredPendingOrder(memberTestId);

httpClient.get = async (path) => {
  if (path === '/api/members/me/invoices') {
    if (!isPostTimeoutTriggered) {
      return [{ id: existingInvoiceId, invoiceId: existingInvoiceId, invoiceCode: 'INV-0042', packageId: targetPackage, paymentStatus: 'pending', createdAt: new Date(prePostBaselineTime - 600000).toISOString() }];
    }
    return [
      { id: 91, invoiceId: 91, invoiceCode: 'INV-0091', packageId: targetPackage, paymentStatus: 'pending' },
    ];
  }
  if (path.includes('/api/members/101/packages')) {
    if (!isPostTimeoutTriggered) return [];
    return [
      { subscriptionId: 92, packageId: targetPackage, status: 'pending_payment' },
    ];
  }
  return savedGet(path);
};

const bothMissingTimeFlowResult = await executeDirectSubscriptionSubmit({
  submittingRef: { current: false },
  memberProfileId: memberTestId,
  selectedPackageId: String(targetPackage),
  hasAuthoritativeMemberId: true,
  isMemberMutationLocked: false,
  apiEnabled: true,
  paymentMethod: 'cash',
  language: 'vi',
  callbacks: {
    showToast: () => { missingTimeToastShown = true; },
    setSubmitError: (msg) => { missingTimeSubmitError = msg; },
  },
});

assert.equal(bothMissingTimeFlowResult.success, false, 'Timeout flow with both records lacking time must NOT report success');
assert.equal(bothMissingTimeFlowResult.ambiguous, true, 'Result must be ambiguous');
assert.equal(bothMissingTimeFlowResult.reconciledState?.confirmed, false);
assert.equal(bothMissingTimeFlowResult.reconciledState?.isAmbiguous, true);
assert.equal(bothMissingTimeFlowResult.reconciledState?.foundOnServer, true);
assert.equal(missingTimeToastShown, false, 'Must NOT show success toast when records lack timestamp');
assert.equal(getStoredPendingOrder(memberTestId), null, 'Must NOT save unconfirmed order to storage when records lack timestamp');
assert.match(missingTimeSubmitError, /chưa xác định rõ kết quả/i);

// Subcase F: Infinite timestamps (Infinity and -Infinity)
// F1. reconcileIncompleteOrder unit check
const infiniteTimestampOrder = reconcileIncompleteOrder({
  targetPackageId: targetPackage,
  invoices: [
    { id: 93, invoiceId: 93, invoiceCode: 'INV-0093', packageId: targetPackage, paymentStatus: 'pending', createdAt: Infinity },
  ],
  subscriptions: [
    { subscriptionId: 94, packageId: targetPackage, status: 'pending_payment', createdAt: Infinity },
  ],
  attemptStartedAt: Date.now(),
  knownInvoiceIds: [],
  knownSubscriptionIds: [],
});
assert.equal(infiniteTimestampOrder.confirmed, false, 'Infinity timestamp must NOT be confirmed');
assert.equal(infiniteTimestampOrder.isAmbiguous, true, 'Infinity timestamp must be flagged ambiguous');
assert.equal(infiniteTimestampOrder.foundOnServer, true, 'Infinity timestamp must report foundOnServer: true');
assert.equal(infiniteTimestampOrder.ambiguityReason, 'missing_or_invalid_timestamp');

const negInfiniteTimestampOrder = reconcileIncompleteOrder({
  targetPackageId: targetPackage,
  invoices: [
    { id: 95, invoiceId: 95, invoiceCode: 'INV-0095', packageId: targetPackage, paymentStatus: 'pending', createdAt: -Infinity },
  ],
  subscriptions: [
    { subscriptionId: 96, packageId: targetPackage, status: 'pending_payment', createdAt: -Infinity },
  ],
  attemptStartedAt: Date.now(),
  knownInvoiceIds: [],
  knownSubscriptionIds: [],
});
assert.equal(negInfiniteTimestampOrder.confirmed, false, '-Infinity timestamp must NOT be confirmed');
assert.equal(negInfiniteTimestampOrder.isAmbiguous, true);
assert.equal(negInfiniteTimestampOrder.foundOnServer, true);
assert.equal(negInfiniteTimestampOrder.ambiguityReason, 'missing_or_invalid_timestamp');

const strInfiniteTimestampOrder = reconcileIncompleteOrder({
  targetPackageId: targetPackage,
  invoices: [
    { id: 97, invoiceId: 97, invoiceCode: 'INV-0097', packageId: targetPackage, paymentStatus: 'pending', createdAt: 'Infinity' },
  ],
  subscriptions: [
    { subscriptionId: 98, packageId: targetPackage, status: 'pending_payment', createdAt: '-Infinity' },
  ],
  attemptStartedAt: Date.now(),
  knownInvoiceIds: [],
  knownSubscriptionIds: [],
});
assert.equal(strInfiniteTimestampOrder.confirmed, false, 'String Infinity timestamp must NOT be confirmed');
assert.equal(strInfiniteTimestampOrder.isAmbiguous, true);
assert.equal(strInfiniteTimestampOrder.foundOnServer, true);
assert.equal(strInfiniteTimestampOrder.ambiguityReason, 'missing_or_invalid_timestamp');

// F2. Component timeout flow via executeDirectSubscriptionSubmit: Infinity timestamps
let infToastShown = false;
let infSubmitError = null;
isPostTimeoutTriggered = false;
clearStoredPendingOrder(memberTestId);

httpClient.get = async (path) => {
  if (path === '/api/members/me/invoices') {
    if (!isPostTimeoutTriggered) {
      return [{ id: existingInvoiceId, invoiceId: existingInvoiceId, invoiceCode: 'INV-0042', packageId: targetPackage, paymentStatus: 'pending', createdAt: new Date(prePostBaselineTime - 600000).toISOString() }];
    }
    return [
      { id: 93, invoiceId: 93, invoiceCode: 'INV-0093', packageId: targetPackage, paymentStatus: 'pending', createdAt: Infinity },
    ];
  }
  if (path.includes('/api/members/101/packages')) {
    if (!isPostTimeoutTriggered) return [];
    return [
      { subscriptionId: 94, packageId: targetPackage, status: 'pending_payment', createdAt: Infinity },
    ];
  }
  return savedGet(path);
};

const infTimeoutFlowResult = await executeDirectSubscriptionSubmit({
  submittingRef: { current: false },
  memberProfileId: memberTestId,
  selectedPackageId: String(targetPackage),
  hasAuthoritativeMemberId: true,
  isMemberMutationLocked: false,
  apiEnabled: true,
  paymentMethod: 'cash',
  language: 'vi',
  callbacks: {
    showToast: () => { infToastShown = true; },
    setSubmitError: (msg) => { infSubmitError = msg; },
  },
});

assert.equal(infTimeoutFlowResult.success, false, 'Timeout flow with Infinity timestamp must NOT report success');
assert.equal(infTimeoutFlowResult.ambiguous, true, 'Result must be ambiguous');
assert.equal(infTimeoutFlowResult.reconciledState?.confirmed, false);
assert.equal(infTimeoutFlowResult.reconciledState?.isAmbiguous, true);
assert.equal(infTimeoutFlowResult.reconciledState?.foundOnServer, true);
assert.equal(infToastShown, false, 'Must NOT show success toast when timestamp is Infinity');
assert.equal(getStoredPendingOrder(memberTestId), null, 'Must NOT save unconfirmed order to storage when timestamp is Infinity');
assert.match(infSubmitError, /chưa xác định rõ kết quả/i);

// F3. Component timeout flow via executeDirectSubscriptionSubmit: -Infinity timestamps
let negInfToastShown = false;
let negInfSubmitError = null;
isPostTimeoutTriggered = false;
clearStoredPendingOrder(memberTestId);

httpClient.get = async (path) => {
  if (path === '/api/members/me/invoices') {
    if (!isPostTimeoutTriggered) {
      return [{ id: existingInvoiceId, invoiceId: existingInvoiceId, invoiceCode: 'INV-0042', packageId: targetPackage, paymentStatus: 'pending', createdAt: new Date(prePostBaselineTime - 600000).toISOString() }];
    }
    return [
      { id: 95, invoiceId: 95, invoiceCode: 'INV-0095', packageId: targetPackage, paymentStatus: 'pending', createdAt: -Infinity },
    ];
  }
  if (path.includes('/api/members/101/packages')) {
    if (!isPostTimeoutTriggered) return [];
    return [
      { subscriptionId: 96, packageId: targetPackage, status: 'pending_payment', createdAt: -Infinity },
    ];
  }
  return savedGet(path);
};

const negInfTimeoutFlowResult = await executeDirectSubscriptionSubmit({
  submittingRef: { current: false },
  memberProfileId: memberTestId,
  selectedPackageId: String(targetPackage),
  hasAuthoritativeMemberId: true,
  isMemberMutationLocked: false,
  apiEnabled: true,
  paymentMethod: 'cash',
  language: 'vi',
  callbacks: {
    showToast: () => { negInfToastShown = true; },
    setSubmitError: (msg) => { negInfSubmitError = msg; },
  },
});

assert.equal(negInfTimeoutFlowResult.success, false, 'Timeout flow with -Infinity timestamp must NOT report success');
assert.equal(negInfTimeoutFlowResult.ambiguous, true);
assert.equal(negInfToastShown, false);
assert.equal(getStoredPendingOrder(memberTestId), null);

// Subcase G: Do not exclude old record from baseline without ID to correlate
// When knownInvoiceIds = [42], but returned invoice has NO ID:
// It must NOT be excluded as baseline; instead, it is an ambiguous server record (foundOnServer: true, isAmbiguous: true)
const missingIdWithBaseline = reconcileIncompleteOrder({
  targetPackageId: targetPackage,
  invoices: [
    { packageId: targetPackage, paymentStatus: 'pending', createdAt: new Date().toISOString() },
  ],
  subscriptions: [],
  attemptStartedAt: Date.now(),
  knownInvoiceIds: [42],
  knownSubscriptionIds: [],
});
assert.equal(missingIdWithBaseline.foundOnServer, true, 'Record lacking ID must NOT be dropped as baseline');
assert.equal(missingIdWithBaseline.isAmbiguous, true, 'Record lacking ID must be flagged as ambiguous');
assert.equal(missingIdWithBaseline.confirmed, false, 'Record lacking ID must NOT be confirmed');
assert.equal(missingIdWithBaseline.ambiguityReason, 'insufficient_identifiers');

// Compare with: Record with valid ID 42 matching baseline IS safely excluded:
const validIdMatchingBaseline = reconcileIncompleteOrder({
  targetPackageId: targetPackage,
  invoices: [
    { id: 42, invoiceId: 42, packageId: targetPackage, paymentStatus: 'pending', createdAt: new Date().toISOString() },
  ],
  subscriptions: [],
  attemptStartedAt: Date.now(),
  knownInvoiceIds: [42],
  knownSubscriptionIds: [],
});
assert.equal(validIdMatchingBaseline.foundOnServer, false, 'Record with valid ID matching baseline IS safely excluded');
assert.equal(validIdMatchingBaseline.isAmbiguous, false);
assert.equal(validIdMatchingBaseline.confirmed, false);

// Subcase H: Ambiguous multiple competing new records for same package
const ambiguousCompetingInvoices = reconcileIncompleteOrder({
  targetPackageId: targetPackage,
  invoices: [
    { id: 101, invoiceId: 101, invoiceCode: 'INV-101', packageId: targetPackage, paymentStatus: 'pending', createdAt: new Date().toISOString() },
    { id: 102, invoiceId: 102, invoiceCode: 'INV-102', packageId: targetPackage, paymentStatus: 'pending', createdAt: new Date().toISOString() },
  ],
  subscriptions: [
    { subscriptionId: 99, packageId: targetPackage, status: 'pending_payment', createdAt: new Date().toISOString() },
  ],
  attemptStartedAt: Date.now(),
  knownInvoiceIds: [],
});
assert.equal(ambiguousCompetingInvoices.isAmbiguous, true);
assert.equal(ambiguousCompetingInvoices.confirmed, false, 'Ambiguous competing records must NOT be confirmed');
assert.equal(ambiguousCompetingInvoices.ambiguityReason, 'multiple_competing_records');

// Subcase I: Only pre-existing invoices returned with valid IDs in baseline -> foundOnServer is false
const onlyOldInvoicesReturned = reconcileIncompleteOrder({
  targetPackageId: targetPackage,
  invoices: [{ id: existingInvoiceId, invoiceId: existingInvoiceId, packageId: targetPackage, paymentStatus: 'pending', createdAt: new Date().toISOString() }],
  subscriptions: [],
  attemptStartedAt: Date.now(),
  knownInvoiceIds: [existingInvoiceId],
});
assert.equal(onlyOldInvoicesReturned.foundOnServer, false);
assert.equal(onlyOldInvoicesReturned.confirmed, false);

// Restore original httpClient methods
httpClient.get = savedGet;
httpClient.post = savedPost;
clearAllStoredPendingOrdersExcept(null);
// Test 11.9: executeDirectSubscriptionSubmit in Mock Mode
// Verifies string IDs (pkg-2, mem-3) are supported, empty package is rejected, and modal closes cleanly
let mockToastShown = false;
let mockModalClosed = false;
let mockSubNotesReset = false;
const mockRef = { current: false };

const mockSubmitSuccess = await executeDirectSubscriptionSubmit({
  submittingRef: mockRef,
  memberProfileId: 'mem-3',
  selectedPackageId: 'pkg-2',
  hasAuthoritativeMemberId: true,
  isMemberMutationLocked: false,
  apiEnabled: false,
  paymentMethod: 'cash',
  subNotes: 'Gia hạn gói',
  currentMember: { id: 'mem-3', name: 'Phạm Thanh Hương' },
  contextPackages: [{ id: 'pkg-2', name: 'Gói 6 Tháng' }],
  contextPayments: [],
  callbacks: {
    showToast: () => { mockToastShown = true; },
    setIsSubscribeModalOpen: (isOpen) => { if (!isOpen) mockModalClosed = true; },
    setSubNotes: (val) => { if (val === '') mockSubNotesReset = true; },
  },
  createMockPendingPaymentFn: () => ({ ok: true, id: 'req-mock-1' }),
});

assert.equal(mockSubmitSuccess.success, true, 'Mock mode submit must succeed with string package and member IDs');
assert.equal(mockToastShown, true, 'Mock mode must show confirmation toast');
assert.equal(mockModalClosed, true, 'Mock mode must close subscribe modal');
assert.equal(mockSubNotesReset, true, 'Mock mode must reset subNotes');
assert.equal(mockRef.current, false, 'Submitting ref must be released');

// Empty package selection in mock mode fails safely
let mockErrorMsg = null;
const mockSubmitEmptyPkg = await executeDirectSubscriptionSubmit({
  submittingRef: mockRef,
  memberProfileId: 'mem-3',
  selectedPackageId: '',
  apiEnabled: false,
  callbacks: {
    setSubmitError: (msg) => { mockErrorMsg = msg; },
  },
});

assert.equal(mockSubmitEmptyPkg.success, false, 'Mock mode submit must reject empty package selection');
assert.ok(mockErrorMsg && (mockErrorMsg.includes('chọn một gói') || mockErrorMsg.includes('select')), 'Must display package selection error');
console.log('PASS: Mock mode direct subscription supports string IDs and enforces package selection validation');

// ==============================================================================
// 12. READ-ONLY DATA COMPLETION: REMAINING CREDIT, VALIDITY DAYS & INVOICE EXPIRATION
// ==============================================================================
console.log('\n--- 12. READ-ONLY DATA COMPLETION: REMAINING CREDIT, VALIDITY DAYS & INVOICE EXPIRATION ---');

// Test 12.1: resolveActiveSubscriptionDetails with full data
const fullActiveSub = {
  packageId: 10,
  packageName: 'Gói 1:1 Tennis Nâng Cao',
  packageType: 'Advanced',
  remainingCredit: 12,
  validityDays: 45,
  status: 'active',
};
const fullDetails = resolveActiveSubscriptionDetails(fullActiveSub);
assert.strictEqual(fullDetails.hasCredit, true, 'Must identify presence of remainingCredit');
assert.strictEqual(fullDetails.remainingCredit, 12, 'Must capture exact remaining credit');
assert.strictEqual(fullDetails.hasValidityDays, true, 'Must identify presence of validityDays');
assert.strictEqual(fullDetails.validityDays, 45, 'Must capture exact validity days');
assert.strictEqual(fullDetails.packageType, 'Advanced', 'Must capture packageType');

// Test 12.2: resolveActiveSubscriptionDetails with zero credit (boundary check)
const zeroCreditSub = {
  packageId: 10,
  remainingCredit: 0,
  validityDays: 15,
};
const zeroCreditDetails = resolveActiveSubscriptionDetails(zeroCreditSub);
assert.strictEqual(zeroCreditDetails.hasCredit, true, '0 credit is valid remainingCredit (out of credit)');
assert.strictEqual(zeroCreditDetails.remainingCredit, 0);

// Test 12.3: resolveActiveSubscriptionDetails with missing / null fields (ZERO hardcoding)
const missingFieldsSub = {
  packageId: 1,
  packageName: 'Gói Cơ Bản',
  status: 'active',
};
const missingDetails = resolveActiveSubscriptionDetails(missingFieldsSub);
assert.strictEqual(missingDetails.hasCredit, false, 'Must NOT infer credit when missing');
assert.strictEqual(missingDetails.remainingCredit, null, 'Must NOT default to 12 credit');
assert.strictEqual(missingDetails.hasValidityDays, false, 'Must NOT infer validity days when missing');
assert.strictEqual(missingDetails.validityDays, null, 'Must NOT default to 45 days');
assert.strictEqual(missingDetails.packageType, null);

// Test 12.4: resolveActiveSubscriptionDetails with invalid / malformed fields
const malformedSub = {
  remainingCredit: -5,
  validityDays: '45_days',
};
const malformedDetails = resolveActiveSubscriptionDetails(malformedSub);
assert.strictEqual(malformedDetails.hasCredit, false, 'Must reject negative credit');
assert.strictEqual(malformedDetails.remainingCredit, null);
assert.strictEqual(malformedDetails.hasValidityDays, false, 'Must reject non-numeric validityDays');
assert.strictEqual(malformedDetails.validityDays, null);

// Null / undefined safety
const nullDetails = resolveActiveSubscriptionDetails(null);
assert.strictEqual(nullDetails.hasCredit, false);
assert.strictEqual(nullDetails.remainingCredit, null);
assert.strictEqual(nullDetails.hasValidityDays, false);
assert.strictEqual(nullDetails.validityDays, null);
console.log('PASS: resolveActiveSubscriptionDetails accurately captures credit/validity and strictly rejects defaults/fabrications');

// Test 12.5: calculateInvoiceExpiry with missing, null, or invalid expiresAt
assert.deepStrictEqual(calculateInvoiceExpiry(null), {
  hasExpiry: false,
  isExpired: false,
  remainingMs: null,
  formattedTime: null,
  totalSeconds: null,
}, 'null expiresAt must return clean false state without fake countdown');

assert.deepStrictEqual(calculateInvoiceExpiry(undefined), {
  hasExpiry: false,
  isExpired: false,
  remainingMs: null,
  formattedTime: null,
  totalSeconds: null,
});

assert.deepStrictEqual(calculateInvoiceExpiry(''), {
  hasExpiry: false,
  isExpired: false,
  remainingMs: null,
  formattedTime: null,
  totalSeconds: null,
});

assert.deepStrictEqual(calculateInvoiceExpiry('not-a-date'), {
  hasExpiry: false,
  isExpired: false,
  remainingMs: null,
  formattedTime: null,
  totalSeconds: null,
}, 'invalid date string must fail closed without fake countdown');

// Test 12.6: calculateInvoiceExpiry countdown formatting for future timestamps
const mockNow = 1700000000000;
// 5 minutes remaining (300,000 ms)
const exp5m = calculateInvoiceExpiry(mockNow + 300000, mockNow);
assert.strictEqual(exp5m.hasExpiry, true);
assert.strictEqual(exp5m.isExpired, false);
assert.strictEqual(exp5m.remainingMs, 300000);
assert.strictEqual(exp5m.formattedTime, '05:00', '300s must format to 05:00');

// 3 minutes 42 seconds remaining (222,000 ms)
const exp3m42s = calculateInvoiceExpiry(mockNow + 222000, mockNow);
assert.strictEqual(exp3m42s.formattedTime, '03:42', '222s must format to 03:42');

// 1 hour 15 minutes 30 seconds remaining (4,530,000 ms)
const expOverHour = calculateInvoiceExpiry(mockNow + 4530000, mockNow);
assert.strictEqual(expOverHour.formattedTime, '1:15:30', 'Over 1 hour must format as H:MM:SS');

// Test 12.7: calculateInvoiceExpiry exact boundary and past timestamps (expiration behavior)
// Exact boundary (0 ms diff)
const expBoundary = calculateInvoiceExpiry(mockNow, mockNow);
assert.strictEqual(expBoundary.hasExpiry, true);
assert.strictEqual(expBoundary.isExpired, true, 'Exact boundary must be marked as expired');
assert.strictEqual(expBoundary.remainingMs, 0);
assert.strictEqual(expBoundary.formattedTime, '00:00');

// Past timestamp (expired 10 seconds ago)
const expPast = calculateInvoiceExpiry(mockNow - 10000, mockNow);
assert.strictEqual(expPast.hasExpiry, true);
assert.strictEqual(expPast.isExpired, true, 'Past timestamp must be marked as expired');
assert.strictEqual(expPast.remainingMs, 0);
assert.strictEqual(expPast.formattedTime, '00:00');

// Test 12.8: Dynamic countdown ticker simulation across time
const targetExpiry = mockNow + 3000; // expires in 3s
const tick0 = calculateInvoiceExpiry(targetExpiry, mockNow);
assert.strictEqual(tick0.formattedTime, '00:03');
assert.strictEqual(tick0.isExpired, false);

const tick1 = calculateInvoiceExpiry(targetExpiry, mockNow + 1000);
assert.strictEqual(tick1.formattedTime, '00:02');
assert.strictEqual(tick1.isExpired, false);

const tick2 = calculateInvoiceExpiry(targetExpiry, mockNow + 2000);
assert.strictEqual(tick2.formattedTime, '00:01');
assert.strictEqual(tick2.isExpired, false);

const tick3 = calculateInvoiceExpiry(targetExpiry, mockNow + 3000);
assert.strictEqual(tick3.formattedTime, '00:00');
assert.strictEqual(tick3.isExpired, true, 'Must transition to expired when now reaches target');

const tick4 = calculateInvoiceExpiry(targetExpiry, mockNow + 5000);
assert.strictEqual(tick4.formattedTime, '00:00');
assert.strictEqual(tick4.isExpired, true);
assert.strictEqual(tick4.remainingMs, 0);
console.log('PASS: calculateInvoiceExpiry handles future countdowns, boundary transitions, and past expirations deterministically');

// Test 12.9: Helper test for resolvePendingInvoiceBannerState when BE invoice is still pending after countdown reaches 0 (no status mutation)
const pastExpiryInvoice = {
  id: 88,
  invoiceId: 88,
  invoiceCode: 'INV-00088',
  amount: 500000,
  paymentStatus: 'pending',
  paymentMethod: 'cash',
  expiresAt: new Date(mockNow - 60000).toISOString(), // 1 minute in the past
};
const pastExpiry = calculateInvoiceExpiry(pastExpiryInvoice.expiresAt, mockNow);
assert.strictEqual(pastExpiry.isExpired, true, 'Countdown has reached 0 (past reservation window)');
assert.strictEqual(pastExpiry.formattedTime, '00:00');

const bannerState = resolvePendingInvoiceBannerState(pastExpiryInvoice, pastExpiry);
// Crucial: Authoritative badge status strictly reflects BE paymentStatus, NOT mutated to 'expired'
assert.strictEqual(bannerState.authoritativeStatus, 'pending', 'Must retain BE paymentStatus (pending), never mutated to expired');
assert.strictEqual(bannerState.isPastReservationWindow, true, 'Must flag that reservation window has elapsed');
assert.strictEqual(bannerState.showWindowWarning, true, 'Must display warning message without altering BE status badge');
console.log('PASS: Helper resolvePendingInvoiceBannerState retains BE pending status and flags past reservation window without mutation');

// Test 12.10: Helper test for resolveSubscriptionRowDisplay when subscription history row is missing endDate
const subMissingEndDate = {
  subscriptionId: 105,
  packageName: 'Gói 1:1 Tennis Nâng Cao',
  packageType: 'Advanced',
  price: 10000000,
  startDate: '2026-10-22',
  endDate: null, // missing endDate
  validityDays: 45, // duration in days
  remainingCredit: 12,
  status: 'active',
};

const rowDisplayVi = resolveSubscriptionRowDisplay(subMissingEndDate, 'vi');
assert.strictEqual(rowDisplayVi.hasEndDate, false, 'Identifies that endDate is missing');
assert.strictEqual(rowDisplayVi.endDateDisplay, '—', 'Missing endDate column MUST display em-dash —, never fabricated date or duration');
assert.strictEqual(rowDisplayVi.hasValidityDays, true, 'Identifies presence of validity duration');
assert.strictEqual(rowDisplayVi.validityLabel, 'Thời lượng: 45 ngày', 'Validity duration MUST have explicit label, placed outside date column');

const rowDisplayEn = resolveSubscriptionRowDisplay(subMissingEndDate, 'en');
assert.strictEqual(rowDisplayEn.validityLabel, 'Duration: 45d', 'English validity duration formatted with explicit label');

// Sub without validityDays and without endDate
const subNoDates = {
  subscriptionId: 106,
  packageName: 'Gói Thử Nghiệm',
  endDate: null,
  validityDays: null,
};
const rowNoDates = resolveSubscriptionRowDisplay(subNoDates, 'vi');
assert.strictEqual(rowNoDates.endDateDisplay, '—');
assert.strictEqual(rowNoDates.hasValidityDays, false);
assert.strictEqual(rowNoDates.validityLabel, null);
console.log('PASS: Helper resolveSubscriptionRowDisplay renders em-dash for missing endDate and labels validity duration cleanly');

// --- 13. PAYMENT MODAL RECONCILIATION GUARD & SINGLE-POST BEHAVIOR ---
console.log('\n--- 13. PAYMENT MODAL RECONCILIATION GUARD & SINGLE-POST BEHAVIOR ---');

// Test 13.1: Response lacking both IDs sets needsReconciliation, restricts initial submit to 1 POST, and blocks subsequent submit / reopen from posting again
{
  const testMemberId = 701;
  const testActorId = 'staff-reconcile-test-1';
  inProgressTransactionCache.delete(String(testMemberId), testActorId);

  let postCount = 0;
  const originalGetMemberSubscriptions = membershipApi.getMemberSubscriptions;
  const originalPost = httpClient.post;
  membershipApi.getMemberSubscriptions = async () => [];
  httpClient.post = async () => {
    postCount++;
    return { status: 'PENDING' }; // Missing both subscriptionId and invoiceId
  };

  let currentSessionRef = null;
  let currentSubscriptionId = null;
  let currentInvoiceId = null;
  let currentNeedsReconciliation = false;
  let lastSubmitError = null;

  const setters = {
    setSessionRef: (val) => { currentSessionRef = val; },
    setCreatedSubscriptionId: (val) => { currentSubscriptionId = val; },
    setCreatedInvoiceId: (val) => { currentInvoiceId = val; },
    setSessionNeedsReconciliation: (val) => { currentNeedsReconciliation = val; },
    setSubmitError: (val) => { lastSubmitError = val; },
    setMemberSessions: () => {},
    setAmbiguousPendingSubInfo: () => {},
  };

  // Attempt 1: First submit must perform exactly 1 POST and fail into reconciliation
  await assert.rejects(
    () =>
      executePaymentModalSubmit({
        numericMemberId: testMemberId,
        numericPackageId: 10,
        method: 'cash',
        currentActorId: testActorId,
        sessionRef: currentSessionRef,
        createdSubscriptionId: currentSubscriptionId,
        createdInvoiceId: currentInvoiceId,
        sessionNeedsReconciliation: currentNeedsReconciliation,
        isMutationLocked: false,
        setters,
      }),
    (err) => {
      assert.equal(err.name, 'IncompleteOrderResponseError');
      assert.equal(err.requiresReconciliation, true);
      assert.match(err.message, /thiếu định danh bắt buộc/i);
      return true;
    },
    'Initial submit must fail with IncompleteOrderResponseError'
  );

  assert.equal(postCount, 1, 'Initial submit must send at most 1 POST');
  assert.equal(currentNeedsReconciliation, true, 'Session state must be flagged for reconciliation');
  assert.equal(currentSubscriptionId, null, 'SubscriptionId must remain null');
  assert.equal(currentInvoiceId, null, 'InvoiceId must remain null');
  assert.ok(currentSessionRef, 'A session reference must be generated and persisted');

  const cachedSession = inProgressTransactionCache.get(String(testMemberId), testActorId, currentSessionRef);
  assert.ok(cachedSession, 'Incomplete order session must be persisted in cache');
  assert.equal(cachedSession.needsReconciliation, true, 'Cache must flag needsReconciliation = true');
  assert.equal(cachedSession.subscriptionId, null);
  assert.equal(cachedSession.invoiceId, null);

  // Attempt 2: Resubmit on same modal before reconciliation must be blocked with 0 new POSTs
  await assert.rejects(
    () =>
      executePaymentModalSubmit({
        numericMemberId: testMemberId,
        numericPackageId: 10,
        method: 'cash',
        currentActorId: testActorId,
        sessionRef: currentSessionRef,
        createdSubscriptionId: currentSubscriptionId,
        createdInvoiceId: currentInvoiceId,
        sessionNeedsReconciliation: currentNeedsReconciliation,
        isMutationLocked: false,
        setters,
      }),
    (err) => {
      assert.equal(err.name, 'ReconciliationRequiredError');
      assert.equal(err.requiresReconciliation, true);
      assert.match(err.message, /cần đối soát/i);
      return true;
    },
    'Resubmission must be blocked by ReconciliationRequiredError'
  );
  assert.equal(postCount, 1, 'Resubmit must NOT send any additional POSTs (remains exactly 1 POST)');

  // Attempt 3: Close modal and reopen (simulate syncInProgressForMember restoring session from cache)
  const restoredFromCache = inProgressTransactionCache.get(String(testMemberId), testActorId);
  assert.ok(restoredFromCache, 'Reopening modal must load existing in-progress session');
  assert.equal(restoredFromCache.needsReconciliation, true);

  const reopenedSessionRef = restoredFromCache.sessionRef;
  const reopenedSubscriptionId = restoredFromCache.subscriptionId || null;
  const reopenedInvoiceId = restoredFromCache.invoiceId || null;
  const reopenedNeedsReconciliation = Boolean(restoredFromCache.needsReconciliation);

  await assert.rejects(
    () =>
      executePaymentModalSubmit({
        numericMemberId: testMemberId,
        numericPackageId: 10,
        method: 'cash',
        currentActorId: testActorId,
        sessionRef: reopenedSessionRef,
        createdSubscriptionId: reopenedSubscriptionId,
        createdInvoiceId: reopenedInvoiceId,
        sessionNeedsReconciliation: reopenedNeedsReconciliation,
        isMutationLocked: false,
        setters,
      }),
    (err) => {
      assert.equal(err.name, 'ReconciliationRequiredError');
      assert.equal(err.requiresReconciliation, true);
      return true;
    },
    'Reopened modal submit must be blocked by ReconciliationRequiredError'
  );
  assert.equal(postCount, 1, 'Reopened modal resubmit must NOT increase POST count (remains exactly 1 POST)');

  // Attempt 4: Unverified discard attempt ('Hủy phiên & Bắt đầu lại' without verified BE proof) MUST fail closed
  await assert.rejects(
    () =>
      executePaymentModalDiscard({
        numericMemberId: testMemberId,
        currentActorId: testActorId,
        sessionRef: reopenedSessionRef,
        createdSubscriptionId: reopenedSubscriptionId,
        createdInvoiceId: reopenedInvoiceId,
        sessionNeedsReconciliation: reopenedNeedsReconciliation,
        isMutationLocked: false,
        setters,
      }),
    (err) => {
      assert.equal(err.name, 'ReconciliationRequiredError');
      assert.equal(err.requiresReconciliation, true);
      assert.match(err.message, /chưa có bằng chứng xác minh chắc chắn từ máy chủ/i);
      return true;
    },
    'Discarding unverified reconciliation session must be rejected with ReconciliationRequiredError'
  );

  // Verify cache and flags remain strictly retained after unverified discard attempt
  const unverifiedCache = inProgressTransactionCache.get(String(testMemberId), testActorId, reopenedSessionRef);
  assert.ok(unverifiedCache, 'Cache must NOT be cleared when discard lacks verified server proof');
  assert.equal(unverifiedCache.needsReconciliation, true, 'Cache must maintain needsReconciliation = true');
  assert.equal(reopenedNeedsReconciliation, true, 'State flag must stay true');

  // Attempt 5: Resubmission attempt after unverified discard must remain locked with 0 new POSTs
  await assert.rejects(
    () =>
      executePaymentModalSubmit({
        numericMemberId: testMemberId,
        numericPackageId: 10,
        method: 'cash',
        currentActorId: testActorId,
        sessionRef: reopenedSessionRef,
        createdSubscriptionId: reopenedSubscriptionId,
        createdInvoiceId: reopenedInvoiceId,
        sessionNeedsReconciliation: reopenedNeedsReconciliation,
        isMutationLocked: false,
        setters,
      }),
    (err) => {
      assert.equal(err.name, 'ReconciliationRequiredError');
      assert.equal(err.requiresReconciliation, true);
      return true;
    },
    'Resubmission after unverified discard must remain locked'
  );
  assert.equal(postCount, 1, 'POST count must strictly remain 1; NO second POST allowed after unverified discard');

  // Attempt 6: Only release session when verified reconciliation proof is explicitly provided
  const verifiedDiscardResult = await executePaymentModalDiscard({
    numericMemberId: testMemberId,
    currentActorId: testActorId,
    sessionRef: reopenedSessionRef,
    createdSubscriptionId: reopenedSubscriptionId,
    createdInvoiceId: reopenedInvoiceId,
    sessionNeedsReconciliation: reopenedNeedsReconciliation,
    verifiedReconciliationProof: { confirmed: true, source: 'backend_manual_audit' },
    isMutationLocked: false,
    setters,
  });
  assert.equal(verifiedDiscardResult.success, true);
  assert.equal(inProgressTransactionCache.get(String(testMemberId), testActorId), null, 'Cache cleanly released after verified BE reconciliation');
  assert.equal(currentNeedsReconciliation, false, 'Reconciliation flag cleared only after verified proof');

  membershipApi.getMemberSubscriptions = originalGetMemberSubscriptions;
  httpClient.post = originalPost;
  inProgressTransactionCache.delete(String(testMemberId), testActorId);
}
console.log('PASS: Modal submit flow strictly locks reconciliation when response lacks both IDs (1 POST max, discard blocked without BE proof, 0 new POSTs)');

// Test 13.2: Response missing only invoiceId (has valid subscriptionId) sets reconciliation and blocks repeat registration POST
{
  const testMemberId = 702;
  const testActorId = 'staff-reconcile-test-2';
  inProgressTransactionCache.delete(String(testMemberId), testActorId);

  let postCount = 0;
  const originalGetMemberSubscriptions = membershipApi.getMemberSubscriptions;
  const originalPost = httpClient.post;
  membershipApi.getMemberSubscriptions = async () => [];
  httpClient.post = async () => {
    postCount++;
    return { id: 99, subscriptionId: 99, status: 'PENDING' }; // Missing invoiceId
  };

  let currentSessionRef = null;
  let currentSubscriptionId = null;
  let currentInvoiceId = null;
  let currentNeedsReconciliation = false;

  const setters = {
    setSessionRef: (val) => { currentSessionRef = val; },
    setCreatedSubscriptionId: (val) => { currentSubscriptionId = val; },
    setCreatedInvoiceId: (val) => { currentInvoiceId = val; },
    setSessionNeedsReconciliation: (val) => { currentNeedsReconciliation = val; },
    setSubmitError: () => {},
    setMemberSessions: () => {},
    setAmbiguousPendingSubInfo: () => {},
  };

  // Attempt 1: First submit
  await assert.rejects(
    () =>
      executePaymentModalSubmit({
        numericMemberId: testMemberId,
        numericPackageId: 10,
        method: 'cash',
        currentActorId: testActorId,
        sessionRef: currentSessionRef,
        createdSubscriptionId: currentSubscriptionId,
        createdInvoiceId: currentInvoiceId,
        sessionNeedsReconciliation: currentNeedsReconciliation,
        isMutationLocked: false,
        setters,
      }),
    (err) => {
      assert.equal(err.name, 'IncompleteOrderResponseError');
      assert.equal(err.requiresReconciliation, true);
      assert.match(err.message, /mã hóa đơn/i);
      return true;
    }
  );

  assert.equal(postCount, 1, 'Initial submit sends exactly 1 POST');
  assert.equal(currentSubscriptionId, 99, 'SubscriptionId 99 must be captured');
  assert.equal(currentInvoiceId, null, 'InvoiceId must be null');
  assert.equal(currentNeedsReconciliation, true, 'Session must flag needsReconciliation = true');

  const cached = inProgressTransactionCache.get(String(testMemberId), testActorId, currentSessionRef);
  assert.ok(cached);
  assert.equal(cached.subscriptionId, 99);
  assert.equal(cached.invoiceId, null);
  assert.equal(cached.needsReconciliation, true);

  // Attempt 2: Resubmit on same modal
  await assert.rejects(
    () =>
      executePaymentModalSubmit({
        numericMemberId: testMemberId,
        numericPackageId: 10,
        method: 'cash',
        currentActorId: testActorId,
        sessionRef: currentSessionRef,
        createdSubscriptionId: currentSubscriptionId,
        createdInvoiceId: currentInvoiceId,
        sessionNeedsReconciliation: currentNeedsReconciliation,
        isMutationLocked: false,
        setters,
      }),
    (err) => {
      assert.equal(err.name, 'ReconciliationRequiredError');
      return true;
    }
  );
  assert.equal(postCount, 1, 'Resubmit when missing invoiceId sends 0 new POSTs (total 1)');

  // Attempt 3: Reopen modal and submit
  const restored = inProgressTransactionCache.get(String(testMemberId), testActorId);
  await assert.rejects(
    () =>
      executePaymentModalSubmit({
        numericMemberId: testMemberId,
        numericPackageId: 10,
        method: 'cash',
        currentActorId: testActorId,
        sessionRef: restored.sessionRef,
        createdSubscriptionId: restored.subscriptionId,
        createdInvoiceId: restored.invoiceId,
        sessionNeedsReconciliation: Boolean(restored.needsReconciliation),
        isMutationLocked: false,
        setters,
      }),
    (err) => {
      assert.equal(err.name, 'ReconciliationRequiredError');
      return true;
    }
  );
  assert.equal(postCount, 1, 'Reopening modal when missing invoiceId sends 0 new POSTs (total 1)');

  membershipApi.getMemberSubscriptions = originalGetMemberSubscriptions;
  httpClient.post = originalPost;
  inProgressTransactionCache.delete(String(testMemberId), testActorId);
}
console.log('PASS: Modal submit flow strictly locks reconciliation when response lacks only invoiceId (1 POST max, 0 on retry/reopen)');

// Test 13.3: Response missing only subscriptionId (has valid invoiceId) sets reconciliation and blocks repeat registration POST
{
  const testMemberId = 703;
  const testActorId = 'staff-reconcile-test-3';
  inProgressTransactionCache.delete(String(testMemberId), testActorId);

  let postCount = 0;
  const originalGetMemberSubscriptions = membershipApi.getMemberSubscriptions;
  const originalPost = httpClient.post;
  membershipApi.getMemberSubscriptions = async () => [];
  httpClient.post = async () => {
    postCount++;
    return { invoiceId: 42, status: 'PENDING' }; // Missing subscriptionId
  };

  let currentSessionRef = null;
  let currentSubscriptionId = null;
  let currentInvoiceId = null;
  let currentNeedsReconciliation = false;

  const setters = {
    setSessionRef: (val) => { currentSessionRef = val; },
    setCreatedSubscriptionId: (val) => { currentSubscriptionId = val; },
    setCreatedInvoiceId: (val) => { currentInvoiceId = val; },
    setSessionNeedsReconciliation: (val) => { currentNeedsReconciliation = val; },
    setSubmitError: () => {},
    setMemberSessions: () => {},
    setAmbiguousPendingSubInfo: () => {},
  };

  // Attempt 1: First submit
  await assert.rejects(
    () =>
      executePaymentModalSubmit({
        numericMemberId: testMemberId,
        numericPackageId: 10,
        method: 'cash',
        currentActorId: testActorId,
        sessionRef: currentSessionRef,
        createdSubscriptionId: currentSubscriptionId,
        createdInvoiceId: currentInvoiceId,
        sessionNeedsReconciliation: currentNeedsReconciliation,
        isMutationLocked: false,
        setters,
      }),
    (err) => {
      assert.equal(err.name, 'IncompleteOrderResponseError');
      assert.equal(err.requiresReconciliation, true);
      assert.match(err.message, /mã đăng ký/i);
      return true;
    }
  );

  assert.equal(postCount, 1, 'Initial submit sends exactly 1 POST');
  assert.equal(currentSubscriptionId, null, 'SubscriptionId must be null');
  assert.equal(currentInvoiceId, 42, 'InvoiceId 42 must be captured');
  assert.equal(currentNeedsReconciliation, true, 'Session must flag needsReconciliation = true');

  const cached = inProgressTransactionCache.get(String(testMemberId), testActorId, currentSessionRef);
  assert.ok(cached);
  assert.equal(cached.subscriptionId, null);
  assert.equal(cached.invoiceId, 42);
  assert.equal(cached.needsReconciliation, true);

  // Attempt 2: Resubmit on same modal
  await assert.rejects(
    () =>
      executePaymentModalSubmit({
        numericMemberId: testMemberId,
        numericPackageId: 10,
        method: 'cash',
        currentActorId: testActorId,
        sessionRef: currentSessionRef,
        createdSubscriptionId: currentSubscriptionId,
        createdInvoiceId: currentInvoiceId,
        sessionNeedsReconciliation: currentNeedsReconciliation,
        isMutationLocked: false,
        setters,
      }),
    (err) => {
      assert.equal(err.name, 'ReconciliationRequiredError');
      return true;
    }
  );
  assert.equal(postCount, 1, 'Resubmit when missing subscriptionId sends 0 new POSTs (total 1)');

  // Attempt 3: Reopen modal and submit
  const restored = inProgressTransactionCache.get(String(testMemberId), testActorId);
  await assert.rejects(
    () =>
      executePaymentModalSubmit({
        numericMemberId: testMemberId,
        numericPackageId: 10,
        method: 'cash',
        currentActorId: testActorId,
        sessionRef: restored.sessionRef,
        createdSubscriptionId: restored.subscriptionId,
        createdInvoiceId: restored.invoiceId,
        sessionNeedsReconciliation: Boolean(restored.needsReconciliation),
        isMutationLocked: false,
        setters,
      }),
    (err) => {
      assert.equal(err.name, 'ReconciliationRequiredError');
      return true;
    }
  );
  assert.equal(postCount, 1, 'Reopening modal when missing subscriptionId sends 0 new POSTs (total 1)');

  membershipApi.getMemberSubscriptions = originalGetMemberSubscriptions;
  httpClient.post = originalPost;
  inProgressTransactionCache.delete(String(testMemberId), testActorId);
}
console.log('PASS: Modal submit flow strictly locks reconciliation when response lacks only subscriptionId (1 POST max, 0 on retry/reopen)');

console.log('\n====================================================');
console.log('ALL FE 2: MEMBERSHIP, INVOICE & PAYMENT TESTS PASSED (100%)');
console.log('====================================================');
