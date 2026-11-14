import React, { useState, useMemo, useRef, useEffect } from "react"
import { useLocation } from "react-router-dom"
import { useSCMS } from "../../context/SCMSContext"
import { SkeletonBlock, SkeletonRow, ErrorState } from "../ui/Skeleton"
import { getSessions } from "../../api/managerApi.js"
import { formatDate } from "../../locales/translations"
import { NewClassModal } from "../modals/NewClassModal"
import { ClassEnrollmentsModal } from "../modals/ClassEnrollmentsModal"
import { ClassDetailDrawer } from "../classes/ClassDetailDrawer"
import { ImportClassesModal } from "../modals/ImportClassesModal"
import { BulkReassignCoachModal } from "../modals/BulkReassignCoachModal"
import {
  SPORT_DISCIPLINES,
  isCoachMatchingSport,
} from "../classes/sportDisciplines"
import {
  computeAllClassConflicts,
  getClassSessions,
  useScheduleConflict,
} from "../classes/hooks/useScheduleConflict"
import {
  addCalendarDays,
  buildClassCalendarEntries,
  calendarMonthCells,
  currentCalendarMonth,
  matchesClassDateRange,
  shiftCalendarMonth,
  vietnamDateKey,
} from "../classes/classCalendar.js"
import { CurrencyInput } from "../common/CurrencyInput"
import {
  Calendar,
  CalendarPlus,
  Users,
  Clock,
  MapPin,
  Search,
  Edit3,
  UserRoundCheck,
  X,
  Trash2,
  MoreHorizontal,
  Copy,
  Ban,
  Plus,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RotateCcw,
  Eye,
  Check,
  Sparkles,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Upload,
  SlidersHorizontal,
  Link as LinkIcon,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ArrowLeftRight,
} from "lucide-react"

// Format date to fixed dd/MM/yyyy independent of OS locale
function formatViDate(dateInput) {
  if (!dateInput) return "—"
  let yyyy, mm, dd
  if (typeof dateInput === "string" && dateInput.includes("-")) {
    const parts = dateInput.split("-")
    yyyy = parts[0]
    mm = parts[1]
    dd = parts[2]
  } else {
    const d = new Date(dateInput)
    if (isNaN(d.getTime())) return String(dateInput)
    dd = String(d.getDate()).padStart(2, "0")
    mm = String(d.getMonth() + 1).padStart(2, "0")
    yyyy = d.getFullYear()
  }
  return `${dd}/${mm}/${yyyy}`
}

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return "0"
  return Number(num).toLocaleString("vi-VN")
}

// Convert weekday IDs (0-6) to Vietnamese string label
const WEEKDAY_NAMES_MAP = {
  1: "T2",
  2: "T3",
  3: "T4",
  4: "T5",
  5: "T6",
  6: "T7",
  0: "CN",
}

function formatWeekdaysList(days) {
  if (!days || !Array.isArray(days) || days.length === 0) {
    return "T2, T4, T6"
  }
  return days.map((d) => WEEKDAY_NAMES_MAP[d] || d).join(", ")
}

function getWeekdaysArray(days, category, apiMode = false) {
  if (!days || !Array.isArray(days) || days.length === 0) {
    if (apiMode) return []
    if (category && category.toLowerCase().includes("pickleball")) {
      return ["T7", "CN"]
    }
    return ["T2", "T4", "T6"]
  }
  const mapped = days
    .map((d) => WEEKDAY_NAMES_MAP[d] || (typeof d === "string" ? d.trim() : d))
    .filter(Boolean)
  return mapped.length > 0 ? mapped : apiMode ? [] : ["T2", "T4", "T6"]
}

function formatScheduleTime(cls, apiMode = false) {
  if (apiMode && (!cls?.startTime || !cls?.endTime)) return "—"
  if (!cls) return "06:00 - 07:30"
  const isPickleball = Boolean(
    (cls.category && cls.category.toLowerCase().includes("pickleball")) ||
      (cls.name && cls.name.toLowerCase().includes("pickleball")) ||
      (cls.nameVi && cls.nameVi.toLowerCase().includes("pickleball")),
  )
  const defaultStart = isPickleball ? "18:15" : "06:00"
  const defaultEnd = isPickleball ? "20:00" : "07:30"

  const start = (cls.startTime && String(cls.startTime).trim()) || defaultStart
  const end = (cls.endTime && String(cls.endTime).trim()) || defaultEnd

  return `${start} - ${end}`
}

function SortIcon({ sortKey, currentConfig }) {
  const isActive = currentConfig?.key === sortKey
  const isAsc = isActive && currentConfig?.direction === "asc"
  const isDesc = isActive && currentConfig?.direction === "desc"

  return (
    <span
      className="inline-flex flex-col items-center justify-center -space-y-1 ml-1 select-none shrink-0"
      aria-hidden="true"
    >
      <ArrowUp
        className={`w-3 h-3 transition-colors ${
          isAsc
            ? "text-brand-primary font-extrabold stroke-[2.8]"
            : isActive
              ? "text-stone-300 opacity-25"
              : "text-stone-300 opacity-40 group-hover/th:text-stone-500"
        }`}
      />
      <ArrowDown
        className={`w-3 h-3 transition-colors ${
          isDesc
            ? "text-brand-primary font-extrabold stroke-[2.8]"
            : isActive
              ? "text-stone-300 opacity-25"
              : "text-stone-300 opacity-40 group-hover/th:text-stone-500"
        }`}
      />
    </span>
  )
}

