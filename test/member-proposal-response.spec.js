import { test, expect } from './helpers/guardedTest.js';
import { loginAs, navigateTo, setupDefaultApiMocks, isApiMatch } from './helpers/mockAuth.js';

const enrollment = {
  enrollmentId: 301, id: 301, classId: 51, className: 'Tennis N01', memberId: 101,
  status: 'Registered', paymentStatus: 'Paid', subjectName: 'Quần vợt',
};

const makeProposal = (overrides = {}) => ({
  id: 25, classId: 51, targetClassId: 52, kind: 'Transfer', status: 'Pending', shiftDays: null,
  version: 7, fingerprint: 'be-fingerprint-25', reason: 'Bảo trì phòng tập',
  schedule: [
    { sessionId: 601, date: '2026-12-01', start: '18:00:00', end: '19:30:00', coachId: 6, roomId: 4 },
    { sessionId: 602, date: '2027-02-16', start: '18:00:00', end: '19:30:00', coachId: 6, roomId: 4 },
  ],
  choices: [{ memberId: 101, choice: 'Waiting', respondedAt: null }],
  ...overrides,
});

async function setup(page, { proposals, listStatus = 200, respond } = {}) {
  await setupDefaultApiMocks(page, ['/api/classes', '/api/sessions', '/api/holidays/active']);
  const calls = { list: 0, respond: [] };
  let current = proposals ?? [makeProposal()];
  await page.route((url) => new URL(url).pathname === '/api/members/101/enrollments', (r) => r.fulfill({ status: 200, json: [enrollment] }));
  await page.route((url) => new URL(url).pathname === '/api/members/101/subscriptions', (r) => r.fulfill({ status: 200, json: [] }));
  await page.route((url) => new URL(url).pathname === '/api/sessions/catalog/51', (r) => r.fulfill({ status: 200, json: [] }));
  await page.route((url) => isApiMatch(url, 'classes') && new URL(url).pathname === '/api/classes', (r) => r.fulfill({
    status: 200, json: [{ id: 52, name: 'Tennis N02', subjectId: 2, classType: 'Normal', status: 'Open', totalSessions: 12 }],
  }));
  await page.route((url) => new URL(url).pathname === '/api/classes/51/normal-proposals', (r) => {
    calls.list += 1;
    return r.fulfill({ status: listStatus, json: listStatus >= 400 ? { message: `HTTP ${listStatus}` } : current });
  });
  await page.route((url) => new URL(url).pathname === '/api/normal-proposals/25/respond', async (route) => {
    calls.respond.push(route.request().postDataJSON());
    if (respond) return respond(route, (next) => { current = next; });
    current = [makeProposal({ choices: [{ memberId: 101, choice: calls.respond.at(-1).choice, respondedAt: '2026-11-16T10:00:00' }] })];
    return route.fulfill({ status: 200, json: current[0] });
  });
  await loginAs(page, 'member');
  return calls;
}

const panel = (page) => page.getByRole('region', { name: /Đề xuất thay đổi lớp cần bạn phản hồi/ });

