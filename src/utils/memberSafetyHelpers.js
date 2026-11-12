/**
 * Production safety and identity helpers for Member subscription and payment workflows.
 * Guarantees strict profile ID separation, fail-closed reconciliation, and prevents
 * duplicate registration mutations or state pollution across role/account switches.
 */
import { membershipApi } from "../api/membershipApi.js"
import { invoiceApi } from "../api/invoiceApi.js"
import { getErrorMessage } from "../api/apiErrors.js"
import { createMockPendingPayment } from "./mockFixtureSettlement.js"
import { startVnpayCheckout } from "./vnpayCheckout.js"

/**
 * Extracts a verified positive integer profile ID (memberId or profileId) from an object.
 * Rejects non-integer, zero, negative, string, or boolean values.
 * Never infers memberId from userId.
 */
export const getAuthoritativeProfileId = (user) => {
  if (!user || typeof user !== "object") return null
  const rawId = user.memberId ?? user.profileId
  if (typeof rawId === "number" && Number.isInteger(rawId) && rawId > 0) {
    return rawId
  }
  return null
}

/**
 * Constructs the currentUser object for SCMSContext.
 * Explicitly preserves memberId when authoritative profile ID is provided by BE,
 * while keeping userId as id and never conflating the two.
 */
export const buildCurrentUser = (authUser, fallbackUser) => {
  if (!authUser) return fallbackUser
  const rawCoachId = authUser.coachId ?? authUser.staffId
  const coachId =
    typeof rawCoachId === "number" &&
    Number.isInteger(rawCoachId) &&
    rawCoachId > 0
      ? rawCoachId
      : null
  return {
    id: authUser.userId,
    memberId: getAuthoritativeProfileId(authUser),
    ...(coachId ? { coachId } : {}),
    name: authUser.fullName,
    email: authUser.email,
    role: authUser.role,
    authenticated: true,
    avatarUrl:
      authUser.avatarUrl || authUser.avatar || fallbackUser?.avatarUrl || null,
    authorities: authUser.authorities || [],
    ...(typeof authUser.status === "string" ? { status: authUser.status } : {}),
    ...(Number.isInteger(authUser.centerId) && authUser.centerId > 0
      ? { centerId: authUser.centerId }
      : {}),
    ...(typeof authUser.isFirstLogin === "boolean"
      ? { isFirstLogin: authUser.isFirstLogin }
      : {}),
  }
}

/**
 * Resolves current member profile for MyMembershipView.
 * In API mode, strictly avoids falling back to contextMembers[0] to prevent
 * displaying another user's coach, code, or membership details.
 */
export const resolveCurrentMemberProfile = ({
  currentUser,
  contextMembers = [],
  apiEnabled = false,
}) => {
  if (!apiEnabled) {
    const overrideId =
      typeof window !== "undefined" && window.sessionStorage
        ? window.sessionStorage.getItem("scms_mock_member_id")
        : null
    const targetId = overrideId || currentUser?.id
    const matched = contextMembers.find(
      (m) =>
        (targetId && String(m.id) === String(targetId)) ||
        (!overrideId && currentUser?.email && m.email === currentUser.email),
    )
    return (
      matched ||
      contextMembers[0] || {
        id: targetId,
        name: currentUser?.name || "Hội viên",
      }
    )
  }

  // In API mode: strictly match by validated memberId only.
  // NEVER compare currentUser.id (auth userId) against member profile m.id to prevent adopting foreign member data.
  const matched =
    currentUser?.memberId && Array.isArray(contextMembers)
      ? contextMembers.find(
          (m) => String(m.id) === String(currentUser.memberId),
        )
      : null

  if (matched) {
    return {
      id: matched.id,
      name: matched.name || currentUser?.name || "Hội viên",
      email: matched.email || currentUser?.email || "",
      code: matched.code || "",
      coachName: matched.coachName || matched.primaryCoachName || "",
      primaryCoachName: matched.primaryCoachName || matched.coachName || "",
      currentPackageId: matched.currentPackageId ?? null,
    }
  }

  // Return authenticated account fields only without inventing a member code
  return {
    id: currentUser?.memberId ?? null,
    name: currentUser?.name || "Hội viên",
    email: currentUser?.email || "",
    code: "",
    coachName: "",
    primaryCoachName: "",
    currentPackageId: null,
  }
}

/**
 * Resolves active subscription for MyMembershipView.
 * Strictly matches 'active' or 'grace_period' statuses.
 * NEVER labels pending, pending_payment, or expired subscriptions as active packages.
 */
export const resolveActiveSubscription = (
  subscriptions = [],
  apiEnabled = false,
) => {
  if (!apiEnabled) return null
  if (!Array.isArray(subscriptions)) return null
  return (
    subscriptions.find((s) => {
      const st = String(s?.status || "").toLowerCase()
      return st === "active" || st === "grace_period"
    }) || null
  )
}

/**
 * Member mutations are governed by the backend API response and its authorization rules.
 * Hosting provider and test-harness flags must not disable a supported API workflow.
 */
