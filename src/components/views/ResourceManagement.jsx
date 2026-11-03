import React, { useState } from 'react';
import { BookOpen, DoorOpen, Edit3, Plus, Trash2, X } from 'lucide-react';
import { useSCMS } from '../../context/SCMSContext';
import { getErrorMessage } from '../../api/apiErrors';
import { formatCurrency } from '../../locales/translations';
import { buildRoomRequest, buildSubjectRequest, isZeroOrMissingSubjectPrice } from '../../api/resourceRequests';

const emptySubject = {
  name: '', description: '', slug: '', normalPrice: '', advancedPrice: '', status: 'active',
};
const emptyRoom = {
  name: '', location: '', capacity: 1, status: 'available', facilityType: 'Indoor',
};

function resourceErrorMessage(error, language) {
  const message = getErrorMessage(error);
  if (/future scheduled sessions|reassign or cancel/i.test(message)) {
    return `${message} ${language === 'vi'
      ? 'Vui lòng xử lý các buổi học đã lên lịch trước khi đổi trạng thái phòng.'
      : 'Resolve the scheduled sessions before changing this room status.'}`;
  }
  return message;
}

function subjectPriceWarning(language) {
  return language === 'vi'
    ? 'Bộ môn đang Active nhưng một hoặc cả hai mức giá bằng 0 hoặc để trống. Backend hiện mặc định giá thiếu thành 0 và chưa quy định giá phải lớn hơn 0. Bạn có muốn tiếp tục?'
    : 'This subject is Active with a zero or blank price. The backend currently defaults missing prices to 0 and does not require prices above 0. Continue?';
}

function ResourceModal({ type, item, language, onClose, onSave }) {
  const isRoom = type === 'room';
  const [form, setForm] = useState(() => item
    ? { ...item, normalPrice: item.normalPrice ?? '', advancedPrice: item.advancedPrice ?? '' }
    : { ...(isRoom ? emptyRoom : emptySubject) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setError('');

    let request;
    try {
      request = isRoom ? buildRoomRequest(form) : buildSubjectRequest(form);
    } catch (validationError) {
      setError(validationError.message);
      return;
    }

    if (!isRoom && request.status.toLowerCase() === 'active' && isZeroOrMissingSubjectPrice(form)) {
      if (!window.confirm(subjectPriceWarning(language))) return;
    }

    setSaving(true);
    try {
      await onSave(request);
      onClose();
    } catch (saveError) {
      setError(resourceErrorMessage(saveError, language));
    } finally {
      setSaving(false);
    }
  };

  const label = (vi, en) => language === 'vi' ? vi : en;
  const fieldClass = 'mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-xl rounded-lg bg-white border border-slate-200 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-900">
            {item ? label(`Chỉnh sửa ${isRoom ? 'phòng' : 'bộ môn'}`, `Edit ${isRoom ? 'room' : 'subject'}`) : label(`Thêm ${isRoom ? 'phòng' : 'bộ môn'}`, `Create ${isRoom ? 'room' : 'subject'}`)}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && <div role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">{error}</div>}

          <label className="block text-xs font-bold text-slate-700">
            {label(isRoom ? 'Tên sân/phòng *' : 'Tên bộ môn *', isRoom ? 'Room name *' : 'Subject name *')}
            <input required value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })} className={fieldClass} />
          </label>

          {isRoom ? (
            <>
              <label className="block text-xs font-bold text-slate-700">
                {label('Vị trí', 'Location')}
                <input value={form.location ?? ''} onChange={e => setForm({ ...form, location: e.target.value })} className={fieldClass} />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs font-bold text-slate-700">
                  {label('Sức chứa *', 'Capacity *')}
                  <input required min="1" step="1" type="number" value={form.capacity ?? ''} onChange={e => setForm({ ...form, capacity: e.target.value })} className={fieldClass} />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  {label('Loại hình *', 'Facility type *')}
                  <select required value={form.facilityType ?? ''} onChange={e => setForm({ ...form, facilityType: e.target.value })} className={fieldClass}>
                    <option value="" disabled>{label('Chọn loại hình', 'Choose a facility type')}</option>
                    <option value="Indoor">Indoor</option>
                    <option value="Outdoor">Outdoor</option>
                  </select>
                </label>
              </div>
              <label className="block text-xs font-bold text-slate-700">
                {label('Trạng thái', 'Status')}
                <select required value={form.status ?? ''} onChange={e => setForm({ ...form, status: e.target.value })} className={fieldClass}>
                  <option value="available">Available</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="block text-xs font-bold text-slate-700">
                Slug
                <input value={form.slug ?? ''} onChange={e => setForm({ ...form, slug: e.target.value })} className={fieldClass} />
              </label>
              <label className="block text-xs font-bold text-slate-700">
                {label('Mô tả', 'Description')}
                <textarea rows="3" value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} className={fieldClass} />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs font-bold text-slate-700">
                  Học phí Normal (VNĐ)
                  <input min="0" step="0.01" type="number" value={form.normalPrice ?? ''} onChange={e => setForm({ ...form, normalPrice: e.target.value })} className={fieldClass} />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  {label('Giá gói Advanced (VNĐ)', 'Advanced package price (VND)')}
                  <input min="0" step="0.01" type="number" value={form.advancedPrice ?? ''} onChange={e => setForm({ ...form, advancedPrice: e.target.value })} className={fieldClass} />
                </label>
              </div>
              <label className="block text-xs font-bold text-slate-700">
                {label('Trạng thái', 'Status')}
                <select required value={form.status ?? 'active'} onChange={e => setForm({ ...form, status: e.target.value })} className={fieldClass}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              {isZeroOrMissingSubjectPrice(form) && form.status?.toLowerCase() === 'active' && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                  {label('Một mức giá bằng 0 hoặc để trống. Backend hiện chưa yêu cầu giá lớn hơn 0; khi bỏ trống, giá có thể được lưu thành 0.', 'A price is zero or blank. The backend does not currently require a price above 0; a blank price may be stored as 0.')}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-bold rounded bg-slate-100">{label('Hủy', 'Cancel')}</button>
          <button disabled={saving} className="px-3 py-2 text-xs font-bold rounded bg-slate-900 text-white disabled:opacity-50">
            {saving ? label('Đang lưu…', 'Saving…') : label('Lưu', 'Save')}
          </button>
        </div>
      </form>
    </div>
  );
}

