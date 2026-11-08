import assert from 'node:assert';
import {
  STATUS_MESSAGES,
  sanitizeBackendMessage,
  readBackendMessage,
  createApiError,
  getErrorMessage,
  ForbiddenError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  ApiError
} from '../src/api/apiErrors.js';

console.log('=== TEST SUITE: BACKEND ERROR SANITIZATION & USER-FRIENDLY ERRORS ===\n');

// 1. Kiểm thử lỗi 401 kỹ thuật
{
  const raw401_1 = 'Full authentication is required to access /api/v1/users/profile';
  const clean401_1 = sanitizeBackendMessage(raw401_1, 401);
  assert.strictEqual(clean401_1, STATUS_MESSAGES[401], '401 Spring path must be sanitized to friendly message');
  assert.ok(!clean401_1.includes('/api/'), 'Must not contain /api/');

  const raw401_2 = 'Bad credentials';
  const clean401_2 = sanitizeBackendMessage(raw401_2, 401);
  assert.strictEqual(clean401_2, STATUS_MESSAGES[401], 'Bad credentials must be sanitized');

  const err401 = createApiError(401, { message: 'Full authentication is required to access /api/members' });
  assert.ok(err401 instanceof UnauthorizedError, 'Must be instance of UnauthorizedError');
  assert.strictEqual(getErrorMessage(err401), STATUS_MESSAGES[401]);
  console.log('PASS: 401 Technical errors sanitized safely without exposing endpoint/API');
}

// 2. Kiểm thử lỗi 403 kỹ thuật
{
  const raw403 = 'Access Denied: /api/invoices/99/confirm-cash';
  const clean403 = sanitizeBackendMessage(raw403, 403);
  assert.strictEqual(clean403, STATUS_MESSAGES[403], '403 Access Denied with endpoint must be sanitized');
  assert.ok(!clean403.includes('/api/'));
  assert.ok(!clean403.toLowerCase().includes('access denied'));

  const err403 = createApiError(403, { error: 'Forbidden', message: 'Access Denied to endpoint /api/roles' });
  assert.ok(err403 instanceof ForbiddenError, 'Must be ForbiddenError');
  assert.strictEqual(getErrorMessage(err403), STATUS_MESSAGES[403]);
  console.log('PASS: 403 Technical errors sanitized safely without exposing endpoint/API');
}

// 3. Kiểm thử lỗi 404 kỹ thuật
{
  const raw404 = 'No static resource api/users.';
  const clean404 = sanitizeBackendMessage(raw404, 404);
  assert.strictEqual(clean404, STATUS_MESSAGES[404], '404 static resource must be sanitized');
  assert.ok(!clean404.includes('api/'));

  const err404 = createApiError(404, { message: 'Resource not found at /api/classes/999' });
  assert.ok(err404 instanceof NotFoundError);
  assert.strictEqual(getErrorMessage(err404), STATUS_MESSAGES[404]);
  console.log('PASS: 404 Technical errors sanitized safely without exposing endpoint/API');
}

// 4. Kiểm thử lỗi 500 kỹ thuật và thông báo "Backend returned HTTP 500; expected HTTP 200."
{
  const rawReturned500 = 'Backend returned HTTP 500; expected HTTP 200.';
  const cleanReturned500 = sanitizeBackendMessage(rawReturned500, 500);
  assert.strictEqual(cleanReturned500, STATUS_MESSAGES[500], 'Must sanitize "Backend returned HTTP 500"');
  assert.ok(!cleanReturned500.toLowerCase().includes('backend'));
  assert.ok(!cleanReturned500.includes('500'));
  assert.ok(!cleanReturned500.includes('200'));

  // Kiểm tra khi status là 0 nhưng message chứa HTTP 500
  const cleanReturnedWithoutStatus = sanitizeBackendMessage(rawReturned500, 0);
  assert.strictEqual(cleanReturnedWithoutStatus, STATUS_MESSAGES[500], 'Must auto-extract 500 status from message text');

  const raw500_1 = 'Cannot execute statement on PostgreSQL backend: connection refused';
  const clean500_1 = sanitizeBackendMessage(raw500_1, 500);
  assert.strictEqual(clean500_1, STATUS_MESSAGES[500]);
  assert.ok(!clean500_1.includes('PostgreSQL'));
  assert.ok(!clean500_1.toLowerCase().includes('backend'));

  const raw500_2 = 'NullPointerException at com.sportscenter.controller.UserController:45';
  const clean500_2 = sanitizeBackendMessage(raw500_2, 500);
  assert.strictEqual(clean500_2, STATUS_MESSAGES[500]);

  const err500 = createApiError(500, { message: 'Internal server error in backend cluster' });
  assert.strictEqual(getErrorMessage(err500), STATUS_MESSAGES[500]);
  console.log('PASS: 500 Technical exceptions, raw HTTP mismatch & stack traces sanitized safely');
}

