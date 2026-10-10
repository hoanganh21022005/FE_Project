import { spawn } from "child_process"

import os from "os"

import path from "path"

import fs from "fs"

// Helper CDP client over native WebSocket

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

      // Handle CDP Fetch domain network interception for real HTTP 401 & 403 tests

      if (msg.method === "Fetch.requestPaused") {
        const { requestId, request } = msg.params

        if (request.url.includes("/api/test-matrix-403")) {
          this.ws.send(
            JSON.stringify({
              id: this.id++,

              method: "Fetch.fulfillRequest",

              params: {
                requestId,

                responseCode: 403,

                responseHeaders: [
                  { name: "Content-Type", value: "application/json" },
                ],

                body: Buffer.from(
                  JSON.stringify({
                    message:
                      "Bạn không có quyền thực hiện thao tác này (403 Forbidden).",
                  }),
                ).toString("base64"),
              },
            }),
          )
        } else if (request.url.includes("/api/test-matrix-401")) {
          this.ws.send(
            JSON.stringify({
              id: this.id++,

              method: "Fetch.fulfillRequest",

              params: {
                requestId,

                responseCode: 401,

                responseHeaders: [
                  { name: "Content-Type", value: "application/json" },
                ],

                body: Buffer.from(
                  JSON.stringify({
                    message: "Phiên đăng nhập đã hết hạn (401 Unauthorized).",
                  }),
                ).toString("base64"),
              },
            }),
          )
        } else {
          this.ws.send(
            JSON.stringify({
              id: this.id++,

              method: "Fetch.continueRequest",

              params: { requestId },
            }),
          )
        }

        return
      }

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
      } catch (e) {
        // retry
      }

      await new Promise((r) => setTimeout(r, pollIntervalMs))
    }

    throw new Error(`Timeout waiting for expression: ${expression}`)
  }

  async navigate(url) {
    await this.send("Page.navigate", { url })

    await new Promise((r) => setTimeout(r, 700))
  }

  async reload() {
    await this.send("Page.reload")

    await new Promise((r) => setTimeout(r, 900))
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
    console.log(
      "[Setup] Launching Google Chrome headless instance on port 9222...",
    )

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-matrix-"))

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

  let target = pageList.find(
    (p) => p.type === "page" && !p.url.startsWith("chrome://"),
  )

  if (!target) {
    target = pageList.find((p) => p.type === "page")
  }

  console.log(`[Setup] Connected to page: ${target.url}`)

  const client = new ChromeClient(target.webSocketDebuggerUrl)

  await client.connect()

  await client.send("Page.enable")

  await client.send("Runtime.enable")

  await client.send("Fetch.enable", {
    patterns: [
      { urlPattern: "*/api/test-matrix-403*", requestStage: "Request" },

      { urlPattern: "*/api/test-matrix-401*", requestStage: "Request" },
    ],
  })

  return { client, proc, tempDir }
}

