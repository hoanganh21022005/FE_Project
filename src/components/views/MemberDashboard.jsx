import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSCMS } from '../../context/SCMSContext';
import { CLUB_COURSES } from './MemberAttendanceView';
import { formatDate } from '../../locales/translations';
import { StatusBadge } from '../common/Badge';
import { CancelClassBookingModal } from '../modals/CancelClassBookingModal';
import { ClassFeedbackModal } from '../modals/ClassFeedbackModal';
import {
  Award,
  Calendar,
  AlertTriangle,
  ShieldCheck,
  Flame,
  Clock,
  MapPin,
  Users,
  QrCode,
  ClipboardCheck,
  MessageSquareHeart,
  Star,
  Sparkles,
  ArrowRight,
  Plus
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export function MemberDashboard() {
  const navigate = useNavigate();
  const {
    currentUser,
    members,
    packages,
    classes,
    bookings,
    attendance,
    feedbacks,
    checkedInCourseSessions,
    cancelBooking,
    t,
    language
  } = useSCMS();

  const [selectedClassForCancel, setSelectedClassForCancel] = useState(null);
  const [selectedClassForFeedback, setSelectedClassForFeedback] = useState(null);
  const [selectedExistingFeedback, setSelectedExistingFeedback] = useState(null);

  // Safely resolve member
  const member = useMemo(() => {
    return (
      (members || []).find(
        m =>
          String(m.id) === String(currentUser?.id) ||
          (m.email && currentUser?.email && m.email.toLowerCase() === currentUser.email.toLowerCase())
      ) ||
      currentUser ||
      members?.[0] || { id: 'mem-1', name: currentUser?.name || 'Hội viên', code: 'MB-1001' }
    );
  }, [members, currentUser]);

  const pkg = packages?.find(p => String(p.id) === String(member.currentPackageId));

  // Confirmed bookings for member
  const myBookings = useMemo(() => {
    return (bookings || []).filter(
      b =>
        b &&
        (String(b.memberId) === String(member?.id) || String(b.memberId) === String(currentUser?.id)) &&
        b.status === 'confirmed'
    );
  }, [bookings, member, currentUser]);

  // Attendance records for member
  const myAttendance = useMemo(() => {
    return (attendance || []).filter(
      a =>
        a &&
        (String(a.memberId) === String(member?.id) || String(a.memberId) === String(currentUser?.id))
    );
  }, [attendance, member, currentUser]);

  // Feedbacks submitted by member
  const myFeedbacks = useMemo(() => {
    return (feedbacks || []).filter(
      f =>
        f &&
        (String(f.memberId) === String(member?.id) || String(f.memberId) === String(currentUser?.id))
    );
  }, [feedbacks, member, currentUser]);

  // Unified attended & pending feedback count synced with MemberAttendanceView & MemberFeedbackView
  const { attendedCount, pendingFeedbackSessions } = useMemo(() => {
    const reviewsList = feedbacks || [];
    const allAttended = [];

    if (CLUB_COURSES?.badminton?.sessions?.[0]) {
      const s = CLUB_COURSES.badminton.sessions[0];
      allAttended.push({
        id: `badminton-session-${s.num}`,
        className: CLUB_COURSES.badminton.name,
        date: s.date,
        coach: s.coach,
      });
    }
    if (CLUB_COURSES?.pickleball?.sessions?.[0]) {
      const s = CLUB_COURSES.pickleball.sessions[0];
      allAttended.push({
        id: `pickleball-session-${s.num}`,
        className: CLUB_COURSES.pickleball.name,
        date: s.date,
        coach: s.coach,
      });
    }
    Object.values(CLUB_COURSES || {}).forEach(course => {
      (course.sessions || []).forEach(s => {
        const sessionKey = `${course.id}-session-${s.num}`;
        if (checkedInCourseSessions?.[sessionKey] && !allAttended.some(a => a.id === sessionKey)) {
          allAttended.push({
            id: sessionKey,
            className: course.name,
            date: s.date,
            coach: s.coach,
          });
        }
      });
    });

    const pending = allAttended.filter(session => {
      const existingFb = reviewsList.find(
        f =>
          f.classId === session.id ||
          (f.className === session.className && f.date === session.date) ||
          (f.date === session.date && f.coachName?.includes(session.coach.replace(/^HLV\s+/, '').split(' ')[0]))
      );
      return !existingFb;
    });

    return {
      attendedCount: allAttended.length,
      pendingFeedbackSessions: pending,
    };
  }, [feedbacks, checkedInCourseSessions]);

  const fitnessTrendData = [
    { week: language === 'vi' ? 'Tuần 1' : 'W1', calories: 1850, weight: 68.5 },
    { week: language === 'vi' ? 'Tuần 2' : 'W2', calories: 2200, weight: 68.0 },
    { week: language === 'vi' ? 'Tuần 3' : 'W3', calories: 2450, weight: 67.4 },
    { week: language === 'vi' ? 'Tuần 4' : 'W4', calories: 2900, weight: 66.8 },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-8 font-sans antialiased">
      {/* Member Welcome Section (Frameless, clean typography) */}
      <div className="pb-6 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-sm">
            {language === 'vi' ? 'HỘI VIÊN CHÍNH THỨC' : 'VERIFIED MEMBER'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-2">
            {language === 'vi' ? `Xin chào, ${member.name}!` : `Welcome, ${member.name}!`}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'vi' ? 'Mã hội viên:' : 'Member Code:'}{' '}
            <strong className="font-mono text-slate-900 font-bold tabular-nums">{member.code || 'MB-1001'}</strong> &bull;{' '}
            {language === 'vi' ? 'Trạng thái tài khoản' : 'Account Status'}
          </p>
        </div>

        <div>
          <StatusBadge type="membership" status={member.membershipStatus || 'active'} />
        </div>
      </div>

      {/* 3 Core Workflow Quick Navigation (Flat Minimalist Tiles, No Pastel Borders) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. Ghi danh */}
        <div className="bg-slate-50/80 hover:bg-slate-100/80 rounded-lg p-5 transition-all flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'vi' ? '1. Ghi Danh Lớp Học' : '1. Class Enrollment'}
              </div>
              <div className="text-3xl font-extrabold text-slate-900 font-mono mt-1.5 tabular-nums">
                {myBookings.length}
                <span className="text-xs font-normal text-slate-500 ml-2 font-sans">
                  {language === 'vi' ? 'lớp đang tham gia' : 'classes enrolled'}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-md bg-white shadow-2xs flex items-center justify-center text-slate-900">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/member/catalog')}
              className="text-xs font-bold text-slate-900 hover:text-[#BA0000] flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>{language === 'vi' ? 'Khám phá danh mục lớp' : 'Browse Catalog'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 2. Điểm danh */}
        <div className="bg-slate-50/80 hover:bg-slate-100/80 rounded-lg p-5 transition-all flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'vi' ? '2. Điểm Danh Chuyên Cần' : '2. Attendance & QR'}
              </div>
              <div className="text-3xl font-extrabold text-slate-900 font-mono mt-1.5 tabular-nums">
                {attendedCount}
                <span className="text-xs font-normal text-slate-500 ml-2 font-sans">
                  {language === 'vi' ? 'buổi đã có mặt' : 'sessions attended'}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-md bg-white shadow-2xs flex items-center justify-center text-slate-900">
              <QrCode className="w-5 h-5" />
            </div>
          </div>
          <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/member/attendance')}
              className="text-xs font-bold text-slate-900 hover:text-[#BA0000] flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>{language === 'vi' ? 'Mã QR & Lịch sử check-in' : 'QR Check-in & History'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 3. Feedback */}
        <div className="bg-slate-50/80 hover:bg-slate-100/80 rounded-lg p-5 transition-all flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'vi' ? '3. Đánh Giá & Feedback' : '3. Class Feedback'}
              </div>
              <div className="text-3xl font-extrabold text-[#BA0000] font-mono mt-1.5 tabular-nums">
                {pendingFeedbackSessions.length}
                <span className="text-xs font-normal text-slate-500 ml-2 font-sans">
                  {language === 'vi' ? 'buổi chờ đánh giá' : 'pending reviews'}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-md bg-white shadow-2xs flex items-center justify-center text-[#BA0000]">
              <MessageSquareHeart className="w-5 h-5" />
            </div>
          </div>
          <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/member/feedback')}
              className="text-xs font-bold text-[#BA0000] hover:underline flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>{language === 'vi' ? 'Gửi đánh giá buổi học' : 'Submit Feedback'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Package Privilege Section (Frameless, Architectural) */}
      <div className="pt-8 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <Award className="w-4 h-4 text-slate-900" />
            <span>{language === 'vi' ? 'Gói Dịch Vụ Đang Sử Dụng' : 'Active Membership Package'}</span>
          </div>
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {member.currentPackageName || (language === 'vi' ? 'Chưa đăng ký gói' : 'No Package Enrolled')}
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            {language === 'vi'
              ? 'Quyền lợi tham gia không giới hạn các lớp nhóm Cầu lông, Pickleball, Bắn cung, Gym & Yoga.'
              : 'Unlimited access to Badminton, Pickleball, Archery, Gym & Yoga group classes.'}
          </p>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">{language === 'vi' ? 'HLV Phụ Trách:' : 'Assigned PT:'}</span>
            <span className="font-bold text-slate-900">{member.primaryCoachName || 'Lê Thị Mai (Yoga PT)'}</span>
          </div>
        </div>

        {/* Business State Warnings */}
        <div>
          {member.membershipStatus === 'grace_period' ? (
            <div className="p-4 bg-amber-50 rounded-md flex items-start gap-3 text-amber-950 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Gói thành viên đang trong Grace Period (72h gia hạn)</p>
                <p className="mt-1 leading-relaxed text-amber-900">
                  Vui lòng hoàn tất thanh toán tại quầy Lễ tân hoặc chuyển khoản VietQR để tránh bị tự động khóa quyền đặt lịch lớp học.
                </p>
              </div>
            </div>
          ) : member.membershipStatus === 'pending_payment' ? (
            <div className="p-4 bg-amber-50 rounded-md flex items-start gap-3 text-amber-950 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">{t('pending_payment')}</p>
                <p className="mt-1 leading-relaxed text-amber-900">{t('bookingDeniedPayment')}</p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50/70 rounded-md flex items-start gap-3 text-emerald-950 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-emerald-900">
                  {language === 'vi' ? 'Tài Khoản Đang Hoạt Động Bình Thường' : 'Account Active'}
                </p>
                <p className="mt-1 leading-relaxed text-emerald-800">
                  {language === 'vi'
                    ? 'Bạn có thể tự do đăng ký các lớp Cầu lông, Pickleball, Bắn cung, Quần vợt trong Danh mục Lớp Học.'
                    : 'You can freely book Badminton, Pickleball, Archery and Tennis sessions in the Class Catalog.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fitness Statistics Chart (Frameless) */}
      <div className="pt-8 border-t border-slate-100 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-[#BA0000] shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              {language === 'vi' ? 'Thống Kê Tiến Độ Tập Luyện & Calo Tiêu Hao' : 'Fitness Progress & Calorie Burn Statistics'}
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-mono font-medium">4 {language === 'vi' ? 'tuần gần nhất' : 'weeks'}</span>
        </div>

        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={fitnessTrendData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis yAxisId="right" orientation="right" domain={[65, 70]} tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
              <Line yAxisId="left" type="monotone" dataKey="calories" name={language === 'vi' ? 'Calo tiêu hao (kcal)' : 'Calories Burned (kcal)'} stroke="#D97706" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line yAxisId="right" type="monotone" dataKey="weight" name={language === 'vi' ? 'Cân nặng (kg)' : 'Weight (kg)'} stroke="#0F172A" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* My Booked Classes (Clean List, Frameless) */}
      <div className="pt-8 border-t border-slate-100 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-900 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              {language === 'vi' ? 'Lịch Lớp Đã Đăng Ký' : 'My Booked Classes'}
            </h3>
            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-sm">
              {myBookings.length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => navigate('/member/catalog')}
            className="text-xs font-bold text-[#BA0000] hover:underline flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Đăng ký thêm lớp' : 'Enroll more'}</span>
          </button>
        </div>

        {myBookings.length === 0 ? (
          <div className="text-center py-10 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
              <Calendar className="w-6 h-6" />
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {language === 'vi' ? 'Bạn chưa đăng ký lớp học nào.' : 'You have not enrolled in any class yet.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/member/catalog')}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>{language === 'vi' ? 'Xem Danh Mục Lớp Học Ngay' : 'Browse Classes Now'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {myBookings.map(bk => {
              const cls = (classes || []).find(c => String(c.id) === String(bk.classId));
              const att = myAttendance.find(a => String(a.classId) === String(bk.classId));
              const fb = myFeedbacks.find(f => String(f.classId) === String(bk.classId));

              const sessionDate = cls?.date || cls?.startDate || String(bk.bookingDate || '').slice(0, 10);
              const startTime = cls?.startTime || '06:00';
              const sessionStart = new Date(`${sessionDate}T${startTime}:00`);
              const now = new Date();
              const isFutureSession = sessionStart.getTime() > now.getTime();

              const isAttended = !isFutureSession && att && (att.status === 'present' || att.status === 'late');
              const canFeedback = isAttended && !fb;

              return (
                <div
                  key={bk.id}
                  className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded-sm">
                        {cls?.category || 'Thể thao'}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">
                        {bk.className || cls?.nameVi || cls?.name}
                      </h4>
                      {!isFutureSession && att ? (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-sm ${
                            att.status === 'present'
                              ? 'bg-emerald-100 text-emerald-800'
                              : att.status === 'late'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {att.status === 'present'
                            ? 'Đã có mặt'
                            : att.status === 'late'
                            ? 'Đi trễ'
                            : 'Vắng mặt'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-sm bg-slate-100 text-slate-600">
                          Sắp diễn ra
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <div className="flex items-center gap-1 font-mono tabular-nums">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {cls?.date || String(bk.bookingDate || '').slice(0, 10)} &bull;{' '}
                          {cls?.startTime || '06:00'} - {cls?.endTime || '07:30'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{cls?.roomVi || cls?.room || 'Sân tập VIBE Sport'}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>HLV: {cls?.coachName || 'Huấn luyện viên'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-auto">
                    {/* Quick feedback button if attended */}
                    {canFeedback && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedExistingFeedback(null);
                          setSelectedClassForFeedback(cls || { id: bk.classId, nameVi: bk.className });
                        }}
                        className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
                      >
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>{language === 'vi' ? 'Đánh giá ngay' : 'Review'}</span>
                      </button>
                    )}

                    {fb && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedExistingFeedback(fb);
                          setSelectedClassForFeedback(cls || { id: bk.classId, nameVi: bk.className });
                        }}
                        className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                        <span>Đã đánh giá ({fb.rating}★) · Xem</span>
                      </button>
                    )}

                    {/* Safe Cancel booking with confirmation modal */}
                    {isFutureSession && (
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedClassForCancel({
                            classItem: cls || { id: bk.classId, nameVi: bk.className },
                            bookingItem: bk,
                          })
                        }
                        className="text-xs font-medium text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        {t('cancelBooking')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {selectedClassForCancel && (
        <CancelClassBookingModal
          isOpen={Boolean(selectedClassForCancel)}
          onClose={() => setSelectedClassForCancel(null)}
          classItem={selectedClassForCancel.classItem}
          bookingItem={selectedClassForCancel.bookingItem}
          onConfirmCancel={async (bookingIdOrClassId) => {
            await cancelBooking(bookingIdOrClassId, member?.id);
            setSelectedClassForCancel(null);
          }}
          language={language}
        />
      )}

      {/* Class Feedback Modal */}
      {selectedClassForFeedback && (
        <ClassFeedbackModal
          isOpen={Boolean(selectedClassForFeedback)}
          onClose={() => {
            setSelectedClassForFeedback(null);
            setSelectedExistingFeedback(null);
          }}
          classItem={selectedClassForFeedback}
          existingFeedback={selectedExistingFeedback}
        />
      )}
    </div>
  );
}
