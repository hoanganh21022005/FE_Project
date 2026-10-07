import assert from "node:assert"
import React from "react"
import ReactDOMServer from "react-dom/server"
import {
  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_COACH,
  ROLE_RECEPTIONIST,
  ROLE_MEMBER,
  SUPPORTED_ROLES,
  normalizeRole,
  getDefaultDashboard,
  getDefaultTab,
  resolveRoute,
  checkRouteAccess,
  isPathAllowedForRole,
  isTabAllowedForRole,
} from "../src/utils/navigation.js"
import {
  createApiError,
  UnauthorizedError,
  ForbiddenError,
  ApiError,
  ValidationError,
  NotFoundError,
} from "../src/api/apiErrors.js"
import {
  httpRequest,
  UNAUTHORIZED_EVENT,
  FORBIDDEN_EVENT,
} from "../src/api/httpClient.js"
import {
  RequireAuth,
  RequireRole,
  RequirePermission,
} from "../src/components/auth/RouteGuard.js"
import { ForbiddenView } from "../src/components/views/ForbiddenView.js"

console.log("==============================================")
console.log("RUNNING G1.4 - G1.6 GUARD & SESSION TEST SUITE")
console.log("==============================================")

// -------------------------------------------------------------
// TEST SUITE 1: G1.4 ROUTE ACCESS & ROLE GUARD CHECKS
// -------------------------------------------------------------
console.log("\n--- TEST 1: ROUTE ACCESS & ROLE GUARD (G1.4) ---")

// 1.1 Public routes should always return 'public'
for (const publicPath of ["/", "/login", "/register", "/admin/login"]) {
  const access = checkRouteAccess(publicPath, ROLE_MANAGER)
  assert.strictEqual(
    access.status,
    "public",
    `Public route ${publicPath} must have status public`,
  )
}
console.log("PASS: 1.1 Public routes resolved correctly")

// 1.2 Unknown routes should return 'not_found' with fallbackPath to role's dashboard
for (const role of SUPPORTED_ROLES) {
  const access = checkRouteAccess("/nonexistent-page-xyz", role)
  assert.strictEqual(
    access.status,
    "not_found",
    `Unknown route must return not_found for ${role}`,
  )
  assert.strictEqual(
    access.fallbackPath,
    getDefaultDashboard(role),
    `Fallback path for ${role} must be its default dashboard`,
  )
}
console.log("PASS: 1.2 Unknown routes fallback to role's dashboard")

// 1.3 Shared routes allowed for all authenticated roles
for (const sharedPath of ["/settings", "/support", "/profile", "/403"]) {
  for (const role of SUPPORTED_ROLES) {
    const access = checkRouteAccess(sharedPath, role)
    assert.strictEqual(
      access.status,
      "allowed",
      `Shared route ${sharedPath} must be allowed for ${role}`,
    )
  }
}
console.log("PASS: 1.3 Shared routes allowed for all roles")

// 1.4 Valid role routes allowed for their respective roles
const VALID_ROLE_ROUTES = {
  [ROLE_MANAGER]: [
    "/manager/dashboard",
    "/manager/classes",
    "/manager/staff",
    "/manager/members",
    "/manager/packages",
    "/manager/resources",
    "/manager/payments",
    "/manager/reports",
    "/manager/audit-logs",
  ],
  [ROLE_COACH]: [
    "/coach/dashboard",
    "/coach/schedule",
    "/coach/attendance",
    "/coach/assigned-members",
    "/coach/progress",
  ],
  [ROLE_RECEPTIONIST]: [
    "/receptionist/dashboard",
    "/receptionist/member-search",
    "/receptionist/booking",
    "/receptionist/payments",
  ],
  [ROLE_MEMBER]: [
    "/member/dashboard",
    "/member/my-membership",
    "/member/class-catalog",
    "/member/attendance-history",
    "/member/training-plan",
  ],
  [ROLE_ADMIN]: [
    "/admin/dashboard",
    "/admin/users",
    "/admin/roles",
    "/admin/audit-logs",
  ],
}

