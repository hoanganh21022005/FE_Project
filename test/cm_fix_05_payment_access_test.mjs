import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  canConfirmCash,
  canViewInvoices,
  canViewMemberSubscriptions,
  isCashInvoiceConfirmable,
} from '../src/utils/paymentAccess.js'

assert.equal(globalThis.__scmsOfflineTestGuard, true, 'Run with the offline network guard preload.')

const manager = {
  role: 'manager',
  authorities: ['MANAGE_USERS', 'MANAGE_INVOICES'],
}
const receptionist = {
  role: 'receptionist',
  authorities: ['MANAGE_INVOICES', 'MANAGE_SUBSCRIPTIONS'],
}

assert.equal(canViewInvoices(manager), true, 'CenterManager can view invoices with MANAGE_INVOICES.')
assert.equal(canViewInvoices({ role: 'manager', authorities: ['PROCESS_PAYMENT'] }), false)
assert.equal(canConfirmCash(manager), false, 'MANAGE_INVOICES alone does not authorize cash confirmation.')
assert.equal(canConfirmCash({ role: 'receptionist', authorities: [] }), false)
assert.equal(canConfirmCash(receptionist), true, 'Receptionist needs both role and MANAGE_INVOICES.')
assert.equal(canViewMemberSubscriptions(manager), true, 'MANAGE_USERS permits read-only subscription history.')
assert.equal(canViewMemberSubscriptions({ role: 'manager', authorities: ['MANAGE_INVOICES'] }), false)

const pendingCash = {
  paymentStatus: 'pending',
  paymentMethod: 'cash',
  expiresAt: '2026-11-08T12:00:00+07:00',
}
const beforeExpiry = Date.parse('2026-11-08T11:59:00+07:00')
assert.equal(isCashInvoiceConfirmable(pendingCash, beforeExpiry), true)
assert.equal(isCashInvoiceConfirmable({ ...pendingCash, expiresAt: '2026-11-08T12:00:00' }, beforeExpiry), true, 'Offset-free backend times are interpreted in Vietnam time.')
assert.equal(isCashInvoiceConfirmable({ ...pendingCash, paymentStatus: 'successful' }, beforeExpiry), false)
assert.equal(isCashInvoiceConfirmable({ ...pendingCash, paymentStatus: 'expired' }, beforeExpiry), false)
assert.equal(isCashInvoiceConfirmable({ ...pendingCash, paymentMethod: 'online' }, beforeExpiry), false)
assert.equal(isCashInvoiceConfirmable(pendingCash, Date.parse(pendingCash.expiresAt)), false)
assert.equal(isCashInvoiceConfirmable({ ...pendingCash, expiresAt: 'invalid' }, beforeExpiry), false)
assert.equal(isCashInvoiceConfirmable({ ...pendingCash, reconciliationRequired: true }, beforeExpiry), false)

const paymentSource = await readFile(new URL('../src/components/views/PaymentManagement.jsx', import.meta.url), 'utf8')
const memberDetailSource = await readFile(new URL('../src/components/views/MemberDetailView.jsx', import.meta.url), 'utf8')
const receptionSource = await readFile(new URL('../src/components/views/ReceptionPaymentsView.jsx', import.meta.url), 'utf8')
assert.match(paymentSource, /canViewInvoices\(currentUser\)/)
assert.doesNotMatch(paymentSource, /confirmCashPayment|isCashInvoiceConfirmable/)
assert.doesNotMatch(paymentSource, /PaymentModal|Record Payment/)
assert.doesNotMatch(memberDetailSource, /AssignPackageModal|Gán \/ Đăng ký gói mới/)
assert.doesNotMatch(memberDetailSource, /isAssignModalOpen/)
assert.match(receptionSource, /hasCashConfirmationPermission\(currentUser\)/)
assert.match(receptionSource, /isCashInvoiceConfirmable\(confirmingInvoice\)/)

console.log('CM-FIX-05 local permission and invoice eligibility checks passed.')
