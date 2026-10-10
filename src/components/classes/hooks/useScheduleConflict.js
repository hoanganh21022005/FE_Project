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
export function computeAllClassConflicts(classes = []) {
  const result = {}
  if (!Array.isArray(classes) || classes.length < 2) return result

  for (let i = 0; i < classes.length; i++) {
    for (let j = i + 1; j < classes.length; j++) {
      const a = classes[i]
      const b = classes[j]
      const conflict = checkSingleClassConflict(a, b)
      if (conflict) {
        if (!result[a.id]) {
          result[a.id] = {
            ...conflict,
            conflictingClass: b,
            tooltip:
              conflict.conflictCoach && conflict.conflictRoom
                ? `Phát hiện trùng lịch Sân tập và Huấn luyện viên với lớp ${b.nameVi || b.name}`
                : conflict.conflictCoach
                  ? `Phát hiện trùng lịch Huấn luyện viên (${b.coachName || a.coachName}) với lớp ${b.nameVi || b.name}`
                  : `Phát hiện trùng lịch Sân tập (${b.roomVi || b.room || a.roomVi || a.room}) với lớp ${b.nameVi || b.name}`,
          }
        }
        if (!result[b.id]) {
          result[b.id] = {
            ...conflict,
            conflictingClass: a,
            tooltip:
              conflict.conflictCoach && conflict.conflictRoom
                ? `Phát hiện trùng lịch Sân tập và Huấn luyện viên với lớp ${a.nameVi || a.name}`
                : conflict.conflictCoach
                  ? `Phát hiện trùng lịch Huấn luyện viên (${a.coachName || b.coachName}) với lớp ${a.nameVi || a.name}`
                  : `Phát hiện trùng lịch Sân tập (${a.roomVi || a.room || b.roomVi || b.room}) với lớp ${a.nameVi || a.name}`,
          }
        }
      }
    }
  }
  return result
}

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
