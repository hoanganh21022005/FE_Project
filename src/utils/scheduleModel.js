// ============================================================================
// MÔ HÌNH DỮ LIỆU CHUẨN HÓA CHO TRANG "LỊCH HỌC CỦA TÔI" (MEMBER)
// Múi giờ chuẩn: Asia/Ho_Chi_Minh, định dạng ngày dd/MM/yyyy, tuần bắt đầu Thứ Hai
// ============================================================================

export const VN_TIMEZONE = "Asia/Ho_Chi_Minh"
export const ABSENCE_MIN_HOURS_BEFORE = 2
export const PT_CANCEL_REFUND_HOURS_BEFORE = 12
export const HOLIDAY_LOOKAHEAD_DAYS = 30

export const DEFAULT_TIME_SLOTS = [
  { slotNumber: 1, name: "Ca 1", startTime: "06:00", endTime: "07:30", outdoorAllowed: true },
  { slotNumber: 2, name: "Ca 2", startTime: "07:45", endTime: "09:15", outdoorAllowed: true },
  { slotNumber: 3, name: "Ca 3", startTime: "09:30", endTime: "11:00", outdoorAllowed: true },
  { slotNumber: 4, name: "Ca 4", startTime: "11:15", endTime: "12:45", outdoorAllowed: false },
  { slotNumber: 5, name: "Ca 5", startTime: "13:00", endTime: "14:30", outdoorAllowed: false },
  { slotNumber: 6, name: "Ca 6", startTime: "14:45", endTime: "16:15", outdoorAllowed: true },
  { slotNumber: 7, name: "Ca 7", startTime: "16:30", endTime: "18:00", outdoorAllowed: true },
  { slotNumber: 8, name: "Ca 8", startTime: "18:15", endTime: "19:45", outdoorAllowed: true },
]

const DATE_ISO_VN_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: VN_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const DATE_DDMMYYYY_VN_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: VN_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

const TIME_HHMM_VN_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: VN_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

export function toNowMs(now = Date.now()) {
  if (typeof now === "number" && Number.isFinite(now)) return now
  if (now instanceof Date && !Number.isNaN(now.getTime())) return now.getTime()
  if (typeof now === "string") {
    const parsed = new Date(now).getTime()
    if (Number.isFinite(parsed)) return parsed
  }
  return Date.now()
}

export function getVnTodayIso(now = Date.now()) {
  return DATE_ISO_VN_FMT.format(new Date(toNowMs(now)))
}

export function formatHhMm(value) {
  if (!value) return "—"
  if (typeof value === "string") {
    const trimmed = value.trim()
    const match = trimmed.match(/^(\d{1,2}):(\d{2})/)
    if (match) {
      return `${match[1].padStart(2, "0")}:${match[2]}`
    }
    return trimmed.slice(0, 5)
  }
  if (typeof value === "object" && value.hour !== undefined) {
    return `${String(value.hour).padStart(2, "0")}:${String(value.minute || 0).padStart(2, "0")}`
  }
  const d = new Date(value)
  if (!Number.isNaN(d.getTime())) {
    return TIME_HHMM_VN_FMT.format(d)
  }
  return String(value)
}

export function toDdMmYyyy(isoOrDate) {
  if (!isoOrDate) return "—"
  const raw = String(isoOrDate).trim()
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    return `${m[3]}/${m[2]}/${m[1]}`
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return DATE_DDMMYYYY_VN_FMT.format(d)
}

export function toDdMm(isoOrDate) {
  const full = toDdMmYyyy(isoOrDate)
  if (!full || full === "—") return "—"
  return full.slice(0, 5)
}

export function toDateTimeDdMmYyyy(value) {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return `${DATE_DDMMYYYY_VN_FMT.format(d)} ${TIME_HHMM_VN_FMT.format(d)}`
}