test.describe('Member phản hồi đề xuất dời khai giảng/chuyển lớp (L17)', () => {
  test('PROP-01: hiện đề xuất với lịch cụ thể, lớp đích, lý do; nút đạt 44px; không tải lặp', async ({ page }) => {
    const calls = await setup(page);
    await navigateTo(page, '/member/enrollments');

    await expect(panel(page)).toBeVisible({ timeout: 15000 });
    await expect(panel(page).getByText('Tennis N01')).toBeVisible();
    await expect(panel(page).getByText('Tennis N02')).toBeVisible();
    await expect(panel(page).getByText('Bảo trì phòng tập')).toBeVisible();
    await expect(panel(page).getByText('01/12/2026', { exact: true })).toBeVisible();
    const accept = panel(page).getByRole('button', { name: 'Đồng ý với đề xuất' });
    const refund = panel(page).getByRole('button', { name: 'Từ chối và yêu cầu hoàn tiền' });
    expect((await accept.boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect((await refund.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await page.waitForTimeout(1500);
    expect(calls.list).toBeLessThanOrEqual(2);
    expect(calls.respond).toHaveLength(0);
  });

  test('PROP-02: bấm Đồng ý gửi đúng version, fingerprint, choice Accept rồi ẩn đề xuất', async ({ page }) => {
    const calls = await setup(page);
    await navigateTo(page, '/member/enrollments');
    await panel(page).getByRole('button', { name: 'Đồng ý với đề xuất' }).click();

    await expect.poll(() => calls.respond.length, { timeout: 10000 }).toBe(1);
    expect(calls.respond[0]).toEqual({ version: 7, fingerprint: 'be-fingerprint-25', choice: 'Accept' });
    await expect(panel(page)).toHaveCount(0, { timeout: 10000 });
  });

  test('PROP-03: từ chối và hoàn tiền phải qua bước xác nhận mới gửi Refund', async ({ page }) => {
    const calls = await setup(page);
    await navigateTo(page, '/member/enrollments');
    await panel(page).getByRole('button', { name: 'Từ chối và yêu cầu hoàn tiền' }).click();

    expect(calls.respond).toHaveLength(0);
    await expect(panel(page).getByText(/không thể đổi lại/)).toBeVisible();
    await panel(page).getByRole('button', { name: 'Quay lại' }).click();
    expect(calls.respond).toHaveLength(0);

    await panel(page).getByRole('button', { name: 'Từ chối và yêu cầu hoàn tiền' }).click();
    await panel(page).getByRole('button', { name: 'Xác nhận hoàn tiền' }).click();
    await expect.poll(() => calls.respond.length, { timeout: 10000 }).toBe(1);
    expect(calls.respond[0].choice).toBe('Refund');
  });

  test('PROP-04: đề xuất đã đổi (409 NORMAL_PROPOSAL_STALE) hiện thông báo tiếng Việt và tải lại bản mới', async ({ page }) => {
    const calls = await setup(page, {
      respond: (route, setCurrent) => {
        setCurrent([makeProposal({ version: 8, fingerprint: 'be-fingerprint-new' })]);
        return route.fulfill({ status: 409, json: { code: 'NORMAL_PROPOSAL_STALE', message: 'NORMAL_PROPOSAL_STALE: Reload the current proposal' } });
      },
    });
    await navigateTo(page, '/member/enrollments');
    const listBefore = () => calls.list;
    await panel(page).getByRole('button', { name: 'Đồng ý với đề xuất' }).click();

    await expect(panel(page).getByText(/Đề xuất đã thay đổi/)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('NORMAL_PROPOSAL_STALE')).toHaveCount(0);
    await expect.poll(listBefore).toBeGreaterThanOrEqual(2);
    // Lần chọn sau dùng version và fingerprint mới.
    await panel(page).getByRole('button', { name: 'Đồng ý với đề xuất' }).click();
    await expect.poll(() => calls.respond.length, { timeout: 10000 }).toBe(2);
    expect(calls.respond[1]).toEqual({ version: 8, fingerprint: 'be-fingerprint-new', choice: 'Accept' });
  });

  test('PROP-05: không có đề xuất nào đang chờ thì không hiện khung', async ({ page }) => {
    await setup(page, { proposals: [makeProposal({ choices: [{ memberId: 101, choice: 'Accept', respondedAt: '2026-11-16T09:00:00' }] })] });
    await navigateTo(page, '/member/enrollments');
    await expect(page.getByRole('heading', { name: /Khóa học đã đăng ký|đã đăng ký/i }).first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(800);
    await expect(panel(page)).toHaveCount(0);
  });

  for (const status of [403, 404]) {
    test(`PROP-06-${status}: lỗi ${status} khi tải đề xuất được báo, không bị hiểu nhầm là không có đề xuất`, async ({ page }) => {
      await setup(page, { listStatus: status });
      await navigateTo(page, '/member/enrollments');
      await expect(page.getByRole('alert')).toBeVisible({ timeout: 15000 });
    });
  }
});
