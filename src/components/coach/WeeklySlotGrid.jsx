import React, { useEffect, useState, useMemo } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { memberPortalApi } from "../../api/memberPortalApi"
import { formatTime } from "../../utils/datetime"
import { Check } from "lucide-react"

export const WEEKDAYS = [
  { key: "MONDAY", shortLegacy: "MON", labelKey: "scheduleDayMon" },
  { key: "TUESDAY", shortLegacy: "TUE", labelKey: "scheduleDayTue" },
  { key: "WEDNESDAY", shortLegacy: "WED", labelKey: "scheduleDayWed" },
  { key: "THURSDAY", shortLegacy: "THU", labelKey: "scheduleDayThu" },
  { key: "FRIDAY", shortLegacy: "FRI", labelKey: "scheduleDayFri" },
  { key: "SATURDAY", shortLegacy: "SAT", labelKey: "scheduleDaySat" },
  { key: "SUNDAY", shortLegacy: "SUN", labelKey: "scheduleDaySun" },
]

export const DEFAULT_TIME_SLOTS = [
  { slotNumber: 1, name: "Ca 1", startTime: "06:00:00", endTime: "07:30:00", outdoorAllowed: true },
  { slotNumber: 2, name: "Ca 2", startTime: "07:30:00", endTime: "09:00:00", outdoorAllowed: true },
  { slotNumber: 3, name: "Ca 3", startTime: "09:00:00", endTime: "10:30:00", outdoorAllowed: true },
  { slotNumber: 4, name: "Ca 4", startTime: "10:30:00", endTime: "12:00:00", outdoorAllowed: false },
  { slotNumber: 5, name: "Ca 5", startTime: "13:30:00", endTime: "15:00:00", outdoorAllowed: false },
  { slotNumber: 6, name: "Ca 6", startTime: "15:00:00", endTime: "16:30:00", outdoorAllowed: true },
  { slotNumber: 7, name: "Ca 7", startTime: "16:30:00", endTime: "18:00:00", outdoorAllowed: true },
  { slotNumber: 8, name: "Ca 8", startTime: "18:00:00", endTime: "19:30:00", outdoorAllowed: true },
]

const LEGACY_DAY_MAP = {
  MON: "MONDAY",
  TUE: "TUESDAY",
  WED: "WEDNESDAY",
  THU: "THURSDAY",
  FRI: "FRIDAY",
  SAT: "SATURDAY",
  SUN: "SUNDAY",
}

/**
 * Chuẩn hóa chuỗi slot về định dạng "MONDAY:5".
 * Hỗ trợ dữ liệu chuẩn "MONDAY:5" và dữ liệu legacy "MON_SLOT_1" / "MON:1".
 */
export function normalizeWeeklySlotKey(raw) {
  if (!raw) return null
  const str = String(raw).trim().toUpperCase()
  const colonMatch = str.match(/^([A-Z]+):(\d+)$/)
  if (colonMatch) {
    const dayRaw = colonMatch[1]
    const slotNum = Number(colonMatch[2])
    const fullDay = LEGACY_DAY_MAP[dayRaw] || dayRaw
    if (WEEKDAYS.some((d) => d.key === fullDay) && slotNum >= 1 && slotNum <= 8) {
      return `${fullDay}:${slotNum}`
    }
  }
  const legacyMatch = str.match(/^([A-Z]+)_SLOT_(\d+)$/)
  if (legacyMatch) {
    const dayRaw = legacyMatch[1]
    const slotNum = Number(legacyMatch[2])
    const fullDay = LEGACY_DAY_MAP[dayRaw] || dayRaw
    if (WEEKDAYS.some((d) => d.key === fullDay) && slotNum >= 1 && slotNum <= 8) {
      return `${fullDay}:${slotNum}`
    }
  }
  return null
}

export function normalizeWeeklySlotsArray(arr) {
  if (!Array.isArray(arr)) return []
  const set = new Set()
  arr.forEach((item) => {
    const normalized = normalizeWeeklySlotKey(item)
    if (normalized) set.add(normalized)
  })
  return Array.from(set)
}

