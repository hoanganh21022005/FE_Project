import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  RefreshCw,
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import {
  getActiveHolidays,
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

export function MemberEnrollmentsView() {
  const navigate = useNavigate()
  const { currentUser, t, showToast } = useSCMS()

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
      setAllSessions(Array.isArray(sessions) ? sessions : [])
      setRawEnrollments(Array.isArray(enrollments) ? enrollments : [])
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
    <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-6 sm:px-7 sm:py-8">
      {/* Header: nhãn VIBE SPORT · MEMBER, tiêu đề Khóa học đã đăng ký, mô tả, nút Tải lại icon + Cập nhật lúc HH:mm */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-accent-dark">
            {t("scheduleBrand")}
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">
            {t("enrollmentsPageTitle")}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {t("enrollmentsPageSubtitle")}
          </p>
        </div>

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
      </header>

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
          className="grid gap-4 grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(340px,1fr))]"
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
        <div
          className={
            activeCourses.length === 1
              ? "grid gap-4 grid-cols-1"
              : "grid gap-4 grid-cols-1 md:grid-cols-[repeat(auto-fill,minmax(340px,1fr))]"
          }
        >
          {activeCourses.map((course, index) => (
            <MemberCourseCard
              key={course.id || `${course.classId}-${index}`}
              course={course}
              isSingleCourseLayout={activeCourses.length === 1}
              todayIso={todayIso}
              onSelectSession={setDetailSession}
              onViewAllSessions={handleViewAllSessions}
              t={t}
              tr={tr}
            />
          ))}
        </div>
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
