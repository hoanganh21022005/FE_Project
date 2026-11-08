import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import net from 'node:net'
import url from 'node:url'
import { createServer } from 'vite'

console.log('================================================================')
console.log('  RUNNING FE RBAC CONFIRM-CASH BROWSER FIXTURE VERIFICATION')
console.log('================================================================')

class ChromeClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.msgId = 1
    this.pending = new Map()
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl)
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve
      this.ws.onerror = reject
    })
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(msg.error.message))
        else resolve(msg.result)
      }
    }
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (res.exceptionDetails) {
      const desc = res.exceptionDetails.exception?.description || res.exceptionDetails.text
      throw new Error(`Eval failed: ${desc}`)
    }
    return res.result ? res.result.value : undefined
  }

  async waitFor(expression, timeoutMs = 8000, pollIntervalMs = 120) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const val = await this.eval(`Boolean(${expression})`)
        if (val) return val
      } catch {
        // ignore transient evaluation errors while DOM settles
      }
      await new Promise((r) => setTimeout(r, pollIntervalMs))
    }
    throw new Error(`Timeout waiting for expression: ${expression}`)
  }

  async navigate(targetUrl) {
    await this.send('Page.navigate', { url: targetUrl })
    await new Promise((r) => setTimeout(r, 600))
  }

  close() {
    if (this.ws) this.ws.close()
  }
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

async function spawnIsolatedChrome() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  const cdpPort = await getFreePort()
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-rbac-test-'))

  const proc = spawn(
    chromePath,
    [
      `--remote-debugging-port=${cdpPort}`,
      '--remote-debugging-address=127.0.0.1',
      '--disable-gpu',
      '--no-sandbox',
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1280,900',
      `--user-data-dir=${tempDir}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  let pageList = []
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200))
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`)
      if (res.ok) {
        pageList = await res.json()
        if (pageList.length > 0) break
      }
    } catch {}
  }

  if (pageList.length === 0) {
    throw new Error(`Failed to initialize Chrome on port ${cdpPort}`)
  }

  const target = pageList.find((p) => p.type === 'page' && !p.url.startsWith('chrome://')) || pageList[0]
  const client = new ChromeClient(target.webSocketDebuggerUrl)
  await client.connect()
  await client.send('Page.enable')
  await client.send('Runtime.enable')

  return { client, proc, tempDir }
}

