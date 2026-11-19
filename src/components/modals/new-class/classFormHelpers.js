import { VI_WEEKDAYS_FULL } from "./classFormConstants"
import { parseLocalDate } from "../../../api/normalClassCreation.js"

export function getSportCapacity(sport, room, apiEnabled) {
  const sportCapacity = Number(sport?.defaultCapacity) || 8
  const roomCapacity = Number(room?.capacity)
  const limits = [sportCapacity]

  if (Number.isInteger(roomCapacity) && roomCapacity > 0) {
    limits.push(roomCapacity)
  }
  if (apiEnabled) limits.push(15)

  return Math.max(1, Math.min(...limits))
}

export function formatViDate(dateInput) {
  if (!dateInput) return "—"
  let yyyy, mm, dd
  if (typeof dateInput === "string" && dateInput.includes("-")) {
    const parts = dateInput.split("-")
    yyyy = parts[0]
    mm = parts[1]
    dd = parts[2]
  } else {
    const d = new Date(dateInput)
    if (isNaN(d.getTime())) return String(dateInput)
    dd = String(d.getDate()).padStart(2, "0")
    mm = String(d.getMonth() + 1).padStart(2, "0")
    yyyy = d.getFullYear()
  }
  return `${dd}/${mm}/${yyyy}`
}

export function formatViDateWithWeekday(dateInput) {
  if (!dateInput) return "—"
  const d = dateInput instanceof Date ? dateInput : parseLocalDate(dateInput)
  if (!d || isNaN(d.getTime())) return dateInput
  const dayName = VI_WEEKDAYS_FULL[d.getDay()]
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${dayName} ${dd}/${mm}/${yyyy}`
}

export function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return "0"
  return Number(num).toLocaleString("vi-VN")
}

export function getDurationLabel(startTime, endTime) {
  if (!startTime || !endTime) return ""
  const [sh, sm] = startTime.split(":").map(Number)
  const [eh, em] = endTime.split(":").map(Number)
  let totalMin = eh * 60 + em - (sh * 60 + sm)
  if (totalMin <= 0) totalMin += 24 * 60
  const hours = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  if (mins === 0) return `${hours} giờ`
  if (hours === 0) return `${mins} phút`
  return `${hours} giờ ${mins} phút`
}

export function getNextValidUpcomingDate(selectedDays, startTime = "06:00") {
  const now = new Date()
  const [sh, sm] = (startTime || "06:00").split(":").map(Number)
  const cur = new Date()

  for (let i = 0; i < 14; i++) {
    const dayOfWeek = cur.getDay()
    if (selectedDays.includes(dayOfWeek)) {
      const sessionStart = new Date(
        cur.getFullYear(),
        cur.getMonth(),
        cur.getDate(),
        sh,
        sm,
        0,
      )
      if (sessionStart > now) {
        const yyyy = cur.getFullYear()
        const mm = String(cur.getMonth() + 1).padStart(2, "0")
        const dd = String(cur.getDate()).padStart(2, "0")
        return `${yyyy}-${mm}-${dd}`
      }
    }
    cur.setDate(cur.getDate() + 1)
  }
  return cur.toISOString().split("T")[0]
}

export function generateProjectedSessions(
  startDate,
  selectedDays,
  count,
  startTime,
  endTime,
) {
  if (!startDate || !selectedDays.length || count <= 0) return []
  const sessions = []
  const cur = new Date(startDate)
  if (isNaN(cur.getTime())) return []

  for (let i = 0; i < 365 && sessions.length < count; i++) {
    if (selectedDays.includes(cur.getDay())) {
      const dateStr = cur.toISOString().split("T")[0]
      sessions.push({
        index: sessions.length + 1,
        dateStr,
        formattedDate: formatViDateWithWeekday(dateStr),
        time: `${startTime} - ${endTime}`,
      })
    }
    cur.setDate(cur.getDate() + 1)
  }
  return sessions
}
