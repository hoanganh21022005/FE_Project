import { formatCurrency, formatDateTime } from '../../../locales/translations'

export const STATUS_LABELS = {
  successful: {
    vi: "Đã thanh toán",
    en: "Paid",
    style: "bg-emerald-50 text-emerald-700",
  },
  pending: {
    vi: "Chờ thanh toán",
    en: "Pending",
    style: "bg-amber-50 text-amber-800",
  },
  failed: {
    vi: "Thất bại",
    en: "Failed",
    style: "bg-rose-50 text-status-error",
  },
  cancelled: {
    vi: "Đã hủy",
    en: "Cancelled",
    style: "bg-slate-100 text-slate-600",
  },
  expired: {
    vi: "Hết hạn",
    en: "Expired",
    style: "bg-slate-100 text-slate-600",
  },
  reversed: {
    vi: "Đã hoàn tiền",
    en: "Refunded",
    style: "bg-violet-50 text-violet-700",
  },
}

export const formatMoney = (amount, isVi) => formatCurrency(amount, isVi ? 'vi' : 'en')
export const formatDate = (value, isVi) =>
  value
    ? formatDateTime(value, isVi ? 'vi' : 'en')
    : "—"

export const getLocalizedInvoiceStatus = (status, isVi) => {
  const value = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[ _-]+/g, "")
  if (
    ["successful", "success", "paid", "completed", "complete"].includes(value)
  )
    return STATUS_LABELS.successful[isVi ? "vi" : "en"]
  if (["pending", "awaitingpayment", "processing"].includes(value))
    return STATUS_LABELS.pending[isVi ? "vi" : "en"]
  if (["failed", "failure", "error"].includes(value))
    return STATUS_LABELS.failed[isVi ? "vi" : "en"]
  if (["cancelled", "canceled", "cancel"].includes(value))
    return STATUS_LABELS.cancelled[isVi ? "vi" : "en"]
  if (["expired", "timeout"].includes(value))
    return STATUS_LABELS.expired[isVi ? "vi" : "en"]
  if (["reversed", "refunded", "refund"].includes(value))
    return STATUS_LABELS.reversed[isVi ? "vi" : "en"]
  return isVi ? "Chưa rõ" : "Unknown"
}

export const getInvoiceStatusTone = (status) => {
  const value = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/[ _-]+/g, "")
  if (
    ["successful", "success", "paid", "completed", "complete"].includes(value)
  )
    return "emerald"
  if (
    [
      "pending",
      "awaitingpayment",
      "processing",
      "expired",
      "reconciliation",
    ].includes(value)
  )
    return "amber"
  if (["failed", "failure", "error"].includes(value)) return "rose"
  return "slate"
}

export const getPaymentMethodLabel = (invoice, isVi) => {
  const method = String(
    invoice?.paymentMethod || invoice?.rawPaymentMethod || "",
  )
    .trim()
    .toLowerCase()
  if (method.includes("cash") || method.includes("tiền mặt"))
    return isVi ? "Tiền mặt tại quầy" : "Cash at counter"
  if (
    method.includes("vnpay") ||
    method.includes("online") ||
    method.includes("qr")
  )
    return "VNPay / Online"
  return method ? (isVi ? "Khác" : "Other") : "—"
}