export function computeCourseEndDate(startDateStr, days, count = 12) {
  if (!startDateStr || !Array.isArray(days) || days.length === 0) return ""
  const current = new Date(startDateStr)
  let sessionsRemaining = count
  let safety = 0
  while (sessionsRemaining > 0 && safety < 365) {
    if (days.includes(current.getDay())) {
      sessionsRemaining--
      if (sessionsRemaining === 0) break
    }
    current.setDate(current.getDate() + 1)
    safety++
  }
  const yyyy = current.getFullYear()
  const mm = String(current.getMonth() + 1).padStart(2, "0")
  const dd = String(current.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function exportClassesToCsv(
  classesToExport,
  filenamePrefix = "danh_sach_lop_hoc",
  { apiMode = false } = {},
) {
  if (!classesToExport || classesToExport.length === 0) return
  const headers = [
    "Mã lớp",
    "Tên lớp",
    "Bộ môn",
    "Số buổi",
    "Thứ học",
    "Giờ học",
    "Ngày bắt đầu",
    "Sân tập",
    "Huấn luyện viên",
    "Đã đăng ký",
    "Sức chứa",
    "Học phí",
    "Trạng thái",
  ]
  const rows = classesToExport.map((cls) => {
    const numericPrice = cls.price === null || cls.price === undefined ? null : Number(cls.price)
    const isFree = cls.isFree || numericPrice === 0
    const resolvedPrice = apiMode
      ? numericPrice
      : isFree
        ? 0
        : numericPrice > 0
          ? numericPrice
        : (cls.category || cls.nameVi || cls.name || "")
              .toLowerCase()
              .includes("pickleball")
          ? 800000
          : (cls.category || cls.nameVi || cls.name || "")
                .toLowerCase()
                .includes("bắn súng")
            ? 1200000
            : (cls.category || cls.nameVi || cls.name || "")
                  .toLowerCase()
                  .includes("bắn cung")
              ? 900000
              : 600000
    return [
      cls.code || (apiMode ? "—" : `CLS-${cls.id}`),
      cls.nameVi || cls.name || "—",
      cls.category || "—",
      cls.sessionCount ?? (apiMode ? "—" : 12),
      getWeekdaysArray(cls.selectedDays, cls.category, apiMode).join(", ") || "—",
      formatScheduleTime(cls, apiMode),
      formatViDate(cls.startDate || cls.date),
      cls.roomVi || cls.room || "—",
      cls.coachName || "Chưa phân công",
      cls.enrolledCount ?? (apiMode ? "—" : 0),
      cls.capacity ?? (apiMode ? "—" : 8),
      resolvedPrice === null ? "—" : isFree ? "Miễn phí (0 đ)" : `${resolvedPrice.toLocaleString("vi-VN")} đ`,
      STATUS_CONFIG[normalizeClassStatus(cls.status)]?.label || cls.apiStatus || cls.status,
    ]
  })

  const csvContent =
    "\uFEFF" +
    [headers, ...rows]
      .map((row) =>
        row
          .map((val) => `"${String(val ?? "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\r\n")

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute(
    "download",
    `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`,
  )
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Deterministic Ultra-Soft Pastel Avatars for Coaches (Calm & Non-clashing)
const COACH_CHAR_PALETTES = {
  P: { bg: "bg-[#F0F4F8]", text: "text-[#475467]", border: "border-[#E2E8F0]" }, // Cô Lan (P)
  T: { bg: "bg-[#F2F4F7]", text: "text-[#344054]", border: "border-[#E4E7EC]" }, // Cô Hương (T)
  L: { bg: "bg-[#F0F5FA]", text: "text-[#344054]", border: "border-[#DFE7F2]" }, // Thầy Khoa (L)
  N: { bg: "bg-[#F4F3F7]", text: "text-[#475467]", border: "border-[#E8E6ED]" }, // Thầy Hoàng (N)
  H: { bg: "bg-[#F8F4F2]", text: "text-[#5E4E47]", border: "border-[#EDE4E0]" }, // Cô My (H)
  D: { bg: "bg-[#EFF4F7]", text: "text-[#364A57]", border: "border-[#DEE7ED]" }, // Thầy Dũng (D)
  M: { bg: "bg-[#F1F5F3]", text: "text-[#3D5A4C]", border: "border-[#DFEAE3]" }, // Mai (M)
  B: { bg: "bg-[#F6F4F0]", text: "text-[#5C5346]", border: "border-[#EDE7DF]" }, // Bình (B)
}

const PASTEL_FALLBACK_PALETTES = [
  { bg: "bg-[#F0F4F8]", text: "text-[#475467]", border: "border-[#E2E8F0]" },
  { bg: "bg-[#F2F4F7]", text: "text-[#344054]", border: "border-[#E4E7EC]" },
  { bg: "bg-[#F0F5FA]", text: "text-[#344054]", border: "border-[#DFE7F2]" },
  { bg: "bg-[#F1F5F3]", text: "text-[#3D5A4C]", border: "border-[#DFEAE3]" },
  { bg: "bg-[#F4F3F7]", text: "text-[#475467]", border: "border-[#E8E6ED]" },
]

function getCoachAvatarPalette(name) {
  if (!name || typeof name !== "string") return PASTEL_FALLBACK_PALETTES[0]
  const trimmed = name.trim()
  const firstChar = trimmed[0]?.toUpperCase() || "H"
  if (COACH_CHAR_PALETTES[firstChar]) {
    return COACH_CHAR_PALETTES[firstChar]
  }
  let hash = 0
  for (let i = 0; i < trimmed.length; i++) {
    hash = (hash << 5) - hash + trimmed.charCodeAt(i)
    hash |= 0
  }
  return PASTEL_FALLBACK_PALETTES[
    Math.abs(hash) % PASTEL_FALLBACK_PALETTES.length
  ]
}

// Normalized status configuration matching Semantic UI specification
const STATUS_CONFIG = {
  open: {
    label: "Mở đăng ký",
    bg: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    dot: "bg-emerald-500",
  },
  ongoing: {
    label: "Đang diễn ra",
    bg: "bg-sky-50 text-sky-700 border-sky-200/80",
    dot: "bg-sky-500",
  },
  draft: {
    label: "Bản nháp",
    bg: "bg-stone-100 text-stone-700 border-stone-200/90",
    dot: "bg-stone-400",
  },
  closed: {
    label: "Đã kết thúc",
    bg: "bg-stone-100 text-stone-500 border-stone-200",
    dot: "bg-stone-400",
  },
  cancelled: {
    label: "Đã hủy",
    bg: "bg-rose-50 text-rose-700 border-rose-200/80",
    dot: "bg-rose-500",
  },
}

function normalizeClassStatus(status) {
  const s = String(status || "").trim().toLowerCase()
  if (["published", "open"].includes(s)) return "open"
  if (s === "ongoing") return "ongoing"
  if (s === "draft") return "draft"
  if (["completed", "closed"].includes(s)) return "closed"
  if (["cancelled", "canceled"].includes(s)) return "cancelled"
  return s || "unknown"
}

function StatusPill({ status }) {
  const norm = normalizeClassStatus(status)
  const cfg = STATUS_CONFIG[norm] || {
    label: status || "Unknown status",
    bg: "bg-stone-100 text-stone-700 border-stone-200",
    dot: "bg-stone-400",
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bg}`}
      title={`Trạng thái: ${cfg.label}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      <span>{cfg.label}</span>
    </span>
  )
}

// -------------------------------------------------------------
// Component EditClassModal: Hiện đại, bo góc 12px, kiểm tra trùng lịch
// -------------------------------------------------------------
function EditClassModal({
  item,
  apiMode = false,
  subjects,
  staff,
  coaches,
  existingClasses = [],
  language,
  onClose,
  onSave,
}) {
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const activeCoaches = (
    coaches && coaches.length > 0 ? coaches : staff
  ).filter(
    (person) =>
      String(person.role || person.beRole || "")
        .toLowerCase()
        .includes("coach") ||
      String(person.role || person.beRole || "")
        .toLowerCase()
        .includes("huấn"),
  )

  const initialPrice = item.price === null || item.price === undefined ? null : Number(item.price)
  const isInitialFree = initialPrice === 0 || (!apiMode && item.isFree)
  const resolvedInitialPrice = isInitialFree
    ? 0
    : initialPrice !== null && initialPrice > 0
      ? initialPrice
      : apiMode
        ? null
      : (item.category || item.nameVi || item.name || "")
            .toLowerCase()
            .includes("pickleball")
        ? 800000
        : (item.category || item.nameVi || item.name || "")
              .toLowerCase()
              .includes("bắn súng")
          ? 1200000
          : (item.category || item.nameVi || item.name || "")
                .toLowerCase()
                .includes("bắn cung")
            ? 900000
            : 600000

  const sessionCount = item.sessionCount ?? (apiMode ? null : 12)
  const [pricingMode, setPricingMode] = useState("total") // 'total' | 'per_session'
  const [isFreeClass, setIsFreeClass] = useState(isInitialFree)
  const lastNonZeroPriceRef = useRef(
    resolvedInitialPrice > 0 ? resolvedInitialPrice : apiMode ? null : 600000,
  )
  const [perSessionPriceInput, setPerSessionPriceInput] = useState(() =>
    isInitialFree
      ? 0
      : resolvedInitialPrice === null || !sessionCount
        ? ""
        : Math.round(resolvedInitialPrice / sessionCount / 1000) * 1000,
  )

  const [form, setForm] = useState(() => ({
    ...item,
    name: item.nameVi || item.name || "",
    capacity: item.capacity ?? (apiMode ? "" : 8),
    minCapacity: item.minCapacity ?? (apiMode ? null : 4),
    price: resolvedInitialPrice,
    startDate: item.startDate || item.date || "",
    endDate: item.endDate || "",
    startTime: item.startTime || (apiMode ? "" : "06:00"),
    endTime: item.endTime || (apiMode ? "" : "07:30"),
    status: apiMode
      ? normalizeClassStatus(item.status ?? item.apiStatus)
      : item.status || "published",
  }))

  const currentCategory = form.category || item.category || ""
  const { matchedCoaches, otherCoaches } = useMemo(() => {
    const matched = activeCoaches.filter((c) =>
      isCoachMatchingSport(c, currentCategory),
    )
    const other = activeCoaches.filter((c) => !matched.includes(c))
    return { matchedCoaches: matched, otherCoaches: other }
  }, [activeCoaches, currentCategory])

  const selectedCoachObj = useMemo(() => {
    return activeCoaches.find(
      (coach) =>
        String(coach.id) === String(form.coachId) ||
        String(coach.id).match(/(\d+)$/)?.[1] === String(form.coachId),
    )
  }, [activeCoaches, form.coachId])

  const roundedPerSessionPrice = useMemo(() => {
    if (
      isFreeClass ||
      !sessionCount ||
      sessionCount <= 0 ||
      !form.price ||
      form.price <= 0
    )
      return 0
    return Math.round(form.price / sessionCount / 1000) * 1000
  }, [form.price, sessionCount, isFreeClass])

  const handleNumericPriceChange = (num) => {
    const safeNum = Math.max(0, num || 0)
    if (pricingMode === "total") {
      setForm((prev) => ({ ...prev, price: safeNum }))
      if (safeNum > 0) lastNonZeroPriceRef.current = safeNum
      setPerSessionPriceInput(
        Math.round(safeNum / (sessionCount || 1) / 1000) * 1000,
      )
    } else {
      setPerSessionPriceInput(safeNum)
      const total = safeNum * (sessionCount || 1)
      setForm((prev) => ({ ...prev, price: total }))
      if (total > 0) lastNonZeroPriceRef.current = total
    }
  }

  const handleTogglePricingMode = () => {
    if (isFreeClass) return
    if (pricingMode === "total") {
      const perSession =
        Math.round((form.price || 0) / (sessionCount || 1) / 1000) * 1000
      setPerSessionPriceInput(perSession)
      setForm((prev) => ({ ...prev, price: perSession * (sessionCount || 1) }))
      setPricingMode("per_session")
    } else {
      setPricingMode("total")
    }
  }

  const handleToggleFreeClass = (e) => {
    const checked = e.target.checked
    setIsFreeClass(checked)
    if (checked) {
      if (form.price > 0) lastNonZeroPriceRef.current = form.price
      setForm((prev) => ({ ...prev, price: 0 }))
      setPerSessionPriceInput(0)
    } else {
      const restored =
        lastNonZeroPriceRef.current > 0 ? lastNonZeroPriceRef.current : 600000
      setForm((prev) => ({ ...prev, price: restored }))
      setPerSessionPriceInput(
        Math.round(restored / (sessionCount || 1) / 1000) * 1000,
      )
    }
  }

  const [selectedDays, setSelectedDays] = useState(() => {
    if (Array.isArray(item.selectedDays) && item.selectedDays.length > 0) {
      return item.selectedDays
    }
    return apiMode ? [] : [1, 3, 5]
  })

  const { conflict, isChecking: isCheckingConflict } = useScheduleConflict({
    coachId: form.coachId,
    coachName: form.coachName,
    roomId: form.roomId,
    roomName: form.roomVi || form.room,
    date: form.startDate,
    startTime: form.startTime,
    endTime: form.endTime,
    selectedDays,
    excludeClassId: item.id,
    existingClasses,
  })

  const toggleWeekday = (dayId) => {
    if (selectedDays.includes(dayId)) {
      if (selectedDays.length === 1) return
      setSelectedDays(selectedDays.filter((d) => d !== dayId))
    } else {
      setSelectedDays([...selectedDays, dayId].sort())
    }
  }

  // Tự động tính ngày bế giảng từ ngày khai giảng, các thứ trong tuần và số buổi học
  useEffect(() => {
    if (!apiMode && form.startDate && selectedDays && selectedDays.length > 0) {
      const autoEnd = computeCourseEndDate(form.startDate, selectedDays, sessionCount)
      if (autoEnd && autoEnd !== form.endDate) {
        setForm((prev) => ({ ...prev, endDate: autoEnd }))
      }
    }
  }, [apiMode, form.startDate, selectedDays, sessionCount])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError("Vui lòng nhập tên lớp học.")
      return
    }
    if (!apiMode && !selectedDays.length) {
      setError("Vui lòng chọn ít nhất một thứ trong tuần.")
      return
    }

    // Kiểm tra tính hợp lệ: Ngày khai giảng phải rơi vào đúng một trong các thứ đã chọn
    if (!apiMode && (form.startDate || form.date)) {
      const startDay = new Date(form.startDate || form.date).getDay()
      if (!selectedDays.includes(startDay)) {
        const dayNames = { 1: "Thứ 2", 2: "Thứ 3", 3: "Thứ 4", 4: "Thứ 5", 5: "Thứ 6", 6: "Thứ 7", 0: "Chủ Nhật" }
        const expected = selectedDays.map((d) => dayNames[d]).join(", ")
        setError(`Ngày khai giảng (${form.startDate || form.date}) là ${dayNames[startDay]}, không trùng với các thứ đã chọn (${expected}). Vui lòng chọn ngày khai giảng đúng lịch học.`)
        return
      }
    }

    if (conflict?.hasConflict) {
      setError(conflict.message)
      return
    }
    setSaving(true)
    setError("")
    try {
      const calculatedEndDate = apiMode
        ? form.endDate
        : computeCourseEndDate(form.startDate, selectedDays, sessionCount) || form.endDate
      await onSave({
        ...form,
        name: form.name.trim(),
        nameVi: form.name.trim(),
        capacity: apiMode ? Number(form.capacity) : Number(form.capacity) || 8,
        price: apiMode && form.price === ""
          ? null
          : isFreeClass
          ? 0
          : Number(form.price) >= 0
            ? Number(form.price)
            : 0,
        isFree: isFreeClass,
        selectedDays: apiMode ? null : selectedDays,
        endDate: calculatedEndDate,
      })
      onClose()
    } catch (err) {
      setError(err?.message || "Lỗi khi cập nhật lớp học.")
    } finally {
      setSaving(false)
    }
  }

  const selectedCoachValue =
    activeCoaches.find(
      (coach) =>
        String(coach.id) === String(form.coachId) ||
        String(coach.id).match(/(\d+)$/)?.[1] === String(form.coachId),
    )?.id ||
    form.coachId ||
    ""

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white text-stone-900 w-full max-w-xl rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              Chỉnh sửa thông tin lớp học
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Cập nhật thông tin giảng dạy, lịch học và phân công huấn luyện
              viên.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={submit}
          className="flex-1 overflow-y-auto p-6 space-y-4"
        >
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-800 mb-1.5">
              Tên lớp học
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full h-11 px-3.5 bg-white border border-stone-300 rounded-xl text-sm focus:border-stone-800 focus:ring-1 focus:ring-stone-800"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                Bộ môn
              </label>
              <select
                required
                value={form.subjectId || ""}
                onChange={(e) => {
                  const matched = (subjects || []).find(
                    (s) => String(s.id) === e.target.value,
                  )
                  const newCategory = matched?.name || form.category
                  const newMatched = activeCoaches.filter((c) =>
                    isCoachMatchingSport(c, newCategory),
                  )
                  let nextCoachId = form.coachId
                  let nextCoachName = form.coachName
                  if (
                    newMatched.length > 0 &&
                    !isCoachMatchingSport(selectedCoachObj, newCategory)
                  ) {
                    nextCoachId = String(newMatched[0].id)
                    nextCoachName = newMatched[0].name
                  }
                  setForm({
                    ...form,
                    subjectId: e.target.value,
                    category: newCategory,
                    coachId: nextCoachId,
                    coachName: nextCoachName,
                  })
                }}
                className="w-full h-11 px-3.5 bg-white border border-stone-300 rounded-xl text-sm cursor-pointer"
              >
                {(subjects || []).map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.nameVi || sub.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                Huấn luyện viên
              </label>
              <select
                value={selectedCoachValue}
                onChange={(e) => {
                  const coach = activeCoaches.find(
                    (c) => String(c.id) === e.target.value,
                  )
                  setForm({
                    ...form,
                    coachId: e.target.value,
                    coachName: coach?.name || "Chưa phân công",
                  })
                }}
                className="w-full h-11 px-3.5 bg-white border border-stone-300 rounded-xl text-sm cursor-pointer"
              >
                <option value="">Chọn huấn luyện viên...</option>
                {matchedCoaches.length > 0 && (
                  <optgroup
                    label={`HLV đúng chuyên môn (${currentCategory || "Môn học"})`}
                  >
                    {matchedCoaches.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name} —{" "}
                        {c.specializationVi ||
                          c.specialization ||
                          c.specialty ||
                          "HLV"}
                      </option>
                    ))}
                  </optgroup>
                )}
                {otherCoaches.length > 0 && (
                  <optgroup label="HLV bộ môn khác">
                    {otherCoaches.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name} —{" "}
                        {c.specializationVi ||
                          c.specialization ||
                          c.specialty ||
                          "HLV"}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {selectedCoachObj ? (
                <div className="flex items-center gap-2 mt-1.5 text-xs flex-wrap">
                  <span className="text-stone-500">Chuyên môn:</span>
                  <span className="font-semibold text-stone-800">
                    {selectedCoachObj.specializationVi ||
                      selectedCoachObj.specialization ||
                      selectedCoachObj.specialty ||
                      "Huấn luyện viên"}
                  </span>
                  {isCoachMatchingSport(selectedCoachObj, currentCategory) ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-medium">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Đúng chuyên môn
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 font-medium">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      Khác chuyên môn {currentCategory}
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-amber-700 mt-1.5 font-medium flex items-center gap-1">
                  <span>ℹ️ Chưa phân công: Danh mục học viên sẽ hiển thị "HLV sẽ được thông báo trước khai giảng".</span>
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                Sĩ số tối đa
              </label>
              <input
                required
                min="1"
                type="number"
                value={form.capacity ?? ""}
                onFocus={(e) => e.target.select()}
                onClick={(e) => {
                  if (e.target.selectionStart === e.target.selectionEnd)
                    e.target.select()
                }}
                onBlur={() => {
                  if (!apiMode && (!form.capacity || form.capacity < 1)) {
                    setForm({ ...form, capacity: 12 })
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value
                  setForm({ ...form, capacity: val === "" ? "" : Number(val) })
                }}
                className="w-full h-11 px-3.5 bg-white border border-stone-300 rounded-xl text-sm font-medium focus:border-stone-800 focus:ring-1 focus:ring-stone-800 tabular-nums"
              />
            </div>
            {!apiMode && (
              <div>
                <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                  Trạng thái
                </label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full h-11 px-3.5 bg-white border border-stone-300 rounded-xl text-sm cursor-pointer font-medium focus:border-stone-800"
                >
                  <option value="open">Mở đăng ký</option>
                  <option value="ongoing">Đang diễn ra</option>
                  <option value="draft">Bản nháp</option>
                  <option value="closed">Đã kết thúc</option>
                  <option value="cancelled">Đã hủy</option>
                </select>
              </div>
            )}
          </div>

          {/* Học phí: InputGroup tách biệt + Đảo chiều 2-way + Dấu chấm phân cách + Làm tròn hàng nghìn + Checkbox miễn phí */}
          {apiMode ? (
            <div className="space-y-2 p-3.5 bg-stone-50/70 border border-stone-200 rounded-xl">
              <label className="block text-xs font-semibold text-stone-800">Học phí
                <input type="number" min="0" value={form.price ?? ""} onChange={(event) => setForm({ ...form, price: event.target.value === "" ? "" : Number(event.target.value) })} className="mt-1 w-full h-11 px-3.5 bg-white border border-stone-300 rounded-xl text-sm" />
              </label>
            </div>
          ) : <div className="space-y-2 p-3.5 bg-stone-50/70 border border-stone-200 rounded-xl">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-stone-800">
                {pricingMode === "total"
                  ? "Học phí trọn khóa"
                  : "Học phí mỗi buổi"}
              </label>
              <button
                type="button"
                onClick={handleTogglePricingMode}
                disabled={isFreeClass}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-lg border transition-all ${
                  isFreeClass
                    ? "border-stone-200 text-stone-300 cursor-not-allowed bg-stone-100"
                    : "border-stone-200 text-stone-700 bg-white hover:bg-stone-100 hover:border-stone-300 cursor-pointer active:scale-98"
                }`}
                title="Đổi giữa tính theo trọn khóa hoặc tính theo từng buổi"
              >
                <ArrowLeftRight className="w-3.5 h-3.5 text-stone-500" />
                <span>
                  {pricingMode === "total"
                    ? "Nhập theo buổi"
                    : "Nhập trọn khóa"}
                </span>
              </button>
            </div>

            {/* Ô nhập tiền tệ chuẩn cao cấp với Auto-select, Gợi ý nhanh & Xóa 1 chạm */}
            <CurrencyInput
              id="edit-class-price"
              disabled={isFreeClass}
              value={
                pricingMode === "total" ? form.price : perSessionPriceInput
              }
              onChange={handleNumericPriceChange}
              placeholder="0"
              suffix={pricingMode === "total" ? "đ" : "đ / buổi"}
              presets={
                pricingMode === "total"
                  ? [200000, 500000, 800000, 1000000, 1200000, 1500000]
                  : [20000, 50000, 75000, 100000, 150000]
              }
            />

            {/* Helper Text với làm tròn số hàng nghìn & tone màu xám nhạt */}
            <div className="text-xs text-stone-500 flex items-center justify-between">
              {isFreeClass ? (
                <span className="text-emerald-600 font-medium">
                  ✓ Lớp học miễn phí (Hội viên tham gia không mất phí)
                </span>
              ) : pricingMode === "total" ? (
                <span>
                  Ước tính:{" "}
                  <strong className="font-semibold text-stone-700">
                    ~ {formatNumber(roundedPerSessionPrice)} đ
                  </strong>{" "}
                  / buổi ({sessionCount} buổi)
                </span>
              ) : (
                <span>
                  Tổng học phí trọn khóa:{" "}
                  <strong className="font-semibold text-stone-700">
                    ~ {formatNumber(form.price)} đ
                  </strong>{" "}
                  ({sessionCount} buổi × {formatNumber(perSessionPriceInput)} đ)
                </span>
              )}
              {!isFreeClass && form.price > 0 && (
                <span className="text-stone-400 text-xs">
                  {pricingMode === "total"
                    ? "Làm tròn theo buổi"
                    : "Tự động tính trọn khóa"}
                </span>
              )}
            </div>

            {/* Checkbox Lớp học miễn phí */}
            <label className="flex items-center gap-2 pt-1 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={isFreeClass}
                onChange={handleToggleFreeClass}
                className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-800 cursor-pointer accent-stone-900"
              />
              <span className="text-xs text-stone-700 font-medium group-hover:text-stone-900 transition-colors">
                Lớp học miễn phí (Hội viên tham gia không mất phí)
              </span>
            </label>
          </div>}

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                Ngày bắt đầu
              </label>
              <input
                type="date"
                value={form.startDate || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    startDate: e.target.value,
                    date: e.target.value,
                  })
                }
                className="w-full h-11 px-3.5 bg-white border border-stone-300 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1.5 flex items-center justify-between">
                <span>Ngày kết thúc (Bế giảng)</span>
                <span className="text-xs text-stone-500 font-normal">{apiMode ? "" : `Tự động (${sessionCount} buổi)`}</span>
              </label>
              <input
                type="date"
                readOnly
                value={form.endDate || ""}
                className="w-full h-11 px-3.5 bg-stone-100 border border-stone-300 rounded-xl text-sm text-stone-600 cursor-not-allowed"
                title={`Ngày bế giảng được tự động tính dựa trên ngày bắt đầu, lịch học trong tuần và ${sessionCount} buổi học`}
              />
            </div>
          </div>

          {!apiMode && <>
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                Giờ bắt đầu
              </label>
              <input
                type="text"
                value={form.startTime || ""}
                onChange={(e) =>
                  setForm({ ...form, startTime: e.target.value })
                }
                className="w-full h-11 px-3.5 bg-white border border-stone-300 rounded-xl text-sm"
                placeholder="06:00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                Giờ kết thúc
              </label>
              <input
                type="text"
                value={form.endTime || ""}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full h-11 px-3.5 bg-white border border-stone-300 rounded-xl text-sm"
                placeholder="07:30"
              />
            </div>
          </div>

          {/* Lặp lại vào các thứ trong tuần */}
          <div>
            <label className="block text-xs font-semibold text-stone-800 mb-1.5">
              Lặp lại vào các thứ trong tuần
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 1, label: "T2" },
                { id: 2, label: "T3" },
                { id: 3, label: "T4" },
                { id: 4, label: "T5" },
                { id: 5, label: "T6" },
                { id: 6, label: "T7" },
                { id: 0, label: "CN" },
              ].map((day) => {
                const isSelected = selectedDays.includes(day.id)
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleWeekday(day.id)}
                    className={`w-10 h-10 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? "bg-brand-primary text-white shadow-xs"
                        : "bg-stone-100 hover:bg-stone-200 text-stone-700"
                    }`}
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-stone-500 mt-1.5">
              Đang chọn: {formatWeekdaysList(selectedDays)}
            </p>
          </div>

          </>}

          {/* Banner cảnh báo trùng lịch */}
          {!apiMode && conflict?.hasConflict && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1 shadow-2xs">
              <div className="flex items-center gap-1.5 font-bold text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Xung đột lịch dạy hoặc sân tập</span>
              </div>
              <p className="text-xs text-rose-700 leading-relaxed font-medium">
                {conflict.message}
              </p>
              <p className="text-xs text-rose-600 italic">
                Vui lòng thay đổi khung giờ, ngày học hoặc phân công HLV/sân tập
                khác để lưu thay đổi.
              </p>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 rounded-xl transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving || conflict?.hasConflict}
              className="px-5 py-2 text-xs font-semibold text-white bg-brand-primary hover:bg-brand-primary-hover rounded-xl transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title={conflict?.hasConflict ? conflict.message : "Lưu thay đổi"}
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// -------------------------------------------------------------
// Component Menu Ba Chấm (Action Menu Popover)
// -------------------------------------------------------------
function RowActionMenu({
  cls,
  onQuickView,
  onViewMembers,
  onEdit,
  onChangeCoach,
  onDuplicate,
  onCancelClass,
  onDelete,
  onCopyLink,
  apiMode = false,
  alignUp = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick)
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [isOpen])

  const hasEnrollments = (cls.enrolledCount || 0) > 0

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center text-stone-500 hover:text-stone-900 transition-colors cursor-pointer"
        title="Thao tác"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 ${
            alignUp ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } w-52 bg-white border border-stone-200 rounded-xl shadow-xl py-1.5 z-50 text-xs font-medium animate-in fade-in zoom-in-95 duration-100`}
        >
          <button
            type="button"
            onClick={() => {
              setIsOpen(false)
              onQuickView && onQuickView(cls)
            }}
            className="w-full px-3.5 py-2 text-left text-stone-700 hover:bg-stone-50 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-stone-500" />
            <span>Xem chi tiết nhanh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false)
              onViewMembers(cls)
            }}
            className="w-full px-3.5 py-2 text-left text-stone-700 hover:bg-stone-50 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-stone-500" />
            <span>Xem học viên ({cls.enrolledCount || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false)
              onEdit(cls)
            }}
            className="w-full px-3.5 py-2 text-left text-stone-700 hover:bg-stone-50 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-stone-500" />
            <span>Sửa lớp học</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false)
              onChangeCoach(cls)
            }}
            className="w-full px-3.5 py-2 text-left text-stone-700 hover:bg-stone-50 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <UserRoundCheck className="w-3.5 h-3.5 text-stone-500" />
            <span>Đổi huấn luyện viên</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false)
              onDuplicate(cls)
            }}
            className="w-full px-3.5 py-2 text-left text-stone-700 hover:bg-stone-50 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-stone-500" />
            <span>Nhân bản lớp học</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsOpen(false)
              onCopyLink && onCopyLink(cls)
            }}
            className="w-full px-3.5 py-2 text-left text-stone-700 hover:bg-stone-50 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <LinkIcon className="w-3.5 h-3.5 text-stone-500" />
            <span>Sao chép link đăng ký</span>
          </button>

          {!apiMode && cls.status !== "cancelled" && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                onCancelClass(cls)
              }}
              className="w-full px-3.5 py-2 text-left text-amber-700 hover:bg-amber-50/60 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <Ban className="w-3.5 h-3.5 text-amber-600" />
              <span>Hủy lớp học</span>
            </button>
          )}

          {!apiMode && (
            <>
              <div className="my-1 border-t border-stone-100" />
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  onDelete(cls)
                }}
                disabled={hasEnrollments}
                title={
                  hasEnrollments
                    ? "Không thể xóa lớp đã có học viên đăng ký. Vui lòng chọn Hủy lớp học."
                    : "Xóa vĩnh viễn lớp học này"
                }
                className={`w-full px-3.5 py-2 text-left flex items-center gap-2.5 transition-colors ${
                  hasEnrollments
                    ? "text-stone-300 cursor-not-allowed"
                    : "text-rose-600 hover:bg-rose-50 cursor-pointer"
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa lớp học</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// -------------------------------------------------------------
// MAIN COMPONENT: ClassManagement (Giao diện Quản lý Lớp học chuẩn hóa)
// -------------------------------------------------------------
const DEFAULT_COLUMN_VISIBILITY = {
  schedule: true,
  room: true,
  coach: true,
  enrollment: true,
  price: true, // Cột Học phí / Buổi hiển thị trực quan
  status: true,
}

export function ClassManagement() {
  const {
    role,
    currentUser,
    classes,
    setClasses,
    reloadClasses,
    apiEnabled,
    classesLoading,
    subjects,
    staff,
    coaches,
    addClassSession,
    updateClass,
    deleteClass,
    restoreDefaultClasses,
    showToast,
    language,
  } = useSCMS()

  const location = useLocation()
  const isManager = role === 'manager' || currentUser?.role === 'manager' || location.pathname.startsWith('/manager')

  // Mode: 'table' (Mặc định chuẩn) | 'calendar' (Lịch tháng)
  const [viewMode, setViewMode] = useState("table")
  const [todayKey, setTodayKey] = useState(() => vietnamDateKey(new Date()))
  const [calendarMonth, setCalendarMonth] = useState(() => currentCalendarMonth())
  const previousTodayRef = useRef(todayKey)
  useEffect(() => {
    let timer
    const refreshToday = () => {
      const now = new Date()
      const today = vietnamDateKey(now)
      setTodayKey(today)
      window.clearTimeout(timer)
      const nextMidnight = Date.parse(`${addCalendarDays(today, 1)}T00:00:00+07:00`)
      timer = window.setTimeout(refreshToday, Math.max(1000, nextMidnight - now.getTime()))
    }
    refreshToday()
    window.addEventListener("focus", refreshToday)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener("focus", refreshToday)
    }
  }, [])
  useEffect(() => {
    const previousMonth = previousTodayRef.current.slice(0, 7)
    const currentMonth = todayKey.slice(0, 7)
    if (previousMonth !== currentMonth) {
      setCalendarMonth((month) => month === previousMonth ? currentMonth : month)
    }
    previousTodayRef.current = todayKey
  }, [todayKey])
  const [isNewClassOpen, setIsNewClassOpen] = useState(false)
  const [cloningClass, setCloningClass] = useState(null)
  const [enrollingClass, setEnrollingClass] = useState(null)
  const [editingClass, setEditingClass] = useState(null)
  const [quickViewClass, setQuickViewClass] = useState(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isBulkReassignOpen, setIsBulkReassignOpen] = useState(false)

  // Column Visibility State with LocalStorage Persistence
  const [columnVisibility, setColumnVisibility] = useState(() => {
    try {
      const saved = localStorage.getItem("scms_class_columns_visibility")
      if (saved) {
        return { ...DEFAULT_COLUMN_VISIBILITY, ...JSON.parse(saved) }
      }
    } catch (e) {
      console.error("Failed to load column visibility from localStorage:", e)
    }
    return DEFAULT_COLUMN_VISIBILITY
  })
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false)
  const columnDropdownRef = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem(
        "scms_class_columns_visibility",
        JSON.stringify(columnVisibility),
      )
    } catch (e) {
      console.error("Failed to save column visibility:", e)
    }
  }, [columnVisibility])

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        columnDropdownRef.current &&
        !columnDropdownRef.current.contains(e.target)
      ) {
        setIsColumnDropdownOpen(false)
      }
    }
    if (isColumnDropdownOpen) {
      document.addEventListener("mousedown", handleOutsideClick)
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [isColumnDropdownOpen])

  // Bulk Selection State
  const [selectedClassIds, setSelectedClassIds] = useState([])

  // Filters state
  const [activeTab, setActiveTab] = useState("all") // 'all' | 'open' | 'ongoing' | 'draft' | 'closed' | 'cancelled'
  const [searchTerm, setSearchTerm] = useState("")
  const [filterSport, setFilterSport] = useState("all")
  const [filterCoach, setFilterCoach] = useState("all")
  const [filterDateRange, setFilterDateRange] = useState("all") // 'all' | 'today' | 'this_week' | 'next_week' | 'this_month' | 'next_month'

  // Sorting state - Defaults to Newest Class (Lớp mới nhất - date desc)
  const [sortConfig, setSortConfig] = useState({
    key: "date",
    direction: "desc",
  })

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Deleting confirmation state
  const [deletingClassTarget, setDeletingClassTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Reset pagination to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchTerm, filterSport, filterCoach, filterDateRange])

  const [conflictSchedule, setConflictSchedule] = useState(null)

  useEffect(() => {
    if (!apiEnabled || !classes.length) return

    const controller = new AbortController()
    const updateSchedule = (sessions, error = false) => {
      if (!controller.signal.aborted) setConflictSchedule({ classes, sessions, error })
    }

    getSessions({}, { signal: controller.signal, notifyForbidden: false })
      .then(updateSchedule)
      .catch(() => updateSchedule([], true))

    return () => controller.abort()
  }, [apiEnabled, classes])

  const classConflictsMap = useMemo(() => {
    if (!apiEnabled) return computeAllClassConflicts(classes)

    if (conflictSchedule?.classes !== classes) return {}
    if (conflictSchedule.error) {
      return Object.fromEntries(classes.filter(Boolean).map((cls) => [cls.id, {
        hasConflict: false,
        hasMissingSchedule: false,
        hasScheduleCheckError: true,
        status: "unverified",
        message: "Không tải được dữ liệu lịch học để kiểm tra. Vui lòng tải lại.",
      }]))
    }
    const sessions = conflictSchedule.sessions
    return computeAllClassConflicts(classes, sessions)
  }, [apiEnabled, classes, conflictSchedule])

  const totalConflictsCount = useMemo(() => {
    return Object.values(classConflictsMap).filter((c) =>
      Boolean(c?.hasConflict),
    ).length
  }, [classConflictsMap])

  // Calculate status counts
  const counts = useMemo(() => {
    const list = classes || []
    const res = {
      all: list.length,
      open: 0,
      ongoing: 0,
      draft: 0,
      closed: 0,
      cancelled: 0,
    }
    list.forEach((c) => {
      const norm = normalizeClassStatus(c.status)
      if (res[norm] !== undefined) {
        res[norm] += 1
      }
    })
    return res
  }, [classes])

  // Unique sports and coaches for filter dropdowns
  const availableSports = useMemo(() => {
    const fromSubjects = (subjects || []).map((s) => s.nameVi || s.name)
    const fromClasses = (classes || []).map((c) => c.category)
    const combined = Array.from(
      new Set([...fromSubjects, ...fromClasses]),
    ).filter(Boolean)
    return combined.sort()
  }, [subjects, classes])

  const availableCoaches = useMemo(() => {
    const fromStaff = (coaches && coaches.length > 0 ? coaches : staff)
      .filter((s) => {
        const r = String(s.role || s.beRole || "").toLowerCase()
        return r.includes("coach") || r.includes("huấn")
      })
      .map((s) => s.name)
    const fromClasses = (classes || [])
      .map((c) => c.coachName)
      .filter((n) => n && n !== "Chưa phân công")
    const combined = Array.from(new Set([...fromStaff, ...fromClasses]))
    return combined.sort()
  }, [coaches, staff, classes])

  // Filtered & Sorted Classes list
  const filteredAndSortedClasses = useMemo(() => {
    const list = (classes || []).filter((cls) => {
      // Tab filter
      const normStatus = normalizeClassStatus(cls.status)
      if (activeTab !== "all" && normStatus !== activeTab) {
        return false
      }

      // Sport filter
      if (filterSport !== "all") {
        const cat = (cls.category || "").toLowerCase()
        if (!cat.includes(filterSport.toLowerCase())) return false
      }

      // Coach filter
      if (filterCoach !== "all") {
        const cName = (cls.coachName || "").toLowerCase()
        if (!cName.includes(filterCoach.toLowerCase())) return false
      }

      // Date Range filter
      if (filterDateRange !== "all") {
        if (!matchesClassDateRange(cls.startDate || cls.date, filterDateRange, todayKey)) {
          return false
        }
      }

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const nameMatch = (cls.nameVi || cls.name || "")
          .toLowerCase()
          .includes(term)
        const coachMatch = (cls.coachName || "").toLowerCase().includes(term)
        const categoryMatch = (cls.category || "").toLowerCase().includes(term)
        const roomMatch = (cls.roomVi || cls.room || "")
          .toLowerCase()
          .includes(term)
        if (!nameMatch && !coachMatch && !categoryMatch && !roomMatch) {
          return false
        }
      }

      return true
    })

    // Sorting
    return [...list].sort((a, b) => {
      if (!sortConfig.key || !sortConfig.direction) return 0
      let cmp = 0
      if (sortConfig.key === "name") {
        const nameA = (a.nameVi || a.name || "").toLowerCase()
        const nameB = (b.nameVi || b.name || "").toLowerCase()
        cmp = nameA.localeCompare(nameB, "vi")
      } else if (sortConfig.key === "date") {
        const dateA = a.startDate || a.date || ""
        const dateB = b.startDate || b.date || ""
        cmp = dateA.localeCompare(dateB)
        if (cmp === 0) {
          cmp = (Number(a.id) || 0) - (Number(b.id) || 0)
        }
      } else if (sortConfig.key === "enrollment") {
        const percentFor = (cls) => cls.capacity > 0 && cls.enrolledCount != null
          ? cls.enrolledCount / cls.capacity
          : null
        const percentA = percentFor(a)
        const percentB = percentFor(b)
        cmp = percentA === null
          ? percentB === null ? 0 : 1
          : percentB === null ? -1 : percentA - percentB
      } else if (sortConfig.key === "price") {
        const getP = (c) => apiEnabled
          ? c.price == null ? null : Number(c.price)
          :
          Number(c.price) > 0
            ? Number(c.price)
            : (c.category || c.nameVi || c.name || "")
                  .toLowerCase()
                  .includes("pickleball")
              ? 800000
              : (c.category || c.nameVi || c.name || "")
                    .toLowerCase()
                    .includes("bắn súng")
                ? 1200000
                : (c.category || c.nameVi || c.name || "")
                      .toLowerCase()
                      .includes("bắn cung")
                  ? 900000
                  : 600000
        const priceA = getP(a)
        const priceB = getP(b)
        cmp = priceA === null
          ? priceB === null ? 0 : 1
          : priceB === null ? -1 : priceA - priceB
      }
      return sortConfig.direction === "desc" ? -cmp : cmp
    })
  }, [
    classes,
    activeTab,
    filterSport,
    filterCoach,
    filterDateRange,
    todayKey,
    searchTerm,
    sortConfig,
  ])

  // Pagination slicing
  const totalItems = filteredAndSortedClasses.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIdx = (safeCurrentPage - 1) * pageSize
  const endIdx = Math.min(startIdx + pageSize, totalItems)

  const paginatedClasses = useMemo(() => {
    return filteredAndSortedClasses.slice(startIdx, endIdx)
  }, [filteredAndSortedClasses, startIdx, endIdx])

  // Page numbers for navigation
  const pageNumbers = useMemo(() => {
    const pages = []
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (safeCurrentPage > 3) pages.push("...")
      const start = Math.max(2, safeCurrentPage - 1)
      const end = Math.min(totalPages - 1, safeCurrentPage + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (safeCurrentPage < totalPages - 2) pages.push("...")
      pages.push(totalPages)
    }
    return pages
  }, [totalPages, safeCurrentPage])

  // Checkbox indeterminate ref & select all logic
  const headerCheckboxRef = useRef(null)
  const currentVisibleIds = useMemo(
    () => paginatedClasses.map((c) => c.id),
    [paginatedClasses],
  )
  const isAllSelected =
    currentVisibleIds.length > 0 &&
    currentVisibleIds.every((id) => selectedClassIds.includes(id))
  const isSomeSelected =
    currentVisibleIds.some((id) => selectedClassIds.includes(id)) &&
    !isAllSelected

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isSomeSelected
    }
  }, [isSomeSelected])

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedClassIds((prev) =>
        prev.filter((id) => !currentVisibleIds.includes(id)),
      )
    } else {
      setSelectedClassIds((prev) =>
        Array.from(new Set([...prev, ...currentVisibleIds])),
      )
    }
  }

  const handleToggleSelect = (id) => {
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  // Header column sort toggle
  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        // Toggle direction between desc and asc (always keep an active sort direction)
        return { key, direction: prev.direction === "desc" ? "asc" : "desc" }
      }
      return { key, direction: key === "name" ? "asc" : "desc" }
    })
  }

  // Bulk actions handlers
  const handleBulkUpdateStatus = async (newStatus) => {
    const count = selectedClassIds.length
    if (count === 0) return

    const apiStatusMap = {
      open: "Open",
      ongoing: "Ongoing",
      draft: "Draft",
      closed: "Closed",
      cancelled: "Cancelled",
    }
    const apiStatus = apiStatusMap[newStatus]
    if (!apiStatus) {
      showToast("Invalid class status.", "error")
      return
    }

    try {
      for (const id of selectedClassIds) {
        const target = (classes || []).find((c) => String(c.id) === String(id))
        if (target) {
          await updateClass(id, { ...target, status: newStatus, apiStatus })
        }
      }
      showToast(`Đã cập nhật trạng thái cho ${count} lớp học!`, "success")
      setSelectedClassIds([])
    } catch (err) {
      showToast(
        err?.message || "Lỗi khi cập nhật trạng thái hàng loạt.",
        "error",
      )
    }
  }

  const handleBulkCancel = async () => {
    const count = selectedClassIds.length
    if (count === 0) return
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn hủy ${count} lớp học đã chọn không?\nCác lớp này sẽ chuyển sang trạng thái "Đã hủy" và ngừng nhận đăng ký.`,
    )
    if (!confirmed) return

    try {
      for (const id of selectedClassIds) {
        const target = (classes || []).find((c) => String(c.id) === String(id))
        if (target) {
          await updateClass(id, {
            ...target,
            status: "cancelled",
            apiStatus: "Cancelled",
          })
        }
      }
      showToast(`Đã chuyển ${count} lớp học sang trạng thái Đã hủy.`, "success")
      setSelectedClassIds([])
    } catch (err) {
      showToast(err?.message || "Lỗi khi hủy lớp học hàng loạt.", "error")
    }
  }

  const handleBulkExport = () => {
    const targets = (classes || []).filter((c) =>
      selectedClassIds.includes(c.id),
    )
    if (!targets.length) return
    exportClassesToCsv(targets, `danh_sach_${targets.length}_lop_da_chon`, { apiMode: apiEnabled })
    showToast(
      `Đã xuất ${targets.length} lớp học ra file Excel (CSV)!`,
      "success",
    )
  }

  const handleCopyLink = (cls) => {
    const link = `${window.location.origin}/member/catalog?classId=${cls.id}`
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(link)
        .then(() =>
          showToast(
            `Đã sao chép liên kết đăng ký lớp "${cls.nameVi || cls.name}"!`,
            "success",
          ),
        )
        .catch(() => showToast("Không thể sao chép liên kết.", "error"))
    } else {
      showToast("Trình duyệt không hỗ trợ sao chép tự động.", "error")
    }
  }

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
      filterSport !== "all" ||
      filterCoach !== "all" ||
      filterDateRange !== "all" ||
      activeTab !== "all",
  )

  const handleResetFilters = () => {
    setSearchTerm("")
    setFilterSport("all")
    setFilterCoach("all")
    setFilterDateRange("all")
    setActiveTab("all")
    setCurrentPage(1)
  }

  // Handle Enrollment Update
  const handleEnrollmentChange = (classId, newCount) => {
    if (typeof setClasses === "function") {
      setClasses((prev) =>
        prev.map((c) =>
          c.id === classId ? { ...c, enrolledCount: newCount } : c,
        ),
      )
    }
    if (typeof reloadClasses === "function") {
      reloadClasses()
    }
  }

  // Handle Save from Edit Modal
  const handleSaveClass = async (updatedData) => {
    await updateClass(updatedData.id, updatedData)
    showToast("Đã cập nhật thông tin lớp học thành công!", "success")
  }

  // Handle Cancel Class
  const handleCancelClass = async (cls) => {
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn hủy lớp "${cls.nameVi || cls.name}" không?\nLớp học sẽ chuyển sang trạng thái "Đã hủy" và ngừng nhận đăng ký.`,
    )
    if (!confirmed) return

    try {
      await updateClass(cls.id, {
        ...cls,
        status: "cancelled",
        apiStatus: "Cancelled",
      })
      showToast(
        `Đã chuyển lớp "${cls.nameVi || cls.name}" sang trạng thái Đã hủy.`,
        "success",
      )
    } catch (err) {
      showToast(err?.message || "Lỗi khi hủy lớp học.", "error")
    }
  }

  // Handle Duplicate Class: Pre-fill in NewClassModal with auto-increment K01 -> K02 and +28 days forward shift
  const handleDuplicateClass = (cls) => {
    setCloningClass(cls)
    setIsNewClassOpen(true)
  }

  // Safe Delete with confirmation
  const handleConfirmDelete = async () => {
    if (!deletingClassTarget || apiEnabled) return
    setIsDeleting(true)
    try {
      let result
      if (typeof deleteClass === "function") {
        result = await deleteClass(deletingClassTarget.id)
      }
      if (result?.success === false) {
        setDeletingClassTarget(null)
        return
      }
      showToast(
        `Đã xóa lớp "${deletingClassTarget.nameVi || deletingClassTarget.name}" thành công!`,
        "success",
      )
      setDeletingClassTarget(null)
    } catch (err) {
      showToast(err?.message || "Lỗi khi xóa lớp học.", "error")
    } finally {
      setIsDeleting(false)
    }
  }

  const calendarCells = useMemo(() => calendarMonthCells(calendarMonth), [calendarMonth])
  const calendarSchedule = conflictSchedule?.classes === classes ? conflictSchedule : null
  const calendarEntries = useMemo(() => {
    const sessions = apiEnabled
      ? calendarSchedule?.sessions || []
      : classes.flatMap((cls) => getClassSessions(cls).map((session) => ({
          ...session, classId: session.classId ?? cls.id,
        })))
    return buildClassCalendarEntries(classes, sessions)
  }, [apiEnabled, calendarSchedule, classes])
  const weekdaysCalendar = [
    "Thứ 2",
    "Thứ 3",
    "Thứ 4",
    "Thứ 5",
    "Thứ 6",
    "Thứ 7",
    "Chủ nhật",
  ]

  const urgentCoachAlerts = useMemo(() => {
    const nowTime = Date.now()
    return (classes || []).filter((cls) => {
      const isUnassigned =
        !cls.coachId ||
        cls.coachName === "Chưa phân công" ||
        !cls.coachName ||
        cls.coachName.includes("Chưa")
      if (!isUnassigned) return false
      const startDate = new Date(cls.startDate || cls.date)
      const hours = (startDate.getTime() - nowTime) / (1000 * 60 * 60)
      return hours > 0 && hours <= 48
    })
  }, [classes])

  // Loading skeleton — shown while context is fetching classes from API
  if (classesLoading) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label={language === "vi" ? "Đang tải..." : "Loading..."}>
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <SkeletonBlock className="h-7 w-32" />
            <SkeletonBlock className="h-3 w-72" />
          </div>
          <SkeletonBlock className="h-9 w-28 rounded-xl" />
        </div>
        {/* Stats row skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} className="h-14 rounded-xl" />
          ))}
        </div>
        {/* Table skeleton */}
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-stone-200">
            <SkeletonBlock className="h-8 w-full" />
          </div>
          <table className="w-full">
            <tbody className="divide-y divide-stone-100">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} cols={6} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* 1. HEADER: Gọn gàng trực tiếp trên nền trang (Bỏ card bọc tiêu đề) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            Lớp Normal
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Quản lý lớp nhóm, phân công huấn luyện viên, theo dõi sĩ số và trạng
            thái đăng ký.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Toggle Chế độ xem: Danh sách (Bảng) vs Lịch tháng */}
          <div className="bg-stone-100 p-1 rounded-xl flex items-center border border-stone-200/80 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-stone-900 shadow-2xs font-bold"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              Danh sách
            </button>
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "calendar"
                  ? "bg-white text-stone-900 shadow-2xs font-bold"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              Lịch tháng
            </button>
          </div>

          {/* Primary class action uses the system brand color. */}
          <button
            type="button"
            onClick={() => setIsNewClassOpen(true)}
            className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap ml-auto sm:ml-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo lớp học</span>
          </button>
        </div>
      </div>

      {/* Cảnh báo Quản lý: Lớp sắp khai giảng trong vòng 48h chưa gán HLV */}
      {urgentCoachAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Cảnh báo Quản lý:</strong> Có{" "}
              <strong>{urgentCoachAlerts.length}</strong> lớp sắp khai giảng
              trong vòng 48 giờ nhưng chưa được phân công Huấn luyện viên (
              {urgentCoachAlerts.map((c) => c.nameVi || c.name).join(", ")}).
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (urgentCoachAlerts[0]) setEditingClass(urgentCoachAlerts[0])
            }}
            className="text-xs font-bold text-amber-800 underline shrink-0 cursor-pointer hover:text-amber-950"
          >
            Phân công ngay &rarr;
          </button>
        </div>
      )}

      {/* 2. TABS TRẠNG THÁI CÓ SỐ ĐẾM */}
      <div className="border-b border-stone-200 flex items-center gap-1 overflow-x-auto pb-px text-xs font-medium scrollbar-none">
        {[
          { id: "all", label: "Tất cả", count: counts.all },
          {
            id: "open",
            label: "Đang mở đăng ký",
            count: counts.open,
          },
          { id: "ongoing", label: "Đang diễn ra", count: counts.ongoing },
          { id: "draft", label: "Bản nháp", count: counts.draft },
          { id: "closed", label: "Đã kết thúc", count: counts.closed },
          { id: "cancelled", label: "Đã hủy", count: counts.cancelled },
        ].map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2.5 rounded-t-lg transition-colors cursor-pointer border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? "border-brand-primary text-brand-primary font-bold bg-brand-blue-soft/50"
                  : "border-transparent text-stone-500 hover:text-stone-800 hover:border-stone-300"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-xs tabular-nums font-semibold transition-colors ${
                  isActive
                    ? "bg-brand-primary text-white shadow-2xs"
                    : "bg-stone-100 text-stone-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* 3 & 4. CARD CONTAINER BAO BỌC: THANH TÌM KIẾM, BỘ LỌC VÀ BẢNG DỮ LIỆU */}
      <div className="bg-white border border-stone-200/80 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* 3. THANH TÌM KIẾM, BỘ LỌC HOẶC THANH THAO TÁC HÀNG LOẠT (BULK ACTION BAR) */}
        {selectedClassIds.length > 0 ? (
          <div className="p-3 sm:px-5 sm:py-3.5 border-b border-brand-blue-soft bg-brand-blue-soft/50 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-brand-primary text-white text-xs font-bold flex items-center justify-center shadow-2xs">
                {selectedClassIds.length}
              </span>
              <span className="text-xs font-semibold text-stone-800">
                Đã chọn {selectedClassIds.length} lớp học
              </span>
              <button
                type="button"
                onClick={() => setSelectedClassIds([])}
                className="text-xs text-stone-500 hover:text-stone-800 underline underline-offset-2 ml-1 cursor-pointer transition-colors"
              >
                Bỏ chọn tất cả
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {!apiEnabled && (
                <div className="relative">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleBulkUpdateStatus(e.target.value)
                        e.target.value = ""
                      }
                    }}
                    defaultValue=""
                    className="h-8 pl-3 pr-7 bg-white hover:bg-stone-50 border border-stone-200/90 rounded-lg text-xs font-semibold text-stone-700 cursor-pointer focus:outline-none focus:border-stone-800 transition-colors shadow-2xs"
                  >
                    <option value="" disabled>
                      Đổi trạng thái...
                    </option>
                    <option value="open">Mở đăng ký</option>
                    <option value="ongoing">Đang diễn ra</option>
                    <option value="draft">Bản nháp</option>
                    <option value="closed">Đã kết thúc</option>
                  </select>
                </div>
              )}

              {/* Đổi HLV hàng loạt */}
              <button
                type="button"
                onClick={() => setIsBulkReassignOpen(true)}
                className="h-8 px-3 bg-white hover:bg-stone-50 border border-stone-200/90 rounded-lg text-xs font-semibold text-stone-700 flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              >
                <UserRoundCheck className="w-3.5 h-3.5 text-stone-500" />
                <span>Đổi HLV ({selectedClassIds.length})</span>
              </button>

              {/* Xuất Excel đã chọn */}
              {!isManager && (
                <button
                  type="button"
                  onClick={handleBulkExport}
                  className="h-8 px-3 bg-white hover:bg-stone-50 border border-stone-200/90 rounded-lg text-xs font-semibold text-stone-700 flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-stone-500" />
                  <span>Xuất Excel ({selectedClassIds.length})</span>
                </button>
              )}

              {!apiEnabled && (
                <button
                  type="button"
                  onClick={handleBulkCancel}
                  className="h-8 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Hủy {selectedClassIds.length} lớp</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5 border-b border-[#F1F3F5] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              {/* Ô tìm kiếm */}
              <div className="relative min-w-[220px] max-w-sm flex-1">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tìm lớp, bộ môn, HLV, phòng..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full bg-[#F8F9FA] hover:bg-white focus:bg-white border border-stone-200/80 rounded-xl pl-9 pr-8 py-2 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-800 focus:ring-1 focus:ring-stone-800 transition-colors"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("")
                      setCurrentPage(1)
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Lọc theo Bộ môn */}
              <div className="relative min-w-[130px]">
                <select
                  value={filterSport}
                  onChange={(e) => {
                    setFilterSport(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full h-9 pl-3 pr-8 bg-[#F8F9FA] hover:bg-white border border-stone-200/80 rounded-xl text-xs text-stone-700 font-medium appearance-none focus:outline-none focus:border-stone-800 cursor-pointer transition-colors"
                >
                  <option value="all">Tất cả bộ môn</option>
                  {availableSports.map((sp) => (
                    <option key={sp} value={sp}>
                      {sp}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Lọc theo Huấn luyện viên */}
              <div className="relative min-w-[150px]">
                <select
                  value={filterCoach}
                  onChange={(e) => {
                    setFilterCoach(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full h-9 pl-3 pr-8 bg-[#F8F9FA] hover:bg-white border border-stone-200/80 rounded-xl text-xs text-stone-700 font-medium appearance-none focus:outline-none focus:border-stone-800 cursor-pointer transition-colors"
                >
                  <option value="all">Tất cả HLV</option>
                  {availableCoaches.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Lọc theo Thời gian (Date Range Filter) */}
              <div className="relative min-w-[140px]">
                <select
                  value={filterDateRange}
                  onChange={(e) => {
                    setFilterDateRange(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-full h-9 pl-3 pr-8 bg-[#F8F9FA] hover:bg-white border border-stone-200/80 rounded-xl text-xs text-stone-700 font-medium appearance-none focus:outline-none focus:border-stone-800 cursor-pointer transition-colors"
                >
                  <option value="all">Tất cả thời gian</option>
                  <option value="today">Hôm nay</option>
                  <option value="this_week">Tuần này</option>
                  <option value="next_week">Tuần tới</option>
                  <option value="this_month">Tháng này</option>
                  <option value="next_month">Tháng tới</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Nút Xóa bộ lọc (Clear Filters) */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-2.5 py-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Xóa bộ lọc</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Tùy chỉnh cột hiển thị (Column Visibility) */}
              <div className="relative" ref={columnDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsColumnDropdownOpen((prev) => !prev)}
                  className="h-9 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                  title="Tùy chỉnh các cột hiển thị trong bảng dữ liệu"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-stone-600" />
                  <span>Tùy chỉnh cột</span>
                </button>
                {isColumnDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-56 bg-white border border-stone-200 rounded-xl shadow-xl py-2 px-3 z-50 text-xs animate-in fade-in zoom-in-95 duration-100 space-y-2">
                    <div className="font-bold text-stone-800 pb-1.5 border-b border-stone-100 flex items-center justify-between">
                      <span>Cột hiển thị</span>
                      <button
                        type="button"
                        onClick={() =>
                          setColumnVisibility(DEFAULT_COLUMN_VISIBILITY)
                        }
                        className="text-xs font-normal text-stone-500 hover:text-stone-800 cursor-pointer"
                      >
                        Mặc định
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { id: "schedule", label: "Lịch học" },
                        { id: "room", label: "Sân tập" },
                        { id: "coach", label: "Huấn luyện viên" },
                        { id: "enrollment", label: "Đăng ký (Sĩ số)" },
                        { id: "price", label: "Học phí / Buổi" },
                        { id: "status", label: "Trạng thái" },
                      ].map((col) => (
                        <label
                          key={col.id}
                          className="flex items-center gap-2.5 cursor-pointer hover:bg-stone-50 p-1.5 rounded-lg select-none text-stone-700"
                        >
                          <input
                            type="checkbox"
                            checked={columnVisibility[col.id] !== false}
                            onChange={(e) =>
                              setColumnVisibility((prev) => ({
                                ...prev,
                                [col.id]: e.target.checked,
                              }))
                            }
                            className="w-3.5 h-3.5 rounded text-brand-primary focus:ring-brand-primary border-stone-300 cursor-pointer"
                          />
                          <span className="font-medium">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Nhập dữ liệu hàng loạt (Bulk Import Excel) & Xuất Excel toàn bộ danh sách đang hiển thị */}
              {!isManager && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(true)}
                    className="h-9 px-3.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                    title="Nhập danh sách lớp học từ tệp Excel/CSV"
                  >
                    <Upload className="w-3.5 h-3.5 text-stone-600" />
                    <span>Nhập Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      exportClassesToCsv(
                        filteredAndSortedClasses,
                        "danh_sach_lop_hoc",
                        { apiMode: apiEnabled },
                      )
                    }
                    className="h-9 px-3.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                    title="Xuất dữ liệu lớp học ra tệp Excel (CSV)"
                  >
                    <Download className="w-3.5 h-3.5 text-stone-600" />
                    <span>Xuất Excel</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* 4. MAIN CONTENT: BẢNG DANH SÁCH (TABLE VIEW) HOẶC LỊCH THÁNG (CALENDAR) */}
        {viewMode === "table" ? (
          filteredAndSortedClasses.length === 0 ? (
            /* TRẠNG THÁI RỖNG (EMPTY STATE) GỌN GÀNG */
            <div className="p-12 text-center max-w-lg mx-auto space-y-4">
              <div className="w-12 h-12 bg-stone-100 text-stone-600 rounded-2xl flex items-center justify-center mx-auto border border-stone-200/80">
                <Calendar className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-stone-900">
                  {hasActiveFilters
                    ? "Không tìm thấy lớp học phù hợp"
                    : "Chưa có lớp học nào trong hệ thống"}
                </h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
                  {hasActiveFilters
                    ? "Hãy thử điều chỉnh từ khóa tìm kiếm hoặc bỏ các bộ lọc để xem đầy đủ danh sách."
                    : "Hãy tạo lớp học mới để bắt đầu xếp lịch, phân công HLV và mở cho học viên đăng ký."}
                </p>
              </div>
              <div className="pt-2 flex justify-center items-center gap-3">
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Xóa bộ lọc
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsNewClassOpen(true)}
                    className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tạo lớp học đầu tiên</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* BẢNG DANH SÁCH LỚP HỌC CHUẨN DESIGN SYSTEM */
            <div>
              {totalConflictsCount > 0 && (
                <div className="mx-6 my-3 p-3 bg-rose-50 border border-rose-200/90 rounded-xl text-xs text-rose-800 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      <strong>
                        Phát hiện {totalConflictsCount} lớp học bị trùng
                        lịch/sân tập hoặc HLV.
                      </strong>{" "}
                      Vui lòng kiểm tra và điều chỉnh các dòng được tô viền đỏ.
                    </span>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto min-h-[380px]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#F1F3F5] bg-[#FAFAFC] text-[#6C757D] font-medium uppercase text-[10.5px] tracking-wider">
                      {/* Checkbox chọn tất cả */}
                      <th className="py-3.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          ref={headerCheckboxRef}
                          checked={isAllSelected}
                          onChange={handleSelectAll}
                          className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary border-stone-300 cursor-pointer transition-colors"
                          title="Chọn tất cả lớp ở trang này"
                        />
                      </th>
                      {/* Cột Lớp (Sortable) */}
                      <th
                        onClick={() => handleSort("name")}
                        className="py-3.5 px-4 min-w-[200px] cursor-pointer select-none group/th hover:text-stone-900 transition-colors"
                        title="Nhấp để sắp xếp theo Tên lớp"
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className={
                              sortConfig?.key === "name"
                                ? "font-bold text-stone-900"
                                : ""
                            }
                          >
                            Tên Lớp
                          </span>
                          <SortIcon sortKey="name" currentConfig={sortConfig} />
                        </div>
                      </th>
                      {/* Cột Lịch học (Sortable) */}
                      {columnVisibility.schedule !== false && (
                        <th
                          onClick={() => handleSort("date")}
                          className="py-3.5 px-4 min-w-[190px] cursor-pointer select-none group/th hover:text-stone-900 transition-colors"
                          title="Nhấp để sắp xếp theo Lịch học / Ngày khai giảng"
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className={
                                sortConfig?.key === "date"
                                  ? "font-bold text-stone-900"
                                  : ""
                              }
                            >
                              Lịch học
                            </span>
                            <SortIcon
                              sortKey="date"
                              currentConfig={sortConfig}
                            />
                          </div>
                        </th>
                      )}
                      {columnVisibility.room !== false && (
                        <th className="py-3.5 px-4 min-w-[140px]">Sân tập</th>
                      )}
                      {columnVisibility.coach !== false && (
                        <th className="py-3.5 px-4 min-w-[170px]">
                          Huấn luyện viên
                        </th>
                      )}
                      {/* Cột Đăng ký (Sortable) */}
                      {columnVisibility.enrollment !== false && (
                        <th
                          onClick={() => handleSort("enrollment")}
                          className="py-3.5 px-4 min-w-[150px] cursor-pointer select-none group/th hover:text-stone-900 transition-colors"
                          title="Nhấp để sắp xếp theo Tỷ lệ đăng ký"
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className={
                                sortConfig?.key === "enrollment"
                                  ? "font-bold text-stone-900"
                                  : ""
                              }
                            >
                              Đăng ký
                            </span>
                            <SortIcon
                              sortKey="enrollment"
                              currentConfig={sortConfig}
                            />
                          </div>
                        </th>
                      )}
                      {/* Cột Học phí (Tùy chọn dành cho Sales / Đội ngũ kinh doanh) */}
                      {columnVisibility.price && (
                        <th
                          onClick={() => handleSort("price")}
                          className="py-3.5 px-4 min-w-[130px] cursor-pointer select-none group/th hover:text-stone-900 transition-colors"
                          title="Nhấp để sắp xếp theo Học phí"
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className={
                                sortConfig?.key === "price"
                                  ? "font-bold text-stone-900"
                                  : ""
                              }
                            >
                              Học phí
                            </span>
                            <SortIcon
                              sortKey="price"
                              currentConfig={sortConfig}
                            />
                          </div>
                        </th>
                      )}
                      {columnVisibility.status !== false && (
                        <th className="py-3.5 px-4 min-w-[120px]">
                          Trạng thái
                        </th>
                      )}
                      <th className="py-3.5 pl-2 pr-4 w-10 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F3F5]">
                    {paginatedClasses.map((cls, idx) => {
                      const capacity = cls.capacity ?? (apiEnabled ? null : 8)
                      const enrolled = cls.enrolledCount ?? (apiEnabled ? null : 0)
                      const minCap = cls.minCapacity ?? (apiEnabled ? null : 4)
                      const percent = capacity > 0 && enrolled !== null
                        ? Math.min(100, Math.round((enrolled / capacity) * 100))
                        : null
                      const sessionCount = cls.sessionCount ?? (apiEnabled ? null : 12)
                      const isOngoing =
                        normalizeClassStatus(cls.status) === "ongoing"
                      const isSelected = selectedClassIds.includes(cls.id)
                      const classConflict = classConflictsMap[cls.id]
                      const hasConflict = Boolean(classConflict?.hasConflict)
                      const hasMissingSchedule = Boolean(
                        classConflict?.hasMissingSchedule,
                      )
                      const rawClassType = String(cls.classType || "")
                        .trim()
                        .toLowerCase()
                      const classTypeLabel =
                        rawClassType === "normal"
                          ? "Normal"
                          : rawClassType === "advanced"
                            ? "Advanced"
                            : "Chưa xác định"
                      const classTypeClassName =
                        rawClassType === "normal"
                          ? "bg-sky-50 text-sky-700 border-sky-200"
                          : rawClassType === "advanced"
                            ? "bg-violet-50 text-violet-700 border-violet-200"
                            : "bg-stone-50 text-stone-600 border-stone-200"

                      return (
                        <tr
                          key={cls.id}
                          onClick={() => setQuickViewClass(cls)}
                          className={`transition-colors group/row cursor-pointer ${
                            hasConflict
                              ? "bg-rose-50/70 hover:bg-rose-100/70 border-l-4 border-l-rose-500"
                              : isSelected
                                ? "bg-rose-50/25 hover:bg-stone-50/80"
                                : "hover:bg-stone-50/80"
                          }`}
                        >
                          {/* Cột Checkbox hàng */}
                          <td
                            className="py-4 px-3 text-center align-middle"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(cls.id)}
                              className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary border-stone-300 cursor-pointer transition-colors"
                            />
                          </td>

                          {/* Cột 1: Lớp */}
                          <td className="py-4 px-4 align-middle">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div
                                  className={`font-semibold text-sm transition-colors line-clamp-1 ${
                                    hasConflict
                                      ? "text-rose-900 group-hover/row:text-rose-700 font-bold"
                                      : "text-stone-900 group-hover/row:text-brand-primary"
                                  }`}
                                  title={cls.nameVi || cls.name}
                                >
                                  {cls.nameVi || cls.name}
                                </div>
                                <span
                                  className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold leading-none shrink-0 ${classTypeClassName}`}
                                  title="Loại lớp"
                                >
                                  {classTypeLabel}
                                </span>
                                {hasConflict && (
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10.5px] font-bold border border-rose-300 shadow-2xs shrink-0 cursor-help"
                                    title={classConflict.tooltip}
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                    <span>Trùng lịch</span>
                                  </span>
                                )}
                                {hasMissingSchedule && (
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10.5px] font-bold border border-amber-300 shadow-2xs shrink-0 cursor-help"
                                    title={
                                      classConflict?.tooltip ||
                                      "Chưa đủ dữ liệu lịch"
                                    }
                                  >
                                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>Chưa đủ dữ liệu</span>
                                  </span>
                                )}
                              </div>
                              <div
                                className="text-xs text-stone-500 flex items-center gap-1.5 flex-wrap"
                                title={`${sessionCount ?? "—"} buổi`}
                              >
                                <span>{sessionCount ?? "—"} buổi</span>
                              </div>
                            </div>
                          </td>

                          {/* Cột 2: Lịch học (Thẻ badge ngày trong tuần + Giờ học + Khai giảng) */}
                          {columnVisibility.schedule !== false && (
                            <td className="py-4 px-4 align-middle">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 flex-wrap">
                                  {getWeekdaysArray(
                                    cls.selectedDays,
                                    cls.category,
                                    apiEnabled,
                                  ).map((day) => (
                                    <span
                                      key={day}
                                      className="px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-stone-100 text-stone-700 border border-stone-200/80 tracking-tight"
                                    >
                                      {day}
                                    </span>
                                  ))}
                                  {(!apiEnabled || (cls.startTime && cls.endTime)) && (
                                    <span
                                      className="text-xs font-semibold text-stone-800 ml-0.5"
                                      title={`Khung giờ học: ${formatScheduleTime(cls, apiEnabled)}`}
                                    >
                                      {formatScheduleTime(cls, apiEnabled)}
                                    </span>
                                  )}
                                </div>
                                <div
                                  className="text-xs text-stone-500"
                                  title={
                                    isOngoing && rawClassType === "normal"
                                      ? "Đang diễn ra"
                                      : isOngoing
                                      ? `Buổi tiếp theo: — / ${sessionCount ?? "—"} buổi`
                                      : `Khai giảng: ${formatViDate(cls.startDate || cls.date)}`
                                  }
                                >
                                  {isOngoing && rawClassType === "normal" ? (
                                    <span className="text-sm font-semibold text-emerald-700">
                                      Đang diễn ra
                                    </span>
                                  ) : isOngoing ? (
                                    <span className="text-emerald-700 font-medium">
                                      {`Buổi tiếp theo: — / ${sessionCount ?? "—"} buổi`}
                                    </span>
                                  ) : (
                                    <span>
                                      {rawClassType !== "normal" && <>Khai giảng:{" "}</>}
                                      <span className="text-sm font-semibold text-stone-900">
                                        {formatViDate(cls.startDate || cls.date)}
                                      </span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                          )}

                          {/* Cột 3: Sân tập */}
                          {columnVisibility.room !== false && (
                            <td className="py-4 px-4 align-middle">
                              <div className="space-y-0.5">
                                <div
                                  className="font-medium text-stone-800 line-clamp-1 truncate"
                                  title={
                                    cls.roomVi || cls.room || (apiEnabled ? "—" : "Sân tiêu chuẩn")
                                  }
                                >
                                  {cls.roomVi || cls.room || (apiEnabled ? "—" : "Sân tiêu chuẩn")}
                                </div>
                                <div
                                  className="text-xs text-stone-500 line-clamp-1 truncate"
                                  title={`Sức chứa ${capacity ?? "—"} • ${cls.roomSpec || (apiEnabled ? "—" : "Thảm PVC tiêu chuẩn")}`}
                                >
                                  Sức chứa {capacity ?? "—"} &bull;{" "}
                                  {cls.roomSpec || (apiEnabled ? "—" : "Thảm PVC")}
                                </div>
                              </div>
                            </td>
                          )}

                          {/* Cột 4: Huấn luyện viên (Deterministic Soft Pastel Color Avatar + Tooltip) */}
                          {columnVisibility.coach !== false && (
                            <td className="py-4 px-4 align-middle">
                              <div className="flex items-center gap-2.5">
                                {(() => {
                                  const palette = getCoachAvatarPalette(
                                    cls.coachName,
                                  )
                                  const initial = (cls.coachName ||
                                    "H")[0]?.toUpperCase()
                                  return (
                                    <div
                                      className={`w-7 h-7 rounded-full ${palette.bg} border ${palette.border} ${palette.text} font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs`}
                                      title={`HLV: ${cls.coachName || "Chưa phân công"}`}
                                    >
                                      {initial}
                                    </div>
                                  )
                                })()}
                                <div className="space-y-0.5 min-w-0">
                                  <div
                                    className="font-medium text-stone-800 line-clamp-1 truncate flex items-center gap-1.5"
                                    title={cls.coachName || "Chưa phân công"}
                                  >
                                    <span>{cls.coachName || "Chưa phân công"}</span>
                                    {(() => {
                                      const isUnassigned =
                                        !cls.coachId ||
                                        cls.coachName === "Chưa phân công" ||
                                        !cls.coachName ||
                                        cls.coachName.includes("Chưa")
                                      const startDt = new Date(cls.startDate || cls.date)
                                      const hoursToStart = (startDt.getTime() - Date.now()) / (1000 * 60 * 60)
                                      if (isUnassigned && hoursToStart > 0 && hoursToStart <= 48) {
                                        return (
                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-xs bg-rose-50 text-rose-700 border border-rose-200 font-bold shrink-0">
                                            ⚠️ Chưa có HLV (&lt; 48h)
                                          </span>
                                        )
                                      }
                                      return null
                                    })()}
                                  </div>
                                  {(() => {
                                    const isMismatch =
                                      cls.coachName &&
                                      cls.coachSpecialty &&
                                      cls.coachName !== "Chưa phân công" &&
                                      !isCoachMatchingSport(
                                        {
                                          specialization: cls.coachSpecialty,
                                          specializationVi: cls.coachSpecialty,
                                        },
                                        cls.category,
                                      )
                                    return (
                                      <div
                                        className="text-xs text-stone-500 line-clamp-1 truncate flex items-center gap-1.5"
                                        title={`Chuyên môn: ${cls.coachSpecialty || (apiEnabled ? "—" : cls.category || "HLV")}${
                                          isMismatch
                                            ? " (Khác với bộ môn của lớp)"
                                            : ""
                                        }`}
                                      >
                                        <span>
                                          Chuyên môn:{" "}
                                          {cls.coachSpecialty || (apiEnabled ? "—" : cls.category || "HLV")}
                                        </span>
                                        {isMismatch && (
                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-xs bg-amber-50 text-amber-700 border border-amber-200/80 font-medium shrink-0">
                                            ⚠️ Khác môn
                                          </span>
                                        )}
                                      </div>
                                    )
                                  })()}
                                </div>
                              </div>
                            </td>
                          )}

                          {/* Cột 5: Đăng ký (Linear Progress Bar 8px kẹp giữa số liệu và text cảnh báo) */}
                          {columnVisibility.enrollment !== false && (
                            <td className="py-4 px-4 align-middle">
                              <div className="w-36">
                                {/* Dòng số liệu: tỷ lệ và % */}
                                <div className="flex items-center justify-between text-xs leading-none">
                                  <span className="font-semibold text-stone-900 tabular-nums">
                                    {enrolled}/{capacity}
                                  </span>
                                  <span className="text-xs font-medium text-stone-500 tabular-nums">
                                    {percent ?? "—"}{percent === null ? "" : "%"}
                                  </span>
                                </div>

                                {/* Linear Progress Bar: độ dày h-2 (8px), bo tròn 2 đầu, track #E9ECEF, margin my-1.5 */}
                                <div className="w-full h-2 bg-[#E9ECEF] rounded-full overflow-hidden my-1.5">
                                  <div
                                    className={`h-full transition-all duration-300 rounded-full ${
                                      enrolled !== null && capacity !== null && enrolled >= capacity
                                        ? "bg-emerald-600"
                                        : enrolled !== null && minCap !== null && enrolled >= minCap
                                          ? "bg-emerald-500"
                                          : percent > 0
                                            ? "bg-emerald-500"
                                            : "bg-transparent"
                                    }`}
                                    style={{ width: percent === null ? "0%" : percent + "%" }}
                                  />
                                </div>

                                {/* Dòng text trạng thái / cảnh báo màu xám nhạt #6C757D */}
                                <div className="text-xs leading-tight text-[#6C757D]">
                                  {enrolled === null || capacity === null || minCap === null ? (
                                    <span>—</span>
                                  ) : enrolled < minCap ? (
                                    <span>
                                      Cần thêm {minCap - enrolled} để mở lớp
                                    </span>
                                  ) : enrolled >= capacity ? (
                                    <span className="text-emerald-700 font-medium">
                                      Đã đủ học viên
                                    </span>
                                  ) : (
                                    <span className="text-emerald-700 font-medium">
                                      Đã đủ điều kiện mở
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                          )}

                          {/* Cột Học phí (Dành cho Sales & Ban quản lý) */}
                          {columnVisibility.price &&
                            (() => {
                              const numericPrice = cls.price === null || cls.price === undefined ? null : Number(cls.price)
                              const isFree = apiEnabled
                                ? numericPrice === 0
                                : cls.isFree || numericPrice === 0
                              const resolvedPrice = apiEnabled
                                ? numericPrice
                                : isFree
                                  ? 0
                                : numericPrice > 0
                                  ? numericPrice
                                  : (
                                        cls.category ||
                                        cls.nameVi ||
                                        cls.name ||
                                        ""
                                      )
                                        .toLowerCase()
                                        .includes("pickleball")
                                    ? 800000
                                    : (
                                          cls.category ||
                                          cls.nameVi ||
                                          cls.name ||
                                          ""
                                        )
                                          .toLowerCase()
                                          .includes("bắn súng")
                                      ? 1200000
                                      : (
                                            cls.category ||
                                            cls.nameVi ||
                                            cls.name ||
                                            ""
                                          )
                                            .toLowerCase()
                                            .includes("bắn cung")
                                        ? 900000
                                        : 600000
                              const sessionCount = cls.sessionCount ?? (apiEnabled ? null : 12)
                              const perSession = resolvedPrice === null || sessionCount === null || sessionCount === 0
                                ? null
                                : Math.round(resolvedPrice / sessionCount / 1000) * 1000

                              return (
                                <td className="py-4 px-4 align-middle whitespace-nowrap">
                                  <div className="space-y-0.5">
                                    {resolvedPrice === null ? (
                                      <div>—</div>
                                    ) : isFree || resolvedPrice === 0 ? (
                                      <>
                                        <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          Miễn phí
                                        </div>
                                        <div className="text-xs text-stone-500 tabular-nums">
                                          0 đ / buổi
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="font-bold text-stone-900 tabular-nums">
                                          {resolvedPrice.toLocaleString(
                                            "vi-VN",
                                          )}{" "}
                                          đ
                                        </div>
                                        <div className="text-xs text-stone-500 tabular-nums">
                                          ~{perSession?.toLocaleString("vi-VN") ?? "—"}{" "}
                                          đ/buổi
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </td>
                              )
                            })()}

                          {/* Cột 6: Trạng thái */}
                          {columnVisibility.status !== false && (
                            <td className="py-4 px-4 align-middle whitespace-nowrap">
                              <StatusPill status={cls.status} />
                            </td>
                          )}

                          {/* Cột 7: Thao tác (Menu ⋯ căn sát lề phải) */}
                          <td
                            className="py-4 pl-2 pr-4 align-middle text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <RowActionMenu
                              cls={cls}
                              alignUp={
                                paginatedClasses.length > 3 &&
                                idx >= paginatedClasses.length - 2
                              }
                              onQuickView={(c) => setQuickViewClass(c)}
                              onViewMembers={(c) => setEnrollingClass(c)}
                              onEdit={(c) => setEditingClass(c)}
                              onChangeCoach={(c) => setEditingClass(c)}
                              onDuplicate={handleDuplicateClass}
                              onCancelClass={handleCancelClass}
                              onDelete={(c) => setDeletingClassTarget(c)}
                              onCopyLink={handleCopyLink}
                              apiMode={apiEnabled}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bảng footer: Phân trang chuẩn & bộ chọn số dòng */}
              <div className="px-5 py-3.5 border-t border-[#F1F3F5] bg-[#FBFBFC] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
                <div className="flex items-center gap-3">
                  <span>
                    Hiển thị{" "}
                    <strong className="font-semibold text-stone-800">
                      {totalItems > 0 ? startIdx + 1 : 0} - {endIdx}
                    </strong>{" "}
                    trên tổng số{" "}
                    <strong className="font-semibold text-stone-800">
                      {totalItems}
                    </strong>{" "}
                    lớp học
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  {/* Bộ chọn số dòng trên 1 trang */}
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500 text-xs">Số hàng:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value))
                        setCurrentPage(1)
                      }}
                      className="h-8 px-2.5 bg-white border border-stone-200/90 rounded-lg text-xs font-medium text-stone-700 focus:outline-none focus:border-stone-800 cursor-pointer shadow-2xs"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  {/* Các nút chuyển trang */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safeCurrentPage <= 1}
                      className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                      title="Trang trước"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {pageNumbers.map((p, pIdx) =>
                      p === "..." ? (
                        <span
                          key={`ellipsis-${pIdx}`}
                          className="px-1.5 text-stone-400"
                        >
                          ...
                        </span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            safeCurrentPage === p
                              ? "bg-stone-900 text-white shadow-2xs"
                              : "bg-white text-stone-600 hover:bg-stone-50 border border-stone-200 shadow-2xs"
                          }`}
                        >
                          {p}
                        </button>
                      ),
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={safeCurrentPage >= totalPages}
                      className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs"
                      title="Trang sau"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        ) : (
          /* LỊCH THÁNG (CALENDAR MATRIX VIEW CHUẨN DESIGN) */
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-stone-900">
                Lịch lớp tháng {calendarMonth.slice(5, 7)}/{calendarMonth.slice(0, 4)}
              </h3>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Tháng trước" onClick={() => setCalendarMonth((month) => shiftCalendarMonth(month, -1))} className="rounded-lg border border-stone-200 p-1.5 hover:bg-stone-50"><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" aria-label="Tháng sau" onClick={() => setCalendarMonth((month) => shiftCalendarMonth(month, 1))} className="rounded-lg border border-stone-200 p-1.5 hover:bg-stone-50"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
            {apiEnabled && classes.length > 0 && !calendarSchedule && <p role="status" className="text-xs text-stone-500">Đang tải lịch buổi học…</p>}
            {apiEnabled && calendarSchedule?.error && <p role="alert" className="text-xs text-rose-700">Không tải được lịch buổi học. Lịch chỉ hiển thị ngày khai giảng của lớp.</p>}

            <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-stone-600 pb-2 border-b border-stone-200 bg-stone-50/70 p-2.5 rounded-xl">
              {weekdaysCalendar.map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2 min-h-[340px]">
              {calendarCells.map((dateStr, i) => {
                if (!dateStr) {
                  return (
                    <div
                      key={`empty-${i}`}
                      aria-hidden="true"
                      className="min-h-[88px] rounded-xl bg-stone-50/40 border border-dashed border-stone-100"
                    />
                  )
                }
                const dayEntries = calendarEntries[dateStr] || []

                return (
                  <div
                    key={dateStr}
                    className={`p-2 bg-stone-50/60 border border-stone-200 rounded-xl min-h-[88px] text-left transition-colors hover:bg-stone-50 ${
                      dateStr === todayKey ? "ring-2 ring-stone-900 bg-stone-100/50" : ""
                    }`}
                  >
                    <div className="text-xs font-semibold text-stone-500 mb-1 tabular-nums">
                      {Number(dateStr.slice(8, 10))}
                    </div>
                    {dayEntries.map(({ class: cls, session, type }, entryIndex) => (
                      <button
                        type="button"
                        key={`${type}-${cls.id}-${session?.id ?? entryIndex}`}
                        onClick={() => setQuickViewClass(cls)}
                        title={`${type === "session" ? "Buổi học" : "Khai giảng"}: ${cls.nameVi || cls.name}`}
                        className="w-full text-left p-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-900 font-semibold line-clamp-2 mb-1 shadow-2xs hover:border-stone-400 cursor-pointer"
                      >
                        <span className="text-stone-900 font-bold tabular-nums">
                          {type === "session" ? (session.startTime || "Buổi học") : "Khai giảng"}
                        </span>{" "}
                        {cls.nameVi || cls.name}
                        {type === "session" && session.status ? ` (${session.status})` : ""}
                      </button>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* DIALOG XÁC NHẬN XÓA LỚP HỌC (SAFE CONFIRMATION DIALOG) */}
      {deletingClassTarget && !apiEnabled && (
        <div className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Xác nhận xóa vĩnh viễn lớp học?
              </h3>
              <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
                Bạn có chắc chắn muốn xóa lớp{" "}
                <strong className="text-stone-900 font-bold">
                  "{deletingClassTarget.nameVi || deletingClassTarget.name}"
                </strong>{" "}
                khỏi hệ thống không? Toàn bộ thông tin lịch học và dữ liệu liên
                quan sẽ bị xóa vĩnh viễn và không thể hoàn tác.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingClassTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-200 hover:bg-stone-50 rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? "Đang xóa..." : "Xóa lớp học"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER XEM CHI TIẾT NHANH (OFFCANVAS SIDE DRAWER) */}
      {quickViewClass && (
        <ClassDetailDrawer
          cls={quickViewClass}
          conflictInfo={classConflictsMap[quickViewClass.id]}
          onClose={() => setQuickViewClass(null)}
          onEdit={(c) => {
            setEditingClass(c)
          }}
          onDuplicate={(c) => {
            handleDuplicateClass(c)
          }}
          onCancelClass={(c) => {
            handleCancelClass(c)
          }}
          onEnrollmentChange={handleEnrollmentChange}
        />
      )}

      {/* MODAL NHẬP DỮ LIỆU HÀNG LOẠT (IMPORT EXCEL/CSV) */}
      <ImportClassesModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => {
          if (typeof reloadClasses === "function") reloadClasses()
        }}
      />

      {/* MODAL ĐỔI HUẤN LUYỆN VIÊN HÀNG LOẠT */}
      <BulkReassignCoachModal
        isOpen={isBulkReassignOpen}
        onClose={() => setIsBulkReassignOpen(false)}
        selectedClasses={(classes || []).filter((c) =>
          selectedClassIds.includes(c.id),
        )}
        onReassignSuccess={() => {
          setSelectedClassIds([])
          if (typeof reloadClasses === "function") reloadClasses()
        }}
      />

      {/* MODAL TẠO LỚP HỌC MỚI (Hỗ trợ nhân bản / cloneFrom) */}
      <NewClassModal
        isOpen={isNewClassOpen}
        cloneFrom={cloningClass}
        onClose={() => {
          setIsNewClassOpen(false)
          setCloningClass(null)
        }}
      />

      {/* MODAL CHỈNH SỬA LỚP HỌC */}
      {editingClass && (
        <EditClassModal
          item={editingClass}
          apiMode={apiEnabled}
          subjects={subjects}
          staff={staff}
          coaches={coaches}
          existingClasses={classes}
          language={language}
          onClose={() => setEditingClass(null)}
          onSave={handleSaveClass}
        />
      )}

      {/* MODAL DANH SÁCH HỌC VIÊN */}
      {enrollingClass && (
        <ClassEnrollmentsModal
          cls={enrollingClass}
          onClose={() => setEnrollingClass(null)}
          onEnrollmentChange={handleEnrollmentChange}
        />
      )}
    </div>
  )
}
