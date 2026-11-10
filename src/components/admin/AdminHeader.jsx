import React from "react"
import { LogOut, Menu, ShieldCheck } from "lucide-react"
import { useSCMS } from "../../context/SCMSContext.jsx"

export function AdminHeader({ title, onMenu, onLogout }) {
  const { currentUser } = useSCMS()
  const userName = currentUser?.name || "Admin"
  const userEmail = currentUser?.email || "admin@scms.com"

  return (
    <header className="h-16 shrink-0 border-b border-border-color bg-bg-card px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenu}
          className="inline-flex min-h-11 min-w-11 -ml-2 items-center justify-center rounded text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 lg:hidden cursor-pointer"
          aria-label="Mở menu Admin"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <p className="text-xs leading-4 font-medium text-brand-primary flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Admin Portal
          </p>
          <h1 className="text-2xl leading-8 font-bold text-text-primary truncate">
            {title}
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:block text-right min-w-0">
          <p className="text-sm leading-5 font-semibold text-text-primary truncate max-w-48">
            {userName}
          </p>
          <p className="text-xs leading-4 font-medium text-text-secondary truncate max-w-48">
            {userEmail}
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          title="Đăng xuất"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded border border-border-color bg-bg-card text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span className="sr-only">Đăng xuất</span>
        </button>
      </div>
    </header>
  )
}
