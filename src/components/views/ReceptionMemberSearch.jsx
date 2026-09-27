import React, { useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { StatusBadge } from '../common/Badge';
import { NewMemberModal } from '../modals/NewMemberModal';
import { Search, UserCheck, Filter, Phone, Mail, Calendar, UserPlus, CreditCard, Award } from 'lucide-react';

export function ReceptionMemberSearch() {
  const { members, packages, t, language } = useSCMS();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isNewMemberOpen, setIsNewMemberOpen] = useState(false);

  const filteredMembers = members.filter(m => {
    const matchesTerm = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.phone.includes(searchTerm) ||
      m.code.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || m.membershipStatus === statusFilter;

    return matchesTerm && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-800 rounded border border-blue-200">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 whitespace-nowrap">{t('memberSearch')}</h2>
            <p className="text-xs text-slate-500 whitespace-nowrap">
              {language === 'vi' ? 'Tra cứu chi tiết hồ sơ hội viên, kiểm tra thời hạn gói & thông tin liên hệ' : 'Look up member profile details, package expiry and contact information'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsNewMemberOpen(true)}
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold shadow-xs flex items-center gap-1.5"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Tạo Thành Viên Mới</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Nhập tên, số điện thoại, email hoặc mã hội viên..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
            >
              <option value="all">Tất cả trạng thái (All Statuses)</option>
              <option value="active">Hoạt động (Active)</option>
              <option value="grace_period">Grace Period (72h)</option>
              <option value="pending_payment">Chờ thanh toán (Pending)</option>
              <option value="expired">Đã hết hạn (Expired)</option>
            </select>
          </div>
        </div>

        {/* Search Results List */}
        <div className="space-y-3 pt-2">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">{t('noData')}</div>
          ) : (
            filteredMembers.map(m => (
              <div key={m.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-slate-300 transition-all">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-900">{m.name}</span>
                    <StatusBadge type="membership" status={m.membershipStatus} />
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <span className="font-mono font-bold text-slate-900 tabular-nums">Mã: {m.code}</span>
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> {m.phone}</span>
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" /> {m.email}</span>
                  </div>

                  <div className="text-xs text-slate-500 flex items-center gap-2 pt-0.5">
                    <Award className="w-3.5 h-3.5 text-amber-600" />
                    <span>Gói: <strong>{m.currentPackageName || 'Chưa có gói'}</strong></span>
                    <span>&bull; Ngày gia nhập: <span className="font-mono tabular-nums">{m.joinDate}</span></span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold shadow-xs">
                    Xem Chi Tiết Hồ Sơ
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <NewMemberModal isOpen={isNewMemberOpen} onClose={() => setIsNewMemberOpen(false)} />
    </div>
  );
}
