import React, { useState } from 'react';
import { BookOpen, DoorOpen, Edit3, Plus, Power, Trash2, X } from 'lucide-react';
import { useSCMS } from '../../context/SCMSContext';
import { getErrorMessage } from '../../api/apiErrors';

const emptySubject = { name: '', description: '' };
const emptyRoom = { name: '', location: '', capacity: 1, status: 'available' };

function ResourceModal({ type, item, language, onClose, onSave }) {
  const isRoom = type === 'room';
  const [form, setForm] = useState(item || (isRoom ? emptyRoom : emptySubject));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({ ...form, ...(isRoom ? { capacity: Number(form.capacity), status: form.status || 'available' } : {}) });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-lg bg-white border border-slate-200 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-900">
            {item
              ? (language === 'vi' ? `Chỉnh sửa ${isRoom ? 'phòng' : 'bộ môn'}` : `Edit ${type}`)
              : (language === 'vi' ? `Thêm ${isRoom ? 'phòng' : 'bộ môn'}` : `Create ${type}`)}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-4">
          {error && <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">{error}</div>}
          <label className="block text-xs font-bold text-slate-700">
            {language === 'vi' ? 'Tên' : 'Name'}
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
          </label>
          {isRoom ? (
            <>
              <label className="block text-xs font-bold text-slate-700">
                {language === 'vi' ? 'Vị trí' : 'Location'}
                <input value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold text-slate-700">
                  {language === 'vi' ? 'Sức chứa' : 'Capacity'}
                  <input required min="1" type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  {language === 'vi' ? 'Trạng thái' : 'Status'}
                  <select value={form.status || 'available'} onChange={e => setForm({ ...form, status: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal">
                    <option value="available">Available</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
              </div>
            </>
          ) : (
            <label className="block text-xs font-bold text-slate-700">
              {language === 'vi' ? 'Mô tả' : 'Description'}
              <textarea rows="4" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" />
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-bold rounded bg-slate-100">{language === 'vi' ? 'Hủy' : 'Cancel'}</button>
          <button disabled={saving} className="px-3 py-2 text-xs font-bold rounded bg-slate-900 text-white disabled:opacity-50">{saving ? '...' : (language === 'vi' ? 'Lưu' : 'Save')}</button>
        </div>
      </form>
    </div>
  );
}

export function ResourceManagement() {
  const { subjects, rooms, createSubject, updateSubject, deleteSubject, createRoom, updateRoom, updateRoomStatus, showToast, language } = useSCMS();
  const [tab, setTab] = useState('subjects');
  const [editor, setEditor] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const notifyError = error => showToast(getErrorMessage(error), 'error');
  const save = async (data) => {
    if (editor.type === 'subject') await (editor.item ? updateSubject(editor.item.id, data) : createSubject(data));
    else await (editor.item ? updateRoom(editor.item.id, data) : createRoom(data));
    showToast(language === 'vi' ? 'Đã lưu dữ liệu thành công.' : 'Saved successfully.');
  };

  const removeSubject = async (item) => {
    if (!window.confirm(language === 'vi' ? `Xóa bộ môn “${item.name}”?` : `Delete subject “${item.name}”?`)) return;
    setBusyId(item.id);
    try {
      await deleteSubject(item.id);
      showToast(language === 'vi' ? 'Đã xóa bộ môn.' : 'Subject deleted.');
    } catch (error) { notifyError(error); }
    finally { setBusyId(null); }
  };

  const toggleRoom = async (item) => {
    const status = item.status === 'available' ? 'maintenance' : 'available';
    setBusyId(item.id);
    try {
      await updateRoomStatus(item.id, status);
      showToast(language === 'vi' ? 'Đã cập nhật trạng thái phòng.' : 'Room status updated.');
    } catch (error) { notifyError(error); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{language === 'vi' ? 'Bộ môn & phòng tập' : 'Subjects & Rooms'}</h2>
          <p className="text-xs text-slate-500 mt-1">{language === 'vi' ? 'Quản lý dữ liệu nền dùng khi tạo và chỉnh sửa lớp.' : 'Manage reference data used by classes.'}</p>
        </div>
        <button onClick={() => setEditor({ type: tab === 'subjects' ? 'subject' : 'room', item: null })} className="px-3.5 py-2 bg-slate-900 text-white rounded text-xs font-bold flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> {language === 'vi' ? `Thêm ${tab === 'subjects' ? 'bộ môn' : 'phòng'}` : `Add ${tab === 'subjects' ? 'subject' : 'room'}`}
        </button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setTab('subjects')} className={`px-4 py-2 rounded text-xs font-bold flex gap-2 ${tab === 'subjects' ? 'bg-orange-600 text-white' : 'bg-white border border-slate-200'}`}><BookOpen className="w-4 h-4" /> Subjects ({subjects.length})</button>
        <button onClick={() => setTab('rooms')} className={`px-4 py-2 rounded text-xs font-bold flex gap-2 ${tab === 'rooms' ? 'bg-orange-600 text-white' : 'bg-white border border-slate-200'}`}><DoorOpen className="w-4 h-4" /> Rooms ({rooms.length})</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {tab === 'subjects' ? subjects.map(item => (
          <div key={item.id} className="p-4 border-b last:border-b-0 border-slate-100 flex items-center justify-between gap-4">
            <div><div className="text-sm font-bold text-slate-900">{item.name}</div><div className="text-xs text-slate-500 mt-1">{item.description || '—'}</div></div>
            <div className="flex gap-2">
              <button onClick={() => setEditor({ type: 'subject', item })} className="p-2 rounded bg-slate-100" title="Edit"><Edit3 className="w-4 h-4" /></button>
              <button disabled={busyId === item.id} onClick={() => removeSubject(item)} className="p-2 rounded bg-rose-50 text-rose-700 disabled:opacity-50" title="Delete"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        )) : rooms.map(item => (
          <div key={item.id} className="p-4 border-b last:border-b-0 border-slate-100 flex items-center justify-between gap-4">
            <div>
              <div className="flex gap-2 items-center"><span className="text-sm font-bold text-slate-900">{item.name}</span><span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${item.status === 'available' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.status}</span></div>
              <div className="text-xs text-slate-500 mt-1">{item.location || '—'} · {language === 'vi' ? 'Sức chứa' : 'Capacity'}: {item.capacity}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditor({ type: 'room', item })} className="p-2 rounded bg-slate-100" title="Edit"><Edit3 className="w-4 h-4" /></button>
              <button disabled={busyId === item.id} onClick={() => toggleRoom(item)} className="p-2 rounded bg-amber-50 text-amber-700 disabled:opacity-50" title="Toggle status"><Power className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
        {((tab === 'subjects' && !subjects.length) || (tab === 'rooms' && !rooms.length)) && <div className="p-8 text-center text-xs text-slate-500">{language === 'vi' ? 'Chưa có dữ liệu.' : 'No data.'}</div>}
      </div>

      {editor && <ResourceModal type={editor.type} item={editor.item} language={language} onClose={() => setEditor(null)} onSave={save} />}
    </div>
  );
}