for (const [role, routes] of Object.entries(VALID_ROLE_ROUTES)) {
  for (const route of routes) {
    const access = checkRouteAccess(route, role)
    assert.strictEqual(
      access.status,
      "allowed",
      `Route ${route} should be allowed for role ${role}`,
    )
    assert.strictEqual(isPathAllowedForRole(route, role), true)
  }
}
console.log("PASS: 1.4 Valid role routes allowed for their owners")

// 1.5 Mismatched role routes MUST be flagged as 'forbidden' (URL sai role)
const FORBIDDEN_TEST_CASES = [
  // Member accessing manager/coach/receptionist/admin routes
  {
    role: ROLE_MEMBER,
    attemptPath: "/manager/classes",
    expectedRequiredRole: ROLE_MANAGER,
  },
  {
    role: ROLE_MEMBER,
    attemptPath: "/manager/staff",
    expectedRequiredRole: ROLE_MANAGER,
  },
  {
    role: ROLE_MEMBER,
    attemptPath: "/coach/schedule",
    expectedRequiredRole: ROLE_COACH,
  },
  {
    role: ROLE_MEMBER,
    attemptPath: "/receptionist/booking",
    expectedRequiredRole: ROLE_RECEPTIONIST,
  },
  {
    role: ROLE_MEMBER,
    attemptPath: "/admin/dashboard",
    expectedRequiredRole: ROLE_ADMIN,
  },

  // Manager accessing admin/coach/receptionist/member routes
  {
    role: ROLE_MANAGER,
    attemptPath: "/admin/dashboard",
    expectedRequiredRole: ROLE_ADMIN,
  },
  {
    role: ROLE_MANAGER,
    attemptPath: "/coach/schedule",
    expectedRequiredRole: ROLE_COACH,
  },
  {
    role: ROLE_MANAGER,
    attemptPath: "/member/my-membership",
    expectedRequiredRole: ROLE_MEMBER,
  },

  // Coach accessing manager/receptionist/member/admin routes
  {
    role: ROLE_COACH,
    attemptPath: "/manager/members",
    expectedRequiredRole: ROLE_MANAGER,
  },
  {
    role: ROLE_COACH,
    attemptPath: "/receptionist/payments",
    expectedRequiredRole: ROLE_RECEPTIONIST,
  },
  {
    role: ROLE_COACH,
    attemptPath: "/admin/dashboard",
    expectedRequiredRole: ROLE_ADMIN,
  },

  // Receptionist accessing coach/admin/manager-exclusive routes
  {
    role: ROLE_RECEPTIONIST,
    attemptPath: "/coach/attendance",
    expectedRequiredRole: ROLE_COACH,
  },
  {
    role: ROLE_RECEPTIONIST,
    attemptPath: "/admin/dashboard",
    expectedRequiredRole: ROLE_ADMIN,
  },
]

for (const { role, attemptPath, expectedRequiredRole } of FORBIDDEN_TEST_CASES) {
  const access = checkRouteAccess(attemptPath, role)
  assert.strictEqual(
    access.status,
    "forbidden",
    `Access to ${attemptPath} by ${role} must be forbidden`,
  )
  assert.strictEqual(
    access.requiredRole,
    expectedRequiredRole,
    `Required role for ${attemptPath} must be ${expectedRequiredRole}`,
  )
  assert.strictEqual(
    access.fallbackPath,
    getDefaultDashboard(role),
    `Fallback path for ${role} must be its own dashboard`,
  )
  assert.strictEqual(
    isPathAllowedForRole(attemptPath, role),
    false,
    `isPathAllowedForRole(${attemptPath}, ${role}) must be false`,
  )
}
console.log(
  "PASS: 1.5 Mismatched role routes correctly flagged as forbidden (URL sai role)",
)

