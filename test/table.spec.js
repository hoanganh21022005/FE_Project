import { test, expect } from './helpers/guardedTest.js';
import { loginAs, navigateTo, setupDefaultApiMocks, isApiMatch } from './helpers/mockAuth.js';
import { mockClasses, mockInvoices, mockMembers, mockSubjects, mockRooms, mockCoaches } from './helpers/mockData.js';

test.describe('Kịch bản Dữ liệu Bảng & Render API (TABLE-01 -> TABLE-07)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    // 1. Mock mặc định tất cả các API phụ trợ của SCMS để không bị lỗi 401
    const auxiliary = ['/api/members/101/enrollments', '/api/members/101/subscriptions'];
    if (testInfo.title.startsWith('TABLE-01')) auxiliary.push('/api/sessions');
    if (!testInfo.title.startsWith('TABLE-03')) auxiliary.push('/api/members');
    if (!testInfo.title.startsWith('TABLE-01')) auxiliary.push('/api/classes');
    await setupDefaultApiMocks(page, auxiliary);

    // 2. Mock các danh mục chung cần thiết
    await page.route((url) => isApiMatch(url, 'subjects'), (r) => r.fulfill({ status: 200, json: mockSubjects }));
    await page.route((url) => isApiMatch(url, 'rooms'), (r) => r.fulfill({ status: 200, json: mockRooms }));
    await page.route((url) => isApiMatch(url, 'coaches'), (r) => r.fulfill({ status: 200, json: mockCoaches }));
  });

  // TABLE-01: Manager mở /manager/classes, theo dõi GET /api/classes
  test('TABLE-01: Manager mở /manager/classes, API trả về danh sách lớp và render chính xác lên Table', async ({ page }) => {
    let apiRequested = false;
    await page.route((url) => isApiMatch(url, 'classes'), async (route) => {
      if (route.request().method() === 'GET') {
        apiRequested = true;
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockClasses),
        });
      }
      return route.fallback();
    });

    // 1. Mô phỏng đăng nhập vai trò Manager
    await loginAs(page, 'manager');

    // 2. Chuyển đến trang quản lý lớp học bằng click menu
    await navigateTo(page, '/manager/classes');

    // 3. Chờ trạng thái tải kết thúc và Table xuất hiện
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 });
    expect(apiRequested).toBe(true);

    // 4. Kiểm tra dữ liệu lớp học khớp với response trả về được render trên Table
    const tableBody = page.locator('tbody');
    await expect(tableBody).toContainText('Lớp Cầu Lông Cơ Bản K01');
    await expect(tableBody).toContainText('Lớp Thể Hình Nâng Cao');
    await expect(tableBody).toContainText('Huấn luyện viên mẫu A');
  });

  // TABLE-02: Receptionist mở /receptionist/payments, theo dõi GET /api/invoices
  test('TABLE-02: Receptionist mở /receptionist/payments, mã, trạng thái, giá trị hóa đơn khớp response', async ({ page }) => {
    let invoicesRequested = false;
    await page.route((url) => isApiMatch(url, 'invoices'), async (route) => {
      invoicesRequested = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockInvoices),
      });
    });

    await loginAs(page, 'receptionist');
    await navigateTo(page, '/receptionist/payments');

    // Chờ bảng thanh toán xuất hiện
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 });
    expect(invoicesRequested).toBe(true);

    const table = page.locator('table');
    // Kiểm tra mã hóa đơn
    await expect(table).toContainText('INV-2026-0045');
    await expect(table).toContainText('INV-2026-0046');

    // Kiểm tra tên hội viên và số tiền (1.200.000 / 3.200.000)
    await expect(table).toContainText('Hội viên mẫu A');
    await expect(table).toContainText(/1\.200\.000/);
    await expect(table).toContainText(/3\.200\.000/);

    // Kiểm tra trạng thái thanh toán (Đang xử lý / Thành công)
    await expect(table).toContainText(/Đang xử lý|Chờ|Pending/i);
    await expect(table).toContainText(/Thành công|Đã thanh toán|Paid/i);
  });

  // TABLE-03: Mở danh sách hội viên, theo dõi GET /api/members
  test('TABLE-03: Mở danh sách hội viên /manager/members, dữ liệu khớp response và phân quyền', async ({ page }) => {
    let membersRequested = false;
    await page.route((url) => isApiMatch(url, 'members'), async (route) => {
      membersRequested = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockMembers),
      });
    });

    await loginAs(page, 'manager');
    await navigateTo(page, '/manager/members');

    await expect(page.locator('table')).toBeVisible({ timeout: 15000 });
    expect(membersRequested).toBe(true);

    const tableBody = page.locator('tbody');
    // Kiểm tra thông tin các hội viên khớp response hiển thị trên bảng
    await expect(tableBody).toContainText('Hội viên mẫu A');
    await expect(tableBody).toContainText('member@example.invalid');
    await expect(tableBody).toContainText('Hội viên mẫu B');
    await expect(tableBody).toContainText('member-b@example.invalid');
  });

  // TABLE-04: Trả danh sách rỗng rồi trả lỗi 500/mất mạng
  test('TABLE-04: Phân biệt rõ ràng giữa trạng thái danh sách rỗng và thông báo lỗi tải', async ({ page }) => {
    // Ca 1: API trả về danh sách rỗng []
    await page.route((url) => isApiMatch(url, 'invoices'), async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await loginAs(page, 'receptionist');
    await navigateTo(page, '/receptionist/payments');

    // Phải hiển thị trạng thái rỗng, không hiển thị dòng dữ liệu rác
    await expect(
      page.getByText(/Chưa có bản ghi giao dịch|Không tìm thấy hóa đơn|Không có dữ liệu/i).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table tbody tr')).toHaveCount(0);

    // Ca 2: Khi API trả về lỗi 500 Server Error
    await page.route((url) => isApiMatch(url, 'invoices'), async (route) => {
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Lỗi máy chủ nội bộ (Internal Server Error)' }),
      });
    });

    // Bấm nút Tải lại danh sách
    const reloadButton = page.locator('button:has-text("Tải lại danh sách")');
    if (await reloadButton.isVisible().catch(() => false)) {
      await reloadButton.click();
    } else {
      await page.reload();
    }

    // Phải hiển thị lỗi hoặc alert cảnh báo rõ ràng trên giao diện (không chọn option select)
    await expect(
      page.locator('p:has-text("Lỗi tải dữ liệu"), p:has-text("Error")').first()
    ).toBeVisible({ timeout: 15000 });
  });

  // TABLE-05: Lọc hóa đơn theo trạng thái/ngày; xóa bộ lọc
  test('TABLE-05: Thao tác bộ lọc hóa đơn, request gửi đúng tham số và bảng cập nhật', async ({ page }) => {
    await page.route((url) => isApiMatch(url, 'invoices'), async (route) => {
      const urlObj = new URL(route.request().url());
      const statusParam = (urlObj.searchParams.get('status') || '').toLowerCase();

      // Lọc danh sách theo status backend (Paid / Pending)
      let filtered = mockInvoices;
      if (statusParam === 'pending') {
        filtered = mockInvoices.filter((inv) => (inv.status || '').toLowerCase() === 'pending' || (inv.paymentStatus || '').toLowerCase() === 'pending');
      } else if (statusParam === 'paid' || statusParam === 'successful') {
        filtered = mockInvoices.filter((inv) => (inv.status || '').toLowerCase() === 'paid' || (inv.paymentStatus || '').toLowerCase() === 'successful');
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(filtered),
      });
    });

    await loginAs(page, 'receptionist');
    await navigateTo(page, '/receptionist/payments');
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 });

    const statusSelect = page.locator('select').first();
    await expect(statusSelect).toBeVisible();

    // 1. Lọc theo "Chờ thu tiền" (pending)
    await statusSelect.selectOption('pending');
    await expect(page.locator('table')).toContainText('INV-2026-0045');
    await expect(page.locator('table')).not.toContainText('INV-2026-0046');

    // 2. Chuyển sang "Đã thu tiền" (successful)
    await statusSelect.selectOption('successful');
    await expect(page.locator('table')).toContainText('INV-2026-0046');
    await expect(page.locator('table')).not.toContainText('INV-2026-0045');

    // 3. Xóa bộ lọc / chọn "Tất cả" (all)
    await statusSelect.selectOption('all');
    await expect(page.locator('table')).toContainText('INV-2026-0045');
    await expect(page.locator('table')).toContainText('INV-2026-0046');
  });

  // TABLE-06: Đổi bộ lọc nhanh, response cũ về sau
  test('TABLE-06: Xử lý Race Condition khi đổi bộ lọc nhanh, bảng phản ánh kết quả cuối cùng', async ({ page }) => {
    await page.route((url) => isApiMatch(url, 'invoices'), async (route) => {
      const urlObj = new URL(route.request().url());
      const statusParam = (urlObj.searchParams.get('status') || '').toLowerCase();

      if (statusParam === 'pending') {
        // Request cũ bị trễ 600ms
        await new Promise((r) => setTimeout(r, 600));
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([mockInvoices[0]]),
        });
      }

      if (statusParam === 'paid' || statusParam === 'successful') {
        // Request mới về nhanh sau 50ms
        await new Promise((r) => setTimeout(r, 50));
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([mockInvoices[1]]),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockInvoices),
      });
    });

    await loginAs(page, 'receptionist');
    await navigateTo(page, '/receptionist/payments');
    await expect(page.locator('table')).toBeVisible({ timeout: 15000 });

    const statusSelect = page.locator('select').first();

    // Chọn Pending (chậm) rồi lập tức chọn Successful (nhanh)
    await statusSelect.selectOption('pending');
    await page.waitForTimeout(50);
    await statusSelect.selectOption('successful');

    // Đợi 800ms để cả 2 request cùng hoàn tất
    await page.waitForTimeout(800);

    // Bảng phải phản ánh lựa chọn cuối cùng (Successful - INV-2026-0046), không bị Pending đè lên
    await expect(page.locator('table')).toContainText('INV-2026-0046');
    await expect(page.locator('table')).not.toContainText('INV-2026-0045');
  });

  // TABLE-07: Member mở /member/invoices, theo dõi GET /api/members/me/invoices
  test('TABLE-07: Member mở /member/invoices, chỉ hiển thị danh sách hóa đơn của phiên hiện tại', async ({ page }) => {
    let ownInvoicesRequested = false;
    const ownInvoices = [mockInvoices[0], mockInvoices[1]];

    await page.route((url) => isApiMatch(url, 'members/me/invoices'), async (route) => {
      ownInvoicesRequested = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ownInvoices),
      });
    });

    await loginAs(page, 'member');
    await navigateTo(page, '/member/invoices');

    // Chờ danh sách hóa đơn render
    await expect(page.getByText('INV-2026-0045').first()).toBeVisible({ timeout: 15000 });
    expect(ownInvoicesRequested).toBe(true);

    // Kiểm tra thông tin các hóa đơn của mình
    await expect(page.getByText('INV-2026-0046').first()).toBeVisible();
    await expect(page.getByText(/1\.200\.000/).first()).toBeVisible();

    // Đảm bảo không hiển thị hóa đơn của người khác
    await expect(page.getByText('INV-2026-0047')).not.toBeVisible();
  });
});
