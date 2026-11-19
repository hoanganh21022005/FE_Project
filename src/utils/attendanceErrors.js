import { getErrorCode, getErrorMessage, translateErrorCode } from "../api/apiErrors.js"

const HAS_VI_DIACRITICS = /[\u00C0-\u1EF9]/

const KNOWN_ATTENDANCE_CODES = [
  "SESSION_NOT_HELD",
  "NORMAL_NOT_STARTED",
  "ATTENDANCE_WINDOW_CLOSED",
  "CHECKIN_WINDOW_CLOSED",
  "SESSION_TIME_REQUIRED",
  "COACH_REQUIRED",
  "NOT_YOUR_CLASS",
  "PACKAGE_EXPIRED",
  "MEMBER_NOT_ACTIVE",
  "INVALID_CHECKIN_CODE",
]

function isHumanMessage(rawMessage, code, language) {
  if (!rawMessage) return false
  const upper = rawMessage.toUpperCase()
  if (code && (upper === code || upper.includes(code))) return false
  if (KNOWN_ATTENDANCE_CODES.some((known) => upper === known || upper.includes(known))) {
    return false
  }
  if (/^[A-Z0-9_]+$/.test(rawMessage)) return false
  if (language === "vi" && !HAS_VI_DIACRITICS.test(rawMessage)) {
    return false
  }
  return true
}

export function getAttendanceActionErrorMessage(
  err,
  language = "vi",
  fallbackVi = "",
  fallbackEn = "",
) {
  const fallback =
    (language === "vi" ? fallbackVi : fallbackEn) ||
    (language === "vi"
      ? "Không thể thực hiện thao tác điểm danh."
      : "Could not complete attendance action.")

  const code = getErrorCode(err)
  const rawMessage = String(
    err?.details?.message ||
      err?.response?.data?.message ||
      err?.message ||
      "",
  ).trim()
  const upperMsg = rawMessage.toUpperCase()

  const detectedCode =
    code ||
    KNOWN_ATTENDANCE_CODES.find(
      (known) => upperMsg === known || upperMsg.includes(known),
    ) ||
    ""

  const lookupCode =
    detectedCode === "CHECKIN_WINDOW_CLOSED"
      ? "ATTENDANCE_WINDOW_CLOSED"
      : detectedCode

  const translated = lookupCode
    ? translateErrorCode(lookupCode, language, "attendance")
    : null

  if (isHumanMessage(rawMessage, detectedCode, language)) {
    return rawMessage
  }

  if (translated) {
    return translated
  }

  const hasStatus = Boolean(Number(err?.status ?? err?.response?.status))
  if (!err || (!code && !rawMessage && !hasStatus)) {
    return fallback
  }

  const safeMsg = getErrorMessage(err, fallback)
  return safeMsg && String(safeMsg).trim() ? String(safeMsg).trim() : fallback
}
