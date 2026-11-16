import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, CalendarClock, RefreshCw } from "lucide-react"
import { getNormalClassProposals } from "../../api/normalClassLifecycleApi"
import {
  buildNormalProposalChoiceRequest,
  respondNormalProposal,
} from "../../api/normalProposalResponseApi"
import { memberCourseCatalogApi } from "../../api/memberCourseCatalogApi"
import { getErrorMessage } from "../../api/apiErrors"

const MAX_CLASSES = 20

const formatDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""))
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "–"
}

const formatTime = (value) => {
  if (typeof value === "string") return value.slice(0, 5)
  if (value && typeof value === "object" && Number.isInteger(value.hour)) {
    return `${String(value.hour).padStart(2, "0")}:${String(value.minute ?? 0).padStart(2, "0")}`
  }
  return "–"
}

const errorCode = (error) =>
  String(
    error?.code || error?.details?.code || error?.response?.data?.code ||
      error?.message || error?.details?.message || "",
  ).toUpperCase()

// Đề xuất còn hiệu lực mà chính Member này chưa chọn (Backend chỉ trả lựa chọn của chính Member).
const isAwaitingMyChoice = (proposal) =>
  String(proposal?.status || "").toLowerCase() === "pending" &&
  Array.isArray(proposal?.choices) &&
  proposal.choices.some((choice) => String(choice?.choice || "").toLowerCase() === "waiting")

/**
 * Member phản hồi đề xuất dời khai giảng / chuyển lớp Normal của trung tâm.
 * Chỉ hiện khi có đề xuất đang chờ chính Member này chọn. Backend là nơi kiểm quyền và trạng thái.
 */
