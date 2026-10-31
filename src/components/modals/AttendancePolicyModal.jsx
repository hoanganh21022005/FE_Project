import React from 'react';
import {
  Clock,
  X,
  Calendar,
  AlertCircle
} from 'lucide-react';

/**
 * SINGLE SOURCE OF TRUTH: ATTENDANCE & GATE ACCESS POLICY
 * Easily maintained in a single configuration object.
 */
export const ATTENDANCE_POLICY = {
  version: '1.2',
  effectiveDate: '01/09/2026',
  gateOpenMinutesBefore: 30, // Cổng mở trước giờ học 30 phút
  onTimeMinutesAfter: 15,     // Trong 15 phút đầu: Đúng giờ
  lateCutoffMinutes: 45,      // Từ phút 16 đến 45: Đi muộn (vẫn tính có mặt)
                              // Sau 45 phút: Khóa cổng, tính Vắng mặt
  minAttendanceRate: 75,      // 75% chuyên cần
  thresholdSessions: 9,
  totalSessions: 12,
  maxAbsent: 3,               // Hạn mức vắng tối đa 3 buổi/khóa
  warningAbsentRemaining: 1,  // Cảnh báo khi còn 1 buổi vắng cuối cùng
  leaveNoticeHours: 12,       // Thời hạn báo trước khi xin nghỉ qua app
  otpRefreshSeconds: 30,      // Mã OTP bảo mật đổi mỗi 30 giây
};

