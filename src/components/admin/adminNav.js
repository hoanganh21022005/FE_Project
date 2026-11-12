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
    title: "Quản trị hệ thống",
    items: [
      {
        id: "admin_dashboard",
        label: "Tổng quan",
        icon: LayoutDashboard,
        path: "/admin/dashboard",
      },
      {
        id: "admin_users",
        label: "Người dùng",
        icon: Users,
        path: "/admin/users",
      },
      {
        id: "admin_roles",
        label: "Vai trò & Quyền",
        icon: ShieldCheck,
        path: "/admin/roles",
      },
      {
        id: "admin_audit_logs",
        label: "Nhật ký",
        icon: ScrollText,
        path: "/admin/audit-logs",
      },
    ],
  },
  {
    title: "Quản lý trung tâm",
    items: [
      {
        id: "ops_manager_dashboard",
        label: "Tổng quan quản lý",
        icon: BarChart3,
        path: "/admin/ops/dashboard",
      },
      {
        id: "ops_staff",
        label: "Nhân sự",
        icon: Users,
        path: "/admin/ops/staff",
      },
      {
        id: "ops_members",
        label: "Hội viên",
        icon: UserCheck,
        path: "/admin/ops/members",
      },
      {
        id: "ops_packages",
        label: "Gói tập",
        icon: Package,
        path: "/admin/ops/packages",
      },
      {
        id: "ops_classes",
        label: "Lớp học",
        icon: Calendar,
        path: "/admin/ops/classes",
      },
      {
        id: "ops_holidays",
        label: "Ngày nghỉ",
        icon: CalendarDays,
        path: "/admin/ops/holidays",
      },
      {
        id: "ops_session_incidents",
        label: "Sự cố lịch học",
        icon: Activity,
        path: "/admin/ops/session-incidents",
      },
      {
        id: "ops_resources",
        label: "Bộ môn & phòng",
        icon: Library,
        path: "/admin/ops/resources",
      },
      {
        id: "ops_payments",
        label: "Thanh toán",
        icon: CreditCard,
        path: "/admin/ops/payments",
      },
      {
        id: "ops_refunds",
        label: "Hoàn tiền Normal",
        icon: ReceiptText,
        path: "/admin/ops/normal-refunds",
      },
      {
        id: "ops_reports",
        label: "Báo cáo",
        icon: TrendingUp,
        path: "/admin/ops/reports",
      },
    ],
  },
  {
    title: "Lễ tân",
    items: [
      {
        id: "ops_reception_dashboard",
        label: "Tổng quan lễ tân",
        icon: LayoutDashboard,
        path: "/admin/ops/reception/dashboard",
      },
      {
        id: "ops_reception_checkin",
        label: "Điểm danh & Check-in",
        icon: ClipboardCheck,
        path: "/admin/ops/reception/checkin",
      },
      {
        id: "ops_reception_search",
        label: "Tra cứu hội viên",
        icon: Search,
        path: "/admin/ops/reception/search",
      },
      {
        id: "ops_reception_booking",
        label: "Đặt lớp",
        icon: CalendarPlus,
        path: "/admin/ops/reception/booking",
      },
      {
        id: "ops_reception_payments",
        label: "Thu ngân",
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
