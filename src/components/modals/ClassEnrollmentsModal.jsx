import React, { useState, useEffect } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { getEnrollmentsByClass } from "../../api/classEnrollmentApi"
import {
  Users,
  X,
  AlertCircle,
  Loader2,
  Search,
} from "lucide-react"

export function ClassEnrollmentsModal({ cls, onClose, onEnrollmentChange }) {
  const { members, apiEnabled } = useSCMS()
  const [enrollments, setEnrollments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")

  const classId = cls?.id ?? cls?.classId

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
    setEnrollments([])
    setError("")
    loadEnrollments()
  }, [classId, apiEnabled])

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
              <h3 className="text-base font-bold text-slate-900">
                {cls?.nameVi || cls?.name}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Huấn luyện viên:{" "}
                <strong className="text-slate-800">
                  {cls?.coachName || "Chưa phân công"}
                </strong>
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
              <p>Chưa có học viên tham gia lớp này.</p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden mt-2">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Mã Học Viên</th>
                    <th className="py-2.5 px-3">Họ và tên</th>
                    <th className="py-2.5 px-3">Liên hệ</th>
                    <th className="py-2.5 px-3">Trạng thái</th>
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
