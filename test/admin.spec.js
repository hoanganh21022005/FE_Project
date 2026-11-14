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

const createMockAuditLogs = (count, startId = 1) =>
  Array.from({ length: count }, (_, i) => ({
    id: startId + i,
    userId: i % 2 === 0 ? 1 : 2,
    action: i === 0 ? 'LOGIN_GOOGLE' : i === 1 ? 'CHANGE_USER_STATUS' : 'UPDATE_STAFF',
    targetEntity: 'USER',
    targetId: 3,
    detail: `Thao tác ghi nhận bản ghi thứ ${startId + i}`,
    createdAt: '2026-11-12T07:00:00Z',
  }));

test.describe('Kịch bản Admin Chỉ Đọc (ADMIN-01 -> ADMIN-06)', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Cài đặt mock mặc định cho tất cả các API phụ trợ
    await setupDefaultApiMocks(page, [
      '/api/members',
      '/api/classes',
      '/api/sessions',
      '/api/invoices',
      '/api/specializations',
    ]);

    // 2. Mock API của phân hệ Admin
    await page.route((url) => isApiMatch(url, 'users'), (route) => {
      if (route.request().method() === 'GET') {
        const u = new URL(route.request().url());
        const role = u.searchParams.get('role');
        if (role) {
          const filtered = mockAdminUsers.filter((item) => item.roleName === role);
          return route.fulfill({ status: 200, json: filtered });
        }
        return route.fulfill({ status: 200, json: mockAdminUsers });
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
  });

  // ADMIN-01: Nhật ký hiển thị tên actor, đối tượng và nhãn tiếng Việt
  test('ADMIN-01: Nhật ký hoạt động hiển thị tên actor và nhãn tiếng Việt của hành động', async ({ page }) => {
    const mockLogs = [
      {
        id: 101,
        userId: 1, // Nguyễn Văn Admin
        action: 'LOGIN_GOOGLE',
        targetEntity: 'USER',
        targetId: 3, // Lê Hoàng Hội Viên
        detail: 'Đăng nhập thành công qua Google OAuth2',
        createdAt: '2026-11-12T07:15:00Z',
      },
      {
        id: 102,
        userId: null, // Hệ thống
        action: 'CHANGE_USER_STATUS',
        targetEntity: 'USER',
        targetId: 2, // Trần Thị Lễ Tân
        detail: 'Khóa tài khoản tự động do hết hạn',
        createdAt: '2026-11-12T06:30:00Z',
      },
    ];

    await page.route((url) => isApiMatch(url, 'audit-logs'), (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, json: mockLogs });
      }
      return route.fallback();
    });

    await loginAs(page, 'admin');
    await page.goto('/admin/audit-logs');

    // Chờ bảng nhật ký render
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    const tbody = page.locator('tbody');

    // Kiểm tra tên actor hiển thị thay vì User #1
    await expect(tbody).toContainText('Nguyễn Văn Admin');
    await expect(tbody).toContainText('Hệ thống');

    // Kiểm tra nhãn tiếng Việt cho hành động
    await expect(tbody).toContainText('Đăng nhập qua Google');
    await expect(tbody).toContainText('Đổi trạng thái tài khoản');

    // Kiểm tra tên đối tượng USER hiển thị họ tên (không còn (#3), User #1, LOGIN_GOOGLE)
    await expect(tbody).toContainText('Lê Hoàng Hội Viên');
    await expect(tbody).not.toContainText('(#3)');
    await expect(tbody).not.toContainText('User #');
    await expect(tbody).not.toContainText('LOGIN_GOOGLE');
  });

  // ADMIN-02: Bộ lọc nhật ký gửi đúng query và Trang sau gửi page kế tiếp
  test('ADMIN-02: Bộ lọc nhật ký gửi đúng query (action, startDate, endDate, actorId, page, size) và Trang sau gửi page kế tiếp', async ({ page }) => {
    const requestedQueries = [];

    await page.route((url) => isApiMatch(url, 'audit-logs'), (route) => {
      if (route.request().method() !== 'GET') return route.fallback();

      const u = new URL(route.request().url());
      requestedQueries.push({
        action: u.searchParams.get('action'),
        startDate: u.searchParams.get('startDate'),
        endDate: u.searchParams.get('endDate'),
        actorId: u.searchParams.get('actorId'),
        page: u.searchParams.get('page'),
        size: u.searchParams.get('size'),
      });

      const p = u.searchParams.get('page');
      // Nếu page === '0' hoặc null, trả về đủ 20 bản ghi để bật "Trang sau"
      if (p === '0' || p === null) {
        return route.fulfill({ status: 200, json: createMockAuditLogs(20, 1) });
      }
      // Nếu page === '1', trả về 5 bản ghi
      return route.fulfill({ status: 200, json: createMockAuditLogs(5, 21) });
    });

    await loginAs(page, 'admin');
    await page.goto('/admin/audit-logs');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Chọn hành động LOGIN_GOOGLE
    await page.locator('select').first().selectOption('LOGIN_GOOGLE');

    // Điền khoảng ngày
    await page.locator('input[type="date"]').first().fill('2026-11-01');
    await page.locator('input[type="date"]').nth(1).fill('2026-11-12');

    // Chọn actorId 1
    await page.locator('select').nth(1).selectOption('1');

    // Chờ request có tham số được ghi nhận
    await expect.poll(() => requestedQueries.some((q) =>
      q.action === 'LOGIN_GOOGLE' &&
      q.startDate === '2026-11-01' &&
      q.endDate === '2026-11-12' &&
      q.actorId === '1' &&
      q.size === '20'
    )).toBe(true);

    // Nút "Trang sau" phải enabled khi trả về đủ 20 bản ghi
    const nextBtn = page.locator('button:has-text("Trang sau")');
    await expect(nextBtn).toBeEnabled({ timeout: 5000 });

    // Bấm "Trang sau"
    await nextBtn.click();

    // Xác minh request gửi lên có page kế tiếp (page=1 khi base=0)
    await expect.poll(() => requestedQueries.some((q) => q.page === '1')).toBe(true);
  });

  // ADMIN-03: Ma trận vai trò × quyền hiển thị đúng ô tích theo mock
  test('ADMIN-03: Ma trận quyền hiển thị đúng ô tích theo mock và có nhãn trợ năng', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/admin/roles');

    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Kiểm tra tiêu đề quyền hiển thị tiếng Việt có dấu
    await expect(page.locator('table')).toContainText('Quản lý người dùng');
    await expect(page.locator('table')).toContainText('Quản trị viên hệ thống');

    // Tìm dòng quyền Quản lý người dùng (Admin có, Member không có), không lộ mã quyền/vai trò
    const rowManageUsers = page.locator('tbody tr').filter({ hasText: 'Quản lý người dùng' });
    await expect(rowManageUsers).toBeVisible();
    await expect(page.locator('main')).not.toContainText('MANAGE_USERS');
    await expect(page.locator('main')).not.toContainText('CenterManager');

    // Có nhãn ẩn trợ năng "Có" và "Không"
    await expect(rowManageUsers.locator('span.sr-only:has-text("Có")').first()).toBeAttached();
    await expect(rowManageUsers.locator('span.sr-only:has-text("Không")').first()).toBeAttached();
  });

  // ADMIN-04: Panel chi tiết gọi GET /api/users/{id} và xử lý lỗi 500 kèm Thử lại
  test('ADMIN-04: Panel chi tiết gọi GET /api/users/{id} và xử lý lỗi 500 kèm Thử lại', async ({ page }) => {
    let return500 = true;
    let detailCalled = false;

    await page.route((url) => isApiMatch(url, 'users/2'), (route) => {
      detailCalled = true;
      if (return500) {
        return route.fulfill({
          status: 500,
          json: { message: 'Máy chủ gặp sự cố tải chi tiết' },
        });
      }
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
          address: '456 Đường CMT8, Q.3, TP.HCM',
          dateOfBirth: '1995-05-20',
          createdAt: '2026-02-10T09:30:00Z',
          permissions: ['PROCESS_PAYMENT'],
        },
      });
    });

    await loginAs(page, 'admin');
    await page.goto('/admin/users');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    // Bấm nút "Xem chi tiết" trong menu thao tác của user ID 2
    const userRow = page.locator('tbody tr').filter({ hasText: 'Trần Thị Lễ Tân' });
    await userRow.locator('button[aria-label*="Thao tác"]').click();
    await page.locator('button[role="menuitem"]:has-text("Xem chi tiết")').click();

    // Xác nhận đã gọi GET /api/users/2
    expect(detailCalled).toBe(true);

    // Khi 500: hiển thị thông báo lỗi và nút Thử lại
    const retryBtn = page.locator('aside[aria-label="Chi tiết người dùng"] button:has-text("Thử lại")');
    await expect(retryBtn).toBeVisible({ timeout: 5000 });

    // Chuyển mock sang 200 và bấm Thử lại
    return500 = false;
    await retryBtn.click();

    // Panel chi tiết hiển thị dữ liệu thành công
    const aside = page.locator('aside[aria-label="Chi tiết người dùng"]');
    await expect(aside).toContainText('USR-002');
    await expect(aside).toContainText('Trần Thị Lễ Tân');
    await expect(aside).toContainText('0907654321');
    await expect(aside).toContainText('Xử lý thanh toán');
  });

  // ADMIN-05: 403 hiện trạng thái không có quyền
  test('ADMIN-05: Nhật ký xử lý 403 Forbidden hiển thị thông báo không có quyền', async ({ page }) => {
    await page.route((url) => isApiMatch(url, 'audit-logs'), (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 403,
          json: { message: 'Quyền truy cập bị từ chối' },
        });
      }
      return route.fallback();
    });

    await loginAs(page, 'admin');
    await page.goto('/admin/audit-logs');

    // Kiểm tra thông báo 403 Forbidden
    const alert = page.locator('div[role="alert"]');
    await expect(alert).toBeVisible({ timeout: 10000 });
    await expect(alert).toContainText('403 Forbidden');
  });

  // ADMIN-06: Khẳng định không có request ghi (POST/PUT/PATCH/DELETE) nào trong giao diện Admin
  test('ADMIN-06: Không có bất kỳ request ghi nào (POST/PUT/PATCH/DELETE) được phát sinh từ giao diện Admin', async ({ page }) => {
    const mutationRequests = [];

    await page.route((url) => isApiMatch(url, 'audit-logs'), (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, json: createMockAuditLogs(5) });
      }
      return route.fallback();
    });

    // Ghi nhận mọi request method khác GET
    page.on('request', (req) => {
      const u = new URL(req.url());
      if (u.pathname.startsWith('/api/') && req.method() !== 'GET') {
        // Loại trừ đăng nhập auth/login ban đầu
        if (!u.pathname.includes('/api/auth/login')) {
          mutationRequests.push(`${req.method()} ${u.pathname}`);
        }
      }
    });

    await loginAs(page, 'admin');

    // Điều hướng lần lượt qua các trang Admin
    await page.goto('/admin/dashboard');
    await page.waitForTimeout(500);

    await page.goto('/admin/users');
    await page.waitForTimeout(500);

    // Bấm xem chi tiết
    await page.locator('tbody tr button[aria-label*="Thao tác"]').first().click();
    await page.locator('button[role="menuitem"]:has-text("Xem chi tiết")').click();
    await page.waitForTimeout(500);

    await page.goto('/admin/roles');
    await page.waitForTimeout(500);

    await page.goto('/admin/audit-logs');
    await page.waitForTimeout(500);

    // Khẳng định không phát sinh mutation request nào
    expect(mutationRequests).toEqual([]);
  });

  test('ADMIN-07: Chuyển sang tiếng Anh (EN) hiển thị đầy đủ UI tiếng Anh và không còn dấu tiếng Việt trên /admin/dashboard và /admin/users', async ({ page }) => {
    const enMockUsers = [
      {
        id: 1,
        code: 'USR-001',
        fullName: 'John Admin',
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
        fullName: 'Jane Receptionist',
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
        fullName: 'Alex Member',
        email: 'member@example.invalid',
        phone: '0911223344',
        status: 'locked',
        roleId: 5,
        roleName: 'Member',
        createdAt: '2026-03-01T10:00:00Z',
        permissions: [],
      },
    ];
    const enMockAuditLogs = [
      {
        id: 901,
        actorId: 1,
        actorName: 'John Admin',
        action: 'LOGIN_GOOGLE',
        targetType: 'USER',
        targetId: 3,
        details: 'Signed in via Google OAuth2',
        createdAt: '2026-11-12T07:15:00Z',
      },
    ];

    await loginAs(page, 'admin');

    await page.route((url) => isApiMatch(url, 'users'), (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, json: enMockUsers });
      }
      return route.fallback();
    });
    await page.route((url) => isApiMatch(url, 'audit-logs'), (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, json: enMockAuditLogs });
      }
      return route.fallback();
    });

    await page.goto('/admin/dashboard');
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 });

    // Bấm nút chuyển ngôn ngữ sang EN trên header
    const enBtn = page.locator('header button:has-text("EN")');
    await expect(enBtn).toBeVisible();
    await enBtn.click();

    await expect(page.locator('main')).toContainText('System overview');
    await expect(page.locator('main')).toContainText('Recent activity');

    const viDiacritics = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
    for (const sel of ['header', 'aside', 'main']) {
      const txt = await page.locator(sel).innerText();
      expect(txt, `${sel} trên /admin/dashboard ở chế độ EN không được chứa dấu tiếng Việt`).not.toMatch(viDiacritics);
    }

    // Điều hướng sang /admin/users và giữ chế độ EN
    await page.goto('/admin/users');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('main')).toContainText('User Management');
    await expect(page.locator('thead')).toContainText('Email');
    await expect(page.locator('thead')).toContainText('Role');

    for (const sel of ['header', 'aside', 'main']) {
      const txt = await page.locator(sel).innerText();
      expect(txt, `${sel} trên /admin/users ở chế độ EN không được chứa dấu tiếng Việt`).not.toMatch(viDiacritics);
    }
  });

  test('ADMIN-08: Card chú ý trên Dashboard điều hướng sang /admin/users?status=locked và lọc đúng user bị khóa', async ({ page }) => {
    await page.route((url) => isApiMatch(url, 'audit-logs'), (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, json: createMockAuditLogs(2) });
      }
      return route.fallback();
    });

    await loginAs(page, 'admin');
    await page.goto('/admin/dashboard');

    const lockedCard = page.locator('main a, main button').filter({ hasText: 'Tài khoản đang bị khóa' }).first();
    await expect(lockedCard).toBeVisible({ timeout: 10000 });
    await lockedCard.click();

    await expect(page).toHaveURL(/\/admin\/users\?status=locked/);
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody')).toContainText('Lê Hoàng Hội Viên');
    await expect(page.locator('tbody')).not.toContainText('Trần Thị Lễ Tân');
  });

  test('ADMIN-09: Chuông thông báo hiển thị chấm chưa đọc, đánh dấu đã đọc khi mở, đóng bằng Escape và không phát sinh request ghi', async ({ page }) => {
    const mutationRequests = [];
    page.on('request', (req) => {
      const u = new URL(req.url());
      if (u.pathname.startsWith('/api/') && req.method() !== 'GET' && !u.pathname.includes('/api/auth/login')) {
        mutationRequests.push(`${req.method()} ${u.pathname}`);
      }
    });

    await loginAs(page, 'admin');

    const recentCreatedAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await page.route((url) => isApiMatch(url, 'audit-logs'), (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          json: [
            {
              id: 999,
              actorId: 1,
              actorName: 'Nguyễn Văn Admin',
              action: 'CHANGE_USER_STATUS',
              targetType: 'USER',
              targetId: 3,
              details: 'Khóa tài khoản thử nghiệm',
              createdAt: recentCreatedAt,
            },
          ],
        });
      }
      return route.fallback();
    });

    await page.evaluate(() => localStorage.removeItem('scms_admin_notif_seen_at'));
    await page.goto('/admin/dashboard');

    const bellBtn = page.locator('header button[aria-label*="Thông báo"]');
    await expect(bellBtn).toBeVisible({ timeout: 10000 });
    await expect(bellBtn).toHaveAttribute('aria-label', /\d+ mục mới/i);

    await bellBtn.click();
    const popover = page.locator('header [role="dialog"], header [aria-label*="Thông báo"]');
    await expect(popover.first()).toBeVisible();

    const seenAt = await page.evaluate(() => localStorage.getItem('scms_admin_notif_seen_at'));
    expect(seenAt).toBeTruthy();

    await page.keyboard.press('Escape');
    await expect(bellBtn).toBeFocused();

    await page.reload();
    await expect(bellBtn).toBeVisible({ timeout: 10000 });
    await expect(bellBtn).not.toHaveAttribute('aria-label', /mục mới/i);
    expect(mutationRequests).toEqual([]);
  });

  test('ADMIN-10: Biểu đồ 7 ngày phân trang size <= 100, tải đúng 2 trang dữ liệu và chặn size > 100', async ({ page }) => {
    const requestedAuditQueries = [];
    const todayIso = new Date().toISOString();

    await page.route((url) => isApiMatch(url, 'audit-logs'), (route) => {
      if (route.request().method() !== 'GET') return route.fallback();

      const u = new URL(route.request().url());
      const size = Number(u.searchParams.get('size') || '0');
      const pageNum = Number(u.searchParams.get('page') || '0');
      const startDate = u.searchParams.get('startDate');
      const endDate = u.searchParams.get('endDate');

      requestedAuditQueries.push({ size, page: pageNum, startDate, endDate });

      if (size > 100) {
        return route.fulfill({
          status: 400,
          json: { message: 'Use a valid date range, page >= 0, size 1..100' },
        });
      }

      // Query của biểu đồ 7 ngày có startDate & endDate
      if (startDate && endDate) {
        if (pageNum === 0) {
          return route.fulfill({
            status: 200,
            json: Array.from({ length: 100 }, (_, i) => ({
              id: 1000 + i,
              actorId: 1,
              action: 'LOGIN',
              targetEntity: 'USER',
              targetId: 2,
              detail: `Log #${i}`,
              createdAt: todayIso,
            })),
          });
        }
        if (pageNum === 1) {
          return route.fulfill({
            status: 200,
            json: Array.from({ length: 5 }, (_, i) => ({
              id: 2000 + i,
              actorId: 1,
              action: 'LOGIN',
              targetEntity: 'USER',
              targetId: 2,
              detail: `Log page 2 #${i}`,
              createdAt: todayIso,
            })),
          });
        }
        return route.fulfill({ status: 200, json: [] });
      }

      return route.fulfill({ status: 200, json: createMockAuditLogs(3) });
    });

    await loginAs(page, 'admin');
    requestedAuditQueries.length = 0;
    await page.goto('/admin/dashboard');

    const chart = page.locator('[role="img"][aria-label*="Biểu đồ cột hoạt động 7 ngày gần nhất"]');
    await expect(chart).toBeVisible({ timeout: 10000 });
    await expect(page.locator('main')).toContainText('Tổng 7 ngày: 105 lượt');

    const chartRequests = requestedAuditQueries.filter((q) => q.startDate && q.endDate);
    expect(chartRequests.length).toBeGreaterThanOrEqual(2);
    expect(chartRequests.every((q) => q.size > 0 && q.size <= 100)).toBe(true);
    expect(Array.from(new Set(chartRequests.map((q) => q.page))).sort((a, b) => a - b)).toEqual([0, 1]);
  });

  test('ADMIN-11: Biểu đồ 7 ngày hiện thông báo thân thiện theo ngôn ngữ và nút Thử lại khi lỗi Backend', async ({ page }) => {
    let shouldFailChart = true;
    const todayIso = new Date().toISOString();

    await page.route((url) => isApiMatch(url, 'audit-logs'), (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      const u = new URL(route.request().url());
      if (u.searchParams.get('startDate') && u.searchParams.get('endDate')) {
        if (shouldFailChart) {
          return route.fulfill({
            status: 400,
            json: { message: 'Use a valid date range, page >= 0, size 1..100' },
          });
        }
        return route.fulfill({
          status: 200,
          json: [
            {
              id: 3001,
              actorId: 1,
              action: 'LOGIN',
              targetEntity: 'USER',
              targetId: 2,
              detail: 'Recovered',
              createdAt: todayIso,
            },
          ],
        });
      }
      return route.fulfill({ status: 200, json: createMockAuditLogs(2) });
    });

    await loginAs(page, 'admin');
    await page.goto('/admin/dashboard');

    await expect(page.locator('main')).toContainText('Không tải được dữ liệu biểu đồ.');
    await expect(page.locator('main')).not.toContainText('Use a valid date range');

    // Chuyển sang EN và kiểm tra thông báo lỗi tiếng Anh thân thiện
    await page.locator('header button:has-text("EN")').click();
    await expect(page.locator('main')).toContainText('Could not load chart data.');

    shouldFailChart = false;
    await page.locator('main button:has-text("Retry")').click();
    await expect(page.locator('[role="img"][aria-label*="7-day activity bar chart"]')).toBeVisible({ timeout: 10000 });
  });

  test('ADMIN-12: Nhật ký và Vai trò không lộ mã, không dùng ngoặc ở nhãn hành động và hiển thị khoảng ngày đang xem', async ({ page }) => {
    await page.route((url) => isApiMatch(url, 'audit-logs'), (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return route.fulfill({
        status: 200,
        json: [
          {
            id: 401,
            actorId: 1,
            action: 'REGISTER_MEMBER_GOOGLE',
            targetEntity: 'USER',
            targetId: 3,
            detail: 'Google signup',
            createdAt: '2026-11-12T07:15:00Z',
          },
          {
            id: 402,
            actorId: null,
            action: 'REGISTER_MEMBER_PENDING',
            targetEntity: 'ROLE',
            targetId: 2,
            detail: 'Pending signup',
            createdAt: '2026-11-12T06:15:00Z',
          },
        ],
      });
    });

    await loginAs(page, 'admin');
    await page.goto('/admin/audit-logs?startDate=2026-11-07&endDate=2026-11-14');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    const rangeSummary = page.getByTestId('audit-date-range-summary');
    await expect(rangeSummary).toContainText('Đang xem:');
    await expect(rangeSummary).not.toContainText('tất cả thời gian');

    const mainTextVi = await page.locator('main').innerText();
    expect(mainTextVi).not.toMatch(/User #|\(#|[A-Z]{2,}_[A-Z_]+/);
    await expect(page.locator('thead')).toContainText('Áp dụng cho');
    await expect(page.locator('tbody')).toContainText('Đăng ký hội viên qua Google');
    await expect(page.locator('tbody')).toContainText('Đăng ký hội viên');
    await expect(page.locator('tbody')).toContainText('Quản lý trung tâm');

    // Kiểm tra các ô hành động không chứa dấu ngoặc '('
    const actionCells = await page.locator('tbody tr td:nth-child(3)').allInnerTexts();
    for (const cellText of actionCells) {
      expect(cellText).not.toContain('(');
    }

    // Chuyển sang EN và kiểm tra
    await page.locator('header button:has-text("EN")').click();
    await expect(page.locator('thead')).toContainText('Applied to');
    await expect(rangeSummary).toContainText('Showing:');
    await expect(page.locator('tbody')).toContainText('Member sign-up via Google');
    await expect(page.locator('tbody')).toContainText('Member sign-up');
    await expect(page.locator('tbody')).toContainText('Center Manager');

    // Xóa bộ lọc -> hiển thị "Showing: all time"
    await page.locator('button:has-text("Clear filters")').click();
    await expect(rangeSummary).toContainText('Showing: all time');
  });

  test('ADMIN-13: Cột Áp dụng cho ở Nhật ký, Tổng quan và chuông làm sạch mọi nhãn #số và ưu tiên tra user/role', async ({ page }) => {
    const recentBase = Date.now();
    const mockTargetLogs = [
      {
        id: 501,
        actorId: 1,
        action: 'CHANGE_USER_STATUS',
        targetEntity: 'User',
        targetId: 3, // Lê Hoàng Hội Viên
        targetLabel: '#3',
        detail: 'Khóa tài khoản hội viên',
        createdAt: new Date(recentBase - 1000).toISOString(),
      },
      {
        id: 502,
        actorId: 1,
        action: 'CHANGE_USER_ROLE',
        targetEntity: 'Anh Huỳnh (#49)',
        targetId: null,
        targetLabel: 'Anh Huỳnh (#49)',
        detail: 'Đổi vai trò',
        createdAt: new Date(recentBase - 2000).toISOString(),
      },
      {
        id: 503,
        actorId: 1,
        action: 'CREATE_USER',
        targetEntity: 'User',
        targetId: 12, // không có trong mockAdminUsers
        targetLabel: 'User #12',
        detail: 'Tạo tài khoản cũ',
        createdAt: new Date(recentBase - 3000).toISOString(),
      },
      {
        id: 504,
        actorId: 1,
        action: 'UPDATE_ROLE_PERMISSIONS',
        targetEntity: null,
        targetId: 2,
        targetLabel: '#2',
        detail: 'Cập nhật nhãn số',
        createdAt: new Date(recentBase - 4000).toISOString(),
      },
      {
        id: 505,
        actorId: 1,
        action: 'ENROLL_CLASS',
        targetEntity: 'Class',
        targetId: 7,
        targetLabel: 'Class #7',
        detail: 'Ghi danh lớp',
        createdAt: new Date(recentBase - 5000).toISOString(),
      },
      {
        id: 506,
        actorId: 1,
        action: 'LOGIN',
        targetEntity: '',
        targetId: null,
        targetLabel: 'N/A',
        detail: 'Đăng nhập',
        createdAt: new Date(recentBase - 6000).toISOString(),
      },
      {
        id: 507,
        actorId: 1,
        action: 'LOGIN_GOOGLE',
        targetEntity: '',
        targetId: null,
        targetLabel: '',
        detail: 'Đăng nhập Google',
        createdAt: new Date(recentBase - 7000).toISOString(),
      },
    ];

    await page.route((url) => isApiMatch(url, 'audit-logs'), (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      return route.fulfill({ status: 200, json: mockTargetLogs });
    });

    await loginAs(page, 'admin');

    // 1. Kiểm tra màn Nhật ký (/admin/audit-logs) ở VI & EN
    await page.goto('/admin/audit-logs');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    const auditTargetCells = await page.locator('tbody tr td:nth-child(4)').allInnerTexts();
    expect(auditTargetCells.map((s) => s.trim())).toEqual([
      'Lê Hoàng Hội Viên',
      'Anh Huỳnh',
      '—',
      '—',
      '—',
      '—',
      '—',
    ]);
    for (const txt of auditTargetCells) {
      expect(txt).not.toMatch(/#\d/);
    }

    // 2. Kiểm tra màn Tổng quan (/admin/dashboard) - bảng Hoạt động gần đây (5 bản ghi mới nhất)
    await page.goto('/admin/dashboard');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    const dashTargetCells = await page.locator('tbody tr td:nth-child(5)').allInnerTexts();
    expect(dashTargetCells.map((s) => s.trim())).toEqual([
      'Lê Hoàng Hội Viên',
      'Anh Huỳnh',
      '—',
      '—',
      '—',
    ]);
    for (const txt of dashTargetCells) {
      expect(txt).not.toMatch(/#\d/);
    }

    // 3. Kiểm tra chuông thông báo ở VI và EN
    const bellBtn = page.locator('header button[aria-haspopup="dialog"]');
    await bellBtn.click();
    const popover = page.locator('header [role="dialog"]');
    await expect(popover).toBeVisible();
    const bellTextVi = await popover.innerText();
    expect(bellTextVi).toContain('Lê Hoàng Hội Viên');
    expect(bellTextVi).toContain('Anh Huỳnh');
    expect(bellTextVi).not.toMatch(/#\d/);
    await page.keyboard.press('Escape');

    // Chuyển sang EN và kiểm tra lại cả chuông lẫn Nhật ký
    await page.locator('header button:has-text("EN")').click();
    await bellBtn.click();
    await expect(popover).toBeVisible();
    const bellTextEn = await popover.innerText();
    expect(bellTextEn).toContain('Lê Hoàng Hội Viên');
    expect(bellTextEn).toContain('Anh Huỳnh');
    expect(bellTextEn).not.toMatch(/#\d/);
    await page.keyboard.press('Escape');

    await page.goto('/admin/audit-logs');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });
    const auditTargetCellsEn = await page.locator('tbody tr td:nth-child(4)').allInnerTexts();
    for (const txt of auditTargetCellsEn) {
      expect(txt).not.toMatch(/#\d/);
    }
  });
});
