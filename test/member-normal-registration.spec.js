import { test, expect } from './helpers/guardedTest.js';
import { loginAs, navigateTo, setupDefaultApiMocks, isApiMatch } from './helpers/mockAuth.js';

// Toàn bộ dữ liệu ở đây là mock (không có Backend thật): kiểm đăng ký lớp Normal theo registrationAllowed.
const subjects = [
  { id: 2, name: 'Quần vợt (Tennis)', slug: 'tennis', normalPrice: 800000, advancedPrice: 3000000, status: 'active' },
];

const futureDate = (days) => new Date(Date.now() + days * 24 * 3600 * 1000).toISOString().slice(0, 10);

const normalClass = (extra = {}) => ({
  id: 51, name: 'Tennis N01', subjectId: 2, subjectName: 'Quần vợt (Tennis)', coachId: 6, coachName: 'HLV Quần vợt',
  classType: 'Normal', status: 'Open', startDate: futureDate(10), endDate: futureDate(80), startTime: '18:00', endTime: '19:30',
  totalSessions: 12, maxCapacity: 10, enrolledCount: 3, tuitionFee: 800000, ...extra,
});

const sessions = Array.from({ length: 12 }, (_, i) => ({
  id: 500 + i, classId: 51, sessionDate: futureDate(10 + i * 7), startTime: '18:00', endTime: '19:30', status: 'Scheduled',
}));

async function setup(page, courseClass, enrollResponse = null) {
  const counts = { enrollPosts: 0, payOnline: 0, invoices: 0, enrollmentGets: 0, classGets: 0 };
  await setupDefaultApiMocks(page, ['/api/public/subjects']);
  await page.route((url) => isApiMatch(url, 'subjects'), (r) => r.fulfill({ status: 200, json: subjects }));
  await page.route((url) => isApiMatch(url, 'classes') && new URL(url).pathname === '/api/classes', (r) => {
    counts.classGets += 1;
    return r.fulfill({ status: 200, json: [courseClass] });
  });
  await page.route((url) => new URL(url).pathname === '/api/sessions/catalog/51', (r) => r.fulfill({ status: 200, json: sessions }));
  await page.route((url) => isApiMatch(url, 'members'), (r) => r.fulfill({ status: 200, json: [] }));
  await page.route((url) => new URL(url).pathname === '/api/members/101/enrollments', (r) => { counts.enrollmentGets += 1; return r.fulfill({ status: 200, json: [] }); });
  await page.route((url) => new URL(url).pathname === '/api/advanced-registrations', (r) => r.fulfill({ status: 200, json: [] }));
  await page.route((url) => isApiMatch(url, 'specializations'), (r) => r.fulfill({ status: 200, json: [] }));
  await page.route((url) => new URL(url).pathname === '/api/classes/51/enroll', (r) => {
    counts.enrollPosts += 1;
    return r.fulfill(enrollResponse ?? { status: 200, json: { status: 'Waitlisted', enrollmentId: 88, classId: 51 } });
  });
  await page.route((url) => /\/pay-online$/.test(new URL(url).pathname), (r) => { counts.payOnline += 1; return r.fulfill({ status: 500, json: {} }); });
  await page.route((url) => new URL(url).pathname === '/api/invoices', (r) => { counts.invoices += 1; return r.fulfill({ status: 500, json: {} }); });
  await loginAs(page, 'member');
  await navigateTo(page, '/member/catalog?tier=normal&sport=tennis');
  return counts;
}

