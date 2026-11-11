import assert from 'node:assert/strict'
import { getMemberReport, getRevenueReport } from '../src/api/managerApi.js'
import { mapDashboard, mapMemberReport, mapRevenueReport } from '../src/api/mappers.js'
import { revenueSummaryCsvRows, revenueTimelineForDisplay, serializeCsvRows } from '../src/api/reportUtils.js'

const dashboard = mapDashboard({
  totalUsers: 0,
  totalMembers: 0,
  totalClasses: 2,
  totalPackages: 3,
  totalRevenue: 0,
  totalInvoices: 0,
  activeSubscriptions: 0,
  todaySessions: 4,
})
assert.deepEqual(dashboard, {
  totalUsers: 0,
  totalMembers: 0,
  totalClasses: 2,
  totalPackages: 3,
  totalRevenue: 0,
  totalInvoices: 0,
  activeSubscriptions: 0,
  todaySessions: 4,
})
assert.equal(mapDashboard({ totalRevenue: null }).totalRevenue, null)

const dailyRevenue = mapRevenueReport({
  totalRevenue: '180000',
  moneyReceived: '165000.50',
  moneyRefunded: '15000',
  netReceived: '150000.50',
  cashCorrectionsRecorded: '2500',
  totalTransactions: 2,
  averageTransactionValue: '75000.25',
  revenueByPackage: [{ packageId: 4, packageName: 'Advanced', count: 2, totalRevenue: 150000.5 }],
  revenueByMethod: [{ method: 'Cash', count: 1, totalRevenue: 50000 }, { method: 'Transfer', count: 1, totalRevenue: 100000.5 }],
  timeline: [{ period: '2026-10-21', revenue: 150000.5, count: 2 }],
})
assert.equal(dailyRevenue.totalRevenue, 180000)
assert.equal(dailyRevenue.moneyReceived, 165000.5)
assert.equal(dailyRevenue.moneyRefunded, 15000)
assert.equal(dailyRevenue.netReceived, 150000.5)
assert.equal(dailyRevenue.cashCorrectionsRecorded, 2500)
assert.equal(dailyRevenue.totalTransactions, 2)
assert.equal(dailyRevenue.averageTransactionValue, 75000.25)
assert.equal(dailyRevenue.revenueByPackage[0].packageName, 'Advanced')
assert.equal(dailyRevenue.revenueByMethod[1].method, 'Transfer')
assert.equal(dailyRevenue.timeline[0].period, '2026-10-21')

const emptyRevenue = mapRevenueReport({
  totalRevenue: 0,
  moneyReceived: 0,
  moneyRefunded: 0,
  netReceived: 0,
  cashCorrectionsRecorded: 0,
  totalTransactions: 0,
  averageTransactionValue: 0,
  revenueByPackage: [],
  revenueByMethod: [],
  timeline: [{ period: '2026-09', revenue: 0, count: 0 }],
})
assert.equal(emptyRevenue.totalTransactions, 0)
assert.equal(emptyRevenue.moneyReceived, 0)
assert.equal(emptyRevenue.moneyRefunded, 0)
assert.equal(emptyRevenue.netReceived, 0)
assert.equal(emptyRevenue.cashCorrectionsRecorded, 0)
assert.equal(emptyRevenue.timeline.length, 1, 'The view must suppress a default timeline row when there are no transactions.')
assert.deepEqual(revenueTimelineForDisplay(emptyRevenue), [])
assert.deepEqual(revenueTimelineForDisplay(dailyRevenue), dailyRevenue.timeline)
assert.deepEqual(mapRevenueReport({ totalRevenue: null, totalTransactions: null }).timeline, [])

const nullMoneyFields = mapRevenueReport({
  totalRevenue: null,
  moneyReceived: null,
  moneyRefunded: null,
  netReceived: null,
  cashCorrectionsRecorded: null,
})
assert.equal(nullMoneyFields.totalRevenue, null)
assert.equal(nullMoneyFields.moneyReceived, null)
assert.equal(nullMoneyFields.moneyRefunded, null)
assert.equal(nullMoneyFields.netReceived, null)
assert.equal(nullMoneyFields.cashCorrectionsRecorded, null)
assert.deepEqual(revenueSummaryCsvRows(emptyRevenue), [
  ['totalRevenue', 0],
  ['moneyReceived', 0],
  ['moneyRefunded', 0],
  ['netReceived', 0],
  ['cashCorrectionsRecorded', 0],
])
assert.deepEqual(revenueSummaryCsvRows(nullMoneyFields), [
  ['totalRevenue', null],
  ['moneyReceived', null],
  ['moneyRefunded', null],
  ['netReceived', null],
  ['cashCorrectionsRecorded', null],
])
const csvWithZeroAndNull = serializeCsvRows([
  ['moneyRefunded', emptyRevenue.moneyRefunded],
  ['netReceived', nullMoneyFields.netReceived],
])
assert.match(csvWithZeroAndNull, /"moneyRefunded","0"/)
assert.match(csvWithZeroAndNull, /"netReceived","null"/)
assert.notEqual(dailyRevenue.totalRevenue, dailyRevenue.netReceived, 'Keep totalRevenue independent from netReceived; OpenAPI defines both without a formula.')

