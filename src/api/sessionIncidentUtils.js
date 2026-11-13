import { isValidDate } from './holidayUtils.js'

export function localDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addDays(dateString, days) {
  if (!isValidDate(dateString)) return ''
  const [year, month, day] = dateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return localDateString(date)
}

export function normalizeTime(value) {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3] ?? 0)
  if (hours > 23 || minutes > 59 || seconds > 59) return null
  return `${match[1]}:${match[2]}:${String(seconds).padStart(2, '0')}`
}

export function createRescheduleRequestKey(sessionId) {
  const cryptoApi = globalThis.crypto
  let uuid = cryptoApi?.randomUUID?.()
  if (!uuid && cryptoApi?.getRandomValues) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
    uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  if (!uuid) throw new Error('A secure request key could not be created.')
  const key = `reschedule:${sessionId}:${uuid}`
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(key)) throw new Error('The reschedule request key is invalid.')
  return key
}

export function timeMinutes(value) {
  const normalized = normalizeTime(value)
  if (!normalized) return null
  const [hours, minutes] = normalized.split(':').map(Number)
  return hours * 60 + minutes
}

export function validateRescheduleForm({ session, form, timeSlots, holidays, today = localDateString() }) {
  if (!session || String(session.status).toLowerCase() === 'completed') {
    return 'Completed sessions cannot be rescheduled.'
  }
  if (!isValidDate(form.newDate)) return 'Enter a valid session date.'
  if (form.newDate < today) return 'A session cannot be moved to a past date.'
  if (holidays.some((holiday) => holiday.active && holiday.holidayDate === form.newDate)) {
    return 'The selected date is an active center holiday.'
  }

  const slot = timeSlots.find((item) => (
    normalizeTime(item.startTime) === normalizeTime(form.newStartTime)
    && normalizeTime(item.endTime) === normalizeTime(form.newEndTime)
  ))
  if (!slot) return 'Choose one of the standard session time slots.'
  const startMinutes = timeMinutes(form.newStartTime)
  const endMinutes = timeMinutes(form.newEndTime)
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return 'The start time must be before the end time.'
  }
  if (!form.reason?.trim()) return 'A reason is required for a session incident.'
  return ''
}

export function findSessionConflict(sessions, { sessionId, date, startTime, endTime, roomId, coachId }) {
  const start = timeMinutes(startTime)
  const end = timeMinutes(endTime)
  if (start === null || end === null) return null
  for (const session of sessions || []) {
    if (String(session.id) === String(sessionId)) continue
    if (String(session.sessionDate) !== String(date)) continue
    if (String(session.status).toLowerCase() === 'cancelled') continue
    const otherStart = timeMinutes(session.startTime)
    const otherEnd = timeMinutes(session.endTime)
    if (otherStart === null || otherEnd === null || start >= otherEnd || end <= otherStart) continue
    if (roomId != null && String(session.roomId) === String(roomId)) {
      return { type: 'room', session }
    }
    if (coachId != null && String(session.coachId) === String(coachId)) {
      return { type: 'coach', session }
    }
  }
  return null
}

export function coachesForSession(coaches, session) {
  const candidates = (coaches || []).filter((coach) => String(coach.id) !== String(session?.coachId))
  if (!session?.subjectName) return { coaches: candidates, specializationMatched: null }
  const knownSpecialties = candidates.filter((coach) => coach.specializations?.length)
  if (!knownSpecialties.length) return { coaches: candidates, specializationMatched: null }
  const subject = session.subjectName.trim().toLocaleLowerCase()
  const matched = knownSpecialties.filter((coach) => coach.specializations.some(
    (specialization) => specialization.trim().toLocaleLowerCase() === subject,
  ))
  return { coaches: matched, specializationMatched: matched.length > 0 }
}

export function makeMockSessions({ classes = [], rooms = [], coaches = [] } = {}) {
  const fallbackDate = localDateString()
  const slots = [
    ['06:00:00', '07:30:00'], ['07:45:00', '09:15:00'], ['09:30:00', '11:00:00'],
    ['13:00:00', '14:30:00'], ['14:45:00', '16:15:00'], ['16:30:00', '18:00:00'], ['18:15:00', '19:45:00'],
  ]
  return classes.slice(0, 4).map((item, index) => {
    const slot = slots[index % slots.length]
    const coach = coaches[index % Math.max(coaches.length, 1)]
    const room = rooms[index % Math.max(rooms.length, 1)]
    return {
      id: `mock-session-${item.id ?? index + 1}`,
      classId: item.id ?? null,
      className: item.name ?? null,
      subjectName: item.category ?? null,
      coachId: coach?.id ?? item.coachId ?? null,
      coachName: coach?.name ?? item.coachName ?? null,
      roomId: room?.id ?? item.roomId ?? null,
      roomName: room?.name ?? item.room ?? null,
      sessionDate: item.startDate && item.startDate >= fallbackDate ? item.startDate : addDays(fallbackDate, index),
      startTime: slot[0],
      endTime: slot[1],
      status: 'Scheduled',
      enrolledCount: 0,
      maxCapacity: item.capacity ?? null,
      isPrivate: false,
    }
  })
}

export const MOCK_TIME_SLOTS = [
  ['06:00:00', '07:30:00', true],
  ['07:45:00', '09:15:00', true],
  ['09:30:00', '11:00:00', false],
  ['13:00:00', '14:30:00', false],
  ['14:45:00', '16:15:00', true],
  ['16:30:00', '18:00:00', true],
  ['18:15:00', '19:45:00', true],
].map(([startTime, endTime, outdoorAllowed], index) => ({
  slotNumber: index + 1,
  name: `Ca ${index + 1}`,
  startTime,
  endTime,
  outdoorAllowed,
  displayName: `Ca ${index + 1} (${startTime.slice(0, 5)} - ${endTime.slice(0, 5)})`,
}))
