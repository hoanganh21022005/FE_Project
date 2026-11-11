import React, { useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { formatDate } from '../../locales/translations';
import { StatusBadge } from '../common/Badge';
import { NewMemberModal } from '../modals/NewMemberModal';
import {
  UserCheck,
  UserPlus,
  Search,
  ChevronRight,
  SearchX,
  Users,
  Clock,
  PackagePlus,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

function getMemberInitials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0].charAt(0).toLocaleUpperCase();
  const last = words.length > 1 ? words[words.length - 1].charAt(0).toLocaleUpperCase() : '';
  return `${first}${last}`;
}

export function MemberManagement({ onSelectMemberDetail }) {
  const {
    members,
    membersLoading,
    membersError,
    fetchMembers,
    packages,
    t,
    language,
    apiEnabled
  } = useSCMS();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Quick stats: Count by membership package lifecycle only (account status is separate)
  const totalCount = members.length;
  const activeCount = members.filter(m => m.membershipStatus === 'active').length;
  const graceCount = members.filter(m => m.membershipStatus === 'grace_period').length;
  const noPackageCount = members.filter(m => !m.membershipStatus || m.membershipStatus === 'none' || !m.currentPackageId).length;
  const memberMetricsReady = !membersLoading && !membersError;
  const activeRatio = totalCount > 0 ? Math.round((activeCount / totalCount) * 100) : 0;

  const filteredMembers = members.filter(m => {
    const nameMatch = (m.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const emailMatch = (m.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const phoneMatch = String(m.phone || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSearch = nameMatch || emailMatch || phoneMatch;

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'none'
        ? (!m.membershipStatus || m.membershipStatus === 'none' || !m.currentPackageId)
        : m.membershipStatus === statusFilter);

    return matchesSearch && matchesStatus;
  });

  const getPackageName = (member) => {
    if (!member.currentPackageId) {
      return language === 'vi' ? 'Chưa đăng ký gói' : 'No Package';
    }
    const pkg = packages.find(item => item.id === member.currentPackageId);
    if (pkg) return language === 'vi' ? pkg.nameVi : pkg.name;
    return member.currentPackageName || (language === 'vi' ? 'Chưa đăng ký gói' : 'No Package');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-violet-100 p-2.5 text-violet-700">
          <Users className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {language === 'vi' ? 'Thành viên' : t('members')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {language === 'vi'
              ? 'Quản lý hồ sơ, gói tập và trạng thái hội viên của trung tâm.'
              : 'Manage member profiles, memberships and account status.'}
          </p>
        </div>
      </div>

      {/* 1. Quick Stats KPI Bar */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {/* Total Members */}
        <button
          type="button"
          aria-pressed={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
          className={`w-full rounded-xl border bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-300 ${
            statusFilter === 'all' ? 'border-brand-primary ring-1 ring-brand-primary/20' : 'border-slate-200'
          }`}
        >
          <div className="mb-2 flex items-start justify-between gap-2 text-xs font-medium text-slate-500">
            <span>{language === 'vi' ? 'Tổng hội viên' : 'Total members'}</span>
            <span className="rounded-lg bg-blue-50 p-2 text-blue-700"><Users className="h-4 w-4" aria-hidden="true" /></span>
          </div>
          <div className="text-2xl font-semibold tracking-tight text-blue-800 tabular-nums">{memberMetricsReady ? totalCount : '—'}</div>
          <p className="mt-1 text-xs text-slate-500">{language === 'vi' ? 'Tất cả hồ sơ hội viên' : 'All member profiles'}</p>
        </button>

        {/* Active Members */}
        <button
          type="button"
          aria-pressed={statusFilter === 'active'}
          onClick={() => setStatusFilter('active')}
          className={`w-full rounded-xl border bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-300 ${
            statusFilter === 'active' ? 'border-brand-primary ring-1 ring-brand-primary/20' : 'border-slate-200'
          }`}
        >
          <div className="mb-2 flex items-start justify-between gap-2 text-xs font-medium text-slate-500">
            <span>
              {language === 'vi' ? 'Đang hoạt động' : 'Active'}
            </span>
            <span className="rounded-lg bg-emerald-50 p-2 text-emerald-700"><UserCheck className="h-4 w-4" aria-hidden="true" /></span>
          </div>
          <div className="text-2xl font-semibold tracking-tight text-emerald-800 tabular-nums">
            {memberMetricsReady ? activeCount : '—'}
          </div>
          <p className="mt-1 text-xs text-slate-500">{language === 'vi' ? 'Gói hội viên đang hoạt động' : 'Active memberships'}</p>
          {memberMetricsReady && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-emerald-100" aria-label={`${activeRatio}% active`}>
              <div className="h-full rounded-full bg-emerald-600 transition-[width]" style={{ width: `${activeRatio}%` }} />
            </div>
          )}
        </button>

        {/* 72h Grace Period */}
        <button
          type="button"
          aria-pressed={statusFilter === 'grace_period'}
          onClick={() => setStatusFilter('grace_period')}
          className={`w-full rounded-xl border bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-300 ${
            statusFilter === 'grace_period' ? 'border-brand-primary ring-1 ring-brand-primary/20' : 'border-slate-200'
          }`}
        >
          <div className="mb-2 flex items-start justify-between gap-2 text-xs font-medium text-slate-500">
            <span>
              {language === 'vi' ? 'Chờ gia hạn (72h)' : '72h Grace Period'}
            </span>
            <span className="rounded-lg bg-amber-50 p-2 text-amber-700"><Clock className="h-4 w-4" aria-hidden="true" /></span>
          </div>
          <div className="text-2xl font-semibold tracking-tight text-amber-800 tabular-nums">
            {memberMetricsReady ? graceCount : '—'}
          </div>
          <p className="mt-1 text-xs text-slate-500">{language === 'vi' ? 'Đang trong thời gian gia hạn' : 'Within grace period'}</p>
        </button>

        {/* No Package */}
        <button
          type="button"
          aria-pressed={statusFilter === 'none'}
          onClick={() => setStatusFilter('none')}
          className={`w-full rounded-xl border bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-300 ${
            statusFilter === 'none' ? 'border-brand-primary ring-1 ring-brand-primary/20' : 'border-slate-200'
          }`}
        >
          <div className="mb-2 flex items-start justify-between gap-2 text-xs font-medium text-slate-500">
            <span>
              {language === 'vi' ? 'Chưa đăng ký gói' : 'No Package'}
            </span>
            <span className="rounded-lg bg-orange-50 p-2 text-orange-700"><PackagePlus className="h-4 w-4" aria-hidden="true" /></span>
          </div>
          <div className="text-2xl font-semibold tracking-tight text-orange-800 tabular-nums">
            {memberMetricsReady ? noPackageCount : '—'}
          </div>
          <p className="mt-1 text-xs text-slate-500">{language === 'vi' ? 'Chưa có gói hội viên' : 'No active package'}</p>
        </button>
      </div>

      {/* Error state with retry */}
      {membersError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              {language === 'vi'
                ? `Không thể tải dữ liệu hội viên từ hệ thống: ${membersError}`
                : `Failed to load member data from system: ${membersError}`}
            </span>
          </div>
          <button
            onClick={() => fetchMembers()}
            className="px-3 py-1 bg-white border border-rose-300 text-rose-700 rounded text-xs font-bold hover:bg-rose-100 transition-colors flex items-center gap-1 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Thử lại' : 'Retry'}</span>
          </button>
        </div>
      )}

      {/* Member filters and actions */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder={language === 'vi' ? 'Tìm theo tên, email hoặc số điện thoại...' : 'Search by name, email or phone...'}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              aria-label={language === 'vi' ? 'Tìm thành viên' : 'Search members'}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            aria-label={language === 'vi' ? 'Lọc theo trạng thái gói' : 'Filter by membership status'}
            className="h-10 w-full shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 cursor-pointer sm:w-52"
          >
            <option value="all">{language === 'vi' ? 'Tất cả trạng thái' : 'All statuses'}</option>
            <option value="active">{t('active')}</option>
            <option value="grace_period">{t('grace_period')}</option>
            <option value="pending_payment">{t('pending_payment')}</option>
            <option value="expired">{t('expired')}</option>
            <option value="none">{language === 'vi' ? 'Chưa đăng ký gói' : 'No package'}</option>
          </select>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-primary px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-primary-hover sm:w-auto"
          >
            <UserPlus className="h-4 w-4" />
            <span>{t('addMember')}</span>
          </button>
        </div>
      </div>
      {/* Member Data Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[18%]" />
              <col className="w-[19%]" />
              <col className="w-[15%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
              <col className="w-[11%]" />
            </colgroup>
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr className="[&>th]:border-r [&>th]:border-slate-200 [&>th:last-child]:border-r-0">
                <th scope="col" className="px-3 py-3 text-center">STT</th>
                <th scope="col" className="px-4 py-3">{language === 'vi' ? 'Họ và tên' : 'Name'}</th>
                <th scope="col" className="px-4 py-3">{language === 'vi' ? 'Liên hệ' : 'Contact'}</th>
                <th scope="col" className="px-4 py-3">{language === 'vi' ? 'Gói hiện tại' : 'Current package'}</th>
                <th scope="col" className="px-4 py-3">{language === 'vi' ? 'Huấn luyện viên' : 'Coach'}</th>
                <th scope="col" className="px-4 py-3">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                <th scope="col" className="px-3 py-3">{language === 'vi' ? 'Ngày tham gia' : 'Joined'}</th>
                <th scope="col" className="px-3 py-3 text-center">{language === 'vi' ? 'Thao tác' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 [&>tr>td]:border-r [&>tr>td]:border-slate-100 [&>tr>td:last-child]:border-r-0 [&>tr:not(:last-child)]:border-b [&>tr:not(:last-child)]:border-slate-200">
              {membersLoading ? (
                [...Array(5)].map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-3 py-4"><div className="mx-auto h-4 w-5 rounded bg-slate-200" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-32 rounded bg-slate-200" /><div className="mt-2 h-3 w-20 rounded bg-slate-100" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-36 rounded bg-slate-200" /><div className="mt-2 h-3 w-24 rounded bg-slate-100" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-24 rounded bg-slate-200" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-24 rounded bg-slate-200" /></td>
                    <td className="px-4 py-4"><div className="h-5 w-20 rounded bg-slate-200" /></td>
                    <td className="px-3 py-4"><div className="h-4 w-16 rounded bg-slate-200" /></td>
                    <td className="px-3 py-4"><div className="mx-auto h-8 w-16 rounded bg-slate-200" /></td>
                  </tr>
                ))
              ) : filteredMembers.map((m, index) => (
                <tr key={m.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-3 py-4 text-center text-xs tabular-nums text-slate-500">{index + 1}</td>
                  <td className="px-4 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700" aria-hidden="true">
                        {getMemberInitials(m.name)}
                      </span>
                      <span className="truncate font-semibold text-slate-900" title={m.name || ''}>{m.name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="truncate text-slate-800" title={m.email || ''}>{m.email || '—'}</div>
                    <div className="mt-1 text-xs tabular-nums text-slate-500">{m.phone || '—'}</div>
                  </td>
                  <td className="px-4 py-4 font-medium text-slate-800">
                    {m.membershipStatus === 'none' || !m.currentPackageId ? (
                      <span className="text-slate-400">{language === 'vi' ? 'Chưa đăng ký gói' : 'No package'}</span>
                    ) : <span className="line-clamp-2">{getPackageName(m)}</span>}
                  </td>
                  <td className="px-4 py-4 text-slate-700">{m.primaryCoachName || (language === 'vi' ? 'Chưa phân công' : 'Unassigned')}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge type="membership" status={m.membershipStatus || 'none'} />
                      {m.accountStatus && m.accountStatus !== 'active' && (
                        <span className="text-xs font-medium text-rose-700">
                          {m.accountStatus === 'locked' ? (language === 'vi' ? 'Khóa TK' : 'Locked') : m.accountStatus}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-xs tabular-nums text-slate-600">{formatDate(m.joinDate, language)}</td>
                  <td className="px-3 py-4 text-center">
                    <button
                      type="button"
                      onClick={() => onSelectMemberDetail?.(m.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-brand-primary hover:text-brand-primary"
                    >
                      <span>{language === 'vi' ? 'Chi tiết' : 'Details'}</span>
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}

              {!membersLoading && filteredMembers.length === 0 && (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center">
                    <SearchX className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
                    <p className="mt-3 text-sm font-semibold text-slate-800">
                      {language === 'vi' ? 'Không tìm thấy thành viên phù hợp' : 'No matching members found'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {language === 'vi' ? 'Thử thay đổi từ khóa hoặc bộ lọc trạng thái.' : 'Try another keyword or status filter.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
                      className="mt-3 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {language === 'vi' ? 'Xóa bộ lọc' : 'Clear filters'}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NewMemberModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onCreated={(member) => {
          if (member?.id) {
            onSelectMemberDetail?.(member.id);
          }
        }}
      />
    </div>
  );
}
