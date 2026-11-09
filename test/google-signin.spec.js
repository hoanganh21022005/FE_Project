import { test, expect } from './helpers/guardedTest.js';
import { setupDefaultApiMocks } from './helpers/mockAuth.js';
import { mockUsers } from './helpers/mockData.js';

const sdk = `window.google = { accounts: { id: {
  initialize(options) { window.testGoogleOptions = options; },
  renderButton(element) { element.textContent = 'Google giả lập'; }
} } };`;
const isLocalApi = (url, path) => url.origin === 'http://127.0.0.1:5199' && url.pathname === path;

test.beforeEach(async ({ page }) => {
  await setupDefaultApiMocks(page);
  await page.route('https://accounts.google.com/gsi/client', (route) => route.request().method() === 'GET'
    ? route.fulfill({ status: 200, contentType: 'application/javascript', body: sdk })
    : route.fallback());
});

test('Google callback gửi credential giả và tạo phiên Member', async ({ page }) => {
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
  await expect(page.getByText(/Đăng nhập Google thất bại|Google sign-in failed/i)).toBeVisible();
  expect(calls).toBe(1);
  await expect(page).toHaveURL(/\/login/);
});
