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
  { key: "users", label: "Người dùng", source: "GET /api/users", icon: Users },
  {
    key: "roles",
    label: "Vai trò",
    source: "GET /api/roles",
    icon: ShieldCheck,
  },
  {
    key: "permissions",
    label: "Quyền hệ thống",
    source: "GET /api/permissions",
    icon: FileKey2,
  },
  {
    key: "auditLogs",
    label: "Bản ghi nhật ký",
    source: "GET /api/audit-logs",
    icon: ScrollText,
  },
]

function MetricPanel({ config, resource, onRetry }) {
  const Icon = config.icon
  return (
    <section
      className="min-h-36 bg-white border border-stone-200 rounded-lg p-4 flex flex-col justify-between"
      aria-label={config.label}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-stone-700">{config.label}</p>
          <p className="mt-1 text-[11px] font-mono text-stone-500">
            {config.source}
          </p>
        </div>
        <div className="w-9 h-9 rounded bg-red-50 text-[#BA0000] flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
      </div>

      {resource.status === "loading" || resource.status === "idle" ? (
        <div
          className="h-9 w-20 rounded bg-stone-100 animate-pulse"
          aria-label="Đang tải"
        />
      ) : resource.status === "error" ? (
        <div>
          <p className="text-xs font-semibold text-rose-800 line-clamp-2">
            {resource.error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 min-h-[44px] inline-flex items-center gap-1.5 text-xs font-bold text-rose-800 hover:underline focus:outline-none focus:ring-2 focus:ring-rose-600 rounded cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Thử lại
          </button>
        </div>
      ) : (
        <div className="flex items-end justify-between gap-3">
          <strong className="text-3xl leading-none font-black text-stone-950 tabular-nums">
            {resource.data.length}
          </strong>
          <span className="text-[11px] font-semibold text-emerald-800">
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-950">
            Tình trạng dữ liệu quản trị
          </h2>
          <p className="mt-1 text-sm text-stone-600 max-w-2xl">
            Mỗi chỉ số được tính trực tiếp từ endpoint tương ứng. Một nguồn lỗi
            không làm gián đoạn các nguồn còn lại.
          </p>
        </div>
        <span
          className={`w-fit inline-flex items-center px-2.5 py-1 rounded text-xs font-bold border ${
            apiEnabled
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-amber-50 text-amber-900 border-amber-200"
          }`}
        >
          {apiEnabled ? "Nguồn: Backend API" : "Nguồn: Mock UI mode"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map((config) => (
          <MetricPanel
            key={config.key}
            config={config}
            resource={resources[config.key]}
            onRetry={() => retry(config.key)}
          />
        ))}
      </div>

      <section className="bg-white border border-stone-200 rounded-lg p-5">
        <h3 className="text-sm font-bold text-stone-950">Phạm vi G2</h3>
        <p className="mt-2 text-sm leading-6 text-stone-600 max-w-3xl">
          Portal hiện ở chế độ chỉ đọc. Các thao tác tạo, sửa, khóa tài khoản
          hoặc thay đổi quyền thuộc giai đoạn G3 và không xuất hiện trong giao
          diện này.
        </p>
      </section>
    </div>
  )
}
