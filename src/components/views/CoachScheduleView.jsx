import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useSCMS } from "../../context/SCMSContext"
import {
  formatDate,
  formatTime,
  formatTimeRange,
  formatWeekday,
  formatDateTime,
} from "../../utils/datetime"
import { CoachStatusBadge } from "../coach/StatusBadge"
import {
  WeeklySlotGrid,
  WEEKDAYS,
  DEFAULT_TIME_SLOTS,
  normalizeWeeklySlotsArray,
} from "../coach/WeeklySlotGrid"
import { DaysOffPicker } from "../coach/DaysOffPicker"
import { memberPortalApi } from "../../api/memberPortalApi"
import { getCatalogClassSessions } from "../../api/managerApi"
import { getErrorMessage } from "../../api/apiErrors"
import {
  canCheckIn,
  isSessionCancelled,
} from "../../utils/permissions"
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Filter,
  CheckCircle2,
  Save,
  RefreshCw,
  AlertCircle,
  BookOpen,
  LayoutList,
  CalendarDays,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

function formatSessionDayLabel(dateStr, lang = "vi") {
  if (!dateStr) return "Chưa xếp ngày"
  return formatWeekday(dateStr, lang)
}

function getSessionWeekdayKey(dateStr) {
  if (!dateStr) return "MONDAY"
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/)
  const d = m
    ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0))
    : new Date(dateStr)
  if (Number.isNaN(d.getTime())) return "MONDAY"
  const dayIdx = d.getUTCDay() // 0=Sun, 1=Mon...
  const map = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ]
  return map[dayIdx] || "MONDAY"
}

function resolveSessionSlotNumber(ses) {
  if (ses?.slotNumber && Number(ses.slotNumber) >= 1 && Number(ses.slotNumber) <= 8) {
    return Number(ses.slotNumber)
  }
  const st = formatTime(ses?.startTime)
  const found = DEFAULT_TIME_SLOTS.find((slot) => formatTime(slot.startTime) === st)
  if (found) return found.slotNumber
  const hour = Number(String(st || "06:00").slice(0, 2))
  if (hour < 7) return 1
  if (hour < 9) return 2
  if (hour < 10) return 3
  if (hour < 13) return 4
  if (hour < 15) return 5
  if (hour < 16) return 6
  if (hour < 18) return 7
  return 8
}

