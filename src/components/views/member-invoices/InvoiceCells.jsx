import { Copy, Check } from "lucide-react"
import { formatDate } from "./invoiceLabels"

export function InvoiceServiceCell({
  serviceName,
  invoiceCode,
  copiedKey,
  onCopy,
  invoice,
}) {
  const copyKey = `invoice-${invoice.id}`
  const copied = copiedKey === copyKey
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold text-slate-900">
        {serviceName}
      </p>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="truncate font-mono text-xs text-slate-500">
          {invoiceCode}
        </span>
        <button
          type="button"
          onClick={() => onCopy(invoiceCode, copyKey)}
          aria-label={copied ? "Copied" : "Copy invoice ID"}
          className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  )
}

export function InvoiceTimeCell({ invoice, isVi }) {
  return (
    <div className="min-w-0 text-xs">
      <p className="font-medium text-slate-700">
        {invoice.paymentDate ? formatDate(invoice.paymentDate, isVi) : "—"}
      </p>
      <p className="mt-1 text-slate-500">
        {isVi ? "Tạo" : "Created"}: {formatDate(invoice.createdAt, isVi)}
      </p>
    </div>
  )
}
