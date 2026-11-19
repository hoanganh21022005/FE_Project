import assert from 'node:assert/strict'
import { httpClient } from '../src/api/httpClient.js'
import {
  buildNormalRefundClaimRequest,
  buildNormalRefundReceiverRequest,
  buildNormalRefundSubmission,
  canWorkNormalRefundTransfer,
  claimNormalRefund,
  createNormalRefundClaimRequestId,
  submitNormalRefundReceiver,
  submitNormalRefundTransfer,
  uploadNormalRefundDocument,
} from '../src/api/normalRefundTransferApi.js'
import * as normalRefundApi from '../src/api/normalRefundApi.js'
import * as lifecycleApi from '../src/api/normalClassLifecycleApi.js'
import {
  buildNormalProposalChoiceRequest,
  respondNormalProposal,
  validateNormalProposalChoice,
} from '../src/api/normalProposalResponseApi.js'

const refund = { id: 31, version: 4, amount: 125000 }
const attempt = { id: 22, amount: 125000 }
const proposal = { id: 25, version: 7, fingerprint: 'be-fingerprint-25', status: 'Pending' }
const originalPost = httpClient.post
const originalGet = httpClient.get
const requests = []

httpClient.post = async (path, body, options) => {
  requests.push({ path, body, options })
  if (path.endsWith('/documents')) return 91
  if (path.endsWith('/claim') || path.endsWith('/submit')) return { id: 22, status: 'Claimed' }
  if (path.includes('/normal-proposals/')) return { ...proposal, status: 'Pending' }
  return { id: 31, version: 5 }
}
httpClient.get = async (path) => ({ id: Number(path.split('/').pop()), version: 4 })

