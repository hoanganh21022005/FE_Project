import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createServer } from "vite"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
)
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const sessionId = 42
const isoFutureDate = "2099-10-28"
const screenshotPath = path.join(
  projectRoot,
  "test",
  "screenshots",
  "member-dashboard.png",
)

class ChromeClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl)
    this.nextId = 1
    this.pending = new Map()
    this.ws.onmessage = ({ data }) => {
      const message = JSON.parse(data)
      if (!message.id || !this.pending.has(message.id)) return
      const { resolve, reject } = this.pending.get(message.id)
      this.pending.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
    }
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve
      this.ws.onerror = reject
    })
  }

  send(method, params = {}) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text,
      )
    }
    return result.result?.value
  }

  async waitFor(expression, timeoutMs = 10000) {
    const started = Date.now()
    while (Date.now() - started < timeoutMs) {
      if (await this.evaluate(`Boolean(${expression})`)) return
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error(`Timed out waiting for ${expression}`)
  }

  close() {
    this.ws.close()
  }
}

const scenarioScript = `
(() => {
  window.__dashboardRequests = [];
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const rawUrl = typeof input === 'string' ? input : input.url;
    const url = new URL(rawUrl, location.href);
    if (!url.pathname.startsWith('/api/')) return nativeFetch(input, init);

    const scenario = sessionStorage.getItem('memberDashboardScenario') || 'both';
    const method = String(init.method || 'GET').toUpperCase();
    window.__dashboardRequests.push({ method, path: url.pathname });
    const sessionId = ${sessionId};
    const futureDate = '${isoFutureDate}';
    const normal = [{
      id: 501, memberId: sessionId, status: 'Registered', classType: 'Normal',
      className: 'Lớp cầu lông cơ bản', subjectName: 'Cầu lông', coachName: 'Coach Minh',
      sessions: [{ id: 901, sessionDate: futureDate, startTime: '09:00', endTime: '10:30', status: 'Scheduled', roomName: 'Sân 2' }]
    }];
    const advanced = [
      { subscriptionId: 701, packageType: 'Advanced', status: 'Active', subjectId: 19, subjectName: 'Tennis', packageName: 'Advanced · Tennis', primaryCoachName: 'Coach An', remainingCredit: 5, activatedAt: '2026-10-01T08:00:00', expiresAt: '2099-12-01T08:00:00' },
      { subscriptionId: 702, packageType: 'Advanced', status: 'Active', subjectId: 20, subjectName: 'Bơi lội', packageName: 'Advanced · Bơi lội', primaryCoachName: 'Coach Bình', remainingCredit: 3, activatedAt: '2026-10-01T08:00:00', expiresAt: '2099-12-01T08:00:00' }
    ];
    const path = url.pathname;
    if (path === '/api/auth/me') {
      return Response.json({ userId: 11, memberId: sessionId, role: 'member', fullName: 'Lê Minh Anh', email: 'member@example.com' });
    }
    if (scenario === 'unauthorized' && path === '/api/members/me/invoices') {
      return Response.json({ code: 'UNAUTHORIZED', message: 'Session expired' }, { status: 401 });
    }
    if (scenario === 'errors' && path === '/api/members/42/subscriptions') {
      return Response.json({ code: 'SERVER_ERROR', message: 'Test backend failure' }, { status: 500 });
    }
    if (scenario === 'errors' && path === '/api/sessions') {
      throw new TypeError('Test network failure');
    }
    if (scenario === 'errors' && path === '/api/attendances') {
      return Response.json({ code: 'FORBIDDEN', message: 'Không có quyền xem điểm danh' }, { status: 403 });
    }
    if (scenario === 'malformed' && path.endsWith('/enrollments')) return Response.json(null);
    if (path.endsWith('/enrollments')) return Response.json(scenario === 'normal' || scenario === 'both' ? normal : []);
    if (path.endsWith('/subscriptions')) return Response.json(scenario === 'advanced' || scenario === 'both' ? advanced : []);
    if (path === '/api/sessions') return Response.json([
      { id: 901, bookedMemberId: sessionId, status: 'Scheduled', sessionDate: futureDate, startTime: '09:00', endTime: '10:30', className: 'Lớp cầu lông cơ bản', subjectName: 'Cầu lông', coachName: 'Coach Minh', roomName: 'Sân 2' },
      { id: 902, bookedMemberId: 99, status: 'Scheduled', sessionDate: futureDate, startTime: '10:00', endTime: '11:30', className: 'Không thuộc Member' },
      { id: 903, bookedMemberId: sessionId, status: 'Cancelled', sessionDate: futureDate, startTime: '11:00', endTime: '12:30', className: 'Đã hủy' }
    ]);
    if (path === '/api/attendances') return Response.json([
      { id: 801, memberId: sessionId, sessionId: 901, state: 'Present', checkInTime: '2026-10-27T09:00:00' },
      { id: 802, memberId: 99, sessionId: 902, state: 'Present', checkInTime: '2026-10-27T09:00:00' }
    ]);
    if (path === '/api/members/me/invoices') return Response.json([]);
    if (path === '/api/notifications/me') return Response.json([]);
    if (path === '/api/members/me/checkin-code') return Response.json({ payload: 'SAFE-TEST-PAYLOAD', expiresInSeconds: 5 });
    return Response.json([]);
  };
})();
`

