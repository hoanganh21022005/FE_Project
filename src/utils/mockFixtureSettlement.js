/**
 * FE 2 Mock Fixture Settlement Store
 *
 * Provides an FE 2-owned fixture settlement manager for local UI demo mode.
 * Solves the issue where confirming a pending mock payment previously prepended
 * a duplicate transaction via recordPayment while leaving the pending row untouched.
 *
 * Settle actions update the original fixture in-place to 'successful' status,
 * persist to sessionStorage (surviving F5 reloads), prevent duplicate confirmations,
 * and notify subscribed views.
 */

const SETTLED_STORAGE_KEY = 'fe2_mock_settled_payments_v1';
const CREATED_STORAGE_KEY = 'fe2_mock_pending_payments_v1';

// Listeners for in-memory updates within the current session
const listeners = new Set();

function notifyListeners() {
  listeners.forEach((fn) => {
    try { fn(); } catch (err) { console.warn('[FE2 Fixture Settlement] Listener error:', err); }
  });
}

function getCreatedPayments() {
  if (typeof window === 'undefined' || !window.sessionStorage) return [];
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(CREATED_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[FE2 Fixture Settlement] Could not parse pending payments:', err);
    return [];
  }
}

/** Creates one local pending request for the member and package. No payment is recorded. */
export function createMockPendingPayment({ member, pkg, method, notes, requestedStartDate, isRenewal }, existingPayments = []) {
  if (!member?.id || !pkg?.id) return { ok: false, error: 'Vui lòng chọn hội viên và gói dịch vụ.' };
  const allPayments = applyMockPaymentSettlements(existingPayments);
  if (allPayments.some((p) => String(p.memberId) === String(member.id)
    && String(p.packageId) === String(pkg.id)
    && String(p.status || p.paymentStatus).toLowerCase() === 'pending')) {
    return { ok: false, error: 'Gói này đã có yêu cầu chờ thanh toán.' };
  }
  const id = `fe2-pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const item = {
    id, transactionNo: id.toUpperCase(), memberId: member.id, memberName: member.name,
    packageId: pkg.id, packageName: pkg.nameVi || pkg.name, amount: Number(pkg.price) || 0,
    method, status: 'pending', paymentStatus: 'pending', paymentDate: null,
    notes: notes || '', requestedStartDate: requestedStartDate || null,
    isRenewal: Boolean(isRenewal), startDate: null, endDate: null,
  };
  const created = getCreatedPayments();
  try {
    window.sessionStorage.setItem(CREATED_STORAGE_KEY, JSON.stringify([item, ...created]));
  } catch (err) {
    return { ok: false, error: 'Không thể lưu yêu cầu. Vui lòng thử lại.' };
  }
  notifyListeners();
  return { ok: true, item };
}

function getSettledMapFromStorage() {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return new Map();
  }
  try {
    const raw = window.sessionStorage.getItem(SETTLED_STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    return new Map(Object.entries(parsed));
  } catch (e) {
    console.warn('[FE2 Fixture Settlement] Could not parse stored settlements:', e);
    return new Map();
  }
}

function saveSettledMapToStorage(map) {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    const obj = Object.fromEntries(map.entries());
    window.sessionStorage.setItem(SETTLED_STORAGE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.warn('[FE2 Fixture Settlement] Could not persist settlements:', e);
  }
}

function getPaymentIdentifier(item) {
  if (!item) return null;
  return String(item.id ?? item.transactionNo ?? item.code ?? item.invoiceId ?? '');
}

function findSettledRecord(map, itemOrId) {
  if (!itemOrId || !map) return null;
  const idStr = typeof itemOrId === 'object' ? getPaymentIdentifier(itemOrId) : String(itemOrId);
  if (idStr && map.has(idStr)) return map.get(idStr);

  const rawId = typeof itemOrId === 'object' ? String(itemOrId.id || '') : String(itemOrId);
  const rawTxn = typeof itemOrId === 'object' ? String(itemOrId.transactionNo || '') : '';
  const rawCode = typeof itemOrId === 'object' ? String(itemOrId.code || '') : '';

  for (const settled of map.values()) {
    const sId = String(settled.id || '');
    const sTxn = String(settled.transactionNo || '');
    const sCode = String(settled.code || '');

    if (
      (rawId && (sId === rawId || sTxn === rawId || sCode === rawId)) ||
      (rawTxn && (sId === rawTxn || sTxn === rawTxn)) ||
      (rawCode && (sId === rawCode || sCode === rawCode))
    ) {
      return settled;
    }
  }
  return null;
}

/**
 * Checks if a mock payment item has already been settled in the current session.
 */
export function isMockPaymentSettled(item) {
  if (!item) return false;
  const map = getSettledMapFromStorage();
  return Boolean(findSettledRecord(map, item));
}

/**
 * Settles a pending mock payment fixture once in-place.
 * Prevents duplicate confirmations and returns the updated record.
 */
export function settleMockPaymentFixture(paymentItem, options = {}) {
  const id = getPaymentIdentifier(paymentItem);
  if (!id) {
    return { ok: false, error: 'Invalid payment item: missing identifier' };
  }

  const map = getSettledMapFromStorage();
  const existing = findSettledRecord(map, paymentItem);
  if (existing) {
    return {
      ok: false,
      error: 'Giao dịch này đã được xác nhận thu tiền trước đó.',
      item: existing,
    };
  }

  // Strictly validate input was in pending status
  const currentStatus = String(paymentItem.status || paymentItem.paymentStatus || '').toLowerCase();
  if (currentStatus !== 'pending') {
    return {
      ok: false,
      error: `Chỉ có thể xác nhận thu tiền cho giao dịch đang ở trạng thái pending (hiện tại: ${currentStatus || 'không xác định'}).`,
    };
  }

  const nowFormatted = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const settledRecord = {
    ...paymentItem,
    status: 'successful',
    paymentStatus: 'successful',
    paymentDate: paymentItem.paymentDate || nowFormatted,
    notes: options.notes || paymentItem.notes || 'Đã xác nhận thu tiền mặt tại quầy',
    receptionistName: options.receptionistName || 'Lễ tân',
    settledAt: nowFormatted,
    memberId: paymentItem.memberId,
    packageId: paymentItem.packageId,
    packageName: paymentItem.packageName,
    amount: Number(paymentItem.amount) || 0,
    startDate: options.startDate || paymentItem.startDate || null,
    endDate: options.endDate || paymentItem.endDate || null,
  };

  map.set(id, settledRecord);
  saveSettledMapToStorage(map);

  // Notify listeners to trigger UI updates
  notifyListeners();

  return { ok: true, item: settledRecord };
}

/**
 * Derives the active member profile in mock mode by reconciling settled fixture transactions.
 * When a receptionist settles a pending membership payment, this transitions the member's
 * membershipStatus from 'pending_payment' to 'active' and increments totalSpent once without
 * duplicate activation or double counting.
 *
 * If a payment for a different package is settled, the member's active package is switched
 * to that settled package. Start/end dates are only assigned if provided by an explicit fixture rule;
 * no fabricated hardcoded dates like 2026-12-31 are used.
 */
export function deriveMockMemberProfile(member, allPayments = []) {
  if (!member) return member;
  const settledMap = getSettledMapFromStorage();
  const createdForMember = getCreatedPayments().filter((p) => String(p.memberId) === String(member.id));
  const latestPending = createdForMember.find((p) => !findSettledRecord(settledMap, p));
  if (settledMap.size === 0 && !latestPending) return member;

  // Find all unique settlements belonging to this member
  const memberSettlements = [];
  for (const settled of settledMap.values()) {
    if (String(settled.memberId) === String(member.id)) {
      memberSettlements.push(settled);
    }
  }

  if (memberSettlements.length === 0 && !latestPending) return member;

  // Calculate additional total spent from unique settlements
  const additionalSpent = memberSettlements.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  // If member was pending_payment, transition to active
  const newStatus = memberSettlements.length > 0 ? 'active' : member.membershipStatus;

  // Reconcile package assignment from the latest settlement:
  // Must switch to the latest settled package (e.g. if member upgraded or paid for another package)
  const latestSettlement = memberSettlements[memberSettlements.length - 1];
  const latestPackage = latestPending || latestSettlement;
  const newPackageId = latestPackage?.packageId || member.currentPackageId;
  const newPackageName = latestPackage?.packageName || member.currentPackageName;
  const newMembershipType = latestPackage?.packageName || member.membershipType || member.currentPackageName;

  // Start date and end date: only set if explicitly defined on the settlement fixture or member,
  // do NOT invent fixed arbitrary dates like 2026-12-31.
  const newStartDate = latestSettlement?.startDate || member.startDate || null;
  const newEndDate = latestSettlement?.endDate || member.endDate || null;

  return {
    ...member,
    membershipStatus: latestPending ? 'pending_payment' : newStatus,
    currentPackageId: newPackageId,
    currentPackageName: newPackageName,
    membershipType: newMembershipType,
    startDate: newStartDate,
    endDate: newEndDate,
    totalSpent: (Number(member.totalSpent) || 0) + additionalSpent,
  };
}

/**
 * Maps a context payments array, overlaying settled fixture states.
 * Guarantees no duplicate records are introduced and settled items show 'successful'.
 */
export function applyMockPaymentSettlements(paymentsList) {
  if (!Array.isArray(paymentsList)) return [];
  const map = getSettledMapFromStorage();
  const existingIds = new Set(paymentsList.map(getPaymentIdentifier));
  const combined = [...getCreatedPayments().filter((item) => !existingIds.has(getPaymentIdentifier(item))), ...paymentsList];

  return combined.map((item) => {
    const settled = findSettledRecord(map, item);
    if (settled) {
      return {
        ...item,
        ...settled,
        status: 'successful',
        paymentStatus: 'successful',
      };
    }
    return item;
  });
}

/**
 * Subscribes a React component to settlement changes.
 */
export function subscribeMockSettlement(callback) {
  if (typeof callback === 'function') {
    listeners.add(callback);
    return () => listeners.delete(callback);
  }
  return () => {};
}

/**
 * Clears all mock settlements (for test resets).
 */
export function clearMockSettlements() {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.removeItem(SETTLED_STORAGE_KEY);
    window.sessionStorage.removeItem(CREATED_STORAGE_KEY);
  }
  notifyListeners();
}
