import React from "react"
import { Check, Minus } from "lucide-react"
import { AdminResourceState } from "../AdminResourceState.jsx"
import { useAdminData } from "../AdminDataContext.jsx"

export function AdminRolesView() {
  const { resources, retry } = useAdminData()
  const roles = resources.roles
  const permissions = resources.permissions

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl leading-7 font-semibold text-text-primary">Vai trò & Quyền</h2>
        <p className="mt-1 text-sm leading-5 text-text-secondary">
          Ma trận phân quyền và danh sách quyền hạn chi tiết của từng vai trò trong hệ thống.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-3.5">
        <section className="rounded-lg border border-border-color bg-bg-card p-3.5 text-text-primary">
          <h3 className="text-sm leading-5 font-semibold text-text-primary mb-2.5">Vai trò</h3>
          <AdminResourceState
            resource={roles}
            onRetry={() => retry("roles")}
            emptyTitle="Chưa có vai trò"
          >
            <div className="divide-y divide-border-color/60">
              {roles.data.map((role) => (
                <div
                  key={role.id ?? role.name}
                  className="py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm leading-5 font-semibold text-text-primary">
                      {role.name || `Role #${role.id}`}
                    </p>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-sky-50 text-status-info ring-1 ring-inset ring-sky-200">
                      {role.permissions.length} quyền
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-4 text-text-secondary">
                    {role.description || "Chưa có thông tin mô tả."}
                  </p>
                </div>
              ))}
            </div>
          </AdminResourceState>
        </section>

        <section className="rounded-lg border border-border-color bg-bg-card p-3.5 text-text-primary">
          <h3 className="text-sm leading-5 font-semibold text-text-primary mb-2.5">
            Danh mục quyền
          </h3>
          <AdminResourceState
            resource={permissions}
            onRetry={() => retry("permissions")}
            emptyTitle="Chưa có quyền"
          >
            <div className="divide-y divide-border-color/60">
              {permissions.data.map((permission) => (
                <div
                  key={permission.id ?? permission.name}
                  className="py-2.5 first:pt-0 last:pb-0"
                >
                  <p className="text-xs leading-4 font-mono font-semibold text-text-primary break-all">
                    {permission.name}
                  </p>
                  <p className="mt-0.5 text-xs leading-4 text-text-secondary">
                    {permission.description || "Chưa có thông tin mô tả."}
                  </p>
                </div>
              ))}
            </div>
          </AdminResourceState>
        </section>
      </div>

      {roles.status === "success" &&
        permissions.status === "success" &&
        roles.data.length > 0 &&
        permissions.data.length > 0 && (
          <section className="rounded-lg border border-border-color bg-bg-card p-3.5 text-text-primary space-y-2.5">
            <h3 className="text-sm leading-5 font-semibold text-text-primary">
              Ma trận quyền hiện tại
            </h3>
            <div className="w-full overflow-x-auto rounded-lg border border-border-color bg-bg-card">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-bg-secondary text-xs font-semibold text-text-secondary">
                  <tr>
                    <th className="sticky left-0 z-10 bg-bg-secondary px-3.5 py-2.5 text-left align-middle">
                      Quyền chức năng
                    </th>
                    {roles.data.map((role) => (
                      <th
                        key={role.id ?? role.name}
                        className="px-3 py-2.5 text-center align-middle font-semibold"
                      >
                        {role.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {permissions.data.map((permission) => (
                    <tr
                      key={permission.id ?? permission.name}
                      className="transition-colors hover:bg-bg-secondary/70"
                    >
                      <td className="sticky left-0 bg-bg-card px-3.5 py-2 align-middle text-sm leading-5 text-text-primary">
                        <p className="font-mono font-semibold text-text-primary">
                          {permission.name}
                        </p>
                        <p className="mt-0.5 text-xs text-text-secondary max-w-sm line-clamp-1">
                          {permission.description}
                        </p>
                      </td>
                      {roles.data.map((role) => {
                        const granted = role.permissions.some(
                          (item) =>
                            item.id === permission.id ||
                            item.name === permission.name,
                        )
                        return (
                          <td
                            key={`${role.id}-${permission.id}`}
                            className="px-3 py-2 align-middle text-xs text-center"
                          >
                            {granted ? (
                              <Check
                                className="w-3.5 h-3.5 text-status-success mx-auto"
                                aria-label="Có quyền"
                              />
                            ) : (
                              <Minus
                                className="w-3.5 h-3.5 text-text-muted/60 mx-auto"
                                aria-label="Không có quyền"
                              />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
    </div>
  )
}
