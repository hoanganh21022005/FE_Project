import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Download, Eye, EyeOff, FileClock, RefreshCw, Search, X } from 'lucide-react'
import { useSCMS } from '../../context/SCMSContext'
import {
  approveNormalRefund,
  canActOnNormalRefund,
  canReviewNormalRefund,
  getNormalRefundById,
  getNormalRefundDocument,
  getNormalRefundError,
  getNormalRefundHistory,
  getNormalRefunds,
  recordNormalRefundIssue,
  requestNormalRefundInformation,
  verifyNormalRefundAttempt,
  serializeNormalRefundPerformedAt,
  verifyNormalRefundReceiver,
} from '../../api/normalRefundApi.js'
import { normalRefundOriginLabel } from '../../utils/normalRefundLabels.js'

const textOrMissing = (value) => value === null || value === undefined || value === '' ? 'Chưa có thông tin' : String(value)
const dateOrMissing = (value) => {
  if (value === null || value === undefined || value === '') return 'Chưa có thông tin'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Chưa có thông tin' : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }).format(date)
}
const moneyOrMissing = (value) => {
  if (value === null || value === undefined || value === '') return 'Chưa có thông tin'
  const amount = Number(value)
  return Number.isFinite(amount) ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount) : 'Chưa có thông tin'
}
const attemptStatusLabel = (value) => ({ Claimed: 'Đã nhận xử lý', Submitted: 'Đã ghi nhận chuyển khoản', Verified: 'Đã đối soát thành công', Failed: 'Thất bại', Reversed: 'Đã hoàn ngược', Pending: 'Đang chờ xác minh' }[value] || textOrMissing(value))
const outcomeLabel = (value) => ({ Success: 'Đã chuyển thành công', Pending: 'Đang chờ xác nhận ngân hàng', Failed: 'Chuyển khoản thất bại', Reversed: 'Giao dịch đã bị hoàn ngược' }[value] || value)
const refundStatusLabel = (value) => ({ AwaitingReceiver: 'Chờ hội viên cung cấp người nhận', AwaitingApproval: 'Chờ duyệt người nhận', Approved: 'Đã duyệt, chờ chuyển khoản', Processing: 'Đang xử lý chuyển khoản', AwaitingVerification: 'Chờ đối soát', NeedsReview: 'Cần kiểm tra thêm', Completed: 'Đã hoàn tiền', Cancelled: 'Đã hủy' }[value] || textOrMissing(value))
const refundStatusDescription = (value) => ({
  AwaitingReceiver: 'Đang chờ hội viên cung cấp thông tin tài khoản nhận tiền. Chưa thể duyệt hoặc chuyển khoản.',
  AwaitingApproval: 'Đã có thông tin người nhận; đang chờ Center Manager xác minh và phê duyệt.',
  Approved: 'Thông tin người nhận đã được duyệt; đang chờ Lễ tân nhận việc chuyển tiền.',
  Processing: 'Lễ tân đang xử lý chuyển khoản. Sau khi ghi nhận giao dịch, hồ sơ sẽ chờ đối soát.',
  AwaitingVerification: 'Giao dịch đã được Lễ tân ghi nhận; Center Manager cần đối chiếu với ngân hàng.',
  NeedsReview: 'Hồ sơ cần được kiểm tra thêm. Xem ghi chú và lịch sử xử lý bên dưới.',
  Completed: 'Ngân hàng đã được đối chiếu và khoản hoàn tiền đã hoàn tất.',
})[value] || ''
const overdueLabel = (value, hasDeadline) => !hasDeadline ? 'Chưa áp dụng — chưa có hạn hoàn' : value === true ? 'Quá hạn' : value === false ? 'Chưa quá hạn' : 'Chưa xác định'
const receiverVerifiedLabel = (refund) => refund?.receiverId == null ? 'Hội viên chưa cung cấp thông tin người nhận' : refund.receiverVerified === true ? 'Đã xác minh' : 'Chưa xác minh'
const errorText = (error) => {
  if (error?.status === 401) return 'Phiên đăng nhập hết hạn. Hãy đăng nhập lại.'
  if (error?.status === 403) return 'Tài khoản không có quyền xem hồ sơ hoàn tiền.'
  if (error?.status === 404) return 'Hồ sơ hoặc dữ liệu yêu cầu không còn tồn tại.'
  if (error?.status >= 500) return 'Máy chủ chưa thể xử lý yêu cầu. Hãy tải lại sau.'
  if (error?.status === 0) return 'Không thể kết nối máy chủ. Chưa thể xác định trạng thái dữ liệu.'
  return 'Không thể tải dữ liệu hoàn tiền. Hãy thử lại.'
}
const fieldClass = 'text-sm text-slate-900 break-words'

function InfoField({ label, children }) {
  return <div className="min-w-0 rounded border border-slate-200 bg-white p-3"><div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className={fieldClass}>{children}</div></div>
}