export function addDaysIso(isoDate, deltaDays) {
  const base = String(isoDate || "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return base
  const d = new Date(`${base}T12:00:00+07:00`)
  d.setUTCDate(d.getUTCDate() + Number(deltaDays || 0))
  return DATE_ISO_VN_FMT.format(d)
}

export function diffDaysVn(fromIso, toIso) {
  if (!fromIso || !toIso) return null
  const a = new Date(`${String(fromIso).slice(0, 10)}T00:00:00+07:00`)
  const b = new Date(`${String(toIso).slice(0, 10)}T00:00:00+07:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export function getWeekdayMeta(isoDate) {
  const clean = String(isoDate || "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return {
      order: 1,
      shortVi: "—",
      shortEn: "—",
      fullVi: "—",
      fullEn: "—",
    }
  }
  const d = new Date(`${clean}T12:00:00+07:00`)
  const day = d.getUTCDay() // 0 = Sun, 1 = Mon ... 6 = Sat
  const map = {
    1: { order: 1, shortVi: "T2", shortEn: "Mon", fullVi: "Thứ Hai", fullEn: "Monday" },
    2: { order: 2, shortVi: "T3", shortEn: "Tue", fullVi: "Thứ Ba", fullEn: "Tuesday" },
    3: { order: 3, shortVi: "T4", shortEn: "Wed", fullVi: "Thứ Tư", fullEn: "Wednesday" },
    4: { order: 4, shortVi: "T5", shortEn: "Thu", fullVi: "Thứ Năm", fullEn: "Thursday" },
    5: { order: 5, shortVi: "T6", shortEn: "Fri", fullVi: "Thứ Sáu", fullEn: "Friday" },
    6: { order: 6, shortVi: "T7", shortEn: "Sat", fullVi: "Thứ Bảy", fullEn: "Saturday" },
    0: { order: 7, shortVi: "CN", shortEn: "Sun", fullVi: "Chủ Nhật", fullEn: "Sunday" },
  }
  return map[day] || map[1]
}

/**
 * Tính khoảng tuần (Thứ Hai -> Chủ Nhật) theo múi giờ Asia/Ho_Chi_Minh
 */
export function getWeekRange(dateInput = Date.now()) {
  let targetIso
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateInput.trim())) {
    targetIso = dateInput.trim().slice(0, 10)
  } else {
    targetIso = getVnTodayIso(dateInput)
  }

  const wk = getWeekdayMeta(targetIso)
  const offsetToMonday = -(wk.order - 1)
  const mondayIso = addDaysIso(targetIso, offsetToMonday)
  const sundayIso = addDaysIso(mondayIso, 6)

  const days = []
  for (let i = 0; i < 7; i++) {
    const dateIso = addDaysIso(mondayIso, i)
    const meta = getWeekdayMeta(dateIso)
    days.push({
      dateIso,
      dayOfMonth: dateIso.slice(8, 10),
      ddMm: toDdMm(dateIso),
      ddMmYyyy: toDdMmYyyy(dateIso),
      ...meta,
    })
  }

  const startYear = mondayIso.slice(0, 4)
  const endYear = sundayIso.slice(0, 4)
  const label =
    startYear === endYear
      ? `${toDdMm(mondayIso)} – ${toDdMmYyyy(sundayIso)}`
      : `${toDdMmYyyy(mondayIso)} – ${toDdMmYyyy(sundayIso)}`

  return {
    mondayIso,
    sundayIso,
    days,
    label,
  }
}

export function normalizeTimeSlots(rawSlots = []) {
  const source =
    Array.isArray(rawSlots) && rawSlots.length > 0 ? rawSlots : DEFAULT_TIME_SLOTS
  return source
    .map((slot, idx) => {
      const slotNumber = Number(slot.slotNumber ?? slot.id ?? idx + 1)
      const startTime = formatHhMm(slot.startTime)
      const endTime = formatHhMm(slot.endTime)
      return {
        slotNumber,
        name: slot.name || `Ca ${slotNumber}`,
        startTime,
        endTime,
        outdoorAllowed: slot.outdoorAllowed !== false,
        displayName:
          slot.displayName || `Ca ${slotNumber} (${startTime}–${endTime})`,
      }
    })
    .sort((a, b) => a.slotNumber - b.slotNumber)
}

export function inferSlotNumber(startTime, endTime, normalizedSlots = DEFAULT_TIME_SLOTS) {
  const start = formatHhMm(startTime)
  const end = formatHhMm(endTime)
  if (!start || start === "—") return "other"

  const exact = normalizedSlots.find(
    (s) => s.startTime === start && (!end || end === "—" || s.endTime === end),
  )
  if (exact) return exact.slotNumber

  const byStart = normalizedSlots.find((s) => s.startTime === start)
  if (byStart) return byStart.slotNumber

  return "other"
}

export function getSessionTimestampMs(dateIso, startTime, endTime) {
  const cleanDate = String(dateIso || "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    return { startMs: null, endMs: null }
  }
  const sTime = /^\d{2}:\d{2}$/.test(formatHhMm(startTime))
    ? formatHhMm(startTime)
    : "00:00"
  const eTime = /^\d{2}:\d{2}$/.test(formatHhMm(endTime))
    ? formatHhMm(endTime)
    : "23:59"
  const startMs = new Date(`${cleanDate}T${sTime}:00+07:00`).getTime()
  const endMs = new Date(`${cleanDate}T${eTime}:00+07:00`).getTime()
  return {
    startMs: Number.isFinite(startMs) ? startMs : null,
    endMs: Number.isFinite(endMs) ? endMs : null,
  }
}

function normalizeCanonicalStatus(rawStatus, centerInvalidated = false) {
  const lower = String(rawStatus || "").trim().toLowerCase()
  if (centerInvalidated || lower === "cancelled" || lower === "canceled") {
    return "Cancelled"
  }
  if (lower === "completed" || lower === "done") {
    return "Completed"
  }
  return "Scheduled"
}

function normalizeAttendanceValue(rawAtt) {
  if (!rawAtt) return null
  const val = String(
    typeof rawAtt === "object"
      ? rawAtt.status || rawAtt.state || rawAtt.attendanceStatus || ""
      : rawAtt,
  )
    .trim()
    .toUpperCase()
  if (val === "PRESENT" || val === "CHECKED_IN" || val === "ATTENDED") return "Present"
  if (val === "LATE") return "Late"
  if (val === "EXCUSED") return "Excused"
  if (val === "ABSENT" || val === "NO_SHOW") return "Absent"
  return null
}

/**
 * Gộp buổi nhóm (group) + buổi PT 1:1 (pt) thành MỘT mảng phẳng chuẩn hóa.
 * Mọi số đếm và bộ lọc trên trang đều dùng chung mảng này.
 */
export function buildScheduleItems({
  groupSessions = [],
  ptSessions = [],
  enrollments = [],
  attendances = [],
  absenceNotices = {},
  holidays = [],
  timeSlots = DEFAULT_TIME_SLOTS,
  now = Date.now(),
} = {}) {
  const nowMs = toNowMs(now)
  const normalizedSlots = normalizeTimeSlots(timeSlots)

  // Map holiday date -> holidayName
  const holidayMap = new Map()
  if (Array.isArray(holidays)) {
    for (const h of holidays) {
      if (h && h.active !== false && h.holidayDate) {
        const dIso = String(h.holidayDate).slice(0, 10)
        holidayMap.set(dIso, h.holidayName || "Nghỉ lễ")
      }
    }
  } else if (holidays instanceof Map) {
    for (const [k, v] of holidays.entries()) {
      holidayMap.set(String(k).slice(0, 10), v)
    }
  }

  // Map enrollment by classId for fallback metadata
  const enrollmentByClassId = new Map()
  if (Array.isArray(enrollments)) {
    for (const enr of enrollments) {
      const cid = enr?.classId ?? enr?.sportsClassId
      if (cid != null) {
        enrollmentByClassId.set(String(cid), enr)
      }
    }
  }

  // Map attendance by sessionId
  const attendanceBySessionId = new Map()
  if (Array.isArray(attendances)) {
    for (const att of attendances) {
      const sid = att?.sessionId ?? att?.id
      if (sid != null) {
        const normAtt = normalizeAttendanceValue(att)
        if (normAtt) attendanceBySessionId.set(String(sid), normAtt)
      }
    }
  } else if (attendances && typeof attendances === "object") {
    for (const [sid, val] of Object.entries(attendances)) {
      const normAtt = normalizeAttendanceValue(val)
      if (normAtt) attendanceBySessionId.set(String(sid), normAtt)
    }
  }

  // Map absenceNotice by sessionId
  const noticeBySessionId = new Map()
  if (Array.isArray(absenceNotices)) {
    for (const n of absenceNotices) {
      const sid = n?.sessionId
      if (sid != null && n.active !== false) {
        noticeBySessionId.set(String(sid), {
          status: n.status || "ACTIVE",
          reason: n.reason || "",
          createdAt: n.reportedAt || n.createdAt || null,
        })
      }
    }
  } else if (absenceNotices && typeof absenceNotices === "object") {
    for (const [sid, n] of Object.entries(absenceNotices)) {
      if (!n) continue
      const item = Array.isArray(n) ? n.find((x) => x && x.active !== false) || n[0] : n
      if (item && item.active !== false) {
        noticeBySessionId.set(String(sid), {
          status: item.status || "ACTIVE",
          reason: item.reason || "",
          createdAt: item.reportedAt || item.createdAt || null,
        })
      }
    }
  }

  // Group sessions by classId to compute sessionNumber / totalSessions & makeup links
  const groupByClass = new Map()
  for (const raw of Array.isArray(groupSessions) ? groupSessions : []) {
    if (!raw || typeof raw !== "object") continue
    const cid = String(raw.classId ?? "unknown")
    if (!groupByClass.has(cid)) groupByClass.set(cid, [])
    groupByClass.get(cid).push(raw)
  }

  const classSessionMeta = new Map()
  for (const [cid, list] of groupByClass.entries()) {
    const enr = enrollmentByClassId.get(cid)
    const sorted = [...list].sort((a, b) => {
      const da = String(a.sessionDate ?? a.date ?? "").slice(0, 10)
      const db = String(b.sessionDate ?? b.date ?? "").slice(0, 10)
      if (da !== db) return da.localeCompare(db)
      return formatHhMm(a.startTime).localeCompare(formatHhMm(b.startTime))
    })

    const byId = new Map()
    for (const s of sorted) {
      const sid = s.id ?? s.sessionId
      if (sid != null) byId.set(Number(sid), s)
    }

    const totalSessions =
      Number(enr?.totalSessions || enr?.requiredSessions) > 0
        ? Number(enr.totalSessions || enr.requiredSessions)
        : sorted.length

    sorted.forEach((s, idx) => {
      const sid = s.id ?? s.sessionId
      if (sid == null) return
      let makeupTargetDate = null
      let replacedByDate = null
      if (s.makeupForSessionId && byId.has(Number(s.makeupForSessionId))) {
        const target = byId.get(Number(s.makeupForSessionId))
        makeupTargetDate = toDdMmYyyy(target.sessionDate ?? target.date)
      }
      const replacingSession = sorted.find(
        (other) =>
          other.makeupForSessionId != null &&
          Number(other.makeupForSessionId) === Number(sid),
      )
      if (replacingSession) {
        replacedByDate = toDdMmYyyy(
          replacingSession.sessionDate ?? replacingSession.date,
        )
      }
      classSessionMeta.set(String(sid), {
        sessionNumber: s.sessionNumber ?? idx + 1,
        totalSessions: s.totalSessions ?? totalSessions,
        makeupTargetDate,
        replacedByDate,
      })
    })
  }

  const seenKeys = new Set()
  const result = []

  const processRaw = (raw, kind) => {
    if (!raw || typeof raw !== "object") return
    const rawId = raw.id ?? raw.sessionId
    const date = String(raw.sessionDate ?? raw.date ?? "").slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return

    const startTime = formatHhMm(raw.startTime)
    const endTime = formatHhMm(raw.endTime)
    const dedupeKey =
      rawId != null
        ? `${kind}-id-${rawId}`
        : `${kind}-${raw.classId || "pt"}-${date}-${startTime}`
    if (seenKeys.has(dedupeKey)) return
    seenKeys.add(dedupeKey)

    const cid = raw.classId != null ? String(raw.classId) : null
    const enr = cid ? enrollmentByClassId.get(cid) : null
    const meta = rawId != null ? classSessionMeta.get(String(rawId)) : null

    const centerInvalidated = Boolean(raw.centerInvalidated)
    const status = normalizeCanonicalStatus(raw.status ?? raw.rawStatus, centerInvalidated)
    const { startMs, endMs } = getSessionTimestampMs(date, startTime, endTime)

    const slotNumber =
      raw.slotNumber != null && Number.isFinite(Number(raw.slotNumber))
        ? Number(raw.slotNumber)
        : inferSlotNumber(startTime, endTime, normalizedSlots)

    const sidStr = rawId != null ? String(rawId) : null
    const absenceNotice =
      (sidStr && noticeBySessionId.get(sidStr)) ||
      (raw.absenceNotice && raw.absenceNotice.active !== false
        ? {
            status: raw.absenceNotice.status || "ACTIVE",
            reason: raw.absenceNotice.reason || "",
            createdAt:
              raw.absenceNotice.reportedAt || raw.absenceNotice.createdAt || null,
          }
        : null)

    const rawAttendance =
      (sidStr && attendanceBySessionId.get(sidStr)) ||
      normalizeAttendanceValue(raw.attendance ?? raw.attendanceStatus)
    const attendance = status === "Completed" ? rawAttendance || "Present" : null

    // Xác định trạng thái hiển thị chi tiết (uiState)
    let uiState = "upcoming"
    if (status === "Cancelled") {
      uiState = "cancelled"
    } else if (status === "Completed") {
      uiState = attendance === "Absent" ? "completed_absent" : "completed_present"
    } else {
      // status === 'Scheduled'
      if (startMs !== null && endMs !== null && nowMs >= startMs && nowMs <= endMs) {
        uiState = "ongoing"
      } else if (endMs !== null && nowMs > endMs) {
        // Quá giờ mà BE chưa chuyển Completed -> "Chờ cập nhật", KHÔNG đếm vào Sắp tới
        uiState = "pending_update"
      } else if (absenceNotice) {
        uiState = "upcoming_absence_reported"
      } else {
        uiState = "upcoming"
      }
    }

    const hoursUntilStart =
      startMs !== null ? (startMs - nowMs) / (1000 * 60 * 60) : null
    const cutoffHours =
      Number(raw.cancelCutoffHours) > 0
        ? Number(raw.cancelCutoffHours)
        : PT_CANCEL_REFUND_HOURS_BEFORE
    const refundDeadlineMs =
      startMs !== null ? startMs - cutoffHours * 60 * 60 * 1000 : null

    // Quy tắc nghiệp vụ đã xác nhận:
    // Chỉ buổi PT 1:1 (Advanced, kind === 'pt') mới có Báo vắng & Hủy lịch hoàn credit.
    // Lớp nhóm (Normal, kind === 'group') lịch cố định, nghỉ là mất buổi (trừ khi trung tâm hủy).
    const canReportAbsence =
      kind === "pt" &&
      status === "Scheduled" &&
      uiState !== "ongoing" &&
      uiState !== "pending_update" &&
      hoursUntilStart !== null &&
      hoursUntilStart >= ABSENCE_MIN_HOURS_BEFORE

    const isPtReportAbsenceExpired =
      kind === "pt" &&
      status === "Scheduled" &&
      hoursUntilStart !== null &&
      hoursUntilStart > 0 &&
      hoursUntilStart < ABSENCE_MIN_HOURS_BEFORE

    const canCancelPt =
      kind === "pt" &&
      status === "Scheduled" &&
      hoursUntilStart !== null &&
      hoursUntilStart > 0

    const canCancelPtForRefund =
      canCancelPt &&
      (refundDeadlineMs !== null
        ? nowMs <= refundDeadlineMs
        : hoursUntilStart >= cutoffHours)

    const cancelReason =
      raw.cancelReason ||
      (status === "Cancelled"
        ? centerInvalidated
          ? "center_invalidated"
          : "cancelled"
        : null)

    const sportName =
      raw.subjectName ||
      raw.sportName ||
      enr?.subjectName ||
      (kind === "pt" ? "PT 1:1" : "Lớp nhóm")

    const className =
      raw.className ||
      enr?.className ||
      (kind === "pt" ? `${sportName} · PT 1:1` : sportName)

    result.push({
      id: rawId ?? dedupeKey,
      rawId: rawId ?? null,
      kind, // 'group' | 'pt'
      classId: cid,
      date,
      startTime,
      endTime,
      startMs,
      endMs,
      slotNumber,
      className,
      sportName,
      roomName: raw.roomName || raw.roomLocation || enr?.roomName || null,
      coachName: raw.coachName || enr?.coachName || null,
      status, // 'Scheduled' | 'Completed' | 'Cancelled'
      uiState,
      cancelReason,
      centerInvalidated,
      isMakeup: Boolean(raw.makeupForSessionId),
      makeupForSessionId: raw.makeupForSessionId ?? null,
      makeupTargetDate: meta?.makeupTargetDate || null,
      replacedByDate: meta?.replacedByDate || null,
      absenceNotice,
      attendance, // 'Present' | 'Late' | 'Excused' | 'Absent' | null
      sessionNumber: raw.sessionNumber ?? meta?.sessionNumber ?? null,
      totalSessions: raw.totalSessions ?? meta?.totalSessions ?? null,
      holidayName: holidayMap.get(date) || null,
      canReportAbsence,
      isPtReportAbsenceExpired,
      canCancelPt,
      canCancelPtForRefund,
      cancelCutoffHours: cutoffHours,
      ptRefundDeadlineFormatted:
        refundDeadlineMs !== null
          ? toDateTimeDdMmYyyy(new Date(refundDeadlineMs).toISOString())
          : null,
      creditReturned: Boolean(raw.creditReturned),
      deadlineAfterFormatted: raw.deadlineAfter
        ? toDdMmYyyy(raw.deadlineAfter)
        : null,
    })
  }

  for (const s of Array.isArray(groupSessions) ? groupSessions : []) {
    processRaw(s, "group")
  }
  for (const s of Array.isArray(ptSessions) ? ptSessions : []) {
    processRaw(s, "pt")
  }

  result.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return String(a.startTime).localeCompare(String(b.startTime))
  })

  return result
}

/**
 * Bộ đếm duy nhất cho toàn trang (tab, thống kê tuần, huy hiệu).
 * - Sắp tới (upcoming) = Scheduled và chưa quá giờ (upcoming, upcoming_absence_reported, ongoing). KHÔNG gồm Cancelled.
 * - Đã học (done) = Completed và có mặt (Present/Late/Excused).
 * - Vắng mặt (absent) = Completed nhưng vắng mặt (Absent).
 * - Đã hủy (cancelled) = Cancelled.
 * - Chuyên cần (attendanceRate) = Đã học / (Đã học + Vắng). Nếu (Đã học + Vắng) === 0 -> null (hiển thị '–').
 */
export function getCounts(items = []) {
  let upcoming = 0
  let done = 0
  let absent = 0
  let cancelled = 0
  let pendingUpdate = 0

  for (const item of Array.isArray(items) ? items : []) {
    if (!item) continue
    if (item.status === "Cancelled") {
      cancelled += 1
    } else if (item.status === "Completed") {
      if (item.attendance === "Absent") {
        absent += 1
      } else {
        done += 1
      }
    } else if (item.status === "Scheduled") {
      if (item.uiState === "pending_update") {
        pendingUpdate += 1
      } else {
        upcoming += 1
      }
    }
  }

  const totalCompleted = done + absent
  const attendanceRate =
    totalCompleted > 0 ? Math.round((done / totalCompleted) * 100) : null

  return {
    upcoming,
    done,
    absent,
    cancelled,
    pendingUpdate,
    attendedDone: done,
    totalCompleted,
    attendanceRate,
  }
}

/**
 * Lọc danh sách buổi học theo loại (all | group | pt), tab trạng thái (upcoming | done | absent | cancelled), và khoảng ngày.
 */
export function filterItems(
  items = [],
  { type = "all", statusTab = null, range = null, classId = "all", coachFilter = "all" } = {},
) {
  let filtered = Array.isArray(items) ? [...items] : []

  if (type === "group" || type === "pt") {
    filtered = filtered.filter((item) => item.kind === type)
  }

  if (classId && classId !== "all") {
    filtered = filtered.filter(
      (item) => String(item.classId) === String(classId),
    )
  }

  if (coachFilter && coachFilter !== "all") {
    filtered = filtered.filter(
      (item) => String(item.coachName || "") === String(coachFilter),
    )
  }

  if (range && range.startIso && range.endIso) {
    filtered = filtered.filter(
      (item) => item.date >= range.startIso && item.date <= range.endIso,
    )
  }

  if (statusTab === "upcoming") {
    filtered = filtered.filter(
      (item) =>
        item.status === "Scheduled" && item.uiState !== "pending_update",
    )
    // Sắp tới: gần nhất trước
    filtered.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return String(a.startTime).localeCompare(String(b.startTime))
    })
  } else if (statusTab === "done") {
    filtered = filtered.filter(
      (item) =>
        (item.status === "Completed" && item.attendance !== "Absent") ||
        item.uiState === "pending_update",
    )
    // Đã học: mới nhất trước
    filtered.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return String(b.startTime).localeCompare(String(a.startTime))
    })
  } else if (statusTab === "absent") {
    filtered = filtered.filter(
      (item) => item.status === "Completed" && item.attendance === "Absent",
    )
    // Vắng mặt: mới nhất trước
    filtered.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return String(b.startTime).localeCompare(String(a.startTime))
    })
  } else if (statusTab === "cancelled") {
    filtered = filtered.filter((item) => item.status === "Cancelled")
    filtered.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return String(b.startTime).localeCompare(String(a.startTime))
    })
  }

  return filtered
}

/**
 * Tìm buổi Scheduled sắp diễn ra gần nhất (hoặc đang diễn ra) cho NextSessionCard
 */
export function findNextUpcomingItem(items = []) {
  const candidates = (Array.isArray(items) ? items : []).filter(
    (item) =>
      item.status === "Scheduled" &&
      (item.uiState === "ongoing" ||
        item.uiState === "upcoming" ||
        item.uiState === "upcoming_absence_reported"),
  )
  candidates.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return String(a.startTime).localeCompare(String(b.startTime))
  })
  return candidates[0] || null
}

/**
 * Tìm ngày Thứ Hai của tuần gần nhất có buổi học (tính từ sau afterSundayIso)
 */
export function findNextWeekWithSessions(items = [], afterSundayIso) {
  const future = (Array.isArray(items) ? items : [])
    .filter((item) => item.date > afterSundayIso && item.status !== "Cancelled")
    .sort((a, b) => a.date.localeCompare(b.date))
  if (future.length === 0) return null
  return getWeekRange(future[0].date).mondayIso
}

/**
 * Nhóm danh sách buổi học theo ngày và mốc thời gian (Hôm nay / Ngày mai / Tuần này / Tuần sau / Tháng X)
 */
export function groupByDay(items = [], { now = Date.now() } = {}) {
  const todayIso = getVnTodayIso(now)
  const tomorrowIso = addDaysIso(todayIso, 1)
  const currentWeek = getWeekRange(todayIso)
  const nextWeek = getWeekRange(addDaysIso(currentWeek.sundayIso, 1))

  const dayMap = new Map()
  for (const item of Array.isArray(items) ? items : []) {
    if (!item?.date) continue
    if (!dayMap.has(item.date)) {
      dayMap.set(item.date, [])
    }
    dayMap.get(item.date).push(item)
  }

  const getBucketMeta = (dateIso) => {
    if (dateIso === todayIso) {
      return { key: "today", type: "today" }
    }
    if (dateIso === tomorrowIso) {
      return { key: "tomorrow", type: "tomorrow" }
    }
    if (dateIso >= currentWeek.mondayIso && dateIso <= currentWeek.sundayIso) {
      return { key: "this_week", type: "this_week" }
    }
    if (dateIso >= nextWeek.mondayIso && dateIso <= nextWeek.sundayIso) {
      return { key: "next_week", type: "next_week" }
    }
    const [yyyy, mm] = dateIso.split("-")
    return {
      key: `month_${yyyy}_${mm}`,
      type: "month",
      month: Number(mm),
      year: Number(yyyy),
    }
  }

  const dayGroups = []
  for (const [dateIso, dayItems] of dayMap.entries()) {
    const wk = getWeekdayMeta(dateIso)
    const bucket = getBucketMeta(dateIso)
    dayGroups.push({
      dateIso,
      dayOfMonth: dateIso.slice(8, 10),
      ddMm: toDdMm(dateIso),
      ddMmYyyy: toDdMmYyyy(dateIso),
      isToday: dateIso === todayIso,
      weekday: wk,
      bucket,
      holidayName: dayItems.find((x) => x.holidayName)?.holidayName || null,
      items: dayItems,
    })
  }

  return dayGroups
}

/**
 * Tổng hợp danh sách "Gói của tôi" (Lớp Normal + Gói PT) cho cột phải.
 * Các lớp/gói chưa có buổi lên lịch chỉ nằm ở đây, không làm rác lưới lịch hay danh sách buổi học.
 */
export function buildPackageSummaries({
  enrollments = [],
  subscriptions = [],
  advancedRegistrations = [],
  scheduleItems = [],
} = {}) {
  const packages = []

  // 1. Các khóa học nhóm Normal đã đăng ký
  for (const enr of Array.isArray(enrollments) ? enrollments : []) {
    if (!enr || typeof enr !== "object") continue
    const st = String(enr.status || enr.enrollmentStatus || "").trim().toLowerCase()
    if (["cancelled", "canceled", "dropped", "rejected"].includes(st)) continue

    const cid = enr.classId ?? enr.sportsClassId
    const classItems = scheduleItems.filter(
      (item) => item.kind === "group" && String(item.classId) === String(cid),
    )
    const validItems = classItems.filter((item) => item.status !== "Cancelled")
    const completedCount = validItems.filter(
      (item) => item.status === "Completed",
    ).length
    const upcomingCount = validItems.filter(
      (item) => item.status === "Scheduled" && item.uiState !== "pending_update",
    ).length
    const totalSessions =
      Number(enr.totalSessions || enr.requiredSessions) > 0
        ? Number(enr.totalSessions || enr.requiredSessions)
        : Math.max(validItems.length, 12)

    packages.push({
      id: `course-${cid || enr.id}`,
      kind: "group",
      classId: cid,
      title: enr.className || enr.subjectName || `#${cid}`,
      sportName: enr.subjectName || "Lớp nhóm",
      completedSessions: completedCount,
      totalSessions,
      scheduledCount: validItems.length,
      upcomingCount,
      hasSchedule: validItems.length > 0,
      expiryDate: enr.endDate ? toDdMmYyyy(enr.endDate) : null,
      status: st || "active",
    })
  }

  // 2. Các gói PT 1:1 / đăng ký HLV chuyên sâu
  const ptItems = scheduleItems.filter(
    (item) => item.kind === "pt" && item.status !== "Cancelled",
  )
  const ptCompletedCount = ptItems.filter(
    (item) => item.status === "Completed",
  ).length
  const ptUpcomingCount = ptItems.filter(
    (item) => item.status === "Scheduled" && item.uiState !== "pending_update",
  ).length

  const seenPtIds = new Set()
  for (const reg of Array.isArray(advancedRegistrations)
    ? advancedRegistrations
    : []) {
    if (!reg || typeof reg !== "object") continue
    const st = String(reg.status || reg.orderStatus || "").trim().toUpperCase()
    if (["REJECTED", "DECLINED", "CANCELLED", "CANCELED", "EXPIRED"].includes(st))
      continue

    const total = Number(reg.totalSessions || reg.totalCredits || 12)
    const remaining =
      reg.remainingCredits != null
        ? Number(reg.remainingCredits)
        : Math.max(0, total - ptCompletedCount)
    const used = Math.max(0, total - remaining)

    const key = `adv-${reg.id || reg.subjectId}`
    seenPtIds.add(key)
    packages.push({
      id: key,
      kind: "pt",
      title:
        reg.packageName ||
        (reg.subjectName ? `${reg.subjectName} 1:1` : "Gói PT 1:1"),
      sportName: reg.subjectName || "PT 1:1",
      coachName: reg.primaryCoachName || reg.coachName || null,
      completedSessions: used,
      totalSessions: total,
      remainingCredits: remaining,
      scheduledCount: ptItems.length,
      upcomingCount: ptUpcomingCount,
      hasSchedule: ptUpcomingCount > 0 || ptItems.length > 0,
      expiryDate:
        reg.expiresAt || reg.endDate
          ? toDdMmYyyy(reg.expiresAt || reg.endDate)
          : null,
      status: st.toLowerCase(),
    })
  }

  // Nếu có buổi PT hoặc gói subscription PT mà chưa nằm trong advancedRegistrations
  for (const sub of Array.isArray(subscriptions) ? subscriptions : []) {
    if (!sub || typeof sub !== "object") continue
    const st = String(sub.status || "").trim().toLowerCase()
    if (!["active", "grace_period"].includes(st)) continue
    const total = Number(sub.totalCredits ?? sub.totalSessions ?? 0)
    const remaining = sub.remainingCredits ?? sub.creditsRemaining
    if (total <= 0 && remaining == null && ptItems.length === 0) continue

    const effectiveTotal = total > 0 ? total : Math.max(12, ptItems.length)
    const effectiveRemaining =
      remaining != null
        ? Number(remaining)
        : Math.max(0, effectiveTotal - ptCompletedCount)
    const used = Math.max(0, effectiveTotal - effectiveRemaining)

    packages.push({
      id: `sub-${sub.subscriptionId || sub.id}`,
      kind: "pt",
      title: sub.packageName || "Gói PT 1:1",
      sportName: sub.subjectName || "PT 1:1",
      completedSessions: used,
      totalSessions: effectiveTotal,
      remainingCredits: effectiveRemaining,
      scheduledCount: ptItems.length,
      upcomingCount: ptUpcomingCount,
      hasSchedule: ptUpcomingCount > 0 || ptItems.length > 0,
      expiryDate:
        sub.endDate || sub.expiresAt
          ? toDdMmYyyy(sub.endDate || sub.expiresAt)
          : null,
      status: st,
    })
  }

  return packages
}

