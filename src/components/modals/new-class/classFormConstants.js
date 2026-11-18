export const WEEKDAYS = [
  { id: 1, label: "T2", name: "Thứ Hai", dayOfWeek: 1 },
  { id: 2, label: "T3", name: "Thứ Ba", dayOfWeek: 2 },
  { id: 3, label: "T4", name: "Thứ Tư", dayOfWeek: 3 },
  { id: 4, label: "T5", name: "Thứ Năm", dayOfWeek: 4 },
  { id: 5, label: "T6", name: "Thứ Sáu", dayOfWeek: 5 },
  { id: 6, label: "T7", name: "Thứ Bảy", dayOfWeek: 6 },
  { id: 0, label: "CN", name: "Chủ nhật", dayOfWeek: 0 },
]

export const VI_WEEKDAYS_FULL = [
  "Chủ nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
]


export const ROOM_ACTIVITY_TYPES = {
  badminton: "BADMINTON",
  table_tennis: "TABLE_TENNIS",
  pickleball: "PICKLEBALL",
  basketball: "BASKETBALL",
  volleyball: "VOLLEYBALL",
  archery: "ARCHERY",
  football: "FOOTBALL",
  tennis: "TENNIS",
  swimming: "SWIMMING",
}

// Khóa môn của danh mục hệ thống (resolveCatalogSubjects) -> id của SPORT_DISCIPLINES.
export const CATALOG_KEY_TO_SPORT_ID = { "table-tennis": "table_tennis" }

// Generate 15-minute time options from 05:00 to 23:00
export const TIME_OPTIONS_15MIN = []
for (let h = 5; h <= 22; h++) {
  const hh = String(h).padStart(2, "0")
  for (const mm of ["00", "15", "30", "45"]) {
    TIME_OPTIONS_15MIN.push(`${hh}:${mm}`)
  }
}
TIME_OPTIONS_15MIN.push("23:00")
