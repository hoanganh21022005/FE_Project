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
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-stone-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col justify-between">
          <div>
            <div className="h-16 px-5 flex items-center justify-between border-b border-stone-200">
              <button
                type="button"
                onClick={() => select("admin_dashboard")}
                className="flex items-center gap-3 text-left focus:outline-none focus:ring-2 focus:ring-[#BA0000] rounded cursor-pointer"
              >
                <img
                  src="/images/vibe-sport-logo.png?v=2"
                  alt="Vibe Sport"
                  className="w-12 h-9 object-contain flex-shrink-0"
                />
                <div>
                  <p className="text-sm font-extrabold text-stone-950 leading-none">
                    VIBE Sport Admin
                  </p>
                  <p className="mt-1 text-[11px] text-stone-600">
                    Quản trị hệ thống
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-11 h-11 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-stone-600 hover:bg-stone-100 rounded lg:hidden transition-colors cursor-pointer"
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
                    className={`w-full h-11 min-h-[44px] px-3 flex items-center gap-3 rounded text-sm font-semibold transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#BA0000] ${
                      active
                        ? "bg-red-50 text-red-950 font-bold border-l-2 border-[#BA0000] shadow-2xs"
                        : "text-stone-700 hover:bg-stone-100"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? "text-[#BA0000]" : "text-stone-500"}`} />
                    <span className="truncate">{label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="p-3 border-t border-stone-200 space-y-1 bg-white">
            <button
              type="button"
              onClick={() => select("profile")}
              className={`w-full h-11 min-h-[44px] px-3 flex items-center gap-3 rounded text-sm font-semibold transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#BA0000] ${
                currentTab === "profile"
                  ? "bg-red-50 text-red-950 font-bold border-l-2 border-[#BA0000] shadow-2xs"
                  : "text-stone-700 hover:bg-stone-100"
              }`}
            >
              <UserCircle className={`w-4 h-4 shrink-0 ${currentTab === "profile" ? "text-[#BA0000]" : "text-stone-500"}`} />
              Hồ sơ
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="w-full h-11 min-h-[44px] px-3 flex items-center gap-3 rounded text-sm font-semibold text-rose-800 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-600 transition-colors cursor-pointer"
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
