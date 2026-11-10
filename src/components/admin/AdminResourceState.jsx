import React from "react"
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react"

export function AdminResourceState({
  resource,
  onRetry,
  emptyTitle = "Chưa có dữ liệu",
  emptyDescription = "Hệ thống chưa có bản ghi nào.",
  children,
}) {
  if (resource.status === "idle" || resource.status === "loading") {
    return (
      <div
        className="space-y-3 py-2"
        aria-label="Đang tải dữ liệu"
        aria-busy="true"
      >
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-10 rounded bg-bg-secondary animate-pulse" />
        ))}
      </div>
    )
  }

  if (resource.status === "error") {
    return (
      <div
        role="alert"
        className="min-h-36 flex flex-col items-center justify-center text-center px-5 py-7 bg-rose-50 border border-rose-200 rounded-lg"
      >
        <AlertTriangle className="w-6 h-6 text-status-danger" />
        <p className="mt-3 text-sm leading-5 font-semibold text-status-danger">
          Không thể tải dữ liệu
        </p>
        <p className="mt-1 max-w-lg text-sm leading-5 text-status-danger">
          {resource.error}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Thử lại
        </button>
      </div>
    )
  }

  if (resource.data.length === 0) {
    return (
      <div className="min-h-36 flex flex-col items-center justify-center text-center px-5 py-7 rounded-lg border border-border-color bg-bg-card p-4 text-text-primary">
        <Inbox className="w-6 h-6 text-text-muted" />
        <p className="mt-3 text-sm leading-5 font-semibold text-text-primary">{emptyTitle}</p>
        <p className="mt-1 text-sm leading-5 text-text-secondary">
          {emptyDescription}
        </p>
      </div>
    )
  }

  return children
}
