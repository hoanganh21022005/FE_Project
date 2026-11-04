import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { CoachStatusBadge } from "../coach/StatusBadge"
import { formatDate, formatTime, formatTimeRange } from "../../utils/datetime"
import { formatMemberCode } from "../../utils/formatMember"
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
  normalizeSessionStatus,
} from "../../utils/permissions"
import {
  ClipboardCheck,
  Edit2,
  RefreshCw,
  CheckCheck,
  AlertCircle,
  Search,
  X,
  Check,
  Clock,
  FileText,
  XCircle,
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
    const baseList = matched.length > 0 ? matched : classes
    const ptVirtual = {
      id: "PT_1ON1",
      name: "PT 1:1 Sessions",
      nameVi: "Ca kèm PT 1:1",
      isPrivateVirtualClass: true,
      capacity: 1,
      enrolledCount: 1,
      room: "Sân tập PT",
      roomVi: "Sân tập PT",
    }
    return [...baseList, ptVirtual]
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
    coachClasses.find((c) => String(c.id) === String(selectedClassId)) ||
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
  const [savingStateByMember, setSavingStateByMember] = useState({})

  const todayIso = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    [],
  )

  const loadClassRosterAndAttendance = useCallback(async () => {
    if (!apiEnabled || !selectedClass?.id) return
    setLoadingRoster(true)
    try {
      const isPtMode = String(selectedClass.id) === "PT_1ON1"
      const [
        enrollments,
        attendances,
        catalogSessions,
        allClassSessions,
        plans,
      ] = await Promise.all([
        isPtMode
          ? Promise.resolve([])
          : classEnrollmentApi
              .getEnrollmentsByClass(selectedClass.id, { notifyForbidden: false })
              .catch(() => []),
        attendanceApi.searchAttendances().catch(() => []),
        isPtMode
          ? Promise.resolve([])
          : getCatalogClassSessions(selectedClass.id, {
              notifyForbidden: false,
            }).catch(() => []),
        isPtMode
          ? memberPortalApi
              .getClassSessions(
                resolvedCoachId ? { coachId: resolvedCoachId } : {},
              )
              .then((list) =>
                (Array.isArray(list) ? list : []).filter(
                  (s) => s.isPrivate === true,
                ),
              )
              .catch(() => [])
          : memberPortalApi
              .getClassSessions({ classId: selectedClass.id })
              .catch(() => []),
        isPtMode
          ? Promise.resolve([])
          : memberPortalApi
              .getTrainingPlans({ classId: selectedClass.id })
              .catch(() => []),
      ])

      setApiEnrollments(Array.isArray(enrollments) ? enrollments : [])
      setApiAttendances(Array.isArray(attendances) ? attendances : [])
      setClassTrainingPlans(Array.isArray(plans) ? plans : [])

      // Merge /api/sessions?classId= (which includes Completed + Scheduled + Cancelled)
      // with /api/sessions/catalog/{classId} so we have the FULL course session list (R1.1 & R1.3)
      const sessionMap = new Map()
      const upsertSession = (s) => {
        if (!s || !s.id) return
        const prev = sessionMap.get(String(s.id)) || {}
        sessionMap.set(String(s.id), {
          ...prev,
          ...s,
          status: s.status || prev.status || null,
          centerInvalidated:
            s.centerInvalidated === true || prev.centerInvalidated === true,
        })
      }
      ;(Array.isArray(catalogSessions) ? catalogSessions : []).forEach(
        upsertSession,
      )
      ;(Array.isArray(allClassSessions) ? allClassSessions : []).forEach(
        upsertSession,
      )

      const sortedSessions = Array.from(sessionMap.values())
        .sort((a, b) => {
          const dA = `${a.sessionDate || ""}T${a.startTime || "00:00"}`
          const dB = `${b.sessionDate || ""}T${b.startTime || "00:00"}`
          return dA.localeCompare(dB)
        })
        .map((s, idx) => ({
          ...s,
          computedOrderNumber: s.sessionNumber || idx + 1,
        }))

      setClassSessions(sortedSessions)

      // Determine active session:
      // 1. Keep selectedSessionId if it belongs to sortedSessions
      // 2. Otherwise pick today's or nearest upcoming Scheduled session
      // 3. Otherwise fallback to the most recent session
      const matchingExisting = sortedSessions.find(
        (s) => String(s.id) === String(selectedSessionId),
      )
      const nextScheduled = sortedSessions.find(
        (s) =>
          !isSessionCancelled(s) &&
          canCheckIn(s) &&
          String(s.sessionDate || "") >= todayIso,
      )
      const fallbackSession =
        matchingExisting ||
        nextScheduled ||
        sortedSessions.find((s) => !isSessionCancelled(s)) ||
        sortedSessions[0] ||
        null

      const effectiveSessionId = fallbackSession
        ? String(fallbackSession.id)
        : ""
      if (effectiveSessionId && effectiveSessionId !== String(selectedSessionId)) {
        setSelectedSessionId(effectiveSessionId)
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
  }, [apiEnabled, selectedClass?.id, selectedSessionId, todayIso])

  useEffect(() => {
    loadClassRosterAndAttendance()
  }, [loadClassRosterAndAttendance])

  const activeSession = useMemo(() => {
    if (classSessions.length === 0) {
      return { status: "Scheduled", computedOrderNumber: 1 }
    }
    return (
      classSessions.find((s) => String(s.id) === String(selectedSessionId)) ||
      classSessions[0] || { status: "Scheduled", computedOrderNumber: 1 }
    )
  }, [classSessions, selectedSessionId])

  const totalClassSessions = useMemo(() => {
    return Math.max(
      classSessions.length,
      Number(
        selectedClass?.totalSessions ||
          selectedClass?.sessionCount ||
          classSessions.length ||
          1,
      ),
    )
  }, [classSessions.length, selectedClass?.totalSessions, selectedClass?.sessionCount])

  const enrolledMembers = useMemo(() => {
    if (apiEnabled) {
      const rosterMap = new Map()
      const upsertMember = (id, name, code) => {
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
          code: formatMemberCode(
            numId,
            code || existing?.code || matched?.code,
          ),
        })
      }

      const activeList = apiEnrollments.filter((enr) =>
        isActiveNormalEnrollment(enr),
      )
      activeList.forEach((enr) =>
        upsertMember(enr.memberId, enr.memberName, enr.memberCode),
      )

      if (activeSession?.bookedMemberId) {
        upsertMember(
          activeSession.bookedMemberId,
          activeSession.bookedMemberName,
          null,
        )
      }

      sessionTrainingResults.forEach((res) =>
        upsertMember(res.memberId, res.memberName, null),
      )

      // Include members who have attendance records in this class so roster is complete even if /enrollments returns 403
      apiAttendances
        .filter(
          (a) =>
            (selectedSessionId &&
              String(a.sessionId) === String(selectedSessionId)) ||
            (selectedClass?.id &&
              String(a.classId) === String(selectedClass.id)) ||
            classSessions.some((cs) => String(cs.id) === String(a.sessionId)),
        )
        .forEach((att) =>
          upsertMember(att.memberId, att.memberName, att.memberCode),
        )

      classTrainingPlans.forEach((plan) =>
        upsertMember(plan.memberId, plan.memberName, null),
      )

      sessionAbsenceNotices.forEach((notice) =>
        upsertMember(notice.memberId, notice.memberName, null),
      )

      return Array.from(rosterMap.values())
    }
    return members.slice(0, 5).map((m) => ({
      ...m,
      code: formatMemberCode(m.id, m.code),
    }))
  }, [
    apiEnabled,
    apiEnrollments,
    activeSession,
    sessionTrainingResults,
    apiAttendances,
    selectedSessionId,
    selectedClass?.id,
    classSessions,
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

  // R1.2: Strictly match attendance ONLY for the currently selected session (selectedSessionId).
  // Never leak attendance status from a past session onto an upcoming session!
  // Pre-reported absence notices (sessionAbsenceNotices) are kept separate from currentStatus.
  const getMemberStatusAndMeta = useCallback(
    (m) => {
      const optKey = `${selectedSessionId || selectedClass?.id || "cls"}_${m.id}`
      const optVal = optimisticStatusMap[optKey]

      const localAtt = attendance.find(
        (a) =>
          String(a.memberId) === String(m.id) &&
          (selectedSessionId
            ? String(a.sessionId) === String(selectedSessionId)
            : String(a.classId) === String(selectedClass?.id)),
      )
      const sessionResultAtt = selectedSessionId
        ? sessionTrainingResults.find(
            (r) =>
              String(r.memberId) === String(m.id) &&
              String(r.sessionId) === String(selectedSessionId),
          )
        : null
      const backendAtt = selectedSessionId
        ? apiAttendances.find(
            (a) =>
              String(a.memberId) === String(m.id) &&
              String(a.sessionId) === String(selectedSessionId),
          )
        : null

      const currentStatus =
        optVal ||
        (localAtt
          ? localAtt.status
          : backendAtt
            ? normalizeAttendanceStatus(backendAtt.state)
            : sessionResultAtt?.attendanceStatus
              ? normalizeAttendanceStatus(sessionResultAtt.attendanceStatus)
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

      const saveState = savingStateByMember[optKey] || null

      return { currentStatus, attendanceId, absenceNotice, saveState }
    },
    [
      selectedSessionId,
      selectedClass?.id,
      optimisticStatusMap,
      attendance,
      sessionTrainingResults,
      apiAttendances,
      sessionAbsenceNotices,
      savingStateByMember,
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

    setOptimisticStatusMap((prev) => ({
      ...prev,
      [optKey]: targetStatus,
    }))
    setSavingStateByMember((prev) => ({
      ...prev,
      [optKey]: "saving",
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
      setSavingStateByMember((prev) => ({
        ...prev,
        [optKey]: "saved",
      }))
    } catch (err) {
      setOptimisticStatusMap((prev) => ({
        ...prev,
        [optKey]: prevStatus,
      }))
      setSavingStateByMember((prev) => ({
        ...prev,
        [optKey]: "error",
      }))
      showToast?.(
        getErrorMessage(
          err,
          "Không thể lưu điểm danh. Đã hoàn tác trạng thái.",
        ),
        "error",
      )
    }
  }

  // R1.5: Bulk mark Present ONLY marks unmarked students (never overwrites students who already have a status)
  const handleConfirmBulkMarkPresent = async () => {
    if (unmarkedMembers.length === 0 || bulkSaving) {
      setShowBulkConfirmModal(false)
      return
    }
    const targets = unmarkedMembers
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
        `Đã điểm danh Có mặt cho ${targets.length} học viên chưa điểm danh!`,
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
            notes: "Điểm danh nhanh theo mã hội viên",
          })
        }
        await recordAttendance(
          selectedClass?.id,
          resolvedMemberId,
          "present",
          undefined,
          {
            memberName: `Học viên ${formatMemberCode(resolvedMemberId)}`,
            sessionId: selectedSessionId,
            coachId: resolvedCoachId,
          },
        )
        setQuickMemberInput("")
        await loadClassRosterAndAttendance()
        showToast?.(
          `Đã điểm danh Có mặt cho ${formatMemberCode(resolvedMemberId)}!`,
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
          "Không thể điểm danh cho mã hội viên / mã check-in này.",
        "error",
      )
    } finally {
      setQuickSaving(false)
    }
  }

  const sessionCancelled = isSessionCancelled(activeSession)
  const allowCheckIn = canCheckIn(activeSession)
  const allowCorrection = canCorrectAttendance(activeSession)
  const resolvedSessionStatus = normalizeSessionStatus(activeSession) || "Scheduled"

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Class Banner & Selector */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <CoachStatusBadge
              type="session"
              value={
                sessionCancelled && activeSession?.centerInvalidated
                  ? "centerInvalidated"
                  : resolvedSessionStatus
              }
            />
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
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.nameVi || cls.name}
                  </option>
                ))}
              </select>
            )}
            {classSessions.length > 0 && (
              <select
                value={selectedSessionId}
                onChange={(e) => {
                  setSelectedSessionId(e.target.value)
                  if (typeof window !== "undefined") {
                    sessionStorage.setItem(
                      "scms_selected_attendance_session_id",
                      e.target.value,
                    )
                  }
                }}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
              >
                {classSessions.map((ses, idx) => {
                  const isCancel = isSessionCancelled(ses)
                  const orderNum = ses.computedOrderNumber || idx + 1
                  return (
                    <option
                      key={ses.id || idx}
                      value={ses.id}
                      disabled={
                        isCancel && String(ses.id) !== String(selectedSessionId)
                      }
                    >
                      Buổi {orderNum}/{totalClassSessions} ·{" "}
                      {formatDate(ses.sessionDate)} ({formatTime(ses.startTime)})
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
            const orderNum = activeSession?.computedOrderNumber || 1
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
              <p className="text-xs text-slate-600 mt-0.5 font-mono tabular-nums">
                Buổi {orderNum}/{totalClassSessions} &bull; Ngày: {sesDate} &bull;
                Ca: {sesTime} &bull; Sân: {sesRoom}
              </p>
            )
          })()}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {enrolledMembers.length > 0 && allowCheckIn && !sessionCancelled && (
            <button
              type="button"
              onClick={() => setShowBulkConfirmModal(true)}
              disabled={
                bulkSaving || loadingRoster || unmarkedMembers.length === 0
              }
              title={
                unmarkedMembers.length === 0
                  ? "Tất cả học viên trong buổi đã có trạng thái điểm danh"
                  : ""
              }
              className="px-3.5 py-2 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              <span>
                {bulkSaving
                  ? "Đang điểm danh..."
                  : `Điểm danh tất cả Có mặt (${unmarkedMembers.length})`}
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
              {language === "vi" ? "Sĩ số lớp" : "Enrolled Capacity"}
            </div>
            <div className="text-lg font-bold text-slate-900 tabular-nums whitespace-nowrap">
              {enrolledMembers.length || selectedClass?.enrolledCount || 0}/
              {selectedClass?.capacity || 12}{" "}
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
                  ? "Danh sách học viên điểm danh"
                  : "Attendance roster"}
              </span>
            </h3>
            <span className="text-xs text-slate-500">
              {language === "vi"
                ? "Bấm một chạm để điểm danh trong buổi học hoặc sửa điểm danh kèm lý do khi buổi đã kết thúc"
                : "One-tap check-in for scheduled sessions or edit with mandatory reason for completed sessions"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search by student name or code */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("coachSearchStudentPlaceholder")}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-blue-600 w-52"
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
                  placeholder="Quét QR / nhập MB-xxxx..."
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-blue-600 w-44"
                />
                <button
                  type="submit"
                  disabled={quickSaving || !quickMemberInput.trim()}
                  className="px-3 py-1.5 min-h-[36px] bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded text-xs font-bold whitespace-nowrap cursor-pointer"
                >
                  {quickSaving ? "Đang xử lý..." : "Điểm danh nhanh"}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Sticky Attendance Summary Bar (R1.2 & R1.5) */}
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
                  ? `Lớp đã có ${selectedClass.enrolledCount} học viên đăng ký. Bạn có thể nhập mã hội viên (MB-xxxx) hoặc quét QR ở ô "Điểm danh nhanh" phía trên để ghi nhận buổi học.`
                  : "Lớp học này hiện chưa có học viên nào đăng ký chính thức."}
            </div>
          ) : (
            filteredMembers.map((m) => {
              const {
                currentStatus,
                attendanceId,
                absenceNotice,
                saveState,
              } = getMemberStatusAndMeta(m)

              return (
                <div
                  key={m.id}
                  className="min-h-[56px] p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {m.name}
                      </span>
                      <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-xs font-mono font-semibold text-slate-700">
                        {m.code}
                      </span>

                      {/* R1.2: Neutral pre-reported absence badge, separate from attendance status */}
                      {absenceNotice && (
                        <span
                          title={absenceNotice.reason || ""}
                          className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3 text-slate-600" />
                          <span>
                            {t("coachPreAbsenceReasonPrefix")}{" "}
                            {absenceNotice.reason || "Xin nghỉ phép"}
                          </span>
                        </span>
                      )}

                      {saveState === "saving" && (
                        <span className="text-[11px] font-mono text-blue-700">
                          {t("coachSavingRow")}
                        </span>
                      )}
                      {saveState === "saved" && (
                        <span className="text-[11px] font-mono text-emerald-700">
                          ✓ {t("coachSavedRow")}
                        </span>
                      )}
                      {saveState === "error" && (
                        <span className="text-[11px] font-mono text-rose-700">
                          {t("coachErrorRow")}
                        </span>
                      )}
                    </div>

                    {/* R1.4: Group class shows member code & group label, NEVER "Gói PT: Điểm danh lớp" */}
                    <div className="text-xs text-slate-500">
                      {activeSession?.isPrivate
                        ? `${t("coachPtSessionSubtitle")} · ${t("coachMemberCodePrefix")}: ${m.code}`
                        : `${t("coachGroupEnrolledSubtitle")} · Khóa ${totalClassSessions} buổi`}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                    {/* R1.1 & R1.5: 4 one-touch buttons on 1 single row even at 375px */}
                    {allowCheckIn && !sessionCancelled ? (
                      <div className="grid grid-cols-4 gap-1 w-full sm:w-auto">
                        {[
                          {
                            key: "present",
                            label: t("coachStatusPresent"),
                            shortLabel: "Có mặt",
                            Icon: Check,
                            activeCls:
                              "bg-[#DCFCE7] text-[#166534] border-[#86EFAC] ring-1 ring-[#166534]/20",
                          },
                          {
                            key: "late",
                            label: t("coachStatusLate"),
                            shortLabel: "Đi trễ",
                            Icon: Clock,
                            activeCls:
                              "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A] ring-1 ring-[#92400E]/20",
                          },
                          {
                            key: "excused",
                            label: t("coachStatusExcused"),
                            shortLabel: "Có phép",
                            Icon: FileText,
                            activeCls:
                              "bg-[#DBEAFE] text-[#1E40AF] border-[#BFDBFE] ring-1 ring-[#1E40AF]/20",
                          },
                          {
                            key: "absent",
                            label: t("coachStatusAbsent"),
                            shortLabel: "Vắng",
                            Icon: XCircle,
                            activeCls:
                              "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA] ring-1 ring-[#991B1B]/20",
                          },
                        ].map((btn) => {
                          const isSelected = currentStatus === btn.key
                          const IconComp = btn.Icon
                          return (
                            <button
                              key={btn.key}
                              type="button"
                              aria-label={btn.label}
                              aria-pressed={isSelected}
                              onClick={() =>
                                handleOneTouchCheckIn(m, btn.key, attendanceId)
                              }
                              className={`min-h-[44px] px-2 sm:px-3 py-1.5 text-xs font-bold rounded border flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                                isSelected
                                  ? btn.activeCls
                                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                              }`}
                            >
                              <IconComp className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{btn.shortLabel}</span>
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

      {/* Confirmation Modal for Bulk Mark Present (R1.5) */}
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
                String(unmarkedMembers.length),
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
