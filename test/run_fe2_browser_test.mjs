/**
 * FE 2 Browser Verification Test Suite: PaymentModal End-to-End Workflow
 *
 * Verifies in real headless Chromium:
 * 1. Modal open/render and authoritative member/package lists.
 * 2. Missing invoice ID error handling (no silent skip of pay, no false success).
 * 3. Cash pay failure: partial state retained, member/package/method fields frozen.
 * 4. Retry cash collection: zero duplicate subscriptions or invoices created.
 * 5. Online/Bank transfer: pending invoice created, no pay call, pending toast shown.
 * 6. Close & reopen reconciliation: in-progress transaction restored and can be discarded.
 */

import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import net from 'net';
import url from 'url';
import { createServer } from 'vite';

const projectRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
process.chdir(projectRoot);

class ChromeClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
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
    const id = this.id++;
    return new Promise((resolve, reject) => {
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

  async waitFor(expression, timeoutMs = 8000, pollIntervalMs = 150) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const val = await this.eval(`Boolean(${expression})`);
        if (val) return val;
      } catch (e) {}
      await new Promise(r => setTimeout(r, pollIntervalMs));
    }
    throw new Error(`Timeout waiting for expression: ${expression}`);
  }

  async navigate(targetUrl) {
    await this.send('Page.navigate', { url: targetUrl });
    await new Promise(r => setTimeout(r, 600));
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-fe2-test-'));

  const proc = spawn(chromePath, [
    `--remote-debugging-port=${cdpPort}`,
    '--remote-debugging-address=127.0.0.1',
    '--disable-gpu',
    '--no-sandbox',
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,900',
    `--user-data-dir=${tempDir}`,
    'about:blank'
  ], { stdio: 'ignore' });

  let pageList = [];
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
      if (res.ok) {
        pageList = await res.json();
        if (pageList.length > 0) break;
      }
    } catch (e) {}
  }

  if (pageList.length === 0) {
    throw new Error(`Failed to initialize Chrome on port ${cdpPort}`);
  }

  const target = pageList.find(p => p.type === 'page' && !p.url.startsWith('chrome://')) || pageList[0];
  const client = new ChromeClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send('Page.enable');
  await client.send('Runtime.enable');

  return { client, proc, tempDir, cdpPort };
}

