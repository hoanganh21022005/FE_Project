import { test, expect } from './helpers/guardedTest.js';
import { loginAs, navigateTo, setupDefaultApiMocks, isApiMatch } from './helpers/mockAuth.js';

const coaches = [
  { id: 6, name: 'HLV Đang Hoạt Động', email: 'active@example.invalid', phone: '0900000001', specialization: 'Quần vợt', specializations: ['Quần vợt'], status: 'active' },
];

const subjects = [
  { id: 2, name: 'Quần vợt (Tennis)', slug: 'tennis', normalPrice: 800000, advancedPrice: 3000000, status: 'active' },
];

const subscription = {
  subscriptionId: 77, id: 77, memberId: 101, status: 'Active', packageType: 'Advanced',
  subjectId: 2, primaryCoachId: 6, totalCredit: 12, remainingCredit: 12,
};

test.describe('Member: tải gói đăng ký ở màn "HLV của tôi"', () => {
  test('Tải gói Advanced đang hoạt động không phát sinh cảnh báo lỗi tải gói và vẫn hiện credit còn lại', async ({ page }) => {
    const subscriptionWarnings = [];
    page.on('console', (message) => {
      if (message.text().startsWith('Could not fetch subscriptions')) {
        subscriptionWarnings.push(message.text());
      }
    });

    await setupDefaultApiMocks(page, ['/api/public/subjects', '/api/classes']);
    const empty = ['/api/members/101/enrollments', '/api/members/me/invoices'];
    await page.route((url) => empty.includes(new URL(url).pathname), (r) => {
      if (r.request().method() !== 'GET') return r.fallback();
      return r.fulfill({ status: 200, json: [] });
    });
    await page.route((url) => isApiMatch(url, 'subjects'), (r) => r.fulfill({ status: 200, json: subjects }));
    await page.route(
      (url) => isApiMatch(url, 'coaches') && new URL(url).pathname === '/api/coaches',
      (r) => r.fulfill({ status: 200, json: coaches }),
    );
    await page.route((url) => new URL(url).pathname === '/api/private-session-proposals', (r) => {
      if (r.request().method() !== 'GET') return r.fallback();
      return r.fulfill({ status: 200, json: [] });
    });
    await page.route(
      (url) => new URL(url).pathname === '/api/members/101/subscriptions',
      (r) => r.fulfill({ status: 200, json: [subscription] }),
    );

    await loginAs(page, 'member');
    const subscriptionsResponse = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/members/101/subscriptions',
    );
    await navigateTo(page, '/member/my-coach');
    await subscriptionsResponse;

    // Danh sách gói đã vào state (chứng tỏ nhánh có gói đang hoạt động đã chạy) và credit hiển thị đúng.
    await page.getByRole('button', { name: /Lịch 1:1 & đề xuất/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Credit gói Advanced' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Còn lại:').first()).toBeVisible();
    await expect(page.getByText('12', { exact: true }).first()).toBeVisible();

    expect(subscriptionWarnings).toEqual([]);
  });
});
