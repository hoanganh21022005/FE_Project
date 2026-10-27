import React, { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useSCMS } from "../../context/SCMSContext"
import { CLUB_COURSES } from "./MemberAttendanceView"
import { formatDate } from "../../locales/translations"
import { StatusBadge } from "../common/Badge"
import { CancelClassBookingModal } from "../modals/CancelClassBookingModal"
import { ClassFeedbackModal } from "../modals/ClassFeedbackModal"
import { QRCodeSVG } from "qrcode.react"
import { memberPortalApi } from "../../api/memberPortalApi"
import { invoiceApi } from "../../api/invoiceApi"
import { membershipApi } from "../../api/membershipApi"
import { notificationApi } from "../../api/notificationApi"
import { getAuthoritativeProfileId } from "../../utils/memberSafetyHelpers"
import { getErrorMessage } from "../../api/apiErrors"
import {
  Award,
  Calendar,
  AlertTriangle,
  ShieldCheck,
  Flame,
  Clock,
  MapPin,
  Users,
  QrCode,
  ClipboardCheck,
  MessageSquareHeart,
  Star,
  Sparkles,
  ArrowRight,
  Plus,
  CreditCard,
  CheckCircle2,
  X,
  Send,
  RefreshCw,
  Loader2,
  BellRing,
  ExternalLink,
  ChevronRight,
} from "lucide-react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts"

