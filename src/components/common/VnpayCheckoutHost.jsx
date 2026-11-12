import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { invoiceApi } from '../../api/invoiceApi'
import { VNPAY_CHECKOUT_START_EVENT } from '../../utils/vnpayCheckout'

const POLL_INTERVAL_MS = 2500
const POLL_TIMEOUT_MS = 10 * 60 * 1000
const PAID_STATES = new Set(['paid', 'success', 'successful', 'settled', 'completed', 'complete', 'registered'])
const FAILED_STATES = new Set(['failed', 'failure', 'cancelled', 'canceled', 'expired', 'rejected', 'void'])

const normalizeStatus = (value) => String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')

export function VnpayCheckoutHost({ language = 'vi' }) {
  const navigate = useNavigate()
  const [checkout, setCheckout] = useState(null)
  const activeCheckoutRef = useRef(null)
  const isVi = language === 'vi'
  const isViRef = useRef(isVi)

  useEffect(() => { isViRef.current = isVi }, [isVi])

  const stopMonitoring = useCallback((record, closePopup = false) => {
    if (record) record.monitoring = false
    if (record?.intervalId) window.clearInterval(record.intervalId)
    if (record?.messageHandler) window.removeEventListener('message', record.messageHandler)
    if (closePopup) {
      try { record?.popup?.close() } catch { /* popup may already be closed */ }
    }
    if (activeCheckoutRef.current === record) activeCheckoutRef.current = null
  }, [])

  const verifyInvoice = useCallback(async (record) => {
    if (!record || record.verifying || record.finished) return
    record.verifying = true
    try {
      let invoice = record.invoiceId
        ? await invoiceApi.getMemberOwnInvoiceById(record.invoiceId)
        : (await invoiceApi.getMemberOwnInvoices()).find((item) => String(item.invoiceCode) === String(record.invoiceCode))
      if (!record.monitoring || record.finished) return
      if (!invoice) return
      record.invoiceId = invoice.id ?? invoice.invoiceId ?? record.invoiceId
      const status = normalizeStatus(invoice?.paymentStatus ?? invoice?.status)
      const invoiceCode = invoice?.invoiceCode ?? record.invoiceCode
      if (PAID_STATES.has(status)) {
        record.finished = true
        stopMonitoring(record, true)
        try { Promise.resolve(record.onVerified?.(invoice)).catch(() => {}) } catch { /* refresh is best effort */ }
        window.dispatchEvent(new CustomEvent('scms:payment-verified', { detail: { invoiceId: record.invoiceId, invoiceCode, invoice } }))
        const params = new URLSearchParams({ invoiceCode: String(invoiceCode ?? ''), invoiceId: String(record.invoiceId), status: '00' })
        setCheckout(null)
        navigate(`/payment-result?${params.toString()}`)
      } else if (FAILED_STATES.has(status)) {
        record.finished = true
        stopMonitoring(record, true)
        const params = new URLSearchParams({ invoiceCode: String(invoiceCode ?? ''), invoiceId: String(record.invoiceId), status })
        setCheckout(null)
        navigate(`/payment-result?${params.toString()}`)
      } else {
        setCheckout((current) => current?.record === record ? { ...current, status: isViRef.current ? 'Đang chờ xác nhận thanh toán từ VNPay...' : 'Waiting for VNPay payment confirmation...' } : current)
      }
    } catch (error) {
      setCheckout((current) => current?.record === record ? { ...current, error: error?.message || (isViRef.current ? 'Chưa thể kiểm tra hóa đơn. Hệ thống sẽ tiếp tục thử.' : 'Invoice verification failed. Polling will continue.') } : current)
    } finally {
      record.verifying = false
      if (record.reverifyRequested && record.monitoring && !record.finished) {
        record.reverifyRequested = false
        void verifyInvoice(record)
      }
    }
  }, [navigate, stopMonitoring])

  useEffect(() => {
    const onCheckoutStart = (event) => {
      const { paymentUrl, invoiceId, invoiceCode, onVerified, preparedPopup } = event.detail || {}
      if (!paymentUrl) return
      const previous = activeCheckoutRef.current
      if (previous) stopMonitoring(previous, true)

      let popup = null
      try {
        popup = window.open(paymentUrl, 'scms_vnpay_checkout', 'width=980,height=740,noopener=no')
      } catch { /* use same-tab fallback below */ }
      if ((!popup || popup.closed) && preparedPopup && !preparedPopup.closed) {
        popup = preparedPopup
        try { popup.location.assign(paymentUrl) } catch { popup = null }
      }
      if (!popup || popup.closed) {
        window.location.assign(paymentUrl)
        return
      }

      const record = { paymentUrl, invoiceId, invoiceCode, onVerified, popup, startedAt: Date.now(), intervalId: null, messageHandler: null, verifying: false, monitoring: true, finished: false }
      const matchesInvoice = (data) => {
        const idMatches = invoiceId == null || data.invoiceId == null || String(data.invoiceId) === String(invoiceId)
        const codeMatches = !invoiceCode || !data.invoiceCode || String(data.invoiceCode) === String(invoiceCode)
        return idMatches && codeMatches
      }
      record.messageHandler = (messageEvent) => {
        const data = messageEvent?.data
        if (!data || data.type !== 'SCMS_PAYMENT_COMPLETE' || data.status == null || (data.invoiceId == null && !data.invoiceCode) || !matchesInvoice(data)) return
        if (record.verifying) record.reverifyRequested = true
        void verifyInvoice(record)
      }
      window.addEventListener('message', record.messageHandler)
      record.intervalId = window.setInterval(() => {
        if (Date.now() - record.startedAt >= POLL_TIMEOUT_MS) {
          record.monitoring = false
          stopMonitoring(record, false)
          setCheckout((current) => current?.record === record ? { ...current, polling: false, error: isViRef.current ? 'Đã hết thời gian chờ VNPay. Bạn có thể kiểm tra lại hóa đơn.' : 'Payment verification timed out. You can check the invoice again.' } : current)
          return
        }
        void verifyInvoice(record)
      }, POLL_INTERVAL_MS)
      activeCheckoutRef.current = record
      setCheckout({ record, paymentUrl, invoiceId, invoiceCode, polling: true, status: isViRef.current ? 'Đang chờ xác nhận thanh toán từ VNPay...' : 'Waiting for VNPay payment confirmation...', error: '' })
      void verifyInvoice(record)
    }

    window.addEventListener(VNPAY_CHECKOUT_START_EVENT, onCheckoutStart)
    return () => {
      window.removeEventListener(VNPAY_CHECKOUT_START_EVENT, onCheckoutStart)
      stopMonitoring(activeCheckoutRef.current, true)
    }
  }, [stopMonitoring, verifyInvoice])

  if (!checkout) return null

  const reopenPopup = () => {
    try {
      if (!checkout.record.popup || checkout.record.popup.closed) {
        checkout.record.popup = window.open(checkout.paymentUrl, 'scms_vnpay_checkout', 'width=980,height=740,noopener=no')
      } else checkout.record.popup.focus()
    } catch { /* keep the verification controls available */ }
  }

  const checkNow = () => {
    checkout.record.monitoring = true
    void verifyInvoice(checkout.record)
  }
  const cancelMonitoring = () => {
    checkout.record.monitoring = false
    stopMonitoring(checkout.record, false)
    setCheckout((current) => current?.record === checkout.record ? { ...current, polling: false, status: isVi ? 'Đã dừng tự động kiểm tra.' : 'Automatic checking stopped.' } : current)
  }
  const dismiss = () => {
    stopMonitoring(checkout.record, false)
    setCheckout(null)
  }

  return <div className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-xl rounded-2xl border border-violet-200 bg-white p-4 shadow-2xl shadow-slate-950/20 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-full sm:p-5" role="status" aria-live="polite">
    <div className="flex items-start gap-3"><span className="mt-1 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-violet-600" /><div className="min-w-0 flex-1"><p className="font-bold text-slate-950">{checkout.status}</p>{checkout.invoiceCode && <p className="mt-1 truncate text-sm text-slate-600">{isVi ? 'Hóa đơn: ' : 'Invoice: '}{checkout.invoiceCode}</p>}{checkout.error && <p className="mt-2 text-sm text-amber-800">{checkout.error}</p>}</div></div>
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={reopenPopup} className="min-h-10 rounded-lg border border-violet-200 px-3 text-sm font-semibold text-violet-800 hover:bg-violet-50">{isVi ? 'Mở lại cửa sổ thanh toán' : 'Reopen payment window'}</button><button type="button" onClick={checkNow} className="min-h-10 rounded-lg bg-violet-700 px-3 text-sm font-semibold text-white hover:bg-violet-800">{isVi ? 'Kiểm tra trạng thái ngay' : 'Check status now'}</button>{checkout.polling ? <button type="button" onClick={cancelMonitoring} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">{isVi ? 'Dừng kiểm tra' : 'Stop checking'}</button> : <button type="button" onClick={dismiss} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100">{isVi ? 'Đóng' : 'Dismiss'}</button>}</div>
  </div>
}