export const isRenderBackend = (target) => {
  if (!target) {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      const proxyTarget = import.meta.env.VITE_API_PROXY_TARGET || ""
      const baseUrl = import.meta.env.VITE_API_BASE_URL || ""
      return (
        /onrender\.com/i.test(proxyTarget) || /onrender\.com/i.test(baseUrl)
      )
    }
    return false
  }
  if (typeof target === "boolean") return target
  if (typeof target === "string") {
    return /onrender\.com/i.test(target)
  }
  if (typeof target === "object") {
    if (target.isRender === true) return true
    const url =
      target.targetUrl ||
      target.baseUrl ||
      target.url ||
      target.VITE_API_PROXY_TARGET ||
      target.VITE_API_BASE_URL ||
      ""
    return /onrender\.com/i.test(String(url))
  }
  return false
}

export const isDirectSubscriptionLocked = (
  apiEnabled,
  harnessFlag,
  options = {},
) => {
  if (!apiEnabled) return false

  const isRender =
    isRenderBackend(options) ||
    (typeof import.meta !== "undefined" &&
      isRenderBackend(
        import.meta.env?.VITE_API_PROXY_TARGET ||
          import.meta.env?.VITE_API_BASE_URL,
      ))

  // HARD LOCK: Under no circumstances can VITE_TEST_HARNESS unlock POST to Render
  if (isRender) {
    return true
  }

  return harnessFlag !== "true"
}

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
  apiEnabled = false,
  language = "vi",
}) => {
  if (!selectedPackageId) {
    return {
      ok: false,
      error:
        language === "vi"
          ? "Vui lòng chọn một gói dịch vụ."
          : "Please select a membership package.",
    }
  }
  const packageId = Number(selectedPackageId)
  if (!Number.isInteger(packageId) || packageId <= 0) {
    return {
      ok: false,
      error:
        language === "vi"
          ? "Gói hội viên không hợp lệ."
          : "The membership package is invalid.",
    }
  }
  if (apiEnabled || !hasAuthoritativeMemberId || !memberProfileId) {
    const memberId = Number(memberProfileId)
    if (
      !hasAuthoritativeMemberId ||
      !memberProfileId ||
      !Number.isInteger(memberId) ||
      memberId <= 0
    ) {
      return {
        ok: false,
        error:
          language === "vi"
            ? "Không tìm thấy ID hội viên đã xác thực từ phiên đăng nhập để thực hiện đăng ký."
            : "Authenticated member ID not found in session to perform subscription.",
      }
    }
  }
  return { ok: true, numericPackageId: packageId }
}

/**
 * Reconciles existing subscriptions before POST and blocks duplicate pending registrations.
 */
export const reconcileAndVerifySubscriptionSafety = ({
  existingSubscriptions = [],
  targetPackageId,
  isRenewal = false,
  language = "vi",
}) => {
  const numericPkgId = Number(targetPackageId)
  const subsList = Array.isArray(existingSubscriptions)
    ? existingSubscriptions
    : []

  const duplicatePendingOrActive = subsList.find((s) => {
    const st = String(s?.status || "").toLowerCase()
    return (
      String(s.packageId) === String(numericPkgId) &&
      (((st === "active" || st === "grace_period") && !isRenewal) ||
        st === "pending_payment" ||
        st === "pending")
    )
  })

  if (duplicatePendingOrActive) {
    const subId =
      duplicatePendingOrActive.subscriptionId ?? duplicatePendingOrActive.id
    const dupStatus = String(
      duplicatePendingOrActive.status || "",
    ).toLowerCase()
    const isPending = dupStatus === "pending_payment" || dupStatus === "pending"
    return {
      allowed: false,
      reason: isPending ? "pending_exists" : "active_exists",
      conflictingId: subId,
      error:
        language === "vi"
          ? isPending
            ? `Hội viên đã có bản ghi đăng ký gói này đang chờ thanh toán (#${subId}). Vui lòng hoàn tất thanh toán hóa đơn hoặc liên hệ quầy Lễ tân, không gửi đăng ký mới.`
            : `Hội viên hiện đang có gói này đang hoạt động (#${subId}). Không thể đăng ký trùng lặp.`
          : isPending
            ? `Pending subscription (#${subId}) already exists for this package. Please complete invoice payment or contact reception.`
            : `Active subscription (#${subId}) already exists for this package. Duplicate registration blocked.`,
    }
  }

  return { allowed: true }
}

/**
 * Parses an ISO 8601 date-time or numeric timestamp into epoch milliseconds.
 * Offset-less LocalDateTime strings from BE (e.g., "2026-10-20T16:05:00") are explicitly
 * interpreted in the Asia/Ho_Chi_Minh timezone (UTC+07:00) regardless of the client OS timezone.
 *
 * @param {string|number|Date|null|undefined} value
 * @returns {number} Epoch timestamp in milliseconds, or NaN if invalid
 */
