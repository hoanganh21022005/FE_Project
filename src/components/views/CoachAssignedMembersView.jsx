import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useSCMS } from "../../context/SCMSContext"
import { CoachStatusBadge } from "../coach/StatusBadge"
import { formatMemberCode } from "../../utils/formatMember"
import { formatDate } from "../../utils/datetime"
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

const STANDARD_PRIVATE_SESSION_SLOTS = [
  [1, "06:00", "07:30"],
  [2, "07:45", "09:15"],
  [3, "09:30", "11:00"],
  [4, "13:00", "14:30"],
  [5, "14:45", "16:15"],
  [6, "16:30", "18:00"],
  [7, "18:15", "19:45"],
]

function isStandardPrivateSessionSlot(slot) {
  if (!slot) return false
  const slotNumber = Number(slot.slotNumber)
  const startTime = String(slot.startTime || "").slice(0, 5)
  const endTime = String(slot.endTime || "").slice(0, 5)
  return STANDARD_PRIVATE_SESSION_SLOTS.some(([number, start, end]) =>
    number === slotNumber && start === startTime && end === endTime,
  )
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

export function isRoomForSubject(room, regItem) {
  if (!room || !regItem) return true

  const targetSubjectId = regItem.subjectId ? String(regItem.subjectId).trim() : null
  const targetSubjectName = String(
    regItem.subjectName ||
    regItem.subject?.name ||
    regItem.specialty ||
    regItem.specialization ||
    "",
  ).trim().toLowerCase()

  // 1. Direct subjectId matching if room provides subject association
  if (targetSubjectId) {
    if (room.subjectId != null && String(room.subjectId).trim() === targetSubjectId) return true
    if (room.subject_id != null && String(room.subject_id).trim() === targetSubjectId) return true
    if (room.subject?.id != null && String(room.subject.id).trim() === targetSubjectId) return true
    if (Array.isArray(room.subjectIds) && room.subjectIds.some((id) => String(id).trim() === targetSubjectId)) return true
    if (Array.isArray(room.subjects) && room.subjects.some((s) => String(s?.id ?? s).trim() === targetSubjectId)) return true
  }

  // 2. Direct room subject / sport / activity name matching
  const roomSubjectName = String(
    room.subjectName ||
    room.subject?.name ||
    room.sport ||
    room.sportName ||
    room.activityType ||
    "",
  ).trim().toLowerCase()
  if (roomSubjectName && targetSubjectName) {
    if (roomSubjectName.includes(targetSubjectName) || targetSubjectName.includes(roomSubjectName)) {
      return true
    }
  }

  // 3. Normalized string matching on roomCode, name, and location
  const roomName = String(room.name || "").toLowerCase()
  const roomLocation = String(room.location || "").toLowerCase()
  const roomCode = String(room.roomCode || "").toUpperCase()
  const roomCombined = `${roomCode} ${roomName} ${roomLocation}`

  const SPORT_DICTIONARY = [
    {
      keys: ["quần vợt", "tennis"],
      roomTerms: ["quần vợt", "tennis"],
      codes: ["TEN", "TNS"],
    },
    {
      keys: ["bắn cung", "archery"],
      roomTerms: ["bắn cung", "archery"],
      codes: ["ARC"],
    },
    {
      keys: ["bơi", "swimming", "swim"],
      roomTerms: ["bơi", "swimming", "swim", "hồ bơi", "bể bơi", "pool"],
      codes: ["SWM", "SWI"],
    },
    {
      keys: ["cầu lông", "badminton"],
      roomTerms: ["cầu lông", "badminton"],
      codes: ["BAD", "BDM"],
    },
    {
      keys: ["bóng bàn", "table tennis", "ping pong", "pingpong"],
      roomTerms: ["bóng bàn", "table tennis", "ping pong", "pingpong"],
      codes: ["TTN", "TAB"],
    },
    {
      keys: ["bóng rổ", "basketball"],
      roomTerms: ["bóng rổ", "basketball"],
      codes: ["BKB", "BSK"],
    },
    {
      keys: ["bóng chuyền", "volleyball"],
      roomTerms: ["bóng chuyền", "volleyball"],
      codes: ["VLB", "VOL"],
    },
    {
      keys: ["bóng đá", "football", "soccer"],
      roomTerms: ["bóng đá", "sân cỏ", "football", "soccer"],
      codes: ["FTB", "SOC"],
    },
    {
      keys: ["bắn súng", "shooting"],
      roomTerms: ["bắn súng", "shooting", "súng hơi", "laser 10m"],
      codes: ["SHT", "GUN"],
    },
    {
      keys: ["pickleball"],
      roomTerms: ["pickleball"],
      codes: ["PCK", "PKB"],
    },
    {
      keys: ["gym", "fitness", "thể hình"],
      roomTerms: ["gym", "fitness", "thể hình"],
      codes: ["GYM", "FIT"],
    },
    {
      keys: ["yoga", "pilates"],
      roomTerms: ["yoga", "pilates"],
      codes: ["YOG", "PIL"],
    },
    {
      keys: ["boxing", "vovinam", "quyền anh", "võ thuật", "võ"],
      roomTerms: ["boxing", "vovinam", "quyền anh", "võ thuật", "đối kháng"],
      codes: ["BOX", "VOV"],
    },
  ]

  for (const item of SPORT_DICTIONARY) {
    const isTargetSport = item.keys.some((k) => targetSubjectName.includes(k))
    if (isTargetSport) {
      const hasTerm = item.roomTerms.some((t) => roomCombined.includes(t))
      const hasCode = item.codes.some((c) => roomCode.includes(c))
      if (hasTerm || hasCode) {
        return true
      }
    }
  }

  // 4. Token-level matching (e.g., "Tennis", "Quần vợt")
  if (targetSubjectName) {
    const tokens = targetSubjectName
      .replace(/[()[\]{}_-]/g, " ")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3)
    if (tokens.some((token) => roomCombined.includes(token))) {
      return true
    }
  }

  return false
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
  const [privateSessionProposals, setPrivateSessionProposals] = useState([])
  const [loadingProposals, setLoadingProposals] = useState(false)
  const [proposalsError, setProposalsError] = useState(null)
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

  const modalSubjectRooms = useMemo(() => {
    if (!bookingReg) return roomsList
    const matched = roomsList.filter((r) => isRoomForSubject(r, bookingReg))
    return matched.length > 0 ? matched : roomsList
  }, [roomsList, bookingReg])

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
  const [requestKey, setRequestKey] = useState(() => generateRequestKey())
  const [proposalResponse, setProposalResponse] = useState(null)
  const [proposalError, setProposalError] = useState("")

  const loadAdvancedRequests = useCallback(async () => {
    if (!apiEnabled) return
    setLoadingRequests(true)
    setRequestsError(null)
    try {
      const list = await memberPortalApi.getAdvancedRegistrations()
      setAdvancedRequests(Array.isArray(list) ? list : [])
    } catch (err) {
      setRequestsError(getErrorMessage(err, "Không thể tải danh sách đăng ký 1-kèm-1."))
      throw err
    } finally {
      setLoadingRequests(false)
    }
  }, [apiEnabled])

  const loadPrivateSessionProposals = useCallback(async () => {
    if (!apiEnabled) {
      setPrivateSessionProposals([])
      setProposalsError(null)
      return []
    }
    setLoadingProposals(true)
    setProposalsError(null)
    try {
      const rows = await memberPortalApi.getPrivateSessionProposals()
      const list = Array.isArray(rows) ? rows : []
      setPrivateSessionProposals(list)
      return list
    } catch (err) {
      setProposalsError(getErrorMessage(err, language === "vi" ? "Không thể tải danh sách đề xuất lịch." : "Could not load schedule proposals."))
      throw err
    } finally {
      setLoadingProposals(false)
    }
  }, [apiEnabled, language])

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
    loadPrivateSessionProposals().catch(() => {})
    loadRooms().catch(() => {})
    return () => {
      active = false
    }
  }, [apiEnabled, loadAdvancedRequests, loadPrivateSessionProposals, loadRooms, currentUser?.coachId, currentUser?.id])

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
        const validSlots = rawSlots.filter(isStandardPrivateSessionSlot)
        setAvailableSlots(validSlots)
        const firstAvail = validSlots.find((s) => s.isAvailable === true)
        if (firstAvail) {
          setSelectedSlot(firstAvail)
        }
      } catch (err) {
        if (reqId !== slotsRequestIdRef.current || currentModalSession !== modalSessionRef.current) return
        const rawMsg = String(err?.message || err || "")
        if (rawMsg.toLowerCase().includes("does not serve")) {
          setSlotsError(
            language === "vi"
              ? "Sân tập này không phục vụ bộ môn đã chọn. Vui lòng chọn sân phù hợp."
              : "This room does not serve the selected subject. Please select a suitable court.",
          )
        } else {
          setSlotsError(getErrorMessage(err, "Không thể tải danh sách ca trống."))
        }
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
            "Có lỗi xảy ra. Hãy tải lại trang rồi thử lại.",
            "error",
          )
        }
      } else {
        if (respStatus === "REJECTED" || respStatus === "DECLINED" || !response?.status) {
          showToast?.(t("coachPtDecisionRejectedToast"), "info")
        } else {
          showToast?.(
            "Có lỗi xảy ra. Hãy tải lại trang rồi thử lại.",
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

  // Open the proposal form for an active Advanced subscription.
  const openBookPrivateModal = async (regItem) => {
    if (!regItem) return
    const targetSubId = Number(regItem.subscriptionId)
    const openSession = ++modalSessionRef.current
    currentOpenSubIdRef.current = targetSubId
    setBookingReg(regItem)
    setSlotsError(null)
    setProposalResponse(null)
    setProposalError("")
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

    const matchingRooms = currentRooms.filter((r) => isRoomForSubject(r, regItem))
    const eligibleRooms = matchingRooms.length > 0 ? matchingRooms : currentRooms
    const initialRoomId = eligibleRooms && eligibleRooms.length > 0 ? String(eligibleRooms[0].id) : ""
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

    const matchingRooms = valid.filter((r) => isRoomForSubject(r, targetReg))
    const pool = matchingRooms.length > 0 ? matchingRooms : valid
    const stillAvailable = pool.some((r) => String(r.id) === String(selectedRoomId))
    if (stillAvailable && selectedRoomId) {
      fetchAvailableSlots(targetDate, selectedRoomId, targetReg)
    } else if (pool.length > 0) {
      const firstRoomId = String(pool[0].id)
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
    setBookingDate(newDate)
    setRequestKey(generateRequestKey())
    setProposalResponse(null)
    setProposalError("")
    if (bookingReg && selectedRoomId) {
      fetchAvailableSlots(newDate, selectedRoomId, bookingReg)
    }
  }

  // Change Room
  const handleRoomChange = (newRoomId) => {
    setSelectedRoomId(newRoomId)
    setRequestKey(generateRequestKey())
    setProposalResponse(null)
    setProposalError("")
    if (bookingReg && newRoomId) {
      fetchAvailableSlots(bookingDate, newRoomId, bookingReg)
    }
  }

  // Select Slot
  const handleSelectSlot = (slot) => {
    setSelectedSlot(slot)
    setRequestKey(generateRequestKey())
    setProposalResponse(null)
    setProposalError("")
  }

  // Send a proposal only; Member acceptance creates the scheduled session.
  const handleSendPrivateSessionProposal = async (e) => {
    e.preventDefault()
    if (isSubmittingRef.current || bookingBusy || proposalResponse || !bookingReg) return
    if (!apiEnabled) {
      setProposalError(language === "vi" ? "Kết nối Backend để gửi đề xuất lịch." : "Connect to the server to send a schedule proposal.")
      return
    }

    const entitlement = checkRegistrationEntitlement(bookingReg, currentUser)
    if (!entitlement.canBook) {
      setProposalError(entitlement.reason)
      return
    }
    if (!isPositiveInteger(bookingReg.subscriptionId) || !isPositiveInteger(bookingReg.subjectId)
      || !isPositiveInteger(bookingReg.primaryCoachId) || !isPositiveInteger(bookingReg.memberId)) {
      setProposalError(language === "vi" ? "Thiếu thông tin Member, gói, môn hoặc Coach." : "Member, subscription, subject, or Coach details are missing.")
      return
    }
    const selectedRoom = roomsList.find((room) => Number(room.id) === Number(selectedRoomId))
    if (!selectedRoom || !isRoomAvailable(selectedRoom, true) || !isRoomForSubject(selectedRoom, bookingReg)) {
      setProposalError(language === "vi" ? "Vui lòng chọn phòng khả dụng cho môn học." : "Select an available room for this subject.")
      return
    }
    const availableChoice = availableSlots.some((slot) =>
      Number(slot.slotNumber) === Number(selectedSlot?.slotNumber)
      && String(slot.startTime).slice(0, 5) === String(selectedSlot?.startTime).slice(0, 5)
      && String(slot.endTime).slice(0, 5) === String(selectedSlot?.endTime).slice(0, 5)
      && slot.isAvailable === true,
    )
    if (!isStandardPrivateSessionSlot(selectedSlot) || !availableChoice) {
      setProposalError(language === "vi" ? "Chọn một trong 7 ca chuẩn 90 phút còn khả dụng." : "Choose one of the seven available standard 90-minute slots.")
      return
    }
    if (!agreementConfirmed) {
      setProposalError(language === "vi" ? "Coach cần xác nhận đã trao đổi và thống nhất lịch với Member." : "Confirm that you agreed on the schedule with the Member.")
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
      setProposalError(language === "vi" ? "Vui lòng chọn ngày hợp lệ." : "Choose a valid session date.")
      return
    }

    const startTime = String(selectedSlot.startTime).slice(0, 5)
    const endTime = String(selectedSlot.endTime).slice(0, 5)
    const sessionStartMs = parseVietnamDateTime(bookingDate + "T" + startTime)
    const sessionEndMs = parseVietnamDateTime(bookingDate + "T" + endTime)
    const expiresAtMs = parseVietnamDateTime(bookingReg.expiresAt)
    if (Number.isNaN(sessionStartMs) || Number.isNaN(sessionEndMs) || Number.isNaN(expiresAtMs)) {
      setProposalError(language === "vi" ? "Không xác minh được ngày học hoặc hạn gói từ Backend." : "Could not verify the session date or subscription expiry from the server.")
      return
    }
    if (sessionStartMs - Date.now() < 12 * 60 * 60 * 1000) {
      setProposalError(language === "vi" ? "Đề xuất cần được gửi trước giờ học ít nhất 12 tiếng." : "Send the proposal at least 12 hours before the session.")
      return
    }
    if (sessionEndMs > expiresAtMs) {
      setProposalError(language === "vi" ? "Ca học vượt quá thời hạn sử dụng gói 45 ngày." : "The session falls beyond the subscription validity period.")
      return
    }

    const payload = {
      subscriptionId: Number(bookingReg.subscriptionId),
      subjectId: Number(bookingReg.subjectId),
      coachId: Number(bookingReg.primaryCoachId),
      roomId: Number(selectedRoom.id),
      sessionDate: bookingDate,
      startTime,
      endTime,
      agreementConfirmed: true,
      requestKey,
    }
    isSubmittingRef.current = true
    setBookingBusy(true)
    setProposalError("")
    try {
      const response = await memberPortalApi.createPrivateSessionProposal(payload)
      if (!isPositiveInteger(response?.id) || String(response?.status).toLowerCase() !== "pending" || response?.sessionId != null || !response?.respondBy) {
        throw new Error("The server response did not match a Pending private-session proposal.")
      }
      setProposalResponse(response)
      loadPrivateSessionProposals().catch(() => {})
      showToast?.(language === "vi" ? "Đã gửi lịch, chờ học viên xác nhận." : "Schedule proposal sent; waiting for Member confirmation.", "success")
    } catch (error) {
      let message = getErrorMessage(error, language === "vi" ? "Không gửi được đề xuất lịch." : "Could not send the schedule proposal.")
      let didReconcileProposal = false
      if (!error?.status || error.status >= 500) {
        try {
          const rows = await memberPortalApi.getPrivateSessionProposals()
          setPrivateSessionProposals(Array.isArray(rows) ? rows : [])
          const matchingProposal = (Array.isArray(rows) ? rows : []).find((item) =>
            String(item.status || "").toLowerCase() === "pending"
            && item.sessionId == null
            && String(item.subscriptionId) === String(payload.subscriptionId)
            && String(item.subjectId) === String(payload.subjectId)
            && String(item.coachId) === String(payload.coachId)
            && String(item.roomId) === String(payload.roomId)
            && String(item.sessionDate).slice(0, 10) === payload.sessionDate
            && String(item.startTime).slice(0, 5) === payload.startTime
            && String(item.endTime).slice(0, 5) === payload.endTime,
          )
          if (matchingProposal) {
            setProposalResponse(matchingProposal)
            message = language === "vi"
              ? "Đã tìm thấy đề xuất trên Backend khi đối soát; không gửi thêm đề xuất."
              : "The proposal was found during reconciliation; no duplicate was sent."
            didReconcileProposal = true
          } else {
            message = language === "vi"
              ? "Chưa xác minh được đề xuất sau timeout. Đã tải lại danh sách; nếu thử lại, giữ nguyên lịch để dùng cùng requestKey."
              : "The timed-out proposal was not found. The list was reloaded; retry only with this same schedule and requestKey."
          }
        } catch {
          message = language === "vi"
            ? "Chưa đối soát được kết quả timeout. Không gửi lại; hãy tải lại danh sách đề xuất trước."
            : "The timeout outcome could not be reconciled. Do not resend; reload proposals first."
        }
      }
      setProposalError(message)
      showToast?.(message, didReconcileProposal ? "success" : "error")
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
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-bg-secondary text-brand-primary rounded border border-border-color">
            <CalendarPlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl leading-7 font-semibold text-text-primary whitespace-nowrap">
              {language === "vi" ? "Đề xuất lịch PT 1:1" : "1:1 Private Session Proposals"}
            </h2>
            <p className="text-sm leading-5 text-text-secondary whitespace-nowrap">
              {language === "vi" ? "Chọn Member và gói Advanced Active để gửi đề xuất; Member sẽ xác nhận trước khi lịch được lên lịch." : "Select a Member and active Advanced subscription to propose a time; the Member confirms before it is scheduled."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {apiEnabled && (
            <button
              type="button"
              disabled={loadingRequests || loadingProposals}
              onClick={() => {
                loadAdvancedRequests().catch(() => {})
                loadPrivateSessionProposals().catch(() => {})
              }}
              title={t("coachBtnRefresh")}
              aria-label={t("coachBtnRefresh")}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded border border-border-color bg-bg-card text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loadingRequests || loadingProposals ? "animate-spin" : ""}`} />
            </button>
          )}
          <div className="text-xs leading-4 font-mono font-semibold bg-bg-secondary border border-border-color px-3 py-2 rounded text-text-primary">
            Tổng số: {apiBookingCandidates.length} {t("coachPkgLabel")}
          </div>
        </div>
      </div>

      {/* Pending Advanced PT Coach Requests (ONLY REQUESTED / PENDING) */}
      {pendingAdvancedRequests.length > 0 && (
        <div className="rounded-lg border border-status-warning-border bg-bg-card p-4 text-text-primary space-y-3">
          <div className="flex items-center justify-between border-b border-border-color pb-2.5">
            <h3 className="text-lg leading-7 font-semibold text-text-primary flex items-center gap-2">
              <Clock className="w-4 h-4 text-status-warning" />
              <span>Yêu cầu đăng ký PT 1:1 chờ duyệt</span>
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-status-warning-bg text-status-warning ring-1 ring-inset ring-status-warning-border">
                {pendingAdvancedRequests.length}
              </span>
            </h3>
          </div>
          <div className="divide-y divide-border-color">
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
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm leading-5"
                >
                  <div>
                    <div className="font-semibold text-text-primary">
                      {memberDisplayName} &bull; {subjectDisplayName}
                    </div>
                    <div className="text-text-secondary mt-0.5">
                      Trạng thái:{" "}
                      <strong className="text-status-warning">
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
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-3 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active cursor-pointer"
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
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-3 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-danger focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-status-danger text-text-inverse hover:bg-status-danger/90 cursor-pointer"
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

      {apiEnabled && (
        <section className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-3" aria-labelledby="sent-proposals-heading">
          <div className="flex flex-col gap-2 border-b border-border-color pb-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 id="sent-proposals-heading" className="text-lg leading-7 font-semibold">
                {language === "vi" ? "Đề xuất lịch đã gửi" : "Sent schedule proposals"}
                <span className="ml-2 inline-flex items-center rounded-full bg-bg-secondary px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ring-border-color">
                  {privateSessionProposals.length}
                </span>
              </h3>
              <p className="mt-1 text-xs text-text-secondary">
                {language === "vi" ? "Đề xuất đang chờ không giữ phòng và không trừ Credit." : "Pending proposals do not reserve a room or consume a credit."}
              </p>
            </div>
            <button
              type="button"
              disabled={loadingProposals}
              onClick={() => loadPrivateSessionProposals().catch(() => {})}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded border border-border-color px-3 text-xs font-semibold hover:bg-bg-secondary disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingProposals ? "animate-spin" : ""}`} />
              {language === "vi" ? "Tải lại" : "Refresh"}
            </button>
          </div>

          {proposalsError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded border border-status-danger-border bg-status-danger-bg p-3 text-sm text-status-danger">
              <span>{proposalsError}</span>
              <button type="button" onClick={() => loadPrivateSessionProposals().catch(() => {})} className="font-semibold underline">
                {language === "vi" ? "Thử lại" : "Retry"}
              </button>
            </div>
          )}

          {loadingProposals && privateSessionProposals.length === 0 ? (
            <div className="flex items-center gap-2 py-4 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              {language === "vi" ? "Đang tải đề xuất lịch..." : "Loading proposals..."}
            </div>
          ) : privateSessionProposals.length === 0 ? (
            <p className="py-3 text-sm text-text-secondary">
              {language === "vi" ? "Chưa có đề xuất lịch nào." : "No schedule proposals yet."}
            </p>
          ) : (
            <div className="divide-y divide-border-color">
              {privateSessionProposals.map((proposal) => {
                const registration = advancedRequests.find((item) =>
                  String(item.memberId) === String(proposal.memberId)
                  && String(item.subscriptionId || item.id) === String(proposal.subscriptionId),
                ) || advancedRequests.find((item) => String(item.memberId) === String(proposal.memberId))
                const memberName = proposal.memberName || registration?.memberName || registration?.fullName
                  || (proposal.memberId ? `${language === "vi" ? "Học viên" : "Member"} #${proposal.memberId}` : (language === "vi" ? "Học viên" : "Member"))
                const subject = proposal.subjectName || registration?.subjectName
                  || (proposal.subjectId ? `${language === "vi" ? "Môn" : "Subject"} #${proposal.subjectId}` : "—")
                const room = roomsList.find((item) => String(item.id) === String(proposal.roomId))
                const status = String(proposal.status || "Unknown")
                const normalizedStatus = status.toLowerCase()
                const statusLabel = normalizedStatus === "pending" ? (language === "vi" ? "Đang chờ" : "Pending")
                  : normalizedStatus === "accepted" ? (language === "vi" ? "Đã xác nhận" : "Accepted")
                    : normalizedStatus === "rejected" ? (language === "vi" ? "Đã từ chối" : "Rejected")
                      : normalizedStatus === "expired" ? (language === "vi" ? "Đã hết hạn" : "Expired") : status
                return (
                  <article key={proposal.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="space-y-1">
                      <p className="font-semibold">{memberName} <span className="font-normal text-text-secondary">· {subject}</span></p>
                      <p className="text-text-secondary">
                        {proposal.sessionDate || "—"} · {String(proposal.startTime || "").slice(0, 5)}–{String(proposal.endTime || "").slice(0, 5)} · {room?.name || (proposal.roomId ? `Room #${proposal.roomId}` : "—")}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {language === "vi" ? "Hạn phản hồi: " : "Respond by: "}{proposal.respondBy ? formatVietnamDateTime(proposal.respondBy) : "—"}
                        {proposal.sessionId != null && <> · {language === "vi" ? "Buổi tập #" : "Session #"}{proposal.sessionId}</>}
                      </p>
                    </div>
                    <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${normalizedStatus === "pending" ? "bg-status-warning-bg text-status-warning" : normalizedStatus === "accepted" ? "bg-status-success-bg text-status-success" : normalizedStatus === "rejected" || normalizedStatus === "expired" ? "bg-status-danger-bg text-status-danger" : "bg-bg-secondary text-text-secondary"}`}>
                      {statusLabel}
                    </span>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Main Content Area: API Candidates */}
      <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-lg border border-border-color bg-bg-card p-4 text-text-primary">
            <h3 className="text-lg leading-7 font-semibold text-text-primary flex items-center gap-2">
              <CalendarPlus className="w-4 h-4 text-brand-primary" />
              <span>
                {language === "vi"
                  ? `Danh sách học viên & Đăng ký sân PT 1:1 (${groupedStudentCards.length} học viên)`
                  : `1:1 PT Students & Court Booking (${groupedStudentCards.length} members)`}
              </span>
            </h3>

            {/* Search & Filter Bar (P2.4) */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  placeholder={t("coachSearchStudentPlaceholder")}
                  className="min-h-11 w-full sm:w-56 rounded border border-border-strong bg-bg-card pl-9 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
                />
              </div>

              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="min-h-11 w-full sm:w-44 rounded border border-border-strong bg-bg-card px-3 py-1.5 text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted cursor-pointer"
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
                className="min-h-11 w-full sm:w-48 rounded border border-border-strong bg-bg-card px-3 py-1.5 text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted cursor-pointer"
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
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded border border-border-color bg-bg-card text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
                title={t("coachBtnRefresh")}
              >
                <RefreshCw className={`w-4 h-4 ${loadingRequests ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {requestsError && (
            <div className="p-4 bg-status-danger-bg border border-status-danger-border rounded-lg text-sm leading-5 text-status-danger flex items-center justify-between">
              <span>{requestsError}</span>
              <button
                type="button"
                onClick={() => loadAdvancedRequests().catch(() => {})}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-3 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary cursor-pointer"
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
                  className="h-48 bg-bg-secondary animate-pulse rounded-lg border border-border-color"
                />
              ))}
            </div>
          ) : groupedStudentCards.length === 0 && !requestsError ? (
            <div className="rounded-lg border border-border-color bg-bg-card p-8 text-center text-sm leading-5 text-text-secondary">
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
                // Derive a human-readable block reason for the student-level disabled button
                const primaryBlockReason = (() => {
                  if (studentGroup.packages.length === 0) return null
                  const pkg = studentGroup.packages[0]
                  const ent = checkRegistrationEntitlement(pkg, currentUser)
                  return getPackageActionBlockReason(pkg, t) || ent.reason || null
                })()
                const recommendedPkg = bookablePackages[0] || null
                const selectedPkgId =
                  selectedPkgByMember[studentGroup.memberKey] ??
                  (recommendedPkg ? String(recommendedPkg.id) : "")
                const activeSelectedPkg =
                  bookablePackages.find(
                    (p) => String(p.id) === String(selectedPkgId),
                  ) || recommendedPkg

                const formatPkgName = (pkg) => {
                  const subjectName = String(pkg.subjectName || pkg.subject?.name || "").trim()
                  const packageName = String(pkg.packageName || "")
                    .replace(/^g[oó]i\s*#?\d+\s*[·:-]?\s*/i, "")
                    .trim()
                  if (subjectName && packageName) {
                    return packageName.toLocaleLowerCase().includes(subjectName.toLocaleLowerCase())
                      ? packageName
                      : `${subjectName} · ${packageName}`
                  }
                  if (packageName) return packageName
                  if (subjectName) {
                    return pkg.subscriptionId
                      ? `${subjectName} · PT 1:1`
                      : `${subjectName} (${t("coachPtAwaitingPackagePayment")})`
                  }
                  return "PT 1:1"
                }

                return (
                  <div
                    key={studentGroup.memberKey}
                    className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-4 hover:bg-bg-secondary/30 transition-colors"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-color pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm leading-5 font-semibold text-text-primary">
                            {memberDisplayName}
                          </span>
                          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-bg-secondary text-text-secondary ring-1 ring-inset ring-border-color font-mono">
                            {memberCodeLabel}
                          </span>
                        </div>
                        <div className="text-xs leading-4 font-medium text-text-secondary mt-0.5">
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
                        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-3 text-xs font-medium leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary whitespace-nowrap cursor-pointer"
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
                        <div className="p-3 bg-status-warning-bg border border-status-warning-border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm leading-5 text-status-warning">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-status-warning shrink-0" />
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
                            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-3 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active cursor-pointer shrink-0 self-start sm:self-auto"
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
                            className={`p-3.5 rounded-lg border space-y-2 text-sm leading-5 transition-colors ${
                              isSelectedForBooking
                                ? "bg-emerald-50/40 border-status-success-border"
                                : "bg-bg-secondary border-border-color"
                            } ${canBook && bookablePackages.length > 1 ? "cursor-pointer" : ""}`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-text-primary flex items-center gap-1.5">
                                <Award className="w-3.5 h-3.5 text-status-warning shrink-0" />
                                <span>{formatPkgName(item)}</span>
                                {isRecommended && (
                                  <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-status-success-bg text-status-success ring-1 ring-inset ring-status-success-border">
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
                              <div className="flex items-center justify-between text-text-primary text-xs leading-4">
                                <span className="font-medium text-text-secondary">
                                  {t("coachRemainingSessionsLabel")}:
                                </span>
                                <span
                                  className={`font-mono font-semibold tabular-nums ${
                                    credit > 0 ? "text-status-success" : "text-status-danger"
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
                                <div className="w-full h-1.5 bg-border-color rounded overflow-hidden">
                                  <div
                                    style={{ width: `${progressPct}%` }}
                                    className={`h-full rounded ${
                                      credit > 0 ? "bg-status-success" : "bg-status-danger"
                                    }`}
                                  />
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs leading-4 text-text-secondary pt-1">
                              <div className="flex flex-wrap items-center gap-3 font-mono">
                                <span>
                                  {t("coachPkgRegDateLabel")}:{" "}
                                  <strong className="text-text-primary">{regDateLabel}</strong>
                                </span>
                                <span>
                                  {t("coachExpiryDateLabel")}:{" "}
                                  <strong className="text-text-primary">{formatVietnamDateOnly(item.expiresAt)}</strong>
                                </span>
                              </div>

                              {!canBook && unbookableReason && (
                                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-status-warning-bg text-status-warning ring-1 ring-inset ring-status-warning-border">
                                  {unbookableReason}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* R3.2: Single Student-level PT Booking Control with package selector & explicit deduction label */}
                    <div className="pt-3 border-t border-border-color flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {activeSelectedPkg ? (
                        <>
                          <div className="space-y-1 text-sm leading-5">
                            <div className="text-text-primary font-medium">
                              {language === "vi" ? `Gói ${formatPkgName(activeSelectedPkg)} còn ${activeSelectedPkg.remainingCredit ?? 0} buổi. Đề xuất Pending không giữ sân hoặc trừ credit.` : `${formatPkgName(activeSelectedPkg)} has ${activeSelectedPkg.remainingCredit ?? 0} credits. A Pending proposal reserves no room and consumes no credit.`}
                            </div>
                            {bookablePackages.length > 1 && (
                              <div className="flex items-center gap-2">
                                <label
                                  htmlFor={`pkg-select-${studentGroup.memberKey}`}
                                  className="text-xs leading-4 font-medium text-text-secondary"
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
                                  className="min-h-11 rounded border border-border-strong bg-bg-card px-2.5 py-1 text-xs text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted cursor-pointer"
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
                            <button
                              type="button"
                              onClick={() => openBookPrivateModal(activeSelectedPkg)}
                              aria-label={`Send a private-session proposal for ${memberDisplayName}`}
                              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-3 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active whitespace-nowrap cursor-pointer"
                            >
                              <CalendarPlus className="w-3.5 h-3.5 shrink-0" />
                              <span>{language === "vi" ? "Gửi đề xuất lịch" : "Send schedule proposal"}</span>
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between w-full gap-2 text-sm leading-5 text-text-secondary">
                          <span>
                            {primaryBlockReason
                              ? primaryBlockReason
                              : language === "vi"
                                ? "Chưa có gói PT đủ điều kiện đặt lịch."
                                : "No eligible PT package available for booking."}
                          </span>
                          <button
                            type="button"
                            disabled
                            aria-disabled="true"
                            title={primaryBlockReason || (language === "vi" ? "Không có gói PT hợp lệ" : "No valid PT package")}
                            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-3 text-xs font-medium leading-5 border border-border-color bg-bg-card text-text-secondary whitespace-nowrap"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark/60 p-4 backdrop-blur-2xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-pt-modal-title"
        >
          <div className="rounded-lg border border-border-color bg-bg-card text-text-primary shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-border-color flex items-center justify-between bg-bg-secondary">
              <h3
                id="reject-pt-modal-title"
                className="text-lg leading-7 font-semibold text-text-primary flex items-center gap-2"
              >
                <XCircle className="w-4 h-4 text-status-danger" />
                <span>{t("coachPtRejectModalTitle")}</span>
              </h3>
              <button
                type="button"
                onClick={() => setRejectModalTarget(null)}
                aria-label={t("coachCancelBtn") || "Đóng"}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-text-secondary transition-colors hover:bg-bg-card hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmReject} className="p-5 space-y-4">
              <p className="text-sm leading-5 text-text-secondary">
                {t("coachPtRejectModalDesc")}
              </p>
              <div className="p-2.5 bg-bg-secondary border border-border-color rounded text-sm leading-5 text-text-primary">
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
                  className="block text-xs leading-4 font-medium text-text-secondary"
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
                  className="min-h-11 w-full rounded border border-border-strong bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
                  autoFocus
                />
                {rejectReasonError && (
                  <p className="text-xs leading-4 text-status-danger font-medium">
                    {rejectReasonError}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setRejectModalTarget(null)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary cursor-pointer"
                >
                  {t("coachCancelBtn")}
                </button>
                <button
                  type="submit"
                  disabled={decidingId !== null}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-danger focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-status-danger text-text-inverse hover:bg-status-danger/90 cursor-pointer"
                >
                  {decidingId !== null && (
                    <Loader2 className="w-4 h-4 animate-spin" />
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
        <div className="fixed inset-0 z-50 bg-brand-dark/60 flex items-center justify-center p-4">
          <div className="rounded-lg border border-border-color bg-bg-card text-text-primary w-full max-w-lg shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <div>
                <h3 className="text-lg leading-7 font-semibold text-text-primary">
                  {language === "vi" ? "Gửi đề xuất lịch PT 1:1" : "Send a 1:1 PT schedule proposal"}
                </h3>
                <p className="text-sm leading-5 text-text-secondary mt-0.5">
                  Học viên: <strong className="text-text-primary">{bookingReg.memberName || `Học viên #${bookingReg.memberId}`}</strong> &bull; Gói:{" "}
                  <strong className="text-text-primary">#{bookingReg.subscriptionId}</strong> ({bookingReg.subjectName || `Môn #${bookingReg.subjectId}`})
                </p>
                <div className="text-xs leading-4 text-status-success font-medium mt-0.5">
                  Số buổi khả dụng: <strong>{bookingReg.remainingCredit ?? 0} buổi</strong> &bull; Hạn dùng:{" "}
                  <strong>{formatVietnamDateTime(bookingReg.expiresAt)}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                aria-label="Đóng cửa sổ đặt lịch"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {proposalResponse && (
              <div role="status" className="rounded border border-status-success-border bg-status-success-bg p-3 text-sm leading-5 text-status-success">
                <p className="font-semibold">{language === "vi" ? "Đã gửi lịch, chờ học viên xác nhận" : "Schedule sent; waiting for Member confirmation"}</p>
                <p className="mt-1">{proposalResponse.sessionDate || bookingDate} | {String(proposalResponse.startTime || selectedSlot?.startTime || "").slice(0, 5)}-{String(proposalResponse.endTime || selectedSlot?.endTime || "").slice(0, 5)} | {roomsList.find((room) => Number(room.id) === Number(proposalResponse.roomId ?? selectedRoomId))?.name || ("Room #" + (proposalResponse.roomId ?? selectedRoomId))}</p>
                {proposalResponse.respondBy && <p className="mt-1">{language === "vi" ? "Hạn phản hồi: " : "Respond by: "}{formatVietnamDateTime(proposalResponse.respondBy)}</p>}
                <p className="mt-1">{language === "vi" ? "Trạng thái: " : "Status: "}{proposalResponse.status}</p>
              </div>
            )}
            {proposalError && <p role="alert" className="rounded border border-status-danger-border bg-status-danger-bg p-3 text-sm leading-5 text-status-danger">{proposalError}</p>}

            <form onSubmit={handleSendPrivateSessionProposal} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="booking-date-input" className="text-xs leading-4 font-medium text-text-secondary block mb-1">
                    Ngày tập (Tối thiểu 12h trước buổi) *
                  </label>
                  <input
                    id="booking-date-input"
                    type="date"
                    required
                    disabled={bookingBusy || Boolean(proposalResponse)}
                    value={bookingDate}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="min-h-11 w-full rounded border border-border-strong bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
                  />
                  <div className="text-xs leading-4 font-medium text-text-secondary font-mono mt-1">
                    {formatDate(bookingDate)}
                  </div>
                </div>

                <div>
                  <label htmlFor="booking-room-select" className="text-xs leading-4 font-medium text-text-secondary block mb-1">
                    Phòng / Sân tập *
                  </label>
                  {loadingRooms ? (
                    <div className="py-2 text-sm leading-5 text-text-secondary flex items-center gap-1">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang nạp danh sách sân...</span>
                    </div>
                  ) : roomsError ? (
                    <div className="text-xs leading-4 text-status-danger">
                      <span>{roomsError}</span>
                      <button
                        type="button"
                        onClick={handleRetryRooms}
                        className="ml-2 inline-flex min-h-11 items-center underline font-semibold cursor-pointer"
                      >
                        Thử lại
                      </button>
                    </div>
                  ) : (
                    <select
                      id="booking-room-select"
                      disabled={bookingBusy || Boolean(proposalResponse)}
                      value={selectedRoomId}
                      onChange={(e) => handleRoomChange(e.target.value)}
                      className="min-h-11 w-full rounded border border-border-strong bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
                    >
                      {modalSubjectRooms.length === 0 ? (
                        <option value="">{language === "vi" ? "Không có phòng phù hợp" : "No suitable room available"}</option>
                      ) : modalSubjectRooms.map((room) => (
                        <option key={room.id} value={room.id}>{formatRoomOptionLabel(room)}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Slots Section */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs leading-4 font-medium text-text-secondary">
                    Khung giờ khả dụng (Chuẩn 90 phút) *
                  </label>
                  {availableSlots.length > 0 && !loadingSlots && (
                    <span className="text-xs leading-4 font-medium text-text-secondary">
                      {availableSlots.filter((s) => s.isAvailable === true).length} ca trống
                    </span>
                  )}
                </div>

                {loadingSlots ? (
                  <div className="py-6 text-center text-sm leading-5 text-text-secondary flex items-center justify-center gap-2 border border-border-color rounded bg-bg-secondary">
                    <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
                    <span>Đang kiểm tra ca trống thực tế...</span>
                  </div>
                ) : slotsError ? (
                  <div className="p-3 bg-status-danger-bg border border-status-danger-border rounded text-sm leading-5 text-status-danger flex items-center justify-between">
                    <span>{slotsError}</span>
                    <button
                      type="button"
                      onClick={() => fetchAvailableSlots(bookingDate, selectedRoomId, bookingReg)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary cursor-pointer"
                    >
                      Thử lại tải ca
                    </button>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="py-5 text-center text-sm leading-5 text-text-secondary border border-border-color rounded bg-bg-secondary">
                    Không có ca trống nào khả dụng trong ngày và sân tập đã chọn.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-0.5">
                    {availableSlots.map((slot, idx) => {
                      const startStr = String(slot.startTime || "").slice(0, 5)
                      const endStr = String(slot.endTime || "").slice(0, 5)
                      const isSelected = selectedSlot?.startTime === slot.startTime
                      const disabled = slot.isAvailable !== true || bookingBusy || Boolean(proposalResponse)

                      return (
                        <button
                          key={slot.slotNumber || idx}
                          type="button"
                          disabled={disabled}
                          onClick={() => handleSelectSlot(slot)}
                          aria-label={`${slot.slotName || `Ca ${idx + 1}`} từ ${startStr} đến ${endStr} ${
                            slot.isAvailable !== true ? "(Đã kín)" : "(Còn trống)"
                          }`}
                          className={`min-h-11 p-2.5 rounded border text-left text-xs leading-4 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 ${
                            disabled
                              ? "bg-bg-secondary text-text-muted border-border-color cursor-not-allowed opacity-60"
                              : isSelected
                                ? "bg-brand-primary text-text-inverse border-brand-primary font-semibold"
                                : "bg-bg-card text-text-primary border-border-color hover:bg-bg-secondary"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{slot.slotName || slot.name || `Ca ${idx + 1}`}</span>
                            {slot.isAvailable !== true && (
                              <span className="text-xs leading-4 text-status-danger font-medium">Kín</span>
                            )}
                          </div>
                          <div className="font-mono text-xs leading-4 opacity-85 mt-0.5">
                            {startStr} – {endStr}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Agreement Confirmation Checkbox */}
              <div className="pt-2 border-t border-border-color">
                <label className="flex min-h-11 items-start gap-2.5 cursor-pointer text-sm leading-5 text-text-primary font-medium">
                  <input
                    type="checkbox"
                    required
                    disabled={bookingBusy || Boolean(proposalResponse)}
                    checked={agreementConfirmed}
                    onChange={(e) => setAgreementConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-border-strong text-brand-primary focus:ring-brand-primary cursor-pointer disabled:opacity-50"
                  />
                  <span>
                    HLV xác nhận đã thống nhất lịch tập trực tiếp với học viên theo quy định của trung tâm. *
                  </span>
                </label>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-border-color">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={
                    bookingBusy ||
                    Boolean(proposalResponse) ||
                    !selectedSlot ||
                    !agreementConfirmed ||
                    !isPositiveInteger(selectedRoomId) ||
                    !apiEnabled
                  }
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active cursor-pointer"
                >
                  {bookingBusy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending proposal...</span>
                    </>
                  ) : (
                    <span>{language === "vi" ? "Gửi đề xuất lịch" : "Send schedule proposal"}</span>
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
