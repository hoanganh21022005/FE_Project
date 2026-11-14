import React, { useEffect, useRef, useState } from "react"
import { AlertTriangle, LoaderCircle, ShieldAlert, X } from "lucide-react"
import { updateUserRole } from "../../api/adminApi.js"
import { useSCMS } from "../../context/SCMSContext.jsx"
import { getAdminRoleLabel, getAdminText } from "./adminI18n.js"
import { isValidUserId } from "./UserStatusDialog.jsx"
import { useDialogFocus } from "./useDialogFocus.js"

export function UserRoleDialog({
  isOpen,
  onClose,
  user,
  roles = [],
  currentUserId,
  activeAdminCount = 1,
  onSuccess,
  triggerRef,
}) {
  const { language } = useSCMS()
  const [selectedRoleId, setSelectedRoleId] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const dialogRef = useRef(null)

  useEffect(() => {
    if (isOpen && user) {
      setSelectedRoleId(user.roleId ? String(user.roleId) : "")
      setError(null)
    }
  }, [isOpen, user])

  useDialogFocus({
    isOpen,
    onClose,
    dialogRef,
    triggerRef,
    isLoading: loading,
  })

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

  // Tìm thông tin vai trò mới được chọn
  const targetRole = roles.find((r) => String(r.id) === String(selectedRoleId))
  const isTargetAdmin =
    targetRole && String(targetRole.name || "").toLowerCase() === "admin"

  // Chốt chặn: Không cho hạ vai trò của Admin Active cuối cùng sang vai trò khác Admin
  const isDemotingLastAdmin = isLastActiveAdmin && !isTargetAdmin

  // Fail-closed: Chặn thay đổi nếu không xác định được currentUser, tự đổi vai trò, hoặc hạ Admin Active duy nhất
  const cannotChangeRole =
    !isCurrentIdValid ||
    isSelf ||
    isDemotingLastAdmin ||
    !selectedRoleId ||
    String(user.roleId) === String(selectedRoleId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (cannotChangeRole) return

    setLoading(true)
    setError(null)
    try {
      const res = await updateUserRole(user.id, Number(selectedRoleId))
      if (onSuccess) onSuccess(res, targetRole)
      onClose()
    } catch (err) {
      if (err?.status === 403) {
        setError(getAdminText(language, "common.noPermission"))
      } else {
        setError(err?.message || getAdminText(language, "roleDialog.errUpdate"))
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
        aria-labelledby="user-role-dialog-title"
        className="w-full max-w-lg rounded-lg border border-border-color bg-bg-card p-6 shadow-lg text-text-primary space-y-4"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-color/60 pb-3">
          <div>
            <h3 id="user-role-dialog-title" className="text-base font-semibold text-text-primary">
              {getAdminText(language, "roleDialog.title")}
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              {getAdminText(language, "roleDialog.userLabel")}{" "}
              <strong className="text-text-primary">{user.fullName || user.email}</strong> (ID #{user.id})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-11 h-11 inline-flex items-center justify-center rounded text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary shrink-0"
            aria-label={getAdminText(language, "common.close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chốt chặn: Không xác định được người đang đăng nhập */}
        {!isCurrentIdValid && (
          <div role="alert" className="p-3 rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger text-xs leading-4 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>{getAdminText(language, "statusDialog.guardPrefix")}</strong>{" "}
              {getAdminText(language, "statusDialog.guardInvalidId")}
            </div>
          </div>
        )}

        {/* Chốt chặn: Tự đổi vai trò */}
        {isSelf && (
          <div role="alert" className="p-3 rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger text-xs leading-4 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>{getAdminText(language, "statusDialog.guardPrefix")}</strong>{" "}
              {getAdminText(language, "roleDialog.guardSelf")}
            </div>
          </div>
        )}

        {/* Chốt chặn: Hạ vai trò Admin Active cuối cùng */}
        {isDemotingLastAdmin && !isSelf && (
          <div role="alert" className="p-3 rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger text-xs leading-4 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>{getAdminText(language, "statusDialog.guardPrefix")}</strong>{" "}
              {getAdminText(language, "roleDialog.guardLastAdmin")}
            </div>
          </div>
        )}

        {/* Cảnh báo thao tác trên tài khoản Admin */}
        {isAdminUser && !isSelf && !isDemotingLastAdmin && (
          <div role="alert" className="p-3 rounded-lg border border-status-warning-border bg-status-warning-bg text-status-warning text-xs leading-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>{getAdminText(language, "statusDialog.warnPrefix")}</strong>{" "}
              {getAdminText(language, "roleDialog.warnAdmin")}
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
            <label htmlFor="select-user-role" className="text-xs font-semibold text-text-secondary block">
              {getAdminText(language, "roleDialog.selectLabel")}
            </label>
            <select
              id="select-user-role"
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              disabled={loading || !isCurrentIdValid || isSelf}
              className="min-h-11 w-full rounded border border-border-strong bg-bg-card px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer disabled:bg-bg-secondary disabled:cursor-not-allowed"
            >
              <option value="">{getAdminText(language, "roleDialog.selectPlaceholder")}</option>
              {roles.map((r) => {
                const label = getAdminRoleLabel(r.name, language)
                return (
                  <option key={r.id} value={r.id}>
                    {label !== r.name ? `${label} (${r.name})` : r.name}
                  </option>
                )
              })}
            </select>
            <p className="text-xs text-text-muted mt-1 leading-4">
              {getAdminText(language, "roleDialog.note")}
            </p>
          </div>

          <div className="pt-3 border-t border-border-color/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="min-h-11 inline-flex items-center justify-center rounded px-4 py-2 text-sm font-medium border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              {getAdminText(language, "common.cancel")}
            </button>
            <button
              type="submit"
              disabled={loading || cannotChangeRole}
              className="min-h-11 inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
            >
              {loading && <LoaderCircle className="w-4 h-4 animate-spin" />}
              <span>{getAdminText(language, "roleDialog.submit")}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
