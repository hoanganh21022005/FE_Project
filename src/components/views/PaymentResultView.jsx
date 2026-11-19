import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, CircleHelp, LoaderCircle, RefreshCw, XCircle } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSCMS } from '../../context/SCMSContext'
import { invoiceApi } from '../../api/invoiceApi'
import { advancedRegistrationApi } from '../../api/advancedRegistrationApi'
import { membershipApi } from '../../api/membershipApi'
import { getAuthoritativeProfileId } from '../../utils/memberSafetyHelpers'
import { getPaymentReturnState } from '../../utils/paymentReturnState'

const destinations = [
  { path: '/member/invoices', vi: 'Hóa đơn của tôi', en: 'My invoices' },
  { path: '/member/enrollments', vi: 'Khóa học của tôi', en: 'My enrollments' },
  { path: '/member/catalog?tier=advanced&sport=tennis', vi: 'Danh mục khóa học', en: 'Course catalog' },
]

const cachedOrderForInvoice = (memberId, invoiceId, invoiceCode) => {
  if (!memberId || typeof window === 'undefined') return null
  try {
    const rows = JSON.parse(window.sessionStorage.getItem(`scms-member-catalog-orders-${memberId}`) || '[]')
    return Array.isArray(rows) ? rows.find((row) =>
      (invoiceId && String(row.invoiceId) === String(invoiceId)) ||
      (!invoiceId && invoiceCode && String(row.invoiceCode) === String(invoiceCode)),
    ) ?? null : null
  } catch { return null }
}

