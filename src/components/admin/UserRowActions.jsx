import React, { useEffect, useRef, useState } from "react"
import { Eye, KeyRound, MoreVertical, PenLine, ShieldCheck, UserCheck } from "lucide-react"

export function UserRowActions({
  user,
  onViewDetails,
  onEditUser,
  onChangeStatus,
  onChangeRole,
  onReissuePassword,
  isCurrentIdValid = true,
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!open) return

    // Focus mục đầu tiên khi mở menu
    const focusTimer = setTimeout(() => {
      const enabledItems = Array.from(
        menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || []
      )
      if (enabledItems.length > 0) {
        enabledItems[0].focus({ preventScroll: true })
      }
    }, 0)

    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault()
        setOpen(false)
        buttonRef.current?.focus({ preventScroll: true })
        return
      }

      if (e.key === "Tab") {
        setOpen(false)
        return
      }

      const enabledItems = Array.from(
        menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || []
      )
      if (enabledItems.length === 0) return

      const currentIndex = enabledItems.indexOf(document.activeElement)

      if (e.key === "ArrowDown") {
        e.preventDefault()
        const nextIndex =
          currentIndex === -1 || currentIndex === enabledItems.length - 1
            ? 0
            : currentIndex + 1
        enabledItems[nextIndex]?.focus({ preventScroll: true })
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        const prevIndex =
          currentIndex <= 0
            ? enabledItems.length - 1
            : currentIndex - 1
        enabledItems[prevIndex]?.focus({ preventScroll: true })
      } else if (e.key === "Home") {
        e.preventDefault()
        enabledItems[0]?.focus({ preventScroll: true })
      } else if (e.key === "End") {
        e.preventDefault()
        enabledItems[enabledItems.length - 1]?.focus({ preventScroll: true })
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      clearTimeout(focusTimer)
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  return (
    <div className="relative inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={onViewDetails}
        className="inline-flex min-h-11 items-center justify-center rounded px-3 text-xs font-medium border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary hover:text-brand-primary transition-colors cursor-pointer scroll-mt-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      >
        Xem
      </button>

      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen(!open)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Thao tác tài khoản ${user.fullName || user.email}`}
          className="w-11 h-11 inline-flex items-center justify-center rounded border border-border-color bg-bg-card text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {open && (
          <div
            ref={menuRef}
            role="menu"
            aria-orientation="vertical"
            className="absolute right-0 top-full mt-1 z-30 w-52 rounded-lg border border-border-color bg-bg-card p-1.5 shadow-lg text-text-primary animate-in fade-in duration-100"
          >
            {onEditUser && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onEditUser(buttonRef)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-xs text-text-primary hover:bg-bg-secondary transition-colors text-left cursor-pointer min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                <PenLine className="w-4 h-4 text-brand-primary shrink-0" />
                <span>Chỉnh sửa thông tin</span>
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              disabled={!isCurrentIdValid}
              title={
                !isCurrentIdValid
                  ? "Không xác định được tài khoản đang đăng nhập; tải lại trang hoặc đăng nhập lại."
                  : undefined
              }
              onClick={() => {
                if (!isCurrentIdValid) return
                setOpen(false)
                onChangeStatus(buttonRef)
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-xs text-text-primary hover:bg-bg-secondary transition-colors text-left cursor-pointer min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserCheck className="w-4 h-4 text-brand-primary shrink-0" />
              <span>Đổi trạng thái</span>
            </button>

            <button
              type="button"
              role="menuitem"
              disabled={!isCurrentIdValid}
              title={
                !isCurrentIdValid
                  ? "Không xác định được tài khoản đang đăng nhập; tải lại trang hoặc đăng nhập lại."
                  : undefined
              }
              onClick={() => {
                if (!isCurrentIdValid) return
                setOpen(false)
                onChangeRole(buttonRef)
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-xs text-text-primary hover:bg-bg-secondary transition-colors text-left cursor-pointer min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShieldCheck className="w-4 h-4 text-brand-primary shrink-0" />
              <span>Đổi vai trò</span>
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onReissuePassword(buttonRef)
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-xs text-text-primary hover:bg-bg-secondary transition-colors text-left cursor-pointer min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              <KeyRound className="w-4 h-4 text-status-warning shrink-0" />
              <span>Cấp lại mật khẩu</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
