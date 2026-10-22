import React, { useState, useEffect, useCallback, useId, useMemo, useRef } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { formatDate, formatCurrency } from '../../locales/translations';
import { StatusBadge } from '../common/Badge';
import { membershipApi } from '../../api/membershipApi';
import { invoiceApi } from '../../api/invoiceApi';
import { getErrorMessage } from '../../api/apiErrors';
import {
  getAuthoritativeProfileId,
  resolveCurrentMemberProfile,
  resolveActiveSubscription,
  isDirectSubscriptionLocked,
  getStoredPendingOrder,
  setStoredPendingOrder,
  clearStoredPendingOrder,
  clearAllStoredPendingOrdersExcept,
  executeDirectSubscriptionSubmit,
  calculateInvoiceExpiry,
  resolveActiveSubscriptionDetails,
  resolvePendingInvoiceBannerState,
  resolveSubscriptionRowDisplay,
} from '../../utils/memberSafetyHelpers';
import {
  Award,
  ShieldCheck,
  Clock,
  Calendar,
  CreditCard,
  User,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  X,
  CheckCircle2,
  Package,
  Loader2,
  Info,
} from 'lucide-react';
import {
  deriveMockMemberProfile,
  applyMockPaymentSettlements,
  createMockPendingPayment,
  subscribeMockSettlement,
} from '../../utils/mockFixtureSettlement';