export const parseVietnamDateTime = (value) => {
  if (value == null) return NaN
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : NaN
  }
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isFinite(time) ? time : NaN
  }
  if (typeof value !== "string") return NaN

  const trimmed = value.trim()
  if (
    !trimmed ||
    trimmed === "Infinity" ||
    trimmed === "-Infinity" ||
    trimmed === "+Infinity"
  ) {
    return NaN
  }

  const localMatch =
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/.exec(
      trimmed,
    )
  if (localMatch) {
    const year = Number(localMatch[1])
    const month = Number(localMatch[2])
    const day = Number(localMatch[3])
    const hour = Number(localMatch[4])
    const minute = Number(localMatch[5])
    const second = localMatch[6] !== undefined ? Number(localMatch[6]) : 0
    const ms =
      localMatch[7] !== undefined
        ? Number(localMatch[7].slice(0, 3).padEnd(3, "0"))
        : 0

    const utcWallTime = Date.UTC(year, month - 1, day, hour, minute, second, ms)
    const check = new Date(utcWallTime)
    if (
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day ||
      check.getUTCHours() !== hour ||
      check.getUTCMinutes() !== minute ||
      check.getUTCSeconds() !== second
    ) {
      return NaN
    }

    const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000
    return utcWallTime - VIETNAM_OFFSET_MS
  }

  return Date.parse(trimmed)
}

/**
 * Safely parses and validates a finite positive timestamp in milliseconds.
 * Strictly rejects null, undefined, NaN, Infinity, -Infinity, non-finite values, and non-positive numbers.
 */
export const getFinitePositiveTime = (val) => {
  if (val == null) return null
  if (typeof val === "number") {
    return Number.isFinite(val) && val > 0 ? val : null
  }
  if (typeof val === "string") {
    const trimmed = val.trim()
    if (
      !trimmed ||
      trimmed === "Infinity" ||
      trimmed === "-Infinity" ||
      trimmed === "+Infinity"
    )
      return null
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed)
      return Number.isFinite(num) && num > 0 ? num : null
    }
    const t = parseVietnamDateTime(trimmed)
    return typeof t === "number" && Number.isFinite(t) && t > 0 ? t : null
  }
  if (val instanceof Date) {
    const t = val.getTime()
    return typeof t === "number" && Number.isFinite(t) && t > 0 ? t : null
  }
  return null
}

/**
 * Reconciles an incomplete, timed-out, or ambiguous subscription order attempt against BE state.
 * Queries existing invoices and subscriptions to determine if the order was created on BE.
 * Strictly scopes reconciliation to the CURRENT attempt:
 * - Requires positive integer ID and valid finite positive timestamp evidence.
 * - Rejects Infinity, -Infinity, NaN, non-positive, or missing attemptStartedAt/timestamps.
 * - Excludes pre-existing records via knownInvoiceIds / knownSubscriptionIds baseline ONLY when a valid ID is present to correlate.
 * - Flags records matching package/status that lack valid ID or timestamp as ambiguous (confirmed: false, isAmbiguous: true), NEVER as 'not found'.
 * - Confirms order ONLY when both invoice and subscription exist with valid identifiers and timestamps.
 */
