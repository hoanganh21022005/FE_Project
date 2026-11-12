/**
 * Helper định nghĩa class badge dùng chung cho khu vực Admin
 * Tuân thủ DESIGN.md mục 5:
 * badgeBase: inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs leading-4 font-semibold
 * 4 biến thể ngữ nghĩa: success, warning, danger, neutral
 */

export const badgeBase =
  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs leading-4 font-semibold"

export const badgeVariants = {
  success: "bg-status-success-bg text-status-success border border-status-success-border",
  warning: "bg-status-warning-bg text-status-warning border border-status-warning-border",
  danger: "bg-status-danger-bg text-status-danger border border-status-danger-border",
  neutral: "bg-bg-secondary text-text-secondary border border-border-color",
  primary: "bg-brand-blue-soft text-brand-primary border border-brand-accent-soft",
}

export function getAdminBadgeClass(variant = "neutral", extraClass = "") {
  const v = badgeVariants[variant] || badgeVariants.neutral
  return extraClass ? `${badgeBase} ${v} ${extraClass}` : `${badgeBase} ${v}`
}
