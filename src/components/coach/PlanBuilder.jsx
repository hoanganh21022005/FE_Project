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
    <div className="space-y-3 text-sm leading-5 font-normal text-text-primary">
      <div className="flex items-center justify-between">
        <span className="text-xs leading-4 font-medium text-text-secondary">
          Danh sách bài tập có cấu trúc ({exercises.length})
        </span>
        <button
          type="button"
          onClick={handleAddRow}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded px-3 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t("coachPlanBuilderAddRow")}</span>
        </button>
      </div>

      {exercises.length > 0 && (
        <div className="w-full overflow-x-auto rounded-lg border border-border-color bg-bg-card">
          <table className="w-full min-w-full text-left text-sm">
            <thead className="bg-bg-secondary text-xs font-semibold text-text-secondary">
              <tr>
                <th className="px-3 py-2 text-left align-middle">{t("coachPlanBuilderExName")} *</th>
                <th className="px-3 py-2 text-left align-middle w-20">{t("coachPlanBuilderSets")}</th>
                <th className="px-3 py-2 text-left align-middle w-32">{t("coachPlanBuilderReps")}</th>
                <th className="px-3 py-2 text-left align-middle w-36">{t("coachPlanBuilderLoad")}</th>
                <th className="px-3 py-2 text-right align-middle w-28">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {exercises.map((ex, idx) => (
                <tr key={idx} className="transition-colors hover:bg-bg-secondary/70">
                  <td className="px-3 py-2 align-middle text-xs leading-5 text-text-primary">
                    <input
                      type="text"
                      value={ex.name}
                      onChange={(e) =>
                        handleUpdateRow(idx, "name", e.target.value)
                      }
                      placeholder="VD: Footwork 4 góc sân / Back Squat"
                      className="h-8 w-full rounded border border-border-color bg-bg-card px-2.5 py-1 text-xs text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
                    />
                  </td>
                  <td className="px-3 py-2 align-middle text-xs leading-5 text-text-primary">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={ex.sets}
                      onChange={(e) =>
                        handleUpdateRow(idx, "sets", e.target.value)
                      }
                      className="h-8 w-full rounded border border-border-color bg-bg-card px-2.5 py-1 text-xs text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted font-mono"
                    />
                  </td>
                  <td className="px-3 py-2 align-middle text-xs leading-5 text-text-primary">
                    <input
                      type="text"
                      value={ex.reps}
                      onChange={(e) =>
                        handleUpdateRow(idx, "reps", e.target.value)
                      }
                      placeholder="12 reps / 15 phút"
                      className="h-8 w-full rounded border border-border-color bg-bg-card px-2.5 py-1 text-xs text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted font-mono"
                    />
                  </td>
                  <td className="px-3 py-2 align-middle text-xs leading-5 text-text-primary">
                    <input
                      type="text"
                      value={ex.load}
                      onChange={(e) =>
                        handleUpdateRow(idx, "load", e.target.value)
                      }
                      placeholder="Tốc độ cao / 40kg"
                      className="h-8 w-full rounded border border-border-color bg-bg-card px-2.5 py-1 text-xs text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
                    />
                  </td>
                  <td className="px-3 py-2 align-middle text-xs leading-5 text-text-primary text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        aria-label={t("coachPlanBuilderMoveUp")}
                        onClick={() => handleMoveRow(idx, -1)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === exercises.length - 1}
                        aria-label={t("coachPlanBuilderMoveDown")}
                        onClick={() => handleMoveRow(idx, 1)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={t("coachPlanBuilderRemove")}
                        onClick={() => handleRemoveRow(idx)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded text-status-danger transition-colors hover:bg-bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
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
        <label className="text-xs leading-4 font-medium text-text-secondary block mb-1">
          {t("coachPlanBuilderGeneralNotes")}
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => onNotesChange && onNotesChange(e.target.value)}
          placeholder="Nhập hướng dẫn chung, lưu ý khởi động hoặc lộ trình theo tuần..."
          className="w-full rounded border border-border-color bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
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
      <p className="text-sm leading-5 font-normal text-text-primary whitespace-pre-line">
        {parsed.notes}
      </p>
    )
  }

  return (
    <div className="space-y-2.5">
      {parsed.exercises.length > 0 && (
        <div className="w-full overflow-x-auto rounded-lg border border-border-color bg-bg-card">
          <table className="w-full min-w-full text-left text-sm">
            <thead className="bg-bg-secondary text-xs font-semibold text-text-secondary">
              <tr>
                <th className="px-3 py-2 text-left align-middle">{t("coachPlanBuilderExName")}</th>
                <th className="px-3 py-2 text-left align-middle">{t("coachPlanBuilderSets")}</th>
                <th className="px-3 py-2 text-left align-middle">{t("coachPlanBuilderReps")}</th>
                <th className="px-3 py-2 text-left align-middle">{t("coachPlanBuilderLoad")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {parsed.exercises.map((ex, i) => (
                <tr key={i} className="transition-colors hover:bg-bg-secondary/70">
                  <td className="px-3 py-2 align-middle text-sm leading-5 text-text-primary font-semibold">
                    {ex.name}
                  </td>
                  <td className="px-3 py-2 align-middle text-sm leading-5 text-text-primary font-mono">{ex.sets}</td>
                  <td className="px-3 py-2 align-middle text-sm leading-5 text-text-primary font-mono">{ex.reps}</td>
                  <td className="px-3 py-2 align-middle text-sm leading-5 text-text-primary font-mono">
                    {ex.load || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {parsed.notes && (
        <p className="text-sm leading-5 text-text-secondary whitespace-pre-line bg-bg-secondary p-3 rounded border border-border-color">
          {parsed.notes}
        </p>
      )}
    </div>
  )
}
