import React, { useEffect, useState } from "react"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  UserCircle,
  X,
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext.jsx"
import { getAdminText } from "./adminI18n.js"
import {
  ADMIN_NAV_GROUPS,
  ADMIN_NAV_ITEMS,
  getAdminNavGroups,
  getAdminNavItems,
} from "./adminNav.js"

export { ADMIN_NAV_GROUPS, ADMIN_NAV_ITEMS, getAdminNavGroups, getAdminNavItems }

const STORAGE_COLLAPSED_KEY = "scms_admin_sidebar_collapsed"
const STORAGE_GROUPS_KEY = "scms_admin_nav_groups"

function readStoredCollapsed() {
  try {
    return localStorage.getItem(STORAGE_COLLAPSED_KEY) === "true"
  } catch {
    return false
  }
}

function readStoredGroups(activeGroupKey) {
  const defaults = {
    system: activeGroupKey === "system" || !activeGroupKey,
    management: activeGroupKey === "management",
    reception: activeGroupKey === "reception",
  }
  try {
    const raw = localStorage.getItem(STORAGE_GROUPS_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object") {
      return {
        ...defaults,
        ...parsed,
        ...(activeGroupKey ? { [activeGroupKey]: true } : {}),
      }
    }
  } catch {
    // ignore storage errors
  }
  return defaults
}

