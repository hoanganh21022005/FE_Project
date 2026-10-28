import React from "react"
import {
  UserCircle,
  X,
  LogOut,
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext.jsx"
import { ADMIN_NAV_ITEMS, getAdminNavItems } from "./adminNav.js"

export { ADMIN_NAV_ITEMS, getAdminNavItems }

export function AdminSidebar({
  currentTab,
  onSelectTab,
  onLogout,
  isOpen,
  onClose,
}) {
  const { role } = useSCMS()
  const visibleItems = getAdminNavItems(role)

  const select = (tab) => {
    onSelectTab(tab)
    onClose()
  }

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label="Đóng menu Admin"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-stone-950/40 lg:hidden cursor-pointer"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-brand-dark-hover bg-bg-sidebar text-text-inverse transition-transform duration-200 lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col justify-between">
          <div>
            <div className="h-16 px-5 flex items-center justify-between border-b border-brand-dark-hover">
              <button
                type="button"
                onClick={() => select("admin_dashboard")}
                className="flex items-center gap-3 text-left focus:outline-none focus:ring-2 focus:ring-brand-accent rounded cursor-pointer"
              >
                <img
                  src="/images/MainPage/vibe-sport-logo.png?v=2"
                  alt="Vibe Sport"
                  className="w-12 h-9 object-contain flex-shrink-0"
                />
                <div>
                  <p className="text-sm font-extrabold text-white leading-none">
                    VIBE Sport Admin
                  </p>
                  <p className="mt-1 text-[11px] text-slate-300">
                    Quản trị hệ thống
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-11 h-11 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-white hover:bg-brand-dark-hover rounded lg:hidden transition-colors cursor-pointer"
                aria-label="Đóng menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav
              className="px-3 py-5 space-y-1"
              aria-label="Điều hướng Admin"
            >
              {visibleItems.map(({ id, label, icon: Icon }) => {
                const active = currentTab === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => select(id)}
                    aria-current={active ? "page" : undefined}
                    className={`w-full h-11 min-h-[44px] px-3 flex items-center gap-3 rounded text-sm font-semibold transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-accent ${
                      active
                        ? "bg-brand-primary text-white font-bold border-l-2 border-brand-accent shadow-2xs"
                        : "text-slate-200 hover:text-white hover:bg-brand-dark-hover"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? "text-brand-accent" : "text-slate-300"}`} />
                    <span className="truncate">{label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="p-3 border-t border-brand-dark-hover space-y-1 bg-bg-sidebar">
            <button
              type="button"
              onClick={() => select("profile")}
              className={`w-full h-11 min-h-[44px] px-3 flex items-center gap-3 rounded text-sm font-semibold transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-accent ${
                currentTab === "profile"
                  ? "bg-brand-primary text-white font-bold border-l-2 border-brand-accent shadow-2xs"
                  : "text-slate-200 hover:text-white hover:bg-brand-dark-hover"
              }`}
            >
              <UserCircle className={`w-4 h-4 shrink-0 ${currentTab === "profile" ? "text-brand-accent" : "text-slate-300"}`} />
              Hồ sơ
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="w-full h-11 min-h-[44px] px-3 flex items-center gap-3 rounded text-sm font-semibold text-slate-200 hover:text-white hover:bg-brand-dark-hover focus:outline-none focus:ring-2 focus:ring-brand-accent transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
