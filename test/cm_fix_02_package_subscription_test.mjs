import assert from 'node:assert/strict'
import { getPackages } from '../src/api/managerApi.js'
import { getMemberSubscriptions } from '../src/api/membershipApi.js'
import { isListAccessError, listLoadErrorMessage } from '../src/api/listLoadState.js'
import { isVisibleManagerPackage, packagesForType, unclassifiedPackages } from '../src/api/packagePricing.js'

const originalFetch = globalThis.fetch
const responses = []
const calls = []
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), method: options.method })
  const next = responses.shift()
  if (next instanceof Error) throw next
  return new Response(JSON.stringify(next.body), { status: next.status, headers: { 'content-type': 'application/json' } })
}
try {
  responses.push({ status: 200, body: [
    { id: 21, name: 'Normal', packageType: 'Normal', price: 0, durationDays: 30, status: 'Inactive' },
    { id: 22, name: 'Advanced', packageType: 'Advanced', price: 2500000, durationDays: 45, totalCredit: 12, status: 'Active', subjectId: 7 },
    { id: 1, name: 'Mã cũ', packageType: 'Normal', price: 0, durationDays: null, status: 'Inactive' },
    { id: 23, name: 'Chưa phân loại', packageType: null, price: null, durationDays: null, status: null },
  ] })
  const packages = await getPackages({ notifyUnauthorized: false, notifyForbidden: false })
  assert.deepEqual(packagesForType(packages, 'Normal').map((item) => item.id), [21, 1])
  assert.deepEqual(packagesForType(packages, 'Advanced').map((item) => item.id), [22])
  assert.deepEqual(unclassifiedPackages(packages).map((item) => item.id), [23])
  assert.equal(isVisibleManagerPackage(packages[0]), true)
  assert.equal(isVisibleManagerPackage(packages[2]), false)
  assert.equal(packages[0].price, 0)
  assert.equal(packages[0].status, 'inactive')
  assert.equal(packages[1].subjectId, 7)
  assert.equal(packages[1].durationDays, 45)
  assert.equal(packages[1].totalCredit, 12)
  assert.equal(packages[3].price, null)
  assert.equal(packages[3].durationDays, null)
  responses.push({ status: 200, body: [] })
  assert.deepEqual(await getPackages(), [])
  responses.push({ status: 200, body: { unexpected: true } })
  await assert.rejects(getPackages(), /không đúng định dạng/)
  for (const status of [401, 403, 500]) {
    responses.push({ status, body: { message: `local ${status}` } })
    await assert.rejects(getPackages({ notifyUnauthorized: false, notifyForbidden: false }), (error) => {
      assert.equal(error.status, status)
      assert.equal(isListAccessError(error), status !== 500)
      assert.ok(listLoadErrorMessage(error, 'vi', 'danh sách gói'))
      return true
    })
  }
  responses.push(new TypeError('offline'))
  await assert.rejects(getPackages(), (error) => error.status === 0 && /kết nối/.test(listLoadErrorMessage(error, 'vi', 'gói')))

  responses.push({ status: 200, body: [{ subscriptionId: 99, memberId: 7, packageId: null, packageName: 'Advanced', packageType: 'Advanced', price: 2500000, status: 'Active', subjectId: 3, remainingCredit: 8, validityDays: 45 }] })
  const [subscription] = await getMemberSubscriptions(7, { strict: true })
  assert.equal(subscription.subscriptionId, 99)
  assert.equal(subscription.packageId, null)
  assert.equal(subscription.subjectId, 3)
  assert.equal(subscription.remainingCredit, 8)
  assert.equal(subscription.validityDays, 45)
  responses.push({ status: 200, body: [] })
  assert.deepEqual(await getMemberSubscriptions(7, { strict: true }), [])
  responses.push({ status: 200, body: { unexpected: true } })
  await assert.rejects(getMemberSubscriptions(7, { strict: true }), /không đúng định dạng/)
  for (const status of [401, 403, 500]) {
    responses.push({ status, body: { message: `local ${status}` } })
    await assert.rejects(getMemberSubscriptions(7, { strict: true }), (error) => error.status === status)
  }
  responses.push(new TypeError('offline'))
  await assert.rejects(getMemberSubscriptions(7, { strict: true }), (error) => error.status === 0)
  assert.equal(calls.every((call) => call.method === 'GET'), true)
  assert.equal(calls.some((call) => call.url.includes('/api/members/7/subscriptions')), true)
} finally {
  globalThis.fetch = originalFetch
}
console.log('PASS: Package và subscription dùng dữ liệu cục bộ, giữ trường và phân biệt lỗi 200/401/403/500/mạng')
