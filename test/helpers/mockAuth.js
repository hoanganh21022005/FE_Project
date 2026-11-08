import { expect } from '@playwright/test';
import { mockUsers } from './mockData.js';

/**
 * Kiểm tra xem URL có phải là API REST của backend hay không (loại trừ các file JS/JSX của Vite trong /src/)
 * @param {string|URL} url
 * @param {string} [endpoint] Tên endpoint (ví dụ: 'classes', 'invoices', 'members')
 */
export function isApiMatch(url, endpoint) {
  const parsed = typeof url === 'string' ? new URL(url, 'http://localhost:5173') : url;
  const p = parsed.pathname;

  // Bỏ qua các file source và asset của Vite
  if (p.startsWith('/src/') || p.includes('@') || p.endsWith('.js') || p.endsWith('.jsx') || p.endsWith('.css') || p.endsWith('.html')) {
    return false;
  }

  if (endpoint) {
    return p === `/api/${endpoint}` || p.startsWith(`/api/${endpoint}/`);
  }
  return p.startsWith('/api/');
}

/**
 * Cài đặt bộ mock mặc định cho tất cả các API phụ trợ của SCMS (subjects, rooms, packages, staff, ...)
 * Đảm bảo không bao giờ bị rò rỉ 401 Unauthorized từ proxy backend làm văng phiên đăng nhập.
 * @param {import('@playwright/test').Page} page
 */
export async function setupDefaultApiMocks(page, auxiliaryPaths = []) {
  // Auxiliary GETs are explicitly mocked; other requests hit the test guard.
  const paths = ['subjects', 'rooms', 'coaches', 'staff', 'packages', 'notifications'];
  await page.route((url) => paths.some((path) => url.pathname === `/api/${path}`) || ['/api/notifications/me', '/api/reports/dashboard', '/api/audit-logs', ...auxiliaryPaths].includes(url.pathname), async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({ status: 200, json: [] });
  });
}

/**
 * Mô phỏng người dùng nhập email, mật khẩu và click Đăng nhập
 * @param {import('@playwright/test').Page} page
 * @param {keyof typeof mockUsers} roleKey
 */
export async function loginAs(page, roleKey = 'manager') {
  const user = mockUsers[roleKey];
  let loggedIn = false;

  await page.route((url) => isApiMatch(url, 'auth/me'), async (route) => {
    if (loggedIn) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(user),
      });
    }
    return route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthenticated' }),
    });
  });

  await page.route((url) => isApiMatch(url, 'auth/login'), async (route) => {
    loggedIn = true;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(user),
    });
  });

  await page.goto('/login');
  await page.locator('#login-email').fill(user.email);
  await page.locator('#login-password').fill('Password123');
  await page.locator('button[type="submit"]').click();

  // Chờ chuyển hướng hoàn tất vào portal của role
  await expect(page).toHaveURL(new RegExp(`/${user.role}`), { timeout: 10000 });
}

/**
 * Mô phỏng người dùng click menu điều hướng trên Sidebar
 * @param {import('@playwright/test').Page} page
 * @param {string} path Ví dụ: '/manager/classes'
 */
export async function navigateTo(page, path) {
  const link = page.locator(`aside a[href="${path}"], nav a[href="${path}"]`).first();
  if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
    await link.click();
  } else {
    await page.evaluate((target) => {
      window.history.pushState(null, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, path);
  }
  const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await expect(page).toHaveURL(new RegExp(escapedPath), { timeout: 10000 });
}
