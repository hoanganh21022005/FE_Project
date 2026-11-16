export function isRoomAvailable(room, isApi = true) {
  if (!room || typeof room !== "object") return false
  if (!isApi) {
    const s = String(room.status || "").trim().toLowerCase()
    return s !== "closed" && s !== "maintenance"
  }
  const s = String(room.status || "").trim().toLowerCase()
  return s === "available"
}

export function isRoomForSubject(room, regItem) {
  if (!room || !regItem) return true

  const targetSubjectId = regItem.subjectId ? String(regItem.subjectId).trim() : null
  const targetSubjectName = String(
    regItem.subjectName ||
    regItem.subject?.name ||
    regItem.specialty ||
    regItem.specialization ||
    "",
  ).trim().toLowerCase()

  // 1. Direct subjectId matching if room provides subject association
  if (targetSubjectId) {
    if (room.subjectId != null && String(room.subjectId).trim() === targetSubjectId) return true
    if (room.subject_id != null && String(room.subject_id).trim() === targetSubjectId) return true
    if (room.subject?.id != null && String(room.subject.id).trim() === targetSubjectId) return true
    if (Array.isArray(room.subjectIds) && room.subjectIds.some((id) => String(id).trim() === targetSubjectId)) return true
    if (Array.isArray(room.subjects) && room.subjects.some((s) => String(s?.id ?? s).trim() === targetSubjectId)) return true
  }

  // 2. Direct room subject / sport / activity name matching
  const roomSubjectName = String(
    room.subjectName ||
    room.subject?.name ||
    room.sport ||
    room.sportName ||
    room.activityType ||
    "",
  ).trim().toLowerCase()
  if (roomSubjectName && targetSubjectName) {
    if (roomSubjectName.includes(targetSubjectName) || targetSubjectName.includes(roomSubjectName)) {
      return true
    }
  }

  // 3. Normalized string matching on roomCode, name, and location
  const roomName = String(room.name || "").toLowerCase()
  const roomLocation = String(room.location || "").toLowerCase()
  const roomCode = String(room.roomCode || "").toUpperCase()
  const roomCombined = `${roomCode} ${roomName} ${roomLocation}`

  const SPORT_DICTIONARY = [
    {
      keys: ["quần vợt", "tennis"],
      roomTerms: ["quần vợt", "tennis"],
      codes: ["TEN", "TNS"],
    },
    {
      keys: ["bắn cung", "archery"],
      roomTerms: ["bắn cung", "archery"],
      codes: ["ARC"],
    },
    {
      keys: ["bơi", "swimming", "swim"],
      roomTerms: ["bơi", "swimming", "swim", "hồ bơi", "bể bơi", "pool"],
      codes: ["SWM", "SWI"],
    },
    {
      keys: ["cầu lông", "badminton"],
      roomTerms: ["cầu lông", "badminton"],
      codes: ["BAD", "BDM"],
    },
    {
      keys: ["bóng bàn", "table tennis", "ping pong", "pingpong"],
      roomTerms: ["bóng bàn", "table tennis", "ping pong", "pingpong"],
      codes: ["TTN", "TAB"],
    },
    {
      keys: ["bóng rổ", "basketball"],
      roomTerms: ["bóng rổ", "basketball"],
      codes: ["BKB", "BSK"],
    },
    {
      keys: ["bóng chuyền", "volleyball"],
      roomTerms: ["bóng chuyền", "volleyball"],
      codes: ["VLB", "VOL"],
    },
    {
      keys: ["bóng đá", "football", "soccer"],
      roomTerms: ["bóng đá", "sân cỏ", "football", "soccer"],
      codes: ["FTB", "SOC"],
    },
    {
      keys: ["bắn súng", "shooting"],
      roomTerms: ["bắn súng", "shooting", "súng hơi", "laser 10m"],
      codes: ["SHT", "GUN"],
    },
    {
      keys: ["pickleball"],
      roomTerms: ["pickleball"],
      codes: ["PCK", "PKB"],
    },
    {
      keys: ["gym", "fitness", "thể hình"],
      roomTerms: ["gym", "fitness", "thể hình"],
      codes: ["GYM", "FIT"],
    },
    {
      keys: ["yoga", "pilates"],
      roomTerms: ["yoga", "pilates"],
      codes: ["YOG", "PIL"],
    },
    {
      keys: ["boxing", "vovinam", "quyền anh", "võ thuật", "võ"],
      roomTerms: ["boxing", "vovinam", "quyền anh", "võ thuật", "đối kháng"],
      codes: ["BOX", "VOV"],
    },
  ]

  for (const item of SPORT_DICTIONARY) {
    const isTargetSport = item.keys.some((k) => targetSubjectName.includes(k))
    if (isTargetSport) {
      const hasTerm = item.roomTerms.some((t) => roomCombined.includes(t))
      const hasCode = item.codes.some((c) => roomCode.includes(c))
      if (hasTerm || hasCode) {
        return true
      }
    }
  }

  // 4. Token-level matching (e.g., "Tennis", "Quần vợt")
  if (targetSubjectName) {
    const tokens = targetSubjectName
      .replace(/[()[\]{}_-]/g, " ")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3)
    if (tokens.some((token) => roomCombined.includes(token))) {
      return true
    }
  }

  return false
}

export function formatRoomOptionLabel(room) {
  if (!room || typeof room !== "object") return ""
  const code = room.roomCode ? String(room.roomCode).trim() : ""
  const name = room.name || `Sân #${room.id ?? ""}`
  return code ? `${code} - ${name}` : name
}
