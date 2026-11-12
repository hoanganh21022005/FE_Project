import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { CoachStatusBadge } from "../coach/StatusBadge"
import { formatDate, formatTime, formatTimeRange } from "../../utils/datetime"
import { formatMemberCode } from "../../utils/formatMember"
import { classEnrollmentApi } from "../../api/classEnrollmentApi"
import { attendanceApi, matchesSessionAttendance } from "../../api/attendanceApi"
import { memberPortalApi } from "../../api/memberPortalApi"
import { getCatalogClassSessions } from "../../api/managerApi"
import { getErrorMessage } from "../../api/apiErrors"
import { isActiveNormalEnrollment } from "../../utils/memberScheduleUtils"
import {
  canCheckIn,
  canCorrectAttendance,
  isSessionCancelled,
  normalizeSessionStatus,
  verifyCoachSessionPermission,
  canPerformBulkAttendance,
} from "../../utils/permissions"
import {
  ClipboardCheck,
  RefreshCw,
  CheckCheck,
  AlertCircle,
  Search,
  X,
  Check,
  Clock,
  FileText,
  XCircle,
  Users,
  UserCheck,
} from "lucide-react"

export function CoachAttendanceView() {
  const {
    classes,
    classesLoading,
    members,
    attendance,
    bookings,
    currentUser,
    recordAttendance,
    apiEnabled,
    showToast,
    language,
    t,
  } = useSCMS()

  const resolvedCoachId = useMemo(() => {
    const raw = currentUser?.coachId ?? (apiEnabled ? null : currentUser?.id)
    const num = Number(raw)
    return Number.isInteger(num) && num > 0 ? num : apiEnabled ? null : 1
  }, [apiEnabled, currentUser?.coachId, currentUser?.id])

  const [selectedClassId, setSelectedClassId] = useState(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search)
      const urlClassId = urlParams.get("classId")
      if (urlClassId) return urlClassId
      const savedCoach = sessionStorage.getItem("scms_selected_attendance_coach_id")
      const currentCoachStr = currentUser?.coachId ? String(currentUser.coachId) : currentUser?.id ? String(currentUser.id) : null
      if (savedCoach && currentCoachStr && savedCoach !== currentCoachStr) {
        sessionStorage.removeItem("scms_selected_attendance_class_id")
        sessionStorage.removeItem("scms_selected_attendance_session_id")
        sessionStorage.setItem("scms_selected_attendance_coach_id", currentCoachStr)
        return ""
      }
      return sessionStorage.getItem("scms_selected_attendance_class_id") || ""
    }
    return ""
  })
  const [substituteClassIds, setSubstituteClassIds] = useState(() => new Set())
  const [coachClassesFromSessions, setCoachClassesFromSessions] = useState([])
  const [coachPtSessions, setCoachPtSessions] = useState([])

  // Drop old selection when coach account switches
  useEffect(() => {
    if (typeof window === "undefined" || !resolvedCoachId) return
    const savedCoach = sessionStorage.getItem("scms_selected_attendance_coach_id")
    const urlParams = new URLSearchParams(window.location.search)
    const hasUrlClass = Boolean(urlParams.get("classId"))
    if (savedCoach && String(savedCoach) !== String(resolvedCoachId)) {
      sessionStorage.removeItem("scms_selected_attendance_class_id")
      sessionStorage.removeItem("scms_selected_attendance_session_id")
      sessionStorage.setItem("scms_selected_attendance_coach_id", String(resolvedCoachId))
      if (!hasUrlClass) {
        setSelectedClassId("")
        setSelectedSessionId("")
      }
    } else if (!savedCoach) {
      sessionStorage.setItem("scms_selected_attendance_coach_id", String(resolvedCoachId))
    }
  }, [resolvedCoachId])

  // Prefetch coach sessions to discover substitute classes and PT 1:1 sessions
  useEffect(() => {
    if (!apiEnabled || !resolvedCoachId) return
    let active = true
    memberPortalApi
      .getClassSessions({ coachId: resolvedCoachId })
      .then((sessions) => {
        if (!active || !Array.isArray(sessions)) return
        const subIds = new Set()
        const classesById = new Map()
        const ptSessionsList = []
        sessions.forEach((s) => {
          if (s.isPrivate === true) {
            ptSessionsList.push(s)
          }
          const isNormalSession = s.isPrivate === false ||
            String(s.classType || "").trim().toLowerCase() === "normal"
          if (s.classId != null && isNormalSession) {
            const classId = String(s.classId)
            subIds.add(classId)
            const existing = classesById.get(classId) || {}
            const className = s.className || existing.name || `Lớp #${classId}`
            classesById.set(classId, {
              ...existing,
              id: s.classId,
              name: className,
              nameVi: className,
              category: s.subjectName || existing.category || "Thể thao",
              classType: "Normal",
              coachId: s.coachId ?? resolvedCoachId,
              coachName: s.coachName || existing.coachName || currentUser?.name || "",
              room: s.roomName || existing.room || "Sân tập trung tâm",
              roomVi: s.roomName || existing.roomVi || "Sân tập trung tâm",
              capacity: s.maxCapacity ?? existing.capacity ?? null,
              enrolledCount: s.enrolledCount ?? existing.enrolledCount ?? 0,
              startDate: s.sessionDate || existing.startDate || null,
              date: s.sessionDate || existing.date || null,
              startTime: s.startTime || existing.startTime || null,
              endTime: s.endTime || existing.endTime || null,
            })
          }
        })
        setSubstituteClassIds(subIds)
        setCoachClassesFromSessions(Array.from(classesById.values()))
        setCoachPtSessions(ptSessionsList)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [apiEnabled, currentUser?.name, resolvedCoachId])

  const coachClasses = useMemo(() => {
    const fallbackClassMap = new Map(
      coachClassesFromSessions.map((cls) => [String(cls.id), cls]),
    )
    const coachNameLower = String(currentUser?.name || "").trim().toLowerCase()
    const matched = classes.filter((c) => {
      if (apiEnabled) {
        return resolvedCoachId != null && String(c.coachId) === String(resolvedCoachId)
      }
      return (
        String(c.coachId) === String(resolvedCoachId) ||
        (currentUser?.id && String(c.coachId) === String(currentUser.id)) ||
        (coachNameLower &&
          String(c.coachName || "")
            .trim()
            .toLowerCase()
            .includes(coachNameLower))
      )
    })
    const matchedIds = new Set(matched.map((c) => String(c.id)))
    const additionalClasses = []

    // Include selectedClassId from sessionStorage / URL if it exists in classes
    if (selectedClassId && !matchedIds.has(String(selectedClassId)) && selectedClassId !== "PT_1ON1") {
      const targetClass = classes.find((c) => String(c.id) === String(selectedClassId)) || fallbackClassMap.get(String(selectedClassId))
      if (targetClass) {
        additionalClasses.push({
          ...targetClass,
          isSubstitute: String(targetClass.coachId) !== String(resolvedCoachId),
        })
        matchedIds.add(String(targetClass.id))
      }
    }

    // Include other substitute classes discovered from coach sessions
    substituteClassIds.forEach((clsId) => {
      if (!matchedIds.has(String(clsId)) && clsId !== "PT_1ON1") {
        const targetClass = classes.find((c) => String(c.id) === String(clsId)) || fallbackClassMap.get(String(clsId))
        if (targetClass) {
          additionalClasses.push({
            ...targetClass,
            isSubstitute: String(targetClass.coachId) !== String(resolvedCoachId),
          })
          matchedIds.add(String(targetClass.id))
        }
      }
    })

    const ptVirtual = {
      id: "PT_1ON1",
      name: "PT 1:1 Sessions",
      nameVi: "Ca kèm PT 1:1",
      isPrivateVirtualClass: true,
      capacity: 1,
      enrolledCount: apiEnabled ? 0 : 1,
      room: "Sân tập PT",
      roomVi: "Sân tập PT",
    }
    return [...matched, ...additionalClasses, ptVirtual]
  }, [apiEnabled, classes, coachClassesFromSessions, resolvedCoachId, currentUser?.id, currentUser?.name, selectedClassId, substituteClassIds])

  const prevSelectedClassRef = useRef(null)
  const selectedClass = useMemo(() => {
    let found = null
    if (selectedClassId) {
      found = coachClasses.find((c) => String(c.id) === String(selectedClassId)) || null
    } else {
      found = coachClasses[0] || null
    }
    if (!found) {
      prevSelectedClassRef.current = null
      return null
    }
    const prev = prevSelectedClassRef.current
    if (
      prev &&
      String(prev.id) === String(found.id) &&
      String(prev.coachId) === String(found.coachId) &&
      prev.name === found.name &&
      Boolean(prev.isSubstitute) === Boolean(found.isSubstitute)
    ) {
      return prev
    }
    prevSelectedClassRef.current = found
    return found
  }, [coachClasses, selectedClassId])

  const normalClasses = useMemo(() => {
    return coachClasses.filter((c) => String(c.id) !== "PT_1ON1")
  }, [coachClasses])

  const [attendanceMode, setAttendanceMode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("scms_selected_attendance_class_id")
      if (saved === "PT_1ON1") return "advanced"
    }
    return "normal"
  })

  useEffect(() => {
    if (selectedClassId === "PT_1ON1") {
      setAttendanceMode("advanced")
    } else if (selectedClassId && selectedClassId !== "PT_1ON1") {
      setAttendanceMode("normal")
    }
  }, [selectedClassId])

  const handleModeChange = (mode) => {
    setAttendanceMode(mode)
    if (mode === "advanced") {
      setSelectedClassId("PT_1ON1")
      setSelectedSessionId("")
      if (typeof window !== "undefined") {
        sessionStorage.setItem("scms_selected_attendance_class_id", "PT_1ON1")
      }
    } else {
      const firstNormal = normalClasses[0] || null
      const nextId = firstNormal ? String(firstNormal.id) : ""
      setSelectedClassId(nextId)
      setSelectedSessionId("")
      if (typeof window !== "undefined") {
        if (nextId) sessionStorage.setItem("scms_selected_attendance_class_id", nextId)
        else sessionStorage.removeItem("scms_selected_attendance_class_id")
      }
    }
  }

  useEffect(() => {
    if (selectedClass?.id && typeof window !== "undefined" && resolvedCoachId) {
      sessionStorage.setItem("scms_selected_attendance_coach_id", String(resolvedCoachId))
      sessionStorage.setItem("scms_selected_attendance_class_id", String(selectedClass.id))
    }
  }, [selectedClass?.id, resolvedCoachId])

  const [apiEnrollments, setApiEnrollments] = useState([])
  const [apiAttendances, setApiAttendances] = useState([])
  const [sessionTrainingResults, setSessionTrainingResults] = useState([])
  const [classTrainingPlans, setClassTrainingPlans] = useState([])
  const [sessionAbsenceNotices, setSessionAbsenceNotices] = useState([])
  const [classSessions, setClassSessions] = useState([])
  const [selectedSessionId, setSelectedSessionId] = useState(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search)
      const urlSessionId = urlParams.get("sessionId")
      if (urlSessionId) return urlSessionId
      const savedCoach = sessionStorage.getItem("scms_selected_attendance_coach_id")
      const currentCoachStr = currentUser?.coachId ? String(currentUser.coachId) : currentUser?.id ? String(currentUser.id) : null
      if (savedCoach && currentCoachStr && savedCoach !== currentCoachStr) {
        return ""
      }
      return sessionStorage.getItem("scms_selected_attendance_session_id") || ""
    }
    return ""
  })
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [rosterError, setRosterError] = useState(null)
  const [attendancesError, setAttendancesError] = useState(null)
  const [trainingResultsError, setTrainingResultsError] = useState(null)
  const [loadedClassId, setLoadedClassId] = useState(null)
  const [loadedSessionId, setLoadedSessionId] = useState(null)
  const rosterRequestId = useRef(0)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false)
  const [quickMemberInput, setQuickMemberInput] = useState("")
  const [quickSaving, setQuickSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [optimisticStatusMap, setOptimisticStatusMap] = useState({})
  const [savingStateByMember, setSavingStateByMember] = useState({})

  const todayIso = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    [],
  )

  const loadClassRosterAndAttendance = useCallback(async () => {
    if (!resolvedCoachId) return
    const requestId = ++rosterRequestId.current
    setLoadingRoster(true)
    setRosterError(null)
    setAttendancesError(null)
    setTrainingResultsError(null)

    // Requirement 1: Khi đã có classId cụ thể từ lịch, URL hoặc sessionStorage,
    // chỉ xác minh sessionId với đúng lớp đó. Nếu classId không hợp lệ hoặc không
    // tìm thấy sau khi tải dữ liệu, hiển thị lỗi, không tự chọn lớp mặc định
    // và không gửi GET roster hay POST điểm danh.
    if (selectedClassId && !selectedClass) {
      if (apiEnabled && classesLoading) {
        // Classes are still loading from API; wait for them to load
        return
      }
      if (requestId !== rosterRequestId.current) return
      setApiEnrollments([])
      setApiAttendances([])
      setClassTrainingPlans([])
      setSessionTrainingResults([])
      setSessionAbsenceNotices([])
      setClassSessions([])
      setLoadedClassId(null)
      setLoadedSessionId(null)
      setRosterError(
        new Error(
          language === "vi"
            ? "Lớp học không tồn tại hoặc bạn không có quyền truy cập lớp này."
            : "Class not found or you do not have permission to access it.",
        ),
      )
      setLoadingRoster(false)
      return
    }

    if (!selectedClass?.id) {
      setLoadingRoster(false)
      return
    }

    if (!apiEnabled) {
      setLoadingRoster(false)
      return
    }

    try {
      const isPtMode = String(selectedClass.id) === "PT_1ON1"

      // STEP 1: Fetch session data first to resolve target session and verify assignment
      const [catalogSessionsRes, allClassSessionsRes] = await Promise.all([
        isPtMode
          ? Promise.resolve({ data: [] })
          : getCatalogClassSessions(selectedClass.id, {
              notifyForbidden: false,
            }).then(
              (data) => ({ data: Array.isArray(data) ? data : [] }),
              (error) => ({ data: [], error }),
            ),
        isPtMode
          ? memberPortalApi
              .getClassSessions(
                resolvedCoachId ? { coachId: resolvedCoachId } : {},
              )
              .then((list) => ({
                data: (Array.isArray(list) ? list : []).filter(
                  (s) => s.isPrivate === true,
                ),
              }))
              .catch((error) => ({ data: [], error }))
          : memberPortalApi
              .getClassSessions({ classId: selectedClass.id })
              .then(
                (data) => ({ data: Array.isArray(data) ? data : [] }),
                (error) => ({ data: [], error }),
              ),
      ])

      if (requestId !== rosterRequestId.current) return

      // Kiểm tra nguồn phân công lỗi
      if (allClassSessionsRes.error || catalogSessionsRes.error) {
        const fetchErr = allClassSessionsRes.error || catalogSessionsRes.error
        setApiEnrollments([])
        setApiAttendances([])
        setClassTrainingPlans([])
        setSessionTrainingResults([])
        setSessionAbsenceNotices([])
        setLoadedClassId(null)
        setLoadedSessionId(null)
        setRosterError(
          new Error(
            getErrorMessage(
              fetchErr,
              "Lỗi nguồn phân công buổi học. Không thể tải danh sách điểm danh.",
            ),
          ),
        )
        return
      }

      const catalogSessions = catalogSessionsRes.data || []
      const allClassSessions = allClassSessionsRes.data || []

      // Merge /api/sessions?classId= (which includes Completed + Scheduled + Cancelled)
      // with /api/sessions/catalog/{classId} so we have the FULL course session list (R1.1 & R1.3)
      const sessionMap = new Map()
      const upsertSession = (s) => {
        if (!s || !s.id) return
        const prev = sessionMap.get(String(s.id)) || {}
        sessionMap.set(String(s.id), {
          ...prev,
          ...s,
          status: s.status || prev.status || null,
          centerInvalidated:
            s.centerInvalidated === true || prev.centerInvalidated === true,
        })
      }
      catalogSessions.forEach(upsertSession)
      allClassSessions.forEach(upsertSession)

      const sortedSessions = Array.from(sessionMap.values())
        .sort((a, b) => {
          const dA = `${a.sessionDate || ""}T${a.startTime || "00:00"}`
          const dB = `${b.sessionDate || ""}T${b.startTime || "00:00"}`
          return dA.localeCompare(dB)
        })
        .map((s, idx) => ({
          ...s,
          computedOrderNumber: s.sessionNumber || idx + 1,
        }))

      setClassSessions(sortedSessions)

      let targetSession = null

      if (selectedSessionId) {
        // Khi mở từ lịch hoặc F5 với cặp classId/sessionId cụ thể:
        // Xác minh ĐÚNG cặp đó và quyền phân công thực tế của Coach.
        targetSession = sortedSessions.find(
          (s) => String(s.id) === String(selectedSessionId),
        )
        if (!targetSession) {
          // Buổi không tồn tại trong lớp đã chọn hoặc cặp sai!
          if (requestId !== rosterRequestId.current) return
          setApiEnrollments([])
          setApiAttendances([])
          setClassTrainingPlans([])
          setSessionTrainingResults([])
          setSessionAbsenceNotices([])
          setLoadedClassId(null)
          setLoadedSessionId(null)
          setRosterError(
            new Error(
              "Buổi học không tồn tại trong lớp đã chọn hoặc cặp lớp/buổi không hợp lệ.",
            ),
          )
          return
        }
      } else {
        // CHỈ tự chọn buổi khi người dùng mở màn hình mà chưa chọn buổi cụ thể:
        const coachAssignedUpcoming = sortedSessions.find(
          (s) =>
            !isSessionCancelled(s) &&
            canCheckIn(s) &&
            (s.coachId != null
              ? String(s.coachId) === String(resolvedCoachId)
              : String(selectedClass?.coachId) === String(resolvedCoachId)) &&
            String(s.sessionDate || "") >= todayIso,
        )
        const coachAssignedAny = sortedSessions.find(
          (s) =>
            !isSessionCancelled(s) &&
            (s.coachId != null
              ? String(s.coachId) === String(resolvedCoachId)
              : String(selectedClass?.coachId) === String(resolvedCoachId)),
        )
        const nextScheduled = sortedSessions.find(
          (s) =>
            !isSessionCancelled(s) &&
            canCheckIn(s) &&
            String(s.sessionDate || "") >= todayIso,
        )
        targetSession =
          coachAssignedUpcoming ||
          coachAssignedAny ||
          nextScheduled ||
          sortedSessions.find((s) => !isSessionCancelled(s)) ||
          sortedSessions[0] ||
          null

        if (!targetSession) {
          if (requestId !== rosterRequestId.current) return
          setApiEnrollments([])
          setApiAttendances([])
          setClassTrainingPlans([])
          setSessionTrainingResults([])
          setSessionAbsenceNotices([])
          setLoadedClassId(null)
          setLoadedSessionId(null)
          setRosterError(new Error("Lớp học này hiện chưa có buổi học nào."))
          return
        }

        setSelectedSessionId(String(targetSession.id))
      }

      const effectiveSessionId = String(targetSession.id)

      // STEP 2: Xác minh quyền phân công thực tế của Coach trước khi tải roster!
      const perm = verifyCoachSessionPermission({
        session: targetSession,
        classItem: selectedClass,
        coachId: resolvedCoachId,
      })

      if (!perm.allowed) {
        // Ngoài quyền hoặc sai cặp: dừng ngay, gửi 0 GET roster, 0 POST điểm danh!
        if (requestId !== rosterRequestId.current) return
        setApiEnrollments([])
        setApiAttendances([])
        setClassTrainingPlans([])
        setSessionTrainingResults([])
        setSessionAbsenceNotices([])
        setLoadedClassId(null)
        setLoadedSessionId(null)
        setRosterError(
          new Error(
            perm.messageVi ||
              perm.reason ||
              "Coach không được phân công cho cặp lớp và buổi học này.",
          ),
        )
        return
      }

      // STEP 3: Coach đã được xác minh quyền thực tế! Tiến hành tải danh sách học viên
      const [
        rosterRes,
        attendancesRes,
        plans,
        trRes,
        nRes,
      ] = await Promise.all([
        isPtMode
          ? Promise.resolve({ enrollments: [] })
          : classEnrollmentApi
              .getEnrollmentsByClass(selectedClass.id, { strict: true })
              .then(
                (enrollments) => ({
                  enrollments: Array.isArray(enrollments) ? enrollments : [],
                }),
                (error) => ({ enrollments: [], error }),
              ),
        attendanceApi
          .searchAttendances()
          .then(
            (data) => ({ data: Array.isArray(data) ? data : [] }),
            (error) => ({ data: [], error }),
          ),
        isPtMode
          ? Promise.resolve([])
          : memberPortalApi
              .getTrainingPlans({ classId: selectedClass.id })
              .catch(() => []),
        memberPortalApi
          .getTrainingResults({ sessionId: effectiveSessionId })
          .then(
            (data) => ({ data: Array.isArray(data) ? data : [] }),
            (error) => ({ data: [], error }),
          ),
        memberPortalApi
          .getSessionAbsenceNotices(effectiveSessionId)
          .then(
            (data) => ({ data: Array.isArray(data) ? data : [] }),
            (error) => ({ data: [], error }),
          ),
      ])

      if (requestId !== rosterRequestId.current) return
      setApiEnrollments(rosterRes.enrollments || [])
      setRosterError(rosterRes.error || null)
      setApiAttendances(attendancesRes.data || [])
      setAttendancesError(attendancesRes.error || null)
      setClassTrainingPlans(Array.isArray(plans) ? plans : [])
      setSessionTrainingResults(trRes.data || [])
      setTrainingResultsError(trRes.error || null)
      setSessionAbsenceNotices(nRes.data || [])

      if (!rosterRes.error && !attendancesRes.error && !trRes.error) {
        setLoadedClassId(String(selectedClass.id))
        setLoadedSessionId(effectiveSessionId)
        if (typeof window !== "undefined" && resolvedCoachId) {
          sessionStorage.setItem("scms_selected_attendance_coach_id", String(resolvedCoachId))
          sessionStorage.setItem("scms_selected_attendance_session_id", effectiveSessionId)
        }
      } else {
        setLoadedClassId(null)
        setLoadedSessionId(null)
      }
    } catch (unexpectedError) {
      if (requestId === rosterRequestId.current) {
        setRosterError(unexpectedError)
        setLoadedClassId(null)
        setLoadedSessionId(null)
      }
    } finally {
      if (requestId === rosterRequestId.current) setLoadingRoster(false)
    }
  }, [apiEnabled, classesLoading, resolvedCoachId, selectedClass, selectedSessionId, todayIso])

  useEffect(() => {
    loadClassRosterAndAttendance()
    return () => { rosterRequestId.current += 1 }
  }, [loadClassRosterAndAttendance])

  const activeSession = useMemo(() => {
    if (classSessions.length === 0) {
      return { status: "Scheduled", computedOrderNumber: 1 }
    }
    return (
      classSessions.find((s) => String(s.id) === String(selectedSessionId)) ||
      classSessions[0] || { status: "Scheduled", computedOrderNumber: 1 }
    )
  }, [classSessions, selectedSessionId])

  const totalClassSessions = useMemo(() => {
    return Math.max(
      classSessions.length,
      Number(
        selectedClass?.totalSessions ||
          selectedClass?.sessionCount ||
          classSessions.length ||
          1,
      ),
    )
  }, [classSessions.length, selectedClass?.totalSessions, selectedClass?.sessionCount])

  const enrolledMembers = useMemo(() => {
    if (rosterError || (selectedClassId && !selectedClass)) return []
    const rosterMap = new Map()
    const upsertMember = (id, name, code) => {
      if (id == null) return
      const key = String(id)
      const matched = (members || []).find((m) => String(m.id) === key || String(m.code) === key)
      const existing = rosterMap.get(key)
      rosterMap.set(key, {
        id,
        name:
          name ||
          existing?.name ||
          matched?.name ||
          `Học viên #${id}`,
        code:
          code ||
          existing?.code ||
          matched?.code ||
          (Number.isInteger(Number(id)) && Number(id) > 0
            ? formatMemberCode(Number(id))
            : String(id)),
      })
    }

    if (!apiEnabled) {
      ;(bookings || [])
        .filter((b) => String(b.classId) === String(selectedClass?.id))
        .forEach((b) => upsertMember(b.memberId, b.memberName, b.memberCode || b.code))

      ;(attendance || [])
        .filter((a) => String(a.classId) === String(selectedClass?.id))
        .forEach((a) => upsertMember(a.memberId, a.memberName, a.memberCode || a.code))

      if (activeSession?.bookedMemberId) {
        upsertMember(
          activeSession.bookedMemberId,
          activeSession.bookedMemberName,
          null,
        )
      }

      return Array.from(rosterMap.values())
    }

    const activeList = apiEnrollments.filter((enr) =>
      isActiveNormalEnrollment(enr),
    )
    activeList.forEach((enr) =>
      upsertMember(enr.memberId, enr.memberName, enr.memberCode),
    )

    if (activeSession?.bookedMemberId) {
      upsertMember(
        activeSession.bookedMemberId,
        activeSession.bookedMemberName,
        null,
      )
    }

    sessionTrainingResults.forEach((res) =>
      upsertMember(res.memberId, res.memberName, null),
    )

    apiAttendances
      .filter(
        (a) =>
          (selectedSessionId &&
            String(a.sessionId) === String(selectedSessionId)) ||
          (selectedClass?.id &&
            String(a.classId) === String(selectedClass.id)) ||
          classSessions.some((cs) => String(cs.id) === String(a.sessionId)),
      )
      .forEach((att) =>
        upsertMember(att.memberId, att.memberName, att.memberCode),
      )

    classTrainingPlans.forEach((plan) =>
      upsertMember(plan.memberId, plan.memberName, null),
    )

    sessionAbsenceNotices.forEach((notice) =>
      upsertMember(notice.memberId, notice.memberName, null),
    )

    return Array.from(rosterMap.values())
  }, [
    apiEnabled,
    rosterError,
    bookings,
    attendance,
    members,
    selectedClass?.id,
    apiEnrollments,
    activeSession,
    sessionTrainingResults,
    apiAttendances,
    selectedSessionId,
    classSessions,
    classTrainingPlans,
    sessionAbsenceNotices,
  ])

  const normalizeAttendanceStatus = (state) => {
    const s = String(state || "").toLowerCase()
    if (s.includes("present") || s.includes("checked")) return "present"
    if (s.includes("excuse")) return "excused"
    if (s.includes("late")) return "late"
    if (s.includes("absent")) return "absent"
    return "not_recorded"
  }

  // R1.2: Strictly match attendance ONLY for the currently selected session (selectedSessionId).
  // Never leak attendance status from a past session onto an upcoming session!
  // Pre-reported absence notices (sessionAbsenceNotices) are kept separate from currentStatus.
  const getMemberStatusAndMeta = useCallback(
    (m) => {
      const optKey = `${selectedSessionId || selectedClass?.id || "cls"}_${m.id}`
      const optVal = optimisticStatusMap[optKey]

      const localAtt = !apiEnabled && (attendance || []).find(
        (a) =>
          String(a.memberId) === String(m.id) &&
          (a.sessionId && selectedSessionId
            ? String(a.sessionId) === String(selectedSessionId)
            : String(a.classId) === String(selectedClass?.id)),
      )
      const sessionResultAtt = selectedSessionId
        ? sessionTrainingResults.find(
            (r) =>
              String(r.memberId) === String(m.id) &&
              String(r.sessionId) === String(selectedSessionId),
          )
        : null
      const backendAtt = selectedSessionId
        ? apiAttendances.find(
            (a) =>
              String(a.memberId) === String(m.id) &&
              String(a.sessionId) === String(selectedSessionId),
          )
        : null

      const sessionStatus = sessionResultAtt?.attendanceStatus
        ? normalizeAttendanceStatus(sessionResultAtt.attendanceStatus)
        : null
      const backendStatus = backendAtt?.state
        ? normalizeAttendanceStatus(backendAtt.state)
        : null

      const currentStatus =
        optVal ||
        (localAtt
          ? localAtt.status
          : sessionStatus && sessionStatus !== "not_recorded"
            ? sessionStatus
            : backendStatus && backendStatus !== "not_recorded"
              ? backendStatus
              : "not_recorded")

      const attendanceId =
        localAtt?.attendanceId || backendAtt?.attendanceId || null

      const absenceNotice = sessionAbsenceNotices.find(
        (n) =>
          String(n.memberId) === String(m.id) ||
          (n.memberName &&
            String(n.memberName).toLowerCase() ===
              String(m.name || "").toLowerCase()),
      )

      const saveState = savingStateByMember[optKey] || null

      return { currentStatus, attendanceId, absenceNotice, saveState }
    },
    [
      selectedSessionId,
      selectedClass?.id,
      apiEnabled,
      optimisticStatusMap,
      attendance,
      sessionTrainingResults,
      apiAttendances,
      sessionAbsenceNotices,
      savingStateByMember,
    ],
  )

  const summaryCounts = useMemo(() => {
    const counts = {
      present: 0,
      late: 0,
      excused: 0,
      absent: 0,
      not_recorded: 0,
    }
    enrolledMembers.forEach((m) => {
      const { currentStatus } = getMemberStatusAndMeta(m)
      if (counts[currentStatus] !== undefined) {
        counts[currentStatus] += 1
      } else {
        counts.not_recorded += 1
      }
    })
    return counts
  }, [enrolledMembers, getMemberStatusAndMeta])

  const unmarkedMembers = useMemo(
    () =>
      enrolledMembers.filter(
        (m) => getMemberStatusAndMeta(m).currentStatus === "not_recorded",
      ),
    [enrolledMembers, getMemberStatusAndMeta],
  )

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return enrolledMembers
    return enrolledMembers.filter(
      (m) =>
        String(m.name || "")
          .toLowerCase()
          .includes(q) ||
        String(m.code || "")
          .toLowerCase()
          .includes(q) ||
        String(m.id || "").includes(q),
    )
  }, [enrolledMembers, searchQuery])

  const sessionPermission = useMemo(() => {
    return verifyCoachSessionPermission({
      session: activeSession,
      classItem: selectedClass,
      coachId: resolvedCoachId,
    })
  }, [activeSession, selectedClass, resolvedCoachId])

  const hasSessionPermission = !apiEnabled || sessionPermission.allowed
  const sessionCancelled = isSessionCancelled(activeSession)
  const sessionReady =
    !apiEnabled ||
    (!loadingRoster &&
      activeSession?.id != null &&
      String(activeSession.id) === String(selectedSessionId))

  const isClassValid =
    Boolean(selectedClass && selectedClass.id) &&
    !rosterError &&
    !(selectedClassId && !selectedClass)

  const allowCheckIn = isClassValid && sessionReady && hasSessionPermission && canCheckIn(activeSession)
  const allowCorrection = sessionReady && hasSessionPermission && canCorrectAttendance(activeSession)
  const resolvedSessionStatus = normalizeSessionStatus(activeSession) || "Scheduled"

  const bulkAllowed = canPerformBulkAttendance({
    apiEnabled,
    sessionReady,
    hasSessionPermission,
    sessionCancelled,
    allowCheckIn,
    loadingRoster,
    rosterError,
    attendancesError,
    trainingResultsError,
    loadedClassId,
    selectedClassId: selectedClass?.id,
    loadedSessionId,
    selectedSessionId,
    unmarkedCount: unmarkedMembers.length,
    bulkSaving,
  })

  const handleOneTouchCheckIn = async (member, targetStatus, attendanceId) => {
    if (!allowCheckIn || bulkSaving || !hasSessionPermission) return
    const requestId = rosterRequestId.current
    const optKey = `${selectedSessionId || selectedClass?.id || "cls"}_${member.id}`
    const prevStatus = getMemberStatusAndMeta(member).currentStatus

    setOptimisticStatusMap((prev) => ({
      ...prev,
      [optKey]: targetStatus,
    }))
    setSavingStateByMember((prev) => ({
      ...prev,
      [optKey]: "saving",
    }))

    const apiStatusMap = {
      present: "Present",
      late: "Late",
      excused: "Excused",
      absent: "Absent",
    }

    try {
      if (apiEnabled) {
        await attendanceApi.recordSessionAttendance({
          memberId: member.id,
          sessionId: Number(selectedSessionId),
          coachId: resolvedCoachId,
          status: apiStatusMap[targetStatus] || "Present",
          notes:
            targetStatus === "absent" ? "Vắng mặt" : "Có mặt đúng giờ",
        })
        if (requestId === rosterRequestId.current) await loadClassRosterAndAttendance()
        setOptimisticStatusMap(({ [optKey]: _, ...remaining }) => remaining)
      } else {
        await recordAttendance(
          selectedClass?.id,
          member.id,
          targetStatus === "excused" ? "late" : targetStatus,
          undefined,
          {
            attendanceId,
            memberName: member.name,
            sessionId: selectedSessionId,
            coachId: resolvedCoachId,
          },
        )
      }
      setSavingStateByMember((prev) => ({
        ...prev,
        [optKey]: "saved",
      }))
    } catch (err) {
      setOptimisticStatusMap(({ [optKey]: _, ...remaining }) =>
        apiEnabled ? remaining : { ...remaining, [optKey]: prevStatus },
      )
      setSavingStateByMember((prev) => ({
        ...prev,
        [optKey]: "error",
      }))
      showToast?.(
        getErrorMessage(
          err,
          "Không thể lưu điểm danh. Đã hoàn tác trạng thái.",
        ),
        "error",
      )
    }
  }

  // R1.5: Bulk mark Present ONLY marks unmarked students (never overwrites students who already have a status)
  const handleConfirmBulkMarkPresent = async () => {
    if (!bulkAllowed) {
      setShowBulkConfirmModal(false)
      return
    }
    const targets = unmarkedMembers
    if (targets.length === 0) {
      setShowBulkConfirmModal(false)
      return
    }
    const requestId = rosterRequestId.current
    setBulkSaving(true)
    setShowBulkConfirmModal(false)
    try {
      if (apiEnabled) {
        const results = await memberPortalApi.recordBulkTrainingResults({
          sessionId: Number(selectedSessionId),
          coachId: Number(resolvedCoachId),
          items: targets.map((m) => ({
            memberId: Number(m.id),
            attendanceStatus: "Present",
            content: "Có mặt đầy đủ theo điểm danh lớp",
          })),
        })
        if (!Array.isArray(results) || !targets.every((m) =>
          results.some((result) =>
            matchesSessionAttendance(result, selectedSessionId, m.id, "Present"),
          ),
        )) {
          throw new Error("Chưa xác nhận đủ kết quả điểm danh. Hãy kiểm tra danh sách trước khi thử lại.")
        }
      } else {
        for (const m of targets) {
          await recordAttendance(selectedClass?.id, m.id, "present", undefined, {
            memberName: m.name,
            sessionId: selectedSessionId,
            coachId: resolvedCoachId,
          })
        }
      }
      if (requestId === rosterRequestId.current) await loadClassRosterAndAttendance()
      showToast?.(
        `Đã điểm danh Có mặt cho ${targets.length} học viên chưa điểm danh!`,
        "success",
      )
    } catch (err) {
      if (requestId === rosterRequestId.current) await loadClassRosterAndAttendance()
      showToast?.(getErrorMessage(err, "Không thể lưu điểm danh hàng loạt."), "error")
    } finally {
      setBulkSaving(false)
    }
  }

  const handleQuickCheckin = async (e) => {
    e?.preventDefault?.()
    const raw = String(quickMemberInput || "").trim()
    if (!raw || !allowCheckIn || quickSaving || !hasSessionPermission || !isClassValid || !selectedClass?.id) return
    const requestId = rosterRequestId.current
    setQuickSaving(true)
    try {
      if (apiEnabled) {
        const match = raw.match(/^(MB-\d+)(?:\s+(\d{6}))?$/i)
        const member = match && enrolledMembers.find((m) => m.code.toUpperCase() === match[1].toUpperCase())
        if (!member) {
          throw new Error("Nhập mã MB của học viên trong danh sách. Nếu quét QR, nhập mã MB rồi đến mã QR 6 số.")
        }
        if (match[2]) {
          const result = await attendanceApi.scanAttendance({
            code: match[2],
            memberId: Number(member.id),
            sessionId: Number(selectedSessionId),
          })
          if (Number(result?.sessionId) !== Number(selectedSessionId) ||
              Number(result?.memberId) !== Number(member.id) ||
              result?.state !== "Present") {
            throw new Error("Chưa xác nhận được kết quả quét QR. Hãy làm mới danh sách trước khi thử lại.")
          }
        } else {
          await attendanceApi.recordSessionAttendance({
            memberId: member.id,
            sessionId: selectedSessionId,
            coachId: resolvedCoachId,
            status: "Present",
            notes: "Điểm danh nhanh theo mã hội viên",
          })
        }
        setQuickMemberInput("")
        if (requestId === rosterRequestId.current) await loadClassRosterAndAttendance()
        showToast?.(`Đã điểm danh Có mặt cho ${member.code}!`, "success")
        return
      }
      const mbMatch = raw.match(/^(?:MB-)?(\d+)$/i)
      if (mbMatch) {
        const rawNum = Number(mbMatch[1])
        const resolvedMemberId = rawNum > 1000 ? rawNum - 1000 : rawNum
        await recordAttendance(
          selectedClass?.id,
          resolvedMemberId,
          "present",
          undefined,
          {
            memberName: `Học viên ${formatMemberCode(resolvedMemberId)}`,
            sessionId: selectedSessionId,
            coachId: resolvedCoachId,
          },
        )
        setQuickMemberInput("")
        await loadClassRosterAndAttendance()
        showToast?.(
          `Đã điểm danh Có mặt cho ${formatMemberCode(resolvedMemberId)}!`,
          "success",
        )
      } else {
        await attendanceApi.scanAttendance({
          checkinCode: raw,
          sessionId: selectedSessionId ? Number(selectedSessionId) : undefined,
        })
        setQuickMemberInput("")
        await loadClassRosterAndAttendance()
        showToast?.(`Đã quét mã điểm danh ${raw} thành công!`, "success")
      }
    } catch (err) {
      showToast?.(
        err?.message ||
          "Không thể điểm danh cho mã hội viên / mã check-in này.",
        "error",
      )
    } finally {
      setQuickSaving(false)
    }
  }

  return (
    <div className="w-full space-y-6">
      {/* Attendance Mode Switcher: Normal Group Classes vs Advanced 1:1 PT */}
      <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-brand-primary" />
            <h2 className="text-xl font-semibold text-text-primary">
              {language === "vi" ? "Điểm danh học viên" : "Attendance Tracking"}
            </h2>
          </div>
          <p className="text-sm text-text-secondary mt-0.5">
            {language === "vi"
              ? "Tách biệt rõ ràng giữa điểm danh Lớp học thường (Normal) và Buổi tập kèm riêng 1:1 (Advanced)"
              : "Clear separation between Normal group classes and Advanced 1:1 private sessions"}
          </p>
        </div>

        {/* Tab Switcher */}
        <div role="tablist" className="inline-flex rounded-lg border border-border-color bg-bg-secondary p-1 gap-1.5 self-start md:self-auto">
          <button
            type="button"
            role="tab"
            aria-selected={attendanceMode === "normal"}
            onClick={() => handleModeChange("normal")}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 text-xs font-semibold transition-all cursor-pointer ${
              attendanceMode === "normal"
                ? "bg-brand-primary text-text-inverse shadow-xs"
                : "border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{language === "vi" ? "Lớp học thường (Normal)" : "Normal Classes"}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              attendanceMode === "normal"
                ? "bg-white/20 text-white"
                : "bg-bg-secondary text-text-secondary border border-border-color"
            }`}>
              {normalClasses.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={attendanceMode === "advanced"}
            onClick={() => handleModeChange("advanced")}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 text-xs font-semibold transition-all cursor-pointer ${
              attendanceMode === "advanced"
                ? "bg-brand-primary text-text-inverse shadow-xs"
                : "border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>{language === "vi" ? "Kèm riêng 1:1 (Advanced)" : "1:1 PT (Advanced)"}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              attendanceMode === "advanced"
                ? "bg-white/20 text-white"
                : "bg-bg-secondary text-text-secondary border border-border-color"
            }`}>
              {coachPtSessions.length}
            </span>
          </button>
        </div>
      </div>

      {/* Class Banner & Selector */}
      <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <CoachStatusBadge
              type="session"
              value={
                sessionCancelled && activeSession?.centerInvalidated
                  ? "centerInvalidated"
                  : resolvedSessionStatus
              }
            />

            {attendanceMode === "normal" ? (
              normalClasses.length > 0 ? (
                <select
                  value={selectedClass?.id || ""}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value)
                    setSelectedSessionId("")
                    if (typeof window !== "undefined") {
                      sessionStorage.setItem(
                        "scms_selected_attendance_class_id",
                        e.target.value,
                      )
                    }
                  }}
                  className="min-h-11 w-full sm:w-auto rounded border border-border-strong bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted cursor-pointer"
                >
                  {selectedClassId && !normalClasses.some((c) => String(c.id) === String(selectedClassId)) && (
                    <option value="" disabled>
                      {`Lớp #${selectedClassId} (${language === "vi" ? "Không tồn tại" : "Not found"})`}
                    </option>
                  )}
                  {normalClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.nameVi || cls.name}
                      {cls.isSubstitute ? ` (${language === "vi" ? "Dạy thay" : "Substitute"})` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-medium text-text-secondary bg-bg-secondary px-3 py-2 rounded border border-border-color">
                  {language === "vi" ? "Không có lớp học thường nào" : "No normal classes"}
                </span>
              )
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold text-xs">
                <UserCheck className="w-3.5 h-3.5" />
                <span>{language === "vi" ? "Ca kèm riêng PT 1:1 (Advanced)" : "1:1 PT Private Session"}</span>
              </div>
            )}

            {classSessions.length > 0 && (
              <select
                value={selectedSessionId}
                onChange={(e) => {
                  setSelectedSessionId(e.target.value)
                  if (typeof window !== "undefined") {
                    sessionStorage.setItem(
                      "scms_selected_attendance_session_id",
                      e.target.value,
                    )
                  }
                }}
                className="min-h-11 w-full sm:w-auto rounded border border-border-strong bg-bg-card px-3 py-1.5 text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted cursor-pointer"
              >
                {classSessions.map((ses, idx) => {
                  const isCancel = isSessionCancelled(ses)
                  const orderNum = ses.computedOrderNumber || idx + 1
                  const isAssignedToMe = ses.coachId != null
                    ? String(ses.coachId) === String(resolvedCoachId)
                    : String(selectedClass?.coachId) === String(resolvedCoachId)
                  const isSubForMe = Boolean(
                    ses.coachId != null &&
                    String(ses.coachId) === String(resolvedCoachId) &&
                    String(selectedClass?.coachId) !== String(resolvedCoachId)
                  )
                  const isOtherSub = Boolean(
                    ses.coachId != null &&
                    String(ses.coachId) !== String(resolvedCoachId) &&
                    String(selectedClass?.coachId) === String(resolvedCoachId)
                  )
                  let tag = ""
                  if (isSubForMe) tag = ` [${language === "vi" ? "Dạy thay" : "Substitute"}]`
                  else if (isOtherSub) tag = ` [${language === "vi" ? "HLV khác dạy" : "Reassigned"}]`
                  else if (!isAssignedToMe) tag = ` [${language === "vi" ? "Ngoài quyền" : "Unauthorized"}]`

                  if (attendanceMode === "advanced") {
                    const studentLabel = ses.bookedMemberName ? `${ses.bookedMemberName} · ` : ""
                    const subjectLabel = ses.subjectName ? `${ses.subjectName} · ` : ""
                    return (
                      <option
                        key={ses.id || idx}
                        value={ses.id}
                        disabled={
                          isCancel && String(ses.id) !== String(selectedSessionId)
                        }
                      >
                        {studentLabel}{subjectLabel}{formatDate(ses.sessionDate)} ({formatTime(ses.startTime)} - {formatTime(ses.endTime)}){ses.roomName ? ` · ${ses.roomName}` : ""}
                        {isCancel ? ` — [${t("coachStatusCancelled")}]` : ""}
                      </option>
                    )
                  }

                  return (
                    <option
                      key={ses.id || idx}
                      value={ses.id}
                      disabled={
                        isCancel && String(ses.id) !== String(selectedSessionId)
                      }
                    >
                      Buổi {orderNum}/{totalClassSessions} ·{" "}
                      {formatDate(ses.sessionDate)} ({formatTime(ses.startTime)})
                      {tag}
                      {isCancel ? ` — [${t("coachStatusCancelled")}]` : ""}
                    </option>
                  )
                })}
              </select>
            )}
          </div>

          <h2 className="text-xl leading-7 font-semibold text-text-primary mt-1">
            {attendanceMode === "advanced"
              ? activeSession?.bookedMemberName
                ? `${language === "vi" ? "Buổi tập PT 1:1 với" : "1:1 Session with"} ${activeSession.bookedMemberName}`
                : activeSession?.subjectName
                  ? `${language === "vi" ? "Ca kèm riêng PT 1:1 môn" : "1:1 Session for"} ${activeSession.subjectName}`
                  : (language === "vi" ? "Ca kèm riêng PT 1:1 (Advanced)" : "1:1 Private Session")
              : selectedClass?.nameVi || selectedClass?.name || (language === "vi" ? "Lớp học thường" : "Normal Class")}
          </h2>

          {(() => {
            const orderNum = activeSession?.computedOrderNumber || 1
            const sesDate = activeSession?.sessionDate
              ? formatDate(activeSession.sessionDate)
              : selectedClass?.date
                ? formatDate(selectedClass.date)
                : "Hôm nay"
            const sesTime = activeSession?.startTime
              ? formatTimeRange(activeSession.startTime, activeSession.endTime)
              : selectedClass?.startTime
                ? formatTime(selectedClass.startTime)
                : "Theo ca học"
            const sesRoom =
              activeSession?.roomName ||
              selectedClass?.room ||
              "Sân tập trung tâm"
            return (
              <p className="text-sm leading-5 text-text-secondary mt-0.5 font-mono tabular-nums">
                Buổi {orderNum}/{totalClassSessions} &bull; Ngày: {sesDate} &bull;
                Ca: {sesTime} &bull; Sân: {sesRoom}
              </p>
            )
          })()}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {enrolledMembers.length > 0 && allowCheckIn && !sessionCancelled && (
            <button
              type="button"
              onClick={() => {
                if (bulkAllowed) setShowBulkConfirmModal(true)
              }}
              disabled={!bulkAllowed}
              title={
                !bulkAllowed
                  ? !hasSessionPermission
                    ? language === "vi"
                      ? "Bạn không có quyền điểm danh ca này"
                      : "Unauthorized for this session"
                    : rosterError || attendancesError || trainingResultsError
                      ? language === "vi"
                        ? "Không thể điểm danh do lỗi dữ liệu"
                        : "Cannot mark bulk due to data error"
                      : unmarkedMembers.length === 0
                        ? language === "vi"
                          ? "Tất cả học viên trong buổi đã có trạng thái điểm danh"
                          : "All members already recorded"
                        : language === "vi"
                          ? "Đang tải hoặc dữ liệu chưa sẵn sàng..."
                          : "Loading or data not ready..."
                  : ""
              }
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-3.5 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>
                {bulkSaving
                  ? "Đang điểm danh..."
                  : `Điểm danh tất cả Có mặt (${unmarkedMembers.length})`}
              </span>
            </button>
          )}
          {apiEnabled && (
            <button
              type="button"
              onClick={loadClassRosterAndAttendance}
              disabled={loadingRoster}
              aria-label={t("coachBtnRefresh")}
              title={t("coachBtnRefresh")}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none border border-border-color bg-bg-card text-text-secondary hover:bg-bg-secondary hover:text-text-primary cursor-pointer"
            >
              <RefreshCw
                className={`w-4 h-4 ${loadingRoster ? "animate-spin" : ""}`}
              />
            </button>
          )}
          <div className="p-3 bg-bg-secondary rounded-lg border border-border-color text-right">
            <div className="text-xs leading-4 font-medium text-text-secondary uppercase whitespace-nowrap">
              {language === "vi" ? "Sĩ số lớp" : "Enrolled Capacity"}
            </div>
            <div className="text-lg leading-7 font-semibold text-text-primary tabular-nums whitespace-nowrap">
              {enrolledMembers.length || selectedClass?.enrolledCount || 0}/
              {selectedClass?.capacity || 12}{" "}
              {language === "vi" ? "Học viên" : "Members"}
            </div>
          </div>
        </div>
      </div>

      {/* Session Status & Permission Banners */}
      {!hasSessionPermission && !loadingRoster && (
        <div className="p-4 bg-status-warning-bg border border-status-warning-border rounded-lg flex items-start gap-3 text-status-warning">
          <AlertCircle className="w-5 h-5 text-status-warning shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm leading-5">
            <div className="font-semibold">
              {sessionPermission.isMismatched
                ? (language === "vi" ? "Ca học không khớp với lớp đã chọn" : "Session does not match selected class")
                : (language === "vi" ? "Không có quyền điểm danh ca này" : "Unauthorized for this session")}
            </div>
            <p>
              {language === "vi"
                ? sessionPermission.messageVi
                : sessionPermission.messageEn}
            </p>
          </div>
        </div>
      )}

      {sessionCancelled && (
        <div className="p-4 bg-status-danger-bg border border-status-danger-border rounded-lg flex items-start gap-3 text-status-danger">
          <AlertCircle className="w-5 h-5 text-status-danger shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm leading-5">
            <div className="font-semibold">
              {t("coachBannerCancelledTitle")}
            </div>
            <p>
              {activeSession?.centerInvalidated
                ? t("coachBannerCenterInvalidatedDesc")
                : t("coachBannerCancelledDesc")}
            </p>
          </div>
        </div>
      )}

      {allowCorrection && !sessionCancelled && (
        <div className="p-3.5 bg-status-warning-bg border border-status-warning-border rounded-lg flex items-center gap-2.5 text-status-warning text-sm leading-5 font-medium">
          <AlertCircle className="w-4 h-4 text-status-warning shrink-0" />
          <span>{apiEnabled
            ? language === "vi"
              ? "Buổi học đã hoàn thành. Liên hệ quản lý trung tâm nếu cần sửa điểm danh."
              : "This session has ended. Contact the center manager to correct attendance."
            : t("coachBannerCompletedReadOnlyDesc")}</span>
        </div>
      )}

      {/* Attendance Roster */}
      <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border-color pb-3">
          <div>
            <h3 className="text-lg leading-7 font-semibold text-text-primary flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-brand-primary shrink-0" />
              <span className="whitespace-nowrap">
                {language === "vi"
                  ? "Danh sách học viên điểm danh"
                  : "Attendance roster"}
              </span>
            </h3>
            <span className="text-sm leading-5 text-text-secondary">
              {apiEnabled
                ? language === "vi"
                  ? "Chọn Có mặt hoặc Vắng mặt trong giờ học. Để quét QR, nhập mã hội viên rồi đến mã 6 số."
                  : "Mark present or absent during the session. To scan, enter the member code followed by the six-digit QR code."
                : language === "vi"
                  ? "Bấm một chạm để điểm danh trong buổi học hoặc sửa điểm danh kèm lý do khi buổi đã kết thúc"
                  : "One-tap check-in for scheduled sessions or edit with mandatory reason for completed sessions"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search by student name or code */}
            <div className="relative">
              <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("coachSearchStudentPlaceholder")}
                className="min-h-11 w-full sm:w-56 rounded border border-border-strong bg-bg-card pl-9 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
              />
            </div>

            {allowCheckIn && !sessionCancelled && hasSessionPermission && (
              <form
                onSubmit={handleQuickCheckin}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  aria-label={language === "vi" ? "Mã hội viên và mã QR điểm danh" : "Member code and attendance QR code"}
                  value={quickMemberInput}
                  onChange={(e) => setQuickMemberInput(e.target.value)}
                  placeholder={apiEnabled ? "MB-1002 hoặc MB-1002 123456" : "Quét QR / nhập MB-xxxx..."}
                  className="min-h-11 w-full sm:w-52 rounded border border-border-strong bg-bg-card px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
                />
                <button
                  type="submit"
                  disabled={quickSaving || !quickMemberInput.trim()}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-3.5 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active whitespace-nowrap cursor-pointer"
                >
                  {quickSaving ? "Đang xử lý..." : "Điểm danh nhanh"}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Sticky Attendance Summary Bar (R1.2 & R1.5) */}
        {enrolledMembers.length > 0 && (
          <div className="sticky top-0 z-10 bg-brand-dark text-text-inverse px-4 py-2.5 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs leading-4 font-mono">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-emerald-300 font-semibold">
                {t("coachAttendanceSummaryPresent")}: {summaryCounts.present}
              </span>
              <span>&bull;</span>
              <span className="text-amber-300 font-semibold">
                {t("coachAttendanceSummaryLate")}: {summaryCounts.late}
              </span>
              <span>&bull;</span>
              <span className="text-sky-300 font-semibold">
                {t("coachAttendanceSummaryExcused")}: {summaryCounts.excused}
              </span>
              <span>&bull;</span>
              <span className="text-rose-300 font-semibold">
                {t("coachAttendanceSummaryAbsent")}: {summaryCounts.absent}
              </span>
              <span>&bull;</span>
              <span className="text-text-inverse/80 font-semibold">
                {t("coachAttendanceSummaryUnmarked")}:{" "}
                {summaryCounts.not_recorded}
              </span>
            </div>
            <div className="text-text-inverse/80">
              Tổng: {enrolledMembers.length} HV
            </div>
          </div>
        )}

        <div className="space-y-3">
          {!loadingRoster && rosterError && (
            <p role="alert" className="p-3 text-sm leading-5 text-status-danger bg-status-danger-bg border border-status-danger-border rounded">
              {rosterError.status === 403
                ? language === "vi"
                  ? "Bạn không có quyền xem danh sách học viên của lớp này."
                  : "You do not have permission to view this class roster."
                : language === "vi"
                  ? "Không tải được danh sách học viên. Hãy thử làm mới."
                  : "Could not load the class roster. Try refreshing."}
            </p>
          )}
          {!loadingRoster && (attendancesError || trainingResultsError) && (
            <p role="alert" className="p-3 text-sm leading-5 text-status-danger bg-status-danger-bg border border-status-danger-border rounded">
              {language === "vi"
                ? "Không tải được trạng thái điểm danh của buổi học. Chức năng điểm danh hàng loạt tạm thời bị khóa. Hãy thử làm mới."
                : "Could not load session attendance status. Bulk attendance is locked. Try refreshing."}
            </p>
          )}
          {loadingRoster ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 bg-bg-secondary animate-pulse rounded border border-border-color"
                />
              ))}
            </div>
          ) : filteredMembers.length === 0 && !rosterError && !attendancesError && !trainingResultsError ? (
            <div className="p-6 text-center text-sm leading-5 text-text-secondary bg-bg-secondary border border-border-color rounded-lg">
              {enrolledMembers.length > 0
                ? "Không tìm thấy học viên khớp với từ khóa."
                : Number(selectedClass?.enrolledCount || 0) > 0
                  ? `Lớp đã có ${selectedClass.enrolledCount} học viên đăng ký. Bạn có thể nhập mã hội viên (MB-xxxx) hoặc quét QR ở ô "Điểm danh nhanh" phía trên để ghi nhận buổi học.`
                  : "Lớp học này hiện chưa có học viên nào đăng ký chính thức."}
            </div>
          ) : (
            filteredMembers.map((m) => {
              const {
                currentStatus,
                attendanceId,
                absenceNotice,
                saveState,
              } = getMemberStatusAndMeta(m)

              return (
                <div
                  key={m.id}
                  className="min-h-[56px] p-3.5 bg-bg-secondary border border-border-color rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm leading-5 font-semibold text-text-primary">
                        {m.name}
                      </span>
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-bg-card text-text-secondary ring-1 ring-inset ring-border-color font-mono">
                        {m.code}
                      </span>

                      {/* R1.2: Neutral pre-reported absence badge, separate from attendance status */}
                      {absenceNotice && (
                        <span
                          title={absenceNotice.reason || ""}
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-bg-card text-text-secondary ring-1 ring-inset ring-border-color gap-1"
                        >
                          <FileText className="w-3 h-3 text-text-muted" />
                          <span>
                            {t("coachPreAbsenceReasonPrefix")}{" "}
                            {absenceNotice.reason || "Xin nghỉ phép"}
                          </span>
                        </span>
                      )}

                      {saveState === "saving" && (
                        <span className="text-xs leading-4 font-mono text-status-info">
                          {t("coachSavingRow")}
                        </span>
                      )}
                      {saveState === "saved" && (
                        <span className="text-xs leading-4 font-mono text-status-success">
                          ✓ {t("coachSavedRow")}
                        </span>
                      )}
                      {saveState === "error" && (
                        <span className="text-xs leading-4 font-mono text-status-danger">
                          {t("coachErrorRow")}
                        </span>
                      )}
                    </div>

                    {/* R1.4: Group class shows member code & group label, NEVER "Gói PT: Điểm danh lớp" */}
                    <div className="text-xs leading-4 font-medium text-text-secondary">
                      {activeSession?.isPrivate
                        ? `${t("coachPtSessionSubtitle")} · ${t("coachMemberCodePrefix")}: ${m.code}`
                        : `${t("coachGroupEnrolledSubtitle")} · Khóa ${totalClassSessions} buổi`}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                    {/* R1.1 & R1.5: 4 one-touch buttons on 1 single row even at 375px */}
                    {allowCheckIn && !sessionCancelled && hasSessionPermission ? (
                      <div className={`grid ${apiEnabled ? "grid-cols-2" : "grid-cols-4"} gap-1 w-full sm:w-auto`}>
                        {[
                          {
                            key: "present",
                            label: t("coachStatusPresent"),
                            shortLabel: "Có mặt",
                            Icon: Check,
                            activeCls:
                              "bg-status-success-bg text-status-success border-status-success-border ring-1 ring-inset ring-status-success-border",
                          },
                          {
                            key: "late",
                            label: t("coachStatusLate"),
                            shortLabel: "Đi trễ",
                            Icon: Clock,
                            activeCls:
                              "bg-status-warning-bg text-status-warning border-status-warning-border ring-1 ring-inset ring-status-warning-border",
                          },
                          {
                            key: "excused",
                            label: t("coachStatusExcused"),
                            shortLabel: "Có phép",
                            Icon: FileText,
                            activeCls:
                              "bg-status-info-bg text-status-info border-status-info-border ring-1 ring-inset ring-status-info-border",
                          },
                          {
                            key: "absent",
                            label: t("coachStatusAbsent"),
                            shortLabel: "Vắng",
                            Icon: XCircle,
                            activeCls:
                              "bg-status-danger-bg text-status-danger border-status-danger-border ring-1 ring-inset ring-status-danger-border",
                          },
                          ].filter((btn) => !apiEnabled || ["present", "absent"].includes(btn.key)).map((btn) => {
                          const isSelected = currentStatus === btn.key
                          const IconComp = btn.Icon
                          return (
                            <button
                              key={btn.key}
                              type="button"
                              aria-label={btn.label}
                              aria-pressed={isSelected}
                              disabled={saveState === "saving" || bulkSaving}
                              onClick={() =>
                                handleOneTouchCheckIn(m, btn.key, attendanceId)
                              }
                              className={`inline-flex min-h-11 items-center justify-center gap-0.5 sm:gap-1 rounded px-0.5 sm:px-2 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none border cursor-pointer ${
                                isSelected
                                  ? btn.activeCls
                                  : "border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary"
                              }`}
                            >
                              <IconComp className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                              <span className="whitespace-nowrap">{btn.shortLabel}</span>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <CoachStatusBadge
                          type="attendance"
                          value={currentStatus}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Confirmation Modal for Bulk Mark Present (R1.5) */}
      {showBulkConfirmModal && (
        <div className="fixed inset-0 z-50 bg-brand-dark/50 flex items-center justify-center p-4">
          <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary max-w-md w-full shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-border-color pb-2.5">
              <h4 className="text-lg leading-7 font-semibold text-text-primary">
                {t("coachConfirmBulkPresentTitle")}
              </h4>
              <button
                type="button"
                onClick={() => setShowBulkConfirmModal(false)}
                aria-label={t("coachCancelBtn") || "Đóng"}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm leading-5 font-normal text-text-primary">
              {t("coachConfirmBulkPresentDesc").replace(
                "{count}",
                String(unmarkedMembers.length),
              )}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-color">
              <button
                type="button"
                onClick={() => setShowBulkConfirmModal(false)}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-4 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary cursor-pointer"
              >
                {t("coachCancelBtn")}
              </button>
              <button
                type="button"
                disabled={!bulkAllowed}
                onClick={handleConfirmBulkMarkPresent}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-4 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active cursor-pointer"
              >
                {t("coachConfirmBtn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
