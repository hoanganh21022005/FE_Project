import React from "react"

export function AdminPageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs leading-4 font-bold uppercase tracking-[0.08em] text-brand-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-2xl sm:text-[26px] leading-8 sm:leading-[34px] font-bold text-text-primary">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm leading-5 text-text-secondary max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
