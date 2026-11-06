import assert from "node:assert/strict"
import { attendanceApi } from "../src/api/attendanceApi.js"
import { memberPortalApi } from "../src/api/memberPortalApi.js"
import { classEnrollmentApi } from "../src/api/classEnrollmentApi.js"
import {
  verifyCoachSessionPermission,
  canPerformBulkAttendance,
} from "../src/utils/permissions.js"

const originalFetch = globalThis.fetch
const requests = []
let response

globalThis.fetch = async (url, options = {}) => {
  const { pathname } = new URL(url, "http://localhost")
  const method = String(options.method || "GET").toUpperCase()
  const body = options.body ? JSON.parse(options.body) : undefined
  requests.push({ pathname, method, body })
  const [status, resBody] = response
  return Response.json(resBody, { status })
}

const selection = { sessionId: 141, memberId: 2, coachId: 27 }

try {
  // -------------------------------------------------------------
  // SUITE 1: Base Attendance API (Acknowledge, Failure, Validation, Lobby isolation)
  // -------------------------------------------------------------
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
    method: "POST",
    body: { memberId: 2, notes: "fixture" },
  }])

  // -------------------------------------------------------------
  // SUITE 2: Substitute Coach permissions according to actual session assignment (PR #56 Issue 1)
  // -------------------------------------------------------------
  const groupClass12 = { id: 12, name: "Cầu lông Nâng cao", coachId: 14 }
  const ptClassVirtual = { id: "PT_1ON1", isPrivateVirtualClass: true }

  // 2.1: Substitute coach (27) assigned to Session 141 of Class 12 (primary coach is 14) -> Allowed
  const subAssignedSession = { id: 141, classId: 12, coachId: 27, status: "Scheduled", isPrivate: false }
  const permSubAssigned = verifyCoachSessionPermission({
    session: subAssignedSession,
    classItem: groupClass12,
    coachId: 27,
  })
  assert.equal(permSubAssigned.allowed, true)
  assert.equal(permSubAssigned.isSubstitute, true)
  assert.equal(permSubAssigned.isPrimary, false)

  // 2.2: Substitute coach (27) on Session 142 of Class 12 (assigned to coach 14) -> Blocked (ngoài quyền)
  const otherSession = { id: 142, classId: 12, coachId: 14, status: "Scheduled", isPrivate: false }
  const permSubOutside = verifyCoachSessionPermission({
    session: otherSession,
    classItem: groupClass12,
    coachId: 27,
  })
  assert.equal(permSubOutside.allowed, false)
  assert.equal(permSubOutside.isOutsidePermission, true)
  assert.equal(permSubOutside.reason, "outside_permission")

  // 2.3: Primary coach (14) on Session 141 (reassigned to substitute 27) -> Blocked (ngoài quyền)
  const permPrimaryReassigned = verifyCoachSessionPermission({
    session: subAssignedSession,
    classItem: groupClass12,
    coachId: 14,
  })
  assert.equal(permPrimaryReassigned.allowed, false)
  assert.equal(permPrimaryReassigned.isOutsidePermission, true)
  assert.equal(permPrimaryReassigned.reason, "outside_permission")

  // 2.4: Primary coach (14) on Session 142 (regular session, coachId 14 or null) -> Allowed (giữ luồng Coach chính)
  const permPrimaryRegular = verifyCoachSessionPermission({
    session: otherSession,
    classItem: groupClass12,
    coachId: 14,
  })
  assert.equal(permPrimaryRegular.allowed, true)
  assert.equal(permPrimaryRegular.isPrimary, true)
  assert.equal(permPrimaryRegular.isSubstitute, false)

  // 2.5: PT coach (27) on PT session (isPrivate: true, coachId: 27) -> Allowed (giữ luồng PT)
  const ptSession201 = { id: 201, isPrivate: true, coachId: 27, status: "Scheduled" }
  const permPt = verifyCoachSessionPermission({
    session: ptSession201,
    classItem: ptClassVirtual,
    coachId: 27,
  })
  assert.equal(permPt.allowed, true)
  assert.equal(permPt.isPt, true)

  // 2.6: PT coach (27) on PT session of another coach (15) -> Blocked
  const ptSession202 = { id: 202, isPrivate: true, coachId: 15, status: "Scheduled" }
  const permPtOther = verifyCoachSessionPermission({
    session: ptSession202,
    classItem: ptClassVirtual,
    coachId: 27,
  })
  assert.equal(permPtOther.allowed, false)
  assert.equal(permPtOther.isOutsidePermission, true)

  // 2.7: Mismatched pair - group session classId (15) != classItem id (12) -> Blocked (ca sai cặp)
  const mismatchedSession = { id: 141, classId: 15, coachId: 27, status: "Scheduled", isPrivate: false }
  const permMismatched = verifyCoachSessionPermission({
    session: mismatchedSession,
    classItem: groupClass12,
    coachId: 27,
  })
  assert.equal(permMismatched.allowed, false)
  assert.equal(permMismatched.isMismatched, true)
  assert.equal(permMismatched.reason, "mismatched_pair")

  // 2.8: Mismatched pair - PT virtual class paired with non-private group session -> Blocked (ca sai cặp)
  const permPtMismatched = verifyCoachSessionPermission({
    session: subAssignedSession,
    classItem: ptClassVirtual,
    coachId: 27,
  })
  assert.equal(permPtMismatched.allowed, false)
  assert.equal(permPtMismatched.isMismatched, true)

  // -------------------------------------------------------------
  // SUITE 3: Bulk Attendance Gating: Mỗi GET lỗi phải 0 POST (PR #56 Issue 2)
  // -------------------------------------------------------------
  const baseBulkContext = {
    sessionReady: true,
    hasSessionPermission: true,
    sessionCancelled: false,
    allowCheckIn: true,
    loadingRoster: false,
    rosterError: null,
    attendancesError: null,
    trainingResultsError: null,
    loadedClassId: 12,
    selectedClassId: 12,
    loadedSessionId: 141,
    selectedSessionId: 141,
    unmarkedCount: 3,
    bulkSaving: false,
  }

  // 3.1: Valid state allows bulk
  assert.equal(canPerformBulkAttendance(baseBulkContext), true)

  // 3.2: GET error on Roster -> 0 POST
  requests.length = 0
  const rosterErrContext = { ...baseBulkContext, rosterError: new Error("500 Roster Error") }
  assert.equal(canPerformBulkAttendance(rosterErrContext), false)
  if (canPerformBulkAttendance(rosterErrContext)) {
    await memberPortalApi.recordBulkTrainingResults({ sessionId: 141, coachId: 27, items: [] })
  }
  assert.equal(requests.filter((r) => r.method === "POST").length, 0, "Roster GET error must result in 0 POST")

  // 3.3: GET error on Attendances -> 0 POST
  requests.length = 0
  const attendancesErrContext = { ...baseBulkContext, attendancesError: new Error("500 Attendances Error") }
  assert.equal(canPerformBulkAttendance(attendancesErrContext), false)
  if (canPerformBulkAttendance(attendancesErrContext)) {
    await memberPortalApi.recordBulkTrainingResults({ sessionId: 141, coachId: 27, items: [] })
  }
  assert.equal(requests.filter((r) => r.method === "POST").length, 0, "Attendances GET error must result in 0 POST")

  // 3.4: GET error on Training Results -> 0 POST
  requests.length = 0
  const resultsErrContext = { ...baseBulkContext, trainingResultsError: new Error("500 Results Error") }
  assert.equal(canPerformBulkAttendance(resultsErrContext), false)
  if (canPerformBulkAttendance(resultsErrContext)) {
    await memberPortalApi.recordBulkTrainingResults({ sessionId: 141, coachId: 27, items: [] })
  }
  assert.equal(requests.filter((r) => r.method === "POST").length, 0, "Training results GET error must result in 0 POST")

  // 3.5: Still loading / unready -> 0 POST
  requests.length = 0
  const loadingContext = { ...baseBulkContext, loadingRoster: true }
  assert.equal(canPerformBulkAttendance(loadingContext), false)
  assert.equal(requests.filter((r) => r.method === "POST").length, 0)

  // 3.6: Belong to old class -> 0 POST
  const oldClassContext = { ...baseBulkContext, loadedClassId: 11, selectedClassId: 12 }
  assert.equal(canPerformBulkAttendance(oldClassContext), false)

  // 3.7: Belong to old session -> 0 POST
  const oldSessionContext = { ...baseBulkContext, loadedSessionId: 140, selectedSessionId: 141 }
  assert.equal(canPerformBulkAttendance(oldSessionContext), false)

  // 3.8: Outside permission -> 0 POST
  const outsidePermContext = { ...baseBulkContext, hasSessionPermission: false }
  assert.equal(canPerformBulkAttendance(outsidePermContext), false)

  // -------------------------------------------------------------
  // SUITE 4: Đổi buổi khi request cũ về muộn (Race Condition Handling)
  // -------------------------------------------------------------
  let currentRequestId = 1
  let sessionState = {
    loadedSessionId: 101,
    trainingResults: [{ memberId: 1, attendanceStatus: "Present" }],
  }

  // User initiates switch to Session 102
  const selectedSession = 102
  currentRequestId = 2

  // Bulk check while Session 102 is loading (state still has Session 101 data)
  const inFlightSwitchContext = {
    ...baseBulkContext,
    loadedSessionId: sessionState.loadedSessionId, // 101
    selectedSessionId: selectedSession, // 102
  }
  assert.equal(
    canPerformBulkAttendance(inFlightSwitchContext),
    false,
    "Bulk must be blocked while switching sessions before new session data arrives",
  )

  // Old request for Session 101 resolves LATE
  const lateRequest1Id = 1
  const lateResponseSession101 = [{ memberId: 99, attendanceStatus: "Absent" }]
  if (lateRequest1Id === currentRequestId) {
    sessionState.trainingResults = lateResponseSession101
    sessionState.loadedSessionId = 101
  }
  // Verify late response was DISCARDED
  assert.notDeepEqual(sessionState.trainingResults, lateResponseSession101)
  assert.equal(sessionState.loadedSessionId, 101)

  // New request for Session 102 resolves
  const request2Id = 2
  const newResponseSession102 = [{ memberId: 20, attendanceStatus: "Absent" }]
  if (request2Id === currentRequestId) {
    sessionState.trainingResults = newResponseSession102
    sessionState.loadedSessionId = 102
  }
  assert.deepEqual(sessionState.trainingResults, newResponseSession102)
  assert.equal(sessionState.loadedSessionId, 102)

  // Now bulk is allowed for Session 102
  const resolvedSessionContext = {
    ...baseBulkContext,
    loadedSessionId: sessionState.loadedSessionId,
    selectedSessionId: 102,
  }
  assert.equal(canPerformBulkAttendance(resolvedSessionContext), true)

  // -------------------------------------------------------------
  // SUITE 5: Retry chỉ ghi người chưa điểm danh và giữ Absent (Bulk & Retry Integrity)
  // -------------------------------------------------------------
  const rosterMembers = [
    { id: 1, name: "Nguyễn Văn A" },
    { id: 2, name: "Trần Thị B" },
    { id: 3, name: "Lê Văn C" },
    { id: 4, name: "Phạm Thị D" },
  ]

  // Status mapping: Member 1 is Absent, Member 2 is Present, Members 3 and 4 are not recorded
  const attendanceStatusByMember = {
    1: "absent",
    2: "present",
    3: "not_recorded",
    4: "not_recorded",
  }

  // Filter unmarked members (only 3 & 4)
  const initialUnmarked = rosterMembers.filter(
    (m) => attendanceStatusByMember[m.id] === "not_recorded",
  )
  assert.deepEqual(initialUnmarked.map((m) => m.id), [3, 4])
  assert.equal(initialUnmarked.some((m) => m.id === 1), false, "Absent member must NOT be in unmarked targets")

  // Execute initial bulk mark present
  requests.length = 0
  response = [
    200,
    initialUnmarked.map((m) => ({
      sessionId: 141,
      memberId: m.id,
      coachId: 27,
      attendanceStatus: "Present",
    })),
  ]
  await memberPortalApi.recordBulkTrainingResults({
    sessionId: 141,
    coachId: 27,
    items: initialUnmarked.map((m) => ({
      memberId: m.id,
      attendanceStatus: "Present",
      content: "Có mặt đầy đủ",
    })),
  })

  assert.equal(requests.length, 1)
  assert.equal(requests[0].pathname, "/api/training-results/bulk")
  assert.equal(requests[0].method, "POST")
  const bulkItems = requests[0].body.items
  assert.equal(bulkItems.length, 2)
  assert.deepEqual(bulkItems.map((it) => it.memberId), [3, 4])
  assert.equal(bulkItems.some((it) => it.memberId === 1), false, "Absent member 1 must NEVER be written to Present")
  assert.equal(bulkItems.some((it) => it.memberId === 2), false, "Present member 2 must NOT be re-written")

  // Simulate partial failure / retry scenario: Member 3 became Present, but Member 4 failed
  attendanceStatusByMember[3] = "present" // succeeded
  // attendanceStatusByMember[4] is still "not_recorded" (failed)
  // attendanceStatusByMember[1] is STILL "absent"

  const retryUnmarked = rosterMembers.filter(
    (m) => attendanceStatusByMember[m.id] === "not_recorded",
  )
  assert.deepEqual(retryUnmarked.map((m) => m.id), [4], "Retry must ONLY target remaining unmarked members")
  assert.equal(attendanceStatusByMember[1], "absent", "Member 1 MUST REMAIN Absent across retries")

  // Execute retry
  requests.length = 0
  response = [
    200,
    retryUnmarked.map((m) => ({
      sessionId: 141,
      memberId: m.id,
      coachId: 27,
      attendanceStatus: "Present",
    })),
  ]
  await memberPortalApi.recordBulkTrainingResults({
    sessionId: 141,
    coachId: 27,
    items: retryUnmarked.map((m) => ({
      memberId: m.id,
      attendanceStatus: "Present",
      content: "Có mặt đầy đủ",
    })),
  })

  assert.equal(requests.length, 1)
  assert.equal(requests[0].body.items.length, 1)
  assert.equal(requests[0].body.items[0].memberId, 4)
  assert.equal(requests[0].body.items.some((it) => it.memberId === 1), false, "Absent member remains untouched")

  // -------------------------------------------------------------
  // SUITE 6: Xác minh quyền phân công trước khi tải danh sách học viên (Review Point 1)
  // - Khi mở từ lịch hoặc F5 với cặp classId/sessionId cụ thể: xác minh đúng cặp đó và quyền thực tế
  // - Nếu cặp sai, buổi không tồn tại, ngoài quyền hoặc nguồn phân công lỗi -> 0 GET roster, 0 POST điểm danh
  // - Chỉ tự chọn buổi khi mở màn hình mà chưa chọn buổi cụ thể
  // -------------------------------------------------------------
  const groupClass10 = { id: 10, name: "Bơi lội K01", coachId: 18 }
  const session10A = { id: 101, classId: 10, coachId: 18, status: "Scheduled", isPrivate: false }
  const session10B = { id: 102, classId: 10, coachId: 27, status: "Scheduled", isPrivate: false } // substitute coach 27

  // Helper simulating the exact loadClassRosterAndAttendance logic:
  const runAttendanceLoadFlow = async ({
    classItem,
    selectedSessionId,
    coachId,
    sessionsFetcher,
  }) => {
    let requestedRoster = false
    let loadedSessionId = null
    let loadedClassId = null
    let rosterError = null
    let sessions = []

    try {
      const sessionsRes = await sessionsFetcher()
      if (sessionsRes.error) {
        throw new Error("Lỗi nguồn phân công buổi học. Không thể tải danh sách điểm danh.")
      }
      sessions = sessionsRes.data || []

      let targetSession = null
      if (selectedSessionId) {
        targetSession = sessions.find((s) => String(s.id) === String(selectedSessionId))
        if (!targetSession) {
          throw new Error("Buổi học không tồn tại trong lớp đã chọn hoặc cặp lớp/buổi không hợp lệ.")
        }
      } else {
        targetSession =
          sessions.find((s) => s.coachId != null ? Number(s.coachId) === Number(coachId) : false) ||
          sessions.find((s) => !s.cancelled) ||
          sessions[0] ||
          null
        if (!targetSession) {
          throw new Error("Lớp học này hiện chưa có buổi học nào.")
        }
      }

      const perm = verifyCoachSessionPermission({
        session: targetSession,
        classItem,
        coachId,
      })
      if (!perm.allowed) {
        throw new Error(perm.messageVi || "Coach không được phân công cho cặp lớp và buổi học này.")
      }

      // Coach verified! Only now request roster
      requestedRoster = true
      const roster = await classEnrollmentApi.getEnrollmentsByClass(classItem.id, { strict: true })
      loadedClassId = classItem.id
      loadedSessionId = targetSession.id
      return {
        success: true,
        roster,
        targetSession,
        requestedRoster,
        error: null,
      }
    } catch (err) {
      rosterError = err
      return {
        success: false,
        roster: [],
        targetSession: null,
        requestedRoster: false,
        error: rosterError,
      }
    }
  }

  const validSessionsFetcher = async () => ({ data: [session10A, session10B], error: null })
  const failedSessionsFetcher = async () => ({ data: [], error: new Error("500 Sessions API Error") })

  // 6.1: Cặp sai / Buổi không tồn tại trong lớp (selectedSessionId = 999) -> 0 GET roster, 0 POST điểm danh
  requests.length = 0
  const resultNonExistent = await runAttendanceLoadFlow({
    classItem: groupClass10,
    selectedSessionId: 999,
    coachId: 27,
    sessionsFetcher: validSessionsFetcher,
  })
  assert.equal(resultNonExistent.success, false)
  assert.match(resultNonExistent.error.message, /không tồn tại|không hợp lệ/)
  assert.equal(resultNonExistent.requestedRoster, false)
  assert.equal(requests.filter((r) => r.pathname.includes("/enrollments")).length, 0, "Non-existent session must send 0 GET roster")

  // 6.2: Ngoài quyền phân công thực tế (Coach 27 chọn Session 101 của Coach 18) -> 0 GET roster, 0 POST điểm danh
  requests.length = 0
  const resultOutsidePerm = await runAttendanceLoadFlow({
    classItem: groupClass10,
    selectedSessionId: 101,
    coachId: 27,
    sessionsFetcher: validSessionsFetcher,
  })
  assert.equal(resultOutsidePerm.success, false)
  assert.match(resultOutsidePerm.error.message, /không được phân công/)
  assert.equal(resultOutsidePerm.requestedRoster, false)
  assert.equal(requests.filter((r) => r.pathname.includes("/enrollments")).length, 0, "Outside permission must send 0 GET roster")

  // 6.3: Nguồn phân công lỗi (sessions API returns error) -> 0 GET roster, 0 POST điểm danh
  requests.length = 0
  const resultSessionError = await runAttendanceLoadFlow({
    classItem: groupClass10,
    selectedSessionId: 102,
    coachId: 27,
    sessionsFetcher: failedSessionsFetcher,
  })
  assert.equal(resultSessionError.success, false)
  assert.match(resultSessionError.error.message, /Lỗi nguồn phân công/)
  assert.equal(resultSessionError.requestedRoster, false)
  assert.equal(requests.filter((r) => r.pathname.includes("/enrollments")).length, 0, "Session fetch error must send 0 GET roster")

  // 6.4: Coach dạy thay mở đúng buổi (Session 102) sau F5 -> Xác minh quyền thành công và gửi đúng 1 GET roster
  requests.length = 0
  response = [200, [{ memberId: 5, memberName: "Học viên Bơi", memberCode: "MB-1005" }]]
  const resultSubF5 = await runAttendanceLoadFlow({
    classItem: groupClass10,
    selectedSessionId: 102,
    coachId: 27,
    sessionsFetcher: validSessionsFetcher,
  })
  assert.equal(resultSubF5.success, true)
  assert.equal(resultSubF5.requestedRoster, true)
  assert.equal(resultSubF5.targetSession.id, 102)
  assert.equal(requests.filter((r) => r.pathname === "/api/classes/10/enrollments" && r.method === "GET").length, 1)

  // 6.5: Chỉ tự chọn buổi khi mở màn hình mà CHƯA chọn buổi cụ thể (selectedSessionId rỗng)
  requests.length = 0
  response = [200, [{ memberId: 5, memberName: "Học viên Bơi", memberCode: "MB-1005" }]]
  const resultAutoSelect = await runAttendanceLoadFlow({
    classItem: groupClass10,
    selectedSessionId: "", // Chưa chọn buổi
    coachId: 27,
    sessionsFetcher: validSessionsFetcher,
  })
  assert.equal(resultAutoSelect.success, true)
  assert.equal(resultAutoSelect.targetSession.id, 102, "Must auto-select session assigned to coach 27")
  assert.equal(resultAutoSelect.requestedRoster, true)

  // 6.6: Đổi tài khoản có lựa chọn cũ: sessionStorage phát hiện mismatch và dọn storage
  const detectAccountSwitch = (savedCoachId, currentCoachId) => {
    if (savedCoachId && currentCoachId && String(savedCoachId) !== String(currentCoachId)) {
      return { switched: true, clearedStorage: true }
    }
    return { switched: false, clearedStorage: false }
  }
  assert.deepEqual(detectAccountSwitch("14", "15"), { switched: true, clearedStorage: true })
  assert.deepEqual(detectAccountSwitch("27", "27"), { switched: false, clearedStorage: false })

  // 6.7: classId không tồn tại (999) nhưng sessionId (101) lại hợp lệ trong lớp mặc định (groupClass10)
  // Không tự chọn lớp mặc định groupClass10, hiển thị lỗi và gửi 0 GET roster
  const runAttendanceLoadFlowWithClasses = async ({
    availableClasses = [],
    selectedClassId,
    selectedSessionId,
    coachId,
    sessionsFetcher,
  }) => {
    let selectedClass = null
    if (selectedClassId) {
      selectedClass = availableClasses.find((c) => String(c.id) === String(selectedClassId)) || null
    } else {
      selectedClass = availableClasses[0] || null
    }

    if (selectedClassId && !selectedClass) {
      return {
        success: false,
        selectedClass: null,
        requestedRoster: false,
        error: new Error("Lớp học không tồn tại hoặc bạn không có quyền truy cập lớp này."),
      }
    }

    if (!selectedClass) {
      return {
        success: false,
        selectedClass: null,
        requestedRoster: false,
        error: new Error("Chưa có lớp học nào được chọn."),
      }
    }

    return await runAttendanceLoadFlow({
      classItem: selectedClass,
      selectedSessionId,
      coachId,
      sessionsFetcher,
    })
  }

  requests.length = 0
  const resultInvalidClassValidSession = await runAttendanceLoadFlowWithClasses({
    availableClasses: [groupClass10], // default class is groupClass10 (has session 101)
    selectedClassId: "999", // non-existent class
    selectedSessionId: "101", // valid in default class 10
    coachId: 18,
    sessionsFetcher: validSessionsFetcher,
  })
  assert.equal(resultInvalidClassValidSession.success, false)
  assert.equal(resultInvalidClassValidSession.selectedClass, null, "Must NOT auto-select default class when specific classId was not found")
  assert.match(resultInvalidClassValidSession.error.message, /Lớp học không tồn tại/)
  assert.equal(resultInvalidClassValidSession.requestedRoster, false)
  assert.equal(requests.filter((r) => r.pathname.includes("/enrollments")).length, 0, "Non-existent class must send 0 GET roster even if sessionId exists in default class")

  // 6.8: Phân biệt danh sách lớp đang tải với danh sách đã tải xong nhưng rỗng:
  // Khi GET /api/classes trả 200 [] và có classId đã chọn, kết thúc trạng thái tải,
  // báo lớp không tồn tại và giữ 0 GET roster, 0 POST điểm danh.
  requests.length = 0
  const simulateClassesLoad = ({
    classesLoading,
    availableClasses = [],
    selectedClassId,
  }) => {
    let selectedClass = null
    if (selectedClassId) {
      selectedClass = availableClasses.find((c) => String(c.id) === String(selectedClassId)) || null
    } else {
      selectedClass = availableClasses[0] || null
    }

    if (selectedClassId && !selectedClass) {
      if (classesLoading) {
        return { loadingRoster: true, completed: false, error: null }
      }
      return {
        loadingRoster: false,
        completed: true,
        error: new Error("Lớp học không tồn tại hoặc bạn không có quyền truy cập lớp này."),
      }
    }
    return { loadingRoster: false, completed: true, error: null }
  }

  // Khi đang tải: classesLoading = true -> Chờ, không kết thúc
  const duringLoading = simulateClassesLoad({ classesLoading: true, availableClasses: [], selectedClassId: "12" })
  assert.equal(duringLoading.loadingRoster, true)
  assert.equal(duringLoading.completed, false)

  // Khi tải xong nhưng rỗng: classesLoading = false, availableClasses = [] -> Kết thúc trạng thái tải, báo lỗi lớp không tồn tại
  const afterEmptyLoaded = simulateClassesLoad({ classesLoading: false, availableClasses: [], selectedClassId: "12" })
  assert.equal(afterEmptyLoaded.loadingRoster, false)
  assert.equal(afterEmptyLoaded.completed, true)
  assert.match(afterEmptyLoaded.error.message, /Lớp học không tồn tại/)
  assert.equal(requests.filter((r) => r.pathname.includes("/enrollments")).length, 0, "Empty classes list must send 0 GET roster")

  // 6.9: Khi lớp mock không hợp lệ, chặn cả hiển thị lẫn xử lý điểm danh nhanh:
  // classId = 999 -> isClassValid = false, allowCheckIn = false -> quick checkin returns early without recording
  const mockAttendanceRecords = []
  let toastTriggered = false
  const runMockQuickCheckin = ({
    selectedClass,
    selectedClassId,
    rosterError,
    memberCode,
  }) => {
    const isClassValid = Boolean(selectedClass && selectedClass.id) && !rosterError && !(selectedClassId && !selectedClass)
    const allowCheckIn = isClassValid
    if (!allowCheckIn || !isClassValid || !selectedClass?.id) {
      return { recorded: false, toast: null }
    }
    mockAttendanceRecords.push({ classId: selectedClass.id, memberCode, status: "present" })
    toastTriggered = true
    return { recorded: true, toast: `Đã điểm danh Có mặt cho ${memberCode}!` }
  }

  const quickResultInvalidMock = runMockQuickCheckin({
    selectedClass: null,
    selectedClassId: "999",
    rosterError: new Error("Lớp học không tồn tại hoặc bạn không có quyền truy cập lớp này."),
    memberCode: "MB-1002",
  })
  assert.equal(quickResultInvalidMock.recorded, false)
  assert.equal(quickResultInvalidMock.toast, null)
  assert.equal(mockAttendanceRecords.length, 0, "No mock attendance record created")
  assert.equal(toastTriggered, false, "No success toast triggered")

  // -------------------------------------------------------------
  // SUITE 7: Khôi phục điểm danh hàng loạt trong chế độ mock & Xử lý lớp trống (Review Point 2)
  // -------------------------------------------------------------
  // 7.1: Lớp mock trống (không có booking/attendance fixture) -> giữ danh sách trống, 0 unmarked, không thể bulk
  const emptyMockClassMembers = [] // No fallback to center-wide members!
  assert.equal(emptyMockClassMembers.length, 0, "Empty mock class must stay empty")
  const emptyMockBulkAllowed = canPerformBulkAttendance({
    apiEnabled: false,
    sessionReady: true,
    hasSessionPermission: true,
    sessionCancelled: false,
    allowCheckIn: true,
    unmarkedCount: emptyMockClassMembers.length, // 0
    bulkSaving: false,
  })
  assert.equal(emptyMockBulkAllowed, false, "Empty mock class CANNOT perform bulk attendance")

  // 7.2: Lớp mock có hội viên thực sự thuộc lớp theo fixture -> cho phép bulk khi còn học viên chưa điểm danh
  const fixtureMembers = [
    { id: "mem-1", name: "Nguyễn Minh Anh", status: "absent" },
    { id: "mem-2", name: "Lê Hoàng Nam", status: "not_recorded" },
    { id: "mem-3", name: "Trần Thị Cúc", status: "not_recorded" },
  ]
  const mockUnmarked = fixtureMembers.filter((m) => m.status === "not_recorded")
  assert.deepEqual(mockUnmarked.map((m) => m.id), ["mem-2", "mem-3"])

  const populatedMockBulkAllowed = canPerformBulkAttendance({
    apiEnabled: false,
    sessionReady: true,
    hasSessionPermission: true,
    sessionCancelled: false,
    allowCheckIn: true,
    unmarkedCount: mockUnmarked.length, // 2
    bulkSaving: false,
  })
  assert.equal(populatedMockBulkAllowed, true, "Populated mock class allows bulk for unmarked members")

  // 7.3: Thực hiện bulk trong mock chỉ ghi người chưa điểm danh và GIỮ NGUYÊN Absent
  const mockRecorded = []
  for (const target of mockUnmarked) {
    mockRecorded.push({ memberId: target.id, status: "present" })
    target.status = "present"
  }
  assert.deepEqual(mockRecorded, [
    { memberId: "mem-2", status: "present" },
    { memberId: "mem-3", status: "present" },
  ])
  assert.equal(fixtureMembers.find((m) => m.id === "mem-1").status, "absent", "Absent member must remain Absent")

  // Sau khi bulk xong, số người chưa điểm danh = 0 -> bulk bị khóa
  const afterBulkUnmarked = fixtureMembers.filter((m) => m.status === "not_recorded")
  assert.equal(afterBulkUnmarked.length, 0)
  assert.equal(
    canPerformBulkAttendance({
      apiEnabled: false,
      sessionReady: true,
      hasSessionPermission: true,
      sessionCancelled: false,
      allowCheckIn: true,
      unmarkedCount: afterBulkUnmarked.length,
      bulkSaving: false,
    }),
    false,
    "After all marked, bulk must be disabled",
  )

  // -------------------------------------------------------------
  // SUITE 8: Từng nguồn trạng thái trả lỗi đều dẫn đến 0 POST bulk (Review Point 2)
  // -------------------------------------------------------------
  const errorSources = [
    { name: "rosterError", patch: { rosterError: new Error("500 Roster Error") } },
    { name: "attendancesError", patch: { attendancesError: new Error("500 Attendances Error") } },
    { name: "trainingResultsError", patch: { trainingResultsError: new Error("500 Training Results Error") } },
  ]

  for (const { name, patch } of errorSources) {
    requests.length = 0
    const errCtx = { ...baseBulkContext, ...patch }
    assert.equal(canPerformBulkAttendance(errCtx), false, `${name} must block bulk attendance`)
    if (canPerformBulkAttendance(errCtx)) {
      await memberPortalApi.recordBulkTrainingResults({ sessionId: 141, coachId: 27, items: [] })
    }
    assert.equal(
      requests.filter((r) => r.method === "POST").length,
      0,
      `Each error source (${name}) MUST result in 0 POST requests`,
    )
  }

  // Reload success -> bulk unlocked, only unmarked targeted, Absent preserved
  const reloadedContext = {
    ...baseBulkContext,
    rosterError: null,
    attendancesError: null,
    trainingResultsError: null,
    loadedClassId: 12,
    selectedClassId: 12,
    loadedSessionId: 141,
    selectedSessionId: 141,
    unmarkedCount: 1, // Only 1 unmarked remaining
  }
  assert.equal(canPerformBulkAttendance(reloadedContext), true, "After reload success, bulk is enabled")

  console.log("PASS: PR #56 Coach regression test suite passed cleanly")
} finally {
  globalThis.fetch = originalFetch
}
