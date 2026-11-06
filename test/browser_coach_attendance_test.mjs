import { spawn } from "node:child_process"
import assert from "node:assert/strict"

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
const API_PORT = 5173
const MOCK_PORT = 5174

let apiVite = null
let mockVite = null
let chrome = null
let ws = null

const cleanup = () => {
  try { ws?.close() } catch {}
  try { chrome?.kill("SIGKILL") } catch {}
  try { apiVite?.kill("SIGKILL") } catch {}
  try { mockVite?.kill("SIGKILL") } catch {}
}

process.on("exit", cleanup)
process.on("SIGINT", cleanup)

try {
  console.log("=== KHỞI ĐỘNG CÁC DỊCH VỤ LOCALHOST VÀ CHROME HEADLESS ===")

  // 1. Khởi động Vite API mode trên port 5173
  apiVite = spawn("npx.cmd", ["vite", "--port", String(API_PORT)], {
    stdio: "pipe",
    shell: true,
  })

  // 2. Khởi động Vite Mock mode trên port 5174
  mockVite = spawn("npx.cmd", ["vite", "--port", String(MOCK_PORT), "--mode", "mock"], {
    stdio: "pipe",
    shell: true,
  })

  // 3. Khởi động Google Chrome Headless kèm remote debugging
  chrome = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-port=9222",
    `--user-data-dir=${process.env.TEMP}\\chrome-coach-test-${Date.now()}`,
    "--disable-gpu",
    "--no-first-run",
  ])

  // Đợi các tiến trình khởi động
  await new Promise((r) => setTimeout(r, 3500))

  const newTabRes = await fetch("http://127.0.0.1:9222/json/new?about:blank", {
    method: "PUT",
  })
  const tab = await newTabRes.json()
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((resolve) => (ws.onopen = resolve))

  let msgId = 1
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = msgId++
      const handler = (evt) => {
        const data = JSON.parse(evt.data)
        if (data.id === id) {
          ws.removeEventListener("message", handler)
          resolve(data.result)
        }
      }
      ws.addEventListener("message", handler)
      ws.send(JSON.stringify({ id, method, params }))
    })

  await send("Page.enable")
  await send("Runtime.enable")
  // Chỉ intercept các request REST API (bắt đầu bằng http.../api/...)
  await send("Fetch.enable", { patterns: [{ urlPattern: "http*://*/api/*" }] })

  let currentApiScenario = "sub_f5"
  const recordedRequests = []

  ws.addEventListener("message", async (evt) => {
    const data = JSON.parse(evt.data)
    if (data.method === "Fetch.requestPaused") {
      const { requestId, request } = data.params
      const url = new URL(request.url)
      const pathname = url.pathname
      const method = request.method

      // QUAN TRỌNG: Bỏ qua mã nguồn Vite frontend /src/api/...
      if (!pathname.startsWith("/api/")) {
        await send("Fetch.continueRequest", { requestId })
        return
      }

      recordedRequests.push({ pathname, method, url: request.url })

      const fulfillJson = (statusCode, jsonBody) => {
        return send("Fetch.fulfillRequest", {
          requestId,
          responseCode: statusCode,
          responseHeaders: [
            { name: "Content-Type", value: "application/json" },
            { name: "Access-Control-Allow-Origin", value: "*" },
          ],
          body: Buffer.from(JSON.stringify(jsonBody)).toString("base64"),
        })
      }

      // 1. Auth endpoint
      if (pathname === "/api/auth/me") {
        return fulfillJson(200, {
          id: 27,
          coachId: 27,
          name: "Nguyễn Văn Dạy Thay",
          fullName: "Nguyễn Văn Dạy Thay",
          role: "coach",
          email: "coach27@scms.com",
        })
      }

      // 2. Classes endpoint
      if (pathname === "/api/classes") {
        if (currentApiScenario === "empty_classes_list") {
          return fulfillJson(200, [])
        }
        return fulfillJson(200, [
          {
            id: 12,
            name: "Cầu lông Nâng cao K01",
            nameVi: "Cầu lông Nâng cao K01",
            coachId: 14,
            capacity: 12,
            maxCapacity: 12,
            enrolledCount: 1,
            date: "2026-11-10",
            startDate: "2026-11-10",
            startTime: "08:00",
            endTime: "09:30",
            status: "active",
          },
        ])
      }

      // 3. Catalog sessions
      if (pathname.includes("/api/sessions/catalog")) {
        if (currentApiScenario === "sessions_500") {
          return fulfillJson(500, {
            code: "INTERNAL_ERROR",
            message: "Lỗi nguồn phân công catalog",
          })
        }
        return fulfillJson(200, [
          {
            id: 141,
            classId: 12,
            coachId: 27, // Substitute coach
            status: "Scheduled",
            sessionDate: "2026-11-10",
            startTime: "08:00",
            endTime: "09:30",
            sessionNumber: 1,
          },
        ])
      }

      // 4. Sessions endpoint
      if (pathname === "/api/sessions") {
        if (currentApiScenario === "sessions_500") {
          return fulfillJson(500, {
            code: "INTERNAL_ERROR",
            message: "Lỗi nguồn phân công buổi học",
          })
        }
        return fulfillJson(200, [
          {
            id: 141,
            classId: 12,
            coachId: 27, // Substitute coach
            status: "Scheduled",
            sessionDate: "2026-11-10",
            startTime: "08:00",
            endTime: "09:30",
            sessionNumber: 1,
          },
        ])
      }

      // 5. Enrollments endpoint
      if (pathname.includes("/enrollments")) {
        return fulfillJson(200, [
          {
            memberId: 101,
            memberName: "Trần Minh Đức",
            memberCode: "MB-1101",
            status: "Active",
          },
        ])
      }

      // 6. Common ancillary endpoints
      if (
        pathname.includes("/attendances") ||
        pathname.includes("/results") ||
        pathname.includes("/training-plans") ||
        pathname.includes("/absence-notices") ||
        pathname.includes("/subjects") ||
        pathname.includes("/rooms") ||
        pathname.includes("/staff") ||
        pathname.includes("/members") ||
        pathname.includes("/packages")
      ) {
        return fulfillJson(200, [])
      }

      // Default fallback
      return fulfillJson(200, [])
    }
  })

  const evalJs = async (expr) => {
    const res = await send("Runtime.evaluate", {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    })
    return res?.result?.value
  }

  // ========================================================================
  // PHẦN 1: KIỂM THỬ VỚI FIXTURE API TRÊN LOCALHOST:5173
  // ========================================================================
  console.log("\n--- BẮT ĐẦU PHẦN 1: FIXTURE API (LOCALHOST:5173) ---")

  // Chờ tải lần đầu để nạp trang
  await send("Page.navigate", { url: `http://localhost:${API_PORT}/coach/attendance` })
  await new Promise((r) => setTimeout(r, 2000))

  // ------------------------------------------------------------------------
  // CA 1: Coach dạy thay mở đúng buổi sau F5
  // ------------------------------------------------------------------------
  currentApiScenario = "sub_f5"
  recordedRequests.length = 0

  await evalJs(`
    sessionStorage.setItem("scms_mock_role", "coach");
    sessionStorage.setItem("scms_selected_attendance_coach_id", "27");
    sessionStorage.setItem("scms_selected_attendance_class_id", "12");
    sessionStorage.setItem("scms_selected_attendance_session_id", "141");
  `)

  // F5 reload
  await send("Page.reload", { ignoreCache: true })
  await new Promise((r) => setTimeout(r, 2500))

  const ca1Title = await evalJs(`document.querySelector("h2")?.innerText || ""`)
  const ca1SessionText = await evalJs(`
    const sel = document.querySelectorAll("select")[1];
    sel ? sel.options[sel.selectedIndex]?.text : "";
  `)
  const ca1GetRosterCount = recordedRequests.filter((r) => r.pathname.includes("/enrollments") && r.method === "GET").length
  const ca1PostCount = recordedRequests.filter((r) => r.method === "POST").length

  console.log("CA 1 (Coach dạy thay sau F5):", {
    route: "/coach/attendance",
    classDisplay: ca1Title,
    sessionSelected: ca1SessionText,
    getRosterCount: ca1GetRosterCount,
    postCount: ca1PostCount,
    allRecorded: recordedRequests.map(r => `${r.method} ${r.pathname}`),
  })

  assert.match(ca1Title, /Cầu lông Nâng cao/, "Lớp thực tế phải là Cầu lông Nâng cao")
  assert.match(ca1SessionText, /Buổi 1.*Dạy thay/, "Buổi thực tế phải là Buổi 1 với nhãn Dạy thay")
  assert.equal(ca1GetRosterCount, 1, "Sau khi xác minh quyền Coach dạy thay, phải gửi đúng 1 GET roster")
  assert.equal(ca1PostCount, 0, "Không được gửi POST điểm danh nào")
  console.log("-> PASS: Ca 1 (Coach dạy thay sau F5) đạt chuẩn và assert thành công")

  // ------------------------------------------------------------------------
  // CA 2: Cặp sai (selectedSessionId = 999 không thuộc lớp 12)
  // ------------------------------------------------------------------------
  currentApiScenario = "mismatched_pair"
  recordedRequests.length = 0

  await evalJs(`
    sessionStorage.setItem("scms_mock_role", "coach");
    sessionStorage.setItem("scms_selected_attendance_coach_id", "27");
    sessionStorage.setItem("scms_selected_attendance_class_id", "12");
    sessionStorage.setItem("scms_selected_attendance_session_id", "999");
  `)

  await send("Page.reload", { ignoreCache: true })
  await new Promise((r) => setTimeout(r, 2500))

  const ca2AlertText = await evalJs(`document.querySelector('[role="alert"]')?.innerText || ""`)
  const ca2GetRosterCount = recordedRequests.filter((r) => r.pathname.includes("/enrollments") && r.method === "GET").length
  const ca2PostCount = recordedRequests.filter((r) => r.method === "POST").length

  console.log("CA 2 (Cặp sai / Buổi không tồn tại):", {
    route: "/coach/attendance",
    alertMessage: ca2AlertText,
    getRosterCount: ca2GetRosterCount,
    postCount: ca2PostCount,
  })

  assert.match(ca2AlertText, /không tồn tại|không hợp lệ/, "Phải hiển thị thông báo buổi không tồn tại/cặp sai")
  assert.equal(ca2GetRosterCount, 0, "Cặp sai phải gửi 0 GET roster")
  assert.equal(ca2PostCount, 0, "Cặp sai phải gửi 0 POST")
  console.log("-> PASS: Ca 2 (Cặp sai) đạt chuẩn và assert thành công")

  // ------------------------------------------------------------------------
  // CA 3: Nguồn phân công trả HTTP 500
  // ------------------------------------------------------------------------
  currentApiScenario = "sessions_500"
  recordedRequests.length = 0

  await evalJs(`
    sessionStorage.setItem("scms_mock_role", "coach");
    sessionStorage.setItem("scms_selected_attendance_coach_id", "27");
    sessionStorage.setItem("scms_selected_attendance_class_id", "12");
    sessionStorage.setItem("scms_selected_attendance_session_id", "141");
  `)

  await send("Page.reload", { ignoreCache: true })
  await new Promise((r) => setTimeout(r, 2500))

  const ca3AlertText = await evalJs(`document.querySelector('[role="alert"]')?.innerText || ""`)
  const ca3GetRosterCount = recordedRequests.filter((r) => r.pathname.includes("/enrollments") && r.method === "GET").length
  const ca3PostCount = recordedRequests.filter((r) => r.method === "POST").length

  console.log("CA 3 (Nguồn phân công trả HTTP 500):", {
    route: "/coach/attendance",
    alertMessage: ca3AlertText,
    getRosterCount: ca3GetRosterCount,
    postCount: ca3PostCount,
  })

  assert.match(ca3AlertText, /Lỗi nguồn phân công/, "Phải hiển thị lỗi nguồn phân công buổi học")
  assert.equal(ca3GetRosterCount, 0, "Nguồn phân công lỗi phải gửi 0 GET roster")
  assert.equal(ca3PostCount, 0, "Nguồn phân công lỗi phải gửi 0 POST")
  console.log("-> PASS: Ca 3 (Nguồn phân công HTTP 500) đạt chuẩn và assert thành công")

  // ------------------------------------------------------------------------
  // CA 4: classId không tồn tại nhưng sessionId hợp lệ trong lớp mặc định (Requirement 1)
  // ------------------------------------------------------------------------
  currentApiScenario = "invalid_class_valid_session"
  recordedRequests.length = 0

  await evalJs(`
    sessionStorage.setItem("scms_mock_role", "coach");
    sessionStorage.setItem("scms_selected_attendance_coach_id", "27");
    sessionStorage.setItem("scms_selected_attendance_class_id", "999"); // Lớp 999 không tồn tại
    sessionStorage.setItem("scms_selected_attendance_session_id", "141"); // 141 hợp lệ trong lớp mặc định 12
  `)

  await send("Page.reload", { ignoreCache: true })
  await new Promise((r) => setTimeout(r, 2500))

  const ca4Title = await evalJs(`document.querySelector("h2")?.innerText || ""`)
  const ca4AlertText = await evalJs(`document.querySelector('[role="alert"]')?.innerText || ""`)
  const ca4GetRosterCount = recordedRequests.filter((r) => r.pathname.includes("/enrollments") && r.method === "GET").length
  const ca4PostCount = recordedRequests.filter((r) => r.method === "POST").length

  console.log("CA 4 (classId không tồn tại nhưng sessionId hợp lệ trong lớp mặc định):", {
    route: "/coach/attendance",
    classDisplay: ca4Title,
    alertMessage: ca4AlertText,
    getRosterCount: ca4GetRosterCount,
    postCount: ca4PostCount,
  })

  assert.equal(ca4Title.includes("Cầu lông Nâng cao"), false, "Tuyệt đối không tự chọn lớp mặc định")
  assert.match(ca4AlertText, /Lớp học không tồn tại/, "Phải hiển thị thông báo lỗi lớp không tồn tại")
  assert.equal(ca4GetRosterCount, 0, "Lớp không tồn tại phải gửi 0 GET roster")
  assert.equal(ca4PostCount, 0, "Lớp không tồn tại phải gửi 0 POST")
  console.log("-> PASS: Ca 4 (classId không tồn tại) đạt chuẩn và assert thành công")

  // ------------------------------------------------------------------------
  // CA 7: Phân biệt classes đang tải với classes đã tải xong nhưng rỗng:
  // Khi GET /api/classes trả 200 [] và có classId đã chọn, kết thúc trạng thái
  // tải, báo lớp không tồn tại và giữ 0 GET roster, 0 POST điểm danh.
  // ------------------------------------------------------------------------
  currentApiScenario = "empty_classes_list"
  recordedRequests.length = 0

  await evalJs(`
    sessionStorage.setItem("scms_mock_role", "coach");
    sessionStorage.setItem("scms_selected_attendance_coach_id", "27");
    sessionStorage.setItem("scms_selected_attendance_class_id", "12");
    sessionStorage.setItem("scms_selected_attendance_session_id", "141");
  `)

  await send("Page.reload", { ignoreCache: true })
  await new Promise((r) => setTimeout(r, 2500))

  const ca7PulseCount = await evalJs(`document.querySelectorAll(".animate-pulse").length`)
  const ca7AlertText = await evalJs(`document.querySelector('[role="alert"]')?.innerText || ""`)
  const ca7GetRosterCount = recordedRequests.filter((r) => r.pathname.includes("/enrollments") && r.method === "GET").length
  const ca7PostCount = recordedRequests.filter((r) => r.method === "POST").length

  console.log("CA 7 (Classes trả 200 [] khi đã có classId):", {
    route: "/coach/attendance",
    pulseCount: ca7PulseCount,
    alertMessage: ca7AlertText,
    getRosterCount: ca7GetRosterCount,
    postCount: ca7PostCount,
  })

  assert.equal(ca7PulseCount, 0, "Trạng thái tải phải kết thúc hoàn toàn (không còn skeleton pulse)")
  assert.match(ca7AlertText, /Lớp học không tồn tại/, "Phải hiển thị lỗi lớp không tồn tại")
  assert.equal(ca7GetRosterCount, 0, "Danh sách lớp rỗng phải gửi 0 GET roster")
  assert.equal(ca7PostCount, 0, "Danh sách lớp rỗng phải gửi 0 POST")
  console.log("-> PASS: Ca 7 (Phân biệt classes đang tải vs rỗng) đạt chuẩn và assert thành công")

  // ========================================================================
  // PHẦN 2: KIỂM THỬ TRONG CHẾ ĐỘ MOCK TRÊN LOCALHOST:5174
  // ========================================================================
  console.log("\n--- BẮT ĐẦU PHẦN 2: CHẾ ĐỘ MOCK (LOCALHOST:5174) ---")

  // Tắt intercept API khi chạy mock
  await send("Fetch.disable")

  // ------------------------------------------------------------------------
  // CA 5: Lớp mock trống (Class 23 có 0 học viên)
  // ------------------------------------------------------------------------
  await send("Page.navigate", { url: `http://localhost:${MOCK_PORT}/login` })
  await new Promise((r) => setTimeout(r, 1200))

  await evalJs(`
    sessionStorage.setItem("scms_mock_role", "coach");
    sessionStorage.setItem("scms_mock_authenticated", "true");
    sessionStorage.setItem("scms_selected_attendance_coach_id", "1");
    sessionStorage.setItem("scms_selected_attendance_class_id", "23");
    sessionStorage.removeItem("scms_selected_attendance_session_id");
  `)

  await send("Page.navigate", { url: `http://localhost:${MOCK_PORT}/coach/attendance?classId=23` })
  await new Promise((r) => setTimeout(r, 2500))

  const ca5EmptyText = await evalJs(`document.body.innerText`)
  const ca5HasBulkButton = await evalJs(`
    Array.from(document.querySelectorAll("button")).some(b => b.innerText.includes("Điểm danh tất cả Có mặt"))
  `)

  console.log("CA 5 (Lớp mock trống - Class 23):", {
    route: "/coach/attendance",
    containsEmptyNotice: ca5EmptyText.includes("chưa có học viên nào đăng ký chính thức"),
    hasBulkButton: ca5HasBulkButton,
  })

  assert.equal(ca5EmptyText.includes("chưa có học viên nào đăng ký chính thức"), true, "Lớp trống phải hiển thị thông báo danh sách trống")
  assert.equal(ca5HasBulkButton, false, "Lớp trống không được hiển thị nút bulk")
  console.log("-> PASS: Ca 5 (Lớp mock trống) đạt chuẩn và assert thành công")

  // ------------------------------------------------------------------------
  // CA 6: Lớp có 1 người Absent và 1 người chưa điểm danh -> bulk chỉ ghi người chưa điểm danh và GIỮ NGUYÊN Absent
  // ------------------------------------------------------------------------
  await evalJs(`
    sessionStorage.setItem("scms_mock_role", "coach");
    sessionStorage.setItem("scms_mock_authenticated", "true");
    sessionStorage.setItem("scms_selected_attendance_coach_id", "1");
    sessionStorage.setItem("scms_selected_attendance_class_id", "5");
    sessionStorage.removeItem("scms_selected_attendance_session_id");
  `)

  await send("Page.navigate", { url: `http://localhost:${MOCK_PORT}/coach/attendance?classId=5` })
  await new Promise((r) => setTimeout(r, 2500))

  const initialStatuses = await evalJs(`
    Array.from(document.querySelectorAll(".min-h-\\\\[56px\\\\]")).map(row => {
      const name = row.querySelector(".text-sm.font-bold")?.innerText || "";
      const isAbsent = row.querySelector('button[aria-label="Vắng mặt"]')?.getAttribute("aria-pressed") === "true";
      const isPresent = row.querySelector('button[aria-label="Có mặt"]')?.getAttribute("aria-pressed") === "true";
      return { name, isAbsent, isPresent };
    })
  `)

  console.log("Trạng thái trước khi bulk:", initialStatuses)
  assert.equal(initialStatuses.some(s => s.name.includes("Minh Anh") && s.isAbsent), true, "Minh Anh ban đầu phải là Vắng mặt (Absent)")
  assert.equal(initialStatuses.some(s => s.name.includes("Hoàng Nam") && !s.isAbsent && !s.isPresent), true, "Hoàng Nam ban đầu phải là Chưa điểm danh (not_recorded)")

  // Nhấp nút bulk điểm danh
  const clickedBulk = await evalJs(`
    (() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Điểm danh tất cả Có mặt"));
      if (btn) { btn.click(); return true; }
      return false;
    })()
  `)
  assert.equal(clickedBulk, true, "Phải tìm thấy và nhấp được nút bulk")

  await new Promise((r) => setTimeout(r, 800))

  // Nhấp nút Xác nhận trên modal
  const confirmedModal = await evalJs(`
    (() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.trim() === "Xác nhận");
      if (btn) { btn.click(); return true; }
      return false;
    })()
  `)
  assert.equal(confirmedModal, true, "Phải tìm thấy và nhấp nút Xác nhận trên modal")

  await new Promise((r) => setTimeout(r, 1500))

  const finalStatuses = await evalJs(`
    Array.from(document.querySelectorAll(".min-h-\\\\[56px\\\\]")).map(row => {
      const name = row.querySelector(".text-sm.font-bold")?.innerText || "";
      const isAbsent = row.querySelector('button[aria-label="Vắng mặt"]')?.getAttribute("aria-pressed") === "true";
      const isPresent = row.querySelector('button[aria-label="Có mặt"]')?.getAttribute("aria-pressed") === "true";
      return { name, isAbsent, isPresent };
    })
  `)

  console.log("Trạng thái sau khi bulk:", finalStatuses)

  // Assert: Minh Anh GIỮ NGUYÊN Vắng mặt (Absent)
  const minhAnh = finalStatuses.find(s => s.name.includes("Minh Anh"))
  assert.equal(minhAnh?.isAbsent, true, "Học viên Minh Anh (Absent) PHẢI GIỮ NGUYÊN trạng thái Vắng mặt")

  // Assert: Hoàng Nam đã chuyển thành Có mặt (Present)
  const hoangNam = finalStatuses.find(s => s.name.includes("Hoàng Nam"))
  assert.equal(hoangNam?.isPresent, true, "Học viên Hoàng Nam (chưa điểm danh) PHẢI ĐƯỢC ĐIỂM DANH Có mặt")

  console.log("-> PASS: Ca 6 (Bulk hợp lệ giữ nguyên Absent) đạt chuẩn và assert thành công")

  // ------------------------------------------------------------------------
  // CA 8: Khi lớp mock không hợp lệ (classId=999), dùng giao diện thật:
  // Xác nhận thông báo lỗi lớp và hoàn toàn không có form, ô nhập hoặc nút điểm danh nhanh.
  // Phạm vi kiểm thử: Kiểm tra qua giao diện thật (UI real DOM).
  // ------------------------------------------------------------------------
  await evalJs(`
    sessionStorage.setItem("scms_mock_role", "coach");
    sessionStorage.setItem("scms_mock_authenticated", "true");
    sessionStorage.setItem("scms_selected_attendance_coach_id", "1");
    sessionStorage.setItem("scms_selected_attendance_class_id", "999");
    sessionStorage.removeItem("scms_selected_attendance_session_id");
  `)

  await send("Page.navigate", { url: `http://localhost:${MOCK_PORT}/coach/attendance?classId=999` })
  await new Promise((r) => setTimeout(r, 2500))

  // 1. Xác nhận thông báo lỗi lớp trên giao diện thật
  const ca8Alert = await evalJs(`document.querySelector('[role="alert"]')?.innerText || ""`)

  // 2. Xác nhận không có ô nhập mã học viên hay QR trên DOM
  const hasQuickInput = await evalJs(`Boolean(document.querySelector('input[placeholder*="Quét QR"], input[placeholder*="MB-1002"], input[aria-label*="Mã hội viên"]'))`)

  // 3. Xác nhận không có nút "Điểm danh nhanh" trên DOM
  const hasQuickBtn = await evalJs(`Array.from(document.querySelectorAll("button")).some(b => b.innerText.includes("Điểm danh nhanh"))`)

  console.log("CA 8 (Lớp mock không hợp lệ qua giao diện thật classId=999):", {
    route: "/coach/attendance?classId=999",
    alertMessage: ca8Alert,
    hasQuickInput,
    hasQuickBtn,
    verifiedScope: "Giao diện thật (UI DOM: thông báo lỗi lớp, không có form/input/nút điểm danh nhanh)",
  })

  assert.match(ca8Alert, /Lớp học không tồn tại/i, "Giao diện thật phải hiển thị thông báo lớp không tồn tại hoặc không có quyền")
  assert.equal(hasQuickInput, false, "Giao diện thật TUYỆT ĐỐI KHÔNG CÓ ô nhập điểm danh nhanh")
  assert.equal(hasQuickBtn, false, "Giao diện thật TUYỆT ĐỐI KHÔNG CÓ nút điểm danh nhanh")
  console.log("-> PASS: Ca 8 (Kiểm tra qua giao diện thật: thông báo lỗi lớp & không có form/nút điểm danh nhanh) đạt chuẩn và assert thành công")

  console.log("\n=========================================================================")
  console.log("TẤT CẢ 8 CA TRÊN TRÌNH DUYỆT LOCALHOST ĐÃ HOÀN TẤT VÀ PASS 100%")
  console.log("=========================================================================")

  cleanup()
  process.exit(0)
} catch (err) {
  console.error("\n[ASSERTION ERROR TRÌNH DUYỆT]:", err)
  cleanup()
  process.exit(1)
}
