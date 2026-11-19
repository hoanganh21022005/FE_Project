import React, { useEffect, useRef } from "react"
import { X } from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"

/**
 * Hộp xác nhận hủy buổi PT 1:1 dùng chung cho các màn của Member.
 * Hai nút: "Giữ lịch" (đóng, không gửi gì) và "Xác nhận hủy" (mới gửi yêu cầu hủy).
 * Nội dung: buổi nào, ngày, giờ, và câu về việc hoàn 1 credit do màn gọi truyền vào.
 */
export function PrivateSessionCancelDialog({
  title,
  dateText,
  timeText,
  message,
  tone = "refund",
  deadlineText = "",
  busy = false,
  onKeep,
  onConfirm,
}) {
  const { t } = useSCMS()
  const keepRef = useRef(null)

  useEffect(() => {
    keepRef.current?.focus()
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) onKeep?.()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [busy, onKeep])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("sessionCancelDialogTitle")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
    >
      <div className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-[16px] font-extrabold text-slate-900">{t("sessionCancelDialogTitle")}</h3>
          <button
            type="button"
            aria-label={t("sessionCancelKeepBtn")}
            disabled={busy}
            onClick={onKeep}
            className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2 text-[13px] text-slate-700">
          <p className="font-bold text-slate-900">
            {title} · {dateText || "—"}
            {timeText ? ` (${timeText})` : ""}
          </p>
          <p
            className={`rounded-lg border p-3 font-medium leading-relaxed ${
              tone === "warn"
                ? "border-amber-200 bg-amber-50 text-amber-950"
                : "border-emerald-200 bg-emerald-50 text-emerald-950"
            }`}
          >
            {message}
          </p>
          {deadlineText && <p className="text-slate-600">{deadlineText}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            ref={keepRef}
            type="button"
            disabled={busy}
            onClick={onKeep}
            className="min-h-11 cursor-pointer rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-[13px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {t("sessionCancelKeepBtn")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="min-h-11 cursor-pointer rounded-lg bg-rose-700 px-4 py-1.5 text-[13px] font-bold text-white hover:bg-rose-800 disabled:opacity-50"
          >
            {busy ? t("schedulePtBtnCancelling") : t("schedulePtCancelConfirmBtn")}
          </button>
        </div>
      </div>
    </div>
  )
}
