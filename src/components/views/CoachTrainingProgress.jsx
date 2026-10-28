import React, { useState, useEffect, useCallback } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { evaluationApi } from "../../api/evaluationApi"
import { getErrorMessage } from "../../api/apiErrors"
import { Activity, Save, Award } from "lucide-react"

export function CoachTrainingProgress() {
  const {
    trainingPlans,
    members,
    currentUser,
    updateTrainingPlan,
    apiEnabled,
    showToast,
    t,
    language,
  } = useSCMS()
  const plan = trainingPlans[0]

  const [selectedMemberId, setSelectedMemberId] = useState("")
  const [comment, setComment] = useState(plan?.resultNotes || "")
  const [progressScore, setProgressScore] = useState(
    plan?.progressPercent || 80,
  )
  const [evaluations, setEvaluations] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!selectedMemberId && members.length > 0) {
      setSelectedMemberId(String(members[0].id))
    }
  }, [members, selectedMemberId])

  const parseNumericId = (rawId, fallback = 1) => {
    const match = String(rawId || "").match(/(\d+)$/)
    const parsed = match ? Number(match[1]) : Number(rawId)
    return !Number.isNaN(parsed) && parsed > 0 ? parsed : fallback
  }

  const loadEvaluations = useCallback(async () => {
    if (!apiEnabled) return
    try {
      const list = await evaluationApi.getEvaluations()
      setEvaluations(Array.isArray(list) ? list : [])
    } catch {
      // ignore
    }
  }, [apiEnabled])

  useEffect(() => {
    loadEvaluations()
  }, [loadEvaluations])

  const handleSaveEvaluation = async () => {
    setSaving(true)
    try {
      const newPercent = Math.min(
        100,
        Number(progressScore) || (plan?.progressPercent || 65) + 5,
      )
      if (apiEnabled) {
        const memberIdNum = parseNumericId(
          selectedMemberId || plan?.memberId,
          1,
        )
        const coachIdNum = parseNumericId(currentUser?.id || plan?.coachId, 1)
        await evaluationApi.createEvaluation({
          memberId: memberIdNum,
          coachId: coachIdNum,
          progressScore: newPercent,
          comment: comment || "Hoàn thành tốt giáo án tập luyện.",
        })
        await loadEvaluations()
      }
      if (plan) {
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
              Lập kế hoạch, theo dõi bài tập &amp; đánh giá kết quả học viên PT
            </p>
          </div>
        </div>

        {members.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">
              Học viên đánh giá:
            </span>
            <select
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.code})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {plan && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <span className="text-[10px] text-blue-800 font-mono font-bold uppercase">
                HỌC VIÊN PHÂN CÔNG
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                {members.find((m) => String(m.id) === String(selectedMemberId))
                  ?.name || plan.memberName}
              </h3>
              <p className="text-xs text-slate-500">
                Coach chính: {currentUser?.name || plan.coachName}
              </p>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-600 font-bold mb-1 font-mono tabular-nums">
                Tiến độ: {progressScore}%
              </div>
              <div className="w-48 bg-slate-100 h-2 rounded overflow-hidden border border-slate-200">
                <div
                  style={{ width: `${progressScore}%` }}
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
              {language === "vi" ? plan.goalVi : plan.goal}
            </p>
          </div>

          {/* Exercise Table */}
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
                      {language === "vi" ? "Mức tạ" : "Weight Load"}
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
                      <td className="py-2 px-3 font-mono tabular-nums text-blue-800 font-semibold">
                        {ex.weight || "Trọng lượng cơ thể"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Coach Result Comments & Progress Score */}
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Ghi nhận kết quả &amp; Nhận xét của Coach (/api/evaluations)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">
                  Điểm tiến độ (0-100):
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={progressScore}
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

      {evaluations.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-700" />
              <span>Lịch Sử Đánh Giá Học Viên ({evaluations.length})</span>
            </h3>
          </div>
          <div className="space-y-2">
            {evaluations.slice(0, 6).map((ev) => (
              <div
                key={ev.id || `${ev.memberId}-${ev.evaluationDate}`}
                className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900">
                    {ev.memberName || `Học viên #${ev.memberId}`} &bull; HLV:{" "}
                    {ev.coachName || currentUser?.name}
                  </div>
                  <div className="text-slate-600 mt-0.5">{ev.comment}</div>
                </div>
                <div className="text-right font-mono">
                  <div className="font-bold text-emerald-800">
                    Điểm: {ev.progressScore ?? "—"}/100
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {ev.evaluationDate}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
