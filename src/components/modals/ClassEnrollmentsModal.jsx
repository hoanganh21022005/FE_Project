import React, { useState, useEffect } from "react"
import { useSCMS } from "../../context/SCMSContext"
import {
  getEnrollmentsByClass,
  enrollMemberInClass,
  cancelMemberEnrollment,
} from "../../api/classEnrollmentApi"
import {
  Users,
  UserPlus,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Search,
} from "lucide-react"

export function ClassEnrollmentsModal({ cls, onClose, onEnrollmentChange }) {
  const { members, language, showToast, apiEnabled } = useSCMS()
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedMemberId, setSelectedMemberId] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const classId = cls?.id

  const loadEnrollments = async () => {
    if (!classId) return
    setLoading(true)
    setError("")
    try {
      if (apiEnabled) {
        const data = await getEnrollmentsByClass(classId)
        setEnrollments(data)
        if (onEnrollmentChange) {
          onEnrollmentChange(classId, data.length)
        }
      } else {
        // Fallback for mock mode
        const mockList = members
          .slice(0, cls.enrolledCount || 0)
          .map((m, idx) => ({
            id: idx + 1,
            memberId: m.id,
            memberName: m.name,
            memberCode: m.code || `MB-${1000 + idx}`,
            memberEmail: m.email,
            memberPhone: m.phone || "—",
            status: "Registered",
          }))
        setEnrollments(mockList)
      }
    } catch (err) {
      setError(err?.message || "Không thể tải danh sách học viên")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEnrollments()
  }, [classId])

  // Filter out members who are already enrolled
  const enrolledMemberIds = new Set(
    enrollments.map((e) => String(e.memberId || e.id)),
  )
  const availableMembers = members.filter(
    (m) => !enrolledMemberIds.has(String(m.id)),
  )

  const handleEnroll = async (e) => {
    e.preventDefault()
    if (!selectedMemberId) return

    setActionLoading(true)
    setError("")
    try {
      if (apiEnabled) {
        await enrollMemberInClass(classId, selectedMemberId)
      }
      showToast(
        language === "vi"
          ? "Đã ghi danh học viên vào lớp thành công!"
          : "Member enrolled successfully!",
        "success",
      )
      setSelectedMemberId("")
      await loadEnrollments()
    } catch (err) {
      setError(err?.message || "Lỗi khi ghi danh học viên.")
      showToast(err?.message || "Không thể ghi danh", "error")
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancelEnrollment = async (memberId, memberName) => {
    const confirmMsg =
      language === "vi"
        ? `Bạn có chắc muốn hủy ghi danh học viên "${memberName}" khỏi lớp này không?`
        : `Are you sure you want to remove "${memberName}" from this class?`
    if (!window.confirm(confirmMsg)) return

    setActionLoading(true)
    setError("")
    try {
      if (apiEnabled) {
        await cancelMemberEnrollment(classId, memberId)
      }
      showToast(
        language === "vi"
          ? `Đã hủy ghi danh học viên ${memberName}.`
          : `Removed ${memberName} from class.`,
        "info",
      )
      await loadEnrollments()
    } catch (err) {
      setError(err?.message || "Lỗi khi hủy ghi danh.")
      showToast(err?.message || "Không thể hủy ghi danh", "error")
    } finally {
      setActionLoading(false)
    }
  }

  const filteredEnrollments = enrollments.filter(
    (item) =>
      (item.memberName || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (item.memberEmail || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (item.memberCode || "").toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const currentCount = enrollments.length
  const capacity = cls?.capacity || cls?.maxCapacity || 0
  const isFull = capacity > 0 && currentCount >= capacity

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-800 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {cls?.nameVi || cls?.name}
                </h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded font-bold bg-slate-200 text-slate-700">
                  {cls?.category}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Huấn luyện viên:{" "}
                <strong className="text-slate-800">
                  {cls?.coachName || "Chưa phân công"}
                </strong>
                {" • "}
                Sức chứa:{" "}
                <strong
                  className={
                    isFull
                      ? "text-rose-600 font-bold"
                      : "text-slate-800 font-bold"
                  }
                >
                  {currentCount}/{capacity}
                </strong>{" "}
                {isFull && (
                  <span className="text-rose-600 text-[11px] font-semibold">
                    (Đã đầy)
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Enroll Form */}
        <div className="p-5 border-b border-slate-100 bg-white">
          <form
            onSubmit={handleEnroll}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
            <div className="flex-1">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Ghi danh học viên mới vào lớp
              </label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                disabled={
                  isFull || actionLoading || availableMembers.length === 0
                }
                className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-600 disabled:opacity-50"
              >
                <option value="">
                  {isFull
                    ? "Lớp đã đầy sức chứa"
                    : availableMembers.length === 0
                      ? "Tất cả học viên đã được ghi danh"
                      : "— Chọn học viên để ghi danh —"}
                </option>
                {availableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.code || `ID: ${m.id}`}) — {m.phone || m.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:self-end">
              <button
                type="submit"
                disabled={!selectedMemberId || isFull || actionLoading}
                className="w-full sm:w-auto px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-md text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span>Ghi danh</span>
              </button>
            </div>
          </form>
        </div>

        {/* Search & Roster Header */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between gap-3">
          <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <span>Danh sách học viên</span>
            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold">
              {filteredEnrollments.length}
            </span>
          </div>
          <div className="relative w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên, email, mã..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-xs border border-slate-200 rounded bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Member Table */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-xs">Đang tải danh sách học viên...</p>
            </div>
          ) : filteredEnrollments.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg my-2">
              <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p>Chưa có học viên nào được ghi danh vào lớp này.</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden mt-2">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Mã HV</th>
                    <th className="py-2.5 px-3">Họ và tên</th>
                    <th className="py-2.5 px-3">Liên hệ</th>
                    <th className="py-2.5 px-3">Trạng thái</th>
                    <th className="py-2.5 px-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredEnrollments.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-900 text-[11px]">
                        {item.memberCode || `MB-${item.memberId}`}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {item.memberName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <div>{item.memberPhone || "—"}</div>
                        <div className="text-[11px] text-slate-400">
                          {item.memberEmail}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {item.status || "Đã ghi danh"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            handleCancelEnrollment(
                              item.memberId,
                              item.memberName,
                            )
                          }
                          disabled={actionLoading}
                          className="px-2.5 py-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded font-semibold text-[11px] inline-flex items-center gap-1 transition-colors"
                          title="Hủy ghi danh khỏi lớp"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hủy ghi danh</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-bold shadow-xs transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

export default ClassEnrollmentsModal
