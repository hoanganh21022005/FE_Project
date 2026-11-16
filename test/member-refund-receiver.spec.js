import { test, expect } from './helpers/guardedTest.js';
import { loginAs, navigateTo, setupDefaultApiMocks } from './helpers/mockAuth.js';

const ACCOUNT = 'AB12345678';

const makeRefund = (overrides = {}) => ({
  id: 31, invoiceId: 700, classId: 51, memberId: 101, origin: 'CenterCancellation',
  status: 'AwaitingReceiver', amount: 800000, version: 4, receiverId: null,
  bank: null, accountNumber: null, accountName: null, receiverVerified: false,
  dueAt: null, firstDueAt: '2026-11-25T09:00:00', overdue: false, issueNote: null,
  contactPhone: null, attempts: [],
  ...overrides,
});

async function setup(page, { refunds = [makeRefund()], post } = {}) {
  await setupDefaultApiMocks(page, ['/api/classes']);
  await page.route((url) => new URL(url).pathname === '/api/members/101/subscriptions', (r) => r.fulfill({ status: 200, json: [] }));
  const state = { list: 0, posts: [], current: refunds };
  await page.route((url) => new URL(url).pathname === '/api/members/me/invoices', (r) => r.fulfill({ status: 200, json: [] }));
  await page.route((url) => new URL(url).pathname === '/api/payment-resolutions', (r) => r.fulfill({ status: 200, json: [] }));
  await page.route((url) => new URL(url).pathname === '/api/normal-refunds', (r) => {
    state.list += 1;
    return r.fulfill({ status: 200, json: state.current });
  });
  await page.route((url) => new URL(url).pathname === '/api/normal-refunds/31/receiver', async (route) => {
    state.posts.push(route.request().postDataJSON());
    if (post) return post(route, (next) => { state.current = next; });
    state.current = [makeRefund({ status: 'AwaitingApproval', version: 5, bank: 'Example Bank', accountName: 'Nguyen Van A', accountNumber: '****5678' })];
    return route.fulfill({ status: 200, json: state.current[0] });
  });
  await loginAs(page, 'member');
  return state;
}

const panel = (page) => page.getByRole('region', { name: 'Hoàn tiền của tôi' });

async function fillForm(page, { number = ACCOUNT, confirm = number } = {}) {
  await panel(page).getByLabel('Ngân hàng *').fill('Example Bank');
  await panel(page).getByLabel('Tên chủ tài khoản *').fill('Nguyen Van A');
  await panel(page).getByLabel('Số tài khoản *', { exact: true }).fill(number);
  await panel(page).getByLabel('Nhập lại số tài khoản *').fill(confirm);
}

test.describe('Member khai tài khoản nhận hoàn tiền Normal (L16, phía Member)', () => {
  test('REFUND-01: hồ sơ AwaitingReceiver hiện form; gửi đúng body có version; không lưu số tài khoản vào trình duyệt', async ({ page }) => {
    const state = await setup(page);
    await navigateTo(page, '/member/invoices');

    await expect(panel(page)).toBeVisible({ timeout: 15000 });
    await expect(panel(page).getByText('Cần khai tài khoản nhận')).toBeVisible();
    await panel(page).getByRole('button', { name: 'Khai tài khoản nhận hoàn tiền' }).click();
    await fillForm(page);
    await panel(page).getByRole('button', { name: 'Gửi tài khoản nhận' }).click();

    await expect.poll(() => state.posts.length, { timeout: 10000 }).toBe(1);
    expect(state.posts[0]).toEqual({ version: 4, bank: 'Example Bank', accountNumber: ACCOUNT, accountName: 'Nguyen Van A' });
    await expect(panel(page).getByText('Chờ trung tâm duyệt')).toBeVisible({ timeout: 10000 });
    await expect(panel(page).getByText(ACCOUNT)).toHaveCount(0);

    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(stored).not.toContain(ACCOUNT);
  });

  test('REFUND-02: số tài khoản sai định dạng hoặc nhập lại không khớp bị chặn, không gửi request', async ({ page }) => {
    const state = await setup(page);
    await navigateTo(page, '/member/invoices');
    await panel(page).getByRole('button', { name: 'Khai tài khoản nhận hoàn tiền' }).click();

    await fillForm(page, { number: 'AB 12' });
    await panel(page).getByRole('button', { name: 'Gửi tài khoản nhận' }).click();
    await expect(panel(page).getByText(/4 đến 40 chữ cái hoặc chữ số/)).toBeVisible();

    await fillForm(page, { number: ACCOUNT, confirm: 'AB12345679' });
    await panel(page).getByRole('button', { name: 'Gửi tài khoản nhận' }).click();
    await expect(panel(page).getByText('Số tài khoản nhập lại chưa khớp.')).toBeVisible();
    expect(state.posts).toHaveLength(0);
  });

  test('REFUND-03: hồ sơ đã duyệt chỉ xem, không có nút khai tài khoản; số tài khoản hiện dạng che', async ({ page }) => {
    await setup(page, {
      refunds: [makeRefund({ status: 'Approved', receiverId: 9, bank: 'Example Bank', accountName: 'Nguyen Van A', accountNumber: '****5678', receiverVerified: true })],
    });
    await navigateTo(page, '/member/invoices');

    await expect(panel(page).getByText('Đã duyệt, chờ chuyển khoản')).toBeVisible({ timeout: 15000 });
    await expect(panel(page).getByText(/\*\*\*\*5678/)).toBeVisible();
    await expect(panel(page).getByRole('button', { name: /Khai/ })).toHaveCount(0);
  });

  test('REFUND-04: lỗi REFUND_VERSION_STALE hiện tiếng Việt và tải lại hồ sơ', async ({ page }) => {
    const state = await setup(page, {
      post: (route, setCurrent) => {
        setCurrent([makeRefund({ version: 6 })]);
        return route.fulfill({ status: 409, json: { code: 'REFUND_VERSION_STALE', message: 'REFUND_VERSION_STALE: Reload the current case' } });
      },
    });
    await navigateTo(page, '/member/invoices');
    await panel(page).getByRole('button', { name: 'Khai tài khoản nhận hoàn tiền' }).click();
    await fillForm(page);
    await panel(page).getByRole('button', { name: 'Gửi tài khoản nhận' }).click();

    await expect(panel(page).getByText(/Hồ sơ vừa được cập nhật/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('REFUND_VERSION_STALE')).toHaveCount(0);
    await expect.poll(() => state.list).toBeGreaterThanOrEqual(2);
  });

  test('REFUND-05: không có khoản hoàn tiền thì không hiện khung', async ({ page }) => {
    await setup(page, { refunds: [] });
    await navigateTo(page, '/member/invoices');
    await expect(page.getByRole('heading', { name: 'Hóa đơn & thanh toán' })).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(600);
    await expect(panel(page)).toHaveCount(0);
  });

  test('REFUND-06: ở 375x667 không tràn ngang và các ô, nút cao tối thiểu 44px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await setup(page);
    await navigateTo(page, '/member/invoices');
    await panel(page).getByRole('button', { name: 'Khai tài khoản nhận hoàn tiền' }).click();

    for (const locator of [
      panel(page).getByLabel('Ngân hàng *'),
      panel(page).getByLabel('Tên chủ tài khoản *'),
      panel(page).getByLabel('Số tài khoản *', { exact: true }),
      panel(page).getByLabel('Nhập lại số tài khoản *'),
      panel(page).getByRole('button', { name: 'Gửi tài khoản nhận' }),
      panel(page).getByRole('button', { name: 'Hủy' }),
    ]) {
      expect((await locator.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
