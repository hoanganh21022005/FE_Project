import assert from "node:assert/strict"
import {
  formatVietnamDateTime,
  getActiveAdvancedCreditCount,
  getAttendedCount,
  getUpcomingSessions,
  isActiveAdvancedSubscription,
  isActiveNormalEnrollment,
  isPayablePendingInvoice,
  isSubscriptionNearExpiry,
} from "../src/utils/memberDashboardData.js"

const memberId = 42
const nowKey = "2026-10-28T10:00:00"
const now = Date.parse("2026-10-28T03:00:00Z")

assert.equal(
  isActiveNormalEnrollment({ status: "Registered", classType: "NORMAL" }),
  true,
)
assert.equal(
  isActiveNormalEnrollment({ status: "Pending", classType: "NORMAL" }),
  false,
)
assert.equal(
  isActiveNormalEnrollment({ status: "Registered", packageType: "ADVANCED" }),
  false,
)

const activeAdvanced = [
  {
    packageType: "ADVANCED",
    status: "Active",
    subjectId: 7,
    subjectName: "Tennis",
    remainingCredit: 5,
    expiresAt: "2026-11-02T08:00:00",
  },
  {
    packageType: "ADVANCED",
    status: "Active",
    subjectId: 8,
    subjectName: "Bơi lội",
    remainingCredit: 3,
    expiresAt: "2026-11-20T08:00:00",
  },
  {
    packageType: "ADVANCED",
    status: "Pending",
    subjectId: 9,
    remainingCredit: 12,
  },
]
assert.equal(isActiveAdvancedSubscription(activeAdvanced[0]), true)
assert.equal(getActiveAdvancedCreditCount(activeAdvanced), 8)
assert.equal(
  getActiveAdvancedCreditCount([
    { packageType: "ADVANCED", status: "Active", remainingCredit: 0 },
    { packageType: "ADVANCED", status: "Pending", remainingCredit: 12 },
  ]),
  0,
)
assert.equal(isSubscriptionNearExpiry(activeAdvanced[0], now), true)
assert.equal(isSubscriptionNearExpiry(activeAdvanced[1], now), false)
assert.equal(
  getActiveAdvancedCreditCount([
    { packageType: "ADVANCED", status: "Active", remainingCredit: null },
  ]),
  null,
)
assert.equal(
  getActiveAdvancedCreditCount([
    { packageType: "ADVANCED", status: "Active", remainingCredit: "" },
  ]),
  null,
)
assert.equal(
  getActiveAdvancedCreditCount([
    { packageType: "ADVANCED", status: "Active", remainingCredit: false },
  ]),
  null,
)

const upcoming = getUpcomingSessions(
  [
    {
      id: 2,
      memberId,
      bookedMemberId: memberId,
      status: "Scheduled",
      sessionDate: "2026-10-29",
      startTime: "09:00",
    },
    {
      id: 1,
      bookedMemberId: memberId,
      status: "SCHEDULED",
      sessionDate: "2026-10-28",
      startTime: "10:30",
    },
    {
      id: 3,
      bookedMemberId: 99,
      status: "Scheduled",
      sessionDate: "2026-10-28",
      startTime: "10:15",
    },
    {
      id: 4,
      bookedMemberId: memberId,
      status: "Cancelled",
      sessionDate: "2026-10-28",
      startTime: "11:00",
    },
    {
      id: 5,
      bookedMemberId: memberId,
      status: "Scheduled",
      sessionDate: "2026-10-28",
      startTime: "09:30",
    },
  ],
  memberId,
  nowKey,
)
assert.deepEqual(
  upcoming.map((session) => session.id),
  [1, 2],
)

assert.equal(
  getAttendedCount(
    [
      { memberId, state: "Present" },
      { memberId, state: "Late" },
      { memberId, state: "Absent" },
      { memberId: 99, state: "Present" },
    ],
    memberId,
  ),
  2,
)

assert.equal(
  isPayablePendingInvoice(
    { paymentStatus: "Pending", expiresAt: "2026-10-28T11:00:00" },
    now,
  ),
  true,
)
assert.equal(
  isPayablePendingInvoice(
    { paymentStatus: "Pending", expiresAt: "2026-10-28T09:00:00" },
    now,
  ),
  false,
)
assert.equal(
  isPayablePendingInvoice({ paymentStatus: "Pending", expiresAt: null }, now),
  false,
)
assert.match(formatVietnamDateTime("2026-10-29", "09:30", "vi-VN"), /29/)

console.log("Member dashboard data checks passed.")
