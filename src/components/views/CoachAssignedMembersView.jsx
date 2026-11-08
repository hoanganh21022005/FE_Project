import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useSCMS } from "../../context/SCMSContext"
import { CoachStatusBadge } from "../coach/StatusBadge"
import { formatMemberCode } from "../../utils/formatMember"
import { memberApi } from "../../api/memberApi"
import { memberPortalApi } from "../../api/memberPortalApi"
import { getErrorMessage, getFriendlyError } from "../../api/apiErrors"
import { parseVietnamDateTime } from "../../utils/memberSafetyHelpers"
import {
  canCoachActOnPackage,
  getPackageActionBlockReason,
} from "../../utils/permissions"
import {
  Users,
  Dumbbell,
  Award,
  CalendarPlus,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  Lock,
  Search,
} from "lucide-react"

function isPositiveInteger(val) {
  if (typeof val === "number") return Number.isInteger(val) && val > 0
  if (typeof val === "string") {
    const s = val.trim()
    if (!/^\d+$/.test(s)) return false
    const n = Number(s)
    return Number.isInteger(n) && n > 0
  }
  return false
}

function generateRequestKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function isValidTimeFormat(val) {
  if (typeof val !== "string") return false
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(val.trim())
}

function normalizeStrictTime(val) {
  if (!isValidTimeFormat(val)) return null
  const s = val.trim()
  return s.length === 5 ? `${s}:00` : s
}

function formatVietnamDateTime(val) {
  const ms = parseVietnamDateTime(val)
  if (Number.isNaN(ms)) return "—"
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms))
}

function formatVietnamDateOnly(val) {
  const ms = parseVietnamDateTime(val)
  if (Number.isNaN(ms)) return "—"
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms))
}

function getVietnamDatePlusDays(days = 2) {
  const now = new Date()
  const targetMs = now.getTime() + days * 24 * 60 * 60 * 1000
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(targetMs))
}

function checkRegistrationEntitlement(item, currentUser) {
  if (!item) return { canBook: false, reason: "Dữ liệu đăng ký không tồn tại" }

  if (!isPositiveInteger(item.subscriptionId)) {
    return { canBook: false, reason: "Chưa liên kết gói tập" }
  }
  if (!isPositiveInteger(item.memberId)) {
    return { canBook: false, reason: "Mã học viên không hợp lệ" }
  }
  if (!isPositiveInteger(item.subjectId)) {
    return { canBook: false, reason: "Mã môn học không hợp lệ" }
  }
  if (!isPositiveInteger(item.primaryCoachId)) {
    return { canBook: false, reason: "Mã HLV phụ trách không hợp lệ" }
  }

  const currentCoachId = currentUser?.coachId ?? currentUser?.userId ?? currentUser?.id
  const coachNameMatches =
    !isPositiveInteger(currentUser?.coachId) &&
    item.primaryCoachName &&
    currentUser?.name &&
    String(item.primaryCoachName).trim().toLowerCase() ===
      String(currentUser.name).trim().toLowerCase()
  if (
    !coachNameMatches &&
    (!isPositiveInteger(currentCoachId) ||
      Number(item.primaryCoachId) !== Number(currentCoachId))
  ) {
    return { canBook: false, reason: "Không phải HLV phụ trách gói này" }
  }

  const st = String(item.subscriptionStatus || "").trim().toLowerCase()
  if (st !== "active") {
    return { canBook: false, reason: `Gói chưa kích hoạt (${item.subscriptionStatus || "Chờ xử lý"})` }
  }

  const credit = Number(item.remainingCredit)
  if (!Number.isInteger(credit) || credit < 1) {
    return { canBook: false, reason: "Hết số buổi khả dụng (0 credit)" }
  }

  const activatedMs = parseVietnamDateTime(item.activatedAt)
  if (Number.isNaN(activatedMs)) {
    return { canBook: false, reason: "Thiếu ngày kích hoạt gói" }
  }

  const expiresMs = parseVietnamDateTime(item.expiresAt)
  if (Number.isNaN(expiresMs)) {
    return { canBook: false, reason: "Thiếu ngày hết hạn gói" }
  }
  if (expiresMs <= Date.now()) {
    return { canBook: false, reason: "Gói tập đã hết hạn" }
  }

  return { canBook: true, reason: "" }
}

export function isRoomAvailable(room, isApi = true) {
  if (!room || typeof room !== "object") return false
  if (!isApi) {
    const s = String(room.status || "").trim().toLowerCase()
    return s !== "closed" && s !== "maintenance"
  }
  const s = String(room.status || "").trim().toLowerCase()
  return s === "available"
}

export function formatRoomOptionLabel(room) {
  if (!room || typeof room !== "object") return ""
  const code = room.roomCode ? String(room.roomCode).trim() : ""
  const name = room.name || `Sân #${room.id ?? ""}`
  return code ? `${code} - ${name}` : name
}

export function verifySessionResponseMatch(resp, payload, regItem) {
  if (!resp || typeof resp !== "object") {
    return { valid: false, reason: "Phản hồi không hợp lệ. Vui lòng thử lại." }
  }
  if (!isPositiveInteger(resp.id)) {
    return { valid: false, reason: "Không nhận được mã buổi tập hợp lệ. Vui lòng thử lại." }
  }

  // 1. Coach ID (bắt buộc có và khớp)
  if (resp.coachId === undefined || resp.coachId === null || Number(resp.coachId) !== Number(payload.coachId)) {
    return {
      valid: false,
      reason: `HLV xác nhận (#${resp.coachId ?? "thiếu"}) không khớp yêu cầu (#${payload.coachId}).`,
    }
  }

  // 2. Room ID (bắt buộc có và khớp)
  if (resp.roomId === undefined || resp.roomId === null || Number(resp.roomId) !== Number(payload.roomId)) {
    return {
      valid: false,
      reason: `Phòng tập xác nhận (#${resp.roomId ?? "thiếu"}) không khớp yêu cầu (#${payload.roomId}).`,
    }
  }

  // 3. Member ID (bắt buộc có bookedMemberId thật và khớp, bỏ hoàn toàn fallback memberId)
  if (resp.bookedMemberId === undefined || resp.bookedMemberId === null || !isPositiveInteger(resp.bookedMemberId)) {
    return {
      valid: false,
      reason: `Phản hồi xác nhận thiếu thông tin học viên (bookedMemberId).`,
    }
  }
  if (Number(resp.bookedMemberId) !== Number(regItem.memberId)) {
    return {
      valid: false,
      reason: `Học viên xác nhận (#${resp.bookedMemberId}) không khớp yêu cầu (#${regItem.memberId}).`,
    }
  }

  // 4. Subject ID (nếu yêu cầu có môn thì xác nhận phải khớp)
  if (payload.subjectId !== undefined && payload.subjectId !== null) {
    if (resp.subjectId === undefined || resp.subjectId === null || Number(resp.subjectId) !== Number(payload.subjectId)) {
      return {
        valid: false,
        reason: `Môn thể thao (#${resp.subjectId ?? "thiếu"}) không khớp yêu cầu (#${payload.subjectId}).`,
      }
    }
  }

  // 5. Session Date (bắt buộc có và khớp ngày)
  if (!resp.sessionDate || String(resp.sessionDate).slice(0, 10) !== String(payload.sessionDate).slice(0, 10)) {
    return {
      valid: false,
      reason: `Ngày tập xác nhận (${resp.sessionDate ?? "thiếu"}) không khớp yêu cầu (${payload.sessionDate}).`,
    }
  }

  // 6. Start Time (bắt buộc có và khớp giờ)
  if (
    !resp.startTime ||
    !isValidTimeFormat(resp.startTime) ||
    normalizeStrictTime(resp.startTime) !== normalizeStrictTime(payload.startTime)
  ) {
    return {
      valid: false,
      reason: `Giờ bắt đầu xác nhận (${resp.startTime ?? "thiếu"}) không khớp yêu cầu (${payload.startTime}).`,
    }
  }

  // 7. End Time (bắt buộc có và khớp giờ)
  if (
    !resp.endTime ||
    !isValidTimeFormat(resp.endTime) ||
    normalizeStrictTime(resp.endTime) !== normalizeStrictTime(payload.endTime)
  ) {
    return {
      valid: false,
      reason: `Giờ kết thúc xác nhận (${resp.endTime ?? "thiếu"}) không khớp yêu cầu (${payload.endTime}).`,
    }
  }

  // 8. isPrivate (bắt buộc phải là true)
  if (resp.isPrivate !== true) {
    return {
      valid: false,
      reason: "Buổi tập không được ghi nhận là ca tập riêng 1-kèm-1 (isPrivate phải là true).",
    }
  }

  // 9. Status (bắt buộc hiện diện và phải là Scheduled)
  if (!resp.status || typeof resp.status !== "string") {
    return {
      valid: false,
      reason: "Phản hồi xác nhận thiếu trạng thái buổi tập (status).",
    }
  }
  const st = resp.status.trim()
  if (st.toLowerCase() !== "scheduled") {
    return {
      valid: false,
      reason: `Trạng thái buổi tập không hợp lệ hoặc không khả dụng (${st}). Yêu cầu trạng thái 'Scheduled'.`,
    }
  }

  return { valid: true }
}

