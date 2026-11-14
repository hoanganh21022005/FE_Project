import {
  Activity,
  BarChart3,
  Calendar,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  Library,
  Package,
  ReceiptText,
  ScrollText,
  Search,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react"
import { ROLE_ADMIN } from "../../utils/navigation.js"

export const ADMIN_NAV_GROUPS = Object.freeze([
  {
    key: "system",
    title: "Quản trị hệ thống",
    titleEn: "System Administration",
    items: [
      {
        id: "admin_dashboard",
        label: "Tổng quan",
        labelEn: "Dashboard",
        icon: LayoutDashboard,
        path: "/admin/dashboard",
      },
      {
        id: "admin_users",
        label: "Người dùng",
        labelEn: "Users",
        icon: Users,
        path: "/admin/users",
      },
      {
        id: "admin_roles",
        label: "Vai trò & Quyền",
        labelEn: "Roles & Permissions",
        icon: ShieldCheck,
        path: "/admin/roles",
      },
      {
        id: "admin_audit_logs",
        label: "Nhật ký",
        labelEn: "Audit Logs",
        icon: ScrollText,
        path: "/admin/audit-logs",
      },
    ],
  },
  {
    key: "management",
    title: "Quản lý trung tâm",
    titleEn: "Center Management",
    items: [
      {
        id: "ops_manager_dashboard",
        label: "Tổng quan quản lý",
        labelEn: "Manager Overview",
        icon: BarChart3,
        path: "/admin/ops/dashboard",
      },
      {
        id: "ops_staff",
        label: "Nhân sự",
        labelEn: "Staff",
        icon: Users,
        path: "/admin/ops/staff",
      },
      {
        id: "ops_members",
        label: "Hội viên",
        labelEn: "Members",
        icon: UserCheck,
        path: "/admin/ops/members",
      },
      {
        id: "ops_packages",
        label: "Gói tập",
        labelEn: "Packages",
        icon: Package,
        path: "/admin/ops/packages",
      },
      {
        id: "ops_classes",
        label: "Lớp học",
        labelEn: "Classes",
        icon: Calendar,
        path: "/admin/ops/classes",
      },
      {
        id: "ops_holidays",
        label: "Ngày nghỉ",
        labelEn: "Holidays",
        icon: CalendarDays,
        path: "/admin/ops/holidays",
      },
      {
        id: "ops_session_incidents",
        label: "Sự cố lịch học",
        labelEn: "Session Incidents",
        icon: Activity,
        path: "/admin/ops/session-incidents",
      },
      {
        id: "ops_resources",
        label: "Bộ môn & phòng",
        labelEn: "Disciplines & Rooms",
        icon: Library,
        path: "/admin/ops/resources",
      },
      {
        id: "ops_payments",
        label: "Thanh toán",
        labelEn: "Payments",
        icon: CreditCard,
        path: "/admin/ops/payments",
      },
      {
        id: "ops_refunds",
        label: "Hoàn tiền Normal",
        labelEn: "Normal Refunds",
        icon: ReceiptText,
        path: "/admin/ops/normal-refunds",
      },
      {
        id: "ops_reports",
        label: "Báo cáo",
        labelEn: "Reports",
        icon: TrendingUp,
        path: "/admin/ops/reports",
      },
    ],
  },
  {
    key: "reception",
    title: "Lễ tân",
    titleEn: "Reception",
    items: [
      {
        id: "ops_reception_dashboard",
        label: "Tổng quan lễ tân",
        labelEn: "Reception Overview",
        icon: LayoutDashboard,
        path: "/admin/ops/reception/dashboard",
      },
      {
        id: "ops_reception_checkin",
        label: "Điểm danh & Check-in",
        labelEn: "Attendance & Check-in",
        icon: ClipboardCheck,
        path: "/admin/ops/reception/checkin",
      },
      {
        id: "ops_reception_search",
        label: "Tra cứu hội viên",
        labelEn: "Member Lookup",
        icon: Search,
        path: "/admin/ops/reception/search",
      },
      {
        id: "ops_reception_booking",
        label: "Đặt lớp",
        labelEn: "Class Booking",
        icon: CalendarPlus,
        path: "/admin/ops/reception/booking",
      },
      {
        id: "ops_reception_payments",
        label: "Thu ngân",
        labelEn: "Cashier",
        icon: CreditCard,
        path: "/admin/ops/reception/payments",
      },
    ],
  },
])

export const ADMIN_NAV_ITEMS = Object.freeze(
  ADMIN_NAV_GROUPS.flatMap((group) => group.items),
)

export function getAdminNavGroups(role) {
  if (role !== ROLE_ADMIN) return []
  return ADMIN_NAV_GROUPS
}

export function getAdminNavItems(role) {
  if (role !== ROLE_ADMIN) return []
  return ADMIN_NAV_ITEMS
}
