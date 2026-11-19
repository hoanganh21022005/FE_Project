import { test, expect } from './helpers/guardedTest.js';
import { loginAs, navigateTo, setupDefaultApiMocks, isApiMatch } from './helpers/mockAuth.js';

// Danh mục môn giống backend thật: tên có phần chú thích trong ngoặc, có slug.
const backendSubjects = [
  { id: 1, name: 'Cầu lông (Badminton)', slug: 'badminton', normalPrice: 650000, advancedPrice: 900000, status: 'active', outdoor: false },
  { id: 2, name: 'Quần vợt (Tennis)', slug: 'tennis', normalPrice: 800000, advancedPrice: 1100000, status: 'active', outdoor: true },
  { id: 3, name: 'Bơi lội (Swimming)', slug: 'swimming', normalPrice: 700000, advancedPrice: 1000000, status: 'active', outdoor: false },
];

const rooms = [
  { id: 1, roomCode: 'ROM-001', name: 'Sân Cầu Lông 01', capacity: 20, status: 'Available', active: true, activityType: 'BADMINTON' },
  { id: 4, roomCode: 'ROM-004', name: 'Sân Tennis 01', capacity: 8, status: 'Available', active: true, activityType: 'TENNIS' },
  { id: 5, roomCode: 'ROM-005', name: 'Hồ bơi 01', capacity: 12, status: 'Available', active: true, activityType: 'SWIMMING' },
];

const coaches = [
  { id: 2, name: 'HLV Cầu lông', email: 'a@example.invalid', specialization: 'Cầu lông', specializationVi: 'Cầu lông', specializations: ['Cầu lông'], status: 'active' },
  { id: 6, name: 'HLV Quần vợt', email: 'b@example.invalid', specialization: 'Quần vợt', specializationVi: 'Quần vợt', specializations: ['Quần vợt'], status: 'active' },
  { id: 7, name: 'HLV Bơi lội', email: 'c@example.invalid', specialization: 'Bơi lội', specializationVi: 'Bơi lội', specializations: ['Bơi lội'], status: 'active' },
];

async function openModal(page, { subjects = backendSubjects } = {}) {
  await setupDefaultApiMocks(page, ['/api/members']);
  const created = [];
  await page.route((url) => isApiMatch(url, 'classes'), async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'POST' && path === '/api/classes/normal-with-sessions') {
      created.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 999, name: 'Lớp thử', status: 'Open' }) });
    }
    if (route.request().method() === 'GET' && path === '/api/classes') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    return route.fallback();
  });
  await page.route((url) => isApiMatch(url, 'subjects'), (r) => r.fulfill({ status: 200, json: subjects }));
  await page.route((url) => isApiMatch(url, 'rooms'), (r) => r.fulfill({ status: 200, json: rooms }));
  await page.route((url) => isApiMatch(url, 'coaches'), (r) => r.fulfill({ status: 200, json: coaches }));
  await page.route((url) => isApiMatch(url, 'sessions'), (r) => r.fulfill({ status: 200, json: [] }));

  await loginAs(page, 'manager');
  await navigateTo(page, '/manager/classes');
  const createClassBtn = page.getByRole('button', { name: /Tạo lớp học/i }).first();
  await expect(createClassBtn).toBeVisible({ timeout: 15000 });
  await createClassBtn.click();
  await expect(page.getByRole('heading', { name: 'Tạo lớp học mới' })).toBeVisible();
  return { modal: page.locator('.fixed.inset-0'), created };
}

async function submitFor(modal, sportId, className) {
  await modal.locator('select').nth(0).selectOption(sportId);
  await modal.locator('input[type="text"]').first().fill(className);
  const submitBtn = modal.locator('button:has-text("Tạo & mở đăng ký")').first();
  await expect(submitBtn).toBeEnabled({ timeout: 5000 });
  await submitBtn.click();
}

test.describe('Tạo lớp: danh sách môn lấy từ /api/subjects (L22)', () => {
  test('SUBJ-01: danh sách môn có Quần vợt và Bơi lội, không có Bắn súng', async ({ page }) => {
    const { modal } = await openModal(page);
    const labels = await modal.locator('select').nth(0).locator('option').allInnerTexts();
    expect(labels).toEqual(expect.arrayContaining(['Cầu lông', 'Quần vợt', 'Bơi lội']));
    expect(labels).not.toContain('Bắn súng');
    expect(labels).toHaveLength(3);
  });

  test('SUBJ-02: tạo lớp Quần vợt gửi đúng subjectId của môn trên backend', async ({ page }) => {
    const { modal, created } = await openModal(page);
    await submitFor(modal, 'tennis', 'Lớp Quần Vợt Tối');
    await expect.poll(() => created.length, { timeout: 10000 }).toBe(1);
    expect(created[0].sportsClass.subjectId).toBe(2);
    expect(created[0].roomId).toBe(4);
  });

  test('SUBJ-03: tạo lớp Bơi lội gửi đúng subjectId và phòng bơi', async ({ page }) => {
    const { modal, created } = await openModal(page);
    await submitFor(modal, 'swimming', 'Lớp Bơi Lội Sáng');
    await expect.poll(() => created.length, { timeout: 10000 }).toBe(1);
    expect(created[0].sportsClass.subjectId).toBe(3);
    expect(created[0].roomId).toBe(5);
  });

  test('SUBJ-04: môn không có trong backend không xuất hiện trong danh sách', async ({ page }) => {
    const { modal } = await openModal(page, { subjects: backendSubjects.filter((s) => s.slug !== 'tennis') });
    const labels = await modal.locator('select').nth(0).locator('option').allInnerTexts();
    expect(labels).not.toContain('Quần vợt');
    expect(labels).toEqual(expect.arrayContaining(['Cầu lông', 'Bơi lội']));
  });
});