try {
  // Member: khai tài khoản nhận
  assert.deepEqual(
    buildNormalRefundReceiverRequest(refund, { bank: ' Example Bank ', accountNumber: 'AB12345678', accountName: ' Nguyen Van A ' }),
    { version: 4, bank: 'Example Bank', accountNumber: 'AB12345678', accountName: 'Nguyen Van A' },
  )
  for (const bad of [
    { bank: '', accountNumber: 'AB12345678', accountName: 'A' },
    { bank: 'B', accountNumber: 'AB1', accountName: 'A' },
    { bank: 'B', accountNumber: 'AB 12345', accountName: 'A' },
    { bank: 'B', accountNumber: 'AB12345678', accountName: 'x'.repeat(151) },
    { bank: 'B', accountNumber: 'AB12345678', accountName: 'A', note: 'extra' },
  ]) assert.throws(() => buildNormalRefundReceiverRequest(refund, bad))
  assert.throws(() => buildNormalRefundReceiverRequest({ id: 31 }, { bank: 'B', accountNumber: 'AB12345678', accountName: 'A' }), /version/)
  await submitNormalRefundReceiver(refund, { bank: 'Example Bank', accountNumber: 'AB12345678', accountName: 'A' })
  assert.deepEqual(requests.at(-1), {
    path: '/api/normal-refunds/31/receiver',
    body: { version: 4, bank: 'Example Bank', accountNumber: 'AB12345678', accountName: 'A' },
    options: undefined,
  })
  // Truyền mã thay vì object thì tải lại bản mới nhất để lấy version.
  await submitNormalRefundReceiver(31, { bank: 'B', accountNumber: 'AB12345678', accountName: 'A' })
  assert.equal(requests.at(-1).body.version, 4)

  // Lễ tân: nhận việc
  const requestId = createNormalRefundClaimRequestId()
  assert.match(requestId, /^[0-9a-f-]{36}$/)
  assert.deepEqual(buildNormalRefundClaimRequest(refund, requestId), { version: 4, requestId })
  assert.throws(() => buildNormalRefundClaimRequest(refund, 'not-a-uuid'), /UUID/)
  await claimNormalRefund(refund, { requestId })
  assert.deepEqual(requests.at(-1), { path: '/api/normal-refunds/31/claim', body: { version: 4, requestId }, options: undefined })
  await assert.rejects(() => claimNormalRefund(refund, { requestId, version: 9 }), /Unsupported request field/)

  // Lễ tân: tải chứng từ
  const png = new File([new Uint8Array([137, 80, 78, 71])], 'receipt.png', { type: 'image/png' })
  assert.equal(await uploadNormalRefundDocument(31, 22, png), 91)
  const upload = requests.at(-1)
  assert.equal(upload.path, '/api/normal-refunds/31/attempts/22/documents')
  assert.ok(upload.body instanceof FormData)
  assert.equal(upload.body.get('file').name, 'receipt.png')
  await assert.rejects(() => uploadNormalRefundDocument(31, 22, new File(['x'], 'a.gif', { type: 'image/gif' })), (e) => e.code === 'DOCUMENT_TYPE_INVALID')
  await assert.rejects(() => uploadNormalRefundDocument(31, 22, new File([], 'empty.pdf', { type: 'application/pdf' })), (e) => e.code === 'DOCUMENT_SIZE_INVALID')
  await assert.rejects(() => uploadNormalRefundDocument(31, 22, new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.pdf', { type: 'application/pdf' })), (e) => e.code === 'DOCUMENT_SIZE_INVALID')
  await assert.rejects(() => uploadNormalRefundDocument(31, 22, 'not a file'), (e) => e.code === 'DOCUMENT_REQUIRED')

  // Lễ tân: nộp kết quả chuyển khoản
  const submission = { reference: ' BANK-REF-22 ', amount: 125000, currency: 'VND', performedAt: '2026-11-16T10:30:00' }
  assert.deepEqual(buildNormalRefundSubmission(submission, attempt), { reference: 'BANK-REF-22', amount: 125000, currency: 'VND', performedAt: '2026-11-16T10:30:00' })
  assert.equal(buildNormalRefundSubmission({ reference: 'R', amount: 1, performedAt: '2026-11-16T10:30' }).currency, 'VND')
  for (const bad of [
    { ...submission, amount: 100 },
    { ...submission, amount: '125000' },
    { ...submission, currency: 'USD' },
    { ...submission, performedAt: '2026-11-16T10:30:00Z' },
    { ...submission, performedAt: '2026-11-16T10:30:00+07:00' },
    { ...submission, performedAt: 'yesterday' },
    { ...submission, reference: '  ' },
    { ...submission, extra: 1 },
  ]) assert.throws(() => buildNormalRefundSubmission(bad, attempt))
  await submitNormalRefundTransfer(31, 22, submission, { attempt })
  assert.deepEqual(requests.at(-1), {
    path: '/api/normal-refunds/31/attempts/22/submit',
    body: { reference: 'BANK-REF-22', amount: 125000, currency: 'VND', performedAt: '2026-11-16T10:30:00' },
    options: {},
  })
  assert.equal(canWorkNormalRefundTransfer({ role: 'Receptionist', authorities: ['MANAGE_INVOICES'] }), true)
  assert.equal(canWorkNormalRefundTransfer({ role: 'Receptionist', authorities: [] }), false)
  assert.equal(canWorkNormalRefundTransfer({ role: 'CenterManager', authorities: ['MANAGE_INVOICES'] }), false)

  // Member: phản hồi đề xuất
  assert.deepEqual(buildNormalProposalChoiceRequest(proposal, 'Accept'), { version: 7, fingerprint: 'be-fingerprint-25', choice: 'Accept' })
  assert.deepEqual(buildNormalProposalChoiceRequest(proposal, 'Refund').choice, 'Refund')
  for (const bad of ['accept', 'Waiting', '', undefined, 'Transfer']) {
    assert.throws(() => buildNormalProposalChoiceRequest(proposal, bad), (e) => e.code === 'NORMAL_CHOICE_INVALID')
  }
  assert.throws(() => buildNormalProposalChoiceRequest({ ...proposal, version: undefined }, 'Accept'), /version/)
  assert.throws(() => buildNormalProposalChoiceRequest({ ...proposal, fingerprint: '' }, 'Accept'), /fingerprint/)
  assert.throws(() => validateNormalProposalChoice({ version: 7, fingerprint: 'x', choice: 'Accept', reason: 'no' }), /Unsupported request field/)
  const result = await respondNormalProposal(25, buildNormalProposalChoiceRequest(proposal, 'Accept'))
  assert.equal(result.id, 25)
  assert.deepEqual(requests.at(-1), {
    path: '/api/normal-proposals/25/respond',
    body: { version: 7, fingerprint: 'be-fingerprint-25', choice: 'Accept' },
    options: undefined,
  })
  assert.throws(() => respondNormalProposal(0, { version: 7, fingerprint: 'x', choice: 'Accept' }), /proposalId/)

  // Hai module cũ (luồng Manager) không bị đổi: vẫn không có API của Member/Lễ tân.
  for (const name of ['claimNormalRefund', 'submitNormalRefundAttempt', 'uploadNormalRefundDocument', 'submitNormalRefundReceiver']) {
    assert.equal(name in normalRefundApi, false, name)
  }
  assert.equal('respondNormalProposal' in lifecycleApi, false)
  console.log('PASS: Member refund receiver, Receptionist claim/upload/submit and Member proposal response contracts.')
} finally {
  httpClient.post = originalPost
  httpClient.get = originalGet
}
