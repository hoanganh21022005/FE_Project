import React, { useEffect, useState } from "react"
import { useSCMS } from "../../context/SCMSContext.jsx"
import { AdminHeader } from "./AdminHeader.jsx"
import { AdminSidebar } from "./AdminSidebar.jsx"

const STORAGE_LANG_KEY = "scms_admin_lang"

const TITLES = {
  vi: {
    admin_dashboard: "Tổng quan",
    admin_users: "Người dùng",
    admin_roles: "Vai trò & Quyền",
    admin_audit_logs: "Nhật ký",
    profile: "Hồ sơ cá nhân",
    forbidden: "Quyền truy cập bị từ chối",
  },
  en: {
    admin_dashboard: "Dashboard",
    admin_users: "Users",
    admin_roles: "Roles & Permissions",
    admin_audit_logs: "Audit Logs",
    profile: "Profile",
    forbidden: "Access Denied",
  },
}

export function AdminLayout({
  currentTab,
  currentTitle,
  onSelectTab,
  onLogout,
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { language, setLanguage } = useSCMS()

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LANG_KEY)
      if ((saved === "vi" || saved === "en") && saved !== language) {
        setLanguage(saved)
      }
    } catch {
      // ignore storage errors
    }
    // Sync stored Admin language on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChangeLanguage = (nextLang) => {
    if (nextLang !== "vi" && nextLang !== "en") return
    try {
      localStorage.setItem(STORAGE_LANG_KEY, nextLang)
    } catch {
      // ignore storage errors
    }
    setLanguage(nextLang)
  }

  const lang = language === "en" ? "en" : "vi"
  const resolvedTitle =
    (lang === "en" && TITLES.en[currentTab]) ||
    currentTitle ||
    TITLES[lang][currentTab] ||
    "Admin Portal"

  return (
    <div className="admin-shell min-h-screen bg-bg-main text-text-primary flex font-sans antialiased">
      <AdminSidebar
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="min-w-0 flex-1 flex flex-col">
        <AdminHeader
          title={resolvedTitle}
          onMenu={() => setSidebarOpen(true)}
          onLogout={onLogout}
          onChangeLanguage={handleChangeLanguage}
        />
        <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:px-8 lg:py-5">
          {children}
        </main>
      </div>
    </div>
  )
}
