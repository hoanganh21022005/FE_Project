import { test, expect } from './helpers/guardedTest.js';
import { isApiMatch, loginAs, setupDefaultApiMocks } from './helpers/mockAuth.js';
import { mockUsers } from './helpers/mockData.js';

const VIETNAMESE_DIACRITICS_RE = /[À-ỹ]/;

const sampleUsers = [
  {
    id: 10,
    code: 'STF-010',
    fullName: 'Nguyen Van An',
    email: 'an@example.invalid',
    roleName: 'CenterManager',
    roleId: 2,
    status: 'active',
    createdAt: '2026-10-01T08:00:00Z',
  },
  {
    id: 99,
    code: 'ADM-001',
    fullName: 'System Admin',
    email: mockUsers.admin.email,
    roleName: 'Admin',
    roleId: 1,
    status: 'active',
    createdAt: '2026-10-01T08:00:00Z',
  },
];

const sampleRoles = [
  {
    id: 1,
    name: 'Admin',
    permissions: [
      { id: 1, name: 'MANAGE_USERS' },
      { id: 2, name: 'MANAGE_RBAC' },
      { id: 3, name: 'MANAGE_PERMISSIONS' },
      { id: 4, name: 'VIEW_AUDIT_LOG' },
    ],
  },
  {
    id: 2,
    name: 'CenterManager',
    permissions: [
      { id: 5, name: 'MANAGE_CLASSES' },
      { id: 6, name: 'VIEW_REPORTS' },
    ],
  },
];

const samplePermissions = [
  { id: 1, name: 'MANAGE_USERS' },
  { id: 2, name: 'MANAGE_RBAC' },
  { id: 3, name: 'MANAGE_PERMISSIONS' },
  { id: 4, name: 'VIEW_AUDIT_LOG' },
  { id: 5, name: 'MANAGE_CLASSES' },
  { id: 6, name: 'VIEW_REPORTS' },
];

const sampleAuditLogs = [
  {
    id: 101,
    action: 'CREATE_USER',
    actorId: 99,
    actorName: 'System Admin',
    targetEntity: 'USER',
    targetId: 10,
    targetLabel: 'Nguyen Van An',
    result: 'SUCCESS',
    createdAt: '2026-11-14T09:00:00Z',
    detail: 'Created manager account',
  },
];

