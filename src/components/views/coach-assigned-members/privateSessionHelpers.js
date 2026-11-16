import { parseVietnamDateTime } from "../../../utils/memberSafetyHelpers"

export function isPositiveInteger(val) {
  if (typeof val === "number") return Number.isInteger(val) && val > 0
  if (typeof val === "string") {
    const s = val.trim()
    if (!/^\d+$/.test(s)) return false
    const n = Number(s)
    return Number.isInteger(n) && n > 0
  }
  return false
}

export function generateRequestKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function isValidTimeFormat(val) {
  if (typeof val !== "string") return false
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(val.trim())
}

export function normalizeStrictTime(val) {
  if (!isValidTimeFormat(val)) return null
  const s = val.trim()
  return s.length === 5 ? `${s}:00` : s
}

export const STANDARD_PRIVATE_SESSION_SLOTS = [
  [1, "06:00", "07:30"],
  [2, "07:45", "09:15"],
  [3, "09:30", "11:00"],
  [4, "13:00", "14:30"],
  [5, "14:45", "16:15"],
  [6, "16:30", "18:00"],
  [7, "18:15", "19:45"],
]

export function isStandardPrivateSessionSlot(slot) {
  if (!slot) return false
  const slotNumber = Number(slot.slotNumber)
  const startTime = String(slot.startTime || "").slice(0, 5)
  const endTime = String(slot.endTime || "").slice(0, 5)
  return STANDARD_PRIVATE_SESSION_SLOTS.some(([number, start, end]) =>
    number === slotNumber && start === startTime && end === endTime,
  )
}

export function formatVietnamDateTime(val) {
  const ms = parseVietnamDateTime(val)
  if (Number.isNaN(ms)) return "—"
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms))
}

export function formatVietnamDateOnly(val) {
  const ms = parseVietnamDateTime(val)
  if (Number.isNaN(ms)) return "—"
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms))
}

export function getVietnamDatePlusDays(days = 2) {
  const now = new Date()
  const targetMs = now.getTime() + days * 24 * 60 * 60 * 1000
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(targetMs))
}

export function checkRegistrationEntitlement(item, currentUser) {
  if (!item) return { canBook: false, reason: "Dữ liệu đăng ký không tồn tại" }

  if (!isPositiveInteger(item.subscriptionId)) {
    return { canBook: false, reason: "Chưa liên kết gói tập" }
  }
  if (!isPositiveInteger(item.memberId)) {
    return { canBook: false, reason: "Mã học viên không hợp lệ" }
  }
  if (!isPositiveInteger(item.subjectId)) {
    return { canBook: false, reason: "Mã môn học không hợp lệ" }
  }
  if (!isPositiveInteger(item.primaryCoachId)) {
    return { canBook: false, reason: "Mã HLV phụ trách không hợp lệ" }
  }

  const currentCoachId = currentUser?.coachId ?? currentUser?.userId ?? currentUser?.id
  const coachNameMatches =
    !isPositiveInteger(currentUser?.coachId) &&
    item.primaryCoachName &&
    currentUser?.name &&
    String(item.primaryCoachName).trim().toLowerCase() ===
      String(currentUser.name).trim().toLowerCase()
  if (
    !coachNameMatches &&
    (!isPositiveInteger(currentCoachId) ||
      Number(item.primaryCoachId) !== Number(currentCoachId))
  ) {
    return { canBook: false, reason: "Không phải HLV phụ trách gói này" }
  }

  const st = String(item.subscriptionStatus || "").trim().toLowerCase()
  if (st !== "active") {
    return { canBook: false, reason: `Gói chưa kích hoạt (${item.subscriptionStatus || "Chờ xử lý"})` }
  }

  const credit = Number(item.remainingCredit)
  if (!Number.isInteger(credit) || credit < 1) {
    return { canBook: false, reason: "Hết số buổi khả dụng (0 credit)" }
  }

  const activatedMs = parseVietnamDateTime(item.activatedAt)
  if (Number.isNaN(activatedMs)) {
    return { canBook: false, reason: "Thiếu ngày kích hoạt gói" }
  }

  const expiresMs = parseVietnamDateTime(item.expiresAt)
  if (Number.isNaN(expiresMs)) {
    return { canBook: false, reason: "Thiếu ngày hết hạn gói" }
  }
  if (expiresMs <= Date.now()) {
    return { canBook: false, reason: "Gói tập đã hết hạn" }
  }

  return { canBook: true, reason: "" }
}

