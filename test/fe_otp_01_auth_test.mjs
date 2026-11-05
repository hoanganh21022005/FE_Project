import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { authApi } from "../src/api/authApi.js"
import { createApiError } from "../src/api/apiErrors.js"
import { buildCurrentUser } from "../src/utils/memberSafetyHelpers.js"
import {
  buildRegistrationPayload,
  classifyRegisterResponse,
  getOtpDigitsAfterResend,
  getRegistrationOtpErrorMessage,
  getRegistrationPhoneError,
  tryAcquireRequestLock,
  releaseRequestLock,
} from "../src/utils/registrationAuth.js"

const requests = []
const replies = []
let bodyReadCount = 0
const originalFetch = globalThis.fetch
globalThis.fetch = async (url, options) => {
  requests.push({ url: String(url), options })
  const next = replies.shift()
  if (next instanceof Error) throw next
  if (next.timeout) {
    return new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("aborted")
        error.name = "AbortError"
        reject(error)
      }, { once: true })
    })
  }
  return {
    status: next.status,
    ok: next.status >= 200 && next.status < 300,
    headers: new Headers(next.headers || {}),
    async json() {
      bodyReadCount += 1
      return next.body
    },
    async text() {
      bodyReadCount += 1
      return next.text || ""
    },
  }
}

