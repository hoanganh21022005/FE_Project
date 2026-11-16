import { test, expect } from './helpers/guardedTest.js';
import { loginAs, navigateTo, setupDefaultApiMocks, isApiMatch, isLocalApi } from './helpers/mockAuth.js';
import { mockClasses, mockCoachSessions, mockRoster } from './helpers/mockData.js';

const classA = mockClasses[0]; // id: 101
const classB = mockClasses[1]; // id: 102

const sessionA = {
  ...mockCoachSessions[0],
  id: 501,
  classId: 101,
  coachId: 2,
  sessionNumber: 1,
  sessionDate: '2026-11-10',
  status: 'Scheduled',
};

const sessionB = {
  ...mockCoachSessions[0],
  id: 502,
  classId: 102,
  coachId: 2,
  sessionNumber: 1,
  sessionDate: '2026-11-12',
  status: 'Scheduled',
};

const rosterA = mockRoster;
const rosterB = [
  {
    id: 2001,
    classId: 102,
    memberId: 201,
    memberCode: 'MB-201',
    memberName: 'Học viên lớp B',
    fullName: 'Học viên lớp B',
    status: 'Registered',
  },
];

test.describe('W-A1: Điểm danh Coach (L01, L31)', () => {
  test.beforeEach(async ({ page }) => {
    await setupDefaultApiMocks(page, ['/api/members', '/api/training-plans', '/api/training-results']);

    await page.route((url) => isApiMatch(url, 'classes'), async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/101/enrollments')) {
        return route.fulfill({ status: 200, json: rosterA });
      }
      if (path.endsWith('/102/enrollments')) {
        return route.fulfill({ status: 200, json: rosterB });
      }
      if (path === '/api/classes') {
        return route.fulfill({ status: 200, json: [classA, classB] });
      }
      return route.fallback();
    });

    await page.route((url) => isApiMatch(url, 'sessions'), async (route) => {
      const url = new URL(route.request().url());
      const classId = url.searchParams.get('classId') || url.pathname.match(/\/catalog\/(\d+)$/)?.[1];
      const allSessions = [sessionA, sessionB];
      return route.fulfill({
        status: 200,
        json: classId ? allSessions.filter((s) => String(s.classId) === String(classId)) : allSessions,
      });
    });

    await page.route((url) => isApiMatch(url, 'attendances'), async (route) => {
      return route.fulfill({ status: 200, json: [] });
    });
  });

  test('AC1: Đổi từ lớp A sang lớp B khi sessionStorage đang giữ buổi lớp A phải tải roster lớp B và xóa buổi cũ', async ({ page }) => {
    let classBEnrollmentsCalls = 0;
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.pathname === '/api/classes/102/enrollments') {
        classBEnrollmentsCalls++;
      }
    });

    await loginAs(page, 'coach');
    await page.evaluate(() => {
      sessionStorage.setItem('scms_selected_attendance_coach_id', '2');
      sessionStorage.setItem('scms_selected_attendance_class_id', '101');
      sessionStorage.setItem('scms_selected_attendance_session_id', '501');
    });

    await navigateTo(page, '/coach/attendance');
    await expect(page.getByText('Hội viên mẫu A').first()).toBeVisible({ timeout: 15000 });

    const classSelect = page.locator('select').filter({ has: page.locator('option[value="102"]') });
    await classSelect.selectOption('102');

    await expect(page.getByText('Học viên lớp B').first()).toBeVisible({ timeout: 10000 });
    expect(classBEnrollmentsCalls).toBeGreaterThan(0);

    const savedSessionId = await page.evaluate(() =>
      sessionStorage.getItem('scms_selected_attendance_session_id')
    );
    expect(savedSessionId === '' || savedSessionId === '502').toBeTruthy();
    expect(savedSessionId).not.toBe('501');

    // F5 tải lại trang vẫn giữ lớp B đúng
    await page.reload();
    await expect(page.getByText('Học viên lớp B').first()).toBeVisible({ timeout: 15000 });
  });

  test('AC2: Cặp sessionStorage không khớp (lớp B, buổi lớp A) khi tải màn phải tự chọn buổi lớp B và không báo lỗi', async ({ page }) => {
    await loginAs(page, 'coach');
    await page.evaluate(() => {
      sessionStorage.setItem('scms_selected_attendance_coach_id', '2');
      sessionStorage.setItem('scms_selected_attendance_class_id', '102');
      sessionStorage.setItem('scms_selected_attendance_session_id', '501');
    });

    await navigateTo(page, '/coach/attendance');

    await expect(page.getByText('Học viên lớp B').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('alert')).toHaveCount(0);

    const savedSessionId = await page.evaluate(() =>
      sessionStorage.getItem('scms_selected_attendance_session_id')
    );
    expect(savedSessionId).toBe('502');
  });

  test('AC3: Lỗi tải danh sách học viên có message từ backend phải hiển thị đúng message đó', async ({ page }) => {
    const backendMsg = 'Danh sách học viên đang tạm khóa để đối soát sĩ số.';
    await page.route((url) => isApiMatch(url, 'classes/101/enrollments') || isLocalApi(url, '/api/enrollments'), async (route) => {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: backendMsg }),
      });
    });

    await loginAs(page, 'coach');
    await navigateTo(page, '/coach/attendance');

    await expect(page.getByText(backendMsg).first()).toBeVisible({ timeout: 15000 });
  });

  test('AC4a: POST điểm danh trả 400 NORMAL_NOT_STARTED phải hiện thông báo tiếng Việt rõ ràng thay cho Lỗi lưu', async ({ page }) => {
    const mockNotStarted = async (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'NORMAL_NOT_STARTED', message: 'NORMAL_NOT_STARTED' }),
      });

    await page.route((url) => isApiMatch(url, 'training-results'), async (route) => {
      if (route.request().method() === 'POST') return mockNotStarted(route);
      return route.fulfill({ status: 200, json: [] });
    });
    await page.route((url) => isApiMatch(url, 'attendances/check-in'), mockNotStarted);

    await loginAs(page, 'coach');
    await navigateTo(page, '/coach/attendance');
    await expect(page.getByText('Hội viên mẫu A').first()).toBeVisible({ timeout: 15000 });

    const presentBtn = page.getByRole('button', { name: 'Có mặt', exact: true }).first();
    await presentBtn.click();

    await expect(page.getByText(/chưa.*khai giảng/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Lỗi lưu/i)).toHaveCount(0);
  });

  test('AC4b: POST điểm danh trả 400 ATTENDANCE_WINDOW_CLOSED phải hiện thông báo tiếng Việt rõ ràng thay cho Lỗi lưu', async ({ page }) => {
    const mockWindowClosed = async (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'ATTENDANCE_WINDOW_CLOSED', message: 'ATTENDANCE_WINDOW_CLOSED' }),
      });

    await page.route((url) => isApiMatch(url, 'training-results'), async (route) => {
      if (route.request().method() === 'POST') return mockWindowClosed(route);
      return route.fulfill({ status: 200, json: [] });
    });
    await page.route((url) => isApiMatch(url, 'attendances/check-in'), mockWindowClosed);

    await loginAs(page, 'coach');
    await navigateTo(page, '/coach/attendance');
    await expect(page.getByText('Hội viên mẫu A').first()).toBeVisible({ timeout: 15000 });

    const presentBtn = page.getByRole('button', { name: 'Có mặt', exact: true }).first();
    await presentBtn.click();

    await expect(page.getByText(/hết thời gian điểm danh|đã đóng/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Lỗi lưu/i)).toHaveCount(0);
  });

  test('AC5: Không còn bộ đếm và nút Đi trễ, Có phép trên màn điểm danh', async ({ page }) => {
    await loginAs(page, 'coach');
    await navigateTo(page, '/coach/attendance');
    await expect(page.getByText('Hội viên mẫu A').first()).toBeVisible({ timeout: 15000 });

    await expect(page.getByText(/Đi trễ/i)).toHaveCount(0);
    await expect(page.getByText(/Có phép/i)).toHaveCount(0);

    const presentBtn = page.getByRole('button', { name: 'Có mặt', exact: true }).first();
    const box = await presentBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);
  });
});
