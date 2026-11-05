import assert from 'node:assert/strict';
import { mapClass, mapSession } from '../src/api/mappers.js';
import {
  parseTimeToMinutes,
  normalizeDateStr,
  formatDateVi,
  getClassSessions,
  hasValidScheduleData,
  checkActualSessionOverlap,
  buildConflictNotification,
  checkSingleClassConflict,
  computeAllClassConflicts,
  computeManagerClassConflicts,
} from '../src/components/classes/hooks/useScheduleConflict.js';

console.log('--- BẮT ĐẦU TEST HỒI QUY CẢNH BÁO TRÙNG LỊCH MANAGER (FE13) ---');

const managerClasses = [1, 2].map((id) => mapClass({
  id, name: `Lớp ${id}`, coachId: 3, status: 'Open',
}, { apiMode: true }));
const managerSessions = managerClasses.map(({ id, coachId }) => mapSession({
  id: 100 + id, classId: String(id), coachId, sessionDate: '2026-12-29',
  startTime: '06:00', endTime: '07:30', status: 'Scheduled',
}));
const managerConflicts = computeAllClassConflicts(managerClasses, managerSessions);
assert.equal(managerConflicts[1].conflictingClass.id, 2);
assert.equal(managerConflicts[2].conflictingClass.id, 1);
assert.equal(computeAllClassConflicts(managerClasses, [])[1].hasMissingSchedule, true);

const separateResources = managerSessions.map((session, index) => ({
  ...session, coachId: index + 10, coachName: 'HLV trùng tên',
  roomId: index === 0 ? 1 : 10, roomName: index === 0 ? 'Sân 1' : 'Sân 10',
}));
assert.deepEqual(computeAllClassConflicts(managerClasses, separateResources), {});
assert.equal(computeAllClassConflicts(managerClasses, [
  managerSessions[0], { ...managerSessions[1], centerInvalidated: true },
])[2].hasMissingSchedule, true);
console.log('✔ PASS: dữ liệu API Manager, định danh tài nguyên và buổi bị vô hiệu hóa');

// =========================================================================
// 1. Kiểm tra các hàm tiện ích thời gian và ngày tháng
// =========================================================================
assert.equal(parseTimeToMinutes('06:00'), 360);
assert.equal(parseTimeToMinutes('07:30'), 450);
assert.equal(parseTimeToMinutes('09:00:00'), 540);
assert.equal(parseTimeToMinutes('invalid'), null);
assert.equal(parseTimeToMinutes(''), null);

assert.equal(normalizeDateStr('2026-10-12'), '2026-10-12');
assert.equal(normalizeDateStr('2026-10-12T07:30:00.000Z'), '2026-10-12');
assert.equal(normalizeDateStr(''), null);

assert.equal(formatDateVi('2026-10-12'), '12/10/2026');
assert.equal(formatDateVi('2026-11-05'), '05/11/2026');

console.log('✔ PASS: 1. Tiện ích thời gian và ngày tháng chính xác');

// =========================================================================
// 2. Ca 1: Chạm mốc giờ (boundary touching) -> KHÔNG trùng
// Ví dụ: Lớp A kết thúc lúc 09:00, Lớp B bắt đầu lúc 09:00
// =========================================================================
const sessionTouchA = {
  id: 's-1',
  date: '2026-10-12',
  startTime: '08:00',
  endTime: '09:00',
  coachId: 15,
  coachName: 'Lê Văn Hùng',
  roomId: 1,
  roomName: 'Sân Cầu Lông 1',
};
const sessionTouchB = {
  id: 's-2',
  date: '2026-10-12',
  startTime: '09:00',
  endTime: '10:00',
  coachId: 15,
  coachName: 'Lê Văn Hùng',
  roomId: 1,
  roomName: 'Sân Cầu Lông 1',
};
const overlapTouch = checkActualSessionOverlap(sessionTouchA, sessionTouchB, { id: 101 }, { id: 102 });
assert.equal(overlapTouch, null, 'Chạm mốc giờ (09:00 vs 09:00) không được coi là trùng lịch');
console.log('✔ PASS: 2. Ca chạm mốc giờ không trùng (startA < endB && startB < endA)');

