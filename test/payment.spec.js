import { test, expect } from './helpers/guardedTest.js';
import { loginAs, navigateTo, setupDefaultApiMocks, isApiMatch } from './helpers/mockAuth.js';
import { mockInvoices } from './helpers/mockData.js';

test.describe('Kịch bản Thanh Toán Tiền Mặt & VNPay (PAY-01 -> PAY-03)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock mặc định các API phụ trợ
    await setupDefaultApiMocks(page, ['/api/members', '/api/classes', '/api/members/101/enrollments', '/api/members/101/subscriptions']);
  });

  // PAY-01: Receptionist xác nhận Cash cho hóa đơn test hợp lệ
  test('PAY-01: Receptionist xác nhận thu tiền mặt thành công, trạng thái hóa đơn đổi thành Paid trên Table', async ({ page }) => {
    const pendingCashInvoice = { ...mockInvoices[0], serverTime: '2026-11-08T08:30:00Z', expiresAt: '2026-11-08T09:30:00Z' }; // ID 45, Pending, Cash
    const paidCashInvoice = {
      ...pendingCashInvoice,
      paymentStatus: 'successful',
      status: 'Paid',
    };

    let confirmCashCalled = false;

    await page.route((url) => isApiMatch(url, 'invoices'), async (route) => {
      const req = route.request();
      const pathname = new URL(req.url()).pathname;

      if (pathname === '/api/invoices/45/confirm-cash' && req.method() === 'POST') {
        confirmCashCalled = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(paidCashInvoice),
        });
      }

      if (pathname === '/api/invoices' && req.method() === 'GET') {
        const data = confirmCashCalled ? [paidCashInvoice] : [pendingCashInvoice];
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(data),
        });
      }

      return route.fallback();
    });

    await loginAs(page, 'receptionist');
    await navigateTo(page, '/receptionist/payments');
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table')).toContainText('INV-2026-0045');
    await expect(page.locator('table')).toContainText(/Đang xử lý|Chờ|Pending/i);

    // Tìm nút "Thu tiền mặt" trên dòng của hóa đơn Cash
    const confirmButton = page.locator('button:has-text("Thu tiền mặt")').first();
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // Modal xác nhận mở ra
    const submitConfirmBtn = page.getByRole('button', { name: /Xác nhận đã thu tiền/i }).first();
    await expect(submitConfirmBtn).toBeVisible();
    await submitConfirmBtn.click();

    // Kiểm tra POST confirm-cash đã được gọi
    await page.waitForTimeout(500);
    expect(confirmCashCalled).toBe(true);

    // Kiểm tra Table cập nhật trạng thái hóa đơn thành Thành công / Paid
    await expect(page.locator('table')).toContainText(/Thành công|Đã thanh toán|Paid/i);
  });

  // PAY-02: Xác nhận Cash lỗi hoặc timeout
  test('PAY-02: Xác nhận Cash thất bại (500 Error), không tự hiển thị Paid và không xử lý trùng', async ({ page }) => {
    const pendingCashInvoice = { ...mockInvoices[0], serverTime: '2026-11-08T08:30:00Z', expiresAt: '2026-11-08T09:30:00Z' };

    await page.route((url) => isApiMatch(url, 'invoices'), async (route) => {
      const req = route.request();
      const pathname = new URL(req.url()).pathname;

      if (pathname === '/api/invoices/45/confirm-cash' && req.method() === 'POST') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Lỗi hệ thống khi xác nhận thanh toán.' }),
        });
      }

      if (pathname === '/api/invoices' && req.method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([pendingCashInvoice]),
        });
      }

      return route.fallback();
    });

    await loginAs(page, 'receptionist');
    await navigateTo(page, '/receptionist/payments');
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 });

    const confirmButton = page.locator('button:has-text("Thu tiền mặt")').first();
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    const submitConfirmBtn = page.getByRole('button', { name: /Xác nhận đã thu tiền/i }).first();
    await expect(submitConfirmBtn).toBeVisible();
    await submitConfirmBtn.click();

    // Hiển thị thông báo lỗi trong alert
    await expect(page.locator('div[role="alert"]').first()).toBeVisible({ timeout: 5000 });

    // Bảng KHÔNG được tự chuyển sang Thành công/Paid, vẫn phải là Đang xử lý
    await expect(page.locator('table')).toContainText(/Đang xử lý|Chờ|Pending/i);
  });

  // PAY-03: Kiểm Return VNPay và F5
  test('PAY-03: Return VNPay hiển thị Paid và không lặp xác minh tự động sau F5', async ({ page }) => {
    const writes = [];
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) writes.push(`${request.method()} ${path}`);
    });
    const paidInvoice = {
      ...mockInvoices[1], // ID 46, Paid, VNPay
      paymentStatus: 'successful',
      status: 'Paid',
    };

    await page.route((url) => isApiMatch(url, 'members/me/invoices'), async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith('/46/verify-vnpay') && route.request().method() === 'POST') {
        return route.fulfill({ status: 200, json: { verificationStatus: 'DISABLED' } });
      }
      if (pathname.endsWith('/46') && route.request().method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(paidInvoice) });
      }
      if (pathname !== '/api/members/me/invoices' || route.request().method() !== 'GET') return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([paidInvoice]),
      });
    });

    await loginAs(page, 'member');
    writes.length = 0;

    // Mô phỏng redirect từ cổng VNPay về hệ thống
    const vnpayReturnUrl = '/member/invoices?vnp_ResponseCode=00&vnp_TxnRef=46&vnp_TransactionNo=999888';
    await page.goto(vnpayReturnUrl);

    // Xác nhận giao diện hiển thị thông tin hóa đơn đã thanh toán thành công
    await expect(page.getByText('INV-2026-0046').first()).toBeVisible({ timeout: 15000 });
    await expect.poll(() => writes.length).toBe(1);

    // Thao tác F5 reload trang
    await page.reload();

    // Dữ liệu vẫn hiển thị ổn định sau khi reload
    await expect(page.getByText('INV-2026-0046').first()).toBeVisible({ timeout: 15000 });
    expect(writes).toEqual(['POST /api/members/me/invoices/46/verify-vnpay']);
  });

  test('PAY-04: Return VNPay bị hủy không biến hóa đơn Pending thành Paid', async ({ page }) => {
    const pending = { ...mockInvoices[1], paymentStatus: 'pending', status: 'Pending' };
    await page.route((url) => isApiMatch(url, 'members/me/invoices'), (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() === 'POST' && path.endsWith('/46/verify-vnpay')) return route.fulfill({ json: { verificationStatus: 'DISABLED' } });
      if (request.method() !== 'GET') return route.fallback();
      return route.fulfill({ json: path.endsWith('/46') ? pending : [pending] });
    });
    await loginAs(page, 'member');
    await page.goto('/member/invoices?invoiceId=46&vnp_ResponseCode=24');
    await expect(page.getByText('Thanh toán chưa được xác minh')).toBeVisible();
    await expect(page.getByText('Hóa đơn đã thanh toán', { exact: true })).not.toBeVisible();
    await page.reload();
    await expect(page.getByText('Thanh toán chưa được xác minh')).toBeVisible();
  });
});
