/**
 * SCMS Navigation & Role Routing Utilities
 * Follows specification in SCMS_FE_AGENT_PROMPTS.md (G1.1 - G1.3)
 */

export const ROLE_ADMIN = "admin"
export const ROLE_MANAGER = "manager"
export const ROLE_COACH = "coach"
export const ROLE_RECEPTIONIST = "receptionist"
export const ROLE_MEMBER = "member"

export const SUPPORTED_ROLES = Object.freeze([
  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_COACH,
  ROLE_RECEPTIONIST,
  ROLE_MEMBER,
])

/**
 * G1.1: Normalize role returned from backend API.
 * Rules:
 *   Admin -> admin
 *   CenterManager/Manager -> manager
 *   Coach -> coach
 *   Receptionist -> receptionist
 *   Member -> member
 *   Role lạ -> unsupported / null in API mode (DO NOT fallback to manager).
 */
export function normalizeRole(rawRole, { isApiMode = false } = {}) {
  if (!rawRole) {
    return isApiMode ? null : ROLE_MANAGER
  }
  const clean = String(rawRole)
    .trim()
    .toLowerCase()
    .replace(/^role_/, "")

  if (clean === "admin") return ROLE_ADMIN
  if (clean === "centermanager" || clean === "manager") return ROLE_MANAGER
  if (clean === "coach") return ROLE_COACH
  if (clean === "receptionist") return ROLE_RECEPTIONIST
  if (clean === "member") return ROLE_MEMBER

  // In API mode, unknown role is unsupported. NEVER fallback to manager!
  if (isApiMode) {
    return null
  }
  return ROLE_MANAGER
}

/**
 * Resolve the demo user without letting the generic demo password override a
 * known Member account. This helper is used only when API mode is disabled.
 */
export function resolveMockLoginUser({
  email,
  password,
  members = [],
  managerEmail,
  demoPassword,
}) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase()
  const normalizedManagerEmail = String(managerEmail || "").toLowerCase()

  if (normalizedEmail === normalizedManagerEmail && password === demoPassword) {
    return {
      role: ROLE_MANAGER,
      email: normalizedEmail,
      fullName: "Manager Demo",
    }
  }

  const member = members.find(
    (item) => String(item?.email || "").toLowerCase() === normalizedEmail,
  )
  if (member) {
    return {
      role: ROLE_MEMBER,
      email: normalizedEmail,
      fullName: member.name,
    }
  }

  if (password === demoPassword) {
    return {
      role: ROLE_MANAGER,
      email: normalizedEmail,
      fullName: "Manager Demo",
    }
  }

  return null
}

/**
 * G1.2: Default route for each role.
 */
export function getDefaultDashboard(role) {
  switch (role) {
    case ROLE_ADMIN:
      return "/admin/dashboard"
    case ROLE_MANAGER:
      return "/manager/dashboard"
    case ROLE_COACH:
      return "/coach/dashboard"
    case ROLE_RECEPTIONIST:
      return "/receptionist/dashboard"
    case ROLE_MEMBER:
      return "/member/dashboard"
    default:
      return "/"
  }
}

/**
 * Default tab for each role.
 */
export function getDefaultTab(role) {
  switch (role) {
    case ROLE_ADMIN:
      return "admin_dashboard"
    case ROLE_MANAGER:
      return "dashboard"
    case ROLE_COACH:
      return "coach_dashboard"
    case ROLE_RECEPTIONIST:
      return "reception_dashboard"
    case ROLE_MEMBER:
      return "member_dashboard"
    default:
      return "dashboard"
  }
}

/**
 * Resolve the post-login destination from the user returned by login().
 * API mode deliberately returns null for unsupported roles instead of
 * falling back to a privileged dashboard.
 */
export function getLoginDestination(
  userOrRole,
  intendedLocation,
  { isApiMode = false } = {},
) {
  const rawRole = typeof userOrRole === "string" ? userOrRole : userOrRole?.role
  const role = normalizeRole(rawRole, { isApiMode })

  if (!role) return null

  const intendedRoute = intendedLocation ? resolveRoute(intendedLocation) : null
  const canRestoreIntendedRoute =
    intendedRoute &&
    !intendedRoute.isPublic &&
    Boolean(intendedRoute.tab) &&
    isPathAllowedForRole(intendedRoute.path, role)

  return {
    role,
    path: canRestoreIntendedRoute
      ? intendedRoute.path
      : getDefaultDashboard(role),
  }
}

/**
 * Route-to-tab mappings for deep link support (G1.3).
 */
