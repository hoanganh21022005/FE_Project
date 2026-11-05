import { useState, useEffect, useRef } from "react"
import { httpClient } from "../../../api/httpClient.js"

export function parseTimeToMinutes(t) {
  if (!t || typeof t !== "string" || !t.includes(":")) return null
  const parts = t.trim().split(":")
  const hh = Number(parts[0])
  const mm = Number(parts[1])
  if (isNaN(hh) || isNaN(mm)) return null
  return hh * 60 + mm
}

/**
 * Normalize date string to YYYY-MM-DD
 */
export function normalizeDateStr(d) {
  if (!d) return null
  if (typeof d === "string") {
    const s = d.split("T")[0].trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : s
  }
  if (d instanceof Date && !isNaN(d.getTime())) {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  }
  return null
}

/**
 * Format YYYY-MM-DD to DD/MM/YYYY for Vietnamese UI
 */
export function formatDateVi(dStr) {
  if (!dStr) return ""
  const clean = String(dStr).split("T")[0].trim()
  if (clean.includes("-")) {
    const parts = clean.split("-")
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
  }
  return clean
}

/**
 * Extract actual sessions array from a class object
 */
export function getClassSessions(cls) {
  if (!cls) return []
  if (Array.isArray(cls.sessions)) return cls.sessions
  if (Array.isArray(cls.scheduleSessions)) return cls.scheduleSessions
  if (Array.isArray(cls.sessionList)) return cls.sessionList
  return []
}

/**
 * Check if a class has sufficient and valid actual sessions data
 */
export function hasValidScheduleData(cls) {
  if (!cls) return false
  const sessions = getClassSessions(cls)
  if (!sessions || sessions.length === 0) return false

  return sessions.some((s) => {
    if (!s || s.centerInvalidated === true) return false
    if (s.status && String(s.status).toLowerCase() === "cancelled") return false
    const d = normalizeDateStr(s.date || s.sessionDate)
    const start = parseTimeToMinutes(s.startTime)
    const end = parseTimeToMinutes(s.endTime)
    const hasCoach = Boolean(
      s.coachId || s.coachName || cls.coachId || cls.coachName,
    )
    const hasRoom = Boolean(
      s.roomId ||
        s.room ||
        s.roomName ||
        s.roomVi ||
        s.court ||
        cls.roomId ||
        cls.room ||
        cls.roomVi,
    )
    return Boolean(d && start !== null && end !== null && (hasCoach || hasRoom))
  })
}

/**
 * Check overlap between two actual sessions
 * - Different dates -> no conflict
 * - Touching boundaries (e.g. 09:00 - 09:00) -> no conflict
 * - Overlapping times (startA < endB && startB < endA) AND shared Coach or Room -> CONFLICT
 */