export function CoachScheduleView() {
  const {
    classes,
    rooms,
    currentUser,
    setCurrentTab,
    apiEnabled,
    showToast,
    t,
    language,
  } = useSCMS()
  const navigate = useNavigate()
  const activeTab = "schedule"
  const [viewMode, setViewMode] = useState("week") // 'week' | 'list' (default to visual weekly timetable)
  const [selectedRoom, setSelectedRoom] = useState("all")
  const [scheduleFilter, setScheduleFilter] = useState("all") // all | upcoming | group | pt
  const [showPastSessions, setShowPastSessions] = useState(false)
  const [detectedCoachId, setDetectedCoachId] = useState(null)

  const resolvedCoachId = useMemo(() => {
    // 1. Authoritative coachId from currentUser
    const userCoachId = Number(currentUser?.coachId)
    if (Number.isInteger(userCoachId) && userCoachId > 0) {
      return userCoachId
    }
    // 2. Detected coachId from /api/coaches or /api/coaches/me
    const detected = Number(detectedCoachId)
    if (Number.isInteger(detected) && detected > 0) {
      return detected
    }
    // 3. In mock mode only (!apiEnabled), fall back to currentUser.id
    if (!apiEnabled && currentUser?.id) {
      const num = Number(currentUser.id)
      return Number.isInteger(num) && num > 0 ? num : 1
    }
    // In API mode, NEVER fall back to userId (currentUser.id) to prevent 403 Forbidden
    return null
  }, [currentUser?.coachId, currentUser?.id, detectedCoachId, apiEnabled])

  // Auto-resolve coachId from /api/coaches or /api/coaches/me when in API mode and coachId is missing
  useEffect(() => {
    if (!apiEnabled) return
    if (currentUser?.coachId && Number(currentUser.coachId) > 0) return
    let active = true

    const lookupCoach = async () => {
      // Step A: Check if any class taught by this coach already has coachId
      if (classes.length > 0) {
        const nameLower = String(currentUser?.name || "").trim().toLowerCase()
        const matchedClass = classes.find((c) => {
          const cNameLower = String(c.coachName || "").trim().toLowerCase()
          return (
            nameLower &&
            cNameLower &&
            (cNameLower === nameLower ||
              cNameLower.includes(nameLower) ||
              nameLower.includes(cNameLower))
          )
        })
        const classCoachId = Number(matchedClass?.coachId)
        if (Number.isInteger(classCoachId) && classCoachId > 0) {
          if (active) setDetectedCoachId(classCoachId)
          return
        }
      }

      // Step B: Try GET /api/coaches/me
      try {
        const me = await memberPortalApi.getCoachProfileMe()
        const cId = Number(me?.id ?? me?.coachId)
        if (active && Number.isInteger(cId) && cId > 0) {
          setDetectedCoachId(cId)
          return
        }
      } catch {
        // Fallback to GET /api/coaches
      }

      // Step C: Try GET /api/coaches
      try {
        const list = await memberPortalApi.getCoaches()
        if (!active || !Array.isArray(list) || list.length === 0) return

        const emailLower = String(currentUser?.email || "").trim().toLowerCase()
        const nameLower = String(currentUser?.name || "").trim().toLowerCase()
        const userIdStr = String(currentUser?.id || "")

        const found = list.find((c) => {
          if (userIdStr && String(c.userId || c.user?.id || "") === userIdStr) {
            return true
          }
          if (
            emailLower &&
            String(c.email || "").trim().toLowerCase() === emailLower
          ) {
            return true
          }
          if (
            nameLower &&
            String(c.name || "").trim().toLowerCase() === nameLower
          ) {
            return true
          }
          return false
        })

        if (active && found && Number(found.id) > 0) {
          setDetectedCoachId(Number(found.id))
        }
      } catch (err) {
        console.warn("Could not auto-resolve coach ID:", err)
      }
    }

    void lookupCoach()
    return () => {
      active = false
    }
  }, [
    apiEnabled,
    currentUser?.coachId,
    currentUser?.id,
    currentUser?.name,
    currentUser?.email,
    classes,
  ])

  const myClasses = useMemo(() => {
    const coachNameLower = String(currentUser.name || "").trim().toLowerCase()
    return classes.filter(
      (c) =>
        (resolvedCoachId &&
          String(c.coachId) === String(resolvedCoachId)) ||
        (!apiEnabled && currentUser.id && String(c.coachId) === String(currentUser.id)) ||
        (coachNameLower &&
          String(c.coachName || "")
            .trim()
            .toLowerCase()
            .includes(coachNameLower)),
    )
  }, [apiEnabled, classes, resolvedCoachId, currentUser.id, currentUser.name])

  const [apiSessions, setApiSessions] = useState([])
  const [apiTimeSlots, setApiTimeSlots] = useState(DEFAULT_TIME_SLOTS)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [absenceNoticesBySession, setAbsenceNoticesBySession] = useState({})
  const [expandedNoticeSessionIds, setExpandedNoticeSessionIds] = useState({})
  const [loggedResultSessionIds, setLoggedResultSessionIds] = useState(
    () => new Set(),
  )

  // Work schedule state (/api/coaches/{id}/work-schedule)
  const [acceptingNew, setAcceptingNew] = useState(true)
  const [weeklySlots, setWeeklySlots] = useState([])
  const [daysOff, setDaysOff] = useState([])
  const [isWorkScheduleDirty, setIsWorkScheduleDirty] = useState(false)
  const [savingWorkSchedule, setSavingWorkSchedule] = useState(false)

  const loadCoachScheduleData = useCallback(async () => {
    if (!apiEnabled) return
    setLoadingSessions(true)
    try {
      const catalogPromises = myClasses.map((cls) =>
        getCatalogClassSessions(cls.id, { notifyForbidden: false })
          .then((list) =>
            Array.isArray(list)
              ? list.map((s) => ({
                  ...s,
                  classId: s.classId ?? cls.id,
                  className: s.className || cls.nameVi || cls.name,
                  subjectName: s.subjectName || cls.category || "Thể thao",
                  enrolledCount: s.enrolledCount ?? cls.enrolledCount ?? 0,
                  maxCapacity: apiEnabled
                    ? s.maxCapacity ?? cls.capacity ?? null
                    : s.maxCapacity ?? cls.capacity ?? 12,
                }))
              : [],
          )
          .catch(() => []),
      )

      const classSessionPromises = myClasses.map((cls) =>
        memberPortalApi
          .getClassSessions({ classId: cls.id })
          .then((list) =>
            Array.isArray(list)
              ? list.map((s) => ({
                  ...s,
                  classId: s.classId ?? cls.id,
                  className: s.className || cls.nameVi || cls.name,
                  subjectName: s.subjectName || cls.category || "Thể thao",
                  enrolledCount: s.enrolledCount ?? cls.enrolledCount ?? 0,
                  maxCapacity: apiEnabled
                    ? s.maxCapacity ?? cls.capacity ?? null
                    : s.maxCapacity ?? cls.capacity ?? 12,
                }))
              : [],
          )
          .catch(() => []),
      )

      const [
        generalSessions,
        catalogArrays,
        classDirectArrays,
        workData,
        resultsList,
        slotsList,
      ] = await Promise.all([
        resolvedCoachId
          ? memberPortalApi.getClassSessions({ coachId: resolvedCoachId }).catch(() => [])
          : Promise.resolve([]),
        Promise.all(catalogPromises),
        Promise.all(classSessionPromises),
        resolvedCoachId
          ? memberPortalApi
              .getCoachWorkSchedule(resolvedCoachId)
              .catch(() => null)
          : Promise.resolve(null),
        memberPortalApi
          .getTrainingResults(
            resolvedCoachId ? { coachId: resolvedCoachId } : {},
          )
          .catch(() => []),
        memberPortalApi.getTimeSlots().catch(() => []),
      ])

      if (Array.isArray(slotsList) && slotsList.length > 0) {
        const sortedSlots = [...slotsList].sort(
          (a, b) => Number(a.slotNumber || 0) - Number(b.slotNumber || 0),
        )
        setApiTimeSlots(sortedSlots)
      }

      if (Array.isArray(resultsList)) {
        setLoggedResultSessionIds(
          new Set(
            resultsList
              .map((r) => (r.sessionId != null ? String(r.sessionId) : null))
              .filter(Boolean),
          ),
        )
      }

      const myClassMap = new Map(myClasses.map((c) => [String(c.id), c]))
      const nameLower = String(currentUser?.name || "")
        .trim()
        .toLowerCase()

      const sessionMap = new Map()
      const addSession = (s) => {
        if (!s || !s.id) return
        const prev = sessionMap.get(String(s.id)) || {}
        const matchedClass = s.classId ? myClassMap.get(String(s.classId)) : null
        const matchedRoom = s.roomId
          ? rooms?.find((r) => String(r.id) === String(s.roomId))
          : null
        sessionMap.set(String(s.id), {
          ...prev,
          ...s,
          status: s.status || prev.status || null,
          className:
            s.className ||
            prev.className ||
            matchedClass?.nameVi ||
            matchedClass?.name ||
            "",
          subjectName:
            s.subjectName ||
            prev.subjectName ||
            matchedClass?.category ||
            "Thể thao",
          roomName:
            s.roomName ||
            prev.roomName ||
            matchedRoom?.name ||
            matchedClass?.roomVi ||
            matchedClass?.room ||
            (s.roomId ? `Sân/Phòng #${s.roomId}` : "Sân tập trung tâm"),
          enrolledCount:
            s.enrolledCount ?? prev.enrolledCount ?? matchedClass?.enrolledCount ?? 0,
          maxCapacity: apiEnabled
            ? s.maxCapacity ?? prev.maxCapacity ?? matchedClass?.capacity ?? null
            : s.maxCapacity ?? prev.maxCapacity ?? matchedClass?.capacity ?? 12,
        })
      }

      catalogArrays.flat().forEach(addSession)
      classDirectArrays.flat().forEach(addSession)

      if (Array.isArray(generalSessions)) {
        generalSessions.forEach((s) => {
          const belongsToCoach =
            (resolvedCoachId && s.coachId != null &&
              String(s.coachId) === String(resolvedCoachId)) ||
            (resolvedCoachId && s.coachId == null) ||
            (!apiEnabled && String(s.coachId) === String(currentUser?.id)) ||
            (nameLower &&
              String(s.coachName || "")
                .trim()
                .toLowerCase()
                .includes(nameLower)) ||
            (s.classId && myClassMap.has(String(s.classId)))
          if (belongsToCoach) {
            addSession(s)
          }
        })
      }

      const mergedSessions = Array.from(sessionMap.values()).sort((a, b) => {
        const dA = `${a.sessionDate || ""}T${a.startTime || "00:00"}`
        const dB = `${b.sessionDate || ""}T${b.startTime || "00:00"}`
        return dA.localeCompare(dB)
      })
      setApiSessions(mergedSessions)

      // R3.3: Silently prefetch absence notices so we only show "Báo vắng (N)" on sessions that actually have notices
      Promise.all(
        mergedSessions
          .filter((s) => !isSessionCancelled(s))
          .map((s) =>
            memberPortalApi
              .getSessionAbsenceNotices(s.id)
              .then((list) => [String(s.id), Array.isArray(list) ? list : []])
              .catch(() => [String(s.id), []]),
          ),
      ).then((entries) => {
        setAbsenceNoticesBySession(Object.fromEntries(entries))
      })

      if (workData && typeof workData === "object") {
        if (typeof workData.acceptingNew === "boolean") {
          setAcceptingNew(workData.acceptingNew)
        }
        if (Array.isArray(workData.weeklySlots)) {
          setWeeklySlots(normalizeWeeklySlotsArray(workData.weeklySlots))
        }
        if (Array.isArray(workData.daysOff)) {
          setDaysOff(
            workData.daysOff
              .map((d) => String(d || "").trim().slice(0, 10))
              .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
          )
        }
        setIsWorkScheduleDirty(false)
      }
    } finally {
      setLoadingSessions(false)
    }
  }, [
    apiEnabled,
    resolvedCoachId,
    myClasses,
    rooms,
    currentUser?.id,
    currentUser?.name,
    apiEnabled,
  ])

  useEffect(() => {
    loadCoachScheduleData()
  }, [loadCoachScheduleData])

  const privateSessions = useMemo(
    () => apiSessions.filter((s) => s.isPrivate === true),
    [apiSessions],
  )

  const toggleNoticeExpand = (sessionId) => {
    setExpandedNoticeSessionIds((prev) => ({
      ...prev,
      [String(sessionId)]: !prev[String(sessionId)],
    }))
  }

  const handleSaveWorkSchedule = async (e) => {
    if (e) e.preventDefault()
    if (!apiEnabled) {
      setIsWorkScheduleDirty(false)
      showToast?.(t("coachWorkScheduleSavedToast"), "success")
      return
    }
    if (!resolvedCoachId) {
      showToast?.(
        language === "vi"
          ? "Đang xác thực thông tin Huấn luyện viên, vui lòng thử lại sau giây lát."
          : "Verifying Coach profile, please try again in a moment.",
        "warning",
      )
      return
    }
    setSavingWorkSchedule(true)
    try {
      const cleanSlots = normalizeWeeklySlotsArray(weeklySlots)
      await memberPortalApi.updateCoachWorkSchedule(resolvedCoachId, {
        acceptingNew: Boolean(acceptingNew),
        weeklySlots: cleanSlots,
        daysOff,
      })
      setIsWorkScheduleDirty(false)
      showToast?.(t("coachWorkScheduleSavedToast"), "success")
    } catch (err) {
      showToast?.(
        getErrorMessage(err, "Không thể cập nhật lịch làm việc của HLV."),
        "error",
      )
    } finally {
      setSavingWorkSchedule(false)
    }
  }

  const availableRooms = useMemo(() => {
    const set = new Set()
    myClasses.forEach((c) => {
      if (c.room) set.add(c.room)
    })
    apiSessions.forEach((s) => {
      if (s.roomName) set.add(s.roomName)
    })
    return Array.from(set)
  }, [myClasses, apiSessions])

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const filteredSessions = useMemo(() => {
    return apiSessions.filter((s) => {
      if (selectedRoom !== "all" && s.roomName !== selectedRoom) {
        return false
      }
      if (scheduleFilter === "upcoming") {
        return String(s.sessionDate || "") >= todayIso
      }
      if (scheduleFilter === "group") {
        return !s.isPrivate
      }
      if (scheduleFilter === "pt") {
        return s.isPrivate === true
      }
      return true
    })
  }, [apiSessions, selectedRoom, scheduleFilter, todayIso])

  const groupedSessions = useMemo(() => {
    const today = []
    const upcoming = []
    const past = []
    filteredSessions.forEach((s) => {
      const dateStr = String(s.sessionDate || "").slice(0, 10)
      if (!dateStr || dateStr === todayIso) {
        today.push(s)
      } else if (dateStr > todayIso) {
        upcoming.push(s)
      } else {
        past.push(s)
      }
    })
    return { today, upcoming, past }
  }, [filteredSessions, todayIso])

  const coachClassesForDisplay = useMemo(() => {
    const byClassId = new Map(myClasses.map((cls) => [String(cls.id), cls]))
    const sessionsByClassId = new Map()
    apiSessions.forEach((session) => {
      const isNormalSession = session.isPrivate === false ||
        String(session.classType || "").trim().toLowerCase() === "normal"
      if (!isNormalSession || session.classId == null) return
      const key = String(session.classId)
      const list = sessionsByClassId.get(key) || []
      list.push(session)
      sessionsByClassId.set(key, list)
    })

    sessionsByClassId.forEach((classSessions, classId) => {
      if (byClassId.has(classId)) return
      const firstSession = classSessions[0]
      const className = firstSession.className || `Lớp #${classId}`
      byClassId.set(classId, {
        id: firstSession.classId,
        name: className,
        nameVi: className,
        category: firstSession.subjectName || "Thể thao",
        classType: "Normal",
        coachId: firstSession.coachId ?? resolvedCoachId,
        coachName: firstSession.coachName || currentUser?.name || "",
        room: firstSession.roomName || "Sân tập trung tâm",
        roomVi: firstSession.roomName || "Sân tập trung tâm",
        capacity: firstSession.maxCapacity ?? null,
        enrolledCount: firstSession.enrolledCount ?? 0,
        date: firstSession.sessionDate,
        startDate: firstSession.sessionDate,
        startTime: firstSession.startTime,
        endTime: firstSession.endTime,
        sessionCount: classSessions.length,
      })
    })

    return Array.from(byClassId.values())
  }, [apiSessions, currentUser?.name, myClasses, resolvedCoachId])

  const filteredClasses = useMemo(() => {
    return coachClassesForDisplay
      .map((cls) => {
        const clsSessions = apiSessions.filter(
          (s) => String(s.classId) === String(cls.id),
        )
        const firstSes = clsSessions[0] || null
        const resolvedRoom =
          cls.roomVi ||
          cls.room ||
          firstSes?.roomName ||
          "Sân tập trung tâm"
        const resolvedTime = firstSes
          ? formatTimeRange(firstSes.startTime, firstSes.endTime)
          : cls.startTime || "Theo lịch từng buổi"
        return {
          ...cls,
          resolvedRoom,
          resolvedTime,
          sessionCount: clsSessions.length || cls.totalSessions || 0,
        }
      })
      .filter((cls) =>
        selectedRoom === "all" ? true : cls.resolvedRoom === selectedRoom,
      )
  }, [coachClassesForDisplay, apiSessions, selectedRoom])

  const handleGoToAttendance = (clsOrSession) => {
    if (typeof window !== "undefined") {
      if (clsOrSession?.isPrivate === true) {
        sessionStorage.setItem("scms_selected_attendance_class_id", "PT_1ON1")
      } else {
        const classId = clsOrSession?.classId ?? clsOrSession?.id
        if (classId) {
          sessionStorage.setItem(
            "scms_selected_attendance_class_id",
            String(classId),
          )
        }
      }
      if (clsOrSession?.sessionDate && clsOrSession?.id) {
        sessionStorage.setItem(
          "scms_selected_attendance_session_id",
          String(clsOrSession.id),
        )
      }
    }
    setCurrentTab("attendance")
    navigate("/coach/attendance")
  }

  const handleGoToPtResult = (ses) => {
    if (typeof window !== "undefined") {
      if (ses?.bookedMemberId) {
        sessionStorage.setItem(
          "scms_selected_progress_member_id",
          String(ses.bookedMemberId),
        )
      }
      sessionStorage.setItem("scms_selected_progress_tab", "logs")
      if (ses?.id) {
        sessionStorage.setItem(
          "scms_selected_progress_session_id",
          String(ses.id),
        )
      }
    }
    setCurrentTab("trainingProgress")
    navigate("/coach/progress")
  }

  const renderSessionCard = (ses, index, groupType = "") => {
    const notices = absenceNoticesBySession[ses.id]
    const hasNotices = Array.isArray(notices) && notices.length > 0
    const isNoticeExpanded = Boolean(expandedNoticeSessionIds[String(ses.id)])
    const isToday = String(ses.sessionDate || "") === todayIso
    const sessionCancelled = isSessionCancelled(ses)
    const sessionCanCheckIn = canCheckIn(ses)
    const hasLoggedResult = loggedResultSessionIds.has(String(ses.id))

    return (
      <div
        key={ses.id || index}
        className={`rounded-lg border p-4 text-text-primary transition-colors space-y-2 ${
          sessionCancelled
            ? "bg-bg-secondary border-border-color opacity-85"
            : isToday
              ? "bg-sky-50/40 border-status-info-border"
              : "bg-bg-secondary border-border-color hover:bg-bg-card"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                  ses.isPrivate
                    ? "bg-status-success-bg text-status-success ring-1 ring-inset ring-status-success-border"
                    : "bg-status-info-bg text-status-info ring-1 ring-inset ring-status-info-border"
                }`}
              >
                {ses.isPrivate ? "PT 1:1" : ses.subjectName || "Lớp nhóm"}
              </span>
              <span className="text-sm leading-5 font-semibold text-text-primary">
                {ses.isPrivate
                  ? `${ses.subjectName || "Kèm PT 1:1"} — Học viên: ${
                      ses.bookedMemberName || "Hội viên PT"
                    }`
                  : ses.className || "Buổi học lớp nhóm"}
              </span>
              {/* R4.3: Do not repeat "Hôm nay" badge inside the "Hôm nay" group header */}
              {isToday && groupType !== "today" && (
                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-status-warning-bg text-status-warning ring-1 ring-inset ring-status-warning-border">
                  {t("coachTodayGroup")}
                </span>
              )}
              <CoachStatusBadge
                type="session"
                value={
                  sessionCancelled && ses.centerInvalidated
                    ? "centerInvalidated"
                    : ses.status || "Scheduled"
                }
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm leading-5 text-text-secondary">
              <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                <Calendar className="w-3.5 h-3.5 text-brand-primary" />
                <span>{formatSessionDayLabel(ses.sessionDate, language)}</span>
              </div>

              <div className="flex items-center gap-1.5 font-mono font-semibold text-text-primary bg-bg-card px-2.5 py-0.5 rounded border border-border-color">
                <Clock className="w-3.5 h-3.5 text-brand-primary" />
                <span>{formatTimeRange(ses.startTime, ses.endTime)}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-status-danger" />
                <span className="font-semibold text-text-primary">
                  {ses.roomName || "Sân tập trung tâm"}
                </span>
              </div>

              {!ses.isPrivate && (
                (() => {
                  const hasReliableSessionCapacity =
                    Number.isInteger(ses.maxCapacity) && ses.maxCapacity > 0
                  const displaySessionCapacity = apiEnabled
                    ? (hasReliableSessionCapacity ? ses.maxCapacity : "—")
                    : (ses.maxCapacity ?? 12)
                  return (
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-text-muted" />
                      <span
                        className="font-mono font-semibold text-text-primary"
                        title={
                          apiEnabled && !hasReliableSessionCapacity
                            ? language === "vi"
                              ? "Chưa xác định sức chứa"
                              : "Capacity unverified"
                            : undefined
                        }
                      >
                        {ses.enrolledCount ?? 0}/{displaySessionCapacity}{" "}
                        {language === "vi" ? "học viên" : "members"}
                      </span>
                    </div>
                  )
                })()
              )}
            </div>

            {sessionCancelled && (
              <div className="text-xs leading-4 font-medium text-status-danger bg-status-danger-bg border border-status-danger-border rounded px-3 py-1.5">
                {ses.centerInvalidated
                  ? t("coachBannerCenterInvalidatedDesc")
                  : t("coachBannerCancelledDesc")}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* R3.3: Only show absence notice button/badge when the session actually has absence notices */}
            {hasNotices && (
              <button
                type="button"
                onClick={() => toggleNoticeExpand(ses.id)}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-2.5 text-xs font-medium leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary cursor-pointer"
              >
                <AlertCircle className="w-3.5 h-3.5 text-status-warning" />
                <span>
                  {t("coachAbsenceNoticeCountBadge").replace(
                    "{count}",
                    String(notices.length),
                  )}
                </span>
              </button>
            )}

            {/* R3.3: Primary action for Group Classes vs PT 1:1 Sessions */}
            {!sessionCancelled &&
              (ses.isPrivate ? (
                sessionCanCheckIn ? (
                  <button
                    type="button"
                    onClick={() => handleGoToAttendance(ses)}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-3 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t("coachBtnCheckInThisSession")}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleGoToPtResult(ses)}
                    className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-3 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none cursor-pointer ${
                      hasLoggedResult
                        ? "border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary"
                        : "bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {hasLoggedResult
                        ? t("coachBtnViewResult")
                        : t("coachBtnLogResult")}
                    </span>
                  </button>
                )
              ) : (
                <button
                  type="button"
                  onClick={() => handleGoToAttendance(ses)}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-3 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {sessionCanCheckIn
                      ? t("coachBtnCheckInThisSession")
                      : t("coachBtnViewOrCorrectAttendance")}
                  </span>
                </button>
              ))}
          </div>
        </div>

        {hasNotices && isNoticeExpanded && (
          <div className="pt-2 border-t border-border-color text-sm leading-5 space-y-1">
            {notices.map((n, idx) => (
              <div
                key={n.id || idx}
                className="p-2.5 bg-status-warning-bg border border-status-warning-border rounded text-status-warning flex items-center justify-between"
              >
                <span>
                  <strong>{n.memberName || "Học viên"}</strong>:{" "}
                  {n.reason || "Xin phép vắng buổi học"}
                </span>
                <span className="font-mono text-xs leading-4 text-status-warning">
                  {formatDateTime(n.reportedAt || n.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      {/* Coach schedule header */}
      <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-bg-secondary text-brand-primary rounded border border-border-color">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl leading-7 font-semibold text-text-primary whitespace-nowrap">
                {language === "vi" ? "Thời khóa biểu & Lịch dạy" : t("schedule")}
              </h2>
              <p className="text-sm leading-5 text-text-secondary">
                {language === "vi"
                  ? "Thời khóa biểu tuần trực quan (Thứ/Ca học/Sân tập), danh sách từng ca dạy"
                  : "Visual weekly timetable by slot and room, with a detailed session list"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {apiEnabled && (
              <button
                type="button"
                onClick={loadCoachScheduleData}
                disabled={loadingSessions}
                aria-label={t("coachBtnRefresh")}
                title={t("coachBtnRefresh")}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none border border-border-color bg-bg-card text-text-secondary hover:bg-bg-secondary hover:text-text-primary cursor-pointer"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loadingSessions ? "animate-spin" : ""}`}
                />
              </button>
            )}
            <Filter className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs leading-4 font-medium text-text-secondary">
              Lọc theo phòng:
            </span>
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="min-h-11 w-full sm:w-48 rounded border border-border-strong bg-bg-card px-3 py-1.5 text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted cursor-pointer"
            >
              <option value="all">
                {language === "vi" ? "Tất cả phòng / sân" : "All Rooms"}
              </option>
              {availableRooms.map((roomName) => (
                <option key={roomName} value={roomName}>
                  {roomName}
                </option>
              ))}
            </select>
          </div>
        </div>

      </div>

      {activeTab === "schedule" ? (
        <>
          {/* Section 1: Detailed Sessions Schedule */}
          <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border-color pb-3">
              <div>
                <h3 className="text-lg leading-7 font-semibold text-text-primary flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-primary" />
                  <span>Thời khóa biểu các buổi giảng dạy chi tiết</span>
                </h3>
                <p className="text-sm leading-5 text-text-secondary mt-0.5">
                  {t("coachScheduleSubtitleShort")}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* View Mode Toggle: Week Grid vs List */}
                <div className="inline-flex rounded border border-border-color bg-bg-secondary p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("week")}
                    className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-3 text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none cursor-pointer ${
                      viewMode === "week"
                        ? "bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active"
                        : "border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary"
                    }`}
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>{language === "vi" ? "Thời khóa biểu tuần" : t("coachViewWeek")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-3 text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none cursor-pointer ${
                      viewMode === "list"
                        ? "bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active"
                        : "border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary"
                    }`}
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                    <span>{language === "vi" ? "Danh sách chi tiết" : t("coachViewList")}</span>
                  </button>
                </div>

                {[
                  { id: "all", label: `Tất cả (${apiSessions.length})` },
                  { id: "upcoming", label: "Sắp tới / Hôm nay" },
                  {
                    id: "group",
                    label: `Lớp nhóm (${apiSessions.filter((s) => !s.isPrivate).length})`,
                  },
                  {
                    id: "pt",
                    label: `PT 1:1 (${privateSessions.length})`,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setScheduleFilter(tab.id)}
                    className={`inline-flex min-h-11 items-center justify-center gap-1 rounded px-2.5 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none cursor-pointer ${
                      scheduleFilter === tab.id
                        ? "bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active"
                        : "border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {loadingSessions ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 bg-bg-secondary animate-pulse rounded-lg border border-border-color"
                  />
                ))}
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="p-6 text-center text-sm leading-5 text-text-secondary bg-bg-secondary border border-border-color rounded-lg">
                Không có buổi dạy nào khớp với bộ lọc hiện tại.
              </div>
            ) : viewMode === "week" ? (
              /* Weekly 7 days x 8 slots Grid View */
              <div className="w-full overflow-x-auto rounded-lg border border-border-color bg-bg-card">
                <table className="w-full min-w-full text-left text-sm border-collapse">
                  <thead className="bg-bg-secondary text-xs font-semibold text-text-secondary">
                    <tr>
                      <th className="px-4 py-3 text-left align-middle border-r border-border-color w-32">
                        Ca / Thứ
                      </th>
                      {WEEKDAYS.map((day) => (
                        <th
                          key={day.key}
                          className="px-4 py-3 text-center align-middle border-r last:border-r-0 border-border-color"
                        >
                          {t(day.labelKey)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-color">
                    {apiTimeSlots.map((slot) => (
                      <tr key={slot.slotNumber} className="transition-colors hover:bg-bg-secondary/70">
                        <td className="px-4 py-3 align-middle text-sm leading-5 text-text-primary border-r border-border-color bg-bg-secondary/60 font-semibold">
                          <div>{slot.name}</div>
                          <div className="text-xs leading-4 font-mono text-text-secondary">
                            {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                          </div>
                        </td>
                        {WEEKDAYS.map((day) => {
                          const cellSessions = filteredSessions.filter(
                            (s) =>
                              getSessionWeekdayKey(s.sessionDate) === day.key &&
                              resolveSessionSlotNumber(s) === slot.slotNumber,
                          )
                          return (
                            <td
                              key={`${day.key}-${slot.slotNumber}`}
                              className="px-4 py-3 align-top text-sm leading-5 text-text-primary border-r last:border-r-0 border-border-color min-w-[110px]"
                            >
                              <div className="space-y-1.5">
                                {cellSessions.map((ses) => {
                                  const cancelled = isSessionCancelled(ses)
                                  const canInteract = !ses.isPrivate && !cancelled
                                  return (
                                    <div
                                      key={ses.id}
                                      role={canInteract ? "button" : undefined}
                                      tabIndex={canInteract ? 0 : undefined}
                                      aria-label={
                                        canInteract
                                          ? `${ses.className || ses.subjectName || "PT 1:1"} - ${formatDate(ses.sessionDate)} - ${ses.roomName}`
                                          : undefined
                                      }
                                      onClick={() => {
                                        if (canInteract) {
                                          handleGoToAttendance(ses)
                                        }
                                      }}
                                      onKeyDown={
                                        canInteract
                                          ? (e) => {
                                              if (e.key === "Enter" || e.key === " ") {
                                                if (e.key === " ") {
                                                  e.preventDefault()
                                                }
                                                handleGoToAttendance(ses)
                                              }
                                            }
                                          : undefined
                                      }
                                      className={`p-2 rounded border text-xs leading-4 space-y-1 ${
                                        cancelled
                                          ? "bg-status-danger-bg border-status-danger-border text-status-danger opacity-75"
                                          : ses.isPrivate
                                            ? "bg-status-success-bg border-status-success-border text-status-success"
                                            : "bg-status-info-bg border-status-info-border text-status-info cursor-pointer hover:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                                      }`}
                                    >
                                      <div className="font-semibold">
                                        {ses.className || ses.subjectName || "PT 1:1"}
                                      </div>
                                      <div className="font-mono text-xs leading-4">
                                        {formatDate(ses.sessionDate)}
                                      </div>
                                      <div className="text-xs leading-4 text-text-secondary">
                                        {ses.roomName}
                                      </div>
                                      <CoachStatusBadge
                                        type="session"
                                        value={
                                          cancelled && ses.centerInvalidated
                                            ? "centerInvalidated"
                                            : ses.status || "Scheduled"
                                        }
                                      />
                                    </div>
                                  )
                                })}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Grouped List View: Today / Upcoming / Past (collapsed by default) */
              <div className="space-y-5">
                {groupedSessions.today.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-status-warning-bg text-status-warning ring-1 ring-inset ring-status-warning-border">
                        {t("coachTodayGroup")} ({groupedSessions.today.length})
                      </span>
                    </div>
                    <div className="space-y-3">
                      {groupedSessions.today.map((s, idx) =>
                        renderSessionCard(s, idx, "today"),
                      )}
                    </div>
                  </div>
                )}

                {groupedSessions.upcoming.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-status-info-bg text-status-info ring-1 ring-inset ring-status-info-border">
                        {t("coachUpcomingGroup")} ({groupedSessions.upcoming.length})
                      </span>
                    </div>
                    <div className="space-y-3">
                      {groupedSessions.upcoming.map((s, idx) =>
                        renderSessionCard(s, idx, "upcoming"),
                      )}
                    </div>
                  </div>
                )}

                {groupedSessions.past.length > 0 && (
                  <div className="space-y-2.5 pt-2 border-t border-border-color">
                    <button
                      type="button"
                      onClick={() => setShowPastSessions((v) => !v)}
                      className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded px-4 py-2 text-sm font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary cursor-pointer"
                    >
                      <span>
                        {t("coachPastGroup")} ({groupedSessions.past.length})
                      </span>
                      <span className="flex items-center gap-1">
                        {showPastSessions ? (
                          <>
                            <span>{t("coachCollapse")}</span>
                            <ChevronUp className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            <span>{t("coachShowMore")}</span>
                            <ChevronDown className="w-4 h-4" />
                          </>
                        )}
                      </span>
                    </button>
                    {showPastSessions && (
                      <div className="space-y-3">
                        {groupedSessions.past.map((s, idx) =>
                          renderSessionCard(s, idx, "past"),
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 2: Assigned Courses Summary */}
          <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-4">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <h3 className="text-lg leading-7 font-semibold text-text-primary flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand-primary" />
                <span>Danh sách khóa / lớp học đang phụ trách</span>
              </h3>
              <span className="text-xs leading-4 font-medium text-text-secondary font-mono">
                Tổng số: {filteredClasses.length} lớp
              </span>
            </div>

            <div className="space-y-3">
              {filteredClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="p-4 bg-bg-secondary border border-border-color rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-bg-card transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-status-info-bg text-status-info ring-1 ring-inset ring-status-info-border">
                        {cls.category || "Thể thao"}
                      </span>
                      <span className="text-sm leading-5 font-semibold text-text-primary">
                        {language === "vi" ? cls.nameVi || cls.name : cls.name}
                      </span>
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-bg-card text-text-secondary ring-1 ring-inset ring-border-color font-mono">
                        {cls.sessionCount} buổi học
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm leading-5 text-text-secondary">
                      <div className="flex items-center gap-1 font-mono tabular-nums">
                        <Calendar className="w-3.5 h-3.5 text-text-muted" />
                        <span>
                          Khóa học: {formatDate(cls.date || cls.startDate)}
                          {cls.endDate
                            ? ` – ${formatDate(cls.endDate)}`
                            : ""}{" "}
                          &bull; Ca dạy: {cls.resolvedTime}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-text-muted" />
                        <span className="font-semibold text-text-primary">
                          {cls.resolvedRoom}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-text-muted" />
                        {(() => {
                          const hasReliableCapacity =
                            Number.isInteger(cls.capacity) && cls.capacity > 0
                          const displayCapacity = apiEnabled
                            ? (hasReliableCapacity ? cls.capacity : "—")
                            : (cls.capacity ?? 12)
                          return (
                            <span
                              className="font-mono tabular-nums font-semibold text-text-primary"
                              title={
                                apiEnabled && !hasReliableCapacity
                                  ? language === "vi"
                                    ? "Chưa xác định sức chứa"
                                    : "Capacity unverified"
                                  : undefined
                              }
                            >
                              {cls.enrolledCount ?? 0}/{displayCapacity}{" "}
                              {language === "vi" ? "học viên" : "members"}
                            </span>
                          )
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleGoToAttendance(cls)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Mở sổ điểm danh lớp</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* Tab 2: Coach Work Schedule Configuration (P2.3) */
        <form
          onSubmit={handleSaveWorkSchedule}
          className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-color pb-4">
            <div>
              <h3 className="text-lg leading-7 font-semibold text-text-primary">
                {t("coachTabWorkSchedule")}
              </h3>
              <p className="text-sm leading-5 text-text-secondary mt-0.5">
                {t("coachWorkScheduleSubtitleShort")}
              </p>
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm leading-5 font-semibold text-text-primary cursor-pointer bg-bg-secondary px-3 py-2.5 rounded border border-border-color">
              <input
                type="checkbox"
                checked={acceptingNew}
                onChange={(e) => {
                  setAcceptingNew(e.target.checked)
                  setIsWorkScheduleDirty(true)
                }}
                className="rounded border-border-strong text-brand-primary focus:ring-brand-primary"
              />
              <span>{t("coachAcceptingNewLabel")}</span>
            </label>
          </div>

          <WeeklySlotGrid
            selectedSlots={weeklySlots}
            onChange={(nextSlots) => {
              setWeeklySlots(nextSlots)
              setIsWorkScheduleDirty(true)
            }}
            disabled={savingWorkSchedule}
          />

          <div className="border-t border-border-color pt-4">
            <DaysOffPicker
              daysOff={daysOff}
              onChange={(nextDays) => {
                setDaysOff(nextDays)
                setIsWorkScheduleDirty(true)
              }}
              scheduledSessions={apiSessions}
              disabled={savingWorkSchedule}
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border-color pt-4">
            <button
              type="submit"
              disabled={savingWorkSchedule || (apiEnabled && !isWorkScheduleDirty)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>
                {savingWorkSchedule
                  ? "Đang lưu..."
                  : t("coachWorkScheduleSaveBtn")}
              </span>
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
