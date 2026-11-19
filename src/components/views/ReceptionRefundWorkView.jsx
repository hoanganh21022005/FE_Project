import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Lock,
  ReceiptText,
  RefreshCw,
  Upload,
} from 'lucide-react'
import { useSCMS } from '../../context/SCMSContext'
import { formatCurrency, formatDateTime } from '../../locales/translations'
import { getErrorMessage } from '../../api/apiErrors'
import { getNormalRefundError, getNormalRefunds } from '../../api/normalRefundApi.js'
import {
  canWorkNormalRefundTransfer,
  claimNormalRefund,
  createNormalRefundClaimRequestId,
  submitNormalRefundTransfer,
  uploadNormalRefundDocument,
  validateNormalRefundDocument,
} from '../../api/normalRefundTransferApi.js'

const STATUS_TABS = [
  { key: 'Approved', vi: 'Chờ nhận', en: 'Pending claim' },
  { key: 'Processing', vi: 'Đang xử lý', en: 'Processing' },
  { key: 'AwaitingVerification', vi: 'Chờ đối soát', en: 'Awaiting verification' },
  { key: 'NeedsReview', vi: 'Cần xem lại', en: 'Needs review' },
  { key: 'Completed', vi: 'Đã xong', en: 'Completed' },
  { key: 'ALL', vi: 'Tất cả', en: 'All' },
]

const STATUS_LABELS = {
  Approved: { vi: 'Chờ nhận', en: 'Pending claim' },
  Processing: { vi: 'Đang xử lý', en: 'Processing' },
  AwaitingVerification: { vi: 'Chờ đối soát', en: 'Awaiting verification' },
  NeedsReview: { vi: 'Cần xem lại', en: 'Needs review' },
  Completed: { vi: 'Đã xong', en: 'Completed' },
}

const BACKEND_ERROR_MESSAGES = {
  REFUND_VERSION_STALE: {
    vi: 'Hồ sơ đã thay đổi. Đang tải lại dữ liệu mới nhất, vui lòng kiểm tra lại.',
    en: 'Refund record has changed. Reloading the latest data, please review.',
  },
  CLAIM_KEY_REUSED: {
    vi: 'Mã yêu cầu nhận việc đã được sử dụng trước đó.',
    en: 'This claim request key was already used.',
  },
  REFUND_CLAIM_EXISTS: {
    vi: 'Hồ sơ này đã có nhân viên khác nhận xử lý.',
    en: 'This refund has already been claimed by another receptionist.',
  },
  REFUND_APPROVAL_REQUIRED: {
    vi: 'Hồ sơ chưa được phê duyệt để nhận chuyển khoản.',
    en: 'Refund must be approved before claiming.',
  },
  ATTEMPT_NOT_EDITABLE: {
    vi: 'Lần chuyển khoản này không còn ở trạng thái cho phép cập nhật.',
    en: 'This transfer attempt can no longer be edited.',
  },
  DOCUMENT_TYPE_INVALID: {
    vi: 'Định dạng chứng từ không hợp lệ. Chỉ chấp nhận PNG, JPEG hoặc PDF.',
    en: 'Invalid document format. Only PNG, JPEG, or PDF files are accepted.',
  },
  DOCUMENT_SIZE_INVALID: {
    vi: 'Kích thước chứng từ phải lớn hơn 0 và tối đa 5 MiB.',
    en: 'Document size must be greater than 0 and at most 5 MiB.',
  },
  REFUND_AMOUNT_MISMATCH: {
    vi: 'Số tiền nộp không khớp với số tiền đã duyệt.',
    en: 'Submitted amount does not match the approved refund amount.',
  },
  REFUND_TIME_INVALID: {
    vi: 'Thời gian chuyển khoản không hợp lệ (phải từ lúc nhận việc đến hiện tại).',
    en: 'Transfer time is invalid (must be between claim time and now).',
  },
  BANK_REFERENCE_REUSED: {
    vi: 'Mã tham chiếu ngân hàng đã được dùng cho lần chuyển khoản khác.',
    en: 'Bank reference has already been used in another attempt.',
  },
  ATTEMPT_IMMUTABLE: {
    vi: 'Lần chuyển khoản đã được chốt, không thể chỉnh sửa.',
    en: 'Transfer attempt is immutable and cannot be modified.',
  },
  DOCUMENT_REQUIRED: {
    vi: 'Vui lòng chọn tệp chứng từ hợp lệ.',
    en: 'Please choose a valid document file.',
  },
  NORMAL_REFUND_REFERENCE_REQUIRED: {
    vi: 'Vui lòng nhập mã tham chiếu chuyển khoản.',
    en: 'Please enter the transfer reference.',
  },
  NORMAL_REFUND_REFERENCE_TOO_LONG: {
    vi: 'Mã tham chiếu chuyển khoản không được vượt quá 120 ký tự.',
    en: 'Transfer reference must not exceed 120 characters.',
  },
  NORMAL_REFUND_PERFORMED_AT_INVALID: {
    vi: 'Vui lòng chọn thời gian chuyển khoản hợp lệ.',
    en: 'Please choose a valid transfer date and time.',
  },
}

