import { test, expect } from './helpers/guardedTest.js'
import { isApiMatch, loginAs, navigateTo, setupDefaultApiMocks } from './helpers/mockAuth.js'
import { mockUsers } from './helpers/mockData.js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function loginAsReceptionist(page, overrides = {}) {
  const user = {
    ...mockUsers.receptionist,
    userId: mockUsers.receptionist.id,
    ...overrides,
  }
  let loggedIn = false

  await page.route((url) => isApiMatch(url, 'auth/me'), async (route) => {
    if (loggedIn) {
      return route.fulfill({ status: 200, json: user })
    }
    return route.fulfill({ status: 401, json: { message: 'Unauthenticated' } })
  })

  await page.route((url) => isApiMatch(url, 'auth/login'), async (route) => {
    loggedIn = true
    return route.fulfill({ status: 200, json: user })
  })

  await page.goto('/login')
  await page.locator('#login-email').fill(user.email)
  await page.locator('#login-password').fill('Password123')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/receptionist/, { timeout: 10000 })
}

function makeRefundFixtures() {
  return [
    {
      id: 101,
      invoiceId: 5001,
      classId: 12,
      memberId: 44,
      origin: 'NormalClassCancellation',
      status: 'Approved',
      amount: 650000,
      version: 3,
      receiverId: 70,
      bank: 'Vietcombank',
      accountNumber: '0011009988776',
      accountName: 'NGUYEN VAN AN',
      receiverVerified: true,
      dueAt: '2026-11-10T10:00:00Z',
      firstDueAt: '2026-11-10T10:00:00Z',
      overdue: true,
      issueNote: 'Khách cần chuyển trước cuối tuần',
      contactPhone: '0901234567',
      attempts: [],
    },
    {
      id: 102,
      invoiceId: 5002,
      classId: 13,
      memberId: 45,
      origin: 'NormalClassCancellation',
      status: 'Processing',
      amount: 500000,
      version: 4,
      receiverId: 71,
      bank: 'Techcombank',
      accountNumber: '1903344556677',
      accountName: 'TRAN THI BINH',
      receiverVerified: true,
      dueAt: '2026-11-25T10:00:00Z',
      firstDueAt: '2026-11-25T10:00:00Z',
      overdue: false,
      issueNote: null,
      contactPhone: '0912345678',
      attempts: [
        {
          id: 202,
          status: 'Claimed',
          receiverId: 71,
          amount: 500000,
          currency: 'VND',
          bankReference: null,
          performedAt: null,
          claimedBy: 5,
          verifiedAt: null,
          documentIds: [],
        },
      ],
    },
    {
      id: 103,
      invoiceId: 5003,
      classId: 14,
      memberId: 46,
      origin: 'NormalClassCancellation',
      status: 'Processing',
      amount: 300000,
      version: 2,
      receiverId: 72,
      bank: 'ACB',
      accountNumber: '8877665544',
      accountName: 'LE VAN CUONG',
      receiverVerified: true,
      dueAt: '2026-11-26T10:00:00Z',
      firstDueAt: '2026-11-26T10:00:00Z',
      overdue: false,
      issueNote: null,
      contactPhone: '0922334455',
      attempts: [
        {
          id: 203,
          status: 'Claimed',
          receiverId: 72,
          amount: 300000,
          currency: 'VND',
          bankReference: null,
          performedAt: null,
          claimedBy: 99,
          verifiedAt: null,
          documentIds: [],
        },
      ],
    },
    {
      id: 104,
      invoiceId: 5004,
      classId: 15,
      memberId: 47,
      origin: 'NormalClassCancellation',
      status: 'AwaitingVerification',
      amount: 420000,
      version: 5,
      receiverId: 73,
      bank: 'BIDV',
      accountNumber: '3141000222333',
      accountName: 'PHAM THI DUNG',
      receiverVerified: true,
      dueAt: '2026-11-28T10:00:00Z',
      firstDueAt: '2026-11-28T10:00:00Z',
      overdue: false,
      issueNote: null,
      contactPhone: '0933445566',
      attempts: [
        {
          id: 204,
          status: 'Submitted',
          receiverId: 73,
          amount: 420000,
          currency: 'VND',
          bankReference: 'FT-DONE-104',
          performedAt: '2026-11-16T09:30:00',
          claimedBy: 5,
          verifiedAt: null,
          documentIds: [801],
        },
      ],
    },
    {
      id: 105,
      invoiceId: 5005,
      classId: 16,
      memberId: 48,
      origin: 'NormalClassCancellation',
      status: 'NeedsReview',
      amount: 250000,
      version: 6,
      receiverId: 74,
      bank: 'MBBank',
      accountNumber: '0988776655',
      accountName: 'HOANG VAN EM',
      receiverVerified: true,
      dueAt: '2026-11-29T10:00:00Z',
      firstDueAt: '2026-11-29T10:00:00Z',
      overdue: false,
      issueNote: 'Chờ đối chiếu lại sao kê',
      contactPhone: '0944556677',
      attempts: [
        {
          id: 205,
          status: 'Failed',
          receiverId: 74,
          amount: 250000,
          currency: 'VND',
          bankReference: 'FT-ERR-105',
          performedAt: '2026-11-15T14:00:00',
          claimedBy: 5,
          verifiedAt: null,
          documentIds: [802],
        },
      ],
    },
    {
      id: 106,
      invoiceId: 5006,
      classId: 17,
      memberId: 49,
      origin: 'NormalClassCancellation',
      status: 'Completed',
      amount: 600000,
      version: 7,
      receiverId: 75,
      bank: 'TPBank',
      accountNumber: '000012345678',
      accountName: 'VU THI PHUONG',
      receiverVerified: true,
      dueAt: '2026-11-30T10:00:00Z',
      firstDueAt: '2026-11-30T10:00:00Z',
      overdue: false,
      issueNote: null,
      contactPhone: '0955667788',
      attempts: [
        {
          id: 206,
          status: 'Verified',
          receiverId: 75,
          amount: 600000,
          currency: 'VND',
          bankReference: 'FT-OK-106',
          performedAt: '2026-11-14T16:15:00',
          claimedBy: 5,
          verifiedAt: '2026-11-15T08:00:00Z',
          documentIds: [803],
        },
      ],
    },
  ]
}

