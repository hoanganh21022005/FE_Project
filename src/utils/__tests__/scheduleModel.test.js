import test from "node:test"
import assert from "node:assert/strict"
import {
  buildScheduleItems,
  getCounts,
  getWeekRange,
  filterItems,
  inferSlotNumber,
  DEFAULT_TIME_SLOTS,
} from "../scheduleModel.js"

test("getWeekRange always starts on Monday in Asia/Ho_Chi_Minh", () => {
  // 2026-11-05 is Thursday
  const range = getWeekRange("2026-11-05")
  assert.equal(range.mondayIso, "2026-11-02")
  assert.equal(range.sundayIso, "2026-11-08")
  assert.equal(range.days.length, 7)
  assert.equal(range.days[0].shortVi, "T2")
  assert.equal(range.days[6].shortVi, "CN")
  assert.equal(range.label, "02/11 – 08/11/2026")
})

test("buildScheduleItems & getCounts: cancelled sessions never count as upcoming, attendanceRate formula", () => {
  // Now: 2026-11-04T10:00:00+07:00
  const now = new Date("2026-11-04T10:00:00+07:00").getTime()

  const groupSessions = [
    {
      id: 1,
      classId: 10,
      className: "Tennis Normal K01",
      sessionDate: "2026-11-02",
      startTime: "06:00:00",
      endTime: "07:30:00",
      status: "Completed",
    },
    {
      id: 2,
      classId: 10,
      className: "Tennis Normal K01",
      sessionDate: "2026-11-03",
      startTime: "06:00:00",
      endTime: "07:30:00",
      status: "Completed",
    },
    {
      id: 3,
      classId: 10,
      className: "Tennis Normal K01",
      sessionDate: "2026-11-05",
      startTime: "06:00:00",
      endTime: "07:30:00",
      status: "Scheduled",
    },
    {
      id: 4,
      classId: 10,
      className: "Tennis Normal K01",
      sessionDate: "2026-11-06",
      startTime: "06:00:00",
      endTime: "07:30:00",
      status: "Cancelled",
      centerInvalidated: true,
    },
    {
      id: 5,
      classId: 10,
      className: "Tennis Normal K01",
      sessionDate: "2026-11-04",
      startTime: "06:00:00",
      endTime: "07:30:00",
      status: "Scheduled", // Past time on same day -> pending_update
    },
  ]

  const ptSessions = [
    {
      id: 100,
      isPrivate: true,
      subjectName: "Tennis PT",
      sessionDate: "2026-11-07",
      startTime: "07:45:00",
      endTime: "09:15:00",
      status: "Scheduled",
    },
  ]

  const attendances = [
    { sessionId: 1, status: "PRESENT" },
    { sessionId: 2, status: "ABSENT" },
  ]

  const items = buildScheduleItems({
    groupSessions,
    ptSessions,
    attendances,
    now,
  })

  assert.equal(items.length, 6)

  // Session 3 is group -> canReportAbsence must be false (Normal has no personal absence report)
  const s3 = items.find((x) => x.rawId === 3)
  assert.equal(s3.canReportAbsence, false)

  // Session 100 is PT -> canReportAbsence must be true (> 2h before)
  const s100 = items.find((x) => x.rawId === 100)
  assert.equal(s100.canReportAbsence, true)
  assert.equal(s100.slotNumber, 2)

  // Session 5 is past time but still Scheduled -> pending_update, not in upcoming
  const s5 = items.find((x) => x.rawId === 5)
  assert.equal(s5.uiState, "pending_update")

  const counts = getCounts(items)
  assert.equal(counts.upcoming, 2) // s3 + s100
  assert.equal(counts.done, 2) // s1 + s2
  assert.equal(counts.cancelled, 1) // s4
  assert.equal(counts.attendanceRate, 50) // 1 present out of 2 completed

  const upcomingList = filterItems(items, { statusTab: "upcoming" })
  assert.equal(upcomingList.length, 2)
  assert.equal(
    upcomingList.some((x) => x.status === "Cancelled"),
    false,
  )
})

test("getCounts returns null attendanceRate when 0 completed sessions", () => {
  const counts = getCounts([])
  assert.equal(counts.attendanceRate, null)
})

test("inferSlotNumber maps standard slots and falls back to 'other'", () => {
  assert.equal(inferSlotNumber("06:00:00", "07:30:00", DEFAULT_TIME_SLOTS), 1)
  assert.equal(inferSlotNumber("18:15", "19:45", DEFAULT_TIME_SLOTS), 8)
  assert.equal(inferSlotNumber("20:00", "21:30", DEFAULT_TIME_SLOTS), "other")
})
