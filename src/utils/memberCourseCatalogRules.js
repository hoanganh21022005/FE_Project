const SPORTS = [
  { key: 'tennis', aliases: ['tennis', 'quan vot', 'quần vợt'] },
  { key: 'swimming', aliases: ['swimming', 'boi loi', 'bơi lội'] },
  { key: 'pickleball', aliases: ['pickleball'] },
  { key: 'archery', aliases: ['archery', 'ban cung', 'bắn cung'] },
  { key: 'basketball', aliases: ['basketball', 'bong ro', 'bóng rổ'] },
  { key: 'football', aliases: ['football', 'soccer', 'bong da', 'bóng đá'] },
  { key: 'volleyball', aliases: ['volleyball', 'bong chuyen', 'bóng chuyền'] },
  { key: 'badminton', aliases: ['badminton', 'cau long', 'cầu lông'] },
  { key: 'table-tennis', aliases: ['table tennis', 'table-tennis', 'ping pong', 'bong ban', 'bóng bàn'] },
]

export const normalizeCatalogText = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/gi, 'd')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

const normalizeSlug = (value = '') => normalizeCatalogText(value).replace(/\s+/g, '-')
const isNumericId = (value) => Number.isInteger(Number(value)) && Number(value) > 0
export const hasSellablePrice = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0

export function resolveCatalogSubjects(subjects = []) {
  return SPORTS.map((sport) => {
    const candidates = subjects.filter((subject) => {
      const slug = normalizeSlug(subject?.slug || '')
      const text = normalizeCatalogText(`${subject?.name || ''} ${subject?.slug || ''}`)
      return sport.aliases.some((alias) => {
        const normalizedAlias = normalizeCatalogText(alias)
        if (sport.key === 'tennis' && text.includes('table tennis')) return false
        return text === normalizedAlias || text.split(' ').includes(normalizedAlias) || (normalizedAlias.includes(' ') && text.includes(normalizedAlias))
      }) || slug === sport.key
    })
    const canonical = candidates.filter((subject) => normalizeSlug(subject?.slug || '') === sport.key)
    const selected = canonical.length === 1 ? canonical[0] : canonical.length > 1 ? null : candidates.length === 1 ? candidates[0] : null
    const idValid = selected && isNumericId(selected.id)
    return {
      key: sport.key,
      subject: idValid ? selected : null,
      ambiguous: candidates.length > 1 && canonical.length !== 1,
      missing: candidates.length === 0,
      invalidId: Boolean(selected && !idValid),
    }
  })
}

const dateOf = (session) => session?.sessionDate ?? session?.date ?? session?.startDate ?? null
const timeOf = (session, keys) => keys.map((key) => session?.[key]).find((value) => typeof value === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) || null

export function verifyNormalCourseClass(courseClass, sessions, subjectId) {
  const reasons = []
  if (!courseClass || !isNumericId(courseClass.id)) reasons.push('Mã lớp không hợp lệ.')
  if (!isNumericId(subjectId) || String(courseClass?.subjectId) !== String(subjectId)) reasons.push('Lớp không thuộc môn đang chọn.')
  if (normalizeCatalogText(courseClass?.classType) !== 'normal') reasons.push('Không xác minh được đây là lớp Normal.')
  if (normalizeCatalogText(courseClass?.status) !== 'open') reasons.push('Lớp không ở trạng thái Open.')
  if (Number(courseClass?.totalSessions) !== 12) reasons.push('Lớp học chưa đủ điều kiện mở đăng ký (chưa đủ 12 buổi học).')
  const hasCapacity = courseClass?.maxCapacity !== null && courseClass?.maxCapacity !== undefined && courseClass?.maxCapacity !== ''
  const hasEnrollmentCount = courseClass?.enrolledCount !== null && courseClass?.enrolledCount !== undefined && courseClass?.enrolledCount !== ''
  const capacity = Number(courseClass?.maxCapacity)
  const enrolled = Number(courseClass?.enrolledCount)
  if (!hasCapacity || !hasEnrollmentCount || !Number.isFinite(capacity) || capacity <= 0 || !Number.isFinite(enrolled) || enrolled < 0) reasons.push('Thiếu dữ liệu sức chứa hoặc số học viên.')
  else if (enrolled >= capacity) reasons.push('Lớp đã đủ chỗ.')
  if (!hasSellablePrice(courseClass?.tuitionFee)) reasons.push('Lớp học chưa có thông tin học phí hợp lệ.')
  if (!Array.isArray(sessions) || sessions.length !== 12) reasons.push('Lịch lớp chưa xác minh đủ đúng 12 buổi.')
  else {
    const unique = new Set()
    const valid = sessions.every((session) => {
      const date = dateOf(session)
      const start = timeOf(session, ['startTime', 'startAt'])
      const end = timeOf(session, ['endTime', 'endAt'])
      if (!date || Number.isNaN(Date.parse(date)) || !start || !end) return false
      const status = normalizeCatalogText(session.status || 'scheduled')
      if (['cancelled', 'canceled', 'closed', 'deleted'].includes(status)) return false
      unique.add(`${date}|${start}|${end}`)
      return true
    })
    if (!valid || unique.size !== 12) reasons.push('Lịch lớp thiếu ngày/giờ hợp lệ hoặc có buổi trùng/hủy.')
  }
  return { eligible: reasons.length === 0, reasons }
}