export function checkActualSessionOverlap(sessionA, sessionB, classA, classB) {
  if (!sessionA || !sessionB) return null
  if (sessionA.centerInvalidated === true || sessionB.centerInvalidated === true)
    return null
  if (sessionA.status && String(sessionA.status).toLowerCase() === "cancelled")
    return null
  if (sessionB.status && String(sessionB.status).toLowerCase() === "cancelled")
    return null

  // 1. Date check: Different dates -> no conflict
  const dateA = normalizeDateStr(sessionA.date || sessionA.sessionDate)
  const dateB = normalizeDateStr(sessionB.date || sessionB.sessionDate)
  if (!dateA || !dateB || dateA !== dateB) {
    return null
  }

  // 2. Time check: Overlap requires startA < endB && startB < endA
  // Touching boundaries (e.g. endA === startB or endB === startA) is NOT a conflict
  const startA = parseTimeToMinutes(sessionA.startTime)
  const endA = parseTimeToMinutes(sessionA.endTime)
  const startB = parseTimeToMinutes(sessionB.startTime)
  const endB = parseTimeToMinutes(sessionB.endTime)

  if (startA === null || endA === null || startB === null || endB === null) {
    return null
  }

  const timeOverlaps = startA < endB && startB < endA
  if (!timeOverlaps) {
    return null
  }

  // 3. Personnel / Facility match
  const coachIdA = sessionA.coachId ?? classA?.coachId ?? null
  const coachIdB = sessionB.coachId ?? classB?.coachId ?? null
  const coachNameA = (
    sessionA.coachName ??
    classA?.coachName ??
    ""
  )
    .trim()
    .toLowerCase()
  const coachNameB = (
    sessionB.coachName ??
    classB?.coachName ??
    ""
  )
    .trim()
    .toLowerCase()

  const coachConflict = coachIdA != null && coachIdB != null
    ? String(coachIdA) === String(coachIdB)
    : Boolean(coachNameA && coachNameA === coachNameB)

  const roomIdA = sessionA.roomId ?? classA?.roomId ?? null
  const roomIdB = sessionB.roomId ?? classB?.roomId ?? null
  const roomNameA = (
    sessionA.roomName ||
    sessionA.room ||
    sessionA.court ||
    sessionA.roomVi ||
    classA?.roomVi ||
    classA?.room ||
    ""
  )
    .trim()
    .toLowerCase()
  const roomNameB = (
    sessionB.roomName ||
    sessionB.room ||
    sessionB.court ||
    sessionB.roomVi ||
    classB?.roomVi ||
    classB?.room ||
    ""
  )
    .trim()
    .toLowerCase()

  const roomConflict = roomIdA != null && roomIdB != null
    ? String(roomIdA) === String(roomIdB)
    : Boolean(roomNameA && roomNameA === roomNameB)

  if (!coachConflict && !roomConflict) {
    return null
  }

  const rawCoachName =
    sessionB.coachName ||
    classB?.coachName ||
    sessionA.coachName ||
    classA?.coachName ||
    "Huấn luyện viên"

  const rawRoomName =
    sessionB.roomName ||
    sessionB.room ||
    sessionB.court ||
    sessionB.roomVi ||
    classB?.roomVi ||
    classB?.room ||
    sessionA.roomName ||
    sessionA.room ||
    sessionA.court ||
    sessionA.roomVi ||
    classA?.roomVi ||
    classA?.room ||
    "Sân tập"

  return {
    date: dateA,
    startA: sessionA.startTime,
    endA: sessionA.endTime,
    startB: sessionB.startTime,
    endB: sessionB.endTime,
    coachConflict,
    roomConflict,
    coachName: rawCoachName,
    roomName: rawRoomName,
    sessionA,
    sessionB,
  }
}

/**
 * Build conflict notification stating the correct opposite class
 */
export function buildConflictNotification(targetClass, oppositeClass, overlap) {
  const oppName =
    oppositeClass.nameVi ||
    oppositeClass.name ||
    oppositeClass.code ||
    `Lớp #${oppositeClass.id}`
  const coach = overlap.coachName
  const room = overlap.roomName
  const dateStr = formatDateVi(overlap.date)
  const oppTimeStr = `${overlap.startB || overlap.startA} - ${overlap.endB || overlap.endA}`

  let message = ""
  let tooltip = ""

  if (overlap.coachConflict && overlap.roomConflict) {
    message = `⚠️ Trùng lịch! HLV ${coach} và ${room} đã có lịch lớp "${oppName}" vào ngày ${dateStr} (${oppTimeStr}).`
    tooltip = `Phát hiện trùng lịch Sân tập và Huấn luyện viên với lớp ${oppName} (${dateStr})`
  } else if (overlap.coachConflict) {
    message = `⚠️ Trùng lịch! HLV ${coach} đã có lịch dạy lớp "${oppName}" vào ngày ${dateStr} (${oppTimeStr}).`
    tooltip = `Phát hiện trùng lịch Huấn luyện viên (${coach}) với lớp ${oppName} (${dateStr})`
  } else {
    message = `⚠️ Trùng sân! ${room} đã có lớp "${oppName}" sử dụng vào ngày ${dateStr} (${oppTimeStr}).`
    tooltip = `Phát hiện trùng lịch Sân tập (${room}) với lớp ${oppName} (${dateStr})`
  }

  return { message, tooltip }
}

