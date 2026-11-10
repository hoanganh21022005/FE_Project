import React, { useState, useMemo } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { formatDate } from "../../utils/datetime"
import { CalendarOff, Plus, X, AlertTriangle } from "lucide-react"

export function DaysOffPicker({
  daysOff = [],
  onChange,
  scheduledSessions = [],
  disabled = false,
}) {
  const { t, showToast } = useSCMS()
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [dateInput, setDateInput] = useState("")

  const normalizedDaysOff = useMemo(() => {
    if (!Array.isArray(daysOff)) return []
    const set = new Set()
    daysOff.forEach((raw) => {
      const s = String(raw || "").trim().slice(0, 10)
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        set.add(s)
      }
    })
    return Array.from(set).sort()
  }, [daysOff])

  const conflictingCount = useMemo(() => {
    if (normalizedDaysOff.length === 0 || !Array.isArray(scheduledSessions)) {
      return 0
    }
    const daySet = new Set(normalizedDaysOff)
    return scheduledSessions.filter((s) => {
      const status = String(s?.status || "").toLowerCase()
      const dateStr = String(s?.sessionDate || "").slice(0, 10)
      return status === "scheduled" && daySet.has(dateStr)
    }).length
  }, [normalizedDaysOff, scheduledSessions])

  const handleAddDayOff = () => {
    if (!dateInput || !onChange) return
    const clean = dateInput.slice(0, 10)
    if (clean < todayStr) {
      showToast(t("coachDaysOffPastError"), "warning")
      return
    }
    if (!normalizedDaysOff.includes(clean)) {
      onChange([...normalizedDaysOff, clean].sort())
    }
    setDateInput("")
  }

  const handleRemoveDayOff = (dayStr) => {
    if (disabled || !onChange) return
    onChange(normalizedDaysOff.filter((d) => d !== dayStr))
  }

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm leading-5 font-semibold text-text-primary flex items-center gap-1.5">
          <CalendarOff className="w-4 h-4 text-text-secondary" />
          <span>{t("coachDaysOffTitle")}</span>
        </h4>
        <p className="text-xs leading-4 font-medium text-text-secondary">
          {t("coachDaysOffSubtitle")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          min={todayStr}
          disabled={disabled}
          value={dateInput}
          onChange={(e) => setDateInput(e.target.value)}
          className="h-9 w-full sm:w-48 rounded border border-border-color bg-bg-card px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted font-mono"
        />
        {dateInput && (
          <span className="text-xs leading-4 font-medium font-mono text-text-secondary">
            ({formatDate(dateInput)})
          </span>
        )}
        <button
          type="button"
          disabled={disabled || !dateInput}
          onClick={handleAddDayOff}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded px-3.5 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t("coachDaysOffAddBtn")}</span>
        </button>
      </div>

      {conflictingCount > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm leading-5 text-status-warning flex items-center gap-2 font-semibold">
          <AlertTriangle className="w-4 h-4 text-status-warning shrink-0" />
          <span>
            {t("coachDaysOffConflictWarn").replace(
              "{count}",
              String(conflictingCount),
            )}
          </span>
        </div>
      )}

      {normalizedDaysOff.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {normalizedDaysOff.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-bg-secondary text-text-primary ring-1 ring-inset ring-border-color font-mono"
            >
              <span>{formatDate(d)}</span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${formatDate(d)}`}
                onClick={() => handleRemoveDayOff(d)}
                className="text-text-secondary hover:text-status-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
