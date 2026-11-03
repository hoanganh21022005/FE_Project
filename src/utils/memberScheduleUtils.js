// ============================================================================
// CẤU HÌNH NGHIỆP VỤ DÙNG CHUNG (Khóa học, Lịch học, Điểm danh Member)
// ============================================================================
// [Cần xác nhận #1] Completed có nghĩa là buổi đã diễn ra (true) hay hội viên đã có mặt
export const COMPLETED_MEANS_SESSION_HELD = true

// [Cần xác nhận #2] Khung thời gian cho phép điểm danh: từ 30 phút trước giờ bắt đầu đến giờ kết thúc
export const CHECKIN_WINDOW_MINUTES_BEFORE = 30

// [Cần xác nhận #3] Báo vắng được phép trước giờ học tối thiểu 2 giờ
export const ABSENCE_MIN_HOURS_BEFORE = 2

// Số giờ quy định phải hủy trước giờ bắt đầu buổi PT 1-kèm-1 để được hoàn 1 credit
export const PT_CANCEL_REFUND_HOURS_BEFORE = 12

// [Cần xác nhận #3] Chỉ hiển thị banner kỳ nghỉ khi có kỳ nghỉ bắt đầu trong vòng 14 ngày tới
export const COURSE_TAB_HOLIDAY_LOOKAHEAD_DAYS = 14

// Số buổi thực học bắt buộc mặc định của lớp Normal
export const DEFAULT_NORMAL_REQUIRED_SESSIONS = 12

// Số lượng kỳ nghỉ hiển thị mặc định trên banner trước khi bấm "Xem tất cả"
export const DEFAULT_VISIBLE_HOLIDAY_GROUPS = 3

// Số ngày tối đa kể từ ngày diễn ra buổi tập cho phép gửi đánh giá (chỉ dùng khi API không trả hạn)
export const FEEDBACK_DEADLINE_DAYS = 14

export const VN_TIMEZONE = "Asia/Ho_Chi_Minh"

