import assert from "node:assert/strict"
import { invoiceApi } from "../src/api/invoiceApi.js"
import {
  acquireInvoiceVerificationLock,
  canStartVnpayVerification,
  getVerificationRetryAt,
  getVerificationSecondsRemaining,
  isCurrentPaymentReturnRequest,
  markAutomaticVerificationAttempt,
  normalizeVerificationStatus,
  releaseInvoiceVerificationLock,
  VNPAY_VERIFY_TIMEOUT_MS,
} from "../src/utils/paymentVerification.js"
import {
  canOfferPaymentRetry,
  canRequestInvoiceReceipt,
  getPaymentReturnState,
} from "../src/utils/paymentReturnState.js"

const originalFetch = globalThis.fetch
const calls = []
const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers({ "content-type": "application/json" }),
  json: async () => body,
  text: async () => JSON.stringify(body),
})

try {
  // TC01: verify endpoint is called with the invoice ID and empty JSON body.
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return jsonResponse({ verificationStatus: "NOT_CONFIRMED", invoice: { id: 42 } })
  }
  const response = await invoiceApi.verifyVnpay(42)
  assert.equal(response.verificationStatus, "NOT_CONFIRMED")
  assert.ok(calls[0].url.endsWith("/api/members/me/invoices/42/verify-vnpay"))
  assert.equal(calls[0].options.method, "POST")
  assert.equal(calls[0].options.body, "{}")
  assert.equal(calls[0].options.credentials, "include")
  assert.equal(calls[0].options.headers.get("Content-Type"), "application/json")

  // TC02-TC09: API verification statuses are retained verbatim and normalized only for UI logic.
  const statuses = [
    "VERIFIED_PAID", "ALREADY_PAID", "RETRY_LATER", "NOT_CONFIRMED",
    "QUERY_UNAVAILABLE", "ATTEMPT_MISSING", "DISABLED", "VERIFIED_ONLY", "NOT_APPLICABLE",
  ]
  for (const status of statuses) assert.equal(normalizeVerificationStatus(status.toLowerCase()), status)
  assert.equal(normalizeVerificationStatus(""), "UNKNOWN")

  // TC04: retryAfterSeconds produces a cooldown which expires at the correct time.
  const retryAt = getVerificationRetryAt(17, 1_000)
  assert.equal(retryAt, 18_000)
  assert.equal(getVerificationSecondsRemaining(retryAt, 1_001), 17)
  assert.equal(getVerificationSecondsRemaining(retryAt, 18_000), 0)

  // TC10: the production timeout is 60 seconds; a mocked abort checks timeout handling safely.
  assert.equal(VNPAY_VERIFY_TIMEOUT_MS, 60_000)
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })
  })
  await assert.rejects(() => invoiceApi.verifyVnpay(42, { timeoutMs: 5 }), /thời gian chờ/i)

  // TC11: duplicate clicks cannot acquire the same invoice lock twice.
  const inFlight = new Set()
  assert.equal(acquireInvoiceVerificationLock(inFlight, 42), true)
  assert.equal(acquireInvoiceVerificationLock(inFlight, 42), false)
  releaseInvoiceVerificationLock(inFlight, 42)
  assert.equal(acquireInvoiceVerificationLock(inFlight, 42), true)

  // TC12: a member-owned online invoice is eligible; a code, other role, cash invoice, or mock mode is not.
  const eligible = { id: 42, paymentMethod: "online" }
  const canVerify = (invoice, options = {}) => canStartVnpayVerification({
    invoice, role: "member", apiEnabled: true, ...options,
  })
  assert.equal(canVerify(eligible), true)
  assert.equal(canVerify({ id: "INV-42", paymentMethod: "online" }), false)
  assert.equal(canVerify({ id: 43, paymentMethod: "online" }, { role: "manager" }), false)
  assert.equal(canVerify({ id: 43, paymentMethod: "cash" }), false)
  assert.equal(canVerify(eligible, { apiEnabled: false }), false)

  // TC13-TC15: return URL never determines paid; reconciliation and receipt rules remain FE-PAY-01 rules.
  assert.equal(getPaymentReturnState({ invoice: { paymentStatus: "pending" } }), "pending")
  assert.equal(getPaymentReturnState({ invoice: { paymentStatus: "successful", reconciliationRequired: true } }), "reconciliation")
  assert.equal(canRequestInvoiceReceipt({ paymentStatus: "pending" }), false)
  assert.equal(canRequestInvoiceReceipt({ paymentStatus: "expired" }), false)
  assert.equal(canRequestInvoiceReceipt({ paymentStatus: "successful" }), true)

  // TC16-TC17: auto verification is at most once per Return; uncertain payment does not offer a second payment.
  const attempted = new Set()
  assert.equal(markAutomaticVerificationAttempt(attempted, "return-42"), true)
  assert.equal(markAutomaticVerificationAttempt(attempted, "return-42"), false)
  assert.equal(canOfferPaymentRetry({ paymentStatus: "pending", paymentMethod: "online" }, { isReturnInvoice: true }), false)
  assert.equal(canOfferPaymentRetry({ paymentStatus: "pending", paymentMethod: "online" }), true)

  // TC18: stale response guards reject updates after switching the tracked return invoice.
  assert.equal(isCurrentPaymentReturnRequest("invoice-42", "invoice-42"), true)
  assert.equal(isCurrentPaymentReturnRequest("invoice-42", "invoice-43"), false)

  // HTTP authorization/server failures remain errors and cannot be interpreted as a payment status.
  for (const status of [401, 403, 409, 500]) {
    globalThis.fetch = async () => jsonResponse({ message: "verification unavailable" }, status)
    await assert.rejects(() => invoiceApi.verifyVnpay(42))
  }

  // Invoice code is never accepted as the verify endpoint identifier.
  const countBeforeInvalidId = calls.length
  await assert.rejects(() => invoiceApi.verifyVnpay("INV-42"), /invoice ID/i)
  assert.equal(calls.length, countBeforeInvalidId)
  console.log("FE-PAY-02 mocked verification checks passed (TC01-TC18).")
} finally {
  globalThis.fetch = originalFetch
}
