import { getErrorMessage } from "../api/apiErrors.js"

const OTP_ERROR_MESSAGES = {
  EMAIL_ALREADY_REGISTERED: {
    vi: "Email này đã được đăng ký. Hãy đăng nhập hoặc sử dụng email khác.",
    en: "This email is already registered. Sign in or use another email.",
  },
  OTP_INVALID: {
    vi: "Mã OTP không đúng. Vui lòng kiểm tra và thử lại.",
    en: "The OTP is incorrect. Check the code and try again.",
  },
  OTP_EXPIRED: {
    vi: "Mã OTP đã hết hạn. Hãy yêu cầu gửi mã mới.",
    en: "The OTP has expired. Request a new code.",
  },
  OTP_ATTEMPTS_EXCEEDED: {
    vi: "Bạn đã nhập sai OTP quá số lần cho phép. Vui lòng yêu cầu mã mới hoặc liên hệ hỗ trợ.",
    en: "Too many incorrect OTP attempts. Request a new code or contact support.",
  },
  OTP_RESEND_TOO_SOON: {
    vi: "Bạn vừa yêu cầu mã. Vui lòng chờ ít nhất 60 giây trước khi gửi lại.",
    en: "A code was requested recently. Wait at least 60 seconds before resending.",
  },
  OTP_RESEND_LIMIT: {
    vi: "Bạn đã đạt giới hạn gửi OTP trong một giờ. Vui lòng chờ trước khi yêu cầu mã khác.",
    en: "The hourly OTP resend limit has been reached. Wait before requesting another code.",
  },
  REGISTRATION_PENDING: {
    vi: "Tài khoản này đang chờ xác minh. Hãy nhập OTP đã nhận để tiếp tục; không cần đăng ký lại.",
    en: "This account is awaiting verification. Enter the OTP you received to continue; do not register again.",
  },
}

export function getAuthErrorCode(error) {
  const code = error?.code ?? error?.details?.code
  return typeof code === "string" && code.trim()
    ? code.trim().toUpperCase()
    : null
}

export function getRegistrationOtpErrorMessage(error, { isVi = true, fallback } = {}) {
  const code = getAuthErrorCode(error)
  const localized = code ? OTP_ERROR_MESSAGES[code] : null
  if (localized) return localized[isVi ? "vi" : "en"]
  return getErrorMessage(error, fallback)
}

export function normalizeRegistrationPhone(value) {
  const phone = String(value || "").trim().replace(/\s/g, "")
  return phone || ""
}

export function getRegistrationPhoneError(value, isVi = true) {
  const phone = normalizeRegistrationPhone(value)
  if (!phone || /^(0|\+84)[0-9]{8,10}$/.test(phone)) return ""
  return isVi
    ? "Số điện thoại chưa hợp lệ (VD: 0988123456)."
    : "Invalid phone number format."
}

export function buildRegistrationPayload({ fullName, email, password, phone }) {
  const normalizedPhone = normalizeRegistrationPhone(phone)
  if (getRegistrationPhoneError(normalizedPhone, true)) {
    throw new Error("Invalid phone number format.")
  }
  return {
    fullName: String(fullName || "").trim(),
    email: String(email || "").trim().toLowerCase(),
    password,
    ...(normalizedPhone ? { phone: normalizedPhone } : {}),
  }
}

export function tryAcquireRequestLock(lockRef) {
  if (lockRef.current) return false
  lockRef.current = true
  return true
}

export function releaseRequestLock(lockRef) {
  lockRef.current = false
}

export function isRegistrationOtpErrorCode(code) {
  return typeof code === "string" && Boolean(OTP_ERROR_MESSAGES[code.trim().toUpperCase()])
}

export function classifyRegisterResponse(response) {
  const code = getAuthErrorCode(response)
  if (code === "REGISTRATION_PENDING") return "resume-verification"
  if (isRegistrationOtpErrorCode(code)) return "error"
  return "verify"
}

export function getOtpDigitsAfterResend(currentDigits, succeeded) {
  return succeeded ? ["", "", "", "", "", ""] : currentDigits
}
