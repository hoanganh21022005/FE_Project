/**
 * G4.9 Browser Matrix & Visual Audit Test Suite (Full Portal Matrix)
 *
 * Execution Policies:
 * 1. Live BE: Strictly Read-Only (no business POST/PUT/PATCH mutations).
 *    Authenticated live GETs marked as Pending until live account is configured.
 * 2. Client-side Route Guard vs BE API Authorization are strictly separated.
 * 3. All traces, logs, and screenshots are sanitized (passwords, tokens, PII masked).
 * 4. Captures Desktop (1280x800) and Mobile (375x667) across all 7 portals (10 screens, 20 images).
 * 5. Comprehensive WCAG 2.1 AA/AAA contrast measurement across primary buttons, headers, text, and badges.
 */

import { spawn } from "child_process"

import os from "os"

import path from "path"

import fs from "fs"

import { createServer } from "vite"

import {
  extractList,
  validateMemberSchema,
  validateStaffSchema,
} from "../src/api/schemaValidators.js"

// --- DATA SANITIZATION HELPERS ---

function maskPassword(str) {
  if (!str) return str

  return "[REDACTED_PASSWORD]"
}

function maskCookie(cookieHeader) {
  if (!cookieHeader) return "[NO_COOKIE]"

  return "[REDACTED_SESSION_COOKIE]"
}

function maskEmail(email) {
  if (!email || typeof email !== "string") return email

  const parts = email.split("@")

  if (parts.length !== 2) return "[REDACTED_EMAIL]"

  const name = parts[0]

  const maskedName =
    name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`

  return `${maskedName}@${parts[1]}`
}

function maskPhone(phone) {
  if (!phone || typeof phone !== "string") return phone

  if (phone.length <= 4) return "[REDACTED_PHONE]"

  return `${phone.slice(0, 3)}****${phone.slice(-3)}`
}

function maskName(name) {
  if (!name || typeof name !== "string") return name

  const parts = name.trim().split(/\s+/)

  if (parts.length <= 1) return `${name.slice(0, 1)}***`

  return `${parts[0]} *** ${parts[parts.length - 1]}`
}

const KNOWN_PERSONAL_NAMES = [
  "nguyễn văn an",
  "văn an",

  "trần văn hoàng",
  "văn hoàng",

  "nguyễn minh anh",
  "minh anh",

  "nguyễn văn hùng",
  "văn hùng",

  "lê thị mai",
  "thị mai",
  "lê thi mai",
  "thi mai",

  "đặng tuấn anh",
  "tuấn anh",

  "phạm thị thu",
  "thị thu",

  "lê hoàng nam",
  "hoàng nam",

  "phạm thanh hương",
  "thanh hương",

  "vũ quốc thái",
  "quốc thái",

  "đỗ thị kim",
  "thị kim",

  "trần quốc huy",
  "quốc huy",
]

function sanitizeString(str) {
  if (!str || typeof str !== "string") return str

  let s = str

  if (s.includes("12345678"))
    s = s.replaceAll("12345678", "[REDACTED_PASSWORD]")

  s = s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (m) =>
    maskEmail(m),
  )

  s = s.replace(/(?:\+?84|0)\d{9,10}/g, (m) => maskPhone(m))

  for (const n of KNOWN_PERSONAL_NAMES) {
    if (s.toLowerCase().includes(n)) {
      const regex = new RegExp(n, "gi")

      s = s.replace(regex, maskName(n))
    }
  }

  return s
}

function sanitizeTraceObject(obj) {
  if (!obj || typeof obj !== "object") {
    if (typeof obj === "string") return sanitizeString(obj)

    return obj
  }

  if (Array.isArray(obj)) return obj.map(sanitizeTraceObject)

  const sanitized = {}

  for (const [key, value] of Object.entries(obj)) {
    const lk = key.toLowerCase()

    if (lk.includes("password") || lk.includes("secret")) {
      sanitized[key] = maskPassword(value)
    } else if (
      lk.includes("cookie") ||
      lk.includes("token") ||
      lk.includes("authorization")
    ) {
      sanitized[key] = maskCookie(value)
    } else if (lk.includes("phone")) {
      sanitized[key] = maskPhone(value)
    } else if (lk.includes("email")) {
      sanitized[key] = maskEmail(value)
    } else if (lk.includes("name") && typeof value === "string") {
      if (
        KNOWN_PERSONAL_NAMES.some((n) => value.toLowerCase().includes(n)) ||
        lk === "loadedname" ||
        lk === "username" ||
        lk === "fullname" ||
        lk === "actorname" ||
        lk === "nameval"
      ) {
        sanitized[key] = maskName(value)
      } else {
        sanitized[key] = sanitizeString(value)
      }
    } else if (typeof value === "object") {
      sanitized[key] = sanitizeTraceObject(value)
    } else if (typeof value === "string") {
      sanitized[key] = sanitizeString(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

// --- CDP CLIENT OVER WEBSOCKET ---

class ChromeClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl

    this.ws = null

    this.id = 1

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
      const msgId = this.id++

      this.pending.set(msgId, { resolve, reject })

      this.ws.send(JSON.stringify({ id: msgId, method, params }))
    })
  }

  async eval(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,

      returnByValue: true,

      awaitPromise: true,
    })

    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${JSON.stringify(res.exceptionDetails)}`)
    }

    return res.result?.value
  }

  async waitFor(expression, timeoutMs = 10000, pollIntervalMs = 150) {
    const start = Date.now()

    while (Date.now() - start < timeoutMs) {
      try {
        const val = await this.eval(expression)

        if (val) return val
      } catch (e) {}

      await new Promise((r) => setTimeout(r, pollIntervalMs))
    }

    throw new Error(`Timeout waiting for expression: ${expression}`)
  }

  async navigate(url) {
    await this.send("Page.navigate", { url })

    await new Promise((r) => setTimeout(r, 600))
  }

  async reload() {
    await this.send("Page.reload")

    await new Promise((r) => setTimeout(r, 800))
  }

  async setViewport(width, height, isMobile = false) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,

      height,

      deviceScaleFactor: isMobile ? 2 : 1,

      mobile: isMobile,
    })

    await new Promise((r) => setTimeout(r, 300))
  }

  async maskPII() {
    await this.eval(`
      (() => {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/g;
        const phoneRegex = /(?:\\+?84|0)\\d{9,10}/g;
        const nameMap = [
          ['Nguyễn Văn An', 'Quản lý MGR-001'],
          ['Nguyễn Minh Anh', 'Hội viên MB-1001'],
          ['Lê Hoàng Nam', 'Hội viên MB-1002'],
          ['Phạm Thanh Hương', 'Hội viên MB-1003'],
          ['Vũ Quốc Thái', 'Hội viên MB-1004'],
          ['Đỗ Thị Kim', 'Hội viên MB-1005'],
          ['Trần Văn Hoàng', 'Quản lý STF-01'],
          ['Nguyễn Văn Hùng', 'HLV Trưởng STF-02'],
          ['Lê Thị Mai', 'HLV Yoga STF-03'],
          ['Lê Thi Mai', 'HLV Yoga STF-03'],
          ['Đặng Tuấn Anh', 'HLV Boxing STF-04'],
          ['Phạm Thị Thu', 'Lễ tân STF-05'],
          ['Trần Quốc Huy', 'Hội viên MB-1002'],
          ['Minh Anh', 'Hội viên MB-1001'],
          ['Hoàng Nam', 'Hội viên MB-1002'],
          ['Thanh Hương', 'Hội viên MB-1003'],
          ['Quốc Thái', 'Hội viên MB-1004'],
          ['Thị Kim', 'Hội viên MB-1005'],
          ['Văn Hoàng', 'Quản lý STF-01'],
          ['Văn Hùng', 'HLV STF-02'],
          ['Thi Mai', 'HLV STF-03'],
          ['Thị Mai', 'HLV STF-03'],
          ['Tuấn Anh', 'HLV STF-04'],
          ['Thị Thu', 'Lễ tân STF-05'],
          ['Văn An', 'Quản lý MGR-001']
        ];

        function maskString(str) {
          if (!str || typeof str !== 'string') return str;
          let res = str;
          // replace demo password in plain text
          res = res.replaceAll('12345678', '••••••••');
          // replace emails
          res = res.replace(emailRegex, (match) => {
            const parts = match.split('@');
            return parts[0].slice(0, 1) + '***@' + parts[1];
          });
          // replace phones
          res = res.replace(phoneRegex, (match) => {
            return match.slice(0, 3) + '****' + match.slice(-3);
          });
          // replace personal names
          for (const [name, mask] of nameMap) {
            if (res.includes(name)) {
              res = res.replaceAll(name, mask);
            }
          }
          return res;
        }

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const val = node.nodeValue;
          if (val && (val.includes('12345678') || emailRegex.test(val) || phoneRegex.test(val) || nameMap.some(([n]) => val.includes(n)))) {
            node.nodeValue = maskString(val);
          }
        }

        document.querySelectorAll('input').forEach(inp => {
          if (inp.type === 'password') {
            inp.value = '••••••••';
          } else if (inp.value) {
            inp.value = maskString(inp.value);
          }
        });
      })()
    `)
  }

  async captureScreenshot(filePath) {
    await this.maskPII()

    const res = await this.send("Page.captureScreenshot", { format: "png" })

    if (res && res.data) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true })

      fs.writeFileSync(filePath, Buffer.from(res.data, "base64"))
    }
  }

  close() {
    if (this.ws) {
      this.ws.close()
    }
  }
}

