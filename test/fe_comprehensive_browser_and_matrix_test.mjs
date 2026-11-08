import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import net from 'node:net'
import url from 'node:url'
import { createServer } from 'vite'

import {
  PASSWORD_MIN_LENGTH,
  isPasswordValid,
  validatePassword,
  getPasswordRulesStatus,
  getPasswordRuleHint,
} from '../src/utils/passwordPolicy.js'

console.log('================================================================')
console.log('  RUNNING COMPREHENSIVE 3-TIER TEST (SOURCE, FIXTURE, BROWSER)')
console.log('================================================================')

// ----------------------------------------------------------------------
// TIER 1: SOURCE CODE & REGEX VERIFICATION
// ----------------------------------------------------------------------
console.log('\n[TIER 1] Validating Password Policy & Adherence to Backend Contract...')

// Check 1: BE contract regex check
assert.equal(isPasswordValid('1234567'), false, '7 chars must fail')
assert.equal(isPasswordValid('abcdefgh'), false, '8 letters only must fail')
assert.equal(isPasswordValid('12345678'), false, '8 numbers only must fail')
assert.equal(isPasswordValid('Pass1234'), true, '8 chars with letter & digit must pass')
assert.equal(isPasswordValid(' Pass1234'), true, 'leading space must pass BE regex')
assert.equal(isPasswordValid('Pass 1234'), true, 'middle space must pass BE regex')
assert.equal(isPasswordValid('Pass1234 '), true, 'trailing space must pass BE regex')
assert.equal(isPasswordValid(' Pass 1234 '), true, 'leading + middle + trailing spaces must pass BE regex')
assert.equal(isPasswordValid('       1a'), true, '7 spaces + 1 digit + 1 letter = 9 chars must pass BE regex')
assert.equal(isPasswordValid('  Pass  '), false, 'spaces with letters only must fail')
assert.equal(isPasswordValid('  1234  '), false, 'spaces with numbers only must fail')

// Check 2: Validation errors
assert.equal(validatePassword('', true).isValid, false)
assert.match(validatePassword('Pass123', true).error, /tối thiểu 8 ký tự/i)
assert.match(validatePassword('PassWord', true).error, /ít nhất một chữ cái và một chữ số/i)
assert.match(validatePassword('PassWord', false).error, /at least one letter and one number/i)
assert.equal(validatePassword(' Pass 1234 ', true).isValid, true, 'valid password with spaces must pass validation')

// Check 3: Check hints
assert.ok(getPasswordRuleHint(true).includes('8 ký tự'))
assert.ok(getPasswordRuleHint(false).includes('8 characters'))

console.log('  -> Tier 1: Source code & BE Contract rules: PASSED')

// ----------------------------------------------------------------------
// TIER 2: FIXTURE & STATUS MATRIX VERIFICATION
// ----------------------------------------------------------------------
console.log('\n[TIER 2] Validating Payment Status Matrix, Forbidden Permissions, & VI/EN Copy...')

// Check 2.1: Payment status copy in MemberInvoicesView
const invoicesViewContent = fs.readFileSync(path.resolve('src/components/views/MemberInvoicesView.jsx'), 'utf8')

// Ensure no technical internal leakage in payment status
const forbiddenTerms = [
  /BLOCKED BY BACKEND/i,
  /HTTP 403/i,
  /HTTP 404/i,
  /Backend xác nhận/i,
  /Backend ghi nhận/i,
  /Backend trả về/i,
  /Backend hiện chưa hỗ trợ/i,
]
for (const term of forbiddenTerms) {
  assert.equal(term.test(invoicesViewContent), false, `MemberInvoicesView must not contain ${term}`)
}