// 1.6 Tab authorization check
assert.strictEqual(isTabAllowedForRole("forbidden", ROLE_MANAGER), true)
assert.strictEqual(isTabAllowedForRole("forbidden", ROLE_MEMBER), true)
assert.strictEqual(isTabAllowedForRole("staff", ROLE_MANAGER), true)
assert.strictEqual(isTabAllowedForRole("staff", ROLE_MEMBER), false)
assert.strictEqual(isTabAllowedForRole("coach_schedule", ROLE_COACH), true)
assert.strictEqual(isTabAllowedForRole("coach_schedule", ROLE_MANAGER), false)
console.log("PASS: 1.6 Tab-level authorization checks pass")

// -------------------------------------------------------------
// TEST SUITE 2: G1.5 HTTP ERROR STATUS DIFFERENTIATION WITH REAL httpRequest()
// -------------------------------------------------------------
console.log("\n--- TEST 2: HTTP 401 VS 403 VS 500 VS NETWORK ERROR (REAL httpRequest) ---")

// 2.1 Event constants
assert.strictEqual(UNAUTHORIZED_EVENT, "scms:unauthorized")
assert.strictEqual(FORBIDDEN_EVENT, "scms:forbidden")

// 2.2 Error object types
const err401 = createApiError(
  401,
  { message: "Session expired" },
  "Unauthorized",
)
assert.ok(
  err401 instanceof UnauthorizedError,
  "401 error must be UnauthorizedError",
)
assert.strictEqual(err401.code, "UNAUTHORIZED")
assert.strictEqual(err401.status, 401)

const err403 = createApiError(
  403,
  { message: "Access denied" },
  "Forbidden",
)
assert.ok(
  err403 instanceof ForbiddenError,
  "403 error must be ForbiddenError",
)
assert.ok(
  !(err403 instanceof UnauthorizedError),
  "403 error must NOT be UnauthorizedError",
)
assert.strictEqual(err403.code, "FORBIDDEN")
assert.strictEqual(err403.status, 403)

const err500 = createApiError(500, { message: "Internal error" }, "Server error")
assert.ok(
  err500 instanceof ApiError,
  "500 error must be ApiError",
)
assert.ok(
  !(err500 instanceof UnauthorizedError),
  "500 error must NOT be UnauthorizedError",
)
assert.ok(
  !(err500 instanceof ForbiddenError),
  "500 error must NOT be ForbiddenError",
)
assert.strictEqual(err500.status, 500)

const errNetwork = createApiError(0, null, "Không thể kết nối đến máy chủ.")
assert.ok(
  errNetwork instanceof ApiError,
  "Network error must be ApiError",
)
assert.ok(
  !(errNetwork instanceof UnauthorizedError),
  "Network error must NOT be UnauthorizedError",
)
assert.strictEqual(errNetwork.status, 0)
assert.strictEqual(errNetwork.message, "Không thể kết nối đến máy chủ.")

console.log("PASS: 2.2 Error classes correctly mapped by HTTP status")

// 2.3 Real httpRequest() execution with controlled global fetch and window
console.log("Testing actual httpRequest() calls with controlled fetch/window...")

const originalFetch = globalThis.fetch
const originalWindow = globalThis.window