// =========================================================================
// 3. Ca 2: Khác ngày -> KHÔNG trùng
// Cùng giờ, cùng HLV, cùng Sân nhưng khác ngày (12/10 vs 13/10)
// =========================================================================
const sessionDiffDayA = {
  id: 's-1',
  date: '2026-10-12',
  startTime: '08:00',
  endTime: '09:30',
  coachId: 15,
  roomId: 1,
};
const sessionDiffDayB = {
  id: 's-2',
  date: '2026-10-13',
  startTime: '08:00',
  endTime: '09:30',
  coachId: 15,
  roomId: 1,
};
const overlapDiffDay = checkActualSessionOverlap(sessionDiffDayA, sessionDiffDayB, { id: 101 }, { id: 102 });
assert.equal(overlapDiffDay, null, 'Khác ngày học không được coi là trùng lịch');
console.log('✔ PASS: 3. Ca khác ngày học không trùng');

// =========================================================================
// 4. Ca 3: Cùng ngày, chồng giờ, chung HLV -> BÁO TRÙNG HLV & NÊU ĐÚNG ĐỐI DIỆN
// =========================================================================
const classCoachA = {
  id: 1,
  code: 'CLS-001',
  name: 'Cầu lông K01',
  nameVi: 'Cầu lông K01',
  coachId: 15,
  coachName: 'Lê Văn Hùng',
  sessions: [
    {
      id: 's1',
      sessionDate: '2026-10-12',
      startTime: '08:00',
      endTime: '09:30',
      coachId: 15,
      coachName: 'Lê Văn Hùng',
      roomId: 1,
      roomName: 'Sân Cầu Lông 1',
    },
  ],
};
const classCoachB = {
  id: 2,
  code: 'CLS-002',
  name: 'Bắn súng K01',
  nameVi: 'Bắn súng K01',
  coachId: 15,
  coachName: 'Lê Văn Hùng',
  sessions: [
    {
      id: 's2',
      sessionDate: '2026-10-12',
      startTime: '09:00',
      endTime: '10:30',
      coachId: 15,
      coachName: 'Lê Văn Hùng',
      roomId: 2,
      roomName: 'Phòng Bắn Súng 1',
    },
  ],
};

const conflictMapCoach = computeAllClassConflicts([classCoachA, classCoachB]);
assert.equal(conflictMapCoach[1].hasConflict, true, 'Lớp A phải báo trùng lịch');
assert.equal(conflictMapCoach[2].hasConflict, true, 'Lớp B phải báo trùng lịch');
assert.equal(conflictMapCoach[1].conflictCoach, true, 'Phải đánh dấu trùng HLV');
assert.equal(conflictMapCoach[1].conflictRoom, false, 'Không trùng Sân');

// Kiểm tra đối xứng: Cảnh báo mỗi lớp phải nêu đúng lớp đối diện
assert.equal(conflictMapCoach[1].conflictingClassName, 'Bắn súng K01', 'Lớp 1 phải nêu đúng Lớp 2 đối diện');
assert.match(conflictMapCoach[1].message, /Bắn súng K01/, 'Thông báo của Lớp 1 phải chứa tên lớp đối diện');
assert.match(conflictMapCoach[1].message, /12\/10\/2026/, 'Thông báo phải ghi rõ ngày trùng');
assert.match(conflictMapCoach[1].message, /HLV Lê Văn Hùng/, 'Thông báo phải ghi rõ HLV bị trùng');

assert.equal(conflictMapCoach[2].conflictingClassName, 'Cầu lông K01', 'Lớp 2 phải nêu đúng Lớp 1 đối diện');
assert.match(conflictMapCoach[2].message, /Cầu lông K01/, 'Thông báo của Lớp 2 phải chứa tên lớp đối diện');
console.log('✔ PASS: 4. Ca cùng ngày chồng giờ chung HLV báo trùng chính xác và nêu đúng đối diện');

// =========================================================================
// 5. Ca 4: Cùng ngày, chồng giờ, chung Sân -> BÁO TRÙNG SÂN & NÊU ĐÚNG ĐỐI DIỆN
// =========================================================================
const classRoomA = {
  id: 3,
  code: 'CLS-003',
  nameVi: 'Pickleball K01',
  roomId: 5,
  roomVi: 'Sân Pickleball A1',
  sessions: [
    {
      id: 'sr1',
      date: '2026-10-15',
      startTime: '14:00',
      endTime: '15:30',
      coachId: 20,
      coachName: 'Trần Văn A',
      roomId: 5,
      roomVi: 'Sân Pickleball A1',
    },
  ],
};
const classRoomB = {
  id: 4,
  code: 'CLS-004',
  nameVi: 'Pickleball K02',
  roomId: 5,
  roomVi: 'Sân Pickleball A1',
  sessions: [
    {
      id: 'sr2',
      date: '2026-10-15',
      startTime: '15:00',
      endTime: '16:30',
      coachId: 21,
      coachName: 'Nguyễn Văn B',
      roomId: 5,
      roomVi: 'Sân Pickleball A1',
    },
  ],
};

