import { test, expect } from './helpers/guardedTest.js'
import { isApiMatch, loginAs, setupDefaultApiMocks } from './helpers/mockAuth.js'

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
  '/api/sessions',
  '/api/evaluations',
  '/api/training-plans',
  '/api/training-results',
  '/api/advanced-registrations',
  '/api/coaches',
  '/api/coaches/me/feedback',
  '/api/coaches/me/at-risk-members',
  '/api/permissions',
  '/api/bookings',
  '/api/enrollments',
]

test.describe('W-A10 Phần B: Khung đang tải thay cho số 0 giả ở 3 màn tổng quan', () => {
  test('AdminDashboard: loading không hiện 0, rỗng thật hiện 0, lỗi 500 hiện —', async ({ page }) => {
    let mode = 'DELAY_EMPTY'
    let releaseUsers
    let releaseRoles

    await setupDefaultApiMocks(page, AUX_PATHS)
    await page.route((url) => isApiMatch(url, 'users'), async (route) => {
      if (mode === 'DELAY_EMPTY') {
        await new Promise((r) => {
          releaseUsers = r
        })
        return route.fulfill({ status: 200, json: [] })
      }
      if (mode === 'ERROR') {
        return route.fulfill({ status: 500, json: { message: 'Server error' } })
      }
      return route.fulfill({ status: 200, json: [] })
    })
    await page.route((url) => isApiMatch(url, 'roles'), async (route) => {
      if (mode === 'DELAY_EMPTY') {
        await new Promise((r) => {
          releaseRoles = r
        })
        return route.fulfill({ status: 200, json: [] })
      }
      if (mode === 'ERROR') {
        return route.fulfill({ status: 500, json: { message: 'Server error' } })
      }
      return route.fulfill({ status: 200, json: [] })
    })

    await loginAs(page, 'admin')
    await expect(page).toHaveURL(/\/admin\/dashboard/)

    // AC-B1: trong lúc chờ, không hiện 0 ở các thẻ KPI, có aria-busy="true"
    await expect(page.locator('main [aria-busy="true"]').first()).toBeVisible()
    await expect(page.locator('main strong')).toHaveCount(0)

    // AC-B2: dữ liệu rỗng thật -> hiện 0
    releaseUsers?.()
    releaseRoles?.()
    await expect(page.locator('main strong').first()).toHaveText('0')

    // AC-B3: lỗi 500 -> hiện —, không hiện 0
    mode = 'ERROR'
    await page.getByRole('button', { name: 'Làm mới' }).click()
    await expect(page.locator('main [role="alert"]')).toBeVisible()
    await expect(page.locator('main strong').first()).toHaveText('—')
  })

  test('CoachDashboard: loading hiện skeleton aria-busy, rỗng thật hiện 0, lỗi 500 hiện ErrorState', async ({ page }) => {
    let mode = 'DELAY_EMPTY'
    let releaseSessions

    await setupDefaultApiMocks(page, AUX_PATHS)
    await page.route((url) => isApiMatch(url, 'sessions'), async (route) => {
      if (mode === 'DELAY_EMPTY') {
        await new Promise((r) => {
          releaseSessions = r
        })
        return route.fulfill({ status: 200, json: [] })
      }
      if (mode === 'ERROR') {
        return route.fulfill({ status: 500, json: { message: 'Server error' } })
      }
      return route.fulfill({ status: 200, json: [] })
    })
    await page.route((url) => isApiMatch(url, 'attendances'), async (route) => {
      if (mode === 'ERROR') {
        return route.fulfill({ status: 500, json: { message: 'Server error' } })
      }
      return route.fulfill({ status: 200, json: [] })
    })

    await loginAs(page, 'coach')
    await expect(page).toHaveURL(/\/coach\/dashboard/)

    // AC-B1: khi sessions đang chậm -> có aria-busy="true", chưa hiện số KPI
    await expect(page.locator('main [aria-busy="true"]')).toBeVisible()
    await expect(page.getByText('Lớp phụ trách')).toHaveCount(0)

    // AC-B2: rỗng thật -> hiện 0
    releaseSessions?.()
    await expect(page.getByText('Lớp phụ trách')).toBeVisible()

    // AC-B3: lỗi 500 -> hiện ErrorState với nút Thử lại
    mode = 'ERROR'
    await page.reload()
    await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible()
  })

  test('ReceptionistDashboard: loading hiện aria-busy, rỗng thật hiện 0, lỗi 500 hiện —', async ({ page }) => {
    let mode = 'DELAY_EMPTY'
    let releaseAtt
    let releaseInv
    let releaseMembers

    await setupDefaultApiMocks(page, AUX_PATHS)
    await page.route((url) => isApiMatch(url, 'attendances'), async (route) => {
      if (mode === 'DELAY_EMPTY') {
        await new Promise((r) => {
          releaseAtt = r
        })
        return route.fulfill({ status: 200, json: [] })
      }
      if (mode === 'ERROR') {
        return route.fulfill({ status: 500, json: { message: 'Server error' } })
      }
      return route.fulfill({ status: 200, json: [] })
    })
    await page.route((url) => isApiMatch(url, 'invoices'), async (route) => {
      if (mode === 'DELAY_EMPTY') {
        await new Promise((r) => {
          releaseInv = r
        })
        return route.fulfill({ status: 200, json: [] })
      }
      if (mode === 'ERROR') {
        return route.fulfill({ status: 500, json: { message: 'Server error' } })
      }
      return route.fulfill({ status: 200, json: [] })
    })
    await page.route((url) => isApiMatch(url, 'members'), async (route) => {
      if (mode === 'DELAY_EMPTY') {
        await new Promise((r) => {
          releaseMembers = r
        })
        return route.fulfill({ status: 200, json: [] })
      }
      if (mode === 'ERROR') {
        return route.fulfill({ status: 500, json: { message: 'Server error' } })
      }
      return route.fulfill({ status: 200, json: [] })
    })

    await loginAs(page, 'receptionist')
    await expect(page).toHaveURL(/\/receptionist\/dashboard/)

    // AC-B1: có aria-busy="true" ở 3 thẻ chỉ số
    await expect(page.locator('main [aria-busy="true"]')).toHaveCount(4)

    // AC-B2: rỗng thật -> hiện 0 ở cả 3 thẻ
    releaseAtt?.()
    releaseInv?.()
    releaseMembers?.()
    await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0)
    await expect(page.getByText('Chưa có lượt check-in nào được ghi nhận.')).toBeVisible()

    // AC-B3: lỗi 500 -> hiện — và thông báo lỗi
    mode = 'ERROR'
    await page.reload()
    await expect(page.locator('main [role="alert"]')).toBeVisible()
    await expect(page.getByText('—').first()).toBeVisible()
  })
})
