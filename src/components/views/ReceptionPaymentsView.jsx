import React, { useState, useEffect, useCallback, useId, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSCMS } from '../../context/SCMSContext';
import { formatCurrency, formatDateTime } from '../../locales/translations';
import { StatusBadge } from '../common/Badge';
import { invoiceApi } from '../../api/invoiceApi';
import { canConfirmCash as hasCashConfirmationPermission, isCashInvoiceConfirmable } from '../../utils/paymentAccess.js';
import { getErrorMessage } from '../../api/apiErrors';
import {
  applyMockPaymentSettlements,
  settleMockPaymentFixture,
  subscribeMockSettlement,
} from '../../utils/mockFixtureSettlement';
import {
  CreditCard,
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

  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [, setSettlementTick] = useState(0);

  // URL search params for invoice selection (?invoiceId= or ?invoiceCode=)
  const [searchParams, setSearchParams] = useSearchParams();
  const queryInvoiceId = searchParams.get('invoiceId');
  const queryInvoiceCode = searchParams.get('invoiceCode');
  const currentTargetKeyRef = useRef(null);
  const handledTargetKeyRef = useRef(null);
  const prevTargetKeyRef = useRef(null);
  const targetReqIdRef = useRef(0);

  // Expose router search params setter for headless verification tests in DEV mode only
  useEffect(() => {
    if (import.meta.env.DEV) {
      window.__setPaymentsSearchParams = setSearchParams;
      return () => {
        delete window.__setPaymentsSearchParams;
      };
    }
  }, [setSearchParams]);

  // Target invoice deep-link state
  const [targetLoading, setTargetLoading] = useState(false);
  const [targetError, setTargetError] = useState(null);
  const [targetNotice, setTargetNotice] = useState(null);
  const [targetRetryCount, setTargetRetryCount] = useState(0);

  // Subscribe to fixture settlement changes
  useEffect(() => {
    return subscribeMockSettlement(() => setSettlementTick((c) => c + 1));
  }, []);

  // API State
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialInvoicesLoaded, setInitialInvoicesLoaded] = useState(false);
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

  const canConfirmCash = !apiEnabled || hasCashConfirmationPermission(currentUser);

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
      if (requestId === invoicesRequestId.current) {
        setLoading(false);
        setInitialInvoicesLoaded(true);
      }
    }
  }, [apiEnabled, statusFilter, searchTerm]);

  useEffect(() => {
    if (apiEnabled) {
      fetchInvoices();
    }
  }, [apiEnabled, fetchInvoices]);

  const rawList = apiEnabled ? invoices : applyMockPaymentSettlements(contextPayments);

  const isCashMethod = useCallback((item) => {
    if (!item) return false;
    const method = String(item.paymentMethod || item.rawPaymentMethod || item.method || '').trim().toLowerCase();
    if (apiEnabled) {
      // In API mode, fail-closed: unspecified/null/empty/unknown methods are NOT treated as Cash
      return ['cash', 'tiền mặt', 'tien_mat'].includes(method);
    }
    // In mock mode, preserve fallback desk cash if existing mock fixture contract requires
    return !method || ['cash', 'tiền mặt', 'tien_mat'].includes(method);
  }, [apiEnabled]);

  const applyTargetInvoice = useCallback((target) => {
    if (!target) return;
    setSearchTerm(target.code || String(target.invoiceId || target.id));
    setStatusFilter('all');

    const itemStatus = String(apiEnabled ? (target.paymentStatus || target.rawPaymentStatus) : target.status).toLowerCase();
    const method = String(target.paymentMethod || target.rawPaymentMethod || target.method || '').trim().toLowerCase();
    const canPayCash = isCashMethod(target);

    if (itemStatus === 'pending') {
      if (canPayCash) {
        if (apiEnabled && !isCashInvoiceConfirmable(target)) {
          setConfirmingInvoice(null);
          setTargetNotice(
            language === 'vi'
              ? 'Hóa đơn Cash đã hết hạn, cần đối soát hoặc thiếu hạn thanh toán hợp lệ nên không thể xác nhận.'
              : 'This Cash invoice is expired, requires reconciliation, or has no valid payment deadline and cannot be confirmed.'
          );
        } else if (canConfirmCash) {
          setConfirmingInvoice(target);
          setTargetNotice(null);
        } else {
          setConfirmingInvoice(null);
          setTargetNotice(
            language === 'vi'
              ? 'Tài khoản hiện tại không có quyền xác nhận thu tiền mặt cho hóa đơn này.'
              : 'Current account does not have permission to confirm cash for this invoice.'
          );
        }
      } else if (apiEnabled && !method) {
        // Missing / unverified payment method in API mode
        setConfirmingInvoice(null);
        setTargetNotice(
          language === 'vi'
            ? 'Hóa đơn chưa xác định rõ phương thức thanh toán. Không thể thu tiền mặt tại quầy.'
            : 'Invoice payment method is unspecified or unverified. Desk cash collection is not available.'
        );
      } else {
        setConfirmingInvoice(null);
        setTargetNotice(
          language === 'vi'
            ? 'Hóa đơn này được thanh toán qua cổng trực tuyến hoặc chuyển khoản. Không mở thu tiền mặt tại quầy.'
            : 'This invoice is designated for online or transfer payment. Desk cash collection is not available.'
        );
      }
    } else {
      setConfirmingInvoice(null);
      const displayStatus = target.rawPaymentStatus || target.paymentStatus || target.status || itemStatus;
      setTargetNotice(
        language === 'vi'
          ? `Hóa đơn này đang ở trạng thái "${displayStatus}". Không cần thu tiền mặt.`
          : `This invoice is currently in status "${displayStatus}". Desk cash collection is not required.`
      );
    }
  }, [apiEnabled, isCashMethod, canConfirmCash, language]);

  // Target key distinguishing ID and Code
  const targetKey = queryInvoiceId
    ? `id:${queryInvoiceId}`
    : queryInvoiceCode
      ? `code:${queryInvoiceCode.trim().toLowerCase()}`
      : null;

  // Auto-focus/select target invoice from URL query params (?invoiceId= or ?invoiceCode=)
  useEffect(() => {
    const reqId = ++targetReqIdRef.current;
    currentTargetKeyRef.current = targetKey;
    const prevKey = prevTargetKeyRef.current;
    prevTargetKeyRef.current = targetKey;

    if (!targetKey) {
      handledTargetKeyRef.current = null;
      setTargetLoading(false);
      setTargetError(null);
      setTargetNotice(null);
      // Chỉ đóng modal khi có sự chuyển dịch từ "có query target" sang "clear query target".
      // Không đóng modal thu Cash thủ công mở khi URL vốn không có query.
      if (prevKey !== null) {
        setConfirmingInvoice(null);
      }
      return () => {
        targetReqIdRef.current++;
        currentTargetKeyRef.current = null;
      };
    }

    // Nếu target key đổi so với target cũ: đóng modal cũ ngay, reset thông báo/lỗi cũ
    if (handledTargetKeyRef.current !== targetKey) {
      setConfirmingInvoice(null);
      setTargetError(null);
      setTargetNotice(null);
    }

    if (handledTargetKeyRef.current === targetKey) {
      return () => {
        targetReqIdRef.current++;
        currentTargetKeyRef.current = null;
      };
    }

    const candidateList = apiEnabled ? invoices : rawList;
    const target = candidateList.find((item) => {
      if (queryInvoiceId && String(item.invoiceId || item.id) === String(queryInvoiceId)) {
        return true;
      }
      if (queryInvoiceCode) {
        const itemCode = String(item.code || item.invoiceCode || '').trim().toLowerCase();
        if (itemCode === queryInvoiceCode.trim().toLowerCase()) {
          return true;
        }
      }
      return false;
    });

    if (target) {
      handledTargetKeyRef.current = targetKey;
      setTargetLoading(false);
      setTargetError(null);
      applyTargetInvoice(target);
    } else if (apiEnabled && queryInvoiceId) {
      setTargetLoading(true);
      setTargetError(null);
      setTargetNotice(null);

      invoiceApi.getInvoiceById(queryInvoiceId, { notifyForbidden: false })
        .then((fetched) => {
          if (reqId !== targetReqIdRef.current || currentTargetKeyRef.current !== targetKey) return;
          if (!fetched || String(fetched.invoiceId || fetched.id) !== String(queryInvoiceId)) {
            handledTargetKeyRef.current = targetKey;
            setTargetError(
              language === 'vi'
                ? 'Không tìm thấy hóa đơn được yêu cầu (ID không khớp hoặc dữ liệu không tồn tại).'
                : 'Requested invoice not found or ID mismatch.'
            );
            return;
          }
          handledTargetKeyRef.current = targetKey;
          setInvoices((prev) => {
            const exists = prev.some((i) => String(i.invoiceId) === String(fetched.invoiceId));
            return exists ? prev : [fetched, ...prev];
          });
          applyTargetInvoice(fetched);
        })
        .catch((err) => {
          if (reqId !== targetReqIdRef.current || currentTargetKeyRef.current !== targetKey) return;
          handledTargetKeyRef.current = targetKey;
          setTargetError(
            getErrorMessage(
              err,
              language === 'vi'
                ? 'Không thể tải chi tiết hóa đơn từ liên kết. Vui lòng kiểm tra lại.'
                : 'Failed to load invoice from link. Please check and retry.'
            )
          );
        })
        .finally(() => {
          if (reqId === targetReqIdRef.current && currentTargetKeyRef.current === targetKey) {
            setTargetLoading(false);
          }
        });
    } else if (queryInvoiceCode) {
      if (apiEnabled && (!initialInvoicesLoaded || loading)) {
        // Cold-load: Wait for invoice list to finish loading before concluding not-found
        setTargetLoading(true);
      } else {
        handledTargetKeyRef.current = targetKey;
        setTargetLoading(false);
        setTargetNotice(
          language === 'vi'
            ? `Không tìm thấy hóa đơn có mã "${queryInvoiceCode}" trong danh sách hiện tại.`
            : `Invoice with code "${queryInvoiceCode}" was not found in current records.`
        );
      }
    }

    return () => {
      targetReqIdRef.current++;
      currentTargetKeyRef.current = null;
    };
  }, [targetKey, queryInvoiceId, queryInvoiceCode, apiEnabled, invoices, rawList, loading, initialInvoicesLoaded, applyTargetInvoice, language, targetRetryCount]);

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
    if (apiEnabled && (!canConfirmCash || !isCashInvoiceConfirmable(confirmingInvoice))) {
      setConfirmError(language === 'vi'
        ? 'Không thể xác nhận: cần quyền Lễ tân + MANAGE_INVOICES và hóa đơn Cash đang Pending, chưa hết hạn, không cần đối soát.'
        : 'Cannot confirm: Receptionist + MANAGE_INVOICES and an unexpired, reconcilable Pending Cash invoice are required.');
      return;
    }

    confirmingRequestRef.current = true;
    setIsConfirming(true);
    setConfirmError(null);

    if (apiEnabled) {
      try {
        const updatedInvoice = await invoiceApi.confirmCashPayment(confirmingInvoice.invoiceId, {
          note: cashNotes.trim() || undefined,
          notifyForbidden: false,
        });
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
    <div className="space-y-6 font-sans text-text-primary">
      {/* Header */}
      <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-bg-secondary text-brand-primary rounded border border-border-color">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl leading-7 font-semibold text-text-primary whitespace-nowrap">{t('payments')}</h2>
            <p className="text-sm leading-5 text-text-secondary">
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
              aria-label={language === 'vi' ? 'Tải lại danh sách' : 'Refresh'}
              title={language === 'vi' ? 'Tải lại danh sách' : 'Refresh'}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-border-color bg-bg-card cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-primary' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Target Invoice Feedback Banners */}
      {targetLoading && (
        <div className="p-4 bg-sky-50 border border-sky-200 rounded-lg flex items-center gap-3 text-status-info text-sm leading-5">
          <Loader2 className="w-4 h-4 animate-spin text-status-info shrink-0" />
          <span>
            {language === 'vi'
              ? `Đang kiểm tra và tải thông tin hóa đơn #${queryInvoiceCode || queryInvoiceId}...`
              : `Checking and loading invoice #${queryInvoiceCode || queryInvoiceId}...`}
          </span>
        </div>
      )}

      {targetError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-start justify-between gap-3 text-sm leading-5 text-status-danger">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-status-danger shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{language === 'vi' ? 'Không thể mở hóa đơn' : 'Cannot open invoice'}</p>
              <p className="text-text-secondary mt-0.5">{targetError}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                handledTargetKeyRef.current = null;
                setTargetError(null);
                setTargetNotice(null);
                setTargetRetryCount((c) => c + 1);
              }}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-3 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-danger focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-status-danger text-text-inverse hover:bg-status-danger/90 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{language === 'vi' ? 'Thử lại' : 'Retry'}</span>
            </button>
            <button
              type="button"
              onClick={() => setTargetError(null)}
              aria-label={language === 'vi' ? 'Đóng' : 'Dismiss'}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
              title={language === 'vi' ? 'Đóng' : 'Dismiss'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {targetNotice && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start justify-between gap-3 text-sm leading-5 text-status-warning">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-status-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{language === 'vi' ? 'Thông báo hóa đơn' : 'Invoice Notice'}</p>
              <p className="text-text-primary mt-0.5">{targetNotice}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTargetNotice(null)}
            aria-label={language === 'vi' ? 'Đóng' : 'Dismiss'}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
            title={language === 'vi' ? 'Đóng' : 'Dismiss'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
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
            className="min-h-11 w-full rounded border border-border-color bg-bg-card pl-9 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-text-secondary shrink-0" />
          <select
            id={statusSelectId}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-h-11 w-full sm:w-auto rounded border border-border-color bg-bg-card px-3 py-1.5 text-xs sm:text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted cursor-pointer"
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
        <div className="py-12 rounded-lg border border-border-color bg-bg-card p-4 text-text-primary text-center">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin mx-auto mb-2" />
          <p className="text-sm leading-5 text-text-secondary">
            {language === 'vi' ? 'Đang tải danh sách thu tiền từ máy chủ...' : 'Loading payments...'}
          </p>
        </div>
      )}

      {/* Error state */}
      {apiEnabled && error && (
        <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-status-danger mx-auto" />
          <p className="text-lg leading-7 font-semibold text-status-danger">{language === 'vi' ? 'Lỗi tải dữ liệu' : 'Error'}</p>
          <p className="text-sm leading-5 text-text-secondary">{error}</p>
          <button
            onClick={fetchInvoices}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-3 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active mx-auto cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Thử lại' : 'Retry'}</span>
          </button>
        </div>
      )}

      {/* Transactions List */}
      {(!apiEnabled || (!loading && (!error || invoices.length > 0))) && (
        <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary space-y-4">
          <h3 className="text-lg leading-7 font-semibold text-text-primary">
            {language === 'vi' ? 'Lịch Sử Giao Dịch Thu Tiền Tại Quầy' : 'Desk Collection Transactions'}
          </h3>

          {filteredPayments.length === 0 ? (
            <div className="text-center py-10 text-text-secondary text-sm leading-5">
              <FileCheck className="w-10 h-10 text-text-muted mx-auto mb-2" />
              <p className="font-semibold text-text-primary">
                {language === 'vi' ? 'Chưa có bản ghi giao dịch thu tiền nào.' : 'No payment records found.'}
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto rounded-lg border border-border-color bg-bg-card">
              <table className="w-full min-w-full text-left text-sm">
                <thead className="bg-bg-secondary text-xs font-semibold text-text-secondary">
                  <tr>
                    <th className="px-4 py-3 text-left align-middle">{language === 'vi' ? 'Mã GD' : 'Code'}</th>
                    <th className="px-4 py-3 text-left align-middle">{language === 'vi' ? 'Thành Viên' : 'Member'}</th>
                    <th className="px-4 py-3 text-left align-middle">{language === 'vi' ? 'Gói Dịch Vụ' : 'Package'}</th>
                    <th className="px-4 py-3 text-right align-middle">{language === 'vi' ? 'Số Tiền (VND)' : 'Amount'}</th>
                    <th className="px-4 py-3 text-left align-middle">{language === 'vi' ? 'Phương Thức' : 'Method'}</th>
                    <th className="px-4 py-3 text-left align-middle">{language === 'vi' ? 'Thời Gian' : 'Date'}</th>
                    <th className="px-4 py-3 text-center align-middle">{language === 'vi' ? 'Trạng Thái' : 'Status'}</th>
                    <th className="px-4 py-3 text-center align-middle">{language === 'vi' ? 'Thao Tác Quầy' : 'Desk Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {filteredPayments.map((p) => {
                    const isApi = apiEnabled;
                    const code = isApi ? (p.code || '—') : (p.code || p.transactionNo);
                    const status = isApi ? p.paymentStatus : p.status;
                    const isPending = status === 'pending';

                    return (
                      <tr key={p.id || p.invoiceId} className="transition-colors hover:bg-bg-secondary/70">
                        <td className="px-4 py-3 align-middle text-sm leading-5 text-text-primary font-mono font-semibold tabular-nums">
                          {code}
                        </td>
                        <td className="px-4 py-3 align-middle text-sm leading-5 text-text-primary font-semibold">
                          <div>{p.memberName || `Hội viên #${p.memberId}`}</div>
                          {p.memberPhone && <div className="text-xs leading-4 font-medium text-text-secondary">{p.memberPhone}</div>}
                        </td>
                        <td className="px-4 py-3 align-middle text-sm leading-5 text-text-primary">
                          {p.packageName || 'Gói dịch vụ'}
                        </td>
                        <td className="px-4 py-3 align-middle text-sm leading-5 text-text-primary text-right font-mono font-semibold tabular-nums">
                          {p.amount == null ? '—' : formatCurrency(p.amount, language)}
                        </td>
                        <td className="px-4 py-3 align-middle text-sm leading-5 text-text-primary uppercase font-mono">
                          {p.paymentMethod || p.method || '—'}
                        </td>
                        <td className="px-4 py-3 align-middle text-sm leading-5 text-text-primary font-mono tabular-nums">
                          {p.paymentDate || p.createdAt || '—'}
                        </td>
                        <td className="px-4 py-3 align-middle text-sm leading-5 text-text-primary text-center">
                          <StatusBadge type="payment" status={status} />
                        </td>
                        <td className="px-4 py-1.5 align-middle text-sm leading-5 text-text-primary text-center">
                          {isPending && canConfirmCash && isCashMethod(p) && (!apiEnabled || isCashInvoiceConfirmable(p)) ? (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmingInvoice(p);
                                setConfirmError(null);
                                setCashNotes('');
                              }}
                              className="inline-flex min-h-11 items-center justify-center gap-1 rounded bg-brand-primary px-2.5 text-xs font-semibold text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>{language === 'vi' ? 'Thu tiền mặt' : 'Collect Cash'}</span>
                            </button>
                          ) : isPending && !isCashMethod(p) ? (
                            (() => {
                              const rawMethod = String(p.paymentMethod || p.rawPaymentMethod || p.method || '').trim();
                              return (
                                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  !rawMethod
                                    ? 'bg-amber-50 text-status-warning ring-1 ring-inset ring-amber-200'
                                    : 'bg-sky-50 text-status-info ring-1 ring-inset ring-sky-200'
                                }`}>
                                  {!rawMethod
                                    ? (language === 'vi' ? 'Chưa xác minh' : 'Unverified')
                                    : (language === 'vi' ? 'Cổng trực tuyến' : 'Online Gateway')}
                                </span>
                              );
                            })()
                          ) : isPending ? (
                            <span aria-label={language === 'vi' ? 'Không có quyền thu tiền' : 'Not authorized'}>—</span>
                          ) : (
                            <span className="text-xs leading-4 font-medium text-text-secondary italic">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-dark/60 p-4 overflow-y-auto"
        >
          <div className="rounded-lg border border-border-color bg-bg-card p-4 text-text-primary w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between border-b border-border-color pb-3 mb-4">
              <div className="flex items-center gap-2 text-lg leading-7 font-semibold text-text-primary">
                <DollarSign className="w-5 h-5 text-status-success" />
                <span>{language === 'vi' ? 'Xác nhận thu tiền mặt tại quầy' : 'Confirm Cash Payment'}</span>
              </div>
              <button
                type="button"
                onClick={() => setConfirmingInvoice(null)}
                aria-label="Đóng"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteCashPayment} className="space-y-4 text-sm leading-5 text-text-primary">
              {confirmError && (
                <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded text-status-danger flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-status-danger shrink-0 mt-0.5" />
                  <div className="flex-1 font-semibold">{confirmError}</div>
                </div>
              )}

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded space-y-2">
                <div className="flex justify-between">
                  <span className="text-text-secondary font-medium">Mã Hóa Đơn:</span>
                  <span className="font-mono font-semibold text-text-primary">
                    {confirmingInvoice.code || (apiEnabled ? '—' : `INV-${confirmingInvoice.invoiceId}`)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary font-medium">Hội Viên:</span>
                  <span className="font-semibold text-text-primary">{confirmingInvoice.memberName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary font-medium">{language === 'vi' ? 'Dịch Vụ / Lớp Học:' : 'Service / Class:'}</span>
                  <span className="font-semibold text-text-primary">{confirmingInvoice.packageName || confirmingInvoice.className || (language === 'vi' ? 'Lớp học' : 'Class')}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-emerald-200">
                  <span className="text-text-primary font-semibold">Số tiền cần thu:</span>
                  <span className="text-lg leading-7 font-semibold font-mono text-status-success tabular-nums">
                    {confirmingInvoice.amount == null ? '—' : formatCurrency(confirmingInvoice.amount, language)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs leading-4 font-medium text-text-secondary mb-1">
                  {language === 'vi' ? 'Ghi chú biên lai / Mã phiếu thu' : 'Receipt Note'}
                </label>
                <input
                  type="text"
                  value={cashNotes}
                  onChange={(e) => setCashNotes(e.target.value)}
                  disabled={isConfirming}
                  placeholder={language === 'vi' ? 'Ví dụ: Đã nhận đủ tiền mặt từ hội viên...' : 'Receipt notes...'}
                  className="min-h-11 w-full rounded border border-border-color bg-bg-card px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:bg-bg-secondary disabled:text-text-muted"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setConfirmingInvoice(null)}
                  disabled={isConfirming}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-4 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none border border-border-color bg-bg-card text-text-primary hover:bg-bg-secondary cursor-pointer"
                >
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isConfirming || !canConfirmCash}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded px-4 text-xs font-semibold leading-5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active cursor-pointer"
                >
                  {isConfirming && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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
    </div>
  );
}

export default ReceptionPaymentsView;
