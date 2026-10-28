import React, { useState, useEffect, useMemo } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { formatDate } from "../../locales/translations"
import { memberPortalApi } from "../../api/memberPortalApi"
import { memberApi } from "../../api/memberApi"
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

  useEffect(() => {
    if (!apiEnabled) return
    let active = true
    Promise.all([memberPortalApi.getCoachFeedback().catch(() => ({
        totalFeedback: 0,
        averageCoachRating: 0,
        feedback: [],
      })), memberApi.getCoachAtRiskMembers().catch(() => [])]).then(
      ([fbData, riskList]) => {
        if (!active) return
        if (fbData) setCoachFeedbackSummary(fbData)
        if (Array.isArray(riskList)) setAtRiskMembers(riskList)
      },
    )
    return () => {
      active = false
    }
  }, [apiEnabled])

  const myClasses = useMemo(() => {
    const matched = classes.filter(
      (c) =>
        String(c.coachId) === String(currentUser.id) ||
        String(c.coachName || "")
          .toLowerCase()
          .includes(String(currentUser.name || "").toLowerCase()) ||
        String(c.coachName || "").includes("Mai"),
    )
    return matched.length > 0 ? matched : classes
  }, [classes, currentUser.id, currentUser.name])

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

  const weeklyAttendanceData = [
    { day: language === "vi" ? "Thứ 2" : "Mon", rate: 92 },
    { day: language === "vi" ? "Thứ 3" : "Tue", rate: 96 },
    { day: language === "vi" ? "Thứ 4" : "Wed", rate: 88 },
    { day: language === "vi" ? "Thứ 5" : "Thu", rate: 95 },
    { day: language === "vi" ? "Thứ 6" : "Fri", rate: 100 },
    { day: language === "vi" ? "Thứ 7" : "Sat", rate: 98 },
    { day: language === "vi" ? "CN" : "Sun", rate: 90 },
  ]

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
            <span className="text-xs font-bold text-slate-500 uppercase">
              {language === "vi" ? "Lớp phụ trách" : "Assigned Classes"}
            </span>
            <Calendar className="w-4 h-4 text-slate-700" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums mt-2">
            {myClasses.length}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {language === "vi" ? "Học viên PT chính" : "PT Students"}
            </span>
            <Users className="w-4 h-4 text-slate-700" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tabular-nums mt-2">
            8
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {language === "vi" ? "Tỷ lệ điểm danh" : "Attendance Rate"}
            </span>
            <ClipboardCheck className="w-4 h-4 text-slate-700" />
          </div>
          <div className="text-2xl font-bold text-emerald-800 tabular-nums mt-2">
            96.8%
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">
              {language === "vi" ? "Đánh giá HLV" : "Coach Rating"}
            </span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-700 tabular-nums mt-2">
            {averageRating}{" "}
            <span className="text-xs font-normal text-slate-500">
              / 5.0 ({feedbackItems.length} đánh giá)
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
                  ? "Thống Kê Sức Chứa & Đăng Ký Lớp"
                  : "Class Enrollment vs Capacity"}
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              Tài khoản Coach
            </span>
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
                  tick={{ fontSize: 11, fill: "#64748B" }}
                />
                <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
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
                  fill="#2563EB"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="capacity"
                  name={language === "vi" ? "Sức chứa tối đa" : "Capacity"}
                  fill="#94A3B8"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly Attendance Trend Chart */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-700 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 whitespace-nowrap">
                {language === "vi"
                  ? "Thống Kê Tỷ Lệ Điểm Danh Trong Tuần (%)"
                  : "Weekly Attendance Rate (%)"}
              </h3>
            </div>
            <span className="text-[11px] text-emerald-700 font-bold font-mono">
              TB: 96.8%
            </span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyAttendanceData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E2E8F0"
                />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#64748B" }} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "#64748B" }}
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
                  fill="#059669"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
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
                      {fb.className || `Lớp #${fb.classId}`}
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
                  ? "Học Viên Cần Quan Tâm / Vắng Tập (At-Risk)"
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
          {myClasses.map((cls) => (
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
                    {formatDate(cls.date || cls.startDate, language)} &bull;{" "}
                    {cls.startTime || "07:00"} ({cls.durationMinutes || 90}m)
                  </span>
                  <span>
                    &bull;{" "}
                    {language === "vi" ? cls.roomVi || cls.room : cls.room}
                  </span>
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
          ))}
        </div>
      </div>
    </div>
  )
}
