import React, { useMemo, useState } from "react"
import { Search, UserRound, X } from "lucide-react"
import { AdminResourceState } from "../AdminResourceState.jsx"
import { useAdminData } from "../AdminDataContext.jsx"

const statusLabel = (status) =>
  ({
    active: "Hoạt động",
    inactive: "Không hoạt động",
    locked: "Đã khóa",
  })[status] ||
  status ||
  "Không rõ"

const formatDate = (value) => {
  if (!value) return "Chưa có"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date)
}

export function AdminUsersView() {
  const { resources, retry } = useAdminData()
  const [query, setQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedUser, setSelectedUser] = useState(null)

  const roleOptions = useMemo(() => {
    const fromRoles = resources.roles.data.map((role) => role.name)
    const fromUsers = resources.users.data
      .map((user) => user.roleName)
      .filter(Boolean)
    return [...new Set([...fromRoles, ...fromUsers])].sort()
  }, [resources.roles.data, resources.users.data])

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return resources.users.data.filter((user) => {
      const matchesQuery =
        !normalizedQuery ||
        [user.fullName, user.email, user.code, user.phone].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(normalizedQuery),
        )
      const matchesRole = roleFilter === "all" || user.roleName === roleFilter
      const matchesStatus =
        statusFilter === "all" || user.status === statusFilter
      return matchesQuery && matchesRole && matchesStatus
    })
  }, [query, resources.users.data, roleFilter, statusFilter])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-stone-950">
          Danh sách người dùng
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Dữ liệu chỉ đọc từ `GET /api/users`; tìm kiếm và lọc được thực hiện
          tại giao diện.
        </p>
      </div>

      <div className="bg-white border border-stone-200 rounded-lg p-3 flex flex-col md:flex-row gap-3">
        <label className="relative flex-1 min-w-0">
          <span className="sr-only">Tìm người dùng</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tên, email, mã hoặc số điện thoại"
            className="w-full h-11 min-h-[44px] pl-9 pr-3 rounded border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#BA0000]"
          />
        </label>
        <label>
          <span className="sr-only">Lọc theo vai trò</span>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="w-full md:w-48 h-11 min-h-[44px] px-3 rounded border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#BA0000] cursor-pointer"
          >
            <option value="all">Tất cả vai trò</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Lọc theo trạng thái</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="w-full md:w-44 h-11 min-h-[44px] px-3 rounded border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#BA0000] cursor-pointer"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="inactive">Không hoạt động</option>
            <option value="locked">Đã khóa</option>
          </select>
        </label>
      </div>

      <AdminResourceState
        resource={resources.users}
        onRetry={() => retry("users")}
        emptyTitle="Chưa có người dùng"
      >
        <div
          className={`grid gap-4 ${
            selectedUser ? "xl:grid-cols-[minmax(0,1fr)_320px]" : ""
          }`}
        >
          <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-stone-50 text-xs text-stone-700 border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-3">Người dùng</th>
                    <th className="px-4 py-3">Vai trò</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Ngày tạo</th>
                    <th className="px-4 py-3 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id ?? user.email}
                      className="hover:bg-stone-50"
                    >
                      <td className="px-4 py-3">
                        <p className="font-bold text-stone-950">
                          {user.fullName || "Chưa có tên"}
                        </p>
                        <p className="mt-0.5 text-xs text-stone-600">
                          {user.email}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-1 rounded bg-red-50 text-red-950 border border-red-200 text-xs font-bold">
                          {user.roleName || `Role #${user.roleId ?? "?"}`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-1 rounded text-xs font-bold ${
                            user.status === "active"
                              ? "bg-emerald-50 text-emerald-800"
                              : user.status === "locked"
                                ? "bg-rose-50 text-rose-800"
                                : "bg-stone-100 text-stone-700"
                          }`}
                        >
                          {statusLabel(user.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-600 tabular-nums">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedUser(user)}
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded border border-stone-300 text-xs font-bold text-stone-800 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-[#BA0000] cursor-pointer transition-colors"
                        >
                          Xem
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredUsers.length === 0 && (
              <p className="p-8 text-center text-sm text-stone-600">
                Không có người dùng phù hợp bộ lọc.
              </p>
            )}
          </div>

          {selectedUser && (
            <aside
              className="bg-white border border-stone-200 rounded-lg p-5 h-fit"
              aria-label="Chi tiết người dùng"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded bg-red-50 text-[#BA0000] flex items-center justify-center">
                  <UserRound className="w-5 h-5" />
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="w-11 h-11 min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-1.5 rounded text-stone-600 hover:bg-stone-100 cursor-pointer transition-colors"
                  aria-label="Đóng chi tiết"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <h3 className="mt-4 font-bold text-stone-950">
                {selectedUser.fullName || "Chưa có tên"}
              </h3>
              <p className="text-xs text-stone-600">
                ID #{selectedUser.id ?? "N/A"} ·{" "}
                {selectedUser.code || "Chưa có mã"}
              </p>
              <dl className="mt-5 space-y-3 text-sm">
                {[
                  ["Email", selectedUser.email || "Chưa có"],
                  ["Điện thoại", selectedUser.phone || "Chưa có"],
                  [
                    "Vai trò",
                    selectedUser.roleName ||
                      `Role #${selectedUser.roleId ?? "?"}`,
                  ],
                  ["Địa chỉ", selectedUser.address || "Chưa có"],
                  ["Ngày sinh", selectedUser.dateOfBirth || "Chưa có"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold text-stone-500">
                      {label}
                    </dt>
                    <dd className="mt-0.5 text-stone-900 break-words">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </aside>
          )}
        </div>
      </AdminResourceState>
    </div>
  )
}
