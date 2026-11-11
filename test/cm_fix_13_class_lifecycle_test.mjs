import assert from 'node:assert/strict'
import { getClassById } from '../src/api/managerApi.js'

const originalFetch = globalThis.fetch
const calls = []
const dto = {
  id: 71,
  name: 'Normal lifecycle fixture',
  maxCapacity: 12,
  minCapacity: 8,
  status: 'Open',
  openingConfirmedAt: null,
  openingConfirmedBy: null,
  postponementCount: 0,
  lifecycleVersion: 0,
  changePending: false,
}

try {
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), method: options.method })
    return new Response(JSON.stringify(dto), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const result = await getClassById(71, {}, { notifyForbidden: false })
  assert.equal(calls.length, 1)
  assert.equal(new URL(calls[0].url).pathname, '/api/classes/71')
  assert.equal(calls[0].method, 'GET')
  assert.equal(result.status, 'open')
  assert.equal(result.apiStatus, 'Open')
  assert.equal(result.maxCapacity, 12)
  assert.equal(result.minCapacity, 8)
  assert.equal(result.openingConfirmedAt, null)
  assert.equal(result.postponementCount, 0)
  assert.equal(result.lifecycleVersion, 0)
  assert.equal(result.changePending, false)

  calls.length = 0
  await assert.rejects(() => getClassById(0), /positive integer/)
  assert.deepEqual(calls, [], 'invalid IDs must not make an API request')
} finally {
  globalThis.fetch = originalFetch
}

console.log('CM-FIX-13 class detail API test passed')
