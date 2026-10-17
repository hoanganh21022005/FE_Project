import React from 'react';
import { Check, Lock, QrCode } from 'lucide-react';

/**
 * SportTargetVisual (Architectural Sport Court Line-Art)
 * Standard dimensions:
 * - Pickleball: USA Pickleball 20×44 ft (7 ft kitchen on each net side, center line only in service boxes).
 * - Badminton: BWF 6.1m × 13.4m with doubles/singles sidelines and service boxes.
 * - Archery: World Archery Target Face rings.
 * Supports theme: 'light' | 'dark'.
 */
export function SportTargetVisual({
  category = 'Cầu lông',
  state = 'gate_locked', // 'upcoming' | 'gate_locked' | 'check_in_open' | 'checked_in' | 'completed' | 'absent'
  court = 'Sân 02',
  zone = 'Khu A · Thảm Taraflex',
  theme = 'light',
  onOpenQrPass,
}) {
  const normCategory = (category || '').toLowerCase();
  const isBadminton = normCategory.includes('cầu lông') || normCategory.includes('badminton');
  const isPickleball = normCategory.includes('pickleball');
  const isArchery = !isBadminton && !isPickleball;

  const isDark = theme === 'dark';
  const isCheckedIn = state === 'checked_in';
  const isCheckInOpen = state === 'check_in_open';
  const isLocked = state === 'gate_locked' || state === 'upcoming';

  const strokeMain = isDark ? '#F1F5F9' : '#0F172A';
  const strokeSub = isDark ? '#94A3B8' : '#64748B';
  const strokeMuted = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.15)';

  return (
    <div className="flex flex-col items-center justify-center space-y-3 w-full select-none">
      {/* Sơ đồ nét vẽ kiến trúc sắc gọn */}
      <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center">

        {/* 1. ARCHERY TARGET FACE */}
        {isArchery && (
          <svg
            viewBox="0 0 200 200"
            className={`w-full h-full fill-none transition-opacity duration-300 ${
              isLocked ? 'opacity-40' : 'opacity-100'
            }`}
          >
            <circle cx="100" cy="100" r="92" stroke={strokeMuted} strokeWidth="0.8" />
            <circle cx="100" cy="100" r="76" stroke={strokeSub} strokeDasharray="3 3" strokeWidth="0.8" />
            <circle cx="100" cy="100" r="60" stroke={strokeMain} strokeWidth="1" />
            <circle cx="100" cy="100" r="44" stroke={strokeMain} strokeWidth="1" />
            <circle cx="100" cy="100" r="28" stroke={strokeMain} strokeWidth="1" />
            <circle cx="100" cy="100" r="12" fill="#B89A66" fillOpacity={isDark ? "0.3" : "0.2"} stroke="#B89A66" strokeWidth="1.2" />
            {/* Crosshairs */}
            <line x1="100" y1="4" x2="100" y2="196" stroke={strokeSub} strokeWidth="0.75" />
            <line x1="4" y1="100" x2="196" y2="100" stroke={strokeSub} strokeWidth="0.75" />
          </svg>
        )}

        {/* 2. BADMINTON COURT (BWF Standard Proportions) */}
        {isBadminton && (
          <svg
            viewBox="0 0 200 200"
            className={`w-full h-full fill-none transition-opacity duration-300 ${
              isLocked ? 'opacity-40' : 'opacity-100'
            }`}
          >
            {/* Outer court boundary (13.4m × 6.1m) */}
            <rect x="52" y="16" width="96" height="168" stroke={strokeMain} strokeWidth="1.5" />
            {/* Singles sidelines (5.18m wide) */}
            <line x1="60" y1="16" x2="60" y2="184" stroke={strokeSub} strokeWidth="0.8" />
            <line x1="140" y1="16" x2="140" y2="184" stroke={strokeSub} strokeWidth="0.8" />
            {/* Doubles back service lines */}
            <line x1="52" y1="26" x2="148" y2="26" stroke={strokeSub} strokeWidth="0.8" />
            <line x1="52" y1="174" x2="148" y2="174" stroke={strokeSub} strokeWidth="0.8" />
            {/* Short service lines */}
            <line x1="52" y1="76" x2="148" y2="76" stroke={strokeSub} strokeWidth="0.8" />
            <line x1="52" y1="124" x2="148" y2="124" stroke={strokeSub} strokeWidth="0.8" />
            {/* Center line */}
            <line x1="100" y1="16" x2="100" y2="76" stroke={strokeSub} strokeWidth="0.8" />
            <line x1="100" y1="124" x2="100" y2="184" stroke={strokeSub} strokeWidth="0.8" />
            {/* Center Net */}
            <line x1="46" y1="100" x2="154" y2="100" stroke={strokeMain} strokeWidth="1.5" strokeDasharray="3 2" />
            <circle cx="46" cy="100" r="1.5" fill={strokeMain} />
            <circle cx="154" cy="100" r="1.5" fill={strokeMain} />
          </svg>
        )}

        {/* 3. PICKLEBALL COURT (USA Pickleball Standard 20×44 ft) */}
        {isPickleball && (
          <svg
            viewBox="0 0 200 200"
            className={`w-full h-full fill-none transition-opacity duration-300 ${
              isLocked ? 'opacity-40' : 'opacity-100'
            }`}
          >
            {/* Outer court boundary (20 ft wide × 44 ft long -> ratio 72×158 px) */}
            <rect x="64" y="21" width="72" height="158" stroke={strokeMain} strokeWidth="1.5" rx="0.5" />

            {/* Non-Volley Zone (Kitchen): 7 ft on each side of net (total 14 ft = 50 px) */}
            <rect
              x="64"
              y="75"
              width="72"
              height="50"
              fill={isDark ? "rgba(184, 154, 102, 0.15)" : "rgba(184, 154, 102, 0.08)"}
              stroke="none"
            />
            {/* Non-volley zone lines (7 ft from net) */}
            <line x1="64" y1="75" x2="136" y2="75" stroke={strokeSub} strokeWidth="1" />
            <line x1="64" y1="125" x2="136" y2="125" stroke={strokeSub} strokeWidth="1" />

            {/* Center service lines (stops at non-volley line, does not cut kitchen) */}
            <line x1="100" y1="21" x2="100" y2="75" stroke={strokeSub} strokeWidth="0.9" />
            <line x1="100" y1="125" x2="100" y2="179" stroke={strokeSub} strokeWidth="0.9" />

            {/* Net (at y=100 with posts extending slightly outside court) */}
            <line x1="58" y1="100" x2="142" y2="100" stroke={strokeMain} strokeWidth="1.75" strokeDasharray="3 2" />
            <circle cx="58" cy="100" r="1.5" fill={strokeMain} />
            <circle cx="142" cy="100" r="1.5" fill={strokeMain} />

            {/* Kitchen subtle label inside NVZ */}
            <text
              x="100"
              y="103"
              textAnchor="middle"
              className="text-[7px] font-sans font-semibold tracking-wider select-none pointer-events-none"
              fill={isDark ? "rgba(255,255,255,0.4)" : "rgba(15,23,42,0.3)"}
            >
              KITCHEN (7 FT)
            </text>
          </svg>
        )}

        {/* Trạng thái khóa: Ổ khóa đặt tinh tế ở góc trên bên phải */}
        {isLocked && (
          <div
            className={`absolute top-1 right-1 p-1.5 rounded-full ${
              isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'
            }`}
            title="Cổng soát vé đang khóa"
          >
            <Lock className="w-3.5 h-3.5 stroke-[1.5]" />
          </div>
        )}

        {/* Trạng thái mở check-in */}
        {isCheckInOpen && (
          <button
            type="button"
            onClick={onOpenQrPass}
            className="absolute bottom-1 right-1 p-2 rounded-md bg-[#B89A66] hover:bg-[#A3834C] text-white cursor-pointer transition-colors shadow-sm"
            title="Nhấn để phóng to mã QR quét tại cổng"
          >
            <QrCode className="w-4 h-4 stroke-[1.5]" />
          </button>
        )}

        {/* Trạng thái đã check-in: Tick xanh rêu sắc sảo ở góc */}
        {isCheckedIn && (
          <div
            className="absolute top-1 right-1 p-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            title="Quý khách đã hoàn tất check-in vào sân"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
        )}
      </div>

      {/* Caption nhỏ đặt bên dưới sân */}
      <div className="text-center space-y-0.5 max-w-[220px]">
        <div className={`text-[13px] font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {court}
        </div>
        <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {zone}
        </div>
      </div>
    </div>
  );
}
