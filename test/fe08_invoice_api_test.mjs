import assert from 'node:assert/strict'
import { getInvoices } from '../src/api/invoiceApi.js'
import { mapInvoice } from '../src/api/invoiceMappers.js'

const originalFetch = globalThis.fetch
const requests = []
const replies = []
globalThis.fetch = async (url, options) => {
  requests.push({ url: String(url), options })
  const next = replies.shift()
  if (next instanceof Error) throw next
  return new Response(JSON.stringify(next.body), {
    status: next.status,
    headers: { 'content-type': 'application/json' },
  })
}

try {
  replies.push({ status: 200, body: [{
    invoiceId: 7,
    invoiceCode: 'INV-00007',
    amount: '125000.50',
    paymentMethod: 'VNPay',
    paymentStatus: 'Pending',
    expiresAt: '2026-10-23T10:00:00',
  }] })
  const invoices = await getInvoices({
    status: 'Pending',
    method: 'VNPay',
    keyword: 'member name',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
  }, { notifyForbidden: false })
  assert.equal(invoices[0].amount, 125000.5)
  assert.equal(invoices[0].paymentMethod, 'online')
  assert.equal(invoices[0].paymentStatus, 'pending')
  assert.equal(invoices[0].expiresAt, '2026-10-23T10:00:00')
  assert.match(requests[0].url, /status=Pending/)
  assert.match(requests[0].url, /method=VNPay/)
  assert.match(requests[0].url, /keyword=member\+name/)
  assert.equal(requests[0].options.credentials, 'include')

  for (const status of [400, 401, 403, 404, 409, 500]) {
    replies.push({ status, body: { code: `BE_${status}`, message: `Backend ${status}` } })
    await assert.rejects(
      getInvoices({}, { notifyForbidden: false }),
      (error) => error.status === status && error.code === `BE_${status}` && error.message === `Backend ${status}`,
    )
  }

  replies.push(new Error('connection refused'))
  await assert.rejects(
    getInvoices({}, { notifyForbidden: false }),
    (error) => error.status === 0 && /kết nối/i.test(error.message),
  )

  assert.equal(mapInvoice(null), null, 'Invalid API records must not become placeholder invoices.')
  assert.equal(mapInvoice({}), null, 'Invoices without a backend ID must be discarded.')
  const partial = mapInvoice({ invoiceId: 8 })
  assert.equal(partial.amount, null)
  assert.equal(partial.paymentMethod, null)
  assert.equal(partial.paymentStatus, null)
  assert.equal(partial.code, null)
} finally {
  globalThis.fetch = originalFetch
}

console.log('FE-08 invoice API mock-response checks passed.')
