import React, { useMemo } from "react"
import { Link } from "react-router-dom"
import {
  ArrowRight,
  FileKey2,
  History,
  PieChart,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react"
import { useAdminData } from "../AdminDataContext.jsx"
import { formatAdminDateTime } from "../adminDateUtils.js"

const metrics = [
  { key: "users", label: "Người dùng", source: "Tài khoản người dùng & nhân sự", icon: Users },
  {
    key: "roles",
    label: "Vai trò",
    source: "Danh mục vai trò phân quyền",
    icon: ShieldCheck,
  },
  {
    key: "permissions",
    label: "Quyền hệ thống",
    source: "Danh sách quyền chức năng",
    icon: FileKey2,
  },
  {
    key: "auditLogs",
    label: "Bản ghi nhật ký",
    source: "Nhật ký an toàn & thao tác",
    icon: ScrollText,
  },
]

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

const STATUS_CONFIG = {
  active: {
    label: "Hoạt động",
    badgeClass: "bg-status-success-bg text-status-success ring-status-success-border",
    barClass: "bg-status-success",
  },
  inactive: {
    label: "Không hoạt động",
    badgeClass: "bg-bg-secondary text-text-secondary ring-border-color",
    barClass: "bg-border-strong",
  },
  locked: {
    label: "Đã khóa",
    badgeClass: "bg-status-danger-bg text-status-danger ring-status-danger-border",
    barClass: "bg-status-danger",
  },
}

function MetricPanel({ config, resource, onRetry }) {
  const Icon = config.icon
  const accent = {
    users: "bg-bg-secondary text-brand-primary",
    roles: "bg-bg-secondary text-brand-primary",
    permissions: "bg-bg-secondary text-brand-accent",
    auditLogs: "bg-bg-secondary text-brand-primary",
  }[config.key]
  return (
    <section
      className="min-h-32 rounded-lg border border-border-color bg-bg-card p-4 text-text-primary flex flex-col justify-between transition-colors hover:border-border-color/80"
      aria-label={config.label}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs leading-4 font-semibold text-text-secondary">{config.label}</p>
          <p className="mt-0.5 text-xs leading-4 text-text-muted">
            {config.source}
          </p>
        </div>
        <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      {resource.status === "loading" || resource.status === "idle" ? (
        <div
          className="h-8 w-20 rounded bg-bg-secondary animate-pulse"
          aria-label="Đang tải"
        />
      ) : resource.status === "error" ? (
        <div className="pt-2">
          <p className="text-xs leading-4 text-status-danger line-clamp-2">
            {resource.error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-2.5 text-xs font-medium border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Thử lại
          </button>
        </div>
      ) : (
        <div className="flex items-baseline justify-between gap-3 pt-3">
          <strong className="text-2xl leading-7 font-bold text-text-primary tabular-nums">
            {resource.data.length}
          </strong>
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-status-success-bg text-status-success ring-1 ring-inset ring-status-success-border">
            Đã đồng bộ
          </span>
        </div>
      )}
    </section>
  )
}

export function AdminDashboard() {
  const { resources, retry, apiEnabled } = useAdminData()

  const usersList = resources.users.data || []
  const rolesList = resources.roles.data || []
  const auditLogsList = resources.auditLogs.data || []

  // Ánh xạ userId -> fullName
  const userMap = useMemo(() => {
    const map = new Map()
    for (const u of usersList) {
      if (u.id !== null && u.id !== undefined) {
        map.set(Number(u.id), u.fullName || `User #${u.id}`)
      }
    }
    return map
  }, [usersList])

  // Phân bố người dùng theo vai trò
  const roleDistribution = useMemo(() => {
    const total = usersList.length
    if (total === 0) return []

    const counts = new Map()
    for (const u of usersList) {
      const roleKey = u.roleName || (u.roleId ? `Role #${u.roleId}` : "Khác")
      counts.set(roleKey, (counts.get(roleKey) || 0) + 1)
    }

    // Đảm bảo các vai trò từ rolesList cũng có mặt nếu có
    for (const r of rolesList) {
      if (!counts.has(r.name)) {
        counts.set(r.name, 0)
      }
    }

    const items = []
    for (const [roleName, count] of counts.entries()) {
      const percent = total > 0 ? Math.round((count / total) * 100) : 0
      const label = ROLE_LABELS[roleName] || roleName
      items.push({ roleName, label, count, percent })
    }

    return items.sort((a, b) => b.count - a.count)
  }, [usersList, rolesList])

  // Phân bố người dùng theo trạng thái
  const statusDistribution = useMemo(() => {
    const total = usersList.length
    if (total === 0) return []

    const counts = { active: 0, inactive: 0, locked: 0 }
    for (const u of usersList) {
      const st = String(u.status || "").toLowerCase()
      if (st === "active") counts.active++
      else if (st === "locked") counts.locked++
      else counts.inactive++
    }

    return Object.entries(counts).map(([key, count]) => {
      const percent = total > 0 ? Math.round((count / total) * 100) : 0
      const cfg = STATUS_CONFIG[key] || STATUS_CONFIG.inactive
      return {
        key,
        label: cfg.label,
        count,
        percent,
        badgeClass: cfg.badgeClass,
        barClass: cfg.barClass,
      }
    })
  }, [usersList])

  // 5 hoạt động gần nhất
  const recentActivities = useMemo(() => {
    const sorted = [...auditLogsList].sort((a, b) => {
      const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return tB - tA
    })
    return sorted.slice(0, 5)
  }, [auditLogsList])

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl leading-7 font-semibold text-text-primary">
            Tình trạng dữ liệu quản trị
          </h2>
          <p className="mt-1 text-sm leading-5 text-text-secondary max-w-2xl">
            Tổng hợp số liệu từ các dịch vụ quản trị trung tâm. Sự cố gián đoạn đơn lẻ
            không ảnh hưởng tới các phân hệ dữ liệu khác.
          </p>
        </div>
        <span
          className={`w-fit inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
            apiEnabled
              ? "bg-status-success-bg text-status-success ring-1 ring-inset ring-status-success-border"
              : "bg-status-warning-bg text-status-warning ring-1 ring-inset ring-status-warning-border"
          }`}
        >
          {apiEnabled ? "Nguồn: Hệ thống trực tuyến" : "Nguồn: Chế độ thử nghiệm"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        {metrics.map((config) => (
          <MetricPanel
            key={config.key}
            config={config}
            resource={resources[config.key]}
            onRetry={() => retry(config.key)}
          />
        ))}
      </div>

      {/* Phân bố người dùng & Hoạt động gần đây */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Phân bố theo vai trò & trạng thái */}
        <section
          className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-5"
          aria-label="Phân bố người dùng"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border-color/60 pb-3">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-brand-primary" />
              <h3 className="text-sm leading-5 font-semibold text-text-primary">
                Phân bố người dùng
              </h3>
            </div>
            <span className="text-xs leading-4 text-text-muted">
              Tổng số: {usersList.length} tài khoản
            </span>
          </div>

          {/* Phân bố theo vai trò */}
          <div className="space-y-3">
            <h4 className="text-xs leading-4 font-semibold text-text-secondary uppercase tracking-wider">
              Theo vai trò
            </h4>
            {roleDistribution.length === 0 ? (
              <p className="text-xs leading-4 text-text-muted">Chưa có dữ liệu người dùng.</p>
            ) : (
              <div className="space-y-2.5">
                {roleDistribution.map((item) => (
                  <div key={item.roleName} className="space-y-1">
                    <div className="flex items-center justify-between text-xs leading-4">
                      <span className="font-medium text-text-primary">
                        {item.label}
                        <span className="ml-1 text-text-muted font-normal font-mono text-[11px]">
                          ({item.roleName})
                        </span>
                      </span>
                      <span className="text-text-secondary tabular-nums">
                        {item.count} ({item.percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-brand-primary h-full rounded-full transition-all duration-300"
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Phân bố theo trạng thái */}
          <div className="space-y-3 pt-2 border-t border-border-color/40">
            <h4 className="text-xs leading-4 font-semibold text-text-secondary uppercase tracking-wider">
              Theo trạng thái
            </h4>
            {statusDistribution.length === 0 ? (
              <p className="text-xs leading-4 text-text-muted">Chưa có dữ liệu trạng thái.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {statusDistribution.map((st) => (
                  <div
                    key={st.key}
                    className="p-3 rounded-lg border border-border-color/60 bg-bg-secondary/40 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-text-secondary">
                        {st.label}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-0.2 text-[11px] font-medium ring-1 ring-inset ${st.badgeClass}`}
                      >
                        {st.percent}%
                      </span>
                    </div>
                    <p className="text-lg leading-6 font-bold text-text-primary tabular-nums">
                      {st.count}
                    </p>
                    <div className="w-full bg-bg-secondary rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${st.barClass}`}
                        style={{ width: `${st.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Khối Hoạt động gần đây */}
        <section
          className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary flex flex-col justify-between space-y-4"
          aria-label="Hoạt động gần đây"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 border-b border-border-color/60 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-brand-primary" />
                <h3 className="text-sm leading-5 font-semibold text-text-primary">
                  Hoạt động gần đây
                </h3>
              </div>
              <span className="text-xs leading-4 text-text-muted">
                5 bản ghi mới nhất
              </span>
            </div>

            {recentActivities.length === 0 ? (
              <p className="p-6 text-center text-xs leading-4 text-text-muted">
                Chưa có bản ghi nhật ký hoạt động nào.
              </p>
            ) : (
              <div className="divide-y divide-border-color/50">
                {recentActivities.map((log) => {
                  const actorText =
                    log.actorId === null
                      ? "Hệ thống"
                      : userMap.get(Number(log.actorId)) || log.actorLabel || `User #${log.actorId}`
                  const actionText = ACTION_LABELS[log.action] || log.action

                  return (
                    <div
                      key={log.id ?? `${log.action}-${log.createdAt}`}
                      className="py-2.5 first:pt-1 last:pb-1 space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs leading-4 font-semibold text-text-primary truncate">
                            {actorText}
                          </p>
                          <p className="text-xs leading-4 text-text-secondary truncate mt-0.5">
                            <span className="font-medium text-brand-primary">
                              {actionText}
                            </span>
                            {log.targetLabel && (
                              <span className="text-text-muted"> · {log.targetLabel}</span>
                            )}
                          </p>
                        </div>
                        <span className="text-[11px] leading-4 text-text-muted tabular-nums whitespace-nowrap font-mono">
                          {formatAdminDateTime(log.createdAt)}
                        </span>
                      </div>
                      {log.detail && (
                        <p className="text-[11px] leading-4 text-text-muted line-clamp-1">
                          {log.detail}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-border-color/60">
            <Link
              to="/admin/audit-logs"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 w-full rounded border border-border-color bg-bg-card px-3 text-xs font-semibold text-brand-primary hover:bg-bg-secondary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              <span>Xem toàn bộ nhật ký an toàn</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-border-color bg-bg-card/70 p-4 text-text-primary space-y-2">
        <h3 className="text-sm leading-5 font-semibold text-text-primary">Chế độ vận hành</h3>
        <p className="text-sm leading-5 text-text-secondary max-w-3xl">
          Portal quản trị đang hoạt động với đầy đủ quyền quản trị: tạo mới và cập nhật người dùng,
          thay đổi trạng thái tài khoản, cấp lại mật khẩu tạm và điều chỉnh phân quyền vai trò theo đặc tả hệ thống.
        </p>
        <p className="text-xs leading-5 text-text-muted">
          Để dùng các màn vận hành, vai trò Admin cần được gán quyền tương ứng tại{" "}
          <Link
            to="/admin/roles"
            className="font-semibold text-brand-primary underline hover:text-brand-primary-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary rounded"
          >
            Vai trò & Quyền
          </Link>
          .
        </p>
      </section>
    </div>
  )
}
