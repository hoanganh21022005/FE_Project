import assert from 'node:assert/strict'
import {
  addCalendarDays,
  buildClassCalendarEntries,
  calendarMonthCells,
  currentCalendarMonth,
  matchesClassDateRange,
  shiftCalendarMonth,
  vietnamDateKey,
} from '../src/components/classes/classCalendar.js'
import { mapClass, mapSession, toClassRequest } from '../src/api/mappers.js'
import { buildNormalClassWithSessionsRequest } from '../src/api/normalClassCreation.js'

const now = new Date('2026-11-06T18:00:00Z') // 01:00 ngày 07/11 tại Việt Nam
const today = vietnamDateKey(now)
assert.equal(today, '2026-11-07')
assert.equal(matchesClassDateRange('2026-11-07', 'today', today), true)
assert.equal(matchesClassDateRange('2026-11-06', 'today', today), false)
console.log('TC01 PASS: Hôm nay')

const thisWeek = Array.from({ length: 9 }, (_, index) => addCalendarDays('2026-11-01', index))
assert.deepEqual(thisWeek.filter((date) => matchesClassDateRange(date, 'this_week', today)), [
  '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08',
])
console.log('TC02 PASS: Tuần này từ thứ Hai đến Chủ nhật')

const nextWeek = Array.from({ length: 9 }, (_, index) => addCalendarDays('2026-11-08', index))
assert.deepEqual(nextWeek.filter((date) => matchesClassDateRange(date, 'next_week', today)), [
  '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15',
])
console.log('TC03 PASS: Tuần tới từ thứ Hai đến Chủ nhật')

assert.equal(matchesClassDateRange('2026-02-01', 'this_week', '2026-01-31'), true)
assert.equal(matchesClassDateRange('2026-02-02', 'next_week', '2026-01-31'), true)
assert.equal(matchesClassDateRange('2026-02-28', 'next_month', '2026-01-31'), true)
assert.equal(shiftCalendarMonth('2026-01', 1), '2026-02')
assert.equal(calendarMonthCells('2024-02').filter(Boolean).length, 29)
console.log('TC04 PASS: Chuyển tháng và năm nhuận')

assert.equal(matchesClassDateRange('2027-01-03', 'this_week', '2026-12-31'), true)
assert.equal(matchesClassDateRange('2027-01-04', 'next_week', '2026-12-31'), true)
assert.equal(matchesClassDateRange('2027-01-01', 'next_month', '2026-12-31'), true)
assert.equal(shiftCalendarMonth('2026-12', 1), '2027-01')
assert.equal(shiftCalendarMonth('2027-01', -1), '2026-12')
console.log('TC05 PASS: Chuyển năm')

for (const invalid of [null, undefined, '', '2026-02-29', '2026-11-31', '2026-13-01', 'không hợp lệ', '2026-11-07T25:00:00Z']) {
  assert.equal(vietnamDateKey(invalid), null, String(invalid))
  assert.equal(matchesClassDateRange(invalid, 'this_week', today), false, String(invalid))
}
console.log('TC06 PASS: Loại ngày không hợp lệ')

assert.equal(vietnamDateKey('2026-11-06T17:00:00Z'), '2026-11-07')
assert.equal(vietnamDateKey('2026-11-07T00:30:00+09:00'), '2026-11-06')
assert.equal(vietnamDateKey('2026-11-07T00:30:00'), '2026-11-07')
assert.equal(vietnamDateKey('2026-11-07'), '2026-11-07')
console.log('TC07 PASS: Xử lý ngày và thời điểm theo giờ Việt Nam')

assert.equal(currentCalendarMonth(now), '2026-11')
assert.equal(currentCalendarMonth(new Date('2026-12-31T17:00:00Z')), '2027-01')
assert.equal(calendarMonthCells(currentCalendarMonth(now))[6], '2026-11-01')
console.log('TC08 PASS: Lịch mặc định tháng hiện tại tại Việt Nam')

const classes = [mapClass({ id: 1, name: 'Lớp A', status: 'Open', startDate: '2026-12-31', maxCapacity: 12 }, { apiMode: true })]
const sessions = [
  mapSession({ id: 10, classId: 1, sessionDate: '2026-12-31', startTime: '08:00', status: 'Scheduled' }),
  mapSession({ id: 11, classId: 1, sessionDate: '2027-01-02', startTime: '09:00', status: 'Cancelled' }),
  mapSession({ id: 12, classId: 1, sessionDate: 'invalid', startTime: '09:00' }),
]
const snapshot = structuredClone({ classes, sessions })
const entries = buildClassCalendarEntries(classes, sessions)
assert.equal(entries['2026-12-31'].length, 1)
assert.equal(entries['2026-12-31'][0].session.id, 10)
assert.equal(entries['2027-01-02'][0].session.status, 'Cancelled')
assert.equal(Object.values(entries).flat().length, 2)
assert.ok(calendarMonthCells(shiftCalendarMonth('2026-12', 1)).includes('2027-01-02'))
assert.ok(calendarMonthCells(shiftCalendarMonth('2027-01', -1)).includes('2026-12-31'))
assert.deepEqual({ classes, sessions }, snapshot)
assert.equal(buildClassCalendarEntries(classes, [])['2026-12-31'][0].type, 'class')
console.log('TC09 PASS: Chuyển tháng giữ nguyên dữ liệu lớp và buổi học')

const classInput = { name: 'Lớp A', subjectId: 1, coachId: 2, capacity: 12, startDate: '2026-12-31', endDate: '2027-01-28', classType: 'Normal', status: 'Open', apiStatus: 'Open' }
const update = toClassRequest(classInput)
assert.equal(update.name, classInput.name)
assert.equal(update.startDate, classInput.startDate)
assert.equal(update.coachId, classInput.coachId)
assert.equal(update.maxCapacity, classInput.capacity)
assert.equal(update.status, 'Open')
assert.equal(mapClass({ id: 2, name: 'Không ngày' }).date, null)
const create = buildNormalClassWithSessionsRequest({ ...classInput, roomId: 3, selectedDays: [1, 3, 0], startTime: '08:00', endTime: '09:30' }, { requestId: 'local-test' })
assert.equal(create.sportsClass.totalSessions, 12)
assert.equal(create.sportsClass.coachId, classInput.coachId)
assert.equal(create.sportsClass.maxCapacity, classInput.capacity)
assert.deepEqual(create.daysOfWeek, [1, 3, 7])
console.log('TC10 PASS: Dữ liệu sửa lớp và tạo lớp Normal tiếp tục giữ hợp đồng')
