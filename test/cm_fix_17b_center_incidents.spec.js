import { expect, test } from '@playwright/test'

const openPanel = async (page) => page.goto('/test/cm_fix_17b_center_incidents_harness.html')
const fixture = (page, expression) => page.evaluate((code) => Function(`return (${code})`)(), expression)

test('center incident list preserves BE values, separates session types, and handles list errors', async ({ page }) => {
  await openPanel(page)
  await expect(page.getByRole('heading', { name: 'Sự cố cấp trung tâm' })).toBeVisible()
  await expect(page.getByText(/Credit/i)).toHaveCount(0)
  await expect(page.getByText('Học viên bị ảnh hưởng').first()).toBeVisible()
  await expect(page.locator('article').nth(1)).toContainText('0')
  await expect(page.getByText(/Ch.+ph.+lo/i)).toBeVisible()
  await expect(page.getByText(/Advanced/).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tạo buổi bù Normal' })).toHaveCount(0)

  await page.evaluate(() => { window.__centerIncidentFixture.failList = true })
  await page.getByRole('button', { name: 'Tải lại' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Fixture denied' })).toBeVisible()
  await expect(page.getByText('Chưa có sự cố trung tâm.')).toHaveCount(0)
})

test('Manager manually confirms compensation, creates Normal makeup, and resolves through Backend', async ({ page }) => {
  await openPanel(page)
  const incident = page.locator('article').filter({ hasText: 'Sự cố #9' })

  await incident.getByRole('button', { name: 'Xác nhận buổi không tổ chức' }).click()
  const compensationDialog = page.getByRole('dialog')
  const confirmNotHeld = compensationDialog.getByRole('checkbox')
  await expect(confirmNotHeld).not.toBeChecked()
  const submitCompensation = compensationDialog.getByRole('button', { name: 'Gửi xác nhận' })
  await expect(submitCompensation).toBeDisabled()
  await compensationDialog.getByLabel('Lý do xác nhận').fill('Verified by center manager')
  await confirmNotHeld.check()
  await submitCompensation.click()

  await expect.poll(() => fixture(page, `window.__centerIncidentFixture.requests.filter((request) => request.path.endsWith('/compensate')).length`)).toBe(1)
  const compensationRequest = await fixture(page, `window.__centerIncidentFixture.requests.find((request) => request.path.endsWith('/compensate'))`)
  expect(compensationRequest.body).toEqual({ reason: 'Verified by center manager', verifiedNotHeld: true })
  await expect(page.locator('article').filter({ hasText: 'Sự cố #9' })).toContainText('Đã xác nhận bù')

  const makeup = page.locator('article').filter({ hasText: 'Sự cố #9' }).getByRole('button', { name: 'Tạo buổi bù Normal' })
  await expect(makeup).toBeVisible()
  await makeup.click()
  const makeupDialog = page.getByRole('dialog')
  await makeupDialog.getByLabel('Ngày').fill('2099-01-20')
  await makeupDialog.getByLabel('Giờ bắt đầu').fill('09:00')
  await makeupDialog.getByLabel('Giờ kết thúc').fill('10:30')
  await makeupDialog.getByLabel('Phòng').selectOption('2')
  await makeupDialog.getByLabel('Coach').selectOption('7')
  await makeupDialog.getByLabel('Lý do học bù').fill('Makeup after confirmed incident')
  await makeupDialog.getByRole('button', { name: 'Tạo buổi bù' }).click()

  await expect.poll(() => fixture(page, `window.__centerIncidentFixture.requests.filter((request) => request.path.endsWith('/normal-makeup')).length`)).toBe(1)
  const makeupRequest = await fixture(page, `window.__centerIncidentFixture.requests.find((request) => request.path.endsWith('/normal-makeup'))`)
  expect(makeupRequest.body).toEqual({
    date: '2099-01-20', startTime: '09:00:00', endTime: '10:30:00', roomId: 2, coachId: 7,
    reason: 'Makeup after confirmed incident',
  })
  await expect(page.locator('article').filter({ hasText: 'Sự cố #9' })).toContainText('Đã có buổi bù')

  await page.locator('article').filter({ hasText: 'Sự cố #9' }).getByRole('button', { name: 'Xác nhận khắc phục' }).click()
  const resolveDialog = page.getByRole('dialog')
  await resolveDialog.getByLabel('Thời điểm khắc phục (giờ Việt Nam)').fill(await fixture(page, 'window.__centerIncidentFixture.pastStart.slice(0, 16)'))
  await resolveDialog.getByRole('button', { name: 'Xác nhận khắc phục' }).click()
  await expect.poll(() => fixture(page, `window.__centerIncidentFixture.requests.filter((request) => request.path.endsWith('/resolve')).length`)).toBe(1)
  const resolveRequest = await fixture(page, `window.__centerIncidentFixture.requests.find((request) => request.path.endsWith('/resolve'))`)
  expect(resolveRequest.body.endedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
  const finalIncident = await fixture(page, `window.__centerIncidentFixture.incidents.find((item) => item.id === 9)`)
  expect(finalIncident.status).toBe('Resolved')
  expect(finalIncident.recoveredCredits).toBe(0)
})

test('open creates a hidden stable requestKey and a timeout requires a fresh list read without retry', async ({ page }) => {
  await openPanel(page)
  await page.getByRole('button', { name: 'Báo cáo sự cố mới' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Buổi học').selectOption('123')
  await dialog.getByLabel('Thời điểm bắt đầu (giờ Việt Nam)').fill(await fixture(page, 'window.__centerIncidentFixture.pastStart.slice(0, 16)'))
  await dialog.getByLabel('Lý do').fill('Court unavailable')
  await dialog.getByLabel('Bằng chứng').fill('Incident report IR-77')

  await page.evaluate(() => { window.__centerIncidentFixture.timeoutNextOpen = true })
  await dialog.getByRole('button', { name: 'Gửi mở sự cố' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Kết quả chưa chắc chắn' })).toBeVisible()
  await expect.poll(() => fixture(page, `window.__centerIncidentFixture.requests.filter((request) => request.method === 'POST' && request.path === '/api/center-incidents').length`)).toBe(1)
  const failedRequest = await fixture(page, `window.__centerIncidentFixture.requests.find((request) => request.method === 'POST' && request.path === '/api/center-incidents')`)
  expect(failedRequest.body.requestKey).toMatch(/^ci:[A-Za-z0-9-]+$/)
  await expect(dialog.getByLabel('requestKey')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Xác nhận khắc phục' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Kiểm tra lại' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Kết quả chưa chắc chắn' })).toHaveCount(0)
})

test('write controls require an active Center Manager with MANAGE_CLASSES and center scope', async ({ page }) => {
  await openPanel(page)
  await page.evaluate(() => window.__setCenterIncidentActor({
    id: 2, role: 'CenterManager', status: 'Inactive', authenticated: true, centerId: 1, authorities: ['MANAGE_CLASSES'],
  }))
  await expect(page.getByText(/Chế độ xem/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Báo cáo sự cố mới' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Xác nhận khắc phục' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Xác nhận buổi không tổ chức' })).toHaveCount(0)
})
