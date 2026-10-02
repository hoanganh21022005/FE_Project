import assert from "node:assert"
import {
  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_COACH,
  ROLE_RECEPTIONIST,
  ROLE_MEMBER,
  normalizeRole,
  resolveMockLoginUser,
  getDefaultDashboard,
  getDefaultTab,
  getLoginDestination,
  resolveRoute,
  resolveAuthenticatedRoute,
  getRouteForTab,
  isPathAllowedForRole,
  isTabAllowedForRole,
} from "../src/utils/navigation.js"

console.log("--- TEST G1.1: ROLE NORMALIZATION ---")

// 1. Valid API roles normalized to lower-case canonical form
assert.strictEqual(normalizeRole("Admin", { isApiMode: true }), ROLE_ADMIN)
assert.strictEqual(normalizeRole("ADMIN", { isApiMode: true }), ROLE_ADMIN)
assert.strictEqual(normalizeRole("ROLE_ADMIN", { isApiMode: true }), ROLE_ADMIN)

assert.strictEqual(
  normalizeRole("CenterManager", { isApiMode: true }),
  ROLE_MANAGER,
)
assert.strictEqual(normalizeRole("manager", { isApiMode: true }), ROLE_MANAGER)
assert.strictEqual(
  normalizeRole("ROLE_CENTERMANAGER", { isApiMode: true }),
  ROLE_MANAGER,
)

assert.strictEqual(normalizeRole("Coach", { isApiMode: true }), ROLE_COACH)
assert.strictEqual(normalizeRole("ROLE_COACH", { isApiMode: true }), ROLE_COACH)

assert.strictEqual(
  normalizeRole("Receptionist", { isApiMode: true }),
  ROLE_RECEPTIONIST,
)
assert.strictEqual(
  normalizeRole("ROLE_RECEPTIONIST", { isApiMode: true }),
  ROLE_RECEPTIONIST,
)

assert.strictEqual(normalizeRole("Member", { isApiMode: true }), ROLE_MEMBER)
assert.strictEqual(
  normalizeRole("ROLE_MEMBER", { isApiMode: true }),
  ROLE_MEMBER,
)

// 2. Unknown role in API mode MUST return null (no fallback to manager)
assert.strictEqual(normalizeRole("SuperUser", { isApiMode: true }), null)
assert.strictEqual(normalizeRole("Accountant", { isApiMode: true }), null)
assert.strictEqual(normalizeRole("", { isApiMode: true }), null)
assert.strictEqual(normalizeRole(null, { isApiMode: true }), null)

// 3. Mock mode fallback
assert.strictEqual(
  normalizeRole("UnknownRole", { isApiMode: false }),
  ROLE_MANAGER,
)
console.log("PASS: G1.1 Role normalization tests")

const mockMembers = [
  { id: "mem-1", name: "Member Demo", email: "member@scms.com" },
]
const mockLoginOptions = {
  managerEmail: "manager@scms.com",
  demoPassword: "12345678",
}

assert.strictEqual(
  resolveMockLoginUser({
    ...mockLoginOptions,
    email: "manager@scms.com",
    password: "12345678",
    members: mockMembers,
  }).role,
  ROLE_MANAGER,
)
assert.deepStrictEqual(
  resolveMockLoginUser({
    ...mockLoginOptions,
    email: "member@scms.com",
    password: "12345678",
    members: mockMembers,
  }),
  {
    role: ROLE_MEMBER,
    email: "member@scms.com",
    fullName: "Member Demo",
  },
)
assert.strictEqual(
  resolveMockLoginUser({
    ...mockLoginOptions,
    email: "unknown@scms.com",
    password: "wrong-password",
    members: mockMembers,
  }),
  null,
)
console.log("PASS: Mock Member role takes priority over Manager fallback")

// Exact staff demo account assertions
assert.strictEqual(
  resolveMockLoginUser({
    ...mockLoginOptions,
    email: "admin@scms.com",
    password: "12345678",
  })?.role,
  ROLE_ADMIN,
)
assert.strictEqual(
  resolveMockLoginUser({
    ...mockLoginOptions,
    email: "thu.reception@scms.com",
    password: "12345678",
  })?.role,
  ROLE_RECEPTIONIST,
)
assert.strictEqual(
  resolveMockLoginUser({
    ...mockLoginOptions,
    email: "hung.coach@scms.com",
    password: "12345678",
  })?.role,
  ROLE_COACH,
)

// Negative assertions: Arbitrary emails containing role keywords MUST NOT be granted privileged roles
const negativeKeywordEmails = [
  "not-admin@example.test",
  "admin-fake@domain.com",
  "attacker-reception@evil.com",
  "mycoach@random.org",
  "random-manager@scms.com",
  "super-admin@external.net",
  "fake_coach@scms.com",
]
for (const fakeEmail of negativeKeywordEmails) {
  const result = resolveMockLoginUser({
    ...mockLoginOptions,
    email: fakeEmail,
    password: "12345678",
    members: mockMembers,
  })
  assert.strictEqual(
    result,
    null,
    `Arbitrary email '${fakeEmail}' containing keyword must NOT be granted any role`,
  )
}
console.log("PASS: Exact mock role mapping and keyword substring negative assertions verified")