const mapReceptionRefundError = (error, language, fallback) => {
  const normalized = getNormalRefundError(error)
  const rawCode = normalized.code || error?.details?.code || error?.response?.data?.code
  if (rawCode && BACKEND_ERROR_MESSAGES[rawCode]) {
    return BACKEND_ERROR_MESSAGES[rawCode][language === 'vi' ? 'vi' : 'en']
  }
  if (normalized.status === 403) {
    return language === 'vi'
      ? 'Bạn không có quyền xử lý hoàn tiền.'
      : 'You do not have permission to process refunds.'
  }
  const msg = getErrorMessage(error, fallback)
  if (rawCode && msg === rawCode) {
    return fallback
  }
  return msg
}

const toLocalDateTimeInput = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const normalizeLocalDateTimePayload = (value) => {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed
  }
  return trimmed
}

const statusBadgeClass = (status) => {
  const base = 'inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-4 whitespace-nowrap'
  switch (status) {
    case 'Approved':
      return `${base} border-status-info-border bg-status-info-bg text-status-info`
    case 'Processing':
      return `${base} border-status-warning-border bg-status-warning-bg text-status-warning`
    case 'AwaitingVerification':
      return `${base} border-status-info-border bg-status-info-bg text-status-info`
    case 'NeedsReview':
      return `${base} border-status-danger-border bg-status-danger-bg text-status-danger`
    case 'Completed':
      return `${base} border-status-success-border bg-status-success-bg text-status-success`
    default:
      return `${base} border-border-color bg-bg-secondary text-text-secondary`
  }
}

const buttonBase =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold leading-5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none'
const buttonPrimary = `${buttonBase} bg-brand-primary text-white hover:bg-brand-primary-hover active:bg-brand-primary-active focus-visible:ring-brand-primary`
const buttonSecondary = `${buttonBase} border border-border-color bg-white text-text-primary hover:bg-bg-secondary active:bg-bg-main focus-visible:ring-brand-primary`
const inputClass =
  'min-h-11 w-full rounded-md border border-border-strong bg-white px-3 text-sm leading-5 text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-bg-secondary disabled:opacity-60'