// ============================================================================
// HÀM ĐỊNH DẠNG NGÀY / GIỜ / MÚI GIỜ (Luôn dùng dd/MM/yyyy & HH:mm, Asia/Ho_Chi_Minh)
// ============================================================================
const DATE_FORMATTER_DDMMYYYY = new Intl.DateTimeFormat("en-GB", {
  timeZone: VN_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

export const TIME_FORMATTER_HHMM = new Intl.DateTimeFormat("en-GB", {
  timeZone: VN_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

const DATE_ISO_VN_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: VN_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export const getTodayIsoInVn = (nowMs = Date.now()) => {
  return DATE_ISO_VN_FORMATTER.format(new Date(nowMs))
}

export const toDateDdMmYyyy = (value) => {
  if (!value) return null
  const raw = String(value).trim()
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnlyMatch) {
    const utcNoon = new Date(
      `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}T12:00:00+07:00`,
    )
    if (!Number.isNaN(utcNoon.getTime())) {
      return DATE_FORMATTER_DDMMYYYY.format(utcNoon)
    }
  }
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return DATE_FORMATTER_DDMMYYYY.format(parsed)
}

export const toDateDdMm = (value) => {
  const full = toDateDdMmYyyy(value)
  if (!full) return null
  return full.slice(0, 5)
}

export const toDateTimeDdMmYyyy = (value) => {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return `${DATE_FORMATTER_DDMMYYYY.format(parsed)} ${TIME_FORMATTER_HHMM.format(parsed)}`
}

export const formatLocalTime = (timeVal) => {
  if (!timeVal) return "—"
  if (typeof timeVal === "string") {
    const trimmed = timeVal.trim()
    const match = trimmed.match(/^(\d{1,2}):(\d{2})/)
    if (match) {
      return `${match[1].padStart(2, "0")}:${match[2]}`
    }
    return trimmed.slice(0, 5)
  }
  if (typeof timeVal === "object" && timeVal.hour !== undefined) {
    return `${String(timeVal.hour).padStart(2, "0")}:${String(
      timeVal.minute || 0,
    ).padStart(2, "0")}`
  }
  return String(timeVal)
}

// Định dạng chuẩn dùng chung cho ngày và khung giờ buổi tập: "dd/MM/yyyy · HH:mm–HH:mm"
export const formatSessionDateTimeSlot = (sessionDate, startTime, endTime) => {
  const dateStr = toDateDdMmYyyy(sessionDate) || "—"
  const startStr = formatLocalTime(startTime)
  const endStr = formatLocalTime(endTime)
  if (startStr !== "—" && endStr !== "—") {
    return `${dateStr} · ${startStr}–${endStr}`
  }
  if (startStr !== "—") {
    return `${dateStr} · ${startStr}`
  }
  return dateStr
}

export const getSessionTimestampRange = (sessionDate, startTime, endTime) => {
  const dateStr = String(sessionDate || "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { startMs: null, endMs: null }
  }
  const startHhMm = /^\d{2}:\d{2}$/.test(formatLocalTime(startTime))
    ? formatLocalTime(startTime)
    : "00:00"
  const endHhMm = /^\d{2}:\d{2}$/.test(formatLocalTime(endTime))
    ? formatLocalTime(endTime)
    : "23:59"
  const startMs = new Date(`${dateStr}T${startHhMm}:00+07:00`).getTime()
  const endMs = new Date(`${dateStr}T${endHhMm}:00+07:00`).getTime()
  return {
    startMs: Number.isFinite(startMs) ? startMs : null,
    endMs: Number.isFinite(endMs) ? endMs : null,
  }
}

export const diffCalendarDaysInVn = (fromIsoDate, toIsoDate) => {
  if (!fromIsoDate || !toIsoDate) return null
  const a = new Date(`${String(fromIsoDate).slice(0, 10)}T00:00:00+07:00`)
  const b = new Date(`${String(toIsoDate).slice(0, 10)}T00:00:00+07:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export const getWeekdayKeyFromIsoDate = (isoDate) => {
  const dateStr = String(isoDate || "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  const d = new Date(`${dateStr}T12:00:00+07:00`)
  if (Number.isNaN(d.getTime())) return null
  const day = d.getUTCDay()
  const keys = [
    "scheduleDaySun",
    "scheduleDayMon",
    "scheduleDayTue",
    "scheduleDayWed",
    "scheduleDayThu",
    "scheduleDayFri",
    "scheduleDaySat",
  ]
  return { order: day === 0 ? 7 : day, key: keys[day] }
}

// ============================================================================
// [Cần xác nhận #5] CHUẨN HÓA DỮ LIỆU SESSION TỪ OPENAPI Ở MỘT NƠI DUY NHẤT
// ============================================================================
export const normalizeScheduleSession = (raw, fallback = {}) => {
  if (!raw || typeof raw !== "object") return null
  const sessionDate = String(raw.sessionDate ?? raw.date ?? "").slice(0, 10)
  const startTime = formatLocalTime(raw.startTime)
  const endTime = formatLocalTime(raw.endTime)
  const { startMs, endMs } = getSessionTimestampRange(
    sessionDate,
    startTime,
    endTime,
  )
  return {
    id: raw.id ?? raw.sessionId ?? null,
    classId: raw.classId ?? fallback.classId ?? null,
    className: raw.className ?? fallback.className ?? null,
    subjectId: raw.subjectId ?? fallback.subjectId ?? null,
    subjectName: raw.subjectName ?? fallback.subjectName ?? null,
    coachId: raw.coachId ?? fallback.coachId ?? null,
    coachName: raw.coachName ?? fallback.coachName ?? null,
    roomId: raw.roomId ?? fallback.roomId ?? null,
    roomName: raw.roomName ?? raw.roomLocation ?? fallback.roomName ?? null,
    roomLocation: raw.roomLocation ?? null,
    sessionDate,
    startTime,
    endTime,
    startMs,
    endMs,
    rawStatus: String(raw.status ?? "").trim(),
    centerInvalidated: Boolean(raw.centerInvalidated),
    makeupForSessionId:
      raw.makeupForSessionId != null && raw.makeupForSessionId !== ""
        ? Number(raw.makeupForSessionId)
        : null,
    creditReturned: Boolean(raw.creditReturned),
    deadlineAfter: raw.deadlineAfter ?? raw.creditDeadline ?? null,
    remainingCredits:
      raw.remainingCredits ?? raw.creditsRemaining ?? raw.ptCreditsLeft ?? null,
    cancelCutoffHours:
      Number(raw.cancelCutoffHours) > 0 ? Number(raw.cancelCutoffHours) : null,
    isPrivate: raw.isPrivate === true,
    bookedMemberId: raw.bookedMemberId ?? null,
    canFeedback:
      raw.canFeedback ??
      raw.canReview ??
      raw.feedbackEligible ??
      raw.eligibleForFeedback ??
      null,
    feedbackDeadline:
      raw.feedbackDeadline ??
      raw.reviewDeadline ??
      raw.feedbackExpiresAt ??
      null,
    feedbackDeadlineDays:
      raw.feedbackDeadlineDays ??
      raw.remainingFeedbackDays ??
      raw.deadlineDays ??
      null,
  }
}

// ============================================================================
// MÔ HÌNH TRẠNG THÁI BUỔI HỌC & KHÓA HỌC
// ============================================================================
export const computeSessionDisplayStatus = (session, nowMs = Date.now()) => {
  const rawLower = String(session?.rawStatus || session?.status || "")
    .trim()
    .toLowerCase()
  if (
    rawLower === "cancelled" ||
    rawLower === "canceled" ||
    session?.centerInvalidated === true
  ) {
    return "cancelled"
  }
  if (COMPLETED_MEANS_SESSION_HELD && rawLower === "completed") {
    return "completed"
  }
  if (
    session?.startMs !== null &&
    session?.endMs !== null &&
    nowMs >= session.startMs &&
    nowMs <= session.endMs
  ) {
    return "ongoing"
  }
  return "upcoming"
}

export const getSessionStatusBadgeMeta = (statusKey, t) => {
  switch (statusKey) {
    case "completed":
      return {
        icon: "✓",
        label: t("scheduleStatusCompleted"),
        className: "bg-emerald-50 text-emerald-800 border-emerald-200",
      }
    case "ongoing":
      return {
        icon: "●",
        label: t("scheduleStatusOngoing"),
        className: "bg-blue-50 text-blue-800 border-blue-200",
      }
    case "cancelled":
      return {
        icon: "✕",
        label: t("scheduleStatusCancelled"),
        className: "bg-rose-50 text-rose-800 border-rose-200",
      }
    case "upcoming":
    default:
      return {
        icon: "○",
        label: t("scheduleStatusUpcoming"),
        className: "bg-slate-100 text-slate-800 border-slate-300",
      }
  }
}

export const getCourseLifecycleBadge = (lifecycleStatus, t) => {
  if (lifecycleStatus === "completed") {
    return {
      label: t("scheduleCourseCompleted"),
      className: "bg-emerald-50 text-emerald-800 border-emerald-200",
    }
  }
  if (lifecycleStatus === "not_started") {
    return {
      label: t("scheduleCourseNotStarted"),
      className: "bg-amber-50 text-amber-900 border-amber-200",
    }
  }
  return {
    label: t("scheduleCourseInProgress"),
    className: "bg-blue-50 text-blue-800 border-blue-200",
  }
}

export const translatePaymentStatus = (rawPaymentStatus, t) => {
  const key = String(rawPaymentStatus || "")
    .trim()
    .toLowerCase()
  if (key === "successful" || key === "paid")
    return t("schedulePaySuccessful")
  if (key === "pending" || key === "pending_payment")
    return t("schedulePayPending")
  if (key === "failed") return t("schedulePayFailed")
  if (key === "cancelled" || key === "canceled")
    return t("schedulePayCancelled")
  return rawPaymentStatus
}

export const isLegacyStrengthClass = (enrollment) =>
  String(enrollment?.className || "")
    .trim()
    .toLocaleLowerCase("vi") === "gym suc manh"

export const isActiveNormalEnrollment = (enrollment) => {
  if (!enrollment || typeof enrollment !== "object") return false
  const status = String(
    enrollment.status || enrollment.enrollmentStatus || "",
  )
    .trim()
    .toLowerCase()
  if (["cancelled", "canceled", "dropped", "rejected"].includes(status)) {
    return false
  }
  return !isLegacyStrengthClass(enrollment)
}

// Gộp các ngày nghỉ liên tiếp cùng một kỳ nghỉ, bỏ năm trong tên nếu ngày đã có năm
export const buildUpcomingHolidayGroups = (
  holidays = [],
  todayIso = getTodayIsoInVn(),
  defaultHolidayName = "Nghỉ lễ",
) => {
  const cleanBaseName = (rawName) => {
    if (!rawName) return defaultHolidayName
    return (
      String(rawName)
        .replace(/\s*[-–—(]?\s*\b20\d{2}\b\s*\)?$/g, "")
        .replace(/\s*[-–—(]?\s*(?:ngày|day)\s*\d+\s*\)?$/i, "")
        .replace(/\s*[-–—(]?\s*\b20\d{2}\b\s*\)?$/g, "")
        .replace(/\s+\b20\d{2}\b/g, "")
        .trim() || defaultHolidayName
    )
  }

  const upcoming = (Array.isArray(holidays) ? holidays : [])
    .filter((h) => h && h.active !== false && h.holidayDate)
    .map((h) => ({
      ...h,
      isoDate: String(h.holidayDate).slice(0, 10),
      baseName: cleanBaseName(h.holidayName),
    }))
    .filter((h) => h.isoDate >= todayIso)
    .sort((a, b) => a.isoDate.localeCompare(b.isoDate))

  const groups = []
  for (const item of upcoming) {
    const last = groups[groups.length - 1]
    const diff = last ? diffCalendarDaysInVn(last.endIso, item.isoDate) : null
    if (last && last.baseName === item.baseName && diff !== null && diff <= 1) {
      last.endIso = item.isoDate
      last.dates.push(item.isoDate)
    } else {
      groups.push({
        id: item.id || item.isoDate,
        baseName: item.baseName,
        startIso: item.isoDate,
        endIso: item.isoDate,
        dates: [item.isoDate],
      })
    }
  }

  return groups.map((g) => {
    const startFull = toDateDdMmYyyy(g.startIso)
    const endFull = toDateDdMmYyyy(g.endIso)
    const startYear = String(g.startIso).slice(0, 4)
    const endYear = String(g.endIso).slice(0, 4)
    const dateLabel =
      g.startIso === g.endIso
        ? startFull
        : startYear === endYear
          ? `${toDateDdMm(g.startIso)} – ${endFull}`
          : `${startFull} – ${endFull}`
    return {
      ...g,
      dateLabel,
      daysUntilStart: diffCalendarDaysInVn(todayIso, g.startIso) ?? 999,
    }
  })
}

// Danh sách tất cả các ngày nghỉ từ hôm nay trở đi (mỗi chip định dạng dd/MM/yyyy)
export const buildAllUpcomingHolidayChips = (
  holidays = [],
  todayIso = getTodayIsoInVn(),
  defaultHolidayName = "Nghỉ lễ",
) => {
  const cleanChipName = (rawName) => {
    if (!rawName) return defaultHolidayName
    return (
      String(rawName)
        .replace(/\s*[-–—(]?\s*\b20\d{2}\b\s*\)?$/g, "")
        .replace(/\s+\b20\d{2}\b/g, "")
        .trim() || defaultHolidayName
    )
  }

  return (Array.isArray(holidays) ? holidays : [])
    .filter((h) => h && h.active !== false && h.holidayDate)
    .map((h) => {
      const isoDate = String(h.holidayDate).slice(0, 10)
      return {
        id: h.id ? `chip-${h.id}` : `chip-${isoDate}`,
        baseName: cleanChipName(h.holidayName),
        startIso: isoDate,
        endIso: isoDate,
        dateLabel: toDateDdMmYyyy(isoDate),
      }
    })
    .filter((h) => h.startIso >= todayIso)
    .sort((a, b) => a.startIso.localeCompare(b.startIso))
}

// Chuẩn hóa và tính toán toàn bộ dữ liệu cho từng khóa Normal
export const buildCourseScheduleModel = (
  enrollment,
  allSessions = [],
  holidayDateSet = new Set(),
  nowMs = Date.now(),
  t,
) => {
  const inline =
    enrollment.sessions ||
    enrollment.classSessions ||
    enrollment.scheduledSessions
  const rawList =
    Array.isArray(inline) && inline.length > 0
      ? inline
      : enrollment.classId && Array.isArray(allSessions)
        ? allSessions.filter(
            (s) =>
              String(s.classId) === String(enrollment.classId) &&
              s.isPrivate !== true,
          )
        : []

  const normalized = rawList
    .map((s) => normalizeScheduleSession(s, enrollment))
    .filter(Boolean)
    .sort((a, b) => {
      const dateCmp = a.sessionDate.localeCompare(b.sessionDate)
      if (dateCmp !== 0) return dateCmp
      return String(a.startTime).localeCompare(String(b.startTime))
    })

  const requiredSessions =
    Number(enrollment.totalSessions || enrollment.requiredSessions) > 0
      ? Number(enrollment.totalSessions || enrollment.requiredSessions)
      : DEFAULT_NORMAL_REQUIRED_SESSIONS

  const withStatus = normalized.map((s) => ({
    ...s,
    displayStatus: computeSessionDisplayStatus(s, nowMs),
    hasHolidayConflict: false,
    isMakeup: Boolean(s.makeupForSessionId),
    makeupTargetDate: null,
    replacedByDate: null,
  }))

  const byId = new Map(withStatus.map((s) => [Number(s.id), s]))
  const cancelledSessions = withStatus.filter(
    (s) => s.displayStatus === "cancelled",
  )
  const validSessions = withStatus.filter(
    (s) => s.displayStatus !== "cancelled",
  )

  // 1. Liên kết trực tiếp qua makeupForSessionId từ Backend
  const linkedCancelledIds = new Set()
  for (const s of validSessions) {
    if (s.makeupForSessionId && byId.has(Number(s.makeupForSessionId))) {
      const target = byId.get(Number(s.makeupForSessionId))
      s.isMakeup = true
      s.makeupTargetDate = toDateDdMmYyyy(target.sessionDate)
      target.replacedByDate = toDateDdMmYyyy(s.sessionDate)
      linkedCancelledIds.add(Number(target.id))
    }
  }

  // 2. Dự phòng khi lớp có bản ghi buổi bù cuối khóa nhưng thiếu makeupForSessionId
  const unlinkedCancelled = cancelledSessions.filter(
    (c) => !linkedCancelledIds.has(Number(c.id)) && !c.replacedByDate,
  )
  if (
    unlinkedCancelled.length > 0 &&
    withStatus.length > requiredSessions &&
    validSessions.length > requiredSessions - cancelledSessions.length
  ) {
    const candidateMakeups = validSessions
      .filter((s) => !s.isMakeup)
      .slice(-unlinkedCancelled.length)
    unlinkedCancelled.forEach((cancelledItem, idx) => {
      const makeupItem = candidateMakeups[idx]
      if (makeupItem && makeupItem.sessionDate > cancelledItem.sessionDate) {
        makeupItem.isMakeup = true
        makeupItem.makeupForSessionId =
          makeupItem.makeupForSessionId || cancelledItem.id
        makeupItem.makeupTargetDate = toDateDdMmYyyy(cancelledItem.sessionDate)
        cancelledItem.replacedByDate = toDateDdMmYyyy(makeupItem.sessionDate)
      }
    })
  }

  // Kiểm tra trùng ngày nghỉ lễ cho các buổi hợp lệ chưa học
  for (const s of validSessions) {
    if (
      s.displayStatus !== "completed" &&
      s.sessionDate &&
      holidayDateSet.has(s.sessionDate)
    ) {
      s.hasHolidayConflict = true
    }
  }

  const completedCount = validSessions.filter(
    (s) => s.displayStatus === "completed",
  ).length
  const progressPercent = Math.min(
    100,
    Math.round((completedCount / requiredSessions) * 100),
  )
  const pendingMakeupCount = Math.max(0, requiredSessions - validSessions.length)

  const replacedCancelledSessions = cancelledSessions.filter((c) =>
    Boolean(c.replacedByDate),
  )
  const replacedCancelledCount = replacedCancelledSessions.length
  const replacedMakeupDates = [
    ...new Set(
      replacedCancelledSessions.map((c) => c.replacedByDate).filter(Boolean),
    ),
  ]

  // "Khai giảng" lấy ngày của buổi đầu tiên theo lịch gốc, kể cả khi buổi đó bị hủy
  const firstOriginalSession = withStatus[0] || null
  const firstValidSession = validSessions[0] || null
  const startDateFormatted = firstOriginalSession
    ? toDateDdMmYyyy(firstOriginalSession.sessionDate)
    : toDateDdMmYyyy(enrollment.startDate)

  let lifecycleStatus = "in_progress"
  if (completedCount >= requiredSessions) {
    lifecycleStatus = "completed"
  } else if (
    completedCount === 0 &&
    firstValidSession?.startMs &&
    firstValidSession.startMs > nowMs
  ) {
    lifecycleStatus = "not_started"
  }

  const basePatternSessions = validSessions.filter((s) => !s.isMakeup)
  const patternSource =
    basePatternSessions.length > 0 ? basePatternSessions : validSessions
  const weekdayMap = new Map()
  for (const s of patternSource) {
    const wk = getWeekdayKeyFromIsoDate(s.sessionDate)
    if (wk && !weekdayMap.has(wk.order)) {
      weekdayMap.set(wk.order, t(wk.key))
    }
  }
  const sortedWeekdays = [...weekdayMap.entries()]
  sortedWeekdays.sort((a, b) => a[0] - b[0])
  const weekdayLabels = sortedWeekdays.map((entry) => entry[1])
  const sampleTimeSession = patternSource[0] || withStatus[0]
  const timeRangeStr =
    sampleTimeSession &&
    sampleTimeSession.startTime !== "—" &&
    sampleTimeSession.endTime !== "—"
      ? `${sampleTimeSession.startTime}–${sampleTimeSession.endTime}`
      : null
  const fixedScheduleLabel =
    weekdayLabels.length > 0 && timeRangeStr
      ? `${weekdayLabels.join(" & ")} · ${timeRangeStr}`
      : timeRangeStr || null

  const primaryRoom =
    validSessions.find((s) => s.roomName)?.roomName ||
    withStatus.find((s) => s.roomName)?.roomName ||
    enrollment.roomName ||
    null

  const primaryCoach =
    enrollment.coachName ||
    validSessions.find((s) => s.coachName)?.coachName ||
    withStatus.find((s) => s.coachName)?.coachName ||
    null

  const nextValidSession =
    validSessions.find(
      (s) =>
        s.displayStatus === "ongoing" ||
        (s.displayStatus === "upcoming" &&
          (s.endMs === null || s.endMs >= nowMs)),
    ) || null

  if (nextValidSession) {
    nextValidSession.isNextSession = true
  }

  const completedValidList = validSessions.filter(
    (s) => s.displayStatus === "completed",
  )
  const latestCompletedSession =
    completedValidList.length > 0
      ? completedValidList[completedValidList.length - 1]
      : null

  const todayIso = getTodayIsoInVn(nowMs)
  const futureSessionsForPreview = withStatus.filter((s) => {
    if (s.displayStatus === "completed") return false
    if (
      nextValidSession &&
      (s === nextValidSession ||
        (s.id != null &&
          nextValidSession.id != null &&
          String(s.id) === String(nextValidSession.id)) ||
        (s.sessionDate === nextValidSession.sessionDate &&
          s.startTime === nextValidSession.startTime))
    ) {
      return false
    }
    if (s.displayStatus === "ongoing") return true
    if (s.displayStatus === "cancelled") {
      return s.startMs !== null ? s.startMs > nowMs : s.sessionDate > todayIso
    }
    return s.endMs === null ? s.sessionDate >= todayIso : s.endMs >= nowMs
  })

  const previewSessions = [
    ...(latestCompletedSession ? [latestCompletedSession] : []),
    ...futureSessionsForPreview.slice(0, 3),
  ].sort((a, b) => {
    const dateCmp = String(a.sessionDate || "").localeCompare(
      String(b.sessionDate || ""),
    )
    if (dateCmp !== 0) return dateCmp
    return String(a.startTime || "").localeCompare(String(b.startTime || ""))
  })

  return {
    ...enrollment,
    allSessions: withStatus,
    validSessions,
    requiredSessions,
    completedCount,
    progressPercent,
    pendingMakeupCount,
    replacedCancelledCount,
    replacedMakeupDates,
    lifecycleStatus,
    startDateFormatted,
    fixedScheduleLabel,
    primaryRoom,
    primaryCoach,
    nextValidSession,
    previewSessions,
  }
}

export const getHoursUntilSession = (session, nowMs = Date.now()) => {
  if (session?.startMs) {
    return (session.startMs - nowMs) / (1000 * 60 * 60)
  }
  const { startMs } = getSessionTimestampRange(
    session?.sessionDate || session?.date,
    session?.startTime,
    session?.endTime,
  )
  if (!startMs) return null
  return (startMs - nowMs) / (1000 * 60 * 60)
}

export const canReportAbsenceForNormalSession = (session, nowMs = Date.now()) => {
  if (!session) return false
  if (
    session.displayStatus === "cancelled" ||
    session.displayStatus === "completed" ||
    session.displayStatus === "ongoing"
  ) {
    return false
  }
  const hoursLeft = getHoursUntilSession(session, nowMs)
  return hoursLeft !== null && hoursLeft >= ABSENCE_MIN_HOURS_BEFORE
}
