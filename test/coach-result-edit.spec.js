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

function makeFixtures() {
  const sessions = [
    {
      id: 101,
      classId: 11,
      className: 'Cầu lông Sáng (Hôm nay đã xong)',
      coachId: 2,
      sessionDate: '2026-11-16',
      startTime: '09:00:00',
      endTime: '11:00:00',
      status: 'Completed',
    },
    {
      id: 102,
      classId: 11,
      className: 'Cầu lông Hôm qua (Hết hạn)',
      coachId: 2,
      sessionDate: '2026-11-15',
      startTime: '15:00:00',
      endTime: '17:00:00',
      status: 'Completed',
    },
    {
      id: 103,
      classId: 11,
      className: 'Cầu lông Chiều (Chưa kết thúc)',
      coachId: 2,
      sessionDate: '2026-11-16',
      startTime: '14:30:00',
      endTime: '16:00:00',
      status: 'Scheduled',
    },
  ]

  const results = [
    {
      resultId: 501,
      sessionId: 101,
      sessionDate: '2026-11-16',
      classId: 11,
      className: 'Cầu lông Sáng (Hôm nay đã xong)',
      memberId: 101,
      memberName: 'Nguyễn Minh Anh',
      coachId: 2,
      content: 'Hoàn thành bài tập di chuyển',
      attendanceStatus: 'Present',
    },
    {
      resultId: 502,
      sessionId: 102,
      sessionDate: '2026-11-15',
      classId: 11,
      className: 'Cầu lông Hôm qua (Hết hạn)',
      memberId: 101,
      memberName: 'Nguyễn Minh Anh',
      coachId: 2,
      content: 'Buổi hôm qua đã quá hạn',
      attendanceStatus: 'Present',
    },
    {
      resultId: 503,
      sessionId: 103,
      sessionDate: '2026-11-16',
      classId: 11,
      className: 'Cầu lông Chiều (Chưa kết thúc)',
      memberId: 101,
      memberName: 'Nguyễn Minh Anh',
      coachId: 2,
      content: 'Buổi chiều chưa kết thúc',
      attendanceStatus: 'Present',
    },
  ]

  return { sessions, results }
}

async function openCoachLogsTab(page) {
  await loginAs(page, 'coach')
  await navigateTo(page, '/coach/progress')
  await page.getByRole('tab', { name: /Nhật ký buổi tập/ }).click()
  await expect(page.getByText('Hoàn thành bài tập di chuyển')).toBeVisible()
}

