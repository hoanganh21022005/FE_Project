/**
 * Bộ chuyển đổi giáo án có cấu trúc (Structured Training Plan v1)
 * Tương thích ngược với trường `content: string` của Backend:
 * - Khi lưu mới: tuần tự hóa thành JSON chuỗi `{"v":1,"exercises":[...],"notes":"..."}`
 * - Khi đọc: thử JSON.parse; nếu có `v === 1` và `Array.isArray(exercises)` thì trả về `structured: true`,
 *   ngược lại hiển thị văn bản thuần (`structured: false`) cho dữ liệu cũ.
 */

export function serializePlan({ exercises = [], notes = "" } = {}) {
  const cleanExercises = Array.isArray(exercises)
    ? exercises
        .map((ex) => ({
          name: String(ex?.name ?? "").trim(),
          sets:
            ex?.sets !== undefined && ex?.sets !== null && String(ex.sets).trim() !== ""
              ? Number(ex.sets) || String(ex.sets).trim()
              : 3,
          reps: String(ex?.reps ?? "").trim(),
          load: String(ex?.load ?? ex?.weight ?? "").trim(),
        }))
        .filter((ex) => ex.name !== "")
    : []

  const cleanNotes = String(notes ?? "").trim()

  return JSON.stringify({
    v: 1,
    exercises: cleanExercises,
    notes: cleanNotes,
  })
}

export function parsePlan(content) {
  if (content === null || content === undefined) {
    return { structured: false, exercises: [], notes: "" }
  }
  const raw = String(content).trim()
  if (!raw) {
    return { structured: false, exercises: [], notes: "" }
  }
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw)
      if (
        parsed &&
        typeof parsed === "object" &&
        parsed.v === 1 &&
        Array.isArray(parsed.exercises)
      ) {
        return {
          structured: true,
          exercises: parsed.exercises.map((ex) => ({
            name: String(ex?.name ?? ""),
            sets: ex?.sets ?? "",
            reps: String(ex?.reps ?? ""),
            load: String(ex?.load ?? ex?.weight ?? ""),
          })),
          notes: String(parsed.notes ?? ""),
        }
      }
    } catch {
      // Fallback sang plain text bên dưới
    }
  }
  return {
    structured: false,
    exercises: [],
    notes: raw,
  }
}
