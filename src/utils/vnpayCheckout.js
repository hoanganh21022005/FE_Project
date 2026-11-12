export const VNPAY_CHECKOUT_START_EVENT = 'scms:vnpay-checkout:start'
const POPUP_NAME = 'scms_vnpay_checkout'
const POPUP_FEATURES = 'width=980,height=740,noopener=no'

export function getVnpayReturnContext() {
  if (typeof window === 'undefined') return {}
  return {
    returnUrl: `${window.location.origin}/payment-result`,
    clientOrigin: window.location.origin,
  }
}

export function prepareVnpayCheckoutPopup() {
  if (typeof window === 'undefined') return null
  try { return window.open('', POPUP_NAME, POPUP_FEATURES) } catch { return null }
}

export function closePreparedVnpayPopup(popup) {
  try { popup?.close() } catch { /* popup may already be closed */ }
}

export function startVnpayCheckout({ paymentUrl, invoiceId, invoiceCode, onVerified, popup: preparedPopup } = {}) {
  if (typeof window === 'undefined' || !paymentUrl) return false
  window.dispatchEvent(new CustomEvent(VNPAY_CHECKOUT_START_EVENT, {
    detail: { paymentUrl, invoiceId: invoiceId ?? null, invoiceCode: invoiceCode ?? null, onVerified, preparedPopup },
  }))
  return true
}
