import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Info,
  Lock,
  QrCode,
  RefreshCw,
  Search,
  X,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { Link } from "react-router-dom"
import { useSCMS } from "../../context/SCMSContext"
import {
  getMemberCheckinCode,
  getMemberAttendances,
  getMemberClasses,
  getClassSessions,
} from "../../api/memberPortalApi"
import { getAuthoritativeProfileId } from "../../utils/memberSafetyHelpers"
import {
  CHECKIN_WINDOW_MINUTES_BEFORE,
  DEFAULT_NORMAL_REQUIRED_SESSIONS,
  normalizeScheduleSession,
  toDateDdMmYyyy,
  formatLocalTime,
  getTodayIsoInVn,
} from "../../utils/memberScheduleUtils"

// ============================================================================
// HẰNG SỐ CẤU HÌNH NGHIỆP VỤ
// ============================================================================
// [Cần xác nhận #1] Tab "Sắp tới" hiển thị các buổi hợp lệ từ ngày mai trở đi trong vòng 14 ngày
export const UPCOMING_SCHEDULE_LOOKAHEAD_DAYS = 14

// [Cần xác nhận #2] Khung điểm danh: từ 30 phút trước giờ bắt đầu đến hết giờ kết thúc (đồng bộ với MemberScheduleView)
export const CHECKIN_OPEN_MINUTES_BEFORE = CHECKIN_WINDOW_MINUTES_BEFORE || 30

// [Cần xác nhận #7] Số bản ghi lịch sử điểm danh mỗi trang trước khi bấm "Tải thêm"
export const HISTORY_PAGE_SIZE = 10

// Số ngày quá khứ tối đa để chọn buổi học trong ngăn "Báo thiếu buổi tập" (Mục 4.5.3)
export const DISPUTE_PAST_SESSIONS_DAYS = 30

// Ngưỡng làm mới mã QR sớm trước khi hết hạn để tránh nhấp nháy (Mục 4.2.5)
const QR_PRE_EXPIRY_REFRESH_SECONDS = 3

// Thời hạn mặc định hiển thị trong hướng dẫn ngắn nếu chưa lấy từ phản hồi (Mục 4.2.2)
const DEFAULT_QR_TTL_SECONDS = 15

const VN_TIMEZONE = "Asia/Ho_Chi_Minh"

