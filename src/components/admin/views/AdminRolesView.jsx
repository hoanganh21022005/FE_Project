import React, { useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Edit3,
  KeyRound,
  Lock,
  Minus,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react"
import { AdminResourceState } from "../AdminResourceState.jsx"
import { useAdminData } from "../AdminDataContext.jsx"
import { useSCMS } from "../../../context/SCMSContext.jsx"
import { updateRolePermissions } from "../../../api/adminApi.js"
import { AdminConfirmDialog } from "../AdminConfirmDialog.jsx"
import {
  getAdminPermissionLabel,
  getAdminRoleLabel,
  getAdminText,
} from "../adminI18n.js"

export const ROLE_NAME_LABELS = {
  Admin: "Quản trị viên hệ thống",
  ADMIN: "Quản trị viên hệ thống",
  CenterManager: "Quản lý trung tâm",
  CENTER_MANAGER: "Quản lý trung tâm",
  Receptionist: "Lễ tân",
  RECEPTIONIST: "Lễ tân",
  Coach: "Huấn luyện viên",
  COACH: "Huấn luyện viên",
  Member: "Hội viên",
  MEMBER: "Hội viên",
}

export const ADMIN_LOCKED_PERMISSIONS = [
  "MANAGE_RBAC",
  "MANAGE_USERS",
  "MANAGE_PERMISSIONS",
]

export const PERMISSION_LABEL_MAP = {
  MANAGE_USERS: "Quản lý người dùng",
  MANAGE_RBAC: "Quản lý vai trò & quyền",
  MANAGE_PERMISSIONS: "Quản trị phân quyền",
  VIEW_AUDIT_LOG: "Xem nhật ký hoạt động",
  VIEW_AUDIT_LOGS: "Xem nhật ký hoạt động",
  LOCK_SUBJECTS: "Khóa môn học",
  MANAGE_PACKAGES: "Quản lý gói tập",
  HANDLE_CHAT: "Xử lý tin nhắn trực tuyến",
  HANDLE_SUPPORT: "Xử lý hỗ trợ",
  MANAGE_SUBSCRIPTIONS: "Quản lý gói hội viên",
  RECORD_RESULT: "Ghi nhận kết quả tập",
  MANAGE_TRAINING_PLAN: "Quản lý kế hoạch tập",
  CHAT_AS_MEMBER: "Nhắn tin với tư cách hội viên",
  MANAGE_CLASSES: "Quản lý lớp học",
  MANAGE_STAFF: "Quản lý nhân viên",
  MANAGE_MEMBERS: "Quản lý hội viên",
  MANAGE_INVOICES: "Quản lý hóa đơn",
  MANAGE_PAYMENTS: "Quản lý thanh toán",
  MANAGE_SPECIALIZATIONS: "Quản lý chuyên môn",
  MANAGE_SYSTEM_SETTINGS: "Cài đặt hệ thống",
  PROCESS_PAYMENT: "Xử lý thanh toán",
  REGISTER_MEMBER: "Đăng ký hội viên",
  MANAGE_ATTENDANCE: "Quản lý điểm danh",
  TAKE_ATTENDANCE: "Điểm danh học viên",
  VIEW_ATTENDANCE: "Xem lịch sử điểm danh",
  VIEW_PROFILE: "Xem hồ sơ cá nhân",
  EDIT_PROFILE: "Chỉnh sửa hồ sơ",
  VIEW_SCHEDULE: "Xem lịch học / lịch dạy",
  VIEW_INVOICES: "Xem hóa đơn",
  VIEW_REPORTS: "Xem báo cáo thống kê",
}

const getRoleDisplayName = (name) => ROLE_NAME_LABELS[name] || name || "Vai trò"
const getPermissionDisplayName = (name) => PERMISSION_LABEL_MAP[name] || name || "Quyền hạn"

export function AdminRolesView() {
  const { resources, retry } = useAdminData()
  const { language } = useSCMS()
  const isEn = language === "en"
  const roles = resources.roles
  const permissions = resources.permissions
  const getRoleDisplayName = (name) => getAdminRoleLabel(name, language)
  const getPermissionDisplayName = (name) => getAdminPermissionLabel(name, language)

  const rolesData = roles.data || []
  const permissionsData = permissions.data || []

  // Trạng thái chế độ chỉnh sửa phân quyền
  const [isEditing, setIsEditing] = useState(false)
  const [draftPermissions, setDraftPermissions] = useState({})
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [actionAlert, setActionAlert] = useState(null)
  const saveBtnRef = useRef(null)

  const handleStartEdit = () => {
    const draft = {}
    rolesData.forEach((role) => {
      draft[role.id] = (role.permissions || []).map((p) => Number(p.id)).filter(Boolean)
    })
    setDraftPermissions(draft)
    setSaveError(null)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setDraftPermissions({})
    setSaveError(null)
  }

  const handleTogglePermission = (roleId, permissionId, permissionName, roleName) => {
    const isAdminRole = String(roleName || "").toLowerCase() === "admin"
    // Chốt chặn: Không cho phép gỡ bất kỳ quyền cốt lõi nào khỏi vai trò Admin
    if (isAdminRole && ADMIN_LOCKED_PERMISSIONS.includes(permissionName)) {
      return
    }

    setDraftPermissions((prev) => {
      const currentList = prev[roleId] || []
      const numPermId = Number(permissionId)
      const nextList = currentList.includes(numPermId)
        ? currentList.filter((id) => id !== numPermId)
        : [...currentList, numPermId]
      return { ...prev, [roleId]: nextList }
    })
  }

  // Tóm tắt các thay đổi để hiển thị trong modal xác nhận
  const changedRolesSummary = useMemo(() => {
    if (!isEditing) return []
    return rolesData
      .map((role) => {
        const originalIds = new Set(
          (role.permissions || []).map((p) => Number(p.id)).filter(Boolean),
        )
        const currentIds = new Set(draftPermissions[role.id] || [])

        const added = permissionsData.filter(
          (p) => currentIds.has(Number(p.id)) && !originalIds.has(Number(p.id)),
        )
        const removed = permissionsData.filter(
          (p) => !currentIds.has(Number(p.id)) && originalIds.has(Number(p.id)),
        )

        return {
          role,
          hasChange: added.length > 0 || removed.length > 0,
          added,
          removed,
          newPermissionIds: Array.from(currentIds),
        }
      })
      .filter((item) => item.hasChange)
  }, [isEditing, rolesData, permissionsData, draftPermissions])

  const handleConfirmSave = async () => {
    if (changedRolesSummary.length === 0) return
    setSaving(true)
    setSaveError(null)

    // Chốt chặn trước khi gọi PUT: kiểm tra danh sách gửi cho vai trò Admin có đủ 3 quyền cốt lõi
    for (const item of changedRolesSummary) {
      const isItemAdmin = String(item.role?.name || "").toLowerCase() === "admin"
      if (isItemAdmin) {
        const requiredIds = permissionsData
          .filter((p) => ADMIN_LOCKED_PERMISSIONS.includes(p.name))
          .map((p) => Number(p.id))
        const hasAllRequired = requiredIds.every((reqId) =>
          item.newPermissionIds.includes(reqId),
        )
        if (!hasAllRequired) {
          setSaveError(
            getAdminText(language, "roles.errLockedAdmin", {
              perms: ADMIN_LOCKED_PERMISSIONS.join(", "),
            }),
          )
          setIsConfirmOpen(false)
          setSaving(false)
          return
        }
      }
    }

    try {
      for (const item of changedRolesSummary) {
        await updateRolePermissions(item.role.id, item.newPermissionIds)
      }
      retry("roles")
      retry("permissions")
      retry("auditLogs")
      setIsEditing(false)
      setIsConfirmOpen(false)
      setActionAlert({
        type: "success",
        message: getAdminText(language, "roles.saveSuccess"),
      })
    } catch (err) {
      if (err?.status === 403) {
        setSaveError(getAdminText(language, "common.noPermission"))
      } else {
        setSaveError(err?.message || getAdminText(language, "roles.saveError"))
      }
      setIsConfirmOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 w-full min-w-0 max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl leading-7 font-semibold text-text-primary">
            {getAdminText(language, "roles.title")}
          </h2>
          <p className="mt-1 text-sm leading-5 text-text-secondary">
            {getAdminText(language, "roles.subtitle")}
          </p>
        </div>
        {!isEditing ? (
          <button
            type="button"
            onClick={handleStartEdit}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 py-2 text-xs font-semibold bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            <Edit3 className="w-4 h-4" />
            <span>{getAdminText(language, "roles.editBtn")}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-3.5 py-2 text-xs font-medium border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              <X className="w-4 h-4" />
              <span>{getAdminText(language, "common.cancel")}</span>
            </button>
            <button
              ref={saveBtnRef}
              type="button"
              onClick={() => setIsConfirmOpen(true)}
              disabled={saving || changedRolesSummary.length === 0}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-4 py-2 text-xs font-semibold bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
            >
              <Save className="w-4 h-4" />
              <span>
                {getAdminText(language, "roles.saveBtn", {
                  count: changedRolesSummary.length,
                })}
              </span>
            </button>
          </div>
        )}
      </div>

      {actionAlert && (
        <div
          role="alert"
          className="p-3.5 rounded-lg border border-status-success-border bg-status-success-bg text-status-success flex items-center justify-between gap-3 text-sm animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionAlert.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionAlert(null)}
            className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded hover:bg-black/5 transition-colors cursor-pointer"
            aria-label={getAdminText(language, "common.closeAlert")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {saveError && (
        <div
          role="alert"
          className="p-3.5 rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger flex items-center justify-between gap-3 text-sm animate-in fade-in"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{saveError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded hover:bg-black/5 transition-colors cursor-pointer"
            aria-label={getAdminText(language, "common.closeError")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isEditing && (
        <div className="p-3 rounded-lg border border-brand-primary/40 bg-brand-primary/5 text-brand-primary text-xs flex items-start gap-2.5">
          <Edit3 className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong>{getAdminText(language, "roles.editingBannerPrefix")}</strong>{" "}
            {getAdminText(language, "roles.editingBannerBody")}
          </div>
        </div>
      )}

      {/* Ma trận vai trò × quyền */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 border-b border-border-color/60 pb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand-primary" />
            <h3 className="text-sm leading-5 font-semibold text-text-primary">
              {isEditing
                ? getAdminText(language, "roles.matrixTitleEdit")
                : getAdminText(language, "roles.matrixTitle")}
            </h3>
          </div>
          <span className="text-xs leading-4 text-text-muted">
            {getAdminText(language, "roles.matrixSummary", {
              perms: permissionsData.length,
              roles: rolesData.length,
            })}
          </span>
        </div>

        <AdminResourceState
          resource={roles}
          onRetry={() => {
            retry("roles")
            retry("permissions")
          }}
          emptyTitle={getAdminText(language, "roles.emptyTitle")}
        >
          <div className="grid min-w-0">
            <div className="w-full overflow-x-auto rounded-lg border border-border-color bg-bg-card">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-bg-secondary text-xs font-semibold text-text-secondary">
                <tr>
                  <th className="px-3.5 py-2.5 text-left align-middle">
                    {getAdminText(language, "roles.colPerm")}
                  </th>
                  {rolesData.map((role) => (
                    <th
                      key={role.id ?? role.name}
                      className="px-3 py-2.5 text-center align-middle font-semibold"
                    >
                      <p className="text-xs leading-4 text-text-primary font-bold">
                        {getRoleDisplayName(role.name)}
                      </p>
                      <p className="mt-0.5 text-xs font-mono text-text-muted font-normal">
                        {role.name}
                      </p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color">
                {permissionsData.map((permission) => (
                  <tr
                    key={permission.id ?? permission.name}
                    className="transition-colors hover:bg-bg-secondary/60"
                  >
                    <td className="px-3.5 py-2 align-middle text-sm leading-5 text-text-primary">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-3.5 h-3.5 text-brand-primary shrink-0 opacity-80" />
                        <div>
                          <p className="font-medium text-text-primary text-sm leading-5">
                            {getPermissionDisplayName(permission.name)}
                          </p>
                          <p className="mt-0.5 text-xs font-mono text-text-secondary">
                            {permission.name}
                          </p>
                          {permission.description && (
                            <p className="mt-0.5 text-xs leading-4 text-text-muted line-clamp-1">
                              {permission.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    {rolesData.map((role) => {
                      const isAdminRole = String(role.name || "").toLowerCase() === "admin"
                      const isMandatoryAdminPerm =
                        isAdminRole && ADMIN_LOCKED_PERMISSIONS.includes(permission.name)

                      let isGranted = false
                      if (isEditing) {
                        isGranted = (draftPermissions[role.id] || []).includes(Number(permission.id))
                        if (isMandatoryAdminPerm) isGranted = true
                      } else {
                        isGranted = (role.permissions || []).some(
                          (item) =>
                            Number(item.id) === Number(permission.id) ||
                            item.name === permission.name,
                        )
                      }

                      return (
                        <td
                          key={`${role.id}-${permission.id}`}
                          className="px-2 py-1 align-middle text-center"
                        >
                          {isEditing ? (
                            isMandatoryAdminPerm ? (
                              <div
                                className="relative inline-flex min-h-11 min-w-11 items-center justify-center text-status-success"
                                title={getAdminText(language, "roles.lockedTooltip")}
                              >
                                <span className="p-1 rounded bg-status-success-bg/80 inline-flex items-center justify-center">
                                  <Lock className="w-3.5 h-3.5 text-brand-primary mr-0.5" />
                                  <Check className="w-4 h-4 text-status-success stroke-[2.5]" />
                                </span>
                                <span className="sr-only">
                                  {getAdminText(language, "roles.permAriaLocked", {
                                    role: getRoleDisplayName(role.name),
                                    perm: getPermissionDisplayName(permission.name),
                                  })}
                                </span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  handleTogglePermission(
                                    role.id,
                                    permission.id,
                                    permission.name,
                                    role.name,
                                  )
                                }
                                aria-label={getAdminText(
                                  language,
                                  isGranted ? "roles.permAriaRevoke" : "roles.permAriaGrant",
                                  {
                                    perm: getPermissionDisplayName(permission.name),
                                    role: getRoleDisplayName(role.name),
                                  },
                                )}
                                className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded transition-colors cursor-pointer hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                              >
                                {isGranted ? (
                                  <span className="p-1 rounded bg-status-success-bg inline-flex items-center justify-center">
                                    <Check className="w-4 h-4 text-status-success stroke-[2.5]" />
                                    <span className="sr-only">{isEn ? "Granted" : "Đã cấp"}</span>
                                  </span>
                                ) : (
                                  <span className="p-1 rounded bg-bg-secondary inline-flex items-center justify-center">
                                    <Minus className="w-4 h-4 text-text-muted/40" />
                                    <span className="sr-only">{isEn ? "Not granted" : "Chưa cấp"}</span>
                                  </span>
                                )}
                              </button>
                            )
                          ) : isGranted ? (
                            <span className="relative inline-flex items-center justify-center p-1 rounded bg-status-success-bg/80">
                              <Check
                                className="w-4 h-4 text-status-success stroke-[2.5]"
                                aria-hidden="true"
                              />
                              <span className="sr-only">{isEn ? "Yes" : "Có"}</span>
                            </span>
                          ) : (
                            <span className="relative inline-flex items-center justify-center p-1">
                              <Minus
                                className="w-4 h-4 text-text-muted/40"
                                aria-hidden="true"
                              />
                              <span className="sr-only">{isEn ? "No" : "Không"}</span>
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </AdminResourceState>
      </div>

      {/* Danh mục chi tiết vai trò và quyền */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full min-w-0 max-w-full">
        <section
          className="w-full min-w-0 max-w-full rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-3"
          aria-label={isEn ? "Role list" : "Danh sách vai trò"}
        >
          <div className="flex items-center justify-between border-b border-border-color/60 pb-2.5">
            <h3 className="text-sm leading-5 font-semibold text-text-primary">
              {isEn ? `Roles (${rolesData.length})` : `Danh mục vai trò (${rolesData.length})`}
            </h3>
            <span className="text-xs leading-4 text-text-muted">
              {isEn ? "Synced from Backend" : "Đồng bộ từ Backend"}
            </span>
          </div>

          <AdminResourceState
            resource={roles}
            onRetry={() => retry("roles")}
            emptyTitle={getAdminText(language, "roles.emptyTitle")}
          >
            <div className="divide-y divide-border-color/60">
              {rolesData.map((role) => (
                <div
                  key={role.id ?? role.name}
                  className="py-3 first:pt-1 last:pb-1 space-y-1"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm leading-5 font-semibold text-text-primary">
                        {getRoleDisplayName(role.name)}
                      </p>
                      <p className="text-xs font-mono text-text-secondary">
                        {role.name || `Role #${role.id}`}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-status-info-bg text-status-info ring-1 ring-inset ring-status-info-border">
                      {getAdminText(language, "roles.permCount", {
                        count: (role.permissions || []).length,
                      })}
                    </span>
                  </div>
                  <p className="text-xs leading-4 text-text-muted">
                    {role.description || (isEn ? "No description." : "Chưa có thông tin mô tả.")}
                  </p>
                </div>
              ))}
            </div>
          </AdminResourceState>
        </section>

        <section
          className="w-full min-w-0 max-w-full rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-3"
          aria-label={getAdminText(language, "roles.catalogTitle")}
        >
          <div className="flex items-center justify-between border-b border-border-color/60 pb-2.5">
            <h3 className="text-sm leading-5 font-semibold text-text-primary">
              {getAdminText(language, "roles.catalogTitle")} ({permissionsData.length})
            </h3>
            <span className="text-xs leading-4 text-text-muted">
              {getAdminText(language, "roles.catalogColCode")}
            </span>
          </div>

          <AdminResourceState
            resource={permissions}
            onRetry={() => retry("permissions")}
            emptyTitle={getAdminText(language, "roles.catalogEmpty")}
          >
            <div className="divide-y divide-border-color/60 max-h-[460px] overflow-y-auto pr-1">
              {permissionsData.map((permission) => (
                <div
                  key={permission.id ?? permission.name}
                  className="py-2.5 first:pt-1 last:pb-1"
                >
                  <p className="text-sm leading-5 font-semibold text-text-primary">
                    {getPermissionDisplayName(permission.name)}
                  </p>
                  <p className="text-xs leading-4 font-mono text-text-secondary mt-0.5 break-all">
                    {permission.name}
                  </p>
                  <p className="mt-0.5 text-xs leading-4 text-text-muted">
                    {permission.description || (isEn ? "No description." : "Chưa có thông tin mô tả.")}
                  </p>
                </div>
              ))}
            </div>
          </AdminResourceState>
        </section>
      </div>

      {/* Modal xác nhận lưu phân quyền */}
      <AdminConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmSave}
        title={getAdminText(language, "roles.confirmTitle")}
        description={
          <div className="space-y-3">
            <p className="text-sm leading-5 text-text-secondary">
              {getAdminText(language, "roles.confirmDescIntro", {
                count: changedRolesSummary.length,
              })}
            </p>
            <div className="max-h-60 overflow-y-auto space-y-2.5 rounded-lg border border-border-color bg-bg-secondary/40 p-3 text-xs">
              {changedRolesSummary.map((item) => (
                <div key={item.role.id} className="space-y-1">
                  <p className="font-semibold text-text-primary">
                    {getRoleDisplayName(item.role.name)} ({item.role.name}):
                  </p>
                  {item.added.length > 0 && (
                    <div className="text-status-success pl-2">
                      <span className="font-medium">{getAdminText(language, "roles.confirmAdded")} </span>
                      {item.added.map((p) => getPermissionDisplayName(p.name)).join(", ")}
                    </div>
                  )}
                  {item.removed.length > 0 && (
                    <div className="text-status-danger pl-2">
                      <span className="font-medium">{getAdminText(language, "roles.confirmRemoved")} </span>
                      {item.removed.map((p) => getPermissionDisplayName(p.name)).join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        }
        warning={getAdminText(language, "roles.confirmWarning")}
        confirmText={getAdminText(language, "roles.confirmSubmit")}
        cancelText={getAdminText(language, "common.cancel")}
        isLoading={saving}
        triggerRef={saveBtnRef}
      />
    </div>
  )
}
