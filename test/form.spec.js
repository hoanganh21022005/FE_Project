import { test, expect } from './helpers/guardedTest.js';
import { loginAs, navigateTo, setupDefaultApiMocks, isApiMatch } from './helpers/mockAuth.js';
import { mockSubjects, mockRooms, mockCoaches } from './helpers/mockData.js';

test.describe('Kịch bản Điền Form & Thao Tác Tạo Lớp (FORM-01 -> FORM-04)', () => {
  const mock12Sessions = Array.from({ length: 12 }, (_, i) => ({
    id: 1000 + i,
    classId: 999,
    sessionNumber: i + 1,
    date: '2026-11-20',
    startTime: '18:00',
    endTime: '19:30',
    status: 'Scheduled',
  }));

  test.beforeEach(async ({ page }) => {
    // 1. Mock mặc định tất cả các API phụ trợ của SCMS
    await setupDefaultApiMocks(page, ['/api/members']);

    // 2. Mock danh mục ban đầu cho màn quản lý lớp học
    await page.route((url) => isApiMatch(url, 'classes'), async (route) => {
      if (route.request().method() === 'GET' && new URL(route.request().url()).pathname === '/api/classes') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
      return route.fallback();
    });

    await page.route((url) => isApiMatch(url, 'subjects'), (r) => r.fulfill({ status: 200, json: mockSubjects }));
    await page.route((url) => isApiMatch(url, 'rooms'), (r) => r.fulfill({ status: 200, json: mockRooms }));
    await page.route((url) => isApiMatch(url, 'coaches'), (r) => r.fulfill({ status: 200, json: mockCoaches }));
    await page.route((url) => isApiMatch(url, 'sessions'), (r) => r.fulfill({ status: 200, json: mock12Sessions }));
  });

  // FORM-01: Manager mở form tạo lớp, thiếu trường bắt buộc rồi submit
  test('FORM-01: Để trống tên lớp khi submit thì hiện lỗi validation và không gửi API', async ({ page }) => {
    let postClassCount = 0;
    page.on('request', (req) => {
      if (req.method() === 'POST' && isApiMatch(req.url(), 'classes')) {
        postClassCount++;
      }
    });

    await loginAs(page, 'manager');
    await navigateTo(page, '/manager/classes');

    // Chờ nút Tạo lớp học xuất hiện
    const createClassBtn = page.getByRole('button', { name: /Tạo lớp học/i }).first();
    await expect(createClassBtn).toBeVisible({ timeout: 15000 });
    await createClassBtn.click();

    // Modal xuất hiện
    await expect(page.getByRole('heading', { name: 'Tạo lớp học mới' })).toBeVisible();

    const modal = page.locator('.fixed.inset-0');
    // Tìm input tên lớp và xóa sạch
    const nameInput = modal.locator('input[placeholder*="VD:"], input[placeholder*="nâng cao"], input[type="text"]').first();
    await expect(nameInput).toBeVisible();
    await nameInput.fill('');

    // Bấm nút Tạo & mở đăng ký
    const submitBtn = modal.locator('button:has-text("Tạo & mở đăng ký")').first();
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

    // Xác nhận hiển thị thông báo lỗi validation và không gửi POST
    await expect(
      page.getByText(/Vui lòng nhập tên lớp học|Tên lớp không được để trống|bắt buộc/i).first()
    ).toBeVisible({ timeout: 5000 });
    expect(postClassCount).toBe(0);
  });

  // FORM-02: Tạo lớp với dữ liệu hợp lệ
  test('FORM-02: Điền đầy đủ thông tin hợp lệ, API thành công và giao diện phản ánh thành công', async ({ page }) => {
    const newClassData = {
      id: 999,
      code: 'CLS-BAD-999',
      name: 'Lớp Cầu Lông Tối K99',
      nameVi: 'Lớp Cầu Lông Tối K99',
      subjectId: 1,
      subjectName: 'Cầu lông',
      coachId: 2,
      coachName: 'Huấn luyện viên mẫu A',
      roomId: 1,
      roomName: 'Sân Cầu Lông 01',
      capacity: 15,
      minCapacity: 5,
      enrolledCount: 0,
      price: 650000,
      status: 'Open',
      daysOfWeek: [1, 3, 5],
      startTime: '18:00',
      endTime: '19:30',
      startDate: '2026-11-20',
      endDate: '2026-12-20',
    };

    let classCreationPayload = null;
    await page.route((url) => isApiMatch(url, 'classes'), async (route) => {
      if (route.request().method() === 'POST' && new URL(route.request().url()).pathname === '/api/classes/normal-with-sessions') {
        classCreationPayload = route.request().postDataJSON();
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(newClassData),
        });
      }
      if (route.request().method() !== 'GET' || new URL(route.request().url()).pathname !== '/api/classes') return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await loginAs(page, 'manager');
    await navigateTo(page, '/manager/classes');

    const createClassBtn = page.getByRole('button', { name: /Tạo lớp học/i }).first();
    await expect(createClassBtn).toBeVisible({ timeout: 15000 });
    await createClassBtn.click();

    await expect(page.getByRole('heading', { name: 'Tạo lớp học mới' })).toBeVisible();

    const modal = page.locator('.fixed.inset-0');
    // Nhập tên lớp hợp lệ bên trong modal
    const nameInput = modal.locator('input[placeholder*="VD:"], input[placeholder*="nâng cao"], input[type="text"]').first();
    await nameInput.fill('Lớp Cầu Lông Tối K99');
    await modal.locator('select').nth(0).selectOption('badminton');
    await modal.locator('select').nth(1).selectOption('2');
    await modal.locator('select').nth(2).selectOption('1');
    const dateText = await modal.getByText('Ngày bắt đầu', { exact: true }).locator('..').locator('button').innerText();
    const dateParts = dateText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    expect(dateParts).not.toBeNull();
    const startDate = `${dateParts[3]}-${dateParts[2]}-${dateParts[1]}`;

    // Bấm nút Tạo & mở đăng ký
    const submitBtn = modal.locator('button:has-text("Tạo & mở đăng ký")').first();
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

    // Verify request được gửi với payload hợp lệ
    await page.waitForTimeout(1000);
    expect(classCreationPayload).toEqual(expect.objectContaining({
      sportsClass: expect.objectContaining({ name: 'Lớp Cầu Lông Tối K99', classType: 'Normal', totalSessions: 12, subjectId: 1, coachId: 2, maxCapacity: 8, startDate, tuitionFee: 650000 }),
      roomId: 1, daysOfWeek: [1, 3, 5], startTime: '06:00', endTime: '07:30', requestId: expect.any(String),
    }));

    // Thông báo tạo lớp thành công hiển thị
    await expect(
      page.getByText(/thành công/i).first()
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table')).toContainText('Lớp Cầu Lông Tối K99');
  });

  // FORM-03: API tạo lớp trả lỗi validation hoặc xung đột lịch
  test('FORM-03: API trả lỗi xung đột lịch (Conflict 409), hiển thị thông báo lỗi và giữ lại thông tin form', async ({ page }) => {
    await page.route((url) => isApiMatch(url, 'classes'), async (route) => {
      if (route.request().method() === 'POST' && new URL(route.request().url()).pathname === '/api/classes/normal-with-sessions') {
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'SCHEDULE_CONFLICT',
            message: 'Phòng tập hoặc Huấn luyện viên đã bị trùng lịch trong khung giờ này.',
          }),
        });
      }
      if (route.request().method() !== 'GET' || new URL(route.request().url()).pathname !== '/api/classes') return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await loginAs(page, 'manager');
    await navigateTo(page, '/manager/classes');

    const createClassBtn = page.getByRole('button', { name: /Tạo lớp học/i }).first();
    await expect(createClassBtn).toBeVisible({ timeout: 15000 });
    await createClassBtn.click();

    await expect(page.getByRole('heading', { name: 'Tạo lớp học mới' })).toBeVisible();
    const modal = page.locator('.fixed.inset-0');
    const nameInput = modal.locator('input[placeholder*="VD:"], input[placeholder*="nâng cao"], input[type="text"]').first();
    await nameInput.fill('Lớp Bị Trùng Lịch');

    const submitBtn = modal.locator('button:has-text("Tạo & mở đăng ký")').first();
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    await submitBtn.click();

    // Hiển thị thông báo lỗi từ server (toast hoặc alert)
    await expect(
      page.getByText(/trùng lịch|xung đột|conflict|lỗi/i).first()
    ).toBeVisible({ timeout: 10000 });

    // Đảm bảo modal không bị tự đóng và giữ nguyên tên lớp vừa nhập
    await expect(page.getByRole('heading', { name: 'Tạo lớp học mới' })).toBeVisible();
    await expect(nameInput).toHaveValue('Lớp Bị Trùng Lịch');
  });

  // FORM-04: Submit hai lần khi request đang chờ (Chống Double Submit)
  test('FORM-04: Ngăn chặn gửi 2 request khi người dùng bấm submit liên tiếp', async ({ page }) => {
    let postCallCount = 0;

    await page.route((url) => isApiMatch(url, 'classes'), async (route) => {
      if (route.request().method() === 'POST' && new URL(route.request().url()).pathname === '/api/classes/normal-with-sessions') {
        postCallCount++;
        // Trì hoãn 1000ms để mô phỏng request đang chờ xử lý
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 999, name: 'Lớp Test Anti Double Submit' }),
        });
      }
      if (route.request().method() !== 'GET' || new URL(route.request().url()).pathname !== '/api/classes') return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await loginAs(page, 'manager');
    await navigateTo(page, '/manager/classes');

    const createClassBtn = page.getByRole('button', { name: /Tạo lớp học/i }).first();
    await expect(createClassBtn).toBeVisible({ timeout: 15000 });
    await createClassBtn.click();

    await expect(page.getByRole('heading', { name: 'Tạo lớp học mới' })).toBeVisible();
    const modal = page.locator('.fixed.inset-0');
    const nameInput = modal.locator('input[placeholder*="VD:"], input[placeholder*="nâng cao"], input[type="text"]').first();
    await nameInput.fill('Lớp Test Anti Double Submit');

    const submitBtn = modal.locator('button:has-text("Tạo & mở đăng ký")').first();
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });

    // Bấm lần 1
    await submitBtn.click();

    // Thử bấm lần 2 ngay lập tức
    try {
      await submitBtn.click({ timeout: 300, force: false });
    } catch {
      // Nút bị disabled khi đang xử lý nên click không kích hoạt thêm event
    }

    await page.waitForTimeout(1200);

    // Xác nhận chỉ có DUY NHẤT 1 request được gửi lên server
    expect(postCallCount).toBe(1);
  });
});
