const NORMAL_NUMBER_PATTERN = /\bNormal\s+N(\d+)\b/i
const MAX_COLLISION_ATTEMPTS = 50

export function formatNormalSequenceNumber(num) {
  const safeNum = Number.isInteger(num) && num > 0 ? num : 1
  return String(safeNum).padStart(2, "0")
}

export function extractNormalClassSequence(name) {
  if (typeof name !== "string") return null
  const match = NORMAL_NUMBER_PATTERN.exec(name.trim())
  if (!match) return null
  const parsed = Number.parseInt(match[1], 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function isNormalClassItem(cls) {
  if (!cls || typeof cls !== "object") return false
  if (cls.classType == null || cls.classType === "") return true
  return String(cls.classType).trim().toLowerCase() === "normal"
}

export function getMaxNormalClassSequence(classes = []) {
  if (!Array.isArray(classes) || classes.length === 0) return 0
  let maxSeq = 0
  for (const cls of classes) {
    if (!isNormalClassItem(cls)) continue
    const candidates = [cls.nameVi, cls.name]
    for (const candidate of candidates) {
      const seq = extractNormalClassSequence(candidate)
      if (seq !== null && seq > maxSeq) {
        maxSeq = seq
      }
    }
  }
  return maxSeq
}

export function hasDuplicateClassName(name, classes = []) {
  const normalized = String(name ?? "").trim().toLowerCase()
  if (!normalized || !Array.isArray(classes)) return false
  return classes.some((cls) => {
    if (!isNormalClassItem(cls)) return false
    const existingName = String(cls?.nameVi || cls?.name || "").trim().toLowerCase()
    return existingName === normalized
  })
}

export function suggestNormalClassName({ sportName, classes = [] } = {}) {
  const cleanSport = String(sportName ?? "").trim()
  if (!cleanSport) return ""

  const maxSeq = getMaxNormalClassSequence(classes)
  let nextSeq = maxSeq + 1

  for (let attempt = 0; attempt < MAX_COLLISION_ATTEMPTS; attempt += 1) {
    const candidate = `${cleanSport} Normal N${formatNormalSequenceNumber(nextSeq)}`
    if (!hasDuplicateClassName(candidate, classes)) {
      return candidate
    }
    nextSeq += 1
  }

  return `${cleanSport} Normal N${formatNormalSequenceNumber(nextSeq)}`
}
