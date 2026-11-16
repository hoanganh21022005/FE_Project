import { test, expect } from './helpers/guardedTest.js';
import { loginAs, navigateTo, setupDefaultApiMocks, isApiMatch } from './helpers/mockAuth.js';

const subjects = [
  { id: 2, name: 'Quần vợt (Tennis)', slug: 'tennis', normalPrice: 800000, advancedPrice: 3000000, status: 'active' },
];

const futureDate = (days) => {
  const d = new Date(Date.now() + days * 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
};

const normalClass = {
  id: 51, name: 'Tennis N01', subjectId: 2, subjectName: 'Quần vợt (Tennis)', coachId: 6, coachName: 'HLV Quần vợt',
  classType: 'Normal', status: 'Open', startDate: futureDate(10), endDate: futureDate(80), startTime: '18:00', endTime: '19:30',
  totalSessions: 12, maxCapacity: 10, enrolledCount: 3, tuitionFee: 800000,
};

const sessions = Array.from({ length: 12 }, (_, i) => ({
  id: 500 + i, classId: 51, sessionDate: futureDate(10 + i * 7), startTime: '18:00', endTime: '19:30', status: 'Scheduled',
}));

async function setup(page, { registrations = [] } = {}) {
  await setupDefaultApiMocks(page, ['/api/public/subjects']);
  await page.route((url) => isApiMatch(url, 'subjects'), (r) => r.fulfill({ status: 200, json: subjects }));
  await page.route((url) => isApiMatch(url, 'classes') && new URL(url).pathname === '/api/classes', (r) => r.fulfill({ status: 200, json: [normalClass] }));
  await page.route((url) => new URL(url).pathname === '/api/sessions/catalog/51', (r) => r.fulfill({ status: 200, json: sessions }));
  await page.route((url) => isApiMatch(url, 'members'), (r) => r.fulfill({ status: 200, json: [] }));
  await page.route((url) => new URL(url).pathname === '/api/advanced-registrations', (r) => r.fulfill({ status: 200, json: registrations }));
  await page.route((url) => isApiMatch(url, 'specializations'), (r) => r.fulfill({ status: 200, json: [] }));
  await loginAs(page, 'member');
}

test.describe('Member đăng ký khóa học: thanh toán và nút hủy (L23, L19)', () => {
  test('PAY-01: lớp Normal chỉ có VNPay, không có tùy chọn tiền mặt', async ({ page }) => {
    await setup(page);
    await navigateTo(page, '/member/catalog?tier=normal&sport=tennis');

    await expect(page.getByText('Thanh toán: VNPay (Trực tuyến)')).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel('Phương thức thanh toán lớp học')).toHaveCount(0);
    // Cột "Quy trình đăng ký lớp" không còn mời Member chọn tiền mặt online.
    await expect(page.getByText(/giữ chỗ thanh toán tiền mặt/)).toHaveCount(0);
    await expect(page.getByText(/đến quầy Lễ tân để được đăng ký trực tiếp/)).toBeVisible();

    await page.getByRole('button', { name: /Đăng ký lớp/ }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('VNPay (Trực tuyến)')).toBeVisible();
    await expect(dialog.getByText(/Tiền mặt/)).toHaveCount(0);
  });

  test('PAY-02: gửi đăng ký Normal luôn dùng paymentMethod VNPay', async ({ page }) => {
    await setup(page);
    let body = null;
    await page.route((url) => new URL(url).pathname === '/api/classes/51/enroll', async (route) => {
      body = route.request().postDataJSON();
      return route.fulfill({ status: 400, json: { code: 'NORMAL_CASH_COUNTER_ONLY', message: 'NORMAL_CASH_COUNTER_ONLY' } });
    });
    await navigateTo(page, '/member/catalog?tier=normal&sport=tennis');
    await page.getByRole('button', { name: /Đăng ký lớp/ }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button').last().click();

    await expect.poll(() => body, { timeout: 10000 }).not.toBeNull();
    expect(body.paymentMethod).toBe('VNPay');
    // Lỗi backend được dịch, không in mã tiếng Anh.
    await expect(page.getByText('NORMAL_CASH_COUNTER_ONLY')).toHaveCount(0);
    await expect(page.getByText(/chỉ nhận tiền mặt tại quầy lễ tân/).first()).toBeVisible();
  });

  test('PAY-03: yêu cầu Advanced đang chờ không còn nút "Hủy yêu cầu"', async ({ page }) => {
    await setup(page, {
      registrations: [{ id: 21, memberId: 101, subjectId: 2, subjectName: 'Quần vợt (Tennis)', primaryCoachId: 6, primaryCoachName: 'HLV Quần vợt', status: 'Requested' }],
    });
    let cancelCalls = 0;
    page.on('request', (req) => { if (req.method() === 'DELETE') cancelCalls++; });
    await navigateTo(page, '/member/catalog?tier=advanced&sport=tennis');

    await expect(page.getByText('HLV Quần vợt').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Hủy yêu cầu|Hủy đơn/ })).toHaveCount(0);
    expect(cancelCalls).toBe(0);
  });
});
