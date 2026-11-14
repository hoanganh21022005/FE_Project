import React, { useState, useEffect, useCallback, useMemo } from "react"
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
  AlertTriangle,
  Loader2,
  MapPin,
  CalendarDays,
  ShieldCheck,
  AlertCircle,
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import {
  memberPortalApi,
  fetchSessionProposals,
  respondSessionProposal,
} from "../../api/memberPortalApi"
import { httpClient, UNAUTHORIZED_EVENT } from "../../api/httpClient"
import { membershipApi } from "../../api/membershipApi"
import { invoiceApi } from "../../api/invoiceApi"
import { startVnpayCheckout } from "../../utils/vnpayCheckout"
import { getAuthoritativeProfileId } from "../../utils/memberSafetyHelpers"
import { getErrorMessage } from "../../api/apiErrors"
import { resolveCoachAvatar } from "../../data/publicCoaches"
import { PageHeader } from "../ui/PageHeader"

export function MemberMyCoachView() {
  const { language, currentUser, subjects, apiEnabled, showToast, t } = useSCMS()
  const isVi = language === "vi"

  // Navigation tab: 'my_sessions' | 'coaches' | 'advanced_pt'
  const [activeTab, setActiveTab] = useState("my_sessions")

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
  const [proposals, setProposals] = useState([])
  const [respondingProposalId, setRespondingProposalId] = useState(null)
  const [proposalError, setProposalError] = useState("")
  const [loadingSessions, setLoadingSessions] = useState(false)

  // Booking Modal State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false)
  const [selectedCoach, setSelectedCoach] = useState(null)
  const [bookingDate, setBookingDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })
  const [availableSlots, setAvailableSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [selectedRoomId, setSelectedRoomId] = useState("")
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState("")
  const [submittingBooking, setSubmittingBooking] = useState(false)
  const [bookingError, setBookingError] = useState("")
  const [bookingSuccess, setBookingSuccess] = useState("")

  // Absence Modal State
  const [absenceModalOpen, setAbsenceModalOpen] = useState(false)
  const [selectedSessionForAbsence, setSelectedSessionForAbsence] =
    useState(null)
  const [absenceReason, setAbsenceReason] = useState("")
  const [submittingAbsence, setSubmittingAbsence] = useState(false)
  const [absenceMsg, setAbsenceMsg] = useState("")
  const [absenceError, setAbsenceError] = useState("")

  // Member ID
  const memberProfileId = useMemo(() => {
    return getAuthoritativeProfileId(currentUser) || currentUser?.id
  }, [currentUser])

  const coachSports = useMemo(() => [...new Set(coaches.flatMap((coach) => Array.isArray(coach.specializations) && coach.specializations.length ? coach.specializations : coach.specialization ? [coach.specialization] : []).filter(Boolean))], [coaches])
  const sessionStartTime = (session) => new Date(`${String(session?.sessionDate || "").slice(0, 10)} ${String(session?.startTime || "").slice(0, 8)}`)
  const upcomingPrivateSessions = privateSessions.filter((session) => {
    const status = String(session?.status || "").trim().toLowerCase()
    const start = sessionStartTime(session)
    return status === "scheduled" && !Number.isNaN(start.getTime()) && start.getTime() >= Date.now()
  }).length
  const visiblePrivateSessions = privateSessions.filter((session) => !["cancelled", "canceled", "absent"].includes(String(session?.status || session?.displayStatus || "").trim().toLowerCase()))
  const pendingProposals = useMemo(() => {
    return (Array.isArray(proposals) ? proposals : []).filter(
      (p) => String(p?.status || "").trim().toLowerCase() === "pending",
    )
  }, [proposals])

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
  const fetchMemberCredits = useCallback(async () => {
    if (!memberProfileId) return []
    try {
      const [subs] = await Promise.all([
        membershipApi.getMemberSubscriptions(memberProfileId).catch(() => []),
        httpClient.get("/api/member-packages").catch(() => null),
      ])
      const valid = (Array.isArray(subs) ? subs : []).filter((s) => {
        const st = String(s?.status || "").toLowerCase()
        return st === "active" || st === "grace_period"
      })
      setSubscriptions(valid)
      if (valid.length > 0) {
        setSelectedSubscriptionId((prev) => prev || String(valid[0].subscriptionId || valid[0].id))
      }
      return valid
    } catch (err) {
      console.warn("Could not fetch subscriptions/credits:", err)
      return []
    }
  }, [memberProfileId])

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

    fetchMemberCredits()
  }, [apiEnabled, fetchMemberCredits])

  // 3. Fetch Booked Private Sessions
  const fetchPrivateSessions = useCallback(async () => {
    setLoadingSessions(true)
    try {
      if (apiEnabled) {
        const allSessions = await memberPortalApi.getClassSessions()
        const privates = (Array.isArray(allSessions) ? allSessions : []).filter(
          (s) =>
            (s.isPrivate === true ||
              String(s.type || "").toUpperCase() === "PRIVATE") &&
            (!memberProfileId ||
              !s.bookedMemberId ||
              String(s.bookedMemberId) === String(memberProfileId)),
        )
        setPrivateSessions(privates)
        return privates
      } else {
        setPrivateSessions([])
        return []
      }
    } catch (err) {
      console.warn("Could not fetch private sessions:", err)
      return []
    } finally {
      setLoadingSessions(false)
    }
  }, [apiEnabled, memberProfileId])

  // Fetch Proposals
  const fetchProposals = useCallback(async () => {
    if (!apiEnabled) {
      setProposals([])
      return []
    }
    try {
      const rows = await memberPortalApi.fetchSessionProposals()
      const list = Array.isArray(rows) ? rows : []
      setProposals(list)
      return list
    } catch (err) {
      console.warn("Could not fetch session proposals:", err)
      return []
    }
  }, [apiEnabled])

  const refreshProposalView = useCallback(async () => {
    await Promise.all([
      fetchProposals(),
      fetchPrivateSessions(),
      fetchMemberCredits(),
    ])
  }, [fetchProposals, fetchPrivateSessions, fetchMemberCredits])

  useEffect(() => {
    refreshProposalView()
  }, [refreshProposalView])

  useEffect(() => {
    if (activeTab === "my_sessions") {
      refreshProposalView()
    }
  }, [activeTab, refreshProposalView])

  const isExpiredProposal = useCallback((p) => {
    if (!p) return false
    if (p.expired === true) return true
    if (String(p.status || "").toLowerCase() === "expired") return true
    const deadline = p.respondBy || p.respond_by || p.deadline || p.expiresAt
    if (!deadline) return false
    const deadlineMs = new Date(
      typeof deadline === "string" ? deadline.replace(" ", "T") : deadline,
    ).getTime()
    return !Number.isNaN(deadlineMs) && deadlineMs <= Date.now()
  }, [])

  const respondToProposal = async (proposal, accepted) => {
    if (respondingProposalId != null) return
    setRespondingProposalId(proposal.id)
    setProposalError("")
    try {
      await memberPortalApi.respondSessionProposal(proposal.id, Boolean(accepted))
      showToast?.(
        accepted
          ? (isVi ? "Đã đồng ý đề xuất lịch tập thành công!" : "Session proposal accepted!")
          : (isVi ? "Đã từ chối đề xuất lịch tập." : "Session proposal declined."),
        "success",
      )
      // Refetch proposals, session schedule, and member credits (member_packages)
      await refreshProposalView()
    } catch (error) {
      const status = Number(error?.status || error?.response?.status || 0)
      const code = String(error?.code || error?.details?.code || "")
      const msg = String(error?.message || error?.details?.message || "")
      const isConflictOrExpired =
        status === 409 ||
        code === "PROPOSAL_EXPIRED" ||
        code.toLowerCase().includes("conflict") ||
        code.toLowerCase().includes("expired") ||
        msg.toLowerCase().includes("conflict") ||
        msg.toLowerCase().includes("expired")

      if (isConflictOrExpired) {
        setProposalError(
          code === "PROPOSAL_EXPIRED"
            ? (isVi
                ? "Đề xuất lịch tập đã quá hạn phản hồi (trước giờ tập tối thiểu 12 giờ)."
                : "The session proposal has expired (must respond at least 12 hours before session).")
            : (isVi
                ? "Xung đột lịch tập hoặc đề xuất đã hết hạn. Vui lòng kiểm tra lại."
                : "Schedule conflict or proposal has expired. Please check again.")
        )
      } else {
        setProposalError(
          getErrorMessage(
            error,
            isVi ? "Không thể phản hồi đề xuất lịch." : "Could not respond to session proposal."
          )
        )
      }
      // Note: do not auto-retry
    } finally {
      setRespondingProposalId(null)
    }
  }

  useEffect(() => {
    if (activeTab === "my_sessions") refreshProposalView()
  }, [activeTab, refreshProposalView])

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

  // 4. Fetch Available Slots when Coach & Date are chosen (GET /api/coaches/{coachId}/available-slots)
  const fetchSlots = useCallback(
    async (coachId, date, filterOpts = {}) => {
      if (!coachId || !date) return
      setLoadingSlots(true)
      setSelectedSlot(null)
      try {
        if (apiEnabled) {
          const slots = await memberPortalApi.getCoachAvailableSlots(
            coachId,
            date,
            filterOpts,
          )
          setAvailableSlots(Array.isArray(slots) ? slots : [])
        } else {
          setAvailableSlots([])
        }
      } catch (err) {
        console.warn("Could not load slots:", err)
        setAvailableSlots([])
      } finally {
        setLoadingSlots(false)
      }
    },
    [apiEnabled],
  )

  const handleOpenBookingModal = (coach) => {
    setSelectedCoach(coach)
    setSelectedSlot(null)
    setBookingError("")
    setBookingSuccess("")
    setIsBookingModalOpen(true)
    fetchSlots(coach.id, bookingDate)
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

  const handleDateChange = (newDate) => {
    setBookingDate(newDate)
    if (selectedCoach) {
      fetchSlots(selectedCoach.id, newDate)
    }
  }

  // 5. Submit Private Booking (POST /api/sessions/book-private)
  const handleBookingSubmit = async (e) => {
    e.preventDefault()
    if (
      !selectedCoach ||
      !selectedSlot ||
      !selectedRoomId ||
      !selectedSubscriptionId
    ) {
      setBookingError(
        isVi
          ? "Vui lòng chọn đầy đủ khung giờ, phòng tập và gói hội viên."
          : "Please select a slot, room, and membership.",
      )
      return
    }

    setSubmittingBooking(true)
    setBookingError("")
    setBookingSuccess("")

    // Format LocalTime string (HH:mm:ss or HH:mm)
    const formatTimeStr = (t) => {
      if (!t) return "07:00:00"
      if (typeof t === "string") return t.length === 5 ? `${t}:00` : t
      if (typeof t === "object" && t.hour !== undefined) {
        return `${String(t.hour).padStart(2, "0")}:${String(t.minute || 0).padStart(2, "0")}:00`
      }
      return String(t)
    }

    const payload = {
      coachId: Number(selectedCoach.id),
      sessionDate: bookingDate,
      startTime: formatTimeStr(selectedSlot.startTime),
      endTime: formatTimeStr(selectedSlot.endTime),
      roomId: Number(selectedRoomId),
      subscriptionId: Number(selectedSubscriptionId),
    }

    try {
      if (apiEnabled) {
        const conflictRes = await memberPortalApi
          .checkSessionConflict(payload)
          .catch(() => null)
        if (conflictRes?.hasConflict || conflictRes?.conflict) {
          throw new Error(
            conflictRes.message ||
              (isVi
                ? "Khung giờ hoặc phòng tập này đang bị trùng lịch."
                : "This slot or room has a schedule conflict."),
          )
        }
        await memberPortalApi.bookPrivateSession(payload)
      }
      setBookingSuccess(
        isVi
          ? "Đặt lịch tập 1:1 với Huấn luyện viên thành công!"
          : "Private 1-on-1 session booked successfully!",
      )
      setTimeout(() => {
        setIsBookingModalOpen(false)
        setActiveTab("my_sessions")
      }, 1500)
    } catch (err) {
      setBookingError(
        getErrorMessage(
          err,
          isVi
            ? "Không thể đặt lịch tập với HLV."
            : "Could not book private session.",
        ),
      )
    } finally {
      setSubmittingBooking(false)
    }
  }

  // Verify session ownership against current member
  const checkSessionOwnership = (session) => {
    if (!session) {
      return {
        isOwner: false,
        error: isVi
          ? "Không tìm thấy thông tin buổi tập."
          : "Session not found.",
      }
    }
    const sessionMemberId =
      session.bookedMemberId ??
      session.memberId ??
      session.studentId ??
      session.member?.id

    if (sessionMemberId != null && memberProfileId != null) {
      const isMatch =
        String(sessionMemberId) === String(memberProfileId) ||
        String(sessionMemberId) === String(currentUser?.id)
      if (!isMatch) {
        return {
          isOwner: false,
          error: isVi
            ? "Bạn không có quyền thao tác trên buổi tập của học viên khác (FORBIDDEN_NOT_OWNER)."
            : "You are not authorized to manage another member's session (FORBIDDEN_NOT_OWNER).",
        }
      }
    }
    return { isOwner: true, error: null }
  }

  // Handle detailed errors: expired token -> logout/refresh; detailed 403 (FORBIDDEN_NOT_OWNER, INVALID_ROLE)
  const handleSessionActionError = (err, fallbackText) => {
    const status = Number(err?.status ?? err?.response?.status) || 0
    const code = String(
      err?.code ||
        err?.details?.code ||
        err?.response?.data?.code ||
        err?.details?.error ||
        "",
    ).toUpperCase()
    const msg = String(
      err?.message ||
        err?.details?.message ||
        err?.response?.data?.message ||
        "",
    ).toLowerCase()

    // 1. If token expired, trigger logout / refresh flow
    const isTokenExpired =
      status === 401 ||
      code.includes("EXPIRED") ||
      code.includes("TOKEN") ||
      code.includes("AUTH_EXPIRED") ||
      msg.includes("token expired") ||
      msg.includes("phiên đăng nhập hết hạn") ||
      msg.includes("jwt expired")

    if (isTokenExpired) {
      const expiredMsg = isVi
        ? "Phiên đăng nhập đã hết hạn. Đang chuyển hướng đăng nhập lại..."
        : "Session expired. Redirecting to log in again..."
      showToast?.(expiredMsg, "error")
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
      }
      return expiredMsg
    }

    // 2. Detailed 403 inspections
    if (status === 403) {
      if (
        code === "FORBIDDEN_NOT_OWNER" ||
        msg.includes("not owner") ||
        msg.includes("không phải chủ")
      ) {
        const notOwnerMsg = isVi
          ? "Bạn không có quyền thao tác trên buổi tập của học viên khác (FORBIDDEN_NOT_OWNER)."
          : "You cannot manage another member's session (FORBIDDEN_NOT_OWNER)."
        showToast?.(notOwnerMsg, "error")
        return notOwnerMsg
      }
      if (
        code === "INVALID_ROLE" ||
        msg.includes("role") ||
        msg.includes("vai trò")
      ) {
        const roleMsg = isVi
          ? "Tài khoản không đúng vai trò hội viên để thực hiện thao tác này (INVALID_ROLE)."
          : "Invalid role for this action (INVALID_ROLE)."
        showToast?.(roleMsg, "error")
        return roleMsg
      }
    }

    const formatted = getErrorMessage(err, fallbackText)
    showToast?.(formatted, "error")
    return formatted
  }

  // 12-hour threshold logic:
  // Calculate diffHours = (new Date(session.sessionDate + ' ' + session.startTime) - new Date()) / (1000 * 60 * 60)
  // isCancellable = diffHours >= 12
  // isAbsentApplicable = diffHours < 12 && diffHours > 0 (or until session ends)
  const getSessionTimingRule = (session, now = new Date()) => {
    if (!session) {
      return { diffHours: null, isCancellable: false, isAbsentApplicable: false, hasEnded: true }
    }

    const status = String(session.status || session.displayStatus || "").toLowerCase()
    if (
      status === "cancelled" ||
      status === "canceled" ||
      status === "absent" ||
      status === "completed"
    ) {
      return { diffHours: null, isCancellable: false, isAbsentApplicable: false, hasEnded: true }
    }

    const datePart = String(session.sessionDate || session.date || "").slice(0, 10)
    const startTimePart = String(session.startTime || session.sessionStartTime || "00:00").slice(0, 5)
    const endTimePart = String(session.endTime || session.sessionEndTime || session.startTime || "23:59").slice(0, 5)

    if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return { diffHours: null, isCancellable: false, isAbsentApplicable: false, hasEnded: true }
    }

    const startDateTime = new Date(`${datePart} ${startTimePart}`)
    const endDateTime = new Date(`${datePart} ${endTimePart}`)

    const nowDate = now instanceof Date ? now : new Date(now)
    const nowMs = nowDate.getTime()
    const startMs = startDateTime.getTime()
    const endMs = endDateTime.getTime()

    if (Number.isNaN(startMs)) {
      return { diffHours: null, isCancellable: false, isAbsentApplicable: false, hasEnded: false }
    }

    const diffHours = (startMs - nowMs) / (1000 * 60 * 60)
    const hasEnded = !Number.isNaN(endMs) ? nowMs >= endMs : diffHours <= 0

    if (hasEnded) {
      return { diffHours, isCancellable: false, isAbsentApplicable: false, hasEnded: true }
    }

    const isCancellable = diffHours >= 12
    const isAbsentApplicable = diffHours < 12 && !hasEnded

    return {
      diffHours,
      isCancellable,
      isAbsentApplicable,
      hasEnded: false,
    }
  }

  // 6. Cancel Private Session (POST /api/member/sessions/{sessionId}/cancel)
  const handleCancelPrivate = async (sessionId) => {
    const session = privateSessions.find(
      (s) => String(s.id ?? s.sessionId) === String(sessionId),
    )

    const ownership = checkSessionOwnership(session)
    if (!ownership.isOwner) {
      showToast?.(ownership.error, "error")
      return
    }

    const timing = getSessionTimingRule(session)
    if (!timing.isCancellable) {
      showToast?.(
        isVi
          ? "Chỉ được hủy lịch trước giờ học tối thiểu 12 tiếng để được hoàn lại 1 credit."
          : "Cancellation with credit refund is only allowed at least 12 hours before session start.",
        "error",
      )
      return
    }

    if (
      !window.confirm(
        isVi
          ? "Bạn có chắc chắn muốn hủy lịch buổi tập riêng này (trước ≥ 12h, được hoàn 1 credit) không?"
          : "Are you sure you want to cancel this private session (≥ 12h notice refunds 1 credit)?",
      )
    )
      return

    try {
      if (apiEnabled) {
        await memberPortalApi.cancelPrivateSession(sessionId, {
          reason: "Member requested cancellation",
          cancellationReason: "Member requested cancellation",
          memberId: memberProfileId,
        })
      }
      showToast?.(
        isVi
          ? "Đã hủy lịch buổi tập riêng và hoàn lại 1 credit vào gói gốc."
          : "Private session cancelled and 1 credit refunded.",
        "success",
      )

      // On success (200): refetch session list and update credit balance
      await Promise.all([fetchPrivateSessions(), fetchMemberCredits(), fetchProposals()])
    } catch (err) {
      const cancelErrorText = [
        err?.message,
        err?.response?.data?.message,
        err?.response?.data?.error,
        err?.details?.message,
      ].filter(Boolean).join(" ").toLowerCase()
      if (cancelErrorText.includes("original credit has already been returned")) {
        await Promise.all([fetchPrivateSessions(), fetchMemberCredits(), fetchProposals()])
        setPrivateSessions((current) => current.map((item) =>
          String(item.id ?? item.sessionId) === String(sessionId)
            ? { ...item, status: "Cancelled", displayStatus: "Cancelled" }
            : item,
        ))
        return
      }
      handleSessionActionError(
        err,
        isVi ? "Không thể hủy lịch buổi tập." : "Could not cancel session.",
      )
    }
  }

  // 7. Request Absence (POST /api/member/sessions/{sessionId}/absence)
  const handleAbsenceSubmit = async (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault()
    }
    if (submittingAbsence) return

    setAbsenceError("")
    setAbsenceMsg("")

    if (!selectedSessionForAbsence) {
      const msg = isVi
        ? "Không tìm thấy thông tin buổi tập."
        : "Session not found."
      setAbsenceError(msg)
      showToast?.(msg, "error")
      return
    }

    const ownership = checkSessionOwnership(selectedSessionForAbsence)
    if (!ownership.isOwner) {
      setAbsenceError(ownership.error)
      showToast?.(ownership.error, "error")
      return
    }

    const timing = getSessionTimingRule(selectedSessionForAbsence)
    if (timing.hasEnded) {
      const msg = isVi
        ? "Buổi tập này đã kết thúc, không thể xin vắng mặt."
        : "This session has already ended."
      setAbsenceError(msg)
      showToast?.(msg, "error")
      return
    }

    const trimmedReason = String(absenceReason || "").trim()
    if (!trimmedReason) {
      const msg = isVi
        ? "Vui lòng nhập lý do xin vắng mặt."
        : "Please enter a reason for absence."
      setAbsenceError(msg)
      showToast?.(msg, "error")
      return
    }

    setSubmittingAbsence(true)
    try {
      const targetSessionId =
        selectedSessionForAbsence.id ??
        selectedSessionForAbsence.sessionId ??
        selectedSessionForAbsence.rawId

      if (apiEnabled) {
        await memberPortalApi.requestAbsence(targetSessionId, {
          reason: trimmedReason,
          cancellationReason: trimmedReason,
          memberId: memberProfileId,
        })
      }

      const successMsg = isVi
        ? "Đã gửi đơn xin vắng mặt thành công!"
        : "Absence request submitted successfully!"
      setAbsenceMsg(successMsg)
      showToast?.(successMsg, "success")

      setTimeout(() => {
        setAbsenceModalOpen(false)
        setSelectedSessionForAbsence(null)
        setAbsenceReason("")
        setAbsenceMsg("")
        setAbsenceError("")
        // On success (200): refetch session list and update credit balance
        fetchPrivateSessions()
        fetchProposals()
        fetchMemberCredits()
        if (apiEnabled && memberProfileId) {
          fetchMemberCredits?.()
        }
      }, 1200)
    } catch (err) {
      const errorMsg = handleSessionActionError(
        err,
        isVi
          ? "Không thể gửi đơn xin vắng mặt. Vui lòng thử lại sau."
          : "Could not submit absence.",
      )
      setAbsenceError(errorMsg)
    } finally {
      setSubmittingAbsence(false)
    }
  }

  const renderPendingProposalsSection = () => {
    if (pendingProposals.length === 0 && activeTab !== "my_sessions") {
      return null
    }

    return (
      <section
        aria-label="Chờ xác nhận"
        className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 sm:p-6 shadow-xs space-y-4"
        data-testid="proposals-pending-section"
      >
        <div className="flex items-center justify-between border-b border-amber-200/60 pb-3">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-slate-900">
              {isVi ? "Chờ xác nhận" : "Chờ xác nhận"}
            </h2>
            <p className="text-xs text-slate-600">
              {isVi
                ? "Danh sách đề xuất lịch tập 1:1 từ Huấn luyện viên chờ bạn xác nhận."
                : "1-on-1 session proposals from your coach awaiting your confirmation."}
            </p>
          </div>
          {pendingProposals.length > 0 && (
            <span className="rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-bold text-amber-900">
              {pendingProposals.length} {isVi ? "đề xuất" : "proposals"}
            </span>
          )}
        </div>

        {proposalError && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{proposalError}</span>
          </div>
        )}

        {pendingProposals.length === 0 ? (
          <div className="p-4 rounded-xl bg-white border border-dashed border-amber-200 text-center text-xs text-slate-500">
            {isVi
              ? "Không có đề xuất lịch tập nào đang chờ xác nhận."
              : "No pending session proposals awaiting confirmation."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingProposals.map((p) => {
              const expired = isExpiredProposal(p)
              const coachDisplayName =
                p.coachName ||
                (p.coach?.name ? p.coach.name : null) ||
                (p.coachId ? `Coach #${p.coachId}` : (isVi ? "Huấn luyện viên" : "Coach"))
              const formattedDate = p.sessionDate || p.date || "—"
              const timeSlotDisplay =
                p.startTime && p.endTime
                  ? `${String(p.startTime).slice(0, 5)} - ${String(p.endTime).slice(0, 5)}`
                  : (p.timeSlot || "—")
              const roomDisplayName =
                p.roomName ||
                (p.room?.name ? p.room.name : null) ||
                (p.roomId ? `Phòng #${p.roomId}` : (isVi ? "Phòng tập" : "Room"))
              const deadlineDisplay = p.respondBy || p.deadline || "—"

              return (
                <article
                  key={p.id}
                  className="rounded-xl border border-amber-200 bg-white p-4 shadow-xs space-y-3"
                  data-testid={`proposal-card-${p.id}`}
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        {coachDisplayName}
                      </div>
                      {(p.subjectName || p.sportName) && (
                        <div className="text-xs text-slate-500 font-semibold mt-0.5">
                          {p.subjectName || p.sportName}
                        </div>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        expired
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : "bg-amber-50 text-amber-800 border border-amber-200"
                      }`}
                    >
                      {expired
                        ? isVi ? "Đã quá hạn" : "Expired"
                        : isVi ? "Chờ xác nhận" : "Pending"}
                    </span>
                  </div>

                  {/* Proposal Info: Coach, date, time slot, room, and respondBy deadline */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs text-slate-600 bg-slate-50/80 p-3 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        {isVi ? "Huấn luyện viên" : "Coach"}
                      </span>
                      <span className="font-semibold text-slate-800">{coachDisplayName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        {isVi ? "Ngày tập" : "Date"}
                      </span>
                      <span className="font-semibold text-slate-800">{formattedDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        {isVi ? "Khung giờ" : "Time slot"}
                      </span>
                      <span className="font-semibold text-slate-800 font-mono">{timeSlotDisplay}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        {isVi ? "Phòng tập" : "Room"}
                      </span>
                      <span className="font-semibold text-slate-800">{roomDisplayName}</span>
                    </div>
                  </div>

                  <div className={`text-xs font-semibold flex items-center justify-between ${expired ? "text-rose-700" : "text-amber-900"}`}>
                    <span>
                      {isVi ? "Hạn phản hồi (respondBy):" : "Respond by:"}{" "}
                      <span className="font-mono font-bold">{deadlineDisplay}</span>
                    </span>
                    {expired && (
                      <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        {isVi ? "Đã quá hạn" : "Expired"}
                      </span>
                    )}
                  </div>

                  {/* Action buttons: Đồng ý & Từ chối */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={expired || respondingProposalId === p.id}
                      onClick={() => respondToProposal(p, true)}
                      title={isVi ? "Đồng ý" : "Accept"}
                      aria-label="Đồng ý / Accept"
                      className="flex-1 inline-flex items-center justify-center rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
                      data-action="accept"
                      data-testid="proposal-accept-btn"
                    >
                      {respondingProposalId === p.id && (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      )}
                      <span>{isVi ? "Đồng ý" : "Accept"}</span>
                    </button>
                    <button
                      type="button"
                      disabled={expired || respondingProposalId === p.id}
                      onClick={() => respondToProposal(p, false)}
                      title={isVi ? "Từ chối" : "Reject"}
                      aria-label="Từ chối / Reject"
                      className="flex-1 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-2xs"
                      data-action="reject"
                      data-testid="proposal-reject-btn"
                    >
                      {respondingProposalId === p.id && (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      )}
                      <span>{isVi ? "Từ chối" : "Reject"}</span>
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    )
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
              onClick={() => setActiveTab("my_sessions")}
              className={`px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "my_sessions"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {isVi ? "Lịch tập & Đề xuất 1:1" : "1:1 Sessions & Proposals"}{" "}
              <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5">
                {privateSessions.length}
              </span>
              {pendingProposals.length > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 text-white px-1.5 py-0.5 text-[10px] font-bold">
                  {pendingProposals.length} {isVi ? "chờ duyệt" : "pending"}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("coaches")}
              className={`px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "coaches"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {isVi ? "Danh bạ Huấn luyện viên" : "Coach directory"}{" "}
              <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5">{coaches.length}</span>
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

                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: MY BOOKED 1-ON-1 SESSIONS */}
      {activeTab === "my_sessions" && (
        <div className="space-y-6">
          {renderPendingProposalsSection()}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {isVi
                  ? "Danh sách buổi tập riêng 1:1 của bạn"
                  : "Your Booked 1-on-1 Sessions"}
              </h2>
              <button
                type="button"
                onClick={fetchPrivateSessions}
                className="text-xs font-bold text-brand-accent-dark hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{isVi ? "Tải lại" : "Refresh"}</span>
              </button>
            </div>

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
                      {getSessionTimingRule(s).isAbsentApplicable && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSessionForAbsence(s)
                          setAbsenceReason("")
                          setAbsenceError("")
                          setAbsenceMsg("")
                          setAbsenceModalOpen(true)
                        }}
                        className="px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-colors cursor-pointer"
                      >
                        {isVi ? "Xin vắng mặt" : "Report absence"}
                      </button>
                      )}

                      {/* Cancel session button */}
                      {getSessionTimingRule(s).isCancellable && (
                      <button
                        type="button"
                        onClick={() => handleCancelPrivate(s.id)}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 transition-colors cursor-pointer"
                      >
                        {isVi ? "Hủy buổi tập" : "Cancel"}
                      </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 3: ADVANCED PT COACH REGISTRATIONS (/api/advanced-registrations) */}
      {false && activeTab === "advanced_pt" && (
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
      {false && advancedModalCoach && (
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

      {/* MODAL 1: BOOK PRIVATE 1-ON-1 SESSION (POST /api/sessions/book-private) */}
      {isBookingModalOpen && selectedCoach && false && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {apiEnabled
                    ? isVi
                      ? "Tra cứu lịch trống Huấn luyện viên"
                      : "Coach Availability"
                  : isVi
                    ? "Đặt lịch tập 1:1 với Huấn luyện viên"
                    : "Book 1-on-1 Session"}
              </h3>
              <button
                type="button"
                onClick={() => setIsBookingModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {apiEnabled && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 leading-relaxed">
                {isVi ? "Tra cứu khung giờ trống theo ngày để thống nhất lịch tập 1:1 cùng Huấn luyện viên phụ trách (xếp lịch trước tối thiểu 12 giờ)." : "Check available times by date and coordinate a 1:1 session with your coach at least 12 hours in advance."}
              </div>
            )}

            {/* Coach info bar */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
              <img
                src={resolveCoachAvatar(selectedCoach)}
                alt={selectedCoach.name}
                className="w-12 h-12 rounded-lg object-cover object-top"
              />
              <div className="min-w-0">
                <div className="font-bold text-slate-900 text-sm">
                  {selectedCoach.name}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-800">{selectedCoach.specializations?.[0] || selectedCoach.specialization || selectedCoach.sportName || (isVi ? "Huấn luyện viên" : "Coach")}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800">• {isVi ? "Đang nhận học viên" : "Accepting students"}</span>
                </div>
              </div>
            </div>

            {bookingSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{bookingSuccess}</span>
              </div>
            )}

            {bookingError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{bookingError}</span>
              </div>
            )}

            <form onSubmit={handleBookingSubmit} className="space-y-4">
              {/* Step 1: Chọn ngày */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isVi ? "1. Chọn ngày tập" : "1. Select Date"}
                </label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().slice(0, 10)}
                  value={bookingDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-sans outline-none focus:border-brand-primary"
                />
              </div>

              {/* Step 2: Chọn khung giờ khả dụng (GET /api/sessions/coaches/{coachId}/available-slots) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isVi
                    ? "2. Khung giờ của HLV"
                    : "2. Coach availability"}
                </label>

                {loadingSlots ? (
                  <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
                    <span>
                      {isVi
                        ? "Đang kiểm tra lịch trống..."
                        : "Checking available slots..."}
                    </span>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
                    {isVi
                      ? "Không có ca trống nào trong ngày này. Vui lòng chọn ngày khác."
                      : "No slots available on this date."}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {availableSlots.map((slot, sIdx) => {
                      const timeStr = `${String(slot.startTime || "").slice(0, 5)} - ${String(slot.endTime || "").slice(0, 5)}`
                      const isChosen =
                        selectedSlot?.slotNumber === slot.slotNumber
                      return (
                        <button
                          type="button"
                          key={sIdx}
                          disabled={slot.isAvailable === false}
                          onClick={() => setSelectedSlot(slot)}
                          className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                            slot.isAvailable === false
                              ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                              : isChosen
                                ? "bg-brand-accent-soft border-brand-accent text-brand-accent-dark ring-1 ring-brand-accent font-bold"
                                : "bg-white border-slate-200 text-slate-800 hover:border-slate-300"
                          }`}
                        >
                          <div className="font-mono font-bold">{timeStr}</div>
                          <div className="text-[10px] mt-0.5">
                            {slot.isAvailable === false
                              ? slot.reason || (isVi ? "Đã bận" : "Unavailable")
                              : isVi
                                ? "Khả dụng"
                                : "Available"}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {!apiEnabled && subscriptions.length > 0 ? <>
              {/* Step 3: Chọn phòng tập (GET /api/rooms) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isVi ? "3. Chọn phòng tập *" : "3. Select Room *"}
                </label>
                <select
                  required
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-brand-primary bg-white"
                >
                  <option value="">
                    {isVi ? "-- Chọn phòng tập --" : "-- Select Room --"}
                  </option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || `Phòng ${r.id}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 4: Gói hội viên áp dụng (Subscription ID) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isVi
                    ? "4. Gói hội viên áp dụng *"
                    : "4. Active Subscription *"}
                </label>
                {subscriptions.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                    {isVi
                      ? "Bạn chưa có gói hội viên còn hiệu lực. Vui lòng đăng ký gói trước khi đặt lịch tập riêng."
                      : "No active membership package found. Please purchase a plan first."}
                  </div>
                ) : (
                  <select
                    required
                    value={selectedSubscriptionId}
                    onChange={(e) => setSelectedSubscriptionId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-brand-primary bg-white"
                  >
                    {subscriptions.map((s) => (
                      <option
                        key={s.id || s.subscriptionId}
                        value={s.id || s.subscriptionId}
                      >
                        {s.packageName || `Gói #${s.id || s.subscriptionId}`} (
                        {s.status || "Active"})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              </> : <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4"><p className="text-sm font-bold text-slate-900">{isVi ? "Bạn chưa có gói HLV 1:1 (Advanced) đang hoạt động cho bộ môn này" : "No active Advanced 1:1 coaching entitlement for this sport"}</p><p className="mt-1 text-xs text-slate-600">{isVi ? "Vui lòng đăng ký khóa học Advanced trong Danh mục khóa học." : "You can review availability and register a Primary Coach to get started."}</p><button type="button" onClick={() => { setIsBookingModalOpen(false); handleOpenAdvancedModal(selectedCoach) }} className="mt-3 inline-flex rounded-lg bg-brand-primary px-3 py-2 text-xs font-bold text-white">{isVi ? "Đăng ký khóa học Advanced →" : "Register Advanced course →"}</button></div>}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBookingModalOpen(false)}
                  disabled={submittingBooking}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  {isVi ? "Đóng" : "Close"}
                </button>
                {!apiEnabled && (
                  <button
                    type="submit"
                    disabled={
                      submittingBooking ||
                      !selectedSlot ||
                      !selectedRoomId ||
                      !selectedSubscriptionId
                    }
                    className="inline-flex items-center gap-2 px-5 py-2 bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
                  >
                    {submittingBooking && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    <span>
                      {submittingBooking
                        ? isVi
                          ? "Đang gửi..."
                          : "Booking..."
                        : isVi
                          ? "Xác nhận đặt lịch (Demo)"
                          : "Confirm Booking (Demo)"}
                    </span>
                  </button>
                )}
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
                onClick={() => {
                  setAbsenceModalOpen(false)
                  setAbsenceError("")
                  setAbsenceMsg("")
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Session Info */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">
                  {isVi ? "Huấn luyện viên:" : "Coach:"}
                </span>
                <span className="font-bold text-slate-900">
                  {selectedSessionForAbsence.coachName ||
                    selectedSessionForAbsence.coach?.name ||
                    (isVi ? "Huấn luyện viên" : "Coach")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">
                  {isVi ? "Ngày tập:" : "Date:"}
                </span>
                <span className="font-bold text-slate-900">
                  {selectedSessionForAbsence.sessionDate ||
                    selectedSessionForAbsence.date ||
                    "—"}
                </span>
              </div>
              {(selectedSessionForAbsence.startTime ||
                selectedSessionForAbsence.timeSlot) && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">
                    {isVi ? "Khung giờ:" : "Time:"}
                  </span>
                  <span className="font-mono font-semibold text-slate-800">
                    {selectedSessionForAbsence.startTime &&
                    selectedSessionForAbsence.endTime
                      ? `${String(selectedSessionForAbsence.startTime).slice(0, 5)} - ${String(selectedSessionForAbsence.endTime).slice(0, 5)}`
                      : selectedSessionForAbsence.timeSlot}
                  </span>
                </div>
              )}
              {selectedSessionForAbsence.roomName && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">
                    {isVi ? "Phòng tập:" : "Room:"}
                  </span>
                  <span className="text-slate-800 font-semibold">
                    {selectedSessionForAbsence.roomName}
                  </span>
                </div>
              )}
            </div>

            {/* 12-hour rule info notice */}
            <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                {isVi
                  ? "Quy định: Đơn xin vắng mặt chỉ được chấp nhận khi gửi trước giờ tập tối thiểu 12 tiếng."
                  : "Notice: Absence requests must be submitted at least 12 hours before the session start time."}
              </span>
            </div>

            {/* In-modal alerts */}
            {absenceError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{absenceError}</span>
              </div>
            )}

            {absenceMsg && (
              <div
                role="status"
                className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2"
              >
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
                  onChange={(e) => {
                    setAbsenceReason(e.target.value)
                    if (absenceError) setAbsenceError("")
                  }}
                  placeholder={
                    isVi
                      ? "Ví dụ: Em có việc đột xuất / Bị ốm..."
                      : "Explain your reason..."
                  }
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs outline-none focus:border-brand-primary resize-none"
                  data-testid="absence-reason-input"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setAbsenceModalOpen(false)
                    setAbsenceError("")
                    setAbsenceMsg("")
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 cursor-pointer"
                >
                  {isVi ? "Đóng" : "Close"}
                </button>
                <button
                  type="submit"
                  onClick={handleAbsenceSubmit}
                  disabled={submittingAbsence}
                  className="px-5 py-2 bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-50 text-white text-xs font-bold rounded-lg inline-flex items-center gap-1.5 cursor-pointer"
                  data-testid="absence-submit-button"
                >
                  {submittingAbsence ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{isVi ? "Đang gửi..." : "Submitting..."}</span>
                    </>
                  ) : (
                    <span>{isVi ? "Gửi đơn" : "Submit"}</span>
                  )}
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