export function normalizeWeekdays(days, defaultDays = [1, 3, 5]) {
  if (!days || !Array.isArray(days) || days.length === 0) return defaultDays
  return days.map((d) => {
    if (typeof d === "number") return d
    const str = String(d).toUpperCase().trim()
    if (str === "T2") return 1
    if (str === "T3") return 2
    if (str === "T4") return 3
    if (str === "T5") return 4
    if (str === "T6") return 5
    if (str === "T7") return 6
    if (str === "CN") return 0
    const num = Number(str)
    return isNaN(num) ? 1 : num
  })
}

const WEEKDAY_NAMES = {
  1: "T2",
  2: "T3",
  3: "T4",
  4: "T5",
  5: "T6",
  6: "T7",
  0: "CN",
}

/**
 * Check if candidate class schedule conflicts with an existing class.
 */
export function checkSingleClassConflict(candidate, existing) {
  if (!candidate || !existing) return null
  if (
    candidate.id &&
    existing.id &&
    String(candidate.id) === String(existing.id)
  )
    return null
  if (existing.status === "cancelled" || candidate.status === "cancelled")
    return null

  // Check using actual sessions when both candidate and existing have them
  const candSessions = getClassSessions(candidate)
  const existSessions = getClassSessions(existing)

  if (candSessions.length > 0 && existSessions.length > 0) {
    for (const sA of candSessions) {
      for (const sB of existSessions) {
        const overlap = checkActualSessionOverlap(sA, sB, candidate, existing)
        if (overlap) {
          const { message, tooltip } = buildConflictNotification(
            candidate,
            existing,
            overlap,
          )
          return {
            hasConflict: true,
            hasMissingSchedule: false,
            isMissingSchedule: false,
            conflictCoach: overlap.coachConflict,
            conflictRoom: overlap.roomConflict,
            conflictingClass: existing,
            conflictingClassName:
              existing.nameVi || existing.name || existing.code,
            conflictDate: overlap.date,
            message,
            tooltip,
          }
        }
      }
    }
    return null
  }

  // 1. Personnel / Facility match
  const candCoachId = candidate.coachId
    ? String(candidate.coachId).replace(/\D/g, "")
    : ""
  const existCoachId = existing.coachId
    ? String(existing.coachId).replace(/\D/g, "")
    : ""
  const candCoachName = (candidate.coachName || "").trim().toLowerCase()
  const existCoachName = (existing.coachName || "").trim().toLowerCase()

  const coachConflict = Boolean(
    (candCoachId && existCoachId && candCoachId === existCoachId) ||
      (candCoachName &&
        existCoachName &&
        (candCoachName === existCoachName ||
          candCoachName.includes(existCoachName) ||
          existCoachName.includes(candCoachName))),
  )

  const candRoom = (
    candidate.roomVi ||
    candidate.room ||
    candidate.roomId ||
    ""
  )
    .trim()
    .toLowerCase()
  const existRoom = (existing.roomVi || existing.room || existing.roomId || "")
    .trim()
    .toLowerCase()

  const roomConflict = Boolean(
    candRoom &&
      existRoom &&
      (candRoom === existRoom ||
        candRoom.includes(existRoom) ||
        existRoom.includes(candRoom)),
  )

  if (!coachConflict && !roomConflict) {
    return null
  }

  // 2. Day of week overlap
  const candDays = normalizeWeekdays(candidate.selectedDays)
  const existDays = normalizeWeekdays(existing.selectedDays)
  const sharedDays = candDays.filter((d) => existDays.includes(d))

  if (sharedDays.length === 0) {
    return null
  }

  // 3. Time window overlap
  const cStart = parseTimeToMinutes(candidate.startTime || "06:00")
  const cEnd = parseTimeToMinutes(candidate.endTime || "07:30")
  const eStart = parseTimeToMinutes(existing.startTime || "06:00")
  const eEnd = parseTimeToMinutes(existing.endTime || "07:30")

  if (cStart === null || cEnd === null || eStart === null || eEnd === null) {
    return null
  }

  // Overlap condition: interval 1 overlaps interval 2
  const timeOverlaps = cStart < eEnd && cEnd > eStart
  if (!timeOverlaps) {
    return null
  }

  // Conflict confirmed!
  const sharedDaysStr = sharedDays.map((d) => WEEKDAY_NAMES[d] || d).join(", ")
  const existingName = existing.nameVi || existing.name || `Lớp #${existing.id}`
  const coachName =
    existing.coachName || candidate.coachName || "Huấn luyện viên"
  const roomName =
    existing.roomVi ||
    existing.room ||
    candidate.roomVi ||
    candidate.room ||
    "Sân tập"

  let message = ""
  let tooltip = ""

  if (coachConflict && roomConflict) {
    message = `⚠️ Trùng lịch! HLV ${coachName} và ${roomName} đã có lịch lớp "${existingName}" vào ${sharedDaysStr} (${existing.startTime || "06:00"} - ${existing.endTime || "07:30"}).`
    tooltip = `Phát hiện trùng lịch Sân tập và Huấn luyện viên với lớp ${existingName}`
  } else if (coachConflict) {
    message = `⚠️ Trùng lịch! HLV ${coachName} đã có lịch dạy lớp "${existingName}" vào ${sharedDaysStr} (${existing.startTime || "06:00"} - ${existing.endTime || "07:30"}).`
    tooltip = `Phát hiện trùng lịch Huấn luyện viên (${coachName}) với lớp ${existingName}`
  } else {
    message = `⚠️ Trùng sân! ${roomName} đã có lớp "${existingName}" sử dụng vào ${sharedDaysStr} (${existing.startTime || "06:00"} - ${existing.endTime || "07:30"}).`
    tooltip = `Phát hiện trùng lịch Sân tập (${roomName}) với lớp ${existingName}`
  }

  return {
    hasConflict: true,
    conflictCoach: coachConflict,
    conflictRoom: roomConflict,
    conflictingClass: existing,
    sharedDays,
    sharedDaysStr,
    message,
    tooltip,
  }
}

