import { getErrorCode, getErrorMessage, translateErrorCode } from "../api/apiErrors.js"
import { parseBackendDate } from "./datetime.js"
import { normalizeSessionStatus } from "./permissions.js"

const VALID_ATTENDANCE_STATUSES = new Set(["Present", "Absent", "Late", "Excused"])

function resolveNowMs(session, now) {
  if (session?.serverTime != null) {
    const serverMs = parseBackendDate(session.serverTime)
    if (Number.isFinite(serverMs)) return serverMs
  }
  if (now instanceof Date) {
    const t = now.getTime()
    return Number.isFinite(t) ? t : Date.now()
  }
  if (typeof now === "number") {
    return Number.isFinite(now) ? now : Date.now()
  }
  if (typeof now === "string") {
    const parsed = parseBackendDate(now)
    return Number.isFinite(parsed) ? parsed : Date.now()
  }
  return Date.now()
}

export function isSessionCancelledOrInvalidated(session) {
  return (
    session?.centerInvalidated === true ||
    normalizeSessionStatus(session) === "Cancelled"
  )
}

export function isSessionPastEndTime(session, now = Date.now()) {
  if (!session || isSessionCancelledOrInvalidated(session)) return false
  if (normalizeSessionStatus(session) === "Completed") return true

  const rawDate = String(session?.sessionDate ?? "").trim().slice(0, 10)
  const rawEndTime = String(session?.endTime ?? session?.end_time ?? "").trim()
  const dateMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const timeMatch = rawEndTime.match(/^(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!dateMatch || !timeMatch) return false

  const [, hh, mm, ss = "00"] = timeMatch
  const endMs = parseBackendDate(`${rawDate}T${hh}:${mm}:${ss}`)
  if (!Number.isFinite(endMs)) return false

  const nowMs = resolveNowMs(session, now)
  return Number.isFinite(nowMs) && nowMs >= endMs
}

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
  now = Date.now(),
} = {}) {
  const isVi = language === "vi"
  if (isSessionCancelledOrInvalidated(session)) {
    return {
      action: "block",
      reason: "SESSION_NOT_HELD",
      message: isVi
        ? "Buổi học đã bị hủy hoặc không diễn ra nên không thể ghi nhận xét."
        : "This session was cancelled or not held, so comments cannot be saved.",
    }
  }

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

  const isEnded = isSessionPastEndTime(session, now)

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