try {
  let dispatchedEvents = []
  globalThis.window = {
    dispatchEvent(event) {
      dispatchedEvents.push({
        type: event.type,
        detail: event.detail,
      })
    },
  }

  // A. Call httpRequest with HTTP 401
  dispatchedEvents = []
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Session expired" }), {
      status: 401,
      statusText: "Unauthorized",
      headers: { "Content-Type": "application/json" },
    })

  let threw401 = false
  try {
    await httpRequest("/api/test-401")
  } catch (error) {
    threw401 = true
    assert.ok(
      error instanceof UnauthorizedError,
      "httpRequest with 401 must throw UnauthorizedError",
    )
    assert.strictEqual(error.status, 401)
  }
  assert.ok(threw401, "httpRequest with 401 must throw an error")
  assert.strictEqual(dispatchedEvents.length, 1, "401 must dispatch exactly 1 event")
  assert.strictEqual(
    dispatchedEvents[0].type,
    UNAUTHORIZED_EVENT,
    "401 must dispatch UNAUTHORIZED_EVENT",
  )

  // B. Call httpRequest with HTTP 403
  dispatchedEvents = []
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Forbidden action" }), {
      status: 403,
      statusText: "Forbidden",
      headers: { "Content-Type": "application/json" },
    })

  let threw403 = false
  try {
    await httpRequest("/api/test-403")
  } catch (error) {
    threw403 = true
    assert.ok(
      error instanceof ForbiddenError,
      "httpRequest with 403 must throw ForbiddenError",
    )
    assert.ok(
      !(error instanceof UnauthorizedError),
      "httpRequest with 403 must NOT throw UnauthorizedError",
    )
    assert.strictEqual(error.status, 403)
  }
  assert.ok(threw403, "httpRequest with 403 must throw an error")
  assert.strictEqual(dispatchedEvents.length, 1, "403 must dispatch exactly 1 event")
  assert.strictEqual(
    dispatchedEvents[0].type,
    FORBIDDEN_EVENT,
    "403 must dispatch FORBIDDEN_EVENT",
  )
  assert.ok(
    !dispatchedEvents.some((e) => e.type === UNAUTHORIZED_EVENT),
    "403 MUST NOT dispatch UNAUTHORIZED_EVENT (which would wipe user session)",
  )

  // C. Call httpRequest with HTTP 500
  dispatchedEvents = []
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Internal server error" }), {
      status: 500,
      statusText: "Internal Server Error",
      headers: { "Content-Type": "application/json" },
    })

  let threw500 = false
  try {
    await httpRequest("/api/test-500")
  } catch (error) {
    threw500 = true
    assert.ok(
      error instanceof ApiError,
      "httpRequest with 500 must throw ApiError",
    )
    assert.ok(
      !(error instanceof UnauthorizedError),
      "500 must NOT throw UnauthorizedError",
    )
    assert.ok(
      !(error instanceof ForbiddenError),
      "500 must NOT throw ForbiddenError",
    )
    assert.strictEqual(error.status, 500)
  }
  assert.ok(threw500, "httpRequest with 500 must throw an error")
  assert.strictEqual(
    dispatchedEvents.length,
    0,
    "500 must not dispatch unauthorized or forbidden events",
  )

  // D. Call httpRequest with Network Error (fetch rejects)
  dispatchedEvents = []
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch")
  }

  let threwNetwork = false
  try {
    await httpRequest("/api/test-network")
  } catch (error) {
    threwNetwork = true
    assert.ok(
      error instanceof ApiError,
      "httpRequest on network failure must throw ApiError",
    )
    assert.strictEqual(error.status, 0)
    assert.strictEqual(error.message, "Failed to fetch")
  }
  assert.ok(threwNetwork, "httpRequest on network failure must throw an error")
  assert.strictEqual(
    dispatchedEvents.length,
    0,
    "Network failure must not dispatch unauthorized event",
  )

  console.log(
    "PASS: 2.3 Real httpRequest() call verified: 401 dispatches UNAUTHORIZED_EVENT; 403 dispatches FORBIDDEN_EVENT without logout; 500 & network error do not dispatch unauthorized event",
  )
} finally {
  globalThis.fetch = originalFetch
  globalThis.window = originalWindow
}

// -------------------------------------------------------------
// TEST SUITE 3: G1.6 NAVIGATION & STATE MATRIX
// -------------------------------------------------------------
console.log("\n--- TEST 3: COMPREHENSIVE ROLE × ROUTE NAVIGATION MATRIX (G1.6) ---")

const TEST_ROLES = [ROLE_ADMIN, ROLE_MANAGER, ROLE_RECEPTIONIST, ROLE_COACH, ROLE_MEMBER]

