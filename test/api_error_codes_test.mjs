import assert from 'node:assert/strict'
import {
  ERROR_CODE_TEXT,
  describeBlockReason,
  translateErrorCode,
  BACKEND_CODE_MESSAGES,
  BACKEND_FORBIDDEN_MESSAGES,
  createApiError,
  getErrorMessage,
  readBackendMessage,
} from '../src/api/apiErrors.js'

const codes = Object.keys(BACKEND_CODE_MESSAGES)
assert.equal(codes.length, 74)

// AC-A1: mọi mã trong bảng khi có { code, message: "<MÃ>: English text" } hoặc chỉ { message: "MÃ: English text" }
for (const code of codes) {
  const expected = BACKEND_CODE_MESSAGES[code]
  assert.equal(
    readBackendMessage({ code, message: `${code}: English backend error` }, 400),
    expected,
    `Failed for { code, message } of ${code}`,
  )
  assert.equal(
    readBackendMessage({ message: `${code}: English backend error` }, 400),
    expected,
    `Failed for { message: "CODE: ..." } of ${code}`,
  )
  assert.equal(
    readBackendMessage({ errorCode: code }, 400),
    expected,
    `Failed for { errorCode } of ${code}`,
  )
  assert.equal(
    readBackendMessage({ code, message: code }, 400),
    expected,
    `Failed when message equals ${code}`,
  )
}

// AC-A2: câu tiếng Việt cụ thể của Backend không bị bảng đè
const specificVi = 'Phòng tập hoặc Huấn luyện viên đã bị trùng lịch trong khung giờ này.'
assert.equal(
  readBackendMessage({ code: 'SCHEDULE_CONFLICT', message: specificVi }, 409),
  specificVi,
)
assert.equal(
  readBackendMessage(
    { code: 'SCHEDULE_CONFLICT', message: `SCHEDULE_CONFLICT: ${specificVi}` },
    409,
  ),
  specificVi,
)

// AC-A3: các nhánh đặc biệt và mã ngoài bảng giữ nguyên hành vi
assert.equal(
  readBackendMessage({ code: 'FORBIDDEN_NOT_OWNER', message: 'FORBIDDEN_NOT_OWNER: Nope' }, 403),
  'Bạn không có quyền thao tác trên buổi tập của học viên khác.',
)
assert.equal(
  readBackendMessage({ code: 'INVALID_ROLE', message: 'Invalid role' }, 403),
  'Tài khoản không đúng vai trò để thực hiện thao tác này.',
)
assert.equal(
  readBackendMessage({ code: 'TOKEN_EXPIRED', message: 'Expired' }, 401),
  'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
)
assert.equal(
  readBackendMessage({ code: 'UNKNOWN_CUSTOM_CODE', message: 'Custom message' }, 400),
  'Custom message',
)

const apiErr = createApiError(400, { code: 'CLASS_FULL', message: 'Class is full' })
assert.equal(getErrorMessage(apiErr), BACKEND_CODE_MESSAGES.CLASS_FULL)

console.log('api_error_codes_test.mjs: ALL PASSED')

// W-A11 AC1: 403 không có code, message có tiền tố MÃ: và phần sau tiếng Việt
const ac1Err = createApiError(403, {
  message: 'RESULT_CONTENT_DEADLINE_PASSED: Đã hết hạn sửa nhận xét buổi học của Coach.',
})
assert.equal(ac1Err.code, 'RESULT_CONTENT_DEADLINE_PASSED')
assert.equal(ac1Err.message, 'Đã hết hạn sửa nhận xét buổi học của Coach.')
assert.ok(!ac1Err.message.includes('RESULT_CONTENT_DEADLINE_PASSED:'))

// W-A11 AC2: 403 không có code, message có tiền tố MÃ: và phần sau tiếng Anh -> dịch theo bảng
const ac2Err = createApiError(403, {
  message: 'RESULT_CONTENT_FORBIDDEN: Active Coach with RECORD_RESULT required',
})
assert.equal(ac2Err.code, 'RESULT_CONTENT_FORBIDDEN')
assert.equal(ac2Err.message, BACKEND_CODE_MESSAGES.RESULT_CONTENT_FORBIDDEN)

