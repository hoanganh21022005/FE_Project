import React from "react"
import { Check, Minus, ShieldCheck, KeyRound } from "lucide-react"
import { AdminResourceState } from "../AdminResourceState.jsx"
import { useAdminData } from "../AdminDataContext.jsx"

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
  const roles = resources.roles
  const permissions = resources.permissions

  const rolesData = roles.data || []
  const permissionsData = permissions.data || []

  return (
    <div className="space-y-6 w-full min-w-0 max-w-full">
      <div>
        <h2 className="text-xl leading-7 font-semibold text-text-primary">
          Vai trò & Quyền hệ thống
        </h2>
        <p className="mt-1 text-sm leading-5 text-text-secondary">
          Ma trận phân quyền chi tiết và danh mục quyền hạn tương ứng với từng vai trò trong hệ thống SCMS (chỉ đọc).
        </p>
      </div>

      {/* Ma trận vai trò × quyền */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 border-b border-border-color/60 pb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand-primary" />
            <h3 className="text-sm leading-5 font-semibold text-text-primary">
              Ma trận quyền hạn chỉ đọc
            </h3>
          </div>
          <span className="text-xs leading-4 text-text-muted">
            {permissionsData.length} quyền × {rolesData.length} vai trò
          </span>
        </div>

        <AdminResourceState
          resource={roles}
          onRetry={() => {
            retry("roles")
            retry("permissions")
          }}
          emptyTitle="Chưa có thông tin phân quyền"
        >
          <div className="grid min-w-0">
            <div className="w-full overflow-x-auto rounded-lg border border-border-color bg-bg-card">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-bg-secondary text-xs font-semibold text-text-secondary">
                <tr>
                  <th className="px-3.5 py-2.5 text-left align-middle">
                    Quyền chức năng
                  </th>
                  {rolesData.map((role) => (
                    <th
                      key={role.id ?? role.name}
                      className="px-3 py-2.5 text-center align-middle font-semibold"
                    >
                      <p className="text-xs leading-4 text-text-primary font-bold">
                        {getRoleDisplayName(role.name)}
                      </p>
                      <p className="mt-0.5 text-[11px] font-mono text-text-muted font-normal">
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
                          <p className="mt-0.5 text-[11px] font-mono text-text-secondary">
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
                      const granted = (role.permissions || []).some(
                        (item) =>
                          item.id === permission.id ||
                          item.name === permission.name,
                      )
                      return (
                        <td
                          key={`${role.id}-${permission.id}`}
                          className="px-3.5 py-2.5 align-middle text-center"
                        >
                          {granted ? (
                            <span className="relative inline-flex items-center justify-center p-1 rounded bg-status-success-bg/80">
                              <Check
                                className="w-4 h-4 text-status-success"
                                aria-hidden="true"
                              />
                              <span className="sr-only">Có</span>
                            </span>
                          ) : (
                            <span className="relative inline-flex items-center justify-center p-1">
                              <Minus
                                className="w-4 h-4 text-text-muted/40"
                                aria-hidden="true"
                              />
                              <span className="sr-only">Không</span>
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
          aria-label="Danh sách vai trò"
        >
          <div className="flex items-center justify-between border-b border-border-color/60 pb-2.5">
            <h3 className="text-sm leading-5 font-semibold text-text-primary">
              Danh mục vai trò ({rolesData.length})
            </h3>
            <span className="text-xs leading-4 text-text-muted">
              Đồng bộ từ Backend
            </span>
          </div>

          <AdminResourceState
            resource={roles}
            onRetry={() => retry("roles")}
            emptyTitle="Chưa có vai trò"
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
                      {(role.permissions || []).length} quyền
                    </span>
                  </div>
                  <p className="text-xs leading-4 text-text-muted">
                    {role.description || "Chưa có thông tin mô tả."}
                  </p>
                </div>
              ))}
            </div>
          </AdminResourceState>
        </section>

        <section
          className="w-full min-w-0 max-w-full rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-3"
          aria-label="Danh mục quyền hạn"
        >
          <div className="flex items-center justify-between border-b border-border-color/60 pb-2.5">
            <h3 className="text-sm leading-5 font-semibold text-text-primary">
              Danh mục quyền hệ thống ({permissionsData.length})
            </h3>
            <span className="text-xs leading-4 text-text-muted">
              Mã định danh chức năng
            </span>
          </div>

          <AdminResourceState
            resource={permissions}
            onRetry={() => retry("permissions")}
            emptyTitle="Chưa có quyền"
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
                    {permission.description || "Chưa có thông tin mô tả."}
                  </p>
                </div>
              ))}
            </div>
          </AdminResourceState>
        </section>
      </div>
    </div>
  )
}
