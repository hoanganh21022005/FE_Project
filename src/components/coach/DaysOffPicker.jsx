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
        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
          <CalendarOff className="w-3.5 h-3.5 text-slate-600" />
          <span>{t("coachDaysOffTitle")}</span>
        </h4>
        <p className="text-[11px] text-slate-500">
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
          className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900"
        />
        {dateInput && (
          <span className="text-[11px] font-mono text-slate-500">
            ({formatDate(dateInput)})
          </span>
        )}
        <button
          type="button"
          disabled={disabled || !dateInput}
          onClick={handleAddDayOff}
          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded text-xs font-bold flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t("coachDaysOffAddBtn")}</span>
        </button>
      </div>

      {conflictingCount > 0 && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-center gap-2 font-semibold">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
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
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-300 rounded-full text-xs font-mono font-bold text-slate-800"
            >
              <span>{formatDate(d)}</span>
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${formatDate(d)}`}
                onClick={() => handleRemoveDayOff(d)}
                className="text-slate-500 hover:text-rose-600 cursor-pointer"
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