const conflictMapRoom = computeAllClassConflicts([classRoomA, classRoomB]);
assert.equal(conflictMapRoom[3].hasConflict, true);
assert.equal(conflictMapRoom[4].hasConflict, true);
assert.equal(conflictMapRoom[3].conflictRoom, true);
assert.equal(conflictMapRoom[3].conflictCoach, false);
assert.match(conflictMapRoom[3].message, /Pickleball K02/);
assert.match(conflictMapRoom[3].message, /Trùng sân/);
assert.match(conflictMapRoom[4].message, /Pickleball K01/);
console.log('✔ PASS: 5. Ca cùng ngày chồng giờ chung Sân báo trùng chính xác');

// =========================================================================
// 6. Ca 5: Cùng ngày, chồng giờ, chung cả HLV và Sân
// =========================================================================
const classBothA = {
  id: 5,
  nameVi: 'Boxing K01',
  sessions: [
    {
      id: 'sb1',
      date: '2026-10-20',
      startTime: '18:00',
      endTime: '19:30',
      coachId: 30,
      coachName: 'HLV Nam',
      roomId: 8,
      roomName: 'Phòng Boxing 1',
    },
  ],
};
const classBothB = {
  id: 6,
  nameVi: 'Boxing K02',
  sessions: [
    {
      id: 'sb2',
      date: '2026-10-20',
      startTime: '18:30',
      endTime: '20:00',
      coachId: 30,
      coachName: 'HLV Nam',
      roomId: 8,
      roomName: 'Phòng Boxing 1',
    },
  ],
};
const conflictMapBoth = computeAllClassConflicts([classBothA, classBothB]);
assert.equal(conflictMapBoth[5].conflictCoach, true);
assert.equal(conflictMapBoth[5].conflictRoom, true);
assert.match(conflictMapBoth[5].message, /HLV HLV Nam và Phòng Boxing 1/);
assert.match(conflictMapBoth[5].message, /Boxing K02/);
console.log('✔ PASS: 6. Ca trùng cả HLV và Sân báo trùng chính xác');

// =========================================================================
// 7. Ca 6: Thiếu lịch thì báo chưa đủ dữ liệu
// =========================================================================
const classNoSession = {
  id: 7,
  code: 'CLS-007',
  nameVi: 'Lớp Chưa Lên Lịch',
  sessions: [], // Mảng rỗng -> thiếu lịch
};
const classNullSession = {
  id: 8,
  code: 'CLS-008',
  nameVi: 'Lớp Null Sessions',
  // không có thuộc tính sessions
};
const classInvalidSession = {
  id: 9,
  code: 'CLS-009',
  nameVi: 'Lớp Buổi Không Hợp Lệ',
  sessions: [{ id: 'x', date: null, startTime: null }], // session thiếu dữ liệu
};

assert.equal(hasValidScheduleData(classNoSession), false);
assert.equal(hasValidScheduleData(classNullSession), false);
assert.equal(hasValidScheduleData(classInvalidSession), false);

const conflictMapMissing = computeAllClassConflicts([classNoSession, classNullSession, classInvalidSession]);
assert.equal(conflictMapMissing[7].hasConflict, false);
assert.equal(conflictMapMissing[7].hasMissingSchedule, true);
assert.equal(conflictMapMissing[7].status, 'insufficient_data');
assert.match(conflictMapMissing[7].message, /Chưa đủ dữ liệu/);

assert.equal(conflictMapMissing[8].hasConflict, false);
assert.equal(conflictMapMissing[8].hasMissingSchedule, true);

assert.equal(conflictMapMissing[9].hasConflict, false);
assert.equal(conflictMapMissing[9].hasMissingSchedule, true);
console.log('✔ PASS: 7. Thiếu lịch báo chưa đủ dữ liệu đúng yêu cầu');

