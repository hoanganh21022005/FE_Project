import { getErrorCode, getErrorMessage, translateErrorCode } from "../api/apiErrors.js"
import { normalizeSessionStatus } from "./permissions.js"

const VALID_ATTENDANCE_STATUSES = new Set(["Present", "Absent", "Late", "Excused"])

function normalizeAttendanceStatusValue(raw) {
  if (!raw) return null
  const text = String(raw).trim()
  if (VALID_ATTENDANCE_STATUSES.has(text)) return text
  const lower = text.toLowerCase()
  if (lower.includes("late")) return "Late"
  if (lower.includes("excuse")) return "Excused"
  if (lower.includes("absent")) return "Absent"
  if (lower.includes("present") || lower.includes("checked")) return "Present"
  return null
}

export function resolveVerifiedAttendanceStatus({
  sessionId,
  memberId,
  results = [],
  attendances = [],
} = {}) {
  const sessionIdStr = sessionId != null ? String(sessionId) : ""
  const memberIdStr = memberId != null ? String(memberId) : ""
  if (!sessionIdStr || !memberIdStr) return null

  const matchedResult = (Array.isArray(results) ? results : []).find(
    (r) =>
      String(r?.sessionId) === sessionIdStr &&
      String(r?.memberId) === memberIdStr &&
      normalizeAttendanceStatusValue(r?.attendanceStatus),
  )
  if (matchedResult) {
    return normalizeAttendanceStatusValue(matchedResult.attendanceStatus)
  }

  const matchedAtt = (Array.isArray(attendances) ? attendances : []).find(
    (a) =>
      String(a?.sessionId) === sessionIdStr &&
      String(a?.memberId) === memberIdStr,
  )
  if (matchedAtt) {
    return normalizeAttendanceStatusValue(
      matchedAtt.attendanceStatus ?? matchedAtt.state ?? matchedAtt.status,
    )
  }

  return null
}

export function decideTrainingResultSubmission({
  session,
  memberId,
  results = [],
  attendances = [],
  content = "",
  language = "vi",
} = {}) {
  const isVi = language === "vi"
  const sessionId = session?.id ?? session?.sessionId ?? null
  const sessionIdStr = sessionId != null ? String(sessionId) : ""
  const memberIdStr = memberId != null ? String(memberId) : ""
  const trimmedContent = String(content ?? "").trim()

  const existingResult = (Array.isArray(results) ? results : []).find(
    (r) =>
      String(r?.sessionId) === sessionIdStr &&
      String(r?.memberId) === memberIdStr &&
      (r?.resultId ?? r?.id) != null,
  )
  const existingResultId = existingResult
    ? (existingResult.resultId ?? existingResult.id)
    : null

  const isEnded = normalizeSessionStatus(session) === "Completed"

  if (isEnded) {
    if (existingResultId != null) {
      return {
        action: "patch",
        resultId: Number(existingResultId),
        content: trimmedContent,
      }
    }
    return {
      action: "block",
      reason: "NO_EXISTING_RESULT_AFTER_SESSION",
      message: isVi
        ? "Nhận xét sau buổi học chỉ sửa được khi đã có kết quả điểm danh."
        : "Post-session comments can only be edited when a training result already exists.",
    }
  }

  const verifiedStatus = resolveVerifiedAttendanceStatus({
    sessionId,
    memberId,
    results,
    attendances,
  })
  if (!verifiedStatus) {
    return {
      action: "block",
      reason: "NO_VERIFIED_ATTENDANCE",
      message: isVi
        ? "Chưa có dữ liệu điểm danh thật của hội viên cho buổi học này."
        : "No recorded attendance found for this member in this session.",
    }
  }

  return {
    action: "post",
    attendanceStatus: verifiedStatus,
    content: trimmedContent,
  }
}

export function getTrainingResultSaveErrorMessage(err, language = "vi") {
  const isVi = language === "vi"
  const fallback = isVi
    ? "Không thể lưu nhận xét buổi tập."
    : "Failed to save session comment."
  const code = getErrorCode(err)
  if (code) {
    const translated = translateErrorCode(code, isVi ? "vi" : "en", "resultContent")
    if (translated) return translated
  }
  const msg = getErrorMessage(err, fallback)
  return msg && String(msg).trim() ? String(msg).trim() : fallback
}
