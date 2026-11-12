import React, { useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Lock,
  Shield,
  ShieldCheck,
  User,
} from "lucide-react"
import { useSCMS } from "../../../context/SCMSContext.jsx"
import { authApi } from "../../../api/authApi.js"

export function AdminProfileView() {
  const { authUser, currentUser } = useSCMS()

  const displayName =
    authUser?.fullName ||
    currentUser?.name ||
    currentUser?.fullName ||
    "Quản trị viên"
  const displayEmail = authUser?.email || currentUser?.email || "admin@example.invalid"
  const rawAuthorities =
    authUser?.authorities ||
    currentUser?.authorities ||
    currentUser?.permissions ||
    []
  const authorities = Array.isArray(rawAuthorities)
    ? rawAuthorities.map((a) => (typeof a === "string" ? a : a?.name || String(a)))
    : []

  const [formData, setFormData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }))
    }
    if (serverError) setServerError(null)
    if (successMessage) setSuccessMessage(null)
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.oldPassword) {
      newErrors.oldPassword = "Mật khẩu hiện tại là bắt buộc."
    }

    if (!formData.newPassword) {
      newErrors.newPassword = "Mật khẩu mới là bắt buộc."
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = "Mật khẩu mới phải có tối thiểu 8 ký tự."
    } else if (
      !/[A-Za-z]/.test(formData.newPassword) ||
      !/\d/.test(formData.newPassword)
    ) {
      newErrors.newPassword = "Mật khẩu mới phải bao gồm cả chữ và số."
    } else if (formData.oldPassword && formData.newPassword === formData.oldPassword) {
      newErrors.newPassword = "Mật khẩu mới phải khác mật khẩu hiện tại."
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Vui lòng nhập lại mật khẩu mới."
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = "Mật khẩu xác nhận không khớp."
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    setServerError(null)
    setSuccessMessage(null)

    try {
      await authApi.changePassword({
        oldPassword: formData.oldPassword,
        newPassword: formData.newPassword,
      })
      setSuccessMessage("Đổi mật khẩu thành công. Vui lòng ghi nhớ mật khẩu mới.")
      setFormData({
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Không thể đổi mật khẩu. Vui lòng kiểm tra lại thông tin."
      setServerError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-text-primary">
          Hồ sơ Quản trị viên
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          Thông tin định danh tài khoản, phạm vi quyền hạn và quản lý mật khẩu an toàn.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Khối thông tin định danh */}
        <div className="space-y-6">
          <section className="rounded-lg border border-border-color bg-bg-card p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-border-color pb-3">
              <User className="w-4 h-4 text-brand-primary" />
              <h2 className="text-sm font-semibold text-text-primary">
                Thông tin tài khoản
              </h2>
            </div>

            <div className="space-y-3 text-xs leading-5">
              <div>
                <span className="text-text-secondary block font-medium">Họ và tên:</span>
                <span className="text-text-primary font-semibold text-sm">{displayName}</span>
              </div>
              <div>
                <span className="text-text-secondary block font-medium">Địa chỉ email:</span>
                <span className="text-text-primary font-mono text-sm">{displayEmail}</span>
              </div>
              <div>
                <span className="text-text-secondary block font-medium">Vai trò hệ thống:</span>
                <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-brand-primary/10 text-brand-primary font-semibold border border-brand-primary/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Quản trị viên (Admin)</span>
                </div>
              </div>
            </div>
          </section>

          {/* Khối danh sách quyền */}
          <section className="rounded-lg border border-border-color bg-bg-card p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-brand-accent" />
                <h2 className="text-sm font-semibold text-text-primary">
                  Quyền hệ thống được cấp
                </h2>
              </div>
              <span className="text-xs font-mono text-text-muted">
                {authorities.length} quyền
              </span>
            </div>

            {authorities.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-1">
                {authorities.map((auth) => (
                  <span
                    key={auth}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-bg-secondary text-text-secondary border border-border-color"
                  >
                    {auth}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted italic">
                Chưa ghi nhận quyền chức năng cụ thể trong phiên làm việc.
              </p>
            )}
          </section>
        </div>

        {/* Khối form đổi mật khẩu */}
        <section className="rounded-lg border border-border-color bg-bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-border-color pb-3">
            <KeyRound className="w-4 h-4 text-brand-primary" />
            <h2 className="text-sm font-semibold text-text-primary">
              Đổi mật khẩu tài khoản
            </h2>
          </div>

          <p className="text-xs text-text-secondary">
            Mật khẩu mới yêu cầu tối thiểu 8 ký tự, bao gồm cả chữ cái và số, đồng thời phải khác mật khẩu hiện tại.
          </p>

          {successMessage && (
            <div
              role="alert"
              className="p-3 rounded-lg border border-status-success-border bg-status-success-bg text-status-success text-xs leading-5 flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {serverError && (
            <div
              role="alert"
              className="p-3 rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger text-xs leading-5 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="admin-old-password"
                className="text-xs font-semibold text-text-secondary block"
              >
                Mật khẩu hiện tại <span className="text-status-danger">*</span>
              </label>
              <div className="relative">
                <input
                  id="admin-old-password"
                  name="oldPassword"
                  type="password"
                  value={formData.oldPassword}
                  onChange={handleChange}
                  autoComplete="current-password"
                  disabled={submitting}
                  aria-invalid={Boolean(errors.oldPassword)}
                  aria-describedby={errors.oldPassword ? "admin-old-password-error" : undefined}
                  className={`min-h-11 w-full rounded border bg-bg-card px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary ${
                    errors.oldPassword ? "border-status-danger" : "border-border-strong"
                  }`}
                />
              </div>
              {errors.oldPassword && (
                <p id="admin-old-password-error" className="text-xs text-status-danger">{errors.oldPassword}</p>
              )}
            </div>

            <div className="space-y-1">
              <label
                htmlFor="admin-new-password"
                className="text-xs font-semibold text-text-secondary block"
              >
                Mật khẩu mới <span className="text-status-danger">*</span>
              </label>
              <div className="relative">
                <input
                  id="admin-new-password"
                  name="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={submitting}
                  aria-invalid={Boolean(errors.newPassword)}
                  aria-describedby={errors.newPassword ? "admin-new-password-error" : undefined}
                  className={`min-h-11 w-full rounded border bg-bg-card px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary ${
                    errors.newPassword ? "border-status-danger" : "border-border-strong"
                  }`}
                />
              </div>
              {errors.newPassword && (
                <p id="admin-new-password-error" className="text-xs text-status-danger">{errors.newPassword}</p>
              )}
            </div>

            <div className="space-y-1">
              <label
                htmlFor="admin-confirm-password"
                className="text-xs font-semibold text-text-secondary block"
              >
                Xác nhận mật khẩu mới <span className="text-status-danger">*</span>
              </label>
              <div className="relative">
                <input
                  id="admin-confirm-password"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={submitting}
                  aria-invalid={Boolean(errors.confirmPassword)}
                  aria-describedby={errors.confirmPassword ? "admin-confirm-password-error" : undefined}
                  className={`min-h-11 w-full rounded border bg-bg-card px-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary ${
                    errors.confirmPassword ? "border-status-danger" : "border-border-strong"
                  }`}
                />
              </div>
              {errors.confirmPassword && (
                <p id="admin-confirm-password-error" className="text-xs text-status-danger">{errors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-11 inline-flex items-center justify-center gap-2 rounded bg-brand-primary px-4 text-sm font-semibold text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
            >
              <Lock className="w-4 h-4" />
              <span>{submitting ? "Đang xử lý..." : "Cập nhật mật khẩu"}</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
export default AdminProfileView
