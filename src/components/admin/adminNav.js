import {
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react"
import { ROLE_ADMIN } from "../../utils/navigation.js"

export const ADMIN_NAV_ITEMS = Object.freeze([
  {
    id: "admin_dashboard",
    label: "Tổng quan",
    icon: LayoutDashboard,
  },
  {
    id: "admin_users",
    label: "Người dùng",
    icon: Users,
  },
  {
    id: "admin_roles",
    label: "Vai trò & Quyền",
    icon: ShieldCheck,
  },
  {
    id: "admin_audit_logs",
    label: "Nhật ký",
    icon: ScrollText,
  },
])

/**
 * G2.2 Invariant: For Admin, always expose the 4 read-only G2 destinations.
 * Authorities are reserved for granular actions and G3 mutations.
 */
export function getAdminNavItems(role) {
  if (role !== ROLE_ADMIN) return []
  return ADMIN_NAV_ITEMS
}
