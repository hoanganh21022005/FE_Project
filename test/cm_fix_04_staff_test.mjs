import assert from 'node:assert/strict'
import { mapStaff, toStaffUpdateRequest } from '../src/api/staffMappers.js'
import { getAssignableStaffRoles, getStaff, updateStaff } from '../src/api/staffApi.js'
import { updateUserRole } from '../src/api/adminApi.js'
import { saveStaffChanges } from '../src/api/staffEditWorkflow.js'

const initial = mapStaff({ id: 42, name: 'Lan', email: 'lan@example.com', phone: '0123', role: 'Coach', specialization: 'Tennis', status: 'Active' })
assert.equal(initial.userId, 42)
assert.equal(toStaffUpdateRequest({ name: 'Lan', email: 'lan@example.com', role: 'coach', phone: '', specialization: '' }).phone, '')
assert.equal(toStaffUpdateRequest({ name: 'Lan', email: 'lan@example.com', role: 'coach', phone: '', specialization: '' }).specialization, '')
const roles = [{ id: 7, role: 'coach' }, { id: 12, role: 'receptionist' }, { id: 88, role: 'manager' }]
const form = { name: 'Lan', phone: '0123', role: 'coach', specialization: 'Tennis' }
const calls = []
let state = { ...initial }
let failProfile = null
let failRole = null
let failReload = null
const dependencies = {
  staff: initial, roles, currentUserId: 1, canEditProfile: true, canChangeRole: true,
  updateProfile: async (id, data) => {
    calls.push({ method: 'PUT', id, data })
    if (failProfile) throw failProfile
    state = { ...state, name: data.name, serverName: data.name, ...(data.phone !== undefined ? { phone: data.phone } : {}) }
    return { ...state, userId: id }
  },
  updateRole: async (id, roleId) => {
    calls.push({ method: 'PATCH', id, roleId })
    if (failRole) throw failRole
    state = { ...state, role: roles.find((item) => item.id === roleId).role }
    return { id, roleId }
  },
  reloadStaff: async () => {
    calls.push({ method: 'GET' })
    if (failReload) throw failReload
    return [state]
  },
}
const reset = () => { calls.length = 0; state = { ...initial }; failProfile = null; failRole = null; failReload = null }
let result = await saveStaffChanges({ ...dependencies, form: { ...form, name: 'Lan mới' } })
assert.deepEqual(calls.map((call) => call.method), ['PUT', 'GET'])
assert.equal(calls[0].id, 42)
assert.equal(calls[0].data.role, 'Coach')
assert.equal(result.profile.state, 'saved')
assert.equal(result.role.state, 'unchanged')

reset()
const correctedName = mapStaff({ id: 42, name: 'Tran Thi Huong', email: 'lan@example.com', phone: '0123', role: 'Coach', specialization: 'Tennis' })
state = { ...correctedName }
result = await saveStaffChanges({ ...dependencies, staff: correctedName, form: { name: correctedName.name, phone: '9999', role: 'coach', specialization: 'Tennis' } })
assert.equal(calls[0].data.name, 'Tran Thi Huong')
assert.equal(result.profile.state, 'saved')

reset()
result = await saveStaffChanges({
  ...dependencies,
  form: { ...form, name: 'Tran Thi Huong' },
  reloadStaff: async () => [mapStaff({ id: 42, name: 'Tran Thi Huong', email: 'lan@example.com', phone: '0123', role: 'Coach', specialization: 'Tennis' })],
})
assert.equal(result.profile.state, 'saved')
assert.equal(result.latest.name, 'Trần Thị Hương')

reset()
result = await saveStaffChanges({ ...dependencies, form: { ...form, name: 'Lan mới', role: 'receptionist' } })
assert.deepEqual(calls.map((call) => call.method), ['PUT', 'PATCH', 'GET'])
assert.equal(result.profile.state, 'saved')
assert.equal(result.role.state, 'saved')
assert.equal(result.latest.name, 'Lan mới')
assert.equal(result.latest.role, 'receptionist')

reset()
result = await saveStaffChanges({ ...dependencies, form: { ...form, role: 'receptionist' } })
assert.deepEqual(calls, [{ method: 'PATCH', id: 42, roleId: 12 }, { method: 'GET' }])
assert.equal(result.latest.role, 'receptionist')
reset()
result = await saveStaffChanges({ ...dependencies, form })
assert.deepEqual(calls, [])
assert.equal(result.role.state, 'unchanged')