export function AdminSidebar({
  currentTab,
  onSelectTab,
  onLogout,
  isOpen,
  onClose,
}) {
  const { role, language } = useSCMS()
  const isEn = language === "en"
  const groups = getAdminNavGroups(role)

  const activeGroupKey =
    groups.find((g) => g.items.some((item) => item.id === currentTab))?.key ||
    "system"

  const [collapsed, setCollapsed] = useState(readStoredCollapsed)
  const [expandedGroups, setExpandedGroups] = useState(() =>
    readStoredGroups(activeGroupKey),
  )

  useEffect(() => {
    if (!activeGroupKey) return
    setExpandedGroups((prev) => {
      if (prev[activeGroupKey]) return prev
      const next = { ...prev, [activeGroupKey]: true }
      try {
        localStorage.setItem(STORAGE_GROUPS_KEY, JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }, [activeGroupKey])

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_COLLAPSED_KEY, String(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      try {
        localStorage.setItem(STORAGE_GROUPS_KEY, JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }

  const select = (tab) => {
    onSelectTab(tab)
    onClose()
  }

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label={getAdminText(language, "shell.closeMenu")}
          onClick={onClose}
          className="fixed inset-0 z-30 bg-stone-950/40 lg:hidden cursor-pointer"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 border-r border-brand-dark-hover bg-bg-sidebar text-text-inverse transition-[transform,width] duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 shrink-0 ${
          collapsed ? "w-64 lg:w-16" : "w-64"
        } ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="h-full flex flex-col justify-between">
          <div className="flex-1 flex flex-col min-h-0">
            <div
              className={`h-14 flex items-center border-b border-brand-dark-hover shrink-0 ${
                collapsed ? "px-3 lg:px-0 lg:justify-center" : "px-3 justify-between"
              }`}
            >
              <button
                type="button"
                onClick={() => select("admin_dashboard")}
                title="VIBE Sport System"
                aria-label={`VIBE Sport System - ${getAdminText(language, "dash.title")}`}
                className={`flex min-h-[44px] items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded cursor-pointer min-w-0 ${
                  collapsed ? "lg:hidden" : "flex-1 pr-3"
                }`}
              >
                <img
                  src="/images/MainPage/vibe-sport-logo.png?v=4"
                  alt="Vibe Sport"
                  className="w-11 h-[33px] object-contain shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs leading-[17px] font-bold uppercase text-text-inverse truncate">
                    VIBE Sport System
                  </p>
                  <p className="text-xs leading-4 font-bold uppercase tracking-wider text-text-inverse/70 truncate">
                    Sports Center
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label={
                  collapsed
                    ? getAdminText(language, "shell.expandSidebar")
                    : getAdminText(language, "shell.collapseSidebar")
                }
                aria-expanded={!collapsed}
                title={
                  collapsed
                    ? getAdminText(language, "shell.expandSidebar")
                    : getAdminText(language, "shell.collapseSidebar")
                }
                className="hidden lg:inline-flex w-11 h-11 shrink-0 items-center justify-center rounded text-text-inverse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent cursor-pointer"
              >
                <span className="w-7 h-7 rounded-md border border-white/15 bg-brand-dark-hover flex items-center justify-center">
                  {collapsed ? (
                    <ChevronRight className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronLeft className="w-3.5 h-3.5" />
                  )}
                </span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex w-11 h-11 shrink-0 items-center justify-center rounded text-text-inverse transition-colors hover:bg-brand-dark-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary lg:hidden cursor-pointer"
                aria-label={getAdminText(language, "shell.closeMenu")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav
              className={`flex-1 py-3 space-y-1.5 overflow-y-auto min-h-0 ${
                collapsed ? "px-3 lg:px-2" : "px-3"
              }`}
              aria-label={getAdminText(language, "shell.navAria")}
            >
              {groups.map((group) => {
                const hasActive = group.items.some((i) => i.id === currentTab)
                const isExpanded = Boolean(expandedGroups[group.key]) || hasActive
                const panelId = `admin-nav-group-${group.key}`
                const groupTitle = isEn ? group.titleEn || group.title : group.title

                return (
                  <div key={group.key} className="space-y-1">
                    {!collapsed ? (
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.key)}
                        aria-expanded={isExpanded}
                        aria-controls={panelId}
                        className="w-full min-h-[44px] px-3 flex items-center justify-between gap-2 rounded text-xs leading-4 font-bold uppercase tracking-wider text-text-inverse/75 hover:text-text-inverse hover:bg-brand-dark-hover/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                      >
                        <span className="truncate">{groupTitle}</span>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 shrink-0" />
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.key)}
                        aria-expanded={isExpanded}
                        aria-controls={panelId}
                        className="lg:hidden w-full min-h-[44px] px-3 flex items-center justify-between gap-2 rounded text-xs leading-4 font-bold uppercase tracking-wider text-text-inverse/75 hover:text-text-inverse hover:bg-brand-dark-hover/60 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
                      >
                        <span className="truncate">{groupTitle}</span>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 shrink-0" />
                        )}
                      </button>
                    )}

                    <div
                      id={panelId}
                      className={`space-y-1 ${
                        isExpanded ? "block" : collapsed ? "hidden lg:block" : "hidden"
                      } ${collapsed ? "lg:pt-1 lg:border-t lg:border-brand-dark-hover/60 lg:first:border-t-0" : ""}`}
                    >
                      {group.items.map(({ id, label, labelEn, icon: Icon }) => {
                        const active = currentTab === id
                        const itemLabel = isEn ? labelEn || label : label
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => select(id)}
                            aria-current={active ? "page" : undefined}
                            aria-label={itemLabel}
                            title={collapsed ? itemLabel : undefined}
                            className={`w-full min-h-[44px] flex items-center rounded-md text-sm leading-5 font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
                              collapsed
                                ? "px-3 gap-3 lg:w-11 lg:h-11 lg:mx-auto lg:px-0 lg:justify-center"
                                : "px-3 gap-3"
                            } ${
                              active
                                ? "bg-brand-primary text-text-inverse font-bold border-l-2 border-brand-accent"
                                : "text-text-inverse/85 hover:text-text-inverse hover:bg-brand-dark-hover"
                            }`}
                          >
                            <Icon
                              className={`w-4 h-4 shrink-0 ${
                                active ? "text-brand-accent-soft" : "text-text-inverse/75"
                              }`}
                            />
                            <span className={`truncate ${collapsed ? "lg:hidden" : ""}`}>
                              {itemLabel}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </nav>
          </div>

          <div
            className={`p-3 border-t border-brand-dark-hover space-y-1 bg-bg-sidebar shrink-0 ${
              collapsed ? "lg:p-2" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => select("profile")}
              aria-current={currentTab === "profile" ? "page" : undefined}
              aria-label={getAdminText(language, "shell.profileTitle")}
              title={collapsed ? getAdminText(language, "shell.profileTitle") : undefined}
              className={`w-full min-h-[44px] flex items-center rounded-md text-sm leading-5 font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${
                collapsed
                  ? "px-3 gap-3 lg:w-11 lg:h-11 lg:mx-auto lg:px-0 lg:justify-center"
                  : "px-3 gap-3"
              } ${
                currentTab === "profile"
                  ? "bg-brand-primary text-text-inverse font-bold border-l-2 border-brand-accent"
                  : "text-text-inverse/85 hover:text-text-inverse hover:bg-brand-dark-hover"
              }`}
            >
              <UserCircle
                className={`w-4 h-4 shrink-0 ${
                  currentTab === "profile"
                    ? "text-brand-accent-soft"
                    : "text-text-inverse/75"
                }`}
              />
              <span className={collapsed ? "lg:hidden" : ""}>
                {getAdminText(language, "shell.profileTitle")}
              </span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              aria-label={getAdminText(language, "shell.logout")}
              title={collapsed ? getAdminText(language, "shell.logout") : undefined}
              className={`w-full min-h-[44px] flex items-center rounded-md text-sm leading-5 font-semibold text-text-inverse/85 hover:text-text-inverse hover:bg-brand-dark-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent transition-colors cursor-pointer ${
                collapsed
                  ? "px-3 gap-3 lg:w-11 lg:h-11 lg:mx-auto lg:px-0 lg:justify-center"
                  : "px-3 gap-3"
              }`}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className={collapsed ? "lg:hidden" : ""}>
                {getAdminText(language, "shell.logout")}
              </span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
