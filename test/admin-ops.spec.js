import { test, expect } from './helpers/guardedTest.js';
import { isApiMatch, setupDefaultApiMocks } from './helpers/mockAuth.js';
import { mockClasses, mockInvoices, mockMembers, mockUsers } from './helpers/mockData.js';

const mockStaffList = [
  { id: 1, name: 'Nguyễn Văn Quản Lý', role: 'manager', email: 'manager@example.invalid', phone: '0901234567' },
  { id: 2, name: 'Trần Thị Lễ Tân', role: 'receptionist', email: 'rec@example.invalid', phone: '0907654321' },
];

const adminWithOpsPermissions = {
  ...mockUsers.admin,
  authorities: [
    'ROLE_ADMIN',
    'MANAGE_USERS',
    'MANAGE_RBAC',
    'MANAGE_PERMISSIONS',
    'VIEW_AUDIT_LOG',
    'MANAGE_INVOICES',
    'MANAGE_CLASSES',
  ],
};

async function loginAsCustom(page, user) {
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
  await expect(page).toHaveURL(new RegExp(`/${user.role}`), { timeout: 10000 });
}

test.describe('Kịch bản Admin Vận Hành Bao Trùm & Hồ Sơ Admin (W-A3)', () => {
  test.beforeEach(async ({ page }) => {
    await setupDefaultApiMocks(page, [
      '/api/members',
      '/api/staff',
      '/api/classes',
      '/api/invoices',
      '/api/specializations',
      '/api/holidays',
      '/api/packages',
      '/api/rooms',
      '/api/subjects',
      '/api/reports/dashboard',
      '/api/notifications',
      '/api/notifications/me',
      '/api/audit-logs',
      '/api/users',
      '/api/roles',
      '/api/permissions',
      '/api/sessions',
    ]);
  });

  // ADMIN-OPS-01: Admin mở từng route /admin/ops/* chính, màn render và gọi đúng API
  test('ADMIN-OPS-01: Admin mở các route /admin/ops/* chính, màn render và gọi đúng API', async ({ page }) => {
    let classesApiCalled = false;
    let membersApiCalled = false;
    let staffApiCalled = false;
    let invoicesApiCalled = false;

    await page.route((url) => isApiMatch(url, 'classes'), (route) => {
      classesApiCalled = true;
      return route.fulfill({ status: 200, json: mockClasses });
    });

    await page.route((url) => isApiMatch(url, 'members'), (route) => {
      membersApiCalled = true;
      return route.fulfill({ status: 200, json: mockMembers });
    });

    await page.route((url) => isApiMatch(url, 'staff'), (route) => {
      staffApiCalled = true;
      return route.fulfill({ status: 200, json: mockStaffList });
    });

    await page.route((url) => isApiMatch(url, 'invoices'), (route) => {
      invoicesApiCalled = true;
      return route.fulfill({ status: 200, json: mockInvoices });
    });

    await loginAsCustom(page, adminWithOpsPermissions);

    // 1. Quản lý lớp học trong cổng Admin
    await page.goto('/admin/ops/classes');
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 });
    expect(classesApiCalled).toBe(true);

    // 2. Quản lý hội viên trong cổng Admin
    await page.goto('/admin/ops/members');
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 });
    expect(membersApiCalled).toBe(true);

    // 3. Quản lý nhân sự trong cổng Admin
    await page.goto('/admin/ops/staff');
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 });
    expect(staffApiCalled).toBe(true);

    // 4. Quản lý thanh toán trong cổng Admin
    await page.goto('/admin/ops/payments');
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 });
    expect(invoicesApiCalled).toBe(true);

    // 5. Lễ tân check-in trong cổng Admin
    await page.goto('/admin/ops/reception/checkin');
    await expect(page.getByText('Điểm danh & Check-in').first()).toBeVisible({ timeout: 10000 });

    // 6. Lễ tân thu ngân trong cổng Admin
    await page.goto('/admin/ops/reception/payments');
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 });
  });

  // ADMIN-OPS-02: Link /manager/x và /receptionist/x được chuyển hướng sang /admin/ops/x trong cổng Admin
  test('ADMIN-OPS-02: Link /manager/x và /receptionist/x được chuyển hướng sang /admin/ops/x trong cổng Admin', async ({ page }) => {
    await page.route((url) => isApiMatch(url, 'classes'), (route) => {
      return route.fulfill({ status: 200, json: mockClasses });
    });
    await page.route((url) => isApiMatch(url, 'invoices'), (route) => {
      return route.fulfill({ status: 200, json: mockInvoices });
    });

    await loginAsCustom(page, adminWithOpsPermissions);

    // Truy cập đường dẫn cũ /manager/classes -> chuyển hướng sang /admin/ops/classes
    await page.goto('/manager/classes');
    await expect(page).toHaveURL(/\/admin\/ops\/classes/, { timeout: 10000 });
    await expect(page.locator('table').first()).toBeVisible();

    // Truy cập đường dẫn cũ /receptionist/payments -> chuyển hướng sang /admin/ops/reception/payments
    await page.goto('/receptionist/payments');
    await expect(page).toHaveURL(/\/admin\/ops\/reception\/payments/, { timeout: 10000 });
    await expect(page.locator('table').first()).toBeVisible();
  });

  // ADMIN-OPS-03: /coach/* và /member/* trong cổng Admin vẫn bị chặn 403 Forbidden
  test('ADMIN-OPS-03: /coach/* và /member/* trong cổng Admin vẫn là 403', async ({ page }) => {
    await loginAsCustom(page, adminWithOpsPermissions);

    // /coach/schedule trong cổng Admin phải hiển thị màn hình từ chối quyền 403
    await page.goto('/coach/schedule');
    await expect(page.locator('text=403')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Quyền truy cập bị từ chối')).toBeVisible();

    // /member/dashboard trong cổng Admin phải hiển thị 403
    await page.goto('/member/dashboard');
    await expect(page.locator('text=403')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Quyền truy cập bị từ chối')).toBeVisible();
  });

  // ADMIN-OPS-04: Backend 403 thì hiện trạng thái không có quyền (không trắng trang, không giấu lỗi)
  test('ADMIN-OPS-04: Backend 403 thì hiện trạng thái không có quyền', async ({ page }) => {
    await page.route((url) => isApiMatch(url, 'invoices'), (route) => {
      return route.fulfill({
        status: 403,
        json: { message: 'Access Denied: You do not have MANAGE_INVOICES permission' },
      });
    });

    await loginAsCustom(page, adminWithOpsPermissions);
    await page.goto('/admin/ops/payments');

    // Không được trắng trang, phải hiển thị giao diện chứa thông báo lỗi tải dữ liệu
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page.getByText('Lỗi tải dữ liệu')).toBeVisible({ timeout: 10000 });
  });

  // ADMIN-OPS-05: Manager và Receptionist vẫn vào được route cũ của mình; Manager không vào được /admin/*
  test('ADMIN-OPS-05: Manager và Receptionist giữ nguyên tính độc lập của route cũ', async ({ page }) => {
    await page.route((url) => isApiMatch(url, 'classes'), (route) => {
      return route.fulfill({ status: 200, json: mockClasses });
    });

    // 1. Manager vào route /manager/classes bình thường
    await loginAsCustom(page, mockUsers.manager);
    await page.goto('/manager/classes');
    await expect(page).toHaveURL(/\/manager\/classes/, { timeout: 10000 });
    await expect(page.locator('table').first()).toBeVisible();

    // 2. Manager cố vào /admin/users -> bị chặn bởi RequireRole và hiển thị màn hình Không có quyền truy cập
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'Không có quyền truy cập' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Truy cập bị từ chối')).toBeVisible();
  });

  // ADMIN-OPS-06: Hồ sơ Admin: đổi mật khẩu gửi đúng body, xử lý lỗi 400
  test('ADMIN-OPS-06: Hồ sơ Admin hiển thị quyền, form đổi mật khẩu gửi đúng body và xử lý lỗi 400', async ({ page }) => {
    let changePasswordPayload = null;

    await page.route((url) => isApiMatch(url, 'auth/change-password'), (route) => {
      changePasswordPayload = JSON.parse(route.request().postData() || '{}');
      if (changePasswordPayload.oldPassword === 'WrongPass123') {
        return route.fulfill({
          status: 400,
          json: { message: 'Mật khẩu hiện tại không chính xác' },
        });
      }
      return route.fulfill({
        status: 200,
        json: { message: 'Password changed successfully' },
      });
    });

    await loginAsCustom(page, adminWithOpsPermissions);
    await page.goto('/profile');

    // Render thông tin hồ sơ Admin
    await expect(page.getByRole('heading', { name: 'Hồ sơ Quản trị viên' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=admin@example.invalid')).toBeVisible();
    await expect(page.locator('text=Quản trị viên (Admin)')).toBeVisible();

    // Kiểm tra danh sách quyền authorities
    await expect(page.locator('text=MANAGE_USERS')).toBeVisible();
    await expect(page.locator('text=MANAGE_RBAC')).toBeVisible();

    // 1. Thử submit để trống -> lỗi validation tại chỗ
    await page.locator('button[type="submit"]:has-text("Cập nhật mật khẩu")').click();
    await expect(page.locator('text=Mật khẩu hiện tại là bắt buộc')).toBeVisible();

    // 2. Thử mật khẩu cũ sai -> gọi API và hiện lỗi 400 từ Backend
    await page.locator('#admin-old-password').fill('WrongPass123');
    await page.locator('#admin-new-password').fill('NewPass456');
    await page.locator('#admin-confirm-password').fill('NewPass456');
    await page.locator('button[type="submit"]:has-text("Cập nhật mật khẩu")').click();

    await expect(page.locator('div[role="alert"]:has-text("Mật khẩu hiện tại không chính xác")')).toBeVisible();
    expect(changePasswordPayload).toEqual({
      oldPassword: 'WrongPass123',
      newPassword: 'NewPass456',
    });

    // 3. Đổi mật khẩu đúng -> hiện thông báo thành công
    await page.locator('#admin-old-password').fill('CorrectOld123');
    await page.locator('#admin-new-password').fill('ValidPass789');
    await page.locator('#admin-confirm-password').fill('ValidPass789');
    await page.locator('button[type="submit"]:has-text("Cập nhật mật khẩu")').click();

    await expect(page.locator('div[role="alert"]:has-text("Đổi mật khẩu thành công")')).toBeVisible();
    expect(changePasswordPayload).toEqual({
      oldPassword: 'CorrectOld123',
      newPassword: 'ValidPass789',
    });
  });
});
