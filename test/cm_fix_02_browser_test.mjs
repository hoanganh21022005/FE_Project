import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'

const port = () => new Promise((resolve, reject) => {
  const server = net.createServer().on('error', reject)
  server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(() => resolve(value)) })
})
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const vitePort = await port()
const closedPort = await port()
const debugPort = await port()
const server = await createServer({
  mode: 'development',
  server: { host: '127.0.0.1', port: vitePort, proxy: { '/api': `http://127.0.0.1:${closedPort}` } },
  define: {
    'import.meta.env.VITE_TEST_HARNESS': JSON.stringify('true'),
    'import.meta.env.VITE_API_ENABLED': JSON.stringify('true'),
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(''),
    'import.meta.env.VITE_API_PROXY_TARGET': JSON.stringify(`http://127.0.0.1:${closedPort}`),
  },
})
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-cm-fix-02-'))
let chrome
let socket
try {
  await server.listen()
  chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    `--remote-debugging-port=${debugPort}`, '--remote-debugging-address=127.0.0.1',
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', `--user-data-dir=${tempDir}`, 'about:blank',
  ], { stdio: 'ignore' })
  let target
  for (let i = 0; i < 50 && !target; i++) {
    await pause(100)
    try { target = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find((item) => item.type === 'page') } catch { /* chờ trình duyệt */ }
  }
  assert.ok(target, 'Không khởi động được Chrome')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  let nextId = 0
  const pending = new Map()
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (!pending.has(message.id)) return
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(message.error.message)); else resolve(message.result)
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
    for (let i = 0; i < 120; i++) { if (await evaluate(`Boolean(${expression})`)) return; await pause(100) }
    throw new Error(`Không thấy trạng thái mong đợi: ${expression}`)
  }
  const clickText = async (label) => {
    const expression = `Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === ${JSON.stringify(label)} && !button.disabled)`
    await waitFor(expression)
    await evaluate(`${expression}.click()`)
  }
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    sessionStorage.setItem('scms_mock_authenticated', 'true');
    sessionStorage.setItem('scms_mock_role', 'manager');
    window.__cmMode = { packages: 'data', subscriptions: 'data', subjects: 'data' };
    window.__cmWrites = [];
    window.__cmReads = [];
    window.__unauthorizedCount = 0;
    window.addEventListener('scms:unauthorized', () => window.__unauthorizedCount++);
    const originalFetch = window.fetch;
    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init.method || 'GET').toUpperCase();
      if (!url.includes('/api/')) return originalFetch(input, init);
      if (method !== 'GET') { window.__cmWrites.push({ url, method }); throw new Error('Ghi dữ liệu bị chặn trong kiểm thử'); }
      window.__cmReads.push(url);
      const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
      const respondList = (mode, data) => {
        if (mode === 'network') throw new TypeError('local network failure');
        if (mode === 'empty') return response([]);
        if (mode === 'malformed') return response({ unexpected: true });
        if (mode === '401' || mode === '403' || mode === '500') return response({ message: 'local error ' + mode }, Number(mode));
        return response(data);
      };
      if (url.includes('/api/auth/me')) return response({ userId: 1, email: 'manager@scms.com', fullName: 'Manager', role: 'Manager', authorities: ['MANAGE_PACKAGES', 'MANAGE_USERS'] });
      if (url.includes('/api/members/7/subscriptions')) return respondList(window.__cmMode.subscriptions, [{ subscriptionId: 501, memberId: 7, packageId: null, packageName: 'Quyền Advanced', packageType: 'Advanced', price: 2500000, status: 'Active', subjectId: 4, remainingCredit: 9 }]);
      if (url.includes('/api/members/7')) return response({ id: 7, name: 'Hội viên bảy', email: 'seven@example.com', status: 'Active' });
      if (url.includes('/api/packages')) return respondList(window.__cmMode.packages, [
        { id: 21, name: 'Normal zero', packageType: 'Normal', price: 0, durationDays: 30, status: 'Active' },
        { id: 22, name: 'Advanced inactive', packageType: 'Advanced', price: 900000, durationDays: 45, totalCredit: 12, status: 'Inactive' },
        { id: 1, name: 'ID cần đối soát', packageType: 'Normal', price: 0, durationDays: 30, status: 'Inactive' },
        { id: 23, name: 'Chưa rõ loại', packageType: null, price: null, durationDays: null, status: null },
      ]);
      if (url.includes('/api/subjects')) return respondList(window.__cmMode.subjects, [
        { id: 4, name: 'Tennis', normalPrice: 200000, advancedPrice: 300000, status: 'Active', outdoor: true },
        { id: 5, name: 'Cầu lông', normalPrice: 500000, advancedPrice: 700000, status: 'Inactive', outdoor: false },
      ]);
      return response([]);
    };
  ` })
  await send('Page.navigate', { url: `http://127.0.0.1:${vitePort}/manager/members/7` })
  await waitFor("document.body.textContent.includes('Hội viên bảy')")
  await clickText('Gói đăng ký')
  await waitFor("document.body.textContent.includes('Quyền Advanced')")
  await evaluate("window.__cmMode.subscriptions = '500'")
  await clickText('Tải lại lịch sử')
  await waitFor("document.querySelector('[role=alert]')?.textContent.includes('local error 500')")
  assert.ok(await evaluate("document.body.textContent.includes('Quyền Advanced') && document.body.textContent.includes('có thể đã cũ')"))
  await evaluate("window.__cmMode.subscriptions = '403'")
  await clickText('Tải lại lịch sử')
  await waitFor("document.querySelector('[role=alert]')?.textContent.includes('không có quyền')")
  assert.equal(await evaluate("document.body.textContent.includes('Quyền Advanced')"), false)
  assert.equal(await evaluate("document.body.textContent.includes('Chưa có bản ghi hợp đồng gói')"), false)
  await evaluate("window.__cmMode.subscriptions = 'empty'")
  await clickText('Tải lại lịch sử')
  await waitFor("document.body.textContent.includes('Chưa có bản ghi hợp đồng gói')")
  await evaluate("window.__cmMode.subscriptions = 'network'")
  await clickText('Tải lại lịch sử')
  await waitFor("document.querySelector('[role=alert]')?.textContent.includes('Không thể kết nối')")
  assert.equal(await evaluate("document.body.textContent.includes('Chưa có bản ghi hợp đồng gói')"), false)
  await evaluate("window.__cmMode.subscriptions = 'data'")
  await clickText('Tải lại lịch sử')
  await waitFor("document.body.textContent.includes('Quyền Advanced')")
  await evaluate("window.__cmMode.subscriptions = '401'")
  await clickText('Tải lại lịch sử')
  await waitFor('window.__unauthorizedCount > 0')
  console.log('PASS: Lịch sử gói: dữ liệu, rỗng, 403, 500, lỗi mạng và thử lại')

  await send('Page.navigate', { url: `http://127.0.0.1:${vitePort}/manager/packages` })
  await waitFor("document.body.textContent.includes('Học phí theo môn · Normal') && document.body.textContent.includes('200.000')")
  assert.ok(await evaluate("document.body.textContent.includes('Tennis') && document.body.textContent.includes('Outdoor') && document.body.textContent.includes('Indoor') && document.body.textContent.includes('inactive')"))
  assert.equal(await evaluate("document.body.textContent.includes('Danh sách gói') || document.body.textContent.includes('Chưa có gói trong danh mục') || document.body.textContent.includes('Tạo gói mới') || document.body.textContent.includes('ID cần đối soát')"), false)
  await clickText('Advanced')
  await waitFor("document.body.textContent.includes('Học phí theo môn · Advanced') && document.body.textContent.includes('300.000')")
  assert.equal(await evaluate("document.body.textContent.includes('Danh sách gói') || document.body.textContent.includes('Tạo gói mới')"), false)
  const packagesBeforeRefresh = await evaluate("window.__cmReads.filter((url) => url.includes('/api/packages')).length")
  await evaluate("window.__cmMode.subjects = '500'")
  await clickText('Tải lại')
  await waitFor("Array.from(document.querySelectorAll('[role=alert]')).some((node) => node.textContent.includes('local error 500'))")
  assert.ok(await evaluate("document.body.textContent.includes('300.000') && document.body.textContent.includes('lần tải trước')"))
  await evaluate("window.__cmMode.subjects = 'empty'")
  await clickText('Tải lại')
  await waitFor("document.body.textContent.includes('Chưa có môn học có học phí khác 0')")
  await evaluate("window.__cmMode.subjects = 'data'")
  await clickText('Tải lại')
  await waitFor("document.body.textContent.includes('300.000')")
  await clickText('Normal')
  await waitFor("document.body.textContent.includes('Học phí theo môn · Normal') && document.body.textContent.includes('200.000')")
  assert.equal(await evaluate("window.__cmReads.filter((url) => url.includes('/api/packages')).length"), packagesBeforeRefresh)
  assert.deepEqual(await evaluate('window.__cmWrites'), [])
  await evaluate("window.__cmMode.subjects = '401'")
  await clickText('Tải lại')
  await waitFor('window.__unauthorizedCount > 0')
  console.log('PASS: Hai tab học phí theo môn, trạng thái môn, tải lại và lỗi; không có danh mục cũ hoặc yêu cầu ghi')
} finally {
  socket?.close()
  chrome?.kill()
  await server.close()
  if (path.dirname(tempDir) === os.tmpdir() && path.basename(tempDir).startsWith('chrome-cm-fix-02-')) {
    try { fs.rmSync(tempDir, { recursive: true, force: true }) } catch { /* trình duyệt đang đóng */ }
  }
}
