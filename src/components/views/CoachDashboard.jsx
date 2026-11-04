import React, { useState, useEffect, useMemo } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { formatDate } from "../../locales/translations"
import { memberPortalApi } from "../../api/memberPortalApi"
import { memberApi } from "../../api/memberApi"
import { attendanceApi } from "../../api/attendanceApi"
import { getCatalogClassSessions } from "../../api/managerApi"
import { isSessionCancelled } from "../../utils/permissions"
import {
  Calendar,
  Users,
  ClipboardCheck,
  Clock,
  BarChart3,
  TrendingUp,
  Star,
  AlertTriangle,
  MessageSquare,
  HelpCircle,
} from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts"

export function CoachDashboard() {
  const {
    classes,
    feedbacks,
    currentUser,
    setCurrentTab,
    apiEnabled,
    t,
    language,
  } = useSCMS()

  const [coachFeedbackSummary, setCoachFeedbackSummary] = useState({
    totalFeedback: 0,
    averageCoachRating: 0,
    feedback: [],
  })
  const [atRiskMembers, setAtRiskMembers] = useState([])
  const [advRegistrations, setAdvRegistrations] = useState([])
  const [sessionsByClassId, setSessionsByClassId] = useState({})
  const [coachSessions, setCoachSessions] = useState([])
  const [attendanceRecords, setAttendanceRecords] = useState([])

  const myClasses = useMemo(() => {
    const resolvedCoachId = currentUser.coachId || currentUser.id
    const matched = classes.filter(
      (c) =>
        String(c.coachId) === String(resolvedCoachId) ||
        String(c.coachId) === String(currentUser.id) ||
        String(c.coachName || "")
          .toLowerCase()
          .includes(String(currentUser.name || "").toLowerCase()) ||
        (!apiEnabled && String(c.coachName || "").includes("Mai")),
    )
    return matched.length > 0 ? matched : classes
  }, [classes, currentUser.coachId, currentUser.id, currentUser.name, apiEnabled])

  useEffect(() => {
    if (!apiEnabled) return
    let active = true
    const resolvedCoachId = currentUser.coachId || currentUser.id
    Promise.all([
      memberPortalApi.getCoachFeedback().catch(() => ({
        totalFeedback: 0,
        averageCoachRating: 0,
        feedback: [],
      })),
      memberApi.getCoachAtRiskMembers().catch(() => []),
      memberPortalApi.getAdvancedRegistrations().catch(() => []),
      Promise.all(
        myClasses.map((cls) =>
          Promise.all([
            attendanceApi.getSessions({ classId: cls.id }).catch(() => []),
            getCatalogClassSessions(cls.id, { notifyForbidden: false }).catch(
              () => [],
            ),
          ]).then(([directList, catalogList]) => {
            const byId = new Map()
            ;(Array.isArray(directList) ? directList : []).forEach((s) => {
              if (s?.id != null) byId.set(String(s.id), s)
            })
            ;(Array.isArray(catalogList) ? catalogList : []).forEach((s) => {
              if (s?.id != null && !byId.has(String(s.id))) {
                byId.set(String(s.id), s)
              }
            })
            return [String(cls.id), Array.from(byId.values())]
          }),
        ),
      ),
      attendanceApi
        .getSessions(resolvedCoachId ? { coachId: resolvedCoachId } : {})
        .catch(() => []),
      attendanceApi.searchAttendances().catch(() => []),
    ]).then(
      ([
        fbData,
        riskList,
        advList,
        sessionEntries,
        allCoachSessions,
        attList,
      ]) => {
        if (!active) return
        if (fbData) setCoachFeedbackSummary(fbData)
        if (Array.isArray(riskList)) setAtRiskMembers(riskList)
        if (Array.isArray(advList)) setAdvRegistrations(advList)
        if (Array.isArray(sessionEntries)) {
          setSessionsByClassId(Object.fromEntries(sessionEntries))
        }
        if (Array.isArray(allCoachSessions)) {
          setCoachSessions(allCoachSessions)
        }
        if (Array.isArray(attList)) {
          setAttendanceRecords(attList)
        }
      },
    )
    return () => {
      active = false
    }
  }, [apiEnabled, myClasses, currentUser.coachId, currentUser.id])

  // R2.1: Count unique PT students by memberId (and total active/accepted PT packages separately)
  const ptStats = useMemo(() => {
    const activeOrAccepted = advRegistrations.filter((r) => {
      const st = String(r.status || "").toLowerCase()
      return (
        r.subscriptionId ||
        (st !== "rejected" &&
          st !== "declined" &&
          st !== "cancelled" &&
          st !== "requested" &&
          st !== "pending")
      )
    })
    const uniqueMemberIds = new Set(
      activeOrAccepted
        .map((r) => (r.memberId != null ? String(r.memberId) : null))
        .filter(Boolean),
    )
    return {
      uniqueStudentCount: uniqueMemberIds.size,
      packageCount: activeOrAccepted.length,
    }
  }, [advRegistrations])

  // Merge all real sessions belonging to this coach (class sessions + PT sessions)
  const allKnownSessions = useMemo(() => {
    const byId = new Map()
    Object.values(sessionsByClassId).forEach((list) => {
      ;(Array.isArray(list) ? list : []).forEach((s) => {
        if (s?.id != null) byId.set(String(s.id), s)
      })
    })
    coachSessions.forEach((s) => {
      if (s?.id != null && !byId.has(String(s.id))) {
        byId.set(String(s.id), s)
      }
    })
    return Array.from(byId.values())
  }, [sessionsByClassId, coachSessions])

  // R2.1: Real attendance rate & weekly breakdown ONLY for days with real sessions/records
  const realAttendanceMetrics = useMemo(() => {
    const mySessionIds = new Set(allKnownSessions.map((s) => String(s.id)))
    const sessionById = new Map(allKnownSessions.map((s) => [String(s.id), s]))

    const validRecords = attendanceRecords.filter((rec) => {
      if (mySessionIds.size > 0 && rec.sessionId != null) {
        return mySessionIds.has(String(rec.sessionId))
      }
      return true
    })

    let attendedCount = 0
    let totalRecorded = 0

    // Group by weekday (1=Mon .. 6=Sat, 0=Sun)
    const dayBuckets = new Map()

    validRecords.forEach((rec) => {
      const st = String(rec.status || "").toLowerCase()
      if (!st || st === "unmarked") return
      totalRecorded += 1
      const isAttended = st === "present" || st === "late"
      if (isAttended) attendedCount += 1

      const ses = sessionById.get(String(rec.sessionId))
      const rawDate = ses?.sessionDate || ses?.date || rec.checkInTime
      if (rawDate) {
        const d = new Date(
          String(rawDate).length === 10
            ? `${rawDate}T00:00:00`
            : String(rawDate),
        )
        if (!Number.isNaN(d.getTime())) {
          const dayIdx = d.getDay() // 0..6
          const cur = dayBuckets.get(dayIdx) || { attended: 0, total: 0 }
          cur.total += 1
          if (isAttended) cur.attended += 1
          dayBuckets.set(dayIdx, cur)
        }
      }
    })

    const overallRate =
      totalRecorded > 0 ? Math.round((attendedCount / totalRecorded) * 100) : null

    const dayOrder = [1, 2, 3, 4, 5, 6, 0]
    const dayLabelsVi = {
      1: "Thứ 2",
      2: "Thứ 3",
      3: "Thứ 4",
      4: "Thứ 5",
      5: "Thứ 6",
      6: "Thứ 7",
      0: "CN",
    }
    const dayLabelsEn = {
      1: "Mon",
      2: "Tue",
      3: "Wed",
      4: "Thu",
      5: "Fri",
      6: "Sat",
      0: "Sun",
    }

    const weeklyBars = dayOrder
      .filter((dayIdx) => {
        const b = dayBuckets.get(dayIdx)
        return b && b.total > 0
      })
      .map((dayIdx) => {
        const b = dayBuckets.get(dayIdx)
        return {
          day: language === "vi" ? dayLabelsVi[dayIdx] : dayLabelsEn[dayIdx],
          rate: Math.round((b.attended / b.total) * 100),
          attended: b.attended,
          total: b.total,
        }
      })

    return {
      overallRate,
      attendedCount,
      totalRecorded,
      weeklyBars,
    }
  }, [allKnownSessions, attendanceRecords, language])

  const feedbackItems = useMemo(() => {
    if (apiEnabled && coachFeedbackSummary.feedback?.length > 0) {
      return coachFeedbackSummary.feedback
    }
    return feedbacks.map((fb) => ({
      classId: fb.classId,
      className: fb.className,
      classRating: fb.classRating || fb.rating || 5,
      coachRating: fb.coachRating || fb.rating || 5,
      comment: fb.comment,
      createdAt: fb.createdAt,
    }))
  }, [apiEnabled, coachFeedbackSummary.feedback, feedbacks])

  const averageRating = useMemo(() => {
    if (apiEnabled && coachFeedbackSummary.averageCoachRating > 0) {
      return Number(coachFeedbackSummary.averageCoachRating).toFixed(1)
    }
    if (feedbackItems.length === 0) return "5.0"
    const sum = feedbackItems.reduce(
      (acc, item) => acc + Number(item.coachRating || 5),
      0,
    )
    return (sum / feedbackItems.length).toFixed(1)
  }, [apiEnabled, coachFeedbackSummary.averageCoachRating, feedbackItems])

  const chartData = myClasses.map((c) => {
    const label = language === "vi" ? c.nameVi || c.name : c.name
    return {
      name:
        String(label || "").length > 15
          ? String(label).slice(0, 15) + "..."
          : label,
      enrolled: c.enrolledCount ?? 0,
      capacity: c.capacity ?? 12,
    }
  })

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
      {/* Welcome Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded bg-slate-900 flex items-center justify-center text-white font-bold text-sm">
            PT
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {language === "vi"
                ? `Xin chào Coach ${currentUser.name}!`
                : `Welcome Coach ${currentUser.name}!`}
            </h2>
            <p className="text-xs text-slate-500">
              {language === "vi"
                ? "Lịch dạy, quản lý học viên phân công, thống kê điểm danh & phản hồi học viên"
                : "Teaching schedule, assigned students, attendance statistics & student feedback"}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              {language === "vi" ? "Lớp phụ trách" : "Assigned classes"}
            </span>
            <Calendar className="w-4 h-4 text-brand-accent-dark" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums mt-2">
            {myClasses.length}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              {language === "vi" ? "Học viên PT chính" : "PT students"}
            </span>
            <Users className="w-4 h-4 text-brand-purple" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums mt-2 flex items-baseline gap-2">
            <span>{apiEnabled ? ptStats.uniqueStudentCount : 1}</span>
            {apiEnabled && ptStats.packageCount > 0 && (
              <span className="text-xs font-normal text-slate-500">
                ({ptStats.packageCount} {t("coachPkgLabel")})
              </span>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-bold text-slate-500 flex items-center gap-1 cursor-help"
              title={t("coachAttendanceFormulaTooltip")}
            >
              <span>
                {language === "vi" ? "Tỷ lệ điểm danh" : "Attendance rate"}
              </span>
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            </span>
            <ClipboardCheck className="w-4 h-4 text-brand-teal" />
          </div>
          {realAttendanceMetrics.overallRate !== null ? (
            <div className="mt-2">
              <div className="text-2xl font-bold text-brand-teal-dark tabular-nums">
                {realAttendanceMetrics.overallRate}%
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {realAttendanceMetrics.attendedCount}/
                {realAttendanceMetrics.totalRecorded}{" "}
                {language === "vi" ? "lượt có mặt" : "attended"}
              </div>
            </div>
          ) : (
            <div className="text-sm font-semibold text-slate-500 mt-3">
              {t("coachInsufficientData")}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">
              {language === "vi" ? "Đánh giá HLV" : "Coach rating"}
            </span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-700 tabular-nums mt-2">
            {averageRating}{" "}
            <span className="text-xs font-normal text-slate-500">
              / 5.0 ({feedbackItems.length}{" "}
              {language === "vi" ? "đánh giá" : "reviews"})
            </span>
          </div>
        </div>
      </div>

      {/* Statistical Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Class Enrollment vs Capacity Chart */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-700 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 whitespace-nowrap">
                {language === "vi"
                  ? "Thống kê sức chứa & đăng ký lớp"
                  : "Class enrollment vs capacity"}
              </h3>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E2E8F0"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#64748B" }}
                />
                <YAxis tick={{ fontSize: 12, fill: "#64748B" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                />
                <Bar
                  dataKey="enrolled"
                  name={language === "vi" ? "Đã đăng ký" : "Enrolled"}
                  fill="var(--brand-primary)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="capacity"
                  name={language === "vi" ? "Sức chứa tối đa" : "Capacity"}
                  fill="var(--brand-lime)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly Attendance Trend Chart (R2.1: only real data, no fake numbers) */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-700 shrink-0" />
              <h3
                className="text-sm font-bold text-slate-900 flex items-center gap-1.5 cursor-help"
                title={t("coachAttendanceFormulaTooltip")}
              >
                <span>
                  {language === "vi"
                    ? "Tỷ lệ điểm danh theo ngày có ca dạy (%)"
                    : "Attendance rate by teaching day (%)"}
                </span>
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              </h3>
            </div>
            {realAttendanceMetrics.overallRate !== null && (
              <span className="text-xs text-emerald-700 font-bold font-mono">
                TB: {realAttendanceMetrics.overallRate}%
              </span>
            )}
          </div>

          {realAttendanceMetrics.weeklyBars.length === 0 ? (
            <div className="h-56 w-full flex flex-col items-center justify-center bg-slate-50 border border-dashed border-slate-200 rounded-lg p-4 text-center">
              <p className="text-sm font-semibold text-slate-700">
                {t("coachInsufficientData")}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                {language === "vi"
                  ? "Biểu đồ sẽ hiển thị tỷ lệ chuyên cần thực tế sau khi có dữ liệu điểm danh các buổi học."
                  : "Chart will display actual attendance rates once session attendance is recorded."}
              </p>
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={realAttendanceMetrics.weeklyBars}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#E2E8F0"
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 12, fill: "#64748B" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12, fill: "#64748B" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="rate"
                    name={
                      language === "vi" ? "Tỷ lệ điểm danh (%)" : "Attendance %"
                    }
                    fill="var(--brand-teal)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Student Feedback & At-Risk Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-700" />
              <span>
                {language === "vi"
                  ? "Phản Hồi Học Viên Về Lớp Học"
                  : "Student Feedback"}
              </span>
            </h3>
            <span className="text-xs font-mono text-slate-500">
              {feedbackItems.length} đánh giá
            </span>
          </div>

          {feedbackItems.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">
              Chưa có đánh giá nào từ học viên.
            </p>
          ) : (
            <div className="space-y-2.5">
              {feedbackItems.slice(0, 4).map((fb, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      {fb.className || (fb.classId ? `Lớp #${fb.classId}` : "Lớp học")}
                    </span>
                    <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      HLV: {fb.coachRating || 5}/5 &bull; Lớp:{" "}
                      {fb.classRating || 5}/5
                    </span>
                  </div>
                  <p className="text-xs text-slate-700">
                    {fb.comment || "Học viên hài lòng với buổi tập."}
                  </p>
                  {fb.createdAt && (
                    <div className="text-[10px] text-slate-400 font-mono">
                      {String(fb.createdAt).slice(0, 16).replace("T", " ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>
                {language === "vi"
                  ? "Học Viên Cần Quan Tâm / Vắng Tập"
                  : "At-Risk Assigned Students"}
              </span>
            </h3>
            <span className="text-xs font-mono text-amber-800 font-bold">
              {atRiskMembers.length} học viên
            </span>
          </div>

          {atRiskMembers.length === 0 ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-900 font-medium">
              Tất cả học viên phụ trách đều duy trì lịch tập luyện đều đặn.
            </div>
          ) : (
            <div className="space-y-2">
              {atRiskMembers.map((rm) => (
                <div
                  key={rm.memberId}
                  className="p-3 bg-amber-50 border border-amber-200 rounded flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900">
                      {rm.memberName}
                    </div>
                    <div className="text-slate-600 font-mono">{rm.email}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold text-[10px] border border-amber-300">
                    Cần nhắc lịch tập
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Teaching Schedule */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-4 border-b border-slate-200 pb-2 whitespace-nowrap">
          {language === "vi" ? "Các Lớp Dạy Sắp Tới" : "Teaching Schedule"}
        </h3>
        <div className="space-y-3">
          {myClasses.map((cls) => {
            const clsSessions = sessionsByClassId[String(cls.id)] || []
            const activeSession =
              clsSessions.find((s) => !isSessionCancelled(s)) ||
              clsSessions[0] ||
              null
            const displayDate = activeSession?.sessionDate
              ? formatDate(activeSession.sessionDate, language)
              : formatDate(cls.date || cls.startDate, language)
            const displayTime = activeSession?.startTime
              ? `${String(activeSession.startTime).slice(0, 5)}${
                  activeSession.endTime
                    ? ` – ${String(activeSession.endTime).slice(0, 5)}`
                    : ""
                }`
              : cls.startTime || "Theo ca học"
            const displayRoom =
              activeSession?.roomName ||
              (language === "vi" ? cls.roomVi || cls.room : cls.room) ||
              "Sân tập trung tâm"

            return (
              <div
                key={cls.id}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {language === "vi" ? cls.nameVi || cls.name : cls.name}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="tabular-nums font-mono">
                      {displayDate} &bull; {displayTime}
                    </span>
                    <span>&bull; {displayRoom}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-slate-900 tabular-nums">
                    {cls.enrolledCount ?? 0}/{cls.capacity ?? 12}{" "}
                    {language === "vi" ? "Học viên" : "Students"}
                  </span>
                  <button
                    onClick={() => handleGoToAttendance(cls)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold shadow-xs cursor-pointer"
                  >
                    {t("attendance")}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