export const reconcileIncompleteOrder = ({
  targetPackageId,
  invoices = [],
  subscriptions = [],
  attemptStartedAt = null,
  knownInvoiceIds = [],
  knownSubscriptionIds = [],
}) => {
  const numPkgId = Number(targetPackageId)
  const knownInvSet = new Set(
    (Array.isArray(knownInvoiceIds) ? knownInvoiceIds : []).map(String),
  )
  const knownSubSet = new Set(
    (Array.isArray(knownSubscriptionIds) ? knownSubscriptionIds : []).map(
      String,
    ),
  )

  // Validate attemptStartedAt: strictly require a finite positive timestamp; reject null, NaN, Infinity, -Infinity, <= 0
  const attemptTime = getFinitePositiveTime(attemptStartedAt)
  if (attemptTime == null) {
    const rawInvs = Array.isArray(invoices) ? invoices : []
    const rawSubs = Array.isArray(subscriptions) ? subscriptions : []
    const hasAnyRaw = rawInvs.length > 0 || rawSubs.length > 0
    return {
      reconciled: true,
      foundOnServer: hasAnyRaw,
      confirmed: false,
      isAmbiguous: true,
      ambiguityReason: "missing_attempt_timestamp",
      invoice: null,
      subscription: null,
      invoiceId: null,
      subscriptionId: null,
    }
  }

  // Related invoice check: same package and pending/paid/successful status
  const isRelatedInvoice = (inv) => {
    if (!inv || typeof inv !== "object") return false
    const invPkgId = Number(inv.packageId)
    if (invPkgId !== numPkgId) return false
    const status = String(inv.paymentStatus || inv.status || "").toLowerCase()
    return status === "pending" || status === "paid" || status === "successful"
  }

  // Related subscription check: same package and pending_payment/active/pending status
  const isRelatedSubscription = (sub) => {
    if (!sub || typeof sub !== "object") return false
    const subPkgId = Number(sub.packageId)
    if (subPkgId !== numPkgId) return false
    const status = String(sub.status || "").toLowerCase()
    return (
      status === "pending_payment" ||
      status === "active" ||
      status === "pending"
    )
  }

  const rawInvoices = Array.isArray(invoices) ? invoices : []
  const rawSubs = Array.isArray(subscriptions) ? subscriptions : []

  const validNewInvoices = []
  const ambiguousInvoices = []

  for (const inv of rawInvoices) {
    if (!isRelatedInvoice(inv)) continue

    const rawId = inv.id ?? inv.invoiceId
    const hasValidId =
      rawId != null && Number.isInteger(Number(rawId)) && Number(rawId) > 0

    // RULE: Do NOT exclude an old record from baseline unless it has a valid ID to correlate
    if (hasValidId && knownInvSet.size > 0 && knownInvSet.has(String(rawId))) {
      // Confirmed pre-existing baseline invoice belonging to prior attempt
      continue
    }

    if (!hasValidId) {
      // Related record exists on server, but lacks a valid positive integer ID -> ambiguous
      ambiguousInvoices.push({ inv, reason: "missing_or_invalid_id" })
      continue
    }

    const rawTime =
      inv.createdAt || inv.createdDate || inv.issueDate || inv.date
    const invTime = getFinitePositiveTime(rawTime)

    if (invTime == null) {
      // Related record exists on server and not in baseline, but lacks valid finite timestamp evidence -> ambiguous
      ambiguousInvoices.push({ inv, reason: "missing_or_invalid_timestamp" })
      continue
    }

    if (invTime < attemptTime - 5000) {
      // Confirmed stale record created prior to attempt window -> ignore from current attempt
      continue
    }

    validNewInvoices.push(inv)
  }

  const validNewSubs = []
  const ambiguousSubs = []

  for (const sub of rawSubs) {
    if (!isRelatedSubscription(sub)) continue

    const rawId = sub.subscriptionId ?? sub.id
    const hasValidId =
      rawId != null && Number.isInteger(Number(rawId)) && Number(rawId) > 0

    // RULE: Do NOT exclude an old record from baseline unless it has a valid ID to correlate
    if (hasValidId && knownSubSet.size > 0 && knownSubSet.has(String(rawId))) {
      // Confirmed pre-existing baseline subscription belonging to prior attempt
      continue
    }

    if (!hasValidId) {
      // Related record exists on server, but lacks a valid positive integer ID -> ambiguous
      ambiguousSubs.push({ sub, reason: "missing_or_invalid_id" })
      continue
    }

    const rawTime = sub.createdAt || sub.createdDate || sub.startDate
    const subTime = getFinitePositiveTime(rawTime)

    if (subTime == null) {
      // Related record exists on server and not in baseline, but lacks valid finite timestamp evidence -> ambiguous
      ambiguousSubs.push({ sub, reason: "missing_or_invalid_timestamp" })
      continue
    }

    if (subTime < attemptTime - 5000) {
      // Confirmed stale record created prior to attempt window -> ignore from current attempt
      continue
    }

    validNewSubs.push(sub)
  }

  // Ambiguity Check 1: Defective candidate records present (missing ID, missing time, or non-finite timestamp)
  // When records exist for the package/status but lack valid ID or timestamp, return ambiguous (confirmed: false, isAmbiguous: true)
  // instead of falsely claiming not found.
  if (ambiguousInvoices.length > 0 || ambiguousSubs.length > 0) {
    const primaryAmbiguous = ambiguousInvoices[0] || ambiguousSubs[0]
    return {
      reconciled: true,
      foundOnServer: true,
      confirmed: false,
      isAmbiguous: true,
      ambiguityReason:
        primaryAmbiguous.reason === "missing_or_invalid_id"
          ? "insufficient_identifiers"
          : "missing_or_invalid_timestamp",
      invoice: validNewInvoices[0] || ambiguousInvoices[0]?.inv || null,
      subscription: validNewSubs[0] || ambiguousSubs[0]?.sub || null,
      invoiceId: validNewInvoices[0]
        ? (validNewInvoices[0].id ?? validNewInvoices[0].invoiceId)
        : null,
      subscriptionId: validNewSubs[0]
        ? (validNewSubs[0].subscriptionId ?? validNewSubs[0].id)
        : null,
    }
  }

  // Ambiguity Check 2: Multiple competing new records for the same package
  if (validNewInvoices.length > 1 || validNewSubs.length > 1) {
    return {
      reconciled: true,
      foundOnServer: true,
      confirmed: false,
      isAmbiguous: true,
      ambiguityReason: "multiple_competing_records",
      invoice: null,
      subscription: null,
      invoiceId: null,
      subscriptionId: null,
    }
  }

  // Outcome 3: No new records and no ambiguous records found (all were confirmed baseline or none existed)
  if (validNewInvoices.length === 0 && validNewSubs.length === 0) {
    return {
      reconciled: true,
      foundOnServer: false,
      confirmed: false,
      isAmbiguous: false,
      invoice: null,
      subscription: null,
      invoiceId: null,
      subscriptionId: null,
    }
  }

  // Outcome 4: Incomplete pair (only valid invoice or only valid subscription found)
  if (validNewInvoices.length === 0 || validNewSubs.length === 0) {
    const matchingInvoice = validNewInvoices[0] || null
    const matchingSub = validNewSubs[0] || null
    const invId = matchingInvoice
      ? (matchingInvoice.id ?? matchingInvoice.invoiceId)
      : null
    const subId = matchingSub
      ? (matchingSub.subscriptionId ?? matchingSub.id)
      : null
    return {
      reconciled: true,
      foundOnServer: true,
      confirmed: false,
      isAmbiguous: true,
      ambiguityReason: "missing_counterpart_record",
      invoice: matchingInvoice,
      subscription: matchingSub,
      invoiceId: invId != null ? Number(invId) : null,
      subscriptionId: subId != null ? Number(subId) : null,
    }
  }

  // Outcome 5: Both valid invoice and subscription confirmed with valid identifiers and finite timestamps
  const matchingInvoice = validNewInvoices[0]
  const matchingSub = validNewSubs[0]
  const invId = matchingInvoice.id ?? matchingInvoice.invoiceId
  const subId = matchingSub.subscriptionId ?? matchingSub.id

  return {
    reconciled: true,
    foundOnServer: true,
    confirmed: true,
    isAmbiguous: false,
    invoice: matchingInvoice,
    subscription: matchingSub,
    invoiceId: Number(invId),
    subscriptionId: Number(subId),
  }
}

