import React, { useState } from "react"
import { AdminHeader } from "./AdminHeader.jsx"
import { AdminSidebar } from "./AdminSidebar.jsx"

const TITLES = {
  admin_dashboard: "Tổng quan hệ thống",
  admin_users: "Người dùng",
  admin_roles: "Vai trò & Quyền",
  admin_audit_logs: "Nhật ký hoạt động",
  profile: "Hồ sơ cá nhân",
  forbidden: "Quyền truy cập bị từ chối",
}

export function AdminLayout({
  currentTab,
  currentTitle,
  onSelectTab,
  onLogout,
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="admin-shell min-h-screen bg-admin-canvas text-stone-900 flex font-sans antialiased">
      <AdminSidebar
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        onLogout={onLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="min-w-0 flex-1 flex flex-col">
        <AdminHeader
          title={currentTitle || TITLES[currentTab] || "Admin Portal"}
          onMenu={() => setSidebarOpen(true)}
          onLogout={onLogout}
        />
        <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