test.describe('Member: đăng ký lớp Normal theo registrationAllowed (mock)', () => {
  test('registrationAllowed === false khóa nút, nêu lý do NORMAL_REGISTRATION_CLOSED và hạn đăng ký', async ({ page }) => {
    const counts = await setup(page, normalClass({
      registrationAllowed: false, registrationBlockReason: 'NORMAL_REGISTRATION_CLOSED', registrationDeadline: '2026-11-25T09:30:00+07:00',
    }));
    await expect(page.getByText('Tennis N01').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Quá hạn đăng ký/ })).toBeDisabled();
    await expect(page.getByText('Lớp đã đóng đăng ký.').first()).toBeVisible();
    await expect(page.getByText(/Hạn đăng ký: .*25\/11\/2026/)).toBeVisible();
    expect(counts.enrollPosts).toBe(0);
  });

  test('registrationAllowed === false với hạn không đọc được: vẫn khóa, không hiện NaN', async ({ page }) => {
    await setup(page, normalClass({ registrationAllowed: false, registrationBlockReason: 'NORMAL_REGISTRATION_CLOSED', registrationDeadline: 'rác' }));
    await expect(page.getByRole('button', { name: /Quá hạn đăng ký/ })).toBeDisabled({ timeout: 15000 });
    await expect(page.getByText(/Hạn đăng ký:/)).toHaveCount(0);
    await expect(page.getByText(/NaN|Invalid/)).toHaveCount(0);
  });

  test('registrationAllowed === true: lớp đầy vẫn mở nút; đăng ký vào danh sách chờ và KHÔNG đi tiếp thanh toán', async ({ page }) => {
    const counts = await setup(page, normalClass({ registrationAllowed: true, maxCapacity: 10, enrolledCount: 10 }));
    await expect(page.getByText('Đã đủ chỗ · nhận danh sách chờ')).toBeVisible({ timeout: 15000 });
    const button = page.getByRole('button', { name: /Đăng ký lớp/ }).first();
    await expect(button).toBeEnabled();
    await button.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/vào danh sách chờ/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Gửi đăng ký' }).click();

    await expect.poll(() => counts.enrollPosts).toBe(1);
    await expect(page.getByText(/được vào danh sách chờ/).first()).toBeVisible();
    await expect(dialog).toBeHidden();
    // Không tạo hóa đơn, không gọi thanh toán VNPay cho danh sách chờ
    expect(counts.payOnline).toBe(0);
    expect(counts.invoices).toBe(0);
    await expect(page.getByRole('button', { name: /Tiếp tục thanh toán VNPay/ })).toHaveCount(0);
    // Tải lại trạng thái thật sau khi đăng ký
    await expect.poll(() => counts.enrollmentGets).toBeGreaterThan(1);
  });

  test('Thiếu field và lớp đầy: giữ hành vi cũ (không mở nút, lý do "Lớp đã đủ chỗ.")', async ({ page }) => {
    const counts = await setup(page, normalClass({ maxCapacity: 10, enrolledCount: 10 }));
    await expect(page.getByText('Tennis N01').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Đăng ký lớp/ }).first()).toBeDisabled();
    await expect(page.getByText('Lớp đã đủ chỗ.').first()).toBeVisible();
    expect(counts.enrollPosts).toBe(0);
  });

  test('Thiếu field và lớp còn chỗ: nút mở như cũ', async ({ page }) => {
    await setup(page, normalClass());
    await expect(page.getByRole('button', { name: /Đăng ký lớp/ }).first()).toBeEnabled({ timeout: 15000 });
  });

  test('WAITLIST_FULL (409): báo từ bảng chung, tải lại lớp, không báo thành công', async ({ page }) => {
    const counts = await setup(
      page,
      normalClass({ registrationAllowed: true, maxCapacity: 10, enrolledCount: 10 }),
      { status: 409, json: { code: 'WAITLIST_FULL', message: 'WAITLIST_FULL: waitlist is full' } },
    );
    await expect(page.getByText('Đã đủ chỗ · nhận danh sách chờ')).toBeVisible({ timeout: 15000 });
    const getsBefore = counts.classGets;
    await page.getByRole('button', { name: /Đăng ký lớp/ }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Gửi đăng ký' }).click();
    await expect(page.getByRole('dialog').getByText('Danh sách chờ đã đầy.')).toBeVisible();
    await expect(page.getByText(/được vào danh sách chờ/)).toHaveCount(0);
    await expect.poll(() => counts.classGets).toBeGreaterThan(getsBefore);
    expect(counts.payOnline).toBe(0);
  });
});
