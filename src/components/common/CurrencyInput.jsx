import React, { useRef, useLayoutEffect, useState } from "react"
import { X } from "lucide-react"

/**
 * CurrencyInput - High-precision Vietnamese currency input with:
 * - Real-time thousand separators (vi-VN: dots like 20.000, 1.000.000)
 * - Auto-select all text on both click and focus (never prepends/appends by accident)
 * - Support for shorthand suffixes like 'k' (20k -> 20.000) and 'tr' / 'm' (1tr -> 1.000.000)
 * - Smart cursor preservation from the right edge
 * - One-click clear button
 * - Optional quick preset chips
 */
export function CurrencyInput({
  id = "currency-input",
  value = 0,
  onChange,
  disabled = false,
  placeholder = "0",
  suffix = "đ",
  className = "",
  presets = [],
}) {
  const inputRef = useRef(null)
  const cursorRef = useRef(null)

  // Format number to Vietnamese thousand-separated string
  const formatDisplay = (num) => {
    if (num === null || num === undefined || isNaN(num) || num === 0) return ""
    return Number(num).toLocaleString("vi-VN")
  }

  // Keep local display string in sync with value prop
  const [displayValue, setDisplayValue] = useState(() => formatDisplay(value))

  // Sync with incoming external prop changes
  React.useEffect(() => {
    setDisplayValue(formatDisplay(value))
  }, [value])

  // Restore cursor position after DOM re-renders with new thousand separators
  useLayoutEffect(() => {
    if (cursorRef.current !== null && inputRef.current) {
      const { posFromRight } = cursorRef.current
      const newPos = Math.max(0, inputRef.current.value.length - posFromRight)
      try {
        inputRef.current.setSelectionRange(newPos, newPos)
      } catch (e) {}
      cursorRef.current = null
    }
  }, [displayValue])

  const handleChange = (e) => {
    const el = e.target
    const currentCursor = el.selectionEnd || 0
    const posFromRight = el.value.length - currentCursor

    const trimmed = el.value.trim().toLowerCase()
    let numeric = 0

    // Check for shorthand suffixes (e.g. 20k -> 20.000, 2tr -> 2.000.000)
    if (trimmed.endsWith("k")) {
      const digits = trimmed.slice(0, -1).replace(/[^\d]/g, "")
      numeric = digits ? Number(digits) * 1000 : 0
    } else if (trimmed.endsWith("tr") || trimmed.endsWith("m")) {
      const digits = trimmed.slice(0, -2).replace(/[^\d]/g, "")
      numeric = digits ? Number(digits) * 1000000 : 0
    } else {
      // Strip dots, commas, spaces and any non-digit character
      const rawDigits = el.value.replace(/[^\d]/g, "")
      numeric = rawDigits ? Number(rawDigits) : 0
    }

    cursorRef.current = { posFromRight }
    const formatted = formatDisplay(numeric)
    setDisplayValue(formatted)

    if (onChange) {
      onChange(numeric)
    }
  }

  const handleKeyDown = (e) => {
    if (disabled) return
    const el = e.target

    // Smart Backspace handling when cursor is immediately after a thousand dot
    if (e.key === "Backspace") {
      const cur = el.selectionStart
      if (cur === el.selectionEnd && cur > 0) {
        const charBefore = el.value[cur - 1]
        if (charBefore === ".") {
          e.preventDefault()
          // Delete both the dot and the digit before it
          const before = el.value.slice(0, Math.max(0, cur - 2))
          const after = el.value.slice(cur)
          const combined = before + after
          const rawDigits = combined.replace(/[^\d]/g, "")
          const numeric = rawDigits ? Number(rawDigits) : 0
          const formatted = formatDisplay(numeric)

          const posFromRight = el.value.length - cur
          cursorRef.current = { posFromRight }
          setDisplayValue(formatted)
          if (onChange) onChange(numeric)
        }
      }
    }
  }

  const handleFocus = (e) => {
    // Auto-select text on focus so typing replaces immediately
    e.target.select()
  }

  const handleClick = (e) => {
    // If user clicked without dragging, select all text so typing replaces the old number
    if (e.target.selectionStart === e.target.selectionEnd) {
      e.target.select()
    }
  }

  const handleClear = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDisplayValue("")
    if (onChange) onChange(0)
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  const hasValue = Boolean(value && value > 0)

  return (
    <div className="space-y-1.5 w-full">
      {/* Input Group Container */}
      <div
        className={`flex items-stretch w-full h-11 bg-white border rounded-xl overflow-hidden transition-all ${
          disabled
            ? "bg-stone-50/80 border-stone-200 text-stone-400 cursor-not-allowed"
            : "border-stone-300 focus-within:border-stone-800 focus-within:ring-1 focus-within:ring-stone-800"
        } ${className}`}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          id={id}
          disabled={disabled}
          value={disabled ? "0" : displayValue}
          placeholder={placeholder}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onClick={handleClick}
          className="flex-1 h-full px-3.5 text-sm font-semibold text-stone-900 bg-transparent border-0 focus:outline-none focus:ring-0 tabular-nums disabled:cursor-not-allowed disabled:text-stone-400"
        />

        {/* Clear Button (when value exists and not disabled) */}
        {!disabled && hasValue && (
          <button
            type="button"
            onClick={handleClear}
            className="px-2 text-stone-400 hover:text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
            title="Xóa nhanh về 0"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Suffix Add-on */}
        <div className="h-full px-3.5 bg-stone-100/90 border-l border-stone-200 text-stone-600 text-xs font-semibold flex items-center justify-center select-none shrink-0 tracking-wide">
          {suffix}
        </div>
      </div>

      {/* Preset Chips */}
      {!disabled && Array.isArray(presets) && presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <span className="text-[11px] text-stone-400 font-medium">Gợi ý:</span>
          {presets.map((presetVal) => (
            <button
              key={presetVal}
              type="button"
              onClick={() => {
                setDisplayValue(formatDisplay(presetVal))
                if (onChange) onChange(presetVal)
              }}
              className={`px-2 py-0.5 text-xs rounded-md border transition-all cursor-pointer select-none ${
                value === presetVal
                  ? "bg-stone-900 text-white border-stone-900 font-medium"
                  : "bg-stone-50 hover:bg-stone-100 text-stone-600 border-stone-200 hover:border-stone-300"
              }`}
            >
              {presetVal.toLocaleString("vi-VN")} đ
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
export default CurrencyInput
