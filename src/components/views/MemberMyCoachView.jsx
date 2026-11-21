import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { formatAdvancedStatus } from "../../utils/status"
import {
  Calendar,
  Clock,
  CheckCircle2,
  X,
  Loader2,
  MapPin,
  CalendarDays,
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import { memberPortalApi } from "../../api/memberPortalApi"
import { membershipApi } from "../../api/membershipApi"
import { getAuthoritativeProfileId } from "../../utils/memberSafetyHelpers"
import { getErrorMessage } from "../../api/apiErrors"
import { getPrivateSessionProposalErrorMessage } from "../../utils/privateSessionProposalErrors"
import { PageHeader } from "../ui/PageHeader"
import { PrivateSessionCancelDialog } from "../schedule/PrivateSessionCancelDialog"
import { formatDateTime } from "../../utils/datetime"
import {
  describeCancellationBlock,
  isCancellationConfirmed,
  isCancelledWithRefund,
  readCancellationFields,
  getPrivateSessionTimingRule,
  resolveCancellationOutcome,
  sumAdvancedCredits,
} from "../../utils/sessionCancellation"

const isPositiveSessionId = (value) => Number.isInteger(Number(value)) && Number(value) > 0
const formatProposalDeadline = (value, isVi) => {
  if (!value) return isVi ? "Chưa có dữ liệu" : "Not provided"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString(isVi ? "vi-VN" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  })
}

