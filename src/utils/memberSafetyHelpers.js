/**
 * Production safety and identity helpers for Member subscription and payment workflows.
 * Guarantees strict profile ID separation, fail-closed reconciliation, and prevents
 * duplicate registration mutations or state pollution across role/account switches.
 */

/**
 * Extracts a verified positive integer profile ID (memberId or profileId) from an object.
 * Rejects non-integer, zero, negative, string, or boolean values.
 * Never infers memberId from userId.
 */
export const getAuthoritativeProfileId = (user) => {
  if (!user || typeof user !== 'object') return null;
  const rawId = user.memberId ?? user.profileId;
  if (typeof rawId === 'number' && Number.isInteger(rawId) && rawId > 0) {
    return rawId;
  }
  return null;
};

/**
 * Constructs the currentUser object for SCMSContext.
 * Explicitly preserves memberId when authoritative profile ID is provided by BE,
 * while keeping userId as id and never conflating the two.
 */
export const buildCurrentUser = (authUser, fallbackUser) => {
  if (!authUser) return fallbackUser;
  return {
    id: authUser.userId,
    memberId: getAuthoritativeProfileId(authUser),
    name: authUser.fullName,
    email: authUser.email,
    role: authUser.role,
    authorities: authUser.authorities || []
  };
};

/**
 * Resolves current member profile for MyMembershipView.
 * In API mode, strictly avoids falling back to contextMembers[0] to prevent
 * displaying another user's coach, code, or membership details.
 */
export const resolveCurrentMemberProfile = ({ currentUser, contextMembers = [], apiEnabled = false }) => {
  if (!apiEnabled) {
    const overrideId = (typeof window !== 'undefined' && window.sessionStorage)
      ? window.sessionStorage.getItem('scms_mock_member_id')
      : null;
    const targetId = overrideId || currentUser?.id;
    const matched = contextMembers.find(
      (m) => (targetId && String(m.id) === String(targetId)) ||
             (!overrideId && currentUser?.email && m.email === currentUser.email)
    );
    return matched || contextMembers[0] || { id: targetId, name: currentUser?.name || 'Hội viên' };
  }

  // In API mode: strictly match by validated memberId only.
  // NEVER compare currentUser.id (auth userId) against member profile m.id to prevent adopting foreign member data.
  const matched = (currentUser?.memberId && Array.isArray(contextMembers))
    ? contextMembers.find((m) => String(m.id) === String(currentUser.memberId))
    : null;

  if (matched) {
    return {
      id: matched.id,
      name: matched.name || currentUser?.name || 'Hội viên',
      email: matched.email || currentUser?.email || '',
      code: matched.code || '',
      coachName: matched.coachName || matched.primaryCoachName || '',
      primaryCoachName: matched.primaryCoachName || matched.coachName || '',
      currentPackageId: matched.currentPackageId ?? null,
    };
  }

  // Return authenticated account fields only without inventing a member code
  return {
    id: currentUser?.memberId ?? null,
    name: currentUser?.name || 'Hội viên',
    email: currentUser?.email || '',
    code: '',
    coachName: '',
    primaryCoachName: '',
    currentPackageId: null,
  };
};

/**
 * Resolves active subscription for MyMembershipView.
 * Strictly matches 'active' or 'grace_period' statuses.
 * NEVER labels pending, pending_payment, or expired subscriptions as active packages.
 */
export const resolveActiveSubscription = (subscriptions = [], apiEnabled = false) => {
  if (!apiEnabled) return null;
  if (!Array.isArray(subscriptions)) return null;
  return subscriptions.find((s) => s.status === 'active' || s.status === 'grace_period') || null;
};

/**
 * Evaluates whether direct Member subscription mutations must remain locked.
 * - Always locked (true) if target is Render backend (*.onrender.com), REGARDLESS of VITE_TEST_HARNESS.
 * - In non-Render API mode: locked unless VITE_TEST_HARNESS is explicitly set to 'true'.
 * - In mock mode (apiEnabled=false): unlocked for local mock fixtures.
 */
