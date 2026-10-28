import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { QRCodeSVG } from "qrcode.react"
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Dumbbell,
  MapPin,
  QrCode,
  RefreshCw,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import { httpClient } from "../../api/httpClient"
import { extractList } from "../../api/schemaValidators"
import { mapInvoice } from "../../api/invoiceMappers"
import { getErrorMessage } from "../../api/apiErrors"
import { getAuthoritativeProfileId } from "../../utils/memberSafetyHelpers"
import {
  formatVietnamDateTime,
  getActiveAdvancedCreditCount,
  getAttendedCount,
  getSessionStart,
  getUpcomingSessions,
  getVietnamLocalDateTimeKey,
  isActiveAdvancedSubscription,
  isActiveNormalEnrollment,
  isPayablePendingInvoice,
  isSubscriptionNearExpiry,
  normalizeState,
  toTimestamp,
} from "../../utils/memberDashboardData"

const RESOURCE_KEYS = [
  "enrollments",
  "subscriptions",
  "sessions",
  "attendance",
  "invoices",
  "notifications",
]

const EMPTY_RESOURCES = Object.fromEntries(
  RESOURCE_KEYS.map((key) => [key, { loading: false, data: null, error: "" }]),
)

const extractRequiredList = (response, label) => {
  const list = extractList(response)
  if (!Array.isArray(list)) {
    throw new Error(`${label}: dữ liệu trả về không đúng định dạng.`)
  }
  return list
}

const isUnreadNotification = (item) =>
  item?.isRead === false || item?.read === false || item?.unread === true

const getNotificationTitle = (item, isVi) =>
  (isVi ? item?.titleVi : item?.titleEn) ||
  item?.title ||
  item?.subject ||
  (isVi ? "Thông báo mới" : "New notification")

const getStatusLabel = (status, isVi) => {
  const state = normalizeState(status)
  const labels = {
    registered: isVi ? "Đang tham gia" : "Registered",
    active: isVi ? "Đang hoạt động" : "Active",
    confirmed: isVi ? "Đã xác nhận" : "Confirmed",
    scheduled: isVi ? "Đã lên lịch" : "Scheduled",
    pending: isVi ? "Chờ thanh toán" : "Pending payment",
    pending_payment: isVi ? "Chờ thanh toán" : "Pending payment",
    expired: isVi ? "Đã hết hạn" : "Expired",
    cancelled: isVi ? "Đã hủy" : "Cancelled",
    completed: isVi ? "Đã hoàn thành" : "Completed",
    present: isVi ? "Có mặt" : "Present",
    late: isVi ? "Đi trễ" : "Late",
    absent: isVi ? "Vắng mặt" : "Absent",
  }
  return labels[state] || status || (isVi ? "Chưa có trạng thái" : "No status")
}

function ResourceError({ message, onRetry, compact = false, isVi }) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 ${
        compact ? "p-3 text-[15px]" : "p-4 text-[15px]"
      }`}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" />
      <div className="min-w-0 flex-1">
        <p>{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md font-semibold text-rose-800 underline decoration-rose-300 underline-offset-2 hover:text-rose-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {isVi ? "Thử tải lại" : "Try again"}
          </button>
        )}
      </div>
    </div>
  )
}

function LoadingBlock({ rows = 2 }) {
  return (
    <div aria-label="Loading" className="animate-pulse space-y-3">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="h-14 rounded-xl bg-slate-100"
          aria-hidden="true"
        />
      ))}
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  caption,
  tone = "red",
  loading,
  error,
  isVi,
}) {
  const tones = {
    red: "bg-red-50 text-red-700 ring-red-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
  }

  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-5 text-slate-600">
            {label}
          </p>
          {loading ? (
            <div className="mt-3 h-9 w-20 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              {error
                ? "—"
                : value === null || value === undefined
                  ? isVi
                    ? "Chưa có thông tin"
                    : "Unavailable"
                  : value}
            </p>
          )}
        </div>
        <span
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone]}`}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 min-h-5 text-[13px] leading-5 text-slate-500">
        {error
          ? isVi
            ? "Không thể tải dữ liệu"
            : "Data could not be loaded"
          : caption}
      </p>
    </article>
  )
}

