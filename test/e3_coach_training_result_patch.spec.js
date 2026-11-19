import { test, expect } from './helpers/guardedTest.js';
import { loginAs, navigateTo, setupDefaultApiMocks } from './helpers/mockAuth.js';

test.describe('E3: CoachTrainingProgress nhận xét sau buổi dùng PATCH, không POST giả', () => {
  test('Buổi Completed đã có result -> gọi PATCH /api/training-results/{id}/content, không gọi POST', async ({ page }) => {
    let postCalls = 0;
    const patchCalls = [];

    await setupDefaultApiMocks(page, [
      '/api/classes',
      '/api/members',
      '/api/training-plans',
      '/api/evaluations',
      '/api/attendances',
      '/api/notifications',
      '/api/coaches/me/feedback',
      '/api/coaches/me/at-risk-members',
      '/api/advanced-registrations',
    ]);

    await page.route((url) => new URL(url).pathname === '/api/sessions', (route) =>
      route.fulfill({
        status: 200,
        json: [
          {
            id: 501,
            classId: 201,
            className: 'Boxing Cơ Bản',
            coachId: 2,
            sessionDate: '2026-11-18',
            startTime: '08:00:00',
            endTime: '09:30:00',
            status: 'Completed',
          },
        ],
      }),
    );

    await page.route((url) => new URL(url).pathname === '/api/classes/201/enrollments', (route) =>
      route.fulfill({
        status: 200,
        json: [{ id: 1, classId: 201, memberId: 101, memberName: 'Học Viên A', status: 'Active' }],
      }),
    );

    await page.route((url) => new URL(url).pathname === '/api/training-results', async (route) => {
      if (route.request().method() === 'POST') {
        postCalls += 1;
        return route.fulfill({ status: 400, json: { code: 'ATTENDANCE_WINDOW_CLOSED', message: 'Window closed' } });
      }
      return route.fulfill({
        status: 200,
        json: [
          {
            resultId: 88,
            id: 88,
            sessionId: 501,
            memberId: 101,
            coachId: 2,
            attendanceStatus: 'Present',
            content: 'Nhận xét ban đầu',
          },
        ],
      });
    });

    await page.route((url) => new URL(url).pathname === '/api/training-results/88/content', async (route) => {
      if (route.request().method() === 'PATCH') {
        patchCalls.push(route.request().postDataJSON());
        return route.fulfill({
          status: 200,
          json: {
            resultId: 88,
            id: 88,
            sessionId: 501,
            memberId: 101,
            coachId: 2,
            attendanceStatus: 'Present',
            content: 'Cập nhật nhận xét sau buổi',
          },
        });
      }
      return route.fallback();
    });

    await loginAs(page, 'coach');
    await navigateTo(page, '/coach/progress');

    await page.getByRole('tab', { name: /Nhật ký buổi tập/i }).click();
    const resultInput = page.locator('textarea').first();
    await expect(resultInput).toBeVisible({ timeout: 10000 });
    await resultInput.fill('Cập nhật nhận xét sau buổi');

    const submitBtn = page.getByRole('button', { name: /Lưu kết quả|Ghi nhận/i }).first();
    await submitBtn.click();

    await expect.poll(() => patchCalls.length, { timeout: 10000 }).toBe(1);
    expect(postCalls).toBe(0);
    expect(patchCalls[0]).toEqual({ content: 'Cập nhật nhận xét sau buổi' });
  });
});