async function getFreePort() {
  const server = await import("node:net").then(({ createServer }) =>
    createServer(),
  )
  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
  })
}

async function main() {
  assert.ok(fs.existsSync(chromePath), `Chrome was not found at ${chromePath}`)
  const port = await getFreePort()
  const vite = await createServer({
    configFile: path.join(projectRoot, "vite.config.js"),
    mode: "development",
    server: { host: "127.0.0.1", port, strictPort: true },
  })
  const chromePort = await getFreePort()
  const profileDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "scms-member-dashboard-"),
  )
  const chrome = spawn(
    chromePath,
    [
      `--remote-debugging-port=${chromePort}`,
      "--remote-debugging-address=127.0.0.1",
      "--disable-gpu",
      "--no-sandbox",
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profileDir}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  )
  let client

  try {
    await vite.listen()
    let page
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const response = await fetch(`http://127.0.0.1:${chromePort}/json/list`)
        const pages = await response.json()
        page = pages.find((item) => item.type === "page")
        if (page) break
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
    assert.ok(page, "Chrome DevTools page did not start")
    client = new ChromeClient(page.webSocketDebuggerUrl)
    await client.connect()
    await client.send("Page.enable")
    await client.send("Runtime.enable")
    await client.send("Page.addScriptToEvaluateOnNewDocument", {
      source: scenarioScript,
    })
    await client.send("Page.navigate", {
      url: `http://127.0.0.1:${port}/member/dashboard`,
    })
    await client.waitFor(
      "document.querySelector('h1')?.textContent.includes('Tổng quan')",
    )
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false,
    })

    const scenarios = ["normal", "advanced", "both", "none"]
    for (const scenario of scenarios) {
      await client.evaluate(
        `sessionStorage.setItem('memberDashboardScenario', '${scenario}'); location.reload()`,
      )
      await client.waitFor(
        "document.querySelector('h1')?.textContent.includes('Tổng quan')",
      )
      const readyText =
        scenario === "none"
          ? "Bạn chưa có lớp hoặc gói học đang hoạt động"
          : scenario === "advanced"
            ? "ADVANCED · TENNIS"
            : "Lớp cầu lông cơ bản"
      try {
        await client.waitFor(
          `document.body.innerText.includes(${JSON.stringify(readyText)})`,
        )
      } catch (error) {
        console.error(
          "Browser scenario state:",
          scenario,
          await client.evaluate("document.body.innerText"),
          await client.evaluate("window.__dashboardRequests"),
        )
        throw error
      }
      const text = await client.evaluate("document.body.innerText")
      assert.match(text, /Lớp Normal đang tham gia/)
      assert.match(text, /Credit Advanced còn lại/)
      if (scenario === "normal") {
        assert.match(text, /Lớp cầu lông cơ bản/)
        assert.match(text, /Advanced[\s\S]*0/)
      } else if (scenario === "advanced") {
        assert.match(text, /Tennis/)
        assert.match(text, /Bơi lội/)
        assert.match(text, /8[\s\S]*Tổng theo các gói Active/)
      } else if (scenario === "both") {
        assert.match(text, /Lớp cầu lông cơ bản/)
        assert.match(text, /Tennis/)
        assert.match(text, /Bơi lội/)
        assert.match(text, /Buổi học sắp tới\s+1/)
        assert.doesNotMatch(text, /Calo tiêu hao|Calories|Cân nặng|Weight/)
        const screenshot = await client.send("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: false,
        })
        fs.mkdirSync(path.dirname(screenshotPath), { recursive: true })
        fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"))
      } else {
        assert.match(text, /Bạn chưa có lớp hoặc gói học đang hoạt động/)
      }
      const requests = await client.evaluate("window.__dashboardRequests")
      assert.ok(
        requests.every((request) => request.method === "GET"),
        "Dashboard issued a mutation request",
      )
    }

    await client.evaluate(
      "sessionStorage.setItem('memberDashboardScenario', 'errors'); location.reload()",
    )
    await client.waitFor(
      "document.querySelector('h1')?.textContent.includes('Tổng quan')",
    )
    await client.waitFor(
      "document.body.innerText.includes('Không có quyền xem điểm danh')",
    )
    const errorText = await client.evaluate("document.body.innerText")
    assert.match(errorText, /Tổng quan/)
    assert.match(errorText, /Không có quyền xem điểm danh/)
    assert.match(errorText, /Test backend failure/)
    assert.match(errorText, /Không thể kết nối đến máy chủ/)

    await client.evaluate(
      "sessionStorage.setItem('memberDashboardScenario', 'malformed'); location.reload()",
    )
    await client.waitFor(
      "document.querySelector('h1')?.textContent.includes('Tổng quan')",
    )
    await client.waitFor(
      "document.body.innerText.includes('dữ liệu trả về không đúng định dạng')",
    )
    assert.match(
      await client.evaluate("document.body.innerText"),
      /dữ liệu trả về không đúng định dạng/,
    )

    await client.evaluate(
      "sessionStorage.setItem('memberDashboardScenario', 'both'); location.reload()",
    )
    await client.waitFor(
      "document.querySelector('h1')?.textContent.includes('Tổng quan')",
    )
    await client.waitFor(
      "document.body.innerText.includes('Lớp cầu lông cơ bản')",
    )
    await client.evaluate(
      "Array.from(document.querySelectorAll('button')).find((button) => button.innerText.includes('Mã QR Check-in'))?.click()",
    )
    await client.waitFor("document.querySelector('[role=dialog] svg')")
    const qrDialogText = await client.evaluate(
      "document.querySelector('[role=dialog]').innerText",
    )
    assert.doesNotMatch(qrDialogText, /SAFE-TEST-PAYLOAD/)

    await client.evaluate(
      "sessionStorage.setItem('memberDashboardScenario', 'unauthorized'); location.reload()",
    )
    await client.waitFor(
      "document.body.innerText.includes('Nhập thông tin tài khoản để tiếp tục.')",
    )
    assert.match(
      await client.evaluate("document.body.innerText"),
      /Nhập thông tin tài khoản để tiếp tục/,
    )

    await client.evaluate(
      "sessionStorage.setItem('memberDashboardScenario', 'both'); location.reload()",
    )
    await client.waitFor(
      "document.querySelector('h1')?.textContent.includes('Tổng quan')",
    )
    await client.waitFor(
      "document.body.innerText.includes('Lớp cầu lông cơ bản')",
    )

    const dimensions = []
    for (const width of [1920, 1366, 768, 390]) {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: width < 768,
      })
      const metrics = await client.evaluate(
        "({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth })",
      )
      assert.ok(
        metrics.scrollWidth <= metrics.width,
        `Horizontal overflow at ${width}px: ${JSON.stringify(metrics)}`,
      )
      dimensions.push({ viewport: width, document: metrics.scrollWidth })
    }

    console.log("Member dashboard browser checks passed.")
    console.log(
      JSON.stringify(
        {
          scenarios,
          apiErrors: [401, 403, 500, "network", "malformed"],
          qrPayloadNotDisplayed: true,
          dimensions,
          apiRequestsAreReadOnly: true,
          screenshotPath,
        },
        null,
        2,
      ),
    )
  } finally {
    if (client) {
      try {
        await client.send("Browser.close")
      } catch {}
    }
    client?.close()
    if (chrome.exitCode === null) {
      const exited = new Promise((resolve) => chrome.once("exit", resolve))
      chrome.kill()
      await Promise.race([
        exited,
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ])
    }
    await vite.close()
    const resolvedProfile = path.resolve(profileDir)
    const resolvedTempRoot = path.resolve(os.tmpdir())
    if (
      path.dirname(resolvedProfile) === resolvedTempRoot &&
      path.basename(resolvedProfile).startsWith("scms-member-dashboard-")
    ) {
      try {
        fs.rmSync(resolvedProfile, { recursive: true, force: true })
      } catch (error) {
        if (error?.code !== "EPERM" && error?.code !== "EBUSY") throw error
      }
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