const memberReport = mapMemberReport({
  totalMembers: 5,
  activeMembers: 2,
  expiredMembers: 3,
  packageDistribution: [{ packageName: 'Normal', memberCount: 2 }],
  monthlyGrowth: [{ month: '2026-10', count: 3 }],
})
assert.equal(memberReport.expiredMembers, 3)
assert.equal(memberReport.packageDistribution[0].memberCount, 2)
assert.equal(memberReport.monthlyGrowth[0].month, '2026-10')
assert.deepEqual(mapMemberReport({ monthlyGrowth: null }).monthlyGrowth, [])

const originalFetch = globalThis.fetch
const requests = []
const replies = []
globalThis.fetch = async (url, options) => {
  requests.push({ url: String(url), options })
  const reply = replies.shift()
  return new Response(JSON.stringify(reply.body), {
    status: reply.status,
    headers: { 'content-type': 'application/json' },
  })
}

try {
  replies.push({ status: 200, body: {
    ...emptyRevenue,
    totalRevenue: 140,
    moneyReceived: 125,
    moneyRefunded: 20,
    netReceived: 105,
    cashCorrectionsRecorded: null,
    timeline: [{ period: '2026-10-22', revenue: 0, count: 0 }],
  } })
  const filtered = await getRevenueReport({ startDate: '2026-10-01', endDate: '2026-10-22', groupBy: 'day' }, { notifyForbidden: false })
  assert.equal(requests.at(-1).url, 'https://scms-app-p1gy.onrender.com/api/reports/revenue?startDate=2026-10-01&endDate=2026-10-22&groupBy=day')
  assert.equal(filtered.timeline[0].period, '2026-10-22')
  assert.equal(filtered.totalRevenue, 140)
  assert.equal(filtered.moneyReceived, 125)
  assert.equal(filtered.moneyRefunded, 20)
  assert.equal(filtered.netReceived, 105)
  assert.equal(filtered.cashCorrectionsRecorded, null)

  replies.push({ status: 200, body: emptyRevenue })
  const monthly = await getRevenueReport({ groupBy: 'month' }, { notifyForbidden: false })
  assert.match(requests.at(-1).url, /\/api\/reports\/revenue\?groupBy=month$/)
  assert.equal(monthly.totalTransactions, 0)

  replies.push({ status: 403, body: { message: 'Revenue permission required' } })
  replies.push({ status: 200, body: { totalMembers: 1, activeMembers: 1, expiredMembers: 0, packageDistribution: [], monthlyGrowth: [] } })
  const [revenueResult, memberResult] = await Promise.allSettled([
    getRevenueReport({ groupBy: 'month' }, { notifyForbidden: false }),
    getMemberReport({ notifyForbidden: false }),
  ])
  assert.equal(revenueResult.status, 'rejected')
  assert.equal(revenueResult.reason.status, 403)
  assert.equal(memberResult.status, 'fulfilled')
  assert.equal(memberResult.value.totalMembers, 1)

  replies.push({ status: 200, body: { totalRevenue: 1, totalTransactions: 1, timeline: [{ period: '2026-10', revenue: 1, count: 1 }] } })
  replies.push({ status: 403, body: { message: 'Member permission required' } })
  const [revenueSuccess, memberFailure] = await Promise.allSettled([
    getRevenueReport({ groupBy: 'month' }, { notifyForbidden: false }),
    getMemberReport({ notifyForbidden: false }),
  ])
  assert.equal(revenueSuccess.status, 'fulfilled')
  assert.equal(memberFailure.status, 'rejected')
  assert.equal(memberFailure.reason.status, 403)
  assert.equal(requests.at(-1).url, 'https://scms-app-p1gy.onrender.com/api/reports/members')

  replies.push({ status: 200, body: { monthlyGrowth: [] } })
  assert.deepEqual((await getMemberReport({ notifyForbidden: false })).monthlyGrowth, [])
} finally {
  globalThis.fetch = originalFetch
}

console.log('FE-07 report tests passed')
