import React, { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useSCMS } from "../../context/SCMSContext"
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Package,
  Calendar,
  CalendarDays,
  ClipboardCheck,
  TrendingUp,
  CalendarPlus,
  CreditCard,
  ReceiptText,
  BarChart3,
  History,
  Search,
  ChevronLeft,
  ChevronRight,
  Activity,
  Award,
  Settings,
  HelpCircle,
  Library,
  X,
  UserRound,
  Dumbbell,
  MessageSquareHeart,
  Bell,
  PauseCircle,
} from "lucide-react"

export function Sidebar({ mobileOpen = false, onCloseMobile }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { role, language, t } = useSCMS()
  const [collapsed, setCollapsed] = useState(false)

  const handleNav = (path) => {
    navigate(path)
    if (onCloseMobile) onCloseMobile()
  }

  const getNavItems = () => {
    switch (role) {
      case "manager":
        return [
          {
            path: "/manager/dashboard",
            labelKey: "dashboard",
            icon: LayoutDashboard,
          },
          { path: "/manager/staff", labelKey: "staff", icon: Users },
          { path: "/manager/members", labelKey: "members", icon: UserCheck },
          { path: "/manager/packages", labelKey: "packages", icon: Package },
          {
            path: "/manager/classes",
            label: language === "vi" ? "Lớp Normal" : "Normal Classes",
            icon: Calendar,
          },
          {
            path: "/manager/advanced-schedule",
            label: language === "vi" ? "Lớp Advanced" : "Advanced Classes",
            icon: CalendarDays,
          },
          {
            path: "/manager/holidays",
            label: language === "vi" ? "Ngày nghỉ" : "Holidays",
            icon: Calendar,
          },
          {
            path: "/manager/session-incidents",
            label: language === "vi" ? "Sự cố lịch học" : "Session incidents",
            icon: Activity,
          },
          {
            path: "/manager/resources",
            labelKey: "resources",
            label: language === "vi" ? "Bộ môn & phòng" : "Subjects & Rooms",
            icon: Library,
          },
          { path: "/manager/payments", labelKey: "payments", icon: CreditCard },
          {
            path: "/manager/normal-refunds",
            label: language === "vi" ? "Hoàn tiền Normal" : "Normal refunds",
            icon: ReceiptText,
          },
          { path: "/manager/reports", labelKey: "reports", icon: BarChart3 },
          { path: "/manager/audit-logs", labelKey: "auditLogs", icon: History },
        ]

      case "coach":
        return [
          {
            path: "/coach/dashboard",
            label: language === "vi" ? "Tổng quan" : "Dashboard",
            icon: LayoutDashboard,
          },
          {
            path: "/coach/schedule",
            label: language === "vi" ? "Thời khóa biểu & Lịch dạy" : "Schedule & Timetable",
            icon: Calendar,
          },
          {
            path: "/coach/attendance",
            label: language === "vi" ? "Điểm danh (Normal & Advanced)" : "Attendance (Normal & PT)",
            icon: ClipboardCheck,
          },
          {
            path: "/coach/assigned-members",
            label: language === "vi" ? "Đăng ký sân PT 1:1" : "1:1 Court Booking",
            icon: CalendarPlus,
          },
          {
            path: "/coach/progress",
            label: language === "vi" ? "Đánh giá & Tiến độ" : "Training Progress",
            icon: TrendingUp,
          },
        ]

      case "receptionist":
        return [
          {
            path: "/receptionist/dashboard",
            labelKey: "dashboard",
            icon: LayoutDashboard,
          },
          {
            path: "/receptionist/checkin",
            label: language === "vi" ? "Điểm danh & Check-in" : "Check-in Desk",
            icon: ClipboardCheck,
          },
          {
            path: "/receptionist/search",
            labelKey: "memberSearch",
            icon: Search,
          },
          {
            path: "/receptionist/booking",
            labelKey: "bookings",
            icon: Calendar,
          },
          {
            path: "/receptionist/payments",
            labelKey: "payments",
            icon: CreditCard,
          },
        ]

      case "member":
        return [
          {
            path: "/member/dashboard",
            labelKey: "dashboard",
            icon: LayoutDashboard,
          },
          {
            path: "/member/invoices",
            label:
              language === "vi"
                ? "Hóa đơn & thanh toán"
                : "Invoices & payments",
            icon: CreditCard,
          },
          {
            path: "/member/my-membership",
            labelKey: "myMembership",
            label: language === "vi" ? "Gói hội viên của tôi" : "My Membership",
            icon: Award,
          },
          {
            path: "/member/freeze-request",
            label: language === "vi" ? "Bảo lưu gói tập" : "Freeze membership",
            icon: PauseCircle,
          },
          {
            path: "/member/catalog",
            label:
              language === "vi" ? "Đăng ký khóa học" : "Course registration",
            icon: Dumbbell,
          },
          {
            path: "/member/enrollments",
            matchPaths: ["/member/enrollments"],
            labelKey: "myEnrollments",
            icon: CreditCard,
          },
          {
            path: "/member/schedule",
            matchPaths: ["/member/schedule"],
            labelKey: "schedulePageTitle",
            icon: Calendar,
          },
          {
            path: "/member/attendance",
            labelKey: "attendance",
            icon: ClipboardCheck,
          },
          {
            path: "/member/my-coach",
            label: language === "vi" ? "Huấn luyện viên của tôi" : "My Coach",
            icon: UserCheck,
          },
          {
            path: "/member/progress",
            label:
              language === "vi" ? "Tiến độ tập luyện" : "Training progress",
            icon: Activity,
          },
          {
            path: "/member/feedback",
            labelKey: "feedback",
            icon: MessageSquareHeart,
          },
        ]

      default:
        return []
    }
  }

  const navItems = getNavItems()

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label={language === "vi" ? "Đóng menu" : "Close menu"}
          onClick={onCloseMobile}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Enter") onCloseMobile?.()
          }}
          className="fixed inset-0 z-40 bg-stone-950/50 backdrop-blur-xs md:hidden cursor-pointer"
        />
      )}

      <aside
        className={`bg-bg-sidebar text-text-inverse border-r border-brand-dark-hover flex flex-col justify-between transition-all duration-200
          fixed inset-y-0 left-0 z-50 md:sticky md:top-0 md:bottom-auto md:h-screen md:self-start md:overflow-y-auto md:z-40
          ${
            mobileOpen
              ? "translate-x-0 shadow-2xl"
              : "-translate-x-full md:translate-x-0"
          }
          w-[288px] ${collapsed ? "md:w-16" : "md:w-[288px]"}
        `}
      >
        {/* Brand Header & Navigation */}
        <div>
          <div
            className={`h-[56px] border-b border-brand-dark-hover flex items-center justify-between ${
              collapsed ? "px-2" : "px-3.5"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/images/MainPage/vibe-sport-logo.png?v=4"
                alt="Vibe Sport"
                className={`object-contain flex-shrink-0 ${
                  collapsed ? "w-10 h-8" : "w-12 h-9"
                }`}
              />
              {(!collapsed || mobileOpen) && (
                <div className="truncate">
                  <div className="text-xs font-bold tracking-tight text-white uppercase leading-tight truncate">
                    VIBE Sport SYSTEM
                  </div>
                  <div className="text-[9px] text-slate-300 font-bold tracking-wider uppercase leading-tight truncate">
                    SPORTS CENTER
                  </div>
                </div>
              )}
            </div>

            {/* Mobile close button (visible on mobile drawer) */}
            <button
              type="button"
              onClick={onCloseMobile}
              className="md:hidden w-7 h-7 rounded-md bg-brand-dark-hover hover:bg-brand-primary-active text-white transition-colors border border-white/10 flex items-center justify-center flex-shrink-0 cursor-pointer"
              aria-label={language === "vi" ? "Đóng menu" : "Close menu"}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Desktop collapse/expand button (hidden on mobile) */}
            <div className="hidden md:flex items-center">
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  className="w-7 h-7 rounded-md bg-brand-dark-hover hover:bg-brand-primary-active text-white transition-colors border border-white/10 flex items-center justify-center flex-shrink-0 cursor-pointer"
                  title={
                    language === "vi"
                      ? "Thu gọn thanh điều hướng"
                      : "Collapse Sidebar"
                  }
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCollapsed(false)}
                  className="w-6 h-6 rounded-md bg-brand-dark-hover hover:bg-brand-primary-active text-white transition-colors border border-white/10 flex items-center justify-center flex-shrink-0 cursor-pointer"
                  title={
                    language === "vi"
                      ? "Mở rộng thanh điều hướng"
                      : "Expand Sidebar"
                  }
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="p-2.5 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = Array.isArray(item.matchPaths)
                ? item.matchPaths.some(
                    (p) =>
                      location.pathname === p ||
                      location.pathname.startsWith(`${p}/`),
                  )
                : location.pathname === item.path ||
                  location.pathname.startsWith(`${item.path}/`)

              return (
                <button
                  type="button"
                  key={item.path}
                  onClick={() => handleNav(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all cursor-pointer ${
                    isActive
                      ? "bg-brand-primary text-white font-semibold border-l-2 border-brand-accent shadow-2xs"
                      : "text-slate-200 hover:text-white hover:bg-brand-dark-hover font-medium"
                  }`}
                  title={collapsed ? item.label || t(item.labelKey) : undefined}
                >
                  <Icon
                    className={`w-4 h-4 flex-shrink-0 ${
                      isActive ? "text-brand-accent" : "text-slate-300"
                    }`}
                  />
                  {(!collapsed || mobileOpen) && (
                    <span className="truncate">
                      {item.label || t(item.labelKey)}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Footer Settings & Support */}
        <div className="p-2.5 border-t border-brand-dark-hover space-y-1">
          {role === "member" && (
            <button
              type="button"
              onClick={() => handleNav("/profile")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
                location.pathname === "/profile"
                  ? "bg-brand-primary text-white font-bold border-l-2 border-brand-accent"
                  : "text-slate-200 hover:text-white hover:bg-brand-dark-hover"
              }`}
              title={
                collapsed
                  ? language === "vi"
                    ? "Thông tin cá nhân"
                    : "Profile"
                  : undefined
              }
            >
              <UserRound className="w-4 h-4 text-slate-300 flex-shrink-0" />
              {(!collapsed || mobileOpen) && (
                <span className="truncate">
                  {language === "vi" ? "Thông tin cá nhân" : "Profile"}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => handleNav("/settings")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
              location.pathname.includes("/settings")
                ? "bg-brand-primary text-white font-bold border-l-2 border-brand-accent"
                : "text-slate-200 hover:text-white hover:bg-brand-dark-hover"
            }`}
            title={collapsed ? t("settings") : undefined}
          >
            <Settings className="w-4 h-4 text-slate-300 flex-shrink-0" />
            {(!collapsed || mobileOpen) && (
              <span className="truncate">{t("settings")}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleNav("/support")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
              location.pathname.includes("/support")
                ? "bg-brand-primary text-white font-bold border-l-2 border-brand-accent"
                : "text-slate-200 hover:text-white hover:bg-brand-dark-hover"
            }`}
            title={collapsed ? t("support") : undefined}
          >
            <HelpCircle className="w-4 h-4 text-slate-300 flex-shrink-0" />
            {(!collapsed || mobileOpen) && (
              <span className="truncate">{t("support")}</span>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
