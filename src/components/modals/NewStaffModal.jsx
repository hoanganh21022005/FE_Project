import React, { useState, useRef } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { X, Eye, EyeOff, UserPlus, AlertCircle } from 'lucide-react';

export function NewStaffModal({ isOpen, onClose }) {
  const { staff, addStaff, t, language, apiEnabled } = useSCMS();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '', // coach, receptionist, manager
    specialization: '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Field refs for auto-focusing on first error
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const roleRef = useRef(null);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'role' && value !== 'coach' ? { specialization: '' } : {})
    }));
    setIsDirty(true);
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
    if (submitError) setSubmitError(null);
  };

  const validate = () => {
    const newErrors = {};

    // Name validation (required by BE)
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      newErrors.name = language === 'vi' ? 'Họ và tên là bắt buộc' : 'Full name is required';
    }

    // Email validation (required by BE)
    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail) {
      newErrors.email = language === 'vi' ? 'Email là bắt buộc' : 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = language === 'vi' ? 'Định dạng email không hợp lệ' : 'Invalid email format';
    } else if (!apiEnabled && staff.some(s => (s.email || '').toLowerCase() === trimmedEmail.toLowerCase())) {
      newErrors.email = language === 'vi' ? 'Email đã tồn tại trong hệ thống' : 'Email already exists';
    }

    // Role validation (required by BE)
    if (!formData.role) {
      newErrors.role = language === 'vi' ? 'Vui lòng chọn vai trò' : 'Please select a role';
    }

    // Password validation (if provided)
    if (formData.password && formData.password.length < 6) {
      newErrors.password = language === 'vi' ? 'Mật khẩu tối thiểu 6 ký tự' : 'Password must be at least 6 characters';
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = language === 'vi' ? 'Mật khẩu xác nhận không trùng khớp' : 'Passwords do not match';
    }

    setErrors(newErrors);

    // Focus first error field
    if (newErrors.name) nameRef.current?.focus();
    else if (newErrors.email) emailRef.current?.focus();
    else if (newErrors.role) roleRef.current?.focus();

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || !validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await addStaff({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        role: formData.role,
        specialization: formData.role === 'coach' ? (formData.specialization.trim() || undefined) : undefined,
        password: formData.password || undefined
      });

      handleResetAndClose();
    } catch (err) {
      // Retain form data on error
      setSubmitError(
        err?.message ||
        (language === 'vi' ? 'Không thể tạo tài khoản nhân viên. Vui lòng thử lại.' : 'Failed to create staff member. Please try again.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: '',
      specialization: '',
      password: '',
      confirmPassword: ''
    });
    setErrors({});
    setSubmitError(null);
    setIsDirty(false);
    setIsSubmitting(false);
    onClose();
  };

  const handleAttemptClose = () => {
    if (isSubmitting) return;
    if (isDirty) {
      if (window.confirm(language === 'vi' ? 'Bạn có chắc chắn muốn hủy? Dữ liệu đã nhập sẽ không được lưu.' : 'Are you sure you want to discard unsaved changes?')) {
        handleResetAndClose();
      }
    } else {
      handleResetAndClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-[620px] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#181818] text-[#D62323] rounded">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#181818]">
                {language === 'vi' ? 'Thêm nhân viên mới' : 'Add New Staff Member'}
              </h3>
              <p className="text-[11px] text-stone-500">
                {language === 'vi'
                  ? 'Tạo tài khoản nhân viên theo chuẩn OpenAPI (Name, Email, Role bắt buộc)'
                  : 'Create staff account according to OpenAPI (Name, Email, Role required)'}
              </p>
            </div>
          </div>
          <button
            onClick={handleAttemptClose}
            disabled={isSubmitting}
            aria-label="Close modal"
            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error banner */}
        {submitError && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Basic Info Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#181818] uppercase tracking-wider border-b border-slate-100 pb-1">
              {language === 'vi' ? 'Thông tin cơ bản' : 'Basic Information'}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'vi' ? 'Họ và tên' : 'Full Name'} <span className="text-rose-600">*</span>
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  placeholder={language === 'vi' ? 'Ví dụ: Nguyễn Văn Hùng' : 'e.g. John Smith'}
                  value={formData.name}
                  onChange={e => handleChange('name', e.target.value)}
                  className={`w-full bg-stone-50 border rounded px-3 py-1.5 text-xs text-[#181818] focus:outline-none focus:bg-white ${
                    errors.name ? 'border-rose-500 focus:border-rose-600 bg-rose-50/20' : 'border-slate-300 focus:border-[#BA0000]'
                  }`}
                />
                {errors.name && (
                  <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" /> {errors.name}
                  </p>
                )}
              </div>

              {/* Login Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'vi' ? 'Email đăng nhập' : 'Login Email'} <span className="text-rose-600">*</span>
                </label>
                <input
                  ref={emailRef}
                  type="email"
                  placeholder="nhanvien@scms.com"
                  value={formData.email}
                  onChange={e => handleChange('email', e.target.value)}
                  className={`w-full bg-stone-50 border rounded px-3 py-1.5 text-xs text-[#181818] focus:outline-none focus:bg-white ${
                    errors.email ? 'border-rose-500 focus:border-rose-600 bg-rose-50/20' : 'border-slate-300 focus:border-[#BA0000]'
                  }`}
                />
                {errors.email && (
                  <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" /> {errors.email}
                  </p>
                )}
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'vi' ? 'Số điện thoại' : 'Phone Number'}
                </label>
                <input
                  type="text"
                  placeholder="0912345678"
                  value={formData.phone}
                  onChange={e => handleChange('phone', e.target.value)}
                  className="w-full bg-stone-50 border border-slate-300 rounded px-3 py-1.5 text-xs text-[#181818] focus:outline-none focus:bg-white focus:border-[#BA0000]"
                />
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'vi' ? 'Vai trò' : 'Role'} <span className="text-rose-600">*</span>
                </label>
                <select
                  ref={roleRef}
                  value={formData.role}
                  onChange={e => handleChange('role', e.target.value)}
                  className={`w-full bg-stone-50 border rounded px-3 py-1.5 text-xs text-[#181818] focus:outline-none focus:bg-white ${
                    errors.role ? 'border-rose-500 focus:border-rose-600 bg-rose-50/20' : 'border-slate-300 focus:border-[#BA0000]'
                  }`}
                >
                  <option value="">{language === 'vi' ? 'Chọn vai trò…' : 'Select role...'}</option>
                  <option value="coach">{language === 'vi' ? 'Huấn luyện viên' : 'Coach'}</option>
                  <option value="receptionist">{language === 'vi' ? 'Lễ tân' : 'Receptionist'}</option>
                  <option value="manager">{language === 'vi' ? 'Quản lý' : 'Manager'}</option>
                </select>
                {errors.role && (
                  <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" /> {errors.role}
                  </p>
                )}
              </div>
            </div>

            {/* Specialization Field (Conditional for Coach) */}
            {formData.role === 'coach' && (
              <div className="pt-1 animate-in fade-in duration-150">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'vi' ? 'Chuyên môn' : 'Specialization'}
                </label>
                <input
                  type="text"
                  placeholder={language === 'vi' ? 'Ví dụ: Yoga, Pilates, CrossFit, Boxing' : 'e.g. Yoga, Pilates, CrossFit'}
                  value={formData.specialization}
                  onChange={e => handleChange('specialization', e.target.value)}
                  className="w-full bg-stone-50 border border-slate-300 rounded px-3 py-1.5 text-xs text-[#181818] focus:outline-none focus:bg-white focus:border-[#BA0000]"
                />
              </div>
            )}
          </div>

          {/* Security / Password Section */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-[#181818] uppercase tracking-wider border-b border-slate-100 pb-1">
              {language === 'vi' ? 'Thông tin mật khẩu (Tùy chọn)' : 'Password (Optional)'}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'vi' ? 'Mật khẩu tạm thời' : 'Temporary Password'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={language === 'vi' ? 'Tối thiểu 6 ký tự' : 'Min 6 characters'}
                    value={formData.password}
                    onChange={e => handleChange('password', e.target.value)}
                    className="w-full bg-stone-50 border border-slate-300 rounded pl-3 pr-9 py-1.5 text-xs text-[#181818] focus:outline-none focus:bg-white focus:border-[#BA0000]"
                  />
                  <button
                    type="button"
                    aria-label="Toggle password visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" /> {errors.password}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'vi' ? 'Xác nhận mật khẩu' : 'Confirm Password'}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder={language === 'vi' ? 'Nhập lại mật khẩu' : 'Confirm password'}
                    value={formData.confirmPassword}
                    onChange={e => handleChange('confirmPassword', e.target.value)}
                    className="w-full bg-stone-50 border border-slate-300 rounded pl-3 pr-9 py-1.5 text-xs text-[#181818] focus:outline-none focus:bg-white focus:border-[#BA0000]"
                  />
                  <button
                    type="button"
                    aria-label="Toggle confirm password visibility"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" /> {errors.confirmPassword}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={handleAttemptClose}
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              {language === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-[#BA0000] hover:bg-[#8E0000] text-white rounded text-xs font-bold shadow-2xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                  <span>{language === 'vi' ? 'Đang tạo…' : 'Creating...'}</span>
                </>
              ) : (
                <span>{language === 'vi' ? 'Tạo nhân viên' : 'Create Staff'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
