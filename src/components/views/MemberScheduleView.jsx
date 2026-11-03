import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  History,
  MapPin,
  RefreshCw,
  UserRound,
  X,
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import {
  cancelPrivateSession,
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
  DEFAULT_VISIBLE_HOLIDAY_GROUPS,
  PT_CANCEL_REFUND_HOURS_BEFORE,
  TIME_FORMATTER_HHMM,
  buildAllUpcomingHolidayChips,
  buildCourseScheduleModel,
  buildUpcomingHolidayGroups,
  computeSessionDisplayStatus,
  getHoursUntilSession,
  getSessionStatusBadgeMeta,
  getTodayIsoInVn,
  isActiveNormalEnrollment,
  normalizeScheduleSession,
  toDateDdMm,
  toDateDdMmYyyy,
  toDateTimeDdMmYyyy,
} from "../../utils/memberScheduleUtils"
import {
  NextSessionSpotlightBox,
  ScheduleSessionRow,
  SessionAbsenceModal,
  SessionDetailDrawer,
} from "../schedule/MemberCourseScheduleComponents"

export function MemberScheduleView() {
  const [searchParams, setSearchParams] = useSearchParams()
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

  // 4. Trang "Lịch học của tôi" còn 2 tab: "Lịch học (N)" và "Lịch PT 1-kèm-1 (N)".
  // Tab mặc định là "Lịch học" ("sessions"). URL có ?tab=courses hoặc tab không hợp lệ thì rơi về "Lịch học", không lỗi.
  const rawTabParam = searchParams.get("tab")
  const activeTab = useMemo(() => {
    if (rawTabParam === "private") return "private"
    return "sessions"
  }, [rawTabParam])

  const selectedClassIdFilter = searchParams.get("classId") || "all"

  const setTabAndFilter = useCallback(
    (nextTab, nextClassId = null) => {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.set("tab", nextTab)
      if (nextClassId && nextClassId !== "all") {
        nextParams.set("classId", String(nextClassId))
      } else if (nextClassId === "all" || nextTab !== "sessions") {
        nextParams.delete("classId")
      }
      setUserSelectedStatusFilter(null)
      setSearchParams(nextParams, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const [rawEnrollments, setRawEnrollments] = useState([])
  const [allSessions, setAllSessions] = useState([])
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)
  const [showAllHolidays, setShowAllHolidays] = useState(false)
  const [userSelectedStatusFilter, setUserSelectedStatusFilter] = useState(null)
  const [showPastPtSessions, setShowPastPtSessions] = useState(false)

  // Ngăn chi tiết buổi học, Báo vắng & Xác nhận hủy PT
  const [detailSession, setDetailSession] = useState(null)
  const [selectedSession, setSelectedSession] = useState(null)
  const [absenceReason, setAbsenceReason] = useState("")
  const [submittingAbsence, setSubmittingAbsence] = useState(false)
  const [absenceNotices, setAbsenceNotices] = useState([])
  const [loadingNotices, setLoadingNotices] = useState(false)
  const [cancellingSessionId, setCancellingSessionId] = useState(null)
  const [ptCancelConfirmTarget, setPtCancelConfirmTarget] = useState(null)

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
      setError(getErrorMessage(err, t("scheduleErrorLoad")))
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

  const allUpcomingHolidayChips = useMemo(
    () =>
      buildAllUpcomingHolidayChips(
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

  const targetCoursesInScheduleTab = useMemo(
    () =>
      activeCourses.filter(
        (c) =>
          selectedClassIdFilter === "all" ||
          String(c.classId) === String(selectedClassIdFilter),
      ),
    [activeCourses, selectedClassIdFilter],
  )

  // Tên khóa đang lọc để hiển thị trên chip "Lớp: <tên khóa> ×"
  const filteredCourseLabel = useMemo(() => {
    if (selectedClassIdFilter === "all") return null
    const matched = activeCourses.find(
      (c) => String(c.classId) === String(selectedClassIdFilter),
    )
    return matched?.className || matched?.subjectName || `#${selectedClassIdFilter}`
  }, [activeCourses, selectedClassIdFilter])

  // Buổi tiếp theo gần nhất trong phạm vi các khóa đang xem ở Tab "Lịch học"
  const nextSpotlightEntry = useMemo(() => {
    const candidates = targetCoursesInScheduleTab
      .filter((c) => c.nextValidSession)
      .map((c) => ({
        course: c,
        session: c.nextValidSession,
      }))
      .sort((a, b) => {
        const dateCmp = String(a.session.sessionDate || "").localeCompare(
          String(b.session.sessionDate || ""),
        )
        if (dateCmp !== 0) return dateCmp
        return String(a.session.startTime || "").localeCompare(
          String(b.session.startTime || ""),
        )
      })
    return candidates[0] || null
  }, [targetCoursesInScheduleTab])

  // Khi URL có classId: mặc định lọc "Tất cả" (all) để thấy đủ các buổi của khóa.
  // Không có classId: khóa đang học mặc định lọc "Sắp tới" (upcoming); khóa đã hoàn thành mặc định lọc "Tất cả" (all).
  const defaultSessionStatusFilter = useMemo(() => {
    if (selectedClassIdFilter !== "all") {
      return "all"
    }
    if (
      targetCoursesInScheduleTab.length > 0 &&
      targetCoursesInScheduleTab.every((c) => c.lifecycleStatus === "completed")
    ) {
      return "all"
    }
    return "upcoming"
  }, [selectedClassIdFilter, targetCoursesInScheduleTab])

  const sessionStatusFilter =
    userSelectedStatusFilter ?? defaultSessionStatusFilter

  // B.2: Số đếm trên các chip lọc trong Tab "Lịch học"
  const scheduleFilterCounts = useMemo(() => {
    const counts = { all: 0, upcoming: 0, completed: 0, cancelled: 0 }
    for (const course of targetCoursesInScheduleTab) {
      for (const s of course.allSessions) {
        counts.all += 1
        if (s.displayStatus === "upcoming" || s.displayStatus === "ongoing") {
          counts.upcoming += 1
        } else if (s.displayStatus === "completed") {
          counts.completed += 1
        } else if (s.displayStatus === "cancelled") {
          counts.cancelled += 1
        }
      }
    }
    return counts
  }, [targetCoursesInScheduleTab])

  const conflictingHolidayDatesDdMm = useMemo(() => {
    const dates = []
    for (const course of targetCoursesInScheduleTab) {
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
  }, [targetCoursesInScheduleTab, todayIso])

  const totalValidNormalSessionsCount = useMemo(
    () =>
      activeCourses.reduce(
        (sum, course) => sum + course.validSessions.length,
        0,
      ),
    [activeCourses],
  )

  const normalizedPrivateSessions = useMemo(() => {
    return allSessions
      .filter(
        (s) =>
          s.isPrivate === true && String(s.bookedMemberId) === String(memberId),
      )
      .map((s) => {
        const norm = normalizeScheduleSession(s)
        if (!norm) return null
        return {
          ...norm,
          displayStatus: computeSessionDisplayStatus(norm, nowMs),
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        const dateCmp = String(a.sessionDate || "").localeCompare(
          String(b.sessionDate || ""),
        )
        if (dateCmp !== 0) return dateCmp
        return String(a.startTime || "").localeCompare(String(b.startTime || ""))
      })
  }, [allSessions, memberId, nowMs])

  const validPrivateSessionsCount = useMemo(
    () =>
      normalizedPrivateSessions.filter((s) => s.displayStatus !== "cancelled")
        .length,
    [normalizedPrivateSessions],
  )

  const upcomingPtSessions = useMemo(
    () =>
      normalizedPrivateSessions.filter(
        (s) => s.displayStatus === "upcoming" || s.displayStatus === "ongoing",
      ),
    [normalizedPrivateSessions],
  )

  const pastOrCancelledPtSessions = useMemo(
    () =>
      normalizedPrivateSessions.filter(
        (s) =>
          s.displayStatus === "completed" || s.displayStatus === "cancelled",
      ),
    [normalizedPrivateSessions],
  )

  const ptCreditSummaryInfo = useMemo(() => {
    const candidates = [
      currentUser,
      ...rawEnrollments,
      ...normalizedPrivateSessions,
    ].filter(Boolean)

    for (const item of candidates) {
      const rawCredits =
        item.remainingCredits ?? item.creditsRemaining ?? item.ptCreditsLeft
      const rawDeadline =
        item.creditDeadline ?? item.ptCreditDeadline ?? item.deadlineAfter
      if (
        rawCredits != null &&
        rawCredits !== "" &&
        Number.isFinite(Number(rawCredits)) &&
        rawDeadline
      ) {
        const formattedDate = toDateDdMmYyyy(rawDeadline)
        if (formattedDate) {
          return {
            credits: Number(rawCredits),
            dateFormatted: formattedDate,
          }
        }
      }
    }
    return null
  }, [currentUser, rawEnrollments, normalizedPrivateSessions])

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

  const handleConfirmCancelPrivate = async () => {
    const session = ptCancelConfirmTarget?.session
    if (!session?.id) return
    setCancellingSessionId(session.id)
    try {
      await cancelPrivateSession(session.id)
      showToast(t("schedulePtCancelSuccessToast"), "success")
      setPtCancelConfirmTarget(null)
      await refresh()
    } catch (err) {
      showToast(
        getErrorMessage(err, t("schedulePtCancelErrorToast")),
        "error",
      )
    } finally {
      setCancellingSessionId(null)
    }
  }

  const renderScheduleTabHolidaySection = () => {
    if (upcomingHolidayGroups.length === 0) return null
    const expandedList =
      upcomingHolidayGroups.length > DEFAULT_VISIBLE_HOLIDAY_GROUPS
        ? upcomingHolidayGroups
        : allUpcomingHolidayChips.length > upcomingHolidayGroups.length
          ? allUpcomingHolidayChips
          : upcomingHolidayGroups
    const collapsedList = upcomingHolidayGroups.slice(
      0,
      DEFAULT_VISIBLE_HOLIDAY_GROUPS,
    )
    const visibleGroups = showAllHolidays ? expandedList : collapsedList
    const hasConflict = conflictingHolidayDatesDdMm.length > 0

    return (
      <section
        aria-label={t("scheduleHolidayTitle")}
        className={`rounded-xl border p-4 text-xs space-y-2.5 ${
          hasConflict
            ? "border-amber-200 bg-amber-50/70 text-slate-800"
            : "border-slate-200 bg-slate-50/70 text-slate-700"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 font-bold text-slate-800 whitespace-nowrap">
            <CalendarDays className="h-4 w-4 text-slate-500 shrink-0" />
            <span>{t("scheduleHolidayTitle")}</span>
          </div>

          <button
            type="button"
            aria-expanded={showAllHolidays}
            onClick={() => setShowAllHolidays((prev) => !prev)}
            className="font-semibold text-slate-700 underline hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded cursor-pointer whitespace-nowrap shrink-0"
          >
            {showAllHolidays
              ? t("scheduleHolidayCollapse")
              : t("scheduleHolidayShowAll")}
          </button>
        </div>

        {hasConflict && (
          <div className="flex items-center gap-1.5 font-semibold text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>
              {tr("scheduleHolidayConflictWarning", {
                date: conflictingHolidayDatesDdMm.join(", "),
              })}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {visibleGroups.map((group) => (
            <span
              key={group.id}
              className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-700 border border-slate-200"
            >
              {group.baseName} · {group.dateLabel}
            </span>
          ))}
        </div>
      </section>
    )
  }

  const renderPtSessionCard = (normalizedPt) => {
    const ptDisplayStatus = normalizedPt.displayStatus
    const ptBadge = getSessionStatusBadgeMeta(ptDisplayStatus, t)
    const isCancelled = ptDisplayStatus === "cancelled"
    const hoursLeft = getHoursUntilSession(normalizedPt, nowMs)
    const cutoffHours =
      normalizedPt.cancelCutoffHours ?? PT_CANCEL_REFUND_HOURS_BEFORE
    const refundDeadlineMs =
      normalizedPt.startMs !== null
        ? normalizedPt.startMs - cutoffHours * 60 * 60 * 1000
        : null
    const refundDeadlineFormatted =
      refundDeadlineMs !== null
        ? toDateTimeDdMmYyyy(new Date(refundDeadlineMs).toISOString())
        : null
    const canCancelForRefund =
      refundDeadlineMs !== null
        ? nowMs <= refundDeadlineMs
        : hoursLeft === null || hoursLeft >= cutoffHours
    const isPastSession =
      ptDisplayStatus === "completed" || (hoursLeft !== null && hoursLeft <= 0)

    const ptTypeKey = normalizedPt.isPrivate
      ? "schedulePtTypeBadge"
      : "scheduleCourseInProgress"
    const creditReturnedDateFormatted = normalizedPt.deadlineAfter
      ? toDateDdMmYyyy(normalizedPt.deadlineAfter)
      : null

    return (
      <div
        key={
          normalizedPt.id ||
          `${normalizedPt.sessionDate}-${normalizedPt.startTime}`
        }
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-800 border border-blue-200">
              {t(ptTypeKey)}
            </span>
            <h3 className="text-sm font-extrabold text-slate-900">
              {normalizedPt.subjectName ||
                normalizedPt.className ||
                t("schedulePtDefaultTitle")}
            </h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${ptBadge.className}`}
            >
              <span aria-hidden="true">{ptBadge.icon}</span>
              <span>{ptBadge.label}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1 font-medium text-slate-800">
              <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
              {toDateDdMmYyyy(normalizedPt.sessionDate) || "—"} ·{" "}
              {normalizedPt.startTime}–{normalizedPt.endTime}
            </span>
            <span className="inline-flex items-center gap-1">
              <UserRound className="h-3.5 w-3.5 text-slate-400" />
              {t("scheduleLabelCoach")}:{" "}
              <strong>
                {normalizedPt.coachName || t("scheduleCoachTbd")}
              </strong>
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              {normalizedPt.roomName || t("scheduleRoomTbd")}
            </span>
          </div>

          {isCancelled &&
            (normalizedPt.creditReturned || creditReturnedDateFormatted) && (
              <p className="text-xs font-semibold text-emerald-700 pt-0.5">
                {creditReturnedDateFormatted
                  ? tr("schedulePtCreditReturnedWithDate", {
                      date: creditReturnedDateFormatted,
                    })
                  : t("schedulePtCreditReturnedOnly")}
              </p>
            )}
        </div>

        {!isCancelled && !isPastSession && (
          <div className="flex flex-col sm:items-end gap-1 shrink-0">
            <button
              type="button"
              disabled={cancellingSessionId === normalizedPt.id}
              onClick={() =>
                setPtCancelConfirmTarget({
                  session: normalizedPt,
                  canCancelForRefund,
                  cutoffHours,
                  refundDeadlineFormatted,
                })
              }
              className="min-h-[38px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 px-3.5 py-1.5 text-xs font-bold text-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
            >
              {cancellingSessionId === normalizedPt.id
                ? t("schedulePtBtnCancelling")
                : t("schedulePtBtnCancel")}
            </button>

            <span className="text-xs text-slate-500">
              {canCancelForRefund && refundDeadlineFormatted
                ? tr("schedulePtRefundDeadlineHint", {
                    datetime: refundDeadlineFormatted,
                  })
                : t("schedulePtNoRefundHint")}
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-6 sm:px-7 sm:py-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-accent-dark">
            {t("scheduleBrand")}
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">
            {t("schedulePageTitle")}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {t("schedulePageSubtitle")}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            aria-label={t("scheduleBtnRefresh")}
            title={t("scheduleBtnRefresh")}
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

      {/* Thanh 2 Tabs: Lịch học (N) & Lịch PT 1-kèm-1 (N) */}
      <nav
        aria-label={t("schedulePageTitle")}
        className="border-b border-slate-200 pb-2.5 flex items-center gap-2 overflow-x-auto no-scrollbar"
      >
        <button
          type="button"
          onClick={() => setTabAndFilter("sessions", selectedClassIdFilter)}
          className={`min-h-[40px] whitespace-nowrap px-3.5 py-2 rounded-lg text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer ${
            activeTab === "sessions"
              ? "bg-slate-900 text-white shadow-2xs"
              : "text-slate-700 hover:bg-slate-200/60"
          }`}
        >
          {tr("scheduleTabSessions", { count: totalValidNormalSessionsCount })}
        </button>

        <button
          type="button"
          onClick={() => setTabAndFilter("private")}
          className={`min-h-[40px] whitespace-nowrap px-3.5 py-2 rounded-lg text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer ${
            activeTab === "private"
              ? "bg-slate-900 text-white shadow-2xs"
              : "text-slate-700 hover:bg-slate-200/60"
          }`}
        >
          {tr("scheduleTabPrivate", { count: validPrivateSessionsCount })}
        </button>
      </nav>

      {!validMember && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {t("scheduleUnlinkedAccount")}
        </div>
      )}

      {/* Error banner */}
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

      {/* Nội dung theo Tab */}
      {loading && activeCourses.length === 0 ? (
        <div aria-busy="true" className="space-y-4">
          <div className="h-20 w-full rounded-xl bg-slate-200/70 animate-pulse" />
          {[1, 2].map((item) => (
            <div
              key={item}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 animate-pulse"
            >
              <div className="h-5 w-1/3 rounded bg-slate-200" />
              <div className="h-10 w-full rounded-lg bg-slate-100" />
              <div className="h-10 w-full rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>
      ) : activeTab === "sessions" ? (
        /* Tab "Lịch học": đầu tab hiển thị khối "Buổi tiếp theo", tiếp theo là lịch nghỉ lễ, bộ lọc, danh sách buổi */
        <div className="space-y-4">
          {nextSpotlightEntry && (
            <NextSessionSpotlightBox
              session={nextSpotlightEntry.session}
              lifecycleStatus={nextSpotlightEntry.course.lifecycleStatus}
              todayIso={todayIso}
              t={t}
              tr={tr}
              showCourseName={true}
            />
          )}

          {renderScheduleTabHolidaySection()}

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 w-fit">
              {[
                {
                  key: "all",
                  label: t("scheduleFilterAll"),
                  count: scheduleFilterCounts.all,
                },
                {
                  key: "upcoming",
                  label: t("scheduleFilterUpcoming"),
                  count: scheduleFilterCounts.upcoming,
                },
                {
                  key: "completed",
                  label: t("scheduleFilterCompleted"),
                  count: scheduleFilterCounts.completed,
                },
                {
                  key: "cancelled",
                  label: t("scheduleFilterCancelled"),
                  count: scheduleFilterCounts.cancelled,
                },
              ].map((filterItem) => (
                <button
                  key={filterItem.key}
                  type="button"
                  onClick={() => setUserSelectedStatusFilter(filterItem.key)}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer ${
                    sessionStatusFilter === filterItem.key
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {filterItem.label} ({filterItem.count})
                </button>
              ))}
            </div>

            {scheduleFilterCounts.cancelled > 0 && (
              <span className="text-xs text-slate-500">
                {scheduleFilterCounts.cancelled === 1
                  ? t("scheduleFilterIncludesOneCancelled")
                  : tr("scheduleFilterIncludesCancelled", {
                      count: scheduleFilterCounts.cancelled,
                    })}
              </span>
            )}

            {/* Chip "Lớp: <tên khóa> ×" khi URL có tham số classId */}
            {selectedClassIdFilter !== "all" && filteredCourseLabel && (
              <button
                type="button"
                onClick={() => setTabAndFilter("sessions", "all")}
                className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
              >
                <span>
                  {tr("scheduleCourseFilterChip", {
                    name: filteredCourseLabel,
                  })}
                </span>
                <span aria-hidden="true" className="text-sm leading-none">
                  ×
                </span>
              </button>
            )}
          </div>

          {activeCourses.length === 0 ? (
            validMember &&
            !error && (
              <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                <CalendarDays className="mx-auto h-9 w-9 text-slate-400" />
                <p className="mt-3 text-sm font-medium text-slate-700">
                  {t("scheduleEmptyCourses")}
                </p>
              </section>
            )
          ) : targetCoursesInScheduleTab.length === 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
              {t("scheduleEmptySessions")}
            </section>
          ) : (
            targetCoursesInScheduleTab.map((course) => {
              const filteredSessions = course.allSessions.filter((s) => {
                if (sessionStatusFilter === "all") return true
                if (sessionStatusFilter === "upcoming") {
                  return (
                    s.displayStatus === "upcoming" ||
                    s.displayStatus === "ongoing"
                  )
                }
                return s.displayStatus === sessionStatusFilter
              })

              return (
                <section
                  key={course.id || course.classId}
                  className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-2xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold uppercase text-brand-accent-dark">
                        {course.subjectName || "VIBE SPORT"}
                      </span>
                      <h2 className="text-base font-extrabold text-slate-900">
                        {course.className || `#${course.classId}`}
                      </h2>
                    </div>
                    <span className="text-xs font-bold text-slate-600">
                      {tr("scheduleProgressLabel", {
                        completed: course.completedCount,
                        required: course.requiredSessions,
                      })}
                    </span>
                  </div>

                  {filteredSessions.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-500">
                      {t("scheduleEmptySessions")}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {filteredSessions.map((session) => (
                        <ScheduleSessionRow
                          key={
                            session.id ||
                            `${session.sessionDate}-${session.startTime}`
                          }
                          session={session}
                          onSelectSession={setDetailSession}
                          showMakeupOrigin={true}
                          showNextBadge={true}
                          t={t}
                          tr={tr}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )
            })
          )}
        </div>
      ) : (
        /* Tab Lịch tập PT 1-kèm-1 */
        <div className="space-y-4">
          {normalizedPrivateSessions.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-extrabold text-slate-900">
                {t("schedulePtSectionTitle")}
              </h2>

              <button
                type="button"
                onClick={() =>
                  handleOpenAbsenceModal(
                    upcomingPtSessions[0] || normalizedPrivateSessions[0],
                  )
                }
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 underline hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded cursor-pointer"
              >
                <History className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span>{t("schedulePtAbsenceHistoryLink")}</span>
              </button>
            </div>
          )}

          {ptCreditSummaryInfo && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-800">
              {tr("schedulePtCreditSummary", {
                credits: ptCreditSummaryInfo.credits,
                date: ptCreditSummaryInfo.dateFormatted,
              })}
            </div>
          )}

          {normalizedPrivateSessions.length === 0 ? (
            <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
              <UserRound className="mx-auto h-9 w-9 text-slate-400" />
              <h2 className="mt-3 text-lg font-bold text-slate-900">
                {t("scheduleEmptyPrivate")}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {t("scheduleEmptyPrivateSub")}
              </p>
            </section>
          ) : (
            <div className="space-y-4">
              <section className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  {tr("schedulePtGroupUpcoming", {
                    count: upcomingPtSessions.length,
                  })}
                </h3>
                {upcomingPtSessions.length === 0 ? (
                  <p className="rounded-xl border border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
                    {t("scheduleEmptySessions")}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {upcomingPtSessions.map((ptSession) =>
                      renderPtSessionCard(ptSession),
                    )}
                  </div>
                )}
              </section>

              {pastOrCancelledPtSessions.length > 0 && (
                <section className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPastPtSessions((prev) => !prev)}
                    aria-expanded={showPastPtSessions}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded cursor-pointer"
                  >
                    {showPastPtSessions ? (
                      <ChevronUp className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    )}
                    <span>
                      {tr("schedulePtGroupPastCancelled", {
                        count: pastOrCancelledPtSessions.length,
                      })}
                    </span>
                  </button>

                  {showPastPtSessions && (
                    <div className="space-y-2.5">
                      {pastOrCancelledPtSessions.map((ptSession) =>
                        renderPtSessionCard(ptSession),
                      )}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hộp xác nhận hủy lịch PT 1-kèm-1 */}
      {ptCancelConfirmTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("schedulePtCancelConfirmTitle")}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {t("schedulePtCancelConfirmTitle")}
              </h3>
              <button
                type="button"
                aria-label={t("scheduleAbsenceClose")}
                onClick={() => setPtCancelConfirmTarget(null)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <p className="font-bold text-slate-900">
                {ptCancelConfirmTarget.session.subjectName ||
                  ptCancelConfirmTarget.session.className ||
                  t("schedulePtDefaultTitle")}{" "}
                ·{" "}
                {toDateDdMmYyyy(ptCancelConfirmTarget.session.sessionDate) ||
                  "—"}{" "}
                ({ptCancelConfirmTarget.session.startTime}–
                {ptCancelConfirmTarget.session.endTime})
              </p>

              <p
                className={`rounded-lg border p-3 font-medium leading-relaxed ${
                  ptCancelConfirmTarget.canCancelForRefund
                    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                    : "border-amber-200 bg-amber-50 text-amber-950"
                }`}
              >
                {ptCancelConfirmTarget.canCancelForRefund
                  ? tr("schedulePtCancelConfirmRefundMsg", {
                      hours: ptCancelConfirmTarget.cutoffHours,
                      datetime:
                        ptCancelConfirmTarget.refundDeadlineFormatted || "—",
                    })
                  : tr("schedulePtCancelConfirmNoRefundMsg", {
                      hours: ptCancelConfirmTarget.cutoffHours,
                    })}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPtCancelConfirmTarget(null)}
                className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {t("scheduleAbsenceClose")}
              </button>
              <button
                type="button"
                disabled={
                  cancellingSessionId === ptCancelConfirmTarget.session.id
                }
                onClick={handleConfirmCancelPrivate}
                className="min-h-[38px] rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 px-4 py-1.5 text-xs font-bold text-white cursor-pointer"
              >
                {cancellingSessionId === ptCancelConfirmTarget.session.id
                  ? t("schedulePtBtnCancelling")
                  : t("schedulePtCancelConfirmBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ngăn chi tiết buổi học dùng chung */}
      <SessionDetailDrawer
        detailSession={detailSession}
        onClose={() => setDetailSession(null)}
        onOpenAbsenceModal={handleOpenAbsenceModal}
        t={t}
        tr={tr}
      />

      {/* Modal Báo vắng & Lịch sử báo vắng dùng chung */}
      <SessionAbsenceModal
        selectedSession={selectedSession}
        onClose={() => setSelectedSession(null)}
        absenceReason={absenceReason}
        onChangeAbsenceReason={setAbsenceReason}
        onSubmitAbsence={handleSubmitAbsence}
        submittingAbsence={submittingAbsence}
        absenceNotices={absenceNotices}
        loadingNotices={loadingNotices}
        privateSessionsList={normalizedPrivateSessions}
        onSelectDifferentSession={handleOpenAbsenceModal}
        t={t}
        tr={tr}
      />
    </main>
  )
}
