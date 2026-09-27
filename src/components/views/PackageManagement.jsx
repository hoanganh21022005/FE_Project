import React, { useState } from 'react';
import { CheckCircle2, Edit3, Package, Plus, Power, X } from 'lucide-react';
import { useSCMS } from '../../context/SCMSContext';
import { getErrorMessage } from '../../api/apiErrors';
import { formatCurrency } from '../../locales/translations';

const emptyPackage = { name: '', durationMonths: 1, price: 0, benefits: [], status: 'active' };

function PackageModal({ item, language, onClose, onSave }) {
  const [form, setForm] = useState(item || emptyPackage);
  const [benefitsText, setBenefitsText] = useState((item?.benefits || []).join('\n'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({ ...form, durationMonths: Number(form.durationMonths), price: Number(form.price), benefits: benefitsText.split(/\r?\n|;/).map(value => value.trim()).filter(Boolean) });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-xl rounded-lg bg-white shadow-xl border border-stone-200">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-sm font-bold">{item ? (language === 'vi' ? 'Chỉnh sửa gói' : 'Edit package') : (language === 'vi' ? 'Tạo gói mới' : 'Create package')}</h3>
          <button type="button" onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-4">
          {error && <div className="p-2 rounded border border-rose-200 bg-rose-50 text-xs text-rose-700">{error}</div>}
          <label className="block text-xs font-bold">{language === 'vi' ? 'Tên gói' : 'Package name'}<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="block mt-1 w-full border rounded px-3 py-2 font-normal" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-bold">{language === 'vi' ? 'Thời hạn (tháng)' : 'Duration (months)'}<input required min="1" type="number" value={form.durationMonths ?? 1} onChange={e => setForm({ ...form, durationMonths: e.target.value })} className="block mt-1 w-full border rounded px-3 py-2 font-normal" /></label>
            <label className="block text-xs font-bold">{language === 'vi' ? 'Giá' : 'Price'}<input required min="0" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="block mt-1 w-full border rounded px-3 py-2 font-normal" /></label>
          </div>
          <label className="block text-xs font-bold">{language === 'vi' ? 'Quyền lợi (mỗi dòng một mục)' : 'Benefits (one per line)'}<textarea rows="5" value={benefitsText} onChange={e => setBenefitsText(e.target.value)} className="block mt-1 w-full border rounded px-3 py-2 font-normal" /></label>
          <label className="block text-xs font-bold">{language === 'vi' ? 'Trạng thái' : 'Status'}<select value={form.status || 'active'} onChange={e => setForm({ ...form, status: e.target.value })} className="block mt-1 w-full border rounded px-3 py-2 font-normal"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-2 bg-stone-100 rounded text-xs font-bold">{language === 'vi' ? 'Hủy' : 'Cancel'}</button>
          <button disabled={saving} className="px-3 py-2 bg-stone-900 text-white rounded text-xs font-bold disabled:opacity-50">{saving ? '...' : (language === 'vi' ? 'Lưu' : 'Save')}</button>
        </div>
      </form>
    </div>
  );
}

export function PackageManagement() {
  const { packages, createPackage, updatePackage, updatePackageStatus, showToast, t, language } = useSCMS();
  const [editor, setEditor] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const save = async (data) => {
    if (editor.item) await updatePackage(editor.item.id, data);
    else await createPackage(data);
    showToast(language === 'vi' ? 'Đã lưu gói thành viên.' : 'Package saved.');
  };

  const toggleStatus = async (item) => {
    setBusyId(item.id);
    try {
      await updatePackageStatus(item.id, item.status === 'active' ? 'inactive' : 'active');
      showToast(language === 'vi' ? 'Đã cập nhật trạng thái gói.' : 'Package status updated.');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 rounded-lg p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-stone-100 rounded"><Package className="w-5 h-5 text-orange-600" /></div>
          <div><h2 className="text-sm font-bold">{t('packages')}</h2><p className="text-xs text-stone-500 mt-1">{language === 'vi' ? 'Tạo, chỉnh sửa và bật/tắt gói thành viên.' : 'Create, edit and activate membership packages.'}</p></div>
        </div>
        <button onClick={() => setEditor({ item: null })} className="px-3.5 py-2 bg-stone-900 text-white rounded text-xs font-bold flex items-center gap-1.5"><Plus className="w-4 h-4" />{language === 'vi' ? 'Tạo gói mới' : 'Create Package'}</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {packages.map((pkg, index) => (
          <article key={pkg.id} className="bg-white border border-stone-200 rounded-lg p-5 shadow-xs flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div><span className="text-[10px] font-bold text-orange-700 uppercase">Package {index + 1}</span><h3 className="text-base font-bold mt-1">{language === 'vi' ? (pkg.nameVi || pkg.name) : pkg.name}</h3></div>
              <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${pkg.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>{pkg.status}</span>
            </div>
            <div className="mt-4 bg-stone-50 border border-stone-200 rounded p-3"><div className="text-xl font-bold">{formatCurrency(pkg.price, language)}</div><div className="text-xs text-stone-500">{pkg.durationMonths ?? Math.round((pkg.durationDays || 0) / 30)} {language === 'vi' ? 'tháng' : 'months'}</div></div>
            <div className="mt-4 space-y-2 flex-1">{(pkg.benefits || []).map((benefit, benefitIndex) => <div key={benefitIndex} className="flex gap-2 text-xs text-stone-700"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /><span>{benefit}</span></div>)}</div>
            <div className="mt-5 pt-4 border-t flex gap-2">
              <button onClick={() => setEditor({ item: pkg })} className="flex-1 py-2 bg-stone-100 rounded text-xs font-bold flex items-center justify-center gap-1"><Edit3 className="w-3.5 h-3.5" />{language === 'vi' ? 'Sửa' : 'Edit'}</button>
              <button disabled={busyId === pkg.id} onClick={() => toggleStatus(pkg)} className="flex-1 py-2 bg-orange-50 text-orange-800 rounded text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"><Power className="w-3.5 h-3.5" />{pkg.status === 'active' ? (language === 'vi' ? 'Tắt' : 'Disable') : (language === 'vi' ? 'Bật' : 'Enable')}</button>
            </div>
          </article>
        ))}
      </div>
      {!packages.length && <div className="bg-white border rounded p-10 text-center text-xs text-stone-500">{language === 'vi' ? 'Chưa có gói thành viên.' : 'No packages.'}</div>}
      {editor && <PackageModal item={editor.item} language={language} onClose={() => setEditor(null)} onSave={save} />}
    </div>
  );
}
