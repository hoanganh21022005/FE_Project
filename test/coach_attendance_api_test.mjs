import assert from "node:assert/strict"
import { attendanceApi } from "../src/api/attendanceApi.js"

const originalFetch = globalThis.fetch
const requests = []
let response
globalThis.fetch = async (url, options) => {
  const { pathname } = new URL(url, "http://localhost")
  requests.push({ pathname, body: JSON.parse(options.body) })
  const [status, body] = response
  return Response.json(body, { status })
}

const selection = { sessionId: 141, memberId: 2, coachId: 27 }
try {
  for (const status of ["Present", "Absent"]) {
    requests.length = 0
    response = [200, { ...selection, attendanceStatus: status }]
    const result = await attendanceApi.recordSessionAttendance({ ...selection, status })
    assert.equal(result.attendanceStatus, status)
    assert.equal(requests.length, 1)
    assert.equal(requests[0].pathname, "/api/training-results")
    assert.equal(requests[0].body.sessionId, selection.sessionId)
    assert.equal(requests[0].body.memberId, selection.memberId)
    assert.equal(requests[0].body.attendanceStatus, status)
  }

  requests.length = 0
  response = [400, { code: "ATTENDANCE_WINDOW_CLOSED" }]
  await assert.rejects(
    attendanceApi.recordSessionAttendance({ ...selection, status: "Absent" }),
    { status: 400, code: "ATTENDANCE_WINDOW_CLOSED" },
  )
  assert.equal(requests.length, 1)

  response = [200, { ...selection, sessionId: 142, attendanceStatus: "Present" }]
  await assert.rejects(attendanceApi.recordSessionAttendance(selection), /Chưa xác nhận/)

  requests.length = 0
  await assert.rejects(attendanceApi.recordSessionAttendance({ ...selection, sessionId: null }))
  await assert.rejects(attendanceApi.recordSessionAttendance({ ...selection, status: "Late" }))
  assert.equal(requests.length, 0)

  response = [200, { attendanceId: 5, memberId: 2 }]
  await attendanceApi.manualCheckIn({ memberId: 2, notes: "fixture" })
  assert.deepEqual(requests, [{
    pathname: "/api/attendances/check-in",
    body: { memberId: 2, notes: "fixture" },
  }])
  console.log("PASS: session attendance acknowledgement, failures, validation and lobby isolation")
} finally {
  globalThis.fetch = originalFetch
}