/**
 * Compute conflict map for all classes in a list.
 * Returns { [classId]: conflictInfo }
 */
export function computeAllClassConflicts(classes = [], sessions) {
  const result = {}
  if (!Array.isArray(classes)) return result

  if (sessions) {
    const sessionsByClass = new Map()
    for (const session of sessions) {
      if (session?.classId == null) continue
      const key = String(session.classId)
      if (!sessionsByClass.has(key)) sessionsByClass.set(key, [])
      sessionsByClass.get(key).push(session)
    }
    classes = classes.map((cls) => cls && {
      ...cls,
      sessions: sessionsByClass.get(String(cls.id)) ?? [],
    })
  }

  // 1. Kiểm tra thiếu lịch cho từng lớp: "Thiếu lịch thì báo chưa đủ dữ liệu"
  for (const cls of classes) {
    if (!cls || !cls.id) continue
    if (cls.status === "cancelled") continue

    if (!hasValidScheduleData(cls)) {
      result[cls.id] = {
        hasConflict: false,
        hasMissingSchedule: true,
        isMissingSchedule: true,
        status: "insufficient_data",
        message: "Chưa đủ dữ liệu lịch",
        tooltip: "Lớp học chưa có lịch buổi học thực tế (chưa đủ dữ liệu)",
      }
    }
  }

  // 2. So sánh từng cặp lớp CÓ lịch thực tế hợp lệ
  const classesWithSchedule = classes.filter(
    (c) => c && c.id && c.status !== "cancelled" && hasValidScheduleData(c),
  )

  for (let i = 0; i < classesWithSchedule.length; i++) {
    for (let j = i + 1; j < classesWithSchedule.length; j++) {
      const a = classesWithSchedule[i]
      const b = classesWithSchedule[j]

      const sessionsA = getClassSessions(a)
      const sessionsB = getClassSessions(b)

      let overlapForA = null
      let overlapForB = null

      for (const sA of sessionsA) {
        for (const sB of sessionsB) {
          const overlap = checkActualSessionOverlap(sA, sB, a, b)
          if (overlap) {
            overlapForA = overlap
            overlapForB = {
              ...overlap,
              startB: overlap.startA,
              endB: overlap.endA,
              startA: overlap.startB,
              endA: overlap.endB,
            }
            break
          }
        }
        if (overlapForA) break
      }

      if (overlapForA) {
        // Cảnh báo cho lớp A (nêu đúng lớp B)
        if (!result[a.id] || !result[a.id].hasConflict) {
          const notifA = buildConflictNotification(a, b, overlapForA)
          result[a.id] = {
            hasConflict: true,
            hasMissingSchedule: false,
            isMissingSchedule: false,
            conflictCoach: overlapForA.coachConflict,
            conflictRoom: overlapForA.roomConflict,
            conflictingClass: b,
            conflictingClassName: b.nameVi || b.name || b.code,
            conflictDate: overlapForA.date,
            message: notifA.message,
            tooltip: notifA.tooltip,
          }
        }

        // Cảnh báo cho lớp B (nêu đúng lớp A)
        if (!result[b.id] || !result[b.id].hasConflict) {
          const notifB = buildConflictNotification(b, a, overlapForB)
          result[b.id] = {
            hasConflict: true,
            hasMissingSchedule: false,
            isMissingSchedule: false,
            conflictCoach: overlapForB.coachConflict,
            conflictRoom: overlapForB.roomConflict,
            conflictingClass: a,
            conflictingClassName: a.nameVi || a.name || a.code,
            conflictDate: overlapForB.date,
            message: notifB.message,
            tooltip: notifB.tooltip,
          }
        }
      }
    }
  }

  return result
}