function SectionHeading({ icon: Icon, title, action, onAction }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent-soft text-brand-accent-dark">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-bold tracking-tight text-slate-950">
          {title}
        </h2>
      </div>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[15px] font-semibold text-brand-primary transition hover:bg-brand-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent-dark"
        >
          {action}
          <ArrowRight className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

const getDashboardResourceError = (error, key, isVi) => {
  if (error?.status === 404) {
    return isVi
      ? `${key}: API 404, route ho\u1eb7c t\u00e0i nguy\u00ean kh\u00f4ng t\u00ecm th\u1ea5y.`
      : `${key}: API 404, route or resource not found.`
  }
  if (error?.status === 403) {
    return isVi
      ? `${key}: t\u00e0i kho\u1ea3n kh\u00f4ng c\u00f3 quy\u1ec1n xem.`
      : `${key}: this account is not allowed to view the data.`
  }
  if (error?.status === 409) {
    return isVi
      ? `${key}: y\u00eau c\u1ea7u xung \u0111\u1ed9t v\u1edbi tr\u1ea1ng th\u00e1i hi\u1ec7n t\u1ea1i.`
      : `${key}: request conflicts with the current state.`
  }
  return getErrorMessage(
    error,
    isVi
      ? "Kh\u00f4ng th\u1ec3 t\u1ea3i d\u1eef li\u1ec7u."
      : "Could not load data.",
  )
}

export function MemberDashboard() {
  const navigate = useNavigate()
  const { currentUser, language, apiEnabled } = useSCMS()
  const isVi = language === "vi"
  const memberId = getAuthoritativeProfileId(currentUser)
  const validMemberId = Number.isInteger(memberId) && memberId > 0
  const memberName = String(currentUser?.name || "").trim()
  const [resources, setResources] = useState(EMPTY_RESOURCES)
  const [refreshToken, setRefreshToken] = useState(0)
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrPayload, setQrPayload] = useState("")
  const [qrExpiresAt, setQrExpiresAt] = useState(null)
  const [qrSecondsLeft, setQrSecondsLeft] = useState(0)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrError, setQrError] = useState("")
  const qrRequestId = useRef(0)
  const qrLoadingRef = useRef(false)

  const retryDashboard = useCallback(() => {
    setRefreshToken((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!apiEnabled) {
      setResources(
        Object.fromEntries(
          RESOURCE_KEYS.map((key) => [
            key,
            {
              loading: false,
              data: null,
              error: isVi
                ? "API chưa được bật trong môi trường hiện tại."
                : "API is disabled in this environment.",
            },
          ]),
        ),
      )
      return undefined
    }

    let active = true
    const controller = new AbortController()
    setResources((current) =>
      Object.fromEntries(
        RESOURCE_KEYS.map((key) => [
          key,
          { ...current[key], loading: true, data: null, error: "" },
        ]),
      ),
    )

    const setResourceResult = (key, result) => {
      if (!active) return
      setResources((current) => ({ ...current, [key]: result }))
    }

    const loadResource = async (key, request) => {
      try {
        const data = await request()
        setResourceResult(key, { loading: false, data, error: "" })
      } catch (error) {
        if (error?.name === "AbortError") return
        setResourceResult(key, {
          loading: false,
          data: null,
          error: getDashboardResourceError(error, key, isVi),
        })
      }
    }

    const startTimer = setTimeout(() => {
      const listFrom = async (path, label) =>
        extractRequiredList(
          await httpClient.get(path, { signal: controller.signal }),
          label,
        )

      const jobs = []
      if (validMemberId) {
        const encodedId = encodeURIComponent(memberId)
        jobs.push(
          loadResource("enrollments", () =>
            listFrom(`/api/members/${encodedId}/enrollments`, "Lớp đã đăng ký"),
          ),
          loadResource("subscriptions", () =>
            listFrom(`/api/members/${encodedId}/subscriptions`, "Gói hội viên"),
          ),
          loadResource("sessions", async () => {
            const list = await listFrom(
              `/api/sessions?memberId=${encodedId}`,
              "Lịch học",
            )
            return list.filter(
              (session) =>
                String(session?.bookedMemberId ?? "") === String(memberId),
            )
          }),
          loadResource("attendance", async () => {
            const list = await listFrom(
              `/api/attendances?memberId=${encodedId}`,
              "Điểm danh",
            )
            return list.filter(
              (item) => String(item?.memberId ?? "") === String(memberId),
            )
          }),
        )
      } else {
        const identityError = isVi
          ? "Phiên đăng nhập chưa cung cấp ID hồ sơ hội viên đã xác thực."
          : "The authenticated session has no verified member profile ID."
        for (const key of [
          "enrollments",
          "subscriptions",
          "sessions",
          "attendance",
        ]) {
          setResourceResult(key, {
            loading: false,
            data: null,
            error: identityError,
          })
        }
      }

      jobs.push(
        loadResource("invoices", async () => {
          const list = await listFrom("/api/members/me/invoices", "Hóa đơn")
          return list.map(mapInvoice).filter(Boolean)
        }),
        loadResource("notifications", () =>
          listFrom("/api/notifications/me", "Thông báo"),
        ),
      )

      Promise.allSettled(jobs)
    }, 0)

    return () => {
      active = false
      clearTimeout(startTimer)
      controller.abort()
    }
  }, [apiEnabled, isVi, memberId, validMemberId, refreshToken])

  const enrollments = (resources.enrollments.data || []).filter(
    (item) =>
      item?.memberId === null ||
      item?.memberId === undefined ||
      String(item.memberId) === String(memberId),
  )
  const subscriptions = (resources.subscriptions.data || []).filter(
    (item) =>
      item?.memberId === null ||
      item?.memberId === undefined ||
      String(item.memberId) === String(memberId),
  )
  const attendance = (resources.attendance.data || []).filter(
    (item) => String(item?.memberId ?? "") === String(memberId),
  )
  const invoices = resources.invoices.data || []
  const notifications = resources.notifications.data || []
  const normalEnrollments = useMemo(
    () => enrollments.filter(isActiveNormalEnrollment),
    [enrollments],
  )
  const normalSubscriptions = useMemo(
    () =>
      subscriptions.filter((subscription) =>
        normalizeState(subscription?.packageType).includes("normal"),
      ),
    [subscriptions],
  )
  const advancedSubscriptions = useMemo(
    () =>
      subscriptions.filter((subscription) =>
        normalizeState(subscription?.packageType).includes("advanced"),
      ),
    [subscriptions],
  )
  const activeAdvancedSubscriptions = useMemo(
    () => advancedSubscriptions.filter(isActiveAdvancedSubscription),
    [advancedSubscriptions],
  )

  const upcomingSessions = useMemo(() => {
    const apiSessions = resources.sessions.data || []
    const enrollmentSessions = enrollments.flatMap((enrollment) => {
      const nested =
        enrollment?.sessions ||
        enrollment?.classSessions ||
        enrollment?.scheduledSessions
      const enrollmentMemberId = enrollment?.memberId
      if (
        !Array.isArray(nested) ||
        (enrollmentMemberId !== null &&
          enrollmentMemberId !== undefined &&
          String(enrollmentMemberId) !== String(memberId)) ||
        !isActiveNormalEnrollment(enrollment)
      ) {
        return []
      }
      return nested.map((session) => ({
        ...session,
        className:
          session?.className || enrollment.className || enrollment.name,
        subjectName: session?.subjectName || enrollment.subjectName,
        coachName: session?.coachName || enrollment.coachName,
        __ownerVerified: true,
      }))
    })
    return getUpcomingSessions(
      [...apiSessions, ...enrollmentSessions],
      memberId,
      getVietnamLocalDateTimeKey(),
    )
  }, [resources.sessions.data, enrollments, memberId])

  const attendedCount = useMemo(
    () => getAttendedCount(attendance, memberId),
    [attendance, memberId],
  )
  const advancedCreditCount = useMemo(
    () => getActiveAdvancedCreditCount(subscriptions),
    [subscriptions],
  )
  const payableInvoices = useMemo(
    () => invoices.filter((invoice) => isPayablePendingInvoice(invoice)),
    [invoices],
  )
  const unreadNotifications = useMemo(
    () => notifications.filter(isUnreadNotification),
    [notifications],
  )
  const nearExpirySubscriptions = useMemo(
    () =>
      advancedSubscriptions.filter((subscription) =>
        isSubscriptionNearExpiry(subscription),
      ),
    [advancedSubscriptions],
  )

  const allEnrolledSessions = useMemo(
    () =>
      enrollments.flatMap(
        (enrollment) =>
          enrollment?.sessions ||
          enrollment?.classSessions ||
          enrollment?.scheduledSessions ||
          [],
      ),
    [enrollments],
  )
  const recentActivity = useMemo(() => {
    const sessionsById = new Map(
      [...(resources.sessions.data || []), ...allEnrolledSessions].map(
        (session) => [String(session?.id ?? session?.sessionId ?? ""), session],
      ),
    )
    return [...attendance]
      .map((item) => {
        const session = sessionsById.get(String(item?.sessionId ?? ""))
        const activityDate =
          item?.checkInTime ||
          item?.checkOutTime ||
          item?.sessionDate ||
          session?.sessionDate ||
          null
        const timestamp = toTimestamp(activityDate)
        return { item, session, activityDate, timestamp }
      })
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 4)
  }, [attendance, resources.sessions.data, allEnrolledSessions])

  const loadQrCode = useCallback(async () => {
    if (qrLoadingRef.current) return
    qrLoadingRef.current = true
    const requestId = qrRequestId.current + 1
    qrRequestId.current = requestId
    setQrLoading(true)
    setQrError("")
    setQrPayload("")
    setQrExpiresAt(null)
    setQrSecondsLeft(0)
    try {
      const response = await httpClient.get("/api/attendances/me/checkin-code")
      if (qrRequestId.current !== requestId) return
      const payload =
        typeof response?.payload === "string" ? response.payload : ""
      const ttl = Number(response?.expiresInSeconds)
      if (!payload || !Number.isFinite(ttl) || ttl < 1 || ttl > 30) {
        throw new Error(
          isVi
            ? "API chưa trả mã QR hợp lệ hoặc thời hạn mã không hợp lệ."
            : "The API did not return a valid QR payload and expiry time.",
        )
      }
      setQrPayload(payload)
      setQrSecondsLeft(ttl)
      setQrExpiresAt(Date.now() + ttl * 1000)
    } catch (error) {
      if (qrRequestId.current !== requestId) return
      setQrError(
        getErrorMessage(
          error,
          isVi ? "Không thể tải mã check-in." : "Could not load check-in code.",
        ),
      )
    } finally {
      qrLoadingRef.current = false
      if (qrRequestId.current === requestId) setQrLoading(false)
    }
  }, [isVi])

  const handleOpenQr = () => {
    setShowQrModal(true)
    loadQrCode()
  }

  useEffect(() => {
    if (!showQrModal || !qrExpiresAt || !qrPayload) return undefined
    const updateCountdown = () => {
      const seconds = Math.max(0, Math.ceil((qrExpiresAt - Date.now()) / 1000))
      setQrSecondsLeft(seconds)
    }
    updateCountdown()
    const intervalId = window.setInterval(updateCountdown, 250)
    const timeoutId = window.setTimeout(
      loadQrCode,
      Math.max(0, qrExpiresAt - Date.now()),
    )
    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
    }
  }, [showQrModal, qrExpiresAt, qrPayload, loadQrCode])

  useEffect(() => {
    if (!showQrModal) return undefined
    const refreshExpiredQrOnForeground = () => {
      if (
        document.visibilityState === "visible" &&
        qrExpiresAt &&
        Date.now() >= qrExpiresAt
      ) {
        loadQrCode()
      }
    }
    document.addEventListener("visibilitychange", refreshExpiredQrOnForeground)
    window.addEventListener("focus", refreshExpiredQrOnForeground)
    return () => {
      document.removeEventListener(
        "visibilitychange",
        refreshExpiredQrOnForeground,
      )
      window.removeEventListener("focus", refreshExpiredQrOnForeground)
    }
  }, [showQrModal, qrExpiresAt, loadQrCode])

  useEffect(() => {
    if (!showQrModal) return undefined
    const onKeyDown = (event) => {
      if (event.key === "Escape") setShowQrModal(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [showQrModal])

  const retryResource = () => retryDashboard()
  const locale = isVi ? "vi-VN" : "en-US"
  const unavailable = isVi ? "Ch\u01b0a c\u00f3 th\u00f4ng tin" : "Not provided"
  const hasNoPackages =
    !resources.enrollments.loading &&
    !resources.subscriptions.loading &&
    !resources.enrollments.error &&
    !resources.subscriptions.error &&
    normalEnrollments.length === 0 &&
    normalSubscriptions.length === 0 &&
    advancedSubscriptions.length === 0

  const attentionItems = [
    ...payableInvoices.map((invoice) => ({
      key: `invoice-${invoice.invoiceId}`,
      icon: CreditCard,
      title: isVi
        ? `Hóa đơn ${invoice.invoiceCode || `#${invoice.invoiceId}`} đang chờ thanh toán`
        : `Invoice ${invoice.invoiceCode || `#${invoice.invoiceId}`} is awaiting payment`,
      detail: invoice.expiresAt
        ? `${
            isVi ? "Hết hạn lúc" : "Expires"
          } ${formatVietnamDateTime(invoice.expiresAt, null, locale)}`
        : "",
      action: isVi ? "Xem hóa đơn" : "View invoice",
      onAction: () => navigate("/member/invoices"),
    })),
    ...unreadNotifications.slice(0, 2).map((notification, index) => ({
      key: `notification-${notification.id || index}`,
      icon: Bell,
      title: getNotificationTitle(notification, isVi),
      detail: notification.message || notification.description || "",
      action: isVi ? "Mở thông báo" : "Open notifications",
      onAction: () => navigate("/member/notifications"),
    })),
    ...nearExpirySubscriptions.map((subscription) => ({
      key: `expiry-${subscription.subscriptionId || subscription.id}`,
      icon: Clock3,
      title: isVi
        ? `Gói ${subscription.subjectName || unavailable} sắp hết hạn`
        : `${subscription.subjectName || "Advanced"} package expires soon`,
      detail: `${
        isVi ? "Hạn sử dụng" : "Expires"
      }: ${formatVietnamDateTime(subscription.expiresAt, null, locale)}`,
      action: isVi ? "Xem gói học" : "View packages",
      onAction: () => navigate("/member/my-membership"),
    })),
  ]

  const kpis = [
    {
      icon: UsersRound,
      label: isVi ? "Lớp Normal đang tham gia" : "Active Normal classes",
      value: normalEnrollments.length,
      caption: isVi
        ? "Chỉ các ghi danh đã xác nhận"
        : "Confirmed enrollments only",
      tone: "red",
      resource: resources.enrollments,
    },
    {
      icon: CheckCircle2,
      label: isVi ? "Buổi đã tham gia" : "Sessions attended",
      value: attendedCount,
      caption: isVi
        ? "Theo điểm danh Có mặt/Đi trễ"
        : "Based on Present/Late attendance",
      tone: "green",
      resource: resources.attendance,
    },
    {
      icon: CalendarDays,
      label: isVi ? "Buổi học sắp tới" : "Upcoming sessions",
      value: upcomingSessions.length,
      caption: isVi
        ? "Lịch đã xác nhận trong tương lai"
        : "Confirmed future schedule",
      tone: "blue",
      resource: resources.sessions,
    },
    {
      icon: Dumbbell,
      label: isVi ? "Credit Advanced còn lại" : "Advanced credits remaining",
      value: advancedCreditCount,
      caption: isVi
        ? "T\u1ed5ng th\u1ed1ng k\u00ea, kh\u00f4ng ph\u1ea3i v\u00ed d\u00f9ng chung; credit ri\u00eang t\u1eebng g\u00f3i"
        : "Statistical total only, not a shared wallet; credits stay with each package",
      tone: "amber",
      resource: resources.subscriptions,
    },
  ]

  return (
    <main className="min-h-full w-full overflow-x-hidden bg-slate-50/70 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="w-full space-y-6 lg:space-y-7">
        <header className="flex flex-col justify-between gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-brand-accent-dark">
              VIBE SPORT · MEMBER
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-[2rem]">
              {isVi ? "Tổng quan" : "Overview"}
            </h1>
            <p className="mt-1 text-lg font-semibold text-slate-800">
              {isVi
                ? `Xin chào${memberName ? `, ${memberName}` : ""}!`
                : `Welcome${memberName ? `, ${memberName}` : ""}!`}
            </p>
            <p className="mt-1 max-w-2xl text-[15px] leading-6 text-slate-600">
              {isVi
                ? "Theo dõi lớp học, lịch tập và các gói hội viên của bạn tại đây."
                : "Keep track of your classes, schedule, and memberships here."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-slate-600">
              {validMemberId && (
                <span>
                  {isVi ? "Mã hội viên" : "Member ID"}:{" "}
                  <strong className="font-semibold text-slate-800">
                    {memberId}
                  </strong>
                </span>
              )}
              {currentUser?.email && (
                <span className="break-all">{currentUser.email}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleOpenQr}
            disabled={!apiEnabled}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-[15px] font-semibold text-white shadow-sm transition hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent-dark focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <QrCode className="h-4 w-4" aria-hidden="true" />
            {isVi ? "Mã QR Check-in" : "Check-in QR"}
          </button>
        </header>

        <section
          aria-label={isVi ? "Tóm tắt hội viên" : "Member summary"}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {kpis.map((item) => (
            <KpiCard
              key={item.label}
              icon={item.icon}
              label={item.label}
              value={item.value}
              caption={item.caption}
              tone={item.tone}
              loading={item.resource.loading}
              error={Boolean(item.resource.error)}
              isVi={isVi}
            />
          ))}
        </section>

        <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
          <div className="min-w-0 space-y-6 xl:col-span-2">
            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] sm:p-6">
              <SectionHeading
                icon={ShieldCheck}
                title={
                  isVi
                    ? "Gói học và lớp đang tham gia"
                    : "My memberships and classes"
                }
                action={isVi ? "Xem gói học" : "View memberships"}
                onAction={() => navigate("/member/my-membership")}
              />
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-[13px] font-bold uppercase tracking-wide text-slate-500">
                    Normal
                  </p>
                  <p className="mt-1 text-[15px] text-slate-700">
                    {isVi ? "Lớp nhóm đã đăng ký" : "Enrolled group classes"}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">
                    {resources.enrollments.loading
                      ? "—"
                      : resources.enrollments.error
                        ? "—"
                        : normalEnrollments.length}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-[13px] font-bold uppercase tracking-wide text-slate-500">
                    Advanced
                  </p>
                  <p className="mt-1 text-[15px] text-slate-700">
                    {isVi ? "Gói theo môn thể thao" : "Sport-specific packages"}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-950">
                    {resources.subscriptions.loading
                      ? "—"
                      : resources.subscriptions.error
                        ? "—"
                        : activeAdvancedSubscriptions.length}
                  </p>
                </div>
              </div>

              {(resources.enrollments.error ||
                resources.subscriptions.error) && (
                <div className="mb-4 space-y-2">
                  {resources.enrollments.error && (
                    <ResourceError
                      message={resources.enrollments.error}
                      onRetry={retryResource}
                      compact
                      isVi={isVi}
                    />
                  )}
                  {resources.subscriptions.error && (
                    <ResourceError
                      message={resources.subscriptions.error}
                      onRetry={retryResource}
                      compact
                      isVi={isVi}
                    />
                  )}
                </div>
              )}

              {resources.enrollments.loading ||
              resources.subscriptions.loading ? (
                <LoadingBlock rows={3} />
              ) : hasNoPackages ? (
                <div className="rounded-xl border border-dashed border-slate-300 px-5 py-9 text-center">
                  <Dumbbell
                    className="mx-auto h-8 w-8 text-slate-400"
                    aria-hidden="true"
                  />
                  <h3 className="mt-3 text-base font-semibold text-slate-900">
                    {isVi
                      ? "Bạn chưa có lớp hoặc gói học đang hoạt động"
                      : "No active classes or packages"}
                  </h3>
                  <p className="mt-1 text-[15px] text-slate-600">
                    {isVi
                      ? "Khám phá các khóa học hiện có để bắt đầu."
                      : "Explore available courses to get started."}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate("/member/catalog")}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2"
                  >
                    {isVi ? "Khám phá khóa học" : "Explore courses"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {!resources.subscriptions.error &&
                    normalSubscriptions.length > 0 && (
                      <div>
                        <h3 className="mb-3 text-base font-bold text-slate-800">
                          {isVi ? "Gói Normal" : "Normal packages"}
                        </h3>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {normalSubscriptions.map((subscription, index) => (
                            <article
                              key={
                                subscription.subscriptionId ||
                                subscription.id ||
                                `normal-${index}`
                              }
                              className="min-w-0 rounded-xl border border-slate-200 p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[13px] font-semibold uppercase tracking-wide text-brand-primary">
                                    Normal
                                  </p>
                                  <h4 className="mt-1 truncate text-base font-bold text-slate-950">
                                    {subscription.packageName || unavailable}
                                  </h4>
                                </div>
                                <span
                                  className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] font-semibold ${
                                    normalizeState(subscription.status) ===
                                    "active"
                                      ? "bg-emerald-50 text-emerald-800"
                                      : normalizeState(
                                            subscription.status,
                                          ).startsWith("pending")
                                        ? "bg-amber-50 text-amber-900"
                                        : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {getStatusLabel(subscription.status, isVi)}
                                </span>
                              </div>
                              <dl className="mt-4 grid grid-cols-1 gap-2 text-[15px] text-slate-600">
                                <div className="flex justify-between gap-3">
                                  <dt>{isVi ? "Môn" : "Subject"}</dt>
                                  <dd className="text-right">
                                    {subscription.subjectName || unavailable}
                                  </dd>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <dt>
                                    {isVi ? "HLV chính" : "Primary Coach"}
                                  </dt>
                                  <dd className="text-right">
                                    {subscription.primaryCoachName ||
                                      unavailable}
                                  </dd>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <dt>{isVi ? "Kích hoạt" : "Activated"}</dt>
                                  <dd className="text-right">
                                    {formatVietnamDateTime(
                                      subscription.activatedAt,
                                      null,
                                      locale,
                                    ) || unavailable}
                                  </dd>
                                </div>
                                <div className="flex justify-between gap-3">
                                  <dt>{isVi ? "Hết hạn" : "Expires"}</dt>
                                  <dd className="text-right">
                                    {formatVietnamDateTime(
                                      subscription.expiresAt,
                                      null,
                                      locale,
                                    ) || unavailable}
                                  </dd>
                                </div>
                              </dl>
                            </article>
                          ))}
                        </div>
                      </div>
                    )}

                  {!resources.enrollments.error &&
                    normalEnrollments.length > 0 && (
                      <div>
                        <h3 className="mb-3 text-[15px] font-bold text-slate-800">
                          {isVi ? "Lớp Normal" : "Normal classes"}
                        </h3>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {normalEnrollments.map((enrollment, index) => {
                            const sessions =
                              enrollment.sessions ||
                              enrollment.classSessions ||
                              enrollment.scheduledSessions
                            const scheduledSessionCount = Array.isArray(
                              sessions,
                            )
                              ? sessions.filter(
                                  (session) =>
                                    normalizeState(session?.status) ===
                                    "scheduled",
                                ).length
                              : null
                            const enrollmentName =
                              enrollment.className ||
                              enrollment.subjectName ||
                              enrollment.name
                            return (
                              <article
                                key={
                                  enrollment.id ||
                                  enrollment.enrollmentId ||
                                  `${enrollment.classId || "normal"}-${index}`
                                }
                                className="min-w-0 rounded-xl border border-slate-200 p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-[13px] font-semibold uppercase tracking-wide text-brand-accent-dark">
                                      {enrollment.subjectName ||
                                        (isVi ? "Lớp nhóm" : "Group class")}
                                    </p>
                                    <h4 className="mt-1 truncate text-base font-bold text-slate-950">
                                      {enrollmentName ||
                                        (isVi
                                          ? "Lớp đã đăng ký"
                                          : "Enrolled class")}
                                    </h4>
                                  </div>
                                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[13px] font-semibold text-emerald-800">
                                    {getStatusLabel(enrollment.status, isVi)}
                                  </span>
                                </div>
                                <dl className="mt-4 space-y-2 text-[15px] text-slate-600">
                                  <div className="flex items-center gap-2">
                                    <UserRound className="h-4 w-4 shrink-0 text-slate-400" />
                                    <dt className="sr-only">Coach</dt>
                                    <dd>
                                      {enrollment.coachName ||
                                        (isVi
                                          ? "Chưa có dữ liệu huấn luyện viên"
                                          : "Coach information unavailable")}
                                    </dd>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
                                    <dt className="sr-only">Sessions</dt>
                                    <dd>
                                      {scheduledSessionCount !== null
                                        ? `${scheduledSessionCount} ${
                                            isVi
                                              ? "buổi đã lên lịch"
                                              : "scheduled sessions"
                                          }`
                                        : isVi
                                          ? "Chưa có dữ liệu số buổi"
                                          : "Session count unavailable"}
                                    </dd>
                                  </div>
                                </dl>
                                <button
                                  type="button"
                                  onClick={() => navigate("/member/schedule")}
                                  className="mt-4 inline-flex items-center gap-1.5 text-[15px] font-semibold text-brand-primary hover:text-brand-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent-dark"
                                >
                                  {isVi ? "Xem lịch học" : "View schedule"}
                                  <ArrowRight className="h-4 w-4" />
                                </button>
                              </article>
                            )
                          })}
                        </div>
                      </div>
                    )}

                  {!resources.subscriptions.error &&
                    advancedSubscriptions.length > 0 && (
                      <div>
                        <h3 className="mb-3 text-[15px] font-bold text-slate-800">
                          {isVi ? "Gói Advanced" : "Advanced packages"}
                        </h3>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {advancedSubscriptions.map((subscription, index) => {
                            const subject =
                              subscription.subjectName || unavailable
                            const expiry = subscription.expiresAt
                            return (
                              <article
                                key={
                                  subscription.subscriptionId ||
                                  subscription.id ||
                                  `advanced-${index}`
                                }
                                className="min-w-0 rounded-xl border border-slate-200 p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-[13px] font-semibold uppercase tracking-wide text-brand-purple-dark">
                                      {subscription.packageName || "Advanced"}
                                    </p>
                                    <h4 className="mt-1 truncate text-base font-bold text-slate-950">
                                      {subject}
                                    </h4>
                                  </div>
                                  <span
                                    className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] font-semibold ${
                                      normalizeState(subscription.status) ===
                                      "active"
                                        ? "bg-emerald-50 text-emerald-800"
                                        : normalizeState(
                                              subscription.status,
                                            ).startsWith("pending")
                                          ? "bg-amber-50 text-amber-900"
                                          : "bg-slate-100 text-slate-700"
                                    }`}
                                  >
                                    {getStatusLabel(subscription.status, isVi)}
                                  </span>
                                </div>
                                <dl className="mt-4 grid grid-cols-1 gap-2 text-[15px] text-slate-600">
                                  <div className="flex items-center justify-between gap-3">
                                    <dt>
                                      {isVi
                                        ? "Huấn luyện viên chính"
                                        : "Primary coach"}
                                    </dt>
                                    <dd className="text-right font-medium text-slate-800">
                                      {subscription.primaryCoachName ||
                                        unavailable}
                                    </dd>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <dt>
                                      {isVi
                                        ? "Credit còn lại"
                                        : "Credits remaining"}
                                    </dt>
                                    <dd className="font-semibold text-slate-900">
                                      {isActiveAdvancedSubscription(
                                        subscription,
                                      )
                                        ? (subscription.remainingCredit ??
                                          unavailable)
                                        : normalizeState(
                                              subscription.status,
                                            ).startsWith("pending")
                                          ? isVi
                                            ? "Chưa kích hoạt"
                                            : "Not activated"
                                          : unavailable}
                                    </dd>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <dt>
                                      {isVi ? "Ngày kích hoạt" : "Activated"}
                                    </dt>
                                    <dd className="text-right">
                                      {formatVietnamDateTime(
                                        subscription.activatedAt,
                                        null,
                                        locale,
                                      ) || unavailable}
                                    </dd>
                                  </div>
                                  <div className="flex items-center justify-between gap-3">
                                    <dt>{isVi ? "Hạn sử dụng" : "Expires"}</dt>
                                    <dd className="text-right">
                                      {formatVietnamDateTime(
                                        expiry,
                                        null,
                                        locale,
                                      ) || unavailable}
                                    </dd>
                                  </div>
                                </dl>
                                {isSubscriptionNearExpiry(subscription) && (
                                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] font-medium text-amber-900">
                                    {isVi
                                      ? "Gói học sắp hết hạn."
                                      : "This package is nearing its expiry date."}
                                  </p>
                                )}
                                <p className="mt-3 text-[13px] text-slate-500">
                                  {isVi
                                    ? "Credit chỉ sử dụng cho môn học của gói này."
                                    : "Credits are limited to this package’s sport."}
                                </p>
                              </article>
                            )
                          })}
                        </div>
                      </div>
                    )}
                </div>
              )}
            </section>

            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] sm:p-6">
              <SectionHeading
                icon={CalendarDays}
                title={isVi ? "Lịch học sắp tới" : "Upcoming sessions"}
                action={isVi ? "Xem tất cả lịch học" : "View all schedule"}
                onAction={() => navigate("/member/schedule")}
              />
              {resources.sessions.loading || resources.enrollments.loading ? (
                <LoadingBlock rows={3} />
              ) : resources.sessions.error && !resources.enrollments.data ? (
                <ResourceError
                  message={resources.sessions.error}
                  onRetry={retryResource}
                  isVi={isVi}
                />
              ) : upcomingSessions.length === 0 ? (
                resources.sessions.error ? (
                  <ResourceError
                    message={resources.sessions.error}
                    onRetry={retryResource}
                    isVi={isVi}
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center">
                    <CalendarDays
                      className="mx-auto h-7 w-7 text-slate-400"
                      aria-hidden="true"
                    />
                    <p className="mt-2 text-[15px] font-semibold text-slate-800">
                      {isVi
                        ? "Chưa có buổi học sắp tới"
                        : "No upcoming sessions"}
                    </p>
                    <p className="mt-1 text-[15px] text-slate-600">
                      {isVi
                        ? "Lịch chỉ hiển thị khi được xác nhận từ hệ thống."
                        : "Only confirmed sessions appear here."}
                    </p>
                  </div>
                )
              ) : (
                <ol className="divide-y divide-slate-100">
                  {upcomingSessions.slice(0, 5).map((session, index) => {
                    const dateLabel = formatVietnamDateTime(
                      session.sessionDate,
                      null,
                      locale,
                    )
                    const start = session.startTime || ""
                    const end = session.endTime || ""
                    return (
                      <li
                        key={
                          session.id ||
                          session.sessionId ||
                          `${getSessionStart(session)}-${index}`
                        }
                        className="flex min-w-0 gap-4 py-4 first:pt-0 last:pb-0"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-accent-soft text-brand-accent-dark">
                          <CalendarDays
                            className="h-5 w-5"
                            aria-hidden="true"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-[15px] font-bold text-slate-900">
                              {session.className ||
                                session.subjectName ||
                                (isVi ? "Buổi tập" : "Training session")}
                            </h3>
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[13px] font-semibold text-blue-800">
                              {getStatusLabel(session.status, isVi)}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[15px] text-slate-600">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                              {dateLabel || "—"}
                              {start && ` · ${start}${end ? `–${end}` : ""}`}
                            </span>
                            {(session.roomName || session.room) && (
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                {session.roomName || session.room}
                              </span>
                            )}
                            {(session.coachName ||
                              session.primaryCoachName) && (
                              <span className="inline-flex items-center gap-1.5">
                                <UserRound className="h-3.5 w-3.5 text-slate-400" />
                                {session.coachName || session.primaryCoachName}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>

            <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] sm:p-6">
              <SectionHeading
                icon={Activity}
                title={isVi ? "Hoạt động gần đây" : "Recent activity"}
              />
              {resources.attendance.loading ? (
                <LoadingBlock rows={3} />
              ) : resources.attendance.error ? (
                <ResourceError
                  message={resources.attendance.error}
                  onRetry={retryResource}
                  isVi={isVi}
                />
              ) : recentActivity.length === 0 ? (
                <div className="rounded-xl bg-slate-50 px-4 py-7 text-center text-[15px] text-slate-600">
                  {isVi
                    ? "Chưa có dữ liệu điểm danh để hiển thị."
                    : "No attendance activity to show yet."}
                </div>
              ) : (
                <ol className="space-y-1">
                  {recentActivity.map(
                    ({ item, session, activityDate }, index) => {
                      const state = normalizeState(item.state || item.status)
                      const isPresent = state === "present" || state === "late"
                      return (
                        <li
                          key={
                            item.id ||
                            `${item.sessionId || "attendance"}-${index}`
                          }
                          className="flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-slate-50"
                        >
                          <span
                            className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                              isPresent
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {isPresent ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <Activity className="h-4 w-4" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-semibold text-slate-900">
                              {session?.className ||
                                session?.subjectName ||
                                (isVi ? "Buổi tập" : "Training session")}
                            </p>
                            <p className="mt-0.5 text-[15px] text-slate-600">
                              {getStatusLabel(state, isVi)}
                              {activityDate
                                ? ` · ${formatVietnamDateTime(activityDate, null, locale)}`
                                : ""}
                            </p>
                          </div>
                        </li>
                      )
                    },
                  )}
                </ol>
              )}
            </section>
          </div>

          <aside className="min-w-0 space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] sm:p-6">
              <SectionHeading
                icon={ArrowRight}
                title={isVi ? "Truy cập nhanh" : "Quick actions"}
              />
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={handleOpenQr}
                  disabled={!apiEnabled}
                  className="flex min-h-12 items-center gap-3 rounded-xl border border-border-color px-3.5 py-3 text-left text-[15px] font-semibold text-text-primary transition hover:border-brand-accent hover:bg-brand-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <QrCode className="h-4 w-4 text-brand-accent-dark" />
                  {isVi ? "Mã QR Check-in" : "Check-in QR"}
                  <ArrowRight className="ml-auto h-4 w-4 text-slate-400" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/member/schedule")}
                  className="flex min-h-12 items-center gap-3 rounded-xl border border-border-color px-3.5 py-3 text-left text-[15px] font-semibold text-text-primary transition hover:border-brand-accent hover:bg-brand-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent-dark"
                >
                  <CalendarDays className="h-4 w-4 text-brand-accent-dark" />
                  {isVi ? "Lịch học của tôi" : "My schedule"}
                  <ArrowRight className="ml-auto h-4 w-4 text-slate-400" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/member/invoices")}
                  className="flex min-h-12 items-center gap-3 rounded-xl border border-border-color px-3.5 py-3 text-left text-[15px] font-semibold text-text-primary transition hover:border-brand-accent hover:bg-brand-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent-dark"
                >
                  <CreditCard className="h-4 w-4 text-brand-accent-dark" />
                  {isVi ? "Hóa đơn" : "Invoices"}
                  <ArrowRight className="ml-auto h-4 w-4 text-slate-400" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/member/my-membership")}
                  className="flex min-h-12 items-center gap-3 rounded-xl border border-border-color px-3.5 py-3 text-left text-[15px] font-semibold text-text-primary transition hover:border-brand-accent hover:bg-brand-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent-dark"
                >
                  <Dumbbell className="h-4 w-4 text-brand-accent-dark" />
                  {isVi ? "Gói học của tôi" : "My memberships"}
                  <ArrowRight className="ml-auto h-4 w-4 text-slate-400" />
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] sm:p-6">
              <SectionHeading
                icon={Bell}
                title={isVi ? "Cần bạn chú ý" : "Needs attention"}
              />
              {resources.invoices.loading ||
              resources.notifications.loading ||
              resources.subscriptions.loading ? (
                <LoadingBlock rows={2} />
              ) : (
                <>
                  {(resources.invoices.error ||
                    resources.notifications.error ||
                    resources.subscriptions.error) && (
                    <div className="mb-3 space-y-2">
                      {resources.invoices.error && (
                        <ResourceError
                          message={resources.invoices.error}
                          onRetry={retryResource}
                          compact
                          isVi={isVi}
                        />
                      )}
                      {resources.notifications.error && (
                        <ResourceError
                          message={resources.notifications.error}
                          onRetry={retryResource}
                          compact
                          isVi={isVi}
                        />
                      )}
                      {resources.subscriptions.error && (
                        <ResourceError
                          message={resources.subscriptions.error}
                          onRetry={retryResource}
                          compact
                          isVi={isVi}
                        />
                      )}
                    </div>
                  )}
                  {attentionItems.length === 0 ? (
                    resources.invoices.error ||
                    resources.notifications.error ||
                    resources.subscriptions.error ? null : (
                      <div className="rounded-xl bg-emerald-50 px-4 py-4 text-[15px] text-emerald-900">
                        <p className="flex items-center gap-2 font-semibold">
                          <CheckCircle2 className="h-4 w-4" />
                          {isVi
                            ? "Chưa có việc nào cần xử lý"
                            : "Nothing needs your attention"}
                        </p>
                      </div>
                    )
                  ) : (
                    <ul className="space-y-3">
                      {attentionItems.map((item) => {
                        const Icon = item.icon
                        return (
                          <li
                            key={item.key}
                            className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5"
                          >
                            <div className="flex items-start gap-2.5">
                              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
                              <div className="min-w-0">
                                <p className="text-[15px] font-semibold text-amber-950">
                                  {item.title}
                                </p>
                                {item.detail && (
                                  <p className="mt-1 text-[13px] leading-5 text-amber-900">
                                    {item.detail}
                                  </p>
                                )}
                                <button
                                  type="button"
                                  onClick={item.onAction}
                                  className="mt-2 text-[15px] font-semibold text-brand-primary underline underline-offset-2 hover:text-brand-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent-dark"
                                >
                                  {item.action}
                                </button>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white shadow-sm sm:p-6">
              <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-brand-accent-soft">
                VIBE SPORT
              </p>
              <h2 className="mt-2 text-lg font-bold">
                {isVi
                  ? "Sẵn sàng cho buổi tập tiếp theo?"
                  : "Ready for your next session?"}
              </h2>
              <p className="mt-1 text-[15px] leading-6 text-slate-300">
                {isVi
                  ? "Xem lịch đã được xác nhận để chủ động sắp xếp thời gian."
                  : "Review your confirmed schedule and plan ahead."}
              </p>
              <button
                type="button"
                onClick={() => navigate("/member/schedule")}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2.5 text-[15px] font-semibold text-brand-primary transition hover:bg-brand-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-primary"
              >
                {isVi ? "Mở lịch học" : "Open schedule"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </section>
          </aside>
        </section>
      </div>

      {showQrModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowQrModal(false)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-checkin-title"
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[13px] font-bold uppercase tracking-wide text-brand-accent-dark">
                  VIBE SPORT
                </p>
                <h2
                  id="member-checkin-title"
                  className="mt-1 text-lg font-bold text-slate-950"
                >
                  {isVi ? "Mã QR Check-in" : "Check-in QR"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                aria-label={isVi ? "Đóng" : "Close"}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-4 text-[15px] leading-6 text-slate-600">
              {isVi
                ? "Mã QR được cấp từ hệ thống và tự làm mới khi hết hạn. Đưa mã cho nhân viên để check-in."
                : "This QR is issued by the system and refreshes when it expires. Present it to staff to check in."}
            </p>
            <div className="mt-4 flex min-h-[248px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-4">
              {qrLoading ? (
                <div className="text-center text-[15px] text-slate-600">
                  <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-brand-primary" />
                  {isVi ? "Đang lấy mã check-in…" : "Loading check-in code…"}
                </div>
              ) : qrError ? (
                <div className="w-full">
                  <ResourceError
                    message={qrError}
                    onRetry={loadQrCode}
                    isVi={isVi}
                  />
                </div>
              ) : qrPayload ? (
                <div className="text-center">
                  <div className="inline-flex rounded-xl bg-white p-3 shadow-sm">
                    <QRCodeSVG value={qrPayload} size={208} level="M" />
                  </div>
                  <p className="mt-3 text-[15px] text-slate-600">
                    {isVi ? "Mã làm mới sau" : "Refreshes in"}{" "}
                    <strong className="font-semibold text-brand-primary">
                      {qrSecondsLeft}s
                    </strong>
                  </p>
                </div>
              ) : (
                <p className="text-[15px] text-slate-600">
                  {isVi
                    ? "Chưa có mã check-in."
                    : "No check-in code available."}
                </p>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-[15px] font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600"
              >
                {isVi ? "Đóng" : "Close"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default MemberDashboard
