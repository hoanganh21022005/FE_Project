/**
 * Helper định nghĩa class badge dùng chung cho khu vực Admin
 * Tuân thủ DESIGN.md mục 5:
 * badgeBase: inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-4
 * 4 biến thể ngữ nghĩa: success, warning, danger, neutral (+ primary)
 */

export const badgeBase =
  "inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-4"

export const badgeVariants = {
  success: "border-status-success-border bg-status-success-bg text-status-success",
  warning: "border-status-warning-border bg-status-warning-bg text-status-warning",
  danger: "border-status-danger-border bg-status-danger-bg text-status-danger",
  neutral: "border-border-color bg-bg-secondary text-text-secondary",
  primary: "border-brand-accent-soft bg-brand-blue-soft text-brand-primary",
}

export function getAdminBadgeClass(variant = "neutral", extraClass = "") {
  const v = badgeVariants[variant] || badgeVariants.neutral
  return extraClass ? `${badgeBase} ${v} ${extraClass}` : `${badgeBase} ${v}`
}
