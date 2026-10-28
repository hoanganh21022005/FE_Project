import React, { useState, useEffect, useCallback } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { StatusBadge } from "../common/Badge"
import { AttendanceCorrectionModal } from "../modals/AttendanceCorrectionModal"
import { classEnrollmentApi } from "../../api/classEnrollmentApi"
import { attendanceApi } from "../../api/attendanceApi"
import { getCatalogClassSessions } from "../../api/managerApi"
import { ClipboardCheck, Edit2, RefreshCw } from "lucide-react"

export function CoachAttendanceView() {
  const {
    classes,
    members,
    attendance,
    recordAttendance,
    apiEnabled,
    language,
  } = useSCMS()

  const [selectedClassId, setSelectedClassId] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("scms_selected_attendance_class_id")
      if (saved) return saved
    }
    return classes[0]?.id || ""
  })

  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(String(classes[0].id))
    }
  }, [classes, selectedClassId])

  const selectedClass =
    classes.find((c) => String(c.id) === String(selectedClassId)) ||
    classes[0] ||
    null

  const [selectedMemberModal, setSelectedMemberModal] = useState(null)
  const [apiEnrollments, setApiEnrollments] = useState([])
  const [apiAttendances, setApiAttendances] = useState([])
  const [classSessions, setClassSessions] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState("")
  const [loadingRoster, setLoadingRoster] = useState(false)

  const loadClassRosterAndAttendance = useCallback(async () => {
    if (!apiEnabled || !selectedClass?.id) return
    setLoadingRoster(true)
    try {
      const [enrollments, attendances, sessions] = await Promise.all([
        classEnrollmentApi
          .getEnrollmentsByClass(selectedClass.id)
          .catch(() => []),
        attendanceApi.searchAttendances().catch(() => []),
        getCatalogClassSessions(selectedClass.id, {
          notifyForbidden: false,
        }).catch(() => []),
      ])
      setApiEnrollments(Array.isArray(enrollments) ? enrollments : [])
      setApiAttendances(Array.isArray(attendances) ? attendances : [])
      const sessionList = Array.isArray(sessions) ? sessions : []
      setClassSessions(sessionList)
      if (sessionList.length > 0 && !selectedSessionId) {
        setSelectedSessionId(String(sessionList[0].id))
      }
    } finally {
      setLoadingRoster(false)
    }
  }, [apiEnabled, selectedClass?.id, selectedSessionId])

  useEffect(() => {
    loadClassRosterAndAttendance()
  }, [loadClassRosterAndAttendance])

  const enrolledMembers = React.useMemo(() => {
    if (apiEnabled && apiEnrollments.length > 0) {
      return apiEnrollments.map((enr) => {
        const matched = members.find(
          (m) => String(m.id) === String(enr.memberId),
        )
        return {
          id: enr.memberId,
          name: enr.memberName || matched?.name || `Học viên #${enr.memberId}`,
          code:
            enr.memberCode ||
            matched?.code ||
            `MB-${1000 + Number(enr.memberId || 0)}`,
          currentPackageName:
            matched?.currentPackageName || enr.status || "Đã ghi danh",
        }
      })
    }
    return members.slice(0, 5)
  }, [apiEnabled, apiEnrollments, members])

  const normalizeAttendanceStatus = (state) => {
    const s = String(state || "").toLowerCase()
    if (s.includes("present") || s.includes("checked")) return "present"
    if (s.includes("late")) return "late"
    if (s.includes("absent")) return "absent"
    return "not_recorded"
  }

  return (
    <div className="space-y-6">
      {/* Class Banner & Selector */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
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
                {classSessions.map((ses, idx) => (
                  <option key={ses.id || idx} value={ses.id}>
                    Buổi {idx + 1}: {ses.sessionDate || "—"} (
                    {String(ses.startTime || "").slice(0, 5)})
                  </option>
                ))}
              </select>
            )}
          </div>
          <h2 className="text-base font-bold text-slate-900 mt-1">
            {selectedClass?.nameVi || selectedClass?.name || "Lớp học"}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
            {selectedClass?.date || "Hôm nay"} &bull;{" "}
            {selectedClass?.startTime || "07:00"} &bull; Phòng:{" "}
            {selectedClass?.room || "Sân tập"} &bull; Coach:{" "}
            {selectedClass?.coachName || "HLV"}
          </p>
        </div>

        <div className="flex items-center gap-3">
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
              <span>Đồng bộ</span>
            </button>
          )}
          <div className="p-3 bg-slate-50 rounded border border-slate-200 text-right">
            <div className="text-[10px] text-slate-500 uppercase font-bold whitespace-nowrap">
              {language === "vi" ? "Sức chứa" : "Enrolled Capacity"}
            </div>
            <div className="text-lg font-bold text-slate-900 tabular-nums whitespace-nowrap">
              {apiEnrollments.length ||
                selectedClass?.enrolledCount ||
                enrolledMembers.length}
              /{selectedClass?.capacity || 12}{" "}
              {language === "vi" ? "Học viên" : "Members"}
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Roster */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
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

        <div className="space-y-3">
          {enrolledMembers.map((m) => {
            const localAtt = attendance.find(
              (a) =>
                String(a.classId) === String(selectedClass?.id) &&
                String(a.memberId) === String(m.id),
            )
            const backendAtt = apiAttendances.find(
              (a) =>
                String(a.memberId) === String(m.id) &&
                (!a.classId || String(a.classId) === String(selectedClass?.id)),
            )
            const currentStatus = localAtt
              ? localAtt.status
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
                    {m.code} &bull; Gói: {m.currentPackageName}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <StatusBadge type="attendance" status={currentStatus} />

                  {/* Rapid Attendance Buttons */}
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded border border-slate-300">
                    <button
                      onClick={async () => {
                        if (apiEnabled && selectedSessionId) {
                          await attendanceApi
                            .recordSessionAttendance({
                              memberId: m.id,
                              sessionId: Number(selectedSessionId),
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
                      Có mặt
                    </button>
                    <button
                      onClick={async () => {
                        if (apiEnabled && selectedSessionId) {
                          await attendanceApi
                            .recordSessionAttendance({
                              memberId: m.id,
                              sessionId: Number(selectedSessionId),
                              status: "Excused",
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
                      Trễ / Phép
                    </button>
                    <button
                      onClick={async () => {
                        if (apiEnabled && selectedSessionId) {
                          await attendanceApi
                            .recordSessionAttendance({
                              memberId: m.id,
                              sessionId: Number(selectedSessionId),
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
                      Vắng
                    </button>
                  </div>

                  {/* Edit with reason modal */}
                  <button
                    onClick={() =>
                      setSelectedMemberModal({
                        memberId: m.id,
                        memberName: m.name,
                        status: currentStatus,
                        attendanceId,
                      })
                    }
                    className="p-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded border border-slate-300 text-xs shadow-2xs cursor-pointer"
                    title="Chỉnh sửa &amp; nhập lý do"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
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
