import { test, expect } from './helpers/guardedTest.js';
import { setupDefaultApiMocks, isLocalApi } from './helpers/mockAuth.js';
import { mockUsers } from './helpers/mockData.js';

function createFakeJwt(payloadObj) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  return `${header}.${payload}.fakesignature`;
}

const sdk = `window.google = { accounts: { id: {
  initialize(options) { window.testGoogleOptions = options; },
  renderButton(element) { element.textContent = 'Google giả lập'; }
} } };`;

test.beforeEach(async ({ page }) => {
  await setupDefaultApiMocks(page);
  await page.route('https://accounts.google.com/gsi/client', (route) => route.request().method() === 'GET'
    ? route.fulfill({ status: 200, contentType: 'application/javascript', body: sdk })
    : route.fallback());
});

test('Google callback gửi credential giả, chuyển dashboard và F5 với phiên API giả', async ({ page }) => {
  let authenticated = false;
  let payload;
  await page.route((url) => isLocalApi(url, '/api/auth/me'), (route) => route.request().method() === 'GET'
    ? route.fulfill(authenticated ? { json: mockUsers.member } : { status: 401, json: {} })
    : route.fallback());
  await page.route((url) => isLocalApi(url, '/api/auth/google'), (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    payload = route.request().postDataJSON();
    authenticated = true;
    return route.fulfill({ json: mockUsers.member });
  });
  await page.goto('/login');
  await expect(page.getByText('Google giả lập')).toBeVisible();
  expect(await page.evaluate(() => window.testGoogleOptions.client_id)).toBe('fake-client-id.apps.example.invalid');
  await page.evaluate(() => window.testGoogleOptions.callback({ credential: 'fake-google-credential' }));
  await expect(page).toHaveURL(/\/member\/dashboard/);
  expect(payload).toEqual({ credential: 'fake-google-credential' });
  await page.reload();
  await expect(page).toHaveURL(/\/member\/dashboard/);
});

test('Google callback báo lỗi API và bỏ qua credential rỗng', async ({ page }) => {
  let calls = 0;
  await page.route((url) => isLocalApi(url, '/api/auth/me'), (route) => route.request().method() === 'GET'
    ? route.fulfill({ status: 401, json: {} })
    : route.fallback());
  await page.route((url) => isLocalApi(url, '/api/auth/google'), (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    calls++;
    return route.fulfill({ status: 401, json: { message: 'Rejected' } });
  });
  await page.goto('/login');
  await expect(page.getByText('Google giả lập')).toBeVisible();
  await page.evaluate(() => window.testGoogleOptions.callback({}));
  expect(calls).toBe(0);
  await page.evaluate(() => window.testGoogleOptions.callback({ credential: 'fake-google-credential' }));
  await expect(page.getByText(/Không đăng nhập được bằng Google|Unable to sign in with Google|Đăng nhập Google thất bại|Google sign-in failed/i)).toBeVisible();
  expect(calls).toBe(1);
  await expect(page).toHaveURL(/\/login/);
});

test('Tab Đăng ký + 401: thông báo lỗi, điền sẵn email và họ tên từ Google credential, chuyển tab không còn lỗi', async ({ page }) => {
  await page.route((url) => isLocalApi(url, '/api/auth/me'), (route) => route.request().method() === 'GET'
    ? route.fulfill({ status: 401, json: {} })
    : route.fallback());
  await page.route((url) => isLocalApi(url, '/api/auth/google'), (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({ status: 401, json: { message: 'Not registered' } });
  });

  await page.goto('/register');
  await expect(page.getByText('Google giả lập')).toBeVisible();

  const fakeJwt = createFakeJwt({
    email: 'qa.google@example.test',
    name: 'Nguyễn Văn Test',
  });

  await page.evaluate((jwt) => window.testGoogleOptions.callback({ credential: jwt }), fakeJwt);

  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/Chưa tạo được tài khoản bằng Google|Could not create account with Google/i);

  const nameInput = page.getByPlaceholder(/Nguyễn Văn A|Full name/i);
  const emailInput = page.getByPlaceholder('name@example.com');
  await expect(nameInput).toHaveValue('Nguyễn Văn Test');
  await expect(emailInput).toHaveValue('qa.google@example.test');

  // Chuyển sang tab Đăng nhập: không còn thấy thông báo lỗi của tab Đăng ký
  await page.getByRole('button', { name: /Đăng nhập|Sign in/i }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Tab Đăng ký + 401: không ghi đè họ tên hoặc email khi người dùng đã nhập trước', async ({ page }) => {
  await page.route((url) => isLocalApi(url, '/api/auth/me'), (route) => route.request().method() === 'GET'
    ? route.fulfill({ status: 401, json: {} })
    : route.fallback());
  await page.route((url) => isLocalApi(url, '/api/auth/google'), (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({ status: 401, json: { message: 'Not registered' } });
  });

  await page.goto('/register');
  await expect(page.getByText('Google giả lập')).toBeVisible();

  const nameInput = page.getByPlaceholder(/Nguyễn Văn A|Full name/i);
  const emailInput = page.getByPlaceholder('name@example.com');
  await nameInput.fill('Người Dùng Đã Gõ');
  await emailInput.fill('user.typed@example.test');

  const fakeJwt = createFakeJwt({
    email: 'qa.google@example.test',
    name: 'Nguyễn Văn Test',
  });

  await page.evaluate((jwt) => window.testGoogleOptions.callback({ credential: jwt }), fakeJwt);

  await expect(nameInput).toHaveValue('Người Dùng Đã Gõ');
  await expect(emailInput).toHaveValue('user.typed@example.test');
});

test('Tab Đăng nhập + 403: thông báo tài khoản bị khóa hoặc không có quyền', async ({ page }) => {
  await page.route((url) => isLocalApi(url, '/api/auth/me'), (route) => route.request().method() === 'GET'
    ? route.fulfill({ status: 401, json: {} })
    : route.fallback());
  await page.route((url) => isLocalApi(url, '/api/auth/google'), (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({ status: 403, json: { message: 'Account locked' } });
  });

  await page.goto('/login');
  await expect(page.getByText('Google giả lập')).toBeVisible();

  await page.evaluate(() => window.testGoogleOptions.callback({ credential: 'fake-google-credential' }));
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/Tài khoản đã bị khóa hoặc không có quyền đăng nhập|Account is locked or not authorized/i);
});

test('Tab Đăng nhập + lỗi mạng: thông báo không kết nối được máy chủ', async ({ page }) => {
  await page.route((url) => isLocalApi(url, '/api/auth/me'), (route) => route.request().method() === 'GET'
    ? route.fulfill({ status: 401, json: {} })
    : route.fallback());
  await page.route((url) => isLocalApi(url, '/api/auth/google'), (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.abort();
  });

  await page.goto('/login');
  await expect(page.getByText('Google giả lập')).toBeVisible();

  await page.evaluate(() => window.testGoogleOptions.callback({ credential: 'fake-google-credential' }));
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/Không kết nối được máy chủ|Cannot connect to server/i);
});
