import assert from "node:assert/strict"
import {
  formatAttendanceReasonCode,
  recordSessionAttendance,
  resolveSessionAttendanceAccess,
} from "../src/api/attendanceApi.js"
import { translateErrorCode } from "../src/api/apiErrors.js"

// 1. attendanceAllowed === true -> mở điểm danh (kể cả điểm danh sớm khi legacyCanCheckIn = false)
{
  const access = resolveSessionAttendanceAccess({ id: 1, attendanceAllowed: true }, false)
  assert.equal(access.allowed, true)
  assert.equal(access.attendanceAllowed, true)
  assert.equal(access.blockReason, null)
}

// 2. attendanceAllowed === false -> khóa và giữ blockReason (5 mã)
for (const code of [
  "SESSION_NOT_HELD",
  "NORMAL_NOT_STARTED",
  "ATTENDANCE_WINDOW_CLOSED",
  "SESSION_TIME_REQUIRED",
  "COACH_REQUIRED",
]) {
  const access = resolveSessionAttendanceAccess(
    { id: 2, attendanceAllowed: false, attendanceBlockReason: code },
    true,
  )
  assert.equal(access.allowed, false)
  assert.equal(access.attendanceAllowed, false)
  assert.equal(access.blockReason, code)
  const viMsg = formatAttendanceReasonCode(code, "vi")
  assert.ok(viMsg && viMsg !== code, `Phải dịch được mã ${code}`)
}

// 3. Thiếu field attendanceAllowed -> không coi là false, không mở phần sớm
{
  const noEarly = resolveSessionAttendanceAccess({ id: 3 }, false)
  assert.equal(noEarly.attendanceAllowed, null)
  assert.equal(noEarly.allowed, false)

  const legacyOpen = resolveSessionAttendanceAccess({ id: 4, attendanceAllowed: null }, true)
  assert.equal(legacyOpen.attendanceAllowed, null)
  assert.equal(legacyOpen.allowed, true)
}

// 4. CHECKIN_WINDOW_CLOSED dịch như ATTENDANCE_WINDOW_CLOSED
assert.equal(
  formatAttendanceReasonCode("CHECKIN_WINDOW_CLOSED", "vi"),
  translateErrorCode("ATTENDANCE_WINDOW_CLOSED", "vi", "attendance"),
)
assert.equal(
  formatAttendanceReasonCode("CHECKIN_WINDOW_CLOSED", "en"),
  translateErrorCode("ATTENDANCE_WINDOW_CLOSED", "en", "attendance"),
)

// 5. recordSessionAttendance gửi note đã trim khi có ghi chú, không gửi content, không gửi reason
{
  const originalFetch = globalThis.fetch
  const originalWindow = globalThis.window
  const originalLocalStorage = globalThis.localStorage
  const originalSessionStorage = globalThis.sessionStorage
  const sentBodies = []

  globalThis.window = { dispatchEvent() {}, location: { pathname: "/", search: "" } }
  globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  globalThis.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  globalThis.fetch = async (_url, options = {}) => {
    const parsed = options.body ? JSON.parse(options.body) : {}
    sentBodies.push(parsed)
    return {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        sessionId: parsed.sessionId,
        memberId: parsed.memberId,
        attendanceStatus: parsed.attendanceStatus,
      }),
      text: async () => "",
    }
  }

  try {
    await recordSessionAttendance({
      memberId: 10,
      sessionId: 20,
      coachId: 3,
      status: "Present",
      notes: "  Ghi chú điểm danh  ",
    })
    assert.equal(sentBodies[0].note, "Ghi chú điểm danh")
    assert.equal("content" in sentBodies[0], false)
    assert.equal("reason" in sentBodies[0], false)

    await recordSessionAttendance({
      memberId: 10,
      sessionId: 20,
      coachId: 3,
      status: "Absent",
      notes: "   ",
    })
    assert.equal("note" in sentBodies[1], false)
    assert.equal("content" in sentBodies[1], false)
    assert.equal("reason" in sentBodies[1], false)
  } finally {
    globalThis.fetch = originalFetch
    globalThis.window = originalWindow
    globalThis.localStorage = originalLocalStorage
    globalThis.sessionStorage = originalSessionStorage
  }
}

console.log("c3_early_attendance_test: all assertions passed")
