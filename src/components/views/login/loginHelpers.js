import { PASSWORD_MIN_LENGTH } from "../../../utils/passwordPolicy"
import { EMAIL_DOMAIN_SUGGESTIONS } from "./loginConstants"

export function buildEmailSuggestions(rawValue) {
  const val = String(rawValue || "").trim()
  if (!val || val.length < 2 || val.includes(" ")) return []
  const atIndex = val.indexOf("@")
  const localPart = atIndex === -1 ? val : val.slice(0, atIndex)
  const typedDomain = atIndex === -1 ? "" : val.slice(atIndex).toLowerCase()
  if (!localPart) return []
  return EMAIL_DOMAIN_SUGGESTIONS.filter((domain) => {
    if (!typedDomain) return true
    return domain.startsWith(typedDomain) && domain !== typedDomain
  }).map((domain) => `${localPart}${domain}`)
}

export function checkIsClubOpenNow() {
  const now = new Date()
  const minutes = now.getHours() * 60 + now.getMinutes()
  // Open 06:00 (360) to 20:00 (1200)
  return minutes >= 360 && minutes < 1200
}

export function computePasswordStrength(pwd, isVi) {
  const val = String(pwd || "")
  const checks = {
    length: val.length >= PASSWORD_MIN_LENGTH,
    hasLetter: /[A-Za-z]/.test(val),
    hasDigit: /\d/.test(val),
    mixedCase: /[A-Z]/.test(val) && /[a-z]/.test(val),
    special: /[^A-Za-z0-9]/.test(val),
  }
  if (!val) {
    return {
      score: 0,
      label: "",
      color: "bg-stone-200",
      textColor: "text-stone-400",
      checks,
    }
  }
  let score = 0
  const isPolicyMet = checks.length && checks.hasLetter && checks.hasDigit
  if (isPolicyMet) {
    score = 2
    if (checks.mixedCase) score += 1
    if (checks.special) score += 1
  } else {
    score = 1
  }

  const map = {
    1: {
      label: isVi ? "Yếu (chưa đủ 8 ký tự, chữ và số)" : "Weak (needs 8+ chars, letter & number)",
      color: "bg-rose-500",
      textColor: "text-rose-600",
    },
    2: {
      label: isVi ? "Hợp lệ" : "Valid",
      color: "bg-amber-500",
      textColor: "text-amber-600",
    },
    3: {
      label: isVi ? "Khá mạnh" : "Good",
      color: "bg-emerald-500",
      textColor: "text-emerald-600",
    },
    4: {
      label: isVi ? "Rất mạnh" : "Strong",
      color: "bg-emerald-600",
      textColor: "text-emerald-700",
    },
  }
  const picked = map[score] || map[1]
  return { score: Math.max(1, score), ...picked, checks }
}

export function parseJwtPayload(token) {
  if (!token || typeof token !== "string") return null
  try {
    const parts = token.split(".")
    if (parts.length < 2) return null
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    while (base64.length % 4) {
      base64 += "="
    }
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const text = new TextDecoder("utf-8").decode(bytes)
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function getGoogleErrorMessage(error, tab, isVi) {
  if (error?.message === "Vai trò người dùng không được hỗ trợ trong hệ thống.") {
    return isVi
      ? "Vai trò người dùng không được hỗ trợ trong hệ thống."
      : "User role is not supported in the system."
  }
  const status = error?.status
  if (status === 401) {
    if (tab === "register") {
      return isVi
        ? "Chưa tạo được tài khoản bằng Google. Vui lòng điền biểu mẫu bên trên; email Google của bạn đã được điền sẵn."
        : "Could not create account with Google. Please fill in the form above; your Google email has been autofilled."
    }
    return isVi
      ? "Không đăng nhập được bằng Google. Nếu chưa có tài khoản, hãy chuyển sang tab Đăng ký."
      : "Unable to sign in with Google. If you do not have an account, please switch to the Register tab."
  }
  if (status === 403) {
    return isVi
      ? "Tài khoản đã bị khóa hoặc không có quyền đăng nhập."
      : "Account is locked or not authorized to sign in."
  }
  if (!status || status >= 500) {
    return isVi
      ? "Không kết nối được máy chủ. Vui lòng thử lại."
      : "Cannot connect to server. Please try again."
  }
  return isVi
    ? "Đăng nhập Google thất bại. Vui lòng thử lại."
    : "Google sign-in failed. Please try again."
}