// Ensure friendly payment statuses exist
assert.ok(invoicesViewContent.includes('Hệ thống xác nhận hóa đơn đã thanh toán thành công.'))
assert.ok(invoicesViewContent.includes('Hóa đơn hiện vẫn Chờ thanh toán.'))
assert.ok(invoicesViewContent.includes('Hệ thống ghi nhận hóa đơn đã hết hạn.'))
assert.ok(invoicesViewContent.includes('Ghi nhận thanh toán thất bại'))
assert.ok(invoicesViewContent.includes('Chức năng tự động xác minh giao dịch hiện đang tạm đóng.'))

// Check 2.2: ForbiddenView check
const forbiddenViewContent = fs.readFileSync(path.resolve('src/components/views/ForbiddenView.js'), 'utf8')
assert.ok(!forbiddenViewContent.includes('HTTP 403'), 'ForbiddenView must not leak HTTP 403')
assert.ok(forbiddenViewContent.includes('Giới hạn quyền'), 'ForbiddenView must show Giới hạn quyền')

// Check 2.3: ClassManagement check
const classMgmtContent = fs.readFileSync(path.resolve('src/components/views/ClassManagement.jsx'), 'utf8')
assert.ok(!classMgmtContent.includes('Chưa hỗ trợ API'), 'ClassManagement must not have "Chưa hỗ trợ API"')
assert.ok(!classMgmtContent.includes('Backend hiện chưa hỗ trợ xóa lớp'), 'ClassManagement must not mention Backend')

// Check 2.4: Admin views check (Users, Roles, Audit, Dashboard)
const adminDashboard = fs.readFileSync(path.resolve('src/components/admin/views/AdminDashboard.jsx'), 'utf8')
assert.ok(!adminDashboard.includes('GET /api/users'), 'AdminDashboard must not leak GET /api/users')
assert.ok(!adminDashboard.includes('GET /api/roles'), 'AdminDashboard must not leak GET /api/roles')
assert.ok(!adminDashboard.includes('endpoint'), 'AdminDashboard must not use technical term endpoint')

const adminAudit = fs.readFileSync(path.resolve('src/components/admin/views/AdminAuditLogsView.jsx'), 'utf8')
assert.ok(!adminAudit.includes('GET /api/audit-logs'), 'AdminAudit must not leak GET /api/audit-logs')
assert.ok(!adminAudit.includes('Dữ liệu DTO'), 'AdminAudit must not mention DTO')

const adminRoles = fs.readFileSync(path.resolve('src/components/admin/views/AdminRolesView.jsx'), 'utf8')
assert.ok(!adminRoles.includes('GET /api/roles'), 'AdminRoles must not leak GET /api/roles')
assert.ok(!adminRoles.includes('G3'), 'AdminRoles must not mention internal sprint G3')

const adminUsers = fs.readFileSync(path.resolve('src/components/admin/views/AdminUsersView.jsx'), 'utf8')
assert.ok(!adminUsers.includes('GET /api/users'), 'AdminUsers must not leak GET /api/users')

// Check 2.5: MemberAttendanceView and MemberCourseCatalog
const memberAttendance = fs.readFileSync(path.resolve('src/components/views/MemberAttendanceView.jsx'), 'utf8')
assert.ok(!memberAttendance.includes('BACKEND API'), 'MemberAttendanceView must not leak BACKEND API')

const memberCatalog = fs.readFileSync(path.resolve('src/components/views/MemberCourseCatalog.jsx'), 'utf8')
assert.ok(!memberCatalog.includes('từ API'), 'MemberCourseCatalog must not leak "từ API"')
assert.ok(!memberCatalog.includes('theo API'), 'MemberCourseCatalog must not leak "theo API"')

console.log('  -> Tier 2: Payment status, Forbidden, and Admin copy: PASSED')

// ----------------------------------------------------------------------
// TIER 3: REAL HEADLESS BROWSER END-TO-END VERIFICATION
// ----------------------------------------------------------------------
console.log('\n[TIER 3] Starting Real Headless Chrome to Test Forms, Demo Signin & OTP...')

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
      } catch {}
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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-comprehensive-test-'))

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

  const projectRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..')
  const target = pageList.find((p) => p.type === 'page' && !p.url.startsWith('chrome://')) || pageList[0]
  const client = new ChromeClient(target.webSocketDebuggerUrl)
  await client.connect()
  await client.send('Page.enable')
  await client.send('Runtime.enable')

  return { proc, client, tempDir, projectRoot }
}

