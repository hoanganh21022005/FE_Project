import React, { useState, useRef, useEffect, useCallback } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useSCMS } from "../../context/SCMSContext"
import { notificationApi } from "../../api/notificationApi"
import {
  Calendar,
  ChevronRight,
  LogOut,
  Bell,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Users,
  Check,
  Menu,
} from "lucide-react"

export function Header({ currentTitle, onLogout, onOpenMobileMenu }) {
  const { language, setLanguage, currentUser, t, apiEnabled } = useSCMS()
  const location = useLocation()
  const navigate = useNavigate()
  const canUseAvatar = currentUser?.role === "member"
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [headerAvatar, setHeaderAvatar] = useState(
    () => canUseAvatar ? currentUser?.avatarUrl || currentUser?.avatar || null : null,
  )

  useEffect(() => {
    setHeaderAvatar(canUseAvatar ? currentUser?.avatarUrl || currentUser?.avatar || null : null)
  }, [canUseAvatar, currentUser?.avatar, currentUser?.avatarUrl])

  useEffect(() => {
    const handleAvatarUpdate = (e) => {
      setHeaderAvatar(e.detail)
    }
    window.addEventListener("scms:avatar-updated", handleAvatarUpdate)
    return () => {
      window.removeEventListener("scms:avatar-updated", handleAvatarUpdate)
    }
  }, [])
  const [notifications, setNotifications] = useState([])

  const popoverRef = useRef(null)

  const loadApiNotifications = useCallback(async () => {
    if (!apiEnabled || !currentUser?.id) return
    try {
      const res = await notificationApi.getMyNotifications({
        page: 0,
        size: 12,
      })
      const items = Array.isArray(res?.items) ? res.items : []
      setNotifications(
        items.map((item) => {
          const upper = String(item.type || "").toUpperCase()
          const mappedType = upper.includes("PAYMENT")
            ? "payment"
            : upper.includes("EXPIRED") || upper.includes("NO_SHOW")
              ? "warning"
              : upper.includes("SESSION") || upper.includes("ENROLLMENT")
                ? "info"
                : "success"
          const formattedTime = item.createdAt
            ? new Date(item.createdAt).toLocaleString("vi-VN", {
                timeZone: "Asia/Ho_Chi_Minh",
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""
          return {
            id: item.id,
            titleVi: item.title || "Thông báo hệ thống",
            titleEn: item.title || "Notification",
            descVi: item.message || "",
            descEn: item.message || "",
            timeVi: formattedTime,
            timeEn: formattedTime,
            type: mappedType,
            unread: !item.isRead,
          }
        }),
      )
    } catch {
      // keep existing state if unauthenticated or endpoint fails
    }
  }, [apiEnabled, currentUser?.id])

  useEffect(() => {
    loadApiNotifications()
    const handleSync = () => loadApiNotifications()
    window.addEventListener("scms:notifications-updated", handleSync)
    return () =>
      window.removeEventListener("scms:notifications-updated", handleSync)
  }, [loadApiNotifications])

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsNotifOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const unreadCount = notifications.filter((n) => n.unread).length

  const markAllAsRead = async () => {
    if (apiEnabled) {
      try {
        await notificationApi.markAllNotificationsRead()
      } catch {
        // ignore
      }
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
  }

  const markAsRead = async (id) => {
    if (apiEnabled && id) {
      try {
        await notificationApi.markNotificationRead(id)
      } catch {
        // ignore
      }
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n)),
    )
  }

  // Format today's date formatted according to language (VI/MM/YYYY, EN MMM YYYY)
  const getFormattedTodayDate = () => {
    const today = new Date()
    const day = String(today.getDate()).padStart(2, "0")
    const month = String(today.getMonth() + 1).padStart(2, "0")
    const year = today.getFullYear()

    const daysVi = [
      "Chủ Nhật",
      "Thứ Hai",
      "Thứ Ba",
      "Thứ Tư",
      "Thứ Năm",
      "Thứ Sáu",
      "Thứ Bảy",
    ]
    const daysEn = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ]
    const monthsEn = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ]

    const dayOfWeekIndex = today.getDay()

    if (language === "vi") {
      return `${daysVi[dayOfWeekIndex]}, ${day}/${month}/${year}`
    } else {
      return `${daysEn[dayOfWeekIndex]}, ${day} ${monthsEn[today.getMonth()]} ${year}`
    }
  }

  return (
    <header className="h-[56px] bg-bg-card border-b border-border-color px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left Trail & Mobile Menu Button */}
      <div className="flex items-center gap-2 text-xs min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="h-11 w-11 shrink-0 -ml-1.5 inline-flex items-center justify-center text-text-primary hover:bg-bg-secondary rounded-md md:hidden cursor-pointer"
          aria-label={
            language === "vi" ? "Mở menu điều hướng" : "Open navigation menu"
          }
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="hidden sm:inline text-text-secondary font-medium">
          VIBE Athletic Club
        </span>
        <ChevronRight className="hidden sm:inline w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
        <span className="text-text-primary font-bold truncate">
          {currentTitle}
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Language Switcher (VI | EN) */}
        <div className="flex items-center gap-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => setLanguage("vi")}
            className={`min-h-11 min-w-11 inline-flex items-center justify-center px-1.5 transition-colors cursor-pointer ${
              language === "vi"
                ? "text-brand-primary font-bold underline underline-offset-4 decoration-brand-accent decoration-2"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            VI
          </button>
          <span className="text-text-muted select-none" aria-hidden="true">|</span>
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={`min-h-11 min-w-11 inline-flex items-center justify-center px-1.5 transition-colors cursor-pointer ${
              language === "en"
                ? "text-brand-primary font-bold underline underline-offset-4 decoration-brand-accent decoration-2"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            EN
          </button>
        </div>

        {/* Notification Bell & Dropdown Popover */}
        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className={`h-11 w-11 shrink-0 rounded-md border inline-flex items-center justify-center transition-colors relative cursor-pointer ${
              isNotifOpen
                ? "bg-bg-secondary text-text-primary border-border-color"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary border-transparent hover:border-border-color"
            }`}
            title={
              language === "vi" ? "Thông báo hệ thống" : "System notifications"
            }
            aria-label={
              language === "vi" ? "Thông báo hệ thống" : "System notifications"
            }
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-brand-accent rounded-full ring-2 ring-bg-card" />
            )}
          </button>

          {/* Notifications Panel */}
          {isNotifOpen && (
            <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-bg-card border border-border-color rounded-lg shadow-lg z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
              {/* Header */}
              <div className="px-4 py-2.5 bg-bg-secondary border-b border-border-color flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                    {language === "vi" ? "Thông báo hệ thống" : "Notifications"}
                  </h3>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-brand-accent-soft text-brand-accent-dark text-xs leading-4 font-bold rounded font-mono">
                      {unreadCount}
                    </span>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="min-h-11 px-2.5 inline-flex items-center gap-1 text-xs leading-4 text-brand-primary hover:text-brand-primary-hover font-bold hover:underline cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      {language === "vi" ? "Đánh dấu đã đọc" : "Mark all read"}
                    </span>
                  </button>
                )}
              </div>

              {/* Notification Items */}
              <div className="max-h-80 overflow-y-auto divide-y divide-border-color">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-text-muted">
                    {language === "vi"
                      ? "Không có thông báo mới"
                      : "No notifications"}
                  </div>
                ) : (
                  notifications.map((n) => {
                    const title = language === "vi" ? n.titleVi : n.titleEn
                    const desc = language === "vi" ? n.descVi : n.descEn

                    const icon =
                      n.type === "warning" ? (
                        <AlertTriangle className="w-4 h-4 text-status-warning" />
                      ) : n.type === "payment" ? (
                        <CreditCard className="w-4 h-4 text-status-success" />
                      ) : n.type === "info" ? (
                        <Users className="w-4 h-4 text-brand-primary" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-text-secondary" />
                      )

                    const iconBg =
                      n.type === "warning"
                        ? "bg-status-warning-bg border-status-warning-border"
                        : n.type === "payment"
                          ? "bg-status-success-bg border-status-success-border"
                          : n.type === "info"
                            ? "bg-bg-secondary border-border-color"
                            : "bg-bg-secondary border-border-color"

                    return (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                          n.unread
                            ? "bg-brand-primary/5 hover:bg-brand-primary/10"
                            : "hover:bg-bg-secondary"
                        }`}
                      >
                        <div
                          className={`p-2 rounded border flex-shrink-0 ${iconBg}`}
                        >
                          {icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-xs font-bold ${
                                n.unread ? "text-text-primary" : "text-text-secondary"
                              }`}
                            >
                              {title}
                            </span>
                            {n.unread && (
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-primary flex-shrink-0" />
                            )}
                          </div>

                          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed line-clamp-2">
                            {desc}
                          </p>

                          <span className="text-xs leading-4 text-text-muted mt-1 block">
                            {language === "vi" ? n.timeVi : n.timeEn}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2 bg-bg-secondary border-t border-border-color flex items-center justify-between text-xs">
                {currentUser?.role === "member" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsNotifOpen(false)
                      navigate("/member/notifications")
                    }}
                    className="w-full min-h-11 py-2 text-center font-bold text-xs leading-4 text-brand-primary hover:text-brand-primary-hover transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>
                      {language === "vi"
                        ? "Xem tất cả thông báo"
                        : "View all notifications"}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                ) : (
                  <span className="w-full min-h-11 inline-flex items-center justify-center text-center text-xs leading-4 text-text-muted font-medium">
                    {language === "vi"
                      ? "Hệ thống tự động lưu nhật ký hoạt động"
                      : "Activity is recorded automatically"}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Info & Avatar (Clickable to /profile) */}
        <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-border-color">
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="min-h-11 inline-flex items-center gap-2.5 hover:opacity-80 transition-opacity cursor-pointer text-left bg-transparent border-0 p-0 focus:outline-hidden"
            title={language === "vi" ? "Xem hồ sơ cá nhân" : "View profile"}
          >
            {canUseAvatar && (
              <div className="w-8 h-8 rounded-full border border-border-color bg-brand-accent-soft text-brand-primary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                {headerAvatar ? (
                  <img
                    src={headerAvatar}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (currentUser?.name || "B").charAt(0)
                )}
              </div>
            )}
            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-text-primary leading-tight truncate max-w-[140px]">
                {currentUser?.name || "Bùi Văn Phúc"}
              </div>
              <div className="text-xs leading-4 text-text-secondary font-normal truncate max-w-[140px]">
                {(currentUser?.email || "phuc.bui@vibeathletic.com")
                  .replace("@fitzone.vn", "@vibeathletic.com")
                  .replace("@scms.com", "@vibeathletic.com")}
              </div>
            </div>
          </button>
          {onLogout && (
            <button
              id="header-logout-btn"
              type="button"
              onClick={onLogout}
              className="h-11 w-11 shrink-0 inline-flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-secondary rounded-md transition-colors cursor-pointer ml-0.5"
              title={t("logout")}
              aria-label={t("logout")}
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