export function PaymentResultView({ language = 'vi', isAuthenticated = false }) {
  const { search } = useLocation()
  const navigate = useNavigate()
  const { currentUser } = useSCMS()
  const params = useMemo(() => new URLSearchParams(search), [search])
  const queryInvoiceCode = params.get('invoiceCode') || params.get('vnp_TxnRef') || ''
  const queryInvoiceId = params.get('invoiceId') || ''
  const responseCode = params.get('status') || params.get('vnp_ResponseCode') || ''
  const isVi = language === 'vi'
  const memberId = getAuthoritativeProfileId(currentUser)
  const [invoiceId, setInvoiceId] = useState(queryInvoiceId)
  const [invoice, setInvoice] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [entitlementError, setEntitlementError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isPopup, setIsPopup] = useState(false)
  const invoiceCode = invoice?.invoiceCode || queryInvoiceCode
  const state = getPaymentReturnState({ invoice, loading, error })

  const checkBackendStatus = useCallback(async () => {
    if (!isAuthenticated || !memberId) {
      setError(isVi ? 'Đăng nhập bằng tài khoản hội viên để xác minh hóa đơn.' : 'Sign in as a member to verify this invoice.')
      return
    }
    setLoading(true)
    setError('')
    setEntitlementError('')
    try {
      let id = invoiceId
      if (!id && queryInvoiceCode) {
        const invoices = await invoiceApi.getMemberOwnInvoices({ strict: true })
        const match = invoices.find((item) => String(item.invoiceCode) === String(queryInvoiceCode))
        id = match?.invoiceId ?? ''
        if (id) setInvoiceId(String(id))
      }
      if (!id) throw new Error(isVi ? 'Không tìm thấy mã hóa đơn để xác minh.' : 'No invoice identifier was found.')
      const currentInvoice = await invoiceApi.getMemberOwnInvoiceById(id)
      if (!currentInvoice) throw new Error(isVi ? 'Backend chưa trả về hóa đơn.' : 'The server did not return an invoice.')
      setInvoice(currentInvoice)
      if (['paid', 'successful'].includes(String(currentInvoice.paymentStatus || '').toLowerCase())) {
        try {
          const [registrations, subscriptions] = await Promise.all([
            advancedRegistrationApi.getMyAdvancedRegistrations(),
            membershipApi.getMemberSubscriptions(memberId, { strict: true, notifyForbidden: false, notifyUnauthorized: false }),
          ])
          const cachedOrder = cachedOrderForInvoice(memberId, id, currentInvoice.invoiceCode || queryInvoiceCode)
          const registration = registrations.find((row) =>
            String(row.invoiceId) === String(id) ||
            (cachedOrder?.registrationId && String(row.id) === String(cachedOrder.registrationId)),
          )
          const subscriptionId = registration?.subscriptionId ?? cachedOrder?.subscriptionId
          const matchedSubscription = subscriptionId == null ? null : subscriptions.find((row) => String(row.subscriptionId) === String(subscriptionId))
          setSubscription(matchedSubscription || null)
        } catch (syncError) {
          setSubscription(null)
          setEntitlementError(syncError?.message || (isVi ? 'Chưa tải được dữ liệu gói học từ Backend.' : 'Could not load subscription data from the server.'))
        }
      } else {
        setSubscription(null)
      }
    } catch (requestError) {
      setError(requestError?.message || (isVi ? 'Không thể xác minh trạng thái hóa đơn.' : 'Could not verify the invoice status.'))
    } finally {
      setLoading(false)
    }
  }, [invoiceId, isAuthenticated, isVi, memberId, queryInvoiceCode])

  useEffect(() => { checkBackendStatus() }, [checkBackendStatus])

  useEffect(() => {
    const opener = window.opener
    if (!opener || opener.closed) return
    setIsPopup(true)
    try {
      // The return query is only a notification to the checkout host; it verifies by GET.
      opener.postMessage({ type: 'SCMS_PAYMENT_COMPLETE', invoiceId: queryInvoiceId, invoiceCode: queryInvoiceCode, status: responseCode }, '*')
    } catch { /* checkout host can still refresh the invoice itself */ }
    try { window.close() } catch { /* receipt remains available if the browser blocks closing */ }
  }, [queryInvoiceCode, queryInvoiceId, responseCode])

  const goTo = (path) => {
    if (!isAuthenticated && typeof window !== 'undefined') {
      window.sessionStorage.setItem('scms_intended_path', `${path}${search}`)
      navigate('/login')
      return
    }
    navigate(`${path}${search}`)
  }

  const paid = state === 'paid' || state === 'reconciliation'
  const active = state === 'paid' && String(subscription?.status || '').toLowerCase() === 'active'
  const Icon = loading ? LoaderCircle : paid ? CheckCircle2 : ['failed', 'cancelled', 'expired'].includes(state) ? XCircle : CircleHelp
  const tone = paid ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : ['failed', 'cancelled', 'expired'].includes(state) ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-900'
  const title = loading ? (isVi ? 'Đang xác minh thanh toán' : 'Verifying payment')
    : state === 'paid' ? (active ? (isVi ? 'Thanh toán thành công · Gói Advanced đang hoạt động' : 'Payment successful · Advanced subscription active') : (isVi ? 'Backend đã xác nhận thanh toán' : 'Payment confirmed by the server'))
      : state === 'reconciliation' ? (isVi ? 'Đã nhận thanh toán, đang đối soát' : 'Payment received; reconciliation is pending')
        : state === 'pending' || state === 'checking' || state === 'unverified' ? (isVi ? 'Đang chờ Backend xác minh' : 'Waiting for server verification')
          : state === 'expired' ? (isVi ? 'Hóa đơn đã hết hạn' : 'Invoice expired')
            : state === 'failed' || state === 'cancelled' ? (isVi ? 'Thanh toán chưa thành công' : 'Payment was not successful')
              : (isVi ? 'Chưa xác minh được hóa đơn' : 'Invoice could not be verified')
  const description = error || (entitlementError && paid && !active ? entitlementError : '') || (state === 'pending' || state === 'checking' || state === 'unverified'
    ? (isVi ? 'Trạng thái bên dưới lấy từ hóa đơn Backend. Bạn có thể kiểm tra lại; hệ thống không tạo đơn mới.' : 'The status below comes from the server invoice. You can check again; no new order will be created.')
    : active
      ? (isVi ? 'Quyền học và thông tin gói được tải từ hồ sơ Subscription của Backend.' : 'Access and subscription details were loaded from the server.')
      : paid
        ? (isVi ? 'Đang chờ Backend đồng bộ gói học; chưa có Subscription Active được xác nhận.' : 'Waiting for the server to sync access; no active subscription has been confirmed yet.')
        : (isVi ? 'Trạng thái thanh toán hiển thị theo hóa đơn Backend.' : 'Payment status is shown from the server invoice.'))

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
    <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/5 sm:p-8" aria-labelledby="payment-result-title">
      <div className={`flex items-start gap-4 rounded-xl border p-4 ${tone}`}>
        <Icon size={28} className={`mt-0.5 shrink-0 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
        <div><h1 id="payment-result-title" className="text-xl font-extrabold">{title}</h1><p className="mt-1 text-sm leading-6">{description}</p></div>
      </div>
      <dl className="mt-6 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <div><dt className="text-slate-500">{isVi ? 'Mã hóa đơn' : 'Invoice code'}</dt><dd className="mt-1 break-all font-semibold text-slate-900">{invoiceCode || (isVi ? 'Chưa có thông tin' : 'Not provided')}</dd></div>
        {(invoiceId || queryInvoiceId) && <div><dt className="text-slate-500">{isVi ? 'Mã giao dịch nội bộ' : 'Invoice ID'}</dt><dd className="mt-1 font-semibold text-slate-900">{invoiceId || queryInvoiceId}</dd></div>}
        {invoice && <>
          <div><dt className="text-slate-500">{isVi ? 'Trạng thái hóa đơn' : 'Invoice status'}</dt><dd className="mt-1 font-semibold text-slate-900">{invoice.paymentStatus}</dd></div>
          {invoice.amount != null && <div><dt className="text-slate-500">{isVi ? 'Số tiền' : 'Amount'}</dt><dd className="mt-1 font-semibold text-slate-900">{Number(invoice.amount).toLocaleString(isVi ? 'vi-VN' : 'en-US')} VND</dd></div>}
        </>}
        {responseCode && <div><dt className="text-slate-500">{isVi ? 'Mã phản hồi VNPay (tham khảo)' : 'VNPay response code (reference)'}</dt><dd className="mt-1 font-semibold text-slate-900">{responseCode}</dd></div>}
        {active && <>
          {subscription.remainingCredit != null && <div><dt className="text-slate-500">{isVi ? 'Credits còn lại' : 'Remaining credits'}</dt><dd className="mt-1 font-semibold text-slate-900">{subscription.remainingCredit}</dd></div>}
          {(subscription.startDate || subscription.activatedAt) && <div><dt className="text-slate-500">{isVi ? 'Ngày bắt đầu' : 'Start date'}</dt><dd className="mt-1 font-semibold text-slate-900">{subscription.startDate || subscription.activatedAt}</dd></div>}
          {(subscription.endDate || subscription.expiresAt) && <div><dt className="text-slate-500">{isVi ? 'Ngày kết thúc' : 'End date'}</dt><dd className="mt-1 font-semibold text-slate-900">{subscription.endDate || subscription.expiresAt}</dd></div>}
        </>}
      </dl>
      {!isPopup && <>
        <button type="button" disabled={loading || !isAuthenticated} onClick={checkBackendStatus} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-violet-300 bg-white px-4 text-sm font-bold text-violet-800 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw size={16} />{isVi ? 'Kiểm tra lại từ Backend' : 'Check again with server'}</button>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">{destinations.map((destination, index) => <button key={destination.path} type="button" onClick={() => goTo(destination.path)} className={index === 0 ? 'min-h-11 rounded-xl bg-violet-700 px-3 text-sm font-bold text-white hover:bg-violet-800' : 'min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50'}>{isVi ? destination.vi : destination.en}</button>)}</div>
      </>}
      {!isAuthenticated && <p className="mt-4 text-center text-xs leading-5 text-slate-500">{isVi ? 'Đăng nhập để xem hóa đơn và trạng thái thanh toán đã đối soát.' : 'Sign in to view your invoice and reconciled payment status.'}</p>}
    </section>
  </main>
}
