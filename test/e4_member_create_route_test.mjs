import assert from "node:assert/strict"
import { selectMemberCreateRoute } from "../src/utils/memberCreationRoute.js"
import * as memberApi from "../src/api/memberApi.js"

// 1. Ma trận quyền -> tuyến
assert.equal(selectMemberCreateRoute(["MANAGE_USERS"]), "create")
assert.equal(selectMemberCreateRoute(["REGISTER_MEMBER"]), "register")
assert.equal(selectMemberCreateRoute(["REGISTER_MEMBER", "MANAGE_USERS"]), "create")
assert.equal(selectMemberCreateRoute([]), "create")
assert.equal(selectMemberCreateRoute(null), "create")
assert.equal(selectMemberCreateRoute(undefined), "create")

// 2. Mock fetch kiểm đúng URL được gọi với từng bộ quyền
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
const originalLocalStorage = globalThis.localStorage
const originalSessionStorage = globalThis.sessionStorage
const calledUrls = []

globalThis.window = {
  dispatchEvent() {},
  location: { pathname: "/", search: "" },
}
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}
globalThis.sessionStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

globalThis.fetch = async (url, options = {}) => {
  calledUrls.push({ url: String(url), method: options.method || "GET" })
  return {
    ok: true,
    status: 201,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({
      id: 99,
      fullName: "Nguyễn Văn Mới",
      email: "moi@example.com",
      phone: "0901234567",
      status: "Active",
    }),
    text: async () => "",
  }
}

try {
  const samplePayload = {
    name: "Nguyễn Văn Mới",
    email: "moi@example.com",
    phone: "0901234567",
  }

  // Trường hợp Receptionist: chỉ có REGISTER_MEMBER -> /api/members/register
  const recRoute = selectMemberCreateRoute(["REGISTER_MEMBER"])
  if (recRoute === "register") {
    await memberApi.registerMemberProfile(samplePayload)
  } else {
    await memberApi.createMember(samplePayload)
  }

  // Trường hợp Manager: có MANAGE_USERS -> /api/members
  const mgrRoute = selectMemberCreateRoute(["MANAGE_USERS"])
  if (mgrRoute === "register") {
    await memberApi.registerMemberProfile(samplePayload)
  } else {
    await memberApi.createMember(samplePayload)
  }

  assert.equal(calledUrls.length, 2)
  assert.ok(calledUrls[0].url.endsWith("/api/members/register"), `Expected /api/members/register, got ${calledUrls[0].url}`)
  assert.equal(calledUrls[0].method, "POST")
  assert.ok(calledUrls[1].url.endsWith("/api/members"), `Expected /api/members, got ${calledUrls[1].url}`)
  assert.equal(calledUrls[1].method, "POST")
} finally {
  globalThis.fetch = originalFetch
  globalThis.window = originalWindow
  globalThis.localStorage = originalLocalStorage
  globalThis.sessionStorage = originalSessionStorage
}

console.log("e4_member_create_route_test: all assertions passed")
