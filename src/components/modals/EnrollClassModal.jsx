import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  ShieldCheck,
  QrCode,
  ArrowRight,
  X,
  AlertCircle,
  Sparkles,
  Info
} from 'lucide-react';
import { formatDate } from '../../locales/translations';

export function EnrollClassModal({
  isOpen,
  onClose,
  classItem,
  member,
  onConfirmEnroll,
  language = 'vi',
  onNavigateAttendance
}) {
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen || !classItem) return null;

  const handleEnroll = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await onConfirmEnroll(classItem.id);
      if (res && res.success === false) {
        setErrorMessage(res.message || 'Không thể đăng ký lớp học này.');
      } else {
        setIsSuccess(true);
      }
    } catch (err) {
      setErrorMessage(err?.message || 'Đã xảy ra lỗi khi đăng ký.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsSuccess(false);
    setErrorMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              isSuccess ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-slate-100 text-slate-800 border-slate-200'
            }`}>
              {isSuccess ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Calendar className="w-5 h-5 text-[#BA0000]" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isSuccess
                  ? (language === 'vi' ? 'Ghi Danh Thành Công!' : 'Enrollment Confirmed!')
                  : (language === 'vi' ? 'Xác Nhận Đăng Ký Khóa Học' : 'Confirm Class Enrollment')}
              </h2>
              <p className="text-[11px] text-slate-500">
                VIBE Sport Center &bull; Hệ thống Đào tạo Thể thao
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

        {/* Success celebratory screen */}
        {isSuccess ? (
          <div className="text-center py-4 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-200 shadow-inner">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900 uppercase">
                {classItem.nameVi || classItem.name}
              </h3>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                {language === 'vi'
                  ? 'Bạn đã đăng ký thành công! Buổi học đã được đưa vào Lịch điểm danh và kích hoạt mã QR tự động.'
                  : 'You are successfully enrolled! Your session is now synced to your Attendance schedule.'}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1.5 text-left font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Thời gian:</span>
                <strong>{formatDate(classItem.date, language)} ({classItem.startTime} - {classItem.endTime})</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Địa điểm:</span>
                <strong>{classItem.roomVi || classItem.room || 'Sân VIBE Sport'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">HLV:</span>
                <strong>{classItem.coachName}</strong>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  if (typeof onNavigateAttendance === 'function') {
                    onNavigateAttendance();
                  }
                }}
                className="w-full sm:flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
              >
                <QrCode className="w-4 h-4 text-emerald-400" />
                <span>{language === 'vi' ? 'Xem mã QR điểm danh' : 'Go to QR Check-in'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="w-full sm:w-auto py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                {language === 'vi' ? 'Đăng ký thêm lớp' : 'Enroll more'}
              </button>
            </div>
          </div>
        ) : (
          /* Confirmation details before booking */
          <div className="space-y-4">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Class Summary Card */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-900 text-white">
                  {classItem.category || 'Thể thao'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                  {classItem.level || 'Cơ bản'} &bull; {classItem.batch || 'K01'}
                </span>
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900">
                  {classItem.nameVi || classItem.name}
                </h3>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-200/80 pt-2.5">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#BA0000] shrink-0" />
                  <span>
                    <strong>{formatDate(classItem.date, language)}</strong> &bull; {classItem.startTime} - {classItem.endTime} (90 phút)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#BA0000] shrink-0" />
                  <span>{classItem.roomVi || classItem.room || 'Sân tập VIBE Sport'} {classItem.roomSpec && `(${classItem.roomSpec})`}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-[#BA0000] shrink-0" />
                  <span>Huấn luyện viên: <strong className="text-slate-900">{classItem.coachName}</strong></span>
                </div>
              </div>
            </div>

            {/* Package Privileges & Policy notes */}
            <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-800">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Quyền lợi gói tập của bạn:</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-emerald-800">
                Lớp học này nằm trong quyền lợi gói <strong className="text-slate-900">{member?.currentPackageName || 'Hội viên tiêu chuẩn'}</strong>. Học viên được tham gia miễn phí và tích lũy điểm chuyên cần.
              </p>
            </div>

            <div className="space-y-1 text-[11px] text-slate-500 leading-normal pl-1">
              <div>&bull; Mã QR điểm danh tự động hiển thị trước giờ học 30 phút.</div>
              <div>&bull; Bạn có thể hủy đăng ký miễn phí trước giờ học tối thiểu 2 giờ.</div>
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {language === 'vi' ? 'Hủy bỏ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleEnroll}
                disabled={loading}
                className="px-5 py-2 bg-[#BA0000] hover:bg-[#8E0000] text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{language === 'vi' ? 'Đang xử lý...' : 'Processing...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{language === 'vi' ? 'Xác nhận ghi danh' : 'Confirm Enrollment'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
