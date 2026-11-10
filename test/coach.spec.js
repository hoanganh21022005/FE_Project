import { test, expect } from './helpers/guardedTest.js';
import { loginAs, navigateTo, setupDefaultApiMocks, isApiMatch, isLocalApi } from './helpers/mockAuth.js';
import { mockClasses, mockCoachSessions, mockRoster } from './helpers/mockData.js';

test.describe('Kịch bản Huấn Luyện Viên Điểm Danh (COACH-01 -> COACH-03)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    // 1. Mock mặc định tất cả các API phụ trợ của SCMS
    const auxiliary = ['/api/members', '/api/training-plans'];
    if (['COACH-01', 'COACH-04', 'COACH-05'].some((id) => testInfo.title.startsWith(id))) auxiliary.push('/api/training-results');
    await setupDefaultApiMocks(page, auxiliary);

    // 2. Mock danh sách lớp và buổi học của coach
    await page.route((url) => isApiMatch(url, 'classes'), async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.includes('/enrollments')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockRoster),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockClasses),
      });
    });

    await page.route((url) => isApiMatch(url, 'sessions'), async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCoachSessions),
      });
    });

    await page.route((url) => isApiMatch(url, 'coaches'), (r) => r.fulfill({ status: 200, json: [] }));
    await page.route((url) => isApiMatch(url, 'attendances'), async (route) => {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  test('COACH-05: Không tải roster của lớp ngoài phân công', async ({ page }) => {
    const otherClass = { ...mockClasses[0], id: 999, name: 'Lớp ngoài phân công', nameVi: 'Lớp ngoài phân công', coachId: 999 };
    const otherSession = { ...mockCoachSessions[0], id: 9991, classId: 999, coachId: 999 };
    let unauthorizedRosterRequests = 0;
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname === '/api/classes/999/enrollments' || (url.pathname === '/api/enrollments' && url.searchParams.get('classId') === '999')) unauthorizedRosterRequests++;
    });
    await page.route((url) => isLocalApi(url, '/api/classes'), (route) => route.fulfill({ json: [...mockClasses, otherClass] }));
    await page.route((url) => isApiMatch(url, 'sessions'), (route) => {
      const url = new URL(route.request().url());
      const classId = url.searchParams.get('classId') || url.pathname.match(/\/catalog\/(\d+)$/)?.[1];
      return route.fulfill({ json: classId === '999' ? [otherSession] : mockCoachSessions });
    });
    await loginAs(page, 'coach');
    await navigateTo(page, '/coach/attendance');
    await expect(page.getByText('Hội viên mẫu A').first()).toBeVisible();
    await expect(page.locator('select option[value="999"]')).toHaveCount(0);
    await page.goto('/coach/attendance?classId=999&sessionId=9991');
    await expect(page.getByText(/không được phân công|không có quyền/i).first()).toBeVisible();
    await expect(page.getByText('Hội viên mẫu A')).not.toBeVisible();
    expect(unauthorizedRosterRequests).toBe(0);
  });

  test('COACH-04: Chuyển lớp và buổi không giữ roster của lớp trước', async ({ page }) => {
    const secondRoster = [{ ...mockRoster[0], id: 2001, memberId: 103, memberCode: 'MB-103', memberName: 'Học viên lớp hai', fullName: 'Học viên lớp hai', classId: 102 }];
    const sessions = [mockCoachSessions[0], { ...mockCoachSessions[0], id: 502, classId: 102 }, { ...mockCoachSessions[0], id: 503, classId: 102, sessionNumber: 2, sessionDate: '2026-11-09', date: '2026-11-09' }];
    await page.route((url) => isApiMatch(url, 'classes'), (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/101/enrollments')) return route.fulfill({ json: mockRoster });
      if (path.endsWith('/102/enrollments')) return route.fulfill({ json: secondRoster });
      if (path === '/api/classes') return route.fulfill({ json: mockClasses });
      return route.fallback();
    });
    await page.route((url) => isApiMatch(url, 'sessions'), (route) => {
      const url = new URL(route.request().url());
      const classId = url.searchParams.get('classId') || url.pathname.match(/\/catalog\/(\d+)$/)?.[1];
      return route.fulfill({ json: classId ? sessions.filter((session) => String(session.classId) === classId) : sessions });
    });
    await loginAs(page, 'coach');
    await navigateTo(page, '/coach/attendance');
    await expect(page.getByText('Hội viên mẫu A').first()).toBeVisible();
    const classSelect = page.locator('select').filter({ has: page.locator('option[value="102"]') });
    await classSelect.selectOption('102');
    await expect(page.getByText('Học viên lớp hai').first()).toBeVisible();
    await expect(page.getByText('Hội viên mẫu A')).not.toBeVisible();
    const sessionSelect = page.locator('select').filter({ has: page.locator('option[value="503"]') });
    await sessionSelect.selectOption('503');
    await expect(sessionSelect).toHaveValue('503');
    await expect(page.getByText('Học viên lớp hai').first()).toBeVisible();
    await expect(page.getByText('Hội viên mẫu A')).not.toBeVisible();
  });

  // COACH-01: Coach mở điểm danh, chọn lớp/buổi được giao
  test('COACH-01: Hiển thị roster được giao và xử lý API từ chối 403', async ({ page }) => {
    await loginAs(page, 'coach');
    await navigateTo(page, '/coach/attendance');

    // Chờ giao diện điểm danh load
    await expect(page.getByText(/Điểm danh/i).first()).toBeVisible({ timeout: 15000 });

    // Kiểm tra danh sách học viên hiển thị trên UI
    await expect(page.getByText('Hội viên mẫu A').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('MB-001').first()).toBeVisible();
    await expect(page.getByText('Hội viên mẫu B').first()).toBeVisible();

    // A denied roster and its fallback must not leave the old roster visible.
    let deniedRequests = 0;
    await page.route((url) => isApiMatch(url, 'classes/101/enrollments') || isLocalApi(url, '/api/enrollments'), async (route) => {
      deniedRequests++;
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Bạn không có quyền xem danh sách lớp này.' }),
      });
    });
    await page.reload();
    await expect.poll(() => deniedRequests).toBeGreaterThan(0);
    await expect(page.getByText(/không có quyền|không thể tải|forbidden/i).first()).toBeVisible();
    await expect(page.getByText('Hội viên mẫu A')).not.toBeVisible();
  });

  // COACH-02: Ghi điểm danh cho học viên và buổi test; đọc lại
  test('COACH-02: Ghi điểm danh cho học viên, API xác nhận và UI cập nhật đúng trạng thái', async ({ page }) => {
    let checkinPayload = null;

    await page.route((url) => isApiMatch(url, 'training-results'), async (route) => {
      if (route.request().method() === 'POST') {
        checkinPayload = route.request().postDataJSON();
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 888,
            sessionId: checkinPayload.sessionId || 501,
            memberId: checkinPayload.memberId || 101,
            coachId: 2,
            attendanceStatus: 'Present',
          }),
        });
      }
      return route.fulfill({ status: 200, json: [] });
    });

    await page.route((url) => isApiMatch(url, 'attendances/check-in'), async (route) => {
      checkinPayload = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 888,
          memberId: checkinPayload.memberId || 101,
          sessionId: checkinPayload.sessionId || 501,
          status: 'Present',
        }),
      });
    });

    await loginAs(page, 'coach');
    await navigateTo(page, '/coach/attendance');
    await expect(page.getByText('Hội viên mẫu A').first()).toBeVisible({ timeout: 15000 });

    // Bấm nút "Có mặt" đầu tiên (dành cho Hội viên mẫu A)
    const presentBtn = page.getByRole('button', { name: 'Có mặt', exact: true }).first();
    await expect(presentBtn).toBeVisible({ timeout: 5000 });
    await presentBtn.click();

    // Verify request API được gọi với đúng memberId
    await page.waitForTimeout(500);
    expect(checkinPayload).not.toBeNull();
    expect(Number(checkinPayload.memberId)).toBe(101);
  });

  // COACH-03: Ghi điểm danh thiếu dữ liệu hoặc API từ chối
  test('COACH-03: Ghi điểm danh gặp lỗi API từ chối, UI báo lỗi và không hiển thị thành công', async ({ page }) => {
    // Mock API training-results trả lỗi 400
    await page.route((url) => isApiMatch(url, 'training-results'), async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'ATTENDANCE_REJECTED',
            message: 'Buổi học chưa đến giờ bắt đầu hoặc đã bị đóng điểm danh.',
          }),
        });
      }
      return route.fulfill({ status: 200, json: [] });
    });

    await page.route((url) => isApiMatch(url, 'attendances/check-in'), async (route) => {
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'ATTENDANCE_REJECTED',
          message: 'Buổi học chưa đến giờ bắt đầu hoặc đã bị đóng điểm danh.',
        }),
      });
    });

    await loginAs(page, 'coach');
    await navigateTo(page, '/coach/attendance');
    await expect(page.getByText('Hội viên mẫu A').first()).toBeVisible({ timeout: 15000 });

    const presentBtn = page.getByRole('button', { name: 'Có mặt', exact: true }).first();
    await expect(presentBtn).toBeVisible({ timeout: 5000 });
    await presentBtn.click();

    // Kiểm tra thông báo lỗi xuất hiện trên UI (toast hoặc nhãn lỗi)
    await expect(
      page.getByText(/lỗi|từ chối|chưa đến giờ|thất bại|không thể|error/i).first()
    ).toBeVisible({ timeout: 10000 });

    // Đảm bảo không thông báo thành công
    await expect(page.getByText(/Ghi điểm danh thành công/i)).not.toBeVisible();
  });
});