async function runBrowserMatrix() {
  const results = []

  const { client, proc, tempDir } = await getOrCreatePageClient()

  function record(testName, passed, details) {
    const status = passed ? "PASS" : "FAIL"

    results.push({ testName, passed, details })

    console.log(`[${status}] ${testName}`)

    if (details) console.log(`       Details: ${JSON.stringify(details)}`)
  }

  // Helper to perform in-browser form login

  async function performLogin(email, password = "Scms@2026") {
    await client.navigate("http://localhost:5174/login")

    await client.waitFor('document.getElementById("login-email") !== null')

    await client.eval(`
      (() => {
        function setReactInput(input, val) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, val);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const emailInput = document.getElementById("login-email");
        setReactInput(emailInput, "${email}");

        const passInput = document.getElementById("login-password");
        setReactInput(passInput, "${password}");

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

    await new Promise((r) => setTimeout(r, 900))
  }

  // Helper to click actual Header logout button

  async function clickHeaderLogout() {
    await client.eval(`
      (() => {
        const logoutBtn = document.getElementById('header-logout-btn') ||
          Array.from(document.querySelectorAll('header button')).find(b =>
            b.title?.includes('xuất') || b.getAttribute('aria-label')?.includes('xuất')
          );
        if (logoutBtn) logoutBtn.click();
      })()
    `)

    await new Promise((r) => setTimeout(r, 800))
  }

  try {
    const BASE_URL = "http://localhost:5174"

    // =========================================================================

    // SECTION 1: MEMBER FLOW (Login, Wrong Route, F5, Recovery, Back/Fwd, Real Logout)

    // =========================================================================

    console.log("\n--- Scenario 1: Member Flow (minhanh@gmail.com) ---")

    await performLogin("minhanh@gmail.com")

    await client.waitFor(
      'window.location.pathname === "/member/dashboard"',
      10000,
    )

    const step1Info = await client.eval(`
      ({
        pathname: window.location.pathname,
        hasMemberView: document.body.innerText.includes("Hội viên") || document.body.innerText.includes("Minh Anh"),
        hasManagerView: document.body.innerText.includes("Gói thành viên") && document.body.innerText.includes("Bộ môn & phòng")
      })
    `)

    record(
      "1.1 Member login redirects to /member/dashboard",
      step1Info.pathname === "/member/dashboard",
      step1Info,
    )

    record(
      "1.2 Member view mounted, Manager view NOT mounted",
      step1Info.hasMemberView && !step1Info.hasManagerView,
      step1Info,
    )

    // Direct wrong role URL: /manager/classes

    await client.navigate(`${BASE_URL}/manager/classes`)

    await new Promise((r) => setTimeout(r, 900))

    const step1ForbiddenInfo = await client.eval(`
      ({
        pathname: window.location.pathname,
        hasForbiddenView: Boolean(document.getElementById("forbidden-view")),
        forbiddenText: document.getElementById("forbidden-view")?.innerText?.slice(0, 150) || "",
        hasClassesManagement: document.body.innerText.includes("Tạo lớp học mới")
      })
    `)

    record(
      "1.3 Member entering Manager URL (/manager/classes) triggers 403 ForbiddenView",
      step1ForbiddenInfo.hasForbiddenView,
      step1ForbiddenInfo,
    )

    record(
      "1.4 Manager view (ClassManagement) is NOT mounted",
      !step1ForbiddenInfo.hasClassesManagement,
      step1ForbiddenInfo,
    )

    // F5 reload on forbidden route

    await client.reload()

    const step1ReloadInfo = await client.eval(`
      ({
        pathname: window.location.pathname,
        hasForbiddenView: Boolean(document.getElementById("forbidden-view")),
        authPersisted: sessionStorage.getItem("scms_mock_authenticated") === "true"
      })
    `)

    record(
      "1.5 F5 reload preserves 403 Forbidden state & session",
      step1ReloadInfo.hasForbiddenView && step1ReloadInfo.authPersisted,
      step1ReloadInfo,
    )

    // Recovery button -> return to member dashboard

    await client.eval(`document.getElementById("forbidden-go-home")?.click()`)

    await new Promise((r) => setTimeout(r, 900))

    const step1RecoverInfo = await client.eval(`
      ({
        pathname: window.location.pathname,
        hasMemberDashboard: document.body.innerText.includes("Hội viên") || document.body.innerText.includes("Minh Anh")
      })
    `)

    record(
      "1.6 Recovery button redirects to /member/dashboard",
      step1RecoverInfo.pathname === "/member/dashboard" &&
        step1RecoverInfo.hasMemberDashboard,
      step1RecoverInfo,
    )

    // Unknown route fallback

    await client.navigate(`${BASE_URL}/non-existent-route-xyz`)

    await new Promise((r) => setTimeout(r, 900))

    const step1UnknownInfo = await client.eval(
      `({ pathname: window.location.pathname })`,
    )

    record(
      "1.7 Unknown route automatically falls back to /member/dashboard",
      step1UnknownInfo.pathname === "/member/dashboard",
      step1UnknownInfo,
    )

    // History Back / Forward

    await client.eval(`
      window.history.pushState(null, "", "/member/my-membership");
      window.dispatchEvent(new PopStateEvent("popstate"));
    `)

    await new Promise((r) => setTimeout(r, 600))

    await client.eval("window.history.back()")

    await new Promise((r) => setTimeout(r, 700))

    const backInfo = await client.eval(
      "({ pathname: window.location.pathname })",
    )

    await client.eval("window.history.forward()")

    await new Promise((r) => setTimeout(r, 700))

    const fwdInfo = await client.eval(
      "({ pathname: window.location.pathname })",
    )

    record(
      "1.8 History Back & Forward works across routes",
      backInfo.pathname === "/member/dashboard" &&
        fwdInfo.pathname === "/member/my-membership",
      { back: backInfo.pathname, forward: fwdInfo.pathname },
    )

    // Item 1: Click real Header Logout button

    await clickHeaderLogout()

    const logoutInfo = await client.eval(`
      ({
        pathname: window.location.pathname,
        isLoggedOut: sessionStorage.getItem("scms_mock_authenticated") !== "true",
        hasLandingOrLogin: document.body.innerText.includes("Đăng nhập") || document.body.innerText.includes("NỀN TẢNG QUẢN LÝ")
      })
    `)

    record(
      "1.9 Real Header Logout button destroys session and redirects to /",
      logoutInfo.isLoggedOut && logoutInfo.hasLandingOrLogin,
      logoutInfo,
    )

    // Unauthenticated access intercepted

    await client.navigate(`${BASE_URL}/manager/dashboard`)

    await new Promise((r) => setTimeout(r, 800))

    const unauthIntercept = await client.eval(`
      ({
        hasLoginForm: Boolean(document.getElementById("login-email")),
        hasManagerDashboard: document.body.innerText.includes("STF-001")
      })
    `)

    record(
      "1.10 Unauthenticated access intercepted to login view",
      unauthIntercept.hasLoginForm && !unauthIntercept.hasManagerDashboard,
      unauthIntercept,
    )

    // =========================================================================

    // SECTION 2: RECEPTIONIST FLOW (Login, Allowed Route, Wrong Route, F5, Real Logout)

    // =========================================================================

    console.log(
      "\n--- Scenario 2: Receptionist Flow (thu.reception@scms.com) ---",
    )

    await performLogin("thu.reception@scms.com")

    await client.waitFor(
      'window.location.pathname === "/receptionist/dashboard"',
      10000,
    )

    const recLoginInfo = await client.eval(`
      ({
        pathname: window.location.pathname,
        hasReceptionDashboard: document.body.innerText.toLowerCase().includes("quầy lễ tân") ||
          document.body.innerText.toLowerCase().includes("lễ tân") ||
          document.body.innerText.includes("Tạo Hội Viên Mới")
      })
    `)

    record(
      "2.1 Receptionist login redirects to /receptionist/dashboard",
      recLoginInfo.pathname === "/receptionist/dashboard" &&
        recLoginInfo.hasReceptionDashboard,
      recLoginInfo,
    )

    // Access allowed route: /receptionist/booking

    await client.navigate(`${BASE_URL}/receptionist/booking`)

    await new Promise((r) => setTimeout(r, 900))

    const recBookingInfo = await client.eval(`
      ({
        pathname: window.location.pathname,
        hasBookingView: document.body.innerText.includes("Chọn Thành Viên Cần Đăng Ký Lớp") ||
          document.body.innerText.includes("quầy Lễ tân") ||
          document.body.innerText.includes("Đặt lịch lớp")
      })
    `)

    record(
      "2.2 Receptionist can access allowed route /receptionist/booking",
      recBookingInfo.hasBookingView,
      recBookingInfo,
    )

    // Access wrong role route: /admin/dashboard

    await client.navigate(`${BASE_URL}/admin/dashboard`)

    await new Promise((r) => setTimeout(r, 900))

    const recForbiddenInfo = await client.eval(`
      ({
        pathname: window.location.pathname,
        hasForbiddenView: Boolean(document.getElementById("forbidden-view")),
        hasAdminPortal: document.body.innerText.includes("Tài khoản Admin")
      })
    `)

    record(
      "2.3 Receptionist accessing Admin route triggers 403 ForbiddenView",
      recForbiddenInfo.hasForbiddenView && !recForbiddenInfo.hasAdminPortal,
      recForbiddenInfo,
    )

    // F5 reload on forbidden route

    await client.reload()

    const recReloadInfo = await client.eval(`
      ({
        hasForbiddenView: Boolean(document.getElementById("forbidden-view")),
        authPersisted: sessionStorage.getItem("scms_mock_authenticated") === "true"
      })
    `)

    record(
      "2.4 Receptionist F5 reload preserves 403 Forbidden state",
      recReloadInfo.hasForbiddenView && recReloadInfo.authPersisted,
      recReloadInfo,
    )

    // Click real Logout button

    await client.eval(`document.getElementById("forbidden-go-home")?.click()`)

    await new Promise((r) => setTimeout(r, 900))

    await clickHeaderLogout()

    const recLogoutInfo = await client.eval(
      'sessionStorage.getItem("scms_mock_authenticated") !== "true"',
    )

    record(
      "2.5 Receptionist real Header Logout button logs out cleanly",
      recLogoutInfo,
      { isLoggedOut: recLogoutInfo },
    )

    // =========================================================================

    // SECTION 3: ADMIN FLOW (Login, Allowed Route, Wrong Route, F5, Real Logout)

    // =========================================================================

    console.log("\n--- Scenario 3: Admin Flow (admin@scms.com) ---")

    await performLogin("admin@scms.com")

    await client.waitFor(
      'window.location.pathname === "/admin/dashboard"',
      10000,
    )

    const adminLoginInfo = await client.eval(`
      ({
        pathname: window.location.pathname,
        hasAdminDashboard: document.body.innerText.includes("Admin") || document.body.innerText.includes("Quản trị")
      })
    `)

    record(
      "3.1 Admin login redirects to /admin/dashboard",
      adminLoginInfo.pathname === "/admin/dashboard" &&
        adminLoginInfo.hasAdminDashboard,
      adminLoginInfo,
    )

    // Access wrong role route: /manager/classes

    await client.navigate(`${BASE_URL}/manager/classes`)

    await new Promise((r) => setTimeout(r, 900))

    const adminForbiddenInfo = await client.eval(`
      ({
        pathname: window.location.pathname,
        hasForbiddenView: Boolean(document.getElementById("forbidden-view")),
        hasClasses: document.body.innerText.includes("Tạo lớp học mới")
      })
    `)

    record(
      "3.2 Admin accessing Manager route triggers 403 ForbiddenView",
      adminForbiddenInfo.hasForbiddenView && !adminForbiddenInfo.hasClasses,
      adminForbiddenInfo,
    )

    // Return home and F5 reload

    await client.eval(`document.getElementById("forbidden-go-home")?.click()`)

    await new Promise((r) => setTimeout(r, 900))

    await client.reload()

    const adminReloadInfo = await client.eval(`
      ({
        pathname: window.location.pathname,
        hasAdminDashboard: document.body.innerText.includes("Admin")
      })
    `)

    record(
      "3.3 Admin F5 reload on /admin/dashboard maintains admin session",
      adminReloadInfo.pathname === "/admin/dashboard" &&
        adminReloadInfo.hasAdminDashboard,
      adminReloadInfo,
    )

    // Click real Logout button

    await clickHeaderLogout()

    const adminLogoutInfo = await client.eval(
      'sessionStorage.getItem("scms_mock_authenticated") !== "true"',
    )

    record(
      "3.4 Admin real Header Logout button logs out cleanly",
      adminLogoutInfo,
      { isLoggedOut: adminLogoutInfo },
    )

    // =========================================================================

    // SECTION 4: MANAGER FLOW & REAL HTTP 403 / 401 ISOLATION (Item 2 & Item 4)

    // =========================================================================

    console.log(
      "\n--- Scenario 4: Manager Flow & Real HTTP 403/401 Testing ---",
    )

    await performLogin("manager@scms.com")

    await client.waitFor(
      'window.location.pathname === "/manager/dashboard"',
      10000,
    )

    const mgrLoginInfo = await client.eval(`
      ({
        pathname: window.location.pathname,
        hasManagerDashboard: document.body.innerText.includes("Gói thành viên") || document.body.innerText.includes("Nhật ký hệ thống")
      })
    `)

    record(
      "4.1 Manager login redirects to /manager/dashboard",
      mgrLoginInfo.pathname === "/manager/dashboard" &&
        mgrLoginInfo.hasManagerDashboard,
      mgrLoginInfo,
    )

    // Access allowed route: /manager/classes

    await client.navigate(`${BASE_URL}/manager/classes`)

    await new Promise((r) => setTimeout(r, 900))

    const mgrClassesInfo = await client.eval(
      `document.body.innerText.includes("Quản lý lớp nhóm") || document.body.innerText.includes("Danh sách") || document.body.innerText.includes("Lớp học")`,
    )

    record(
      "4.2 Manager can access allowed route /manager/classes",
      mgrClassesInfo,
      { hasClasses: mgrClassesInfo },
    )

    // Navigate to /coach/schedule (Forbidden)

    await client.navigate(`${BASE_URL}/coach/schedule`)

    await new Promise((r) => setTimeout(r, 900))

    const mgrForbiddenInfo = await client.eval(
      `Boolean(document.getElementById("forbidden-view"))`,
    )

    record(
      "4.3 Manager accessing Coach route triggers 403 ForbiddenView",
      mgrForbiddenInfo,
      { hasForbiddenView: mgrForbiddenInfo },
    )

    // Item 2: Real HTTP 403 API call via native browser network stack + Assert Toast

    const http403Result = await client.eval(`
      (async () => {
        try {
          await window.__scms_httpRequest('/api/test-matrix-403');
          return 'unexpected-success';
        } catch (e) {
          return { status: e.status, code: e.code, message: e.message };
        }
      })()
    `)

    await new Promise((r) => setTimeout(r, 700))

    const toast403Info = await client.eval(`
      ({
        toastExists: Boolean(document.getElementById("scms-toast")),
        toastText: document.getElementById("scms-toast")?.innerText || "",
        sessionPreserved: sessionStorage.getItem("scms_mock_authenticated") === "true",
        stillLoggedIn: !document.body.innerText.includes("Đăng nhập")
      })
    `)

    record(
      "4.4 Real HTTP 403 API call displays Toast 403 and PRESERVES session",

      http403Result.status === 403 &&
        toast403Info.toastExists &&
        toast403Info.sessionPreserved &&
        toast403Info.stillLoggedIn,

      { http403Result, toast403Info },
    )

    // Item 2 & Item 4: Real HTTP 401 API call -> Destroys session, keeps /coach/schedule URL & renders LoginView

    const http401Result = await client.eval(`
      (async () => {
        try {
          await window.__scms_httpRequest('/api/test-matrix-401');
          return 'unexpected-success';
        } catch (e) {
          return { status: e.status, code: e.code, message: e.message };
        }
      })()
    `)

    await new Promise((r) => setTimeout(r, 900))

    const http401State = await client.eval(`
      ({
        pathname: window.location.pathname,
        sessionDestroyed: sessionStorage.getItem("scms_mock_authenticated") !== "true",
        hasLoginForm: Boolean(document.getElementById("login-email"))
      })
    `)

    record(
      "4.5 Real HTTP 401 API call destroys session, keeps current route URL & renders LoginView (intended location)",

      http401Result.status === 401 &&
        http401State.pathname === "/coach/schedule" &&
        http401State.sessionDestroyed &&
        http401State.hasLoginForm,

      { http401Result, http401State },
    )

    console.log("\n========================================================")

    const passedCount = results.filter((r) => r.passed).length

    console.log(
      `COMPLETE BROWSER MATRIX: ${passedCount}/${results.length} PASSED`,
    )

    console.log("========================================================\n")

    if (passedCount !== results.length) {
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
  }
}

runBrowserMatrix().catch((err) => {
  console.error("[Error] Browser matrix failed:", err)

  process.exit(1)
})
