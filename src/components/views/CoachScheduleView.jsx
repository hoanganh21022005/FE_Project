import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { formatDate } from "../../locales/translations"
import { memberPortalApi } from "../../api/memberPortalApi"
import { getErrorMessage } from "../../api/apiErrors"
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
} from "lucide-react"

const DEFAULT_WEEKLY_SLOTS = [
  "MON_SLOT_1",
  "MON_SLOT_6",
  "WED_SLOT_1",
  "WED_SLOT_6",
  "FRI_SLOT_1",
  "FRI_SLOT_6",
]

export function CoachScheduleView() {
  const {
    classes,
    currentUser,
    setCurrentTab,
    apiEnabled,
    showToast,
    t,
    language,
  } = useSCMS()
  const [selectedRoom, setSelectedRoom] = useState("all")

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

  // Sessions & 1:1 Private PT sessions from /api/sessions
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
      const [sessionsList, workData] = await Promise.all([
        memberPortalApi.getClassSessions().catch(() => []),
        resolvedCoachId
          ? memberPortalApi.getCoachWorkSchedule(resolvedCoachId).catch(() => null)
          : Promise.resolve(null),
      ])
      if (Array.isArray(sessionsList)) {
        const myClassIdSet = new Set(myClasses.map((c) => String(c.id)))
        const nameLower = String(currentUser?.name || "").trim().toLowerCase()
        const filtered = sessionsList.filter((s) => {
          if (resolvedCoachId && String(s.coachId) === String(resolvedCoachId)) {
            return true
          }
          if (String(s.coachId) === String(currentUser?.id)) {
            return true
          }
          if (
            nameLower &&
            String(s.coachName || "").trim().toLowerCase().includes(nameLower)
          ) {
            return true
          }
          if (s.classId && myClassIdSet.has(String(s.classId))) {
            return true
          }
          return false
        })
        setApiSessions(filtered)
      }
      if (workData && typeof workData === "object") {
        if (typeof workData.acceptingNew === "boolean") {
          setAcceptingNew(workData.acceptingNew)
        }
        if (Array.isArray(workData.weeklySlots) && workData.weeklySlots.length > 0) {
          setWeeklySlotsText(workData.weeklySlots.join(", "))
        }
        if (Array.isArray(workData.daysOff)) {
          setDaysOffText(workData.daysOff.join(", "))
        }
      }
    } finally {
      setLoadingSessions(false)
    }
  }, [apiEnabled, resolvedCoachId, myClasses, currentUser?.id, currentUser?.name])

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
    return Array.from(set)
  }, [myClasses])

  const filteredClasses =
    selectedRoom === "all"
      ? myClasses
      : myClasses.filter((c) => c.room === selectedRoom)

  const handleGoToAttendance = (cls) => {
    if (typeof window !== "undefined" && cls?.id) {
      sessionStorage.setItem(
        "scms_selected_attendance_class_id",
        String(cls.id),
      )
    }
    setCurrentTab("attendance")
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
            <p className="text-xs text-slate-500 whitespace-nowrap">
              {language === "vi"
                ? "Lịch giảng dạy chi tiết, ca tập riêng 1:1, đơn báo vắng & cấu hình lịch làm việc"
                : "Detailed teaching schedule, 1:1 private sessions, absence notices & work schedule"}
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
              {language === "vi" ? "Tất cả phòng" : "All Rooms"}
            </option>
            {availableRooms.map((roomName) => (
              <option key={roomName} value={roomName}>
                {roomName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Schedule Table / Roster List */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Danh Sách Buổi Dạy Trong Tuần
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
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                  <div className="flex items-center gap-1 font-mono tabular-nums">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {formatDate(cls.date || cls.startDate, language)} &bull;{" "}
                      {cls.startTime || "07:00"} ({cls.durationMinutes || 90}{" "}
                      {language === "vi" ? "phút" : "min"})
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold">
                      {language === "vi" ? cls.roomVi || cls.room : cls.room}
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
                  <span>Điểm Danh Buổi Học</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 1:1 Private PT Sessions & Session Absence Notices */}
      {apiEnabled && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700" />
              <span>
                Lịch Ca Tập Riêng 1-kèm-1 &amp; Báo Vắng Theo Buổi ({privateSessions.length} ca PT)
              </span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Tổng số buổi hệ thống: {apiSessions.length} buổi
            </span>
          </div>

          {apiSessions.length === 0 ? (
            <p className="text-xs text-slate-500 py-2">
              Chưa có buổi tập riêng 1:1 hoặc buổi học nào được lên lịch cho HLV.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {apiSessions.slice(0, 20).map((ses) => {
                const notices = absenceNoticesBySession[ses.id]
                return (
                  <div
                    key={ses.id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              ses.isPrivate
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-blue-50 text-blue-800 border-blue-200"
                            }`}
                          >
                            {ses.isPrivate ? "PT 1-kèm-1" : "Lớp nhóm"}
                          </span>
                          <span className="text-xs font-bold text-slate-900">
                            {ses.isPrivate
                              ? `${ses.subjectName || "PT 1:1"} — Học viên: ${
                                  ses.bookedMemberName || `#${ses.bookedMemberId}`
                                }`
                              : ses.className || `Buổi #${ses.id}`}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            ({ses.status || "Scheduled"})
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 font-mono mt-1">
                          Ngày: {ses.sessionDate} &bull;{" "}
                          {String(ses.startTime || "").slice(0, 5)} –{" "}
                          {String(ses.endTime || "").slice(0, 5)} &bull; Sân:{" "}
                          {ses.roomName || `#${ses.roomId}`}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleLoadAbsenceNotices(ses.id)}
                          disabled={loadingNoticesId === ses.id}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded text-[11px] font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
                        >
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          <span>
                            {loadingNoticesId === ses.id
                              ? "Đang tải..."
                              : "Xem báo vắng"}
                          </span>
                        </button>
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
                                    {n.memberName || `Học viên #${n.memberId}`}
                                  </strong>
                                  : {n.reason || "Xin phép vắng buổi học"}
                                </span>
                                <span className="font-mono text-[10px] text-amber-700">
                                  {String(n.createdAt || "").slice(0, 16).replace("T", " ")}
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
      )}

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
