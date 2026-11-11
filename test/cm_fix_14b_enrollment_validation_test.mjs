import assert from 'node:assert/strict'
import { getEnrollmentsByClass } from '../src/api/classEnrollmentApi.js'

const originalFetch = globalThis.fetch
try {
  globalThis.fetch = async () => new Response(JSON.stringify({ unexpected: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
  await assert.rejects(
    () => getEnrollmentsByClass(71, { strict: true }),
    /enrollment/,
    'strict mode must not turn malformed data into a valid empty enrollment list',
  )
} finally {
  globalThis.fetch = originalFetch
}

console.log('CM-FIX-14B enrollment validation test passed')
