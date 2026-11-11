import { test, expect } from './helpers/guardedTest.js'
import { loginAs, navigateTo, setupDefaultApiMocks } from './helpers/mockAuth.js'

test('CM-FIX-16B manager review actions send contract bodies and reload Backend state', async ({ page }) => {
  let refund = {
    id: 31,
    invoiceId: 700,
    classId: 81,
    memberId: 9,
    origin: 'NormalClassCancellation',
    status: 'PendingReview',
    amount: 125000,
    version: 4,
    receiverId: 10,
    bank: 'Example Bank',
    accountNumber: 'SENSITIVE-12345',
    accountName: 'Member Example',
    receiverVerified: false,
    dueAt: '2026-12-01T04:00:00Z',
    firstDueAt: '2026-11-20T04:00:00Z',
    overdue: false,
    issueNote: null,
    centerId: 1,
    attempts: [{ id: 22, status: 'Submitted', receiverId: 10, amount: 125000, bankReference: 'BANK-REF-22', performedAt: '2026-11-10T04:00:00Z', claimedBy: 7, verifiedAt: null, documentIds: [] }],
  }
  const history = { receivers: [], verifications: [] }
  const posts = []

  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', json: [] })
    return route.fulfill({ status: 403, contentType: 'application/json', json: { code: 'UNEXPECTED_WRITE' } })
  })
  await setupDefaultApiMocks(page, ['/api/members', '/api/classes', '/api/normal-refunds'])
  await page.route('**/api/normal-refunds**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === 'GET' && path === '/api/normal-refunds') return route.fulfill({ status: 200, json: [refund] })
    if (request.method() === 'GET' && path === '/api/normal-refunds/31') return route.fulfill({ status: 200, json: refund })
    if (request.method() === 'GET' && path === '/api/normal-refunds/31/history') return route.fulfill({ status: 200, json: history })
    if (request.method() === 'POST') {
      const body = request.postDataJSON()
      posts.push({ path, body })
      refund = { ...refund, version: refund.version + 1 }
      if (path.endsWith('/verify-receiver')) refund.receiverVerified = true
      if (path.endsWith('/approve')) refund.status = 'Approved'
      if (path.endsWith('/attempts/22/verify')) history.verifications.push({ id: 90, attemptId: 22, verifiedBy: 4, verifiedAt: '2026-11-11T02:00:00Z', outcome: body.outcome, bankSource: body.bankSource, note: body.note })
      return route.fulfill({ status: 200, json: refund })
    }
    return route.fulfill({ status: 404, json: { code: 'NOT_FOUND' } })
  })

  page.on('dialog', (dialog) => dialog.accept())
  await loginAs(page, 'manager')
  await navigateTo(page, '/manager/normal-refunds')
  await expect(page.getByRole('heading', { name: 'Hoàn tiền Normal' })).toBeVisible()
  await expect(page.locator('table')).toContainText('125.000')
  await expect(page.locator('table')).toContainText('Chưa quá hạn')
  await page.getByRole('button', { name: 'Chi tiết' }).click()
  await expect(page.getByRole('dialog')).toContainText('•••• 2345')

  await page.getByRole('button', { name: 'Xác minh người nhận' }).click()
  await page.getByLabel(/Nguồn\/cách xác minh thực tế/).fill('Manager checked member account with the bank')
  await page.getByRole('button', { name: 'Xác nhận và gửi' }).click()
  await expect.poll(() => posts.length).toBe(1)
  expect(posts[0]).toEqual({ path: '/api/normal-refunds/31/verify-receiver', body: { version: 4, source: 'Manager checked member account with the bank' } })
  await expect(page.getByRole('button', { name: 'Phê duyệt hoàn tiền' })).toBeVisible()

  await page.getByRole('button', { name: 'Phê duyệt hoàn tiền' }).click()
  await page.getByRole('button', { name: 'Xác nhận và gửi' }).click()
  await expect.poll(() => posts.length).toBe(2)
  expect(posts[1]).toEqual({ path: '/api/normal-refunds/31/approve', body: { version: 5 } })
  await expect(page.getByRole('dialog')).toContainText('Approved')
  await expect(page.getByRole('dialog')).not.toContainText('Completed')

  await page.getByRole('button', { name: 'Yêu cầu bổ sung' }).click()
  await page.getByLabel(/Thông tin cần Member bổ sung/).fill('Please confirm the bank account holder name')
  await page.getByRole('button', { name: 'Xác nhận và gửi' }).click()
  await expect.poll(() => posts.length).toBe(3)
  expect(posts[2]).toEqual({ path: '/api/normal-refunds/31/request-information', body: { version: 6, note: 'Please confirm the bank account holder name' } })

  await page.getByRole('button', { name: 'Ghi nhận vấn đề' }).click()
  await page.getByLabel(/Mô tả vấn đề/).fill('The bank receiver details need review')
  await page.getByRole('button', { name: 'Xác nhận và gửi' }).click()
  await expect.poll(() => posts.length).toBe(4)
  expect(posts[3]).toEqual({ path: '/api/normal-refunds/31/issues', body: { version: 7, note: 'The bank receiver details need review' } })

  await page.getByRole('button', { name: 'Đối soát chuyển khoản' }).click()
  await page.getByLabel(/Lần chuyển khoản/).selectOption('22')
  await page.getByLabel(/Kết quả đối soát/).selectOption('Pending')
  await page.getByLabel(/Nguồn đối soát ngân hàng/).fill('Independent bank transfer status page')
  await page.getByLabel(/Ghi chú/).fill('Bank has not settled the transfer yet')
  await page.getByRole('button', { name: 'Xác nhận và gửi' }).click()
  await expect.poll(() => posts.length).toBe(5)
  expect(posts[4]).toEqual({ path: '/api/normal-refunds/31/attempts/22/verify', body: { version: 8, outcome: 'Pending', bankSource: 'Independent bank transfer status page', note: 'Bank has not settled the transfer yet' } })
  await expect(page.getByRole('dialog')).not.toContainText('Đã chuyển thành công')
})
