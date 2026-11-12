import React, { useEffect, useRef, useState } from "react"
import { AlertTriangle, LoaderCircle, ShieldAlert, X } from "lucide-react"
import { updateUserStatus } from "../../api/adminApi.js"

const STATUS_OPTIONS = [
  { value: "Active", label: "Hoạt động (Active)", desc: "Cho phép người dùng đăng nhập và sử dụng hệ thống bình thường." },
  { value: "Inactive", label: "Ngừng hoạt động (Inactive)", desc: "Tạm dừng hoạt động tài khoản, không thể đăng nhập." },
  { value: "Locked", label: "Khóa tài khoản (Locked)", desc: "Khóa tài khoản do vi phạm chính sách hoặc lý do an toàn." },
]

export const isValidUserId = (id) => {
  if (typeof id === "number") {
    return Number.isInteger(id) && id > 0
  }
  if (typeof id === "string" && id.trim() !== "") {
    const n = Number(id)
    return Number.isInteger(n) && n > 0
  }
  return false
}

export function UserStatusDialog({
  isOpen,
  onClose,
  user,
  currentUserId,
  activeAdminCount = 1,
  onSuccess,
  triggerRef,
}) {
  const [selectedStatus, setSelectedStatus] = useState("Active")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const dialogRef = useRef(null)

  useEffect(() => {
    if (isOpen && user) {
      const cur = String(user.status || "").toLowerCase()
      if (cur === "locked") setSelectedStatus("Locked")
      else if (cur === "inactive") setSelectedStatus("Inactive")
      else setSelectedStatus("Active")
      setError(null)
    }
  }, [isOpen, user])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !loading) {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      if (triggerRef?.current && document.contains(triggerRef.current)) {
        triggerRef.current.focus({ preventScroll: true })
      }
    }
  }, [isOpen, loading, onClose, triggerRef])

  if (!isOpen || !user) return null

  const isCurrentIdValid = isValidUserId(currentUserId)
  // isSelf luôn là boolean, chống rò rỉ số 0 ra JSX
  const isSelf = Boolean(
    isCurrentIdValid &&
    isValidUserId(user?.id) &&
    Number(user.id) === Number(currentUserId)
  )
  const isAdminUser = String(user.roleName || "").toLowerCase() === "admin"
  const isLastActiveAdmin =
    isAdminUser &&
    String(user.status || "").toLowerCase() === "active" &&
    activeAdminCount <= 1

  // Chốt chặn fail-closed: vô hiệu hóa nếu không xác định được currentUser, tự khóa, hoặc khóa Admin Active duy nhất
  const cannotChangeStatus =
    !isCurrentIdValid ||
    isSelf ||
    (isLastActiveAdmin && (selectedStatus === "Locked" || selectedStatus === "Inactive"))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (cannotChangeStatus) return

    setLoading(true)
    setError(null)
    try {
      const res = await updateUserStatus(user.id, selectedStatus)
      if (onSuccess) onSuccess(res, selectedStatus)
      onClose()
    } catch (err) {
      if (err?.status === 403) {
        setError("Bạn không có quyền thực hiện thao tác này.")
      } else {
        setError(err?.message || "Không thể cập nhật trạng thái người dùng.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-status-dialog-title"
        className="w-full max-w-lg rounded-xl border border-border-color bg-bg-card p-6 shadow-xl text-text-primary space-y-4"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-color/60 pb-3">
          <div>
            <h3 id="user-status-dialog-title" className="text-base font-semibold text-text-primary">
              Cập nhật trạng thái tài khoản
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Người dùng: <strong className="text-text-primary">{user.fullName || user.email}</strong> (ID #{user.id})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-11 h-11 inline-flex items-center justify-center rounded text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary shrink-0"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chốt chặn: Không xác định được người đang đăng nhập */}
        {!isCurrentIdValid && (
          <div role="alert" className="p-3 rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger text-xs leading-4 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>Chốt chặn an toàn:</strong> Không xác định được tài khoản đang đăng nhập; tải lại trang hoặc đăng nhập lại.
            </div>
          </div>
        )}

        {/* Chốt chặn: Tự đổi trạng thái */}
        {isSelf && (
          <div role="alert" className="p-3 rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger text-xs leading-4 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>Chốt chặn an toàn:</strong> Bạn không thể tự thay đổi trạng thái tài khoản của chính mình.
            </div>
          </div>
        )}

        {/* Chốt chặn: Admin Active cuối cùng */}
        {isLastActiveAdmin && !isSelf && (
          <div role="alert" className="p-3 rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger text-xs leading-4 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>Chốt chặn an toàn:</strong> Không thể khóa hoặc ngừng hoạt động Quản trị viên (Admin) đang hoạt động duy nhất trong hệ thống.
            </div>
          </div>
        )}

        {/* Cảnh báo thao tác trên tài khoản Admin */}
        {isAdminUser && !isSelf && !isLastActiveAdmin && (
          <div role="alert" className="p-3 rounded-lg border border-status-warning-border bg-status-warning-bg text-status-warning text-xs leading-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>Cảnh báo quản trị:</strong> Bạn đang thao tác trên tài khoản có vai trò Quản trị viên hệ thống (Admin). Hành động này có thể ảnh hưởng đến quyền vận hành toàn hệ thống.
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="p-3 rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger text-xs leading-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-text-secondary block">
              Chọn trạng thái mới:
            </label>
            <div className="space-y-2">
              {STATUS_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer min-h-11 ${
                    selectedStatus === opt.value
                      ? "border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary"
                      : "border-border-color bg-bg-card hover:bg-bg-secondary/60"
                  }`}
                >
                  <input
                    type="radio"
                    name="account-status"
                    value={opt.value}
                    checked={selectedStatus === opt.value}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    disabled={loading || !isCurrentIdValid || isSelf}
                    className="mt-1 h-4 w-4 text-brand-primary border-border-strong focus:ring-brand-primary"
                  />
                  <div className="flex-1 text-xs">
                    <p className="font-semibold text-text-primary">{opt.label}</p>
                    <p className="text-text-secondary mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-border-color/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="min-h-11 inline-flex items-center justify-center rounded px-4 py-2 text-sm font-medium border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading || cannotChangeStatus}
              className="min-h-11 inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
            >
              {loading && <LoaderCircle className="w-4 h-4 animate-spin" />}
              <span>Lưu thay đổi</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
