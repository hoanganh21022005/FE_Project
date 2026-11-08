/**
 * Screenshot capture script: BEFORE UI overhaul
 * Captures ManagerDashboard, MemberScheduleView, CoachDashboard at 1440x900 and 390x844
 */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'docs', 'ui-screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '390',  width: 390,  height: 844 },
];

const PAGES = [
  { name: 'ManagerDashboard', role: 'manager', path: '/manager' },
  { name: 'CoachDashboard',   role: 'coach',   path: '/coach' },
  { name: 'MemberScheduleView', role: 'member', path: '/member/schedule' },
];

const mockUsers = {
  manager: {
    id: 1, code: 'STF-001', name: 'Quản lý mẫu A',
    email: 'manager@example.invalid', role: 'manager', status: 'active',
    authorities: ['MANAGE_CLASSES','MANAGE_STAFF','MANAGE_INVOICES','VIEW_REPORTS'],
  },
  coach: {
    id: 2, coachId: 2, code: 'COA-002', name: 'HLV mẫu A',
    email: 'coach-a@example.invalid', role: 'coach', status: 'active',
    authorities: ['MANAGE_ATTENDANCE','VIEW_SCHEDULE'],
  },
  member: {
    id: 101, userId: 101, memberId: 101, code: 'MB-001', name: 'Hội viên mẫu A',
    email: 'member@example.invalid', role: 'member', status: 'active',
    membershipStatus: 'active',
  },
};

async function capturePages(suffix) {
  const browser = await chromium.launch({ headless: true });

  for (const pageInfo of PAGES) {
    const user = mockUsers[pageInfo.role];

    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        baseURL: 'http://127.0.0.1:5199',
      });
      const page = await ctx.newPage();

      let loggedIn = false;

      // Mock auth/me
      await page.route('**/api/auth/me', async route => {
        route.fulfill({
          status: loggedIn ? 200 : 401,
          contentType: 'application/json',
          body: JSON.stringify(loggedIn ? user : { message: 'Unauthenticated' }),
        });
      });

      // Mock login
      await page.route('**/api/auth/login', async route => {
        loggedIn = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
      });

      // Mock common APIs with empty arrays
      const commonApis = ['subjects','rooms','coaches','staff','packages','notifications',
        'members','classes','invoices','reports/dashboard','audit-logs',
        'notifications/me','classes/today','attendance','subscriptions','enrollments'];
      await page.route(url => {
        const p = new URL(url).pathname;
        return p.startsWith('/api/') && commonApis.some(a => p.includes(a));
      }, route => route.fulfill({ status: 200, json: [] }));

      // Login flow
      await page.goto('/login');
      try {
        await page.locator('#login-email').fill(user.email, { timeout: 8000 });
        await page.locator('#login-password').fill('Password123');
        await page.locator('button[type="submit"]').click();
        await page.waitForURL(new RegExp(`/${user.role}`), { timeout: 15000 });
      } catch (e) {
        console.error(`Login failed for ${pageInfo.name} ${vp.name}: ${e.message}`);
      }

      // Navigate to target page
      if (pageInfo.path !== `/${user.role}`) {
        try {
          await page.evaluate(target => {
            window.history.pushState(null, '', target);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }, pageInfo.path);
          await page.waitForTimeout(1500);
        } catch {}
      } else {
        await page.waitForTimeout(1500);
      }

      // Wait for content to settle
      await page.waitForTimeout(1000);

      const filename = `${pageInfo.name}-${suffix}-${vp.name}.png`;
      const outPath = path.join(OUT_DIR, filename);
      await page.screenshot({ path: outPath, fullPage: true });
      console.log(`✓ Saved: ${filename}`);

      await ctx.close();
    }
  }

  await browser.close();
  console.log('\nAll screenshots saved to docs/ui-screenshots/');
}

capturePages(process.argv[2] || 'before').catch(e => {
  console.error(e);
  process.exit(1);
});