test.describe('W-B3: Coach sửa nội dung nhận xét kết quả sau buổi tập', () => {
  test('AC1, AC2 & AC3: Khung giờ sửa nhận xét, PATCH chỉ gửi { content } đã trim, chặn rỗng và không đổi', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-16T14:00:00+07:00') })
    const fixtures = makeFixtures()
    let results = fixtures.results
    const patchRequests = []

    await setupDefaultApiMocks(page, AUX_PATHS)
    await page.route((url) => isApiMatch(url, 'sessions'), async (route) => {
      return route.fulfill({ status: 200, json: fixtures.sessions })
    })
    await page.route((url) => isApiMatch(url, 'training-results'), async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (request.method() === 'GET' && path === '/api/training-results') {
        return route.fulfill({ status: 200, json: results })
      }
      if (request.method() === 'PATCH' && path === '/api/training-results/501/content') {
        const body = request.postDataJSON()
        patchRequests.push({ path, body })
        results = results.map((item) =>
          item.resultId === 501 ? { ...item, content: body.content } : item,
        )
        return route.fulfill({
          status: 200,
          json: results.find((item) => item.resultId === 501),
        })
      }
      return route.fulfill({ status: 404, json: { code: 'NOT_FOUND' } })
    })

    await openCoachLogsTab(page)

    // AC1: chỉ buổi #101 (hôm nay đã xong) có nút Sửa nhận xét; #102 hết hạn; #103 chưa đến lúc
    await expect(page.getByRole('button', { name: 'Sửa nhận xét' })).toHaveCount(1)
    await expect(page.getByText('Đã hết hạn sửa')).toBeVisible()
    await expect(page.getByText('Chưa đến lúc sửa')).toBeVisible()

    // AC3: không đổi -> đóng chế độ sửa, không gửi request
    await page.getByRole('button', { name: 'Sửa nhận xét' }).click()
    await page.getByRole('button', { name: 'Lưu' }).click()
    expect(patchRequests.length).toBe(0)
    await expect(page.locator('#edit-result-content-501')).toHaveCount(0)

    // AC3: lưu rỗng (chỉ khoảng trắng) -> báo lỗi tại chỗ, không gửi request
    await page.getByRole('button', { name: 'Sửa nhận xét' }).click()
    await page.locator('#edit-result-content-501').fill('   \n  ')
    await page.getByRole('button', { name: 'Lưu' }).click()
    expect(patchRequests.length).toBe(0)
    await expect(page.getByRole('alert')).toContainText('Nhận xét không được để trống')

    // AC2: lưu nội dung mới có khoảng trắng hai đầu -> gửi PATCH chỉ { content } đã trim
    await page.locator('#edit-result-content-501').fill('  Đánh cầu ổn định hơn nhiều  ')
    await page.getByRole('button', { name: 'Lưu' }).click()

    await expect.poll(() => patchRequests.length).toBe(1)
    expect(patchRequests[0]).toEqual({
      path: '/api/training-results/501/content',
      body: { content: 'Đánh cầu ổn định hơn nhiều' },
    })
    await expect(page.getByText('Đánh cầu ổn định hơn nhiều')).toBeVisible()
  })

  test('AC4: Lỗi RESULT_CONTENT_* hiển thị tiếng Việt, giữ nội dung đang gõ và tải lại khi hết hạn', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-16T14:00:00+07:00') })
    const fixtures = makeFixtures()
    let errorMode = 'NOT_OPEN'
    let getResultsCount = 0

    await setupDefaultApiMocks(page, AUX_PATHS)
    await page.route((url) => isApiMatch(url, 'sessions'), async (route) => {
      return route.fulfill({ status: 200, json: fixtures.sessions })
    })
    await page.route((url) => isApiMatch(url, 'training-results'), async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (request.method() === 'GET' && path === '/api/training-results') {
        getResultsCount += 1
        return route.fulfill({ status: 200, json: fixtures.results })
      }
      if (request.method() === 'PATCH' && path === '/api/training-results/501/content') {
        return route.fulfill({ status: 400, json: { code: `RESULT_CONTENT_${errorMode}` } })
      }
      return route.fulfill({ status: 404, json: { code: 'NOT_FOUND' } })
    })

    await openCoachLogsTab(page)
    await page.getByRole('button', { name: 'Sửa nhận xét' }).click()
    await page.locator('#edit-result-content-501').fill('Nội dung đang soạn dở')

    const beforeCount = getResultsCount
    await page.getByRole('button', { name: 'Lưu' }).click()
    await expect(page.getByRole('alert')).toContainText('Buổi tập chưa kết thúc')
    await expect(page.getByRole('alert')).not.toContainText('RESULT_CONTENT_NOT_OPEN')
    await expect(page.locator('#edit-result-content-501')).toHaveValue('Nội dung đang soạn dở')
    await expect.poll(() => getResultsCount).toBeGreaterThan(beforeCount)

    errorMode = 'FORBIDDEN'
    await page.getByRole('button', { name: 'Lưu' }).click()
    await expect(page.getByRole('alert')).toContainText('Chỉ huấn luyện viên được giao')
    await expect(page.getByRole('alert')).not.toContainText('RESULT_CONTENT_FORBIDDEN')

    errorMode = 'DEADLINE_PASSED'
    const countBeforeExpired = getResultsCount
    await page.getByRole('button', { name: 'Lưu' }).click()
    await expect(page.getByRole('alert')).toContainText('Đã hết hạn sửa nhận xét')
    await expect(page.getByRole('alert')).not.toContainText('RESULT_CONTENT_DEADLINE_PASSED')
    await expect(page.locator('#edit-result-content-501')).toHaveValue('Nội dung đang soạn dở')
    await expect.poll(() => getResultsCount).toBeGreaterThan(countBeforeExpired)
  })

  test('AC5 & AC6: Chống gửi đôi, Esc hủy, focus đúng khi mở/đóng, và mobile 375x667 >= 44px', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-16T14:00:00+07:00') })
    await page.setViewportSize({ width: 375, height: 667 })
    const fixtures = makeFixtures()
    let patchCount = 0
    let releasePatch

    await setupDefaultApiMocks(page, AUX_PATHS)
    await page.route((url) => isApiMatch(url, 'sessions'), async (route) => {
      return route.fulfill({ status: 200, json: fixtures.sessions })
    })
    await page.route((url) => isApiMatch(url, 'training-results'), async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (request.method() === 'GET' && path === '/api/training-results') {
        return route.fulfill({ status: 200, json: fixtures.results })
      }
      if (request.method() === 'PATCH' && path === '/api/training-results/501/content') {
        patchCount += 1
        await new Promise((resolve) => {
          releasePatch = resolve
        })
        return route.fulfill({
          status: 200,
          json: { ...fixtures.results[0], content: 'Cập nhật xong' },
        })
      }
      return route.fulfill({ status: 404, json: { code: 'NOT_FOUND' } })
    })

    await openCoachLogsTab(page)

    const editBtn = page.getByRole('button', { name: 'Sửa nhận xét' })
    expect((await editBtn.boundingBox()).height).toBeGreaterThanOrEqual(44)
    await editBtn.click()

    const textarea = page.locator('#edit-result-content-501')
    await expect(textarea).toBeFocused()
    expect((await textarea.boundingBox()).height).toBeGreaterThanOrEqual(44)
    expect((await page.getByRole('button', { name: 'Lưu' }).boundingBox()).height).toBeGreaterThanOrEqual(44)
    expect((await page.getByRole('button', { name: 'Hủy' }).boundingBox()).height).toBeGreaterThanOrEqual(44)

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)

    // Esc hủy sửa và trả focus về nút Sửa nhận xét
    await textarea.press('Escape')
    await expect(textarea).toHaveCount(0)
    await expect(editBtn).toBeFocused()

    // Bấm Lưu hai lần nhanh chỉ có 1 request
    await editBtn.click()
    await textarea.fill('Cập nhật xong')
    const saveBtn = page.getByRole('button', { name: 'Lưu' })
    await saveBtn.dblclick()
    await expect.poll(() => patchCount).toBe(1)
    expect(patchCount).toBe(1)

    releasePatch()
    await expect(textarea).toHaveCount(0)
  })
})
