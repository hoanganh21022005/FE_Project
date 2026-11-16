import { test, expect } from './helpers/guardedTest.js'
import { isApiMatch, loginAs, navigateTo, setupDefaultApiMocks } from './helpers/mockAuth.js'

const AUX_PATHS = [
  '/api/members',
  '/api/classes',
  '/api/evaluations',
  '/api/training-plans',
  '/api/advanced-registrations',
  '/api/attendances',
  '/api/invoices',
  '/api/bookings',
  '/api/enrollments',
]

test('AC6: PATCH 403 không có code (RESULT_CONTENT_DEADLINE_PASSED trong message) hiện câu hết hạn tiếng Việt và tải lại danh sách', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-16T14:00:00+07:00') })
  const sessions = [
    {
      id: 101,
      classId: 11,
      className: 'Cầu lông Sáng',
      coachId: 2,
      sessionDate: '2026-11-16',
      startTime: '09:00:00',
      endTime: '11:00:00',
      status: 'Completed',
    },
  ]
  const results = [
    {
      resultId: 501,
      sessionId: 101,
      sessionDate: '2026-11-16',
      classId: 11,
      className: 'Cầu lông Sáng',
      memberId: 101,
      memberName: 'Nguyễn Minh Anh',
      coachId: 2,
      content: 'Nhận xét ban đầu',
      attendanceStatus: 'Present',
    },
  ]
  let getResultsCalls = 0

  await setupDefaultApiMocks(page, AUX_PATHS)
  await page.route((url) => isApiMatch(url, 'sessions'), (route) =>
    route.fulfill({ status: 200, json: sessions }),
  )
  await page.route((url) => isApiMatch(url, 'training-results'), async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    if (req.method() === 'GET' && path === '/api/training-results') {
      getResultsCalls += 1
      return route.fulfill({ status: 200, json: results })
    }
    if (req.method() === 'PATCH' && path === '/api/training-results/501/content') {
      return route.fulfill({
        status: 403,
        json: {
          timestamp: '2026-11-16T07:00:00Z',
          status: 403,
          error: 'Forbidden',
          message: 'RESULT_CONTENT_DEADLINE_PASSED: Đã hết hạn sửa nhận xét buổi học của Coach.',
        },
      })
    }
    return route.fulfill({ status: 404, json: { code: 'NOT_FOUND' } })
  })

  await loginAs(page, 'coach')
  await navigateTo(page, '/coach/progress')
  await page.getByRole('tab', { name: /Nhật ký buổi tập/ }).click()
  await expect(page.getByText('Nhận xét ban đầu')).toBeVisible()

  const beforeCalls = getResultsCalls
  await page.getByRole('button', { name: 'Sửa nhận xét' }).click()
  await page.locator('#edit-result-content-501').fill('Nội dung mới sau hạn')
  await page.getByRole('button', { name: 'Lưu' }).click()

  await expect(page.getByRole('alert')).toContainText('Đã hết hạn sửa nhận xét')
  await expect(page.getByRole('alert')).not.toContainText('RESULT_CONTENT_DEADLINE_PASSED')
  await expect(page.getByRole('alert')).not.toContainText('Bạn không có quyền sửa nhận xét này')
  await expect.poll(() => getResultsCalls).toBeGreaterThan(beforeCalls)
})
