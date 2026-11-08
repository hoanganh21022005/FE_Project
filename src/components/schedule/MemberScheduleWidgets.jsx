import React, { useState, useRef } from "react"
import {
  Ban,
  Bell,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  ExternalLink,
  HelpCircle,
  Info,
  LayoutGrid,
  List,
  MapPin,
  Package,
  Radio,
  User,
  UserRound,
  X,
  XCircle,
} from "lucide-react"
import {
  ABSENCE_MIN_HOURS_BEFORE,
  addDaysIso,
  diffDaysVn,
  getVnTodayIso,
  getWeekdayMeta,
  toDdMm,
  toDdMmYyyy,
} from "../../utils/scheduleModel"

/**
 * 4.3 Bảng màu & nhãn trạng thái chuẩn (luôn kèm icon + chữ)
 */
export function getStatusVisualMeta(item, t) {
  const uiState = item?.uiState || "upcoming"
  switch (uiState) {
    case "ongoing":
      return {
        Icon: Radio,
        label: t("memberSchedStatusOngoing"),
        badgeClass: "bg-blue-100 text-blue-900 border-blue-500 font-bold",
        cellClass: "bg-blue-50/90 border-blue-500 ring-1 ring-blue-400 text-slate-900",
        titleStrike: false,
      }
    case "completed_present":
      return {
        Icon: CheckCircle2,
        label: t("memberSchedStatusDonePresent"),
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-300",
        cellClass: "bg-emerald-50/60 border-emerald-200 text-slate-900",
        titleStrike: false,
      }
    case "completed_absent":
      return {
        Icon: XCircle,
        label: t("memberSchedStatusDoneAbsent"),
        badgeClass: "bg-rose-50 text-rose-800 border-rose-300",
        cellClass: "bg-rose-50/60 border-rose-200 text-slate-900",
        titleStrike: false,
      }
    case "upcoming_absence_reported":
      return {
        Icon: Bell,
        label: t("memberSchedStatusAbsenceReported"),
        badgeClass: "bg-amber-50 text-amber-900 border-amber-300",
        cellClass: "bg-amber-50/60 border-amber-300 text-slate-900",
        titleStrike: false,
      }
    case "cancelled":
      return {
        Icon: Ban,
        label: t("memberSchedStatusCancelled"),
        badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
        cellClass: "bg-slate-100/80 border-slate-200 text-slate-500",
        titleStrike: true,
      }
    case "pending_update":
      return {
        Icon: Clock,
        label: t("memberSchedStatusPendingUpdate"),
        badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
        cellClass: "bg-slate-50 border-slate-200 text-slate-800",
        titleStrike: false,
      }
    case "upcoming":
    default:
      return {
        Icon: Clock,
        label: t("memberSchedStatusScheduled"),
        badgeClass: "bg-sky-50 text-sky-900 border-sky-200",
        cellClass: "bg-sky-50/50 border-sky-200 text-slate-900",
        titleStrike: false,
      }
  }
}

export function StatusBadge({ item, t, compact = false }) {
  const meta = getStatusVisualMeta(item, t)
  const Icon = meta.Icon
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold shrink-0 ${
        compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-0.5 text-[13px]"
      } ${meta.badgeClass}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  )
}

export function ViewToggle({ viewMode, onChangeViewMode, t }) {
  return (
    <div
      role="group"
      aria-label={t("memberSchedTitle")}
      className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-1"
    >
      <button
        type="button"
        onClick={() => onChangeViewMode("week")}
        className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-bold transition-colors cursor-pointer ${
          viewMode === "week"
            ? "bg-white text-slate-900 shadow-2xs"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t("memberSchedViewWeek")}</span>
      </button>
      <button
        type="button"
        onClick={() => onChangeViewMode("list")}
        className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-bold transition-colors cursor-pointer ${
          viewMode === "list"
            ? "bg-white text-slate-900 shadow-2xs"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <List className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{t("memberSchedViewList")}</span>
      </button>
    </div>
  )
}

export function WeekNavigator({
  weekRange,
  isCurrentWeek,
  onPrevWeek,
  onNextWeek,
  onThisWeek,
  onPickDate,
  t,
}) {
  const dateInputRef = useRef(null)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white shadow-2xs">
        <button
          type="button"
          onClick={onPrevWeek}
          aria-label={t("memberSchedPrevWeekAria")}
          className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-l-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              if (dateInputRef.current?.showPicker) {
                dateInputRef.current.showPicker()
              } else {
                dateInputRef.current?.focus()
              }
            }}
            aria-label={t("memberSchedPickWeekAria")}
            className="min-h-[40px] inline-flex items-center gap-2 border-x border-slate-200 px-3.5 py-1.5 text-[14px] font-bold text-slate-900 hover:bg-slate-50 cursor-pointer"
          >
            <Calendar className="h-4 w-4 text-slate-500 shrink-0" />
            <span>{weekRange.label}</span>
          </button>
          <input
            ref={dateInputRef}
            type="date"
            value={weekRange.mondayIso}
            onChange={(e) => {
              if (e.target.value) onPickDate(e.target.value)
            }}
            aria-label={t("memberSchedPickWeekAria")}
            className="sr-only"
          />
        </div>

        <button
          type="button"
          onClick={onNextWeek}
          aria-label={t("memberSchedNextWeekAria")}
          className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-r-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={onThisWeek}
        disabled={isCurrentWeek}
        className={`min-h-[40px] rounded-lg border px-3 py-1.5 text-[13px] font-bold transition-colors cursor-pointer ${
          isCurrentWeek
            ? "border-slate-200 bg-slate-100 text-slate-400 cursor-default"
            : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
        }`}
      >
        {t("memberSchedThisWeek")}
      </button>
    </div>
  )
}

