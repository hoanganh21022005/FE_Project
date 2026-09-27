import React, { useState, useRef } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { X, Eye, EyeOff, UserPlus, AlertCircle } from 'lucide-react';

export function NewStaffModal({ isOpen, onClose }) {
  const { staff, addStaff, t, language } = useSCMS();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '', // coach or receptionist
    specialty: '',
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Field refs for auto-focusing on first error
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const phoneRef = useRef(null);
  const roleRef = useRef(null);
  const specialtyRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value,
      ...(field === 'role' && value !== 'coach' ? { specialty: '' } : {})
    }));
    setIsDirty(true);
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};

    // Name validation
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      newErrors.name = language === 'vi' ? 'Họ và tên là bắt buộc' : 'Full name is required';
    }

    // Email validation
    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail) {
      newErrors.email = language === 'vi' ? 'Email là bắt buộc' : 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = language === 'vi' ? 'Định dạng email không hợp lệ' : 'Invalid email format';
    } else if (staff.some(s => s.email.toLowerCase() === trimmedEmail.toLowerCase())) {
      newErrors.email = language === 'vi' ? 'Email đã tồn tại trong hệ thống' : 'Email already exists';
    }

    // Phone validation
    const trimmedPhone = formData.phone.trim();
    if (!trimmedPhone) {
      newErrors.phone = language === 'vi' ? 'Số điện thoại là bắt buộc' : 'Phone number is required';
    } else if (!/^(0|\+84)[0-9]{8,10}$/.test(trimmedPhone.replace(/\s/g, ''))) {
      newErrors.phone = language === 'vi' ? 'Số điện thoại không hợp lệ (VD: 0901234567 hoặc +84901234567)' : 'Invalid phone format';
    }

    // Role validation
    if (!formData.role) {
      newErrors.role = language === 'vi' ? 'Vui lòng chọn vai trò' : 'Please select a role';
    }

    // Specialty validation (if Coach)
    if (formData.role === 'coach' && !formData.specialty.trim()) {
      newErrors.specialty = language === 'vi' ? 'Chuyên môn là bắt buộc đối với HLV' : 'Specialty is required for Coach';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = language === 'vi' ? 'Mật khẩu là bắt buộc' : 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = language === 'vi' ? 'Mật khẩu tối thiểu 8 ký tự' : 'Password must be at least 8 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = language === 'vi' ? 'Xác nhận mật khẩu là bắt buộc' : 'Confirm password is required';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = language === 'vi' ? 'Mật khẩu xác nhận không trùng khớp' : 'Passwords do not match';
    }

    setErrors(newErrors);

    // Focus first error field
    if (newErrors.name) nameRef.current?.focus();
    else if (newErrors.email) emailRef.current?.focus();
    else if (newErrors.phone) phoneRef.current?.focus();
    else if (newErrors.role) roleRef.current?.focus();
    else if (newErrors.specialty) specialtyRef.current?.focus();
    else if (newErrors.password) passwordRef.current?.focus();
    else if (newErrors.confirmPassword) confirmPasswordRef.current?.focus();

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validate()) return;

    setIsSubmitting(true);

    setTimeout(() => {
      addStaff({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        role: formData.role,
        specialty: formData.role === 'coach' ? formData.specialty.trim() : null
      });

      setIsSubmitting(false);
      handleResetAndClose();
    }, 600);
  };

  const handleResetAndClose = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: '',
      specialty: '',
      password: '',
      confirmPassword: ''
    });
    setErrors({});
    setIsDirty(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-lg shadow-xl w-full max-w-[640px] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 text-white rounded">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {language === 'vi' ? 'Thêm nhân viên' : 'Add Staff Member'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {language === 'vi' ? 'Tạo tài khoản cho huấn luyện viên hoặc nhân viên lễ tân' : 'Create account for coaches or receptionists'}
              </p>
            </div>
          </div>
          <button
            onClick={handleAttemptClose}
            aria-label="Close modal"
            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Basic Info Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-1">
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
                  className={`w-full bg-slate-50 border rounded px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:bg-white ${
                    errors.name ? 'border-rose-500 focus:border-rose-600 bg-rose-50/20' : 'border-slate-300 focus:border-orange-500'
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
                  className={`w-full bg-slate-50 border rounded px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:bg-white ${
                    errors.email ? 'border-rose-500 focus:border-rose-600 bg-rose-50/20' : 'border-slate-300 focus:border-orange-500'
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
                  {language === 'vi' ? 'Số điện thoại' : 'Phone Number'} <span className="text-rose-600">*</span>
                </label>
                <input
                  ref={phoneRef}
                  type="text"
                  placeholder="0912345678"
                  value={formData.phone}
                  onChange={e => handleChange('phone', e.target.value)}
                  className={`w-full bg-slate-50 border rounded px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:bg-white ${
                    errors.phone ? 'border-rose-500 focus:border-rose-600 bg-rose-50/20' : 'border-slate-300 focus:border-orange-500'
                  }`}
                />
                {errors.phone && (
                  <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" /> {errors.phone}
                  </p>
                )}
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'vi' ? 'Vai trò' : 'Role'} <span className="text-rose-600">*</span>
                </label>
                <select
                  ref={roleRef}
                  value={formData.role}
                  onChange={e => {
                    const newRole = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      role: newRole,
                      specialty: newRole === 'coach' ? prev.specialty : ''
                    }));
                    setIsDirty(true);
                    if (errors.role) setErrors(prev => ({ ...prev, role: null }));
                  }}
                  className={`w-full bg-slate-50 border rounded px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:bg-white ${
                    errors.role ? 'border-rose-500 focus:border-rose-600 bg-rose-50/20' : 'border-slate-300 focus:border-orange-500'
                  }`}
                >
                  <option value="">{language === 'vi' ? 'Chọn vai trò…' : 'Select role...'}</option>
                  <option value="coach">{language === 'vi' ? 'Huấn luyện viên' : 'Coach'}</option>
                  <option value="receptionist">{language === 'vi' ? 'Lễ tân' : 'Receptionist'}</option>
                </select>
                {errors.role && (
                  <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" /> {errors.role}
                  </p>
                )}
              </div>
            </div>

            {/* Specialty Field (Conditional for Coach) */}
            {formData.role === 'coach' && (
              <div className="pt-1 animate-in fade-in duration-150">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'vi' ? 'Chuyên môn' : 'Specialty'} <span className="text-rose-600">*</span>
                </label>
                <input
                  ref={specialtyRef}
                  type="text"
                  placeholder={language === 'vi' ? 'Ví dụ: Yoga, Pilates, CrossFit, Boxing' : 'e.g. Yoga, Pilates, CrossFit'}
                  value={formData.specialty}
                  onChange={e => handleChange('specialty', e.target.value)}
                  className={`w-full bg-slate-50 border rounded px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:bg-white ${
                    errors.specialty ? 'border-rose-500 focus:border-rose-600 bg-rose-50/20' : 'border-slate-300 focus:border-orange-500'
                  }`}
                />
                {errors.specialty ? (
                  <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 shrink-0" /> {errors.specialty}
                  </p>
                ) : (
                  <p className="mt-1 text-[10px] text-slate-500">
                    {language === 'vi' ? 'Nhập bộ môn chính HLV phụ trách hướng dẫn' : 'Enter primary disciplines assigned'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Security / Password Section */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-1">
              {language === 'vi' ? 'Thông tin tài khoản' : 'Account Security'}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Temporary Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'vi' ? 'Mật khẩu tạm thời' : 'Temporary Password'} <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    ref={passwordRef}
                    type={showPassword ? 'text' : 'password'}
                    placeholder={language === 'vi' ? 'Nhập mật khẩu tạm thời' : 'Enter temporary password'}
                    value={formData.password}
                    onChange={e => handleChange('password', e.target.value)}
                    className={`w-full bg-slate-50 border rounded pl-3 pr-9 py-1.5 text-xs text-slate-900 focus:outline-none focus:bg-white ${
                      errors.password ? 'border-rose-500 focus:border-rose-600 bg-rose-50/20' : 'border-slate-300 focus:border-orange-500'
                    }`}
                  />
                  <button
                    type="button"
                    aria-label="Toggle password visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {language === 'vi' ? 'Xác nhận mật khẩu' : 'Confirm Password'} <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    ref={confirmPasswordRef}
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder={language === 'vi' ? 'Nhập lại mật khẩu' : 'Confirm password'}
                    value={formData.confirmPassword}
                    onChange={e => handleChange('confirmPassword', e.target.value)}
                    className={`w-full bg-slate-50 border rounded pl-3 pr-9 py-1.5 text-xs text-slate-900 focus:outline-none focus:bg-white ${
                      errors.confirmPassword ? 'border-rose-500 focus:border-rose-600 bg-rose-50/20' : 'border-slate-300 focus:border-orange-500'
                    }`}
                  />
                  <button
                    type="button"
                    aria-label="Toggle confirm password visibility"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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

            <p className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded p-2">
              {language === 'vi'
                ? 'Chỉ dùng dữ liệu thử nghiệm. Mật khẩu tối thiểu 8 ký tự; không dùng để xác thực trong prototype này.'
                : 'Use test data only. Minimum 8 characters; this prototype does not use the password for authentication.'}
            </p>
            <p className="text-xs text-slate-600">
              {language === 'vi' ? 'Trạng thái tài khoản: Hoạt động' : 'Account status: Active'}
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={handleAttemptClose}
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded text-xs font-semibold transition-all disabled:opacity-50"
            >
              {language === 'vi' ? 'Hủy' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-stone-900 hover:bg-orange-600 text-white rounded text-xs font-bold shadow-2xs transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <span>{language === 'vi' ? 'Đang tạo…' : 'Creating...'}</span>
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
