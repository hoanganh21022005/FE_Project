import React from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { Activity, Save } from 'lucide-react';

export function CoachTrainingProgress() {
  const { trainingPlans, updateTrainingPlan, t, language } = useSCMS();
  const plan = trainingPlans[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white border border-slate-200 p-4 rounded-lg shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 text-slate-800 rounded border border-slate-200">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">{t('trainingProgress')}</h2>
            <p className="text-xs text-slate-500">Lập kế hoạch, theo dõi bài tập &amp; đánh giá kết quả học viên PT</p>
          </div>
        </div>
      </div>

      {plan && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <span className="text-[10px] text-blue-800 font-mono font-bold uppercase">HỌC VIÊN PHÂN CÔNG</span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">{plan.memberName}</h3>
              <p className="text-xs text-slate-500">Coach chính: {plan.coachName}</p>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-600 font-bold mb-1 font-mono tabular-nums">Tiến độ: {plan.progressPercent}%</div>
              <div className="w-48 bg-slate-100 h-2 rounded overflow-hidden border border-slate-200">
                <div style={{ width: `${plan.progressPercent}%` }} className="bg-slate-900 h-full rounded" />
              </div>
            </div>
          </div>

          {/* Goal Section */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1 whitespace-nowrap">
              {language === 'vi' ? 'Mục tiêu tập luyện' : 'Training Goal'}
            </div>
            <p className="text-xs text-slate-800 font-medium">{language === 'vi' ? plan.goalVi : plan.goal}</p>
          </div>

          {/* Exercise Table */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 whitespace-nowrap">
              {language === 'vi' ? 'Danh sách bài tập thiết kế' : 'Assigned Exercise Routine'}
            </h4>
            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200 whitespace-nowrap">
                  <tr>
                    <th className="py-2.5 px-3">{language === 'vi' ? 'Tên bài tập' : 'Exercise Name'}</th>
                    <th className="py-2.5 px-3">{language === 'vi' ? 'Số Sets' : 'Sets'}</th>
                    <th className="py-2.5 px-3">{language === 'vi' ? 'Reps / Thời gian' : 'Reps / Duration'}</th>
                    <th className="py-2.5 px-3">{language === 'vi' ? 'Mức tạ' : 'Weight Load'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {plan.exercises.map((ex, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 h-[36px]">
                      <td className="py-2 px-3 font-bold text-slate-900">{ex.name}</td>
                      <td className="py-2 px-3 font-mono tabular-nums">{ex.sets}</td>
                      <td className="py-2 px-3 font-mono tabular-nums">{ex.reps}</td>
                      <td className="py-2 px-3 font-mono tabular-nums text-blue-800 font-semibold">{ex.weight || 'Trọng lượng cơ thể'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Coach Result Comments */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Ghi nhận kết quả &amp; Nhận xét của Coach
            </label>
            <textarea
              rows={3}
              defaultValue={plan.resultNotes}
              className="w-full bg-slate-50 border border-slate-300 rounded p-3 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
            <div className="flex justify-end pt-2">
              <button
                onClick={() => updateTrainingPlan({ id: plan.id, progressPercent: Math.min(100, plan.progressPercent + 5) })}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu Đánh Giá Tiến Độ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
