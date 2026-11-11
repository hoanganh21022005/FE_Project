import React, { useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { NewStaffModal } from '../modals/NewStaffModal';
import { EditStaffModal } from '../modals/EditStaffModal';
import { isValidNumericId } from '../../api/schemaValidators';
import {
  Users,
  Lock,
  Unlock,
  UserPlus,
  Phone,
  Mail,
  SearchX,
  ShieldCheck,
  Dumbbell,
  UserCheck,
  Shield,
  Edit2,
  RefreshCw,
  AlertTriangle,
  Search,
} from 'lucide-react';

export function StaffManagement() {
  const {
    staff,
    staffLoading,
    staffError,
    fetchStaff,
    updateStaffStatus,
    currentUser,
    apiEnabled,
    t,
    language,
  } = useSCMS();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  // Quick stats calculation
  const totalStaff = staff.length;
  const coachCount = staff.filter(s => s.role === 'coach').length;
  const receptionistCount = staff.filter(s => s.role === 'receptionist').length;
  const activeCount = staff.filter(s => s.status === 'active').length;

  const filteredStaff = staff.filter(s => {
    const nameMatch = (s.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const emailMatch = (s.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSearch = nameMatch || emailMatch;
    const matchesRole = roleFilter === 'all' || s.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleStatusChange = (staffMember) => {
    const nextStatus = staffMember.status === 'active' ? 'locked' : 'active';
    const message = language === 'vi'
      ? `Bạn có chắc muốn ${nextStatus === 'active' ? 'mở khóa' : 'tạm khóa'} tài khoản ${staffMember.name}?`
      : `Are you sure you want to ${nextStatus === 'active' ? 'unlock' : 'lock'} ${staffMember.name}'s account?`;
    if (window.confirm(message)) {
      updateStaffStatus(staffMember.id, nextStatus, message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {/* Card 1: Total Staff */}
        <button
          type="button"
          onClick={() => setRoleFilter('all')}
          className={`w-full bg-white border rounded-xl p-4 text-left transition-colors shadow-sm hover:border-slate-300 ${
            roleFilter === 'all' ? 'border-brand-primary ring-1 ring-brand-primary/20' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2 font-medium">
            <span>{language === 'vi' ? 'Tổng nhân sự' : 'Total Staff'}</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{totalStaff}</div>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'vi' ? 'Bao gồm toàn bộ nhân viên' : 'All staff members'}
          </p>
        </button>

        {/* Card 2: Coaches */}
        <button
          type="button"
          onClick={() => setRoleFilter('coach')}
          className={`w-full bg-white border rounded-xl p-4 text-left transition-colors shadow-sm hover:border-slate-300 ${
            roleFilter === 'coach' ? 'border-brand-primary ring-1 ring-brand-primary/20' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2 font-medium">
            <span>{language === 'vi' ? 'Huấn luyện viên' : 'Coaches'}</span>
            <Dumbbell className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{coachCount}</div>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'vi' ? 'Phụ trách lớp & tập luyện' : 'Assigned to classes & training'}
          </p>
        </button>

        {/* Card 3: Receptionists */}
        <button
          type="button"
          onClick={() => setRoleFilter('receptionist')}
          className={`w-full bg-white border rounded-xl p-4 text-left transition-colors shadow-sm hover:border-slate-300 ${
            roleFilter === 'receptionist' ? 'border-brand-primary ring-1 ring-brand-primary/20' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2 font-medium">
            <span>{language === 'vi' ? 'Nhân viên lễ tân' : 'Receptionists'}</span>
            <UserCheck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{receptionistCount}</div>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'vi' ? 'Tiếp đón & ghi nhận thanh toán' : 'Check-in & payment processing'}
          </p>
        </button>

        {/* Card 4: Active Accounts */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2 font-medium">
            <span>{language === 'vi' ? 'Đang hoạt động' : 'Active Accounts'}</span>
            <Shield className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {activeCount} / {totalStaff}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'vi' ? `${totalStaff - activeCount} tài khoản tạm khóa` : `${totalStaff - activeCount} inactive`}
          </p>
        </div>
      </div>

      {/* Error state with retry */}
      {staffError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              {language === 'vi'
                ? `Không thể tải dữ liệu nhân sự từ hệ thống: ${staffError}`
                : `Failed to load staff data from system: ${staffError}`}
            </span>
          </div>
          <button
            onClick={() => fetchStaff()}
            className="h-9 px-3 bg-white border border-rose-300 text-rose-700 rounded-lg text-sm font-semibold hover:bg-rose-100 transition-colors flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Thử lại' : 'Retry'}</span>
          </button>
        </div>
      )}

      {/* Staff filters and actions */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder={language === 'vi' ? 'Tìm theo tên hoặc email...' : 'Search by name or email...'}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              aria-label={language === 'vi' ? 'Tìm nhân viên' : 'Search staff'}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10"
            />
          </div>

          {/* Role Filter Dropdown */}
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            aria-label={language === 'vi' ? 'Lọc theo vai trò' : 'Filter by role'}
            className="h-10 w-full shrink-0 bg-white border border-slate-300 rounded-lg px-3 text-sm text-slate-700 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 cursor-pointer sm:w-48"
          >
            <option value="all">{language === 'vi' ? 'Tất cả vai trò' : 'All Roles'}</option>
            <option value="manager">{language === 'vi' ? 'Quản lý' : 'Manager'}</option>
            <option value="coach">{language === 'vi' ? 'Huấn luyện viên' : 'Coach'}</option>
            <option value="receptionist">{language === 'vi' ? 'Lễ tân' : 'Receptionist'}</option>
          </select>

          <button
            onClick={() => setIsAddOpen(true)}
            disabled={apiEnabled && !currentUser?.authorities?.includes('MANAGE_USERS')}
            title={apiEnabled && !currentUser?.authorities?.includes('MANAGE_USERS') ? (language === 'vi' ? 'Cần quyền quản lý người dùng' : 'User management permission required') : undefined}
            className="h-10 shrink-0 px-3.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap transition-colors cursor-pointer w-full sm:w-auto disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{t('addStaff')}</span>
          </button>
        </div>
      </div>

      {/* Staff Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide border-b border-slate-200 font-semibold text-[11px]">
              <tr>
                <th className="py-3 px-4">{language === 'vi' ? 'Mã và họ tên' : 'Code and name'}</th>
                <th className="py-3 px-4">{language === 'vi' ? 'Vai trò' : 'Role'}</th>
                <th className="py-3 px-4">{language === 'vi' ? 'Chuyên môn' : 'Specialization'}</th>
                <th className="py-3 px-4">{language === 'vi' ? 'Liên hệ' : 'Contact'}</th>
                <th className="py-3 px-4">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                <th className="py-3 px-4 text-right">{language === 'vi' ? 'Thao tác' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {staffLoading ? (
                [...Array(4)].map((_, idx) => (
                  <tr key={idx} className="animate-pulse h-[62px]">
                    <td className="py-3 px-5"><div className="h-4 bg-slate-200 rounded w-32 mb-2" /><div className="h-3 bg-slate-100 rounded w-20" /></td>
                    <td className="py-3 px-5"><div className="h-6 bg-slate-100 rounded-full w-24" /></td>
                    <td className="py-3 px-5"><div className="h-4 bg-slate-100 rounded w-32" /></td>
                    <td className="py-3 px-5"><div className="h-4 bg-slate-100 rounded w-40 mb-2" /><div className="h-3 bg-slate-100 rounded w-24" /></td>
                    <td className="py-3 px-5"><div className="h-6 bg-slate-100 rounded-full w-20" /></td>
                    <td className="py-3 px-5 text-right"><div className="h-8 bg-slate-100 rounded-lg w-24 ml-auto" /></td>
                  </tr>
                ))
              ) : (
                filteredStaff.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-slate-900">{s.name}</div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${
                        s.role === 'manager' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                        s.role === 'coach' ? 'bg-sky-50 text-sky-700 border-sky-100' :
                        'bg-stone-50 text-stone-700 border-stone-200'
                      }`}>
                        {t(s.role === 'manager' ? 'roleManager' : s.role === 'coach' ? 'roleCoach' : 'roleReceptionist')}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-800">
                      <div>
                        {s.specialization || s.specialty || (language === 'vi' ? 'Bộ phận vận hành' : 'Operations')}
                      </div>
                      {s.activeClassesCount ? (
                        <div className="text-xs text-slate-500 font-medium mt-1">
                          {s.activeClassesCount} {language === 'vi' ? 'lớp đang dạy' : 'active classes'}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{s.email || '—'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500 text-xs tabular-nums mt-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{s.phone || '—'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${
                        s.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${s.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {language === 'vi'
                          ? (s.status === 'active' ? 'Hoạt động' : 'Tạm khóa')
                          : (s.status === 'active' ? 'Active' : 'Locked')}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit Staff Button */}
                        <button
                          onClick={() => setEditingStaff(s)}
                          disabled={apiEnabled && !isValidNumericId(s.userId)}
                          title={apiEnabled && !isValidNumericId(s.userId) ? (language === 'vi' ? 'Không xác minh được mã người dùng; hãy tải lại danh sách nhân viên.' : 'User ID is not verified; reload the staff list.') : undefined}
                          className="h-8 px-2.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-brand-primary border border-slate-300 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 shadow-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>{language === 'vi' ? 'Sửa' : 'Edit'}</span>
                        </button>

                        {/* Status Toggle */}
                        {s.id === currentUser?.id ? (
                          <span className="px-2 py-1 text-stone-400 text-xs font-medium inline-flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            <span>{language === 'vi' ? 'Tôi' : 'Self'}</span>
                          </span>
                        ) : s.status === 'active' ? (
                          <button
                            onClick={() => handleStatusChange(s)}
                            className="h-8 px-2.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Lock className="w-3 h-3" />
                            <span>{language === 'vi' ? 'Khóa' : 'Lock'}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatusChange(s)}
                            className="h-8 px-2.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Unlock className="w-3 h-3" />
                            <span>{language === 'vi' ? 'Mở' : 'Unlock'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}

              {!staffLoading && filteredStaff.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-12 px-4 text-center">
                    <SearchX className="w-8 h-8 text-stone-300 mx-auto" />
                    <p className="mt-3 text-sm font-bold text-stone-800">
                      {language === 'vi' ? 'Không tìm thấy nhân viên' : 'No matching staff found'}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      {language === 'vi' ? 'Kiểm tra lại tên hoặc email.' : 'Check the name or email.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => { setSearchTerm(''); setRoleFilter('all'); }}
                      className="mt-3 px-3 py-1.5 border border-slate-300 rounded text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      {language === 'vi' ? 'Xóa bộ lọc' : 'Clear filters'}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-5 py-3 text-xs text-slate-500">
          <span>{language === 'vi' ? `Hiển thị ${filteredStaff.length} nhân viên` : `Showing ${filteredStaff.length} staff members`}</span>
        </div>
      </div>

      <NewStaffModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
      {editingStaff && (
        <EditStaffModal
          isOpen={Boolean(editingStaff)}
          onClose={() => setEditingStaff(null)}
          staffMember={editingStaff}
          onUpdated={(updated) => { if (updated) setEditingStaff(updated); }}
        />
      )}
    </div>
  );
}
