import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { evaluationApi } from "../../api/evaluationApi"
import { memberPortalApi } from "../../api/memberPortalApi"
import { attendanceApi } from "../../api/attendanceApi"
import { getErrorMessage } from "../../api/apiErrors"
import { canLogResult } from "../../utils/permissions"
import { formatDate, formatTime } from "../../utils/datetime"
import { formatMemberCode } from "../../utils/formatMember"
import {
  normalizeScore,
  formatScore,
  scoreToBarWidthPercent,
} from "../../utils/score"
import { serializePlan } from "../../utils/trainingPlan"
import { CoachStatusBadge } from "../coach/StatusBadge"
import { PlanBuilder, PlanContentView } from "../coach/PlanBuilder"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import {
  Activity,
  Save,
  Award,
  Plus,
  ClipboardList,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  Info,
} from "lucide-react"

export function CoachTrainingProgress() {
  const {
    members,
    classes,
    currentUser,
    apiEnabled,
    showToast,
    t,
    language,
  } = useSCMS()

  const resolvedCoachId = useMemo(() => {
    const raw = currentUser?.coachId ?? currentUser?.id
    const match = String(raw || "").match(/(\d+)$/)
    const parsed = match ? Number(match[1]) : Number(raw)
    return !Number.isNaN(parsed) && parsed > 0 ? parsed : 1
  }, [currentUser?.coachId, currentUser?.id])

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const savedTab = sessionStorage.getItem("scms_selected_progress_tab")
      if (savedTab) {
        sessionStorage.removeItem("scms_selected_progress_tab")
        return savedTab
      }
    }
    return "overview"
  })
  const [selectedMemberId, setSelectedMemberId] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("scms_selected_progress_member_id")
      if (saved) return saved
    }
    return ""
  })

  const [comment, setComment] = useState("")
  const [progressScore, setProgressScore] = useState(8.0)
  const [evaluations, setEvaluations] = useState([])
  const [apiPlans, setApiPlans] = useState([])
  const [apiResults, setApiResults] = useState([])
  const [apiSessions, setApiSessions] = useState([])
  const [apiAttendances, setApiAttendances] = useState([])
  const [advancedRegs, setAdvancedRegs] = useState([])
  const [saving, setSaving] = useState(false)
  const [loadingData, setLoadingData] = useState(false)

  // New Training Plan form state (P3.1 Structured PlanBuilder)
  const [planTitle, setPlanTitle] = useState("")
  const [planGoal, setPlanGoal] = useState("")
  const [planExercises, setPlanExercises] = useState([])
  const [planNotes, setPlanNotes] = useState("")
  const [planStartDate, setPlanStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  )
  const [planEndDate, setPlanEndDate] = useState(() => {
    const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    return d.toISOString().slice(0, 10)
  })
  const [savingPlan, setSavingPlan] = useState(false)

  // New Training Result form state
  const [selectedSessionId, setSelectedSessionId] = useState(() => {
    if (typeof window !== "undefined") {
      const savedSes = sessionStorage.getItem("scms_selected_progress_session_id")
      if (savedSes) {
        sessionStorage.removeItem("scms_selected_progress_session_id")
        return savedSes
      }
    }
    return ""
  })
  const [resultContent, setResultContent] = useState("")
  const [savingResult, setSavingResult] = useState(false)

  const [showAllPlans, setShowAllPlans] = useState(false)
  const [showAllResults, setShowAllResults] = useState(false)
  const [showAllEvaluations, setShowAllEvaluations] = useState(false)

  const parseNumericId = (rawId, fallback = 1) => {
    const match = String(rawId || "").match(/(\d+)$/)
    const parsed = match ? Number(match[1]) : Number(rawId)
    return !Number.isNaN(parsed) && parsed > 0 ? parsed : fallback
  }

  const loadAllProgressData = useCallback(async () => {
    if (!apiEnabled) return
    setLoadingData(true)
    try {
      const [evalList, plansList, resultsList, sessionsList, advList, attList] =
        await Promise.all([
          evaluationApi.getEvaluations().catch(() => []),
          memberPortalApi.getTrainingPlans().catch(() => []),
          memberPortalApi.getTrainingResults().catch(() => []),
          memberPortalApi.getClassSessions().catch(() => []),
          memberPortalApi.getAdvancedRegistrations().catch(() => []),
          attendanceApi.searchAttendances().catch(() => []),
        ])
      setEvaluations(Array.isArray(evalList) ? evalList : [])
      setApiPlans(Array.isArray(plansList) ? plansList : [])
      setApiResults(Array.isArray(resultsList) ? resultsList : [])
      const validSessions = Array.isArray(sessionsList) ? sessionsList : []
      setApiSessions(validSessions)
      setAdvancedRegs(Array.isArray(advList) ? advList : [])
      setApiAttendances(Array.isArray(attList) ? attList : [])
      const completedOnly = validSessions.filter((s) => canLogResult(s))
      if (completedOnly.length > 0 && !selectedSessionId) {
        setSelectedSessionId(String(completedOnly[0].id))
      }
    } finally {
      setLoadingData(false)
    }
  }, [apiEnabled, selectedSessionId])

  useEffect(() => {
    loadAllProgressData()
  }, [loadAllProgressData])

  // R2.3: Prioritize real API students when apiEnabled is true so we don't default to mock member #1
  const availableStudents = useMemo(() => {
    const map = new Map()
    const addStudent = (id, name, code) => {
      if (id == null || String(id) === "" || String(id) === "null") return
      const key = String(id)
      const existing = map.get(key)
      map.set(key, {
        id,
        name:
          name ||
          existing?.name ||
          members?.find((m) => String(m.id) === key)?.name ||
          `Học viên ${formatMemberCode(id, code)}`,
        code: formatMemberCode(id, code || existing?.code),
      })
    }

    advancedRegs.forEach((r) => addStudent(r?.memberId, r?.memberName, null))
    apiPlans.forEach((p) => addStudent(p?.memberId, p?.memberName, null))
    evaluations.forEach((ev) =>
      addStudent(ev?.memberId, ev?.memberName, ev?.memberCode),
    )
    apiResults.forEach((res) =>
      addStudent(res?.memberId, res?.memberName, null),
    )
    apiAttendances.forEach((att) =>
      addStudent(att?.memberId, att?.memberName, att?.memberCode),
    )
    apiSessions.forEach((ses) => {
      if (ses?.bookedMemberId) {
        addStudent(ses.bookedMemberId, ses.bookedMemberName, null)
      }
    })

    return Array.from(map.values())
  }, [
    advancedRegs,
    apiPlans,
    evaluations,
    apiResults,
    apiAttendances,
    apiSessions,
    members,
  ])

  useEffect(() => {
    if (availableStudents.length > 0) {
      const exists = availableStudents.some(
        (s) => String(s.id) === String(selectedMemberId),
      )
      if (!selectedMemberId || !exists) {
        setSelectedMemberId(String(availableStudents[0].id))
      }
    }
  }, [availableStudents, selectedMemberId])

  const selectedStudent = useMemo(
    () =>
      availableStudents.find((s) => String(s.id) === String(selectedMemberId)) ||
      availableStudents[0] ||
      null,
    [availableStudents, selectedMemberId],
  )

  const completedSessions = useMemo(
    () => apiSessions.filter((s) => canLogResult(s)),
    [apiSessions],
  )

  const readOnlyAttendanceStatus = useMemo(() => {
    const memberIdStr = String(selectedMemberId || selectedStudent?.id || "")
    const sessionIdStr = String(selectedSessionId || "")
    if (!sessionIdStr || !memberIdStr) return "Present"

    const matchedResult = apiResults.find(
      (r) =>
        String(r.sessionId) === sessionIdStr &&
        String(r.memberId) === memberIdStr &&
        r.attendanceStatus,
    )
    if (matchedResult?.attendanceStatus) return matchedResult.attendanceStatus

    const matchedAtt = apiAttendances.find(
      (a) =>
        String(a.sessionId) === sessionIdStr &&
        String(a.memberId) === memberIdStr,
    )
    if (matchedAtt?.state) {
      const raw = String(matchedAtt.state).toLowerCase()
      if (raw.includes("late")) return "Late"
      if (raw.includes("excuse")) return "Excused"
      if (raw.includes("absent")) return "Absent"
      return "Present"
    }
    return "Present"
  }, [
    selectedSessionId,
    selectedMemberId,
    selectedStudent?.id,
    apiResults,
    apiAttendances,
  ])

  const getPlanSourceBadge = useCallback(
    (p) => {
      if (!p) return t("coachPlanTargetGeneral")
      const hasMember =
        p.memberId != null &&
        String(p.memberId) !== "" &&
        String(p.memberId) !== "null"
      const hasClass =
        p.classId != null &&
        String(p.classId) !== "" &&
        String(p.classId) !== "null"
      const matchedClass = hasClass
        ? classes.find((c) => String(c.id) === String(p.classId))
        : null
      const className = hasClass
        ? p.className ||
          matchedClass?.nameVi ||
          matchedClass?.name ||
          `Lớp #${p.classId}`
        : ""

      if (hasMember) {
        return t("coachPlanSourcePersonal")
      }
      if (hasClass) {
        return t("coachPlanSourceClass").replace("{className}", className)
      }
      return t("coachPlanTargetGeneral")
    },
    [classes, t],
  )

  const formatPlanTargetLabel = useCallback(
    (p) => {
      if (!p) return t("coachPlanTargetGeneral")
      const hasMember =
        p.memberId != null &&
        String(p.memberId) !== "" &&
        String(p.memberId) !== "null"
      const hasClass =
        p.classId != null &&
        String(p.classId) !== "" &&
        String(p.classId) !== "null"
      const memberName = hasMember
        ? p.memberName ||
          availableStudents.find((s) => String(s.id) === String(p.memberId))
            ?.name ||
          `Học viên ${formatMemberCode(p.memberId)}`
        : ""
      const matchedClass = hasClass
        ? classes.find((c) => String(c.id) === String(p.classId))
        : null
      const className = hasClass
        ? p.className ||
          matchedClass?.nameVi ||
          matchedClass?.name ||
          `Lớp #${p.classId}`
        : ""

      if (hasClass && hasMember) {
        return t("coachPlanTargetClassAndMember")
          .replace("{className}", className)
          .replace("{memberName}", memberName)
      }
      if (hasMember) {
        return memberName
      }
      if (hasClass) {
        return t("coachPlanTargetWholeClass").replace("{className}", className)
      }
      return t("coachPlanTargetGeneral")
    },
    [availableStudents, classes, t],
  )

  // R2.3: Prioritize personal plans (memberId matches selected student), then class plans
  const studentApplicablePlans = useMemo(() => {
    if (!apiEnabled || apiPlans.length === 0) return []
    const memberIdStr = String(selectedMemberId || selectedStudent?.id || "")
    const personalPlans = apiPlans
      .filter((p) => memberIdStr && String(p.memberId) === memberIdStr)
      .sort((a, b) => Number(b.planId || b.id || 0) - Number(a.planId || a.id || 0))
    const classLevelPlans = apiPlans.filter(
      (p) =>
        (p.memberId == null || String(p.memberId) === "" || String(p.memberId) === "null") &&
        p.classId != null,
    )
    return [...personalPlans, ...classLevelPlans]
  }, [apiEnabled, apiPlans, selectedMemberId, selectedStudent?.id])

  const primaryStudentPlan = studentApplicablePlans[0] || null

  // Student's evaluations & latest score (R2.4: strictly filter by selected student, never leak other students' evaluations)
  const studentEvaluations = useMemo(() => {
    const memberIdStr = String(selectedMemberId || selectedStudent?.id || "")
    if (!memberIdStr) return evaluations
    return evaluations.filter((ev) => String(ev.memberId) === memberIdStr)
  }, [evaluations, selectedMemberId, selectedStudent?.id])

  const studentResults = useMemo(() => {
    const memberIdStr = String(selectedMemberId || selectedStudent?.id || "")
    if (!memberIdStr) return apiResults
    return apiResults.filter((res) => String(res.memberId) === memberIdStr)
  }, [apiResults, selectedMemberId, selectedStudent?.id])

  const latestEvaluationScore10 = useMemo(() => {
    if (studentEvaluations.length > 0) {
      const latest = studentEvaluations[0]
      const norm = normalizeScore(latest.progressScore)
      if (norm != null) return norm
    }
    return null
  }, [studentEvaluations])

  // P3.2 & R4.7: Score trend chart data
  const scoreChartData = useMemo(() => {
    return [...studentEvaluations]
      .reverse()
      .slice(-10)
      .map((ev, idx) => ({
        label: formatDate(ev.evaluationDate) || `Lần ${idx + 1}`,
        score: normalizeScore(ev.progressScore) ?? 0,
      }))
  }, [studentEvaluations])

  // R2.4: Student attendance rate summary (Completed sessions Present/Late vs total recorded)
  const studentAttendanceSummary = useMemo(() => {
    const memberIdStr = String(selectedMemberId || selectedStudent?.id || "")
    const studentAtt = apiAttendances.filter(
      (a) => !memberIdStr || String(a.memberId) === memberIdStr,
    )
    const total = studentAtt.length
    if (total === 0) {
      return { total: 0, attended: 0, ratePercent: null }
    }
    const attended = studentAtt.filter((a) => {
      const s = String(a.state || "").toLowerCase()
      return s.includes("present") || s.includes("checked") || s.includes("late")
    }).length
    return {
      total,
      attended,
      ratePercent: Math.round((attended / total) * 100),
    }
  }, [apiAttendances, selectedMemberId, selectedStudent?.id])

  const handleSaveTrainingPlan = async (e) => {
    if (e) e.preventDefault()
    const validExercises = planExercises.filter(
      (ex) => String(ex?.name || "").trim() !== "",
    )
    if (
      !planTitle.trim() ||
      !planGoal.trim() ||
      (validExercises.length === 0 && !planNotes.trim())
    ) {
      showToast(t("coachEmptyFieldValidationError"), "warning")
      return
    }
    setSavingPlan(true)
    try {
      const memberIdNum = parseNumericId(
        selectedMemberId || selectedStudent?.id,
        1,
      )
      const serializedContent = serializePlan({
        exercises: validExercises,
        notes: planNotes.trim(),
      })
      if (apiEnabled) {
        await memberPortalApi.createTrainingPlan({
          coachId: resolvedCoachId,
          memberId: memberIdNum,
          classId: classes[0]?.id ? Number(classes[0].id) : undefined,
          title: planTitle.trim(),
          goal: planGoal.trim(),
          content: serializedContent,
          startDate: planStartDate || undefined,
          endDate: planEndDate || undefined,
        })
        setPlanTitle("")
        setPlanGoal("")
        setPlanExercises([])
        setPlanNotes("")
        await loadAllProgressData()
        showToast("Đã tạo và lưu giáo án tập luyện lên hệ thống!", "success")
      }
    } catch (err) {
      showToast(
        getErrorMessage(err, "Không thể lưu giáo án tập luyện lên máy chủ."),
        "error",
      )
    } finally {
      setSavingPlan(false)
    }
  }

  const handleSaveTrainingResult = async (e) => {
    if (e) e.preventDefault()
    if (apiEnabled && !selectedSessionId) {
      showToast(
        "Vui lòng chọn một buổi học đã hoàn thành để ghi nhận kết quả.",
        "warning",
      )
      return
    }
    if (!resultContent.trim()) {
      showToast(t("coachEmptyFieldValidationError"), "warning")
      return
    }
    setSavingResult(true)
    try {
      const memberIdNum = parseNumericId(
        selectedMemberId || selectedStudent?.id,
        1,
      )
      if (apiEnabled) {
        await memberPortalApi.createTrainingResult({
          sessionId: Number(selectedSessionId),
          memberId: memberIdNum,
          coachId: resolvedCoachId,
          attendanceStatus: readOnlyAttendanceStatus,
          content: resultContent.trim(),
        })
        setResultContent("")
        await loadAllProgressData()
        showToast("Đã ghi nhận kết quả buổi tập thành công!", "success")
      }
    } catch (err) {
      showToast(
        getErrorMessage(err, "Không thể ghi nhận kết quả buổi tập."),
        "error",
      )
    } finally {
      setSavingResult(false)
    }
  }

  const handleSaveEvaluation = async () => {
    if (!comment.trim()) {
      showToast(t("coachEmptyFieldValidationError"), "warning")
      return
    }
    setSaving(true)
    try {
      const rawScore = Number(progressScore)
      if (apiEnabled) {
        const memberIdNum = parseNumericId(
          selectedMemberId || selectedStudent?.id,
          1,
        )
        const scoreOutOf10 = normalizeScore(rawScore) ?? 8.0
        await evaluationApi.createEvaluation({
          memberId: memberIdNum,
          coachId: resolvedCoachId,
          progressScore: scoreOutOf10,
          comment: comment.trim(),
        })
        setComment("")
        await loadAllProgressData()
        showToast("Đã lưu đánh giá tiến độ tập luyện thành công!", "success")
      }
    } catch (err) {
      showToast(
        getErrorMessage(err, "Không thể lưu đánh giá tiến độ lên máy chủ."),
        "error",
      )
    } finally {
      setSaving(false)
    }
  }

  const normalizedInputScore10 = useMemo(() => {
    const norm = normalizeScore(progressScore)
    return norm != null ? norm : 7.0
  }, [progressScore])

  const displayPercent = scoreToBarWidthPercent(latestEvaluationScore10)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Sticky Student Selector + 4 Horizontal Tabs */}
      <div className="sticky top-0 z-10 rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-bg-secondary text-brand-primary rounded border border-border-color">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl leading-7 font-semibold text-text-primary">
                {t("trainingProgress")}
              </h2>
              <p className="text-sm leading-5 text-text-secondary">
                {t("coachProgressSubtitle")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {apiEnabled && (
              <button
                type="button"
                onClick={loadAllProgressData}
                disabled={loadingData}
                aria-label={t("coachBtnRefresh")}
                title={t("coachBtnRefresh")}
                className="inline-flex h-9 w-9 items-center justify-center rounded transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none border border-border-color bg-bg-card text-text-secondary hover:bg-bg-secondary hover:text-text-primary cursor-pointer"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loadingData ? "animate-spin" : ""}`}
                />
              </button>
            )}
            {availableStudents.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs leading-4 font-medium text-text-secondary">
                  {t("coachEvaluatedStudentLabel")}
                </span>
                <select
                  value={selectedMemberId}
                  onChange={(e) => {
                    setSelectedMemberId(e.target.value)
                    if (typeof window !== "undefined") {
                      sessionStorage.setItem(
                        "scms_selected_progress_member_id",
                        e.target.value,
                      )
                    }
                  }}
                  className="h-9 w-full sm:w-56 rounded border border-border-color bg-bg-card px-3 py-1.5 text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted cursor-pointer"
                >
                  {availableStudents.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* 4 Tabs: Tổng quan | Giáo án | Nhật ký buổi tập | Đánh giá */}
        <div
          role="tablist"
          className="flex flex-wrap items-center gap-2 border-t border-border-color pt-3"
        >
          {[
            { id: "overview", label: t("coachTabOverview") },
            {
              id: "plans",
              label: `${t("coachTabPlans")} (${studentApplicablePlans.length})`,
            },
            {
              id: "logs",
              label: `${t("coachTabSessionLogs")} (${studentResults.length})`,
            },
            {
              id: "evaluations",
              label: `${t("coachTabEvaluations")} (${studentEvaluations.length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex h-8.5 items-center justify-center gap-1.5 rounded px-3 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none cursor-pointer ${
                activeTab === tab.id
                  ? "bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active"
                  : "border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-color pb-4">
              <div>
                <span className="text-xs leading-4 font-medium font-mono text-brand-primary uppercase">
                  {t("coachAssignedStudentTag")}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <h3 className="text-lg leading-7 font-semibold text-text-primary">
                    {selectedStudent?.name ||
                      primaryStudentPlan?.memberName ||
                      t("coachStudentLabel")}
                  </h3>
                  {selectedStudent?.code && (
                    <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-bg-secondary text-text-secondary ring-1 ring-inset ring-border-color font-mono">
                      {selectedStudent.code}
                    </span>
                  )}
                </div>
                <p className="text-sm leading-5 text-text-secondary mt-0.5">
                  {t("coachMainCoachLabel")}:{" "}
                  {currentUser?.name || t("coachDefaultCoachName")}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                {/* R2.4: Attendance rate summary with formula tooltip */}
                <div
                  className="text-right"
                  title={t("coachAttendanceRateTooltip")}
                >
                  <div className="text-xs leading-4 font-medium text-text-secondary mb-1 font-mono tabular-nums inline-flex items-center gap-1">
                    <span>
                      {t("coachAttendanceRateTitle")}:{" "}
                      {studentAttendanceSummary.ratePercent !== null
                        ? `${studentAttendanceSummary.ratePercent}% (${studentAttendanceSummary.attended}/${studentAttendanceSummary.total} buổi)`
                        : "Chưa có buổi"}
                    </span>
                    <Info className="w-3.5 h-3.5 text-text-muted" />
                  </div>
                  <div className="w-44 bg-bg-secondary h-2 rounded overflow-hidden border border-border-color ml-auto">
                    <div
                      style={{
                        width: `${studentAttendanceSummary.ratePercent ?? 0}%`,
                      }}
                      className="bg-status-success h-full rounded"
                    />
                  </div>
                </div>

                {/* R2.4: Progress Score 0-10 */}
                <div className="text-right">
                  <div className="text-xs leading-4 font-medium text-text-secondary mb-1 font-mono tabular-nums">
                    {t("coachProgressScoreDisplay")}:{" "}
                    {formatScore(latestEvaluationScore10)}
                  </div>
                  <div className="w-44 bg-bg-secondary h-2 rounded overflow-hidden border border-border-color ml-auto">
                    <div
                      style={{ width: `${displayPercent}%` }}
                      className="bg-brand-primary h-full rounded"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* R2.3: Display all applicable plans for this student (personal first, then class fallback) with explicit source badge */}
            {studentApplicablePlans.length === 0 ? (
              <div className="p-4 bg-bg-secondary border border-border-color rounded text-sm leading-5 text-text-secondary">
                Chưa có giáo án nào cho học viên này. Bạn có thể tạo mới ở tab{" "}
                <strong>{t("coachTabPlans")}</strong>.
              </div>
            ) : (
              <div className="space-y-4">
                {studentApplicablePlans.map((p) => {
                  const isPersonal =
                    p.memberId != null &&
                    String(p.memberId) !== "" &&
                    String(p.memberId) !== "null"
                  return (
                    <div
                      key={p.planId || p.id}
                      className="p-4 bg-bg-secondary border border-border-color rounded-lg space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                              isPersonal
                                ? "bg-sky-50 text-status-info ring-1 ring-inset ring-sky-200"
                                : "bg-bg-card text-text-secondary ring-1 ring-inset ring-border-color"
                            }`}
                          >
                            {getPlanSourceBadge(p)}
                          </span>
                          <h4 className="text-sm leading-5 font-semibold text-text-primary">
                            {p.title || "Giáo án tập luyện"}
                          </h4>
                        </div>
                        {(p.startDate || p.endDate) && (
                          <span className="text-xs leading-4 font-medium font-mono text-text-secondary">
                            {formatDate(p.startDate)} – {formatDate(p.endDate)}
                          </span>
                        )}
                      </div>

                      <div className="text-sm leading-5 font-normal text-text-primary">
                        <span className="font-semibold text-text-secondary">
                          {language === "vi" ? "Mục tiêu: " : "Goal: "}
                        </span>
                        <span>{p.goal || "—"}</span>
                      </div>

                      {p.content && (
                        <div className="pt-2 border-t border-border-color">
                          <PlanContentView content={p.content} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* P3.2 & R4.7: Progress Score Trend Chart (Y-axis step 2: 0, 2, 4, 6, 8, 10 + hint when < 2 evaluations) */}
          {scoreChartData.length > 0 && (
            <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-3">
              <div className="flex items-center justify-between border-b border-border-color pb-2.5">
                <h3 className="text-lg leading-7 font-semibold text-text-primary flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand-primary" />
                  <span>{t("coachChartScoreTrendTitle")}</span>
                </h3>
                <span className="text-xs leading-4 font-medium font-mono text-text-secondary">
                  {scoreChartData.length} kỳ đánh giá
                </span>
              </div>
              {scoreChartData.length < 2 && (
                <p className="text-sm leading-5 text-text-secondary italic">
                  {t("coachMinTwoEvalsHint")}
                </p>
              )}
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={scoreChartData}
                    margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
                    />
                    <YAxis
                      domain={[0, 10]}
                      ticks={[0, 2, 4, 6, 8, 10]}
                      tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
                    />
                    <Tooltip
                      formatter={(val) => [
                        `${Number(val).toFixed(1)}/10`,
                        t("coachProgressScoreDisplay"),
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="var(--brand-primary)"
                      strokeWidth={2.5}
                      dot={{ r: 5, fill: "var(--brand-primary)" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TRAINING PLANS */}
      {activeTab === "plans" && (
        <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-4">
          <div className="flex items-center justify-between border-b border-border-color pb-2.5">
            <h3 className="text-lg leading-7 font-semibold text-text-primary flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-brand-primary" />
              <span>Thiết kế giáo án mới</span>
            </h3>
            <span className="text-xs leading-4 font-medium font-mono text-text-secondary">
              {apiPlans.length} giáo án đã lưu
            </span>
          </div>

          <form onSubmit={handleSaveTrainingPlan} className="space-y-4 text-sm leading-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs leading-4 font-medium text-text-secondary block mb-1">
                  Tiêu đề giáo án *
                </label>
                <input
                  type="text"
                  required
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  placeholder="VD: Giáo án phát triển kỹ thuật & thể lực chuyên sâu"
                  className="h-9 w-full rounded border border-border-color bg-bg-card px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
                />
              </div>
              <div>
                <label className="text-xs leading-4 font-medium text-text-secondary block mb-1">
                  Mục tiêu huấn luyện *
                </label>
                <input
                  type="text"
                  required
                  value={planGoal}
                  onChange={(e) => setPlanGoal(e.target.value)}
                  placeholder="VD: Tăng cường sức bền, tốc độ di chuyển và độ chuẩn xác kỹ thuật"
                  className="h-9 w-full rounded border border-border-color bg-bg-card px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs leading-4 font-medium text-text-secondary block mb-1">
                  Từ ngày
                </label>
                <input
                  type="date"
                  value={planStartDate}
                  onChange={(e) => setPlanStartDate(e.target.value)}
                  className="h-9 w-full rounded border border-border-color bg-bg-card px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted font-mono"
                />
                <div className="text-xs leading-4 font-medium font-mono text-text-secondary mt-0.5">
                  {formatDate(planStartDate)}
                </div>
              </div>
              <div>
                <label className="text-xs leading-4 font-medium text-text-secondary block mb-1">
                  Đến ngày
                </label>
                <input
                  type="date"
                  value={planEndDate}
                  onChange={(e) => setPlanEndDate(e.target.value)}
                  className="h-9 w-full rounded border border-border-color bg-bg-card px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted font-mono"
                />
                <div className="text-xs leading-4 font-medium font-mono text-text-secondary mt-0.5">
                  {formatDate(planEndDate)}
                </div>
              </div>
            </div>

            <PlanBuilder
              exercises={planExercises}
              onExercisesChange={setPlanExercises}
              notes={planNotes}
              onNotesChange={setPlanNotes}
            />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingPlan}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded px-4 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {savingPlan ? "Đang lưu..." : "Lưu giáo án tập luyện"}
                </span>
              </button>
            </div>
          </form>

          {apiPlans.length > 0 && (
            <div className="pt-3 border-t border-border-color space-y-2.5">
              {(showAllPlans ? apiPlans : apiPlans.slice(0, 5)).map((p) => (
                <div
                  key={p.planId || p.id}
                  className="p-3 bg-bg-secondary border border-border-color rounded-lg text-sm leading-5 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-bg-card text-text-secondary ring-1 ring-inset ring-border-color">
                        {getPlanSourceBadge(p)}
                      </span>
                      <span className="font-semibold text-text-primary">
                        {p.title} &bull; {formatPlanTargetLabel(p)}
                      </span>
                    </div>
                    {(p.startDate || p.endDate) && (
                      <span className="text-xs leading-4 font-medium font-mono text-text-secondary">
                        {formatDate(p.startDate)} – {formatDate(p.endDate)}
                      </span>
                    )}
                  </div>
                  <div className="text-text-secondary">{p.goal}</div>
                  {p.content && <PlanContentView content={p.content} />}
                </div>
              ))}
              {apiPlans.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllPlans((v) => !v)}
                  className="inline-flex h-8 items-center justify-center gap-1 rounded px-3 text-xs font-medium leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary cursor-pointer"
                >
                  {showAllPlans
                    ? t("coachShowLess")
                    : `${t("coachShowMore")} (${apiPlans.length - 5})`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SESSION LOGS */}
      {activeTab === "logs" && (
        <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-4">
          <div className="flex items-center justify-between border-b border-border-color pb-2.5">
            <h3 className="text-lg leading-7 font-semibold text-text-primary flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-status-success" />
              <span>Ghi nhận kết quả buổi tập</span>
            </h3>
            <span className="text-xs leading-4 font-medium font-mono text-text-secondary">
              {studentResults.length} bản ghi
            </span>
          </div>

          <form onSubmit={handleSaveTrainingResult} className="space-y-3 text-sm leading-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs leading-4 font-medium text-text-secondary block mb-1">
                  Chọn buổi học đã hoàn thành *
                </label>
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="h-9 w-full rounded border border-border-color bg-bg-card px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
                >
                  {completedSessions.length === 0 ? (
                    <option value="">{t("coachNoCompletedSessions")}</option>
                  ) : (
                    completedSessions.slice(0, 40).map((s) => (
                      <option key={s.id} value={s.id}>
                        {formatDate(s.sessionDate)} ({formatTime(s.startTime)}) —{" "}
                        {s.className || s.subjectName || "PT 1:1"}
                      </option>
                    ))
                  )}
                </select>
                <p className="text-xs leading-4 font-medium text-text-secondary mt-1">
                  {t("coachOnlyCompletedSessionsHint")}
                </p>
              </div>
              <div>
                <label className="text-xs leading-4 font-medium text-text-secondary block mb-1">
                  {t("coachAttendanceReadOnlyLabel")}
                </label>
                <div className="h-9 w-full bg-bg-secondary border border-border-color rounded px-3 py-1.5 text-text-primary text-sm font-semibold flex items-center justify-between">
                  <CoachStatusBadge
                    domain="attendance"
                    value={readOnlyAttendanceStatus}
                  />
                  <span className="text-xs leading-4 font-mono text-text-secondary uppercase">
                    {t("coachReadOnlyTag")}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs leading-4 font-medium text-text-secondary block mb-1">
                Nhận xét kỹ thuật &amp; kết quả thực hiện trong buổi *
              </label>
              <textarea
                rows={4}
                required
                value={resultContent}
                onChange={(e) => setResultContent(e.target.value)}
                placeholder="Nhập nhận xét thực tế về khối lượng bài tập, kỹ thuật động tác và thể lực của học viên trong buổi..."
                className="w-full rounded border border-border-color bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={
                  savingResult || (apiEnabled && completedSessions.length === 0)
                }
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded px-4 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>
                  {savingResult ? "Đang lưu..." : "Ghi nhận kết quả buổi tập"}
                </span>
              </button>
            </div>
          </form>

          {studentResults.length > 0 && (
            <div className="pt-3 border-t border-border-color space-y-2">
              {(showAllResults ? studentResults : studentResults.slice(0, 5)).map((r) => {
                const memberLabel =
                  r.memberName ||
                  availableStudents.find(
                    (s) => String(s.id) === String(r.memberId),
                  )?.name ||
                  (r.memberId
                    ? `Học viên ${formatMemberCode(r.memberId)}`
                    : t("coachStudentLabel"))
                const sessionLabel =
                  r.className ||
                  (r.sessionId ? `Buổi #${r.sessionId}` : "Buổi tập")
                return (
                  <div
                    key={r.resultId || r.id}
                    className="p-2.5 bg-bg-secondary border border-border-color rounded text-sm leading-5 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold text-text-primary">
                        {memberLabel} &bull; {sessionLabel}
                      </div>
                      <div className="text-text-secondary mt-0.5">{r.content}</div>
                    </div>
                    <CoachStatusBadge
                      domain="attendance"
                      value={r.attendanceStatus || "Present"}
                    />
                  </div>
                )
              })}
              {studentResults.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllResults((v) => !v)}
                  className="inline-flex h-8 items-center justify-center gap-1 rounded px-3 text-xs font-medium leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary cursor-pointer"
                >
                  {showAllResults
                    ? t("coachShowLess")
                    : `${t("coachShowMore")} (${studentResults.length - 5})`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: EVALUATIONS */}
      {activeTab === "evaluations" && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-border-color pb-3">
              <label className="text-lg leading-7 font-semibold text-text-primary flex items-center gap-2">
                <Award className="w-4 h-4 text-status-success" />
                <span>Đánh giá định kỳ của Coach</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs leading-4 font-medium text-text-secondary">
                  Điểm tiến độ (thang 0 – 10):
                </span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step="0.5"
                  value={normalizedInputScore10}
                  onChange={(e) => setProgressScore(Number(e.target.value))}
                  className="h-9 w-24 rounded border border-border-color bg-bg-card px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted font-mono font-semibold"
                />
              </div>
            </div>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Nhập nhận xét đánh giá định kỳ cho học viên..."
              className="w-full rounded border border-border-color bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveEvaluation}
                disabled={saving}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded px-4 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "Đang lưu..." : "Lưu đánh giá tiến độ"}</span>
              </button>
            </div>
          </div>

          {studentEvaluations.length > 0 && (
            <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-3">
              <div className="flex items-center justify-between border-b border-border-color pb-2.5">
                <h3 className="text-lg leading-7 font-semibold text-text-primary flex items-center gap-2">
                  <Award className="w-4 h-4 text-status-success" />
                  <span>Lịch sử đánh giá học viên ({studentEvaluations.length})</span>
                </h3>
              </div>
              <div className="space-y-2">
                {(showAllEvaluations ? studentEvaluations : studentEvaluations.slice(0, 6)).map(
                  (ev) => {
                    const evMemberLabel =
                      ev.memberName ||
                      availableStudents.find(
                        (s) => String(s.id) === String(ev.memberId),
                      )?.name ||
                      (ev.memberId
                        ? `Học viên ${formatMemberCode(ev.memberId)}`
                        : t("coachStudentLabel"))
                    return (
                      <div
                        key={ev.id || `${ev.memberId}-${ev.evaluationDate}`}
                        className="p-3 bg-bg-secondary border border-border-color rounded flex items-center justify-between text-sm leading-5"
                      >
                        <div>
                          <div className="font-semibold text-text-primary">
                            {evMemberLabel} &bull; HLV:{" "}
                            {ev.coachName || currentUser?.name}
                          </div>
                          <div className="text-text-secondary mt-0.5">
                            {ev.comment}
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="font-semibold text-status-success">
                            {t("coachScorePrefix")}:{" "}
                            {formatScore(ev.progressScore)}
                          </div>
                          <div className="text-xs leading-4 text-text-secondary">
                            {formatDate(ev.evaluationDate)}
                          </div>
                        </div>
                      </div>
                    )
                  },
                )}
                {studentEvaluations.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setShowAllEvaluations((v) => !v)}
                    className="inline-flex h-8 items-center justify-center gap-1 rounded px-3 text-xs font-medium leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary cursor-pointer"
                  >
                    {showAllEvaluations
                      ? t("coachShowLess")
                      : `${t("coachShowMore")} (${studentEvaluations.length - 6})`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
