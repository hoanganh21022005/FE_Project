import React, { useState } from 'react';
import { CheckCircle2, Edit3, Package, Plus, Power, X } from 'lucide-react';
import { useSCMS } from '../../context/SCMSContext';
import { getErrorMessage } from '../../api/apiErrors';
import { formatCurrency } from '../../locales/translations';
import {
  buildPackageFormPayload,
  packageFormFromItem,
  packageStatusForApi,
  validatePackageForm,
} from '../../api/packageForm';

function PackageModal({ item, language, apiMode, onClose, onSave }) {
  const initial = packageFormFromItem(item, { apiMode });
  const [form, setForm] = useState(initial);
  const [benefitsText, setBenefitsText] = useState(initial.benefitsText);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const vi = language === 'vi';

  const submit = async (event) => {
    event.preventDefault();
    const payload = buildPackageFormPayload(form, benefitsText);
    const validationError = validatePackageForm(payload, language);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSave(payload);
      onClose();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = 'block mt-1 w-full border rounded px-3 py-2 font-normal';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-xl rounded-lg bg-white shadow-xl border border-stone-200">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-sm font-bold">{item ? (vi ? 'Chỉnh sửa gói' : 'Edit package') : (vi ? 'Tạo gói mới' : 'Create package')}</h3>
          <button type="button" onClick={onClose} aria-label={vi ? 'Đóng' : 'Close'}><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && <div role="alert" className="p-2 rounded border border-rose-200 bg-rose-50 text-xs text-rose-700">{error}</div>}
          <label className="block text-xs font-bold">{vi ? 'Tên gói' : 'Package name'}<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={fieldClass} /></label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-bold">{vi ? 'Loại gói' : 'Package type'}
              <select value={form.packageType || 'Normal'} onChange={e => setForm({ ...form, packageType: e.target.value })} className={fieldClass}>
                <option value="Normal">Normal</option>
                <option value="Advanced">Advanced</option>
              </select>
            </label>
            <label className="block text-xs font-bold">{vi ? 'Thời hạn (ngày)' : 'Duration (days)'}
              <input required min="1" step="1" type="number" value={form.durationDays ?? ''} onChange={e => setForm({ ...form, durationDays: e.target.value })} className={fieldClass} />
            </label>
            <label className="block text-xs font-bold">{vi ? 'Giá (VNĐ)' : 'Price (VND)'}
              <input required min="0" step="any" type="number" value={form.price ?? ''} onChange={e => setForm({ ...form, price: e.target.value })} className={fieldClass} />
            </label>
            {form.packageType === 'Advanced' && <label className="block text-xs font-bold">{vi ? 'Tổng credit' : 'Total credit'}
              <input required min="0" step="1" type="number" value={form.totalCredit ?? ''} onChange={e => setForm({ ...form, totalCredit: e.target.value })} className={fieldClass} />
            </label>}
          </div>
          <label className="block text-xs font-bold">{vi ? 'Quyền lợi (mỗi dòng một mục)' : 'Benefits (one per line)'}
            <textarea rows="5" value={benefitsText} onChange={e => setBenefitsText(e.target.value)} className={fieldClass} />
          </label>
          <label className="block text-xs font-bold">{vi ? 'Trạng thái' : 'Status'}
            <select value={form.status || 'active'} onChange={e => setForm({ ...form, status: e.target.value })} className={fieldClass}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 bg-stone-100 rounded text-xs font-bold">{vi ? 'Hủy' : 'Cancel'}</button>
          <button disabled={saving} className="px-3 py-2 bg-stone-900 text-white rounded text-xs font-bold disabled:opacity-50">{saving ? (vi ? 'Đang lưu…' : 'Saving…') : (vi ? 'Lưu' : 'Save')}</button>
        </div>
      </form>
    </div>
  );
}

