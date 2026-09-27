import React, { useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { formatDate } from '../../locales/translations';
import { StatusBadge } from '../common/Badge';
import { Users, Clock, MapPin, CheckCircle2 } from 'lucide-react';

export function MemberClassCatalog() {
  const { classes, currentUser, bookClass, bookings, members, packages, t, language } = useSCMS();
  const [selectedCategory, setSelectedCategory] = useState('all');

  const member = members.find(m => m.id === currentUser.id) || members[0];
  const memberPkg = packages.find(p => p.id === member.currentPackageId);

  const filteredClasses = selectedCategory === 'all'
    ? classes
    : classes.filter(c => c.category === selectedCategory);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-lg shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">{t('classCatalog')}</h2>
          <p className="text-xs text-slate-500">Đăng ký tham gia lớp học nhóm trực tuyến theo thời gian thực</p>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
          {['all', 'Yoga', 'Pilates', 'CrossFit', 'Boxing'].map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat === 'all' ? 'Tất cả bộ môn' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Class Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClasses.map(cls => {
          const isAlreadyBooked = bookings.some(b => b.classId === cls.id && b.memberId === member.id && b.status === 'confirmed');
          const isFull = cls.enrolledCount >= cls.capacity;
          const isTierBlocked = memberPkg && memberPkg.tier < cls.minTierRequired;

          return (
            <div key={cls.id} className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold uppercase border border-slate-200">
                    {cls.category}
                  </span>
                  <StatusBadge type="class" status={cls.status} />
                </div>

                <h3 className="text-sm font-bold text-slate-900 mt-2">{language === 'vi' ? cls.nameVi : cls.name}</h3>

                <div className="mt-3 space-y-1.5 text-xs text-slate-700 bg-slate-50 p-3 rounded border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono tabular-nums">{formatDate(cls.date, language)} &bull; {cls.startTime} ({cls.durationMinutes}m)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{language === 'vi' ? (cls.roomVi || cls.room) : cls.room}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{language === 'vi' ? 'Huấn luyện viên' : 'Coach'}: <strong className="text-slate-900">{cls.coachName}</strong></span>
                  </div>
                </div>
              </div>

              {/* Booking Button & Denial State Rules */}
              <div>
                <div className="flex items-center justify-between text-[11px] mb-2">
                  <span className="text-slate-500">Còn trống:</span>
                  <span className={`font-mono font-bold tabular-nums ${isFull ? 'text-rose-700' : 'text-emerald-800'}`}>
                    {cls.capacity - cls.enrolledCount}/{cls.capacity} chỗ
                  </span>
                </div>

                {isAlreadyBooked ? (
                  <button disabled className="w-full py-2 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded text-xs font-bold flex items-center justify-center gap-1.5 cursor-default">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Đã đăng ký lớp này</span>
                  </button>
                ) : isTierBlocked ? (
                  <button disabled className="w-full py-2 bg-slate-100 border border-slate-200 text-slate-500 rounded text-xs font-bold cursor-not-allowed">
                    {t('bookingDeniedTier')} (Yêu cầu Tier {cls.minTierRequired}+)
                  </button>
                ) : isFull ? (
                  <button disabled className="w-full py-2 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs font-bold cursor-not-allowed">
                    {t('bookingDeniedFull')}
                  </button>
                ) : (
                  <button
                    onClick={() => bookClass(cls.id, member.id)}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-bold shadow-xs transition-all"
                  >
                    {t('bookClass')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
