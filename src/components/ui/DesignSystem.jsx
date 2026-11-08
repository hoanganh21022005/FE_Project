/**
 * Card — Container card chuẩn hóa
 * StatCard — Card số liệu với nhãn, số lớn, phạm vi, icon
 * FilterBar — Thanh bộ lọc một hàng gọn
 * Btn — Nút chuẩn hóa 3 loại: primary | secondary | ghost
 * SectionTitle — Tiêu đề section text-base font-semibold
 */
import React from 'react';

/* ─── Card ─────────────────────────────────────────── */
export function Card({ children, className = '', as: Tag = 'div', ...rest }) {
  return (
    <Tag
      className={`bg-white border border-slate-200 rounded-2xl shadow-sm p-5 md:p-6 ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* ─── StatCard ──────────────────────────────────────── */
/**
 * Props:
 *   label: string — nhãn nhỏ trên
 *   value: string | number
 *   scope?: string  — "Hôm nay" / "Tháng này" / "Hiện tại"
 *   icon?: ReactElement
 *   iconBg?: string — Tailwind bg class, e.g. "bg-blue-50"
 *   iconColor?: string — Tailwind text class
 *   trend?: ReactNode — badge xu hướng (tuỳ chọn)
 *   className?: string
 */
export function StatCard({
  label,
  value,
  scope,
  icon,
  iconBg = 'bg-slate-100',
  iconColor = 'text-slate-500',
  trend,
  footer,
  valueClassName = '',
  className = '',
}) {
  return (
    <Card className={`flex flex-col gap-3 h-full ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight">
          {label}
        </span>
        {icon && (
          <div className={`p-2 rounded-xl shrink-0 ${iconBg} ${iconColor}`}>
            {icon}
          </div>
        )}
      </div>
      <div>
        <div className={`text-3xl font-semibold tabular-nums leading-none ${valueClassName || 'text-slate-900'}`}>
          {value ?? '—'}
        </div>
        {scope && (
          <span className="mt-1.5 inline-block text-xs font-medium text-slate-400 bg-slate-50 border border-slate-100 rounded-full px-2 py-0.5">
            {scope}
          </span>
        )}
      </div>
      {trend && <div className="mt-auto">{trend}</div>}
      {footer && <div className="mt-auto">{footer}</div>}
    </Card>
  );
}

/* ─── SectionTitle ──────────────────────────────────── */
export function SectionTitle({ children, className = '' }) {
  return (
    <h2 className={`text-base font-semibold text-slate-800 ${className}`}>
      {children}
    </h2>
  );
}

/* ─── FilterBar ─────────────────────────────────────── */
/**
 * Props:
 *   children: ReactNode — ô tìm kiếm + selects + nút xóa lọc
 *   className?: string
 */
export function FilterBar({ children, className = '' }) {
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm px-4 py-3 flex flex-wrap items-center gap-3 ${className}`}>
      {children}
    </div>
  );
}

/* ─── Btn ────────────────────────────────────────────── */
/**
 * Props:
 *   variant?: 'primary' | 'secondary' | 'ghost'
 *   size?: 'sm' | 'md'
 *   children: ReactNode
 *   className?: string
 *   ...rest: button props
 */
const BTN_VARIANTS = {
  primary:   'bg-brand-primary hover:bg-brand-primary-hover text-white shadow-sm',
  secondary: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300',
  ghost:     'bg-transparent hover:bg-slate-100 text-slate-600',
};
const BTN_SIZES = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
};

export function Btn({
  variant = 'secondary',
  size = 'md',
  children,
  className = '',
  ...rest
}) {
  const base =
    'inline-flex items-center gap-1.5 font-medium rounded-xl cursor-pointer transition-all duration-150 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed ' +
    'motion-safe:transition-colors';
  return (
    <button
      type="button"
      className={`${base} ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ─── StatusChip — Badge trạng thái chuẩn hóa ──────── */
/**
 * Thay thế các badge tản mạn khắp trang
 * variant: 'upcoming'|'attended'|'absent'|'cancelled'|'makeup'|'default'
 */
const CHIP_VARIANTS = {
  upcoming:  'bg-blue-50  text-blue-700  border-blue-100',
  attended:  'bg-emerald-50 text-emerald-700 border-emerald-100',
  absent:    'bg-rose-50  text-rose-700   border-rose-100',
  cancelled: 'bg-slate-100 text-slate-500  border-slate-200',
  makeup:    'bg-orange-50 text-orange-700 border-orange-100',
  default:   'bg-slate-100 text-slate-600  border-slate-200',
};

export function StatusChip({ variant = 'default', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2.5 py-0.5 whitespace-nowrap ${CHIP_VARIANTS[variant] || CHIP_VARIANTS.default} ${className}`}
    >
      {children}
    </span>
  );
}