async function assertMin44pxControls(page, rootSelector) {
  const violations = await page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return ['Missing root: ' + sel];
    const els = Array.from(root.querySelectorAll('button, input, select, a, label'));
    const bad = [];
    for (const el of els) {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute('type') || '').toLowerCase();
      if (tag === 'input' && (type === 'checkbox' || type === 'radio')) {
        // Checkbox/radio vùng bấm tính qua label bao ngoài hoặc chính input nếu đứng riêng
        if (el.closest('label')) continue;
      }
      if (tag === 'label') {
        const hasCheck = el.querySelector('input[type="checkbox"], input[type="radio"]');
        if (!hasCheck && style.cursor !== 'pointer') continue;
      }
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.width < 44 || r.height < 44) {
        bad.push(`${tag}[type=${type || 'none'}] "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)}" => ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }
    return bad;
  }, rootSelector);
  expect(violations, `Controls under 44px in ${rootSelector}`).toEqual([]);
}

test.describe('Đồng bộ Admin còn lại (W-F1)', () => {
  test.beforeEach(async ({ page }) => {
    await setupDefaultApiMocks(page, [
      '/api/members',
      '/api/classes',
      '/api/invoices',
      '/api/specializations',
      '/api/holidays',
      '/api/sessions',
      '/api/users',
      '/api/roles',
      '/api/permissions',
      '/api/audit-logs',
    ]);

    await page.route((url) => isApiMatch(url, 'users/10'), (route) =>
      route.fulfill({ status: 200, json: sampleUsers[0] }),
    );
    await page.route((url) => isApiMatch(url, 'users/99'), (route) =>
      route.fulfill({ status: 200, json: sampleUsers[1] }),
    );
    await page.route((url) => url.pathname === '/api/users', (route) =>
      route.fulfill({ status: 200, json: sampleUsers }),
    );
    await page.route((url) => isApiMatch(url, 'roles'), (route) =>
      route.fulfill({ status: 200, json: sampleRoles }),
    );
    await page.route((url) => isApiMatch(url, 'permissions'), (route) =>
      route.fulfill({ status: 200, json: samplePermissions }),
    );
    await page.route((url) => isApiMatch(url, 'audit-logs'), (route) =>
      route.fulfill({ status: 200, json: sampleAuditLogs }),
    );
  });

  test('Chế độ EN: không còn dấu tiếng Việt ở Users (+chi tiết +dialogs), Roles, Audit Logs, Profile kể cả trạng thái lỗi không có message', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('scms_admin_lang', 'en');
      } catch {}
    });

    await loginAs(page, 'admin');

    // 1. /admin/users + chi tiết + 4 dialogs
    await page.goto('/admin/users');
    await expect(page.locator('main table')).toBeVisible({ timeout: 10000 });
    expect(await page.locator('main').innerText()).not.toMatch(VIETNAMESE_DIACRITICS_RE);

    // Mở UserFormModal
    await page.locator('main button', { hasText: 'Add user' }).click();
    const formDialog = page.locator('[role="dialog"]');
    await expect(formDialog).toBeVisible();
    expect(await formDialog.innerText()).not.toMatch(VIETNAMESE_DIACRITICS_RE);
    await page.keyboard.press('Escape');
    await expect(formDialog).toHaveCount(0);

    // Mở ngăn chi tiết User (Nguyen Van An - hàng thứ 2 hoặc theo tên) và kiểm tra không có #số
    const anRow = page.locator('main tbody tr', { hasText: 'Nguyen Van An' }).first();
    await anRow.locator('button').last().click();
    await page.locator('[role="menuitem"], main button', { hasText: 'View details' }).first().click();
    await expect(page.locator('main')).toContainText('STF-010');
    expect(await page.locator('main').innerText()).not.toMatch(/ID\s*#\d+/i);
    expect(await page.locator('main').innerText()).not.toMatch(VIETNAMESE_DIACRITICS_RE);

    // Mở UserRoleDialog, UserStatusDialog, UserReissuePasswordDialog
    for (const btnLabel of ['Change role', 'Change status', 'Reset PWD']) {
      await page.locator('main button', { hasText: btnLabel }).first().click();
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
      const dialogText = await dialog.innerText();
      expect(dialogText).not.toMatch(VIETNAMESE_DIACRITICS_RE);
      expect(dialogText).not.toMatch(/ID\s*#\d+/i);
      await dialog.locator('button[aria-label="Close"]').click();
      await expect(dialog).toHaveCount(0);
    }

    // 2. /admin/roles
    await page.goto('/admin/roles');
    await expect(page.locator('main table')).toBeVisible({ timeout: 10000 });
    expect(await page.locator('main').innerText()).not.toMatch(VIETNAMESE_DIACRITICS_RE);

    // 3. /admin/audit-logs (bình thường + lỗi 500 không có message)
    await page.goto('/admin/audit-logs');
    await expect(page.locator('main table')).toBeVisible({ timeout: 10000 });
    expect(await page.locator('main').innerText()).not.toMatch(VIETNAMESE_DIACRITICS_RE);

    await page.route((url) => isApiMatch(url, 'audit-logs'), (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
    );
    await page.goto('/admin/audit-logs');
    await expect(page.locator('main [role="alert"]')).toBeVisible({ timeout: 10000 });
    expect(await page.locator('main').innerText()).not.toMatch(VIETNAMESE_DIACRITICS_RE);

    // 4. /profile
    await page.goto('/profile');
    await expect(page.locator('main h2').first()).toBeVisible({ timeout: 10000 });
    expect(await page.locator('main').innerText()).not.toMatch(VIETNAMESE_DIACRITICS_RE);
  });

  test('Vùng bấm >= 44px và không tràn ngang ở 1280x800 và 375x667 trên Roles, Audit Logs, Profile và các dialog', async ({ page }) => {
    await loginAs(page, 'admin');

    for (const vp of [
      { width: 1280, height: 800 },
      { width: 375, height: 667 },
    ]) {
      await page.setViewportSize(vp);

      await page.goto('/admin/roles');
      await expect(page.locator('main table')).toBeVisible({ timeout: 10000 });
      await assertMin44pxControls(page, 'main');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      await page.goto('/admin/audit-logs');
      await expect(page.locator('main table')).toBeVisible({ timeout: 10000 });
      await assertMin44pxControls(page, 'main');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      await page.goto('/profile');
      await expect(page.locator('main h2').first()).toBeVisible({ timeout: 10000 });
      await assertMin44pxControls(page, 'main');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      await page.goto('/admin/users');
      await expect(page.locator('main table')).toBeVisible({ timeout: 10000 });
      await page.locator('main button', { hasText: /Thêm người dùng|Add user/i }).click();
      await expect(page.locator('[role="dialog"]')).toBeVisible();
      await assertMin44pxControls(page, '[role="dialog"]');
      await page.keyboard.press('Escape');
    }
  });
});
