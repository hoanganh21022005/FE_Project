import React, { useCallback, useEffect, useRef, useState } from "react"
import { AlertCircle, Landmark, RefreshCw } from "lucide-react"
import { getNormalRefunds } from "../../api/normalRefundApi"
import { submitNormalRefundReceiver } from "../../api/normalRefundTransferApi"
import { getErrorMessage } from "../../api/apiErrors"

const STATUS_LABELS = {
  awaitingreceiver: { vi: "Cần khai tài khoản nhận", en: "Receiving account needed", tone: "bg-amber-100 text-amber-900" },
  awaitingapproval: { vi: "Chờ trung tâm duyệt", en: "Awaiting center approval", tone: "bg-blue-100 text-blue-900" },
  approved: { vi: "Đã duyệt, chờ chuyển khoản", en: "Approved, transfer pending", tone: "bg-blue-100 text-blue-900" },
  processing: { vi: "Đang chuyển khoản", en: "Transfer in progress", tone: "bg-blue-100 text-blue-900" },
  awaitingverification: { vi: "Chờ đối soát", en: "Awaiting verification", tone: "bg-blue-100 text-blue-900" },
  needsreview: { vi: "Trung tâm đang xem lại", en: "Under center review", tone: "bg-amber-100 text-amber-900" },
  completed: { vi: "Đã hoàn tất", en: "Completed", tone: "bg-emerald-100 text-emerald-900" },
}

const ORIGIN_LABELS = {
  centercancellation: { vi: "Trung tâm hủy lớp", en: "Class cancelled by the center" },
  memberchoice: { vi: "Bạn chọn hoàn tiền", en: "Refund chosen by you" },
  latereceipt: { vi: "Khoản thu đến sau khi lớp bị hủy", en: "Payment received after class cancellation" },
}

const ACCOUNT_NUMBER_PATTERN = /^[A-Za-z0-9]{4,40}$/
const key = (value) => String(value || "").replace(/[^A-Za-z]/g, "").toLowerCase()

const formatMoney = (value) =>
  typeof value === "number" && Number.isFinite(value)
    ? `${new Intl.NumberFormat("vi-VN").format(value)} ₫`
    : "–"

const formatDateTime = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T?(\d{2})?:?(\d{2})?/.exec(String(value || ""))
  if (!match) return "–"
  const time = match[4] ? ` ${match[4]}:${match[5] ?? "00"}` : ""
  return `${match[3]}/${match[2]}/${match[1]}${time}`
}

const errorText = (error) =>
  String(
    error?.code || error?.details?.code || error?.response?.data?.code ||
      error?.message || error?.details?.message || "",
  ).toUpperCase()

const EMPTY_FORM = { bank: "", accountName: "", accountNumber: "", accountNumberConfirm: "" }

/**
 * Member theo dõi các khoản hoàn tiền lớp Normal của mình và khai tài khoản nhận hoàn tiền.
 * Backend chỉ nhận khai báo khi hồ sơ ở AwaitingReceiver hoặc AwaitingApproval (khai lại sẽ
 * đặt lại bước duyệt). Số tài khoản Backend trả về bị che đối với Member; không lưu số tài
 * khoản vào bộ nhớ trình duyệt và không ghi log.
 */
