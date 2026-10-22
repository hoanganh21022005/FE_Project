import assert from 'node:assert/strict'
import {
  createHoliday,
  getCoaches,
  getHolidays,
  getSessions,
  getSessionTimeSlots,
  rescheduleSession,
  substituteSessionCoach,
  toggleHoliday,
} from '../src/api/managerApi.js'
import { canManageClasses, holidayRequestFromForm, validateHolidayForm } from '../src/api/holidayUtils.js'
import {
  coachesForSession,
  findSessionConflict,
  makeMockSessions,
  MOCK_TIME_SLOTS,
  validateRescheduleForm,
} from '../src/api/sessionIncidentUtils.js'
import { mapSession } from '../src/api/mappers.js'

const originalFetch = globalThis.fetch
const requests = []
const replies = []
globalThis.fetch = async (url, options) => {
  requests.push({ url: String(url), options, body: options.body ? JSON.parse(options.body) : null })
  const next = replies.shift()
  if (next instanceof Error) throw next
  return new Response(next.status === 204 ? null : JSON.stringify(next.body), {
    status: next.status,
    headers: { 'content-type': 'application/json' },
  })
}

try {
  // 1. GET holidays successfully maps the HolidayResponse DTO.
  replies.push({ status: 200, body: [{ id: 4, holidayDate: '2026-12-25', holidayName: 'Center holiday', tag: 'CENTER_EVENT', active: true }] })
  const holidays = await getHolidays({ notifyForbidden: false })
  assert.deepEqual(holidays[0], { id: 4, holidayDate: '2026-12-25', holidayName: 'Center holiday', tag: 'CENTER_EVENT', active: true })
  assert.match(requests.at(-1).url, /\/api\/holidays$/)

  // 2. Creation sends only fields supported by HolidayRequest.
  const holidayPayload = holidayRequestFromForm({ holidayDate: '2026-12-31', holidayName: ' Year end ', tag: 'CENTER_EVENT', active: true })
  assert.deepEqual(holidayPayload, { holidayDate: '2026-12-31', holidayName: 'Year end', tag: 'CENTER_EVENT', active: true })
  replies.push({ status: 201, body: { id: 5, ...holidayPayload } })
  await createHoliday(holidayPayload, { notifyForbidden: false })
  assert.deepEqual(requests.at(-1).body, holidayPayload)
  assert.equal(requests.at(-1).options.method, 'POST')

  // 3. Toggle uses the actual PATCH contract and explicit target active value.
  replies.push({ status: 200, body: { ...holidays[0], active: false } })
  const toggled = await toggleHoliday(4, false, { notifyForbidden: false })
  assert.equal(toggled.active, false)
  assert.equal(requests.at(-1).options.method, 'PATCH')
  assert.deepEqual(requests.at(-1).body, { active: false })

  // 4. API actions are denied in the UI without MANAGE_CLASSES; mock stays usable.
  assert.equal(canManageClasses(true, []), false)
  assert.equal(canManageClasses(true, ['VIEW_REPORTS']), false)
  assert.equal(canManageClasses(true, ['MANAGE_CLASSES']), true)
  assert.equal(canManageClasses(false, []), true)

  // 5. Holiday dates and names validate, including duplicate dates (even inactive holidays).
  assert.equal(validateHolidayForm({ holidayDate: '', holidayName: 'Holiday' }), 'Enter a valid holiday date.')
  assert.equal(validateHolidayForm({ holidayDate: '2026-02-30', holidayName: 'Holiday' }), 'Enter a valid holiday date.')
  assert.equal(validateHolidayForm({ holidayDate: '2026-12-25', holidayName: '  ' }), 'Holiday name is required.')
  assert.equal(validateHolidayForm({ holidayDate: '2026-12-25', holidayName: 'Duplicate' }, [{ holidayDate: '2026-12-25', active: false }]), 'A holiday already exists for this date.')
  assert.equal(validateHolidayForm({ holidayDate: '2026-12-26', holidayName: 'Holiday' }), '')

  // 6. Session list sends only BE-supported filters and maps the SessionResponse without member details.
  replies.push({ status: 200, body: [{ id: 11, classId: 2, className: 'Yoga', subjectId: 3, subjectName: 'Yoga', coachId: 9, coachName: 'Coach A', roomId: 6, roomName: 'Studio A', sessionDate: '2026-12-20', startTime: '07:45:00', endTime: '09:15:00', status: 'Scheduled', enrolledCount: 5, maxCapacity: 12, bookedMemberName: 'Private member' }] })
  const sessions = await getSessions({ classId: 2, coachId: 9, roomId: 6, startDate: '2026-12-01', endDate: '2026-12-31', status: 'Scheduled' }, { notifyForbidden: false })
  assert.equal(sessions[0].className, 'Yoga')
  assert.equal('bookedMemberName' in sessions[0], false)
  assert.match(requests.at(-1).url, /classId=2.*coachId=9.*roomId=6.*startDate=2026-12-01.*endDate=2026-12-31.*status=Scheduled/)

  // 7. Slot source is the BE endpoint and has its outdoor restrictions intact.
  replies.push({ status: 200, body: [{ slotNumber: 1, name: 'Ca 1', startTime: '06:00:00', endTime: '07:30:00', outdoorAllowed: true, displayName: 'Ca 1 (06:00 - 07:30)' }] })
  assert.equal((await getSessionTimeSlots(true, { notifyForbidden: false }))[0].outdoorAllowed, true)
  assert.match(requests.at(-1).url, /time-slots\?isOutdoor=true/)

  // 8. Valid reschedule uses the exact DTO and never sends extendValidityDays.
  replies.push({ status: 200, body: { ...sessions[0], sessionDate: '2026-12-21' } })
  await rescheduleSession(11, { newDate: '2026-12-21', newStartTime: '06:00:00', newEndTime: '07:30:00', newRoomId: null, reason: 'Room maintenance', extendValidityDays: 99 }, { notifyForbidden: false })
  assert.deepEqual(requests.at(-1).body, { newDate: '2026-12-21', newStartTime: '06:00:00', newEndTime: '07:30:00', newRoomId: null, reason: 'Room maintenance' })
  assert.equal('extendValidityDays' in requests.at(-1).body, false)
  assert.equal(requests.at(-1).options.method, 'POST')

  // 9. Completed sessions, past dates, active holidays, and invalid slots are rejected client-side.
  const validForm = { newDate: '2026-12-21', newStartTime: '07:45:00', newEndTime: '09:15:00', reason: 'Maintenance' }
  const validContext = { session: { status: 'Scheduled' }, form: validForm, timeSlots: MOCK_TIME_SLOTS, holidays: [], today: '2026-10-22' }
  assert.equal(validateRescheduleForm({ ...validContext, session: { status: 'Completed' } }), 'Completed sessions cannot be rescheduled.')
  assert.equal(validateRescheduleForm({ ...validContext, form: { ...validForm, newDate: '2026-10-01' } }), 'A session cannot be moved to a past date.')
  assert.equal(validateRescheduleForm({ ...validContext, holidays: [{ holidayDate: validForm.newDate, active: true }] }), 'The selected date is an active center holiday.')
  assert.equal(validateRescheduleForm({ ...validContext, form: { ...validForm, newStartTime: '08:00:00' } }), 'Choose one of the standard session time slots.')
  assert.equal(validateRescheduleForm({ ...validContext, form: { ...validForm, reason: '' } }), 'A reason is required for a session incident.')
  assert.equal(validateRescheduleForm(validContext), '')

  // 10. Room and coach collision checks are independent and ignore cancelled/self sessions.
  const collisionFixture = [
    { id: 12, sessionDate: '2026-12-21', startTime: '07:45:00', endTime: '09:15:00', roomId: 6, coachId: 8, status: 'Scheduled', className: 'Other class' },
    { id: 13, sessionDate: '2026-12-21', startTime: '07:45:00', endTime: '09:15:00', roomId: 7, coachId: 9, status: 'Scheduled' },
    { id: 14, sessionDate: '2026-12-21', startTime: '07:45:00', endTime: '09:15:00', roomId: 6, coachId: 9, status: 'Cancelled' },
  ]
  assert.equal(findSessionConflict(collisionFixture, { sessionId: 11, date: '2026-12-21', startTime: '07:45:00', endTime: '09:15:00', roomId: 6 }).type, 'room')
  assert.equal(findSessionConflict(collisionFixture, { sessionId: 11, date: '2026-12-21', startTime: '07:45:00', endTime: '09:15:00', coachId: 9 }).type, 'coach')
  assert.equal(findSessionConflict(collisionFixture, { sessionId: 12, date: '2026-12-21', startTime: '07:45:00', endTime: '09:15:00', roomId: 6 }), null)
  assert.equal(findSessionConflict(collisionFixture, { sessionId: 11, date: '2026-12-21', startTime: '09:15:00', endTime: '10:45:00', roomId: 6 }), null)

  // 11. Coach API supplies actual specialties; filtering never infers from coach names.
  replies.push({ status: 200, body: [{ id: 9, name: 'Yoga Coach', specializations: ['Yoga'] }, { id: 10, name: 'Other', specializations: ['Tennis'] }] })
  const coachList = await getCoaches({ notifyForbidden: false })
  assert.deepEqual(coachesForSession(coachList, { coachId: 8, subjectName: 'Yoga' }).coaches.map((coach) => coach.id), [9])
  assert.deepEqual(coachesForSession(coachList, { coachId: 8, subjectName: 'Pilates' }).coaches, [])

  // 12. Substitute coach request matches its DTO and a failed API response stays a rejection.
  replies.push({ status: 200, body: { ...sessions[0], coachId: 9, coachName: 'Yoga Coach' } })
  await substituteSessionCoach(11, { newCoachId: 9, reason: 'Coach leave' }, { notifyForbidden: false })
  assert.deepEqual(requests.at(-1).body, { newCoachId: 9, reason: 'Coach leave' })
  replies.push({ status: 409, body: { message: 'Coach already has a session at this time.' } })
  await assert.rejects(substituteSessionCoach(11, { newCoachId: 9, reason: 'Coach leave' }, { notifyForbidden: false }), (error) => error.status === 409 && error.message.includes('already has'))

  // 13. Session mapper does not expose private member fields.
  const sanitized = mapSession({ id: 7, bookedMemberId: 2, bookedMemberName: 'Private', className: 'Class' })
  assert.equal('bookedMemberId' in sanitized, false)
  assert.equal('bookedMemberName' in sanitized, false)

  // 14. Mock mode keeps local session fixtures and the standard time-slot fallback.
  const mockSessions = makeMockSessions({ classes: [{ id: 1, name: 'Mock class' }] })
  assert.equal(mockSessions.length, 1)
  assert.equal(mockSessions[0].status, 'Scheduled')
  assert.equal(MOCK_TIME_SLOTS.length, 7)

  // 15. API errors keep backend messages; no real API call was made because fetch is mocked above.
  replies.push({ status: 403, body: { message: 'MANAGE_CLASSES permission required.' } })
  await assert.rejects(createHoliday(holidayPayload, { notifyForbidden: false }), (error) => error.status === 403 && error.message === 'MANAGE_CLASSES permission required.')
} finally {
  globalThis.fetch = originalFetch
}

console.log('FE-09 holidays and session incident mock-response checks passed.')
