import React, { useEffect, useMemo, useRef, useState } from "react"
import { Bell, ChevronRight, LogOut, Menu } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useSCMS } from "../../context/SCMSContext.jsx"
import { useAdminData } from "./AdminDataContext.jsx"

const STORAGE_SEEN_KEY = "scms_admin_notif_seen_at"

const NOTIF_ACTIONS = new Set([
  "CHANGE_USER_STATUS",
  "CHANGE_USER_ROLE",
  "UPDATE_ROLE_PERMISSIONS",
  "REISSUE_TEMPORARY_PASSWORD",
  "CREATE_USER",
])

const NOTIF_ACTION_LABELS = {
  CHANGE_USER_STATUS: "Đổi trạng thái tài khoản",
  CHANGE_USER_ROLE: "Đổi vai trò người dùng",
  UPDATE_ROLE_PERMISSIONS: "Cập nhật quyền vai trò",
  REISSUE_TEMPORARY_PASSWORD: "Cấp lại mật khẩu tạm",
  CREATE_USER: "Tạo tài khoản người dùng",
}

function getLastWordInitial(fullName) {
  const cleaned = String(fullName || "").trim()
  if (!cleaned) return "A"
  const parts = cleaned.split(/\s+/)
  const last = parts[parts.length - 1] || cleaned
  return last.charAt(0).toUpperCase()
}

function readSeenAt() {
  try {
    const raw = localStorage.getItem(STORAGE_SEEN_KEY)
    const num = Number(raw)
    return Number.isFinite(num) && num > 0 ? num : 0
  } catch {
    return 0
  }
}

function writeSeenAt(ms) {
  try {
    localStorage.setItem(STORAGE_SEEN_KEY, String(ms))
  } catch {
    // ignore storage errors
  }
}