async function getOrCreatePageClient() {
  const chromePath =
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"

  const cdpPort = 9222

  let pageList = []

  try {
    const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`)

    if (res.ok) pageList = await res.json()
  } catch (e) {}

  let proc = null

  let tempDir = null

  if (pageList.length === 0) {
    console.log("[Chrome] Spawning headless Chrome instance on port 9222...")

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-g4-"))

    proc = spawn(
      chromePath,
      [
        `--remote-debugging-port=${cdpPort}`,

        "--headless=new",

        "--no-first-run",

        "--no-default-browser-check",

        `--user-data-dir=${tempDir}`,

        "about:blank",
      ],
      { stdio: "ignore" },
    )

    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 200))

      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json/list`)

        if (res.ok) {
          pageList = await res.json()

          if (pageList.length > 0) break
        }
      } catch (e) {}
    }
  }

  let target =
    pageList.find((p) => p.type === "page" && !p.url.startsWith("chrome://")) ||
    pageList[0]

  console.log(`[Chrome] Connected to CDP target: ${target.url}`)

  const client = new ChromeClient(target.webSocketDebuggerUrl)

  await client.connect()

  await client.send("Page.enable")

  await client.send("Runtime.enable")

  return { client, proc, tempDir }
}

// --- MAIN RUNNER ---