// 5. Kiểm thử HTTP 429 và các HTTP status không có trong STATUS_MESSAGES
{
  // 5.1 HTTP 429 Too Many Requests
  assert.ok(STATUS_MESSAGES[429], 'STATUS_MESSAGES must include 429');
  const err429 = createApiError(429, { message: 'Too Many Requests' });
  assert.strictEqual(getErrorMessage(err429), STATUS_MESSAGES[429]);
  assert.ok(getErrorMessage(err429).includes('quá nhiều yêu cầu'));

  // 5.2 HTTP 405 Method Not Allowed (Status không có trong map cơ bản)
  const err405 = createApiError(405, { message: "Request method 'POST' is not supported" });
  const msg405 = getErrorMessage(err405);
  assert.strictEqual(msg405, 'Yêu cầu không thể thực hiện được. Vui lòng kiểm tra lại thông tin.');
  assert.ok(!msg405.includes('POST'));
  assert.ok(!msg405.includes('405'));

  // 5.3 HTTP 415 Unsupported Media Type
  const err415 = createApiError(415, null);
  assert.strictEqual(getErrorMessage(err415), 'Yêu cầu không thể thực hiện được. Vui lòng kiểm tra lại thông tin.');

  // 5.4 HTTP 502 / 503 Service Unavailable (Status 5xx khác)
  const err502 = createApiError(502, { message: 'Bad Gateway from upstream host' });
  assert.strictEqual(getErrorMessage(err502), STATUS_MESSAGES[500]);

  const err503 = createApiError(503, null);
  assert.strictEqual(getErrorMessage(err503), STATUS_MESSAGES[500]);
  console.log('PASS: HTTP 429 and unmapped HTTP status codes (405, 415, 502, 503) handled with friendly messages');
}

// 6. Kiểm thử lỗi nghiệp vụ có thông tin cần giữ (trùng lịch, hết chỗ, gói không hợp lệ)
{
  const businessCases = [
    {
      raw: 'Trùng lịch tập với hội viên khác',
      expected: 'Trùng lịch tập với hội viên khác',
      desc: 'Conflict schedule message preserved'
    },
    {
      raw: 'Lớp học đã hết chỗ trống',
      expected: 'Lớp học đã hết chỗ trống',
      desc: 'Class full message preserved'
    },
    {
      raw: 'Gói tập không hợp lệ hoặc đã hết hạn kích hoạt',
      expected: 'Gói tập không hợp lệ hoặc đã hết hạn kích hoạt',
      desc: 'Invalid package message preserved'
    },
    {
      raw: 'HTTP 409: Trùng lịch tập với hội viên khác',
      expected: 'Trùng lịch tập với hội viên khác',
      desc: 'Prefix HTTP 409 stripped, preserving schedule conflict'
    },
    {
      raw: 'Error 400: Lớp học đã hết chỗ trống',
      expected: 'Lớp học đã hết chỗ trống',
      desc: 'Prefix Error 400 stripped, preserving class full info'
    },
    {
      raw: 'Backend error: Gói tập không hợp lệ',
      expected: 'Gói tập không hợp lệ',
      desc: 'Prefix Backend error stripped, preserving invalid package info'
    },
    {
      raw: 'Hội viên đang có hợp đồng hoạt động không thể xóa.',
      expected: 'Hội viên đang có hợp đồng hoạt động không thể xóa.',
      desc: 'Active contract rule preserved'
    },
    {
      raw: 'Số ngày bảo lưu không được vượt quá thời hạn còn lại của gói tập.',
      expected: 'Số ngày bảo lưu không được vượt quá thời hạn còn lại của gói tập.',
      desc: 'Freeze limit message preserved'
    }
  ];

  for (const tc of businessCases) {
    const cleaned = sanitizeBackendMessage(tc.raw, 400);
    assert.strictEqual(cleaned, tc.expected, `Failed: ${tc.desc}`);
    assert.ok(!cleaned.includes('HTTP 409'), 'Must not leak HTTP 409 prefix');
    assert.ok(!cleaned.toLowerCase().includes('backend error'), 'Must not leak Backend error prefix');
  }
  console.log('PASS: Business critical errors (trùng lịch, hết chỗ, gói không hợp lệ) preserved accurately without raw prefixes');
}

// 7. Kiểm thử lỗi mạng và quá thời gian chờ (Network & Timeout)
{
  const rawNetError = 'TypeError: Failed to fetch';
  const cleanNetError = sanitizeBackendMessage(rawNetError, 0);
  assert.strictEqual(cleanNetError, STATUS_MESSAGES[0]);

  const timeoutMsg = 'Yêu cầu đã quá thời gian chờ. Vui lòng kiểm tra trạng thái rồi thử lại sau.';
  const cleanTimeout = sanitizeBackendMessage(timeoutMsg, 0);
  assert.strictEqual(cleanTimeout, timeoutMsg, 'Friendly timeout message must be preserved');

  const netErr = createApiError(0, null);
  assert.strictEqual(getErrorMessage(netErr), STATUS_MESSAGES[0]);
  console.log('PASS: Network and timeout errors handled cleanly');
}

// 8. Đối soát không lộ bất kỳ từ khóa cấm nào trong tập hợp lỗi kỹ thuật
{
  const bannedKeywords = ['/api/', 'backend', 'endpoint', 'postgresql', 'sql', 'stacktrace', 'exception', 'http 500', 'http 200', 'expected http'];
  const testInputs = [
    { body: { message: 'Access Denied: /api/classes' }, status: 403 },
    { body: { error: 'Not Found at /api/users/12' }, status: 404 },
    { body: { detail: 'SQLException in backend database server' }, status: 500 },
    { body: { message: 'Backend returned HTTP 500; expected HTTP 200.' }, status: 500 },
    { body: { message: 'Failed to route request to endpoint /api/audit-logs' }, status: 502 },
  ];

  for (const input of testInputs) {
    const err = createApiError(input.status, input.body);
    const msg = getErrorMessage(err);
    for (const kw of bannedKeywords) {
      assert.ok(!msg.toLowerCase().includes(kw), `Error message must not leak '${kw}': got "${msg}"`);
    }
  }
  console.log('PASS: Verified zero leakage of technical keywords across all error responses');
}

console.log('\n>>> ALL ERROR SANITIZATION & ERROR HANDLING TESTS PASSED SUCCESSFULLY! <<<');