function formatRelativeTime(createdAt) {
  if (!createdAt) return ""
  const ms = new Date(createdAt).getTime()
  if (!Number.isFinite(ms)) return ""
  const diffMin = Math.floor((Date.now() - ms) / 60000)
  if (diffMin < 1) return "Vừa xong"
  if (diffMin < 60) return `${diffMin} phút trước`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} giờ trước`
  const diffDay = Math.floor(diffHour / 24)
  return `${diffDay} ngày trước`
}

export function AdminHeader({ title, onMenu, onLogout, onChangeLanguage }) {
  const { currentUser, language, setLanguage } = useSCMS()
  const { resources } = useAdminData()
  const navigate = useNavigate()

  const userName = currentUser?.name || "Admin"
  const userEmail = currentUser?.email || "admin@scms.com"
  const avatarUrl = currentUser?.avatarUrl || null
  const avatarInitial = getLastWordInitial(userName)

  const [notifOpen, setNotifOpen] = useState(false)
  const [seenAt, setSeenAt] = useState(readSeenAt)
  const popoverRef = useRef(null)
  const bellBtnRef = useRef(null)

  const userMap = useMemo(() => {
    const map = new Map()
    for (const u of resources?.users?.data || []) {
      if (u.id !== null && u.id !== undefined) {
        map.set(Number(u.id), u.fullName || `User #${u.id}`)
      }
    }
    return map
  }, [resources?.users?.data])

  const notifItems = useMemo(() => {
    const logs = Array.isArray(resources?.auditLogs?.data)
      ? resources.auditLogs.data
      : []
    return logs
      .filter((log) => NOTIF_ACTIONS.has(log.action))
      .map((log) => ({
        ...log,
        createdAtMs: log.createdAt ? new Date(log.createdAt).getTime() : 0,
      }))
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, 8)
  }, [resources?.auditLogs?.data])

  const newCount = useMemo(
    () => notifItems.filter((item) => item.createdAtMs > seenAt).length,
    [notifItems, seenAt],
  )

  useEffect(() => {
    if (!notifOpen) return
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setNotifOpen(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setNotifOpen(false)
        bellBtnRef.current?.focus({ preventScroll: true })
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [notifOpen])

  const handleToggleNotif = () => {
    setNotifOpen((prev) => {
      const next = !prev
      if (next) {
        const latestMs = notifItems.reduce(
          (max, item) => Math.max(max, item.createdAtMs || 0),
          Date.now(),
        )
        writeSeenAt(latestMs)
        setSeenAt(latestMs)
      }
      return next
    })
  }

  const handleLanguageSelect = (lang) => {
    if (onChangeLanguage) {
      onChangeLanguage(lang)
    } else {
      setLanguage(lang)
    }
  }

  const handleNotifItemClick = (item) => {
    setNotifOpen(false)
    if (item.action === "UPDATE_ROLE_PERMISSIONS") {
      navigate("/admin/roles")
      return
    }
    if (
      item.action === "CHANGE_USER_STATUS" ||
      item.action === "CHANGE_USER_ROLE" ||
      item.action === "REISSUE_TEMPORARY_PASSWORD" ||
      item.action === "CREATE_USER"
    ) {
      navigate("/admin/users")
      return
    }
    navigate("/admin/audit-logs")
  }

  const bellAriaLabel =
    newCount > 0 ? `Thông báo, ${newCount} mục mới` : "Thông báo"

  return (
    <header className="h-14 shrink-0 border-b border-border-color bg-bg-card px-3 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onMenu}
          className="inline-flex w-11 h-11 -ml-1.5 items-center justify-center rounded-md text-text-primary transition-colors hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary lg:hidden cursor-pointer shrink-0"
          aria-label="Mở menu Admin"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav
          aria-label="Vị trí"
          className="flex items-center gap-2 text-sm leading-5 min-w-0"
        >
          <span className="hidden sm:inline text-text-secondary font-medium whitespace-nowrap">
            VIBE Athletic Club
          </span>
          <ChevronRight
            className="hidden sm:inline w-4 h-4 text-text-muted shrink-0"
            aria-hidden="true"
          />
          <span className="text-text-primary font-semibold truncate">
            {title}
          </span>
        </nav>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        <div className="flex items-center text-sm">
          <button
            type="button"
            onClick={() => handleLanguageSelect("vi")}
            aria-pressed={language === "vi"}
            className={`min-w-[44px] min-h-[44px] inline-flex items-center justify-center px-1.5 transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
              language === "vi"
                ? "text-brand-primary font-bold underline underline-offset-[6px] decoration-brand-accent decoration-2"
                : "text-text-secondary font-medium hover:text-text-primary"
            }`}
          >
            VI
          </button>
          <span className="text-border-strong select-none" aria-hidden="true">
            |
          </span>
          <button
            type="button"
            onClick={() => handleLanguageSelect("en")}
            aria-pressed={language === "en"}
            className={`min-w-[44px] min-h-[44px] inline-flex items-center justify-center px-1.5 transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
              language === "en"
                ? "text-brand-primary font-bold underline underline-offset-[6px] decoration-brand-accent decoration-2"
                : "text-text-secondary font-medium hover:text-text-primary"
            }`}
          >
            EN
          </button>
        </div>

        <div className="relative" ref={popoverRef}>
          <button
            ref={bellBtnRef}
            type="button"
            onClick={handleToggleNotif}
            aria-expanded={notifOpen}
            aria-haspopup="dialog"
            aria-label={bellAriaLabel}
            title={bellAriaLabel}
            className={`relative w-11 h-11 shrink-0 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
              notifOpen
                ? "bg-bg-secondary text-text-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
            }`}
          >
            <Bell className="w-5 h-5" />
            {newCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-brand-accent ring-2 ring-bg-card"
              />
            )}
          </button>

          {notifOpen && (
            <div
              role="dialog"
              aria-label="Thông báo thay đổi"
              className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-border-color bg-bg-card shadow-lg z-40 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-border-color flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text-primary">
                  Thay đổi gần đây
                </h2>
                <span className="text-xs text-text-muted">
                  {notifItems.length} mục
                </span>
              </div>

              {notifItems.length === 0 ? (
                <p className="p-6 text-center text-sm text-text-secondary">
                  Chưa có thay đổi mới
                </p>
              ) : (
                <div className="max-h-80 overflow-y-auto divide-y divide-border-color">
                  {notifItems.map((item) => {
                    const actorName =
                      item.actorId === null || item.actorId === undefined
                        ? "Hệ thống"
                        : userMap.get(Number(item.actorId)) ||
                          item.actorLabel ||
                          `User #${item.actorId}`
                    let targetName = item.targetLabel
                    if (
                      item.targetEntity &&
                      String(item.targetEntity).toUpperCase() === "USER" &&
                      item.targetId !== null &&
                      item.targetId !== undefined
                    ) {
                      targetName = userMap.get(Number(item.targetId)) || targetName
                    }

                    return (
                      <button
                        key={item.id ?? `${item.action}-${item.createdAt}`}
                        type="button"
                        onClick={() => handleNotifItemClick(item)}
                        className="w-full min-h-[44px] px-4 py-2.5 text-left hover:bg-bg-secondary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-text-primary">
                            {NOTIF_ACTION_LABELS[item.action] || item.action}
                          </span>
                          <span className="text-xs text-text-muted whitespace-nowrap shrink-0">
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-text-secondary truncate">
                          {actorName}
                          {targetName ? ` · ${targetName}` : ""}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="border-t border-border-color bg-bg-main p-2">
                <button
                  type="button"
                  onClick={() => {
                    setNotifOpen(false)
                    navigate("/admin/audit-logs")
                  }}
                  className="w-full min-h-[44px] rounded-lg text-sm font-semibold text-brand-primary hover:bg-bg-secondary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  Xem tất cả trong nhật ký
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pl-3 sm:pl-4 border-l border-border-color">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={userName}
              className="w-9 h-9 rounded-full object-cover shrink-0 border border-border-color"
            />
          ) : (
            <div
              aria-hidden="true"
              className="w-9 h-9 rounded-full bg-brand-primary text-text-inverse text-sm font-bold flex items-center justify-center shrink-0"
            >
              {avatarInitial}
            </div>
          )}
          <div className="hidden md:block min-w-0">
            <p className="text-sm leading-5 font-semibold text-text-primary truncate max-w-44">
              {userName}
            </p>
            <p className="text-xs leading-4 text-text-secondary truncate max-w-44">
              {userEmail}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Đăng xuất"
            aria-label="Đăng xuất"
            className="inline-flex w-11 h-11 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