export function MemberRefundPanel({ language, showToast }) {
  const isVi = language === "vi"
  const [refunds, setRefunds] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState("")
  const [submittingId, setSubmittingId] = useState(null)
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestRef.current
    setLoading(true)
    setLoadError("")
    try {
      const list = await getNormalRefunds()
      if (requestId !== requestRef.current) return
      setRefunds(list)
    } catch (error) {
      if (requestId !== requestRef.current) return
      const status = Number(error?.status ?? error?.response?.status) || 0
      setRefunds([])
      // 403/404: tài khoản không có hồ sơ hoàn tiền, không phải lỗi cần báo.
      if (![403, 404].includes(status)) {
        setLoadError(getErrorMessage(error, isVi ? "Không tải được các khoản hoàn tiền." : "Could not load refunds."))
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [isVi])

  useEffect(() => {
    load()
    return () => {
      requestRef.current += 1
    }
  }, [load])

  const openForm = (refund) => {
    setEditingId(refund.id)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setFormError("")
  }

  const closeForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
    setFormError("")
  }

  const validate = () => {
    const errors = {}
    const bank = form.bank.trim()
    const accountName = form.accountName.trim()
    if (!bank) errors.bank = isVi ? "Nhập tên ngân hàng." : "Enter the bank name."
    else if (bank.length > 120) errors.bank = isVi ? "Tên ngân hàng tối đa 120 ký tự." : "Bank name is at most 120 characters."
    if (!accountName) errors.accountName = isVi ? "Nhập tên chủ tài khoản." : "Enter the account holder name."
    else if (accountName.length > 150) errors.accountName = isVi ? "Tên chủ tài khoản tối đa 150 ký tự." : "Account holder name is at most 150 characters."
    if (!ACCOUNT_NUMBER_PATTERN.test(form.accountNumber)) {
      errors.accountNumber = isVi ? "Số tài khoản gồm 4 đến 40 chữ cái hoặc chữ số, không có khoảng trắng." : "Account number is 4 to 40 letters or digits, no spaces."
    } else if (form.accountNumber !== form.accountNumberConfirm) {
      errors.accountNumberConfirm = isVi ? "Số tài khoản nhập lại chưa khớp." : "The account numbers do not match."
    }
    return errors
  }

  const submit = async (event, refund) => {
    event.preventDefault()
    if (submittingId != null) return
    const errors = validate()
    setFieldErrors(errors)
    setFormError("")
    if (Object.keys(errors).length > 0) return
    setSubmittingId(refund.id)
    try {
      await submitNormalRefundReceiver(refund, {
        bank: form.bank,
        accountName: form.accountName,
        accountNumber: form.accountNumber,
      })
      closeForm()
      showToast?.(
        isVi ? "Đã gửi tài khoản nhận hoàn tiền. Trung tâm sẽ kiểm tra và duyệt." : "Receiving account sent. The center will verify and approve it.",
        "success",
      )
      await load()
    } catch (error) {
      const code = errorText(error)
      const status = Number(error?.status ?? error?.response?.status) || 0
      if (code.includes("REFUND_VERSION_STALE")) {
        setFormError(isVi ? "Hồ sơ vừa được cập nhật. Đã tải lại, vui lòng kiểm tra rồi gửi lại." : "The case was just updated. It was reloaded; please review and send again.")
        await load()
      } else if (code.includes("RECEIVER_INVALID")) {
        setFormError(isVi ? "Thông tin tài khoản chưa hợp lệ. Kiểm tra lại số tài khoản (4 đến 40 chữ/số)." : "The account details are not valid. Check the account number (4 to 40 letters/digits).")
      } else if (code.includes("REFUND_BANK_ATTEMPT_EXISTS")) {
        setFormError(isVi ? "Khoản này đã có giao dịch chuyển khoản, không thể đổi tài khoản nhận nữa." : "A bank transfer already exists for this refund; the account can no longer be changed.")
      } else if (status === 403) {
        setFormError(isVi ? "Bạn không có quyền khai tài khoản cho khoản hoàn tiền này." : "You cannot set the account for this refund.")
      } else {
        setFormError(getErrorMessage(error, isVi ? "Không gửi được tài khoản nhận. Vui lòng thử lại." : "Could not send the account. Please try again."))
      }
    } finally {
      setSubmittingId(null)
    }
  }

  const setField = (name) => (event) => {
    const value = event.target.value
    setForm((prev) => ({ ...prev, [name]: value }))
    setFieldErrors((prev) => ({ ...prev, [name]: "" }))
  }

  if (!loading && refunds.length === 0 && !loadError) return null

  const inputClass = (name) =>
    `min-h-11 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 ${
      fieldErrors[name] ? "border-rose-400" : "border-slate-300"
    }`

  return (
    <section
      aria-label={isVi ? "Hoàn tiền của tôi" : "My refunds"}
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <Landmark size={20} />
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-900">{isVi ? "Hoàn tiền của tôi" : "My refunds"}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {isVi
                ? "Khoản hoàn tiền lớp Normal được chuyển khoản vào tài khoản bạn khai báo, ngoài hệ thống. Hãy khai báo chính xác để tránh chậm trễ."
                : "Normal class refunds are paid by bank transfer to the account you declare, outside this system. Please enter it carefully to avoid delays."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          {isVi ? "Tải lại" : "Reload"}
        </button>
      </div>

      {loadError && (
        <p role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle size={16} className="shrink-0" />
          {loadError}
        </p>
      )}

      {refunds.map((refund) => {
        const status = STATUS_LABELS[key(refund.status)]
        const origin = ORIGIN_LABELS[key(refund.origin)]
        const canDeclare = ["awaitingreceiver", "awaitingapproval"].includes(key(refund.status))
        const hasReceiver = Boolean(refund.bank || refund.accountName || refund.accountNumber)
        const editing = editingId === refund.id
        const busy = submittingId === refund.id
        return (
          <article key={refund.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${status?.tone || "bg-slate-100 text-slate-800"}`}>
                {status ? (isVi ? status.vi : status.en) : refund.status || "–"}
              </span>
              <h3 className="text-sm font-bold text-slate-900">
                {isVi ? `Hoàn tiền #${refund.id}` : `Refund #${refund.id}`}
              </h3>
            </div>
            <dl className="grid gap-x-6 gap-y-1 text-sm text-slate-700 sm:grid-cols-2">
              <div><dt className="inline font-semibold">{isVi ? "Số tiền: " : "Amount: "}</dt><dd className="inline">{formatMoney(refund.amount)}</dd></div>
              {origin && <div><dt className="inline font-semibold">{isVi ? "Lý do: " : "Reason: "}</dt><dd className="inline">{isVi ? origin.vi : origin.en}</dd></div>}
              {(refund.dueAt || refund.firstDueAt) && (
                <div><dt className="inline font-semibold">{isVi ? "Dự kiến chuyển trước: " : "Expected by: "}</dt><dd className="inline">{formatDateTime(refund.dueAt || refund.firstDueAt)}</dd></div>
              )}
              {hasReceiver && (
                <div className="sm:col-span-2">
                  <dt className="inline font-semibold">{isVi ? "Tài khoản nhận: " : "Receiving account: "}</dt>
                  <dd className="inline">
                    {[refund.accountName, refund.bank, refund.accountNumber].filter(Boolean).join(" · ")}
                    {refund.receiverVerified ? (isVi ? " (đã xác minh)" : " (verified)") : ""}
                  </dd>
                </div>
              )}
            </dl>

            {canDeclare && !editing && (
              <button
                type="button"
                onClick={() => openForm(refund)}
                className="inline-flex min-h-11 items-center rounded-lg bg-brand-primary px-4 text-sm font-bold text-white hover:bg-brand-primary-hover"
              >
                {hasReceiver ? (isVi ? "Khai lại tài khoản nhận" : "Update receiving account") : (isVi ? "Khai tài khoản nhận hoàn tiền" : "Declare receiving account")}
              </button>
            )}
            {!canDeclare && key(refund.status) === "approved" && (
              <p className="text-sm text-slate-600">
                {isVi ? "Tài khoản đã được duyệt. Nhân viên sẽ chuyển khoản; bạn không cần làm thêm." : "Your account was approved. Staff will transfer the money; no further action needed."}
              </p>
            )}

            {canDeclare && editing && (
              <form onSubmit={(event) => submit(event, refund)} noValidate autoComplete="off" className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                {hasReceiver && (
                  <p className="text-sm text-amber-900">
                    {isVi ? "Khai lại sẽ thay tài khoản đã gửi và trung tâm phải duyệt lại." : "Updating replaces the account you sent and the center must approve it again."}
                  </p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`refund-bank-${refund.id}`} className="mb-1 block text-xs font-semibold text-slate-700">{isVi ? "Ngân hàng *" : "Bank *"}</label>
                    <input id={`refund-bank-${refund.id}`} value={form.bank} onChange={setField("bank")} maxLength={120} autoComplete="off" aria-invalid={Boolean(fieldErrors.bank)} className={inputClass("bank")} />
                    {fieldErrors.bank && <p role="alert" className="mt-1 text-xs text-rose-700">{fieldErrors.bank}</p>}
                  </div>
                  <div>
                    <label htmlFor={`refund-name-${refund.id}`} className="mb-1 block text-xs font-semibold text-slate-700">{isVi ? "Tên chủ tài khoản *" : "Account holder *"}</label>
                    <input id={`refund-name-${refund.id}`} value={form.accountName} onChange={setField("accountName")} maxLength={150} autoComplete="off" aria-invalid={Boolean(fieldErrors.accountName)} className={inputClass("accountName")} />
                    {fieldErrors.accountName && <p role="alert" className="mt-1 text-xs text-rose-700">{fieldErrors.accountName}</p>}
                  </div>
                  <div>
                    <label htmlFor={`refund-number-${refund.id}`} className="mb-1 block text-xs font-semibold text-slate-700">{isVi ? "Số tài khoản *" : "Account number *"}</label>
                    <input id={`refund-number-${refund.id}`} value={form.accountNumber} onChange={setField("accountNumber")} maxLength={40} inputMode="text" autoComplete="off" aria-invalid={Boolean(fieldErrors.accountNumber)} className={inputClass("accountNumber")} />
                    {fieldErrors.accountNumber && <p role="alert" className="mt-1 text-xs text-rose-700">{fieldErrors.accountNumber}</p>}
                  </div>
                  <div>
                    <label htmlFor={`refund-number2-${refund.id}`} className="mb-1 block text-xs font-semibold text-slate-700">{isVi ? "Nhập lại số tài khoản *" : "Re-enter account number *"}</label>
                    <input id={`refund-number2-${refund.id}`} value={form.accountNumberConfirm} onChange={setField("accountNumberConfirm")} maxLength={40} inputMode="text" autoComplete="off" aria-invalid={Boolean(fieldErrors.accountNumberConfirm)} className={inputClass("accountNumberConfirm")} />
                    {fieldErrors.accountNumberConfirm && <p role="alert" className="mt-1 text-xs text-rose-700">{fieldErrors.accountNumberConfirm}</p>}
                  </div>
                </div>
                {formError && (
                  <p role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                    <AlertCircle size={16} className="shrink-0" />
                    {formError}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex min-h-11 items-center rounded-lg bg-brand-primary px-4 text-sm font-bold text-white hover:bg-brand-primary-hover disabled:opacity-60"
                  >
                    {busy ? (isVi ? "Đang gửi..." : "Sending...") : (isVi ? "Gửi tài khoản nhận" : "Send account")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={closeForm}
                    className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {isVi ? "Hủy" : "Cancel"}
                  </button>
                </div>
              </form>
            )}
          </article>
        )
      })}
    </section>
  )
}
