import React, { useState } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { AlertTriangle, ShieldAlert, Check, X } from "lucide-react"

export function AttendanceCorrectionModal({
  classId,
  memberId,
  memberName,
  currentStatus,
  attendanceId,
  onUpdated,
  isOpen,
  onClose,
}) {
  const { recordAttendance, t, language } = useSCMS()
  const [selectedStatus, setSelectedStatus] = useState(currentStatus)
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!reason.trim()) {
      setError(t("correctionReasonRequired"))
      return
    }

    setSaving(true)
    try {
      await recordAttendance(classId, memberId, selectedStatus, reason, {
        attendanceId,
        memberName,
      })
      await onUpdated?.()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark/60 p-4">
      <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary w-full max-w-md shadow-xl sm:p-6">
        <div className="flex items-center justify-between border-b border-border-color pb-3 mb-4">
          <div className="flex items-center gap-2 text-lg leading-7 font-semibold text-text-primary">
            <ShieldAlert className="w-5 h-5 text-status-warning" />
            <span>{t("correctAttendance")}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("cancel") || "Đóng"}
            className="inline-flex h-8 w-8 items-center justify-center rounded text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs leading-4 font-medium text-text-secondary block mb-1">
              {language === "vi" ? "Học viên" : "Member"}
            </label>
            <div className="text-sm leading-5 font-semibold text-text-primary bg-bg-secondary px-3 py-2.5 rounded border border-border-color">
              {memberName}
            </div>
          </div>

          <div>
            <label className="text-xs leading-4 font-medium text-text-secondary block mb-2">
              {language === "vi" ? "Trạng thái mới" : "New Status"}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["present", "late", "absent"].map((st) => (
                <button
                  type="button"
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`inline-flex h-9 items-center justify-center gap-1.5 rounded px-3 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none whitespace-nowrap cursor-pointer ${
                    selectedStatus === st
                      ? "bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active"
                      : "border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary"
                  }`}
                >
                  {selectedStatus === st && (
                    <Check className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{t(st)}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs leading-4 font-medium text-text-secondary block mb-1">
              {language === "vi"
                ? "Lý do chỉnh sửa"
                : "Mandatory Correction Reason"}{" "}
              <span className="text-status-danger">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setError("")
              }}
              placeholder={
                language === "vi"
                  ? "Ví dụ: Học viên đến trễ 10 phút do kẹt xe, đã gọi xin phép Coach..."
                  : "e.g., Student arrived 10 mins late due to traffic..."
              }
              className="w-full rounded border border-border-color bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
            />
            {error && (
              <p className="text-xs leading-4 text-status-danger mt-1 font-medium">
                {error}
              </p>
            )}
          </div>

          {/* Audit Log Banner */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-status-warning text-sm leading-5">
            <AlertTriangle className="w-4 h-4 text-status-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{t("attendanceAuditWarning")}</p>
              <p className="text-xs leading-4 text-status-warning mt-0.5 font-mono">
                Value change: {t(currentStatus)} &rarr; {t(selectedStatus)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-color">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded px-4 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary cursor-pointer"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded px-4 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active cursor-pointer"
            >
              {saving ? "Đang lưu..." : t("saveChanges")}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