export const computeManagerClassConflicts = computeAllClassConflicts

/**
 * Hook for checking conflict in NewClassModal and EditClassModal
 */
export function useScheduleConflict({
  coachId,
  coachName,
  roomId,
  roomName,
  date,
  startTime,
  endTime,
  selectedDays = [1, 3, 5],
  excludeClassId = null,
  apiEnabled = false,
  existingClasses = [],
}) {
  const [conflict, setConflict] = useState(null)
  const [isChecking, setIsChecking] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (
      !startTime ||
      !endTime ||
      (!coachId && !coachName && !roomId && !roomName)
    ) {
      setConflict(null)
      setIsChecking(false)
      return
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    setIsChecking(true)

    timerRef.current = setTimeout(
      async () => {
        try {
          const candidate = {
            id: excludeClassId,
            coachId,
            coachName,
            roomId,
            room: roomName,
            roomVi: roomName,
            startDate: date,
            date,
            startTime,
            endTime,
            selectedDays,
          }

          // First: In-memory check against existingClasses
          let foundConflict = null
          for (const existing of existingClasses || []) {
            if (
              excludeClassId &&
              String(existing.id) === String(excludeClassId)
            )
              continue
            const conf = checkSingleClassConflict(candidate, existing)
            if (conf) {
              foundConflict = conf
              break
            }
          }

          if (foundConflict) {
            setConflict(foundConflict)
            setIsChecking(false)
            return
          }

          // Second: If no local conflict found and API is enabled, check backend
          const cleanCoachId =
            Number(String(coachId).replace(/\D/g, "")) || null
          const cleanRoomId = Number(String(roomId).replace(/\D/g, "")) || null

          if (apiEnabled && (cleanCoachId || cleanRoomId)) {
            const formattedStart =
              startTime.length === 5 ? `${startTime}:00` : startTime
            const formattedEnd =
              endTime.length === 5 ? `${endTime}:00` : endTime

            try {
              const response = await httpClient.post(
                "/api/sessions/check-conflict",
                {
                  coachId: cleanCoachId,
                  roomId: cleanRoomId,
                  sessionDate: date,
                  startTime: formattedStart,
                  endTime: formattedEnd,
                },
              )

              if (response && response.hasConflict) {
                setConflict(response)
                setIsChecking(false)
                return
              }
            } catch (apiErr) {
              // Silently fall back to in-memory check
            }
          }

          // No conflict detected
          setConflict({
            hasConflict: false,
            conflictCoach: false,
            conflictRoom: false,
            message: "Lịch dạy và sân tập khả dụng",
            tooltip: "",
          })
        } finally {
          setIsChecking(false)
        }
      },
      200,
    )

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [
    coachId,
    coachName,
    roomId,
    roomName,
    date,
    startTime,
    endTime,
    JSON.stringify(selectedDays),
    excludeClassId,
    apiEnabled,
    existingClasses,
  ])

  return { conflict, isChecking }
}

export default useScheduleConflict
