import assert from 'node:assert/strict';
import { statusLabel, statusTone } from '../src/utils/status.js';
import { formatDate, formatTime, formatDateTime, formatWeekday } from '../src/utils/datetime.js';
import { normalizeScore, formatScore, scoreToBarWidthPercent } from '../src/utils/score.js';

// P1.1 Status labels & tones
assert.equal(statusLabel('session', 'Scheduled'), 'Sắp diễn ra');
assert.equal(statusLabel('session', 'Completed'), 'Đã hoàn thành');
assert.equal(statusLabel('session', 'Cancelled'), 'Đã hủy');
assert.equal(statusLabel('registration', 'REQUESTED'), 'Chờ duyệt');
assert.equal(statusLabel('registration', 'ACCEPTED'), 'Chờ chọn gói');
assert.equal(statusLabel('registration', 'INVOICED'), 'Chờ thanh toán');
assert.equal(statusLabel('registration', 'ACTIVE'), 'Đang hoạt động');
assert.equal(statusLabel('registration', 'REJECTED'), 'Đã từ chối');
assert.equal(statusLabel('package', 'Frozen'), 'Đang bảo lưu');
assert.equal(statusLabel('attendance', 'CheckedIn'), 'Có mặt');
assert.equal(statusLabel('attendance', 'Excused'), 'Vắng có phép');

assert.equal(statusTone('session', 'Completed'), 'green');
assert.equal(statusTone('registration', 'INVOICED'), 'amber');
assert.equal(statusTone('session', 'Cancelled'), 'red');
assert.equal(statusTone('session', 'Scheduled'), 'blue');

// P1.3 Date/Time
assert.equal(formatDate('2026-11-04'), '04/11/2026');
assert.equal(formatTime('06:00:00'), '06:00');
assert.equal(formatDateTime('2026-11-04T14:45:00'), '14:45 04/11/2026');
assert.equal(formatWeekday('2026-11-04', 'vi'), 'Thứ Tư, 04/11/2026');

// P1.4 Score
assert.equal(normalizeScore(65), 6.5);
assert.equal(normalizeScore(6.5), 6.5);
assert.equal(formatScore(65), '6.5/10');
assert.equal(formatScore(6.5), '6.5/10');
assert.equal(scoreToBarWidthPercent(6.5), 65);

console.log('PASS: coach_p1_utils_test.mjs');