export function coachMatchesSubject(coach, specialization) {
  const coachIds = [coach?.specializationId, ...(Array.isArray(coach?.specializationIds) ? coach.specializationIds : [])].filter(isNumericId).map(String)
  if (coachIds.includes(String(specialization?.id))) return true
  const coachNames = [coach?.specialization, coach?.specialty, ...(Array.isArray(coach?.specializations) ? coach.specializations : [])]
    .map((value) => typeof value === 'string' ? normalizeCatalogText(value) : normalizeCatalogText(value?.name || value?.specializationName || ''))
    .filter(Boolean)
  const specializationName = normalizeCatalogText(specialization?.name || specialization?.specialization || '')
  return specializationName ? coachNames.includes(specializationName) : false
}

export function coachIsActive(coach) {
  return normalizeCatalogText(coach?.status) === 'active' || coach?.active === true || coach?.isActive === true
}

// An active coach can be offered even when the optional capacity endpoint is
// unavailable. Explicit full/unavailable fields still take precedence.
export function coachCanUseUnknownCapacity(coach) {
  if (!coachIsActive(coach)) return false
  if (['inactive', 'unavailable', 'disabled', 'full'].includes(normalizeCatalogStatus(coach?.status))) return false
  const unavailableFlags = ['available', 'isAvailable', 'canAcceptNewMembers', 'acceptingNewMembers', 'canAccept']
  if (unavailableFlags.some((key) => coach?.[key] === false)) return false
  const fullFlags = ['isFull', 'full', 'atCapacity']
  if (fullFlags.some((key) => coach?.[key] === true)) return false
  const max = coach?.maxStudents ?? coach?.maxCapacity ?? coach?.capacity
  const used = coach?.currentStudents ?? coach?.currentMembers ?? coach?.activeMembers ?? coach?.currentMemberCount
  if (max != null && used != null && max !== '' && used !== '' && Number.isFinite(Number(max)) && Number.isFinite(Number(used)) && Number(max) > 0 && Number(used) >= Number(max)) return false
  return true
}

export function readAdmissionCapacity(capacity) {
  // API gateways may wrap the payload in one or more conventional envelopes.
  let payload = capacity
  for (let depth = 0; depth < 4; depth += 1) {
    const wrapped = ['data', 'result', 'payload', 'capacity', 'admissionCapacity'].find((key) =>
      payload?.[key] && typeof payload[key] === 'object' && !Array.isArray(payload[key]))
    if (!wrapped) break
    payload = payload[wrapped]
  }
  for (const key of ['canAcceptNewMembers', 'acceptingNewMembers', 'canAccept', 'available']) {
    if (typeof payload?.[key] === 'boolean') return { verified: true, available: payload[key] }
  }
  for (const key of ['remainingCapacity', 'availableCapacity', 'remainingSeats', 'availableSlots', 'remainingSlots', 'remainingStudents']) {
    if (payload?.[key] !== null && payload?.[key] !== undefined && payload[key] !== '' && Number.isFinite(Number(payload[key]))) {
      return { verified: true, available: Number(payload[key]) > 0, count: Number(payload[key]) }
    }
  }
  const maxValue = payload?.maxCapacity ?? payload?.maxStudents ?? payload?.capacity ?? payload?.capacityLimit
  const usedValue = payload?.currentMembers ?? payload?.activeMembers ?? payload?.currentMemberCount ?? payload?.currentStudents ?? payload?.enrolledCount
  const max = Number(maxValue)
  const used = Number(usedValue)
  if (maxValue !== null && maxValue !== undefined && maxValue !== '' && usedValue !== null && usedValue !== undefined && usedValue !== '' && Number.isFinite(max) && max > 0 && Number.isFinite(used) && used >= 0) {
    return { verified: true, available: max > used, count: Math.max(0, max - used) }
  }
  return { verified: false, available: false, count: null }
}

export const normalizeCatalogStatus = (value) => normalizeCatalogText(value).replace(/\s+/g, '_')