async function main() {
  console.log('================================================================');
  console.log('  RUNNING FE 2 PAYMENT MODAL REAL BROWSER VERIFICATION MATRIX');
  console.log('================================================================\n');

  const results = [];
  function record(id, title, pass, details = {}) {
    results.push({ id, title, pass, details });
    const mark = pass ? '✅ PASS' : '❌ FAIL';
    console.log(`[${id}] ${mark}: ${title}`);
    if (!pass || process.env.VERBOSE) {
      console.log('       Trace:', JSON.stringify(details));
    }
  }

  const vitePort = await getFreePort();
  const viteServer = await createServer({
    server: { port: vitePort },
    mode: 'development',
    define: {
      'import.meta.env.VITE_TEST_HARNESS': JSON.stringify('true'),
      'import.meta.env.VITE_API_ENABLED': JSON.stringify('true'),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(''),
      'import.meta.env.VITE_API_PROXY_TARGET': JSON.stringify(''),
    },
  });
  await viteServer.listen();
  console.log(`[Setup] Vite test server listening at http://localhost:${vitePort}`);

  const { client, proc, tempDir } = await spawnIsolatedChrome();
  console.log('[Setup] Isolated Chromium instance launched');

  client.send('Log.enable');
  client.ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('[Browser Console]', msg.params.type, msg.params.args?.map(a => a.value || a.description).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.log('[Browser Exception]', msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
    }
    if (msg.id && client.pending.has(msg.id)) {
      const { resolve, reject } = client.pending.get(msg.id);
      client.pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  };

  try {
    const baseUrl = `http://localhost:${vitePort}`;

    // Install mock fetch and auth interception into every new document
    await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        if (!sessionStorage.getItem('scms_mock_authenticated')) {
          sessionStorage.setItem('scms_mock_authenticated', 'true');
        }
        if (!sessionStorage.getItem('scms_mock_role')) {
          sessionStorage.setItem('scms_mock_role', 'receptionist');
        }

        window.__fe2NetworkCalls = window.__fe2NetworkCalls || {
          subscribeCalls: [],
          createInvoiceCalls: [],
          payInvoiceCalls: [],
          cancelInvoiceCalls: [],
          cancelSubscriptionCalls: [],
        };
        window.__fe2MockConfig = window.__fe2MockConfig || {
          missingInvoiceId: false,
          failPayInvoice: false,
          failMemberData: false,
          memberSubscriptions: [],
        };

        const origFetch = window.fetch;
        window.fetch = async (input, init = {}) => {
          const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
          const method = (init.method || 'GET').toUpperCase();

          // Mock Login
          if (urlStr.includes('/api/auth/login') && method === 'POST') {
            const role = sessionStorage.getItem('scms_mock_role') || 'receptionist';
            if (role === 'member') {
              return new Response(JSON.stringify({
                userId: 13,
                memberId: 7,
                email: 'member7@scms.com',
                fullName: 'Hoàng Thị Oánh',
                role: 'Member',
                authorities: ['VIEW_OWN_MEMBERSHIP', 'VIEW_PACKAGES']
              }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
            return new Response(JSON.stringify({
              userId: 5,
              email: 'receptionist@scms.com',
              fullName: 'Phạm Thị Thu',
              role: 'Receptionist',
              authorities: ['RECORD_PAYMENT', 'MANAGE_INVOICES']
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          // Mock Auth Current User
          if (urlStr.includes('/api/auth/me')) {
            const role = sessionStorage.getItem('scms_mock_role') || 'receptionist';
            if (role === 'member') {
              return new Response(JSON.stringify({
                userId: 13,
                memberId: 7,
                email: 'member7@scms.com',
                fullName: 'Hoàng Thị Oánh',
                role: 'Member',
                authorities: ['VIEW_OWN_MEMBERSHIP', 'VIEW_PACKAGES']
              }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
            return new Response(JSON.stringify({
              userId: 5,
              email: 'receptionist@scms.com',
              fullName: 'Phạm Thị Thu',
              role: 'Receptionist',
              authorities: ['RECORD_PAYMENT', 'MANAGE_INVOICES']
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          // Mock invoices list
          if (urlStr.includes('/api/invoices') && method === 'GET') {
            return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          // Mock members (including member 101, 102, profile 7 and foreign profile 13 with id equal to userId 13)
          if (urlStr.includes('/api/members') && method === 'GET' && !urlStr.includes('/packages')) {
            return new Response(JSON.stringify([
              { id: 101, name: 'Nguyễn Minh Anh', code: 'MB-101', phone: '0988111222' },
              { id: 102, name: 'Lê Hoàng Nam', code: 'MB-102', phone: '0988222333' },
              {
                id: 7,
                userId: 13,
                name: 'Hoàng Thị Oánh',
                email: 'member7@scms.com',
                phone: '0901234567',
                code: '',
                coachName: 'HLV Trần Văn A',
                primaryCoachName: 'HLV Trần Văn A',
                status: 'ACTIVE'
              },
              {
                id: 13,
                userId: 999,
                name: 'Người Khác Có ID 13',
                code: 'MB-FOREIGN-13',
                phone: '0999999999',
                coachName: 'Coach Lạ Xa Lạ',
                primaryCoachName: 'Coach Lạ Xa Lạ',
                status: 'ACTIVE'
              }
            ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          // Mock member subscriptions
          if (urlStr.includes('/api/members/') && urlStr.includes('/packages') && method === 'GET') {
            const failData = sessionStorage.getItem('fe2_mock_fail_member_data') === 'true' || Boolean(window.__fe2MockConfig?.failMemberData);
            if (failData) {
              return new Response(JSON.stringify({
                message: 'Lỗi nạp đăng ký gói thành viên từ máy chủ (500 Internal Server Error)'
              }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
            const storedSubs = sessionStorage.getItem('fe2_mock_member_subs');
            const subsList = storedSubs ? JSON.parse(storedSubs) : (window.__fe2MockConfig?.memberSubscriptions || []);
            return new Response(JSON.stringify(subsList), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // Mock packages
          if (urlStr.includes('/api/public/membership-packages') && method === 'GET') {
            const failData = sessionStorage.getItem('fe2_mock_fail_member_data') === 'true' || Boolean(window.__fe2MockConfig?.failMemberData);
            if (failData) {
              return new Response(JSON.stringify({
                message: 'Lỗi nạp danh mục gói thành viên từ máy chủ (500 Internal Server Error)'
              }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
            return new Response(JSON.stringify([
              { id: 12, name: 'VIP Elite Club', price: 11500000, durationDays: 365, status: 'ACTIVE', description: 'Gói thượng hạng đầy đủ dịch vụ' },
              { id: 13, name: 'Basic Fitness', price: 1200000, durationDays: 30, status: 'ACTIVE', description: 'Gói cơ bản tập gym' }
            ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          // Mock subscribe package
          if (urlStr.includes('/api/members/') && urlStr.includes('/packages') && method === 'POST') {
            const body = init.body ? JSON.parse(init.body) : {};
            window.__fe2NetworkCalls.subscribeCalls.push({ url: urlStr, body });
            return new Response(JSON.stringify({
              subscriptionId: 99,
              memberId: 101,
              packageId: body.packageId,
              status: 'ACTIVE'
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          // Mock create invoice
          if (urlStr.includes('/api/invoices') && method === 'POST' && !urlStr.includes('/pay')) {
            const body = init.body ? JSON.parse(init.body) : {};
            window.__fe2NetworkCalls.createInvoiceCalls.push({ url: urlStr, body });

            if (window.__fe2MockConfig.missingInvoiceId) {
              // Intentionally return response missing id and invoiceId
              return new Response(JSON.stringify({
                memberId: body.memberId,
                amount: body.amount,
                paymentStatus: 'PENDING'
              }), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }

            return new Response(JSON.stringify({
              invoiceId: 42,
              memberId: body.memberId,
              packageId: body.packageId,
              amount: body.amount,
              paymentMethod: body.paymentMethod,
              paymentStatus: body.paymentStatus || 'PENDING'
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          // Mock pay invoice
          if (urlStr.includes('/api/invoices/') && urlStr.includes('/pay') && method === 'POST') {
            const body = init.body ? JSON.parse(init.body) : {};
            window.__fe2NetworkCalls.payInvoiceCalls.push({ url: urlStr, body });

            if (window.__fe2MockConfig.failPayInvoice) {
              return new Response(JSON.stringify({
                message: 'Lỗi hệ thống thu tiền mặt (500 Internal Error)'
              }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }

            return new Response(JSON.stringify({
              invoiceId: 42,
              paymentStatus: 'PAID',
              paymentMethod: body.paymentMethod
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          // Mock Cancel Invoice status (PATCH /api/invoices/{id}/status)
          if (urlStr.includes('/api/invoices/') && urlStr.includes('/status') && method === 'PATCH') {
            const body = init.body ? JSON.parse(init.body) : {};
            window.__fe2NetworkCalls.cancelInvoiceCalls.push({ url: urlStr, body });
            return new Response(JSON.stringify({
              invoiceId: 42,
              paymentStatus: body.status || 'CANCELLED'
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          // Mock Cancel Member Package status (PATCH /api/member-packages/{id}/status)
          if (urlStr.includes('/api/member-packages/') && urlStr.includes('/status') && method === 'PATCH') {
            const body = init.body ? JSON.parse(init.body) : {};
            window.__fe2NetworkCalls.cancelSubscriptionCalls.push({ url: urlStr, body });
            return new Response(JSON.stringify({
              subscriptionId: 99,
              status: body.status || 'CANCELLED'
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          // Catch any other /api/* call to prevent live BE 401 from triggering UNAUTHORIZED_EVENT
          if (urlStr.includes('/api/')) {
            return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          return origFetch(input, init);
        };
      `
    });

    // Ensure landed on Receptionist Dashboard
    await client.navigate(`${baseUrl}/receptionist/dashboard`);
    await client.waitFor("window.location.pathname === '/receptionist/dashboard'", 10000);
    // Wait for Suspense lazy component in main to load
    await client.waitFor("document.querySelector('main button') !== null", 10000);
    console.log('[Setup] Landed on Receptionist Dashboard, path:', await client.eval('window.location.pathname'));

    // Open PaymentModal directly from Receptionist Dashboard
    console.log('[Test] Opening PaymentModal from Receptionist Dashboard...');
    const btnClick = await client.eval(`
      (() => {
        const allBtns = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
        const btn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.includes('Thu tiền & Ghi nhận') ||
          b.textContent.includes('Record Payment')
        );
        if (btn) {
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          btn.click();
          return { found: true, text: btn.textContent };
        }
        return { found: false, allBtns };
      })()
    `);
    console.log('[Test] Button click result:', btnClick);
    await new Promise(r => setTimeout(r, 600));

    const checkDialog = await client.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        return {
          hasDialog: Boolean(dialog),
          allRoles: Array.from(document.querySelectorAll('[role]')).map(el => el.getAttribute('role')),
          bodySnippet: document.body.innerHTML.slice(0, 1000)
        };
      })()
    `);
    console.log('[Test] Dialog check after 600ms:', checkDialog);

    await client.waitFor("document.querySelector('div[role=\"dialog\"]')", 10000);
    const modalOpened = await client.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        if (!dialog) return null;
        const title = dialog.querySelector('#payment-modal-title')?.textContent || '';
        const selects = dialog.querySelectorAll('select').length;
        const buttons = dialog.querySelectorAll('button').length;
        return { hasDialog: true, title, selects, buttons };
      })()
    `);

    record(
      'FE2-MODAL-RENDER',
      'PaymentModal renders dialog with title, member/package selectors, and payment buttons',
      Boolean(modalOpened?.hasDialog && modalOpened.selects >= 2),
      modalOpened
    );

    // -------------------------------------------------------------------------
    // TEST 2: Missing invoice ID raises explicit error, skips pay, no success toast
    // -------------------------------------------------------------------------
    await client.eval(`
      (() => {
        window.__fe2MockConfig.missingInvoiceId = true;
        window.__fe2MockConfig.failPayInvoice = false;
        window.__fe2NetworkCalls.subscribeCalls = [];
        window.__fe2NetworkCalls.createInvoiceCalls = [];
        window.__fe2NetworkCalls.payInvoiceCalls = [];
      })()
    `);

    // Click submit in modal
    await client.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        const submitBtn = dialog.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
      })()
    `);

    await client.waitFor("document.querySelector('div[role=\"alert\"]')");

    const t2State = await client.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        const alert = dialog ? dialog.querySelector('div[role="alert"]') : null;
        const toast = document.querySelector('#scms-toast');
        return {
          hasAlert: Boolean(alert),
          alertText: alert ? alert.textContent : '',
          isModalOpen: Boolean(dialog),
          toastText: toast ? toast.textContent : null,
          subscribeCount: window.__fe2NetworkCalls.subscribeCalls.length,
          createInvoiceCount: window.__fe2NetworkCalls.createInvoiceCalls.length,
          payInvoiceCount: window.__fe2NetworkCalls.payInvoiceCalls.length,
        };
      })()
    `);

    const t2Pass =
      t2State.hasAlert &&
      t2State.isModalOpen &&
      t2State.payInvoiceCount === 0 &&
      t2State.subscribeCount === 1 &&
      /mã hóa đơn/i.test(t2State.alertText);

    record(
      'FE2-MISSING-INVOICE-ID-GUARD',
      'Missing invoice ID raises explicit error alert, does NOT call payInvoice, does NOT show success',
      t2Pass,
      t2State
    );

    // -------------------------------------------------------------------------
    // TEST 3: Cash Pay failure retains partial state & freezes fields in resumed mode
    // -------------------------------------------------------------------------
    await client.eval(`
      (() => {
        // Discard missing ID, enable failPayInvoice
        window.__fe2MockConfig.missingInvoiceId = false;
        window.__fe2MockConfig.failPayInvoice = true;
      })()
    `);

    // Click submit again to trigger invoice creation + pay failure
    await client.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        const submitBtn = dialog.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
      })()
    `);

    // Wait for in-progress resumed banner to render and submitting state to settle
    await client.waitFor(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        const submitBtn = dialog ? dialog.querySelector('button[type="submit"]') : null;
        return (
          dialog &&
          dialog.textContent.includes('Tiến trình giao dịch đang thực hiện dở dang') &&
          submitBtn &&
          !submitBtn.disabled
        );
      })()
    `);

    const t3State = await client.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        const selects = Array.from(dialog.querySelectorAll('select'));
        const allSelectsDisabled = selects.every(s => s.disabled);
        const submitBtn = dialog.querySelector('button[type="submit"]');
        const toast = document.querySelector('#scms-toast');
        return {
          hasAmberBanner: dialog.textContent.includes('Tiến trình giao dịch đang thực hiện dở dang'),
          hasSubInfo: dialog.textContent.includes('ID #99'),
          hasInvInfo: dialog.textContent.includes('ID #42'),
          allSelectsDisabled,
          submitBtnText: submitBtn ? submitBtn.textContent : '',
          toastText: toast ? toast.textContent : null,
          payInvoiceCount: window.__fe2NetworkCalls.payInvoiceCalls.length,
        };
      })()
    `);

    const t3Pass =
      t3State.hasAmberBanner &&
      t3State.hasSubInfo &&
      t3State.hasInvInfo &&
      t3State.allSelectsDisabled &&
      /Thử lại bước thu tiền/i.test(t3State.submitBtnText);

    record(
      'FE2-CASH-PAY-FAILURE-FREEZE',
      'Cash pay failure keeps modal open, displays partial banner, freezes member/package fields, and offers retry',
      t3Pass,
      t3State
    );

    // -------------------------------------------------------------------------
    // TEST 4: Retry cash payment succeeds with ZERO duplicate calls
    // -------------------------------------------------------------------------
    await client.eval(`
      (() => {
        window.__fe2MockConfig.failPayInvoice = false;
      })()
    `);

    // Click "Thử lại bước thu tiền mặt"
    await client.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        const submitBtn = dialog.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
      })()
    `);

    await client.waitFor("document.querySelector('#scms-toast')");

    const t4State = await client.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        const toast = document.querySelector('#scms-toast');
        return {
          isModalClosed: !dialog,
          toastText: toast ? toast.textContent : '',
          subscribeTotal: window.__fe2NetworkCalls.subscribeCalls.length,
          createInvoiceTotal: window.__fe2NetworkCalls.createInvoiceCalls.length,
          payInvoiceTotal: window.__fe2NetworkCalls.payInvoiceCalls.length,
        };
      })()
    `);

    const t4Pass =
      t4State.isModalClosed &&
      /thu tiền mặt thành công/i.test(t4State.toastText) &&
      t4State.subscribeTotal === 1 && // Not duplicated!
      t4State.createInvoiceTotal === 2 && // 1 from test 2 (missing ID) + 1 from test 3 (failed pay) -> 0 extra created on retry!
      t4State.payInvoiceTotal === 2; // Retried payInvoice

    record(
      'FE2-RETRY-ZERO-DUPLICATES',
      'Retry completes cash payment cleanly with zero duplicate subscriptions or invoices',
      t4Pass,
      t4State
    );

    // -------------------------------------------------------------------------
    // TEST 5: Online / Bank transfer creates pending invoice without pay call
    // -------------------------------------------------------------------------
    // Re-open modal
    await client.eval(`
      (() => {
        window.__fe2NetworkCalls.subscribeCalls = [];
        window.__fe2NetworkCalls.createInvoiceCalls = [];
        window.__fe2NetworkCalls.payInvoiceCalls = [];

        const btn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.includes('Thu tiền & Ghi nhận') || b.textContent.includes('Record Payment')
        );
        if (btn) btn.click();
      })()
    `);

    await client.waitFor("document.querySelector('div[role=\"dialog\"]')");

    // Select Bank Transfer method button
    await client.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        const bankBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent.includes('Chuyển khoản'));
        if (bankBtn) bankBtn.click();
      })()
    `);

    // Submit form
    await client.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        const submitBtn = dialog.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
      })()
    `);

    await client.waitFor("!document.querySelector('div[role=\"dialog\"]')", 8000);
    await client.waitFor(`
      (() => {
        const toast = document.querySelector('#scms-toast');
        return toast && (toast.textContent.includes('Chờ đối soát') || toast.textContent.includes('Pending'));
      })()
    `, 8000);

    const t5State = await client.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        const toast = document.querySelector('#scms-toast');
        return {
          isModalClosed: !dialog,
          toastText: toast ? toast.textContent : '',
          subscribeTotal: window.__fe2NetworkCalls.subscribeCalls.length,
          createInvoiceTotal: window.__fe2NetworkCalls.createInvoiceCalls.length,
          payInvoiceTotal: window.__fe2NetworkCalls.payInvoiceCalls.length,
          invoiceCreatedStatus: window.__fe2NetworkCalls.createInvoiceCalls[0]?.body?.paymentStatus,
        };
      })()
    `);

    const t5Pass =
      t5State.isModalClosed &&
      t5State.payInvoiceTotal === 0 && // No pay call!
      t5State.invoiceCreatedStatus === 'PENDING' &&
      /Chờ đối soát|Chờ thanh toán/i.test(t5State.toastText) &&
      !/đã thanh toán|hoàn tất/i.test(t5State.toastText);

    record(
      'FE2-BANK-TRANSFER-PENDING-STATUS',
      'Bank transfer creates pending invoice without calling payInvoice and displays pending status toast',
      t5Pass,
      t5State
    );

    // -------------------------------------------------------------------------
    // TEST 6: Close & Reopen Restoration and Manual Discard
    // -------------------------------------------------------------------------
    // Seed an in-progress transaction for member 101 with receptionist actorId 5
    await client.eval(`
      (() => {
        if (window.__inProgressTransactionCache) {
          window.__inProgressTransactionCache.set('101', {
            subscriptionId: 555,
            invoiceId: 666,
            packageId: 12,
            method: 'cash',
            sessionRef: 'TXN-REOPEN-555'
          }, 5, 'TXN-REOPEN-555');
        }
      })()
    `);

    // Re-open modal
    await client.eval(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.includes('Thu tiền & Ghi nhận') || b.textContent.includes('Record Payment')
        );
        if (btn) btn.click();
      })()
    `);

    await client.waitFor("document.querySelector('div[role=\"dialog\"]')");

    // Verify amber banner is rendered
    await client.waitFor(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        return dialog && dialog.textContent.includes('Tiến trình giao dịch đang thực hiện dở dang');
      })()
    `);

    const t6Initial = await client.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        return {
          hasBanner: dialog ? dialog.textContent.includes('Tiến trình giao dịch đang thực hiện dở dang') : false,
          hasSub555: dialog ? dialog.textContent.includes('ID #555') : false,
          hasInv666: dialog ? dialog.textContent.includes('ID #666') : false,
        };
      })()
    `);

    // Click "Hủy phiên & Bắt đầu lại"
    await client.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        const discardBtn = Array.from(dialog.querySelectorAll('button')).find(b =>
          b.textContent.includes('Hủy phiên & Bắt đầu lại')
        );
        if (discardBtn) discardBtn.click();
      })()
    `);

    await new Promise(r => setTimeout(r, 400));

    const t6AfterDiscard = await client.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        const cached = window.__inProgressTransactionCache ? window.__inProgressTransactionCache.get('101', 5) : null;
        return {
          hasBanner: dialog ? dialog.textContent.includes('Tiến trình giao dịch đang thực hiện dở dang') : false,
          cacheCleared: !cached,
        };
      })()
    `);

    // Close modal
    await client.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        const closeBtn = dialog.querySelector('button[aria-label="Đóng cửa sổ"]') || dialog.querySelector('button');
        if (closeBtn) closeBtn.click();
      })()
    `);

    const t6Pass =
      t6Initial.hasBanner &&
      t6Initial.hasSub555 &&
      t6Initial.hasInv666 &&
      !t6AfterDiscard.hasBanner &&
      t6AfterDiscard.cacheCleared;

    record(
      'FE2-SESSION-RESTORE-AND-DISCARD',
      'Modal restores in-progress transaction on open, renders amber notice, and clears state upon clicking discard',
      t6Pass,
      { t6Initial, t6AfterDiscard }
    );

    // -------------------------------------------------------------------------
    // TEST 7: F5 Page Reload Session Persistence & Backend Cancellation
    // -------------------------------------------------------------------------
    console.log('[Test 7] Verifying F5 reload persistence and backend cancellation...');
    // Seed in-flight transaction using inProgressTransactionCache for receptionist actorId 5
    await client.eval(`
      (() => {
        if (window.__inProgressTransactionCache) {
          window.__inProgressTransactionCache.set('101', {
            subscriptionId: 777,
            invoiceId: 888,
            packageId: 12,
            method: 'cash',
            sessionRef: 'TXN-F5-777'
          }, 5, 'TXN-F5-777');
        }
      })()
    `);

    // Reload the page to simulate F5 hard refresh
    await client.send('Page.reload');
    await client.waitFor("window.location.pathname === '/receptionist/dashboard'", 10000);
    await client.waitFor("document.querySelector('main button') !== null", 10000);

    // Verify sessionStorage retains data after reload under actor 5 key
    const storedAfterReload = await client.eval(`
      (() => {
        const raw = sessionStorage.getItem('scms_in_progress_tx_5');
        return raw ? JSON.parse(raw) : null;
      })()
    `);
    const f5Retained = Boolean(
      storedAfterReload &&
      (storedAfterReload['101::TXN-F5-777']?.invoiceId === 888 || storedAfterReload['101']?.invoiceId === 888)
    );

    // Open PaymentModal
    await client.eval(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.includes('Thu tiền & Ghi nhận') || b.textContent.includes('Record Payment')
        );
        if (btn) btn.click();
      })()
    `);

    await client.waitFor("document.querySelector('div[role=\"dialog\"]')");
    await client.waitFor(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        return dialog && dialog.textContent.includes('ID #888');
      })()
    `);

    const t7RestoredModal = await client.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        return {
          hasBanner: dialog ? dialog.textContent.includes('Tiến trình giao dịch đang thực hiện dở dang') : false,
          hasSub777: dialog ? dialog.textContent.includes('ID #777') : false,
          hasInv888: dialog ? dialog.textContent.includes('ID #888') : false,
        };
      })()
    `);

    // Click "Hủy phiên & Bắt đầu lại" and verify backend cancel endpoints called
    await client.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        const discardBtn = Array.from(dialog.querySelectorAll('button')).find(b =>
          b.textContent.includes('Hủy phiên & Bắt đầu lại')
        );
        if (discardBtn) discardBtn.click();
      })()
    `);

    await new Promise(r => setTimeout(r, 400));

    const t7AfterCancel = await client.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        const raw = sessionStorage.getItem('scms_in_progress_tx_5');
        const parsed = raw ? JSON.parse(raw) : {};
        return {
          hasBanner: dialog ? dialog.textContent.includes('Tiến trình giao dịch đang thực hiện dở dang') : false,
          storageCleared: !parsed['101'] && !parsed['101::TXN-F5-777'],
          cancelInvoiceCalls: window.__fe2NetworkCalls.cancelInvoiceCalls.length,
          cancelSubCalls: window.__fe2NetworkCalls.cancelSubscriptionCalls.length,
        };
      })()
    `);

    const t7Pass =
      f5Retained &&
      t7RestoredModal.hasBanner &&
      t7RestoredModal.hasSub777 &&
      t7RestoredModal.hasInv888 &&
      !t7AfterCancel.hasBanner &&
      t7AfterCancel.storageCleared &&
      t7AfterCancel.cancelInvoiceCalls >= 1 &&
      t7AfterCancel.cancelSubCalls >= 1;

    record(
      'FE2-F5-RELOAD-PERSISTENCE-AND-BACKEND-CANCEL',
      'In-progress session survives F5 reload via sessionStorage and cancels pending records on BE upon discard',
      t7Pass,
      { f5Retained, t7RestoredModal, t7AfterCancel }
    );

    // =========================================================================
    // MEMBER VIEW TESTS (Tests 8 to 12)
    // =========================================================================

    // Switch session to Member role with active subscription seed for Test 8
    await client.eval(`
      (() => {
        sessionStorage.setItem('scms_mock_role', 'member');
        sessionStorage.setItem('fe2_mock_fail_member_data', 'false');
        sessionStorage.setItem('fe2_mock_member_subs', JSON.stringify([
          {
            subscriptionId: 77,
            memberId: 7,
            packageId: 12,
            packageName: 'VIP Elite Club',
            status: 'ACTIVE',
            startDate: '2026-10-01',
            endDate: '2027-10-01',
            price: 11500000
          }
        ]));
      })()
    `);

    // TEST 8: MEMBER VIEW IDENTITY ISOLATION (Foreign member profile ID 13 vs userId 13)
    await client.navigate(`${baseUrl}/member/my-membership`);
    await client.waitFor("window.location.pathname === '/member/my-membership'", 10000);
    await client.waitFor("document.querySelector('main h2') !== null", 10000);
    await client.waitFor("!document.querySelector('main .animate-spin')", 10000);

    const t8Dom = await client.eval(`
      (() => {
        const text = document.body.innerText;
        const main = document.querySelector('main');
        const mainText = main ? main.innerText : '';
        return {
          pathname: window.location.pathname,
          mainTextSnippet: mainText.slice(0, 400),
          hasForeignName: text.includes('Người Khác Có ID 13'),
          hasForeignCoach: text.includes('Coach Lạ Xa Lạ'),
          hasForeignCode: text.includes('MB-FOREIGN-13'),
          hasInventedCode: text.includes('MB-7'),
          hasOwnCoach: text.includes('HLV Trần Văn A'),
          hasProfileId7: text.includes('#7'),
        };
      })()
    `);

    const t8Pass =
      t8Dom.pathname === '/member/my-membership' &&
      !t8Dom.hasForeignName &&
      !t8Dom.hasForeignCoach &&
      !t8Dom.hasForeignCode &&
      !t8Dom.hasInventedCode &&
      t8Dom.hasProfileId7;

    record(
      'FE2-MEMBER-VIEW-IDENTITY-ISOLATION',
      'Member view strictly matches memberId (7) not userId (13), isolating foreign profile 13 without foreign coach or invented code',
      t8Pass,
      t8Dom
    );

    // TEST 9: MEMBER VIEW GET FAILURE FAIL-CLOSED WITH RETRY BUTTON
    await client.eval(`
      (() => {
        sessionStorage.setItem('fe2_mock_fail_member_data', 'true');
      })()
    `);

    await client.send('Page.reload');
    await client.waitFor("window.location.pathname === '/member/my-membership'", 10000);
    await client.waitFor("document.querySelector('main') !== null", 10000);
    await client.waitFor("Boolean(document.querySelector('main')?.innerText?.includes('Lỗi kết nối máy chủ') || document.querySelector('main')?.innerText?.includes('Server Error'))", 10000);

    const t9ErrorState = await client.eval(`
      (() => {
        const main = document.querySelector('main');
        const text = main ? main.innerText : '';
        const retryBtn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.includes('Thử lại') || b.textContent.includes('Retry')
        );
        return {
          hasErrorTitle: text.includes('Lỗi kết nối máy chủ') || text.includes('Server Error'),
          hasRetryButton: Boolean(retryBtn),
          mainSnippet: text.slice(0, 300)
        };
      })()
    `);

    const t9Pass = t9ErrorState.hasErrorTitle && t9ErrorState.hasRetryButton;
    record(
      'FE2-MEMBER-VIEW-GET-ERROR-FAIL-CLOSED',
      'GET failure displays explicit error banner with retry button instead of silently treating as empty data',
      t9Pass,
      t9ErrorState
    );

    // Reset failure flag and configure Pending Subscription (#99)
    await client.eval(`
      (() => {
        sessionStorage.setItem('fe2_mock_fail_member_data', 'false');
        sessionStorage.setItem('fe2_mock_member_subs', JSON.stringify([
          {
            subscriptionId: 99,
            memberId: 7,
            packageId: 13,
            packageName: 'Basic Fitness',
            status: 'PENDING',
            startDate: '2026-10-09',
            endDate: '2026-11-09',
            price: 1200000
          }
        ]));
      })()
    `);

    // TEST 10: PENDING SUBSCRIPTION IS NOT TREATED AS ACTIVE PACKAGE
    await client.send('Page.reload');
    await client.waitFor("window.location.pathname === '/member/my-membership'", 10000);
    await client.waitFor("document.querySelector('main h2') !== null", 10000);
    await client.waitFor("!document.querySelector('main .animate-spin')", 10000);

    const t10PendingState = await client.eval(`
      (() => {
        const main = document.querySelector('main');
        const text = main ? main.innerText : '';
        return {
          hasEmptyActivePackage: text.includes('Bạn chưa có gói hội viên đang hoạt động') || text.includes('You do not have an active membership'),
          treatsPendingAsActiveBadge: text.includes('GÓI DỊCH VỤ ĐANG HOẠT ĐỘNG'),
        };
      })()
    `);

    const t10Pass =
      t10PendingState.hasEmptyActivePackage &&
      !t10PendingState.treatsPendingAsActiveBadge;

    record(
      'FE2-MEMBER-VIEW-PENDING-SUB-NOT-ACTIVE',
      'Pending subscription (#99) is strictly isolated and never rendered as an active membership package',
      t10Pass,
      t10PendingState
    );

    // TEST 11: ACTIVE SUBSCRIPTION RENDERS ACTIVE CARD AND RENEWAL BUTTON DISABLED IN API MODE
    await client.eval(`
      (() => {
        sessionStorage.setItem('fe2_mock_member_subs', JSON.stringify([
          {
            subscriptionId: 100,
            memberId: 7,
            packageId: 12,
            packageName: 'VIP Elite Club',
            status: 'ACTIVE',
            startDate: '2026-10-01',
            endDate: '2027-10-01',
            price: 11500000
          }
        ]));
      })()
    `);

    await client.send('Page.reload');
    await client.waitFor("window.location.pathname === '/member/my-membership'", 10000);
    await client.waitFor("document.querySelector('main h2') !== null", 10000);
    await client.waitFor("!document.querySelector('main .animate-spin')", 10000);

    const t11ActiveState = await client.eval(`
      (() => {
        const main = document.querySelector('main');
        const text = main ? main.innerText : '';
        const renewBtn = Array.from(document.querySelectorAll('button')).find(b =>
          b.textContent.includes('Gia hạn / Đổi gói') || b.textContent.includes('Renew / Change')
        );
        return {
          hasActiveBanner: text.includes('GÓI DỊCH VỤ ĐANG HOẠT ĐỘNG'),
          hasPackageName: text.includes('VIP Elite Club'),
          hasContractId: text.includes('#100'),
          hasRenewBtn: Boolean(renewBtn),
          renewBtnDisabled: renewBtn ? renewBtn.disabled : false,
        };
      })()
    `);

    const t11Pass =
      t11ActiveState.hasActiveBanner &&
      t11ActiveState.hasPackageName &&
      t11ActiveState.hasContractId &&
      t11ActiveState.hasRenewBtn &&
      t11ActiveState.renewBtnDisabled;

    record(
      'FE2-MEMBER-VIEW-ACTIVE-SUB-RENEWAL-STATE',
      'Active subscription (#100) displays active package details and disables renewal button in API mode pending BE contract',
      t11Pass,
      t11ActiveState
    );

    // TEST 12: DIRECT MEMBER POST MUTATION IS LOCKED (0 POST CALLS)
    const t12MutationLock = await client.eval(`
      (() => {
        const initialPostCount = window.__fe2NetworkCalls.subscribeCalls.length;
        const btns = Array.from(document.querySelectorAll('button')).filter(b =>
          b.textContent.includes('Gia hạn / Đổi gói') ||
          b.textContent.includes('Đăng ký gói') ||
          b.textContent.includes('Chọn gói này')
        );

        // Attempt clicking disabled buttons
        btns.forEach(b => {
          try { b.click(); } catch(e) {}
        });

        const finalPostCount = window.__fe2NetworkCalls.subscribeCalls.length;
        const mainText = document.querySelector('main')?.innerText || '';
        const hasLockNotice = mainText.includes('Khóa đăng ký trực tuyến') ||
                              mainText.includes('Direct Subscription Locked');

        return {
          btnCount: btns.length,
          allDisabled: btns.every(b => b.disabled),
          initialPostCount,
          finalPostCount,
          hasLockNotice
        };
      })()
    `);

    const t12Pass =
      t12MutationLock.btnCount > 0 &&
      t12MutationLock.allDisabled &&
      t12MutationLock.finalPostCount === 0 &&
      t12MutationLock.hasLockNotice;

    record(
      'FE2-MEMBER-VIEW-DIRECT-POST-MUTATION-LOCKED',
      'Direct Member POST mutation is strictly locked in API mode: all action buttons disabled and zero POST network calls made',
      t12Pass,
      t12MutationLock
    );

    // =========================================================================
    // FINAL SUMMARY
    // =========================================================================
    console.log('\n================================================================');
    console.log('  FE 2 REAL BROWSER VERIFICATION MATRIX SUMMARY');
    console.log('================================================================');
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    client.close();
    try { proc.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
    await viteServer.close();
  }
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