const AUX_PATHS = [
  '/api/members',
  '/api/classes',
  '/api/attendances',
  '/api/invoices',
  '/api/bookings',
  '/api/enrollments',
]

test.describe('W-B1r: Màn Việc hoàn tiền cho Lễ tân', () => {
  test('AC1: Sidebar Lễ tân có Việc hoàn tiền; vai trò khác không thấy và bị chặn route', async ({ page }) => {
    await setupDefaultApiMocks(page, AUX_PATHS)
    await loginAsReceptionist(page)

    const navBtn = page.locator('aside nav button', { hasText: 'Việc hoàn tiền' }).first()
    await expect(navBtn).toBeVisible()
    await navBtn.click()
    await expect(page).toHaveURL(/\/receptionist\/refund-work/)
    await expect(page.getByRole('heading', { name: 'Việc hoàn tiền' })).toBeVisible()

    for (const roleKey of ['manager', 'member', 'coach']) {
      await loginAs(page, roleKey)
      await expect(page.locator('aside nav button', { hasText: 'Việc hoàn tiền' })).toHaveCount(0)
      await navigateTo(page, '/receptionist/refund-work')
      await expect(page.getByRole('heading', { name: 'Việc hoàn tiền' })).toHaveCount(0)
      await expect(page.getByText(/403|Truy cập bị từ chối|không có quyền/i).first()).toBeVisible()
    }
  })

  test('AC2 & AC3: Danh sách theo trạng thái, nhãn Quá hạn, số TK đầy đủ và giữ requestId UUID khi retry claim', async ({ page }) => {
    let refunds = makeRefundFixtures()
    const claimRequests = []
    let failFirstClaim = true

    await setupDefaultApiMocks(page, AUX_PATHS)
    await page.route('**/api/normal-refunds**', async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (request.method() === 'GET' && path === '/api/normal-refunds') {
        return route.fulfill({ status: 200, json: refunds })
      }
      if (request.method() === 'POST' && path === '/api/normal-refunds/101/claim') {
        const body = request.postDataJSON()
        claimRequests.push(body)
        if (failFirstClaim) {
          failFirstClaim = false
          return route.abort('failed')
        }
        const newAttempt = {
          id: 201,
          status: 'Claimed',
          receiverId: 70,
          amount: 650000,
          currency: 'VND',
          bankReference: null,
          performedAt: null,
          claimedBy: 5,
          verifiedAt: null,
          documentIds: [],
        }
        refunds = refunds.map((item) =>
          item.id === 101
            ? { ...item, status: 'Processing', version: 4, attempts: [newAttempt] }
            : item,
        )
        return route.fulfill({ status: 200, json: newAttempt })
      }
      return route.fulfill({ status: 404, json: { code: 'NOT_FOUND' } })
    })

    await loginAsReceptionist(page)
    await navigateTo(page, '/receptionist/refund-work')

    await expect(page.getByRole('tab', { name: /Chờ nhận\s*1/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Đang xử lý\s*2/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Chờ đối soát\s*1/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Cần xem lại\s*1/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Đã xong\s*1/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Tất cả\s*6/ })).toBeVisible()

    await expect(page.getByText('Quá hạn')).toBeVisible()
    await expect(page.getByText('0011009988776')).toBeVisible()

    await page.getByRole('button', { name: 'Nhận việc' }).click()
    await expect.poll(() => claimRequests.length).toBe(1)
    await expect(page.getByRole('alert')).toBeVisible()

    await page.getByRole('button', { name: 'Nhận việc' }).click()
    await expect.poll(() => claimRequests.length).toBe(2)

    expect(claimRequests[0].version).toBe(3)
    expect(claimRequests[0].requestId).toMatch(UUID_REGEX)
    expect(claimRequests[1].requestId).toBe(claimRequests[0].requestId)
    await expect(page.getByRole('tab', { name: /Chờ nhận\s*0/ })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Đang xử lý\s*3/ })).toBeVisible()
  })

  test('AC4, AC5 & AC6: Chặn tệp/thiếu chứng từ/thiếu tham chiếu trước khi gửi; tải chứng từ multipart; nộp kết quả; trạng thái chỉ xem', async ({ page }) => {
    let refunds = makeRefundFixtures()
    const uploadRequests = []
    const submitRequests = []

    await setupDefaultApiMocks(page, AUX_PATHS)
    await page.route('**/api/normal-refunds**', async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (request.method() === 'GET' && path === '/api/normal-refunds') {
        return route.fulfill({ status: 200, json: refunds })
      }
      if (request.method() === 'POST' && path === '/api/normal-refunds/102/attempts/202/documents') {
        uploadRequests.push({
          path,
          contentType: request.headers()['content-type'] || '',
          bodyText: request.postData() || '',
        })
        refunds = refunds.map((item) =>
          item.id === 102
            ? {
                ...item,
                attempts: [{ ...item.attempts[0], documentIds: [901] }],
              }
            : item,
        )
        return route.fulfill({ status: 200, json: 901 })
      }
      if (request.method() === 'POST' && path === '/api/normal-refunds/102/attempts/202/submit') {
        const body = request.postDataJSON()
        submitRequests.push({ path, body })
        const updatedAttempt = {
          ...refunds.find((r) => r.id === 102).attempts[0],
          status: 'Submitted',
          bankReference: body.reference,
          performedAt: body.performedAt,
          documentIds: [901],
        }
        refunds = refunds.map((item) =>
          item.id === 102
            ? { ...item, status: 'AwaitingVerification', version: 5, attempts: [updatedAttempt] }
            : item,
        )
        return route.fulfill({ status: 200, json: updatedAttempt })
      }
      return route.fulfill({ status: 404, json: { code: 'NOT_FOUND' } })
    })

    await loginAsReceptionist(page)
    await navigateTo(page, '/receptionist/refund-work')

    await page.getByRole('tab', { name: /Đang xử lý/ }).click()
    await expect(page.getByText('Đã được nhận bởi nhân viên khác')).toBeVisible()

    await page.getByRole('button', { name: 'Nộp kết quả chuyển khoản' }).click()
    expect(submitRequests.length).toBe(0)
    await expect(page.getByRole('alert')).toContainText('chứng từ')

    const fileInput = page.locator('#doc-upload-102-202')
    await fileInput.setInputFiles({
      name: 'bad.gif',
      mimeType: 'image/gif',
      buffer: Buffer.from('GIF89a'),
    })
    expect(uploadRequests.length).toBe(0)
    await expect(page.getByRole('alert')).toContainText('PNG, JPEG hoặc PDF')

    await fileInput.setInputFiles({
      name: 'empty.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.alloc(0),
    })
    expect(uploadRequests.length).toBe(0)
    await expect(page.getByRole('alert')).toContainText('5 MiB')

    await fileInput.setInputFiles({
      name: 'huge.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 1),
    })
    expect(uploadRequests.length).toBe(0)
    await expect(page.getByRole('alert')).toContainText('5 MiB')

    await fileInput.setInputFiles({
      name: 'receipt.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-png-content'),
    })
    await expect.poll(() => uploadRequests.length).toBe(1)
    expect(uploadRequests[0].contentType).toContain('multipart/form-data')
    expect(uploadRequests[0].bodyText).toContain('name="file"')
    await expect(page.getByText(/Mã chứng từ #901/)).toBeVisible()

    await page.getByRole('button', { name: 'Nộp kết quả chuyển khoản' }).click()
    expect(submitRequests.length).toBe(0)
    await expect(page.getByRole('alert')).toContainText('tham chiếu')

    await page.locator('#ref-input-102-202').fill('FT26320112233')
    await expect(page.locator('#amount-input-102-202')).toHaveAttribute('readonly', '')
    await page.locator('#time-input-102-202').fill('2026-11-16T09:15')
    await page.getByRole('button', { name: 'Nộp kết quả chuyển khoản' }).click()

    await expect.poll(() => submitRequests.length).toBe(1)
    expect(submitRequests[0].body).toEqual({
      reference: 'FT26320112233',
      amount: 500000,
      currency: 'VND',
      performedAt: '2026-11-16T09:15:00',
    })
    expect(submitRequests[0].body.performedAt).not.toMatch(/[Z+]/)

    await page.getByRole('tab', { name: /Chờ đối soát/ }).click()
    await expect(page.getByText('Đang chờ Manager đối soát').first()).toBeVisible()

    await page.getByRole('tab', { name: /Cần xem lại/ }).click()
    await expect(page.getByText('Cần xem lại').last()).toBeVisible()

    await page.getByRole('tab', { name: /Đã xong/ }).click()
    await expect(page.getByText('Hoàn tất')).toBeVisible()
  })

  test('AC7: Lỗi Backend hiển thị tiếng Việt, không in mã thô và reload khi REFUND_VERSION_STALE', async ({ page }) => {
    const refunds = makeRefundFixtures()
    let getListCount = 0
    let submitMode = 'AMOUNT_MISMATCH'

    await setupDefaultApiMocks(page, AUX_PATHS)
    await page.route('**/api/normal-refunds**', async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (request.method() === 'GET' && path === '/api/normal-refunds') {
        getListCount += 1
        return route.fulfill({ status: 200, json: refunds })
      }
      if (request.method() === 'POST' && path === '/api/normal-refunds/101/claim') {
        return route.fulfill({ status: 409, json: { code: 'REFUND_VERSION_STALE' } })
      }
      if (request.method() === 'POST' && path === '/api/normal-refunds/102/attempts/202/documents') {
        return route.fulfill({ status: 200, json: 901 })
      }
      if (request.method() === 'POST' && path === '/api/normal-refunds/102/attempts/202/submit') {
        if (submitMode === 'AMOUNT_MISMATCH') {
          return route.fulfill({ status: 400, json: { code: 'REFUND_AMOUNT_MISMATCH' } })
        }
        if (submitMode === 'REF_REUSED') {
          return route.fulfill({ status: 409, json: { code: 'BANK_REFERENCE_REUSED' } })
        }
        return route.fulfill({ status: 403, json: { code: 'FORBIDDEN' } })
      }
      return route.fulfill({ status: 404, json: { code: 'NOT_FOUND' } })
    })

    await loginAsReceptionist(page)
    await navigateTo(page, '/receptionist/refund-work')
    await expect(page.getByRole('heading', { name: 'Việc hoàn tiền' })).toBeVisible()
    const beforeClaimCount = getListCount

    await page.getByRole('button', { name: 'Nhận việc' }).click()
    await expect.poll(() => getListCount).toBeGreaterThan(beforeClaimCount)
    await expect(page.getByRole('alert')).toContainText('Hồ sơ đã thay đổi')
    await expect(page.getByRole('alert')).not.toContainText('REFUND_VERSION_STALE')

    await page.getByRole('tab', { name: /Đang xử lý/ }).click()
    await page.locator('#doc-upload-102-202').setInputFiles({
      name: 'doc.png',
      mimeType: 'image/png',
      buffer: Buffer.from('png'),
    })
    await page.locator('#ref-input-102-202').fill('FT-TEST-1')
    await page.locator('#time-input-102-202').fill('2026-11-16T09:15')

    await page.getByRole('button', { name: 'Nộp kết quả chuyển khoản' }).click()
    await expect(page.getByRole('alert')).toContainText('Số tiền nộp không khớp')
    await expect(page.getByRole('alert')).not.toContainText('REFUND_AMOUNT_MISMATCH')

    submitMode = 'REF_REUSED'
    await page.getByRole('button', { name: 'Nộp kết quả chuyển khoản' }).click()
    await expect(page.getByRole('alert')).toContainText('Mã tham chiếu ngân hàng đã được dùng')
    await expect(page.getByRole('alert')).not.toContainText('BANK_REFERENCE_REUSED')

    submitMode = 'FORBIDDEN'
    await page.getByRole('button', { name: 'Nộp kết quả chuyển khoản' }).click()
    await expect(page.getByText('Bạn không có quyền xử lý hoàn tiền')).toBeVisible()
  })

  test('AC8: Phân biệt rõ trạng thái trống, lỗi + Thử lại, và 403 không có quyền', async ({ page }) => {
    let mode = 'ERROR'
    await setupDefaultApiMocks(page, AUX_PATHS)
    await page.route('**/api/normal-refunds', async (route) => {
      if (mode === 'ERROR') {
        return route.fulfill({ status: 500, json: { message: 'Server error' } })
      }
      if (mode === 'FORBIDDEN') {
        return route.fulfill({ status: 403, json: { message: 'Forbidden' } })
      }
      return route.fulfill({ status: 200, json: [] })
    })

    await loginAsReceptionist(page)
    await navigateTo(page, '/receptionist/refund-work')

    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible()
    await expect(page.getByText('Không có việc hoàn tiền nào')).toHaveCount(0)

    mode = 'EMPTY'
    await page.getByRole('button', { name: 'Thử lại' }).click()
    await expect(page.getByText('Không có việc hoàn tiền nào')).toBeVisible()

    mode = 'FORBIDDEN'
    await page.getByRole('button', { name: 'Tải lại' }).click()
    await expect(page.getByText('Bạn không có quyền xử lý hoàn tiền')).toBeVisible()
    await expect(page.getByText('Không có việc hoàn tiền nào')).toHaveCount(0)
  })

  test('AC9: Mobile 375x667 không tràn ngang và mọi nút/ô nhập >= 44px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    const refunds = makeRefundFixtures()
    await setupDefaultApiMocks(page, AUX_PATHS)
    await page.route('**/api/normal-refunds', async (route) => {
      return route.fulfill({ status: 200, json: refunds })
    })

    await loginAsReceptionist(page)
    await navigateTo(page, '/receptionist/refund-work')

    await page.getByRole('tab', { name: /Đang xử lý/ }).click()
    await expect(page.locator('#ref-input-102-202')).toBeVisible()

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth
    })
    expect(overflow).toBe(false)

    const controls = page.locator('main section button:visible, main section input:not([type="file"]):visible, main section label[for^="doc-upload-"]:visible')
    const count = await controls.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      const box = await controls.nth(i).boundingBox()
      expect(box).not.toBeNull()
      const html = await controls.nth(i).evaluate((el) => el.outerHTML.slice(0, 120))
      expect(box.height, html).toBeGreaterThanOrEqual(44)
    }
  })
})
