import { test, expect } from '@playwright/test';
import { guardRequest } from './helpers/guardedTest.js';
import { isApiMatch, isLocalApi } from './helpers/mockAuth.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import config from '../playwright.config.js';

test('Guard mocks only the exact Google SDK and blocks other external requests', async () => {
  const unexpected = [];
  const actions = [];
  const route = (url, method = 'GET') => ({
    request: () => ({ url: () => url, method: () => method }),
    fulfill: (response) => actions.push(['fulfill', response]),
    abort: (reason) => actions.push(['abort', reason]),
    continue: () => actions.push(['continue']),
  });
  await guardRequest(route('https://accounts.google.com/gsi/client'), unexpected);
  expect(actions[0]).toEqual(['fulfill', { status: 200, contentType: 'application/javascript', body: '' }]);
  await guardRequest(route('https://fonts.googleapis.com/css2?family=Example'), unexpected);
  expect(actions[1]).toEqual(['fulfill', { status: 200, contentType: 'text/css', body: '' }]);
  await guardRequest(route('https://accounts.google.com/other'), unexpected);
  await guardRequest(route('https://accounts.google.com/gsi/client', 'POST'), unexpected);
  await guardRequest(route('https://fonts.googleapis.com/api/subjects'), unexpected);
  await guardRequest(route('https://fonts.googleapis.com/css2', 'POST'), unexpected);
  await guardRequest(route('http://127.0.0.1:5199/api/unmocked'), unexpected);
  expect(actions.slice(2)).toEqual(Array(5).fill(['abort', 'blockedbyclient']));
  expect(unexpected).toEqual(['GET https://accounts.google.com/other', 'POST https://accounts.google.com/gsi/client', 'GET https://fonts.googleapis.com/api/subjects', 'POST https://fonts.googleapis.com/css2', 'GET http://127.0.0.1:5199/api/unmocked']);
});

test('Guard chặn request ngoài từ trình duyệt', async ({ page }) => {
  const unexpected = [];
  await page.route('**/*', (route) => guardRequest(route, unexpected));
  const result = await page.evaluate(() => fetch('https://outside.example.invalid/probe').then(() => 'allowed', () => 'blocked'));
  expect(result).toBe('blocked');
  expect(unexpected).toEqual(['GET https://outside.example.invalid/probe']);
});

test('Matcher API chỉ nhận origin của server test', () => {
  const origin = new URL(config.use.baseURL).origin;
  expect(isLocalApi(new URL(`${origin}/api/auth/me`), '/api/auth/me')).toBe(true);
  expect(isApiMatch(`${origin}/api/classes/101`, 'classes')).toBe(true);
  expect(isLocalApi(new URL('https://outside.example.invalid/api/auth/me'), '/api/auth/me')).toBe(false);
  expect(isApiMatch('https://outside.example.invalid/api/classes/101', 'classes')).toBe(false);
  expect(isApiMatch('http://127.0.0.1:1/api/classes', 'classes')).toBe(false);
});

test('Fixture thất bại khi request ngoài trùng đường dẫn mock', async ({}, testInfo) => {
  const dir = testInfo.outputPath('fixture-probe');
  mkdirSync(dir, { recursive: true });
  const guardUrl = pathToFileURL(path.resolve('test/helpers/guardedTest.js')).href;
  const mockUrl = pathToFileURL(path.resolve('test/helpers/mockAuth.js')).href;
  const origin = new URL(config.use.baseURL).origin;
  writeFileSync(path.join(dir, 'playwright.config.mjs'), `export default { testDir: '.', testMatch: 'probe.spec.mjs', outputDir: './artifacts', respectGitIgnore: false, workers: 1, retries: 0, reporter: 'list', use: { browserName: 'chromium', serviceWorkers: 'block', proxy: { server: 'http://127.0.0.1:1' } } };`);
  writeFileSync(path.join(dir, 'probe.spec.mjs'), `
import { test, expect } from ${JSON.stringify(guardUrl)};
import { setupDefaultApiMocks, isApiMatch, isLocalApi } from ${JSON.stringify(mockUrl)};
test('probe', async ({ page }) => {
  await setupDefaultApiMocks(page);
  await page.route(url => isApiMatch(url, 'classes'), route => route.fulfill({ json: [] }));
  await page.route(url => isLocalApi(url, '/api/auth/me'), route => route.fulfill({ json: {} }));
  const local = await page.goto(${JSON.stringify(`${origin}/api/subjects`)});
  expect(local.status()).toBe(200);
  for (const path of ['/api/subjects', '/api/classes', '/api/auth/me']) {
    await expect(page.goto('https://outside.example.invalid' + path)).rejects.toThrow();
  }
  await expect(page.goto('https://fonts.googleapis.com/api/subjects')).rejects.toThrow();
  console.log('PROBE_BODY_COMPLETED');
});`);
  const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
  const child = spawnSync(process.execPath, [cli, 'test', '--config', path.join(dir, 'playwright.config.mjs')], {
    cwd: process.cwd(), encoding: 'utf8', timeout: 25000, env: { ...process.env, CI: '' },
  });
  const output = `${child.stdout || ''}\n${child.stderr || ''}`;
  expect(child.error).toBeUndefined();
  expect(child.status).toBe(1);
  expect(output).toContain('PROBE_BODY_COMPLETED');
  expect(output).toContain('Unexpected network requests must be explicitly mocked');
  for (const path of ['/api/subjects', '/api/classes', '/api/auth/me']) {
    expect(output).toContain(`GET https://outside.example.invalid${path}`);
  }
  expect(output).toContain('GET https://fonts.googleapis.com/api/subjects');
});