const mutationErrorText = (error) => {
  const normalized = getNormalRefundError(error)
  const messages = {
    NORMAL_REFUND_MANAGER_ACCESS_REQUIRED: 'Thao tác yêu cầu Center Manager đang đăng nhập, trạng thái Active và quyền MANAGE_INVOICES trong cùng trung tâm.',
    REFUND_VERSION_STALE: 'Hồ sơ đã thay đổi. Dữ liệu mới đã được tải lại; hãy kiểm tra trước khi thao tác tiếp.',
    RECEIVER_VERIFICATION_REQUIRED: 'Cần xác minh người nhận trước khi phê duyệt.',
    TRANSFER_DOCUMENT_REQUIRED: 'Chưa có chứng từ chuyển khoản hợp lệ để đối soát.',
    BANK_VERIFICATION_MISMATCH: 'Thông tin đối soát không khớp với dữ liệu hồ sơ hoặc lần chuyển khoản.',
    BANK_OUTCOME_INVALID: 'Kết quả đối soát không hợp lệ.',
  }
  if (messages[normalized.code]) return messages[normalized.code]
  if (normalized.status === 401) return 'Phiên đăng nhập hết hạn. Hãy đăng nhập lại.'
  if (normalized.status === 403) return 'Tài khoản không có quyền thực hiện thao tác trong trung tâm này.'
  if (normalized.status === 404) return 'Hồ sơ hoàn tiền hoặc lần chuyển khoản không còn tồn tại.'
  if (normalized.status === 409) return 'Hồ sơ đã thay đổi hoặc có xung đột. Đã yêu cầu tải lại dữ liệu; không gửi lại thao tác.'
  if (normalized.status === 0 || normalized.status >= 500) return 'Chưa xác định được kết quả ghi. Đang đọc lại hồ sơ; không tự gửi lại thao tác.'
  if (normalized.status === 400) return 'Dữ liệu hoặc điều kiện chưa hợp lệ. Vui lòng kiểm tra lại hồ sơ và thông tin đã nhập.'
  return 'Thao tác chưa thành công. Dữ liệu hồ sơ chưa được thay đổi.'
}

