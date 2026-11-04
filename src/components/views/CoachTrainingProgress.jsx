import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { evaluationApi } from "../../api/evaluationApi"
import { memberPortalApi } from "../../api/memberPortalApi"
import { attendanceApi } from "../../api/attendanceApi"
import { getErrorMessage } from "../../api/apiErrors"
import { canLogResult } from "../../utils/permissions"
import { formatDate, formatTime } from "../../utils/datetime"
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
} from "lucide-react"

export function CoachTrainingProgress() {
  const {
    trainingPlans,
    members,
    classes,
    currentUser,
    updateTrainingPlan,
    apiEnabled,
    showToast,
    t,
    language,
  } = useSCMS()
  const plan = trainingPlans[0]

  const resolvedCoachId = useMemo(() => {
    const raw = currentUser?.coachId ?? currentUser?.id ?? plan?.coachId
    const match = String(raw || "").match(/(\d+)$/)
    const parsed = match ? Number(match[1]) : Number(raw)
    return !Number.isNaN(parsed) && parsed > 0 ? parsed : 1
  }, [currentUser?.coachId, currentUser?.id, plan?.coachId])

  const [activeTab, setActiveTab] = useState("overview") // 'overview' | 'plans' | 'logs' | 'evaluations'
  const [selectedMemberId, setSelectedMemberId] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("scms_selected_progress_member_id")
      if (saved) return saved
    }
    return ""
  })

  // Create forms start EMPTY per P2.4 (use placeholder instead of sample text)
  const [comment, setComment] = useState("")
  const [progressScore, setProgressScore] = useState(
    apiEnabled
      ? Number(((plan?.progressPercent || 80) / 10).toFixed(1))
      : plan?.progressPercent || 80,
  )
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

  // New Training Result form state (empty by default, placeholder only per P2.4)
  const [selectedSessionId, setSelectedSessionId] = useState("")
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

  const availableStudents = useMemo(() => {
    const map = new Map()
    ;(members || []).forEach((m) => {
      if (m?.id != null) {
        map.set(String(m.id), {
          id: m.id,
          name: m.name || `Học viên #${m.id}`,
          code: m.code || `MB-${m.id}`,
        })
      }
    })
    advancedRegs.forEach((r) => {
      if (r?.memberId != null && !map.has(String(r.memberId))) {
        map.set(String(r.memberId), {
          id: r.memberId,
          name: r.memberName || `Học viên #${r.memberId}`,
          code: `PT-${r.memberId}`,
        })
      }
    })
    apiPlans.forEach((p) => {
      if (p?.memberId != null && !map.has(String(p.memberId))) {
        map.set(String(p.memberId), {
          id: p.memberId,
          name: p.memberName || `Học viên #${p.memberId}`,
          code: `MB-${p.memberId}`,
        })
      }
    })
    evaluations.forEach((ev) => {
      if (ev?.memberId != null && !map.has(String(ev.memberId))) {
        map.set(String(ev.memberId), {
          id: ev.memberId,
          name: ev.memberName || `Học viên #${ev.memberId}`,
          code: ev.memberCode || `MB-${ev.memberId}`,
        })
      }
    })
    return Array.from(map.values())
  }, [members, advancedRegs, apiPlans, evaluations])

  useEffect(() => {
    if (!selectedMemberId && availableStudents.length > 0) {
      setSelectedMemberId(String(availableStudents[0].id))
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
          `Học viên #${p.memberId}`
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

  const activeStudentApiPlan = useMemo(() => {
    if (!apiEnabled || apiPlans.length === 0) return null
    const memberIdStr = String(selectedMemberId || selectedStudent?.id || "")
    return (
      apiPlans.find((p) => memberIdStr && String(p.memberId) === memberIdStr) ||
      apiPlans[0] ||
      null
    )
  }, [apiEnabled, apiPlans, selectedMemberId, selectedStudent?.id])

  // P3.2: Score trend chart data for the selected student (or all evaluations if none matched)
  const scoreChartData = useMemo(() => {
    const memberIdStr = String(selectedMemberId || selectedStudent?.id || "")
    const studentEvals = evaluations.filter(
      (ev) => !memberIdStr || String(ev.memberId) === memberIdStr,
    )
    const source = studentEvals.length > 0 ? studentEvals : evaluations
    return [...source]
      .reverse()
      .slice(-10)
      .map((ev, idx) => ({
        label: formatDate(ev.evaluationDate) || `Lần ${idx + 1}`,
        score: normalizeScore(ev.progressScore) ?? 0,
      }))
  }, [evaluations, selectedMemberId, selectedStudent?.id])

  // P3.2: Student attendance rate summary
  const studentAttendanceSummary = useMemo(() => {
    const memberIdStr = String(selectedMemberId || selectedStudent?.id || "")
    const studentAtt = apiAttendances.filter(
      (a) => !memberIdStr || String(a.memberId) === memberIdStr,
    )
    const total = studentAtt.length
    if (total === 0) {
      return { total: 0, attended: 0, ratePercent: 100 }
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
        selectedMemberId || plan?.memberId,
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
      } else if (plan) {
        updateTrainingPlan({
          id: plan.id,
          memberName: selectedStudent?.name || plan.memberName,
          goalVi: planGoal,
          goal: planGoal,
          resultNotes: comment,
          progressPercent: Number(progressScore) || 80,
        })
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
        selectedMemberId || plan?.memberId,
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
      } else {
        setResultContent("")
        showToast("Đã ghi nhận kết quả buổi tập!", "success")
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
          selectedMemberId || plan?.memberId,
          1,
        )
        const scoreOutOf10 = normalizeScore(rawScore) ?? 8.5
        await evaluationApi.createEvaluation({
          memberId: memberIdNum,
          coachId: resolvedCoachId,
          progressScore: scoreOutOf10,
          comment: comment.trim(),
        })
        setComment("")
        await loadAllProgressData()
        showToast("Đã lưu đánh giá tiến độ tập luyện thành công!", "success")
      } else if (plan) {
        const newPercent = Math.min(
          100,
          rawScore || (plan?.progressPercent || 65) + 5,
        )
        updateTrainingPlan({
          id: plan.id,
          memberName: plan.memberName,
          resultNotes: comment,
          progressPercent: newPercent,
        })
        setComment("")
      } else {
        setComment("")
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

  const normalizedScore10 = useMemo(() => {
    const norm = normalizeScore(progressScore)
    return norm != null ? norm : 8.0
  }, [progressScore])

  const displayPercent = scoreToBarWidthPercent(normalizedScore10)

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Sticky Student Selector + 4 Horizontal Tabs (P2.4) */}
      <div className="sticky top-0 z-10 bg-white border border-slate-200 p-4 rounded-lg shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 text-slate-800 rounded border border-slate-200">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                {t("trainingProgress")}
              </h2>
              <p className="text-xs text-slate-500">
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
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loadingData ? "animate-spin" : ""}`}
                />
                <span>{t("coachBtnRefresh")}</span>
              </button>
            )}
            {availableStudents.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">
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
                  className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  {availableStudents.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
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
          className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3"
        >
          {[
            { id: "overview", label: t("coachTabOverview") },
            { id: "plans", label: `${t("coachTabPlans")} (${apiPlans.length})` },
            {
              id: "logs",
              label: `${t("coachTabSessionLogs")} (${apiResults.length})`,
            },
            {
              id: "evaluations",
              label: `${t("coachTabEvaluations")} (${evaluations.length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded text-xs font-bold border transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
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
          {(plan || activeStudentApiPlan) && (
            <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <span className="text-[10px] text-blue-800 font-mono font-bold uppercase">
                    {t("coachAssignedStudentTag")}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    {selectedStudent?.name ||
                      activeStudentApiPlan?.memberName ||
                      plan?.memberName ||
                      t("coachStudentLabel")}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t("coachMainCoachLabel")}:{" "}
                    {currentUser?.name ||
                      plan?.coachName ||
                      t("coachDefaultCoachName")}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-6">
                  {/* Attendance rate summary (P3.2) */}
                  <div className="text-right">
                    <div className="text-xs text-slate-600 font-bold mb-1 font-mono tabular-nums">
                      {t("coachAttendanceRateTitle")}:{" "}
                      {studentAttendanceSummary.ratePercent}% (
                      {studentAttendanceSummary.attended}/
                      {studentAttendanceSummary.total} buổi)
                    </div>
                    <div className="w-40 bg-slate-100 h-2 rounded overflow-hidden border border-slate-200 ml-auto">
                      <div
                        style={{
                          width: `${studentAttendanceSummary.ratePercent}%`,
                        }}
                        className="bg-emerald-600 h-full rounded"
                      />
                    </div>
                  </div>

                  {/* Progress Score 0-10 */}
                  <div className="text-right">
                    <div className="text-xs text-slate-600 font-bold mb-1 font-mono tabular-nums">
                      {t("coachProgressScoreDisplay")}:{" "}
                      {formatScore(normalizedScore10)}
                    </div>
                    <div className="w-44 bg-slate-100 h-2 rounded overflow-hidden border border-slate-200 ml-auto">
                      <div
                        style={{ width: `${displayPercent}%` }}
                        className="bg-slate-900 h-full rounded"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded">
                <div className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1 whitespace-nowrap">
                  {language === "vi" ? "Mục tiêu tập luyện" : "Training Goal"}
                </div>
                <p className="text-xs text-slate-800 font-medium">
                  {apiEnabled
                    ? activeStudentApiPlan?.goal ||
                      "Chưa thiết lập mục tiêu tập luyện cho học viên này."
                    : language === "vi"
                      ? plan?.goalVi
                      : plan?.goal}
                </p>
              </div>

              {/* Structured or Plain-text Exercise Content (P3.1) */}
              {apiEnabled ? (
                activeStudentApiPlan?.content ? (
                  <div className="p-4 bg-white border border-slate-200 rounded space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      {activeStudentApiPlan.title ||
                        "Nội dung giáo án hiện tại"}
                    </h4>
                    <PlanContentView content={activeStudentApiPlan.content} />
                  </div>
                ) : null
              ) : (
                plan?.exercises && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 whitespace-nowrap">
                      {language === "vi"
                        ? "Danh sách bài tập thiết kế"
                        : "Assigned Exercise Routine"}
                    </h4>
                    <div className="overflow-x-auto border border-slate-200 rounded">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200 whitespace-nowrap">
                          <tr>
                            <th className="py-2.5 px-3">
                              {t("coachPlanBuilderExName")}
                            </th>
                            <th className="py-2.5 px-3">
                              {t("coachPlanBuilderSets")}
                            </th>
                            <th className="py-2.5 px-3">
                              {t("coachPlanBuilderReps")}
                            </th>
                            <th className="py-2.5 px-3">
                              {t("coachLoadOrNoteLabel")}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-slate-800">
                          {plan.exercises.map((ex, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 h-[36px]">
                              <td className="py-2 px-3 font-bold text-slate-900">
                                {ex.name}
                              </td>
                              <td className="py-2 px-3 font-mono tabular-nums">
                                {ex.sets}
                              </td>
                              <td className="py-2 px-3 font-mono tabular-nums">
                                {ex.reps}
                              </td>
                              <td className="py-2 px-3 font-mono tabular-nums text-slate-700 font-semibold">
                                {ex.weight || "Trọng lượng cơ thể"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              )}
            </div>
          )}

          {/* P3.2: Progress Score Trend Chart (Recharts) */}
          {scoreChartData.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-700" />
                  <span>{t("coachChartScoreTrendTitle")}</span>
                </h3>
                <span className="text-xs font-mono text-slate-500">
                  {scoreChartData.length} kỳ đánh giá
                </span>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={scoreChartData}
                    margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#475569" }}
                    />
                    <YAxis
                      domain={[0, 10]}
                      tick={{ fontSize: 11, fill: "#475569" }}
                    />
                    <Tooltip
                      formatter={(val) => [`${Number(val).toFixed(1)}/10`, "Điểm"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#1D4ED8"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#1D4ED8" }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: TRAINING PLANS (P3.1 Structured PlanBuilder) */}
      {activeTab === "plans" && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-blue-700" />
              <span>Thiết Kế Giáo Án Mới</span>
            </h3>
            <span className="text-xs font-mono text-slate-500">
              {apiPlans.length} giáo án đã lưu
            </span>
          </div>

          <form onSubmit={handleSaveTrainingPlan} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Tiêu đề giáo án *
                </label>
                <input
                  type="text"
                  required
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  placeholder="VD: Giáo án phát triển kỹ thuật & thể lực chuyên sâu"
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900 font-semibold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Mục tiêu huấn luyện *
                </label>
                <input
                  type="text"
                  required
                  value={planGoal}
                  onChange={(e) => setPlanGoal(e.target.value)}
                  placeholder="VD: Tăng cường sức bền, tốc độ di chuyển và độ chuẩn xác kỹ thuật"
                  className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Từ ngày
                </label>
                <input
                  type="date"
                  value={planStartDate}
                  onChange={(e) => setPlanStartDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-mono"
                />
                <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                  {formatDate(planStartDate)}
                </div>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Đến ngày
                </label>
                <input
                  type="date"
                  value={planEndDate}
                  onChange={(e) => setPlanEndDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-slate-900 font-mono"
                />
                <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                  {formatDate(planEndDate)}
                </div>
              </div>
            </div>

            {/* P3.1: Structured Exercise Builder + General Notes */}
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
                className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  {savingPlan ? "Đang lưu..." : "Lưu Giáo Án Tập Luyện"}
                </span>
              </button>
            </div>
          </form>

          {apiPlans.length > 0 && (
            <div className="pt-3 border-t border-slate-200 space-y-2.5">
              {(showAllPlans ? apiPlans : apiPlans.slice(0, 5)).map((p) => (
                <div
                  key={p.planId || p.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-slate-900">
                      {p.title} &bull; {formatPlanTargetLabel(p)}
                    </div>
                    {(p.startDate || p.endDate) && (
                      <span className="text-[11px] font-mono text-slate-500">
                        {formatDate(p.startDate)} – {formatDate(p.endDate)}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-600">{p.goal}</div>
                  {p.content && <PlanContentView content={p.content} />}
                </div>
              ))}
              {apiPlans.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllPlans((v) => !v)}
                  className="text-xs font-bold text-blue-700 hover:underline cursor-pointer"
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
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>Ghi Nhận Kết Quả Buổi Tập</span>
            </h3>
            <span className="text-xs font-mono text-slate-500">
              {apiResults.length} bản ghi
            </span>
          </div>

          <form onSubmit={handleSaveTrainingResult} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Chọn buổi học đã hoàn thành *
                </label>
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-2 text-slate-900 font-semibold"
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
                <p className="text-[11px] text-slate-500 mt-1">
                  {t("coachOnlyCompletedSessionsHint")}
                </p>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {t("coachAttendanceReadOnlyLabel")}
                </label>
                <div className="w-full bg-slate-100 border border-slate-200 rounded px-3 py-2 text-slate-800 font-bold flex items-center justify-between">
                  <CoachStatusBadge
                    domain="attendance"
                    value={readOnlyAttendanceStatus}
                  />
                  <span className="text-[10px] font-mono text-slate-500 uppercase">
                    {t("coachReadOnlyTag")}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Nhận xét kỹ thuật &amp; kết quả thực hiện trong buổi *
              </label>
              <textarea
                rows={4}
                required
                value={resultContent}
                onChange={(e) => setResultContent(e.target.value)}
                placeholder="Nhập nhận xét thực tế về khối lượng bài tập, kỹ thuật động tác và thể lực của học viên trong buổi..."
                className="w-full bg-slate-50 border border-slate-300 rounded p-2.5 text-slate-900"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={
                  savingResult || (apiEnabled && completedSessions.length === 0)
                }
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>
                  {savingResult ? "Đang lưu..." : "Ghi Nhận Kết Quả Buổi Tập"}
                </span>
              </button>
            </div>
          </form>

          {apiResults.length > 0 && (
            <div className="pt-3 border-t border-slate-200 space-y-2">
              {(showAllResults ? apiResults : apiResults.slice(0, 5)).map((r) => {
                const memberLabel =
                  r.memberName ||
                  availableStudents.find(
                    (s) => String(s.id) === String(r.memberId),
                  )?.name ||
                  (r.memberId
                    ? `Học viên #${r.memberId}`
                    : t("coachStudentLabel"))
                const sessionLabel =
                  r.className ||
                  (r.sessionId ? `Buổi #${r.sessionId}` : "Buổi tập")
                return (
                  <div
                    key={r.resultId || r.id}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-slate-900">
                        {memberLabel} &bull; {sessionLabel}
                      </div>
                      <div className="text-slate-600 mt-0.5">{r.content}</div>
                    </div>
                    <CoachStatusBadge
                      domain="attendance"
                      value={r.attendanceStatus || "Present"}
                    />
                  </div>
                )
              })}
              {apiResults.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllResults((v) => !v)}
                  className="text-xs font-bold text-blue-700 hover:underline cursor-pointer"
                >
                  {showAllResults
                    ? t("coachShowLess")
                    : `${t("coachShowMore")} (${apiResults.length - 5})`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: EVALUATIONS */}
      {activeTab === "evaluations" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-700" />
                <span>Đánh giá định kỳ của Coach</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">
                  Điểm tiến độ (Thang 0 – 10):
                </span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  step="0.5"
                  value={normalizedScore10}
                  onChange={(e) => setProgressScore(Number(e.target.value))}
                  className="w-20 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-900"
                />
              </div>
            </div>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Nhập nhận xét đánh giá định kỳ cho học viên..."
              className="w-full bg-slate-50 border border-slate-300 rounded p-3 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveEvaluation}
                disabled={saving}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? "Đang lưu..." : "Lưu Đánh Giá Tiến Độ"}</span>
              </button>
            </div>
          </div>

          {evaluations.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-700" />
                  <span>Lịch Sử Đánh Giá Học Viên ({evaluations.length})</span>
                </h3>
              </div>
              <div className="space-y-2">
                {(showAllEvaluations ? evaluations : evaluations.slice(0, 6)).map(
                  (ev) => {
                    const evMemberLabel =
                      ev.memberName ||
                      availableStudents.find(
                        (s) => String(s.id) === String(ev.memberId),
                      )?.name ||
                      (ev.memberId
                        ? `Học viên #${ev.memberId}`
                        : t("coachStudentLabel"))
                    return (
                      <div
                        key={ev.id || `${ev.memberId}-${ev.evaluationDate}`}
                        className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900">
                            {evMemberLabel} &bull; HLV:{" "}
                            {ev.coachName || currentUser?.name}
                          </div>
                          <div className="text-slate-600 mt-0.5">
                            {ev.comment}
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="font-bold text-emerald-800">
                            {t("coachScorePrefix")}:{" "}
                            {formatScore(ev.progressScore)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {formatDate(ev.evaluationDate)}
                          </div>
                        </div>
                      </div>
                    )
                  },
                )}
                {evaluations.length > 6 && (
                  <button
                    type="button"
                    onClick={() => setShowAllEvaluations((v) => !v)}
                    className="text-xs font-bold text-blue-700 hover:underline cursor-pointer"
                  >
                    {showAllEvaluations
                      ? t("coachShowLess")
                      : `${t("coachShowMore")} (${evaluations.length - 6})`}
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
