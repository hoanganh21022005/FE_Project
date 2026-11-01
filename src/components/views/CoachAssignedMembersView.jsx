import React, { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { StatusBadge } from "../common/Badge"
import { memberApi } from "../../api/memberApi"
import { memberPortalApi } from "../../api/memberPortalApi"
import { getErrorMessage } from "../../api/apiErrors"
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
  const [decidingId, setDecidingId] = useState(null)
  const isProcessingRef = useRef(false)

  // Private PT Booking modal state (Mục 6 / D04)
  const [bookingMember, setBookingMember] = useState(null)
  const [bookingDate, setBookingDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })
  const [selectedRoomId, setSelectedRoomId] = useState("1")
  const [availableSlots, setAvailableSlots] = useState(STANDARD_SLOTS)
  const [selectedSlot, setSelectedSlot] = useState(STANDARD_SLOTS[0])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [bookingBusy, setBookingBusy] = useState(false)

  const parseNumericId = (rawId, fallback = 1) => {
    const match = String(rawId || "").match(/(\d+)$/)
    const parsed = match ? Number(match[1]) : Number(rawId)
    return !Number.isNaN(parsed) && parsed > 0 ? parsed : fallback
  }

  const loadAdvancedRequests = useCallback(async () => {
    if (!apiEnabled) return
    try {
      const list = await memberPortalApi.getAdvancedRegistrations()
      setAdvancedRequests(Array.isArray(list) ? list : [])
    } catch {
      // ignore if forbidden or empty
    }
  }, [apiEnabled])

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
    loadAdvancedRequests()
    return () => {
      active = false
    }
  }, [apiEnabled, loadAdvancedRequests])

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

  const openBookPrivateModal = async (member) => {
    setBookingMember(member)
    const coachIdNum = parseNumericId(
      currentUser?.coachId || currentUser?.id || member?.primaryCoachId,
      1,
    )
    if (apiEnabled) {
      setLoadingSlots(true)
      try {
        const slots = await memberPortalApi.getCoachAvailableSlots(
          coachIdNum,
          bookingDate,
          { roomId: Number(selectedRoomId) || 1 },
        )
        if (Array.isArray(slots) && slots.length > 0) {
          setAvailableSlots(slots)
          setSelectedSlot(
            slots.find((s) => s.isAvailable !== false) || slots[0],
          )
        } else {
          setAvailableSlots(STANDARD_SLOTS)
          setSelectedSlot(STANDARD_SLOTS[0])
        }
      } catch {
        setAvailableSlots(STANDARD_SLOTS)
        setSelectedSlot(STANDARD_SLOTS[0])
      } finally {
        setLoadingSlots(false)
      }
    }
  }

  const handleBookPrivateSession = async (e) => {
    e.preventDefault()
    if (!bookingMember || !selectedSlot) return
    setBookingBusy(true)
    try {
      const memberIdNum = parseNumericId(bookingMember.id, 1)
      const coachIdNum = parseNumericId(
        currentUser?.coachId ||
          currentUser?.id ||
          bookingMember?.primaryCoachId,
        1,
      )
      const roomIdNum = parseNumericId(selectedRoomId, 1)
      const startTime =
        String(selectedSlot.startTime || "06:00:00").length === 5
          ? `${selectedSlot.startTime}:00`
          : String(selectedSlot.startTime || "06:00:00")
      const endTime =
        String(selectedSlot.endTime || "07:30:00").length === 5
          ? `${selectedSlot.endTime}:00`
          : String(selectedSlot.endTime || "07:30:00")

      if (apiEnabled) {
        await memberPortalApi.bookPrivateSession({
          memberId: memberIdNum,
          coachId: coachIdNum,
          roomId: roomIdNum,
          sessionDate: bookingDate,
          startTime,
          endTime,
        })
      }
      showToast?.(
        `Đã đặt buổi tập riêng 1-kèm-1 cho ${bookingMember.name} ngày ${bookingDate} (${startTime.slice(0, 5)} - ${endTime.slice(0, 5)})!`,
        "success",
      )
      setBookingMember(null)
    } catch (err) {
      showToast?.(
        getErrorMessage(err, "Không thể đặt buổi tập riêng 1-kèm-1."),
        "error",
      )
    } finally {
      setBookingBusy(false)
    }
  }

  const assignedMembers = useMemo(() => {
    const filtered = members.filter(
      (m) => m.primaryCoachId || m.primaryCoachName,
    )
    return filtered.length > 0 ? filtered : members
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

        <div className="text-xs font-mono font-bold bg-slate-100 border border-slate-200 px-3 py-1.5 rounded text-slate-900">
          Tổng số: {assignedMembers.length} Học viên
        </div>
      </div>

      {/* Pending Advanced PT Coach Requests (Mục 5B) */}
      {advancedRequests.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>
                Yêu cầu đăng ký HLV 1-kèm-1 (Advanced PT ·{" "}
                {advancedRequests.length})
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
                      Học viên #{req.memberId} &bull;{" "}
                      {req.subjectName || `Môn #${req.subjectId}`}
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      Trạng thái:{" "}
                      <strong className="text-slate-800">{req.status}</strong>
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

      {/* Member Cards Grid / List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {assignedMembers.map((m) => {
          const plan = trainingPlans.find(
            (p) => String(p.memberId) === String(m.id),
          )
          const isAtRisk = atRiskIds.has(String(m.id))

          return (
            <div
              key={m.id}
              className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4 hover:border-slate-300 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      {m.name}
                    </span>
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
                  <span className="font-semibold text-slate-900">
                    {m.currentPackageName}
                  </span>
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
                    onClick={() => openBookPrivateModal(m)}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold shadow-xs flex items-center gap-1 whitespace-nowrap cursor-pointer"
                  >
                    <CalendarPlus className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {language === "vi" ? "Đặt lịch PT 1:1" : "Book 1:1 PT"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentTab("trainingProgress")}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold shadow-xs flex items-center gap-1 whitespace-nowrap cursor-pointer"
                  >
                    <Dumbbell className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {language === "vi" ? "Giáo án" : "Training Plan"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Private PT Session Booking Modal (Mục 6 / D04) */}
      {bookingMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Đặt Buổi Tập Riêng 1-kèm-1 (Advanced PT)
                </h3>
                <p className="text-xs text-slate-500">
                  Học viên: <strong>{bookingMember.name}</strong> (
                  {bookingMember.code})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBookingMember(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBookPrivateSession} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Ngày tập *
                  </label>
                  <input
                    type="date"
                    required
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Phòng / Sân tập *
                  </label>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="w-full border border-slate-300 rounded px-2.5 py-2 text-xs text-slate-900"
                  >
                    {(contextRooms?.length
                      ? contextRooms
                      : [{ id: 1, name: "Sân tập CLB #1" }]
                    ).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Chọn khung giờ chuẩn 90 phút (D12) *
                </label>
                {loadingSlots ? (
                  <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang tải ca trống...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {availableSlots.map((slot, idx) => {
                      const startStr = String(
                        slot.startTime || "06:00:00",
                      ).slice(0, 5)
                      const endStr = String(slot.endTime || "07:30:00").slice(
                        0,
                        5,
                      )
                      const isSelected =
                        selectedSlot?.startTime === slot.startTime
                      const disabled = slot.isAvailable === false
                      return (
                        <button
                          key={slot.slotNumber || idx}
                          type="button"
                          disabled={disabled}
                          onClick={() => setSelectedSlot(slot)}
                          className={`p-2 rounded border text-left text-xs transition-all cursor-pointer ${
                            disabled
                              ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                              : isSelected
                                ? "bg-slate-900 text-white border-slate-900 font-bold"
                                : "bg-white text-slate-800 border-slate-200 hover:border-slate-400"
                          }`}
                        >
                          <div>
                            {slot.slotName || slot.name || `Ca ${idx + 1}`}
                          </div>
                          <div className="font-mono text-[11px] opacity-85">
                            {startStr} – {endStr}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setBookingMember(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={bookingBusy || !selectedSlot}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded text-xs font-bold cursor-pointer"
                >
                  {bookingBusy ? "Đang đặt lịch..." : "Xác Nhận Đặt Lịch 1:1"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
