import { test, expect } from './helpers/guardedTest.js';
import { loginAs, navigateTo, setupDefaultApiMocks, isApiMatch } from './helpers/mockAuth.js';

// Toàn bộ dữ liệu ở đây là mock (không có Backend thật): kiểm luồng giao diện hủy buổi PT 1:1 theo contract.
const coaches = [
  { id: 6, name: 'HLV Đang Hoạt Động', email: 'active@example.invalid', phone: '0900000001', specialization: 'Quần vợt', specializations: ['Quần vợt'], status: 'active' },
];
const subjects = [
  { id: 2, name: 'Quần vợt (Tennis)', slug: 'tennis', normalPrice: 800000, advancedPrice: 3000000, status: 'active' },
];

const isoDate = (offsetDays) => {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
};

const baseSession = (extra = {}) => ({
  id: 41, status: 'Scheduled', isPrivate: true, bookedMemberId: 101, coachName: 'HLV Đang Hoạt Động',
  sessionDate: isoDate(5), startTime: '15:00:00', endTime: '16:30:00', roomName: 'Phòng PT 1', ...extra,
});

const subscription = (credit) => ({
  subscriptionId: 77, id: 77, memberId: 101, status: 'Active', packageType: 'Advanced',
  subjectId: 2, primaryCoachId: 6, totalCredit: 12, remainingCredit: credit,
});

/**
 * state.session: buổi trả về từ GET /api/sessions; state.credit: credit trả về từ GET subscriptions;
 * state.cancelResponse: { status, json } cho POST cancel-private; state.onCancel(): chạy khi POST thành công.
 */
async function setup(page, state) {
  const counts = { cancelPosts: 0, sessionGets: 0, subscriptionGets: 0 };
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
  await page.route((url) => new URL(url).pathname === '/api/sessions', (r) => {
    if (r.request().method() !== 'GET') return r.fallback();
    counts.sessionGets += 1;
    return r.fulfill({ status: 200, json: [state.session] });
  });
  await page.route((url) => new URL(url).pathname === '/api/members/101/subscriptions', (r) => {
    counts.subscriptionGets += 1;
    return r.fulfill({ status: 200, json: [subscription(state.credit)] });
  });
  await page.route((url) => new URL(url).pathname === '/api/sessions/41/cancel-private', (r) => {
    counts.cancelPosts += 1;
    const response = state.cancelResponse;
    if (response.status < 400) state.onCancel?.();
    return r.fulfill({ status: response.status, json: response.json });
  });

  await loginAs(page, 'member');
  await navigateTo(page, '/member/my-coach');
  await page.getByRole('button', { name: /Lịch 1:1 & đề xuất/ }).first().click();
  return counts;
}