for (const status of [400, 403, 404, 409, 500, 0]) {
  reset()
  failRole = Object.assign(new Error(`local ${status}`), { status })
  result = await saveStaffChanges({ ...dependencies, form: { ...form, name: 'Lan mới', role: 'receptionist' } })
  assert.equal(result.profile.state, 'saved')
  assert.equal(result.role.state, 'failed')
  assert.equal(result.role.error.status, status)
  assert.deepEqual(calls.map((call) => call.method), ['PUT', 'PATCH', 'GET'])
}
reset()
failProfile = Object.assign(new Error('local profile error'), { status: 500 })
result = await saveStaffChanges({ ...dependencies, form: { ...form, name: 'Lan mới', role: 'receptionist' } })
assert.equal(result.profile.state, 'failed')
assert.equal(result.role.state, 'saved')
assert.equal(result.latest.role, 'receptionist')
reset()
failProfile = Object.assign(new Error('expired'), { status: 401 })
result = await saveStaffChanges({ ...dependencies, form: { ...form, name: 'Lan mới', role: 'receptionist' } })
assert.deepEqual(calls.map((call) => call.method), ['PUT'])
assert.equal(result.role.state, 'skipped')
reset()
failRole = Object.assign(new Error('expired'), { status: 401 })
result = await saveStaffChanges({ ...dependencies, form: { ...form, name: 'Lan mới', role: 'receptionist' } })
assert.deepEqual(calls.map((call) => call.method), ['PUT', 'PATCH'])
assert.equal(result.profile.state, 'saved')
assert.equal(result.role.error.status, 401)
reset()
failReload = new Error('offline')
result = await saveStaffChanges({ ...dependencies, form: { ...form, role: 'receptionist' } })
assert.equal(result.role.state, 'saved')
assert.equal(result.reloadError, failReload)
reset()
await assert.rejects(saveStaffChanges({ ...dependencies, staff: { ...initial, userId: undefined }, form: { ...form, role: 'receptionist' } }), /mã người dùng/)
await assert.rejects(saveStaffChanges({ ...dependencies, currentUserId: 42, form: { ...form, role: 'receptionist' } }), /không có quyền/)
await assert.rejects(saveStaffChanges({ ...dependencies, currentUserId: null, form: { ...form, role: 'receptionist' } }), /không có quyền/)
await assert.rejects(saveStaffChanges({ ...dependencies, canChangeRole: false, form: { ...form, role: 'receptionist' } }), /không có quyền/)
await assert.rejects(saveStaffChanges({ ...dependencies, form: { ...form, role: 'admin' } }), /mã vai trò/)
await assert.rejects(saveStaffChanges({ ...dependencies, roles: [...roles, { id: 3, role: 'admin' }], form: { ...form, role: 'admin' } }), /mã vai trò/)
assert.deepEqual(calls, [])

const originalFetch = globalThis.fetch
const queue = []
const requests = []
globalThis.fetch = async (url, options = {}) => {
  requests.push({ url: String(url), method: options.method, body: options.body ? JSON.parse(options.body) : null })
  const next = queue.shift()
  return new Response(JSON.stringify(next.body), { status: next.status, headers: { 'Content-Type': 'application/json' } })
}
try {
  queue.push({ status: 200, body: [{ id: 7, name: 'Coach' }, { id: 12, name: 'Receptionist' }, { id: 88, name: 'CenterManager' }, { id: 4, name: 'Admin' }, { id: 5, name: 'Member' }] })
  assert.deepEqual((await getAssignableStaffRoles()).map((item) => item.role), ['coach', 'receptionist', 'manager'])
  assert.match(requests.at(-1).url, /\/api\/roles$/)
  queue.push({ status: 200, body: { id: 42, name: 'Lan', email: 'lan@example.com', role: 'Coach', phone: '' } })
  await updateStaff(42, { name: 'Lan', email: 'lan@example.com', role: 'Coach', phone: '' })
  assert.match(requests.at(-1).url, /\/api\/staff\/42$/)
  assert.equal(requests.at(-1).method, 'PUT')
  assert.equal(requests.at(-1).body.phone, '')
  queue.push({ status: 200, body: { id: 42, roleId: 12, roleName: 'Receptionist' } })
  const updated = await updateUserRole(42, 12)
  assert.match(requests.at(-1).url, /\/api\/users\/42\/role$/)
  assert.deepEqual(requests.at(-1).body, { roleId: 12 })
  assert.equal(updated.roleId, 12)
  queue.push({ status: 200, body: [{ id: 42, name: 'Lan', email: 'lan@example.com', role: 'Receptionist' }] })
  assert.equal((await getStaff({ strict: true }))[0].userId, 42)
  queue.push({ status: 200, body: { unexpected: true } })
  await assert.rejects(getStaff({ strict: true }), /không đúng định dạng/)
} finally {
  globalThis.fetch = originalFetch
}
console.log('PASS: Staff role/profile workflow, permissions, user ID, partial failures and local API contract')