export function ReceptionRefundWorkView() {
  const { currentUser, language, classes, showToast } = useSCMS()
  const isVi = language === 'vi'

  const [refunds, setRefunds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [forbidden, setForbidden] = useState(false)
  const [activeTab, setActiveTab] = useState('Approved')

  // Lưu requestId theo refund.id để tái sử dụng khi thử lại cùng một lần nhận việc.
  const claimRequestIdsRef = useRef(new Map())

  const [claimingId, setClaimingId] = useState(null)
  const [claimErrors, setClaimErrors] = useState({})
  const [uploadingKey, setUploadingKey] = useState(null)
  const [submittingKey, setSubmittingKey] = useState(null)

  // State cục bộ theo attemptId: chứng từ đã tải trong phiên, form nhập kết quả, thông báo lỗi/thành công
  const [uploadedDocsByAttempt, setUploadedDocsByAttempt] = useState({})
  const [formByAttempt, setFormByAttempt] = useState({})
  const [attemptErrors, setAttemptErrors] = useState({})

  const headingId = useId()
  const hasPermission = canWorkNormalRefundTransfer(currentUser)
  const currentUserId = currentUser?.id ?? currentUser?.userId ?? null

  const classNameMap = useMemo(() => {
    const map = new Map()
    if (Array.isArray(classes)) {
      for (const cls of classes) {
        if (cls?.id !== undefined && cls?.id !== null && cls?.name) {
          map.set(String(cls.id), cls.name)
        }
      }
    }
    return map
  }, [classes])

  const fetchRefunds = useCallback(async () => {
    if (!hasPermission) {
      setForbidden(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    setForbidden(false)
    try {
      const data = await getNormalRefunds({ notifyForbidden: false })
      setRefunds(Array.isArray(data) ? data : [])
    } catch (err) {
      const status = Number(err?.status ?? err?.response?.status) || 0
      if (status === 403) {
        setForbidden(true)
      } else {
        setError(
          mapReceptionRefundError(
            err,
            language,
            isVi ? 'Không thể tải danh sách việc hoàn tiền.' : 'Unable to load refund work list.',
          ),
        )
      }
    } finally {
      setLoading(false)
    }
  }, [hasPermission, isVi, language])

  useEffect(() => {
    fetchRefunds()
  }, [fetchRefunds])

  const counts = useMemo(() => {
    const summary = {
      Approved: 0,
      Processing: 0,
      AwaitingVerification: 0,
      NeedsReview: 0,
      Completed: 0,
      ALL: refunds.length,
    }
    for (const item of refunds) {
      if (item?.status && Object.prototype.hasOwnProperty.call(summary, item.status)) {
        summary[item.status] += 1
      }
    }
    return summary
  }, [refunds])

  const visibleRefunds = useMemo(() => {
    if (activeTab === 'ALL') return refunds
    return refunds.filter((item) => item?.status === activeTab)
  }, [activeTab, refunds])

  const getOrCreateClaimRequestId = (refundId) => {
    const key = String(refundId)
    if (!claimRequestIdsRef.current.has(key)) {
      claimRequestIdsRef.current.set(key, createNormalRefundClaimRequestId())
    }
    return claimRequestIdsRef.current.get(key)
  }

  const handleClaim = async (refund) => {
    if (!refund || claimingId !== null) return
    setClaimingId(refund.id)
    setClaimErrors((prev) => ({ ...prev, [refund.id]: '' }))
    try {
      const requestId = getOrCreateClaimRequestId(refund.id)
      await claimNormalRefund(refund, { requestId }, { notifyForbidden: false })
      claimRequestIdsRef.current.delete(String(refund.id))
      showToast?.(
        isVi ? `Đã nhận xử lý hồ sơ #${refund.id}.` : `Claimed refund #${refund.id}.`,
        'success',
      )
      await fetchRefunds()
    } catch (err) {
      const normalized = getNormalRefundError(err)
      const code = normalized.code || err?.details?.code
      if (normalized.status === 403) {
        setForbidden(true)
        return
      }
      setClaimErrors((prev) => ({
        ...prev,
        [refund.id]: mapReceptionRefundError(
          err,
          language,
          isVi ? 'Không thể nhận việc hoàn tiền.' : 'Unable to claim refund.',
        ),
      }))
      if (code === 'REFUND_VERSION_STALE') {
        await fetchRefunds()
      }
    } finally {
      setClaimingId(null)
    }
  }

  const getAttemptForm = (refund, attempt) => {
    const existing = formByAttempt[attempt.id]
    if (existing) return existing
    return {
      reference: attempt.bankReference || '',
      performedAt: toLocalDateTimeInput(),
    }
  }

  const updateAttemptForm = (attemptId, patch) => {
    setFormByAttempt((prev) => ({
      ...prev,
      [attemptId]: {
        ...(prev[attemptId] || { reference: '', performedAt: toLocalDateTimeInput() }),
        ...patch,
      },
    }))
    setAttemptErrors((prev) => ({ ...prev, [attemptId]: '' }))
  }

  const handleUploadDocument = async (refund, attempt, event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || uploadingKey !== null) return

    setAttemptErrors((prev) => ({ ...prev, [attempt.id]: '' }))
    try {
      validateNormalRefundDocument(file)
    } catch (validationErr) {
      setAttemptErrors((prev) => ({
        ...prev,
        [attempt.id]: mapReceptionRefundError(
          validationErr,
          language,
          isVi ? 'Tệp chứng từ không hợp lệ.' : 'Invalid document file.',
        ),
      }))
      return
    }

    const opKey = `${refund.id}-${attempt.id}`
    setUploadingKey(opKey)
    try {
      const documentId = await uploadNormalRefundDocument(refund.id, attempt.id, file, {
        notifyForbidden: false,
      })
      setUploadedDocsByAttempt((prev) => {
        const list = prev[attempt.id] || []
        const exists = list.some((doc) => doc.id === documentId)
        return {
          ...prev,
          [attempt.id]: exists
            ? list
            : [...list, { id: documentId, name: file.name || `document-${documentId}` }],
        }
      })
      showToast?.(
        isVi
          ? `Đã tải chứng từ #${documentId} (${file.name}).`
          : `Uploaded document #${documentId} (${file.name}).`,
        'success',
      )
      await fetchRefunds()
    } catch (err) {
      const normalized = getNormalRefundError(err)
      if (normalized.status === 403) {
        setForbidden(true)
        return
      }
      setAttemptErrors((prev) => ({
        ...prev,
        [attempt.id]: mapReceptionRefundError(
          err,
          language,
          isVi ? 'Tải chứng từ thất bại.' : 'Failed to upload document.',
        ),
      }))
      if (normalized.code === 'REFUND_VERSION_STALE') {
        await fetchRefunds()
      }
    } finally {
      setUploadingKey(null)
    }
  }

  const handleSubmitTransfer = async (refund, attempt, event) => {
    event.preventDefault()
    if (submittingKey !== null) return

    const form = getAttemptForm(refund, attempt)
    const reference = String(form.reference || '').trim()
    const existingDocIds = Array.isArray(attempt.documentIds) ? attempt.documentIds : []
    const sessionDocs = uploadedDocsByAttempt[attempt.id] || []
    const hasDocument = existingDocIds.length > 0 || sessionDocs.length > 0

    if (!hasDocument) {
      setAttemptErrors((prev) => ({
        ...prev,
        [attempt.id]: isVi
          ? 'Vui lòng tải lên ít nhất một chứng từ chuyển khoản trước khi nộp kết quả.'
          : 'Please upload at least one transfer document before submitting.',
      }))
      return
    }

    if (!reference) {
      setAttemptErrors((prev) => ({
        ...prev,
        [attempt.id]: isVi
          ? 'Vui lòng nhập mã tham chiếu chuyển khoản.'
          : 'Please enter the bank transfer reference.',
      }))
      return
    }

    const performedAtLocal = normalizeLocalDateTimePayload(form.performedAt)
    const parsedTime = Date.parse(performedAtLocal)
    if (!performedAtLocal || !Number.isFinite(parsedTime)) {
      setAttemptErrors((prev) => ({
        ...prev,
        [attempt.id]: isVi
          ? 'Vui lòng chọn thời gian chuyển khoản hợp lệ.'
          : 'Please select a valid transfer date and time.',
      }))
      return
    }

    if (parsedTime > Date.now()) {
      setAttemptErrors((prev) => ({
        ...prev,
        [attempt.id]: isVi
          ? 'Thời gian chuyển khoản không được nằm ở tương lai.'
          : 'Transfer time cannot be in the future.',
      }))
      return
    }

    const claimedAtRaw = attempt.claimedAt
    if (claimedAtRaw && Number.isFinite(Date.parse(claimedAtRaw)) && parsedTime < Date.parse(claimedAtRaw)) {
      setAttemptErrors((prev) => ({
        ...prev,
        [attempt.id]: isVi
          ? 'Thời gian chuyển khoản không được trước thời điểm nhận việc.'
          : 'Transfer time cannot be earlier than claim time.',
      }))
      return
    }

    const expectedAmount = typeof attempt.amount === 'number' ? attempt.amount : refund.amount
    const opKey = `${refund.id}-${attempt.id}`
    setSubmittingKey(opKey)
    setAttemptErrors((prev) => ({ ...prev, [attempt.id]: '' }))

    try {
      await submitNormalRefundTransfer(
        refund.id,
        attempt.id,
        {
          reference,
          amount: expectedAmount,
          performedAt: performedAtLocal,
        },
        { attempt, notifyForbidden: false },
      )
      showToast?.(
        isVi
          ? `Đã nộp kết quả chuyển khoản cho hồ sơ #${refund.id}.`
          : `Submitted transfer result for refund #${refund.id}.`,
        'success',
      )
      await fetchRefunds()
    } catch (err) {
      const normalized = getNormalRefundError(err)
      if (normalized.status === 403) {
        setForbidden(true)
        return
      }
      setAttemptErrors((prev) => ({
        ...prev,
        [attempt.id]: mapReceptionRefundError(
          err,
          language,
          isVi ? 'Không thể nộp kết quả chuyển khoản.' : 'Failed to submit transfer result.',
        ),
      }))
      if (normalized.code === 'REFUND_VERSION_STALE') {
        await fetchRefunds()
      }
    } finally {
      setSubmittingKey(null)
    }
  }

  const getClassDisplay = (classId) => {
    if (classId === null || classId === undefined || classId === '') {
      return isVi ? 'Không rõ lớp' : 'Unknown class'
    }
    const found = classNameMap.get(String(classId))
    if (found) return found
    return isVi ? `Lớp #${classId}` : `Class #${classId}`
  }

  const getStatusLabel = (status) => {
    const entry = STATUS_LABELS[status]
    if (!entry) return status || '—'
    return isVi ? entry.vi : entry.en
  }

  const renderAttemptSection = (refund) => {
    const attempts = Array.isArray(refund.attempts) ? refund.attempts : []

    if (refund.status === 'Approved') {
      const isClaiming = claimingId === refund.id
      const claimError = claimErrors[refund.id]
      return (
        <div className="space-y-2">
          <button
            type="button"
            className={buttonPrimary}
            disabled={claimingId !== null}
            onClick={() => handleClaim(refund)}
          >
            {isClaiming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            <span>{isVi ? 'Nhận việc' : 'Claim task'}</span>
          </button>
          {claimError ? (
            <p role="alert" className="text-xs font-medium text-status-danger">
              {claimError}
            </p>
          ) : null}
        </div>
      )
    }

    if (refund.status === 'Processing') {
      const activeAttempt =
        attempts.find((a) => a?.status === 'Claimed' || a?.status === 'Submitted') || attempts[0]

      if (!activeAttempt) {
        return (
          <p className="text-xs text-text-secondary">
            {isVi ? 'Chưa có thông tin lần chuyển khoản.' : 'No active transfer attempt.'}
          </p>
        )
      }

      if (currentUserId === null || currentUserId === undefined || currentUserId === '') {
        return (
          <p className="text-xs font-medium text-status-warning">
            {isVi
              ? 'Không xác định được mã tài khoản hiện tại nên chưa thể thao tác.'
              : 'Current user ID is unavailable; actions are disabled.'}
          </p>
        )
      }

      const isMine = String(activeAttempt.claimedBy) === String(currentUserId)
      if (!isMine) {
        return (
          <p className="text-xs font-medium text-text-secondary">
            {isVi ? 'Đã được nhận bởi nhân viên khác' : 'Claimed by another staff member'}
          </p>
        )
      }

      const opKey = `${refund.id}-${activeAttempt.id}`
      const isUploading = uploadingKey === opKey
      const isSubmitting = submittingKey === opKey
      const form = getAttemptForm(refund, activeAttempt)
      const sessionDocs = uploadedDocsByAttempt[activeAttempt.id] || []
      const backendDocIds = Array.isArray(activeAttempt.documentIds) ? activeAttempt.documentIds : []
      const mergedDocIds = Array.from(
        new Set([...backendDocIds, ...sessionDocs.map((d) => d.id)]),
      )
      const expectedAmount =
        typeof activeAttempt.amount === 'number' ? activeAttempt.amount : refund.amount
      const attemptErr = attemptErrors[activeAttempt.id]

      const fileInputId = `doc-upload-${refund.id}-${activeAttempt.id}`
      const refInputId = `ref-input-${refund.id}-${activeAttempt.id}`
      const amountInputId = `amount-input-${refund.id}-${activeAttempt.id}`
      const timeInputId = `time-input-${refund.id}-${activeAttempt.id}`

      return (
        <div className="mt-2 space-y-3 rounded-lg border border-border-color bg-bg-main p-3">
          {/* Tải chứng từ */}
          <div className="space-y-2">
            <p className="block text-xs font-semibold leading-4 text-text-primary">
              {isVi
                ? 'Chứng từ chuyển khoản (PNG, JPEG, PDF, tối đa 5 MiB)'
                : 'Transfer document (PNG, JPEG, PDF, max 5 MiB)'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor={fileInputId}
                className={`${buttonSecondary} cursor-pointer ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Upload className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{isVi ? 'Tải chứng từ' : 'Upload document'}</span>
              </label>
              <input
                id={fileInputId}
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                className="sr-only"
                disabled={isUploading || isSubmitting}
                onChange={(e) => handleUploadDocument(refund, activeAttempt, e)}
              />
            </div>
            {mergedDocIds.length > 0 ? (
              <ul className="space-y-1 text-xs text-text-secondary">
                {mergedDocIds.map((docId) => {
                  const found = sessionDocs.find((d) => d.id === docId)
                  return (
                    <li key={docId} className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-brand-primary shrink-0" aria-hidden="true" />
                      <span>
                        {found ? `${found.name} — ` : ''}
                        {isVi ? `Mã chứng từ #${docId}` : `Document #${docId}`}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-xs text-text-muted">
                {isVi
                  ? 'Chưa có chứng từ nào được tải lên.'
                  : 'No document uploaded yet.'}
              </p>
            )}
          </div>

          {/* Form nộp kết quả */}
          <form onSubmit={(e) => handleSubmitTransfer(refund, activeAttempt, e)} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label
                  htmlFor={refInputId}
                  className="mb-1 block text-xs font-semibold leading-4 text-text-primary"
                >
                  {isVi ? 'Mã tham chiếu ngân hàng' : 'Bank reference'}
                </label>
                <input
                  id={refInputId}
                  type="text"
                  maxLength={120}
                  value={form.reference}
                  onChange={(e) =>
                    updateAttemptForm(activeAttempt.id, { reference: e.target.value })
                  }
                  placeholder={isVi ? 'VD: FT2632012345' : 'e.g. FT2632012345'}
                  className={inputClass}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label
                  htmlFor={amountInputId}
                  className="mb-1 block text-xs font-semibold leading-4 text-text-primary"
                >
                  {isVi ? 'Số tiền (VND)' : 'Amount (VND)'}
                </label>
                <input
                  id={amountInputId}
                  type="text"
                  readOnly
                  value={expectedAmount ?? ''}
                  aria-readonly="true"
                  className={`${inputClass} bg-bg-secondary tabular-nums`}
                />
              </div>
              <div>
                <label
                  htmlFor={timeInputId}
                  className="mb-1 block text-xs font-semibold leading-4 text-text-primary"
                >
                  {isVi ? 'Thời gian chuyển' : 'Transfer time'}
                </label>
                <input
                  id={timeInputId}
                  type="datetime-local"
                  value={form.performedAt}
                  onChange={(e) =>
                    updateAttemptForm(activeAttempt.id, { performedAt: e.target.value })
                  }
                  className={inputClass}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {attemptErr ? (
              <p role="alert" className="text-xs font-medium text-status-danger">
                {attemptErr}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className={buttonPrimary}
                disabled={isSubmitting || isUploading}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{isVi ? 'Nộp kết quả chuyển khoản' : 'Submit transfer result'}</span>
              </button>
            </div>
          </form>
        </div>
      )
    }

    // AwaitingVerification, NeedsReview, Completed -> chỉ xem
    const latestAttempt = attempts[attempts.length - 1] || attempts[0]
    const statusNote =
      refund.status === 'AwaitingVerification'
        ? isVi
          ? 'Đang chờ Manager đối soát'
          : 'Awaiting Manager verification'
        : refund.status === 'NeedsReview'
          ? isVi
            ? 'Cần xem lại'
            : 'Needs review'
          : isVi
            ? 'Hoàn tất'
            : 'Completed'

    return (
      <div className="space-y-1 text-xs text-text-secondary">
        <p className="font-semibold text-text-primary">{statusNote}</p>
        {latestAttempt ? (
          <div className="space-y-0.5 tabular-nums">
            <p>
              {isVi ? 'Tham chiếu:' : 'Reference:'}{' '}
              <span className="font-medium text-text-primary">
                {latestAttempt.bankReference || '—'}
              </span>
            </p>
            <p>
              {isVi ? 'Thời gian:' : 'Time:'}{' '}
              <span>{latestAttempt.performedAt ? formatDateTime(latestAttempt.performedAt) : '—'}</span>
            </p>
            <p>
              {isVi ? 'Số chứng từ:' : 'Documents:'}{' '}
              <span>{Array.isArray(latestAttempt.documentIds) ? latestAttempt.documentIds.length : 0}</span>
            </p>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <section aria-labelledby={headingId} className="space-y-4 font-sans text-text-primary min-w-0">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-brand-blue-soft p-2.5 text-brand-primary shrink-0">
            <ReceiptText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 id={headingId} className="text-2xl font-semibold tracking-tight text-slate-900 leading-snug text-balance">
              {isVi ? 'Việc hoàn tiền' : 'Refund work'}
            </h1>
            <p className="mt-1 text-sm text-slate-500 leading-relaxed">
              {isVi
                ? 'Nhận hồ sơ đã duyệt, tải chứng từ và nộp kết quả chuyển khoản.'
                : 'Claim approved refunds, upload transfer documents, and submit results.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchRefunds}
          disabled={loading}
          className={buttonSecondary}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>{isVi ? 'Tải lại' : 'Refresh'}</span>
        </button>
      </div>

      {/* Trạng thái không có quyền */}
      {forbidden ? (
        <div
          role="alert"
          className="rounded-lg border border-status-danger-border bg-status-danger-bg p-6 text-sm leading-5 text-status-danger"
        >
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-semibold">
                {isVi
                  ? 'Bạn không có quyền xử lý hoàn tiền'
                  : 'You do not have permission to process refunds'}
              </p>
              <p className="text-xs">
                {isVi
                  ? 'Tài khoản cần vai trò Lễ tân và quyền MANAGE_INVOICES.'
                  : 'Receptionist role with MANAGE_INVOICES authority is required.'}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Nội dung chính khi có quyền */}
      {!forbidden ? (
        <>
          {/* Bộ lọc trạng thái */}
          <div
            role="tablist"
            aria-label={isVi ? 'Lọc theo trạng thái hoàn tiền' : 'Filter by refund status'}
            className="flex flex-wrap gap-2"
          >
            {STATUS_TABS.map((tab) => {
              const selected = activeTab === tab.key
              const count = counts[tab.key] ?? 0
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1 ${
                    selected
                      ? 'border-brand-primary bg-brand-primary text-white'
                      : 'border-border-color bg-white text-text-primary hover:bg-bg-secondary'
                  }`}
                >
                  <span>{isVi ? tab.vi : tab.en}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${
                      selected ? 'bg-white/20 text-white' : 'bg-bg-secondary text-text-secondary'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Trạng thái đang tải */}
          {loading ? (
            <div className="space-y-3 rounded-lg border border-border-color bg-white p-4">
              <div className="h-6 w-48 animate-pulse rounded-md bg-bg-secondary motion-reduce:animate-none" />
              <div className="h-12 w-full animate-pulse rounded-md bg-bg-secondary motion-reduce:animate-none" />
              <div className="h-12 w-full animate-pulse rounded-md bg-bg-secondary motion-reduce:animate-none" />
            </div>
          ) : null}

          {/* Trạng thái lỗi */}
          {!loading && error ? (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-lg border border-status-danger-border bg-status-danger-bg p-4 text-sm leading-5 text-status-danger sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
              <button type="button" onClick={fetchRefunds} className={buttonSecondary}>
                {isVi ? 'Thử lại' : 'Retry'}
              </button>
            </div>
          ) : null}

          {/* Trạng thái trống */}
          {!loading && !error && visibleRefunds.length === 0 ? (
            <div className="rounded-lg border border-border-color bg-white px-6 py-10 text-center text-sm leading-5 text-text-secondary">
              {isVi ? 'Không có việc hoàn tiền nào' : 'No refund tasks found'}
            </div>
          ) : null}

          {/* Danh sách hồ sơ */}
          {!loading && !error && visibleRefunds.length > 0 ? (
            <div className="space-y-4">
              {visibleRefunds.map((refund) => (
                <article
                  key={refund.id}
                  className="rounded-lg border border-border-color bg-white p-4 shadow-sm"
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-start">
                    <div className="space-y-1 md:col-span-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold leading-5 text-text-primary tabular-nums">
                          #{refund.id}
                        </span>
                        <span className={statusBadgeClass(refund.status)}>
                          {getStatusLabel(refund.status)}
                        </span>
                        {refund.overdue === true ? (
                          <span className="inline-flex min-h-6 items-center gap-1 rounded-full border border-status-danger-border bg-status-danger-bg px-2.5 py-1 text-xs font-semibold leading-4 text-status-danger">
                            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{isVi ? 'Quá hạn' : 'Overdue'}</span>
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm leading-5 text-text-secondary">
                        {getClassDisplay(refund.classId)}
                      </p>
                      <p className="text-xs leading-4 text-text-muted tabular-nums">
                        {isVi ? 'Hóa đơn:' : 'Invoice:'} #{refund.invoiceId ?? '—'}
                      </p>
                    </div>

                    <div className="space-y-1 md:col-span-3">
                      <p className="text-xs font-semibold leading-4 text-text-secondary">
                        {isVi ? 'Số tiền & Hạn chuyển' : 'Amount & Due date'}
                      </p>
                      <p className="text-sm font-bold leading-5 text-text-primary tabular-nums">
                        {formatCurrency(refund.amount ?? 0)}
                      </p>
                      <p className="text-xs leading-4 text-text-secondary tabular-nums">
                        {isVi ? 'Hạn:' : 'Due:'}{' '}
                        {refund.dueAt ? formatDateTime(refund.dueAt) : '—'}
                      </p>
                    </div>

                    <div className="space-y-1 md:col-span-4 min-w-0">
                      <p className="text-xs font-semibold leading-4 text-text-secondary">
                        {isVi ? 'Người nhận & Liên hệ' : 'Recipient & Contact'}
                      </p>
                      <p className="text-sm leading-5 text-text-primary break-words">
                        {refund.bank || '—'} · {refund.accountName || '—'}
                      </p>
                      <p className="text-sm font-medium leading-5 text-text-primary tabular-nums break-all">
                        {refund.accountNumber || '—'}
                      </p>
                      <p className="text-xs leading-4 text-text-secondary tabular-nums">
                        {isVi ? 'SĐT:' : 'Phone:'} {refund.contactPhone || '—'}
                      </p>
                      {refund.issueNote ? (
                        <p className="mt-1 rounded border border-status-warning-border bg-status-warning-bg px-2.5 py-1.5 text-xs leading-4 text-status-warning break-words">
                          {isVi ? 'Ghi chú:' : 'Issue:'} {refund.issueNote}
                        </p>
                      ) : null}
                    </div>

                    <div className="md:col-span-2 md:text-right">
                      <p className="text-xs leading-4 text-text-muted tabular-nums">
                        v{refund.version ?? 0}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-border-color pt-3">
                    {renderAttemptSection(refund)}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

export default ReceptionRefundWorkView
