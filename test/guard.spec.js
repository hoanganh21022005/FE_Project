import { test, expect } from '@playwright/test';
import { guardRequest } from './helpers/guardedTest.js';

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
  await guardRequest(route('https://accounts.google.com/other'), unexpected);
  await guardRequest(route('https://accounts.google.com/gsi/client', 'POST'), unexpected);
  await guardRequest(route('http://127.0.0.1:5199/api/unmocked'), unexpected);
  expect(actions.slice(1)).toEqual([['abort', 'blockedbyclient'], ['abort', 'blockedbyclient'], ['abort', 'blockedbyclient']]);
  expect(unexpected).toEqual(['GET https://accounts.google.com/other', 'POST https://accounts.google.com/gsi/client', 'GET http://127.0.0.1:5199/api/unmocked']);
});

test('Guard chặn request ngoài từ trình duyệt', async ({ page }) => {
  const unexpected = [];
  await page.route('**/*', (route) => guardRequest(route, unexpected));
  const result = await page.evaluate(() => fetch('https://outside.example.invalid/probe').then(() => 'allowed', () => 'blocked'));
  expect(result).toBe('blocked');
  expect(unexpected).toEqual(['GET https://outside.example.invalid/probe']);
});
