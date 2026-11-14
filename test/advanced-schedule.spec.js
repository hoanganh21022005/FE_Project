import { test, expect } from './helpers/guardedTest.js';
import { isApiMatch, loginAs, setupDefaultApiMocks } from './helpers/mockAuth.js';
import { mockRooms } from './helpers/mockData.js';

const mockRegistrations = [
  {
    subscriptionId: 501,
    memberName: 'Nguyễn Minh Anh',
    primaryCoachName: 'HLV Trần Quốc Bảo',
    subjectName: 'Cầu lông',
  },
  {
    subscriptionId: 502,
    memberName: 'Lê Hoàng Nam',
    primaryCoachName: 'HLV Phạm Thu Hà',
    subjectName: 'Bóng bàn',
  },
];

const mockProposals = [
  {
    id: 11,
    subscriptionId: 501,
    memberId: 201,
    coachId: 301,
    subjectId: 1,
    roomId: 1,
    sessionId: 901,
    sessionDate: '2026-11-20',
    startTime: '09:00:00',
    endTime: '10:30:00',
    status: 'ACCEPTED',
    respondedAt: '2026-11-14T10:15:00',
  },
  {
    id: 12,
    subscriptionId: 502,
    memberId: 202,
    coachId: 302,
    subjectId: 2,
    roomId: 3,
    sessionId: null,
    sessionDate: '2026-11-21',
    startTime: '14:00:00',
    endTime: '15:30:00',
    status: 'PENDING',
    respondBy: '2026-11-19T18:00:00',
  },
  {
    id: 13,
    subscriptionId: 501,
    memberId: 201,
    coachId: 301,
    subjectId: 1,
    roomId: 1,
    sessionId: null,
    sessionDate: '2026-11-22',
    startTime: '16:00:00',
    endTime: '17:30:00',
    status: 'REJECTED',
  },
];

test.describe('Màn hình Lịch học Advanced của Manager (W-D1)', () => {
  test.beforeEach(async ({ page }) => {
    await setupDefaultApiMocks(page, [
      '/api/members',
      '/api/classes',
      '/api/invoices',
      '/api/specializations',
      '/api/holidays',
      '/api/sessions',
      '/api/audit-logs',
      '/api/users',
      '/api/roles',
      '/api/permissions',
      '/api/advanced-registrations',
    ]);

    await page.route((url) => isApiMatch(url, 'rooms'), (route) =>
      route.fulfill({ status: 200, json: mockRooms }),
    );
    await page.route((url) => isApiMatch(url, 'advanced-registrations'), (route) =>
      route.fulfill({ status: 200, json: mockRegistrations }),
    );
  });

  test('Manager có MANAGE_CLASSES: mở /manager/advanced-schedule hiển thị đúng dòng từ mock', async ({ page }) => {
    await page.route((url) => isApiMatch(url, 'private-session-proposals'), (route) =>
      route.fulfill({ status: 200, json: mockProposals }),
    );

    await loginAs(page, 'manager');
    await page.goto('/manager/advanced-schedule');

    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });
    await expect(table).toContainText('Nguyễn Minh Anh');
    await expect(table).toContainText('HLV Trần Quốc Bảo');
    await expect(table).toContainText('Cầu lông');
    await expect(table).toContainText('Sân Cầu Lông 01');
    await expect(table).toContainText('Member đã xác nhận');

    await expect(table).toContainText('Lê Hoàng Nam');
    await expect(table).toContainText('HLV Phạm Thu Hà');
    await expect(table).toContainText('Bóng bàn');
    await expect(table).toContainText('Sân Bóng Bàn B');
    await expect(table).toContainText('Chờ Member xác nhận');
  });

  test('Tài khoản không có MANAGE_CLASSES (Admin): thấy cảnh báo quyền và không gọi /api/private-session-proposals', async ({ page }) => {
    let proposalsCalled = false;
    await page.route((url) => isApiMatch(url, 'private-session-proposals'), (route) => {
      proposalsCalled = true;
      return route.fulfill({ status: 200, json: mockProposals });
    });

    await loginAs(page, 'admin');
    await page.goto('/admin/ops/advanced-schedule');

    const alert = page.locator('[role="alert"]');
    await expect(alert).toBeVisible({ timeout: 10000 });
    await expect(alert).toContainText('MANAGE_CLASSES');
    await expect(page.locator('table')).toHaveCount(0);
    expect(proposalsCalled).toBe(false);
  });

  test('GET /api/private-session-proposals trả 403: hiện lỗi, không hiện bảng rỗng như thành công', async ({ page }) => {
    await page.route((url) => isApiMatch(url, 'private-session-proposals'), (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Forbidden: missing MANAGE_CLASSES' }),
      }),
    );

    await loginAs(page, 'manager');
    await page.goto('/manager/advanced-schedule');

    const alert = page.locator('[role="alert"]');
    await expect(alert).toBeVisible({ timeout: 10000 });
    await expect(alert).toContainText('Forbidden');
    await expect(page.locator('table')).toContainText('Không thể hiển thị lịch cho đến khi tải dữ liệu thành công.');
    await expect(page.locator('table')).not.toContainText('Chưa có Coach nào tạo đề xuất lịch Advanced.');
  });

  test('Mọi input, select, button trong khung màn cao >= 44px', async ({ page }) => {
    await page.route((url) => isApiMatch(url, 'private-session-proposals'), (route) =>
      route.fulfill({ status: 200, json: mockProposals }),
    );

    await loginAs(page, 'manager');
    await page.goto('/manager/advanced-schedule');
    await expect(page.locator('table')).toBeVisible({ timeout: 10000 });

    const controls = page.locator('main input, main select, main button');
    const count = await controls.count();
    expect(count).toBeGreaterThanOrEqual(5);

    for (let i = 0; i < count; i += 1) {
      const box = await controls.nth(i).boundingBox();
      expect(box, `Control #${i} phải có boundingBox`).not.toBeNull();
      expect(box.height, `Control #${i} phải cao >= 44px`).toBeGreaterThanOrEqual(44);
    }
  });

  test('Bộ lọc trạng thái và tìm kiếm lọc đúng', async ({ page }) => {
    await page.route((url) => isApiMatch(url, 'private-session-proposals'), (route) =>
      route.fulfill({ status: 200, json: mockProposals }),
    );

    await loginAs(page, 'manager');
    await page.goto('/manager/advanced-schedule');
    const table = page.locator('table');
    await expect(table).toContainText('Nguyễn Minh Anh', { timeout: 10000 });
    await expect(table).toContainText('Lê Hoàng Nam');

    // Lọc theo trạng thái pending
    await page.locator('main select').selectOption('pending');
    await expect(table).toContainText('Lê Hoàng Nam');
    await expect(table).not.toContainText('Nguyễn Minh Anh');
    await expect(page.locator('main')).toContainText('1 lịch đang hiển thị');

    // Đặt lại tất cả rồi tìm kiếm theo tên Coach
    await page.locator('main select').selectOption('all');
    const searchInput = page.locator('main input:not([type="date"])');
    await searchInput.fill('Trần Quốc Bảo');
    await expect(table).toContainText('Nguyễn Minh Anh');
    await expect(table).not.toContainText('Lê Hoàng Nam');
    await expect(page.locator('main')).toContainText('2 lịch đang hiển thị');
  });
});
