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
        <h4 className="text-xs font-bold text-slate-900">
          {t("coachSlotGridTitle")}
        </h4>
        <p className="text-[11px] text-slate-500">
          {t("coachSlotGridSubtitle")}
        </p>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
        <table className="w-full text-xs border-collapse min-w-[640px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-2.5 text-left font-bold text-slate-700 border-r border-slate-200 w-36">
                Ca / Thứ
              </th>
              {WEEKDAYS.map((day) => {
                const dayKeys = timeSlots.map((s) => `${day.key}:${s.slotNumber}`)
                const allDaySelected =
                  dayKeys.length > 0 && dayKeys.every((k) => normalizedSet.has(k))
                return (
                  <th
                    key={day.key}
                    className="p-2 text-center border-r last:border-r-0 border-slate-200"
                  >
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleDayColumn(day.key)}
                      title={t("coachSelectAllDay")}
                      className={`w-full py-1 px-1.5 rounded font-bold transition-colors cursor-pointer ${
                        allDaySelected
                          ? "bg-blue-700 text-white"
                          : "text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {t(day.labelKey)}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {timeSlots.map((slot) => {
              const slotNum = slot.slotNumber
              const rowKeys = WEEKDAYS.map((d) => `${d.key}:${slotNum}`)
              const allRowSelected =
                rowKeys.length > 0 && rowKeys.every((k) => normalizedSet.has(k))
              return (
                <tr key={slotNum} className="hover:bg-slate-50/60">
                  <td className="p-2 border-r border-slate-200 bg-slate-50/50">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleSlotRow(slotNum)}
                      title={t("coachSelectAllSlot")}
                      className={`w-full text-left px-2 py-1 rounded transition-colors cursor-pointer ${
                        allRowSelected
                          ? "bg-blue-50 text-blue-900 font-bold"
                          : "text-slate-800 hover:bg-slate-100"
                      }`}
                    >
                      <div className="font-bold">
                        {slot.name || `Ca ${slotNum}`}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
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
                        className="p-1.5 text-center border-r last:border-r-0 border-slate-200"
                      >
                        <button
                          type="button"
                          disabled={disabled}
                          aria-label={`${t(day.labelKey)} ${slot.name || `Ca ${slotNum}`}`}
                          aria-pressed={isSelected}
                          onClick={() => toggleCell(day.key, slotNum)}
                          className={`w-full min-h-[44px] rounded border flex items-center justify-center transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-blue-600 border-blue-700 text-white font-bold shadow-2xs"
                              : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-400"
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
