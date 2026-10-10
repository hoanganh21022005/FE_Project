import React, { useState, useEffect, useCallback, useId } from 'react';
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
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  Loader2,
  X,
  Eye,
  CheckCircle2,
  Calendar,
  FileText,
  Info
} from 'lucide-react';

export function PaymentManagement() {
  const {
    payments: contextPayments,
    packages,
    recordPayment,
    t,
    language,
    apiEnabled,
    currentUser,
    showToast,
  } = useSCMS();

  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
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

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const searchInputId = useId();
  const statusFilterId = useId();
  const methodFilterId = useId();

  const paymentMethods = {
    bank_transfer: language === 'vi' ? 'Chuyển khoản' : 'Bank transfer',
    card_pos: language === 'vi' ? 'Thẻ/POS' : 'Card/POS',
    cash: language === 'vi' ? 'Tiền mặt' : 'Cash',
    online: language === 'vi' ? 'Online' : 'Online',
  };

  const fetchInvoices = useCallback(async () => {
    if (!apiEnabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await invoiceApi.getInvoices();
      setInvoices(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getErrorMessage(err, 'Không thể tải danh sách hóa đơn từ máy chủ.'));
    } finally {
      setLoading(false);
    }
  }, [apiEnabled]);

  useEffect(() => {
    if (apiEnabled) {
      fetchInvoices();
    }
  }, [apiEnabled, fetchInvoices]);

  const getPackageName = (tx) => {
    const pkg = packages.find((item) => String(item.id) === String(tx.packageId));
    return pkg ? (language === 'vi' ? pkg.nameVi : pkg.name) : tx.packageName;
  };

  // Filtered dataset
  const rawList = apiEnabled ? invoices : applyMockPaymentSettlements(contextPayments);

  const filteredList = rawList.filter((item) => {
    // Status filter
    const itemStatus = apiEnabled ? item.paymentStatus : item.status;
    if (statusFilter !== 'all' && itemStatus !== statusFilter) {
      return false;
    }

    // Method filter
    const itemMethod = apiEnabled ? item.paymentMethod : item.method;
    if (methodFilter !== 'all' && itemMethod !== methodFilter) {
      return false;
    }

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      const code = String(item.code || item.transactionNo || item.invoiceId || '').toLowerCase();
      const name = String(item.memberName || '').toLowerCase();
      const email = String(item.memberEmail || '').toLowerCase();
      if (!code.includes(q) && !name.includes(q) && !email.includes(q)) {
        return false;
      }
    }

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
  const paginatedList = filteredList.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Quick Action: Confirm Cash Payment for Pending Invoice
  const handleConfirmCashPayment = async (inv) => {
    if (apiEnabled) {
      showToast?.(
        language === 'vi'
          ? 'Thao tác thanh toán trực tiếp tạm thời bị khóa. Vui lòng thử lại sau.'
          : 'Direct payment action is temporarily unavailable. Please try again later.',
        'warning'
      );
      return;
    }
    // Mock mode: settle pending fixture in-place once (no duplicate transaction)
    if (inv) {
      const res = settleMockPaymentFixture(inv, {
        notes: language === 'vi' ? 'Xác nhận thu tiền mặt tại quầy' : 'Cash desk collection confirmed',
        receptionistName: currentUser?.name || (language === 'vi' ? 'Quản lý' : 'Manager'),
      });
      if (!res.ok) {
        showToast?.(res.error, 'warning');
        return;
      }
      showToast?.(
        language === 'vi'
          ? `Đã xác nhận thu tiền hóa đơn #${inv.code || inv.transactionNo || inv.invoiceId || inv.id} thành công!`
          : `Invoice confirmed paid successfully!`,
        'success'
      );
      setSelectedInvoice(null);
    }
  };

  return (
    <div className="space-y-6 text-[#181818]">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 p-5 rounded-lg shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-50 text-[#BA0000] rounded border border-red-200">
            <CreditCard className="w-5 h-5 text-[#BA0000]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">{t('payments')}</h2>
            <p className="text-xs text-slate-500">
              {language === 'vi'
                ? 'Lịch sử giao dịch hóa đơn, thu phí và đối soát kích hoạt gói thành viên'
                : 'Invoice transaction history, fee collection and membership reconciliation'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {apiEnabled && (
            <button
              type="button"
              onClick={fetchInvoices}
              disabled={loading}
              title={language === 'vi' ? 'Tải lại danh sách' : 'Refresh list'}
              className="min-h-[44px] min-w-[44px] px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-bold flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#BA0000]' : ''}`} />
            </button>
          )}

          <button
            onClick={() => setIsPayModalOpen(true)}
            className="min-h-[44px] px-4 py-2 bg-[#BA0000] hover:bg-[#8E0000] text-white rounded text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('recordPayment')}</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id={searchInputId}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={
              language === 'vi'
                ? 'Tìm theo mã HĐ, tên thành viên, email...'
                : 'Search by invoice code, member name, email...'
            }
            className="w-full min-h-[44px] pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#BA0000] focus:ring-2 focus:ring-[#D62323]/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              id={statusFilterId}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="min-h-[44px] bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#BA0000] focus:ring-2 focus:ring-[#D62323]/20"
            >
              <option value="all">{language === 'vi' ? 'Tất cả trạng thái' : 'All statuses'}</option>
              <option value="successful">{language === 'vi' ? 'Đã thanh toán (Successful)' : 'Paid'}</option>
              <option value="pending">{language === 'vi' ? 'Chờ thanh toán (Pending)' : 'Pending'}</option>
              <option value="cancelled">{language === 'vi' ? 'Đã hủy (Cancelled)' : 'Cancelled'}</option>
            </select>
          </div>

          <div>
            <select
              id={methodFilterId}
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="min-h-[44px] bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#BA0000] focus:ring-2 focus:ring-[#D62323]/20"
            >
              <option value="all">{language === 'vi' ? 'Tất cả phương thức' : 'All methods'}</option>
              <option value="cash">{language === 'vi' ? 'Tiền mặt' : 'Cash'}</option>
              <option value="bank_transfer">{language === 'vi' ? 'Chuyển khoản' : 'Bank Transfer'}</option>
              <option value="online">{language === 'vi' ? 'Online' : 'Online'}</option>
              <option value="card_pos">{language === 'vi' ? 'Thẻ/POS' : 'Card/POS'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error state */}
      {apiEnabled && error && (
        <div className="p-5 bg-white border border-rose-200 rounded-lg text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <p className="text-sm font-bold text-rose-800">{language === 'vi' ? 'Lỗi tải dữ liệu' : 'Error Loading Invoices'}</p>
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

      {/* Loading state */}
      {apiEnabled && loading && (
        <div className="py-12 bg-white border border-slate-200 rounded-lg text-center">
          <Loader2 className="w-8 h-8 text-[#BA0000] animate-spin mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-700">
            {language === 'vi' ? 'Đang tải danh sách hóa đơn từ máy chủ...' : 'Loading invoices...'}
          </p>
        </div>
      )}

      {/* Table Data */}
      {(!apiEnabled || (!loading && !error)) && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
          {filteredList.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">
                {language === 'vi' ? 'Không tìm thấy giao dịch nào phù hợp.' : 'No transactions found.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider border-b border-slate-200 font-bold">
                  <tr>
                    <th className="py-3 px-4">{language === 'vi' ? 'Mã Hóa Đơn' : 'Invoice ID'}</th>
                    <th className="py-3 px-4">{language === 'vi' ? 'Thành viên' : 'Member'}</th>
                    <th className="py-3 px-4">{language === 'vi' ? 'Gói đăng ký' : 'Package'}</th>
                    <th className="py-3 px-4 text-right">{language === 'vi' ? 'Số tiền' : 'Amount'}</th>
                    <th className="py-3 px-4">{language === 'vi' ? 'Phương thức' : 'Method'}</th>
                    <th className="py-3 px-4">{language === 'vi' ? 'Thời gian' : 'Date & Time'}</th>
                    <th className="py-3 px-4 text-center">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                    <th className="py-3 px-4 text-center">{language === 'vi' ? 'Thao tác' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {paginatedList.map((tx) => {
                    const isApi = apiEnabled;
                    const code = isApi ? (tx.code || `INV-${tx.invoiceId}`) : (tx.transactionNo || tx.code);
                    const memberName = tx.memberName || (tx.memberId ? `Hội viên #${tx.memberId}` : '—');
                    const pkgName = isApi ? (tx.packageName || 'Gói dịch vụ') : getPackageName(tx);
                    const amount = tx.amount || 0;
                    const method = isApi ? tx.paymentMethod : tx.method;
                    const date = isApi ? tx.paymentDate : tx.paymentDate;
                    const status = isApi ? tx.paymentStatus : tx.status;

                    return (
                      <tr key={tx.id || tx.invoiceId} className="hover:bg-slate-50 transition-colors h-[44px]">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900 tabular-nums">
                          {code}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          <div>{memberName}</div>
                          {tx.memberEmail && <div className="text-[11px] font-normal text-slate-500">{tx.memberEmail}</div>}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 font-medium">{pkgName}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900 tabular-nums text-right">
                          {formatCurrency(amount, language)}
                        </td>
                        <td className="py-2.5 px-4 uppercase text-[11px] font-mono text-slate-600">
                          {paymentMethods[method] || method}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 tabular-nums whitespace-nowrap">
                          {date ? formatDateTime(date, language) : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <StatusBadge type="payment" status={status} />
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedInvoice(tx)}
                            className="min-h-[36px] px-2.5 py-1 text-xs font-bold text-slate-700 hover:text-[#BA0000] hover:bg-slate-100 rounded inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{language === 'vi' ? 'Xem' : 'View'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 p-4 border-t border-slate-200 bg-slate-50 gap-3">
            <span>
              {language === 'vi'
                ? `Hiển thị ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, filteredList.length)} trên ${filteredList.length} giao dịch`
                : `Showing ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, filteredList.length)} of ${filteredList.length} transactions`}
            </span>
            <div className="flex items-center gap-2 text-[11px] tabular-nums">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="min-h-[44px] px-3 py-1.5 bg-white border border-slate-300 rounded font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {language === 'vi' ? 'Trang trước' : 'Previous'}
              </button>
              <span className="px-3 py-1.5 bg-[#181818] text-white rounded font-bold">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="min-h-[44px] px-3 py-1.5 bg-white border border-slate-300 rounded font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {language === 'vi' ? 'Trang sau' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto"
        >
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-lg shadow-xl p-6 text-[#181818]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div className="flex items-center gap-2 font-bold text-sm text-[#181818]">
                <FileText className="w-4 h-4 text-[#BA0000]" />
                <span>
                  {language === 'vi' ? 'Chi tiết hóa đơn giao dịch' : 'Invoice Details'} (
                  {selectedInvoice.code || `INV-${selectedInvoice.invoiceId}`})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                aria-label="Đóng"
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded">
                <div>
                  <span className="text-slate-500 text-[11px] block">Mã Hóa Đơn:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {selectedInvoice.code || `INV-${selectedInvoice.invoiceId}`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Trạng Thái:</span>
                  <div className="mt-1">
                    <StatusBadge
                      type="payment"
                      status={apiEnabled ? selectedInvoice.paymentStatus : selectedInvoice.status}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 text-[11px] block">Hội viên:</span>
                  <span className="font-bold text-slate-900">{selectedInvoice.memberName || '—'}</span>
                  {selectedInvoice.memberEmail && (
                    <span className="text-slate-500 block">{selectedInvoice.memberEmail}</span>
                  )}
                  {selectedInvoice.memberPhone && (
                    <span className="text-slate-500 block">{selectedInvoice.memberPhone}</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Gói dịch vụ:</span>
                  <span className="font-bold text-slate-900">
                    {selectedInvoice.packageName || getPackageName(selectedInvoice)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-500 text-[11px] block">Số tiền:</span>
                  <span className="text-base font-extrabold font-mono text-[#BA0000] tabular-nums">
                    {formatCurrency(selectedInvoice.amount, language)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Phương thức:</span>
                  <span className="font-semibold uppercase text-slate-800">
                    {paymentMethods[selectedInvoice.paymentMethod || selectedInvoice.method] || selectedInvoice.paymentMethod}
                  </span>
                </div>
              </div>

              {selectedInvoice.gatewayTransactionRef && (
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                  <span className="text-slate-500 text-[11px] block">Mã giao dịch đối tác / Cổng:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedInvoice.gatewayTransactionRef}
                  </span>
                </div>
              )}

              {selectedInvoice.receptionistName && (
                <div>
                  <span className="text-slate-500 text-[11px] block">Nhân viên tiếp nhận / Thu ngân:</span>
                  <span className="font-semibold text-slate-800">{selectedInvoice.receptionistName}</span>
                </div>
              )}

              {selectedInvoice.paymentDate && (
                <div>
                  <span className="text-slate-500 text-[11px] block">Thời gian thanh toán:</span>
                  <span className="font-mono text-slate-800 tabular-nums">
                    {formatDateTime(selectedInvoice.paymentDate, language)}
                  </span>
                </div>
              )}

              {/* Action for Pending Invoices */}
              {((apiEnabled && selectedInvoice.paymentStatus === 'pending') || (!apiEnabled && (selectedInvoice.status === 'pending' || selectedInvoice.paymentStatus === 'pending'))) && (
                <div className={`p-3 rounded space-y-2 border ${apiEnabled ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    {apiEnabled ? (
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    ) : (
                      <Info className="w-4 h-4 text-slate-600 shrink-0" />
                    )}
                    <span>
                      {language === 'vi' ? 'Hóa đơn đang chờ thanh toán' : 'Pending Invoice'}
                    </span>
                  </div>
                  <p className="text-slate-700 text-[11px]">
                    {apiEnabled
                      ? (language === 'vi'
                        ? 'Thao tác thu tiền mặt trực tiếp tạm thời bị khóa.'
                        : 'Direct cash collection is temporarily unavailable.')
                      : (language === 'vi'
                        ? 'Xác nhận thu tiền mặt để hoàn tất thanh toán hóa đơn và cập nhật gói dịch vụ.'
                        : 'Confirm cash collection to complete invoice and update membership package.')}
                  </p>
                  <button
                    type="button"
                    disabled={apiEnabled}
                    onClick={() => handleConfirmCashPayment(selectedInvoice)}
                    title={apiEnabled ? (language === 'vi' ? 'Thao tác tạm thời bị khóa' : 'Temporarily unavailable') : undefined}
                    className={`w-full min-h-[44px] px-4 py-2 font-bold rounded flex items-center justify-center gap-2 transition-colors ${
                      apiEnabled
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-75'
                        : 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer shadow-xs'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {apiEnabled
                        ? (language === 'vi' ? 'Tạm khóa' : 'Temporarily locked')
                        : (language === 'vi' ? 'Xác nhận thu tiền mặt' : 'Confirm Cash Received')}
                    </span>
                  </button>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded cursor-pointer"
                >
                  {language === 'vi' ? 'Đóng' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      <PaymentModal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        onSuccess={() => {
          if (apiEnabled) {
            fetchInvoices();
          }
        }}
      />
    </div>
  );
}

export default PaymentManagement;
