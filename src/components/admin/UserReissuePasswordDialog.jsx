import React, { useEffect, useRef, useState } from "react"
import { AlertTriangle, CheckCircle, KeyRound, LoaderCircle, Mail, ShieldAlert, X } from "lucide-react"
import { reissuePassword } from "../../api/authApi.js"
import { useSCMS } from "../../context/SCMSContext.jsx"
import { getAdminText } from "./adminI18n.js"
import { useDialogFocus } from "./useDialogFocus.js"

export function UserReissuePasswordDialog({
  isOpen,
  onClose,
  user,
  onSuccess,
  triggerRef,
}) {
  const { language } = useSCMS()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const dialogRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setError(null)
      setResult(null)
      setLoading(false)
    }
  }, [isOpen])

  useDialogFocus({
    isOpen,
    onClose,
    dialogRef,
    triggerRef,
    isLoading: loading,
  })

  if (!isOpen || !user) return null

  const handleReissue = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await reissuePassword(user.id)
      setResult(res || { emailSent: true })
      if (onSuccess) onSuccess(res)
    } catch (err) {
      if (err?.status === 403) {
        setError(getAdminText(language, "common.noPermission"))
      } else {
        setError(err?.message || getAdminText(language, "reissueDialog.errFallback"))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-reissue-pwd-title"
        className="w-full max-w-md rounded-lg border border-border-color bg-bg-card p-6 shadow-lg text-text-primary space-y-4"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border-color/60 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-status-warning-bg text-status-warning flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 id="user-reissue-pwd-title" className="text-base font-semibold text-text-primary">
                {getAdminText(language, "reissueDialog.title")}
              </h3>
              <p className="text-xs text-text-secondary">
                {getAdminText(language, "reissueDialog.accountLabel")}{" "}
                <strong className="text-text-primary">{user.fullName || user.email}</strong> (ID #{user.id})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-11 h-11 inline-flex items-center justify-center rounded text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary shrink-0"
            aria-label={getAdminText(language, "common.close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-lg border border-status-danger-border bg-status-danger-bg text-status-danger text-xs leading-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {result ? (
          <div className="space-y-4 py-2">
            {result.emailSent === false ? (
              <div role="alert" className="p-3.5 rounded-lg border border-status-warning-border bg-status-warning-bg text-status-warning space-y-2 text-xs leading-4">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{getAdminText(language, "reissueDialog.emailFailTitle")}</span>
                </div>
                <p>
                  {result.warning || getAdminText(language, "reissueDialog.emailFailFallback")}
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg border border-status-success-border bg-status-success-bg text-status-success space-y-2 text-xs leading-4">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle className="w-4 h-4" />
                  <span>{getAdminText(language, "reissueDialog.successTitle")}</span>
                </div>
                <p>
                  {getAdminText(language, "reissueDialog.successDesc")}{" "}
                  <strong className="font-mono">{user.email}</strong>.
                </p>
              </div>
            )}

            <div className="p-3 rounded-lg bg-bg-secondary text-xs text-text-secondary space-y-1">
              <p>{getAdminText(language, "reissueDialog.bulletRevoked")}</p>
              <p>{getAdminText(language, "reissueDialog.bulletForceChange")}</p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 inline-flex items-center justify-center rounded px-4 py-2 text-sm font-semibold bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                {getAdminText(language, "reissueDialog.closeDone")}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-status-warning-border bg-status-warning-bg p-3.5 text-xs text-status-warning leading-4 space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                <Mail className="w-4 h-4 text-status-warning" />
                <span>{getAdminText(language, "reissueDialog.processTitle")}</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-text-primary">
                <li>{getAdminText(language, "reissueDialog.step1")}</li>
                <li>{getAdminText(language, "reissueDialog.step2")}</li>
                <li>{getAdminText(language, "reissueDialog.step3")}</li>
              </ul>
            </div>

            <p className="text-xs text-text-secondary">
              {getAdminText(language, "reissueDialog.confirmQuestion", {
                name: user.fullName || user.email,
              })}
            </p>

            <div className="pt-2 border-t border-border-color/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="min-h-11 inline-flex items-center justify-center rounded px-4 py-2 text-sm font-medium border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              >
                {getAdminText(language, "common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleReissue}
                disabled={loading}
                className="min-h-11 inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-semibold bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
              >
                {loading && <LoaderCircle className="w-4 h-4 animate-spin" />}
                <span>{getAdminText(language, "reissueDialog.submit")}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
