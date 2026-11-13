import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  KeyRound,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserRound,
  X,
} from "lucide-react"
import { AdminResourceState } from "../AdminResourceState.jsx"
import { AdminPageHeader } from "../AdminPageHeader.jsx"
import { AdminPagination } from "../AdminPagination.jsx"
import { useAdminData } from "../AdminDataContext.jsx"
import { useSCMS } from "../../../context/SCMSContext.jsx"
import { formatAdminDate } from "../adminDateUtils.js"
import {
  formatAdminNumber,
  getAdminPermissionLabel,
  getAdminRoleLabel,
  getAdminStatusLabel,
  getAdminText,
} from "../adminI18n.js"
import { getAdminUsers, getUserById } from "../../../api/adminApi.js"
import { UserStatusDialog, isValidUserId } from "../UserStatusDialog.jsx"
import { UserRoleDialog } from "../UserRoleDialog.jsx"
import { UserReissuePasswordDialog } from "../UserReissuePasswordDialog.jsx"
import { UserRowActions } from "../UserRowActions.jsx"
import { UserFormModal } from "../UserFormModal.jsx"

const PAGE_SIZE = 10
const VALID_STATUS_FILTERS = new Set(["all", "active", "inactive", "locked"])

const getLastWord = (fullName) => {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : ""
}

