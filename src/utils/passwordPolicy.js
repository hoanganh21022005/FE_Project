/**
 * SCMS Password Policy Utilities
 *
 * Chính sách mật khẩu áp dụng khi TẠO MỚI hoặc THAY ĐỔI mật khẩu:
 * - Tối thiểu 8 ký tự
 * - Chứa ít nhất một chữ cái (A-Z, a-z)
 * - Chứa ít nhất một chữ số (0-9)
 *
 * Lưu ý:
 * - Tuyệt đối KHÔNG áp dụng regex này cho luồng ĐĂNG NHẬP (cho phép tài khoản demo cũ 6 ký tự).
 * - Tuyệt đối KHÔNG áp dụng cho luồng nhập mã OTP (6 chữ số).
 */

export const PASSWORD_MIN_LENGTH = 8

// Regex: tối thiểu 8 ký tự, ít nhất 1 chữ cái, ít nhất 1 chữ số
export const PASSWORD_POLICY_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

export function isPasswordValid(password) {
  if (typeof password !== "string") return false
  return PASSWORD_POLICY_REGEX.test(password)
}

export function validatePassword(password, isVi = true) {
  if (!password || typeof password !== "string" || password.length === 0) {
    return {
      isValid: false,
      error: isVi ? "Vui lòng nhập mật khẩu." : "Password is required.",
    }
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      isValid: false,
      error: isVi
        ? `Mật khẩu phải có tối thiểu ${PASSWORD_MIN_LENGTH} ký tự.`
        : `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    }
  }

  const hasLetter = /[A-Za-z]/.test(password)
  const hasDigit = /\d/.test(password)

  if (!hasLetter || !hasDigit) {
    return {
      isValid: false,
      error: isVi
        ? "Mật khẩu phải bao gồm ít nhất một chữ cái và một chữ số."
        : "Password must contain at least one letter and one number.",
    }
  }

  return { isValid: true, error: "" }
}

export function getPasswordRulesStatus(password) {
  const pwd = String(password || "")
  return {
    hasMinLength: pwd.length >= PASSWORD_MIN_LENGTH,
    hasLetter: /[A-Za-z]/.test(pwd),
    hasDigit: /\d/.test(pwd),
    allValid: isPasswordValid(pwd),
  }
}

export function getPasswordRuleHint(isVi = true) {
  return isVi
    ? "Tối thiểu 8 ký tự, gồm ít nhất 1 chữ cái và 1 chữ số"
    : "At least 8 characters, including at least 1 letter and 1 number"
}
