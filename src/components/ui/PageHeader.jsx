/**
 * PageHeader — Tiêu đề trang chuẩn hóa
 * Props:
 *   title: string
 *   description?: string
 *   actions?: ReactNode  — khu vực nút hành động bên phải
 *   className?: string
 */
import React from 'react';

export function PageHeader({ title, description, actions, className = '' }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6 ${className}`}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight leading-snug">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-slate-500 leading-relaxed">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}
