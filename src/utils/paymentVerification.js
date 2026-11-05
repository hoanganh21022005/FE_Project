const TERMINAL_VERIFICATION_STATUSES = new Set([
  "VERIFIED_PAID",
  "ALREADY_PAID",
  "ATTEMPT_MISSING",
  "DISABLED",
  "VERIFIED_ONLY",
  "NOT_APPLICABLE",
])

export const VNPAY_VERIFY_TIMEOUT_MS = 60_000
const COOLDOWN_STORAGE_PREFIX = "scms:vnpay:verification-cooldown:v1:"
const AUTO_ATTEMPT_STORAGE_PREFIX = "scms:vnpay:auto-attempt:v1:"

function resolveCooldownStorage(storage) {
  if (storage !== undefined) return storage
  try {
    return typeof window === "undefined" ? null : window.sessionStorage
  } catch {
    return null
  }
}

function getCooldownStorageKey(userId, invoiceId) {
  const user = String(userId ?? "").trim()
  const invoice = String(invoiceId ?? "").trim()
  if (!user || !/^\d+$/.test(invoice) || Number(invoice) <= 0) return ""
  return `${COOLDOWN_STORAGE_PREFIX}${encodeURIComponent(user)}:${invoice}`
}

function getAutoAttemptStorageKey(userId, invoiceId) {
  const user = String(userId ?? "").trim()
  const invoice = String(invoiceId ?? "").trim()
  if (!user || !/^\d+$/.test(invoice) || Number(invoice) <= 0) return ""
  return `${AUTO_ATTEMPT_STORAGE_PREFIX}${encodeURIComponent(user)}:${invoice}`
}

export function hasAutomaticVnpayAttempt({ userId, invoiceId, storage } = {}) {
  const target = resolveCooldownStorage(storage)
  const key = getAutoAttemptStorageKey(userId, invoiceId)
  if (!target || !key) return false
  try {
    return target.getItem(key) === "1"
  } catch {
    return false
  }
}

export function storeAutomaticVnpayAttempt({ userId, invoiceId, storage } = {}) {
  const target = resolveCooldownStorage(storage)
  const key = getAutoAttemptStorageKey(userId, invoiceId)
  if (!target || !key) return
  try {
    target.setItem(key, "1")
  } catch {
    // The in-memory attempt guard remains active when storage is unavailable.
  }
}

export function clearAutomaticVnpayAttempt({ userId, invoiceId, storage } = {}) {
  const target = resolveCooldownStorage(storage)
  const key = getAutoAttemptStorageKey(userId, invoiceId)
  if (!target || !key) return
  try {
    target.removeItem(key)
  } catch {
    // Storage is best-effort only.
  }
}

export function clearExpiredVnpayCooldowns({ storage, now = Date.now() } = {}) {
  const target = resolveCooldownStorage(storage)
  if (!target) return
  try {
    for (let index = target.length - 1; index >= 0; index -= 1) {
      const key = target.key(index)
      if (!key?.startsWith(COOLDOWN_STORAGE_PREFIX)) continue
      const deadline = Number(target.getItem(key))
      if (!Number.isFinite(deadline) || deadline <= now) target.removeItem(key)
    }
  } catch {
    // Storage can be disabled or full; the Backend remains the rate-limit authority.
  }
}

export function storeVnpayCooldown({
  userId,
  invoiceId,
  retryAfterSeconds,
  now = Date.now(),
  storage,
} = {}) {
  const retryAt = getVerificationRetryAt(retryAfterSeconds, now)
  const target = resolveCooldownStorage(storage)
  const key = getCooldownStorageKey(userId, invoiceId)
  if (!retryAt || !target || !key) return retryAt
  clearExpiredVnpayCooldowns({ storage: target, now })
  try {
    target.setItem(key, String(retryAt))
  } catch {
    // Keep this attempt's in-memory deadline even if sessionStorage is unavailable.
  }
  return retryAt
}

export function restoreVnpayCooldown({
  userId,
  invoiceId,
  now = Date.now(),
  storage,
} = {}) {
  const target = resolveCooldownStorage(storage)
  const key = getCooldownStorageKey(userId, invoiceId)
  if (!target || !key) return 0
  clearExpiredVnpayCooldowns({ storage: target, now })
  try {
    const deadline = Number(target.getItem(key))
    if (!Number.isFinite(deadline) || deadline <= now) {
      target.removeItem(key)
      return 0
    }
    return deadline
  } catch {
    return 0
  }
}

export function clearVnpayCooldown({ userId, invoiceId, storage } = {}) {
  const target = resolveCooldownStorage(storage)
  const key = getCooldownStorageKey(userId, invoiceId)
  if (!target || !key) return
  try {
    target.removeItem(key)
  } catch {
    // Storage is best-effort only.
  }
}

export async function executeVnpayVerification(invoiceId, verify, signal) {
  if (signal?.aborted) return { aborted: true, response: null }
  try {
    const response = await verify(invoiceId, { signal })
    return signal?.aborted
      ? { aborted: true, response: null }
      : { aborted: false, response }
  } catch (error) {
    if (signal?.aborted || error?.name === "AbortError") {
      return { aborted: true, response: null }
    }
    throw error
  }
}

export function abortPendingVnpayVerification(controllerRef, requestKey) {
  const pending = controllerRef?.current
  if (!pending || (requestKey && pending.requestKey !== requestKey)) return false
  pending.controller.abort()
  return true
}

export function normalizeVerificationStatus(status) {
  const normalized = String(status || "").trim().toUpperCase()
  return normalized || "UNKNOWN"
}

export function getVerificationRetryAt(retryAfterSeconds, now = Date.now()) {
  const seconds = Number(retryAfterSeconds)
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  return now + Math.ceil(seconds) * 1000
}

export function getVerificationSecondsRemaining(retryAt, now = Date.now()) {
  const deadline = Number(retryAt)
  if (!Number.isFinite(deadline) || deadline <= now) return 0
  return Math.ceil((deadline - now) / 1000)
}

export function canStartVnpayVerification({
  invoice,
  role,
  apiEnabled,
  inFlight = false,
  retryAt = 0,
  verificationStatus = "",
  now = Date.now(),
} = {}) {
  const invoiceId = Number(invoice?.id)
  if (!apiEnabled || String(role || "").trim().toLowerCase() !== "member") return false
  if (!Number.isSafeInteger(invoiceId) || invoiceId <= 0) return false
  if (String(invoice?.paymentMethod || "").trim().toLowerCase() !== "online") return false
  if (inFlight || getVerificationSecondsRemaining(retryAt, now) > 0) return false
  if (TERMINAL_VERIFICATION_STATUSES.has(normalizeVerificationStatus(verificationStatus))) return false
  return true
}

export function isCurrentPaymentReturnRequest(requestKey, currentKey) {
  return Boolean(requestKey) && requestKey === currentKey
}

export function acquireInvoiceVerificationLock(inFlightInvoices, invoiceId) {
  const key = String(invoiceId || "")
  if (!key || inFlightInvoices.has(key)) return false
  inFlightInvoices.add(key)
  return true
}

export function releaseInvoiceVerificationLock(inFlightInvoices, invoiceId) {
  inFlightInvoices.delete(String(invoiceId || ""))
}

export function markAutomaticVerificationAttempt(attemptedRequests, requestKey) {
  if (!requestKey || attemptedRequests.has(requestKey)) return false
  attemptedRequests.add(requestKey)
  return true
}
