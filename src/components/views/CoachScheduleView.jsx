import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useSCMS } from "../../context/SCMSContext"
import { formatDate } from "../../locales/translations"
import { memberPortalApi } from "../../api/memberPortalApi"
import { getCatalogClassSessions } from "../../api/managerApi"
import { getErrorMessage } from "../../api/apiErrors"
import {
  canCheckIn,
  canCorrectAttendance,
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
  UserCheck,
  AlertCircle,
  BookOpen,
} from "lucide-react"

const DEFAULT_WEEKLY_SLOTS = [
  "MON_SLOT_1",
  "MON_SLOT_6",
  "WED_SLOT_1",
  "WED_SLOT_6",
  "FRI_SLOT_1",
  "FRI_SLOT_6",
]

const WEEKDAY_VI = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
]

function formatSessionDayLabel(dateStr) {
  if (!dateStr) return "Chưa xếp ngày"
  const parsed = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return String(dateStr)
  const dayName = WEEKDAY_VI[parsed.getDay()] || ""
  const dd = String(parsed.getDate()).padStart(2, "0")
  const mm = String(parsed.getMonth() + 1).padStart(2, "0")
  const yyyy = parsed.getFullYear()
  return `${dayName}, ${dd}/${mm}/${yyyy}`
}

function formatTimeRange(startTime, endTime) {
  const start = String(startTime || "").slice(0, 5)
  const end = String(endTime || "").slice(0, 5)
  if (start && end) return `${start} – ${end}`
  if (start) return start
  return "Chưa xếp giờ"
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
  const [selectedRoom, setSelectedRoom] = useState("all")
  const [scheduleFilter, setScheduleFilter] = useState("all") // all | upcoming | group | pt

  const resolvedCoachId = useMemo(() => {
    const raw = currentUser?.coachId ?? currentUser?.id
    const num = Number(raw)
    return Number.isInteger(num) && num > 0 ? num : null
  }, [currentUser?.coachId, currentUser?.id])

  const myClasses = useMemo(() => {
    const matched = classes.filter(
      (c) =>
        String(c.coachId) === String(resolvedCoachId || currentUser.id) ||
        String(c.coachId) === String(currentUser.id) ||
        String(c.coachName || "")
          .toLowerCase()
          .includes(String(currentUser.name || "").toLowerCase()) ||
        (!apiEnabled && String(c.coachName || "").includes("Mai")),
    )
    return matched.length > 0 ? matched : classes
  }, [classes, resolvedCoachId, currentUser.id, currentUser.name, apiEnabled])

  // Sessions & 1:1 Private PT sessions from /api/sessions + /api/sessions/catalog/{classId}
  const [apiSessions, setApiSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [absenceNoticesBySession, setAbsenceNoticesBySession] = useState({})
  const [loadingNoticesId, setLoadingNoticesId] = useState(null)

  // Work schedule state (/api/coaches/{id}/work-schedule)
  const [acceptingNew, setAcceptingNew] = useState(true)
  const [weeklySlotsText, setWeeklySlotsText] = useState(
    DEFAULT_WEEKLY_SLOTS.join(", "),
  )
  const [daysOffText, setDaysOffText] = useState("")
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

      const [generalSessions, catalogArrays, workData] = await Promise.all([
        memberPortalApi.getClassSessions().catch(() => []),
        Promise.all(catalogPromises),
        resolvedCoachId
          ? memberPortalApi
              .getCoachWorkSchedule(resolvedCoachId)
              .catch(() => null)
          : Promise.resolve(null),
      ])

      const myClassMap = new Map(myClasses.map((c) => [String(c.id), c]))
      const nameLower = String(currentUser?.name || "")
        .trim()
        .toLowerCase()

      const sessionMap = new Map()
      const addSession = (s) => {
        if (!s || !s.id) return
        const matchedClass = s.classId ? myClassMap.get(String(s.classId)) : null
        const matchedRoom = s.roomId
          ? rooms?.find((r) => String(r.id) === String(s.roomId))
          : null
        sessionMap.set(String(s.id), {
          ...s,
          className:
            s.className || matchedClass?.nameVi || matchedClass?.name || "",
          subjectName:
            s.subjectName || matchedClass?.category || "Thể thao",
          roomName:
            s.roomName ||
            matchedRoom?.name ||
            matchedClass?.roomVi ||
            matchedClass?.room ||
            (s.roomId ? `Sân/Phòng #${s.roomId}` : "Sân tập trung tâm"),
          enrolledCount:
            s.enrolledCount ?? matchedClass?.enrolledCount ?? 0,
          maxCapacity:
            s.maxCapacity ?? matchedClass?.capacity ?? 12,
        })
      }

      catalogArrays.flat().forEach(addSession)

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

      if (workData && typeof workData === "object") {
        if (typeof workData.acceptingNew === "boolean") {
          setAcceptingNew(workData.acceptingNew)
        }
        if (
          Array.isArray(workData.weeklySlots) &&
          workData.weeklySlots.length > 0
        ) {
          setWeeklySlotsText(workData.weeklySlots.join(", "))
        }
        if (Array.isArray(workData.daysOff)) {
          setDaysOffText(workData.daysOff.join(", "))
        }
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

  const handleLoadAbsenceNotices = async (sessionId) => {
    if (!apiEnabled || !sessionId) return
    setLoadingNoticesId(sessionId)
    try {
      const list = await memberPortalApi.getSessionAbsenceNotices(sessionId)
      setAbsenceNoticesBySession((prev) => ({
        ...prev,
        [sessionId]: Array.isArray(list) ? list : [],
      }))
    } catch (err) {
      showToast?.(
        getErrorMessage(err, "Không thể tải danh sách báo vắng của buổi học."),
        "error",
      )
    } finally {
      setLoadingNoticesId(null)
    }
  }

  const handleSaveWorkSchedule = async (e) => {
    if (e) e.preventDefault()
    if (!apiEnabled) {
      showToast?.("Đã lưu cấu hình lịch làm việc của HLV!", "success")
      return
    }
    if (!resolvedCoachId) {
      showToast?.("Không xác định được mã HLV để cập nhật lịch làm việc.", "warning")
      return
    }
    setSavingWorkSchedule(true)
    try {
      const weeklySlots = weeklySlotsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      const daysOff = daysOffText
        .split(",")
        .map((s) => s.trim())
        .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s))
      await memberPortalApi.updateCoachWorkSchedule(resolvedCoachId, {
        acceptingNew: Boolean(acceptingNew),
        weeklySlots: weeklySlots.length > 0 ? weeklySlots : DEFAULT_WEEKLY_SLOTS,
        daysOff,
      })
      showToast?.("Đã cập nhật lịch làm việc & trạng thái nhận học viên PT!", "success")
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

  const filteredClasses = useMemo(() => {
    return myClasses.map((cls) => {
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
    }).filter((cls) =>
      selectedRoom === "all" ? true : cls.resolvedRoom === selectedRoom,
    )
  }, [myClasses, apiSessions, selectedRoom])

  const handleGoToAttendance = (clsOrSession) => {
    if (typeof window !== "undefined") {
      const classId = clsOrSession?.classId ?? clsOrSession?.id
      if (classId) {
        sessionStorage.setItem(
          "scms_selected_attendance_class_id",
          String(classId),
        )
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
                ? "Thời khóa biểu từng buổi dạy (Thứ/Ngày, Khung giờ, Sân tập), ca PT 1:1 & đơn báo vắng"
                : "Detailed teaching schedule by session, 1:1 private PT sessions & absence notices"}
            </p>
          </div>
        </div>

        {/* Room Filter */}
        <div className="flex items-center gap-2">
          {apiEnabled && (
            <button
              type="button"
              onClick={loadCoachScheduleData}
              disabled={loadingSessions}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loadingSessions ? "animate-spin" : ""}`}
              />
              <span>Đồng bộ</span>
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

      {/* Section 1: Detailed Sessions Schedule (Day, Time, Room, Attendance) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-700" />
              <span>Thời Khóa Biểu Các Buổi Giảng Dạy Chi Tiết</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Hiển thị chính xác ngày học, khung giờ bắt đầu – kết thúc, sân tập và trạng thái từng buổi
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
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
                className={`px-2.5 py-1 rounded text-xs font-bold border cursor-pointer ${
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
          <div className="p-6 text-center text-xs text-slate-500">
            Đang tải thời khóa biểu các buổi dạy...
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded">
            Không có buổi dạy nào khớp với bộ lọc hiện tại.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {filteredSessions.map((ses, index) => {
              const notices = absenceNoticesBySession[ses.id]
              const isToday = String(ses.sessionDate || "") === todayIso
              const sessionCancelled = isSessionCancelled(ses)
              const sessionCanCheckIn = canCheckIn(ses)
              const sessionCanCorrect = canCorrectAttendance(ses)
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
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            ses.isPrivate
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-blue-100 text-blue-900 border-blue-200"
                          }`}
                        >
                          {ses.isPrivate ? "PT 1-kèm-1" : ses.subjectName || "Lớp nhóm"}
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          {ses.isPrivate
                            ? `${ses.subjectName || "Kèm PT 1:1"} — Học viên: ${
                                ses.bookedMemberName ||
                                (ses.bookedMemberId ? `#${ses.bookedMemberId}` : "Hội viên PT")
                              }`
                            : ses.className || "Buổi học lớp nhóm"}
                        </span>
                        {isToday && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[10px] font-bold">
                            {t("coachTodayGroup")}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 border rounded text-[10px] font-bold ${
                            sessionCancelled
                              ? "bg-rose-50 text-rose-800 border-rose-200"
                              : sessionCanCorrect
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-blue-50 text-blue-800 border-blue-200"
                          }`}
                        >
                          {sessionCancelled
                            ? ses.centerInvalidated
                              ? t("coachStatusCenterInvalidated")
                              : t("coachStatusCancelled")
                            : sessionCanCorrect
                              ? t("coachStatusCompleted")
                              : t("coachStatusScheduled")}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                          <Calendar className="w-3.5 h-3.5 text-blue-700" />
                          <span>{formatSessionDayLabel(ses.sessionDate)}</span>
                        </div>

                        <div className="flex items-center gap-1.5 font-mono font-bold text-blue-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          <Clock className="w-3.5 h-3.5 text-blue-700" />
                          <span>
                            {formatTimeRange(ses.startTime, ses.endTime)}
                          </span>
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
                              {ses.enrolledCount ?? 0}/{ses.maxCapacity ?? 12} Học viên
                            </span>
                          </div>
                        )}
                      </div>

                      {sessionCancelled && (
                        <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded px-2.5 py-1.5">
                          {ses.centerInvalidated
                            ? t("coachBannerCenterInvalidatedDesc")
                            : t("coachBannerCancelledDesc")}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {apiEnabled && (
                        <button
                          type="button"
                          onClick={() => handleLoadAbsenceNotices(ses.id)}
                          disabled={loadingNoticesId === ses.id}
                          className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 rounded text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
                        >
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>
                            {loadingNoticesId === ses.id
                              ? "Đang tải..."
                              : t("coachBtnViewAbsenceNotices")}
                          </span>
                        </button>
                      )}
                      {!ses.isPrivate && !sessionCancelled && (
                        <button
                          type="button"
                          onClick={() => handleGoToAttendance(ses)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            {sessionCanCheckIn
                              ? t("coachBtnCheckInThisSession")
                              : t("coachBtnViewOrCorrectAttendance")}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {Array.isArray(notices) && (
                    <div className="pt-2 border-t border-slate-200 text-xs">
                      {notices.length === 0 ? (
                        <span className="text-slate-500">
                          Không có đơn xin nghỉ/báo vắng nào cho buổi này.
                        </span>
                      ) : (
                        <div className="space-y-1">
                          {notices.map((n, idx) => (
                            <div
                              key={n.id || idx}
                              className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-900 flex items-center justify-between"
                            >
                              <span>
                                <strong>
                                  {n.memberName ||
                                    (n.memberId ? `Học viên #${n.memberId}` : "Học viên")}
                                </strong>
                                : {n.reason || "Xin phép vắng buổi học"}
                              </span>
                              <span className="font-mono text-[10px] text-amber-700">
                                {String(n.reportedAt || n.createdAt || "")
                                  .slice(0, 16)
                                  .replace("T", " ")}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Section 2: Assigned Courses Summary */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-700" />
            <span>Danh Sách Khóa / Lớp Học Đang Phụ Trách</span>
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
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-200 text-[10px] font-mono font-bold rounded">
                    {cls.category || "Thể thao"}
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {language === "vi" ? cls.nameVi || cls.name : cls.name}
                  </span>
                  <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-600">
                    {cls.sessionCount} buổi học
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                  <div className="flex items-center gap-1 font-mono tabular-nums">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Khóa học: {formatDate(cls.date || cls.startDate, language)}
                      {cls.endDate
                        ? ` – ${formatDate(cls.endDate, language)}`
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
                      {language === "vi" ? "Học viên" : "Members"}
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
                  <span>Mở Sổ Điểm Danh Lớp</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coach Work Schedule Configuration (/api/coaches/{id}/work-schedule) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Cấu Hình Lịch Làm Việc &amp; Tiếp Nhận Học Viên PT 1:1
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cập nhật khung giờ làm việc cố định trong tuần và các ngày nghỉ phép của HLV (/api/coaches/work-schedule)
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptingNew}
              onChange={(e) => setAcceptingNew(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Đang nhận học viên PT 1:1 mới</span>
          </label>
        </div>

        <form onSubmit={handleSaveWorkSchedule} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Khung ca làm việc trong tuần (phân cách bằng dấu phẩy)
              </label>
              <input
                type="text"
                value={weeklySlotsText}
                onChange={(e) => setWeeklySlotsText(e.target.value)}
                placeholder="MON_SLOT_1, WED_SLOT_1, FRI_SLOT_1..."
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Ngày nghỉ phép cố định (YYYY-MM-DD, cách nhau dấu phẩy)
              </label>
              <input
                type="text"
                value={daysOffText}
                onChange={(e) => setDaysOffText(e.target.value)}
                placeholder="Ví dụ: 2026-11-20, 2026-12-25"
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingWorkSchedule}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {savingWorkSchedule ? "Đang lưu..." : "Lưu Lịch Làm Việc HLV"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
