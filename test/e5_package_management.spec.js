import { test, expect } from './helpers/guardedTest.js';
import { loginAs, navigateTo, setupDefaultApiMocks } from './helpers/mockAuth.js';

test.describe('E5: Màn Gói tập ẩn nút ghi ở chế độ BE thật và giữ phần xem', () => {
  test('apiEnabled = true: không có nút Tạo/Sửa/Đổi trạng thái gói, có dòng giải thích và vẫn xem học phí theo môn', async ({ page }) => {
    await setupDefaultApiMocks(page, [
      '/api/members',
      '/api/classes',
      '/api/packages',
      '/api/sessions',
      '/api/notifications',
      '/api/notifications/me',
      '/api/invoices',
    ]);
    await page.route((url) => new URL(url).pathname === '/api/subjects', (route) =>
      route.fulfill({
        status: 200,
        json: [
          { id: 1, name: 'Boxing', status: 'active', normalPrice: 800000, advancedPrice: 2500000, outdoor: false },
        ],
      }),
    );

    await loginAs(page, 'manager');
    await navigateTo(page, '/manager/packages');

    await expect(
      page.getByText('Gói hội viên chung đã ngừng bán; gói Advanced mua theo môn học và huấn luyện viên.'),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Boxing')).toBeVisible();
    await expect(page.getByRole('button', { name: /Tạo gói|Thêm gói|Chỉnh sửa|Ngừng bán|Kích hoạt/i })).toHaveCount(0);
  });
});
