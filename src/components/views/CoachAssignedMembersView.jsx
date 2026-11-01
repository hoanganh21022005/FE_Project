import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { StatusBadge } from "../common/Badge"
import { memberApi } from "../../api/memberApi"
import { memberPortalApi } from "../../api/memberPortalApi"
import { getErrorMessage } from "../../api/apiErrors"
import { parseVietnamDateTime } from "../../utils/memberSafetyHelpers"
import {
  Users,
  Target,
  Dumbbell,
  Award,
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  Lock,
} from "lucide-react"

const STANDARD_SLOTS = [
  { slotNumber: 1, name: "Ca 1", startTime: "06:00:00", endTime: "07:30:00" },
  { slotNumber: 2, name: "Ca 2", startTime: "07:45:00", endTime: "09:15:00" },
  { slotNumber: 3, name: "Ca 3", startTime: "09:30:00", endTime: "11:00:00" },
  { slotNumber: 4, name: "Ca 4", startTime: "13:00:00", endTime: "14:30:00" },
  { slotNumber: 5, name: "Ca 5", startTime: "14:45:00", endTime: "16:15:00" },
  { slotNumber: 6, name: "Ca 6", startTime: "16:30:00", endTime: "18:00:00" },
  { slotNumber: 7, name: "Ca 7", startTime: "18:15:00", endTime: "19:45:00" },
]

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
  if (!isPositiveInteger(currentCoachId) || Number(item.primaryCoachId) !== Number(currentCoachId)) {
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

export function verifySessionResponseMatch(resp, payload, regItem) {
  if (!resp || typeof resp !== "object") {
    return { valid: false, reason: "Phản hồi từ máy chủ không hợp lệ." }
  }
  if (!isPositiveInteger(resp.id)) {
    return { valid: false, reason: "Máy chủ không trả về mã buổi tập (Session ID) hợp lệ." }
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
    members,
    trainingPlans,
    currentUser,
    rooms: contextRooms,
    setCurrentTab,
    apiEnabled,
    showToast,
    t,
    language,
  } = useSCMS()

  const [atRiskIds, setAtRiskIds] = useState(new Set())
  const [advancedRequests, setAdvancedRequests] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [requestsError, setRequestsError] = useState(null)
  const [decidingId, setDecidingId] = useState(null)
  const isProcessingRef = useRef(false)

  // Booking Modal State (Mục 6 / D04)
  const [bookingReg, setBookingReg] = useState(null)
  const [bookingDate, setBookingDate] = useState(() => getVietnamDatePlusDays(2))
  const [selectedRoomId, setSelectedRoomId] = useState("")
  const [roomsList, setRoomsList] = useState(() => (Array.isArray(contextRooms) ? contextRooms : []))
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
      const mockRooms = Array.isArray(contextRooms) && contextRooms.length > 0 ? contextRooms : [{ id: 1, name: "Sân tập CLB #1" }]
      setRoomsList(mockRooms)
      return mockRooms
    }
    setLoadingRooms(true)
    setRoomsError(null)
    try {
      const list = await memberPortalApi.getRooms()
      const valid = Array.isArray(list) ? list.filter((r) => isPositiveInteger(r.id)) : []
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
    memberApi
      .getCoachAtRiskMembers()
      .then((list) => {
        if (!active || !Array.isArray(list)) return
        setAtRiskIds(new Set(list.map((item) => String(item.memberId))))
      })
      .catch(() => {})
    loadAdvancedRequests().catch(() => {})
    loadRooms().catch(() => {})
    return () => {
      active = false
    }
  }, [apiEnabled, loadAdvancedRequests, loadRooms])

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
        setAvailableSlots(STANDARD_SLOTS)
        setSelectedSlot(STANDARD_SLOTS[0])
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

  // Handle Coach Decision (APPROVE / REJECT) - Bảo toàn 100%
  const handleCoachDecision = async (reqItem, decision) => {
    if (!reqItem?.id) return
    if (decision !== "APPROVE" && decision !== "REJECT") return

    const st = String(reqItem.status || "").toLowerCase()
    if (!st.includes("pending") && !st.includes("request")) {
      showToast?.("Yêu cầu này không ở trạng thái chờ duyệt.", "info")
      return
    }

    if (isProcessingRef.current || decidingId === reqItem.id) return
    isProcessingRef.current = true
    setDecidingId(reqItem.id)

    const accepted = decision === "APPROVE"
    const reason = accepted
      ? "Coach đồng ý nhận học viên PT 1-kèm-1"
      : "Coach hiện đã kín lịch khung giờ này"

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
        if (respStatus === "ACCEPTED") {
          showToast?.("Đã duyệt nhận học viên PT 1-kèm-1!", "success")
        } else {
          showToast?.(
            `Phản hồi từ máy chủ không khớp (Trạng thái: ${response?.status || "Không xác định"}).`,
            "error",
          )
        }
      } else {
        if (respStatus === "REJECTED") {
          showToast?.("Đã từ chối yêu cầu đăng ký PT.", "info")
        } else {
          showToast?.(
            `Phản hồi từ máy chủ không khớp (Trạng thái: ${response?.status || "Không xác định"}).`,
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

    if (valid.length > 0) {
      const firstRoomId = String(valid[0].id)
      setSelectedRoomId(firstRoomId)
      fetchAvailableSlots(targetDate, firstRoomId, targetReg)
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
      const isRoomInList = roomsList.some(
        (r) => isPositiveInteger(r.id) && Number(r.id) === Number(selectedRoomId),
      )
      if (!isRoomInList) {
        showToast?.("Phòng tập đã chọn không tồn tại trong danh sách phòng hiện hành.", "error")
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
              "Mã yêu cầu này đã được xử lý với nội dung lịch khác (IDEMPOTENCY_CONFLICT). Không thể tự động gửi lại.",
          },
        }))
        showToast?.("Xung đột mã yêu cầu (IDEMPOTENCY_CONFLICT). Vui lòng đối soát lại lịch.", "error")
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
            error: errMessage || "Xung đột không xác định từ máy chủ (HTTP 409).",
          },
        }))
        showToast?.(`Xung đột không xác định (HTTP 409): ${errMessage}. Vui lòng đối soát lại lịch.`, "error")
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
              "Chưa thể xác nhận kết quả từ máy chủ (Timeout hoặc sự cố mạng). Vui lòng bấm 'Thử lại cùng giao dịch' để đối soát an toàn.",
          },
        }))
        showToast?.(
          "Chưa thể xác nhận kết quả đặt lịch từ máy chủ. Vui lòng thử lại với cùng giao dịch.",
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

  // API mode booking candidates from registrations
  const apiBookingCandidates = useMemo(() => {
    if (!apiEnabled || !Array.isArray(advancedRequests)) return []
    return advancedRequests.filter((r) => {
      const st = String(r.status || "").toLowerCase()
      return r.subscriptionId || (st !== "requested" && st !== "pending" && st !== "rejected")
    })
  }, [apiEnabled, advancedRequests])

  // Mock mode fallback assigned members
  const mockAssignedMembers = useMemo(() => {
    const filtered = (members || []).filter(
      (m) => m.primaryCoachId || m.primaryCoachName,
    )
    return filtered.length > 0 ? filtered : members || []
  }, [members])

  return (
    <div className="space-y-6">
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
              title="Làm mới danh sách"
              className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded flex items-center gap-1 cursor-pointer transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingRequests ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>
          )}
          <div className="text-xs font-mono font-bold bg-slate-100 border border-slate-200 px-3 py-1.5 rounded text-slate-900">
            Tổng số: {apiEnabled ? apiBookingCandidates.length : mockAssignedMembers.length}{" "}
            {apiEnabled ? "Gói PT" : "Học viên"}
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
                Học viên <strong>{unresolvedAttempt.memberName}</strong> &bull; Gói{" "}
                <strong>#{unresolvedAttempt.subscriptionId}</strong> ({unresolvedAttempt.sessionDate} &bull;{" "}
                {unresolvedAttempt.startTime.slice(0, 5)})
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
            Mở xem lại & Thử lại
          </button>
        </div>
      )}

      {/* Readback Error Alert */}
      {readbackError && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Buổi tập đã được tạo thành công nhưng chưa thể cập nhật credit mới từ máy chủ.</span>
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

      {/* Pending Advanced PT Coach Requests (Mục 5B) - Chốt từ task trước */}
      {advancedRequests.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>
                Yêu cầu đăng ký HLV 1-kèm-1 (Advanced PT · {advancedRequests.length})
              </span>
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {advancedRequests.map((req) => {
              const st = String(req.status || "").toLowerCase()
              const isPending = st.includes("pending") || st.includes("request")
              return (
                <div
                  key={req.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900">
                      Học viên #{req.memberId} &bull; {req.subjectName || `Môn #${req.subjectId}`}
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      Trạng thái: <strong className="text-slate-800">{req.status}</strong>
                      {req.note ? ` · Ghi chú: ${req.note}` : ""}
                    </div>
                  </div>
                  {isPending && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        disabled={decidingId !== null}
                        onClick={() => handleCoachDecision(req, "APPROVE")}
                        aria-label={`Duyệt nhận yêu cầu học viên #${req.memberId}`}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-bold flex items-center gap-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 transition-all"
                      >
                        {decidingId === req.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {decidingId === req.id ? "Đang xử lý..." : "Duyệt nhận"}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={decidingId !== null}
                        onClick={() => handleCoachDecision(req, "REJECT")}
                        aria-label={`Từ chối yêu cầu học viên #${req.memberId}`}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 disabled:cursor-not-allowed text-rose-700 border border-rose-200 rounded font-bold flex items-center gap-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1 transition-all"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Từ chối</span>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Main Content Area: API Mode Candidates OR Mock Mode Members */}
      {apiEnabled ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-700" />
              <span>Gói Học Viên 1-Kèm-1 Được Phân Công (API Mode)</span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={loadingRequests}
                onClick={() => loadAdvancedRequests().catch(() => {})}
                aria-label="Làm mới danh sách gói"
                className="p-1 text-slate-500 hover:text-slate-800 rounded transition-all cursor-pointer"
                title="Làm mới danh sách gói"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingRequests ? "animate-spin" : ""}`} />
              </button>
              {loadingRequests && (
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang tải...
                </span>
              )}
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

          {apiBookingCandidates.length === 0 && !loadingRequests && !requestsError ? (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-xs text-slate-500">
              Chưa có học viên hoặc gói 1-kèm-1 nào được phân công trực tiếp cho HLV.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {apiBookingCandidates.map((item) => {
                const entitlement = checkRegistrationEntitlement(item, currentUser)
                const canBook = entitlement.canBook
                const unbookableReason = entitlement.reason

                const credit = Number(item.remainingCredit ?? 0)
                const isSubActive = String(item.subscriptionStatus || "").toLowerCase() === "active"

                const hasUnresolvedConflict =
                  unresolvedAttempt && unresolvedAttempt.subscriptionId === Number(item.subscriptionId)
                const isOtherUnresolved =
                  unresolvedAttempt && unresolvedAttempt.subscriptionId !== Number(item.subscriptionId)

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {item.memberName || `Học viên #${item.memberId}`}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                          Học viên #{item.memberId} &bull; Môn: {item.subjectName || `Môn #${item.subjectId}`}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isSubActive
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {item.subscriptionStatus || item.status || "Chưa kích hoạt"}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-700">
                        <span className="flex items-center gap-1 font-bold">
                          <Award className="w-3.5 h-3.5 text-amber-600" />
                          <span>Mã gói tập (Subscription):</span>
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {item.subscriptionId ? `#${item.subscriptionId}` : "Chưa cấp"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-700">
                        <span className="flex items-center gap-1 font-bold">
                          <Target className="w-3.5 h-3.5 text-blue-600" />
                          <span>Số buổi khả dụng (Credit):</span>
                        </span>
                        <span
                          className={`font-mono font-bold tabular-nums ${
                            credit > 0 ? "text-emerald-700 font-bold" : "text-rose-600"
                          }`}
                        >
                          {credit} buổi
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-slate-700">
                        <span className="flex items-center gap-1 font-medium text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>Thời hạn gói (Giờ VN):</span>
                        </span>
                        <span className="font-mono text-slate-800">
                          {formatVietnamDateTime(item.expiresAt)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] text-slate-500 font-mono">
                        Đăng ký: {formatVietnamDateOnly(item.createdAt)}
                      </div>

                      <div className="flex items-center gap-2">
                        {hasUnresolvedConflict ? (
                          <button
                            type="button"
                            onClick={() => openBookPrivateModal(item)}
                            aria-label={`Xem lại đối soát cho học viên ${item.memberName || item.memberId} gói ${item.subscriptionId}`}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold shadow-xs flex items-center gap-1 whitespace-nowrap cursor-pointer transition-all animate-pulse"
                          >
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Đối soát giao dịch</span>
                          </button>
                        ) : isOtherUnresolved ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                              <Lock className="w-3 h-3 text-slate-400" />
                              Khóa (Đang có GD khác chờ đối soát)
                            </span>
                            <button
                              type="button"
                              disabled
                              aria-disabled="true"
                              className="px-3 py-1.5 bg-slate-100 text-slate-400 border border-slate-200 rounded text-xs font-bold flex items-center gap-1 cursor-not-allowed opacity-60"
                            >
                              <CalendarPlus className="w-3.5 h-3.5 shrink-0" />
                              <span>Đặt lịch PT 1:1</span>
                            </button>
                          </div>
                        ) : canBook ? (
                          <button
                            type="button"
                            onClick={() => openBookPrivateModal(item)}
                            aria-label={`Đặt lịch PT 1:1 cho học viên ${item.memberName || item.memberId} gói ${item.subscriptionId}`}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold shadow-xs flex items-center gap-1 whitespace-nowrap cursor-pointer transition-all"
                          >
                            <CalendarPlus className="w-3.5 h-3.5 shrink-0" />
                            <span>Đặt lịch PT 1:1</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium">
                              {unbookableReason}
                            </span>
                            <button
                              type="button"
                              disabled
                              aria-disabled="true"
                              className="px-3 py-1.5 bg-slate-100 text-slate-400 border border-slate-200 rounded text-xs font-bold flex items-center gap-1 cursor-not-allowed opacity-60"
                            >
                              <CalendarPlus className="w-3.5 h-3.5 shrink-0" />
                              <span>Đặt lịch PT 1:1</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* Mock Mode Member Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mockAssignedMembers.map((m) => {
            const plan = trainingPlans.find((p) => String(p.memberId) === String(m.id))
            const isAtRisk = atRiskIds.has(String(m.id))

            const mockCandidate = {
              id: m.id,
              memberId: m.id,
              memberName: m.name,
              subjectId: 1,
              subjectName: "Tennis",
              primaryCoachId: m.primaryCoachId || 1,
              subscriptionId: 1,
              subscriptionStatus: "Active",
              remainingCredit: 12,
              activatedAt: "2026-10-01T08:00:00",
              expiresAt: "2026-12-31T23:59:59",
            }

            return (
              <div
                key={m.id}
                className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4 hover:border-slate-300 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{m.name}</span>
                      {isAtRisk && (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          At-Risk
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 font-mono tabular-nums">
                      {m.code} &bull; {m.phone || m.email || "—"}
                    </div>
                  </div>
                  <StatusBadge type="membership" status={m.membershipStatus} />
                </div>

                <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-1 font-bold">
                      <Award className="w-3.5 h-3.5 text-amber-600" />
                      <span>Gói Membership:</span>
                    </span>
                    <span className="font-semibold text-slate-900">{m.currentPackageName}</span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700">
                    <span className="flex items-center gap-1 font-bold">
                      <Target className="w-3.5 h-3.5 text-blue-600" />
                      <span>Mục tiêu PT:</span>
                    </span>
                    <span className="font-medium text-slate-900">
                      {plan
                        ? language === "vi"
                          ? plan.goalVi
                          : plan.goal
                        : "Tăng cơ, giảm mỡ & nâng thể lực"}
                    </span>
                  </div>
                </div>

                {plan && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                      <span>Tiến độ kế hoạch:</span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {plan.progressPercent}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded overflow-hidden border border-slate-200">
                      <div
                        style={{ width: `${plan.progressPercent}%` }}
                        className="bg-slate-900 h-full rounded"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 font-mono">
                    Tham gia: {m.joinDate}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openBookPrivateModal(mockCandidate)}
                      className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold shadow-xs flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <CalendarPlus className="w-3.5 h-3.5 shrink-0" />
                      <span>{language === "vi" ? "Đặt lịch PT 1:1" : "Book 1:1 PT"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentTab("trainingProgress")}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold shadow-xs flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <Dumbbell className="w-3.5 h-3.5 shrink-0" />
                      <span>{language === "vi" ? "Giáo án" : "Training Plan"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Private PT Session Booking Modal (Mục 6 / D04) */}
      {bookingReg && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Đặt Buổi Tập Riêng 1-kèm-1 (Advanced PT)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Học viên: <strong>{bookingReg.memberName || `Học viên #${bookingReg.memberId}`}</strong> &bull; Gói:{" "}
                  <strong>#{bookingReg.subscriptionId}</strong> ({bookingReg.subjectName || `Môn #${bookingReg.subjectId}`})
                </p>
                <div className="text-[11px] text-emerald-800 font-medium mt-0.5">
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
                  <span>Giao dịch chưa xác nhận kết quả từ máy chủ</span>
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
                  <span>Xung đột mã yêu cầu (IDEMPOTENCY_CONFLICT)</span>
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
                  <span>Xung đột không xác định từ máy chủ (HTTP 409)</span>
                </div>
                <p className="text-[11px]">
                  {currentAttempt.error ||
                    "Máy chủ trả về phản hồi xung đột (409) không xác định. Giao dịch được giữ nguyên để đối soát, không tự động sinh mã mới."}
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
                  <span>Sai lệch phản hồi xác nhận từ máy chủ</span>
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
                      {roomsList.length === 0 ? (
                        <option value="">Không có sân tập khả dụng</option>
                      ) : (
                        roomsList.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name || `Sân #${r.id}`}
                          </option>
                        ))
                      )}
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
                    <span>Thử lại cùng giao dịch (Retry)</span>
                  ) : (
                    <span>Xác Nhận Đặt Lịch 1:1</span>
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
