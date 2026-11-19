import { test, expect } from './helpers/guardedTest.js';
import { isApiMatch, navigateTo, setupDefaultApiMocks } from './helpers/mockAuth.js';
import { mockUsers } from './helpers/mockData.js';

async function loginWithUser(page, user, expectedUrlRegex) {
  let loggedIn = false;
  await page.route((url) => isApiMatch(url, 'auth/me'), (route) =>
    loggedIn
      ? route.fulfill({ status: 200, json: user })
      : route.fulfill({ status: 401, json: { message: 'Unauthenticated' } }),
  );
  await page.route((url) => isApiMatch(url, 'auth/login'), (route) => {
    loggedIn = true;
    return route.fulfill({ status: 200, json: user });
  });
  await page.goto('/login');
  await page.locator('#login-email').fill(user.email);
  await page.locator('#login-password').fill('Password123');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(expectedUrlRegex, { timeout: 10000 });
}

test.describe('E4: Tuyến tạo hội viên theo authority', () => {
  test.beforeEach(async ({ page }) => {
    await setupDefaultApiMocks(page, [
      '/api/members',
      '/api/classes',
      '/api/packages',
      '/api/sessions',
      '/api/notifications',
      '/api/notifications/me',
      '/api/invoices',
      '/api/subjects',
    ]);
  });

  test('Lễ tân có REGISTER_MEMBER (không MANAGE_USERS) tạo hội viên gọi POST /api/members/register', async ({ page }) => {
    const postUrls = [];
    await page.route((url) => new URL(url).pathname === '/api/members/register', async (route) => {
      postUrls.push('/api/members/register');
      return route.fulfill({
        status: 201,
        json: { id: 301, fullName: 'Hội Viên Lễ Tân', email: 'hv.letan@example.com', phone: '0901112223', status: 'Active' },
      });
    });

    const receptionist = {
      ...mockUsers.receptionist,
      authorities: ['ROLE_RECEPTIONIST', 'REGISTER_MEMBER'],
    };
    await loginWithUser(page, receptionist, /\/receptionist/);
    await navigateTo(page, '/receptionist/search');

    await page.getByRole('button', { name: /Thêm thành viên|Tạo Thành Viên Mới/i }).first().click();
    await page.getByPlaceholder(/Nguyễn Văn A|Họ và tên/i).first().fill('Hội Viên Lễ Tân');
    await page.locator('input[type="email"]').first().fill('hv.letan@example.com');
    await page.locator('input[type="tel"]').first().fill('0901112223');
    await page.getByRole('button', { name: /Tạo hồ sơ/i }).click();

    await expect.poll(() => postUrls.length, { timeout: 10000 }).toBe(1);
    expect(postUrls[0]).toBe('/api/members/register');
  });

  test('Quản lý có MANAGE_USERS tạo hội viên vẫn gọi POST /api/members', async ({ page }) => {
    const postUrls = [];
    await page.route((url) => new URL(url).pathname === '/api/members', async (route) => {
      if (route.request().method() === 'POST') {
        postUrls.push('/api/members');
        return route.fulfill({
          status: 201,
          json: { id: 302, fullName: 'Hội Viên Quản Lý', email: 'hv.ql@example.com', phone: '0902223334', status: 'Active' },
        });
      }
      return route.fulfill({ status: 200, json: [] });
    });

    const manager = {
      ...mockUsers.manager,
      authorities: ['ROLE_CENTER_MANAGER', 'MANAGE_USERS'],
    };
    await loginWithUser(page, manager, /\/manager/);
    await navigateTo(page, '/manager/members');

    await page.getByRole('button', { name: /Thêm thành viên|Tạo Thành Viên Mới/i }).first().click();
    await page.getByPlaceholder(/Nguyễn Văn A|Họ và tên/i).first().fill('Hội Viên Quản Lý');
    await page.locator('input[type="email"]').first().fill('hv.ql@example.com');
    await page.locator('input[type="tel"]').first().fill('0902223334');
    await page.getByRole('button', { name: /Tạo hồ sơ/i }).click();

    await expect.poll(() => postUrls.length, { timeout: 10000 }).toBe(1);
    expect(postUrls[0]).toBe('/api/members');
  });
});
