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
  AlertTriangle
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
  const managerCount = staff.filter(s => s.role === 'manager').length;
  const activeCount = staff.filter(s => s.status === 'active').length;

  const filteredStaff = staff.filter(s => {
    const nameMatch = (s.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const emailMatch = (s.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const codeMatch = (s.code || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSearch = nameMatch || emailMatch || codeMatch;
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
      {/* 4-Card Quick KPI Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Staff */}
        <div
          onClick={() => setRoleFilter('all')}
          className={`bg-white border rounded-lg p-4 cursor-pointer transition-all shadow-2xs hover:border-brand-accent ${
            roleFilter === 'all' ? 'border-brand-primary ring-1 ring-brand-primary/20' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-stone-500 text-xs mb-1 font-medium">
            <span>{language === 'vi' ? 'Tổng nhân sự' : 'Total Staff'}</span>
            <Users className="w-4 h-4 text-stone-400" />
          </div>
          <div className="text-2xl font-bold text-brand-dark tabular-nums">{totalStaff}</div>
          <p className="text-xs text-stone-500 mt-1">
            {language === 'vi' ? 'Bao gồm toàn bộ nhân viên' : 'All staff members'}
          </p>
        </div>

        {/* Card 2: Coaches */}
        <div
          onClick={() => setRoleFilter('coach')}
          className={`bg-white border rounded-lg p-4 cursor-pointer transition-all shadow-2xs hover:border-brand-accent ${
            roleFilter === 'coach' ? 'border-brand-primary ring-1 ring-brand-primary/20' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-stone-500 text-xs mb-1 font-medium">
            <span>{language === 'vi' ? 'Huấn luyện viên' : 'Coaches'}</span>
            <Dumbbell className="w-4 h-4 text-brand-primary" />
          </div>
          <div className="text-2xl font-bold text-brand-dark tabular-nums">{coachCount}</div>
          <p className="text-xs text-stone-500 mt-1">
            {language === 'vi' ? 'Phụ trách lớp & tập luyện' : 'Assigned to classes & training'}
          </p>
        </div>

        {/* Card 3: Receptionists */}
        <div
          onClick={() => setRoleFilter('receptionist')}
          className={`bg-white border rounded-lg p-4 cursor-pointer transition-all shadow-2xs hover:border-brand-accent ${
            roleFilter === 'receptionist' ? 'border-brand-primary ring-1 ring-brand-primary/20' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-stone-500 text-xs mb-1 font-medium">
            <span>{language === 'vi' ? 'Nhân viên lễ tân' : 'Receptionists'}</span>
            <UserCheck className="w-4 h-4 text-stone-700" />
          </div>
          <div className="text-2xl font-bold text-brand-dark tabular-nums">{receptionistCount}</div>
          <p className="text-xs text-stone-500 mt-1">
            {language === 'vi' ? 'Tiếp đón & ghi nhận thanh toán' : 'Check-in & payment processing'}
          </p>
        </div>

        {/* Card 4: Active Accounts */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-xs mb-1 font-medium">
            <span>{language === 'vi' ? 'Đang hoạt động' : 'Active Accounts'}</span>
            <Shield className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 tabular-nums">
            {activeCount} / {totalStaff}
          </div>
          <p className="text-xs text-stone-500 mt-1">
            {language === 'vi' ? `${totalStaff - activeCount} tài khoản tạm khóa` : `${totalStaff - activeCount} inactive`}
          </p>
        </div>
      </div>

      {/* Error state with retry */}
      {staffError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center justify-between">
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
            className="px-3 py-1 bg-white border border-rose-300 text-rose-700 rounded text-xs font-bold hover:bg-rose-100 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Thử lại' : 'Retry'}</span>
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-lg shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-dark text-brand-accent-dark rounded border border-brand-dark-hover">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-brand-dark tracking-tight">{t('staff')}</h2>
            <p className="text-xs text-stone-500">
              {language === 'vi' ? 'Quản lý danh sách, quyền hạn và trạng thái nhân viên, HLV' : 'Manage staff roster, permissions and coach statuses'}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          {/* Role Filter Dropdown */}
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="w-full sm:w-auto bg-stone-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-brand-dark focus:outline-none focus:border-brand-primary cursor-pointer"
          >
            <option value="all">{language === 'vi' ? 'Tất cả vai trò' : 'All Roles'}</option>
            <option value="manager">{language === 'vi' ? 'Quản lý' : 'Manager'}</option>
            <option value="coach">{language === 'vi' ? 'Huấn luyện viên' : 'Coach'}</option>
            <option value="receptionist">{language === 'vi' ? 'Lễ tân' : 'Receptionist'}</option>
          </select>

          <input
            type="text"
            placeholder={language === 'vi' ? 'Tìm theo tên, email, mã...' : 'Search by name, email or code...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-stone-50 border border-slate-300 rounded px-3 py-1.5 text-xs text-brand-dark placeholder-stone-400 focus:outline-none focus:border-brand-primary focus:bg-white w-full sm:w-56"
          />

          <button
            onClick={() => setIsAddOpen(true)}
            disabled={apiEnabled && !currentUser?.authorities?.includes('MANAGE_USERS')}
            title={apiEnabled && !currentUser?.authorities?.includes('MANAGE_USERS') ? (language === 'vi' ? 'Cần quyền quản lý người dùng' : 'User management permission required') : undefined}
            className="px-3.5 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs whitespace-nowrap transition-colors cursor-pointer w-full sm:w-auto"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{t('addStaff')}</span>
          </button>
        </div>
      </div>

      {/* Staff Data Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-brand-dark text-slate-200 uppercase tracking-wider border-b border-slate-200 font-bold text-xs">
              <tr>
                <th className="py-3 px-4">{language === 'vi' ? 'Mã và họ tên' : 'Code and name'}</th>
                <th className="py-3 px-4">{language === 'vi' ? 'Vai trò' : 'Role'}</th>
                <th className="py-3 px-4">{language === 'vi' ? 'Chuyên môn' : 'Specialization'}</th>
                <th className="py-3 px-4">{language === 'vi' ? 'Liên hệ' : 'Contact'}</th>
                <th className="py-3 px-4">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                <th className="py-3 px-4 text-right w-48">{language === 'vi' ? 'Thao tác' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {staffLoading ? (
                [...Array(4)].map((_, idx) => (
                  <tr key={idx} className="animate-pulse h-[46px]">
                    <td className="py-2.5 px-4"><div className="h-4 bg-slate-200 rounded w-28 mb-1" /><div className="h-3 bg-slate-100 rounded w-16" /></td>
                    <td className="py-2.5 px-4"><div className="h-5 bg-slate-200 rounded w-24" /></td>
                    <td className="py-2.5 px-4"><div className="h-4 bg-slate-200 rounded w-28" /></td>
                    <td className="py-2.5 px-4"><div className="h-4 bg-slate-200 rounded w-36 mb-1" /><div className="h-3 bg-slate-100 rounded w-20" /></td>
                    <td className="py-2.5 px-4"><div className="h-5 bg-slate-200 rounded w-20" /></td>
                    <td className="py-2.5 px-4 text-right"><div className="h-6 bg-slate-200 rounded w-24 ml-auto" /></td>
                  </tr>
                ))
              ) : (
                filteredStaff.map(s => (
                  <tr key={s.id} className="hover:bg-brand-blue-soft/50 transition-colors h-[42px]">
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-slate-900">{s.name}</div>
                      <div className="text-xs text-slate-500 font-mono tabular-nums">{s.code}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-flex items-center justify-center w-[130px] px-2 py-0.5 rounded text-xs font-bold uppercase border text-center whitespace-nowrap shrink-0 ${
                        s.role === 'manager' ? 'bg-brand-dark text-white border-brand-dark-hover' :
                        s.role === 'coach' ? 'bg-brand-blue-soft text-brand-primary border-brand-primary/30' :
                        'bg-stone-100 text-stone-800 border-stone-300'
                      }`}>
                        {t(s.role === 'manager' ? 'roleManager' : s.role === 'coach' ? 'roleCoach' : 'roleReceptionist')}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-800">
                      <div>
                        {s.specialization || s.specialty || (language === 'vi' ? 'Bộ phận vận hành' : 'Operations')}
                      </div>
                      {s.activeClassesCount ? (
                        <div className="text-xs text-brand-primary font-medium">
                          {s.activeClassesCount} {language === 'vi' ? 'lớp đang dạy' : 'active classes'}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5 text-slate-800">
                        <Mail className="w-3 h-3 text-stone-400" />
                        <span>{s.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-stone-500 text-xs tabular-nums mt-0.5">
                        <Phone className="w-3 h-3 text-stone-400" />
                        <span>{s.phone || '—'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`inline-flex items-center justify-center w-[110px] px-2 py-0.5 rounded text-xs font-bold border text-center whitespace-nowrap shrink-0 ${
                        s.status === 'active' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}>
                        {language === 'vi'
                          ? (s.status === 'active' ? 'Hoạt động' : 'Tạm khóa')
                          : (s.status === 'active' ? 'Active' : 'Locked')}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right w-48">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit Staff Button */}
                        <button
                          onClick={() => setEditingStaff(s)}
                          disabled={apiEnabled && !isValidNumericId(s.userId)}
                          title={apiEnabled && !isValidNumericId(s.userId) ? (language === 'vi' ? 'Không xác minh được mã người dùng; hãy tải lại danh sách nhân viên.' : 'User ID is not verified; reload the staff list.') : undefined}
                          className="px-2.5 py-1 bg-white hover:bg-stone-50 text-stone-700 hover:text-brand-primary border border-slate-300 hover:border-brand-accent rounded text-xs font-semibold transition-all inline-flex items-center gap-1 shadow-2xs cursor-pointer"
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
                            className="px-2 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded text-xs font-semibold transition-all inline-flex items-center gap-1 shadow-2xs hover:border-rose-400 cursor-pointer"
                          >
                            <Lock className="w-3 h-3" />
                            <span>{language === 'vi' ? 'Khóa' : 'Lock'}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStatusChange(s)}
                            className="px-2 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-xs font-semibold transition-all inline-flex items-center gap-1 shadow-2xs hover:border-emerald-400 cursor-pointer"
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
                      {language === 'vi' ? 'Kiểm tra lại tên, email hoặc mã nhân viên.' : 'Check the name, email or staff code.'}
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

        {/* Table Pagination Footer */}
        <div className="flex items-center justify-between text-xs text-stone-500 p-3 border-t border-slate-200 bg-slate-50">
          <span>
            {language === 'vi'
              ? `Hiển thị 1-${filteredStaff.length} của ${filteredStaff.length} nhân viên`
              : `Showing 1-${filteredStaff.length} of ${filteredStaff.length} staff`}
          </span>
          <div className="flex items-center gap-1 text-xs tabular-nums">
            <button disabled className="px-2 py-1 bg-white border border-slate-200 rounded opacity-50 cursor-not-allowed">
              {language === 'vi' ? 'Trang trước' : 'Previous'}
            </button>
            <span className="px-2.5 py-1 bg-brand-dark text-white rounded font-bold">1</span>
            <button disabled className="px-2 py-1 bg-white border border-slate-200 rounded opacity-50 cursor-not-allowed">
              {language === 'vi' ? 'Trang sau' : 'Next'}
            </button>
          </div>
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
