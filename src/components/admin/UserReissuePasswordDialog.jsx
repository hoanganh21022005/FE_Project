import React, { useEffect, useRef, useState } from "react"
import { AlertTriangle, CheckCircle, KeyRound, LoaderCircle, Mail, ShieldAlert, X } from "lucide-react"
import { reissuePassword } from "../../api/authApi.js"

export function UserReissuePasswordDialog({
  isOpen,
  onClose,
  user,
  onSuccess,
  triggerRef,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const dialogRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setError(null)
      setResult(null)
      setLoading(false)
    }
  }, [isOpen])

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

  const handleReissue = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await reissuePassword(user.id)
      setResult(res || { emailSent: true })
      if (onSuccess) onSuccess(res)
    } catch (err) {
      if (err?.status === 403) {
        setError("Bạn không có quyền thực hiện thao tác này.")
      } else {
        setError(err?.message || "Không thể cấp lại mật khẩu cho người dùng.")
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
        aria-labelledby="user-reissue-pwd-title"
        className="w-full max-w-md rounded-xl border border-border-color bg-bg-card p-6 shadow-xl text-text-primary space-y-4"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-color/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-status-warning-bg text-status-warning flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 id="user-reissue-pwd-title" className="text-base font-semibold text-text-primary">
                Cấp lại mật khẩu tạm
              </h3>
              <p className="text-xs text-text-secondary">
                Tài khoản: <strong className="text-text-primary">{user.fullName || user.email}</strong> (ID #{user.id})
              </p>
            </div>
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

        {error && (
          <div role="alert" className="p-3 rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger text-xs leading-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {result ? (
          <div className="space-y-4 py-2">
            {result.emailSent === false ? (
              <div role="alert" className="p-3.5 rounded-lg border border-status-warning-border bg-status-warning-bg text-status-warning space-y-2 text-xs leading-4">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Đã cấp mật khẩu nhưng gửi email thất bại</span>
                </div>
                <p>
                  {result.warning || "Không thể gửi email chứa mật khẩu tạm đến địa chỉ người dùng. Vui lòng kiểm tra lại cấu hình hòm thư hoặc thử lại sau."}
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg border border-status-success-border bg-status-success-bg text-status-success space-y-2 text-xs leading-4">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle className="w-4 h-4" />
                  <span>Cấp lại mật khẩu thành công</span>
                </div>
                <p>
                  Mật khẩu tạm đã được hệ thống tự động sinh và gửi tới địa chỉ email: <strong className="font-mono">{user.email}</strong>.
                </p>
              </div>
            )}

            <div className="p-3 rounded-lg bg-bg-secondary text-xs text-text-secondary space-y-1">
              <p>• Mọi phiên đăng nhập hiện tại của người dùng này đã bị hủy.</p>
              <p>• Người dùng bắt buộc phải đổi mật khẩu ở lần đăng nhập tiếp theo.</p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 inline-flex items-center justify-center rounded px-4 py-2 text-sm font-semibold bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                Đã hiểu và đóng
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-status-warning-border bg-status-warning-bg p-3.5 text-xs text-status-warning leading-4 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                <Mail className="w-4 h-4 text-status-warning" />
                <span>Quy trình cấp lại mật khẩu tạm từ máy chủ:</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-text-primary">
                <li>
                  Hệ thống Backend sẽ tự sinh mật khẩu ngẫu nhiên và <strong>gửi trực tiếp qua email</strong> của người dùng, không hiển thị trên giao diện này.
                </li>
                <li>
                  Hệ thống sẽ <strong>đăng xuất toàn bộ các phiên làm việc</strong> hiện tại của tài khoản này trên tất cả các thiết bị.
                </li>
                <li>
                  Người dùng sẽ <strong>bắt buộc phải đổi mật khẩu mới</strong> ngay sau khi đăng nhập thành công bằng mật khẩu tạm.
                </li>
              </ul>
            </div>

            <p className="text-xs text-text-secondary">
              Bạn có chắc chắn muốn thực hiện cấp lại mật khẩu cho tài khoản <strong>{user.fullName || user.email}</strong> không?
            </p>

            <div className="pt-2 border-t border-border-color/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="min-h-11 inline-flex items-center justify-center rounded px-4 py-2 text-sm font-medium border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleReissue}
                disabled={loading}
                className="min-h-11 inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
              >
                {loading && <LoaderCircle className="w-4 h-4 animate-spin" />}
                <span>Xác nhận cấp lại mật khẩu</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
