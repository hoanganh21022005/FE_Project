import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowUpRight,
  CreditCard,
  FileText,
  RefreshCw,
  Search,
  Wallet,
  Receipt,
  XCircle,
  Scale,
  X,
  CheckCircle2,
  Loader2,
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import { invoiceApi } from "../../api/invoiceApi"
import { formatInvoiceCode } from "../../api/invoiceMappers"
import { getErrorMessage } from "../../api/apiErrors"
import { applyMockPaymentSettlements } from "../../utils/mockFixtureSettlement"

const STATUS_LABELS = {
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
  failed: { vi: "Thất bại", en: "Failed", style: "bg-rose-50 text-status-error" },
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

const formatMoney = (amount, isVi) =>
  Number(amount || 0).toLocaleString(isVi ? "vi-VN" : "en-US", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  })
const formatDate = (value, isVi) =>
  value
    ? new Date(value).toLocaleString(isVi ? "vi-VN" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Ho_Chi_Minh",
      })
    : "—"

export function MemberInvoicesView() {
  const { language, apiEnabled, payments: mockPayments, showToast } = useSCMS()
  const isVi = language === "vi"
  const [invoices, setInvoices] = useState([])
  const [resolutions, setResolutions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [keyword, setKeyword] = useState("")
  const [payingId, setPayingId] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)

  // Receipt / Detail modal state
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [loadingReceipt, setLoadingReceipt] = useState(false)

  // Payment Resolution modal state
  const [resolutionModalInvoice, setResolutionModalInvoice] = useState(null)
  const [resolutionType, setResolutionType] = useState("RECONCILIATION")
  const [resolutionReason, setResolutionReason] = useState("")
  const [submittingResolution, setSubmittingResolution] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      if (apiEnabled) {
        const [invList, resList] = await Promise.all([
          invoiceApi.getMemberOwnInvoices(),
          invoiceApi.getPaymentResolutions().catch(() => []),
        ])
        setInvoices(invList)
        setResolutions(Array.isArray(resList) ? resList : [])
      } else {
        setInvoices(applyMockPaymentSettlements(mockPayments || []))
        setResolutions([])
      }
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          isVi ? "Không thể tải hóa đơn." : "Could not load invoices.",
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [apiEnabled, isVi, mockPayments])

  useEffect(() => {
    refresh()
  }, [refresh])

  const filtered = useMemo(() => {
    const term = keyword.trim().toLocaleLowerCase()
    return invoices
      .filter((invoice) => {
        const matchesStatus =
          statusFilter === "all" || invoice.paymentStatus === statusFilter
        const matchesText =
          !term ||
          [
            invoice.invoiceCode,
            invoice.code,
            formatInvoiceCode(invoice.id),
            invoice.packageName,
            invoice.className,
          ].some((value) =>
            String(value || "")
              .toLocaleLowerCase()
              .includes(term),
          )
        return matchesStatus && matchesText
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  }, [invoices, keyword, statusFilter])

  const totals = useMemo(
    () => ({
      count: invoices.length,
      paid: invoices
        .filter((invoice) => invoice.paymentStatus === "successful")
        .reduce((sum, invoice) => sum + (invoice.amount || 0), 0),
      pending: invoices.filter((invoice) => invoice.paymentStatus === "pending")
        .length,
    }),
    [invoices],
  )

  const payOnline = async (invoice) => {
    setPayingId(invoice.id)
    setError("")
    try {
      const result = await invoiceApi.payInvoiceOnline(invoice.id)
      if (!result.paymentUrl)
        throw new Error(
          isVi
            ? "Máy chủ chưa trả về liên kết thanh toán."
            : "The server did not return a payment link.",
        )
      window.location.assign(result.paymentUrl)
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          isVi ? "Không thể bắt đầu thanh toán." : "Could not start payment.",
        ),
      )
      setPayingId(null)
    }
  }

  const handleViewReceipt = async (invoice) => {
    setSelectedInvoice(invoice)
    if (!apiEnabled || !invoice?.id) return
    setLoadingReceipt(true)
    try {
      const detail = await invoiceApi
        .getInvoiceReceipt(invoice.id)
        .catch(() => invoiceApi.getMemberOwnInvoiceById(invoice.id))
      if (detail) setSelectedInvoice(detail)
    } catch {
      // keep existing invoice preview
    } finally {
      setLoadingReceipt(false)
    }
  }

  const handleCancelInvoice = async (invoice) => {
    if (!invoice?.id) return
    if (
      !window.confirm(
        isVi
          ? `Bạn có chắc chắn muốn hủy hóa đơn ${
              invoice.invoiceCode || formatInvoiceCode(invoice.id)
            } không?`
          : "Are you sure you want to cancel this pending invoice?",
      )
    )
      return
    setCancellingId(invoice.id)
    setError("")
    try {
      await invoiceApi.cancelInvoice(invoice.id)
      showToast?.(
        isVi
          ? "Đã hủy hóa đơn chờ thanh toán thành công."
          : "Pending invoice cancelled.",
        "success",
      )
      await refresh()
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          isVi ? "Không thể hủy hóa đơn này." : "Could not cancel invoice.",
        ),
      )
    } finally {
      setCancellingId(null)
    }
  }

  const handleSubmitResolution = async (e) => {
    e.preventDefault()
    if (!resolutionModalInvoice?.id || !resolutionReason.trim()) return
    setSubmittingResolution(true)
    try {
      await invoiceApi.openPaymentResolution({
        invoiceId: Number(resolutionModalInvoice.id),
        type: resolutionType,
        reason: resolutionReason.trim(),
      })
      showToast?.(
        isVi
          ? "Đã gửi yêu cầu đối soát / xử lý thanh toán!"
          : "Payment resolution request submitted!",
        "success",
      )
      setResolutionModalInvoice(null)
      setResolutionReason("")
      await refresh()
    } catch (err) {
      showToast?.(
        getErrorMessage(
          err,
          isVi
            ? "Không thể gửi yêu cầu đối soát thanh toán."
            : "Could not submit payment resolution.",
        ),
        "error",
      )
    } finally {
      setSubmittingResolution(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-7 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-accent-dark">
            VIBE SPORT · MEMBER
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">
            {isVi ? "Hóa đơn & thanh toán" : "Invoices & payments"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {isVi
              ? "Theo dõi hóa đơn và trạng thái thanh toán của bạn."
              : "Review your invoices and payment status."}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {isVi ? "Tải lại" : "Refresh"}
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Summary
          icon={FileText}
          title={isVi ? "Tổng hóa đơn" : "Invoices"}
          value={totals.count}
        />
        <Summary
          icon={Wallet}
          title={isVi ? "Đã thanh toán" : "Paid total"}
          value={formatMoney(totals.paid, isVi)}
        />
        <Summary
          icon={CreditCard}
          title={isVi ? "Đang chờ thanh toán" : "Awaiting payment"}
          value={totals.pending}
        />
      </section>
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-bold text-slate-900">
            {isVi ? "Lịch sử hóa đơn" : "Invoice history"}
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={
                  isVi ? "Tìm mã hóa đơn, gói..." : "Search invoice, package..."
                }
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-primary sm:w-56"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-primary"
            >
              <option value="all">
                {isVi ? "Tất cả trạng thái" : "All statuses"}
              </option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {isVi ? label.vi : label.en}
                </option>
              ))}
            </select>
          </div>
        </div>
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">
            {isVi ? "Đang tải hóa đơn..." : "Loading invoices..."}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-800">
              {isVi
                ? invoices.length
                  ? "Không tìm thấy hóa đơn phù hợp"
                  : "Bạn chưa có hóa đơn"
                : invoices.length
                  ? "No matching invoices"
                  : "No invoices yet"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {isVi
                ? "Hóa đơn phát sinh từ đăng ký gói hoặc dịch vụ sẽ hiển thị tại đây."
                : "Invoices for memberships and services will appear here."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((invoice) => {
              const status = STATUS_LABELS[invoice.paymentStatus] || {
                vi:
                  invoice.rawPaymentStatus ||
                  invoice.paymentStatus ||
                  "Chưa rõ",
                en:
                  invoice.rawPaymentStatus ||
                  invoice.paymentStatus ||
                  "Unknown",
                style: "bg-slate-100 text-slate-700",
              }
              return (
                <article
                  key={invoice.id}
                  className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900">
                        {invoice.invoiceCode ||
                          invoice.code ||
                          formatInvoiceCode(invoice.id)}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.style}`}
                      >
                        {isVi ? status.vi : status.en}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-700">
                      {invoice.packageName ||
                        invoice.className ||
                        (isVi ? "Dịch vụ VIBE Sport" : "VIBE Sport service")}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {isVi ? "Tạo lúc" : "Created"}:{" "}
                      {formatDate(invoice.createdAt, isVi)}
                      {invoice.paymentDate
                        ? ` · ${
                            isVi ? "Thanh toán" : "Paid"
                          }: ${formatDate(invoice.paymentDate, isVi)}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                    <strong className="whitespace-nowrap text-base font-extrabold text-slate-900 mr-2">
                      {formatMoney(invoice.amount, isVi)}
                    </strong>
                    <button
                      type="button"
                      onClick={() => handleViewReceipt(invoice)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <Receipt className="h-3.5 w-3.5 text-slate-500" />
                      {isVi ? "Biên lai / Chi tiết" : "Receipt"}
                    </button>
                    {apiEnabled && invoice.paymentStatus === "pending" && (
                      <>
                        <button
                          type="button"
                          onClick={() => payOnline(invoice)}
                          disabled={payingId === invoice.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-primary-hover disabled:opacity-60 cursor-pointer"
                        >
                          {payingId === invoice.id
                            ? isVi
                              ? "Đang xử lý..."
                              : "Processing..."
                            : isVi
                              ? "Thanh toán"
                              : "Pay online"}
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancelInvoice(invoice)}
                          disabled={cancellingId === invoice.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60 cursor-pointer"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {cancellingId === invoice.id
                            ? isVi
                              ? "Đang hủy..."
                              : "Cancelling..."
                            : isVi
                              ? "Hủy đơn"
                              : "Cancel"}
                        </button>
                      </>
                    )}
                    {apiEnabled && (
                      <button
                        type="button"
                        onClick={() => {
                          setResolutionModalInvoice(invoice)
                          setResolutionType("RECONCILIATION")
                          setResolutionReason("")
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        <Scale className="h-3.5 w-3.5" />
                        {isVi ? "Đối soát" : "Resolve"}
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* Payment Resolutions History (GET /api/payment-resolutions) */}
      {resolutions.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Scale className="h-4 w-4 text-brand-accent-dark" />
              {isVi
                ? "Yêu cầu đối soát & xử lý thanh toán"
                : "Payment Resolutions"}
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {resolutions.map((res) => (
              <div
                key={res.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <span>#{res.id}</span>
                    <span>
                      · {isVi ? "Hóa đơn" : "Invoice"} #{res.invoiceId}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {res.type || "RECONCILIATION"}
                    </span>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                      {res.status || "OPEN"}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-600">{res.reason || "—"}</p>
                  {res.note && (
                    <p className="mt-0.5 text-slate-500 italic">
                      {isVi ? "Phản hồi:" : "Note:"} {res.note}
                    </p>
                  )}
                </div>
                <span className="text-slate-400">
                  {formatDate(res.createdAt, isVi)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Receipt / Invoice Detail Modal (GET /api/invoices/{id}/receipt) */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-brand-accent-dark" />
                <h3 className="text-base font-extrabold text-slate-900">
                  {isVi ? "Biên lai & Chi tiết hóa đơn" : "Invoice Receipt"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {loadingReceipt ? (
              <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {isVi ? "Đang tải biên lai..." : "Loading receipt..."}
              </div>
            ) : (
              <div className="space-y-2.5 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    {isVi ? "Mã hóa đơn:" : "Invoice Code:"}
                  </span>
                  <strong className="font-mono text-slate-900">
                    {selectedInvoice.invoiceCode ||
                      selectedInvoice.code ||
                      formatInvoiceCode(selectedInvoice.id)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    {isVi ? "Dịch vụ / Gói:" : "Service / Package:"}
                  </span>
                  <strong className="text-slate-900 text-right">
                    {selectedInvoice.packageName ||
                      selectedInvoice.className ||
                      (isVi ? "Dịch vụ VIBE Sport" : "VIBE Sport Service")}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    {isVi ? "Số tiền:" : "Amount:"}
                  </span>
                  <strong className="text-sm font-extrabold text-brand-primary">
                    {formatMoney(selectedInvoice.amount, isVi)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    {isVi ? "Phương thức:" : "Method:"}
                  </span>
                  <span className="font-semibold">
                    {selectedInvoice.rawPaymentMethod ||
                      selectedInvoice.paymentMethod ||
                      "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    {isVi ? "Trạng thái:" : "Status:"}
                  </span>
                  <span className="font-bold">
                    {selectedInvoice.rawPaymentStatus ||
                      selectedInvoice.paymentStatus ||
                      "—"}
                  </span>
                </div>
                {selectedInvoice.transactionCode && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      {isVi ? "Mã giao dịch:" : "Transaction ID:"}
                    </span>
                    <span className="font-mono">
                      {selectedInvoice.transactionCode}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    {isVi ? "Ngày tạo:" : "Created at:"}
                  </span>
                  <span>{formatDate(selectedInvoice.createdAt, isVi)}</span>
                </div>
                {selectedInvoice.paymentDate && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      {isVi ? "Thanh toán lúc:" : "Paid at:"}
                    </span>
                    <span>{formatDate(selectedInvoice.paymentDate, isVi)}</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
              >
                {isVi ? "Đóng" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Open Payment Resolution Modal (POST /api/payment-resolutions) */}
      {resolutionModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <form
            onSubmit={handleSubmitResolution}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {isVi
                  ? "Yêu cầu đối soát thanh toán"
                  : "Open Payment Resolution"}
              </h3>
              <button
                type="button"
                onClick={() => setResolutionModalInvoice(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              {isVi ? "Hóa đơn:" : "Invoice:"}{" "}
              <strong>
                {resolutionModalInvoice.invoiceCode ||
                  formatInvoiceCode(resolutionModalInvoice.id)}
              </strong>{" "}
              ({formatMoney(resolutionModalInvoice.amount, isVi)})
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isVi ? "Loại yêu cầu" : "Resolution Type"}
              </label>
              <select
                value={resolutionType}
                onChange={(e) => setResolutionType(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs outline-none focus:border-brand-primary"
              >
                <option value="RECONCILIATION">
                  {isVi
                    ? "Đối soát giao dịch chuyển khoản / VNPay"
                    : "Payment Reconciliation"}
                </option>
                <option value="REFUND">
                  {isVi ? "Yêu cầu hoàn tiền / hủy dịch vụ" : "Refund Request"}
                </option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isVi ? "Lý do / Mã tham chiếu ngân hàng *" : "Reason / Note *"}
              </label>
              <textarea
                rows={3}
                required
                value={resolutionReason}
                onChange={(e) => setResolutionReason(e.target.value)}
                placeholder={
                  isVi
                    ? "Nhập nội dung cần đối soát hoặc mã giao dịch ngân hàng..."
                    : "Describe the issue or transaction reference..."
                }
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs outline-none focus:border-brand-primary"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResolutionModalInvoice(null)}
                className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {isVi ? "Hủy" : "Cancel"}
              </button>
              <button
                type="submit"
                disabled={submittingResolution}
                className="rounded-lg bg-brand-primary px-4 py-2 text-xs font-bold text-white hover:bg-brand-primary-hover disabled:opacity-50 cursor-pointer"
              >
                {submittingResolution
                  ? isVi
                    ? "Đang gửi..."
                    : "Submitting..."
                  : isVi
                    ? "Gửi yêu cầu"
                    : "Submit"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}

function Summary({ icon: Icon, title, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        <Icon className="h-4 w-4 text-brand-accent-dark" />
        {title}
      </div>
      <p className="mt-3 text-xl font-black text-slate-900">{value}</p>
    </div>
  )
}
export default MemberInvoicesView
