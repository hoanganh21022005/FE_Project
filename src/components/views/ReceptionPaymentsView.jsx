import React, { useState, useEffect, useCallback, useId, useRef } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { formatCurrency, formatDateTime } from '../../locales/translations';
import { StatusBadge } from '../common/Badge';
import { PaymentModal } from '../modals/PaymentModal';
import { invoiceApi } from '../../api/invoiceApi';
import { getErrorMessage } from '../../api/apiErrors';
import {
  applyMockPaymentSettlements,
  settleMockPaymentFixture,
  subscribeMockSettlement,
} from '../../utils/mockFixtureSettlement';
import {
  CreditCard,
  PlusCircle,
  CheckCircle2,
  Filter,
  Search,
  RefreshCw,
  AlertTriangle,
  Loader2,
  DollarSign,
  X,
  FileCheck,
  Info
} from 'lucide-react';

export function ReceptionPaymentsView() {
  const {
    payments: contextPayments,
    members,
    recordPayment,
    t,
    language,
    apiEnabled,
    currentUser,
    showToast,
  } = useSCMS();

  const [isPayOpen, setIsPayOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [, setSettlementTick] = useState(0);

  // Subscribe to fixture settlement changes
  useEffect(() => {
    return subscribeMockSettlement(() => setSettlementTick((c) => c + 1));
  }, []);

  // API State
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const invoicesRequestId = useRef(0);

  // Cash confirmation modal
  const [confirmingInvoice, setConfirmingInvoice] = useState(null);
  const [cashNotes, setCashNotes] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);
  const confirmingRequestRef = useRef(false);

  const searchInputId = useId();
  const statusSelectId = useId();

  const canConfirmCash = !apiEnabled || (
    String(currentUser?.role || '').toLowerCase() === 'receptionist'
    && Array.isArray(currentUser?.authorities)
    && currentUser.authorities.includes('MANAGE_INVOICES')
  );

  const fetchInvoices = useCallback(async () => {
    if (!apiEnabled) return;
    const requestId = ++invoicesRequestId.current;
    setLoading(true);
    setError(null);
    try {
      const backendStatus = statusFilter === 'successful'
        ? 'Paid'
        : statusFilter === 'pending'
          ? 'Pending'
          : statusFilter === 'cancelled'
            ? 'Cancelled'
            : statusFilter === 'expired'
              ? 'Expired'
              : statusFilter === 'failed'
                ? 'Failed'
            : undefined;
      const data = await invoiceApi.getInvoices({
        status: backendStatus,
        keyword: searchTerm,
      }, { notifyForbidden: false });
      if (requestId === invoicesRequestId.current) setInvoices(Array.isArray(data) ? data : []);
    } catch (err) {
      if (requestId === invoicesRequestId.current) setError(getErrorMessage(err, 'Không thể tải danh sách giao dịch thu tiền từ máy chủ.'));
    } finally {
      if (requestId === invoicesRequestId.current) setLoading(false);
    }
  }, [apiEnabled, statusFilter, searchTerm]);

  useEffect(() => {
    if (apiEnabled) {
      fetchInvoices();
    }
  }, [apiEnabled, fetchInvoices]);

  const rawList = apiEnabled ? invoices : applyMockPaymentSettlements(contextPayments);

  const filteredResults = rawList.filter((item) => {
    const itemStatus = apiEnabled ? item.paymentStatus : item.status;
    if (statusFilter !== 'all' && itemStatus !== statusFilter) {
      return false;
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const code = String(item.code || item.transactionNo || item.invoiceId || '').toLowerCase();
      const name = String(item.memberName || '').toLowerCase();
      if (!code.includes(q) && !name.includes(q)) {
        return false;
      }
    }

    return true;
  });
  const filteredPayments = apiEnabled && error && invoices.length > 0 ? invoices : filteredResults;

  // Action: Confirm Cash Payment for Pending Invoice
  const handleExecuteCashPayment = async (e) => {
    e.preventDefault();
    if (!confirmingInvoice || confirmingRequestRef.current) return;

    confirmingRequestRef.current = true;
    setIsConfirming(true);
    setConfirmError(null);

    if (apiEnabled) {
      try {
        const updatedInvoice = await invoiceApi.confirmCashPayment(confirmingInvoice.invoiceId, { notifyForbidden: false });
        if (updatedInvoice) {
          setInvoices((previous) => previous.map((invoice) => (
            String(invoice.invoiceId) === String(updatedInvoice.invoiceId) ? updatedInvoice : invoice
          )));
        }
        showToast?.(
          language === 'vi'
            ? `Đã xác nhận thu tiền mặt cho hóa đơn #${updatedInvoice?.code || confirmingInvoice.code || confirmingInvoice.invoiceId} thành công!`
            : 'Cash payment confirmed successfully!',
          'success'
        );
        setConfirmingInvoice(null);
        await fetchInvoices();
      } catch (err) {
        setConfirmError(getErrorMessage(err, language === 'vi' ? 'Không thể xác nhận thanh toán hóa đơn.' : 'Could not confirm invoice payment.'));
      } finally {
        confirmingRequestRef.current = false;
        setIsConfirming(false);
      }
      return;
    } else {
      // Mock mode: settle original pending fixture in-place (no duplicate record)
      const res = settleMockPaymentFixture(confirmingInvoice, {
        notes: cashNotes.trim() || (language === 'vi' ? 'Thu tiền mặt tại quầy lễ tân' : 'Cash desk collection'),
        receptionistName: currentUser?.name || (language === 'vi' ? 'Lễ tân' : 'Receptionist'),
      });

      if (!res.ok) {
        setConfirmError(res.error);
        confirmingRequestRef.current = false;
        setIsConfirming(false);
        return;
      }

      showToast?.(
        language === 'vi'
          ? `Đã xác nhận thu tiền mặt cho hóa đơn #${confirmingInvoice.code || confirmingInvoice.transactionNo || confirmingInvoice.invoiceId || confirmingInvoice.id} thành công!`
          : `Cash payment confirmed successfully!`,
        'success'
      );
      setConfirmingInvoice(null);
      confirmingRequestRef.current = false;
      setIsConfirming(false);
    }
  };

  return (
    <div className="space-y-6 text-[#181818]">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
            <CreditCard className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 whitespace-nowrap">{t('payments')}</h2>
            <p className="text-xs text-slate-500">
              {language === 'vi'
                ? 'Thu tiền trực tiếp tại quầy, xác nhận thanh toán & kích hoạt Membership'
                : 'Collect desk payments, confirm cash & activate memberships'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {apiEnabled && (
            <button
              type="button"
              onClick={fetchInvoices}
              disabled={loading}
              title={language === 'vi' ? 'Tải lại danh sách' : 'Refresh'}
              className="min-h-[44px] min-w-[44px] px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-bold flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-700' : ''}`} />
            </button>
          )}

          {!apiEnabled && <button
            onClick={() => setIsPayOpen(true)}
            className="min-h-[44px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{language === 'vi' ? 'Ghi Nhận Giao Dịch Mới' : 'New Desk Payment'}</span>
          </button>}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id={searchInputId}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              language === 'vi'
                ? 'Tìm mã hóa đơn, tên thành viên...'
                : 'Search invoice code, member name...'
            }
            className="w-full min-h-[44px] pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#BA0000] focus:ring-2 focus:ring-[#D62323]/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <select
            id={statusSelectId}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-[44px] bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#BA0000] focus:ring-2 focus:ring-[#D62323]/20"
          >
            <option value="all">{language === 'vi' ? 'Tất cả trạng thái' : 'All statuses'}</option>
            <option value="pending">{language === 'vi' ? 'Chờ thu tiền (Pending)' : 'Pending'}</option>
            <option value="successful">{language === 'vi' ? 'Đã thu tiền (Successful)' : 'Successful'}</option>
            <option value="cancelled">{language === 'vi' ? 'Đã hủy (Cancelled)' : 'Cancelled'}</option>
            {apiEnabled && <>
              <option value="expired">{language === 'vi' ? 'Hết hạn (Expired)' : 'Expired'}</option>
              <option value="failed">{language === 'vi' ? 'Thất bại (Failed)' : 'Failed'}</option>
            </>}
          </select>
        </div>
      </div>

      {/* Loading state */}
      {apiEnabled && loading && (
        <div className="py-12 bg-white border border-slate-200 rounded-lg text-center">
          <Loader2 className="w-8 h-8 text-emerald-700 animate-spin mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-700">
            {language === 'vi' ? 'Đang tải danh sách thu tiền từ máy chủ...' : 'Loading payments...'}
          </p>
        </div>
      )}

      {/* Error state */}
      {apiEnabled && error && (
        <div className="p-5 bg-white border border-rose-200 rounded-lg text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <p className="text-sm font-bold text-rose-800">{language === 'vi' ? 'Lỗi tải dữ liệu' : 'Error'}</p>
          <p className="text-xs text-slate-600">{error}</p>
          <button
            onClick={fetchInvoices}
            className="min-h-[44px] px-4 py-2 bg-[#BA0000] hover:bg-[#8E0000] text-white rounded text-xs font-bold flex items-center gap-2 mx-auto cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Thử lại' : 'Retry'}</span>
          </button>
        </div>
      )}

      {/* Transactions List */}
      {(!apiEnabled || (!loading && (!error || invoices.length > 0))) && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            {language === 'vi' ? 'Lịch Sử Giao Dịch Thu Tiền Tại Quầy' : 'Desk Collection Transactions'}
          </h3>

          {filteredPayments.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              <FileCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">
                {language === 'vi' ? 'Chưa có bản ghi giao dịch thu tiền nào.' : 'No payment records found.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">{language === 'vi' ? 'Mã GD' : 'Code'}</th>
                    <th className="py-2.5 px-3">{language === 'vi' ? 'Thành Viên' : 'Member'}</th>
                    <th className="py-2.5 px-3">{language === 'vi' ? 'Gói Dịch Vụ' : 'Package'}</th>
                    <th className="py-2.5 px-3 text-right">{language === 'vi' ? 'Số Tiền (VND)' : 'Amount'}</th>
                    <th className="py-2.5 px-3">{language === 'vi' ? 'Phương Thức' : 'Method'}</th>
                    <th className="py-2.5 px-3">{language === 'vi' ? 'Thời Gian' : 'Date'}</th>
                    <th className="py-2.5 px-3 text-center">{language === 'vi' ? 'Trạng Thái' : 'Status'}</th>
                    <th className="py-2.5 px-3 text-center">{language === 'vi' ? 'Thao Tác Quầy' : 'Desk Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {filteredPayments.map((p) => {
                    const isApi = apiEnabled;
                    const code = isApi ? (p.code || '—') : (p.code || p.transactionNo);
                    const status = isApi ? p.paymentStatus : p.status;
                    const isPending = status === 'pending';

                    return (
                      <tr key={p.id || p.invoiceId} className="hover:bg-slate-50 h-[44px]">
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 tabular-nums">
                          {code}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900">
                          <div>{p.memberName || `Hội viên #${p.memberId}`}</div>
                          {p.memberPhone && <div className="text-[11px] font-normal text-slate-500">{p.memberPhone}</div>}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-700">
                          {p.packageName || 'Gói dịch vụ'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {p.amount == null ? '—' : formatCurrency(p.amount, language)}
                        </td>
                        <td className="py-2 px-3 uppercase text-[11px] font-mono text-slate-600">
                          {p.paymentMethod || p.method || '—'}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-500 tabular-nums">
                          {p.paymentDate || p.createdAt || '—'}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <StatusBadge type="payment" status={status} />
                        </td>
                        <td className="py-2 px-3 text-center">
                          {isPending && canConfirmCash ? (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmingInvoice(p);
                                setConfirmError(null);
                                setCashNotes('');
                              }}
                              className="min-h-[36px] px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold inline-flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>{language === 'vi' ? 'Thu tiền mặt' : 'Collect Cash'}</span>
                            </button>
                          ) : isPending ? (
                            <span aria-label={language === 'vi' ? 'Không có quyền thu tiền' : 'Not authorized'}>—</span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              {language === 'vi' ? 'Đã hoàn tất' : 'Completed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Cash Collection Confirmation Modal */}
      {confirmingInvoice && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto"
        >
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-md shadow-xl p-6 text-[#181818]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div className="flex items-center gap-2 font-bold text-sm text-[#181818]">
                <DollarSign className="w-5 h-5 text-emerald-700" />
                <span>{language === 'vi' ? 'Xác nhận thu tiền mặt tại quầy' : 'Confirm Cash Payment'}</span>
              </div>
              <button
                type="button"
                onClick={() => setConfirmingInvoice(null)}
                aria-label="Đóng"
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteCashPayment} className="space-y-4 text-xs">
              {confirmError && (
                <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded text-rose-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 font-semibold">{confirmError}</div>
                </div>
              )}

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600 font-semibold">Mã Hóa Đơn:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {confirmingInvoice.code || (apiEnabled ? '—' : `INV-${confirmingInvoice.invoiceId}`)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-semibold">Hội Viên:</span>
                  <span className="font-bold text-slate-900">{confirmingInvoice.memberName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-semibold">Gói Dịch Vụ:</span>
                  <span className="font-bold text-slate-900">{confirmingInvoice.packageName}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-emerald-200">
                  <span className="text-slate-800 font-bold">Số tiền cần thu:</span>
                  <span className="text-base font-extrabold font-mono text-emerald-800 tabular-nums">
                    {confirmingInvoice.amount == null ? '—' : formatCurrency(confirmingInvoice.amount, language)}
                  </span>
                </div>
              </div>

              {!apiEnabled && <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === 'vi' ? 'Ghi chú biên lai / Mã phiếu thu' : 'Receipt Note'}
                </label>
                <input
                  type="text"
                  value={cashNotes}
                  onChange={(e) => setCashNotes(e.target.value)}
                  disabled={isConfirming}
                  placeholder={language === 'vi' ? 'Ví dụ: Đã nhận đủ tiền mặt từ hội viên...' : 'Receipt notes...'}
                  className="w-full min-h-[44px] bg-slate-50 border border-slate-300 rounded px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#BA0000] focus:ring-2 focus:ring-[#D62323]/20"
                />
              </div>}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setConfirmingInvoice(null)}
                  disabled={isConfirming}
                  className="min-h-[44px] px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded cursor-pointer"
                >
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isConfirming || !canConfirmCash}
                  className="min-h-[44px] px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConfirming && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {isConfirming
                      ? (language === 'vi' ? 'Đang xác nhận...' : 'Confirming...')
                      : (language === 'vi' ? 'Xác nhận đã thu tiền' : 'Confirm Cash Received')}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {!apiEnabled && <PaymentModal
        isOpen={isPayOpen}
        onClose={() => setIsPayOpen(false)}
        onSuccess={() => {
          if (apiEnabled) {
            fetchInvoices();
          }
        }}
      />}
    </div>
  );
}

export default ReceptionPaymentsView;
