import assert from 'node:assert/strict'
import {
  mapClass,
  mapDashboard,
  mapPackage,
  mapRoom,
  mapSubject,
  toClassRequest,
  toPackageRequest,
} from '../src/api/mappers.js'

globalThis.window = {
  localStorage: {
    getItem: () => JSON.stringify({
      17: { room: 'Invented room', price: 999999, selectedDays: [1, 3, 5] },
    }),
  },
}

const classDto = {
  id: 17,
  name: 'Badminton foundations',
  subjectId: 4,
  subjectName: 'Badminton',
  coachId: 8,
  coachName: 'Coach A',
  maxCapacity: 0,
  tuitionFee: 0,
  startDate: '2026-10-22',
  endDate: null,
  status: 'Open',
  enrolledCount: 0,
  classType: 'Normal',
  totalSessions: 0,
}
const mappedClass = mapClass(classDto, { apiMode: true })
assert.equal(mappedClass.id, 17)
assert.equal(mappedClass.subjectId, 4)
assert.equal(mappedClass.subjectName, 'Badminton')
assert.equal(mappedClass.coachName, 'Coach A')
assert.equal(mappedClass.capacity, 0)
assert.equal(mappedClass.price, 0)
assert.equal(mappedClass.sessionCount, 0)
assert.equal(mappedClass.endDate, null)
assert.equal(mappedClass.room, null)
assert.equal(mappedClass.startTime, null)
assert.equal(mappedClass.selectedDays, null)
assert.equal(mappedClass.coachSpecialty, null)

const nullableClass = mapClass({ ...classDto, maxCapacity: null, tuitionFee: null, totalSessions: null, enrolledCount: null, subjectName: null, coachName: null }, { apiMode: true })
assert.equal(nullableClass.capacity, null)
assert.equal(nullableClass.price, null)
assert.equal(nullableClass.sessionCount, null)
assert.equal(nullableClass.enrolledCount, null)
assert.equal(nullableClass.category, null)
assert.equal(nullableClass.coachName, null)

assert.equal(mapRoom({ id: 2, name: 'Court Alpha', location: 'North', capacity: null, status: 'Available', facilityType: 'COURT', outdoor: true }).name, 'Court Alpha')
assert.equal(mapRoom({ id: 2, name: 'Court Alpha', capacity: null, status: 'Available', facilityType: 'COURT', outdoor: true }).capacity, null)
assert.equal(mapRoom({ id: 2, name: 'Studio', facilityType: 'STUDIO', outdoor: false }).outdoor, false)
assert.equal(mapRoom({ id: 2, name: 'Studio', facilityType: 'STUDIO', outdoor: false }).facilityType, 'STUDIO')
assert.equal(mapRoom({ id: 2, name: 'Unknown room' }).outdoor, null)

const normalPackage = mapPackage({ id: 3, name: 'Normal', durationDays: 30, price: 0, packageType: 'Normal', totalCredit: 12, status: 'Active' })
assert.equal(normalPackage.price, 0)
assert.equal(normalPackage.packageType, 'Normal')
assert.equal(normalPackage.totalCredit, 12)
const advancedPackage = mapPackage({ id: 4, name: 'Advanced', durationDays: null, price: null, packageType: 'Advanced', totalCredit: null, status: 'Active' })
assert.equal(advancedPackage.durationDays, null)
assert.equal(advancedPackage.price, null)
assert.equal(advancedPackage.packageType, 'Advanced')
assert.equal(advancedPackage.totalCredit, null)
assert.deepEqual(toPackageRequest({ ...normalPackage, durationDays: 30 }), {
  name: 'Normal', durationDays: 30, price: 0, benefits: '', status: 'active', packageType: 'Normal', totalCredit: 12,
})

const dashboard = mapDashboard({ totalUsers: '10', totalMembers: 0, totalClasses: '4', totalPackages: 2, totalRevenue: '12345', totalInvoices: 0, activeSubscriptions: 3, todaySessions: '1' })
assert.deepEqual(dashboard, { totalUsers: 10, totalMembers: 0, totalClasses: 4, totalPackages: 2, totalRevenue: 12345, totalInvoices: 0, activeSubscriptions: 3, todaySessions: 1 })
assert.equal(mapDashboard({ totalUsers: null }).totalUsers, null)

const subject = mapSubject({ id: 9, name: 'Tennis', normalPrice: 0, advancedPrice: 250000, outdoor: false, slug: 'tennis', status: 'Active' })
assert.equal(subject.normalPrice, 0)
assert.equal(subject.advancedPrice, 250000)
assert.equal(subject.outdoor, false)
assert.equal(subject.slug, 'tennis')

assert.equal(toClassRequest({ ...mappedClass, status: 'draft' }).status, undefined)
assert.equal(toClassRequest({ ...mappedClass, status: 'completed' }).status, 'Closed')
assert.equal(toClassRequest({ ...mappedClass, apiStatus: 'Open' }).status, 'Open')

console.log('FE-04 mapper tests passed')
