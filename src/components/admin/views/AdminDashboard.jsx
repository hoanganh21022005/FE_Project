import React from "react"
import {
  FileKey2,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react"
import { useAdminData } from "../AdminDataContext.jsx"

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
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-50 text-status-success ring-1 ring-inset ring-emerald-200/60">
            Đã đồng bộ
          </span>
        </div>
      )}
    </section>
  )
}

export function AdminDashboard() {
  const { resources, retry, apiEnabled } = useAdminData()

  return (
    <div className="space-y-5 font-sans">
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
              ? "bg-emerald-50 text-status-success ring-1 ring-inset ring-emerald-200"
              : "bg-amber-50 text-status-warning ring-1 ring-inset ring-amber-200"
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

      <section className="rounded-lg border border-border-color bg-bg-card/70 p-4 text-text-primary">
        <h3 className="text-sm leading-5 font-semibold text-text-primary">Phạm vi G2</h3>
        <p className="mt-1 text-sm leading-5 text-text-secondary max-w-3xl">
          Portal hiện ở chế độ chỉ đọc. Các thao tác tạo, sửa, khóa tài khoản
          hoặc thay đổi quyền thuộc giai đoạn G3 và không xuất hiện trong giao
          diện này.
        </p>
      </section>
    </div>
  )
}