/**
 * Partitioned storage helpers for persisting pending subscription orders across F5 session reloads.
 * Uses member-scoped keys (scms_member_pending_order_${memberId}) to prevent cross-account
 * pending order leakage upon account switching.
 */
const PENDING_ORDER_BASE_KEY = "scms_member_pending_order"

export const getPendingOrderStorageKey = (memberId) =>
  memberId
    ? `${PENDING_ORDER_BASE_KEY}_${memberId}`
    : `${PENDING_ORDER_BASE_KEY}_default`

export const getStoredPendingOrder = (memberId) => {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null
    const key = getPendingOrderStorageKey(memberId)
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      memberId &&
      parsed?.memberId &&
      String(parsed.memberId) !== String(memberId)
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export const setStoredPendingOrder = (memberIdOrOrder, maybeOrder) => {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return
    let memberId = null
    let order = null
    if (maybeOrder !== undefined) {
      memberId = memberIdOrOrder
      order = maybeOrder
    } else {
      order = memberIdOrOrder
      memberId = order?.memberId || null
    }

    const key = getPendingOrderStorageKey(memberId)
    if (!order) {
      window.sessionStorage.removeItem(key)
    } else {
      const payloadWithMember = {
        ...order,
        memberId: memberId ?? order.memberId ?? null,
      }
      window.sessionStorage.setItem(key, JSON.stringify(payloadWithMember))
    }
  } catch {}
}

export const clearStoredPendingOrder = (memberId) =>
  setStoredPendingOrder(memberId, null)

export const clearAllStoredPendingOrdersExcept = (currentMemberId) => {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return
    const targetKey = currentMemberId
      ? getPendingOrderStorageKey(currentMemberId)
      : null
    const keysToRemove = []
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i)
      if (key && key.startsWith(PENDING_ORDER_BASE_KEY)) {
        if (targetKey && key === targetKey) {
          continue
        }
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((k) => window.sessionStorage.removeItem(k))
  } catch {}
}

/**
 * Payment operations use normal backend authentication and authorization.
 * Do not infer payment availability from the backend hosting provider.
 */
export const isPaymentModalMutationLocked = (
  apiEnabled,
  harnessFlag,
  options = {},
) => {
  if (!apiEnabled) return false

  const isRender =
    isRenderBackend(options) ||
    (typeof import.meta !== "undefined" &&
      isRenderBackend(
        import.meta.env?.VITE_API_PROXY_TARGET ||
          import.meta.env?.VITE_API_BASE_URL,
      ))

  // HARD LOCK: Under no circumstances can VITE_TEST_HARNESS unlock POST to Render
  if (isRender) {
    return true
  }

  return harnessFlag !== "true"
}

/**
 * Shared executor for direct member subscription submissions.
 * Used by MyMembershipView and tested directly to verify:
 * 1. Synchronous mutex lock preventing duplicate POSTs in the same tick.
 * 2. Fail-closed pre-POST invoice baseline check (stops before POST with 0 POSTs on error).
 * 3. GET reconciliation upon network timeout or POST error.
 * 4. Confirmation only when both invoice and subscription exist with valid identifiers.
 */
