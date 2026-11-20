import { test, expect } from './helpers/guardedTest.js'
import { isApiMatch, loginAs, setupDefaultApiMocks } from './helpers/mockAuth.js'

const AUX_PATHS = [
  '/api/reports/revenue',
  '/api/reports/members',
  '/api/users',
  '/api/classes',
  '/api/members',
  '/api/invoices',
  '/api/permissions',
  '/api/bookings',
  '/api/enrollments',
  '/api/training-plans',
  '/api/training-results',
  '/api/evaluations',
  '/api/attendances',
]

test('Manager dashboard uses netReceived and shows unavailable values without gross fallback', async ({ page }) => {
  let dashboard = {
    totalUsers: 10,
    totalMembers: 20,
    totalClasses: 3,
    totalPackages: 4,
    totalRevenue: 118400000,
    netReceived: 100000000,
    totalInvoices: 5,
    activeSubscriptions: 6,
    todaySessions: 7,
  }

  await setupDefaultApiMocks(page, AUX_PATHS)
  await page.route((url) => isApiMatch(url, 'reports/dashboard'), async (route) =>
    route.fulfill({ status: 200, json: dashboard }),
  )
  await page.route((url) => isApiMatch(url, 'reports/revenue'), async (route) =>
    route.fulfill({
      status: 200,
      json: { totalRevenue: 1, totalTransactions: 1, timeline: [{ period: '2026-11-20', revenue: 1, count: 1 }] },
    }),
  )

  await loginAs(page, 'manager')
  const receivedCard = () => page.locator('article').filter({
    has: page.getByRole('heading', { name: /Tiền thực thu|Net received/ }),
  }).first()
  await expect(receivedCard()).toContainText(/100[.,]000[.,]000 (?:đ|VND)/)
  await expect(receivedCard()).not.toContainText(/118[.,]400[.,]000 (?:đ|VND)/)
  await expect(page.getByText(/Xu hướng doanh thu|Revenue trend/)).toBeVisible()

  dashboard = { ...dashboard, netReceived: 0 }
  await page.reload()
  await expect(receivedCard()).toContainText(/0 (?:đ|VND)/)

  dashboard = { ...dashboard, netReceived: null }
  await page.reload()
  await expect(receivedCard()).toContainText('—')
  await expect(receivedCard()).not.toContainText(/118[.,]400[.,]000 (?:đ|VND)/)

  const { netReceived: _omitted, ...withoutNetReceived } = dashboard
  dashboard = withoutNetReceived
  await page.reload()
  await expect(receivedCard()).toContainText('—')
  await expect(receivedCard()).not.toContainText(/118[.,]400[.,]000 (?:đ|VND)/)
})