// W-A11 AC3: body.code có sẵn luôn thắng tiền tố message
const ac3Err = createApiError(403, {
  code: 'X_CODE',
  message: 'OTHER_CODE: Không có quyền truy cập.',
})
assert.equal(ac3Err.code, 'X_CODE')
assert.equal(ac3Err.message, 'Không có quyền truy cập.')

// W-A11 AC4: chuỗi không phải tiền tố mã hoa giữ code === null và message như trước
for (const [body, expectedMsg] of [
  [{ message: 'Access Denied' }, 'Bạn không có quyền thực hiện thao tác này.'],
  [{ message: 'Lỗi gì đó: abc' }, 'Lỗi gì đó: abc'],
  ['Chuỗi lỗi thuần', 'Chuỗi lỗi thuần'],
]) {
  const err = createApiError(403, body)
  assert.equal(err.code, null)
  assert.equal(err.message, expectedMsg)
}

// W-A11 AC5: 403 ATTENDANCE_CORRECTION_* có code từ body vẫn giữ code và bỏ tiền tố nếu có
const ac5Err = createApiError(403, {
  code: 'ATTENDANCE_CORRECTION_FORBIDDEN',
  message: 'ATTENDANCE_CORRECTION_FORBIDDEN: Chỉ huấn luyện viên được giao mới sửa được điểm danh.',
})
assert.equal(ac5Err.code, 'ATTENDANCE_CORRECTION_FORBIDDEN')
assert.equal(ac5Err.message, 'Chỉ huấn luyện viên được giao mới sửa được điểm danh.')

console.log('api_error_codes_test.mjs (with W-A11): ALL PASSED')

// W-A12 AC1: kiểm tra đủ 38 khóa trong BACKEND_FORBIDDEN_MESSAGES
const forbiddenKeys = Object.keys(BACKEND_FORBIDDEN_MESSAGES)
assert.equal(forbiddenKeys.length, 38)
for (const key of forbiddenKeys) {
  const err = createApiError(403, {
    timestamp: '2026-11-16T09:00:00Z',
    status: 403,
    error: 'Forbidden',
    message: key,
  })
  assert.equal(err.code, null)
  assert.equal(err.message, BACKEND_FORBIDDEN_MESSAGES[key], `Failed for ${key}`)
}

// W-A12 AC2: không phân biệt hoa thường và bỏ khoảng trắng đầu/cuối
const ac2Forbidden = createApiError(403, {
  status: 403,
  error: 'Forbidden',
  message: '  financial staff required ',
})
assert.equal(ac2Forbidden.code, null)
assert.equal(
  ac2Forbidden.message,
  'Chức năng này chỉ dành cho nhân sự phụ trách tài chính.',
)

// W-A12 AC3: câu lạ, Access Denied, và câu 403 tiếng Việt có sẵn giữ nguyên hành vi cũ
assert.equal(
  createApiError(403, { message: 'Something new happened' }).message,
  'Something new happened',
)
assert.equal(
  createApiError(403, { message: 'Access Denied' }).message,
  'Bạn không có quyền thực hiện thao tác này.',
)
assert.equal(
  createApiError(403, { message: 'Bạn không thể thao tác ở trung tâm khác.' }).message,
  'Bạn không thể thao tác ở trung tâm khác.',
)

// W-A12 AC4: lỗi có tiền tố mã vẫn đi đường bảng mã cũ
const ac4Forbidden = createApiError(403, {
  message: 'NORMAL_CASH_COUNTER_ONLY: Receptionist required',
})
assert.equal(ac4Forbidden.code, 'NORMAL_CASH_COUNTER_ONLY')
assert.equal(ac4Forbidden.message, BACKEND_CODE_MESSAGES.NORMAL_CASH_COUNTER_ONLY)

console.log('api_error_codes_test.mjs (with W-A12): ALL PASSED')

