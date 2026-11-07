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
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-cm-fix-04-'))
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
  const editRow = async (name) => {
    const row = `Array.from(document.querySelectorAll('tr')).find((item) => item.textContent.includes(${JSON.stringify(name)}))`
    await waitFor(row)
    await evaluate(`${row}.querySelector('button').click()`)
    await waitFor("document.body.textContent.includes('Chỉnh sửa nhân viên')")
  }
  const setName = async (name) => evaluate(`(() => { const input = document.querySelector('form input[type="text"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(name)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`)
  const setRole = async (role) => {
    await waitFor("document.querySelector('form select') && !document.querySelector('form select').disabled")
    await evaluate(`(() => { const select = document.querySelector('form select'); select.value = ${JSON.stringify(role)}; select.dispatchEvent(new Event('change', { bubbles: true })); })()`)
  }
  const save = async () => evaluate("Array.from(document.querySelectorAll('form button')).find((button) => button.textContent.trim() === 'Lưu thay đổi').click()")
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    sessionStorage.setItem('scms_mock_authenticated', 'true');
    sessionStorage.setItem('scms_mock_role', 'manager');
    window.confirm = () => true;
    window.__writes = [];
    window.__staffReads = 0;
    window.__mode = { profile: 'success', role: 'success' };
    window.__staff = [
      { id: 42, name: 'Nhân viên kiểm thử', email: 'staff@example.com', phone: '0123', role: 'Receptionist', status: 'Active' },
      { id: 1, name: 'Manager bản thân', email: 'manager@scms.com', phone: '0987', role: 'CenterManager', status: 'Active' },
    ];
    const originalFetch = window.fetch;
    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      const method = (init.method || 'GET').toUpperCase();
      if (!url.includes('/api/')) return originalFetch(input, init);
      const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
      const body = init.body ? JSON.parse(init.body) : null;
      if (method !== 'GET') window.__writes.push({ url, method, body });
      if (url.includes('/api/auth/me')) return response({ userId: 1, email: 'manager@scms.com', fullName: 'Manager', role: 'Manager', authorities: ['MANAGE_USERS'] });
      if (url.endsWith('/api/roles')) return response([{ id: 7, name: 'Coach' }, { id: 12, name: 'Receptionist' }, { id: 88, name: 'CenterManager' }, { id: 3, name: 'Admin' }, { id: 4, name: 'Member' }]);
      if (method === 'GET' && url.endsWith('/api/staff')) { window.__staffReads++; return response(window.__staff); }
      if (method === 'POST' && url.endsWith('/api/staff')) {
        const staff = { id: 90, name: body.name, email: body.email, phone: body.phone || '', role: body.role, status: 'Active' };
        window.__staff.push(staff);
        return response(staff, 201);
      }
      if (method === 'PUT' && url.endsWith('/api/staff/42')) {
        if (window.__mode.profile !== 'success') return response({ message: 'Lỗi hồ sơ thử nghiệm' }, Number(window.__mode.profile));
        const staff = window.__staff.find((item) => item.id === 42);
        staff.name = body.name; if ('phone' in body) staff.phone = body.phone;
        return response(staff);
      }
      if (method === 'PATCH' && url.endsWith('/api/users/42/role')) {
        if (window.__mode.role !== 'success') return response({ message: 'Lỗi vai trò thử nghiệm' }, Number(window.__mode.role));
        const staff = window.__staff.find((item) => item.id === 42);
        staff.role = ({ 7: 'Coach', 12: 'Receptionist', 88: 'CenterManager' })[body.roleId];
        return response({ id: 42, roleId: body.roleId, roleName: staff.role });
      }
      if (method === 'PATCH' && url.endsWith('/api/staff/42/status')) {
        const staff = window.__staff.find((item) => item.id === 42);
        staff.status = body.status;
        return response(staff);
      }
      if (method !== 'GET') return response({ message: 'Ghi dữ liệu không được hỗ trợ trong kiểm thử' }, 400);
      return response([]);
    };
  ` })
  await send('Page.navigate', { url: `http://127.0.0.1:${vitePort}/manager/staff` })
  await waitFor("document.body.textContent.includes('Nhân viên kiểm thử')")
  await editRow('Manager bản thân')
  await waitFor("document.body.textContent.includes('Không thể đổi vai trò của chính bạn')")
  assert.equal(await evaluate("document.querySelector('form select').disabled"), true)
  await evaluate("Array.from(document.querySelectorAll('form button')).find((button) => button.textContent.trim() === 'Hủy').click()")
  await editRow('Nhân viên kiểm thử')
  await waitFor("document.querySelector('form select') && !document.querySelector('form select').disabled")
  assert.equal(await evaluate("document.querySelector('form input[type=email]').readOnly"), true)
  assert.deepEqual(await evaluate("Array.from(document.querySelector('form select').options).map((option) => option.value).sort()"), ['coach', 'manager', 'receptionist'])
  await setName('Nhân viên đã sửa')
  await save()
  await waitFor("!document.body.textContent.includes('Chỉnh sửa nhân viên') && document.body.textContent.includes('Nhân viên đã sửa')")
  let writes = await evaluate('window.__writes')
  assert.deepEqual(writes.map((item) => item.method), ['PUT'])
  assert.equal(writes[0].body.role, 'Receptionist')
  assert.match(writes[0].url, /\/api\/staff\/42$/)
  await editRow('Nhân viên đã sửa')
  await setRole('coach')
  const readsBefore = await evaluate('window.__staffReads')
  await save()
  await waitFor("!document.body.textContent.includes('Chỉnh sửa nhân viên') && document.body.textContent.includes('Nhân viên đã sửa')")
  writes = await evaluate('window.__writes')
  assert.deepEqual(writes.map((item) => item.method), ['PUT', 'PATCH'])
  assert.match(writes[1].url, /\/api\/users\/42\/role$/)
  assert.deepEqual(writes[1].body, { roleId: 7 })
  assert.ok((await evaluate('window.__staffReads')) > readsBefore)
  await editRow('Nhân viên đã sửa')
  await setRole('receptionist')
  await setName('Hồ sơ đã lưu')
  await evaluate("window.__mode.role = '403'")
  await save()
  await waitFor("document.querySelector('[role=alert]')?.textContent.includes('Hồ sơ: đã lưu')")
  assert.ok(await evaluate("document.querySelector('[role=alert]').textContent.includes('Vai trò: chưa xác nhận được')"))
  assert.ok(await evaluate("document.body.textContent.includes('Chỉnh sửa nhân viên')"))
  await evaluate("Array.from(document.querySelectorAll('form button')).find((button) => button.textContent.trim() === 'Hủy').click()")
  await editRow('Hồ sơ đã lưu')
  await setRole('receptionist')
  await setName('Hồ sơ chưa lưu')
  await evaluate("window.__mode.profile = '500'; window.__mode.role = 'success'")
  await save()
  await waitFor("document.querySelector('[role=alert]')?.textContent.includes('Vai trò: đã lưu')")
  assert.ok(await evaluate("document.querySelector('[role=alert]').textContent.includes('Hồ sơ: chưa xác nhận được')"))
  assert.ok(await evaluate("document.querySelector('form select').value === 'receptionist'"))
  writes = await evaluate('window.__writes')
  assert.ok(writes.every((item) => item.url.includes('/api/staff/42') || item.url.includes('/api/users/42/role')))
  await evaluate("Array.from(document.querySelectorAll('form button')).find((button) => button.textContent.trim() === 'Hủy').click()")
  await evaluate("Array.from(document.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Thêm nhân viên').click()")
  await waitFor("document.body.textContent.includes('Thêm nhân viên mới')")
  assert.deepEqual(await evaluate("Array.from(document.querySelector('form select').options).map((option) => option.value)"), ['', 'coach', 'receptionist', 'manager'])
  await evaluate(`(() => {
    const form = document.querySelector('form');
    const name = form.querySelector('input[type=text]');
    const email = form.querySelector('input[type=email]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(name, 'Nhân viên mới'); name.dispatchEvent(new Event('input', { bubbles: true }));
    setter.call(email, 'new@example.com'); email.dispatchEvent(new Event('input', { bubbles: true }));
    const role = form.querySelector('select'); role.value = 'receptionist'; role.dispatchEvent(new Event('change', { bubbles: true }));
  })()`)
  await evaluate("Array.from(document.querySelectorAll('form button')).find((button) => button.textContent.trim() === 'Tạo nhân viên').click()")
  await waitFor("document.body.textContent.includes('Nhân viên mới') && !document.body.textContent.includes('Thêm nhân viên mới')")
  const create = (await evaluate('window.__writes')).find((item) => item.method === 'POST')
  assert.match(create.url, /\/api\/staff$/)
  assert.equal(create.body.role, 'Receptionist')
  const statusRow = "Array.from(document.querySelectorAll('tr')).find((row) => row.textContent.includes('Hồ sơ đã lưu'))"
  await waitFor(statusRow)
  await evaluate(`${statusRow}.querySelectorAll('button')[1].click()`)
  await waitFor("window.__writes.some((item) => item.url.includes('/api/staff/42/status'))")
  assert.deepEqual((await evaluate('window.__writes')).at(-1).body, { status: 'LOCKED' })
  console.log('PASS: chỉnh sửa, vai trò, một phần thành công, tạo nhân viên và khóa tài khoản bằng dữ liệu cục bộ')
} finally {
  socket?.close()
  chrome?.kill()
  await server.close()
  if (path.dirname(tempDir) === os.tmpdir() && path.basename(tempDir).startsWith('chrome-cm-fix-04-')) {
    try { fs.rmSync(tempDir, { recursive: true, force: true }) } catch { /* trình duyệt đang đóng */ }
  }
}