export function ScheduleLegend({ t, isOpen, onToggle }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
      >
        <span>{t("memberSchedLegendToggle")}</span>
        {isOpen ? (
          <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
        )}
      </button>

      {isOpen && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3.5 shadow-md text-[13px] flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 font-semibold text-sky-900">
            <Clock className="h-3.5 w-3.5" />
            {t("memberSchedStatusScheduled")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500 bg-blue-100 px-2.5 py-0.5 font-bold text-blue-900">
            <Radio className="h-3.5 w-3.5" />
            {t("memberSchedStatusOngoing")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("memberSchedStatusDonePresent")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-0.5 font-semibold text-rose-800">
            <XCircle className="h-3.5 w-3.5" />
            {t("memberSchedStatusDoneAbsent")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-900">
            <Bell className="h-3.5 w-3.5" />
            {t("memberSchedStatusAbsenceReported")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-700">
            <Ban className="h-3.5 w-3.5" />
            {t("memberSchedStatusCancelled")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border-l-4 border-l-indigo-600 border border-slate-200 bg-indigo-50/60 px-2.5 py-0.5 font-bold text-indigo-900">
            <User className="h-3.5 w-3.5" />
            {t("memberSchedPtBadge")}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * 4.4 SessionCell (thẻ gọn trong ô lưới tuần — P0 1.1: tối đa 2 dòng tên lớp, icon góc phải, tooltip đầy đủ)
 */
export function SessionCell({ item, onSelect, language, t }) {
  const meta = getStatusVisualMeta(item, t)
  const Icon = meta.Icon
  const wk = getWeekdayMeta(item.date)
  const weekdayLabel = language === "vi" ? wk.fullVi : wk.fullEn
  const roomText = item.roomName || t("scheduleRoomTbd")
  const coachText = item.coachName || t("scheduleCoachTbd")
  const ariaLabel = `${item.className}, ${weekdayLabel} ${toDdMm(item.date)}, ${item.startTime}–${item.endTime}, ${meta.label}`
  const tooltipText = [
    item.className,
    `${t("scheduleDrawerTime")}: ${item.startTime}–${item.endTime}`,
    `${t("scheduleDrawerRoom")}: ${roomText}`,
    `${t("scheduleDrawerCoach")}: ${coachText}`,
    `${t("scheduleDrawerStatus")}: ${meta.label}`,
  ].join("\n")

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      aria-label={ariaLabel}
      title={tooltipText}
      className={`w-full text-left rounded-md border p-1.5 transition-all hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer space-y-0.5 ${
        meta.cellClass
      } ${
        item.kind === "pt"
          ? "border-l-[3px] border-l-indigo-600"
          : "border-l-[3px] border-l-sky-600"
      }`}
    >
      {/* Dòng 1: Giờ (cỡ nhỏ gọn) + Icon trạng thái ở góc phải */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-bold tracking-tight text-slate-700 tabular-nums">
          {item.startTime}–{item.endTime}
        </span>
        <span
          title={meta.label}
          className="inline-flex items-center justify-center shrink-0"
        >
          <Icon
            className={`h-3.5 w-3.5 ${
              item.uiState === "completed_present"
                ? "text-emerald-700"
                : item.uiState === "completed_absent"
                  ? "text-rose-600"
                  : item.uiState === "upcoming_absence_reported"
                    ? "text-amber-700"
                    : item.uiState === "cancelled"
                      ? "text-slate-500"
                      : "text-sky-700"
            }`}
            aria-hidden="true"
          />
        </span>
      </div>

      {/* Dòng 2: Tên lớp (tối đa 2 dòng line-clamp-2 thay vì cắt 1 dòng) */}
      <p
        className={`text-[12px] font-bold leading-snug line-clamp-2 break-words ${
          meta.titleStrike ? "line-through text-slate-500" : "text-slate-900"
        }`}
      >
        {item.className}
      </p>

      {/* Dòng 3: Sân (1 dòng, cắt nếu dài) */}
      <p className="text-[11px] font-medium text-slate-700 truncate">
        {roomText}
      </p>
    </button>
  )
}

/**
 * 4.4 WeekGrid (Lưới Thứ × Ca: 7 cột đều nhau grid-cols-[64px_repeat(7,minmax(0,1fr))], bỏ cuộn ngang desktop)
 */
export function WeekGrid({
  weekRange,
  weekItems,
  timeSlots,
  holidays,
  todayIso,
  onSelectSession,
  nextAvailableMondayIso,
  onJumpToWeek,
  language,
  t,
  tr,
}) {
  const [showAllSlots, setShowAllSlots] = useState(false)

  // Map holiday by dateIso
  const holidayByDate = new Map()
  for (const h of Array.isArray(holidays) ? holidays : []) {
    if (h && h.active !== false && h.holidayDate) {
      holidayByDate.set(
        String(h.holidayDate).slice(0, 10),
        String(h.holidayName || t("scheduleHolidayDefaultName"))
          .replace(/\s*[-–—(]?\s*\b20\d{2}\b\s*\)?$/g, "")
          .trim(),
      )
    }
  }

  // Group weekItems by (slotNumber, dateIso)
  const cellMap = new Map()
  const activeSlotNumbers = new Set()
  let hasOtherSlot = false

  for (const item of weekItems) {
    const slotKey = item.slotNumber ?? "other"
    if (slotKey === "other") {
      hasOtherSlot = true
    } else {
      activeSlotNumbers.add(Number(slotKey))
    }
    const mapKey = `${slotKey}__${item.date}`
    if (!cellMap.has(mapKey)) cellMap.set(mapKey, [])
    cellMap.get(mapKey).push(item)
  }

  const visibleStandardSlots = showAllSlots
    ? timeSlots
    : timeSlots.filter((s) => activeSlotNumbers.has(Number(s.slotNumber)))

  const rows = [
    ...visibleStandardSlots.map((s) => ({
      key: s.slotNumber,
      title: tr("memberSchedSlotPrefix", { num: s.slotNumber }),
      subtitle: `${s.startTime}–${s.endTime}`,
    })),
    ...(hasOtherSlot
      ? [
          {
            key: "other",
            title: t("memberSchedOtherSlot"),
            subtitle: t("memberSchedOtherSlotSub"),
          },
        ]
      : []),
  ]

  if (weekItems.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center space-y-3">
        <CalendarDays className="mx-auto h-9 w-9 text-slate-400" />
        <div className="space-y-1">
          <h3 className="text-[16px] font-bold text-slate-900">
            {t("memberSchedEmptyWeekTitle")}
          </h3>
          <p className="text-[13px] text-slate-600">
            {t("memberSchedEmptyWeekSub")}
          </p>
        </div>
        {nextAvailableMondayIso && (
          <button
            type="button"
            onClick={() => onJumpToWeek(nextAvailableMondayIso)}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-[13px] font-bold text-white hover:bg-slate-800 cursor-pointer"
          >
            <Calendar className="h-4 w-4" />
            <span>{t("memberSchedJumpNextWeekBtn")}</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      <div className="overflow-x-auto md:overflow-x-visible rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="min-w-[640px] md:min-w-0">
          {/* Header Row: 64px + 7 cột đều nhau */}
          <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-slate-200 bg-slate-50/90">
            <div className="border-r border-slate-200 p-2 text-left text-[12px] font-bold text-slate-700 flex items-center">
              Ca / Giờ
            </div>
            {weekRange.days.map((day) => {
              const isToday = day.dateIso === todayIso
              const holidayName = holidayByDate.get(day.dateIso)
              const wkShort = language === "vi" ? day.shortVi : day.shortEn
              return (
                <div
                  key={day.dateIso}
                  className={`border-r last:border-r-0 border-slate-200 px-1.5 py-2 text-center ${
                    isToday
                      ? "bg-blue-50 text-blue-950 border-t-2 border-t-blue-600"
                      : holidayName
                        ? "bg-amber-50/60 text-slate-800"
                        : "text-slate-800"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-center gap-1">
                    <span className="text-[12px] font-extrabold">{wkShort}</span>
                    <span
                      className={`text-[12px] font-bold px-1.5 py-0.5 rounded tabular-nums ${
                        isToday ? "bg-blue-700 text-white" : "text-slate-700"
                      }`}
                    >
                      {day.ddMm}
                    </span>
                  </div>
                  {holidayName && (
                    <div
                      title={holidayName}
                      className="mt-1 truncate rounded bg-amber-100 px-1 py-0.5 text-[10px] font-bold text-amber-900"
                    >
                      {holidayName}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Body Rows */}
          <div className="divide-y divide-slate-200">
            {rows.map((row) => (
              <div
                key={row.key}
                className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]"
              >
                <div className="border-r border-slate-200 bg-slate-50/95 p-1.5 text-left">
                  <div className="text-[12px] font-extrabold text-slate-900">
                    {row.title}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-700 mt-0.5 leading-tight tabular-nums">
                    {row.subtitle}
                  </div>
                </div>
                {weekRange.days.map((day) => {
                  const isToday = day.dateIso === todayIso
                  const holidayName = holidayByDate.get(day.dateIso)
                  const cellItems =
                    cellMap.get(`${row.key}__${day.dateIso}`) || []
                  return (
                    <div
                      key={day.dateIso}
                      className={`border-r last:border-r-0 border-slate-200 p-1 min-h-[76px] min-w-0 ${
                        isToday
                          ? "bg-blue-50/30"
                          : holidayName
                            ? "bg-amber-50/20"
                            : "bg-white"
                      }`}
                    >
                      {cellItems.length > 0 && (
                        <div className="space-y-1">
                          {cellItems.map((item) => (
                            <SessionCell
                              key={item.id}
                              item={item}
                              onSelect={onSelectSession}
                              language={language}
                              t={t}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Nút Hiện tất cả ca / Ẩn các ca trống */}
      {timeSlots.length > activeSlotNumbers.size && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowAllSlots((prev) => !prev)}
            className="min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <span>
              {showAllSlots
                ? t("memberSchedHideEmptySlots")
                : tr("memberSchedShowAllSlots", { count: timeSlots.length })}
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * 4.5 SessionRow (P0 3.2: Ẩn pill trùng trạng thái đang lọc, hiện đếm ngược + chevron ›)
 */
export function SessionRow({
  item,
  todayIso,
  statusTab,
  onSelect,
  language,
  t,
  tr,
}) {
  const meta = getStatusVisualMeta(item, t)
  const wk = getWeekdayMeta(item.date)
  const wkShort = language === "vi" ? wk.shortVi : wk.shortEn
  const dayNum = item.date.slice(8, 10)
  const monthNum = item.date.slice(5, 7)

  const daysUntil = todayIso ? diffDaysVn(todayIso, item.date) : null
  const isRedundantPill =
    (statusTab === "upcoming" && item.uiState === "upcoming") ||
    (statusTab === "done" && item.uiState === "completed_present") ||
    (statusTab === "absent" && item.uiState === "completed_absent") ||
    (statusTab === "cancelled" && item.uiState === "cancelled")

  let rightHint = null
  if (statusTab === "upcoming" && item.uiState === "upcoming" && daysUntil != null) {
    if (daysUntil === 0) {
      rightHint = t("memberSchedMilestoneToday")
    } else if (daysUntil === 1) {
      rightHint = t("memberSchedMilestoneTomorrow")
    } else if (daysUntil > 1) {
      rightHint = tr("memberSchedCountdownDays", { days: daysUntil })
    }
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`group w-full min-h-[68px] text-left rounded-xl border px-3.5 py-2.5 transition-all hover:border-slate-300 hover:bg-slate-50/90 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer flex items-center justify-between gap-3 ${
        item.status === "Cancelled"
          ? "bg-slate-50 border-slate-200 text-slate-500"
          : "bg-white border-slate-200 text-slate-900"
      } ${
        item.kind === "pt"
          ? "border-l-4 border-l-indigo-600"
          : "border-l-4 border-l-sky-600"
      }`}
    >
      {/* Khối ngày bên trái */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200/80 flex flex-col items-center justify-center shrink-0">
          <span className="text-[11px] font-bold uppercase text-slate-700 leading-none">
            {wkShort}
          </span>
          <span className="text-[15px] font-black text-slate-900 leading-tight mt-0.5 tabular-nums">
            {dayNum}/{monthNum}
          </span>
        </div>

        {/* Nội dung chính (15-16px) & phụ (>= 13px) */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-extrabold text-slate-900 tabular-nums">
              {item.startTime}–{item.endTime}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold border ${
                item.kind === "pt"
                  ? "bg-indigo-50 text-indigo-900 border-indigo-200"
                  : "bg-sky-50 text-sky-900 border-sky-200"
              }`}
            >
              {item.kind === "pt"
                ? t("memberSchedPtBadge")
                : t("memberSchedGroupBadge")}
            </span>
            <span
              className={`text-[15px] font-bold truncate ${
                meta.titleStrike ? "line-through text-slate-500" : "text-slate-900"
              }`}
            >
              {item.className}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-700">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              {item.roomName || t("scheduleRoomTbd")}
            </span>
            {item.coachName && (
              <span className="inline-flex items-center gap-1">
                <UserRound className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                {item.coachName}
              </span>
            )}
            {item.sessionNumber && item.totalSessions && (
              <span className="font-semibold text-slate-700">
                ·{" "}
                {tr("memberSchedDrawerSessionProgress", {
                  current: item.sessionNumber,
                  total: item.totalSessions,
                })}
              </span>
            )}
            {item.status === "Cancelled" && (
              <span className="font-semibold text-slate-700">
                ·{" "}
                {item.centerInvalidated
                  ? t("memberSchedCancelReasonCenter")
                  : t("memberSchedCancelReasonDefault")}
                {item.replacedByDate
                  ? ` (${tr("scheduleReplacedByDate", { date: item.replacedByDate })})`
                  : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Vùng bên phải: thông tin đếm ngược (hoặc badge đặc biệt) + chevron › */}
      <div className="flex items-center gap-2 shrink-0">
        {item.isMakeup && (
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[12px] font-bold text-indigo-900">
            {t("scheduleMakeupBadge")}
          </span>
        )}
        {!isRedundantPill ? (
          <StatusBadge item={item} t={t} />
        ) : (
          rightHint && (
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[12px] font-bold text-slate-700 tabular-nums">
              {rightHint}
            </span>
          )
        )}
        <ChevronRight
          className="h-4 w-4 text-slate-400 group-hover:text-slate-800 group-hover:translate-x-0.5 transition-all"
          aria-hidden="true"
        />
      </div>
    </button>
  )
}

/**
 * 4.5 ScheduleList (Danh sách theo ngày & mốc thời gian, có phân trang Xem thêm)
 */
export function ScheduleList({
  items,
  dayGroups,
  todayIso,
  statusTab,
  onSelectSession,
  language,
  t,
  tr,
}) {
  const [visibleCount, setVisibleCount] = useState(12)

  const formatBucketLabel = (bucket) => {
    if (!bucket) return ""
    switch (bucket.type) {
      case "today":
        return t("memberSchedMilestoneToday")
      case "tomorrow":
        return t("memberSchedMilestoneTomorrow")
      case "this_week":
        return t("memberSchedMilestoneThisWeek")
      case "next_week":
        return t("memberSchedMilestoneNextWeek")
      case "month":
      default:
        return tr("memberSchedMilestoneMonth", {
          month: String(bucket.month).padStart(2, "0"),
          year: bucket.year,
        })
    }
  }

  const hasTodayGroup = dayGroups.some((g) => g.dateIso === todayIso)

  if (items.length === 0) {
    return (
      <div className="space-y-3">
        {statusTab === "upcoming" && !hasTodayGroup && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] font-medium text-slate-700">
            {t("memberSchedTodayNoSession")}
          </div>
        )}
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-[14px] text-slate-600">
          {t("scheduleEmptySessions")}
        </div>
      </div>
    )
  }

  // Cắt theo số buổi visibleCount để phân trang gọn, không cuộn lồng
  let renderedCount = 0
  const slicedGroups = []
  for (const g of dayGroups) {
    if (renderedCount >= visibleCount) break
    const remaining = visibleCount - renderedCount
    const slice = g.items.slice(0, remaining)
    renderedCount += slice.length
    slicedGroups.push({ ...g, items: slice })
  }

  let lastBucketKey = null

  return (
    <div className="space-y-4">
      {statusTab === "upcoming" && !hasTodayGroup && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] font-medium text-slate-700">
          {t("memberSchedTodayNoSession")}
        </div>
      )}

      {slicedGroups.map((group) => {
        const showBucketHeader = group.bucket.key !== lastBucketKey
        lastBucketKey = group.bucket.key

        return (
          <div key={group.dateIso} className="space-y-2">
            {showBucketHeader && (
              <h3 className="text-[13px] font-extrabold uppercase tracking-wider text-slate-600 pt-1">
                {formatBucketLabel(group.bucket)}
              </h3>
            )}

            {group.holidayName && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[13px] font-bold text-amber-900 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-amber-700 shrink-0" />
                <span>
                  {tr("memberSchedHolidayDivider", { name: group.holidayName })} (
                  {group.ddMmYyyy})
                </span>
              </div>
            )}

            <div className="space-y-2">
              {group.items.map((item) => (
                <SessionRow
                  key={item.id}
                  item={item}
                  todayIso={todayIso}
                  statusTab={statusTab}
                  onSelect={onSelectSession}
                  language={language}
                  t={t}
                  tr={tr}
                />
              ))}
            </div>
          </div>
        )
      })}

      {items.length > visibleCount && (
        <div className="pt-2 flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => prev + 12)}
            className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-[13px] font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
          >
            {tr("memberSchedShowMoreSessions", {
              count: items.length - visibleCount,
            })}
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * 4.7 NextSessionCard (Thẻ Buổi tiếp theo ở cột phải / đầu trang mobile)
 */
export function NextSessionCard({
  nextItem,
  todayIso,
  nowMs,
  onSelectSession,
  onOpenAbsenceModal,
  language,
  t,
  tr,
}) {
  if (!nextItem) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2">
        <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-slate-600">
          {t("memberSchedNextSessionHeader")}
        </h2>
        <p className="text-[14px] text-slate-600">
          {t("memberSchedNextSessionEmpty")}
        </p>
      </section>
    )
  }

  const wk = getWeekdayMeta(nextItem.date)
  const weekdayFull = language === "vi" ? wk.fullVi : wk.fullEn
  const daysUntil = diffDaysVn(todayIso, nextItem.date) ?? 0
  const hoursLeft =
    nextItem.startMs != null
      ? Math.max(0, Math.round((nextItem.startMs - nowMs) / (1000 * 60 * 60)))
      : null

  let countdownLabel = ""
  if (nextItem.uiState === "ongoing") {
    countdownLabel = t("memberSchedStatusOngoing")
  } else if (daysUntil === 0) {
    countdownLabel =
      hoursLeft != null && hoursLeft > 0
        ? tr("memberSchedCountdownTodayHours", { hours: hoursLeft })
        : t("memberSchedCountdownTodaySoon")
  } else {
    countdownLabel = tr("memberSchedCountdownDays", {
      days: Math.max(1, daysUntil),
    })
  }

  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 shadow-2xs space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-extrabold uppercase tracking-wider text-blue-950">
          {t("memberSchedNextSessionHeader")}
        </span>
        <span className="rounded-full bg-blue-700 px-2.5 py-0.5 text-[12px] font-bold text-white">
          {countdownLabel}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          {nextItem.kind === "pt" && (
            <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] font-bold text-indigo-900">
              {t("memberSchedPtBadge")}
            </span>
          )}
          <h3 className="text-[16px] font-extrabold text-slate-950">
            {nextItem.className}
          </h3>
        </div>
        <p className="text-[14px] font-bold text-slate-800">
          {weekdayFull}, {toDdMmYyyy(nextItem.date)} · {nextItem.startTime}–
          {nextItem.endTime}
        </p>
        <p className="text-[13px] font-medium text-slate-700 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          <span>{nextItem.roomName || t("scheduleRoomTbd")}</span>
          {nextItem.coachName ? ` · ${nextItem.coachName}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSelectSession(nextItem)}
          className="min-h-[38px] flex-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[13px] font-bold text-white hover:bg-slate-800 cursor-pointer"
        >
          {t("scheduleDrawerTitle")}
        </button>

        {/* Chỉ buổi PT 1:1 mới có nút Báo vắng */}
        {nextItem.kind === "pt" && nextItem.canReportAbsence && (
          <button
            type="button"
            onClick={() => onOpenAbsenceModal(nextItem)}
            className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-bold text-slate-800 hover:bg-slate-50 cursor-pointer"
          >
            {t("scheduleBtnReportAbsence")}
          </button>
        )}
      </div>
    </section>
  )
}

/**
 * 4.7 PackageSummary ("Gói của tôi" — thay thế các thẻ lớp trống ở trang cũ)
 */
export function PackageSummary({ packages = [], onNavigateBookPt, t, tr }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <Package className="h-4 w-4 text-slate-500 shrink-0" />
          <span>{t("memberSchedMyPackagesHeader")}</span>
        </h2>
        <span className="text-[12px] font-bold text-slate-500">
          {packages.length}
        </span>
      </div>

      {packages.length === 0 ? (
        <p className="text-[13px] text-slate-600">
          {t("memberSchedMyPackagesEmpty")}
        </p>
      ) : (
        <div className="space-y-3 divide-y divide-slate-100">
          {packages.map((pkg) => {
            const pct =
              pkg.totalSessions > 0
                ? Math.min(
                    100,
                    Math.round((pkg.completedSessions / pkg.totalSessions) * 100),
                  )
                : 0
            return (
              <div key={pkg.id} className="pt-3 first:pt-0 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                          pkg.kind === "pt"
                            ? "bg-indigo-50 text-indigo-900 border border-indigo-200"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {pkg.kind === "pt"
                          ? t("memberSchedPtBadge")
                          : t("memberSchedGroupBadge")}
                      </span>
                      <p className="text-[14px] font-bold text-slate-900 truncate">
                        {pkg.title}
                      </p>
                    </div>
                    {pkg.expiryDate && (
                      <p className="text-[12px] text-slate-500 mt-0.5">
                        {t("memberSchedPkgExpiresPrefix")} {pkg.expiryDate}
                      </p>
                    )}
                  </div>

                  <span className="text-[13px] font-extrabold text-slate-800 shrink-0 tabular-nums">
                    {tr("memberSchedPkgSessionsUnit", {
                      done: pkg.completedSessions,
                      total: pkg.totalSessions,
                    })}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all ${
                      pkg.kind === "pt" ? "bg-indigo-600" : "bg-brand-primary"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {!pkg.hasSchedule && (
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="text-[12px] font-semibold text-amber-800">
                      {t("memberSchedPkgNoScheduleYet")}
                    </span>
                    {pkg.kind === "pt" && (
                      <button
                        type="button"
                        onClick={onNavigateBookPt}
                        className="min-h-[32px] inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-[12px] font-bold text-indigo-900 hover:bg-indigo-100 cursor-pointer"
                      >
                        <span>{t("memberSchedPkgBookPtBtn")}</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

/**
 * 4.7 UpcomingHolidays (Chỉ hiển thị ngày nghỉ lễ trong 30 ngày tới + Modal Xem tất cả cả năm)
 */
export function UpcomingHolidays({
  next30Days = [],
  allUpcoming = [],
  t,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-slate-500 shrink-0" />
          <span>{t("memberSchedHolidays30Header")}</span>
        </h2>
        {allUpcoming.length > 0 && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="text-[13px] font-bold text-slate-700 underline hover:text-slate-950 cursor-pointer"
          >
            {t("memberSchedHolidaysViewAll")}
          </button>
        )}
      </div>

      {next30Days.length === 0 ? (
        <p className="text-[13px] text-slate-600">
          {t("memberSchedHolidays30Empty")}
        </p>
      ) : (
        <div className="space-y-1.5">
          {next30Days.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-1.5 text-[13px]"
            >
              <span className="font-bold text-slate-900 truncate">{h.name}</span>
              <span className="font-semibold text-amber-900 shrink-0 tabular-nums">
                {h.ddMmYyyy}
              </span>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("memberSchedHolidaysModalTitle")}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-[16px] font-extrabold text-slate-900">
                {t("memberSchedHolidaysModalTitle")}
              </h3>
              <button
                type="button"
                aria-label={t("scheduleAbsenceClose")}
                onClick={() => setIsModalOpen(false)}
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {allUpcoming.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-[13px]"
                >
                  <span className="font-bold text-slate-900">{h.name}</span>
                  <span className="font-semibold text-slate-700 tabular-nums">
                    {h.ddMmYyyy}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * 4.6 SessionDrawer (Panel bên phải trên desktop, bottom sheet trên mobile)
 */
export function SessionDrawer({
  item,
  onClose,
  onOpenAbsenceModal,
  onRequestCancelPt,
  onNavigateProgress,
  onNavigateCoach,
  onNavigateFacilities,
  language,
  t,
  tr,
}) {
  if (!item) return null

  const wk = getWeekdayMeta(item.date)
  const weekdayFull = language === "vi" ? wk.fullVi : wk.fullEn
  const slotLabel =
    item.slotNumber && item.slotNumber !== "other"
      ? tr("memberSchedSlotPrefix", { num: item.slotNumber })
      : t("memberSchedOtherSlot")

  const buildGoogleCalendarUrl = () => {
    const cleanDate = String(item.date || "").replace(/-/g, "")
    const cleanStart = String(item.startTime || "06:00").replace(/:/g, "") + "00"
    const cleanEnd = String(item.endTime || "07:30").replace(/:/g, "") + "00"
    const dates = `${cleanDate}T${cleanStart}/${cleanDate}T${cleanEnd}`
    const details = `${item.sportName} · ${t("scheduleDrawerCoach")}: ${item.coachName || "VIBE Sport"}`
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: item.className,
      dates,
      ctz: "Asia/Ho_Chi_Minh",
      location: item.roomName || "VIBE Sport Center",
      details,
    })
    return `https://calendar.google.com/calendar/render?${params.toString()}`
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("scheduleDrawerTitle")}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-end bg-slate-900/60"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[90vh] sm:h-full rounded-t-2xl sm:rounded-none bg-white p-6 shadow-2xl flex flex-col justify-between overflow-y-auto"
      >
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-[12px] font-bold ${
                    item.kind === "pt"
                      ? "bg-indigo-50 text-indigo-900 border border-indigo-200"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {item.kind === "pt"
                    ? t("memberSchedPtBadge")
                    : t("memberSchedGroupBadge")}
                </span>
                <span className="text-[12px] font-bold uppercase text-brand-accent-dark">
                  {item.sportName}
                </span>
              </div>
              <h3 className="text-[18px] font-extrabold text-slate-950">
                {item.className}
              </h3>
            </div>

            <button
              type="button"
              aria-label={t("scheduleAbsenceClose")}
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Thông tin chi tiết */}
          <dl className="space-y-3 text-[14px]">
            <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
              <dt className="font-semibold text-slate-600">
                {t("scheduleDrawerDate")}
              </dt>
              <dd className="font-bold text-slate-900 text-right">
                {weekdayFull}, {toDdMmYyyy(item.date)}
              </dd>
            </div>

            <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
              <dt className="font-semibold text-slate-600">
                {t("scheduleDrawerTime")}
              </dt>
              <dd className="font-bold text-slate-900 text-right">
                {slotLabel} · {item.startTime}–{item.endTime}
              </dd>
            </div>

            <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
              <dt className="font-semibold text-slate-600">
                {t("scheduleDrawerRoom")}
              </dt>
              <dd className="font-semibold text-slate-900 text-right">
                {item.roomName || t("scheduleRoomTbd")}
              </dd>
            </div>

            <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
              <dt className="font-semibold text-slate-600">
                {t("scheduleDrawerCoach")}
              </dt>
              <dd className="font-semibold text-slate-900 text-right">
                {item.coachName || t("scheduleCoachTbd")}
              </dd>
            </div>

            {item.sessionNumber && item.totalSessions && (
              <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                <dt className="font-semibold text-slate-600">
                  {t("trainingProgress")}
                </dt>
                <dd className="font-bold text-slate-900">
                  {tr("memberSchedDrawerSessionProgress", {
                    current: item.sessionNumber,
                    total: item.totalSessions,
                  })}
                </dd>
              </div>
            )}

            <div className="flex justify-between items-center gap-3 py-1.5 border-b border-slate-100">
              <dt className="font-semibold text-slate-600">
                {t("scheduleDrawerStatus")}
              </dt>
              <dd>
                <StatusBadge item={item} t={t} />
              </dd>
            </div>

            {item.status === "Completed" && item.attendance && (
              <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                <dt className="font-semibold text-slate-600">
                  {t("memberSchedDrawerAttendanceLabel")}
                </dt>
                <dd className="font-bold text-slate-900">
                  {item.attendance === "Absent"
                    ? t("memberSchedStatusDoneAbsent")
                    : t("memberSchedStatusDonePresent")}
                </dd>
              </div>
            )}

            {item.status === "Cancelled" && (
              <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                <dt className="font-semibold text-slate-600">
                  {t("memberSchedDrawerCancelReasonLabel")}
                </dt>
                <dd className="font-bold text-slate-800 text-right">
                  {item.centerInvalidated
                    ? t("memberSchedCancelReasonCenter")
                    : t("memberSchedCancelReasonDefault")}
                </dd>
              </div>
            )}

            {(item.isMakeup || item.replacedByDate) && (
              <div className="flex justify-between gap-3 py-1.5 border-b border-slate-100">
                <dt className="font-semibold text-slate-600">
                  {t("scheduleDrawerMakeupInfo")}
                </dt>
                <dd className="font-bold text-indigo-800 text-right">
                  {item.isMakeup && item.makeupTargetDate
                    ? tr("scheduleMakeupForDate", {
                        date: item.makeupTargetDate,
                      })
                    : item.replacedByDate
                      ? tr("scheduleReplacedByDate", {
                          date: item.replacedByDate,
                        })
                      : t("scheduleWaitingMakeup")}
                </dd>
              </div>
            )}
          </dl>

          {/* Đơn báo vắng đã gửi (nếu có cho PT 1:1) */}
          {item.absenceNotice && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[13px] space-y-1">
              <p className="font-bold text-amber-950">
                {t("memberSchedAbsenceAlreadyReportedTitle")}
              </p>
              {item.absenceNotice.reason && (
                <p className="text-amber-900">{item.absenceNotice.reason}</p>
              )}
            </div>
          )}

          {/* Ghi chú quy tắc cho lớp nhóm Normal */}
          {item.kind === "group" && item.status === "Scheduled" && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-[13px] text-slate-700 flex items-start gap-2">
              <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
              <span>{t("memberSchedNormalFixedNote")}</span>
            </div>
          )}
        </div>

        {/* Khu vực hành động sticky ở chân Drawer (P0 4.1: luôn có hành động rõ ràng) */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 pt-4 mt-4 space-y-2">
          {item.kind === "pt" && item.status === "Scheduled" && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!item.canReportAbsence}
                onClick={() => onOpenAbsenceModal(item)}
                title={
                  item.isPtReportAbsenceExpired
                    ? tr("memberSchedAbsenceExpiredTooltip", {
                        hours: ABSENCE_MIN_HOURS_BEFORE,
                      })
                    : undefined
                }
                className="min-h-[40px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 text-[13px] font-bold text-slate-900 cursor-pointer"
              >
                {t("scheduleBtnReportAbsence")}
              </button>

              {item.canCancelPt && (
                <button
                  type="button"
                  onClick={() => onRequestCancelPt(item)}
                  className="min-h-[40px] rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-2 text-[13px] font-bold text-rose-800 cursor-pointer"
                >
                  {t("schedulePtBtnCancel")}
                </button>
              )}
            </div>
          )}

          {item.status === "Completed" && (
            <button
              type="button"
              onClick={onNavigateProgress}
              className="w-full min-h-[40px] inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 px-4 py-2 text-[13px] font-bold text-white cursor-pointer"
            >
              <span>{t("memberSchedDrawerViewProgressLink")}</span>
              <ExternalLink className="h-4 w-4" />
            </button>
          )}

          {item.status === "Scheduled" && (
            <a
              href={buildGoogleCalendarUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[40px] inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-[13px] font-bold text-slate-900"
            >
              <Calendar className="h-4 w-4 text-blue-700" />
              <span>{t("memberSchedDrawerAddCalendarBtn")}</span>
            </a>
          )}

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={onNavigateFacilities}
              className="min-h-[38px] inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 text-[12px] font-bold text-slate-800 cursor-pointer"
            >
              <MapPin className="h-3.5 w-3.5 text-slate-600 shrink-0" />
              <span className="truncate">{t("memberSchedDrawerViewCourtBtn")}</span>
            </button>

            <button
              type="button"
              onClick={onNavigateCoach}
              className="min-h-[38px] inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 text-[12px] font-bold text-slate-800 cursor-pointer"
            >
              <UserRound className="h-3.5 w-3.5 text-slate-600 shrink-0" />
              <span className="truncate">{t("memberSchedDrawerContactCoachBtn")}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[38px] inline-flex items-center justify-center rounded-lg bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-[12px] font-bold text-white cursor-pointer"
            >
              {t("memberSchedDrawerCloseBtn")}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
