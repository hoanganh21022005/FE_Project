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

// Standard Normal class times aligned with the Backend TimeSlot enum.
export const NORMAL_CLASS_TIME_SLOTS = [
  { slotNumber: 1, name: "Ca 1", startTime: "06:00", endTime: "07:30", outdoorAllowed: true },
  { slotNumber: 2, name: "Ca 2", startTime: "07:45", endTime: "09:15", outdoorAllowed: true },
  { slotNumber: 3, name: "Ca 3", startTime: "09:30", endTime: "11:00", outdoorAllowed: false },
  { slotNumber: 4, name: "Ca 4", startTime: "13:00", endTime: "14:30", outdoorAllowed: false },
  { slotNumber: 5, name: "Ca 5", startTime: "14:45", endTime: "16:15", outdoorAllowed: true },
  { slotNumber: 6, name: "Ca 6", startTime: "16:30", endTime: "18:00", outdoorAllowed: true },
  { slotNumber: 7, name: "Ca 7", startTime: "18:15", endTime: "19:45", outdoorAllowed: true },
]
