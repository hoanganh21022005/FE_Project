const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^(0|\+84)[0-9]{8,10}$/

export function validateEmail(value, { required = false, language = "vi" } = {}) {
  const email = String(value || "").trim()
  if (!email) {
    return required
      ? language === "vi" ? "Vui lòng nhập email." : "Email is required."
      : ""
  }
  return EMAIL_PATTERN.test(email)
    ? ""
    : language === "vi" ? "Email chưa đúng định dạng." : "Invalid email format."
}

export function validatePhone(value, { required = false, language = "vi" } = {}) {
  const phone = String(value || "").replace(/[\s()-]/g, "")
  if (!phone) {
    return required
      ? language === "vi" ? "Vui lòng nhập số điện thoại." : "Phone number is required."
      : ""
  }
  return PHONE_PATTERN.test(phone)
    ? ""
    : language === "vi" ? "Số điện thoại chưa hợp lệ." : "Invalid phone number."
}

export function validateRequiredDate(value, { language = "vi" } = {}) {
  return String(value || "").trim()
    ? ""
    : language === "vi" ? "Vui lòng chọn ngày." : "Please select a date."
}
