import React, { useState, useEffect, useMemo, useRef } from "react"
import { useSCMS } from "../../context/SCMSContext"
import {
  SPORT_DISCIPLINES,
  isCoachMatchingSport,
} from "../classes/sportDisciplines"
import { resolveCatalogSubjects } from "../../utils/memberCourseCatalogRules"
import { validateClassName, MAX_CLASS_NAME_LENGTH } from "../../api/classValidation"
import { useScheduleConflict } from "../classes/hooks/useScheduleConflict"
import { CurrencyInput } from "../common/CurrencyInput"
import {
  adjustNormalMinCapacityForMaxChange,
  formatLocalDate,
  generateNormalClassPreview,
  getLocalWeekday,
  getNextValidUpcomingDate,
  getDefaultNormalMinCapacity,
  loadPendingNormalClassCreation,
  parseLocalDate,
  validateNormalClassCapacity,
} from "../../api/normalClassCreation.js"
import {
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  Minus,
  ArrowLeftRight,
} from "lucide-react"
import {
  WEEKDAYS,
  VI_WEEKDAYS_FULL,
  ROOM_ACTIVITY_TYPES,
  CATALOG_KEY_TO_SPORT_ID,
  NORMAL_CLASS_TIME_SLOTS,
} from "./new-class/classFormConstants"
import { DEFAULT_COACHES } from "../../mocks/defaultCoaches"
import {
  getSportCapacity,
  formatViDate,
  formatViDateWithWeekday,
  formatNumber,
} from "./new-class/classFormHelpers"
import { DatePicker } from "./new-class/DatePicker"