export function NormalProposalResponsePanel({ enrollments, language, showToast, onResponded }) {
  const isVi = language === "vi"
  // Khóa chuỗi ổn định theo danh sách lớp: cha có thể truyền mảng mới ở mỗi lần render,
  // không được vì thế mà tải lại đề xuất liên tục.
  const classKey = useMemo(() => {
    const ids = []
    for (const row of Array.isArray(enrollments) ? enrollments : []) {
      const id = Number(row?.classId ?? row?.sportsClassId)
      if (Number.isInteger(id) && id > 0 && !ids.includes(id)) ids.push(id)
    }
    return ids.slice(0, MAX_CLASSES).join(",")
  }, [enrollments])
  const classIds = useMemo(() => (classKey ? classKey.split(",").map(Number) : []), [classKey])
  const classNames = useMemo(() => {
    const map = {}
    for (const row of Array.isArray(enrollments) ? enrollments : []) {
      const id = row?.classId ?? row?.sportsClassId
      if (id != null) map[String(id)] = row?.className || row?.courseName || row?.name
    }
    return map
  }, [enrollments])

  const [proposals, setProposals] = useState([])
  const [targetNames, setTargetNames] = useState({})
  const [loadError, setLoadError] = useState("")
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [confirmRefundId, setConfirmRefundId] = useState(null)
  const [actionError, setActionError] = useState({})
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    const requestId = ++requestRef.current
    if (classIds.length === 0) {
      setProposals([])
      return
    }
    setLoading(true)
    setLoadError("")
    const results = await Promise.all(
      classIds.map((classId) =>
        getNormalClassProposals(classId)
          .then((list) => ({ classId, list }))
          .catch((error) => ({ classId, error })),
      ),
    )
    if (requestId !== requestRef.current) return
    const pending = []
    let failure = null
    for (const result of results) {
      if (result.error) {
        const status = Number(result.error?.status ?? result.error?.response?.status) || 0
        // 403/404: lớp không có đề xuất dành cho Member này, không phải lỗi cần báo.
        if (![403, 404].includes(status)) failure = failure || result.error
        continue
      }
      for (const proposal of result.list) {
        if (isAwaitingMyChoice(proposal)) pending.push({ ...proposal, classId: proposal.classId ?? result.classId })
      }
    }
    setProposals(pending)
    setLoadError(
      failure
        ? getErrorMessage(failure, isVi ? "Không tải được đề xuất của trung tâm." : "Could not load center proposals.")
        : "",
    )
    setLoading(false)
  }, [classIds, isVi])

  useEffect(() => {
    load()
    return () => {
      requestRef.current += 1
    }
  }, [load])

  // Tên lớp đích chỉ cần khi có đề xuất chuyển lớp; lỗi thì hiện mã lớp.
  const needsTargetNames = proposals.some((proposal) => proposal.targetClassId != null)
  useEffect(() => {
    if (!needsTargetNames) return undefined
    let active = true
    memberCourseCatalogApi
      .getMemberCourseClasses()
      .then((list) => {
        if (active) setTargetNames(Object.fromEntries(list.filter((item) => item.id != null).map((item) => [String(item.id), item.name])))
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [needsTargetNames])

  const respond = async (proposal, choice) => {
    if (busyId != null) return
    setBusyId(proposal.id)
    setActionError((prev) => ({ ...prev, [proposal.id]: "" }))
    try {
      await respondNormalProposal(proposal.id, buildNormalProposalChoiceRequest(proposal, choice))
      setConfirmRefundId(null)
      showToast?.(
        choice === "Refund"
          ? (isVi ? "Đã ghi nhận lựa chọn hoàn tiền." : "Your refund choice has been recorded.")
          : (isVi ? "Đã ghi nhận bạn đồng ý với đề xuất." : "Your acceptance has been recorded."),
        "success",
      )
      await load()
      onResponded?.()
    } catch (error) {
      const code = errorCode(error)
      const status = Number(error?.status ?? error?.response?.status) || 0
      let message
      let reload = false
      if (code.includes("NORMAL_PROPOSAL_STALE")) {
        message = isVi
          ? "Đề xuất đã thay đổi. Đã tải lại đề xuất mới, vui lòng xem lại trước khi chọn."
          : "The proposal has changed. It was reloaded; please review it before choosing."
        reload = true
      } else if (code.includes("NORMAL_CHOICE_ALREADY_RECORDED")) {
        message = isVi ? "Bạn đã chọn khác cho đề xuất này trước đó." : "You already recorded a different choice for this proposal."
        reload = true
      } else if (status === 403) {
        message = isVi ? "Bạn không có quyền phản hồi đề xuất này." : "You cannot respond to this proposal."
      } else {
        message = getErrorMessage(error, isVi ? "Không gửi được phản hồi. Vui lòng thử lại." : "Could not send your response. Please try again.")
      }
      setActionError((prev) => ({ ...prev, [proposal.id]: message }))
      if (reload) await load()
    } finally {
      setBusyId(null)
    }
  }

  if (!loading && proposals.length === 0 && !loadError) return null

  return (
    <section
      aria-label={isVi ? "Đề xuất thay đổi lớp cần bạn phản hồi" : "Class change proposals awaiting your response"}
      className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">
            <CalendarClock size={20} />
          </span>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {isVi ? "Trung tâm đề xuất thay đổi lớp, cần bạn phản hồi" : "The center proposed a class change and needs your response"}
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              {isVi
                ? "Hãy xem lịch cụ thể rồi chọn đồng ý hoặc từ chối và hoàn tiền. Không phản hồi không được tính là đồng ý."
                : "Review the concrete schedule, then accept or decline and request a refund. Not responding does not count as consent."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-amber-100 disabled:opacity-60"
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

      {proposals.map((proposal) => {
        const isTransfer = String(proposal.kind || "").toLowerCase() === "transfer"
        const schedule = Array.isArray(proposal.schedule) ? proposal.schedule : []
        const first = schedule[0]
        const last = schedule[schedule.length - 1]
        const sourceName = classNames[String(proposal.classId)] || (isVi ? `Lớp #${proposal.classId}` : `Class #${proposal.classId}`)
        const targetName = targetNames[String(proposal.targetClassId)] || (isVi ? `Lớp #${proposal.targetClassId}` : `Class #${proposal.targetClassId}`)
        const busy = busyId === proposal.id
        return (
          <article key={proposal.id} className="space-y-3 rounded-xl border border-amber-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                {isTransfer ? (isVi ? "Chuyển lớp" : "Class transfer") : (isVi ? "Dời khai giảng" : "Postponed start")}
              </span>
              <h3 className="text-sm font-bold text-slate-900">{sourceName}</h3>
            </div>
            {isTransfer ? (
              <p className="text-sm text-slate-700">
                {isVi ? "Chuyển sang lớp: " : "Transfer to: "}<strong>{targetName}</strong>
              </p>
            ) : (
              <p className="text-sm text-slate-700">
                {isVi ? `Dời toàn bộ lịch thêm ${proposal.shiftDays ?? "?"} ngày.` : `Whole schedule moves by ${proposal.shiftDays ?? "?"} days.`}
              </p>
            )}
            {first && last && (
              <p className="text-sm text-slate-700">
                {isVi ? "Lịch mới: " : "New schedule: "}
                <strong>{formatDate(first.date)}</strong> → <strong>{formatDate(last.date)}</strong>
                {` (${schedule.length} ${isVi ? "buổi" : "sessions"})`}
              </p>
            )}
            {proposal.reason && (
              <p className="text-sm text-slate-700">
                <span className="font-semibold">{isVi ? "Lý do: " : "Reason: "}</span>{proposal.reason}
              </p>
            )}
            {schedule.length > 0 && (
              <details className="text-sm text-slate-700">
                <summary className="min-h-11 cursor-pointer select-none py-2 font-semibold">
                  {isVi ? "Xem lịch từng buổi" : "View each session"}
                </summary>
                <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                  {schedule.map((item, index) => (
                    <li key={item.sessionId ?? index} className="rounded-md bg-slate-50 px-3 py-1.5">
                      {isVi ? "Buổi" : "Session"} {index + 1}: {formatDate(item.date)} · {formatTime(item.start)}–{formatTime(item.end)}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {actionError[proposal.id] && (
              <p role="alert" className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                <AlertCircle size={16} className="shrink-0" />
                {actionError[proposal.id]}
              </p>
            )}

            {confirmRefundId === proposal.id ? (
              <div role="group" aria-label={isVi ? "Xác nhận hoàn tiền" : "Confirm refund"} className="space-y-3 rounded-lg border border-rose-200 bg-rose-50 p-3">
                <p className="text-sm text-rose-900">
                  {isVi
                    ? "Bạn sẽ từ chối đề xuất và yêu cầu hoàn tiền cho khóa này. Lựa chọn này không thể đổi lại. Tiếp tục?"
                    : "You will decline the proposal and request a refund for this course. This cannot be changed later. Continue?"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => respond(proposal, "Refund")}
                    className="inline-flex min-h-11 items-center rounded-lg bg-rose-700 px-4 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-60"
                  >
                    {busy ? (isVi ? "Đang gửi..." : "Sending...") : (isVi ? "Xác nhận hoàn tiền" : "Confirm refund")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmRefundId(null)}
                    className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {isVi ? "Quay lại" : "Back"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId != null}
                  onClick={() => respond(proposal, "Accept")}
                  className="inline-flex min-h-11 items-center rounded-lg bg-brand-primary px-4 text-sm font-bold text-white hover:bg-brand-primary-hover disabled:opacity-60"
                >
                  {busy ? (isVi ? "Đang gửi..." : "Sending...") : (isVi ? "Đồng ý với đề xuất" : "Accept proposal")}
                </button>
                <button
                  type="button"
                  disabled={busyId != null}
                  onClick={() => setConfirmRefundId(proposal.id)}
                  className="inline-flex min-h-11 items-center rounded-lg border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-60"
                >
                  {isVi ? "Từ chối và yêu cầu hoàn tiền" : "Decline and request refund"}
                </button>
              </div>
            )}
          </article>
        )
      })}
    </section>
  )
}
