const PAID_STATUSES = new Set(["successful", "paid"])

export function getPaymentReturnState({ invoice, loading = false, error = "" } = {}) {
  if (loading) return "checking"
  if (error || !invoice) return "unverified"

  const status = String(invoice.paymentStatus || "").trim().toLowerCase()
  if (PAID_STATUSES.has(status)) {
    return invoice.reconciliationRequired ? "reconciliation" : "paid"
  }
  if (status === "pending") return "pending"
  if (status === "expired") return "expired"
  if (status === "failed") return "failed"
  if (status === "cancelled" || status === "canceled") return "cancelled"
  if (status === "reversed" || status === "refunded") return "refunded"
  return "unverified"
}

export function canRequestInvoiceReceipt(invoice) {
  return PAID_STATUSES.has(
    String(invoice?.paymentStatus || "").trim().toLowerCase(),
  )
}

export function canOfferPaymentRetry(invoice, { isReturnInvoice = false } = {}) {
  if (isReturnInvoice || invoice?.paymentStatus !== "pending") return false
  if (invoice?.paymentMethod === "cash") return false
  if (invoice?.reconciliationRequired) return false

  if (!invoice?.expiresAt) return true
  const expiresAt = new Date(invoice.expiresAt).getTime()
  return !Number.isFinite(expiresAt) || expiresAt > Date.now()
}
