import React, { useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { formatDate, formatCurrency } from '../../locales/translations';
import { StatusBadge } from '../common/Badge';
import {
  ArrowLeft,
  User,
  Edit2,
  Package,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  PlusCircle,
  X
} from 'lucide-react';

export function MemberDetailView({ memberId, onBack }) {
  const { members, packages, updateMember, updateMemberProfile, addMemberPackage, t, language } = useSCMS();
  const [activeTab, setActiveTab] = useState('personal'); // 'personal' or 'membership'
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  const member = members.find(m => m.id === memberId);

  if (!member) {
    return (
      <div className="p-8 text-center bg-white border border-stone-200 rounded-lg">
        <p className="text-stone-500 text-sm">
          {language === 'vi' ? 'Không tìm thấy hồ sơ thành viên' : 'Member profile not found'}
        </p>
        <button
          onClick={onBack}
          className="mt-4 px-3.5 py-1.5 bg-stone-900 hover:bg-orange-600 text-white text-xs font-bold rounded transition-colors"
        >
          {language === 'vi' ? 'Quay lại danh sách' : 'Back to List'}
        </button>
      </div>
    );
  }

  // Derived current package info
  const pkg = packages.find(p => p.id === member.currentPackageId);

  const handleToggleAccountLock = () => {
    const isCurrentlyLocked = member.accountStatus === 'locked';
    const nextStatus = isCurrentlyLocked ? 'active' : 'locked';
    const promptMessage = language === 'vi'
      ? `Bạn có chắc chắn muốn ${isCurrentlyLocked ? 'MỞ KHÓA' : 'TẠM KHÓA'} tài khoản của ${member.name}?`
      : `Are you sure you want to ${isCurrentlyLocked ? 'UNLOCK' : 'LOCK'} ${member.name}'s account?`;

    if (window.confirm(promptMessage)) {
      updateMember(member.id, { accountStatus: nextStatus });
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all hover:border-orange-500"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-stone-500" />
          <span>{language === 'vi' ? 'Quay lại danh sách' : 'Back to list'}</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Lock / Unlock Quick Action */}
          <button
            onClick={handleToggleAccountLock}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs border transition-all ${
              member.accountStatus === 'locked'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
            }`}
          >
            <span>
              {member.accountStatus === 'locked'
                ? (language === 'vi' ? 'Mở khóa tài khoản' : 'Unlock Account')
                : (language === 'vi' ? 'Tạm khóa tài khoản' : 'Lock Account')}
            </span>
          </button>

          <button
            onClick={() => setIsEditOpen(true)}
            className="px-3.5 py-1.5 bg-stone-900 hover:bg-orange-600 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Chỉnh sửa hồ sơ' : 'Edit Profile'}</span>
          </button>
        </div>
      </div>

      {/* Member Header Profile Card */}
      <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-stone-900 text-amber-400 border border-stone-800 flex items-center justify-center text-xl font-bold shrink-0 shadow-xs">
            {member.name.charAt(0)}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-stone-900">{member.name}</h2>
              <span className="font-mono text-[10px] font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                {member.code}
              </span>
              {/* Account Status Badge (Active / Locked) */}
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                member.accountStatus === 'locked'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                {member.accountStatus === 'locked'
                  ? (language === 'vi' ? 'Tài khoản: Tạm khóa' : 'Account: Locked')
                  : (language === 'vi' ? 'Tài khoản: Hoạt động' : 'Account: Active')}
              </span>
              <StatusBadge type="membership" status={member.membershipStatus} />
            </div>
            <div className="flex items-center gap-4 text-xs text-stone-500 flex-wrap">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-stone-400" /> {member.email}
              </span>
              <span className="flex items-center gap-1 tabular-nums">
                <Phone className="w-3.5 h-3.5 text-stone-400" /> {member.phone}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Controls */}
      <div className="border-b border-stone-200 flex items-center gap-6">
        <button
          onClick={() => setActiveTab('personal')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'personal'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <User className="w-4 h-4" />
          <span>{language === 'vi' ? 'Thông tin cá nhân' : 'Personal Information'}</span>
        </button>

        <button
          onClick={() => setActiveTab('membership')}
          className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'membership'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>{language === 'vi' ? 'Gói đăng ký' : 'Membership Package'}</span>
        </button>
      </div>

      {/* TAB 1: Personal Information */}
      {activeTab === 'personal' && (
        <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs space-y-4">
          <h3 className="text-sm font-semibold text-stone-900 border-b border-stone-100 pb-3">
            {language === 'vi' ? 'Thông tin cá nhân' : 'Personal information'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="min-w-0 space-y-1 py-1">
              <span className="text-stone-500 text-[11px] font-medium">{language === 'vi' ? 'Họ và tên:' : 'Full Name:'}</span>
              <p className="font-bold text-stone-900">{member.name}</p>
            </div>

            <div className="min-w-0 space-y-1 py-1">
              <span className="text-stone-500 text-[11px] font-medium">{language === 'vi' ? 'Mã thành viên:' : 'Member Code:'}</span>
              <p className="font-bold font-mono text-stone-900">{member.code}</p>
            </div>

            <div className="min-w-0 space-y-1 py-1">
              <span className="text-stone-500 text-[11px] font-medium">Email:</span>
              <p className="font-bold text-stone-900">{member.email}</p>
            </div>

            <div className="min-w-0 space-y-1 py-1">
              <span className="text-stone-500 text-[11px] font-medium">{language === 'vi' ? 'Số điện thoại:' : 'Phone:'}</span>
              <p className="font-bold tabular-nums text-stone-900">{member.phone}</p>
            </div>

            <div className="min-w-0 space-y-1 py-1">
              <span className="text-stone-500 text-[11px] font-medium">{language === 'vi' ? 'Ngày sinh:' : 'Birth Date:'}</span>
              <p className="font-bold text-stone-900">
                {member.birthDate ? formatDate(member.birthDate, language) : (language === 'vi' ? 'Chưa cập nhật' : 'Not updated')}
              </p>
            </div>

            <div className="min-w-0 space-y-1 py-1">
              <span className="text-stone-500 text-[11px] font-medium">{language === 'vi' ? 'Địa chỉ liên hệ:' : 'Address:'}</span>
              <p className="font-bold text-stone-900">
                {member.address || (language === 'vi' ? 'Chưa cập nhật' : 'Not updated')}
              </p>
            </div>

            <div className="min-w-0 space-y-1 py-1">
              <span className="text-stone-500 text-[11px] font-medium">{language === 'vi' ? 'Ngày tham gia:' : 'Join Date:'}</span>
              <p className="font-bold tabular-nums text-stone-900">{formatDate(member.joinDate, language)}</p>
            </div>

            <div className="min-w-0 space-y-1 py-1">
              <span className="text-stone-500 text-[11px] font-medium">{language === 'vi' ? 'Huấn luyện viên phụ trách:' : 'Assigned Coach:'}</span>
              <p className="font-bold text-stone-900">
                {member.primaryCoachName || (language === 'vi' ? 'Chưa phân công' : 'Unassigned')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Membership Package */}
      {activeTab === 'membership' && (
        <div className="space-y-6">
          {member.currentPackageId ? (
            <div className="bg-white border border-stone-200 rounded-lg p-5 shadow-2xs space-y-5">
              {/* Package Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-stone-900">
                      {pkg ? (language === 'vi' ? pkg.nameVi : pkg.name) : member.currentPackageName}
                    </h3>
                    <StatusBadge type="membership" status={member.membershipStatus} />
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    {language === 'vi' ? 'Mã Membership:' : 'Membership ID:'} <strong className="font-mono text-stone-800">{`MS-${member.code}`}</strong>
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs text-stone-500">{language === 'vi' ? 'Giá đăng ký:' : 'Package Price:'}</span>
                  <p className="text-lg font-bold text-orange-600 tabular-nums">
                    {formatCurrency(pkg ? pkg.price : 0, language)}
                  </p>
                </div>
              </div>

              {/* Status Explanation Box */}
              {member.membershipStatus === 'pending_payment' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block">{language === 'vi' ? 'Gói đăng ký Chờ thanh toán' : 'Package Pending Payment'}</strong>
                    <span>
                      {language === 'vi'
                        ? 'Gói đăng ký chưa có hiệu lực. Quyền sử dụng dịch vụ chỉ được kích hoạt sau khi thanh toán thành công.'
                        : 'Package subscription is not yet active. Service benefits will activate upon successful payment.'}
                    </span>
                  </div>
                </div>
              )}

              {member.membershipStatus === 'grace_period' && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-950 text-xs flex items-start gap-2">
                  <Clock className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block text-orange-900">{language === 'vi' ? 'Trong thời gian chờ gia hạn (72h)' : 'In Grace Period (72h)'}</strong>
                    <span>
                      {language === 'vi'
                        ? `Thời gian cho phép gia hạn kéo dài đúng 72 giờ từ khi hết hạn hợp đồng (${member.gracePeriodExpiresAt || '2026-09-21 18:00'}). Quá thời gian này dịch vụ sẽ tạm ngưng.`
                        : `Grace period lasts strictly 72 hours from contract expiration (${member.gracePeriodExpiresAt || '2026-09-21 18:00'}).`}
                    </span>
                  </div>
                </div>
              )}

              {/* Package Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-stone-50 rounded border border-stone-200">
                  <span className="text-stone-500 text-[11px]">{language === 'vi' ? 'Thời hạn gói:' : 'Duration:'}</span>
                  <p className="font-bold text-stone-900 mt-1">
                    {pkg ? `${pkg.durationMonths} ${language === 'vi' ? 'tháng' : 'months'}` : '1 tháng'}
                  </p>
                </div>

                <div className="p-3 bg-stone-50 rounded border border-stone-200">
                  <span className="text-stone-500 text-[11px]">{language === 'vi' ? 'Ngày bắt đầu hiệu lực:' : 'Effective Start Date:'}</span>
                  <p className="font-bold text-stone-900 mt-1 tabular-nums">
                    {member.membershipStatus === 'pending_payment'
                      ? (language === 'vi' ? 'Chưa kích hoạt' : 'Not activated')
                      : formatDate(member.joinDate, language)}
                  </p>
                </div>

                <div className="p-3 bg-stone-50 rounded border border-stone-200">
                  <span className="text-stone-500 text-[11px]">{language === 'vi' ? 'Ngày hết hạn hợp đồng:' : 'Contract Expiry Date:'}</span>
                  <p className="font-bold text-stone-900 mt-1 tabular-nums">
                    {member.membershipStatus === 'pending_payment'
                      ? (language === 'vi' ? 'Chưa kích hoạt' : 'Not activated')
                      : formatDate('2026-12-31', language)}
                  </p>
                </div>
              </div>

              {/* Benefits Checklist */}
              {pkg && pkg.benefitsVi && (
                <div className="space-y-2 pt-2 border-t border-stone-100">
                  <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                    {language === 'vi' ? 'Quyền lợi gói được hưởng' : 'Included Package Benefits'}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {(language === 'vi' ? pkg.benefitsVi : pkg.benefits).map((b, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-stone-700">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Empty State: No Membership Package */
            <div className="bg-white border border-stone-200 rounded-lg p-8 text-center space-y-3 shadow-2xs">
              <Package className="w-10 h-10 text-stone-400 mx-auto" />
              <h4 className="text-sm font-bold text-stone-900">
                {language === 'vi' ? 'Thành viên chưa đăng ký gói' : 'Member has no active package'}
              </h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                {language === 'vi'
                  ? 'Thành viên này chưa có gói đăng ký nào. Bạn có thể chọn và đăng ký gói mới ngay để kích hoạt quyền lợi tập luyện.'
                  : 'This member does not have an assigned membership package. Select and register a package now to activate access.'}
              </p>
              <button
                onClick={() => setIsRegisterOpen(true)}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{language === 'vi' ? 'Đăng ký gói tập ngay' : 'Register Package Now'}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Edit Profile Modal */}
      {isEditOpen && <EditProfileModal
        key={member.id}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        member={member}
      />}

      {/* MODAL 2: Register Package Modal */}
      {isRegisterOpen && <RegisterPackageModal
        key={member.id}
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        member={member}
      />}
    </div>
  );
}

{/* Modal Component: Edit Profile */}
function EditProfileModal({ isOpen, onClose, member }) {
  const { members, updateMemberProfile, language } = useSCMS();
  const [formData, setFormData] = useState({
    name: member.name || '',
    email: member.email || '',
    phone: member.phone || '',
    birthDate: member.birthDate || '',
    address: member.address || ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = language === 'vi' ? 'Họ và tên là bắt buộc' : 'Name is required';

    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail) {
      errs.email = language === 'vi' ? 'Email là bắt buộc' : 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errs.email = language === 'vi' ? 'Email không hợp lệ' : 'Invalid email';
    } else if (members.some(m => m.id !== member.id && m.email.toLowerCase() === trimmedEmail.toLowerCase())) {
      errs.email = language === 'vi' ? 'Email đã tồn tại cho hội viên khác' : 'Email already used by another member';
    }

    if (!formData.phone.trim()) errs.phone = language === 'vi' ? 'SĐT là bắt buộc' : 'Phone is required';

    if (formData.birthDate) {
      const today = new Date().toISOString().split('T')[0];
      if (formData.birthDate > today) {
        errs.birthDate = language === 'vi' ? 'Ngày sinh không thể ở tương lai' : 'Birth date cannot be in future';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      updateMemberProfile(member.id, {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        birthDate: formData.birthDate,
        address: formData.address.trim()
      });
      setIsSubmitting(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
      <div className="bg-white border border-stone-200 rounded-lg shadow-xl w-full max-w-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <h3 className="text-sm font-bold text-stone-900">
            {language === 'vi' ? 'Chỉnh sửa hồ sơ thành viên' : 'Edit Member Profile'}
          </h3>
          <button onClick={onClose} aria-label="Close modal" className="text-stone-400 hover:text-stone-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              {language === 'vi' ? 'Họ và tên' : 'Full Name'} <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-1.5 focus:outline-none focus:border-orange-500"
            />
            {errors.name && <p className="text-rose-600 text-[11px] mt-0.5">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Email <span className="text-rose-600">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-1.5 focus:outline-none focus:border-orange-500"
              />
              {errors.email && <p className="text-rose-600 text-[11px] mt-0.5">{errors.email}</p>}
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                {language === 'vi' ? 'Số điện thoại' : 'Phone'} <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-1.5 focus:outline-none focus:border-orange-500"
              />
              {errors.phone && <p className="text-rose-600 text-[11px] mt-0.5">{errors.phone}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                {language === 'vi' ? 'Ngày sinh' : 'Birth Date'}
              </label>
              <input
                type="date"
                value={formData.birthDate}
                onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-1.5 focus:outline-none focus:border-orange-500"
              />
              {errors.birthDate && <p className="text-rose-600 text-[11px] mt-0.5">{errors.birthDate}</p>}
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                {language === 'vi' ? 'Địa chỉ' : 'Address'}
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-1.5 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3.5 py-1.5 bg-stone-100 text-stone-700 rounded font-bold hover:bg-stone-200 transition-colors">
              {language === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button type="submit" disabled={isSubmitting} className="px-3.5 py-1.5 bg-stone-900 hover:bg-orange-600 text-white rounded font-bold transition-colors">
              {isSubmitting ? (language === 'vi' ? 'Đang lưu…' : 'Saving...') : (language === 'vi' ? 'Lưu thay đổi' : 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

{/* Modal Component: Register Package */}
function RegisterPackageModal({ isOpen, onClose, member }) {
  const { packages, addMemberPackage, language } = useSCMS();
  const [selectedPkgId, setSelectedPkgId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const selectedPkg = packages.find(p => p.id === selectedPkgId);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedPkgId) return;

    setIsSubmitting(true);
    setTimeout(() => {
      addMemberPackage(member.id, selectedPkgId);
      setIsSubmitting(false);
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs">
      <div className="bg-white border border-stone-200 rounded-lg shadow-xl w-full max-w-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <h3 className="text-sm font-bold text-stone-900">
            {language === 'vi' ? 'Đăng ký gói thành viên mới' : 'Register Membership Package'}
          </h3>
          <button onClick={onClose} aria-label="Close modal" className="text-stone-400 hover:text-stone-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-stone-500 mb-1">{language === 'vi' ? 'Tên thành viên:' : 'Member Name:'}</label>
            <p className="font-bold text-stone-900 bg-stone-100 p-2 rounded border border-stone-200">{member.name}</p>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              {language === 'vi' ? 'Chọn gói dịch vụ' : 'Select Package'} <span className="text-rose-600">*</span>
            </label>
            <select
              value={selectedPkgId}
              onChange={e => setSelectedPkgId(e.target.value)}
              className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-1.5 focus:outline-none focus:border-orange-500"
            >
              <option value="">{language === 'vi' ? 'Chọn gói…' : 'Select package...'}</option>
              {packages.filter(p => p.status === 'active').map(p => (
                <option key={p.id} value={p.id}>
                  {language === 'vi' ? p.nameVi : p.name} ({formatCurrency(p.price, language)})
                </option>
              ))}
            </select>
          </div>

          {selectedPkg && (
            <div className="p-3 bg-stone-50 rounded border border-stone-200 space-y-2 animate-in fade-in duration-150">
              <div className="flex justify-between font-bold">
                <span>{language === 'vi' ? 'Giá đăng ký:' : 'Price:'}</span>
                <span className="text-orange-600">{formatCurrency(selectedPkg.price, language)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>{language === 'vi' ? 'Thời hạn:' : 'Duration:'}</span>
                <span>{selectedPkg.durationMonths} {language === 'vi' ? 'tháng' : 'months'}</span>
              </div>
              <p className="text-amber-800 text-[11px] bg-amber-50 p-2 rounded border border-amber-200 font-medium">
                {language === 'vi'
                  ? 'Gói mới sẽ có trạng thái Chờ thanh toán. Quyền lợi chỉ được kích hoạt sau khi ghi nhận thanh toán.'
                  : 'New package will be created in Pending Payment status.'}
              </p>
            </div>
          )}

          <div className="pt-3 border-t border-stone-200 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3.5 py-1.5 bg-stone-100 text-stone-700 rounded font-bold hover:bg-stone-200 transition-colors">
              {language === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={!selectedPkgId || isSubmitting}
              className="px-4 py-1.5 bg-stone-900 hover:bg-orange-600 text-white rounded font-bold disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? (language === 'vi' ? 'Đang tạo…' : 'Creating...') : (language === 'vi' ? 'Tạo đăng ký gói' : 'Create Registration')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

