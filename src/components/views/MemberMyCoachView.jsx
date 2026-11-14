import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  UserCheck,
  Mail,
  Phone,
  Award,
  Calendar,
  Clock,
  Star,
  CheckCircle2,
  Sparkles,
  Send,
  Dumbbell,
  Users,
  Search,
  Filter,
  Plus,
  X,
  Loader2,
  MapPin,
  CalendarDays,
  ShieldCheck,
  AlertCircle,
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import { memberPortalApi } from "../../api/memberPortalApi"
import { membershipApi } from "../../api/membershipApi"
import { invoiceApi } from "../../api/invoiceApi"
import { startVnpayCheckout } from "../../utils/vnpayCheckout"
import { getAuthoritativeProfileId } from "../../utils/memberSafetyHelpers"
import { getErrorMessage } from "../../api/apiErrors"
import { getPrivateSessionProposalErrorMessage } from "../../utils/privateSessionProposalErrors"
import { resolveCoachAvatar } from "../../data/publicCoaches"
import { PageHeader } from "../ui/PageHeader"

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

  // Navigation tab: 'coaches' | 'my_sessions' | 'advanced_pt'
  const [activeTab, setActiveTab] = useState("coaches")

  // Advanced PT Registration & Coach Work Schedule state
  const [advancedRegistrations, setAdvancedRegistrations] = useState([])
  const [loadingAdvanced, setLoadingAdvanced] = useState(false)
  const [advancedModalCoach, setAdvancedModalCoach] = useState(null)
  const [coachWorkSchedule, setCoachWorkSchedule] = useState(null)
  const [coachCapacity, setCoachCapacity] = useState(null)
  const [selectedSubjectId, setSelectedSubjectId] = useState("")
  const [loadingCoachMeta, setLoadingCoachMeta] = useState(false)
  const [submittingAdvanced, setSubmittingAdvanced] = useState(false)
  const [advancedError, setAdvancedError] = useState("")
  const [orderingRegId, setOrderingRegId] = useState(null)

  // Coaches state
  const [coaches, setCoaches] = useState([])
  const [loadingCoaches, setLoadingCoaches] = useState(true)
  const [coachesError, setCoachesError] = useState("")
  const [keyword, setKeyword] = useState("")
  const [sportFilter, setSportFilter] = useState("all")

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

  // Member ID
  const memberProfileId = useMemo(() => {
    return getAuthoritativeProfileId(currentUser) || currentUser?.id
  }, [currentUser])

  const coachSports = useMemo(() => [...new Set(coaches.flatMap((coach) => Array.isArray(coach.specializations) && coach.specializations.length ? coach.specializations : coach.specialization ? [coach.specialization] : []).filter(Boolean))], [coaches])
  const upcomingPrivateSessions = privateSessions.filter((session) => String(session.sessionDate || "") >= new Date().toISOString().slice(0, 10)).length
  const pendingSessionProposals = privateSessionProposals.filter((proposal) =>
    String(proposal.status || "").toLowerCase() === "pending" && proposal.sessionId == null,
  )
  const closedSessionProposals = privateSessionProposals.filter((proposal) =>
    proposal.sessionId == null && ["rejected", "expired"].includes(String(proposal.status || "").toLowerCase()),
  )
  const advancedSubscriptions = subscriptions.filter((subscription) =>
    String(subscription.packageType || "").toLowerCase() === "advanced",
  )

  // 1. Fetch Coaches from BE (GET /api/coaches)
  const fetchCoaches = useCallback(async () => {
    setLoadingCoaches(true)
    setCoachesError("")
    try {
      if (apiEnabled) {
        const list = await memberPortalApi.getCoaches({
          keyword: keyword.trim() || undefined,
        })
        const rawList = Array.isArray(list) ? list : []
        setCoaches(rawList)
      } else {
        setCoaches([])
      }
    } catch (err) {
      setCoachesError(
        getErrorMessage(
          err,
          isVi
            ? "Không thể tải danh sách huấn luyện viên."
            : "Could not load coaches.",
        ),
      )
    } finally {
      setLoadingCoaches(false)
    }
  }, [apiEnabled, isVi, keyword])

  useEffect(() => {
    fetchCoaches()
  }, [fetchCoaches])

  // 2. Fetch Rooms & Subscriptions (for private booking)
  useEffect(() => {
    if (!apiEnabled) {
      setRooms([])
      setSubscriptions([])
      return
    }

    memberPortalApi
      .getRooms()
      .then((res) => setRooms(Array.isArray(res) ? res : []))
      .catch((err) => console.warn("Could not fetch rooms:", err))

    if (memberProfileId) {
      membershipApi
        .getMemberSubscriptions(memberProfileId)
        .then((subs) => {
          const valid = (Array.isArray(subs) ? subs : []).filter((s) => {
            const st = String(s?.status || "").toLowerCase()
            return st === "active" || st === "grace_period"
          })
          setSubscriptions(valid)
          if (valid.length > 0)
            setSelectedSubscriptionId(
              String(valid[0].subscriptionId || valid[0].id),
            )
        })
        .catch((err) => console.warn("Could not fetch subscriptions:", err))
    }
  }, [apiEnabled, memberProfileId])

  // 3. Fetch Booked Private Sessions
  const fetchPrivateSessions = useCallback(async () => {
    setLoadingSessions(true)
    try {
      if (apiEnabled && memberProfileId) {
        const allSessions = await memberPortalApi.getClassSessions({ memberId: memberProfileId })
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
      const rows = await memberPortalApi.getPrivateSessionProposals()
      const proposals = Array.isArray(rows) ? rows : []
      setPrivateSessionProposals(proposals)
      return proposals
    } catch (error) {
      setProposalsError(getErrorMessage(error, isVi ? "Không tải được đề xuất lịch." : "Could not load schedule proposals."))
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
        throw new Error(isVi ? "Backend chưa xác nhận trạng thái Từ chối." : "The server did not confirm the Rejected state.")
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
        memberPortalApi.getPrivateSessionProposalById(proposal.id),
        memberPortalApi.getPrivateSessionProposals(),
        memberPortalApi.getClassSessions({ memberId: memberProfileId }),
        membershipApi.getMemberSubscriptions(memberProfileId),
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
        throw new Error(isVi ? "Backend chưa xác nhận buổi tập đã lên lịch." : "The server did not confirm a Scheduled session.")
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
        throw new Error(isVi ? "Chưa thể xác minh đầy đủ lịch và số credit mới từ Backend." : "The updated schedule and subscription credits could not be fully verified.")
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
    if (activeTab === "my_sessions") {
      fetchPrivateSessions()
      fetchPrivateSessionProposals().catch(() => {})
    }
  }, [activeTab, fetchPrivateSessions, fetchPrivateSessionProposals])

  const fetchAdvancedRegistrations = useCallback(async () => {
    if (!apiEnabled) return
    setLoadingAdvanced(true)
    try {
      const list = await memberPortalApi.getAdvancedRegistrations()
      const filtered = (Array.isArray(list) ? list : []).filter(
        (item) =>
          !memberProfileId ||
          !item.memberId ||
          String(item.memberId) === String(memberProfileId),
      )
      setAdvancedRegistrations(filtered)
    } catch {
      setAdvancedRegistrations([])
    } finally {
      setLoadingAdvanced(false)
    }
  }, [apiEnabled, memberProfileId])

  useEffect(() => {
    if (activeTab === "advanced_pt") {
      fetchAdvancedRegistrations()
    }
  }, [activeTab, fetchAdvancedRegistrations])

  const handleOpenAdvancedModal = async (coach) => {
    setAdvancedModalCoach(coach)
    setCoachWorkSchedule(null)
    setCoachCapacity(null)
    setAdvancedError("")
    const coachSport = coach.specializations?.[0] || coach.specialization || coach.sportName || ""
    const normalizeSport = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    const matchedSubject = (subjects || []).find((subject) =>
      String(subject.id) === String(coach.sportId || coach.subjectId || "") ||
      normalizeSport(subject.name) === normalizeSport(coachSport) ||
      normalizeSport(subject.name).includes(normalizeSport(coachSport)) ||
      normalizeSport(coachSport).includes(normalizeSport(subject.name)),
    )
    const defaultSub = matchedSubject?.id || subjects?.find((s) => !Number.isNaN(Number(s.id)))?.id || ""
    setSelectedSubjectId(defaultSub ? String(defaultSub) : "")
    if (!apiEnabled || !coach?.id) return
    setLoadingCoachMeta(true)
    try {
      const work = await memberPortalApi
        .getCoachWorkSchedule(coach.id)
        .catch(() => null)
      setCoachWorkSchedule(work)
      if (defaultSub) {
        const cap = await memberPortalApi
          .getCoachAdmissionCapacity(coach.id, defaultSub)
          .catch(() => null)
        setCoachCapacity(cap)
      }
    } finally {
      setLoadingCoachMeta(false)
    }
  }

  const handleChangeSubjectForCapacity = async (newSubjectId) => {
    setSelectedSubjectId(newSubjectId)
    setCoachCapacity(null)
    if (!apiEnabled || !advancedModalCoach?.id || !newSubjectId) return
    try {
      const cap = await memberPortalApi.getCoachAdmissionCapacity(
        advancedModalCoach.id,
        newSubjectId,
      )
      setCoachCapacity(cap)
    } catch {
      setCoachCapacity(null)
    }
  }

  const handleSubmitAdvancedRegistration = async (e) => {
    e.preventDefault()
    if (!advancedModalCoach?.id || !selectedSubjectId) {
      setAdvancedError(
        isVi
          ? "Vui lòng chọn bộ môn huấn luyện chuyên sâu."
          : "Please select a training subject.",
      )
      return
    }
    setSubmittingAdvanced(true)
    setAdvancedError("")
    try {
      if (apiEnabled) {
        await memberPortalApi.createAdvancedRegistration({
          subjectId: Number(selectedSubjectId),
          primaryCoachId: Number(advancedModalCoach.id),
          requestKey: `adv-${memberProfileId || "me"}-${advancedModalCoach.id}-${selectedSubjectId}-${Date.now()}`,
        })
      }
      showToast?.(
        isVi
          ? "Đã gửi yêu cầu đăng ký HLV chuyên sâu thành công!"
          : "Submitted Advanced PT Coach registration!",
        "success",
      )
      setAdvancedModalCoach(null)
      setActiveTab("advanced_pt")
      fetchAdvancedRegistrations()
    } catch (err) {
      setAdvancedError(
        getErrorMessage(
          err,
          isVi
            ? "Không thể gửi đăng ký HLV chuyên sâu."
            : "Could not submit registration.",
        ),
      )
    } finally {
      setSubmittingAdvanced(false)
    }
  }

  const handleCreateOrderForAdvanced = async (reg, paymentMethod = "Cash") => {
    if (!reg?.id) return
    setOrderingRegId(reg.id)
    try {
      const orderRes = await memberPortalApi.orderAdvancedRegistration(reg.id, {
        paymentMethod,
      })
      showToast?.(
        isVi
          ? `Đã tạo đơn thanh toán (${orderRes?.invoiceCode || paymentMethod}) thành công! Hạn thanh toán: 5 phút.`
          : "Created payment order! 5-minute payment window active.",
        "success",
      )
      await fetchAdvancedRegistrations()
      if (memberProfileId) {
        membershipApi
          .getMemberSubscriptions(memberProfileId)
          .then((subs) => {
            const valid = (Array.isArray(subs) ? subs : []).filter((s) => {
              const st = String(s?.status || "").toLowerCase()
              return st === "active" || st === "grace_period"
            })
            setSubscriptions(valid)
          })
          .catch(() => {})
      }
      if (String(paymentMethod).toLowerCase() === "vnpay") {
        let paymentUrl = orderRes?.paymentUrl || null
        if (!paymentUrl && orderRes?.invoiceId) {
          const checkout = await invoiceApi
            .payInvoiceOnline(orderRes.invoiceId)
            .catch(() => null)
          paymentUrl = checkout?.paymentUrl || null
        }
        if (paymentUrl && typeof window !== "undefined") {
          startVnpayCheckout({
            paymentUrl,
            invoiceId: orderRes?.invoiceId,
            invoiceCode: orderRes?.invoiceCode,
            onVerified: async () => {
              await fetchAdvancedRegistrations()
              if (memberProfileId) await membershipApi.getMemberSubscriptions(memberProfileId)
            },
          })
        }
      }
    } catch (err) {
      showToast?.(
        getErrorMessage(
          err,
          isVi
            ? "Không thể khởi tạo đơn thanh toán cho đăng ký này."
            : "Could not create payment order.",
        ),
        "error",
      )
    } finally {
      setOrderingRegId(null)
    }
  }

  const handleConfirmAlternativeCoach = async (reg, accept) => {
    if (!reg?.id) return
    setOrderingRegId(reg.id)
    try {
      await memberPortalApi.confirmAlternativeCoach(reg.id, {
        accepted: Boolean(accept),
        reason: accept
          ? "Đồng ý học với HLV thay thế"
          : "Không đồng ý HLV thay thế",
      })
      showToast?.(
        accept
          ? isVi
            ? "Đã xác nhận đồng ý HLV thay thế! Bạn có thể tiến hành tạo đơn thanh toán."
            : "Alternative coach confirmed! You may now proceed to payment."
          : isVi
            ? "Đã từ chối HLV thay thế."
            : "Alternative coach declined.",
        accept ? "success" : "info",
      )
      await fetchAdvancedRegistrations()
    } catch (err) {
      showToast?.(
        getErrorMessage(
          err,
          isVi
            ? "Không thể xác nhận HLV thay thế."
            : "Could not confirm alternative coach.",
        ),
        "error",
      )
    } finally {
      setOrderingRegId(null)
    }
  }

  const weeklyShiftRows = useMemo(() => {
    const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
    const names = isVi ? ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"] : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    const grouped = new Map(days.map((day, index) => [day, { name: names[index], slots: [] }]))
    for (const value of coachWorkSchedule?.weeklySlots || []) {
      const [day, slot] = String(value).toUpperCase().split(":")
      const number = Number(slot)
      if (grouped.has(day) && number >= 1 && number <= 7) grouped.get(day).slots.push(number)
    }
    return [...grouped.entries()].map(([key, row]) => ({ key, ...row, slots: [...new Set(row.slots)].sort((a, b) => a - b) })).filter((row) => row.slots.length)
  }, [coachWorkSchedule, isVi])

  // 6. Cancel Private Session (POST /api/sessions/{sessionId}/cancel-private)
  const handleCancelPrivate = async (sessionId) => {
    if (
      !window.confirm(
        isVi
          ? "Bạn có chắc chắn muốn hủy buổi tập riêng này (trước ≥ 12h để được hoàn 1 credit) không?"
          : "Are you sure you want to cancel this private session (≥ 12h notice refunds 1 credit)?",
      )
    )
      return
    try {
      let cancellationResult = null
      if (apiEnabled) {
        cancellationResult = await memberPortalApi.cancelPrivateSession(sessionId)
      }
      showToast?.(
        cancellationResult?.creditReturned === true
          ? (isVi ? "\u0110\u00e3 h\u1ee7y bu\u1ed5i t\u1eadp; Backend x\u00e1c nh\u1eadn ho\u00e0n l\u1ea1i 1 credit." : "Session cancelled; the server confirmed one credit was returned.")
          : (isVi ? "\u0110\u00e3 h\u1ee7y bu\u1ed5i t\u1eadp. Credit s\u1ebd hi\u1ec3n th\u1ecb theo d\u1eef li\u1ec7u g\u00f3i m\u1edbi nh\u1ea5t t\u1eeb Backend." : "Session cancelled. Credits follow the latest subscription data from the server."),
        "success",
      )
      fetchPrivateSessions()
      if (apiEnabled && memberProfileId) {
        membershipApi
          .getMemberSubscriptions(memberProfileId)
          .then((subs) => {
            const valid = (Array.isArray(subs) ? subs : []).filter((s) => {
              const st = String(s?.status || "").toLowerCase()
              return st === "active" || st === "grace_period"
            })
            setSubscriptions(valid)
          })
          .catch(() => {})
      }
    } catch (err) {
      alert(
        getErrorMessage(
          err,
          isVi ? "Không thể hủy buổi tập." : "Could not cancel session.",
        ),
      )
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
    <main className="w-full space-y-6 px-6 py-6 font-sans antialiased">
      {/* Header */}
      <PageHeader
        title={isVi ? "Huấn Luyện Viên & Đặt Lịch 1:1" : "Personal Coaches & 1-on-1 Sessions"}
        description={isVi ? "Xem danh sách HLV, khung giờ trống và đặt lịch tập riêng 1:1." : "Browse coaches, view available slots, and book private 1-on-1 sessions."}
        actions={
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("coaches")}
              className={`px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "coaches"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {isVi ? "Danh bạ Huấn luyện viên" : "Coach directory"} <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5">{coaches.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("my_sessions")}
              className={`px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "my_sessions"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {isVi ? "Lịch 1:1 & đề xuất" : "1:1 schedule & proposals"} <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5">{privateSessions.length + privateSessionProposals.filter((proposal) => String(proposal.status || "").toLowerCase() === "pending" && proposal.sessionId == null).length}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("advanced_pt")}
              className={`px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "advanced_pt"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {isVi ? "Đăng ký HLV Chính" : "Primary Coach"} <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5">{advancedRegistrations.length}</span>
            </button>
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { title: isVi ? "Đội ngũ Huấn luyện viên" : "Coaching team", value: coaches.length, Icon: Users, tone: "bg-blue-50 text-blue-700" },
          { title: isVi ? "Lịch tập 1:1 sắp tới" : "Upcoming 1:1 sessions", value: upcomingPrivateSessions, Icon: CalendarDays, tone: "bg-emerald-50 text-emerald-700" },
          { title: isVi ? "HLV Chính & Yêu cầu" : "Primary coach & requests", value: advancedRegistrations.length, Icon: Award, tone: "bg-violet-50 text-violet-700" },
        ].map(({ title, value, Icon, tone }) => <article key={title} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"><span className={`grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span><div><p className="text-xs font-bold text-slate-500">{title}</p><p className="text-2xl font-extrabold text-slate-900">{value}</p></div></article>)}
      </section>

      {/* TAB 1: COACHES DIRECTORY */}
      {activeTab === "coaches" && (
        <section className="space-y-4">
          {/* Search bar */}
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-2xs sm:flex-row sm:items-center">
            <label className="relative block sm:w-56">
              <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select aria-label={isVi ? "Lọc theo môn thể thao" : "Filter by sport"} value={sportFilter} onChange={(event) => setSportFilter(event.target.value)} className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 pl-8 pr-7 text-xs font-semibold text-slate-700 hover:bg-white focus:border-blue-500 focus:outline-none">
                <option value="all">{isVi ? "Tất cả môn" : "All sports"}</option>{coachSports.map((sport) => <option key={sport} value={sport}>{sport}</option>)}
              </select>
            </label>
            <div className="flex min-w-0 flex-1 items-center gap-3"><div className="relative w-full sm:max-w-sm">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                aria-label={t("search")}
                placeholder={
                  isVi
                    ? "Tìm theo tên HLV, chuyên môn..."
                    : "Search coach name, specialty..."
                }
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/80 py-2 pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none hover:bg-white focus:border-blue-500"
              />
            </div>{(sportFilter !== "all" || keyword.trim()) && <button type="button" onClick={() => { setSportFilter("all"); setKeyword("") }} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"><X className="h-3.5 w-3.5" />{isVi ? "Xóa lọc" : "Clear"}</button>}<div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
              {isVi
                ? `Hiển thị ${coaches.length} HLV`
                : `Showing ${coaches.length} coaches`}
            </div></div>
          </div>

          {coachesError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{coachesError}</span>
            </div>
          )}

          {loadingCoaches ? (
            <div className="p-16 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
              <span>
                {isVi
                  ? "Đang nạp danh sách Huấn luyện viên..."
                  : "Loading coaches..."}
              </span>
            </div>
          ) : coaches.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
              <Users className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="mt-3 text-sm font-bold text-slate-800">
                {isVi
                  ? "Không tìm thấy Huấn luyện viên phù hợp"
                  : "No coaches found"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {coaches.filter((c) => sportFilter === "all" || (c.specializations || [c.specialization]).includes(sportFilter)).map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3.5">
                      <img
                        src={resolveCoachAvatar(c)}
                        alt={c.name}
                        className="w-14 h-14 rounded-xl object-cover object-top border border-slate-200 shrink-0 shadow-2xs"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-sm leading-snug">
                            {c.name}
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 shrink-0">
                            {isVi ? "• Đang nhận học viên" : "• Accepting students"}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {c.email}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          {c.phone}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {(String(c.bio || "").toLowerCase().includes("demo") ? "" : c.bio) ||
                        (isVi
                          ? `Huấn luyện viên chuyên sâu bộ môn ${(c.specializations?.[0] || c.specialization || "thể thao")} · Đào tạo kỹ thuật & chiến thuật 1:1`
                          : "Professional personal trainer at VIBE Sport.")}
                    </p>

                    {/* Specializations tags */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(Array.isArray(c.specializations) &&
                      c.specializations.length > 0
                        ? c.specializations
                        : c.specialization
                          ? [c.specialization]
                          : ["VIBE Sport Coach"]
                      ).map((spec, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("my_sessions")}
                      className="inline-flex min-w-0 items-center justify-center gap-1 px-2 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-[11px] whitespace-nowrap font-bold transition-colors cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5 text-brand-accent" />
                      <span>
                        {isVi ? "Lịch & đề xuất" : "Schedule & proposals"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenAdvancedModal(c)}
                      className="inline-flex min-w-0 items-center justify-center gap-1 px-2 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-[11px] whitespace-nowrap font-bold transition-colors cursor-pointer"
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>
                        {isVi ? "Đăng ký HLV chính" : "Primary Coach"}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: MY BOOKED 1-ON-1 SESSIONS */}
      {activeTab === "my_sessions" && (
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
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-extrabold uppercase text-amber-800">{proposal.status}</span>
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button type="button" disabled={rejectingProposalId != null || acceptingProposalId != null} onClick={() => handleAcceptProposal(proposal)} className="min-h-10 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">{acceptingProposalId != null && String(acceptingProposalId) === String(proposal.id) ? (isVi ? "Đang xác nhận..." : "Confirming...") : (isVi ? "Đồng ý" : "Accept")}</button>
                  <button type="button" disabled={rejectingProposalId != null || acceptingProposalId != null} onClick={() => handleRejectProposal(proposal)} className="min-h-10 rounded-lg border border-rose-300 bg-white px-4 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:cursor-wait disabled:opacity-60">{rejectingProposalId != null && String(rejectingProposalId) === String(proposal.id) ? (isVi ? "Đang gửi..." : "Sending...") : (isVi ? "Từ chối" : "Reject")}</button>
                </div>
              </article>
            })}
          </section>

          {closedSessionProposals.length > 0 && <section aria-labelledby="closed-proposals-title" className="space-y-2">
            <h3 id="closed-proposals-title" className="text-sm font-extrabold text-slate-900">{isVi ? "Đề xuất đã phản hồi" : "Responded proposals"}</h3>
            {closedSessionProposals.map((proposal) => <div key={proposal.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <span className="font-semibold text-slate-700">{proposal.sessionDate} · {String(proposal.startTime || "").slice(0, 5)}–{String(proposal.endTime || "").slice(0, 5)}</span>
              <span className="font-bold text-slate-600">{proposal.status}</span>
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
                  ? "Hãy chọn HLV ở tab Danh bạ để đặt buổi tập riêng."
                  : "Select a coach in the Directory tab to book a 1-on-1 workout."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {privateSessions.map((s) => (
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
                        {s.status || "Scheduled"}
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
                        {s.roomName || "Phòng PT VIBE Sport"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Absence request button */}
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

                    {/* Cancel session button */}
                    <button
                      type="button"
                      onClick={() => handleCancelPrivate(s.id)}
                      className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-colors"
                    >
                      {isVi ? "Hủy buổi tập" : "Cancel"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: ADVANCED PT COACH REGISTRATIONS (/api/advanced-registrations) */}
      {activeTab === "advanced_pt" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isVi
                  ? "Danh sách yêu cầu đăng ký HLV chuyên sâu (Advanced PT)"
                  : "Advanced PT Coach Registrations"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isVi
                  ? "Theo dõi trạng thái HLV duyệt nhận học viên và khởi tạo thanh toán gói Advanced."
                  : "Track coach acceptance status and initiate payment for Advanced PT packages."}
              </p>
            </div>
            <button
              type="button"
              onClick={fetchAdvancedRegistrations}
              className="text-xs font-bold text-brand-accent-dark hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{isVi ? "Tải lại" : "Refresh"}</span>
            </button>
          </div>

          {loadingAdvanced ? (
            <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
              <span>
                {isVi ? "Đang tải dữ liệu đăng ký..." : "Loading requests..."}
              </span>
            </div>
          ) : advancedRegistrations.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 space-y-2">
              <Award className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700 text-sm">
                {isVi
                  ? "Chưa có yêu cầu đăng ký HLV chính nào"
                  : "No primary coach requests"}
              </p>
              <p>
                {isVi
                  ? "Chọn nút 'Đăng ký HLV chính' trên thẻ HLV ở tab Danh bạ để gửi yêu cầu."
                  : "Click 'Primary Coach' on any coach card in the Directory tab to apply."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {advancedRegistrations.map((reg) => {
                const st = String(reg.status || "").toLowerCase()
                const isAlternativeProposed = st.includes("alternative")
                const canOrder =
                  st === "accepted" || st === "approved"
                    ? !reg.subscriptionId
                    : false
                return (
                  <div
                    key={reg.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {reg.subjectName || `Bộ môn #${reg.subjectId}`} · HLV{" "}
                          {reg.primaryCoachName ||
                            reg.alternativeCoachName ||
                            `#${reg.primaryCoachId}`}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            st.includes("accept") || st.includes("approv")
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : st.includes("reject") || st.includes("cancel")
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {reg.status || "Pending"}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                        {reg.alternativeCoachName && (
                          <span className="text-amber-800 font-semibold">
                            HLV thay thế đề xuất:{" "}
                            <strong>{reg.alternativeCoachName}</strong>
                          </span>
                        )}
                        {reg.remainingCredit !== undefined &&
                          reg.remainingCredit !== null && (
                            <span>
                              Credit còn lại:{" "}
                              <strong>{reg.remainingCredit}</strong>
                            </span>
                          )}
                        {reg.subscriptionStatus && (
                          <span>
                            Gói: <strong>{reg.subscriptionStatus}</strong>
                          </span>
                        )}
                        {(reg.reason || reg.note) && (
                          <span>Ghi chú: {reg.reason || reg.note}</span>
                        )}
                      </div>
                    </div>

                    {isAlternativeProposed && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={orderingRegId === reg.id}
                          onClick={() =>
                            handleConfirmAlternativeCoach(reg, true)
                          }
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
                        >
                          {isVi
                            ? "Đồng ý HLV thay thế"
                            : "Accept Alternative Coach"}
                        </button>
                        <button
                          type="button"
                          disabled={orderingRegId === reg.id}
                          onClick={() =>
                            handleConfirmAlternativeCoach(reg, false)
                          }
                          className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold cursor-pointer"
                        >
                          {isVi ? "Từ chối" : "Decline"}
                        </button>
                      </div>
                    )}

                    {canOrder && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={orderingRegId === reg.id}
                          onClick={() =>
                            handleCreateOrderForAdvanced(reg, "Cash")
                          }
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                        >
                          {isVi ? "Tạo đơn Tiền mặt" : "Order (Cash)"}
                        </button>
                        <button
                          type="button"
                          disabled={orderingRegId === reg.id}
                          onClick={() =>
                            handleCreateOrderForAdvanced(reg, "VNPay")
                          }
                          className="px-3 py-1.5 rounded-lg bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold cursor-pointer"
                        >
                          {isVi ? "Thanh toán VNPay" : "Order (VNPay)"}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* MODAL 3: COACH WORK SCHEDULE, CAPACITY & ADVANCED PT REGISTRATION */}
      {advancedModalCoach && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {isVi
                    ? `Lịch làm việc & Đăng ký HLV ${advancedModalCoach.name}`
                    : `Work Schedule & Register Coach ${advancedModalCoach.name}`}
                </h3>
                <p className="text-xs text-slate-500">
                  {isVi
                    ? "Kiểm tra ca làm việc, sức chứa học viên và gửi yêu cầu đăng ký HLV chuyên sâu"
                    : "Review coach schedule, student capacity, and submit an Advanced PT request"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdvancedModalCoach(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingCoachMeta ? (
              <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
                <span>
                  {isVi
                    ? "Đang tải lịch làm việc của HLV..."
                    : "Loading coach work schedule..."}
                </span>
              </div>
            ) : (
              coachWorkSchedule && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">
                      {isVi
                        ? "Trạng thái nhận học viên mới:"
                        : "Accepting new students:"}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${
                        coachWorkSchedule.acceptingNew !== false
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {coachWorkSchedule.acceptingNew !== false
                        ? isVi
                          ? "Đang nhận học viên"
                          : "Open"
                        : isVi
                          ? "Tạm ngưng nhận mới"
                          : "Closed"}
                    </span>
                  </div>
                  {weeklyShiftRows.length > 0 && (
                      <div>
                        <div className="mb-2 flex items-center justify-between"><span className="font-bold text-slate-700">{isVi ? "Lịch ca hàng tuần" : "Weekly shift schedule"}</span><span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-800">{weeklyShiftRows.reduce((sum, row) => sum + row.slots.length, 0)} {isVi ? "ca" : "shifts"}</span></div>
                        <div className="space-y-1.5">
                          {weeklyShiftRows.map((row) => <div key={row.key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"><span className="font-semibold text-slate-700">{row.name}</span><div className="flex flex-wrap justify-end gap-1">{row.slots.map((slot) => <span key={slot} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700">{isVi ? `Ca ${slot}` : `Slot ${slot}`}</span>)}</div></div>)}
                        </div>
                      </div>
                    )}
                </div>
              )
            )}

            {advancedError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
                {advancedError}
              </div>
            )}

            <form
              onSubmit={handleSubmitAdvancedRegistration}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isVi
                    ? "Chọn bộ môn đăng ký HLV chuyên sâu *"
                    : "Select Training Subject *"}
                </label>
                <select
                  required
                  value={selectedSubjectId}
                  onChange={(e) =>
                    handleChangeSubjectForCapacity(e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs bg-white outline-none focus:border-brand-primary"
                >
                  <option value="">
                    {isVi ? "-- Chọn bộ môn --" : "-- Select Subject --"}
                  </option>
                  {(subjects || []).map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              {coachCapacity && (
                <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold">
                      {isVi ? "Slot trống" : "Available"}
                    </div>
                    <div className="text-base font-extrabold text-blue-900 font-mono">
                      {coachCapacity.availableSlots ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold">
                      {isVi ? "Đang dạy (Credits)" : "Outstanding"}
                    </div>
                    <div className="text-base font-extrabold text-slate-900 font-mono">
                      {coachCapacity.outstandingCredits ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold">
                      {isVi ? "Đang chờ duyệt" : "Requested"}
                    </div>
                    <div className="text-base font-extrabold text-amber-800 font-mono">
                      {coachCapacity.requestedCredits ?? "—"}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdvancedModalCoach(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  {isVi ? "Đóng" : "Close"}
                </button>
                <button
                  type="submit"
                  disabled={submittingAdvanced || !selectedSubjectId}
                  className="px-5 py-2 bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  {submittingAdvanced
                    ? isVi
                      ? "Đang gửi..."
                      : "Submitting..."
                    : isVi
                      ? "Gửi yêu cầu đăng ký HLV"
                      : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
    </main>
  )
}

export default MemberMyCoachView
