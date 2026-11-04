import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { evaluationApi } from "../../api/evaluationApi"
import { memberPortalApi } from "../../api/memberPortalApi"
import { attendanceApi } from "../../api/attendanceApi"
import { getErrorMessage } from "../../api/apiErrors"
import { canLogResult } from "../../utils/permissions"
import {
  Activity,
  Save,
  Award,
  Plus,
  ClipboardList,
  CheckCircle2,
  RefreshCw,
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

  const [selectedMemberId, setSelectedMemberId] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("scms_selected_progress_member_id")
      if (saved) return saved
    }
    return ""
  })
  const [comment, setComment] = useState(plan?.resultNotes || "")
  // Backend EvaluationRequest.progressScore has minimum=0, maximum=10
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

  // New Training Plan form state (/api/training-plans)
  const [planTitle, setPlanTitle] = useState(
    "Giáo án phát triển kỹ thuật & thể lực chuyên sâu",
  )
  const [planGoal, setPlanGoal] = useState(
    plan?.goalVi || "Tăng cường sức bền, tốc độ di chuyển và độ chuẩn xác kỹ thuật.",
  )
  const [planContent, setPlanContent] = useState(
    "Buổi 1-4: Khởi động khớp chuyên sâu, bài tập bộ chân di chuyển 4 góc sân (3 hiệp x 15 phút).\nBuổi 5-8: Kỹ thuật đánh cầu/bóng bền kết hợp phản xạ tốc độ cao.\nBuổi 9-12: Đấu tập chiến thuật và kiểm tra thể lực cuối khóa.",
  )
  const [planStartDate, setPlanStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  )
  const [planEndDate, setPlanEndDate] = useState(() => {
    const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    return d.toISOString().slice(0, 10)
  })
  const [savingPlan, setSavingPlan] = useState(false)

  // New Training Result form state (/api/training-results)
  const [selectedSessionId, setSelectedSessionId] = useState("")
  const [resultContent, setResultContent] = useState(
    "Học viên hoàn thành đầy đủ khối lượng bài tập trong buổi, kỹ thuật động tác đúng chuẩn.",
  )
  const [savingResult, setSavingResult] = useState(false)

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

  // Merge available students from members context + assigned PT registrations + plans/evaluations
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
  }, [selectedSessionId, selectedMemberId, selectedStudent?.id, apiResults, apiAttendances])

  const formatPlanTargetLabel = useCallback(
    (p) => {
      if (!p) return t("coachPlanTargetGeneral")
      const hasMember = p.memberId != null && String(p.memberId) !== "" && String(p.memberId) !== "null"
      const hasClass = p.classId != null && String(p.classId) !== "" && String(p.classId) !== "null"
      const memberName = hasMember
        ? p.memberName ||
          availableStudents.find((s) => String(s.id) === String(p.memberId))?.name ||
          `Học viên #${p.memberId}`
        : ""
      const matchedClass = hasClass
        ? classes.find((c) => String(c.id) === String(p.classId))
        : null
      const className = hasClass
        ? p.className || matchedClass?.nameVi || matchedClass?.name || `Lớp #${p.classId}`
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

  const handleSaveTrainingPlan = async (e) => {
    if (e) e.preventDefault()
    if (!planTitle.trim()) {
      showToast("Vui lòng nhập tiêu đề giáo án tập luyện.", "warning")
      return
    }
    setSavingPlan(true)
    try {
      const memberIdNum = parseNumericId(
        selectedMemberId || plan?.memberId,
        1,
      )
      if (apiEnabled) {
        await memberPortalApi.createTrainingPlan({
          coachId: resolvedCoachId,
          memberId: memberIdNum,
          classId: classes[0]?.id ? Number(classes[0].id) : undefined,
          title: planTitle.trim(),
          goal: planGoal.trim(),
          content: planContent.trim(),
          startDate: planStartDate || undefined,
          endDate: planEndDate || undefined,
        })
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
      showToast("Vui lòng chọn một buổi học đã hoàn thành để ghi nhận kết quả.", "warning")
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
          content:
            resultContent.trim() ||
            "Hoàn thành tốt nội dung huấn luyện trong buổi.",
        })
        await loadAllProgressData()
        showToast("Đã ghi nhận kết quả buổi tập thành công!", "success")
      } else {
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
    setSaving(true)
    try {
      const rawScore = Number(progressScore)
      if (apiEnabled) {
        const memberIdNum = parseNumericId(
          selectedMemberId || plan?.memberId,
          1,
        )
        const scoreOutOf10 =
          !Number.isNaN(rawScore) && rawScore > 10
            ? Number((rawScore / 10).toFixed(1))
            : Math.max(0, Math.min(10, Number.isNaN(rawScore) ? 8.5 : rawScore))
        await evaluationApi.createEvaluation({
          memberId: memberIdNum,
          coachId: resolvedCoachId,
          progressScore: scoreOutOf10,
          comment: comment || "Hoàn thành tốt giáo án tập luyện.",
        })
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
      } else {
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
    const raw = Number(progressScore)
    if (Number.isNaN(raw)) return 8.0
    const val = raw > 10 ? raw / 10 : raw
    return Math.max(0, Math.min(10, Number(val.toFixed(1))))
  }, [progressScore])

  const displayPercent = Math.min(100, normalizedScore10 * 10)

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-lg shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 text-slate-800 rounded border border-slate-200">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              {t("trainingProgress")}
            </h2>
            <p className="text-xs text-slate-500">
              Lập giáo án huấn luyện, ghi nhận kết quả buổi tập &amp; đánh giá định kỳ học viên
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
                Học viên đánh giá:
              </span>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
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

      {(plan || activeStudentApiPlan) && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <span className="text-[10px] text-blue-800 font-mono font-bold uppercase">
                HỌC VIÊN PHÂN CÔNG
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                {selectedStudent?.name ||
                  activeStudentApiPlan?.memberName ||
                  plan?.memberName ||
                  "Học viên"}
              </h3>
              <p className="text-xs text-slate-500">
                Coach chính: {currentUser?.name || plan?.coachName || "HLV"}
              </p>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-600 font-bold mb-1 font-mono tabular-nums">
                Điểm tiến độ: {normalizedScore10.toFixed(1)}/10
              </div>
              <div className="w-48 bg-slate-100 h-2 rounded overflow-hidden border border-slate-200">
                <div
                  style={{ width: `${displayPercent}%` }}
                  className="bg-slate-900 h-full rounded"
                />
              </div>
            </div>
          </div>

          {/* Goal Section */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1 whitespace-nowrap">
              {language === "vi" ? "Mục tiêu tập luyện" : "Training Goal"}
            </div>
            <p className="text-xs text-slate-800 font-medium">
              {apiEnabled
                ? activeStudentApiPlan?.goal || planGoal
                : language === "vi"
                  ? plan?.goalVi
                  : plan?.goal}
            </p>
          </div>

          {/* Exercise Content / Table */}
          {apiEnabled ? (
            activeStudentApiPlan?.content ? (
              <div className="p-4 bg-white border border-slate-200 rounded space-y-1.5">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {activeStudentApiPlan.title || "Nội dung giáo án hiện tại"}
                </h4>
                <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                  {activeStudentApiPlan.content}
                </p>
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
                          {language === "vi" ? "Tên bài tập" : "Exercise Name"}
                        </th>
                        <th className="py-2.5 px-3">
                          {language === "vi" ? "Số Sets" : "Sets"}
                        </th>
                        <th className="py-2.5 px-3">
                          {language === "vi"
                            ? "Reps / Thời gian"
                            : "Reps / Duration"}
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

          {/* Coach Result Comments & Progress Score */}
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Đánh giá định kỳ của Coach
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
              className="w-full bg-slate-50 border border-slate-300 rounded p-3 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveEvaluation}
                disabled={saving}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? "Đang lưu..." : "Lưu Đánh Giá Tiến Độ"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Training Plan & Record Session Training Result Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form 1: Lập Kế Hoạch Tập Luyện */}
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

          <form onSubmit={handleSaveTrainingPlan} className="space-y-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Tiêu đề giáo án *
              </label>
              <input
                type="text"
                required
                value={planTitle}
                onChange={(e) => setPlanTitle(e.target.value)}
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
                className="w-full bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900"
              />
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
              </div>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Nội dung bài tập chi tiết
              </label>
              <textarea
                rows={3}
                value={planContent}
                onChange={(e) => setPlanContent(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded p-2.5 text-slate-900"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingPlan}
                className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{savingPlan ? "Đang lưu..." : "Lưu Giáo Án Tập Luyện"}</span>
              </button>
            </div>
          </form>

          {apiPlans.length > 0 && (
            <div className="pt-3 border-t border-slate-200 space-y-2">
              {apiPlans.slice(0, 5).map((p) => (
                <div
                  key={p.planId || p.id}
                  className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs"
                >
                  <div className="font-bold text-slate-900">
                    {p.title} &bull; {formatPlanTargetLabel(p)}
                  </div>
                  <div className="text-slate-600 mt-0.5">{p.goal}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form 2: Ghi Nhận Kết Quả Buổi Tập (P0.2: Completed only, P0.6: Read-only attendance status) */}
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
                        {s.sessionDate} ({String(s.startTime || "").slice(0, 5)}) —{" "}
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
                  <span>
                    {readOnlyAttendanceStatus === "Late"
                      ? t("coachStatusLate")
                      : readOnlyAttendanceStatus === "Excused"
                        ? t("coachStatusExcused")
                        : readOnlyAttendanceStatus === "Absent"
                          ? t("coachStatusAbsent")
                          : t("coachStatusPresent")}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 uppercase">
                    Chỉ đọc
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
                className="w-full bg-slate-50 border border-slate-300 rounded p-2.5 text-slate-900"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingResult || (apiEnabled && completedSessions.length === 0)}
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
              {apiResults.slice(0, 5).map((r) => {
                const memberLabel =
                  r.memberName ||
                  availableStudents.find((s) => String(s.id) === String(r.memberId))
                    ?.name ||
                  (r.memberId ? `Học viên #${r.memberId}` : "Học viên")
                const sessionLabel =
                  r.className ||
                  (r.sessionId ? `Buổi #${r.sessionId}` : "Buổi tập")
                return (
                  <div
                    key={r.resultId || r.id}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-900">
                        {memberLabel} &bull; {sessionLabel}
                      </div>
                      <div className="text-slate-600 mt-0.5">{r.content}</div>
                    </div>
                    <span className="font-mono text-[10px] text-emerald-800 font-bold">
                      {r.attendanceStatus === "Late"
                        ? t("coachStatusLate")
                        : r.attendanceStatus === "Absent"
                          ? t("coachStatusAbsent")
                          : t("coachStatusPresent")}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
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
            {evaluations.slice(0, 6).map((ev) => {
              const rawEvScore = Number(ev.progressScore ?? 0)
              const normEvScore = rawEvScore > 10 ? rawEvScore / 10 : rawEvScore
              const evMemberLabel =
                ev.memberName ||
                availableStudents.find((s) => String(s.id) === String(ev.memberId))
                  ?.name ||
                (ev.memberId ? `Học viên #${ev.memberId}` : "Học viên")
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
                    <div className="text-slate-600 mt-0.5">{ev.comment}</div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-bold text-emerald-800">
                      Điểm: {Number(normEvScore).toFixed(1)}/10
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {ev.evaluationDate}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