console.log("\n--- TEST G1.2: DEFAULT ROUTES & REDIRECTION ---")
assert.strictEqual(getDefaultDashboard(ROLE_ADMIN), "/admin/dashboard")
assert.strictEqual(getDefaultDashboard(ROLE_MANAGER), "/manager/dashboard")
assert.strictEqual(getDefaultDashboard(ROLE_COACH), "/coach/dashboard")
assert.strictEqual(
  getDefaultDashboard(ROLE_RECEPTIONIST),
  "/receptionist/dashboard",
)
assert.strictEqual(getDefaultDashboard(ROLE_MEMBER), "/member/dashboard")
assert.strictEqual(getDefaultTab(ROLE_MANAGER), "dashboard")
assert.strictEqual(getRouteForTab("classes", ROLE_MANAGER), "/manager/classes")
assert.strictEqual(getRouteForTab("members", ROLE_MANAGER), "/manager/members")

// Direct login redirect without intended location
assert.strictEqual(
  getLoginDestination({ role: "Admin" }, null, { isApiMode: true }).path,
  "/admin/dashboard",
)
assert.strictEqual(
  getLoginDestination({ role: "CenterManager" }, null, { isApiMode: true })
    .path,
  "/manager/dashboard",
)
assert.strictEqual(
  getLoginDestination({ role: "Coach" }, null, { isApiMode: true }).path,
  "/coach/dashboard",
)
assert.strictEqual(
  getLoginDestination({ role: "Receptionist" }, null, { isApiMode: true }).path,
  "/receptionist/dashboard",
)
assert.strictEqual(
  getLoginDestination({ role: "Member" }, null, { isApiMode: true }).path,
  "/member/dashboard",
)

// Redirect with valid intended location
assert.strictEqual(
  getLoginDestination({ role: "CenterManager" }, "/manager/classes", {
    isApiMode: true,
  }).path,
  "/manager/classes",
)
assert.strictEqual(
  getLoginDestination({ role: "Coach" }, "/coach/schedule", { isApiMode: true })
    .path,
  "/coach/schedule",
)

// Redirect with mismatching intended location (e.g. Manager trying to access Coach schedule)
assert.strictEqual(
  getLoginDestination({ role: "CenterManager" }, "/coach/schedule", {
    isApiMode: true,
  }).path,
  "/manager/dashboard", // Should ignore invalid intended location and fallback to role dashboard
)
assert.strictEqual(
  getLoginDestination({ role: "Member" }, "/not-a-real-route", {
    isApiMode: true,
  }).path,
  "/member/dashboard",
)
assert.strictEqual(
  getLoginDestination({ role: "Unsupported" }, null, { isApiMode: true }),
  null,
)

console.log("PASS: G1.2 Login redirect logic tests")

console.log("\n--- TEST G1.3: DEEP LINK RESOLUTION & SESSION RESTORE ---")

// Route resolution
const r1 = resolveRoute("/manager/classes")
assert.strictEqual(r1.role, ROLE_MANAGER)
assert.strictEqual(r1.tab, "classes")
assert.strictEqual(r1.isPublic, false)

const r2 = resolveRoute("/coach/schedule")
assert.strictEqual(r2.role, ROLE_COACH)
assert.strictEqual(r2.tab, "coach_schedule")

const r3 = resolveRoute("/receptionist/booking")
assert.strictEqual(r3.role, ROLE_RECEPTIONIST)
assert.strictEqual(r3.tab, "reception_booking")

const r4 = resolveRoute("/member/my-membership")
assert.strictEqual(r4.role, ROLE_MEMBER)
assert.strictEqual(r4.tab, "member_my_membership")

const r5 = resolveRoute("/admin/dashboard")
assert.strictEqual(r5.role, ROLE_ADMIN)
assert.strictEqual(r5.tab, "admin_dashboard")

// Public route resolution
const p1 = resolveRoute("/")
assert.strictEqual(p1.isPublic, true)
assert.strictEqual(p1.publicView, "home")

const p2 = resolveRoute("/login")
assert.strictEqual(p2.isPublic, true)
assert.strictEqual(p2.publicView, "login")

// Tab validity checks
assert.strictEqual(isTabAllowedForRole("classes", ROLE_MANAGER), true)
assert.strictEqual(isTabAllowedForRole("classes", ROLE_COACH), false)
assert.strictEqual(isTabAllowedForRole("coach_schedule", ROLE_COACH), true)
assert.strictEqual(isTabAllowedForRole("coach_schedule", ROLE_MANAGER), false)
assert.strictEqual(isTabAllowedForRole("settings", ROLE_COACH), true) // Shared tab

// Path validity checks
assert.strictEqual(isPathAllowedForRole("/manager/members", ROLE_MANAGER), true)
assert.strictEqual(isPathAllowedForRole("/manager/members", ROLE_MEMBER), false)
assert.strictEqual(isPathAllowedForRole("/settings", ROLE_MEMBER), true)
assert.strictEqual(
  isPathAllowedForRole("/not-a-real-route", ROLE_MANAGER),
  false,
)

// Session restore keeps a valid deep link and resolves every other path to
// the authenticated role's own dashboard.
assert.strictEqual(
  resolveAuthenticatedRoute("/manager/classes", ROLE_MANAGER).path,
  "/manager/classes",
)
assert.strictEqual(
  resolveAuthenticatedRoute("/coach/schedule", ROLE_MANAGER).path,
  "/manager/dashboard",
)
assert.strictEqual(
  resolveAuthenticatedRoute("/login", ROLE_MEMBER).path,
  "/member/dashboard",
)
assert.strictEqual(
  resolveAuthenticatedRoute("/missing", ROLE_RECEPTIONIST).path,
  "/receptionist/dashboard",
)
assert.strictEqual(
  resolveAuthenticatedRoute("/member/dashboard", "unsupported"),
  null,
)

console.log("PASS: G1.3 Deep link & route resolution tests")
console.log("\n==============================================")
console.log("ALL G1.1 - G1.3 UNIT & LOGIC TESTS COMPLETED SUCCESSFULLY!")
console.log("==============================================")
