import { getAdminRoleLabel } from "./adminI18n.js"

const USER_ENTITIES = new Set(["USER", "USERS", "MEMBER", "MEMBERS", "STAFF", "STAFFS"])
const ROLE_ENTITIES = new Set(["ROLE", "ROLES"])

function resolveUserName(userMap, targetId) {
  if (!userMap || targetId === null || targetId === undefined || targetId === "") {
    return null
  }
  const entry = userMap.get(Number(targetId))
  if (!entry) return null
  if (typeof entry === "string") {
    const trimmed = entry.trim()
    return trimmed || null
  }
  if (entry.fullName) {
    const trimmed = String(entry.fullName).trim()
    return trimmed || null
  }
  return null
}

function resolveRoleName(roleMap, targetId, language) {
  if (!roleMap || targetId === null || targetId === undefined || targetId === "") {
    return null
  }
  const entry = roleMap.get(Number(targetId))
  if (!entry) return null
  const rawName = typeof entry === "string" ? entry : entry.name
  if (!rawName) return null
  return getAdminRoleLabel(rawName, language)
}

/**
 * Làm sạch nhãn đối tượng từ Backend:
 * bỏ mọi cụm (#số), #số đứng riêng, tiền tố `<chữ> #số` (như `User #12`, `Class #7`),
 * trả về chuỗi đã cắt khoảng trắng thừa (rỗng hoặc N/A -> "").
 */
export function cleanAuditTargetLabel(rawLabel) {
  if (rawLabel === null || rawLabel === undefined) return ""
  let cleaned = String(rawLabel).trim()
  if (!cleaned || /^n\/a$/i.test(cleaned)) return ""

  // Bỏ các cụm trong ngoặc dạng (#49)
  cleaned = cleaned.replace(/\(\s*#\s*\d+\s*\)/g, " ")
  // Bỏ tiền tố dạng "User #12", "Class #7", "Member #5" ở đầu chuỗi (giữ phần tên sau nếu có)
  cleaned = cleaned.replace(/^\s*[^\s#]+\s+#\s*\d+\b(?:\s*[-–:]\s*)?/i, " ")
  // Bỏ mọi cụm #số còn lại (đứng riêng hoặc gắn sau)
  cleaned = cleaned.replace(/#\s*\d+\b/g, " ")
  cleaned = cleaned.replace(/\s+/g, " ").trim()

  if (!cleaned || /^n\/a$/i.test(cleaned)) return ""
  return cleaned
}

/**
 * Định dạng giá trị cột "Áp dụng cho" / "Applied to" dùng chung cho
 * AdminAuditLogsView, AdminDashboard và chuông thông báo AdminHeader.
 */
export function formatAuditTarget(log, { userMap, roleMap, language = "vi" } = {}) {
  const entity = String(log?.targetEntity || "").trim().toUpperCase()
  const hasTargetId =
    log?.targetId !== null && log?.targetId !== undefined && log?.targetId !== ""
  const targetId = hasTargetId ? Number(log.targetId) : null

  if (USER_ENTITIES.has(entity) && targetId !== null && Number.isFinite(targetId)) {
    const userName = resolveUserName(userMap, targetId)
    if (userName) return userName
  }

  if (ROLE_ENTITIES.has(entity) && targetId !== null && Number.isFinite(targetId)) {
    const roleName = resolveRoleName(roleMap, targetId, language)
    if (roleName) return roleName
  }

  const cleanedLabel = cleanAuditTargetLabel(log?.targetLabel)
  return cleanedLabel || "—"
}
