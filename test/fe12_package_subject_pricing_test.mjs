import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { getSubjects, getPackages, createPackage, updatePackage, updatePackageStatus } from '../src/api/managerApi.js'
import { mapPackage, mapSubject, toPackageRequest } from '../src/api/mappers.js'
import { buildPackageFormPayload, packageFormFromItem, validatePackageForm } from '../src/api/packageForm.js'
import {
  duplicateSubjectIds,
  isVisibleManagerPackage,
  loadPackageManagementData,
  packagesForType,
  subjectPriceForType,
  subjectsWithNonzeroPrice,
  unclassifiedPackages,
} from '../src/api/packagePricing.js'

const subjects = Array.from({ length: 9 }, (_, index) => mapSubject({
  id: index + 1,
  name: 'Sport ' + (index + 1),
  slug: 'sport-' + (index + 1),
  normalPrice: index === 0 ? 0 : 100000 + index,
  advancedPrice: index === 0 ? null : 200000 + index,
  status: 'ACTIVE',
  outdoor: index % 2 === 0,
}))
const tenth = mapSubject({ id: 10, name: 'Sport 10', slug: 'sport-10', normalPrice: 500000, advancedPrice: 900000 })
const duplicate = mapSubject({ id: 11, name: 'Sport 1', slug: 'sport-11', normalPrice: 1, advancedPrice: 2 })
assert.equal(mapSubject({ id: 12, name: 'No status' }).status, null)
const packages = [
  mapPackage({ id: 21, name: 'Normal 30', packageType: 'Normal', price: 500000, durationDays: 30, totalCredit: null, status: 'ACTIVE' }),
  mapPackage({ id: 22, name: 'Advanced 45', packageType: 'Advanced', price: 700000, durationDays: 45, totalCredit: 12, status: 'ACTIVE' }),
  mapPackage({ id: 23, name: 'Legacy', packageType: null, price: null, durationDays: null, totalCredit: null, status: 'INACTIVE' }),
]
assert.equal(isVisibleManagerPackage({ id: 1, price: 500000 }), false)
assert.equal(isVisibleManagerPackage({ id: '4', price: 1200000 }), false)
assert.equal(isVisibleManagerPackage({ id: 5, price: 3500000 }), false)
assert.equal(isVisibleManagerPackage({ id: 9, price: 300000 }), false)
assert.equal(isVisibleManagerPackage({ id: 10, price: 0 }), true)
assert.equal(isVisibleManagerPackage({ id: 10, price: null }), true)
assert.equal(isVisibleManagerPackage({ id: 10, price: 300000 }), true)

assert.equal(subjects.length, 9)
assert.equal([...subjects, tenth].length, 10)
assert.equal(subjectPriceForType(subjects[1], 'Normal'), 100001)
assert.equal(subjectPriceForType(subjects[1], 'Advanced'), 200001)
assert.equal(subjectPriceForType(subjects[0], 'Normal'), 0)
assert.equal(subjectPriceForType(subjects[0], 'Advanced'), null)
assert.equal(subjectsWithNonzeroPrice(subjects, 'Normal').length, 8)
assert.equal(subjectsWithNonzeroPrice(subjects, 'Advanced').length, 9)
assert.deepEqual(packagesForType(packages, 'Normal').map(item => item.id), [21])
assert.deepEqual(packagesForType(packages, 'Advanced').map(item => item.id), [22])
assert.deepEqual(unclassifiedPackages(packages).map(item => item.id), [23])
assert.deepEqual([...duplicateSubjectIds([...subjects, duplicate])].sort((a, b) => a - b), [1, 11])
assert.equal(duplicateSubjectIds(subjects).size, 0)

const subjectFailure = await loadPackageManagementData({
  getSubjects: async () => { throw new Error('subjects failed') },
  getPackages: async () => packages,
})
assert.equal(subjectFailure.subjects.status, 'rejected')
assert.equal(subjectFailure.packages.status, 'fulfilled')
assert.deepEqual(subjectFailure.packages.value, packages)
const packageFailure = await loadPackageManagementData({
  getSubjects: async () => [...subjects, tenth],
  getPackages: async () => { throw new Error('packages failed') },
})
assert.equal(packageFailure.subjects.status, 'fulfilled')
assert.equal(packageFailure.subjects.value.length, 10)
assert.equal(packageFailure.packages.status, 'rejected')
const arrivals = []
let releasePackages
const delayedPackages = new Promise(resolve => { releasePackages = resolve })
const independentLoad = loadPackageManagementData({
  getSubjects: async () => subjects,
  getPackages: () => delayedPackages,
}, result => arrivals.push('subjects:' + result.status), result => arrivals.push('packages:' + result.status))
await new Promise(resolve => setTimeout(resolve, 0))
assert.deepEqual(arrivals, ['subjects:fulfilled'])
releasePackages(packages)
await independentLoad
assert.deepEqual(arrivals, ['subjects:fulfilled', 'packages:fulfilled'])

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const [{ PackageManagement }, { SCMSContext }] = await Promise.all([
    server.ssrLoadModule('/src/components/views/PackageManagement.jsx'),
    server.ssrLoadModule('/src/context/SCMSContext.jsx'),
  ])
  const render = (value) => renderToStaticMarkup(React.createElement(
    SCMSContext.Provider,
    { value },
    React.createElement(PackageManagement),
  ))
  const mockValue = {
    packages, subjects: [...subjects, tenth, duplicate], apiEnabled: false,
    currentUser: { authorities: [] }, language: 'vi', t: key => key,
    showToast: () => {}, createPackage: async () => {}, updatePackage: async () => {}, updatePackageStatus: async () => {},
  }
  const html = render(mockValue)
  assert.match(html, /role="tablist"/)
  assert.match(html, /aria-selected="true"[^>]*>Normal/)
  assert.match(html, /aria-selected="false"[^>]*>Advanced/)
  assert.equal((html.match(/Học phí Normal/g) || []).length, 10)
  assert.match(html, /Sport 10/)
  assert.doesNotMatch(html, /Trùng tên\/slug/)
  assert.match(html, /Học phí theo môn · Normal/)
  assert.doesNotMatch(html, /Danh sách gói|Gói chưa phân loại|Normal 30|Giá gói thành viên|Tạo gói mới/)
  const noPermissionHtml = render({ ...mockValue, apiEnabled: true })
  assert.doesNotMatch(noPermissionHtml, /Tạo gói mới/)
  assert.doesNotMatch(render({ ...mockValue, apiEnabled: true, currentUser: { authorities: ['MANAGE_PACKAGES'] } }), /Tạo gói mới/)
} finally {
  await server.close()
}

