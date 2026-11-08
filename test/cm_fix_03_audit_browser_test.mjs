import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'

const port = () => new Promise((resolve, reject) => {
  const listener = net.createServer().on('error', reject)
  listener.listen(0, '127.0.0.1', () => { const value = listener.address().port; listener.close(() => resolve(value)) })
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
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-cm-fix-03-'))
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
  const refresh = async () => {
    await waitFor("Array.from(document.querySelectorAll('button')).some((button) => button.textContent.trim() === 'Tải lại' && !button.disabled)")
    await evaluate("Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Tải lại' && !button.disabled).click()")
  }
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    sessionStorage.setItem('scms_mock_authenticated', 'true');
    sessionStorage.setItem('scms_mock_role', 'manager');
    window.__auditMode = 'data';
    window.__auditCalls = [];
    window.__writes = [];
    window.__unauthorized = 0;
    window.addEventListener('scms:unauthorized', () => window.__unauthorized++);
    const originalFetch = window.fetch;
    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init.method || 'GET').toUpperCase();
      if (!url.includes('/api/')) return originalFetch(input, init);
      if (method !== 'GET') { window.__writes.push({ url, method }); throw new Error('Ghi dữ liệu bị chặn trong kiểm thử'); }
      const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/api/auth/me')) return response({ userId: 1, email: 'manager@scms.com', fullName: 'Manager', role: 'Manager', authorities: sessionStorage.getItem('audit_permission') === 'yes' ? ['VIEW_AUDIT_LOG'] : [] });
      if (url.includes('/api/audit-logs')) {
        window.__auditCalls.push(url);
        if (window.__auditMode === 'network') throw new TypeError('offline');
        if (window.__auditMode === 'empty') return response([]);
        if (window.__auditMode === 'malformed') return response({ unexpected: true });
        if (['401', '403', '500'].includes(window.__auditMode)) return response({ message: 'local error ' + window.__auditMode }, Number(window.__auditMode));
        return response([{ id: 101, userId: 9, action: 'UPDATE_CLASS', targetEntity: 'Class', targetId: 7, detail: 'Chi tiết kiểm thử', createdAt: '2026-11-06T17:30:00Z' }]);
      }
      if (url.includes('/api/reports/dashboard')) return response({ totalUsers: 10, totalMembers: 5, totalClasses: 0, totalPackages: 0, totalRevenue: 0, totalInvoices: 0, activeSubscriptions: 0, todaySessions: 0 });
      return response([]);
    };
  ` })
  await send('Page.navigate', { url: `http://127.0.0.1:${vitePort}/manager/dashboard` })
  await waitFor("document.body?.textContent.includes('Tổng người dùng')")
  assert.deepEqual(await evaluate('window.__auditCalls'), [])
  await send('Page.navigate', { url: `http://127.0.0.1:${vitePort}/manager/audit-logs` })
  await waitFor("document.body?.textContent.includes('Bạn không có quyền xem nhật ký hệ thống')")
  assert.deepEqual(await evaluate('window.__auditCalls'), [])
  assert.equal(await evaluate("document.body.textContent.includes('Chưa có nhật ký hệ thống')"), false)
  await evaluate("sessionStorage.setItem('audit_permission', 'yes')")
  await send('Page.reload')
  await waitFor("document.body?.textContent.includes('Chi tiết kiểm thử')")
  const initialAuditCalls = (await evaluate('window.__auditCalls')).length
  assert.ok(initialAuditCalls >= 1 && initialAuditCalls <= 2)
  await pause(400)
  assert.equal((await evaluate('window.__auditCalls')).length, initialAuditCalls)
  assert.ok(await evaluate("document.body.textContent.includes('User #9') && document.body.textContent.includes('Class #7') && document.body.textContent.includes('00:30:00')"))
  assert.equal(await evaluate("document.body.textContent.includes('Trước → Sau')"), false)
  await evaluate("window.__auditMode = '500'")
  await refresh()
  await waitFor("document.querySelector('[role=alert]')?.textContent.includes('local error 500')")
  assert.ok(await evaluate("document.body.textContent.includes('Chi tiết kiểm thử') && document.body.textContent.includes('có thể đã cũ')"))
  await evaluate("window.__auditMode = 'network'")
  await refresh()
  await waitFor("document.querySelector('[role=alert]')?.textContent.includes('Không thể kết nối')")
  assert.ok(await evaluate("document.body.textContent.includes('Chi tiết kiểm thử')"))
  await evaluate("window.__auditMode = '403'")
  await refresh()
  await waitFor("document.querySelector('[role=alert]')?.textContent.includes('không có quyền')")
  assert.equal(await evaluate("document.body.textContent.includes('Chi tiết kiểm thử') || document.body.textContent.includes('Chưa có nhật ký hệ thống')"), false)
  await evaluate("window.__auditMode = 'empty'")
  await refresh()
  await waitFor("document.body.textContent.includes('Chưa có nhật ký hệ thống')")
  await evaluate("window.__auditMode = 'malformed'")
  await refresh()
  await waitFor("document.querySelector('[role=alert]')?.textContent.includes('không đúng định dạng')")
  assert.equal(await evaluate("document.body.textContent.includes('Chưa có nhật ký hệ thống')"), false)
  await evaluate("window.__auditMode = 'data'")
  await refresh()
  await waitFor("document.body.textContent.includes('Chi tiết kiểm thử')")
  await evaluate(`(() => { const input = document.querySelector('input[placeholder*="Tìm người"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'không khớp'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`)
  await waitFor("document.body.textContent.includes('Không tìm thấy nhật ký phù hợp')")
  assert.deepEqual(await evaluate('window.__writes'), [])
  await evaluate("window.__auditMode = '401'")
  await refresh()
  await waitFor('window.__unauthorized > 0')
  await waitFor("document.body.textContent.includes('Phiên đăng nhập đã hết hạn')")
  console.log('PASS: quyền, dữ liệu, lỗi, thử lại, tìm kiếm, giờ Việt Nam và trang tổng quan với API cục bộ')
} finally {
  socket?.close()
  chrome?.kill()
  await server.close()
  if (path.dirname(tempDir) === os.tmpdir() && path.basename(tempDir).startsWith('chrome-cm-fix-03-')) {
    try { fs.rmSync(tempDir, { recursive: true, force: true }) } catch { /* trình duyệt đang đóng */ }
  }
}
