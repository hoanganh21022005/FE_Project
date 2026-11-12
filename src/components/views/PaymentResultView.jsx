import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

const destinations = [
  { path: '/member/invoices', vi: 'Hóa đơn của tôi', en: 'My invoices' },
  { path: '/member/enrollments', vi: 'Khóa học của tôi', en: 'My enrollments' },
  { path: '/member/catalog?tier=advanced&sport=tennis', vi: 'Danh mục khóa học', en: 'Course catalog' },
]

export function PaymentResultView({ language = 'vi', isAuthenticated = false }) {
  const { search } = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(search)
  const invoiceCode = params.get('invoiceCode') || params.get('vnp_TxnRef') || ''
  const invoiceId = params.get('invoiceId') || ''
  const status = params.get('status') || params.get('vnp_ResponseCode') || ''
  const [isPopup, setIsPopup] = useState(false)
  const isSuccess = status === '00'
  const isVi = language === 'vi'

  useEffect(() => {
    const opener = window.opener
    if (!opener || opener.closed) return
    setIsPopup(true)
    try {
      opener.postMessage({ type: 'SCMS_PAYMENT_COMPLETE', invoiceId, invoiceCode, status }, '*')
    } catch { /* receipt stays available if opener messaging is restricted */ }
    try { window.close() } catch { /* user can close the receipt manually */ }
  }, [invoiceCode, invoiceId, status])

  const goTo = (path) => {
    if (!isAuthenticated && typeof window !== 'undefined') {
      window.sessionStorage.setItem('scms_intended_path', `${path}${search}`)
      navigate('/login')
      return
    }
    navigate(`${path}${search}`)
  }

  const Icon = isSuccess ? CheckCircle2 : XCircle
  const tone = isSuccess
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-rose-200 bg-rose-50 text-rose-800'

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
    <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/5 sm:p-8" aria-labelledby="payment-result-title">
      <div className={`flex items-start gap-4 rounded-xl border p-4 ${tone}`}>
        <Icon size={28} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <h1 id="payment-result-title" className="text-xl font-extrabold">
            {isSuccess ? (isVi ? 'Thanh toán thành công' : 'Payment successful') : (isVi ? 'Thanh toán thất bại hoặc đã hủy' : 'Payment failed or was cancelled')}
          </h1>
          <p className="mt-1 text-sm leading-6">
            {isSuccess
              ? (isVi ? 'VNPay đã báo giao dịch thành công. Trạng thái hóa đơn sẽ được hệ thống đối soát và cập nhật.' : 'VNPay reported a successful transaction. The invoice status will be reconciled and updated by the system.')
              : (isVi ? 'Giao dịch chưa được xác nhận thành công. Bạn có thể kiểm tra hóa đơn hoặc thử lại từ cổng hội viên.' : 'The transaction was not confirmed as successful. Check your invoice or try again from the member portal.')}
          </p>
        </div>
      </div>

      <dl className="mt-6 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
        <div><dt className="text-slate-500">{isVi ? 'Mã hóa đơn' : 'Invoice code'}</dt><dd className="mt-1 break-all font-semibold text-slate-900">{invoiceCode || (isVi ? 'Chưa có thông tin' : 'Not provided')}</dd></div>
        {invoiceId && <div><dt className="text-slate-500">{isVi ? 'Mã giao dịch nội bộ' : 'Invoice ID'}</dt><dd className="mt-1 font-semibold text-slate-900">{invoiceId}</dd></div>}
        {status && <div><dt className="text-slate-500">{isVi ? 'Mã phản hồi VNPay' : 'VNPay response code'}</dt><dd className="mt-1 font-semibold text-slate-900">{status}</dd></div>}
      </dl>

      {isPopup ? <button type="button" onClick={() => window.close()} className="mt-6 min-h-11 w-full rounded-xl bg-violet-700 px-4 text-sm font-bold text-white hover:bg-violet-800">{isVi ? 'Đóng cửa sổ' : 'Close window'}</button> : <div className="mt-6 grid gap-2 sm:grid-cols-3">
        {destinations.map((destination, index) => <button key={destination.path} type="button" onClick={() => goTo(destination.path)} className={index === 0 ? 'min-h-11 rounded-xl bg-violet-700 px-3 text-sm font-bold text-white hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2' : 'min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2'}>
          {isVi ? destination.vi : destination.en}
        </button>)}
      </div>}
      {!isAuthenticated && <p className="mt-4 text-center text-xs leading-5 text-slate-500">{isVi ? 'Đăng nhập để xem hóa đơn và trạng thái thanh toán đã đối soát.' : 'Sign in to view your invoice and reconciled payment status.'}</p>}
    </section>
  </main>
}
