import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';
import url from 'node:url';
import { createServer } from 'vite';

console.log('================================================================');
console.log('  RUNNING REAL HEADLESS CHROME BROWSER COMPONENT TEST SUITE');
console.log('  TARGETS: PersonalProfileView & NewStaffModal (ISOLATED FIXTURE)');
console.log('================================================================');

class ChromeClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.msgId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.msgId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      const desc = res.exceptionDetails.exception?.description || res.exceptionDetails.text;
      throw new Error(`Eval failed: ${desc}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async waitFor(expression, timeoutMs = 12000, pollIntervalMs = 150) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const val = await this.eval(`Boolean(${expression})`);
        if (val) return val;
      } catch {
        // wait for DOM to mount
      }
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
    throw new Error(`Timeout waiting for expression: ${expression}`);
  }

  async navigate(targetUrl) {
    await this.send('Page.navigate', { url: targetUrl });
    await new Promise((r) => setTimeout(r, 600));
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

async function spawnIsolatedChrome() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const cdpPort = await getFreePort();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-profile-staff-test-'));

  const proc = spawn(
    chromePath,
    [
      `--remote-debugging-port=${cdpPort}`,
      '--remote-debugging-address=127.0.0.1',
      '--disable-extensions',
      '--disable-gpu',
      '--no-sandbox',
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1280,900',
      `--user-data-dir=${tempDir}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  let pageList = [];
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
      if (res.ok) {
        pageList = await res.json();
        if (pageList.length > 0) break;
      }
    } catch {}
  }

  if (pageList.length === 0) {
    throw new Error(`Failed to initialize Chrome on port ${cdpPort}`);
  }

  const target = pageList.find((p) => p.type === 'page' && !p.url.startsWith('chrome-extension://') && !p.url.startsWith('chrome://')) || pageList[0];
  const client = new ChromeClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send('Page.enable');
  await client.send('Runtime.enable');

  return { client, proc, tempDir };
}

