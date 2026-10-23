import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import net from 'node:net'
import url from 'node:url'
import { createServer } from 'vite'
import {
  createNormalClassWithSessions,
  generateRecurringSessions,
  previewRecurringSessions,
} from '../src/api/managerApi.js'
import {
  buildNormalClassWithSessionsRequest,
  isNormalClassApiCreationBlocked,
  NORMAL_CLASS_API_BLOCKED_MESSAGE,
  toBackendDaysOfWeek,
} from '../src/api/normalClassCreation.js'

const browserOnly = process.argv.includes('--browser-only')

async function runUnitSuite() {
  const originalFetch = globalThis.fetch
  const requests = []
  let mockSessionCount = 12
  let postResponseMode = 'success' // 'success' | 'room_conflict_409' | 'coach_conflict_409' | 'idempotency_conflict_409' | 'server_500'
  let failPrimarySessionsEndpoint = false

  globalThis.fetch = async (reqUrl, options = {}) => {
    const requestUrl = String(reqUrl)
    const parsedBody = options.body ? JSON.parse(options.body) : null
    requests.push({ url: requestUrl, options, body: parsedBody })

    if (requestUrl.includes('/api/classes/normal-with-sessions')) {
      if (postResponseMode === 'room_conflict_409') {
        return new Response(
          JSON.stringify({
            code: 'ROOM_CONFLICT',
            message: 'Sân tập/Phòng học này đã có lịch đặt trong khung giờ đã chọn.',
          }),
          {
            status: 409,
            headers: { 'content-type': 'application/json' },
          },
        )
      }
      if (postResponseMode === 'coach_conflict_409') {
        return new Response(
          JSON.stringify({
            code: 'COACH_CONFLICT',
            message: 'Huấn luyện viên đã có lịch dạy trong khung giờ này.',
          }),
          {
            status: 409,
            headers: { 'content-type': 'application/json' },
          },
        )
      }
      if (postResponseMode === 'idempotency_conflict_409') {
        return new Response(
          JSON.stringify({
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Cùng requestId nhưng nội dung lớp học khác với yêu cầu trước.',
          }),
          {
            status: 409,
            headers: { 'content-type': 'application/json' },
          },
        )
      }
      if (postResponseMode === 'server_500') {
        return new Response(
          JSON.stringify({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Lỗi máy chủ tạm thời khi tạo lớp học.',
          }),
          {
            status: 500,
            headers: { 'content-type': 'application/json' },
          },
        )
      }
      return new Response(
        JSON.stringify({
          id: 17,
          name: parsedBody?.sportsClass?.name ?? 'Tennis Normal K01',
          subjectId: parsedBody?.sportsClass?.subjectId ?? 1,
          coachId: parsedBody?.sportsClass?.coachId ?? 9,
          maxCapacity: parsedBody?.sportsClass?.maxCapacity ?? 15,
          startDate: parsedBody?.sportsClass?.startDate ?? '2026-11-02',
          endDate: '2026-11-27',
          status: 'Open',
          classType: 'Normal',
          totalSessions: 12,
          tuitionFee: 650000,
        }),
        {
          status: 201,
          headers: { 'content-type': 'application/json' },
        },
      )
    }

    if (requestUrl.includes('/api/sessions/catalog/')) {
      const sessions = Array.from({ length: mockSessionCount }, (_, index) => ({
        id: index + 101,
        classId: 17,
        sessionDate: `2026-11-${String(index + 2).padStart(2, '0')}`,
        startTime: '06:00',
        endTime: '07:30',
        status: 'Scheduled',
      }))
      return new Response(JSON.stringify(sessions), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    if (requestUrl.includes('/api/sessions?')) {
      if (failPrimarySessionsEndpoint) {
        return new Response(JSON.stringify({ message: 'Internal Server Error' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        })
      }
      const sessions = Array.from({ length: mockSessionCount }, (_, index) => ({
        id: index + 1,
        classId: 17,
        sessionDate: `2026-11-${String(index + 2).padStart(2, '0')}`,
        startTime: '06:00',
        endTime: '07:30',
        status: 'Scheduled',
      }))
      return new Response(JSON.stringify(sessions), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const body = requestUrl.includes('preview-recurring')
      ? { totalSessions: 12, sessions: [], skippedHolidays: [] }
      : Array.from({ length: 12 }, (_, index) => ({ id: index + 1, status: 'Scheduled' }))
    return new Response(JSON.stringify(body), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    // 1. Draft remains blocked in API mode while Open atomic creation is unlocked
    assert.equal(isNormalClassApiCreationBlocked(true, 'Draft'), true, 'Draft remains blocked in API mode')
    assert.equal(isNormalClassApiCreationBlocked(true, 'Open'), false, 'Open Normal creation is unlocked in API mode')
    assert.equal(isNormalClassApiCreationBlocked(true), false, 'Default targetStatus Open is unlocked in API mode')
    assert.equal(isNormalClassApiCreationBlocked(false, 'Draft'), false, 'Mock mode allows Draft')
    assert.match(NORMAL_CLASS_API_BLOCKED_MESSAGE, /Backend.*Draft.*12 session/i)

    // 2. Weekday mapping to Java numbering (Monday=1 .. Sunday=7)
    assert.deepEqual(toBackendDaysOfWeek([1]), [1], 'Monday stays 1')
    assert.deepEqual(toBackendDaysOfWeek([6]), [6], 'Saturday stays 6')
    assert.deepEqual(toBackendDaysOfWeek([0]), [7], 'Java Sunday is 7')
    assert.deepEqual(toBackendDaysOfWeek([null, '1']), [null, '1'], 'Other values remain unchanged')
    assert.deepEqual(toBackendDaysOfWeek([1, 6, 0]), [1, 6, 7])

    const schedule = {
      classId: 17,
      roomId: 8,
      startDate: '2026-11-02',
      daysOfWeek: [1, 6, 0],
      startTime: '06:00',
      endTime: '07:30',
    }
    await previewRecurringSessions(schedule)
    assert.deepEqual(requests.at(-1).body.daysOfWeek, [1, 6, 7])
    assert.equal(requests.at(-1).options.method, 'POST')
    assert.match(requests.at(-1).url, /preview-recurring$/)

    await generateRecurringSessions(schedule)
    assert.deepEqual(requests.at(-1).body.daysOfWeek, [1, 6, 7])
    assert.equal(requests.at(-1).options.method, 'POST')
    assert.match(requests.at(-1).url, /\/api\/sessions\/generate$/)

    // 3. Idempotent requestId reuse on retry vs regeneration on pre-submit payload change
    const stateRef = { current: null }
    const baseInput = {
      name: 'Tennis Normal K01',
      subjectId: 1,
      coachId: 9,
      capacity: 15,
      startDate: '2026-11-02',
      roomId: 1,
      selectedDays: [1, 3, 0],
      startTime: '06:00',
      endTime: '07:30',
    }

    const reqAttempt1 = buildNormalClassWithSessionsRequest(baseInput, { stateRef })
    const reqAttempt2Same = buildNormalClassWithSessionsRequest({ ...baseInput }, { stateRef })
    assert.match(reqAttempt1.requestId, /^[0-9a-f-]{36}$/i, 'requestId must be a UUID')
    assert.equal(reqAttempt2Same.requestId, reqAttempt1.requestId, 'Retry with identical payload reuses same requestId')
    assert.deepEqual(reqAttempt1.daysOfWeek, [1, 3, 7], 'Sunday 0 converts to 7 in NormalClassCreationRequest')
    assert.equal(reqAttempt1.sportsClass.classType, 'Normal')
    assert.equal(reqAttempt1.sportsClass.totalSessions, 12)
    assert.equal(reqAttempt1.roomId, 1)

    const reqAttempt3Changed = buildNormalClassWithSessionsRequest(
      { ...baseInput, startTime: '07:30', endTime: '09:00' },
      { stateRef },
    )
    assert.notEqual(
      reqAttempt3Changed.requestId,
      reqAttempt1.requestId,
      'Changing payload fields before attempt lock generates a fresh requestId',
    )

    // 4. Atomic POST /api/classes/normal-with-sessions + 12-session read-back verification
    requests.length = 0
    const atomicStateRef = { current: null }
    const createdClass = await createNormalClassWithSessions(
      baseInput,
      { subjects: [{ id: 1, name: 'Tennis' }], coaches: [{ id: 9, name: 'Coach 9' }] },
      { idempotencyStateRef: atomicStateRef },
    )
    assert.equal(createdClass.id, 17)
    assert.equal(createdClass.verifiedSessionCount, 12)
    assert.equal(requests.length, 2, '1 POST /api/classes/normal-with-sessions + 1 GET /api/sessions?classId=17')
    assert.match(requests[0].url, /\/api\/classes\/normal-with-sessions$/)
    assert.equal(requests[0].options.method, 'POST')
    assert.deepEqual(requests[0].body.daysOfWeek, [1, 3, 7])
    assert.equal(requests[0].body.sportsClass.name, 'Tennis Normal K01')
    assert.equal(requests[0].body.sportsClass.totalSessions, 12)
    assert.match(requests[1].url, /\/api\/sessions\?classId=17$/)
    assert.equal(atomicStateRef.current, null, 'State ref cleared after successful creation and verification')

    // 5. Fallback to GET /api/sessions/catalog/{classId} when primary /api/sessions fails
    failPrimarySessionsEndpoint = true
    const fallbackCreated = await createNormalClassWithSessions(baseInput, {})
    assert.equal(fallbackCreated.verifiedSessionCount, 12)
    assert.match(requests.at(-1).url, /\/api\/sessions\/catalog\/17$/)
    failPrimarySessionsEndpoint = false

    // 6. Fail-closed when read-back returns fewer than 12 valid sessions & keep requestId stable for reconciliation
    mockSessionCount = 11
    const incompleteStateRef = { current: null }
    await assert.rejects(
      () => createNormalClassWithSessions(baseInput, {}, { idempotencyStateRef: incompleteStateRef }),
      (err) => {
        assert.equal(err.code, 'INCOMPLETE_NORMAL_CLASS_SESSIONS')
        assert.equal(err.actualCount, 11)
        assert.equal(err.expectedCount, 12)
        assert.match(err.message, /11\/12/)
        return true
      },
      'Must reject when read-back does not confirm 12 valid sessions',
    )
    const firstIncompleteRequestId = requests.at(-2).body.requestId
    assert.equal(
      incompleteStateRef.current?.requestId,
      firstIncompleteRequestId,
      'Uncertain read-back outcome must keep requestId stable in stateRef for safe reconciliation',
    )
    mockSessionCount = 12

    // 7. Non-idempotency 409 (ROOM_CONFLICT / COACH_CONFLICT) MUST preserve requestId across retries
    requests.length = 0
    postResponseMode = 'room_conflict_409'
    const roomConflictStateRef = { current: null }
    await assert.rejects(
      () => createNormalClassWithSessions(baseInput, {}, { idempotencyStateRef: roomConflictStateRef }),
      (err) => {
        assert.equal(err.status, 409)
        assert.equal(err.code, 'ROOM_CONFLICT')
        return true
      },
    )
    assert.equal(requests.length, 1, 'Single 409 ROOM_CONFLICT attempt sends exactly 1 POST')
    const roomConflictRequestId = requests.at(-1).body.requestId
    assert.ok(roomConflictStateRef.current, '409 room/coach conflict must NOT clear idempotencyStateRef')
    assert.equal(roomConflictStateRef.current.requestId, roomConflictRequestId)
    assert.equal(roomConflictStateRef.current.idempotencyConflict, false)

    // Retry with same payload after 409 COACH_CONFLICT / ROOM_CONFLICT reuses exact same requestId
    postResponseMode = 'coach_conflict_409'
    await assert.rejects(
      () => createNormalClassWithSessions({ ...baseInput }, {}, { idempotencyStateRef: roomConflictStateRef }),
      (err) => err.status === 409 && err.code === 'COACH_CONFLICT',
    )
    assert.equal(requests.length, 2, 'Retry sends exactly 1 additional POST')
    assert.equal(
      requests.at(-1).body.requestId,
      roomConflictRequestId,
      'Retrying same payload after 409 room/coach conflict must keep the same requestId',
    )

    // Even if payload is adjusted after non-idempotency 409 or uncertain 500, requestId stays stable until IDEMPOTENCY_CONFLICT is confirmed
    const adjustedAfterRoomConflict = buildNormalClassWithSessionsRequest(
      { ...baseInput, roomId: 2 },
      { stateRef: roomConflictStateRef },
    )
    assert.equal(
      adjustedAfterRoomConflict.requestId,
      roomConflictRequestId,
      'Non-idempotency 409 keeps requestId stable until IDEMPOTENCY_CONFLICT is confirmed',
    )

    // 8. Uncertain server 500 outcome preserves requestId across retries
    postResponseMode = 'server_500'
    const uncertain500StateRef = { current: null }
    await assert.rejects(
      () => createNormalClassWithSessions(baseInput, {}, { idempotencyStateRef: uncertain500StateRef }),
      (err) => err.status === 500,
    )
    const uncertainRequestId = requests.at(-1).body.requestId
    assert.equal(uncertain500StateRef.current?.requestId, uncertainRequestId)
    postResponseMode = 'success'
    const recoveredClass = await createNormalClassWithSessions(
      baseInput,
      {},
      { idempotencyStateRef: uncertain500StateRef },
    )
    assert.equal(
      requests.at(-2).body.requestId,
      uncertainRequestId,
      'Retry after 500 reuses exact same requestId for safe reconciliation',
    )
    assert.equal(recoveredClass.id, 17)
    assert.equal(uncertain500StateRef.current, null)

    // 9. 409 IDEMPOTENCY_CONFLICT: halts without auto-sending a new request; keeps requestId on same-payload retry; rotates ONLY when payload changes
    requests.length = 0
    postResponseMode = 'idempotency_conflict_409'
    const idemStateRef = { current: null }

    // 9a. Initial attempt receives 409 IDEMPOTENCY_CONFLICT and halts immediately (exactly 1 POST, 0 auto-retries)
    await assert.rejects(
      () => createNormalClassWithSessions(baseInput, {}, { idempotencyStateRef: idemStateRef }),
      (err) => {
        assert.equal(err.code, 'IDEMPOTENCY_CONFLICT')
        assert.equal(err.status, 409)
        return true
      },
    )
    assert.equal(
      requests.length,
      1,
      'IDEMPOTENCY_CONFLICT must halt immediately after 1 POST and never auto-send a new request',
    )
    const initialIdemRequestId = requests.at(-1).body.requestId
    assert.ok(idemStateRef.current, 'IDEMPOTENCY_CONFLICT with unchanged payload keeps stateRef tracked')
    assert.equal(idemStateRef.current.requestId, initialIdemRequestId)
    assert.equal(idemStateRef.current.idempotencyConflict, true)

    // 9b. Retry with IDENTICAL payload after IDEMPOTENCY_CONFLICT must NOT replace requestId
    await assert.rejects(
      () => createNormalClassWithSessions({ ...baseInput }, {}, { idempotencyStateRef: idemStateRef }),
      (err) => err.code === 'IDEMPOTENCY_CONFLICT' && err.status === 409,
    )
    assert.equal(requests.length, 2, 'Explicit retry sends 1 POST with the existing requestId')
    assert.equal(
      requests.at(-1).body.requestId,
      initialIdemRequestId,
      'Retrying identical payload after IDEMPOTENCY_CONFLICT must keep the same requestId',
    )

    // 9c. Once payload changes after confirmed IDEMPOTENCY_CONFLICT, a new requestId is generated and succeeds
    postResponseMode = 'success'
    const updatedPayload = { ...baseInput, name: 'Tennis Normal K02 - Khung giờ mới', startTime: '07:30', endTime: '09:00' }
    const createdAfterPayloadChange = await createNormalClassWithSessions(
      updatedPayload,
      {},
      { idempotencyStateRef: idemStateRef },
    )
    const rotatedRequestId = requests.at(-2).body.requestId
    assert.notEqual(
      rotatedRequestId,
      initialIdemRequestId,
      'Changing payload after confirmed IDEMPOTENCY_CONFLICT must rotate to a new requestId',
    )
    assert.equal(createdAfterPayloadChange.id, 17)
    assert.equal(idemStateRef.current, null)

    // 9d. If stateRef had an older fingerprint and sending a changed payload with that locked requestId hits IDEMPOTENCY_CONFLICT, stateRef is cleared without auto-sending a second POST
    requests.length = 0
    postResponseMode = 'idempotency_conflict_409'
    const staleConflictStateRef = {
      current: {
        fingerprint: 'stale-fingerprint-from-previous-payload',
        requestId: '5c337454-c07a-45a9-8aa7-e0c26e3ff467',
        idempotencyConflict: false,
        attemptLocked: true,
      },
    }
    await assert.rejects(
      () => createNormalClassWithSessions(baseInput, {}, { idempotencyStateRef: staleConflictStateRef }),
      (err) => err.code === 'IDEMPOTENCY_CONFLICT' && err.status === 409,
    )
    assert.equal(requests.length, 1, 'Must NOT auto-send a second POST upon receiving IDEMPOTENCY_CONFLICT')
    assert.equal(
      staleConflictStateRef.current,
      null,
      'When IDEMPOTENCY_CONFLICT is returned for an already-changed payload, stateRef is cleared so next explicit submit gets a fresh ID',
    )
    postResponseMode = 'success'

    // 10. Verify NewClassModal source integration and retry button behavior
    const modalSource = await readFile(new URL('../src/components/modals/NewClassModal.jsx', import.meta.url), 'utf8')
    assert.match(modalSource, /isNormalClassApiCreationBlocked\(apiEnabled, "Draft"\)/)
    assert.match(modalSource, /isNormalClassApiCreationBlocked\(apiEnabled\)/)
    assert.match(modalSource, /selectedSubject\.outdoor === null/)
    assert.match(modalSource, /idempotencyStateRef:\s*normalRequestIdStateRef/)

    console.log('PASS: FE-10 unit tests: atomic Normal class creation preserves requestId on 409 schedule conflict, uncertain outcomes, and same-payload retries; rotates requestId only on confirmed IDEMPOTENCY_CONFLICT with changed payload.')
  } finally {
    globalThis.fetch = originalFetch
  }
}

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
    const id = this.id++
    return new Promise((resolve, reject) => {
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
    await new Promise((r) => setTimeout(r, 500))
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
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-fe10-test-'))

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
    } catch {
      // wait for Chrome CDP
    }
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

async function runBrowserSuite() {
  const projectRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..')
  process.chdir(projectRoot)

  console.log('\n================================================================')
  console.log('  RUNNING FE-10 MANAGER NORMAL CLASS BROWSER VERIFICATION')
  console.log('================================================================')

  const failClosedPort = await getFreePort()
  const loopbackTarget = `http://127.0.0.1:${failClosedPort}`
  const vitePort = await getFreePort()

  const viteServer = await createServer({
    server: {
      port: vitePort,
      proxy: {
        '/api': {
          target: loopbackTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    mode: 'development',
    define: {
      'import.meta.env.VITE_TEST_HARNESS': JSON.stringify('true'),
      'import.meta.env.VITE_API_ENABLED': JSON.stringify('true'),
      'import.meta.env.VITE_API_PROXY_TARGET': JSON.stringify(loopbackTarget),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(''),
    },
  })
  await viteServer.listen()

  const proxyConfig = viteServer.config.server?.proxy?.['/api']
  const actualProxyTarget = typeof proxyConfig === 'string' ? proxyConfig : proxyConfig?.target || ''
  assert.ok(!/onrender\.com/i.test(actualProxyTarget), 'Browser test proxy must NOT point to Render')
  assert.ok(/^https?:\/\/(127\.0\.0\.1|localhost)/.test(actualProxyTarget), 'Browser test proxy must use loopback')

  const { client, proc, tempDir } = await spawnIsolatedChrome()

  try {
    await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        sessionStorage.setItem('scms_mock_authenticated', 'true');
        sessionStorage.setItem('scms_mock_role', 'manager');
        window.confirm = () => true;
        window.alert = () => {};

        window.__fe10Calls = {
          normalCreatePosts: [],
          sessionReadBacks: [],
          allPosts: [],
        };
        window.__fe10MockState = {
          subjectOutdoor: false,
          postMode: 'room_conflict_409', // 'room_conflict_409' | 'server_500' | 'idempotency_conflict_409' | 'success'
          sessionCount: 12,
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
            window.__fe10Calls.allPosts.push({ url: urlStr, body: parsedBody });
          }

          if (urlStr.includes('/api/auth/me') || urlStr.includes('/api/auth/login')) {
            return new Response(JSON.stringify({
              userId: 1,
              email: 'manager@scms.com',
              fullName: 'Nguyễn Quản Lý',
              role: 'Manager',
              authorities: ['MANAGE_CLASSES', 'MANAGE_SUBJECTS', 'MANAGE_ROOMS', 'VIEW_REPORTS']
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          if (urlStr.includes('/api/subjects') && method === 'GET') {
            return new Response(JSON.stringify([
              {
                id: 1,
                name: 'Cầu lông',
                description: 'Bộ môn cầu lông tiêu chuẩn',
                normalPrice: 650000,
                advancedPrice: 1200000,
                status: 'Active',
                outdoor: window.__fe10MockState.subjectOutdoor,
              }
            ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          if (urlStr.includes('/api/rooms') && method === 'GET') {
            return new Response(JSON.stringify([
              {
                id: 1,
                name: 'Sân Cầu Lông 1',
                location: 'Khu A',
                capacity: 15,
                status: 'Available',
                facilityType: 'BadmintonCourt',
                outdoor: false,
              }
            ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          if ((urlStr.includes('/api/staff') || urlStr.includes('/api/coaches')) && method === 'GET') {
            return new Response(JSON.stringify([
              {
                id: 2,
                name: 'Trần Thị Hương',
                fullName: 'Trần Thị Hương',
                email: 'huong@scms.com',
                phone: '0912345678',
                role: 'Coach',
                status: 'Active',
                specialization: 'Cầu lông',
                specializations: ['Cầu lông'],
              }
            ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          if (urlStr.includes('/api/classes/normal-with-sessions') && method === 'POST') {
            window.__fe10Calls.normalCreatePosts.push({ url: urlStr, body: parsedBody });
            const mode = window.__fe10MockState.postMode;
            if (mode === 'room_conflict_409') {
              return new Response(JSON.stringify({
                code: 'ROOM_CONFLICT',
                message: 'Sân tập đã có lịch đặt trong khung giờ đã chọn.'
              }), { status: 409, headers: { 'Content-Type': 'application/json' } });
            }
            if (mode === 'server_500') {
              return new Response(JSON.stringify({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Phản hồi máy chủ chưa rõ trạng thái tạo lớp.'
              }), { status: 500, headers: { 'Content-Type': 'application/json' } });
            }
            if (mode === 'idempotency_conflict_409') {
              return new Response(JSON.stringify({
                code: 'IDEMPOTENCY_CONFLICT',
                message: 'Cùng requestId nhưng nội dung lớp học khác với yêu cầu trước.'
              }), { status: 409, headers: { 'Content-Type': 'application/json' } });
            }
            return new Response(JSON.stringify({
              id: 88,
              name: parsedBody?.sportsClass?.name || 'Cầu lông Normal K01',
              subjectId: parsedBody?.sportsClass?.subjectId || 1,
              coachId: parsedBody?.sportsClass?.coachId || 2,
              maxCapacity: parsedBody?.sportsClass?.maxCapacity || 8,
              startDate: parsedBody?.sportsClass?.startDate || '2026-11-02',
              endDate: '2026-11-27',
              status: 'Open',
              classType: 'Normal',
              totalSessions: 12,
              tuitionFee: 650000,
            }), { status: 201, headers: { 'Content-Type': 'application/json' } });
          }

          if (urlStr.includes('/api/sessions') && method === 'GET') {
            window.__fe10Calls.sessionReadBacks.push({ url: urlStr });
            if (urlStr.includes('classId=88') || urlStr.includes('/catalog/88')) {
              const list = Array.from({ length: window.__fe10MockState.sessionCount }, (_, i) => ({
                id: 500 + i + 1,
                classId: 88,
                sessionDate: '2026-11-' + String(i + 2).padStart(2, '0'),
                startTime: '06:00',
                endTime: '07:30',
                status: 'Scheduled',
              }));
              return new Response(JSON.stringify(list), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }
            return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          if (urlStr.includes('/api/classes') && method === 'GET') {
            return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          if (urlStr.includes('/api/reports/dashboard') && method === 'GET') {
            return new Response(JSON.stringify({
              totalUsers: 10,
              totalMembers: 5,
              totalClasses: 1,
              totalPackages: 2,
              totalRevenue: 1000000,
              totalInvoices: 2,
              activeSubscriptions: 2,
              todaySessions: 0,
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }

          if (urlStr.includes('/api/')) {
            return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          return origFetch(input, init);
        };
      `,
    })

    const clickCreateClassOpenButton = `
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent.includes('Tạo lớp học')
        );
        if (!btn) return false;
        btn.click();
        return true;
      })()
    `

    const setClassNameInput = (newName) => `
      (() => {
        const input = document.querySelector('#new-class-name');
        if (!input) return false;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, ${JSON.stringify(newName)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return input.value === ${JSON.stringify(newName)};
      })()
    `

    const clickSubmitModalButton = `
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent.includes('Tạo & mở đăng ký')
        );
        if (!btn || btn.disabled) return false;
        btn.click();
        return true;
      })()
    `

    // Scenario 1: 409 ROOM_CONFLICT -> 500 uncertain -> 201 success + 12-session read-back keeps same requestId
    await client.navigate(`http://localhost:${vitePort}/manager/classes`)
    await client.waitFor(`Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Tạo lớp học'))`, 10000)
    const opened = await client.eval(clickCreateClassOpenButton)
    assert.equal(opened, true, 'Manager must be able to click Tạo lớp học button')
    await client.waitFor(`Boolean(document.querySelector('#new-class-name'))`)

    // Verify Draft button is disabled in API mode
    const isDraftDisabled = await client.eval(`
      (() => {
        const draftBtn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent.includes('Lưu nháp')
        );
        return Boolean(draftBtn && draftBtn.disabled);
      })()
    `)
    assert.equal(isDraftDisabled, true, 'Lưu nháp button must be disabled in API mode')

    await client.eval(setClassNameInput('Cầu lông Normal K01'))

    // Submit 1: 409 ROOM_CONFLICT
    await client.eval(clickSubmitModalButton)
    await client.waitFor(`window.__fe10Calls.normalCreatePosts.length === 1`)
    await client.waitFor(`document.body.innerText.includes('Sân tập đã có lịch đặt')`)
    const firstPost = await client.eval(`window.__fe10Calls.normalCreatePosts[0]`)
    assert.ok(firstPost.body.requestId, 'First POST must include a UUID requestId')
    assert.equal(firstPost.body.sportsClass.name, 'Cầu lông Normal K01')
    assert.equal(firstPost.body.sportsClass.totalSessions, 12)
    assert.deepEqual(firstPost.body.daysOfWeek, [1, 3, 5])

    // Submit 2 (Retry after 409 ROOM_CONFLICT, server returns 500 uncertain response)
    await client.eval(`window.__fe10MockState.postMode = 'server_500'`)
    await client.waitFor(`!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Đang xử lý'))`)
    await client.eval(clickSubmitModalButton)
    await client.waitFor(`window.__fe10Calls.normalCreatePosts.length === 2`)
    const secondPost = await client.eval(`window.__fe10Calls.normalCreatePosts[1]`)
    assert.equal(
      secondPost.body.requestId,
      firstPost.body.requestId,
      'Retry after 409 ROOM_CONFLICT must preserve the exact same requestId',
    )

    // Submit 3 (Retry after 500 uncertain response, server returns 201 + 12 sessions)
    await client.eval(`window.__fe10MockState.postMode = 'success'`)
    await client.waitFor(`!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Đang xử lý'))`)
    await client.eval(clickSubmitModalButton)
    await client.waitFor(`window.__fe10Calls.normalCreatePosts.length === 3`)
    await client.waitFor(`window.__fe10Calls.sessionReadBacks.some(c => c.url.includes('classId=88'))`)
    await client.waitFor(`document.body.innerText.includes('Đã tạo lớp Normal và sinh đủ 12 buổi theo API.')`)
    await client.waitFor(`!document.querySelector('#new-class-name')`)

    const thirdPost = await client.eval(`window.__fe10Calls.normalCreatePosts[2]`)
    assert.equal(
      thirdPost.body.requestId,
      firstPost.body.requestId,
      'Retry after uncertain 500 response must preserve the exact same requestId and complete 12-session read-back',
    )
    console.log('[FE10-BROWSER-01] PASS: Form sends 1 POST per submit, keeps same requestId across 409 conflict & 500 uncertain retries, verifies 12 sessions, and shows success toast.')

    // Scenario 2: IDEMPOTENCY_CONFLICT does NOT auto-send a second POST, keeps requestId on same-payload retry, and rotates after payload change
    await client.eval(`
      window.__fe10Calls.normalCreatePosts = [];
      window.__fe10Calls.sessionReadBacks = [];
      window.__fe10MockState.postMode = 'idempotency_conflict_409';
    `)
    await client.navigate(`http://localhost:${vitePort}/manager/classes`)
    await client.waitFor(`Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Tạo lớp học'))`, 10000)
    await client.eval(`window.__fe10Calls.normalCreatePosts = []; window.__fe10Calls.sessionReadBacks = []; window.__fe10MockState.postMode = 'idempotency_conflict_409';`)
    await client.eval(clickCreateClassOpenButton)
    await client.waitFor(`Boolean(document.querySelector('#new-class-name'))`)
    await client.eval(setClassNameInput('Cầu lông Normal K02'))
    await client.eval(clickSubmitModalButton)
    await client.waitFor(`window.__fe10Calls.normalCreatePosts.length === 1`)
    await new Promise((r) => setTimeout(r, 350))

    const idemPostCountAfterFirst = await client.eval(`window.__fe10Calls.normalCreatePosts.length`)
    assert.equal(
      idemPostCountAfterFirst,
      1,
      'IDEMPOTENCY_CONFLICT must send exactly 1 POST and never auto-send a second POST',
    )
    const idemFirstReqId = await client.eval(`window.__fe10Calls.normalCreatePosts[0].body.requestId`)

    // Retry with same payload keeps same requestId
    await client.waitFor(`!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Đang xử lý'))`)
    await client.eval(clickSubmitModalButton)
    await client.waitFor(`window.__fe10Calls.normalCreatePosts.length === 2`)
    const idemSecondReqId = await client.eval(`window.__fe10Calls.normalCreatePosts[1].body.requestId`)
    assert.equal(
      idemSecondReqId,
      idemFirstReqId,
      'Retrying same payload in modal after IDEMPOTENCY_CONFLICT keeps the same requestId',
    )

    // Change class name in modal after confirmed IDEMPOTENCY_CONFLICT -> rotates requestId and succeeds
    await client.eval(`window.__fe10MockState.postMode = 'success'`)
    await client.eval(setClassNameInput('Cầu lông Normal K02 - Đã đổi tên'))
    await client.eval(clickSubmitModalButton)
    await client.waitFor(`window.__fe10Calls.normalCreatePosts.length === 3`)
    await client.waitFor(`!document.querySelector('#new-class-name')`)
    const idemThirdReqId = await client.eval(`window.__fe10Calls.normalCreatePosts[2].body.requestId`)
    assert.notEqual(
      idemThirdReqId,
      idemFirstReqId,
      'Changing form payload after confirmed IDEMPOTENCY_CONFLICT rotates to a new requestId',
    )
    console.log('[FE10-BROWSER-02] PASS: IDEMPOTENCY_CONFLICT never auto-sends a second POST, preserves requestId on same-payload retry, and rotates requestId only after form payload changes.')

    // Scenario 3: Subject with outdoor: null is blocked before POST (0 POST calls)
    await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.__fe10MockState.subjectOutdoor = null;
        window.__fe10MockState.postMode = 'success';
      `,
    })
    await client.navigate(`http://localhost:${vitePort}/manager/classes`)
    await client.waitFor(`Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Tạo lớp học'))`, 10000)
    await client.eval(`
      window.__fe10Calls.normalCreatePosts = [];
      window.__fe10MockState.subjectOutdoor = null;
    `)
    await client.navigate(`http://localhost:${vitePort}/manager/classes`)
    await client.waitFor(`Array.from(document.querySelectorAll('button')).some(b => b.textContent.includes('Tạo lớp học'))`, 10000)
    await client.eval(`window.__fe10Calls.normalCreatePosts = []; window.__fe10Calls.sessionReadBacks = []; window.__fe10MockState.postMode = 'idempotency_conflict_409';`)
    await client.eval(clickCreateClassOpenButton)
    await client.waitFor(`Boolean(document.querySelector('#new-class-name'))`)
    await client.eval(setClassNameInput('Cầu lông Chưa Phân Loại Outdoor'))
    await client.eval(clickSubmitModalButton)
    await client.waitFor(`document.body.innerText.includes('outdoor = null')`)
    const outdoorNullPosts = await client.eval(`window.__fe10Calls.normalCreatePosts.length`)
    assert.equal(outdoorNullPosts, 0, 'Subject with outdoor: null must be blocked before any POST is sent')
    console.log('[FE10-BROWSER-03] PASS: Subject with outdoor: null is blocked before POST with explicit toast warning (0 POSTs sent).')
  } finally {
    client.close()
    proc.kill()
    await viteServer.close()
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore temp cleanup errors
    }
  }
}

if (!browserOnly) {
  await runUnitSuite()
}
await runBrowserSuite()