export function MemberDashboard() {
  const navigate = useNavigate()
  const {
    currentUser,
    members,
    packages,
    classes,
    bookings,
    attendance,
    feedbacks,
    checkedInCourseSessions,
    cancelBooking,
    t,
    language,
    apiEnabled,
    showToast,
  } = useSCMS()

  const isVi = language === "vi"

  // Modals state
  const [selectedClassForCancel, setSelectedClassForCancel] = useState(null)
  const [selectedClassForFeedback, setSelectedClassForFeedback] = useState(null)
  const [selectedExistingFeedback, setSelectedExistingFeedback] = useState(null)

  // Quick QR spotlight modal
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrCode, setQrCode] = useState("")
  const [qrSecondsLeft, setQrSecondsLeft] = useState(60)
  const [qrLoading, setQrLoading] = useState(false)

  // Absence request modal state (POST /api/sessions/{sessionId}/absence)
  const [absenceModalOpen, setAbsenceModalOpen] = useState(false)
  const [selectedSessionForAbsence, setSelectedSessionForAbsence] =
    useState(null)
  const [absenceReason, setAbsenceReason] = useState("")
  const [submittingAbsence, setSubmittingAbsence] = useState(false)
  const [absenceSuccessMsg, setAbsenceSuccessMsg] = useState("")
  const [absenceErrorMsg, setAbsenceErrorMsg] = useState("")

  // Pending invoices state
  const [pendingInvoices, setPendingInvoices] = useState([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)

  // Authoritative member ID
  const memberProfileId = useMemo(() => {
    return getAuthoritativeProfileId(currentUser) || currentUser?.id
  }, [currentUser])

  // Safely resolve member display profile
  const member = useMemo(() => {
    return (
      (members || []).find(
        (m) =>
          String(m.id) === String(memberProfileId) ||
          (m.email &&
            currentUser?.email &&
            m.email.toLowerCase() === currentUser.email.toLowerCase()),
      ) ||
      currentUser ||
      members?.[0] || {
        id: "mem-1",
        name: currentUser?.name || "Hội viên",
        code: "MB-1001",
      }
    )
  }, [members, currentUser, memberProfileId])

  // Real backend states when apiEnabled === true
  const [apiEnrollments, setApiEnrollments] = useState([])
  const [apiAttendances, setApiAttendances] = useState([])
  const [apiSessions, setApiSessions] = useState([])
  const [apiSubscriptions, setApiSubscriptions] = useState([])
  const [apiFeedbackMap, setApiFeedbackMap] = useState({})
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0)

  // Fetch pending invoices & real member portal data
  const fetchInvoices = useCallback(async () => {
    if (!apiEnabled) return
    setInvoicesLoading(true)
    try {
      const invs = await invoiceApi.getMemberOwnInvoices()
      if (Array.isArray(invs)) {
        const pending = invs.filter((i) => i.paymentStatus === "pending")
        setPendingInvoices(pending)
      }
    } catch (err) {
      console.warn("Could not load member invoices:", err)
    } finally {
      setInvoicesLoading(false)
    }
  }, [apiEnabled])

  const fetchRealDashboardData = useCallback(async () => {
    if (!apiEnabled) return
    const targetMemberId = memberProfileId || member?.id
    try {
      const [enrollmentsRes, attendancesRes, sessionsRes, subsRes, unreadRes] =
        await Promise.all([
          targetMemberId
            ? memberPortalApi.getMemberClasses(targetMemberId).catch(() => [])
            : Promise.resolve([]),
          targetMemberId
            ? memberPortalApi
                .getMemberAttendances(targetMemberId)
                .catch(() => [])
            : Promise.resolve([]),
          memberPortalApi.getClassSessions().catch(() => []),
          targetMemberId
            ? membershipApi
                .getMemberSubscriptions(targetMemberId)
                .catch(() => [])
            : Promise.resolve([]),
          notificationApi.getMyUnreadCount().catch(() => 0),
        ])

      const safeEnrollments = Array.isArray(enrollmentsRes)
        ? enrollmentsRes
        : []
      setApiEnrollments(safeEnrollments)
      setApiAttendances(Array.isArray(attendancesRes) ? attendancesRes : [])
      setApiSessions(Array.isArray(sessionsRes) ? sessionsRes : [])
      setApiSubscriptions(Array.isArray(subsRes) ? subsRes : [])
      setUnreadNotificationsCount(Number(unreadRes) || 0)

      // Fetch real feedback status for enrolled classes
      const fbMap = {}
      await Promise.all(
        safeEnrollments.map(async (enr) => {
          const cid = enr.classId || enr.id
          if (cid && !Number.isNaN(Number(cid))) {
            try {
              const fb = await memberPortalApi.getMyClassFeedback(cid)
              if (fb) fbMap[String(cid)] = fb
            } catch {
              // Not reviewed yet
            }
          }
        }),
      )
      setApiFeedbackMap(fbMap)
    } catch (err) {
      console.warn("Could not load member dashboard API data:", err)
    }
  }, [apiEnabled, memberProfileId, member?.id])

  useEffect(() => {
    fetchInvoices()
    fetchRealDashboardData()
  }, [fetchInvoices, fetchRealDashboardData])

  // QR Code generator logic
  const loadQrCode = useCallback(async () => {
    setQrLoading(true)
    try {
      if (apiEnabled) {
        const res = await memberPortalApi.getMemberCheckinCode()
        if (res?.payload) {
          setQrCode(res.payload)
          setQrSecondsLeft(res.validitySeconds || 60)
        } else if (res?.code) {
          setQrCode(res.code)
          setQrSecondsLeft(60)
        }
      } else {
        // Mock QR
        setQrCode(
          `SCMS-MEMBER-${member.code || member.id}-${Date.now().toString().slice(-4)}`,
        )
        setQrSecondsLeft(60)
      }
    } catch (err) {
      console.warn("Could not load checkin code:", err)
      setQrCode(`SCMS-${member.code || "MB-1001"}`)
      setQrSecondsLeft(60)
    } finally {
      setQrLoading(false)
    }
  }, [apiEnabled, member])

  // Countdown timer for QR code
  useEffect(() => {
    if (!showQrModal || qrSecondsLeft <= 0) return
    const timer = setInterval(() => {
      setQrSecondsLeft((prev) => {
        if (prev <= 1) {
          loadQrCode()
          return 60
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [showQrModal, qrSecondsLeft, loadQrCode])

  const handleOpenQrModal = () => {
    setShowQrModal(true)
    loadQrCode()
  }

  // Absence request submission (POST /api/sessions/{sessionId}/absence)
  const handleAbsenceSubmit = async (e) => {
    e.preventDefault()
    if (!selectedSessionForAbsence || !absenceReason.trim()) return

    setSubmittingAbsence(true)
    setAbsenceErrorMsg("")
    setAbsenceSuccessMsg("")

    try {
      const sessionId =
        selectedSessionForAbsence.sessionId || selectedSessionForAbsence.id
      if (apiEnabled && sessionId) {
        await memberPortalApi.requestAbsence(sessionId, absenceReason.trim())
      }
      setAbsenceSuccessMsg(
        isVi
          ? "Đã gửi lý do xin vắng mặt thành công tới Huấn luyện viên!"
          : "Absence request submitted successfully to your coach!",
      )
      setTimeout(() => {
        setAbsenceModalOpen(false)
        setSelectedSessionForAbsence(null)
        setAbsenceReason("")
        setAbsenceSuccessMsg("")
      }, 2000)
    } catch (err) {
      setAbsenceErrorMsg(
        getErrorMessage(
          err,
          isVi
            ? "Không thể gửi đơn xin vắng mặt."
            : "Could not submit absence request.",
        ),
      )
    } finally {
      setSubmittingAbsence(false)
    }
  }

  // Confirmed bookings / enrollments for member (100% real API when apiEnabled)
  const myBookings = useMemo(() => {
    if (apiEnabled) {
      if (apiEnrollments.length > 0) {
        return apiEnrollments.map((enr) => {
          const cid = enr.classId || enr.id
          const matchedClass = (classes || []).find(
            (c) => String(c.id) === String(cid),
          )
          const matchedSession = (apiSessions || []).find(
            (s) => String(s.classId || s.trainingClassId) === String(cid),
          )
          return {
            id: enr.enrollmentId || enr.id || `enr-${cid}`,
            classId: cid,
            sessionId: matchedSession?.sessionId || matchedSession?.id || cid,
            className:
              enr.className ||
              matchedClass?.nameVi ||
              matchedClass?.name ||
              `Lớp học #${cid}`,
            bookingDate:
              matchedSession?.sessionDate ||
              matchedSession?.date ||
              enr.startDate ||
              enr.enrolledAt ||
              new Date().toISOString().slice(0, 10),
            status: "confirmed",
          }
        })
      }
      return (bookings || []).filter(
        (b) =>
          b &&
          (String(b.memberId) === String(member?.id) ||
            String(b.memberId) === String(currentUser?.id)) &&
          b.status === "confirmed",
      )
    }
    return (bookings || []).filter(
      (b) =>
        b &&
        (String(b.memberId) === String(member?.id) ||
          String(b.memberId) === String(currentUser?.id)) &&
        b.status === "confirmed",
    )
  }, [
    apiEnabled,
    apiEnrollments,
    apiSessions,
    classes,
    bookings,
    member,
    currentUser,
  ])

  // Attendance records for member (100% real API when apiEnabled)
  const myAttendance = useMemo(() => {
    if (apiEnabled) {
      return apiAttendances.map((a) => {
        const rawStatus = String(
          a.status || a.attendanceStatus || "present",
        ).toLowerCase()
        return {
          ...a,
          id: a.attendanceId || a.id,
          classId: a.classId || a.trainingClassId || a.sessionId,
          status:
            rawStatus === "absent"
              ? "absent"
              : rawStatus === "late"
                ? "late"
                : "present",
          date: String(
            a.checkInTime || a.sessionDate || a.createdAt || "",
          ).slice(0, 10),
        }
      })
    }
    return (attendance || []).filter(
      (a) =>
        a &&
        (String(a.memberId) === String(member?.id) ||
          String(a.memberId) === String(currentUser?.id)),
    )
  }, [apiEnabled, apiAttendances, attendance, member, currentUser])

  // Feedbacks submitted by member
  const myFeedbacks = useMemo(() => {
    if (apiEnabled) {
      return Object.entries(apiFeedbackMap).map(([cid, fb]) => ({
        ...fb,
        id: fb.feedbackId || fb.id || `fb-${cid}`,
        classId: cid,
        rating: fb.classRating || fb.coachRating || fb.rating || 5,
      }))
    }
    return (feedbacks || []).filter(
      (f) =>
        f &&
        (String(f.memberId) === String(member?.id) ||
          String(f.memberId) === String(currentUser?.id)),
    )
  }, [apiEnabled, apiFeedbackMap, feedbacks, member, currentUser])

  // Unified attended & pending feedback count (Zero fake CLUB_COURSES when apiEnabled === true)
  const { attendedCount, pendingFeedbackSessions } = useMemo(() => {
    if (apiEnabled) {
      const attendedRecords = myAttendance.filter(
        (a) => a.status === "present" || a.status === "late",
      )
      const pending = apiEnrollments.filter((enr) => {
        const cid = String(enr.classId || enr.id)
        return !apiFeedbackMap[cid]
      })
      return {
        attendedCount: attendedRecords.length,
        pendingFeedbackSessions: pending,
      }
    }

    const reviewsList = feedbacks || []
    const allAttended = []

    if (CLUB_COURSES?.badminton?.sessions?.[0]) {
      const s = CLUB_COURSES.badminton.sessions[0]
      allAttended.push({
        id: `badminton-session-${s.num}`,
        className: CLUB_COURSES.badminton.name,
        date: s.date,
        coach: s.coach,
      })
    }
    if (CLUB_COURSES?.pickleball?.sessions?.[0]) {
      const s = CLUB_COURSES.pickleball.sessions[0]
      allAttended.push({
        id: `pickleball-session-${s.num}`,
        className: CLUB_COURSES.pickleball.name,
        date: s.date,
        coach: s.coach,
      })
    }
    Object.values(CLUB_COURSES || {}).forEach((course) => {
      ;(course.sessions || []).forEach((s) => {
        const sessionKey = `${course.id}-session-${s.num}`
        if (
          checkedInCourseSessions?.[sessionKey] &&
          !allAttended.some((a) => a.id === sessionKey)
        ) {
          allAttended.push({
            id: sessionKey,
            className: course.name,
            date: s.date,
            coach: s.coach,
          })
        }
      })
    })

    const pending = allAttended.filter((session) => {
      const existingFb = reviewsList.find(
        (f) =>
          f.classId === session.id ||
          (f.className === session.className && f.date === session.date) ||
          (f.date === session.date &&
            f.coachName?.includes(
              session.coach.replace(/^HLV\s+/, "").split(" ")[0],
            )),
      )
      return !existingFb
    })

    return {
      attendedCount: allAttended.length,
      pendingFeedbackSessions: pending,
    }
  }, [
    apiEnabled,
    myAttendance,
    apiEnrollments,
    apiFeedbackMap,
    feedbacks,
    checkedInCourseSessions,
  ])

  // Active subscription from real backend when apiEnabled
  const activeSubscription = useMemo(() => {
    if (!apiEnabled || apiSubscriptions.length === 0) return null
    return (
      apiSubscriptions.find(
        (s) =>
          String(s.status || "").toLowerCase() === "active" ||
          String(s.status || "").toLowerCase() === "grace_period",
      ) || apiSubscriptions[0]
    )
  }, [apiEnabled, apiSubscriptions])

  // Chart data: real attendance frequency per week when apiEnabled, or offline demo trend
  const fitnessTrendData = useMemo(() => {
    if (apiEnabled) {
      const now = Date.now()
      const weekMs = 7 * 24 * 60 * 60 * 1000
      return [3, 2, 1, 0].map((weeksAgo, idx) => {
        const startMs = now - (weeksAgo + 1) * weekMs
        const endMs = now - weeksAgo * weekMs
        const weekAttended = myAttendance.filter((a) => {
          const t = a.date ? new Date(a.date).getTime() : NaN
          return !Number.isNaN(t) && t >= startMs && t <= endMs
        }).length
        return {
          week: isVi ? `Tuần ${idx + 1}` : `W${idx + 1}`,
          sessions: weekAttended,
          enrolled: myBookings.length,
        }
      })
    }
    return [
      { week: isVi ? "Tuần 1" : "W1", calories: 1850, weight: 68.5 },
      { week: isVi ? "Tuần 2" : "W2", calories: 2200, weight: 68.0 },
      { week: isVi ? "Tuần 3" : "W3", calories: 2450, weight: 67.4 },
      { week: isVi ? "Tuần 4" : "W4", calories: 2900, weight: 66.8 },
    ]
  }, [apiEnabled, myAttendance, myBookings.length, isVi])

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6 font-sans antialiased">
      {/* 1. Header Welcome Bar */}
      <div className="pb-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-red-700 font-bold bg-red-50 border border-red-200/60 px-2 py-0.5 rounded-sm">
            {isVi
              ? "HỘI VIÊN CHÍNH THỨC · VIBE SPORT"
              : "VERIFIED MEMBER · VIBE SPORT"}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight mt-1.5">
            {isVi ? `Xin chào, ${member.name}!` : `Welcome, ${member.name}!`}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isVi ? "Mã hội viên:" : "Member Code:"}{" "}
            <strong className="font-mono text-slate-900 font-bold tabular-nums">
              {member.code || "MB-1001"}
            </strong>{" "}
            &bull; {member.email}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge
            type="membership"
            status={member.membershipStatus || "active"}
          />
          <button
            type="button"
            onClick={handleOpenQrModal}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <QrCode className="w-4 h-4 text-red-400" />
            <span>{isVi ? "Mã QR Check-in" : "QR Check-in"}</span>
          </button>
        </div>
      </div>

      {/* 2. Urgent Pending Invoices Alert Banner */}
      {pendingInvoices.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-950 text-sm">
                {isVi
                  ? `Bạn có ${pendingInvoices.length} hóa đơn đang chờ thanh toán`
                  : `You have ${pendingInvoices.length} invoice(s) awaiting payment`}
              </h4>
              <p className="text-xs text-amber-900/90 mt-0.5">
                {isVi
                  ? "Vui lòng hoàn tất thanh toán trực tuyến qua VNPay QR hoặc tại quầy Lễ tân để kích hoạt đầy đủ quyền lợi gói."
                  : "Please complete payment via VNPay QR or at Reception Desk to keep your benefits active."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/member/invoices")}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded-lg shrink-0 transition-colors shadow-xs cursor-pointer"
          >
            <span>{isVi ? "Thanh toán ngay" : "Pay now"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. Quick Actions Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={handleOpenQrModal}
          className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-red-400 hover:shadow-xs transition-all text-left cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-red-50 text-red-700 flex items-center justify-center shrink-0 group-hover:bg-red-600 group-hover:text-white transition-colors">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">
              {isVi ? "Quét mã Check-in" : "QR Check-in"}
            </div>
            <div className="text-[11px] text-slate-500">
              {isVi ? "Điểm danh tại quầy" : "Scan at front desk"}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate("/member/my-coach")}
          className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-blue-400 hover:shadow-xs transition-all text-left cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">
              {isVi ? "Huấn luyện viên" : "My Coach (PT)"}
            </div>
            <div className="text-[11px] text-slate-500">
              {isVi ? "Đặt lịch tập 1:1" : "Book 1-on-1 private"}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate("/member/invoices")}
          className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-emerald-400 hover:shadow-xs transition-all text-left cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">
              {isVi ? "Hóa đơn & VNPay" : "Billing & Invoices"}
            </div>
            <div className="text-[11px] text-slate-500">
              {isVi ? "Lịch sử thanh toán" : "Review receipts"}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate("/member/catalog")}
          className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-amber-400 hover:shadow-xs transition-all text-left cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">
              {isVi ? "Đăng ký khóa học" : "Course Catalog"}
            </div>
            <div className="text-[11px] text-slate-500">
              {isVi ? "Khám phá lớp mới" : "Find new classes"}
            </div>
          </div>
        </button>
      </div>

      {/* 4. Three Core Workflow Summary Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Ghi danh */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {isVi ? "1. Khóa Học & Lịch Tập" : "1. Enrolled Classes"}
              </div>
              <div className="text-3xl font-black text-slate-900 font-mono mt-1.5 tabular-nums">
                {myBookings.length}
                <span className="text-xs font-normal text-slate-500 ml-2 font-sans">
                  {isVi ? "lớp đang tham gia" : "classes enrolled"}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white shadow-2xs border border-slate-200 flex items-center justify-center text-slate-900">
              <Calendar className="w-5 h-5 text-red-700" />
            </div>
          </div>
          <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate("/member/schedule")}
              className="text-xs font-bold text-slate-900 hover:text-red-700 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>{isVi ? "Xem lịch học chi tiết" : "View Schedule"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 2. Điểm danh */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {isVi ? "2. Điểm Danh Chuyên Cần" : "2. Attendance & QR"}
              </div>
              <div className="text-3xl font-black text-slate-900 font-mono mt-1.5 tabular-nums">
                {attendedCount}
                <span className="text-xs font-normal text-slate-500 ml-2 font-sans">
                  {isVi ? "buổi đã có mặt" : "sessions attended"}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white shadow-2xs border border-slate-200 flex items-center justify-center text-slate-900">
              <QrCode className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate("/member/attendance")}
              className="text-xs font-bold text-slate-900 hover:text-red-700 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>{isVi ? "Lịch sử điểm danh" : "Attendance History"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 3. Feedback */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {isVi ? "3. Đánh Giá Buổi Học" : "3. Class Feedback"}
              </div>
              <div className="text-3xl font-black text-red-700 font-mono mt-1.5 tabular-nums">
                {pendingFeedbackSessions.length}
                <span className="text-xs font-normal text-slate-500 ml-2 font-sans">
                  {isVi ? "buổi chờ đánh giá" : "pending reviews"}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white shadow-2xs border border-slate-200 flex items-center justify-center text-red-700">
              <MessageSquareHeart className="w-5 h-5" />
            </div>
          </div>
          <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate("/member/feedback")}
              className="text-xs font-bold text-red-700 hover:underline flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>{isVi ? "Gửi đánh giá ngay" : "Submit Feedback"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Package Privilege Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <Award className="w-4 h-4 text-red-700" />
            <span>
              {isVi ? "Gói Dịch Vụ Đang Sử Dụng" : "Active Membership Package"}
            </span>
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">
            {activeSubscription?.packageName ||
              member.currentPackageName ||
              (apiEnabled
                ? isVi
                  ? "Chưa kích hoạt gói tập"
                  : "No Active Package"
                : isVi
                  ? "Gói Hội Viên VIBE Sport"
                  : "VIBE Sport Membership")}
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {activeSubscription?.startDate && activeSubscription?.endDate
              ? isVi
                ? `Thời hạn sử dụng: ${String(activeSubscription.startDate).slice(0, 10)} → ${String(activeSubscription.endDate).slice(0, 10)}`
                : `Valid period: ${String(activeSubscription.startDate).slice(0, 10)} → ${String(activeSubscription.endDate).slice(0, 10)}`
              : isVi
                ? "Quyền lợi tham gia các lớp nhóm và quản lý lịch tập luyện trực tuyến trên hệ thống VIBE Sport."
                : "Access to group training sessions and online schedule management on VIBE Sport."}
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="text-slate-400">
                {isVi ? "HLV Phụ Trách:" : "Coach:"}
              </span>
              <strong className="text-slate-900">
                {member.primaryCoachName ||
                  (apiEnabled
                    ? isVi
                      ? "Chưa phân công"
                      : "Unassigned"
                    : "Nguyễn Văn Hùng")}
              </strong>
            </div>
            {unreadNotificationsCount > 0 && (
              <button
                type="button"
                onClick={() => navigate("/member/notifications")}
                className="text-xs font-bold text-amber-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <BellRing className="w-3.5 h-3.5" />
                <span>
                  {isVi
                    ? `${unreadNotificationsCount} thông báo chưa đọc`
                    : `${unreadNotificationsCount} unread alert(s)`}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate("/member/my-membership")}
              className="text-xs font-bold text-red-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>
                {isVi ? "Chi tiết gói & gia hạn" : "View details & renew"}
              </span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Status card */}
        <div>
          {member.membershipStatus === "grace_period" ? (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3 text-amber-950 text-xs">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">
                  {isVi
                    ? "Gói đang trong Grace Period (72h gia hạn)"
                    : "Grace Period (72h)"}
                </p>
                <p className="mt-1 leading-relaxed text-amber-900">
                  {isVi
                    ? "Vui lòng hoàn tất thanh toán tại quầy Lễ tân hoặc chuyển khoản VNPay để tránh bị tự động khóa quyền đặt lịch lớp học."
                    : "Please complete payment via VNPay QR or at front desk to keep booking permissions."}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50/70 rounded-xl border border-emerald-200/80 flex items-start gap-3 text-emerald-950 text-xs">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-emerald-900">
                  {isVi
                    ? "Tài Khoản Đang Hoạt Động Bình Thường"
                    : "Account Active"}
                </p>
                <p className="mt-1 leading-relaxed text-emerald-800">
                  {isVi
                    ? "Bạn có thể tự do đăng ký các lớp Boxing, Yoga, HIIT, Pickleball trong Danh mục Khóa Học."
                    : "You can freely book all group disciplines in the Course Catalog."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. Attendance & Training Activity Chart */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-red-700 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              {apiEnabled
                ? isVi
                  ? "Thống Kê Tần Suất Điểm Danh & Lớp Học Thực Tế"
                  : "Real Attendance & Enrolled Class Frequency"
                : isVi
                  ? "Thống Kê Tiến Độ Tập Luyện & Calo Tiêu Hao"
                  : "Fitness Progress & Calorie Burn"}
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono font-medium">
            4 {isVi ? "tuần gần nhất" : "weeks"}
          </span>
        </div>

        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            {apiEnabled ? (
              <LineChart
                data={fitnessTrendData}
                margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#F1F5F9"
                />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#64748B" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "8px",
                    border: "1px solid #E2E8F0",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                />
                <Line
                  type="monotone"
                  dataKey="sessions"
                  name={isVi ? "Số buổi đã điểm danh" : "Attended Sessions"}
                  stroke="#059669"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="enrolled"
                  name={isVi ? "Số lớp đang theo học" : "Enrolled Classes"}
                  stroke="#0F172A"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            ) : (
              <LineChart
                data={fitnessTrendData}
                margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#F1F5F9"
                />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: "#64748B" }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[65, 70]}
                  tick={{ fontSize: 11, fill: "#64748B" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "8px",
                    border: "1px solid #E2E8F0",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="calories"
                  name={isVi ? "Calo tiêu hao (kcal)" : "Calories (kcal)"}
                  stroke="#D97706"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="weight"
                  name={isVi ? "Cân nặng (kg)" : "Weight (kg)"}
                  stroke="#0F172A"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* 7. My Booked Classes with Absence & Cancel Actions */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-900 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              {isVi ? "Lịch Học Sắp Tới Của Bạn" : "Upcoming Booked Sessions"}
            </h3>
            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-sm">
              {myBookings.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => navigate("/member/catalog")}
            className="text-xs font-bold text-red-700 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isVi ? "Đăng ký thêm lớp" : "Enroll more"}</span>
          </button>
        </div>

        {myBookings.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
              <Calendar className="w-6 h-6" />
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {isVi
                ? "Bạn chưa đăng ký lịch học nào."
                : "You have no scheduled sessions yet."}
            </p>
            <button
              type="button"
              onClick={() => navigate("/member/catalog")}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>
                {isVi ? "Xem Danh Mục Khóa Học" : "Browse Course Catalog"}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {myBookings.map((bk) => {
              const cls = (classes || []).find(
                (c) => String(c.id) === String(bk.classId),
              )
              const att = myAttendance.find(
                (a) => String(a.classId) === String(bk.classId),
              )
              const fb = myFeedbacks.find(
                (f) => String(f.classId) === String(bk.classId),
              )

              const sessionDate =
                cls?.date ||
                cls?.startDate ||
                String(bk.bookingDate || "").slice(0, 10)
              const startTime = cls?.startTime || "06:00"
              const sessionStart = new Date(`${sessionDate}T${startTime}:00`)
              const now = new Date()
              const isFutureSession = sessionStart.getTime() > now.getTime()

              const isAttended =
                !isFutureSession &&
                att &&
                (att.status === "present" || att.status === "late")
              const canFeedback = isAttended && !fb

              return (
                <div
                  key={bk.id}
                  className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-sm">
                        {cls?.category || (isVi ? "Bộ môn" : "Discipline")}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">
                        {bk.className || cls?.nameVi || cls?.name}
                      </h4>
                      {!isFutureSession && att ? (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-sm ${
                            att.status === "present"
                              ? "bg-emerald-100 text-emerald-800"
                              : att.status === "late"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {att.status === "present"
                            ? isVi
                              ? "Đã có mặt"
                              : "Present"
                            : att.status === "late"
                              ? isVi
                                ? "Đi trễ"
                                : "Late"
                              : isVi
                                ? "Vắng mặt"
                                : "Absent"}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-slate-100 text-slate-600">
                          {isVi ? "Sắp diễn ra" : "Upcoming"}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <div className="flex items-center gap-1 font-mono tabular-nums">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {cls?.date ||
                            String(bk.bookingDate || "").slice(0, 10)}{" "}
                          &bull; {cls?.startTime || "06:00"} -{" "}
                          {cls?.endTime || "07:30"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {cls?.roomVi || cls?.room || "Phòng tập VIBE Sport"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>HLV: {cls?.coachName || "Nguyễn Văn Hùng"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 self-end md:self-auto">
                    {/* Quick review button if attended */}
                    {canFeedback && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedExistingFeedback(null)
                          setSelectedClassForFeedback(
                            cls || { id: bk.classId, nameVi: bk.className },
                          )
                        }}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>{isVi ? "Đánh giá ngay" : "Review"}</span>
                      </button>
                    )}

                    {fb && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedExistingFeedback(fb)
                          setSelectedClassForFeedback(
                            cls || { id: bk.classId, nameVi: bk.className },
                          )
                        }}
                        className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                        <span>Đã đánh giá ({fb.rating}★)</span>
                      </button>
                    )}

                    {/* Report Absence API (POST /api/sessions/{sessionId}/absence) */}
                    {isFutureSession && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSessionForAbsence({
                            id: bk.sessionId || bk.id,
                            className: bk.className || cls?.nameVi || cls?.name,
                            date:
                              cls?.date ||
                              String(bk.bookingDate || "").slice(0, 10),
                            time: `${cls?.startTime || "06:00"} - ${cls?.endTime || "07:30"}`,
                            coach: cls?.coachName || "Huấn luyện viên",
                          })
                          setAbsenceModalOpen(true)
                        }}
                        className="text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        {isVi ? "Xin vắng mặt" : "Report absence"}
                      </button>
                    )}

                    {/* Safe Cancel booking with confirmation modal */}
                    {isFutureSession && (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedClassForCancel({
                            classItem: cls || {
                              id: bk.classId,
                              nameVi: bk.className,
                            },
                            bookingItem: bk,
                          })
                        }
                        className="text-xs font-medium text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        {t("cancelBooking")}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* QR Code Spotlight Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-center space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-xs font-bold uppercase tracking-wider text-red-700">
                {isVi ? "MÃ CHECK-IN TẠI QUẦY" : "CHECK-IN QR CODE"}
              </span>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              {isVi
                ? "Đưa mã QR này trước camera tại quầy lễ tân để ghi nhận lượt tập."
                : "Present this QR code to the scanner at the desk to check in."}
            </p>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center">
              {qrLoading ? (
                <div className="py-12 flex flex-col items-center gap-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-red-600" />
                  <span className="text-xs">
                    {isVi ? "Đang tạo mã..." : "Generating..."}
                  </span>
                </div>
              ) : (
                <QRCodeSVG
                  value={qrCode || "SCMS-MEMBER"}
                  size={200}
                  level="M"
                />
              )}
            </div>

            <div className="space-y-1">
              <div className="font-mono text-2xl font-black tracking-widest text-slate-900">
                {qrCode || member.code}
              </div>
              <div className="text-xs text-slate-500">
                {isVi ? "Mã tự động làm mới sau:" : "Refreshes in:"}{" "}
                <strong className="text-red-700 font-mono font-bold">
                  {qrSecondsLeft}s
                </strong>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={loadQrCode}
                disabled={qrLoading}
                className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors w-full justify-center"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${qrLoading ? "animate-spin" : ""}`}
                />
                <span>{isVi ? "Làm mới mã ngay" : "Refresh QR now"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Absence Request Modal (POST /api/sessions/{sessionId}/absence) */}
      {absenceModalOpen && selectedSessionForAbsence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {isVi ? "Báo xin vắng mặt buổi học" : "Request Class Absence"}
              </h3>
              <button
                type="button"
                onClick={() => setAbsenceModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <div className="font-bold text-slate-900">
                {selectedSessionForAbsence.className}
              </div>
              <div className="text-slate-500">
                {selectedSessionForAbsence.date} &bull;{" "}
                {selectedSessionForAbsence.time}
              </div>
              <div className="text-slate-500">
                HLV: {selectedSessionForAbsence.coach}
              </div>
            </div>

            {absenceSuccessMsg && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{absenceSuccessMsg}</span>
              </div>
            )}

            {absenceErrorMsg && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{absenceErrorMsg}</span>
              </div>
            )}

            <form onSubmit={handleAbsenceSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isVi
                    ? "Lý do xin vắng mặt (Gửi tới HLV & Trung tâm) *"
                    : "Absence Reason *"}
                </label>
                <textarea
                  required
                  rows={3}
                  value={absenceReason}
                  onChange={(e) => setAbsenceReason(e.target.value)}
                  placeholder={
                    isVi
                      ? "Ví dụ: Em có việc đột xuất ở cơ quan / Bị sốt nên xin phép nghỉ buổi này..."
                      : "Please explain your reason for absence..."
                  }
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-red-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAbsenceModalOpen(false)}
                  disabled={submittingAbsence}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50"
                >
                  {isVi ? "Đóng" : "Close"}
                </button>
                <button
                  type="submit"
                  disabled={submittingAbsence || !absenceReason.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  {submittingAbsence && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>
                    {submittingAbsence
                      ? isVi
                        ? "Đang gửi..."
                        : "Submitting..."
                      : isVi
                        ? "Xác nhận xin nghỉ"
                        : "Submit Request"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {selectedClassForCancel && (
        <CancelClassBookingModal
          isOpen={Boolean(selectedClassForCancel)}
          onClose={() => setSelectedClassForCancel(null)}
          classItem={selectedClassForCancel.classItem}
          bookingItem={selectedClassForCancel.bookingItem}
          onConfirmCancel={async (bookingIdOrClassId) => {
            await cancelBooking(bookingIdOrClassId, member?.id)
            setSelectedClassForCancel(null)
          }}
          language={language}
        />
      )}

      {/* Class Feedback Modal */}
      {selectedClassForFeedback && (
        <ClassFeedbackModal
          isOpen={Boolean(selectedClassForFeedback)}
          onClose={() => {
            setSelectedClassForFeedback(null)
            setSelectedExistingFeedback(null)
          }}
          classItem={selectedClassForFeedback}
          existingFeedback={selectedExistingFeedback}
        />
      )}
    </div>
  )
}

export default MemberDashboard