function NormalRefundActions({ refund, currentUser, onRefresh }) {
  const [action, setAction] = useState('')
  const [note, setNote] = useState('')
  const [source, setSource] = useState('')
  const [outcome, setOutcome] = useState('')
  const [bankSource, setBankSource] = useState('')
  const [reference, setReference] = useState('')
  const [amount, setAmount] = useState('')
  const [performedAt, setPerformedAt] = useState('')
  const [independentBankCheckConfirmed, setIndependentBankCheckConfirmed] = useState(false)
  const [verifiedDocumentIds, setVerifiedDocumentIds] = useState([])
  const [selectedAttemptId, setSelectedAttemptId] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [refreshWarning, setRefreshWarning] = useState('')

  const permitted = canActOnNormalRefund(currentUser, refund)
  const attempts = Array.isArray(refund?.attempts) ? refund.attempts : []
  const selectedAttempt = attempts.find((attempt) => String(attempt?.id) === String(selectedAttemptId))
  const successEvidenceReady = outcome !== 'Success' || (
    String(selectedAttempt?.status || '').trim().toLowerCase() === 'submitted'
    && independentBankCheckConfirmed
    && Array.isArray(selectedAttempt?.documentIds)
    && selectedAttempt.documentIds.some((id) => verifiedDocumentIds.includes(id))
  )

  const chooseAction = (nextAction) => {
    setAction(nextAction)
    setNote('')
    setSource('')
    setErrorMessage('')
    setNotice('')
    setRefreshWarning('')
    setVerifiedDocumentIds([])
    setIndependentBankCheckConfirmed(false)
    if (nextAction === 'verifyAttempt') setSelectedAttemptId('')
  }

  const handleInspectDocument = async (documentId) => {
    setErrorMessage('')
    try {
      const { blob } = await getNormalRefundDocument(refund.id, documentId)
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = `refund-${refund.id}-document-${documentId}`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
      setVerifiedDocumentIds((current) => current.includes(documentId) ? current : [...current, documentId])
    } catch (error) {
      setErrorMessage(errorText(error))
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving || !permitted) return
    const confirmationText = action === 'approve'
      ? `Phê duyệt hồ sơ hoàn tiền #${refund.id} với số tiền ${moneyOrMissing(refund.amount)}? Phê duyệt không xác nhận đã chuyển khoản.`
      : action === 'verifyAttempt'
        ? `Gửi kết quả đối soát "${outcomeLabel(outcome)}" cho lần chuyển khoản #${selectedAttemptId}?`
        : 'Xác nhận gửi thao tác này?'
    if (!window.confirm(confirmationText)) return

    setSaving(true)
    setErrorMessage('')
    setNotice('')
    setRefreshWarning('')
    try {
      const options = { actor: currentUser }
      if (action === 'verifyReceiver') await verifyNormalRefundReceiver(refund.id, { source, note }, options)
      else if (action === 'approve') await approveNormalRefund(refund.id, {}, options)
      else if (action === 'requestInformation') await requestNormalRefundInformation(refund.id, { note }, options)
      else if (action === 'issue') await recordNormalRefundIssue(refund.id, { note }, options)
      else if (action === 'verifyAttempt') {
        const request = { outcome, bankSource, note }
        if (outcome === 'Success') {
          request.reference = reference
          request.amount = amount === '' ? '' : Number(amount)
          request.receiverId = selectedAttempt?.receiverId ?? ''
          request.performedAt = performedAt ? serializeNormalRefundPerformedAt(performedAt) : ''
          request.independentBankCheckConfirmed = independentBankCheckConfirmed
          request.documentVerified = Array.isArray(selectedAttempt?.documentIds) && selectedAttempt.documentIds.some((id) => verifiedDocumentIds.includes(id))
        }
        await verifyNormalRefundAttempt(refund.id, selectedAttemptId, request, options)
      } else return

      setNotice('Đã ghi nhận thao tác thành công. Đang tải lại dữ liệu…')
      const refreshed = await onRefresh()
      if (!refreshed?.detail || !refreshed?.history || !refreshed?.list) {
        setRefreshWarning('Thao tác đã được ghi nhận. Vui lòng tải lại nếu dữ liệu chưa cập nhật đầy đủ.')
      } else {
        setNotice('Thao tác thành công và dữ liệu đã được cập nhật.')
        setAction('')
      }
    } catch (error) {
      const normalized = getNormalRefundError(error)
      setErrorMessage(mutationErrorText(error))
      if (normalized.status === 0 || normalized.status === 409 || normalized.status >= 500) {
        const refreshed = await onRefresh()
        if (!refreshed?.detail || !refreshed?.history || !refreshed?.list) {
          setRefreshWarning('Kết quả thao tác chưa chắc chắn và dữ liệu chưa tải lại được. Vui lòng kiểm tra lại hồ sơ.')
        } else if (normalized.status === 0 || normalized.status >= 500) {
          setRefreshWarning('Đã làm mới trạng thái hệ thống. Vui lòng kiểm tra lại hồ sơ và lịch sử trước khi tiếp tục.')
        }
      }
    } finally {
      setSaving(false)
    }
  }

  return <section className="space-y-4 rounded border border-slate-200 bg-white p-4">
    <div><h3 className="text-sm font-bold text-slate-800">Thao tác Center Manager</h3>{!permitted && <p className="mt-1 text-sm text-amber-800">Thao tác yêu cầu Manager đã đăng nhập, trạng thái Active và quyền MANAGE_INVOICES trong cùng trung tâm.</p>}</div>
    <div className="flex flex-wrap gap-2">
      {refund.receiverVerified !== true && <button type="button" disabled={!permitted || saving} onClick={() => chooseAction('verifyReceiver')} className="min-h-9 rounded border border-slate-300 px-3 text-xs font-semibold disabled:opacity-50">Xác minh người nhận</button>}
      {refund.receiverVerified === true && <button type="button" disabled={!permitted || saving} onClick={() => chooseAction('approve')} className="min-h-9 rounded border border-blue-700 bg-blue-700 px-3 text-xs font-semibold text-white disabled:opacity-50">Phê duyệt hoàn tiền</button>}
      <button type="button" disabled={!permitted || saving} onClick={() => chooseAction('requestInformation')} className="min-h-9 rounded border border-slate-300 px-3 text-xs font-semibold disabled:opacity-50">Yêu cầu bổ sung</button>
      <button type="button" disabled={!permitted || saving} onClick={() => chooseAction('issue')} className="min-h-9 rounded border border-slate-300 px-3 text-xs font-semibold disabled:opacity-50">Ghi nhận vấn đề</button>
      {attempts.length > 0 && <button type="button" disabled={!permitted || saving} onClick={() => chooseAction('verifyAttempt')} className="min-h-9 rounded border border-slate-300 px-3 text-xs font-semibold disabled:opacity-50">Đối soát giao dịch hoàn tiền</button>}
    </div>
    {action && <form onSubmit={handleSubmit} className="space-y-3 rounded border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-bold text-slate-800">{action === 'verifyReceiver' ? 'Xác minh thông tin người nhận' : action === 'approve' ? 'Phê duyệt hồ sơ hoàn tiền' : action === 'requestInformation' ? 'Yêu cầu bổ sung thông tin' : action === 'issue' ? 'Ghi nhận vấn đề hồ sơ' : 'Đối soát giao dịch hoàn tiền'}</h4><button type="button" onClick={() => setAction('')} disabled={saving} className="text-xs font-semibold text-slate-500 underline">Đóng</button></div>
      {action === 'verifyReceiver' && <><label className="block text-sm font-medium text-slate-700">Nguồn/cách xác minh thực tế <span className="text-rose-700">*</span><textarea required maxLength={2000} value={source} onChange={(event) => setSource(event.target.value)} rows={3} className="mt-1 w-full rounded border border-slate-300 p-2 text-sm" placeholder="Mô tả cách Manager đã kiểm tra thông tin người nhận"/><span className="mt-1 block text-xs text-slate-500">Tối đa 2000 ký tự; không có enum cố định.</span></label><label className="block text-sm font-medium text-slate-700">Ghi chú thêm<textarea maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"/></label></>}
      {action === 'approve' && <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p>Refund #{textOrMissing(refund.id)} · {moneyOrMissing(refund.amount)}</p><p>Người nhận: {textOrMissing(refund.accountName)} · {textOrMissing(refund.bank)} · {refund.accountNumber ? `•••• ${String(refund.accountNumber).slice(-4)}` : 'Chưa có thông tin'}</p><p className="mt-1 font-semibold">Phê duyệt không xác nhận chuyển khoản hoặc trạng thái Completed.</p></div>}
      {(action === 'requestInformation' || action === 'issue') && <><label className="block text-sm font-medium text-slate-700">{action === 'requestInformation' ? 'Thông tin cần Member bổ sung' : 'Mô tả vấn đề'} <span className="text-rose-700">*</span><textarea required maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} rows={4} className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"/><span className="mt-1 block text-xs text-slate-500">Tối đa 2000 ký tự.</span></label>{action === 'requestInformation' && <p className="rounded bg-amber-50 p-3 text-xs text-amber-900">Yêu cầu hội viên cung cấp hoặc cập nhật thông tin người nhận. Phê duyệt trước đó sẽ hết hiệu lực.</p>}</>}
      {action === 'verifyAttempt' && <>
        <label className="block text-sm font-medium text-slate-700">Chọn giao dịch cần đối chiếu <span className="text-rose-700">*</span><select required value={selectedAttemptId} onChange={(event) => { setSelectedAttemptId(event.target.value); setVerifiedDocumentIds([]); setIndependentBankCheckConfirmed(false) }} className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-sm"><option value="">Chọn lần chuyển khoản</option>{attempts.map((attempt) => <option key={attempt.id} value={attempt.id}>Lần #{attempt.id} · {attemptStatusLabel(attempt.status)} · {moneyOrMissing(attempt.amount)} · Mã GD {textOrMissing(attempt.bankReference)}</option>)}</select><span className="mt-1 block text-xs text-slate-500">Chọn đúng lần Lễ tân đã ghi nhận; hãy kiểm tra chứng từ và tra cứu ngân hàng độc lập trước khi xác nhận.</span></label>
        {selectedAttempt && <div className="rounded border border-slate-200 bg-white p-3 text-sm"><p className="font-semibold">Thông tin Lễ tân đã ghi nhận (dùng để so sánh)</p><dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2"><div><dt className="inline text-slate-500">Mã giao dịch: </dt><dd className="inline">{textOrMissing(selectedAttempt.bankReference)}</dd></div><div><dt className="inline text-slate-500">Số tiền: </dt><dd className="inline">{moneyOrMissing(selectedAttempt.amount)}</dd></div><div><dt className="inline text-slate-500">Thời điểm chuyển: </dt><dd className="inline">{dateOrMissing(selectedAttempt.performedAt)}</dd></div><div><dt className="inline text-slate-500">Trạng thái ghi nhận: </dt><dd className="inline">{attemptStatusLabel(selectedAttempt.status)}</dd></div></dl><p className="mt-2 font-medium">Chứng từ giao dịch</p><div className="mt-1 flex flex-wrap gap-2">{(Array.isArray(selectedAttempt.documentIds) ? selectedAttempt.documentIds : []).map((documentId) => <button type="button" key={documentId} onClick={() => handleInspectDocument(documentId)} className="min-h-8 rounded border border-slate-300 px-2 text-xs font-semibold">{verifiedDocumentIds.includes(documentId) ? `Đã mở chứng từ #${documentId}` : `Mở chứng từ #${documentId}`}</button>)}{(!Array.isArray(selectedAttempt.documentIds) || selectedAttempt.documentIds.length === 0) && <span className="text-xs text-rose-700">Chưa có chứng từ đính kèm.</span>}</div></div>}
        <label className="block text-sm font-medium text-slate-700">Kết quả tra cứu ngân hàng <span className="text-rose-700">*</span><select required value={outcome} onChange={(event) => setOutcome(event.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-sm"><option value="">Chọn kết quả tra cứu</option><option value="Success">Đã chuyển thành công</option><option value="Pending">Ngân hàng chưa xác nhận</option><option value="Failed">Chuyển khoản thất bại</option><option value="Reversed">Giao dịch đã bị hoàn ngược</option></select></label>
        <label className="block text-sm font-medium text-slate-700">Nguồn ngân hàng đã tra cứu <span className="text-rose-700">*</span><textarea required maxLength={2000} value={bankSource} onChange={(event) => setBankSource(event.target.value)} rows={2} className="mt-1 w-full rounded border border-slate-300 p-2 text-sm" placeholder="Ví dụ: Sao kê tài khoản giao dịch, tra cứu trên Internet Banking; ghi thêm ngày giờ tra cứu"/><span className="mt-1 block text-xs text-slate-500">Ghi rõ kênh tra cứu và thời điểm kiểm tra để có thể truy lại.</span></label>
        {outcome === 'Success' && <><div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950"><p className="font-semibold">Nhập thông tin đọc trực tiếp từ ngân hàng</p><p className="mt-1">Không sao chép mã giao dịch, số tiền hoặc thời gian từ thông tin Lễ tân. Số tiền phải khớp chính xác với khoản hoàn tiền.</p>{refund?.bank || refund?.accountName || refund?.accountNumber ? <p className="mt-1">Người nhận dự kiến: {textOrMissing(refund.accountName)} · {textOrMissing(refund.bank)} · tài khoản {refund.accountNumber ? `•••• ${String(refund.accountNumber).slice(-4)}` : 'chưa có thông tin'}.</p> : null}</div>
          <label className="block text-sm font-medium text-slate-700">Mã giao dịch theo kết quả ngân hàng <span className="text-rose-700">*</span><input required maxLength={2000} value={reference} onChange={(event) => setReference(event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2 text-sm" placeholder="Nhập mã tham chiếu/mã giao dịch từ ngân hàng"/><span className="mt-1 block text-xs text-slate-500">Phải trùng với mã giao dịch Lễ tân đã ghi nhận nếu xác nhận thành công.</span></label>
          <label className="block text-sm font-medium text-slate-700">Số tiền ngân hàng xác nhận (VND) <span className="text-rose-700">*</span><input required type="number" min="0" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2 text-sm" placeholder="Nhập số tiền hoàn thực tế"/><span className="mt-1 block text-xs text-slate-500">Phải bằng số tiền hoàn đã được phê duyệt: {moneyOrMissing(refund?.amount)}.</span></label>
          <label className="block text-sm font-medium text-slate-700">Mã người nhận trong hồ sơ đã duyệt <input type="number" value={selectedAttempt?.receiverId ?? ''} readOnly className="mt-1 w-full rounded border border-slate-300 bg-slate-100 p-2 text-sm text-slate-600"/><span className="mt-1 block text-xs text-slate-500">Mã này được lấy từ lần chuyển khoản đã chọn; hãy xác nhận tài khoản nhận thực tế trên nguồn ngân hàng khớp với người nhận dự kiến ở trên.</span></label>
          <label className="block text-sm font-medium text-slate-700">Thời điểm giao dịch theo ngân hàng <span className="text-rose-700">*</span><input required type="datetime-local" value={performedAt} onChange={(event) => setPerformedAt(event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"/><span className="mt-1 block text-xs text-slate-500">Nhập ngày giờ giao dịch hiển thị trên ngân hàng; phải khớp lần Lễ tân đã ghi nhận.</span></label>
          <label className="flex items-start gap-2 text-sm text-slate-700"><input required type="checkbox" checked={independentBankCheckConfirmed} onChange={(event) => setIndependentBankCheckConfirmed(event.target.checked)} className="mt-1"/><span>Tôi đã tự tra cứu ngân hàng và xác nhận người nhận, mã giao dịch, số tiền, thời điểm ở trên khớp với giao dịch thực tế; tôi không lấy các giá trị này từ thông tin Lễ tân nhập.</span></label>
          <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={Array.isArray(selectedAttempt?.documentIds) && selectedAttempt.documentIds.some((id) => verifiedDocumentIds.includes(id))} disabled className="mt-1"/><span>Đã mở và kiểm tra ít nhất một chứng từ giao dịch hợp lệ.</span></label>
        </>}
        <label className="block text-sm font-medium text-slate-700">Ghi chú kết quả đối soát <span className="text-rose-700">*</span><textarea required maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-1 w-full rounded border border-slate-300 p-2 text-sm" placeholder="Ghi kết luận, điểm khớp hoặc sai khác cần lưu ý"/></label>
      </>}
      {errorMessage && <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{errorMessage}</p>}
      {notice && <p role="status" className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {refreshWarning && <p role="alert" className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{refreshWarning}</p>}
      <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => onRefresh()} disabled={saving} className="min-h-9 rounded border border-slate-300 px-3 text-xs font-semibold">Tải lại dữ liệu</button><button type="submit" disabled={saving || !permitted || (action === 'approve' && refund.receiverVerified !== true) || (action === 'verifyAttempt' && (!selectedAttempt || !successEvidenceReady))} className="min-h-9 rounded bg-blue-700 px-4 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Đang gửi…' : 'Xác nhận và gửi'}</button></div>
    </form>}
  </section>
}

function NormalRefundDetail({ refundId, onClose, canViewFinancialData, currentUser, onRefreshList }) {
  const { language } = useSCMS()
  const [refund, setRefund] = useState(null)
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [historyError, setHistoryError] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [downloadingId, setDownloadingId] = useState(null)
  const [documentMessage, setDocumentMessage] = useState('')
  const requestId = useRef(0)

  const loadDetail = useCallback(async () => {
    const request = ++requestId.current
    setLoading(true)
    setError(null)
    setHistoryError(null)
    setRefund(null)
    setHistory(null)
    let detailLoaded = false
    let historyLoaded = false
    try {
      const result = await getNormalRefundById(refundId)
      if (request === requestId.current) {
        setRefund(result)
        detailLoaded = true
      }
    } catch (err) {
      if (request === requestId.current) setError(err)
    } finally {
      if (request === requestId.current) setLoading(false)
    }
    try {
      const result = await getNormalRefundHistory(refundId)
      if (request === requestId.current) {
        setHistory(result)
        historyLoaded = true
      }
    } catch (err) {
      if (request === requestId.current) setHistoryError(err)
    }
    return { detail: detailLoaded, history: historyLoaded }
  }, [refundId])

  useEffect(() => {
    loadDetail()
    return () => { requestId.current += 1 }
  }, [loadDetail])

  const downloadDocument = async (documentId) => {
    setDownloadingId(documentId)
    setDocumentMessage('')
    try {
      const { blob } = await getNormalRefundDocument(refundId, documentId)
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = `refund-${refundId}-document-${documentId}`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch (err) {
      setDocumentMessage(errorText(err))
    } finally {
      setDownloadingId(null)
    }
  }

  const attempts = Array.isArray(refund?.attempts) ? refund.attempts : []
  const receivers = Array.isArray(history?.receivers) ? history.receivers : []
  const verifications = Array.isArray(history?.verifications) ? history.verifications : []
  const accountNumber = refund?.accountNumber
  const maskedAccount = accountNumber === null || accountNumber === undefined || accountNumber === ''
    ? refund?.receiverId == null ? 'Hội viên chưa cung cấp' : 'Chưa có số tài khoản trong hồ sơ'
    : revealed ? String(accountNumber) : `•••• ${String(accountNumber).slice(-4)}`
  const refreshAfterMutation = async () => {
    const [detailResult, listLoaded] = await Promise.all([
      loadDetail(),
      onRefreshList(),
    ])
    return { ...detailResult, list: listLoaded === true }
  }

  return <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/40 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section role="dialog" aria-modal="true" aria-labelledby="refund-detail-title" className="my-3 w-full max-w-5xl rounded-lg border border-slate-200 bg-slate-50 shadow-xl">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white p-4 sm:p-5">
        <div><h2 id="refund-detail-title" className="text-lg font-bold text-slate-900">Hồ sơ hoàn tiền #{refundId}</h2><p className="mt-1 text-xs text-slate-500">Thông tin và trạng thái được đọc trực tiếp từ hệ thống.</p></div>
        <div className="flex gap-2"><button type="button" onClick={loadDetail} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>Tải lại</button><button type="button" onClick={onClose} aria-label="Đóng" className="rounded p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div>
      </header>
      <div className="space-y-5 p-4 sm:p-5">
        {loading && !refund && <div className="rounded border border-slate-200 bg-white p-5 text-sm text-slate-600">Đang tải chi tiết hồ sơ…</div>}
        {error && <div role="alert" className="flex items-start gap-3 rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle size={18} className="mt-0.5 shrink-0"/><div className="flex-1">{errorText(error)}<button type="button" onClick={loadDetail} className="ml-2 font-bold underline">Thử lại</button></div></div>}
        {refund && <>
          <section><h3 className="mb-3 text-sm font-bold text-slate-800">Thông tin hồ sơ</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <InfoField label="Mã hồ sơ hoàn tiền">#{textOrMissing(refund.id)}</InfoField><InfoField label="Trạng thái hiện tại">{refundStatusLabel(refund.status)}</InfoField><InfoField label="Nguồn phát sinh">{normalRefundOriginLabel(refund.origin, language)}</InfoField>
            <InfoField label="Hóa đơn gốc">{refund.invoiceCode ? `${refund.invoiceCode} · #${textOrMissing(refund.invoiceId)}` : `#${textOrMissing(refund.invoiceId)}`}</InfoField><InfoField label="Lớp Normal">{refund.className ? `${refund.className} · #${textOrMissing(refund.classId)}` : `#${textOrMissing(refund.classId)}`}</InfoField><InfoField label="Hội viên">{refund.memberName ? `${refund.memberName} · #${textOrMissing(refund.memberId)}` : `#${textOrMissing(refund.memberId)}`}</InfoField>
            <InfoField label="Số tiền phải hoàn">{moneyOrMissing(refund.amount)}</InfoField><InfoField label="Hạn hoàn hiện tại">{refund.dueAt ? dateOrMissing(refund.dueAt) : ['AwaitingReceiver', 'AwaitingApproval'].includes(refund.status) ? 'Chưa thiết lập — chưa phê duyệt hoàn tiền' : 'Chưa có hạn hoàn trong hồ sơ'}</InfoField>
            <InfoField label="Hạn hoàn ban đầu">{refund.firstDueAt ? dateOrMissing(refund.firstDueAt) : 'Chưa từng được ghi nhận'}</InfoField><InfoField label="Tình trạng quá hạn">{overdueLabel(refund.overdue, Boolean(refund.dueAt))}</InfoField><InfoField label="Xác minh người nhận">{receiverVerifiedLabel(refund)}</InfoField>
            <InfoField label="Ghi chú vấn đề"><span className="whitespace-pre-wrap">{refund.issueNote ? String(refund.issueNote) : refund.status === 'NeedsReview' ? 'Chưa có ghi chú cho yêu cầu kiểm tra này' : 'Chưa ghi nhận vấn đề'}</span></InfoField>
          </div>{refundStatusDescription(refund.status) && <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950"><span className="font-semibold">Việc cần làm tiếp theo: </span>{refundStatusDescription(refund.status)}</div>}</section>

          <section><div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-800">Thông tin người nhận tiền</h3>{canViewFinancialData && accountNumber !== null && accountNumber !== undefined && accountNumber !== '' && <button type="button" onClick={() => setRevealed((current) => !current)} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">{revealed ? <EyeOff size={14} /> : <Eye size={14} />}{revealed ? 'Ẩn số tài khoản' : 'Hiện số tài khoản'}</button>}</div>
            {!canViewFinancialData ? <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Tài khoản hiện tại không có quyền xem thông tin tài chính.</div> : <>{refund.receiverId == null && <div className="mb-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Hội viên chưa cung cấp tài khoản nhận tiền. Vì vậy hồ sơ chưa thể được phê duyệt hoặc chuyển khoản.</div>}<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><InfoField label="Ngân hàng nhận">{refund.receiverId == null ? 'Hội viên chưa cung cấp' : textOrMissing(refund.bank)}</InfoField><InfoField label="Số tài khoản nhận">{maskedAccount}</InfoField><InfoField label="Tên chủ tài khoản nhận">{refund.receiverId == null ? 'Hội viên chưa cung cấp' : textOrMissing(refund.accountName)}</InfoField><InfoField label="Số điện thoại liên hệ hội viên">{textOrMissing(refund.contactPhone)}</InfoField></div></>}
          </section>

          <section><h3 className="mb-3 text-sm font-bold text-slate-800">Lịch sử chuyển khoản</h3>{attempts.length === 0 ? <p className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">{refund.status === 'AwaitingReceiver' ? 'Chưa có giao dịch chuyển khoản. Cần hội viên cung cấp thông tin người nhận trước.' : 'Chưa có lần chuyển khoản nào được ghi nhận cho hồ sơ này.'}</p> : <div className="space-y-3">{attempts.map((attempt, index) => <article key={attempt?.id ?? index} className="rounded border border-slate-200 bg-white p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold text-slate-800">Lần chuyển khoản #{textOrMissing(attempt?.id)}</h4><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{attemptStatusLabel(attempt?.status)}</span></div><div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3"><div><span className="text-slate-500">Số tiền: </span>{moneyOrMissing(attempt?.amount)}</div><div><span className="text-slate-500">Mã giao dịch ngân hàng: </span>{textOrMissing(attempt?.bankReference)}</div><div><span className="text-slate-500">Thời điểm chuyển: </span>{dateOrMissing(attempt?.performedAt)}</div><div><span className="text-slate-500">Mã người nhận đã duyệt: </span>{textOrMissing(attempt?.receiverId)}</div><div><span className="text-slate-500">Mã nhân viên nhận xử lý: </span>{textOrMissing(attempt?.claimedBy)}</div><div><span className="text-slate-500">Thời điểm đối soát: </span>{dateOrMissing(attempt?.verifiedAt)}</div></div><div className="mt-3 flex flex-wrap gap-2">{Array.isArray(attempt?.documentIds) && attempt.documentIds.map((documentId) => <button key={documentId} type="button" onClick={() => downloadDocument(documentId)} disabled={downloadingId !== null} className="inline-flex min-h-9 items-center gap-2 rounded border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:opacity-50"><Download size={14}/>{downloadingId === documentId ? 'Đang tải…' : `Tải chứng từ #${documentId}`}</button>)}</div></article>)}</div>}{documentMessage && <p role="alert" className="mt-2 text-sm text-rose-700">{documentMessage}</p>}</section>

          <section><h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><FileClock size={16}/>Lịch sử xử lý</h3>{historyError && <div role="alert" className="mb-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{errorText(historyError)} Lịch sử chưa được tải; thông tin hồ sơ vẫn hiển thị.<button type="button" onClick={loadDetail} className="ml-2 font-bold underline">Tải lại</button></div>}{!historyError && !history && <p className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-500">Đang tải lịch sử…</p>}{history && receivers.length === 0 && verifications.length === 0 && <p className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-500">Chưa có lịch sử xử lý.</p>}{history && <div className="space-y-3">{receivers.map((receiver, index) => <article key={`receiver-${receiver?.id ?? index}`} className="rounded border border-slate-200 bg-white p-3 text-sm"><div className="font-semibold text-slate-800">Thông tin người nhận #{textOrMissing(receiver?.id)}</div><div className="mt-1 text-slate-600">Ngân hàng: {textOrMissing(receiver?.bank)} · Số tài khoản: {receiver?.accountNumber ? `•••• ${String(receiver.accountNumber).slice(-4)}` : 'Chưa có thông tin'}</div><div className="mt-1 text-slate-600">Xác nhận: {dateOrMissing(receiver?.confirmedAt)} · Người xác nhận ID: {textOrMissing(receiver?.confirmedBy)}</div><div className="mt-1 text-slate-600">Xác minh: {dateOrMissing(receiver?.verifiedAt)} · Người xác minh ID: {textOrMissing(receiver?.verifiedBy)}</div></article>)}{verifications.map((verification, index) => <article key={`verification-${verification?.id ?? index}`} className="rounded border border-slate-200 bg-white p-3 text-sm"><div className="font-semibold text-slate-800">Đối soát #{textOrMissing(verification?.id)} · Attempt #{textOrMissing(verification?.attemptId)}</div><div className="mt-1 text-slate-600">Kết quả đối soát: {textOrMissing(verification?.outcome)} · Nguồn: {textOrMissing(verification?.bankSource)}</div><div className="mt-1 text-slate-600">Thời điểm: {dateOrMissing(verification?.verifiedAt)} · Người xác minh ID: {textOrMissing(verification?.verifiedBy)}</div><div className="mt-1 whitespace-pre-wrap text-slate-600">{textOrMissing(verification?.note)}</div></article>)}</div>}</section>

          <NormalRefundActions refund={refund} currentUser={currentUser} onRefresh={refreshAfterMutation}/>
        </>}
      </div>
    </section>
  </div>
}

export function NormalRefundManagement() {
  const { apiEnabled, currentUser } = useSCMS()
  const [refunds, setRefunds] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const requestId = useRef(0)
  const hasAccess = apiEnabled && canReviewNormalRefund(currentUser)

  const loadRefunds = useCallback(async () => {
    if (!hasAccess) return false
    const request = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const result = await getNormalRefunds()
      if (request === requestId.current) {
        setRefunds(result)
        setStatusFilter('all')
      }
      return true
    } catch (err) {
      if (request === requestId.current) setError(err)
      return false
    } finally {
      if (request === requestId.current) setLoading(false)
    }
  }, [hasAccess])

  useEffect(() => {
    if (hasAccess) loadRefunds()
    return () => { requestId.current += 1 }
  }, [hasAccess, loadRefunds])

  const statuses = useMemo(() => [...new Set(refunds.map((refund) => refund?.status).filter((status) => typeof status === 'string' && status.length > 0))].sort(), [refunds])
  const visibleRefunds = useMemo(() => refunds.filter((refund) => {
    if (statusFilter !== 'all' && refund?.status !== statusFilter) return false
    const query = search.trim().toLowerCase()
    if (!query) return true
    return [refund?.id, refund?.memberId, refund?.classId, refund?.invoiceId].some((value) => value !== null && value !== undefined && String(value).toLowerCase().includes(query))
  }), [refunds, search, statusFilter])

  if (!apiEnabled) return <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">Quản lý hoàn tiền chỉ khả dụng khi kết nối máy chủ.</div>
  if (!canReviewNormalRefund(currentUser)) return <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-900">Tài khoản cần vai trò Center Manager và quyền MANAGE_INVOICES để xem hồ sơ hoàn tiền.</div>

  return <div className="space-y-5 text-slate-900">
    <header className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center"><div><h1 className="text-xl font-bold">Hoàn tiền</h1><p className="mt-1 text-sm text-slate-500">Theo dõi hồ sơ và tiến độ hoàn tiền của trung tâm.</p></div><button type="button" onClick={loadRefunds} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>Tải lại</button></header>
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center"><label className="relative min-w-0 flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><span className="sr-only">Tìm hồ sơ theo mã hội viên, lớp hoặc hóa đơn</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã hồ sơ, hội viên, lớp hoặc hóa đơn" className="min-h-10 w-full rounded border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-blue-600"/></label><label className="flex items-center gap-2 text-sm text-slate-600">Trạng thái<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-10 rounded border border-slate-300 bg-white px-3 text-sm text-slate-800"><option value="all">Tất cả</option>{statuses.map((status) => <option key={status} value={status}>{refundStatusLabel(status)}</option>)}</select></label><span className="text-xs text-slate-500">{visibleRefunds.length}/{refunds.length} hồ sơ</span></div>
      {loading && refunds.length === 0 && <div className="p-8 text-center text-sm text-slate-500">Đang tải danh sách hồ sơ…</div>}
      {error && <div role="alert" className="m-4 flex items-start gap-3 rounded border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle size={18} className="mt-0.5 shrink-0"/><div className="flex-1">{errorText(error)}<button type="button" onClick={loadRefunds} className="ml-2 font-bold underline">Thử lại</button></div></div>}
      {!loading && !error && refunds.length === 0 && <div className="p-10 text-center text-sm text-slate-500">Chưa có hồ sơ hoàn tiền.</div>}
      {!error && refunds.length > 0 && visibleRefunds.length === 0 && <div className="p-10 text-center text-sm text-slate-500"><p>Không có hồ sơ phù hợp bộ lọc hiện tại.</p><button type="button" onClick={() => setStatusFilter('all')} className="mt-2 font-semibold text-blue-700 underline">Xóa bộ lọc và xem tất cả hồ sơ</button></div>}
      {!error && visibleRefunds.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Mã hồ sơ</th><th className="px-4 py-3">Mã hội viên</th><th className="px-4 py-3">Mã lớp Normal</th><th className="px-4 py-3">Mã hóa đơn gốc</th><th className="px-4 py-3 text-right">Số tiền hoàn</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Hạn hoàn</th><th className="px-4 py-3">Quá hạn</th><th className="px-4 py-3"> </th></tr></thead><tbody className="divide-y divide-slate-100">{visibleRefunds.map((refund, index) => <tr key={refund?.id ?? index} className="hover:bg-slate-50"><td className="px-4 py-3 font-semibold">{textOrMissing(refund?.id)}</td><td className="px-4 py-3">{textOrMissing(refund?.memberId)}</td><td className="px-4 py-3">{textOrMissing(refund?.classId)}</td><td className="px-4 py-3">{textOrMissing(refund?.invoiceId)}</td><td className="px-4 py-3 text-right tabular-nums">{moneyOrMissing(refund?.amount)}</td><td className="px-4 py-3"><span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold">{refundStatusLabel(refund?.status)}</span></td><td className="px-4 py-3">{refund?.dueAt ? dateOrMissing(refund.dueAt) : 'Chưa thiết lập'}</td><td className="px-4 py-3">{overdueLabel(refund?.overdue, Boolean(refund?.dueAt))}</td><td className="px-4 py-3"><button type="button" onClick={() => setSelectedId(refund.id)} className="min-h-9 rounded border border-slate-300 px-3 text-xs font-bold text-slate-700 hover:bg-slate-100">Chi tiết</button></td></tr>)}</tbody></table></div>}
      {loading && refunds.length > 0 && <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">Đang đồng bộ dữ liệu mới…</div>}
    </section>
    {selectedId !== null && <NormalRefundDetail key={selectedId} refundId={selectedId} canViewFinancialData={hasAccess} currentUser={currentUser} onRefreshList={loadRefunds} onClose={() => setSelectedId(null)}/>}
  </div>
}
