/**
 * FE 2 Mock UI Demo Matrix Verification Test Suite
 *
 * Executes real headless Chromium with full diagnostic output to verify:
 * 1. Diagnostic Chrome/Chromium launcher with path search & process stderr capture.
 * 2. Desktop (1280x800) /member/my-membership catalog & membership layout.
 * 3. Mobile (375x667) responsive layout without horizontal overflow.
 * 4. Receptionist desk cash settlement in-place:
 *    - MUST have pending fixture row (asserts > 0).
 *    - Settles exact row and verifies status badge transitions to 'Đã hoàn tất' / 'successful'.
 *    - Verifies desk action button is removed on that exact row.
 *    - Verifies total row count is unchanged (NO duplicate appended/prepended).
 *    - Rejects second confirmation attempt on that settled record.
 * 5. F5 reload persistence: verifies THAT EXACT ROW remains 'successful' after reload.
 * 6. Member cross-view read-back after desk settlement:
 *    - Re-reads member profile (mem-3 / Phạm Thanh Hương).
 *    - Verifies membershipStatus transitions to 'active'.
 *    - Verifies invoice history reflects 'successful' status.
 *    - Verifies F5 reload on member page preserves active status.
 * 7. Manager payment overview (/manager/payments) with search, filter, and pagination.
 * 8. Isolated Escape key dismissal vs Cancel button dismissal on PaymentModal:
 *    - Test A: Dismiss modal with native Escape key ONLY.
 *    - Test B: Dismiss modal with Cancel button ONLY.
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

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
  }

  async pressEscape() {
    await this.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27,
    });
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Escape',
      code: 'Escape',
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27,
    });
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

function findChromeExecutable() {
  const candidatePaths = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

async function spawnIsolatedChrome() {
  const chromePath = findChromeExecutable();
  if (!chromePath) {
    const checked = [
      process.env.CHROME_PATH || '(none specified via CHROME_PATH)',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    throw new Error(
      `[Diagnostic] No compatible Chromium browser found on this host.\n` +
      `Checked locations:\n${checked.map(c => `  - ${c}`).join('\n')}\n` +
      `Remedy: Set CHROME_PATH environment variable to a valid chrome.exe or msedge.exe binary.`
    );
  }

  const cdpPort = await getFreePort();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-fe2-mock-ui-'));

  const stderrLogs = [];
  const stdoutLogs = [];

  const proc = spawn(chromePath, [
    `--remote-debugging-port=${cdpPort}`,
    '--remote-debugging-address=127.0.0.1',
    '--disable-gpu',
    '--no-sandbox',
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,800',
    `--user-data-dir=${tempDir}`,
    'about:blank'
  ], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  proc.stdout?.on('data', d => stdoutLogs.push(d.toString()));
  proc.stderr?.on('data', d => stderrLogs.push(d.toString()));

  let pageList = [];
  let detectedWsUrl = null;

  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 200));

    // Check stderr for DevTools listening address
    const currentStderr = stderrLogs.join('\n');
    const wsMatch = currentStderr.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\r\n]+)/);
    if (wsMatch) {
      detectedWsUrl = wsMatch[1].trim();
    }

    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`);
      if (res.ok) {
        pageList = await res.json();
        if (pageList.length > 0) break;
      }
    } catch (e) {}

    // If list is empty after 8 iterations, trigger new tab via PUT
    if (pageList.length === 0 && i >= 8) {
      try {
        const newTabRes = await fetch(`http://127.0.0.1:${cdpPort}/json/new`, { method: 'PUT' });
        if (newTabRes.ok) {
          const tab = await newTabRes.json();
          if (tab && tab.webSocketDebuggerUrl) {
            pageList = [tab];
            break;
          }
        }
      } catch (e) {}
    }
  }

  if (pageList.length === 0 && !detectedWsUrl) {
    const exitCode = proc.exitCode;
    const stderrOut = stderrLogs.join('\n').trim();
    const stdoutOut = stdoutLogs.join('\n').trim();
    proc.kill();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}

    throw new Error(
      `[Diagnostic] Failed to establish CDP connection to Chrome at port ${cdpPort}.\n` +
      `Browser executable: ${chromePath}\n` +
      `Process exit code: ${exitCode !== null ? exitCode : 'still running'}\n` +
      `Captured stderr:\n${stderrOut || '(empty)'}\n` +
      `Captured stdout:\n${stdoutOut || '(empty)'}\n` +
      `Remedy: Ensure 127.0.0.1:${cdpPort} is not blocked by local firewall and that Chrome can launch headlessly.`
    );
  }

  let client;
  if (pageList.length > 0) {
    const target = pageList.find(p => p.type === 'page' && !p.url.startsWith('chrome://')) || pageList[0];
    client = new ChromeClient(target.webSocketDebuggerUrl);
  } else {
    client = new ChromeClient(detectedWsUrl);
  }

  await client.connect();
  await client.send('Page.enable');
  await client.send('Runtime.enable');

  return { client, proc, tempDir, cdpPort, chromePath };
}

async function runMockUiMatrix() {
  console.log('================================================================');
  console.log('  FE 2 MOCK UI DEMO MATRIX: RIGOROUS REAL BROWSER ASSERTION SUITE');
  console.log('================================================================\n');

  const results = [];
  function record(id, title, pass, details = {}) {
    results.push({ id, title, pass, details });
    const mark = pass ? '✅ PASS' : '❌ FAIL';
    console.log(`[${id}] ${mark}: ${title}`);
    if (!pass || process.env.VERBOSE) {
      console.log('       Details:', JSON.stringify(details, null, 2));
    }
  }

  const vitePort = await getFreePort();
  const viteServer = await createServer({
    server: { port: vitePort },
    mode: 'mock',
  });
  await viteServer.listen();
  console.log(`[Setup] Vite mock dev server running at http://localhost:${vitePort}`);

  const { client, proc, tempDir, chromePath, cdpPort } = await spawnIsolatedChrome();
  console.log(`[Setup] Isolated Chromium instance launched successfully`);
  console.log(`        Binary: ${chromePath}`);
  console.log(`        CDP Port: ${cdpPort}`);

  try {
    const baseUrl = `http://localhost:${vitePort}`;

    // -------------------------------------------------------------
    // MATRIX 1: DESKTOP (1280x800) - MEMBER MEMBERSHIP VIEW
    // -------------------------------------------------------------
    await client.setViewport(1280, 800);
    await client.navigate(`${baseUrl}/`);
    await client.eval(`
      (() => {
        window.sessionStorage.setItem('scms_mock_role', 'member');
        window.sessionStorage.setItem('scms_mock_authenticated', 'true');
        window.sessionStorage.removeItem('scms_mock_member_id');
      })()
    `);
    await client.navigate(`${baseUrl}/member/my-membership`);
    await client.waitFor("document.querySelector('table') || document.body.innerText.includes('Bảng Giá') || document.body.innerText.includes('Gói')");

    const memberViewCheck = await client.eval(`
      (() => {
        const text = document.body.innerText.toLowerCase();
        const hasCatalog = text.includes('gói') || text.includes('package') || text.includes('dịch vụ');
        const hasMembershipInfo = text.includes('hội viên') || text.includes('thành viên') || text.includes('membership');
        const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim());
        return {
          hasCatalog,
          hasMembershipInfo,
          buttonsCount: buttons.length,
          url: window.location.pathname,
          rawSnippet: text.slice(0, 400),
        };
      })()
    `);

    record(
      'MOCK-UI-01',
      'Desktop (1280x800) /member/my-membership renders membership info and package catalog',
      memberViewCheck.hasCatalog && memberViewCheck.hasMembershipInfo,
      memberViewCheck
    );

    // -------------------------------------------------------------
    // MATRIX 2: MOBILE (375x667) VIEWPORT RESILIENCE
    // -------------------------------------------------------------
    await client.setViewport(375, 667);
    await client.navigate(`${baseUrl}/member/my-membership`);
    await client.waitFor("document.body");

    const mobileCheck = await client.eval(`
      (() => {
        const width = window.innerWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const noHorizOverflow = scrollWidth <= width + 5;
        return {
          innerWidth: width,
          scrollWidth: scrollWidth,
          noHorizOverflow,
        };
      })()
    `);

    record(
      'MOCK-UI-02',
      'Mobile (375x667) viewport responsive layout without broken horizontal overflow',
      mobileCheck.noHorizOverflow,
      mobileCheck
    );

    // -------------------------------------------------------------
    // MATRIX 3: RECEPTIONIST DESK CASH SETTLEMENT IN-PLACE & DEDUPLICATION
    // -------------------------------------------------------------
    await client.setViewport(1280, 800);
    await client.eval(`
      (() => {
        window.sessionStorage.setItem('scms_mock_role', 'receptionist');
        window.sessionStorage.setItem('scms_mock_authenticated', 'true');
      })()
    `);
    await client.navigate(`${baseUrl}/receptionist/payments`);
    await client.waitFor("document.querySelector('table')");

    // Must strictly find a pending fixture record (e.g. pay-103 / TXN-20260918-003)
    const initialTableState = await client.eval(`
      (() => {
        const rows = Array.from(document.querySelectorAll('tbody tr'));
        const pendingRows = rows.map((r, idx) => {
          const btn = r.querySelector('button');
          const isPendingBtn = btn && /Thu tiền mặt|Collect Cash/i.test(btn.innerText);
          const codeText = r.querySelector('td')?.innerText.trim() || '';
          const nameText = r.querySelectorAll('td')[1]?.innerText.trim() || '';
          return { idx, codeText, nameText, hasPendingBtn: isPendingBtn };
        }).filter(item => item.hasPendingBtn);

        return {
          totalRowCount: rows.length,
          pendingRowsCount: pendingRows.length,
          firstPending: pendingRows[0] || null,
        };
      })()
    `);

    if (initialTableState.pendingRowsCount === 0) {
      record(
        'MOCK-UI-03',
        'Receptionist desk settles pending cash fixture in-place without duplicating transactions',
        false,
        { error: 'Prerequisite failed: No pending payment fixture found in initial table' }
      );
    } else {
      const targetPending = initialTableState.firstPending;
      const initialTotalCount = initialTableState.totalRowCount;

      // Click "Thu tiền mặt" on that exact row
      await client.eval(`
        (() => {
          const rows = Array.from(document.querySelectorAll('tbody tr'));
          const targetRow = rows[${targetPending.idx}];
          const btn = targetRow ? targetRow.querySelector('button') : null;
          if (btn) btn.click();
        })()
      `);

      // Wait for confirmation modal
      await client.waitFor("document.querySelector('form, div[role=\"dialog\"]')");

      // Click "Xác nhận đã thu tiền"
      await client.eval(`
        (() => {
          const submitBtn = Array.from(document.querySelectorAll('button')).find(b =>
            /Xác nhận đã thu tiền|Confirm Cash Received/i.test(b.innerText)
          );
          if (submitBtn) submitBtn.click();
        })()
      `);

      await new Promise(r => setTimeout(r, 600));

      // Inspect THAT EXACT ROW after settlement
      const afterSettleState = await client.eval(`
        (() => {
          const rows = Array.from(document.querySelectorAll('tbody tr'));
          const settledRow = rows.find(r => r.innerText.includes('${targetPending.codeText}'));
          const hasPendingBtn = settledRow ? Boolean(settledRow.querySelector('button')) : false;
          const statusText = settledRow ? settledRow.innerText : '';
          const isCompleted = /Đã hoàn tất|Thành công|Successful/i.test(statusText);

          return {
            totalRowCount: rows.length,
            targetRowFound: Boolean(settledRow),
            hasPendingBtn,
            isCompleted,
            statusSnippet: statusText.slice(0, 100),
          };
        })()
      `);

      const settlementInPlacePass =
        afterSettleState.totalRowCount === initialTotalCount &&
        afterSettleState.targetRowFound &&
        !afterSettleState.hasPendingBtn &&
        afterSettleState.isCompleted;

      record(
        'MOCK-UI-03',
        'Receptionist desk settles pending cash fixture in-place without duplicating transactions',
        settlementInPlacePass,
        { initial: initialTableState, after: afterSettleState }
      );

      // Attempt actual second confirmation on that exact record (must be rejected)
      const secondAttemptResult = await client.eval(`
        (async () => {
          // Dynamic import FE 2 mockFixtureSettlement module inside running browser
          const { settleMockPaymentFixture } = await import('/src/utils/mockFixtureSettlement.js');
          // Actually invoke second settlement attempt for pay-103
          const attempt = settleMockPaymentFixture({
            id: '${targetPending.codeText}',
            status: 'pending',
          });
          const raw = window.sessionStorage.getItem('fe2_mock_settled_payments_v1');
          const map = raw ? JSON.parse(raw) : {};
          return {
            attemptOk: attempt.ok,
            attemptError: attempt.error,
            isRejected: attempt.ok === false && typeof attempt.error === 'string' && attempt.error.includes('đã được xác nhận'),
            storageKeysCount: Object.keys(map).length,
          };
        })()
      `);

      record(
        'MOCK-UI-03B',
        'Second settlement attempt on already settled record is strictly rejected ({ ok: false, error })',
        secondAttemptResult.isRejected && secondAttemptResult.storageKeysCount === 1,
        secondAttemptResult
      );

      // -------------------------------------------------------------
      // MATRIX 4: EXACT ROW CHECK AFTER F5 RELOAD (PERSISTENCE)
      // -------------------------------------------------------------
      await client.navigate(`${baseUrl}/receptionist/payments`);
      await client.waitFor("document.querySelector('table')");

      const reloadExactRowState = await client.eval(`
        (() => {
          const rows = Array.from(document.querySelectorAll('tbody tr'));
          const exactRow = rows.find(r => r.innerText.includes('${targetPending.codeText}'));
          const hasPendingBtn = exactRow ? Boolean(exactRow.querySelector('button')) : false;
          const rowText = exactRow ? exactRow.innerText : '';
          const isCompleted = /Đã hoàn tất|Thành công|Successful/i.test(rowText);
          const hasExactAmount = rowText.includes('1.200.000') || rowText.includes('1,200,000');

          return {
            totalRowCount: rows.length,
            exactRowFound: Boolean(exactRow),
            hasPendingBtn,
            isCompleted,
            hasExactAmount,
            sessionStorageExists: Boolean(window.sessionStorage.getItem('fe2_mock_settled_payments_v1')),
          };
        })()
      `);

      const reloadExactRowPass =
        reloadExactRowState.totalRowCount === initialTotalCount &&
        reloadExactRowState.exactRowFound &&
        !reloadExactRowState.hasPendingBtn &&
        reloadExactRowState.isCompleted &&
        reloadExactRowState.hasExactAmount &&
        reloadExactRowState.sessionStorageExists;

      record(
        'MOCK-UI-04',
        'Exact settled row remains completed and persistent after F5 reload via sessionStorage',
        reloadExactRowPass,
        reloadExactRowState
      );

      // -------------------------------------------------------------
      // MATRIX 5: MEMBER CROSS-VIEW READ-BACK AFTER DESK SETTLEMENT & F5
      // -------------------------------------------------------------
      await client.eval(`
        (() => {
          window.sessionStorage.setItem('scms_mock_role', 'member');
          window.sessionStorage.setItem('scms_mock_member_id', 'mem-3');
          window.sessionStorage.setItem('scms_mock_authenticated', 'true');
        })()
      `);
      await client.navigate(`${baseUrl}/member/my-membership`);
      await client.waitFor("document.querySelector('table, h3')");

      // Test after real F5 reload to prove cross-view persistence
      await client.navigate(`${baseUrl}/member/my-membership`);
      await client.waitFor("document.querySelector('table, h3')");

      const memberReadBackState = await client.eval(`
        (() => {
          // 1. Exact Member Status Badge in Header
          const badges = Array.from(document.querySelectorAll('span, div')).filter(el =>
            el.className && typeof el.className === 'string' && el.className.includes('bg-emerald-50')
          );
          const activeBadgeFound = badges.some(b => /Đang hoạt động|Hoạt động|Active/i.test(b.innerText));

          // 2. Exact Active Package Card Title
          const cardTitle = document.querySelector('h3.text-xl')?.innerText.trim() || '';
          const hasExactPackage = cardTitle.includes('Gói Cơ Bản');

          // 3. Exact Date Display (Must NOT be hardcoded 31/12/2026; must show undetermined mock period)
          const dateContainer = Array.from(document.querySelectorAll('div')).find(d =>
            d.innerText && d.innerText.includes('Thời hạn sử dụng gói')
          );
          const dateText = dateContainer?.innerText || '';
          const hasUndeterminedMockDate = dateText.includes('Chưa xác định thời hạn');
          const noFabricatedFixedDate = !dateText.includes('31/12/2026');

          // 4. Exact Invoice Row in Billing History Table
          const tableRows = Array.from(document.querySelectorAll('tbody tr'));
          const invoiceRow = tableRows.find(r => r.innerText.includes('${targetPending.codeText}'));
          const invoiceRowText = invoiceRow ? invoiceRow.innerText : '';
          const invoiceIsSuccessful = invoiceRow ? /Thành công|Successful/i.test(invoiceRowText) : false;
          const invoiceHasAmount = invoiceRow ? (invoiceRowText.includes('1.200.000') || invoiceRowText.includes('1,200,000')) : false;

          // 5. Total Spent check: verify exactly one settlement in storage
          const raw = window.sessionStorage.getItem('fe2_mock_settled_payments_v1');
          const map = raw ? JSON.parse(raw) : {};

          return {
            activeBadgeFound,
            cardTitle,
            hasExactPackage,
            hasUndeterminedMockDate,
            noFabricatedFixedDate,
            invoiceRowFound: Boolean(invoiceRow),
            invoiceIsSuccessful,
            invoiceHasAmount,
            settledKeyCount: Object.keys(map).length,
            invoiceRowSnippet: invoiceRowText.slice(0, 120),
          };
        })()
      `);

      const memberReadBackPass =
        memberReadBackState.activeBadgeFound &&
        memberReadBackState.hasExactPackage &&
        memberReadBackState.hasUndeterminedMockDate &&
        memberReadBackState.noFabricatedFixedDate &&
        memberReadBackState.invoiceRowFound &&
        memberReadBackState.invoiceIsSuccessful &&
        memberReadBackState.invoiceHasAmount &&
        memberReadBackState.settledKeyCount === 1;

      record(
        'MOCK-UI-05',
        'Member view reflects exact active badge, settled package name, undetermined mock date, and single invoice amount after F5',
        memberReadBackPass,
        memberReadBackState
      );
    }

    // -------------------------------------------------------------
    // MATRIX 6: MANAGER PAYMENT OVERVIEW & FILTER DRAWER
    // -------------------------------------------------------------
    await client.eval(`
      (() => {
        window.sessionStorage.setItem('scms_mock_role', 'manager');
        window.sessionStorage.setItem('scms_mock_authenticated', 'true');
      })()
    `);
    await client.navigate(`${baseUrl}/manager/payments`);
    await client.waitFor("document.querySelector('table, select')");

    const managerViewCheck = await client.eval(`
      (() => {
        const selects = Array.from(document.querySelectorAll('select')).map(s => s.value);
        const searchInput = document.querySelector('input[type="text"]');
        const rows = Array.from(document.querySelectorAll('tbody tr'));
        return {
          hasSelects: selects.length >= 2,
          hasSearch: Boolean(searchInput),
          rowCount: rows.length,
        };
      })()
    `);

    record(
      'MOCK-UI-06',
      'Manager payment view renders filters, search input, and paginated transaction table',
      managerViewCheck.hasSelects && managerViewCheck.hasSearch && managerViewCheck.rowCount > 0,
      managerViewCheck
    );

    // -------------------------------------------------------------
    // MATRIX 7: ISOLATED ESCAPE KEY DISMISSAL VS CANCEL BUTTON DISMISSAL
    // -------------------------------------------------------------
    await client.eval(`
      (() => {
        window.sessionStorage.setItem('scms_mock_role', 'receptionist');
        window.sessionStorage.setItem('scms_mock_authenticated', 'true');
      })()
    `);
    await client.navigate(`${baseUrl}/receptionist/payments`);
    await client.waitFor("document.body");

    // Part A: Open modal -> Dismiss via native ESCAPE KEY ONLY (via CDP Input.dispatchKeyEvent)
    await client.eval(`
      (() => {
        const payBtn = Array.from(document.querySelectorAll('button')).find(b =>
          /Ghi Nhận Giao Dịch Mới|New Desk Payment/i.test(b.innerText) ||
          /Thu tiền & Ghi nhận/i.test(b.innerText)
        );
        if (payBtn) payBtn.click();
      })()
    `);

    await client.waitFor("document.querySelector('div[role=\"dialog\"]')");
    const modalOpenedForEsc = await client.eval(`Boolean(document.querySelector('div[role="dialog"]'))`);

    // Dispatch native Escape key event via CDP Input.dispatchKeyEvent (no synthetic DOM event, no cancel button click)
    await client.pressEscape();

    await new Promise(r => setTimeout(r, 400));
    const modalClosedByEsc = await client.eval(`!document.querySelector('div[role="dialog"]')`);

    record(
      'MOCK-UI-07A',
      'PaymentModal is dismissed cleanly by native CDP Escape key press alone without button click',
      modalOpenedForEsc && modalClosedByEsc,
      { opened: modalOpenedForEsc, closedByEscape: modalClosedByEsc }
    );

    // Part B: Open modal again -> Dismiss via CANCEL BUTTON ONLY (no Escape key)
    await client.eval(`
      (() => {
        const payBtn = Array.from(document.querySelectorAll('button')).find(b =>
          /Ghi Nhận Giao Dịch Mới|New Desk Payment/i.test(b.innerText) ||
          /Thu tiền & Ghi nhận/i.test(b.innerText)
        );
        if (payBtn) payBtn.click();
      })()
    `);

    await client.waitFor("document.querySelector('div[role=\"dialog\"]')");
    const modalOpenedForCancel = await client.eval(`Boolean(document.querySelector('div[role="dialog"]'))`);

    // Click Cancel button ONLY
    await client.eval(`
      (() => {
        const dialog = document.querySelector('div[role="dialog"]');
        const cancelBtn = Array.from(dialog.querySelectorAll('button')).find(b =>
          /Hủy|Cancel/i.test(b.innerText)
        );
        if (cancelBtn) cancelBtn.click();
      })()
    `);

    await new Promise(r => setTimeout(r, 400));
    const modalClosedByCancel = await client.eval(`!document.querySelector('div[role="dialog"]')`);

    record(
      'MOCK-UI-07B',
      'PaymentModal is dismissed cleanly by Cancel button click alone without keyboard event',
      modalOpenedForCancel && modalClosedByCancel,
      { opened: modalOpenedForCancel, closedByCancel: modalClosedByCancel }
    );

    // Member-created request must remain pending until the receptionist settles that same row.
    await client.eval(`(() => {
      sessionStorage.setItem('scms_mock_role', 'member');
      sessionStorage.setItem('scms_mock_member_id', 'mem-3');
    })()`);
    await client.navigate(`${baseUrl}/member/my-membership`);
    await client.waitFor("document.querySelector('button')");
    await client.eval(`(() => {
      const button = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('Gia hạn / Đổi gói') || b.innerText.includes('Renew / Change'));
      button?.click();
    })()`);
    await client.waitFor("document.querySelector('[role=dialog] form select')");
    await client.eval(`(() => {
      const dialog = document.querySelector('[role=dialog]');
      const select = dialog.querySelector('select');
      const other = [...select.options].find((option) => option.value !== 'pkg-1');
      select.value = other.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await client.eval(`document.querySelector('[role=dialog] form button[type=submit]').click()`);
    await client.waitFor("!document.querySelector('[role=dialog]')");
    const pendingRequest = await client.eval(`(() => {
      const items = JSON.parse(sessionStorage.getItem('fe2_mock_pending_payments_v1') || '[]');
      const item = items.find((p) => p.memberId === 'mem-3');
      return item ? { id: item.id, packageId: item.packageId, status: item.status } : null;
    })()`);
    await client.navigate(`${baseUrl}/member/my-membership`);
    await client.waitFor("document.querySelector('tbody tr')");
    const memberPendingVisible = await client.eval(`document.body.innerText.includes('Chờ thanh toán')`);

    await client.eval(`sessionStorage.setItem('scms_mock_role', 'receptionist')`);
    await client.navigate(`${baseUrl}/receptionist/payments`);
    await client.waitFor("document.querySelector('tbody tr')");
    const pendingDeskRow = await client.eval(`(() => {
      const row = [...document.querySelectorAll('tbody tr')].find((r) => r.innerText.toLowerCase().includes(${JSON.stringify((pendingRequest?.id || '').toLowerCase())}));
      const button = row?.querySelector('button');
      button?.click();
      return Boolean(row && button);
    })()`);
    if (pendingDeskRow) {
      await client.waitFor("document.querySelector('[role=dialog]')");
      await client.eval(`(() => {
        const button = [...document.querySelectorAll('[role=dialog] button')].find((b) => /Xác nhận đã thu tiền|Confirm Cash Received/i.test(b.innerText));
        button?.click();
      })()`);
      await client.waitFor("!document.querySelector('[role=dialog]')");
    }
    await client.eval(`sessionStorage.setItem('scms_mock_role', 'member')`);
    await client.navigate(`${baseUrl}/member/my-membership`);
    await client.waitFor("document.querySelector('tbody tr')");
    const memberPaidVisible = await client.eval(`(() => {
      const row = [...document.querySelectorAll('tbody tr')].find((r) => r.innerText.toLowerCase().includes(${JSON.stringify((pendingRequest?.id || '').toLowerCase())}));
      return Boolean(row && /Thành công|Successful/i.test(row.innerText));
    })()`);
    record('MOCK-UI-08', 'Member request stays pending across F5, then the desk settles its exact row',
      Boolean(pendingRequest && pendingRequest.status === 'pending' && memberPendingVisible && pendingDeskRow && memberPaidVisible),
      { pendingRequest, memberPendingVisible, pendingDeskRow, memberPaidVisible });

    await client.eval(`sessionStorage.setItem('scms_mock_role', 'manager')`);
    await client.navigate(`${baseUrl}/manager/members/mem-3`);
    await client.waitFor("document.querySelector('[data-testid=tab-button-membership]')");
    await client.eval(`document.querySelector('[data-testid=tab-button-membership]').click()`);
    await client.waitFor("document.querySelector('[data-testid=member-package-panel]')");
    const managerHistory = await client.eval(`(() => {
      const panel = document.querySelector('[data-testid=member-package-panel]');
      const row = [...panel.querySelectorAll('tbody tr')].find((r) => r.innerText.toLowerCase().includes(${JSON.stringify((pendingRequest?.id || '').toLowerCase())}));
      return { rowFound: Boolean(row), paid: Boolean(row && /Đang hoạt động|Hoạt động|Active/i.test(row.innerText)) };
    })()`);
    record('MOCK-UI-09', 'Manager member detail reads back the settled membership history after F5',
      managerHistory.rowFound && managerHistory.paid, managerHistory);

  } finally {
    client.close();
    proc.kill();
    await viteServer.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
  }

  const allPassed = results.every(r => r.pass);
  console.log('\n================================================================');
  console.log(`FE 2 MOCK UI VERIFICATION RESULT: ${allPassed ? 'ALL PASSED (100%)' : 'FAILURES DETECTED'}`);
  console.log('================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runMockUiMatrix().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
