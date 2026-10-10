import React, { useState, useEffect, useMemo } from "react"
import { useSCMS } from "../../context/SCMSContext"
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
  UserPlus,
  Trash2,
  Search,
  CheckCircle2,
  ExternalLink,
} from "lucide-react"

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
  return new Intl.NumberFormat("vi-VN").format(num || 0)
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
  onClose,
  onEdit,
  onDuplicate,
  onCancelClass,
  onEnrollmentChange,
}) {
  const { members, language, showToast, apiEnabled } = useSCMS()
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [selectedNewMemberId, setSelectedNewMemberId] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  const classId = cls?.id

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  // Load registered members
  const loadEnrollments = async () => {
    if (!classId) return
    setLoading(true)
    try {
      if (apiEnabled) {
        const data = await getEnrollmentsByClass(classId)
        setEnrollments(data || [])
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
            registeredAt: cls.startDate || cls.date || "2026-10-12",
            paymentStatus: "paid",
          }))
        setEnrollments(mockList)
      }
    } catch {
      setEnrollments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEnrollments()
  }, [classId])

  const weekdays = useMemo(() => {
    if (Array.isArray(cls?.selectedDays) && cls.selectedDays.length > 0) {
      return cls.selectedDays.map((d) => WEEKDAY_NAMES_MAP[d] || d)
    }
    return ["T2", "T4", "T6"]
  }, [cls?.selectedDays])

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

  const capacity = cls.capacity || 8
  const enrolled = enrollments.length || cls.enrolledCount || 0
  const minCap = cls.minCapacity || 4
  const percent =
    capacity > 0 ? Math.min(100, Math.round((enrolled / capacity) * 100)) : 0
  const numericPrice = Number(cls.price)
  const isFree = cls.isFree || numericPrice === 0
  const price = isFree
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
  const sessionCount = cls.sessionCount || 12
  const perSessionPrice = Math.round(price / sessionCount / 1000) * 1000
  const estimatedRevenue = enrolled * price

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

  const handleRemoveMember = async (enrollmentId, memberName) => {
    if (
      !window.confirm(`Bạn có chắc chắn muốn hủy đăng ký cho "${memberName}"?`)
    )
      return
    try {
      if (apiEnabled) {
        await cancelMemberEnrollment(classId, enrollmentId)
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
    published: {
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
    completed: {
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

  const currentStatus = statusConfig[cls.status] || statusConfig.published

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-stone-900/50 transition-opacity animate-in fade-in duration-200"
      />

      {/* Slide-over Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10 pointer-events-none">
        <div className="w-screen max-w-xl bg-white shadow-2xl border-l border-stone-200/80 pointer-events-auto flex flex-col animate-in slide-in-from-right duration-300 ease-out">
          {/* HEADER */}
          <div className="px-6 py-4 border-b border-stone-200 bg-stone-50/60 flex items-start justify-between gap-4 shrink-0">
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold font-mono bg-stone-200/80 text-stone-700">
                  {cls.code || `CLS-${cls.id}`}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold border ${currentStatus.bg} ${currentStatus.text} ${currentStatus.border}`}
                >
                  {currentStatus.label}
                </span>
                <span className="text-xs text-stone-500 font-medium">
                  {cls.category || "Thể thao"} &bull; {cls.level || "Cơ bản"}
                </span>
              </div>
              <h2 className="text-lg font-bold text-stone-900 truncate">
                {cls.nameVi || cls.name}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEdit && onEdit(cls)}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Chỉnh sửa thông tin lớp học"
              >
                <Edit3 className="w-3.5 h-3.5 text-stone-600" />
                <span>Chỉnh sửa</span>
              </button>
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

          {/* SCROLLABLE BODY */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* KEY METRICS GRID (4 Thẻ chỉ số SaaS) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-stone-50/80 border border-stone-200/80 rounded-xl">
                <span className="text-[11px] text-stone-500 font-medium block">
                  Sĩ số lớp
                </span>
                <div className="text-base font-bold text-stone-900 mt-0.5">
                  {enrolled}{" "}
                  <span className="text-xs font-normal text-stone-500">
                    / {capacity}
                  </span>
                </div>
                <div className="w-full bg-stone-200 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      percent >= 80
                        ? "bg-[#2B8A3E]"
                        : percent >= 40
                          ? "bg-amber-500"
                          : "bg-stone-400"
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              <div className="p-3 bg-stone-50/80 border border-stone-200/80 rounded-xl">
                <span className="text-[11px] text-stone-500 font-medium block">
                  Tỷ lệ lấp đầy
                </span>
                <div className="text-base font-bold text-stone-900 mt-0.5">
                  {percent}%
                </div>
                <span className="text-[10px] text-stone-500 block mt-1">
                  {enrolled >= minCap ? (
                    <span className="text-emerald-700 font-medium">
                      Đủ điều kiện mở
                    </span>
                  ) : (
                    <span className="text-amber-700">
                      Cần thêm {minCap - enrolled} HV
                    </span>
                  )}
                </span>
              </div>

              <div className="p-3 bg-stone-50/80 border border-stone-200/80 rounded-xl">
                <span className="text-[11px] text-stone-500 font-medium block">
                  Doanh thu tạm tính
                </span>
                <div className="text-base font-bold text-emerald-800 mt-0.5 tabular-nums">
                  {formatNumber(estimatedRevenue)}{" "}
                  <span className="text-[10px] font-normal">đ</span>
                </div>
                <span className="text-[10px] text-stone-500 block mt-1">
                  {enrolled} học viên nộp
                </span>
              </div>

              <div className="p-3 bg-stone-50/80 border border-stone-200/80 rounded-xl">
                <span className="text-[11px] text-stone-500 font-medium block">
                  Học phí / Buổi
                </span>
                <div className="text-base font-bold text-stone-900 mt-0.5 tabular-nums">
                  {price === 0 ? (
                    <span className="text-emerald-700 font-semibold text-sm">
                      Miễn phí
                    </span>
                  ) : (
                    <>
                      {formatNumber(perSessionPrice)}{" "}
                      <span className="text-[10px] font-normal">đ</span>
                    </>
                  )}
                </div>
                <span className="text-[10px] text-stone-500 block mt-1">
                  Tổng {sessionCount} buổi
                </span>
              </div>
            </div>

            {/* SECTION: LỊCH HỌC VÀ SÂN TẬP */}
            <div className="p-4 bg-stone-50/50 border border-stone-200/70 rounded-xl space-y-3.5">
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-stone-600" />
                <span>Lịch học & Địa điểm đào tạo</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-stone-500 block text-[11px]">
                      Khung giờ & Các thứ
                    </span>
                    <div className="font-semibold text-stone-800 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1">
                        {weekdays.map((day) => (
                          <span
                            key={day}
                            className="px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-white text-stone-800 border border-stone-200 shadow-2xs"
                          >
                            {day}
                          </span>
                        ))}
                      </div>
                      <span className="text-stone-900 font-bold ml-1">
                        {cls.startTime || "06:00"} - {cls.endTime || "07:30"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-stone-500 block text-[11px]">
                      Sân tập & Tiêu chuẩn
                    </span>
                    <p className="font-semibold text-stone-800 mt-0.5">
                      {cls.roomVi || cls.room || "Sân tập tiêu chuẩn"}
                    </p>
                    <p className="text-[11px] text-stone-500">
                      {cls.roomSpec || "Sức chứa tiêu chuẩn 8 - 12 người"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-stone-500 block text-[11px]">
                      Ngày khai giảng
                    </span>
                    <p className="font-semibold text-stone-800 mt-0.5">
                      {formatViDate(cls.startDate || cls.date)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-stone-500 block text-[11px]">
                      Dự kiến kết thúc
                    </span>
                    <p className="font-semibold text-stone-800 mt-0.5">
                      {formatViDate(cls.endDate) || "Theo lộ trình 12 buổi"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION: HUẤN LUYỆN VIÊN PHỤ TRÁCH */}
            <div className="p-4 bg-white border border-stone-200/80 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-stone-600" />
                  <span>Huấn luyện viên phụ trách</span>
                </h3>
                <button
                  type="button"
                  onClick={() => onEdit && onEdit(cls)}
                  className="text-xs text-[#BA1A1A] hover:underline font-semibold cursor-pointer"
                >
                  Đổi HLV
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-stone-100 border border-stone-200 text-stone-700 font-bold flex items-center justify-center shrink-0 text-sm">
                  {(cls.coachName || "H").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-stone-900 text-sm">
                    {cls.coachName || "Chưa phân công"}
                  </div>
                  <div className="text-xs text-stone-500">
                    Chuyên môn:{" "}
                    {cls.coachSpecialty ||
                      cls.category ||
                      "Thể thao chuyên nghiệp"}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION: DANH SÁCH HỌC VIÊN ĐÃ ĐĂNG KÝ */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-stone-600" />
                  <span>
                    Danh sách học viên ({enrolled}/{capacity})
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddingMember(!isAddingMember)}
                  className="text-xs px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Thêm học viên</span>
                </button>
              </div>

              {/* Form thêm học viên nhanh */}
              {isAddingMember && (
                <form
                  onSubmit={handleAddMember}
                  className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2.5 animate-in fade-in duration-150"
                >
                  <div className="text-xs font-semibold text-stone-800">
                    Ghi danh học viên mới vào lớp:
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedNewMemberId}
                      onChange={(e) => setSelectedNewMemberId(e.target.value)}
                      className="flex-1 h-9 px-3 bg-white border border-stone-300 rounded-lg text-xs"
                      required
                    >
                      <option value="">Chọn hội viên từ hệ thống...</option>
                      {availableMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.code || m.id}) -{" "}
                          {m.phone || "Chưa có SĐT"}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={actionLoading || !selectedNewMemberId}
                      className="h-9 px-3.5 bg-[#BA1A1A] hover:bg-[#991313] text-white rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      {actionLoading ? "Đang thêm..." : "Ghi danh"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingMember(false)}
                      className="h-9 px-2.5 border border-stone-300 rounded-lg text-xs hover:bg-stone-100 text-stone-600 cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              )}

              {/* Ô tìm kiếm trong danh sách học viên */}
              {enrollments.length > 3 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm theo tên, mã hoặc SĐT học viên..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 bg-stone-50 border border-stone-200 rounded-lg text-xs placeholder-stone-400"
                  />
                </div>
              )}

              {/* Bảng học viên */}
              {loading ? (
                <div className="py-8 text-center text-xs text-stone-500">
                  Đang tải danh sách học viên...
                </div>
              ) : filteredEnrollments.length === 0 ? (
                <div className="py-8 px-4 border border-dashed border-stone-200 rounded-xl text-center space-y-2 bg-stone-50/50">
                  <Users className="w-8 h-8 text-stone-300 mx-auto" />
                  <p className="text-xs text-stone-500 font-medium">
                    {searchTerm
                      ? "Không tìm thấy học viên phù hợp."
                      : "Chưa có học viên nào đăng ký lớp này."}
                  </p>
                  {!searchTerm && (
                    <button
                      type="button"
                      onClick={() => setIsAddingMember(true)}
                      className="text-xs text-[#BA1A1A] font-semibold hover:underline cursor-pointer"
                    >
                      + Ghi danh học viên đầu tiên
                    </button>
                  )}
                </div>
              ) : (
                <div className="border border-stone-200/90 rounded-xl overflow-hidden divide-y divide-stone-100 bg-white shadow-2xs">
                  {filteredEnrollments.map((enr, idx) => (
                    <div
                      key={enr.id || idx}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-stone-50/60 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-rose-50 text-[#BA1A1A] font-bold text-xs flex items-center justify-center shrink-0">
                          {(enr.memberName || "H").slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-stone-900 truncate">
                            {enr.memberName}
                          </div>
                          <div className="text-[11px] text-stone-500 flex items-center gap-1.5">
                            <span>{enr.memberCode || "MB-000"}</span>
                            <span>&bull;</span>
                            <span>{enr.memberPhone || "—"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                          Đã thanh toán
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveMember(enr.id, enr.memberName)
                          }
                          className="p-1 text-stone-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                          title="Hủy ghi danh học viên"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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

              <button
                type="button"
                onClick={() => onEdit && onEdit(cls)}
                className="h-9 px-4 bg-[#BA1A1A] hover:bg-[#991313] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Chỉnh sửa</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClassDetailDrawer
