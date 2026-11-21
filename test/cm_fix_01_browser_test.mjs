import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'
import { currentCalendarMonth, shiftCalendarMonth, vietnamDateKey } from '../src/components/classes/classCalendar.js'

const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer()
  server.on('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port
    server.close(() => resolve(port))
  })
})
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const vitePort = await freePort()
const failClosedPort = await freePort()
const debugPort = await freePort()
const server = await createServer({
  mode: 'development',
  server: { host: '127.0.0.1', port: vitePort, proxy: { '/api': `http://127.0.0.1:${failClosedPort}` } },
  define: {
    'import.meta.env.VITE_TEST_HARNESS': JSON.stringify('true'),
    'import.meta.env.VITE_API_ENABLED': JSON.stringify('true'),
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(''),
    'import.meta.env.VITE_API_PROXY_TARGET': JSON.stringify(`http://127.0.0.1:${failClosedPort}`),
  },
})
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-cm-fix-01-'))
let chrome
let socket
try {
  await server.listen()
  chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    `--remote-debugging-port=${debugPort}`, '--remote-debugging-address=127.0.0.1',
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run',
    `--user-data-dir=${tempDir}`, 'about:blank',
  ], { stdio: 'ignore' })
  let target
  for (let i = 0; i < 50 && !target; i++) {
    await delay(100)
    try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find((entry) => entry.type === 'page') } catch { /* chờ Chrome */ }
  }
  assert.ok(target, 'Chrome không khởi động được')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  let nextId = 0
  const pending = new Map()
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (!pending.has(message.id)) return
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(message.error.message))
    else resolve(message.result)
  }
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
    return result.result?.value
  }
  const waitFor = async (expression) => {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(`Boolean(${expression})`)) return
      await delay(100)
    }
    throw new Error(`Không thấy giao diện mong đợi: ${expression}`)
  }
  const today = vietnamDateKey(new Date())
  const month = currentCalendarMonth()
  const nextMonth = shiftCalendarMonth(month, 1)
  const openingTimeParts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(Date.now() + 60 * 60 * 1000)).map(({ type, value }) => [type, value]))
  const fixture = {
    normalProposals: [{ id: 301, classId: 71, targetClassId: 72, kind: 'Transfer', status: 'Pending', shiftDays: null, version: 4, fingerprint: 'fixture-fingerprint', reason: 'Lifecycle test', schedule: [{ sessionId: 901, date: '2026-12-10', startTime: '10:00', endTime: '11:00', coachId: 2, roomId: 3 }], choices: [{ memberId: 501, choice: 'Waiting', respondedAt: null }, { memberId: 502, choice: 'Accept', respondedAt: '2026-10-01T03:00:00Z' }] }],
    today,
    nextSession: `${nextMonth}-15`,
    openingSessionDate: `${openingTimeParts.year}-${openingTimeParts.month}-${openingTimeParts.day}`,
    openingSessionTime: `${openingTimeParts.hour}:${openingTimeParts.minute}:00`,
    classInfo: { id: 71, name: 'Lớp kiểm thử lịch', subjectId: 1, coachId: 2, minCapacity: 2, maxCapacity: 12, enrolledCount: 2, startDate: today, endDate: `${nextMonth}-20`, status: 'Ongoing', classType: 'Normal', totalSessions: 12, tuitionFee: 650000 },
    classDetail: { id: 71, name: 'Lớp kiểm thử lịch', subjectId: 1, subjectName: 'Cầu lông', coachId: 2, maxCapacity: 12, minCapacity: 2, startDate: today, endDate: `${nextMonth}-20`, status: 'Open', classType: 'Normal', totalSessions: 12, tuitionFee: 650000, openingConfirmedAt: null, openingConfirmedBy: null, changePending: false, openingConfirmationAllowed: true, openingReasonRequired: true },
  }
  fixture.classDetail.postponementCount = 0
  fixture.classDetail.lifecycleVersion = 2
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    sessionStorage.setItem('scms_mock_authenticated', 'true');
    sessionStorage.setItem('scms_mock_role', 'manager');
    window.confirm = () => true;
    window.__cmFixture = ${JSON.stringify(fixture)};
    window.__cmWrites = [];
    window.__cmFailNextClassDetail = false;
    window.__cmFailNextProposalList = false;
    window.__cmEmptyProposalList = false;
    const originalFetch = window.fetch;
    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init.method || 'GET').toUpperCase();
      if (!url.includes('/api/')) return originalFetch(input, init);
      const response = (data) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (method !== 'GET') {
        const body = init.body ? JSON.parse(init.body) : null;
        window.__cmWrites.push({ url, method, body });
        if (method === 'POST' && url.includes('/api/classes/71/confirm-opening')) {
          window.__cmFixture.classDetail = { ...window.__cmFixture.classDetail, openingConfirmedAt: new Date().toISOString(), openingConfirmedBy: 1 };
          window.__cmFixture.classInfo = { ...window.__cmFixture.classInfo, status: 'Open', openingConfirmedAt: window.__cmFixture.classDetail.openingConfirmedAt };
          return response(window.__cmFixture.classDetail);
        }
        if (method === 'PUT' && url.includes('/api/classes/71')) return response({ ...window.__cmFixture.classInfo, ...body });
        return new Response('{}', { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      if (url.includes('/api/auth/me')) return response({ userId: 1, email: 'manager@scms.com', fullName: 'Manager', role: 'Manager', authorities: ['MANAGE_CLASSES', 'MANAGE_SUBJECTS', 'MANAGE_ROOMS'] });
      if (url.includes('/api/subjects')) return response([{ id: 1, name: 'Cầu lông', status: 'Active', outdoor: false }]);
      if (url.includes('/api/coaches') || url.includes('/api/staff')) return response([{ id: 2, name: 'Coach', fullName: 'Coach', role: 'Coach', status: 'Active' }]);
      if (url.includes('/api/classes/71/normal-proposals')) {
        if (window.__cmFailNextProposalList) {
          window.__cmFailNextProposalList = false;
          return new Response(JSON.stringify({ message: 'proposal list unavailable' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
        return response(window.__cmEmptyProposalList ? [] : window.__cmFixture.normalProposals);
      }
      if (url.includes('/api/classes/71') && !url.includes('/enrollments')) {
        if (window.__cmFailNextClassDetail) {
          window.__cmFailNextClassDetail = false;
          return new Response(JSON.stringify({ message: 'temporary detail refresh failure' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
        return response(window.__cmFixture.classDetail);
      }
      if (url.includes('/api/classes/71/enrollments')) return response([
        { id: 1, memberId: 101, memberName: 'Paid member 1', status: 'Registered', paymentStatus: 'Paid' },
        { id: 2, memberId: 102, memberName: 'Paid member 2', status: 'Registered', paymentStatus: 'Paid' },
        { id: 3, memberId: 103, memberName: 'Pending member', status: 'Pending', paymentStatus: 'Paid' },
      ]);
      if (url.includes('/api/classes')) return response([window.__cmFixture.classInfo]);
      if (url.includes('/api/sessions?classId=71')) return response([
        { id: 103, classId: 71, sessionDate: window.__cmFixture.openingSessionDate, startTime: window.__cmFixture.openingSessionTime, endTime: '23:59', status: 'Scheduled', coachId: 2, roomId: 3 },
      ]);
      if (url.includes('/api/sessions')) return response([
        { id: 101, classId: 71, sessionDate: window.__cmFixture.today, startTime: '08:00', endTime: '09:00', status: 'Scheduled' },
        { id: 102, classId: 71, sessionDate: window.__cmFixture.nextSession, startTime: '10:00', endTime: '11:00', status: 'Scheduled' },
      ]);
      return response([]);
    };
  ` })
  await send('Page.navigate', { url: `http://127.0.0.1:${vitePort}/manager/classes` })
  await waitFor("document.body.textContent.includes('Lớp kiểm thử lịch')")
  await evaluate(`(() => { const select = document.querySelector('select:has(option[value="today"])'); select.value = 'today'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`)
  await waitFor("document.body.textContent.includes('Lớp kiểm thử lịch')")
  await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Lịch tháng').click()`)
  await waitFor("document.querySelector('[title^=\"08:00 · Lớp kiểm thử lịch\"]')")
  assert.ok(await evaluate(`document.body.textContent.includes(${JSON.stringify(`Lịch lớp tháng ${month.slice(5)}/${month.slice(0, 4)}`)})`))
  await evaluate(`document.querySelector('[aria-label="Tháng sau"]').click()`)
  await waitFor(`document.body.textContent.includes(${JSON.stringify(`Lịch lớp tháng ${nextMonth.slice(5)}/${nextMonth.slice(0, 4)}`)})`)
  assert.ok(await evaluate(`Array.from(document.querySelectorAll('[title^="10:00 · Lớp kiểm thử lịch"]')).some((entry) => entry.textContent.includes('10:00'))`))
  await evaluate(`document.querySelector('[aria-label="Tháng trước"]').click()`)
  await waitFor(`document.body.textContent.includes(${JSON.stringify(`Lịch lớp tháng ${month.slice(5)}/${month.slice(0, 4)}`)})`)
  assert.ok(await evaluate(`Array.from(document.querySelectorAll('[title^="08:00 · Lớp kiểm thử lịch"]')).some((entry) => entry.textContent.includes('08:00'))`))
  assert.deepEqual(await evaluate('window.__cmWrites'), [])
  console.log('PASS: Bộ lọc và lịch tháng trên trình duyệt dùng dữ liệu API cục bộ, điều hướng không gửi ghi dữ liệu')

  await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Danh sách').click()`)
  await waitFor(`document.querySelector('button[title="Thao tác"]')`)
  assert.ok(await evaluate(`!document.querySelector('tbody')?.textContent.includes('Đã đủ điều kiện mở')`), 'ongoing classes do not show opening-readiness text even when the minimum is met')
  await evaluate(`document.querySelector('button[title="Thao tác"]').click()`)
  assert.ok(await evaluate(`!Array.from(document.querySelectorAll('button')).some((button) => button.textContent.trim() === 'Hủy lớp')`), 'ongoing class does not offer before-opening cancellation')
  await evaluate(`document.querySelector('button[title="Thao tác"]').click()`)
  await evaluate(`Array.from(document.querySelectorAll('tbody tr')).find((row) => row.textContent.includes('Lớp kiểm thử lịch')).click()`)
  await delay(200)
  assert.ok(await evaluate(`!document.querySelector('[aria-labelledby="class-lifecycle-heading"]') && !document.querySelector('[aria-labelledby="lifecycle-action-title"]')`), 'clicking a class row or name does not open an action screen')
  await evaluate(`document.querySelector('button[title="Thao tác"]').click()`)
  await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Xác nhận khai giảng').click()`)
  await waitFor(`document.querySelector('[aria-labelledby="opening-confirm-title"]')`)
  assert.ok(await evaluate(`document.querySelector('[aria-labelledby="opening-confirm-title"]').textContent.includes('Lớp kiểm thử lịch')`))
  assert.ok(await evaluate(`!document.querySelector('[aria-labelledby="opening-confirm-title"]').textContent.includes('Member hợp lệ')`), 'confirmation dialog omits the non-authoritative enrollment count')
  assert.ok(await evaluate(`!Array.from(document.querySelector('[aria-labelledby="opening-confirm-title"]').querySelectorAll('dt')).some((label) => label.textContent.includes('Sĩ số'))`), 'confirmation dialog omits the non-authoritative paid-count summary')
  assert.ok(await evaluate(`Boolean(document.querySelector('[aria-labelledby="opening-confirm-title"] textarea[required]'))`), 'reason is required within 24 hours of the first session')
  assert.ok(await evaluate(`Array.from(document.querySelectorAll('[aria-labelledby="opening-confirm-title"] button')).find((button) => button.textContent.trim() === 'Xác nhận khai giảng').disabled`), 'blank reason cannot submit')
  await evaluate(`(() => { const input = document.querySelector('[aria-labelledby="opening-confirm-title"] textarea[required]'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, 'Test reason'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`)
  await evaluate(`Array.from(document.querySelectorAll('[aria-labelledby="opening-confirm-title"] button')).find((button) => button.textContent.trim() === 'Xác nhận khai giảng').click()`)
  await waitFor(`window.__cmWrites.some((write) => write.method === 'POST' && write.url.includes('/confirm-opening'))`)
  const openingWrite = await evaluate(`window.__cmWrites.find((write) => write.method === 'POST' && write.url.includes('/confirm-opening'))`)
  assert.deepEqual(openingWrite.body, { reason: 'Test reason' })
  await waitFor(`document.body.textContent.includes('Khai giảng lớp học thành công.')`)
  assert.ok(await evaluate(`document.body.textContent.includes('Đã xác nhận khai giảng · Còn nhận đăng ký')`), 'confirmed opening is shown while the class remains Open for registration')
  assert.equal(await evaluate(`window.__cmWrites.filter((write) => write.method === 'POST' && write.url.includes('/confirm-opening')).length`), 1, 'confirmation is submitted once')
  await evaluate(`window.__cmWrites = []`)

  await evaluate(`document.querySelector('button[title="Thao tác"]').click()`)
  await waitFor(`Array.from(document.querySelectorAll('button')).some((button) => button.textContent.includes('Chỉnh sửa lớp học'))`)
  await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.includes('Chỉnh sửa lớp học')).click()`)
  await waitFor(`document.body.textContent.includes('Chỉnh sửa thông tin lớp học')`)
  await evaluate(`(() => { const form = Array.from(document.querySelectorAll('form')).find((item) => item.textContent.includes('Lưu thay đổi')); const input = form.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Lớp kiểm thử đã sửa'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`)
  await evaluate(`Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Lưu thay đổi').click()`)
  await waitFor('window.__cmWrites.length === 1')
  const writes = await evaluate('window.__cmWrites')
  assert.equal(writes[0].method, 'PUT')
  assert.equal(writes[0].body.name, 'Lớp kiểm thử đã sửa')
  assert.equal(writes[0].body.maxCapacity, 12)
  assert.equal(writes[0].body.coachId, 2)
  assert.equal(writes[0].body.status, 'Open')
  console.log('PASS: Form sửa lớp gửi đúng dữ liệu cho API giả lập cục bộ')
} finally {
  socket?.close()
  chrome?.kill()
  await server.close()
  if (path.dirname(tempDir) === os.tmpdir() && path.basename(tempDir).startsWith('chrome-cm-fix-01-')) {
    try { fs.rmSync(tempDir, { recursive: true, force: true }) } catch { /* Chrome có thể vẫn đang đóng */ }
  }
}
