import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  ArrowRight,
  ShieldCheck,
  Send
} from 'lucide-react';
import { formatDate } from '../../locales/translations';

export function LeaveRequestModal({
  isOpen,
  onClose,
  upcomingSessions = [],
  defaultSession = null,
  onSubmitLeave,
  absentQuota = 3,
  currentAbsent = 0,
  language = 'vi',
  initialRequestType = 'leave'
}) {
  const [selectedSessionId, setSelectedSessionId] = useState(
    defaultSession?.bookingId || upcomingSessions[0]?.bookingId || ''
  );
  const [requestType, setRequestType] = useState(initialRequestType || 'leave');
  const [reason, setReason] = useState('Bận công việc / Lịch học đột xuất');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setRequestType(initialRequestType || 'leave');
      if (defaultSession?.bookingId) {
        setSelectedSessionId(defaultSession.bookingId);
      }
    }
  }, [isOpen, initialRequestType, defaultSession]);

  if (!isOpen) return null;

  const targetSession = upcomingSessions.find(s => String(s.bookingId) === String(selectedSessionId)) || defaultSession || upcomingSessions[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetSession) return;
    setSubmitting(true);
    try {
      if (typeof onSubmitLeave === 'function') {
        await onSubmitLeave({
          session: targetSession,
          type: requestType,
          reason,
          note,
        });
      }
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsSuccess(false);
    setNote('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {language === 'vi' ? 'Đơn Xin Nghỉ / Đổi Buổi Học' : 'Leave / Reschedule Request'}
              </h2>
              <p className="text-[11px] text-slate-500">
                Bảo lưu quyền lợi & không tính vào hạn mức vắng vô cớ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSuccess ? (
          <div className="text-center py-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-200">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Đã gửi yêu cầu thành công!
              </h3>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                Hệ thống đã ghi nhận đơn của bạn cho buổi học <strong>{targetSession?.className}</strong> ({formatDate(targetSession?.date, language)}). Buổi học được bảo lưu và HLV đã được thông báo.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Đóng thông báo
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Absence Quota Reminder Banner */}
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between text-amber-900">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Hạn mức vắng phép còn lại: <strong>{Math.max(0, absentQuota - currentAbsent)}/{absentQuota} buổi</strong>
                </span>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                Được bảo lưu
              </span>
            </div>

            {/* Select Session to leave */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">
                Chọn buổi học cần xin nghỉ / đổi:
              </label>
              {upcomingSessions.length === 0 ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 italic">
                  Bạn không có buổi học sắp tới nào để xin nghỉ.
                </div>
              ) : (
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#BA0000] font-medium"
                >
                  {upcomingSessions.map(s => (
                    <option key={s.bookingId} value={s.bookingId}>
                      {s.className}{s.num ? ` (Buổi ${s.num})` : ''} &bull; {s.dayVi || formatDate(s.date, language)} ({s.startTime} - {s.endTime})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Request Type Toggle */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">
                Hình thức yêu cầu:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRequestType('leave')}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    requestType === 'leave'
                      ? 'bg-red-50 border-[#BA0000] text-red-950 font-bold shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-xs">Xin nghỉ phép</div>
                  <div className="text-[10.5px] text-slate-500 font-normal">Bảo lưu 01 buổi tập</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRequestType('swap')}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    requestType === 'swap'
                      ? 'bg-red-50 border-[#BA0000] text-red-950 font-bold shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-xs">Đổi ca học</div>
                  <div className="text-[10.5px] text-slate-500 font-normal">Chuyển sang ca khác</div>
                </button>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">
                Lý do nghỉ / đổi:
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#BA0000]"
              >
                <option value="Bận công việc / Lịch học đột xuất">Bận công việc / Lịch học đột xuất</option>
                <option value="Lý do sức khỏe / Cần nghỉ ngơi hồi phục">Lý do sức khỏe / Cần nghỉ ngơi hồi phục</option>
                <option value="Đi công tác xa / Du lịch">Đi công tác xa / Du lịch</option>
                <option value="Trùng lịch thi đấu hoặc việc gia đình">Trùng lịch thi đấu hoặc việc gia đình</option>
                <option value="Lý do cá nhân khác">Lý do cá nhân khác</option>
              </select>
            </div>

            {/* Additional Note */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 block">
                Ghi chú thêm cho HLV (nếu có):
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nhắn nhủ HLV bài tập bù hoặc nguyện vọng đổi ca..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#BA0000]"
              />
            </div>

            {/* Policy Notes */}
            <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
              <div>&bull; Đơn xin nghỉ gửi trước giờ học tối thiểu <strong>12 tiếng</strong> sẽ tự động được phê duyệt bảo lưu.</div>
              <div>&bull; Mỗi khóa học được hỗ trợ tối đa <strong>{absentQuota} buổi nghỉ phép có bảo lưu</strong>.</div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting || !targetSession}
                className="px-5 py-2 bg-[#BA0000] hover:bg-[#8E0000] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {submitting ? (
                  <span>Đang gửi...</span>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Gửi đơn xin nghỉ</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
