import assert from "node:assert/strict"
import {
  decideTrainingResultSubmission,
  getTrainingResultSaveErrorMessage,
  isSessionPastEndTime,
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

// 7. Các ca theo review E3-r2:
// a. status: "Scheduled" nhưng sessionDate/endTime đã qua 3 phút, có result -> action === "patch"
{
  const nowAfter3m = Date.parse("2026-11-19T10:03:00+07:00")
  const session = {
    id: 20,
    status: "Scheduled",
    sessionDate: "2026-11-19",
    endTime: "10:00:00",
  }
  assert.equal(isSessionPastEndTime(session, nowAfter3m), true)
  const decision = decideTrainingResultSubmission({
    session,
    memberId: 5,
    results: [{ resultId: 99, sessionId: 20, memberId: 5, attendanceStatus: "Present" }],
    attendances: [],
    content: "Nhận xét sau khi kết thúc 3 phút",
    language: "vi",
    now: nowAfter3m,
  })
  assert.equal(decision.action, "patch")
  assert.equal(decision.resultId, 99)
}

// b. Cùng ca Scheduled đã qua 3 phút nhưng không có result -> block, không POST
{
  const nowAfter3m = Date.parse("2026-11-19T10:03:00+07:00")
  const decision = decideTrainingResultSubmission({
    session: {
      id: 21,
      status: "Scheduled",
      sessionDate: "2026-11-19",
      endTime: "10:00:00",
    },
    memberId: 5,
    results: [],
    attendances: [{ sessionId: 21, memberId: 5, state: "Present" }],
    content: "Nhận xét sau khi kết thúc 3 phút",
    language: "vi",
    now: nowAfter3m,
  })
  assert.equal(decision.action, "block")
  assert.equal(decision.reason, "NO_EXISTING_RESULT_AFTER_SESSION")
}

// c. status: "Scheduled", chưa tới giờ kết thúc, có điểm danh thật -> post với đúng attendanceStatus
{
  const nowBeforeEnd = Date.parse("2026-11-19T09:30:00+07:00")
  const decision = decideTrainingResultSubmission({
    session: {
      id: 22,
      status: "Scheduled",
      sessionDate: "2026-11-19",
      endTime: "10:00:00",
    },
    memberId: 5,
    results: [],
    attendances: [{ sessionId: 22, memberId: 5, state: "Absent" }],
    content: "Học viên nghỉ có phép",
    language: "vi",
    now: nowBeforeEnd,
  })
  assert.equal(decision.action, "post")
  assert.equal(decision.attendanceStatus, "Absent")
}

// d. Cancelled hoặc centerInvalidated: true kể cả đã qua giờ -> không patch, không post
{
  const nowAfter = Date.parse("2026-11-19T12:00:00+07:00")
  const cancelledDecision = decideTrainingResultSubmission({
    session: {
      id: 23,
      status: "Cancelled",
      sessionDate: "2026-11-19",
      endTime: "10:00:00",
    },
    memberId: 5,
    results: [{ resultId: 100, sessionId: 23, memberId: 5, attendanceStatus: "Present" }],
    attendances: [{ sessionId: 23, memberId: 5, state: "Present" }],
    content: "Không được lưu",
    language: "vi",
    now: nowAfter,
  })
  assert.equal(cancelledDecision.action, "block")
  assert.equal(cancelledDecision.reason, "SESSION_NOT_HELD")

  const invalidatedDecision = decideTrainingResultSubmission({
    session: {
      id: 24,
      status: "Completed",
      centerInvalidated: true,
      sessionDate: "2026-11-19",
      endTime: "10:00:00",
    },
    memberId: 5,
    results: [{ resultId: 101, sessionId: 24, memberId: 5, attendanceStatus: "Present" }],
    attendances: [],
    content: "Không được lưu",
    language: "en",
    now: nowAfter,
  })
  assert.equal(invalidatedDecision.action, "block")
  assert.equal(invalidatedDecision.reason, "SESSION_NOT_HELD")
}

// e. sessionDate/endTime thiếu hoặc không hợp lệ -> không ném lỗi, rơi về theo status
{
  assert.equal(
    isSessionPastEndTime({ id: 25, status: "Scheduled", sessionDate: "bad-date", endTime: "bad" }),
    false,
  )
  assert.equal(
    isSessionPastEndTime({ id: 26, status: "Completed", sessionDate: undefined, endTime: null }),
    true,
  )
}

console.log("e3_training_result_submission_test: all assertions passed")
