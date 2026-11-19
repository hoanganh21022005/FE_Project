import assert from "node:assert/strict"
import { getAttendanceActionErrorMessage } from "../src/utils/attendanceErrors.js"

const ALL_CODES = [
  "SESSION_NOT_HELD",
  "NORMAL_NOT_STARTED",
  "ATTENDANCE_WINDOW_CLOSED",
  "SESSION_TIME_REQUIRED",
  "COACH_REQUIRED",
  "CHECKIN_WINDOW_CLOSED",
  "NOT_YOUR_CLASS",
  "PACKAGE_EXPIRED",
  "MEMBER_NOT_ACTIVE",
  "INVALID_CHECKIN_CODE",
]

// 1. Tất cả 10 mã đều trả chuỗi khác rỗng (không null, không trả nguyên mã) ở cả vi và en
for (const code of ALL_CODES) {
  for (const lang of ["vi", "en"]) {
    const msg = getAttendanceActionErrorMessage(
      { status: 409, code, details: { code, message: code } },
      lang,
      "Lỗi mặc định VI",
      "Default error EN",
    )
    assert.equal(typeof msg, "string")
    assert.ok(msg.trim().length > 0, `Mã ${code} (${lang}) không được rỗng`)
    assert.notEqual(msg, code, `Mã ${code} (${lang}) phải được dịch sang chữ người đọc`)
  }
}

// 2. Câu BE tiếng Việt (khác mã, không chứa mã) được ưu tiên giữ nguyên
{
  const msg = getAttendanceActionErrorMessage(
    {
      status: 400,
      code: "NORMAL_NOT_STARTED",
      details: {
        code: "NORMAL_NOT_STARTED",
        message: "Buổi học chưa mở khung điểm danh theo quy định trung tâm.",
      },
    },
    "vi",
    "Lỗi mặc định VI",
    "Default error EN",
  )
  assert.equal(msg, "Buổi học chưa mở khung điểm danh theo quy định trung tâm.")
}

// 3. Lỗi lạ ra fallback (theo status hoặc fallbackVi/En), không bao giờ null hoặc rỗng
{
  const msg400 = getAttendanceActionErrorMessage(
    { status: 400, code: "SOME_UNKNOWN_CODE" },
    "vi",
    "Không thể lưu điểm danh.",
    "Could not save attendance.",
  )
  assert.ok(typeof msg400 === "string" && msg400.trim().length > 0)

  const msgUnknownStatus = getAttendanceActionErrorMessage(
    { status: 418, code: "SOME_UNKNOWN_CODE" },
    "vi",
    "Không thể lưu điểm danh.",
    "Could not save attendance.",
  )
  assert.ok(typeof msgUnknownStatus === "string" && msgUnknownStatus.trim().length > 0)

  const msgNullVi = getAttendanceActionErrorMessage(
    null,
    "vi",
    "Không thể lưu điểm danh.",
    "Could not save attendance.",
  )
  assert.equal(msgNullVi, "Không thể lưu điểm danh.")

  const msgEn = getAttendanceActionErrorMessage(
    null,
    "en",
    "Không thể lưu điểm danh.",
    "Could not save attendance.",
  )
  assert.equal(msgEn, "Could not save attendance.")

  const msgNoFallback = getAttendanceActionErrorMessage(undefined, "vi")
  assert.equal(typeof msgNoFallback, "string")
  assert.ok(msgNoFallback.trim().length > 0)
}

console.log("c3_attendance_errors_test: all assertions passed")
