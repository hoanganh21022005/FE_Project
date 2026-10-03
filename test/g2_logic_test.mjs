import assert from "node:assert/strict"
import {
  ROLE_ADMIN,
  ROLE_MANAGER,
  checkRouteAccess,
  getRouteForTab,
  resolveRoute,
} from "../src/utils/navigation.js"
import {
  mapAdminAuditLog,
  mapAdminPermission,
  mapAdminRole,
  mapAdminUser,
} from "../src/api/adminMappers.js"
import {
  getAdminAuditLogs,
  getAdminPermissions,
  getAdminRoles,
  getAdminUsers,
} from "../src/api/adminApi.js"
import {
  createAdminResources,
  updateAdminResource,
} from "../src/components/admin/adminResourceState.js"

console.log("==============================================")
console.log("RUNNING G2 ADMIN PORTAL LOGIC TEST SUITE")
console.log("==============================================")

const adminRoutes = {
  "/admin/dashboard": "admin_dashboard",
  "/admin/users": "admin_users",
  "/admin/roles": "admin_roles",
  "/admin/audit-logs": "admin_audit_logs",
}

for (const [path, tab] of Object.entries(adminRoutes)) {
  const route = resolveRoute(path)
  assert.equal(route.role, ROLE_ADMIN)
  assert.equal(route.tab, tab)
  assert.equal(checkRouteAccess(path, ROLE_ADMIN).status, "allowed")
  assert.equal(checkRouteAccess(path, ROLE_MANAGER).status, "forbidden")
  assert.equal(getRouteForTab(tab, ROLE_ADMIN), path)
}

const adminLogin = resolveRoute("/admin/login")
assert.equal(adminLogin.isPublic, true)
assert.equal(adminLogin.publicView, "admin-login")
console.log("PASS: G2.1 Admin entry and route isolation")

const mappedUser = mapAdminUser({
  id: 12,
  code: "USR-012",
  fullName: "Nguyen Test",
  email: "test@scms.com",
  status: "Active",
  roleId: 5,
  roleName: "Admin",
  permissions: ["MANAGE_USERS"],
})
assert.equal(mappedUser.id, 12)
assert.equal(mappedUser.roleId, 5)
assert.equal(mappedUser.status, "active")
assert.deepEqual(mappedUser.permissions, ["MANAGE_USERS"])

const mappedPermission = mapAdminPermission({ id: 10, name: "MANAGE_RBAC" })
const mappedRole = mapAdminRole({
  id: 5,
  name: "Admin",
  permissions: [{ id: 10, name: "MANAGE_RBAC" }],
})
assert.equal(mappedPermission.id, 10)
assert.equal(mappedRole.permissions[0].id, 10)

const actorLog = mapAdminAuditLog({
  id: 1,
  userId: 9,
  action: "UPDATE",
  targetEntity: "User",
  targetId: 12,
  detail: "Changed",
  createdAt: "2026-10-03T01:00:00Z",
})
const systemLog = mapAdminAuditLog({ id: 2, userId: null, action: "SYNC" })
assert.equal(actorLog.actorLabel, "User #9")
assert.equal(actorLog.targetLabel, "User #12")
assert.equal(systemLog.actorLabel, "System")
console.log(
  "PASS: G2.3/G2.6 DTO mappers preserve numeric IDs and actor fallback",
)

const requestedPaths = []
const fixtures = {
  "/api/users": [
    {
      id: 1,
      fullName: "A",
      email: "a@scms.com",
      status: "Active",
      roleId: 5,
      roleName: "Admin",
    },
  ],
  "/api/roles": [{ id: 5, name: "Admin", permissions: [] }],
  "/api/permissions": [{ id: 10, name: "MANAGE_RBAC" }],
  "/api/audit-logs": [{ id: 1, userId: null, action: "SYNC" }],
}

