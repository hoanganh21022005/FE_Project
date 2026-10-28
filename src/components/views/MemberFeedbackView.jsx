import React, { useState, useMemo, useEffect, useCallback } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { CLUB_COURSES } from "./MemberAttendanceView"
import { memberPortalApi } from "../../api/memberPortalApi"
import { getErrorMessage } from "../../api/apiErrors"
import { getAuthoritativeProfileId } from "../../utils/memberSafetyHelpers"
import { motion, AnimatePresence } from "motion/react"
import {
  Check,
  X,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Clock,
} from "lucide-react"

/**
 * FIXED SERVER DATE (Asia/Ho_Chi_Minh)
 * Standardized date: 2026-10-14 (Thứ Tư, 14 tháng 10 năm 2026)
 */
const SERVER_TODAY = "2026-10-14"

// Curated high-end appraisal tags (Thay thế tags CSAT thông thường)
const POSITIVE_APPRAISAL_TAGS = [
  "Giáo án chuẩn xác",
  "Cường độ bài tập lý tưởng",
  "Mặt sàn & Ánh sáng hoàn hảo",
  "Theo sát kỹ thuật",
  "Chăm sóc chu đáo",
  "Truyền cảm hứng",
]

const CRITICAL_APPRAISAL_TAGS = [
  "Cần chỉnh lại nhịp độ",
  "Mặt sàn chưa tối ưu",
  "Nhiệt độ phòng chưa chuẩn",
  "Cần hỗ trợ kỹ thuật sâu hơn",
  "Âm thanh hơi ồn",
  "Cần bổ sung dụng cụ bổ trợ",
]

// Thang định danh chuẩn mực VIP
const APPRAISAL_VERDICTS = {
  1: { label: "Cần điều chỉnh chất lượng", desc: "Chưa đạt kỳ vọng cơ bản" },
  2: { label: "Chưa đạt chuẩn mực CLB", desc: "Cần ban chuyên môn can thiệp" },
  3: { label: "Đạt yêu cầu cơ bản", desc: "Buổi tập diễn ra đúng kế hoạch" },
  4: { label: "Chuẩn mực cao", desc: "Chất lượng huấn luyện và sân bãi tốt" },
  5: {
    label: "Xuất sắc · Vượt kỳ vọng",
    desc: "Đẳng cấp huấn luyện và trải nghiệm tuyệt hảo",
  },
}

const API_ENABLED = import.meta.env.VITE_API_ENABLED
  ? import.meta.env.VITE_API_ENABLED === "true"
  : import.meta.env.MODE !== "mock"

