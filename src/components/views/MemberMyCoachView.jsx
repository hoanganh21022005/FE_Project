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
import { getAuthoritativeProfileId } from "../../utils/memberSafetyHelpers"
import { getErrorMessage } from "../../api/apiErrors"

export function MemberMyCoachView() {
  const { language, currentUser, apiEnabled, showToast } = useSCMS()
  const isVi = language === "vi"

  // Navigation tab: 'coaches' | 'my_sessions'
  const [activeTab, setActiveTab] = useState("coaches")

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
        setCoaches(Array.isArray(list) ? list : [])
      } else {
        // Mock fallback
        setCoaches([
          {
            id: 1,
            name: "Nguyễn Văn Hùng",
            email: "hung.coach@scms.com",
            phone: "0912 345 678",
            bio: "Hơn 7 năm kinh nghiệm huấn luyện thể chất chuyên sâu, từng đạt HCB Cúp Boxing toàn quốc.",
            specializations: [
              "Boxing & Kickfit",
              "Strength Training",
              "Cardio Conditioning",
            ],
            status: "ACTIVE",
            avatarUrl:
              "https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=300&auto=format&fit=crop&q=80",
          },
          {
            id: 2,
            name: "Lê Thị Mai",
            email: "mai.coach@scms.com",
            phone: "0987 654 321",
            bio: "Chuyên gia Yoga & Pilates phục hồi chức năng, chứng chỉ Quốc tế RYT-500.",
            specializations: [
              "Yoga Flow",
              "Pilates Reformer",
              "Rehabilitation",
            ],
            status: "ACTIVE",
            avatarUrl:
              "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80",
          },
          {
            id: 3,
            name: "Đặng Tuấn Anh",
            email: "tuananh.coach@scms.com",
            phone: "0903 112 233",
            bio: "HLV chuyên sâu Cầu lông & Thể lực sức bền, cựu VĐV đội tuyển trẻ.",
            specializations: ["Badminton", "Pickleball", "Agility & Speed"],
            status: "ACTIVE",
            avatarUrl:
              "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
          },
        ])
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
      setRooms([
        { id: 1, name: "Phòng PT 1 - Boxing & Kickfit" },
        { id: 2, name: "Phòng PT 2 - Functional Gym" },
        { id: 3, name: "Phòng Yoga Studio 1" },
      ])
      setSubscriptions([
        { id: 101, packageName: "Gói Hội Viên VIBE VIP (Active)" },
      ])
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
          const valid = (Array.isArray(subs) ? subs : []).filter(
            (s) => s.status === "active" || s.status === "grace_period",
          )
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
            s.isPrivate === true ||
            String(s.type || "").toUpperCase() === "PRIVATE",
        )
        setPrivateSessions(privates)
      } else {
        setPrivateSessions([
          {
            id: 901,
            coachId: 1,
            coachName: "Nguyễn Văn Hùng",
            sessionDate: "2026-10-26",
            startTime: "08:00",
            endTime: "09:00",
            roomName: "Phòng PT 1 - Boxing",
            status: "scheduled",
          },
        ])
      }
    } catch (err) {
      console.warn("Could not fetch private sessions:", err)
    } finally {
      setLoadingSessions(false)
    }
  }, [apiEnabled])

  useEffect(() => {
    if (activeTab === "my_sessions") {
      fetchPrivateSessions()
    }
  }, [activeTab, fetchPrivateSessions])

  // 4. Fetch Available Slots when Coach & Date are chosen (GET /api/sessions/coaches/{coachId}/available-slots)
  const fetchSlots = useCallback(
    async (coachId, date) => {
      if (!coachId || !date) return
      setLoadingSlots(true)
      setSelectedSlot(null)
      try {
        if (apiEnabled) {
          const slots = await memberPortalApi.getCoachAvailableSlots(
            coachId,
            date,
          )
          setAvailableSlots(Array.isArray(slots) ? slots : [])
        } else {
          // Mock slots
          setAvailableSlots([
            {
              slotNumber: 1,
              slotName: "Ca 1",
              startTime: "07:00:00",
              endTime: "08:30:00",
              isAvailable: true,
            },
            {
              slotNumber: 2,
              slotName: "Ca 2",
              startTime: "08:45:00",
              endTime: "10:15:00",
              isAvailable: false,
              reason: "HLV bận ca lớp nhóm",
            },
            {
              slotNumber: 3,
              slotName: "Ca 3",
              startTime: "14:00:00",
              endTime: "15:30:00",
              isAvailable: true,
            },
            {
              slotNumber: 4,
              slotName: "Ca 4",
              startTime: "16:00:00",
              endTime: "17:30:00",
              isAvailable: true,
            },
            {
              slotNumber: 5,
              slotName: "Ca 5",
              startTime: "18:00:00",
              endTime: "19:30:00",
              isAvailable: false,
              reason: "Đã có hội viên đặt",
            },
          ])
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
          ? "Bạn có chắc chắn muốn hủy buổi tập riêng này không?"
          : "Are you sure you want to cancel this private session?",
      )
    )
      return
    try {
      if (apiEnabled) {
        await memberPortalApi.cancelPrivateSession(sessionId)
      }
      showToast?.(
        isVi
          ? "Đã hủy buổi tập riêng thành công."
          : "Private session cancelled.",
      )
      fetchPrivateSessions()
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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-red-700">
            VIBE SPORT · MEMBER
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">
            {isVi
              ? "Huấn Luyện Viên & Đặt Lịch 1:1"
              : "Personal Coaches & 1-on-1 Sessions"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isVi
              ? "Xem danh sách HLV, khung giờ trống và đặt lịch tập riêng 1:1."
              : "Browse coaches, view available slots, and book private 1-on-1 sessions."}
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
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
        </div>
      </header>

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
                placeholder={
                  isVi
                    ? "Tìm theo tên HLV, chuyên môn..."
                    : "Search coach name, specialty..."
                }
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-red-500 shadow-2xs"
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
              <Loader2 className="w-6 h-6 animate-spin text-red-600" />
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
                        src={
                          c.avatarUrl ||
                          "https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=300&auto=format&fit=crop&q=80"
                        }
                        alt={c.name}
                        className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs"
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
                      {(c.specializations || ["Fitness", "Conditioning"]).map(
                        (spec, sIdx) => (
                          <span
                            key={sIdx}
                            className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold"
                          >
                            {spec}
                          </span>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleOpenBookingModal(c)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5 text-red-400" />
                      <span>{isVi ? "Đặt lịch tập 1:1" : "Book 1-on-1"}</span>
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
              className="text-xs font-bold text-red-700 hover:underline inline-flex items-center gap-1"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{isVi ? "Tải lại" : "Refresh"}</span>
            </button>
          </div>

          {loadingSessions ? (
            <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-red-600" />
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

      {/* MODAL 1: BOOK PRIVATE 1-ON-1 SESSION (POST /api/sessions/book-private) */}
      {isBookingModalOpen && selectedCoach && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {isVi
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

            {/* Coach info bar */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
              <img
                src={
                  selectedCoach.avatarUrl ||
                  "https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=300"
                }
                alt={selectedCoach.name}
                className="w-12 h-12 rounded-lg object-cover"
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
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-sans outline-none focus:border-red-500"
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
                    <Loader2 className="w-4 h-4 animate-spin text-red-600" />
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
                                ? "bg-red-50 border-red-600 text-red-900 ring-1 ring-red-500 font-bold"
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
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-red-500 bg-white"
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
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-red-500 bg-white"
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
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50"
                >
                  {isVi ? "Hủy" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={
                    submittingBooking ||
                    !selectedSlot ||
                    !selectedRoomId ||
                    !selectedSubscriptionId
                  }
                  className="inline-flex items-center gap-2 px-5 py-2 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
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
                        ? "Xác nhận đặt lịch"
                        : "Confirm Booking"}
                  </span>
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
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs outline-none focus:border-red-500 resize-none"
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
                  className="px-5 py-2 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
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