test.describe('Member: hủy buổi PT 1:1 theo hạn của Backend (mock)', () => {
  test('Giữ lịch không gửi yêu cầu; Xác nhận hủy mới gửi, đọc lại credit 11→12 và hiện nhãn đã hoàn', async ({ page }) => {
    const state = {
      session: baseSession({ cancellationAllowed: true, cancellationDeadline: `${isoDate(4)}T15:00:00+07:00` }),
      credit: 11,
      cancelResponse: { status: 200, json: { id: 41, status: 'Cancelled', creditReturned: true } },
      onCancel() {
        state.session = baseSession({ status: 'Cancelled', creditReturned: true, cancellationAllowed: false });
        state.credit = 12;
      },
    };
    const counts = await setup(page, state);

    await page.getByRole('button', { name: 'Hủy buổi tập' }).click();
    const dialog = page.getByRole('dialog', { name: 'Xác nhận hủy buổi tập' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/hoàn 1 credit/)).toBeVisible();
    await expect(dialog.getByText(/Hạn hủy:/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Giữ lịch' }).first()).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Xác nhận hủy' })).toBeVisible();

    // "Giữ lịch": đóng hộp thoại, tuyệt đối không gửi yêu cầu hủy
    await dialog.getByRole('button', { name: 'Giữ lịch' }).last().click();
    await expect(dialog).toBeHidden();
    expect(counts.cancelPosts).toBe(0);

    await page.getByRole('button', { name: 'Hủy buổi tập' }).click();
    await page.getByRole('dialog', { name: 'Xác nhận hủy buổi tập' }).getByRole('button', { name: 'Xác nhận hủy' }).click();

    await expect(page.getByText('Đã hủy buổi. Credit hoàn từ 11→12.')).toBeVisible();
    expect(counts.cancelPosts).toBe(1);
    await expect(page.getByText('Đã hủy · Đã hoàn 1 credit')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hủy buổi tập' })).toHaveCount(0);
  });

  test('cancellationAllowed === false khóa nút, nêu lý do CANCEL_TOO_LATE và hạn hủy', async ({ page }) => {
    const state = {
      session: baseSession({
        cancellationAllowed: false,
        cancellationBlockReason: 'CANCEL_TOO_LATE',
        cancellationDeadline: `${isoDate(4)}T03:00:00+07:00`,
      }),
      credit: 11,
      cancelResponse: { status: 200, json: {} },
    };
    const counts = await setup(page, state);

    const lockedButton = page.getByRole('button', { name: 'Hủy buổi tập' });
    await expect(lockedButton).toBeDisabled();
    await expect(page.getByText(/Đã quá hạn hủy buổi tập này\./)).toBeVisible();
    await expect(page.getByText(/Hạn hủy:/)).toBeVisible();
    expect(counts.cancelPosts).toBe(0);
  });

  test('Thiếu field cancellationAllowed giữ hành vi cũ: nút vẫn mở, Backend từ chối CANCEL_TOO_LATE thì hiện câu từ bảng chung', async ({ page }) => {
    const state = {
      session: baseSession(),
      credit: 11,
      cancelResponse: { status: 409, json: { code: 'CANCEL_TOO_LATE', message: 'CANCEL_TOO_LATE: too late' } },
    };
    const counts = await setup(page, state);

    await expect(page.getByRole('button', { name: 'Hủy buổi tập' })).toBeEnabled();
    await page.getByRole('button', { name: 'Hủy buổi tập' }).click();
    const dialog = page.getByRole('dialog', { name: 'Xác nhận hủy buổi tập' });
    await expect(dialog.getByText(/Nếu còn trong hạn hủy/)).toBeVisible();
    const getsBefore = counts.sessionGets;
    await dialog.getByRole('button', { name: 'Xác nhận hủy' }).click();

    await expect(page.getByText('Đã quá hạn hủy buổi tập này.')).toBeVisible();
    await expect(page.getByText(/Đã hủy buổi\./)).toHaveCount(0);
    expect(counts.cancelPosts).toBe(1);
    await expect.poll(() => counts.sessionGets).toBeGreaterThan(getsBefore);
  });

  test('409 SESSION_ALREADY_ATTENDED: báo từ bảng chung, không báo thành công, tải lại buổi và giữ credit', async ({ page }) => {
    const state = {
      session: baseSession({ cancellationAllowed: true }),
      credit: 11,
      cancelResponse: { status: 409, json: { code: 'SESSION_ALREADY_ATTENDED', message: 'Session already attended' } },
    };
    const counts = await setup(page, state);

    await page.getByRole('button', { name: 'Hủy buổi tập' }).click();
    const getsBefore = counts.sessionGets;
    await page.getByRole('dialog', { name: 'Xác nhận hủy buổi tập' }).getByRole('button', { name: 'Xác nhận hủy' }).click();

    await expect(page.getByText('Buổi tập đã được điểm danh nên không thể hủy.')).toBeVisible();
    await expect(page.getByText(/Credit hoàn từ/)).toHaveCount(0);
    await expect(page.getByText(/Đã hủy buổi\./)).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Xác nhận hủy buổi tập' })).toBeHidden();
    await expect.poll(() => counts.sessionGets).toBeGreaterThan(getsBefore);
    // Số dư credit vẫn là số đã đọc (11), không bị đổi
    await expect(page.getByText('11', { exact: true }).first()).toBeVisible();
  });
});
