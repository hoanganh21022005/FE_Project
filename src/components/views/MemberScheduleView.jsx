import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  RefreshCw,
  X,
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import {
  cancelPrivateSession,
  getActiveHolidays,
  getAdvancedRegistrations,
  getClassCatalogSessions,
  getClassSessions,
  getMemberAttendances,
  getMemberClasses,
  getSessionAbsenceNotices,
  getTimeSlots,
  requestAbsence,
} from "../../api/memberPortalApi"
import { membershipApi } from "../../api/membershipApi"
import { getAuthoritativeProfileId } from "../../utils/memberSafetyHelpers"
import { getErrorMessage } from "../../api/apiErrors"
import {
  TIME_FORMATTER_HHMM,
  isActiveNormalEnrollment,
} from "../../utils/memberScheduleUtils"
import {
  addDaysIso,
  buildHolidaysSummary,
  buildPackageSummaries,
  buildScheduleItems,
  filterItems,
  findNextUpcomingItem,
  findNextWeekWithSessions,
  getCounts,
  getVnTodayIso,
  getWeekRange,
  groupByDay,
  normalizeTimeSlots,
  toDdMmYyyy,
} from "../../utils/scheduleModel"
import {
  NextSessionCard,
  PackageSummary,
  ScheduleLegend,
  ScheduleList,
  SessionDrawer,
  UpcomingHolidays,
  ViewToggle,
  WeekGrid,
  WeekNavigator,
} from "../schedule/MemberScheduleWidgets"
import { SessionAbsenceModal } from "../schedule/MemberCourseScheduleComponents"

