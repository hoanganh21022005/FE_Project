import { test, expect } from './helpers/guardedTest.js';
import { isApiMatch, setupDefaultApiMocks } from './helpers/mockAuth.js';
import { mockUsers } from './helpers/mockData.js';

async function mockUnauthenticated(page) {
  await page.route((url) => isApiMatch(url, 'auth/me'), async (route) => {
    return route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthenticated' }),
    });
  });
}

test.describe('Admin Login View (W-E2)', () => {
  test('ADMIN-LOGIN-01: Hiển thị sạch, không header/footer chính, dọn localStorage, đúng VI/EN và thuộc tính bảo mật', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await mockUnauthenticated(page);

    // Đặt sẵn khóa scms_recent_login_emails trước khi mở /admin/login
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('scms_recent_login_emails', JSON.stringify(['cached@example.invalid']));
    });

    await page.goto('/admin/login');
    await expect(page.locator('#admin-login-email')).toBeVisible();

    // Không có header/footer chính hay các liên kết công khai
    await expect(page.locator('header')).toHaveCount(0);
    await expect(page.locator('footer')).toHaveCount(0);

    const bodyText = await page.locator('body').innerText();
    for (const forbidden of [
      'Trang chủ',
      'Về chúng tôi',
      'Khóa học',
      'Huấn luyện viên',
      'Cơ sở vật chất',
      'Ghi nhớ tài khoản',
      'admin@scms.com',
      '@gmail.com',
      '@fpt.edu.vn',
      '@vibesport.vn',
      'Google',
      'Quên mật khẩu',
      'Đăng ký',
      'SYSTEM ADMINISTRATION',
      'demo',
      'Demo',
    ]) {
      expect(bodyText).not.toContain(forbidden);
    }

    // VI labels
    expect(bodyText).toContain('KHU VỰC QUẢN TRỊ');
    expect(bodyText).toContain('Đăng nhập Quản trị');
    expect(bodyText).toContain('Chỉ dành cho Quản trị hệ thống');

    // Thuộc tính ô email và mật khẩu
    const emailInput = page.locator('#admin-login-email');
    const passwordInput = page.locator('#admin-login-password');
    await expect(emailInput).toHaveValue('');
    await expect(emailInput).toHaveAttribute('autocomplete', 'off');
    await expect(emailInput).toHaveAttribute('placeholder', '');
    const emailName = await emailInput.getAttribute('name');
    expect(emailName).not.toBe('email');
    expect(emailName).not.toBe('username');

    await expect(passwordInput).toHaveValue('');
    await expect(passwordInput).toHaveAttribute('autocomplete', 'new-password');
    await expect(passwordInput).toHaveAttribute('placeholder', '');

    // Khóa scms_recent_login_emails đã bị xóa và storage không chứa email
    const storageCheck = await page.evaluate(() => ({
      recentKey: localStorage.getItem('scms_recent_login_emails'),
      localDump: JSON.stringify(localStorage),
      sessionDump: JSON.stringify(sessionStorage),
    }));
    expect(storageCheck.recentKey).toBeNull();
    expect(storageCheck.localDump).not.toContain('@');
    expect(storageCheck.sessionDump).not.toContain('@');

    // Chuyển sang EN và kiểm tra không có ký tự tiếng Việt có dấu
    const langBtn = page.getByRole('button', { name: /Chuyển sang tiếng Anh|Switch to Vietnamese/i });
    await langBtn.click();
    await expect(page.getByRole('heading', { name: 'Admin sign-in' })).toBeVisible();
    const enText = await page.locator('body').innerText();
    expect(enText).toContain('ADMINISTRATION');
    expect(enText).toContain('System Administrators only');
    expect(enText).not.toMatch(/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i);
  });

  test('ADMIN-LOGIN-02: /admin/* khi chưa đăng nhập cũng render AdminLoginView', async ({ page }) => {
    await setupDefaultApiMocks(page);
    await mockUnauthenticated(page);

    await page.goto('/admin/users');
    await expect(page.locator('#admin-login-email')).toBeVisible();
    await expect(page.locator('#admin-login-password')).toBeVisible();
    await expect(page.locator('header')).toHaveCount(0);
  });

  test('ADMIN-LOGIN-03: Tài khoản không phải Admin bị đăng xuất ngay và báo lỗi; Admin vào được dashboard', async ({ page }) => {
    await setupDefaultApiMocks(page, ['/api/users', '/api/roles', '/api/permissions', '/api/members', '/api/classes']);
    let currentUser = null;
    let logoutCalled = false;

    await page.route((url) => isApiMatch(url, 'auth/me'), async (route) => {
      if (currentUser) {
        return route.fulfill({ status: 200, json: currentUser });
      }
      return route.fulfill({ status: 401, json: { message: 'Unauthenticated' } });
    });

    await page.route((url) => isApiMatch(url, 'auth/logout'), async (route) => {
      logoutCalled = true;
      currentUser = null;
      return route.fulfill({ status: 200, json: {} });
    });

    await page.route((url) => isApiMatch(url, 'auth/login'), async (route) => {
      const body = route.request().postDataJSON();
      if (body?.email === mockUsers.manager.email) {
        currentUser = mockUsers.manager;
        return route.fulfill({ status: 200, json: mockUsers.manager });
      }
      if (body?.email === mockUsers.admin.email) {
        currentUser = mockUsers.admin;
        return route.fulfill({ status: 200, json: mockUsers.admin });
      }
      return route.fulfill({ status: 401, json: { message: 'Invalid username or password' } });
    });

    await page.goto('/admin/login');
    await page.locator('#admin-login-email').fill(mockUsers.manager.email);
    await page.locator('#admin-login-password').fill('Secret123!');
    await page.locator('button[type="submit"]').click();

    await expect(page.getByRole('alert')).toContainText('Tài khoản này không có quyền quản trị.');
    expect(logoutCalled).toBe(true);
    await expect(page).toHaveURL(/\/admin\/login/);

    // Thử sai mật khẩu -> không lộ thông báo tiếng Anh nguyên văn từ Backend
    await page.locator('#admin-login-email').fill('wrong@example.invalid');
    await page.locator('#admin-login-password').fill('Wrong123!');
    await page.locator('button[type="submit"]').click();
    const alertText = await page.getByRole('alert').innerText();
    expect(alertText).not.toContain('Invalid username or password');
    expect(alertText).toContain('Thông tin đăng nhập không chính xác');

    // Đăng nhập đúng tài khoản Admin -> vào /admin/dashboard
    await page.locator('#admin-login-email').fill(mockUsers.admin.email);
    await page.locator('#admin-login-password').fill('AdminPass123!');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 10000 });
  });
});