export function CoachAssignedMembersView() {
  const {
    currentUser,
    rooms: contextRooms,
    setCurrentTab,
    apiEnabled,
    showToast,
    t,
    language,
  } = useSCMS()
  const navigate = useNavigate()

  const [, setAtRiskIds] = useState(new Set())
  const [advancedRequests, setAdvancedRequests] = useState([])
  const [coachSessions, setCoachSessions] = useState([])
  const [coachTrainingResults, setCoachTrainingResults] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [requestsError, setRequestsError] = useState(null)
  const [decidingId, setDecidingId] = useState(null)
  const [rejectModalTarget, setRejectModalTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState("")
  const [rejectReasonError, setRejectReasonError] = useState("")
  const isProcessingRef = useRef(false)

  // Booking Modal State (Mục 6 / D04)
  const [bookingReg, setBookingReg] = useState(null)
  const [bookingDate, setBookingDate] = useState(() => getVietnamDatePlusDays(2))
  const [selectedRoomId, setSelectedRoomId] = useState("")
  const [roomsList, setRoomsList] = useState(() => {
    if (!Array.isArray(contextRooms)) return []
    if (!apiEnabled) {
      return contextRooms.filter((r) => isRoomAvailable(r, false))
    }
    return contextRooms.filter((r) => isPositiveInteger(r.id) && isRoomAvailable(r, true))
  })
  const [loadingRooms, setLoadingRooms] = useState(false)
  const [roomsError, setRoomsError] = useState(null)

  const [availableSlots, setAvailableSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [slotsError, setSlotsError] = useState(null)
  const slotsRequestIdRef = useRef(0)
  const modalSessionRef = useRef(0)
  const currentOpenSubIdRef = useRef(null)

  const [agreementConfirmed, setAgreementConfirmed] = useState(false)
  const [bookingBusy, setBookingBusy] = useState(false)
  const isSubmittingRef = useRef(false)

  // Persisted Attempts Map by Subscription ID: { [subscriptionId]: AttemptObject }
  const [attemptsBySubId, setAttemptsBySubId] = useState({})
  const attemptsBySubIdRef = useRef(attemptsBySubId)
  attemptsBySubIdRef.current = attemptsBySubId
  const [requestKey, setRequestKey] = useState(() => generateRequestKey())
  const [readbackError, setReadbackError] = useState(false)

  const loadAdvancedRequests = useCallback(async () => {
    if (!apiEnabled) return
    setLoadingRequests(true)
    setRequestsError(null)
    try {
      const list = await memberPortalApi.getAdvancedRegistrations()
      setAdvancedRequests(Array.isArray(list) ? list : [])
      setReadbackError(false)
    } catch (err) {
      setRequestsError(getErrorMessage(err, "Không thể tải danh sách đăng ký 1-kèm-1."))
      throw err
    } finally {
      setLoadingRequests(false)
    }
  }, [apiEnabled])

  // Load rooms with validation & return valid list
  const loadRooms = useCallback(async () => {
    if (!apiEnabled) {
      return []
    }
    setLoadingRooms(true)
    setRoomsError(null)
    try {
      const list = await memberPortalApi.getRooms()
      const valid = Array.isArray(list)
        ? list.filter((r) => isPositiveInteger(r.id) && isRoomAvailable(r, true))
        : []
      setRoomsList(valid)
      return valid
    } catch (err) {
      setRoomsError(getErrorMessage(err, "Không thể tải danh sách phòng tập."))
      setRoomsList([])
      return []
    } finally {
      setLoadingRooms(false)
    }
  }, [apiEnabled, contextRooms])

  useEffect(() => {
    if (!apiEnabled) return
    let active = true
    const resolvedCoachId = currentUser?.coachId || currentUser?.id
    memberApi
      .getCoachAtRiskMembers()
      .then((list) => {
        if (!active || !Array.isArray(list)) return
        setAtRiskIds(new Set(list.map((item) => String(item.memberId))))
      })
      .catch(() => {})
    memberPortalApi
      .getClassSessions(resolvedCoachId ? { coachId: resolvedCoachId } : {})
      .then((list) => {
        if (!active || !Array.isArray(list)) return
        setCoachSessions(list)
      })
      .catch(() => {})
    memberPortalApi
      .getTrainingResults(resolvedCoachId ? { coachId: resolvedCoachId } : {})
      .then((list) => {
        if (!active || !Array.isArray(list)) return
        setCoachTrainingResults(list)
      })
      .catch(() => {})
    loadAdvancedRequests().catch(() => {})
    loadRooms().catch(() => {})
    return () => {
      active = false
    }
  }, [apiEnabled, loadAdvancedRequests, loadRooms, currentUser?.coachId, currentUser?.id])

  // Fetch slots for modal with strict token check
  const fetchAvailableSlots = useCallback(
    async (date, roomId, reg) => {
      const reqId = ++slotsRequestIdRef.current
      const currentModalSession = modalSessionRef.current

      setSelectedSlot(null)
      setSlotsError(null)
      setAvailableSlots([])
      setLoadingSlots(true)

      if (!apiEnabled) {
        setLoadingSlots(false)
        return
      }

      const coachIdNum = Number(
        reg?.primaryCoachId || currentUser?.coachId || currentUser?.userId || currentUser?.id,
      )
      const roomIdNum = Number(roomId)
      const subjectIdNum = isPositiveInteger(reg?.subjectId) ? Number(reg.subjectId) : undefined

      if (!isPositiveInteger(coachIdNum) || !isPositiveInteger(roomIdNum) || !date) {
        setLoadingSlots(false)
        return
      }

      try {
        const slots = await memberPortalApi.getCoachAvailableSlots(coachIdNum, date, {
          roomId: roomIdNum,
          ...(subjectIdNum ? { subjectId: subjectIdNum } : {}),
        })
        if (reqId !== slotsRequestIdRef.current || currentModalSession !== modalSessionRef.current) return
        const rawSlots = Array.isArray(slots) ? slots : []
        const validSlots = rawSlots.filter(
          (s) => s && isValidTimeFormat(s.startTime) && isValidTimeFormat(s.endTime),
        )
        setAvailableSlots(validSlots)
        const firstAvail = validSlots.find((s) => s.isAvailable === true)
        if (firstAvail) {
          setSelectedSlot(firstAvail)
        }
      } catch (err) {
        if (reqId !== slotsRequestIdRef.current || currentModalSession !== modalSessionRef.current) return
        setSlotsError(getErrorMessage(err, "Không thể tải danh sách ca trống."))
        setAvailableSlots([])
        setSelectedSlot(null)
      } finally {
        if (reqId === slotsRequestIdRef.current && currentModalSession === modalSessionRef.current) {
          setLoadingSlots(false)
        }
      }
    },
    [apiEnabled, currentUser],
  )

  const openRejectModal = (reqItem) => {
    setRejectModalTarget(reqItem)
    setRejectReason("")
    setRejectReasonError("")
  }

  const handleConfirmReject = async (e) => {
    if (e) e.preventDefault()
    if (!rejectModalTarget) return
    const trimmed = rejectReason.trim()
    if (trimmed.length < 5) {
      setRejectReasonError(t("coachPtRejectReasonMinError"))
      return
    }
    setRejectReasonError("")
    const target = rejectModalTarget
    setRejectModalTarget(null)
    await handleCoachDecision(target, "REJECT", trimmed)
  }

  // Handle Coach Decision (APPROVE / REJECT)
  const handleCoachDecision = async (reqItem, decision, customReason) => {
    if (!reqItem?.id) return
    if (decision !== "APPROVE" && decision !== "REJECT") return

    const st = String(reqItem.status || "").toLowerCase()
    if (!st.includes("pending") && !st.includes("request")) {
      showToast?.("Yêu cầu này không ở trạng thái chờ duyệt.", "info")
      return
    }

    if (decision === "REJECT" && (!customReason || String(customReason).trim().length < 5)) {
      openRejectModal(reqItem)
      return
    }

    if (isProcessingRef.current || decidingId === reqItem.id) return
    isProcessingRef.current = true
    setDecidingId(reqItem.id)

    const accepted = decision === "APPROVE"
    const reason = accepted
      ? "Coach đồng ý nhận học viên PT 1-kèm-1"
      : String(customReason).trim()

    try {
      const response = await memberPortalApi.decideAdvancedRegistration(
        reqItem.id,
        {
          accepted,
          reason,
        },
      )

      const respStatus = String(response?.status || "").toUpperCase()
      if (accepted) {
        if (respStatus === "ACCEPTED" || !response?.status) {
          showToast?.(t("coachPtDecisionAcceptedToast"), "success")
        } else {
          showToast?.(
            `Trạng thái phản hồi không như mong đợi (${response?.status || "Không xác định"}). Vui lòng thử lại.`,
            "error",
          )
        }
      } else {
        if (respStatus === "REJECTED" || respStatus === "DECLINED" || !response?.status) {
          showToast?.(t("coachPtDecisionRejectedToast"), "info")
        } else {
          showToast?.(
            `Trạng thái phản hồi không như mong đợi (${response?.status || "Không xác định"}). Vui lòng thử lại.`,
            "warning",
          )
        }
      }

      await loadAdvancedRequests()
    } catch (err) {
      showToast?.(
        getErrorMessage(err, "Không thể xử lý yêu cầu đăng ký HLV."),
        "error",
      )
    } finally {
      isProcessingRef.current = false
      setDecidingId(null)
    }
  }

  // Active attempt for current modal
  const currentSubId = bookingReg ? Number(bookingReg.subscriptionId) : null
  const currentAttempt = currentSubId ? attemptsBySubId[currentSubId] : null

  // Global unresolved attempt across all subscriptions (chỉ khóa các gói khác khi có giao dịch uncertain cần đối soát)
  const unresolvedAttempt = useMemo(() => {
    return Object.values(attemptsBySubId).find((a) => a.status === "uncertain")
  }, [attemptsBySubId])

  // Open modal for booking
  const openBookPrivateModal = async (regItem) => {
    if (!regItem) return
    const targetSubId = Number(regItem.subscriptionId)

    // Check if there is an unresolved attempt on ANOTHER subscription
    if (unresolvedAttempt && unresolvedAttempt.subscriptionId !== targetSubId) {
      showToast?.(
        `Đang có giao dịch đặt lịch chưa xác nhận kết quả cho học viên ${
          unresolvedAttempt.memberName || `#${unresolvedAttempt.memberId}`
        } (Gói #${unresolvedAttempt.subscriptionId}). Vui lòng đối soát giao dịch này trước khi đặt lịch mới.`,
        "warning",
      )
      return
    }

    const openSession = ++modalSessionRef.current
    currentOpenSubIdRef.current = targetSubId
    setBookingReg(regItem)
    setSlotsError(null)

    const existingAttempt = attemptsBySubId[targetSubId]

    if (
      existingAttempt &&
      (existingAttempt.status === "uncertain" || existingAttempt.status === "pending")
    ) {
      // Restore exact snapshot in read-only review mode
      setBookingDate(existingAttempt.sessionDate)
      setSelectedRoomId(String(existingAttempt.roomId))
      setSelectedSlot(existingAttempt.selectedSlot)
      setAgreementConfirmed(true)
      setRequestKey(existingAttempt.key || existingAttempt.requestKey)
      return
    }

    // New attempt
    const defaultDate = getVietnamDatePlusDays(2)
    setBookingDate(defaultDate)
    setAgreementConfirmed(false)
    setSelectedSlot(null)
    setRequestKey(generateRequestKey())

    let currentRooms = roomsList
    if (apiEnabled && (!currentRooms || currentRooms.length === 0)) {
      const fetched = await loadRooms()
      if (openSession !== modalSessionRef.current || currentOpenSubIdRef.current !== targetSubId) return
      currentRooms = fetched
    }

    const initialRoomId = currentRooms && currentRooms.length > 0 ? String(currentRooms[0].id) : ""
    setSelectedRoomId(initialRoomId)

    if (initialRoomId) {
      fetchAvailableSlots(defaultDate, initialRoomId, regItem)
    }
  }

  // Close modal
  const handleCloseModal = () => {
    modalSessionRef.current += 1
    slotsRequestIdRef.current += 1
    currentOpenSubIdRef.current = null
    setBookingReg(null)
    setAvailableSlots([])
    setSelectedSlot(null)
    setSlotsError(null)
    setLoadingSlots(false)
  }

  // Retry loading rooms
  const handleRetryRooms = async () => {
    const retrySession = modalSessionRef.current
    const targetSubId = bookingReg ? Number(bookingReg.subscriptionId) : null
    const targetDate = bookingDate
    const targetReg = bookingReg

    const valid = await loadRooms()

    // Bắt buộc kiểm tra token và identity sau await
    if (
      retrySession !== modalSessionRef.current ||
      !currentOpenSubIdRef.current ||
      currentOpenSubIdRef.current !== targetSubId ||
      !targetReg
    ) {
      return
    }

    // Bảo toàn giao dịch đang đối soát:
    // Đọc attempt mới nhất từ attemptsBySubIdRef để tránh stale closure sau await loadRooms
    const latestAttempt = targetSubId ? attemptsBySubIdRef.current[targetSubId] : null
    const isLockedAttempt =
      latestAttempt &&
      (latestAttempt.status === "uncertain" || latestAttempt.status === "pending")
    if (isLockedAttempt) {
      return
    }

    const stillAvailable = valid.some((r) => String(r.id) === String(selectedRoomId))
    if (stillAvailable && selectedRoomId) {
      fetchAvailableSlots(targetDate, selectedRoomId, targetReg)
    } else if (valid.length > 0) {
      const firstRoomId = String(valid[0].id)
      setSelectedRoomId(firstRoomId)
      fetchAvailableSlots(targetDate, firstRoomId, targetReg)
    } else {
      setSelectedRoomId("")
      setAvailableSlots([])
      setSelectedSlot(null)
    }
  }

  // Change Date
  const handleDateChange = (newDate) => {
    if (
      currentAttempt &&
      (currentAttempt.status === "uncertain" || currentAttempt.status === "pending")
    )
      return
    setBookingDate(newDate)
    // Clear any previous schedule conflict
    if (currentAttempt && currentAttempt.status === "schedule_conflict") {
      setAttemptsBySubId((prev) => {
        const next = { ...prev }
        delete next[currentSubId]
        return next
      })
      setRequestKey(generateRequestKey())
    }
    if (bookingReg && selectedRoomId) {
      fetchAvailableSlots(newDate, selectedRoomId, bookingReg)
    }
  }

  // Change Room
  const handleRoomChange = (newRoomId) => {
    if (
      currentAttempt &&
      (currentAttempt.status === "uncertain" || currentAttempt.status === "pending")
    )
      return
    setSelectedRoomId(newRoomId)
    // Clear any previous schedule conflict
    if (currentAttempt && currentAttempt.status === "schedule_conflict") {
      setAttemptsBySubId((prev) => {
        const next = { ...prev }
        delete next[currentSubId]
        return next
      })
      setRequestKey(generateRequestKey())
    }
    if (bookingReg && newRoomId) {
      fetchAvailableSlots(bookingDate, newRoomId, bookingReg)
    }
  }

  // Select Slot
  const handleSelectSlot = (slot) => {
    if (
      currentAttempt &&
      (currentAttempt.status === "uncertain" || currentAttempt.status === "pending")
    )
      return
    setSelectedSlot(slot)
    // Clear any previous schedule conflict
    if (currentAttempt && currentAttempt.status === "schedule_conflict") {
      setAttemptsBySubId((prev) => {
        const next = { ...prev }
        delete next[currentSubId]
        return next
      })
      setRequestKey(generateRequestKey())
    }
  }

  // Handle Book Private Session Submit
  const handleBookPrivateSession = async (e) => {
    if (e) e.preventDefault()
    if (isSubmittingRef.current || bookingBusy) return
    if (!bookingReg) return

    const attemptSubId = Number(bookingReg.subscriptionId)

    // Tách biệt hoàn toàn retry snapshot của attempt đã lưu khỏi validation tạo booking mới
    const isRetrySnapshot = Boolean(
      currentAttempt &&
        (currentAttempt.status === "uncertain" || currentAttempt.status === "pending") &&
        currentAttempt.payload &&
        Number(currentAttempt.payload.subscriptionId) === attemptSubId,
    )

    let reqKey = requestKey
    let payloadToSubmit = null

    if (isRetrySnapshot) {
      // Dùng lại chính xác snapshot và key đã lưu
      reqKey = currentAttempt.key || currentAttempt.payload.requestKey
      payloadToSubmit = currentAttempt.payload
    } else if (apiEnabled) {
      // 1. Re-validate Entitlement (chỉ khi API mode tạo booking mới)
      const entitlement = checkRegistrationEntitlement(bookingReg, currentUser)
      if (!entitlement.canBook) {
        showToast?.(`Không đủ điều kiện đặt lịch: ${entitlement.reason}`, "error")
        return
      }

      // 2. Validate Room
      if (!isPositiveInteger(selectedRoomId)) {
        showToast?.("Vui lòng chọn phòng / sân tập hợp lệ.", "warning")
        return
      }
      const selectedRoom = roomsList.find(
        (r) => isPositiveInteger(r.id) && Number(r.id) === Number(selectedRoomId),
      )
      if (!selectedRoom || !isRoomAvailable(selectedRoom, true)) {
        showToast?.("Phòng tập đã chọn không tồn tại hoặc không khả dụng (chỉ chấp nhận phòng Available).", "error")
        return
      }

      // 3. Validate Slot
      if (
        !selectedSlot ||
        !isValidTimeFormat(selectedSlot.startTime) ||
        !isValidTimeFormat(selectedSlot.endTime)
      ) {
        showToast?.("Vui lòng chọn một ca tập trống khả dụng.", "warning")
        return
      }

      // 4. Validate Agreement
      if (!agreementConfirmed) {
        showToast?.("Vui lòng xác nhận đã thống nhất lịch tập với học viên.", "warning")
        return
      }

      const startTime = normalizeStrictTime(selectedSlot.startTime)
      const endTime = normalizeStrictTime(selectedSlot.endTime)

      // 5. Validate 12h Lead Time (Vietnam Time)
      const sessionStartMs = parseVietnamDateTime(`${bookingDate}T${startTime}`)
      if (Number.isNaN(sessionStartMs)) {
        showToast?.("Thời gian bắt đầu ca tập không hợp lệ.", "error")
        return
      }
      const nowMs = Date.now()
      if (sessionStartMs - nowMs < 12 * 60 * 60 * 1000) {
        showToast?.(
          "Yêu cầu đặt lịch trước tối thiểu 12 tiếng theo giờ Việt Nam.",
          "warning",
        )
        return
      }

      // 6. Validate End Time <= ExpiresAt (Vietnam Time)
      const sessionEndMs = parseVietnamDateTime(`${bookingDate}T${endTime}`)
      if (Number.isNaN(sessionEndMs)) {
        showToast?.("Thời gian kết thúc ca tập không hợp lệ.", "error")
        return
      }
      const expiryMs = parseVietnamDateTime(bookingReg.expiresAt)
      if (Number.isNaN(expiryMs) || sessionEndMs > expiryMs) {
        showToast?.(
          `Thời gian buổi tập vượt quá thời hạn sử dụng gói (${formatVietnamDateTime(bookingReg.expiresAt)}).`,
          "warning",
        )
        return
      }

      if (!reqKey) {
        reqKey = generateRequestKey()
        setRequestKey(reqKey)
      }
      const coachIdNum = Number(
        bookingReg.primaryCoachId ||
          currentUser?.coachId ||
          currentUser?.userId ||
          currentUser?.id,
      )
      payloadToSubmit = {
        subscriptionId: attemptSubId,
        coachId: coachIdNum,
        roomId: Number(selectedRoomId),
        subjectId: Number(bookingReg.subjectId),
        sessionDate: bookingDate,
        startTime,
        endTime,
        agreementConfirmed: true,
        requestKey: reqKey,
      }
    } else {
      // Mock mode validation (không ép mock IDs mem-1/stf-3 thành ID số)
      if (!selectedRoomId) {
        showToast?.("Vui lòng chọn phòng / sân tập.", "warning")
        return
      }
      if (!selectedSlot) {
        showToast?.("Vui lòng chọn một ca tập.", "warning")
        return
      }
      if (!agreementConfirmed) {
        showToast?.("Vui lòng xác nhận đã thống nhất lịch tập với học viên.", "warning")
        return
      }
      const startTime = normalizeStrictTime(selectedSlot.startTime || "06:00:00")
      const endTime = normalizeStrictTime(selectedSlot.endTime || "07:30:00")

      const sessionStartMs = parseVietnamDateTime(`${bookingDate}T${startTime}`)
      if (!Number.isNaN(sessionStartMs) && sessionStartMs - Date.now() < 12 * 60 * 60 * 1000) {
        showToast?.("Yêu cầu đặt lịch trước tối thiểu 12 tiếng theo giờ Việt Nam.", "warning")
        return
      }

      if (!reqKey) {
        reqKey = generateRequestKey()
        setRequestKey(reqKey)
      }

      payloadToSubmit = {
        subscriptionId: attemptSubId || 1,
        coachId: bookingReg.primaryCoachId || currentUser?.id || "stf-3",
        roomId: selectedRoomId,
        subjectId: bookingReg.subjectId || 1,
        sessionDate: bookingDate,
        startTime,
        endTime,
        agreementConfirmed: true,
        requestKey: reqKey,
      }
    }

    const newAttemptSnapshot = {
      subscriptionId: attemptSubId,
      memberId: apiEnabled ? Number(bookingReg.memberId) : bookingReg.memberId,
      memberName: bookingReg.memberName || `Học viên #${bookingReg.memberId}`,
      subjectId: apiEnabled ? Number(bookingReg.subjectId) : (bookingReg.subjectId || 1),
      coachId: payloadToSubmit.coachId,
      roomId: payloadToSubmit.roomId,
      sessionDate: payloadToSubmit.sessionDate,
      startTime: payloadToSubmit.startTime,
      endTime: payloadToSubmit.endTime,
      selectedSlot: isRetrySnapshot ? currentAttempt.selectedSlot : selectedSlot,
      agreementConfirmed: true,
      key: reqKey,
      status: "pending",
      error: null,
      payload: payloadToSubmit,
    }

    setAttemptsBySubId((prev) => ({ ...prev, [attemptSubId]: newAttemptSnapshot }))
    isSubmittingRef.current = true
    setBookingBusy(true)

    // Chụp token session và subId lúc submit để bind response
    const submitModalSession = modalSessionRef.current
    const submitSubId = attemptSubId

    try {
      if (apiEnabled) {
        const sessionResponse = await memberPortalApi.bookPrivateSession(payloadToSubmit)

        // Strict verification of SessionResponse
        const matchResult = verifySessionResponseMatch(sessionResponse, payloadToSubmit, bookingReg)
        if (!matchResult.valid) {
          setAttemptsBySubId((prev) => ({
            ...prev,
            [attemptSubId]: {
              ...newAttemptSnapshot,
              status: "mismatch",
              error: matchResult.reason,
            },
          }))
          showToast?.(matchResult.reason, "error")
          return
        }

        // Success: Clear attempt
        setAttemptsBySubId((prev) => {
          const next = { ...prev }
          delete next[attemptSubId]
          return next
        })

        // Close modal ONLY if modal currently represents this exact session & subscription
        if (
          modalSessionRef.current === submitModalSession &&
          currentOpenSubIdRef.current === submitSubId
        ) {
          handleCloseModal()
        }

        showToast?.(
          `Đã đặt buổi tập riêng 1-kèm-1 thành công! (Mã buổi: #${sessionResponse.id})`,
          "success",
        )

        // Readback credit via GET
        try {
          await loadAdvancedRequests()
        } catch {
          setReadbackError(true)
          showToast?.(
            `Đã đặt ca #${sessionResponse.id} thành công nhưng chưa thể cập nhật credit mới. Vui lòng bấm 'Tải lại dữ liệu'.`,
            "warning",
          )
        }
      } else {
        // Mock mode
        setAttemptsBySubId((prev) => {
          const next = { ...prev }
          delete next[attemptSubId]
          return next
        })
        if (
          modalSessionRef.current === submitModalSession &&
          currentOpenSubIdRef.current === submitSubId
        ) {
          handleCloseModal()
        }
        showToast?.(
          `[MOCK] Đã đặt lịch 1-kèm-1 thành công cho học viên ngày ${bookingDate}!`,
          "success",
        )
      }
    } catch (err) {
      const errMessage = getErrorMessage(err, "Không thể đặt buổi tập riêng 1-kèm-1.")
      const status = Number(err?.status || err?.response?.status || 0)
      const msgUpper = String(errMessage).toUpperCase()
      const msgLower = String(errMessage).toLowerCase()

      const isIdempotencyConflict =
        status === 409 &&
        (msgUpper.includes("IDEMPOTENCY_CONFLICT") ||
          msgLower.includes("booking key already"))

      const isScheduleConflict =
        status === 409 &&
        (msgUpper.includes("ROOM_CONFLICT") ||
          msgUpper.includes("COACH_CONFLICT") ||
          msgLower.includes("trùng lịch") ||
          msgLower.includes("đã có lịch trong khung giờ") ||
          msgLower.includes("phòng tập đã có lịch") ||
          msgLower.includes("hlv đã có lịch"))

      if (isIdempotencyConflict) {
        setAttemptsBySubId((prev) => ({
          ...prev,
          [attemptSubId]: {
            ...newAttemptSnapshot,
            status: "idempotency_conflict",
            error:
              "Mã yêu cầu này đã được xử lý với nội dung lịch khác. Hãy tải lại trang để xem trạng thái mới nhất.",
          },
        }))
        showToast?.("Lịch này đã được đặt trước đó. Hãy tải lại trang để xem lịch mới nhất.", "error")
      } else if (isScheduleConflict) {
        setAttemptsBySubId((prev) => ({
          ...prev,
          [attemptSubId]: {
            ...newAttemptSnapshot,
            status: "schedule_conflict",
            error: errMessage,
          },
        }))
        showToast?.(`Xung đột lịch tập: ${errMessage}. Vui lòng chọn ca hoặc ngày/phòng khác.`, "error")
      } else if (status === 409) {
        // Unknown 409: Giữ nguyên attempt để đối soát, không coi là schedule conflict, không rotate key
        setAttemptsBySubId((prev) => ({
          ...prev,
          [attemptSubId]: {
            ...newAttemptSnapshot,
            status: "conflict_unknown",
            error: errMessage || "Có xung đột dữ liệu. Vui lòng tải lại trang và thử lại.",
          },
        }))
        showToast?.(`Xung đột lịch tập: ${errMessage}. Vui lòng đối soát lại lịch.`, "error")
      } else if (
        !status ||
        status >= 500 ||
        msgLower.includes("timeout") ||
        msgLower.includes("network")
      ) {
        setAttemptsBySubId((prev) => ({
          ...prev,
          [attemptSubId]: {
            ...newAttemptSnapshot,
            status: "uncertain",
            error:
              "Không nhận được phản hồi (mạng chậm hoặc hết giờ chờ). Vui lòng bấm 'Thử lại cùng giao dịch' để đối soát an toàn.",
          },
        }))
        showToast?.(
          "Chưa nhận được xác nhận đặt lịch. Vui lòng thử lại với cùng giao dịch.",
          "warning",
        )
      } else {
        setAttemptsBySubId((prev) => ({
          ...prev,
          [attemptSubId]: {
            ...newAttemptSnapshot,
            status: "failed",
            error: errMessage,
          },
        }))
        showToast?.(errMessage, "error")
      }
    } finally {
      isSubmittingRef.current = false
      setBookingBusy(false)
    }
  }

  const [memberSearchQuery, setMemberSearchQuery] = useState("")
  const [subjectFilter, setSubjectFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  // Pending PT requests (ONLY REQUESTED / PENDING per rule 3.5 & P0.3)
  const pendingAdvancedRequests = useMemo(() => {
    if (!Array.isArray(advancedRequests)) return []
    return advancedRequests.filter((r) => {
      const st = String(r.status || "").toLowerCase()
      return st.includes("pending") || st.includes("request")
    })
  }, [advancedRequests])

  // API mode booking candidates from registrations (ACCEPTED / INVOICED / ACTIVE)
  const apiBookingCandidates = useMemo(() => {
    if (!apiEnabled || !Array.isArray(advancedRequests)) return []
    return advancedRequests.filter((r) => {
      const st = String(r.status || "").toLowerCase()
      return (
        r.subscriptionId ||
        (st !== "requested" &&
          st !== "pending" &&
          st !== "rejected" &&
          st !== "declined")
      )
    })
  }, [apiEnabled, advancedRequests])

  const availableSubjects = useMemo(() => {
    const set = new Set()
    apiBookingCandidates.forEach((c) => {
      const sub = c.subjectName || (c.subjectId ? `Môn #${c.subjectId}` : "")
      if (sub) set.add(sub)
    })
    return Array.from(set)
  }, [apiBookingCandidates])

  const filteredCandidates = useMemo(() => {
    const q = memberSearchQuery.trim().toLowerCase()
    return apiBookingCandidates.filter((item) => {
      if (q) {
        const mName = String(
          item.memberName || (item.memberId ? `Học viên #${item.memberId}` : ""),
        ).toLowerCase()
        const mId = String(item.memberId || "").toLowerCase()
        if (!mName.includes(q) && !mId.includes(q)) return false
      }
      if (subjectFilter !== "all") {
        const sub = item.subjectName || (item.subjectId ? `Môn #${item.subjectId}` : "")
        if (sub !== subjectFilter) return false
      }
      if (statusFilter !== "all") {
        const st = String(item.subscriptionStatus || item.status || "").toLowerCase()
        if (statusFilter === "active" && st !== "active") return false
        if (
          statusFilter === "awaiting" &&
          st !== "accepted" &&
          st !== "invoiced"
        )
          return false
        if (
          statusFilter === "expired" &&
          st !== "expired" &&
          st !== "cancelled" &&
          st !== "frozen"
        )
          return false
      }
      return true
    })
  }, [apiBookingCandidates, memberSearchQuery, subjectFilter, statusFilter])

  const [selectedPkgByMember, setSelectedPkgByMember] = useState({})

  // Group filtered candidates by memberId (P2.4 & R3.1/R3.2: 1 card per student, sorting packages by nearest expiry date first)
  const groupedStudentCards = useMemo(() => {
    const map = new Map()
    filteredCandidates.forEach((item) => {
      const key = String(item.memberId || item.id)
      const memberDisplayName =
        item.memberName ||
        (item.memberId ? `Học viên #${item.memberId}` : "Hội viên PT")
      const existing = map.get(key)
      if (!existing) {
        map.set(key, {
          memberKey: key,
          memberId: item.memberId,
          memberName: memberDisplayName,
          packages: [item],
        })
      } else {
        existing.packages.push(item)
      }
    })
    return Array.from(map.values()).map((group) => {
      const sortedPackages = [...group.packages].sort((a, b) => {
        const expA = parseVietnamDateTime(a.expiresAt)
        const expB = parseVietnamDateTime(b.expiresAt)
        const validA = !Number.isNaN(expA) ? expA : Number.MAX_SAFE_INTEGER
        const validB = !Number.isNaN(expB) ? expB : Number.MAX_SAFE_INTEGER
        if (validA !== validB) return validA - validB
        return Number(a.subscriptionId || a.id || 0) - Number(b.subscriptionId || b.id || 0)
      })
      return {
        ...group,
        packages: sortedPackages,
      }
    })
  }, [filteredCandidates])

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 whitespace-nowrap">
              {t("assignedMembers")}
            </h2>
            <p className="text-xs text-slate-500 whitespace-nowrap">
              {language === "vi"
                ? "Danh sách học viên Personal Training (PT) được phân công trực tiếp"
                : "Directly assigned Personal Training (PT) students"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {apiEnabled && (
            <button
              type="button"
              disabled={loadingRequests}
              onClick={() => loadAdvancedRequests().catch(() => {})}
              title={t("coachBtnRefresh")}
              className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded flex items-center gap-1 cursor-pointer transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingRequests ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{t("coachBtnRefresh")}</span>
            </button>
          )}
          <div className="text-xs font-mono font-bold bg-slate-100 border border-slate-200 px-3 py-1.5 rounded text-slate-900">
            Tổng số: {apiBookingCandidates.length} {t("coachPkgLabel")}
          </div>
        </div>
      </div>

      {/* Global Unresolved Attempt Banner */}
      {unresolvedAttempt && (!bookingReg || Number(bookingReg.subscriptionId) !== unresolvedAttempt.subscriptionId) && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0" />
            <div>
              <span className="font-bold">Đang có giao dịch đặt lịch chưa hoàn tất kết quả: </span>
              <span>
                Học viên <strong>{unresolvedAttempt.memberName}</strong> &bull; {t("coachPkgLabel")} (
                {unresolvedAttempt.sessionDate} &bull; {unresolvedAttempt.startTime.slice(0, 5)})
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const reg = advancedRequests.find((r) => Number(r.subscriptionId) === unresolvedAttempt.subscriptionId)
              if (reg) openBookPrivateModal(reg)
            }}
            className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded font-bold cursor-pointer transition-all self-start sm:self-auto shrink-0"
          >
            Mở xem lại &amp; Thử lại
          </button>
        </div>
      )}

      {/* Readback Error Alert */}
      {readbackError && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Buổi tập đã được tạo thành công nhưng chưa thể cập nhật số buổi còn lại. Vui lòng tải lại trang.</span>
          </div>
          <button
            type="button"
            disabled={loadingRequests}
            onClick={() => loadAdvancedRequests().catch(() => {})}
            className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded font-bold cursor-pointer transition-all flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loadingRequests ? "animate-spin" : ""}`} />
            <span>Tải lại dữ liệu</span>
          </button>
        </div>
      )}

      {/* Pending Advanced PT Coach Requests (ONLY REQUESTED / PENDING) */}
      {pendingAdvancedRequests.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-lg p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Yêu cầu đăng ký PT 1:1 chờ duyệt</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
                {pendingAdvancedRequests.length}
              </span>
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {pendingAdvancedRequests.map((req) => {
              const memberDisplayName =
                req.memberName ||
                (req.memberId ? `Học viên #${req.memberId}` : "Hội viên")
              const subjectDisplayName =
                req.subjectName ||
                (req.subjectId ? `Môn #${req.subjectId}` : "Huấn luyện cá nhân")
              return (
                <div
                  key={req.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900">
                      {memberDisplayName} &bull; {subjectDisplayName}
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      Trạng thái:{" "}
                      <strong className="text-amber-800">
                        {t("coachStatusPending")}
                      </strong>
                      {req.note ? ` · Ghi chú: ${req.note}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={decidingId !== null}
                      onClick={() => handleCoachDecision(req, "APPROVE")}
                      aria-label={`${t("coachPtAcceptBtn")} ${memberDisplayName}`}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-bold flex items-center gap-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 transition-all"
                    >
                      {decidingId === req.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {decidingId === req.id
                          ? "Đang xử lý..."
                          : t("coachPtAcceptBtn")}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={decidingId !== null}
                      onClick={() => openRejectModal(req)}
                      aria-label={`${t("coachPtRejectBtn")} ${memberDisplayName}`}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed text-rose-700 border border-rose-200 rounded font-bold flex items-center gap-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1 transition-all"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>{t("coachPtRejectBtn")}</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Main Content Area: API Candidates */}
      <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-700" />
              <span>
                Học viên &amp; gói PT 1:1 được phân công ({groupedStudentCards.length} học viên)
              </span>
            </h3>

            {/* Search & Filter Bar (P2.4) */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  placeholder={t("coachSearchStudentPlaceholder")}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded focus:outline-none focus:border-blue-600 w-52"
                />
              </div>

              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-900"
              >
                <option value="all">{t("coachFilterAllSubjects")}</option>
                {availableSubjects.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-semibold text-slate-900"
              >
                <option value="all">{t("coachFilterAllStatuses")}</option>
                <option value="active">{t("coachStatusActive")}</option>
                <option value="awaiting">{t("coachPtAwaitingPackagePayment")}</option>
                <option value="expired">{t("coachStatusExpired")}</option>
              </select>

              <button
                type="button"
                disabled={loadingRequests}
                onClick={() => loadAdvancedRequests().catch(() => {})}
                aria-label={t("coachBtnRefresh")}
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded border border-slate-200 transition-all cursor-pointer"
                title={t("coachBtnRefresh")}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingRequests ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {requestsError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between">
              <span>{requestsError}</span>
              <button
                type="button"
                onClick={() => loadAdvancedRequests().catch(() => {})}
                className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded font-bold cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          )}

          {loadingRequests ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-48 bg-slate-100 animate-pulse rounded-lg border border-slate-200"
                />
              ))}
            </div>
          ) : groupedStudentCards.length === 0 && !requestsError ? (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-xs text-slate-500">
              {apiBookingCandidates.length > 0
                ? "Không có học viên nào khớp với bộ lọc hiện tại."
                : "Chưa có học viên hoặc gói 1-kèm-1 nào được phân công trực tiếp cho HLV."}
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 ${
                groupedStudentCards.length > 1 ? "md:grid-cols-2" : ""
              } gap-4`}
            >
              {groupedStudentCards.map((studentGroup) => {
                const memberDisplayName = studentGroup.memberName
                const memberCodeLabel = formatMemberCode(studentGroup.memberId)

                const bookablePackages = studentGroup.packages.filter((pkg) => {
                  const ent = checkRegistrationEntitlement(pkg, currentUser)
                  return ent.canBook && canCoachActOnPackage(pkg)
                })
                const recommendedPkg = bookablePackages[0] || null
                const selectedPkgId =
                  selectedPkgByMember[studentGroup.memberKey] ??
                  (recommendedPkg ? String(recommendedPkg.id) : "")
                const activeSelectedPkg =
                  bookablePackages.find(
                    (p) => String(p.id) === String(selectedPkgId),
                  ) || recommendedPkg

                const formatPkgName = (pkg) => {
                  const subName =
                    pkg.subjectName ||
                    (pkg.subjectId ? `Môn #${pkg.subjectId}` : "PT 1:1")
                  const codeNum = pkg.subscriptionId || pkg.id
                  const baseTitle =
                    pkg.packageName ||
                    (pkg.subscriptionId
                      ? `${subName} PT`
                      : `${subName} (${t("coachPtAwaitingPackagePayment")})`)
                  return codeNum
                    ? `Gói #${codeNum} · ${baseTitle}`
                    : baseTitle
                }

                return (
                  <div
                    key={studentGroup.memberKey}
                    className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4 hover:border-slate-300 transition-all"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {memberDisplayName}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded font-mono text-xs font-semibold">
                            {memberCodeLabel}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {studentGroup.packages.length} {t("coachPkgLabel")}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== "undefined" && studentGroup.memberId) {
                            sessionStorage.setItem(
                              "scms_selected_progress_member_id",
                              String(studentGroup.memberId),
                            )
                          }
                          setCurrentTab("trainingProgress")
                          navigate("/coach/progress")
                        }}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold shadow-xs flex items-center gap-1 whitespace-nowrap cursor-pointer transition-all"
                      >
                        <Dumbbell className="w-3.5 h-3.5 shrink-0" />
                        <span>Giáo án &amp; đánh giá</span>
                      </button>
                    </div>

                    {/* R2.2: Check if student has any Completed PT session without a logged training result */}
                    {(() => {
                      const loggedSessionIds = new Set(
                        coachTrainingResults
                          .filter(
                            (r) =>
                              String(r.memberId) ===
                              String(studentGroup.memberId),
                          )
                          .map((r) => String(r.sessionId)),
                      )
                      const unloggedCompletedPt = coachSessions.find(
                        (s) =>
                          s.isPrivate === true &&
                          String(s.bookedMemberId) ===
                            String(studentGroup.memberId) &&
                          String(s.status || "").toLowerCase() ===
                            "completed" &&
                          !loggedSessionIds.has(String(s.id)),
                      )
                      if (!unloggedCompletedPt) return null
                      return (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>
                              {t("coachPtCompletedNoResultHint")} (
                              <strong>
                                {formatVietnamDateOnly(unloggedCompletedPt.sessionDate)}
                              </strong>
                              )
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (typeof window !== "undefined") {
                                sessionStorage.setItem(
                                  "scms_selected_progress_member_id",
                                  String(studentGroup.memberId),
                                )
                                sessionStorage.setItem(
                                  "scms_selected_progress_tab",
                                  "logs",
                                )
                                sessionStorage.setItem(
                                  "scms_selected_progress_session_id",
                                  String(unloggedCompletedPt.id),
                                )
                              }
                              setCurrentTab("trainingProgress")
                              navigate("/coach/progress")
                            }}
                            className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded font-bold cursor-pointer shrink-0 self-start sm:self-auto"
                          >
                            {t("coachBtnLogResult")}
                          </button>
                        </div>
                      )
                    })()}

                    {/* List of PT Packages belonging to this student (R3.1: distinct package code, registration date, expiry date, remaining sessions) */}
                    <div className="space-y-2.5">
                      {studentGroup.packages.map((item) => {
                        const entitlement = checkRegistrationEntitlement(item, currentUser)
                        const pkgAllowed = canCoachActOnPackage(item)
                        const canBook = entitlement.canBook && pkgAllowed
                        const unbookableReason =
                          getPackageActionBlockReason(item, t) || entitlement.reason

                        const credit = Number(item.remainingCredit ?? 0)
                        const hasExplicitTotal =
                          item.totalCredit != null || item.totalSessions != null
                        const totalCredit = hasExplicitTotal
                          ? Math.max(
                              credit,
                              Number(item.totalCredit || item.totalSessions),
                            )
                          : null
                        const usedCredit =
                          totalCredit != null
                            ? Math.max(0, totalCredit - credit)
                            : null
                        const progressPct =
                          totalCredit != null && totalCredit > 0
                            ? Math.min(100, Math.round((credit / totalCredit) * 100))
                            : credit > 0
                              ? 100
                              : 0

                        const rawStatus = String(
                          item.subscriptionStatus || item.status || "",
                        ).toLowerCase()
                        const isSubActive = rawStatus === "active"
                        const isAwaitingPayment =
                          !isSubActive &&
                          (rawStatus === "accepted" || rawStatus === "invoiced")

                        const isSelectedForBooking =
                          activeSelectedPkg &&
                          String(activeSelectedPkg.id) === String(item.id)
                        const isRecommended =
                          recommendedPkg &&
                          String(recommendedPkg.id) === String(item.id) &&
                          bookablePackages.length > 1

                        const regDateLabel = formatVietnamDateOnly(
                          item.activatedAt || item.createdAt,
                        )

                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              if (canBook) {
                                setSelectedPkgByMember((prev) => ({
                                  ...prev,
                                  [studentGroup.memberKey]: String(item.id),
                                }))
                              }
                            }}
                            className={`p-3.5 rounded-lg border space-y-2 text-xs transition-all ${
                              isSelectedForBooking
                                ? "bg-emerald-50/40 border-emerald-300"
                                : "bg-slate-50 border-slate-200"
                            } ${canBook && bookablePackages.length > 1 ? "cursor-pointer" : ""}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                                <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>{formatPkgName(item)}</span>
                                {isRecommended && (
                                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-semibold">
                                    {language === "vi"
                                      ? "Gần hết hạn nhất"
                                      : "Nearest expiry"}
                                  </span>
                                )}
                              </span>
                              <CoachStatusBadge
                                type="package"
                                value={
                                  isSubActive
                                    ? "Active"
                                    : isAwaitingPayment
                                      ? "INVOICED"
                                      : item.subscriptionStatus || item.status || "Pending"
                                }
                              />
                            </div>

                            {/* Remaining sessions display (R2.2) */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-slate-700">
                                <span className="font-medium text-slate-600">
                                  {t("coachRemainingSessionsLabel")}:
                                </span>
                                <span
                                  className={`font-mono font-bold tabular-nums ${
                                    credit > 0 ? "text-emerald-700" : "text-rose-600"
                                  }`}
                                >
                                  {totalCredit != null
                                    ? `Còn ${credit}/${totalCredit} buổi (Đã tập ${usedCredit})`
                                    : t("coachAvailableSessionsCount").replace(
                                        "{count}",
                                        String(credit),
                                      )}
                                </span>
                              </div>
                              {totalCredit != null && (
                                <div className="w-full h-1.5 bg-slate-200 rounded overflow-hidden">
                                  <div
                                    style={{ width: `${progressPct}%` }}
                                    className={`h-full rounded ${
                                      credit > 0 ? "bg-emerald-600" : "bg-rose-500"
                                    }`}
                                  />
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 text-slate-600 pt-1">
                              <div className="flex flex-wrap items-center gap-3 font-mono">
                                <span>
                                  {t("coachPkgRegDateLabel")}:{" "}
                                  <strong>{regDateLabel}</strong>
                                </span>
                                <span>
                                  {t("coachExpiryDateLabel")}:{" "}
                                  <strong>{formatVietnamDateOnly(item.expiresAt)}</strong>
                                </span>
                              </div>

                              {!canBook && unbookableReason && (
                                <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium">
                                  {unbookableReason}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* R3.2: Single Student-level PT Booking Control with package selector & explicit deduction label */}
                    <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {activeSelectedPkg ? (
                        <>
                          <div className="space-y-1 text-xs">
                            <div className="text-slate-700 font-medium">
                              {t("coachWillDeductFromPkg").replace(
                                "{pkgName}",
                                formatPkgName(activeSelectedPkg),
                              )}
                            </div>
                            {bookablePackages.length > 1 && (
                              <div className="flex items-center gap-2">
                                <label
                                  htmlFor={`pkg-select-${studentGroup.memberKey}`}
                                  className="text-slate-500"
                                >
                                  {language === "vi" ? "Đổi gói trừ buổi:" : "Switch package:"}
                                </label>
                                <select
                                  id={`pkg-select-${studentGroup.memberKey}`}
                                  value={String(activeSelectedPkg.id)}
                                  onChange={(e) =>
                                    setSelectedPkgByMember((prev) => ({
                                      ...prev,
                                      [studentGroup.memberKey]: e.target.value,
                                    }))
                                  }
                                  className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-900"
                                >
                                  {bookablePackages.map((pkg) => (
                                    <option key={pkg.id} value={String(pkg.id)}>
                                      {formatPkgName(pkg)} (Còn {pkg.remainingCredit ?? 0} buổi · HSD{" "}
                                      {formatVietnamDateOnly(pkg.expiresAt)})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {unresolvedAttempt &&
                            unresolvedAttempt.subscriptionId ===
                              Number(activeSelectedPkg.subscriptionId) ? (
                              <button
                                type="button"
                                onClick={() => openBookPrivateModal(activeSelectedPkg)}
                                aria-label={`Xem lại đối soát cho học viên ${memberDisplayName}`}
                                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold shadow-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all"
                              >
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>Đối soát giao dịch</span>
                              </button>
                            ) : unresolvedAttempt &&
                              unresolvedAttempt.subscriptionId !==
                                Number(activeSelectedPkg.subscriptionId) ? (
                              <button
                                type="button"
                                disabled
                                aria-disabled="true"
                                title="Khóa do đang có giao dịch khác chờ đối soát"
                                className="px-3.5 py-2 bg-slate-100 text-slate-400 border border-slate-200 rounded text-xs font-bold flex items-center gap-1.5 cursor-not-allowed opacity-60"
                              >
                                <Lock className="w-3.5 h-3.5 shrink-0" />
                                <span>Đang chờ xác nhận</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openBookPrivateModal(activeSelectedPkg)}
                                aria-label={`Đặt lịch PT 1:1 cho học viên ${memberDisplayName}`}
                                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold shadow-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all"
                              >
                                <CalendarPlus className="w-3.5 h-3.5 shrink-0" />
                                <span>Đặt lịch PT 1:1</span>
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between w-full gap-2 text-xs text-slate-500">
                          <span>
                            {language === "vi"
                              ? "Chưa có gói PT đủ điều kiện đặt lịch."
                              : "No eligible PT package available for booking."}
                          </span>
                          <button
                            type="button"
                            disabled
                            aria-disabled="true"
                            className="px-3 py-1.5 bg-slate-100 text-slate-400 border border-slate-200 rounded text-xs font-bold flex items-center gap-1 cursor-not-allowed opacity-60"
                          >
                            <CalendarPlus className="w-3.5 h-3.5 shrink-0" />
                            <span>Không đủ điều kiện</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
      </div>

      {/* Mandatory Rejection Reason Modal (P0.3) */}
      {rejectModalTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-pt-modal-title"
        >
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3
                id="reject-pt-modal-title"
                className="text-sm font-bold text-slate-900 flex items-center gap-2"
              >
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>{t("coachPtRejectModalTitle")}</span>
              </h3>
              <button
                type="button"
                onClick={() => setRejectModalTarget(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmReject} className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                {t("coachPtRejectModalDesc")}
              </p>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800">
                <strong>
                  {rejectModalTarget.memberName ||
                    (rejectModalTarget.memberId
                      ? `Học viên #${rejectModalTarget.memberId}`
                      : "Hội viên")}
                </strong>{" "}
                &bull;{" "}
                {rejectModalTarget.subjectName ||
                  (rejectModalTarget.subjectId
                    ? `Môn #${rejectModalTarget.subjectId}`
                    : "PT 1:1")}
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="reject-pt-reason"
                  className="block text-xs font-bold text-slate-700"
                >
                  {t("coachPtRejectReasonLabel")}
                </label>
                <textarea
                  id="reject-pt-reason"
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value)
                    if (rejectReasonError && e.target.value.trim().length >= 5) {
                      setRejectReasonError("")
                    }
                  }}
                  placeholder={t("coachPtRejectReasonPlaceholder")}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:border-rose-600"
                  autoFocus
                />
                {rejectReasonError && (
                  <p className="text-xs text-rose-600 font-semibold">
                    {rejectReasonError}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectModalTarget(null)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                >
                  {t("coachCancelBtn")}
                </button>
                <button
                  type="submit"
                  disabled={decidingId !== null}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded cursor-pointer flex items-center gap-1.5"
                >
                  {decidingId !== null && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>{t("coachPtRejectConfirmBtn")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Private PT Session Booking Modal (Mục 6 / D04) */}
      {bookingReg && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Đặt buổi tập PT 1:1
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Học viên: <strong>{bookingReg.memberName || `Học viên #${bookingReg.memberId}`}</strong> &bull; Gói:{" "}
                  <strong>#{bookingReg.subscriptionId}</strong> ({bookingReg.subjectName || `Môn #${bookingReg.subjectId}`})
                </p>
                <div className="text-xs text-emerald-800 font-medium mt-0.5">
                  Số buổi khả dụng: <strong>{bookingReg.remainingCredit ?? 0} buổi</strong> &bull; Hạn dùng:{" "}
                  <strong>{formatVietnamDateTime(bookingReg.expiresAt)}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                aria-label="Đóng cửa sổ đặt lịch"
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Idempotency Alert / Notice */}
            {currentAttempt?.status === "uncertain" && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Giao dịch chưa được xác nhận</span>
                </div>
                <p className="text-[11px]">
                  Yêu cầu trước đó gặp sự cố mạng hoặc timeout. Form đang hiển thị chính xác snapshot của giao dịch đang đối soát
                  (ngày <strong>{currentAttempt.sessionDate}</strong>, ca{" "}
                  <strong>
                    {currentAttempt.startTime?.slice(0, 5)} - {currentAttempt.endTime?.slice(0, 5)}
                  </strong>
                  ).
                </p>
                <div className="pt-1 border-t border-amber-200/60">
                  <span className="text-[10px] text-amber-700">
                    Mã giao dịch: {currentAttempt.key?.slice(0, 8)}...
                  </span>
                </div>
              </div>
            )}

            {currentAttempt?.status === "idempotency_conflict" && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-800">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Lịch đã được đặt trước đó</span>
                </div>
                <p className="text-[11px]">
                  {currentAttempt.error ||
                    "Mã yêu cầu này đã được xử lý với nội dung lịch khác. Vui lòng đóng cửa sổ và kiểm tra lại lịch hiện tại."}
                </p>
              </div>
            )}

            {currentAttempt?.status === "conflict_unknown" && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-800">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Có xung đột dữ liệu, vui lòng tải lại trang</span>
                </div>
                <p className="text-[11px]">
                  {currentAttempt.error ||
                    "Phát hiện xung đột dữ liệu không xác định. Giao dịch được giữ nguyên để kiểm tra lại."}
                </p>
              </div>
            )}

            {currentAttempt?.status === "schedule_conflict" && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Xung đột lịch tập (Phòng hoặc HLV đã bận)</span>
                </div>
                <p className="text-[11px]">
                  {currentAttempt.error}. Bạn có thể chọn ngày, phòng, hoặc ca tập khác bên dưới để tiếp tục đặt lịch.
                </p>
              </div>
            )}

            {currentAttempt?.status === "mismatch" && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-800">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Phản hồi xác nhận không như mong đợi</span>
                </div>
                <p className="text-[11px]">
                  {currentAttempt.error}. Giao dịch chưa được xác nhận hoàn tất thành công.
                </p>
              </div>
            )}

            <form onSubmit={handleBookPrivateSession} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="booking-date-input" className="text-xs font-bold text-slate-700 block mb-1">
                    Ngày tập (Tối thiểu 12h trước buổi) *
                  </label>
                  <input
                    id="booking-date-input"
                    type="date"
                    required
                    disabled={
                      currentAttempt?.status === "uncertain" ||
                      currentAttempt?.status === "pending"
                    }
                    value={bookingDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  />
                  <div className="text-xs text-slate-500 font-mono mt-1">
                    {formatDate(bookingDate)}
                  </div>
                </div>

                <div>
                  <label htmlFor="booking-room-select" className="text-xs font-bold text-slate-700 block mb-1">
                    Phòng / Sân tập *
                  </label>
                  {loadingRooms ? (
                    <div className="py-2 text-xs text-slate-500 flex items-center gap-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang nạp danh sách sân...</span>
                    </div>
                  ) : roomsError ? (
                    <div className="text-[11px] text-rose-600">
                      <span>{roomsError}</span>
                      <button
                        type="button"
                        onClick={handleRetryRooms}
                        className="ml-2 underline font-bold cursor-pointer"
                      >
                        Thử lại
                      </button>
                    </div>
                  ) : (
                    <select
                      id="booking-room-select"
                      disabled={
                        currentAttempt?.status === "uncertain" ||
                        currentAttempt?.status === "pending"
                      }
                      value={selectedRoomId}
                      onChange={(e) => handleRoomChange(e.target.value)}
                      className="w-full border border-slate-300 rounded px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                    >
                      {(() => {
                        const isLocked =
                          currentAttempt?.status === "uncertain" ||
                          currentAttempt?.status === "pending"
                        const hasMatchInAvailable = roomsList.some(
                          (r) => String(r.id) === String(selectedRoomId),
                        )

                        const orphanSnapshotOption =
                          isLocked && selectedRoomId && !hasMatchInAvailable ? (
                            <option key={`locked-${selectedRoomId}`} value={selectedRoomId} disabled>
                              {currentAttempt.snapshot?.roomName
                                ? `${currentAttempt.snapshot.roomName} (Đã gửi trong giao dịch)`
                                : `Sân #${selectedRoomId} (Đã gửi trong giao dịch)`}
                            </option>
                          ) : null

                        if (roomsList.length === 0 && !orphanSnapshotOption) {
                          return <option value="">Không có sân tập khả dụng</option>
                        }

                        return (
                          <>
                            {orphanSnapshotOption}
                            {roomsList.map((r) => (
                              <option key={r.id} value={r.id}>
                                {formatRoomOptionLabel(r)}
                              </option>
                            ))}
                          </>
                        )
                      })()}
                    </select>
                  )}
                </div>
              </div>

              {/* Slots Section */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Khung giờ khả dụng (Chuẩn 90 phút) *
                  </label>
                  {availableSlots.length > 0 && !loadingSlots && (
                    <span className="text-[11px] text-slate-500">
                      {availableSlots.filter((s) => s.isAvailable === true).length} ca trống
                    </span>
                  )}
                </div>

                {loadingSlots ? (
                  <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2 border border-slate-100 rounded bg-slate-50">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                    <span>Đang kiểm tra ca trống thực tế...</span>
                  </div>
                ) : slotsError ? (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-center justify-between">
                    <span>{slotsError}</span>
                    <button
                      type="button"
                      onClick={() => fetchAvailableSlots(bookingDate, selectedRoomId, bookingReg)}
                      className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded font-bold cursor-pointer"
                    >
                      Thử lại tải ca
                    </button>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="py-5 text-center text-xs text-slate-500 border border-slate-200 rounded bg-slate-50">
                    Không có ca trống nào khả dụng trong ngày và sân tập đã chọn.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-0.5">
                    {availableSlots.map((slot, idx) => {
                      const startStr = String(slot.startTime || "").slice(0, 5)
                      const endStr = String(slot.endTime || "").slice(0, 5)
                      const isSelected = selectedSlot?.startTime === slot.startTime
                      const disabled =
                        slot.isAvailable !== true ||
                        currentAttempt?.status === "uncertain" ||
                        currentAttempt?.status === "pending"

                      return (
                        <button
                          key={slot.slotNumber || idx}
                          type="button"
                          disabled={disabled}
                          onClick={() => handleSelectSlot(slot)}
                          aria-label={`${slot.slotName || `Ca ${idx + 1}`} từ ${startStr} đến ${endStr} ${
                            slot.isAvailable !== true ? "(Đã kín)" : "(Còn trống)"
                          }`}
                          className={`p-2.5 rounded border text-left text-xs transition-all cursor-pointer ${
                            disabled
                              ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
                              : isSelected
                                ? "bg-slate-900 text-white border-slate-900 font-bold shadow-xs"
                                : "bg-white text-slate-800 border-slate-200 hover:border-slate-400"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{slot.slotName || slot.name || `Ca ${idx + 1}`}</span>
                            {slot.isAvailable !== true && (
                              <span className="text-[10px] text-rose-600 font-medium">Kín</span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] opacity-85 mt-0.5">
                            {startStr} – {endStr}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Agreement Confirmation Checkbox */}
              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    required
                    disabled={
                      currentAttempt?.status === "uncertain" ||
                      currentAttempt?.status === "pending"
                    }
                    checked={agreementConfirmed}
                    onChange={(e) => setAgreementConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
                  />
                  <span>
                    HLV xác nhận đã thống nhất lịch tập trực tiếp với học viên theo quy định của trung tâm. *
                  </span>
                </label>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold cursor-pointer transition-all"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={
                    bookingBusy ||
                    !selectedSlot ||
                    !agreementConfirmed ||
                    !isPositiveInteger(selectedRoomId) ||
                    currentAttempt?.status === "idempotency_conflict" ||
                    currentAttempt?.status === "conflict_unknown" ||
                    currentAttempt?.status === "mismatch" ||
                    (currentAttempt?.status === "pending" && isSubmittingRef.current)
                  }
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5"
                >
                  {bookingBusy ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang xử lý đặt lịch...</span>
                    </>
                  ) : currentAttempt?.status === "uncertain" ||
                    currentAttempt?.status === "pending" ? (
                    <span>Thử lại cùng giao dịch</span>
                  ) : (
                    <span>Xác nhận đặt lịch PT 1:1</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