const ROUTE_TAB_MAP = {
  // Manager routes
  "/manager/dashboard": { role: ROLE_MANAGER, tab: "dashboard" },
  "/manager/staff": { role: ROLE_MANAGER, tab: "staff" },
  "/manager/members": { role: ROLE_MANAGER, tab: "members" },
  "/manager/packages": { role: ROLE_MANAGER, tab: "packages" },
  "/manager/classes": { role: ROLE_MANAGER, tab: "classes" },
  "/manager/resources": { role: ROLE_MANAGER, tab: "resources" },
  "/manager/payments": { role: ROLE_MANAGER, tab: "payments" },
  "/manager/reports": { role: ROLE_MANAGER, tab: "reports" },
  "/manager/audit-logs": { role: ROLE_MANAGER, tab: "auditLogs" },

  // Coach routes
  "/coach/dashboard": { role: ROLE_COACH, tab: "coach_dashboard" },
  "/coach/schedule": { role: ROLE_COACH, tab: "coach_schedule" },
  "/coach/attendance": { role: ROLE_COACH, tab: "coach_attendance" },
  "/coach/assigned-members": {
    role: ROLE_COACH,
    tab: "coach_assigned_members",
  },
  "/coach/progress": { role: ROLE_COACH, tab: "coach_progress" },

  // Receptionist routes
  "/receptionist/dashboard": {
    role: ROLE_RECEPTIONIST,
    tab: "reception_dashboard",
  },
  "/receptionist/member-search": {
    role: ROLE_RECEPTIONIST,
    tab: "reception_member_search",
  },
  "/receptionist/booking": {
    role: ROLE_RECEPTIONIST,
    tab: "reception_booking",
  },
  "/receptionist/payments": {
    role: ROLE_RECEPTIONIST,
    tab: "reception_payments",
  },

  // Member routes
  "/member/dashboard": { role: ROLE_MEMBER, tab: "member_dashboard" },
  "/member/my-membership": { role: ROLE_MEMBER, tab: "member_my_membership" },
  "/member/class-catalog": { role: ROLE_MEMBER, tab: "member_class_catalog" },
  "/member/attendance-history": {
    role: ROLE_MEMBER,
    tab: "member_attendance_history",
  },
  "/member/training-plan": { role: ROLE_MEMBER, tab: "member_training_plan" },

  // Admin routes
  "/admin/dashboard": { role: ROLE_ADMIN, tab: "admin_dashboard" },

  // Shared routes
  "/settings": { role: null, tab: "settings" },
  "/support": { role: null, tab: "support" },
  "/profile": { role: null, tab: "profile" },
}

/**
 * Tab-to-route lookup for active role.
 */
const TAB_ROUTE_MAP = {
  // Manager
  dashboard: "/manager/dashboard",
  staff: "/manager/staff",
  members: "/manager/members",
  packages: "/manager/packages",
  classes: "/manager/classes",
  resources: "/manager/resources",
  payments: "/manager/payments",
  reports: "/manager/reports",
  auditLogs: "/manager/audit-logs",

  // Coach
  coach_dashboard: "/coach/dashboard",
  coach_schedule: "/coach/schedule",
  coach_attendance: "/coach/attendance",
  coach_assigned_members: "/coach/assigned-members",
  coach_progress: "/coach/progress",

  // Receptionist
  reception_dashboard: "/receptionist/dashboard",
  reception_member_search: "/receptionist/member-search",
  reception_booking: "/receptionist/booking",
  reception_payments: "/receptionist/payments",

  // Member
  member_dashboard: "/member/dashboard",
  member_my_membership: "/member/my-membership",
  member_class_catalog: "/member/class-catalog",
  member_attendance_history: "/member/attendance-history",
  member_training_plan: "/member/training-plan",

  // Admin
  admin_dashboard: "/admin/dashboard",

  // Shared
  settings: "/settings",
  support: "/support",
  profile: "/profile",
}

/**
 * Resolve a pathname to tab and role info.
 */
export function resolveRoute(pathname) {
  const normalizedPath = String(pathname || "/").replace(/\/+$/, "") || "/"
  if (
    normalizedPath === "/" ||
    normalizedPath === "/login" ||
    normalizedPath === "/register"
  ) {
    return {
      isPublic: true,
      publicView: normalizedPath === "/" ? "home" : normalizedPath.slice(1),
      path: normalizedPath,
      tab: null,
      role: null,
    }
  }

  const match = ROUTE_TAB_MAP[normalizedPath]
  if (match) {
    return {
      isPublic: false,
      publicView: null,
      path: normalizedPath,
      tab: match.tab,
      role: match.role,
    }
  }

  return {
    isPublic: false,
    publicView: null,
    path: normalizedPath,
    tab: null,
    role: null,
  }
}

/**
 * Get route path for a given tab and role.
 */
export function getRouteForTab(tab, role) {
  if (TAB_ROUTE_MAP[tab]) {
    return TAB_ROUTE_MAP[tab]
  }
  return getDefaultDashboard(role)
}

/**
 * Check if a path is allowed/valid for a given role.
 */
export function isPathAllowedForRole(pathname, role) {
  const route = resolveRoute(pathname)
  if (route.isPublic) return true
  if (!route.tab) return false
  if (!route.role) return true // shared routes like /settings
  return route.role === role
}

/**
 * Choose the route that should be rendered after /api/auth/me restores a
 * supported session. Known deep links are preserved; public, unknown, or
 * mismatched paths resolve to the role's own dashboard.
 */
export function resolveAuthenticatedRoute(pathname, role) {
  const normalizedRole = normalizeRole(role, { isApiMode: true })
  if (!normalizedRole) return null

  const requestedRoute = resolveRoute(pathname)
  if (
    !requestedRoute.isPublic &&
    requestedRoute.tab &&
    isPathAllowedForRole(requestedRoute.path, normalizedRole)
  ) {
    return requestedRoute
  }

  return resolveRoute(getDefaultDashboard(normalizedRole))
}

/**
 * Check if a tab is allowed/valid for a given role.
 */
export function isTabAllowedForRole(tab, role) {
  if (!tab) return false
  if (tab === "settings" || tab === "support" || tab === "profile") return true
  for (const entry of Object.values(ROUTE_TAB_MAP)) {
    if (entry.tab === tab) {
      return entry.role === role
    }
  }
  return false
}
