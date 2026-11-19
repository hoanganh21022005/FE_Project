import { test, expect } from './helpers/guardedTest.js';
import { loginAs, navigateTo, setupDefaultApiMocks, isApiMatch } from './helpers/mockAuth.js';
import { mockClasses, mockMembers } from './helpers/mockData.js';

test.describe('L25: Lễ tân đăng ký thay bằng tiền mặt & giữ nguyên luồng Manager/Member', () => {
  test('AC1: Lễ tân đăng ký thay gửi paymentMethod = "Cash" và hiển thị kết quả từ BE', async ({ page }) => {
    await setupDefaultApiMocks(page, ['/api/members/101/enrollments']);

    await page.route((url) => isApiMatch(url, 'members'), async (route) => {
      const req = route.request();
      const pathname = new URL(req.url()).pathname;
      if (pathname === '/api/members' && req.method() === 'GET') {
        return route.fulfill({ status: 200, json: mockMembers });
      }
      if (pathname === '/api/members/101/enrollments' && req.method() === 'GET') {
        return route.fulfill({ status: 200, json: [] });
      }
      return route.fallback();
    });

    let capturedEnrollBody = null;
    await page.route((url) => isApiMatch(url, 'classes'), async (route) => {
      const req = route.request();
      const pathname = new URL(req.url()).pathname;
      if (pathname === '/api/classes' && req.method() === 'GET') {
        return route.fulfill({ status: 200, json: mockClasses });
      }
      if (/^\/api\/classes\/\d+$/.test(pathname) && req.method() === 'GET') {
        const id = Number(pathname.split('/').pop());
        return route.fulfill({ status: 200, json: mockClasses.find((c) => c.id === id) || mockClasses[0] });
      }
      if (pathname === '/api/classes/101/enroll' && req.method() === 'POST') {
        capturedEnrollBody = req.postDataJSON();
        return route.fulfill({
          status: 200,
          json: {
            success: true,
            enrollmentId: 901,
            classId: 101,
            memberId: 101,
            className: 'Lớp Cầu Lông Cơ Bản K01',
            status: 'Registered',
            paymentStatus: 'Paid',
            invoiceId: 501,
            invoiceCode: 'INV-2026-0501',
            amount: 1500000,
          },
        });
      }
      return route.fallback();
    });

    await loginAs(page, 'receptionist');
    await navigateTo(page, '/receptionist/booking');

    const enrollBtn = page.getByRole('button', { name: /Đăng Ký Thay Học Viên|Enroll For Member/i }).first();
    await expect(enrollBtn).toBeVisible({ timeout: 10000 });
    await expect(enrollBtn).toBeEnabled({ timeout: 10000 });

    await expect.poll(async () => (await enrollBtn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

    await enrollBtn.click();

    await expect.poll(() => capturedEnrollBody).not.toBeNull();
    expect(capturedEnrollBody).toMatchObject({
      classId: 101,
      memberId: 101,
      paymentMethod: 'Cash',
    });

    await expect(page.getByText(/Ghi danh lớp học thành công|Enrolled in class successfully/i)).toBeVisible({ timeout: 5000 });
  });

  test('AC2: Manager đăng ký từ ClassDetailDrawer không gửi paymentMethod', async ({ page }) => {
    await setupDefaultApiMocks(page, ['/api/sessions']);

    await page.route((url) => isApiMatch(url, 'members'), async (route) => {
      const req = route.request();
      const pathname = new URL(req.url()).pathname;
      if (pathname === '/api/members' && req.method() === 'GET') {
        return route.fulfill({ status: 200, json: mockMembers });
      }
      return route.fallback();
    });

    let capturedManagerBody = null;
    await page.route((url) => isApiMatch(url, 'classes'), async (route) => {
      const req = route.request();
      const pathname = new URL(req.url()).pathname;
      if (pathname === '/api/classes' && req.method() === 'GET') {
        return route.fulfill({ status: 200, json: mockClasses });
      }
      if (/^\/api\/classes\/\d+$/.test(pathname) && req.method() === 'GET') {
        const id = Number(pathname.split('/').pop());
        return route.fulfill({ status: 200, json: mockClasses.find((c) => c.id === id) || mockClasses[0] });
      }
      if (/^\/api\/classes\/\d+\/enrollments$/.test(pathname) && req.method() === 'GET') {
        return route.fulfill({ status: 200, json: [] });
      }
      const enrollMatch = pathname.match(/^\/api\/classes\/(\d+)\/enroll$/);
      if (enrollMatch && req.method() === 'POST') {
        capturedManagerBody = req.postDataJSON();
        return route.fulfill({
          status: 200,
          json: {
            enrollmentId: 902,
            classId: Number(enrollMatch[1]),
            memberId: Number(capturedManagerBody?.memberId || 101),
            status: 'Registered',
          },
        });
      }
      return route.fallback();
    });

    await loginAs(page, 'manager');
    await navigateTo(page, '/manager/classes');

    const firstRowActionBtn = page.locator('tbody tr').first().locator('td').last().locator('button').first();
    await expect(firstRowActionBtn).toBeVisible({ timeout: 10000 });
    await firstRowActionBtn.click();

    const quickViewBtn = page.getByRole('button', { name: /Xem chi tiết nhanh/i }).first();
    await expect(quickViewBtn).toBeVisible({ timeout: 5000 });
    const enrollmentsResponsePromise = page.waitForResponse(
      (res) => /\/api\/classes\/\d+\/enrollments$/.test(new URL(res.url()).pathname) && res.request().method() === 'GET'
    );
    await quickViewBtn.click();
    await enrollmentsResponsePromise;

    const addMemberBtn = page.getByRole('button', { name: /Thêm học viên/i }).first();
    await expect(addMemberBtn).toBeVisible({ timeout: 5000 });
    await addMemberBtn.click();

    const enrollForm = page.locator('form', { hasText: 'Ghi danh học viên mới vào lớp:' });
    const drawerSelect = enrollForm.locator('select');
    await expect(drawerSelect).toBeVisible({ timeout: 5000 });
    await drawerSelect.selectOption({ index: 1 });

    const submitBtn = enrollForm.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    await expect.poll(() => capturedManagerBody).not.toBeNull();
    expect(Number(capturedManagerBody.memberId)).toBeGreaterThan(0);
    expect(typeof capturedManagerBody.classId).toBe('number');
    expect('paymentMethod' in capturedManagerBody).toBe(false);
  });

  test('AC3: Gọi enrollMemberInClass hai tham số (đường Member bookClass 2 tham số) không gửi paymentMethod', async ({ page }) => {
    await setupDefaultApiMocks(page, ['/api/classes']);

    let capturedBody = null;
    await page.route((url) => isApiMatch(url, 'classes'), async (route) => {
      const req = route.request();
      const pathname = new URL(req.url()).pathname;
      if (pathname === '/api/classes/101/enroll' && req.method() === 'POST') {
        capturedBody = req.postDataJSON();
        return route.fulfill({
          status: 200,
          json: {
            enrollmentId: 903,
            classId: 101,
            memberId: 101,
            status: 'Pending',
          },
        });
      }
      return route.fallback();
    });

    await loginAs(page, 'member');

    const result = await page.evaluate(async () => {
      const mod = await import('/src/api/classEnrollmentApi.js');
      return await mod.enrollMemberInClass(101, 101);
    });

    expect(result?.enrollmentId).toBe(903);
    expect(capturedBody).toEqual({
      classId: 101,
      memberId: 101,
    });
    expect('paymentMethod' in capturedBody).toBe(false);
  });
});
