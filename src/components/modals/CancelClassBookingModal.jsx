import React, { useState } from 'react';
import { AlertTriangle, Clock, MapPin, Users, X, AlertCircle, ShieldAlert, Calendar } from 'lucide-react';
import { formatDate } from '../../locales/translations';

export function CancelClassBookingModal({
  isOpen,
  onClose,
  classItem,
  bookingItem,
  onConfirmCancel,
  language = 'vi',
}) {
  const [cancelling, setCancelling] = useState(false);

  if (!isOpen || !classItem) return null;

  const handleConfirm = async () => {
    setCancelling(true);
    try {
      await onConfirmCancel(bookingItem?.id || classItem.id);
      onClose();
    } finally {
      setCancelling(false);
    }
  };

  const className = classItem.nameVi || classItem.name || classItem.className || 'Lớp thể thao';
  const category = classItem.category || 'Thể thao';
  const room = classItem.roomVi || classItem.room || 'Sân tập VIBE Sport';
  const coach = classItem.coachName || 'Huấn luyện viên';
  const dateStr = formatDate(classItem.date || classItem.startDate, language);
  const timeStr = `${classItem.startTime || '06:00'} - ${classItem.endTime || '07:30'}`;

  // Check 24h deadline
  const startDateTime = new Date(`${classItem.date || classItem.startDate}T${classItem.startTime || '00:00'}:00`);
  const now = new Date();
  const hoursRemaining = Math.round((startDateTime.getTime() - now.getTime()) / (1000 * 60 * 60));
  const isWithinPolicy = hoursRemaining >= 24;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-rose-50/70">
          <div className="flex items-center gap-2.5 text-rose-800 font-bold text-sm">
            <div className="w-8 h-8 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span>
              {language === 'vi' ? 'Xác nhận hủy đăng ký khóa học' : 'Confirm Course Cancellation'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={cancelling}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs text-slate-600">
          <p className="text-slate-700 leading-relaxed font-medium">
            {language === 'vi'
              ? 'Bạn đang yêu cầu hủy đăng ký tham gia khóa học dưới đây:'
              : 'You are requesting to cancel your enrollment in the following course:'}
          </p>

          {/* Class Summary Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white uppercase tracking-wide">
                {category}
              </span>
              {classItem.code && (
                <span className="text-[11px] font-mono text-slate-500">
                  {classItem.code}
                </span>
              )}
            </div>

            <h4 className="text-sm font-bold text-slate-900 leading-tight">
              {className}
            </h4>

            <div className="space-y-1.5 pt-1 text-slate-600">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-semibold text-slate-800 tabular-nums">
                  Khai giảng: {dateStr} &bull; {timeStr}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{room}</span>
              </div>

              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>HLV phụ trách: <strong className="text-slate-800">{coach}</strong></span>
              </div>
            </div>
          </div>

          {/* Cancellation Policy Box */}
          <div className="p-3.5 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-900 text-[11px] space-y-1.5 leading-relaxed">
            <div className="font-bold flex items-center gap-1.5 text-amber-950">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{language === 'vi' ? 'Chính sách hủy khóa học VIBE Sport:' : 'Cancellation Policy:'}</span>
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1 text-amber-900/90">
              <li>
                <strong>Hủy trước 24 giờ khai giảng:</strong> Được hoàn trả 100% quyền lợi / học phí vào tài khoản hội viên.
              </li>
              <li>
                <strong>Hủy trong vòng 24 giờ hoặc đã khai giảng:</strong> Không áp dụng hủy tự động. Quý hội viên vui lòng liên hệ trực tiếp quầy lễ tân để được hỗ trợ.
              </li>
              <li>
                Chỗ trống sẽ được mở lại cho hội viên khác trong danh sách chờ.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 p-4 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={cancelling}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
          >
            {language === 'vi' ? 'Giữ lại chỗ' : 'Keep Booking'}
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={cancelling}
            className="px-4 py-2 bg-[#BA0000] hover:bg-[#8E0000] text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            {cancelling ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>{language === 'vi' ? 'Đang hủy...' : 'Cancelling...'}</span>
              </>
            ) : (
              <span>{language === 'vi' ? 'Xác nhận hủy đăng ký' : 'Confirm Cancellation'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
