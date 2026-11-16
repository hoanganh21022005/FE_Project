import { test, expect } from './helpers/guardedTest.js';
import { loginAs, navigateTo, setupDefaultApiMocks, isApiMatch } from './helpers/mockAuth.js';
import { mockMembers } from './helpers/mockData.js';

test.describe('L05 & L04: Lễ tân quét QR bắt buộc chọn buổi & ẩn check-in thủ công', () => {
  test('AC6: Trang Check-in ẩn tab thủ công, giữ tab QR và Lịch sử, không gọi API check-in/check-out thủ công', async ({ page }) => {
    await setupDefaultApiMocks(page, ['/api/classes']);

    const manualRequests = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/attendances/check-in') || url.includes('/api/attendances/check-out')) {
        manualRequests.push(url);
      }
    });

    await page.route((url) => isApiMatch(url, 'members'), async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, json: mockMembers });
      }
      return route.fallback();
    });

    await page.route((url) => isApiMatch(url, 'attendances'), async (route) => {
      const req = route.request();
      const pathname = new URL(req.url()).pathname;
      if (pathname === '/api/attendances' && req.method() === 'GET') {
        return route.fulfill({ status: 200, json: [] });
      }
      return route.fallback();
    });

    await loginAs(page, 'receptionist');
    await navigateTo(page, '/receptionist/checkin');

    const qrTab = page.getByRole('button', { name: 'Quét mã QR', exact: true });
    const historyTab = page.getByRole('button', { name: /Lịch Sử Điểm Danh/i });
    const manualTab = page.getByRole('button', { name: /Check-in \/ Check-out Thủ Công/i });

    await expect(qrTab).toBeVisible({ timeout: 10000 });
    await expect(historyTab).toBeVisible();
    await expect(manualTab).toHaveCount(0);
    await expect(page.getByText(/Manual Check-in\/Out/i)).toHaveCount(0);

    const qrBox = await qrTab.boundingBox();
    const historyBox = await historyTab.boundingBox();
    expect(qrBox?.height).toBeGreaterThanOrEqual(44);
    expect(historyBox?.height).toBeGreaterThanOrEqual(44);

    expect(manualRequests).toEqual([]);
  });

  test('AC4: Quét QR thiếu buổi không gọi API và báo lỗi tiếng Việt; có buổi gửi kèm sessionId', async ({ page }) => {
    await setupDefaultApiMocks(page, ['/api/classes']);

    await page.route((url) => isApiMatch(url, 'members'), async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, json: mockMembers });
      }
      return route.fallback();
    });

    const scanPayloads = [];
    await page.route((url) => isApiMatch(url, 'attendances'), async (route) => {
      const req = route.request();
      const pathname = new URL(req.url()).pathname;
      if (pathname === '/api/attendances' && req.method() === 'GET') {
        return route.fulfill({ status: 200, json: [] });
      }
      if ((pathname === '/api/attendances/qr-checkin' || pathname === '/api/attendances/scan') && req.method() === 'POST') {
        scanPayloads.push(req.postDataJSON());
        return route.fulfill({
          status: 200,
          json: { success: true, attendanceId: 701 },
        });
      }
      return route.fallback();
    });

    await loginAs(page, 'receptionist');
    await navigateTo(page, '/receptionist/checkin');

    const memberSelect = page.locator('form select').first();
    await expect(memberSelect).toBeVisible({ timeout: 10000 });
    await memberSelect.selectOption('101');

    const codeInput = page.getByPlaceholder(/SCMS-CHK/i);
    await codeInput.fill('SCMS:101:12345:sig');

    const submitBtn = page.getByRole('button', { name: /Xác Nhận Quét Mã QR Check-in/i });
    const submitBox = await submitBtn.boundingBox();
    expect(submitBox?.height).toBeGreaterThanOrEqual(44);

    // Submit khi chưa có mã buổi học
    await submitBtn.click();
    await expect(page.locator('#reception-scan-session-error')).toContainText(/Vui lòng nhập mã buổi học hợp lệ/i);
    expect(scanPayloads).toEqual([]);

    // Nhập mã buổi học hợp lệ và submit
    const sessionInput = page.locator('#reception-scan-session-id');
    await sessionInput.fill('12');
    await submitBtn.click();

    await expect.poll(() => scanPayloads.length).toBe(1);
    expect(scanPayloads[0]).toMatchObject({
      code: 'SCMS:101:12345:sig',
      memberId: 101,
      sessionId: 12,
    });
  });

  test('AC5: Backend trả 400 SESSION_REQUIRED hiển thị thông báo tiếng Việt', async ({ page }) => {
    await setupDefaultApiMocks(page, ['/api/classes']);

    await page.route((url) => isApiMatch(url, 'members'), async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, json: mockMembers });
      }
      return route.fallback();
    });

    await page.route((url) => isApiMatch(url, 'attendances'), async (route) => {
      const req = route.request();
      const pathname = new URL(req.url()).pathname;
      if (pathname === '/api/attendances' && req.method() === 'GET') {
        return route.fulfill({ status: 200, json: [] });
      }
      if (pathname === '/api/attendances/qr-checkin' && req.method() === 'POST') {
        return route.fulfill({
          status: 400,
          json: {
            code: 'SESSION_REQUIRED',
            message: 'SESSION_REQUIRED',
          },
        });
      }
      return route.fallback();
    });

    await loginAs(page, 'receptionist');
    await navigateTo(page, '/receptionist/checkin');

    await page.locator('form select').first().selectOption('101');
    await page.getByPlaceholder(/SCMS-CHK/i).fill('SCMS:101:12345:sig');
    await page.locator('#reception-scan-session-id').fill('12');
    await page.getByRole('button', { name: /Xác Nhận Quét Mã QR Check-in/i }).click();

    await expect(page.locator('#reception-scan-session-error')).toContainText(/Thiếu mã buổi học/i, { timeout: 5000 });
  });

  test('W-A2b AC1: Vùng bấm các ô nhập và nút ở tab QR >= 44px ở 1280x720 và 375x667', async ({ page }) => {
    await setupDefaultApiMocks(page, ['/api/classes']);

    await page.route((url) => isApiMatch(url, 'members'), async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, json: mockMembers });
      }
      return route.fallback();
    });

    await page.route((url) => isApiMatch(url, 'attendances'), async (route) => {
      const req = route.request();
      const pathname = new URL(req.url()).pathname;
      if (pathname === '/api/attendances' && req.method() === 'GET') {
        return route.fulfill({ status: 200, json: [] });
      }
      return route.fallback();
    });

    await loginAs(page, 'receptionist');
    await navigateTo(page, '/receptionist/checkin');

    const memberSelect = page.locator('form select').first();
    const codeInput = page.getByPlaceholder(/SCMS-CHK/i);
    const sessionInput = page.locator('#reception-scan-session-id');
    const submitBtn = page.getByRole('button', { name: /Xác Nhận Quét Mã QR Check-in/i });

    for (const vp of [
      { width: 1280, height: 720 },
      { width: 375, height: 667 },
    ]) {
      await page.setViewportSize(vp);
      await expect(memberSelect).toBeVisible({ timeout: 10000 });
      expect((await memberSelect.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      expect((await codeInput.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      expect((await sessionInput.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      expect((await submitBtn.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    }
  });
});
