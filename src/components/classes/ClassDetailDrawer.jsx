import React, { useState, useEffect, useMemo, useRef } from "react"
import { useSCMS } from "../../context/SCMSContext"
import * as managerApi from "../../api/managerApi"
import { inferNormalClassWeekdaysFromSessions } from "../../api/mappers.js"
import { getErrorMessage } from "../../api/apiErrors"
import { normalizeRole, ROLE_MANAGER } from "../../utils/navigation"
import {
  canSubmitNormalClassOpening,
  evaluateNormalClassOpening,
  getFirstNormalClassSession,
  getNormalClassOpeningError,
} from "../../api/normalClassOpening"
import NormalClassLifecyclePanel from "./NormalClassLifecyclePanel"
import { hasValidScheduleData } from "./hooks/useScheduleConflict"
import { NORMAL_CLASS_TIME_SLOTS } from "../modals/new-class/classFormConstants.js"
import {
  getEnrollmentsByClass,
  enrollMemberInClass,
  cancelMemberEnrollment,
} from "../../api/classEnrollmentApi"
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Users,
  DollarSign,
  TrendingUp,
  UserCheck,
  Award,
  Edit3,
  Copy,
  Ban,
  AlertTriangle,
  AlertCircle,
  UserPlus,
  Trash2,
  Search,
  CheckCircle2,
  ExternalLink,
} from "lucide-react"

const confirmationAcceptedButUnrefreshed = new Set()

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
  return num === null || num === undefined
    ? "—"
    : new Intl.NumberFormat("vi-VN").format(num)
}

function formatLifecycleDateTime(value) {
  if (value == null || value === "") return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}

const WEEKDAY_NAMES_MAP = {
  1: "T2",
  2: "T3",
  3: "T4",
  4: "T5",
  5: "T6",
  6: "T7",
  0: "CN",
}