assert.equal(packageFormFromItem(null, { apiMode: true, defaultType: 'Advanced' }).packageType, 'Advanced')
assert.equal(packageFormFromItem(null, { apiMode: true, defaultType: 'Normal' }).packageType, 'Normal')
assert.equal(packageFormFromItem(packages[2], { apiMode: true }).packageType, '')
assert.equal(packageFormFromItem({ id: 'legacy', durationMonths: 3 }).durationDays, '')
assert.equal(packageFormFromItem({ id: 25, name: 'Missing status' }, { apiMode: true }).status, '')
const form = buildPackageFormPayload({
  name: 'Advanced 45', packageType: 'Advanced', durationDays: '45',
  price: '0', status: 'active', totalCredit: '12',
}, 'Benefit A\nBenefit B')
assert.equal(validatePackageForm(form), '')
assert.equal(form.durationDays, 45)
assert.equal(form.totalCredit, 12)
assert.equal(form.price, 0)
assert.equal(validatePackageForm({ ...form, totalCredit: null }).length > 0, true)
assert.equal(validatePackageForm({ ...form, packageType: '' }).length > 0, true)
assert.equal(validatePackageForm({ ...form, status: '' }).length > 0, true)
const dto = toPackageRequest(form)
assert.deepEqual(Object.keys(dto).sort(), ['benefits', 'durationDays', 'name', 'packageType', 'price', 'status', 'totalCredit'].sort())
assert.equal('subjectId' in dto, false)

const originalFetch = globalThis.fetch
const calls = []
const queue = []
globalThis.fetch = async (url, options = {}) => {
  calls.push({ path: new URL(String(url), 'http://localhost').pathname, method: options.method, body: options.body ? JSON.parse(options.body) : null })
  const next = queue.shift()
  if (next instanceof Error) throw next
  return new Response(JSON.stringify(next.body), { status: next.status, headers: { 'content-type': 'application/json' } })
}
try {
  queue.push({ status: 200, body: [...subjects, tenth, duplicate] })
  assert.equal((await getSubjects()).length, 11)
  queue.push({ status: 200, body: packages })
  assert.equal((await getPackages()).length, 3)
  queue.push({ status: 201, body: { id: 24, ...dto, status: 'ACTIVE' } })
  await createPackage(form, { notifyForbidden: false })
  assert.equal(calls.at(-1).path, '/api/packages')
  assert.equal(calls.at(-1).method, 'POST')
  assert.deepEqual(calls.at(-1).body, dto)
  queue.push({ status: 200, body: { id: 24, ...dto, status: 'ACTIVE' } })
  await updatePackage(24, form, { notifyForbidden: false })
  assert.equal(calls.at(-1).path, '/api/packages/24')
  assert.equal(calls.at(-1).method, 'PUT')
  assert.deepEqual(calls.at(-1).body, dto)
  queue.push({ status: 200, body: { id: 24, ...dto, status: 'INACTIVE' } })
  await updatePackageStatus(24, 'INACTIVE', { notifyForbidden: false })
  assert.equal(calls.at(-1).method, 'PATCH')
  assert.deepEqual(calls.at(-1).body, { status: 'INACTIVE' })
  for (const status of [400, 401, 403, 404, 409, 500]) {
    queue.push({ status, body: { message: 'mock error ' + status } })
    await assert.rejects(getPackages({ notifyUnauthorized: false, notifyForbidden: false }), error => error.status === status)
  }
  queue.push(new TypeError('mock network error'))
  await assert.rejects(getSubjects(), error => error.status === 0)
  assert.equal(calls.some(call => call.method === 'DELETE'), false)
  assert.equal(calls.some(call => call.body && 'subjectId' in call.body), false)
  assert.equal(calls.filter(call => call.method === 'POST').length, 1)
} finally {
  globalThis.fetch = originalFetch
}

console.log('FE-12 package subject pricing tests passed')
