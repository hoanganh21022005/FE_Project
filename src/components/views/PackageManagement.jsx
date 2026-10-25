import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Edit3, Package, Plus, Power, RefreshCw, X } from 'lucide-react';
import { useSCMS } from '../../context/SCMSContext';
import * as managerApi from '../../api/managerApi';
import { getErrorMessage } from '../../api/apiErrors';
import { formatCurrency } from '../../locales/translations';
import { isVisibleManagerPackage, loadPackageManagementData, packagesForType, subjectPriceForType, subjectsWithNonzeroPrice, unclassifiedPackages } from '../../api/packagePricing';
import {
  buildPackageFormPayload,
  packageFormFromItem,
  packageStatusForApi,
  validatePackageForm,
} from '../../api/packageForm';

const money = (value, language) => value == null
  ? (language === 'vi' ? 'Chưa có dữ liệu' : 'Not available')
  : formatCurrency(value, language);

function PackageModal({ item, defaultType, language, onClose, onSave }) {
  const initial = packageFormFromItem(item, { defaultType });
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
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-label={item ? (vi ? 'Chỉnh sửa gói' : 'Edit package') : (vi ? 'Tạo gói mới' : 'Create package')} className="w-full max-w-xl rounded-lg bg-white shadow-xl border border-stone-200">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-sm font-bold">{item ? (vi ? 'Chỉnh sửa gói' : 'Edit package') : (vi ? 'Tạo gói mới' : 'Create package')}</h3>
          <button type="button" disabled={saving} onClick={onClose} aria-label={vi ? 'Đóng' : 'Close'}><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && <div role="alert" className="p-2 rounded border border-rose-200 bg-rose-50 text-xs text-rose-700">{error}</div>}
          <label className="block text-xs font-bold">{vi ? 'Tên gói' : 'Package name'}<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={fieldClass} /></label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-bold">{vi ? 'Loại gói' : 'Package type'}
              <select required value={form.packageType} onChange={e => setForm({ ...form, packageType: e.target.value })} className={fieldClass}>
                <option value="" disabled>{vi ? 'Chọn loại gói' : 'Choose a type'}</option>
                <option value="Normal">Normal</option>
                <option value="Advanced">Advanced</option>
              </select>
            </label>
            <label className="block text-xs font-bold">{vi ? 'Thời hạn (ngày)' : 'Duration (days)'}
              <input required min="1" step="1" type="number" value={form.durationDays ?? ''} onChange={e => setForm({ ...form, durationDays: e.target.value })} className={fieldClass} />
            </label>
            <label className="block text-xs font-bold">{vi ? 'Giá gói (VNĐ)' : 'Package price (VND)'}
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
            <select required value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={fieldClass}>
              <option value="" disabled>{vi ? 'Chọn trạng thái' : 'Choose a status'}</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
        <div className="p-4 border-t flex justify-end gap-2">
          <button type="button" disabled={saving} onClick={onClose} className="px-3 py-2 bg-stone-100 rounded text-xs font-bold disabled:opacity-50">{vi ? 'Hủy' : 'Cancel'}</button>
          <button disabled={saving} className="px-3 py-2 bg-stone-900 text-white rounded text-xs font-bold disabled:opacity-50">{saving ? (vi ? 'Đang lưu…' : 'Saving…') : (vi ? 'Lưu' : 'Save')}</button>
        </div>
      </form>
    </div>
  );
}