async function runBrowserComponentSuite() {
  const projectRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
  process.chdir(projectRoot);

  const vitePort = await getFreePort();

  const viteServer = await createServer({
    root: projectRoot,
    configFile: path.join(projectRoot, 'vite.config.js'),
    server: { host: 'localhost', port: vitePort },
    logLevel: 'error',
  });
  await viteServer.listen();

  const { client, proc, tempDir } = await spawnIsolatedChrome();

  try {
    // Inject mock network interceptor & helper in browser document
    await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        sessionStorage.setItem('scms_language', 'vi');
        if (!sessionStorage.getItem('scms_mock_role')) {
          sessionStorage.setItem('scms_mock_role', 'member');
          sessionStorage.setItem('rbac_test_role', 'Member');
        }
        sessionStorage.setItem('scms_mock_authenticated', 'true');

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

        window.__capturedCalls = {
          changePassword: [],
          createStaff: []
        };

        const origFetch = window.fetch;
        window.fetch = async (input, init = {}) => {
          const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
          const method = (init.method || (input && input.method) || 'GET').toUpperCase();
          const mockRole = (sessionStorage.getItem('scms_mock_role') || 'member').toLowerCase();

          // Intercept GET /api/auth/me
          if (urlStr.includes('/api/auth/me') && method === 'GET') {
            if (mockRole === 'member') {
              return new Response(JSON.stringify({
                userId: 101,
                id: 101,
                email: 'member.test@scms.vn',
                fullName: 'Hội Viên Test',
                name: 'Hội Viên Test',
                role: 'Member',
                authorities: ['MEMBER'],
                firstLogin: false,
                memberId: 101
              }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              });
            } else {
              return new Response(JSON.stringify({
                userId: 2,
                id: 2,
                email: 'manager@scms.com',
                fullName: 'Quản Lý Demo',
                name: 'Quản Lý Demo',
                role: 'Manager',
                authorities: ['ALL'],
                firstLogin: false
              }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              });
            }
          }

          // Intercept GET /api/members/me or /api/members/101
          if (urlStr.includes('/api/members/me') || (urlStr.includes('/api/members/101') && method === 'GET')) {
            return new Response(JSON.stringify({
              id: 101,
              name: 'Hội Viên Test',
              email: 'member.test@scms.vn',
              phone: '0912345678',
              gender: 'Nam',
              dateOfBirth: '1995-05-15',
              address: '123 Đường Test, Quận 1',
              goal: 'Tăng cơ giảm mỡ',
              healthNote: 'Không có tiền sử bệnh lý'
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // Intercept POST /api/auth/change-password
          if (urlStr.includes('/api/auth/change-password') && method === 'POST') {
            const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
            window.__capturedCalls.changePassword.push(body);
            return new Response(JSON.stringify({ success: true, message: 'Đổi mật khẩu thành công.' }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // Intercept POST /api/staff
          if (urlStr.includes('/api/staff') && method === 'POST') {
            const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
            window.__capturedCalls.createStaff.push(body);
            return new Response(JSON.stringify({ id: 999, ...body, status: 'Active' }), {
              status: 201,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // Intercept GET /api/staff
          if (urlStr.includes('/api/staff') && method === 'GET') {
            return new Response(JSON.stringify([
              { id: 10, name: 'HLV Minh', email: 'coach.minh@scms.demo', role: 'Coach', phone: '0901234567' }
            ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          // Fallback for any /api/ to prevent 401/network errors triggering UNAUTHORIZED_EVENT
          if (urlStr.startsWith('/api') || urlStr.includes('/api/')) {
            return new Response(JSON.stringify([]), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          return origFetch(input, init);
        };
      `
    });

    const baseUrl = `http://localhost:${vitePort}`;

    // =========================================================================
    // KỊCH BẢN 1: BROWSER TEST TRÊN PersonalProfileView (Đổi mật khẩu cá nhân)
    // =========================================================================
    console.log('\n[SCENARIO 1] Testing PersonalProfileView Real Component in Browser...');
    await client.navigate(`${baseUrl}/profile`);

    // Chờ form đổi mật khẩu xuất hiện trong DOM (3 input password: mật khẩu cũ, mật khẩu mới, xác nhận)
    await client.waitFor(`document.querySelectorAll('input[type="password"]').length >= 3`, 15000);
    console.log('  -> PersonalProfileView mounted in browser with password form.');

    // Helper set giá trị vào 3 input mật khẩu của PersonalProfileView
    const setPasswordFormValues = async (oldPwd, newPwd, confirmPwd) => {
      await client.eval(`(() => {
        const inputs = Array.from(document.querySelectorAll('input[type="password"]'));
        window.__setReactInput(inputs[0], ${JSON.stringify(oldPwd)});
        window.__setReactInput(inputs[1], ${JSON.stringify(newPwd)});
        window.__setReactInput(inputs[2], ${JSON.stringify(confirmPwd)});
      })()`);
    };

    const submitPasswordForm = async () => {
      await client.eval(`(() => {
        // Find the form containing the password inputs
        const pwdInput = document.querySelector('input[type="password"]');
        const form = pwdInput.closest('form');
        const btn = form.querySelector('button[type="submit"]');
        if (btn) btn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 400));
    };

    // 1.1 Kiểm tra mật khẩu 7 ký tự bị chặn
    console.log('  -> [1.1] Testing 7-character password rejected on browser...');
    await setPasswordFormValues('CurrentPass123', 'Pass123', 'Pass123');
    await submitPasswordForm();
    const errText7 = await client.eval(`(() => {
      const errBox = document.querySelector('[role="alert"]');
      return errBox ? errBox.textContent : '';
    })()`);
    assert.ok(errText7.includes('8 ký tự'), `Expected 8-character rule in error box, got: "${errText7}"`);
    const callsAfter7 = await client.eval(`window.__capturedCalls.changePassword.length`);
    assert.strictEqual(callsAfter7, 0, 'No API call should be sent when validation fails');
    console.log('     * PASS: 7-character password blocked with policy message on UI.');

    // 1.2 Kiểm tra mật khẩu 8 ký tự toàn chữ bị chặn
    console.log('  -> [1.2] Testing letters-only password rejected on browser...');
    await setPasswordFormValues('CurrentPass123', 'PasswordOnly', 'PasswordOnly');
    await submitPasswordForm();
    const errTextAlpha = await client.eval(`(() => {
      const errBox = document.querySelector('[role="alert"]');
      return errBox ? errBox.textContent : '';
    })()`);
    assert.ok(errTextAlpha.includes('chữ số'), `Expected missing digit error, got: "${errTextAlpha}"`);
    const callsAfterAlpha = await client.eval(`window.__capturedCalls.changePassword.length`);
    assert.strictEqual(callsAfterAlpha, 0);
    console.log('     * PASS: Letters-only password blocked on UI.');

    // 1.3 Kiểm tra xác nhận mật khẩu không khớp bị chặn
    console.log('  -> [1.3] Testing mismatched confirmation password rejected on browser...');
    await setPasswordFormValues('CurrentPass123', 'ValidPass123', 'DifferentPass456');
    await submitPasswordForm();
    const errTextMismatch = await client.eval(`(() => {
      const errBox = document.querySelector('[role="alert"]');
      return errBox ? errBox.textContent : '';
    })()`);
    assert.ok(errTextMismatch.includes('không khớp'), `Expected mismatch error, got: "${errTextMismatch}"`);
    const callsAfterMismatch = await client.eval(`window.__capturedCalls.changePassword.length`);
    assert.strictEqual(callsAfterMismatch, 0);
    console.log('     * PASS: Mismatched confirmation password blocked on UI.');

    // 1.4 Kiểm tra mật khẩu hợp lệ có khoảng trắng đầu/giữa/cuối được gửi NGUYÊN BẢN
    console.log('  -> [1.4] Testing password with leading/middle/trailing whitespace in browser...');
    const whitespacePwd = '   Secret Pass 2026   ';
    await setPasswordFormValues('CurrentPass123', whitespacePwd, whitespacePwd);
    await submitPasswordForm();
    await new Promise((r) => setTimeout(r, 600));

    const callsAfterSuccess = await client.eval(`window.__capturedCalls.changePassword`);
    assert.strictEqual(callsAfterSuccess.length, 1, 'Exactly 1 API request should be sent');
    assert.strictEqual(callsAfterSuccess[0].newPassword, whitespacePwd, 'Payload must preserve exact leading/middle/trailing whitespace');
    assert.strictEqual(callsAfterSuccess[0].newPassword.length, whitespacePwd.length);
    console.log('     * PASS: Password with whitespace sent intact to /api/auth/change-password without trimming.');

    // =========================================================================
    // KỊCH BẢN 2: BROWSER TEST TRÊN NewStaffModal (Tạo nhân viên & Mật khẩu)
    // =========================================================================
    console.log('\n[SCENARIO 2] Testing NewStaffModal Real Component in Browser...');

    // Switch session mock role to Manager
    await client.eval(`(() => {
      window.__currentMockRole = 'manager';
      sessionStorage.setItem('scms_mock_role', 'manager');
      sessionStorage.setItem('rbac_test_role', 'Manager');
    })()`);

    await client.navigate(`${baseUrl}/manager/staff`);

    // Chờ trang Staff Management tải xong
    await client.waitFor(`document.body.textContent.includes('Nhân viên') || document.body.textContent.includes('Staff')`, 12000);

    // Click nút "Thêm nhân viên"
    await client.eval(`(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const addBtn = btns.find(b => b.textContent.includes('Thêm nhân viên') || b.textContent.includes('Add Staff'));
      if (addBtn) addBtn.click();
    })()`);

    // Chờ NewStaffModal xuất hiện trong DOM
    await client.waitFor(`document.querySelector('.fixed.inset-0') !== null`, 8000);
    console.log('  -> NewStaffModal opened in browser.');

    // Helper điền form NewStaffModal
    const fillStaffForm = async ({ name, email, role, password, confirmPassword }) => {
      await client.eval(`(() => {
        const modal = document.querySelector('.fixed.inset-0');
        const nameInput = modal.querySelector('input[type="text"]');
        const emailInput = modal.querySelector('input[type="email"]');
        if (nameInput) window.__setReactInput(nameInput, ${JSON.stringify(name)});
        if (emailInput) window.__setReactInput(emailInput, ${JSON.stringify(email)});

        // Select role
        const select = modal.querySelector('select');
        if (select) {
          select.value = ${JSON.stringify(role)};
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Password inputs: placeholder contains '8 ký tự' and placeholder contains 'Nhập lại'
        const allInputs = Array.from(modal.querySelectorAll('input'));
        const tempPwdInput = allInputs.find(i => i.placeholder && i.placeholder.includes('8 ký tự'));
        const confirmPwdInput = allInputs.find(i => i.placeholder && (i.placeholder.includes('Nhập lại') || i.placeholder.includes('Confirm')));

        if (tempPwdInput) window.__setReactInput(tempPwdInput, ${JSON.stringify(password)});
        if (confirmPwdInput) window.__setReactInput(confirmPwdInput, ${JSON.stringify(confirmPassword)});
      })()`);
    };

    const submitStaffForm = async () => {
      await client.eval(`(() => {
        const modal = document.querySelector('.fixed.inset-0');
        const submitBtn = modal.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 400));
    };

    // 2.1 Kiểm tra mật khẩu nhân viên 7 ký tự bị chặn
    console.log('  -> [2.1] Testing 7-character staff password rejected on browser...');
    await fillStaffForm({
      name: 'Nguyễn Văn Coach',
      email: 'coach.test@example.com',
      role: 'coach',
      password: 'Coach12',
      confirmPassword: 'Coach12'
    });
    await submitStaffForm();
    const staffPwdErr7 = await client.eval(`(() => {
      const errs = Array.from(document.querySelectorAll('.text-rose-600'));
      return errs.map(e => e.textContent).join(' ');
    })()`);
    assert.ok(staffPwdErr7.includes('8 ký tự'), `Expected 8-character rule in staff modal, got: "${staffPwdErr7}"`);
    const staffCalls7 = await client.eval(`window.__capturedCalls.createStaff.length`);
    assert.strictEqual(staffCalls7, 0, 'No staff API call when validation fails');
    console.log('     * PASS: 7-character staff password blocked with validation message.');

    // 2.2 Kiểm tra xác nhận mật khẩu nhân viên sai bị chặn
    console.log('  -> [2.2] Testing mismatched staff confirmation password rejected on browser...');
    await fillStaffForm({
      name: 'Nguyễn Văn Coach',
      email: 'coach.test@example.com',
      role: 'coach',
      password: 'CoachPass123',
      confirmPassword: 'WrongConfirm456'
    });
    await submitStaffForm();
    const staffMismatchErr = await client.eval(`(() => {
      const errs = Array.from(document.querySelectorAll('.text-rose-600'));
      return errs.map(e => e.textContent).join(' ');
    })()`);
    assert.ok(staffMismatchErr.includes('không trùng khớp') || staffMismatchErr.includes('not match'), `Expected mismatch error, got: "${staffMismatchErr}"`);
    const staffCallsMismatch = await client.eval(`window.__capturedCalls.createStaff.length`);
    assert.strictEqual(staffCallsMismatch, 0);
    console.log('     * PASS: Mismatched staff confirmation password blocked.');

    // 2.3 Kiểm tra mật khẩu nhân viên có khoảng trắng đầu/giữa/cuối được gửi NGUYÊN BẢN
    console.log('  -> [2.3] Testing staff password with leading/middle/trailing whitespace in browser...');
    const staffWhitespacePwd = '   Staff Pass 2026! 1   ';
    await fillStaffForm({
      name: 'Nguyễn Văn Coach',
      email: 'coach.test@example.com',
      role: 'coach',
      password: staffWhitespacePwd,
      confirmPassword: staffWhitespacePwd
    });
    await submitStaffForm();
    await new Promise((r) => setTimeout(r, 600));

    const staffCallsSuccess = await client.eval(`window.__capturedCalls.createStaff`);
    assert.strictEqual(staffCallsSuccess.length, 1, 'Exactly 1 staff API call should be sent');
    assert.strictEqual(staffCallsSuccess[0].password, staffWhitespacePwd, 'Staff payload must preserve whitespace');
    assert.strictEqual(staffCallsSuccess[0].password.length, staffWhitespacePwd.length);
    console.log('     * PASS: Staff password with whitespace preserved completely in API payload.');

    console.log('\n================================================================');
    console.log('  ALL BROWSER COMPONENT TESTS (PROFILE & STAFF) PASSED (100%)');
    console.log('================================================================');
  } finally {
    client.close();
    proc.kill('SIGKILL');
    await viteServer.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

runBrowserComponentSuite().catch((err) => {
  console.error('Browser Test Suite Failed:', err);
  process.exit(1);
});