export const isRenderBackend = (target) => {
  if (!target) {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const proxyTarget = import.meta.env.VITE_API_PROXY_TARGET || '';
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
      return /onrender\.com/i.test(proxyTarget) || /onrender\.com/i.test(baseUrl);
    }
    return false;
  }
  if (typeof target === 'boolean') return target;
  if (typeof target === 'string') {
    return /onrender\.com/i.test(target);
  }
  if (typeof target === 'object') {
    if (target.isRender === true) return true;
    const url =
      target.targetUrl ||
      target.baseUrl ||
      target.url ||
      target.VITE_API_PROXY_TARGET ||
      target.VITE_API_BASE_URL ||
      '';
    return /onrender\.com/i.test(String(url));
  }
  return false;
};

export const isDirectSubscriptionLocked = (apiEnabled, harnessFlag, options = {}) => {
  if (!apiEnabled) return false;

  const isRender =
    isRenderBackend(options) ||
    (typeof import.meta !== 'undefined' &&
      isRenderBackend(import.meta.env?.VITE_API_PROXY_TARGET || import.meta.env?.VITE_API_BASE_URL));

  // HARD LOCK: Under no circumstances can VITE_TEST_HARNESS unlock POST to Render
  if (isRender) {
    return true;
  }

  return harnessFlag !== 'true';
};

/**
 * Validates preflight inputs for Member subscription form.
 * Checks selectedPackageId, positive integer package ID, and authoritative member profile ID.
 * Kept independent from backend mutation lock so that form validation can be verified in API mode
 * without prematurely triggering the mutation lock error.
 */
export const validateDirectSubscriptionPreflight = ({
  memberProfileId,
  selectedPackageId,
  hasAuthoritativeMemberId = true,
  language = 'vi',
}) => {
  if (!hasAuthoritativeMemberId || !memberProfileId) {
    return {
      ok: false,
      error:
        language === 'vi'
          ? 'Không tìm thấy ID hội viên đã xác thực từ phiên đăng nhập để thực hiện đăng ký.'
          : 'Authenticated member ID not found in session to perform subscription.',
    };
  }

  if (!selectedPackageId) {
    return {
      ok: false,
      error: language === 'vi' ? 'Vui lòng chọn một gói dịch vụ.' : 'Please select a membership package.',
    };
  }

  const numericPkgId = Number(selectedPackageId);
  if (!Number.isInteger(numericPkgId) || numericPkgId <= 0) {
    return {
      ok: false,
      error: language === 'vi' ? 'Mã gói dịch vụ không hợp lệ.' : 'Invalid package ID.',
    };
  }

  return {
    ok: true,
    numericPackageId: numericPkgId,
  };
};

/**
 * Reconciles existing subscriptions against a target package ID before POST.
 * Blocks duplicate active or pending registrations.
 */
export const reconcileAndVerifySubscriptionSafety = ({
  existingSubscriptions = [],
  targetPackageId,
  language = 'vi',
}) => {
  const numericPkgId = Number(targetPackageId);
  const subsList = Array.isArray(existingSubscriptions) ? existingSubscriptions : [];

  const duplicatePendingOrActive = subsList.find(
    (s) =>
      String(s.packageId) === String(numericPkgId) &&
      (s.status === 'active' || s.status === 'grace_period' || s.status === 'pending_payment' || s.status === 'pending')
  );

  if (duplicatePendingOrActive) {
    const subId = duplicatePendingOrActive.subscriptionId ?? duplicatePendingOrActive.id;
    const isPending = duplicatePendingOrActive.status === 'pending_payment' || duplicatePendingOrActive.status === 'pending';
    return {
      allowed: false,
      reason: isPending ? 'pending_exists' : 'active_exists',
      conflictingId: subId,
      error:
        language === 'vi'
          ? (isPending
              ? `Hội viên đã có bản ghi đăng ký gói này đang chờ thanh toán (#${subId}). Vui lòng hoàn tất thanh toán hóa đơn hoặc liên hệ quầy Lễ tân, không gửi đăng ký mới.`
              : `Hội viên hiện đang có gói này đang hoạt động (#${subId}). Không thể đăng ký trùng lặp.`)
          : (isPending
              ? `Pending subscription (#${subId}) already exists for this package. Please complete invoice payment or contact reception.`
              : `Active subscription (#${subId}) already exists for this package. Duplicate registration blocked.`),
    };
  }

  return { allowed: true };
};

