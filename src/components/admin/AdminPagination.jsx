import React, { useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useSCMS } from "../../context/SCMSContext.jsx"
import { getAdminText } from "./adminI18n.js"

function buildPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const pages = [1]
  if (currentPage > 3) pages.push("ellipsis-left")
  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)
  for (let p = start; p <= end; p++) {
    pages.push(p)
  }
  if (currentPage < totalPages - 2) pages.push("ellipsis-right")
  pages.push(totalPages)
  return pages
}

export function AdminPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  summaryText,
  prevLabel,
  nextLabel,
  navLabel,
  itemLabel,
}) {
  const { language } = useSCMS()
  const safeTotalPages = Math.max(1, totalPages)
  const safePage = Math.min(Math.max(1, page), safeTotalPages)
  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1
  const endItem = Math.min(totalItems, safePage * pageSize)
  const resolvedPrev = prevLabel || getAdminText(language, "pagination.prev")
  const resolvedNext = nextLabel || getAdminText(language, "pagination.next")
  const resolvedNav = navLabel || getAdminText(language, "pagination.navLabel")
  const resolvedUnit = itemLabel || getAdminText(language, "pagination.usersUnit")

  const pageNumbers = useMemo(
    () => buildPageNumbers(safePage, safeTotalPages),
    [safePage, safeTotalPages],
  )

  return (
    <div className="px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 border-t border-border-color bg-bg-card">
      <p className="text-sm leading-5 text-text-secondary tabular-nums">
        {summaryText || (
          <>
            {language === "en" ? "Showing " : "Hiển thị "}
            <strong className="font-semibold text-text-primary">
              {startItem}–{endItem}
            </strong>{" "}
            {language === "en" ? `of ${totalItems} ${resolvedUnit}` : `trên ${totalItems} ${resolvedUnit}`}
          </>
        )}
      </p>
      <nav aria-label={resolvedNav} className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          aria-label={resolvedPrev}
          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg border border-border-color bg-bg-card text-brand-primary hover:bg-bg-secondary disabled:opacity-50 disabled:text-text-muted disabled:bg-bg-main disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {pageNumbers.map((item) =>
          typeof item === "string" ? (
            <span
              key={item}
              className="min-w-[32px] min-h-[44px] inline-flex items-center justify-center text-sm text-text-muted select-none"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === safePage ? "page" : undefined}
              className={`min-w-[44px] min-h-[44px] px-3 inline-flex items-center justify-center rounded-lg border text-sm font-semibold tabular-nums transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                item === safePage
                  ? "bg-brand-primary border-brand-primary text-text-inverse"
                  : "bg-bg-card border-border-color text-brand-primary hover:bg-bg-secondary"
              }`}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= safeTotalPages}
          aria-label={resolvedNext}
          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg border border-border-color bg-bg-card text-brand-primary hover:bg-bg-secondary disabled:opacity-50 disabled:text-text-muted disabled:bg-bg-main disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </nav>
    </div>
  )
}
