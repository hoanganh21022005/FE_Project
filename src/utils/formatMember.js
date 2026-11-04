/**
 * Chuẩn hóa mã hội viên trên toàn bộ Portal Coach về một định dạng duy nhất: MB-xxxx (ví dụ: MB-1002).
 */
export function formatMemberCode(memberId, rawCode) {
  if (rawCode && typeof rawCode === "string") {
    const clean = rawCode.trim().toUpperCase()
    const mbMatch = clean.match(/^MB-(\d+)$/)
    if (mbMatch) {
      const n = Number(mbMatch[1])
      if (Number.isInteger(n) && n > 0) {
        return `MB-${n < 1000 ? 1000 + n : n}`
      }
    }
  }
  const idMatch = String(memberId ?? rawCode ?? "").match(/(\d+)$/)
  if (idMatch) {
    const num = Number(idMatch[1])
    if (Number.isInteger(num) && num > 0) {
      return `MB-${num < 1000 ? 1000 + num : num}`
    }
  }
  return "MB-1000"
}
