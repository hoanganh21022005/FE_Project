import React, { useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { formatDate } from '../../locales/translations';
import { StatusBadge } from '../common/Badge';
import { NewMemberModal } from '../modals/NewMemberModal';
import { PaymentModal } from '../modals/PaymentModal';
import {
  UserCheck,
  UserPlus,
  CreditCard,
  Search,
  ChevronRight,
  SearchX,
  Users,
  Clock,
  PackagePlus,
  AlertTriangle,
  Sparkles
} from 'lucide-react';

export function MemberManagement({ onSelectMemberDetail }) {
  const { members, packages, t, language } = useSCMS();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [selectedMemberForPay, setSelectedMemberForPay] = useState('');

  // Quick stats
  const totalCount = members.length;
  const activeCount = members.filter(m => m.membershipStatus === 'active').length;
  const graceCount = members.filter(m => m.membershipStatus === 'grace_period').length;
  const noPackageCount = members.filter(m => m.membershipStatus === 'none').length;

  const filteredMembers = members.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          m.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          m.phone.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || m.membershipStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getPackageName = (member) => {
    const pkg = packages.find(item => item.id === member.currentPackageId);
    if (pkg) return language === 'vi' ? pkg.nameVi : pkg.name;
    return language === 'vi' ? 'Chưa đăng ký gói' : 'No Package';
  };

  return (
    <div className="space-y-5">
      {/* 1. Quick Stats KPI Bar for Flow 1 Management */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Members */}
        <div
          onClick={() => setStatusFilter('all')}
          className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-stone-900 text-white border-stone-800 shadow-sm'
              : 'bg-white text-stone-800 border-slate-200 hover:border-stone-400'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className={statusFilter === 'all' ? 'text-stone-300' : 'text-slate-500'}>
              {language === 'vi' ? 'Tổng số hội viên' : 'Total Members'}
            </span>
            <Users className={`w-4 h-4 ${statusFilter === 'all' ? 'text-amber-400' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2 text-2xl font-black tabular-nums tracking-tight">{totalCount}</div>
        </div>

        {/* Active Members */}
        <div
          onClick={() => setStatusFilter('active')}
          className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
            statusFilter === 'active'
              ? 'bg-emerald-900 text-white border-emerald-800 shadow-sm'
              : 'bg-white text-stone-800 border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className={statusFilter === 'active' ? 'text-emerald-200' : 'text-slate-500'}>
              {language === 'vi' ? 'Đang hoạt động' : 'Active'}
            </span>
            <UserCheck className={`w-4 h-4 ${statusFilter === 'active' ? 'text-emerald-300' : 'text-emerald-600'}`} />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-600 tabular-nums tracking-tight">
            {activeCount}
          </div>
        </div>

        {/* 72h Grace Period */}
        <div
          onClick={() => setStatusFilter('grace_period')}
          className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
            statusFilter === 'grace_period'
              ? 'bg-orange-950 text-white border-orange-800 shadow-sm'
              : 'bg-white text-stone-800 border-slate-200 hover:border-orange-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className={statusFilter === 'grace_period' ? 'text-orange-200' : 'text-slate-500'}>
              {language === 'vi' ? 'Chờ gia hạn (72h)' : '72h Grace Period'}
            </span>
            <Clock className={`w-4 h-4 ${statusFilter === 'grace_period' ? 'text-orange-300' : 'text-orange-600'}`} />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-orange-600 tabular-nums tracking-tight">
              {graceCount}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200">
              {language === 'vi' ? 'Cần nhắc' : 'Alert'}
            </span>
          </div>
        </div>

        {/* No Package */}
        <div
          onClick={() => setStatusFilter('none')}
          className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
            statusFilter === 'none'
              ? 'bg-amber-950 text-white border-amber-800 shadow-sm'
              : 'bg-white text-stone-800 border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className={statusFilter === 'none' ? 'text-amber-200' : 'text-slate-500'}>
              {language === 'vi' ? 'Chưa đăng ký gói' : 'No Package'}
            </span>
            <Sparkles className={`w-4 h-4 ${statusFilter === 'none' ? 'text-amber-300' : 'text-amber-600'}`} />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-600 tabular-nums tracking-tight">
              {noPackageCount}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
              {language === 'vi' ? 'Chờ kích hoạt' : 'New Leads'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Top Header & Actions Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-lg shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-stone-900 text-amber-400 rounded-lg flex items-center justify-center shrink-0 shadow-xs">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-stone-900 tracking-tight">{t('members')}</h2>
            <p className="text-xs text-stone-500">
              {language === 'vi' ? 'Danh sách hồ sơ thành viên, gói đăng ký và kiểm soát trạng thái hội viên' : 'Member profiles, packages and membership status control'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {/* Status Filter Dropdown */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-stone-50 border border-slate-300 rounded px-3 py-1.5 text-xs text-stone-900 focus:outline-none focus:border-orange-600 focus:bg-white font-medium cursor-pointer"
          >
            <option value="all">{language === 'vi' ? 'Tất cả trạng thái' : 'All statuses'}</option>
            <option value="active">{t('active')}</option>
            <option value="grace_period">{t('grace_period')}</option>
            <option value="pending_payment">{t('pending_payment')}</option>
            <option value="expired">{t('expired')}</option>
            <option value="none">{language === 'vi' ? 'Chưa đăng ký gói' : 'No package'}</option>
          </select>

          {/* Search Input */}
          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('search') + "..."}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-stone-50 border border-slate-300 rounded pl-8 pr-3 py-1.5 text-xs text-stone-900 placeholder-slate-400 focus:outline-none focus:border-orange-600 focus:bg-white transition-colors"
            />
          </div>

          {/* Add Member Button */}
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs whitespace-nowrap transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{t('addMember')}</span>
          </button>
        </div>
      </div>

      {/* 3. Member Data Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-stone-50 text-stone-700 uppercase tracking-wider border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3 px-4">{language === 'vi' ? 'Mã và họ tên' : 'Code and name'}</th>
                <th className="py-3 px-4">{language === 'vi' ? 'Liên hệ' : 'Contact'}</th>
                <th className="py-3 px-4">{language === 'vi' ? 'Gói hiện tại' : 'Current package'}</th>
                <th className="py-3 px-4">{language === 'vi' ? 'Huấn luyện viên phụ trách' : 'Assigned coach'}</th>
                <th className="py-3 px-4">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                <th className="py-3 px-4">{language === 'vi' ? 'Ngày tham gia' : 'Join date'}</th>
                <th className="py-3 px-4 text-right w-[230px]">{language === 'vi' ? 'Thao tác' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredMembers.map(m => (
                <tr key={m.id} className="hover:bg-amber-50/20 transition-colors h-[42px]">
                  <td className="py-2 px-4 font-bold text-slate-900">
                    <div>{m.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono tabular-nums">{m.code}</div>
                  </td>
                  <td className="py-2 px-4">
                    <div>{m.email}</div>
                    <div className="text-[11px] text-slate-500 tabular-nums">{m.phone}</div>
                  </td>
                  <td className="py-2 px-4 text-slate-900 font-medium">
                    {m.membershipStatus === 'none' ? (
                      <span className="italic text-stone-400 text-xs">{language === 'vi' ? 'Chưa đăng ký gói' : 'No package'}</span>
                    ) : (
                      getPackageName(m)
                    )}
                  </td>
                  <td className="py-2 px-4 text-slate-700">
                    {m.primaryCoachName || (language === 'vi' ? 'Chưa phân công' : 'Unassigned')}
                  </td>
                  <td className="py-2 px-4">
                    <StatusBadge type="membership" status={m.membershipStatus} />
                  </td>
                  <td className="py-2 px-4 tabular-nums text-slate-500 whitespace-nowrap">
                    {formatDate(m.joinDate, language)}
                  </td>
                  <td className="py-2 px-4 text-right w-[230px]">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Action for unassigned package */}
                      {m.membershipStatus === 'none' && (
                        <button
                          onClick={() => onSelectMemberDetail && onSelectMemberDetail(m.id)}
                          className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded text-[11px] font-bold transition-all inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                          title={language === 'vi' ? 'Đăng ký gói tập' : 'Enroll Package'}
                        >
                          <PackagePlus className="w-3 h-3 text-amber-700" />
                          <span>{language === 'vi' ? 'Đăng ký gói' : 'Enroll'}</span>
                        </button>
                      )}

                      {/* Action for payment required */}
                      {(m.membershipStatus === 'pending_payment' || m.membershipStatus === 'grace_period' || m.membershipStatus === 'expired') && (
                        <button
                          onClick={() => { setSelectedMemberForPay(m.id); setIsPayOpen(true); }}
                          className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-[11px] font-bold transition-all inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>{language === 'vi' ? 'Thanh toán' : 'Pay'}</span>
                        </button>
                      )}

                      {/* Detail View Button */}
                      <button
                        onClick={() => onSelectMemberDetail && onSelectMemberDetail(m.id)}
                        className="px-2.5 py-1 bg-white hover:bg-stone-50 hover:border-orange-500 hover:text-orange-700 text-stone-800 border border-slate-300 rounded text-[11px] font-semibold transition-all inline-flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <span>{language === 'vi' ? 'Chi tiết' : 'Details'}</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredMembers.length === 0 && (
                <tr>
                  <td colSpan="7" className="py-12 px-4 text-center">
                    <SearchX className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="mt-3 text-sm font-bold text-slate-800">
                      {language === 'vi' ? 'Không tìm thấy thành viên phù hợp' : 'No matching members found'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {language === 'vi' ? 'Thử thay đổi từ khóa hoặc bộ lọc trạng thái.' : 'Try another keyword or status filter.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
                      className="mt-3 px-3 py-1.5 border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      {language === 'vi' ? 'Xóa bộ lọc' : 'Clear filters'}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        <div className="flex items-center justify-between text-xs text-slate-500 p-3 border-t border-slate-200 bg-slate-50">
          <span>
            {language === 'vi'
              ? `Hiển thị 1-${filteredMembers.length} của ${filteredMembers.length} hội viên`
              : `Showing 1-${filteredMembers.length} of ${filteredMembers.length} members`}
          </span>
          <div className="flex items-center gap-1 text-[11px] tabular-nums">
            <button disabled className="px-2 py-1 bg-white border border-slate-200 rounded opacity-50 cursor-not-allowed">
              {language === 'vi' ? 'Trang trước' : 'Previous'}
            </button>
            <span className="px-2.5 py-1 bg-slate-900 text-white rounded font-bold">1</span>
            <button disabled className="px-2 py-1 bg-white border border-slate-200 rounded opacity-50 cursor-not-allowed">
              {language === 'vi' ? 'Trang sau' : 'Next'}
            </button>
          </div>
        </div>
      </div>

      <NewMemberModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onCreated={(member) => onSelectMemberDetail?.(member.id)}
      />
      <PaymentModal isOpen={isPayOpen} onClose={() => setIsPayOpen(false)} preselectedMemberId={selectedMemberForPay} />
    </div>
  );
}
