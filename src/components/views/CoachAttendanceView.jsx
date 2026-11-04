import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { StatusBadge } from "../common/Badge"
import { AttendanceCorrectionModal } from "../modals/AttendanceCorrectionModal"
import { classEnrollmentApi } from "../../api/classEnrollmentApi"
import { attendanceApi } from "../../api/attendanceApi"
import { memberPortalApi } from "../../api/memberPortalApi"
import { getCatalogClassSessions } from "../../api/managerApi"
import { isActiveNormalEnrollment } from "../../utils/memberScheduleUtils"
import {
  canCheckIn,
  canCorrectAttendance,
  isSessionCancelled,
} from "../../utils/permissions"
import { ClipboardCheck, Edit2, RefreshCw, CheckCheck, AlertCircle } from "lucide-react"

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
  const [quickMemberInput, setQuickMemberInput] = useState("")
  const [quickSaving, setQuickSaving] = useState(false)

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
    if (s.includes("late") || s.includes("excused")) return "late"
    if (s.includes("absent")) return "absent"
    return "not_recorded"
  }

  const handleBulkMarkPresent = async () => {
    if (enrolledMembers.length === 0 || bulkSaving) return
    setBulkSaving(true)
    try {
      if (apiEnabled && selectedSessionId) {
        await memberPortalApi
          .recordBulkTrainingResults({
            sessionId: Number(selectedSessionId),
            coachId: Number(resolvedCoachId),
            items: enrolledMembers.map((m) => ({
              memberId: Number(m.id),
              attendanceStatus: "Present",
              content: "Có mặt đầy đủ theo điểm danh lớp",
            })),
          })
          .catch(() => {})
      }
      for (const m of enrolledMembers) {
        await recordAttendance(selectedClass?.id, m.id, "present", undefined, {
          memberName: m.name,
          sessionId: selectedSessionId,
          coachId: resolvedCoachId,
        })
      }
      await loadClassRosterAndAttendance()
      showToast?.(
        `Đã điểm danh Có mặt cho toàn bộ ${enrolledMembers.length} học viên!`,
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
    <div className="space-y-6">
      {/* Class Banner & Selector */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
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
                    {cls.nameVi || cls.name} ({cls.startTime || "Lịch học"})
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
                      Buổi {idx + 1}: {ses.sessionDate || "—"} (
                      {String(ses.startTime || "").slice(0, 5)})
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
            const sesDate =
              activeSession?.sessionDate || selectedClass?.date || "Hôm nay"
            const sesTime = activeSession?.startTime
              ? `${String(activeSession.startTime).slice(0, 5)}${
                  activeSession.endTime
                    ? ` – ${String(activeSession.endTime).slice(0, 5)}`
                    : ""
                }`
              : selectedClass?.startTime || "Theo ca học"
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

        <div className="flex items-center gap-3">
          {enrolledMembers.length > 0 && allowCheckIn && !sessionCancelled && (
            <button
              type="button"
              onClick={handleBulkMarkPresent}
              disabled={bulkSaving || loadingRoster}
              className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
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
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loadingRoster ? "animate-spin" : ""}`}
              />
              <span>{t("coachBtnRefresh")}</span>
            </button>
          )}
          <div className="p-3 bg-slate-50 rounded border border-slate-200 text-right">
            <div className="text-[10px] text-slate-500 uppercase font-bold whitespace-nowrap">
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
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
                ? "Thao tác sửa sẽ bắt buộc nhập lý do & ghi Audit Log"
                : "Edits require mandatory reason input & Audit Log recording"}
            </span>
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
                placeholder="Nhập ID (VD: 1, MB-1001) hoặc Mã Check-in..."
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-blue-600 w-64"
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

        <div className="space-y-3">
          {enrolledMembers.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded">
              {Number(selectedClass?.enrolledCount || 0) > 0
                ? `Lớp đã có ${selectedClass.enrolledCount} học viên đăng ký. Bạn có thể nhập ID học viên (VD: 1 hoặc MB-1001) hoặc Mã Check-in ở ô "Điểm danh nhanh" phía trên để ghi nhận buổi học.`
                : "Lớp học này hiện chưa có học viên nào đăng ký chính thức (Active)."}
            </div>
          ) : (
            enrolledMembers.map((m) => {
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
              const currentStatus = localAtt
                ? localAtt.status
                : sessionResultAtt?.attendanceStatus
                  ? normalizeAttendanceStatus(sessionResultAtt.attendanceStatus)
                  : backendAtt
                    ? normalizeAttendanceStatus(backendAtt.state)
                    : "not_recorded"
              const attendanceId =
                localAtt?.attendanceId || backendAtt?.attendanceId || null

              return (
                <div
                  key={m.id}
                  className="p-3.5 bg-slate-50 border border-slate-200 rounded flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {m.name}
                    </div>
                    <div className="text-xs text-slate-500 font-mono tabular-nums">
                      {m.code} &bull; {t("coachPkgLabel")}: {m.currentPackageName}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <StatusBadge type="attendance" status={currentStatus} />

                    {/* Rapid Attendance Buttons (only when session is Scheduled) */}
                    {allowCheckIn && !sessionCancelled && (
                      <div className="flex items-center gap-1 bg-white p-0.5 rounded border border-slate-300">
                        <button
                          onClick={async () => {
                            if (apiEnabled && selectedSessionId) {
                              await attendanceApi
                                .recordSessionAttendance({
                                  memberId: m.id,
                                  sessionId: Number(selectedSessionId),
                                  coachId: resolvedCoachId,
                                  status: "Present",
                                  notes: "Điểm danh có mặt đúng giờ",
                                })
                                .catch(() => {})
                            }
                            await recordAttendance(
                              selectedClass?.id,
                              m.id,
                              "present",
                              undefined,
                              {
                                attendanceId,
                                memberName: m.name,
                              },
                            )
                            loadClassRosterAndAttendance()
                          }}
                          className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer ${
                            currentStatus === "present"
                              ? "bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {t("coachStatusPresent")}
                        </button>
                        <button
                          onClick={async () => {
                            if (apiEnabled && selectedSessionId) {
                              await attendanceApi
                                .recordSessionAttendance({
                                  memberId: m.id,
                                  sessionId: Number(selectedSessionId),
                                  coachId: resolvedCoachId,
                                  status: "Late",
                                  notes: "Có phép / Đến trễ đã báo trước",
                                })
                                .catch(() => {})
                            }
                            await recordAttendance(
                              selectedClass?.id,
                              m.id,
                              "late",
                              undefined,
                              {
                                attendanceId,
                                memberName: m.name,
                              },
                            )
                            loadClassRosterAndAttendance()
                          }}
                          className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer ${
                            currentStatus === "late"
                              ? "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {t("coachStatusLate")} / Phép
                        </button>
                        <button
                          onClick={async () => {
                            if (apiEnabled && selectedSessionId) {
                              await attendanceApi
                                .recordSessionAttendance({
                                  memberId: m.id,
                                  sessionId: Number(selectedSessionId),
                                  coachId: resolvedCoachId,
                                  status: "Absent",
                                  notes: "Vắng mặt không phép",
                                })
                                .catch(() => {})
                            }
                            await recordAttendance(
                              selectedClass?.id,
                              m.id,
                              "absent",
                              undefined,
                              {
                                attendanceId,
                                memberName: m.name,
                              },
                            )
                            loadClassRosterAndAttendance()
                          }}
                          className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer ${
                            currentStatus === "absent"
                              ? "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {t("coachStatusAbsent")}
                        </button>
                      </div>
                    )}

                    {/* Edit with reason modal (only when session is Completed) */}
                    {allowCorrection && !sessionCancelled && (
                      <button
                        onClick={() =>
                          setSelectedMemberModal({
                            memberId: m.id,
                            memberName: m.name,
                            status: currentStatus,
                            attendanceId,
                          })
                        }
                        className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-300 text-xs font-bold shadow-2xs flex items-center gap-1 cursor-pointer"
                        title="Chỉnh sửa &amp; nhập lý do"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>{t("coachBtnViewOrCorrectAttendance")}</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

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
