import { getErrorCode, getErrorMessage, translateErrorCode } from "../api/apiErrors.js"

export const PACKAGE_WRITES_RETIRED = true

export function arePackageWritesHidden(apiEnabled) {
  return Boolean(apiEnabled) && PACKAGE_WRITES_RETIRED
}

export function formatLegacyMembershipError(err, language = "vi") {
  const isVi = language === "vi"
  const fallback = isVi
    ? "Gói hội viên chung đã ngừng bán; gói Advanced mua theo môn học và huấn luyện viên."
    : "General membership packages are retired; Advanced packages are purchased per subject and coach."

  const code = getErrorCode(err)
  if (code) {
    const translated = translateErrorCode(code, isVi ? "vi" : "en")
    if (translated) return translated
  }

  const msg = getErrorMessage(err, fallback)
  if (code && msg === code) return fallback
  return msg && String(msg).trim() ? String(msg).trim() : fallback
}
