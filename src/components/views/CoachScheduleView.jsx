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
  const [activeTab, setActiveTab] = useState("schedule") // 'schedule' | 'work_schedule'
  const [viewMode, setViewMode] = useState("list") // 'list' | 'week'
  const [selectedRoom, setSelectedRoom] = useState("all")
  const [scheduleFilter, setScheduleFilter] = useState("all") // all | upcoming | group | pt
  const [showPastSessions, setShowPastSessions] = useState(false)

  const resolvedCoachId = useMemo(() => {
    const raw = currentUser?.coachId ?? currentUser?.id
    const num = Number(raw)
    return Number.isInteger(num) && num > 0 ? num : null
  }, [currentUser?.coachId, currentUser?.id])

  const myClasses = useMemo(() => {
    const coachNameLower = String(currentUser.name || "").trim().toLowerCase()
    return classes.filter(
      (c) =>
        (resolvedCoachId &&
          String(c.coachId) === String(resolvedCoachId)) ||
        (currentUser.id && String(c.coachId) === String(currentUser.id)) ||
        (coachNameLower &&
          String(c.coachName || "")
            .trim()
            .toLowerCase()
            .includes(coachNameLower)),
    )
  }, [classes, resolvedCoachId, currentUser.id, currentUser.name])

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
                  maxCapacity: s.maxCapacity ?? cls.capacity ?? 12,
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
                  maxCapacity: s.maxCapacity ?? cls.capacity ?? 12,
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
        memberPortalApi.getClassSessions().catch(() => []),
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
          maxCapacity:
            s.maxCapacity ?? prev.maxCapacity ?? matchedClass?.capacity ?? 12,
        })
      }

      catalogArrays.flat().forEach(addSession)
      classDirectArrays.flat().forEach(addSession)

      if (Array.isArray(generalSessions)) {
        generalSessions.forEach((s) => {
          const belongsToCoach =
            (resolvedCoachId &&
              String(s.coachId) === String(resolvedCoachId)) ||
            String(s.coachId) === String(currentUser?.id) ||
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
      showToast?.("Không xác định được mã HLV để cập nhật lịch làm việc.", "warning")
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

  const filteredClasses = useMemo(() => {
    return myClasses
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
  }, [myClasses, apiSessions, selectedRoom])

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
        className={`p-4 rounded-lg border transition-all space-y-2 ${
          sessionCancelled
            ? "bg-slate-100/80 border-slate-300 opacity-85"
            : isToday
              ? "bg-blue-50/50 border-blue-300"
              : "bg-slate-50 border-slate-200 hover:border-slate-300"
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-bold border ${
                  ses.isPrivate
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-blue-100 text-blue-900 border-blue-200"
                }`}
              >
                {ses.isPrivate ? "PT 1:1" : ses.subjectName || "Lớp nhóm"}
              </span>
              <span className="text-sm font-bold text-slate-900">
                {ses.isPrivate
                  ? `${ses.subjectName || "Kèm PT 1:1"} — Học viên: ${
                      ses.bookedMemberName || "Hội viên PT"
                    }`
                  : ses.className || "Buổi học lớp nhóm"}
              </span>
              {/* R4.3: Do not repeat "Hôm nay" badge inside the "Hôm nay" group header */}
              {isToday && groupType !== "today" && (
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-xs font-bold">
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

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                <Calendar className="w-3.5 h-3.5 text-blue-700" />
                <span>{formatSessionDayLabel(ses.sessionDate, language)}</span>
              </div>

              <div className="flex items-center gap-1.5 font-mono font-bold text-blue-900 bg-white px-2.5 py-0.5 rounded border border-slate-200">
                <Clock className="w-3.5 h-3.5 text-blue-700" />
                <span>{formatTimeRange(ses.startTime, ses.endTime)}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-600" />
                <span className="font-semibold text-slate-800">
                  {ses.roomName || "Sân tập trung tâm"}
                </span>
              </div>

              {!ses.isPrivate && (
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-mono font-bold text-slate-900">
                    {ses.enrolledCount ?? 0}/{ses.maxCapacity ?? 12} học viên
                  </span>
                </div>
              )}
            </div>

            {sessionCancelled && (
              <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded px-3 py-1.5">
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
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded text-xs font-bold text-amber-900 flex items-center gap-1.5 cursor-pointer"
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
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
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t("coachBtnCheckInThisSession")}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleGoToPtResult(ses)}
                    className={`px-3.5 py-1.5 rounded text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer ${
                      hasLoggedResult
                        ? "bg-white hover:bg-slate-100 text-slate-800 border border-slate-300"
                        : "bg-emerald-700 hover:bg-emerald-800 text-white"
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
                  className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
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
          <div className="pt-2 border-t border-slate-200 text-xs space-y-1">
            {notices.map((n, idx) => (
              <div
                key={n.id || idx}
                className="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-900 flex items-center justify-between"
              >
                <span>
                  <strong>{n.memberName || "Học viên"}</strong>:{" "}
                  {n.reason || "Xin phép vắng buổi học"}
                </span>
                <span className="font-mono text-xs text-amber-700">
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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header + Top-level Tabs */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-800 rounded border border-blue-200">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 whitespace-nowrap">
                {t("schedule")}
              </h2>
              <p className="text-xs text-slate-500">
                {language === "vi"
                  ? "Thời khóa biểu từng buổi dạy (Thứ/Ngày, Khung giờ, Sân tập), ca PT 1:1 & cấu hình lịch làm việc"
                  : "Detailed teaching schedule by session, 1:1 private PT sessions & work schedule configuration"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {apiEnabled && (
              <button
                type="button"
                onClick={loadCoachScheduleData}
                disabled={loadingSessions}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loadingSessions ? "animate-spin" : ""}`}
                />
                <span>{t("coachBtnRefresh")}</span>
              </button>
            )}
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-700">
              Lọc theo phòng:
            </span>
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
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

        {/* Top-level Tabs (P2.1) */}
        <div
          role="tablist"
          className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "schedule"}
            onClick={() => setActiveTab("schedule")}
            className={`px-4 py-2 rounded text-xs font-bold border transition-colors cursor-pointer ${
              activeTab === "schedule"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            {t("coachTabScheduleClasses")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "work_schedule"}
            onClick={() => setActiveTab("work_schedule")}
            className={`px-4 py-2 rounded text-xs font-bold border transition-colors cursor-pointer ${
              activeTab === "work_schedule"
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            {t("coachTabWorkSchedule")}
          </button>
        </div>
      </div>

      {activeTab === "schedule" ? (
        <>
          {/* Section 1: Detailed Sessions Schedule */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-700" />
                  <span>Thời khóa biểu các buổi giảng dạy chi tiết</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t("coachScheduleSubtitleShort")}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* View Mode Toggle: List vs Week Grid */}
                <div className="inline-flex rounded border border-slate-300 bg-slate-100 p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 cursor-pointer ${
                      viewMode === "list"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <LayoutList className="w-3.5 h-3.5" />
                    <span>{t("coachViewList")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("week")}
                    className={`px-2.5 py-1 rounded text-xs font-bold flex items-center gap-1 cursor-pointer ${
                      viewMode === "week"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>{t("coachViewWeek")}</span>
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
                    className={`px-3 py-1.5 rounded text-xs font-bold border cursor-pointer ${
                      scheduleFilter === tab.id
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
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
                    className="h-20 bg-slate-100 animate-pulse rounded-lg border border-slate-200"
                  />
                ))}
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded">
                Không có buổi dạy nào khớp với bộ lọc hiện tại.
              </div>
            ) : viewMode === "week" ? (
              /* Weekly 7 days x 8 slots Grid View */
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs border-collapse min-w-[720px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-2.5 text-left font-bold text-slate-700 border-r border-slate-200 w-32">
                        Ca / Thứ
                      </th>
                      {WEEKDAYS.map((day) => (
                        <th
                          key={day.key}
                          className="p-2.5 text-center font-bold text-slate-800 border-r last:border-r-0 border-slate-200"
                        >
                          {t(day.labelKey)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {apiTimeSlots.map((slot) => (
                      <tr key={slot.slotNumber}>
                        <td className="p-2 border-r border-slate-200 bg-slate-50/60 font-semibold text-slate-800">
                          <div>{slot.name}</div>
                          <div className="text-[11px] font-mono text-slate-500">
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
                              className="p-1.5 align-top border-r last:border-r-0 border-slate-200 min-w-[110px]"
                            >
                              <div className="space-y-1.5">
                                {cellSessions.map((ses) => {
                                  const cancelled = isSessionCancelled(ses)
                                  return (
                                    <div
                                      key={ses.id}
                                      onClick={() => {
                                        if (!ses.isPrivate && !cancelled) {
                                          handleGoToAttendance(ses)
                                        }
                                      }}
                                      className={`p-2 rounded border text-[11px] space-y-1 ${
                                        cancelled
                                          ? "bg-rose-50 border-rose-200 text-rose-800 opacity-75"
                                          : ses.isPrivate
                                            ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                                            : "bg-blue-50 border-blue-200 text-blue-900 cursor-pointer hover:border-blue-400"
                                      }`}
                                    >
                                      <div className="font-bold truncate">
                                        {ses.className || ses.subjectName || "PT 1:1"}
                                      </div>
                                      <div className="font-mono text-[10px]">
                                        {formatDate(ses.sessionDate)}
                                      </div>
                                      <div className="truncate text-[10px] text-slate-600">
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
                      <span className="px-2.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
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
                      <span className="px-2.5 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 text-xs font-bold">
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
                  <div className="space-y-2.5 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowPastSessions((v) => !v)}
                      className="flex items-center justify-between w-full px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
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
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-700" />
                <span>Danh sách khóa / lớp học đang phụ trách</span>
              </h3>
              <span className="text-xs text-slate-500 font-mono">
                Tổng số: {filteredClasses.length} lớp
              </span>
            </div>

            <div className="space-y-3">
              {filteredClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-slate-300 transition-all"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold rounded">
                        {cls.category || "Thể thao"}
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        {language === "vi" ? cls.nameVi || cls.name : cls.name}
                      </span>
                      <span className="px-2.5 py-0.5 bg-white border border-slate-200 rounded text-xs font-mono text-slate-600">
                        {cls.sessionCount} buổi học
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                      <div className="flex items-center gap-1 font-mono tabular-nums">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          Khóa học: {formatDate(cls.date || cls.startDate)}
                          {cls.endDate
                            ? ` – ${formatDate(cls.endDate)}`
                            : ""}{" "}
                          &bull; Ca dạy: {cls.resolvedTime}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-800">
                          {cls.resolvedRoom}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono tabular-nums font-bold text-slate-900">
                          {cls.enrolledCount ?? 0}/{cls.capacity ?? 12}{" "}
                          {language === "vi" ? "học viên" : "members"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleGoToAttendance(cls)}
                      className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
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
          className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {t("coachTabWorkSchedule")}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t("coachWorkScheduleSubtitleShort")}
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer bg-slate-50 px-3 py-2 rounded border border-slate-200">
              <input
                type="checkbox"
                checked={acceptingNew}
                onChange={(e) => {
                  setAcceptingNew(e.target.checked)
                  setIsWorkScheduleDirty(true)
                }}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
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

          <div className="border-t border-slate-200 pt-4">
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

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="submit"
              disabled={savingWorkSchedule || (apiEnabled && !isWorkScheduleDirty)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
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
