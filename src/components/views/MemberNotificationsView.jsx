import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
  Bell,
  CheckCheck,
  Calendar,
  CreditCard,
  Receipt,
  MessageSquare,
  AlertTriangle,
  Info,
  Clock,
  Search,
  SlidersHorizontal,
  RotateCcw,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  Settings,
  Headphones,
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import { notificationApi } from "../../api/notificationApi"
import { getErrorMessage } from "../../api/apiErrors"
import { PageHeader } from "../ui/PageHeader"

const getNotificationKind = (rawType) => {
  const t = String(rawType || "").toUpperCase()
  if (t.includes("CHAT") || t.includes("SUPPORT")) return "support"
  if (t.includes("INCIDENT") || t.includes("CENTER_ALERT")) return "incident"
  if (
    t.includes("ENROLLMENT") ||
    t.includes("PRIVATE_BOOKING") ||
    t.includes("SCHEDULE") ||
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

const categorizeNotificationType = (rawType) => {
  const kind = getNotificationKind(rawType)
  return ["support", "incident", "system"].includes(kind) ? "system" : kind
}

const getNotificationTypeLabel = (rawType, isVi) => {
  const kind = getNotificationKind(rawType)
  const labels = {
    support: isVi ? "Phản hồi hỗ trợ" : "Support reply",
    incident: isVi ? "Sự cố & Bảo lưu" : "Incident & service update",
    class: isVi ? "Nhắc lịch tập" : "Training reminder",
    payment: isVi ? "Hóa đơn & Thanh toán" : "Billing & payment",
    membership: isVi ? "Gói hội viên" : "Membership",
    system: isVi ? "Hệ thống & Hỗ trợ" : "System & support",
  }
  if (rawType) return labels[kind] || String(rawType).toLowerCase().split(/[_\s-]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")
  return labels.system
}

const getLocalizedNotificationText = (value, isVi) => {
  const text = String(value || "")
  if (!isVi) return text
  const knownTranslations = {
    "New chat reply": "Phản hồi hỗ trợ mới",
    "Staff replied to your support conversation.": "Chuyên viên lễ tân hoặc Trợ lý VIBE đã phản hồi cuộc trò chuyện của bạn.",
    "A concrete center proposal still needs your choice; silence does not waive refund rights": "Trung tâm đã gửi phương án xử lý cụ thể cần bạn xác nhận; việc chưa phản hồi không làm mất quyền hoàn tiền của bạn.",
  }
  return knownTranslations[text.trim()] || text
}

const getNotificationActionLink = (item, isVi) => {
  const kind = getNotificationKind(item.type || item.category)
  if (kind === "support") return { path: "/support", label: isVi ? "Mở khung chat" : "Open support chat" }
  if (kind === "incident") return { path: "/support", label: isVi ? "Liên hệ trung tâm" : "Contact the center" }
  const cat = categorizeNotificationType(item.type || item.category)
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
  const [notificationSearch, setNotificationSearch] = useState("")
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
  const summaryCounts = useMemo(() => ({
    unread: unreadCount,
    classes: notifications.filter((item) => getNotificationKind(item.type || item.category) === "class").length,
    billing: notifications.filter((item) => getNotificationKind(item.type || item.category) === "payment").length,
    support: notifications.filter((item) => ["support", "incident"].includes(getNotificationKind(item.type || item.category))).length,
  }), [notifications, unreadCount])

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
      const search = notificationSearch.trim().toLocaleLowerCase()
      if (search && !`${getLocalizedNotificationText(n.title, isVi)} ${getLocalizedNotificationText(n.message, isVi)}`.toLocaleLowerCase().includes(search)) return false
      if (filterType === "unread") return !n.isRead
      if (filterType === "all") return true
      return categorizeNotificationType(n.type || n.category) === filterType
    })
  }, [notifications, filterType, notificationSearch, isVi])

  const getIcon = (rawType) => {
    const kind = getNotificationKind(rawType)
    if (kind === "support") return { Icon: MessageSquare, tone: "bg-blue-50 text-blue-700 ring-blue-100" }
    if (kind === "class") return { Icon: Calendar, tone: "bg-indigo-50 text-indigo-700 ring-indigo-100" }
    if (kind === "payment") return { Icon: Receipt, tone: "bg-emerald-50 text-emerald-700 ring-emerald-100" }
    if (kind === "incident") return { Icon: AlertTriangle, tone: "bg-amber-50 text-amber-700 ring-amber-100" }
    if (kind === "membership") return { Icon: CreditCard, tone: "bg-violet-50 text-violet-700 ring-violet-100" }
    return { Icon: Info, tone: "bg-slate-100 text-slate-600 ring-slate-200" }
  }

  return (
    <main className="w-full space-y-6 px-4 py-5 sm:px-6 lg:px-8">
      {/* Header */}
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3 text-2xl font-extrabold tracking-tight text-slate-900">
            {isVi ? "Trung tâm thông báo" : "Notifications"}
            {unreadCount > 0 && (
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 ring-1 ring-blue-100">
                {unreadCount} {isVi ? "mới" : "new"}
              </span>
            )}
          </span>
        }
        description={isVi
          ? "Cập nhật thời gian thực về lịch tập, trạng thái thanh toán, nhắc buổi học và phản hồi từ trung tâm."
          : "Real-time updates on your training schedule, payments, session reminders, and center news."}
        actions={
          <div className="flex items-center gap-2">
            {apiEnabled && (
              <button
                type="button"
                onClick={loadNotifications}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 cursor-pointer"
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
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 cursor-pointer"
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

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
      <div className="space-y-5 lg:col-span-8">
      {/* Filter Tabs */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-fit items-center rounded-xl bg-slate-100 p-1" role="group" aria-label={isVi ? "Trạng thái thông báo" : "Notification status"}>
          {[{ key: "all", label: isVi ? "Tất cả" : "All" }, { key: "unread", label: `${isVi ? "Chưa đọc" : "Unread"} (${unreadCount})` }].map((tab) => {
            const active = tab.key === "all" ? filterType !== "unread" : filterType === tab.key
            return <button key={tab.key} type="button" aria-pressed={active} onClick={() => setFilterType(tab.key)} className={`rounded-lg px-3 py-2 text-xs transition ${active ? "bg-white font-semibold text-slate-900 shadow-2xs" : "font-medium text-slate-600 hover:text-slate-900"}`}>{tab.label}</button>
          })}
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative block min-w-0 sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={notificationSearch} onChange={(event) => setNotificationSearch(event.target.value)} placeholder={isVi ? "Tìm thông báo..." : "Search notifications..."} aria-label={isVi ? "Tìm thông báo" : "Search notifications"} className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-8 pr-3 text-xs font-medium text-slate-700 outline-none hover:bg-white focus:border-blue-500" />
          </label>
          <label className="relative block">
            <SlidersHorizontal className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select aria-label={isVi ? "Danh mục thông báo" : "Notification category"} value={["class", "payment", "membership", "system"].includes(filterType) ? filterType : "all"} onChange={(event) => setFilterType(event.target.value)} className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 pl-8 pr-7 text-xs font-semibold text-slate-700 hover:bg-white focus:border-blue-500 focus:outline-none sm:w-48">
              <option value="all">{isVi ? "Danh mục: Tất cả" : "Category: All"}</option><option value="class">{isVi ? "Lịch tập & Lớp" : "Classes & schedule"}</option><option value="payment">{isVi ? "Hóa đơn & Thanh toán" : "Billing & payments"}</option><option value="membership">{isVi ? "Gói hội viên" : "Membership"}</option><option value="system">{isVi ? "Hệ thống & Hỗ trợ" : "System & support"}</option>
            </select>
          </label>
          {(filterType !== "all" || notificationSearch.trim()) && <button type="button" onClick={() => { setFilterType("all"); setNotificationSearch("") }} className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"><RotateCcw className="h-3.5 w-3.5" />{isVi ? "Xóa lọc" : "Clear"}</button>}
        </div>
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
            const rawType = item.type || item.category
            const action = getNotificationActionLink({ ...item, type: rawType }, isVi)
            const { Icon: NotificationIcon, tone } = getIcon(rawType)
            const title = getLocalizedNotificationText(item.title, isVi)
            const message = getLocalizedNotificationText(item.message, isVi)
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
                    <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tone}`}>
                      <NotificationIcon className="h-4.5 w-4.5" />
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
                          {title ||
                            (isVi ? "Thông báo hệ thống" : "Notification")}
                        </h2>
                        {!item.isRead && (
                          <span className="inline-flex items-center rounded-full bg-brand-primary px-2 py-0.5 text-xs font-bold text-white">
                            {isVi ? "Mới" : "New"}
                          </span>
                        )}
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                          {getNotificationTypeLabel(rawType, isVi)}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {message}
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
      </div>

      <aside className="space-y-6 lg:col-span-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] sm:p-6">
          <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Bell className="h-5 w-5" /></span>
            <h2 className="text-base font-black text-slate-900">{isVi ? "Tổng quan thông báo" : "Notification overview"}</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              [isVi ? "Chưa đọc" : "Unread", summaryCounts.unread, "bg-blue-50 text-blue-700", "unread"],
              [isVi ? "Lịch tập" : "Training", summaryCounts.classes, "bg-indigo-50 text-indigo-700", "class"],
              [isVi ? "Hóa đơn" : "Billing", summaryCounts.billing, "bg-emerald-50 text-emerald-700", "payment"],
              [isVi ? "Hỗ trợ" : "Support", summaryCounts.support, "bg-violet-50 text-violet-700", "system"],
            ].map(([label, count, tone, filterKey]) => (
              <button key={label} type="button" onClick={() => { setFilterType(filterKey); setNotificationSearch("") }} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-left transition hover:border-slate-200 hover:bg-white hover:shadow-sm">
                <span className={`inline-flex rounded-lg px-2 py-1 text-[10px] font-bold ${tone}`}>{label}</span>
                <p className="mt-2 text-2xl font-black tabular-nums text-slate-900">{count}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] sm:p-6">
          <h2 className="mb-2 text-base font-black text-slate-900">{isVi ? "Lối tắt xử lý nhanh" : "Quick actions"}</h2>
          {[
            [Calendar, isVi ? "Lịch học của tôi" : "My schedule", "/member/schedule", "blue"],
            [Headphones, isVi ? "Trung tâm hỗ trợ" : "Support center", "/support", "violet"],
            [CreditCard, isVi ? "Hóa đơn & thanh toán" : "Invoices & payments", "/member/invoices", "emerald"],
            [Settings, isVi ? "Cài đặt thông báo" : "Notification settings", "/settings", "blue"],
          ].map(([Icon, label, path, tone]) => {
            const tones = { blue: "bg-blue-50 text-blue-700", violet: "bg-violet-50 text-violet-700", emerald: "bg-emerald-50 text-emerald-700" }
            return <button key={path} type="button" onClick={() => navigate(path)} className="group flex w-full items-center gap-3 rounded-xl border border-transparent p-3 text-left transition hover:border-slate-200 hover:bg-slate-50">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}><Icon className="h-4 w-4" /></span>
              <span className="flex-1 text-xs font-bold text-slate-700">{label}</span>
              <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-700" />
            </button>
          })}
        </section>

        <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 sm:p-6">
          <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700"><Info className="h-4 w-4" /></span><div><h2 className="text-sm font-extrabold text-slate-900">{isVi ? "Tùy chỉnh thông báo" : "Manage your alerts"}</h2><p className="mt-1 text-xs leading-5 text-slate-600">{isVi ? "Bạn có thể điều chỉnh các loại nhắc lịch tập, hóa đơn và tin nhắn hỗ trợ trong Cài đặt." : "Adjust training, billing, and support alerts in Settings."}</p><button type="button" onClick={() => navigate("/settings")} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-800 hover:text-blue-950">{isVi ? "Mở Cài đặt" : "Open Settings"}<ArrowRight className="h-3.5 w-3.5" /></button></div></div>
        </section>
      </aside>
      </div>
    </main>
  )
}