const originalFetch = globalThis.fetch
globalThis.fetch = async (path, options) => {
  requestedPaths.push({ path: String(path), method: options?.method })
  return new Response(JSON.stringify(fixtures[path]), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

try {
  const [users, roles, permissions, logs] = await Promise.all([
    getAdminUsers(),
    getAdminRoles(),
    getAdminPermissions(),
    getAdminAuditLogs(),
  ])
  assert.equal(users[0].id, 1)
  assert.equal(roles[0].id, 5)
  assert.equal(permissions[0].id, 10)
  assert.equal(logs[0].actorLabel, "System")
  assert.deepEqual(
    requestedPaths.map((entry) => entry.path).sort(),
    Object.keys(fixtures).sort(),
  )
  assert.ok(requestedPaths.every((entry) => entry.method === "GET"))
} finally {
  globalThis.fetch = originalFetch
}
console.log("PASS: G2.3 adapters call exactly four documented GET endpoints")

const initialResources = createAdminResources()
const usersLoaded = updateAdminResource(initialResources, "users", {
  data: [mappedUser],
  status: "success",
})
const auditFailed = updateAdminResource(usersLoaded, "auditLogs", {
  status: "error",
  error: "Audit unavailable",
})
assert.equal(auditFailed.users.status, "success")
assert.equal(auditFailed.users.data[0].id, 12)
assert.equal(auditFailed.auditLogs.status, "error")

const contextSource = await import("node:fs").then(({ readFileSync }) =>
  readFileSync(
    new URL("../src/components/admin/AdminDataContext.jsx", import.meta.url),
    "utf8",
  ),
)
assert.match(contextSource, /updateAdminResource/)
assert.match(contextSource, /API_ENABLED|apiEnabled/)
assert.doesNotMatch(contextSource, /catch[\s\S]{0,300}MOCK_ADMIN_DATA/)
console.log("PASS: G2.4 API errors do not fall back to mock data")

// --- REMEDIATION TEST: G2 NAVIGATION INVARIANTS ---
const { getAdminNavItems, ADMIN_NAV_ITEMS } = await import(
  "../src/components/admin/adminNav.js"
)
const adminItems = getAdminNavItems(ROLE_ADMIN)
assert.equal(adminItems.length, 4)
assert.deepEqual(
  adminItems.map((i) => i.id),
  ["admin_dashboard", "admin_users", "admin_roles", "admin_audit_logs"],
)

// Non-Admin roles must NEVER receive Admin navigation items
assert.deepEqual(getAdminNavItems(ROLE_MANAGER), [])
assert.deepEqual(getAdminNavItems("member"), [])
assert.deepEqual(getAdminNavItems(null), [])
console.log("PASS: G2 Remediation: Admin navigation invariant (all 4 tabs always visible, non-admin blocked)")

// --- REMEDIATION TEST: ROLE_ADMIN TRANSLATION & PROFILE COHESION ---
const { translations } = await import("../src/locales/translations.js")
assert.equal(translations.vi.roleAdmin, "Quản trị viên")
assert.equal(translations.en.roleAdmin, "System Administrator")

const profileSource = await import("node:fs").then(({ readFileSync }) =>
  readFileSync(
    new URL("../src/components/views/PersonalProfileView.jsx", import.meta.url),
    "utf8",
  ),
)
assert.match(profileSource, /role === ['"]admin['"]\s*\?\s*['"]roleAdmin['"]/)
assert.doesNotMatch(profileSource, /role === ['"]manager['"]\s*\?\s*['"]roleManager['"]\s*:\s*.*:\s*['"]roleMember['"](?!\s*\))/)
console.log("PASS: G2 Remediation: roleAdmin VI/EN translations and profile mapping")

// --- REMEDIATION TEST: TOUCH TARGET CONTRACT (>= 44px) ---
const headerSource = await import("node:fs").then(({ readFileSync }) =>
  readFileSync(
    new URL("../src/components/admin/AdminHeader.jsx", import.meta.url),
    "utf8",
  ),
)
const sidebarSource = await import("node:fs").then(({ readFileSync }) =>
  readFileSync(
    new URL("../src/components/admin/AdminSidebar.jsx", import.meta.url),
    "utf8",
  ),
)
const usersSource = await import("node:fs").then(({ readFileSync }) =>
  readFileSync(
    new URL("../src/components/admin/views/AdminUsersView.jsx", import.meta.url),
    "utf8",
  ),
)

// Check touch targets: w-11 h-11 (44px) or min-h-[44px]
assert.match(headerSource, /min-h-\[44px\]|w-11 h-11/)
assert.match(sidebarSource, /min-h-\[44px\]|w-11 h-11/)
assert.match(usersSource, /min-h-\[44px\]/)
console.log("PASS: G2 Remediation: Touch targets meet >= 44px mobile accessibility invariant")

console.log("==============================================")
console.log("ALL G2 LOGIC & REMEDIATION TESTS PASSED")
console.log("==============================================")
