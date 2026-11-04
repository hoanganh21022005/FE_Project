import React, { useState, useRef } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { X, Edit2, AlertCircle } from 'lucide-react';
import { publicSports } from '../../data/publicCoaches';

export function EditStaffModal({ isOpen, onClose, staffMember, onUpdated }) {
  const { updateStaff, language } = useSCMS();

  const [formData, setFormData] = useState({
    name: staffMember?.name || '',
    email: staffMember?.email || '',
    phone: staffMember?.phone || '',
    role: staffMember?.role || 'coach',
    specialization: staffMember?.specialization || staffMember?.specialty || ''
  });

  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nameRef = useRef(null);
  const emailRef = useRef(null);

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
      ...(field === 'role' && value !== 'coach' ? { specialization: '' } : {})
    }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
    if (submitError) setSubmitError(null);
  };

  const validate = () => {
    const newErrors = {};
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      newErrors.name = language === 'vi' ? 'Họ và tên là bắt buộc' : 'Full name is required';
    }

    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail) {
      newErrors.email = language === 'vi' ? 'Email là bắt buộc' : 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
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
    if (isSubmitting || !validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        role: formData.role,
        specialization: formData.role === 'coach' ? (formData.specialization.trim() || undefined) : undefined
      };

      const result = await updateStaff(staffMember.id, payload);
      onUpdated?.(result);
      onClose();
    } catch (err) {
      setSubmitError(
        err?.message ||
        (language === 'vi' ? 'Không thể cập nhật thông tin nhân viên' : 'Failed to update staff member')
      );
    } finally {
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
                {language === 'vi' ? 'Cập nhật thông tin nhân sự và phân quyền vai trò' : 'Update staff info and role assignment'}
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
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{submitError}</span>
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
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'vi' ? 'Số điện thoại' : 'Phone Number'}
                </label>
                <input
                  type="text"
                  value={formData.phone}
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
                  className="w-full bg-stone-50 border border-slate-300 rounded px-3 py-1.5 text-xs text-brand-dark focus:outline-none focus:bg-white focus:border-brand-primary"
                >
                  <option value="coach">{language === 'vi' ? 'Huấn luyện viên' : 'Coach'}</option>
                  <option value="receptionist">{language === 'vi' ? 'Lễ tân' : 'Receptionist'}</option>
                  <option value="manager">{language === 'vi' ? 'Quản lý' : 'Manager'}</option>
                </select>
              </div>

              {formData.role === 'coach' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {language === 'vi' ? 'Chuyên môn' : 'Specialization'}
                  </label>
                  <select
                    value={currentSpecialization}
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
              disabled={isSubmitting}
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