// =========================================================================
// 8. Ca 7: Buổi học bị hủy (cancelled) -> Bỏ qua không trùng
// =========================================================================
const classCancelA = {
  id: 10,
  nameVi: 'Lớp A',
  sessions: [
    {
      id: 'sc1',
      date: '2026-10-22',
      startTime: '08:00',
      endTime: '09:30',
      coachId: 15,
      roomId: 1,
      status: 'Cancelled', // Đã hủy
    },
  ],
};
const classCancelB = {
  id: 11,
  nameVi: 'Lớp B',
  sessions: [
    {
      id: 'sc2',
      date: '2026-10-22',
      startTime: '08:00',
      endTime: '09:30',
      coachId: 15,
      roomId: 1,
      status: 'Scheduled',
    },
  ],
};
const conflictMapCancel = computeAllClassConflicts([classCancelA, classCancelB]);
assert.equal(Boolean(conflictMapCancel[10]?.hasConflict), false);
assert.equal(Boolean(conflictMapCancel[11]?.hasConflict), false);
console.log('✔ PASS: 8. Buổi học bị hủy không gây báo trùng');

// =========================================================================
// 9. Ca 8: Cùng ngày, chồng giờ nhưng khác cả HLV lẫn Sân -> KHÔNG trùng
// =========================================================================
const classIndependentA = {
  id: 12,
  nameVi: 'Lớp Bơi A',
  sessions: [
    {
      id: 'si1',
      date: '2026-10-25',
      startTime: '08:00',
      endTime: '09:30',
      coachId: 101,
      coachName: 'HLV Bơi 1',
      roomId: 201,
      roomName: 'Bể bơi 1',
    },
  ],
};
const classIndependentB = {
  id: 13,
  nameVi: 'Lớp Bơi B',
  sessions: [
    {
      id: 'si2',
      date: '2026-10-25',
      startTime: '08:30',
      endTime: '10:00',
      coachId: 102,
      coachName: 'HLV Bơi 2',
      roomId: 202,
      roomName: 'Bể bơi 2',
    },
  ],
};
const conflictMapIndependent = computeAllClassConflicts([classIndependentA, classIndependentB]);
assert.equal(Boolean(conflictMapIndependent[12]?.hasConflict), false);
assert.equal(Boolean(conflictMapIndependent[13]?.hasConflict), false);
console.log('✔ PASS: 9. Khác cả HLV và Sân không báo trùng');

// =========================================================================
// 10. Ca 9: Rà soát caller dùng chung (fallback compatibility)
// Khi form tạo lớp mới chưa có sessions, checkSingleClassConflict vẫn chạy tốt
// =========================================================================
const candidateForm = {
  coachId: 15,
  coachName: 'Lê Văn Hùng',
  roomId: 1,
  roomVi: 'Sân Cầu Lông 1',
  selectedDays: [1, 3, 5],
  startTime: '06:00',
  endTime: '07:30',
};
const existingClassForm = {
  id: 99,
  nameVi: 'Lớp Cũ Đang Chạy',
  coachId: 15,
  coachName: 'Lê Văn Hùng',
  roomId: 1,
  roomVi: 'Sân Cầu Lông 1',
  selectedDays: [1, 3, 5],
  startTime: '06:00',
  endTime: '07:30',
};
const fallbackConflict = checkSingleClassConflict(candidateForm, existingClassForm);
assert.ok(fallbackConflict, 'Fallback tuần vẫn hoạt động khi không có sessions thực tế');
assert.equal(fallbackConflict.hasConflict, true);
assert.match(fallbackConflict.message, /Lớp Cũ Đang Chạy/);
console.log('✔ PASS: 10. Tương thích ngược caller dùng chung không bị phá vỡ');

// =========================================================================
// 11. Ca 10: computeAllClassConflicts trên danh sách hỗn hợp
// Kiểm tra totalConflictsCount chỉ đếm lớp hasConflict: true
// =========================================================================
const mixedList = [
  classCoachA, // hasConflict: true (với classCoachB)
  classCoachB, // hasConflict: true (với classCoachA)
  classNoSession, // hasMissingSchedule: true
  classIndependentA, // hợp lệ, không trùng
];

const mixedMap = computeAllClassConflicts(mixedList);
const totalConflicts = Object.values(mixedMap).filter((c) => Boolean(c?.hasConflict)).length;
assert.equal(totalConflicts, 2, 'Chỉ đúng 2 lớp trùng lịch được tính vào totalConflictsCount');

const missingCount = Object.values(mixedMap).filter((c) => Boolean(c?.hasMissingSchedule)).length;
assert.equal(missingCount, 1, 'Chỉ 1 lớp thiếu lịch được tính vào missingCount');

console.log('✔ PASS: 11. Danh sách hỗn hợp tính đúng số lượng trùng và thiếu lịch');

console.log('=========================================================================');
console.log('TẤT CẢ CÁC BÀI TEST HỒI QUY CẢNH BÁO TRÙNG LỊCH MANAGER ĐÃ ĐẠT 100%!');
console.log('=========================================================================');
