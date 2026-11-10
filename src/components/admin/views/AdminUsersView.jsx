import React, { useEffect, useMemo, useRef, useState } from "react"
import { Search, UserRound, X } from "lucide-react"
import { AdminResourceState } from "../AdminResourceState.jsx"
import { useAdminData } from "../AdminDataContext.jsx"
import { formatAdminDate } from "../adminDateUtils.js"

const statusLabel = (status) =>
  ({
    active: "Hoạt động",
    inactive: "Không hoạt động",
    locked: "Đã khóa",
  })[status] ||
  status ||
  "Không rõ"

export function AdminUsersView() {
  const { resources, retry } = useAdminData()
  const [query, setQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedUser, setSelectedUser] = useState(null)

  const asideRef = useRef(null)
  const closeBtnRef = useRef(null)
  const lastTriggerRef = useRef(null)

  const isSmallScreen = () =>
    typeof window !== "undefined" &&
    !window.matchMedia("(min-width: 1280px)").matches

  const handleSelectUser = (user, event) => {
    lastTriggerRef.current = event?.currentTarget || null
    setSelectedUser(user)
  }

  const handleCloseDetails = () => {
    setSelectedUser(null)
    if (lastTriggerRef.current && document.contains(lastTriggerRef.current)) {
      if (isSmallScreen()) {
        lastTriggerRef.current.scrollIntoView({
          behavior: "instant",
          block: "nearest",
        })
      }
      lastTriggerRef.current.focus({ preventScroll: true })
    }
  }

  useEffect(() => {
    if (!selectedUser) return
    if (isSmallScreen() && asideRef.current) {
      asideRef.current.scrollIntoView({
        behavior: "instant",
        block: "start",
      })
      closeBtnRef.current?.focus({ preventScroll: true })
    }
  }, [selectedUser])

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
        <h2 className="text-xl leading-7 font-semibold text-text-primary">
          Danh sách người dùng
        </h2>
        <p className="mt-1 text-sm leading-5 text-text-secondary">
          Danh sách tài khoản được đồng bộ trực tiếp từ hệ thống quản trị trung tâm; hỗ trợ tìm kiếm và phân loại nhanh.
        </p>
      </div>

      <div className="rounded-lg border border-border-color bg-bg-card p-3 text-text-primary flex flex-col md:flex-row gap-2.5">
        <label className="relative flex-1 min-w-0">
          <span className="sr-only">Tìm người dùng</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tên, email, mã hoặc số điện thoại..."
            className="h-9 w-full rounded border border-border-color bg-bg-card pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
          />
        </label>
        <label className="w-full md:w-48">
          <span className="sr-only">Lọc theo vai trò</span>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="h-9 w-full rounded border border-border-color bg-bg-card px-2.5 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted cursor-pointer"
          >
            <option value="all">Tất cả vai trò</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <label className="w-full md:w-44">
          <span className="sr-only">Lọc theo trạng thái</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-9 w-full rounded border border-border-color bg-bg-card px-2.5 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted cursor-pointer"
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
          <div className="w-full overflow-x-auto rounded-lg border border-border-color bg-bg-card">
            <table className="w-full min-w-full text-left text-sm">
              <thead className="bg-bg-secondary text-xs font-semibold text-text-secondary">
                <tr>
                  <th className="px-3.5 py-2.5 text-left align-middle">Người dùng</th>
                  <th className="px-3.5 py-2.5 text-left align-middle">Vai trò</th>
                  <th className="px-3.5 py-2.5 text-left align-middle">Trạng thái</th>
                  <th className="px-3.5 py-2.5 text-left align-middle">Ngày tạo</th>
                  <th className="px-3.5 py-2.5 text-right align-middle">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color">
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id ?? user.email}
                    className="transition-colors hover:bg-bg-secondary/70"
                  >
                    <td className="px-3.5 py-2.5 align-middle text-sm leading-5 text-text-primary">
                      <p className="font-semibold text-text-primary">
                        {user.fullName || "Chưa có tên"}
                      </p>
                      <p className="text-xs leading-4 text-text-secondary">
                        {user.email}
                      </p>
                    </td>
                    <td className="px-3.5 py-2.5 align-middle text-sm leading-5 text-text-primary">
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-sky-50 text-status-info ring-1 ring-inset ring-sky-200">
                        {user.roleName || `Role #${user.roleId ?? "?"}`}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 align-middle text-sm leading-5 text-text-primary">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.status === "active"
                            ? "bg-emerald-50 text-status-success ring-1 ring-inset ring-emerald-200"
                            : user.status === "locked"
                              ? "bg-rose-50 text-status-danger ring-1 ring-inset ring-rose-200"
                              : "bg-bg-secondary text-text-secondary ring-1 ring-inset ring-border-color"
                        }`}
                      >
                        {statusLabel(user.status)}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 align-middle text-xs leading-4 text-text-secondary tabular-nums font-mono">
                      {formatAdminDate(user.createdAt)}
                    </td>
                    <td className="px-3.5 py-2.5 align-middle text-sm leading-5 text-text-primary text-right">
                      <button
                        type="button"
                        onClick={(event) => handleSelectUser(user, event)}
                        className="inline-flex h-7 items-center justify-center rounded px-2.5 text-xs font-medium border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary hover:text-brand-primary transition-colors cursor-pointer scroll-mt-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                      >
                        Xem
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && (
              <p className="p-8 text-center text-sm leading-5 text-text-secondary">
                Không có người dùng phù hợp bộ lọc.
              </p>
            )}
          </div>

          {selectedUser && (
            <aside
              ref={asideRef}
              className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary h-fit scroll-mt-20 shadow-xs"
              aria-label="Chi tiết người dùng"
            >
              <div className="flex items-start justify-between gap-3 border-b border-border-color pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded bg-bg-secondary text-brand-primary flex items-center justify-center shrink-0">
                    <UserRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm leading-5 font-semibold text-text-primary">
                      {selectedUser.fullName || "Chưa có tên"}
                    </h3>
                    <p className="text-xs leading-4 text-text-secondary font-mono">
                      ID #{selectedUser.id ?? "N/A"} · {selectedUser.code || "Chưa có mã"}
                    </p>
                  </div>
                </div>
                <button
                  ref={closeBtnRef}
                  type="button"
                  onClick={handleCloseDetails}
                  className="w-7 h-7 inline-flex items-center justify-center rounded text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer shrink-0"
                  aria-label="Đóng chi tiết"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <dl className="mt-3.5 space-y-2.5 text-xs leading-4 font-normal text-text-primary">
                {[
                  ["Email", selectedUser.email || "Chưa có"],
                  ["Điện thoại", selectedUser.phone || "Chưa có"],
                  [
                    "Vai trò",
                    selectedUser.roleName ||
                      `Role #${selectedUser.roleId ?? "?"}`,
                  ],
                  ["Địa chỉ", selectedUser.address || "Chưa có"],
                  ["Ngày sinh", formatAdminDate(selectedUser.dateOfBirth)],
                  ["Ngày tạo", formatAdminDate(selectedUser.createdAt)],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col sm:flex-row sm:justify-between py-1 border-b border-border-color/50 last:border-0">
                    <dt className="text-xs leading-4 text-text-secondary">
                      {label}
                    </dt>
                    <dd className="text-xs leading-4 font-medium text-text-primary break-words sm:text-right">
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
