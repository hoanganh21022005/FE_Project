import React, { useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { History, Search } from 'lucide-react';
import { formatDateTime } from '../../locales/translations';

const ACTION_LABELS = {
  PAYMENT_RECORDED: { vi: 'Ghi nhận thanh toán', en: 'Record Payment' },
  STAFF_ROLE_CHANGED: { vi: 'Thay đổi vai trò nhân viên', en: 'Change Staff Role' },
  ATTENDANCE_CORRECTED: { vi: 'Điều chỉnh điểm danh', en: 'Correct Attendance' },
  CREATE_MEMBER: { vi: 'Khởi tạo hội viên', en: 'Create Member' },
  BOOK_CLASS: { vi: 'Đăng ký lớp học', en: 'Book Class' },
  CANCEL_BOOKING: { vi: 'Hủy đăng ký lớp', en: 'Cancel Booking' },
  CREATE_CLASS: { vi: 'Tạo lớp học mới', en: 'Create Class' },
  STAFF_STATUS_CHANGED: { vi: 'Thay đổi trạng thái nhân viên', en: 'Change Staff Status' },
  UPDATE_TRAINING_PLAN: { vi: 'Cập nhật lộ trình tập luyện', en: 'Update Training Plan' },
};

const VALUE_TRANSLATIONS = {
  'Pending Payment': { vi: 'Chờ thanh toán', en: 'Pending Payment' },
  'Active': { vi: 'Hoạt động', en: 'Active' },
  'Coach Junior': { vi: 'HLV Sơ cấp', en: 'Coach Junior' },
  'Head Coach Strength': { vi: 'HLV Trưởng Thể lực', en: 'Head Coach Strength' },
  'Absent': { vi: 'Vắng mặt', en: 'Absent' },
  'Present': { vi: 'Có mặt', en: 'Present' },
  'Confirmed': { vi: 'Đã xác nhận', en: 'Confirmed' },
  'Cancelled': { vi: 'Đã hủy', en: 'Cancelled' },
  'In progress': { vi: 'Đang thực hiện', en: 'In progress' },
  'N/A': { vi: 'Không có', en: 'N/A' },
  'Chưa đăng ký': { vi: 'Chưa đăng ký', en: 'Unregistered' },
};

function formatValue(val, lang) {
  if (!val) return lang === 'vi' ? 'Không có' : 'N/A';
  if (VALUE_TRANSLATIONS[val]) {
    return VALUE_TRANSLATIONS[val][lang] || val;
  }
  return val;
}

function cleanTargetText(targetStr, lang) {
  if (!targetStr) return '';
  // Fix font / concatenation typos like "Hội viênễn" or "Nhân viênễn"
  let cleaned = targetStr
    .replace(/Hội viênễn/g, lang === 'vi' ? 'Hội viên Nguyễn' : 'Member Nguyen')
    .replace(/Nhân viênễn/g, lang === 'vi' ? 'Nhân viên Nguyễn' : 'Staff Nguyen')
    .replace(/Học viênễn/g, lang === 'vi' ? 'Học viên Nguyễn' : 'Member Nguyen');

  if (lang === 'en') {
    cleaned = cleaned
      .replace(/Hội viên/g, 'Member')
      .replace(/Nhân viên/g, 'Staff')
      .replace(/Học viên/g, 'Member')
      .replace(/\(Lớp Yoga\)/g, '(Yoga Class)');
  }
  return cleaned;
}

export function AuditLogView() {
  const { auditLogs, t, language } = useSCMS();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = auditLogs.filter(log =>
    (log.actorName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.target || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.reason && log.reason.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-lg shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 text-slate-800 rounded border border-slate-200">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">{t('auditLogs')}</h2>
            <p className="text-xs text-slate-500">
              {language === 'vi'
                ? 'Nhật ký truy vết thao tác hệ thống (dữ liệu chỉ đọc, không thể chỉnh sửa)'
                : 'System activity trail (immutable, read-only data)'}
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={language === 'vi' ? 'Tìm người thực hiện, hành động...' : 'Search actor, action...'}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white"
          />
        </div>
      </div>

      {/* Audit Log Data Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3 px-4">{t('timestamp')}</th>
                <th className="py-3 px-4">{t('actor')}</th>
                <th className="py-3 px-4">{t('action')}</th>
                <th className="py-3 px-4">{t('target')}</th>
                <th className="py-3 px-4">{language === 'vi' ? 'Trước → Sau' : 'Before → After'}</th>
                <th className="py-3 px-4">{t('reason')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredLogs.map(log => {
                const actionDisplay = ACTION_LABELS[log.action]
                  ? (ACTION_LABELS[log.action][language] || log.action)
                  : log.action;

                const actorDisplay = language === 'en' && log.actorNameEn ? log.actorNameEn : log.actorName;
                const targetDisplay = language === 'en' && log.targetEn ? log.targetEn : cleanTargetText(log.target, language);
                const reasonDisplay = language === 'en' && log.reasonEn ? log.reasonEn : log.reason;

                return (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors h-[40px]">
                    <td className="py-2 px-4 text-slate-500 tabular-nums whitespace-nowrap">{formatDateTime(log.timestamp, language)}</td>
                    <td className="py-2 px-4 font-bold text-slate-900 whitespace-nowrap">{actorDisplay}</td>
                    <td className="py-2 px-4 font-bold text-slate-900 whitespace-nowrap">{actionDisplay}</td>
                    <td className="py-2 px-4 text-slate-800 font-medium whitespace-nowrap">{targetDisplay}</td>
                    <td className="py-2 px-4 text-xs whitespace-nowrap">
                      <span className="text-rose-800 font-semibold">{formatValue(log.previousValue, language)}</span>
                      <span className="text-slate-400 mx-1.5">&rarr;</span>
                      <span className="text-emerald-800 font-bold">{formatValue(log.newValue, language)}</span>
                    </td>
                    <td className="py-2 px-4 text-slate-600 max-w-xs">{reasonDisplay || 'N/A'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        <div className="flex items-center justify-between text-xs text-slate-500 p-3 border-t border-slate-200 bg-slate-50">
          <span>
            {language === 'vi'
              ? `Hiển thị 1-${filteredLogs.length} của ${filteredLogs.length} nhật ký`
              : `Showing 1-${filteredLogs.length} of ${filteredLogs.length} log entries`}
          </span>
          <div className="flex items-center gap-1 text-[11px] tabular-nums">
            <button disabled className="px-2 py-1 bg-white border border-slate-200 rounded opacity-50 cursor-not-allowed">
              {language === 'vi' ? 'Trang trước' : 'Previous'}
            </button>
            <span className="px-2.5 py-1 bg-slate-900 text-white rounded font-bold">1</span>
            <button disabled className="px-2 py-1 bg-white border border-slate-200 rounded opacity-50 cursor-not-allowed">
              {language === 'vi' ? 'Trang sau' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