export function ClassDetailDrawer({
  cls,
  conflictInfo,
  initialLifecycleKind = "Postpone",
  initialLifecycleAction = "details",
  onClose,
  onEdit,
  onDuplicate,
  onCancelClass,
  onEnrollmentChange,
}) {
  const { members, language, showToast, apiEnabled, currentUser, subjects, coaches, setClasses } = useSCMS()
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [enrollmentLoadFailed, setEnrollmentLoadFailed] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [selectedNewMemberId, setSelectedNewMemberId] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [classDetail, setClassDetail] = useState(null)
  const [classDetailLoading, setClassDetailLoading] = useState(apiEnabled)
  const [classDetailError, setClassDetailError] = useState("")
  const [sessions, setSessions] = useState(null)
  const [sessionsLoading, setSessionsLoading] = useState(apiEnabled)
  const [sessionsError, setSessionsError] = useState("")
  const [openingDialogOpen, setOpeningDialogOpen] = useState(false)
  const [openingReason, setOpeningReason] = useState("")
  const [openingSubmitting, setOpeningSubmitting] = useState(false)
  const [openingSubmissionUncertain, setOpeningSubmissionUncertain] = useState(false)
  const [openingActionError, setOpeningActionError] = useState(null)
  const [openingRefreshWarning, setOpeningRefreshWarning] = useState("")
  const [confirmationAccepted, setConfirmationAccepted] = useState(false)

  const classId = cls?.id
  const lifecycleActionOnly = ["opening", "transfer", "cancel"].includes(initialLifecycleAction)
  const lifecycleActionTitle = initialLifecycleAction === "opening"
    ? "Xác nhận khai giảng"
    : initialLifecycleAction === "transfer"
      ? "Thay đổi lớp"
      : "Hủy lớp"
  const classIdRef = useRef(classId)
  const lifecyclePanelRef = useRef(null)
  const openingDataGeneration = useRef(0)
  const openingRefreshTimeoutMs = 12000
  classIdRef.current = classId

  useEffect(() => () => { openingDataGeneration.current += 1 }, [classId])

  useEffect(() => {
    let active = true
    if (!apiEnabled) {
      setClassDetail(cls)
      setClassDetailError("")
      setClassDetailLoading(false)
      return () => { active = false }
    }

    setClassDetail(null)
    setClassDetailError("")
    setClassDetailLoading(true)
    managerApi.getClassById(classId, {}, { notifyForbidden: false })
      .then((item) => {
        if (active) setClassDetail(item)
      })
      .catch((error) => {
        if (active) setClassDetailError(getErrorMessage(error))
      })
      .finally(() => {
        if (active) setClassDetailLoading(false)
      })

    return () => { active = false }
  }, [apiEnabled, classId])

  useEffect(() => {
    let active = true
    if (!apiEnabled || !classId) {
      setSessions(null)
      setSessionsError("")
      setSessionsLoading(false)
      return () => { active = false }
    }
    setSessions(null)
    setSessionsError("")
    setSessionsLoading(true)
    managerApi.getSessions({ classId }, { notifyForbidden: false })
      .then((items) => { if (active) setSessions(items) })
      .catch((error) => { if (active) setSessionsError(getErrorMessage(error)) })
      .finally(() => { if (active) setSessionsLoading(false) })
    return () => { active = false }
  }, [apiEnabled, classId])

  useEffect(() => {
    setConfirmationAccepted(confirmationAcceptedButUnrefreshed.has(String(classId)))
    setOpeningSubmissionUncertain(false)
  }, [classId])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (openingSubmitting) return
        if (openingDialogOpen && initialLifecycleAction === "opening") onClose()
        else if (openingDialogOpen) setOpeningDialogOpen(false)
        else onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [initialLifecycleAction, onClose, openingDialogOpen, openingSubmitting])

  // Load registered members
  const loadEnrollments = async () => {
    if (!classId) return
    const requestedClassId = classId
    setLoading(true)
    try {
      if (apiEnabled) {
        const data = await getEnrollmentsByClass(requestedClassId, { strict: true })
        if (String(classIdRef.current) !== String(requestedClassId)) return
        setEnrollments(data || [])
        setEnrollmentLoadFailed(false)
      } else {
        const enrolledCount = cls.enrolledCount || 0
        const mockList = (members || [])
          .slice(0, enrolledCount)
          .map((m, idx) => ({
            id: idx + 1,
            memberId: m.id,
            memberName: m.name,
            memberCode: m.code || `MB-${1000 + idx}`,
            memberEmail: m.email,
            memberPhone: m.phone || "0988 123 456",
            registeredAt: cls.startDate || cls.date || null,
            paymentStatus: "paid",
          }))
        setEnrollments(mockList)
      }
    } catch {
      if (String(classIdRef.current) !== String(requestedClassId)) return
      setEnrollmentLoadFailed(true)
    } finally {
      if (String(classIdRef.current) === String(requestedClassId)) setLoading(false)
    }
  }

  const refreshOpeningData = async ({ afterConfirmation = false } = {}) => {
    if (!apiEnabled || !classId) return false
    const requestedClassId = classId
    const requestGeneration = ++openingDataGeneration.current
    const confirmingRequestWasAccepted = afterConfirmation || confirmationAcceptedButUnrefreshed.has(String(classId))
    setClassDetailLoading(true)
    setLoading(true)
    setSessionsLoading(true)
    setClassDetailError("")
    setSessionsError("")
    setEnrollmentLoadFailed(false)

    const results = await Promise.allSettled([
      managerApi.getClassById(classId, {}, { notifyForbidden: false, timeoutMs: openingRefreshTimeoutMs }),
      getEnrollmentsByClass(classId, { strict: true, timeoutMs: openingRefreshTimeoutMs }),
      managerApi.getSessions({ classId }, { notifyForbidden: false, timeoutMs: openingRefreshTimeoutMs }),
      managerApi.getClasses({ subjects, coaches }, { notifyForbidden: false, timeoutMs: openingRefreshTimeoutMs }),
    ])
    if (
      requestGeneration !== openingDataGeneration.current ||
      String(classIdRef.current) !== String(requestedClassId)
    ) return false
    const errors = []

    if (results[0].status === "fulfilled") {
      setClassDetail(results[0].value)
      if (confirmingRequestWasAccepted && results[0].value.openingConfirmedAt != null) {
        confirmationAcceptedButUnrefreshed.delete(String(classId))
        setConfirmationAccepted(false)
      } else if (confirmingRequestWasAccepted) {
        errors.push("Hệ thống đã nhận xác nhận, đang cập nhật dữ liệu mới nhất.")
      }
    } else {
      const message = getErrorMessage(results[0].reason)
      setClassDetailError(message)
      errors.push(`Chi tiết lớp: ${message}`)
    }

    if (results[1].status === "fulfilled") {
      setEnrollments(results[1].value || [])
    } else {
      setEnrollmentLoadFailed(true)
      errors.push(`Danh sách đăng ký: ${getErrorMessage(results[1].reason)}`)
    }

    if (results[2].status === "fulfilled") {
      setSessions(results[2].value || [])
    } else {
      const message = getErrorMessage(results[2].reason)
      setSessionsError(message)
      errors.push(`Lịch học: ${message}`)
    }

    if (results[3].status === "fulfilled") {
      setClasses?.(results[3].value || [])
    } else {
      errors.push(`Danh sách lớp: ${getErrorMessage(results[3].reason)}`)
    }

    const synchronized = errors.length === 0
    const confirmed = results[0].status === "fulfilled" && results[0].value.openingConfirmedAt != null
    setOpeningRefreshWarning(synchronized ? "" : errors.join(" "))
    setClassDetailLoading(false)
    setLoading(false)
    setSessionsLoading(false)
    return { synchronized, confirmed, classDetailLoaded: results[0].status === "fulfilled" }
  }

  const reconcileOpeningAfterUncertainSubmit = async () => {
    const result = await refreshOpeningData().catch(() => null)
    if (result?.classDetailLoaded) setOpeningSubmissionUncertain(false)
    if (!result?.confirmed) return false
    confirmationAcceptedButUnrefreshed.delete(String(classId))
    setOpeningActionError(null)
    setOpeningDialogOpen(false)
    setOpeningReason("")
    showToast("Khai giảng lớp học đã được xác nhận.", "success")
    onClose()
    return true
  }

  const authorities = Array.isArray(currentUser?.authorities) ? currentUser.authorities : []
  const hasManageClasses = authorities.includes("MANAGE_CLASSES")
  const hasManagerRole = normalizeRole(currentUser?.role, { isApiMode: apiEnabled }) === ROLE_MANAGER
  // Enrollment snapshots omit the invoice/member fields Backend uses for paidCount().
  const hasAuthoritativePaidCount = false
  const openingEvaluation = evaluateNormalClassOpening({
    classItem: classDetail,
    enrollments: apiEnabled && hasAuthoritativePaidCount ? enrollments : null,
    sessions: apiEnabled && !sessionsLoading && !sessionsError ? sessions : null,
    authorities,
    reason: openingReason,
  })
  const openingEnrollmentShortfall = openingEvaluation.paidRegisteredCount !== null
    && openingEvaluation.minimum != null
    && openingEvaluation.paidRegisteredCount < openingEvaluation.minimum
  const openingDataLoading = classDetailLoading || sessionsLoading || loading
  const openingPermissionGranted = openingEvaluation.openingConfirmationAllowed === true
  const openingReasonNeedsInput = openingEvaluation.reasonRequired === true && !openingReason.trim()
  const openingActionBlockers = openingEvaluation.openingConfirmationAllowed === true
    ? []
    : openingReasonNeedsInput
      ? openingEvaluation.blockers.slice(0, -1)
      : openingEvaluation.blockers
  const openingSubmitReady = canSubmitNormalClassOpening({ ...openingEvaluation, reason: openingReason })
  const firstOpeningSession = getFirstNormalClassSession(sessions)?.session || null
  const scheduleClassItem = classDetail ?? cls
  const detailScheduleIsValid = hasValidScheduleData({ ...scheduleClassItem, sessions })
  const showMissingScheduleWarning = apiEnabled
    ? !sessionsLoading && !sessionsError && !detailScheduleIsValid
    : Boolean(conflictInfo?.hasMissingSchedule)
  const normalClass = String(classDetail?.classType ?? cls?.classType ?? "").trim().toLowerCase() === "normal"
  const lifecycleStatus = String(classDetail?.apiStatus ?? classDetail?.status ?? "").trim().toLowerCase()
  const canShowOpeningAction = apiEnabled && hasManagerRole && hasManageClasses && normalClass &&
    !["cancelled", "canceled", "closed", "completed", "ongoing"].includes(lifecycleStatus) &&
    !classDetailLoading && !classDetailError && classDetail != null &&
    classDetail.openingConfirmedAt == null && !confirmationAccepted && !openingSubmissionUncertain && openingPermissionGranted !== false

  useEffect(() => {
    if (!["opening", "transfer", "cancel"].includes(initialLifecycleAction)) return undefined
    const timer = window.setTimeout(() => {
      lifecyclePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [classId, initialLifecycleAction])

  useEffect(() => {
    if (initialLifecycleAction === "opening" && !classDetailLoading) {
      setOpeningActionError(null)
      setOpeningReason("")
      setOpeningDialogOpen(true)
    }
  }, [initialLifecycleAction, classDetailLoading, classId])

  const formatOpeningSession = (item) => {
    if (!item) return "Chưa xác minh"
    const startTime = String(item.startTime || "").slice(0, 5)
    const endTime = String(item.endTime || "").slice(0, 5)
    const slot = NORMAL_CLASS_TIME_SLOTS.find((timeSlot) =>
      timeSlot.startTime === startTime && timeSlot.endTime === endTime,
    )
    return `${slot?.name || "Chưa xác định ca"} · ${formatViDate(item.sessionDate)}`
  }

  const validMemberSummary = (() => {
    if (hasAuthoritativePaidCount && openingEvaluation.paidRegisteredCount !== null) {
      const count = openingEvaluation.paidRegisteredCount ?? 0
      return classDetail?.minCapacity == null
        ? String(count)
        : `${count} / ${classDetail.minCapacity}`
    }
    const enrolledCount = Number.isFinite(Number(classDetail?.enrolledCount))
      ? Number(classDetail.enrolledCount)
      : null
    if (enrolledCount !== null) {
      return classDetail?.minCapacity != null
        ? `${enrolledCount} / ${classDetail.minCapacity} học viên, tối thiểu ${classDetail.minCapacity}`
        : `${enrolledCount} học viên`
    }
    return "Hệ thống sẽ kiểm tra số học viên đã thanh toán khi bạn xác nhận"
  })()

  const submitOpeningConfirmation = async (event) => {
    event?.preventDefault?.()
    const currentCheck = evaluateNormalClassOpening({
      classItem: classDetail,
      enrollments: hasAuthoritativePaidCount ? enrollments : null,
      sessions: !sessionsLoading && !sessionsError ? sessions : null,
      authorities,
      reason: openingReason,
      now: new Date(),
    })
    setOpeningActionError(null)
    if (!hasManagerRole || !canSubmitNormalClassOpening({ ...currentCheck, reason: openingReason }) || openingSubmitting || confirmationAccepted) {
      setOpeningActionError({
        status: 0,
        code: null,
        message: currentCheck.blockers[0] || "Đang có yêu cầu xác nhận được xử lý.",
      })
      return
    }

    setOpeningSubmitting(true)
    setOpeningSubmissionUncertain(false)
    try {
      await managerApi.confirmNormalClassOpening(classId, currentCheck.payload, {
        notifyForbidden: false,
        timeoutMs: 25000,
      })
      confirmationAcceptedButUnrefreshed.add(String(classId))
      setConfirmationAccepted(true)
      setOpeningDialogOpen(false)
      setOpeningReason("")
      showToast("Khai giảng lớp học thành công.", "success")
      onClose()
      managerApi.getClasses({ subjects, coaches }, { notifyForbidden: false })
        .then((items) => setClasses?.(items))
        .catch(() => {})
    } catch (error) {
      const normalized = getNormalClassOpeningError(error)
      setOpeningActionError(normalized)
      if (normalized.uncertain) {
        setOpeningSubmissionUncertain(true)
        await reconcileOpeningAfterUncertainSubmit()
      }
      else refreshOpeningData().catch(() => {})
    } finally {
      setOpeningSubmitting(false)
    }
  }

  useEffect(() => {
    loadEnrollments()
  }, [classId])

  const weekdays = useMemo(() => {
    if (Array.isArray(cls?.selectedDays) && cls.selectedDays.length > 0) {
      return cls.selectedDays.map((d) => WEEKDAY_NAMES_MAP[d] || d)
    }
    if (apiEnabled && String(cls?.classType || "").trim().toLowerCase() === "normal") {
      const inferredDays = inferNormalClassWeekdaysFromSessions(sessions, cls?.totalSessions ?? 12)
      return inferredDays?.map((day) => WEEKDAY_NAMES_MAP[day] || day) || []
    }
    return apiEnabled ? [] : ["T2", "T4", "T6"]
  }, [apiEnabled, cls?.classType, cls?.selectedDays, cls?.totalSessions, sessions])

  // Filtered members in enrolled tab
  const filteredEnrollments = useMemo(() => {
    if (!searchTerm.trim()) return enrollments
    const term = searchTerm.toLowerCase()
    return enrollments.filter(
      (e) =>
        (e.memberName || "").toLowerCase().includes(term) ||
        (e.memberCode || "").toLowerCase().includes(term) ||
        (e.memberPhone || "").includes(term),
    )
  }, [enrollments, searchTerm])

  // Available members to add
  const enrolledMemberIds = useMemo(
    () => new Set(enrollments.map((e) => String(e.memberId || e.id))),
    [enrollments],
  )
  const availableMembers = useMemo(
    () => (members || []).filter((m) => !enrolledMemberIds.has(String(m.id))),
    [members, enrolledMemberIds],
  )

  if (!cls) return null

  const dismissOpeningDialog = () => {
    if (openingSubmitting) return
    setOpeningDialogOpen(false)
    if (initialLifecycleAction === "opening") onClose()
  }

  const capacity = apiEnabled ? classDetail?.maxCapacity ?? null : cls.capacity ?? 8
  const enrolled = apiEnabled
    ? (loading || enrollmentLoadFailed ? cls.enrolledCount : enrollments.length)
    : enrollments.length || cls.enrolledCount || 0
  const minCap = apiEnabled ? classDetail?.minCapacity ?? null : cls.minCapacity ?? 4
  const percent =
    capacity > 0 && enrolled !== null
      ? Math.min(100, Math.round((enrolled / capacity) * 100))
      : null
  const numericPrice = cls.price === null || cls.price === undefined ? null : Number(cls.price)
  const isFree = apiEnabled
    ? numericPrice === 0
    : cls.isFree || numericPrice === 0
  const price = apiEnabled
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
  const sessionCount = cls.sessionCount ?? (apiEnabled ? null : 12)
  const perSessionPrice = price === null || sessionCount === null || sessionCount === 0
    ? null
    : Math.round(price / sessionCount / 1000) * 1000
  const estimatedRevenue = apiEnabled || enrolled === null || price === null
    ? null
    : enrolled * price

  const handleAddMember = async (e) => {
    e.preventDefault()
    if (!selectedNewMemberId) return
    setActionLoading(true)
    try {
      if (apiEnabled) {
        await enrollMemberInClass(classId, selectedNewMemberId)
      }
      showToast("Đã thêm học viên vào lớp thành công!", "success")
      setSelectedNewMemberId("")
      setIsAddingMember(false)
      await loadEnrollments()
      if (onEnrollmentChange) {
        onEnrollmentChange(classId, enrolled + 1)
      }
    } catch (err) {
      showToast(err?.message || "Lỗi khi thêm học viên.", "error")
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveMember = async (memberId, memberName) => {
    if (
      !window.confirm(`Bạn có chắc chắn muốn hủy đăng ký cho "${memberName}"?`)
    )
      return
    try {
      if (apiEnabled) {
        await cancelMemberEnrollment(classId, memberId)
      }
      showToast("Đã hủy đăng ký thành công.", "info")
      await loadEnrollments()
      if (onEnrollmentChange) {
        onEnrollmentChange(classId, Math.max(0, enrolled - 1))
      }
    } catch (err) {
      showToast(err?.message || "Lỗi khi hủy đăng ký.", "error")
    }
  }

  const statusConfig = {
    open: {
      label: "Mở đăng ký",
      bg: "bg-[#EBFBEE]",
      text: "text-[#2B8A3E]",
      border: "border-[#D3F9D8]",
    },
    ongoing: {
      label: "Đang diễn ra",
      bg: "bg-[#E7F5FF]",
      text: "text-[#1971C2]",
      border: "border-[#D0EBFF]",
    },
    draft: {
      label: "Bản nháp",
      bg: "bg-[#F1F3F5]",
      text: "text-[#495057]",
      border: "border-[#E9ECEF]",
    },
    closed: {
      label: "Đã kết thúc",
      bg: "bg-[#FFF4E6]",
      text: "text-[#D9480F]",
      border: "border-[#FFE8CC]",
    },
    cancelled: {
      label: "Đã hủy",
      bg: "bg-[#FFF5F5]",
      text: "text-[#C92A2A]",
      border: "border-[#FFE3E3]",
    },
  }

  const statusSource = apiEnabled ? classDetail : cls
  const statusKey = statusSource?.status === "published" ? "open" : statusSource?.status === "completed" ? "closed" : statusSource?.status
  const baseCurrentStatus = statusConfig[statusKey] || {
    label: apiEnabled && !statusSource
      ? classDetailLoading ? "Đang tải trạng thái…" : classDetailError ? "Chưa tải được trạng thái" : "Chưa có thông tin"
      : statusSource?.apiStatus || statusSource?.status || "Chưa có thông tin",
    bg: "bg-stone-100",
    text: "text-stone-500",
    border: "border-stone-200",
  }
  const currentStatus = statusKey === "open" && statusSource?.openingConfirmedAt != null
    ? { ...baseCurrentStatus, label: "Đã xác nhận khai giảng · Còn nhận đăng ký" }
    : baseCurrentStatus

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {!lifecycleActionOnly && <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-stone-900/50 transition-opacity animate-in fade-in duration-200"
      />

      {/* Centered Modal Panel */}
      <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-stone-200/80 pointer-events-auto flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
          {/* HEADER */}
          <div className="px-6 py-4 border-b border-stone-200 bg-stone-50/60 flex items-start justify-between gap-4 shrink-0">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold font-mono bg-stone-200/80 text-stone-700">
                  {apiEnabled ? (cls.code || '—') : (cls.code || 'CLS-' + cls.id)}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${currentStatus.bg} ${currentStatus.text} ${currentStatus.border}`}
                >
                  {currentStatus.label}
                </span>
                <span className="text-xs text-stone-500 font-medium">
                  {cls.category || (apiEnabled ? "—" : "Thể thao")}
                </span>
              </div>
              <h2 className="text-lg font-bold text-stone-900 truncate">
                {cls.nameVi || cls.name}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 rounded-lg transition-colors cursor-pointer"
                title="Đóng (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* CONFLICT WARNING BANNER (Nếu có xung đột) */}
          {conflictInfo?.hasConflict && (
            <div className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-start gap-2.5 shadow-2xs shrink-0">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="font-bold text-rose-800">
                  Cảnh báo xung đột lịch giảng dạy / sân tập
                </p>
                <p className="text-xs text-rose-700 leading-relaxed font-medium">
                  {conflictInfo.message}
                </p>
                <p className="text-[11px] text-rose-600 italic">
                  Vui lòng chỉnh sửa ngày/giờ học hoặc phân công lại HLV/sân tập
                  để giải quyết xung đột.
                </p>
              </div>
            </div>
          )}

          {/* MISSING SCHEDULE / INSUFFICIENT DATA BANNER (Nếu thiếu lịch) */}
          {sessionsError && (
            <div role="alert" className="mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-start gap-2.5 shadow-2xs shrink-0">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="font-bold">Không xác minh được lịch học</p>
                <p className="text-xs leading-relaxed font-medium">{sessionsError}</p>
              </div>
            </div>
          )}
          {apiEnabled && !sessionsLoading && !sessionsError && conflictInfo?.hasScheduleCheckError && (
            <div role="status" className="mx-6 mt-4 p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 shadow-2xs shrink-0">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="font-bold">Chưa kiểm tra được trùng lịch với các lớp khác</p>
                <p className="text-xs leading-relaxed font-medium">Lịch riêng của lớp đã được tải; tải lại danh sách lớp để kiểm tra xung đột toàn trung tâm.</p>
              </div>
            </div>
          )}
          {showMissingScheduleWarning && (
            <div className="mx-6 mt-4 p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 shadow-2xs shrink-0">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <p className="font-bold text-amber-800">
                  Chưa đủ dữ liệu lịch học
                </p>
                <p className="text-xs text-amber-700 leading-relaxed font-medium">
                  {apiEnabled && String(scheduleClassItem?.classType ?? "").trim().toLowerCase() === "normal"
                    ? `Lớp Normal cần đủ ${scheduleClassItem?.totalSessions ?? 12} buổi học hợp lệ; dữ liệu hiện tại chưa đạt điều kiện.`
                    : conflictInfo.message || "Lớp học chưa đủ dữ liệu lịch các buổi học thực tế để kiểm tra trùng lặp."}
                </p>
                <p className="text-[11px] text-amber-600 italic">
                  Vui lòng cập nhật hoặc khởi tạo danh sách các buổi học cho lớp này.
                </p>
              </div>
            </div>
          )}

          {/* SCROLLABLE BODY */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
            <div className="space-y-4">
                {apiEnabled && (
                  <section className="rounded-xl border border-stone-200 bg-white p-4" aria-labelledby="class-lifecycle-heading" aria-busy={classDetailLoading}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 id="class-lifecycle-heading" className="text-sm font-semibold text-stone-900">
                        Vòng đời lớp học
                      </h3>
                      <div className="flex items-center gap-2">
                        {classDetailLoading && <span role="status" className="text-xs text-stone-500">Đang tải…</span>}
                        <button type="button" disabled={classDetailLoading || loading || sessionsLoading} onClick={() => refreshOpeningData()} className="rounded-md border border-stone-300 px-2.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">
                          Tải lại
                        </button>
                      </div>
                    </div>

                    {classDetailError ? (
                      <>
                        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                          <span>Không tải được thông tin vòng đời. {classDetailError}</span>
                          <button type="button" onClick={() => refreshOpeningData({ afterConfirmation: confirmationAccepted })} className="rounded border border-rose-200 bg-white px-2.5 py-1.5 font-semibold hover:bg-rose-50">
                            Tải lại
                          </button>
                        </div>
                        {confirmationAccepted && (
                          <p role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-medium text-amber-900">
                            Hệ thống đã ghi nhận yêu cầu. Vui lòng tải lại dữ liệu nếu trạng thái chưa cập nhật.
                          </p>
                        )}
                      </>
                    ) : classDetailLoading || !classDetail ? (
                      <p className="text-xs text-stone-500">{classDetailLoading ? "Đang tải thông tin lớp…" : "Chưa có thông tin"}</p>
                    ) : (
                      <>
                      <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-xs sm:grid-cols-3">
                        <div>
                          <dt className="text-stone-500">Trạng thái hiện tại</dt>
                          <dd className="mt-1 font-semibold text-stone-900">{currentStatus.label}</dd>
                        </div>
                        <div>
                          <dt className="text-stone-500">Sĩ số tối thiểu / tối đa</dt>
                          <dd className="mt-1 font-semibold tabular-nums text-stone-900">
                            {classDetail.minCapacity == null ? "Chưa có thông tin" : classDetail.minCapacity}
                            {" / "}
                            {classDetail.maxCapacity == null ? "Chưa có thông tin" : classDetail.maxCapacity}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-stone-500">Xác nhận khai giảng</dt>
                          <dd className="mt-1 font-semibold text-stone-900">
                            {classDetail.openingConfirmedAt === undefined
                              ? "Chưa có thông tin"
                              : classDetail.openingConfirmedAt === null
                                ? "Chưa xác nhận"
                                : "Đã xác nhận"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-stone-500">Thời điểm xác nhận</dt>
                          <dd className="mt-1 font-semibold text-stone-900">
                            {formatLifecycleDateTime(classDetail.openingConfirmedAt)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-stone-500">Người xác nhận</dt>
                          <dd className="mt-1 font-semibold tabular-nums text-stone-900">
                            {classDetail.openingConfirmedBy == null ? "Chưa có thông tin" : `Mã người dùng #${classDetail.openingConfirmedBy}`}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-stone-500">Số lần dời khai giảng</dt>
                          <dd className="mt-1 font-semibold tabular-nums text-stone-900">
                            {classDetail.postponementCount == null ? "Chưa có thông tin" : classDetail.postponementCount}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-stone-500">Phương án thay đổi đang chờ</dt>
                          <dd className="mt-1 font-semibold text-stone-900">
                            {classDetail.changePending === true ? "Có" : classDetail.changePending === false ? "Không" : "Chưa có thông tin"}
                          </dd>
                        </div>
                      </dl>
                      {String(classDetail?.classType ?? "").trim().toLowerCase() === "normal" && (
                        <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-stone-500">Member hợp lệ (Registered + Paid)</div>
                              <div className="mt-1 font-semibold tabular-nums text-stone-900">
                                {!hasAuthoritativePaidCount
                                  ? "Chưa xác minh"
                                  : `${openingEvaluation.paidRegisteredCount ?? "Chưa xác minh"}${classDetail.minCapacity == null ? "" : ` / ${classDetail.minCapacity}`}`}
                              </div>
                            </div>
                            <div>
                              <div className="text-stone-500">Buổi học đầu tiên</div>
                              <div className="mt-1 font-semibold text-stone-900">
                                {sessionsLoading || sessionsError ? "Chưa xác minh" : formatOpeningSession(firstOpeningSession)}
                              </div>
                            </div>
                          </div>
                          {openingEvaluation.blockers.length > 0 && openingEvaluation.openingConfirmationAllowed !== true ? (
                            <p className="mt-3 text-amber-800">{openingEvaluation.blockers[0]}</p>
                          ) : (
                            <p className="mt-3 text-stone-600">
                              {openingEvaluation.unverified.length > 0
                                ? "Hệ thống sẽ thẩm định và hoàn tất điều kiện khi gửi yêu cầu."
                                : "Hệ thống sẽ xác nhận điều kiện khi gửi yêu cầu."}
                            </p>
                          )}
                          {sessionsError && <p role="alert" className="mt-2 text-rose-700">Không tải được lịch học: {sessionsError}</p>}
                          {enrollmentLoadFailed && <p role="alert" className="mt-2 text-rose-700">Không tải được enrollment và trạng thái thanh toán.</p>}

                          {openingRefreshWarning && (
                            <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-amber-900">
                              <span>{openingRefreshWarning}</span>
                              <button type="button" disabled={classDetailLoading || loading || sessionsLoading} onClick={() => refreshOpeningData({ afterConfirmation: confirmationAccepted })} className="rounded border border-amber-300 bg-white px-2.5 py-1.5 font-semibold disabled:opacity-50">
                                Tải lại dữ liệu
                              </button>
                            </div>
                          )}

                          {confirmationAccepted && (
                            <p role="status" className="mt-3 font-medium text-emerald-800">
                              Hệ thống đã nhận yêu cầu xác nhận và đang cập nhật trạng thái mới.
                            </p>
                          )}

                          {canShowOpeningAction && !confirmationAccepted && (
                            <button
                              type="button"
                              disabled={openingSubmitting || classDetailLoading || loading || sessionsLoading || openingActionBlockers.length > 0}
                              onClick={() => { setOpeningActionError(null); setOpeningReason(""); setOpeningDialogOpen(true) }}
                              className="mt-3 inline-flex min-h-9 items-center justify-center rounded-lg bg-indigo-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Xác nhận khai giảng
                            </button>
                          )}
                        </div>
                      )}
                      </>
                    )}
                  </section>
                )}

                <div ref={lifecyclePanelRef}>
                <NormalClassLifecyclePanel
                  classItem={classDetail ?? cls}
                  initialKind={initialLifecycleKind}
                  initialAction={initialLifecycleAction}
                  sessions={sessions}
                  sessionsLoading={sessionsLoading}
                  sessionsError={sessionsError}
                  onRefreshClassDetail={() => refreshOpeningData()}
                />
                </div>
            </div>
          </div>

          {/* STICKY FOOTER ACTIONS */}
          <div className="px-6 py-4 bg-white border-t border-stone-200 flex items-center justify-between gap-2 shrink-0 shadow-xs">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 border border-stone-200 hover:bg-stone-50 rounded-xl text-xs font-semibold text-stone-700 transition-colors cursor-pointer"
            >
              Đóng
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onDuplicate && onDuplicate(cls)}
                className="h-9 px-3.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Nhân bản sang khóa học mới"
              >
                <Copy className="w-3.5 h-3.5 text-stone-600" />
                <span>Nhân bản</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      </>}
      {lifecycleActionOnly && initialLifecycleAction !== "opening" && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/45 p-4" onClick={onClose} role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="lifecycle-action-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="lifecycle-action-title" className="text-base font-bold text-stone-900">{lifecycleActionTitle}</h2>
                <p className="mt-1 text-sm text-stone-600">{classDetail?.name || cls.name}</p>
              </div>
              <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100" aria-label="Đóng">
                <X className="h-4 w-4" />
              </button>
            </div>
            <NormalClassLifecyclePanel
              classItem={classDetail ?? cls}
              initialKind={initialLifecycleKind}
              initialAction={initialLifecycleAction}
              sessions={sessions}
              sessionsLoading={sessionsLoading}
              sessionsError={sessionsError}
              onRefreshClassDetail={() => refreshOpeningData()}
            />
          </div>
        </div>
      )}
      {openingDialogOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/45 p-4" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="opening-confirm-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="opening-confirm-title" className="text-base font-bold text-stone-900">Xác nhận khai giảng</h3>
                <p className="mt-1 text-sm text-stone-600">{classDetail?.name || cls.name}</p>
              </div>
              <button type="button" disabled={openingSubmitting} onClick={dismissOpeningDialog} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 disabled:opacity-50" aria-label="Đóng hộp xác nhận">
                <X className="h-4 w-4" />
              </button>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs" aria-busy={openingDataLoading}>
              <div>
                <dt className="text-stone-500">Buổi học đầu tiên</dt>
                <dd className="mt-1 font-semibold text-stone-900">
                  {sessionsLoading ? "Đang tải…" : sessionsError ? "Không tải được" : formatOpeningSession(firstOpeningSession)}
                </dd>
              </div>
            </dl>

            {!openingDataLoading && (enrollmentLoadFailed || sessionsError) && (
              <p role="alert" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                {[enrollmentLoadFailed && "Không tải được danh sách học viên.", sessionsError && `Không tải được lịch học: ${sessionsError}`].filter(Boolean).join(" ")}
                <button type="button" disabled={openingSubmitting} onClick={() => refreshOpeningData()} className="ml-2 font-semibold underline disabled:opacity-50">Tải lại</button>
              </p>
            )}

            {openingDataLoading ? (
              <p role="status" className="mt-3 text-center text-xs text-stone-500">Đang tải thông tin khai giảng…</p>
            ) : openingEnrollmentShortfall ? (
              <p role="status" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                Chưa đủ sĩ số.
              </p>
            ) : !canShowOpeningAction ? (
              <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                {classDetailError || openingEvaluation.blockers[0] || "Lớp hiện không đủ điều kiện xác nhận khai giảng."}
              </p>
            ) : openingEvaluation.blockers.length > 0 && openingEvaluation.openingConfirmationAllowed !== true ? (
              <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                {openingEvaluation.blockers[0]}
              </p>
            ) : null}

            {openingEvaluation.reasonRequired === true && (
              <label className="mt-4 block text-xs font-semibold text-stone-700">
                Lý do xác nhận trễ <span className="text-rose-600">*</span>
                <textarea
                  autoFocus
                  required
                  value={openingReason}
                  onChange={(event) => { setOpeningReason(event.target.value); setOpeningActionError(null) }}
                  rows={3}
                  className="mt-1.5 w-full resize-y rounded-lg border border-stone-300 px-3 py-2 text-sm font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Nhập lý do xác nhận trong 24 giờ trước buổi đầu tiên"
                />
              </label>
            )}

            {openingActionError && (
              <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <p>{openingActionError.message}</p>
                {(openingActionError.status || openingActionError.code) && (
                  <p className="mt-1 text-[11px] text-rose-700">
                    {openingActionError.status ? `HTTP ${openingActionError.status}` : ""}{openingActionError.code ? ` · ${openingActionError.code}` : ""}
                  </p>
                )}
                {openingActionError.status === 409 && (
                  <button type="button" disabled={classDetailLoading || loading || sessionsLoading} onClick={() => refreshOpeningData()} className="mt-2 rounded-md border border-rose-300 bg-white px-2.5 py-1.5 font-semibold disabled:opacity-50">
                    Tải lại lớp, enrollment và lịch
                  </button>
                )}
                {openingActionError.uncertain && (
                  <button type="button" disabled={openingSubmitting || openingDataLoading} onClick={() => reconcileOpeningAfterUncertainSubmit()} className="mt-2 rounded-md border border-rose-300 bg-white px-2.5 py-1.5 font-semibold disabled:opacity-50">
                    Kiểm tra trạng thái lớp
                  </button>
                )}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={openingSubmitting} onClick={dismissOpeningDialog} className="rounded-lg border border-stone-300 px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-50">
                Hủy
              </button>
              <button type="button" disabled={openingSubmitting || openingDataLoading || !canShowOpeningAction || !openingSubmitReady} onClick={submitOpeningConfirmation} className="rounded-lg bg-indigo-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50">
                {openingActionError?.uncertain && openingDataLoading ? "Đang kiểm tra trạng thái…" : openingSubmitting ? "Đang xác nhận…" : openingDataLoading ? "Đang tải…" : "Xác nhận khai giảng"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ClassDetailDrawer
