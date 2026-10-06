import React from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { StatusBadge } from '../common/Badge';
import { Users, Target, Calendar, Dumbbell, Award, PlusCircle } from 'lucide-react';

export function CoachAssignedMembersView() {
  const { members, trainingPlans, t, language } = useSCMS();

  // Filter members assigned to PT/Coach
  const assignedMembers = members.filter(m => m.primaryCoachId || m.primaryCoachName);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 whitespace-nowrap">{t('assignedMembers')}</h2>
            <p className="text-xs text-slate-500 whitespace-nowrap">
              {language === 'vi' ? 'Danh sách học viên Personal Training (PT) được phân công trực tiếp' : 'Directly assigned Personal Training (PT) students'}
            </p>
          </div>
        </div>

        <div className="text-xs font-mono font-bold bg-slate-100 border border-slate-200 px-3 py-1.5 rounded text-slate-900">
          Tổng số: {assignedMembers.length} Học viên
        </div>
      </div>

      {/* Member Cards Grid / List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {assignedMembers.map(m => {
          const plan = trainingPlans.find(p => p.memberId === m.id);

          return (
            <div key={m.id} className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4 hover:border-slate-300 transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900">{m.name}</div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums">{m.code} &bull; {m.phone}</div>
                </div>
                <StatusBadge type="membership" status={m.membershipStatus} />
              </div>

              <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-700">
                  <span className="flex items-center gap-1 font-bold">
                    <Award className="w-3.5 h-3.5 text-amber-600" />
                    <span>Gói Membership:</span>
                  </span>
                  <span className="font-semibold text-slate-900">{m.currentPackageName}</span>
                </div>

                <div className="flex items-center justify-between text-slate-700">
                  <span className="flex items-center gap-1 font-bold">
                    <Target className="w-3.5 h-3.5 text-blue-600" />
                    <span>Mục tiêu PT:</span>
                  </span>
                  <span className="font-medium text-slate-900">{plan ? (language === 'vi' ? plan.goalVi : plan.goal) : 'Tăng cơ, giảm mỡ & nâng thể lực'}</span>
                </div>
              </div>

              {plan && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                    <span>Tiến độ kế hoạch:</span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">{plan.progressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded overflow-hidden border border-slate-200">
                    <div style={{ width: `${plan.progressPercent}%` }} className="bg-slate-900 h-full rounded" />
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-mono">Tham gia: {m.joinDate}</span>
                <button className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold shadow-xs flex items-center gap-1 whitespace-nowrap">
                  <Dumbbell className="w-3.5 h-3.5 shrink-0" />
                  <span>{language === 'vi' ? 'Xem kế hoạch tập luyện' : 'View Training Plan'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
