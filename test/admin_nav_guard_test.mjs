import assert from "node:assert/strict"
import {
  ADMIN_NAV_GROUPS,
  canAccessAdminOpsPath,
  getAdminNavGroups,
} from "../src/components/admin/adminNav.js"
import { ROLE_ADMIN } from "../src/utils/navigation.js"

const seedAdmin = {
  id: 1,
  role: ROLE_ADMIN,
  authorities: [
    "ROLE_ADMIN",
    "MANAGE_USERS",
    "MANAGE_RBAC",
    "MANAGE_PERMISSIONS",
    "VIEW_AUDIT_LOG",
    "VIEW_REPORTS",
    "LOCK_SUBJECTS",
    "MANAGE_SPECIALIZATIONS",
  ],
}

// 1. Fail-closed khi user null / undefined
assert.equal(canAccessAdminOpsPath("/admin/ops/staff", undefined), false)
assert.equal(canAccessAdminOpsPath("/admin/ops/staff", null), false)
assert.equal(canAccessAdminOpsPath("/admin/ops/audit-logs", undefined), false)
assert.equal(canAccessAdminOpsPath("/admin/ops/members/5", null), false)

// 2. Giữ nguyên hành vi cũ của getAdminNavGroups khi không truyền user
assert.equal(getAdminNavGroups(ROLE_ADMIN, undefined).length, ADMIN_NAV_GROUPS.length)

// 3. Seed Admin: các đường dẫn được phép
for (const allowedPath of [
  "/admin/ops/staff",
  "/admin/ops/members",
  "/admin/ops/members/5",
  "/admin/ops/resources",
  "/admin/ops/audit-logs",
]) {
  assert.equal(
    canAccessAdminOpsPath(allowedPath, seedAdmin),
    true,
    `Seed Admin phải truy cập được ${allowedPath}`,
  )
}

// 4. Seed Admin: các đường dẫn bị chặn
for (const blockedPath of [
  "/admin/ops/packages",
  "/admin/ops/classes",
  "/admin/ops/holidays",
  "/admin/ops/session-incidents",
  "/admin/ops/payments",
  "/admin/ops/reception/dashboard",
  "/admin/ops/reception/checkin",
  "/admin/ops/reports",
  "/admin/ops/dashboard",
  "/admin/ops/unknown-route",
]) {
  assert.equal(
    canAccessAdminOpsPath(blockedPath, seedAdmin),
    false,
    `Seed Admin không được truy cập ${blockedPath}`,
  )
}

// 5. Khi cấp thêm MANAGE_PACKAGES thì mở được /admin/ops/packages
const adminWithPackages = {
  ...seedAdmin,
  authorities: [...seedAdmin.authorities, "MANAGE_PACKAGES"],
}
assert.equal(canAccessAdminOpsPath("/admin/ops/packages", adminWithPackages), true)

console.log("admin_nav_guard_test: all assertions passed")
