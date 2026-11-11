import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Info,
  Search,
  Filter,
  RotateCcw,
  RefreshCw,
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import {
  getActiveHolidays,
  getClassCatalogSessions,
  getClassSessions,
  getMemberClasses,
  getSessionAbsenceNotices,
  requestAbsence,
} from "../../api/memberPortalApi"
import { getAuthoritativeProfileId } from "../../utils/memberSafetyHelpers"
import { getErrorMessage } from "../../api/apiErrors"
import {
  COURSE_TAB_HOLIDAY_LOOKAHEAD_DAYS,
  TIME_FORMATTER_HHMM,
  buildCourseScheduleModel,
  buildUpcomingHolidayGroups,
  getTodayIsoInVn,
  isActiveNormalEnrollment,
  toDateDdMm,
} from "../../utils/memberScheduleUtils"
import {
  MemberCourseCard,
  SessionAbsenceModal,
  SessionDetailDrawer,
} from "../schedule/MemberCourseScheduleComponents"
import { PageHeader } from "../ui/PageHeader"

export function MemberEnrollmentsView() {
  const navigate = useNavigate()
  const { currentUser, t, showToast, language } = useSCMS()
  const isVi = language === "vi"

  const tr = useCallback(
    (key, params = {}) => {
      let text = t(key)
      for (const [k, v] of Object.entries(params)) {
        text = text.replaceAll(`{${k}}`, String(v ?? ""))
      }
      return text
    },
    [t],
  )

  const resolvedId =
    getAuthoritativeProfileId(currentUser) ?? currentUser?.memberId
  const memberId = Number(resolvedId)
  const validMember = Number.isInteger(memberId) && memberId > 0

  const [rawEnrollments, setRawEnrollments] = useState([])
  const [allSessions, setAllSessions] = useState([])
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [showAllHolidays, setShowAllHolidays] = useState(false)
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Ngăn chi tiết buổi học & Báo vắng
  const [detailSession, setDetailSession] = useState(null)
  const [selectedSession, setSelectedSession] = useState(null)
  const [absenceReason, setAbsenceReason] = useState("")
  const [submittingAbsence, setSubmittingAbsence] = useState(false)
  const [absenceNotices, setAbsenceNotices] = useState([])
  const [loadingNotices, setLoadingNotices] = useState(false)

  const refresh = useCallback(async () => {
    if (!validMember) {
      setRawEnrollments([])
      setAllSessions([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError("")
    try {
      const [enrollments, sessions, activeHolidays] = await Promise.all([
        getMemberClasses(memberId),
        getClassSessions().catch(() => []),
        getActiveHolidays().catch(() => []),
      ])
      const baseSessions = Array.isArray(sessions) ? sessions : []
      const enrollmentRows = Array.isArray(enrollments) ? enrollments : []
      const missingClassIds = Array.from(
        new Set(
          enrollmentRows
            .map((row) => row?.classId ?? row?.sportsClassId)
            .filter(
              (cid) =>
                cid != null &&
                !baseSessions.some((s) => String(s?.classId) === String(cid)),
            ),
        ),
      )
      let mergedSessions = baseSessions
      if (missingClassIds.length > 0) {
        const extraLists = await Promise.all(
          missingClassIds.map((cid) =>
            getClassCatalogSessions(cid).catch(() => []),
          ),
        )
        mergedSessions = [
          ...baseSessions,
          ...extraLists.flatMap((list, idx) =>
            (Array.isArray(list) ? list : []).map((s) => ({
              ...s,
              classId: s?.classId ?? missingClassIds[idx],
            })),
          ),
        ]
      }
      setAllSessions(mergedSessions)
      setRawEnrollments(enrollmentRows)
      setHolidays(Array.isArray(activeHolidays) ? activeHolidays : [])
      setLastUpdatedAt(new Date())
    } catch (err) {
      // Giữ nguyên dữ liệu cũ đang hiển thị nếu có khi xảy ra lỗi
      setError(getErrorMessage(err, t("enrollmentsErrorLoad")))
    } finally {
      setLoading(false)
    }
  }, [memberId, validMember, t])

  useEffect(() => {
    refresh()
  }, [refresh])

  const nowMs = Date.now()
  const todayIso = getTodayIsoInVn(nowMs)

  const holidayDateSet = useMemo(() => {
    const set = new Set()
    for (const h of holidays) {
      if (h && h.active !== false && h.holidayDate) {
        set.add(String(h.holidayDate).slice(0, 10))
      }
    }
    return set
  }, [holidays])

  const upcomingHolidayGroups = useMemo(
    () =>
      buildUpcomingHolidayGroups(
        holidays,
        todayIso,
        t("scheduleHolidayDefaultName"),
      ),
    [holidays, todayIso, t],
  )

  const activeCourses = useMemo(() => {
    return rawEnrollments
      .filter((row) => isActiveNormalEnrollment(row))
      .map((row) =>
        buildCourseScheduleModel(row, allSessions, holidayDateSet, nowMs, t),
      )
  }, [rawEnrollments, allSessions, holidayDateSet, nowMs, t])

  const courseCounts = useMemo(() => ({
    all: activeCourses.length,
    in_progress: activeCourses.filter((course) => course.lifecycleStatus === "in_progress").length,
    not_started: activeCourses.filter((course) => course.lifecycleStatus === "not_started").length,
    completed: activeCourses.filter((course) => course.lifecycleStatus === "completed").length,
  }), [activeCourses])

  const filteredCourses = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
    return activeCourses.filter((course) => {
      const matchesStatus = statusFilter === "all" || course.lifecycleStatus === statusFilter
      const searchableText = [course.className, course.subjectName, course.primaryCoach]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
      return matchesStatus && (!normalizedQuery || searchableText.includes(normalizedQuery))
    })
  }, [activeCourses, searchQuery, statusFilter])

  const progressSummary = useMemo(() => {
    const completed = activeCourses.reduce((sum, course) => sum + (Number(course.completedCount) || 0), 0)
    const required = activeCourses.reduce((sum, course) => sum + (Number(course.requiredSessions) || 0), 0)
    const nextSessions = activeCourses.map((course) => course.nextValidSession).filter(Boolean)
      .sort((a, b) => (a.startMs ?? Number.MAX_SAFE_INTEGER) - (b.startMs ?? Number.MAX_SAFE_INTEGER))
    return { completed, required, nextSession: nextSessions[0] || null }
  }, [activeCourses])

  const holidayWithinLookahead = useMemo(
    () =>
      upcomingHolidayGroups.find(
        (g) =>
          g.daysUntilStart >= 0 &&
          g.daysUntilStart <= COURSE_TAB_HOLIDAY_LOOKAHEAD_DAYS,
      ) || null,
    [upcomingHolidayGroups],
  )

  const conflictingHolidayDatesDdMm = useMemo(() => {
    const dates = []
    for (const course of activeCourses) {
      for (const s of course.validSessions) {
        if (
          s.hasHolidayConflict &&
          s.displayStatus !== "completed" &&
          s.sessionDate >= todayIso
        ) {
          const ddMm = toDateDdMm(s.sessionDate)
          if (ddMm && !dates.includes(ddMm)) {
            dates.push(ddMm)
          }
        }
      }
    }
    return dates
  }, [activeCourses, todayIso])

  const handleOpenAbsenceModal = async (session) => {
    setDetailSession(null)
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
      showToast(t("scheduleAbsenceReasonRequired"), "error")
      return
    }
    setSubmittingAbsence(true)
    try {
      await requestAbsence(selectedSession.id, absenceReason.trim())
      showToast(t("scheduleAbsenceSubmitSuccess"), "success")
      const notices = await getSessionAbsenceNotices(selectedSession.id).catch(
        () => [],
      )
      setAbsenceNotices(Array.isArray(notices) ? notices : [])
      setAbsenceReason("")
    } catch (err) {
      showToast(
        getErrorMessage(err, t("scheduleAbsenceSubmitError")),
        "error",
      )
    } finally {
      setSubmittingAbsence(false)
    }
  }

  const handleViewAllSessions = (course) => {
    if (course?.classId != null) {
      navigate(
        `/member/schedule?tab=sessions&classId=${encodeURIComponent(course.classId)}`,
      )
    } else {
      navigate("/member/schedule?tab=sessions")
    }
  }

  const renderHolidayBanner = () => {
    const hasConflict = conflictingHolidayDatesDdMm.length > 0
    if (!holidayWithinLookahead && !hasConflict) return null
    const targetGroup = holidayWithinLookahead || upcomingHolidayGroups[0]

    return (
      <section
        aria-label={t("scheduleHolidayTitle")}
        className={`rounded-xl border px-4 py-3 text-xs space-y-2.5 ${
          hasConflict
            ? "border-amber-200 bg-amber-50/80 text-slate-800"
            : "border-slate-200 bg-slate-50/80 text-slate-700"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {hasConflict ? (
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            ) : (
              <CalendarDays className="h-4 w-4 text-slate-500 shrink-0" />
            )}

            {targetGroup && (
              <span>
                <strong className="font-semibold text-slate-900">
                  {t("scheduleHolidayUpcomingLabel")}
                </strong>{" "}
                <span>
                  {targetGroup.baseName} · {targetGroup.dateLabel}
                </span>
              </span>
            )}

            {hasConflict && (
              <span className="font-semibold text-amber-900">
                {targetGroup ? "· " : ""}
                {tr("scheduleHolidayConflictWarning", {
                  date: conflictingHolidayDatesDdMm.join(", "),
                })}
              </span>
            )}
          </div>

          <button
            type="button"
            aria-expanded={showAllHolidays}
            onClick={() => setShowAllHolidays((prev) => !prev)}
            className="font-semibold text-slate-700 underline hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded cursor-pointer shrink-0"
          >
            {showAllHolidays
              ? t("scheduleHolidayCollapse")
              : t("scheduleHolidayShowAll")}
          </button>
        </div>

        {showAllHolidays && upcomingHolidayGroups.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {upcomingHolidayGroups.map((group) => (
              <span
                key={group.id}
                className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200"
              >
                {group.baseName} · {group.dateLabel}
              </span>
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <main className="w-full space-y-6 px-4 py-5 sm:px-6 lg:px-8">
      {/* Header */}
      <PageHeader
        title={t("enrollmentsPageTitle")}
        description={t("enrollmentsPageSubtitle")}
        actions={
          <div className="flex flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              aria-label={t("enrollmentsBtnRefresh")}
              title={t("enrollmentsBtnRefresh")}
              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 p-2 text-slate-700 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            {lastUpdatedAt && (
              <span className="text-xs text-slate-500">
                {tr("scheduleUpdatedAt", {
                  time: TIME_FORMATTER_HHMM.format(lastUpdatedAt),
                })}
              </span>
            )}
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label={t("enrollmentsPageTitle")}>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center gap-3"><span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><BookOpen size={20} /></span><div className="min-w-0"><p className="text-sm font-semibold text-slate-600">{isVi ? "Khóa học đã đăng ký" : "Enrolled courses"}</p><p className="mt-0.5 text-2xl font-extrabold tabular-nums text-slate-950">{courseCounts.all}<span className="ml-1.5 text-sm font-semibold text-slate-500">{isVi ? "khóa học" : "courses"}</span></p></div></div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center gap-3"><span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Activity size={20} /></span><div className="min-w-0"><p className="text-sm font-semibold text-slate-600">{isVi ? "Đang học & Sắp khai giảng" : "In progress & Upcoming"}</p><p className="mt-0.5 text-2xl font-extrabold tabular-nums text-slate-950">{courseCounts.in_progress + courseCounts.not_started}<span className="ml-1.5 text-sm font-semibold text-slate-500">{isVi ? "khóa học" : "courses"}</span></p></div></div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-center gap-3"><span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700"><CheckCircle2 size={20} /></span><div className="min-w-0"><p className="text-sm font-semibold text-slate-600">{isVi ? "Tiến độ buổi học" : "Session progress"}</p><p className="mt-0.5 text-2xl font-extrabold tabular-nums text-slate-950">{progressSummary.completed}<span className="text-base font-bold text-slate-500"> / {progressSummary.required} {isVi ? "buổi" : "sessions"}</span></p><p className="mt-1 truncate text-xs text-slate-500">{progressSummary.nextSession ? <><Clock3 className="mr-1 inline h-3.5 w-3.5" />{isVi ? "Buổi tiếp theo" : "Next session"}: {toDateDdMm(progressSummary.nextSession.sessionDate)} · {progressSummary.nextSession.startTime}</> : (isVi ? "Chưa có buổi học sắp tới" : "No upcoming session")}</p></div></div>
        </article>
      </section>

      {renderHolidayBanner()}

      {!validMember && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {t("scheduleUnlinkedAccount")}
        </div>
      )}

      {/* Lỗi có nút Thử lại và không xóa dữ liệu cũ */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-status-error flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="min-h-[36px] rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-800 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
          >
            {t("scheduleBtnRetry")}
          </button>
        </div>
      )}

      {/* Nội dung danh sách khóa học */}
      {loading && activeCourses.length === 0 ? (
        <div
          aria-busy="true"
          className="grid grid-cols-1 gap-5 lg:grid-cols-2"
        >
          {[1, 2].map((item) => (
            <div
              key={item}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 animate-pulse"
            >
              <div className="flex justify-between">
                <div className="h-4 w-24 rounded bg-slate-200" />
                <div className="h-6 w-24 rounded-full bg-slate-200" />
              </div>
              <div className="h-6 w-3/4 rounded bg-slate-200" />
              <div className="space-y-2">
                <div className="h-4 w-1/2 rounded bg-slate-100" />
                <div className="h-4 w-2/3 rounded bg-slate-100" />
                <div className="h-4 w-1/2 rounded bg-slate-100" />
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-200" />
              <div className="h-16 w-full rounded-lg bg-slate-100" />
              <div className="space-y-2">
                <div className="h-10 w-full rounded-lg bg-slate-100" />
                <div className="h-10 w-full rounded-lg bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : activeCourses.length > 0 ? (
        <>
        <section className="space-y-4" aria-label={t("enrollmentsPageTitle")}>
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block min-w-0 sm:w-60">
              <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select aria-label={t("scheduleDrawerStatus")} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 pl-8 pr-7 text-xs font-semibold text-slate-700 hover:bg-white focus:border-blue-500 focus:outline-none">
                {[["all", isVi ? "Tất cả" : "All"], ["in_progress", t("scheduleCourseInProgress")], ["not_started", t("scheduleCourseNotStarted")], ["completed", t("scheduleCourseCompleted")]].map(([value, label]) => <option key={value} value={value}>{label} ({courseCounts[value]})</option>)}
              </select>
            </label>
            <label className="relative block w-full sm:flex-1 sm:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={isVi ? "Tìm tên lớp, môn học, HLV..." : "Search class, sport, coach..."} className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none transition hover:bg-white focus:border-blue-500" /></label>
            {(statusFilter !== "all" || searchQuery.trim()) && <button type="button" onClick={() => { setStatusFilter("all"); setSearchQuery("") }} className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900"><RotateCcw className="h-3.5 w-3.5" />{isVi ? "Xóa lọc" : "Clear"}</button>}
          </div>
          {filteredCourses.length > 0 ? <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {filteredCourses.map((course, index) => (
            <MemberCourseCard
              key={course.id || `${course.classId}-${index}`}
              course={course}
              compactLayout
              todayIso={todayIso}
              onSelectSession={setDetailSession}
              onViewAllSessions={handleViewAllSessions}
              t={t}
              tr={tr}
            />
          ))}
          </div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-600">{isVi ? "Không có khóa học khớp với bộ lọc hoặc từ khóa." : "No courses match these filters or search terms."}</div>}
        </section>
        <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3.5 text-sm leading-6 text-blue-950"><Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" /><p>{isVi ? "Khóa học Normal gồm 12 buổi theo lịch cố định và không áp dụng hủy ngang. Nếu cần hỗ trợ kiểm tra thông tin lớp học, vui lòng liên hệ quầy Lễ tân." : "Normal courses include 12 sessions on a fixed schedule and cannot be cancelled partway through. Contact Reception if you need help checking your class information."}</p></div>
        </>
      ) : (
        /* Trạng thái rỗng: "Bạn chưa đăng ký khóa học nào." kèm nút "Đăng ký khóa học" dẫn tới trang Đăng ký khóa học */
        validMember &&
        !error && (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center space-y-3">
            <CalendarDays className="mx-auto h-9 w-9 text-slate-400" />
            <p className="text-sm font-bold text-slate-800">
              {t("enrollmentsEmptyTitle")}
            </p>
            <div>
              <Link
                to="/member/catalog"
                className="min-h-[40px] inline-flex items-center justify-center rounded-lg bg-brand-primary hover:bg-brand-primary-hover px-4 py-2 text-xs font-bold text-white shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                {t("enrollmentsBtnRegisterCourse")}
              </Link>
            </div>
          </section>
        )
      )}

      {activeCourses.length === 0 && !loading && <div className="flex items-start gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3.5 text-sm leading-6 text-blue-950"><Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" /><p>{isVi ? "Khóa học Normal gồm 12 buổi theo lịch cố định và không áp dụng hủy ngang. Nếu cần hỗ trợ kiểm tra thông tin lớp học, vui lòng liên hệ quầy Lễ tân." : "Normal courses include 12 sessions on a fixed schedule and cannot be cancelled partway through. Contact Reception if you need help checking your class information."}</p></div>}

      <SessionDetailDrawer
        detailSession={detailSession}
        onClose={() => setDetailSession(null)}
        onOpenAbsenceModal={handleOpenAbsenceModal}
        t={t}
        tr={tr}
      />

      <SessionAbsenceModal
        selectedSession={selectedSession}
        onClose={() => setSelectedSession(null)}
        absenceReason={absenceReason}
        onChangeAbsenceReason={setAbsenceReason}
        onSubmitAbsence={handleSubmitAbsence}
        submittingAbsence={submittingAbsence}
        absenceNotices={absenceNotices}
        loadingNotices={loadingNotices}
        t={t}
        tr={tr}
      />
    </main>
  )
}
