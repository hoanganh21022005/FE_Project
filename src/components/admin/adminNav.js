import {
  Activity,
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
  UserCheck,
  Users,
} from "lucide-react"
import { ROLE_ADMIN } from "../../utils/navigation.js"
import { hasAuthority } from "../../utils/paymentAccess.js"

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
        id: "ops_staff",
        label: "Nhân sự",
        labelEn: "Staff",
        icon: Users,
        path: "/admin/ops/staff",
        requiredAuthority: "MANAGE_USERS",
      },
      {
        id: "ops_members",
        label: "Hội viên",
        labelEn: "Members",
        icon: UserCheck,
        path: "/admin/ops/members",
        requiredAuthority: "MANAGE_USERS",
      },
      {
        id: "ops_packages",
        label: "Gói tập",
        labelEn: "Packages",
        icon: Package,
        path: "/admin/ops/packages",
        requiredAuthority: "MANAGE_PACKAGES",
      },
      {
        id: "ops_classes",
        label: "Lớp Normal",
        labelEn: "Normal Classes",
        icon: Calendar,
        path: "/admin/ops/classes",
        requiredAuthority: "MANAGE_CLASSES",
      },
      {
        id: "ops_holidays",
        label: "Ngày nghỉ",
        labelEn: "Holidays",
        icon: CalendarDays,
        path: "/admin/ops/holidays",
        requiredAuthority: "MANAGE_CLASSES",
      },
      {
        id: "ops_session_incidents",
        label: "Sự cố lịch học",
        labelEn: "Session Incidents",
        icon: Activity,
        path: "/admin/ops/session-incidents",
        requiredAuthority: "MANAGE_CLASSES",
      },
      {
        id: "ops_advanced_schedule",
        label: "Lớp Advanced",
        labelEn: "Advanced Classes",
        icon: CalendarDays,
        path: "/admin/ops/advanced-schedule",
        requiredAuthority: "MANAGE_CLASSES",
      },
      {
        id: "ops_resources",
        label: "Bộ môn & phòng",
        labelEn: "Disciplines & Rooms",
        icon: Library,
        path: "/admin/ops/resources",
        requiredAnyAuthority: ["MANAGE_CLASSES", "MANAGE_SPECIALIZATIONS"],
      },
      {
        id: "ops_payments",
        label: "Thanh toán",
        labelEn: "Payments",
        icon: CreditCard,
        path: "/admin/ops/payments",
        requiredAuthority: "MANAGE_INVOICES",
      },
      {
        id: "ops_refunds",
        label: "Hoàn tiền",
        labelEn: "Refunds",
        icon: ReceiptText,
        path: "/admin/ops/normal-refunds",
        requiredAuthority: "MANAGE_INVOICES",
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
        requiredAuthority: "REGISTER_MEMBER",
      },
      {
        id: "ops_reception_checkin",
        label: "Điểm danh & Check-in",
        labelEn: "Attendance & Check-in",
        icon: ClipboardCheck,
        path: "/admin/ops/reception/checkin",
        requiredAuthority: "REGISTER_MEMBER",
      },
      {
        id: "ops_reception_search",
        label: "Tra cứu hội viên",
        labelEn: "Member Lookup",
        icon: Search,
        path: "/admin/ops/reception/search",
        requiredAuthority: "REGISTER_MEMBER",
      },
      {
        id: "ops_reception_booking",
        label: "Đặt lớp",
        labelEn: "Class Booking",
        icon: CalendarPlus,
        path: "/admin/ops/reception/booking",
        requiredAuthority: "REGISTER_MEMBER",
      },
      {
        id: "ops_reception_payments",
        label: "Thu ngân",
        labelEn: "Cashier",
        icon: CreditCard,
        path: "/admin/ops/reception/payments",
        requiredAuthority: "MANAGE_INVOICES",
      },
    ],
  },
])

export const ADMIN_NAV_ITEMS = Object.freeze(
  ADMIN_NAV_GROUPS.flatMap((group) => group.items),
)

// Mục có requiredAuthority / requiredAnyAuthority chỉ hiện khi tài khoản Admin có
// quyền tương ứng. Nhóm hết mục thì ẩn.
// Không truyền `user` thì trả toàn bộ (giữ hành vi cũ cho nơi gọi chưa có user).
const canSeeNavItem = (item, user) => {
  if (!user) return true
  if (item.requiredAuthority && !hasAuthority(user, item.requiredAuthority)) {
    return false
  }
  if (
    Array.isArray(item.requiredAnyAuthority) &&
    item.requiredAnyAuthority.length > 0 &&
    !item.requiredAnyAuthority.some((auth) => hasAuthority(user, auth))
  ) {
    return false
  }
  return true
}

const canAccessNavItemStrict = (item, user) => {
  if (!user) return false
  if (item.requiredAuthority && !hasAuthority(user, item.requiredAuthority)) {
    return false
  }
  if (
    Array.isArray(item.requiredAnyAuthority) &&
    item.requiredAnyAuthority.length > 0 &&
    !item.requiredAnyAuthority.some((auth) => hasAuthority(user, auth))
  ) {
    return false
  }
  return true
}

const ADMIN_NAV_ITEMS_BY_PATH_LENGTH = [...ADMIN_NAV_ITEMS].sort(
  (a, b) => b.path.length - a.path.length,
)

export function canAccessAdminOpsPath(pathname, user) {
  if (!pathname || !pathname.startsWith("/admin/ops")) return true
  if (!user) return false
  if (pathname === "/admin/ops/audit-logs") {
    return hasAuthority(user, "VIEW_AUDIT_LOG")
  }
  const matched = ADMIN_NAV_ITEMS_BY_PATH_LENGTH.find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
  )
  if (!matched) return false
  return canAccessNavItemStrict(matched, user)
}

export function getAdminNavGroups(role, user) {
  if (role !== ROLE_ADMIN) return []
  if (!user) return ADMIN_NAV_GROUPS
  return ADMIN_NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canSeeNavItem(item, user)),
    }))
    .filter((group) => group.items.length > 0)
}

export function getAdminNavItems(role, user) {
  if (role !== ROLE_ADMIN) return []
  return getAdminNavGroups(role, user).flatMap((group) => group.items)
}
