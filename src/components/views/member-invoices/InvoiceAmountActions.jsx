import { ArrowUpRight, Receipt, Clock } from "lucide-react"
import { canOfferPaymentRetry, canRequestInvoiceReceipt } from "../../../utils/paymentReturnState"
import { formatMoney } from "./invoiceLabels"

export function InvoiceAmountActions({ invoice, isVi, actionProps, mobile = false }) {
  const {
    apiEnabled,
    payingId,
    cancellingId,
    isCash,
    onViewReceipt,
    onPayOnline,
    onCancel,
    isReturnInvoice,
  } = actionProps
  const pending = apiEnabled && invoice.paymentStatus === "pending"
  const canPay =
    pending &&
    !isCash &&
    canOfferPaymentRetry(invoice, { isReturnInvoice: isReturnInvoice(invoice) })
  return (
    <div
      className={`flex min-w-0 flex-wrap items-center gap-2 ${
        mobile
          ? "justify-between border-t border-slate-100 pt-3"
          : "justify-end"
      }`}
    >
      <strong className="whitespace-nowrap text-sm font-extrabold tabular-nums text-slate-900">
        {formatMoney(invoice.amount, isVi)}
      </strong>
      <button
        type="button"
        onClick={() => onViewReceipt(invoice)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      >
        <Receipt className="h-3.5 w-3.5 text-slate-500" />
        {canRequestInvoiceReceipt(invoice)
          ? isVi
            ? "Biên lai / Chi tiết"
            : "Receipt / Details"
          : isVi
            ? "Chi tiết hóa đơn"
            : "Invoice details"}
      </button>
      {pending && isCash && (
        <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800">
          <Clock className="h-3.5 w-3.5" />
          {isVi ? "Thanh toán tại quầy" : "Pay at reception"}
        </span>
      )}
      {canPay && (
        <button
          type="button"
          onClick={() => onPayOnline(invoice)}
          disabled={payingId === invoice.id}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-primary-hover disabled:opacity-60"
        >
          {payingId === invoice.id
            ? isVi
              ? "Đang chuyển..."
              : "Redirecting..."
            : isVi
              ? "Thanh toán"
              : "Pay now"}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      )}
      {pending && !isReturnInvoice(invoice) && (
        <button
          type="button"
          onClick={() => onCancel(invoice)}
          disabled={cancellingId === invoice.id}
          className="rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
        >
          {cancellingId === invoice.id
            ? isVi
              ? "Đang hủy..."
              : "Cancelling..."
            : isVi
              ? "Hủy"
              : "Cancel"}
        </button>
      )}
    </div>
  )
}
