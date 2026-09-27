import React from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { formatDate } from '../../locales/translations';
import { StatusBadge } from '../common/Badge';
import { Award, ShieldCheck, Clock, Calendar, CreditCard, User, AlertTriangle } from 'lucide-react';

export function MyMembershipView() {
  const { currentUser, members, packages, payments, t, language } = useSCMS();

  const member = members.find(m => m.id === currentUser.id) || members[0];
  const pkg = packages.find(p => p.id === member.currentPackageId);
  const myPayments = payments.filter(p => p.memberId === member.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-800 rounded border border-blue-200">
            <Award className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 whitespace-nowrap">{t('myMembership')}</h2>
            <p className="text-xs text-slate-500 whitespace-nowrap">
              {language === 'vi' ? 'Thông tin gói hội viên, thời hạn sử dụng, HLV phụ trách & lịch sử đóng phí' : 'Membership package details, validity period, coach and billing history'}
            </p>
          </div>
        </div>

        <StatusBadge type="membership" status={member.membershipStatus} />
      </div>

      {/* Package Privilege Details */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-6">
        <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              GÓI DỊCH VỤ HIỆN TẠI
            </span>
            <h3 className="text-xl font-extrabold text-slate-900 mt-1">{member.currentPackageName || 'Chưa đăng ký gói'}</h3>
            <p className="text-xs text-slate-500 mt-1">Mã hội viên: <strong className="font-mono text-slate-900">{member.code}</strong></p>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-500">Thời hạn sử dụng gói</div>
            <div className="text-sm font-bold font-mono text-slate-900 tabular-nums mt-0.5">
              {member.joinDate} &rarr; 31/12/2026
            </div>
          </div>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Quyền Lợi Lớp Học Group</span>
            </div>
            <p className="text-slate-600">Tham gia không giới hạn các lớp Gym, Yoga, Pilates &amp; Group Fitness.</p>
          </div>

          <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <User className="w-4 h-4 text-blue-600" />
              <span>HLV Cá Nhân (PT)</span>
            </div>
            <p className="text-slate-600">HLV Phụ trách: <strong>{member.primaryCoachName || 'Lê Thị Mai'}</strong></p>
          </div>

          <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-1">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Trạng Thái Grace Period</span>
            </div>
            <p className="text-slate-600">Thời gian gia hạn tự động: <strong>72 Giờ</strong> kể từ khi gia hạn.</p>
          </div>
        </div>

        {/* Status Timeline */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Tiến Trình Trạng Thái Membership (Timeline)</h4>
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
              <span className="font-bold text-slate-900">1. Đã đăng ký &amp; Kích hoạt gói thành công</span>
            </div>
            <span className="font-mono text-slate-500 tabular-nums">{member.joinDate}</span>
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-slate-700 shrink-0" />
          <span className="whitespace-nowrap">{language === 'vi' ? 'Lịch Sử Đóng Phí Membership' : 'Membership Payment History'}</span>
        </h3>

        {myPayments.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">{t('noData')}</div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Mã GD</th>
                  <th className="py-2.5 px-3">Gói Dịch Vụ</th>
                  <th className="py-2.5 px-3 text-right">Số Tiền (VND)</th>
                  <th className="py-2.5 px-3">Phương Thức</th>
                  <th className="py-2.5 px-3">Thời Gian</th>
                  <th className="py-2.5 px-3 text-center">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {myPayments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 h-[36px]">
                    <td className="py-2 px-3 font-mono font-bold text-slate-900">{p.code}</td>
                    <td className="py-2 px-3 font-semibold">{p.packageName}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {p.amount.toLocaleString()} ₫
                    </td>
                    <td className="py-2 px-3 uppercase text-[11px] font-mono">{p.method}</td>
                    <td className="py-2 px-3 font-mono text-slate-500 tabular-nums">{p.createdAt}</td>
                    <td className="py-2 px-3 text-center">
                      <StatusBadge type="payment" status={p.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
