import { test, expect } from './helpers/guardedTest.js';
import { isApiMatch, setupDefaultApiMocks, loginAs } from './helpers/mockAuth.js';
import { mockUsers } from './helpers/mockData.js';

const BASE_ADMIN = { ...mockUsers.admin, authorities: ['ROLE_ADMIN', 'MANAGE_USERS', 'MANAGE_RBAC', 'MANAGE_PERMISSIONS', 'VIEW_AUDIT_LOG'] };
const OPS_ADMIN = { ...BASE_ADMIN, authorities: [...BASE_ADMIN.authorities, 'MANAGE_INVOICES', 'MANAGE_CLASSES', 'REGISTER_MEMBER'] };

// Mục Admin chỉ hiện khi có quyền tương ứng (requiredAuthority trong adminNav.js).
const GATED_ITEMS = ['Lớp Normal', 'Lớp Advanced', 'Thanh toán', 'Hoàn tiền Normal', 'Thu ngân'];
const OPEN_ITEMS = ['Nhân sự', 'Tổng quan lễ tân', 'Tra cứu hội viên'];
// Site Admin không còn hai mục này (BE không trả dữ liệu theo trung tâm cho tài khoản Admin).
const REMOVED_ITEMS = ['Tổng quan quản lý', 'Báo cáo'];

async function loginAsAdmin(page, user) {
  let loggedIn = false;
  await page.route((url) => isApiMatch(url, 'auth/me'), (route) => loggedIn
    ? route.fulfill({ status: 200, json: user })
    : route.fulfill({ status: 401, json: { message: 'Unauthenticated' } }));
  await page.route((url) => isApiMatch(url, 'auth/login'), (route) => { loggedIn = true; return route.fulfill({ status: 200, json: user }); });
  await page.goto('/login');
  await page.locator('#login-email').fill(user.email);
  await page.locator('#login-password').fill('Password123');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
}

test.describe('Menu: Admin ẩn theo quyền, Member không còn Bảo lưu (L07, L08)', () => {
  test.beforeEach(async ({ page }) => {
    await setupDefaultApiMocks(page, ['/api/members', '/api/classes', '/api/audit-logs', '/api/users', '/api/roles', '/api/permissions', '/api/reports/dashboard', '/api/notifications', '/api/notifications/me']);
  });

  const labelsIn = async (page) => {
    const nav = page.getByRole('navigation').first();
    await expect(nav).toBeVisible({ timeout: 15000 });
    return nav;
  };

  test('MENU-01: Admin chưa có MANAGE_CLASSES/MANAGE_INVOICES không thấy mục vận hành cần các quyền đó', async ({ page }) => {
    await loginAsAdmin(page, BASE_ADMIN);
    const nav = await labelsIn(page);
    for (const label of GATED_ITEMS) {
      await expect(nav.getByRole('button', { name: label, exact: true })).toHaveCount(0);
    }
    // Mục không cần quyền riêng vẫn còn (nhóm không bị ẩn hết).
    await expect(page.getByRole('button', { name: /Quản lý trung tâm/ })).toBeVisible();
    await page.getByRole('button', { name: /Quản lý trung tâm/ }).click();
    await expect(nav.getByRole('button', { name: 'Nhân sự', exact: true })).toBeVisible();
  });

  test('MENU-02: Admin có đủ quyền vận hành thấy lại toàn bộ mục', async ({ page }) => {
    await loginAsAdmin(page, OPS_ADMIN);
    const nav = await labelsIn(page);
    await page.getByRole('button', { name: /Quản lý trung tâm/ }).click();
    await page.getByRole('button', { name: /^Lễ tân$/ }).click();
    for (const label of [...GATED_ITEMS, ...OPEN_ITEMS]) {
      await expect(nav.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    for (const label of REMOVED_ITEMS) {
      await expect(nav.getByRole('button', { name: label, exact: true })).toHaveCount(0);
    }
  });

  test('MENU-03: menu Member không còn "Bảo lưu gói tập"', async ({ page }) => {
    await page.route((url) => new URL(url).pathname === '/api/members/101/subscriptions', (r) => r.fulfill({ status: 200, json: [] }));
    await loginAs(page, 'member');
    await page.goto('/member/dashboard');
    const nav = page.getByRole('navigation').first();
    await expect(nav.getByRole('button', { name: 'Gói hội viên của tôi' })).toBeVisible({ timeout: 15000 });
    await expect(nav.getByRole('button', { name: /Bảo lưu gói tập/ })).toHaveCount(0);
  });
});
