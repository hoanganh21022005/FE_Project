import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  CalendarDays,
  Clock3,
  RefreshCw,
  UserRound,
  MapPin,
  QrCode,
  MessageSquareHeart,
  FileWarning,
  History,
  X,
  CheckCircle2,
  AlertCircle,
  Dumbbell,
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import {
  getMemberClasses,
  getClassSessions,
  requestAbsence,
  getSessionAbsenceNotices,
  cancelPrivateSession,
} from "../../api/memberPortalApi"
import { getAuthoritativeProfileId } from "../../utils/memberSafetyHelpers"
import { getErrorMessage } from "../../api/apiErrors"
import { MemberFeedbackView } from "./MemberFeedbackView"

const toDate = (value) => {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
}

const toDateTime = (value) => {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const formatLocalTime = (timeVal) => {
  if (!timeVal) return "—"
  if (typeof timeVal === "string") return timeVal.slice(0, 5)
  if (typeof timeVal === "object" && timeVal.hour !== undefined) {
    return `${String(timeVal.hour).padStart(2, "0")}:${String(timeVal.minute || 0).padStart(2, "0")}`
  }
  return String(timeVal)
}

const getEnrollmentSessions = (enrollment, allSessions = []) => {
  const inline =
    enrollment.sessions ||
    enrollment.classSessions ||
    enrollment.scheduledSessions
  if (Array.isArray(inline) && inline.length > 0) return inline
  if (!enrollment.classId || !Array.isArray(allSessions)) return []
  return allSessions.filter(
    (s) =>
      String(s.classId) === String(enrollment.classId) && s.isPrivate !== true,
  )
}

const isLegacyStrengthClass = (enrollment) =>
  String(enrollment.className || "")
    .trim()
    .toLocaleLowerCase("vi") === "gym suc manh"

export function MemberScheduleView() {
  const navigate = useNavigate()
  const { currentUser, language, showToast } = useSCMS()
  const isVi = language === "vi"

  const resolvedId =
    getAuthoritativeProfileId(currentUser) ?? currentUser?.memberId
  const memberId = Number(resolvedId)
  const validMember = Number.isInteger(memberId) && memberId > 0

  const [activeTab, setActiveTab] = useState("courses") // 'courses' | 'sessions' | 'private'
  const [rows, setRows] = useState([])
  const [allSessions, setAllSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Absence Request & Notices Modal State
  const [selectedSession, setSelectedSession] = useState(null)
  const [absenceReason, setAbsenceReason] = useState("")
  const [submittingAbsence, setSubmittingAbsence] = useState(false)
  const [absenceNotices, setAbsenceNotices] = useState([])
  const [loadingNotices, setLoadingNotices] = useState(false)
  const [cancellingSessionId, setCancellingSessionId] = useState(null)

  const refresh = useCallback(async () => {
    if (!validMember) {
      setRows([])
      setAllSessions([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError("")
    try {
      const [enrollments, sessions] = await Promise.all([
        getMemberClasses(memberId),
        getClassSessions().catch(() => []),
      ])
      const sessionList = Array.isArray(sessions) ? sessions : []
      setAllSessions(sessionList)
      setRows(
        (Array.isArray(enrollments) ? enrollments : []).map((enrollment) => ({
          ...enrollment,
          sessions: getEnrollmentSessions(enrollment, sessionList),
        })),
      )
    } catch (err) {
      setRows([])
      setError(getErrorMessage(err, "Không thể tải lịch học."))
    } finally {
      setLoading(false)
    }
  }, [memberId, validMember])

  useEffect(() => {
    refresh()
  }, [refresh])

  const activeRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          !["cancelled", "canceled", "dropped", "rejected"].includes(
            String(row.status || "").toLowerCase(),
          ) && !isLegacyStrengthClass(row),
      ),
    [rows],
  )

  // Flatten all class sessions for enrolled classes
  const enrolledClassSessions = useMemo(() => {
    const list = []
    activeRows.forEach((row) => {
      ;(row.sessions || []).forEach((s) => {
        list.push({
          ...s,
          className: s.className || row.className || `Lớp #${row.classId}`,
          subjectName: s.subjectName || row.subjectName || "VIBE SPORT",
          coachName: s.coachName || row.coachName,
        })
      })
    })
    return list.sort((a, b) =>
      String(a.sessionDate || "").localeCompare(String(b.sessionDate || "")),
    )
  }, [activeRows])

  // Private PT sessions booked by this member
  const privateSessions = useMemo(() => {
    return allSessions
      .filter(
        (s) =>
          s.isPrivate === true && String(s.bookedMemberId) === String(memberId),
      )
      .sort((a, b) =>
        String(a.sessionDate || "").localeCompare(String(b.sessionDate || "")),
      )
  }, [allSessions, memberId])

  const handleOpenAbsenceModal = async (session) => {
    setSelectedSession(session)
    setAbsenceReason("")
    setAbsenceNotices([])
    if (!session?.id) return
    setLoadingNotices(true)
    try {
      const notices = await getSessionAbsenceNotices(session.id)
      setAbsenceNotices(Array.isArray(notices) ? notices : [])
    } catch {
      setAbsenceNotices([])
    } finally {
      setLoadingNotices(false)
    }
  }

  const handleSubmitAbsence = async (e) => {
    e.preventDefault()
    if (!selectedSession?.id) return
    if (!absenceReason.trim()) {
      showToast(
        isVi
          ? "Vui lòng nhập lý do báo vắng."
          : "Please enter an absence reason.",
        "error",
      )
      return
    }
    setSubmittingAbsence(true)
    try {
      await requestAbsence(selectedSession.id, absenceReason.trim())
      showToast(
        isVi
          ? "Đã gửi thông báo xin nghỉ buổi học thành công!"
          : "Absence notice submitted successfully!",
        "success",
      )
      const notices = await getSessionAbsenceNotices(selectedSession.id).catch(
        () => [],
      )
      setAbsenceNotices(Array.isArray(notices) ? notices : [])
      setAbsenceReason("")
    } catch (err) {
      showToast(
        getErrorMessage(
          err,
          isVi
            ? "Không thể gửi yêu cầu báo vắng."
            : "Could not submit absence request.",
        ),
        "error",
      )
    } finally {
      setSubmittingAbsence(false)
    }
  }

  const handleCancelPrivate = async (session) => {
    if (!session?.id) return
    setCancellingSessionId(session.id)
    try {
      await cancelPrivateSession(session.id)
      showToast(
        isVi
          ? "Đã hủy lịch tập PT 1-kèm-1 thành công."
          : "Cancelled private PT session.",
        "success",
      )
      await refresh()
    } catch (err) {
      showToast(
        getErrorMessage(
          err,
          isVi
            ? "Không thể hủy buổi tập PT này."
            : "Could not cancel private session.",
        ),
        "error",
      )
    } finally {
      setCancellingSessionId(null)
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-7 sm:py-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-red-700">
            VIBE SPORT · MEMBER
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">
            {isVi ? "Lịch học của tôi" : "My Schedule"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {isVi
              ? "Quản lý trọn vẹn khóa học đã đăng ký, lịch từng buổi, lịch PT 1-kèm-1, báo vắng và đánh giá buổi tập ngay tại một nơi."
              : "Manage enrolled courses, session schedules, private PT sessions, absence notices, and session feedback all in one place."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/member/attendance")}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 px-3.5 py-2 text-xs font-bold text-white shadow-2xs cursor-pointer"
          >
            <QrCode className="h-4 w-4" />
            <span>{isVi ? "Mở Điểm danh" : "Check-in"}</span>
          </button>

          <button
            type="button"
            onClick={() => navigate("/member/catalog")}
            className="inline-flex items-center gap-2 rounded-lg bg-red-700 hover:bg-red-800 px-3.5 py-2 text-xs font-bold text-white shadow-2xs cursor-pointer"
          >
            <Dumbbell className="h-4 w-4" />
            <span>{isVi ? "Đăng ký lớp mới" : "Find classes"}</span>
          </button>

          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {isVi ? "Tải lại" : "Refresh"}
          </button>
        </div>
      </header>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("courses")}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "courses"
              ? "bg-slate-900 text-white shadow-2xs"
              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          }`}
        >
          {isVi
            ? `Khóa học đã đăng ký (${activeRows.length})`
            : `Enrolled Courses (${activeRows.length})`}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sessions")}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "sessions"
              ? "bg-slate-900 text-white shadow-2xs"
              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          }`}
        >
          {isVi
            ? `Lịch buổi học & Báo vắng (${enrolledClassSessions.length})`
            : `Class Sessions & Absence (${enrolledClassSessions.length})`}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("private")}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "private"
              ? "bg-slate-900 text-white shadow-2xs"
              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          }`}
        >
          {isVi
            ? `Lịch tập PT 1-kèm-1 (${privateSessions.length})`
            : `Private PT Sessions (${privateSessions.length})`}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("feedback")}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === "feedback"
              ? "bg-red-700 text-white shadow-2xs"
              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
          }`}
        >
          <MessageSquareHeart className="h-3.5 w-3.5" />
          <span>{isVi ? "Đánh giá chất lượng" : "Class Feedback"}</span>
        </button>
      </div>

      {!validMember && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {isVi
            ? "Tài khoản chưa được liên kết với hồ sơ hội viên. Vui lòng liên hệ lễ tân để cập nhật hồ sơ."
            : "This account is not linked to a member profile. Please contact reception."}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {activeTab === "feedback" ? (
        <MemberFeedbackView embedded />
      ) : loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          {isVi ? "Đang tải lịch học…" : "Loading schedule…"}
        </div>
      ) : activeTab === "courses" ? (
        activeRows.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {activeRows.map((row, index) => {
              const sessions = row.sessions || []
              const firstSession = sessions.find((s) => s.sessionDate)
              const firstClassDate = toDate(row.startDate)
              return (
                <article
                  key={row.id || `${row.classId}-${index}`}
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wide text-red-700">
                          {row.subjectName || "VIBE SPORT"}
                        </span>
                        <h2 className="mt-1 text-lg font-extrabold text-slate-900">
                          {row.className ||
                            (isVi
                              ? `Lớp #${row.classId}`
                              : `Class #${row.classId}`)}
                        </h2>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                        {row.status || (isVi ? "Đã đăng ký" : "Enrolled")}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 text-sm text-slate-600">
                      <p className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-slate-400" />
                        {firstSession
                          ? toDate(firstSession.sessionDate)
                          : firstClassDate ||
                            (isVi
                              ? "Lịch học chưa được xếp"
                              : "Schedule not set")}
                      </p>
                      <p className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-slate-400" />
                        {sessions.length
                          ? `${sessions.length} ${
                              isVi ? "buổi đã lên lịch" : "scheduled sessions"
                            }`
                          : isVi
                            ? "Chưa có thông tin buổi học"
                            : "Session details unavailable"}
                      </p>
                      <p className="flex items-center gap-2">
                        <UserRound className="h-4 w-4 text-slate-400" />
                        {row.coachName ||
                          firstSession?.coachName ||
                          (isVi
                            ? "Chưa phân công huấn luyện viên"
                            : "Coach not assigned")}
                      </p>
                    </div>

                    {sessions.length > 0 && (
                      <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                        <div className="text-[11px] font-bold uppercase text-slate-400">
                          {isVi
                            ? "Các buổi học gần nhất:"
                            : "Upcoming sessions:"}
                        </div>
                        {sessions.slice(0, 4).map((session) => (
                          <div
                            key={session.id}
                            className="flex items-center justify-between gap-2 rounded bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 border border-slate-200/70"
                          >
                            <span>
                              {toDate(session.sessionDate) || "—"} ·{" "}
                              {formatLocalTime(session.startTime)}–
                              {formatLocalTime(session.endTime)} ·{" "}
                              {session.roomName ||
                                (isVi ? "Chưa có sân" : "Room pending")}
                            </span>
                            {session.id && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleOpenAbsenceModal({
                                    ...session,
                                    className:
                                      row.className || `Lớp #${row.classId}`,
                                  })
                                }
                                className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer shrink-0"
                              >
                                {isVi ? "Báo vắng" : "Absence"}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {row.paymentStatus && (
                      <p className="mt-3 text-xs text-slate-500">
                        {isVi ? "Thanh toán:" : "Payment:"} {row.paymentStatus}
                      </p>
                    )}

                    <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {isVi
                        ? "Khóa Normal gồm 12 buổi cố định và không thể hủy đăng ký. Nếu thông tin lớp hoặc môn học không đúng, vui lòng liên hệ lễ tân để kiểm tra dữ liệu."
                        : "Normal courses contain 12 fixed sessions and cannot be cancelled. Contact reception if the class or subject details look incorrect."}
                    </p>
                  </div>

                  {/* Smart Quick Actions Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("feedback")}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 cursor-pointer"
                    >
                      <MessageSquareHeart className="h-3.5 w-3.5 text-red-700" />
                      <span>{isVi ? "Đánh giá lớp & HLV" : "Feedback"}</span>
                    </button>

                    {sessions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab("sessions")}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-800 cursor-pointer"
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>
                          {isVi
                            ? `Xem đủ ${sessions.length} buổi`
                            : `All ${sessions.length} sessions`}
                        </span>
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          validMember &&
          !error && (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <CalendarDays className="mx-auto h-9 w-9 text-slate-400" />
              <h2 className="mt-3 text-lg font-bold text-slate-900">
                {isVi ? "Bạn chưa đăng ký lớp học" : "No classes enrolled"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isVi
                  ? "Chọn Đăng ký khóa học để tìm lớp phù hợp."
                  : "Visit Course Registration to find a class."}
              </p>
            </section>
          )
        )
      ) : activeTab === "sessions" ? (
        enrolledClassSessions.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <Clock3 className="mx-auto h-9 w-9 text-slate-400" />
            <h2 className="mt-3 text-lg font-bold text-slate-900">
              {isVi
                ? "Chưa có buổi học nào được lên lịch"
                : "No scheduled sessions"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {isVi
                ? "Các buổi học của lớp bạn đã ghi danh sẽ xuất hiện tại đây khi trung tâm xếp lịch."
                : "Your class sessions will appear here once scheduled."}
            </p>
          </section>
        ) : (
          <div className="space-y-3">
            {enrolledClassSessions.map((session) => (
              <div
                key={session.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 border border-red-200">
                      {session.subjectName}
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {session.className}
                    </h3>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                      {session.status || "Scheduled"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-800">
                      <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                      {toDate(session.sessionDate) || "—"} ·{" "}
                      {formatLocalTime(session.startTime)}–
                      {formatLocalTime(session.endTime)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      {session.roomName || (isVi ? "Chưa xếp sân" : "TBD")}
                    </span>
                    {session.coachName && (
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="h-3.5 w-3.5 text-slate-400" />
                        {session.coachName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenAbsenceModal(session)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900 cursor-pointer"
                  >
                    <FileWarning className="h-3.5 w-3.5" />
                    <span>
                      {isVi ? "Xin nghỉ / Báo vắng" : "Report Absence"}
                    </span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Private PT Sessions Tab */
        <div className="space-y-3">
          {privateSessions.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <UserRound className="mx-auto h-9 w-9 text-slate-400" />
              <h2 className="mt-3 text-lg font-bold text-slate-900">
                {isVi
                  ? "Chưa có lịch tập PT 1-kèm-1"
                  : "No private PT sessions booked"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {isVi
                  ? "Bạn có thể đặt lịch tập riêng với Huấn luyện viên tại mục Huấn luyện viên của tôi."
                  : "Book 1-on-1 sessions with your coach in the My Coach page."}
              </p>
              <button
                type="button"
                onClick={() => navigate("/member/my-coach")}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 px-4 py-2 text-xs font-bold text-white cursor-pointer"
              >
                {isVi ? "Đặt lịch với HLV ngay" : "Book with Coach"}
              </button>
            </section>
          ) : (
            privateSessions.map((session) => {
              const isCancelled = String(session.status || "")
                .toLowerCase()
                .includes("cancel")
              return (
                <div
                  key={session.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-800 border border-blue-200">
                        PT 1-on-1
                      </span>
                      <h3 className="text-sm font-extrabold text-slate-900">
                        {session.subjectName ||
                          session.className ||
                          "Buổi tập Huấn luyện viên cá nhân"}
                      </h3>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                        {session.status || "Scheduled"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                      <span className="inline-flex items-center gap-1 font-mono font-semibold text-slate-800">
                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                        {toDate(session.sessionDate) || "—"} ·{" "}
                        {formatLocalTime(session.startTime)}–
                        {formatLocalTime(session.endTime)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="h-3.5 w-3.5 text-slate-400" />
                        HLV: <strong>{session.coachName || "—"}</strong>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        {session.roomName || "—"}
                      </span>
                    </div>
                  </div>

                  {!isCancelled && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenAbsenceModal(session)}
                        className="rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900 cursor-pointer"
                      >
                        {isVi ? "Báo vắng" : "Absence"}
                      </button>
                      <button
                        type="button"
                        disabled={cancellingSessionId === session.id}
                        onClick={() => handleCancelPrivate(session)}
                        className="rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-800 cursor-pointer"
                      >
                        {cancellingSessionId === session.id
                          ? "Đang hủy…"
                          : isVi
                            ? "Hủy lịch PT"
                            : "Cancel PT"}
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Absence Request & History Modal (/api/sessions/{sessionId}/absence & /absence-notices) */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {isVi
                    ? "Báo vắng / Xin nghỉ buổi học"
                    : "Session Absence Notice"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedSession.className || selectedSession.subjectName} ·{" "}
                  {toDate(selectedSession.sessionDate)} (
                  {formatLocalTime(selectedSession.startTime)}–
                  {formatLocalTime(selectedSession.endTime)})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAbsence} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isVi ? "Lý do báo vắng *" : "Reason for absence *"}
                </label>
                <textarea
                  rows={3}
                  value={absenceReason}
                  onChange={(e) => setAbsenceReason(e.target.value)}
                  placeholder={
                    isVi
                      ? "Nhập lý do xin nghỉ (VD: Bận công tác đột xuất, vấn đề sức khỏe...)"
                      : "Enter your reason for absence..."
                  }
                  className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-xs text-slate-900 focus:border-red-700 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSession(null)}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {isVi ? "Đóng" : "Close"}
                </button>
                <button
                  type="submit"
                  disabled={submittingAbsence}
                  className="rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 px-4 py-1.5 text-xs font-bold text-white cursor-pointer"
                >
                  {submittingAbsence
                    ? isVi
                      ? "Đang gửi…"
                      : "Submitting…"
                    : isVi
                      ? "Gửi báo vắng"
                      : "Submit notice"}
                </button>
              </div>
            </form>

            {/* Absence Notice History from GET /api/sessions/{sessionId}/absence-notices */}
            <div className="border-t border-slate-200 pt-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <History className="h-3.5 w-3.5 text-slate-500" />
                <span>
                  {isVi
                    ? `Lịch sử báo vắng buổi này (${absenceNotices.length})`
                    : `Absence notices for this session (${absenceNotices.length})`}
                </span>
              </div>

              {loadingNotices ? (
                <p className="text-xs text-slate-500">
                  {isVi ? "Đang tải lịch sử…" : "Loading history…"}
                </p>
              ) : absenceNotices.length === 0 ? (
                <p className="text-xs text-slate-500">
                  {isVi
                    ? "Chưa có lượt báo vắng nào được ghi nhận cho buổi học này."
                    : "No absence notices recorded for this session."}
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {absenceNotices.map((notice) => (
                    <div
                      key={notice.id || notice.reportedAt}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs flex items-start justify-between gap-2"
                    >
                      <div>
                        <p className="font-bold text-slate-900">
                          {notice.reason || "Đã báo vắng"}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {toDateTime(notice.reportedAt)}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          notice.active !== false
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {notice.active !== false
                          ? isVi
                            ? "Hiệu lực"
                            : "Active"
                          : isVi
                            ? "Đã thay thế"
                            : "Superseded"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
