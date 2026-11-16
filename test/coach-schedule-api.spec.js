import { test, expect } from './helpers/guardedTest.js';
import { loginAs, navigateTo, setupDefaultApiMocks, isApiMatch } from './helpers/mockAuth.js';
import { mockClasses, mockCoachSessions, mockRoster, mockUsers } from './helpers/mockData.js';

const coachList = [
  {
    id: 2,
    userId: 2,
    name: mockUsers.coach.name,
    email: mockUsers.coach.email,
    phone: '0900000002',
    specializations: ['Cầu lông'],
    status: 'Active',
  },
];

const coachAuthUserWithoutCoachId = {
  userId: 2,
  id: 2,
  email: mockUsers.coach.email,
  fullName: mockUsers.coach.name,
  name: mockUsers.coach.name,
  role: 'Coach',
  authorities: ['ROLE_COACH'],
};

const sessionFromCoachId = {
  ...mockCoachSessions[0],
  id: 501,
  classId: 101,
  className: 'Lớp Cầu Lông Cơ Bản K01',
  coachId: 2,
  coachName: mockUsers.coach.name,
  sessionDate: '2026-11-16',
  startTime: '08:00:00',
  endTime: '09:30:00',
  status: 'Scheduled',
};

const sessionFromClassFallback = {
  ...mockCoachSessions[0],
  id: 509,
  classId: 102,
  className: 'Lớp Bổ Sung Pha 2',
  coachId: 2,
  coachName: mockUsers.coach.name,
  sessionDate: '2026-11-16',
  startTime: '14:00:00',
  endTime: '15:30:00',
  status: 'Scheduled',
};

async function loginAsCoachWithoutCoachId(page) {
  let loggedIn = false;
  await page.route((url) => isApiMatch(url, 'auth/me'), async (route) => {
    if (loggedIn) {
      return route.fulfill({ status: 200, json: coachAuthUserWithoutCoachId });
    }
    return route.fulfill({ status: 401, json: { message: 'Unauthenticated' } });
  });
  await page.route((url) => isApiMatch(url, 'auth/login'), async (route) => {
    loggedIn = true;
    return route.fulfill({ status: 200, json: coachAuthUserWithoutCoachId });
  });

  await page.goto('/login');
  await page.locator('#login-email').fill(coachAuthUserWithoutCoachId.email);
  await page.locator('#login-password').fill('Password123');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/coach/, { timeout: 10000 });
}

