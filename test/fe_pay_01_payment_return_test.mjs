import assert from "node:assert/strict"
import {
  canOfferPaymentRetry,
  canRequestInvoiceReceipt,
  getPaymentReturnState,
} from "../src/utils/paymentReturnState.js"

// TC01: VNPay's status=00 is not input to the state decision; Backend Pending wins.
assert.equal(
  getPaymentReturnState({ invoice: { paymentStatus: "pending" } }),
  "pending",
)

// TC02: only the authoritative Paid invoice produces the Paid presentation.
assert.equal(
  getPaymentReturnState({ invoice: { paymentStatus: "successful" } }),
  "paid",
)

// TC03: Paid plus reconciliation is distinct and does not claim access activation.
assert.equal(
  getPaymentReturnState({
    invoice: { paymentStatus: "successful", reconciliationRequired: true },
  }),
  "reconciliation",
)

// TC04: receipt is unavailable for Pending/Expired and available only when Paid.
assert.equal(canRequestInvoiceReceipt({ paymentStatus: "pending" }), false)
assert.equal(canRequestInvoiceReceipt({ paymentStatus: "expired" }), false)
assert.equal(canRequestInvoiceReceipt({ paymentStatus: "successful" }), true)

// TC05: a returned Pending invoice must not offer another payment attempt.
assert.equal(
  canOfferPaymentRetry(
    { paymentStatus: "pending", paymentMethod: "online" },
    { isReturnInvoice: true },
  ),
  false,
)
assert.equal(
  canOfferPaymentRetry({ paymentStatus: "pending", paymentMethod: "online" }),
  true,
)

// TC06: missing invoice or failed detail request stays unverified, never Paid.
assert.equal(getPaymentReturnState(), "unverified")
assert.equal(
  getPaymentReturnState({ error: "invoice detail request failed" }),
  "unverified",
)

console.log("FE-PAY-01 payment return checks passed (TC01-TC06).")
