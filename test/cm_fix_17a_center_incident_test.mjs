import assert from 'node:assert/strict'
import { mapSession } from '../src/api/mappers.js'
import {
  buildCompensateCenterIncidentRequest,
  buildNormalMakeupCenterIncidentRequest,
  buildOpenCenterIncidentRequest,
  buildResolveCenterIncidentRequest,
  canManageCenterIncident,
  centerIncidentStatusSemantics,
  compensateCenterIncident,
  createCenterIncidentRequestKey,
  createNormalMakeup,
  getCenterIncidentError,
  getCenterIncidentSessionType,
  inspectCenterIncident,
  listCenterIncidents,
  normalizeIncidentLocalDateTime,
  openCenterIncident,
  resolveCenterIncident,
} from '../src/api/centerIncidentApi.js'

const originalFetch = globalThis.fetch
const requests = []
const now = new Date('2026-11-11T04:00:00.000Z') // 11:00 Asia/Ho_Chi_Minh
const actor = { id: 17, role: 'CenterManager', status: 'Active', authenticated: true, centerId: 1, authorities: ['MANAGE_CLASSES'] }
const session = { id: 123, sessionDate: '2026-11-11', startTime: '09:00:00', endTime: '10:30:00', isPrivate: false, centerId: 1 }
const incident = {
  id: 9, sessionId: 123, status: 'WaitingForRecovery', startedAt: '2026-11-11T09:00:00', endedAt: null,
  originalDeadline: null, deadlineBefore: '2026-11-20T23:59:59', deadlineAfter: null,
  recoveredCredits: 0, sessionCompensated: false, affectedMemberIds: [4, 5], reason: 'Power outage', evidence: 'Center incident report', centerId: 1,
}
let incidents = [structuredClone(incident)]
let sessions = [structuredClone(session)]
let nextPostStatus = 200
let nextPostBody = null
let delayedOpen = false
let resolveDelayedOpen
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