export function MyMembershipView() {
  const {
    currentUser,
    members: contextMembers,
    packages: contextPackages,
    payments: contextPayments,
    t,
    language,
    apiEnabled,
    showToast,
  } = useSCMS();

  const [, setSettlementTick] = useState(0);

  // Subscribe to mock fixture settlement updates in mock mode
  useEffect(() => {
    return subscribeMockSettlement(() => setSettlementTick((c) => c + 1));
  }, []);

  // Member Profile ID resolution:
  // In API mode, currentUser.id is userId from LoginResponse.
  // We strictly use authoritative memberId from context, never inferring from userId.
  const authoritativeMemberId = getAuthoritativeProfileId(currentUser);
  const hasAuthoritativeMemberId = Boolean(!apiEnabled || authoritativeMemberId);

  // Current member profile:
  // In API mode, never fallback to contextMembers[0] to prevent showing another profile's data.
  // In mock mode, reconcile against any desk cash settlements in sessionStorage.
  const rawMember = resolveCurrentMemberProfile({ currentUser, contextMembers, apiEnabled });
  const currentMember = apiEnabled ? rawMember : deriveMockMemberProfile(rawMember, contextPayments);
  const memberProfileId = apiEnabled ? authoritativeMemberId : (currentMember?.id ?? 1);

  // Clear pending orders belonging to other accounts when switching members
  useEffect(() => {
    if (memberProfileId) {
      clearAllStoredPendingOrdersExcept(memberProfileId);
    }
  }, [memberProfileId]);

  // API State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [packages, setPackages] = useState([]);
  const [invoices, setInvoices] = useState([]);

  // Modal State for Subscription / Renewal
  const [isSubscribeModalOpen, setIsSubscribeModalOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'bank_transfer' | 'online'
  const [subNotes, setSubNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [submitError, setSubmitError] = useState(null);

  const packageSelectId = useId();
  const notesId = useId();

  // Fetch Authoritative Data from BE (with robust fail-closed error propagation)
  const fetchMemberData = useCallback(async () => {
    if (!apiEnabled) return;

    setLoading(true);
    setError(null);
    const errorMessages = [];

    // 1. Fetch public packages catalog via public endpoint
    try {
      const pkgsData = await membershipApi.getPublicPackages();
      setPackages(Array.isArray(pkgsData) ? pkgsData : []);
    } catch (pkgErr) {
      errorMessages.push(`Danh mục gói tập: ${getErrorMessage(pkgErr, 'Lỗi kết nối')}`);
    }

    // 2. Fetch member invoices via own-read endpoint (/api/members/me/invoices)
    try {
      const invsData = await invoiceApi.getMemberOwnInvoices();
      setInvoices(Array.isArray(invsData) ? invsData : []);
    } catch (invErr) {
      errorMessages.push(`Hóa đơn hội viên: ${getErrorMessage(invErr, 'Lỗi kết nối')}`);
    }

    // 3. Fetch member subscriptions if memberProfileId is valid, otherwise report clear error
    if (memberProfileId) {
      try {
        const subsData = await membershipApi.getMemberSubscriptions(memberProfileId);
        setSubscriptions(Array.isArray(subsData) ? subsData : []);
      } catch (subErr) {
        errorMessages.push(`Đăng ký gói hội viên: ${getErrorMessage(subErr, 'Lỗi kết nối')}`);
      }
    } else {
      errorMessages.push(
        language === 'vi'
          ? 'Không tìm thấy ID hội viên đã xác thực từ phiên đăng nhập để tải gói đăng ký.'
          : 'Authenticated member ID not found in session to load subscriptions.'
      );
    }

    if (errorMessages.length > 0) {
      setError(errorMessages.join('; '));
    }
    setLoading(false);
  }, [apiEnabled, memberProfileId, language]);

  useEffect(() => {
    if (apiEnabled) {
      fetchMemberData();
    }
  }, [apiEnabled, fetchMemberData]);

  // Derived Active Subscription: strictly active or grace_period.
  // Never treat pending, pending_payment, or expired subscriptions as active packages.
  const activeSubscription = resolveActiveSubscription(subscriptions, apiEnabled);

  // In Mock Mode: Fallback to context with fixture settlement overlay
  const mockPkg = contextPackages.find((p) => String(p.id) === String(currentMember?.currentPackageId));
  const allMockPayments = applyMockPaymentSettlements(contextPayments);
  const mockPayments = allMockPayments.filter((p) => String(p.memberId) === String(currentMember?.id));

  // Current package info
  const currentPkgDetails = apiEnabled
    ? (activeSubscription
        ? packages.find((p) => String(p.id) === String(activeSubscription.packageId)) || {
            name: activeSubscription.packageName,
            nameVi: activeSubscription.packageName,
            price: activeSubscription.price,
            benefits: [],
          }
        : null)
    : (mockPkg || {
        name: currentMember?.currentPackageName || 'Gói thành viên',
        nameVi: currentMember?.currentPackageName || 'Gói thành viên',
        price: 0,
        benefits: [],
      });

  // Mock subscription list for demonstration in mock mode
  const mockSubscriptions = useMemo(() => {
    if (apiEnabled || !currentMember?.currentPackageId) return [];
    return [
      {
        subscriptionId: currentMember.id ? `SUB-${currentMember.id}` : 'SUB-01',
        packageName: currentPkgDetails?.nameVi || currentPkgDetails?.name || currentMember?.currentPackageName || 'Gói thành viên',
        price: currentPkgDetails?.price || 0,
        startDate: currentMember.startDate || null,
        endDate: currentMember.endDate || null,
        status: currentMember.membershipStatus || 'active',
      },
    ];
  }, [apiEnabled, currentMember, currentPkgDetails]);

  const displayedSubscriptions = apiEnabled ? subscriptions : mockSubscriptions;

  const isMemberMutationLocked = isDirectSubscriptionLocked(apiEnabled, import.meta.env.VITE_TEST_HARNESS);

  // Derive active pending invoice from BE invoices or sessionStorage (strictly partitioned by memberProfileId)
  const pendingInvoice = useMemo(() => {
    if (apiEnabled) {
      const fromBE = invoices.find((inv) => inv.paymentStatus === 'pending');
      if (fromBE) return fromBE;
      const stored = getStoredPendingOrder(memberProfileId);
      if (stored) {
        // If stored invoice is now paid in BE invoices, clear storage
        const matchingPaid = invoices.find(
          (inv) =>
            (String(inv.id) === String(stored.invoiceId) || inv.invoiceCode === stored.invoiceCode) &&
            inv.paymentStatus === 'paid'
        );
        if (matchingPaid) {
          clearStoredPendingOrder(memberProfileId);
          return null;
        }
        // If stored invoice is expired, clear storage
        const matchingExpired = invoices.find(
          (inv) =>
            (String(inv.id) === String(stored.invoiceId) || inv.invoiceCode === stored.invoiceCode) &&
            inv.paymentStatus === 'expired'
        );
        if (matchingExpired) {
          clearStoredPendingOrder(memberProfileId);
          return null;
        }
        return stored;
      }
      return null;
    } else {
      const mockPending = mockPayments.find((p) => p.status === 'pending');
      return mockPending || null;
    }
  }, [apiEnabled, invoices, mockPayments, memberProfileId]);

  const activeDetails = useMemo(() => {
    return resolveActiveSubscriptionDetails(activeSubscription);
  }, [activeSubscription]);

  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());

  useEffect(() => {
    if (!pendingInvoice?.expiresAt) return;
    const expiry = calculateInvoiceExpiry(pendingInvoice.expiresAt);
    if (!expiry.hasExpiry) return;

    const interval = setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [pendingInvoice?.expiresAt]);

  const invoiceExpiry = useMemo(() => {
    return calculateInvoiceExpiry(pendingInvoice?.expiresAt, currentTimestamp);
  }, [pendingInvoice?.expiresAt, currentTimestamp]);

  const pendingInvoiceBannerState = useMemo(() => {
    return resolvePendingInvoiceBannerState(pendingInvoice, invoiceExpiry);
  }, [pendingInvoice, invoiceExpiry]);

  // Handle Subscribe / Renew Submit
  const handleSubscribeSubmit = async (e) => {
    e?.preventDefault?.();
    return executeDirectSubscriptionSubmit({
      submittingRef,
      memberProfileId,
      selectedPackageId,
      hasAuthoritativeMemberId,
      isMemberMutationLocked,
      apiEnabled,
      paymentMethod,
      subNotes,
      activeSubscription,
      language,
      currentMember,
      contextPackages,
      contextPayments,
      apis: { membershipApi, invoiceApi },
      callbacks: {
        setSubmitting,
        setSubmitError,
        showToast,
        setIsSubscribeModalOpen,
        setSubNotes,
        fetchMemberData,
      },
    });
  };

  const openSubscribeModal = (initialPkgId = '') => {
    const available = apiEnabled ? packages : contextPackages;
    const defaultPkg = initialPkgId
      ? String(initialPkgId)
      : (available[0]?.id ? String(available[0].id) : '');
    setSelectedPackageId(defaultPkg);
    setSubmitError(null);
    setSubNotes('');
    setIsSubscribeModalOpen(true);
  };

  return (
    <div className="space-y-6 text-[#181818]">
      {/* Header View */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-50 text-[#BA0000] rounded border border-red-200">
            <Award className="w-5 h-5 text-[#BA0000]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 whitespace-nowrap">{t('myMembership')}</h2>
            <p className="text-xs text-slate-500">
              {language === 'vi'
                ? 'Thông tin gói thành viên, thời hạn sử dụng & lịch sử hóa đơn thanh toán'
                : 'Membership package details, validity period and invoice payment history'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {apiEnabled ? (
            activeSubscription ? (
              <StatusBadge type="membership" status={activeSubscription.status} />
            ) : (
              <span className="inline-flex items-center justify-center px-3 py-1.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                {language === 'vi' ? 'Chưa đăng ký gói' : 'No Package'}
              </span>
            )
          ) : (
            <StatusBadge type="membership" status={currentMember.membershipStatus || 'active'} />
          )}

          <button
            onClick={() => openSubscribeModal()}
            disabled={submitting}
            className="min-h-[44px] px-4 py-2 rounded text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors bg-[#BA0000] hover:bg-[#8E0000] text-white cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>
              {activeSubscription || (!apiEnabled && currentMember.currentPackageId)
                ? (language === 'vi' ? 'Gia hạn / Đổi gói' : 'Renew / Change')
                : (language === 'vi' ? 'Đăng ký gói mới' : 'Subscribe Package')}
            </span>
          </button>
        </div>
      </div>

      {/* Direct Registration Locked Notice in API Mode */}
      {apiEnabled && isMemberMutationLocked && !loading && !error && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            {language === 'vi'
              ? 'Khóa đăng ký trực tuyến: Tính năng đăng ký và gia hạn gói trực tiếp trên ứng dụng hiện đang chờ Backend xác nhận tài khoản/hồ sơ test được phép phát sinh giao dịch và cấu hình sandbox. Vui lòng liên hệ quầy tiếp tân để xử lý.'
              : 'Direct Subscription Locked: Online package registration and renewal is waiting for Backend confirmation of test profile permissions and sandbox configuration. Please contact the front desk.'}
          </span>
        </div>
      )}

      {/* Loading & Error States in API Mode */}
      {apiEnabled && loading && (
        <div className="py-12 bg-white border border-slate-200 rounded-lg text-center">
          <Loader2 className="w-8 h-8 text-[#BA0000] animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-700">
            {language === 'vi' ? 'Đang tải dữ liệu hội viên từ máy chủ...' : 'Loading membership data from server...'}
          </p>
        </div>
      )}

      {apiEnabled && error && (
        <div className="p-6 bg-white border border-rose-200 rounded-lg text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <p className="text-sm font-bold text-rose-800">{language === 'vi' ? 'Lỗi kết nối máy chủ' : 'Server Error'}</p>
          <p className="text-xs text-slate-600 max-w-md mx-auto">{error}</p>
          <button
            onClick={fetchMemberData}
            className="min-h-[44px] px-4 py-2 bg-[#BA0000] hover:bg-[#8E0000] text-white text-xs font-bold rounded flex items-center gap-2 mx-auto cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Thử lại' : 'Retry'}</span>
          </button>
        </div>
      )}

      {/* Pending Invoice Notification Banner */}
      {pendingInvoice && (
        <div className={`border rounded-lg p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs ${
          pendingInvoiceBannerState.isPastReservationWindow ? 'bg-amber-50/90 border-amber-300' : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-amber-900">
                  {language === 'vi' ? 'Hóa đơn đang chờ thanh toán' : 'Pending Invoice'}
                </span>
                <StatusBadge type="payment" status={pendingInvoiceBannerState.authoritativeStatus} />
                {pendingInvoiceBannerState.isPastReservationWindow && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300 uppercase tracking-tight">
                    {language === 'vi' ? 'Đã qua thời gian giữ chỗ' : 'Past reservation window'}
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-800 mt-1">
                Mã HĐ: <strong className="font-mono">{pendingInvoice.invoiceCode || pendingInvoice.code || `#${pendingInvoice.id ?? pendingInvoice.invoiceId}`}</strong>
                {pendingInvoice.amount ? (
                  <span className="ml-2">
                    - Số tiền: <strong className="font-mono text-[#BA0000]">{formatCurrency(pendingInvoice.amount, language)}</strong>
                  </span>
                ) : null}
                {pendingInvoice.expiresAt ? (
                  <span className="ml-2">
                    - Hạn thanh toán: <span>{formatDate(pendingInvoice.expiresAt, language)}</span>
                  </span>
                ) : null}
                {invoiceExpiry.hasExpiry && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    - {language === 'vi' ? 'Thời gian giữ chỗ:' : 'Reservation time:'}{' '}
                    <strong className={`font-mono px-1.5 py-0.5 rounded text-xs ${
                      invoiceExpiry.isExpired
                        ? 'bg-rose-100 text-rose-900 font-bold'
                        : 'bg-amber-100 text-amber-900 font-bold'
                    }`}>
                      {invoiceExpiry.formattedTime}
                      {invoiceExpiry.isExpired && (language === 'vi' ? ' (Hết giờ giữ chỗ)' : ' (Window expired)')}
                    </strong>
                  </span>
                )}
              </p>
              <p className={`text-[11px] mt-0.5 ${pendingInvoiceBannerState.isPastReservationWindow ? 'text-amber-900 font-medium' : 'text-amber-700'}`}>
                {pendingInvoiceBannerState.isPastReservationWindow
                  ? (language === 'vi'
                      ? 'Đã qua thời gian giữ chỗ thanh toán theo thời hạn của hóa đơn. Hóa đơn trên máy chủ có thể đã hết hạn hoặc bị hủy; vui lòng bấm "Làm mới trạng thái" để kiểm tra dữ liệu mới nhất từ máy chủ.'
                      : 'The payment reservation window based on the invoice expiration time has passed. The invoice on the server may be expired or cancelled; please click "Refresh" to verify latest status.')
                  : String(pendingInvoice.paymentMethod || pendingInvoice.method).toLowerCase() === 'cash'
                    ? (language === 'vi' ? 'Vui lòng hoàn tất thanh toán tiền mặt tại quầy Tiếp tân.' : 'Please complete cash payment at the reception desk.')
                    : (language === 'vi' ? 'Vui lòng hoàn tất thanh toán để kích hoạt gói hội viên.' : 'Please complete payment to activate your package.')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchMemberData}
              className="min-h-[36px] px-3 py-1.5 bg-white hover:bg-slate-50 border border-amber-300 text-amber-900 text-xs font-semibold rounded flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{language === 'vi' ? 'Làm mới trạng thái' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Active Package Card */}
      {(!apiEnabled || (!loading && !error)) && (
        <>
          {(apiEnabled ? activeSubscription : currentMember.currentPackageId) ? (
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-6">
              <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold uppercase text-[#BA0000] bg-red-50 px-2.5 py-1 rounded border border-red-200">
                      GÓI DỊCH VỤ ĐANG HOẠT ĐỘNG
                    </span>
                    {activeDetails.packageType && (
                      <span className="text-[10px] font-mono font-bold uppercase text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                        {activeDetails.packageType}
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-2">
                    {apiEnabled
                      ? (activeSubscription?.packageName || 'Gói thành viên')
                      : (currentMember.currentPackageName || mockPkg?.nameVi || 'Chưa đăng ký gói')}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Mã hội viên: <strong className="font-mono text-slate-900 tabular-nums">{currentMember.code || (currentMember.id ? `#${currentMember.id}` : '—')}</strong>
                    {apiEnabled && activeSubscription?.subscriptionId && (
                      <span className="ml-3">
                        Mã hợp đồng: <strong className="font-mono text-slate-900 tabular-nums">#{activeSubscription.subscriptionId}</strong>
                      </span>
                    )}
                    {apiEnabled && activeDetails.hasCredit && (
                      <span className="ml-3">
                        Số dư: <strong className="font-mono text-emerald-700 font-bold tabular-nums">{activeDetails.remainingCredit} credit</strong>
                      </span>
                    )}
                  </p>
                </div>

                <div className="text-left md:text-right">
                  <div className="text-xs text-slate-500">Thời hạn sử dụng gói</div>
                  <div className="text-sm font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                    {apiEnabled ? (
                      activeSubscription?.startDate && activeSubscription?.endDate ? (
                        `${formatDate(activeSubscription.startDate, language)} → ${formatDate(activeSubscription.endDate, language)}`
                      ) : activeDetails.hasValidityDays ? (
                        `${activeDetails.validityDays} ${language === 'vi' ? 'ngày' : 'days'}`
                      ) : (
                        <span className="text-slate-400 italic font-normal">
                          {language === 'vi' ? 'Chưa xác định thời hạn' : 'Undetermined validity period'}
                        </span>
                      )
                    ) : currentMember.startDate && currentMember.endDate ? (
                      `${formatDate(currentMember.startDate, language)} → ${formatDate(currentMember.endDate, language)}`
                    ) : (
                      <span className="text-slate-400 italic font-normal">
                        {language === 'vi' ? 'Chưa xác định thời hạn' : 'Undetermined validity period'}
                      </span>
                    )}
                  </div>
                  {apiEnabled && activeDetails.hasValidityDays && activeSubscription?.startDate && activeSubscription?.endDate && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      {language === 'vi' ? 'Thời lượng hiệu lực:' : 'Validity duration:'}{' '}
                      <strong className="font-mono text-slate-800 tabular-nums">{activeDetails.validityDays} {language === 'vi' ? 'ngày' : 'days'}</strong>
                    </div>
                  )}
                  <div className="text-xs text-slate-500 mt-1">
                    Giá gói: <strong className="font-mono text-[#BA0000] tabular-nums">
                      {formatCurrency(
                        apiEnabled ? (activeSubscription?.price || currentPkgDetails?.price || 0) : (mockPkg?.price || 0),
                        language
                      )}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Benefits & Details Grid */}
              <div className={`grid grid-cols-1 ${activeDetails.hasCredit ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4 text-xs`}>
                {activeDetails.hasCredit && (
                  <div className="p-4 bg-emerald-50 rounded border border-emerald-200 space-y-1">
                    <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-emerald-700" />
                      <span>{language === 'vi' ? 'Số Dư Buổi Học (Credit)' : 'Session Credits Balance'}</span>
                    </div>
                    <div className="text-2xl font-black font-mono text-emerald-700 tabular-nums pt-1">
                      {activeDetails.remainingCredit} <span className="text-xs font-semibold text-emerald-800 font-sans">{language === 'vi' ? 'Credit còn lại' : 'Credits left'}</span>
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      {language === 'vi' ? 'Sử dụng để đặt lịch ca học 1:1 cùng Huấn luyện viên.' : 'Available for booking 1:1 sessions with coaches.'}
                    </p>
                  </div>
                )}
                <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Quyền Lợi &amp; Dịch Vụ</span>
                  </div>
                  <p className="text-slate-600">
                    {currentPkgDetails?.description ||
                      'Tập luyện không giới hạn các bộ môn Gym, Yoga, Bơi lội và máy tập hiện đại.'}
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <User className="w-4 h-4 text-blue-600" />
                    <span>Huấn Luyện Viên Phụ Trách</span>
                  </div>
                  <p className="text-slate-600">
                    HLV: <strong>{currentMember.primaryCoachName || 'Chưa phân công'}</strong>
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded border border-slate-200 space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Gia hạn gói hội viên</span>
                  </div>
                  <p className="text-slate-600">
                    Liên hệ quầy lễ tân để được tư vấn thời điểm và điều kiện gia hạn.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Empty State: No Package Subscribed */
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-4 shadow-xs">
              <Package className="w-12 h-12 text-slate-400 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">
                {language === 'vi' ? 'Bạn chưa có gói hội viên đang hoạt động' : 'You do not have an active membership'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {language === 'vi'
                  ? 'Chọn một trong các gói dịch vụ thể thao bên dưới để bắt đầu đăng ký tập luyện tại trung tâm.'
                  : 'Select one of the sports packages below to start training at the center.'}
              </p>
            </div>
          )}

          {/* Package Catalog Selection Grid */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Package className="w-4 h-4 text-[#BA0000]" />
              <span>{language === 'vi' ? 'Bảng Giá & Danh Mục Gói Thành Viên' : 'Membership Packages Catalog'}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(apiEnabled ? packages : contextPackages).map((pkg) => {
                const isCurrent = apiEnabled
                  ? activeSubscription && String(activeSubscription.packageId) === String(pkg.id)
                  : String(currentMember.currentPackageId) === String(pkg.id);

                return (
                  <div
                    key={pkg.id}
                    className={`bg-white rounded-lg p-5 border flex flex-col justify-between shadow-xs transition-all ${
                      isCurrent
                        ? 'border-[#BA0000] ring-1 ring-[#BA0000]'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{pkg.nameVi || pkg.name}</h4>
                          <span className="text-[11px] text-slate-500">
                            Thời hạn: {pkg.durationDays ? `${pkg.durationDays} ngày` : `${pkg.durationMonths || 1} tháng`}
                          </span>
                        </div>
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-[#BA0000] bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                            Đang dùng
                          </span>
                        )}
                      </div>

                      <div className="text-lg font-extrabold font-mono text-[#BA0000] tabular-nums">
                        {formatCurrency(pkg.price, language)}
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2">
                        {pkg.descriptionVi || pkg.description || (pkg.benefits ? pkg.benefits.join(', ') : 'Dịch vụ chuẩn Webzone')}
                      </p>

                      {pkg.benefits && Array.isArray(pkg.benefits) && pkg.benefits.length > 0 && (
                        <ul className="text-[11px] text-slate-600 space-y-1 pt-1 border-t border-slate-100">
                          {pkg.benefits.slice(0, 3).map((b, idx) => (
                            <li key={idx} className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate">{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="pt-4 mt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => openSubscribeModal(pkg.id)}
                        disabled={submitting}
                        className={`w-full min-h-[44px] py-2 px-3 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                          isCurrent
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                            : 'bg-[#BA0000] hover:bg-[#8E0000] text-white shadow-xs'
                        }`}
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>{isCurrent ? (language === 'vi' ? 'Gia hạn gói này' : 'Renew Package') : (language === 'vi' ? 'Đăng ký gói này' : 'Subscribe')}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Subscriptions History Table */}
          {displayedSubscriptions.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-700 shrink-0" />
                  <span>{language === 'vi' ? 'Lịch Sử Đăng Ký Gói Thành Viên' : 'Subscription History'}</span>
                </h3>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">{language === 'vi' ? 'Mã Hợp Đồng' : 'Contract ID'}</th>
                      <th className="py-2.5 px-3">{language === 'vi' ? 'Gói Dịch Vụ' : 'Package'}</th>
                      <th className="py-2.5 px-3 text-right">{language === 'vi' ? 'Giá Gói (VND)' : 'Price (VND)'}</th>
                      <th className="py-2.5 px-3">{language === 'vi' ? 'Ngày Bắt Đầu' : 'Start Date'}</th>
                      <th className="py-2.5 px-3">{language === 'vi' ? 'Ngày Hết Hạn' : 'End Date'}</th>
                      <th className="py-2.5 px-3 text-center">{language === 'vi' ? 'Trạng Thái' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {displayedSubscriptions.map((sub) => {
                      const rowDisplay = resolveSubscriptionRowDisplay(sub, language);
                      return (
                        <tr key={sub.subscriptionId || sub.id} className="hover:bg-slate-50 h-[38px]">
                          <td className="py-2 px-3 font-mono font-bold text-slate-900 tabular-nums">
                            #{sub.subscriptionId || sub.id}
                          </td>
                          <td className="py-2 px-3 font-semibold">
                            <span>{sub.packageName}</span>
                            {sub.packageType && (
                              <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded">
                                {sub.packageType}
                              </span>
                            )}
                            {rowDisplay.validityLabel && (
                              <span className="ml-1.5 text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 rounded">
                                {rowDisplay.validityLabel}
                              </span>
                            )}
                            {typeof sub.remainingCredit === 'number' && Number.isFinite(sub.remainingCredit) && (
                              <span className="ml-1.5 text-[10px] font-mono font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                                {sub.remainingCredit} Credit
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                            {formatCurrency(sub.price, language)}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600 tabular-nums">
                            {sub.startDate ? formatDate(sub.startDate, language) : '—'}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600 tabular-nums">
                            {sub.endDate ? formatDate(sub.endDate, language) : '—'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <StatusBadge type="membership" status={sub.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Billing & Invoice History Table */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-700 shrink-0" />
                <span>{language === 'vi' ? 'Lịch Sử Hóa Đơn & Đóng Phí' : 'Invoice & Billing History'}</span>
              </h3>
            </div>

            {(apiEnabled ? invoices.length === 0 : mockPayments.length === 0) ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                {language === 'vi' ? 'Chưa có hóa đơn hoặc giao dịch nào.' : t('noData')}
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Mã Hóa Đơn</th>
                      <th className="py-2.5 px-3">Gói Dịch Vụ</th>
                      <th className="py-2.5 px-3 text-right">Số Tiền (VND)</th>
                      <th className="py-2.5 px-3">Phương Thức</th>
                      <th className="py-2.5 px-3">Thời Gian</th>
                      <th className="py-2.5 px-3 text-center">Trạng Thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {apiEnabled
                      ? invoices.map((inv) => (
                          <tr key={inv.id || inv.invoiceId} className="hover:bg-slate-50 h-[38px]">
                            <td className="py-2 px-3 font-mono font-bold text-slate-900 tabular-nums">
                              {inv.code || `INV-${inv.invoiceId}`}
                            </td>
                            <td className="py-2 px-3 font-semibold">{inv.packageName || 'Học phí / Gói tập'}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                              {formatCurrency(inv.amount, language)}
                            </td>
                            <td className="py-2 px-3 uppercase text-[11px] font-mono text-slate-600">
                              {inv.paymentMethod}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-500 tabular-nums">
                              {inv.paymentDate ? formatDate(inv.paymentDate, language) : '—'}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <StatusBadge type="payment" status={inv.paymentStatus} />
                            </td>
                          </tr>
                        ))
                      : mockPayments.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50 h-[38px]">
                            <td className="py-2 px-3 font-mono font-bold text-slate-900">{p.code || p.transactionNo}</td>
                            <td className="py-2 px-3 font-semibold">{p.packageName}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                              {formatCurrency(p.amount, language)}
                            </td>
                            <td className="py-2 px-3 uppercase text-[11px] font-mono">{p.method}</td>
                            <td className="py-2 px-3 font-mono text-slate-500 tabular-nums">{p.paymentDate || p.createdAt}</td>
                            <td className="py-2 px-3 text-center">
                              <StatusBadge type="payment" status={p.status} />
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Subscribe / Renew Modal */}
      {isSubscribeModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="subscribe-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto"
        >
          <div className="bg-white border border-slate-200 rounded-lg w-full max-w-md shadow-xl p-6 text-[#181818]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
              <div className="flex items-center gap-2 font-bold text-sm text-[#181818]">
                <Package className="w-4 h-4 text-[#BA0000]" />
                <span id="subscribe-modal-title">
                  {activeSubscription
                    ? (language === 'vi' ? 'Gia hạn / Đăng ký gói hội viên' : 'Renew / Subscribe Package')
                    : (language === 'vi' ? 'Đăng ký gói hội viên mới' : 'New Package Subscription')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSubscribeModalOpen(false)}
                aria-label="Đóng"
                className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubscribeSubmit} className="space-y-4">
              {submitError && (
                <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 font-semibold">{submitError}</div>
                </div>
              )}

              {/* Package Select */}
              <div>
                <label htmlFor={packageSelectId} className="text-xs font-bold text-slate-700 block mb-1">
                  {language === 'vi' ? 'Gói dịch vụ mong muốn' : 'Select Package'} <span className="text-rose-600">*</span>
                </label>
                <select
                  id={packageSelectId}
                  value={selectedPackageId}
                  onChange={(e) => setSelectedPackageId(e.target.value)}
                  disabled={submitting}
                  className="w-full min-h-[44px] bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#BA0000] focus:ring-2 focus:ring-[#D62323]/20"
                >
                  {(apiEnabled ? packages : contextPackages).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameVi || p.name} — {formatCurrency(p.price, language)} ({p.durationDays ? `${p.durationDays} ngày` : `${p.durationMonths || 1} tháng`})
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Method Selector */}
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-1">
                  {language === 'vi' ? 'Hình thức thanh toán dự kiến' : 'Payment Method'}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'cash', label: language === 'vi' ? 'Tiền mặt tại quầy' : 'Cash at Desk' },
                    { key: 'bank_transfer', label: language === 'vi' ? 'Chuyển khoản' : 'Bank Transfer' },
                    { key: 'online', label: language === 'vi' ? 'Trực tuyến' : 'Online' },
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => setPaymentMethod(item.key)}
                      disabled={submitting}
                      className={`min-h-[44px] py-2 px-1 text-center rounded text-xs font-bold border transition-colors cursor-pointer ${
                        paymentMethod === item.key
                          ? 'bg-[#181818] text-white border-[#181818]'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>{language === 'vi' ? 'Hướng dẫn kích hoạt:' : 'Activation Instructions:'}</span>
                </div>
                <p>
                  {paymentMethod === 'cash'
                    ? (language === 'vi'
                      ? 'Sau khi gửi yêu cầu, vui lòng ghé quầy Lễ tân của trung tâm để nộp tiền mặt. Nhân viên lễ tân sẽ xác nhận và kích hoạt gói ngay.'
                      : 'Please visit Reception Desk to pay cash and activate your membership.')
                    : (language === 'vi'
                      ? 'Gói sẽ ở trạng thái Chờ thanh toán tới khi nhân viên kế toán/lễ tân xác nhận đối soát.'
                      : 'Membership remains in Pending status until payment reconciliation.')}
                </p>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor={notesId} className="text-xs font-bold text-slate-700 block mb-1">
                  {language === 'vi' ? 'Ghi chú thêm (nếu có)' : 'Notes'}
                </label>
                <input
                  id={notesId}
                  type="text"
                  value={subNotes}
                  onChange={(e) => setSubNotes(e.target.value)}
                  disabled={submitting}
                  placeholder={language === 'vi' ? 'Ví dụ: Yêu cầu kích hoạt từ tuần sau...' : 'Notes...'}
                  className="w-full min-h-[44px] bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#BA0000] focus:ring-2 focus:ring-[#D62323]/20"
                />
              </div>

              {/* Mutation Lock Notice */}
              {isMemberMutationLocked && (
                <div role="status" className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    {language === 'vi'
                      ? 'Backend chưa xác nhận tài khoản/hồ sơ test được phép phát sinh giao dịch và cấu hình sandbox. Nút đăng ký trực tiếp được khóa để bảo vệ hệ thống, vui lòng thanh toán tại quầy Lễ tân.'
                      : 'Direct transaction mutation is safely locked until Backend confirms test account permissions and sandbox setup. Please pay at Reception Desk.'}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsSubscribeModalOpen(false)}
                  disabled={submitting}
                  className="min-h-[44px] px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submitting || isMemberMutationLocked}
                  title={isMemberMutationLocked ? (language === 'vi' ? 'Backend chưa xác nhận quyền phát sinh giao dịch và cấu hình sandbox' : 'Waiting for Backend confirmation of test profile permissions and sandbox configuration') : undefined}
                  className={`min-h-[44px] px-5 py-2 text-xs font-bold rounded flex items-center gap-2 transition-colors ${
                    isMemberMutationLocked
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-75'
                      : 'bg-[#BA0000] hover:bg-[#8E0000] text-white disabled:opacity-50 cursor-pointer'
                  }`}
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {submitting
                      ? (language === 'vi' ? 'Đang gửi...' : 'Submitting...')
                      : isMemberMutationLocked
                      ? (language === 'vi' ? 'Tạm khóa' : 'Temporarily locked')
                      : activeSubscription
                      ? (language === 'vi' ? 'Xác nhận gia hạn' : 'Confirm Renewal')
                      : (language === 'vi' ? 'Xác nhận đăng ký' : 'Confirm Subscription')}
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

export default MyMembershipView;
