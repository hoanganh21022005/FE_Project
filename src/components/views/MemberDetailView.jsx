import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { formatDate, formatCurrency } from '../../locales/translations';
import { StatusBadge } from '../common/Badge';
import { memberApi } from '../../api/memberApi';
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
  AlertTriangle,
  PlusCircle,
  X,
  RefreshCw,
  Lock
} from 'lucide-react';

export function MemberDetailView({ memberId, onBack }) {
  const {
    members,
    packages,
    updateMemberProfile,
    apiEnabled,
    language
  } = useSCMS();

  const [activeTab, setActiveTab] = useState('personal'); // 'personal' or 'membership'
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [authoritativeMember, setAuthoritativeMember] = useState(null);

  // Single sequence counter to prevent race conditions from concurrent or out-of-order requests
  const activeReqSeqRef = useRef(0);

  // Cached member from context (if available) - used strictly in mock mode
  const cachedMember = members.find(
    m => String(m.id) === String(memberId) || m.id === memberId
  );

  // Unified authoritative fetch function
  const fetchAuthoritativeDetail = useCallback((targetId) => {
    if (!targetId) {
      activeReqSeqRef.current += 1;
      setAuthoritativeMember(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    if (!apiEnabled) {
      setAuthoritativeMember(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    // Increment request sequence; any prior in-flight request becomes stale immediately
    const seq = ++activeReqSeqRef.current;
    setDetailLoading(true);
    setDetailError(null);
    setAuthoritativeMember(null);

    memberApi.getMemberById(targetId)
      .then(data => {
        // Discard result if a newer request or ID change has occurred
        if (activeReqSeqRef.current !== seq) return;
        if (data && (String(data.id) === String(targetId) || data.id === targetId)) {
          setAuthoritativeMember(data);
          setDetailError(null);
        }
      })
      .catch(err => {
        // Discard error if request is stale
        if (activeReqSeqRef.current !== seq) return;
        setDetailError(err?.message || 'Không thể tải thông tin chi tiết thành viên');
        setAuthoritativeMember(null);
      })
      .finally(() => {
        if (activeReqSeqRef.current === seq) {
          setDetailLoading(false);
        }
      });
  }, [apiEnabled]);

  // Authoritative fetch on memberId or apiEnabled change
  useEffect(() => {
    if (apiEnabled) {
      fetchAuthoritativeDetail(memberId);
    } else {
      activeReqSeqRef.current += 1;
      setAuthoritativeMember(null);
      setDetailError(null);
      setDetailLoading(false);
    }

    return () => {
      // Invalidate any in-flight request when memberId changes or component unmounts
      activeReqSeqRef.current += 1;
    };
  }, [memberId, apiEnabled, fetchAuthoritativeDetail]);

  // In API mode, authoritative data matching memberId is required (no stale cache fallback on error)
  const isMatching = authoritativeMember && (String(authoritativeMember.id) === String(memberId) || authoritativeMember.id === memberId);
  const member = apiEnabled ? (isMatching ? authoritativeMember : null) : cachedMember;

  if (apiEnabled && detailLoading) {
    return (
      <div className="p-12 text-center bg-white border border-slate-200 rounded-lg">
        <div className="inline-block animate-spin w-8 h-8 border-4 border-[#BA0000] border-t-transparent rounded-full mb-3" />
        <p className="text-sm font-semibold text-[#181818]">
          {language === 'vi' ? 'Đang tải thông tin thành viên...' : 'Loading member profile...'}
        </p>
      </div>
    );
  }

  if (apiEnabled && detailError) {
    return (
      <div className="p-8 text-center bg-white border border-rose-200 rounded-lg">
        <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <p className="text-rose-700 text-sm font-bold mb-1">
          {language === 'vi' ? 'Lỗi tải hồ sơ thành viên' : 'Error loading member profile'}
        </p>
        <p className="text-xs text-stone-500 mb-4">{detailError}</p>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => fetchAuthoritativeDetail(memberId)}
            className="px-3.5 py-1.5 bg-[#BA0000] hover:bg-[#8E0000] text-white text-xs font-bold rounded transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Thử lại' : 'Retry'}</span>
          </button>
          <button
            onClick={onBack}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-[#181818] text-xs font-bold rounded transition-colors cursor-pointer"
          >
            {language === 'vi' ? 'Quay lại danh sách' : 'Back to List'}
          </button>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="p-8 text-center bg-white border border-slate-200 rounded-lg">
        <p className="text-stone-500 text-sm">
          {language === 'vi' ? 'Không tìm thấy hồ sơ thành viên' : 'Member profile not found'}
        </p>
        <button
          onClick={onBack}
          className="mt-4 px-3.5 py-1.5 bg-[#181818] hover:bg-[#BA0000] text-white text-xs font-bold rounded transition-colors cursor-pointer"
        >
          {language === 'vi' ? 'Quay lại danh sách' : 'Back to List'}
        </button>
      </div>
    );
  }

  // Derived current package info
  const pkg = packages.find(p => p.id === member.currentPackageId);

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button
          onClick={onBack}
          className="px-3 py-1.5 bg-white hover:bg-stone-50 text-[#181818] border border-slate-300 rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all hover:border-[#BA0000] cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-stone-500" />
          <span>{language === 'vi' ? 'Quay lại danh sách' : 'Back to list'}</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Status Note: G4.5 Blocked */}
          {apiEnabled && (
            <div className="px-2.5 py-1 bg-stone-100 text-stone-600 border border-stone-300 rounded text-[11px] font-medium flex items-center gap-1" title="Chờ BE xác nhận body key và enum PATCH /api/members/{id}/status">
              <Lock className="w-3 h-3 text-stone-400" />
              <span>{language === 'vi' ? 'Khóa/Mở khóa: Chỉ đọc (G4.5 Blocked)' : 'Status Lock: Read-only (G4.5 Blocked)'}</span>
            </div>
          )}

          <button
            onClick={() => setIsEditOpen(true)}
            className="px-3.5 py-1.5 bg-[#BA0000] hover:bg-[#8E0000] text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Chỉnh sửa hồ sơ' : 'Edit Profile'}</span>
          </button>
        </div>
      </div>

      {/* Member Header Profile Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#181818] text-[#E4E4E4] border border-[#323232] flex items-center justify-center text-xl font-bold shrink-0 shadow-xs">
            {(member.name || 'M').charAt(0)}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 data-testid="member-detail-header" className="text-base font-bold text-[#181818]">{member.name}</h2>
              <span className="font-mono text-[10px] font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                {member.code}
              </span>
              {/* Account Status Badge */}
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                member.accountStatus === 'locked' || member.status === 'inactive'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                {member.accountStatus === 'locked' || member.status === 'inactive'
                  ? (language === 'vi' ? 'Tài khoản: Tạm khóa' : 'Account: Locked')
                  : (language === 'vi' ? 'Tài khoản: Hoạt động' : 'Account: Active')}
              </span>
              <StatusBadge type="membership" status={member.membershipStatus || member.status} />
            </div>
            <div className="flex items-center gap-4 text-xs text-stone-500 flex-wrap">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-stone-400" /> {member.email}
              </span>
              <span className="flex items-center gap-1 tabular-nums">
                <Phone className="w-3.5 h-3.5 text-stone-400" /> {member.phone || '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Controls */}
      <div className="border-b border-slate-200 flex items-center gap-6">
        <button
          onClick={() => setActiveTab('personal')}
          data-testid="tab-button-personal"
          className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'personal'
              ? 'border-[#BA0000] text-[#BA0000]'
              : 'border-transparent text-stone-500 hover:text-[#181818]'
          }`}
        >
          <User className="w-4 h-4" />
          <span>{language === 'vi' ? 'Thông tin cá nhân' : 'Personal Information'}</span>
        </button>

        <button
          onClick={() => setActiveTab('membership')}
          data-testid="tab-button-membership"
          className={`pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'membership'
              ? 'border-[#BA0000] text-[#BA0000]'
              : 'border-transparent text-stone-500 hover:text-[#181818]'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>{language === 'vi' ? 'Gói đăng ký' : 'Membership Package'}</span>
        </button>
      </div>

      {/* TAB 1: Personal Information */}
      {activeTab === 'personal' && (
        <div data-testid="member-personal-panel" className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
          <h3 className="text-sm font-semibold text-[#181818] border-b border-stone-100 pb-3">
            {language === 'vi' ? 'Thông tin cá nhân' : 'Personal information'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="min-w-0 space-y-1 py-1">
              <span className="text-stone-500 text-[11px] font-medium">{language === 'vi' ? 'Họ và tên:' : 'Full Name:'}</span>
              <p className="font-bold text-[#181818]">{member.name}</p>
            </div>

            <div className="min-w-0 space-y-1 py-1">
              <span className="text-stone-500 text-[11px] font-medium">{language === 'vi' ? 'Mã thành viên:' : 'Member Code:'}</span>
              <p className="font-bold font-mono text-[#181818]">{member.code}</p>
            </div>

            <div className="min-w-0 space-y-1 py-1">
              <span className="text-stone-500 text-[11px] font-medium">Email:</span>
              <p className="font-bold text-[#181818]">{member.email}</p>
            </div>

            <div className="min-w-0 space-y-1 py-1">
              <span className="text-stone-500 text-[11px] font-medium">{language === 'vi' ? 'Số điện thoại:' : 'Phone:'}</span>
              <p className="font-bold tabular-nums text-[#181818]">{member.phone || (language === 'vi' ? 'Chưa cập nhật' : 'Not updated')}</p>
            </div>

            <div className="min-w-0 space-y-1 py-1">
              <span className="text-stone-500 text-[11px] font-medium">{language === 'vi' ? 'Ngày sinh:' : 'Birth Date:'}</span>
              <p className="font-bold text-[#181818]">
                {member.birthDate ? formatDate(member.birthDate, language) : (language === 'vi' ? 'Chưa cập nhật' : 'Not updated')}
              </p>
            </div>

            <div className="min-w-0 space-y-1 py-1">
              <span className="text-stone-500 text-[11px] font-medium">{language === 'vi' ? 'Giới tính:' : 'Gender:'}</span>
              <p className="font-bold text-[#181818]">
                {member.gender === 'male' || member.gender === 'Male'
                  ? (language === 'vi' ? 'Nam' : 'Male')
                  : member.gender === 'female' || member.gender === 'Female'
                  ? (language === 'vi' ? 'Nữ' : 'Female')
                  : (member.gender || (language === 'vi' ? 'Chưa cập nhật' : 'Not updated'))}
              </p>
            </div>

            <div className="min-w-0 space-y-1 py-1">
              <span className="text-stone-500 text-[11px] font-medium">{language === 'vi' ? 'Địa chỉ liên hệ:' : 'Address:'}</span>
              <p className="font-bold text-[#181818]">
                {member.address || (language === 'vi' ? 'Chưa cập nhật' : 'Not updated')}
              </p>
            </div>

            <div className="min-w-0 space-y-1 py-1">
              <span className="text-stone-500 text-[11px] font-medium">{language === 'vi' ? 'Mục tiêu tập luyện:' : 'Fitness Goal:'}</span>
              <p className="font-bold text-[#181818]">
                {member.goal || (language === 'vi' ? 'Chưa cập nhật' : 'Not updated')}
              </p>
            </div>

            <div className="min-w-0 space-y-1 py-1">
              <span className="text-stone-500 text-[11px] font-medium">{language === 'vi' ? 'Ghi chú sức khỏe:' : 'Health Notes:'}</span>
              <p className="font-bold text-[#181818]">
                {member.healthNote || (language === 'vi' ? 'Chưa cập nhật' : 'Not updated')}
              </p>
            </div>

            <div className="min-w-0 space-y-1 py-1">
              <span className="text-stone-500 text-[11px] font-medium">{language === 'vi' ? 'Ngày tham gia:' : 'Join Date:'}</span>
              <p className="font-bold tabular-nums text-[#181818]">{formatDate(member.joinDate, language)}</p>
            </div>

            <div className="min-w-0 space-y-1 py-1">
              <span className="text-stone-500 text-[11px] font-medium">{language === 'vi' ? 'Huấn luyện viên phụ trách:' : 'Assigned Coach:'}</span>
              <p className="font-bold text-[#181818]">
                {member.primaryCoachName || (language === 'vi' ? 'Chưa phân công' : 'Unassigned')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Membership Package */}
      {activeTab === 'membership' && (
        <div data-testid="member-package-panel" className="space-y-6">
          {member.currentPackageId ? (
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-5">
              {/* Package Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[#181818]">
                      {pkg ? (language === 'vi' ? pkg.nameVi : pkg.name) : member.currentPackageName}
                    </h3>
                    <StatusBadge type="membership" status={member.membershipStatus} />
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    {language === 'vi' ? 'Mã Membership:' : 'Membership ID:'}{' '}
                    {member.membershipCode || member.membershipId ? (
                      <strong className="font-mono text-stone-800">{member.membershipCode || member.membershipId}</strong>
                    ) : (
                      <span className="italic text-stone-500">{language === 'vi' ? 'Chưa có dữ liệu' : 'No data'}</span>
                    )}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs text-stone-500">{language === 'vi' ? 'Giá đăng ký:' : 'Package Price:'}</span>
                  {pkg && pkg.price !== undefined && pkg.price !== null ? (
                    <p className="text-lg font-bold text-[#BA0000] tabular-nums">
                      {formatCurrency(pkg.price, language)}
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-stone-500 italic mt-0.5">
                      {language === 'vi' ? 'Chưa có dữ liệu' : 'No data'}
                    </p>
                  )}
                </div>
              </div>

              {/* Package Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-stone-50 rounded border border-slate-200">
                  <span className="text-stone-500 text-[11px]">{language === 'vi' ? 'Thời hạn gói:' : 'Duration:'}</span>
                  <p className="font-bold text-[#181818] mt-1">
                    {pkg?.durationMonths
                      ? `${pkg.durationMonths} ${language === 'vi' ? 'tháng' : 'months'}`
                      : (language === 'vi' ? 'Chưa có dữ liệu' : 'No data')}
                  </p>
                </div>

                <div className="p-3 bg-stone-50 rounded border border-slate-200">
                  <span className="text-stone-500 text-[11px]">{language === 'vi' ? 'Ngày bắt đầu hiệu lực:' : 'Effective Start Date:'}</span>
                  <p className="font-semibold text-stone-500 mt-1 italic text-xs">
                    {member.packageStartDate
                      ? formatDate(member.packageStartDate, language)
                      : (language === 'vi' ? 'Chưa có dữ liệu (thuộc G5)' : 'No data (belongs to G5)')}
                  </p>
                </div>

                <div className="p-3 bg-stone-50 rounded border border-slate-200">
                  <span className="text-stone-500 text-[11px]">{language === 'vi' ? 'Hạn hợp đồng:' : 'Contract Expiry:'}</span>
                  <p className="font-semibold text-stone-500 mt-1 italic text-xs">
                    {member.packageEndDate
                      ? formatDate(member.packageEndDate, language)
                      : (language === 'vi' ? 'Chưa có dữ liệu (thuộc G5)' : 'No data (belongs to G5)')}
                  </p>
                </div>
              </div>

              <div className="mt-3 p-3 bg-stone-100 rounded-lg text-xs text-stone-600 border border-slate-200">
                <p>
                  {language === 'vi'
                    ? 'Lưu ý: OpenAPI MemberResponse hiện chưa cung cấp chi tiết hợp đồng và thời hạn gói. Vòng đời gói hội viên sẽ được tích hợp hoàn chỉnh tại G5.'
                    : 'Note: OpenAPI MemberResponse does not provide contract start/expiry dates yet. Package lifecycle will be integrated in G5.'}
                </p>
              </div>
            </div>
          ) : (
            /* Empty State: No Membership Package */
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-3 shadow-2xs">
              <Package className="w-10 h-10 text-stone-400 mx-auto" />
              <h4 className="text-sm font-bold text-[#181818]">
                {language === 'vi' ? 'Thành viên chưa đăng ký gói' : 'Member has no active package'}
              </h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                {language === 'vi'
                  ? 'Giai đoạn G4 tập trung hoàn thiện quản lý hồ sơ Member và Staff qua API. Quy trình đăng ký và gia hạn gói sẽ được kích hoạt tại G5.'
                  : 'G4 focuses on Member and Staff profile API management. Package subscription lifecycle is in G5.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditOpen && (
        <EditProfileModal
          key={member.id}
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          member={member}
          onUpdated={(updated) => {
            if (updated) {
              setAuthoritativeMember(updated);
            }
            fetchAuthoritativeDetail(memberId);
          }}
        />
      )}
    </div>
  );
}

{/* Modal Component: Edit Profile */}
function EditProfileModal({ isOpen, onClose, member, onUpdated }) {
  const { updateMemberProfile, language } = useSCMS();
  const [formData, setFormData] = useState({
    name: member.name || '',
    email: member.email || '',
    phone: member.phone || '',
    dateOfBirth: member.dateOfBirth || member.birthDate || '',
    address: member.address || '',
    gender: member.gender || '',
    goal: member.goal || '',
    healthNote: member.healthNote || ''
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) {
      errs.name = language === 'vi' ? 'Họ và tên là bắt buộc' : 'Name is required';
    }

    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail) {
      errs.email = language === 'vi' ? 'Email là bắt buộc' : 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errs.email = language === 'vi' ? 'Email không hợp lệ' : 'Invalid email';
    }

    if (formData.dateOfBirth) {
      const today = new Date().toISOString().split('T')[0];
      if (formData.dateOfBirth > today) {
        errs.dateOfBirth = language === 'vi' ? 'Ngày sinh không thể ở tương lai' : 'Birth date cannot be in future';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        dateOfBirth: formData.dateOfBirth || undefined,
        address: formData.address.trim() || undefined,
        gender: formData.gender || undefined,
        goal: formData.goal.trim() || undefined,
        healthNote: formData.healthNote.trim() || undefined
      };

      const result = await updateMemberProfile(member.id, payload);
      onUpdated?.(result);
      onClose();
    } catch (err) {
      // Retain form data on 400/403/409/network error
      setSubmitError(err?.message || (language === 'vi' ? 'Không thể lưu thay đổi hồ sơ' : 'Failed to save profile changes'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-sm font-bold text-[#181818]">
            {language === 'vi' ? 'Chỉnh sửa hồ sơ thành viên' : 'Edit Member Profile'}
          </h3>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
            className="text-stone-400 hover:text-stone-600 cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              {language === 'vi' ? 'Họ và tên' : 'Full Name'} <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-stone-50 border border-slate-300 rounded px-3 py-1.5 focus:outline-none focus:border-[#BA0000]"
            />
            {errors.name && <p className="text-rose-600 text-[11px] mt-0.5">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Email <span className="text-rose-600">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-stone-50 border border-slate-300 rounded px-3 py-1.5 focus:outline-none focus:border-[#BA0000]"
              />
              {errors.email && <p className="text-rose-600 text-[11px] mt-0.5">{errors.email}</p>}
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                {language === 'vi' ? 'Số điện thoại' : 'Phone'}
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-stone-50 border border-slate-300 rounded px-3 py-1.5 focus:outline-none focus:border-[#BA0000]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                {language === 'vi' ? 'Ngày sinh' : 'Birth Date'}
              </label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })}
                className="w-full bg-stone-50 border border-slate-300 rounded px-3 py-1.5 focus:outline-none focus:border-[#BA0000]"
              />
              {errors.dateOfBirth && <p className="text-rose-600 text-[11px] mt-0.5">{errors.dateOfBirth}</p>}
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                {language === 'vi' ? 'Giới tính' : 'Gender'}
              </label>
              <select
                value={formData.gender}
                onChange={e => setFormData({ ...formData, gender: e.target.value })}
                className="w-full bg-stone-50 border border-slate-300 rounded px-3 py-1.5 focus:outline-none focus:border-[#BA0000]"
              >
                <option value="">{language === 'vi' ? 'Chọn giới tính...' : 'Select gender...'}</option>
                <option value="Male">{language === 'vi' ? 'Nam' : 'Male'}</option>
                <option value="Female">{language === 'vi' ? 'Nữ' : 'Female'}</option>
                <option value="Other">{language === 'vi' ? 'Khác' : 'Other'}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              {language === 'vi' ? 'Địa chỉ' : 'Address'}
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={e => setFormData({ ...formData, address: e.target.value })}
              className="w-full bg-stone-50 border border-slate-300 rounded px-3 py-1.5 focus:outline-none focus:border-[#BA0000]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                {language === 'vi' ? 'Mục tiêu tập luyện' : 'Goal'}
              </label>
              <input
                type="text"
                placeholder="Giảm cân, tăng cơ..."
                value={formData.goal}
                onChange={e => setFormData({ ...formData, goal: e.target.value })}
                className="w-full bg-stone-50 border border-slate-300 rounded px-3 py-1.5 focus:outline-none focus:border-[#BA0000]"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                {language === 'vi' ? 'Ghi chú sức khỏe' : 'Health Note'}
              </label>
              <input
                type="text"
                placeholder="Tiền sử chấn thương..."
                value={formData.healthNote}
                onChange={e => setFormData({ ...formData, healthNote: e.target.value })}
                className="w-full bg-stone-50 border border-slate-300 rounded px-3 py-1.5 focus:outline-none focus:border-[#BA0000]"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 bg-slate-100 text-stone-700 rounded font-bold hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              {language === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3.5 py-1.5 bg-[#BA0000] hover:bg-[#8E0000] text-white rounded font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting && <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />}
              <span>{isSubmitting ? (language === 'vi' ? 'Đang lưu…' : 'Saving...') : (language === 'vi' ? 'Lưu thay đổi' : 'Save Changes')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