async function runG4BrowserMatrix() {
  console.log(
    "================================================================",
  )

  console.log("  RUNNING G4 BROWSER MATRIX & SANITIZED AUDIT (Strict No-PII)")

  console.log(
    "================================================================\n",
  )

  const auditDir = path.resolve("test/artifacts/visual-audit")

  fs.mkdirSync(auditDir, { recursive: true })

  const results = []

  function record(testId, name, status, details) {
    const isPass = status === true

    const isPending = status === "PENDING"

    results.push({
      testId,
      name,
      status: isPass ? "PASS" : isPending ? "PENDING" : "FAIL",
      passed: isPass,
      details: sanitizeTraceObject(details),
    })

    const mark = isPass ? "✅ PASS" : isPending ? "⏳ PENDING" : "❌ FAIL"

    console.log(`[${testId}] ${mark}: ${name}`)

    if (details) {
      console.log(
        `       Trace: ${JSON.stringify(sanitizeTraceObject(details))}`,
      )
    }
  }

  // --------------------------------------------------------------------------

  // PART 1: LIVE BACKEND READ-ONLY PROBE & CONTRACT AUDIT (Sanitized)

  // --------------------------------------------------------------------------

  console.log(
    "\n--- PART 1: LIVE BACKEND READ-ONLY PROBE (No Hardcoded Credentials) ---",
  )

  const LIVE_URL = "https://scms-app-p1gy.onrender.com"

  // Probe 1: Live Member GET without session (Contract Enforcement: 401 Unauthenticated Protection)

  try {
    const memberGetRes = await fetch(`${LIVE_URL}/api/members`)

    record(
      "G4.9-LIVE-01",

      "Live BE GET /api/members requires authentication (401 unauthenticated protection check)",

      memberGetRes.status === 401,

      {
        endpoint: "/api/members",

        method: "GET",

        httpStatus: memberGetRes.status,

        cookie: maskCookie(null),

        note: "BE contract correctly rejects unauthenticated requests with HTTP 401",
      },
    )
  } catch (err) {
    record("G4.9-LIVE-01", "Live BE GET /api/members reachable", false, {
      error: err.message,
    })
  }

  // Probe 2: Live Staff GET without session (Contract Enforcement: 401 Unauthenticated Protection)

  try {
    const staffGetRes = await fetch(`${LIVE_URL}/api/staff`)

    record(
      "G4.9-LIVE-02",

      "Live BE GET /api/staff requires authentication (401 unauthenticated protection check)",

      staffGetRes.status === 401,

      {
        endpoint: "/api/staff",

        method: "GET",

        httpStatus: staffGetRes.status,

        cookie: maskCookie(null),

        note: "BE contract correctly rejects unauthenticated requests with HTTP 401",
      },
    )
  } catch (err) {
    record("G4.9-LIVE-02", "Live BE GET /api/staff reachable", false, {
      error: err.message,
    })
  }

  // Probe 3: Live Authenticated Member & Staff GET Status Check

  const liveEnvEmail = process.env.LIVE_SCMS_EMAIL

  const liveEnvPassword = process.env.LIVE_SCMS_PASSWORD

  if (liveEnvEmail && liveEnvPassword) {
    try {
      const loginRes = await fetch(`${LIVE_URL}/api/auth/login`, {
        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({
          email: liveEnvEmail,
          password: liveEnvPassword,
        }),
      })

      const cookie = loginRes.headers.get("set-cookie")

      if (loginRes.ok && cookie) {
        const memRes = await fetch(`${LIVE_URL}/api/members`, {
          headers: { Cookie: cookie },
        })

        const staffRes = await fetch(`${LIVE_URL}/api/staff`, {
          headers: { Cookie: cookie },
        })

        const memData = await memRes.json().catch(() => null)

        const staffData = await staffRes.json().catch(() => null)

        const memList = extractList(memData)

        const staffList = extractList(staffData)

        const isMemValid = memRes.ok && validateMemberSchema(memList)

        const isStaffValid = staffRes.ok && validateStaffSchema(staffList)

        const isLiveGetPass = isMemValid && isStaffValid

        record(
          "G4.9-LIVE-03",
          "Live BE authenticated GET /api/members and /api/staff with valid schema conformance",
          isLiveGetPass,
          {
            loginHttpStatus: loginRes.status,

            memberHttpStatus: memRes.status,

            staffHttpStatus: staffRes.status,

            memberSchemaValid: Boolean(isMemValid),

            staffSchemaValid: Boolean(isStaffValid),

            memberRecordCount: memList ? memList.length : null,

            staffRecordCount: staffList ? staffList.length : null,
          },
        )
      } else {
        record(
          "G4.9-LIVE-03",
          "Live BE authenticated GET /api/members and /api/staff (Auth handshake failed)",
          "PENDING",
          {
            loginHttpStatus: loginRes.status,

            note: "Configured credentials rejected or failed session handshake on live BE. Kept PENDING, not PASS.",
          },
        )
      }
    } catch (err) {
      record("G4.9-LIVE-03", "Live BE authenticated GET", "PENDING", {
        error: err.message,
      })
    }
  } else {
    record(
      "G4.9-LIVE-03",

      "Live BE authenticated Member/Staff GET verification (Pending live account)",

      "PENDING",

      {
        note: "No LIVE_SCMS_EMAIL/LIVE_SCMS_PASSWORD configured. Demo credentials not hardcoded. 401 unauthenticated check does not substitute for actual data read. Marked PENDING awaiting valid live credentials.",
      },
    )
  }

  console.log(
    "\n[INFO] G4.9 Live Business Mutations: No live business mutations were performed.",
  )

  console.log(
    "       Zero residual garbage records written to live database.\n",
  )

  // --------------------------------------------------------------------------

  // PART 2: CONTROLLED BROWSER MATRIX & UI/NAVIGATION VERIFICATION

  // --------------------------------------------------------------------------

  console.log("--- PART 2: CONTROLLED BROWSER MATRIX & NAVIGATION TESTING ---")

  const viteServer = await createServer({
    server: { port: 5176 },

    mode: "mock",
  })

  await viteServer.listen()

  const BASE_URL = "http://localhost:5176"

  console.log(`[Vite] Server started at ${BASE_URL} in mock mode`)

  const { client, proc, tempDir } = await getOrCreatePageClient()

  async function performLogin(email, password = "Scms@2026") {
    await client.navigate(`${BASE_URL}/login`)

    await client.waitFor(
      'document.getElementById("login-email") !== null',
      10000,
    )

    await client.eval(`
      (() => {
        function setReactInput(input, val) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, val);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        setReactInput(document.getElementById("login-email"), "${email}");
        setReactInput(document.getElementById("login-password"), "${password}");
        const captchaEl = document.querySelector(".bg-\\\\[\\\\#f9f9f9\\\\] div");
        if (captchaEl) captchaEl.click();
      })()
    `)

    await new Promise((r) => setTimeout(r, 600))

    await client.eval(`
      (() => {
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.click();
      })()
    `)

    await new Promise((r) => setTimeout(r, 1200))
  }

  async function performLogout() {
    await client.eval(`
      (() => {
        sessionStorage.clear();
        localStorage.clear();
      })()
    `)

    await client.navigate(`${BASE_URL}/login`)

    await client.waitFor(
      'document.getElementById("login-email") !== null',
      8000,
    )
  }

  try {
    // ------------------------------------------------------------------------

    // SCENARIO 1: MANAGER PORTAL (List, Search, Filter, Detail, F5 Deep Link, Staff, Coach)

    // ------------------------------------------------------------------------

    console.log("\n[Scenario 1] Manager Portal Verification")

    await client.setViewport(1280, 800, false)

    await performLogin("manager@scms.com")

    await client.waitFor(
      'window.location.pathname === "/manager/dashboard"',
      10000,
    )

    record(
      "G4.9-MGR-01",
      "Manager login redirects to /manager/dashboard",
      true,
      {
        user: maskEmail("manager@scms.com"),

        pathname: "/manager/dashboard",
      },
    )

    // 1.1 Navigate to Member Management

    await client.navigate(`${BASE_URL}/manager/members`)

    await client.waitFor('document.querySelector("tbody tr") !== null', 8000)

    const memberListInfo = await client.eval(`
      ({
        rowCount: document.querySelectorAll("tbody tr").length,
        hasHeader: document.body.innerText.includes("hội viên") || document.body.innerText.includes("Hội viên"),
        hasFirstMemberCode: document.querySelector("tbody tr td")?.innerText?.includes("MB-1001") || false,
        hasActiveStatus: document.body.innerText.includes("Đang hoạt động") || document.body.innerText.includes("Active"),
        hasWebzoneButton: Boolean(document.querySelector(".bg-\\\\[\\\\#BA0000\\\\]"))
      })
    `)

    const memberListValid =
      memberListInfo.rowCount === 5 && memberListInfo.hasFirstMemberCode

    record(
      "G4.9-MGR-02",

      "Manager views member list with exact rows (5) and MB-1001 data assertion",

      memberListValid,

      memberListInfo,
    )

    // 1.2 Test search and filter with specific data assertions

    await client.eval(`
      (() => {
        const searchInput = document.querySelector('input[type="text"]');
        if (searchInput) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(searchInput, "MB-1004");
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `)

    await new Promise((r) => setTimeout(r, 600))

    const searchResultInfo = await client.eval(`
      ({
        rowCount: document.querySelectorAll("tbody tr").length,
        containsMB1004: document.body.innerText.includes("MB-1004"),
        containsGracePeriod: document.body.innerText.includes("Ân hạn") || document.body.innerText.includes("Grace Period")
      })
    `)

    const searchAssertionPass =
      searchResultInfo.rowCount === 1 && searchResultInfo.containsMB1004

    record(
      "G4.9-MGR-03",
      "Member search filters for exact code MB-1004 (1 record matched)",
      searchAssertionPass,
      {
        query: "MB-1004",

        assertion: searchResultInfo,
      },
    )

    // Reset search

    await client.eval(`
      (() => {
        const searchInput = document.querySelector('input[type="text"]');
        if (searchInput) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(searchInput, "");
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()
    `)

    await new Promise((r) => setTimeout(r, 400))

    // 1.3 Open Member Detail & Verify Safe Authoritative Fields & Fallback in Package Tab

    await client.eval(`
      (() => {
        const viewLink = Array.from(document.querySelectorAll("tbody tr button, tbody tr a")).find(el =>
          el.innerText.includes("Chi tiết") || el.title?.includes("Chi tiết")
        );
        if (viewLink) viewLink.click();
      })()
    `)

    await client.waitFor(
      'window.location.pathname.startsWith("/manager/members/")',
      8000,
    )

    await client.waitFor(
      'document.body.innerText.includes("Thông tin cá nhân")',
      8000,
    )

    const detailUrl = await client.eval("window.location.pathname")

    // Click to open Package tab (Gói đăng ký)

    await client.eval(`
      (() => {
        const pkgTabBtn = document.querySelector('[data-testid="tab-button-membership"]') ||
          Array.from(document.querySelectorAll("button")).find(b =>
            b.innerText.includes("Gói đăng ký") || b.innerText.includes("Membership Package")
          );
        if (pkgTabBtn) pkgTabBtn.click();
      })()
    `)

    await client.waitFor(
      'document.querySelector("[data-testid=\\"member-package-panel\\"]") !== null',
      8000,
    )

    const detailRendered = await client.eval(`
      (() => {
        const headerEl = document.querySelector('[data-testid="member-detail-header"]');
        const pkgTabBtn = document.querySelector('[data-testid="tab-button-membership"]');
        const pkgPanel = document.querySelector('[data-testid="member-package-panel"]');

        const hasDetailHeader = Boolean(headerEl && headerEl.innerText.trim().length > 0);
        const hasTabBtnActive = Boolean(pkgTabBtn && (pkgTabBtn.className.includes('border-[#BA0000]') || pkgTabBtn.className.includes('text-[#BA0000]')));
        const hasPackageTabOpened = Boolean(pkgPanel && pkgPanel.offsetHeight > 0 && hasTabBtnActive);
        const panelText = pkgPanel ? pkgPanel.innerText : '';

        return {
          pathname: window.location.pathname,
          hasDetailHeader,
          hasPackageTabOpened,
          hasNoHardcodedMS: Boolean(pkgPanel && !panelText.includes("MS-MB-")),
          hasNoZeroPrice: Boolean(pkgPanel && !/\\b0\\s*₫/.test(panelText)),
          hasFallbackLabel: Boolean(pkgPanel && panelText.includes("Chưa có dữ liệu")),
          fallbackSnippetFound: Boolean(pkgPanel && panelText.includes("Chưa có dữ liệu (thuộc G5)")),
          packagePanelElementFound: Boolean(pkgPanel)
        };
      })()
    `)

    const detailSafeAssert =
      detailRendered.hasDetailHeader &&
      detailRendered.hasPackageTabOpened &&
      detailRendered.packagePanelElementFound &&
      detailRendered.hasFallbackLabel &&
      detailRendered.hasNoHardcodedMS &&
      detailRendered.hasNoZeroPrice

    record(
      "G4.9-MGR-04",
      "Manager opens Member detail view and verifies package fallback labels in package panel",
      detailSafeAssert,
      detailRendered,
    )

    // 1.4 Test F5 Deep Link Reload

    await client.reload()

    await client.waitFor(
      'document.body.innerText.includes("Thông tin cá nhân") || document.body.innerText.includes("Gói đăng ký")',
      8000,
    )

    const reloadedUrl = await client.eval("window.location.pathname")

    record(
      "G4.9-MGR-05",

      "F5 browser reload preserves Member Detail deep-link URL and state",

      reloadedUrl === detailUrl,

      { beforeReload: detailUrl, afterReload: reloadedUrl },
    )

    // 1.5 Navigate to Staff Management & Coach Selector

    await client.navigate(`${BASE_URL}/manager/staff`)

    await client.waitFor('document.querySelector("tbody tr") !== null', 8000)

    const staffInfo = await client.eval(`
      ({
        rowCount: document.querySelectorAll("tbody tr").length,
        hasStaffHeader: document.body.innerText.includes("nhân sự") || document.body.innerText.includes("nhân viên"),
        hasCoachRoleBadge: document.body.innerText.includes("Huấn luyện viên") || document.body.innerText.includes("Coach")
      })
    `)

    record(
      "G4.9-MGR-06",
      "Manager views Staff list with Coach role mapping",
      staffInfo.rowCount > 0 && staffInfo.hasCoachRoleBadge,
      staffInfo,
    )

    // 1.6 Verify Edit Staff Modal loads exact staff data

    await client.eval(`
      (() => {
        const editBtn = Array.from(document.querySelectorAll("tbody tr button")).find(b =>
          b.innerText?.includes("Sửa") || b.innerText?.includes("Edit")
        );
        if (editBtn) editBtn.click();
      })()
    `)

    await client.waitFor('document.querySelector("form") !== null', 8000)

    const modalOpened = await client.eval(`
      (() => {
        const form = document.querySelector("form");
        const inputs = Array.from(document.querySelectorAll("form input"));
        const select = document.querySelector("form select");
        return {
          hasModal: Boolean(form),
          modalTitle: document.querySelector("h3")?.innerText || "",
          loadedName: inputs[0]?.value || "",
          loadedEmail: inputs[1]?.value || "",
          loadedRole: select?.value || "",
          hasLoadedData: Boolean(inputs[0]?.value && select?.value)
        };
      })()
    `)

    const modalAssertPass = modalOpened.hasModal && modalOpened.hasLoadedData

    record(
      "G4.9-MGR-07",
      "Manager opens Edit Staff modal with loaded data assertion",
      modalAssertPass,
      modalOpened,
    )

    // Close modal

    await client.eval(`
      (() => {
        const cancelBtn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Hủy") || b.innerText.includes("Cancel"));
        if (cancelBtn) cancelBtn.click();
      })()
    `)

    await new Promise((r) => setTimeout(r, 500))

    // ------------------------------------------------------------------------

    // SCENARIO 2: RECEPTIONIST PORTAL & CLIENT-SIDE ROUTE GUARD

    // ------------------------------------------------------------------------

    console.log("\n[Scenario 2] Receptionist Portal & Client-side Route Guard")

    await performLogout()

    await performLogin("thu.reception@scms.com")

    await client.waitFor(
      'window.location.pathname.startsWith("/receptionist/")',
      10000,
    )

    const recInitPath = await client.eval("window.location.pathname")

    record(
      "G4.9-REC-01",
      "Receptionist login redirects to /receptionist portal",
      recInitPath.startsWith("/receptionist"),
      {
        user: maskEmail("thu.reception@scms.com"),

        pathname: recInitPath,
      },
    )

    // 2.1 Authorized Receptionist Search

    await client.navigate(`${BASE_URL}/receptionist/search`)

    await client.waitFor('document.querySelector("input") !== null', 8000)

    const recSearchOk = await client.eval(
      'document.body.innerText.includes("Tra cứu") || document.body.innerText.includes("hội viên")',
    )

    record(
      "G4.9-REC-02",
      "Receptionist accesses authorized /receptionist/search page",
      recSearchOk,
      {
        pathname: "/receptionist/search",
      },
    )

    // 2.2 Client-side Route Guard (FE Navigation Block on /manager/members)

    await client.navigate(`${BASE_URL}/manager/members`)

    await new Promise((r) => setTimeout(r, 800))

    const guardMemberState = await client.eval(`
      ({
        currentPath: window.location.pathname,
        renderedForbiddenView: Boolean(document.getElementById("forbidden-view")),
        forbiddenHeadingText: document.querySelector("#forbidden-view h1, #forbidden-view h2, h2")?.innerText || "",
        managerViewRendered: Boolean(document.querySelector(".bg-\\\\[\\\\#BA0000\\\\] button"))
      })
    `)

    const guardMemberPass =
      guardMemberState.renderedForbiddenView &&
      !guardMemberState.managerViewRendered

    record(
      "G4.9-REC-03",

      "Client-side Route Guard strictly blocks Receptionist from /manager/members (FE Forbidden View)",

      guardMemberPass,

      guardMemberState,
    )

    // 2.3 Client-side Route Guard on /manager/staff

    await client.navigate(`${BASE_URL}/manager/staff`)

    await new Promise((r) => setTimeout(r, 800))

    const guardStaffState = await client.eval(`
      ({
        currentPath: window.location.pathname,
        renderedForbiddenView: Boolean(document.getElementById("forbidden-view")),
        forbiddenHeadingText: document.querySelector("#forbidden-view h1, #forbidden-view h2, h2")?.innerText || "",
        managerStaffRendered: document.body.innerText.includes("Thêm nhân viên mới")
      })
    `)

    const guardStaffPass =
      guardStaffState.renderedForbiddenView &&
      !guardStaffState.managerStaffRendered

    record(
      "G4.9-REC-04",

      "Client-side Route Guard strictly blocks Receptionist from /manager/staff (FE Forbidden View)",

      guardStaffPass,

      guardStaffState,
    )

    // ------------------------------------------------------------------------

    // SCENARIO 3: FULL PORTAL VISUAL AUDIT (Desktop 1280x800 & Mobile 375x667)

    // ------------------------------------------------------------------------

    console.log(
      "\n--- SCENARIO 3: FULL PORTAL VISUAL AUDIT (10 Screens, 20 Viewports) ---",
    )

    // 1. Audit Landing Page (Logged Out)

    await performLogout()

    await client.navigate(`${BASE_URL}/`)

    await client.waitFor('document.querySelector("header") !== null', 8000)

    await client.setViewport(1280, 800, false)

    await client.captureScreenshot(
      path.join(auditDir, "01_public_landing_desktop_1280x800.png"),
    )

    await client.setViewport(375, 667, true)

    await client.captureScreenshot(
      path.join(auditDir, "01_public_landing_mobile_375x667.png"),
    )

    console.log("[Audit] 1/10: Captured 01_public_landing (Desktop & Mobile)")

    // 2. Audit Login View (Strictly Unauthenticated, Password & Hints Sanitized)

    await client.navigate(`${BASE_URL}/login`)

    await client.waitFor(
      'document.getElementById("login-email") !== null',
      8000,
    )

    const loginPathname = await client.eval("window.location.pathname")

    if (loginPathname !== "/login")
      throw new Error(`Expected /login but got ${loginPathname}`)

    await client.setViewport(1280, 800, false)

    await client.captureScreenshot(
      path.join(auditDir, "02_login_view_desktop_1280x800.png"),
    )

    await client.setViewport(375, 667, true)

    await client.captureScreenshot(
      path.join(auditDir, "02_login_view_mobile_375x667.png"),
    )

    console.log(
      "[Audit] 2/10: Captured 02_login_view (Verified on /login pathname)",
    )

    // 3. Audit Manager Members View

    await performLogin("manager@scms.com")

    await client.navigate(`${BASE_URL}/manager/members`)

    await client.waitFor('document.querySelector("tbody tr") !== null', 8000)

    await client.setViewport(1280, 800, false)

    await client.captureScreenshot(
      path.join(auditDir, "03_manager_members_desktop_1280x800.png"),
    )

    // Mobile Responsiveness Check for Member Management

    await client.setViewport(375, 667, true)

    const mobileMemberMetrics = await client.eval(`
      ({
        mainWidth: document.querySelector("main")?.getBoundingClientRect().width || 0,
        sidebarWidthInFlow: document.querySelector("aside")?.getBoundingClientRect().left < 0,
        viewportWidth: window.innerWidth,
        hasHorizontalScroll: document.documentElement.scrollWidth > window.innerWidth
      })
    `)

    await client.captureScreenshot(
      path.join(auditDir, "03_manager_members_mobile_375x667.png"),
    )

    console.log("[Audit] 3/10: Captured 03_manager_members (Desktop & Mobile)")

    // 4. Audit Manager Staff View

    await client.navigate(`${BASE_URL}/manager/staff`)

    await client.waitFor('document.querySelector("tbody tr") !== null', 8000)

    await client.setViewport(1280, 800, false)

    await client.captureScreenshot(
      path.join(auditDir, "04_manager_staff_desktop_1280x800.png"),
    )

    await client.setViewport(375, 667, true)

    await client.captureScreenshot(
      path.join(auditDir, "04_manager_staff_mobile_375x667.png"),
    )

    console.log("[Audit] 4/10: Captured 04_manager_staff (Desktop & Mobile)")

    // 5. Audit Receptionist Search View

    await performLogout()

    await performLogin("thu.reception@scms.com")

    await client.navigate(`${BASE_URL}/receptionist/search`)

    await client.waitFor('document.querySelector("input") !== null', 8000)

    await client.setViewport(1280, 800, false)

    await client.captureScreenshot(
      path.join(auditDir, "05_receptionist_search_desktop_1280x800.png"),
    )

    await client.setViewport(375, 667, true)

    await client.captureScreenshot(
      path.join(auditDir, "05_receptionist_search_mobile_375x667.png"),
    )

    console.log(
      "[Audit] 5/10: Captured 05_receptionist_search (Desktop & Mobile)",
    )

    // 6. Audit Forbidden Guard View

    await client.navigate(`${BASE_URL}/manager/members`)

    await client.waitFor(
      'document.getElementById("forbidden-view") !== null',
      8000,
    )

    await client.setViewport(1280, 800, false)

    await client.captureScreenshot(
      path.join(auditDir, "06_forbidden_guard_view_desktop_1280x800.png"),
    )

    await client.setViewport(375, 667, true)

    await client.captureScreenshot(
      path.join(auditDir, "06_forbidden_guard_view_mobile_375x667.png"),
    )

    console.log(
      "[Audit] 6/10: Captured 06_forbidden_guard_view (Desktop & Mobile)",
    )

    // 7. Audit Admin Dashboard View

    await performLogout()

    await performLogin("admin@scms.com")

    await client.navigate(`${BASE_URL}/admin/dashboard`)

    await client.waitFor(
      'document.querySelector(".admin-shell") !== null',
      8000,
    )

    await client.setViewport(1280, 800, false)

    await client.captureScreenshot(
      path.join(auditDir, "07_admin_dashboard_desktop_1280x800.png"),
    )

    await client.setViewport(375, 667, true)

    await client.captureScreenshot(
      path.join(auditDir, "07_admin_dashboard_mobile_375x667.png"),
    )

    console.log("[Audit] 7/10: Captured 07_admin_dashboard (Desktop & Mobile)")

    // 8. Audit Admin Users View

    await client.navigate(`${BASE_URL}/admin/users`)

    await client.waitFor('document.querySelector("tbody tr") !== null', 8000)

    await client.setViewport(1280, 800, false)

    await client.captureScreenshot(
      path.join(auditDir, "08_admin_users_desktop_1280x800.png"),
    )

    await client.setViewport(375, 667, true)

    await client.captureScreenshot(
      path.join(auditDir, "08_admin_users_mobile_375x667.png"),
    )

    console.log("[Audit] 8/10: Captured 08_admin_users (Desktop & Mobile)")

    // 9. Audit Coach Dashboard View

    await performLogout()

    await performLogin("coach@scms.com")

    await client.navigate(`${BASE_URL}/coach/dashboard`)

    await client.waitFor('document.querySelector("main") !== null', 8000)

    await client.setViewport(1280, 800, false)

    await client.captureScreenshot(
      path.join(auditDir, "09_coach_dashboard_desktop_1280x800.png"),
    )

    await client.setViewport(375, 667, true)

    await client.captureScreenshot(
      path.join(auditDir, "09_coach_dashboard_mobile_375x667.png"),
    )

    console.log("[Audit] 9/10: Captured 09_coach_dashboard (Desktop & Mobile)")

    // 10. Audit Member Dashboard View

    await performLogout()

    await performLogin("minhanh@gmail.com")

    await client.navigate(`${BASE_URL}/member/dashboard`)

    await client.waitFor('document.querySelector("main") !== null', 8000)

    await client.setViewport(1280, 800, false)

    await client.captureScreenshot(
      path.join(auditDir, "10_member_dashboard_desktop_1280x800.png"),
    )

    await client.setViewport(375, 667, true)

    await client.captureScreenshot(
      path.join(auditDir, "10_member_dashboard_mobile_375x667.png"),
    )

    console.log(
      "[Audit] 10/10: Captured 10_member_dashboard (Desktop & Mobile)",
    )

    // Assertion for Mobile Usability & Viewport Space

    const mobileUsabilityPass =
      mobileMemberMetrics.mainWidth >= 320 &&
      mobileMemberMetrics.sidebarWidthInFlow

    record(
      "G4.9-AUDIT-01",
      "Mobile layout audit verified (Sidebar collapsed offscreen, main width >= 320px on 375px)",
      mobileUsabilityPass,
      {
        mobileMemberMetrics,

        screenshotCount: 20,
      },
    )

    // ------------------------------------------------------------------------

    // COMPREHENSIVE WCAG 2.1 CONTRAST AUDIT (Buttons, Headers, Canvas, Badges)

    // ------------------------------------------------------------------------

    await performLogout()

    await performLogin("manager@scms.com")

    await client.setViewport(1280, 800, false)

    await client.navigate(`${BASE_URL}/manager/members`)

    await client.waitFor('document.querySelector("thead th") !== null', 8000)

    const contrastData = await client.eval(`
      (() => {
        function getRgb(colorStr) {
          if (!colorStr || typeof colorStr !== 'string') return [0, 0, 0];
          try {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 1;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.fillStyle = '#000000';
            ctx.fillStyle = colorStr;
            ctx.fillRect(0, 0, 1, 1);
            const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
            return [r, g, b];
          } catch (e) {}
          const directMatch = colorStr.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
          if (directMatch) return [parseInt(directMatch[1], 10), parseInt(directMatch[2], 10), parseInt(directMatch[3], 10)];
          return [0, 0, 0];
        }
        function getLuminance(r, g, b) {
          const a = [r, g, b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          });
          return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
        }
        function getContrast(rgb1, rgb2) {
          const l1 = getLuminance(...rgb1);
          const l2 = getLuminance(...rgb2);
          const lighter = Math.max(l1, l2);
          const darker = Math.min(l1, l2);
          return (lighter + 0.05) / (darker + 0.05);
        }

        // 1. Primary Red Button (White on #BA0000)
        const redBtn = document.querySelector('.bg-\\\\[\\\\#BA0000\\\\]');
        let redBtnRatio = 0;
        if (redBtn) {
          const btnStyle = getComputedStyle(redBtn);
          redBtnRatio = getContrast(getRgb(btnStyle.color), getRgb(btnStyle.backgroundColor));
        }

        // 2. Dark Table Header (#E4E4E4 on #181818)
        const thead = document.querySelector('thead');
        const th = thead ? thead.querySelector('th') : null;
        let theadRatio = 0;
        if (thead && th) {
          let bgStr = getComputedStyle(thead).backgroundColor;
          if (!bgStr || bgStr === 'transparent' || bgStr.startsWith('rgba(0, 0, 0, 0)')) {
            bgStr = getComputedStyle(th).backgroundColor;
          }
          if (!bgStr || bgStr === 'transparent' || bgStr.startsWith('rgba(0, 0, 0, 0)')) {
            bgStr = 'rgb(24, 24, 24)'; // #181818 Webzone black
          }
          const thColor = getComputedStyle(th).color || 'rgb(228, 228, 228)';
          theadRatio = getContrast(getRgb(thColor), getRgb(bgStr));
        }

        // 3. Canvas Body Text (#181818 on #FFFFFF)
        const bodyHeading = document.querySelector('h2');
        let bodyHeadingRatio = 0;
        if (bodyHeading) {
          bodyHeadingRatio = getContrast(getRgb(getComputedStyle(bodyHeading).color), [255, 255, 255]);
        }

        // 4. Active Status Badge (Emerald on Emerald-50)
        const activeBadge = document.querySelector('tbody .bg-emerald-50, .bg-emerald-50');
        let activeBadgeRatio = 0;
        if (activeBadge) {
          const badgeStyle = getComputedStyle(activeBadge);
          activeBadgeRatio = getContrast(getRgb(badgeStyle.color), getRgb(badgeStyle.backgroundColor));
        }

        // 5. Warning Status Badge (Amber/Orange on Amber-50/Orange-50)
        const warnBadge = document.querySelector('tbody .bg-orange-50, tbody .bg-amber-50, .bg-amber-50, .bg-orange-50');
        let warnBadgeRatio = 0;
        if (warnBadge) {
          const warnStyle = getComputedStyle(warnBadge);
          warnBadgeRatio = getContrast(getRgb(warnStyle.color), getRgb(warnStyle.backgroundColor));
        }

        // 6. Active Sidebar Navigation Item (#BA0000 on Red-50)
        const activeNav = document.querySelector('aside button.bg-red-50, nav button.bg-red-50, aside .bg-red-50');
        let activeNavRatio = 0;
        if (activeNav) {
          const navStyle = getComputedStyle(activeNav);
          activeNavRatio = getContrast(getRgb(navStyle.color), getRgb(navStyle.backgroundColor));
        }

        return {
          redButton: {
            found: Boolean(redBtn),
            ratio: Number(redBtnRatio.toFixed(2)),
            passesAA: Boolean(redBtn && redBtnRatio >= 4.5)
          },
          darkHeader: {
            found: Boolean(thead && th),
            ratio: Number(theadRatio.toFixed(2)),
            passesAAA: Boolean(thead && th && theadRatio >= 7.0)
          },
          bodyHeading: {
            found: Boolean(bodyHeading),
            ratio: Number(bodyHeadingRatio.toFixed(2)),
            passesAAA: Boolean(bodyHeading && bodyHeadingRatio >= 7.0)
          },
          activeStatusBadge: {
            found: Boolean(activeBadge),
            ratio: Number(activeBadgeRatio.toFixed(2)),
            passesAA: Boolean(activeBadge && activeBadgeRatio >= 4.5)
          },
          warningStatusBadge: {
            found: Boolean(warnBadge),
            ratio: Number(warnBadgeRatio.toFixed(2)),
            passesAA: Boolean(warnBadge && warnBadgeRatio >= 4.5)
          },
          activeSidebarItem: {
            found: Boolean(activeNav),
            ratio: Number(activeNavRatio.toFixed(2)),
            passesAA: Boolean(activeNav && activeNavRatio >= 4.5)
          }
        };
      })()
    `)

    const allContrastElementsFound =
      contrastData.redButton.found &&
      contrastData.darkHeader.found &&
      contrastData.bodyHeading.found &&
      contrastData.activeStatusBadge.found &&
      contrastData.warningStatusBadge.found &&
      contrastData.activeSidebarItem.found

    const allContrastRatiosPassed =
      contrastData.redButton.passesAA &&
      contrastData.darkHeader.passesAAA &&
      contrastData.bodyHeading.passesAAA &&
      contrastData.activeStatusBadge.passesAA &&
      contrastData.warningStatusBadge.passesAA &&
      contrastData.activeSidebarItem.passesAA

    const contrastPass = allContrastElementsFound && allContrastRatiosPassed

    record(
      "G4.9-AUDIT-02",

      "System-wide WCAG 2.1 contrast ratio verified across all 6 key elements (buttons, headers, headings, badges, and sidebar)",

      contrastPass,

      contrastData,
    )

    console.log(
      "\n================================================================",
    )

    const passedCount = results.filter((r) => r.status === "PASS").length

    const pendingCount = results.filter((r) => r.status === "PENDING").length

    const failedCount = results.filter((r) => r.status === "FAIL").length

    console.log(
      `CURRENT SCRIPT EXECUTION RESULTS: ${passedCount} PASSED, ${pendingCount} PENDING, ${failedCount} FAILED`,
    )

    console.log(
      "================================================================\n",
    )

    if (failedCount > 0) {
      process.exitCode = 1
    }
  } finally {
    client.close()

    if (proc) {
      proc.kill("SIGKILL")
    }

    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch (e) {}
    }

    await viteServer.close()
  }
}

runG4BrowserMatrix().catch((err) => {
  console.error("[Error] Execution failed:", err)

  process.exit(1)
})
