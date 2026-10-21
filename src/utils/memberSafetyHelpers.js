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
 * Locks mutation in API mode unless VITE_TEST_HARNESS is explicitly set to 'true'.
 * Prevents unintended direct POST mutations to Render without BE confirmation of test profile permissions and sandbox configuration.
 */
export const isDirectSubscriptionLocked = (apiEnabled, harnessFlag) =>
  Boolean(apiEnabled && harnessFlag !== 'true');

/**
 * Validates preflight inputs for Member subscription before setting submitting state.
 * Returns failure immediately without setting submitting=true, preventing stuck UI states.
 * Keeps Member write disabled in API mode until BE confirms test account/profile permissions and sandbox configuration.
 */
export const validateDirectSubscriptionPreflight = ({
  memberProfileId,
  selectedPackageId,
  hasAuthoritativeMemberId,
  apiEnabled,
  harnessFlag,
  language = 'vi',
}) => {
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

  if (isDirectSubscriptionLocked(apiEnabled, harnessFlag)) {
    return {
      ok: false,
      error:
        language === 'vi'
          ? 'Thao tác đăng ký trực tuyến từ phía hội viên tạm thời bị khóa: Backend chưa xác nhận tài khoản/hồ sơ test được phép phát sinh giao dịch và cấu hình sandbox. Vui lòng thanh toán tại quầy Tiếp tân.'
          : 'Direct member subscription is locked: Waiting for Backend confirmation of test profile permissions and sandbox configuration. Please pay at the reception desk.',
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
 */
export const reconcileIncompleteOrder = ({
  targetPackageId,
  invoices = [],
  subscriptions = [],
}) => {
  const numPkgId = Number(targetPackageId);
  const matchingInvoice = Array.isArray(invoices)
    ? invoices.find((inv) => Number(inv.packageId) === numPkgId && (inv.paymentStatus === 'pending' || inv.paymentStatus === 'paid'))
    : null;

  const matchingSub = Array.isArray(subscriptions)
    ? subscriptions.find((sub) => Number(sub.packageId) === numPkgId && (sub.status === 'pending_payment' || sub.status === 'active' || sub.status === 'pending'))
    : null;

  if (matchingInvoice || matchingSub) {
    return {
      reconciled: true,
      foundOnServer: true,
      invoice: matchingInvoice || null,
      subscription: matchingSub || null,
      invoiceId: matchingInvoice?.id ?? matchingInvoice?.invoiceId ?? null,
      subscriptionId: matchingSub?.subscriptionId ?? matchingSub?.id ?? null,
    };
  }

  return {
    reconciled: true,
    foundOnServer: false,
    invoice: null,
    subscription: null,
    invoiceId: null,
    subscriptionId: null,
  };
};

/**
 * Storage helpers for persisting pending subscription orders across F5 session reloads.
 */
const PENDING_ORDER_STORAGE_KEY = 'scms_member_pending_order';

export const getStoredPendingOrder = () => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    const raw = window.sessionStorage.getItem(PENDING_ORDER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredPendingOrder = (order) => {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    if (!order) {
      window.sessionStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
    } else {
      window.sessionStorage.setItem(PENDING_ORDER_STORAGE_KEY, JSON.stringify(order));
    }
  } catch {}
};

export const clearStoredPendingOrder = () => setStoredPendingOrder(null);

/**
 * Evaluates whether PaymentModal mutations must remain locked.
 * Locks mutation in API mode unless VITE_TEST_HARNESS is explicitly set to 'true'.
 * Prevents unintended direct POST mutations to live backend without proper contract verification.
 */
export const isPaymentModalMutationLocked = (apiEnabled, harnessFlag) =>
  Boolean(apiEnabled && harnessFlag !== 'true');