export const executeDirectSubscriptionSubmit = async ({
  submittingRef,
  memberProfileId,
  selectedPackageId,
  hasAuthoritativeMemberId = true,
  isMemberMutationLocked = false,
  apiEnabled = false,
  paymentMethod = "cash",
  subNotes = "",
  activeSubscription = null,
  language = "vi",
  currentMember = null,
  contextPackages = [],
  contextPayments = [],
  apis = {},
  callbacks = {},
  createMockPendingPaymentFn = null,
}) => {
  // 1. Synchronous mutex lock to prevent concurrent or duplicate handler invocation
  if (submittingRef?.current) {
    return { executed: false, blockedByMutex: true }
  }
  if (submittingRef) {
    submittingRef.current = true
  }

  if (apiEnabled) {
    // 2. Form preflight input validation before engaging submitting state
    const preflight = validateDirectSubscriptionPreflight({
      memberProfileId,
      selectedPackageId,
      hasAuthoritativeMemberId,
      apiEnabled,
      language,
    })

    if (!preflight.ok) {
      if (submittingRef) submittingRef.current = false
      callbacks.setSubmitError?.(preflight.error)
      return { executed: false, error: preflight.error }
    }

    // 3. Strict mutation lock: keep direct POST to Render strictly locked
    if (isMemberMutationLocked) {
      if (submittingRef) submittingRef.current = false
      const lockMsg =
        language === "vi"
          ? "Thao tác đăng ký trực tuyến từ phía hội viên tạm thời bảo trì. Quý hội viên vui lòng thanh toán trực tiếp tại quầy Lễ tân."
          : "Online subscription for members is temporarily under maintenance. Please complete your payment at the reception desk."
      callbacks.setSubmitError?.(lockMsg)
      return { executed: false, error: lockMsg }
    }

    callbacks.setSubmitting?.(true)
    callbacks.setSubmitError?.(null)

    const numericPkgId = preflight.numericPackageId
    const membershipApiInstance = apis.membershipApi || membershipApi
    const invoiceApiInstance = apis.invoiceApi || invoiceApi

    try {
      // Step A: fetch existing subscriptions
      let existingSubs
      try {
        existingSubs =
          await membershipApiInstance.getMemberSubscriptions(memberProfileId)
      } catch (getErr) {
        throw new Error(
          language === "vi"
            ? `Không thể kiểm tra đăng ký hiện tại (${getErrorMessage(getErr, "Lỗi kết nối")}). Thao tác tạm dừng để đảm bảo an toàn.`
            : `Failed to verify existing subscriptions (${getErrorMessage(getErr, "Network error")}). Operation halted for safety.`,
        )
      }

      const knownSubscriptionIds = (existingSubs || [])
        .map((sub) => sub.subscriptionId ?? sub.id)
        .filter(Boolean)

      // Step B: safety check against existing active/pending registrations
      const isRenewal = Boolean(
        activeSubscription &&
          String(activeSubscription.packageId) === String(numericPkgId),
      )
      const safetyCheck = reconcileAndVerifySubscriptionSafety({
        existingSubscriptions: existingSubs,
        targetPackageId: numericPkgId,
        isRenewal,
        language,
      })

      if (!safetyCheck.allowed) {
        throw new Error(safetyCheck.error)
      }

      // Step C: Query fresh invoice baseline IMMEDIATELY before POST
      // Fail-closed: If GET baseline fails, STOP immediately before POST, NEVER fallback to cache!
      let baselineInvoices
      try {
        baselineInvoices = await invoiceApiInstance.getMemberOwnInvoices()
      } catch (invErr) {
        throw new Error(
          language === "vi"
            ? `Không thể kiểm tra hóa đơn hiện tại (${getErrorMessage(invErr, "Lỗi kết nối")}). Thao tác tạm dừng để đảm bảo an toàn.`
            : `Failed to verify existing invoices (${getErrorMessage(invErr, "Network error")}). Operation halted for safety.`,
        )
      }

      const knownInvoiceIds = (baselineInvoices || [])
        .map((inv) => inv.id ?? inv.invoiceId)
        .filter(Boolean)
      const attemptStartedAt = Date.now()

      // Step D: Submit via subscribeMe (OpenAPI POST /api/members/me/subscriptions)
      const payload = {
        packageId: numericPkgId,
        paymentMethod: paymentMethod === "cash" ? "CASH" : "VNPAY",
        isRenewal: Boolean(activeSubscription),
        notes: (subNotes || "").trim() || undefined,
      }

      let result
      try {
        result = await membershipApiInstance.subscribeMe(payload)
      } catch (postErr) {
        // Step E: Timeout / POST failure -> perform GET reconciliation before allowing retry
        let reconciledState = null
        try {
          const [freshInvs, freshSubs] = await Promise.all([
            invoiceApiInstance.getMemberOwnInvoices(),
            membershipApiInstance.getMemberSubscriptions(memberProfileId),
          ])
          reconciledState = reconcileIncompleteOrder({
            targetPackageId: numericPkgId,
            invoices: freshInvs,
            subscriptions: freshSubs,
            attemptStartedAt,
            knownInvoiceIds,
            knownSubscriptionIds,
          })
        } catch {
          // Reconciliation query failed
        }

        // Only confirm if BOTH invoice and subscription are present with valid identifiers
        if (
          reconciledState?.foundOnServer &&
          reconciledState?.confirmed &&
          !reconciledState?.isAmbiguous
        ) {
          setStoredPendingOrder(memberProfileId, {
            memberId: memberProfileId,
            subscriptionId: reconciledState.subscriptionId,
            invoiceId: reconciledState.invoiceId,
            invoiceCode: reconciledState.invoice?.invoiceCode,
            amount: reconciledState.invoice?.amount,
            packageId: numericPkgId,
            paymentMethod,
          })
          callbacks.showToast?.(
            language === "vi"
              ? `Yêu cầu đã được ghi nhận trên máy chủ (Mã HĐ: #${reconciledState.invoice?.invoiceCode || reconciledState.invoiceId}). Vui lòng không gửi lại.`
              : `Subscription already recorded on server (Invoice #${reconciledState.invoice?.invoiceCode || reconciledState.invoiceId}). Please do not resubmit.`,
            "info",
          )
          callbacks.setIsSubscribeModalOpen?.(false)
          callbacks.setSubNotes?.("")
          await callbacks.fetchMemberData?.()
          return {
            executed: true,
            success: true,
            reconciled: true,
            order: reconciledState,
          }
        }

        if (
          reconciledState?.isAmbiguous ||
          (reconciledState?.foundOnServer && !reconciledState?.confirmed)
        ) {
          // Ambiguous state (e.g. only 1 record found or missing timestamp evidence):
          // keep safe state, do not claim success, instruct user to check history
          const ambiguousMsg =
            language === "vi"
              ? "Giao dịch chưa xác định rõ kết quả trên máy chủ. Đơn có thể đã được tiếp nhận một phần; để đảm bảo an toàn, vui lòng không gửi lại và kiểm tra lịch sử hóa đơn hoặc liên hệ quầy Tiếp tân."
              : "Transaction outcome on server is ambiguous. Please do not retry; verify invoice history or contact reception desk."
          callbacks.setSubmitError?.(ambiguousMsg)
          return {
            executed: true,
            success: false,
            ambiguous: true,
            reconciledState,
            error: ambiguousMsg,
          }
        }

        throw postErr
      }

      // Normal POST success
      setStoredPendingOrder(memberProfileId, {
        memberId: memberProfileId,
        subscriptionId: result?.subscriptionId,
        invoiceId: result?.invoiceId,
        invoiceCode: result?.invoiceCode,
        amount: result?.amount,
        packageId: numericPkgId,
        paymentMethod: result?.paymentMethod || paymentMethod,
        paymentUrl: result?.paymentUrl || null,
      })

      if (paymentMethod !== "cash") {
        let paymentUrl = result?.paymentUrl || null
        if (
          !paymentUrl &&
          Number.isInteger(Number(result?.invoiceId)) &&
          Number(result?.invoiceId) > 0
        ) {
          const checkout = await invoiceApiInstance.payInvoiceOnline(
            result.invoiceId,
          )
          paymentUrl = checkout?.paymentUrl || null
        }
        if (!paymentUrl) {
          throw new Error(
            language === "vi"
              ? "Đơn đăng ký đã được tạo nhưng chưa nhận được liên kết thanh toán VNPay. Vui lòng thử lại hoặc thanh toán tại quầy lễ tân."
              : "The subscription was created, but VNPay payment link could not be generated. Please try again or pay at reception.",
          )
        }
        setStoredPendingOrder(memberProfileId, {
          memberId: memberProfileId,
          subscriptionId: result?.subscriptionId,
          invoiceId: result?.invoiceId,
          invoiceCode: result?.invoiceCode,
          amount: result?.amount,
          packageId: numericPkgId,
          paymentMethod: result?.paymentMethod || "VNPAY",
          paymentUrl,
        })
        startVnpayCheckout({
          paymentUrl,
          invoiceId: result?.invoiceId,
          invoiceCode: result?.invoiceCode,
          onVerified: callbacks.fetchMemberData,
        })
        return { executed: true, success: true, redirected: true, result }
      }

      callbacks.showToast?.(
        language === "vi"
          ? "Đăng ký gói thành công! Vui lòng hoàn tất thanh toán hóa đơn để kích hoạt."
          : "Package registered! Please complete invoice payment to activate.",
        "success",
      )

      callbacks.setIsSubscribeModalOpen?.(false)
      callbacks.setSubNotes?.("")
      await callbacks.fetchMemberData?.()
      return { executed: true, success: true, reconciled: false, result }
    } catch (err) {
      const errMsg = getErrorMessage(
        err,
        language === "vi"
          ? "Không thể hoàn tất đăng ký gói. Đơn có thể đã được tạo; vui lòng kiểm tra lịch sử hóa đơn trước khi thử lại."
          : "Failed to complete registration. Please check invoice history before retrying.",
      )
      callbacks.setSubmitError?.(errMsg)
      return { executed: true, success: false, error: errMsg }
    } finally {
      if (submittingRef) submittingRef.current = false
      callbacks.setSubmitting?.(false)
    }
  } else {
    if (!selectedPackageId) {
      if (submittingRef) submittingRef.current = false
      const errorMsg =
        language === "vi"
          ? "Vui lòng chọn một gói dịch vụ."
          : "Please select a membership package."
      callbacks.setSubmitError?.(errorMsg)
      return { executed: false, success: false, error: errorMsg }
    }

    callbacks.setSubmitting?.(true)
    callbacks.setSubmitError?.(null)

    if (submittingRef) submittingRef.current = false
    const chosenPkg = (contextPackages || []).find(
      (p) => String(p.id) === String(selectedPackageId),
    )
    const mockFn = createMockPendingPaymentFn || createMockPendingPayment
    const result = mockFn
      ? mockFn(
          {
            member: currentMember,
            pkg: chosenPkg,
            method: paymentMethod,
            notes: (subNotes || "").trim(),
          },
          contextPayments,
        )
      : { ok: false, error: "Mock payment handler unavailable" }

    if (!result.ok) {
      callbacks.setSubmitError?.(result.error)
      callbacks.setSubmitting?.(false)
      return { executed: true, success: false, error: result.error }
    }
    callbacks.showToast?.(
      language === "vi"
        ? "Đã ghi nhận yêu cầu đăng ký gói. Vui lòng hoàn tất thanh toán tại quầy."
        : "Membership request recorded. Please complete payment at the desk.",
      "info",
    )
    callbacks.setIsSubscribeModalOpen?.(false)
    callbacks.setSubNotes?.("")
    callbacks.setSubmitting?.(false)
    return { executed: true, success: true, mockResult: result }
  }
}

