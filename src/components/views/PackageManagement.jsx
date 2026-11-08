import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Package, RefreshCw } from 'lucide-react';
import { useSCMS } from '../../context/SCMSContext';
import * as managerApi from '../../api/managerApi';
import { getErrorMessage } from '../../api/apiErrors';
import { formatCurrency } from '../../locales/translations';
import { subjectPriceForType, subjectsWithNonzeroPrice } from '../../api/packagePricing';

const money = (value, language) => value == null
  ? (language === 'vi' ? 'Chưa có dữ liệu' : 'Not available')
  : formatCurrency(value, language);

export function PackageManagement() {
  const { subjects, t, language, apiEnabled } = useSCMS();
  const [activeType, setActiveType] = useState('Normal');
  const [apiSubjects, setApiSubjects] = useState([]);
  const [subjectLoaded, setSubjectLoaded] = useState(false);
  const [subjectLoading, setSubjectLoading] = useState(apiEnabled);
  const [subjectError, setSubjectError] = useState('');
  const requestId = useRef(0);
  const vi = language === 'vi';

  const refresh = useCallback(async () => {
    if (!apiEnabled) return;
    const id = ++requestId.current;
    setSubjectLoading(true);
    try {
      const result = await managerApi.getSubjects({ notifyForbidden: false });
      if (id !== requestId.current) return;
      setApiSubjects(result);
      setSubjectLoaded(true);
      setSubjectError('');
    } catch (error) {
      if (id !== requestId.current) return;
      setSubjectError(getErrorMessage(error));
    } finally {
      if (id === requestId.current) setSubjectLoading(false);
    }
  }, [apiEnabled]);

  useEffect(() => {
    refresh();
    return () => { requestId.current += 1; };
  }, [refresh]);

  const visibleSubjects = apiEnabled ? apiSubjects : subjects;
  const pricedSubjects = subjectsWithNonzeroPrice(visibleSubjects, activeType);
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded bg-stone-100 p-2"><Package className="h-5 w-5 text-brand-primary" /></div>
          <div><h2 className="text-lg font-bold text-brand-dark">{t('packages')}</h2></div>
        </div>
        {apiEnabled && <button type="button" disabled={subjectLoading} onClick={refresh} className="inline-flex min-h-10 items-center gap-2 rounded border border-stone-300 px-3 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-50"><RefreshCw className="h-4 w-4" />{vi ? 'Tải lại' : 'Refresh'}</button>}
      </header>

      <div role="tablist" aria-label={vi ? 'Loại gói thành viên' : 'Membership package type'} className="flex gap-2 border-b border-stone-200">
        {['Normal', 'Advanced'].map((type) => <button key={type} type="button" role="tab" aria-selected={activeType === type} aria-controls="package-type-panel" onClick={() => setActiveType(type)} className={activeType === type ? 'min-h-11 border-b-2 px-5 text-sm font-bold ' + (type === 'Advanced' ? 'border-brand-purple text-brand-purple-dark' : 'border-brand-primary text-brand-primary') : 'min-h-11 border-b-2 border-transparent px-5 text-sm font-bold text-stone-500 hover:text-stone-900'}>{type}</button>)}
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
                    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h4 className="break-words text-sm font-bold text-stone-900">{subject.name || '—'}</h4>{subject.outdoor != null && <p className="mt-1 text-xs text-stone-500">{subject.outdoor ? 'Outdoor' : 'Indoor'}</p>}</div><span className={subject.status === 'active' ? 'shrink-0 rounded bg-emerald-100 px-2 py-1 text-xs font-bold uppercase text-emerald-700' : 'shrink-0 rounded bg-stone-200 px-2 py-1 text-xs font-bold uppercase text-stone-600'}>{subject.status || '—'}</span></div>
                    <p className="mt-4 text-xs font-bold uppercase tracking-wide text-stone-500">{vi ? 'Học phí' : 'Tuition'} {activeType}</p>
                    <p className="mt-1 break-words text-lg font-bold tabular-nums text-brand-primary">{money(subjectPriceForType(subject, activeType), language)}</p>
                  </article>)}
                </div>}
          </div>
        </section>
      </div>
    </div>
  );
}
