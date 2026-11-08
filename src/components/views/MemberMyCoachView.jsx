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
import { memberPortalApi } from "../../api/memberPortalApi"
import { membershipApi } from "../../api/membershipApi"
import { invoiceApi } from "../../api/invoiceApi"
import { getAuthoritativeProfileId } from "../../utils/memberSafetyHelpers"
import { getErrorMessage } from "../../api/apiErrors"
import { resolveCoachAvatar } from "../../data/publicCoaches"
import { PageHeader } from "../ui/PageHeader"

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

  // Rooms and subscriptions state
  const [rooms, setRooms] = useState([])
  const [subscriptions, setSubscriptions] = useState([])

  // Booked private sessions
  const [privateSessions, setPrivateSessions] = useState([])
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

  // Member ID
  const memberProfileId = useMemo(() => {
    return getAuthoritativeProfileId(currentUser) || currentUser?.id
  }, [currentUser])

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
      } else {
        setPrivateSessions([])
      }
    } catch (err) {
      console.warn("Could not fetch private sessions:", err)
    } finally {
      setLoadingSessions(false)
    }
  }, [apiEnabled, memberProfileId])

  useEffect(() => {
    if (activeTab === "my_sessions") {
      fetchPrivateSessions()
    }
  }, [activeTab, fetchPrivateSessions])

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
    const defaultSub =
      subjects?.find((s) => !Number.isNaN(Number(s.id)))?.id || ""
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
          window.location.assign(paymentUrl)
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
      if (apiEnabled) {
        await memberPortalApi.cancelPrivateSession(sessionId)
      }
      showToast?.(
        isVi
          ? "Đã hủy buổi tập riêng và hoàn lại 1 credit vào gói gốc."
          : "Private session cancelled and 1 credit refunded.",
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
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-7 sm:py-8 font-sans antialiased">
      {/* Header */}
      <PageHeader
        title={isVi ? "Huấn Luyện Viên & Đặt Lịch 1:1" : "Personal Coaches & 1-on-1 Sessions"}
        description={isVi ? "Xem danh sách HLV, khung giờ trống và đặt lịch tập riêng 1:1." : "Browse coaches, view available slots, and book private 1-on-1 sessions."}
        actions={
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab("coaches")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "coaches"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {isVi ? "Danh bạ Huấn Luyện Viên" : "Coaches Directory"}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("my_sessions")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "my_sessions"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {isVi ? "Lịch 1:1 đã đặt" : "My 1-on-1 Bookings"}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("advanced_pt")}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === "advanced_pt"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {isVi ? "Đăng ký HLV Chính (Advanced)" : "Primary Coach Requests"}
            </button>
          </div>
        }
      />

      {/* TAB 1: COACHES DIRECTORY */}
      {activeTab === "coaches" && (
        <section className="space-y-4">
          {/* Search bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
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
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-brand-primary shadow-2xs"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium">
              {isVi
                ? `Hiển thị ${coaches.length} HLV`
                : `Showing ${coaches.length} coaches`}
            </div>
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {coaches.map((c) => (
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
                          <h3 className="font-bold text-slate-900 text-sm truncate">
                            {c.name}
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 shrink-0">
                            {c.status || "Active"}
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

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {c.bio ||
                        (isVi
                          ? "Huấn luyện viên cá nhân chuyên nghiệp tại VIBE Sport Center."
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
                      onClick={() => handleOpenBookingModal(c)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5 text-brand-accent" />
                      <span>
                        {apiEnabled
                          ? isVi
                            ? "Tra cứu ca trống"
                            : "Check Slots"
                          : isVi
                            ? "Đặt lịch 1:1"
                            : "Book 1-on-1"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenAdvancedModal(c)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-accent-soft hover:bg-brand-accent-soft text-brand-accent-dark border border-brand-accent/40 rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
              onClick={fetchPrivateSessions}
              className="text-xs font-bold text-brand-accent-dark hover:underline inline-flex items-center gap-1"
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
                  {Array.isArray(coachWorkSchedule.weeklySlots) &&
                    coachWorkSchedule.weeklySlots.length > 0 && (
                      <div>
                        <span className="font-bold text-slate-700 block mb-1">
                          {isVi
                            ? "Khung ca làm việc trong tuần:"
                            : "Weekly slots:"}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {coachWorkSchedule.weeklySlots.map((slot, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-[11px] text-slate-700"
                            >
                              {slot}
                            </span>
                          ))}
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
      {isBookingModalOpen && selectedCoach && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {apiEnabled
                  ? isVi
                    ? "Tra cứu ca trống Huấn luyện viên (7 ca chuẩn 90p · D04/D12)"
                    : "Coach Available Slots Lookup (D04/D12)"
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
                <strong>Quy định D04 &amp; D12:</strong> Hội viên tra cứu 7 ca
                chuẩn (90 phút/ca) của HLV tại đây. Sau khi trao đổi thống nhất
                lịch, <strong>Huấn luyện viên chính (Primary Coach)</strong>{" "}
                hoặc <strong>Quản lý trung tâm</strong> sẽ là người trực tiếp
                tạo lịch học 1:1 lên hệ thống (tự động trừ 1 credit khi tạo, yêu
                cầu trước ≥ 12h).
              </div>
            )}

            {/* Coach info bar */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
              <img
                src={resolveCoachAvatar(selectedCoach)}
                alt={selectedCoach.name}
                className="w-12 h-12 rounded-lg object-cover object-top"
              />
              <div>
                <div className="font-bold text-slate-900 text-sm">
                  {selectedCoach.name}
                </div>
                <div className="text-xs text-slate-500 font-mono">
                  {selectedCoach.phone}
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
                  {isVi ? "1. Chọn ngày tập *" : "1. Select Date *"}
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
                    ? "2. Chọn khung giờ khả dụng của HLV *"
                    : "2. Select Coach Slot *"}
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
