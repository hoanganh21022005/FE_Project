const TERMINAL_VERIFICATION_STATUSES = new Set([
  "VERIFIED_PAID",
  "ALREADY_PAID",
  "ATTEMPT_MISSING",
  "DISABLED",
  "VERIFIED_ONLY",
  "NOT_APPLICABLE",
])

export const VNPAY_VERIFY_TIMEOUT_MS = 60_000

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