export function MemberScheduleView() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentUser, language, t, showToast } = useSCMS()

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

  // Chế độ xem: Desktop (>= 1024px) mặc định Tuần, Mobile/Tablet mặc định Danh sách
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      return "list"
    }
    return "week"
  })

  // Bộ lọc loại buổi học: 'all' | 'group' | 'pt' (đồng bộ nếu URL có ?tab=private)
  const rawTabParam = searchParams.get("tab")
  const [typeFilter, setTypeFilter] = useState(() =>
    rawTabParam === "private" ? "pt" : "all",
  )

  const selectedClassIdFilter = searchParams.get("classId") || "all"

  const clearClassFilter = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete("classId")
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  // Tab trạng thái ở chế độ Danh sách (một hàng duy nhất: upcoming | done | cancelled, KHÔNG có tab Tất cả)
  const [statusTab, setStatusTab] = useState("upcoming")
  const [legendOpen, setLegendOpen] = useState(false)

  // Tuần đang xem (bắt đầu Thứ Hai)
  const [anchorDateIso, setAnchorDateIso] = useState(() => getVnTodayIso())

  // Thu gọn Gói của tôi / Nghỉ lễ trên mobile
  const [mobilePackagesOpen, setMobilePackagesOpen] = useState(false)
  const [mobileHolidaysOpen, setMobileHolidaysOpen] = useState(false)

  // Dữ liệu từ API
  const [rawEnrollments, setRawEnrollments] = useState([])
  const [allSessions, setAllSessions] = useState([])
  const [timeSlots, setTimeSlots] = useState(() => normalizeTimeSlots([]))
  const [attendances, setAttendances] = useState([])
  const [holidays, setHolidays] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [advancedRegs, setAdvancedRegs] = useState([])
  const [absenceNoticesBySession, setAbsenceNoticesBySession] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null)

  // Drawer chi tiết buổi học, Modal Báo vắng PT & Hộp xác nhận hủy PT
  const [detailSession, setDetailSession] = useState(null)
  const [selectedSessionForAbsence, setSelectedSessionForAbsence] =
    useState(null)
  const [absenceReason, setAbsenceReason] = useState("")
  const [submittingAbsence, setSubmittingAbsence] = useState(false)
  const [absenceNoticesList, setAbsenceNoticesList] = useState([])
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
      const [
        enrollments,
        sessions,
        activeHolidays,
        slotsRes,
        attRes,
        subsRes,
        advRes,
      ] = await Promise.all([
        getMemberClasses(memberId),
        getClassSessions().catch(() => []),
        getActiveHolidays().catch(() => []),
        getTimeSlots().catch(() => []),
        getMemberAttendances(memberId).catch(() => []),
        membershipApi.getMemberSubscriptions(memberId).catch(() => []),
        getAdvancedRegistrations().catch(() => []),
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
      setTimeSlots(normalizeTimeSlots(slotsRes))
      setAttendances(Array.isArray(attRes) ? attRes : [])
      setSubscriptions(Array.isArray(subsRes) ? subsRes : [])
      setAdvancedRegs(
        (Array.isArray(advRes) ? advRes : []).filter(
          (r) => !r.memberId || String(r.memberId) === String(memberId),
        ),
      )
      setLastUpdatedAt(new Date())
    } catch (err) {
      setError(getErrorMessage(err, t("scheduleErrorLoad")))
    } finally {
      setLoading(false)
    }
  }, [memberId, validMember, t])

  useEffect(() => {
    refresh()
  }, [refresh])

  const nowMs = Date.now()
  const todayIso = getVnTodayIso(nowMs)
  const currentWeekRange = useMemo(() => getWeekRange(todayIso), [todayIso])
  const selectedWeekRange = useMemo(
    () => getWeekRange(anchorDateIso),
    [anchorDateIso],
  )
  const isCurrentWeek =
    selectedWeekRange.mondayIso === currentWeekRange.mondayIso

  // Tách danh sách buổi nhóm (thuộc các lớp Normal đang active của hội viên) và buổi PT 1:1
  const activeEnrollments = useMemo(
    () => rawEnrollments.filter((row) => isActiveNormalEnrollment(row)),
    [rawEnrollments],
  )

  const { rawGroupSessions, rawPtSessions } = useMemo(() => {
    const enrolledClassIds = new Set(
      activeEnrollments
        .map((e) => e?.classId ?? e?.sportsClassId)
        .filter((id) => id != null)
        .map(String),
    )

    const groupList = []
    for (const enr of activeEnrollments) {
      const inline =
        enr.sessions || enr.classSessions || enr.scheduledSessions || []
      if (Array.isArray(inline) && inline.length > 0) {
        for (const s of inline) {
          groupList.push({
            ...s,
            classId: s.classId ?? enr.classId ?? enr.sportsClassId,
          })
        }
      }
    }
    for (const s of allSessions) {
      if (
        s &&
        s.isPrivate !== true &&
        s.classId != null &&
        enrolledClassIds.has(String(s.classId))
      ) {
        groupList.push(s)
      }
    }

    const ptList = allSessions.filter(
      (s) =>
        s &&
        (s.isPrivate === true ||
          String(s.type || "").toUpperCase() === "PRIVATE") &&
        String(s.bookedMemberId) === String(memberId),
    )

    return { rawGroupSessions: groupList, rawPtSessions: ptList }
  }, [activeEnrollments, allSessions, memberId])

  // Mảng phẳng chuẩn hóa duy nhất cho toàn bộ lịch học
  const scheduleItems = useMemo(
    () =>
      buildScheduleItems({
        groupSessions: rawGroupSessions,
        ptSessions: rawPtSessions,
        enrollments: activeEnrollments,
        attendances,
        absenceNotices: absenceNoticesBySession,
        holidays,
        timeSlots,
        now: nowMs,
      }),
    [
      rawGroupSessions,
      rawPtSessions,
      activeEnrollments,
      attendances,
      absenceNoticesBySession,
      holidays,
      timeSlots,
      nowMs,
    ],
  )

  // Lọc theo loại (Tất cả / Lớp nhóm / PT 1:1) & classId (nếu có trên URL)
  const itemsByType = useMemo(
    () =>
      filterItems(scheduleItems, {
        type: typeFilter,
        classId: selectedClassIdFilter,
      }),
    [scheduleItems, typeFilter, selectedClassIdFilter],
  )

  // Số đếm toàn cục (cho các tab ở chế độ Danh sách và thanh thống kê)
  const globalCounts = useMemo(() => getCounts(itemsByType), [itemsByType])

  // Các buổi trong tuần đang chọn (cho WeekGrid)
  const weekItems = useMemo(
    () =>
      filterItems(itemsByType, {
        range: {
          startIso: selectedWeekRange.mondayIso,
          endIso: selectedWeekRange.sundayIso,
        },
      }),
    [itemsByType, selectedWeekRange],
  )

  const weekCounts = useMemo(() => getCounts(weekItems), [weekItems])

  // Các buổi trong chế độ Danh sách theo tab trạng thái (upcoming | done | cancelled)
  const listItems = useMemo(
    () => filterItems(itemsByType, { statusTab }),
    [itemsByType, statusTab],
  )

  const listDayGroups = useMemo(
    () => groupByDay(listItems, { now: nowMs }),
    [listItems, nowMs],
  )

  // Buổi tiếp theo gần nhất
  const nextUpcomingItem = useMemo(
    () => findNextUpcomingItem(scheduleItems),
    [scheduleItems],
  )

  // Tuần có buổi học gần nhất tiếp theo (khi tuần hiện tại trống)
  const nextAvailableMondayIso = useMemo(
    () =>
      findNextWeekWithSessions(itemsByType, selectedWeekRange.sundayIso),
    [itemsByType, selectedWeekRange.sundayIso],
  )

  // Gói của tôi & Nghỉ lễ 30 ngày tới
  const packageSummaries = useMemo(
    () =>
      buildPackageSummaries({
        enrollments: activeEnrollments,
        subscriptions,
        advancedRegistrations: advancedRegs,
        scheduleItems,
      }),
    [activeEnrollments, subscriptions, advancedRegs, scheduleItems],
  )

  const holidaysSummary = useMemo(
    () => buildHolidaysSummary(holidays, nowMs),
    [holidays, nowMs],
  )

  // Tên khóa đang lọc trên URL (nếu có)
  const filteredCourseLabel = useMemo(() => {
    if (selectedClassIdFilter === "all") return null
    const matched = activeEnrollments.find(
      (c) =>
        String(c.classId ?? c.sportsClassId) === String(selectedClassIdFilter),
    )
    return (
      matched?.className || matched?.subjectName || `#${selectedClassIdFilter}`
    )
  }, [activeEnrollments, selectedClassIdFilter])

  // Thao tác Báo vắng (chỉ áp dụng cho buổi PT 1:1)
  const handleOpenAbsenceModal = async (sessionItem) => {
    setDetailSession(null)
    setSelectedSessionForAbsence({
      ...sessionItem,
      id: sessionItem.rawId || sessionItem.id,
      sessionDate: sessionItem.date,
      isPrivate: sessionItem.kind === "pt",
    })
    setAbsenceReason("")
    setAbsenceNoticesList([])
    const sid = sessionItem?.rawId || sessionItem?.id
    if (!sid) return
    setLoadingNotices(true)
    try {
      const notices = await getSessionAbsenceNotices(sid)
      const list = Array.isArray(notices) ? notices : []
      setAbsenceNoticesList(list)
      setAbsenceNoticesBySession((prev) => ({ ...prev, [sid]: list }))
    } catch {
      setAbsenceNoticesList([])
    } finally {
      setLoadingNotices(false)
    }
  }

  const handleSubmitAbsence = async (e) => {
    e.preventDefault()
    const sid = selectedSessionForAbsence?.id
    if (!sid) return
    if (!absenceReason.trim()) {
      showToast(t("scheduleAbsenceReasonRequired"), "error")
      return
    }
    setSubmittingAbsence(true)
    try {
      await requestAbsence(sid, absenceReason.trim())
      showToast(t("scheduleAbsenceSubmitSuccess"), "success")
      const notices = await getSessionAbsenceNotices(sid).catch(() => [])
      const list = Array.isArray(notices) ? notices : []
      setAbsenceNoticesList(list)
      setAbsenceNoticesBySession((prev) => ({ ...prev, [sid]: list }))
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

  // Thao tác Hủy buổi PT 1:1
  const handleRequestCancelPt = (sessionItem) => {
    setDetailSession(null)
    setPtCancelConfirmTarget({
      session: {
        ...sessionItem,
        id: sessionItem.rawId || sessionItem.id,
        sessionDate: sessionItem.date,
      },
      canCancelForRefund: sessionItem.canCancelPtForRefund,
      cutoffHours: sessionItem.cancelCutoffHours,
      refundDeadlineFormatted: sessionItem.ptRefundDeadlineFormatted,
    })
  }

  const handleConfirmCancelPrivate = async () => {
    const sid = ptCancelConfirmTarget?.session?.id
    if (!sid) return
    setCancellingSessionId(sid)
    try {
      await cancelPrivateSession(sid)
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

  const ptSessionsForModal = useMemo(
    () =>
      scheduleItems
        .filter((x) => x.kind === "pt")
        .map((x) => ({
          ...x,
          id: x.rawId || x.id,
          sessionDate: x.date,
          isPrivate: true,
        })),
    [scheduleItems],
  )

  return (
    <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6">
      {/* Header: Tiêu đề 24px + ViewToggle + Làm mới */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-[24px] font-black tracking-tight text-slate-950 leading-tight">
            {t("memberSchedTitle")}
          </h1>
          <p className="mt-1 text-[13px] text-slate-700">
            {t("memberSchedPageSubtitle")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <ViewToggle
            viewMode={viewMode}
            onChangeViewMode={setViewMode}
            t={t}
          />

          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            aria-label={t("scheduleBtnRefresh")}
            title={t("scheduleBtnRefresh")}
            className="min-h-[38px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            {lastUpdatedAt && (
              <span className="text-slate-600 font-semibold tabular-nums">
                {TIME_FORMATTER_HHMM.format(lastUpdatedAt)}
              </span>
            )}
          </button>
        </div>
      </header>

      {!validMember && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[14px] text-amber-900"
        >
          {t("scheduleUnlinkedAccount")}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-[14px] text-rose-900 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-700" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="min-h-[36px] rounded-lg border border-rose-300 bg-white px-3.5 py-1.5 text-[13px] font-bold text-rose-800 hover:bg-rose-100 cursor-pointer"
          >
            {t("scheduleBtnRetry")}
          </button>
        </div>
      )}

      {/* Mobile: Thẻ Buổi tiếp theo hiển thị ngay đầu trang (< 1024px) */}
      <div className="lg:hidden">
        <NextSessionCard
          nextItem={nextUpcomingItem}
          todayIso={todayIso}
          nowMs={nowMs}
          onSelectSession={setDetailSession}
          onOpenAbsenceModal={handleOpenAbsenceModal}
          language={language}
          t={t}
          tr={tr}
        />
      </div>

      {/* Bố cục chính: Desktop 2 cột (Lịch bên trái + Sidebar 320px bên phải) */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        {/* CỘT TRÁI: Điều khiển + Lưới tuần hoặc Danh sách */}
        <div className="space-y-4 min-w-0">
          {/* Thanh điều khiển (Sticky trên mobile) */}
          <div className="sticky top-0 z-20 rounded-xl border border-slate-200 bg-white/95 backdrop-blur-xs p-3.5 shadow-2xs space-y-3">
            {/* Chế độ Tuần: WeekNavigator + Thống kê tách rõ Tuần này vs Toàn khóa */}
            {viewMode === "week" && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <WeekNavigator
                  weekRange={selectedWeekRange}
                  isCurrentWeek={isCurrentWeek}
                  onPrevWeek={() =>
                    setAnchorDateIso((d) => addDaysIso(d, -7))
                  }
                  onNextWeek={() =>
                    setAnchorDateIso((d) => addDaysIso(d, 7))
                  }
                  onThisWeek={() => setAnchorDateIso(todayIso)}
                  onPickDate={(pickedIso) => setAnchorDateIso(pickedIso)}
                  t={t}
                />

                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] font-semibold text-slate-700">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-[12px]">
                    <span className="font-bold text-slate-600">
                      {t("memberSchedScopeThisWeek")}
                    </span>
                    <span>
                      {t("memberSchedStatDone")}{" "}
                      <strong className="font-extrabold text-emerald-800 tabular-nums">
                        {weekCounts.done}
                      </strong>
                    </span>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span>
                      {t("memberSchedStatAbsent")}{" "}
                      <strong className="font-extrabold text-rose-700 tabular-nums">
                        {weekCounts.absent}
                      </strong>
                    </span>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span>
                      {t("memberSchedStatUpcoming")}{" "}
                      <strong className="font-extrabold text-sky-900 tabular-nums">
                        {weekCounts.upcoming}
                      </strong>
                    </span>
                  </span>

                  <span aria-hidden="true" className="text-slate-300 hidden sm:inline">
                    |
                  </span>

                  <span className="font-bold text-slate-600">
                    {t("memberSchedScopeAllPackages")}
                  </span>
                  <span>
                    {t("memberSchedStatDone")}{" "}
                    <strong className="font-extrabold text-emerald-800 tabular-nums">
                      {globalCounts.done}
                    </strong>
                  </span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span>
                    {t("memberSchedStatAbsent")}{" "}
                    <strong className="font-extrabold text-rose-700 tabular-nums">
                      {globalCounts.absent}
                    </strong>
                  </span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span>
                    {t("memberSchedStatUpcoming")}{" "}
                    <strong className="font-extrabold text-sky-900 tabular-nums">
                      {globalCounts.upcoming}
                    </strong>
                  </span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span>
                    {t("memberSchedStatCancelled")}{" "}
                    <strong className="font-extrabold text-slate-800 tabular-nums">
                      {globalCounts.cancelled}
                    </strong>
                  </span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span
                    title={t("memberSchedAttendanceTooltip")}
                    className="inline-flex items-center gap-1 cursor-help"
                  >
                    <span>{t("memberSchedStatAttendance")}</span>
                    <strong className="font-extrabold text-slate-950 tabular-nums">
                      {globalCounts.attendanceRate === null
                        ? "–"
                        : `${globalCounts.attendanceRate}%`}
                    </strong>
                    <HelpCircle className="h-3.5 w-3.5 text-slate-500" />
                  </span>
                </div>
              </div>
            )}

            {/* Hàng lọc loại buổi (Segmented control) + Chú giải gọn inline (Tuần) hoặc Chuyên cần (Danh sách) */}
            <div
              className={`flex flex-wrap items-center justify-between gap-2 ${
                viewMode === "week" ? "pt-2 border-t border-slate-100" : ""
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                {/* Segmented control: Loại buổi (Tất cả / Lớp nhóm / PT 1:1) */}
                <div className="inline-flex items-center rounded-lg bg-slate-100 p-1">
                  {[
                    { key: "all", label: t("memberSchedTypeAll") },
                    { key: "group", label: t("memberSchedTypeGroup") },
                    { key: "pt", label: t("memberSchedTypePt") },
                  ].map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => setTypeFilter(chip.key)}
                      className={`min-h-[32px] rounded-md px-3 py-1 text-[13px] font-bold transition-colors cursor-pointer ${
                        typeFilter === chip.key
                          ? "bg-white text-slate-950 shadow-2xs"
                          : "text-slate-700 hover:text-slate-950"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* Chip đang lọc theo 1 lớp cụ thể (nếu URL có classId) */}
                {selectedClassIdFilter !== "all" && filteredCourseLabel && (
                  <button
                    type="button"
                    onClick={clearClassFilter}
                    className="min-h-[32px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[13px] font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
                  >
                    <span>
                      {tr("scheduleCourseFilterChip", {
                        name: filteredCourseLabel,
                      })}
                    </span>
                    <span aria-hidden="true">×</span>
                  </button>
                )}
              </div>

              {viewMode === "week" ? (
                <ScheduleLegend t={t} />
              ) : (
                <div
                  title={t("memberSchedAttendanceTooltip")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-[13px] font-semibold text-slate-800 cursor-help"
                >
                  <span>{t("memberSchedStatAttendance")}:</span>
                  <strong className="font-extrabold text-slate-950 tabular-nums">
                    {globalCounts.attendanceRate === null
                      ? "–"
                      : `${globalCounts.attendanceRate}%`}
                  </strong>
                  <HelpCircle className="h-3.5 w-3.5 text-slate-500" />
                </div>
              )}
            </div>

            {/* P0 3.1: Ở chế độ Danh sách, gộp thống kê và tab trạng thái thành một hàng tab gạch chân có thêm tab Vắng mặt */}
            {viewMode === "list" && (
              <div
                role="tablist"
                className="flex flex-wrap items-center gap-1 border-b border-slate-200 pt-1 -mb-1"
              >
                {[
                  {
                    key: "upcoming",
                    label: t("memberSchedTabUpcoming"),
                    count: globalCounts.upcoming,
                  },
                  {
                    key: "done",
                    label: t("memberSchedTabDone"),
                    count: globalCounts.done,
                  },
                  {
                    key: "absent",
                    label: t("memberSchedTabAbsent"),
                    count: globalCounts.absent,
                  },
                  {
                    key: "cancelled",
                    label: t("memberSchedTabCancelled"),
                    count: globalCounts.cancelled,
                  },
                ].map((tab) => {
                  const isActive = statusTab === tab.key
                  return (
                    <button
                      key={tab.key}
                      role="tab"
                      aria-selected={isActive}
                      type="button"
                      onClick={() => setStatusTab(tab.key)}
                      className={`min-h-[38px] px-3.5 py-2 text-[13px] font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? "border-blue-700 text-blue-800"
                          : "border-transparent text-slate-600 hover:text-slate-950 hover:border-slate-300"
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold tabular-nums ${
                          isActive
                            ? "bg-blue-100 text-blue-900"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Nội dung chính: Skeleton khi đang tải lần đầu, hoặc WeekGrid / ScheduleList */}
          {loading && scheduleItems.length === 0 ? (
            <div aria-busy="true" className="space-y-3">
              <div className="h-12 w-full rounded-xl bg-slate-200/70 animate-pulse" />
              {[1, 2, 3, 4].map((k) => (
                <div
                  key={k}
                  className="h-20 w-full rounded-xl border border-slate-200 bg-white p-4 animate-pulse flex items-center justify-between"
                >
                  <div className="space-y-2 w-2/3">
                    <div className="h-4 w-1/2 rounded bg-slate-200" />
                    <div className="h-3 w-1/3 rounded bg-slate-100" />
                  </div>
                  <div className="h-6 w-20 rounded-full bg-slate-200" />
                </div>
              ))}
            </div>
          ) : viewMode === "week" ? (
            <WeekGrid
              weekRange={selectedWeekRange}
              weekItems={weekItems}
              timeSlots={timeSlots}
              holidays={holidays}
              todayIso={todayIso}
              onSelectSession={setDetailSession}
              nextAvailableMondayIso={nextAvailableMondayIso}
              onJumpToWeek={(mondayIso) => setAnchorDateIso(mondayIso)}
              language={language}
              t={t}
              tr={tr}
            />
          ) : (
            <ScheduleList
              items={listItems}
              dayGroups={listDayGroups}
              todayIso={todayIso}
              statusTab={statusTab}
              onSelectSession={setDetailSession}
              language={language}
              t={t}
              tr={tr}
            />
          )}
        </div>

        {/* CỘT PHẢI (320px trên Desktop): Buổi tiếp theo + Gói của tôi + Nghỉ lễ 30 ngày */}
        <aside className="space-y-4">
          {/* Desktop: NextSessionCard */}
          <div className="hidden lg:block">
            <NextSessionCard
              nextItem={nextUpcomingItem}
              todayIso={todayIso}
              nowMs={nowMs}
              onSelectSession={setDetailSession}
              onOpenAbsenceModal={handleOpenAbsenceModal}
              language={language}
              t={t}
              tr={tr}
            />
          </div>

          {/* Desktop: Hiển thị đầy đủ Gói của tôi & Nghỉ lễ */}
          <div className="hidden lg:block space-y-4">
            <PackageSummary
              packages={packageSummaries}
              onNavigateBookPt={() => navigate("/member/my-coach")}
              t={t}
              tr={tr}
            />
            <UpcomingHolidays
              next30Days={holidaysSummary.next30Days}
              allUpcoming={holidaysSummary.allUpcoming}
              t={t}
            />
          </div>

          {/* Mobile: Gói của tôi & Nghỉ lễ ở cuối trang dạng thu gọn / bấm mở rộng */}
          <div className="lg:hidden space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setMobilePackagesOpen((prev) => !prev)}
                aria-expanded={mobilePackagesOpen}
                className="w-full min-h-[44px] px-4 py-3 flex items-center justify-between text-[14px] font-extrabold text-slate-900 cursor-pointer"
              >
                <span>
                  {t("memberSchedMyPackagesHeader")} ({packageSummaries.length})
                </span>
                {mobilePackagesOpen ? (
                  <ChevronUp className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                )}
              </button>
              {mobilePackagesOpen && (
                <div className="border-t border-slate-100 p-3">
                  <PackageSummary
                    packages={packageSummaries}
                    onNavigateBookPt={() => navigate("/member/my-coach")}
                    t={t}
                    tr={tr}
                  />
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setMobileHolidaysOpen((prev) => !prev)}
                aria-expanded={mobileHolidaysOpen}
                className="w-full min-h-[44px] px-4 py-3 flex items-center justify-between text-[14px] font-extrabold text-slate-900 cursor-pointer"
              >
                <span>
                  {t("memberSchedHolidays30Header")} (
                  {holidaysSummary.next30Days.length})
                </span>
                {mobileHolidaysOpen ? (
                  <ChevronUp className="h-4 w-4 text-slate-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                )}
              </button>
              {mobileHolidaysOpen && (
                <div className="border-t border-slate-100 p-3">
                  <UpcomingHolidays
                    next30Days={holidaysSummary.next30Days}
                    allUpcoming={holidaysSummary.allUpcoming}
                    t={t}
                  />
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Ngăn chi tiết buổi học (SessionDrawer) */}
      <SessionDrawer
        item={detailSession}
        onClose={() => setDetailSession(null)}
        onOpenAbsenceModal={handleOpenAbsenceModal}
        onRequestCancelPt={handleRequestCancelPt}
        onNavigateProgress={() => navigate("/member/progress")}
        onNavigateCoach={() => navigate("/member/my-coach")}
        onNavigateFacilities={() => navigate("/facilities")}
        language={language}
        t={t}
        tr={tr}
      />

      {/* Modal Báo vắng (dành cho buổi PT 1:1) */}
      <SessionAbsenceModal
        selectedSession={selectedSessionForAbsence}
        onClose={() => setSelectedSessionForAbsence(null)}
        absenceReason={absenceReason}
        onChangeAbsenceReason={setAbsenceReason}
        onSubmitAbsence={handleSubmitAbsence}
        submittingAbsence={submittingAbsence}
        absenceNotices={absenceNoticesList}
        loadingNotices={loadingNotices}
        privateSessionsList={ptSessionsForModal}
        onSelectDifferentSession={handleOpenAbsenceModal}
        t={t}
        tr={tr}
      />

      {/* Hộp xác nhận hủy lịch PT 1:1 */}
      {ptCancelConfirmTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("schedulePtCancelConfirmTitle")}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-[16px] font-extrabold text-slate-900">
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

            <div className="space-y-2 text-[13px] text-slate-700">
              <p className="font-bold text-slate-900">
                {ptCancelConfirmTarget.session.className ||
                  t("schedulePtDefaultTitle")}{" "}
                ·{" "}
                {toDdMmYyyy(ptCancelConfirmTarget.session.sessionDate) || "—"} (
                {ptCancelConfirmTarget.session.startTime}–
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
                className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-[13px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {t("scheduleAbsenceClose")}
              </button>
              <button
                type="button"
                disabled={
                  cancellingSessionId === ptCancelConfirmTarget.session.id
                }
                onClick={handleConfirmCancelPrivate}
                className="min-h-[38px] rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 px-4 py-1.5 text-[13px] font-bold text-white cursor-pointer"
              >
                {cancellingSessionId === ptCancelConfirmTarget.session.id
                  ? t("schedulePtBtnCancelling")
                  : t("schedulePtCancelConfirmBtn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