function formatConflictDetail(detail) {
  let formatted = detail.trim()
  const timeMatch = formatted.match(/từ\s+(\d{1,2}:\d{2}(?::\d{2})?)\s+đến\s+(\d{1,2}:\d{2}(?::\d{2})?)/i)

  if (timeMatch) {
    const start = timeMatch[1].slice(0, 5)
    const end = timeMatch[2].slice(0, 5)
    const slot = NORMAL_CLASS_TIME_SLOTS.find(
      (entry) => entry.startTime === start && entry.endTime === end,
    )
    const slotLabel = slot ? `ca ${slot.slotNumber}` : `ca chưa xác định (${start}–${end})`
    formatted = formatted.replace(timeMatch[0], slotLabel)
  }

  formatted = formatted.replace(/ngày\s+(\d{4}-\d{2}-\d{2})/i, (_, date) => `ngày ${formatViDate(date)}`)
  return /[.!?]$/.test(formatted) ? formatted : `${formatted}.`
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
      if (apiEnabled) return String(r.status || "").trim().toLowerCase() === "available"
      const name = (r.name || "").toLowerCase()
      return (
        !name.includes("yoga") &&
        !name.includes("gym") &&
        !name.includes("cardio") &&
        !name.includes("vo c") &&
        (r.status === "available" || r.status === "active")
      )
    })
  }, [apiEnabled, rooms])

  // Form states
  const [selectedSportId, setSelectedSportId] = useState("badminton")
  const [className, setClassName] = useState("")
  const [description, setDescription] = useState("")

  const [coachId, setCoachId] = useState("")
  const [roomId, setRoomId] = useState("")

  const [selectedDays, setSelectedDays] = useState([1, 3, 5]) // T2-T4-T6
  const [startTime, setStartTime] = useState(NORMAL_CLASS_TIME_SLOTS[0].startTime)
  const [endTime, setEndTime] = useState(NORMAL_CLASS_TIME_SLOTS[0].endTime)

  // Mặc định ngày bắt đầu: ngày hợp lệ tiếp theo khớp thứ và chưa qua giờ
  const [startDate, setStartDate] = useState(() =>
    getNextValidUpcomingDate([1, 3, 5], "06:00"),
  )

  const [endMode, setEndMode] = useState("sessions")
  const [sessionCount, setSessionCount] = useState(12)
  const [endDate, setEndDate] = useState("")
  const [showSessionList, setShowSessionList] = useState(false)

  const [capacity, setCapacity] = useState(8)
  const [capacityCustomized, setCapacityCustomized] = useState(false)
  const [minCapacity, setMinCapacity] = useState(() => getDefaultNormalMinCapacity(8))
  const [minCapacityCustomized, setMinCapacityCustomized] = useState(false)
  const [price, setPrice] = useState(650000)
  const [pricingMode, setPricingMode] = useState("total") // 'total' | 'per_session'
  const [isFreeClass, setIsFreeClass] = useState(false)
  const lastNonZeroPriceRef = useRef(650000)
  const [perSessionPriceInput, setPerSessionPriceInput] = useState(
    () => Math.round(650000 / 12 / 1000) * 1000,
  )

  const [touched, setTouched] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const normalRequestIdStateRef = useRef(null)
  const [normalCreationRecovery, setNormalCreationRecovery] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    setClassName("")
    setTouched({})
    setIsDirty(false)
    const pendingCreation = normalRequestIdStateRef.current || loadPendingNormalClassCreation()
    if (!normalRequestIdStateRef.current && pendingCreation) {
      normalRequestIdStateRef.current = pendingCreation
    }
    setNormalCreationRecovery(
      pendingCreation?.status === "created_unverified"
        ? { status: pendingCreation.status, classId: pendingCreation.createdClassId, requestId: pendingCreation.requestId }
        : pendingCreation?.status === "outcome_unknown"
          ? { status: pendingCreation.status, requestId: pendingCreation.requestId }
          : ["post_unconfirmed", "post_pending"].includes(pendingCreation?.status)
            ? { status: "post_unconfirmed", requestId: pendingCreation.requestId }
          : null,
    )
  }, [isOpen])

  // Chế độ API: danh sách môn lấy từ /api/subjects (khớp bằng mã/tên chuẩn hóa),
  // chỉ hiện môn có trong hệ thống. Chế độ mock: dùng danh sách cố định.
  const sportOptions = useMemo(() => {
    if (!apiEnabled) return SPORT_DISCIPLINES
    return resolveCatalogSubjects(subjects || [])
      .filter((entry) => entry.subject)
      .map((entry) => {
        const sportId = CATALOG_KEY_TO_SPORT_ID[entry.key] || entry.key
        const discipline = SPORT_DISCIPLINES.find((s) => s.id === sportId)
        return discipline ? { ...discipline, subjectId: entry.subject.id } : null
      })
      .filter(Boolean)
  }, [apiEnabled, subjects])

  const currentSport = useMemo(
    () =>
      sportOptions.find((s) => s.id === selectedSportId) ||
      sportOptions[0] ||
      SPORT_DISCIPLINES[0],
    [sportOptions, selectedSportId],
  )

  // Môn đang chọn không còn trong danh mục (hoặc danh mục vừa tải xong): chọn môn đầu tiên.
  useEffect(() => {
    if (sportOptions.length > 0 && !sportOptions.some((s) => s.id === selectedSportId)) {
      setSelectedSportId(sportOptions[0].id)
    }
  }, [sportOptions, selectedSportId])

  const sportCourts = useMemo(() => currentSport.courts || [], [currentSport])

  const matchingCenterRooms = useMemo(() => {
    const expectedActivityType = ROOM_ACTIVITY_TYPES[currentSport.id]
    if (apiEnabled) {
      if (!expectedActivityType) return []
      return validCenterRooms.filter(
        (room) => String(room.activityType || "").trim().toUpperCase() === expectedActivityType,
      )
    }

    return validCenterRooms.filter((room) =>
      isCoachMatchingSport(
        { specialization: [room.name, room.roomCode].filter(Boolean).join(" ") },
        currentSport.name,
      ),
    )
  }, [apiEnabled, currentSport, validCenterRooms])

  const allAvailableRooms = useMemo(() => {
    const sportSpecificRooms = apiEnabled
      ? matchingCenterRooms
      : [...sportCourts, ...matchingCenterRooms]
    return [...new Map(sportSpecificRooms.map((room) => [String(room.id), room])).values()]
  }, [apiEnabled, matchingCenterRooms, sportCourts])

  // Only offer coaches whose specialization matches the selected sport.
  const matchedCoaches = useMemo(
    () => coaches.filter((coach) => isCoachMatchingSport(coach, currentSport.name)),
    [coaches, currentSport],
  )

  // Keep sport-based defaults for capacity and coach.
  const prevSportRef = useRef(currentSport?.id)
  useEffect(() => {
    if (currentSport) {
      const sportChanged = prevSportRef.current !== currentSport.id
      prevSportRef.current = currentSport.id

      // Auto-set sport default capacity
      if (sportChanged) {
        const nextCapacity = getSportCapacity(
          currentSport,
          allAvailableRooms[0],
          apiEnabled,
        )
        setCapacity(nextCapacity)
        setCapacityCustomized(false)
        setMinCapacity(getDefaultNormalMinCapacity(nextCapacity))
        setMinCapacityCustomized(false)
      }

      // Auto-select first coach with matching specialization when sport changes or initially empty
      const matched = coaches.filter((c) =>
        isCoachMatchingSport(c, currentSport.name),
      )
      if (sportChanged) {
        if (matched.length > 0) {
          setCoachId(String(matched[0].id))
        } else if (coaches.length > 0) {
          setCoachId("")
        }
      } else {
        setCoachId((prev) => {
          if (prev) return prev
          return matched.length > 0 ? String(matched[0].id) : ""
        })
      }
    }
  }, [currentSport?.id, coaches, allAvailableRooms, apiEnabled])

  // Keep sport-based default room.
  const prevSportForRoomRef = useRef(currentSport?.id)
  useEffect(() => {
    if (currentSport) {
      const sportChanged = prevSportForRoomRef.current !== currentSport.id
      prevSportForRoomRef.current = currentSport.id

      // Auto-select first dedicated court of the sport
      if (!apiEnabled && currentSport.courts && currentSport.courts.length > 0) {
        setRoomId((prevRoomId) => {
          if (sportChanged || !prevRoomId) {
            return String(currentSport.courts[0].id)
          }
          return prevRoomId
        })
      } else {
        setRoomId((prevRoomId) => {
          const currentRoomIsCompatible = allAvailableRooms.some(
            (room) => String(room.id) === String(prevRoomId),
          )
          if (sportChanged || !currentRoomIsCompatible) {
            return allAvailableRooms.length > 0 ? String(allAvailableRooms[0].id) : ""
          }
          return prevRoomId
        })
      }
    }
  }, [apiEnabled, currentSport?.id, allAvailableRooms])

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
    const clonedTimeSlot = NORMAL_CLASS_TIME_SLOTS.find(
      (slot) => slot.startTime === String(cloneFrom.startTime || "").slice(0, 5)
        && slot.endTime === String(cloneFrom.endTime || "").slice(0, 5),
    ) || NORMAL_CLASS_TIME_SLOTS.find(
      (slot) => slot.startTime === String(cloneFrom.startTime || "").slice(0, 5),
    ) || NORMAL_CLASS_TIME_SLOTS[0]
    setStartTime(clonedTimeSlot.startTime)
    setEndTime(clonedTimeSlot.endTime)
    if (cloneFrom.capacity) {
      const clonedCapacity = Number(cloneFrom.capacity)
      const clonedDefaultMin = getDefaultNormalMinCapacity(clonedCapacity)
      const clonedMin = cloneFrom.minCapacity == null
        ? clonedDefaultMin
        : Number(cloneFrom.minCapacity)
      const hasCustomMinimum = Number.isInteger(clonedMin)
        && clonedDefaultMin !== null
        && clonedMin > clonedDefaultMin
      setCapacity(clonedCapacity)
      setCapacityCustomized(true)
      setMinCapacityCustomized(hasCustomMinimum)
      setMinCapacity(adjustNormalMinCapacityForMaxChange(
        clonedMin,
        clonedCapacity,
        hasCustomMinimum,
      ))
    }
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
      const baseDate = parseLocalDate(cloneFrom.startDate || cloneFrom.date)
      if (baseDate) {
        baseDate.setDate(baseDate.getDate() + 28)
        const candidateDate = formatLocalDate(baseDate)
        const clonedDays = Array.isArray(cloneFrom.selectedDays) && cloneFrom.selectedDays.length
          ? cloneFrom.selectedDays
          : [1, 3, 5]
        const clonedTime = clonedTimeSlot.startTime
        const [hour, minute] = clonedTime.split(":").map(Number)
        const candidateStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hour || 0, minute || 0)
        setStartDate(candidateStart > new Date() && clonedDays.includes(baseDate.getDay())
          ? candidateDate
          : getNextValidUpcomingDate(clonedDays, clonedTime))
      }
    }
  }, [isOpen, cloneFrom, allAvailableRooms])

  // Keep coachId synced with the selected sport when coaches load asynchronously.
  useEffect(() => {
    const selectedCoachMatchesSport = matchedCoaches.some(
      (coach) => String(coach.id) === String(coachId),
    )
    if (selectedCoachMatchesSport) return

    setCoachId(matchedCoaches.length > 0 ? String(matchedCoaches[0].id) : "")
  }, [matchedCoaches, coachId])

  const selectedCoachObj = useMemo(
    () => matchedCoaches.find((coach) => String(coach.id) === String(coachId)),
    [matchedCoaches, coachId],
  )

  const selectedRoomObj = useMemo(
    () => allAvailableRooms.find((r) => String(r.id) === String(roomId)),
    [allAvailableRooms, roomId],
  )

  useEffect(() => {
    if (capacityCustomized || !selectedRoomObj) return
    const nextCapacity = getSportCapacity(currentSport, selectedRoomObj, apiEnabled)
    setCapacity((currentCapacity) =>
      Number(currentCapacity) === nextCapacity ? currentCapacity : nextCapacity,
    )
    setMinCapacity((currentMinCapacity) =>
      adjustNormalMinCapacityForMaxChange(
        currentMinCapacity,
        nextCapacity,
        minCapacityCustomized,
      ),
    )
  }, [
    currentSport,
    selectedRoomObj?.id,
    selectedRoomObj?.capacity,
    apiEnabled,
    capacityCustomized,
    minCapacityCustomized,
  ])

  const targetSubjectId = useMemo(() => {
    if (apiEnabled) return currentSport.subjectId ?? null
    return currentSport.backendSubjectId || 1
  }, [currentSport, apiEnabled])
  const selectedSubject = useMemo(
    () => (subjects || []).find((subject) => String(subject.id) === String(targetSubjectId)),
    [subjects, targetSubjectId],
  )
  const isOutdoorClass = selectedSubject?.outdoor === true || selectedRoomObj?.outdoor === true
  const normalPrice = Number(selectedSubject?.normalPrice ?? selectedSubject?.normal_price)

  useEffect(() => {
    const currentSlot = NORMAL_CLASS_TIME_SLOTS.find(
      (slot) => slot.startTime === startTime && slot.endTime === endTime,
    )
    if (!isOutdoorClass || !currentSlot || currentSlot.outdoorAllowed) return

    const nextSlot = NORMAL_CLASS_TIME_SLOTS.find((slot) => slot.outdoorAllowed)
    if (!nextSlot) return
    setStartTime(nextSlot.startTime)
    setEndTime(nextSlot.endTime)
  }, [isOutdoorClass, startTime, endTime])

  useEffect(() => {
    if (apiEnabled && Number.isFinite(normalPrice) && normalPrice >= 0) {
      setPrice(normalPrice)
      setIsFreeClass(false)
    }
  }, [apiEnabled, targetSubjectId, normalPrice])
  useEffect(() => {
    if (apiEnabled) {
      setSessionCount(12)
      setEndMode("sessions")
    }
  }, [apiEnabled])

  // Projected session dates
  const projectedSessions = useMemo(() => {
    return generateNormalClassPreview(
      startDate,
      selectedDays,
      sessionCount,
    ).map((session) => ({
      ...session,
      formattedDate: formatViDateWithWeekday(session.dateStr),
      time: `${startTime} - ${endTime}`,
    }))
  }, [startDate, selectedDays, sessionCount, startTime, endTime])

  const calculatedEndDate = useMemo(() => {
    if (endMode === "date" && endDate) return endDate
    if (projectedSessions.length > 0) {
      return projectedSessions[projectedSessions.length - 1].dateStr
    }
    return startDate
  }, [endMode, endDate, projectedSessions, startDate])

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
    const date = parseLocalDate(startDate)
    if (!date) return true
    const firstSession = new Date(date.getFullYear(), date.getMonth(), date.getDate(), sh || 0, sm || 0, 0)
    return firstSession < new Date()
  }, [startDate, startTime])

  const startDateMatchesSchedule = selectedDays.includes(getLocalWeekday(startDate))
  const minimumStartDate = getNextValidUpcomingDate(selectedDays, startTime)

  // Selected weekday day of week for display
  const currentWeekdayLabel = useMemo(() => {
    if (!startDate) return ""
    const weekday = getLocalWeekday(startDate)
    return weekday === null ? "" : VI_WEEKDAYS_FULL[weekday]
  }, [startDate])

  // Field validation checks
  const nameError = touched.className ? validateClassName(className) : ""
  const defaultMinCapacity = getDefaultNormalMinCapacity(capacity)
  const numericCapacity = Number(capacity)
  const numericMinCapacity = Number(minCapacity)
  const capacityError = touched.capacity && (
    !Number.isInteger(numericCapacity) || numericCapacity <= 0
      ? "Sĩ số tối đa phải là số nguyên lớn hơn 0."
      : selectedRoomObj?.capacity != null && numericCapacity > Number(selectedRoomObj.capacity)
        ? `Sĩ số vượt quá sức chứa phòng (${selectedRoomObj.capacity} người).`
        : apiEnabled && selectedRoomObj?.capacity == null
          ? "Chưa xác định được sức chứa phòng đã chọn."
        : apiEnabled && numericCapacity > 15
          ? "Lớp Normal không được vượt quá 15 học viên."
          : ""
  )
  const minCapacityError = touched.minCapacity && (
    !Number.isInteger(numericMinCapacity)
      ? "Sĩ số tối thiểu phải là số nguyên."
      : defaultMinCapacity !== null && numericMinCapacity < defaultMinCapacity
        ? `Sĩ số tối thiểu không được thấp hơn mức mặc định ${defaultMinCapacity}.`
        : numericMinCapacity > numericCapacity
          ? "Sĩ số tối thiểu không được lớn hơn sĩ số tối đa."
          : ""
  )

  const handleCapacityChange = (value) => {
    setCapacityCustomized(true)
    setCapacity(value)
    if (value === "") return
    const nextCapacity = Number(value)
    setMinCapacity((currentMinCapacity) =>
      adjustNormalMinCapacityForMaxChange(
        currentMinCapacity,
        nextCapacity,
        minCapacityCustomized,
      ),
    )
  }
  const dateError = isFirstSessionInPast
    ? "Buổi học đầu tiên đã qua giờ hiện tại."
    : !startDateMatchesSchedule
      ? "Vui lòng chọn ngày khớp với lịch học đã chọn."
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

  // Handle class creation
  const handleSubmit = async () => {
    const pendingCreation = normalRequestIdStateRef.current
    if (apiEnabled && pendingCreation?.status === "outcome_unknown") {
      showToast(
        `Kết quả tạo lớp chưa xác định (requestId ${pendingCreation.requestId}). Hãy kiểm tra danh sách lớp trên hệ thống trước khi thử tạo lại.`,
        "error",
      )
      return
    }
    if (apiEnabled && ["created_unverified", "post_unconfirmed", "post_pending"].includes(pendingCreation?.status)) {
      setIsSubmitting(true)
      try {
        const retryResult = await addClassSession({}, {
          idempotencyStateRef: normalRequestIdStateRef,
        })
        if (retryResult?.success && retryResult.data?.id) {
          setNormalCreationRecovery(null)
          showToast(
            pendingCreation.status === "created_unverified"
              ? `Đã xác minh đủ 12 buổi cho lớp #${retryResult.data.id}.`
              : `Đã tạo lớp học và xác minh đủ 12 buổi cho lớp #${retryResult.data.id}.`,
            "success",
          )
          onClose()
        } else if (retryResult?.createdButUnverified) {
          setNormalCreationRecovery({
            status: "created_unverified",
            classId: retryResult.classId,
            requestId: retryResult.requestId,
          })
          showToast(retryResult.message, "error")
        } else if (retryResult?.postUnconfirmed) {
          setNormalCreationRecovery({ status: "post_unconfirmed", requestId: retryResult.requestId })
          showToast(retryResult.message, "error")
        } else if (retryResult?.outcomeUnknown) {
          setNormalCreationRecovery({ status: "outcome_unknown", requestId: retryResult.requestId })
          showToast(retryResult.message, "error")
        } else {
          showToast(retryResult?.message || "Chưa thể xác minh lại lịch lớp đã tạo.", "error")
        }
      } catch (error) {
        showToast(error?.message || "Chưa thể xác minh lại lịch lớp đã tạo.", "error")
      } finally {
        setIsSubmitting(false)
      }
      return
    }

    setTouched({
      className: true,
      capacity: true,
      minCapacity: true,
      startTime: true,
      endTime: true,
      price: true,
    })

    if (validateClassName(className)) {
      showToast(validateClassName(className), "error")
      return
    }
    if (isFirstSessionInPast) {
      showToast(
        "Buổi học đầu tiên đã qua giờ hiện tại. Vui lòng chọn ngày hoặc giờ trong tương lai.",
        "error",
      )
      return
    }
    if (!startDateMatchesSchedule) {
      showToast("Vui lòng chọn ngày khớp với lịch học đã chọn.", "error")
      return
    }
    if (!selectedDays.length) {
      showToast("Vui lòng chọn ít nhất một thứ trong tuần.", "error")
      return
    }
    const capacityValidationError = validateNormalClassCapacity({
      maxCapacity: capacity,
      minCapacity,
      roomCapacity: selectedRoomObj?.capacity,
      maxAllowedCapacity: apiEnabled ? 15 : undefined,
      requireRoomCapacity: apiEnabled,
    })
    if (capacityValidationError) {
      showToast(capacityValidationError, "error")
      return
    }
    if (apiEnabled) {
      const durationMinutes = (Number(endTime.split(":")[0]) - Number(startTime.split(":")[0])) * 60
        + Number(endTime.split(":")[1]) - Number(startTime.split(":")[1])
      if (durationMinutes !== 90) {
        showToast("Theo quy định trung tâm, mỗi buổi học phải kéo dài đúng 90 phút.", "error")
        return
      }
      if (selectedSubject && selectedSubject.outdoor === null) {
        showToast("Môn học chưa được phân loại trong nhà/ngoài trời (outdoor = null) nên chưa thể xếp lịch.", "error")
        return
      }
      const selectedTimeSlot = NORMAL_CLASS_TIME_SLOTS.find(
        (slot) => slot.startTime === startTime && slot.endTime === endTime,
      )
      if (isOutdoorClass && selectedTimeSlot && !selectedTimeSlot.outdoorAllowed) {
        showToast("Môn ngoài trời không được xếp vào ca 3 hoặc ca 4.", "error")
        return
      }
      if (apiEnabled) {
        const isRoomValid = validCenterRooms.some((r) => String(r.id) === String(roomId)) && selectedRoomObj
        if (!isRoomValid) {
          showToast("Phòng tập đã chọn không còn khả dụng hoặc không tồn tại. Vui lòng chọn lại sân/phòng tập.", "error")
          return
        }
      }
    }
    if (apiEnabled) {
      const missing = []
      if (!targetSubjectId) missing.push(`không tìm thấy môn "${currentSport.name}" trong danh mục hệ thống`)
      else if (!Number.isFinite(normalPrice)) missing.push(`môn "${currentSport.name}" chưa có học phí hợp lệ`)
      if (!selectedRoomObj?.id) missing.push(`chưa có sân/phòng phù hợp cho môn "${currentSport.name}"`)
      if (missing.length > 0) {
        showToast(`Không thể tạo lớp: ${missing.join("; ")}. Vui lòng tải lại danh mục.`, "error")
        return
      }
    }

    setIsSubmitting(true)
    try {
      const roomBackendId = Number(selectedRoomObj?.backendId ?? selectedRoomObj?.id)
      const payload = {
        name: className.trim(),
        nameVi: className.trim(),
        description: description.trim(),
        category: currentSport.name,
        subjectId: targetSubjectId,
        coachId: Number(String(coachId).replace(/\D/g, "")) || null,
        coachName: selectedCoachObj?.name || "Chưa phân công",
        roomId: Number.isInteger(roomBackendId) && roomBackendId > 0 ? roomBackendId : null,
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
        roomCapacity: selectedRoomObj?.capacity,
        requireRoomCapacity: apiEnabled,
        status: "published",
        apiStatus: "Open",
        price: apiEnabled ? normalPrice : isFreeClass ? 0 : Number(price),
        isFree: apiEnabled ? false : isFreeClass,
        sessionCount: apiEnabled ? 12 : Number(sessionCount),
        totalSessions: apiEnabled ? 12 : Number(sessionCount),
        classType: "Normal",
        minTierRequired: 1,
        selectedDays: [...selectedDays],
        daysOfWeek: selectedDays.map(Number),
      }

      if (apiEnabled) {
        if (!Number.isInteger(payload.roomId) || payload.roomId <= 0) {
          throw new Error("Thông tin sân/phòng đã chọn không hợp lệ.")
        }
        const createResult = await addClassSession(payload, {
          idempotencyStateRef: normalRequestIdStateRef,
        })
        if (createResult?.createdButUnverified) {
          setNormalCreationRecovery({
            status: "created_unverified",
            classId: createResult.classId,
            requestId: createResult.requestId,
          })
          showToast(createResult.message, "error")
          return
        }
        if (createResult?.outcomeUnknown) {
          setNormalCreationRecovery({
            status: "outcome_unknown",
            requestId: createResult.requestId,
          })
          showToast(createResult.message, "error")
          return
        }
        if (createResult?.postUnconfirmed) {
          setNormalCreationRecovery({
            status: "post_unconfirmed",
            requestId: createResult.requestId,
          })
          showToast(createResult.message, "error")
          return
        }
        if (!createResult?.success || !createResult.data?.id) {
          throw new Error(createResult?.message || "Hệ thống chưa thể xác nhận mã lớp học mới.")
        }
        setNormalCreationRecovery(null)
        showToast("Đã tạo lớp học và khởi tạo đủ lịch 12 buổi thành công.", "success")
        onClose()
        return
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
          "Đã tạo và mở đăng ký lớp học thành công!",
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
          {normalCreationRecovery?.status === "created_unverified" && (
            <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Lớp #{normalCreationRecovery.classId} đã được tạo nhưng chưa xác minh được đầy đủ lịch học. Lớp đã được thêm vào danh sách để Manager kiểm tra. Nút bên dưới chỉ thử đọc lại lịch, không gửi POST tạo lớp lần nữa.
            </div>
          )}
          {normalCreationRecovery?.status === "outcome_unknown" && (
            <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Chưa xác định được kết quả tạo lớp (requestId {normalCreationRecovery.requestId}); response không có classId hợp lệ. Hãy kiểm tra danh sách lớp trên hệ thống trước khi tạo thao tác mới.
            </div>
          )}
          {normalCreationRecovery?.status === "post_unconfirmed" && (
            <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Chưa xác nhận được kết quả POST tạo lớp (requestId {normalCreationRecovery.requestId}). Thử lại sẽ dùng đúng requestId và payload đã gửi.
            </div>
          )}
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
                  {sportOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label htmlFor="new-class-name" className="text-sm font-medium text-stone-800 block mb-1.5">
                  Tên lớp học
              </label>
              <input
                id="new-class-name"
                type="text"
                value={className}
                maxLength={MAX_CLASS_NAME_LENGTH}
                onChange={(event) => {
                  setIsDirty(true)
                  setClassName(event.target.value)
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, className: true }))}
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? "new-class-name-error" : undefined}
                placeholder="Nhập tên lớp học"
                className={`w-full h-11 px-3.5 text-sm font-semibold bg-white border ${nameError ? "border-rose-400" : "border-stone-300"} text-stone-800 rounded-xl focus:outline-none focus:border-stone-800 focus:ring-1 focus:ring-stone-800`}
              />
              {nameError && <p id="new-class-name-error" role="alert" className="text-xs text-rose-600 mt-1">{nameError}</p>}
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
                  {matchedCoaches.length > 0 ? (
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
                  ) : (
                    <option value="__no_matching_coach__" disabled>
                      Chưa có huấn luyện viên cho bộ môn này
                    </option>
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {matchedCoaches.length === 0 && (
                <p role="status" className="mt-1.5 text-xs text-amber-700">
                  Chưa có huấn luyện viên được ghi nhận dạy bộ môn này.
                </p>
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
                  {allAvailableRooms.length > 0 ? (
                    <optgroup label={`Sân chuyên dụng ${currentSport.name}`}>
                      {allAvailableRooms.map((room) => {
                        const code = room.roomCode ? String(room.roomCode).trim() : ""
                        const label = code ? `${code} - ${room.name || `Sân #${room.id}`}` : room.name
                        return (
                          <option key={room.id} value={String(room.id)}>
                            {label}
                          </option>
                        )
                      })}
                    </optgroup>
                  ) : (
                    <option value="__no_matching_room__" disabled>
                      Chưa có sân/phòng được cấu hình cho bộ môn này
                    </option>
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {allAvailableRooms.length === 0 && (
                <p role="status" className="text-xs text-amber-700 mt-1">
                  Chưa có sân/phòng phù hợp với bộ môn này.
                </p>
              )}
            </div>
          </div>

          {/* CARD 3: LỊCH HỌC */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-5 space-y-4 shadow-2xs">
            <h2 className="text-base font-bold text-stone-900">Lịch học</h2>

            {/* Lịch học hằng tuần */}
            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-2">
                Lịch học
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {(apiEnabled
                  ? [
                      { id: "mon-wed-fri", label: "T2 · T4 · T6", days: [1, 3, 5] },
                      { id: "tue-thu-sat", label: "T3 · T5 · T7", days: [2, 4, 6] },
                      { id: "mon-wed-sun", label: "T2 · T4 · CN", days: [1, 3, 0] },
                      { id: "tue-thu-sun", label: "T3 · T5 · CN", days: [2, 4, 0] },
                      { id: "wed-fri-sun", label: "T4 · T6 · CN", days: [3, 5, 0] },
                    ]
                  : WEEKDAYS.map((day) => ({ id: day.id, label: day.label, days: [day.dayOfWeek] }))
                ).map((day) => {
                  const isSelected =
                    day.days.length === selectedDays.length &&
                    day.days.every((weekday) => selectedDays.includes(weekday))
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => {
                        if (apiEnabled) {
                          setSelectedDays([...day.days])
                          setIsDirty(true)
                        } else {
                          toggleWeekday(day.days[0])
                        }
                      }}
                      className={`${apiEnabled ? "w-auto px-3.5" : "w-11"} h-9 text-xs sm:text-sm rounded-lg transition-colors cursor-pointer text-center font-medium ${
                        isSelected
                          ? "bg-[#18181B] text-white border border-stone-900 shadow-2xs"
                          : "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50"
                      }`}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-700 block mb-2">
                Ca học
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {NORMAL_CLASS_TIME_SLOTS.map((slot) => {
                  const disabled = isOutdoorClass && !slot.outdoorAllowed
                  const selected = startTime === slot.startTime && endTime === slot.endTime
                  return (
                    <button
                      key={slot.slotNumber}
                      type="button"
                      aria-pressed={selected}
                      disabled={disabled}
                      onClick={() => {
                        setIsDirty(true)
                        setStartTime(slot.startTime)
                        setEndTime(slot.endTime)
                      }}
                      className={`rounded-lg border px-2.5 py-2 text-center transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary/30 ${
                        disabled
                          ? "cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400"
                          : selected
                            ? "border-brand-primary bg-blue-50/80 text-brand-primary ring-1 ring-brand-primary/20 shadow-2xs cursor-pointer"
                            : "border-stone-200 bg-white text-stone-700 hover:border-brand-primary/60 hover:bg-blue-50/40 cursor-pointer"
                      }`}
                    >
                      <span className="block text-xs font-bold">{slot.name}</span>
                      <span className="mt-0.5 block text-[11px] tabular-nums opacity-85">{slot.startTime}–{slot.endTime}</span>
                    </button>
                  )
                })}
              </div>
              {isOutdoorClass && (
                <div className="text-xs text-stone-500 mt-1.5">
                  Ca 3 và Ca 4 không áp dụng cho sân ngoài trời.
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-stone-800 block mb-1.5">
                Ngày học đầu tiên
              </label>
              <DatePicker
                value={startDate}
                onChange={(v) => {
                  setIsDirty(true)
                  setStartDate(v)
                }}
                min={minimumStartDate}
                weekdays={selectedDays}
                error={Boolean(dateError)}
              />
              {dateError && (
                <p role="alert" className="text-xs text-orange-600 mt-1 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{dateError}</span>
                </p>
              )}
              <p className="text-xs text-stone-500 mt-1">
                Chỉ chọn được ngày tương lai khớp với lịch tuần và ca học. Nếu ngày đó là ngày nghỉ, Backend sẽ chuyển buổi học sang ngày phù hợp tiếp theo.
              </p>
            </div>

            {/* Kết thúc: Theo số buổi vs Theo ngày */}
            {!apiEnabled && <div>
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
            </div>}

            {/* Tổng số buổi (Stepper + 4 Chips) */}
            {endMode === "sessions" ? (
              <div>
                {!apiEnabled && (
                  <>
                <label className="text-sm font-medium text-stone-800 block mb-2">
                  Tổng số buổi
                </label>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Stepper & Editable Input */}
                  <div className="h-10 flex items-center border border-stone-300 rounded-xl overflow-hidden bg-white">
                    <button
                      type="button"
                      disabled={apiEnabled}
                      onClick={() =>
                        updateSessionCount(Math.max(1, sessionCount - 1))
                      }
                      className="w-9 h-10 flex items-center justify-center hover:bg-stone-100 text-stone-700 transition-colors cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      disabled={apiEnabled}
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
                      disabled={apiEnabled}
                      onClick={() =>
                        updateSessionCount((Number(sessionCount) || 0) + 1)
                      }
                      className="w-9 h-10 flex items-center justify-center hover:bg-stone-100 text-stone-700 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                  </>
                )}

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

                  {apiEnabled && (
                    <p className="mt-2 text-[11px] leading-relaxed text-amber-700">
                      Preview dự kiến theo mẫu đã chọn; Backend có thể điều chỉnh lịch quanh ngày nghỉ. Lịch thực tế được xác minh sau khi tạo.
                    </p>
                  )}
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
                max={apiEnabled ? Math.min(15, selectedRoomObj?.capacity || 15) : selectedRoomObj?.capacity || 30}
                value={capacity}
                onFocus={(e) => e.target.select()}
                onClick={(e) => {
                  if (e.target.selectionStart === e.target.selectionEnd)
                    e.target.select()
                }}
                onBlur={() => {
                  setTouched((p) => ({ ...p, capacity: true }))
                  if (!capacity || capacity < 1) {
                    const fallbackCapacity = Number(selectedRoomObj?.capacity) || 8
                    handleCapacityChange(apiEnabled ? Math.min(fallbackCapacity, 15) : fallbackCapacity)
                  }
                }}
                onChange={(e) => {
                  setIsDirty(true)
                  const val = e.target.value
                  handleCapacityChange(val === "" ? "" : Number(val))
                }}
                className={`w-full h-11 px-3.5 text-sm font-normal bg-white border rounded-xl focus:outline-none transition-colors tabular-nums ${
                  capacityError
                    ? "border-orange-500 bg-orange-50/20"
                    : "border-stone-300 focus:border-stone-800 focus:ring-1 focus:ring-stone-800"
                }`}
              />

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
                min={defaultMinCapacity ?? 1}
                max={capacity || 30}
                value={minCapacity}
                onFocus={(e) => e.target.select()}
                onClick={(e) => {
                  if (e.target.selectionStart === e.target.selectionEnd)
                    e.target.select()
                }}
                onBlur={() => {
                  setTouched((p) => ({ ...p, minCapacity: true }))
                }}
                onChange={(e) => {
                  setIsDirty(true)
                  setMinCapacityCustomized(true)
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
                  {apiEnabled
                    ? "Học phí"
                    : pricingMode === "total"
                    ? "Học phí trọn khóa"
                    : "Học phí mỗi buổi"}
                </label>
                {!apiEnabled && <button
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
                </button>}
              </div>

              {/* Ô nhập tiền tệ chuẩn cao cấp với Auto-select, Gợi ý nhanh & Xóa 1 chạm */}
              <CurrencyInput
                id="class-price"
                disabled={isFreeClass || apiEnabled}
                value={
                  apiEnabled
                    ? Number.isFinite(normalPrice)
                      ? normalPrice
                      : 0
                    : pricingMode === "total"
                      ? price
                      : perSessionPriceInput
                }
                onChange={handleNumericPriceChange}
                placeholder="0"
                suffix={apiEnabled || pricingMode === "total" ? "đ" : "đ / buổi"}
                presets={
                  pricingMode === "total"
                    ? [200000, 500000, 800000, 1000000, 1200000, 1500000]
                    : [20000, 50000, 75000, 100000, 150000]
                }
              />

              {/* Checkbox Lớp học miễn phí */}
              {!apiEnabled && <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={isFreeClass}
                  onChange={handleToggleFreeClass}
                  className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-800 cursor-pointer accent-stone-900"
                />
                <span className="text-xs text-stone-700 font-medium group-hover:text-stone-900 transition-colors">
                  Lớp học miễn phí (Hội viên tham gia không mất phí)
                </span>
              </label>}
            </div>

          </div>

          {/* CARD 5: TÓM TẮT */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-4 shadow-2xs">
            <h2 className="text-base font-bold text-stone-900">Tóm tắt</h2>

            <div>
              <h3 className="text-lg font-bold text-stone-900 leading-snug">
                {className || "Chưa đặt tên lớp"}
              </h3>
              <div className="text-xs text-stone-500 mt-0.5 capitalize">
                {currentSport.name}
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
                  <span>Lớp mới bị trùng lịch</span>
                </div>
                <ol className="list-decimal space-y-1 pl-5 text-xs text-rose-700 leading-relaxed font-medium">
                  {String(conflict.message || "Lịch học bị trùng với một lớp hiện có.")
                    .split(/\s*\|\s*|\r?\n/)
                    .filter((detail) => detail.trim())
                    .map((detail, index) => (
                      <li key={`${index}-${detail}`}>
                        <strong>{formatConflictDetail(detail)}</strong>
                      </li>
                    ))}
                </ol>
                <p className="text-[11px] text-rose-600 italic">
                  Vui lòng thay đổi khung giờ, ngày học hoặc phân công HLV/sân
                  tập khác để tiếp tục.
                </p>
              </div>
            ) : conflict?.hasMissingSchedule ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                <p className="font-semibold">Khung giờ chồng lấn — chưa xác nhận trùng ngày</p>
                {conflict.message || "Chưa thể xác minh xung đột vì thiếu ngày học."}
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
            onClick={() => handleSubmit()}
            disabled={
              isSubmitting || normalCreationRecovery?.status === "outcome_unknown" || (!["created_unverified", "post_unconfirmed"].includes(normalCreationRecovery?.status) && (conflict?.hasConflict || conflict?.hasMissingSchedule || isFirstSessionInPast || (apiEnabled && !startDateMatchesSchedule)))
            }
            className="h-10 px-6 rounded-lg bg-brand-primary hover:bg-brand-primary-hover text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer flex items-center gap-2"
            title={
              normalCreationRecovery?.status === "created_unverified"
                ? "Chỉ thử xác minh lịch của lớp đã tạo; không tạo lớp mới"
                : normalCreationRecovery?.status === "post_unconfirmed"
                  ? "Thử lại cùng payload và requestId đã gửi"
                : normalCreationRecovery?.status === "outcome_unknown"
                  ? "Cần kiểm tra kết quả trên hệ thống trước"
                  : conflict?.hasConflict
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
              <span>{normalCreationRecovery?.status === "created_unverified" ? "Thử xác minh lại lịch" : normalCreationRecovery?.status === "post_unconfirmed" ? "Thử lại cùng requestId" : normalCreationRecovery?.status === "outcome_unknown" ? "Cần kiểm tra kết quả" : "Tạo & mở đăng ký"}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
