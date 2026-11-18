import { test, expect } from './helpers/guardedTest.js';
import { loginAs, navigateTo, setupDefaultApiMocks, isApiMatch } from './helpers/mockAuth.js';
import { mockClasses } from './helpers/mockData.js';

// Ngày hiện tại theo UTC, cùng cách màn Coach tính `todayIso`; không dùng ngày cố định.
const todayIso = new Date().toISOString().slice(0, 10);

// Một buổi PT 1:1 của Coach (id 2) chưa có học viên nào điểm danh: màn hiện trạng thái rỗng kèm nút điều hướng.
const privateSession = {
  id: 9501,
  classId: null,
  isPrivate: true,
  coachId: 2,
  coachName: "Huấn luyện viên mẫu A",
  sessionDate: todayIso,
  startTime: "08:00:00",
  endTime: "09:00:00",
  sessionNumber: 1,
  status: "Scheduled",
};

test.describe('Điểm danh Coach: trạng thái rỗng của chế độ 1:1 PT', () => {
  test.beforeEach(async ({ page }) => {
    await setupDefaultApiMocks(page, ['/api/members', '/api/training-plans', '/api/training-results']);

    await page.route((url) => isApiMatch(url, 'classes'), async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/classes') {
        return route.fulfill({ status: 200, json: [mockClasses[0]] });
      }
      return route.fallback();
    });

    await page.route((url) => isApiMatch(url, 'sessions'), async (route) => {
      return route.fulfill({ status: 200, json: [privateSession] });
    });

    await page.route((url) => isApiMatch(url, 'attendances'), async (route) => {
      return route.fulfill({ status: 200, json: [] });
    });
  });

  test('Nút "Đăng ký sân cho học viên PT 1:1" chuyển sang màn học viên được giao và không gây lỗi trang', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await loginAs(page, 'coach');
    await page.evaluate(() => {
      sessionStorage.setItem('scms_selected_attendance_coach_id', '2');
      sessionStorage.setItem('scms_selected_attendance_class_id', 'PT_1ON1');
    });

    await navigateTo(page, '/coach/attendance');

    await expect(
      page.getByText('Chưa có buổi tập PT 1:1 nào được chọn hoặc chưa có lịch tập khả dụng.'),
    ).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /Đăng ký sân cho học viên PT 1:1/ }).click();

    await expect.soft(page).toHaveURL(/\/coach\/assigned-members$/, { timeout: 10000 });
    expect(pageErrors).toEqual([]);
  });
});
