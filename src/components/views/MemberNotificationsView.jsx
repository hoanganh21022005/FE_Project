import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
  Bell,
  CheckCheck,
  Calendar,
  CreditCard,
  AlertTriangle,
  Info,
  Clock,
  Filter,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import { notificationApi } from "../../api/notificationApi"
import { getErrorMessage } from "../../api/apiErrors"
import { PageHeader } from "../ui/PageHeader"

const categorizeNotificationType = (rawType) => {
  const t = String(rawType || "").toUpperCase()
  if (
    t.includes("ENROLLMENT") ||
    t.includes("PRIVATE_BOOKING") ||
    t.includes("SESSION") ||
    t.includes("COACH") ||
    t.includes("NO_SHOW") ||
    t === "CLASS"
  ) {
    return "class"
  }
  if (t.includes("PAYMENT") || t.includes("INVOICE")) {
    return "payment"
  }
  if (t.includes("PACKAGE") || t.includes("CREDIT") || t === "MEMBERSHIP") {
    return "membership"
  }
  return "system"
}

const getNotificationActionLink = (item, isVi) => {
  const cat = categorizeNotificationType(item.type)
  if (cat === "payment") {
    return {
      path: "/member/invoices",
      label: isVi ? "Xem hóa đơn" : "View invoices",
    }
  }
  if (cat === "class") {
    return {
      path: "/member/schedule",
      label: isVi ? "Xem lịch tập" : "View schedule",
    }
  }
  if (cat === "membership") {
    return {
      path: "/member/my-membership",
      label: isVi ? "Xem gói hội viên" : "View membership",
    }
  }
  return null
}