test.describe('W-A4: Coach API cleanup, fast schedule & no /api/staff (L20, L02, L30)', () => {
  test('AC1 & AC2: Không gọi /api/coaches/me ở các màn Coach; dò coachId qua /api/coaches và gọi sessions?coachId=2', async ({ page }) => {
    const requestedUrls = [];
    page.on('request', (req) => {
      requestedUrls.push(new URL(req.url()).pathname + new URL(req.url()).search);
    });

    await setupDefaultApiMocks(page, [
      '/api/members',
      '/api/training-plans',
      '/api/training-results',
      '/api/time-slots',
      '/api/absence-notices',
      '/api/advanced-registrations',
      '/api/private-session-proposals',
    ]);

    await page.route((url) => isApiMatch(url, 'coaches'), async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/coaches') {
        return route.fulfill({ status: 200, json: coachList });
      }
      if (path === '/api/coaches/me') {
        return route.fulfill({ status: 404, json: { message: 'Not Found' } });
      }
      if (path.endsWith('/work-schedule')) {
        return route.fulfill({ status: 200, json: { acceptingNew: true, weeklySlots: [], daysOff: [] } });
      }
      return route.fulfill({ status: 200, json: [] });
    });

    await page.route((url) => isApiMatch(url, 'classes'), async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/enrollments')) {
        return route.fulfill({ status: 200, json: mockRoster });
      }
      return route.fulfill({ status: 200, json: [mockClasses[0]] });
    });

    await page.route((url) => isApiMatch(url, 'sessions'), async (route) => {
      return route.fulfill({ status: 200, json: [sessionFromCoachId] });
    });

    await page.route((url) => isApiMatch(url, 'attendances'), async (route) => {
      return route.fulfill({ status: 200, json: [] });
    });

    await loginAsCoachWithoutCoachId(page);

    await navigateTo(page, '/coach/schedule');
    await expect(page.getByText('Lớp Cầu Lông Cơ Bản K01').first()).toBeVisible({ timeout: 10000 });

    await navigateTo(page, '/coach/training-progress');
    await page.waitForTimeout(400);

    await navigateTo(page, '/coach/attendance');
    await expect(page.getByText('Hội viên mẫu A').first()).toBeVisible({ timeout: 10000 });

    const coachesMeCalls = requestedUrls.filter((u) => u.split('?')[0] === '/api/coaches/me');
    expect(coachesMeCalls).toEqual([]);

    expect(requestedUrls.some((u) => u.split('?')[0] === '/api/coaches')).toBeTruthy();
    expect(requestedUrls.some((u) => u.includes('/api/sessions') && u.includes('coachId=2'))).toBeTruthy();
  });

  test('AC3: Lịch dạy Coach vẽ ngay từ GET /api/sessions?coachId= trong <= 3s dù catalog và classId trễ 8s, sau đó gộp thêm không trùng', async ({ page }) => {
    await setupDefaultApiMocks(page, [
      '/api/members',
      '/api/training-plans',
      '/api/training-results',
      '/api/time-slots',
      '/api/absence-notices',
      '/api/advanced-registrations',
      '/api/private-session-proposals',
    ]);

    await page.route((url) => isApiMatch(url, 'coaches'), async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/coaches') return route.fulfill({ status: 200, json: coachList });
      if (path.endsWith('/work-schedule')) {
        return route.fulfill({ status: 200, json: { acceptingNew: true, weeklySlots: [], daysOff: [] } });
      }
      return route.fulfill({ status: 200, json: [] });
    });

    await page.route((url) => isApiMatch(url, 'classes'), async (route) => {
      return route.fulfill({ status: 200, json: [mockClasses[0]] });
    });

    await page.route((url) => isApiMatch(url, 'sessions'), async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/sessions/catalog/')) {
        await new Promise((r) => setTimeout(r, 8000));
        return route.fulfill({ status: 200, json: [sessionFromCoachId, sessionFromClassFallback] });
      }
      if (url.searchParams.has('classId')) {
        await new Promise((r) => setTimeout(r, 8000));
        return route.fulfill({ status: 200, json: [sessionFromCoachId, sessionFromClassFallback] });
      }
      return route.fulfill({ status: 200, json: [sessionFromCoachId] });
    });

    await loginAs(page, 'coach');

    const startMs = Date.now();
    await navigateTo(page, '/coach/schedule');

    await expect(page.getByRole('button', { name: /Tất cả \(1\)/i })).toBeVisible({ timeout: 3000 });
    const elapsedMs = Date.now() - startMs;
    console.log(`[AC3_TIMING] phase1_visible_ms=${elapsedMs}`);
    expect(elapsedMs).toBeLessThanOrEqual(3000);

    // Chờ pha 2 hoàn tất (8s) và kiểm tra buổi từ pha 2 được gộp thêm không trùng
    await expect(page.getByRole('button', { name: /Tất cả \(2\)/i })).toBeVisible({ timeout: 12000 });
    await page.getByRole('button', { name: /Danh sách chi tiết/i }).click();
    await expect(page.getByText('Lớp Bổ Sung Pha 2').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Lớp Cầu Lông Cơ Bản K01').first()).toBeVisible();
  });

  test('AC4: Quét điểm danh gọi POST /api/attendances/scan và không gọi qr-checkin; manualCheckIn khi check-in 404 không gọi POST /api/attendances', async ({ page }) => {
    const postUrls = [];
    page.on('request', (req) => {
      if (req.method() === 'POST') {
        postUrls.push(new URL(req.url()).pathname);
      }
    });

    await setupDefaultApiMocks(page, ['/api/members', '/api/classes', '/api/sessions', '/api/attendances']);

    await page.route((url) => isApiMatch(url, 'attendances'), async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      if (req.method() === 'POST' && path === '/api/attendances/scan') {
        return route.fulfill({ status: 200, json: { id: 1, sessionId: 501, memberId: 101, state: 'Present' } });
      }
      if (req.method() === 'POST' && path === '/api/attendances/check-in') {
        return route.fulfill({ status: 404, json: { message: 'Not found' } });
      }
      if (req.method() === 'POST') {
        return route.fulfill({ status: 404, json: { message: 'Should not be called' } });
      }
      return route.fulfill({ status: 200, json: [] });
    });

    await loginAs(page, 'receptionist');
    await navigateTo(page, '/receptionist/checkin');

    // Gọi trực tiếp scanAttendance và manualCheckIn qua module đã bundle để kiểm chính xác hành vi API helper
    const result = await page.evaluate(async () => {
      const mod = await import('/src/api/attendanceApi.js');
      const scanRes = await mod.scanAttendance({ code: '123456', sessionId: 501 });
      let manualFailed = false;
      try {
        await mod.manualCheckIn({ memberId: 101 });
      } catch {
        manualFailed = true;
      }
      return { scanRes, manualFailed };
    });

    expect(result.scanRes?.state).toBe('Present');
    expect(result.manualFailed).toBe(true);
    expect(postUrls).toContain('/api/attendances/scan');
    expect(postUrls).not.toContain('/api/attendances/qr-checkin');
    expect(postUrls).not.toContain('/api/attendances');
  });

  test('AC5: Coach mở /coach/assigned-members không gọi GET /api/staff; Lễ tân vẫn gọi GET /api/staff bình thường', async ({ page }) => {
    const coachStaffRequests = [];
    page.on('request', (req) => {
      const path = new URL(req.url()).pathname;
      if (path === '/api/staff' && req.method() === 'GET') {
        coachStaffRequests.push(path);
      }
    });

    await setupDefaultApiMocks(page, [
      '/api/members',
      '/api/classes',
      '/api/sessions',
      '/api/training-plans',
      '/api/training-results',
      '/api/coaches/me/at-risk-members',
      '/api/coaches/me/feedback',
      '/api/advanced-registrations',
      '/api/private-session-proposals',
    ]);
    await page.route((url) => isApiMatch(url, 'coaches'), (r) => r.fulfill({ status: 200, json: coachList }));

    await loginAs(page, 'coach');
    await navigateTo(page, '/coach/assigned-members');
    await page.waitForTimeout(800);

    expect(coachStaffRequests).toEqual([]);

    // Kiểm tra vai trò khác (Receptionist) vẫn gọi GET /api/staff bình thường
    const receptionistContext = await page.context().browser().newContext();
    const recPage = await receptionistContext.newPage();
    const recStaffRequests = [];
    recPage.on('request', (req) => {
      const path = new URL(req.url()).pathname;
      if (path === '/api/staff' && req.method() === 'GET') {
        recStaffRequests.push(path);
      }
    });
    await setupDefaultApiMocks(recPage, ['/api/members', '/api/classes', '/api/sessions', '/api/invoices', '/api/attendances']);
    await loginAs(recPage, 'receptionist');
    await recPage.waitForTimeout(800);
    await receptionistContext.close();

    expect(recStaffRequests.length).toBeGreaterThan(0);
  });
});
