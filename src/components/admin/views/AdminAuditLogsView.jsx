import React, { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { AdminResourceState } from "../AdminResourceState.jsx"
import { useAdminData } from "../AdminDataContext.jsx"

const formatDateTime = (value) => {
  if (!value) return "Chưa có"
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "medium",
      }).format(date)
}

export function AdminAuditLogsView() {
  const { resources, retry } = useAdminData()
  const [query, setQuery] = useState("")
  const logs = resources.auditLogs
  const filteredLogs = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return logs.data
    return logs.data.filter((log) =>
      [log.actorLabel, log.action, log.targetLabel, log.detail].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(normalized),
      ),
    )
  }, [logs.data, query])

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-950">
            Nhật ký hoạt động
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Dữ liệu DTO thật từ `GET /api/audit-logs`; actor thiếu tên được hiển
            thị bằng ID hoặc System.
          </p>
        </div>
        <label className="relative w-full md:w-80">
          <span className="sr-only">Tìm nhật ký</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Actor, hành động, đối tượng..."
            className="w-full h-11 min-h-[44px] pl-9 pr-3 rounded border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#BA0000]"
          />
        </label>
      </div>

      <AdminResourceState
        resource={logs}
        onRetry={() => retry("auditLogs")}
        emptyTitle="Chưa có nhật ký"
      >
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-stone-50 border-b border-stone-200 text-xs text-stone-700">
                <tr>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Hành động</th>
                  <th className="px-4 py-3">Đối tượng</th>
                  <th className="px-4 py-3">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredLogs.map((log) => (
                  <tr
                    key={log.id ?? `${log.action}-${log.createdAt}`}
                    className="hover:bg-stone-50 align-top"
                  >
                    <td className="px-4 py-3 text-xs text-stone-600 whitespace-nowrap tabular-nums font-mono">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-bold text-stone-950 whitespace-nowrap">
                      {log.actorLabel}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-[#BA0000] break-all">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-800 whitespace-nowrap">
                      {log.targetLabel}
                    </td>
                    <td className="px-4 py-3 text-stone-600 max-w-xl leading-5">
                      {log.detail || "Backend không cung cấp chi tiết."}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredLogs.length === 0 && (
            <p className="p-8 text-center text-sm text-stone-600">
              Không có nhật ký phù hợp từ khóa.
            </p>
          )}
        </div>
      </AdminResourceState>
    </div>
  )
}
