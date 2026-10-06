import React, { useMemo, useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { formatCurrency } from '../../locales/translations';
import { AlertCircle, CalendarDays, Package, UserPlus, X } from 'lucide-react';

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  packageId: ''
};

export function NewMemberModal({ isOpen, onClose, onCreated }) {
  const { addMember, members, packages, language } = useSCMS();
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPackageId = formData.packageId || packages[0]?.id || '';
  const selectedPackage = useMemo(
    () => packages.find(item => item.id === selectedPackageId),
    [packages, selectedPackageId]
  );
  const isDirty = Boolean(formData.name || formData.email || formData.phone || formData.packageId);

  if (!isOpen) return null;

  const updateField = (field, value) => {
    setFormData(previous => ({ ...previous, [field]: value }));
    if (errors[field]) {
      setErrors(previous => ({ ...previous, [field]: undefined }));
    }
  };

  const validate = () => {
    const nextErrors = {};
    const name = formData.name.trim();
    const email = formData.email.trim();
    const phone = formData.phone.replace(/\s/g, '');

    if (!name) nextErrors.name = language === 'vi' ? 'Vui lòng nhập họ và tên.' : 'Full name is required.';
    if (!email) {
      nextErrors.email = language === 'vi' ? 'Vui lòng nhập email.' : 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = language === 'vi' ? 'Email chưa đúng định dạng.' : 'Invalid email format.';
    } else if (members.some(member => member.email.toLowerCase() === email.toLowerCase())) {
      nextErrors.email = language === 'vi' ? 'Email này đã được sử dụng.' : 'This email is already in use.';
    }

    if (!phone) {
      nextErrors.phone = language === 'vi' ? 'Vui lòng nhập số điện thoại.' : 'Phone number is required.';
    } else if (!/^(0|\+84)[0-9]{8,10}$/.test(phone)) {
      nextErrors.phone = language === 'vi' ? 'Số điện thoại chưa hợp lệ.' : 'Invalid phone number.';
    } else if (members.some(member => member.phone.replace(/\s/g, '') === phone)) {
      nextErrors.phone = language === 'vi' ? 'Số điện thoại này đã được sử dụng.' : 'This phone number is already in use.';
    }

    if (!selectedPackageId) nextErrors.packageId = language === 'vi' ? 'Vui lòng chọn gói đăng ký.' : 'Select a package.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const resetAndClose = () => {
    setFormData(EMPTY_FORM);
    setErrors({});
    setIsSubmitting(false);
    onClose();
  };

  const attemptClose = () => {
    if (isSubmitting) return;
    if (!isDirty || window.confirm(language === 'vi' ? 'Hủy tạo hồ sơ? Dữ liệu đã nhập sẽ không được lưu.' : 'Discard this new profile?')) {
      resetAndClose();
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isSubmitting || !validate()) return;

    setIsSubmitting(true);
    window.setTimeout(() => {
      const newMember = addMember({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.replace(/\s/g, ''),
        currentPackageId: selectedPackageId
      });
      setFormData(EMPTY_FORM);
      setErrors({});
      setIsSubmitting(false);
      onClose();
      onCreated?.(newMember);
    }, 500);
  };

  const fieldClass = error => `w-full h-10 bg-slate-50 border rounded-md px-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 ${error ? 'border-rose-500 focus:border-rose-600 focus:ring-rose-100' : 'border-slate-300 focus:border-blue-600 focus:ring-blue-100'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="new-member-title" className="bg-white border border-slate-200 rounded-lg w-full max-w-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 text-white rounded"><UserPlus className="w-4 h-4" /></div>
            <div>
              <h3 id="new-member-title" className="text-sm font-bold text-slate-900">{language === 'vi' ? 'Thêm thành viên' : 'Add member'}</h3>
              <p className="text-[11px] text-slate-500">{language === 'vi' ? 'Tạo hồ sơ và chọn gói đăng ký ban đầu' : 'Create a profile and select an initial package'}</p>
            </div>
          </div>
          <button type="button" onClick={attemptClose} disabled={isSubmitting} aria-label={language === 'vi' ? 'Đóng' : 'Close'} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-50"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 grid grid-cols-1 md:grid-cols-[1.15fr_0.85fr] gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">{language === 'vi' ? 'Họ và tên' : 'Full name'} <span className="text-rose-600">*</span></label>
                <input autoFocus type="text" value={formData.name} onChange={event => updateField('name', event.target.value)} placeholder="Nguyễn Văn A" className={fieldClass(errors.name)} />
                {errors.name && <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.name}</p>}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Email <span className="text-rose-600">*</span></label>
                <input type="email" value={formData.email} onChange={event => updateField('email', event.target.value)} placeholder="member@gmail.com" className={fieldClass(errors.email)} />
                {errors.email && <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.email}</p>}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">{language === 'vi' ? 'Số điện thoại' : 'Phone number'} <span className="text-rose-600">*</span></label>
                <input type="tel" value={formData.phone} onChange={event => updateField('phone', event.target.value)} placeholder="0988123456" className={fieldClass(errors.phone)} />
                {errors.phone && <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.phone}</p>}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">{language === 'vi' ? 'Gói đăng ký ban đầu' : 'Initial package'} <span className="text-rose-600">*</span></label>
                <select value={selectedPackageId} onChange={event => updateField('packageId', event.target.value)} className={fieldClass(errors.packageId)}>
                  {packages.map(item => <option key={item.id} value={item.id}>{language === 'vi' ? item.nameVi : item.name}</option>)}
                </select>
              </div>
            </div>

            <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4 h-fit">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900"><Package className="w-4 h-4 text-blue-600" />{language === 'vi' ? 'Tóm tắt đăng ký' : 'Registration summary'}</div>
              {selectedPackage && <>
                <p className="mt-4 text-sm font-bold text-slate-900">{language === 'vi' ? selectedPackage.nameVi : selectedPackage.name}</p>
                <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">{formatCurrency(selectedPackage.price, language)}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-600"><CalendarDays className="w-4 h-4" /><span>{selectedPackage.durationMonths} {language === 'vi' ? 'tháng' : 'months'}</span></div>
              </>}
              <div className="mt-4 pt-4 border-t border-slate-200 text-[11px] leading-5 text-amber-900">
                <p className="font-bold">{language === 'vi' ? 'Trạng thái sau khi tạo: Chờ thanh toán' : 'Status after creation: Pending payment'}</p>
                <p className="mt-1 text-slate-600">{language === 'vi' ? 'Gói chưa có hiệu lực cho đến khi thanh toán thành công.' : 'Benefits remain inactive until payment succeeds.'}</p>
              </div>
            </aside>
          </div>

          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button type="button" onClick={attemptClose} disabled={isSubmitting} className="px-4 h-9 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-bold rounded-md">{language === 'vi' ? 'Hủy' : 'Cancel'}</button>
            <button type="submit" disabled={isSubmitting} className="px-4 h-9 min-w-32 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-500 text-white text-xs font-bold rounded-md flex items-center justify-center gap-2">
              {isSubmitting ? <><span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />{language === 'vi' ? 'Đang tạo...' : 'Creating...'}</> : language === 'vi' ? 'Tạo hồ sơ' : 'Create profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
