import { test, expect } from './helpers/guardedTest.js';
import { loginAs, navigateTo, setupDefaultApiMocks, isApiMatch } from './helpers/mockAuth.js';

const coaches = [
  { id: 6, name: 'HLV Đang Hoạt Động', email: 'active@example.invalid', phone: '0900000001', specialization: 'Quần vợt', specializations: ['Quần vợt'], status: 'Active' },
  { id: 29, name: 'Demo Inactive Coach', email: 'inactive@example.invalid', phone: '0900000002', specialization: 'Quần vợt', specializations: ['Quần vợt'], status: 'Inactive' },
];

const subjects = [
  { id: 2, name: 'Quần vợt (Tennis)', slug: 'tennis', normalPrice: 800000, advancedPrice: 3000000, status: 'active' },
];

const subscription = {
  subscriptionId: 77, id: 77, memberId: 101, status: 'Active', packageType: 'Advanced',
  subjectId: 2, primaryCoachId: 6, totalCredit: 12, remainingCredit: 12,
  startDate: '2026-11-10', endDate: '2026-12-25',
};

async function mockCommon(page) {
  await setupDefaultApiMocks(page, ['/api/public/subjects', '/api/classes']);
  await page.route((url) => isApiMatch(url, 'subjects'), (r) => r.fulfill({ status: 200, json: subjects }));
  await page.route((url) => isApiMatch(url, 'coaches') && new URL(url).pathname === '/api/coaches', (r) => r.fulfill({ status: 200, json: coaches }));
  // Route đăng ký sau cùng được ưu tiên: ca nào cần dữ liệu riêng sẽ ghi đè mock rỗng này.
  await page.route((url) => new URL(url).pathname === '/api/members/101/subscriptions', (r) => r.fulfill({ status: 200, json: [] }));
}

test.describe('Member: danh bạ HLV và tên môn/HLV của gói (L03, L06)', () => {
  test('COACH-01: danh bạ chỉ hiện Coach đang hoạt động, không hiện Coach Inactive', async ({ page }) => {
    await mockCommon(page);
    await loginAs(page, 'member');
    await navigateTo(page, '/member/my-coach');

    await expect(page.getByRole('heading', { name: 'HLV Đang Hoạt Động' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Demo Inactive Coach')).toHaveCount(0);
    await expect(page.getByText('• Đang nhận học viên')).toHaveCount(1);
  });

  test('MEMB-01: gói Advanced hiện tên môn và Primary Coach thay cho "Môn #" và "HLV #"', async ({ page }) => {
    await mockCommon(page);
    await page.route((url) => new URL(url).pathname === '/api/members/101/subscriptions', (r) => r.fulfill({ status: 200, json: [subscription] }));
    await page.route((url) => new URL(url).pathname === '/api/members/101/enrollments', (r) => r.fulfill({ status: 200, json: [] }));
    await page.route((url) => new URL(url).pathname === '/api/members/me/invoices', (r) => r.fulfill({ status: 200, json: [] }));
    await loginAs(page, 'member');
    await navigateTo(page, '/member/my-membership');

    await expect(page.getByText('Quần vợt (Tennis)').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('HLV Đang Hoạt Động').first()).toBeVisible();
    await expect(page.getByText(/Môn #\d+/)).toHaveCount(0);
    await expect(page.getByText(/HLV #\d+/)).toHaveCount(0);
  });

  test('MEMB-02: tra tên lỗi thì giữ nhãn mã, không làm hỏng trang', async ({ page }) => {
    await setupDefaultApiMocks(page, ['/api/public/subjects', '/api/classes']);
    await page.route((url) => isApiMatch(url, 'subjects'), (r) => r.fulfill({ status: 500, json: { message: 'lỗi' } }));
    await page.route((url) => isApiMatch(url, 'coaches') && new URL(url).pathname === '/api/coaches', (r) => r.fulfill({ status: 500, json: { message: 'lỗi' } }));
    await page.route((url) => new URL(url).pathname === '/api/members/101/subscriptions', (r) => r.fulfill({ status: 200, json: [subscription] }));
    await page.route((url) => new URL(url).pathname === '/api/members/101/enrollments', (r) => r.fulfill({ status: 200, json: [] }));
    await page.route((url) => new URL(url).pathname === '/api/members/me/invoices', (r) => r.fulfill({ status: 200, json: [] }));
    await loginAs(page, 'member');
    await navigateTo(page, '/member/my-membership');

    await expect(page.getByText('Môn #2').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('HLV #6').first()).toBeVisible();
  });
});
