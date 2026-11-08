import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    const unexpected = [];
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
      if (url.pathname.startsWith('/api/') || !['127.0.0.1', 'localhost'].includes(url.hostname)) {
        unexpected.push(`${route.request().method()} ${url.origin}${url.pathname}`);
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    await use(page);
    expect(unexpected, 'Unexpected network requests must be explicitly mocked').toEqual([]);
  },
});
export { expect };
