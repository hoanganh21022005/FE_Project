import { asNumber } from "./mappers.js"

export const STAFF_ROLE_MAP = {
  // Coach
  coach: "coach",
  "huấn luyện viên": "coach",
  "huấn luyện": "coach",

  // Receptionist
  receptionist: "receptionist",
  "lễ tân": "receptionist",

  // CenterManager / Manager
  centermanager: "manager",
  manager: "manager",
  "quản lý": "manager",

  // Admin
  admin: "admin",
  "quản trị viên": "admin",
  "quản trị": "admin",
}

export function normalizeStaffRole(role = "") {
  if (!role) return ""
  const r = String(role).trim().toLowerCase()
  return STAFF_ROLE_MAP[r] || r
}

export function formatStaffRoleForBe(role = "") {
  const normalized = normalizeStaffRole(role)
  if (normalized === "coach") return "Coach"
  if (normalized === "receptionist") return "Receptionist"
  if (normalized === "manager") return "CenterManager"
  if (normalized === "admin") return "Admin"
  return role ? String(role).trim() : "Coach"
}

export function normalizeStaffStatus(status, fallback = "active") {
  if (!status) return fallback
  const s = String(status).trim().toLowerCase()
  if (["active", "hoạt động"].includes(s)) return "active"
  if (["locked", "suspended", "đã khóa", "tạm khóa"].includes(s))
    return "locked"
  if (["inactive", "không hoạt động"].includes(s)) return "inactive"
  return s
}

/**
 * Maps StaffResponse from BE to frontend staff model.
 * Preserves numeric ID, maps specialization, role, and active class count.
 */
const NAME_VI_CORRECTIONS = {
  "Tran Thi Huong": "Trần Thị Hương",
  "Le Minh Khoa": "Lê Minh Khoa",
  "Pham Thi Lan": "Phạm Thị Lan",
  "Do Thi Mai": "Đỗ Thị Mai",
  "Vu Van Nam": "Vũ Văn Nam",
  "Nguyen Van An": "Nguyễn Văn An",
}

export function mapStaff(dto) {
  if (!dto || typeof dto !== "object") return null

  const id = asNumber(dto.id)
  const rawStatus = dto.status || "Active"
  const rawRole = dto.role || dto.roleName || "Staff"
  const role = normalizeStaffRole(rawRole)
  const specialization = dto.specialization
    ? String(dto.specialization).trim()
    : ""
  const rawName = dto.name
    ? String(dto.name).trim()
    : dto.fullName
      ? String(dto.fullName).trim()
      : ""
  const name = NAME_VI_CORRECTIONS[rawName] || rawName

  return {
    id,
    code: dto.code || (id ? `STF-${String(id).padStart(3, "0")}` : "STF-NEW"),
    name,
    email: dto.email ? String(dto.email).trim() : "",
    phone: dto.phone ? String(dto.phone).trim() : "",
    role,
    beRole: rawRole,
    specialization,
    specializationVi: dto.specializationVi || specialization,
    specialty: specialization, // Backward-compatible alias for existing views
    status: normalizeStaffStatus(rawStatus, "active"),
    rawStatus,
    activeClassesCount: asNumber(dto.activeClassesCount) || 0,
  }
}

/**
 * Creates StaffRequest payload for POST /api/staff and PUT /api/staff/{id}.
 * Required: name, email, role.
 */
export function toStaffRequest(input = {}) {
  const name = String(input.name || "").trim()
  const email = String(input.email || "").trim()
  const rawRole = input.role || input.beRole

  if (!name) {
    throw new Error("Họ và tên nhân viên là bắt buộc.")
  }
  if (!email) {
    throw new Error("Địa chỉ email nhân viên là bắt buộc.")
  }
  if (!rawRole || !String(rawRole).trim()) {
    throw new Error("Vai trò nhân viên là bắt buộc.")
  }

  const role = formatStaffRoleForBe(rawRole)

  const payload = {
    name,
    email,
    role,
  }

  if (
    input.phone !== undefined &&
    input.phone !== null &&
    String(input.phone).trim()
  ) {
    payload.phone = String(input.phone).trim()
  }
  const spec = input.specialization || input.specialty
  if (spec !== undefined && spec !== null && String(spec).trim()) {
    payload.specialization = String(spec).trim()
  }

  return payload
}
