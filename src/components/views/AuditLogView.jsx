import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { History, RefreshCw, Search } from 'lucide-react';
import { getAuditLogs } from '../../api/managerApi';
import { getErrorMessage } from '../../api/apiErrors';
import { UNAUTHORIZED_EVENT } from '../../api/httpClient';
import { formatAdminDateTime } from '../admin/adminDateUtils';

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
  const { auditLogs, apiEnabled, currentUser, t, language, showToast } = useSCMS();
  const [searchTerm, setSearchTerm] = useState('');
  const [resource, setResource] = useState({ scope: null, data: [], loaded: false, loading: false, error: null });
  const requestRef = useRef(0);
  const toastRef = useRef(showToast);
  const languageRef = useRef(language);
  toastRef.current = showToast;
  languageRef.current = language;
  const scope = String(currentUser?.id ?? currentUser?.email ?? '');
  const canView = !apiEnabled || (Array.isArray(currentUser?.authorities) && currentUser.authorities.includes('VIEW_AUDIT_LOG'));

  const reload = useCallback(async () => {
    if (!apiEnabled || !canView) return;
    const request = ++requestRef.current;
    setResource((previous) => previous.scope === scope
      ? { ...previous, loading: true }
      : { scope, data: [], loaded: false, loading: true, error: null });
    try {
      const data = await getAuditLogs({ notifyForbidden: false, notifyUnauthorized: false });
      if (request === requestRef.current) setResource({ scope, data, loaded: true, loading: false, error: null });
    } catch (error) {
      if (request === requestRef.current) {
        setResource((previous) => previous.scope === scope
          ? { ...previous, loading: false, error }
          : previous);
        if (error?.status === 401 && typeof window !== 'undefined') {
          toastRef.current?.(languageRef.current === 'vi' ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' : 'Your session has expired. Please sign in again.', 'error');
          window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
        }
      }
    }
  }, [apiEnabled, canView, scope]);

  useEffect(() => {
    reload();
    return () => { requestRef.current += 1; };
  }, [reload]);

  const current = resource.scope === scope ? resource : null;
  const error = apiEnabled ? current?.error : null;
  const accessError = [401, 403].includes(Number(error?.status));
  const loading = apiEnabled && canView && (!current || current.loading);
  const loaded = !apiEnabled || Boolean(current?.loaded);
  const logs = apiEnabled ? (canView && !accessError && current ? current.data : []) : auditLogs;
  const vi = language === 'vi';
  const errorMessage = !canView || error?.status === 403
    ? (vi ? 'Bạn không có quyền xem nhật ký hệ thống.' : 'You do not have permission to view audit logs.')
    : error?.status === 401
      ? (vi ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' : 'Your session has expired. Please sign in again.')
      : error?.status === 0
        ? (vi ? 'Không thể kết nối đến máy chủ. Vui lòng thử lại.' : 'Could not connect to the server. Please retry.')
        : error ? (vi ? `Không tải được nhật ký: ${getErrorMessage(error)}` : `Could not load audit logs: ${getErrorMessage(error)}`) : '';

  const filteredLogs = logs.filter(log =>
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

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
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
        {apiEnabled && canView && <button type="button" onClick={reload} disabled={loading} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded border border-slate-300 px-3 text-xs font-bold text-slate-700 disabled:opacity-50"><RefreshCw className="h-4 w-4" />{vi ? 'Tải lại' : 'Refresh'}</button>}
        </div>
      </div>

      {errorMessage && <div role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{errorMessage}{loaded && logs.length > 0 && !accessError && (vi ? ' Dữ liệu hiển thị có thể đã cũ.' : ' Displayed data may be out of date.')}</div>}
      {loading && <p role="status" className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-500">{vi ? 'Đang tải nhật ký hệ thống…' : 'Loading audit logs…'}</p>}
      {canView && !loading && !error && loaded && logs.length === 0 && <p className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-500">{vi ? 'Chưa có nhật ký hệ thống.' : 'No system audit logs.'}</p>}
      {canView && !loading && !error && loaded && logs.length > 0 && filteredLogs.length === 0 && <p className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-500">{vi ? 'Không tìm thấy nhật ký phù hợp.' : 'No matching audit logs.'}</p>}
      {/* Audit Log Data Table */}
      {filteredLogs.length > 0 && canView && !accessError && (
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider border-b border-slate-200 font-bold">
              <tr>
                <th className="py-3 px-4">{t('timestamp')}</th>
                <th className="py-3 px-4">{t('actor')}</th>
                <th className="py-3 px-4">{t('action')}</th>
                <th className="py-3 px-4">{t('target')}</th>
                {!apiEnabled && <th className="py-3 px-4">{language === 'vi' ? 'Trước → Sau' : 'Before → After'}</th>}
                <th className="py-3 px-4">{t('reason')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredLogs.map(log => {
                const actionDisplay = ACTION_LABELS[log.action]
                  ? (ACTION_LABELS[log.action][language] || log.action)
                  : log.action;

                const actorDisplay = language === 'en' && log.actorNameEn ? log.actorNameEn : log.actorName;
                const targetDisplay = apiEnabled ? log.target : language === 'en' && log.targetEn ? log.targetEn : cleanTargetText(log.target, language);
                const reasonDisplay = language === 'en' && log.reasonEn ? log.reasonEn : log.reason;

                return (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors h-[40px]">
                    <td className="py-2 px-4 text-slate-500 tabular-nums whitespace-nowrap">{formatAdminDateTime(typeof log.timestamp === 'string' ? log.timestamp.replace(' ', 'T') : log.timestamp, '—', vi ? 'Ngày không hợp lệ' : 'Invalid date')}</td>
                    <td className="py-2 px-4 font-bold text-slate-900 whitespace-nowrap">{actorDisplay || '—'}</td>
                    <td className="py-2 px-4 font-bold text-slate-900 whitespace-nowrap">{actionDisplay || '—'}</td>
                    <td className="py-2 px-4 text-slate-800 font-medium whitespace-nowrap">{targetDisplay || '—'}</td>
                    {!apiEnabled && <td className="py-2 px-4 text-xs whitespace-nowrap">
                      <span className="text-rose-800 font-semibold">{formatValue(log.previousValue, language)}</span>
                      <span className="text-slate-400 mx-1.5">&rarr;</span>
                      <span className="text-emerald-800 font-bold">{formatValue(log.newValue, language)}</span>
                    </td>}
                    <td className="py-2 px-4 text-slate-600 max-w-xs">{reasonDisplay || 'N/A'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 p-3 border-t border-slate-200 bg-slate-50">
          <span>
            {language === 'vi'
              ? `Hiển thị 1-${filteredLogs.length} của ${filteredLogs.length} nhật ký`
              : `Showing 1-${filteredLogs.length} of ${filteredLogs.length} log entries`}
          </span>
        </div>
      </div>
      )}
    </div>
  );
}
