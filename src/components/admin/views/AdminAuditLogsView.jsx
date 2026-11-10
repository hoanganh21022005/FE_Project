import React, { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { AdminResourceState } from "../AdminResourceState.jsx"
import { useAdminData } from "../AdminDataContext.jsx"
import { formatAdminDateTime } from "../adminDateUtils.js"

const PAGE_SIZE = 25

export function AdminAuditLogsView() {
  const { resources, retry } = useAdminData()
  const [query, setQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
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

  const totalItems = filteredLogs.length
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const activePage = Math.min(Math.max(1, currentPage), totalPages)

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const handleQueryChange = (event) => {
    setQuery(event.target.value)
    setCurrentPage(1)
  }

  const paginatedLogs = useMemo(() => {
    const startIdx = (activePage - 1) * PAGE_SIZE
    return filteredLogs.slice(startIdx, startIdx + PAGE_SIZE)
  }, [filteredLogs, activePage])

  const startItem =
    totalItems === 0 ? 0 : (activePage - 1) * PAGE_SIZE + 1
  const endItem =
    totalItems === 0 ? 0 : Math.min(activePage * PAGE_SIZE, totalItems)

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h2 className="text-xl leading-7 font-semibold text-text-primary">
            Nhật ký hoạt động
          </h2>
          <p className="mt-1 text-sm leading-5 text-text-secondary">
            Ghi nhận toàn bộ thao tác bảo mật và sự kiện hệ thống; tài khoản không định danh hiển thị theo ID hoặc Hệ thống.
          </p>
        </div>
        <label className="relative w-full md:w-80">
          <span className="sr-only">Tìm nhật ký</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            value={query}
            onChange={handleQueryChange}
            placeholder="Actor, hành động, đối tượng..."
            className="min-h-11 w-full rounded border border-border-color bg-bg-card pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
          />
        </label>
      </div>

      <AdminResourceState
        resource={logs}
        onRetry={() => retry("auditLogs")}
        emptyTitle="Chưa có nhật ký"
      >
        <div className="w-full overflow-x-auto rounded-lg border border-border-color bg-bg-card">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-bg-secondary text-xs font-semibold text-text-secondary">
              <tr>
                <th className="px-3.5 py-2.5 text-left align-middle">Thời gian</th>
                <th className="px-3.5 py-2.5 text-left align-middle">Actor</th>
                <th className="px-3.5 py-2.5 text-left align-middle">Hành động</th>
                <th className="px-3.5 py-2.5 text-left align-middle">Đối tượng</th>
                <th className="px-3.5 py-2.5 text-left align-middle">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {paginatedLogs.map((log) => (
                <tr
                  key={log.id ?? `${log.action}-${log.createdAt}`}
                  data-log-id={log.id}
                  className="transition-colors hover:bg-bg-secondary/70"
                >
                  <td className="px-3.5 py-2 align-middle text-sm leading-5 text-text-secondary tabular-nums font-mono whitespace-nowrap">
                    {formatAdminDateTime(log.createdAt)}
                  </td>
                  <td className="px-3.5 py-2 align-middle text-sm leading-5 font-semibold text-text-primary">
                    {log.actorLabel}
                  </td>
                  <td className="px-3.5 py-2 align-middle text-xs">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-xs font-medium bg-bg-secondary text-brand-primary border border-border-color/60">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-3.5 py-2 align-middle text-sm leading-5 text-text-primary">
                    {log.targetLabel}
                  </td>
                  <td className="px-3.5 py-2 align-middle text-sm leading-5 text-text-secondary max-w-xl">
                    {log.detail || "Không có thông tin chi tiết."}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredLogs.length === 0 && (
            <p className="p-8 text-center text-sm leading-5 text-text-secondary">
              Không có nhật ký phù hợp từ khóa.
            </p>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3.5 py-2.5 border-t border-border-color bg-bg-secondary/50">
            <span className="text-xs leading-4 text-text-secondary tabular-nums">
              Hiển thị {startItem}–{endItem} trong tổng số {totalItems} bản ghi
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={activePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex min-h-11 items-center justify-center rounded px-3 text-xs font-medium border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                aria-label="Trang trước"
              >
                Trang trước
              </button>
              <span className="h-8 inline-flex items-center justify-center px-2.5 rounded bg-bg-secondary border border-border-color text-text-primary text-xs font-medium tabular-nums">
                {activePage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={activePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex min-h-11 items-center justify-center rounded px-3 text-xs font-medium border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                aria-label="Trang sau"
              >
                Trang sau
              </button>
            </div>
          </div>
        </div>
      </AdminResourceState>
    </div>
  )
}
