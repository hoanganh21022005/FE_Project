import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  ArrowUpRight,
  CreditCard,
  FileText,
  RefreshCw,
  Search,
  Wallet,
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
  const { language, apiEnabled, payments: mockPayments } = useSCMS()
  const isVi = language === "vi"
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [keyword, setKeyword] = useState("")
  const [payingId, setPayingId] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      if (apiEnabled) setInvoices(await invoiceApi.getMemberOwnInvoices())
      else setInvoices(applyMockPaymentSettlements(mockPayments || []))
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
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <strong className="whitespace-nowrap text-base font-extrabold text-slate-900">
                      {formatMoney(invoice.amount, isVi)}
                    </strong>
                    {apiEnabled && invoice.paymentStatus === "pending" && (
                      <button
                        type="button"
                        onClick={() => payOnline(invoice)}
                        disabled={payingId === invoice.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-2 text-xs font-bold text-white hover:bg-brand-primary-hover disabled:opacity-60"
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
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
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