export function WeeklySlotGrid({ selectedSlots = [], onChange, disabled = false }) {
  const { apiEnabled, t } = useSCMS()
  const [timeSlots, setTimeSlots] = useState(DEFAULT_TIME_SLOTS)

  useEffect(() => {
    let active = true
    if (apiEnabled) {
      memberPortalApi
        .getTimeSlots()
        .then((list) => {
          if (!active) return
          if (Array.isArray(list) && list.length > 0) {
            const sorted = [...list].sort(
              (a, b) => Number(a.slotNumber || 0) - Number(b.slotNumber || 0),
            )
            setTimeSlots(sorted)
          }
        })
        .catch(() => {})
    }
    return () => {
      active = false
    }
  }, [apiEnabled])

  const normalizedSet = useMemo(
    () => new Set(normalizeWeeklySlotsArray(selectedSlots)),
    [selectedSlots],
  )

  const toggleCell = (dayKey, slotNumber) => {
    if (disabled || !onChange) return
    const key = `${dayKey}:${slotNumber}`
    const next = new Set(normalizedSet)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    onChange(Array.from(next))
  }

  const toggleDayColumn = (dayKey) => {
    if (disabled || !onChange) return
    const dayKeys = timeSlots.map((s) => `${dayKey}:${s.slotNumber}`)
    const allSelected = dayKeys.every((k) => normalizedSet.has(k))
    const next = new Set(normalizedSet)
    dayKeys.forEach((k) => {
      if (allSelected) next.delete(k)
      else next.add(k)
    })
    onChange(Array.from(next))
  }

  const toggleSlotRow = (slotNumber) => {
    if (disabled || !onChange) return
    const rowKeys = WEEKDAYS.map((d) => `${d.key}:${slotNumber}`)
    const allSelected = rowKeys.every((k) => normalizedSet.has(k))
    const next = new Set(normalizedSet)
    rowKeys.forEach((k) => {
      if (allSelected) next.delete(k)
      else next.add(k)
    })
    onChange(Array.from(next))
  }

  return (
    <div className="space-y-2">
      <div>
        <h4 className="text-sm leading-5 font-semibold text-text-primary">
          {t("coachSlotGridTitle")}
        </h4>
        <p className="text-xs leading-4 font-medium text-text-secondary">
          {t("coachSlotGridSubtitle")}
        </p>
      </div>

      <div className="w-full overflow-x-auto rounded-lg border border-border-color bg-bg-card">
        <table className="w-full min-w-[640px] text-left text-sm border-collapse">
          <thead className="bg-bg-secondary text-xs font-semibold text-text-secondary">
            <tr>
              <th className="px-4 py-3 text-left align-middle border-r border-border-color w-36">
                Ca / Thứ
              </th>
              {WEEKDAYS.map((day) => {
                const dayKeys = timeSlots.map((s) => `${day.key}:${s.slotNumber}`)
                const allDaySelected =
                  dayKeys.length > 0 && dayKeys.every((k) => normalizedSet.has(k))
                return (
                  <th
                    key={day.key}
                    className="px-2 py-3 text-center align-middle border-r last:border-r-0 border-border-color"
                  >
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleDayColumn(day.key)}
                      title={t("coachSelectAllDay")}
                      className={`w-full min-w-11 min-h-11 py-1.5 px-2 rounded text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
                        allDaySelected
                          ? "bg-brand-primary text-text-inverse"
                          : "text-text-secondary hover:bg-bg-card hover:text-text-primary"
                      }`}
                    >
                      {t(day.labelKey)}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-color">
            {timeSlots.map((slot) => {
              const slotNum = slot.slotNumber
              const rowKeys = WEEKDAYS.map((d) => `${d.key}:${slotNum}`)
              const allRowSelected =
                rowKeys.length > 0 && rowKeys.every((k) => normalizedSet.has(k))
              return (
                <tr key={slotNum} className="transition-colors hover:bg-bg-secondary/70">
                  <td className="px-4 py-3 align-middle text-sm leading-5 text-text-primary border-r border-border-color bg-bg-secondary/50">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleSlotRow(slotNum)}
                      title={t("coachSelectAllSlot")}
                      className={`w-full min-h-11 text-left px-2 py-1 rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary flex flex-col justify-center ${
                        allRowSelected
                          ? "bg-status-info-bg text-status-info font-semibold ring-1 ring-inset ring-status-info-border"
                          : "text-text-primary hover:bg-bg-secondary"
                      }`}
                    >
                      <div className="font-semibold text-sm leading-5">
                        {slot.name || `Ca ${slotNum}`}
                      </div>
                      <div className="text-xs leading-4 font-medium font-mono text-text-secondary">
                        {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                      </div>
                    </button>
                  </td>
                  {WEEKDAYS.map((day) => {
                    const cellKey = `${day.key}:${slotNum}`
                    const isSelected = normalizedSet.has(cellKey)
                    return (
                      <td
                        key={cellKey}
                        className="px-2 py-3 align-middle text-sm leading-5 text-text-primary text-center border-r last:border-r-0 border-border-color"
                      >
                        <button
                          type="button"
                          disabled={disabled}
                          aria-label={`${t(day.labelKey)} ${slot.name || `Ca ${slotNum}`}`}
                          aria-pressed={isSelected}
                          onClick={() => toggleCell(day.key, slotNum)}
                          className={`w-full min-w-11 min-h-11 rounded border flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 ${
                            isSelected
                              ? "bg-brand-primary border-brand-primary text-text-inverse font-semibold"
                              : "bg-bg-secondary hover:bg-bg-card border-border-color text-text-muted"
                          }`}
                        >
                          {isSelected ? <Check className="w-4 h-4" /> : "—"}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
