import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, RefreshCw, Search, ShieldCheck, UserRound, X } from "lucide-react"
import { AdminResourceState } from "../AdminResourceState.jsx"
import { useAdminData } from "../AdminDataContext.jsx"
import { formatAdminDate } from "../adminDateUtils.js"
import { getAdminUsers, getUserById } from "../../../api/adminApi.js"
import { PERMISSION_LABEL_MAP, ROLE_NAME_LABELS } from "./AdminRolesView.jsx"

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

  // State lọc vai trò phía server
  // Ghi chú: Giá trị tham số role gửi lên server khớp chính xác với tên vai trò Backend (ví dụ: 'Admin', 'Member', ...)
  const [serverUsers, setServerUsers] = useState(null)
  const [roleLoading, setRoleLoading] = useState(false)
  const [roleError, setRoleError] = useState(null)

  // State chi tiết người dùng gọi getUserById
  const [selectedUserSummary, setSelectedUserSummary] = useState(null)
  const [detailUser, setDetailUser] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(null)

  const asideRef = useRef(null)
  const closeBtnRef = useRef(null)
  const lastTriggerRef = useRef(null)
  const roleFilterSeqRef = useRef(0)

  const isSmallScreen = () =>
    typeof window !== "undefined" &&
    !window.matchMedia("(min-width: 1280px)").matches

  // Gọi getUserById khi mở panel chi tiết
  const fetchUserDetail = useCallback(async (id) => {
    if (!id) return
    setDetailLoading(true)
    setDetailError(null)
    try {
      const data = await getUserById(id)
      setDetailUser(data)
    } catch (err) {
      setDetailError(err?.message || "Không thể tải chi tiết người dùng.")
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const handleSelectUser = (user, event) => {
    lastTriggerRef.current = event?.currentTarget || null
    setSelectedUserSummary(user)
    fetchUserDetail(user.id)
  }

  const handleCloseDetails = () => {
    setSelectedUserSummary(null)
    setDetailUser(null)
    setDetailError(null)
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
    if (!selectedUserSummary) return
    if (isSmallScreen() && asideRef.current) {
      asideRef.current.scrollIntoView({
        behavior: "instant",
        block: "start",
      })
      closeBtnRef.current?.focus({ preventScroll: true })
    }
  }, [selectedUserSummary])

  // Lọc vai trò: gửi tham số role lên server qua getAdminUsers
  // Ghi chú: giá trị role khớp tên vai trò Backend
  // Sử dụng sequence id để chống race condition: chỉ phản hồi của yêu cầu cuối cùng được áp dụng
  const handleRoleFilterChange = async (newRole) => {
    setRoleFilter(newRole)
    if (newRole === "all") {
      roleFilterSeqRef.current += 1
      setServerUsers(null)
      setRoleError(null)
      setRoleLoading(false)
      return
    }
    const currentSeq = ++roleFilterSeqRef.current
    setRoleLoading(true)
    setRoleError(null)
    try {
      const data = await getAdminUsers({ role: newRole })
      if (currentSeq === roleFilterSeqRef.current) {
        setServerUsers(data)
      }
    } catch (err) {
      if (currentSeq === roleFilterSeqRef.current) {
        setRoleError(err?.message || "Không thể lọc người dùng theo vai trò từ máy chủ.")
      }
    } finally {
      if (currentSeq === roleFilterSeqRef.current) {
        setRoleLoading(false)
      }
    }
  }

  const roleOptions = useMemo(() => {
    const fromRoles = (resources.roles.data || []).map((role) => role.name)
    const fromUsers = (resources.users.data || [])
      .map((user) => user.roleName)
      .filter(Boolean)
    return [...new Set([...fromRoles, ...fromUsers])].sort()
  }, [resources.roles.data, resources.users.data])

  // Danh sách cơ sở: từ serverUsers nếu đã lọc vai trò qua server, hoặc từ resources.users.data
  const baseUsers = serverUsers !== null ? serverUsers : (resources.users.data || [])

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return baseUsers.filter((user) => {
      const matchesQuery =
        !normalizedQuery ||
        [user.fullName, user.email, user.code, user.phone].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(normalizedQuery),
        )
      const matchesStatus =
        statusFilter === "all" || user.status === statusFilter
      return matchesQuery && matchesStatus
    })
  }, [baseUsers, query, statusFilter])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl leading-7 font-semibold text-text-primary">
          Danh sách người dùng
        </h2>
        <p className="mt-1 text-sm leading-5 text-text-secondary">
          Danh sách tài khoản được đồng bộ trực tiếp từ hệ thống quản trị trung tâm; hỗ trợ tìm kiếm và phân loại nhanh (chỉ đọc).
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
            className="min-h-11 w-full rounded border border-border-strong bg-bg-card pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
          />
        </label>
        <label className="w-full md:w-56">
          <span className="sr-only">Lọc theo vai trò</span>
          <select
            value={roleFilter}
            onChange={(event) => handleRoleFilterChange(event.target.value)}
            disabled={roleLoading}
            className="min-h-11 w-full rounded border border-border-strong bg-bg-card px-2.5 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted cursor-pointer"
          >
            <option value="all">Tất cả vai trò</option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {ROLE_NAME_LABELS[role] ? `${ROLE_NAME_LABELS[role]} (${role})` : role}
              </option>
            ))}
          </select>
        </label>
        <label className="w-full md:w-44">
          <span className="sr-only">Lọc theo trạng thái</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="min-h-11 w-full rounded border border-border-strong bg-bg-card px-2.5 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted cursor-pointer"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Hoạt động</option>
            <option value="inactive">Không hoạt động</option>
            <option value="locked">Đã khóa</option>
          </select>
        </label>
      </div>

      {/* Lỗi khi lọc vai trò phía server */}
      {roleError && (
        <div
          role="alert"
          className="p-3 rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger flex items-center justify-between gap-3 text-sm"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{roleError}</span>
          </div>
          <button
            type="button"
            onClick={() => handleRoleFilterChange(roleFilter)}
            className="inline-flex min-h-11 items-center gap-1.5 px-3 py-1.5 rounded font-medium border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Thử lại
          </button>
        </div>
      )}

      {/* Loading khi lọc vai trò */}
      {roleLoading ? (
        <div className="space-y-3 py-4" aria-label="Đang tải người dùng theo vai trò" aria-busy="true">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-10 rounded bg-bg-secondary animate-pulse" />
          ))}
        </div>
      ) : (
        <AdminResourceState
          resource={resources.users}
          onRetry={() => retry("users")}
          emptyTitle="Chưa có người dùng"
        >
          <div
            className={`grid gap-4 ${
              selectedUserSummary ? "xl:grid-cols-[minmax(0,1fr)_360px]" : ""
            }`}
          >
            <div className="w-full overflow-x-auto rounded-lg border border-border-color bg-bg-card">
              <table className="w-full min-w-[760px] text-left text-sm">
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
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-status-info-bg text-status-info ring-1 ring-inset ring-status-info-border">
                          {ROLE_NAME_LABELS[user.roleName] || user.roleName || `Role #${user.roleId ?? "?"}`}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 align-middle text-sm leading-5 text-text-primary">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            user.status === "active"
                              ? "bg-status-success-bg text-status-success ring-1 ring-inset ring-status-success-border"
                              : user.status === "locked"
                                ? "bg-status-danger-bg text-status-danger ring-1 ring-inset ring-status-danger-border"
                                : "bg-bg-secondary text-text-secondary ring-1 ring-inset ring-border-color"
                          }`}
                        >
                          {statusLabel(user.status)}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 align-middle text-sm leading-5 text-text-secondary tabular-nums font-mono">
                        {formatAdminDate(user.createdAt)}
                      </td>
                      <td className="px-3.5 py-1 align-middle text-sm leading-5 text-text-primary text-right">
                        <button
                          type="button"
                          onClick={(event) => handleSelectUser(user, event)}
                          className="inline-flex min-h-11 items-center justify-center rounded px-3 text-xs font-medium border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary hover:text-brand-primary transition-colors cursor-pointer scroll-mt-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
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

            {/* Panel chi tiết người dùng gọi getUserById */}
            {selectedUserSummary && (
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
                        {(detailUser || selectedUserSummary).fullName || "Chưa có tên"}
                      </h3>
                      <p className="text-xs leading-4 text-text-secondary font-mono">
                        ID #{(detailUser || selectedUserSummary).id ?? "N/A"} · {(detailUser || selectedUserSummary).code || "Chưa có mã"}
                      </p>
                    </div>
                  </div>
                  <button
                    ref={closeBtnRef}
                    type="button"
                    onClick={handleCloseDetails}
                    className="w-11 h-11 inline-flex items-center justify-center rounded text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer shrink-0"
                    aria-label="Đóng chi tiết"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {detailLoading ? (
                  <div className="py-6 space-y-3" aria-label="Đang tải chi tiết người dùng" aria-busy="true">
                    <div className="h-4 bg-bg-secondary rounded animate-pulse w-3/4" />
                    <div className="h-4 bg-bg-secondary rounded animate-pulse w-1/2" />
                    <div className="h-4 bg-bg-secondary rounded animate-pulse w-5/6" />
                    <p className="text-xs text-text-muted text-center pt-2">Đang tải thông tin chi tiết...</p>
                  </div>
                ) : detailError ? (
                  <div role="alert" className="py-4 space-y-3 text-center">
                    <div className="inline-flex p-2 rounded-full bg-status-danger-bg text-status-danger">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <p className="text-xs leading-4 text-status-danger font-medium">
                      {detailError}
                    </p>
                    <button
                      type="button"
                      onClick={() => fetchUserDetail(selectedUserSummary.id)}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 px-3 py-1.5 rounded border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Thử lại
                    </button>
                  </div>
                ) : (
                  <div className="mt-3.5 space-y-4">
                    <dl className="space-y-2.5 text-xs leading-4 font-normal text-text-primary">
                      {[
                        ["Mã tài khoản", (detailUser || selectedUserSummary).code || "Chưa có mã"],
                        ["Họ tên", (detailUser || selectedUserSummary).fullName || "Chưa có"],
                        ["Email", (detailUser || selectedUserSummary).email || "Chưa có"],
                        ["Điện thoại", (detailUser || selectedUserSummary).phone || "Chưa có"],
                        [
                          "Vai trò",
                          ROLE_NAME_LABELS[(detailUser || selectedUserSummary).roleName] ||
                            (detailUser || selectedUserSummary).roleName ||
                            `Role #${(detailUser || selectedUserSummary).roleId ?? "?"}`,
                        ],
                        [
                          "Trạng thái",
                          statusLabel((detailUser || selectedUserSummary).status),
                        ],
                        ["Địa chỉ", (detailUser || selectedUserSummary).address || "Chưa có"],
                        ["Ngày sinh", formatAdminDate((detailUser || selectedUserSummary).dateOfBirth)],
                        ["Ngày tạo", formatAdminDate((detailUser || selectedUserSummary).createdAt)],
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

                    {/* Danh sách quyền (nếu có) */}
                    <div className="pt-2 border-t border-border-color/60 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                        <ShieldCheck className="w-3.5 h-3.5 text-brand-primary" />
                        <span>Quyền hạn được cấp</span>
                      </div>
                      {(detailUser || selectedUserSummary).permissions &&
                      (detailUser || selectedUserSummary).permissions.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {(detailUser || selectedUserSummary).permissions.map((perm) => {
                            const permName = typeof perm === "string" ? perm : perm.name
                            const label = PERMISSION_LABEL_MAP[permName] || permName
                            return (
                              <span
                                key={permName}
                                className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-mono bg-bg-secondary text-brand-primary border border-border-color/60"
                                title={permName}
                              >
                                {label}
                              </span>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] leading-4 text-text-muted italic">
                          Áp dụng theo vai trò mặc định (không có quyền gán riêng).
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </aside>
            )}
          </div>
        </AdminResourceState>
      )}
    </div>
  )
}