function PackageCard({ pkg, language, apiMode, canManage, busy, onEdit, onToggle }) {
  const vi = language === 'vi';
  const active = pkg.status === 'active';
  return (
    <article className="flex min-w-0 flex-col rounded-lg border border-stone-200 bg-white p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#BA0000]">{pkg.packageType || (vi ? 'Chưa phân loại' : 'Unclassified')} · ID {pkg.id}</p>
          <h4 className="mt-1 break-words text-base font-bold text-[#181818]">{vi ? (pkg.nameVi || pkg.name) : pkg.name}</h4>
        </div>
        <span className={active ? 'shrink-0 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700' : 'shrink-0 rounded border border-stone-200 bg-stone-100 px-2 py-1 text-[10px] font-bold uppercase text-stone-600'}>{pkg.status || '—'}</span>
      </div>
      <div className="mt-4 min-w-0 space-y-1 rounded border border-stone-200 bg-stone-50 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">{vi ? 'Giá gói thành viên' : 'Membership package price'}</p>
        <p className="break-words text-xl font-bold tabular-nums text-[#181818]">{money(pkg.price, language)}</p>
        <p className="text-xs text-stone-500">{vi ? 'Thời hạn:' : 'Duration:'} {pkg.durationDays != null ? String(pkg.durationDays) + (vi ? ' ngày' : ' days') : !apiMode && pkg.durationMonths != null ? String(pkg.durationMonths) + (vi ? ' tháng' : ' months') : '—'}</p>
        <p className="text-xs text-stone-500">{vi ? 'Tổng credit:' : 'Total credit:'} {pkg.totalCredit ?? '—'}</p>
      </div>
      <div className="mt-4 flex-1 space-y-2">{(pkg.benefits || []).map((benefit, index) => <p key={String(pkg.id) + '-benefit-' + index} className="flex gap-2 text-xs text-stone-700"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /><span className="break-words">{benefit}</span></p>)}</div>
      {canManage && <div className="mt-5 flex gap-2 border-t pt-4">
        <button type="button" onClick={() => onEdit(pkg)} className="flex min-h-10 flex-1 items-center justify-center gap-1 rounded bg-stone-100 text-xs font-bold hover:bg-stone-200"><Edit3 className="h-3.5 w-3.5" />{vi ? 'Sửa' : 'Edit'}</button>
        <button type="button" disabled={busy} onClick={() => onToggle(pkg)} className="flex min-h-10 flex-1 items-center justify-center gap-1 rounded bg-stone-100 text-xs font-bold hover:bg-stone-200 disabled:opacity-50"><Power className="h-3.5 w-3.5" />{active ? (vi ? 'Tắt' : 'Disable') : (vi ? 'Bật' : 'Enable')}</button>
      </div>}
    </article>
  );
}

