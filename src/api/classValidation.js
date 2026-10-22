export const MAX_CLASS_NAME_LENGTH = 255

export const validateClassName = (value) => {
  const name = String(value ?? "").trim()
  if (!name) return "Vui lòng nhập tên lớp học."
  if (name.length > MAX_CLASS_NAME_LENGTH) {
    return `Tên lớp học không được vượt quá ${MAX_CLASS_NAME_LENGTH} ký tự.`
  }
  return ""
}
