import React, { useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { AlertCircle, UserPlus, X } from 'lucide-react';
import { validateEmail, validatePhone } from '../../utils/formValidation';

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  goal: '',
  healthNote: ''
};

export function NewMemberModal({ isOpen, onClose, onCreated }) {
  const { addMember, members, language, apiEnabled } = useSCMS();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDirty = Boolean(
    formData.name ||
    formData.email ||
    formData.phone ||
    formData.goal ||
    formData.healthNote
  );

  if (!isOpen) return null;

  const validateField = (field, value) => {
    if (field === 'email') {
      const emailError = validateEmail(value, { required: true, language });
      if (emailError) return emailError;
      if (!apiEnabled && members.some(member => (member.email || '').toLowerCase() === value.trim().toLowerCase())) {
        return language === 'vi' ? 'Email này đã được sử dụng.' : 'This email is already in use.';
      }
    }
    if (field === 'phone') return validatePhone(value, { language });
    if (field === 'dateOfBirth' && value && value > new Date().toISOString().slice(0, 10)) {
      return language === 'vi' ? 'Ngày sinh không thể ở tương lai.' : 'Birth date cannot be in the future.';
    }
    return '';
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: validateField(field, value) || undefined }));
    }
    if (submitError) setSubmitError(null);
  };

  const validate = () => {
    const nextErrors = {};
    const name = formData.name.trim();
    const email = formData.email.trim();
    const phone = formData.phone.replace(/\s/g, '');

    // Name & email are the only required fields according to OpenAPI
    if (!name) {
      nextErrors.name = language === 'vi' ? 'Vui lòng nhập họ và tên.' : 'Full name is required.';
    }

    const emailError = validateField('email', email);
    const phoneError = validateField('phone', phone);
    if (emailError) nextErrors.email = emailError;
    if (phoneError) nextErrors.phone = phoneError;

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const resetAndClose = () => {
    setFormData(EMPTY_FORM);
    setErrors({});
    setSubmitError(null);
    setIsSubmitting(false);
    onClose();
  };

  const attemptClose = () => {
    if (isSubmitting) return;
    if (!isDirty || window.confirm(language === 'vi' ? 'Hủy tạo hồ sơ? Dữ liệu đã nhập sẽ không được lưu.' : 'Discard this new profile?')) {
      resetAndClose();
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting || !validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.replace(/\s/g, '') || undefined,
        goal: formData.goal.trim() || undefined,
        healthNote: formData.healthNote.trim() || undefined
      };

      const createdMember = await addMember(payload);
      resetAndClose();
      onCreated?.(createdMember);
    } catch (err) {
      // Retain form data on 400/403/409/network error
      setSubmitError(
        err?.message ||
        (language === 'vi' ? 'Không thể tạo hồ sơ thành viên. Vui lòng thử lại.' : 'Failed to create member profile. Please try again.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass = error =>
    `w-full h-9 bg-stone-50 border rounded px-3 text-xs text-brand-dark placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 ${
      error
        ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
        : 'border-slate-300 focus:border-brand-primary focus:ring-brand-primary'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-member-title"
        className="bg-white border border-slate-200 rounded-lg w-full max-w-xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-dark text-brand-accent-dark rounded">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 id="new-member-title" className="text-sm font-bold text-brand-dark">
                {language === 'vi' ? 'Thêm thành viên mới' : 'Add New Member'}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={attemptClose}
            disabled={isSubmitting}
            aria-label={language === 'vi' ? 'Đóng' : 'Close'}
            className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Banner */}
        {submitError && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Form */}
        <form noValidate onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                {language === 'vi' ? 'Họ và tên' : 'Full name'} <span className="text-rose-600">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={formData.name}
                onChange={e => updateField('name', e.target.value)}
                placeholder="Nguyễn Văn A"
                className={fieldClass(errors.name)}
              />
              {errors.name && (
                <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.name}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Email <span className="text-rose-600">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => updateField('email', e.target.value)}
                  onBlur={e => setErrors(prev => ({ ...prev, email: validateField('email', e.target.value) || undefined }))}
                  placeholder="member@gmail.com"
                  className={fieldClass(errors.email)}
                />
                {errors.email && (
                  <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.email}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {language === 'vi' ? 'Số điện thoại' : 'Phone number'}
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={e => updateField('phone', e.target.value)}
                  onBlur={e => setErrors(prev => ({ ...prev, phone: validateField('phone', e.target.value) || undefined }))}
                  placeholder="0988123456"
                  className={fieldClass(errors.phone)}
                />
                {errors.phone && (
                  <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.phone}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {language === 'vi' ? 'Mục tiêu tập luyện' : 'Goal'}
                </label>
                <input
                  type="text"
                  value={formData.goal}
                  onChange={e => updateField('goal', e.target.value)}
                  placeholder="Giảm mỡ, tăng cơ..."
                  className={fieldClass()}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {language === 'vi' ? 'Ghi chú sức khỏe' : 'Health note'}
                </label>
                <input
                  type="text"
                  value={formData.healthNote}
                  onChange={e => updateField('healthNote', e.target.value)}
                  placeholder="Tiền sử bệnh án, lưu ý..."
                  className={fieldClass()}
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 bg-white sticky bottom-0">
            <button
              type="button"
              onClick={attemptClose}
              disabled={isSubmitting}
              className="px-4 h-9 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-bold rounded cursor-pointer"
            >
              {language === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 h-9 min-w-32 bg-brand-primary hover:bg-brand-primary-hover disabled:bg-slate-500 text-white text-xs font-bold rounded flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                  <span>{language === 'vi' ? 'Đang tạo...' : 'Creating...'}</span>
                </>
              ) : (
                <span>{language === 'vi' ? 'Tạo hồ sơ' : 'Create profile'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