export function MemberMyCoachView() {
  const { language, currentUser, subjects, apiEnabled, showToast, t } = useSCMS()
  const isVi = language === "vi"
  const tr = useCallback(
    (key, params = {}) => {
      let text = t(key)
      for (const [name, value] of Object.entries(params)) {
        text = text.replaceAll(`{${name}}`, String(value ?? ""))
      }
      return text
    },
    [t],
  )

  // Coach names are used to label proposals.
  const [coaches, setCoaches] = useState([])

  // Rooms and subscriptions state
  const [rooms, setRooms] = useState([])
  const [subscriptions, setSubscriptions] = useState([])

  // Booked private sessions
  const [privateSessions, setPrivateSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [privateSessionProposals, setPrivateSessionProposals] = useState([])
  const [loadingProposals, setLoadingProposals] = useState(false)
  const [proposalsError, setProposalsError] = useState("")
  const [rejectingProposalId, setRejectingProposalId] = useState(null)
  const [acceptingProposalId, setAcceptingProposalId] = useState(null)
  const [proposalSuccessMessage, setProposalSuccessMessage] = useState("")
  const proposalDecisionInFlightRef = useRef(false)

  // Absence Modal State
  const [absenceModalOpen, setAbsenceModalOpen] = useState(false)
  const [selectedSessionForAbsence, setSelectedSessionForAbsence] =
    useState(null)
  const [absenceReason, setAbsenceReason] = useState("")
  const [submittingAbsence, setSubmittingAbsence] = useState(false)
  const [absenceMsg, setAbsenceMsg] = useState("")

  // Hộp xác nhận hủy buổi PT
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelling, setCancelling] = useState(false)

  // Member ID
  const memberProfileId = useMemo(() => {
    return getAuthoritativeProfileId(currentUser) || currentUser?.id
  }, [currentUser])

  // Buổi đã hủy vẫn hiện (kèm nhãn "Đã hủy · Đã hoàn 1 credit" khi Backend xác nhận hoàn); buổi báo vắng thì ẩn như cũ.
  const visiblePrivateSessions = privateSessions.filter((session) => String(session?.status || "").trim().toLowerCase() !== "absent")
  // Quy tắc nút hủy / báo vắng nằm ở utils/sessionCancellation.js (có test .mjs riêng).
  const getSessionTimingRule = getPrivateSessionTimingRule
  const pendingSessionProposals = privateSessionProposals.filter((proposal) =>
    String(proposal.status || "").toLowerCase() === "pending" && proposal.sessionId == null,
  )
  const closedSessionProposals = privateSessionProposals.filter((proposal) =>
    proposal.sessionId == null && ["rejected", "expired"].includes(String(proposal.status || "").toLowerCase()),
  )
  const advancedSubscriptions = subscriptions.filter((subscription) =>
    String(subscription.packageType || "").toLowerCase() === "advanced",
  )

  // Load coach labels used by session proposals.
  useEffect(() => {
    if (!apiEnabled) { setCoaches([]); return }
    memberPortalApi.getCoaches({}, { notifyForbidden: false })
      .then((rows) => setCoaches(Array.isArray(rows) ? rows : []))
      .catch(() => setCoaches([]))
  }, [apiEnabled])

  // 2. Fetch Rooms & Subscriptions (for private booking)
  useEffect(() => {
    if (!apiEnabled) {
      setRooms([])
      setSubscriptions([])
      return
    }

    memberPortalApi
      .getRooms({ notifyForbidden: false })
      .then((res) => setRooms(Array.isArray(res) ? res : []))
      .catch((err) => console.warn("Could not fetch rooms:", err))

    if (memberProfileId) {
      membershipApi
        .getMemberSubscriptions(memberProfileId, { notifyForbidden: false })
        .then((subs) => {
          const valid = (Array.isArray(subs) ? subs : []).filter((s) => {
            const st = String(s?.status || "").toLowerCase()
            return st === "active" || st === "grace_period"
          })
          setSubscriptions(valid)
        })
        .catch((err) => console.warn("Could not fetch subscriptions:", err))
    }
  }, [apiEnabled, memberProfileId])

  // 3. Fetch Booked Private Sessions
  const fetchPrivateSessions = useCallback(async () => {
    setLoadingSessions(true)
    try {
      if (apiEnabled && memberProfileId) {
        const allSessions = await memberPortalApi.getClassSessions({ memberId: memberProfileId }, { notifyForbidden: false })
        const scheduledStatuses = new Set(["scheduled", "confirmed", "ongoing", "completed", "cancelled", "canceled", "absent"])
        const privates = (Array.isArray(allSessions) ? allSessions : []).filter((s) => {
          const status = String(s.status || "").toLowerCase()
          return isPositiveSessionId(s.id)
            && scheduledStatuses.has(status)
            && (s.isPrivate === true || String(s.type || "").toUpperCase() === "PRIVATE")
            && String(s.bookedMemberId) === String(memberProfileId)
        })
        setPrivateSessions(privates)
      } else {
        setPrivateSessions([])
      }
    } catch (err) {
      console.warn("Could not fetch private sessions:", err)
    } finally {
      setLoadingSessions(false)
    }
  }, [apiEnabled, memberProfileId])

  const fetchPrivateSessionProposals = useCallback(async () => {
    if (!apiEnabled) {
      setPrivateSessionProposals([])
      setProposalsError("")
      return []
    }
    setLoadingProposals(true)
    setProposalsError("")
    try {
      const rows = await memberPortalApi.getPrivateSessionProposals({}, { notifyForbidden: false })
      const proposals = Array.isArray(rows) ? rows : []
      setPrivateSessionProposals(proposals)
      return proposals
    } catch (error) {
      setProposalsError(getErrorMessage(error, isVi ? "Không tải được đề xuất lịch." : "Could not load schedule proposals."))
      setPrivateSessionProposals([])
      throw error
    } finally {
      setLoadingProposals(false)
    }
  }, [apiEnabled, isVi])

  const handleRejectProposal = async (proposal) => {
    if (!isPositiveSessionId(proposal?.id) || proposalDecisionInFlightRef.current) return
    proposalDecisionInFlightRef.current = true
    setRejectingProposalId(proposal.id)
    setProposalsError("")
    setProposalSuccessMessage("")
    try {
      const response = await memberPortalApi.respondToPrivateSessionProposal(proposal.id, false)
      if (String(response?.status || "").toLowerCase() !== "rejected" || response?.sessionId != null) {
        throw new Error(isVi ? "Hệ thống chưa xác nhận trạng thái Từ chối." : "The server did not confirm the Rejected state.")
      }
      setPrivateSessionProposals((current) => current.map((item) =>
        String(item.id) === String(response.id) ? response : item,
      ))
      try {
        await fetchPrivateSessionProposals()
      } catch {
        // Keep the authoritative Rejected response visible if the follow-up read fails.
      }
      showToast?.(isVi ? "Đã từ chối đề xuất lịch." : "Schedule proposal rejected.", "info")
    } catch (error) {
      setProposalsError(getErrorMessage(error, isVi ? "Không thể từ chối đề xuất lịch." : "Could not reject the schedule proposal."))
    } finally {
      proposalDecisionInFlightRef.current = false
      setRejectingProposalId(null)
    }
  }

  const handleAcceptProposal = async (proposal) => {
    if (!isPositiveSessionId(proposal?.id) || proposalDecisionInFlightRef.current || !memberProfileId) return
    proposalDecisionInFlightRef.current = true
    setAcceptingProposalId(proposal.id)
    setProposalsError("")
    setProposalSuccessMessage("")
    let reloadAttempted = false

    const reloadBackendState = async () => {
      reloadAttempted = true
      setLoadingProposals(true)
      setLoadingSessions(true)
      const results = await Promise.allSettled([
        memberPortalApi.getPrivateSessionProposalById(proposal.id, { notifyForbidden: false }),
        memberPortalApi.getPrivateSessionProposals({}, { notifyForbidden: false }),
        memberPortalApi.getClassSessions({ memberId: memberProfileId }, { notifyForbidden: false }),
        membershipApi.getMemberSubscriptions(memberProfileId, { notifyForbidden: false }),
      ])
      setLoadingProposals(false)
      setLoadingSessions(false)

      const [proposalResult, proposalsResult, sessionsResult, subscriptionsResult] = results
      if (proposalsResult.status === "fulfilled") {
        setPrivateSessionProposals(Array.isArray(proposalsResult.value) ? proposalsResult.value : [])
      }
      if (sessionsResult.status === "fulfilled") {
        const scheduledStatuses = new Set(["scheduled", "confirmed", "ongoing", "completed", "cancelled", "canceled", "absent"])
        setPrivateSessions((Array.isArray(sessionsResult.value) ? sessionsResult.value : []).filter((session) => {
          const status = String(session.status || "").toLowerCase()
          return isPositiveSessionId(session.id)
            && scheduledStatuses.has(status)
            && (session.isPrivate === true || String(session.type || "").toUpperCase() === "PRIVATE")
            && String(session.bookedMemberId) === String(memberProfileId)
        }))
      }
      if (subscriptionsResult.status === "fulfilled") {
        setSubscriptions((Array.isArray(subscriptionsResult.value) ? subscriptionsResult.value : []).filter((subscription) => {
          const status = String(subscription?.status || "").toLowerCase()
          return status === "active" || status === "grace_period"
        }))
      }
      const failedRead = results.find((result) => result.status === "rejected")
      if (failedRead) throw failedRead.reason
      return {
        proposal: proposalResult.value,
        proposals: proposalsResult.value,
        sessions: sessionsResult.value,
        subscriptions: subscriptionsResult.value,
      }
    }

    try {
      const acceptedResponse = await memberPortalApi.respondToPrivateSessionProposal(proposal.id, true)
      const acceptedSessionId = acceptedResponse?.sessionId
      if (
        String(acceptedResponse?.status || "").toLowerCase() !== "accepted"
        || !isPositiveSessionId(acceptedSessionId)
        || !isPositiveSessionId(acceptedResponse?.session?.id)
        || String(acceptedResponse.session.id) !== String(acceptedSessionId)
        || String(acceptedResponse.session.status || "").toLowerCase() !== "scheduled"
      ) {
        throw new Error(isVi ? "Hệ thống chưa xác nhận buổi tập đã lên lịch." : "The server did not confirm a Scheduled session.")
      }
      setPrivateSessionProposals((current) => current.map((item) =>
        String(item.id) === String(acceptedResponse.id) ? acceptedResponse : item,
      ))

      const refreshed = await reloadBackendState()
      const confirmedProposal = refreshed.proposal
      const confirmedSession = (Array.isArray(refreshed.sessions) ? refreshed.sessions : []).find((session) =>
        String(session.id) === String(acceptedSessionId),
      )
      const confirmedSubscription = (Array.isArray(refreshed.subscriptions) ? refreshed.subscriptions : []).find((subscription) =>
        String(subscription.subscriptionId || subscription.id) === String(acceptedResponse.subscriptionId || proposal.subscriptionId),
      )
      if (
        String(confirmedProposal?.status || "").toLowerCase() !== "accepted"
        || String(confirmedProposal?.sessionId) !== String(acceptedSessionId)
        || String(confirmedProposal?.session?.id) !== String(acceptedSessionId)
        || String(confirmedProposal?.session?.status || "").toLowerCase() !== "scheduled"
        || !confirmedSession
        || !confirmedSubscription
        || confirmedSubscription.remainingCredit == null
      ) {
        throw new Error(isVi ? "Chưa thể xác minh đầy đủ lịch và số credit mới từ hệ thống." : "The updated schedule and subscription credits could not be fully verified.")
      }

      const successMessage = isVi ? "Đã xác nhận lịch tập thành công" : "Schedule confirmed successfully."
      setProposalSuccessMessage(successMessage)
      showToast?.(successMessage, "success")
    } catch (error) {
      if (!reloadAttempted) {
        try {
          await reloadBackendState()
        } catch {
          // Preserve the original server or verification error while keeping any successful reads visible.
        }
      }
      setProposalsError(getPrivateSessionProposalErrorMessage(error, isVi))
    } finally {
      proposalDecisionInFlightRef.current = false
      setAcceptingProposalId(null)
    }
  }

  useEffect(() => {
    fetchPrivateSessions()
    fetchPrivateSessionProposals().catch(() => {})
  }, [fetchPrivateSessions, fetchPrivateSessionProposals])

  // 6. Cancel Private Session (POST /api/sessions/{sessionId}/cancel-private)
  // Bấm "Hủy" chỉ mở hộp xác nhận; yêu cầu hủy chỉ gửi khi bấm "Xác nhận hủy".
  const handleCancelPrivate = (session) => {
    if (!session || cancelling) return
    setCancelTarget(session)
  }

  // Đọc gói của Member (null nếu không đọc được); gói Advanced đang dùng được là thứ ta cần.
  const readSubscriptionsOrNull = async () => {
    if (!apiEnabled || !memberProfileId) return null
    try {
      const subs = await membershipApi.getMemberSubscriptions(memberProfileId, { notifyForbidden: false, strict: true })
      return Array.isArray(subs) ? subs : null
    } catch {
      return null
    }
  }

  const handleConfirmCancelPrivate = async () => {
    const session = cancelTarget
    if (!session || cancelling) return
    setCancelling(true)
    // Credit trước khi hủy: đọc mới từ Backend; không đọc được thì dùng số đang hiển thị.
    const subsBefore = await readSubscriptionsOrNull()
    const creditBefore = sumAdvancedCredits(subsBefore ?? subscriptions)
    const reloadAfterCancellation = async (creditReturned) => {
      await fetchPrivateSessions()
      setPrivateSessions((current) => current.map((item) =>
        String(item.id) === String(session.id)
          ? { ...item, status: "Cancelled", creditReturned: creditReturned === true ? true : item.creditReturned }
          : item,
      ))
      const subsAfter = await readSubscriptionsOrNull()
      if (subsAfter) {
        setSubscriptions(subsAfter.filter((s) => ["active", "grace_period"].includes(String(s?.status || "").toLowerCase())))
      }
      return subsAfter ? sumAdvancedCredits(subsAfter) : null
    }
    try {
      let cancellationResult = null
      if (apiEnabled) {
        cancellationResult = await memberPortalApi.cancelPrivateSession(session.id)
      }
      const creditReturned = cancellationResult?.creditReturned === true
      const creditAfter = await reloadAfterCancellation(creditReturned)
      const outcome = resolveCancellationOutcome({ creditReturned, creditBefore, creditAfter })
      showToast?.(
        outcome.kind === "refunded_verified"
          ? tr("sessionCancelOutcomeRefunded", { before: outcome.before, after: outcome.after })
          : outcome.kind === "refunded_unverified"
            ? t("sessionCancelOutcomeRefundUnverified")
            : t("sessionCancelOutcomeNoRefund"),
        "success",
      )
      setCancelTarget(null)
    } catch (err) {
      const errorText = [err?.message, err?.details?.message, err?.response?.data?.message, err?.response?.data?.error].filter(Boolean).join(" ").toLowerCase()
      if (errorText.includes("original credit has already been returned")) {
        await reloadAfterCancellation(true)
        setCancelTarget(null)
        return
      }
      // CANCEL_TOO_LATE, SESSION_ALREADY_ATTENDED...: hiện câu từ bảng mã lỗi chung, không báo thành công,
      // tải lại trạng thái buổi và giữ số dư credit đã đọc.
      showToast?.(getErrorMessage(err, t("sessionCancelErrorReloaded")), "error")
      setCancelTarget(null)
      await fetchPrivateSessions()
    } finally {
      setCancelling(false)
    }
  }

  // 7. Request Absence (POST /api/sessions/{sessionId}/absence)
  const handleAbsenceSubmit = async (e) => {
    e.preventDefault()
    if (!selectedSessionForAbsence || !absenceReason.trim()) return
    setSubmittingAbsence(true)
    setAbsenceMsg("")
    try {
      if (apiEnabled) {
        await memberPortalApi.requestAbsence(
          selectedSessionForAbsence.id,
          absenceReason.trim(),
        )
      }
      setAbsenceMsg(
        isVi
          ? "Đã gửi đơn xin vắng mặt thành công!"
          : "Absence request submitted!",
      )
      setTimeout(() => {
        setAbsenceModalOpen(false)
        setSelectedSessionForAbsence(null)
        setAbsenceReason("")
        setAbsenceMsg("")
        fetchPrivateSessions()
      }, 1500)
    } catch (err) {
      alert(
        getErrorMessage(
          err,
          isVi
            ? "Không thể gửi đơn xin vắng mặt."
            : "Could not submit absence.",
        ),
      )
    } finally {
      setSubmittingAbsence(false)
    }
  }

  return (
    <div className="w-full space-y-6 font-sans antialiased">
      {/* Header */}
      <PageHeader
        title={isVi ? "L\u1ECBch t\u1EADp 1-1 & \u0110\u1EC1 xu\u1EA5t ca h\u1ECDc" : "1-on-1 Schedule & Session Proposals"}
        description={isVi ? "Theo d\u00F5i l\u1ECBch t\u1EADp ri\u00EAng 1:1 v\u00E0 ph\u1EA3n h\u1ED3i c\u00E1c \u0111\u1EC1 xu\u1EA5t ca h\u1ECDc t\u1EEB hu\u1EA5n luy\u1EC7n vi\u00EAn." : "Manage your 1-on-1 schedule and respond to session proposals from your coach."}
      />
      {/* 1-on-1 schedule and proposal management */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">
              {isVi
                ? "Danh sách buổi tập riêng 1:1 của bạn"
                : "Your Booked 1-on-1 Sessions"}
            </h2>
            <button
              type="button"
              onClick={() => {
                fetchPrivateSessions()
                fetchPrivateSessionProposals().catch(() => {})
              }}
              className="text-xs font-bold text-brand-accent-dark hover:underline inline-flex items-center gap-1"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{isVi ? "Tải lại" : "Refresh"}</span>
            </button>
          </div>

          <section aria-labelledby="pending-proposals-title" className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 id="pending-proposals-title" className="text-sm font-extrabold text-slate-900">
                {isVi ? "Chờ xác nhận" : "Waiting for your response"}
              </h3>
              {loadingProposals && <Loader2 className="h-4 w-4 animate-spin text-brand-primary" aria-label={isVi ? "Đang tải" : "Loading"} />}
            </div>
            {proposalsError && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"><span>{proposalsError}</span><button type="button" onClick={() => fetchPrivateSessionProposals().catch(() => {})} className="shrink-0 font-bold underline">{isVi ? "Thử lại" : "Retry"}</button></div>}
            {proposalSuccessMessage && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">{proposalSuccessMessage}</p>}
            {!loadingProposals && !proposalsError && pendingSessionProposals.length === 0 && <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">{isVi ? "Không có đề xuất lịch nào đang chờ." : "No schedule proposals are waiting for your response."}</p>}
            {pendingSessionProposals.map((proposal) => {
              const coach = coaches.find((item) => String(item.id) === String(proposal.coachId))
              const subject = subjects.find((item) => String(item.id) === String(proposal.subjectId))
              const room = rooms.find((item) => String(item.id) === String(proposal.roomId))
              return <article key={proposal.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{coach?.name || (isVi ? `HLV #${proposal.coachId}` : `Coach #${proposal.coachId}`)} · {subject?.name || (isVi ? `Môn #${proposal.subjectId}` : `Subject #${proposal.subjectId}`)}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{proposal.sessionDate || "—"}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{String(proposal.startTime || "").slice(0, 5)}–{String(proposal.endTime || "").slice(0, 5)}</span>
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{room?.name || (isVi ? `Phòng #${proposal.roomId}` : `Room #${proposal.roomId}`)}{room?.location ? ` · ${room.location}` : ""}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">{isVi ? "Hạn phản hồi: " : "Respond by: "}{formatProposalDeadline(proposal.respondBy, isVi)}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-extrabold uppercase text-amber-800">{formatAdvancedStatus(proposal.status, isVi)}</span>
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button type="button" disabled={rejectingProposalId != null || acceptingProposalId != null} onClick={() => handleAcceptProposal(proposal)} className="min-h-10 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">{acceptingProposalId != null && String(acceptingProposalId) === String(proposal.id) ? (isVi ? "Đang xác nhận..." : "Confirming...") : (isVi ? "Chấp nhận" : "Accept")}</button>
                  <button type="button" disabled={rejectingProposalId != null || acceptingProposalId != null} onClick={() => handleRejectProposal(proposal)} className="min-h-10 rounded-lg border border-rose-300 bg-white px-4 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60">{rejectingProposalId != null && String(rejectingProposalId) === String(proposal.id) ? (isVi ? "Đang gửi..." : "Sending...") : (isVi ? "Từ chối" : "Reject")}</button>
                </div>
              </article>
            })}
          </section>

          {closedSessionProposals.length > 0 && <section aria-labelledby="closed-proposals-title" className="space-y-2">
            <h3 id="closed-proposals-title" className="text-sm font-extrabold text-slate-900">{isVi ? "Đề xuất đã phản hồi" : "Responded proposals"}</h3>
            {closedSessionProposals.map((proposal) => <div key={proposal.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <span className="font-semibold text-slate-700">{proposal.sessionDate} · {String(proposal.startTime || "").slice(0, 5)}–{String(proposal.endTime || "").slice(0, 5)}</span>
              <span className="font-bold text-slate-600">{formatAdvancedStatus(proposal.status, isVi)}</span>
            </div>)}
          </section>}

          {advancedSubscriptions.length > 0 && <section aria-labelledby="advanced-credit-title" className="space-y-2">
            <h3 id="advanced-credit-title" className="text-sm font-extrabold text-slate-900">{isVi ? "Credit gói Advanced" : "Advanced package credits"}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {advancedSubscriptions.map((subscription) => <div key={subscription.subscriptionId || subscription.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                <p className="font-bold text-slate-800">{subscription.packageName || (isVi ? "Gói Advanced" : "Advanced package")}</p>
                <p className="mt-1 text-slate-600">{isVi ? "Còn lại: " : "Remaining: "}<strong className="text-slate-900">{subscription.remainingCredit ?? (isVi ? "Chưa có dữ liệu" : "Not available")}</strong> {isVi ? "credit" : "credits"}</p>
              </div>)}
            </div>
          </section>}

          {loadingSessions ? (
            <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
              <span>
                {isVi
                  ? "Đang tải lịch tập riêng..."
                  : "Loading private sessions..."}
              </span>
            </div>
          ) : privateSessions.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 space-y-2">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700 text-sm">
                {isVi
                  ? "Bạn chưa đặt buổi tập riêng 1:1 nào"
                  : "No private sessions booked"}
              </p>
              <p>
                {isVi
                  ? "L\u1ECBch t\u1EADp 1:1 s\u1EBD hi\u1EC3n th\u1ECB t\u1EA1i \u0111\u00E2y sau khi \u0111\u01B0\u1EE3c HLV s\u1EAFp x\u1EBFp."
                  : "Your coach will appear here after a 1-on-1 session is scheduled."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visiblePrivateSessions.map((s) => (
                <div
                  key={s.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {isVi
                          ? "Buổi tập riêng 1:1 với HLV"
                          : "1-on-1 Session with"}{" "}
                        {s.coachName || "Coach"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                        {["cancelled", "canceled"].includes(String(s.status || "").trim().toLowerCase())
                          ? (isCancelledWithRefund(s) ? t("sessionCancelledRefundedBadge") : t("sessionCancelledBadge"))
                          : formatAdvancedStatus(s.status || "Scheduled", isVi)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1 font-mono">
                        <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                        {s.sessionDate}
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {String(s.startTime || "").slice(0, 5)} -{" "}
                        {String(s.endTime || "").slice(0, 5)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {s.roomName || "Phòng PT AVT Sport"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                      {/* Absence applies only during the 12-hour window before session end. */}
                      {getSessionTimingRule(s).isAbsentApplicable && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSessionForAbsence(s)
                        setAbsenceModalOpen(true)
                      }}
                      className="px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors"
                    >
                      {isVi ? "Xin vắng mặt" : "Report absence"}
                    </button>
                      )}

                    {/* Cancel session button */}
                      {getSessionTimingRule(s).isCancellable && (
                    <button
                      type="button"
                      onClick={() => handleCancelPrivate(s)}
                      className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-colors"
                    >
                      {isVi ? "Hủy buổi tập" : "Cancel"}
                    </button>
                      )}

                    {/* Backend nói rõ không được hủy (cancellationAllowed === false): khóa nút và nêu lý do */}
                      {getSessionTimingRule(s).isCancelLocked && (() => {
                        const block = describeCancellationBlock(s, isVi ? "vi" : "en")
                        return (
                          <div className="flex flex-col items-end gap-1">
                            <button
                              type="button"
                              disabled
                              aria-describedby={`cancel-block-${s.id}`}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-400 text-xs font-bold cursor-not-allowed"
                            >
                              {isVi ? "Hủy buổi tập" : "Cancel"}
                            </button>
                            <p id={`cancel-block-${s.id}`} className="max-w-[260px] text-right text-[11px] leading-snug text-slate-600">
                              {block.reasonText}
                              {block.deadline ? ` ${tr("sessionCancelDeadline", { datetime: formatDateTime(block.deadline) })}` : ""}
                            </p>
                          </div>
                        )
                      })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      {/* MODAL 2: REQUEST ABSENCE (POST /api/sessions/{sessionId}/absence) */}
      {absenceModalOpen && selectedSessionForAbsence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {isVi
                  ? "Xin vắng mặt buổi tập riêng"
                  : "Report Absence for Session"}
              </h3>
              <button
                type="button"
                onClick={() => setAbsenceModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              {isVi
                ? `Buổi tập với HLV ${selectedSessionForAbsence.coachName} ngày ${selectedSessionForAbsence.sessionDate}.`
                : `Session with ${selectedSessionForAbsence.coachName} on ${selectedSessionForAbsence.sessionDate}.`}
            </p>

            {absenceMsg && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{absenceMsg}</span>
              </div>
            )}

            <form onSubmit={handleAbsenceSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isVi ? "Lý do xin vắng mặt *" : "Reason *"}
                </label>
                <textarea
                  required
                  rows={3}
                  value={absenceReason}
                  onChange={(e) => setAbsenceReason(e.target.value)}
                  placeholder={
                    isVi
                      ? "Ví dụ: Em có việc đột xuất / Bị ốm..."
                      : "Explain your reason..."
                  }
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs outline-none focus:border-brand-primary resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAbsenceModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg"
                >
                  {isVi ? "Đóng" : "Close"}
                </button>
                <button
                  type="submit"
                  disabled={submittingAbsence || !absenceReason.trim()}
                  className="px-5 py-2 bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-50 text-white text-xs font-bold rounded-lg"
                >
                  {submittingAbsence
                    ? isVi
                      ? "Đang gửi..."
                      : "Submitting..."
                    : isVi
                      ? "Gửi đơn"
                      : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {cancelTarget && (
        <PrivateSessionCancelDialog
          title={cancelTarget.coachName ? `${isVi ? "Buổi tập 1:1 với HLV" : "1-on-1 session with"} ${cancelTarget.coachName}` : (isVi ? "Buổi tập riêng 1:1" : "1-on-1 session")}
          dateText={cancelTarget.sessionDate}
          timeText={`${String(cancelTarget.startTime || "").slice(0, 5)}–${String(cancelTarget.endTime || "").slice(0, 5)}`}
          message={isCancellationConfirmed(cancelTarget) ? t("sessionCancelDialogRefundMsg") : t("sessionCancelDialogUnknownMsg")}
          deadlineText={readCancellationFields(cancelTarget).deadline ? tr("sessionCancelDeadline", { datetime: formatDateTime(readCancellationFields(cancelTarget).deadline) }) : ""}
          busy={cancelling}
          onKeep={() => setCancelTarget(null)}
          onConfirm={handleConfirmCancelPrivate}
        />
      )}
    </div>
  )
}

export default MemberMyCoachView
