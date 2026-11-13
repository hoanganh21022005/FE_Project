import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowRight,
  Lock,
  RefreshCw,
  ShieldCheck,
  UserX,
  Users,
} from "lucide-react"
import { getAdminAuditLogs } from "../../../api/adminApi.js"
import { getErrorMessage } from "../../../api/apiErrors.js"
import { useAdminData } from "../AdminDataContext.jsx"
import { AdminPageHeader } from "../AdminPageHeader.jsx"
import { formatAdminDateTime, parseToVietnamDate, VIETNAM_TIMEZONE } from "../adminDateUtils.js"

export const ACTION_LABELS = {
  LOGIN: "Đăng nhập",
  LOGIN_GOOGLE: "Đăng nhập qua Google",
  REGISTER_MEMBER_GOOGLE: "Đăng ký hội viên (Google)",
  REGISTER_MEMBER_PENDING: "Đăng ký hội viên (Chờ duyệt)",
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

export const ROLE_LABELS = {
  Admin: "Quản trị viên",
  ADMIN: "Quản trị viên",
  CenterManager: "Quản lý trung tâm",
  CENTER_MANAGER: "Quản lý trung tâm",
  Receptionist: "Lễ tân",
  RECEPTIONIST: "Lễ tân",
  Coach: "Huấn luyện viên",
  COACH: "Huấn luyện viên",
  Member: "Hội viên",
  MEMBER: "Hội viên",
}

const ROLE_CHART_COLORS = [
  "var(--brand-primary)",
  "var(--brand-dark)",
  "var(--brand-accent)",
  "var(--brand-sky-soft)",
  "var(--brand-purple)",
]

const AUDIT_7D_FETCH_SIZE = 500

function getVietnamDateKey(dateInput) {
  const parsed = parseToVietnamDate(dateInput)
  if (!parsed.valid || !parsed.date) return null
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed.date)
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return `${map.year}-${map.month}-${map.day}`
}

function buildLast7Days() {
  const days = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    const key = getVietnamDateKey(d)
    const label = new Intl.DateTimeFormat("vi-VN", {
      timeZone: VIETNAM_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
    }).format(d)
    days.push({
      key,
      label: i === 0 ? "Hôm nay" : label,
      shortLabel: label.slice(0, 2),
      isToday: i === 0,
      count: 0,
    })
  }
  return days
}

