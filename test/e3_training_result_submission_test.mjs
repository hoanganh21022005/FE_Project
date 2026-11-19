import assert from "node:assert/strict"
import {
  decideTrainingResultSubmission,
  getTrainingResultSaveErrorMessage,
  resolveVerifiedAttendanceStatus,
} from "../src/utils/trainingResultSubmission.js"
import { translateErrorCode } from "../src/api/apiErrors.js"

// 1. resolveVerifiedAttendanceStatus không gán mặc định "Present" khi chưa có điểm danh
assert.equal(
  resolveVerifiedAttendanceStatus({
    sessionId: 10,
    memberId: 5,
    results: [],
    attendances: [],
  }),
  null,
)

assert.equal(
  resolveVerifiedAttendanceStatus({
    sessionId: 10,
    memberId: 5,
    results: [],
    attendances: [{ sessionId: 10, memberId: 5, state: "Absent" }],
  }),
  "Absent",
)

// 2. Buổi đã kết thúc và đã có result -> dùng PATCH (không POST)
{
  const decision = decideTrainingResultSubmission({
    session: { id: 10, status: "Completed" },
    memberId: 5,
    results: [{ resultId: 77, sessionId: 10, memberId: 5, attendanceStatus: "Absent" }],
    attendances: [],
    content: "  Cần giữ nhịp tốt hơn  ",
    language: "vi",
  })
  assert.deepEqual(decision, {
    action: "patch",
    resultId: 77,
    content: "Cần giữ nhịp tốt hơn",
  })
}

// 3. Buổi đã kết thúc nhưng CHƯA có result -> KHÔNG POST, chặn với thông báo rõ ràng
{
  const decision = decideTrainingResultSubmission({
    session: { id: 10, status: "Completed" },
    memberId: 5,
    results: [],
    attendances: [{ sessionId: 10, memberId: 5, state: "Present" }],
    content: "Nhận xét sau buổi",
    language: "vi",
  })
  assert.equal(decision.action, "block")
  assert.equal(decision.reason, "NO_EXISTING_RESULT_AFTER_SESSION")
  assert.ok(decision.message.includes("chỉ sửa được khi đã có kết quả"))
}

// 4. Buổi chưa kết thúc, chưa có result, đã có điểm danh thật -> POST giữ đúng attendanceStatus thật
{
  const decision = decideTrainingResultSubmission({
    session: { id: 11, status: "InProgress" },
    memberId: 5,
    results: [],
    attendances: [{ sessionId: 11, memberId: 5, state: "Late" }],
    content: "Vào lớp muộn 10 phút",
    language: "vi",
  })
  assert.deepEqual(decision, {
    action: "post",
    attendanceStatus: "Late",
    content: "Vào lớp muộn 10 phút",
  })
}

// 5. Buổi chưa kết thúc, chưa có điểm danh thật -> block (không tạo điểm danh giả)
{
  const decision = decideTrainingResultSubmission({
    session: { id: 11, status: "InProgress" },
    memberId: 5,
    results: [],
    attendances: [],
    content: "Nhận xét",
    language: "vi",
  })
  assert.equal(decision.action, "block")
  assert.equal(decision.reason, "NO_VERIFIED_ATTENDANCE")
}

// 6. Dịch lỗi RESULT_CONTENT_* trong ngữ cảnh resultContent và fallback an toàn
assert.equal(
  getTrainingResultSaveErrorMessage({ status: 400, code: "RESULT_CONTENT_NOT_OPEN" }, "vi"),
  translateErrorCode("RESULT_CONTENT_NOT_OPEN", "vi", "resultContent"),
)
assert.equal(
  getTrainingResultSaveErrorMessage({ status: 409, code: "RESULT_CONTENT_DEADLINE_PASSED" }, "en"),
  translateErrorCode("RESULT_CONTENT_DEADLINE_PASSED", "en", "resultContent"),
)
assert.ok(getTrainingResultSaveErrorMessage(null, "vi").length > 0)

console.log("e3_training_result_submission_test: all assertions passed")
