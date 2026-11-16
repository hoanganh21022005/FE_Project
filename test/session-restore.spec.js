import { test, expect } from './helpers/guardedTest.js'
import { isApiMatch, setupDefaultApiMocks } from './helpers/mockAuth.js'
import { mockUsers } from './helpers/mockData.js'

const AUX_PATHS = [
  '/api/members',
  '/api/classes',
  '/api/staff',
  '/api/subjects',
  '/api/rooms',
  '/api/packages',
  '/api/notifications',
  '/api/notifications/me',
  '/api/audit-logs',
  '/api/attendances',
  '/api/invoices',
  '/api/reports/dashboard',
  '/api/reports/revenue',
  '/api/sessions',
  '/api/bookings',
  '/api/enrollments',
]

test.describe('W-A10 Phần C: Kiểm phiên đăng nhập chịu lỗi mạng khi khởi động', () => {
  test('AC-C1: auth/me trả 401 -> vào trang đăng nhập ngay và chỉ gọi 1 lần', async ({ page }) => {
    let calls = 0
    await setupDefaultApiMocks(page, AUX_PATHS)
    await page.route((url) => isApiMatch(url, 'auth/me'), async (route) => {
      calls += 1
      return route.fulfill({ status: 401, json: { message: 'Unauthenticated' } })
    })

    await page.goto('/login')
    await expect(page.locator('#login-email')).toBeVisible()
    // Trong React StrictMode dev, mount -> cleanup -> mount gọi tối đa 2 lần, không retry sau 401
    expect(calls).toBeGreaterThanOrEqual(1)
    expect(calls).toBeLessThanOrEqual(2)
  })

  test('AC-C2: auth/me lỗi mạng 2 lần rồi 200 -> retry 3 lần và vào thẳng portal, không hiện login', async ({ page }) => {
    await page.clock.install()
    let calls = 0
    let sawLoginForm = false

    await setupDefaultApiMocks(page, AUX_PATHS)
    await page.route((url) => isApiMatch(url, 'auth/me'), async (route) => {
      calls += 1
      if (calls <= 2) {
        return route.abort('failed')
      }
      return route.fulfill({ status: 200, json: mockUsers.manager })
    })

    await page.goto('/manager/dashboard')
    if (await page.locator('#login-email').isVisible().catch(() => false)) {
      sawLoginForm = true
    }

    await page.clock.fastForward(2000)
    if (await page.locator('#login-email').isVisible().catch(() => false)) {
      sawLoginForm = true
    }

    await page.clock.fastForward(3500)
    await expect.poll(() => calls).toBe(3)
    await expect(page).toHaveURL(/\/manager\/dashboard/)
    await expect(page.getByText('Tổng quan').first()).toBeVisible()
    expect(sawLoginForm).toBe(false)
  })

  test('AC-C3: auth/me trả 503 2 lần rồi 200 -> retry 3 lần và vào thẳng portal', async ({ page }) => {
    await page.clock.install()
    let calls = 0

    await setupDefaultApiMocks(page, AUX_PATHS)
    await page.route((url) => isApiMatch(url, 'auth/me'), async (route) => {
      calls += 1
      if (calls <= 2) {
        return route.fulfill({ status: 503, json: { message: 'Service Unavailable' } })
      }
      return route.fulfill({ status: 200, json: mockUsers.manager })
    })

    await page.goto('/manager/dashboard')
    await page.clock.fastForward(2000)
    await page.clock.fastForward(3500)
    await expect.poll(() => calls).toBe(3)
    await expect(page).toHaveURL(/\/manager\/dashboard/)
    await expect(page.getByText('Tổng quan').first()).toBeVisible()
  })

  test('AC-C4: auth/me phản hồi sau 7 giây -> vẫn giữ loading, không bị đẩy ra đăng nhập', async ({ page }) => {
    await page.clock.install()
    let releaseMe

    await setupDefaultApiMocks(page, AUX_PATHS)
    await page.route((url) => isApiMatch(url, 'auth/me'), async (route) => {
      await new Promise((resolve) => {
        releaseMe = resolve
      })
      return route.fulfill({ status: 200, json: mockUsers.manager })
    })

    await page.goto('/manager/dashboard')
    await page.clock.runFor(6500)
    await expect(page.getByText(/Đang kiểm tra phiên đăng nhập/)).toBeVisible()
    await expect(page.locator('#login-email')).toHaveCount(0)

    releaseMe()
    await expect(page).toHaveURL(/\/manager\/dashboard/)
    await expect(page.getByText('Tổng quan').first()).toBeVisible()
  })

  test('AC-C5: auth/me lỗi mạng liên tục -> hết lần thử, thoát loading và không tự điều hướng sang /login', async ({ page }) => {
    await page.clock.install()
    let calls = 0

    await setupDefaultApiMocks(page, AUX_PATHS)
    await page.route((url) => isApiMatch(url, 'auth/me'), async (route) => {
      calls += 1
      return route.abort('failed')
    })

    await page.goto('/')
    await expect.poll(() => calls).toBeGreaterThanOrEqual(1)

    for (const stepMs of [1600, 3100, 6100, 10100, 15100, 5000]) {
      const prev = calls
      await page.clock.fastForward(stepMs)
      if (stepMs !== 5000) {
        await expect.poll(() => calls).toBeGreaterThan(prev)
      }
    }

    await expect(page.getByText(/Đang kiểm tra phiên đăng nhập/)).toHaveCount(0)
    expect(calls).toBeGreaterThanOrEqual(6)
    expect(new URL(page.url()).pathname).toBe('/')
  })
})
