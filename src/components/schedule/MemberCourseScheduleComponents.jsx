import React from "react"
import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  CreditCard,
  History,
  Info,
  MapPin,
  UserRound,
  X,
} from "lucide-react"
import {
  ABSENCE_MIN_HOURS_BEFORE,
  canReportAbsenceForNormalSession,
  diffCalendarDaysInVn,
  formatLocalTime,
  getCourseLifecycleBadge,
  getSessionStatusBadgeMeta,
  toDateDdMm,
  toDateDdMmYyyy,
  toDateTimeDdMmYyyy,
  translatePaymentStatus,
} from "../../utils/memberScheduleUtils"

/**
 * Khối "Buổi tiếp theo" dùng chung trên Card khóa học và ở đầu Tab "Lịch học"
 */
export function NextSessionSpotlightBox({
  session,
  lifecycleStatus = "in_progress",
  todayIso,
  t,
  tr,
  showCourseName = false,
}) {
  if (!session) return null

  const daysUntilNext = diffCalendarDaysInVn(todayIso, session.sessionDate)
  const courseTitle = session.className || session.subjectName || null

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-blue-900">
          {t("scheduleNextSessionTitle")}
        </span>
        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-900">
          {daysUntilNext === 0 || session.displayStatus === "ongoing"
            ? t("scheduleTodayBadge")
            : lifecycleStatus === "not_started"
              ? tr("scheduleStartsInDaysBadge", {
                  days: Math.max(1, daysUntilNext ?? 1),
                })
              : tr("scheduleInDaysBadge", {
                  days: Math.max(1, daysUntilNext ?? 1),
                })}
        </span>
      </div>
      {showCourseName && courseTitle && (
        <p className="text-xs font-extrabold text-slate-900">{courseTitle}</p>
      )}
      <p className="text-xs font-bold text-slate-900">
        {toDateDdMmYyyy(session.sessionDate)} · {session.startTime}–
        {session.endTime} · {session.roomName || t("scheduleRoomTbd")}
      </p>
    </div>
  )
}

/**
 * Dòng buổi học dùng chung trên Card khóa học ("Lịch gần đây và sắp tới") và Tab "Lịch học"
 */
