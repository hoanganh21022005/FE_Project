import React from "react"
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react"

export function AdminResourceState({
  resource,
  onRetry,
  emptyTitle = "Chưa có dữ liệu",
  emptyDescription = "Endpoint chưa trả về bản ghi nào.",
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
          <div key={item} className="h-10 rounded bg-stone-100 animate-pulse" />
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
        <AlertTriangle className="w-6 h-6 text-rose-700" />
        <p className="mt-3 text-sm font-bold text-rose-950">
          Không thể tải dữ liệu
        </p>
        <p className="mt-1 max-w-lg text-xs leading-5 text-rose-800">
          {resource.error}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 min-h-[44px] inline-flex items-center justify-center gap-2 rounded bg-white px-4 py-2.5 text-xs font-bold text-rose-800 border border-rose-300 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Thử lại
        </button>
      </div>
    )
  }

  if (resource.data.length === 0) {
    return (
      <div className="min-h-36 flex flex-col items-center justify-center text-center px-5 py-7 bg-stone-50 border border-stone-200 rounded-lg">
        <Inbox className="w-6 h-6 text-stone-500" />
        <p className="mt-3 text-sm font-bold text-stone-900">{emptyTitle}</p>
        <p className="mt-1 text-xs leading-5 text-stone-600">
          {emptyDescription}
        </p>
      </div>
    )
  }

  return children
}