export function AdminDashboard() {
  const { resources, retry, retryAll, apiEnabled } = useAdminData()

  const usersList = useMemo(() => resources.users.data || [], [resources.users.data])
  const rolesList = useMemo(() => resources.roles.data || [], [resources.roles.data])
  const auditLogsList = useMemo(
    () => resources.auditLogs.data || [],
    [resources.auditLogs.data],
  )

  const [weeklyLogs, setWeeklyLogs] = useState([])
  const [weeklyLoading, setWeeklyLoading] = useState(false)
  const [weeklyError, setWeeklyError] = useState(null)

  const last7DaysTemplate = useMemo(() => buildLast7Days(), [])
  const startDate7d = last7DaysTemplate[0]?.key || ""
  const endDate7d = last7DaysTemplate[last7DaysTemplate.length - 1]?.key || ""

  const loadWeeklyLogs = useCallback(async () => {
    if (!apiEnabled) {
      setWeeklyLogs(auditLogsList)
      setWeeklyError(null)
      setWeeklyLoading(false)
      return
    }
    setWeeklyLoading(true)
    setWeeklyError(null)
    try {
      const data = await getAdminAuditLogs({
        startDate: startDate7d,
        endDate: endDate7d,
        page: 0,
        size: AUDIT_7D_FETCH_SIZE,
      })
      setWeeklyLogs(Array.isArray(data) ? data : [])
    } catch (err) {
      setWeeklyError(
        getErrorMessage(err, "Không thể tải dữ liệu biểu đồ nhật ký 7 ngày."),
      )
    } finally {
      setWeeklyLoading(false)
    }
  }, [apiEnabled, auditLogsList, endDate7d, startDate7d])

  useEffect(() => {
    loadWeeklyLogs()
  }, [loadWeeklyLogs])

  const handleRefreshAll = () => {
    retryAll()
    loadWeeklyLogs()
  }

  const userMap = useMemo(() => {
    const map = new Map()
    for (const u of usersList) {
      if (u.id !== null && u.id !== undefined) {
        map.set(Number(u.id), u)
      }
    }
    return map
  }, [usersList])

  const statusCounts = useMemo(() => {
    let active = 0
    let inactive = 0
    let locked = 0
    for (const u of usersList) {
      const st = String(u.status || "").toLowerCase()
      if (st === "active") active++
      else if (st === "locked") locked++
      else if (st === "inactive") inactive++
    }
    return { active, inactive, locked, total: usersList.length }
  }, [usersList])

  const roleSummaryText = useMemo(() => {
    if (rolesList.length === 0) return "Phân quyền hệ thống"
    return rolesList
      .map((r) => ROLE_LABELS[r.name] || r.name)
      .slice(0, 5)
      .join(", ")
  }, [rolesList])

  const weeklySeries = useMemo(() => {
    const buckets = last7DaysTemplate.map((d) => ({ ...d, count: 0 }))
    const indexByKey = new Map(buckets.map((b, idx) => [b.key, idx]))
    const sourceLogs = apiEnabled ? weeklyLogs : auditLogsList
    for (const log of sourceLogs) {
      const k = getVietnamDateKey(log.createdAt)
      if (k && indexByKey.has(k)) {
        buckets[indexByKey.get(k)].count++
      }
    }
    const maxCount = Math.max(1, ...buckets.map((b) => b.count))
    const totalCount = buckets.reduce((sum, b) => sum + b.count, 0)
    return { buckets, maxCount, totalCount, fetchedCount: sourceLogs.length }
  }, [apiEnabled, auditLogsList, last7DaysTemplate, weeklyLogs])

  const roleDistribution = useMemo(() => {
    const total = usersList.length
    if (total === 0) return []
    const counts = new Map()
    for (const u of usersList) {
      const roleKey = u.roleName || (u.roleId ? `Role #${u.roleId}` : "Khác")
      counts.set(roleKey, (counts.get(roleKey) || 0) + 1)
    }
    for (const r of rolesList) {
      if (!counts.has(r.name)) counts.set(r.name, 0)
    }
    const items = []
    let colorIdx = 0
    for (const [roleName, count] of counts.entries()) {
      const percent = total > 0 ? Math.round((count / total) * 100) : 0
      items.push({
        roleName,
        label: ROLE_LABELS[roleName] || roleName,
        count,
        percent,
        color: ROLE_CHART_COLORS[colorIdx % ROLE_CHART_COLORS.length],
      })
      colorIdx++
    }
    return items.sort((a, b) => b.count - a.count)
  }, [usersList, rolesList])

  const donutSegments = useMemo(() => {
    const circumference = 2 * Math.PI * 60 // ~377
    const total = usersList.length || 1
    let offset = 0
    return roleDistribution
      .filter((item) => item.count > 0)
      .map((item) => {
        const length = (item.count / total) * circumference
        const seg = {
          ...item,
          dashArray: `${length.toFixed(1)} ${circumference.toFixed(1)}`,
          dashOffset: (-offset).toFixed(1),
        }
        offset += length
        return seg
      })
  }, [roleDistribution, usersList.length])

  const recentActivities = useMemo(() => {
    return [...auditLogsList]
      .sort((a, b) => {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return tB - tA
      })
      .slice(0, 5)
  }, [auditLogsList])

  const usersLoading =
    resources.users.status === "loading" || resources.users.status === "idle"
  const rolesLoading =
    resources.roles.status === "loading" || resources.roles.status === "idle"
  const logsLoading =
    resources.auditLogs.status === "loading" ||
    resources.auditLogs.status === "idle"

  return (
    <div className="space-y-5 font-sans">
      <AdminPageHeader
        eyebrow="QUẢN TRỊ HỆ THỐNG"
        title="Toàn cảnh hệ thống"
        actions={
          <button
            type="button"
            onClick={handleRefreshAll}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border-color bg-bg-card px-4 text-sm font-semibold text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <RefreshCw className="w-4 h-4 text-text-secondary" />
            <span>Làm mới dữ liệu</span>
          </button>
        }
      />

      {resources.users.status === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-status-danger-border bg-status-danger-bg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <p className="text-sm text-status-danger font-medium">
            {resources.users.error || "Không thể tải dữ liệu người dùng."}
          </p>
          <button
            type="button"
            onClick={() => retry("users")}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-border-color bg-bg-card px-4 text-sm font-semibold text-text-primary hover:bg-bg-secondary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Thử lại</span>
          </button>
        </div>
      )}

      {/* Hàng 4 ô trên cùng: Việc cần chú ý (2 ô) | Tổng quan tài khoản (2 ô) */}
      <section aria-label="Tổng quan nhanh" className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] gap-4 items-stretch">
        <div className="space-y-3">
          <h2 className="text-base leading-6 font-semibold text-text-primary">
            Việc cần chú ý
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Link
              to="/admin/users?status=locked"
              aria-label={`${statusCounts.locked} tài khoản đang bị khóa. Mở Người dùng, lọc trạng thái Đã khóa`}
              className="min-h-[44px] flex flex-col justify-between gap-2.5 p-4 rounded-xl bg-status-danger-bg/60 border border-status-danger-border shadow-[inset_4px_0_0_var(--status-danger)] text-text-primary hover:bg-status-danger-bg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-lg bg-status-danger-bg text-status-danger flex items-center justify-center">
                  <Lock className="w-4 h-4" />
                </span>
                {usersLoading ? (
                  <span className="h-8 w-10 rounded bg-bg-secondary animate-pulse" />
                ) : (
                  <strong className="text-[28px] leading-8 font-bold text-status-danger tabular-nums">
                    {statusCounts.locked}
                  </strong>
                )}
              </div>
              <div>
                <p className="text-sm leading-5 font-semibold text-text-primary">
                  Tài khoản đang bị khóa
                </p>
                {statusCounts.locked === 0 ? (
                  <p className="mt-1 text-[13px] leading-[18px] text-text-secondary">
                    Không có
                  </p>
                ) : (
                  <p className="mt-1 inline-flex items-center gap-1 text-[13px] leading-[18px] font-semibold text-brand-primary">
                    <span>Xem và mở khóa</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </p>
                )}
              </div>
            </Link>

            <Link
              to="/admin/users?status=inactive"
              aria-label={`${statusCounts.inactive} tài khoản không hoạt động. Mở Người dùng, lọc trạng thái Không hoạt động`}
              className="min-h-[44px] flex flex-col justify-between gap-2.5 p-4 rounded-xl bg-bg-secondary/75 border border-border-color shadow-[inset_4px_0_0_var(--text-secondary)] text-text-primary hover:bg-bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-lg bg-bg-secondary text-text-secondary flex items-center justify-center border border-border-color">
                  <UserX className="w-4 h-4" />
                </span>
                {usersLoading ? (
                  <span className="h-8 w-10 rounded bg-bg-secondary animate-pulse" />
                ) : (
                  <strong className="text-[28px] leading-8 font-bold text-text-secondary tabular-nums">
                    {statusCounts.inactive}
                  </strong>
                )}
              </div>
              <div>
                <p className="text-sm leading-5 font-semibold text-text-primary">
                  Tài khoản không hoạt động
                </p>
                {statusCounts.inactive === 0 ? (
                  <p className="mt-1 text-[13px] leading-[18px] text-text-secondary">
                    Không có
                  </p>
                ) : (
                  <p className="mt-1 inline-flex items-center gap-1 text-[13px] leading-[18px] font-semibold text-brand-primary">
                    <span>Xem danh sách</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </p>
                )}
              </div>
            </Link>
          </div>
        </div>

        <div className="hidden lg:block bg-border-color" aria-hidden="true" />

        <div className="space-y-3">
          <h2 className="text-base leading-6 font-semibold text-text-primary">
            Tổng quan tài khoản
          </h2>
          <div className="grid grid-cols-2 gap-3.5">
            <div className="rounded-xl border border-border-color bg-bg-card p-4 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-lg bg-brand-blue-soft text-brand-primary flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </span>
                {usersLoading ? (
                  <span className="h-8 w-12 rounded bg-bg-secondary animate-pulse" />
                ) : (
                  <strong className="text-[28px] leading-8 font-bold text-text-primary tabular-nums">
                    {statusCounts.total}
                  </strong>
                )}
              </div>
              <div>
                <p className="text-sm leading-5 font-semibold text-text-primary">
                  Người dùng
                </p>
                <p className="mt-1 text-[13px] leading-[18px] text-text-secondary tabular-nums">
                  {statusCounts.active} đang hoạt động
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border-color bg-bg-card p-4 flex flex-col justify-between gap-2.5">
              <div className="flex items-center justify-between">
                <span className="w-8 h-8 rounded-lg bg-brand-blue-soft text-brand-primary flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                {rolesLoading ? (
                  <span className="h-8 w-10 rounded bg-bg-secondary animate-pulse" />
                ) : (
                  <strong className="text-[28px] leading-8 font-bold text-text-primary tabular-nums">
                    {rolesList.length}
                  </strong>
                )}
              </div>
              <div>
                <p className="text-sm leading-5 font-semibold text-text-primary">
                  Vai trò
                </p>
                {resources.roles.status === "error" ? (
                  <button
                    type="button"
                    onClick={() => retry("roles")}
                    className="mt-1 inline-flex min-h-[44px] items-center text-xs font-semibold text-brand-primary hover:underline cursor-pointer"
                  >
                    Thử lại
                  </button>
                ) : (
                  <p className="mt-1 text-[13px] leading-[18px] text-text-secondary truncate">
                    {roleSummaryText}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Hai biểu đồ */}
      <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] gap-5">
        <div className="rounded-xl border border-border-color bg-bg-card p-5 flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base leading-6 font-semibold text-text-primary">
                Thao tác trong 7 ngày qua
              </h2>
              <p className="mt-0.5 text-xs leading-4 text-text-muted">
                {weeklySeries.fetchedCount >= AUDIT_7D_FETCH_SIZE
                  ? `Tính trên ${weeklySeries.fetchedCount} bản ghi gần nhất`
                  : `Số bản ghi nhật ký mỗi ngày · tổng ${weeklySeries.totalCount}`}
              </p>
            </div>
          </div>

          {weeklyError ? (
            <div role="alert" className="py-8 flex flex-col items-center justify-center text-center gap-3">
              <p className="text-sm text-status-danger">{weeklyError}</p>
              <button
                type="button"
                onClick={loadWeeklyLogs}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border-color bg-bg-card px-4 text-sm font-semibold text-text-primary hover:bg-bg-secondary cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Thử lại</span>
              </button>
            </div>
          ) : weeklyLoading ? (
            <div className="mt-5 h-56 rounded-lg bg-bg-secondary animate-pulse" aria-label="Đang tải biểu đồ" />
          ) : (
            <div
              role="img"
              aria-label={`Thao tác trong 7 ngày qua: ${weeklySeries.buckets
                .map((b) => `${b.label} ${b.count}`)
                .join(", ")}`}
              className="mt-5 h-56 flex items-end gap-2 sm:gap-4 pt-6 border-b border-border-color px-1 sm:px-3"
            >
              {weeklySeries.buckets.map((day) => {
                const barHeightPct = Math.max(
                  day.count > 0 ? 8 : 2,
                  Math.round((day.count / weeklySeries.maxCount) * 100),
                )
                return (
                  <div
                    key={day.key}
                    className="flex-1 h-full flex flex-col items-center justify-end gap-1.5 min-w-0"
                  >
                    <span
                      className={`text-xs leading-4 font-semibold tabular-nums ${
                        day.isToday ? "text-text-primary" : "text-text-secondary"
                      }`}
                    >
                      {day.count}
                    </span>
                    <div className="w-full flex-1 flex items-end justify-center min-h-0">
                      <div
                        className={`w-full max-w-11 rounded-t-md transition-all duration-300 ${
                          day.isToday ? "bg-brand-primary" : "bg-brand-primary/55"
                        }`}
                        style={{ height: `${barHeightPct}%` }}
                      />
                    </div>
                    <span
                      className={`text-xs leading-4 truncate max-w-full pb-1.5 ${
                        day.isToday
                          ? "font-semibold text-text-primary"
                          : "text-text-secondary"
                      }`}
                    >
                      {day.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border-color bg-bg-card p-5 flex flex-col justify-between gap-4">
          <div>
            <h2 className="text-base leading-6 font-semibold text-text-primary">
              Người dùng theo vai trò
            </h2>
            <p className="mt-0.5 text-xs leading-4 text-text-muted tabular-nums">
              Tổng {usersList.length} tài khoản
            </p>
          </div>

          {usersLoading ? (
            <div className="h-36 rounded-lg bg-bg-secondary animate-pulse" />
          ) : roleDistribution.length === 0 ? (
            <p className="py-6 text-sm text-text-muted text-center">
              Chưa có dữ liệu người dùng.
            </p>
          ) : (
            <div className="flex items-center gap-5">
              <div className="relative w-32 h-32 sm:w-36 sm:h-36 shrink-0">
                <svg
                  viewBox="0 0 160 160"
                  className="w-full h-full"
                  role="img"
                  aria-label={`Biểu đồ tròn phân bố người dùng theo vai trò: ${roleDistribution
                    .map((r) => `${r.label} ${r.percent}%`)
                    .join(", ")}`}
                >
                  <circle
                    cx="80"
                    cy="80"
                    r="60"
                    fill="none"
                    stroke="var(--bg-secondary)"
                    strokeWidth="22"
                  />
                  {donutSegments.map((seg) => (
                    <circle
                      key={seg.roleName}
                      cx="80"
                      cy="80"
                      r="60"
                      fill="none"
                      stroke={seg.color}
                      strokeWidth="22"
                      strokeDasharray={seg.dashArray}
                      strokeDashoffset={seg.dashOffset}
                      transform="rotate(-90 80 80)"
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-bold text-text-primary tabular-nums">
                    {usersList.length}
                  </span>
                  <span className="text-xs text-text-muted">tài khoản</span>
                </div>
              </div>

              <div className="flex-1 min-w-0 space-y-2">
                {roleDistribution.map((item) => (
                  <div
                    key={item.roleName}
                    className="flex items-center justify-between gap-2 text-[13px] leading-[18px]"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      <span className="text-text-primary truncate">{item.label}</span>
                    </span>
                    <strong className="font-semibold text-text-primary tabular-nums shrink-0">
                      {item.count}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-border-color pt-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs leading-4 font-semibold text-text-secondary">
              <span>Trạng thái tài khoản</span>
              <span className="tabular-nums">
                {statusCounts.active} · {statusCounts.inactive} · {statusCounts.locked}
              </span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5 bg-bg-secondary">
              {statusCounts.total > 0 && (
                <>
                  <div
                    className="bg-status-success"
                    style={{
                      width: `${Math.round((statusCounts.active / statusCounts.total) * 100)}%`,
                    }}
                  />
                  <div
                    className="bg-status-warning"
                    style={{
                      width: `${Math.round((statusCounts.inactive / statusCounts.total) * 100)}%`,
                    }}
                  />
                  <div
                    className="bg-status-danger"
                    style={{
                      width: `${Math.round((statusCounts.locked / statusCounts.total) * 100)}%`,
                    }}
                  />
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs leading-4 text-text-secondary">
              <span>Hoạt động ({statusCounts.active})</span>
              <span>Không hoạt động ({statusCounts.inactive})</span>
              <span>Đã khóa ({statusCounts.locked})</span>
            </div>
          </div>
        </div>
      </section>

      {/* Bảng Hoạt động gần đây */}
      <section className="rounded-xl border border-border-color bg-bg-card overflow-hidden">
        <div className="px-5 py-3.5 flex items-center justify-between gap-3 border-b border-border-color">
          <div>
            <h2 className="text-base leading-6 font-semibold text-text-primary">
              Hoạt động gần đây
            </h2>
            <p className="text-xs leading-4 text-text-muted">5 thao tác mới nhất</p>
          </div>
          <Link
            to="/admin/audit-logs"
            className="inline-flex min-h-[44px] items-center gap-1.5 px-2 text-sm font-semibold text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded"
          >
            <span>Mở nhật ký</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {resources.auditLogs.status === "error" ? (
          <div role="alert" className="p-6 text-center space-y-3">
            <p className="text-sm text-status-danger">
              {resources.auditLogs.error || "Không thể tải nhật ký hoạt động."}
            </p>
            <button
              type="button"
              onClick={() => retry("auditLogs")}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border-color bg-bg-card px-4 text-sm font-semibold text-text-primary hover:bg-bg-secondary cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Thử lại</span>
            </button>
          </div>
        ) : logsLoading ? (
          <div className="p-5 space-y-2.5" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-11 rounded bg-bg-secondary animate-pulse" />
            ))}
          </div>
        ) : recentActivities.length === 0 ? (
          <p className="p-8 text-center text-sm text-text-secondary">
            Chưa có bản ghi nhật ký hoạt động nào.
          </p>
        ) : (
          <>
            {/* Mobile list */}
            <div className="divide-y divide-border-color md:hidden">
              {recentActivities.map((log) => {
                const actorUser =
                  log.actorId !== null && log.actorId !== undefined
                    ? userMap.get(Number(log.actorId))
                    : null
                const actorName =
                  log.actorId === null || log.actorId === undefined
                    ? "Hệ thống"
                    : actorUser?.fullName || log.actorLabel || `User #${log.actorId}`
                const actionText = ACTION_LABELS[log.action] || log.action
                let targetText = log.targetLabel || "—"
                if (
                  log.targetEntity &&
                  String(log.targetEntity).toUpperCase() === "USER" &&
                  log.targetId !== null &&
                  log.targetId !== undefined
                ) {
                  targetText = userMap.get(Number(log.targetId))?.fullName || targetText
                }

                return (
                  <div
                    key={log.id ?? `${log.action}-${log.createdAt}`}
                    className="px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">
                        {actionText}
                      </p>
                      <p className="text-xs text-text-muted truncate">
                        {actorName}
                        {targetText && targetText !== "—" ? ` · Áp dụng cho: ${targetText}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-text-secondary tabular-nums whitespace-nowrap shrink-0">
                      {formatAdminDateTime(log.createdAt)}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[760px] text-left border-collapse">
                <thead className="bg-bg-main text-xs leading-4 font-semibold text-text-secondary">
                  <tr>
                    <th className="px-5 py-2.5">Thời gian</th>
                    <th className="px-5 py-2.5">Người thực hiện</th>
                    <th className="px-5 py-2.5">Vai trò</th>
                    <th className="px-5 py-2.5">Thao tác</th>
                    <th className="px-5 py-2.5">Áp dụng cho</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color text-sm leading-5">
                  {recentActivities.map((log) => {
                    const actorUser =
                      log.actorId !== null && log.actorId !== undefined
                        ? userMap.get(Number(log.actorId))
                        : null
                    const actorName =
                      log.actorId === null || log.actorId === undefined
                        ? "Hệ thống"
                        : actorUser?.fullName || log.actorLabel || `User #${log.actorId}`
                    const actorRole =
                      actorUser?.roleName
                        ? ROLE_LABELS[actorUser.roleName] || actorUser.roleName
                        : "—"
                    const actionText = ACTION_LABELS[log.action] || log.action
                    let targetText = log.targetLabel || "—"
                    if (
                      log.targetEntity &&
                      String(log.targetEntity).toUpperCase() === "USER" &&
                      log.targetId !== null &&
                      log.targetId !== undefined
                    ) {
                      targetText = userMap.get(Number(log.targetId))?.fullName || targetText
                    }

                    return (
                      <tr
                        key={log.id ?? `${log.action}-${log.createdAt}`}
                        className="h-12 hover:bg-bg-secondary/60 transition-colors"
                      >
                        <td className="px-5 text-[13px] font-mono text-text-secondary tabular-nums whitespace-nowrap">
                          {formatAdminDateTime(log.createdAt)}
                        </td>
                        <td className="px-5 font-medium text-text-primary whitespace-nowrap">
                          {actorName}
                        </td>
                        <td className="px-5 text-text-secondary whitespace-nowrap">
                          {actorRole}
                        </td>
                        <td className="px-5 text-text-primary whitespace-nowrap">
                          {actionText}
                        </td>
                        <td className="px-5 text-text-secondary whitespace-nowrap">
                          {targetText}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