export function ScheduleSessionRow({
  session,
  onSelectSession,
  showMakeupOrigin = false,
  showNextBadge = false,
  t,
  tr,
}) {
  const badge = getSessionStatusBadgeMeta(session.displayStatus, t)
  const isCancelled = session.displayStatus === "cancelled"
  const dateFormatted = toDateDdMmYyyy(session.sessionDate) || "—"
  const roomLabel = session.roomName || t("scheduleRoomTbd")

  return (
    <button
      type="button"
      onClick={() => onSelectSession?.(session)}
      className={`w-full min-h-[40px] text-left rounded-lg border px-3 py-2 text-xs transition-colors flex flex-wrap items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer ${
        isCancelled
          ? "bg-slate-50/70 border-slate-200 text-slate-400"
          : "bg-slate-50 hover:bg-slate-100/80 border-slate-200/80 text-slate-800"
      }`}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`font-medium ${
              isCancelled ? "line-through text-slate-400" : "text-slate-800"
            }`}
          >
            {dateFormatted} · {session.startTime}–{session.endTime} ·{" "}
            {roomLabel}
          </span>

          {showNextBadge && session.isNextSession && (
            <span className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-800 border border-blue-200">
              {t("scheduleNextSessionBadge")}
            </span>
          )}

          {session.isMakeup && (
            <span className="inline-flex items-center rounded bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-800 border border-indigo-200">
              {t("scheduleMakeupBadge")}
            </span>
          )}
        </div>

        {showMakeupOrigin && session.isMakeup && session.makeupTargetDate && (
          <div className="text-xs font-semibold text-indigo-700">
            {tr("scheduleMakeupForDate", {
              date: session.makeupTargetDate,
            })}
          </div>
        )}

        {isCancelled && (
          <div className="text-xs font-semibold text-slate-600">
            {session.replacedByDate
              ? tr("scheduleReplacedByDate", { date: session.replacedByDate })
              : t("scheduleWaitingMakeup")}
          </div>
        )}

        {session.hasHolidayConflict && (
          <div className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-700" />
            <span>
              {tr("scheduleHolidayConflictWarning", {
                date: toDateDdMm(session.sessionDate) || dateFormatted,
              })}
            </span>
          </div>
        )}
      </div>

      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold shrink-0 ${badge.className}`}
      >
        <span aria-hidden="true">{badge.icon}</span>
        <span>{badge.label}</span>
      </span>
    </button>
  )
}

/**
 * Card khóa học đã đăng ký dùng chung (không sao chép logic/UI ở nhiều nơi)
 */
export function MemberCourseCard({
  course,
  isSingleCourseLayout = false,
  todayIso,
  onSelectSession,
  onViewAllSessions,
  t,
  tr,
}) {
  const lifecycleBadge = getCourseLifecycleBadge(course.lifecycleStatus, t)
  const nextSess = course.nextValidSession

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4">
      <div
        className={
          isSingleCourseLayout
            ? "grid gap-6 grid-cols-1 min-[900px]:grid-cols-2 items-start"
            : "space-y-4"
        }
      >
        {/* Cột bên trái (hoặc khối trên): thông tin khóa học, tiến độ, dòng bù, buổi tiếp theo */}
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wide text-brand-accent-dark">
                {course.subjectName || "VIBE SPORT"}
              </span>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-bold shrink-0 ${lifecycleBadge.className}`}
              >
                {lifecycleBadge.label}
              </span>
            </div>

            <h2 className="text-lg font-extrabold text-slate-900">
              {course.className || `#${course.classId}`}
            </h2>
          </div>

          {/* Thông tin có nhãn: Khai giảng, Lịch cố định, HLV, Sân, Thanh toán (nếu API có trả về) */}
          <dl className="grid gap-2 text-xs text-slate-700">
            <div className="flex items-start justify-between gap-2">
              <dt className="inline-flex items-center gap-1.5 font-semibold text-slate-500">
                <CalendarDays className="h-4 w-4 text-slate-400 shrink-0" />
                <span>{t("scheduleLabelStartDate")}:</span>
              </dt>
              <dd className="font-bold text-slate-900 text-right">
                {course.startDateFormatted || t("scheduleValueTbd")}
              </dd>
            </div>

            <div className="flex items-start justify-between gap-2">
              <dt className="inline-flex items-center gap-1.5 font-semibold text-slate-500">
                <Clock3 className="h-4 w-4 text-slate-400 shrink-0" />
                <span>{t("scheduleLabelFixedSchedule")}:</span>
              </dt>
              <dd className="font-semibold text-slate-800 text-right">
                {course.fixedScheduleLabel || t("scheduleValueTbd")}
              </dd>
            </div>

            <div className="flex items-start justify-between gap-2">
              <dt className="inline-flex items-center gap-1.5 font-semibold text-slate-500">
                <UserRound className="h-4 w-4 text-slate-400 shrink-0" />
                <span>{t("scheduleLabelCoach")}:</span>
              </dt>
              <dd className="font-semibold text-slate-800 text-right">
                {course.primaryCoach || t("scheduleCoachTbd")}
              </dd>
            </div>

            {course.primaryRoom && (
              <div className="flex items-start justify-between gap-2">
                <dt className="inline-flex items-center gap-1.5 font-semibold text-slate-500">
                  <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>{t("scheduleLabelRoom")}:</span>
                </dt>
                <dd className="font-semibold text-slate-800 text-right">
                  {course.primaryRoom}
                </dd>
              </div>
            )}

            {course.paymentStatus && (
              <div className="flex items-start justify-between gap-2">
                <dt className="inline-flex items-center gap-1.5 font-semibold text-slate-500">
                  <CreditCard className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>{t("schedulePaymentStatusLabel")}</span>
                </dt>
                <dd className="font-semibold text-slate-800 text-right">
                  {translatePaymentStatus(course.paymentStatus, t)}
                </dd>
              </div>
            )}
          </dl>

          {/* Thanh tiến độ kèm chữ "X/12 buổi" */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span>{t("trainingProgress")}</span>
              <span>
                {tr("scheduleProgressLabel", {
                  completed: course.completedCount,
                  required: course.requiredSessions,
                })}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={course.completedCount}
              aria-valuemin={0}
              aria-valuemax={course.requiredSessions}
              aria-label={tr("scheduleProgressAria", {
                completed: course.completedCount,
                required: course.requiredSessions,
              })}
              className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/80"
            >
              <div
                className="h-full rounded-full bg-brand-primary transition-all duration-300"
                style={{ width: `${course.progressPercent}%` }}
              />
            </div>

            {/* Dòng nhỏ dưới thanh tiến độ khi khóa có buổi hủy đã được bù */}
            {course.replacedCancelledCount > 0 && (
              <p className="text-xs font-medium text-slate-600 pt-0.5">
                {tr("scheduleReplacedSummary", {
                  count: course.replacedCancelledCount,
                  dates: course.replacedMakeupDates.join(", "),
                })}
              </p>
            )}
          </div>

          {/* Dòng chờ bù (chỉ khi số buổi chờ bù > 0) */}
          {course.pendingMakeupCount > 0 && (
            <div
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950 flex items-center gap-2"
            >
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
              <span>
                {tr("schedulePendingMakeupNotice", {
                  count: course.pendingMakeupCount,
                })}
              </span>
            </div>
          )}

          {/* Khối "Buổi tiếp theo" */}
          <NextSessionSpotlightBox
            session={nextSess}
            lifecycleStatus={course.lifecycleStatus}
            todayIso={todayIso}
            t={t}
            tr={tr}
          />
        </div>

        {/* Cột bên phải (hoặc khối dưới): "Lịch gần đây và sắp tới" và ghi chú */}
        <div
          className={
            isSingleCourseLayout
              ? "space-y-4 border-t border-slate-100 pt-4 min-[900px]:border-t-0 min-[900px]:border-l min-[900px]:border-slate-100 min-[900px]:pt-0 min-[900px]:pl-6"
              : "space-y-4"
          }
        >
          {course.previewSessions.length > 0 && (
            <div
              className={
                isSingleCourseLayout
                  ? "space-y-2"
                  : "space-y-2 border-t border-slate-100 pt-3"
              }
            >
              <div className="text-xs font-bold text-slate-700">
                {t("scheduleUpcomingListTitle")}
              </div>
              <div className="space-y-1.5">
                {course.previewSessions.map((session) => (
                  <ScheduleSessionRow
                    key={
                      session.id ||
                      `${session.sessionDate}-${session.startTime}`
                    }
                    session={session}
                    onSelectSession={onSelectSession}
                    showMakeupOrigin={false}
                    showNextBadge={false}
                    t={t}
                    tr={tr}
                  />
                ))}
              </div>
            </div>
          )}

          <p className="flex items-start gap-1.5 text-xs text-slate-500 leading-relaxed pt-1">
            <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>
              {tr("scheduleFixedCourseNote", {
                required: course.requiredSessions,
              })}
            </span>
          </p>
        </div>
      </div>

      {/* Footer card: nút "Xem tất cả N buổi" */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
        <button
          type="button"
          onClick={() => onViewAllSessions?.(course)}
          className="w-full sm:w-auto min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 px-3.5 py-2 text-xs font-bold text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span>
            {tr("scheduleBtnViewAllSessions", {
              count: course.requiredSessions,
            })}
          </span>
        </button>
      </div>
    </article>
  )
}

