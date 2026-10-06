import React, { useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { formatDate } from '../../locales/translations';
import { Calendar, Clock, MapPin, Users, Filter, CheckCircle2 } from 'lucide-react';

export function CoachScheduleView() {
  const { classes, currentUser, t, language } = useSCMS();
  const [selectedRoom, setSelectedRoom] = useState('all');

  const myClasses = classes.filter(c => c.coachId === currentUser.id || c.coachName.includes('Mai'));

  const filteredClasses = selectedRoom === 'all'
    ? myClasses
    : myClasses.filter(c => c.room === selectedRoom);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-800 rounded border border-blue-200">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 whitespace-nowrap">{t('schedule')}</h2>
            <p className="text-xs text-slate-500 whitespace-nowrap">
              {language === 'vi' ? 'Lịch giảng dạy chi tiết, danh sách học viên từng buổi học & phòng tập' : 'Detailed teaching schedule, student roster and assigned rooms'}
            </p>
          </div>
        </div>

        {/* Room Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-700">Lọc theo phòng:</span>
          <select
            value={selectedRoom}
            onChange={e => setSelectedRoom(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
          >
            <option value="all">{language === 'vi' ? 'Tất cả phòng' : 'All Rooms'}</option>
            <option value="Studio A - Yoga">Studio A (Yoga)</option>
            <option value="Studio B - Fitness">Studio B (Fitness)</option>
            <option value="Gym Main Zone">Gym Main Zone</option>
          </select>
        </div>
      </div>

      {/* Schedule Table / Roster List */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">Danh Sách Buổi Dạy Trong Tuần</h3>
          <span className="text-xs text-slate-500 font-mono">Tổng số: {filteredClasses.length} lớp</span>
        </div>

        <div className="space-y-3">
          {filteredClasses.map(cls => (
            <div key={cls.id} className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-slate-300 transition-all">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-200 text-[10px] font-mono font-bold rounded">
                    {cls.category}
                  </span>
                  <span className="text-sm font-bold text-slate-900">{language === 'vi' ? cls.nameVi : cls.name}</span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                  <div className="flex items-center gap-1 font-mono tabular-nums">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatDate(cls.date, language)} &bull; {cls.startTime} ({cls.durationMinutes} {language === 'vi' ? 'phút' : 'min'})</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold">{language === 'vi' ? (cls.roomVi || cls.room) : cls.room}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono tabular-nums font-bold text-slate-900">{cls.enrolledCount}/{cls.capacity} {language === 'vi' ? 'Học viên' : 'Members'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold shadow-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Điểm Danh Buổi Học</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
