import React, {
  useState,
  useEffect,
  useCallback,
  useId,
  useMemo,
  useRef,
} from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useSCMS } from "../../context/SCMSContext"
import { formatDate, formatCurrency } from "../../locales/translations"
import { StatusBadge } from "../common/Badge"
import { membershipApi } from "../../api/membershipApi"
import { invoiceApi } from "../../api/invoiceApi"
import { getErrorMessage } from "../../api/apiErrors"
import {
  getAuthoritativeProfileId,
  resolveCurrentMemberProfile,
  resolveActiveSubscription,
  isDirectSubscriptionLocked,
  getStoredPendingOrder,
  setStoredPendingOrder,
  clearStoredPendingOrder,
  clearAllStoredPendingOrdersExcept,
  executeDirectSubscriptionSubmit,
  calculateInvoiceExpiry,
  resolveActiveSubscriptionDetails,
  resolvePendingInvoiceBannerState,
  resolveSubscriptionRowDisplay,
} from "../../utils/memberSafetyHelpers"
import {
  Award,
  ShieldCheck,
  Clock,
  Calendar,
  CreditCard,
  User,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  X,
  CheckCircle2,
  Package,
  Loader2,
  Info,
} from "lucide-react"
import {
  deriveMockMemberProfile,
  applyMockPaymentSettlements,
  createMockPendingPayment,
  subscribeMockSettlement,
} from "../../utils/mockFixtureSettlement"