export function PackageManagement() {
  const { packages, createPackage, updatePackage, updatePackageStatus, showToast, t, language, apiEnabled, currentUser } = useSCMS();
  const [editor, setEditor] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const canManagePackages = !apiEnabled || currentUser?.authorities?.includes('MANAGE_PACKAGES') || currentUser?.authorities?.includes('*');

  const save = async (data) => {
    if (editor.item) await updatePackage(editor.item.id, data);
    else await createPackage(data);
    showToast(language === 'vi' ? 'Đã lưu gói thành viên.' : 'Package saved.');
  };

  const toggleStatus = async (item) => {
    setBusyId(item.id);
    try {
      await updatePackageStatus(item.id, packageStatusForApi(item.status));
      showToast(language === 'vi' ? 'Đã cập nhật trạng thái gói.' : 'Package status updated.');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const vi = language === 'vi';

  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 rounded-lg p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-stone-100 rounded"><Package className="w-5 h-5 text-[#BA0000]" /></div>
          <div><h2 className="text-sm font-bold text-[#181818]">{t('packages')}</h2><p className="text-xs text-stone-500 mt-1">{vi ? 'Tạo, chỉnh sửa và bật/tắt gói thành viên.' : 'Create, edit and activate membership packages.'}</p></div>
        </div>
        {canManagePackages && <button onClick={() => setEditor({ item: null })} className="px-3.5 py-2 bg-[#BA0000] hover:bg-[#8E0000] text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"><Plus className="w-4 h-4" />{vi ? 'Tạo gói mới' : 'Create Package'}</button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {packages.map((pkg, index) => (
          <article key={pkg.id} className="bg-white border border-stone-200 rounded-lg p-5 shadow-xs flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div><span className="text-[10px] font-bold text-[#BA0000] uppercase">Package {index + 1}</span><h3 className="text-base font-bold text-[#181818] mt-1">{vi ? (pkg.nameVi || pkg.name) : pkg.name}</h3></div>
              <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${pkg.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-stone-100 text-stone-600 border border-stone-200'}`}>{pkg.status || '—'}</span>
            </div>
            <div className="mt-4 bg-stone-50 border border-stone-200 rounded p-3 space-y-1">
              <div className="text-xl font-bold text-[#181818]">{pkg.price == null ? '—' : formatCurrency(pkg.price, language)}</div>
              <div className="text-xs text-stone-500">{pkg.packageType || '—'} · {pkg.durationDays == null ? '—' : `${pkg.durationDays} ${vi ? 'ngày' : 'days'}`}</div>
              <div className="text-xs text-stone-500">{vi ? 'Tổng credit:' : 'Total credit:'} {pkg.totalCredit ?? '—'}</div>
            </div>
            <div className="mt-4 space-y-2 flex-1">{(pkg.benefits || []).map((benefit, benefitIndex) => <div key={benefitIndex} className="flex gap-2 text-xs text-stone-700"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /><span>{benefit}</span></div>)}</div>
            {canManagePackages && <div className="mt-5 pt-4 border-t flex gap-2">
              <button onClick={() => setEditor({ item: pkg })} className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 rounded text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"><Edit3 className="w-3.5 h-3.5" />{vi ? 'Sửa' : 'Edit'}</button>
              <button disabled={busyId === pkg.id} onClick={() => toggleStatus(pkg)} className="flex-1 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer transition-colors"><Power className="w-3.5 h-3.5" />{pkg.status === 'active' ? (vi ? 'Tắt' : 'Disable') : (vi ? 'Bật' : 'Enable')}</button>
            </div>}
          </article>
        ))}
      </div>
      {!packages.length && <div className="bg-white border rounded p-10 text-center text-xs text-stone-500">{vi ? 'Chưa có gói thành viên.' : 'No packages.'}</div>}
      {editor && <PackageModal item={editor.item} language={language} apiMode={apiEnabled} onClose={() => setEditor(null)} onSave={save} />}
    </div>
  );
}