/**
 * Reconciles an incomplete, timed-out, or ambiguous subscription order attempt against BE state.
 * Queries existing invoices and subscriptions to determine if the order was created on BE.
 * Strictly scopes reconciliation to the CURRENT attempt:
 * - Requires positive integer ID and valid timestamp evidence (does not treat records lacking ID or time proof as new).
 * - Excludes pre-existing records via knownInvoiceIds / knownSubscriptionIds baseline.
 * - Confirms order only when sufficient clear information is present; flags ambiguous states (e.g., competing records, missing identifiers) to keep safe state and prevent false success claims.
 */
export const reconcileIncompleteOrder = ({
  targetPackageId,
  invoices = [],
  subscriptions = [],
  attemptStartedAt = null,
  knownInvoiceIds = [],
  knownSubscriptionIds = [],
}) => {
  const numPkgId = Number(targetPackageId);
  const knownInvSet = new Set(
    (Array.isArray(knownInvoiceIds) ? knownInvoiceIds : []).map(String)
  );
  const knownSubSet = new Set(
    (Array.isArray(knownSubscriptionIds) ? knownSubscriptionIds : []).map(String)
  );

  const matchingInvoices = Array.isArray(invoices)
    ? invoices.filter((inv) => {
        if (!inv || typeof inv !== 'object') return false;
        const invPkgId = Number(inv.packageId);
        if (invPkgId !== numPkgId) return false;
        if (inv.paymentStatus !== 'pending' && inv.paymentStatus !== 'paid') return false;

        const invId = inv.id ?? inv.invoiceId;
        // 1. Mandatory ID evidence: record lacking valid positive integer ID is NOT new proof
        if (invId == null || !Number.isInteger(Number(invId)) || Number(invId) <= 0) {
          return false;
        }

        // 2. Exclude pre-existing invoices belonging to earlier attempts
        if (knownInvSet.size > 0 && knownInvSet.has(String(invId))) {
          return false;
        }

        // 3. Mandatory time evidence: if attempt baseline is set, record lacking time proof is NOT new
        if (attemptStartedAt != null) {
          const rawTime = inv.createdAt || inv.createdDate || inv.issueDate || inv.date;
          if (!rawTime) {
            return false;
          }
          const invTime = new Date(rawTime).getTime();
          if (Number.isNaN(invTime) || invTime < attemptStartedAt - 5000) {
            return false;
          }
        }

        return true;
      })
    : [];

  const matchingSubs = Array.isArray(subscriptions)
    ? subscriptions.filter((sub) => {
        if (!sub || typeof sub !== 'object') return false;
        const subPkgId = Number(sub.packageId);
        if (subPkgId !== numPkgId) return false;
        if (sub.status !== 'pending_payment' && sub.status !== 'active' && sub.status !== 'pending') return false;

        const subId = sub.subscriptionId ?? sub.id;
        // 1. Mandatory ID evidence
        if (subId == null || !Number.isInteger(Number(subId)) || Number(subId) <= 0) {
          return false;
        }

        // 2. Exclude pre-existing subscriptions belonging to earlier attempts
        if (knownSubSet.size > 0 && knownSubSet.has(String(subId))) {
          return false;
        }

        // 3. Mandatory time evidence
        if (attemptStartedAt != null) {
          const rawTime = sub.createdAt || sub.createdDate || sub.startDate;
          if (!rawTime) {
            return false;
          }
          const subTime = new Date(rawTime).getTime();
          if (Number.isNaN(subTime) || subTime < attemptStartedAt - 5000) {
            return false;
          }
        }

        return true;
      })
    : [];

  // Ambiguity check 1: Multiple competing new records for the same package
  if (matchingInvoices.length > 1 || matchingSubs.length > 1) {
    return {
      reconciled: true,
      foundOnServer: true,
      confirmed: false,
      isAmbiguous: true,
      ambiguityReason: 'multiple_competing_records',
      invoice: null,
      subscription: null,
      invoiceId: null,
      subscriptionId: null,
    };
  }

  const matchingInvoice = matchingInvoices[0] || null;
  const matchingSub = matchingSubs[0] || null;

  if (!matchingInvoice && !matchingSub) {
    return {
      reconciled: true,
      foundOnServer: false,
      confirmed: false,
      isAmbiguous: false,
      invoice: null,
      subscription: null,
      invoiceId: null,
      subscriptionId: null,
    };
  }

  const invId = matchingInvoice ? (matchingInvoice.id ?? matchingInvoice.invoiceId) : null;
  const subId = matchingSub ? (matchingSub.subscriptionId ?? matchingSub.id) : null;

  const hasValidInvId = invId != null && Number.isInteger(Number(invId)) && Number(invId) > 0;
  const hasValidSubId = subId != null && Number.isInteger(Number(subId)) && Number(subId) > 0;

  // Ambiguity check 2: Lacks sufficient confirmed identifiers
  if (!hasValidInvId && !hasValidSubId) {
    return {
      reconciled: true,
      foundOnServer: true,
      confirmed: false,
      isAmbiguous: true,
      ambiguityReason: 'insufficient_identifiers',
      invoice: matchingInvoice,
      subscription: matchingSub,
      invoiceId: null,
      subscriptionId: null,
    };
  }

  // Clear, non-ambiguous confirmed record found
  return {
    reconciled: true,
    foundOnServer: true,
    confirmed: true,
    isAmbiguous: false,
    invoice: matchingInvoice,
    subscription: matchingSub,
    invoiceId: hasValidInvId ? Number(invId) : null,
    subscriptionId: hasValidSubId ? Number(subId) : null,
  };
};

