import React from "react"
import { useSCMS } from "../../context/SCMSContext"
import { parsePlan } from "../../utils/trainingPlan"
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react"

export function PlanBuilder({
  exercises = [],
  onExercisesChange,
  notes = "",
  onNotesChange,
}) {
  const { t } = useSCMS()

  const handleAddRow = () => {
    if (!onExercisesChange) return
    onExercisesChange([
      ...exercises,
      { name: "", sets: 3, reps: "10-12", load: "" },
    ])
  }

  const handleUpdateRow = (index, field, value) => {
    if (!onExercisesChange) return
    const next = exercises.map((ex, i) =>
      i === index ? { ...ex, [field]: value } : ex,
    )
    onExercisesChange(next)
  }

  const handleRemoveRow = (index) => {
    if (!onExercisesChange) return
    onExercisesChange(exercises.filter((_, i) => i !== index))
  }

  const handleMoveRow = (index, direction) => {
    if (!onExercisesChange) return
    const targetIdx = index + direction
    if (targetIdx < 0 || targetIdx >= exercises.length) return
    const next = [...exercises]
    const temp = next[index]
    next[index] = next[targetIdx]
    next[targetIdx] = temp
    onExercisesChange(next)
  }

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-700">
          Danh sách bài tập có cấu trúc ({exercises.length})
        </span>
        <button
          type="button"
          onClick={handleAddRow}
          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded font-bold text-slate-800 flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t("coachPlanBuilderAddRow")}</span>
        </button>
      </div>

      {exercises.length > 0 && (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs min-w-[560px]">
            <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="p-2">{t("coachPlanBuilderExName")} *</th>
                <th className="p-2 w-20">{t("coachPlanBuilderSets")}</th>
                <th className="p-2 w-32">{t("coachPlanBuilderReps")}</th>
                <th className="p-2 w-40">{t("coachPlanBuilderLoad")}</th>
                <th className="p-2 w-24 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {exercises.map((ex, idx) => (
                <tr key={idx} className="bg-white">
                  <td className="p-1.5">
                    <input
                      type="text"
                      value={ex.name}
                      onChange={(e) =>
                        handleUpdateRow(idx, "name", e.target.value)
                      }
                      placeholder="VD: Footwork 4 góc sân / Back Squat"
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900 font-semibold"
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={ex.sets}
                      onChange={(e) =>
                        handleUpdateRow(idx, "sets", e.target.value)
                      }
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono text-slate-900"
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      type="text"
                      value={ex.reps}
                      onChange={(e) =>
                        handleUpdateRow(idx, "reps", e.target.value)
                      }
                      placeholder="12 reps / 15 phút"
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 font-mono text-slate-900"
                    />
                  </td>
                  <td className="p-1.5">
                    <input
                      type="text"
                      value={ex.load}
                      onChange={(e) =>
                        handleUpdateRow(idx, "load", e.target.value)
                      }
                      placeholder="Tốc độ cao / 40kg"
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-900"
                    />
                  </td>
                  <td className="p-1.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        aria-label={t("coachPlanBuilderMoveUp")}
                        onClick={() => handleMoveRow(idx, -1)}
                        className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === exercises.length - 1}
                        aria-label={t("coachPlanBuilderMoveDown")}
                        onClick={() => handleMoveRow(idx, 1)}
                        className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={t("coachPlanBuilderRemove")}
                        onClick={() => handleRemoveRow(idx)}
                        className="p-1 text-rose-600 hover:text-rose-800 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <label className="font-bold text-slate-700 block mb-1">
          {t("coachPlanBuilderGeneralNotes")}
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => onNotesChange && onNotesChange(e.target.value)}
          placeholder="Nhập hướng dẫn chung, lưu ý khởi động hoặc lộ trình theo tuần..."
          className="w-full bg-slate-50 border border-slate-300 rounded p-2.5 text-slate-900"
        />
      </div>
    </div>
  )
}

export function PlanContentView({ content }) {
  const { t } = useSCMS()
  const parsed = parsePlan(content)

  if (!parsed.structured) {
    if (!parsed.notes) return null
    return (
      <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
        {parsed.notes}
      </p>
    )
  }

  return (
    <div className="space-y-2.5">
      {parsed.exercises.length > 0 && (
        <div className="overflow-x-auto border border-slate-200 rounded">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="py-2 px-3">{t("coachPlanBuilderExName")}</th>
                <th className="py-2 px-3">{t("coachPlanBuilderSets")}</th>
                <th className="py-2 px-3">{t("coachPlanBuilderReps")}</th>
                <th className="py-2 px-3">{t("coachPlanBuilderLoad")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {parsed.exercises.map((ex, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-bold text-slate-900">
                    {ex.name}
                  </td>
                  <td className="py-2 px-3 font-mono">{ex.sets}</td>
                  <td className="py-2 px-3 font-mono">{ex.reps}</td>
                  <td className="py-2 px-3 font-mono text-slate-700">
                    {ex.load || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {parsed.notes && (
        <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-200">
          {parsed.notes}
        </p>
      )}
    </div>
  )
}
