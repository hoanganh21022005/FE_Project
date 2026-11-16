import assert from 'node:assert/strict'
import {
  BACKEND_CODE_MESSAGES,
  createApiError,
  getErrorMessage,
  readBackendMessage,
} from '../src/api/apiErrors.js'

const codes = Object.keys(BACKEND_CODE_MESSAGES)
assert.equal(codes.length, 30)

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