const compareVietnameseNames = (a, b, locale = "vi") => {
  const nameA = String(a?.fullName || "").trim()
  const nameB = String(b?.fullName || "").trim()
  const lastCmp = getLastWord(nameA).localeCompare(getLastWord(nameB), locale, {
    sensitivity: "base",
  })
  if (lastCmp !== 0) return lastCmp
  return nameA.localeCompare(nameB, locale, { sensitivity: "base" })
}

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
  const { currentUser, authUser, language } = useSCMS()
  const [searchParams, setSearchParams] = useSearchParams()

  // Nguồn ID: Trong chế độ API, currentUser.id lấy từ authUser.userId (qua buildCurrentUser).
  // Nếu currentUser.id chưa có (ví dụ môi trường mock/test auth), đối chiếu ID từ danh sách người dùng qua email đăng nhập.
  const matchedCurrentUser = useMemo(() => {
    if (!currentUser?.email || !Array.isArray(resources.users.data)) return null
    const emailLower = currentUser.email.trim().toLowerCase()
    return resources.users.data.find(
      (u) => u.email && u.email.trim().toLowerCase() === emailLower,
    )
  }, [currentUser?.email, resources.users.data])

  const rawCurrentId =
    currentUser?.id ?? matchedCurrentUser?.id ?? authUser?.userId ?? authUser?.id
  const isCurrentIdValid = isValidUserId(rawCurrentId)
  const currentUserId = isCurrentIdValid ? Number(rawCurrentId) : null

  const initialStatusParam = searchParams.get("status")
  const initialRoleParam = searchParams.get("role")

  const [query, setQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState(initialRoleParam || "all")
  const [statusFilter, setStatusFilter] = useState(
    VALID_STATUS_FILTERS.has(initialStatusParam) ? initialStatusParam : "all",
  )
  const [sortOrder, setSortOrder] = useState("name_asc")
  const [page, setPage] = useState(1)

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

  // Dialog targets cho các thao tác ghi
  const [statusTargetUser, setStatusTargetUser] = useState(null)
  const [roleTargetUser, setRoleTargetUser] = useState(null)
  const [reissueTargetUser, setReissueTargetUser] = useState(null)
  const [formTargetUser, setFormTargetUser] = useState(null)
  const [isUserFormOpen, setIsUserFormOpen] = useState(false)
  const [activeDialogTriggerRef, setActiveDialogTriggerRef] = useState(null)

  // Thông báo phản hồi thao tác
  const [actionAlert, setActionAlert] = useState(null)

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

  const syncSearchParams = useCallback(
    (nextRole, nextStatus) => {
      const next = new URLSearchParams(searchParams)
      if (nextRole && nextRole !== "all") {
        next.set("role", nextRole)
      } else {
        next.delete("role")
      }
      if (nextStatus && nextStatus !== "all") {
        next.set("status", nextStatus)
      } else {
        next.delete("status")
      }
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  // Lọc vai trò: gửi tham số role lên server qua getAdminUsers
  // Ghi chú: giá trị role khớp tên vai trò Backend
  // Sử dụng sequence id để chống race condition: chỉ phản hồi của yêu cầu cuối cùng được áp dụng
  const fetchUsersByRole = useCallback(async (newRole) => {
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
  }, [])

  const handleRoleFilterChange = async (newRole) => {
    setRoleFilter(newRole)
    setPage(1)
    syncSearchParams(newRole, statusFilter)
    await fetchUsersByRole(newRole)
  }

  const handleStatusFilterChange = (newStatus) => {
    setStatusFilter(newStatus)
    setPage(1)
    syncSearchParams(roleFilter, newStatus)
  }

  // Đồng bộ khi URL thay đổi từ bên ngoài (ví dụ bấm card Dashboard hoặc Back/Forward)
  useEffect(() => {
    const urlStatus = searchParams.get("status")
    const nextStatus = VALID_STATUS_FILTERS.has(urlStatus) ? urlStatus : "all"
    if (nextStatus !== statusFilter) {
      setStatusFilter(nextStatus)
      setPage(1)
    }

    const urlRole = searchParams.get("role") || "all"
    if (urlRole !== roleFilter) {
      setRoleFilter(urlRole)
      setPage(1)
      fetchUsersByRole(urlRole)
    }
  }, [searchParams, statusFilter, roleFilter, fetchUsersByRole])

  // Nếu trang mở sẵn với ?role=..., tải ngay danh sách lọc theo vai trò
  const initialRoleFetchedRef = useRef(false)
  useEffect(() => {
    if (initialRoleFetchedRef.current) return
    initialRoleFetchedRef.current = true
    if (initialRoleParam && initialRoleParam !== "all") {
      fetchUsersByRole(initialRoleParam)
    }
  }, [initialRoleParam, fetchUsersByRole])

  const roleOptions = useMemo(() => {
    const fromRoles = (resources.roles.data || []).map((role) => role.name)
    const fromUsers = (resources.users.data || [])
      .map((user) => user.roleName)
      .filter(Boolean)
    return [...new Set([...fromRoles, ...fromUsers])].sort()
  }, [resources.roles.data, resources.users.data])

  // Số lượng quản trị viên Active hiện tại trong hệ thống
  const activeAdminCount = useMemo(() => {
    return (resources.users.data || []).filter(
      (u) =>
        String(u.roleName || "").toLowerCase() === "admin" &&
        String(u.status || "").toLowerCase() === "active",
    ).length
  }, [resources.users.data])

  const handleStatusSuccess = (res, newStatus) => {
    const updatedStatus = newStatus.toLowerCase()
    const targetName = statusTargetUser?.fullName || statusTargetUser?.email || ""
    setActionAlert({
      type: "success",
      message: getAdminText(language, "users.alertStatusUpdated", {
        name: targetName,
        status: getAdminStatusLabel(updatedStatus, language),
      }),
    })
    retry("users")
    retry("auditLogs")
    if (selectedUserSummary && selectedUserSummary.id === statusTargetUser?.id) {
      setSelectedUserSummary((prev) => (prev ? { ...prev, status: updatedStatus } : null))
      setDetailUser((prev) => (prev ? { ...prev, status: updatedStatus } : null))
    }
  }

  const handleRoleSuccess = (res, targetRole) => {
    const targetName = roleTargetUser?.fullName || roleTargetUser?.email || ""
    setActionAlert({
      type: "success",
      message: getAdminText(language, "users.alertRoleUpdated", {
        name: targetName,
        role: getAdminRoleLabel(targetRole.name, language),
      }),
    })
    retry("users")
    retry("roles")
    retry("auditLogs")
    if (selectedUserSummary && selectedUserSummary.id === roleTargetUser?.id) {
      setSelectedUserSummary((prev) =>
        prev
          ? {
              ...prev,
              roleId: targetRole.id,
              roleName: targetRole.name,
            }
          : null,
      )
      setDetailUser((prev) =>
        prev
          ? {
              ...prev,
              roleId: targetRole.id,
              roleName: targetRole.name,
            }
          : null,
      )
    }
  }

  const handleReissueSuccess = (res) => {
    retry("auditLogs")
    const targetName = reissueTargetUser?.fullName || reissueTargetUser?.email || ""
    if (res?.emailSent === false) {
      setActionAlert({
        type: "warning",
        message:
          res.warning ||
          getAdminText(language, "users.alertReissueFailed", { name: targetName }),
      })
    } else {
      setActionAlert({
        type: "success",
        message: getAdminText(language, "users.alertReissueSuccess", {
          name: targetName,
          email: reissueTargetUser?.email || "",
        }),
      })
    }
  }

  const handleUserFormSuccess = (result, isEdit) => {
    retry("users")
    retry("auditLogs")
    const name = result.fullName || result.email
    if (isEdit) {
      setActionAlert({
        type: "success",
        message: getAdminText(language, "users.alertUpdated", { name }),
      })
      if (selectedUserSummary && selectedUserSummary.id === result.id) {
        setSelectedUserSummary(result)
        setDetailUser(result)
      }
    } else {
      if (result.emailSent === false) {
        setActionAlert({
          type: "warning",
          message:
            result.warning ||
            getAdminText(language, "users.alertReissueFailed", { name }),
        })
      } else {
        setActionAlert({
          type: "success",
          message: getAdminText(language, "users.alertCreated", { name }),
        })
      }
    }
  }

  // Danh sách cơ sở: từ serverUsers nếu đã lọc vai trò qua server, hoặc từ resources.users.data
  const baseUsers = serverUsers !== null ? serverUsers : (resources.users.data || [])

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const filtered = baseUsers.filter((user) => {
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

    const sortLocale = language === "en" ? "en" : "vi"
    const sorted = [...filtered]
    if (sortOrder === "name_asc") {
      sorted.sort((a, b) => compareVietnameseNames(a, b, sortLocale))
    } else if (sortOrder === "name_desc") {
      sorted.sort((a, b) => compareVietnameseNames(b, a, sortLocale))
    } else if (sortOrder === "newest") {
      sorted.sort((a, b) => {
        const tA = a?.createdAt ? new Date(a.createdAt).getTime() : 0
        const tB = b?.createdAt ? new Date(b.createdAt).getTime() : 0
        return tB - tA
      })
    }
    return sorted
  }, [baseUsers, language, query, statusFilter, sortOrder])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginatedUsers = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filteredUsers.slice(start, start + PAGE_SIZE)
  }, [filteredUsers, safePage])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const handleToggleNameSort = () => {
    setSortOrder((prev) => (prev === "name_asc" ? "name_desc" : "name_asc"))
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        eyebrow={getAdminText(language, "users.eyebrow")}
        title={getAdminText(language, "users.title")}
        actions={
          <button
            type="button"
            onClick={(e) => {
              setActiveDialogTriggerRef({ current: e.currentTarget })
              setFormTargetUser(null)
              setIsUserFormOpen(true)
            }}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded px-4 py-2 text-xs font-semibold bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>{getAdminText(language, "users.add")}</span>
          </button>
        }
      />

      {!isCurrentIdValid && (
        <div
          role="alert"
          className="p-3.5 rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger flex items-center gap-2 text-xs"
        >
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{getAdminText(language, "users.invalidSession")}</span>
        </div>
      )}

      {actionAlert && (
        <div
          role="alert"
          className={`p-3.5 rounded-lg border flex items-center justify-between gap-3 text-sm animate-in fade-in ${
            actionAlert.type === "success"
              ? "border-status-success-border bg-status-success-bg text-status-success"
              : actionAlert.type === "warning"
                ? "border-status-warning-border bg-status-warning-bg text-status-warning"
                : "border-status-danger-border bg-status-danger-bg text-status-danger"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionAlert.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
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

      {/* Loading khi lọc vai trò */}
      {roleLoading ? (
        <div className="space-y-3 py-4" aria-label={getAdminText(language, "users.loadingByRole")} aria-busy="true">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-10 rounded bg-bg-secondary animate-pulse" />
          ))}
        </div>
      ) : (
        <AdminResourceState
          resource={resources.users}
          onRetry={() => retry("users")}
          emptyTitle={getAdminText(language, "users.emptyTitle")}
        >
          {roleError && (
            <div
              role="alert"
              className="mb-3 p-3 rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger flex items-center justify-between gap-3 text-sm"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{roleError}</span>
              </div>
              <button
                type="button"
                onClick={() => handleRoleFilterChange(roleFilter)}
                className="inline-flex min-h-[44px] items-center gap-1.5 px-3 py-1.5 rounded font-medium border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {getAdminText(language, "common.retry")}
              </button>
            </div>
          )}

          <div
            className={`grid gap-4 ${
              selectedUserSummary ? "xl:grid-cols-[minmax(0,1fr)_360px]" : ""
            }`}
          >
            <div className="w-full rounded-lg border border-border-color bg-bg-card overflow-hidden">
              {/* Toolbar 1 hàng */}
              <div className="p-3 border-b border-border-color flex flex-col lg:flex-row lg:items-center gap-2.5 text-text-primary">
                <label className="relative flex-1 min-w-0">
                  <span className="sr-only">{getAdminText(language, "users.searchLabel")}</span>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setPage(1)
                    }}
                    placeholder={getAdminText(language, "users.searchPlaceholder")}
                    className="min-h-[44px] w-full rounded border border-border-strong bg-bg-card pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
                  />
                </label>
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                  <label className="flex-1 sm:flex-none sm:w-44">
                    <span className="sr-only">{getAdminText(language, "users.filterRoleLabel")}</span>
                    <select
                      value={roleFilter}
                      onChange={(event) => handleRoleFilterChange(event.target.value)}
                      disabled={roleLoading}
                      className="min-h-[44px] w-full rounded border border-border-strong bg-bg-card px-2.5 text-sm text-text-primary focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted cursor-pointer"
                    >
                      <option value="all">{getAdminText(language, "users.allRoles")}</option>
                      {roleOptions.map((role) => {
                        const label = getAdminRoleLabel(role, language)
                        return (
                          <option key={role} value={role}>
                            {label !== role ? `${label} (${role})` : role}
                          </option>
                        )
                      })}
                    </select>
                  </label>
                  <label className="flex-1 sm:flex-none sm:w-40">
                    <span className="sr-only">{getAdminText(language, "users.filterStatusLabel")}</span>
                    <select
                      value={statusFilter}
                      onChange={(event) => handleStatusFilterChange(event.target.value)}
                      className="min-h-[44px] w-full rounded border border-border-strong bg-bg-card px-2.5 text-sm text-text-primary focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted cursor-pointer"
                    >
                      <option value="all">{getAdminText(language, "users.allStatuses")}</option>
                      <option value="active">{getAdminStatusLabel("active", language)}</option>
                      <option value="inactive">{getAdminStatusLabel("inactive", language)}</option>
                      <option value="locked">{getAdminStatusLabel("locked", language)}</option>
                    </select>
                  </label>
                  <label className="flex-1 sm:flex-none sm:w-40">
                    <span className="sr-only">{getAdminText(language, "users.sortLabel")}</span>
                    <select
                      value={sortOrder}
                      onChange={(event) => {
                        setSortOrder(event.target.value)
                        setPage(1)
                      }}
                      className="min-h-[44px] w-full rounded border border-border-strong bg-bg-card px-2.5 text-sm text-text-primary focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/20 cursor-pointer"
                    >
                      <option value="name_asc">{getAdminText(language, "users.sortNameAsc")}</option>
                      <option value="name_desc">{getAdminText(language, "users.sortNameDesc")}</option>
                      <option value="newest">{getAdminText(language, "users.sortNewest")}</option>
                    </select>
                  </label>
                  <span className="text-xs font-medium text-text-secondary tabular-nums whitespace-nowrap px-1">
                    {getAdminText(language, "users.resultsCount", {
                      count: formatAdminNumber(filteredUsers.length, language),
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (roleFilter !== "all") {
                        fetchUsersByRole(roleFilter)
                      } else {
                        retry("users")
                      }
                    }}
                    aria-label={getAdminText(language, "users.reloadList")}
                    title={getAdminText(language, "users.reloadList")}
                    className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded border border-border-color bg-bg-card text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-bg-secondary text-xs font-semibold text-text-secondary border-b border-border-color">
                    <tr>
                      <th
                        className="px-3.5 py-2.5 text-left align-middle whitespace-nowrap"
                        aria-sort={
                          sortOrder === "name_asc"
                            ? "ascending"
                            : sortOrder === "name_desc"
                              ? "descending"
                              : "none"
                        }
                      >
                        <button
                          type="button"
                          onClick={handleToggleNameSort}
                          className="inline-flex items-center gap-1 font-semibold text-text-secondary hover:text-text-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded"
                        >
                          <span>{getAdminText(language, "users.colName")}</span>
                          {sortOrder === "name_asc" ? (
                            <ArrowUp className="w-3.5 h-3.5 text-brand-primary" />
                          ) : sortOrder === "name_desc" ? (
                            <ArrowDown className="w-3.5 h-3.5 text-brand-primary" />
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-text-muted" />
                          )}
                        </button>
                      </th>
                      <th className="px-3.5 py-2.5 text-left align-middle whitespace-nowrap">{getAdminText(language, "users.colEmail")}</th>
                      <th className="px-3.5 py-2.5 text-left align-middle whitespace-nowrap">{getAdminText(language, "users.colRole")}</th>
                      <th className="px-3.5 py-2.5 text-left align-middle whitespace-nowrap">{getAdminText(language, "users.colStatus")}</th>
                      <th className="px-3.5 py-2.5 text-left align-middle whitespace-nowrap">{getAdminText(language, "users.colCreatedAt")}</th>
                      <th className="px-3.5 py-2.5 text-right align-middle whitespace-nowrap">{getAdminText(language, "users.colActions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-color">
                    {paginatedUsers.map((user) => (
                      <tr
                        key={user.id ?? user.email}
                        className="h-11 transition-colors hover:bg-bg-secondary/70"
                      >
                        <td className="px-3.5 py-0 align-middle text-sm text-text-primary whitespace-nowrap max-w-[200px] truncate">
                          <span className="font-semibold text-text-primary">
                            {user.fullName || getAdminText(language, "users.noName")}
                          </span>
                        </td>
                        <td className="px-3.5 py-0 align-middle text-sm text-text-secondary whitespace-nowrap max-w-[220px] truncate">
                          {user.email || "—"}
                        </td>
                        <td className="px-3.5 py-0 align-middle text-sm text-text-primary whitespace-nowrap">
                          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-status-info-bg text-status-info ring-1 ring-inset ring-status-info-border">
                            {getAdminRoleLabel(user.roleName, language) || `Role #${user.roleId ?? "?"}`}
                          </span>
                        </td>
                        <td className="px-3.5 py-0 align-middle text-sm text-text-primary whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              user.status === "active"
                                ? "bg-status-success-bg text-status-success ring-1 ring-inset ring-status-success-border"
                                : user.status === "locked"
                                  ? "bg-status-danger-bg text-status-danger ring-1 ring-inset ring-status-danger-border"
                                  : "bg-bg-secondary text-text-secondary ring-1 ring-inset ring-border-color"
                            }`}
                          >
                            {getAdminStatusLabel(user.status, language)}
                          </span>
                        </td>
                        <td className="px-3.5 py-0 align-middle text-sm text-text-secondary tabular-nums font-mono whitespace-nowrap">
                          {formatAdminDate(user.createdAt, undefined, undefined, language)}
                        </td>
                        <td className="px-3.5 py-0 align-middle text-sm text-text-primary text-right whitespace-nowrap">
                          <UserRowActions
                            user={user}
                            isCurrentIdValid={isCurrentIdValid}
                            onViewDetails={(event) => handleSelectUser(user, event)}
                            onEditUser={(btnRef) => {
                              setActiveDialogTriggerRef(btnRef)
                              setFormTargetUser(user)
                              setIsUserFormOpen(true)
                            }}
                            onChangeStatus={(btnRef) => {
                              setActiveDialogTriggerRef(btnRef)
                              setStatusTargetUser(user)
                            }}
                            onChangeRole={(btnRef) => {
                              setActiveDialogTriggerRef(btnRef)
                              setRoleTargetUser(user)
                            }}
                            onReissuePassword={(btnRef) => {
                              setActiveDialogTriggerRef(btnRef)
                              setReissueTargetUser(user)
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <p className="p-8 text-center text-sm leading-5 text-text-secondary">
                    {getAdminText(language, "users.noMatches")}
                  </p>
                )}
              </div>

              {filteredUsers.length > 0 && (
                <div className="px-3.5 pb-3">
                  <AdminPagination
                    page={safePage}
                    totalPages={totalPages}
                    totalItems={filteredUsers.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </div>

            {/* Panel chi tiết người dùng gọi getUserById */}
            {selectedUserSummary && (
              <aside
                ref={asideRef}
                className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary h-fit scroll-mt-20 shadow-xs"
                aria-label={getAdminText(language, "users.detailTitle")}
              >
                <div className="flex items-start justify-between gap-3 border-b border-border-color pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded bg-bg-secondary text-brand-primary flex items-center justify-center shrink-0">
                      <UserRound className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm leading-5 font-semibold text-text-primary">
                        {(detailUser || selectedUserSummary).fullName || getAdminText(language, "users.noName")}
                      </h3>
                      <p className="text-xs leading-4 text-text-secondary font-mono">
                        ID #{(detailUser || selectedUserSummary).id ?? "N/A"} · {(detailUser || selectedUserSummary).code || getAdminText(language, "common.notSet")}
                      </p>
                    </div>
                  </div>
                  <button
                    ref={closeBtnRef}
                    type="button"
                    onClick={handleCloseDetails}
                    className="w-11 h-11 inline-flex items-center justify-center rounded text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer shrink-0"
                    aria-label={getAdminText(language, "users.detailClose")}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {detailLoading ? (
                  <div className="py-6 space-y-3" aria-label={getAdminText(language, "users.detailLoading")} aria-busy="true">
                    <div className="h-4 bg-bg-secondary rounded animate-pulse w-3/4" />
                    <div className="h-4 bg-bg-secondary rounded animate-pulse w-1/2" />
                    <div className="h-4 bg-bg-secondary rounded animate-pulse w-5/6" />
                    <p className="text-xs text-text-muted text-center pt-2">
                      {getAdminText(language, "users.detailLoading")}
                    </p>
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
                      {getAdminText(language, "common.retry")}
                    </button>
                  </div>
                ) : (
                  <div className="mt-3.5 space-y-4">
                    <dl className="space-y-2.5 text-xs leading-4 font-normal text-text-primary">
                      {[
                        [getAdminText(language, "users.detailRoleCode"), (detailUser || selectedUserSummary).code || getAdminText(language, "common.notSet")],
                        [getAdminText(language, "users.colName"), (detailUser || selectedUserSummary).fullName || getAdminText(language, "common.notSet")],
                        [getAdminText(language, "users.colEmail"), (detailUser || selectedUserSummary).email || getAdminText(language, "common.notSet")],
                        [getAdminText(language, "users.detailPhone"), (detailUser || selectedUserSummary).phone || getAdminText(language, "common.notSet")],
                        [
                          getAdminText(language, "users.colRole"),
                          getAdminRoleLabel((detailUser || selectedUserSummary).roleName, language) ||
                            `Role #${(detailUser || selectedUserSummary).roleId ?? "?"}`,
                        ],
                        [
                          getAdminText(language, "users.colStatus"),
                          getAdminStatusLabel((detailUser || selectedUserSummary).status, language),
                        ],
                        [getAdminText(language, "users.detailAddress"), (detailUser || selectedUserSummary).address || getAdminText(language, "common.notSet")],
                        [getAdminText(language, "users.detailDob"), formatAdminDate((detailUser || selectedUserSummary).dateOfBirth, undefined, undefined, language)],
                        [getAdminText(language, "users.detailCreatedAt"), formatAdminDate((detailUser || selectedUserSummary).createdAt, undefined, undefined, language)],
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
                        <span>{getAdminText(language, "users.detailRolesSection")}</span>
                      </div>
                      {(detailUser || selectedUserSummary).permissions &&
                      (detailUser || selectedUserSummary).permissions.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {(detailUser || selectedUserSummary).permissions.map((perm) => {
                            const permName = typeof perm === "string" ? perm : perm.name
                            const label = getAdminPermissionLabel(permName, language)
                            return (
                              <span
                                key={permName}
                                className="inline-flex items-center rounded px-2 py-0.5 text-xs font-mono bg-bg-secondary text-brand-primary border border-border-color/60"
                                title={permName}
                              >
                                {label}
                              </span>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-xs leading-4 text-text-muted italic">
                          {getAdminText(language, "users.detailNoPerms")}
                        </p>
                      )}
                    </div>

                    {/* Thao tác quản trị tài khoản trên panel chi tiết */}
                    <div className="pt-3 border-t border-border-color/60 space-y-2.5">
                      <p className="text-xs font-semibold text-text-secondary">
                        {getAdminText(language, "users.colActions")}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            setActiveDialogTriggerRef({ current: e.currentTarget })
                            setFormTargetUser(detailUser || selectedUserSummary)
                            setIsUserFormOpen(true)
                          }}
                          className="inline-flex min-h-11 items-center justify-center gap-1.5 px-2.5 py-2 rounded text-xs font-semibold border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                        >
                          <PenLine className="w-4 h-4 text-brand-primary" />
                          <span>{getAdminText(language, "users.detailEdit")}</span>
                        </button>
                        <button
                          type="button"
                          disabled={!isCurrentIdValid}
                          title={
                            !isCurrentIdValid
                              ? getAdminText(language, "users.invalidSession")
                              : undefined
                          }
                          onClick={(e) => {
                            if (!isCurrentIdValid) return
                            setActiveDialogTriggerRef({ current: e.currentTarget })
                            setStatusTargetUser(detailUser || selectedUserSummary)
                          }}
                          className="inline-flex min-h-11 items-center justify-center gap-1.5 px-2.5 py-2 rounded text-xs font-semibold border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <UserCheck className="w-4 h-4 text-brand-primary" />
                          <span>{getAdminText(language, "users.detailChangeStatus")}</span>
                        </button>
                        <button
                          type="button"
                          disabled={!isCurrentIdValid}
                          title={
                            !isCurrentIdValid
                              ? getAdminText(language, "users.invalidSession")
                              : undefined
                          }
                          onClick={(e) => {
                            if (!isCurrentIdValid) return
                            setActiveDialogTriggerRef({ current: e.currentTarget })
                            setRoleTargetUser(detailUser || selectedUserSummary)
                          }}
                          className="inline-flex min-h-11 items-center justify-center gap-1.5 px-2.5 py-2 rounded text-xs font-semibold border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ShieldCheck className="w-4 h-4 text-brand-primary" />
                          <span>{getAdminText(language, "users.detailChangeRole")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            setActiveDialogTriggerRef({ current: e.currentTarget })
                            setReissueTargetUser(detailUser || selectedUserSummary)
                          }}
                          className="inline-flex min-h-11 items-center justify-center gap-1.5 px-2.5 py-2 rounded text-xs font-semibold border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                        >
                          <KeyRound className="w-4 h-4 text-status-warning" />
                          <span>{language === "en" ? "Reset PWD" : "Cấp MK"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </aside>
            )}
          </div>
        </AdminResourceState>
      )}

      {/* Các Dialog thao tác ghi */}
      <UserStatusDialog
        isOpen={!!statusTargetUser}
        onClose={() => setStatusTargetUser(null)}
        user={statusTargetUser}
        currentUserId={currentUserId}
        activeAdminCount={activeAdminCount}
        onSuccess={handleStatusSuccess}
        triggerRef={activeDialogTriggerRef}
      />

      <UserRoleDialog
        isOpen={!!roleTargetUser}
        onClose={() => setRoleTargetUser(null)}
        user={roleTargetUser}
        roles={resources.roles.data || []}
        currentUserId={currentUserId}
        activeAdminCount={activeAdminCount}
        onSuccess={handleRoleSuccess}
        triggerRef={activeDialogTriggerRef}
      />

      <UserReissuePasswordDialog
        isOpen={!!reissueTargetUser}
        onClose={() => setReissueTargetUser(null)}
        user={reissueTargetUser}
        onSuccess={handleReissueSuccess}
        triggerRef={activeDialogTriggerRef}
      />

      <UserFormModal
        isOpen={isUserFormOpen}
        onClose={() => {
          setIsUserFormOpen(false)
          setFormTargetUser(null)
        }}
        initialUser={formTargetUser}
        roles={resources.roles.data || []}
        onSuccess={handleUserFormSuccess}
        triggerRef={activeDialogTriggerRef}
      />
    </div>
  )
}
