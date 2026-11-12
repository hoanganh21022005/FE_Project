import { test, expect } from './helpers/guardedTest.js';
import { isApiMatch, loginAs, setupDefaultApiMocks } from './helpers/mockAuth.js';

const mockAdminUsers = [
  {
    id: 1,
    code: 'USR-001',
    fullName: 'Nguyễn Văn Admin',
    email: 'admin@example.invalid',
    phone: '0901234567',
    status: 'active',
    roleId: 1,
    roleName: 'Admin',
    createdAt: '2026-01-15T08:00:00Z',
    permissions: ['MANAGE_USERS', 'MANAGE_RBAC', 'VIEW_AUDIT_LOGS'],
  },
  {
    id: 2,
    code: 'USR-002',
    fullName: 'Trần Thị Lễ Tân',
    email: 'receptionist@example.invalid',
    phone: '0907654321',
    status: 'active',
    roleId: 3,
    roleName: 'Receptionist',
    createdAt: '2026-02-10T09:30:00Z',
    permissions: ['PROCESS_PAYMENT'],
  },
  {
    id: 3,
    code: 'USR-003',
    fullName: 'Lê Hoàng Hội Viên',
    email: 'member@example.invalid',
    phone: '0911223344',
    status: 'locked',
    roleId: 5,
    roleName: 'Member',
    createdAt: '2026-03-01T10:00:00Z',
    permissions: [],
  },
];

const mockAdminPermissions = [
  { id: 1, name: 'MANAGE_USERS', description: 'Quản lý người dùng hệ thống' },
  { id: 2, name: 'MANAGE_RBAC', description: 'Quản lý vai trò và phân quyền' },
  { id: 3, name: 'VIEW_AUDIT_LOGS', description: 'Xem nhật ký an toàn' },
  { id: 4, name: 'PROCESS_PAYMENT', description: 'Xử lý và thu phí thanh toán' },
  { id: 5, name: 'MANAGE_PERMISSIONS', description: 'Quản trị phân quyền hệ thống' },
];

const mockAdminRoles = [
  {
    id: 1,
    name: 'Admin',
    description: 'Quản trị viên toàn quyền hệ thống',
    permissions: [
      { id: 1, name: 'MANAGE_USERS' },
      { id: 2, name: 'MANAGE_RBAC' },
      { id: 3, name: 'VIEW_AUDIT_LOGS' },
      { id: 5, name: 'MANAGE_PERMISSIONS' },
    ],
  },
  {
    id: 2,
    name: 'CenterManager',
    description: 'Quản lý trung tâm thể thao',
    permissions: [{ id: 1, name: 'MANAGE_USERS' }],
  },
  {
    id: 3,
    name: 'Receptionist',
    description: 'Nhân viên lễ tân thu ngân',
    permissions: [{ id: 4, name: 'PROCESS_PAYMENT' }],
  },
  {
    id: 4,
    name: 'Coach',
    description: 'Huấn luyện viên',
    permissions: [],
  },
  {
    id: 5,
    name: 'Member',
    description: 'Hội viên tham gia tập luyện',
    permissions: [],
  },
];

