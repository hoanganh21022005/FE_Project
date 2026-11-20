import React, { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Eye, KeyRound, MoreVertical, PenLine, ShieldCheck, UserCheck } from "lucide-react"
import { useSCMS } from "../../context/SCMSContext.jsx"
import { getAdminText } from "./adminI18n.js"

const MENU_WIDTH = 208 // w-52

export function UserRowActions({
  user,
  onViewDetails,
  onEditUser,
  onChangeStatus,
  onChangeRole,
  onReissuePassword,
  isCurrentIdValid = true,
}) {
  const { language } = useSCMS()
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const menuRef = useRef(null)
  const buttonRef = useRef(null)

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const updatePosition = () => {
      if (!buttonRef.current) return
      const rect = buttonRef.current.getBoundingClientRect()
      const menuHeight = menuRef.current?.offsetHeight || 240
      const spaceBelow = window.innerHeight - rect.bottom
      const openAbove = spaceBelow < menuHeight + 12 && rect.top > menuHeight + 12
      const top = openAbove
        ? Math.max(8, rect.top - menuHeight - 4)
        : Math.min(window.innerHeight - menuHeight - 8, rect.bottom + 4)
      const left = Math.max(
        8,
        Math.min(window.innerWidth - MENU_WIDTH - 8, rect.right - MENU_WIDTH),
      )
      setMenuPos({ top, left })
    }
    updatePosition()
    window.addEventListener("scroll", updatePosition, true)
    window.addEventListener("resize", updatePosition)
    return () => {
      window.removeEventListener("scroll", updatePosition, true)
      window.removeEventListener("resize", updatePosition)
    }
  }, [open])

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
    <div className="relative inline-flex items-center justify-end">
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen(!open)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={getAdminText(language, "rowActions.menuLabel", {
            name: user.fullName || user.email,
          })}
          className="w-11 h-11 inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <MoreVertical className="w-5 h-5" />
        </button>

        {open &&
          createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-orientation="vertical"
              style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
              className="fixed z-50 w-52 rounded-lg border border-border-color bg-bg-card p-1.5 shadow-lg text-text-primary animate-in fade-in duration-100"
            >
            {onViewDetails && (
              <button
                type="button"
                role="menuitem"
                onClick={(e) => {
                  setOpen(false)
                  onViewDetails(e)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-xs text-text-primary hover:bg-bg-secondary transition-colors text-left cursor-pointer min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                <Eye className="w-4 h-4 text-brand-primary shrink-0" />
                <span>{getAdminText(language, "rowActions.view")}</span>
              </button>
            )}

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
                <span>{getAdminText(language, "rowActions.edit")}</span>
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              disabled={!isCurrentIdValid}
              title={
                !isCurrentIdValid
                  ? getAdminText(language, "users.invalidSession")
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
              <span>{getAdminText(language, "rowActions.changeStatus")}</span>
            </button>

            <button
              type="button"
              role="menuitem"
              disabled={!isCurrentIdValid}
              title={
                !isCurrentIdValid
                  ? getAdminText(language, "users.invalidSession")
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
              <span>{getAdminText(language, "rowActions.changeRole")}</span>
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
              <span>{getAdminText(language, "rowActions.reissuePwd")}</span>
            </button>
          </div>,
          document.body,
        )}
      </div>
    </div>
  )
}