export function MyMembershipView() {
  const location = useLocation()
  const navigate = useNavigate()
  const {
    currentUser,
    members: contextMembers,
    packages: contextPackages,
    payments: contextPayments,
    t,
    language,
    apiEnabled,
    showToast,
  } = useSCMS()

  const membershipBasePath = "/member/my-membership"
  const activeTab = location.pathname.endsWith("/plans")
    ? "plans"
    : location.pathname.endsWith("/history")
      ? "history"
      : location.pathname.endsWith("/settings")
        ? "settings"
        : "overview"

  const [, setSettlementTick] = useState(0)

  // Subscribe to mock fixture settlement updates in mock mode
  useEffect(() => {
    return subscribeMockSettlement(() => setSettlementTick((c) => c + 1))
  }, [])

  // Member Profile ID resolution:
  // In API mode, currentUser.id is userId from LoginResponse.
  // We strictly use authoritative memberId from context, never inferring from userId.
  const authoritativeMemberId = getAuthoritativeProfileId(currentUser)
  const hasAuthoritativeMemberId = Boolean(!apiEnabled || authoritativeMemberId)

  // Current member profile:
  // In API mode, never fallback to contextMembers[0] to prevent showing another profile's data.
  // In mock mode, reconcile against any desk cash settlements in sessionStorage.
  const rawMember = resolveCurrentMemberProfile({
    currentUser,
    contextMembers,
    apiEnabled,
  })
  const currentMember = apiEnabled
    ? rawMember
    : deriveMockMemberProfile(rawMember, contextPayments)
  const memberProfileId = apiEnabled
    ? authoritativeMemberId
    : (currentMember?.id ?? 1)

  // Clear pending orders belonging to other accounts when switching members
  useEffect(() => {
    if (memberProfileId) {
      clearAllStoredPendingOrdersExcept(memberProfileId)
    }
  }, [memberProfileId])

  // API State
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [subscriptions, setSubscriptions] = useState([])
  const [packages, setPackages] = useState([])
  const [invoices, setInvoices] = useState([])
  const [invoiceActionLoading, setInvoiceActionLoading] = useState(false)

  // Modal State for Subscription / Renewal
  const [isSubscribeModalOpen, setIsSubscribeModalOpen] = useState(false)
  const [selectedPackageId, setSelectedPackageId] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash") // 'cash' | 'bank_transfer' | 'online'
  const [subNotes, setSubNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [submitError, setSubmitError] = useState(null)
  const [checkoutStep, setCheckoutStep] = useState(1)
  const [planFilter, setPlanFilter] = useState("all")
  const [historyFilter, setHistoryFilter] = useState("all")
  const [historyQuery, setHistoryQuery] = useState("")
  const [historyDateFrom, setHistoryDateFrom] = useState("")
  const [historyDateTo, setHistoryDateTo] = useState("")
  const [historyPage, setHistoryPage] = useState(1)
  const [expandedHistoryKey, setExpandedHistoryKey] = useState("")
  const [invoiceDetails, setInvoiceDetails] = useState(null)

  const packageSelectId = useId()
  const notesId = useId()

  // Fetch Authoritative Data from BE (with robust fail-closed error propagation)
  const fetchMemberData = useCallback(async () => {
    if (!apiEnabled) return

    setLoading(true)
    setError(null)
    const errorMessages = []

    // 1. Fetch public packages catalog via public endpoint
    try {
      const pkgsData = await membershipApi.getPublicPackages()
      setPackages(Array.isArray(pkgsData) ? pkgsData : [])
    } catch (pkgErr) {
      errorMessages.push(
        `Danh mục gói tập: ${getErrorMessage(pkgErr, "Lỗi kết nối")}`,
      )
    }

    // 2. Fetch member invoices via own-read endpoint (/api/members/me/invoices)
    try {
      const invsData = await invoiceApi.getMemberOwnInvoices()
      setInvoices(Array.isArray(invsData) ? invsData : [])
    } catch (invErr) {
      errorMessages.push(
        `Hóa đơn hội viên: ${getErrorMessage(invErr, "Lỗi kết nối")}`,
      )
    }

    // 3. Fetch member subscriptions if memberProfileId is valid, otherwise report clear error
    if (memberProfileId) {
      try {
        const subsData =
          await membershipApi.getMemberSubscriptions(memberProfileId)
        setSubscriptions(Array.isArray(subsData) ? subsData : [])
      } catch (subErr) {
        errorMessages.push(
          `Đăng ký gói hội viên: ${getErrorMessage(subErr, "Lỗi kết nối")}`,
        )
      }
    } else {
      errorMessages.push(
        language === "vi"
          ? "Không tìm thấy ID hội viên đã xác thực từ phiên đăng nhập để tải gói đăng ký."
          : "Authenticated member ID not found in session to load subscriptions.",
      )
    }

    if (errorMessages.length > 0) {
      setError(errorMessages.join("; "))
    }
    setLoading(false)
  }, [apiEnabled, memberProfileId, language])

  useEffect(() => {
    if (apiEnabled) {
      fetchMemberData()
    }
  }, [apiEnabled, fetchMemberData])

  // Derived Active Subscription: strictly active or grace_period.
  // Never treat pending, pending_payment, or expired subscriptions as active packages.
  const activeSubscription = resolveActiveSubscription(
    subscriptions,
    apiEnabled,
  )

  // In Mock Mode: Fallback to context with fixture settlement overlay
  const mockPkg = contextPackages.find(
    (p) => String(p.id) === String(currentMember?.currentPackageId),
  )
  const allMockPayments = applyMockPaymentSettlements(contextPayments)
  const mockPayments = allMockPayments.filter(
    (p) => String(p.memberId) === String(currentMember?.id),
  )

  // Current package info
  const currentPkgDetails = apiEnabled
    ? activeSubscription
      ? packages.find(
          (p) => String(p.id) === String(activeSubscription.packageId),
        ) || {
          name: activeSubscription.packageName,
          nameVi: activeSubscription.packageName,
          price: activeSubscription.price,
          benefits: [],
        }
      : null
    : mockPkg || {
        name: currentMember?.currentPackageName || "Gói thành viên",
        nameVi: currentMember?.currentPackageName || "Gói thành viên",
        price: 0,
        benefits: [],
      }

  // Mock subscription list for demonstration in mock mode
  const mockSubscriptions = useMemo(() => {
    if (apiEnabled || !currentMember?.currentPackageId) return []
    return [
      {
        subscriptionId: currentMember.id ? `SUB-${currentMember.id}` : "SUB-01",
        packageName:
          currentPkgDetails?.nameVi ||
          currentPkgDetails?.name ||
          currentMember?.currentPackageName ||
          "Gói thành viên",
        price: currentPkgDetails?.price || 0,
        startDate: currentMember.startDate || null,
        endDate: currentMember.endDate || null,
        status: currentMember.membershipStatus || "active",
      },
    ]
  }, [apiEnabled, currentMember, currentPkgDetails])

  const displayedSubscriptions = apiEnabled ? subscriptions : mockSubscriptions

  const isMemberMutationLocked = isDirectSubscriptionLocked(
    apiEnabled,
    import.meta.env.VITE_TEST_HARNESS,
  )
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now())
  const [serverClockOffsetMs, setServerClockOffsetMs] = useState(0)

  // Derive active pending invoice from BE invoices or sessionStorage (strictly partitioned by memberProfileId)
  const pendingInvoice = useMemo(() => {
    if (apiEnabled) {
      const fromBE = invoices.find((inv) => inv.paymentStatus === "pending")
      if (fromBE) return fromBE
      const stored = getStoredPendingOrder(memberProfileId)
      if (stored) {
        // If stored invoice is now paid in BE invoices, clear storage
        const matchingPaid = invoices.find(
          (inv) =>
            (String(inv.id) === String(stored.invoiceId) ||
              inv.invoiceCode === stored.invoiceCode) &&
            inv.paymentStatus === "successful",
        )
        if (matchingPaid) {
          clearStoredPendingOrder(memberProfileId)
          return null
        }
        // If stored invoice is expired, clear storage
        const matchingExpired = invoices.find(
          (inv) =>
            (String(inv.id) === String(stored.invoiceId) ||
              inv.invoiceCode === stored.invoiceCode) &&
            inv.paymentStatus === "expired",
        )
        if (matchingExpired) {
          clearStoredPendingOrder(memberProfileId)
          return null
        }
        return stored
      }
      return null
    } else {
      const mockPending = mockPayments.find((p) => p.status === "pending")
      return mockPending || null
    }
  }, [apiEnabled, invoices, mockPayments, memberProfileId])

  const pollingInvoiceRef = useRef(false)
  const lastSettledInvoiceRef = useRef("")
  useEffect(() => {
    const invoiceId = pendingInvoice?.invoiceId ?? pendingInvoice?.id
    if (!apiEnabled || !invoiceId) return
    let cancelled = false
    const pollInvoice = async () => {
      if (pollingInvoiceRef.current || document.visibilityState === "hidden")
        return
      pollingInvoiceRef.current = true
      try {
        const latest = await invoiceApi.getMemberOwnInvoiceById(invoiceId)
        if (cancelled || !latest) return
        if (latest.serverTime) {
          const serverTime = new Date(latest.serverTime).getTime()
          if (Number.isFinite(serverTime))
            setServerClockOffsetMs(serverTime - Date.now())
        }
        setInvoices((current) =>
          current.map((invoice) =>
            String(invoice.id) === String(invoiceId)
              ? { ...invoice, ...latest }
              : invoice,
          ),
        )
        if (
          ["successful", "expired", "cancelled", "failed"].includes(
            String(latest.paymentStatus || "").toLowerCase(),
          )
        ) {
          clearStoredPendingOrder(memberProfileId)
          if (
            latest.paymentStatus === "successful" &&
            lastSettledInvoiceRef.current !== String(invoiceId)
          ) {
            lastSettledInvoiceRef.current = String(invoiceId)
            showToast?.(
              language === "vi"
                ? "Thanh toán thành công. Đang cập nhật gói hội viên…"
                : "Payment complete. Updating your membership…",
              "success",
            )
            const updatedSubscriptions =
              await membershipApi.getMemberSubscriptions(memberProfileId)
            if (!cancelled)
              setSubscriptions(
                Array.isArray(updatedSubscriptions) ? updatedSubscriptions : [],
              )
          }
        }
      } catch {
        // Keep the last known invoice state during transient polling/network errors.
      } finally {
        pollingInvoiceRef.current = false
      }
    }
    const interval = setInterval(pollInvoice, 4000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [
    apiEnabled,
    pendingInvoice?.invoiceId,
    pendingInvoice?.id,
    memberProfileId,
    language,
    showToast,
  ])

  const activeDetails = useMemo(() => {
    return resolveActiveSubscriptionDetails(activeSubscription)
  }, [activeSubscription])
  const membershipProgress = useMemo(() => {
    if (!activeSubscription?.startDate || !activeSubscription?.endDate)
      return null
    const start = new Date(activeSubscription.startDate).getTime()
    const end = new Date(activeSubscription.endDate).getTime()
    const now = currentTimestamp + serverClockOffsetMs
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
      return null
    return {
      remainingDays: Math.max(0, Math.ceil((end - now) / 86400000)),
      percent: Math.min(
        100,
        Math.max(0, ((now - start) / (end - start)) * 100),
      ),
    }
  }, [
    activeSubscription?.startDate,
    activeSubscription?.endDate,
    currentTimestamp,
    serverClockOffsetMs,
  ])

  useEffect(() => {
    const hasCountdown = Boolean(pendingInvoice?.expiresAt)
    const hasMembershipExpiry = Boolean(activeSubscription?.endDate)
    if (!hasCountdown && !hasMembershipExpiry) return
    const intervalMs = hasCountdown ? 1000 : 60000
    const interval = setInterval(() => {
      setCurrentTimestamp(Date.now())
    }, intervalMs)

    return () => clearInterval(interval)
  }, [pendingInvoice?.expiresAt, activeSubscription?.endDate])

  useEffect(() => {
    if (!pendingInvoice?.serverTime) return
    const serverTime = new Date(pendingInvoice.serverTime).getTime()
    if (Number.isFinite(serverTime))
      setServerClockOffsetMs(serverTime - Date.now())
  }, [pendingInvoice?.serverTime])

  const invoiceExpiry = useMemo(() => {
    return calculateInvoiceExpiry(
      pendingInvoice?.expiresAt,
      currentTimestamp + serverClockOffsetMs,
    )
  }, [pendingInvoice?.expiresAt, currentTimestamp, serverClockOffsetMs])

  const pendingInvoiceBannerState = useMemo(() => {
    return resolvePendingInvoiceBannerState(pendingInvoice, invoiceExpiry)
  }, [pendingInvoice, invoiceExpiry])

  const pendingSubscription = displayedSubscriptions.find((subscription) =>
    ["pending", "pending_payment", "awaiting_payment"].includes(
      String(subscription.status || "").toLowerCase(),
    ),
  )
  const historyInvoices = pendingInvoice
    ? invoices.filter(
        (invoice) =>
          String(invoice.id ?? invoice.invoiceId) !==
          String(pendingInvoice.id ?? pendingInvoice.invoiceId),
      )
    : invoices
  const historyRows = [
    ...displayedSubscriptions.map((subscription) => ({
      key: `subscription-${subscription.subscriptionId || subscription.id}`,
      type: "subscription",
      reference: `SUB-${subscription.subscriptionId || subscription.id}`,
      name: subscription.packageName,
      amount: subscription.price,
      date: subscription.startDate,
      detail: subscription.endDate
        ? `${
            language === "vi" ? "Đến" : "Until"
          } ${formatDate(subscription.endDate, language)}`
        : "",
      status: subscription.status,
      entity: subscription,
    })),
    ...(apiEnabled ? historyInvoices : mockPayments).map((item) => ({
      key: `invoice-${item.id || item.invoiceId}`,
      type: "invoice",
      reference:
        item.invoiceCode || item.code || `INV-${item.invoiceId || item.id}`,
      name:
        item.packageName ||
        item.className ||
        (language === "vi" ? "Dịch vụ hội viên" : "Membership service"),
      amount: item.amount,
      date: item.paymentDate || item.createdAt,
      detail: item.paymentMethod || item.method || "",
      status: item.paymentStatus || item.status,
      invoiceId: item.invoiceId ?? item.id,
      entity: item,
    })),
  ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  const filteredHistoryRows = historyRows.filter((row) => {
    const status = String(row.status || "").toLowerCase()
    const matchesStatus =
      historyFilter === "all" ||
      (historyFilter === "pending" &&
        ["pending", "pending_payment", "awaiting_payment"].includes(status)) ||
      (historyFilter === "paid" &&
        ["paid", "completed", "success", "active"].includes(status)) ||
      (historyFilter === "other" &&
        ![
          "pending",
          "pending_payment",
          "awaiting_payment",
          "paid",
          "completed",
          "success",
          "active",
        ].includes(status))
    const timestamp = row.date ? new Date(row.date).getTime() : null
    const from = historyDateFrom
      ? new Date(`${historyDateFrom}T00:00:00`).getTime()
      : null
    const to = historyDateTo
      ? new Date(`${historyDateTo}T23:59:59`).getTime()
      : null
    const matchesDate =
      (from == null || (timestamp != null && timestamp >= from)) &&
      (to == null || (timestamp != null && timestamp <= to))
    return (
      matchesStatus &&
      matchesDate &&
      (!historyQuery.trim() ||
        `${row.reference} ${row.name || ""}`
          .toLowerCase()
          .includes(historyQuery.trim().toLowerCase()))
    )
  })
  const historyPageSize = 8
  const historyPageCount = Math.max(
    1,
    Math.ceil(filteredHistoryRows.length / historyPageSize),
  )
  const pagedHistoryRows = filteredHistoryRows.slice(
    (historyPage - 1) * historyPageSize,
    historyPage * historyPageSize,
  )
  const catalogPackages = apiEnabled ? packages : contextPackages
  const filteredPackages = catalogPackages.filter((pkg) => {
    const days = Number(pkg.durationDays || Number(pkg.durationMonths) * 30)
    if (planFilter === "short") return days > 0 && days < 60
    if (planFilter === "mid") return days >= 60 && days < 180
    if (planFilter === "long") return days >= 180
    return true
  })
  const oneMonthPackage = catalogPackages
    .filter(
      (pkg) =>
        Number(pkg.durationDays || Number(pkg.durationMonths) * 30) >= 25 &&
        Number(pkg.durationDays || Number(pkg.durationMonths) * 30) <= 35 &&
        Number(pkg.price) > 0,
    )
    .sort((a, b) => Number(a.price) - Number(b.price))[0]
  const benchmarkMonthlyPrice = oneMonthPackage
    ? Number(oneMonthPackage.price)
    : null
  const featuredPackage =
    catalogPackages
      .map((pkg) => {
        const days = Number(pkg.durationDays || Number(pkg.durationMonths) * 30)
        const price = Number(pkg.price)
        const baseline =
          benchmarkMonthlyPrice && days > 0
            ? (benchmarkMonthlyPrice * days) / 30
            : null
        return {
          pkg,
          days,
          savings:
            baseline && price > 0
              ? Math.max(0, (1 - price / baseline) * 100)
              : 0,
        }
      })
      .filter(({ days, savings }) => days >= 60 && savings > 0)
      .sort((a, b) => b.savings - a.savings)[0] || null

  const handlePayPendingInvoice = async () => {
    if (invoiceExpiry.isExpired) return
    const invoiceId = pendingInvoice?.invoiceId ?? pendingInvoice?.id
    setInvoiceActionLoading(true)
    try {
      let paymentUrl = pendingInvoice?.paymentUrl || null
      if (apiEnabled && invoiceId) {
        const checkout = await invoiceApi.payInvoiceOnline(invoiceId)
        paymentUrl = checkout?.paymentUrl || paymentUrl
      }
      if (!paymentUrl)
        throw new Error(
          language === "vi"
            ? "Không tìm thấy liên kết thanh toán cho hóa đơn này."
            : "No payment link is available for this invoice.",
        )
      window.location.assign(paymentUrl)
    } catch (err) {
      showToast?.(
        getErrorMessage(
          err,
          language === "vi"
            ? "Không thể bắt đầu thanh toán."
            : "Could not start payment.",
        ),
        "error",
      )
      setInvoiceActionLoading(false)
    }
  }

  const handleCancelPendingInvoice = async () => {
    const confirmed = window.confirm(
      language === "vi"
        ? "Bạn có chắc muốn hủy hóa đơn đang chờ thanh toán không?"
        : "Are you sure you want to cancel this pending invoice?",
    )
    if (!confirmed) return
    const invoiceId = pendingInvoice?.invoiceId ?? pendingInvoice?.id
    if (!apiEnabled || !invoiceId) {
      showToast?.(
        language === "vi"
          ? "Không thể hủy hóa đơn này từ phiên hiện tại."
          : "This invoice cannot be cancelled from the current session.",
        "error",
      )
      return
    }
    setInvoiceActionLoading(true)
    try {
      await invoiceApi.cancelInvoice(invoiceId)
      clearStoredPendingOrder(memberProfileId)
      await fetchMemberData()
      showToast?.(
        language === "vi"
          ? "Đã gửi yêu cầu hủy hóa đơn."
          : "Invoice cancellation requested.",
        "success",
      )
    } catch (err) {
      showToast?.(
        getErrorMessage(
          err,
          language === "vi"
            ? "Không thể hủy hóa đơn."
            : "Could not cancel invoice.",
        ),
        "error",
      )
    } finally {
      setInvoiceActionLoading(false)
    }
  }

  // Handle Subscribe / Renew Submit
  const handleSubscribeSubmit = async (e) => {
    e?.preventDefault?.()
    if (checkoutStep < 3) {
      if (checkoutStep === 1 && !selectedPackageId) {
        setSubmitError(
          language === "vi"
            ? "Vui lòng chọn gói hội viên."
            : "Select a membership plan to continue.",
        )
        return
      }
      setSubmitError(null)
      setCheckoutStep((step) => Math.min(3, step + 1))
      return
    }
    return executeDirectSubscriptionSubmit({
      submittingRef,
      memberProfileId,
      selectedPackageId,
      hasAuthoritativeMemberId,
      isMemberMutationLocked,
      apiEnabled,
      paymentMethod,
      subNotes,
      activeSubscription,
      language,
      currentMember,
      contextPackages,
      contextPayments,
      apis: { membershipApi, invoiceApi },
      callbacks: {
        setSubmitting,
        setSubmitError,
        showToast,
        setIsSubscribeModalOpen,
        setSubNotes,
        fetchMemberData,
      },
    })
  }

  const openSubscribeModal = (initialPkgId = "") => {
    const available = apiEnabled ? packages : contextPackages
    const defaultPkg = initialPkgId
      ? String(initialPkgId)
      : available[0]?.id
        ? String(available[0].id)
        : ""
    setSelectedPackageId(defaultPkg)
    setCheckoutStep(1)
    setSubmitError(null)
    setSubNotes("")
    setIsSubscribeModalOpen(true)
  }

  const handleHistoryDetails = async (row) => {
    if (expandedHistoryKey === row.key) {
      setExpandedHistoryKey("")
      setInvoiceDetails(null)
      return
    }
    setExpandedHistoryKey(row.key)
    setInvoiceDetails(null)
    if (row.type === "invoice" && apiEnabled && row.invoiceId) {
      try {
        setInvoiceDetails(
          await invoiceApi.getMemberOwnInvoiceById(row.invoiceId),
        )
      } catch (err) {
        showToast?.(
          getErrorMessage(
            err,
            language === "vi"
              ? "Không thể tải chi tiết hóa đơn."
              : "Could not load invoice details.",
          ),
          "error",
        )
      }
    }
  }

  const handlePayHistoryInvoice = async (row) => {
    try {
      const checkout = await invoiceApi.payInvoiceOnline(row.invoiceId)
      if (!checkout?.paymentUrl)
        throw new Error(
          language === "vi"
            ? "Backend chưa trả về liên kết thanh toán."
            : "The backend did not return a payment link.",
        )
      window.location.assign(checkout.paymentUrl)
    } catch (err) {
      showToast?.(
        getErrorMessage(
          err,
          language === "vi"
            ? "Không thể bắt đầu thanh toán."
            : "Could not start payment.",
        ),
        "error",
      )
    }
  }

  const handleCancelHistoryInvoice = async (row) => {
    if (
      !window.confirm(
        language === "vi"
          ? "Bạn có chắc muốn hủy hóa đơn đang chờ thanh toán?"
          : "Cancel this pending invoice?",
      )
    )
      return
    try {
      await invoiceApi.cancelInvoice(row.invoiceId)
      await fetchMemberData()
      showToast?.(
        language === "vi" ? "Đã hủy hóa đơn." : "Invoice cancelled.",
        "success",
      )
    } catch (err) {
      showToast?.(
        getErrorMessage(
          err,
          language === "vi"
            ? "Không thể hủy hóa đơn."
            : "Could not cancel invoice.",
        ),
        "error",
      )
    }
  }

  const HistoryActions = ({
    row,
    pending,
    language: currentLanguage,
    onDetails,
    onPay,
    onCancel,
    apiEnabled: isApiEnabled,
  }) => (
    <div className="mt-3 flex flex-wrap gap-2 sm:mt-0">
      <button
        type="button"
        onClick={() => onDetails(row)}
        className="rounded border px-3 py-2 text-xs font-semibold"
      >
        {currentLanguage === "vi" ? "Chi tiết" : "Details"}
      </button>
      {row.type === "invoice" && pending && isApiEnabled && (
        <>
          <button
            type="button"
            onClick={() => onPay(row)}
            className="rounded bg-[#BA0000] px-3 py-2 text-xs font-bold text-white"
          >
            {currentLanguage === "vi" ? "Thanh toán" : "Pay"}
          </button>
          <button
            type="button"
            onClick={() => onCancel(row)}
            className="rounded border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700"
          >
            {currentLanguage === "vi" ? "Hủy" : "Cancel"}
          </button>
        </>
      )}
    </div>
  )
  const HistoryDetail = ({
    row,
    expanded,
    details,
    language: currentLanguage,
  }) =>
    !expanded ? null : (
      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        {row.type === "invoice"
          ? details
            ? [
                details.invoiceCode || details.code,
                details.paymentMethod || details.method,
                details.paymentDate || details.createdAt,
              ]
                .filter(Boolean)
                .join(" · ")
            : currentLanguage === "vi"
              ? "Đang tải chi tiết hóa đơn…"
              : "Loading invoice details…"
          : row.detail || row.name}
      </div>
    )

  return (
    <div className="space-y-6 text-[#181818]">
      {/* Header View */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-50 text-[#BA0000] rounded border border-red-200">
            <Award className="w-5 h-5 text-[#BA0000]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 whitespace-nowrap">
              {t("myMembership")}
            </h2>
            <p className="text-xs text-slate-500">
              {language === "vi"
                ? "Thông tin gói thành viên, thời hạn sử dụng & lịch sử hóa đơn thanh toán"
                : "Membership package details, validity period and invoice payment history"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {apiEnabled ? (
            activeSubscription ? (
              <StatusBadge
                type="membership"
                status={activeSubscription.status}
              />
            ) : (
              <span className="inline-flex items-center justify-center px-3 py-1.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                {language === "vi" ? "Chưa đăng ký gói" : "No Package"}
              </span>
            )
          ) : (
            <StatusBadge
              type="membership"
              status={currentMember.membershipStatus || "active"}
            />
          )}

          <button
            onClick={() => openSubscribeModal()}
            disabled={submitting}
            className="min-h-[44px] px-4 py-2 rounded text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors bg-[#BA0000] hover:bg-[#8E0000] text-white cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>
              {activeSubscription ||
              (!apiEnabled && currentMember.currentPackageId)
                ? language === "vi"
                  ? "Gia hạn / Đổi gói"
                  : "Renew / Change"
                : language === "vi"
                  ? "Đăng ký gói mới"
                  : "Subscribe Package"}
            </span>
          </button>
        </div>
      </div>

      <nav
        aria-label={
          language === "vi" ? "Mục gói hội viên" : "Membership sections"
        }
        className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1"
      >
        {[
          { id: "overview", path: "", vi: "Tổng quan", en: "Overview" },
          { id: "plans", path: "/plans", vi: "Chọn gói", en: "Plans" },
          { id: "history", path: "/history", vi: "Lịch sử", en: "History" },
          { id: "settings", path: "/settings", vi: "Cài đặt", en: "Settings" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => navigate(`${membershipBasePath}${tab.path}`)}
            className={`min-h-11 shrink-0 rounded-lg px-4 text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? "bg-slate-950 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {language === "vi" ? tab.vi : tab.en}
          </button>
        ))}
      </nav>

      {/* Direct Registration Locked Notice in API Mode */}
      {apiEnabled && isMemberMutationLocked && !loading && !error && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            {language === "vi"
              ? "Khóa đăng ký trực tuyến: Tính năng đăng ký và gia hạn gói trực tiếp trên ứng dụng hiện đang chờ Backend xác nhận tài khoản/hồ sơ test được phép phát sinh giao dịch và cấu hình sandbox. Vui lòng liên hệ quầy tiếp tân để xử lý."
              : "Direct Subscription Locked: Online package registration and renewal is waiting for Backend confirmation of test profile permissions and sandbox configuration. Please contact the front desk."}
          </span>
        </div>
      )}

      {/* Loading & Error States in API Mode */}
      {apiEnabled && loading && (
        <div className="py-12 bg-white border border-slate-200 rounded-lg text-center">
          <Loader2 className="w-8 h-8 text-[#BA0000] animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-700">
            {language === "vi"
              ? "Đang tải dữ liệu hội viên từ máy chủ..."
              : "Loading membership data from server..."}
          </p>
        </div>
      )}

      {apiEnabled && error && (
        <div className="p-6 bg-white border border-rose-200 rounded-lg text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <p className="text-sm font-bold text-rose-800">
            {language === "vi" ? "Lỗi kết nối máy chủ" : "Server Error"}
          </p>
          <p className="text-xs text-slate-600 max-w-md mx-auto">{error}</p>
          <button
            onClick={fetchMemberData}
            className="min-h-[44px] px-4 py-2 bg-[#BA0000] hover:bg-[#8E0000] text-white text-xs font-bold rounded flex items-center gap-2 mx-auto cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{language === "vi" ? "Thử lại" : "Retry"}</span>
          </button>
        </div>
      )}

      {/* Pending Invoice Notification Banner */}
      {activeTab === "overview" && pendingInvoice && (
        <div
          className={`border rounded-lg p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs ${
            pendingInvoiceBannerState.isPastReservationWindow
              ? "bg-amber-50/90 border-amber-300"
              : "bg-amber-50 border-amber-200"
          }`}
        >
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-amber-900">
                  {language === "vi"
                    ? "Hóa đơn đang chờ thanh toán"
                    : "Pending Invoice"}
                </span>
                <StatusBadge
                  type="payment"
                  status={pendingInvoiceBannerState.authoritativeStatus}
                />
                {pendingInvoiceBannerState.isPastReservationWindow && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300 uppercase tracking-tight">
                    {language === "vi"
                      ? "Đã qua thời gian giữ chỗ"
                      : "Past reservation window"}
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-800 mt-1">
                Mã HĐ:{" "}
                <strong className="font-mono">
                  {pendingInvoice.invoiceCode ||
                    pendingInvoice.code ||
                    `#${pendingInvoice.id ?? pendingInvoice.invoiceId}`}
                </strong>
                {pendingInvoice.amount ? (
                  <span className="ml-2">
                    - Số tiền:{" "}
                    <strong className="font-mono text-[#BA0000]">
                      {formatCurrency(pendingInvoice.amount, language)}
                    </strong>
                  </span>
                ) : null}
                {pendingInvoice.expiresAt ? (
                  <span className="ml-2">
                    - Hạn thanh toán:{" "}
                    <span>
                      {formatDate(pendingInvoice.expiresAt, language)}
                    </span>
                  </span>
                ) : null}
                {invoiceExpiry.hasExpiry && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    -{" "}
                    {language === "vi"
                      ? "Thời gian giữ chỗ:"
                      : "Reservation time:"}{" "}
                    <strong
                      className={`font-mono px-1.5 py-0.5 rounded text-xs ${
                        invoiceExpiry.isExpired
                          ? "bg-rose-100 text-rose-900 font-bold"
                          : "bg-amber-100 text-amber-900 font-bold"
                      }`}
                    >
                      {invoiceExpiry.formattedTime}
                      {invoiceExpiry.isExpired &&
                        (language === "vi"
                          ? " (Hết giờ giữ chỗ)"
                          : " (Window expired)")}
                    </strong>
                  </span>
                )}
              </p>
              <p
                className={`text-[11px] mt-0.5 ${
                  pendingInvoiceBannerState.isPastReservationWindow
                    ? "text-amber-900 font-medium"
                    : "text-amber-700"
                }`}
              >
                {pendingInvoiceBannerState.isPastReservationWindow
                  ? language === "vi"
                    ? 'Đã qua thời gian giữ chỗ thanh toán theo thời hạn của hóa đơn. Hóa đơn trên máy chủ có thể đã hết hạn hoặc bị hủy; vui lòng bấm "Làm mới trạng thái" để kiểm tra dữ liệu mới nhất từ máy chủ.'
                    : 'The payment reservation window based on the invoice expiration time has passed. The invoice on the server may be expired or cancelled; please click "Refresh" to verify latest status.'
                  : String(
                        pendingInvoice.paymentMethod || pendingInvoice.method,
                      ).toLowerCase() === "cash"
                    ? language === "vi"
                      ? "Vui lòng hoàn tất thanh toán tiền mặt tại quầy Tiếp tân."
                      : "Please complete cash payment at the reception desk."
                    : language === "vi"
                      ? "Vui lòng hoàn tất thanh toán để kích hoạt gói hội viên."
                      : "Please complete payment to activate your package."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {apiEnabled &&
              (pendingInvoice.invoiceId ||
                pendingInvoice.id ||
                pendingInvoice.paymentUrl) && (
                <button
                  type="button"
                  onClick={handlePayPendingInvoice}
                  disabled={invoiceActionLoading || invoiceExpiry.isExpired}
                  className="min-h-[40px] px-4 py-2 bg-[#BA0000] hover:bg-[#8E0000] text-white text-sm font-bold rounded disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {invoiceActionLoading
                    ? language === "vi"
                      ? "Đang xử lý..."
                      : "Processing..."
                    : language === "vi"
                      ? "Thanh toán ngay"
                      : "Pay now"}
                </button>
              )}
            {apiEnabled && (pendingInvoice.invoiceId || pendingInvoice.id) && (
              <button
                type="button"
                onClick={handleCancelPendingInvoice}
                disabled={invoiceActionLoading}
                className="min-h-[40px] px-3 py-2 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 text-sm font-semibold rounded disabled:opacity-50"
              >
                {language === "vi" ? "Hủy hóa đơn" : "Cancel invoice"}
              </button>
            )}
            <button
              type="button"
              onClick={fetchMemberData}
              disabled={invoiceActionLoading}
              className="min-h-[36px] px-3 py-1.5 bg-white hover:bg-slate-50 border border-amber-300 text-amber-900 text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>
                {language === "vi" ? "Làm mới trạng thái" : "Refresh"}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Main Active Package Card */}
      {(!apiEnabled || (!loading && !error)) && (
        <>
          <div className={activeTab === "overview" ? "contents" : "hidden"}>
            {(
              apiEnabled
                ? activeSubscription
                : currentMember.currentPackageId
            ) ? (
              <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-6">
                <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-bold uppercase text-[#BA0000] bg-red-50 px-2.5 py-1 rounded border border-red-200">
                        GÓI DỊCH VỤ ĐANG HOẠT ĐỘNG
                      </span>
                      {activeDetails.packageType && (
                        <span className="text-[10px] font-mono font-bold uppercase text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                          {activeDetails.packageType}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900 mt-2">
                      {apiEnabled
                        ? activeSubscription?.packageName || "Gói thành viên"
                        : currentMember.currentPackageName ||
                          mockPkg?.nameVi ||
                          "Chưa đăng ký gói"}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Mã hội viên:{" "}
                      <strong className="font-mono text-slate-900 tabular-nums">
                        {currentMember.code ||
                          (currentMember.id ? `#${currentMember.id}` : "—")}
                      </strong>
                      {apiEnabled && activeSubscription?.subscriptionId && (
                        <span className="ml-3">
                          Mã hợp đồng:{" "}
                          <strong className="font-mono text-slate-900 tabular-nums">
                            #{activeSubscription.subscriptionId}
                          </strong>
                        </span>
                      )}
                      {apiEnabled && activeDetails.hasCredit && (
                        <span className="ml-3">
                          Số dư:{" "}
                          <strong className="font-mono text-emerald-700 font-bold tabular-nums">
                            {activeDetails.remainingCredit} credit
                          </strong>
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="text-left md:text-right">
                    <div className="text-xs text-slate-500">
                      Thời hạn sử dụng gói
                    </div>
                    <div className="text-sm font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                      {apiEnabled ? (
                        activeSubscription?.startDate &&
                        activeSubscription?.endDate ? (
                          `${formatDate(activeSubscription.startDate, language)} → ${formatDate(activeSubscription.endDate, language)}`
                        ) : activeDetails.hasValidityDays ? (
                          `${activeDetails.validityDays} ${
                            language === "vi" ? "ngày" : "days"
                          }`
                        ) : (
                          <span className="text-slate-400 italic font-normal">
                            {language === "vi"
                              ? "Chưa xác định thời hạn"
                              : "Undetermined validity period"}
                          </span>
                        )
                      ) : currentMember.startDate && currentMember.endDate ? (
                        `${formatDate(currentMember.startDate, language)} → ${formatDate(currentMember.endDate, language)}`
                      ) : (
                        <span className="text-slate-400 italic font-normal">
                          {language === "vi"
                            ? "Chưa xác định thời hạn"
                            : "Undetermined validity period"}
                        </span>
                      )}
                    </div>
                    {apiEnabled &&
                      activeDetails.hasValidityDays &&
                      activeSubscription?.startDate &&
                      activeSubscription?.endDate && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          {language === "vi"
                            ? "Thời lượng hiệu lực:"
                            : "Validity duration:"}{" "}
                          <strong className="font-mono text-slate-800 tabular-nums">
                            {activeDetails.validityDays}{" "}
                            {language === "vi" ? "ngày" : "days"}
                          </strong>
                        </div>
                      )}
                    <div className="text-xs text-slate-500 mt-1">
                      Giá gói:{" "}
                      <strong className="font-mono text-[#BA0000] tabular-nums">
                        {apiEnabled
                          ? (activeSubscription?.price ??
                              currentPkgDetails?.price) == null
                            ? "—"
                            : formatCurrency(
                                activeSubscription?.price ??
                                  currentPkgDetails?.price,
                                language,
                              )
                          : formatCurrency(mockPkg?.price || 0, language)}
                      </strong>
                    </div>
                  </div>
                </div>

                {apiEnabled && membershipProgress && (
                  <section
                    aria-label={
                      language === "vi"
                        ? "Tiến độ gói hiện tại"
                        : "Current plan progress"
                    }
                    aria-live="polite"
                    className={`rounded-xl p-4 ${
                      membershipProgress.remainingDays <= 3
                        ? "border border-rose-200 bg-rose-50"
                        : membershipProgress.remainingDays <= 7
                          ? "border border-amber-200 bg-amber-50"
                          : "bg-slate-50"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-700">
                        {language === "vi"
                          ? "Thời hạn còn lại"
                          : "Time remaining"}
                      </span>
                      <strong className="text-sm font-bold text-slate-900">
                        {membershipProgress.remainingDays}{" "}
                        {language === "vi" ? "ngày" : "days"}
                      </strong>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={Math.round(membershipProgress.percent)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-2 overflow-hidden rounded-full bg-slate-200"
                    >
                      <div
                        className="h-full rounded-full bg-red-700 transition-[width]"
                        style={{ width: `${membershipProgress.percent}%` }}
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-xs text-slate-500">
                      <span>
                        {formatDate(activeSubscription.startDate, language)}
                      </span>
                      <span>
                        {formatDate(activeSubscription.endDate, language)}
                      </span>
                    </div>
                    {membershipProgress.remainingDays <= 7 && (
                      <div
                        className="mt-3 flex flex-wrap items-center justify-between gap-3"
                        role="status"
                      >
                        <p className="text-sm font-semibold text-slate-800">
                          {membershipProgress.remainingDays <= 3
                            ? language === "vi"
                              ? "Gói sắp hết hạn. Gia hạn ngay để tiếp tục tập luyện."
                              : "Your plan is about to expire. Renew to keep training."
                            : language === "vi"
                              ? "Gói sẽ hết hạn trong 7 ngày tới."
                              : "Your membership expires within 7 days."}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            openSubscribeModal(activeSubscription.packageId)
                          }
                          className="min-h-10 rounded-lg bg-[#BA0000] px-4 py-2 text-sm font-bold text-white hover:bg-[#8E0000]"
                        >
                          {language === "vi" ? "Gia hạn 1 chạm" : "Renew now"}
                        </button>
                      </div>
                    )}
                  </section>
                )}

                {/* Benefits & Details Grid */}
                <div
                  className={`grid grid-cols-1 ${
                    activeDetails.hasCredit
                      ? "md:grid-cols-4"
                      : "md:grid-cols-3"
                  } gap-4 text-xs`}
                >
                  {activeDetails.hasCredit && (
                    <div className="p-4 bg-emerald-50 rounded border border-emerald-200 space-y-1">
                      <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-emerald-700" />
                        <span>
                          {language === "vi"
                            ? "Số Dư Buổi Học (Credit)"
                            : "Session Credits Balance"}
                        </span>
                      </div>
                      <div className="text-2xl font-black font-mono text-emerald-700 tabular-nums pt-1">
                        {activeDetails.remainingCredit}{" "}
                        <span className="text-xs font-semibold text-emerald-800 font-sans">
                          {language === "vi"
                            ? "Credit còn lại"
                            : "Credits left"}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800">
                        {language === "vi"
                          ? "Sử dụng để đặt lịch ca học 1:1 cùng Huấn luyện viên."
                          : "Available for booking 1:1 sessions with coaches."}
                      </p>
                    </div>
                  )}
                  <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>Quyền Lợi &amp; Dịch Vụ</span>
                    </div>
                    <p className="text-slate-600">
                      {currentPkgDetails?.description ||
                        "Tập luyện không giới hạn các bộ môn Gym, Yoga, Bơi lội và máy tập hiện đại."}
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-blue-600" />
                      <span>Huấn Luyện Viên Phụ Trách</span>
                    </div>
                    <p className="text-slate-600">
                      HLV:{" "}
                      <strong>
                        {currentMember.primaryCoachName || "Chưa phân công"}
                      </strong>
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>Gia hạn gói hội viên</span>
                    </div>
                    <p className="text-slate-600">
                      Liên hệ quầy lễ tân để được tư vấn thời điểm và điều kiện
                      gia hạn.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Empty State: No Package Subscribed */
              <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-4 shadow-xs">
                <Package className="w-12 h-12 text-slate-400 mx-auto" />
                <h3 className="text-base font-bold text-slate-900">
                  {pendingSubscription
                    ? language === "vi"
                      ? "G\u00F3i h\u1ED9i vi\u00EAn \u0111ang ch\u1EDD thanh to\u00E1n"
                      : "Membership awaiting payment"
                    : language === "vi"
                      ? "B\u1EA1n ch\u01B0a c\u00F3 g\u00F3i h\u1ED9i vi\u00EAn \u0111ang ho\u1EA1t \u0111\u1ED9ng"
                      : "You do not have an active membership"}
                </h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  {pendingSubscription
                    ? language === "vi"
                      ? "G\u00F3i s\u1EBD \u0111\u01B0\u1EE3c k\u00EDch ho\u1EA1t sau khi h\u00F3a \u0111\u01A1n \u0111\u01B0\u1EE3c thanh to\u00E1n."
                      : "Your package will activate after its invoice is paid."
                    : language === "vi"
                      ? "Ch\u1ECDn g\u00F3i ph\u00F9 h\u1EE3p b\u00EAn d\u01B0\u1EDBi \u0111\u1EC3 b\u1EAFt \u0111\u1EA7u t\u1EADp luy\u1EC7n."
                      : "Choose a package below to get started."}
                </p>
                {!pendingSubscription && (
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById("membership-catalog")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                    className="min-h-[44px] rounded-lg bg-[#BA0000] px-4 py-2 text-sm font-bold text-white hover:bg-[#8E0000]"
                  >
                    {language === "vi"
                      ? "Xem c\u00E1c g\u00F3i"
                      : "Browse plans"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Package Catalog Selection Grid */}
          <div
            id="membership-catalog"
            className={`scroll-mt-6 space-y-4 ${
              activeTab === "plans" ? "" : "hidden"
            }`}
          >
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Package className="w-4 h-4 text-[#BA0000]" />
              <span>
                {language === "vi"
                  ? "Bảng Giá & Danh Mục Gói Thành Viên"
                  : "Membership Packages Catalog"}
              </span>
            </h3>

            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={
                language === "vi"
                  ? "Lọc gói theo thời hạn"
                  : "Filter plans by duration"
              }
            >
              {[
                ["all", language === "vi" ? "Tất cả" : "All"],
                [
                  "short",
                  language === "vi" ? "Dưới 2 tháng" : "Under 2 months",
                ],
                ["mid", language === "vi" ? "2–6 tháng" : "2–6 months"],
                ["long", language === "vi" ? "Từ 6 tháng" : "6+ months"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPlanFilter(key)}
                  className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${
                    planFilter === key
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredPackages.map((pkg) => {
                const isCurrent = apiEnabled
                  ? activeSubscription &&
                    String(activeSubscription.packageId) === String(pkg.id)
                  : String(currentMember.currentPackageId) === String(pkg.id)
                const durationDays = Number(
                  pkg.durationDays || Number(pkg.durationMonths) * 30,
                )
                const durationMonths =
                  durationDays > 0 ? durationDays / 30 : null
                const monthlyPrice =
                  durationMonths && Number(pkg.price) > 0
                    ? Number(pkg.price) / durationMonths
                    : null
                const baselinePrice =
                  benchmarkMonthlyPrice && durationDays > 0
                    ? (benchmarkMonthlyPrice * durationDays) / 30
                    : null
                const savingsPercent =
                  baselinePrice && Number(pkg.price) > 0
                    ? Math.max(
                        0,
                        Math.round(
                          (1 - Number(pkg.price) / baselinePrice) * 100,
                        ),
                      )
                    : 0
                const isFeatured =
                  featuredPackage &&
                  String(featuredPackage.pkg.id) === String(pkg.id)

                return (
                  <div
                    key={pkg.id}
                    className={`relative bg-white rounded-xl p-5 border flex flex-col justify-between shadow-sm transition-all ${
                      isFeatured
                        ? "border-red-700 ring-2 ring-red-100 shadow-md"
                        : isCurrent
                          ? "border-slate-400"
                          : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="space-y-3">
                      {isFeatured && (
                        <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-800">
                          {language === "vi" ? "Tiết kiệm nhất" : "Best value"}
                        </span>
                      )}
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-base font-bold text-slate-900">
                            {pkg.nameVi || pkg.name}
                          </h4>
                          <span className="text-sm text-slate-500">
                            Thời hạn:{" "}
                            {pkg.durationDays != null
                              ? `${pkg.durationDays} ngày`
                              : pkg.durationMonths != null
                                ? `${pkg.durationMonths} tháng`
                                : "—"}
                          </span>
                        </div>
                        {isCurrent && (
                          <span className="text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                            Đang dùng
                          </span>
                        )}
                      </div>

                      <div className="text-2xl font-extrabold font-mono text-[#BA0000] tabular-nums">
                        {pkg.price == null
                          ? "—"
                          : formatCurrency(pkg.price, language)}
                      </div>

                      {monthlyPrice && (
                        <p className="text-sm text-slate-600">
                          {formatCurrency(monthlyPrice, language)} /{" "}
                          {language === "vi" ? "tháng" : "month"}
                          {savingsPercent > 0 && (
                            <span className="ml-2 font-semibold text-emerald-700">
                              {language === "vi"
                                ? `Tiết kiệm ${savingsPercent}%`
                                : `Save ${savingsPercent}%`}
                            </span>
                          )}
                        </p>
                      )}
                      <p className="text-sm text-slate-600 line-clamp-2">
                        {pkg.descriptionVi ||
                          pkg.description ||
                          (pkg.benefits
                            ? pkg.benefits.join(", ")
                            : "Dịch vụ chuẩn Webzone")}
                      </p>

                      {pkg.benefits &&
                        Array.isArray(pkg.benefits) &&
                        pkg.benefits.length > 0 && (
                          <ul className="text-sm text-slate-600 space-y-1 pt-1 border-t border-slate-100">
                            {pkg.benefits.slice(0, 3).map((b, idx) => (
                              <li
                                key={idx}
                                className="flex items-center gap-1.5"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate">{b}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                    </div>

                    <div className="pt-4 mt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => openSubscribeModal(pkg.id)}
                        disabled={submitting || Boolean(isCurrent)}
                        className={`w-full min-h-[44px] py-2 px-3 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${
                          isCurrent
                            ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                            : isFeatured
                              ? "bg-[#BA0000] hover:bg-[#8E0000] text-white shadow-sm"
                              : "border border-slate-300 bg-white text-slate-800 hover:border-slate-500"
                        }`}
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>
                          {isCurrent
                            ? language === "vi"
                              ? "Gia hạn gói này"
                              : "Renew Package"
                            : language === "vi"
                              ? "Đăng ký gói này"
                              : "Subscribe"}
                        </span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            {catalogPackages.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="min-w-[620px] w-full text-left text-sm">
                  <caption className="px-4 py-3 text-left font-bold text-slate-800">
                    {language === "vi"
                      ? "So sánh gói hội viên"
                      : "Compare membership plans"}
                  </caption>
                  <thead className="bg-slate-50 text-xs font-bold text-slate-600">
                    <tr>
                      <th className="px-4 py-3">
                        {language === "vi" ? "Gói" : "Plan"}
                      </th>
                      <th className="px-4 py-3">
                        {language === "vi" ? "Thời hạn" : "Duration"}
                      </th>
                      <th className="px-4 py-3">
                        {language === "vi" ? "Tổng giá" : "Total"}
                      </th>
                      <th className="px-4 py-3">
                        {language === "vi"
                          ? "Giá/tháng (ước tính)"
                          : "Monthly equivalent"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPackages.map((pkg) => {
                      const days = Number(
                        pkg.durationDays || Number(pkg.durationMonths) * 30,
                      )
                      return (
                        <tr key={`compare-${pkg.id}`}>
                          <td className="px-4 py-3 font-semibold">
                            {pkg.nameVi || pkg.name}
                          </td>
                          <td className="px-4 py-3">
                            {days
                              ? `${days} ${language === "vi" ? "ngày" : "days"}`
                              : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {pkg.price == null
                              ? "—"
                              : formatCurrency(pkg.price, language)}
                          </td>
                          <td className="px-4 py-3">
                            {days && pkg.price != null
                              ? formatCurrency(
                                  (Number(pkg.price) * 30) / days,
                                  language,
                                )
                              : "—"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <p className="px-4 pb-3 text-xs text-slate-500">
                  {language === "vi"
                    ? "Giá/tháng chỉ là phép quy đổi tham khảo từ giá và thời hạn do backend cung cấp."
                    : "Monthly equivalent is calculated from the backend price and duration for comparison."}
                </p>
              </div>
            )}
          </div>

          <section className={activeTab === "history" ? "space-y-4" : "hidden"}>
            <header>
              <h3 className="text-lg font-bold text-slate-900">
                {language === "vi" ? "Lịch sử hội viên" : "Membership history"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {language === "vi"
                  ? "Các lần đăng ký và hóa đơn được gộp trong một danh sách."
                  : "Subscriptions and invoices in one timeline."}
              </p>
            </header>
            <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row">
              <input
                value={historyQuery}
                onChange={(e) => {
                  setHistoryQuery(e.target.value)
                  setHistoryPage(1)
                }}
                placeholder={
                  language === "vi"
                    ? "Tìm mã hóa đơn hoặc tên gói"
                    : "Search reference or plan"
                }
                className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm"
              />
              <select
                value={historyFilter}
                onChange={(e) => {
                  setHistoryFilter(e.target.value)
                  setHistoryPage(1)
                }}
                className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm"
              >
                <option value="all">
                  {language === "vi" ? "Mọi trạng thái" : "All statuses"}
                </option>
                <option value="pending">
                  {language === "vi" ? "Đang chờ" : "Pending"}
                </option>
                <option value="paid">
                  {language === "vi" ? "Đã thanh toán" : "Paid"}
                </option>
                <option value="other">
                  {language === "vi" ? "Khác" : "Other"}
                </option>
              </select>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                {language === "vi" ? "Từ" : "From"}
                <input
                  type="date"
                  value={historyDateFrom}
                  onChange={(e) => {
                    setHistoryDateFrom(e.target.value)
                    setHistoryPage(1)
                  }}
                  className="min-h-10 rounded-lg border border-slate-200 px-2 text-sm text-slate-800"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-500">
                {language === "vi" ? "Đến" : "To"}
                <input
                  type="date"
                  value={historyDateTo}
                  onChange={(e) => {
                    setHistoryDateTo(e.target.value)
                    setHistoryPage(1)
                  }}
                  className="min-h-10 rounded-lg border border-slate-200 px-2 text-sm text-slate-800"
                />
              </label>
            </div>
            {historyRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                {language === "vi"
                  ? "Chưa có lịch sử gói hoặc hóa đơn."
                  : "No subscription or invoice history yet."}
              </div>
            ) : filteredHistoryRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                {language === "vi"
                  ? "Không có giao dịch phù hợp."
                  : "No matching transactions."}
              </div>
            ) : (
              <>
                <div className="space-y-3 sm:hidden">
                  {pagedHistoryRows.map((row) => {
                    const pending = [
                      "pending",
                      "pending_payment",
                      "awaiting_payment",
                    ].includes(String(row.status || "").toLowerCase())
                    return (
                      <article
                        key={row.key}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-xs text-slate-500">
                              {row.reference}
                            </p>
                            <h4 className="mt-1 font-semibold text-slate-900">
                              {row.name}
                            </h4>
                          </div>
                          <StatusBadge
                            type={
                              row.type === "subscription"
                                ? "membership"
                                : "payment"
                            }
                            status={row.status}
                          />
                        </div>
                        <div className="mt-3 flex justify-between text-sm">
                          <span className="text-slate-500">
                            {row.date ? formatDate(row.date, language) : "—"}
                          </span>
                          <b>
                            {row.amount == null
                              ? "—"
                              : formatCurrency(row.amount, language)}
                          </b>
                        </div>
                        <HistoryActions
                          row={row}
                          pending={pending}
                          language={language}
                          onDetails={handleHistoryDetails}
                          onPay={handlePayHistoryInvoice}
                          onCancel={handleCancelHistoryInvoice}
                          apiEnabled={apiEnabled}
                        />
                        <HistoryDetail
                          row={row}
                          expanded={expandedHistoryKey === row.key}
                          details={invoiceDetails}
                          language={language}
                        />
                      </article>
                    )
                  })}
                </div>
                <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
                  <table className="min-w-[900px] w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">
                          {language === "vi" ? "Loại" : "Type"}
                        </th>
                        <th className="px-4 py-3">
                          {language === "vi" ? "Mã" : "Reference"}
                        </th>
                        <th className="px-4 py-3">
                          {language === "vi"
                            ? "Gói / dịch vụ"
                            : "Plan / service"}
                        </th>
                        <th className="px-4 py-3 text-right">
                          {language === "vi" ? "Số tiền" : "Amount"}
                        </th>
                        <th className="px-4 py-3">
                          {language === "vi" ? "Thời gian" : "Date"}
                        </th>
                        <th className="px-4 py-3 text-center">
                          {language === "vi" ? "Trạng thái" : "Status"}
                        </th>
                        <th className="px-4 py-3">
                          {language === "vi" ? "Thao tác" : "Actions"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {pagedHistoryRows.map((row) => {
                        const pending = [
                          "pending",
                          "pending_payment",
                          "awaiting_payment",
                        ].includes(String(row.status || "").toLowerCase())
                        return (
                          <React.Fragment key={row.key}>
                            <tr className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                {row.type === "subscription"
                                  ? language === "vi"
                                    ? "Đăng ký"
                                    : "Subscription"
                                  : language === "vi"
                                    ? "Hóa đơn"
                                    : "Invoice"}
                              </td>
                              <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                                {row.reference}
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-semibold text-slate-900">
                                  {row.name}
                                </span>
                                {row.detail && (
                                  <span className="mt-0.5 block text-xs text-slate-500">
                                    {row.detail}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                                {row.amount == null
                                  ? "—"
                                  : formatCurrency(row.amount, language)}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {row.date
                                  ? formatDate(row.date, language)
                                  : "—"}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <StatusBadge
                                  type={
                                    row.type === "subscription"
                                      ? "membership"
                                      : "payment"
                                  }
                                  status={row.status}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <HistoryActions
                                  row={row}
                                  pending={pending}
                                  language={language}
                                  onDetails={handleHistoryDetails}
                                  onPay={handlePayHistoryInvoice}
                                  onCancel={handleCancelHistoryInvoice}
                                  apiEnabled={apiEnabled}
                                />
                              </td>
                            </tr>
                            {expandedHistoryKey === row.key && (
                              <tr>
                                <td
                                  colSpan={7}
                                  className="bg-slate-50 px-4 py-3 text-xs text-slate-600"
                                >
                                  <HistoryDetail
                                    row={row}
                                    expanded
                                    details={invoiceDetails}
                                    language={language}
                                  />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    {language === "vi"
                      ? `Trang ${historyPage} / ${historyPageCount} · ${filteredHistoryRows.length} giao dịch`
                      : `Page ${historyPage} / ${historyPageCount} · ${filteredHistoryRows.length} transactions`}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={historyPage <= 1}
                      onClick={() => setHistoryPage((page) => page - 1)}
                      className="min-h-10 rounded border px-3 disabled:opacity-40"
                    >
                      {language === "vi" ? "Trước" : "Previous"}
                    </button>
                    <button
                      type="button"
                      disabled={historyPage >= historyPageCount}
                      onClick={() => setHistoryPage((page) => page + 1)}
                      className="min-h-10 rounded border px-3 disabled:opacity-40"
                    >
                      {language === "vi" ? "Sau" : "Next"}
                    </button>
                  </div>
                </div>
              </>
            )}{" "}
          </section>

          {activeTab === "settings" && (
            <section className="space-y-4">
              <header>
                <h3 className="text-lg font-bold text-slate-900">
                  {language === "vi"
                    ? "Cài đặt hội viên"
                    : "Membership settings"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {language === "vi"
                    ? "Quản lý tùy chọn gia hạn và thanh toán."
                    : "Manage renewal and payment preferences."}
                </p>
              </header>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-semibold text-slate-900">
                      {language === "vi" ? "Tự động gia hạn" : "Auto-renewal"}
                    </h4>
                    <p className="mt-1 text-sm text-slate-500">
                      {language === "vi"
                        ? "Backend hiện chưa cung cấp API lưu tùy chọn này."
                        : "The backend does not currently provide an API to save this preference."}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled
                    aria-label={
                      language === "vi"
                        ? "Tự động gia hạn chưa khả dụng"
                        : "Auto-renewal unavailable"
                    }
                    className="h-6 w-11 cursor-not-allowed rounded-full bg-slate-200"
                  >
                    <span className="block h-4 w-4 translate-x-1 rounded-full bg-white shadow" />
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h4 className="font-semibold text-slate-900">
                  {language === "vi"
                    ? "Phương thức thanh toán"
                    : "Payment method"}
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  {language === "vi"
                    ? "Chọn phương thức thanh toán khi đăng ký hoặc gia hạn gói."
                    : "Choose a payment method during checkout or renewal."}
                </p>
              </div>
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
                <h4 className="font-semibold text-slate-900">
                  {language === "vi"
                    ? "Gợi ý gói và tùy chọn nâng cao"
                    : "Plan recommendations and advanced options"}
                </h4>
                <p className="mt-1 text-sm text-slate-600">
                  {language === "vi"
                    ? "Gợi ý dựa trên tần suất tập, đóng băng gói và tính phí nâng cấp cần API từ backend. Khi chưa có dữ liệu, trang không tự suy đoán mức sử dụng hoặc giá."
                    : "Usage based recommendations, membership freeze, and upgrade proration require backend APIs. The page will not guess usage or pricing without that data."}
                </p>
              </div>
            </section>
          )}
        </>
      )}

      {/* Subscribe / Renew Modal */}
      {isSubscribeModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="subscribe-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-xl p-6 text-[#181818]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div className="flex items-center gap-2 font-bold text-sm text-[#181818]">
                <Package className="w-4 h-4 text-[#BA0000]" />
                <span id="subscribe-modal-title">
                  {activeSubscription
                    ? language === "vi"
                      ? "Gia hạn / Đăng ký gói hội viên"
                      : "Renew / Subscribe Package"
                    : language === "vi"
                      ? "Đăng ký gói hội viên mới"
                      : "New Package Subscription"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSubscribeModalOpen(false)}
                aria-label="Đóng"
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubscribeSubmit} className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                {[1, 2, 3].map((step) => (
                  <React.Fragment key={step}>
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-full ${
                        checkoutStep >= step
                          ? "bg-[#BA0000] text-white"
                          : "bg-slate-100"
                      }`}
                    >
                      {step}
                    </span>
                    {step < 3 && <span className="h-px flex-1 bg-slate-200" />}
                  </React.Fragment>
                ))}
              </div>
              {submitError && (
                <div
                  role="alert"
                  className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 font-semibold">{submitError}</div>
                </div>
              )}

              {checkoutStep === 1 && (
                <>
                  {/* Package Select */}
                  <div>
                    <label
                      htmlFor={packageSelectId}
                      className="text-xs font-bold text-slate-700 block mb-1"
                    >
                      {language === "vi"
                        ? "Gói dịch vụ mong muốn"
                        : "Select Package"}{" "}
                      <span className="text-rose-600">*</span>
                    </label>
                    <select
                      id={packageSelectId}
                      value={selectedPackageId}
                      onChange={(e) => setSelectedPackageId(e.target.value)}
                      disabled={submitting}
                      className="w-full min-h-[44px] bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#BA0000] focus:ring-2 focus:ring-[#D62323]/20"
                    >
                      {(apiEnabled ? packages : contextPackages).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nameVi || p.name} —{" "}
                          {p.price == null
                            ? "—"
                            : formatCurrency(p.price, language)}{" "}
                          (
                          {p.durationDays != null
                            ? `${p.durationDays} ngày`
                            : p.durationMonths != null
                              ? `${p.durationMonths} tháng`
                              : "—"}
                          )
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <b>{language === "vi" ? "Mã giảm giá" : "Discount code"}</b>
                    <p className="mt-1">
                      {language === "vi"
                        ? "Tính năng mã giảm giá chưa được backend hỗ trợ."
                        : "Discount codes are not currently supported by the backend."}
                    </p>
                  </div>
                </>
              )}

              {/* Payment Method Selector */}
              {checkoutStep === 2 && (
                <>
                  <div>
                    <span className="text-xs font-bold text-slate-700 block mb-1">
                      {language === "vi"
                        ? "Hình thức thanh toán dự kiến"
                        : "Payment Method"}
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        {
                          key: "cash",
                          label:
                            language === "vi"
                              ? "Tiền mặt tại quầy"
                              : "Cash at Desk",
                        },
                        {
                          key: "online",
                          label:
                            language === "vi"
                              ? "VNPay QR"
                              : "VNPay QR / Online",
                        },
                      ].map((item) => (
                        <button
                          type="button"
                          key={item.key}
                          onClick={() => setPaymentMethod(item.key)}
                          disabled={submitting}
                          className={`min-h-[44px] py-2 px-1 text-center rounded text-xs font-bold border transition-colors cursor-pointer ${
                            paymentMethod === item.key
                              ? "bg-[#181818] text-white border-[#181818]"
                              : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Instructions */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    {language === "vi"
                      ? "Hướng dẫn kích hoạt:"
                      : "Activation Instructions:"}
                  </span>
                </div>
                <p>
                  {paymentMethod === "cash"
                    ? language === "vi"
                      ? "Sau khi gửi yêu cầu, vui lòng ghé quầy Lễ tân của trung tâm để nộp tiền mặt. Nhân viên lễ tân sẽ xác nhận và kích hoạt gói ngay."
                      : "Please visit Reception Desk to pay cash and activate your membership."
                    : language === "vi"
                      ? "Thanh toan bang ma VNPay QR hoac chon ngan hang tren cong thanh toan."
                      : "Pay with a VNPay QR code or choose a bank on the payment gateway."}
                </p>
              </div>

              {checkoutStep === 3 && (
                <>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h4 className="font-bold text-slate-900">
                      {language === "vi" ? "Tóm tắt đơn hàng" : "Order summary"}
                    </h4>
                    {(() => {
                      const chosen = catalogPackages.find(
                        (pkg) => String(pkg.id) === String(selectedPackageId),
                      )
                      return chosen ? (
                        <div className="mt-3 flex items-start justify-between gap-4 text-sm">
                          <span>
                            {chosen.nameVi || chosen.name} ·{" "}
                            {chosen.durationDays ??
                              Number(chosen.durationMonths) * 30}{" "}
                            {language === "vi" ? "ngày" : "days"}
                            <small className="mt-1 block text-slate-500">
                              {paymentMethod === "online"
                                ? "VNPay QR"
                                : language === "vi"
                                  ? "Tiền mặt tại quầy"
                                  : "Cash at desk"}
                            </small>
                          </span>
                          <b className="whitespace-nowrap">
                            {formatCurrency(chosen.price, language)}
                          </b>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-rose-700">
                          {language === "vi"
                            ? "Chưa chọn gói."
                            : "No plan selected."}
                        </p>
                      )
                    })()}
                    <p className="mt-3 border-t border-slate-200 pt-2 text-xs text-slate-500">
                      {language === "vi"
                        ? "Số tiền cuối cùng được xác nhận bởi backend."
                        : "The backend confirms the final amount."}
                    </p>
                  </div>
                  {/* Notes */}
                  <div>
                    <label
                      htmlFor={notesId}
                      className="text-xs font-bold text-slate-700 block mb-1"
                    >
                      {language === "vi" ? "Ghi chú thêm (nếu có)" : "Notes"}
                    </label>
                    <input
                      id={notesId}
                      type="text"
                      value={subNotes}
                      onChange={(e) => setSubNotes(e.target.value)}
                      disabled={submitting}
                      placeholder={
                        language === "vi"
                          ? "Ví dụ: Yêu cầu kích hoạt từ tuần sau..."
                          : "Notes..."
                      }
                      className="w-full min-h-[44px] bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#BA0000] focus:ring-2 focus:ring-[#D62323]/20"
                    />
                  </div>
                </>
              )}

              {/* Mutation Lock Notice */}
              {isMemberMutationLocked && (
                <div
                  role="status"
                  className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-start gap-2"
                >
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    {language === "vi"
                      ? "Backend chưa xác nhận tài khoản/hồ sơ test được phép phát sinh giao dịch và cấu hình sandbox. Nút đăng ký trực tiếp được khóa để bảo vệ hệ thống, vui lòng thanh toán tại quầy Lễ tân."
                      : "Direct transaction mutation is safely locked until Backend confirms test account permissions and sandbox setup. Please pay at Reception Desk."}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setSubmitError(null)
                    setCheckoutStep((step) => Math.max(1, step - 1))
                  }}
                  disabled={submitting || checkoutStep === 1}
                  className="min-h-[44px] rounded border px-4 text-xs font-bold disabled:opacity-40"
                >
                  {language === "vi" ? "Quay lại" : "Back"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsSubscribeModalOpen(false)}
                  disabled={submitting}
                  className="min-h-[44px] px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded cursor-pointer"
                >
                  {t("cancel")}
                </button>
                <button
                  type="submit"
                  disabled={submitting || isMemberMutationLocked}
                  title={
                    isMemberMutationLocked
                      ? language === "vi"
                        ? "Backend chưa xác nhận quyền phát sinh giao dịch và cấu hình sandbox"
                        : "Waiting for Backend confirmation of test profile permissions and sandbox configuration"
                      : undefined
                  }
                  className={`min-h-[44px] px-5 py-2 text-xs font-bold rounded flex items-center gap-2 transition-colors ${
                    isMemberMutationLocked
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed opacity-75"
                      : "bg-[#BA0000] hover:bg-[#8E0000] text-white disabled:opacity-50 cursor-pointer"
                  }`}
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {submitting
                      ? language === "vi"
                        ? "Đang gửi..."
                        : "Submitting..."
                      : isMemberMutationLocked
                        ? language === "vi"
                          ? "Tạm khóa"
                          : "Temporarily locked"
                        : checkoutStep < 3
                          ? language === "vi"
                            ? "Tiếp tục"
                            : "Continue"
                          : activeSubscription
                            ? language === "vi"
                              ? "Xác nhận gia hạn"
                              : "Confirm Renewal"
                            : language === "vi"
                              ? "Xác nhận đăng ký"
                              : "Confirm Subscription"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default MyMembershipView
