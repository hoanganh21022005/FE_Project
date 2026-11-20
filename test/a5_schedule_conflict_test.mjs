import assert from 'node:assert/strict'
import { checkSingleClassConflict } from '../src/components/classes/hooks/useScheduleConflict.js'

const baseCandidate = {
  id: null,
  coachId: 2,
  coachName: 'Coach A',
  roomId: 1,
  room: 'Sân Cầu Lông 01',
  startDate: '2026-11-23',
  startTime: '06:00',
  endTime: '07:30',
  selectedDays: [1, 3, 5],
}

// 1. Lớp cũ Advanced thiếu ngày/giờ không chặn ca 06:00-07:30
assert.equal(
  checkSingleClassConflict(baseCandidate, {
    id: 201,
    classType: 'Advanced',
    status: 'Open',
    coachId: 2,
    coachName: 'Coach A',
    roomId: 1,
    roomName: 'Sân Cầu Lông 01',
    startTime: null,
    endTime: null,
    selectedDays: [],
  }),
  null,
)

// 2. Lớp cũ đã hủy hoặc kết thúc không gây xung đột
for (const status of ['Cancelled', 'Canceled', 'Closed', 'Completed']) {
  assert.equal(
    checkSingleClassConflict(baseCandidate, {
      id: 202,
      classType: 'Normal',
      status,
      coachId: 2,
      roomId: 1,
      startTime: '06:00',
      endTime: '07:30',
      selectedDays: [1, 3, 5],
    }),
    null,
  )
}

// 3. Lớp cũ Normal có selectedDays trùng ngày nhưng thiếu giờ: chỉ cảnh báo nhẹ (hasMissingSchedule), không khóa
const missingTimeResult = checkSingleClassConflict(baseCandidate, {
  id: 203,
  classType: 'Normal',
  status: 'Open',
  coachId: 2,
  roomId: 1,
  startTime: '',
  endTime: '',
  selectedDays: [1, 3, 5],
})
assert.equal(missingTimeResult?.hasConflict, false)
assert.equal(missingTimeResult?.hasMissingSchedule, true)

// 4. Xung đột thật (cùng Coach, cùng ngày, giờ chồng lên) -> chặn
const coachConflict = checkSingleClassConflict(baseCandidate, {
  id: 204,
  classType: 'Normal',
  status: 'Open',
  coachId: 2,
  coachName: 'Coach A',
  roomId: 99,
  roomName: 'Sân Khác',
  startTime: '07:00',
  endTime: '08:30',
  selectedDays: [1, 3],
})
assert.equal(coachConflict?.hasConflict, true)
assert.equal(coachConflict?.conflictCoach, true)

// 5. Xung đột thật (cùng sân, khác Coach, cùng ngày, giờ chồng lên) -> chặn
const roomConflict = checkSingleClassConflict(baseCandidate, {
  id: 205,
  classType: 'Normal',
  status: 'Open',
  coachId: 88,
  coachName: 'Coach B',
  roomId: 1,
  roomName: 'Sân Cầu Lông 01',
  startTime: '06:30',
  endTime: '08:00',
  selectedDays: [5],
})
assert.equal(roomConflict?.hasConflict, true)
assert.equal(roomConflict?.conflictRoom, true)

console.log('a5_schedule_conflict_test: all assertions passed')
