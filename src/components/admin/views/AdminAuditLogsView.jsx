import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  User,
} from "lucide-react"
import { useAdminData } from "../AdminDataContext.jsx"
import { useSCMS } from "../../../context/SCMSContext.jsx"
import { formatAdminDate, formatAdminDateTime } from "../adminDateUtils.js"
import { formatAuditTarget } from "../adminAuditFormat.js"
import { getAdminAuditActionLabel, getAdminText } from "../adminI18n.js"
import { getAdminAuditLogs } from "../../../api/adminApi.js"

// Ghi chú: Quy ước page tính từ 0 hay 1 là CHƯA XÁC NHẬN với Backend.
// Đặt hằng số AUDIT_PAGE_BASE = 0 ở đây để dễ dàng thay đổi khi Backend chốt hợp đồng.
export const AUDIT_PAGE_BASE = 0
export const AUDIT_PAGE_SIZE = 20

// Bảng ánh xạ nhãn tiếng Việt cho mã hành động
export const AUDIT_ACTION_MAP = {
  LOGIN: "Đăng nhập",
  LOGIN_GOOGLE: "Đăng nhập qua Google",
  REGISTER_MEMBER_GOOGLE: "Đăng ký hội viên qua Google",
  REGISTER_MEMBER_PENDING: "Đăng ký hội viên",
  VERIFY_MEMBER_REGISTRATION: "Xác minh đăng ký hội viên",
  CREATE_USER: "Tạo tài khoản người dùng",
  CHANGE_USER_ROLE: "Đổi vai trò người dùng",
  REISSUE_TEMPORARY_PASSWORD: "Cấp lại mật khẩu tạm",
  UPDATE_STAFF: "Cập nhật nhân viên",
  CHANGE_USER_STATUS: "Đổi trạng thái tài khoản",
  UPDATE_ROLE_PERMISSIONS: "Cập nhật quyền vai trò",
  CREATE_INVOICE: "Tạo hóa đơn",
  COLLECT_PAYMENT: "Thu tiền thanh toán",
  ENROLL_CLASS: "Ghi danh lớp học",
  ATTENDANCE_CORRECTION: "Điều chỉnh điểm danh",
}

const KNOWN_ACTIONS = [
  "LOGIN",
  "LOGIN_GOOGLE",
  "REGISTER_MEMBER_GOOGLE",
  "REGISTER_MEMBER_PENDING",
  "VERIFY_MEMBER_REGISTRATION",
  "CREATE_USER",
  "CHANGE_USER_ROLE",
  "REISSUE_TEMPORARY_PASSWORD",
  "UPDATE_STAFF",
  "CHANGE_USER_STATUS",
  "UPDATE_ROLE_PERMISSIONS",
  "CREATE_INVOICE",
  "COLLECT_PAYMENT",
  "ENROLL_CLASS",
  "ATTENDANCE_CORRECTION",
]

const getTodayVnDate = () => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date())
  } catch {
    return ""
  }
}

