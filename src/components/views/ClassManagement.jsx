import React, { useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { formatDate } from '../../locales/translations';
import { StatusBadge } from '../common/Badge';
import { NewClassModal } from '../modals/NewClassModal';
import { Calendar, CalendarPlus, Users, Clock, MapPin, Search, Edit3, UserRoundCheck, X } from 'lucide-react';

function EditClassModal({ item, subjects, staff, language, onClose, onSave }) {
  const coaches = staff.filter(person => person.role === 'coach' && person.status === 'active');
  const [form, setForm] = useState(item);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try { await onSave(form); onClose(); }
    catch (err) { setError(err?.message || String(err)); }
    finally { setSaving(false); }
  };
  const selectedCoachValue = coaches.find(coach => (
    String(coach.id) === String(form.coachId)
    || String(coach.id).match(/(\d+)$/)?.[1] === String(form.coachId)
  ))?.id || form.coachId || '';
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white w-full max-w-xl rounded-lg shadow-xl border border-slate-200">
        <div className="p-4 border-b flex justify-between"><h3 className="text-sm font-bold">{language === 'vi' ? 'Chỉnh sửa lớp học' : 'Edit class'}</h3><button type="button" onClick={onClose}><X className="w-4 h-4" /></button></div>
        <div className="p-4 space-y-3">
          {error && <div className="p-2 bg-rose-50 text-rose-700 border border-rose-200 rounded text-xs">{error}</div>}
          <label className="block text-xs font-bold">{language === 'vi' ? 'Tên lớp' : 'Class name'}<input required value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value, nameVi: e.target.value })} className="mt-1 block w-full border rounded px-3 py-2 font-normal" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-bold">{language === 'vi' ? 'Bộ môn' : 'Subject'}<select required value={form.subjectId || ''} onChange={e => setForm({ ...form, subjectId: e.target.value, category: subjects.find(s => String(s.id) === e.target.value)?.name })} className="mt-1 block w-full border rounded px-3 py-2 font-normal">{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
            <label className="block text-xs font-bold">Coach<select value={selectedCoachValue} onChange={e => setForm({ ...form, coachId: e.target.value, coachName: coaches.find(c => String(c.id) === e.target.value)?.name })} className="mt-1 block w-full border rounded px-3 py-2 font-normal"><option value="">—</option>{coaches.map(coach => <option key={coach.id} value={coach.id}>{coach.name}</option>)}</select></label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="block text-xs font-bold">{language === 'vi' ? 'Sức chứa' : 'Capacity'}<input required min="1" type="number" value={form.capacity || 1} onChange={e => setForm({ ...form, capacity: Number(e.target.value) })} className="mt-1 block w-full border rounded px-3 py-2 font-normal" /></label>
            <label className="block text-xs font-bold">{language === 'vi' ? 'Bắt đầu' : 'Start'}<input type="date" value={form.startDate || ''} onChange={e => setForm({ ...form, startDate: e.target.value, date: e.target.value })} className="mt-1 block w-full border rounded px-3 py-2 font-normal" /></label>
            <label className="block text-xs font-bold">{language === 'vi' ? 'Kết thúc' : 'End'}<input type="date" value={form.endDate || ''} onChange={e => setForm({ ...form, endDate: e.target.value })} className="mt-1 block w-full border rounded px-3 py-2 font-normal" /></label>
          </div>
          <label className="block text-xs font-bold">{language === 'vi' ? 'Trạng thái' : 'Status'}<select value={form.status || 'published'} onChange={e => {
            const apiStatuses = { published: 'Open', completed: 'Closed', cancelled: 'Cancelled' };
            setForm({ ...form, status: e.target.value, apiStatus: apiStatuses[e.target.value] });
          }} className="mt-1 block w-full border rounded px-3 py-2 font-normal"><option value="published">Open / Ongoing</option><option value="completed">Closed</option><option value="cancelled">Cancelled</option></select></label>
        </div>
        <div className="p-4 border-t flex justify-end gap-2"><button type="button" onClick={onClose} className="px-3 py-2 bg-slate-100 rounded text-xs font-bold">{language === 'vi' ? 'Hủy' : 'Cancel'}</button><button disabled={saving} className="px-3 py-2 bg-slate-900 text-white rounded text-xs font-bold disabled:opacity-50">{saving ? '...' : (language === 'vi' ? 'Lưu' : 'Save')}</button></div>
      </form>
    </div>
  );
}

