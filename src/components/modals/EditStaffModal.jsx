import React, { useEffect, useState, useRef } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { X, Edit2, AlertCircle } from 'lucide-react';
import { publicSports } from '../../data/publicCoaches';
import { getAssignableStaffRoles, updateStaff as updateStaffProfile } from '../../api/staffApi';
import { updateUserRole } from '../../api/adminApi';
import { getErrorMessage } from '../../api/apiErrors';
import { isValidNumericId } from '../../api/schemaValidators';
import { saveStaffChanges } from '../../api/staffEditWorkflow';

export function EditStaffModal({ isOpen, onClose, staffMember, onUpdated }) {
  const { updateStaff, fetchStaff, showToast, currentUser, apiEnabled, language } = useSCMS();

  const [formData, setFormData] = useState({
    name: staffMember?.name || '',
    email: staffMember?.email || '',
    phone: staffMember?.phone || '',
    role: staffMember?.role || '',
    specialization: staffMember?.specialization || staffMember?.specialty || ''
  });

  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState('');
  const [needsReload, setNeedsReload] = useState(false);
  const submitLock = useRef(false);

  const nameRef = useRef(null);
  const emailRef = useRef(null);

  const authorities = Array.isArray(currentUser?.authorities) ? currentUser.authorities : [];
  const isSelf = apiEnabled && currentUser?.id != null && String(staffMember?.userId) === String(currentUser.id);
  const canEditProfile = !apiEnabled || authorities.includes('MANAGE_USERS');
  const canChangeRole = !apiEnabled || (isValidNumericId(currentUser?.id) && !isSelf && isValidNumericId(staffMember?.userId) &&
    (authorities.includes('MANAGE_USERS') || authorities.includes('MANAGE_RBAC')) &&
    ['coach', 'receptionist', 'manager'].includes(staffMember?.role));

  useEffect(() => {
    if (!isOpen || !apiEnabled || !canChangeRole) return undefined;
    let active = true;
    setRolesLoading(true);
    setRolesError('');
    getAssignableStaffRoles({ notifyForbidden: false })
      .then((data) => { if (active) { setRoles(data); if (data.length === 0) setRolesError(language === 'vi' ? 'Không có vai trò nhân sự hợp lệ.' : 'No valid staff roles are available.'); } })
      .catch((error) => { if (active) setRolesError(getErrorMessage(error)); })
      .finally(() => { if (active) setRolesLoading(false); });
    return () => { active = false; };
  }, [isOpen, apiEnabled, canChangeRole, staffMember?.userId]);

  if (!isOpen || !staffMember) return null;

  const currentSpecialization = String(formData.specialization || '').trim();
  const currentSpecializationKey = currentSpecialization.toLocaleLowerCase();
  const hasKnownSpecialization = publicSports.some(sport =>
    [sport.title, sport.titleEn].some(value => value.toLocaleLowerCase() === currentSpecializationKey)
  );

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'role' && value !== 'coach' && !apiEnabled ? { specialization: '' } : {})
    }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    if (submitError && !needsReload) setSubmitError(null);
  };

  const validate = () => {
    const newErrors = {};
    const profileChanged = !apiEnabled || formData.name.trim() !== String(staffMember.name || '').trim() ||
      formData.phone.trim() !== String(staffMember.phone || '').trim() ||
      (staffMember.role === 'coach' && formData.role === 'coach' && formData.specialization.trim() !== String(staffMember.specialization || '').trim());
    const trimmedName = formData.name.trim();
    if (profileChanged && !trimmedName) {
      newErrors.name = language === 'vi' ? 'Họ và tên là bắt buộc' : 'Full name is required';
    }

    const trimmedEmail = formData.email.trim();
    if (profileChanged && !trimmedEmail) {
      newErrors.email = language === 'vi' ? 'Email là bắt buộc' : 'Email is required';
    } else if (profileChanged && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = language === 'vi' ? 'Định dạng email không hợp lệ' : 'Invalid email format';
    }

    if (!formData.role) {
      newErrors.role = language === 'vi' ? 'Vui lòng chọn vai trò' : 'Please select a role';
    }

    setErrors(newErrors);
    if (newErrors.name) nameRef.current?.focus();
    else if (newErrors.email) emailRef.current?.focus();

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLock.current || isSubmitting || needsReload || !validate()) return;

    submitLock.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (!apiEnabled) {
        const result = await updateStaff(staffMember.id, {
          name: formData.name.trim(), email: formData.email.trim(), phone: formData.phone.trim(),
          role: formData.role, specialization: formData.role === 'coach' ? formData.specialization.trim() : undefined,
        });
        onUpdated?.(result);
        onClose();
        return;
      }
      const result = await saveStaffChanges({
        staff: staffMember, form: formData, roles, currentUserId: currentUser?.id,
        canEditProfile, canChangeRole,
        updateProfile: (id, data) => updateStaffProfile(id, data, { notifyForbidden: false }),
        updateRole: updateUserRole,
        reloadStaff: () => fetchStaff({ authoritative: true }),
      });
      const changed = result.profile.state !== 'unchanged' || result.role.state !== 'unchanged';
      if (!changed) {
        setSubmitError(language === 'vi' ? 'Không có thay đổi để lưu.' : 'There are no changes to save.');
        return;
      }
      if (result.latest) {
        onUpdated?.(result.latest);
        setFormData((previous) => ({
          ...previous,
          ...(result.profile.state === 'saved' ? { name: result.latest.name || '', phone: result.latest.phone || '', specialization: result.latest.specialization || '' } : {}),
          ...(result.role.state === 'saved' ? { role: result.latest.role || '' } : {}),
          email: result.latest.email || '',
        }));
      }
      const incomplete = [result.profile, result.role].some((entry) => ['failed', 'skipped', 'unconfirmed'].includes(entry.state));
      if (result.reloadError || (!result.latest && ![result.profile, result.role].some((entry) => entry.error?.status === 401))) setNeedsReload(true);
      if (incomplete || result.reloadError) {
        const describe = (label, entry) => {
          if (entry.state === 'unchanged') return `${label}: ${language === 'vi' ? 'không thay đổi' : 'unchanged'}`;
          if (entry.state === 'saved') return `${label}: ${language === 'vi' ? 'đã lưu' : 'saved'}`;
          return `${label}: ${language === 'vi' ? 'chưa xác nhận được' : 'not confirmed'}${entry.error ? ` (${getErrorMessage(entry.error)})` : ''}`;
        };
        setSubmitError([describe(language === 'vi' ? 'Hồ sơ' : 'Profile', result.profile), describe(language === 'vi' ? 'Vai trò' : 'Role', result.role), result.reloadError ? (language === 'vi' ? 'Không tải lại được danh sách; hãy tải lại trước khi tiếp tục.' : 'Could not reload staff; refresh before continuing.') : ''].filter(Boolean).join('. '));
        return;
      }
      showToast?.(language === 'vi' ? 'Đã lưu thay đổi nhân viên và tải lại danh sách.' : 'Staff changes saved and list refreshed.');
      onClose();
    } catch (err) {
      setSubmitError(
        err?.message ||
        (language === 'vi' ? 'Không thể cập nhật thông tin nhân viên' : 'Failed to update staff member')
      );
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  const reloadAfterFailure = async () => {
    if (submitLock.current) return;
    submitLock.current = true;
    setIsSubmitting(true);
    try {
      const records = await fetchStaff({ authoritative: true });
      const latest = records.find((item) => String(item.userId) === String(staffMember.userId));
      if (!latest) throw new Error(language === 'vi' ? 'Không tìm thấy nhân viên sau khi tải lại.' : 'Staff member was not found after refresh.');
      onUpdated?.(latest);
      setFormData({ name: latest.name || '', email: latest.email || '', phone: latest.phone || '', role: latest.role || '', specialization: latest.specialization || '' });
      setNeedsReload(false);
      setSubmitError(language === 'vi' ? 'Đã tải lại dữ liệu. Vui lòng kiểm tra trước khi lưu tiếp.' : 'Data refreshed. Review it before saving again.');
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-[560px] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-dark text-brand-accent-dark rounded">
              <Edit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-brand-dark">
                {language === 'vi' ? 'Chỉnh sửa nhân viên' : 'Edit Staff Member'}
              </h3>
              <p className="text-[11px] text-stone-500">
                {language === 'vi' ? 'Cập nhật hồ sơ và vai trò theo quyền của bạn' : 'Update the profile and role according to your permissions'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error banner */}
        {submitError && (
          <div role="alert" className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{submitError}</span>
            {needsReload && <button type="button" disabled={isSubmitting} onClick={reloadAfterFailure} className="ml-auto shrink-0 underline font-semibold disabled:opacity-50">{language === 'vi' ? 'Tải lại' : 'Refresh'}</button>}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {language === 'vi' ? 'Họ và tên' : 'Full Name'} <span className="text-rose-600">*</span>
              </label>
              <input
                ref={nameRef}
                type="text"
                value={formData.name}
                disabled={apiEnabled && !canEditProfile}
                onChange={e => handleChange('name', e.target.value)}
                className={`w-full bg-stone-50 border rounded px-3 py-1.5 text-xs text-brand-dark focus:outline-none focus:bg-white ${
                  errors.name ? 'border-rose-500 focus:border-rose-600 bg-rose-50/20' : 'border-slate-300 focus:border-brand-primary'
                }`}
              />
              {errors.name && (
                <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3 h-3 shrink-0" /> {errors.name}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email <span className="text-rose-600">*</span>
                </label>
                <input
                  ref={emailRef}
                  type="email"
                  value={formData.email}
                  readOnly={apiEnabled}
                  onChange={e => handleChange('email', e.target.value)}
                  className={`w-full bg-stone-50 border rounded px-3 py-1.5 text-xs text-brand-dark focus:outline-none focus:bg-white ${
                    errors.email ? 'border-rose-500 focus:border-rose-600 bg-rose-50/20' : 'border-slate-300 focus:border-brand-primary'
                  }`}
                />
                {errors.email && (
                  <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" /> {errors.email}
                  </p>
                )}
                {apiEnabled && <p className="mt-1 text-[11px] text-stone-500">{language === 'vi' ? 'Email chỉ xem trong biểu mẫu này.' : 'Email is read-only in this form.'}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'vi' ? 'Số điện thoại' : 'Phone Number'}
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  disabled={apiEnabled && !canEditProfile}
                  onChange={e => handleChange('phone', e.target.value)}
                  className="w-full bg-stone-50 border border-slate-300 rounded px-3 py-1.5 text-xs text-brand-dark focus:outline-none focus:bg-white focus:border-brand-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'vi' ? 'Vai trò' : 'Role'} <span className="text-rose-600">*</span>
                </label>
                <select
                  value={formData.role}
                  onChange={e => handleChange('role', e.target.value)}
                  disabled={apiEnabled && (!canChangeRole || rolesLoading || Boolean(rolesError) || needsReload)}
                  className="w-full bg-stone-50 border border-slate-300 rounded px-3 py-1.5 text-xs text-brand-dark focus:outline-none focus:bg-white focus:border-brand-primary"
                >
                  {apiEnabled ? (
                    <>
                      {!roles.some((role) => role.role === formData.role) && <option value={formData.role}>{formData.role || '—'}</option>}
                      {roles.map((role) => <option key={role.id} value={role.role}>{role.role === 'coach' ? (language === 'vi' ? 'Huấn luyện viên' : 'Coach') : role.role === 'receptionist' ? (language === 'vi' ? 'Lễ tân' : 'Receptionist') : (language === 'vi' ? 'Quản lý' : 'Manager')}</option>)}
                    </>
                  ) : <><option value="coach">{language === 'vi' ? 'Huấn luyện viên' : 'Coach'}</option><option value="receptionist">{language === 'vi' ? 'Lễ tân' : 'Receptionist'}</option><option value="manager">{language === 'vi' ? 'Quản lý' : 'Manager'}</option></>}
                </select>
                {apiEnabled && <p className="mt-1 text-[11px] text-stone-500">{isSelf ? (language === 'vi' ? 'Không thể đổi vai trò của chính bạn tại đây.' : 'You cannot change your own role here.') : !canChangeRole ? (language === 'vi' ? 'Vai trò chỉ được xem với quyền hiện tại.' : 'Role is read-only with your current permissions.') : rolesLoading ? (language === 'vi' ? 'Đang tải vai trò…' : 'Loading roles…') : rolesError ? (language === 'vi' ? `Không tải được vai trò: ${rolesError}` : `Could not load roles: ${rolesError}`) : ''}</p>}
              </div>

              {formData.role === 'coach' && (!apiEnabled || staffMember.role === 'coach') && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'vi' ? 'Chuyên môn' : 'Specialization'}
                  </label>
                  <select
                    value={currentSpecialization}
                    disabled={apiEnabled && !canEditProfile}
                    onChange={e => handleChange('specialization', e.target.value)}
                    className="w-full bg-stone-50 border border-slate-300 rounded px-3 py-1.5 text-xs text-brand-dark focus:outline-none focus:bg-white focus:border-brand-primary"
                  >
                    <option value="">{language === 'vi' ? 'Chọn môn chuyên môn...' : 'Select a specialization...'}</option>
                    {currentSpecialization && !hasKnownSpecialization && (
                      <option value={currentSpecialization}>{currentSpecialization}</option>
                    )}
                    {publicSports.map(sport => {
                      const matchesCurrentValue = [sport.title, sport.titleEn]
                        .some(value => value.toLocaleLowerCase() === currentSpecializationKey);
                      return (
                        <option key={sport.id} value={matchesCurrentValue ? currentSpecialization : sport.title}>
                          {language === 'vi' ? sport.title : sport.titleEn}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              {language === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || needsReload}
              className="px-4 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded text-xs font-bold shadow-2xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                  <span>{language === 'vi' ? 'Đang lưu…' : 'Saving...'}</span>
                </>
              ) : (
                <span>{language === 'vi' ? 'Lưu thay đổi' : 'Save Changes'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