export function AdminAuditLogsView() {
  const { resources, retry } = useAdminData()
  const { language } = useSCMS()
  const isEn = language === "en"
  const [searchParams, setSearchParams] = useSearchParams()

  const initialRangeToday = searchParams.get("range") === "today" ? getTodayVnDate() : ""

  // Bộ lọc gửi lên server
  const [selectedAction, setSelectedAction] = useState(searchParams.get("action") || "")
  const [startDate, setStartDate] = useState(
    searchParams.get("startDate") || initialRangeToday || "",
  )
  const [endDate, setEndDate] = useState(
    searchParams.get("endDate") || initialRangeToday || "",
  )
  const [selectedActorId, setSelectedActorId] = useState(searchParams.get("actorId") || "")

  // Phân trang
  const [page, setPage] = useState(1) // UI page bắt đầu từ 1
  const [serverLogs, setServerLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isForbidden, setIsForbidden] = useState(false)

  // Ô tìm kiếm chữ client trên trang hiện tại
  const [query, setQuery] = useState("")

  // Đồng bộ bộ lọc khi URL query (?startDate=&endDate=&action=&actorId=) thay đổi từ bên ngoài
  useEffect(() => {
    const rangeToday = searchParams.get("range") === "today" ? getTodayVnDate() : ""
    const nextAction = searchParams.get("action") || ""
    const nextStart = searchParams.get("startDate") || rangeToday || ""
    const nextEnd = searchParams.get("endDate") || rangeToday || ""
    const nextActor = searchParams.get("actorId") || ""
    setSelectedAction(nextAction)
    setStartDate(nextStart)
    setEndDate(nextEnd)
    setSelectedActorId(nextActor)
    setPage(1)
  }, [searchParams])

  // Ánh xạ userId -> fullName từ AdminDataContext
  const userMap = useMemo(() => {
    const map = new Map()
    for (const u of resources.users.data || []) {
      if (u.id !== null && u.id !== undefined && u.fullName) {
        map.set(Number(u.id), u.fullName)
      }
    }
    return map
  }, [resources.users.data])

  const roleMap = useMemo(() => {
    const map = new Map()
    for (const r of resources.roles.data || []) {
      if (r.id !== null && r.id !== undefined) {
        map.set(Number(r.id), r)
      }
    }
    return map
  }, [resources.roles.data])

  // Lấy tên người dùng theo id; không tra được thì hiển thị Hệ thống / System
  const getUserName = useCallback(
    (id, fallbackLabel) => {
      if (id === null || id === undefined || id === "") {
        return getAdminText(language, "common.system")
      }
      const numId = Number(id)
      if (userMap.has(numId)) {
        return userMap.get(numId)
      }
      if (fallbackLabel && !/^User #\d+$/i.test(fallbackLabel)) {
        return fallbackLabel
      }
      return getAdminText(language, "common.system")
    },
    [language, userMap],
  )

  // Hàm tải dữ liệu nhật ký với bộ lọc và phân trang từ server
  const fetchAuditLogs = useCallback(
    async (targetPage = page) => {
      setLoading(true)
      setError(null)
      setIsForbidden(false)

      const serverPage = targetPage - 1 + AUDIT_PAGE_BASE

      const params = {
        page: serverPage,
        size: AUDIT_PAGE_SIZE,
      }
      if (selectedAction) params.action = selectedAction
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      if (selectedActorId) params.actorId = selectedActorId

      try {
        const data = await getAdminAuditLogs(params)
        setServerLogs(data || [])
      } catch (err) {
        if (err?.status === 403 || err?.response?.status === 403) {
          setIsForbidden(true)
          setError(getAdminText(language, "audit.forbiddenMsg"))
        } else {
          setError(err?.message || getAdminText(language, "audit.loadErrorFallback"))
        }
      } finally {
        setLoading(false)
      }
    },
    [page, selectedAction, startDate, endDate, selectedActorId, language],
  )

  // Gọi API mỗi khi bộ lọc server hoặc trang thay đổi
  useEffect(() => {
    fetchAuditLogs(page)
  }, [fetchAuditLogs, page])

  const syncAuditParams = useCallback(
    (nextValues) => {
      const next = new URLSearchParams(searchParams)
      next.delete("range")
      const entries = {
        action: nextValues.action ?? selectedAction,
        startDate: nextValues.startDate ?? startDate,
        endDate: nextValues.endDate ?? endDate,
        actorId: nextValues.actorId ?? selectedActorId,
      }
      for (const [key, value] of Object.entries(entries)) {
        if (value) {
          next.set(key, value)
        } else {
          next.delete(key)
        }
      }
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams, selectedAction, startDate, endDate, selectedActorId],
  )

  // Khi thay đổi bộ lọc server, reset về trang 1
  const handleActionChange = (e) => {
    const val = e.target.value
    setSelectedAction(val)
    setPage(1)
    syncAuditParams({ action: val })
  }

  const handleStartDateChange = (e) => {
    const val = e.target.value
    setStartDate(val)
    setPage(1)
    syncAuditParams({ startDate: val })
  }

  const handleEndDateChange = (e) => {
    const val = e.target.value
    setEndDate(val)
    setPage(1)
    syncAuditParams({ endDate: val })
  }

  const handleActorChange = (e) => {
    const val = e.target.value
    setSelectedActorId(val)
    setPage(1)
    syncAuditParams({ actorId: val })
  }

  const handleResetFilters = () => {
    setSelectedAction("")
    setStartDate("")
    setEndDate("")
    setSelectedActorId("")
    setQuery("")
    setPage(1)
    syncAuditParams({ action: "", startDate: "", endDate: "", actorId: "" })
  }

  // Lọc client trên danh sách của trang đang xem
  const filteredLogs = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return serverLogs

    return serverLogs.filter((log) => {
      const actorName = getUserName(log.actorId, log.actorLabel).toLowerCase()
      const actionLabel = getAdminAuditActionLabel(log.action, language).toLowerCase()
      const actionRaw = String(log.action || "").toLowerCase()
      const targetStr = String(log.targetLabel || "").toLowerCase()
      const detailStr = String(log.detail || "").toLowerCase()

      return (
        actorName.includes(normalized) ||
        actionLabel.includes(normalized) ||
        actionRaw.includes(normalized) ||
        targetStr.includes(normalized) ||
        detailStr.includes(normalized)
      )
    })
  }, [serverLogs, query, getUserName, language])

  const dateRangeSummary = useMemo(() => {
    if (startDate && endDate) {
      return getAdminText(language, "audit.showingRange", {
        start: formatAdminDate(startDate, undefined, undefined, language),
        end: formatAdminDate(endDate, undefined, undefined, language),
      })
    }
    if (startDate) {
      return getAdminText(language, "audit.showingFrom", {
        start: formatAdminDate(startDate, undefined, undefined, language),
      })
    }
    if (endDate) {
      return getAdminText(language, "audit.showingUntil", {
        end: formatAdminDate(endDate, undefined, undefined, language),
      })
    }
    return getAdminText(language, "audit.showingAllTime")
  }, [startDate, endDate, language])

  // "Trang sau" chỉ bật khi số bản ghi trả về bằng AUDIT_PAGE_SIZE (20)
  const canGoNext = serverLogs.length === AUDIT_PAGE_SIZE
  const canGoPrev = page > 1

  return (
    <div className="space-y-4 w-full min-w-0 max-w-full">
      <div>
        <h2 className="text-xl leading-7 font-semibold text-text-primary">
          {getAdminText(language, "audit.title")}
        </h2>
        <p className="mt-1 text-sm leading-5 text-text-secondary">
          {getAdminText(language, "audit.subtitle")}
        </p>
      </div>

      {/* Bộ lọc phía server */}
      <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-3">
        <div className="flex items-center justify-between border-b border-border-color/60 pb-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-brand-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              {isEn ? "Server Filters" : "Bộ lọc nâng cao (Server)"}
            </span>
          </div>
          {(selectedAction || startDate || endDate || selectedActorId) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex min-h-11 items-center px-2 text-xs font-semibold text-brand-primary hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded"
            >
              {getAdminText(language, "audit.clearFilters")}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Lọc hành động */}
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-text-secondary">
              {getAdminText(language, "audit.colAction")}
            </span>
            <select
              value={selectedAction}
              onChange={handleActionChange}
              className="min-h-11 w-full rounded border border-border-strong bg-bg-card px-2.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
            >
              <option value="">{getAdminText(language, "audit.allActions")}</option>
              {KNOWN_ACTIONS.map((actionCode) => (
                <option key={actionCode} value={actionCode}>
                  {getAdminAuditActionLabel(actionCode, language)}
                </option>
              ))}
            </select>
          </label>

          {/* Lọc người thao tác (Actor) */}
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-text-secondary">
              {getAdminText(language, "audit.colActor")}
            </span>
            <select
              value={selectedActorId}
              onChange={handleActorChange}
              className="min-h-11 w-full rounded border border-border-strong bg-bg-card px-2.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary cursor-pointer"
            >
              <option value="">{getAdminText(language, "audit.allActors")}</option>
              {(resources.users.data || [])
                .filter((u) => Boolean(u.fullName))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName}
                  </option>
                ))}
            </select>
          </label>

          {/* Từ ngày */}
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-text-secondary">
              {getAdminText(language, "audit.startDate")}
            </span>
            <input
              type="date"
              value={startDate}
              onChange={handleStartDateChange}
              className="min-h-11 w-full rounded border border-border-strong bg-bg-card px-2.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary focus-within:ring-2 focus-within:ring-brand-primary cursor-pointer"
            />
          </label>

          {/* Đến ngày */}
          <label className="space-y-1 block">
            <span className="text-xs font-medium text-text-secondary">
              {getAdminText(language, "audit.endDate")}
            </span>
            <input
              type="date"
              value={endDate}
              onChange={handleEndDateChange}
              className="min-h-11 w-full rounded border border-border-strong bg-bg-card px-2.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary focus-within:ring-2 focus-within:ring-brand-primary cursor-pointer"
            />
          </label>
        </div>

        {/* Ô tìm kiếm chữ FE trên trang hiện tại */}
        <div className="pt-2 border-t border-border-color/40">
          <label className="relative block">
            <span className="sr-only">{getAdminText(language, "audit.searchLabel")}</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={getAdminText(language, "audit.searchPlaceholder")}
              className="min-h-11 w-full rounded border border-border-strong bg-bg-card pl-9 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary focus-visible:ring-2 focus-visible:ring-brand-primary"
            />
          </label>
        </div>

        {/* Dòng trạng thái khoảng ngày đang xem phía trên bảng */}
        <div className="flex items-center gap-2 pt-1 text-xs font-medium text-text-secondary" data-testid="audit-date-range-summary">
          <Calendar className="w-3.5 h-3.5 text-text-muted shrink-0" aria-hidden="true" />
          <span>{dateRangeSummary}</span>
        </div>
      </div>

      {/* Trạng thái lỗi 403 Forbidden */}
      {isForbidden ? (
        <div
          role="alert"
          className="min-h-36 flex flex-col items-center justify-center text-center px-5 py-7 bg-status-danger-bg border border-status-danger-border rounded-lg"
        >
          <ShieldAlert className="w-8 h-8 text-status-danger" />
          <p className="mt-3 text-sm leading-5 font-bold text-status-danger">
            {getAdminText(language, "audit.forbiddenTitle")}
          </p>
          <p className="mt-1 max-w-lg text-xs leading-4 text-status-danger">
            {getAdminText(language, "audit.forbiddenMsg")}
          </p>
        </div>
      ) : error ? (
        /* Trạng thái lỗi chung kèm nút Thử lại */
        <div
          role="alert"
          className="min-h-36 flex flex-col items-center justify-center text-center px-5 py-7 bg-status-danger-bg border border-status-danger-border rounded-lg"
        >
          <AlertTriangle className="w-8 h-8 text-status-danger" />
          <p className="mt-3 text-sm leading-5 font-semibold text-status-danger">
            {getAdminText(language, "audit.loadErrorTitle")}
          </p>
          <p className="mt-1 max-w-lg text-xs leading-4 text-status-danger">
            {error}
          </p>
          <button
            type="button"
            onClick={() => fetchAuditLogs(page)}
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 py-2 text-xs font-semibold border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {getAdminText(language, "common.retry")}
          </button>
        </div>
      ) : loading ? (
        /* Trạng thái loading skeleton */
        <div className="space-y-3 py-6" aria-label={getAdminText(language, "audit.loadingAria")} aria-busy="true">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="h-11 rounded bg-bg-secondary animate-pulse" />
          ))}
        </div>
      ) : (
        /* Bảng dữ liệu nhật ký */
        <div className="w-full overflow-x-auto rounded-lg border border-border-color bg-bg-card">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-bg-secondary text-xs font-semibold text-text-secondary">
              <tr>
                <th className="px-3.5 py-2.5 text-left align-middle w-44">{getAdminText(language, "audit.colTime")}</th>
                <th className="px-3.5 py-2.5 text-left align-middle w-48">{getAdminText(language, "audit.colActor")}</th>
                <th className="px-3.5 py-2.5 text-left align-middle w-56">{getAdminText(language, "audit.colAction")}</th>
                <th className="px-3.5 py-2.5 text-left align-middle w-48">{getAdminText(language, "audit.colTarget")}</th>
                <th className="px-3.5 py-2.5 text-left align-middle">{getAdminText(language, "audit.colDetail")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {filteredLogs.map((log) => {
                const actorName = getUserName(log.actorId, log.actorLabel)
                const actionLabel = getAdminAuditActionLabel(log.action, language)
                const targetDisplay = formatAuditTarget(log, {
                  userMap,
                  roleMap,
                  language,
                })

                return (
                  <tr
                    key={log.id ?? `${log.action}-${log.createdAt}`}
                    data-log-id={log.id}
                    className="transition-colors hover:bg-bg-secondary/70"
                  >
                    <td className="px-3.5 py-2.5 align-middle text-sm leading-5 text-text-secondary tabular-nums font-mono whitespace-nowrap">
                      {formatAdminDateTime(log.createdAt, undefined, undefined, language)}
                    </td>
                    <td className="px-3.5 py-2.5 align-middle text-sm leading-5 text-text-primary">
                      <p className="font-semibold text-text-primary">
                        {actorName}
                      </p>
                    </td>
                    <td className="px-3.5 py-2.5 align-middle text-xs">
                      <span className="inline-flex items-center px-2 py-0.5 rounded font-medium text-xs bg-bg-secondary text-brand-primary border border-border-color/60">
                        {actionLabel}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 align-middle text-sm leading-5 text-text-primary">
                      <span className="font-medium">{targetDisplay}</span>
                    </td>
                    <td className="px-3.5 py-2.5 align-middle text-sm leading-5 text-text-secondary max-w-xl">
                      {log.detail || (isEn ? "No additional details." : "Không có thông tin chi tiết.")}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filteredLogs.length === 0 && (
            <p className="p-8 text-center text-sm leading-5 text-text-secondary">
              {getAdminText(language, "audit.emptyPageTitle")}
            </p>
          )}

          {/* Phân trang server: kích thước 20, Trang sau chỉ bật khi trả về đúng 20 */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3.5 py-2.5 border-t border-border-color bg-bg-secondary/50">
            <span className="text-xs leading-4 text-text-secondary tabular-nums">
              {getAdminText(language, "audit.pageIndicator", {
                page,
                count: filteredLogs.length,
              })}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!canGoPrev}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex min-h-11 items-center justify-center rounded px-3.5 text-xs font-semibold border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                aria-label={getAdminText(language, "audit.prevPage")}
              >
                {getAdminText(language, "audit.prevPage")}
              </button>
              <span className="min-h-11 min-w-11 inline-flex items-center justify-center px-3 rounded bg-bg-card border border-border-color text-text-primary text-xs font-bold tabular-nums">
                {page}
              </span>
              <button
                type="button"
                disabled={!canGoNext}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex min-h-11 items-center justify-center rounded px-3.5 text-xs font-semibold border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                aria-label={getAdminText(language, "audit.nextPage")}
              >
                {getAdminText(language, "audit.nextPage")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