const formatDateTime = (value, isVi) => {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString(isVi ? "vi-VN" : "en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function MemberNotificationsView() {
  const navigate = useNavigate()
  const { language, apiEnabled, showToast } = useSCMS()
  const isVi = language === "vi"

  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(Boolean(apiEnabled))
  const [error, setError] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [busyId, setBusyId] = useState(null)

  const loadNotifications = useCallback(async () => {
    if (!apiEnabled) return
    setLoading(true)
    setError("")
    try {
      const res = await notificationApi.getMyNotifications({
        page: 0,
        size: 50,
      })
      setNotifications(Array.isArray(res?.items) ? res.items : [])
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          isVi
            ? "Không thể tải danh sách thông báo từ máy chủ."
            : "Could not load notifications from server.",
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [apiEnabled, isVi])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  )

  const notifyHeaderSync = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("scms:notifications-updated"))
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      if (apiEnabled) {
        await notificationApi.markAllNotificationsRead()
      }
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      notifyHeaderSync()
      showToast(
        isVi
          ? "Đã đánh dấu đọc toàn bộ thông báo."
          : "Marked all notifications as read.",
        "success",
      )
    } catch (err) {
      showToast(
        getErrorMessage(
          err,
          isVi
            ? "Không thể cập nhật trạng thái thông báo."
            : "Could not update notification status.",
        ),
        "error",
      )
    }
  }

  const handleMarkAsRead = async (item) => {
    if (!item || item.isRead) return
    setBusyId(item.id)
    try {
      if (apiEnabled) {
        await notificationApi.markNotificationRead(item.id)
      }
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
      )
      notifyHeaderSync()
    } catch (err) {
      showToast(
        getErrorMessage(
          err,
          isVi
            ? "Không thể đánh dấu đã đọc thông báo."
            : "Could not mark notification as read.",
        ),
        "error",
      )
    } finally {
      setBusyId(null)
    }
  }

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (filterType === "unread") return !n.isRead
      if (filterType === "all") return true
      return categorizeNotificationType(n.type) === filterType
    })
  }, [notifications, filterType])

  const getIcon = (rawType) => {
    const cat = categorizeNotificationType(rawType)
    switch (cat) {
      case "class":
        return <Calendar className="w-4 h-4 text-blue-600" />
      case "payment":
        return <CreditCard className="w-4 h-4 text-emerald-600" />
      case "membership":
        return <Info className="w-4 h-4 text-amber-600" />
      default:
        return <AlertTriangle className="w-4 h-4 text-slate-600" />
    }
  }

  return (
    <main className="w-full space-y-6 px-4 py-5 sm:px-6 lg:px-8">
      {/* Header */}
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {isVi ? "Trung tâm thông báo" : "Notifications"}
            {unreadCount > 0 && (
              <span className="rounded-full bg-brand-primary px-2.5 py-0.5 text-xs font-extrabold text-white">
                {unreadCount} {isVi ? "mới" : "new"}
              </span>
            )}
          </span>
        }
        description={isVi
          ? "Cập nhật thời gian thực về lịch tập, trạng thái thanh toán, nhắc buổi học và thông tin từ trung tâm."
          : "Real-time updates on your training schedule, payments, session reminders, and center news."}
        actions={
          <div className="flex items-center gap-2">
            {apiEnabled && (
              <button
                type="button"
                onClick={loadNotifications}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                />
                <span>{isVi ? "Tải lại" : "Refresh"}</span>
              </button>
            )}
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              >
                <CheckCheck className="w-4 h-4 text-emerald-600" />
                <span>
                  {isVi ? "Đánh dấu tất cả đã đọc" : "Mark all as read"}
                </span>
              </button>
            )}
          </div>
        }
      />

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mr-2">
          <Filter className="w-3.5 h-3.5" />
          {isVi ? "Lọc theo:" : "Filter:"}
        </span>
        {[
          { key: "all", labelVi: "Tất cả", labelEn: "All" },
          {
            key: "unread",
            labelVi: `Chưa đọc (${unreadCount})`,
            labelEn: `Unread (${unreadCount})`,
          },
          { key: "class", labelVi: "Lịch tập & Lớp", labelEn: "Classes" },
          {
            key: "payment",
            labelVi: "Hóa đơn & Thanh toán",
            labelEn: "Billing",
          },
          { key: "membership", labelVi: "Gói hội viên", labelEn: "Membership" },
          { key: "system", labelVi: "Hệ thống & Hỗ trợ", labelEn: "System" },
        ].map((tab) => (
          <button
            type="button"
            key={tab.key}
            onClick={() => setFilterType(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              filterType === tab.key
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {isVi ? tab.labelVi : tab.labelEn}
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-status-error"
        >
          {error}
        </div>
      )}

      {/* Notification List */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          {isVi ? "Đang tải thông báo từ hệ thống…" : "Loading notifications…"}
        </div>
      ) : filtered.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <Bell className="mx-auto h-9 w-9 text-slate-400" />
          <h2 className="mt-3 text-lg font-bold text-slate-900">
            {isVi ? "Không có thông báo nào" : "No notifications"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isVi
              ? "Khi có cập nhật về lịch tập, hóa đơn hoặc gói hội viên, hệ thống sẽ hiển thị tại đây."
              : "Updates about your classes, invoices, and membership will appear here."}
          </p>
        </section>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const action = getNotificationActionLink(item, isVi)
            return (
              <article
                key={item.id}
                onClick={() => handleMarkAsRead(item)}
                className={`rounded-xl border p-4 sm:p-5 transition-all cursor-pointer ${
                  item.isRead
                    ? "border-slate-200 bg-white hover:border-slate-300"
                    : "border-brand-accent/40 bg-brand-accent-soft/30 shadow-2xs hover:border-brand-accent"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="mt-0.5 rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs shrink-0">
                      {getIcon(item.type)}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2
                          className={`text-sm ${
                            item.isRead
                              ? "font-bold text-slate-800"
                              : "font-extrabold text-slate-950"
                          }`}
                        >
                          {item.title ||
                            (isVi ? "Thông báo hệ thống" : "Notification")}
                        </h2>
                        {!item.isRead && (
                          <span className="inline-flex items-center rounded-full bg-brand-primary px-2 py-0.5 text-xs font-bold text-white">
                            {isVi ? "Mới" : "New"}
                          </span>
                        )}
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-500">
                          {item.type}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {item.message}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDateTime(item.createdAt, isVi)}
                        </span>
                        {action && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleMarkAsRead(item)
                              navigate(action.path)
                            }}
                            className="inline-flex items-center gap-1 font-bold text-brand-accent-dark hover:text-brand-primary-hover cursor-pointer"
                          >
                            <span>{action.label}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {!item.isRead ? (
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMarkAsRead(item)
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        {isVi ? "Đánh dấu đã đọc" : "Mark read"}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isVi ? "Đã đọc" : "Read"}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </main>
  )
}
