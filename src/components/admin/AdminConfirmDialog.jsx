import React, { useRef } from "react"
import { AlertTriangle, LoaderCircle, X } from "lucide-react"
import { useDialogFocus } from "./useDialogFocus.js"

export function AdminConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  warning,
  confirmText = "Xác nhận",
  cancelText = "Hủy bỏ",
  isDanger = false,
  isLoading = false,
  confirmDisabled = false,
  triggerRef = null,
}) {
  const dialogRef = useRef(null)
  const confirmBtnRef = useRef(null)

  useDialogFocus({
    isOpen,
    onClose,
    dialogRef,
    initialFocusRef: confirmBtnRef,
    triggerRef,
    isLoading,
  })

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-confirm-title"
        aria-describedby="admin-confirm-desc"
        className="w-full max-w-md rounded-lg border border-border-color bg-bg-card p-6 shadow-lg text-text-primary space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {isDanger ? (
              <div className="w-10 h-10 rounded-full bg-status-danger-bg text-status-danger flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-bg-secondary text-brand-primary flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-brand-primary" />
              </div>
            )}
            <div>
              <h3
                id="admin-confirm-title"
                className="text-base leading-6 font-semibold text-text-primary"
              >
                {title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-11 h-11 inline-flex items-center justify-center rounded text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary shrink-0"
            aria-label="Đóng hộp thoại"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div id="admin-confirm-desc" className="text-sm leading-5 text-text-secondary space-y-2">
          {typeof description === "string" ? <p>{description}</p> : description}
        </div>

        {warning && (
          <div
            role="alert"
            className="p-3 rounded-lg border border-status-warning-border bg-status-warning-bg text-status-warning flex items-start gap-2 text-xs leading-4"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>{warning}</div>
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 border-t border-border-color/60">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="min-h-11 inline-flex items-center justify-center rounded px-4 py-2 text-sm font-medium border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            {cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={isLoading || confirmDisabled}
            className={`min-h-11 inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              isDanger
                ? "bg-status-danger text-white hover:bg-status-danger/90 focus-visible:ring-status-danger"
                : "bg-brand-primary text-white hover:bg-brand-primary/90 focus-visible:ring-brand-primary"
            }`}
          >
            {isLoading && <LoaderCircle className="w-4 h-4 animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