export function AttendancePolicyModal({ isOpen, onClose, language = 'vi' }) {
  if (!isOpen) return null;

  const policy = ATTENDANCE_POLICY;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#202B46]/75 backdrop-blur-xs animate-in fade-in duration-200 font-['Be_Vietnam_Pro',sans-serif]">
      <div className="bg-[#FFFFFF] text-[#202B46] rounded-xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-[rgba(222,228,240,0.9)] space-y-6 max-h-[90vh] overflow-y-auto">
        
        {/* Header: Editorial Luxury Club Style */}
        <div className="flex items-start justify-between gap-4 border-b border-[rgba(21,23,28,0.1)] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-px w-5 bg-[#24A9D2]" />
              <span className="text-[11px] font-sans font-medium uppercase tracking-[0.14em] text-[#6B7890]">
                VIBE ATHLETIC CLUB • NỘI QUY HOẠT ĐỘNG
              </span>
            </div>
            <h2 className="font-sans font-normal text-2xl sm:text-3xl text-[#202B46] tracking-tight">
              {language === 'vi' ? 'Quy định điểm danh & vào sân' : 'Attendance & Gate Access Policy'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#6B7890] hover:text-[#202B46] rounded transition-colors cursor-pointer"
            title="Đóng quy định (ESC)"
          >
            <X className="w-5 h-5 stroke-[1.75]" />
          </button>
        </div>

        {/* 3 Large Key Metric Numbers (Quick glance for members) */}
        <div className="grid grid-cols-3 gap-3 p-4 rounded-lg bg-[#F5F7FC] border border-[rgba(222,228,240,0.7)]">
          <div className="space-y-1">
            <div className="font-sans text-2xl sm:text-3xl font-normal text-[#202B46] leading-none tabular-nums">
              {policy.minAttendanceRate}%
            </div>
            <div className="text-[11px] text-[#6B7890] leading-snug">
              Tỉ lệ có mặt tối thiểu ({policy.thresholdSessions}/{policy.totalSessions} buổi)
            </div>
          </div>
          <div className="space-y-1 border-l border-[rgba(21,23,28,0.1)] pl-3 sm:pl-4">
            <div className="font-sans text-2xl sm:text-3xl font-normal text-[#202B46] leading-none tabular-nums">
              {policy.maxAbsent} buổi
            </div>
            <div className="text-[11px] text-[#6B7890] leading-snug">
              Hạn mức vắng tối đa cho cả khóa
            </div>
          </div>
          <div className="space-y-1 border-l border-[rgba(21,23,28,0.1)] pl-3 sm:pl-4">
            <div className="font-sans text-2xl sm:text-3xl font-normal text-[#202B46] leading-none tabular-nums">
              {policy.leaveNoticeHours} giờ
            </div>
            <div className="text-[11px] text-[#6B7890] leading-snug">
              Thời hạn báo trước khi xin nghỉ
            </div>
          </div>
        </div>

        {/* Horizontal Visual Timeline (Zero clutter, easy comprehension) */}
        <div className="space-y-2.5 p-4 rounded-lg bg-[#F5F7FC] border border-[rgba(222,228,240,0.7)]">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#6B7890] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#24A9D2]" />
            <span>Trục thời gian điểm danh theo buổi học</span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center relative pt-3 pb-1">
            {/* Connecting baseline */}
            <div className="absolute top-[21px] left-6 right-6 h-0.5 bg-[rgba(21,23,28,0.1)] -z-0" />

            {/* Point 1: -30m */}
            <div className="relative z-10 space-y-2">
              <div className="w-4 h-4 rounded-full bg-[#202B46] text-[#FFFFFF] mx-auto ring-4 ring-[#F5F7FC] flex items-center justify-center text-[9px] font-bold">
                1
              </div>
              <div className="space-y-0.5">
                <div className="text-[11px] font-semibold text-[#202B46] tracking-wide">
                  -30 PHÚT
                </div>
                <div className="text-[11px] text-[#6B7890] leading-tight">
                  Mở mã QR vào sân
                </div>
              </div>
            </div>

            {/* Point 2: Start to +15m */}
            <div className="relative z-10 space-y-2">
              <div className="w-4 h-4 rounded-full bg-[#15803D] text-[#FFFFFF] mx-auto ring-4 ring-[#F5F7FC] flex items-center justify-center text-[9px] font-bold">
                2
              </div>
              <div className="space-y-0.5">
                <div className="text-[11px] font-semibold text-[#15803D] tracking-wide">
                  BẮT ĐẦU (0P)
                </div>
                <div className="text-[11px] text-[#6B7890] leading-tight">
                  Có mặt đúng giờ
                </div>
              </div>
            </div>

            {/* Point 3: +15m to +45m */}
            <div className="relative z-10 space-y-2">
              <div className="w-4 h-4 rounded-full bg-[#24A9D2] text-[#FFFFFF] mx-auto ring-4 ring-[#F5F7FC] flex items-center justify-center text-[9px] font-bold">
                3
              </div>
              <div className="space-y-0.5">
                <div className="text-[11px] font-semibold text-[#B45309] tracking-wide">
                  +15 PHÚT
                </div>
                <div className="text-[11px] text-[#6B7890] leading-tight">
                  Ghi nhận Đi muộn*
                </div>
              </div>
            </div>

            {/* Point 4: After +45m */}
            <div className="relative z-10 space-y-2">
              <div className="w-4 h-4 rounded-full bg-[#202B46] text-[#FFFFFF] mx-auto ring-4 ring-[#F5F7FC] flex items-center justify-center text-[9px] font-bold">
                4
              </div>
              <div className="space-y-0.5">
                <div className="text-[11px] font-semibold text-[#202B46] tracking-wide">
                  +45 PHÚT
                </div>
                <div className="text-[11px] text-[#6B7890] leading-tight">
                  Khóa cổng · Vắng mặt
                </div>
              </div>
            </div>
          </div>
          <div className="text-[11px] text-[#6B7890] italic pt-1 border-t border-[rgba(21,23,28,0.06)] text-center">
            *Lưu ý: Buổi đi muộn vẫn được tính là buổi có mặt trong điều kiện xét chứng chỉ hoàn thành.
          </div>
        </div>

        {/* Detailed Policy Sections (Editorial Layout without nested gray boxes) */}
        <div className="divide-y divide-[rgba(222,228,240,0.7)] space-y-4 pt-1">

          {/* Section 01: Turnstile & QR */}
          <div className="space-y-2.5 pt-4 first:pt-0">
            <div className="flex items-center gap-2">
              <span className="font-sans italic text-base text-[#24A9D2] font-medium">01</span>
              <h3 className="text-sm font-semibold text-[#202B46]">
                Quy định quét mã QR & Vào sân
              </h3>
            </div>
            <ul className="space-y-2 text-sm text-[#6B7890] leading-[1.65] pl-5 list-disc marker:text-[#24A9D2]">
              <li>
                <strong className="text-[#202B46] font-medium">Thời gian mở mã:</strong> Mã QR động bắt đầu hiển thị trên ứng dụng trước giờ học <span className="text-[#202B46] font-medium">{policy.gateOpenMinutesBefore} phút</span>. Trước thời điểm này, mã sẽ được khóa bảo mật.
              </li>
              <li>
                <strong className="text-[#202B46] font-medium">Bảo mật mã số:</strong> Mã QR tự động làm mới mã bảo mật mỗi <span className="text-[#202B46] font-medium">{policy.otpRefreshSeconds} giây</span> để ngăn chặn hành vi chụp màn hình hoặc chia sẻ thẻ trái phép.
              </li>
              <li>
                <strong className="text-[#202B46] font-medium">Quy định đi muộn:</strong> Quét mã sau giờ vào lớp từ phút thứ 1 đến phút 15 được ghi nhận trạng thái <span className="text-[#202B46] font-medium">Đi muộn</span>. Đi muộn vẫn được tính là một buổi có mặt để xét điều kiện hoàn thành khóa.
              </li>
              <li>
                <strong className="text-[#202B46] font-medium">Khóa điểm danh:</strong> Sau <span className="text-[#202B46] font-medium">{policy.lateCutoffMinutes} phút</span> kể từ giờ bắt đầu lớp, cổng soát vé tự động khóa điểm danh và hệ thống tự động ghi nhận trạng thái <span className="text-[#202B46] font-medium">Vắng mặt</span>.
              </li>
            </ul>
          </div>

          {/* Section 02: Graduation Standards */}
          <div className="space-y-2.5 pt-4">
            <div className="flex items-center gap-2">
              <span className="font-sans italic text-base text-[#24A9D2] font-medium">02</span>
              <h3 className="text-sm font-semibold text-[#202B46]">
                Tiêu chuẩn chuyên cần & Hoàn thành khóa học
              </h3>
            </div>
            <ul className="space-y-2 text-sm text-[#6B7890] leading-[1.65] pl-5 list-disc marker:text-[#24A9D2]">
              <li>
                <strong className="text-[#202B46] font-medium">Tỉ lệ chuyên cần tối thiểu:</strong> Hội viên cần đạt tỉ lệ có mặt từ <span className="text-[#202B46] font-medium">≥ {policy.minAttendanceRate}%</span> tổng số buổi ({policy.thresholdSessions}/{policy.totalSessions} buổi) để được cấp chứng nhận hoàn thành khóa học và đủ điều kiện tham gia giải đấu nội bộ.
              </li>
              <li>
                <strong className="text-[#202B46] font-medium">Hạn mức vắng cho phép:</strong> Tối đa <span className="text-[#202B46] font-medium">{policy.maxAbsent} buổi/khóa</span>. Khi chỉ còn <span className="text-[#202B46] font-medium">1 buổi vắng cuối cùng</span> (đã vắng 2/3 buổi cho phép), hệ thống sẽ gửi thông báo cảnh báo chuyên cần tới hội viên.
              </li>
              <li>
                <strong className="text-[#202B46] font-medium">Xin phép nghỉ có báo trước:</strong> Kênh tiếp nhận chính là tính năng <strong className="text-[#202B46] font-medium">Xin nghỉ</strong> trực tiếp trên ứng dụng VIBE Athletic, yêu cầu gửi đơn trước tối thiểu <span className="text-[#202B46] font-medium">{policy.leaveNoticeHours} giờ</span> để được bảo lưu quyền lợi và bố trí buổi tập bù. Trường hợp khẩn cấp dưới 12 giờ, quý hội viên vui lòng liên hệ trực tiếp HLV hoặc Lễ tân để được hỗ trợ.
              </li>
            </ul>
          </div>

          {/* Section 03: Disputes & Ground Assistance */}
          <div className="space-y-2.5 pt-4">
            <div className="flex items-center gap-2">
              <span className="font-sans italic text-base text-[#24A9D2] font-medium">03</span>
              <h3 className="text-sm font-semibold text-[#202B46]">
                Khiếu nại & Hỗ trợ tại sân
              </h3>
            </div>
            <p className="text-sm text-[#6B7890] leading-[1.65]">
              Nếu gặp sự cố điện thoại hết pin, máy quét cổng không nhận diện hoặc bị ghi nhận nhầm trạng thái vắng, bạn hãy nhấn nút <strong className="text-[#202B46] font-semibold">"Báo sai điểm danh"</strong> ngay tại danh sách lịch sử buổi học trên ứng dụng hoặc liên hệ trực tiếp HLV / Lễ tân sảnh A để được đối soát dữ liệu camera an ninh và cập nhật điểm danh chuẩn xác trong vòng 24 giờ.
            </p>
          </div>

        </div>

        {/* Footer: Quiet Luxury Style */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-[rgba(21,23,28,0.1)]">
          <div className="text-xs text-[#6B7890] font-normal">
            Áp dụng toàn bộ hệ thống cơ sở VIBE Athletic Club • Phiên bản {policy.version} (Hiệu lực từ {policy.effectiveDate})
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-[#202B46] hover:bg-[#303B58] text-[#FFFFFF] rounded text-xs font-medium transition-colors cursor-pointer shrink-0"
          >
            {language === 'vi' ? 'Tôi đã hiểu quy định' : 'Understood'}
          </button>
        </div>

      </div>
    </div>
  );
}
