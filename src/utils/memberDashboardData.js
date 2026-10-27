const ACTIVE_ENROLLMENT_STATES = new Set(["registered", "active", "confirmed"])
const ATTENDED_STATES = new Set(["present", "late"])

export const normalizeState = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")

export const isActiveNormalEnrollment = (enrollment) => {
  if (!enrollment || typeof enrollment !== "object") return false
  const type = normalizeState(enrollment.packageType || enrollment.classType)
  if (type.includes("advanced")) return false
  return ACTIVE_ENROLLMENT_STATES.has(normalizeState(enrollment.status))
}

export const isActiveAdvancedSubscription = (subscription) => {
  if (!subscription || typeof subscription !== "object") return false
  const type = normalizeState(subscription.packageType)
  return (
    type.includes("advanced") &&
    normalizeState(subscription.status) === "active"
  )
}

export const getSessionStart = (session) => {
  if (!session?.sessionDate || !session?.startTime) return null
  const date = String(session.sessionDate).slice(0, 10)
  const time = String(session.startTime).slice(0, 12)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}/.test(time)) {
    return null
  }
  return `${date}T${time}`
}

export const getUpcomingSessions = (sessions, memberId, nowKey) => {
  if (!Array.isArray(sessions) || memberId === null || memberId === undefined) {
    return []
  }

  const seen = new Set()
  return sessions
    .filter((session) => {
      if (!session || normalizeState(session.status) !== "scheduled")
        return false
      const ownedByMember =
        session.__ownerVerified === true ||
        String(session.bookedMemberId ?? "") === String(memberId)
      const start = getSessionStart(session)
      if (!ownedByMember || !start || start <= nowKey) return false
      const key = String(session.id ?? `${session.classId}:${start}`)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => getSessionStart(a).localeCompare(getSessionStart(b)))
}

export const getAttendedCount = (attendances, memberId) => {
  if (
    !Array.isArray(attendances) ||
    memberId === null ||
    memberId === undefined
  ) {
    return null
  }
  return attendances.filter(
    (attendance) =>
      String(attendance?.memberId ?? "") === String(memberId) &&
      ATTENDED_STATES.has(
        normalizeState(attendance?.state ?? attendance?.status),
      ),
  ).length
}

export const getActiveAdvancedCreditCount = (subscriptions) => {
  if (!Array.isArray(subscriptions)) return null
  const active = subscriptions.filter(isActiveAdvancedSubscription)
  if (active.length === 0) return 0
  if (
    active.some(
      (subscription) => {
        const rawCredit = subscription.remainingCredit
        if (
          rawCredit === null ||
          rawCredit === undefined ||
          (typeof rawCredit !== "number" && typeof rawCredit !== "string") ||
          (typeof rawCredit === "string" && rawCredit.trim() === "")
        ) {
          return true
        }
        const credit = Number(rawCredit)
        return !Number.isInteger(credit) || credit < 0
      },
    )
  ) {
    return null
  }
  return active.reduce(
    (total, subscription) => total + Number(subscription.remainingCredit),
    0,
  )
}

export const getVietnamLocalDateTimeKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  )
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`
}

export const toTimestamp = (value) => {
  if (!value) return null
  let raw = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) raw = `${raw}T00:00:00`
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)
  const timestamp = Date.parse(hasZone ? raw : `${raw}+07:00`)
  return Number.isFinite(timestamp) ? timestamp : null
}

export const formatVietnamDateTime = (
  dateValue,
  timeValue,
  locale = "vi-VN",
) => {
  if (!dateValue) return ""
  const raw = timeValue
    ? `${String(dateValue).slice(0, 10)}T${String(timeValue).slice(0, 12)}`
    : String(dateValue)
  const timestamp = toTimestamp(raw)
  if (timestamp === null) return ""
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: timeValue ? "2-digit" : undefined,
    minute: timeValue ? "2-digit" : undefined,
  }).format(timestamp)
}

export const isPayablePendingInvoice = (invoice, now = Date.now()) =>
  normalizeState(invoice?.paymentStatus) === "pending" &&
  toTimestamp(invoice?.expiresAt) !== null &&
  toTimestamp(invoice.expiresAt) > now

export const isSubscriptionNearExpiry = (
  subscription,
  now = Date.now(),
  horizonMs = 7 * 24 * 60 * 60 * 1000,
) => {
  if (!isActiveAdvancedSubscription(subscription)) return false
  const expiresAt = toTimestamp(subscription.expiresAt || subscription.endDate)
  return expiresAt !== null && expiresAt > now && expiresAt - now <= horizonMs
}
