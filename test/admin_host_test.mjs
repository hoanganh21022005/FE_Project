import assert from "node:assert/strict"
import {
  ADMIN_ORIGIN,
  getMainHostAdminRedirectUrl,
  isAdminHost,
} from "../src/components/admin/adminHost.js"

// 1. Kiểm tra isAdminHost với các tên host theo tiêu chí 3
assert.equal(isAdminHost("admin.vibesports.pages.dev"), true)
assert.equal(isAdminHost("ADMIN.VIBESPORTS.PAGES.DEV"), true)
assert.equal(isAdminHost("vibesports.pages.dev"), false)
assert.equal(isAdminHost("localhost"), false)
assert.equal(isAdminHost("127.0.0.1"), false)
assert.equal(isAdminHost("admin-fake.pages.dev"), false)
assert.equal(isAdminHost("notadmin.vibesports.pages.dev"), false)
assert.equal(isAdminHost(""), false)

// 2. Chấp nhận biến build VITE_APP_SURFACE=admin
assert.equal(isAdminHost("localhost", "admin"), true)
assert.equal(isAdminHost("vibesports.pages.dev", "ADMIN"), true)
assert.equal(isAdminHost("localhost", "public"), false)

// 3. Kiểm tra chuyển hướng từ host chính về ADMIN_ORIGIN
assert.equal(
  getMainHostAdminRedirectUrl("/admin", "", "vibesports.pages.dev"),
  `${ADMIN_ORIGIN}/admin`,
)
assert.equal(
  getMainHostAdminRedirectUrl("/admin/users", "?tab=active", "vibesports.pages.dev"),
  `${ADMIN_ORIGIN}/admin/users?tab=active`,
)
assert.equal(
  getMainHostAdminRedirectUrl("/login", "", "vibesports.pages.dev"),
  null,
)
assert.equal(
  getMainHostAdminRedirectUrl("/admin/login", "", "localhost"),
  null,
)
assert.equal(
  getMainHostAdminRedirectUrl("/admin/login", "", "127.0.0.1"),
  null,
)
assert.equal(
  getMainHostAdminRedirectUrl("/admin/login", "", "admin.vibesports.pages.dev"),
  null,
)

console.log("admin_host_test.mjs: all assertions passed")
