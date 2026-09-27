import React, { useEffect, useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { CalendarPlus, AlertTriangle, X } from 'lucide-react';



export function NewClassModal({ isOpen, onClose }) {
  const { addClassSession, staff, subjects, rooms, apiEnabled, t, language } = useSCMS();

  const coaches = staff.filter(s => s.role === 'coach' && s.status === 'active');
  const availableRooms = rooms.filter(item => item.status === 'available');

  const [nameVi, setNameVi] = useState('');
  const [category, setCategory] = useState('Yoga');
  const [subjectId, setSubjectId] = useState('');
  const [coachId, setCoachId] = useState(coaches[0]?.id || '');
  const [room, setRoom] = useState('Studio 1 (Yoga Room)');
  const [date, setDate] = useState('2026-09-22');
  const [startTime, setStartTime] = useState('08:00');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [capacity, setCapacity] = useState(15);
  const [minTierRequired, setMinTierRequired] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (subjects.length && !subjectId) {
      setSubjectId(String(subjects[0].id));
      setCategory(subjects[0].name);
    }
  }, [subjects, subjectId]);

  useEffect(() => {
    if (availableRooms.length && !availableRooms.some(item => item.name === room)) {
      setRoom(availableRooms[0].name);
    }
  }, [rooms, room]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const selectedCoach = staff.find(s => s.id === coachId);

    if (apiEnabled && !subjectId) {
      setErrorMessage(language === 'vi' ? 'Chưa có bộ môn để tạo lớp.' : 'No subject is available for this class.');
      return;
    }

    setIsSubmitting(true);
    const result = await addClassSession({
      name: nameVi,
      nameVi: nameVi || 'Lớp tập luyện',
      category,
      subjectId,
      coachId,
      coachName: selectedCoach?.name || 'Coach',
      room,
      date,
      startTime,
      durationMinutes,
      capacity,
      status: 'published',
      minTierRequired
    });
    setIsSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.message || 'Lỗi trùng lịch!');
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-lg shadow-xl p-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <CalendarPlus className="w-4 h-4 text-slate-800" />
            <span>{t('createClass')}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded flex items-center gap-2 text-rose-800 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              {language === 'vi' ? 'Tên lớp học' : 'Class Name'} <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              required
              value={nameVi}
              onChange={e => setNameVi(e.target.value)}
              placeholder={language === 'vi' ? 'Ví dụ: Yoga Vinyasa Sáng' : 'e.g., Vinyasa Flow Yoga Morning'}
              className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{language === 'vi' ? 'Bộ môn' : 'Category'}</label>
              <select
                value={apiEnabled ? subjectId : category}
                onChange={e => {
                  if (apiEnabled) {
                    setSubjectId(e.target.value);
                    setCategory(subjects.find(item => String(item.id) === e.target.value)?.name || '');
                  } else {
                    setCategory(e.target.value);
                  }
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
              >
                {apiEnabled ? subjects.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                )) : <>
                  <option value="Yoga">Yoga</option>
                  <option value="Pilates">Pilates</option>
                  <option value="CrossFit">CrossFit</option>
                  <option value="Boxing">Boxing</option>
                  <option value="Spinning">Spinning</option>
                </>}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{language === 'vi' ? 'Coach phụ trách' : 'Assigned Coach'}</label>
              <select
                value={coachId}
                onChange={e => setCoachId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
              >
                {coaches.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.specialty})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{language === 'vi' ? 'Phòng tập' : 'Room'}</label>
              <select
                value={room}
                onChange={e => setRoom(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
              >
                {availableRooms.length ? availableRooms.map(item => (
                  <option key={item.id} value={item.name}>{item.name}</option>
                )) : <>
                <option value="Studio 1 (Yoga Room)">{language === 'vi' ? 'Phòng 1 (Phòng Yoga)' : 'Studio 1 (Yoga Room)'}</option>
                <option value="Studio 2 (Pilates Room)">{language === 'vi' ? 'Phòng 2 (Phòng Pilates)' : 'Studio 2 (Pilates Room)'}</option>
                <option value="Zone A (CrossFit Gym)">{language === 'vi' ? 'Khu A (Khu CrossFit)' : 'Zone A (CrossFit Gym)'}</option>
                <option value="Ring 2 (Combat Zone)">{language === 'vi' ? 'Sàn đấu 2 (Khu Đối kháng)' : 'Ring 2 (Combat Zone)'}</option>
                </>}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{language === 'vi' ? 'Yêu cầu Gói' : 'Required Tier'}</label>
              <select
                value={minTierRequired}
                onChange={e => setMinTierRequired(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
              >
                <option value={1}>{language === 'vi' ? 'Tier 1 - Gói Cơ Bản trở lên' : 'Tier 1 - Basic and above'}</option>
                <option value={2}>{language === 'vi' ? 'Tier 2 - Gói Pro trở lên' : 'Tier 2 - Pro and above'}</option>
                <option value={3}>{language === 'vi' ? 'Tier 3 - Chỉ dành cho VIP' : 'Tier 3 - VIP Only'}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{language === 'vi' ? 'Ngày' : 'Date'}</label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Giờ bắt đầu</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Sức chứa (Người)</label>
              <input
                type="number"
                min={1}
                max={50}
                required
                value={capacity}
                onChange={e => setCapacity(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded shadow-xs"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded shadow-xs"
            >
              {isSubmitting ? (language === 'vi' ? 'Đang tạo...' : 'Creating...') : t('createClass')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