/**
 * Partitioned storage helpers for persisting pending subscription orders across F5 session reloads.
 * Uses member-scoped keys (scms_member_pending_order_${memberId}) to prevent cross-account
 * pending order leakage upon account switching.
 */
const PENDING_ORDER_BASE_KEY = 'scms_member_pending_order';

export const getPendingOrderStorageKey = (memberId) =>
  memberId ? `${PENDING_ORDER_BASE_KEY}_${memberId}` : `${PENDING_ORDER_BASE_KEY}_default`;

export const getStoredPendingOrder = (memberId) => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    const key = getPendingOrderStorageKey(memberId);
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (memberId && parsed?.memberId && String(parsed.memberId) !== String(memberId)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const setStoredPendingOrder = (memberIdOrOrder, maybeOrder) => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    let memberId = null;
    let order = null;
    if (maybeOrder !== undefined) {
      memberId = memberIdOrOrder;
      order = maybeOrder;
    } else {
      order = memberIdOrOrder;
      memberId = order?.memberId || null;
    }

    const key = getPendingOrderStorageKey(memberId);
    if (!order) {
      window.sessionStorage.removeItem(key);
    } else {
      const payloadWithMember = {
        ...order,
        memberId: memberId ?? order.memberId ?? null,
      };
      window.sessionStorage.setItem(key, JSON.stringify(payloadWithMember));
    }
  } catch {}
};

export const clearStoredPendingOrder = (memberId) => setStoredPendingOrder(memberId, null);

export const clearAllStoredPendingOrdersExcept = (currentMemberId) => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    const targetKey = currentMemberId ? getPendingOrderStorageKey(currentMemberId) : null;
    const keysToRemove = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith(PENDING_ORDER_BASE_KEY)) {
        if (targetKey && key === targetKey) {
          continue;
        }
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => window.sessionStorage.removeItem(k));
  } catch {}
};

/**
 * Evaluates whether PaymentModal mutations must remain locked.
 * - Always locked (true) if target is Render backend (*.onrender.com), REGARDLESS of VITE_TEST_HARNESS.
 * - In non-Render API mode: locked unless VITE_TEST_HARNESS is explicitly set to 'true'.
 * - In mock mode (apiEnabled=false): unlocked for local mock fixtures.
 */
export const isPaymentModalMutationLocked = (apiEnabled, harnessFlag, options = {}) => {
  if (!apiEnabled) return false;

  const isRender =
    isRenderBackend(options) ||
    (typeof import.meta !== 'undefined' &&
      isRenderBackend(import.meta.env?.VITE_API_PROXY_TARGET || import.meta.env?.VITE_API_BASE_URL));

  // HARD LOCK: Under no circumstances can VITE_TEST_HARNESS unlock POST to Render
  if (isRender) {
    return true;
  }

  return harnessFlag !== 'true';
};
