import { test, expect } from './helpers/guardedTest.js';
import { mockUsers } from './helpers/mockData.js';
import { setupDefaultApiMocks, isLocalApi } from './helpers/mockAuth.js';

test.describe('Kịch bản Xác thực & Phân quyền (AUTH-01 -> AUTH-07)', () => {
  test.beforeEach(async ({ page }) => {
    await setupDefaultApiMocks(page, ['/api/members', '/api/classes', '/api/invoices', '/api/members/101/enrollments', '/api/members/101/subscriptions', '/api/members/me/invoices']);
    // Chặn mặc định các API không mong muốn
    await page.route((url) => isLocalApi(url, '/api/auth/me'), async (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthenticated' }),
      });
    });
  });

  // AUTH-01: Mở /login desktop và mobile, kiểm tra bằng bàn phím
  test('AUTH-01: Mở /login trên Desktop và Mobile, tương tác bằng bàn phím', async ({ page }) => {
    // 1. Kiểm tra trên Desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/login');

    const emailInput = page.locator('#login-email');
    const passwordInput = page.locator('#login-password');
    const loginButton = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();

    // Kiểm tra tương tác bàn phím (focus, gõ phím)
    await emailInput.focus();
    await page.keyboard.type('test.keyboard@scms.com');
    await expect(emailInput).toHaveValue('test.keyboard@scms.com');

    await passwordInput.focus();
    await page.keyboard.type('Secret123');
    await expect(passwordInput).toHaveValue('Secret123');

    // 2. Kiểm tra trên Mobile Viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();
  });

  // AUTH-02: Để trống email hoặc mật khẩu, submit
  test('AUTH-02: Để trống email hoặc mật khẩu khi submit thì báo lỗi và không gửi API', async ({ page }) => {
    let loginRequestSent = 0;
    page.on('request', (req) => {
      if (req.url().includes('/api/auth/login')) loginRequestSent++;
    });

    await page.goto('/login');
    const loginButton = page.locator('button[type="submit"]');

    // 1. Để trống cả 2 trường và bấm Đăng nhập
    await loginButton.click();
    await expect(
      page.getByText(/Vui lòng nhập đầy đủ email và mật khẩu|Please enter both your email and password/i)
    ).toBeVisible();
    expect(loginRequestSent).toBe(0);

    // 2. Chỉ nhập email, để trống mật khẩu
    await page.locator('#login-email').fill('user@example.com');
    await loginButton.click();
    await expect(
      page.getByText(/Vui lòng nhập đầy đủ email và mật khẩu|Please enter both your email and password/i)
    ).toBeVisible();
    expect(loginRequestSent).toBe(0);
  });

  // AUTH-03: Nhập sai thông tin và submit
  test('AUTH-03: Nhập sai thông tin đăng nhập, POST login trả 401, hiển thị thông báo lỗi và ở lại trang', async ({ page }) => {
    await page.route((url) => isLocalApi(url, '/api/auth/login'), async (route) => {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Tài khoản hoặc mật khẩu không chính xác' }),
      });
    });

    await page.goto('/login');
    await page.locator('#login-email').fill('wrong@scms.com');
    await page.locator('#login-password').fill('WrongPass123');

    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('/api/auth/login') && req.method() === 'POST'
    );
    await page.locator('button[type="submit"]').click();
    const req = await requestPromise;

    expect(req.postDataJSON()).toEqual({
      email: 'wrong@scms.com',
      password: 'WrongPass123',
    });

    // Xác nhận hiển thị thông báo lỗi và vẫn ở lại URL /login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('form').locator('..').getByText(/không chính xác|invalid|sai/i).first()).toBeVisible();
  });

  // AUTH-04: Đăng nhập hợp lệ lần lượt Member, Receptionist, Manager, Coach
  const roles = [
    { roleKey: 'member', path: '/member/dashboard', user: mockUsers.member },
    { roleKey: 'receptionist', path: '/receptionist/dashboard', user: mockUsers.receptionist },
    { roleKey: 'manager', path: '/manager/dashboard', user: mockUsers.manager },
    { roleKey: 'coach', path: '/coach/dashboard', user: mockUsers.coach },
  ];

  for (const item of roles) {
    test(`AUTH-04: Đăng nhập hợp lệ với vai trò ${item.user.role} (${item.user.email})`, async ({ page }) => {
      // Mock API đăng nhập và me
      let loggedIn = false;
      await page.route((url) => isLocalApi(url, '/api/auth/login'), async (route) => {
        loggedIn = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(item.user),
        });
      });

      await page.route((url) => isLocalApi(url, '/api/auth/me'), async (route) => {
        if (!loggedIn) return route.fulfill({ status: 401, json: { message: 'Unauthenticated' } });
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(item.user),
        });
      });

      await page.goto('/login');
      await page.locator('#login-email').fill(item.user.email);
      await page.locator('#login-password').fill('Password123');
      await page.locator('button[type="submit"]').click();

      // Kiểm tra chuyển hướng vào dashboard tương ứng
      await expect(page).toHaveURL(new RegExp(item.path), { timeout: 10000 });
    });
  }

  // AUTH-05: Đăng nhập, F5, sau đó logout và mở URL được bảo vệ
  test('AUTH-05: Đăng nhập, F5 duy trì phiên, sau đó logout và chặn vào URL bảo vệ', async ({ page }) => {
    const managerUser = mockUsers.manager;
    let isAuthenticatedState = false;

    await page.route((url) => isLocalApi(url, '/api/auth/login'), async (route) => {
      isAuthenticatedState = true;
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(managerUser) });
    });

    await page.route((url) => isLocalApi(url, '/api/auth/me'), async (route) => {
      if (isAuthenticatedState) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(managerUser) });
      }
      return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Unauthenticated' }) });
    });

    await page.route((url) => isLocalApi(url, '/api/auth/logout'), async (route) => {
      isAuthenticatedState = false;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Success' }) });
    });

    // 1. Đăng nhập
    await page.goto('/login');
    await page.locator('#login-email').fill(managerUser.email);
    await page.locator('#login-password').fill('Password123');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/manager\/dashboard/, { timeout: 10000 });

    // 2. F5 Reload trang - phiên còn hạn được phục hồi
    await page.reload();
    await expect(page).toHaveURL(/\/manager\/dashboard/);

    // 3. Logout
    const logoutBtn = page.getByRole('button', { name: /Đăng xuất|Logout/i }).first();
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click();
    } else {
      const userMenu = page.locator('header button').last();
      await userMenu.click();
      await page.getByText(/Đăng xuất|Logout/i).click();
    }

    // Sau logout, thử mở lại trang quản lý được bảo vệ
    await page.goto('/manager/classes');
    // Khi chưa đăng nhập, UI không hiển thị trang riêng mà hiển thị màn hình đăng nhập
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('table')).not.toBeVisible();
  });

  // AUTH-06: Vai trò không phù hợp mở trực tiếp route và gọi API được bảo vệ
  test('AUTH-06: Vai trò không phù hợp (Member) mở route quản trị (/manager/classes) bị chặn 403', async ({ page }) => {
    const memberUser = mockUsers.member;

    await page.route((url) => isLocalApi(url, '/api/auth/me'), async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(memberUser) });
    });

    await page.addInitScript(() => {
      window.sessionStorage.setItem('scms_mock_authenticated', 'true');
      window.sessionStorage.setItem('scms_mock_role', 'member');
    });

    // Member cố tình mở trang của Manager
    await page.goto('/manager/classes');

    // UI không được lộ bảng quản lý lớp và hiển thị cảnh báo từ chối quyền (403 Forbidden)
    await expect(
      page.getByText(/403|từ chối|không có quyền|Forbidden/i).first()
    ).toBeVisible();
    await expect(page.locator('table')).not.toBeVisible();
  });

  // AUTH-07: Mô phỏng phiên hết hạn, timeout hoặc mất mạng
  test('AUTH-07: Mô phỏng mất mạng khi submit login, hiển thị thông báo lỗi phù hợp', async ({ page }) => {
    await page.route((url) => isLocalApi(url, '/api/auth/login'), async (route) => {
      // Mô phỏng rớt mạng / kết nối thất bại
      route.abort('failed');
    });

    await page.goto('/login');
    await page.locator('#login-email').fill('user@scms.com');
    await page.locator('#login-password').fill('Password123');
    await page.locator('button[type="submit"]').click();

    // Đảm bảo không chuyển hướng vào dashboard và có thông báo lỗi
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/lỗi|kết nối|không thể|thất bại|failed/i).first()).toBeVisible();
  });
});