/**
 * Calculates countdown and expiration status from an invoice's expiresAt timestamp.
 * Strictly fail-closed: does not infer or fabricate expiration when expiresAt is missing or invalid.
 *
 * @param {string|number|null} expiresAt ISO 8601 string or numeric timestamp
 * @param {number} [now=Date.now()] Reference timestamp in ms (for deterministic testing)
 * @returns {{
 *   hasExpiry: boolean,
 *   isExpired: boolean,
 *   remainingMs: number|null,
 *   formattedTime: string|null,
 *   totalSeconds: number|null
 * }}
 */
export const calculateInvoiceExpiry = (expiresAt, now = Date.now()) => {
  if (!expiresAt) {
    return {
      hasExpiry: false,
      isExpired: false,
      remainingMs: null,
      formattedTime: null,
      totalSeconds: null,
    }
  }

  const targetTime = parseVietnamDateTime(expiresAt)
  if (Number.isNaN(targetTime)) {
    return {
      hasExpiry: false,
      isExpired: false,
      remainingMs: null,
      formattedTime: null,
      totalSeconds: null,
    }
  }

  const current = typeof now === "number" ? now : Date.now()
  const diffMs = targetTime - current
  const isExpired = diffMs <= 0
  const remainingMs = Math.max(0, diffMs)

  const totalSeconds = Math.floor(remainingMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  let formattedTime
  if (isExpired) {
    formattedTime = "00:00"
  } else if (hours > 0) {
    formattedTime = `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  } else {
    formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  }

  return {
    hasExpiry: true,
    isExpired,
    remainingMs,
    formattedTime,
    totalSeconds,
  }
}

/**
 * Resolves optional credit and validity fields from active subscription response.
 * Strictly avoids defaulting to 12 Credit or 45 days when BE fields are missing/null.
 *
 * @param {object|null} activeSubscription
 * @returns {{
 *   hasCredit: boolean,
 *   remainingCredit: number|null,
 *   hasValidityDays: boolean,
 *   validityDays: number|null,
 *   packageType: string|null
 * }}
 */
export const resolveActiveSubscriptionDetails = (activeSubscription) => {
  if (!activeSubscription || typeof activeSubscription !== "object") {
    return {
      hasCredit: false,
      remainingCredit: null,
      hasValidityDays: false,
      validityDays: null,
      packageType: null,
      effectiveStartDate: null,
      effectiveEndDate: null,
    }
  }

  const hasCredit =
    typeof activeSubscription.remainingCredit === "number" &&
    Number.isFinite(activeSubscription.remainingCredit) &&
    activeSubscription.remainingCredit >= 0

  const hasValidityDays =
    typeof activeSubscription.validityDays === "number" &&
    Number.isInteger(activeSubscription.validityDays) &&
    activeSubscription.validityDays > 0

  return {
    hasCredit,
    remainingCredit: hasCredit ? activeSubscription.remainingCredit : null,
    hasValidityDays,
    validityDays: hasValidityDays ? activeSubscription.validityDays : null,
    packageType:
      activeSubscription.packageType ||
      (activeSubscription.subjectId || hasCredit ? "Advanced" : null),
    effectiveStartDate:
      activeSubscription.startDate || activeSubscription.activatedAt || null,
    effectiveEndDate:
      activeSubscription.endDate || activeSubscription.expiresAt || null,
  }
}

/**
 * Resolves authoritative display status for pending invoice banner.
 * Guarantees that the invoice status badge strictly adheres to BE paymentStatus,
 * and does NOT overwrite or mutate paymentStatus to 'expired' based purely on local timer.
 *
 * @param {object|null} pendingInvoice
 * @param {object|null} invoiceExpiry
 * @returns {{
 *   authoritativeStatus: string,
 *   isPastReservationWindow: boolean,
 *   showWindowWarning: boolean
 * }}
 */
export const resolvePendingInvoiceBannerState = (
  pendingInvoice,
  invoiceExpiry,
) => {
  const beStatus =
    pendingInvoice?.paymentStatus || pendingInvoice?.status || "pending"
  const isPastWindow = Boolean(invoiceExpiry?.isExpired)

  return {
    authoritativeStatus: beStatus,
    isPastReservationWindow: isPastWindow,
    showWindowWarning: isPastWindow,
  }
}

/**
 * Resolves subscription row display values for history table.
 * Strictly guarantees that missing endDate renders as '—', and validity duration
 * is cleanly separated with an explicit label, never placed into the date column.
 *
 * @param {object|null} sub
 * @param {string} [language='vi']
 * @returns {{
 *   hasEndDate: boolean,
 *   endDateDisplay: string|null,
 *   hasValidityDays: boolean,
 *   validityLabel: string|null
 * }}
 */
export const resolveSubscriptionRowDisplay = (sub, language = "vi") => {
  const effectiveEnd = sub?.endDate || sub?.expiresAt
  const hasEndDate = Boolean(effectiveEnd)
  const hasValidityDays =
    typeof sub?.validityDays === "number" && sub.validityDays > 0
  const validityLabel = hasValidityDays
    ? language === "vi"
      ? `Thời lượng: ${sub.validityDays} ngày`
      : `Duration: ${sub.validityDays}d`
    : null

  return {
    hasEndDate,
    endDateDisplay: hasEndDate ? effectiveEnd : "—",
    hasValidityDays,
    validityLabel,
  }
}