/**
 * Ngăn chi tiết buổi học (Drawer) dùng chung
 */
export function SessionDetailDrawer({
  detailSession,
  onClose,
  onOpenAbsenceModal,
  t,
  tr,
}) {
  if (!detailSession) return null
  const badge = getSessionStatusBadgeMeta(detailSession.displayStatus, t)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("scheduleDrawerTitle")}
      className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60"
    >
      <div className="h-full w-full max-w-md bg-white p-6 shadow-2xl flex flex-col justify-between overflow-y-auto">
        <div className="space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h3 className="text-base font-extrabold text-slate-900">
              {t("scheduleDrawerTitle")}
            </h3>
            <button
              type="button"
              aria-label={t("scheduleAbsenceClose")}
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <dl className="space-y-3 text-xs">
            <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
              <dt className="font-semibold text-slate-500">
                {t("scheduleDrawerCourse")}
              </dt>
              <dd className="font-bold text-slate-900 text-right">
                {detailSession.className || detailSession.subjectName || "—"}
              </dd>
            </div>

            <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
              <dt className="font-semibold text-slate-500">
                {t("scheduleDrawerDate")}
              </dt>
              <dd className="font-bold text-slate-900">
                {toDateDdMmYyyy(detailSession.sessionDate) || "—"}
              </dd>
            </div>

            <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
              <dt className="font-semibold text-slate-500">
                {t("scheduleDrawerTime")}
              </dt>
              <dd className="font-bold text-slate-900">
                {detailSession.startTime}–{detailSession.endTime}
              </dd>
            </div>

            <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
              <dt className="font-semibold text-slate-500">
                {t("scheduleDrawerRoom")}
              </dt>
              <dd className="font-semibold text-slate-800">
                {detailSession.roomName || t("scheduleRoomTbd")}
              </dd>
            </div>

            <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
              <dt className="font-semibold text-slate-500">
                {t("scheduleDrawerCoach")}
              </dt>
              <dd className="font-semibold text-slate-800">
                {detailSession.coachName || t("scheduleCoachTbd")}
              </dd>
            </div>

            <div className="flex justify-between items-center gap-3 py-1.5 border-b border-slate-100">
              <dt className="font-semibold text-slate-500">
                {t("scheduleDrawerStatus")}
              </dt>
              <dd>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${badge.className}`}
                >
                  <span aria-hidden="true">{badge.icon}</span>
                  <span>{badge.label}</span>
                </span>
              </dd>
            </div>

            {(detailSession.isMakeup ||
              detailSession.displayStatus === "cancelled") && (
              <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                <dt className="font-semibold text-slate-500">
                  {t("scheduleDrawerMakeupInfo")}
                </dt>
                <dd className="font-bold text-indigo-800 text-right">
                  {detailSession.isMakeup
                    ? detailSession.makeupTargetDate
                      ? tr("scheduleMakeupForDate", {
                          date: detailSession.makeupTargetDate,
                        })
                      : t("scheduleMakeupBadge")
                    : detailSession.replacedByDate
                      ? tr("scheduleReplacedByDate", {
                          date: detailSession.replacedByDate,
                        })
                      : t("scheduleWaitingMakeup")}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Hành động trong Drawer: Báo vắng */}
        <div className="border-t border-slate-200 pt-4">
          <button
            type="button"
            disabled={!canReportAbsenceForNormalSession(detailSession)}
            onClick={() => onOpenAbsenceModal?.(detailSession)}
            title={tr("scheduleAbsenceCutoffHint", {
              hours: ABSENCE_MIN_HOURS_BEFORE,
            })}
            className="w-full min-h-[40px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-xs font-bold text-slate-800 cursor-pointer"
          >
            {t("scheduleBtnReportAbsence")}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Hộp thoại Báo vắng & Lịch sử báo vắng dùng chung
 */
export function SessionAbsenceModal({
  selectedSession,
  onClose,
  absenceReason,
  onChangeAbsenceReason,
  onSubmitAbsence,
  submittingAbsence,
  absenceNotices = [],
  loadingNotices = false,
  privateSessionsList = [],
  onSelectDifferentSession,
  t,
  tr,
}) {
  if (!selectedSession) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              {t("scheduleAbsenceModalTitle")}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedSession.className ||
                selectedSession.subjectName ||
                t("schedulePtDefaultTitle")}{" "}
              · {toDateDdMmYyyy(selectedSession.sessionDate)} (
              {formatLocalTime(selectedSession.startTime)}–
              {formatLocalTime(selectedSession.endTime)})
            </p>
          </div>
          <button
            type="button"
            aria-label={t("scheduleAbsenceClose")}
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {selectedSession.isPrivate && privateSessionsList.length > 1 && (
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t("scheduleAbsenceSelectSessionLabel")}
            </label>
            <select
              value={selectedSession.id || ""}
              onChange={(e) => {
                const nextPt = privateSessionsList.find(
                  (s) => String(s.id) === String(e.target.value),
                )
                if (nextPt) onSelectDifferentSession?.(nextPt)
              }}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-brand-accent focus:bg-white focus:outline-none"
            >
              {privateSessionsList.map((pt) => (
                <option key={pt.id} value={pt.id}>
                  {toDateDdMmYyyy(pt.sessionDate)} · {pt.startTime}–{pt.endTime}{" "}
                  ·{" "}
                  {pt.subjectName ||
                    pt.className ||
                    t("schedulePtDefaultTitle")}
                </option>
              ))}
            </select>
          </div>
        )}

        <form onSubmit={onSubmitAbsence} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t("scheduleAbsenceReasonLabel")}
            </label>
            <textarea
              rows={3}
              value={absenceReason}
              onChange={(e) => onChangeAbsenceReason?.(e.target.value)}
              placeholder={t("scheduleAbsenceReasonPlaceholder")}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-xs text-slate-900 focus:border-brand-accent focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              {t("scheduleAbsenceClose")}
            </button>
            <button
              type="submit"
              disabled={submittingAbsence}
              className="min-h-[40px] rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 px-4 py-1.5 text-xs font-bold text-white cursor-pointer"
            >
              {submittingAbsence
                ? t("scheduleAbsenceSubmitting")
                : t("scheduleAbsenceSubmit")}
            </button>
          </div>
        </form>

        {/* Lịch sử báo vắng từ GET /api/sessions/{sessionId}/absence-notices */}
        <div className="border-t border-slate-200 pt-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <History className="h-3.5 w-3.5 text-slate-500" />
            <span>
              {tr("scheduleAbsenceHistoryTitle", {
                count: absenceNotices.length,
              })}
            </span>
          </div>

          {loadingNotices ? (
            <p className="text-xs text-slate-500">
              {t("scheduleAbsenceHistoryLoading")}
            </p>
          ) : absenceNotices.length === 0 ? (
            <p className="text-xs text-slate-500">
              {t("scheduleAbsenceHistoryEmpty")}
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
                      {notice.reason || t("scheduleBtnReportAbsence")}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {toDateTimeDdMmYyyy(notice.reportedAt)}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold ${
                      notice.active !== false
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {notice.active !== false
                      ? t("scheduleAbsenceActive")
                      : t("scheduleAbsenceSuperseded")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
