import assert from "node:assert/strict"
import { invoiceApi } from "../src/api/invoiceApi.js"
import {
  abortPendingVnpayVerification,
  executeVnpayVerification,
  getVerificationSecondsRemaining,
  hasAutomaticVnpayAttempt,
  isCurrentPaymentReturnRequest,
  clearAutomaticVnpayAttempt,
  restoreVnpayCooldown,
  storeAutomaticVnpayAttempt,
  storeVnpayCooldown,
  VNPAY_VERIFY_TIMEOUT_MS,
} from "../src/utils/paymentVerification.js"

class MemorySessionStorage {
  values = new Map()
  get length() { return this.values.size }
  key(index) { return [...this.values.keys()][index] ?? null }
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(String(key), String(value)) }
  removeItem(key) { this.values.delete(key) }
}

const storage = new MemorySessionStorage()
const originalFetch = globalThis.fetch

try {
  // TC01: RETRY_LATER persists only the expiry timestamp, namespaced by user and invoice.
  const retryAt = storeVnpayCooldown({
    userId: 101,
    invoiceId: 42,
    retryAfterSeconds: 30,
    now: 1_000,
    storage,
  })
  assert.equal(retryAt, 31_000)
  assert.equal(storage.length, 1)
  assert.equal(Number(storage.getItem(storage.key(0))), retryAt)

  // TC02: page reload restores the remaining cooldown for the same member invoice.
  assert.equal(restoreVnpayCooldown({ userId: 101, invoiceId: 42, now: 2_000, storage }), retryAt)
  assert.equal(getVerificationSecondsRemaining(retryAt, 2_000), 29)

  // TC03: expired cooldown is removed and a retry becomes eligible.
  assert.equal(restoreVnpayCooldown({ userId: 101, invoiceId: 42, now: 31_000, storage }), 0)
  assert.equal(storage.length, 0)

  // TC04: different invoices never share a cooldown.
  const invoice42 = storeVnpayCooldown({ userId: 101, invoiceId: 42, retryAfterSeconds: 12, now: 5_000, storage })
  storeVnpayCooldown({ userId: 101, invoiceId: 43, retryAfterSeconds: 40, now: 5_000, storage })
  assert.equal(restoreVnpayCooldown({ userId: 101, invoiceId: 42, now: 6_000, storage }), invoice42)
  assert.notEqual(
    restoreVnpayCooldown({ userId: 101, invoiceId: 43, now: 6_000, storage }),
    invoice42,
  )

  // TC05: different users never share a cooldown for the same invoice ID.
  storeVnpayCooldown({ userId: 202, invoiceId: 42, retryAfterSeconds: 55, now: 5_000, storage })
  assert.equal(restoreVnpayCooldown({ userId: 303, invoiceId: 42, now: 6_000, storage }), 0)

  // TC06: unavailable storage is best-effort; the returned in-memory deadline remains usable.
  const brokenStorage = {
    get length() { throw new Error("storage blocked") },
    getItem() { throw new Error("storage blocked") },
    setItem() { throw new Error("storage blocked") },
    removeItem() { throw new Error("storage blocked") },
    key() { throw new Error("storage blocked") },
  }
  assert.equal(storeVnpayCooldown({ userId: 101, invoiceId: 42, retryAfterSeconds: 8, now: 1_000, storage: brokenStorage }), 9_000)
  assert.equal(restoreVnpayCooldown({ userId: 101, invoiceId: 42, storage: brokenStorage }), 0)

  // TC07-TC10: cleanup aborts only the matching Return, and abort stays quiet with no retry.
  let requestCount = 0
  globalThis.fetch = (_url, options) => {
    requestCount += 1
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })
    })
  }
  const controller = new AbortController()
  const controllerRef = { current: { controller, requestKey: "user-101:invoice-42" } }
  const pendingVerify = executeVnpayVerification(
    42,
    (id, options) => invoiceApi.verifyVnpay(id, options),
    controller.signal,
  )
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(requestCount, 1)
  assert.equal(abortPendingVnpayVerification(controllerRef, "user-101:invoice-43"), false)
  assert.equal(controller.signal.aborted, false)
  assert.equal(abortPendingVnpayVerification(controllerRef, "user-101:invoice-42"), true)
  const abortedResult = await pendingVerify
  assert.deepEqual(abortedResult, { aborted: true, response: null })
  assert.equal(requestCount, 1)
  storeAutomaticVnpayAttempt({ userId: 101, invoiceId: 42, storage })
  assert.equal(hasAutomaticVnpayAttempt({ userId: 101, invoiceId: 42, storage }), true)
  assert.equal(hasAutomaticVnpayAttempt({ userId: 202, invoiceId: 42, storage }), false)
  clearAutomaticVnpayAttempt({ userId: 101, invoiceId: 42, storage })
  assert.equal(hasAutomaticVnpayAttempt({ userId: 101, invoiceId: 42, storage }), false)

  // TC11: response from the previous Return key cannot update the new invoice view.
  assert.equal(isCurrentPaymentReturnRequest("user-101:invoice-42", "user-101:invoice-43"), false)
  assert.equal(isCurrentPaymentReturnRequest("user-101:invoice-43", "user-101:invoice-43"), true)
  const unmountController = new AbortController()
  assert.equal(abortPendingVnpayVerification({ current: { controller: unmountController } }), true)
  assert.equal(unmountController.signal.aborted, true)

  // TC12: verify uses the 60-second default while an explicit short mock timeout still times out.
  assert.equal(VNPAY_VERIFY_TIMEOUT_MS, 60_000)
  globalThis.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })
  })
  await assert.rejects(() => invoiceApi.verifyVnpay(42, { timeoutMs: 5 }), /thời gian chờ/i)

  console.log("FE-PAY-03 cooldown and cancellation checks passed (TC01-TC12).")
} finally {
  globalThis.fetch = originalFetch
}