try {
  globalThis.fetch = async (url, options) => {
    const path = new URL(String(url)).pathname
    const body = options.body ? JSON.parse(options.body) : null
    requests.push({ path, method: options.method, body, credentials: options.credentials })
    if (path === '/api/center-incidents' && options.method === 'GET') return reply(incidents)
    if (path === '/api/sessions' && options.method === 'GET') return reply(sessions)
    if (options.method === 'POST') {
      if (delayedOpen && path === '/api/center-incidents') return new Promise((resolve) => { resolveDelayedOpen = resolve })
      if (nextPostStatus >= 400) return reply(nextPostBody || { code: nextPostStatus === 409 ? 'IDEMPOTENCY_CONFLICT' : `E${nextPostStatus}`, message: 'backend rejected fixture request' }, nextPostStatus)
      if (path === '/api/center-incidents') {
        const created = { ...incident, ...body, id: 10, status: 'WaitingForRecovery', endedAt: null, recoveredCredits: 0, sessionCompensated: false }
        incidents = [created, ...incidents]
        return reply(created)
      }
      if (path.endsWith('/resolve')) return reply({ ...incident, ...body, status: 'Resolved' })
      if (path.endsWith('/compensate')) return reply({ ...incident, ...body, sessionCompensated: true })
      if (path.endsWith('/normal-makeup')) return reply({ id: 200, classId: 33, sessionDate: body.date, startTime: body.startTime, endTime: body.endTime, roomId: body.roomId, coachId: body.coachId, isPrivate: false })
    }
    return reply({ code: 'NOT_FOUND' }, 404)
  }

  const key = createCenterIncidentRequestKey()
  assert.match(key, /^ci:[A-Za-z0-9-]+$/)
  assert.equal(requestKeySafe(key), true)
  const openInput = { sessionId: 123, startedAt: '2026-11-11T09:00', reason: '  Power outage  ', evidence: '  Signed center report  ', requestKey: key }
  assert.deepEqual(buildOpenCenterIncidentRequest(openInput, { now }), {
    sessionId: 123, startedAt: '2026-11-11T09:00:00', reason: 'Power outage', evidence: 'Signed center report', requestKey: key,
  })
  assert.throws(() => buildOpenCenterIncidentRequest({ ...openInput, reason: ' ' }, { now }), (error) => error.code === 'CENTER_INCIDENT_REASON_REQUIRED')
  assert.throws(() => buildOpenCenterIncidentRequest({ ...openInput, evidence: '' }, { now }), (error) => error.code === 'CENTER_INCIDENT_EVIDENCE_REQUIRED')
  assert.throws(() => buildOpenCenterIncidentRequest({ ...openInput, reason: 'x'.repeat(2001) }, { now }), (error) => error.code === 'CENTER_INCIDENT_REASON_TOO_LONG')
  assert.throws(() => buildOpenCenterIncidentRequest({ ...openInput, startedAt: '2026-11-11T11:00:01' }, { now }), (error) => error.code === 'INVALID_INCIDENT_TIME')
  assert.throws(() => buildOpenCenterIncidentRequest({ ...openInput, startedAt: '2026-11-11T09:00:00Z' }, { now }), (error) => error.code === 'INVALID_INCIDENT_TIME')
  assert.throws(() => buildOpenCenterIncidentRequest({ ...openInput, requestKey: 'bad key' }, { now }), (error) => error.code === 'INVALID_REQUEST_KEY')
  assert.throws(() => buildOpenCenterIncidentRequest({ ...openInput, extra: true }, { now }), (error) => error.code === 'CENTER_INCIDENT_FIELD_UNSUPPORTED')

  const actors = {
    manager: actor,
    admin: { ...actor, role: 'Admin' },
    inactive: { ...actor, status: 'Inactive' },
    wrongPermission: { ...actor, authorities: [] },
    otherCenter: { ...actor, centerId: 2 },
  }
  assert.equal(canManageCenterIncident(actors.manager, incident), true)
  for (const denied of [actors.admin, actors.inactive, actors.wrongPermission, actors.otherCenter]) assert.equal(canManageCenterIncident(denied, incident), false)

  const incidentsFromBackend = await listCenterIncidents()
  assert.equal(incidentsFromBackend[0].recoveredCredits, 0)
  assert.equal(incidentsFromBackend[0].sessionCompensated, false)
  assert.equal(incidentsFromBackend[0].endedAt, null)
  assert.equal(requests.at(-1).path, '/api/center-incidents')
  const facts = inspectCenterIncident(incident)
  assert.equal(facts.recoveredCredits, 0)
  assert.equal(facts.sessionCompensated, false)
  assert.equal(facts.endedAt, null)
  assert.equal(facts.deadlineAfter, null)
  assert.equal(facts.affectedMemberIds.length, 2)
  assert.deepEqual(mapSession({ id: 123, isPrivate: false, makeupForSessionId: 0 }), {
    id: 123, classId: null, className: null, subjectId: null, subjectName: null,
    coachId: null, coachName: null, roomId: null, roomName: null, roomLocation: null,
    sessionDate: null, startTime: null, endTime: null, status: null,
    centerInvalidated: false, sessionNumber: null, enrolledCount: null, maxCapacity: null,
    isPrivate: false, makeupForSessionId: 0,
  })
  assert.equal(mapSession({ id: 124 }).isPrivate, null)

  requests.length = 0
  const opened = await openCenterIncident(openInput, { actor, now })
  assert.equal(opened.id, 10)
  assert.deepEqual(requests.map(({ method, path }) => [method, path]), [
    ['GET', '/api/sessions'], ['POST', '/api/center-incidents'],
  ])
  assert.deepEqual(requests.at(-1).body, {
    sessionId: 123, startedAt: '2026-11-11T09:00:00', reason: 'Power outage', evidence: 'Signed center report', requestKey: key,
  })
  assert.equal(requests.at(-1).credentials, 'include')
  assert.throws(() => openCenterIncident({ ...openInput, reason: 'different incident' }, { actor, now }), (error) => error.code === 'IDEMPOTENCY_CONFLICT')

  // Repeated clicks during the same in-flight request share one POST.
  requests.length = 0
  delayedOpen = true
  const duplicateKeyInput = { ...openInput, requestKey: 'same-operation-key' }
  const firstOpen = openCenterIncident(duplicateKeyInput, { actor, now })
  const secondOpen = openCenterIncident(duplicateKeyInput, { actor, now })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(requests.filter(({ method, path }) => method === 'POST' && path === '/api/center-incidents').length, 1)
  delayedOpen = false
  resolveDelayedOpen(reply({ ...incident, id: 11, ...buildOpenCenterIncidentRequest(duplicateKeyInput, { now }) }))
  assert.equal((await firstOpen).id, 11)
  assert.equal((await secondOpen).id, 11)

  requests.length = 0
  incidents = [structuredClone(incident)]
  const resolved = await resolveCenterIncident(9, { endedAt: '2026-11-11T10:30:00' }, { actor, now })
  assert.equal(resolved.status, 'Resolved')
  assert.deepEqual(requests.map(({ method, path }) => [method, path]), [
    ['GET', '/api/center-incidents'], ['POST', '/api/center-incidents/9/resolve'],
  ])
  assert.deepEqual(requests.at(-1).body, { endedAt: '2026-11-11T10:30:00' })
  assert.throws(() => buildResolveCenterIncidentRequest(incident, { endedAt: '2026-11-11T08:59:59' }, { now }), (error) => error.code === 'INVALID_INCIDENT_TIME')
  assert.throws(() => buildResolveCenterIncidentRequest(incident, { endedAt: '2026-11-11T11:00:01' }, { now }), (error) => error.code === 'INVALID_INCIDENT_TIME')
  assert.throws(() => buildResolveCenterIncidentRequest({ ...incident, status: 'Unrecognized' }, { endedAt: '2026-11-11T10:30:00' }, { now }), (error) => error.code === 'INCIDENT_STATE_UNVERIFIED')

  requests.length = 0
  await assert.rejects(() => compensateCenterIncident(9, { reason: 'Confirmed not held', verifiedNotHeld: false }, { actor }), (error) => error.code === 'NOT_HELD_CONFIRMATION_REQUIRED')
  assert.equal(requests.filter(({ method }) => method === 'POST').length, 0)
  const compensated = await compensateCenterIncident(9, { reason: 'Manager confirmed the session was not held', verifiedNotHeld: true }, { actor })
  assert.equal(compensated.sessionCompensated, true)
  assert.deepEqual(requests.at(-1).body, { reason: 'Manager confirmed the session was not held', verifiedNotHeld: true })

  const verifiedIncident = { ...incident, sessionCompensated: true }
  assert.equal(getCenterIncidentSessionType(verifiedIncident, session), 'Normal')
  assert.equal(getCenterIncidentSessionType(verifiedIncident, { ...session, isPrivate: true }), 'Advanced')
  assert.equal(getCenterIncidentSessionType(verifiedIncident, { id: 123 }), 'Unverified')
  assert.equal(getCenterIncidentSessionType(verifiedIncident, { ...session, isPrivate: null, classType: 'Normal' }), 'Unverified')
  const makeupInput = { date: '2026-11-20', startTime: '09:00', endTime: '10:30:00', roomId: 1, coachId: 2, reason: 'Makeup after confirmed incident' }
  assert.deepEqual(buildNormalMakeupCenterIncidentRequest(verifiedIncident, session, makeupInput, { now }), {
    date: '2026-11-20', startTime: '09:00:00', endTime: '10:30:00', roomId: 1, coachId: 2, reason: 'Makeup after confirmed incident',
  })
  assert.throws(() => buildNormalMakeupCenterIncidentRequest(verifiedIncident, { ...session, isPrivate: true }, makeupInput, { now }), (error) => error.code === 'NORMAL_MAKEUP_EVIDENCE_REQUIRED')
  assert.throws(() => buildNormalMakeupCenterIncidentRequest({ ...incident, sessionCompensated: false }, session, makeupInput, { now }), (error) => error.code === 'NORMAL_MAKEUP_EVIDENCE_REQUIRED')
  assert.throws(() => buildNormalMakeupCenterIncidentRequest(verifiedIncident, session, { ...makeupInput, date: '2026-11-10' }, { now }), (error) => error.code === 'MAKEUP_TIME_INVALID')

  requests.length = 0
  incidents = [verifiedIncident]
  sessions = [session]
  const originalSessions = structuredClone(sessions)
  const makeup = await createNormalMakeup(9, makeupInput, { actor, now })
  assert.equal(makeup.id, 200)
  assert.deepEqual(requests.map(({ method, path }) => [method, path]), [
    ['GET', '/api/center-incidents'], ['GET', '/api/sessions'], ['POST', '/api/center-incidents/9/normal-makeup'],
  ])
  assert.deepEqual(requests.at(-1).body, {
    date: '2026-11-20', startTime: '09:00:00', endTime: '10:30:00', roomId: 1, coachId: 2, reason: 'Makeup after confirmed incident',
  })
  assert.equal(requests.some(({ path }) => /\/api\/center-incidents\/\d+$/.test(path)), false, 'No undocumented incident detail GET is called.')
  assert.deepEqual(sessions, originalSessions, 'Creating makeup does not mutate local session data.')

  requests.length = 0
  await assert.rejects(() => resolveCenterIncident(9, { endedAt: '2026-11-11T10:30:00' }, { actor: actors.admin, now }), (error) => error.code === 'CENTER_INCIDENT_MANAGER_ACCESS_REQUIRED')
  assert.equal(requests.length, 0)

  requests.length = 0
  nextPostStatus = 409
  await assert.rejects(() => openCenterIncident({ ...openInput, requestKey: 'new-conflict-key' }, { actor, now }), (error) => error.status === 409 && error.code === 'IDEMPOTENCY_CONFLICT')
  assert.equal(requests.filter(({ method }) => method === 'POST').length, 1)
  nextPostStatus = 200

  for (const status of [400, 401, 403, 404, 500]) {
    nextPostStatus = status
    const requestCount = requests.filter(({ method }) => method === 'POST').length
    await assert.rejects(
      () => openCenterIncident({ ...openInput, requestKey: `error-${status}` }, { actor, now }),
      (error) => error.status === status,
    )
    assert.equal(requests.filter(({ method }) => method === 'POST').length, requestCount + 1)
  }
  nextPostStatus = 200

  const normalizedError = getCenterIncidentError({ status: 409, code: 'IDEMPOTENCY_CONFLICT', details: { requestId: 'r-1' } })
  assert.equal(normalizedError.status, 409)
  assert.equal(normalizedError.code, 'IDEMPOTENCY_CONFLICT')
  assert.equal(normalizedError.reloadBeforeNextAction, true)
  assert.equal(getCenterIncidentError({ status: 0 }).outcomeUncertain, true)

  // A list failure stays an error instead of becoming an empty list.
  globalThis.fetch = async () => reply({ code: 'FORBIDDEN', message: 'denied' }, 403)
  await assert.rejects(listCenterIncidents(), (error) => error.status === 403 && error.code === 'FORBIDDEN')
  assert.equal(centerIncidentStatusSemantics.resolved, 'Resolved')
  assert.equal(normalizeIncidentLocalDateTime('2026-11-11T09:15'), '2026-11-11T09:15:00')

  requests.length = 0
  globalThis.fetch = async (url, options) => {
    const path = new URL(String(url)).pathname
    requests.push({ path, method: options.method })
    if (options.method === 'GET' && path === '/api/center-incidents') return reply(incidents)
    throw new TypeError('network fixture timeout')
  }
  await assert.rejects(() => resolveCenterIncident(9, { endedAt: '2026-11-11T10:30:00' }, { actor, now }), (error) => error.status === 0)
  assert.equal(requests.filter(({ method }) => method === 'POST').length, 1, 'An uncertain POST is never automatically retried.')
} finally {
  globalThis.fetch = originalFetch
}

function requestKeySafe(value) {
  return /^[A-Za-z0-9_.:-]{1,80}$/.test(value)
}

console.log('CM-FIX-17A Center Incident API and logic tests passed')
