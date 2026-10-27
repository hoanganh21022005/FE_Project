const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "grace_period"])
const HISTORY_SUBSCRIPTION_STATUSES = new Set(["expired", "completed", "cancelled", "canceled", "revoked"])
const ACTIVE_ENROLLMENT_STATUSES = new Set(["registered", "active", "confirmed", "enrolled"])
const HISTORY_ENROLLMENT_STATUSES = new Set(["completed", "cancelled", "canceled", "withdrawn", "expired"])

const normalize = (value) => String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_")
const invoiceFor = (record, invoices) => {
  const id = record?.invoiceId
  return id == null ? null : invoices.find((invoice) => String(invoice.invoiceId ?? invoice.id) === String(id)) || null
}
const paymentAllowsUse = (record, invoices) => {
  const hasInvoiceReference = record?.invoiceId != null
  const invoice = invoiceFor(record, invoices)
  if (hasInvoiceReference && !invoice) return false
  if (invoice) return invoice.paymentStatus === "successful" && invoice.reconciliationRequired !== true
  const paymentStatus = normalize(record?.paymentStatus)
  if (paymentStatus && !["paid", "successful", "success", "completed"].includes(paymentStatus)) return false
  return true
}

export function partitionMemberMembershipData({ subscriptions = [], enrollments = [], invoices = [] }) {
  const usableSubscriptions = subscriptions.filter((item) =>
    ACTIVE_SUBSCRIPTION_STATUSES.has(normalize(item.status)) && paymentAllowsUse(item, invoices),
  )
  const historySubscriptions = subscriptions.filter((item) =>
    HISTORY_SUBSCRIPTION_STATUSES.has(normalize(item.status)),
  )
  const usableEnrollments = enrollments.filter((item) =>
    ACTIVE_ENROLLMENT_STATUSES.has(normalize(item.status)) && paymentAllowsUse(item, invoices),
  )
  const historyEnrollments = enrollments.filter((item) =>
    HISTORY_ENROLLMENT_STATUSES.has(normalize(item.status)),
  )
  const pendingInvoices = invoices.filter((item) => item.paymentStatus === "pending")
  const paidInvoices = invoices.filter((item) =>
    item.paymentStatus === "successful" && item.reconciliationRequired !== true,
  )
  return { usableSubscriptions, historySubscriptions, usableEnrollments, historyEnrollments, pendingInvoices, paidInvoices }
}
