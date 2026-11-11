import React, { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { useSCMS } from "../../context/SCMSContext"
import {
  getMemberClasses,
  getClassSessions,
  getMemberAttendances,
  getMyClassFeedback,
  submitClassFeedback,
} from "../../api/memberPortalApi"
import { getErrorMessage } from "../../api/apiErrors"
import { getAuthoritativeProfileId } from "../../utils/memberSafetyHelpers"
import {
  FEEDBACK_DEADLINE_DAYS,
  TIME_FORMATTER_HHMM,
  getTodayIsoInVn,
  toDateDdMmYyyy,
  formatSessionDateTimeSlot,
  diffCalendarDaysInVn,
  normalizeScheduleSession,
  isLegacyStrengthClass,
} from "../../utils/memberScheduleUtils"
import { motion, AnimatePresence } from "motion/react"
import {
  Check,
  X,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ClipboardList,
  CalendarDays,
  Star,
} from "lucide-react"
import { PageHeader } from "../ui/PageHeader"

export { FEEDBACK_DEADLINE_DAYS }

// Danh sách mã thẻ nhận định nhanh (qua i18n VI/EN)
const POSITIVE_TAG_CODES = [
  "pos_curriculum",
  "pos_intensity",
  "pos_court_lighting",
  "pos_technique",
  "pos_care",
  "pos_inspiring",
]

const CRITICAL_TAG_CODES = [
  "crit_pace",
  "crit_court",
  "crit_temperature",
  "crit_technique",
  "crit_noise",
  "crit_equipment",
]

const TAG_TRANSLATION_KEY_MAP = {
  pos_curriculum: "feedbackTagPosCurriculum",
  pos_intensity: "feedbackTagPosIntensity",
  pos_court_lighting: "feedbackTagPosCourtLighting",
  pos_technique: "feedbackTagPosTechnique",
  pos_care: "feedbackTagPosCare",
  pos_inspiring: "feedbackTagPosInspiring",
  crit_pace: "feedbackTagCritPace",
  crit_court: "feedbackTagCritCourt",
  crit_temperature: "feedbackTagCritTemperature",
  crit_technique: "feedbackTagCritTechnique",
  crit_noise: "feedbackTagCritNoise",
  crit_equipment: "feedbackTagCritEquipment",
}

// Ánh xạ ngược cho các thẻ lưu dạng chuỗi tiếng Việt cũ (nếu có) sang mã chuẩn
const LEGACY_TEXT_TO_TAG_CODE = {
  "Giáo án chuẩn xác": "pos_curriculum",
  "Cường độ bài tập lý tưởng": "pos_intensity",
  "Mặt sàn & Ánh sáng hoàn hảo": "pos_court_lighting",
  "Theo sát kỹ thuật": "pos_technique",
  "Chăm sóc chu đáo": "pos_care",
  "Truyền cảm hứng": "pos_inspiring",
  "Cần chỉnh lại nhịp độ": "crit_pace",
  "Mặt sàn chưa tối ưu": "crit_court",
  "Nhiệt độ phòng chưa chuẩn": "crit_temperature",
  "Cần hỗ trợ kỹ thuật sâu hơn": "crit_technique",
  "Âm thanh hơi ồn": "crit_noise",
  "Cần bổ sung dụng cụ bổ trợ": "crit_equipment",
}

const normalizeTagCode = (rawTag) => {
  if (!rawTag) return null
  const trimmed = String(rawTag).trim()
  if (TAG_TRANSLATION_KEY_MAP[trimmed]) return trimmed
  if (LEGACY_TEXT_TO_TAG_CODE[trimmed]) return LEGACY_TEXT_TO_TAG_CODE[trimmed]
  return trimmed
}

const getTagLabel = (tagCodeOrText, t) => {
  const normalized = normalizeTagCode(tagCodeOrText)
  if (normalized && TAG_TRANSLATION_KEY_MAP[normalized]) {
    return t(TAG_TRANSLATION_KEY_MAP[normalized])
  }
  return String(tagCodeOrText || "")
}

const getVerdictMeta = (ratingLevel, t) => {
  const clamped = Math.min(5, Math.max(1, Math.round(Number(ratingLevel) || 5)))
  return {
    label: t(`feedbackVerdict${clamped}Label`),
    desc: t(`feedbackVerdict${clamped}Desc`),
  }
}

const getFeedbackSportName = (course, isVi) => {
  const title = [course?.className, course?.sportName, course?.sport]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("vi")
  if (/bóng\s*chuyền|volley\s?ball/.test(title)) return isVi ? "Bóng chuyền" : "Volleyball"
  if (/cầu\s*lông|badminton/.test(title)) return isVi ? "Cầu lông" : "Badminton"
  if (/bóng\s*bàn|table\s?tennis|ping\s?pong/.test(title)) return isVi ? "Bóng bàn" : "Table tennis"
  return course?.sportName || course?.sport || (isVi ? "Thể thao" : "Sport")
}

// Các câu cố định hệ thống trước đây không được phép hiển thị giả danh phản hồi thật của HLV
const CANNED_SYSTEM_REPLIES = new Set([
  "HLV và ban chuyên môn đã tiếp nhận phản hồi của bạn.",
  "Chân thành cảm ơn bạn. Ban chuyên môn và Huấn luyện viên trưởng đã tiếp nhận ghi chú này để hoàn thiện giáo án buổi kế tiếp. Chúc bạn có buổi phục hồi thể lực thật tốt!",
])

const sanitizeRealCoachReply = (rawReply) => {
  if (!rawReply || typeof rawReply !== "string") return null
  const trimmed = rawReply.trim()
  if (!trimmed || CANNED_SYSTEM_REPLIES.has(trimmed)) return null
  return trimmed
}

const isSessionCancelled = (session) => {
  const raw = String(session?.rawStatus || session?.status || "")
    .trim()
    .toLowerCase()
  return (
    raw === "cancelled" ||
    raw === "canceled" ||
    session?.centerInvalidated === true
  )
}

const normalizeAttendanceStateKey = (rawState) => {
  const upper = String(rawState || "")
    .trim()
    .toUpperCase()
  if (upper.includes("LATE")) return "late"
  if (
    upper.includes("PRESENT") ||
    upper.includes("ATTENDED") ||
    upper === "CHECKED_IN"
  ) {
    return "present"
  }
  if (
    upper.includes("EXCUSED") ||
    upper.includes("WAIVED") ||
    upper.includes("PERMITTED")
  ) {
    return "excused"
  }
  if (upper.includes("ABSENT") || upper.includes("NO_SHOW")) {
    return "absent"
  }
  return "pending"
}

const findSessionAttendanceRecord = (session, records = []) => {
  if (!session || !Array.isArray(records)) return null
  const sessionId = session.id ?? session.sessionId
  return (
    records.find((record) => {
      const sameSession =
        sessionId != null &&
        record.sessionId != null &&
        String(record.sessionId) === String(sessionId)
      const sameClassDate =
        session.classId != null &&
        record.classId != null &&
        String(record.classId) === String(session.classId) &&
        String(record.sessionDate || "").slice(0, 10) ===
          String(session.sessionDate || "").slice(0, 10)
      return sameSession || sameClassDate
    }) || null
  )
}

// Lưu trữ bổ sung phía client cho các trường UI mà hợp đồng POST /api/classes/{classId}/feedback chưa có
// (như tags, điểm từng tiêu chí thành phần, cờ ẩn danh/đối thoại, sessionId) để không nhét vào comment và không làm mất khi tải lại/chỉnh sửa
const readStoredFeedbackMeta = () => ({})

const writeStoredFeedbackMeta = () => {}

// Trích xuất hạn đánh giá cấp KHÓA/LỚP từ dữ liệu API (nếu API có trả về).
// Nếu API không trả hạn theo khóa/lớp thì trả về null để ẩn đếm ngược, KHÔNG tự tính theo buổi.
export const evaluateCourseFeedbackDeadline = (
  enrollmentRow,
  matchedClass,
  todayIso,
) => {
  const apiRemainingDaysRaw =
    enrollmentRow?.feedbackDeadlineDays ??
    enrollmentRow?.remainingFeedbackDays ??
    enrollmentRow?.deadlineDays ??
    matchedClass?.feedbackDeadlineDays ??
    matchedClass?.remainingFeedbackDays ??
    matchedClass?.deadlineDays ??
    null

  const apiDeadlineDateRaw =
    enrollmentRow?.feedbackDeadline ??
    enrollmentRow?.reviewDeadline ??
    enrollmentRow?.feedbackExpiresAt ??
    matchedClass?.feedbackDeadline ??
    matchedClass?.reviewDeadline ??
    matchedClass?.feedbackExpiresAt ??
    null

  if (
    apiRemainingDaysRaw !== null &&
    apiRemainingDaysRaw !== undefined &&
    apiRemainingDaysRaw !== "" &&
    Number.isFinite(Number(apiRemainingDaysRaw))
  ) {
    const days = Math.round(Number(apiRemainingDaysRaw))
    return days >= 0 ? days : null
  }

  if (apiDeadlineDateRaw) {
    const deadlineIso = String(apiDeadlineDateRaw).slice(0, 10)
    const days = diffCalendarDaysInVn(todayIso, deadlineIso)
    return days !== null && days >= 0 ? days : null
  }

  return null
}

// Giữ hàm tương thích nếu có nơi import kiểm tra
export const evaluateSessionFeedbackEligibility = (
  session,
  attendanceRecord,
  todayIso,
) => {
  const remainingDays = evaluateCourseFeedbackDeadline(
    session,
    attendanceRecord,
    todayIso,
  )
  return {
    isEligible: true,
    remainingDays,
  }
}

export function MemberFeedbackView({ embedded = false }) {
  const {
    currentUser,
    members,
    classes,
    feedbacks,
    submitFeedback,
    showToast,
    apiEnabled,
    language,
    t,
  } = useSCMS()
  const isVi = language === "vi"

  const tr = useCallback(
    (key, params = {}) => {
      let text = t(key)
      for (const [k, v] of Object.entries(params)) {
        text = text.replaceAll(`{${k}}`, String(v ?? ""))
      }
      return text
    },
    [t],
  )

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Active tab: 'pending' (Cần đánh giá) | 'submitted' (Lịch sử của tôi)
  const [activeTab, setActiveTab] = useState("pending")

  // Dữ liệu thực từ API (buổi học, điểm danh, đánh giá đã gửi)
  const [apiEnrollments, setApiEnrollments] = useState([])
  const [apiSessions, setApiSessions] = useState([])
  const [apiAttendances, setApiAttendances] = useState([])
  const [apiFeedbackMap, setApiFeedbackMap] = useState({})
  const [localMetaMap, setLocalMetaMap] = useState(() =>
    readStoredFeedbackMeta(),
  )
  const [isLoadingApi, setIsLoadingApi] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)

  // Bộ lọc ở tab "Lịch sử của tôi"
  const [selectedCourseFilter, setSelectedCourseFilter] = useState("all")
  const [selectedTimeFilter, setSelectedTimeFilter] = useState("all")

  // Trạng thái Ngăn chấm điểm (Drawer)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeSessionForReview, setActiveSessionForReview] = useState(null)
  const [editingFeedbackId, setEditingFeedbackId] = useState(null)
  const [isEditingWithoutLocalMeta, setIsEditingWithoutLocalMeta] =
    useState(false)
  const [isThankYouMode, setIsThankYouMode] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  // Trạng thái biểu mẫu chấm điểm (Tiêu chí thành phần KHÔNG mặc định 5/5 ngầm)
  const [overallRating, setOverallRating] = useState(0)
  const [coachCriteria, setCoachCriteria] = useState({
    expertise: null,
    interaction: null,
    punctuality: null,
  })
  const [facilityCriteria, setFacilityCriteria] = useState({
    court: null,
    lighting: null,
    cleanliness: null,
  })
  const [customTouchedCriteria, setCustomTouchedCriteria] = useState({})
  const [selectedTags, setSelectedTags] = useState([])
  const [commentText, setCommentText] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isPrivateContactRequested, setIsPrivateContactRequested] =
    useState(false)

  // Mở rộng/thu gọn nhận xét dài & chi tiết tiêu chí ở tab "Lịch sử của tôi"
  const [expandedComments, setExpandedComments] = useState({})
  const [expandedBreakdowns, setExpandedBreakdowns] = useState({})

  // Khóa cuộn & phím ESC cho Drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && drawerOpen && !isSubmitting) {
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
  }, [drawerOpen, isSubmitting])

  // Xác định hội viên hiện tại
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
      null
    )
  }, [members, currentUser])

  const resolvedMemberId = useMemo(() => {
    const rawId =
      getAuthoritativeProfileId(currentUser) ??
      currentUser?.memberId ??
      currentUser?.id ??
      member?.id
    const num = Number(rawId)
    return Number.isInteger(num) && num > 0 ? num : rawId
  }, [currentUser, member])

  // Tải đồng bộ dữ liệu khóa học, lịch buổi tập, điểm danh và đánh giá từ API thật
  const fetchBackendFeedbackData = useCallback(async () => {
    if (!apiEnabled || !resolvedMemberId) {
      setLastUpdatedAt(new Date())
      return
    }
    setIsLoadingApi(true)
    try {
      const [enrollmentsRes, sessionsRes, attendancesRes] = await Promise.all([
        getMemberClasses(resolvedMemberId).catch(() => []),
        getClassSessions().catch(() => []),
        getMemberAttendances(resolvedMemberId).catch(() => []),
      ])

      const validEnrollments = (
        Array.isArray(enrollmentsRes) ? enrollmentsRes : []
      ).filter(
        (row) =>
          !["cancelled", "canceled", "dropped", "rejected"].includes(
            String(row?.status || row?.enrollmentStatus || "").toLowerCase(),
          ) && !isLegacyStrengthClass(row),
      )
      const sessionList = Array.isArray(sessionsRes) ? sessionsRes : []
      const attendanceList = Array.isArray(attendancesRes)
        ? attendancesRes
        : []

      // Tập hợp tất cả classId của hội viên để lấy đánh giá đã gửi từ API
      const classIdSet = new Set()
      validEnrollments.forEach((item) => {
        const cid = item?.classId ?? item?.id
        if (cid != null && !Number.isNaN(Number(cid)) && Number(cid) > 0) {
          classIdSet.add(String(Number(cid)))
        }
      })
      attendanceList.forEach((rec) => {
        const cid = rec?.classId
        if (cid != null && !Number.isNaN(Number(cid)) && Number(cid) > 0) {
          classIdSet.add(String(Number(cid)))
        }
      })

      const feedbackMap = {}
      await Promise.all(
        [...classIdSet].map(async (cidStr) => {
          try {
            const fb = await getMyClassFeedback(Number(cidStr))
            if (fb) {
              feedbackMap[cidStr] = fb
            }
          } catch {
            // 404 khi chưa có đánh giá cho lớp này
          }
        }),
      )

      if (mountedRef.current) {
        setApiEnrollments(validEnrollments)
        setApiSessions(sessionList)
        setApiAttendances(attendanceList)
        setApiFeedbackMap(feedbackMap)
        setLocalMetaMap(readStoredFeedbackMeta())
        setLastUpdatedAt(new Date())
      }
    } catch (error) {
      console.warn("Error loading feedback data from API:", error)
    } finally {
      if (mountedRef.current) {
        setIsLoadingApi(false)
      }
    }
  }, [apiEnabled, resolvedMemberId])

  useEffect(() => {
    fetchBackendFeedbackData()
  }, [fetchBackendFeedbackData])

  const nowMs = Date.now()
  const todayIso = getTodayIsoInVn(nowMs)

  // Chuẩn hóa dữ liệu cấp KHÓA HỌC (đồng bộ hợp đồng API: mỗi hội viên 1 đánh giá cho mỗi lớp/khóa)
  // Dùng chung nguồn buổi học & bản ghi điểm danh với trang Điểm danh và Lịch học
  const {
    attendedSessions,
    attendedCoursesCount,
    pendingCourses,
    submittedReviews,
    enrolledCoursesList,
  } = useMemo(() => {
    const classLookup = new Map(
      (Array.isArray(classes) ? classes : []).map((c) => [String(c.id), c]),
    )
    const enrollmentByClassId = new Map()
    for (const row of apiEnrollments) {
      const cid = row?.classId ?? row?.id
      if (cid != null) {
        enrollmentByClassId.set(String(cid), row)
      }
    }

    // 1. Thu thập toàn bộ buổi tập của hội viên giống hệt MemberCheckinView & MemberScheduleView
    const collectedSessions = []
    const seenSessionKeys = new Set()

    const pushNormalizedSession = (norm) => {
      if (!norm || !norm.sessionDate) return
      const key =
        norm.id != null
          ? `id:${norm.id}`
          : `cls:${norm.classId || "pt"}:${norm.sessionDate}:${norm.startTime || ""}`
      if (seenSessionKeys.has(key)) return
      seenSessionKeys.add(key)
      collectedSessions.push(norm)
    }

    for (const row of apiEnrollments) {
      const matchedClass =
        row.classId != null ? classLookup.get(String(row.classId)) : null
      const fallbackMeta = {
        ...matchedClass,
        ...row,
        classId: row.classId ?? row.id,
        className:
          row.className || matchedClass?.name || matchedClass?.nameVi || null,
        coachId: row.coachId ?? matchedClass?.coachId ?? null,
        coachName:
          row.coachName || matchedClass?.coachName || matchedClass?.coach || null,
        roomName:
          row.roomName ||
          matchedClass?.roomName ||
          matchedClass?.roomVi ||
          matchedClass?.room ||
          null,
      }

      const inline =
        row.sessions || row.classSessions || row.scheduledSessions
      const rawList =
        Array.isArray(inline) && inline.length > 0
          ? inline
          : fallbackMeta.classId != null
            ? apiSessions.filter(
                (s) =>
                  String(s.classId) === String(fallbackMeta.classId) &&
                  s.isPrivate !== true,
              )
            : []

      for (const rawSession of rawList) {
        const norm = normalizeScheduleSession(rawSession, fallbackMeta)
        if (norm) pushNormalizedSession(norm)
      }
    }

    // Thêm các buổi PT 1-kèm-1 của hội viên
    if (resolvedMemberId != null) {
      for (const rawPt of apiSessions) {
        if (
          rawPt?.isPrivate === true &&
          String(rawPt.bookedMemberId) === String(resolvedMemberId)
        ) {
          const norm = normalizeScheduleSession(rawPt)
          if (norm) pushNormalizedSession(norm)
        }
      }
    }

    // Bổ sung các buổi có trong lịch sử điểm danh của hội viên nhưng chưa nằm trong danh sách buổi lịch học (nếu có)
    for (const rec of apiAttendances) {
      const alreadyMatched = findSessionAttendanceRecord(
        {
          id: rec.sessionId,
          classId: rec.classId,
          sessionDate: String(rec.sessionDate || rec.checkInTime || "").slice(
            0,
            10,
          ),
        },
        collectedSessions.map((s) => ({
          sessionId: s.id,
          classId: s.classId,
          sessionDate: s.sessionDate,
        })),
      )
      if (!alreadyMatched) {
        const dateIso = String(rec.sessionDate || rec.checkInTime || "").slice(
          0,
          10,
        )
        if (dateIso) {
          const enrollmentFallback =
            rec.classId != null
              ? enrollmentByClassId.get(String(rec.classId)) ||
                classLookup.get(String(rec.classId)) ||
                {}
              : {}
          const norm = normalizeScheduleSession(
            {
              id:
                rec.sessionId ??
                `att-session-${rec.attendanceId || rec.id || dateIso}`,
              classId: rec.classId ?? enrollmentFallback.classId ?? null,
              className:
                rec.className ||
                enrollmentFallback.className ||
                enrollmentFallback.name ||
                null,
              coachId: rec.coachId ?? enrollmentFallback.coachId ?? null,
              coachName:
                rec.coachName ||
                enrollmentFallback.coachName ||
                enrollmentFallback.coach ||
                null,
              roomName:
                rec.roomName ||
                rec.roomLocation ||
                rec.room ||
                enrollmentFallback.roomName ||
                enrollmentFallback.room ||
                null,
              sessionDate: dateIso,
              startTime:
                rec.startTime ||
                rec.sessionStartTime ||
                enrollmentFallback.startTime ||
                null,
              endTime:
                rec.endTime ||
                rec.sessionEndTime ||
                enrollmentFallback.endTime ||
                null,
              status: "Completed",
            },
            enrollmentFallback,
          )
          if (norm) pushNormalizedSession(norm)
        }
      }
    }

    // 2. Lọc ra các buổi ĐÃ THAM GIA (attendedSessions):
    // - Không bị hủy
    // - Đã diễn ra (sessionDate < todayIso hoặc trong ngày hôm nay và đã bắt đầu/kết thúc hoặc completed)
    // - Điểm danh của hội viên là Có mặt ('present') hoặc Đến muộn ('late')
    const attended = []
    for (const session of collectedSessions) {
      if (isSessionCancelled(session)) continue
      if (!session.sessionDate || session.sessionDate > todayIso) continue

      const attendanceRecord = findSessionAttendanceRecord(
        session,
        apiAttendances,
      )
      const stateKey = attendanceRecord
        ? normalizeAttendanceStateKey(
            attendanceRecord.state || attendanceRecord.status,
          )
        : "pending"

      if (stateKey !== "present" && stateKey !== "late") continue

      const hasTakenPlace =
        session.sessionDate < todayIso ||
        String(session.rawStatus || "").toLowerCase() === "completed" ||
        (session.sessionDate === todayIso &&
          ((session.endMs !== null && session.endMs <= nowMs) ||
            (session.startMs !== null && session.startMs <= nowMs) ||
            stateKey === "present" ||
            stateKey === "late"))

      if (!hasTakenPlace) continue

      const matchedClass =
        session.classId != null
          ? classLookup.get(String(session.classId))
          : null
      const enrollmentRow =
        session.classId != null
          ? enrollmentByClassId.get(String(session.classId))
          : null

      const resolvedClassName =
        session.className ||
        enrollmentRow?.className ||
        matchedClass?.name ||
        (session.isPrivate
          ? t("schedulePtDefaultTitle")
          : session.subjectName || `#${session.classId}`)
      const resolvedCoachName =
        session.coachName ||
        enrollmentRow?.coachName ||
        matchedClass?.coachName ||
        matchedClass?.coach ||
        t("feedbackCoachTbd")
      const resolvedCoachId =
        session.coachId ??
        enrollmentRow?.coachId ??
        matchedClass?.coachId ??
        1
      const resolvedRoomName =
        session.roomName ||
        session.roomLocation ||
        enrollmentRow?.roomName ||
        matchedClass?.roomName ||
        matchedClass?.roomVi ||
        matchedClass?.room ||
        t("feedbackRoomTbd")

      const sessionKey =
        session.id != null
          ? `session-${session.id}`
          : `class-${session.classId || "pt"}-${session.sessionDate}-${session.startTime || ""}`

      attended.push({
        ...session,
        id: session.id ?? sessionKey,
        sessionKey,
        classId: session.classId,
        coachId: resolvedCoachId,
        className: resolvedClassName,
        coachName: resolvedCoachName,
        roomName: resolvedRoomName,
        sessionDate: session.sessionDate,
        startTime: session.startTime,
        endTime: session.endTime,
        attendanceStateKey: stateKey,
      })
    }

    // Sắp xếp buổi đã tham gia mới nhất lên đầu
    attended.sort((a, b) => {
      const dateCmp = String(b.sessionDate || "").localeCompare(
        String(a.sessionDate || ""),
      )
      if (dateCmp !== 0) return dateCmp
      return String(b.startTime || "").localeCompare(String(a.startTime || ""))
    })

    // 3. Gom nhóm theo KHÓA HỌC (Course/Class) để đồng bộ hợp đồng API 1 đánh giá / 1 khóa
    const courseGroupMap = new Map()

    for (const session of attended) {
      const courseKey =
        session.classId != null
          ? String(session.classId)
          : `pt-${session.sessionKey}`
      const existingGroup = courseGroupMap.get(courseKey)
      if (!existingGroup) {
        const enrollmentRow =
          session.classId != null
            ? enrollmentByClassId.get(String(session.classId))
            : null
        const matchedClass =
          session.classId != null
            ? classLookup.get(String(session.classId))
            : null
        const remainingDeadlineDays = evaluateCourseFeedbackDeadline(
          enrollmentRow,
          matchedClass,
          todayIso,
        )

        courseGroupMap.set(courseKey, {
          courseKey,
          classId: session.classId ?? session.id,
          coachId: session.coachId,
          className: session.className,
          coachName: session.coachName,
          roomName: session.roomName,
          attendedSessionCount: 1,
          latestSession: session,
          remainingDeadlineDays,
        })
      } else {
        existingGroup.attendedSessionCount += 1
      }
    }

    // Bổ sung khóa đã có bản ghi đánh giá trên API (nếu danh sách điểm danh chưa kịp trả về buổi tương ứng)
    // để hệ thức Chờ đánh giá + Đã gửi = Khóa đã tham gia luôn đúng với mọi dữ liệu
    for (const [classIdStr, apiFb] of Object.entries(apiFeedbackMap)) {
      if (!apiFb || courseGroupMap.has(classIdStr)) continue
      const enrollmentRow = enrollmentByClassId.get(classIdStr)
      const matchedClass = classLookup.get(classIdStr)
      const classSessions = collectedSessions.filter(
        (s) => String(s.classId) === classIdStr && !isSessionCancelled(s),
      )
      const latestPastSession =
        [...classSessions]
          .reverse()
          .find((s) => s.sessionDate && s.sessionDate <= todayIso) ||
        classSessions[0] ||
        null

      courseGroupMap.set(classIdStr, {
        courseKey: classIdStr,
        classId: Number(classIdStr) || classIdStr,
        coachId:
          apiFb.coachId ??
          enrollmentRow?.coachId ??
          matchedClass?.coachId ??
          1,
        className:
          latestPastSession?.className ||
          enrollmentRow?.className ||
          matchedClass?.name ||
          `#${classIdStr}`,
        coachName:
          latestPastSession?.coachName ||
          enrollmentRow?.coachName ||
          matchedClass?.coachName ||
          t("feedbackCoachTbd"),
        roomName:
          latestPastSession?.roomName ||
          enrollmentRow?.roomName ||
          matchedClass?.roomName ||
          t("feedbackRoomTbd"),
        attendedSessionCount: 0,
        latestSession: latestPastSession,
        remainingDeadlineDays: evaluateCourseFeedbackDeadline(
          enrollmentRow,
          matchedClass,
          todayIso,
        ),
      })
    }

    const memberScope = String(resolvedMemberId || "anon")
    const memberContextFeedbacks = !apiEnabled
      ? (Array.isArray(feedbacks) ? feedbacks : []).filter(
          (f) => String(f.memberId) === String(resolvedMemberId),
        )
      : []

    if (!apiEnabled) {
      for (const ctxFb of memberContextFeedbacks) {
        const cidStr =
          ctxFb.classId != null ? String(ctxFb.classId) : String(ctxFb.id)
        if (!courseGroupMap.has(cidStr)) {
          courseGroupMap.set(cidStr, {
            courseKey: cidStr,
            classId: ctxFb.classId ?? ctxFb.id,
            coachId: ctxFb.coachId || 1,
            className: ctxFb.className || `#${cidStr}`,
            coachName: ctxFb.coachName || t("feedbackCoachTbd"),
            roomName: ctxFb.room || t("feedbackRoomTbd"),
            attendedSessionCount: 1,
            latestSession: null,
            remainingDeadlineDays: null,
          })
        }
      }
    }

    // 4. Phân hoạch tập khóa đã tham gia thành 2 tập rời nhau:
    //    - submittedReviews (khóa đã có đánh giá)
    //    - pendingCourses (khóa chưa có đánh giá)
    //    Đảm bảo: pendingCourses.length + submittedReviews.length === attendedCoursesCount
    const pending = []
    const submitted = []

    for (const course of courseGroupMap.values()) {
      const classIdStr = String(course.courseKey)
      const apiFb = apiEnabled ? apiFeedbackMap[classIdStr] || null : null
      const ctxFb = !apiEnabled
        ? memberContextFeedbacks.find(
            (f) => String(f.classId ?? f.id) === classIdStr,
          ) || null
        : null
      const metaSource =
        localMetaMap[`${memberScope}:class:${classIdStr}`] || null

      const hasReview = apiEnabled
        ? Boolean(apiFb)
        : Boolean(ctxFb || metaSource)

      if (hasReview) {
        const rawSource = apiFb || ctxFb || {}
        const apiCoachRating = Number(rawSource.coachRating) || null
        const apiClassRating = Number(rawSource.classRating) || null

        const hasLocalMetadata = Boolean(
          (metaSource &&
            metaSource.coachBreakdown &&
            metaSource.facilityBreakdown) ||
            (rawSource.criteria?.coachBreakdown &&
              rawSource.criteria?.facilityBreakdown),
        )

        const derivedOverall =
          (hasLocalMetadata ? Number(metaSource?.overallRating) : 0) ||
          Number(rawSource.overallRating) ||
          Number(rawSource.rating) ||
          (apiCoachRating && apiClassRating
            ? Math.round((apiCoachRating + apiClassRating) / 2)
            : apiCoachRating || apiClassRating || 5)

        const savedCoachBd =
          metaSource?.coachBreakdown ||
          rawSource.criteria?.coachBreakdown ||
          null
        const savedFacilityBd =
          metaSource?.facilityBreakdown ||
          rawSource.criteria?.facilityBreakdown ||
          null
        const hasSubcriteriaData = [
          savedCoachBd?.expertise, savedCoachBd?.interaction, savedCoachBd?.punctuality,
          savedFacilityBd?.court, savedFacilityBd?.lighting, savedFacilityBd?.cleanliness,
        ].some((value) => Number(value) > 0)

        const criteria = hasLocalMetadata
          ? {
              coachBreakdown: {
                expertise:
                  Number(savedCoachBd?.expertise) ||
                  apiCoachRating ||
                  derivedOverall,
                interaction:
                  Number(savedCoachBd?.interaction) ||
                  apiCoachRating ||
                  derivedOverall,
                punctuality:
                  Number(savedCoachBd?.punctuality) ||
                  apiCoachRating ||
                  derivedOverall,
              },
              facilityBreakdown: {
                court:
                  Number(savedFacilityBd?.court) ||
                  apiClassRating ||
                  derivedOverall,
                lighting:
                  Number(savedFacilityBd?.lighting) ||
                  apiClassRating ||
                  derivedOverall,
                cleanliness:
                  Number(savedFacilityBd?.cleanliness) ||
                  apiClassRating ||
                  derivedOverall,
              },
              customTouchedCriteria: metaSource?.customTouchedCriteria || {},
            }
          : null

        const rawTags = hasLocalMetadata
          ? Array.isArray(metaSource?.tags) && metaSource.tags.length > 0
            ? metaSource.tags
            : Array.isArray(rawSource.tags)
              ? rawSource.tags
              : []
          : Array.isArray(rawSource.tags)
            ? rawSource.tags
            : []
        const normalizedTags = rawTags.map(normalizeTagCode).filter(Boolean)

        // Ngày gửi thật từ API (không dùng giờ mặc định hay ngày buổi học)
        const rawApiSubmittedDate =
          rawSource.createdAt ??
          rawSource.submittedAt ??
          rawSource.updatedAt ??
          rawSource.feedbackDate ??
          (!apiEnabled ? rawSource.date : null) ??
          null
        const submittedDateIso = rawApiSubmittedDate
          ? String(rawApiSubmittedDate).slice(0, 10)
          : null
        const submittedDateFormatted = submittedDateIso
          ? toDateDdMmYyyy(submittedDateIso)
          : null

        const realReply = sanitizeRealCoachReply(
          rawSource.coachReply || rawSource.replyText || rawSource.response,
        )
        const replyAuthor =
          rawSource.repliedByName ||
          rawSource.coachReplyAuthor ||
          course.coachName
        const replyDate =
          rawSource.repliedAt || rawSource.coachReplyDate || null

        submitted.push({
          id:
            rawSource.feedbackId ||
            rawSource.id ||
            metaSource?.feedbackId ||
            `fb-${classIdStr}`,
          courseKey: course.courseKey,
          classId: course.classId,
          coachId: course.coachId,
          className: course.className,
          coachName: course.coachName,
          roomName: course.roomName,
          attendedSessionCount: course.attendedSessionCount,
          latestSession: course.latestSession,
          rating: derivedOverall,
          overallRating: derivedOverall,
          coachRating: apiCoachRating || derivedOverall,
          classRating: apiClassRating || derivedOverall,
          hasLocalMetadata,
          hasSubcriteriaData,
          criteria,
          tags: normalizedTags,
          comment: String(
            rawSource.comment !== undefined && rawSource.comment !== null
              ? rawSource.comment
              : metaSource?.comment || "",
          )
            .replace(/\bDEMO\b\s*/gi, "")
            .trim()
            .replace(/^./u, (letter) => letter.toLocaleUpperCase("vi")),
          isAnonymous: hasLocalMetadata
            ? Boolean(metaSource?.isAnonymous ?? rawSource.isAnonymous)
            : Boolean(rawSource.isAnonymous),
          isPrivateContactRequested: hasLocalMetadata
            ? Boolean(
                metaSource?.isPrivateContactRequested ??
                  rawSource.isPrivateContactRequested,
              )
            : Boolean(rawSource.isPrivateContactRequested),
          coachReply: realReply,
          coachReplyAuthor: realReply ? replyAuthor : null,
          coachReplyDate: realReply ? replyDate : null,
          submittedDateIso,
          submittedDateFormatted,
          courseMeta: course,
        })
      } else {
        pending.push(course)
      }
    }

    // Danh sách khóa học thật của hội viên để hiển thị bộ lọc ở tab "Lịch sử của tôi"
    const courseFilterMap = new Map()
    for (const row of apiEnrollments) {
      const cid = row?.classId ?? row?.id
      const cname = row?.className || row?.name
      if (cid != null && cname) {
        courseFilterMap.set(String(cid), {
          classId: String(cid),
          className: cname,
        })
      }
    }
    for (const c of courseGroupMap.values()) {
      if (c.classId != null && c.className) {
        courseFilterMap.set(String(c.classId), {
          classId: String(c.classId),
          className: c.className,
        })
      }
    }

    return {
      attendedSessions: attended,
      attendedCoursesCount: pending.length + submitted.length,
      pendingCourses: pending,
      submittedReviews: submitted,
      enrolledCoursesList: [...courseFilterMap.values()],
    }
  }, [
    apiEnrollments,
    apiSessions,
    apiAttendances,
    apiFeedbackMap,
    localMetaMap,
    classes,
    feedbacks,
    apiEnabled,
    resolvedMemberId,
    todayIso,
    nowMs,
    t,
  ])

  // Điểm trung bình từ các đánh giá đã gửi
  const averageRating = useMemo(() => {
    if (submittedReviews.length === 0) return "—"
    const sum = submittedReviews.reduce(
      (acc, r) => acc + (Number(r.overallRating || r.rating) || 5),
      0,
    )
    return (sum / submittedReviews.length).toFixed(1)
  }, [submittedReviews])

  // Lọc danh sách ở tab "Lịch sử của tôi" theo mã khóa học (classId) và thời gian (dùng todayIso thực tế)
  const filteredSubmittedReviews = useMemo(() => {
    return submittedReviews.filter((r) => {
      if (selectedCourseFilter !== "all") {
        if (String(r.classId) !== String(selectedCourseFilter)) {
          return false
        }
      }
      const filterDateIso =
        r.submittedDateIso || r.latestSession?.sessionDate || null
      if (selectedTimeFilter !== "all" && filterDateIso) {
        const diffDays = diffCalendarDaysInVn(filterDateIso, todayIso)
        if (diffDays !== null) {
          if (selectedTimeFilter === "30days" && diffDays > 30) return false
          if (selectedTimeFilter === "semester" && diffDays > 120) return false
        }
      }
      return true
    })
  }, [submittedReviews, selectedCourseFilter, selectedTimeFilter, todayIso])

  // Chọn mức sao tổng quát N:
  // - Gợi ý các tiêu chí thành phần = N cho những mục người dùng chưa tự chỉnh
  // - Những mục người dùng đã tự chỉnh (customTouchedCriteria[key] === true) KHÔNG bị ghi đè
  const handleSelectOverallRating = (level) => {
    setOverallRating(level)
    if (!isEditingWithoutLocalMeta) {
      setCoachCriteria((prev) => ({
        expertise: customTouchedCriteria.expertise ? prev.expertise : level,
        interaction: customTouchedCriteria.interaction
          ? prev.interaction
          : level,
        punctuality: customTouchedCriteria.punctuality
          ? prev.punctuality
          : level,
      }))
      setFacilityCriteria((prev) => ({
        court: customTouchedCriteria.court ? prev.court : level,
        lighting: customTouchedCriteria.lighting ? prev.lighting : level,
        cleanliness: customTouchedCriteria.cleanliness
          ? prev.cleanliness
          : level,
      }))
    }
  }

  const handleSelectCoachCriterion = (key, pt) => {
    setCustomTouchedCriteria((prev) => ({ ...prev, [key]: true }))
    setCoachCriteria((prev) => ({ ...prev, [key]: pt }))
  }

  const handleSelectFacilityCriterion = (key, pt) => {
    setCustomTouchedCriteria((prev) => ({ ...prev, [key]: true }))
    setFacilityCriteria((prev) => ({ ...prev, [key]: pt }))
  }

  // Mở Ngăn chấm điểm (tạo mới cho khóa học hoặc chỉnh sửa đánh giá đã gửi)
  const handleOpenReviewDrawer = (courseOrReview, existingFeedback = null) => {
    setActiveSessionForReview(
      existingFeedback
        ? { ...courseOrReview, ...existingFeedback }
        : courseOrReview,
    )
    setSubmitError(null)
    setIsThankYouMode(false)

    if (existingFeedback) {
      const baseOverall =
        Number(existingFeedback.overallRating || existingFeedback.rating) || 5
      setEditingFeedbackId(existingFeedback.id)
      setOverallRating(baseOverall)
      setCommentText(existingFeedback.comment || "")

      if (existingFeedback.hasLocalMetadata && existingFeedback.criteria) {
        setIsEditingWithoutLocalMeta(false)
        const baseCoach = Number(existingFeedback.coachRating) || baseOverall
        const baseClass = Number(existingFeedback.classRating) || baseOverall
        const savedCoachBd = existingFeedback.criteria.coachBreakdown
        const savedFacilityBd = existingFeedback.criteria.facilityBreakdown
        const nextCoachCriteria = {
          expertise: Number(savedCoachBd?.expertise) || baseCoach,
          interaction: Number(savedCoachBd?.interaction) || baseCoach,
          punctuality: Number(savedCoachBd?.punctuality) || baseCoach,
        }
        const nextFacilityCriteria = {
          court: Number(savedFacilityBd?.court) || baseClass,
          lighting: Number(savedFacilityBd?.lighting) || baseClass,
          cleanliness: Number(savedFacilityBd?.cleanliness) || baseClass,
        }
        const savedTouched =
          existingFeedback.criteria.customTouchedCriteria || {}

        setCoachCriteria(nextCoachCriteria)
        setFacilityCriteria(nextFacilityCriteria)
        setCustomTouchedCriteria({
          expertise:
            Boolean(savedTouched.expertise) ||
            nextCoachCriteria.expertise !== baseOverall,
          interaction:
            Boolean(savedTouched.interaction) ||
            nextCoachCriteria.interaction !== baseOverall,
          punctuality:
            Boolean(savedTouched.punctuality) ||
            nextCoachCriteria.punctuality !== baseOverall,
          court:
            Boolean(savedTouched.court) ||
            nextFacilityCriteria.court !== baseOverall,
          lighting:
            Boolean(savedTouched.lighting) ||
            nextFacilityCriteria.lighting !== baseOverall,
          cleanliness:
            Boolean(savedTouched.cleanliness) ||
            nextFacilityCriteria.cleanliness !== baseOverall,
        })
        setSelectedTags(
          (existingFeedback.tags || []).map(normalizeTagCode).filter(Boolean),
        )
        setIsAnonymous(Boolean(existingFeedback.isAnonymous))
        setIsPrivateContactRequested(
          Boolean(existingFeedback.isPrivateContactRequested),
        )
      } else {
        // Đánh giá không có metadata trong localStorage: hiển thị gọn điểm tổng và nhận xét, ẩn tiêu chí & thẻ
        setIsEditingWithoutLocalMeta(true)
        setCoachCriteria({
          expertise: null,
          interaction: null,
          punctuality: null,
        })
        setFacilityCriteria({
          court: null,
          lighting: null,
          cleanliness: null,
        })
        setCustomTouchedCriteria({})
        setSelectedTags([])
        setIsAnonymous(false)
        setIsPrivateContactRequested(false)
      }
    } else {
      setEditingFeedbackId(null)
      setIsEditingWithoutLocalMeta(false)
      setOverallRating(0)
      setCoachCriteria({
        expertise: null,
        interaction: null,
        punctuality: null,
      })
      setFacilityCriteria({
        court: null,
        lighting: null,
        cleanliness: null,
      })
      setCustomTouchedCriteria({})
      setSelectedTags([])
      setCommentText("")
      setIsAnonymous(false)
      setIsPrivateContactRequested(false)
    }

    setDrawerOpen(true)
  }

  // Bật/tắt thẻ nhận định nhanh theo mã
  const handleToggleTag = (tagCode) => {
    setSelectedTags((prev) =>
      prev.includes(tagCode)
        ? prev.filter((item) => item !== tagCode)
        : [...prev, tagCode],
    )
  }

  // Gửi đánh giá từ Ngăn chấm điểm (theo khóa/lớp)
  const handleSubmitReview = async () => {
    if (!overallRating || overallRating === 0 || !activeSessionForReview) return
    if (overallRating <= 2 && !commentText.trim()) {
      setSubmitError(t("feedbackDrawerLowRatingCommentError"))
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const targetClassId =
        activeSessionForReview.classId ?? activeSessionForReview.id
      const targetCoachId = activeSessionForReview.coachId || 1

      const prevOverall =
        Number(
          activeSessionForReview.overallRating || activeSessionForReview.rating,
        ) || overallRating
      let avgCoach =
        isEditingWithoutLocalMeta && overallRating === prevOverall
          ? Number(activeSessionForReview.coachRating) || overallRating
          : overallRating
      let avgClass =
        isEditingWithoutLocalMeta && overallRating === prevOverall
          ? Number(activeSessionForReview.classRating) || overallRating
          : overallRating
      let effectiveCoachCriteria = null
      let effectiveFacilityCriteria = null

      if (!isEditingWithoutLocalMeta) {
        effectiveCoachCriteria = {
          expertise: coachCriteria.expertise ?? overallRating,
          interaction: coachCriteria.interaction ?? overallRating,
          punctuality: coachCriteria.punctuality ?? overallRating,
        }
        effectiveFacilityCriteria = {
          court: facilityCriteria.court ?? overallRating,
          lighting: facilityCriteria.lighting ?? overallRating,
          cleanliness: facilityCriteria.cleanliness ?? overallRating,
        }

        avgCoach = Math.min(
          5,
          Math.max(
            1,
            Math.round(
              (effectiveCoachCriteria.expertise +
                effectiveCoachCriteria.interaction +
                effectiveCoachCriteria.punctuality) /
                3,
            ) || overallRating,
          ),
        )
        avgClass = Math.min(
          5,
          Math.max(
            1,
            Math.round(
              (effectiveFacilityCriteria.court +
                effectiveFacilityCriteria.lighting +
                effectiveFacilityCriteria.cleanliness) /
                3,
            ) || overallRating,
          ),
        )
      }

      if (apiEnabled) {
        const parsedClassId = Number(targetClassId)
        const parsedCoachId = Number(targetCoachId) || 1
        let apiRes = null
        if (!Number.isNaN(parsedClassId) && parsedClassId > 0) {
          apiRes = await submitClassFeedback(parsedClassId, {
            classId: parsedClassId,
            coachId: parsedCoachId > 0 ? parsedCoachId : 1,
            classRating: avgClass,
            coachRating: avgCoach,
            comment: commentText.trim(),
          })
          setApiFeedbackMap((prev) => ({
            ...prev,
            [String(parsedClassId)]: apiRes || {
              ...prev[String(parsedClassId)],
              classId: parsedClassId,
              coachId: parsedCoachId,
              classRating: avgClass,
              coachRating: avgCoach,
              comment: commentText.trim(),
            },
          }))
        }

        if (!isEditingWithoutLocalMeta && targetClassId != null) {
          const memberScope = String(resolvedMemberId || "anon")
          const metaEntry = {
            feedbackId:
              apiRes?.feedbackId ||
              apiRes?.id ||
              editingFeedbackId ||
              `fb-${targetClassId}`,
            classId: targetClassId,
            coachId: targetCoachId,
            className: activeSessionForReview.className,
            coachName: activeSessionForReview.coachName,
            roomName: activeSessionForReview.roomName,
            overallRating,
            coachRating: avgCoach,
            classRating: avgClass,
            coachBreakdown: effectiveCoachCriteria,
            facilityBreakdown: effectiveFacilityCriteria,
            customTouchedCriteria,
            tags: selectedTags,
            comment: commentText.trim(),
            isAnonymous,
            isPrivateContactRequested,
          }
          const nextMeta = {
            ...readStoredFeedbackMeta(),
            [`${memberScope}:class:${targetClassId}`]: metaEntry,
          }
          writeStoredFeedbackMeta(nextMeta)
          setLocalMetaMap(nextMeta)
        }

        await fetchBackendFeedbackData()
        showToast?.(
          editingFeedbackId
            ? t("feedbackToastUpdated")
            : t("feedbackToastSubmitted"),
          "success",
        )
      } else {
        await submitFeedback({
          id: editingFeedbackId || `fb-${targetClassId}`,
          classId: targetClassId,
          coachId: targetCoachId,
          className: activeSessionForReview.className,
          coachName: activeSessionForReview.coachName,
          memberId: resolvedMemberId,
          memberName: member?.name,
          rating: overallRating,
          overallRating,
          classRating: avgClass,
          coachRating: avgCoach,
          room: activeSessionForReview.roomName,
          criteria: effectiveCoachCriteria
            ? {
                coachQuality: avgCoach,
                facilityQuality: avgClass,
                coachBreakdown: effectiveCoachCriteria,
                facilityBreakdown: effectiveFacilityCriteria,
                customTouchedCriteria,
              }
            : null,
          tags: selectedTags,
          comment: commentText.trim(),
          isAnonymous,
          isPrivateContactRequested,
        })
      }

      setIsThankYouMode(true)
    } catch (err) {
      setSubmitError(
        getErrorMessage(err, t("feedbackDrawerSubmitErrorDefault")),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleCommentExpand = (id) => {
    setExpandedComments((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleBreakdownExpand = (id) => {
    setExpandedBreakdowns((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <main
      className="w-full space-y-6 px-6 py-6 font-['Be_Vietnam_Pro',sans-serif]"
    >
      {/* 1. HEADER */}
      {!embedded && (
        <PageHeader
          title={t("feedbackPageTitle")}
          description={t("feedbackPageSubtitle")}
          actions={
            <div className="flex items-center gap-2">
              {lastUpdatedAt && (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">
                  {tr("feedbackUpdatedAt", { time: TIME_FORMATTER_HHMM.format(lastUpdatedAt) })}
                </span>
              )}
              <button
                type="button"
                onClick={fetchBackendFeedbackData}
                disabled={isLoadingApi}
                aria-label={t("feedbackBtnRefresh")}
                title={t("feedbackBtnRefresh")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingApi ? "animate-spin" : ""}`} />
                <span>{t("feedbackBtnRefresh")}</span>
              </button>
            </div>
          }
        />
      )}

      {/* 2. DẢI CHỈ SỐ: 4 Thẻ cùng đơn vị là KHÓA (Chờ đánh giá + Đã gửi = Khóa đã tham gia) */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Cột 1: Chờ đánh giá (số khóa chưa có đánh giá) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3"><span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><ClipboardList className="h-5 w-5" /></span><div><span className="block text-xs font-semibold text-slate-500">{t("feedbackKpiPending")}</span><div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{pendingCourses.length}</div></div></div>
        </div>

        {/* Cột 2: Đã gửi (số khóa đã có đánh giá) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3"><span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></span><div><span className="block text-xs font-semibold text-slate-500">{t("feedbackKpiSubmitted")}</span><div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{submittedReviews.length}</div></div></div>
        </div>

        {/* Cột 3: Khóa đã tham gia (= Chờ đánh giá + Đã gửi), kèm dòng phụ N buổi có mặt */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3"><span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><CalendarDays className="h-5 w-5" /></span><div><span className="block text-xs font-semibold text-slate-500">{t("feedbackKpiAttended")}</span><div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{attendedCoursesCount}</div><div className="mt-0.5 text-[11px] text-slate-500 tabular-nums">{tr("feedbackKpiAttendedSub", { count: attendedSessions.length })}</div></div></div>
        </div>

        {/* Cột 4: Điểm bạn đã cho */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-3"><span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Star className="h-5 w-5 fill-current" /></span><div><span className="block text-xs font-semibold text-slate-500">{t("feedbackKpiAvgRating")}</span><div className="mt-1 flex items-center gap-1.5 text-2xl font-bold tabular-nums text-slate-900"><span>{averageRating}</span>{submittedReviews.length > 0 && <span className="text-sm font-medium text-slate-400">/ 5</span>}</div><div className="mt-0.5 text-[11px] text-slate-500">{submittedReviews.length > 0 ? tr("feedbackKpiAvgSub", { count: submittedReviews.length }) : t("feedbackKpiNoRating")}</div></div></div>
        </div>
      </section>

      {/* 3. TABS */}
      <div className="inline-flex w-fit max-w-full gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1 text-sm">
        <button
          type="button"
          onClick={() => setActiveTab("pending")}
          className={`rounded-xl px-4 py-2.5 font-semibold cursor-pointer transition-colors flex items-center gap-2 ${
            activeTab === "pending"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>{t("feedbackTabPending")} ({pendingCourses.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("submitted")}
          className={`rounded-xl px-4 py-2.5 font-semibold cursor-pointer transition-colors flex items-center gap-2 ${
            activeTab === "submitted"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>{t("feedbackTabSubmitted")} ({submittedReviews.length})</span>
        </button>
      </div>

      {/* 4. TAB 1: CẦN ĐÁNH GIÁ (mỗi dòng là một KHÓA) */}
      {activeTab === "pending" && (
        <div className="space-y-4">
          {pendingCourses.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h3 className="text-lg font-bold text-slate-900">
                {t("feedbackEmptyPendingTitle")}
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                {t("feedbackEmptyPendingDesc")}
              </p>
              {submittedReviews.length > 0 && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("submitted")}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {t("feedbackEmptyPendingBtnHistory")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              <AnimatePresence>
                {pendingCourses.map((course) => {
                  const latestDate = course.latestSession?.sessionDate
                    ? toDateDdMmYyyy(course.latestSession.sessionDate)
                    : null
                  const remainingDays = course.remainingDeadlineDays

                  return (
                    <motion.div
                      key={course.courseKey}
                      initial={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition-all hover:border-slate-300 sm:flex-row sm:items-center"
                    >
                      {/* Thông tin Khóa học: Tên khóa, HLV, sân, số buổi đã tham gia, buổi gần nhất */}
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">{getFeedbackSportName(course, isVi)}</span>
                          <h3 className="text-base font-bold text-slate-900">{course.className}</h3>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">{t("feedbackCoachPrefix")} {String(course.coachName || "").replace(/^HLV\s+/i, "")}</p>
                          <p className="mt-1 text-xs text-slate-500">{course.roomName || t("feedbackRoomTbd")}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 tabular-nums"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {tr("feedbackCourseAttendedCount", {
                              count: course.attendedSessionCount,
                            })}
                          </span>
                          {latestDate && <span className="text-slate-500 tabular-nums">{isVi ? "Buổi gần nhất" : "Last session"}: {latestDate}</span>}
                          {remainingDays !== null && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span
                                className={
                                  remainingDays <= 2
                                    ? "text-amber-600 font-medium"
                                    : "text-slate-500"
                                }
                              >
                                {remainingDays === 0
                                  ? t("feedbackDeadlineToday")
                                  : tr("feedbackDeadlineRemaining", {
                                      days: remainingDays,
                                    })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* CTA Button */}
                      <div className="shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenReviewDrawer(course)}
                          className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-[0.98] bg-brand-primary hover:bg-brand-primary-hover text-white shadow-xs"
                        >
                          {t("feedbackBtnWriteReview")}
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
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
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs text-slate-900 rounded-xl px-3 py-2 cursor-pointer outline-none focus:border-brand-accent"
              >
                <option value="all">{t("feedbackFilterAllCourses")}</option>
                {enrolledCoursesList.map((course) => (
                  <option key={course.classId} value={course.classId}>
                    {course.className}
                  </option>
                ))}
              </select>

              <select
                value={selectedTimeFilter}
                onChange={(e) => setSelectedTimeFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs text-slate-900 rounded-xl px-3 py-2 cursor-pointer outline-none focus:border-brand-accent"
              >
                <option value="all">{t("feedbackFilterAllTime")}</option>
                <option value="30days">{t("feedbackFilter30Days")}</option>
                <option value="semester">{t("feedbackFilterSemester")}</option>
              </select>
            </div>

            <span className="text-xs text-slate-500 font-medium">
              {tr("feedbackSubmittedCount", {
                count: filteredSubmittedReviews.length,
              })}
            </span>
          </div>

          {filteredSubmittedReviews.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
              <p className="text-lg font-bold text-slate-900">
                {t("feedbackEmptySubmittedTitle")}
              </p>
              <p className="text-xs text-slate-500">
                {t("feedbackEmptySubmittedDesc")}
              </p>
              {pendingCourses.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("pending")}
                  className="text-xs text-brand-accent-dark underline font-bold cursor-pointer"
                >
                  {t("feedbackEmptySubmittedBtnPending")}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSubmittedReviews.map((review) => {
                const isExpanded = Boolean(expandedComments[review.id])
                const isBreakdownOpen = Boolean(expandedBreakdowns[review.id])
                const overallScore =
                  Number(review.overallRating || review.rating) || 5
                const hasLocalMeta = Boolean(
                  review.hasLocalMetadata && review.criteria,
                )
                const coachBd = review.criteria?.coachBreakdown
                const facilityBd = review.criteria?.facilityBreakdown
                const hasSubcriteria = Boolean(review.hasSubcriteriaData && hasLocalMeta)
                const verdictMeta = getVerdictMeta(overallScore, t)
                const realCoachReply = sanitizeRealCoachReply(review.coachReply)
                const replyDateFormatted = review.coachReplyDate
                  ? toDateDdMmYyyy(review.coachReplyDate)
                  : null

                return (
                  <div
                    key={review.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-slate-900">
                            {review.className}
                          </h3>
                          <span className="text-slate-300">•</span>
                          <span className="text-xs text-slate-500">
                            {review.roomName || t("feedbackRoomTbd")}
                          </span>
                          {review.isAnonymous && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                              {t("feedbackBadgeAnonymous")}
                            </span>
                          )}
                          {review.isPrivateContactRequested && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              {t("feedbackBadgePrivateContact")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {t("feedbackHistoryCoachPrefix")}{" "}
                          <span className="font-medium text-slate-800">
                            {review.coachName}
                          </span>
                          {review.submittedDateFormatted && (
                            <>
                              {" "}
                              ·{" "}
                              <span className="tabular-nums">
                                {tr("feedbackSubmittedDateLabel", {
                                  date: review.submittedDateFormatted,
                                })}
                              </span>
                            </>
                          )}
                        </p>
                      </div>

                      {/* Score Badge & Nút Chỉnh sửa */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl">
                          <span className="text-amber-500 font-black text-sm">
                            ★
                          </span>
                          <span className="font-bold text-slate-900 text-sm tabular-nums">
                            {overallScore.toFixed(1)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenReviewDrawer(
                              review.courseMeta || review,
                              review,
                            )
                          }
                          className="text-xs text-brand-accent-dark hover:text-brand-primary-hover font-bold hover:underline cursor-pointer"
                        >
                          {t("feedbackBtnEdit")}
                        </button>
                      </div>
                    </div>

                    {/* Mức đánh giá & Thẻ nhận định nhanh */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {verdictMeta.label}
                      </span>

                      {hasLocalMeta && review.tags && review.tags.length > 0 && (
                        <>
                          <span className="text-slate-300">•</span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {review.tags.map((tagCode) => (
                              <span
                                key={tagCode}
                                className="text-xs px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 font-medium"
                              >
                                {getTagLabel(tagCode, t)}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Nhận xét văn bản (hiển thị tóm tắt khi đang thu gọn chi tiết) */}
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
                            className="text-xs text-brand-accent-dark hover:underline font-bold cursor-pointer block"
                          >
                            {isExpanded
                              ? t("feedbackCommentShowLess")
                              : t("feedbackCommentShowMore")}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Nút mở rộng / thu gọn chi tiết đánh giá tại chỗ */}
                    {hasSubcriteria && <div className="pt-1">
                      <button
                        type="button"
                        aria-expanded={isBreakdownOpen}
                        onClick={() => toggleBreakdownExpand(review.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 cursor-pointer transition-colors"
                      >
                        <span>
                          {isBreakdownOpen
                            ? t("feedbackBreakdownCollapse")
                            : t("feedbackBreakdownExpand")}
                        </span>
                        {isBreakdownOpen ? (
                          <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                        )}
                      </button>

                      {isBreakdownOpen && (
                        <div className="mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs">
                          {hasLocalMeta && coachBd && facilityBd ? (
                            <>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                                    {t("feedbackCriteriaCoachGroup")}
                                  </div>
                                  <div className="flex justify-between text-slate-600">
                                    <span>
                                      {t("feedbackCriteriaExpertiseShort")}
                                    </span>
                                    <span className="font-bold text-slate-900 tabular-nums">
                                      {coachBd.expertise}/5
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-slate-600">
                                    <span>
                                      {t("feedbackCriteriaInteractionShort")}
                                    </span>
                                    <span className="font-bold text-slate-900 tabular-nums">
                                      {coachBd.interaction}/5
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-slate-600">
                                    <span>
                                      {t("feedbackCriteriaPunctualityShort")}
                                    </span>
                                    <span className="font-bold text-slate-900 tabular-nums">
                                      {coachBd.punctuality}/5
                                    </span>
                                  </div>
                                </div>

                                <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-4">
                                  <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                                    {t("feedbackCriteriaFacilityGroup")}
                                  </div>
                                  <div className="flex justify-between text-slate-600">
                                    <span>{t("feedbackCriteriaCourtShort")}</span>
                                    <span className="font-bold text-slate-900 tabular-nums">
                                      {facilityBd.court}/5
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-slate-600">
                                    <span>
                                      {t("feedbackCriteriaLightingShort")}
                                    </span>
                                    <span className="font-bold text-slate-900 tabular-nums">
                                      {facilityBd.lighting}/5
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-slate-600">
                                    <span>
                                      {t("feedbackCriteriaCleanlinessShort")}
                                    </span>
                                    <span className="font-bold text-slate-900 tabular-nums">
                                      {facilityBd.cleanliness}/5
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {review.tags && review.tags.length > 0 && (
                                <div className="pt-3 border-t border-slate-200/80 flex items-center gap-2 flex-wrap">
                                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                    {t("feedbackDetailTagsLabel")}
                                  </span>
                                  {review.tags.map((tagCode) => (
                                    <span
                                      key={tagCode}
                                      className="text-xs px-2.5 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium"
                                    >
                                      {getTagLabel(tagCode, t)}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </>
                          ) : null}

                        </div>
                      )}
                    </div>}

                    {/* Khối trích dẫn phản hồi của HLV: CHỈ hiển thị khi API trả phản hồi thật */}
                    {realCoachReply && (
                      <div className="pl-4 border-l-2 border-brand-accent/60 space-y-1 pt-1">
                        <p className="text-xs text-slate-600 italic leading-relaxed">
                          “{realCoachReply}”
                        </p>
                        <span className="text-[11px] text-slate-400 block">
                          {replyDateFormatted
                            ? tr("feedbackReplyAuthorWithDate", {
                                author:
                                  review.coachReplyAuthor || review.coachName,
                                date: replyDateFormatted,
                              })
                            : tr("feedbackReplyAuthorOnly", {
                                author:
                                  review.coachReplyAuthor || review.coachName,
                              })}
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
      {/* 6. NGĂN ĐÁNH GIÁ (Slide-Over Sheet 480px)                      */}
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
                className="w-screen max-w-[480px] min-h-0 bg-white text-slate-900 shadow-2xl flex flex-col border-l border-slate-200 z-10"
                role="dialog"
                aria-modal="true"
              >
                {/* Header Drawer */}
                <div className="p-6 border-b border-slate-200 flex items-start justify-between gap-4 bg-white sticky top-0 z-10">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-accent-dark block">
                      {editingFeedbackId
                        ? t("feedbackDrawerBadgeEdit")
                        : t("feedbackDrawerBadgeNew")}
                    </span>
                    <h2 className="font-bold text-xl text-slate-900 leading-snug">
                      {activeSessionForReview.className}
                    </h2>
                    <p className="text-xs text-slate-500 font-normal">
                      {activeSessionForReview.coachName ||
                        activeSessionForReview.coach}{" "}
                      ·{" "}
                      {activeSessionForReview.roomName ||
                        activeSessionForReview.court}
                      {!editingFeedbackId &&
                        activeSessionForReview.latestSession && (
                          <>
                            {" "}
                            ·{" "}
                            <span className="tabular-nums">
                              {formatSessionDateTimeSlot(
                                activeSessionForReview.latestSession
                                  .sessionDate,
                                activeSessionForReview.latestSession.startTime,
                                activeSessionForReview.latestSession.endTime,
                              )}
                            </span>
                          </>
                        )}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => !isSubmitting && setDrawerOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    title={t("feedbackDrawerCloseTitle")}
                  >
                    <X className="w-5 h-5 stroke-[1.75]" />
                  </button>
                </div>

                {/* Drawer Body */}
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-6 p-6 pb-10">
                  {isThankYouMode ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-200">
                      <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                        <Check className="w-7 h-7 stroke-[2.5]" />
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-bold text-xl text-slate-900">
                          {editingFeedbackId
                            ? t("feedbackThankYouTitleEdit")
                            : t("feedbackThankYouTitleNew")}
                        </h3>
                        <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                          {t("feedbackThankYouDesc")}
                        </p>
                      </div>

                      <div className="pt-4 w-full space-y-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setDrawerOpen(false)
                            setIsThankYouMode(false)
                            setActiveTab("submitted")
                          }}
                          className="w-full py-3 rounded-xl bg-brand-primary text-white text-xs font-bold cursor-pointer hover:bg-brand-primary-hover transition-all shadow-xs"
                        >
                          {t("feedbackThankYouBtnHistory")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDrawerOpen(false)
                            setIsThankYouMode(false)
                          }}
                          className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-medium cursor-pointer hover:bg-slate-50 transition-all"
                        >
                          {t("feedbackThankYouBtnClose")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* BƯỚC 1: THANG ĐIỂM CHẤM 1 – 5 */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-sm text-slate-900">
                            {t("feedbackDrawerStep1Title")}
                          </h3>
                          <span className="text-[11px] font-bold text-brand-accent-dark">
                            {t("feedbackDrawerScaleBadge")}
                          </span>
                        </div>

                        <div
                          role="radiogroup"
                          aria-label={t("feedbackDrawerScaleAria")}
                          className="grid grid-cols-5 gap-2 pt-1"
                        >
                          {[1, 2, 3, 4, 5].map((level) => {
                            const isSelected = overallRating === level
                            const levelVerdict = getVerdictMeta(level, t)
                            return (
                              <button
                                key={level}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                aria-label={tr("feedbackDrawerLevelAria", {
                                  level,
                                  label: levelVerdict.label,
                                })}
                                onClick={() => handleSelectOverallRating(level)}
                                className={`h-11 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer font-bold text-sm border ${
                                  isSelected
                                    ? "bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-100 shadow-sm"
                                    : "bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50/40"
                                }`}
                              >
                                <span>{level}★</span>
                              </button>
                            )
                          })}
                        </div>

                        <div className="min-h-5 pt-0.5">
                          {overallRating > 0 ? (
                            <div className="flex items-baseline gap-2 animate-in fade-in duration-150">
                              <span className="text-xs font-bold text-brand-accent-dark">
                                {getVerdictMeta(overallRating, t).label}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                · {getVerdictMeta(overallRating, t).desc}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {t("feedbackDrawerSelectPrompt")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Khi chỉnh sửa đánh giá không có metadata trong localStorage: ẩn tiêu chí & thẻ, hiện chú thích gọn */}
                      {overallRating > 0 && isEditingWithoutLocalMeta && (
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 italic">
                          {t("feedbackMissingLocalMetaNote")}
                        </div>
                      )}

                      {/* BƯỚC 2: Tiêu chí thành phần (ẩn khi chỉnh sửa đánh giá không có metadata localStorage) */}
                      {overallRating > 0 && !isEditingWithoutLocalMeta && (
                        <div className="space-y-5 pt-3 border-t border-slate-100 animate-in fade-in duration-200">
                          {/* Nhóm 1: Huấn luyện viên */}
                          <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {t("feedbackDrawerCoachCriteriaHeader")}
                              </span>
                              <span className="text-[11px] text-slate-400 italic">
                                ({t("feedbackDrawerDefaultFromOverallHint")})
                              </span>
                            </div>

                            <div className="space-y-2.5">
                              {[
                                {
                                  key: "expertise",
                                  label: t("feedbackDrawerCoachExpertise"),
                                },
                                {
                                  key: "interaction",
                                  label: t("feedbackDrawerCoachInteraction"),
                                },
                                {
                                  key: "punctuality",
                                  label: t("feedbackDrawerCoachPunctuality"),
                                },
                              ].map((item) => {
                                const currentVal =
                                  coachCriteria[item.key] ?? overallRating
                                return (
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
                                            handleSelectCoachCriterion(
                                              item.key,
                                              pt,
                                            )
                                          }
                                          className={`w-6 h-6 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                            currentVal === pt
                                              ? "border border-blue-600 bg-blue-600 text-white ring-2 ring-blue-100"
                                              : "border border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                                          }`}
                                        >
                                          {pt}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {/* Nhóm 2: Sân bãi & Tiện nghi */}
                          <div className="space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {t("feedbackDrawerFacilityCriteriaHeader")}
                              </span>
                              <span className="text-[11px] text-slate-400 italic">
                                ({t("feedbackDrawerDefaultFromOverallHint")})
                              </span>
                            </div>

                            <div className="space-y-2.5">
                              {[
                                {
                                  key: "court",
                                  label: t("feedbackDrawerFacilityCourt"),
                                },
                                {
                                  key: "lighting",
                                  label: t("feedbackDrawerFacilityLighting"),
                                },
                                {
                                  key: "cleanliness",
                                  label: t("feedbackDrawerFacilityCleanliness"),
                                },
                              ].map((item) => {
                                const currentVal =
                                  facilityCriteria[item.key] ?? overallRating
                                return (
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
                                            handleSelectFacilityCriterion(
                                              item.key,
                                              pt,
                                            )
                                          }
                                          className={`w-6 h-6 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                            currentVal === pt
                                              ? "border border-blue-600 bg-blue-600 text-white ring-2 ring-blue-100"
                                              : "border border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                                          }`}
                                        >
                                          {pt}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* BƯỚC 3: Gợi ý nhận định nhanh (ẩn khi chỉnh sửa đánh giá không có metadata localStorage) */}
                      {overallRating > 0 && !isEditingWithoutLocalMeta && (
                        <div className="space-y-2.5 pt-3 border-t border-slate-100">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                            {t("feedbackDrawerQuickTagsHeader")}
                          </span>
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            {[
                              ...(overallRating >= 4
                                ? POSITIVE_TAG_CODES
                                : CRITICAL_TAG_CODES),
                              ...selectedTags.filter(
                                (code) =>
                                  !(
                                    overallRating >= 4
                                      ? POSITIVE_TAG_CODES
                                      : CRITICAL_TAG_CODES
                                  ).includes(code),
                              ),
                            ].map((tagCode) => {
                              const isSelected = selectedTags.includes(tagCode)
                              return (
                                <button
                                  key={tagCode}
                                  type="button"
                                  onClick={() => handleToggleTag(tagCode)}
                                  className={`text-xs px-3 py-1.5 rounded-lg transition-all cursor-pointer font-medium border ${
                                      isSelected
                                      ? "bg-blue-600 text-white border-blue-600 font-semibold shadow-sm"
                                      : "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50"
                                  }`}
                                >
                                  {getTagLabel(tagCode, t)}
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
                            {overallRating <= 2
                              ? t("feedbackDrawerCommentRequiredLabel")
                              : t("feedbackDrawerCommentLabel")}
                          </label>

                          <textarea
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            rows={3}
                            placeholder={t("feedbackDrawerCommentPlaceholder")}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all resize-none leading-relaxed"
                          />
                        </div>
                      )}

                      {/* BƯỚC 5: Quyền riêng tư & Đối thoại bảo mật */}
                      {overallRating > 0 && !isEditingWithoutLocalMeta && (
                        <div className="space-y-2.5 pt-3 border-t border-slate-100">
                          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 cursor-pointer text-xs text-slate-700 transition hover:border-blue-200 hover:bg-blue-50/40">
                            <input
                              type="checkbox"
                              checked={isAnonymous}
                              onChange={(e) => setIsAnonymous(e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-200"
                            />
                            <span>{t("feedbackDrawerAnonymousLabel")}</span>
                          </label>

                          <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 cursor-pointer text-xs text-slate-700 transition hover:border-blue-200 hover:bg-blue-50/40">
                            <input
                              type="checkbox"
                              checked={isPrivateContactRequested}
                              onChange={(e) =>
                                setIsPrivateContactRequested(e.target.checked)
                              }
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-200"
                            />
                            <span>
                              {t("feedbackDrawerPrivateContactLabel")}
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
                  <div className="shrink-0 p-5 border-t border-slate-200 bg-white flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setDrawerOpen(false)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
                    >
                      {t("feedbackDrawerBtnCancel")}
                    </button>

                    <button
                      type="button"
                      disabled={overallRating === 0 || isSubmitting}
                      onClick={handleSubmitReview}
                      className={`px-6 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                        overallRating > 0 && !isSubmitting
                          ? "bg-brand-primary hover:bg-brand-primary-hover text-white shadow-xs active:scale-[0.98]"
                          : "bg-slate-200 text-slate-400 cursor-not-allowed"
                      }`}
                    >
                      {isSubmitting
                        ? t("feedbackDrawerBtnSubmitting")
                        : editingFeedbackId
                          ? t("feedbackDrawerBtnSaveEdit")
                          : t("feedbackDrawerBtnSubmit")}
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
