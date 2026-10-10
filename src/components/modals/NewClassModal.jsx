import React, { useState, useEffect, useMemo, useRef } from "react"
import { useSCMS } from "../../context/SCMSContext"
import {
  SPORT_DISCIPLINES,
  CLASS_LEVELS,
  isCoachMatchingSport,
} from "../classes/sportDisciplines"
import { useScheduleConflict } from "../classes/hooks/useScheduleConflict"
import { CurrencyInput } from "../common/CurrencyInput"
import {
  ArrowLeft,
  Calendar,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  Minus,
  ArrowLeftRight,
} from "lucide-react"

const WEEKDAYS = [
  { id: 1, label: "T2", name: "Thứ Hai", dayOfWeek: 1 },
  { id: 2, label: "T3", name: "Thứ Ba", dayOfWeek: 2 },
  { id: 3, label: "T4", name: "Thứ Tư", dayOfWeek: 3 },
  { id: 4, label: "T5", name: "Thứ Năm", dayOfWeek: 4 },
  { id: 5, label: "T6", name: "Thứ Sáu", dayOfWeek: 5 },
  { id: 6, label: "T7", name: "Thứ Bảy", dayOfWeek: 6 },
  { id: 0, label: "CN", name: "Chủ nhật", dayOfWeek: 0 },
]

const VI_WEEKDAYS_FULL = [
  "Chủ nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
]

const DEFAULT_COACHES = [
  {
    id: 2,
    name: "Trần Thị Hương",
    specializationVi: "Cầu lông",
    specialization: "Cầu lông",
    role: "coach",
    status: "active",
  },
  {
    id: 3,
    name: "Lê Minh Khoa",
    specializationVi: "Bóng bàn",
    specialization: "Bóng bàn",
    role: "coach",
    status: "active",
  },
  {
    id: 4,
    name: "Phạm Thị Lan",
    specializationVi: "Pickleball",
    specialization: "Pickleball",
    role: "coach",
    status: "active",
  },
  {
    id: 14,
    name: "Trần Anh Dũng",
    specializationVi: "Bóng rổ",
    specialization: "Bóng rổ",
    role: "coach",
    status: "active",
  },
  {
    id: 15,
    name: "Nguyễn Văn Hoàng",
    specializationVi: "Bắn súng",
    specialization: "Bắn súng",
    role: "coach",
    status: "active",
  },
  {
    id: 16,
    name: "Lê Nguyễn Thiên Phúc",
    specializationVi: "Bắn cung",
    specialization: "Bắn cung",
    role: "coach",
    status: "active",
  },
  {
    id: 17,
    name: "Lê Phương Anh",
    specializationVi: "Bơi lội",
    specialization: "Bơi lội",
    role: "coach",
    status: "active",
  },
  {
    id: 18,
    name: "Lê Trần Phi",
    specializationVi: "Bóng đá",
    specialization: "Bóng đá",
    role: "coach",
    status: "active",
  },
  {
    id: 19,
    name: "Huỳnh Diễm My",
    specializationVi: "Quần vợt (Tennis)",
    specialization: "Tennis",
    role: "coach",
    status: "active",
  },
  {
    id: 20,
    name: "Vũ Quốc Trung",
    specializationVi: "Bóng chuyền",
    specialization: "Bóng chuyền",
    role: "coach",
    status: "active",
  },
]

// Generate 15-minute time options from 05:00 to 23:00
const TIME_OPTIONS_15MIN = []
for (let h = 5; h <= 22; h++) {
  const hh = String(h).padStart(2, "0")
  for (const mm of ["00", "15", "30", "45"]) {
    TIME_OPTIONS_15MIN.push(`${hh}:${mm}`)
  }
}
TIME_OPTIONS_15MIN.push("23:00")

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

