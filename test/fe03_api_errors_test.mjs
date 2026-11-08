import assert from 'node:assert/strict';
import { ApiError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../src/api/apiErrors.js';
import { httpRequest } from '../src/api/httpClient.js';
import * as managerApi from '../src/api/managerApi.js';

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const events = [];
globalThis.window = { dispatchEvent: (event) => events.push(event) };

try {
  const cases = [
    [400, ValidationError, 'Dữ liệu gửi lên không hợp lệ.'],
    [401, UnauthorizedError, 'Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.'],
    [403, ForbiddenError, 'Bạn không có quyền thực hiện thao tác này.'],
    [404, NotFoundError, 'Không tìm thấy dữ liệu được yêu cầu.'],
    [409, ValidationError, 'Dữ liệu đang xung đột với thông tin hiện có.'],
    [422, ValidationError, 'Dữ liệu không vượt qua kiểm tra hợp lệ.'],
    [500, ApiError, 'Máy chủ gặp lỗi khi xử lý yêu cầu.'],
  ];

  for (const [status, ErrorType, fallback] of cases) {
    globalThis.fetch = async () => new Response('', { status, statusText: 'Status Text' });
    await assert.rejects(
      httpRequest(`/api/mock-${status}`, { notifyUnauthorized: false, notifyForbidden: false }),
      (error) => error instanceof ErrorType && error.status === status && error.message === fallback,
    );
  }

  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Backend business message' }), {
    status: 409,
    headers: { 'Content-Type': 'application/json' },
  });
  await assert.rejects(
    httpRequest('/api/mock-business-error', { notifyForbidden: false }),
    (error) => error.status === 409 && error.message === 'Backend business message'
      && error.code === null,
  );

  globalThis.fetch = async () => new Response(JSON.stringify({
    code: 'SCHEDULE_CONFLICT',
    message: 'Coach schedule overlaps an existing class',
  }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
  await assert.rejects(
    httpRequest('/api/mock-backend-code'),
    (error) => error.status === 400 && error.message === 'Coach schedule overlaps an existing class'
      && error.code === 'SCHEDULE_CONFLICT',
  );

  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(
    httpRequest('/api/mock-network-error'),
    (error) => error instanceof ApiError && error.status === 0
      && error.message === 'Không thể kết nối đến máy chủ. Kiểm tra kết nối mạng rồi thử lại.',
  );

  globalThis.fetch = async () => new Response('null', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  assert.deepEqual(await managerApi.getRooms(), []);
  await assert.rejects(managerApi.getPackages(), /không đúng định dạng/);
  assert.deepEqual(await managerApi.getClasses(), []);
  await assert.rejects(managerApi.getAuditLogs(), /không đúng định dạng/);

  globalThis.fetch = async () => new Response('{}', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  assert.deepEqual(await managerApi.getRooms(), []);
  await assert.rejects(managerApi.getPackages(), /không đúng định dạng/);
  await assert.rejects(managerApi.getAuditLogs(), /không đúng định dạng/);

  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Audit access denied' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
  await assert.rejects(managerApi.getAuditLogs({ notifyForbidden: false }), (error) => error.status === 403);
  assert.equal(events.length, 0, 'Manager audit load can report its own 403 without a duplicate global toast event');

  console.log('PASS: FE-03 HTTP errors, backend messages, network failures, empty list responses, and audit 403 suppression');
} finally {
  globalThis.fetch = originalFetch;
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
}