export function ClassManagement() {
  const { classes, subjects, staff, updateClass, assignCoach, showToast, t, language } = useSCMS();
  const [viewMode, setViewMode] = useState('list');
  const [isNewClassOpen, setIsNewClassOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingClass, setEditingClass] = useState(null);
  const [assigningId, setAssigningId] = useState(null);

  const saveClass = async (data) => {
    await updateClass(data.id, data);
    showToast(language === 'vi' ? 'Đã cập nhật lớp học.' : 'Class updated.');
  };

  const changeCoach = async (classId, coachId) => {
    if (!coachId) return;
    setAssigningId(classId);
    try {
      await assignCoach(classId, coachId);
      showToast(language === 'vi' ? 'Đã phân công huấn luyện viên.' : 'Coach assigned.');
    } catch (error) {
      showToast(error?.message || String(error), 'error');
    } finally {
      setAssigningId(null);
    }
  };

  const filteredClasses = classes.filter(c =>
    (c.nameVi || c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.coachName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calendarYear = 2026;
  const calendarMonth = 8;
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOffset = (new Date(calendarYear, calendarMonth, 1).getDay() + 6) % 7;
  const calendarCellCount = Math.ceil((firstDayOffset + daysInMonth) / 7) * 7;
  const calendarCells = Array.from({ length: calendarCellCount }, (_, index) => {
    const day = index - firstDayOffset + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
  const weekdays = language === 'vi'
    ? ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-lg shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 text-slate-800 rounded border border-slate-200">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">{t('classes')}</h2>
            <p className="text-xs text-slate-500">{language === 'vi' ? 'Quản lý lớp nhóm, phân công huấn luyện viên và sức chứa phòng tập' : 'Manage group classes, coach assignments and room capacity'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Toggle List / Calendar View */}
          <div className="bg-slate-100 p-0.5 rounded border border-slate-200 flex items-center">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                viewMode === 'list' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'vi' ? 'Danh sách' : 'List'}
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                viewMode === 'calendar' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'vi' ? 'Lịch tháng' : 'Calendar'}
            </button>
          </div>

          <button
            onClick={() => setIsNewClassOpen(true)}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs whitespace-nowrap"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            <span>{t('createClass')}</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder={language === 'vi' ? 'Tìm theo tên lớp, bộ môn, huấn luyện viên...' : 'Search by class, category or coach...'}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-slate-50 border border-slate-300 rounded pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
        />
      </div>

      {/* Content */}
      {viewMode === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredClasses.map(cls => (
            <div key={cls.id} className="bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-5 shadow-xs transition-all space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200 uppercase">
                    {cls.category}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 mt-1.5">{language === 'vi' ? cls.nameVi : cls.name}</h3>
                </div>
                <StatusBadge type="class" status={cls.status} />
              </div>

              <div className="space-y-2 text-xs text-slate-700 bg-slate-50 p-3 rounded border border-slate-200">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span className="tabular-nums">{formatDate(cls.date, language)} &bull; {cls.startTime} ({cls.durationMinutes} {language === 'vi' ? 'phút' : 'min'})</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>{language === 'vi' ? (cls.roomVi || cls.room) : cls.room}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>{language === 'vi' ? 'Sức chứa' : 'Capacity'}: <strong className={`tabular-nums ${cls.enrolledCount >= cls.capacity ? 'text-rose-700' : 'text-slate-900'}`}>{cls.enrolledCount}/{cls.capacity}</strong> {language === 'vi' ? 'học viên' : 'members'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                <div className="text-slate-600">{language === 'vi' ? 'Huấn luyện viên' : 'Coach'}: <strong className="text-slate-900">{cls.coachName}</strong></div>
                <span className="text-[10px] text-blue-800 font-bold bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                  Tier {cls.minTierRequired}+
                </span>
              </div>
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button onClick={() => setEditingClass(cls)} className="px-2.5 py-1.5 bg-slate-100 rounded text-xs font-bold flex items-center gap-1"><Edit3 className="w-3.5 h-3.5" />{language === 'vi' ? 'Sửa' : 'Edit'}</button>
                <label className="flex-1 relative">
                  <UserRoundCheck className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-500" />
                  <select disabled={assigningId === cls.id} value="" onChange={e => changeCoach(cls.id, e.target.value)} className="w-full pl-7 pr-2 py-1.5 border border-slate-300 rounded text-xs bg-white disabled:opacity-50">
                    <option value="">{language === 'vi' ? 'Phân công coach…' : 'Assign coach…'}</option>
                    {staff.filter(person => person.role === 'coach' && person.status === 'active').map(coach => <option key={coach.id} value={coach.id}>{coach.name}</option>)}
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Calendar Matrix Grid View */
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs">
          <div className="text-xs font-bold text-slate-700 uppercase mb-4 tracking-wider">
            {language === 'vi' ? 'Lịch lớp tháng 09/2026' : 'Class schedule — September 2026'}
          </div>
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-600 pb-2 border-b border-slate-200 bg-slate-50 p-2 rounded">
            {weekdays.map(day => <div key={day}>{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2 mt-2 min-h-[300px]">
            {calendarCells.map((day, i) => {
              if (!day) {
                return <div key={`empty-${i}`} aria-hidden="true" className="min-h-[80px] rounded bg-slate-50/40 border border-dashed border-slate-100" />;
              }
              const dateStr = `2026-09-${String(day).padStart(2,'0')}`;
              const dayClasses = classes.filter(c => c.date === dateStr);

              return (
                <div key={dateStr} className={`p-2 bg-slate-50 border border-slate-200 rounded min-h-[80px] text-left ${day === 22 ? 'ring-2 ring-blue-600 bg-blue-50/30' : ''}`}>
                  <div className="text-[10px] font-mono font-bold text-slate-500 mb-1 tabular-nums">{day}</div>
                  {dayClasses.map(c => (
                    <div key={c.id} title={`${c.startTime} — ${language === 'vi' ? c.nameVi : c.name}`} className="p-1 bg-white border border-slate-300 rounded text-[10px] text-slate-900 font-semibold line-clamp-2 mb-1 shadow-2xs">
                      <span className="text-blue-700 tabular-nums">{c.startTime}</span> {language === 'vi' ? c.nameVi : c.name}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <NewClassModal isOpen={isNewClassOpen} onClose={() => setIsNewClassOpen(false)} />
      {editingClass && <EditClassModal item={editingClass} subjects={subjects} staff={staff} language={language} onClose={() => setEditingClass(null)} onSave={saveClass} />}
    </div>
  );
}