function formatViDateWithWeekday(dateInput) {
  if (!dateInput) return "—"
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return dateInput
  const dayName = VI_WEEKDAYS_FULL[d.getDay()]
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${dayName} ${dd}/${mm}/${yyyy}`
}

function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return "0"
  return Number(num).toLocaleString("vi-VN")
}

function getDurationLabel(startTime, endTime) {
  if (!startTime || !endTime) return ""
  const [sh, sm] = startTime.split(":").map(Number)
  const [eh, em] = endTime.split(":").map(Number)
  let totalMin = eh * 60 + em - (sh * 60 + sm)
  if (totalMin <= 0) totalMin += 24 * 60
  const hours = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  if (mins === 0) return `${hours} giờ`
  if (hours === 0) return `${mins} phút`
  return `${hours} giờ ${mins} phút`
}

function getNextValidUpcomingDate(selectedDays, startTime = "06:00") {
  const now = new Date()
  const [sh, sm] = (startTime || "06:00").split(":").map(Number)
  const cur = new Date()

  for (let i = 0; i < 14; i++) {
    const dayOfWeek = cur.getDay()
    if (selectedDays.includes(dayOfWeek)) {
      const sessionStart = new Date(
        cur.getFullYear(),
        cur.getMonth(),
        cur.getDate(),
        sh,
        sm,
        0,
      )
      if (sessionStart > now) {
        const yyyy = cur.getFullYear()
        const mm = String(cur.getMonth() + 1).padStart(2, "0")
        const dd = String(cur.getDate()).padStart(2, "0")
        return `${yyyy}-${mm}-${dd}`
      }
    }
    cur.setDate(cur.getDate() + 1)
  }
  return cur.toISOString().split("T")[0]
}

function generateProjectedSessions(
  startDate,
  selectedDays,
  count,
  startTime,
  endTime,
) {
  if (!startDate || !selectedDays.length || count <= 0) return []
  const sessions = []
  const cur = new Date(startDate)
  if (isNaN(cur.getTime())) return []

  for (let i = 0; i < 365 && sessions.length < count; i++) {
    if (selectedDays.includes(cur.getDay())) {
      const dateStr = cur.toISOString().split("T")[0]
      sessions.push({
        index: sessions.length + 1,
        dateStr,
        formattedDate: formatViDateWithWeekday(dateStr),
        time: `${startTime} - ${endTime}`,
      })
    }
    cur.setDate(cur.getDate() + 1)
  }
  return sessions
}

// -------------------------------------------------------------
// Component DatePicker tự dựng cố định dd/MM/yyyy không phụ thuộc OS locale
// -------------------------------------------------------------
function DatePicker({ value, onChange, min, error }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const dateObj = useMemo(() => {
    if (!value) return new Date()
    const d = new Date(value)
    return isNaN(d.getTime()) ? new Date() : d
  }, [value])

  const [viewYear, setViewYear] = useState(() => dateObj.getFullYear())
  const [viewMonth, setViewMonth] = useState(() => dateObj.getMonth())

  useEffect(() => {
    if (value) {
      const d = new Date(value)
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear())
        setViewMonth(d.getMonth())
      }
    }
  }, [value])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const displayStr = useMemo(() => formatViDate(value), [value])

  const monthNames = [
    "Tháng 1",
    "Tháng 2",
    "Tháng 3",
    "Tháng 4",
    "Tháng 5",
    "Tháng 6",
    "Tháng 7",
    "Tháng 8",
    "Tháng 9",
    "Tháng 10",
    "Tháng 11",
    "Tháng 12",
  ]

  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate()
  }, [viewYear, viewMonth])

  const firstDayOfWeek = useMemo(() => {
    const day = new Date(viewYear, viewMonth, 1).getDay()
    return day === 0 ? 6 : day - 1 // Mon=0 .. Sun=6
  }, [viewYear, viewMonth])

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const handleSelectDay = (day) => {
    const yyyy = viewYear
    const mm = String(viewMonth + 1).padStart(2, "0")
    const dd = String(day).padStart(2, "0")
    onChange(`${yyyy}-${mm}-${dd}`)
    setIsOpen(false)
  }

  const minDateObj = useMemo(() => {
    if (!min) return null
    const [y, m, d] = min.split("-").map(Number)
    return new Date(y, m - 1, d)
  }, [min])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-11 px-3.5 bg-white border rounded-xl flex items-center justify-between text-sm transition-colors cursor-pointer text-left ${
          error
            ? "border-orange-500 bg-orange-50/20"
            : "border-stone-300 focus:border-stone-800 focus:ring-1 focus:ring-stone-800"
        }`}
      >
        <span className="font-normal text-stone-900">{displayStr}</span>
        <Calendar className="w-4 h-4 text-stone-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 bg-white border border-stone-200 rounded-xl shadow-xl z-40 p-3 w-64 text-xs">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-stone-100">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-stone-100 rounded text-stone-600 cursor-pointer"
            >
              &larr;
            </button>
            <span className="font-semibold text-stone-900">
              {monthNames[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-stone-100 rounded text-stone-600 cursor-pointer"
            >
              &rarr;
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center font-medium text-stone-400 mb-1 text-[11px]">
            <span>T2</span>
            <span>T3</span>
            <span>T4</span>
            <span>T5</span>
            <span>T6</span>
            <span>T7</span>
            <span>CN</span>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const thisDate = new Date(viewYear, viewMonth, day)
              const isDisabled = minDateObj && thisDate < minDateObj

              const yyyy = viewYear
              const mm = String(viewMonth + 1).padStart(2, "0")
              const dd = String(day).padStart(2, "0")
              const isSelected = value === `${yyyy}-${mm}-${dd}`

              return (
                <button
                  key={day}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelectDay(day)}
                  className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-stone-900 text-white font-medium"
                      : isDisabled
                        ? "text-stone-300 cursor-not-allowed"
                        : "hover:bg-stone-100 text-stone-700"
                  }`}
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

// -------------------------------------------------------------
// MAIN MODAL COMPONENT (Match 100% Reference Screenshots)
// -------------------------------------------------------------
export function NewClassModal({ isOpen, onClose, onSubmit, cloneFrom = null }) {
  const {
    addClassSession,
    staff,
    coaches: contextCoaches,
    subjects,
    rooms,
    classes,
    apiEnabled,
    showToast,
  } = useSCMS()

  const coaches = useMemo(() => {
    if (contextCoaches && contextCoaches.length > 0) return contextCoaches
    const fromStaff = (staff || []).filter((s) => {
      const r = String(s.role || s.beRole || "").toLowerCase()
      const st = String(s.status || s.rawStatus || "").toLowerCase()
      return (
        (r.includes("coach") || r.includes("huấn")) && (st === "active" || !st)
      )
    })
    return fromStaff.length > 0 ? fromStaff : DEFAULT_COACHES
  }, [contextCoaches, staff])

  const validCenterRooms = useMemo(() => {
    return (rooms || []).filter((r) => {
      const name = (r.name || "").toLowerCase()
      return (
        !name.includes("yoga") &&
        !name.includes("gym") &&
        !name.includes("cardio") &&
        !name.includes("vo c") &&
        (r.status === "available" || r.status === "active")
      )
    })
  }, [rooms])

  // Form states
  const [selectedSportId, setSelectedSportId] = useState("badminton")
  const [className, setClassName] = useState("Cầu lông Cơ bản K01")
  const [level, setLevel] = useState("Cơ bản")
  const [description, setDescription] = useState("")

  const [coachId, setCoachId] = useState("")
  const [roomId, setRoomId] = useState("")

  const [selectedDays, setSelectedDays] = useState([1, 3, 5]) // T2-T4-T6
  const [startTime, setStartTime] = useState("06:00")
  const [endTime, setEndTime] = useState("07:30")

  // Mặc định ngày bắt đầu: ngày hợp lệ tiếp theo khớp thứ và chưa qua giờ
  const [startDate, setStartDate] = useState(() =>
    getNextValidUpcomingDate([1, 3, 5], "06:00"),
  )

  const [endMode, setEndMode] = useState("sessions")
  const [sessionCount, setSessionCount] = useState(12)
  const [endDate, setEndDate] = useState("")
  const [showSessionList, setShowSessionList] = useState(false)

  const [capacity, setCapacity] = useState(8)
  const [minCapacity, setMinCapacity] = useState(4)
  const [price, setPrice] = useState(650000)
  const [pricingMode, setPricingMode] = useState("total") // 'total' | 'per_session'
  const [isFreeClass, setIsFreeClass] = useState(false)
  const lastNonZeroPriceRef = useRef(650000)
  const [perSessionPriceInput, setPerSessionPriceInput] = useState(
    () => Math.round(650000 / 12 / 1000) * 1000,
  )
  const [status, setStatus] = useState("Open") // 'Open' = Mở đăng ký ngay, 'Draft' = Bản nháp

  const [touched, setTouched] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const currentSport = useMemo(
    () =>
      SPORT_DISCIPLINES.find((s) => s.id === selectedSportId) ||
      SPORT_DISCIPLINES[0],
    [selectedSportId],
  )

  const sportCourts = useMemo(() => currentSport.courts || [], [currentSport])

  const allAvailableRooms = useMemo(() => {
    return [...sportCourts, ...validCenterRooms]
  }, [sportCourts, validCenterRooms])

  // Filter coaches by sport specialization
  const { matchedCoaches, otherCoaches } = useMemo(() => {
    const sportName = currentSport.name
    const matched = coaches.filter((c) => isCoachMatchingSport(c, sportName))
    const other = coaches.filter((c) => !matched.includes(c))
    return { matchedCoaches: matched, otherCoaches: other }
  }, [coaches, currentSport])

  // When sport or level changes: Auto-generate class name with auto-increment K01, K02...
  useEffect(() => {
    if (currentSport) {
      const prefix = `${currentSport.name} ${level}`
      const regex = new RegExp(
        `^${currentSport.name}\\s+${level}\\s+K(\\d+)`,
        "i",
      )
      let maxCohort = 0
      ;(classes || []).forEach((c) => {
        const name = c.nameVi || c.name || ""
        const m = name.match(regex)
        if (m) {
          const num = parseInt(m[1], 10)
          if (num > maxCohort) maxCohort = num
        }
      })
      const nextK = `K${String(maxCohort + 1).padStart(2, "0")}`
      setClassName(`${prefix} ${nextK}`)

      // Auto-set sport default capacity
      setCapacity(currentSport.defaultCapacity || 8)

      // Auto-select first dedicated court of the sport
      if (currentSport.courts && currentSport.courts.length > 0) {
        setRoomId(String(currentSport.courts[0].id))
      } else if (validCenterRooms.length > 0) {
        setRoomId(String(validCenterRooms[0].id))
      }

      // Auto-select first coach with matching specialization
      const matched = coaches.filter((c) =>
        isCoachMatchingSport(c, currentSport.name),
      )
      if (matched.length > 0) {
        setCoachId(String(matched[0].id))
      } else if (coaches.length > 0) {
        setCoachId("")
      }
    }
  }, [currentSport?.id, level, classes, coaches, validCenterRooms])

  // Handle prefilled clone / duplicate class
  useEffect(() => {
    if (!isOpen || !cloneFrom) return
    const sp = SPORT_DISCIPLINES.find(
      (s) =>
        s.label.toLowerCase() === (cloneFrom.category || "").toLowerCase() ||
        s.id.toLowerCase() === (cloneFrom.category || "").toLowerCase() ||
        (cloneFrom.nameVi || "").toLowerCase().includes(s.name.toLowerCase()),
    )
    if (sp) setSelectedSportId(sp.id)

    // Auto increment K cohort number
    const currentName = cloneFrom.nameVi || cloneFrom.name || ""
    const matchK = currentName.match(/K(\d+)/i)
    if (matchK) {
      const nextNum = String(Number(matchK[1]) + 1).padStart(
        matchK[1].length,
        "0",
      )
      setClassName(currentName.replace(/K\d+/i, `K${nextNum}`))
    } else {
      setClassName(`${currentName} (Khóa mới)`)
    }

    if (cloneFrom.level) setLevel(cloneFrom.level)
    if (cloneFrom.coachId) setCoachId(String(cloneFrom.coachId))
    if (cloneFrom.roomId || cloneFrom.room) {
      const matchedR = allAvailableRooms.find(
        (r) =>
          r.name === cloneFrom.room ||
          r.nameVi === cloneFrom.roomVi ||
          String(r.id) === String(cloneFrom.roomId),
      )
      if (matchedR) setRoomId(String(matchedR.id))
    }
    if (
      Array.isArray(cloneFrom.selectedDays) &&
      cloneFrom.selectedDays.length > 0
    ) {
      setSelectedDays(cloneFrom.selectedDays)
    }
    if (cloneFrom.startTime) setStartTime(cloneFrom.startTime)
    if (cloneFrom.endTime) setEndTime(cloneFrom.endTime)
    if (cloneFrom.capacity) setCapacity(cloneFrom.capacity)
    if (cloneFrom.minCapacity) setMinCapacity(cloneFrom.minCapacity)
    if (cloneFrom.price !== undefined) {
      const p = Number(cloneFrom.price)
      if (p === 0 || cloneFrom.isFree) {
        setIsFreeClass(true)
        setPrice(0)
        setPerSessionPriceInput(0)
      } else {
        setIsFreeClass(false)
        setPrice(p)
        lastNonZeroPriceRef.current = p
        const cnt = cloneFrom.sessionCount || sessionCount || 12
        setPerSessionPriceInput(Math.round(p / cnt / 1000) * 1000)
      }
    }

    // Forward start date by ~4 weeks (28 days) or next valid date to avoid collision
    if (cloneFrom.startDate || cloneFrom.date) {
      const baseDate = new Date(cloneFrom.startDate || cloneFrom.date)
      if (!isNaN(baseDate.getTime())) {
        baseDate.setDate(baseDate.getDate() + 28)
        const yyyy = baseDate.getFullYear()
        const mm = String(baseDate.getMonth() + 1).padStart(2, "0")
        const dd = String(baseDate.getDate()).padStart(2, "0")
        setStartDate(`${yyyy}-${mm}-${dd}`)
      }
    }
  }, [isOpen, cloneFrom, allAvailableRooms])

  // Keep coachId synced when coaches load asynchronously
  useEffect(() => {
    if (
      (!coachId || !coaches.some((c) => String(c.id) === String(coachId))) &&
      coaches.length > 0
    ) {
      const matched = coaches.filter((c) =>
        isCoachMatchingSport(c, currentSport.name),
      )
      if (matched.length > 0) {
        setCoachId(String(matched[0].id))
      } else {
        setCoachId("")
      }
    }
  }, [coaches, currentSport, coachId])

  const selectedCoachObj = useMemo(
    () => coaches.find((c) => String(c.id) === String(coachId)),
    [coaches, coachId],
  )

  const selectedRoomObj = useMemo(
    () => allAvailableRooms.find((r) => String(r.id) === String(roomId)),
    [allAvailableRooms, roomId],
  )

  const targetSubjectId = useMemo(() => {
    const matchedSubject = (subjects || []).find((s) => {
      const sName = (s.nameVi || s.name || "").toLowerCase()
      return sName === currentSport.name.toLowerCase()
    })
    return matchedSubject
      ? matchedSubject.id
      : currentSport.backendSubjectId || 1
  }, [subjects, currentSport])

  // Projected session dates
  const projectedSessions = useMemo(() => {
    return generateProjectedSessions(
      startDate,
      selectedDays,
      sessionCount,
      startTime,
      endTime,
    )
  }, [startDate, selectedDays, sessionCount, startTime, endTime])

  const calculatedEndDate = useMemo(() => {
    if (endMode === "date" && endDate) return endDate
    if (projectedSessions.length > 0) {
      return projectedSessions[projectedSessions.length - 1].dateStr
    }
    return startDate
  }, [endMode, endDate, projectedSessions, startDate])

  const durationLabel = useMemo(
    () => getDurationLabel(startTime, endTime),
    [startTime, endTime],
  )

  // Conflict Checking Hook (Queries existing classes in memory + optional backend API)
  const { conflict, isChecking: isCheckingConflict } = useScheduleConflict({
    coachId: selectedCoachObj?.id || coachId,
    coachName: selectedCoachObj?.name,
    roomId: selectedRoomObj?.backendId || selectedRoomObj?.id || roomId,
    roomName: selectedRoomObj?.name || selectedRoomObj?.nameVi,
    date: startDate,
    startTime,
    endTime,
    selectedDays,
    apiEnabled,
    existingClasses: classes,
  })

  const roundedPerSessionPrice = useMemo(() => {
    if (isFreeClass || !sessionCount || sessionCount <= 0 || price <= 0)
      return 0
    return Math.round(price / sessionCount / 1000) * 1000
  }, [price, sessionCount, isFreeClass])
  const perSessionPrice = roundedPerSessionPrice

  // Toggle Weekday
  const toggleWeekday = (dayId) => {
    setIsDirty(true)
    let nextDays
    if (selectedDays.includes(dayId)) {
      if (selectedDays.length === 1) {
        showToast("Lớp học cần có ít nhất một buổi trong tuần.", "error")
        return
      }
      nextDays = selectedDays.filter((d) => d !== dayId)
    } else {
      nextDays = [...selectedDays, dayId].sort()
    }
    setSelectedDays(nextDays)
    setStartDate(getNextValidUpcomingDate(nextDays, startTime))
  }

  // Safe Close with Confirmation if edited
  const handleSafeClose = () => {
    if (isDirty) {
      const confirmDiscard = window.confirm(
        "Bạn có thay đổi chưa lưu. Bạn có chắc chắn muốn rời khỏi không?",
      )
      if (!confirmDiscard) return
    }
    onClose()
  }

  // Check if first session is in the past
  const isFirstSessionInPast = useMemo(() => {
    if (!startDate || !startTime) return false
    const [sh, sm] = startTime.split(":").map(Number)
    const [yyyy, mm, dd] = startDate.split("-").map(Number)
    const firstSession = new Date(yyyy, mm - 1, dd, sh || 0, sm || 0, 0)
    return firstSession < new Date()
  }, [startDate, startTime])

  // Selected weekday day of week for display
  const currentWeekdayLabel = useMemo(() => {
    if (!startDate) return ""
    const d = new Date(startDate)
    return isNaN(d.getTime()) ? "" : VI_WEEKDAYS_FULL[d.getDay()]
  }, [startDate])

  // Field validation checks
  const nameError =
    touched.className && !className.trim() ? "Vui lòng nhập tên lớp học." : ""
  const capacityError =
    touched.capacity &&
    selectedRoomObj?.capacity &&
    capacity > selectedRoomObj.capacity
      ? `Sĩ số vượt quá sức chứa sân (${selectedRoomObj.capacity} người).`
      : touched.capacity && capacity <= 0
        ? "Sĩ số tối đa phải lớn hơn 0."
        : ""
  const minCapacityError =
    touched.minCapacity && minCapacity > capacity
      ? "Sĩ số tối thiểu không được lớn hơn tối đa."
      : ""
  const dateError = isFirstSessionInPast
    ? "Buổi học đầu tiên đã qua giờ hiện tại."
    : ""

  // Handle Price changes with two-way sync
  const handleNumericPriceChange = (num) => {
    setIsDirty(true)
    const safeNum = Math.max(0, num || 0)
    if (pricingMode === "total") {
      setPrice(safeNum)
      if (safeNum > 0) lastNonZeroPriceRef.current = safeNum
      setPerSessionPriceInput(
        Math.round(safeNum / (sessionCount || 1) / 1000) * 1000,
      )
    } else {
      setPerSessionPriceInput(safeNum)
      const total = safeNum * (sessionCount || 1)
      setPrice(total)
      if (total > 0) lastNonZeroPriceRef.current = total
    }
  }

  const handleTogglePricingMode = () => {
    if (isFreeClass) return
    setIsDirty(true)
    if (pricingMode === "total") {
      const perSession =
        Math.round((price || 0) / (sessionCount || 1) / 1000) * 1000
      setPerSessionPriceInput(perSession)
      setPrice(perSession * (sessionCount || 1))
      setPricingMode("per_session")
    } else {
      setPricingMode("total")
    }
  }

  const handleToggleFreeClass = (e) => {
    setIsDirty(true)
    const checked = e.target.checked
    setIsFreeClass(checked)
    if (checked) {
      if (price > 0) lastNonZeroPriceRef.current = price
      setPrice(0)
      setPerSessionPriceInput(0)
    } else {
      const restored =
        lastNonZeroPriceRef.current > 0 ? lastNonZeroPriceRef.current : 650000
      setPrice(restored)
      setPerSessionPriceInput(
        Math.round(restored / (sessionCount || 1) / 1000) * 1000,
      )
    }
  }

  const updateSessionCount = (newCount) => {
    setIsDirty(true)
    const count = Math.max(1, newCount)
    setSessionCount(count)
    if (pricingMode === "per_session" && !isFreeClass) {
      setPrice(perSessionPriceInput * count)
    }
  }

  // Handle Submit (Draft or Open)
  const handleSubmit = async (targetStatus = status) => {
    setTouched({
      className: true,
      capacity: true,
      minCapacity: true,
      startTime: true,
      endTime: true,
      price: true,
    })

    if (!className.trim()) {
      showToast("Vui lòng nhập tên lớp học.", "error")
      return
    }
    if (isFirstSessionInPast) {
      showToast(
        "Buổi học đầu tiên đã qua giờ hiện tại. Vui lòng chọn ngày hoặc giờ trong tương lai.",
        "error",
      )
      return
    }
    if (!selectedDays.length) {
      showToast("Vui lòng chọn ít nhất một thứ trong tuần.", "error")
      return
    }
    if (minCapacity > capacity) {
      showToast("Sĩ số tối thiểu không được lớn hơn sĩ số tối đa.", "error")
      return
    }
    if (selectedRoomObj?.capacity && capacity > selectedRoomObj.capacity) {
      showToast(
        `Sĩ số vượt quá sức chứa của sân (${selectedRoomObj.capacity} người).`,
        "error",
      )
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        name: className.trim(),
        nameVi: className.trim(),
        category: currentSport.name,
        subjectId: targetSubjectId,
        coachId: Number(String(coachId).replace(/\D/g, "")) || null,
        coachName: selectedCoachObj?.name || "Chưa phân công",
        room: selectedRoomObj?.name || "Sân tiêu chuẩn",
        roomVi: selectedRoomObj?.name || "Sân tiêu chuẩn",
        date: startDate,
        startDate,
        endDate: calculatedEndDate,
        startTime,
        endTime,
        durationMinutes:
          (Number(endTime.split(":")[0]) - Number(startTime.split(":")[0])) *
            60 +
          (Number(endTime.split(":")[1]) - Number(startTime.split(":")[1])),
        capacity: Number(capacity),
        minCapacity: Number(minCapacity),
        status: targetStatus === "Draft" ? "draft" : "published",
        apiStatus: targetStatus,
        price: isFreeClass ? 0 : Number(price),
        isFree: isFreeClass,
        sessionCount: Number(sessionCount),
        minTierRequired: 1,
        selectedDays: [...selectedDays],
        level,
      }

      if (typeof onSubmit === "function") {
        await onSubmit(payload, projectedSessions)
        onClose()
        return
      }

      const result = await addClassSession(payload)
      if (result && result.success === false) {
        showToast(result.message || "Không thể tạo lớp học.", "error")
      } else {
        showToast(
          targetStatus === "Draft"
            ? "Đã lưu lớp học dạng bản nháp thành công!"
            : "Đã tạo và mở đăng ký lớp học thành công!",
          "success",
        )
        onClose()
      }
    } catch (err) {
      showToast(err?.message || "Lỗi khi tạo lớp học.", "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/40 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#F8F9FA] text-stone-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-stone-200/90 overflow-hidden flex flex-col my-auto max-h-[94vh]">
        {/* HEADER: Tiêu đề + Nút Quay lại chuẩn như ảnh mẫu */}
        <div className="px-6 py-4 border-b border-stone-200/80 flex items-center gap-3.5 shrink-0 bg-white">
          <button
            type="button"
            onClick={handleSafeClose}
            className="w-10 h-10 border border-stone-200 hover:bg-stone-50 rounded-xl flex items-center justify-center text-stone-700 transition-colors cursor-pointer shrink-0"
            title="Quay lại"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-stone-900 tracking-tight">
              Tạo lớp học mới
            </h1>
            <p className="text-xs text-stone-500 mt-0.5">
              Thiết lập khóa học, phân công huấn luyện viên, sân tập và lịch học
              định kỳ.
            </p>
          </div>
        </div>

        {/* BODY CUỘN: STACKED CARDS CHUẨN DESIGN THEO ẢNH MẪU */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* CARD 1: THÔNG TIN CƠ BẢN */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-4 shadow-2xs">
            <h2 className="text-base font-bold text-stone-900">
              Thông tin cơ bản
            </h2>

            {/* Bộ môn */}
            <div>
              <label className="text-sm font-medium text-stone-800 block mb-1.5">
                Bộ môn
              </label>
              <div className="relative">
                <select
                  value={selectedSportId}
                  onChange={(e) => {
                    setIsDirty(true)
                    setSelectedSportId(e.target.value)
                  }}
                  className="w-full h-11 px-3.5 pr-10 bg-white border border-stone-300 rounded-xl text-sm text-stone-900 font-normal appearance-none focus:outline-none focus:border-stone-800 focus:ring-1 focus:ring-stone-800 cursor-pointer"
                >
                  {SPORT_DISCIPLINES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Tên lớp học */}
            <div>
              <label className="text-sm font-medium text-stone-800 block mb-1.5">
                Tên lớp học
              </label>
              <input
                type="text"
                value={className}
                onBlur={() => setTouched((p) => ({ ...p, className: true }))}
                onChange={(e) => {
                  setIsDirty(true)
                  setClassName(e.target.value)
                }}
                className={`w-full h-11 px-3.5 text-sm font-normal bg-white border rounded-xl focus:outline-none transition-colors ${
                  nameError
                    ? "border-orange-500 bg-orange-50/20"
                    : "border-stone-300 focus:border-stone-800 focus:ring-1 focus:ring-stone-800"
                }`}
              />
              <div className="text-xs text-stone-500 mt-1">
                Tự đặt theo bộ môn và cấp độ, bạn có thể sửa.
              </div>
              {nameError && (
                <p className="text-xs text-orange-600 mt-1 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{nameError}</span>
                </p>
              )}
            </div>

            {/* Cấp độ: 2x2 Segmented Control */}
            <div>
              <label className="text-sm font-medium text-stone-800 block mb-1.5">
                Cấp độ
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-[#F1F3F5] rounded-xl">
                {CLASS_LEVELS.map((lvl) => {
                  const isActive = level === lvl
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        setIsDirty(true)
                        setLevel(lvl)
                      }}
                      className={`h-9 px-3 text-sm rounded-lg transition-all text-center cursor-pointer ${
                        isActive
                          ? "bg-white text-stone-900 font-semibold shadow-xs"
                          : "text-stone-600 hover:text-stone-900 font-normal"
                      }`}
                    >
                      {lvl}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Mô tả khóa học (không bắt buộc) */}
            <div>
              <label className="text-sm font-medium text-stone-800 block mb-1.5">
                Mô tả khóa học{" "}
                <span className="text-stone-500 font-normal">
                  (không bắt buộc)
                </span>
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => {
                  setIsDirty(true)
                  setDescription(e.target.value)
                }}
                placeholder="Mục tiêu khóa học, trang bị cần chuẩn bị"
                className="w-full text-sm font-normal px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl placeholder:text-stone-400 focus:outline-none focus:border-stone-800 focus:ring-1 focus:ring-stone-800 transition-colors resize-none"
              />
            </div>
          </div>

          {/* CARD 2: HUẤN LUYỆN VIÊN VÀ SÂN TẬP */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-4 shadow-2xs">
            <h2 className="text-base font-bold text-stone-900">
              Huấn luyện viên và sân tập
            </h2>

            {/* Huấn luyện viên */}
            <div>
              <label className="text-sm font-medium text-stone-800 block mb-1.5">
                Huấn luyện viên
              </label>
              <div className="relative">
                <select
                  value={coachId}
                  onChange={(e) => {
                    setIsDirty(true)
                    setCoachId(e.target.value)
                  }}
                  className="w-full h-11 px-3.5 pr-10 bg-white border border-stone-300 rounded-xl text-sm text-stone-900 font-normal appearance-none focus:outline-none focus:border-stone-800 focus:ring-1 focus:ring-stone-800 cursor-pointer"
                >
                  <option value="">Chọn huấn luyện viên...</option>
                  {matchedCoaches.length > 0 && (
                    <optgroup
                      label={`HLV đúng chuyên môn ${currentSport.name}`}
                    >
                      {matchedCoaches.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.name} —{" "}
                          {c.specializationVi || c.specialization || "HLV"}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otherCoaches.length > 0 && (
                    <optgroup label="Các HLV khác (Không đúng bộ môn)">
                      {otherCoaches.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.name} —{" "}
                          {c.specializationVi || c.specialization || "HLV"}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {selectedCoachObj ? (
                <div className="flex items-center gap-2 mt-1.5 text-xs flex-wrap">
                  <span className="text-stone-500">Chuyên môn:</span>
                  <span className="font-semibold text-stone-800">
                    {selectedCoachObj.specializationVi ||
                      selectedCoachObj.specialization ||
                      "Chưa cập nhật"}
                  </span>
                  {isCoachMatchingSport(selectedCoachObj, currentSport.name) ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-medium">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Đúng chuyên môn
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 font-medium">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      Khác chuyên môn môn {currentSport.name}
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-xs text-stone-500 mt-1">
                  Chưa chọn HLV cho lớp học này
                </div>
              )}
            </div>

            {/* Sân tập */}
            <div>
              <label className="text-sm font-medium text-stone-800 block mb-1.5">
                Sân tập
              </label>
              <div className="relative">
                <select
                  value={roomId}
                  onChange={(e) => {
                    setIsDirty(true)
                    setRoomId(e.target.value)
                  }}
                  className="w-full h-11 px-3.5 pr-10 bg-white border border-stone-300 rounded-xl text-sm text-stone-900 font-normal appearance-none focus:outline-none focus:border-stone-800 focus:ring-1 focus:ring-stone-800 cursor-pointer"
                >
                  <option value="">Chọn sân tập...</option>
                  {sportCourts.length > 0 && (
                    <optgroup label={`Sân chuyên dụng ${currentSport.name}`}>
                      {sportCourts.map((court) => (
                        <option key={court.id} value={court.id}>
                          {court.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {validCenterRooms.length > 0 && (
                    <optgroup label="Sân đa năng / Liên hợp">
                      {validCenterRooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="text-xs text-stone-500 mt-1">
                Sức chứa {selectedRoomObj?.capacity || 8} học viên,{" "}
                {selectedRoomObj?.spec || "Thảm PVC thi đấu"}
              </div>
            </div>
          </div>

          {/* CARD 3: LỊCH HỌC */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-4 shadow-2xs">
            <h2 className="text-base font-bold text-stone-900">Lịch học</h2>

            {/* Ngày bắt đầu */}
            <div>
              <label className="text-sm font-medium text-stone-800 block mb-1.5">
                Ngày bắt đầu
              </label>
              <DatePicker
                value={startDate}
                onChange={(v) => {
                  setIsDirty(true)
                  setStartDate(v)
                }}
                min={new Date().toISOString().split("T")[0]}
                error={dateError}
              />
              <div className="text-xs text-stone-500 mt-1">
                {currentWeekdayLabel}
              </div>
              {dateError && (
                <p className="text-xs text-orange-600 mt-1 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{dateError}</span>
                </p>
              )}
            </div>

            {/* Giờ bắt đầu (full width dropdown select chuẩn 24h) */}
            <div>
              <label className="text-sm font-medium text-stone-800 block mb-1.5">
                Giờ bắt đầu
              </label>
              <div className="relative">
                <select
                  value={startTime}
                  onChange={(e) => {
                    setIsDirty(true)
                    setStartTime(e.target.value)
                  }}
                  className="w-full h-11 px-3.5 pr-10 bg-white border border-stone-300 rounded-xl text-sm text-stone-900 font-normal appearance-none focus:outline-none focus:border-stone-800 focus:ring-1 focus:ring-stone-800 cursor-pointer"
                >
                  {TIME_OPTIONS_15MIN.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Giờ kết thúc (full width dropdown select chuẩn 24h) */}
            <div>
              <label className="text-sm font-medium text-stone-800 block mb-1.5">
                Giờ kết thúc
              </label>
              <div className="relative">
                <select
                  value={endTime}
                  onChange={(e) => {
                    setIsDirty(true)
                    setEndTime(e.target.value)
                  }}
                  className="w-full h-11 px-3.5 pr-10 bg-white border border-stone-300 rounded-xl text-sm text-stone-900 font-normal appearance-none focus:outline-none focus:border-stone-800 focus:ring-1 focus:ring-stone-800 cursor-pointer"
                >
                  {TIME_OPTIONS_15MIN.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <div className="text-xs text-stone-500 mt-1">
                Thời lượng {durationLabel}
              </div>
            </div>

            {/* Lặp lại vào: Chips T2..CN (Nền đen than khi active chuẩn ảnh mẫu) */}
            <div>
              <label className="text-sm font-medium text-stone-800 block mb-2">
                Lặp lại vào
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {WEEKDAYS.map((day) => {
                  const isSelected = selectedDays.includes(day.dayOfWeek)
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleWeekday(day.dayOfWeek)}
                      className={`w-12 h-10 text-sm rounded-xl transition-colors cursor-pointer text-center font-medium ${
                        isSelected
                          ? "bg-[#18181B] text-white border border-stone-900"
                          : "bg-white text-stone-800 border border-stone-200 hover:bg-stone-50"
                      }`}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Kết thúc: Theo số buổi vs Theo ngày */}
            <div>
              <label className="text-sm font-medium text-stone-800 block mb-2">
                Kết thúc
              </label>
              <div className="flex p-1 bg-[#F1F3F5] rounded-xl w-60">
                <button
                  type="button"
                  onClick={() => setEndMode("sessions")}
                  className={`flex-1 h-8 text-xs rounded-lg transition-all ${
                    endMode === "sessions"
                      ? "bg-white text-stone-900 font-semibold shadow-xs"
                      : "text-stone-600"
                  }`}
                >
                  Theo số buổi
                </button>
                <button
                  type="button"
                  onClick={() => setEndMode("date")}
                  className={`flex-1 h-8 text-xs rounded-lg transition-all ${
                    endMode === "date"
                      ? "bg-white text-stone-900 font-semibold shadow-xs"
                      : "text-stone-600"
                  }`}
                >
                  Theo ngày
                </button>
              </div>
            </div>

            {/* Tổng số buổi (Stepper + 4 Chips) */}
            {endMode === "sessions" ? (
              <div>
                <label className="text-sm font-medium text-stone-800 block mb-2">
                  Tổng số buổi
                </label>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Stepper & Editable Input */}
                  <div className="h-10 flex items-center border border-stone-300 rounded-xl overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() =>
                        updateSessionCount(Math.max(1, sessionCount - 1))
                      }
                      className="w-9 h-10 flex items-center justify-center hover:bg-stone-100 text-stone-700 transition-colors cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={sessionCount}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => {
                        if (e.target.selectionStart === e.target.selectionEnd)
                          e.target.select()
                      }}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === "") updateSessionCount("")
                        else
                          updateSessionCount(
                            Math.max(1, parseInt(val, 10) || 1),
                          )
                      }}
                      className="w-14 text-center text-sm font-semibold text-stone-900 tabular-nums border-0 focus:outline-none focus:ring-0 p-0"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateSessionCount((Number(sessionCount) || 0) + 1)
                      }
                      className="w-9 h-10 flex items-center justify-center hover:bg-stone-100 text-stone-700 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Chips */}
                  {[8, 12, 16, 24].map((cnt) => {
                    const isSelected = sessionCount === cnt
                    return (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => updateSessionCount(cnt)}
                        className={`h-10 px-4 text-xs rounded-full border transition-all cursor-pointer ${
                          isSelected
                            ? "border-stone-900 text-stone-900 font-semibold bg-white ring-1 ring-stone-900"
                            : "border-stone-200 text-stone-600 hover:border-stone-300 bg-white font-normal"
                        }`}
                      >
                        {cnt} buổi
                      </button>
                    )
                  })}
                </div>

                {/* Collapsible row kết thúc khóa học */}
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setShowSessionList(!showSessionList)}
                    className="w-full text-left p-3.5 bg-white hover:bg-stone-50/80 border border-stone-200 rounded-xl text-sm font-medium text-stone-900 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-stone-600">▶</span>
                      <span>
                        {sessionCount} buổi học, kết thúc{" "}
                        {formatViDateWithWeekday(calculatedEndDate)}
                      </span>
                    </div>
                  </button>

                  {showSessionList && (
                    <div className="mt-2 p-3.5 bg-stone-50 border border-stone-200 rounded-xl max-h-48 overflow-y-auto space-y-1.5 text-xs">
                      {projectedSessions.map((s) => (
                        <div
                          key={s.index}
                          className="flex items-center justify-between text-stone-700 py-1.5 border-b border-stone-200/60 last:border-0"
                        >
                          <span>
                            Buổi {s.index}:{" "}
                            <strong className="font-semibold text-stone-900">
                              {s.formattedDate}
                            </strong>
                          </span>
                          <span className="text-stone-500 tabular-nums">
                            {s.time}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium text-stone-800 block mb-1.5">
                  Ngày kết thúc
                </label>
                <DatePicker
                  value={endDate}
                  onChange={(v) => {
                    setIsDirty(true)
                    setEndDate(v)
                  }}
                  min={startDate}
                />
              </div>
            )}
          </div>

          {/* CARD 4: ĐĂNG KÝ VÀ HỌC PHÍ */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-4 shadow-2xs">
            <h2 className="text-base font-bold text-stone-900">
              Đăng ký và học phí
            </h2>

            {/* Sĩ số tối đa */}
            <div>
              <label className="text-sm font-medium text-stone-800 block mb-1.5">
                Sĩ số tối đa
              </label>
              <input
                type="number"
                min="1"
                max={selectedRoomObj?.capacity || 30}
                value={capacity}
                onFocus={(e) => e.target.select()}
                onClick={(e) => {
                  if (e.target.selectionStart === e.target.selectionEnd)
                    e.target.select()
                }}
                onBlur={() => {
                  setTouched((p) => ({ ...p, capacity: true }))
                  if (!capacity || capacity < 1) {
                    setCapacity(selectedRoomObj?.capacity || 8)
                  }
                }}
                onChange={(e) => {
                  setIsDirty(true)
                  const val = e.target.value
                  if (val === "") setCapacity("")
                  else setCapacity(Number(val))
                }}
                className={`w-full h-11 px-3.5 text-sm font-normal bg-white border rounded-xl focus:outline-none transition-colors tabular-nums ${
                  capacityError
                    ? "border-orange-500 bg-orange-50/20"
                    : "border-stone-300 focus:border-stone-800 focus:ring-1 focus:ring-stone-800"
                }`}
              />
              <div className="text-xs text-stone-500 mt-1">
                Sân chứa tối đa {selectedRoomObj?.capacity || 8}
              </div>
              {capacityError && (
                <p className="text-xs text-orange-600 mt-1 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{capacityError}</span>
                </p>
              )}
            </div>

            {/* Sĩ số tối thiểu */}
            <div>
              <label className="text-sm font-medium text-stone-800 block mb-1.5">
                Sĩ số tối thiểu
              </label>
              <input
                type="number"
                min="1"
                max={capacity || 30}
                value={minCapacity}
                onFocus={(e) => e.target.select()}
                onClick={(e) => {
                  if (e.target.selectionStart === e.target.selectionEnd)
                    e.target.select()
                }}
                onBlur={() => {
                  setTouched((p) => ({ ...p, minCapacity: true }))
                  if (!minCapacity || minCapacity < 1) {
                    setMinCapacity(1)
                  }
                }}
                onChange={(e) => {
                  setIsDirty(true)
                  const val = e.target.value
                  if (val === "") setMinCapacity("")
                  else setMinCapacity(Number(val))
                }}
                className={`w-full h-11 px-3.5 text-sm font-normal bg-white border rounded-xl focus:outline-none transition-colors tabular-nums ${
                  minCapacityError
                    ? "border-orange-500 bg-orange-50/20"
                    : "border-stone-300 focus:border-stone-800 focus:ring-1 focus:ring-stone-800"
                }`}
              />
              <div className="text-xs text-stone-500 mt-1">
                Đạt mức này lớp sẽ tự xác nhận mở
              </div>
              {minCapacityError && (
                <p className="text-xs text-orange-600 mt-1 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{minCapacityError}</span>
                </p>
              )}
            </div>

            {/* Cụm nhập học phí với InputGroup & Add-on tách biệt */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-stone-800">
                  {pricingMode === "total"
                    ? "Học phí trọn khóa"
                    : "Học phí mỗi buổi"}
                </label>
                <button
                  type="button"
                  onClick={handleTogglePricingMode}
                  disabled={isFreeClass}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                    isFreeClass
                      ? "border-stone-200 text-stone-300 cursor-not-allowed bg-stone-50"
                      : "border-stone-200 text-stone-700 bg-stone-50 hover:bg-stone-100 hover:border-stone-300 cursor-pointer active:scale-98"
                  }`}
                  title="Đổi phương thức nhập giữa tính theo trọn khóa hoặc tính theo từng buổi"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-stone-500" />
                  <span>
                    {pricingMode === "total"
                      ? "Đổi sang: Nhập theo buổi"
                      : "Đổi sang: Nhập trọn khóa"}
                  </span>
                </button>
              </div>

              {/* Ô nhập tiền tệ chuẩn cao cấp với Auto-select, Gợi ý nhanh & Xóa 1 chạm */}
              <CurrencyInput
                id="class-price"
                disabled={isFreeClass}
                value={pricingMode === "total" ? price : perSessionPriceInput}
                onChange={handleNumericPriceChange}
                placeholder="0"
                suffix={pricingMode === "total" ? "đ" : "đ / buổi"}
                presets={
                  pricingMode === "total"
                    ? [200000, 500000, 800000, 1000000, 1200000, 1500000]
                    : [20000, 50000, 75000, 100000, 150000]
                }
              />

              {/* Helper Text với tính toán trực quan 2 chiều */}
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
                      ~ {formatNumber(price)} đ
                    </strong>{" "}
                    ({sessionCount} buổi × {formatNumber(perSessionPriceInput)}{" "}
                    đ)
                  </span>
                )}
                {!isFreeClass && price > 0 && (
                  <span className="text-stone-400 text-[11px]">
                    {pricingMode === "total"
                      ? "Làm tròn theo buổi"
                      : "Tự động tính trọn khóa"}
                  </span>
                )}
              </div>

              {/* Checkbox Lớp học miễn phí */}
              <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none group">
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
            </div>

            {/* Toggle Switch: Mở đăng ký ngay */}
            <div className="flex items-center gap-3 pt-3 border-t border-stone-100">
              <button
                type="button"
                role="switch"
                aria-checked={status === "Open"}
                onClick={() => {
                  setIsDirty(true)
                  setStatus(status === "Open" ? "Draft" : "Open")
                }}
                className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors shrink-0 ${
                  status === "Open" ? "bg-[#18181B]" : "bg-stone-300"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    status === "Open" ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <div>
                <div className="text-sm font-semibold text-stone-900">
                  Mở đăng ký ngay
                </div>
                <div className="text-xs text-stone-500">
                  Học viên thấy và đăng ký được sau khi tạo lớp.
                </div>
              </div>
            </div>
          </div>

          {/* CARD 5: TÓM TẮT */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-4 shadow-2xs">
            <h2 className="text-base font-bold text-stone-900">Tóm tắt</h2>

            {/* Tiêu đề lớp & phân loại */}
            <div>
              <h3 className="text-lg font-bold text-stone-900 leading-snug">
                {className || "Chưa đặt tên lớp"}
              </h3>
              <div className="text-xs text-stone-500 mt-0.5 capitalize">
                {currentSport.name}, {level.toLowerCase()}
              </div>
            </div>

            <hr className="border-stone-100" />

            {/* 2-Column List thông số */}
            <div className="space-y-2.5 text-sm">
              <div className="flex items-start justify-between">
                <span className="text-stone-500">Huấn luyện viên</span>
                <span className="font-medium text-stone-900 text-right">
                  {selectedCoachObj?.name || "Trần Thị Hương"}
                </span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-stone-500">Sân tập</span>
                <span className="font-medium text-stone-900 text-right">
                  {selectedRoomObj?.name || "Sân Cầu Lông 1"}
                </span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-stone-500">Lịch</span>
                <span className="font-medium text-stone-900 text-right">
                  {selectedDays
                    .map((d) => WEEKDAYS.find((w) => w.dayOfWeek === d)?.label)
                    .join(", ") || "Chưa chọn"}
                </span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-stone-500">Giờ học</span>
                <span className="font-medium text-stone-900 text-right tabular-nums">
                  {startTime} đến {endTime}
                </span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-stone-500">Thời gian</span>
                <span className="font-medium text-stone-900 text-right">
                  {formatViDate(startDate)} đến{" "}
                  {formatViDate(calculatedEndDate)}
                </span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-stone-500">Số buổi</span>
                <span className="font-medium text-stone-900">
                  {sessionCount}
                </span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-stone-500">Sĩ số</span>
                <span className="font-medium text-stone-900">
                  {minCapacity} đến {capacity} học viên
                </span>
              </div>
            </div>

            <hr className="border-stone-100" />

            {/* Học phí */}
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-sm text-stone-600 font-medium">
                Học phí
              </span>
              <div className="text-xl font-bold text-stone-900 tabular-nums">
                {formatNumber(price)} đ
              </div>
            </div>

            {/* Banner kiểm tra xung đột */}
            {isCheckingConflict ? (
              <div className="p-3 bg-stone-50 rounded-xl text-xs text-stone-600 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-700" />
                <span>Đang kiểm tra lịch huấn luyện viên và sân tập...</span>
              </div>
            ) : isFirstSessionInPast ? (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-orange-800">
                  <AlertCircle className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                  <span>Buổi học đầu tiên đã qua giờ hiện tại</span>
                </div>
                <p className="text-xs text-orange-700 leading-relaxed">
                  Khung giờ {startTime} ngày {formatViDate(startDate)} đã trôi
                  qua. Vui lòng chọn ngày hoặc giờ học trong tương lai.
                </p>
              </div>
            ) : conflict?.hasConflict ? (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1.5 shadow-2xs">
                <div className="flex items-center gap-1.5 font-bold text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Xung đột lịch dạy hoặc sân tập</span>
                </div>
                <p className="text-xs text-rose-700 leading-relaxed font-medium">
                  {conflict.message}
                </p>
                <p className="text-[11px] text-rose-600 italic">
                  Vui lòng thay đổi khung giờ, ngày học hoặc phân công HLV/sân
                  tập khác để tiếp tục.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-[#EBFBEE] border border-emerald-200/80 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">
                  Lịch dạy và sân tập khả dụng
                </span>
              </div>
            )}
          </div>
        </div>

        {/* THANH HÀNH ĐỘNG DÍNH Ở ĐÁY FORM (Sticky Bottom Bar) */}
        <div className="px-6 py-4 bg-white border-t border-stone-200 flex items-center justify-end gap-3 shrink-0 z-30">
          <button
            type="button"
            onClick={handleSafeClose}
            className="h-10 px-5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 text-sm font-medium transition-colors cursor-pointer"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={() => handleSubmit("Draft")}
            disabled={isSubmitting || conflict?.hasConflict}
            className="h-10 px-5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-700 text-sm font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title={conflict?.hasConflict ? conflict.message : "Lưu bản nháp"}
          >
            {isSubmitting ? "Đang lưu..." : "Lưu nháp"}
          </button>

          <button
            type="button"
            onClick={() => handleSubmit(status)}
            disabled={
              isSubmitting || conflict?.hasConflict || isFirstSessionInPast
            }
            className="h-10 px-6 rounded-lg bg-[#BA1A1A] hover:bg-[#A31616] text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer flex items-center gap-2"
            title={
              conflict?.hasConflict
                ? conflict.message
                : isFirstSessionInPast
                  ? "Giờ học đã trôi qua"
                  : "Tạo & mở đăng ký"
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <span>Tạo & mở đăng ký</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