// E1: mọi mã trong bảng chung ra chuỗi không rỗng ở vi và en (số mã: 53 trước E1, 74 sau E1)
assert.equal(Object.keys(ERROR_CODE_TEXT).length, 74)
for (const [code, text] of Object.entries(ERROR_CODE_TEXT)) {
  assert.ok(typeof text.vi === 'string' && text.vi.trim().length > 0, `${code}: vi rỗng`)
  assert.ok(typeof text.en === 'string' && text.en.trim().length > 0, `${code}: en rỗng`)
  assert.equal(translateErrorCode(code, 'vi'), text.vi)
  assert.equal(translateErrorCode(code, 'en'), text.en)
  assert.equal(describeBlockReason(code, 'vi'), text.vi)
  assert.ok(!translateErrorCode(code, 'vi').includes(code), `${code}: câu chữ không được chứa mã thô`)
}
// 21 mã thêm ở E1 đều có chữ
for (const code of [
  'REGISTRATION_FORBIDDEN', 'CLASS_NOT_OPEN', 'CLASS_NOT_READY', 'SUBJECT_INACTIVE', 'MEMBER_REQUIRED',
  'OPENING_CONFIRMATION_FORBIDDEN', 'NORMAL_INSUFFICIENT_PAID', 'NORMAL_MIN_CAPACITY_REQUIRED', 'NORMAL_NOT_AWAITING_OPENING',
  'NORMAL_OPENING_BLOCKED', 'CANCELLATION_FORBIDDEN', 'ADVANCED_PACKAGE_EXPIRED', 'CREDIT_LIMIT_EXCEEDED', 'ATTENDANCE_FORBIDDEN',
  'IDEMPOTENCY_CONFLICT', 'LEGACY_MEMBERSHIP_RETIRED', 'USE_INCIDENT_RECOVERY', 'ADVANCED_STATUS_WORKFLOW_REQUIRED',
  'ADVANCED_CLASS_MISMATCH', 'USE_ATTENDANCE_CORRECTION', 'NOT_YOUR_CLASS',
]) {
  assert.ok(translateErrorCode(code, 'vi'), `${code}: thiếu vi`)
  assert.ok(translateErrorCode(code, 'en'), `${code}: thiếu en`)
}
// Mã đã có chữ từ trước không bị sửa
assert.equal(translateErrorCode('CLASS_FULL', 'vi'), 'Lớp đã đủ chỗ.')
assert.equal(translateErrorCode('NORMAL_REGISTRATION_CLOSED', 'vi'), 'Lớp đã đóng đăng ký.')
// Lớp lót: mã lạ, rỗng, null, chỉ khoảng trắng, không phải chuỗi
assert.equal(describeBlockReason('MA_LA_CHUA_CO', 'vi'), 'Thao tác hiện chưa khả dụng. (MA_LA_CHUA_CO)')
assert.equal(describeBlockReason('MA_LA_CHUA_CO', 'en'), 'This action is not available right now. (MA_LA_CHUA_CO)')
for (const empty of ['', '   ', null, undefined, 0, {}, []]) {
  assert.equal(describeBlockReason(empty, 'vi'), 'Thao tác hiện chưa khả dụng.')
  assert.equal(describeBlockReason(empty, 'en'), 'This action is not available right now.')
}
// Chữ hoa thường của mã quen biết vẫn ra chữ trong bảng; lớp lót không đổi getErrorMessage toàn cục
assert.equal(describeBlockReason(' class_full ', 'vi'), 'Lớp đã đủ chỗ.')
assert.equal(readBackendMessage({ code: 'MA_LA_CHUA_CO', message: 'Custom' }, 400), 'Custom')

// E1-r2: IDEMPOTENCY_CONFLICT và CLASS_NOT_READY dùng câu chung đúng nghĩa Backend
for (const code of ['IDEMPOTENCY_CONFLICT', 'CLASS_NOT_READY']) {
  for (const lang of ['vi', 'en']) {
    const text = translateErrorCode(code, lang)
    assert.ok(!text.includes('phương thức thanh toán'), `${code} (${lang}) không được chứa "phương thức thanh toán"`)
    assert.ok(!text.includes('đã đóng đăng ký'), `${code} (${lang}) không được chứa "đã đóng đăng ký"`)
  }
}

console.log('api_error_codes_test.mjs (E1): ALL PASSED')
