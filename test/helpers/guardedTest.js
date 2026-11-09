import { test as base, expect } from '@playwright/test';

export async function guardRequest(route, unexpected) {
  const request = route.request();
  const url = new URL(request.url());
  if (request.method() === 'GET' && url.href === 'https://accounts.google.com/gsi/client') {
    return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  }
  if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
  if (url.pathname.startsWith('/api/') || !['127.0.0.1', 'localhost'].includes(url.hostname)) {
    unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
    return route.abort('blockedbyclient');
  }
  return route.continue();
}

export const test = base.extend({
  page: async ({ page }, use) => {
    const unexpected = [];
    await page.route('**/*', (route) => guardRequest(route, unexpected));
    await use(page);
    expect(unexpected, 'Unexpected network requests must be explicitly mocked').toEqual([]);
  },
});
export { expect };
