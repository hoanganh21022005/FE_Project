import React, { useState } from "react"
import {
  Bell,
  CheckCheck,
  Calendar,
  CreditCard,
  AlertTriangle,
  Info,
  Clock,
  Trash2,
  Filter,
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"

const INITIAL_NOTIFICATIONS = [
  {
    id: "notif-1",
    type: "class",
    titleVi: "Nhắc nhở: Lớp Boxing cơ bản sắp diễn ra",
    titleEn: "Reminder: Basic Boxing class is coming up",
    messageVi:
      "Lớp học của bạn sẽ bắt đầu lúc 18:00 hôm nay tại Phòng Boxing 1. Vui lòng có mặt trước 10 phút.",
    messageEn:
      "Your session starts at 18:00 today in Boxing Room 1. Please arrive 10 minutes early.",
    time: "2026-10-24T08:30:00",
    isRead: false,
  },
  {
    id: "notif-2",
    type: "payment",
    titleVi: "Thanh toán gói tập thành công",
    titleEn: "Membership payment successful",
    messageVi:
      "Hóa đơn gia hạn gói VIBE VIP 3 Tháng đã được ghi nhận thành công qua VNPay.",
    messageEn:
      "Your VIBE VIP 3 Months membership invoice has been paid via VNPay.",
    time: "2026-10-23T15:20:00",
    isRead: false,
  },
  {
    id: "notif-3",
    type: "membership",
    titleVi: "Ưu đãi nâng cấp gói tập cuối năm",
    titleEn: "Year-end membership upgrade promotion",
    messageVi:
      "Giảm ngay 20% khi nâng cấp lên gói VIBE Platinum không giới hạn bộ môn.",
    messageEn:
      "Get 20% off when upgrading to the unlimited VIBE Platinum plan.",
    time: "2026-10-21T09:00:00",
    isRead: true,
  },
  {
    id: "notif-4",
    type: "system",
    titleVi: "Thông báo lịch bảo trì phòng Sauna",
    titleEn: "Sauna maintenance notice",
    messageVi:
      "Khu vực Sauna Nam sẽ tạm ngưng phục vụ từ 22:00 ngày 25/10 để bảo trì định kỳ.",
    messageEn:
      "Men's Sauna will be closed for routine maintenance on Oct 25 from 22:00.",
    time: "2026-10-20T14:15:00",
    isRead: true,
  },
]

export function MemberNotificationsView() {
  const { language } = useSCMS()
  const isVi = language === "vi"

  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS)
  const [filterType, setFilterType] = useState("all")

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
  }

  const toggleRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: !n.isRead } : n)),
    )
  }

  const deleteNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const filtered = notifications.filter((n) => {
    if (filterType === "unread") return !n.isRead
    if (filterType === "all") return true
    return n.type === filterType
  })

  const getIcon = (type) => {
    switch (type) {
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
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-7 sm:py-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-red-700">
            VIBE SPORT · MEMBER
          </p>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-3xl font-black text-slate-950">
              {isVi ? "Trung tâm thông báo" : "Notifications"}
            </h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-extrabold text-white">
                {unreadCount} {isVi ? "mới" : "new"}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {isVi
              ? "Cập nhật lịch tập, trạng thái thanh toán và thông tin từ trung tâm."
              : "Updates on your training schedule, payments, and center news."}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <CheckCheck className="w-4 h-4 text-emerald-600" />
            <span>{isVi ? "Đánh dấu tất cả đã đọc" : "Mark all as read"}</span>
          </button>
        )}
      </header>

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
          { key: "system", labelVi: "Hệ thống", labelEn: "System" },
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

      {/* Notification List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs">
            <Bell className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-3 font-bold text-slate-800">
              {isVi ? "Không có thông báo nào" : "No notifications found"}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {isVi
                ? "Bạn đã xem hết các thông báo trong mục này."
                : "You are all caught up with notifications in this section."}
            </p>
          </div>
        ) : (
          filtered.map((item) => (
            <article
              key={item.id}
              className={`flex items-start justify-between gap-4 rounded-xl border p-4 sm:p-5 transition-all shadow-xs ${
                item.isRead
                  ? "bg-white border-slate-200 opacity-80"
                  : "bg-red-50/30 border-red-200/80 ring-1 ring-red-100"
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className={`mt-0.5 rounded-lg p-2.5 shrink-0 ${
                    item.isRead
                      ? "bg-slate-100"
                      : "bg-white shadow-2xs border border-slate-200"
                  }`}
                >
                  {getIcon(item.type)}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      className={`text-sm font-bold ${
                        item.isRead
                          ? "text-slate-800"
                          : "text-slate-950 font-black"
                      }`}
                    >
                      {isVi ? item.titleVi : item.titleEn}
                    </h3>
                    {!item.isRead && (
                      <span className="inline-block h-2 w-2 rounded-full bg-red-600" />
                    )}
                  </div>

                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    {isVi ? item.messageVi : item.messageEn}
                  </p>

                  <div className="mt-2.5 flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(item.time).toLocaleString(
                        isVi ? "vi-VN" : "en-US",
                        {
                          dateStyle: "short",
                          timeStyle: "short",
                        },
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleRead(item.id)}
                  title={
                    item.isRead
                      ? isVi
                        ? "Đánh dấu chưa đọc"
                        : "Mark unread"
                      : isVi
                        ? "Đánh dấu đã đọc"
                        : "Mark read"
                  }
                  className="rounded-md p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <CheckCheck
                    className={`w-4 h-4 ${
                      item.isRead ? "text-slate-400" : "text-emerald-600"
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => deleteNotification(item.id)}
                  title={isVi ? "Xóa" : "Delete"}
                  className="rounded-md p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </main>
  )
}

export default MemberNotificationsView
