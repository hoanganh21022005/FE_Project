import assert from "node:assert/strict"
import {
  evaluateNormalClassOpening,
  formatOpeningDateTime,
  getNormalClassOpeningError,
} from "../src/api/normalClassOpening.js"
import { createApiError, getErrorMessage, translateErrorCode } from "../src/api/apiErrors.js"

const baseClass = {
  id: 10,
  classType: "Normal",
  status: "Open",
  apiStatus: "Open",
  openingConfirmedAt: null,
  changePending: false,
  coachId: 5,
  minCapacity: 2,
  serverTime: "2026-11-19T10:00:00+07:00",
  openingConfirmationDueAt: "2026-11-19T18:00:00+07:00",
  openingConfirmationDeadline: "2026-11-20T18:00:00+07:00",
}

const baseEnrollments = [
  { id: 1, status: "Registered", paymentStatus: "Paid" },
  { id: 2, status: "Registered", paymentStatus: "Paid" },
]

const baseSessions = [
  { id: 100, sessionDate: "2026-11-20", startTime: "18:00:00", coachId: 5, roomId: 3, status: "Scheduled" },
]

// 1. openingConfirmationAllowed === false -> khóa nút và dịch lý do
{
  const res = evaluateNormalClassOpening({
    classItem: {
      ...baseClass,
      openingConfirmationAllowed: false,
      openingConfirmationBlockReason: "NORMAL_OPENING_TOO_LATE",
    },
    enrollments: baseEnrollments,
    sessions: baseSessions,
    authorities: ["MANAGE_CLASSES"],
  })
  assert.equal(res.canSubmit, false)
  assert.equal(res.openingConfirmationAllowed, false)
  assert.ok(res.blockers.some((b) => b === translateErrorCode("NORMAL_OPENING_TOO_LATE", "vi")))
}

// 2. openingConfirmationAllowed === true + openingReasonRequired === true -> bắt nhập lý do
{
  const missingReason = evaluateNormalClassOpening({
    classItem: {
      ...baseClass,
      openingConfirmationAllowed: true,
      openingReasonRequired: true,
    },
    enrollments: baseEnrollments,
    sessions: baseSessions,
    authorities: ["MANAGE_CLASSES"],
    reason: "",
  })
  assert.equal(missingReason.canSubmit, false)
  assert.equal(missingReason.reasonRequired, true)

  const withReason = evaluateNormalClassOpening({
    classItem: {
      ...baseClass,
      openingConfirmationAllowed: true,
      openingReasonRequired: true,
    },
    enrollments: baseEnrollments,
    sessions: baseSessions,
    authorities: ["MANAGE_CLASSES"],
    reason: "Xác nhận khai giảng muộn",
  })
  assert.equal(withReason.canSubmit, true)
  assert.deepEqual(withReason.payload, { reason: "Xác nhận khai giảng muộn" })
  assert.ok(Number.isFinite(withReason.openingConfirmationDueAt))
  assert.ok(Number.isFinite(withReason.openingConfirmationDeadline))
}

// 3. Thiếu field openingConfirmationAllowed & thiếu/rác dueAt/deadline -> trả null (không trả NaN)
{
  const missingBoth = evaluateNormalClassOpening({
    classItem: {
      ...baseClass,
      openingConfirmationDueAt: undefined,
      openingConfirmationDeadline: undefined,
    },
    enrollments: baseEnrollments,
    sessions: baseSessions,
    authorities: ["MANAGE_CLASSES"],
    reason: "Xác nhận trước giờ",
  })
  assert.equal(missingBoth.openingConfirmationAllowed, null)
  assert.equal(missingBoth.canSubmit, true)
  assert.equal(missingBoth.openingConfirmationDueAt, null)
  assert.equal(missingBoth.openingConfirmationDeadline, null)

  const garbageBoth = evaluateNormalClassOpening({
    classItem: {
      ...baseClass,
      openingConfirmationDueAt: "not-a-date",
      openingConfirmationDeadline: NaN,
    },
    enrollments: baseEnrollments,
    sessions: baseSessions,
    authorities: ["MANAGE_CLASSES"],
    reason: "Xác nhận trước giờ",
  })
  assert.equal(garbageBoth.openingConfirmationDueAt, null)
  assert.equal(garbageBoth.openingConfirmationDeadline, null)

  const validBoth = evaluateNormalClassOpening({
    classItem: baseClass,
    enrollments: baseEnrollments,
    sessions: baseSessions,
    authorities: ["MANAGE_CLASSES"],
  })
  assert.equal(typeof validBoth.openingConfirmationDueAt, "number")
  assert.equal(typeof validBoth.openingConfirmationDeadline, "number")
  assert.ok(Number.isFinite(validBoth.openingConfirmationDueAt))
  assert.ok(Number.isFinite(validBoth.openingConfirmationDeadline))
}

// 3b. formatOpeningDateTime an toàn với null, NaN, chuỗi lạ và hợp lệ
{
  assert.equal(formatOpeningDateTime(null), "")
  assert.equal(formatOpeningDateTime(undefined), "")
  assert.equal(formatOpeningDateTime(NaN), "")
  assert.equal(formatOpeningDateTime("chuoi-la"), "")
  const formatted = formatOpeningDateTime(Date.parse("2026-11-19T18:00:00+07:00"))
  assert.equal(typeof formatted, "string")
  assert.ok(formatted.length > 0)
}

// 4. Dịch mã lỗi C4 qua apiErrors.js
{
  const err = getNormalClassOpeningError({ status: 409, code: "NORMAL_OPENING_TOO_LATE" })
  assert.equal(err.code, "NORMAL_OPENING_TOO_LATE")
  assert.equal(err.message, translateErrorCode("NORMAL_OPENING_TOO_LATE", "vi"))
  assert.ok(translateErrorCode("NORMAL_REGISTRATION_CLOSED", "vi"))
  assert.ok(translateErrorCode("WAITLIST_FULL", "vi"))
  assert.equal(
    getErrorMessage(
      createApiError(409, {
        code: "NORMAL_CASH_NO_SEAT",
        message: "Lớp đã hết chỗ chính thức, không thu tiền mặt cho danh sách chờ.",
      }),
    ),
    "Lớp đã hết chỗ chính thức, không thu tiền mặt cho danh sách chờ.",
  )
}

console.log("c4_normal_contract_test: all assertions passed")
