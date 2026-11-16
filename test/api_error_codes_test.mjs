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
  `SCHEDULE_CONFLICT: ${specificVi}`,
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