/**
 * Lọc danh sách ngày nghỉ lễ trong 30 ngày tới và toàn bộ trong năm
 */
export function buildHolidaysSummary(holidays = [], now = Date.now()) {
  const todayIso = getVnTodayIso(now)
  const limitIso = addDaysIso(todayIso, HOLIDAY_LOOKAHEAD_DAYS)

  const allUpcoming = (Array.isArray(holidays) ? holidays : [])
    .filter((h) => h && h.active !== false && h.holidayDate)
    .map((h) => {
      const dateIso = String(h.holidayDate).slice(0, 10)
      return {
        id: h.id || dateIso,
        dateIso,
        ddMm: toDdMm(dateIso),
        ddMmYyyy: toDdMmYyyy(dateIso),
        name: String(h.holidayName || "Nghỉ lễ")
          .replace(/\s*[-–—(]?\s*\b20\d{2}\b\s*\)?$/g, "")
          .trim(),
        daysUntil: diffDaysVn(todayIso, dateIso) ?? 999,
      }
    })
    .filter((h) => h.dateIso >= todayIso)
    .sort((a, b) => a.dateIso.localeCompare(b.dateIso))

  const next30Days = allUpcoming.filter((h) => h.dateIso <= limitIso)

  return {
    next30Days,
    allUpcoming,
  }
}