try {
  // TC01: optional phone is omitted when blank; invalid input is never sent.
  const withoutPhone = buildRegistrationPayload({
    fullName: "Member One",
    email: " MEMBER@EXAMPLE.COM ",
    password: "secret1",
    phone: "  ",
  })
  assert.deepEqual(withoutPhone, {
    fullName: "Member One",
    email: "member@example.com",
    password: "secret1",
  })
  assert.equal(getRegistrationPhoneError("", true), "")
  assert.deepEqual(buildRegistrationPayload({
    fullName: "Member One", email: "member@example.com", password: "secret1", phone: " 0988 123 456 ",
  }).phone, "0988123456")
  assert.throws(() => buildRegistrationPayload({
    fullName: "Member One", email: "member@example.com", password: "secret1", phone: "abc",
  }))
  replies.push({ status: 200, body: { code: null, message: "Request accepted" }, headers: { "content-type": "application/json" } })
  const registerResponse = await authApi.register(withoutPhone)
  assert.equal(registerResponse.code, null)
  assert.equal(classifyRegisterResponse(registerResponse), "verify")
  assert.deepEqual(JSON.parse(requests.at(-1).options.body), withoutPhone)
  assert.equal("phone" in JSON.parse(requests.at(-1).options.body), false)
  assert.equal(requests.at(-1).options.credentials, "include")

  // TC02/TC03: HTTP 200 and code:null proceed to OTP, never to a success/active state;
  // REGISTRATION_PENDING resumes verification rather than repeating registration.
  assert.equal(classifyRegisterResponse({ code: null }), "verify")
  assert.equal(classifyRegisterResponse({ code: "REGISTRATION_PENDING" }), "resume-verification")

  // TC04/TC05/TC15: verification uses only the verify endpoint and requires HTTP 204.
  replies.push({ status: 204 })
  const readCountBefore204 = bodyReadCount
  assert.equal(await authApi.verifyRegistration({ email: "member@example.com", otp: "123456" }), null)
  assert.equal(bodyReadCount, readCountBefore204, "204 response body must not be parsed")
  assert.match(requests.at(-1).url, /\/api\/auth\/verify-registration$/)
  assert.equal(JSON.parse(requests.at(-1).options.body).otp, "123456")
  assert.equal(requests.at(-1).options.credentials, "include")
  assert.equal(requests.at(-1).options.expectedStatus, undefined, "client-only status option must not leak to fetch")
  assert.equal(requests.some((request) => request.url.endsWith("/api/auth/login")), false)
  replies.push({ status: 200, body: { message: "unexpected 200" }, headers: { "content-type": "application/json" } })
  await assert.rejects(authApi.verifyRegistration({ email: "member@example.com", otp: "123456" }), (error) => error.status === 200)

  replies.push({ status: 200, body: { code: null, message: "Accepted" }, headers: { "content-type": "application/json" } })
  await authApi.resendOtp({ email: "member@example.com", purpose: "REGISTER" })
  assert.deepEqual(JSON.parse(requests.at(-1).options.body), {
    email: "member@example.com",
    purpose: "REGISTER",
  })
  replies.push({ status: 429, body: { code: "OTP_RESEND_TOO_SOON", message: "Wait" }, headers: { "content-type": "application/json" } })
  await assert.rejects(
    authApi.resendOtp({ email: "member@example.com", purpose: "REGISTER" }),
    (error) => error.status === 429 && error.code === "OTP_RESEND_TOO_SOON",
  )

  // TC06-TC11: each OTP code gets a distinct Vietnamese message.
  const expectedMessages = {
    OTP_INVALID: "Mã OTP không đúng. Vui lòng kiểm tra và thử lại.",
    OTP_EXPIRED: "Mã OTP đã hết hạn. Hãy yêu cầu gửi mã mới.",
    OTP_ATTEMPTS_EXCEEDED: "Bạn đã nhập sai OTP quá số lần cho phép. Vui lòng yêu cầu mã mới hoặc liên hệ hỗ trợ.",
    OTP_RESEND_TOO_SOON: "Bạn vừa yêu cầu mã. Vui lòng chờ ít nhất 60 giây trước khi gửi lại.",
    OTP_RESEND_LIMIT: "Bạn đã đạt giới hạn gửi OTP trong một giờ. Vui lòng chờ trước khi yêu cầu mã khác.",
    EMAIL_ALREADY_REGISTERED: "Email này đã được đăng ký. Hãy đăng nhập hoặc sử dụng email khác.",
  }
  for (const [code, message] of Object.entries(expectedMessages)) {
    assert.equal(getRegistrationOtpErrorMessage({ code }, { isVi: true }), message)
  }

  // TC12: null error code retains the HTTP status/backend message handling.
  const nullCodeError = createApiError(409, { code: null, message: "Backend conflict" })
  assert.equal(nullCodeError.code, null)
  assert.equal(nullCodeError.status, 409)
  assert.equal(getRegistrationOtpErrorMessage(nullCodeError, { isVi: true }), "Backend conflict")

  // TC13: a successful resend clears old digits; a failed resend leaves them intact.
  const oldOtp = ["1", "2", "3", "4", "5", "6"]
  assert.deepEqual(getOtpDigitsAfterResend(oldOtp, true), ["", "", "", "", "", ""])
  assert.deepEqual(getOtpDigitsAfterResend(oldOtp, false), oldOtp)

  // TC14: synchronous request lock blocks duplicate submits until released.
  const requestLock = { current: false }
  assert.equal(tryAcquireRequestLock(requestLock), true)
  assert.equal(tryAcquireRequestLock(requestLock), false)
  releaseRequestLock(requestLock)
  assert.equal(tryAcquireRequestLock(requestLock), true)
  releaseRequestLock(requestLock)

  // TC16: auth identity and first-login flag come from the Backend response.
  const currentUser = buildCurrentUser({
    userId: 31,
    memberId: 9,
    role: "Member",
    authorities: ["ROLE_MEMBER"],
    isFirstLogin: true,
  }, null)
  assert.equal(currentUser.id, 31)
  assert.equal(currentUser.memberId, 9)
  assert.equal(currentUser.role, "Member")
  assert.deepEqual(currentUser.authorities, ["ROLE_MEMBER"])
  assert.equal(currentUser.isFirstLogin, true)
  assert.equal(buildCurrentUser({ userId: 32, role: "Member" }, null).isFirstLogin, undefined)
  replies.push({
    status: 200,
    body: {
      userId: 31,
      memberId: 9,
      role: "Member",
      authorities: ["ROLE_MEMBER"],
      isFirstLogin: true,
    },
    headers: { "content-type": "application/json" },
  })
  const loginResponse = await authApi.login("member@example.com", "secret1")
  assert.deepEqual(loginResponse, {
    userId: 31,
    memberId: 9,
    role: "Member",
    authorities: ["ROLE_MEMBER"],
    isFirstLogin: true,
  })
  assert.equal(requests.at(-1).options.credentials, "include")
  assert.deepEqual(JSON.parse(requests.at(-1).options.body), {
    email: "member@example.com",
    password: "secret1",
  })

  // TC17: network errors remain errors; no success response is fabricated.
  replies.push(new Error("network down"))
  await assert.rejects(authApi.register(withoutPhone), (error) => error.status === 0)
  replies.push({ timeout: true })
  await assert.rejects(
    authApi.register(withoutPhone, { timeoutMs: 1 }),
    (error) => error.status === 0 && /quá thời gian chờ/i.test(error.message),
  )

  // TC18: OTP is not written to localStorage or logged from the registration UI.
  const loginView = await readFile(new URL("../src/components/views/LoginView.jsx", import.meta.url), "utf8")
  assert.doesNotMatch(loginView, /localStorage\.setItem\([^\n]*(?:otp|OTP)/)
  assert.doesNotMatch(loginView, /console\.(?:log|debug)\([^\n]*(?:otp|OTP)/)
  assert.doesNotMatch(loginView, /res\?\.code|Mã OTP:\s*\$\{/)
} finally {
  globalThis.fetch = originalFetch
}

console.log("FE-OTP-01 auth checks passed (TC01-TC18).")
