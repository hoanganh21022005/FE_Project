import assert from 'node:assert/strict'
import {
  buildRoomRequest,
  buildSubjectRequest,
  isZeroOrMissingSubjectPrice,
  roomStatusForApi,
} from '../src/api/resourceRequests.js'

assert.deepEqual(buildSubjectRequest({
  name: '  Tennis  ', description: ' Outdoor sport ', slug: ' tennis ',
  normalPrice: '125000', advancedPrice: '0', status: 'active', outdoor: true,
}), {
  name: 'Tennis', description: 'Outdoor sport', status: 'Active', slug: 'tennis',
  normalPrice: 125000, advancedPrice: 0,
})
assert.equal('outdoor' in buildSubjectRequest({ name: 'Tennis', outdoor: true }), false)
assert.equal(buildSubjectRequest({ name: 'Tennis', normalPrice: '', advancedPrice: null }).normalPrice, null)
assert.throws(() => buildSubjectRequest({ name: '   ' }), /required/)
assert.throws(() => buildSubjectRequest({ name: 'Tennis', normalPrice: '-1' }), /non-negative/)
assert.throws(() => buildSubjectRequest({ name: 'Tennis', advancedPrice: 'not a number' }), /non-negative/)
assert.equal(isZeroOrMissingSubjectPrice({ normalPrice: 0, advancedPrice: 100 }), true)
assert.equal(isZeroOrMissingSubjectPrice({ normalPrice: 10, advancedPrice: 20 }), false)

assert.deepEqual(buildRoomRequest({
  name: ' Court B ', location: 'West', capacity: '6', status: 'closed',
  facilityType: 'Outdoor', outdoor: false,
}), {
  name: 'Court B', location: 'West', capacity: 6, status: 'Closed', facilityType: 'Outdoor',
})
assert.equal('outdoor' in buildRoomRequest({ name: 'Room', capacity: 1, status: 'available', facilityType: 'Indoor' }), false)
assert.equal(roomStatusForApi('maintenance'), 'Maintenance')
assert.equal(roomStatusForApi('active'), null)
assert.throws(() => buildRoomRequest({ name: 'Room', capacity: 0, status: 'available', facilityType: 'Indoor' }), /positive whole number/)
assert.throws(() => buildRoomRequest({ name: 'Room', capacity: 1.5, status: 'available', facilityType: 'Indoor' }), /positive whole number/)
assert.throws(() => buildRoomRequest({ name: 'Room', capacity: 1, status: 'active', facilityType: 'Indoor' }), /status/)
assert.throws(() => buildRoomRequest({ name: 'Room', capacity: 1, status: 'available', facilityType: 'Other' }), /Facility type/)

let lastRequest
globalThis.fetch = async (url, options) => {
  lastRequest = { url: String(url), options }
  return new Response(JSON.stringify({ id: 31, name: 'Tennis', normalPrice: 125000, advancedPrice: 0, status: 'Active', slug: 'tennis', outdoor: true }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}
const managerApi = await import('../src/api/managerApi.js')
await managerApi.createSubject({ name: 'Tennis', normalPrice: 125000, advancedPrice: 0, outdoor: true })
assert.equal(new URL(lastRequest.url).pathname, '/api/subjects')
assert.deepEqual(JSON.parse(lastRequest.options.body), {
  name: 'Tennis', description: '', status: 'Active', slug: null, normalPrice: 125000, advancedPrice: 0,
})
assert.equal('outdoor' in JSON.parse(lastRequest.options.body), false)

globalThis.fetch = async (url, options) => {
  lastRequest = { url: String(url), options }
  return new Response(JSON.stringify({ id: 32, name: 'Court B', location: 'West', capacity: 6, status: 'Available', facilityType: 'Outdoor', outdoor: true }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}
await managerApi.createRoom({ name: 'Court B', location: 'West', capacity: 6, status: 'available', facilityType: 'Outdoor', outdoor: false })
assert.deepEqual(JSON.parse(lastRequest.options.body), {
  name: 'Court B', location: 'West', capacity: 6, status: 'Available', facilityType: 'Outdoor',
})
assert.equal('outdoor' in JSON.parse(lastRequest.options.body), false)

globalThis.fetch = async (url, options) => {
  lastRequest = { url: String(url), options }
  return new Response(JSON.stringify({ id: 32, name: 'Court B', location: 'West', capacity: 6, status: 'Closed', facilityType: 'Outdoor', outdoor: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
await managerApi.updateRoomStatus(32, 'closed')
assert.equal(new URL(lastRequest.url).pathname, '/api/rooms/32/status')
assert.deepEqual(JSON.parse(lastRequest.options.body), { status: 'Closed' })

globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Room still has future scheduled sessions: #7. Reassign or cancel them before changing the room status.' }), {
  status: 409,
  headers: { 'Content-Type': 'application/json' },
})
await assert.rejects(
  managerApi.updateRoomStatus(32, 'closed'),
  error => error.status === 409 && /future scheduled sessions/.test(error.message),
)

globalThis.fetch = async () => new Response(JSON.stringify({ message: 'normalPrice must be positive' }), {
  status: 400,
  headers: { 'Content-Type': 'application/json' },
})
await assert.rejects(
  managerApi.createSubject({ name: 'Tennis' }),
  error => error.status === 400 && /normalPrice must be positive/.test(error.message),
)

globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Forbidden' }), {
  status: 403,
  headers: { 'Content-Type': 'application/json' },
})
await assert.rejects(
  managerApi.createRoom({ name: 'Room', capacity: 4, status: 'available', facilityType: 'Indoor' }),
  error => error.status === 403 && error.message === 'Forbidden',
)

console.log('FE-05 resource request tests passed')