for (const role of TEST_ROLES) {
  // A. Default dashboard is role-specific
  const defaultDashboard = getDefaultDashboard(role)
  assert.ok(
    defaultDashboard.startsWith(`/${role}/`),
    `Default dashboard for ${role} must start with /${role}/`,
  )

  // B. Default tab is role-specific
  const defaultTab = getDefaultTab(role)
  assert.ok(defaultTab, `Default tab for ${role} must exist`)

  // C. Access to own default dashboard is allowed
  const ownAccess = checkRouteAccess(defaultDashboard, role)
  assert.strictEqual(
    ownAccess.status,
    "allowed",
    `${role} must have allowed access to own default dashboard`,
  )

  // D. Access to other roles' dashboards is forbidden
  for (const otherRole of TEST_ROLES) {
    if (otherRole === role) continue
    const otherDashboard = getDefaultDashboard(otherRole)
    const otherAccess = checkRouteAccess(otherDashboard, role)
    assert.strictEqual(
      otherAccess.status,
      "forbidden",
      `${role} must be forbidden from accessing ${otherDashboard} (${otherRole})`,
    )
    assert.strictEqual(
      otherAccess.requiredRole,
      otherRole,
      `Forbidden route ${otherDashboard} must indicate required role ${otherRole}`,
    )
    assert.strictEqual(
      otherAccess.fallbackPath,
      defaultDashboard,
      `Forbidden route must provide fallbackPath to user's dashboard`,
    )
  }
}
console.log("PASS: 3.1 Role × Route cross-access matrix verified for all 5 roles")

// -------------------------------------------------------------
// TEST SUITE 4: COMPONENT REGRESSION TESTS FOR RequireAuth & RequireRole
// -------------------------------------------------------------
console.log("\n--- TEST 4: COMPONENT REGRESSION TESTS (RequireAuth & RequireRole) ---")

// 4.1 RequireAuth component rendering checks
// Case A: authLoading = true -> renders spinner screen, does NOT render protected content
const loadingHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    RequireAuth,
    { isAuthenticated: false, authLoading: true, fallback: React.createElement("div", null, "FALLBACK_LOGIN") },
    React.createElement("div", null, "PROTECTED_SHELL_CONTENT"),
  ),
)
assert.ok(
  loadingHtml.includes("Đang kiểm tra phiên đăng nhập..."),
  "RequireAuth in loading state must display loading indicator",
)
assert.ok(
  !loadingHtml.includes("PROTECTED_SHELL_CONTENT"),
  "RequireAuth in loading state MUST NOT render protected content",
)
assert.ok(
  !loadingHtml.includes("FALLBACK_LOGIN"),
  "RequireAuth in loading state must not render fallback yet",
)

// Case B: isAuthenticated = false, authLoading = false -> renders fallback (Login), does NOT render protected content
const unauthHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    RequireAuth,
    { isAuthenticated: false, authLoading: false, fallback: React.createElement("div", null, "FALLBACK_LOGIN") },
    React.createElement("div", null, "PROTECTED_SHELL_CONTENT"),
  ),
)
assert.ok(
  unauthHtml.includes("FALLBACK_LOGIN"),
  "RequireAuth when unauthenticated must render fallback login",
)
assert.ok(
  !unauthHtml.includes("PROTECTED_SHELL_CONTENT"),
  "RequireAuth when unauthenticated MUST NOT render protected content",
)

// Case C: isAuthenticated = true, authLoading = false -> renders protected content
const authHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    RequireAuth,
    { isAuthenticated: true, authLoading: false, fallback: React.createElement("div", null, "FALLBACK_LOGIN") },
    React.createElement("div", null, "PROTECTED_SHELL_CONTENT"),
  ),
)
assert.ok(
  authHtml.includes("PROTECTED_SHELL_CONTENT"),
  "RequireAuth when authenticated must render protected content",
)
assert.ok(
  !authHtml.includes("FALLBACK_LOGIN"),
  "RequireAuth when authenticated must not render fallback",
)
console.log("PASS: 4.1 RequireAuth rendering states (loading / unauth / auth) verified")

