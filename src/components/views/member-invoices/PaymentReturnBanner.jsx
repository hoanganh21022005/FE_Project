import { AlertCircle, Receipt, X, CheckCircle2 } from "lucide-react"
import { getPaymentReturnState } from "../../../utils/paymentReturnState"

export function PaymentReturnBanner({
  isVi,
  returnInvoiceCode,
  invoice,
  lookupStatus,
  lookupError,
  verification,
  retrySecondsRemaining,
  onViewReceipt,
  onDismiss,
}) {
  const state = getPaymentReturnState({
    invoice,
    loading: lookupStatus === "loading" || lookupStatus === "idle",
    error: lookupStatus === "error" ? lookupError : "",
  })
  const isPaid = state === "paid"
  const isReconciliation = state === "reconciliation"
  const toneClass = isPaid
    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
    : isReconciliation
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-slate-200 bg-slate-50 text-slate-900"

  const copy = {
    checking: {
      title: isVi
        ? "Đang kiểm tra trạng thái thanh toán"
        : "Checking payment status",
      description: isVi
        ? "Đang lấy trạng thái hóa đơn từ hệ thống. Vui lòng chờ và không thanh toán lại trong lúc kiểm tra."
        : "The invoice status is being retrieved from the system. Please wait and do not pay again while it is being checked.",
    },
    unverified: {
      title: isVi
        ? "Chưa xác minh được thanh toán"
        : "Payment not yet verified",
      description:
        lookupError ||
        (isVi
          ? "Chưa có trạng thái hóa đơn xác nhận từ hệ thống. Vui lòng tải lại hóa đơn hoặc liên hệ trung tâm; đừng thanh toán lại lúc này."
          : "There is no confirmed invoice status from the system yet. Refresh invoices or contact the center; do not pay again yet."),
    },
    paid: {
      title: isVi ? "Hóa đơn đã thanh toán" : "Invoice paid",
      description: isVi
        ? "Hệ thống xác nhận hóa đơn đã thanh toán thành công."
        : "The system confirms that the invoice is paid.",
    },
    reconciliation: {
      title: isVi
        ? "Thanh toán đang cần đối soát"
        : "Payment requires reconciliation",
      description: isVi
        ? "Hệ thống xác nhận hóa đơn đã thanh toán nhưng đang cần đối soát. Chưa thể xác nhận quyền học đã được kích hoạt."
        : "The system reports the invoice as paid but requires reconciliation. Course access activation is not confirmed.",
    },
    pending: {
      title: isVi
        ? "Thanh toán chưa được xác minh"
        : "Payment has not been verified",
      description: isVi
        ? "Hóa đơn hiện vẫn Chờ thanh toán. Có thể giao dịch đang được cập nhật; vui lòng tải lại sau hoặc liên hệ trung tâm. Đừng thanh toán lại lúc này."
        : "The invoice is currently pending. The transaction may still be updating; refresh later or contact the center. Do not pay again yet.",
    },
    expired: {
      title: isVi ? "Hóa đơn đã hết hạn" : "Invoice expired",
      description: isVi
        ? "Hệ thống ghi nhận hóa đơn đã hết hạn. Nếu bạn đã bị trừ tiền, vui lòng liên hệ trung tâm để được kiểm tra."
        : "The system confirms that the invoice has expired. If you were charged, contact the center for a review.",
    },
    failed: {
      title: isVi ? "Ghi nhận thanh toán thất bại" : "Payment failed",
      description: isVi
        ? "Đây là trạng thái hiện được hệ thống xác nhận. Nếu bạn đã bị trừ tiền, vui lòng liên hệ trung tâm."
        : "This is the status currently confirmed by the system. If you were charged, contact the center.",
    },
    cancelled: {
      title: isVi ? "Hóa đơn đã hủy" : "Invoice cancelled",
      description: isVi
        ? "Hệ thống xác nhận hóa đơn đã hủy. Nếu bạn đã bị trừ tiền, vui lòng liên hệ trung tâm."
        : "The system confirms that the invoice was cancelled. If you were charged, contact the center.",
    },
    refunded: {
      title: isVi ? "Khoản thanh toán đã hoàn" : "Payment reversed",
      description: isVi
        ? "Hệ thống ghi nhận khoản thanh toán đã được hoàn."
        : "The system reports that the payment was reversed.",
    },
  }[state]
  const verificationNotice = (() => {
    if (verification?.running) {
      return isVi
        ? "Đang yêu cầu hệ thống đối soát giao dịch. Trạng thái thanh toán vẫn lấy từ hóa đơn hệ thống."
        : "The system is checking this transaction. Payment status still comes from the system invoice."
    }
    if (verification?.error) return verification.error
    switch (verification?.status) {
      case "VERIFIED_PAID":
        return isVi
          ? "Hệ thống đã xác minh giao dịch; hóa đơn đang được tải lại để lấy trạng thái chính thức."
          : "The system verified the transaction; the invoice is being refreshed for its current status."
      case "ALREADY_PAID":
        return isVi
          ? "Hệ thống cho biết giao dịch đã được ghi nhận trước đó; không cần thanh toán lần nữa."
          : "The system reports this transaction was already recorded. Do not pay again."
      case "RETRY_LATER":
        return retrySecondsRemaining > 0
          ? isVi
            ? `Chưa thể kiểm tra lại. Có thể thử lại sau ${retrySecondsRemaining} giây.`
            : `Verification is cooling down. Try again in ${retrySecondsRemaining} seconds.`
          : isVi
            ? "Đã hết thời gian chờ. Nhấn Tải lại để thử xác minh lại giao dịch."
            : "The cooldown has ended. Refresh to check the transaction again."
      case "NOT_CONFIRMED":
        return isVi
          ? "Hệ thống chưa xác nhận được giao dịch. Đây chưa phải kết luận thanh toán thất bại; vui lòng chờ hoặc liên hệ trung tâm, không thanh toán lại lúc này."
          : "The system could not confirm the transaction. This does not mean payment failed; wait or contact the center and do not pay again yet."
      case "QUERY_UNAVAILABLE":
        return isVi
          ? "Kênh truy vấn VNPay hiện chưa khả dụng. Trạng thái hóa đơn được giữ nguyên; vui lòng thử lại sau hoặc liên hệ trung tâm."
          : "The VNPay query channel is unavailable. Invoice status is unchanged; try again later or contact the center."
      case "ATTEMPT_MISSING":
        return isVi
          ? "Không tìm thấy thông tin giao dịch gốc. Hóa đơn cần được trung tâm hỗ trợ đối soát."
          : "The original payment attempt was not found. Contact the center for reconciliation."
      case "DISABLED":
        return isVi
          ? "Chức năng tự động xác minh giao dịch hiện đang tạm đóng. Hãy dùng trạng thái hóa đơn hiện tại hoặc liên hệ trung tâm."
          : "Automated transaction verification is currently paused. Use the current invoice status or contact the center."
      case "VERIFIED_ONLY":
        return isVi
          ? "Có phản hồi xác minh nhưng hóa đơn chưa được xác nhận Đã thanh toán. Quyền học chưa được xác nhận."
          : "A verification response was received, but the invoice is not marked Paid. Course access is not confirmed."
      case "NOT_APPLICABLE":
        return isVi
          ? "Giao dịch không cần xác minh theo trạng thái hiện tại của hóa đơn."
          : "Verification does not apply to the invoice's current status."
      case "UNKNOWN":
        return isVi
          ? "Chưa nhận được kết quả xác minh. Trạng thái hóa đơn hiện tại được giữ nguyên; không thanh toán lại lúc này."
          : "No verification result was received. The current invoice status is unchanged; do not pay again yet."
      default:
        return ""
    }
  })()

  return (
    <section
      role="status"
      className={`rounded-xl border p-4 shadow-xs ${toneClass}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {isPaid ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div>
            <h2 className="text-sm font-extrabold">{copy.title}</h2>
            {returnInvoiceCode && (
              <p className="mt-0.5 text-xs font-semibold opacity-85">
                {isVi ? "Mã hóa đơn / tham chiếu:" : "Invoice / Ref:"}{" "}
                <span className="font-mono">{returnInvoiceCode}</span>
              </p>
            )}
            <p className="mt-1 text-xs leading-5 opacity-90">
              {copy.description}
            </p>
            {verificationNotice && (
              <p className="mt-2 text-xs leading-5 font-semibold" role="status">
                {verificationNotice}
              </p>
            )}
            {isPaid && invoice && (
              <button
                type="button"
                onClick={() => onViewReceipt(invoice)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
              >
                <Receipt className="h-3.5 w-3.5" />
                {isVi ? "Xem biên lai" : "View receipt"}
              </button>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1 opacity-70 hover:bg-black/5 hover:opacity-100 cursor-pointer"
          aria-label={isVi ? "Đóng thông báo" : "Dismiss"}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </section>
  )
}
