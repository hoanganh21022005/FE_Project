import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
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
  Clock,
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import { invoiceApi } from "../../api/invoiceApi"
import { formatInvoiceCode } from "../../api/invoiceMappers"
import { getErrorMessage } from "../../api/apiErrors"
import { applyMockPaymentSettlements } from "../../utils/mockFixtureSettlement"
import {
  canOfferPaymentRetry,
  canRequestInvoiceReceipt,
  getPaymentReturnState,
} from "../../utils/paymentReturnState"
import {
  canStartVnpayVerification,
  acquireInvoiceVerificationLock,
  getVerificationSecondsRemaining,
  abortPendingVnpayVerification,
  clearAutomaticVnpayAttempt,
  clearVnpayCooldown,
  executeVnpayVerification,
  hasAutomaticVnpayAttempt,
  isCurrentPaymentReturnRequest,
  markAutomaticVerificationAttempt,
  normalizeVerificationStatus,
  restoreVnpayCooldown,
  releaseInvoiceVerificationLock,
  storeVnpayCooldown,
  storeAutomaticVnpayAttempt,
} from "../../utils/paymentVerification"
import { PageHeader } from "../ui/PageHeader"

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
  const { currentUser, language, apiEnabled, payments: mockPayments, showToast } = useSCMS()
  const isVi = language === "vi"
  const [searchParams, setSearchParams] = useSearchParams()
  const [invoices, setInvoices] = useState([])
  const [resolutions, setResolutions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [keyword, setKeyword] = useState("")
  const [payingId, setPayingId] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const [returnInvoiceLookup, setReturnInvoiceLookup] = useState({
    status: "idle",
    invoice: null,
    error: "",
  })
  const [verification, setVerification] = useState({ invoiceId: "", status: "", retryAt: 0, running: false, error: "" })
  const [retryClock, setRetryClock] = useState(Date.now())
  const mountedRef = useRef(false)
  const invoiceListRequestSeqRef = useRef(0)
  const activeReturnKeyRef = useRef("")
  const verifyInFlightRef = useRef(new Set())
  const autoVerifyAttemptedRef = useRef(new Set())
  const verifyControllerRef = useRef(null)

  const returnStatus =
    searchParams.get("status") ||
    searchParams.get("vnp_ResponseCode") ||
    searchParams.get("vnp_TransactionStatus") ||
    ""
  const returnInvoiceCode =
    searchParams.get("invoiceCode") || searchParams.get("vnp_TxnRef") || ""
  const returnInvoiceId = searchParams.get("invoiceId") || ""
  const hasReturnParams = Boolean(
    returnStatus || returnInvoiceCode || returnInvoiceId,
  )
  const normalizedRole = String(currentUser?.role || "").trim().toLowerCase()
  const normalizedUserId = String(currentUser?.id ?? "").trim()

  // Receipt / Detail modal state
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [loadingReceipt, setLoadingReceipt] = useState(false)

  // Payment Resolution modal state
  const [resolutionModalInvoice, setResolutionModalInvoice] = useState(null)
  const [resolutionType, setResolutionType] = useState("RECONCILIATION")
  const [resolutionReason, setResolutionReason] = useState("")
  const [submittingResolution, setSubmittingResolution] = useState(false)

  const refresh = useCallback(async () => {
    const requestSeq = ++invoiceListRequestSeqRef.current
    setLoading(true)
    setError("")
    try {
      if (apiEnabled) {
        const invList = await invoiceApi.getMemberOwnInvoices()
        if (mountedRef.current && requestSeq === invoiceListRequestSeqRef.current) {
          setInvoices(invList)
          setResolutions([])
        }
        return invList
      } else {
        const mockInvoices = applyMockPaymentSettlements(mockPayments || [])
        if (mountedRef.current && requestSeq === invoiceListRequestSeqRef.current) {
          setInvoices(mockInvoices)
          setResolutions([])
        }
        return mockInvoices
      }
    } catch (err) {
      if (mountedRef.current && requestSeq === invoiceListRequestSeqRef.current) {
        setError(getErrorMessage(err, "Could not load invoices."))
      }
    } finally {
      if (mountedRef.current && requestSeq === invoiceListRequestSeqRef.current) setLoading(false)
    }
  }, [apiEnabled, currentUser?.role, isVi, mockPayments])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortPendingVnpayVerification(verifyControllerRef)
    }
  }, [])

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

  const matchedReturnInvoice = useMemo(() => {
    if (!hasReturnParams || !invoices.length) return null
    const codeLower = returnInvoiceCode.trim().toLowerCase()
    const idStr = returnInvoiceId.trim()
    return (
      invoices.find((inv) => {
        if (idStr && String(inv.id) === idStr) return true
        if (!codeLower) return false
        return [
          inv.invoiceCode,
          inv.code,
          formatInvoiceCode(inv.id),
          String(inv.id),
        ].some((val) => String(val || "").toLowerCase() === codeLower)
      }) || null
    )
  }, [hasReturnParams, invoices, returnInvoiceCode, returnInvoiceId])

  const numericReturnInvoiceId = /^\d+$/.test(returnInvoiceId.trim())
    ? String(Number(returnInvoiceId.trim()))
    : ""
  const targetReturnInvoiceId =
    numericReturnInvoiceId || matchedReturnInvoice?.id || ""
  const returnLookupKey = [
    normalizedUserId,
    returnInvoiceCode,
    returnInvoiceId,
    targetReturnInvoiceId,
  ].join("|")
  activeReturnKeyRef.current = hasReturnParams ? returnLookupKey : ""

  const refreshTrackedInvoice = useCallback(async (invoiceId, requestKey) => {
    const latestInvoices = await refresh()
    if (!Array.isArray(latestInvoices) || !mountedRef.current ||
        !isCurrentPaymentReturnRequest(requestKey, activeReturnKeyRef.current)) return latestInvoices
    const latestInvoice = latestInvoices.find((item) => String(item.id) === String(invoiceId))
    if (latestInvoice) {
      setReturnInvoiceLookup({ status: "loaded", invoice: latestInvoice, error: "" })
    }
    return latestInvoices
  }, [refresh])

  const runVerificationRef = useRef(null)
  const runVerification = useCallback(async (invoice, requestKey, automatic = false) => {
    const invoiceId = String(invoice?.id || "")
    if (!isCurrentPaymentReturnRequest(requestKey, activeReturnKeyRef.current)) return false
    if (automatic && (
      autoVerifyAttemptedRef.current.has(requestKey) ||
      hasAutomaticVnpayAttempt({ userId: normalizedUserId, invoiceId })
    )) return false
    const storedRetryAt = restoreVnpayCooldown({ userId: normalizedUserId, invoiceId })
    const memoryRetryAt = verification.invoiceId === invoiceId ? verification.retryAt : 0
    const retryAt = Math.max(storedRetryAt, memoryRetryAt)
    if (!canStartVnpayVerification({
      invoice,
      role: normalizedRole,
      apiEnabled,
      inFlight: verifyInFlightRef.current.has(invoiceId),
      retryAt,
      verificationStatus: verification.invoiceId === invoiceId ? verification.status : "",
    })) return false

    if (automatic) {
      if (!markAutomaticVerificationAttempt(autoVerifyAttemptedRef.current, requestKey)) return false
      storeAutomaticVnpayAttempt({ userId: normalizedUserId, invoiceId })
    }
    if (!acquireInvoiceVerificationLock(verifyInFlightRef.current, invoiceId)) return false
    const controller = new AbortController()
    verifyControllerRef.current = { controller, requestKey, invoiceId }
    setVerification({ invoiceId, status: "VERIFYING", retryAt: 0, running: true, error: "" })
    try {
      const result = await executeVnpayVerification(
        invoiceId,
        (id, options) => invoiceApi.verifyVnpay(id, options),
        controller.signal,
      )
      if (result.aborted) return false
      if (!mountedRef.current || !isCurrentPaymentReturnRequest(requestKey, activeReturnKeyRef.current)) return false
      const response = result.response
      const status = normalizeVerificationStatus(response?.verificationStatus)
      const nextRetryAt = status === "RETRY_LATER"
        ? storeVnpayCooldown({
            userId: normalizedUserId,
            invoiceId,
            retryAfterSeconds: response?.retryAfterSeconds,
          })
        : 0
      if (status !== "RETRY_LATER") clearVnpayCooldown({ userId: normalizedUserId, invoiceId })
      setVerification({
        invoiceId,
        status,
        retryAt: nextRetryAt,
        running: false,
        error: "",
      })
      await refreshTrackedInvoice(invoiceId, requestKey)
      return true
    } catch (err) {
      if (controller.signal.aborted || err?.name === "AbortError") return false
      if (mountedRef.current && isCurrentPaymentReturnRequest(requestKey, activeReturnKeyRef.current)) {
        setVerification({
          invoiceId,
          status: "UNKNOWN",
          retryAt: 0,
          running: false,
          error: getErrorMessage(err, "The transaction could not be verified. Invoice status is unchanged."),
        })
        await refreshTrackedInvoice(invoiceId, requestKey)
      }
      return false
    } finally {
      releaseInvoiceVerificationLock(verifyInFlightRef.current, invoiceId)
      if (verifyControllerRef.current?.controller === controller) {
        verifyControllerRef.current = null
      }
      if (mountedRef.current) {
        setVerification((current) => current.invoiceId === invoiceId && current.running
          ? { ...current, status: current.status === "VERIFYING" ? "" : current.status, running: false }
          : current)
      }
    }
  }, [apiEnabled, normalizedRole, normalizedUserId, refreshTrackedInvoice, verification.invoiceId, verification.retryAt, verification.status])
  runVerificationRef.current = runVerification

  useEffect(() => {
    if (!verification.retryAt || getVerificationSecondsRemaining(verification.retryAt) <= 0) return undefined
    const timer = window.setInterval(() => {
      setRetryClock(Date.now())
      if (getVerificationSecondsRemaining(verification.retryAt) <= 1) {
        clearVnpayCooldown({ userId: normalizedUserId, invoiceId: verification.invoiceId })
        window.clearInterval(timer)
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [normalizedUserId, verification.invoiceId, verification.retryAt])

  useEffect(() => {
    let active = true

    if (!hasReturnParams) {
      setReturnInvoiceLookup({ status: "idle", invoice: null, error: "" })
      return () => {
        active = false
      }
    }

    if (!apiEnabled) {
      setReturnInvoiceLookup({
        status: "error",
        invoice: null,
        error: isVi
          ? "Không thể xác minh trạng thái thanh toán khi chưa kết nối máy chủ."
          : "Payment status cannot be verified without server connection.",
      })
      return () => {
        active = false
      }
    }

    if (!targetReturnInvoiceId) {
      return () => {
        active = false
      }
    }

    setReturnInvoiceLookup({ status: "loading", invoice: null, error: "" })
    invoiceApi
      .getMemberOwnInvoiceById(targetReturnInvoiceId)
      .then((invoice) => {
        if (!active) return
        if (!invoice) throw new Error("Invoice detail was empty.")
        setReturnInvoiceLookup({ status: "loaded", invoice, error: "" })
        setInvoices((current) => current.map((item) =>
          String(item.id) === String(invoice.id) ? { ...item, ...invoice } : item,
        ))
        const persistedRetryAt = restoreVnpayCooldown({
          userId: normalizedUserId,
          invoiceId: invoice.id,
        })
        if (persistedRetryAt > Date.now()) {
          setVerification({
            invoiceId: String(invoice.id),
            status: "RETRY_LATER",
            retryAt: persistedRetryAt,
            running: false,
            error: "",
          })
          return
        }
        if (normalizedRole === "member" && apiEnabled) {
          runVerificationRef.current?.(invoice, returnLookupKey, true)
        }
      })
      .catch((err) => {
        if (!active) return
        setReturnInvoiceLookup({
          status: "error",
          invoice: null,
          error: getErrorMessage(
            err,
            isVi
              ? "Không thể xác minh trạng thái hóa đơn từ hệ thống. Vui lòng tải lại hoặc liên hệ trung tâm; đừng thanh toán lại lúc này."
              : "The invoice status could not be verified with the system. Refresh or contact the center; do not pay again yet.",
          ),
        })
      })

    return () => {
      active = false
      abortPendingVnpayVerification(verifyControllerRef, returnLookupKey)
    }
  }, [
    apiEnabled,
    hasReturnParams,
    isVi,
    normalizedRole,
    normalizedUserId,
    returnLookupKey,
    targetReturnInvoiceId,
  ])

  useEffect(() => {
    if (!hasReturnParams || !apiEnabled || targetReturnInvoiceId || loading) return
    setReturnInvoiceLookup({
      status: "error",
      invoice: null,
      error: isVi
        ? "Không tìm thấy hóa đơn để kiểm tra trạng thái giao dịch. Vui lòng tải lại hóa đơn hoặc liên hệ trung tâm; đừng thanh toán lại lúc này."
        : "The invoice could not be identified for status verification. Refresh invoices or contact the center; do not pay again yet.",
    })
  }, [apiEnabled, hasReturnParams, isVi, loading, targetReturnInvoiceId])

  const authoritativeReturnInvoice =
    returnInvoiceLookup.status === "loaded" &&
    String(returnInvoiceLookup.invoice?.id) === String(targetReturnInvoiceId)
      ? returnInvoiceLookup.invoice
      : null
  const currentVerification =
    authoritativeReturnInvoice && String(verification.invoiceId) === String(authoritativeReturnInvoice.id)
      ? verification
      : { invoiceId: "", status: "", retryAt: 0, running: false, error: "" }
  const currentRetrySecondsRemaining = currentVerification.retryAt
    ? getVerificationSecondsRemaining(currentVerification.retryAt, retryClock)
    : 0

  const handleRefresh = async () => {
    if (hasReturnParams && apiEnabled && targetReturnInvoiceId) {
      try {
        const detail = await invoiceApi.getMemberOwnInvoiceById(targetReturnInvoiceId)
        if (!detail || !isCurrentPaymentReturnRequest(returnLookupKey, activeReturnKeyRef.current)) return
        setReturnInvoiceLookup({ status: "loaded", invoice: detail, error: "" })
        setInvoices((current) => current.map((item) =>
          String(item.id) === String(detail.id) ? { ...item, ...detail } : item,
        ))
        const didVerify = await runVerification(detail, returnLookupKey)
        if (!didVerify) await refreshTrackedInvoice(detail.id, returnLookupKey)
      } catch (err) {
        if (isCurrentPaymentReturnRequest(returnLookupKey, activeReturnKeyRef.current)) {
          setReturnInvoiceLookup({ status: "error", invoice: null, error: getErrorMessage(err, "Could not load invoice status.") })
        }
      }
      return
    }
    await refresh()
  }

  const clearReturnBanner = () => {
    if (targetReturnInvoiceId) {
      clearAutomaticVnpayAttempt({ userId: normalizedUserId, invoiceId: targetReturnInvoiceId })
    }
    autoVerifyAttemptedRef.current.delete(returnLookupKey)
    setSearchParams({}, { replace: true })
  }

  const isInvoiceExpired = (invoice) => {
    if (!invoice) return false
    if (invoice.paymentStatus === "expired") return true
    if (invoice.paymentStatus !== "pending" || !invoice.expiresAt) return false
    const expTime = new Date(invoice.expiresAt).getTime()
    return Number.isFinite(expTime) && expTime <= Date.now()
  }

  const isValidRedirectUrl = (value) => {
    if (!value || typeof value !== "string") return false
    try {
      const parsed = new URL(value)
      if (parsed.protocol === "https:") return true
      if (
        parsed.protocol === "http:" &&
        (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
      ) {
        return true
      }
      return false
    } catch {
      return false
    }
  }

  const payOnline = async (invoice) => {
    if (!invoice?.id) return
    if (isReturnInvoice(invoice)) return
    if (invoice.paymentMethod === "cash") {
      setError(
        isVi
          ? "Hóa đơn tiền mặt cần được lễ tân xác nhận tại quầy, không thanh toán qua cổng trực tuyến."
          : "Cash invoices must be confirmed at the reception counter.",
      )
      return
    }
    if (isInvoiceExpired(invoice)) {
      setError(
        isVi
          ? "Hóa đơn này đã quá hạn thanh toán. Vui lòng hủy đơn hoặc tạo đăng ký mới."
          : "This invoice has expired. Please cancel it or create a new order.",
      )
      return
    }
    setPayingId(invoice.id)
    setError("")
    try {
      const result = await invoiceApi.payInvoiceOnline(invoice.id)
      if (!isValidRedirectUrl(result?.paymentUrl)) {
        throw new Error(
          isVi
            ? "Máy chủ chưa trả về liên kết thanh toán VNPay hợp lệ."
            : "The server did not return a valid VNPay payment link.",
        )
      }
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
      const requiresReturnRefresh = isReturnInvoice(invoice)
      const currentInvoice = requiresReturnRefresh
        ? await invoiceApi.getMemberOwnInvoiceById(invoice.id)
        : invoice
      const detail = canRequestInvoiceReceipt(currentInvoice)
        ? await invoiceApi.getInvoiceReceipt(currentInvoice.id)
        : currentInvoice
      if (detail) setSelectedInvoice(detail)
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          isVi
            ? "Không thể tải chi tiết hóa đơn từ hệ thống."
            : "Could not load invoice details from the system.",
        ),
      )
    } finally {
      setLoadingReceipt(false)
    }
  }

  const isReturnInvoice = (invoice) => {
    if (!hasReturnParams || !invoice) return false
    if (/^\d+$/.test(returnInvoiceId) && Number(invoice.id) === Number(returnInvoiceId)) return true
    if (!returnInvoiceCode) return false
    return [
      invoice.invoiceCode,
      invoice.code,
      formatInvoiceCode(invoice.id),
      String(invoice.id),
    ].some((value) => String(value || "").toLowerCase() === returnInvoiceCode.trim().toLowerCase())
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
      <PageHeader
        title={isVi ? "Hóa đơn & thanh toán" : "Invoices & payments"}
        description={isVi ? "Theo dõi hóa đơn và trạng thái thanh toán của bạn." : "Review your invoices and payment status."}
        actions={
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || currentVerification.running}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading || currentVerification.running ? "animate-spin" : ""}`} />
            {currentVerification.running
              ? isVi ? "Đang xác minh..." : "Verifying..."
              : currentRetrySecondsRemaining > 0
                ? isVi ? `Tải lại · thử xác minh sau ${currentRetrySecondsRemaining}s` : `Refresh · verify in ${currentRetrySecondsRemaining}s`
                : isVi ? "Tải lại" : "Refresh"}
          </button>
        }
      />

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
      {hasReturnParams && (
        <PaymentReturnBanner
          isVi={isVi}
          returnInvoiceCode={returnInvoiceCode || returnInvoiceId}
          invoice={authoritativeReturnInvoice}
          lookupStatus={returnInvoiceLookup.status}
          lookupError={returnInvoiceLookup.error}
          verification={currentVerification}
          retrySecondsRemaining={currentRetrySecondsRemaining}
          onViewReceipt={handleViewReceipt}
          onDismiss={clearReturnBanner}
        />
      )}
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
                aria-label={isVi ? "Tìm kiếm hóa đơn" : "Search invoices"}
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={
                  isVi ? "Tìm mã hóa đơn, gói..." : "Search invoice, package..."
                }
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-primary sm:w-56"
              />
            </label>
            <select
              aria-label={isVi ? "Lọc trạng thái" : "Filter by status"}
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
              const expired = isInvoiceExpired(invoice)
              const effectiveStatusKey =
                expired && invoice.paymentStatus === "pending"
                  ? "expired"
                  : invoice.paymentStatus === "successful" && invoice.reconciliationRequired
                    ? "reconciliation"
                  : invoice.paymentStatus
              const status = effectiveStatusKey === "reconciliation"
                ? {
                    vi: "Cần đối soát",
                    en: "Reconciliation required",
                    style: "bg-amber-50 text-amber-800",
                  }
                : STATUS_LABELS[effectiveStatusKey] || {
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
              const isCash = invoice.paymentMethod === "cash"
              const methodBadge = isCash
                ? isVi
                  ? "Tiền mặt tại quầy"
                  : "Cash at counter"
                : invoice.paymentMethod === "online"
                  ? "VNPay / Online"
                  : invoice.rawPaymentMethod || null
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
                      {methodBadge && (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                          {methodBadge}
                        </span>
                      )}
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
                        : invoice.paymentStatus === "pending" &&
                            invoice.expiresAt
                          ? ` · ${
                              isVi ? "Hạn thanh toán" : "Expires"
                            }: ${formatDate(invoice.expiresAt, isVi)}`
                          : ""}
                    </p>
                    {invoice.reconciliationRequired && (
                      <p className="mt-1 text-xs font-semibold text-amber-700">
                        {isVi
                          ? "Đang chờ hệ thống đối soát giao dịch"
                          : "Awaiting payment reconciliation"}
                      </p>
                    )}
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
                      {canRequestInvoiceReceipt(invoice)
                        ? isVi ? "Biên lai / Chi tiết" : "Receipt / Details"
                        : isVi ? "Chi tiết hóa đơn" : "Invoice details"}
                    </button>
                    {apiEnabled && invoice.paymentStatus === "pending" && (
                      <>
                        {isCash ? (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800">
                            <Clock className="h-3.5 w-3.5" />
                            {isVi
                              ? "Thanh toán tại quầy lễ tân"
                              : "Pay at reception counter"}
                          </span>
                        ) : canOfferPaymentRetry(invoice, {
                            isReturnInvoice: isReturnInvoice(invoice),
                          }) ? (
                          <button
                            type="button"
                            onClick={() => payOnline(invoice)}
                            disabled={payingId === invoice.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-primary-hover disabled:opacity-60 cursor-pointer"
                          >
                            {payingId === invoice.id
                              ? isVi
                                ? "Đang chuyển VNPay..."
                                : "Redirecting..."
                              : isVi
                                ? "Thanh toán VNPay"
                                : "Pay online"}
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        {!isReturnInvoice(invoice) && <button
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
                        </button>}
                      </>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

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
                {(selectedInvoice.gatewayTransactionRef ||
                  selectedInvoice.transactionCode) && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      {isVi ? "Mã giao dịch:" : "Transaction ID:"}
                    </span>
                    <span className="font-mono">
                      {selectedInvoice.gatewayTransactionRef ||
                        selectedInvoice.transactionCode}
                    </span>
                  </div>
                )}
                {selectedInvoice.cashNote && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      {isVi ? "Ghi chú thu ngân:" : "Cashier note:"}
                    </span>
                    <span className="text-right">{selectedInvoice.cashNote}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    {isVi ? "Ngày tạo:" : "Created at:"}
                  </span>
                  <span>{formatDate(selectedInvoice.createdAt, isVi)}</span>
                </div>
                {selectedInvoice.expiresAt &&
                  selectedInvoice.paymentStatus === "pending" && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">
                        {isVi ? "Hạn thanh toán:" : "Expires at:"}
                      </span>
                      <span>{formatDate(selectedInvoice.expiresAt, isVi)}</span>
                    </div>
                  )}
                {selectedInvoice.paymentDate && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      {isVi ? "Thanh toán lúc:" : "Paid at:"}
                    </span>
                    <span>{formatDate(selectedInvoice.paymentDate, isVi)}</span>
                  </div>
                )}
                {selectedInvoice.reconciliationRequired && (
                  <div className="rounded-lg bg-amber-50 p-2 text-amber-800 font-semibold">
                    {isVi
                      ? "Giao dịch đang chờ đối soát từ hệ thống."
                      : "Payment requires system reconciliation."}
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

      {/* Open Payment Resolution Modal removed for Member */}
    </main>
  )
}

function PaymentReturnBanner({
  isVi,
  returnInvoiceCode,
  invoice,
  lookupStatus,
  lookupError,
  verification,
  retrySecondsRemaining,
  onViewReceipt,
  onDismiss,
}) {
  const state = getPaymentReturnState({
    invoice,
    loading: lookupStatus === "loading" || lookupStatus === "idle",
    error: lookupStatus === "error" ? lookupError : "",
  })
  const isPaid = state === "paid"
  const isReconciliation = state === "reconciliation"
  const toneClass = isPaid
    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
    : isReconciliation
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-slate-200 bg-slate-50 text-slate-900"

  const copy = {
    checking: {
      title: isVi ? "Đang kiểm tra trạng thái thanh toán" : "Checking payment status",
      description: isVi ? "Đang lấy trạng thái hóa đơn từ hệ thống. Vui lòng chờ và không thanh toán lại trong lúc kiểm tra." : "The invoice status is being retrieved from the system. Please wait and do not pay again while it is being checked.",
    },
    unverified: {
      title: isVi ? "Chưa xác minh được thanh toán" : "Payment not yet verified",
      description: lookupError || (isVi ? "Chưa có trạng thái hóa đơn xác nhận từ hệ thống. Vui lòng tải lại hóa đơn hoặc liên hệ trung tâm; đừng thanh toán lại lúc này." : "There is no confirmed invoice status from the system yet. Refresh invoices or contact the center; do not pay again yet."),
    },
    paid: {
      title: isVi ? "Hóa đơn đã thanh toán" : "Invoice paid",
      description: isVi ? "Hệ thống xác nhận hóa đơn đã thanh toán thành công." : "The system confirms that the invoice is paid.",
    },
    reconciliation: {
      title: isVi ? "Thanh toán đang cần đối soát" : "Payment requires reconciliation",
      description: isVi ? "Hệ thống xác nhận hóa đơn đã thanh toán nhưng đang cần đối soát. Chưa thể xác nhận quyền học đã được kích hoạt." : "The system reports the invoice as paid but requires reconciliation. Course access activation is not confirmed.",
    },
    pending: {
      title: isVi ? "Thanh toán chưa được xác minh" : "Payment has not been verified",
      description: isVi ? "Hóa đơn hiện vẫn Chờ thanh toán. Có thể giao dịch đang được cập nhật; vui lòng tải lại sau hoặc liên hệ trung tâm. Đừng thanh toán lại lúc này." : "The invoice is currently pending. The transaction may still be updating; refresh later or contact the center. Do not pay again yet.",
    },
    expired: {
      title: isVi ? "Hóa đơn đã hết hạn" : "Invoice expired",
      description: isVi ? "Hệ thống ghi nhận hóa đơn đã hết hạn. Nếu bạn đã bị trừ tiền, vui lòng liên hệ trung tâm để được kiểm tra." : "The system confirms that the invoice has expired. If you were charged, contact the center for a review.",
    },
    failed: {
      title: isVi ? "Ghi nhận thanh toán thất bại" : "Payment failed",
      description: isVi ? "Đây là trạng thái hiện được hệ thống xác nhận. Nếu bạn đã bị trừ tiền, vui lòng liên hệ trung tâm." : "This is the status currently confirmed by the system. If you were charged, contact the center.",
    },
    cancelled: {
      title: isVi ? "Hóa đơn đã hủy" : "Invoice cancelled",
      description: isVi ? "Hệ thống xác nhận hóa đơn đã hủy. Nếu bạn đã bị trừ tiền, vui lòng liên hệ trung tâm." : "The system confirms that the invoice was cancelled. If you were charged, contact the center.",
    },
    refunded: {
      title: isVi ? "Khoản thanh toán đã hoàn" : "Payment reversed",
      description: isVi ? "Hệ thống ghi nhận khoản thanh toán đã được hoàn." : "The system reports that the payment was reversed.",
    },
  }[state]
  const verificationNotice = (() => {
    if (verification?.running) {
      return isVi
        ? "Đang yêu cầu hệ thống đối soát giao dịch. Trạng thái thanh toán vẫn lấy từ hóa đơn hệ thống."
        : "The system is checking this transaction. Payment status still comes from the system invoice."
    }
    if (verification?.error) return verification.error
    switch (verification?.status) {
      case "VERIFIED_PAID":
        return isVi
          ? "Hệ thống đã xác minh giao dịch; hóa đơn đang được tải lại để lấy trạng thái chính thức."
          : "The system verified the transaction; the invoice is being refreshed for its current status."
      case "ALREADY_PAID":
        return isVi
          ? "Hệ thống cho biết giao dịch đã được ghi nhận trước đó; không cần thanh toán lần nữa."
          : "The system reports this transaction was already recorded. Do not pay again."
      case "RETRY_LATER":
        return retrySecondsRemaining > 0
          ? isVi ? `Chưa thể kiểm tra lại. Có thể thử lại sau ${retrySecondsRemaining} giây.` : `Verification is cooling down. Try again in ${retrySecondsRemaining} seconds.`
          : isVi ? "Đã hết thời gian chờ. Nhấn Tải lại để thử xác minh lại giao dịch." : "The cooldown has ended. Refresh to check the transaction again."
      case "NOT_CONFIRMED":
        return isVi
          ? "Hệ thống chưa xác nhận được giao dịch. Đây chưa phải kết luận thanh toán thất bại; vui lòng chờ hoặc liên hệ trung tâm, không thanh toán lại lúc này."
          : "The system could not confirm the transaction. This does not mean payment failed; wait or contact the center and do not pay again yet."
      case "QUERY_UNAVAILABLE":
        return isVi
          ? "Kênh truy vấn VNPay hiện chưa khả dụng. Trạng thái hóa đơn được giữ nguyên; vui lòng thử lại sau hoặc liên hệ trung tâm."
          : "The VNPay query channel is unavailable. Invoice status is unchanged; try again later or contact the center."
      case "ATTEMPT_MISSING":
        return isVi
          ? "Không tìm thấy thông tin giao dịch gốc. Hóa đơn cần được trung tâm hỗ trợ đối soát."
          : "The original payment attempt was not found. Contact the center for reconciliation."
      case "DISABLED":
        return isVi
          ? "Chức năng tự động xác minh giao dịch hiện đang tạm đóng. Hãy dùng trạng thái hóa đơn hiện tại hoặc liên hệ trung tâm."
          : "Automated transaction verification is currently paused. Use the current invoice status or contact the center."
      case "VERIFIED_ONLY":
        return isVi
          ? "Có phản hồi xác minh nhưng hóa đơn chưa được xác nhận Đã thanh toán. Quyền học chưa được xác nhận."
          : "A verification response was received, but the invoice is not marked Paid. Course access is not confirmed."
      case "NOT_APPLICABLE":
        return isVi
          ? "Giao dịch không cần xác minh theo trạng thái hiện tại của hóa đơn."
          : "Verification does not apply to the invoice's current status."
      case "UNKNOWN":
        return isVi
          ? "Chưa nhận được kết quả xác minh. Trạng thái hóa đơn hiện tại được giữ nguyên; không thanh toán lại lúc này."
          : "No verification result was received. The current invoice status is unchanged; do not pay again yet."
      default:
        return ""
    }
  })()

  return (
    <section role="status" className={`rounded-xl border p-4 shadow-xs ${toneClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {isPaid ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />}
          <div>
            <h2 className="text-sm font-extrabold">{copy.title}</h2>
            {returnInvoiceCode && <p className="mt-0.5 text-xs font-semibold opacity-85">{isVi ? "Mã hóa đơn / tham chiếu:" : "Invoice / Ref:"} <span className="font-mono">{returnInvoiceCode}</span></p>}
            <p className="mt-1 text-xs leading-5 opacity-90">{copy.description}</p>
            {verificationNotice && (
              <p className="mt-2 text-xs leading-5 font-semibold" role="status">
                {verificationNotice}
              </p>
            )}
            {isPaid && invoice && (
              <button
                type="button"
                onClick={() => onViewReceipt(invoice)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <Receipt className="h-3.5 w-3.5" />
                {isVi ? "Xem biên lai" : "View receipt"}
              </button>
            )}
          </div>
        </div>
        <button type="button" onClick={onDismiss} className="rounded-lg p-1 opacity-70 hover:bg-black/5 hover:opacity-100 cursor-pointer" aria-label={isVi ? "Đóng thông báo" : "Dismiss"}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </section>
  )
}

function Summary({ icon: Icon, title, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        <Icon className="h-4 w-4 text-brand-accent-dark" />
        {title}
      </div>
      <p className="mt-3 text-xl font-black text-slate-900">{value}</p>
    </div>
  )
}
export default MemberInvoicesView
