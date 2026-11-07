import assert from 'node:assert/strict'
import { getAuditLogs } from '../src/api/managerApi.js'
import { formatAdminDateTime } from '../src/components/admin/adminDateUtils.js'

const originalFetch = globalThis.fetch
const queue = []
const calls = []
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), method: options.method })
  const result = queue.shift()
  if (result instanceof Error) throw result
  return new Response(JSON.stringify(result.body), { status: result.status, headers: { 'content-type': 'application/json' } })
}
try {
  const rawTimestamp = '2026-11-06T17:30:00Z'
  queue.push({ status: 200, body: [{ id: 1, userId: 7, action: 'UPDATE_CLASS', targetEntity: 'Class', targetId: 8, detail: 'Updated', createdAt: rawTimestamp }] })
  const [log] = await getAuditLogs({ notifyUnauthorized: false, notifyForbidden: false })
  assert.equal(log.timestamp, rawTimestamp)
  assert.equal(log.actorName, 'User #7')
  assert.equal(log.target, 'Class #8')
  assert.equal(log.reason, 'Updated')
  assert.equal(log.previousValue, null)
  assert.equal(log.newValue, null)
  assert.match(formatAdminDateTime(log.timestamp), /00:30:00/)
  assert.equal(formatAdminDateTime('2026-11-07T00:30:00'), formatAdminDateTime(rawTimestamp))
  queue.push({ status: 200, body: [] })
  assert.deepEqual(await getAuditLogs(), [])
  for (const body of [null, {}, { content: [] }, [null], [[]], [{}], [{ id: '1' }]]) {
    queue.push({ status: 200, body })
    await assert.rejects(getAuditLogs(), /không đúng định dạng/)
  }
  for (const status of [401, 403, 500]) {
    queue.push({ status, body: { message: `local error ${status}` } })
    await assert.rejects(getAuditLogs({ notifyUnauthorized: false, notifyForbidden: false }), (error) => error.status === status)
  }
  queue.push(new TypeError('offline'))
  await assert.rejects(getAuditLogs(), (error) => error.status === 0)
  queue.push({ status: 200, body: [{ id: 2, userId: null, action: null, createdAt: null }] })
  const [missing] = await getAuditLogs()
  assert.equal(missing.actorName, null)
  assert.equal(missing.action, null)
  assert.equal(missing.target, null)
  assert.equal(calls.every((call) => call.method === 'GET' && call.url.includes('/api/audit-logs')), true)
} finally {
  globalThis.fetch = originalFetch
}
console.log('PASS: nhật ký thực, rỗng, dữ liệu sai, lỗi 401/403/500/mạng và giờ Việt Nam')
