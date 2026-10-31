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
} from "lucide-react"

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
const FEEDBACK_META_STORAGE_KEY = "scms_member_feedback_meta_v1"

const readStoredFeedbackMeta = () => {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(FEEDBACK_META_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

const writeStoredFeedbackMeta = (metaMap) => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      FEEDBACK_META_STORAGE_KEY,
      JSON.stringify(metaMap || {}),
    )
  } catch {
    // ignore storage quota errors
  }
}

// Tính toán điều kiện đủ để đánh giá & số ngày hạn còn lại (ưu tiên cờ/hạn từ API nếu có, chỉ dùng FEEDBACK_DEADLINE_DAYS khi API không trả hạn)
export const evaluateSessionFeedbackEligibility = (
  session,
  attendanceRecord,
  todayIso,
) => {
  const apiEligibleFlag =
    session?.canFeedback ??
    session?.canReview ??
    session?.feedbackEligible ??
    session?.eligibleForFeedback ??
    attendanceRecord?.canFeedback ??
    attendanceRecord?.canReview ??
    attendanceRecord?.feedbackEligible ??
    attendanceRecord?.eligibleForFeedback ??
    null

  const apiRemainingDaysRaw =
    session?.feedbackDeadlineDays ??
    session?.remainingFeedbackDays ??
    session?.deadlineDays ??
    attendanceRecord?.feedbackDeadlineDays ??
    attendanceRecord?.remainingFeedbackDays ??
    null

  const apiDeadlineDateRaw =
    session?.feedbackDeadline ??
    session?.reviewDeadline ??
    session?.feedbackExpiresAt ??
    attendanceRecord?.feedbackDeadline ??
    attendanceRecord?.reviewDeadline ??
    null

  let remainingDays = null
  if (
    apiRemainingDaysRaw !== null &&
    apiRemainingDaysRaw !== undefined &&
    apiRemainingDaysRaw !== "" &&
    Number.isFinite(Number(apiRemainingDaysRaw))
  ) {
    remainingDays = Math.round(Number(apiRemainingDaysRaw))
  } else if (apiDeadlineDateRaw) {
    const deadlineIso = String(apiDeadlineDateRaw).slice(0, 10)
    remainingDays = diffCalendarDaysInVn(todayIso, deadlineIso)
  } else {
    const elapsedDays = diffCalendarDaysInVn(session?.sessionDate, todayIso)
    if (elapsedDays !== null && elapsedDays >= 0) {
      remainingDays = FEEDBACK_DEADLINE_DAYS - elapsedDays
    }
  }

  if (apiEligibleFlag === false) {
    return { isEligible: false, remainingDays }
  }
  if (apiEligibleFlag === true) {
    return {
      isEligible: remainingDays === null ? true : remainingDays >= 0,
      remainingDays: remainingDays ?? FEEDBACK_DEADLINE_DAYS,
    }
  }

  return {
    isEligible: remainingDays !== null && remainingDays >= 0,
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
    t,
  } = useSCMS()

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

  // Chuẩn hóa danh sách buổi tập đã tham gia, buổi cần đánh giá và lịch sử đánh giá
  // Dùng chung nguồn buổi học & bản ghi điểm danh với trang Điểm danh và Lịch học
  const {
    attendedSessions,
    pendingSessions,
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
              id: rec.sessionId ?? `att-session-${rec.attendanceId || rec.id || dateIso}`,
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
              startTime: rec.startTime || rec.sessionStartTime || enrollmentFallback.startTime || null,
              endTime: rec.endTime || rec.sessionEndTime || enrollmentFallback.endTime || null,
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

      const eligibility = evaluateSessionFeedbackEligibility(
        session,
        attendanceRecord,
        todayIso,
      )

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
        isEligibleForFeedback: eligibility.isEligible,
        remainingDeadlineDays: eligibility.remainingDays,
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

    // 3. Đối chiếu với đánh giá đã gửi (từ API và metadata lưu bổ sung)
    const memberScope = String(resolvedMemberId || "anon")
    const memberContextFeedbacks = !apiEnabled
      ? (Array.isArray(feedbacks) ? feedbacks : []).filter(
          (f) => String(f.memberId) === String(resolvedMemberId),
        )
      : []

    const pending = []
    const submitted = []
    const consumedClassApiFeedback = new Set()

    for (const session of attended) {
      const classIdStr =
        session.classId != null ? String(session.classId) : null
      const sessionMetaEntry =
        localMetaMap[`${memberScope}:session:${session.sessionKey}`] ||
        (session.id != null
          ? localMetaMap[`${memberScope}:session:${session.id}`]
          : null) ||
        null
      const classMetaEntry = classIdStr
        ? localMetaMap[`${memberScope}:class:${classIdStr}`]
        : null
      const apiFb = classIdStr ? apiFeedbackMap[classIdStr] : null
      const ctxFb = memberContextFeedbacks.find(
        (f) =>
          String(f.sessionKey || f.id) === String(session.sessionKey) ||
          (classIdStr &&
            String(f.classId) === classIdStr &&
            String(f.date || f.sessionDate || "").slice(0, 10) ===
              session.sessionDate),
      )

      // Kiểm tra xem buổi này đã được đánh giá chưa:
      // - Có bản ghi đánh giá gắn đúng buổi (sessionMetaEntry hoặc ctxFb)
      // - Hoặc lớp có apiFb từ server và (classMetaEntry khớp buổi này, hoặc chưa có buổi nào khác trong lớp nhận apiFb này)
      const isMatchedBySessionMeta = Boolean(sessionMetaEntry)
      const isMatchedByClassApi =
        Boolean(apiFb) &&
        !consumedClassApiFeedback.has(classIdStr) &&
        (!classMetaEntry?.sessionKey ||
          classMetaEntry.sessionKey === session.sessionKey)

      if (isMatchedBySessionMeta || isMatchedByClassApi || ctxFb) {
        if (classIdStr && apiFb) {
          consumedClassApiFeedback.add(classIdStr)
        }
        const rawSource = apiFb || ctxFb || {}
        const metaSource = sessionMetaEntry || classMetaEntry || {}

        const apiCoachRating = Number(rawSource.coachRating) || null
        const apiClassRating = Number(rawSource.classRating) || null
        const derivedOverall =
          Number(metaSource.overallRating) ||
          Number(rawSource.overallRating) ||
          Number(rawSource.rating) ||
          (apiCoachRating && apiClassRating
            ? Math.round((apiCoachRating + apiClassRating) / 2)
            : apiCoachRating || apiClassRating || 5)

        const fallbackCoachScore = apiCoachRating || derivedOverall
        const fallbackFacilityScore = apiClassRating || derivedOverall

        const savedCoachBd =
          metaSource.coachBreakdown || rawSource.criteria?.coachBreakdown || null
        const savedFacilityBd =
          metaSource.facilityBreakdown ||
          rawSource.criteria?.facilityBreakdown ||
          null

        const coachBreakdown = {
          expertise: Number(savedCoachBd?.expertise) || fallbackCoachScore,
          interaction: Number(savedCoachBd?.interaction) || fallbackCoachScore,
          punctuality: Number(savedCoachBd?.punctuality) || fallbackCoachScore,
        }
        const facilityBreakdown = {
          court: Number(savedFacilityBd?.court) || fallbackFacilityScore,
          lighting: Number(savedFacilityBd?.lighting) || fallbackFacilityScore,
          cleanliness:
            Number(savedFacilityBd?.cleanliness) || fallbackFacilityScore,
        }

        const rawTags =
          Array.isArray(metaSource.tags) && metaSource.tags.length > 0
            ? metaSource.tags
            : Array.isArray(rawSource.tags)
              ? rawSource.tags
              : []
        const normalizedTags = rawTags.map(normalizeTagCode).filter(Boolean)

        const realReply = sanitizeRealCoachReply(
          rawSource.coachReply || rawSource.replyText || rawSource.response,
        )
        const replyAuthor =
          rawSource.repliedByName ||
          rawSource.coachReplyAuthor ||
          session.coachName
        const replyDate =
          rawSource.repliedAt || rawSource.coachReplyDate || null

        submitted.push({
          id:
            rawSource.feedbackId ||
            rawSource.id ||
            metaSource.feedbackId ||
            `fb-${session.sessionKey}`,
          sessionKey: session.sessionKey,
          classId: session.classId,
          coachId: session.coachId,
          className: session.className,
          coachName: session.coachName,
          roomName: session.roomName,
          sessionDate: session.sessionDate,
          startTime: session.startTime,
          endTime: session.endTime,
          rating: derivedOverall,
          overallRating: derivedOverall,
          coachRating: apiCoachRating || fallbackCoachScore,
          classRating: apiClassRating || fallbackFacilityScore,
          criteria: {
            coachBreakdown,
            facilityBreakdown,
            customTouchedCriteria: metaSource.customTouchedCriteria || {},
          },
          tags: normalizedTags,
          comment:
            rawSource.comment !== undefined && rawSource.comment !== null
              ? String(rawSource.comment)
              : String(metaSource.comment || ""),
          isAnonymous: Boolean(
            metaSource.isAnonymous ?? rawSource.isAnonymous,
          ),
          isPrivateContactRequested: Boolean(
            metaSource.isPrivateContactRequested ??
              rawSource.isPrivateContactRequested,
          ),
          coachReply: realReply,
          coachReplyAuthor: realReply ? replyAuthor : null,
          coachReplyDate: realReply ? replyDate : null,
          createdAt:
            rawSource.createdAt || metaSource.createdAt || session.sessionDate,
          sessionMeta: session,
        })
      } else if (session.isEligibleForFeedback && !apiFb) {
        pending.push(session)
      }
    }

    // Trường hợp API có trả về đánh giá cho một lớp mà hội viên chưa có bản ghi buổi học tương ứng trong attended
    for (const [classIdStr, apiFb] of Object.entries(apiFeedbackMap)) {
      if (consumedClassApiFeedback.has(classIdStr) || !apiFb) continue
      const enrollmentRow = enrollmentByClassId.get(classIdStr)
      const matchedClass = classLookup.get(classIdStr)
      const metaSource =
        localMetaMap[`${memberScope}:class:${classIdStr}`] || {}
      const classSessions = collectedSessions.filter(
        (s) => String(s.classId) === classIdStr && !isSessionCancelled(s),
      )
      const latestPastClassSession =
        [...classSessions]
          .reverse()
          .find((s) => s.sessionDate && s.sessionDate <= todayIso) ||
        classSessions[0] ||
        null

      const resolvedClassName =
        metaSource.className ||
        latestPastClassSession?.className ||
        enrollmentRow?.className ||
        matchedClass?.name ||
        `#${classIdStr}`
      const resolvedCoachName =
        metaSource.coachName ||
        latestPastClassSession?.coachName ||
        enrollmentRow?.coachName ||
        matchedClass?.coachName ||
        t("feedbackCoachTbd")
      const resolvedRoomName =
        metaSource.roomName ||
        latestPastClassSession?.roomName ||
        enrollmentRow?.roomName ||
        matchedClass?.roomName ||
        t("feedbackRoomTbd")
      const resolvedDate =
        metaSource.sessionDate ||
        latestPastClassSession?.sessionDate ||
        (apiFb.createdAt ? String(apiFb.createdAt).slice(0, 10) : todayIso)
      const resolvedStart =
        metaSource.startTime ||
        latestPastClassSession?.startTime ||
        enrollmentRow?.startTime ||
        matchedClass?.startTime ||
        null
      const resolvedEnd =
        metaSource.endTime ||
        latestPastClassSession?.endTime ||
        enrollmentRow?.endTime ||
        matchedClass?.endTime ||
        null

      const apiCoachRating = Number(apiFb.coachRating) || null
      const apiClassRating = Number(apiFb.classRating) || null
      const derivedOverall =
        Number(metaSource.overallRating) ||
        Number(apiFb.rating) ||
        (apiCoachRating && apiClassRating
          ? Math.round((apiCoachRating + apiClassRating) / 2)
          : apiCoachRating || apiClassRating || 5)

      const fallbackCoachScore = apiCoachRating || derivedOverall
      const fallbackFacilityScore = apiClassRating || derivedOverall
      const savedCoachBd = metaSource.coachBreakdown || null
      const savedFacilityBd = metaSource.facilityBreakdown || null

      const rawTags = Array.isArray(metaSource.tags)
        ? metaSource.tags
        : Array.isArray(apiFb.tags)
          ? apiFb.tags
          : []
      const realReply = sanitizeRealCoachReply(
        apiFb.coachReply || apiFb.replyText || apiFb.response,
      )

      const syntheticSession = {
        id: metaSource.sessionId || `class-${classIdStr}`,
        sessionKey: metaSource.sessionKey || `class-${classIdStr}`,
        classId: Number(classIdStr) || classIdStr,
        coachId:
          apiFb.coachId ??
          enrollmentRow?.coachId ??
          matchedClass?.coachId ??
          1,
        className: resolvedClassName,
        coachName: resolvedCoachName,
        roomName: resolvedRoomName,
        sessionDate: resolvedDate,
        startTime: resolvedStart,
        endTime: resolvedEnd,
      }

      submitted.push({
        id: apiFb.feedbackId || apiFb.id || `fb-${classIdStr}`,
        sessionKey: syntheticSession.sessionKey,
        classId: syntheticSession.classId,
        coachId: syntheticSession.coachId,
        className: resolvedClassName,
        coachName: resolvedCoachName,
        roomName: resolvedRoomName,
        sessionDate: resolvedDate,
        startTime: resolvedStart,
        endTime: resolvedEnd,
        rating: derivedOverall,
        overallRating: derivedOverall,
        coachRating: apiCoachRating || fallbackCoachScore,
        classRating: apiClassRating || fallbackFacilityScore,
        criteria: {
          coachBreakdown: {
            expertise: Number(savedCoachBd?.expertise) || fallbackCoachScore,
            interaction:
              Number(savedCoachBd?.interaction) || fallbackCoachScore,
            punctuality:
              Number(savedCoachBd?.punctuality) || fallbackCoachScore,
          },
          facilityBreakdown: {
            court: Number(savedFacilityBd?.court) || fallbackFacilityScore,
            lighting:
              Number(savedFacilityBd?.lighting) || fallbackFacilityScore,
            cleanliness:
              Number(savedFacilityBd?.cleanliness) || fallbackFacilityScore,
          },
          customTouchedCriteria: metaSource.customTouchedCriteria || {},
        },
        tags: rawTags.map(normalizeTagCode).filter(Boolean),
        comment: String(apiFb.comment ?? metaSource.comment ?? ""),
        isAnonymous: Boolean(metaSource.isAnonymous),
        isPrivateContactRequested: Boolean(
          metaSource.isPrivateContactRequested,
        ),
        coachReply: realReply,
        coachReplyAuthor: realReply
          ? apiFb.repliedByName || resolvedCoachName
          : null,
        coachReplyDate: realReply ? apiFb.repliedAt || null : null,
        createdAt: apiFb.createdAt || resolvedDate,
        sessionMeta: syntheticSession,
      })
    }

    // Danh sách khóa học thật của hội viên để hiển thị bộ lọc ở tab "Lịch sử của tôi"
    const courseMap = new Map()
    for (const row of apiEnrollments) {
      const cid = row?.classId ?? row?.id
      const cname = row?.className || row?.name
      if (cid != null && cname) {
        courseMap.set(String(cid), {
          classId: String(cid),
          className: cname,
        })
      }
    }
    for (const s of attended) {
      if (s.classId != null && s.className) {
        courseMap.set(String(s.classId), {
          classId: String(s.classId),
          className: s.className,
        })
      }
    }
    for (const r of submitted) {
      if (r.classId != null && r.className) {
        courseMap.set(String(r.classId), {
          classId: String(r.classId),
          className: r.className,
        })
      }
    }

    return {
      attendedSessions: attended,
      pendingSessions: pending,
      submittedReviews: submitted,
      enrolledCoursesList: [...courseMap.values()],
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
      const reviewDateIso = String(r.sessionDate || r.date || "").slice(0, 10)
      if (selectedTimeFilter !== "all" && reviewDateIso) {
        const diffDays = diffCalendarDaysInVn(reviewDateIso, todayIso)
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
    setCoachCriteria((prev) => ({
      expertise: customTouchedCriteria.expertise ? prev.expertise : level,
      interaction: customTouchedCriteria.interaction ? prev.interaction : level,
      punctuality: customTouchedCriteria.punctuality ? prev.punctuality : level,
    }))
    setFacilityCriteria((prev) => ({
      court: customTouchedCriteria.court ? prev.court : level,
      lighting: customTouchedCriteria.lighting ? prev.lighting : level,
      cleanliness: customTouchedCriteria.cleanliness ? prev.cleanliness : level,
    }))
  }

  const handleSelectCoachCriterion = (key, pt) => {
    setCustomTouchedCriteria((prev) => ({ ...prev, [key]: true }))
    setCoachCriteria((prev) => ({ ...prev, [key]: pt }))
  }

  const handleSelectFacilityCriterion = (key, pt) => {
    setCustomTouchedCriteria((prev) => ({ ...prev, [key]: true }))
    setFacilityCriteria((prev) => ({ ...prev, [key]: pt }))
  }

  // Mở Ngăn chấm điểm (tạo mới hoặc chỉnh sửa đánh giá đã gửi)
  const handleOpenReviewDrawer = (session, existingFeedback = null) => {
    setActiveSessionForReview(session)
    setSubmitError(null)
    setIsThankYouMode(false)

    if (existingFeedback) {
      const baseOverall =
        Number(existingFeedback.overallRating || existingFeedback.rating) || 5
      const baseCoach =
        Number(existingFeedback.coachRating) || baseOverall
      const baseClass =
        Number(existingFeedback.classRating) || baseOverall
      const savedCoachBd = existingFeedback.criteria?.coachBreakdown
      const savedFacilityBd = existingFeedback.criteria?.facilityBreakdown
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
        existingFeedback.criteria?.customTouchedCriteria || {}

      setEditingFeedbackId(existingFeedback.id)
      setOverallRating(baseOverall)
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
      setCommentText(existingFeedback.comment || "")
      setIsAnonymous(Boolean(existingFeedback.isAnonymous))
      setIsPrivateContactRequested(
        Boolean(existingFeedback.isPrivateContactRequested),
      )
    } else {
      setEditingFeedbackId(null)
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

  // Gửi đánh giá từ Ngăn chấm điểm
  const handleSubmitReview = async () => {
    if (!overallRating || overallRating === 0 || !activeSessionForReview) return
    if (overallRating <= 2 && !commentText.trim()) {
      setSubmitError(t("feedbackDrawerLowRatingCommentError"))
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const effectiveCoachCriteria = {
        expertise: coachCriteria.expertise ?? overallRating,
        interaction: coachCriteria.interaction ?? overallRating,
        punctuality: coachCriteria.punctuality ?? overallRating,
      }
      const effectiveFacilityCriteria = {
        court: facilityCriteria.court ?? overallRating,
        lighting: facilityCriteria.lighting ?? overallRating,
        cleanliness: facilityCriteria.cleanliness ?? overallRating,
      }

      const avgCoach = Math.min(
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
      const avgClass = Math.min(
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

      const targetClassId =
        activeSessionForReview.classId ?? activeSessionForReview.id
      const targetCoachId = activeSessionForReview.coachId || 1
      const sessionKey =
        activeSessionForReview.sessionKey ||
        `session-${activeSessionForReview.id}`

      const metaEntry = {
        feedbackId: editingFeedbackId || `fb-${Date.now()}`,
        sessionId: activeSessionForReview.id,
        sessionKey,
        classId: targetClassId,
        coachId: targetCoachId,
        className: activeSessionForReview.className,
        coachName: activeSessionForReview.coachName,
        roomName: activeSessionForReview.roomName,
        sessionDate: activeSessionForReview.sessionDate,
        startTime: activeSessionForReview.startTime,
        endTime: activeSessionForReview.endTime,
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
        createdAt: new Date().toISOString(),
      }

      if (apiEnabled) {
        const parsedClassId = Number(targetClassId)
        const parsedCoachId = Number(targetCoachId) || 1
        if (!Number.isNaN(parsedClassId) && parsedClassId > 0) {
          const apiRes = await submitClassFeedback(parsedClassId, {
            classId: parsedClassId,
            coachId: parsedCoachId > 0 ? parsedCoachId : 1,
            classRating: avgClass,
            coachRating: avgCoach,
            comment: commentText.trim(),
          })
          if (apiRes?.feedbackId || apiRes?.id) {
            metaEntry.feedbackId = apiRes.feedbackId || apiRes.id
          }
        }

        const memberScope = String(resolvedMemberId || "anon")
        const nextMeta = {
          ...readStoredFeedbackMeta(),
          [`${memberScope}:session:${sessionKey}`]: metaEntry,
          ...(targetClassId != null
            ? { [`${memberScope}:class:${targetClassId}`]: metaEntry }
            : {}),
        }
        writeStoredFeedbackMeta(nextMeta)
        setLocalMetaMap(nextMeta)

        await fetchBackendFeedbackData()
        showToast?.(
          editingFeedbackId
            ? t("feedbackToastUpdated")
            : t("feedbackToastSubmitted"),
          "success",
        )
      } else {
        await submitFeedback({
          id: metaEntry.feedbackId,
          sessionKey,
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
          date: activeSessionForReview.sessionDate,
          sessionDate: activeSessionForReview.sessionDate,
          startTime: activeSessionForReview.startTime,
          endTime: activeSessionForReview.endTime,
          room: activeSessionForReview.roomName,
          criteria: {
            coachQuality: avgCoach,
            facilityQuality: avgClass,
            coachBreakdown: effectiveCoachCriteria,
            facilityBreakdown: effectiveFacilityCriteria,
            customTouchedCriteria,
          },
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
            <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-accent-dark">
              {t("feedbackBrand")}
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              {t("feedbackPageTitle")}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {t("feedbackPageSubtitle")}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={fetchBackendFeedbackData}
              disabled={isLoadingApi}
              aria-label={t("feedbackBtnRefresh")}
              title={t("feedbackBtnRefresh")}
              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 p-2 text-slate-700 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoadingApi ? "animate-spin" : ""}`}
              />
            </button>

            {lastUpdatedAt && (
              <span className="text-xs text-slate-500">
                {tr("feedbackUpdatedAt", {
                  time: TIME_FORMATTER_HHMM.format(lastUpdatedAt),
                })}
              </span>
            )}
          </div>
        </header>
      )}

      {/* 2. DẢI CHỈ SỐ: 4 Thẻ đồng bộ hệ thống */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Cột 1: Chờ đánh giá */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
            {t("feedbackKpiPending")}
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
            {t("feedbackKpiSubmitted")}
          </span>
          <div className="text-3xl font-black mt-2 tabular-nums text-slate-900">
            {submittedReviews.length}
          </div>
        </div>

        {/* Cột 3: Đã tham gia */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
            {t("feedbackKpiAttended")}
          </span>
          <div className="text-3xl font-black mt-2 tabular-nums text-slate-900">
            {attendedSessions.length}
          </div>
        </div>

        {/* Cột 4: Điểm bạn đã cho */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
            {t("feedbackKpiAvgRating")}
          </span>
          <div className="text-3xl font-black mt-2 tabular-nums text-slate-900 flex items-center gap-1.5">
            <span>{averageRating}</span>
            {submittedReviews.length > 0 && (
              <span className="text-sm font-medium text-slate-400">/ 5★</span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {submittedReviews.length > 0
              ? tr("feedbackKpiAvgSub", { count: submittedReviews.length })
              : t("feedbackKpiNoRating")}
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
              ? "border-brand-accent text-brand-accent-dark"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>{t("feedbackTabPending")}</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700 font-semibold">
            {pendingSessions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("submitted")}
          className={`pb-3 font-bold border-b-2 cursor-pointer transition-colors flex items-center gap-2 ${
            activeTab === "submitted"
              ? "border-brand-accent text-brand-accent-dark"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>{t("feedbackTabSubmitted")}</span>
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
            <div className="space-y-3">
              <AnimatePresence>
                {pendingSessions.map((session) => {
                  const isLate = session.attendanceStateKey === "late"
                  const attendanceLabel = isLate
                    ? t("feedbackStatusLate")
                    : t("feedbackStatusPresent")
                  const remainingDays = session.remainingDeadlineDays

                  return (
                    <motion.div
                      key={session.sessionKey}
                      initial={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                      transition={{ duration: 0.2 }}
                      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      {/* Cột 1: Ngày & Giờ chuẩn dd/MM/yyyy · HH:mm–HH:mm */}
                      <div className="sm:w-56 shrink-0">
                        <div className="text-sm font-bold text-slate-900 tabular-nums">
                          {formatSessionDateTimeSlot(
                            session.sessionDate,
                            session.startTime,
                            session.endTime,
                          )}
                        </div>
                      </div>

                      {/* Cột 2: Khóa học & Thông tin */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <h3 className="text-base font-bold text-slate-900 truncate">
                          {session.className}
                        </h3>
                        <p className="text-xs text-slate-600">
                          {session.roomName} · {t("feedbackCoachPrefix")}{" "}
                          {String(session.coachName || "").replace(
                            /^HLV\s+/i,
                            "",
                          )}
                        </p>
                        <div className="text-xs text-slate-500 flex items-center gap-2 pt-0.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                              isLate
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {attendanceLabel}
                          </span>
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

                      {/* Cột 3: CTA Button */}
                      <div className="shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenReviewDrawer(session)}
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
              {pendingSessions.length > 0 && (
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
                const coachFallback = Number(review.coachRating) || overallScore
                const facilityFallback =
                  Number(review.classRating) || overallScore
                const coachBd = review.criteria?.coachBreakdown || {
                  expertise: coachFallback,
                  interaction: coachFallback,
                  punctuality: coachFallback,
                }
                const facilityBd = review.criteria?.facilityBreakdown || {
                  court: facilityFallback,
                  lighting: facilityFallback,
                  cleanliness: facilityFallback,
                }
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
                            {review.className || review.sessionMeta?.className}
                          </h3>
                          <span className="text-slate-300">•</span>
                          <span className="text-xs text-slate-500">
                            {review.roomName ||
                              review.sessionMeta?.roomName ||
                              t("feedbackRoomTbd")}
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
                            {review.coachName || review.sessionMeta?.coachName}
                          </span>{" "}
                          ·{" "}
                          <span className="tabular-nums">
                            {formatSessionDateTimeSlot(
                              review.sessionDate ||
                                review.sessionMeta?.sessionDate ||
                                review.date,
                              review.startTime || review.sessionMeta?.startTime,
                              review.endTime || review.sessionMeta?.endTime,
                            )}
                          </span>
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
                              review.sessionMeta || review,
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
                      <span className="text-xs font-bold text-brand-accent-dark uppercase tracking-wider">
                        {verdictMeta.label}
                      </span>

                      {review.tags && review.tags.length > 0 && (
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
                    {review.comment && !isBreakdownOpen && (
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
                    <div className="pt-1">
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

                          {review.comment && (
                            <div className="pt-3 border-t border-slate-200/80 space-y-1">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                                {t("feedbackDetailCommentLabel")}
                              </span>
                              <p className="text-xs text-slate-700 leading-relaxed">
                                {review.comment}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

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
                className="w-screen max-w-[480px] bg-white text-slate-900 shadow-2xl flex flex-col justify-between border-l border-slate-200 z-10"
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
                    <p className="text-xs text-slate-500 font-normal tabular-nums">
                      {formatSessionDateTimeSlot(
                        activeSessionForReview.sessionDate ||
                          activeSessionForReview.date,
                        activeSessionForReview.startTime,
                        activeSessionForReview.endTime,
                      )}{" "}
                      ·{" "}
                      {activeSessionForReview.coachName ||
                        activeSessionForReview.coach}{" "}
                      ·{" "}
                      {activeSessionForReview.roomName ||
                        activeSessionForReview.court}
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
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
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
                                    ? "bg-brand-primary text-white border-brand-accent shadow-xs"
                                    : overallRating >= level
                                      ? "bg-brand-accent-soft text-brand-accent-dark border-brand-accent/40"
                                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
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

                      {/* BƯỚC 2: Tiêu chí thành phần (mặc định theo điểm tổng quát N, không ghi đè mục người dùng đã chỉnh) */}
                      {overallRating > 0 && (
                        <div className="space-y-5 pt-3 border-t border-slate-100 animate-in fade-in duration-200">
                          {/* Nhóm 1: Huấn luyện viên */}
                          <div className="space-y-3">
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
                                              ? "bg-brand-primary text-white"
                                              : currentVal >= pt
                                                ? "bg-brand-accent-soft text-brand-accent-dark"
                                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
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
                          <div className="space-y-3 pt-2 border-t border-slate-100">
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
                                              ? "bg-brand-primary text-white"
                                              : currentVal >= pt
                                                ? "bg-brand-accent-soft text-brand-accent-dark"
                                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
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

                      {/* BƯỚC 3: Gợi ý nhận định nhanh */}
                      {overallRating > 0 && (
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
                                      ? "bg-brand-accent-soft text-brand-accent-dark border-brand-accent/40 font-bold"
                                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
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
                      {overallRating > 0 && (
                        <div className="space-y-2.5 pt-3 border-t border-slate-100">
                          <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={isAnonymous}
                              onChange={(e) => setIsAnonymous(e.target.checked)}
                              className="w-4 h-4 rounded border-slate-300 text-brand-accent-dark focus:ring-brand-accent"
                            />
                            <span>{t("feedbackDrawerAnonymousLabel")}</span>
                          </label>

                          <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={isPrivateContactRequested}
                              onChange={(e) =>
                                setIsPrivateContactRequested(e.target.checked)
                              }
                              className="w-4 h-4 rounded border-slate-300 text-brand-accent-dark focus:ring-brand-accent"
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
                  <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setDrawerOpen(false)}
                      className="px-4 py-2.5 text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
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
