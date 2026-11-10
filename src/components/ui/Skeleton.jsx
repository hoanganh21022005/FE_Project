import React from "react"
import { RefreshCw } from "lucide-react"

// Base skeleton block: animated pulse placeholder
export function SkeletonBlock({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded bg-slate-100 ${className}`}
    />
  )
}

// Stat card skeleton: icon area + two text lines
export function SkeletonStatCard() {
  return (
    <div
      aria-hidden="true"
      className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3"
    >
      <div className="flex items-center gap-3">
        <SkeletonBlock className="w-8 h-8 rounded shrink-0" />
        <SkeletonBlock className="h-3 w-24" />
      </div>
      <SkeletonBlock className="h-7 w-16" />
      <SkeletonBlock className="h-2.5 w-32" />
    </div>
  )
}

// Row skeleton for tables
export function SkeletonRow({ cols = 5 }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <SkeletonBlock className="h-3.5 w-full max-w-[120px]" />
        </td>
      ))}
    </tr>
  )
}

// Card skeleton: title bar + body lines
export function SkeletonCard({ lines = 3, className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3 ${className}`}
    >
      <SkeletonBlock className="h-4 w-40" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  )
}

// Error state with retry button
export function ErrorState({ message, onRetry, language = "vi" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
        <RefreshCw className="w-5 h-5 text-rose-500" />
      </div>
      <p className="text-sm font-medium text-slate-700">
        {message ||
          (language === "vi"
            ? "Không tải được dữ liệu."
            : "Failed to load data.")}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{language === "vi" ? "Thử lại" : "Retry"}</span>
        </button>
      )}
    </div>
  )
}

// Empty state
export function EmptyState({ icon: Icon, title, description, className = "" }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 py-10 text-center ${className}`}
    >
      {Icon && (
        <div className="p-3 bg-slate-100 rounded-lg mb-1">
          <Icon className="w-5 h-5 text-slate-400" />
        </div>
      )}
      {title && (
        <p className="text-sm font-semibold text-slate-700">{title}</p>
      )}
      {description && (
        <p className="text-xs text-slate-500 max-w-xs">{description}</p>
      )}
    </div>
  )
}
