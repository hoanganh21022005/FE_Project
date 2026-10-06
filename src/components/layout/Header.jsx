import React, { useState, useRef, useEffect } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { Calendar, ChevronRight, LogOut, Bell, CheckCircle2, AlertTriangle, CreditCard, Users, Check } from 'lucide-react';





export function Header({ currentTitle, onLogout }) {
  const { language, setLanguage, currentUser, t } = useSCMS();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 'n1',
      titleVi: 'Cảnh báo thời gian gia hạn 72 giờ',
      titleEn: '72h Grace Period Warning',
      descVi: 'Gói của thành viên Trần Quốc Huy (MB-1002) đã hết hạn và chuyển sang thời gian chờ gia hạn.',
      descEn: "Tran Quoc Huy's package (MB-1002) expired and entered the grace period.",
      timeVi: '10 phút trước',
      timeEn: '10 minutes ago',
      type: 'warning',
      unread: true
    },
    {
      id: 'n2',
      titleVi: 'Thanh toán mới thành công',
      titleEn: 'Successful Payment Recorded',
      descVi: 'Giao dịch TX-9021 (Gói Premium 12 Tháng - 1.500.000 VND) đã hoàn tất.',
      descEn: 'Transaction TX-9021 (Premium 12M Package - 1,500,000 VND) completed.',
      timeVi: '35 phút trước',
      timeEn: '35 minutes ago',
      type: 'payment',
      unread: true
    },
    {
      id: 'n3',
      titleVi: 'Lớp học đã đủ sức chứa',
      titleEn: 'Class Full Capacity Reached',
      descVi: 'Lớp Yoga Foundation (Studio A) đã đủ 15/15 thành viên đăng ký.',
      descEn: 'Yoga Foundation class (Studio A) has reached 15/15 enrolled capacity.',
      timeVi: '2 giờ trước',
      timeEn: '2 hours ago',
      type: 'info',
      unread: true
    },
    {
      id: 'n4',
      titleVi: 'Điều chỉnh điểm danh',
      titleEn: 'Attendance Record Corrected',
      descVi: 'Coach Lê Thị Mai đã điều chỉnh điểm danh cho lớp Pilates Intermediate (Audit Log #A-108).',
      descEn: 'Coach Le Thi Mai updated attendance record for Pilates Intermediate.',
      timeVi: '5 giờ trước',
      timeEn: '5 hours ago',
      type: 'success',
      unread: false
    }
  ]);

  const popoverRef = useRef(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => n.unread).length;

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
  };

  // Format today's date formatted according to language (VI/MM/YYYY, EN MMM YYYY)
  const getFormattedTodayDate = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();

    const daysVi = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const dayOfWeekIndex = today.getDay();

    if (language === 'vi') {
      return `${daysVi[dayOfWeekIndex]}, ${day}/${month}/${year}`;
    } else {
      return `${daysEn[dayOfWeekIndex]}, ${day} ${monthsEn[today.getMonth()]} ${year}`;
    }
  };

  return (
    <header className="h-[56px] bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left Trail */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-400 font-medium">SCMS Center</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className="text-slate-900 font-bold">{currentTitle}</span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Today's Date Display */}
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 border border-slate-200 rounded text-xs font-semibold text-slate-800 shadow-2xs">
          <Calendar className="w-4 h-4 text-orange-600 flex-shrink-0" />
          <span className="tabular-nums text-slate-900 font-bold">
            {getFormattedTodayDate()}
          </span>
        </div>

        {/* Language Switcher Segmented Control (VI | EN) */}
        <div className="flex items-center bg-slate-100 p-0.5 border border-slate-200 rounded text-xs font-bold">
          <button
            type="button"
            onClick={() => setLanguage('vi')}
            className={`px-2.5 py-1 rounded text-[11px] transition-all ${
              language === 'vi'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            VI
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2.5 py-1 rounded text-[11px] transition-all ${
              language === 'en'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            EN
          </button>
        </div>

        {/* Notification Bell & Dropdown Popover */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className={`p-1.5 rounded border transition-colors relative ${
              isNotifOpen
                ? 'bg-slate-100 text-slate-900 border-slate-300'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 border-transparent hover:border-slate-200'
            }`}
            title={language === 'vi' ? 'Thông báo hệ thống' : 'System notifications'}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white" />
            )}
          </button>

          {/* Notifications Panel */}
          {isNotifOpen && (
            <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
              {/* Header */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {language === 'vi' ? 'Thông báo hệ thống' : 'Notifications'}
                  </h3>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-bold rounded font-mono">
                      {unreadCount}
                    </span>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 hover:underline"
                  >
                    <Check className="w-3 h-3" />
                    <span>{language === 'vi' ? 'Đánh dấu đã đọc' : 'Mark all read'}</span>
                  </button>
                )}
              </div>

              {/* Notification Items */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    {language === 'vi' ? 'Không có thông báo mới' : 'No notifications'}
                  </div>
                ) : (
                  notifications.map(n => {
                    const title = language === 'vi' ? n.titleVi : n.titleEn;
                    const desc = language === 'vi' ? n.descVi : n.descEn;

                    const icon =
                      n.type === 'warning' ? <AlertTriangle className="w-4 h-4 text-amber-600" /> :
                      n.type === 'payment' ? <CreditCard className="w-4 h-4 text-emerald-600" /> :
                      n.type === 'info' ? <Users className="w-4 h-4 text-blue-600" /> :
                      <CheckCircle2 className="w-4 h-4 text-slate-600" />;

                    const iconBg =
                      n.type === 'warning' ? 'bg-amber-50 border-amber-200' :
                      n.type === 'payment' ? 'bg-emerald-50 border-emerald-200' :
                      n.type === 'info' ? 'bg-blue-50 border-blue-200' :
                      'bg-slate-100 border-slate-200';

                    return (
                      <div
                        key={n.id}
                        onClick={() => markAsRead(n.id)}
                        className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                          n.unread ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className={`p-2 rounded border flex-shrink-0 ${iconBg}`}>
                          {icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-bold ${n.unread ? 'text-slate-900' : 'text-slate-700'}`}>
                              {title}
                            </span>
                            {n.unread && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />}
                          </div>

                          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed line-clamp-2">
                            {desc}
                          </p>

                          <span className="text-[11px] text-slate-400 mt-1 block">
                            {language === 'vi' ? n.timeVi : n.timeEn}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-center">
                <span className="text-[11px] text-slate-500 font-medium">
                  {language === 'vi' ? 'Hệ thống tự động lưu nhật ký hoạt động' : 'Activity is recorded automatically'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* User Info & Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-7 h-7 rounded bg-slate-900 flex items-center justify-center text-white font-bold text-xs">
            {currentUser.name.charAt(0)}
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-bold text-slate-900 leading-tight">{currentUser.name}</div>
            <div className="text-[10px] text-slate-500">{currentUser.email}</div>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded transition-colors"
              title={t('logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
