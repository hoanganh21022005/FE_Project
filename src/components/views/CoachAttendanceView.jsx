import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { CoachStatusBadge } from "../coach/StatusBadge"
import { formatDate, formatTime, formatTimeRange } from "../../utils/datetime"
import { AttendanceCorrectionModal } from "../modals/AttendanceCorrectionModal"
import { classEnrollmentApi } from "../../api/classEnrollmentApi"
import { attendanceApi } from "../../api/attendanceApi"
import { memberPortalApi } from "../../api/memberPortalApi"
import { getCatalogClassSessions } from "../../api/managerApi"
import { getErrorMessage } from "../../api/apiErrors"
import { isActiveNormalEnrollment } from "../../utils/memberScheduleUtils"
import {
  canCheckIn,
  canCorrectAttendance,
  isSessionCancelled,
} from "../../utils/permissions"
import {
  ClipboardCheck,
  Edit2,
  RefreshCw,
  CheckCheck,
  AlertCircle,
  Search,
  X,
} from "lucide-react"

export function CoachAttendanceView() {
  const {
    classes,
    members,
    attendance,
    currentUser,
    recordAttendance,
    apiEnabled,
    showToast,
    language,
    t,
  } = useSCMS()

  const resolvedCoachId = useMemo(() => {
    const raw = currentUser?.coachId ?? currentUser?.id
    const num = Number(raw)
    return Number.isInteger(num) && num > 0 ? num : 1
  }, [currentUser?.coachId, currentUser?.id])

  const coachClasses = useMemo(() => {
    const matched = classes.filter(
      (c) =>
        String(c.coachId) === String(resolvedCoachId) ||
        String(c.coachId) === String(currentUser?.id) ||
        String(c.coachName || "")
          .toLowerCase()
          .includes(String(currentUser?.name || "").toLowerCase()) ||
        (!apiEnabled && String(c.coachName || "").includes("Mai")),
    )
    return matched.length > 0 ? matched : classes
  }, [classes, resolvedCoachId, currentUser?.id, currentUser?.name, apiEnabled])

  const [selectedClassId, setSelectedClassId] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("scms_selected_attendance_class_id")
      if (saved) return saved
    }
    return coachClasses[0]?.id || classes[0]?.id || ""
  })

  useEffect(() => {
    if (!selectedClassId && coachClasses.length > 0) {
      setSelectedClassId(String(coachClasses[0].id))
    }
  }, [coachClasses, selectedClassId])

  const selectedClass =
    classes.find((c) => String(c.id) === String(selectedClassId)) ||
    coachClasses[0] ||
    classes[0] ||
    null

  const [selectedMemberModal, setSelectedMemberModal] = useState(null)
  const [apiEnrollments, setApiEnrollments] = useState([])
  const [apiAttendances, setApiAttendances] = useState([])
  const [sessionTrainingResults, setSessionTrainingResults] = useState([])
  const [classTrainingPlans, setClassTrainingPlans] = useState([])
  const [sessionAbsenceNotices, setSessionAbsenceNotices] = useState([])
  const [classSessions, setClassSessions] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("scms_selected_attendance_session_id") || ""
    }
    return ""
  })
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false)
  const [quickMemberInput, setQuickMemberInput] = useState("")
  const [quickSaving, setQuickSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [optimisticStatusMap, setOptimisticStatusMap] = useState({})

  const loadClassRosterAndAttendance = useCallback(async () => {
    if (!apiEnabled || !selectedClass?.id) return
    setLoadingRoster(true)
    try {
      const [enrollments, attendances, sessions, plans] = await Promise.all([
        classEnrollmentApi
          .getEnrollmentsByClass(selectedClass.id, { notifyForbidden: false })
          .catch(() => []),
        attendanceApi.searchAttendances().catch(() => []),
        getCatalogClassSessions(selectedClass.id, {
          notifyForbidden: false,
        }).catch(() => []),
        memberPortalApi
          .getTrainingPlans({ classId: selectedClass.id })
          .catch(() => []),
      ])
      setApiEnrollments(Array.isArray(enrollments) ? enrollments : [])
      setApiAttendances(Array.isArray(attendances) ? attendances : [])
      setClassTrainingPlans(Array.isArray(plans) ? plans : [])
      const sessionList = Array.isArray(sessions) ? sessions : []
      setClassSessions(sessionList)
      const firstActiveSession =
        sessionList.find((s) => !isSessionCancelled(s)) || sessionList[0] || null
      const effectiveSessionId =
        selectedSessionId || (firstActiveSession ? String(firstActiveSession.id) : "")
      if (firstActiveSession && !selectedSessionId) {
        setSelectedSessionId(String(firstActiveSession.id))
      }
      if (effectiveSessionId) {
        const [results, notices] = await Promise.all([
          memberPortalApi
            .getTrainingResults({ sessionId: effectiveSessionId })
            .catch(() => []),
          memberPortalApi
            .getSessionAbsenceNotices(effectiveSessionId)
            .catch(() => []),
        ])
        setSessionTrainingResults(Array.isArray(results) ? results : [])
        setSessionAbsenceNotices(Array.isArray(notices) ? notices : [])
      } else {
        setSessionTrainingResults([])
        setSessionAbsenceNotices([])
      }
    } finally {
      setLoadingRoster(false)
    }
  }, [apiEnabled, selectedClass?.id, selectedSessionId])

  useEffect(() => {
    loadClassRosterAndAttendance()
  }, [loadClassRosterAndAttendance])

  const enrolledMembers = useMemo(() => {
    if (apiEnabled) {
      const rosterMap = new Map()
      const upsertMember = (id, name, code, pkgStatus) => {
        const numId = Number(id)
        if (!Number.isInteger(numId) || numId <= 0) return
        const key = String(numId)
        const matched = members.find((m) => String(m.id) === key)
        const existing = rosterMap.get(key)
        rosterMap.set(key, {
          id: numId,
          name:
            name ||
            existing?.name ||
            matched?.name ||
            `Học viên #${numId}`,
          code:
            code ||
            existing?.code ||
            matched?.code ||
            `MB-${1000 + numId}`,
          currentPackageName:
            pkgStatus ||
            existing?.currentPackageName ||
            matched?.currentPackageName ||
            "Đã ghi danh",
        })
      }

      const activeList = apiEnrollments.filter((enr) =>
        isActiveNormalEnrollment(enr),
      )
      activeList.forEach((enr) =>
        upsertMember(
          enr.memberId,
          enr.memberName,
          enr.memberCode,
          enr.status || "Đã ghi danh",
        ),
      )

      const selectedSesObj = classSessions.find(
        (s) => String(s.id) === String(selectedSessionId),
      )
      if (selectedSesObj?.bookedMemberId) {
        upsertMember(
          selectedSesObj.bookedMemberId,
          selectedSesObj.bookedMemberName,
          null,
          "Lịch PT 1:1",
        )
      }

      sessionTrainingResults.forEach((res) =>
        upsertMember(res.memberId, res.memberName, null, "Đã ghi nhận buổi tập"),
      )

      apiAttendances
        .filter(
          (a) =>
            (selectedSessionId &&
              String(a.sessionId) === String(selectedSessionId)) ||
            (selectedClass?.id &&
              String(a.classId) === String(selectedClass.id)),
        )
        .forEach((att) =>
          upsertMember(
            att.memberId,
            att.memberName,
            att.memberCode,
            "Điểm danh lớp",
          ),
        )

      classTrainingPlans.forEach((plan) =>
        upsertMember(
          plan.memberId,
          plan.memberName,
          null,
          "Có giáo án lớp",
        ),
      )

      sessionAbsenceNotices.forEach((notice) =>
        upsertMember(
          notice.memberId,
          notice.memberName,
          null,
          `Báo vắng: ${notice.reason || "Có phép"}`,
        ),
      )

      return Array.from(rosterMap.values())
    }
    return members.slice(0, 5)
  }, [
    apiEnabled,
    apiEnrollments,
    classSessions,
    selectedSessionId,
    sessionTrainingResults,
    apiAttendances,
    selectedClass?.id,
    classTrainingPlans,
    sessionAbsenceNotices,
    members,
  ])

  const normalizeAttendanceStatus = (state) => {
    const s = String(state || "").toLowerCase()
    if (s.includes("present") || s.includes("checked")) return "present"
    if (s.includes("excuse")) return "excused"
    if (s.includes("late")) return "late"
    if (s.includes("absent")) return "absent"
    return "not_recorded"
  }

  const getMemberStatusAndMeta = useCallback(
    (m) => {
      const optKey = `${selectedSessionId || selectedClass?.id || "cls"}_${m.id}`
      const optVal = optimisticStatusMap[optKey]

      const localAtt = attendance.find(
        (a) =>
          String(a.classId) === String(selectedClass?.id) &&
          String(a.memberId) === String(m.id),
      )
      const sessionResultAtt = sessionTrainingResults.find(
        (r) =>
          String(r.memberId) === String(m.id) &&
          (!selectedSessionId ||
            String(r.sessionId) === String(selectedSessionId)),
      )
      const backendAtt =
        apiAttendances.find(
          (a) =>
            String(a.memberId) === String(m.id) &&
            selectedSessionId &&
            String(a.sessionId) === String(selectedSessionId),
        ) ||
        apiAttendances.find(
          (a) =>
            String(a.memberId) === String(m.id) &&
            (!a.classId || String(a.classId) === String(selectedClass?.id)),
        )

      const currentStatus =
        optVal ||
        (localAtt
          ? localAtt.status
          : sessionResultAtt?.attendanceStatus
            ? normalizeAttendanceStatus(sessionResultAtt.attendanceStatus)
            : backendAtt
              ? normalizeAttendanceStatus(backendAtt.state)
              : "not_recorded")

      const attendanceId =
        localAtt?.attendanceId || backendAtt?.attendanceId || null

      const absenceNotice = sessionAbsenceNotices.find(
        (n) =>
          String(n.memberId) === String(m.id) ||
          (n.memberName &&
            String(n.memberName).toLowerCase() ===
              String(m.name || "").toLowerCase()),
      )

      return { currentStatus, attendanceId, absenceNotice }
    },
    [
      selectedSessionId,
      selectedClass?.id,
      optimisticStatusMap,
      attendance,
      sessionTrainingResults,
      apiAttendances,
      sessionAbsenceNotices,
    ],
  )

  const summaryCounts = useMemo(() => {
    const counts = {
      present: 0,
      late: 0,
      excused: 0,
      absent: 0,
      not_recorded: 0,
    }
    enrolledMembers.forEach((m) => {
      const { currentStatus } = getMemberStatusAndMeta(m)
      if (counts[currentStatus] !== undefined) {
        counts[currentStatus] += 1
      } else {
        counts.not_recorded += 1
      }
    })
    return counts
  }, [enrolledMembers, getMemberStatusAndMeta])

  const unmarkedMembers = useMemo(
    () =>
      enrolledMembers.filter(
        (m) => getMemberStatusAndMeta(m).currentStatus === "not_recorded",
      ),
    [enrolledMembers, getMemberStatusAndMeta],
  )

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return enrolledMembers
    return enrolledMembers.filter(
      (m) =>
        String(m.name || "")
          .toLowerCase()
          .includes(q) ||
        String(m.code || "")
          .toLowerCase()
          .includes(q) ||
        String(m.id || "").includes(q),
    )
  }, [enrolledMembers, searchQuery])

  const handleOneTouchCheckIn = async (member, targetStatus, attendanceId) => {
    const optKey = `${selectedSessionId || selectedClass?.id || "cls"}_${member.id}`
    const prevStatus = getMemberStatusAndMeta(member).currentStatus

    // Optimistic update (P2.2)
    setOptimisticStatusMap((prev) => ({
      ...prev,
      [optKey]: targetStatus,
    }))

    const apiStatusMap = {
      present: "Present",
      late: "Late",
      excused: "Excused",
      absent: "Absent",
    }

    try {
      if (apiEnabled && selectedSessionId) {
        await attendanceApi.recordSessionAttendance({
          memberId: member.id,
          sessionId: Number(selectedSessionId),
          coachId: resolvedCoachId,
          status: apiStatusMap[targetStatus] || "Present",
          notes:
            targetStatus === "excused"
              ? "Vắng có phép"
              : targetStatus === "late"
                ? "Đi trễ"
                : targetStatus === "absent"
                  ? "Vắng mặt"
                  : "Có mặt đúng giờ",
        })
      }
      await recordAttendance(
        selectedClass?.id,
        member.id,
        targetStatus === "excused" ? "late" : targetStatus,
        undefined,
        {
          attendanceId,
          memberName: member.name,
          sessionId: selectedSessionId,
          coachId: resolvedCoachId,
        },
      )
    } catch (err) {
      // Rollback on failure
      setOptimisticStatusMap((prev) => ({
        ...prev,
        [optKey]: prevStatus,
      }))
      showToast?.(
        getErrorMessage(err, "Không thể lưu điểm danh. Đã hoàn tác trạng thái."),
        "error",
      )
    }
  }

  const handleConfirmBulkMarkPresent = async () => {
    const targets =
      unmarkedMembers.length > 0 ? unmarkedMembers : enrolledMembers
    if (targets.length === 0 || bulkSaving) {
      setShowBulkConfirmModal(false)
      return
    }
    setBulkSaving(true)
    setShowBulkConfirmModal(false)
    try {
      const nextOpt = {}
      targets.forEach((m) => {
        const optKey = `${selectedSessionId || selectedClass?.id || "cls"}_${m.id}`
        nextOpt[optKey] = "present"
      })
      setOptimisticStatusMap((prev) => ({ ...prev, ...nextOpt }))

      if (apiEnabled && selectedSessionId) {
        await memberPortalApi
          .recordBulkTrainingResults({
            sessionId: Number(selectedSessionId),
            coachId: Number(resolvedCoachId),
            items: targets.map((m) => ({
              memberId: Number(m.id),
              attendanceStatus: "Present",
              content: "Có mặt đầy đủ theo điểm danh lớp",
            })),
          })
          .catch(() => {})
      }
      for (const m of targets) {
        await recordAttendance(selectedClass?.id, m.id, "present", undefined, {
          memberName: m.name,
          sessionId: selectedSessionId,
          coachId: resolvedCoachId,
        })
      }
      await loadClassRosterAndAttendance()
      showToast?.(
        `Đã điểm danh Có mặt cho ${targets.length} học viên!`,
        "success",
      )
    } finally {
      setBulkSaving(false)
    }
  }

  const handleQuickCheckin = async (e) => {
    e.preventDefault()
    const raw = String(quickMemberInput || "").trim()
    if (!raw || quickSaving) return
    setQuickSaving(true)
    try {
      const mbMatch = raw.match(/^(?:MB-)?(\d+)$/i)
      if (mbMatch) {
        const rawNum = Number(mbMatch[1])
        const resolvedMemberId = rawNum > 1000 ? rawNum - 1000 : rawNum
        if (apiEnabled && selectedSessionId) {
          await attendanceApi.recordSessionAttendance({
            memberId: resolvedMemberId,
            sessionId: Number(selectedSessionId),
            coachId: resolvedCoachId,
            status: "Present",
            notes: "Điểm danh nhanh theo Mã/ID học viên",
          })
        }
        await recordAttendance(
          selectedClass?.id,
          resolvedMemberId,
          "present",
          undefined,
          {
            memberName: `Học viên #${resolvedMemberId}`,
            sessionId: selectedSessionId,
            coachId: resolvedCoachId,
          },
        )
        setQuickMemberInput("")
        await loadClassRosterAndAttendance()
        showToast?.(
          `Đã điểm danh Có mặt cho học viên #${resolvedMemberId}!`,
          "success",
        )
      } else {
        await attendanceApi.scanCheckin({
          checkinCode: raw,
          sessionId: selectedSessionId ? Number(selectedSessionId) : undefined,
        })
        setQuickMemberInput("")
        await loadClassRosterAndAttendance()
        showToast?.(`Đã quét mã điểm danh ${raw} thành công!`, "success")
      }
    } catch (err) {
      showToast?.(
        err?.message ||
          "Không thể điểm danh cho mã học viên / mã check-in này.",
        "error",
      )
    } finally {
      setQuickSaving(false)
    }
  }

  const activeSession = useMemo(() => {
    if (classSessions.length === 0) return { status: "Scheduled" }
    return (
      classSessions.find((s) => String(s.id) === String(selectedSessionId)) ||
      classSessions[0] ||
      { status: "Scheduled" }
    )
  }, [classSessions, selectedSessionId])

  const sessionCancelled = isSessionCancelled(activeSession)
  const allowCheckIn = canCheckIn(activeSession)
  const allowCorrection = canCorrectAttendance(activeSession)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Class Banner & Selector */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
              BUỔI HỌC HIỆN TẠI
            </span>
            {classes.length > 1 && (
              <select
                value={selectedClass?.id || ""}
                onChange={(e) => {
                  setSelectedClassId(e.target.value)
                  setSelectedSessionId("")
                  if (typeof window !== "undefined") {
                    sessionStorage.setItem(
                      "scms_selected_attendance_class_id",
                      e.target.value,
                    )
                  }
                }}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.nameVi || cls.name} (
                    {cls.startTime ? formatTime(cls.startTime) : "Lịch học"})
                  </option>
                ))}
              </select>
            )}
            {classSessions.length > 0 && (
              <select
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
              >
                {classSessions.map((ses, idx) => {
                  const isCancel = isSessionCancelled(ses)
                  return (
                    <option
                      key={ses.id || idx}
                      value={ses.id}
                      disabled={
                        isCancel && String(ses.id) !== String(selectedSessionId)
                      }
                    >
                      Buổi {idx + 1}: {formatDate(ses.sessionDate)} (
                      {formatTime(ses.startTime)})
                      {isCancel ? ` — [${t("coachStatusCancelled")}]` : ""}
                    </option>
                  )
                })}
              </select>
            )}
          </div>
          <h2 className="text-base font-bold text-slate-900 mt-1">
            {selectedClass?.nameVi || selectedClass?.name || "Lớp học"}
          </h2>
          {(() => {
            const sesDate = activeSession?.sessionDate
              ? formatDate(activeSession.sessionDate)
              : selectedClass?.date
                ? formatDate(selectedClass.date)
                : "Hôm nay"
            const sesTime = activeSession?.startTime
              ? formatTimeRange(activeSession.startTime, activeSession.endTime)
              : selectedClass?.startTime
                ? formatTime(selectedClass.startTime)
                : "Theo ca học"
            const sesRoom =
              activeSession?.roomName ||
              selectedClass?.room ||
              "Sân tập trung tâm"
            return (
              <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                Ngày buổi học: {sesDate} &bull; Ca: {sesTime} &bull; Phòng/Sân:{" "}
                {sesRoom} &bull; Coach: {selectedClass?.coachName || "HLV"}
              </p>
            )
          })()}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {enrolledMembers.length > 0 && allowCheckIn && !sessionCancelled && (
            <button
              type="button"
              onClick={() => setShowBulkConfirmModal(true)}
              disabled={bulkSaving || loadingRoster}
              className="px-3.5 py-2 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>
                {bulkSaving ? "Đang điểm danh..." : "Điểm danh tất cả Có mặt"}
              </span>
            </button>
          )}
          {apiEnabled && (
            <button
              type="button"
              onClick={loadClassRosterAndAttendance}
              disabled={loadingRoster}
              className="px-3 py-2 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loadingRoster ? "animate-spin" : ""}`}
              />
              <span>{t("coachBtnRefresh")}</span>
            </button>
          )}
          <div className="p-3 bg-slate-50 rounded border border-slate-200 text-right">
            <div className="text-xs text-slate-500 uppercase font-bold whitespace-nowrap">
              {language === "vi" ? "Sức chứa" : "Enrolled Capacity"}
            </div>
            <div className="text-lg font-bold text-slate-900 tabular-nums whitespace-nowrap">
              {enrolledMembers.length || selectedClass?.enrolledCount || 0}
              /{selectedClass?.capacity || 12}{" "}
              {language === "vi" ? "Học viên" : "Members"}
            </div>
          </div>
        </div>
      </div>

      {/* Session Status Permission Banner */}
      {sessionCancelled && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3 text-rose-900">
          <AlertCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <div className="font-bold text-sm">
              {t("coachBannerCancelledTitle")}
            </div>
            <p>
              {activeSession?.centerInvalidated
                ? t("coachBannerCenterInvalidatedDesc")
                : t("coachBannerCancelledDesc")}
            </p>
          </div>
        </div>
      )}

      {allowCorrection && !sessionCancelled && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2.5 text-amber-900 text-xs font-medium">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
          <span>{t("coachBannerCompletedReadOnlyDesc")}</span>
        </div>
      )}

      {/* Attendance Roster */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-slate-700 shrink-0" />
              <span className="whitespace-nowrap">
                {language === "vi"
                  ? "Danh Sách Học Viên Điểm Danh"
                  : "Attendance Roster"}
              </span>
            </h3>
            <span className="text-xs text-amber-800 font-semibold">
              {language === "vi"
                ? "Thao tác sửa sẽ bắt buộc nhập lý do & ghi nhật ký kiểm toán"
                : "Edits require mandatory reason input & audit log recording"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search by student name or code (P2.2) */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("coachSearchStudentPlaceholder")}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-blue-600 w-56"
              />
            </div>

            {allowCheckIn && !sessionCancelled && (
              <form
                onSubmit={handleQuickCheckin}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={quickMemberInput}
                  onChange={(e) => setQuickMemberInput(e.target.value)}
                  placeholder="Nhập mã check-in / mã HV..."
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-blue-600 w-48"
                />
                <button
                  type="submit"
                  disabled={quickSaving || !quickMemberInput.trim()}
                  className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  {quickSaving ? "Đang xử lý..." : "Điểm danh nhanh"}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Sticky Attendance Summary Bar (P2.2) */}
        {enrolledMembers.length > 0 && (
          <div className="sticky top-0 z-10 bg-slate-900 text-white px-4 py-2.5 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs font-mono shadow-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-emerald-300 font-bold">
                {t("coachAttendanceSummaryPresent")}: {summaryCounts.present}
              </span>
              <span>&bull;</span>
              <span className="text-amber-300 font-bold">
                {t("coachAttendanceSummaryLate")}: {summaryCounts.late}
              </span>
              <span>&bull;</span>
              <span className="text-blue-300 font-bold">
                {t("coachAttendanceSummaryExcused")}: {summaryCounts.excused}
              </span>
              <span>&bull;</span>
              <span className="text-rose-300 font-bold">
                {t("coachAttendanceSummaryAbsent")}: {summaryCounts.absent}
              </span>
              <span>&bull;</span>
              <span className="text-slate-300 font-bold">
                {t("coachAttendanceSummaryUnmarked")}:{" "}
                {summaryCounts.not_recorded}
              </span>
            </div>
            <div className="text-slate-300">
              Tổng: {enrolledMembers.length} HV
            </div>
          </div>
        )}

        <div className="space-y-3">
          {loadingRoster ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 bg-slate-100 animate-pulse rounded border border-slate-200"
                />
              ))}
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded">
              {enrolledMembers.length > 0
                ? "Không tìm thấy học viên khớp với từ khóa."
                : Number(selectedClass?.enrolledCount || 0) > 0
                  ? `Lớp đã có ${selectedClass.enrolledCount} học viên đăng ký. Bạn có thể nhập mã học viên hoặc mã điểm danh ở ô "Điểm danh nhanh" phía trên để ghi nhận buổi học.`
                  : "Lớp học này hiện chưa có học viên nào đăng ký chính thức."}
            </div>
          ) : (
            filteredMembers.map((m) => {
              const { currentStatus, attendanceId, absenceNotice } =
                getMemberStatusAndMeta(m)

              return (
                <div
                  key={m.id}
                  className="min-h-[56px] p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {m.name}
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        ({m.code})
                      </span>
                      {absenceNotice && (
                        <span
                          title={absenceNotice.reason || ""}
                          className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold"
                        >
                          {t("coachHasAbsenceNoticeBadge")}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 font-mono tabular-nums">
                      {t("coachPkgLabel")}: {m.currentPackageName}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                    {/* Single status indicator rule (P2.2):
                        - When Scheduled (allowCheckIn): the 4 one-touch buttons act as the single status indicator.
                        - When Completed/Cancelled: show CoachStatusBadge + optional Correction button. */}
                    {allowCheckIn && !sessionCancelled ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full sm:w-auto">
                        {[
                          {
                            key: "present",
                            label: t("coachStatusPresent"),
                            activeCls:
                              "bg-[#DCFCE7] text-[#166534] border-[#86EFAC] ring-1 ring-[#166534]/20",
                          },
                          {
                            key: "late",
                            label: t("coachStatusLate"),
                            activeCls:
                              "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A] ring-1 ring-[#92400E]/20",
                          },
                          {
                            key: "excused",
                            label: t("coachStatusExcused"),
                            activeCls:
                              "bg-[#DBEAFE] text-[#1E40AF] border-[#BFDBFE] ring-1 ring-[#1E40AF]/20",
                          },
                          {
                            key: "absent",
                            label: t("coachStatusAbsent"),
                            activeCls:
                              "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA] ring-1 ring-[#991B1B]/20",
                          },
                        ].map((btn) => {
                          const isSelected = currentStatus === btn.key
                          return (
                            <button
                              key={btn.key}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() =>
                                handleOneTouchCheckIn(m, btn.key, attendanceId)
                              }
                              className={`min-h-[44px] px-3 py-1.5 text-xs font-bold rounded border transition-colors cursor-pointer ${
                                isSelected
                                  ? btn.activeCls
                                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                              }`}
                            >
                              {btn.label}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <CoachStatusBadge
                          type="attendance"
                          value={currentStatus}
                        />
                        {allowCorrection && !sessionCancelled && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedMemberModal({
                                memberId: m.id,
                                memberName: m.name,
                                status: currentStatus,
                                attendanceId,
                              })
                            }
                            className="min-h-[44px] px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-300 text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer"
                            title="Chỉnh sửa &amp; nhập lý do"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>{t("coachBtnViewOrCorrectAttendance")}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Confirmation Modal for Bulk Mark Present (P2.2) */}
      {showBulkConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-md w-full p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <h4 className="text-sm font-bold text-slate-900">
                {t("coachConfirmBulkPresentTitle")}
              </h4>
              <button
                type="button"
                onClick={() => setShowBulkConfirmModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {t("coachConfirmBulkPresentDesc").replace(
                "{count}",
                String(
                  unmarkedMembers.length > 0
                    ? unmarkedMembers.length
                    : enrolledMembers.length,
                ),
              )}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowBulkConfirmModal(false)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold cursor-pointer"
              >
                {t("coachCancelBtn")}
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkMarkPresent}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold cursor-pointer"
              >
                {t("coachConfirmBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedMemberModal && (
        <AttendanceCorrectionModal
          classId={selectedClass?.id || ""}
          memberId={selectedMemberModal.memberId}
          memberName={selectedMemberModal.memberName}
          currentStatus={selectedMemberModal.status}
          attendanceId={selectedMemberModal.attendanceId}
          onUpdated={loadClassRosterAndAttendance}
          isOpen={!!selectedMemberModal}
          onClose={() => setSelectedMemberModal(null)}
        />
      )}
    </div>
  )
}