test.describe('Kịch bản Admin Thao Tác Ghi (ADMIN-WRITE-01 -> ADMIN-WRITE-09)', () => {
  let usersList;

  test.beforeEach(async ({ page }) => {
    usersList = JSON.parse(JSON.stringify(mockAdminUsers));

    await setupDefaultApiMocks(page, [
      '/api/members',
      '/api/classes',
      '/api/sessions',
      '/api/invoices',
      '/api/specializations',
    ]);

    await page.route((url) => isApiMatch(url, 'users'), (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        const u = new URL(route.request().url());
        const role = u.searchParams.get('role');
        if (role) {
          const filtered = usersList.filter((item) => item.roleName === role);
          return route.fulfill({ status: 200, json: filtered });
        }
        return route.fulfill({ status: 200, json: usersList });
      }
      return route.fallback();
    });

    await page.route((url) => isApiMatch(url, 'roles'), (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, json: mockAdminRoles });
      }
      return route.fallback();
    });

    await page.route((url) => isApiMatch(url, 'permissions'), (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, json: mockAdminPermissions });
      }
      return route.fallback();
    });

    await page.route((url) => isApiMatch(url, 'specializations'), (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, json: [{ id: 1, name: 'Cầu lông' }, { id: 2, name: 'Bơi lội' }] });
      }
      return route.fallback();
    });
  });

  // ADMIN-WRITE-01: Đổi trạng thái user (PATCH /api/users/{id}/status)
  test('ADMIN-WRITE-01: Đổi trạng thái user gửi đúng PATCH body và cập nhật giao diện', async ({ page }) => {
    let patchRequest = null;

    await page.route((url) => isApiMatch(url, 'users/2/status'), (route) => {
      if (route.request().method() === 'PATCH') {
        patchRequest = {
          url: route.request().url(),
          postData: JSON.parse(route.request().postData() || '{}'),
        };
        return route.fulfill({
          status: 200,
          json: { id: 2, status: 'Locked', message: 'Status updated' },
        });
      }
      return route.fallback();
    });

    await loginAs(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Mở menu thao tác của user Trần Thị Lễ Tân (id 2)
    const row = page.locator('tbody tr').filter({ hasText: 'Trần Thị Lễ Tân' });
    await row.locator('button[aria-label*="Thao tác"]').click();

    // Chọn "Đổi trạng thái"
    await page.locator('button[role="menuitem"]:has-text("Đổi trạng thái")').click();

    // Dialog mở ra
    const dialog = page.locator('div[role="dialog"][aria-labelledby="user-status-dialog-title"]');
    await expect(dialog).toBeVisible();

    // Chọn trạng thái "Locked"
    await dialog.locator('input[value="Locked"]').click();

    // Bấm "Lưu thay đổi"
    await dialog.locator('button[type="submit"]:has-text("Lưu thay đổi")').click();

    // Đảm bảo dialog đóng và thông báo thành công xuất hiện
    await expect(dialog).toBeHidden();
    await expect(page.locator('div[role="alert"]:has-text("Đã cập nhật trạng thái tài khoản")')).toBeVisible();

    // Assert request
    expect(patchRequest).not.toBeNull();
    expect(patchRequest.postData).toEqual({ status: 'Locked' });
  });

  // ADMIN-WRITE-02: Chốt chặn an toàn: không tự khóa tài khoản của mình và không khóa Admin Active cuối cùng
  test('ADMIN-WRITE-02: Chốt chặn an toàn vô hiệu hóa nút đổi trạng thái của chính mình và Admin Active cuối cùng', async ({ page }) => {
    let interceptedPatch = false;
    await page.route((url) => isApiMatch(url, 'users') && url.pathname.includes('/status'), (route) => {
      if (route.request().method() === 'PATCH') {
        interceptedPatch = true;
      }
      return route.fallback();
    });

    await loginAs(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // 1. Thử khóa Admin Active duy nhất (id 1 - Nguyễn Văn Admin)
    const adminRow = page.locator('tbody tr').filter({ hasText: 'Nguyễn Văn Admin' });
    await adminRow.locator('button[aria-label*="Thao tác"]').click();
    await page.locator('button[role="menuitem"]:has-text("Đổi trạng thái")').click();

    const dialog = page.locator('div[role="dialog"][aria-labelledby="user-status-dialog-title"]');
    await expect(dialog).toBeVisible();

    // Chốt chặn an toàn: hiển thị cảnh báo không thể tự thay đổi trạng thái của chính mình
    await expect(dialog.locator('text=Bạn không thể tự thay đổi trạng thái tài khoản của chính mình')).toBeVisible();

    // Các input radio và nút Lưu thay đổi phải bị disabled
    await expect(dialog.locator('input[value="Locked"]')).toBeDisabled();
    const submitBtn = dialog.locator('button[type="submit"]:has-text("Lưu thay đổi")');
    await expect(submitBtn).toBeDisabled();

    // Đóng dialog
    await dialog.locator('button[aria-label="Đóng"]').click();
    await expect(dialog).toBeHidden();

    // Khẳng định không có request PATCH nào được phát sinh
    expect(interceptedPatch).toBe(false);
  });

  // ADMIN-WRITE-03: Đổi vai trò user (PATCH /api/users/{id}/role)
  test('ADMIN-WRITE-03: Đổi vai trò user gửi đúng PATCH body roleId', async ({ page }) => {
    let rolePatchRequest = null;

    await page.route((url) => isApiMatch(url, 'users/2/role'), (route) => {
      if (route.request().method() === 'PATCH') {
        rolePatchRequest = {
          url: route.request().url(),
          postData: JSON.parse(route.request().postData() || '{}'),
        };
        return route.fulfill({
          status: 200,
          json: { id: 2, roleId: 4, message: 'Role updated' },
        });
      }
      return route.fallback();
    });

    await loginAs(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Mở menu thao tác của user 2
    const row = page.locator('tbody tr').filter({ hasText: 'Trần Thị Lễ Tân' });
    await row.locator('button[aria-label*="Thao tác"]').click();
    await page.locator('button[role="menuitem"]:has-text("Đổi vai trò")').click();

    const dialog = page.locator('div[role="dialog"][aria-labelledby="user-role-dialog-title"]');
    await expect(dialog).toBeVisible();

    // Chọn vai trò Huấn luyện viên (Coach - id 4)
    await dialog.locator('#select-user-role').selectOption('4');

    // Bấm "Lưu vai trò"
    await dialog.locator('button[type="submit"]:has-text("Lưu vai trò")').click();

    await expect(dialog).toBeHidden();
    await expect(page.locator('div[role="alert"]:has-text("Đã đổi vai trò tài khoản")')).toBeVisible();

    expect(rolePatchRequest).not.toBeNull();
    expect(rolePatchRequest.postData).toEqual({ roleId: 4 });
  });

  // ADMIN-WRITE-04: Cấp lại mật khẩu (POST /api/users/{id}/reissue-password)
  test('ADMIN-WRITE-04: Cấp lại mật khẩu cảnh báo đăng xuất và hiển thị kết quả thành công', async ({ page }) => {
    let reissueCalled = false;

    await page.route((url) => isApiMatch(url, 'users/2/reissue-password'), (route) => {
      if (route.request().method() === 'POST') {
        reissueCalled = true;
        return route.fulfill({
          status: 200,
          json: { emailSent: true, warning: null, message: 'Password reissued' },
        });
      }
      return route.fallback();
    });

    await loginAs(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    const row = page.locator('tbody tr').filter({ hasText: 'Trần Thị Lễ Tân' });
    await row.locator('button[aria-label*="Thao tác"]').click();
    await page.locator('button[role="menuitem"]:has-text("Cấp lại mật khẩu")').click();

    const dialog = page.locator('div[role="dialog"][aria-labelledby="user-reissue-pwd-title"]');
    await expect(dialog).toBeVisible();

    // Kiểm tra có cảnh báo gửi qua email và đăng xuất mọi phiên
    await expect(dialog).toContainText('gửi trực tiếp qua email');
    await expect(dialog).toContainText('đăng xuất toàn bộ các phiên làm việc');

    // Bấm xác nhận cấp lại mật khẩu
    await dialog.locator('button:has-text("Xác nhận cấp lại mật khẩu")').click();

    // Dialog chuyển sang trạng thái kết quả thành công
    await expect(dialog.locator('text=Cấp lại mật khẩu thành công')).toBeVisible();
    expect(reissueCalled).toBe(true);

    // Đóng dialog
    await dialog.locator('button:has-text("Đã hiểu và đóng")').click();
    await expect(dialog).toBeHidden();
  });

  // ADMIN-WRITE-05: Tạo tài khoản (POST /api/users), assert không có ô password, hiển thị lỗi 400 khi email trùng và khi thiếu center_id
  test('ADMIN-WRITE-05: Tạo tài khoản không có trường mật khẩu và hiển thị lỗi 400 khi email trùng', async ({ page }) => {
    let postUserPayload = null;

    await page.route((url) => isApiMatch(url, 'users'), (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        if (body.email === 'duplicate@example.invalid') {
          return route.fulfill({
            status: 400,
            json: { message: 'Email already exists: duplicate@example.invalid' },
          });
        }
        if (body.email === 'missing-center@example.invalid') {
          return route.fulfill({
            status: 400,
            json: { message: 'center_id is required when an Admin creates a non-admin account' },
          });
        }
        postUserPayload = body;
        return route.fulfill({
          status: 201,
          json: {
            id: 10,
            fullName: body.fullName,
            email: body.email,
            phone: body.phone,
            roleId: body.roleId,
            centerId: body.centerId,
            status: 'Active',
            emailSent: true,
          },
        });
      }
      return route.fallback();
    });

    await loginAs(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Bấm nút "Thêm người dùng"
    await page.locator('button:has-text("Thêm người dùng")').click();

    const modal = page.locator('div[role="dialog"][aria-labelledby="user-form-modal-title"]');
    await expect(modal).toBeVisible();

    // Khẳng định không có bất kỳ input password nào
    const passwordInputs = modal.locator('input[type="password"]');
    await expect(passwordInputs).toHaveCount(0);

    // Form tạo mới có trường vai trò, trạng thái và mã cơ sở (mặc định Member)
    await expect(modal.locator('#user-form-role')).toBeVisible();
    await expect(modal.locator('#user-form-status')).toBeVisible();
    const centerInput = modal.locator('#user-form-center');
    await expect(centerInput).toBeVisible();
    await expect(centerInput).toHaveValue('1');
    await expect(modal.locator('text=Hệ thống hiện có một cơ sở (mã 1)')).toBeVisible();

    // Khi chọn vai trò Quản trị viên (Admin), ô mã cơ sở bị ẩn
    await modal.locator('#user-form-role').selectOption('1');
    await expect(modal.locator('#user-form-center')).toHaveCount(0);

    // Khi chọn lại vai trò Lễ tân (Receptionist), ô mã cơ sở xuất hiện lại
    await modal.locator('#user-form-role').selectOption('3');
    await expect(modal.locator('#user-form-center')).toBeVisible();

    // Điền form với email trùng
    await modal.locator('#user-form-fullname').fill('Nguyễn Văn Trùng');
    await modal.locator('#user-form-email').fill('duplicate@example.invalid');
    await modal.locator('button[type="submit"]:has-text("Tạo tài khoản")').click();

    // Hiển thị lỗi 400 trùng email và không đóng form
    await expect(modal.locator('text=Địa chỉ email này đã tồn tại')).toBeVisible();

    // Mock lỗi 400 center_id is required: hiển thị lỗi ở ô Mã cơ sở
    await modal.locator('#user-form-email').fill('missing-center@example.invalid');
    await modal.locator('button[type="submit"]:has-text("Tạo tài khoản")').click();
    await expect(modal.locator('#user-form-center ~ p.text-status-danger')).toContainText('center_id is required');

    // Sửa thành email hợp lệ
    await modal.locator('#user-form-email').fill('newvalid@example.invalid');
    await modal.locator('#user-form-phone').fill('0988776655');
    await modal.locator('button[type="submit"]:has-text("Tạo tài khoản")').click();

    // Form đóng và hiển thị alert thành công
    await expect(modal).toBeHidden();
    await expect(page.locator('div[role="alert"]:has-text("Đã tạo tài khoản")')).toBeVisible();

    // Kiểm tra payload không có password và có centerId: 1
    expect(postUserPayload).not.toBeNull();
    expect(postUserPayload.password).toBeUndefined();
    expect(postUserPayload.fullName).toBe('Nguyễn Văn Trùng');
    expect(postUserPayload.email).toBe('newvalid@example.invalid');
    expect(postUserPayload.roleId).toBe(3);
    expect(postUserPayload.centerId).toBe(1);
  });

  // ADMIN-WRITE-06: Sửa tài khoản (PUT /api/users/{id})
  test('ADMIN-WRITE-06: Sửa thông tin tài khoản: không có trường vai trò hay trạng thái, email chỉ đọc, payload PUT không chứa roleId hay status', async ({ page }) => {
    let putUserPayload = null;

    await page.route((url) => isApiMatch(url, 'users/2'), (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          json: {
            id: 2,
            code: 'USR-002',
            fullName: 'Trần Thị Lễ Tân',
            email: 'receptionist@example.invalid',
            phone: '0907654321',
            status: 'active',
            roleId: 3,
            roleName: 'Receptionist',
            gender: 'FEMALE',
            dateOfBirth: '1995-05-15',
            address: 'Hà Nội',
          },
        });
      }
      if (method === 'PUT') {
        putUserPayload = JSON.parse(route.request().postData() || '{}');
        return route.fulfill({
          status: 200,
          json: { id: 2, ...putUserPayload },
        });
      }
      return route.fallback();
    });

    await loginAs(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    const row = page.locator('tbody tr').filter({ hasText: 'Trần Thị Lễ Tân' });
    await row.locator('button[aria-label*="Thao tác"]').click();
    await page.locator('button[role="menuitem"]:has-text("Chỉnh sửa thông tin")').click();

    const modal = page.locator('div[role="dialog"][aria-labelledby="user-form-modal-title"]');
    await expect(modal).toBeVisible();

    // Kiểm tra điền sẵn dữ liệu
    await expect(modal.locator('#user-form-fullname')).toHaveValue('Trần Thị Lễ Tân');
    await expect(modal.locator('#user-form-email')).toHaveValue('receptionist@example.invalid');

    // Chốt chặn Sửa: ô email phải là chỉ đọc (readOnly)
    await expect(modal.locator('#user-form-email')).toHaveAttribute('readonly', '');

    // Chốt chặn Sửa: không có trường vai trò hay trạng thái trong form sửa
    await expect(modal.locator('#user-form-role')).toHaveCount(0);
    await expect(modal.locator('#user-form-status')).toHaveCount(0);

    // Có dòng lưu ý về việc đổi vai trò và trạng thái
    await expect(modal.locator('text=Lưu ý về Vai trò & Trạng thái tài khoản')).toBeVisible();

    // Chỉnh sửa họ tên
    await modal.locator('#user-form-fullname').fill('Trần Thị Lễ Tân Cập Nhật');
    await modal.locator('button[type="submit"]:has-text("Lưu thay đổi")').click();

    await expect(modal).toBeHidden();
    await expect(page.locator('div[role="alert"]:has-text("Đã cập nhật thông tin tài khoản")')).toBeVisible();

    // Chốt chặn payload: giữ email gốc, không chứa roleId, roleName, status, centerId
    expect(putUserPayload).not.toBeNull();
    expect(putUserPayload.fullName).toBe('Trần Thị Lễ Tân Cập Nhật');
    expect(putUserPayload.email).toBe('receptionist@example.invalid');
    expect(putUserPayload.roleId).toBeUndefined();
    expect(putUserPayload.roleName).toBeUndefined();
    expect(putUserPayload.status).toBeUndefined();
    expect(putUserPayload.centerId).toBeUndefined();
  });

  // ADMIN-WRITE-07: Sửa quyền vai trò (PUT /api/roles/{id}/permissions)
  test('ADMIN-WRITE-07: Sửa quyền vai trò chặn rút quyền cốt lõi của Admin và tóm tắt quyền thêm bớt trong dialog xác nhận', async ({ page }) => {
    let putRolePermsPayload = null;

    await page.route((url) => isApiMatch(url, 'roles/3/permissions'), (route) => {
      if (route.request().method() === 'PUT') {
        putRolePermsPayload = JSON.parse(route.request().postData() || '{}');
        return route.fulfill({
          status: 200,
          json: { roleId: 3, permissions: [4, 1] },
        });
      }
      return route.fallback();
    });

    await loginAs(page, 'admin');
    await page.goto('/admin/roles');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Bật chế độ chỉnh sửa phân quyền
    await page.locator('button:has-text("Chỉnh sửa phân quyền")').click();

    // Kiểm tra ô quyền MANAGE_RBAC và MANAGE_USERS của vai trò Admin bị khóa (có icon khóa hoặc aria locked)
    const adminLockedCell = page.locator('tbody tr').filter({ hasText: 'Quản lý vai trò & quyền' });
    await expect(adminLockedCell.locator('span.sr-only:has-text("Bắt buộc có")').first()).toBeVisible();

    // Cấp quyền MANAGE_USERS (id 1) cho vai trò Receptionist (roleId 3)
    const manageUsersRow = page.locator('tbody tr').filter({ hasText: 'Quản lý người dùng' });
    // Click vào nút toggle phân quyền của cột Lễ tân (Receptionist)
    const toggleBtn = manageUsersRow.locator('button[aria-label*="Lễ tân"]').first();
    await toggleBtn.click();

    // Nút lưu thay đổi hiển thị số lượng thay đổi
    const saveBtn = page.locator('button:has-text("Lưu thay đổi (1)")');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Modal xác nhận AdminConfirmDialog hiển thị tóm tắt
    const confirmDialog = page.locator('div[role="dialog"][aria-labelledby="admin-confirm-title"]');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText('Lễ tân');
    await expect(confirmDialog).toContainText('+ Thêm:');
    await expect(confirmDialog).toContainText('Quản lý người dùng');
    await expect(confirmDialog).toContainText('Người dùng thuộc các vai trò này có thể phải đăng nhập lại');

    // Xác nhận lưu
    await confirmDialog.locator('button:has-text("Xác nhận lưu")').click();

    await expect(confirmDialog).toBeHidden();
    await expect(page.locator('div[role="alert"]:has-text("Cập nhật phân quyền vai trò thành công")')).toBeVisible();

    expect(putRolePermsPayload).not.toBeNull();
    expect(putRolePermsPayload.permissionIds).toContain(1);
    expect(putRolePermsPayload.permissionIds).toContain(4);
  });

  // ADMIN-WRITE-08: Hộp xác nhận bấm Hủy thì không gửi request nào
  test('ADMIN-WRITE-08: Hộp xác nhận phân quyền bấm Hủy thì không gửi request mutation nào', async ({ page }) => {
    let mutationCalled = false;

    await page.route((url) => isApiMatch(url, 'roles') && url.pathname.includes('/permissions'), (route) => {
      if (route.request().method() === 'PUT') {
        mutationCalled = true;
      }
      return route.fallback();
    });

    await loginAs(page, 'admin');
    await page.goto('/admin/roles');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    await page.locator('button:has-text("Chỉnh sửa phân quyền")').click();

    const manageUsersRow = page.locator('tbody tr').filter({ hasText: 'Quản lý người dùng' });
    await manageUsersRow.locator('button[aria-label*="Lễ tân"]').first().click();

    await page.locator('button:has-text("Lưu thay đổi (1)")').click();

    const confirmDialog = page.locator('div[role="dialog"][aria-labelledby="admin-confirm-title"]');
    await expect(confirmDialog).toBeVisible();

    // Bấm nút Hủy bỏ trong dialog
    await confirmDialog.locator('button:has-text("Hủy bỏ")').click();
    await expect(confirmDialog).toBeHidden();

    // Bấm Hủy bỏ chế độ chỉnh sửa
    await page.locator('button:has-text("Hủy bỏ")').click();

    expect(mutationCalled).toBe(false);
  });

  // ADMIN-WRITE-09: Xử lý lỗi 403 Forbidden hiển thị thông báo quyền, không xóa dữ liệu đang hiển thị
  test('ADMIN-WRITE-09: Thao tác ghi gặp 403 Forbidden hiển thị thông báo từ chối quyền và giữ nguyên dữ liệu', async ({ page }) => {
    await page.route((url) => isApiMatch(url, 'users/2/status'), (route) => {
      if (route.request().method() === 'PATCH') {
        return route.fulfill({
          status: 403,
          json: { message: 'Bạn không có quyền thực hiện thao tác này' },
        });
      }
      return route.fallback();
    });

    await loginAs(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    const row = page.locator('tbody tr').filter({ hasText: 'Trần Thị Lễ Tân' });
    await row.locator('button[aria-label*="Thao tác"]').click();
    await page.locator('button[role="menuitem"]:has-text("Đổi trạng thái")').click();

    const dialog = page.locator('div[role="dialog"][aria-labelledby="user-status-dialog-title"]');
    await expect(dialog).toBeVisible();

    await dialog.locator('input[value="Inactive"]').click();
    await dialog.locator('button[type="submit"]:has-text("Lưu thay đổi")').click();

    // Dialog hiển thị thông báo 403
    await expect(dialog.locator('text=Bạn không có quyền thực hiện thao tác này.')).toBeVisible();

    // Bấm đóng dialog
    await dialog.locator('button[aria-label="Đóng"]').click();
    await expect(dialog).toBeHidden();

    // Bảng dữ liệu người dùng bên dưới vẫn nguyên vẹn
    await expect(page.locator('tbody tr')).toHaveCount(3);
    await expect(page.locator('tbody')).toContainText('Nguyễn Văn Admin');
    await expect(page.locator('tbody')).toContainText('Trần Thị Lễ Tân');
  });

  // ADMIN-WRITE-10: Cả 3 quyền cốt lõi của vai trò Admin (MANAGE_RBAC, MANAGE_USERS, MANAGE_PERMISSIONS) đều bị khóa cứng
  test('ADMIN-WRITE-10: Cả 3 quyền cốt lõi MANAGE_RBAC, MANAGE_USERS, MANAGE_PERMISSIONS của Admin bị khóa cứng, không thể gỡ', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/roles');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    await page.locator('button:has-text("Chỉnh sửa phân quyền")').click();

    // 1. Kiểm tra MANAGE_RBAC bị khóa
    const rbacRow = page.locator('tbody tr').filter({ hasText: 'Quản lý vai trò & quyền' });
    await expect(rbacRow.locator('span.sr-only:has-text("Bắt buộc có")').first()).toBeVisible();

    // 2. Kiểm tra MANAGE_USERS bị khóa
    const usersRow = page.locator('tbody tr').filter({ hasText: 'Quản lý người dùng' });
    await expect(usersRow.locator('span.sr-only:has-text("Bắt buộc có")').first()).toBeVisible();

    // 3. Kiểm tra MANAGE_PERMISSIONS bị khóa
    const permsRow = page.locator('tbody tr').filter({ hasText: 'Quản trị phân quyền hệ thống' });
    await expect(permsRow.locator('span.sr-only:has-text("Bắt buộc có")').first()).toBeVisible();
  });

  // ADMIN-WRITE-11: Fail-closed khi không xác định được người đang đăng nhập (currentUserId không hợp lệ)
  test('ADMIN-WRITE-11: currentUserId không hợp lệ vô hiệu hóa thao tác đổi trạng thái và vai trò, không có ký tự 0 rác', async ({ page }) => {
    let interceptedMutation = false;
    await page.route((url) => isApiMatch(url, 'users') && (url.pathname.includes('/status') || url.pathname.includes('/role')), (route) => {
      interceptedMutation = true;
      return route.fallback();
    });

    const invalidUser = {
      id: 0,
      userId: 0,
      code: 'ADM-INVALID',
      name: 'Admin Không ID',
      email: 'invalid-admin@example.invalid',
      role: 'admin',
      status: 'active',
      authorities: ['ROLE_ADMIN'],
    };

    let loggedIn = false;
    await page.route((url) => isApiMatch(url, 'auth/me'), (route) => {
      if (loggedIn) {
        return route.fulfill({ status: 200, json: invalidUser });
      }
      return route.fulfill({ status: 401, json: { message: 'Unauthenticated' } });
    });

    await page.route((url) => isApiMatch(url, 'auth/login'), (route) => {
      loggedIn = true;
      return route.fulfill({ status: 200, json: invalidUser });
    });

    await page.goto('/login');
    await page.locator('#login-email').fill('invalid-admin@example.invalid');
    await page.locator('#login-password').fill('Password123');
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });

    await page.goto('/admin/users');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Kiểm tra banner cảnh báo không xác định được người đăng nhập
    await expect(page.locator('div[role="alert"]:has-text("Không xác định được tài khoản đang đăng nhập")')).toBeVisible();

    // Mở menu thao tác của user 2
    const row = page.locator('tbody tr').filter({ hasText: 'Trần Thị Lễ Tân' });
    await row.locator('button[aria-label*="Thao tác"]').click();

    // Nút "Đổi trạng thái" và "Đổi vai trò" phải bị disabled
    const changeStatusItem = page.locator('button[role="menuitem"]:has-text("Đổi trạng thái")');
    const changeRoleItem = page.locator('button[role="menuitem"]:has-text("Đổi vai trò")');
    await expect(changeStatusItem).toBeDisabled();
    await expect(changeRoleItem).toBeDisabled();

    // Thử click: không gửi request
    await changeStatusItem.click({ force: true });
    expect(interceptedMutation).toBe(false);

    // Kiểm tra không có ký tự "0" lạc lõng trên toàn bộ trang
    const zeroSpans = page.locator('span:text-is("0"), div:text-is("0"), p:text-is("0")');
    await expect(zeroSpans).toHaveCount(0);
  });

  // ADMIN-WRITE-12: Lỗi 400 với thông điệp khác (ví dụ "fullName must not be blank") KHÔNG hiện lỗi "email trùng" ở ô email
  test('ADMIN-WRITE-12: Lỗi 400 với message khác không hiện lỗi email trùng ở ô email', async ({ page }) => {
    await page.route((url) => isApiMatch(url, 'users'), (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 400,
          json: { message: 'fullName must not be blank' },
        });
      }
      return route.fallback();
    });

    await loginAs(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    await page.locator('button:has-text("Thêm người dùng")').click();
    const modal = page.locator('div[role="dialog"][aria-labelledby="user-form-modal-title"]');
    await expect(modal).toBeVisible();

    await modal.locator('#user-form-fullname').fill('Nguyễn Test');
    await modal.locator('#user-form-email').fill('other400@example.invalid');
    await modal.locator('button[type="submit"]:has-text("Tạo tài khoản")').click();

    // Hiển thị lỗi server chung
    await expect(modal.locator('div[role="alert"]:has-text("fullName must not be blank")')).toBeVisible();

    // KHÔNG hiện lỗi trùng email ở ô email
    await expect(modal.locator('text=Địa chỉ email này đã tồn tại')).toHaveCount(0);
  });

  // ADMIN-WRITE-13: Tạo tài khoản Quản trị viên không có ô Mã cơ sở và payload không gửi centerId
  test('ADMIN-WRITE-13: Tạo tài khoản Quản trị viên không có ô Mã cơ sở và payload không gửi centerId', async ({ page }) => {
    let postAdminPayload = null;

    await page.route((url) => isApiMatch(url, 'users'), (route) => {
      if (route.request().method() === 'POST') {
        postAdminPayload = JSON.parse(route.request().postData() || '{}');
        return route.fulfill({
          status: 201,
          json: {
            id: 11,
            fullName: postAdminPayload.fullName,
            email: postAdminPayload.email,
            roleId: postAdminPayload.roleId,
            status: 'Active',
            emailSent: true,
          },
        });
      }
      return route.fallback();
    });

    await loginAs(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    await page.locator('button:has-text("Thêm người dùng")').click();
    const modal = page.locator('div[role="dialog"][aria-labelledby="user-form-modal-title"]');
    await expect(modal).toBeVisible();

    await modal.locator('#user-form-fullname').fill('Admin Phụ Tuyển');
    await modal.locator('#user-form-email').fill('subadmin@example.invalid');
    await modal.locator('#user-form-role').selectOption('1'); // Admin

    // Khẳng định không có ô mã cơ sở
    await expect(modal.locator('#user-form-center')).toHaveCount(0);

    await modal.locator('button[type="submit"]:has-text("Tạo tài khoản")').click();
    await expect(modal).toBeHidden();
    await expect(page.locator('div[role="alert"]:has-text("Đã tạo tài khoản")')).toBeVisible();

    expect(postAdminPayload).not.toBeNull();
    expect(postAdminPayload.roleId).toBe(1);
    expect(postAdminPayload.centerId).toBeUndefined();
  });
});
