import assert from 'node:assert/strict'

// Mock không cần trình duyệt: window chỉ cần dispatchEvent, fetch trả phản hồi giả; localStorage/sessionStorage rỗng.
const events = []
globalThis.window = { dispatchEvent: (event) => { events.push(event.type); return true } }
globalThis.localStorage = { getItem: () => null }
globalThis.sessionStorage = { getItem: () => null }

const { httpRequest, UNAUTHORIZED_EVENT } = await import('../src/api/httpClient.js')

const respond = (status, body) => {
  globalThis.fetch = async () => new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function unauthorizedEmitted(status, body, options = {}) {
  events.length = 0
  respond(status, body)
  await assert.rejects(() => httpRequest('/api/x', options))
  return events.includes(UNAUTHORIZED_EVENT)
}

// (a) Mã hết hạn nghiệp vụ KHÔNG phát sự kiện hết phiên
for (const code of ['REGISTRATION_CONFIRMATION_EXPIRED', 'PROPOSAL_EXPIRED', 'ADVANCED_PACKAGE_EXPIRED']) {
  assert.equal(await unauthorizedEmitted(409, { code, message: `${code}: expired` }), false, `${code} (409) không được đăng xuất`)
  assert.equal(await unauthorizedEmitted(400, { code }), false, `${code} (400) không được đăng xuất`)
}
// (b) HTTP 401 có phát
assert.equal(await unauthorizedEmitted(401, { message: 'Unauthenticated' }), true)
assert.equal(await unauthorizedEmitted(401, {}), true)
// (c) TOKEN_EXPIRED có phát, kể cả HTTP 403/400; EXPIRED_TOKEN và AUTH_EXPIRED cũng vậy
for (const status of [401, 403, 400]) {
  assert.equal(await unauthorizedEmitted(status, { code: 'TOKEN_EXPIRED' }), true, `TOKEN_EXPIRED (${status})`)
}
assert.equal(await unauthorizedEmitted(403, { code: 'token_expired' }), true, 'không phân biệt hoa thường')
assert.equal(await unauthorizedEmitted(403, { code: 'EXPIRED_TOKEN' }), true)
assert.equal(await unauthorizedEmitted(400, { code: 'AUTH_EXPIRED' }), true)
// (d) Câu thông báo hết phiên có phát
assert.equal(await unauthorizedEmitted(400, { message: 'JWT expired at 2026-11-19' }), true)
assert.equal(await unauthorizedEmitted(403, { message: 'Token expired' }), true)
assert.equal(await unauthorizedEmitted(400, { message: 'Phiên đăng nhập hết hạn' }), true)
// Lỗi thường không phát; notifyUnauthorized: false tắt việc phát
assert.equal(await unauthorizedEmitted(409, { code: 'CLASS_FULL', message: 'Class is full' }), false)
assert.equal(await unauthorizedEmitted(500, {}), false)
assert.equal(await unauthorizedEmitted(401, { code: 'TOKEN_EXPIRED' }, { notifyUnauthorized: false }), false)

console.log('http_client_expired_test.mjs: ALL PASSED')
