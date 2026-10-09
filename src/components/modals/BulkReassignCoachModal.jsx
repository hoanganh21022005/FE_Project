import React, { useState, useMemo } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { checkSingleClassConflict } from "../classes/hooks/useScheduleConflict"
import { X, UserCheck, AlertTriangle, Loader2 } from "lucide-react"

export function BulkReassignCoachModal({
  isOpen,
  onClose,
  selectedClasses = [],
  onReassignSuccess,
}) {
  const { staff, coaches, classes, updateClass, showToast } = useSCMS()
  const [selectedCoachId, setSelectedCoachId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const activeCoaches = (
    coaches && coaches.length > 0 ? coaches : staff
  ).filter(
    (person) =>
      String(person.role || person.beRole || "")
        .toLowerCase()
        .includes("coach") ||
      String(person.role || person.beRole || "")
        .toLowerCase()
        .includes("huấn"),
  )

  const selectedCoachObj = activeCoaches.find(
    (c) => String(c.id) === String(selectedCoachId),
  )

  // Check conflicts for all selected classes with this new coach
  const conflictReport = useMemo(() => {
    if (!selectedCoachObj) return []
    const conflicts = []

    for (const cls of selectedClasses) {
      const candidate = {
        ...cls,
        coachId: selectedCoachObj.id,
        coachName: selectedCoachObj.name,
      }

      // Check conflict against classes that are NOT in the selected list
      for (const existing of classes || []) {
        if (selectedClasses.some((s) => String(s.id) === String(existing.id)))
          continue
        const conf = checkSingleClassConflict(candidate, existing)
        if (conf) {
          conflicts.push({
            className: cls.nameVi || cls.name,
            conflictingWith: existing.nameVi || existing.name,
            message: conf.message,
          })
          break
        }
      }
    }
    return conflicts
  }, [selectedCoachObj, selectedClasses, classes])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedCoachObj) {
      showToast("Vui lòng chọn huấn luyện viên.", "error")
      return
    }

    if (conflictReport.length > 0) {
      const proceed = window.confirm(
        `Phát hiện ${conflictReport.length} lớp có thể bị trùng lịch với HLV ${selectedCoachObj.name}. Bạn có chắc chắn muốn tiếp tục không?`,
      )
      if (!proceed) return
    }

    setIsSubmitting(true)
    let successCount = 0
    try {
      for (const cls of selectedClasses) {
        if (typeof updateClass === "function") {
          await updateClass(cls.id, {
            coachId: selectedCoachObj.id,
            coachName: selectedCoachObj.name,
            coachSpecialty: selectedCoachObj.specialization || cls.category,
          })
          successCount++
        }
      }
      showToast(`Đã đổi HLV thành công cho ${successCount} lớp học!`, "success")
      if (onReassignSuccess) onReassignSuccess()
      onClose()
    } catch (err) {
      showToast(err?.message || "Lỗi khi cập nhật HLV hàng loạt.", "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/45 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white text-stone-900 w-full max-w-md rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-[#BA1A1A] flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">
                Đổi Huấn luyện viên hàng loạt
              </h3>
              <p className="text-xs text-stone-500">
                Áp dụng cho {selectedClasses.length} lớp học đã chọn
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-800 mb-1.5">
              Chọn Huấn luyện viên mới
            </label>
            <select
              value={selectedCoachId}
              onChange={(e) => setSelectedCoachId(e.target.value)}
              required
              className="w-full h-11 px-3.5 bg-white border border-stone-300 rounded-xl text-xs focus:border-stone-800 focus:ring-1 focus:ring-stone-800 cursor-pointer"
            >
              <option value="">Chọn huấn luyện viên phụ trách...</option>
              {activeCoaches.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name} ({c.specializationVi || c.specialization || "HLV"})
                </option>
              ))}
            </select>
          </div>

          {/* Selected classes preview list */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              Danh sách {selectedClasses.length} lớp sẽ được cập nhật:
            </label>
            <div className="max-h-36 overflow-y-auto border border-stone-200 rounded-xl p-2.5 divide-y divide-stone-100 bg-stone-50/40 text-xs">
              {selectedClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="py-1.5 flex items-center justify-between gap-2"
                >
                  <span className="font-semibold text-stone-900 truncate">
                    {cls.nameVi || cls.name}
                  </span>
                  <span className="text-[11px] text-stone-500 shrink-0">
                    Hiện tại: {cls.coachName || "Chưa phân công"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Conflict warnings */}
          {conflictReport.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Cảnh báo xung đột lịch dạy ({conflictReport.length} lớp)
                </span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800">
                {conflictReport.map((c, i) => (
                  <li key={i}>
                    Lớp &quot;{c.className}&quot; trùng lịch với lớp &quot;
                    {c.conflictingWith}&quot;.
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-700 bg-white border border-stone-300 hover:bg-stone-50 rounded-xl cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedCoachId}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#BA1A1A] hover:bg-[#991313] rounded-xl transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <span>Xác nhận đổi HLV</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default BulkReassignCoachModal