async function runConfirmCashBrowserSuite() {
  const projectRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..')
  process.chdir(projectRoot)

  const vitePort = await getFreePort()
  const dummyBackendPort = await getFreePort()

  const viteServer = await createServer({
    server: {
      port: vitePort,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${dummyBackendPort}`,
          changeOrigin: true,
        },
      },
    },
    configFile: path.join(projectRoot, 'vite.config.js'),
  })
  await viteServer.listen()

  const { client, proc, tempDir } = await spawnIsolatedChrome()

  try {
    // Inject mock network interceptor in browser document
    await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        sessionStorage.setItem('scms_mock_authenticated', 'true');
        sessionStorage.setItem('scms_mock_role', 'receptionist');
        window.confirm = () => true;
        window.alert = () => {};

        if (!sessionStorage.getItem('rbac_test_role')) {
          sessionStorage.setItem('rbac_test_role', 'Receptionist');
          sessionStorage.setItem('rbac_test_auth', JSON.stringify(['MANAGE_INVOICES']));
        }

        window.__rbacCalls = {
          confirmCashPosts: [],
          allPosts: [],
        };

        const origFetch = window.fetch;
        window.fetch = async (input, init = {}) => {
          const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
          const method = (init.method || (input && input.method) || 'GET').toUpperCase();
          let parsedBody = null;
          if (init.body && typeof init.body === 'string') {
            try { parsedBody = JSON.parse(init.body); } catch { parsedBody = init.body; }
          }

          if (method === 'POST') {
            window.__rbacCalls.allPosts.push({ url: urlStr, body: parsedBody });
          }

          if (urlStr.includes('/api/auth/me') || urlStr.includes('/api/auth/login')) {
            const curRole = sessionStorage.getItem('rbac_test_role') || 'Receptionist';
            const curAuth = JSON.parse(sessionStorage.getItem('rbac_test_auth') || '["MANAGE_INVOICES"]');
            return new Response(JSON.stringify({
              userId: 2,
              email: 'staff@scms.com',
              fullName: 'Nhân Viên SCMS',
              role: curRole,
              authorities: curAuth
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          if (urlStr.includes('/api/invoices') && method === 'GET') {
            return new Response(JSON.stringify([
              {
                id: 701,
                invoiceId: 701,
                code: 'INV-CASH-701',
                amount: 500000,
                paymentStatus: 'Pending',
                paymentMethod: 'Cash',
                method: 'Cash',
                status: 'pending',
                memberName: 'Trần Văn B',
                memberPhone: '0901234567',
                packageName: 'Lớp Cầu Lông K01',
                createdAt: '2026-11-07 08:00:00'
              },
              {
                id: 702,
                invoiceId: 702,
                code: 'INV-ONLINE-702',
                amount: 800000,
                paymentStatus: 'Pending',
                paymentMethod: 'VNPay',
                method: 'VNPay',
                status: 'pending',
                memberName: 'Lê Thị C',
                memberPhone: '0907654321',
                packageName: 'Lớp Bơi Lội K02',
                createdAt: '2026-11-07 08:05:00'
              }
            ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          if (urlStr.includes('/confirm-cash') && method === 'POST') {
            window.__rbacCalls.confirmCashPosts.push({ url: urlStr, body: parsedBody });
            return new Response(JSON.stringify({
              id: 701,
              invoiceId: 701,
              code: 'INV-CASH-701',
              status: 'PAID',
              paymentStatus: 'Paid',
              paymentMethod: 'Cash'
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          if (urlStr.includes('/api/members') && method === 'GET') {
            return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          if (urlStr.includes('/api/packages') && method === 'GET') {
            return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
        };
      `,
    })

    // =================================================================================
    // SCENARIO 1: Receptionist có MANAGE_INVOICES (Đủ quyền) trên hóa đơn Cash Pending
    // -> Gửi đúng 1 POST
    // =================================================================================
    console.log('[Scenario 1] Testing Receptionist with MANAGE_INVOICES on Cash Pending invoice...')
    await client.navigate(`http://localhost:${vitePort}/receptionist/payments`)

    // Wait for the invoices table to render with the Cash Pending invoice
    await client.waitFor(`document.querySelector("tbody") !== null`, 10000)
    await client.waitFor(`Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Thu tiền mặt'))`, 10000)

    // Click "Thu tiền mặt" to open cash collection modal
    await client.eval(`
      const collectBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Thu tiền mặt'));
      if (collectBtn) collectBtn.click();
    `)

    // Wait for modal to appear and click "Xác nhận đã thu tiền"
    await client.waitFor(`Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Xác nhận đã thu tiền'))`, 5000)
    await client.eval(`
      const confirmBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Xác nhận đã thu tiền'));
      if (confirmBtn) confirmBtn.click();
    `)

    await client.waitFor(`window.__rbacCalls.confirmCashPosts.length === 1`, 5000)
    const scenario1Posts = await client.eval(`window.__rbacCalls.confirmCashPosts.length`)
    const scenario1Url = await client.eval(`window.__rbacCalls.confirmCashPosts[0].url`)
    assert.equal(scenario1Posts, 1, 'Authorized Receptionist must send exactly 1 POST')
    assert.match(scenario1Url, /\/api\/invoices\/701\/confirm-cash$/, 'Endpoint must match /api/invoices/701/confirm-cash')
    console.log('[Scenario 1] PASS: Receptionist with MANAGE_INVOICES sent exactly 1 POST to confirm-cash.')

    // =================================================================================
    // SCENARIO 2: Manager (kể cả có MANAGE_INVOICES) -> Gửi 0 POST
    // =================================================================================
    console.log('\n[Scenario 2] Testing Manager role...')
    await client.eval(`
      window.__rbacCalls.confirmCashPosts = [];
      sessionStorage.setItem('rbac_test_role', 'Manager');
      sessionStorage.setItem('rbac_test_auth', JSON.stringify(['MANAGE_INVOICES', 'MANAGE_CLASSES']));
      sessionStorage.setItem('scms_mock_role', 'manager');
    `)
    // Manager opens manager payments page
    await client.navigate(`http://localhost:${vitePort}/manager/payments`)
    await client.waitFor(`document.querySelector("tbody") !== null`, 10000)

    // Verify Manager does NOT have "Thu tiền mặt" button on manager payments
    const managerHasCollectBtn = await client.eval(`
      Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Thu tiền mặt'))
    `)
    assert.equal(managerHasCollectBtn, false, 'Manager must NOT see "Thu tiền mặt" button in PaymentManagement')

    // Also verify if Manager attempts to access receptionist payments view
    await client.navigate(`http://localhost:${vitePort}/receptionist/payments`)
    await new Promise((r) => setTimeout(r, 600))
    const recPageHasCollectBtnForManager = await client.eval(`
      Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Thu tiền mặt'))
    `)
    assert.equal(recPageHasCollectBtnForManager, false, 'Manager must NOT see "Thu tiền mặt" on receptionist payments')

    // Attempt direct submission trigger
    await client.eval(`
      const forms = Array.from(document.querySelectorAll('form'));
      forms.forEach(f => f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));
    `)
    await new Promise((r) => setTimeout(r, 600))
    const scenario2Posts = await client.eval(`window.__rbacCalls.confirmCashPosts.length`)
    assert.equal(scenario2Posts, 0, 'Manager must send exactly 0 POST to confirm-cash')
    console.log('[Scenario 2] PASS: Manager has no button and sends exactly 0 POST.')

    // =================================================================================
    // SCENARIO 3: Receptionist thiếu quyền MANAGE_INVOICES -> Gửi 0 POST
    // =================================================================================
    console.log('\n[Scenario 3] Testing Receptionist lacking MANAGE_INVOICES...')
    await client.eval(`
      window.__rbacCalls.confirmCashPosts = [];
      sessionStorage.setItem('rbac_test_role', 'Receptionist');
      sessionStorage.setItem('rbac_test_auth', JSON.stringify(['VIEW_INVOICES'])); // Missing MANAGE_INVOICES
      sessionStorage.setItem('scms_mock_role', 'receptionist');
    `)
    await client.navigate(`http://localhost:${vitePort}/receptionist/payments`)
    await client.waitFor(`document.querySelector("tbody") !== null`, 10000)

    // Verify "Thu tiền mặt" button is NOT rendered for receptionist lacking permission
    const hasCollectBtnNoAuth = await client.eval(`
      Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Thu tiền mặt'))
    `)
    assert.equal(hasCollectBtnNoAuth, false, 'Receptionist without MANAGE_INVOICES must NOT see "Thu tiền mặt" button')

    // Attempt submit trigger
    await client.eval(`
      const forms = Array.from(document.querySelectorAll('form'));
      forms.forEach(f => f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));
    `)
    await new Promise((r) => setTimeout(r, 600))
    const scenario3Posts = await client.eval(`window.__rbacCalls.confirmCashPosts.length`)
    assert.equal(scenario3Posts, 0, 'Receptionist without MANAGE_INVOICES must send exactly 0 POST to confirm-cash')
    console.log('[Scenario 3] PASS: Receptionist lacking MANAGE_INVOICES sends exactly 0 POST.')

    console.log('\n================================================================')
    console.log('ALL BROWSER CONFIRM-CASH RBAC FIXTURE TESTS PASSED (3/3 SCENARIOS)')
    console.log('================================================================')
  } finally {
    client.close()
    proc.kill()
    await viteServer.close()
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  }
}

await runConfirmCashBrowserSuite()