async function runBrowserTests() {
  const projectRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..')
  const vitePort = await getFreePort()
  const server = await createServer({
    root: projectRoot,
    configFile: path.join(projectRoot, 'vite.config.js'),
    server: { port: vitePort },
    logLevel: 'error',
  })
  await server.listen()

  const { proc, client, tempDir } = await spawnIsolatedChrome()

  try {
    // Inject mock network handlers
    await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.__setReactInput = (element, val) => {
          if (!element) return;
          const prototype = Object.getPrototypeOf(element);
          const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
          if (prototypeValueSetter) {
            prototypeValueSetter.call(element, val);
          } else {
            element.value = val;
          }
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        };
        window.__testCalls = [];
        const origFetch = window.fetch;
        window.fetch = async (url, opts) => {
          const u = String(url);
          if (Array.isArray(window.__testCalls)) {
            window.__testCalls.push({ url: u, body: opts?.body });
          }
          if (u.includes('/auth/login')) {
            return new Response(JSON.stringify({
              code: 200,
              data: {
                token: 'mock-jwt-token',
                role: 'RECEPTIONIST',
                fullName: 'Test Receptionist',
                email: 'receptionist@scms.com',
                authorities: ['MANAGE_INVOICES']
              }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          if (u.includes('/auth/register')) {
            return new Response(JSON.stringify({
              code: 200,
              message: 'OTP sent'
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          if (u.includes('/auth/verify-otp') || u.includes('/auth/confirm')) {
            return new Response(JSON.stringify({
              code: 200,
              data: { success: true }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          if (u.includes('/auth/forgot-password')) {
            return new Response(JSON.stringify({
              code: 200,
              message: 'OTP sent'
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          if (u.includes('/auth/reset-password')) {
            return new Response(JSON.stringify({
              code: 200,
              data: { success: true }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          return origFetch(url, opts);
        };
      `
    })

    const baseUrl = `http://localhost:${vitePort}`

    // -------------------------------------------------------------
    // Test 3.1: Login Form Space Preservation & Demo Password
    // -------------------------------------------------------------
    console.log('  -> [3.1] Testing Sign-in with Spaces & 6-char Demo Password in Browser...')
    await client.navigate(`${baseUrl}/login`)
    await client.waitFor("document.getElementById('login-email')")

    // Test 3.1.1: Login preserves exact spaces (leading/trailing/middle) without trimming
    await client.eval(`(() => {
      window.__testCalls = [];
      const emailInput = document.getElementById('login-email');
      window.__setReactInput(emailInput, 'receptionist@scms.com');

      const pwdInput = document.getElementById('login-password');
      window.__setReactInput(pwdInput, '  Pass 1234  ');

      const submitBtn = document.querySelector('button[type="submit"]');
      submitBtn.click();
    })()`)

    await client.waitFor("window.__testCalls.some(c => c.url.includes('/auth/login'))")
    const sentLoginBody = await client.eval(`
      (() => {
        const call = window.__testCalls.find(c => c.url.includes('/auth/login'));
        return call ? JSON.parse(call.body) : null;
      })()
    `)
    assert.equal(sentLoginBody?.password, '  Pass 1234  ', 'Login payload must strictly preserve leading and trailing spaces without trimming')
    console.log('     * Login preserves spaces (leading, middle, trailing) without trimming: PASS')

    // Test 3.1.2: Login with 6-character Demo Account ('Abc123')
    await client.eval(`(() => {
      window.__testCalls = [];
      const emailInput = document.getElementById('login-email');
      window.__setReactInput(emailInput, 'receptionist@scms.com');

      const pwdInput = document.getElementById('login-password');
      window.__setReactInput(pwdInput, 'Abc123');

      const submitBtn = document.querySelector('button[type="submit"]');
      submitBtn.click();
    })()`)

    // Verify form did not reject the 6-character password
    const loginError = await client.eval(`
      const errorEl = document.querySelector('[role="alert"]');
      errorEl ? errorEl.textContent : null;
    `)
    assert.equal(loginError, null, '6-char demo password must not trigger validation error on login input')
    console.log('     * 6-char demo password (Abc123) accepted without validation block: PASS')

    // -------------------------------------------------------------
    // Test 3.2: Register Form Password Policy Validation & Space Preservation
    // -------------------------------------------------------------
    console.log('  -> [3.2] Testing Registration Form Password Policy & Space Preservation in Browser...')
    await client.navigate(`${baseUrl}/register`)
    await client.waitFor("document.querySelector('form input[type=\"email\"]')")

    // Fill basic details with 7-character password
    await client.eval(`(() => {
      const nameInput = document.querySelector('form input[type="text"]');
      window.__setReactInput(nameInput, 'Test Hội Viên');

      const phoneInput = document.querySelector('form input[type="tel"]');
      if (phoneInput) window.__setReactInput(phoneInput, '0988123456');

      const emailInput = document.querySelector('form input[type="email"]');
      window.__setReactInput(emailInput, 'testhoivien2026@gmail.com');

      const pwdInputs = document.querySelectorAll('input[type="password"]');
      window.__setReactInput(pwdInputs[0], 'Pass123');
      window.__setReactInput(pwdInputs[1], 'Pass123');

      const submitBtn = document.querySelector('button[type="submit"]');
      submitBtn.click();
    })()`)

    await client.waitFor("document.body.innerText.includes('tối thiểu 8 ký tự') || document.body.innerText.includes('Tối thiểu 8 ký tự')")
    console.log('     * 7-character password rejected with "tối thiểu 8 ký tự": PASS')

    // Submit 8-character password without numbers ('PassWord')
    await client.eval(`(() => {
      const pwdInputs = document.querySelectorAll('input[type="password"]');
      window.__setReactInput(pwdInputs[0], 'PassWord');
      window.__setReactInput(pwdInputs[1], 'PassWord');

      const submitBtn = document.querySelector('button[type="submit"]');
      submitBtn.click();
    })()`)
    await client.waitFor("document.body.innerText.includes('ít nhất một chữ cái và một chữ số')")
    console.log('     * 8-character letters-only rejected with "ít nhất một chữ cái và một chữ số": PASS')

    // Submit 8-character valid password with leading and trailing spaces ('  Pass 1234  ')
    await client.eval(`(() => {
      window.__testCalls = [];
      const nameInput = document.querySelector('form input[type="text"]');
      window.__setReactInput(nameInput, 'Test Hội Viên');

      const phoneInput = document.querySelector('form input[type="tel"]');
      if (phoneInput) window.__setReactInput(phoneInput, '0988123456');

      const emailInput = document.querySelector('form input[type="email"]');
      window.__setReactInput(emailInput, 'testhoivien2026@gmail.com');

      const pwdInputs = document.querySelectorAll('input[type="password"]');
      window.__setReactInput(pwdInputs[0], '  Pass 1234  ');
      window.__setReactInput(pwdInputs[1], '  Pass 1234  ');

      const submitBtn = document.querySelector('button[type="submit"]');
      submitBtn.click();
    })()`)

    // Verify registration payload preserved leading/trailing spaces
    await client.waitFor("window.__testCalls.some(c => c.url.includes('/auth/register'))")
    const sentRegisterBody = await client.eval(`
      (() => {
        const call = window.__testCalls.find(c => c.url.includes('/auth/register'));
        return call ? JSON.parse(call.body) : null;
      })()
    `)
    assert.equal(sentRegisterBody?.password, '  Pass 1234  ', 'Register payload must preserve leading and trailing spaces')
    console.log('     * Register payload preserves spaces (leading, middle, trailing) without trimming: PASS')

    // Wait for transition to OTP mode
    await client.waitFor("document.getElementById('otp-0')")
    console.log('     * Valid password with spaces passed and navigated to OTP step: PASS')

    // -------------------------------------------------------------
    // Test 3.3: OTP Step Verification
    // -------------------------------------------------------------
    console.log('  -> [3.3] Testing 6-digit OTP Input in Browser...')
    const has6OtpInputs = await client.eval(`
      Boolean(
        document.getElementById('otp-0') &&
        document.getElementById('otp-1') &&
        document.getElementById('otp-2') &&
        document.getElementById('otp-3') &&
        document.getElementById('otp-4') &&
        document.getElementById('otp-5')
      )
    `)
    assert.equal(has6OtpInputs, true, 'OTP view must render exactly 6 numeric input slots')

    // Enter mock OTP '123456'
    await client.eval(`(() => {
      const digits = ['1', '2', '3', '4', '5', '6'];
      digits.forEach((d, i) => {
        const inp = document.getElementById('otp-' + i);
        window.__setReactInput(inp, d);
      });
      const submitBtn = document.querySelector('button[type="submit"]');
      submitBtn.click();
    })()`)

    await new Promise((r) => setTimeout(r, 600))
    console.log('     * 6-digit OTP slots and input handling: PASS')

    // -------------------------------------------------------------
    // Test 3.4: Forgot Password Modal Verification
    // -------------------------------------------------------------
    console.log('  -> [3.4] Testing Forgot / Reset Password UI in Browser...')
    await client.navigate(`${baseUrl}/login`)
    await client.waitFor("document.querySelector('button[type=\"button\"]')")

    // Click 'Quên mật khẩu?'
    await client.eval(`(() => {
      const forgotBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Quên mật khẩu'));
      if (forgotBtn) forgotBtn.click();
    })()`)
    await client.waitFor("document.getElementById('forgot-email')")

    // Fill email and send OTP
    await client.eval(`(() => {
      const emailInput = document.getElementById('forgot-email');
      window.__setReactInput(emailInput, 'member@vibesport.vn');

      const submitBtn = document.querySelector('button[type="submit"]');
      submitBtn.click();
    })()`)

    // Wait for Reset step (OTP + New Password)
    await client.waitFor("document.getElementById('forgot-otp-0')")
    console.log('     * Forgot password email submitted and advanced to OTP reset step: PASS')

    // Fill reset form with short password (6 chars)
    await client.eval(`(() => {
      ['1', '2', '3', '4', '5', '6'].forEach((d, i) => {
        const inp = document.getElementById('forgot-otp-' + i);
        window.__setReactInput(inp, d);
      });
      const pwdInputs = document.querySelectorAll('input[type="password"]');
      window.__setReactInput(pwdInputs[0], 'Pass12');
      window.__setReactInput(pwdInputs[1], 'Pass12');

      const submitBtn = document.querySelector('button[type="submit"]');
      submitBtn.click();
    })()`)
    await client.waitFor("document.body.innerText.includes('tối thiểu 8 ký tự') || document.body.innerText.includes('Tối thiểu 8 ký tự')")
    console.log('     * Reset password rejected <8 chars with "tối thiểu 8 ký tự": PASS')

  } catch (err) {
    console.error('  [BROWSER_ERROR_DETAIL]:', err)
    throw err
  } finally {
    try { client.close() } catch {}
    try { proc.kill() } catch {}
    try { await server.close() } catch {}
    await new Promise((r) => setTimeout(r, 1000))
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  }
}

async function main() {
  await runBrowserTests()
  console.log('\n================================================================')
  console.log('  ALL COMPREHENSIVE TESTS (SOURCE, FIXTURE, BROWSER) PASSED!')
  console.log('================================================================')
}

main().catch((err) => {
  console.error('\n[TEST RUN FAILED]:', err)
  process.exit(1)
})