// 4.2 RequireRole component rendering & view-blocking checks
// Case A: Role matched -> renders protected role view
const roleAllowedHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    RequireRole,
    {
      allowedRoles: [ROLE_MANAGER],
      currentRole: ROLE_MANAGER,
      attemptedPath: "/manager/classes",
    },
    React.createElement("div", null, "CLASS_MANAGEMENT_SECRET_VIEW"),
  ),
)
assert.ok(
  roleAllowedHtml.includes("CLASS_MANAGEMENT_SECRET_VIEW"),
  "RequireRole with matching role must render child view",
)
assert.ok(
  !roleAllowedHtml.includes("HTTP 403"),
  "RequireRole with matching role must not render 403 view",
)

// Case B: Role mismatched (e.g. Member attempting to view Manager's ClassManagement)
// MUST NOT render ClassManagement! MUST render ForbiddenView!
const roleForbiddenHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    RequireRole,
    {
      allowedRoles: [ROLE_MANAGER],
      currentRole: ROLE_MEMBER,
      attemptedPath: "/manager/classes",
    },
    React.createElement("div", null, "CLASS_MANAGEMENT_SECRET_VIEW"),
  ),
)
assert.ok(
  !roleForbiddenHtml.includes("CLASS_MANAGEMENT_SECRET_VIEW"),
  "CRITICAL: RequireRole with mismatched role MUST NEVER render the protected child view",
)
assert.ok(
  roleForbiddenHtml.includes("HTTP 403"),
  "RequireRole with mismatched role must display HTTP 403 badge",
)
assert.ok(
  roleForbiddenHtml.includes("Truy cập bị từ chối"),
  "RequireRole with mismatched role must display Forbidden explanation",
)
assert.ok(
  roleForbiddenHtml.includes("/manager/classes"),
  "RequireRole with mismatched role must show attemptedPath in details",
)
assert.ok(
  roleForbiddenHtml.includes("manager"),
  "RequireRole with mismatched role must show requiredRole in details",
)
assert.ok(
  roleForbiddenHtml.includes("member"),
  "RequireRole with mismatched role must show currentRole in details",
)

// Case C: Role mismatched with custom fallback
const customFallbackHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    RequireRole,
    {
      allowedRoles: [ROLE_ADMIN],
      currentRole: ROLE_MANAGER,
      fallback: React.createElement("div", null, "CUSTOM_ROLE_DENIED_FALLBACK"),
    },
    React.createElement("div", null, "ADMIN_PORTAL_CONTENT"),
  ),
)
assert.ok(
  customFallbackHtml.includes("CUSTOM_ROLE_DENIED_FALLBACK"),
  "RequireRole with custom fallback must render custom fallback",
)
assert.ok(
  !customFallbackHtml.includes("ADMIN_PORTAL_CONTENT"),
  "RequireRole with custom fallback MUST NOT render protected admin content",
)
console.log(
  "PASS: 4.2 RequireRole strictly blocks view rendering for unauthorized roles and displays ForbiddenView",
)

// 4.3 RequirePermission component rendering checks
const permAllowedHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    RequirePermission,
    {
      permission: "CREATE_USER",
      authorities: ["CREATE_USER", "VIEW_USER"],
    },
    React.createElement("button", null, "ACTION_BUTTON"),
  ),
)
assert.ok(
  permAllowedHtml.includes("ACTION_BUTTON"),
  "RequirePermission with granted authority must render child action",
)

const permForbiddenHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(
    RequirePermission,
    {
      permission: "DELETE_USER",
      authorities: ["VIEW_USER"],
    },
    React.createElement("button", null, "ACTION_BUTTON"),
  ),
)
assert.ok(
  !permForbiddenHtml.includes("ACTION_BUTTON"),
  "RequirePermission without authority MUST NOT render child action",
)
assert.ok(
  permForbiddenHtml.includes("DELETE_USER"),
  "RequirePermission without authority must inform user about missing permission",
)
console.log("PASS: 4.3 RequirePermission granular authorization checks pass")

console.log("\n==============================================")
console.log("ALL G1.4 - G1.6 TESTS PASSED SUCCESSFULLY (100%)!")
console.log("==============================================")
