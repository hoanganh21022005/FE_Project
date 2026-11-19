import { test, expect } from './helpers/guardedTest.js';
import { loginAs, navigateTo, setupDefaultApiMocks, isApiMatch } from './helpers/mockAuth.js';

// Toàn bộ dữ liệu ở đây là mock (không có Backend thật): kiểm giao diện xác nhận mua gói Advanced theo contract.
const subjects = [
  { id: 2, name: 'Quần vợt (Tennis)', slug: 'tennis', normalPrice: 800000, advancedPrice: 3000000, status: 'active' },
];

const iso = (offsetHours) => {
  const d = new Date(Date.now() + offsetHours * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  // Giờ Việt Nam kèm offset +07:00
  const vn = new Date(d.getTime() + 7 * 3600 * 1000);
  return `${vn.getUTCFullYear()}-${p(vn.getUTCMonth() + 1)}-${p(vn.getUTCDate())}T${p(vn.getUTCHours())}:${p(vn.getUTCMinutes())}:${p(vn.getUTCSeconds())}+07:00`;
};

const registration = (extra = {}) => ({
  id: 31, memberId: 101, subjectId: 2, subjectName: 'Quần vợt (Tennis)', primaryCoachId: 6, primaryCoachName: 'HLV Quần vợt',
  status: 'Accepted', acceptedAt: iso(-1), confirmationDeadline: iso(23), ...extra,
});

async function setup(page, { registrations, invoice = null, subscriptions = [] }) {
  const counts = { orderPosts: 0, invoiceGets: 0, invoiceCreates: 0 };
  await setupDefaultApiMocks(page, ['/api/public/subjects']);
  await page.route((url) => isApiMatch(url, 'subjects'), (r) => r.fulfill({ status: 200, json: subjects }));
  await page.route((url) => isApiMatch(url, 'classes') && new URL(url).pathname === '/api/classes', (r) => r.fulfill({ status: 200, json: [] }));
  await page.route((url) => isApiMatch(url, 'members'), (r) => r.fulfill({ status: 200, json: [] }));
  await page.route((url) => new URL(url).pathname === '/api/members/101/subscriptions', (r) => r.fulfill({ status: 200, json: subscriptions }));
  await page.route((url) => new URL(url).pathname === '/api/advanced-registrations', (r) => r.fulfill({ status: 200, json: registrations }));
  await page.route((url) => isApiMatch(url, 'specializations'), (r) => r.fulfill({ status: 200, json: [] }));
  await page.route((url) => /^\/api\/advanced-registrations\/\d+\/order$/.test(new URL(url).pathname), (r) => {
    counts.orderPosts += 1;
    return r.fulfill({ status: 409, json: { code: 'REGISTRATION_CONFIRMATION_EXPIRED', message: 'REGISTRATION_CONFIRMATION_EXPIRED: expired' } });
  });
  await page.route((url) => new URL(url).pathname === '/api/invoices', (r) => { counts.invoiceCreates += 1; return r.fulfill({ status: 500, json: {} }); });
  await page.route((url) => /^\/api\/members\/me\/invoices\/\d+$/.test(new URL(url).pathname), (r) => {
    counts.invoiceGets += 1;
    return r.fulfill({ status: 200, json: invoice });
  });
  await page.route((url) => new URL(url).pathname === '/api/members/me/invoices', (r) => r.fulfill({ status: 200, json: [] }));
  await loginAs(page, 'member');
  await navigateTo(page, '/member/catalog?tier=advanced&sport=tennis');
  return counts;
}

test.describe('Member: xác nhận mua gói Advanced theo purchaseConfirmationAllowed (mock)', () => {
  test('purchaseConfirmationAllowed === false khóa nút, nêu lý do REGISTRATION_CONFIRMATION_EXPIRED dù hạn xác nhận (theo máy) còn', async ({ page }) => {
    const counts = await setup(page, {
      registrations: [registration({ purchaseConfirmationAllowed: false, purchaseConfirmationBlockReason: 'REGISTRATION_CONFIRMATION_EXPIRED', serverTime: iso(0) })],
    });
    await expect(page.getByText('HLV Quần vợt').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Đã hết hạn xác nhận mua gói của yêu cầu này.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Xác nhận và thanh toán/ })).toBeDisabled();
    expect(counts.orderPosts).toBe(0);
  });

  test('purchaseConfirmationAllowed === true mở nút dù hạn confirmationDeadline trông đã qua', async ({ page }) => {
    await setup(page, {
      registrations: [registration({ confirmationDeadline: iso(-2), purchaseConfirmationAllowed: true, serverTime: iso(0) })],
    });
    await expect(page.getByRole('button', { name: /Xác nhận và thanh toán/ })).toBeEnabled({ timeout: 15000 });
  });

  test('Thiếu field: giữ hành vi cũ, hạn còn thì mở nút, bấm mà Backend từ chối hết hạn thì khóa và báo từ bảng chung', async ({ page }) => {
    const counts = await setup(page, { registrations: [registration()] });
    const button = page.getByRole('button', { name: /Xác nhận và thanh toán/ });
    await expect(button).toBeEnabled({ timeout: 15000 });
    await button.click();
    await expect.poll(() => counts.orderPosts).toBe(1);
    await expect(page.getByText(/Đã hết thời hạn xác nhận mua gói/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Xác nhận và thanh toán/ })).toBeDisabled();
  });

  test('Thiếu field và hạn xác nhận đã qua: khóa như cũ', async ({ page }) => {
    await setup(page, { registrations: [registration({ confirmationDeadline: iso(-2) })] });
    await expect(page.getByText(/Đã hết thời hạn xác nhận mua gói/).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Xác nhận và thanh toán/ })).toBeDisabled();
  });

  test('Đã có invoiceId: đọc đúng hóa đơn đó qua GET /api/members/me/invoices/{id}, không tạo hóa đơn hay đơn mới', async ({ page }) => {
    const counts = await setup(page, {
      registrations: [registration({
        status: 'Invoiced', invoiceId: 55, invoiceCode: 'INV-55', invoiceStatus: 'Pending', amount: 3000000,
        invoiceExpiresAt: iso(1), purchaseConfirmationAllowed: false, purchaseConfirmationBlockReason: 'REGISTRATION_CONFIRMATION_EXPIRED',
      })],
      invoice: { id: 55, invoiceCode: 'INV-55', paymentStatus: 'Pending', paymentMethod: 'VNPay', amount: 3000000, expiresAt: iso(1), serverTime: iso(0) },
    });
    await expect.poll(() => counts.invoiceGets).toBeGreaterThan(0);
    await expect(page.getByText('INV-55').first()).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: /Mở hóa đơn đang chờ thanh toán/ }).click();
    await expect(page.getByText(/Hạn thanh toán/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Xác nhận và thanh toán/ })).toHaveCount(0);
    expect(counts.orderPosts).toBe(0);
    expect(counts.invoiceCreates).toBe(0);
  });

  test('Quyền Active: hiện credit còn lại và hạn dùng; Requested chưa có nút mua', async ({ page }) => {
    await setup(page, {
      registrations: [
        registration({ id: 32, status: 'Active', subscriptionId: 77 }),
        registration({ id: 33, subjectId: 2, primaryCoachId: 9, primaryCoachName: 'HLV Khác', status: 'Requested', confirmationDeadline: null }),
      ],
      subscriptions: [{ subscriptionId: 77, id: 77, memberId: 101, status: 'Active', packageType: 'Advanced', subjectId: 2, primaryCoachId: 6, remainingCredit: 11, endDate: '2027-01-20' }],
    });
    await expect(page.getByText(/Credit còn lại:/).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('11', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Xác nhận và thanh toán/ })).toHaveCount(0);
  });
});
