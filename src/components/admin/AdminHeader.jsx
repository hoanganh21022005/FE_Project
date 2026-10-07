import React from "react"
import { LogOut, Menu, ShieldCheck } from "lucide-react"
import { useSCMS } from "../../context/SCMSContext.jsx"

export function AdminHeader({ title, onMenu, onLogout }) {
  const { currentUser } = useSCMS()
  const userName = currentUser?.name || "Admin"
  const userEmail = currentUser?.email || "admin@scms.com"

  return (
    <header className="h-16 shrink-0 border-b border-stone-200 bg-white px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenu}
          className="w-11 h-11 min-h-[44px] min-w-[44px] -ml-2 inline-flex items-center justify-center rounded text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-[#BA0000] lg:hidden transition-colors cursor-pointer"
          aria-label="Mở menu Admin"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[#BA0000] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Admin Portal
          </p>
          <h1 className="text-base font-bold text-stone-950 truncate">
            {title}
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:block text-right min-w-0">
          <p className="text-xs font-bold text-stone-900 truncate max-w-48">
            {userName}
          </p>
          <p className="text-[11px] text-stone-600 truncate max-w-48">
            {userEmail}
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          title="Đăng xuất"
          className="w-11 h-11 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded border border-stone-300 text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-[#BA0000] focus:ring-offset-2 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span className="sr-only">Đăng xuất</span>
        </button>
      </div>
    </header>
  )
}
