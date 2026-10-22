import assert from 'node:assert/strict'
import { createPackage, updatePackage, updatePackageStatus } from '../src/api/managerApi.js'
import { mapPackage, toPackageRequest } from '../src/api/mappers.js'
import {
  buildPackageFormPayload,
  packageFormFromItem,
  packageStatusForApi,
  validatePackageForm,
} from '../src/api/packageForm.js'

const mappedAdvanced = mapPackage({
  id: 14,
  name: 'Advanced 29 day',
  durationDays: 29,
  price: '0',
  benefits: 'Benefit A;Benefit B\nBenefit C',
  status: 'ACTIVE',
  packageType: 'Advanced',
  totalCredit: 7,
})
const editForm = packageFormFromItem(mappedAdvanced, { apiMode: true })
assert.equal(editForm.durationDays, 29)
assert.equal(editForm.price, 0)
assert.equal(editForm.totalCredit, 7)
assert.equal(editForm.benefitsText, 'Benefit A\nBenefit B\nBenefit C')

const advancedPayload = buildPackageFormPayload({
  ...editForm,
  packageType: 'Advanced',
  durationDays: '29',
  price: '0',
  totalCredit: '7',
}, 'Benefit A updated\nBenefit B\nBenefit C')
assert.deepEqual(advancedPayload, {
  name: 'Advanced 29 day',
  packageType: 'Advanced',
  durationDays: 29,
  price: 0,
  benefits: ['Benefit A updated', 'Benefit B', 'Benefit C'],
  status: 'active',
  totalCredit: 7,
})
assert.equal(validatePackageForm(advancedPayload), '')
assert.equal(validatePackageForm({ ...advancedPayload, totalCredit: null }), 'Advanced packages require a whole number of credits (0 or more).')

const normalPayload = buildPackageFormPayload({
  name: 'Normal free',
  packageType: 'Normal',
  durationDays: '30',
  price: '0',
  status: 'active',
  totalCredit: '',
}, 'Open gym')
assert.equal(validatePackageForm(normalPayload), '')
assert.equal(normalPayload.price, 0)
assert.equal(normalPayload.totalCredit, null)
assert.equal(buildPackageFormPayload({ ...normalPayload, price: null, durationDays: '' }, '').price, null)
assert.equal(packageStatusForApi('active'), 'INACTIVE')
assert.equal(packageStatusForApi('inactive'), 'ACTIVE')

assert.deepEqual(toPackageRequest(advancedPayload), {
  name: 'Advanced 29 day',
  durationDays: 29,
  price: 0,
  benefits: 'Benefit A updated;Benefit B;Benefit C',
  status: 'active',
  packageType: 'Advanced',
  totalCredit: 7,
})

const originalFetch = globalThis.fetch
const calls = []
const responseQueue = []
globalThis.fetch = async (url, options) => {
  calls.push({ url, options, body: options.body ? JSON.parse(options.body) : null })
  const next = responseQueue.shift()
  if (next instanceof Error) throw next
  return new Response(JSON.stringify(next.body), {
    status: next.status,
    headers: { 'content-type': 'application/json' },
  })
}

try {
  responseQueue.push({ status: 201, body: { id: 21, ...toPackageRequest(normalPayload), status: 'ACTIVE' } })
  const createdNormal = await createPackage(normalPayload, { notifyForbidden: false })
  assert.equal(createdNormal.packageType, 'Normal')
  assert.equal(calls.at(-1).options.method, 'POST')
  assert.deepEqual(calls.at(-1).body, toPackageRequest(normalPayload))

  responseQueue.push({ status: 201, body: { id: 22, ...toPackageRequest(advancedPayload), status: 'ACTIVE' } })
  await createPackage(advancedPayload, { notifyForbidden: false })
  assert.equal(calls.at(-1).body.totalCredit, 7)
  assert.equal(calls.at(-1).body.durationDays, 29)

  responseQueue.push({ status: 200, body: { id: 22, ...toPackageRequest({ ...advancedPayload, packageType: 'Normal' }), packageType: 'Normal', status: 'ACTIVE' } })
  const changedType = await updatePackage(22, { ...advancedPayload, packageType: 'Normal' }, { notifyForbidden: false })
  assert.equal(calls.at(-1).options.method, 'PUT')
  assert.equal(changedType.packageType, 'Normal')
  assert.equal(calls.at(-1).body.totalCredit, 7)

  responseQueue.push({ status: 200, body: { id: 22, ...toPackageRequest(advancedPayload), status: 'INACTIVE' } })
  const changedStatus = await updatePackageStatus(22, 'INACTIVE', { notifyForbidden: false })
  assert.equal(calls.at(-1).options.method, 'PATCH')
  assert.deepEqual(calls.at(-1).body, { status: 'INACTIVE' })
  assert.equal(changedStatus.status, 'inactive')
  assert.equal(changedStatus.rawStatus, 'INACTIVE')

  for (const status of [400, 403, 409]) {
    responseQueue.push({ status, body: { message: `mock ${status}`, code: `MOCK_${status}` } })
    await assert.rejects(createPackage(normalPayload, { notifyForbidden: false }), (error) => {
      assert.equal(error.status, status)
      assert.equal(error.message, `mock ${status}`)
      return true
    })
  }

  responseQueue.push(new TypeError('mock network failure'))
  await assert.rejects(createPackage(normalPayload, { notifyForbidden: false }), (error) => error.status === 0)
} finally {
  globalThis.fetch = originalFetch
}

console.log('FE-06 package management tests passed')