export function PackageManagement() {
  const { packages, subjects, createPackage, updatePackage, updatePackageStatus, showToast, t, language, apiEnabled, currentUser } = useSCMS();
  const [activeType, setActiveType] = useState('Normal');
  const [editor, setEditor] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [apiSubjects, setApiSubjects] = useState([]);
  const [apiPackages, setApiPackages] = useState([]);
  const [subjectLoaded, setSubjectLoaded] = useState(false);
  const [packageLoaded, setPackageLoaded] = useState(false);
  const [subjectLoading, setSubjectLoading] = useState(apiEnabled);
  const [packageLoading, setPackageLoading] = useState(apiEnabled);
  const [subjectError, setSubjectError] = useState('');
  const [packageError, setPackageError] = useState('');
  const requestId = useRef(0);
  const vi = language === 'vi';
  const canManagePackages = !apiEnabled || currentUser?.authorities?.includes('MANAGE_PACKAGES') || currentUser?.authorities?.includes('*');

  const refresh = useCallback(async () => {
    if (!apiEnabled) return;
    const id = ++requestId.current;
    setSubjectLoading(true);
    setPackageLoading(true);
    await loadPackageManagementData(managerApi, (result) => {
      if (id !== requestId.current) return;
      if (result.status === 'fulfilled') {
        setApiSubjects(result.value);
        setSubjectLoaded(true);
        setSubjectError('');
      } else setSubjectError(getErrorMessage(result.reason));
      setSubjectLoading(false);
    }, (result) => {
      if (id !== requestId.current) return;
      if (result.status === 'fulfilled') {
        setApiPackages(result.value);
        setPackageLoaded(true);
        setPackageError('');
      } else setPackageError(getErrorMessage(result.reason));
      setPackageLoading(false);
    });
  }, [apiEnabled]);

  useEffect(() => {
    refresh();
    return () => { requestId.current += 1; };
  }, [refresh]);

  const visibleSubjects = apiEnabled ? apiSubjects : subjects;
  const pricedSubjects = subjectsWithNonzeroPrice(visibleSubjects, activeType);
  const visiblePackages = (apiEnabled ? apiPackages : packages).filter(isVisibleManagerPackage);
  const filteredPackages = packagesForType(visiblePackages, activeType);
  const unclassified = unclassifiedPackages(visiblePackages);

  const save = async (data) => {
    const saved = editor.item ? await updatePackage(editor.item.id, data) : await createPackage(data);
    if (apiEnabled) {
      setApiPackages((previous) => editor.item
        ? previous.map((item) => String(item.id) === String(saved.id) ? saved : item)
        : [saved, ...previous]);
    }
    showToast(vi ? 'Đã lưu gói thành viên.' : 'Package saved.');
  };

  const toggleStatus = async (item) => {
    setBusyId(item.id);
    try {
      const updated = await updatePackageStatus(item.id, packageStatusForApi(item.status));
      if (apiEnabled) setApiPackages((previous) => previous.map((entry) => String(entry.id) === String(updated.id) ? updated : entry));
      showToast(vi ? 'Đã cập nhật trạng thái gói.' : 'Package status updated.');
    } catch (error) {
      showToast(getErrorMessage(error), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const renderCards = (items) => <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">{items.map((pkg) => <PackageCard key={pkg.id} pkg={pkg} language={language} apiMode={apiEnabled} canManage={canManagePackages} busy={busyId === pkg.id} onEdit={(item) => setEditor({ item })} onToggle={toggleStatus} />)}</div>;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded bg-stone-100 p-2"><Package className="h-5 w-5 text-[#BA0000]" /></div>
          <div><h2 className="text-lg font-bold text-[#181818]">{t('packages')}</h2></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {apiEnabled && <button type="button" disabled={subjectLoading || packageLoading} onClick={refresh} className="inline-flex min-h-10 items-center gap-2 rounded border border-stone-300 px-3 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-50"><RefreshCw className="h-4 w-4" />{vi ? 'Tải lại' : 'Refresh'}</button>}
          {canManagePackages && <button type="button" onClick={() => setEditor({ item: null })} className="inline-flex min-h-10 items-center gap-2 rounded bg-[#BA0000] px-3.5 text-xs font-bold text-white hover:bg-[#8E0000]"><Plus className="h-4 w-4" />{vi ? 'Tạo gói mới' : 'Create package'}</button>}
        </div>
      </header>

      <div role="tablist" aria-label={vi ? 'Loại gói thành viên' : 'Membership package type'} className="flex gap-2 border-b border-stone-200">
        {['Normal', 'Advanced'].map((type) => <button key={type} type="button" role="tab" aria-selected={activeType === type} aria-controls="package-type-panel" onClick={() => setActiveType(type)} className={activeType === type ? 'min-h-11 border-b-2 border-[#BA0000] px-5 text-sm font-bold text-[#BA0000]' : 'min-h-11 border-b-2 border-transparent px-5 text-sm font-bold text-stone-500 hover:text-stone-900'}>{type}</button>)}
      </div>

      <div id="package-type-panel" role="tabpanel" className="space-y-6">
        <section className="overflow-hidden rounded-lg border border-stone-200 bg-white" aria-labelledby="subject-pricing-title">
          <div className="border-b border-stone-200 p-5">
            <h3 id="subject-pricing-title" className="text-base font-bold text-stone-900">{vi ? 'Học phí theo môn' : 'Subject tuition'} · {activeType}</h3>
          </div>
          <div className="p-5">
            {subjectError && <p role="alert" className="mb-4 rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{vi ? 'Không tải được học phí: ' : 'Could not load tuition: '}{subjectError}{subjectLoaded && (vi ? ' Dữ liệu đang hiển thị là lần tải trước.' : ' Showing previously loaded data.')}</p>}
            {subjectLoading && !subjectLoaded ? <p role="status" className="text-sm text-stone-500">{vi ? 'Đang tải học phí…' : 'Loading tuition…'}</p>
              : pricedSubjects.length === 0 ? <p className="py-8 text-center text-sm text-stone-500">{subjectError ? (vi ? 'Chưa có dữ liệu học phí đã tải.' : 'No tuition data loaded yet.') : (vi ? 'Chưa có môn học có học phí khác 0 ₫.' : 'No subjects with tuition above 0.')}</p>
                : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
                  {pricedSubjects.map((subject) => <article key={subject.id} className="min-w-0 rounded-lg border border-stone-200 bg-stone-50 p-4">
                    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h4 className="break-words text-sm font-bold text-stone-900">{subject.name || '—'}</h4>{subject.outdoor != null && <p className="mt-1 text-[11px] text-stone-500">{subject.outdoor ? 'Outdoor' : 'Indoor'}</p>}</div><span className={subject.status === 'active' ? 'shrink-0 rounded bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase text-emerald-700' : 'shrink-0 rounded bg-stone-200 px-2 py-1 text-[10px] font-bold uppercase text-stone-600'}>{subject.status || '—'}</span></div>
                    <p className="mt-4 text-[10px] font-bold uppercase tracking-wide text-stone-500">{vi ? 'Học phí' : 'Tuition'} {activeType}</p>
                    <p className="mt-1 break-words text-lg font-bold tabular-nums text-[#BA0000]">{money(subjectPriceForType(subject, activeType), language)}</p>
                  </article>)}
                </div>}
          </div>
        </section>

        <section className="space-y-4" aria-labelledby="package-list-title">
          <div><h3 id="package-list-title" className="text-base font-bold text-stone-900">{vi ? 'Gói thành viên đang cấu hình' : 'Configured membership packages'} · {activeType}</h3></div>
          {packageError && <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{vi ? 'Không tải được gói: ' : 'Could not load packages: '}{packageError}{packageLoaded && (vi ? ' Dữ liệu đang hiển thị là lần tải trước.' : ' Showing previously loaded data.')}</p>}
          {packageLoading && !packageLoaded ? <p role="status" className="rounded-lg border bg-white p-8 text-center text-sm text-stone-500">{vi ? 'Đang tải gói thành viên…' : 'Loading packages…'}</p>
            : filteredPackages.length === 0 ? <p className="rounded-lg border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">{packageError && !packageLoaded ? (vi ? 'Chưa có dữ liệu Package đã tải.' : 'No package data loaded yet.') : (vi ? 'Chưa có gói ' + activeType + '.' : 'No ' + activeType + ' packages.')}</p>
              : renderCards(filteredPackages)}
        </section>
      </div>

      {unclassified.length > 0 && <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4" aria-labelledby="unclassified-title">
        <div><h3 id="unclassified-title" className="text-sm font-bold text-amber-950">{vi ? 'Gói chưa phân loại' : 'Unclassified packages'} ({unclassified.length})</h3><p className="mt-1 text-xs text-amber-900">{vi ? 'Package thiếu packageType hoặc loại không hợp lệ; không tự gán vào Normal/Advanced.' : 'These packages have no valid packageType and are not assigned automatically.'}</p></div>
        {renderCards(unclassified)}
      </section>}

      {editor && <PackageModal key={editor.item?.id ?? 'new-' + activeType} item={editor.item} defaultType={activeType} language={language} onClose={() => setEditor(null)} onSave={save} />}
    </div>
  );
}
