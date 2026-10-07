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
        <h2 className="text-xl font-bold text-stone-950">Vai trò & Quyền</h2>
        <p className="mt-1 text-sm text-stone-600">
          Ma trận chỉ đọc từ `GET /api/roles` và `GET /api/permissions`. Thay
          đổi quyền thuộc G3.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="bg-white border border-stone-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-stone-950 mb-3">Vai trò</h3>
          <AdminResourceState
            resource={roles}
            onRetry={() => retry("roles")}
            emptyTitle="Chưa có vai trò"
          >
            <div className="divide-y divide-stone-200">
              {roles.data.map((role) => (
                <div
                  key={role.id ?? role.name}
                  className="py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-stone-950">
                      {role.name || `Role #${role.id}`}
                    </p>
                    <span className="text-xs font-semibold text-[#BA0000]">
                      {role.permissions.length} quyền
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-stone-600">
                    {role.description || "Backend chưa cung cấp mô tả."}
                  </p>
                </div>
              ))}
            </div>
          </AdminResourceState>
        </section>

        <section className="bg-white border border-stone-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-stone-950 mb-3">
            Danh mục quyền
          </h3>
          <AdminResourceState
            resource={permissions}
            onRetry={() => retry("permissions")}
            emptyTitle="Chưa có quyền"
          >
            <div className="divide-y divide-stone-200">
              {permissions.data.map((permission) => (
                <div
                  key={permission.id ?? permission.name}
                  className="py-3 first:pt-0 last:pb-0"
                >
                  <p className="text-xs font-mono font-bold text-stone-950 break-all">
                    {permission.name}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-stone-600">
                    {permission.description || "Backend chưa cung cấp mô tả."}
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
          <section className="bg-white border border-stone-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-200">
              <h3 className="text-sm font-bold text-stone-950">
                Ma trận quyền hiện tại
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-stone-50 text-stone-700">
                  <tr>
                    <th className="sticky left-0 z-10 bg-stone-50 px-4 py-3">
                      Quyền
                    </th>
                    {roles.data.map((role) => (
                      <th
                        key={role.id ?? role.name}
                        className="px-4 py-3 text-center font-bold text-stone-900"
                      >
                        {role.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {permissions.data.map((permission) => (
                    <tr key={permission.id ?? permission.name}>
                      <td className="sticky left-0 bg-white px-4 py-3">
                        <p className="font-mono font-bold text-stone-950">
                          {permission.name}
                        </p>
                        <p className="mt-0.5 text-stone-500 max-w-sm">
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
                            className="px-4 py-3 text-center"
                          >
                            {granted ? (
                              <Check
                                className="w-4 h-4 text-emerald-700 mx-auto"
                                aria-label="Có quyền"
                              />
                            ) : (
                              <Minus
                                className="w-4 h-4 text-stone-300 mx-auto"
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