export function MemberFeedbackView({ embedded = false }) {
  const {
    currentUser,
    members,
    classes,
    feedbacks,
    submitFeedback,
    checkedInCourseSessions,
    showToast,
  } = useSCMS()

  // Active tab: 'pending' (Cần đánh giá) | 'submitted' (Lịch sử của tôi)
  const [activeTab, setActiveTab] = useState("pending")

  // Backend feedback state in API mode
  const [apiFeedbackMap, setApiFeedbackMap] = useState({})
  const [apiEnrollments, setApiEnrollments] = useState([])
  const [isLoadingApi, setIsLoadingApi] = useState(false)

  // Filter state for submitted reviews tab
  const [selectedCourseFilter, setSelectedCourseFilter] = useState("all")
  const [selectedTimeFilter, setSelectedTimeFilter] = useState("all")

  // Drawer Sheet state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeSessionForReview, setActiveSessionForReview] = useState(null)
  const [editingFeedbackId, setEditingFeedbackId] = useState(null)
  const [isThankYouMode, setIsThankYouMode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  // Form states
  const [overallRating, setOverallRating] = useState(0)
  const [coachCriteria, setCoachCriteria] = useState({
    expertise: 5,
    interaction: 5,
    punctuality: 5,
  })
  const [facilityCriteria, setFacilityCriteria] = useState({
    court: 5,
    lighting: 5,
    cleanliness: 5,
  })
  const [selectedTags, setSelectedTags] = useState([])
  const [commentText, setCommentText] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isPrivateContactRequested, setIsPrivateContactRequested] =
    useState(false)

  // Expanded reviews text & criteria breakdown toggle (reviewId -> boolean)
  const [expandedComments, setExpandedComments] = useState({})
  const [expandedBreakdowns, setExpandedBreakdowns] = useState({})

  // ESC key & scroll lock for drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && drawerOpen) {
        setDrawerOpen(false)
      }
    }
    if (drawerOpen) {
      document.addEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "unset"
    }
  }, [drawerOpen])

  // Current active member
  const member = useMemo(() => {
    return (
      (members || []).find(
        (m) =>
          String(m.id) === String(currentUser?.id) ||
          (m.email &&
            currentUser?.email &&
            m.email.toLowerCase() === currentUser.email.toLowerCase()),
      ) ||
      currentUser ||
      members?.[0] || {
        id: "mem-1",
        name: "Bùi Văn Phúc",
        code: "MEM-001",
        tier: "Black",
      }
    )
  }, [members, currentUser])

  const fetchBackendFeedbackData = useCallback(async () => {
    if (!API_ENABLED) return
    const memberId =
      getAuthoritativeProfileId(currentUser) ||
      currentUser?.memberId ||
      currentUser?.id ||
      member?.id
    setIsLoadingApi(true)
    try {
      let enrollments = []
      try {
        if (memberId) {
          enrollments = await memberPortalApi.getMemberClasses(memberId)
        }
      } catch (err) {
        console.warn("Could not fetch member enrollments:", err)
      }

      const relevantClasses = Array.isArray(enrollments) ? enrollments : []

      setApiEnrollments(relevantClasses)

      const feedbackMap = {}
      await Promise.all(
        relevantClasses.map(async (item) => {
          const classId = item.classId || item.id
          if (classId && !Number.isNaN(Number(classId))) {
            try {
              const fb = await memberPortalApi.getMyClassFeedback(classId)
              if (fb) {
                feedbackMap[String(classId)] = fb
              }
            } catch (fbErr) {
              // 404 or unauthenticated
            }
          }
        }),
      )
      setApiFeedbackMap(feedbackMap)
    } catch (error) {
      console.warn("Error loading feedback data from API:", error)
    } finally {
      setIsLoadingApi(false)
    }
  }, [currentUser, member])

  useEffect(() => {
    fetchBackendFeedbackData()
  }, [fetchBackendFeedbackData])

  /**
   * UNIFIED SESSIONS DERIVATION:
   * Strictly uses Backend API records when API_ENABLED (zero fake courses), or CLUB_COURSES in offline demo mode
   */
  const { attendedSessions, pendingSessions, submittedReviews } =
    useMemo(() => {
      if (API_ENABLED) {
        const apiAttended = []
        const apiPending = []
        const apiSubmitted = []

        apiEnrollments.forEach((item) => {
          const classId = String(item.classId || item.id)
          const fb =
            apiFeedbackMap[classId] ||
            (feedbacks || []).find((f) => String(f.classId) === classId)
          const matchedClass =
            (classes || []).find((c) => String(c.id) === classId) || {}
          const coachId = item.coachId || matchedClass.coachId || 1
          const coachName =
            item.coachName ||
            matchedClass.coachName ||
            matchedClass.coach ||
            "Huấn luyện viên CLB"
          const className =
            item.className || matchedClass.name || `Lớp học #${classId}`
          const roomName =
            item.roomName ||
            matchedClass.roomName ||
            matchedClass.room ||
            "Sân tập CLB"

          const sessionItem = {
            id: classId,
            classId: Number(classId) || classId,
            coachId,
            className,
            coach: coachName,
            discipline:
              item.subjectName || matchedClass.subjectName || "Khóa học",
            date: item.enrolledAt ? item.enrolledAt.slice(0, 10) : SERVER_TODAY,
            dayVi: item.enrolledAt
              ? new Date(item.enrolledAt).toLocaleDateString("vi-VN")
              : "Đang theo học",
            startTime: matchedClass.startTime || "08:00",
            endTime: matchedClass.endTime || "09:30",
            court: roomName,
            attendanceStatus: "present",
            attendanceNote: "Đã đăng ký / tham gia lớp học",
            topic: matchedClass.topic || "Chuyên đề đào tạo",
            deadlineDays: 7,
          }

          apiAttended.push(sessionItem)

          if (fb) {
            apiSubmitted.push({
              id: fb.feedbackId || fb.id || `fb-${classId}`,
              classId: Number(classId) || classId,
              coachId,
              className,
              coachName,
              rating: fb.classRating || fb.coachRating || fb.rating || 5,
              classRating: fb.classRating || 5,
              coachRating: fb.coachRating || 5,
              comment: fb.comment || "",
              createdAt: fb.createdAt
                ? fb.createdAt.slice(0, 16).replace("T", " ")
                : SERVER_TODAY,
              date: fb.createdAt ? fb.createdAt.slice(0, 10) : SERVER_TODAY,
              dayVi: fb.createdAt
                ? new Date(fb.createdAt).toLocaleDateString("vi-VN")
                : "Đã đánh giá",
              sessionMeta: sessionItem,
              tags: fb.tags || [],
              coachReply:
                fb.coachReply ||
                "HLV và ban chuyên môn đã tiếp nhận phản hồi của bạn.",
            })
          } else {
            apiPending.push(sessionItem)
          }
        })

        return {
          attendedSessions: apiAttended,
          pendingSessions: apiPending,
          submittedReviews: apiSubmitted,
        }
      }

      const reviewsList = feedbacks || []

      // Collect completed sessions across active courses
      const allAttended = []

      // 1. Badminton Course Session 1
      const bdmCourse = CLUB_COURSES.badminton
      if (bdmCourse?.sessions?.[0]) {
        const s = bdmCourse.sessions[0]
        allAttended.push({
          id: `badminton-session-${s.num}`,
          classId: 1,
          coachId: 1,
          courseId: "badminton",
          sessionNum: s.num,
          className: bdmCourse.name,
          discipline: bdmCourse.discipline,
          date: s.date,
          dayVi: "Thứ Hai, 12/10",
          startTime: s.startTime,
          endTime: s.endTime,
          court: `${s.court} (${s.zone} · Thảm Taraflex)`,
          coach: `${s.coach}`,
          attendanceStatus: s.attendance,
          attendanceNote:
            s.attendance === "late" ? "Đi muộn 10 phút" : "Có mặt đúng giờ",
          topic: s.topic,
          deadlineDays: 8,
        })
      }

      // 2. Pickleball Course Session 1
      const pkbCourse = CLUB_COURSES.pickleball
      if (pkbCourse?.sessions?.[0]) {
        const s = pkbCourse.sessions[0]
        allAttended.push({
          id: `pickleball-session-${s.num}`,
          classId: 2,
          coachId: 2,
          courseId: "pickleball",
          sessionNum: s.num,
          className: pkbCourse.name,
          discipline: pkbCourse.discipline,
          date: s.date,
          dayVi: "Thứ Sáu, 09/10",
          startTime: "18:15",
          endTime: "20:00",
          court: `${s.court} · Khu B`,
          coach: `${s.coach}`,
          attendanceStatus: "late",
          attendanceNote: "Đi muộn 10 phút",
          topic: s.topic,
          deadlineDays: 5,
        })
      }

      // 3. Dynamically checked-in sessions across all courses (e.g., Archery Session 1 after check-in)
      Object.values(CLUB_COURSES).forEach((course) => {
        ;(course.sessions || []).forEach((s) => {
          const sessionKey = `${course.id}-session-${s.num}`
          const checkInInfo = checkedInCourseSessions?.[sessionKey]
          if (checkInInfo && !allAttended.some((a) => a.id === sessionKey)) {
            allAttended.push({
              id: sessionKey,
              classId: 3,
              coachId: 3,
              courseId: course.id,
              sessionNum: s.num,
              className: course.name,
              discipline: course.discipline,
              date: s.date,
              dayVi: `${s.dayOfWeek}, ${s.date.slice(8, 10)}/${s.date.slice(5, 7)}`,
              startTime: s.startTime,
              endTime: s.endTime,
              court: `${s.court} (${s.zone})`,
              coach: s.coach,
              attendanceStatus: checkInInfo.attendance || "present",
              attendanceNote: `Có mặt · Điểm danh lúc ${checkInInfo.checkInTime || s.startTime}`,
              topic: s.topic,
              deadlineDays: 7,
            })
          }
        })
      })

      // Match each session against submitted feedbacks
      const submitted = []
      const pending = []

      for (const session of allAttended) {
        const existingFb = reviewsList.find(
          (f) =>
            f.classId === session.id ||
            (f.className === session.className && f.date === session.date) ||
            (f.date === session.date &&
              f.coachName?.includes(
                session.coach.replace(/^HLV\s+/, "").split(" ")[0],
              )),
        )

        if (existingFb) {
          submitted.push({
            ...existingFb,
            sessionMeta: session,
          })
        } else {
          pending.push(session)
        }
      }

      // Also include any other user reviews in submitted
      for (const fb of reviewsList) {
        if (!submitted.some((s) => s.id === fb.id)) {
          submitted.push({
            ...fb,
            sessionMeta: {
              id: fb.classId || `session-${fb.id}`,
              className: fb.className || "Cầu lông K01 (Nền tảng)",
              date: fb.date || "2026-10-12",
              dayVi: fb.dayVi || "Thứ Hai, 12/10",
              startTime: fb.startTime || "06:00",
              endTime: fb.endTime || "07:30",
              court: fb.room || "Sân 02 (Thảm Taraflex)",
              coach: fb.coachName || "HLV Lê Thị Mai",
            },
          })
        }
      }

      return {
        attendedSessions: allAttended,
        pendingSessions: pending,
        submittedReviews: submitted,
      }
    }, [
      feedbacks,
      checkedInCourseSessions,
      apiEnrollments,
      apiFeedbackMap,
      classes,
    ])

  // Average rating calculated from submitted reviews
  const averageRating = useMemo(() => {
    if (submittedReviews.length === 0) return "—"
    const sum = submittedReviews.reduce(
      (acc, r) => acc + (Number(r.rating) || 5),
      0,
    )
    return (sum / submittedReviews.length).toFixed(1)
  }, [submittedReviews])

  // Filtered reviews in Tab 2
  const filteredSubmittedReviews = useMemo(() => {
    const serverDateMs = new Date(`${SERVER_TODAY}T23:59:59`).getTime()
    return submittedReviews.filter((r) => {
      if (selectedCourseFilter !== "all") {
        const nameMatch = (r.className || "")
          .toLowerCase()
          .includes(selectedCourseFilter.toLowerCase())
        if (!nameMatch) return false
      }
      if (selectedTimeFilter !== "all" && r.date) {
        const reviewDateMs = new Date(`${r.date}T12:00:00`).getTime()
        if (!Number.isNaN(reviewDateMs)) {
          const diffDays = (serverDateMs - reviewDateMs) / (1000 * 60 * 60 * 24)
          if (selectedTimeFilter === "30days" && diffDays > 30) return false
          if (selectedTimeFilter === "semester" && diffDays > 120) return false
        }
      }
      return true
    })
  }, [submittedReviews, selectedCourseFilter, selectedTimeFilter])

  // Open Drawer to create or edit review
  const handleOpenReviewDrawer = (session, existingFeedback = null) => {
    setActiveSessionForReview(session)
    setSubmitError(null)
    setIsThankYouMode(false)

    if (existingFeedback) {
      setEditingFeedbackId(existingFeedback.id)
      setOverallRating(existingFeedback.rating || 5)
      setCoachCriteria({
        expertise: existingFeedback.criteria?.coachBreakdown?.expertise || 5,
        interaction:
          existingFeedback.criteria?.coachBreakdown?.interaction || 5,
        punctuality:
          existingFeedback.criteria?.coachBreakdown?.punctuality || 5,
      })
      setFacilityCriteria({
        court: existingFeedback.criteria?.facilityBreakdown?.court || 5,
        lighting: existingFeedback.criteria?.facilityBreakdown?.lighting || 5,
        cleanliness:
          existingFeedback.criteria?.facilityBreakdown?.cleanliness || 5,
      })
      setSelectedTags(existingFeedback.tags || [])
      setCommentText(existingFeedback.comment || "")
      setIsAnonymous(Boolean(existingFeedback.isAnonymous))
      setIsPrivateContactRequested(
        Boolean(existingFeedback.isPrivateContactRequested),
      )
    } else {
      setEditingFeedbackId(null)
      setOverallRating(0) // Not chosen yet
      setCoachCriteria({ expertise: 5, interaction: 5, punctuality: 5 })
      setFacilityCriteria({ court: 5, lighting: 5, cleanliness: 5 })
      setSelectedTags([])
      setCommentText("")
      setIsAnonymous(false)
      setIsPrivateContactRequested(false)
    }

    setDrawerOpen(true)
  }

  // Toggle tag selection
  const handleToggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  // Submit Feedback from Drawer
  const handleSubmitReview = async () => {
    if (!overallRating || overallRating === 0) return
    if (overallRating <= 2 && !commentText.trim()) {
      setSubmitError(
        "Vui lòng cho Giám đốc Chuyên môn biết điều cần cải thiện để đảm bảo chuẩn mực dịch vụ.",
      )
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const avgCoach = Math.min(
        5,
        Math.max(
          1,
          Math.round(
            (coachCriteria.expertise +
              coachCriteria.interaction +
              coachCriteria.punctuality) /
              3,
          ) ||
            overallRating ||
            5,
        ),
      )
      const avgClass = Math.min(
        5,
        Math.max(
          1,
          Math.round(
            (facilityCriteria.court +
              facilityCriteria.lighting +
              facilityCriteria.cleanliness) /
              3,
          ) ||
            overallRating ||
            5,
        ),
      )

      const targetClassId =
        activeSessionForReview.classId || activeSessionForReview.id
      const targetCoachId = activeSessionForReview.coachId || 1

      const payload = {
        id: editingFeedbackId || `fb-${Date.now()}`,
        classId: targetClassId,
        coachId: targetCoachId,
        className: activeSessionForReview.className,
        coachName: activeSessionForReview.coach,
        memberId: member.id,
        memberName: member.name,
        rating: overallRating,
        classRating: avgClass,
        coachRating: avgCoach,
        date: activeSessionForReview.date,
        dayVi: activeSessionForReview.dayVi,
        startTime: activeSessionForReview.startTime,
        endTime: activeSessionForReview.endTime,
        room: activeSessionForReview.court,
        criteria: {
          coachQuality: avgCoach,
          facilityQuality: avgClass,
          intensity: "Vừa sức",
          coachBreakdown: coachCriteria,
          facilityBreakdown: facilityCriteria,
        },
        tags: selectedTags,
        comment: commentText.trim(),
        isAnonymous,
        isPrivateContactRequested,
        coachReply: editingFeedbackId
          ? submittedReviews.find((r) => r.id === editingFeedbackId)?.coachReply
          : "Chân thành cảm ơn bạn. Ban chuyên môn và Huấn luyện viên trưởng đã tiếp nhận ghi chú này để hoàn thiện giáo án buổi kế tiếp. Chúc bạn có buổi phục hồi thể lực thật tốt!",
        createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
      }

      if (API_ENABLED) {
        const parsedClassId = Number(targetClassId)
        const parsedCoachId = Number(targetCoachId) || 1
        if (!Number.isNaN(parsedClassId) && parsedClassId > 0) {
          await memberPortalApi.submitClassFeedback(parsedClassId, {
            classId: parsedClassId,
            coachId: parsedCoachId > 0 ? parsedCoachId : 1,
            classRating: avgClass,
            coachRating: avgCoach,
            comment: commentText.trim(),
          })
        }
        await fetchBackendFeedbackData()
        showToast?.(
          editingFeedbackId
            ? "Đã cập nhật đánh giá lớp học thành công!"
            : "Cảm ơn bạn đã gửi đánh giá lớp học!",
          "success",
        )
      } else {
        await submitFeedback(payload)
      }
      setIsThankYouMode(true)
    } catch (err) {
      setSubmitError(
        getErrorMessage(
          err,
          "Chưa thể gửi đánh giá (Quy tắc D09: Hội viên cần có ghi danh Active và ít nhất 1 buổi điểm danh Present ở lớp này).",
        ),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // Toggle comment expanded in tab 2
  const toggleCommentExpand = (id) => {
    setExpandedComments((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <main
      className={
        embedded
          ? "space-y-6 font-['Be_Vietnam_Pro',sans-serif]"
          : "mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-7 sm:py-8 font-['Be_Vietnam_Pro',sans-serif]"
      }
    >
      {/* 1. HEADER */}
      {!embedded && (
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-red-700">
              VIBE SPORT · MEMBER
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              Đánh giá & Phản hồi
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Ý kiến của bạn giúp chúng tôi liên tục nâng cao chuẩn mực huấn
              luyện và chất lượng cơ sở vật chất.
            </p>
          </div>
        </header>
      )}

      {/* 2. DẢI CHỈ SỐ: 4 Thẻ đồng bộ hệ thống */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Cột 1: Chờ đánh giá */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
            CHỜ ĐÁNH GIÁ
          </span>
          <div
            className={`text-3xl font-black mt-2 tabular-nums ${
              pendingSessions.length > 0 ? "text-amber-600" : "text-slate-900"
            }`}
          >
            {pendingSessions.length}
          </div>
        </div>

        {/* Cột 2: Đã gửi */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
            ĐÃ GỬI
          </span>
          <div className="text-3xl font-black mt-2 tabular-nums text-slate-900">
            {submittedReviews.length}
          </div>
        </div>

        {/* Cột 3: Đã tham gia */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
            ĐÃ THAM GIA
          </span>
          <div className="text-3xl font-black mt-2 tabular-nums text-slate-900">
            {attendedSessions.length}
          </div>
        </div>

        {/* Cột 4: Điểm bạn đã cho */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
            ĐIỂM BẠN ĐÃ CHO
          </span>
          <div className="text-3xl font-black mt-2 tabular-nums text-slate-900 flex items-center gap-1.5">
            <span>{averageRating}</span>
            {submittedReviews.length > 0 && (
              <span className="text-sm font-medium text-slate-400">/ 5★</span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {submittedReviews.length > 0
              ? `trung bình, ${submittedReviews.length} đánh giá`
              : "Chưa có đánh giá"}
          </div>
        </div>
      </section>

      {/* 3. TABS */}
      <div className="flex border-b border-slate-200 gap-6 text-sm">
        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          className={`pb-3 font-bold border-b-2 cursor-pointer transition-colors flex items-center gap-2 ${
            activeTab === "pending"
              ? "border-red-700 text-red-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Cần đánh giá</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 font-semibold">
            {pendingSessions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("submitted")}
          className={`pb-3 font-bold border-b-2 cursor-pointer transition-colors flex items-center gap-2 ${
            activeTab === "submitted"
              ? "border-red-700 text-red-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>Lịch sử của tôi</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 font-semibold">
            {submittedReviews.length}
          </span>
        </button>
      </div>

      {/* 4. TAB 1: CẦN ĐÁNH GIÁ */}
      {activeTab === "pending" && (
        <div className="space-y-4">
          {pendingSessions.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h3 className="text-lg font-bold text-slate-900">
                Bạn đã hoàn tất mọi đánh giá
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Các buổi tập mới sẽ sẵn sàng đánh giá ngay sau khi buổi học kết
                thúc.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {pendingSessions.map((session) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                    transition={{ duration: 0.2 }}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    {/* Cột 1: Ngày & Giờ */}
                    <div className="sm:w-44 shrink-0 space-y-0.5">
                      <div className="font-bold text-slate-900">
                        {session.dayVi}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {session.startTime} – {session.endTime}
                      </div>
                    </div>

                    {/* Cột 2: Khóa học & Thông tin */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <h3 className="text-base font-bold text-slate-900 truncate">
                        {session.className}
                      </h3>
                      <p className="text-xs text-slate-600">
                        {session.court} · Huấn luyện viên{" "}
                        {session.coach?.replace(/^HLV\s+/, "")}
                      </p>
                      <div className="text-xs text-slate-500 flex items-center gap-2 pt-0.5">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[11px] font-medium">
                          {session.attendanceNote}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span
                          className={
                            session.deadlineDays <= 2
                              ? "text-amber-600 font-medium"
                              : "text-slate-500"
                          }
                        >
                          Còn {session.deadlineDays} ngày để đánh giá
                        </span>
                      </div>
                    </div>

                    {/* Cột 3: CTA Button */}
                    <div className="shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenReviewDrawer(session)}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-[0.98] bg-red-700 hover:bg-red-800 text-white shadow-xs"
                      >
                        Viết đánh giá
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* 5. TAB 2: LỊCH SỬ CỦA TÔI */}
      {activeTab === "submitted" && (
        <div className="space-y-4">
          {/* Bộ lọc */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <select
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs text-slate-900 rounded-xl px-3 py-2 cursor-pointer outline-none focus:border-red-700"
              >
                <option value="all">Tất cả khóa học</option>
                <option value="Cầu lông">Cầu lông K01</option>
                <option value="Pickleball">Pickleball K01</option>
                <option value="Bắn cung">Bắn cung K01</option>
              </select>

              <select
                value={selectedTimeFilter}
                onChange={(e) => setSelectedTimeFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs text-slate-900 rounded-xl px-3 py-2 cursor-pointer outline-none focus:border-red-700"
              >
                <option value="all">Tất cả thời gian</option>
                <option value="30days">30 ngày qua</option>
                <option value="semester">Học kỳ này</option>
              </select>
            </div>

            <span className="text-xs text-slate-500 font-medium">
              {filteredSubmittedReviews.length} đánh giá đã gửi
            </span>
          </div>

          {filteredSubmittedReviews.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
              <p className="text-lg font-bold text-slate-900">
                Bạn chưa có đánh giá nào
              </p>
              <p className="text-xs text-slate-500">
                Ý kiến của bạn sẽ lưu tại đây sau khi gửi đánh giá buổi học.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("pending")}
                className="text-xs text-red-700 underline font-bold cursor-pointer"
              >
                Xem danh sách cần đánh giá
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSubmittedReviews.map((review) => {
                const isExpanded = Boolean(expandedComments[review.id])
                const isBreakdownOpen = Boolean(expandedBreakdowns[review.id])
                const coachBd = review.criteria?.coachBreakdown || {
                  expertise: 5,
                  interaction: 5,
                  punctuality: 5,
                }
                const facilityBd = review.criteria?.facilityBreakdown || {
                  court: 5,
                  lighting: 5,
                  cleanliness: 5,
                }

                return (
                  <div
                    key={review.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-slate-900">
                            {review.className || review.sessionMeta?.className}
                          </h3>
                          <span className="text-slate-300">•</span>
                          <span className="text-xs text-slate-500">
                            {review.room ||
                              review.sessionMeta?.court ||
                              review.court}
                          </span>
                          {review.isAnonymous && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              Ẩn danh
                            </span>
                          )}
                          {review.isPrivateContactRequested && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              Yêu cầu đối thoại
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Huấn luyện viên:{" "}
                          <span className="font-medium text-slate-800">
                            {review.coachName ||
                              review.coach ||
                              review.sessionMeta?.coach}
                          </span>{" "}
                          · {review.dayVi || review.sessionMeta?.dayVi} (
                          {review.startTime ||
                            review.sessionMeta?.startTime ||
                            "06:00"}{" "}
                          -{" "}
                          {review.endTime ||
                            review.sessionMeta?.endTime ||
                            "07:30"}
                          )
                        </p>
                      </div>

                      {/* Score Badge */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl">
                          <span className="text-amber-500 font-black text-sm">
                            ★
                          </span>
                          <span className="font-bold text-slate-900 text-sm">
                            {Number(
                              review.overallRating || review.rating || 5,
                            ).toFixed(1)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenReviewDrawer(
                              review.sessionMeta || review,
                              review,
                            )
                          }
                          className="text-xs text-red-700 hover:text-red-800 font-bold hover:underline cursor-pointer"
                        >
                          Chỉnh sửa
                        </button>
                      </div>
                    </div>

                    {/* Verdict label & Tags */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-red-700 uppercase tracking-wider">
                        {APPRAISAL_VERDICTS[
                          Math.round(review.overallRating || review.rating || 5)
                        ]?.label || "Chuẩn mực cao"}
                      </span>

                      {review.tags && review.tags.length > 0 && (
                        <>
                          <span className="text-slate-300">•</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {review.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-xs px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-medium"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Comment */}
                    {review.comment && (
                      <div className="space-y-1">
                        <p
                          className={`text-sm text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-100 italic leading-relaxed ${
                            isExpanded ? "" : "line-clamp-2"
                          }`}
                        >
                          “{review.comment}”
                        </p>
                        {review.comment.length > 120 && (
                          <button
                            type="button"
                            onClick={() => toggleCommentExpand(review.id)}
                            className="text-xs text-red-700 hover:underline font-bold cursor-pointer block"
                          >
                            {isExpanded ? "Thu gọn" : "Xem toàn văn nhận xét"}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Detail criteria toggle */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedBreakdowns((prev) => ({
                            ...prev,
                            [review.id]: !prev[review.id],
                          }))
                        }
                        className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer transition-colors"
                      >
                        {isBreakdownOpen
                          ? "Ẩn chi tiết tiêu chí đánh giá"
                          : "Xem chi tiết tiêu chí đánh giá (HLV & Sân tập)"}
                      </button>

                      {isBreakdownOpen && (
                        <div className="mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div className="space-y-1.5">
                            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                              Huấn luyện viên
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>Chuyên môn:</span>
                              <span className="font-bold text-slate-900">
                                {coachBd.expertise}/5
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>Tương tác:</span>
                              <span className="font-bold text-slate-900">
                                {coachBd.interaction}/5
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>Đúng giờ:</span>
                              <span className="font-bold text-slate-900">
                                {coachBd.punctuality}/5
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-4">
                            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                              Sân bãi & Tiện nghi
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>Mặt sân:</span>
                              <span className="font-bold text-slate-900">
                                {facilityBd.court}/5
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>Ánh sáng:</span>
                              <span className="font-bold text-slate-900">
                                {facilityBd.lighting}/5
                              </span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>Vệ sinh:</span>
                              <span className="font-bold text-slate-900">
                                {facilityBd.cleanliness}/5
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Coach reply if any */}
                    {review.coachReply && (
                      <div className="pl-4 border-l-2 border-red-700/60 space-y-1 pt-1">
                        <p className="text-xs text-slate-600 italic leading-relaxed">
                          “{review.coachReply}”
                        </p>
                        <span className="text-[11px] text-slate-400 block">
                          — Huấn luyện viên{" "}
                          {review.coachName?.replace(/^HLV\s+/, "")} · Phản hồi
                          sau buổi tập
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. DRAWER ĐÁNH GIÁ (Slide-Over Sheet 480px)                    */}
      {/* ============================================================== */}
      <AnimatePresence>
        {drawerOpen && activeSessionForReview && (
          <div className="fixed inset-0 z-50 overflow-hidden font-['Be_Vietnam_Pro',sans-serif]">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs"
              onClick={() => !isSubmitting && setDrawerOpen(false)}
              aria-hidden="true"
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
              <motion.aside
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="w-screen max-w-[480px] bg-white text-slate-900 shadow-2xl flex flex-col justify-between border-l border-slate-200 z-10"
                role="dialog"
                aria-modal="true"
              >
                {/* Header Drawer */}
                <div className="p-6 border-b border-slate-200 flex items-start justify-between gap-4 bg-white sticky top-0 z-10">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 block">
                      {editingFeedbackId
                        ? "CHỈNH SỬA ĐÁNH GIÁ"
                        : "ĐÁNH GIÁ BUỔI HỌC"}
                    </span>
                    <h2 className="font-bold text-xl text-slate-900 leading-snug">
                      {activeSessionForReview.className}
                    </h2>
                    <p className="text-xs text-slate-500 font-normal">
                      {activeSessionForReview.dayVi} ·{" "}
                      {activeSessionForReview.coach} ·{" "}
                      {activeSessionForReview.court}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => !isSubmitting && setDrawerOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Đóng (ESC)"
                  >
                    <X className="w-5 h-5 stroke-[1.75]" />
                  </button>
                </div>

                {/* Drawer Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                  {isThankYouMode ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-200">
                      <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                        <Check className="w-7 h-7 stroke-[2.5]" />
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-bold text-xl text-slate-900">
                          {editingFeedbackId
                            ? "Đã cập nhật đánh giá"
                            : "Cảm ơn bạn đã phản hồi!"}
                        </h3>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                          Ý kiến của bạn đã được chuyển tới Huấn luyện viên và
                          Ban Quản lý Chuyên môn để liên tục nâng cao chuẩn mực
                          buổi tập.
                        </p>
                      </div>

                      <div className="pt-4 w-full space-y-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setDrawerOpen(false)
                            setIsThankYouMode(false)
                            setActiveTab("submitted")
                            if (typeof showToast === "function") {
                              showToast(
                                editingFeedbackId
                                  ? "Đã cập nhật đánh giá thành công."
                                  : "Đã lưu đánh giá thành công.",
                                "success",
                              )
                            }
                          }}
                          className="w-full py-3 rounded-xl bg-red-700 text-white text-xs font-bold cursor-pointer hover:bg-red-800 transition-all shadow-xs"
                        >
                          Xem trong Lịch sử đánh giá
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDrawerOpen(false)
                            setIsThankYouMode(false)
                          }}
                          className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-medium cursor-pointer hover:bg-slate-50 transition-all"
                        >
                          Đóng cửa sổ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* BƯỚC 1: THANG ĐIỂM CHẤM 1.0 – 5.0 */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-sm text-slate-900">
                            Đánh giá chất lượng buổi tập
                          </h3>
                          <span className="text-[11px] font-bold text-red-700">
                            THANG ĐIỂM 1 – 5
                          </span>
                        </div>

                        {/* 5 Phím chọn điểm */}
                        <div
                          role="radiogroup"
                          aria-label="Thang đo chất lượng buổi học"
                          className="grid grid-cols-5 gap-2 pt-1"
                        >
                          {[1, 2, 3, 4, 5].map((level) => {
                            const isSelected = overallRating === level
                            return (
                              <button
                                key={level}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                aria-label={`Mức ${level} trên 5: ${APPRAISAL_VERDICTS[level].label}`}
                                onClick={() => setOverallRating(level)}
                                className={`h-11 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer font-bold text-sm border ${
                                  isSelected
                                    ? "bg-red-700 text-white border-red-700 shadow-xs"
                                    : overallRating >= level
                                      ? "bg-red-50 text-red-700 border-red-200"
                                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                <span>{level}★</span>
                              </button>
                            )
                          })}
                        </div>

                        {/* Label verdict dưới 5 mức */}
                        <div className="min-h-5 pt-0.5">
                          {overallRating > 0 ? (
                            <div className="flex items-baseline gap-2 animate-in fade-in duration-150">
                              <span className="text-xs font-bold text-red-700">
                                {APPRAISAL_VERDICTS[overallRating].label}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                · {APPRAISAL_VERDICTS[overallRating].desc}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              Chọn số sao đánh giá từ 1 đến 5 sao
                            </span>
                          )}
                        </div>
                      </div>

                      {/* BƯỚC 2: Tiêu chí chi tiết */}
                      {overallRating > 0 && (
                        <div className="space-y-5 pt-3 border-t border-slate-100 animate-in fade-in duration-200">
                          {/* Nhóm 1: Huấn luyện viên */}
                          <div className="space-y-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                              TIÊU CHÍ HUẤN LUYỆN VIÊN
                            </span>

                            <div className="space-y-2.5">
                              {[
                                {
                                  key: "expertise",
                                  label: "Chuyên môn & Giáo án kỹ thuật",
                                },
                                {
                                  key: "interaction",
                                  label: "Tương tác & Theo sát cá nhân",
                                },
                                {
                                  key: "punctuality",
                                  label: "Tác phong & Đúng giờ",
                                },
                              ].map((item) => (
                                <div
                                  key={item.key}
                                  className="flex items-center justify-between text-xs py-1"
                                >
                                  <span className="text-slate-700 font-medium">
                                    {item.label}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {[1, 2, 3, 4, 5].map((pt) => (
                                      <button
                                        key={pt}
                                        type="button"
                                        onClick={() =>
                                          setCoachCriteria((prev) => ({
                                            ...prev,
                                            [item.key]: pt,
                                          }))
                                        }
                                        className={`w-6 h-6 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                          coachCriteria[item.key] === pt
                                            ? "bg-red-700 text-white"
                                            : coachCriteria[item.key] >= pt
                                              ? "bg-red-50 text-red-700"
                                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                        }`}
                                      >
                                        {pt}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Nhóm 2: Sân bãi & Tiện nghi */}
                          <div className="space-y-3 pt-2 border-t border-slate-100">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                              TIÊU CHÍ SÂN BÃI & TIỆN NGHI
                            </span>

                            <div className="space-y-2.5">
                              {[
                                {
                                  key: "court",
                                  label: "Mặt sàn & Ánh sáng thi đấu",
                                },
                                {
                                  key: "lighting",
                                  label: "Nhiệt độ không gian & Tiếng ồn",
                                },
                                {
                                  key: "cleanliness",
                                  label: "Vệ sinh & Hậu cần sân bãi",
                                },
                              ].map((item) => (
                                <div
                                  key={item.key}
                                  className="flex items-center justify-between text-xs py-1"
                                >
                                  <span className="text-slate-700 font-medium">
                                    {item.label}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    {[1, 2, 3, 4, 5].map((pt) => (
                                      <button
                                        key={pt}
                                        type="button"
                                        onClick={() =>
                                          setFacilityCriteria((prev) => ({
                                            ...prev,
                                            [item.key]: pt,
                                          }))
                                        }
                                        className={`w-6 h-6 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                          facilityCriteria[item.key] === pt
                                            ? "bg-red-700 text-white"
                                            : facilityCriteria[item.key] >= pt
                                              ? "bg-red-50 text-red-700"
                                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                        }`}
                                      >
                                        {pt}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* BƯỚC 3: Gợi ý nhận định nhanh */}
                      {overallRating > 0 && (
                        <div className="space-y-2.5 pt-3 border-t border-slate-100">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                            NHẬN ĐỊNH NHANH (CHỌN ĐỂ THÊM VÀO Ý KIẾN)
                          </span>
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            {(overallRating >= 4
                              ? POSITIVE_APPRAISAL_TAGS
                              : CRITICAL_APPRAISAL_TAGS
                            ).map((tag) => {
                              const isSelected = selectedTags.includes(tag)
                              return (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => handleToggleTag(tag)}
                                  className={`text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer font-medium border ${
                                    isSelected
                                      ? "bg-red-50 text-red-700 border-red-200 font-bold"
                                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                  }`}
                                >
                                  {tag}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* BƯỚC 4: Nhận xét văn bản */}
                      {overallRating > 0 && (
                        <div className="space-y-2 pt-3 border-t border-slate-100">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                            Ý KIẾN ĐÓNG GÓP CHI TIẾT (TÙY CHỌN)
                          </label>

                          <textarea
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            rows={3}
                            placeholder="Ghi chú chi tiết về bài tập, động tác, nhịp độ hoặc chất lượng sân..."
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-red-700 focus:ring-1 focus:ring-red-700 transition-all resize-none leading-relaxed"
                          />
                        </div>
                      )}

                      {/* BƯỚC 5: Quyền riêng tư & Đối thoại bảo mật */}
                      {overallRating > 0 && (
                        <div className="space-y-2.5 pt-3 border-t border-slate-100">
                          {/* Ẩn danh */}
                          <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={isAnonymous}
                              onChange={(e) => setIsAnonymous(e.target.checked)}
                              className="w-4 h-4 rounded border-slate-300 text-red-700 focus:ring-red-700"
                            />
                            <span>
                              Gửi ẩn danh với Huấn luyện viên (chỉ Ban Giám đốc
                              xem được)
                            </span>
                          </label>

                          {/* Đối thoại riêng */}
                          <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={isPrivateContactRequested}
                              onChange={(e) =>
                                setIsPrivateContactRequested(e.target.checked)
                              }
                              className="w-4 h-4 rounded border-slate-300 text-red-700 focus:ring-red-700"
                            />
                            <span>
                              Đề nghị Giám đốc Chuyên môn liên hệ trực tiếp trao
                              đổi thêm
                            </span>
                          </label>
                        </div>
                      )}

                      {submitError && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                          {submitError}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer Drawer */}
                {!isThankYouMode && (
                  <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setDrawerOpen(false)}
                      className="px-4 py-2.5 text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                    >
                      Hủy bỏ
                    </button>

                    <button
                      type="button"
                      disabled={overallRating === 0 || isSubmitting}
                      onClick={handleSubmitReview}
                      className={`px-6 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                        overallRating > 0 && !isSubmitting
                          ? "bg-red-700 hover:bg-red-800 text-white shadow-xs active:scale-[0.98]"
                          : "bg-slate-200 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      {isSubmitting
                        ? "Đang gửi..."
                        : editingFeedbackId
                          ? "Lưu cập nhật"
                          : "Gửi đánh giá"}
                    </button>
                  </div>
                )}
              </motion.aside>
            </div>
          </div>
        )}
      </AnimatePresence>
    </main>
  )
}