export function ResourceManagement() {
  const {
    subjects, rooms, createSubject, updateSubject, deleteSubject,
    createRoom, updateRoom, updateRoomStatus, showToast, language,
  } = useSCMS();
  const [tab, setTab] = useState('subjects');
  const [editor, setEditor] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const label = (vi, en) => language === 'vi' ? vi : en;
  const notifyError = error => showToast(resourceErrorMessage(error, language), 'error');

  const save = async (data) => {
    const contextData = {
      ...data,
      status: String(data.status ?? '').toLowerCase(),
    };
    if (editor.type === 'subject') {
      await (editor.item ? updateSubject(editor.item.id, contextData) : createSubject(contextData));
    } else {
      await (editor.item ? updateRoom(editor.item.id, contextData) : createRoom(contextData));
    }
    showToast(label('Đã lưu dữ liệu thành công.', 'Saved successfully.'));
  };

  const removeSubject = async (item) => {
    if (!window.confirm(label(`Xóa bộ môn “${item.name}”?`, `Delete subject “${item.name}”?`))) return;
    setBusyId(item.id);
    try {
      await deleteSubject(item.id);
      showToast(label('Đã xóa bộ môn.', 'Subject deleted.'));
    } catch (error) {
      notifyError(error);
    } finally {
      setBusyId(null);
    }
  };

  const changeRoomStatus = async (item, status) => {
    if (status === item.status) return;
    setBusyId(item.id);
    try {
      await updateRoomStatus(item.id, status);
      showToast(label('Đã cập nhật trạng thái phòng.', 'Room status updated.'));
    } catch (error) {
      notifyError(error);
    } finally {
      setBusyId(null);
    }
  };

  const currency = value => value == null ? '—' : formatCurrency(value, language);
  const empty = tab === 'subjects' ? subjects.length === 0 : rooms.length === 0;

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{label('Bộ môn & sân/phòng tập', 'Subjects & facilities')}</h2>
          <p className="text-xs text-slate-500 mt-1">{label('Quản lý bộ môn, học phí và cơ sở vật chất của trung tâm.', 'Manage subjects, prices, and center facilities.')}</p>
        </div>
        <button onClick={() => setEditor({ type: tab === 'subjects' ? 'subject' : 'room', item: null })} className="px-3.5 py-2 bg-slate-900 text-white rounded text-xs font-bold flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> {label(`Thêm ${tab === 'subjects' ? 'bộ môn' : 'sân/phòng'}`, `Add ${tab === 'subjects' ? 'subject' : 'facility'}`)}
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('subjects')} className={`px-4 py-2 rounded text-xs font-bold flex gap-2 cursor-pointer ${tab === 'subjects' ? 'bg-brand-primary text-white shadow-xs' : 'bg-white border border-slate-200 text-stone-700 hover:bg-slate-50'}`}><BookOpen className="w-4 h-4" /> Subjects ({subjects.length})</button>
        <button onClick={() => setTab('rooms')} className={`px-4 py-2 rounded text-xs font-bold flex gap-2 cursor-pointer ${tab === 'rooms' ? 'bg-brand-primary text-white shadow-xs' : 'bg-white border border-slate-200 text-stone-700 hover:bg-slate-50'}`}><DoorOpen className="w-4 h-4" /> Rooms ({rooms.length})</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        {empty ? (
          <div className="p-8 text-center text-xs text-slate-500">{label('Chưa có dữ liệu.', 'No data.')}</div>
        ) : tab === 'subjects' ? (
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase">
              <tr>
                <th className="p-3">{label('Bộ môn', 'Subject')}</th><th className="p-3">Slug</th>
                <th className="p-3">Normal</th><th className="p-3">Advanced</th>
                <th className="p-3">Indoor/Outdoor</th><th className="p-3">{label('Trạng thái', 'Status')}</th><th className="p-3">{label('Thao tác', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subjects.map(item => (
                <tr key={item.id}>
                  <td className="p-3"><div className="font-bold text-slate-900">{item.name}</div><div className="text-slate-500 mt-1">{item.description || '—'}</div></td>
                  <td className="p-3 font-mono">{item.slug || '—'}</td>
                  <td className="p-3 tabular-nums">{currency(item.normalPrice)}</td>
                  <td className="p-3 tabular-nums">{currency(item.advancedPrice)}</td>
                  <td className="p-3">{item.outdoor == null ? '—' : item.outdoor ? 'Outdoor' : 'Indoor'}</td>
                  <td className="p-3"><span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${item.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.status || '—'}</span></td>
                  <td className="p-3"><div className="flex gap-2">
                    <button onClick={() => setEditor({ type: 'subject', item })} className="p-2 rounded bg-slate-100" title="Edit"><Edit3 className="w-4 h-4" /></button>
                    <button disabled={busyId === item.id} onClick={() => removeSubject(item)} className="p-2 rounded bg-rose-50 text-rose-700 disabled:opacity-50" title="Delete"><Trash2 className="w-4 h-4" /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase">
              <tr><th className="p-3">{label('Sân/phòng', 'Facility')}</th><th className="p-3">{label('Vị trí', 'Location')}</th><th className="p-3">{label('Sức chứa', 'Capacity')}</th><th className="p-3">Facility Type</th><th className="p-3">{label('Trạng thái', 'Status')}</th><th className="p-3">{label('Thao tác', 'Actions')}</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rooms.map(item => (
                <tr key={item.id}>
                  <td className="p-3 font-bold text-slate-900">{item.roomCode ? `${String(item.roomCode).trim()} - ${item.name || `Sân #${item.id}`}` : (item.name || '—')}</td>
                  <td className="p-3">{item.location || '—'}</td>
                  <td className="p-3 tabular-nums">{item.capacity ?? '—'}</td>
                  <td className="p-3">{item.facilityType || (item.outdoor == null ? '—' : item.outdoor ? 'Outdoor' : 'Indoor')}</td>
                  <td className="p-3"><span className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${item.status === 'available' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.status || '—'}</span></td>
                  <td className="p-3"><div className="flex items-center gap-2">
                    <button onClick={() => setEditor({ type: 'room', item })} className="p-2 rounded bg-slate-100" title="Edit"><Edit3 className="w-4 h-4" /></button>
                    <select aria-label={label(`Trạng thái ${item.name}`, `Status for ${item.name}`)} disabled={busyId === item.id} value={item.status || ''} onChange={event => changeRoomStatus(item, event.target.value)} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50">
                      <option value="available">Available</option><option value="maintenance">Maintenance</option><option value="closed">Closed</option>
                    </select>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editor && <ResourceModal type={editor.type} item={editor.item} language={language} onClose={() => setEditor(null)} onSave={save} />}
    </div>
  );
}
