import { useState, useEffect, useMemo, useRef } from "react"
import { Calendar } from "lucide-react"
import { formatViDate } from "./classFormHelpers"

// -------------------------------------------------------------
// Component DatePicker tự dựng cố định dd/MM/yyyy không phụ thuộc OS locale
// -------------------------------------------------------------
export function DatePicker({ value, onChange, min, error }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const dateObj = useMemo(() => {
    if (!value) return new Date()
    const d = new Date(value)
    return isNaN(d.getTime()) ? new Date() : d
  }, [value])

  const [viewYear, setViewYear] = useState(() => dateObj.getFullYear())
  const [viewMonth, setViewMonth] = useState(() => dateObj.getMonth())

  useEffect(() => {
    if (value) {
      const d = new Date(value)
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear())
        setViewMonth(d.getMonth())
      }
    }
  }, [value])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const displayStr = useMemo(() => formatViDate(value), [value])

  const monthNames = [
    "Tháng 1",
    "Tháng 2",
    "Tháng 3",
    "Tháng 4",
    "Tháng 5",
    "Tháng 6",
    "Tháng 7",
    "Tháng 8",
    "Tháng 9",
    "Tháng 10",
    "Tháng 11",
    "Tháng 12",
  ]

  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate()
  }, [viewYear, viewMonth])

  const firstDayOfWeek = useMemo(() => {
    const day = new Date(viewYear, viewMonth, 1).getDay()
    return day === 0 ? 6 : day - 1 // Mon=0 .. Sun=6
  }, [viewYear, viewMonth])

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const handleSelectDay = (day) => {
    const yyyy = viewYear
    const mm = String(viewMonth + 1).padStart(2, "0")
    const dd = String(day).padStart(2, "0")
    onChange(`${yyyy}-${mm}-${dd}`)
    setIsOpen(false)
  }

  const minDateObj = useMemo(() => {
    if (!min) return null
    const [y, m, d] = min.split("-").map(Number)
    return new Date(y, m - 1, d)
  }, [min])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-11 px-3.5 bg-white border rounded-xl flex items-center justify-between text-sm transition-colors cursor-pointer text-left ${
          error
            ? "border-orange-500 bg-orange-50/20"
            : "border-stone-300 focus:border-stone-800 focus:ring-1 focus:ring-stone-800"
        }`}
      >
        <span className="font-normal text-stone-900">{displayStr}</span>
        <Calendar className="w-4 h-4 text-stone-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 bg-white border border-stone-200 rounded-xl shadow-xl z-40 p-3 w-64 text-xs">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-stone-100">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-stone-100 rounded text-stone-600 cursor-pointer"
            >
              &larr;
            </button>
            <span className="font-semibold text-stone-900">
              {monthNames[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-stone-100 rounded text-stone-600 cursor-pointer"
            >
              &rarr;
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center font-medium text-stone-400 mb-1 text-[11px]">
            <span>T2</span>
            <span>T3</span>
            <span>T4</span>
            <span>T5</span>
            <span>T6</span>
            <span>T7</span>
            <span>CN</span>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const thisDate = new Date(viewYear, viewMonth, day)
              const isDisabled = minDateObj && thisDate < minDateObj

              const yyyy = viewYear
              const mm = String(viewMonth + 1).padStart(2, "0")
              const dd = String(day).padStart(2, "0")
              const isSelected = value === `${yyyy}-${mm}-${dd}`

              return (
                <button
                  key={day}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelectDay(day)}
                  className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-stone-900 text-white font-medium"
                      : isDisabled
                        ? "text-stone-300 cursor-not-allowed"
                        : "hover:bg-stone-100 text-stone-700"
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