export function verifySessionResponseMatch(resp, payload, regItem) {
  if (!resp || typeof resp !== "object") {
    return { valid: false, reason: "Phản hồi không hợp lệ. Vui lòng thử lại." }
  }
  if (!isPositiveInteger(resp.id)) {
    return { valid: false, reason: "Không nhận được mã buổi tập hợp lệ. Vui lòng thử lại." }
  }

  // 1. Coach ID (bắt buộc có và khớp)
  if (resp.coachId === undefined || resp.coachId === null || Number(resp.coachId) !== Number(payload.coachId)) {
    return {
      valid: false,
      reason: `HLV xác nhận (#${resp.coachId ?? "thiếu"}) không khớp yêu cầu (#${payload.coachId}).`,
    }
  }

  // 2. Room ID (bắt buộc có và khớp)
  if (resp.roomId === undefined || resp.roomId === null || Number(resp.roomId) !== Number(payload.roomId)) {
    return {
      valid: false,
      reason: `Phòng tập xác nhận (#${resp.roomId ?? "thiếu"}) không khớp yêu cầu (#${payload.roomId}).`,
    }
  }

  // 3. Member ID (bắt buộc có bookedMemberId thật và khớp, bỏ hoàn toàn fallback memberId)
  if (resp.bookedMemberId === undefined || resp.bookedMemberId === null || !isPositiveInteger(resp.bookedMemberId)) {
    return {
      valid: false,
      reason: `Phản hồi xác nhận thiếu thông tin học viên (bookedMemberId).`,
    }
  }
  if (Number(resp.bookedMemberId) !== Number(regItem.memberId)) {
    return {
      valid: false,
      reason: `Học viên xác nhận (#${resp.bookedMemberId}) không khớp yêu cầu (#${regItem.memberId}).`,
    }
  }

  // 4. Subject ID (nếu yêu cầu có môn thì xác nhận phải khớp)
  if (payload.subjectId !== undefined && payload.subjectId !== null) {
    if (resp.subjectId === undefined || resp.subjectId === null || Number(resp.subjectId) !== Number(payload.subjectId)) {
      return {
        valid: false,
        reason: `Môn thể thao (#${resp.subjectId ?? "thiếu"}) không khớp yêu cầu (#${payload.subjectId}).`,
      }
    }
  }

  // 5. Session Date (bắt buộc có và khớp ngày)
  if (!resp.sessionDate || String(resp.sessionDate).slice(0, 10) !== String(payload.sessionDate).slice(0, 10)) {
    return {
      valid: false,
      reason: `Ngày tập xác nhận (${resp.sessionDate ?? "thiếu"}) không khớp yêu cầu (${payload.sessionDate}).`,
    }
  }

  // 6. Start Time (bắt buộc có và khớp giờ)
  if (
    !resp.startTime ||
    !isValidTimeFormat(resp.startTime) ||
    normalizeStrictTime(resp.startTime) !== normalizeStrictTime(payload.startTime)
  ) {
    return {
      valid: false,
      reason: `Giờ bắt đầu xác nhận (${resp.startTime ?? "thiếu"}) không khớp yêu cầu (${payload.startTime}).`,
    }
  }

  // 7. End Time (bắt buộc có và khớp giờ)
  if (
    !resp.endTime ||
    !isValidTimeFormat(resp.endTime) ||
    normalizeStrictTime(resp.endTime) !== normalizeStrictTime(payload.endTime)
  ) {
    return {
      valid: false,
      reason: `Giờ kết thúc xác nhận (${resp.endTime ?? "thiếu"}) không khớp yêu cầu (${payload.endTime}).`,
    }
  }

  // 8. isPrivate (bắt buộc phải là true)
  if (resp.isPrivate !== true) {
    return {
      valid: false,
      reason: "Buổi tập không được ghi nhận là ca tập riêng 1-kèm-1 (isPrivate phải là true).",
    }
  }

  // 9. Status (bắt buộc hiện diện và phải là Scheduled)
  if (!resp.status || typeof resp.status !== "string") {
    return {
      valid: false,
      reason: "Phản hồi xác nhận thiếu trạng thái buổi tập (status).",
    }
  }
  const st = resp.status.trim()
  if (st.toLowerCase() !== "scheduled") {
    return {
      valid: false,
      reason: `Trạng thái buổi tập không hợp lệ hoặc không khả dụng (${st}). Yêu cầu trạng thái 'Scheduled'.`,
    }
  }

  return { valid: true }
}