const TIME_FORMATTER_HHMM = new Intl.DateTimeFormat("en-GB", {
  timeZone: VN_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

const TIME_FORMATTER_HHMMSS = new Intl.DateTimeFormat("en-GB", {
  timeZone: VN_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

const isLegacyStrengthClass = (enrollment) =>
  String(enrollment?.className || "")
    .trim()
    .toLocaleLowerCase("vi") === "gym suc manh"

const addDaysToIsoDate = (isoDate, days) => {
  if (!isoDate) return ""
  const base = new Date(`${String(isoDate).slice(0, 10)}T12:00:00+07:00`)
  if (Number.isNaN(base.getTime())) return isoDate
  base.setUTCDate(base.getUTCDate() + days)
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: VN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(base)
}

const isSessionCancelled = (session) => {
  const raw = String(session?.rawStatus || session?.status || "")
    .trim()
    .toLowerCase()
  return (
    raw === "cancelled" ||
    raw === "canceled" ||
    session?.centerInvalidated === true
  )
}

const isSessionInCheckinWindow = (session, nowMs) => {
  if (!session || isSessionCancelled(session)) return false
  if (session.startMs === null || session.endMs === null) return false
  const openMs = session.startMs - CHECKIN_OPEN_MINUTES_BEFORE * 60 * 1000
  return nowMs >= openMs && nowMs <= session.endMs
}

// Chuẩn hóa mã trạng thái điểm danh từ API (Mục 3.4)
export const normalizeAttendanceStateKey = (rawState) => {
  const upper = String(rawState || "")
    .trim()
    .toUpperCase()
  if (upper.includes("LATE")) return "late"
  if (
    upper.includes("PRESENT") ||
    upper.includes("ATTENDED") ||
    upper === "CHECKED_IN"
  ) {
    return "present"
  }
  if (
    upper.includes("EXCUSED") ||
    upper.includes("WAIVED") ||
    upper.includes("PERMITTED")
  ) {
    return "excused"
  }
  if (upper.includes("ABSENT") || upper.includes("NO_SHOW")) {
    return "absent"
  }
  return "pending"
}

export const getAttendanceBadgeMeta = (stateKey, t) => {
  switch (stateKey) {
    case "present":
      return {
        icon: "✓",
        label: t("checkinStatusPresent"),
        className: "bg-emerald-50 text-emerald-800 border-emerald-200",
      }
    case "late":
      return {
        icon: "◑",
        label: t("checkinStatusLate"),
        className: "bg-amber-50 text-amber-900 border-amber-200",
      }
    case "excused":
      return {
        icon: "◈",
        label: t("checkinStatusExcused"),
        className: "bg-blue-50 text-blue-800 border-blue-200",
      }
    case "absent":
      return {
        icon: "✕",
        label: t("checkinStatusAbsent"),
        className: "bg-rose-50 text-rose-800 border-rose-200",
      }
    case "pending":
    default:
      return {
        icon: "○",
        label: t("checkinStatusPending"),
        className: "bg-slate-100 text-slate-700 border-slate-300",
      }
  }
}

const findSessionAttendanceRecord = (session, records = []) => {
  if (!session || !Array.isArray(records)) return null
  const sessionId = session.id ?? session.sessionId
  return (
    records.find((record) => {
      const sameSession =
        sessionId != null &&
        record.sessionId != null &&
        String(record.sessionId) === String(sessionId)
      const sameClassDate =
        session.classId != null &&
        record.classId != null &&
        String(record.classId) === String(session.classId) &&
        String(record.sessionDate || "").slice(0, 10) ===
          String(session.sessionDate || "").slice(0, 10)
      return sameSession || sameClassDate
    }) || null
  )
}

const extractTimeFromIso = (value) => {
  if (!value) return null
  const str = String(value).trim()
  if (/^\d{2}:\d{2}/.test(str)) return str.slice(0, 5)
  const parsed = new Date(str)
  if (Number.isNaN(parsed.getTime())) return null
  return TIME_FORMATTER_HHMM.format(parsed)
}

// Họa tiết ô vuông cố định giả lập QR (không có finder pattern / dữ liệu QR hợp lệ, không thể giải mã khi quét)
const FAKE_QR_GRID_ROWS = [
  "10110101011",
  "01101011010",
  "11010010101",
  "10101101011",
  "01010001010",
  "11000000011",
  "01010001010",
  "10110101101",
  "11001010011",
  "01101101100",
  "10110010111",
]

function LockedQrPlaceholderPattern({ size = 148 }) {
  const gridSize = FAKE_QR_GRID_ROWS.length
  const cellSize = 10
  const gap = 2
  const viewBoxSize = gridSize * cellSize + (gridSize - 1) * gap

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {FAKE_QR_GRID_ROWS.map((rowStr, rIdx) =>
        rowStr.split("").map((bit, cIdx) => {
          if (bit !== "1") return null
          const x = cIdx * (cellSize + gap)
          const y = rIdx * (cellSize + gap)
          return (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={x}
              y={y}
              width={cellSize}
              height={cellSize}
              rx={2.5}
              className="fill-slate-800"
            />
          )
        }),
      )}
    </svg>
  )
}

function LocalDatePicker({ value, onChange, isVi, label, min, max, error }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const selected = value ? new Date(`${value}T12:00:00+07:00`) : new Date()
  const [view, setView] = useState(() => ({
    year: selected.getFullYear(),
    month: selected.getMonth(),
  }))

  useEffect(() => {
    if (value) {
      const date = new Date(`${value}T12:00:00+07:00`)
      if (!Number.isNaN(date.getTime())) {
        setView({ year: date.getFullYear(), month: date.getMonth() })
      }
    }
  }, [value])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [open])

  const firstDay = new Date(view.year, view.month, 1).getDay()
  const offset = (firstDay + 6) % 7
  const days = new Date(view.year, view.month + 1, 0).getDate()
  const monthName = new Intl.DateTimeFormat(isVi ? "vi-VN" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(view.year, view.month, 1))
  const bounds = (day) =>
    `${view.year}-${String(view.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  const weekdayNames = isVi
    ? ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
    : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-invalid={Boolean(error)}
        onClick={() => setOpen((state) => !state)}
        className={`mt-1 inline-flex min-h-[40px] w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-left text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer ${
          error ? "border-rose-400" : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <span className={value ? "text-slate-900" : "text-slate-400"}>
          {toDateDdMmYyyy(value) || "dd/MM/yyyy"}
        </span>
        <CalendarDays className="h-4 w-4 text-slate-500 shrink-0" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              aria-label={isVi ? "Tháng trước" : "Previous month"}
              onClick={() =>
                setView((current) =>
                  current.month === 0
                    ? { year: current.year - 1, month: 11 }
                    : { ...current, month: current.month - 1 },
                )
              }
              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md p-1.5 hover:bg-slate-100 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-bold capitalize text-slate-800">
              {monthName}
            </span>
            <button
              type="button"
              aria-label={isVi ? "Tháng sau" : "Next month"}
              onClick={() =>
                setView((current) =>
                  current.month === 11
                    ? { year: current.year + 1, month: 0 }
                    : { ...current, month: current.month + 1 },
                )
              }
              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md p-1.5 hover:bg-slate-100 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-600">
            {weekdayNames.map((day) => (
              <span key={day} className="py-1">
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {Array.from({ length: offset }, (_, index) => (
              <span key={`blank-${index}`} />
            ))}
            {Array.from({ length: days }, (_, index) => {
              const day = index + 1
              const date = bounds(day)
              const disabled = (min && date < min) || (max && date > max)
              return (
                <button
                  key={date}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(date)
                    setOpen(false)
                  }}
                  className={`mx-auto grid h-8 w-8 place-items-center rounded-full text-xs cursor-pointer ${
                    value === date
                      ? "bg-brand-primary font-bold text-white"
                      : "text-slate-700 hover:bg-brand-accent-soft"
                  } disabled:cursor-not-allowed disabled:text-slate-300`}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const logAttendanceError = (endpoint, error) => {
  console.error("[member-attendance] Request failed", {
    endpoint,
    status: error?.status ?? 0,
    requestId: error?.requestId || error?.details?.requestId || null,
    message: error?.message || "Request failed",
  })
}

export function MemberCheckinView() {
  const { currentUser, language, apiEnabled, t, showToast } = useSCMS()
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

  const resolvedProfileId =
    getAuthoritativeProfileId(currentUser) ??
    currentUser?.memberId ??
    currentUser?.id
  const memberId = Number(resolvedProfileId)
  const validMember = Number.isInteger(memberId) && memberId > 0

  // Trạng thái mã QR
  const [code, setCode] = useState(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [codeDuration, setCodeDuration] = useState(DEFAULT_QR_TTL_SECONDS)
  const [codeExpiresAt, setCodeExpiresAt] = useState(0)
  const [codeUpdatedAt, setCodeUpdatedAt] = useState(null)
  const [refreshingCode, setRefreshingCode] = useState(false)
  const [codeError, setCodeError] = useState("")

  // Đồng hồ thời gian thực cho tính toán khung điểm danh
  const [clockNow, setClockNow] = useState(() => Date.now())

  // Dữ liệu khóa học, buổi học, lịch sử điểm danh
  const [activeEnrollmentsCount, setActiveEnrollmentsCount] = useState(0)
  const [allNormalizedSessions, setAllNormalizedSessions] = useState([])
  const [attendanceRows, setAttendanceRows] = useState([])
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [scheduleError, setScheduleError] = useState("")
  const [historyError, setHistoryError] = useState("")
  const [scheduleFailed, setScheduleFailed] = useState(false)
  const [historyFailed, setHistoryFailed] = useState(false)

  // Tab Lịch trình & Bộ lọc Lịch sử
  const [scheduleTab, setScheduleTab] = useState("today")
  const [historySearch, setHistorySearch] = useState("")
  const [historyStatus, setHistoryStatus] = useState("all")
  const [historyDateFrom, setHistoryDateFrom] = useState("")
  const [historyDateTo, setHistoryDateTo] = useState("")
  const [visibleHistoryCount, setVisibleHistoryCount] =
    useState(HISTORY_PAGE_SIZE)

  // Hộp trợ giúp (Popover "Gặp sự cố?"), Phóng to QR, Hướng dẫn 3 bước và Ngăn "Báo thiếu buổi tập"
  const [showHelpPopover, setShowHelpPopover] = useState(false)
  const [showQrSpotlight, setShowQrSpotlight] = useState(false)
  const [showHowToSteps, setShowHowToSteps] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= 640,
  )
  const [showDisputeDrawer, setShowDisputeDrawer] = useState(false)
  const [selectedDisputeSessionKey, setSelectedDisputeSessionKey] = useState("")
  const [disputeNote, setDisputeNote] = useState("")
  const [copiedBanner, setCopiedBanner] = useState(false)

  // Refs quản lý focus & lifecycle
  const historySearchRef = useRef(null)
  const helpPopoverRef = useRef(null)
  const disputeDrawerRef = useRef(null)
  const disputeSelectRef = useRef(null)
  const lastDisputeTriggerRef = useRef(null)
  const mountedRef = useRef(true)
  const visibleRef = useRef(
    typeof document === "undefined" || document.visibilityState === "visible",
  )
  const refreshingCodeRef = useRef(false)
  const retryTimerRef = useRef(null)
  const retryResolveRef = useRef(null)

  // Tải danh sách khóa học & toàn bộ buổi học (đồng bộ nguồn dữ liệu và quy tắc buổi hợp lệ với MemberScheduleView)
  const refreshSchedule = useCallback(async () => {
    if (!apiEnabled || !validMember) {
      setScheduleLoading(false)
      setScheduleError("")
      setScheduleFailed(false)
      setActiveEnrollmentsCount(0)
      setAllNormalizedSessions([])
      return
    }
    setScheduleLoading(true)
    setScheduleError("")
    setScheduleFailed(false)
    try {
      const [enrollments, globalSessions] = await Promise.all([
        getMemberClasses(memberId),
        getClassSessions().catch(() => []),
      ])
      const globalSessionList = Array.isArray(globalSessions)
        ? globalSessions
        : []
      const activeEnrollments = (
        Array.isArray(enrollments) ? enrollments : []
      ).filter(
        (row) =>
          !["cancelled", "canceled", "dropped", "rejected"].includes(
            String(row.status || "").toLowerCase(),
          ) && !isLegacyStrengthClass(row),
      )

      // Chuẩn hóa buổi học từ từng khóa học (hoặc fallback từ getClassSessions giống trang Lịch học)
      const collected = []
      for (const row of activeEnrollments) {
        const inline =
          row.sessions || row.classSessions || row.scheduledSessions
        const rawList =
          Array.isArray(inline) && inline.length > 0
            ? inline
            : row.classId
              ? globalSessionList.filter(
                  (s) =>
                    String(s.classId) === String(row.classId) &&
                    s.isPrivate !== true,
                )
              : []
        const normalizedList = rawList
          .map((s) => normalizeScheduleSession(s, row))
          .filter(Boolean)
          .sort((a, b) => {
            const dateCmp = String(a.sessionDate || "").localeCompare(
              String(b.sessionDate || ""),
            )
            if (dateCmp !== 0) return dateCmp
            return String(a.startTime || "").localeCompare(
              String(b.startTime || ""),
            )
          })

        const requiredSessions =
          Number(row.totalSessions || row.requiredSessions) > 0
            ? Number(row.totalSessions || row.requiredSessions)
            : DEFAULT_NORMAL_REQUIRED_SESSIONS

        // Liên kết thông tin buổi bù giống trang Lịch học
        const byId = new Map(normalizedList.map((s) => [Number(s.id), s]))
        const linkedCancelledIds = new Set()
        for (const s of normalizedList) {
          if (
            !isSessionCancelled(s) &&
            s.makeupForSessionId &&
            byId.has(Number(s.makeupForSessionId))
          ) {
            const target = byId.get(Number(s.makeupForSessionId))
            s.isMakeup = true
            s.makeupTargetDate = toDateDdMmYyyy(target.sessionDate)
            target.replacedByDate = toDateDdMmYyyy(s.sessionDate)
            linkedCancelledIds.add(Number(target.id))
          }
        }

        const cancelledInCourse = normalizedList.filter((s) =>
          isSessionCancelled(s),
        )
        const validInCourse = normalizedList.filter(
          (s) => !isSessionCancelled(s),
        )
        const unlinkedCancelled = cancelledInCourse.filter(
          (c) => !linkedCancelledIds.has(Number(c.id)) && !c.replacedByDate,
        )
        if (
          unlinkedCancelled.length > 0 &&
          normalizedList.length > requiredSessions &&
          validInCourse.length > requiredSessions - cancelledInCourse.length
        ) {
          const candidateMakeups = validInCourse
            .filter((s) => !s.isMakeup)
            .slice(-unlinkedCancelled.length)
          unlinkedCancelled.forEach((cancelledItem, idx) => {
            const makeupItem = candidateMakeups[idx]
            if (
              makeupItem &&
              makeupItem.sessionDate > cancelledItem.sessionDate
            ) {
              makeupItem.isMakeup = true
              makeupItem.makeupTargetDate = toDateDdMmYyyy(
                cancelledItem.sessionDate,
              )
              cancelledItem.replacedByDate = toDateDdMmYyyy(
                makeupItem.sessionDate,
              )
            }
          })
        }

        collected.push(...normalizedList)
      }

      // Thêm cả các buổi PT 1:1 của hội viên nếu có
      const privateList = globalSessionList
        .filter(
          (s) =>
            s.isPrivate === true &&
            String(s.bookedMemberId) === String(memberId),
        )
        .map((s) => normalizeScheduleSession(s))
        .filter(Boolean)

      const merged = [...collected, ...privateList].sort((a, b) => {
        const dateCmp = String(a.sessionDate || "").localeCompare(
          String(b.sessionDate || ""),
        )
        if (dateCmp !== 0) return dateCmp
        return String(a.startTime || "").localeCompare(String(b.startTime || ""))
      })

      if (mountedRef.current) {
        setActiveEnrollmentsCount(activeEnrollments.length)
        setAllNormalizedSessions(merged)
      }
    } catch (err) {
      logAttendanceError(`/api/members/${memberId}/enrollments`, err)
      if (mountedRef.current) {
        setScheduleError(t("checkinScheduleLoadError"))
        setScheduleFailed(true)
      }
    } finally {
      if (mountedRef.current) setScheduleLoading(false)
    }
  }, [apiEnabled, memberId, validMember, t])

  const refreshHistory = useCallback(async () => {
    if (!apiEnabled || !validMember) {
      setHistoryLoading(false)
      setHistoryError("")
      setHistoryFailed(false)
      setAttendanceRows([])
      return
    }
    setHistoryLoading(true)
    setHistoryError("")
    setHistoryFailed(false)
    try {
      const records = await getMemberAttendances(memberId)
      if (mountedRef.current) {
        setAttendanceRows(
          (Array.isArray(records) ? records : []).slice().sort((a, b) => {
            const dateA = String(a.sessionDate || a.checkInTime || "")
            const dateB = String(b.sessionDate || b.checkInTime || "")
            return dateB.localeCompare(dateA)
          }),
        )
      }
    } catch (err) {
      logAttendanceError(`/api/attendances?memberId=${memberId}`, err)
      if (mountedRef.current) {
        setHistoryError(t("checkinHistoryLoadError"))
        setHistoryFailed(true)
      }
    } finally {
      if (mountedRef.current) setHistoryLoading(false)
    }
  }, [apiEnabled, memberId, validMember, t])

  const refreshPage = useCallback(
    () => Promise.all([refreshSchedule(), refreshHistory()]),
    [refreshSchedule, refreshHistory],
  )

  // Tính toán các nhóm buổi học theo múi giờ Asia/Ho_Chi_Minh
  const todayIso = getTodayIsoInVn(clockNow)
  const maxUpcomingIso = useMemo(
    () => addDaysToIsoDate(todayIso, UPCOMING_SCHEDULE_LOOKAHEAD_DAYS),
    [todayIso],
  )
  const minDisputeIso = useMemo(
    () => addDaysToIsoDate(todayIso, -DISPUTE_PAST_SESSIONS_DAYS),
    [todayIso],
  )

  // Map tra cứu nhanh thông tin buổi học (giờ, sân) cho bảng Lịch sử điểm danh
  const sessionLookupMap = useMemo(() => {
    const byId = new Map()
    const byClassAndDate = new Map()
    for (const s of allNormalizedSessions) {
      if (s.id != null) byId.set(String(s.id), s)
      if (s.classId != null && s.sessionDate) {
        byClassAndDate.set(`${s.classId}:${s.sessionDate}`, s)
      }
    }
    return { byId, byClassAndDate }
  }, [allNormalizedSessions])

  // Tất cả buổi học hôm nay
  const todayAllSessions = useMemo(
    () => allNormalizedSessions.filter((s) => s.sessionDate === todayIso),
    [allNormalizedSessions, todayIso],
  )

  // Buổi hợp lệ hôm nay (không tính buổi hủy; buổi bù tính như buổi thường)
  const todayValidSessions = useMemo(
    () => todayAllSessions.filter((s) => !isSessionCancelled(s)),
    [todayAllSessions],
  )

  // Buổi hợp lệ sắp tới: từ ngày mai trở đi, trong vòng 14 ngày, không tính buổi hủy
  const upcomingValidSessions = useMemo(
    () =>
      allNormalizedSessions.filter(
        (s) =>
          !isSessionCancelled(s) &&
          s.sessionDate > todayIso &&
          s.sessionDate <= maxUpcomingIso,
      ),
    [allNormalizedSessions, todayIso, maxUpcomingIso],
  )

  // Buổi hợp lệ tiếp theo gần nhất (cho card Lịch trình học tập khi hôm nay không có buổi)
  const nextFutureValidSession = useMemo(
    () =>
      allNormalizedSessions.find(
        (s) =>
          !isSessionCancelled(s) &&
          (s.sessionDate > todayIso ||
            (s.sessionDate === todayIso &&
              s.endMs !== null &&
              s.endMs >= clockNow)),
      ) || null,
    [allNormalizedSessions, todayIso, clockNow],
  )

  // Xác định trạng thái Card QR:
  // - Khi CÓ buổi trong khung điểm danh [start - 30p, end]: "active" (hoặc "checked_in" nếu buổi đang mở đã điểm danh).
  // - Khi KHÔNG có buổi trong khung điểm danh: "locked" (hiển thị QR mờ + icon khóa + giờ mở + đếm ngược tới buổi hợp lệ kế tiếp).
  const qrContext = useMemo(() => {
    const openSessions = todayValidSessions
      .filter((s) => isSessionInCheckinWindow(s, clockNow))
      .sort((a, b) => (a.startMs || 0) - (b.startMs || 0))

    // 1. Có buổi trong khung chưa điểm danh -> trạng thái Đang hoạt động
    const activeUnchecked = openSessions.find((s) => {
      const rec = findSessionAttendanceRecord(s, attendanceRows)
      const stateKey = rec ? normalizeAttendanceStateKey(rec.state) : null
      return stateKey !== "present" && stateKey !== "late"
    })

    if (activeUnchecked) {
      return {
        mode: "active",
        session: activeUnchecked,
        record: null,
        openMs: null,
      }
    }

    // 2. Buổi đang trong khung điểm danh hôm nay đã được ghi nhận có mặt
    if (openSessions.length > 0) {
      const checkedSession = openSessions[0]
      const rec = findSessionAttendanceRecord(checkedSession, attendanceRows)
      return {
        mode: "checked_in",
        session: checkedSession,
        record: rec,
        openMs: null,
      }
    }

    // 3. Không có buổi nào đang trong khung điểm danh -> trạng thái Khóa ("locked")
    // Tìm buổi hợp lệ kế tiếp có mốc mở QR (30 phút trước giờ bắt đầu) ở tương lai
    const nextLockedSession =
      allNormalizedSessions.find(
        (s) =>
          !isSessionCancelled(s) &&
          s.startMs !== null &&
          clockNow < s.startMs - CHECKIN_OPEN_MINUTES_BEFORE * 60 * 1000,
      ) || null

    if (nextLockedSession && nextLockedSession.startMs !== null) {
      const openMs =
        nextLockedSession.startMs - CHECKIN_OPEN_MINUTES_BEFORE * 60 * 1000
      const openDateObj = new Date(openMs)
      const openTimeFormatted = TIME_FORMATTER_HHMM.format(openDateObj)
      const openDateFormatted = toDateDdMmYyyy(openDateObj.toISOString())
      const diffMs = Math.max(0, openMs - clockNow)
      const totalMinutes = Math.max(1, Math.ceil(diffMs / (60 * 1000)))
      const totalHours = Math.floor(totalMinutes / 60)
      const days = Math.floor(totalHours / 24)
      const hours = totalHours % 24
      const minutes = totalMinutes % 60

      return {
        mode: "locked",
        session: null,
        nextLockedSession,
        openMs,
        openTimeFormatted,
        openDateFormatted,
        countdown: { days, hours, minutes },
      }
    }

    return {
      mode: "locked",
      session: null,
      nextLockedSession: null,
      openMs: null,
      openTimeFormatted: null,
      openDateFormatted: null,
      countdown: null,
    }
  }, [todayValidSessions, allNormalizedSessions, clockNow, attendanceRows])

  const isQrActiveMode = qrContext.mode === "active"

  // Hàm lấy mã QR mới từ server — CHỈ gọi khi đang ở trạng thái hoạt động (có buổi trong khung điểm danh)
  const refreshCode = useCallback(async () => {
    if (!visibleRef.current || refreshingCodeRef.current) return
    if (!isQrActiveMode || !apiEnabled || !validMember) return

    refreshingCodeRef.current = true
    setRefreshingCode(true)
    setCodeError("")

    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (!mountedRef.current || !visibleRef.current) return
        try {
          const result = await getMemberCheckinCode()
          if (!result?.payload) throw new Error("QR payload missing")
          if (!mountedRef.current || !visibleRef.current) return

          const receivedAt = Date.now()
          const rawExpiresAt = result.expiresAt
          const parsedExpiresAt =
            typeof rawExpiresAt === "number" && rawExpiresAt < 1e12
              ? rawExpiresAt * 1000
              : new Date(rawExpiresAt).getTime()
          const serverDurationSec = Number(result.expiresInSeconds)
          const ttlMs =
            Number.isFinite(serverDurationSec) && serverDurationSec > 0
              ? serverDurationSec * 1000
              : Number.isFinite(parsedExpiresAt) && parsedExpiresAt > receivedAt
                ? parsedExpiresAt - receivedAt
                : DEFAULT_QR_TTL_SECONDS * 1000

          const expiry = receivedAt + ttlMs
          const durationSec = Math.max(1, Math.round(ttlMs / 1000))

          setCode(String(result.payload))
          setCodeDuration(durationSec)
          setCodeExpiresAt(expiry)
          setCodeUpdatedAt(new Date(receivedAt))
          setSecondsLeft(durationSec)
          setCodeError("")
          return
        } catch (err) {
          logAttendanceError("/api/attendances/me/checkin-code", err)
          const status = Number(err?.status || 0)
          if (attempt >= 2 || (status > 0 && status < 500)) break
          if (!visibleRef.current) break
          await new Promise((resolve) => {
            retryResolveRef.current = resolve
            retryTimerRef.current = window.setTimeout(
              () => {
                retryTimerRef.current = null
                retryResolveRef.current = null
                resolve()
              },
              500 * 2 ** attempt,
            )
          })
        }
      }
      if (mountedRef.current) {
        // Không bao giờ hiển thị mã hết hạn như còn hiệu lực
        setCodeError(t("checkinStateErrorTitle"))
        setSecondsLeft(0)
      }
    } finally {
      refreshingCodeRef.current = false
      if (mountedRef.current) setRefreshingCode(false)
    }
  }, [apiEnabled, isQrActiveMode, validMember, t])

  const reloadAll = useCallback(() => {
    refreshPage()
    if (isQrActiveMode) {
      refreshCode()
    }
  }, [refreshPage, isQrActiveMode, refreshCode])

  useEffect(() => {
    refreshPage()
  }, [refreshPage])

  // Khi không ở trạng thái Đang hoạt động, xóa mã cũ và không gọi API lấy mã QR
  useEffect(() => {
    if (!isQrActiveMode) {
      setShowQrSpotlight(false)
      setCode(null)
      setSecondsLeft(0)
      setCodeExpiresAt(0)
      setCodeError("")
      return
    }
    if (!scheduleLoading && !code && !refreshingCode && !codeError) {
      refreshCode()
    }
  }, [
    isQrActiveMode,
    scheduleLoading,
    code,
    refreshingCode,
    codeError,
    refreshCode,
  ])

  // Đếm ngược thời hạn mã QR (15 giây) — CHỈ chạy khi đang ở trạng thái hoạt động và có mã hợp lệ
  useEffect(() => {
    if (!isQrActiveMode || !code || !codeExpiresAt) return undefined
    let timer = null
    const stopTimer = () => {
      if (timer) window.clearInterval(timer)
      timer = null
    }
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.ceil((codeExpiresAt - Date.now()) / 1000),
      )
      setSecondsLeft(remaining)
      if (
        remaining <= QR_PRE_EXPIRY_REFRESH_SECONDS &&
        !refreshingCodeRef.current
      ) {
        refreshCode()
      }
    }
    const startTimer = () => {
      stopTimer()
      if (!visibleRef.current) return
      tick()
      timer = window.setInterval(tick, 250)
    }
    const onVisibilityChange = () => {
      visibleRef.current = document.visibilityState === "visible"
      if (visibleRef.current) {
        if (
          !code ||
          Date.now() >= codeExpiresAt - QR_PRE_EXPIRY_REFRESH_SECONDS * 1000
        ) {
          refreshCode()
        }
        startTimer()
      } else {
        stopTimer()
      }
    }
    startTimer()
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      stopTimer()
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [isQrActiveMode, code, codeExpiresAt, refreshCode])

  // Cập nhật đồng hồ mỗi phút (và tự động kích hoạt ngay tại thời điểm mở khung điểm danh)
  useEffect(() => {
    let intervalId = null
    let exactOpenTimeoutId = null

    const clearTimers = () => {
      if (intervalId) window.clearInterval(intervalId)
      if (exactOpenTimeoutId) window.clearTimeout(exactOpenTimeoutId)
      intervalId = null
      exactOpenTimeoutId = null
    }

    const startTimers = () => {
      clearTimers()
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return
      }
      const now = Date.now()
      setClockNow(now)

      // Cập nhật định kỳ để bộ đếm ngược phút luôn chính xác
      intervalId = window.setInterval(() => {
        setClockNow(Date.now())
      }, 30000)

      // Nếu đang khóa và có mốc mở sắp tới (trong vòng 24 giờ), đặt hẹn giờ chính xác đến mili-giây mở khung để tự chuyển sang active ngay lập tức
      if (
        qrContext.openMs &&
        qrContext.openMs > now &&
        qrContext.openMs - now <= 24 * 60 * 60 * 1000
      ) {
        exactOpenTimeoutId = window.setTimeout(
          () => {
            setClockNow(Date.now())
          },
          Math.max(100, qrContext.openMs - now + 50),
        )
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        startTimers()
      } else {
        clearTimers()
      }
    }

    startTimers()
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      clearTimers()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [qrContext.openMs])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (retryTimerRef.current) window.clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
      retryResolveRef.current?.()
      retryResolveRef.current = null
    }
  }, [])

  // Phím tắt "/" để tìm kiếm và "R" để tải lại
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      if (typing) return
      if (event.key === "/") {
        event.preventDefault()
        historySearchRef.current?.focus()
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault()
        reloadAll()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [reloadAll])

  // Đóng popover "Gặp sự cố?" khi bấm ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!showHelpPopover) return undefined
    const onPointerDown = (e) => {
      if (!helpPopoverRef.current?.contains(e.target)) {
        setShowHelpPopover(false)
      }
    }
    const onKeyDown = (e) => {
      if (e.key === "Escape") setShowHelpPopover(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [showHelpPopover])

  // Quản lý đóng ngăn "Báo thiếu buổi tập" / QR spotlight bằng Esc, khóa cuộn & giữ tiêu điểm
  const closeDisputeDrawer = useCallback(() => {
    setShowDisputeDrawer(false)
    window.setTimeout(() => {
      lastDisputeTriggerRef.current?.focus?.()
    }, 0)
  }, [])

  const openDisputeDrawer = useCallback((triggerEl = null) => {
    if (triggerEl instanceof HTMLElement) {
      lastDisputeTriggerRef.current = triggerEl
    } else if (document.activeElement instanceof HTMLElement) {
      lastDisputeTriggerRef.current = document.activeElement
    }
    setShowHelpPopover(false)
    setShowDisputeDrawer(true)
  }, [])

  useEffect(() => {
    if (!showDisputeDrawer && !showQrSpotlight) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    if (showDisputeDrawer) {
      window.setTimeout(() => {
        disputeSelectRef.current?.focus?.()
      }, 50)
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (showQrSpotlight) setShowQrSpotlight(false)
        if (showDisputeDrawer) closeDisputeDrawer()
        return
      }
      if (
        event.key === "Tab" &&
        showDisputeDrawer &&
        disputeDrawerRef.current
      ) {
        const focusable = disputeDrawerRef.current.querySelectorAll(
          'button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [showDisputeDrawer, showQrSpotlight, closeDisputeDrawer])

  // Danh sách các buổi đã qua trong 30 ngày gần nhất của các khóa hội viên đang học (Mục 4.5.3)
  // Không đưa buổi đã hủy vào danh sách. Gắn trạng thái điểm danh hiện tại, xếp buổi chưa có trạng thái "Có mặt" lên đầu, sau đó giảm dần theo thời gian.
  const pastSessionsForDispute = useMemo(() => {
    const list = allNormalizedSessions.filter((s) => {
      if (isSessionCancelled(s)) return false
      if (!s.sessionDate) return false
      const isPast =
        s.sessionDate < todayIso ||
        (s.sessionDate === todayIso && s.startMs !== null && s.startMs <= clockNow)
      return isPast && s.sessionDate >= minDisputeIso
    })
    return list
      .map((s, idx) => {
        const record = findSessionAttendanceRecord(s, attendanceRows)
        const attendanceStateKey = record
          ? normalizeAttendanceStateKey(record.state || record.status)
          : "pending"
        const attendanceBadge = getAttendanceBadgeMeta(attendanceStateKey, t)
        const displayClassName =
          s.className ||
          (s.isPrivate
            ? t("schedulePtDefaultTitle")
            : s.subjectName || `#${s.classId}`)
        return {
          ...s,
          attendanceStateKey,
          attendanceStatusLabel: attendanceBadge.label,
          displayClassName,
          optionKey: String(
            s.id ?? `${s.classId || "c"}-${s.sessionDate}-${s.startTime}-${idx}`,
          ),
        }
      })
      .sort((a, b) => {
        const aIsPresent = a.attendanceStateKey === "present" ? 1 : 0
        const bIsPresent = b.attendanceStateKey === "present" ? 1 : 0
        if (aIsPresent !== bIsPresent) return aIsPresent - bIsPresent
        const dateCmp = String(b.sessionDate || "").localeCompare(
          String(a.sessionDate || ""),
        )
        if (dateCmp !== 0) return dateCmp
        return String(b.startTime || "").localeCompare(String(a.startTime || ""))
      })
  }, [allNormalizedSessions, todayIso, clockNow, minDisputeIso, attendanceRows, t])

  const selectedDisputeSession = useMemo(
    () =>
      pastSessionsForDispute.find(
        (s) => s.optionKey === selectedDisputeSessionKey,
      ) || null,
    [pastSessionsForDispute, selectedDisputeSessionKey],
  )

  // Kiểm tra lỗi thứ tự ngày lọc lịch sử (Mục 4.4: Từ ngày <= Đến ngày)
  const hasDateOrderError = Boolean(
    historyDateFrom && historyDateTo && historyDateFrom > historyDateTo,
  )

  // Làm giàu dữ liệu lịch sử điểm danh (ghép giờ bắt đầu-kết thúc và sân từ danh sách buổi học nếu bản ghi lịch sử chưa có)
  const enrichedAttendanceRows = useMemo(() => {
    return attendanceRows.map((row) => {
      const dateIso = String(row.sessionDate || row.checkInTime || "").slice(
        0,
        10,
      )
      const matchedSession =
        (row.sessionId != null &&
          sessionLookupMap.byId.get(String(row.sessionId))) ||
        (row.classId != null &&
          dateIso &&
          sessionLookupMap.byClassAndDate.get(`${row.classId}:${dateIso}`)) ||
        null

      const startTime = formatLocalTime(
        row.startTime ||
          row.sessionStartTime ||
          matchedSession?.startTime ||
          null,
      )
      const endTime = formatLocalTime(
        row.endTime || row.sessionEndTime || matchedSession?.endTime || null,
      )
      const roomName =
        row.roomName ||
        row.roomLocation ||
        row.room ||
        matchedSession?.roomName ||
        null
      const checkInTimeHhMm = extractTimeFromIso(
        row.checkInTime || row.checkedInAt || row.recordedAt,
      )
      const scannerName =
        row.scannedByName ||
        row.recordedByName ||
        row.checkedInBy ||
        row.staffName ||
        null
      const stateKey = normalizeAttendanceStateKey(row.state || row.status)

      return {
        ...row,
        dateIso,
        dateFormatted: toDateDdMmYyyy(dateIso) || "—",
        startTime,
        endTime,
        roomName,
        checkInTimeHhMm,
        scannerName,
        stateKey,
      }
    })
  }, [attendanceRows, sessionLookupMap])

  // Lọc theo ô tìm kiếm & khoảng ngày (làm cơ sở tính số đếm nhất quán trên các chip lọc trạng thái - Mục 4.4)
  const baseFilteredAttendance = useMemo(() => {
    if (hasDateOrderError) return []
    const query = historySearch.trim().toLocaleLowerCase(isVi ? "vi" : "en")
    return enrichedAttendanceRows.filter((row) => {
      const matchesSearch =
        !query ||
        String(row.className || "")
          .toLocaleLowerCase(isVi ? "vi" : "en")
          .includes(query)
      const matchesDateFrom = !historyDateFrom || row.dateIso >= historyDateFrom
      const matchesDateTo = !historyDateTo || row.dateIso <= historyDateTo
      return matchesSearch && matchesDateFrom && matchesDateTo
    })
  }, [
    enrichedAttendanceRows,
    hasDateOrderError,
    historySearch,
    historyDateFrom,
    historyDateTo,
    isVi,
  ])

  // Số đếm trên từng chip trạng thái khớp với bộ lọc tìm kiếm/ngày hiện tại (Mục 3.4 & 4.4)
  const historyCounts = useMemo(() => {
    const counts = {
      all: baseFilteredAttendance.length,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
    }
    for (const row of baseFilteredAttendance) {
      if (row.stateKey === "present") counts.present += 1
      else if (row.stateKey === "late") counts.late += 1
      else if (row.stateKey === "absent") counts.absent += 1
      else if (row.stateKey === "excused") counts.excused += 1
    }
    return counts
  }, [baseFilteredAttendance])

  const filteredAttendance = useMemo(() => {
    if (historyStatus === "all") return baseFilteredAttendance
    return baseFilteredAttendance.filter(
      (row) => row.stateKey === historyStatus,
    )
  }, [baseFilteredAttendance, historyStatus])

  // Reset phân trang khi đổi bộ lọc
  useEffect(() => {
    setVisibleHistoryCount(HISTORY_PAGE_SIZE)
  }, [historySearch, historyStatus, historyDateFrom, historyDateTo])

  const visibleAttendanceRows = useMemo(
    () => filteredAttendance.slice(0, visibleHistoryCount),
    [filteredAttendance, visibleHistoryCount],
  )

  const hasHistoryFilters = Boolean(
    historySearch.trim() ||
      historyStatus !== "all" ||
      historyDateFrom ||
      historyDateTo,
  )

  const clearHistoryFilters = () => {
    setHistorySearch("")
    setHistoryStatus("all")
    setHistoryDateFrom("")
    setHistoryDateTo("")
  }

  // Sao chép thông tin báo thiếu buổi tập gồm: tên hội viên, lớp, ngày, giờ, sân, ghi chú (nếu có)
  const handleCopyDisputeInfo = async (event) => {
    event.preventDefault()
    if (!selectedDisputeSession) return

    const memberDisplayName =
      currentUser?.fullName ||
      currentUser?.name ||
      currentUser?.username ||
      `#${memberId}`
    const timeRange =
      selectedDisputeSession.startTime !== "—" &&
      selectedDisputeSession.endTime !== "—"
        ? `${selectedDisputeSession.startTime}–${selectedDisputeSession.endTime}`
        : selectedDisputeSession.startTime
    const roomStr = selectedDisputeSession.roomName || t("scheduleRoomTbd")
    const lines = [
      `[${t("checkinDisputeCopyTemplateHeader")}]`,
      `- ${t("checkinDisputeCopyMember")}: ${memberDisplayName}`,
      `- ${t("checkinDisputeFieldClass")}: ${selectedDisputeSession.displayClassName || selectedDisputeSession.className || selectedDisputeSession.subjectName || "—"}`,
      `- ${t("checkinDisputeFieldDate")}: ${toDateDdMmYyyy(selectedDisputeSession.sessionDate)}`,
      `- ${t("checkinDisputeFieldTime")}: ${timeRange}`,
      `- ${t("checkinDisputeFieldRoom")}: ${roomStr}`,
      `- ${t("checkinDisputeFieldStatus")}: ${selectedDisputeSession.attendanceStatusLabel}`,
    ]
    if (disputeNote.trim()) {
      lines.push(
        `- ${t("checkinDisputeNoteLabel")}: ${disputeNote.trim()}`,
      )
    }
    const summaryText = lines.join("\n")

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(summaryText)
      }
      setCopiedBanner(true)
      showToast?.(t("checkinDisputeCopiedConfirm"), "success")
      window.setTimeout(() => setCopiedBanner(false), 3000)
    } catch {
      setCopiedBanner(true)
      window.setTimeout(() => setCopiedBanner(false), 3000)
    }
  }

  // Render dòng buổi học trong card Lịch trình học tập (Mục 4.3)
  const renderScheduleRowItem = (session, index) => {
    const record = findSessionAttendanceRecord(session, attendanceRows)
    const cancelled = isSessionCancelled(session)
    const inWindow = isSessionInCheckinWindow(session, clockNow)
    const recordStateKey = record
      ? normalizeAttendanceStateKey(record.state)
      : null
    const isCheckedIn =
      recordStateKey === "present" || recordStateKey === "late"
    const isOngoing =
      !cancelled &&
      session.startMs !== null &&
      session.endMs !== null &&
      clockNow >= session.startMs &&
      clockNow <= session.endMs

    let statusBadge = {
      icon: "○",
      label: t("checkinStatusUpcoming"),
      className: "bg-slate-100 text-slate-800 border-slate-300",
    }
    if (cancelled) {
      statusBadge = {
        icon: "✕",
        label: t("checkinStatusCancelled"),
        className: "bg-rose-50 text-rose-800 border-rose-200",
      }
    } else if (isCheckedIn) {
      statusBadge = {
        icon: "✓",
        label: t("checkinStatusCheckedIn"),
        className: "bg-emerald-50 text-emerald-800 border-emerald-200",
      }
    } else if (isOngoing) {
      statusBadge = {
        icon: "●",
        label: t("checkinStatusOngoing"),
        className: "bg-blue-50 text-blue-800 border-blue-200",
      }
    }

    const timeRange =
      session.startTime !== "—" && session.endTime !== "—"
        ? `${session.startTime}–${session.endTime}`
        : session.startTime
    const sessionTitle =
      session.className ||
      (session.isPrivate
        ? t("schedulePtDefaultTitle")
        : session.subjectName || `#${session.classId}`)

    return (
      <article
        key={session.id || `${session.classId}-${session.sessionDate}-${index}`}
        className={`rounded-xl border p-3.5 transition-colors flex flex-wrap items-center justify-between gap-3 ${
          inWindow && !isCheckedIn
            ? "border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200"
            : cancelled
              ? "border-slate-200 bg-slate-50/70 text-slate-400"
              : "border-slate-200/90 bg-slate-50/40"
        }`}
      >
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-brand-accent-dark">
              {session.subjectName || "VIBE SPORT"}
            </span>
            {session.isPrivate && (
              <span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold text-slate-700">
                {t("checkinPtSessionBadge")}
              </span>
            )}
            {inWindow && !isCheckedIn && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900">
                <span aria-hidden="true">●</span>
                <span>{t("checkinWindowActiveBadge")}</span>
              </span>
            )}
          </div>

          <h3
            className={`text-sm font-extrabold ${
              cancelled ? "line-through text-slate-400" : "text-slate-900"
            }`}
          >
            {sessionTitle}
          </h3>

          <p className="text-xs font-medium text-slate-700">
            {toDateDdMmYyyy(session.sessionDate)} · {timeRange} ·{" "}
            {session.roomName || t("scheduleRoomTbd")}
            {session.coachName ? ` · ${session.coachName}` : ""}
          </p>

          {cancelled && session.replacedByDate && (
            <p className="text-xs font-semibold text-slate-600">
              {tr("scheduleReplacedByDate", { date: session.replacedByDate })}
            </p>
          )}
        </div>

        <span
          className={`inline-flex items-center gap-1 shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${statusBadge.className}`}
        >
          <span aria-hidden="true">{statusBadge.icon}</span>
          <span>{statusBadge.label}</span>
        </span>
      </article>
    )
  }

  // Khối "Cách điểm danh" (3 bước ngắn):
  // - Khi QR khóa trên màn hình lớn (lg): đặt trong card "Lịch trình học tập" (dưới danh sách buổi) để hai card cân chiều cao.
  // - Khi QR hoạt động trên màn hình lớn (lg): đặt trong card QR như cũ.
  // - Trên mobile 1 cột (< lg): luôn nằm ngay sau QR, trước Lịch trình học tập.
  const renderHowToStepsBox = (extraClassName = "") => (
    <div
      className={`rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-3 ${extraClassName}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-800">
          {t("checkinHowToTitle")}
        </p>
        <button
          type="button"
          aria-expanded={showHowToSteps}
          onClick={() => setShowHowToSteps((prev) => !prev)}
          className="sm:hidden inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
        >
          {showHowToSteps ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <ol
        className={`${
          showHowToSteps ? "mt-2 block" : "hidden sm:mt-2 sm:block"
        } space-y-1.5 text-xs text-slate-600`}
      >
        <li className="flex items-start gap-2">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-200/80 text-[11px] font-bold text-slate-700">
            1
          </span>
          <span>{t("checkinHowToStep1")}</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-200/80 text-[11px] font-bold text-slate-700">
            2
          </span>
          <span>{t("checkinHowToStep2")}</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-200/80 text-[11px] font-bold text-slate-700">
            3
          </span>
          <span>{t("checkinHowToStep3")}</span>
        </li>
      </ol>
    </div>
  )

  return (
    <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-6 sm:px-7 sm:py-8">
      {/* 4.1 Header: giữ tiêu đề, mô tả tự nhiên và nút Tải lại (icon, có trạng thái đang tải); bỏ nút Yêu cầu đối soát + nhãn Bản nháp */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-brand-accent-dark">
            {t("checkinBrand")}
          </p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">
            {t("checkinPageTitle")}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {t("checkinPageSubtitle")}
          </p>
        </div>

        <div className="group relative">
          <button
            type="button"
            onClick={reloadAll}
            disabled={refreshingCode || scheduleLoading || historyLoading}
            aria-label={t("checkinBtnRefresh")}
            title={t("checkinRefreshShortcutHint")}
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 p-2 text-slate-700 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshingCode || scheduleLoading || historyLoading
                  ? "animate-spin"
                  : ""
              }`}
            />
          </button>
        </div>
      </header>

      {!validMember && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {t("checkinUnlinkedAccount")}
        </div>
      )}

      {/* 4.6 Bố cục 2 cột trên màn hình rộng; Mobile 1 cột: thứ tự QR, Cách điểm danh, Lịch trình */}
      <section className="grid items-start lg:items-stretch gap-5 lg:grid-cols-12">
        {/* 4.2 Card Mã QR điểm danh */}
        <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 lg:col-span-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-brand-accent-dark shrink-0" />
              <h2 className="text-lg font-extrabold text-slate-900">
                {t("checkinQrCardTitle")}
              </h2>
            </div>

            {/* 4.2.6 Liên kết "Gặp sự cố?" mở hộp nhỏ (popover) */}
            <div className="relative" ref={helpPopoverRef}>
              <button
                type="button"
                aria-expanded={showHelpPopover}
                onClick={() => setShowHelpPopover((prev) => !prev)}
                className="min-h-[40px] inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
              >
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>{t("checkinNeedHelp")}</span>
              </button>

              {showHelpPopover && (
                <div
                  role="dialog"
                  aria-label={t("checkinHelpTitle")}
                  className="absolute right-0 top-full z-40 mt-1.5 w-72 sm:w-80 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-700 shadow-xl space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-slate-900">
                      {t("checkinHelpTitle")}
                    </p>
                    <button
                      type="button"
                      aria-label={t("checkinclose")}
                      onClick={() => setShowHelpPopover(false)}
                      className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <ul className="list-disc pl-4 space-y-1.5 leading-relaxed text-slate-600">
                    <li>{t("checkinHelpTipBrightness")}</li>
                    <li>{t("checkinHelpTipReload")}</li>
                    <li>{t("checkinHelpTipManual")}</li>
                  </ul>

                  <div className="border-t border-slate-100 pt-2.5">
                    <button
                      type="button"
                      onClick={(e) => openDisputeDrawer(e.currentTarget)}
                      className="min-h-[36px] w-full inline-flex items-center justify-between rounded-lg bg-slate-50 hover:bg-slate-100 px-3 py-2 text-xs font-bold text-brand-accent-dark transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
                    >
                      <span>{t("checkinMissingSessionLink")}</span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3.2 Nội dung Card QR theo 5 trạng thái */}
          <div className="mt-4 flex flex-1 min-h-[250px] w-full flex-col items-center justify-center rounded-2xl bg-slate-50 border border-slate-200/70 p-4 text-center">
            {scheduleLoading ? (
              <div
                aria-busy="true"
                className="w-full max-w-[240px] space-y-3 py-6 animate-pulse"
              >
                <div className="mx-auto h-40 w-40 rounded-xl bg-slate-200" />
                <div className="mx-auto h-5 w-32 rounded bg-slate-200" />
                <div className="mx-auto h-3 w-44 rounded bg-slate-200" />
              </div>
            ) : qrContext.mode === "active" ? (
              /* TRẠNG THÁI 1: ĐANG HOẠT ĐỘNG (Hoặc LỖI LÀM MỚI) */
              <div className="w-full space-y-3">
                {/* 4.2.3 Hiển thị rõ buổi đang áp dụng: tên lớp, giờ bắt đầu–kết thúc, sân */}
                {qrContext.session && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-950">
                    <p className="font-extrabold">
                      {qrContext.session.className ||
                        qrContext.session.subjectName}
                    </p>
                    <p className="mt-0.5 font-medium text-emerald-800">
                      {qrContext.session.startTime}–{qrContext.session.endTime}{" "}
                      · {qrContext.session.roomName || t("scheduleRoomTbd")}
                    </p>
                  </div>
                )}

                {code && secondsLeft > 0 && !codeError ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowQrSpotlight(true)}
                      aria-label={t("checkinEnlargeQrAria")}
                      className="group relative mx-auto inline-flex flex-col items-center overflow-hidden rounded-xl bg-white p-3 shadow-xs ring-1 ring-slate-200 transition hover:shadow-md hover:ring-brand-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
                    >
                      <QRCodeSVG
                        value={code}
                        size={188}
                        level="M"
                        includeMargin
                      />
                      <span className="mt-1 text-xs font-semibold text-slate-500 group-hover:text-brand-primary">
                        {t("checkinEnlargeQr")}
                      </span>
                    </button>

                    {/* 4.2.7 Mã số 6 chữ số kèm nhãn nhỏ "Mã nhập tay" & hỗ trợ trình đọc màn hình */}
                    <div className="space-y-0.5">
                      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {t("checkinManualCodeLabel")}
                      </span>
                      <p
                        aria-label={`${t("checkinManualCodeLabel")}: ${String(code).split("").join(" ")}`}
                        className="font-mono text-2xl font-black tracking-[.26em] text-slate-950"
                      >
                        {code}
                      </p>
                    </div>

                    {/* 4.2.5 & 4.8 Thanh đếm ngược (không đọc mỗi giây) */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-slate-600">
                        {refreshingCode ? (
                          <span>{t("checkinRefreshingCode")}</span>
                        ) : (
                          <>
                            {t("checkinNewCodeIn")}{" "}
                            <strong className="font-bold tabular-nums text-brand-primary">
                              {secondsLeft}s
                            </strong>
                          </>
                        )}
                      </p>
                      <div
                        role="progressbar"
                        aria-label={t("checkinNewCodeIn")}
                        aria-valuenow={secondsLeft}
                        aria-valuemin={0}
                        aria-valuemax={codeDuration}
                        className="mx-auto h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-slate-200"
                      >
                        <div
                          className="h-full bg-brand-primary transition-[width] duration-300"
                          style={{
                            width: `${Math.min(100, Math.max(0, (secondsLeft / codeDuration) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  /* TRẠNG THÁI 5: LỖI LÀM MỚI — Làm mờ mã cũ, không bao giờ hiển thị mã hết hạn như còn hiệu lực */
                  <div className="space-y-3 py-3" role="alert">
                    <div className="relative mx-auto w-fit">
                      <div
                        aria-hidden="true"
                        className="rounded-xl bg-white p-3 opacity-35 blur-[4px] select-none pointer-events-none"
                      >
                        <LockedQrPlaceholderPattern size={172} />
                      </div>
                      <div className=" inset-0 flex flex-col items-center justify-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-900 border border-rose-200">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>{t("checkinStateErrorTitle")}</span>
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600">
                      {t("checkinStateErrorSub")}
                    </p>

                    <button
                      type="button"
                      onClick={refreshCode}
                      disabled={refreshingCode}
                      className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-primary hover:bg-brand-primary-hover px-4 py-2 text-xs font-bold text-white shadow-2xs disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${refreshingCode ? "animate-spin" : ""}`}
                      />
                      <span>{t("checkinBtnRetry")}</span>
                    </button>
                  </div>
                )}
              </div>
            ) : qrContext.mode === "checked_in" ? (
              /* TRẠNG THÁI 2: ĐÃ ĐIỂM DANH */
              <div className="space-y-2.5 py-6">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  { qrContext.record &&
                  extractTimeFromIso(
                    qrContext.record.checkInTime ||
                      qrContext.record.checkedInAt,
                  )
                    ? tr("checkinStateCheckedInTime", {
                        time: extractTimeFromIso(
                          qrContext.record.checkInTime ||
                            qrContext.record.checkedInAt,
                        ),
                      })
                    : t("checkinStateCheckedInTitle")}
                </h3>
                {qrContext.session && (
                  <p className="text-xs font-medium text-slate-600">
                    {qrContext.session.className ||
                      qrContext.session.subjectName}{" "}
                    · {qrContext.session.startTime}–{qrContext.session.endTime}{" "}
                    · {qrContext.session.roomName || t("scheduleRoomTbd")}
                  </p>
                )}
              </div>
            ) : (
              /* TRẠNG THÁI 3: KHÓA MÃ QR (Không có buổi trong khung điểm danh) */
              <div className="w-full space-y-3.5 py-2">
                {/* Hình QR mờ dạng placeholder (họa tiết giả cố định không giải mã được) với biểu tượng khóa ở giữa */}
                <div className="relative mx-auto flex h-44 w-44 items-center justify-center rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs">
                  <div
                    aria-hidden="true"
                    className="opacity-20 blur-[1.5px] select-none pointer-events-none"
                  >
                    <LockedQrPlaceholderPattern size={148} />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-sm">
                      <Lock className="h-5 w-5" />
                    </span>
                  </div>
                </div>

                {qrContext.nextLockedSession ? (
                  <div className="space-y-1.5 px-2">
                    <p className="text-sm font-bold text-slate-900">
                      {tr("checkinQrLockedOpenAt", {
                        time: qrContext.openTimeFormatted,
                        date: qrContext.openDateFormatted,
                      })}
                    </p>
                    {qrContext.countdown && (
                      <p className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {qrContext.countdown.days >= 1
                          ? tr("checkinQrLockedCountdownDays", {
                              days: qrContext.countdown.days,
                              hours: qrContext.countdown.hours,
                            })
                          : tr("checkinQrLockedCountdownHours", {
                              hours: qrContext.countdown.hours,
                              minutes: qrContext.countdown.minutes,
                            })}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="px-2 text-sm font-bold text-slate-700">
                    {t("checkinQrLockedNoSession")}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 4.2.1 & 4.2.2 Ẩn dòng hướng dẫn quét/15s khi không có mã đang hoạt động */}
          {isQrActiveMode && code && secondsLeft > 0 && !codeError && (
            <p className="mt-3 text-center text-xs leading-relaxed text-slate-600">
              {tr("checkinQrGuideShort", { seconds: codeDuration })}
            </p>
          )}

          {/* 4.2.8 Dòng "Cập nhật lúc HH:mm:ss" nhỏ, nhạt */}
          {isQrActiveMode && codeUpdatedAt && (
            <p className="mt-1 text-center text-xs text-slate-400">
              {tr("checkinUpdatedAt", {
                time: TIME_FORMATTER_HHMMSS.format(codeUpdatedAt),
              })}
            </p>
          )}

          {/* Khi QR hoạt động: giữ "Cách điểm danh" trong card QR; trên mobile (< lg): luôn hiển thị ngay dưới QR để giữ thứ tự QR -> Cách điểm danh -> Lịch trình */}
          {renderHowToStepsBox(
            qrContext.mode === "locked" ? "mt-4 lg:hidden" : "mt-4",
          )}
        </article>

        {/* 4.3 Card Lịch trình học tập */}
        <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-brand-accent-dark shrink-0" />
              <h2 className="text-lg font-extrabold text-slate-900">
                {t("checkinScheduleCardTitle")}
              </h2>
            </div>

            <div
              className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1"
              role="tablist"
              aria-label={t("checkinScheduleCardTitle")}
            >
              <button
                type="button"
                role="tab"
                aria-selected={scheduleTab === "today"}
                onClick={() => setScheduleTab("today")}
                className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer ${
                  scheduleTab === "today"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t("checkinTabToday")} (
                {scheduleLoading || scheduleFailed
                  ? "–"
                  : todayValidSessions.length}
                )
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={scheduleTab === "upcoming"}
                onClick={() => setScheduleTab("upcoming")}
                className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer ${
                  scheduleTab === "upcoming"
                    ? "bg-white text-slate-900 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t("checkinTabUpcoming")} (
                {scheduleLoading || scheduleFailed
                  ? "–"
                  : upcomingValidSessions.length}
                )
              </button>
            </div>
          </div>

          <div className="mt-4">
            {scheduleLoading ? (
              <div
                aria-busy="true"
                className="space-y-3 py-2"
              >
                {[0, 1].map((key) => (
                  <div
                    key={key}
                    className="animate-pulse rounded-xl bg-slate-100 p-4 space-y-2"
                  >
                    <div className="h-3 w-1/4 rounded bg-slate-200" />
                    <div className="h-4 w-2/3 rounded bg-slate-200" />
                    <div className="h-3 w-1/2 rounded bg-slate-200" />
                  </div>
                ))}
              </div>
            ) : scheduleFailed ? (
              <div
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-status-error flex flex-wrap items-center justify-between gap-3"
              >
                <span>{scheduleError}</span>
                <button
                  type="button"
                  onClick={refreshSchedule}
                  className="min-h-[36px] rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
                >
                  {t("checkinBtnRetry")}
                </button>
              </div>
            ) : scheduleTab === "today" ? (
              todayValidSessions.length > 0 ? (
                <div className="space-y-2.5">
                  {todayValidSessions.map((session, idx) =>
                    renderScheduleRowItem(session, idx),
                  )}
                </div>
              ) : activeEnrollmentsCount === 0 ? (
                /* 4.3 Trạng thái rỗng khi hội viên CHƯA có khóa nào: hiện nút Đăng ký khóa học */
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-5 py-6 text-center space-y-2.5">
                  <p className="text-sm font-bold text-slate-800">
                    {t("checkinEmptyNoCourse")}
                  </p>
                  <Link
                    to="/member/catalog"
                    className="min-h-[40px] inline-flex items-center justify-center rounded-lg bg-brand-primary hover:bg-brand-primary-hover px-4 py-2 text-xs font-bold text-white shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  >
                    {t("checkinBtnRegisterCourse")}
                  </Link>
                </div>
              ) : (
                /* 4.3 Trạng thái rỗng khi hội viên ĐÃ có khóa nhưng hôm nay không có buổi: kèm buổi kế tiếp, KHÔNG có nút đăng ký */
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-5 py-5 text-center space-y-1.5">
                  <p className="text-sm font-bold text-slate-800">
                    {t("checkinEmptyTodayHasCourse")}
                  </p>
                  {nextFutureValidSession && (
                    <p className="text-xs font-medium text-slate-600">
                      {tr("checkinNextSessionLabel", {
                        date: toDateDdMmYyyy(
                          nextFutureValidSession.sessionDate,
                        ),
                        time: `${nextFutureValidSession.startTime}–${nextFutureValidSession.endTime}`,
                        room:
                          nextFutureValidSession.roomName ||
                          t("scheduleRoomTbd"),
                      })}
                    </p>
                  )}
                </div>
              )
            ) : upcomingValidSessions.length > 0 ? (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {upcomingValidSessions.map((session, idx) =>
                  renderScheduleRowItem(session, idx),
                )}
              </div>
            ) : activeEnrollmentsCount === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-5 py-6 text-center space-y-2.5">
                <p className="text-sm font-bold text-slate-800">
                  {t("checkinEmptyNoCourse")}
                </p>
                <Link
                  to="/member/catalog"
                  className="min-h-[40px] inline-flex items-center justify-center rounded-lg bg-brand-primary hover:bg-brand-primary-hover px-4 py-2 text-xs font-bold text-white shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  {t("checkinBtnRegisterCourse")}
                </Link>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-5 py-5 text-center space-y-1.5">
                <p className="text-sm font-bold text-slate-800">
                  {tr("checkinEmptyUpcomingHasCourse", {
                    days: UPCOMING_SCHEDULE_LOOKAHEAD_DAYS,
                  })}
                </p>
                {nextFutureValidSession && (
                  <p className="text-xs font-medium text-slate-600">
                    {tr("checkinNextSessionLabel", {
                      date: toDateDdMmYyyy(nextFutureValidSession.sessionDate),
                      time: `${nextFutureValidSession.startTime}–${nextFutureValidSession.endTime}`,
                      room:
                        nextFutureValidSession.roomName ||
                        t("scheduleRoomTbd"),
                    })}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Khi QR ở trạng thái khóa trên màn hình lớn (lg): đặt khối "Cách điểm danh" dưới danh sách buổi để hai card cân chiều cao */}
          {qrContext.mode === "locked" &&
            renderHowToStepsBox("hidden lg:block mt-4")}
        </article>
      </section>

      {/* 4.4 Lịch sử điểm danh */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-brand-accent-dark shrink-0" />
            <h2 className="text-lg font-extrabold text-slate-900">
              {t("checkinHistoryCardTitle")}
            </h2>
          </div>

          {/* 4.4 & 4.5.1 Lối vào chính của chức năng đối soát */}
          <button
            type="button"
            onClick={(e) => openDisputeDrawer(e.currentTarget)}
            className="min-h-[40px] inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-brand-accent-dark hover:bg-brand-accent-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
          >
            <span>{t("checkinMissingSessionLink")}</span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </button>
        </div>

        {/* Bộ lọc tìm kiếm & khoảng ngày */}
        <div className="grid gap-3 sm:grid-cols-[minmax(200px,1fr)_180px_180px] items-end">
          <div>
            <label
              htmlFor="checkin-history-search"
              className="block text-xs font-semibold text-slate-600 mb-1"
            >
              {t("search")}
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                id="checkin-history-search"
                ref={historySearchRef}
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder={t("checkinSearchPlaceholder")}
                className="min-h-[40px] w-full rounded-lg border border-slate-200 py-2 pl-9 pr-10 text-xs text-slate-900 outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute right-2.5 top-2.5 inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-400"
              >
                /
              </span>
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-600">
              {t("checkinFilterFromDate")}
            </span>
            <LocalDatePicker
              value={historyDateFrom}
              onChange={setHistoryDateFrom}
              isVi={isVi}
              label={t("checkinFilterFromDate")}
              max={todayIso}
              error={hasDateOrderError}
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-600">
              {t("checkinFilterToDate")}
            </span>
            <LocalDatePicker
              value={historyDateTo}
              onChange={setHistoryDateTo}
              isVi={isVi}
              label={t("checkinFilterToDate")}
              max={todayIso}
              error={hasDateOrderError}
            />
          </div>
        </div>

        {/* Báo lỗi nhỏ tại chỗ nếu Từ ngày > Đến ngày (Mục 4.4) */}
        {hasDateOrderError && (
          <p
            role="alert"
            className="text-xs font-semibold text-rose-700 flex items-center gap-1.5"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{t("checkinDateOrderError")}</span>
          </p>
        )}

        {/* 4.4 Chip lọc trạng thái: chip đang chọn nhìn rõ (nền đậm + chữ trắng), chip số đếm 0 làm mờ nhưng vẫn bấm được */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label={t("filter")}
          >
            {[
              {
                key: "all",
                icon: null,
                label: t("checkinFilterAll"),
                count: historyCounts.all,
              },
              {
                key: "present",
                icon: "✓",
                label: t("checkinFilterPresent"),
                count: historyCounts.present,
              },
              {
                key: "late",
                icon: "◑",
                label: t("checkinFilterLate"),
                count: historyCounts.late,
              },
              {
                key: "absent",
                icon: "✕",
                label: t("checkinFilterAbsent"),
                count: historyCounts.absent,
              },
              {
                key: "excused",
                icon: "◈",
                label: t("checkinFilterExcused"),
                count: historyCounts.excused,
              },
            ].map((chip) => {
              const isSelected = historyStatus === chip.key
              const isZero =
                !historyLoading && !historyFailed && chip.count === 0
              return (
                <button
                  key={chip.key}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setHistoryStatus(chip.key)}
                  className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer ${
                    isSelected
                      ? "border-slate-900 bg-slate-900 text-white shadow-2xs"
                      : isZero
                        ? "border-slate-200 bg-slate-50 text-slate-400 opacity-65 hover:opacity-100"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {chip.icon && <span aria-hidden="true">{chip.icon}</span>}
                  <span>
                    {chip.label} (
                    {historyLoading || historyFailed ? "–" : chip.count})
                  </span>
                </button>
              )
            })}
          </div>

          {hasHistoryFilters && (
            <button
              type="button"
              onClick={clearHistoryFilters}
              className="min-h-[40px] inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 underline hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
              <span>{t("checkinClearFilters")}</span>
            </button>
          )}
        </div>

        {/* Nội dung danh sách Lịch sử điểm danh */}
        {historyFailed ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-status-error"
          >
            <span>{historyError}</span>
            <button
              type="button"
              onClick={refreshHistory}
              className="min-h-[36px] rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
            >
              {t("checkinBtnRetry")}
            </button>
          </div>
        ) : historyLoading ? (
          <div aria-busy="true" className="space-y-3 py-2">
            {[0, 1, 2].map((key) => (
              <div
                key={key}
                className="animate-pulse border-b border-slate-100 py-3 space-y-2"
              >
                <div className="h-4 w-1/3 rounded bg-slate-200" />
                <div className="h-3 w-1/2 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : visibleAttendanceRows.length > 0 ? (
          <div className="space-y-3">
            <div className="divide-y divide-slate-100">
              {visibleAttendanceRows.map((row, index) => {
                const badge = getAttendanceBadgeMeta(row.stateKey, t)
                const timeRangeStr =
                  row.startTime !== "—" && row.endTime !== "—"
                    ? `${row.startTime}–${row.endTime}`
                    : row.startTime !== "—"
                      ? row.startTime
                      : null

                return (
                  <article
                    key={
                      row.attendanceId ||
                      row.id ||
                      `${row.sessionId || "att"}-${index}`
                    }
                    className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-1"
                  >
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-sm font-extrabold text-slate-900">
                        {row.className ||
                          row.subjectName ||
                          `#${row.sessionId || index + 1}`}
                      </h3>

                      {/* 4.4 Mỗi dòng gồm: ngày dd/MM/yyyy, giờ bắt đầu–kết thúc, sân */}
                      <p className="text-xs font-medium text-slate-700">
                        {row.dateFormatted}
                        {timeRangeStr ? ` · ${timeRangeStr}` : ""}
                        {` · ${row.roomName || t("scheduleRoomTbd")}`}
                      </p>

                      {/* Giờ điểm danh thực tế & người quét nếu API có trả về */}
                      {(row.checkInTimeHhMm || row.scannerName) && (
                        <p className="text-xs text-slate-500">
                          {row.checkInTimeHhMm
                            ? tr("checkinCheckedInAtLabel", {
                                time: row.checkInTimeHhMm,
                              })
                            : ""}
                          {row.checkInTimeHhMm && row.scannerName ? " · " : ""}
                          {row.scannerName
                            ? tr("checkinScannedByLabel", {
                                scanner: row.scannerName,
                              })
                            : ""}
                        </p>
                      )}
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${badge.className}`}
                    >
                      <span aria-hidden="true">{badge.icon}</span>
                      <span>{badge.label}</span>
                    </span>
                  </article>
                )
              })}
            </div>

            {/* Tổng số bản ghi & nút Tải thêm */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-500">
                {tr("checkinHistoryTotalCount", {
                  shown: visibleAttendanceRows.length,
                  total: filteredAttendance.length,
                })}
              </span>

              {visibleHistoryCount < filteredAttendance.length && (
                <button
                  type="button"
                  onClick={() =>
                    setVisibleHistoryCount(
                      (prev) => prev + HISTORY_PAGE_SIZE,
                    )
                  }
                  className="min-h-[40px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
                >
                  {tr("checkinLoadMore", {
                    remaining:
                      filteredAttendance.length - visibleHistoryCount,
                  })}
                </button>
              )}
            </div>
          </div>
        ) : (
          /* 4.4 Trạng thái rỗng phân biệt "Chưa có lịch sử điểm danh" và "Không có kết quả phù hợp bộ lọc" */
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center space-y-2">
            <ClipboardList className="h-7 w-7 text-slate-400" />
            {attendanceRows.length > 0 && hasHistoryFilters ? (
              <>
                <p className="text-sm font-bold text-slate-800">
                  {t("checkinEmptyHistoryFiltered")}
                </p>
                <button
                  type="button"
                  onClick={clearHistoryFilters}
                  className="min-h-[40px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
                >
                  {t("checkinClearFilters")}
                </button>
              </>
            ) : (
              <p className="text-sm font-medium text-slate-600">
                {t("checkinEmptyHistoryAll")}
              </p>
            )}
          </div>
        )}
      </section>

      <AnimatePresence>
        {/* Modal phóng to mã QR */}
        {showQrSpotlight && isQrActiveMode && code && secondsLeft > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget)
                setShowQrSpotlight(false)
            }}
          >
            <motion.section
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.16 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="qr-spotlight-title"
              className="relative flex w-full max-w-md flex-col items-center rounded-3xl bg-white p-6 text-center shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setShowQrSpotlight(false)}
                aria-label={t("checkinCloseSpotlightAria")}
                className="min-h-[40px] min-w-[40px] absolute right-3 top-3 inline-flex items-center justify-center rounded-full p-2 text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <p
                id="qr-spotlight-title"
                className="text-xs font-bold uppercase tracking-wider text-brand-accent-dark"
              >
                {t("checkinQrCardTitle")}
              </p>

              {qrContext.session && (
                <p className="mt-1 text-xs font-bold text-slate-800">
                  {qrContext.session.className ||
                    qrContext.session.subjectName}{" "}
                  · {qrContext.session.startTime}–{qrContext.session.endTime}
                </p>
              )}

              <div className="mt-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                <QRCodeSVG
                  value={code}
                  size={
                    typeof window === "undefined"
                      ? 260
                      : Math.min(280, window.innerWidth - 80)
                  }
                  level="M"
                  includeMargin
                />
              </div>

              <span className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("checkinManualCodeLabel")}
              </span>
              <p className="font-mono text-3xl font-black tracking-[.28em] text-slate-950">
                {code}
              </p>
              <p className="mt-2 text-xs text-slate-600">
                {t("checkinNewCodeIn")}{" "}
                <strong className="tabular-nums text-brand-primary">
                  {secondsLeft}s
                </strong>
              </p>
            </motion.section>
          </motion.div>
        )}

        {/* 4.5 Ngăn trượt "Báo thiếu buổi tập" (Mobile rộng toàn màn hình w-full sm:max-w-md) */}
        {showDisputeDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-slate-950/50"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeDisputeDrawer()
            }}
          >
            <motion.aside
              ref={disputeDrawerRef}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.2 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="attendance-dispute-title"
              className="absolute inset-y-0 right-0 flex w-full sm:max-w-md flex-col justify-between overflow-y-auto bg-white shadow-2xl"
            >
              <div>
                <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-brand-accent-dark">
                      {t("checkinBrand")}
                    </p>
                    <h2
                      id="attendance-dispute-title"
                      className="mt-1 text-lg font-extrabold text-slate-900"
                    >
                      {t("checkinDisputeDrawerTitle")}
                    </h2>
                  </div>
                  <button
                    type="button"
                    aria-label={t("checkinclose")}
                    onClick={closeDisputeDrawer}
                    className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </header>

                <form
                  id="dispute-report-form"
                  onSubmit={handleCopyDisputeInfo}
                  className="p-5 space-y-4"
                >
                  {/* 4.5.2 & 4.5.7 Giải thích ngắn bằng ngôn ngữ thường, màu trung tính */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-700">
                    {t("checkinDisputeIntro")}
                  </div>

                  {/* 4.5.3 Chọn buổi từ danh sách các buổi đã qua trong 30 ngày gần nhất */}
                  <div>
                    <label
                      htmlFor="dispute-session-select"
                      className="block text-xs font-bold text-slate-800 mb-1.5"
                    >
                      {t("checkinDisputeSelectSessionLabel")}
                    </label>
                    <select
                      id="dispute-session-select"
                      ref={disputeSelectRef}
                      value={selectedDisputeSessionKey}
                      onChange={(e) => {
                        setSelectedDisputeSessionKey(e.target.value)
                        setCopiedBanner(false)
                      }}
                      className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    >
                      <option value="">
                        {pastSessionsForDispute.length > 0
                          ? t("checkinDisputeSelectPlaceholder")
                          : t("checkinDisputeNoPastSessions")}
                      </option>
                      {pastSessionsForDispute.map((s) => (
                        <option key={s.optionKey} value={s.optionKey}>
                          {`${toDateDdMmYyyy(s.sessionDate)} · ${s.startTime}–${s.endTime} · ${s.displayClassName} · ${s.attendanceStatusLabel}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tự điền đủ lớp, ngày, giờ, sân và trạng thái hiện tại khi đã chọn buổi */}
                  {selectedDisputeSession && (
                    <dl className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 text-xs">
                      <div className="flex justify-between gap-2">
                        <dt className="font-semibold text-slate-500">
                          {t("checkinDisputeFieldClass")}:
                        </dt>
                        <dd className="font-bold text-slate-900 text-right">
                          {selectedDisputeSession.displayClassName}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="font-semibold text-slate-500">
                          {t("checkinDisputeFieldDate")}:
                        </dt>
                        <dd className="font-bold text-slate-900">
                          {toDateDdMmYyyy(selectedDisputeSession.sessionDate)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="font-semibold text-slate-500">
                          {t("checkinDisputeFieldTime")}:
                        </dt>
                        <dd className="font-bold text-slate-900">
                          {selectedDisputeSession.startTime}–
                          {selectedDisputeSession.endTime}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="font-semibold text-slate-500">
                          {t("checkinDisputeFieldRoom")}:
                        </dt>
                        <dd className="font-semibold text-slate-800">
                          {selectedDisputeSession.roomName ||
                            t("scheduleRoomTbd")}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="font-semibold text-slate-500">
                          {t("checkinDisputeFieldStatus")}:
                        </dt>
                        <dd className="font-bold text-slate-900">
                          {selectedDisputeSession.attendanceStatusLabel}
                        </dd>
                      </div>
                    </dl>
                  )}

                  {/* 4.5.4 Ô ghi chú cho lễ tân (tùy chọn), tối đa 1000 ký tự, có bộ đếm */}
                  <div>
                    <label
                      htmlFor="dispute-note-textarea"
                      className="block text-xs font-bold text-slate-800 mb-1.5"
                    >
                      {t("checkinDisputeNoteLabel")}
                    </label>
                    <textarea
                      id="dispute-note-textarea"
                      maxLength={1000}
                      rows={4}
                      value={disputeNote}
                      onChange={(e) => setDisputeNote(e.target.value)}
                      placeholder={t("checkinDisputeNotePlaceholder")}
                      className="w-full rounded-lg border border-slate-300 bg-white p-3 text-xs text-slate-900 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                    />
                    <div className="mt-1 flex justify-end text-xs text-slate-500">
                      <span>{disputeNote.length}/1000</span>
                    </div>
                  </div>

                  {copiedBanner && (
                    <div
                      role="status"
                      aria-live="polite"
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 flex items-center gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                      <span>{t("checkinDisputeCopiedToast")}</span>
                    </div>
                  )}
                </form>
              </div>

              {/* 4.5.5 & 4.5.8 Footer: Nút chính "Sao chép thông tin" vô hiệu hóa cho đến khi chọn một buổi, Nút phụ "Đóng" */}
              <div className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDisputeDrawer}
                  className="min-h-[40px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
                >
                  {t("checkinclose")}
                </button>
                <button
                  type="submit"
                  form="dispute-report-form"
                  disabled={!selectedDisputeSession}
                  className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-primary hover:bg-brand-primary-hover px-4 py-2 text-xs font-bold text-white shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
                >
                  {copiedBanner ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>
                    {copiedBanner
                      ? t("checkinDisputeCopiedConfirm")
                      : t("checkinDisputeCopyBtn")}
                  </span>
                </button>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
