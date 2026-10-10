import React, { useState, useEffect, useCallback, useId, useMemo } from 'react';
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
  validateDirectSubscriptionPreflight,
  reconcileAndVerifySubscriptionSafety,
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
  const [submitError, setSubmitError] = useState(null);

  const packageSelectId = useId();
  const notesId = useId();

  // Fetch Authoritative Data from BE (with robust fail-closed error propagation)
  const fetchMemberData = useCallback(async () => {
    if (!apiEnabled) return;

    setLoading(true);
    setError(null);
    const errorMessages = [];

    // 1. Fetch public packages catalog
    try {
      const pkgsData = await membershipApi.getPackages();
      setPackages(Array.isArray(pkgsData) ? pkgsData : []);
    } catch (pkgErr) {
      errorMessages.push(`Danh mục gói tập: ${getErrorMessage(pkgErr, 'Lỗi kết nối')}`);
    }

    // 2. Fetch member subscriptions and invoices only if memberProfileId is valid
    if (memberProfileId) {
      try {
        const subsData = await membershipApi.getMemberSubscriptions(memberProfileId);
        setSubscriptions(Array.isArray(subsData) ? subsData : []);
      } catch (subErr) {
        errorMessages.push(`Đăng ký gói hội viên: ${getErrorMessage(subErr, 'Lỗi kết nối')}`);
      }

      try {
        const invsData = await invoiceApi.getInvoices({ memberId: memberProfileId });
        setInvoices(Array.isArray(invsData) ? invsData : []);
      } catch (invErr) {
        errorMessages.push(`Hóa đơn hội viên: ${getErrorMessage(invErr, 'Lỗi kết nối')}`);
      }
    }

    if (errorMessages.length > 0) {
      setError(errorMessages.join('; '));
    }
    setLoading(false);
  }, [apiEnabled, memberProfileId]);

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

  // Handle Subscribe / Renew Submit
  const handleSubscribeSubmit = async (e) => {
    e?.preventDefault?.();
    if (submitting) return;

    if (apiEnabled) {
      setSubmitError(
        language === 'vi'
          ? 'Tính năng đăng ký trực tuyến hiện đang được bảo trì. Vui lòng liên hệ quầy tiếp tân để được hỗ trợ.'
          : 'Online registration is currently under maintenance. Please contact reception desk.'
      );
      setSubmitting(false);
      return;
    }

    // 1. Preflight validation before engaging submitting state
    const preflight = validateDirectSubscriptionPreflight({
      memberProfileId,
      selectedPackageId,
      hasAuthoritativeMemberId,
      apiEnabled,
      language,
    });

    if (!preflight.ok) {
      setSubmitError(preflight.error);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const numericPkgId = preflight.numericPackageId;

    if (apiEnabled) {
      try {
        // 2. Safe read-before-write: fetch existing subscriptions on BE to prevent duplicate registration
        let existingSubs;
        try {
          existingSubs = await membershipApi.getMemberSubscriptions(memberProfileId);
        } catch (getErr) {
          throw new Error(
            language === 'vi'
              ? `Không thể kiểm tra đăng ký hiện tại (${getErrorMessage(getErr, 'Lỗi kết nối')}). Thao tác tạm dừng để đảm bảo an toàn.`
              : `Failed to verify existing subscriptions (${getErrorMessage(getErr, 'Network error')}). Operation halted for safety.`
          );
        }

        // 3. Reconcile safety against existing active/pending records
        const safetyCheck = reconcileAndVerifySubscriptionSafety({
          existingSubscriptions: existingSubs,
          targetPackageId: numericPkgId,
          language,
        });

        if (!safetyCheck.allowed) {
          throw new Error(safetyCheck.error);
        }

        // 4. Submit subscription to BE (do not assume correlation via notes)
        const payload = {
          packageId: numericPkgId,
          paymentMethod: paymentMethod.toUpperCase(),
          isRenewal: Boolean(activeSubscription),
          notes: subNotes.trim() || undefined,
        };

        const result = await membershipApi.subscribePackage(memberProfileId, payload);
        const newSubId = result?.subscriptionId ?? result?.id;
        if (typeof newSubId !== 'number' || newSubId <= 0) {
          throw new Error(
            language === 'vi'
              ? 'Đăng ký gói đã gửi nhưng không nhận được mã đăng ký hợp lệ. Vui lòng đối soát lại danh sách.'
              : 'Subscription submitted but server did not return a valid subscription ID.'
          );
        }

        showToast?.(
          language === 'vi'
            ? 'Đăng ký gói thành công! Vui lòng hoàn tất thanh toán để kích hoạt.'
            : 'Package registered! Please complete payment to activate.',
          'success',
        );

        setIsSubscribeModalOpen(false);
        setSubNotes('');
        await fetchMemberData();
      } catch (err) {
        setSubmitError(getErrorMessage(err, language === 'vi' ? 'Không thể hoàn tất đăng ký gói. Vui lòng thử lại sau.' : 'Failed to complete package registration. Please try again later.'));
      } finally {
        setSubmitting(false);
      }
    } else {
      // A local request remains pending until the desk confirms collection.
      const chosenPkg = contextPackages.find((p) => String(p.id) === String(selectedPackageId));
      const result = createMockPendingPayment({
        member: currentMember,
        pkg: chosenPkg,
        method: paymentMethod,
        notes: subNotes.trim(),
      }, contextPayments);
      if (!result.ok) {
        setSubmitError(result.error);
        setSubmitting(false);
        return;
      }
      showToast?.(
        language === 'vi'
          ? 'Đã ghi nhận yêu cầu đăng ký gói. Vui lòng hoàn tất thanh toán tại quầy.'
          : 'Membership request recorded. Please complete payment at the desk.',
        'info',
      );
      setIsSubscribeModalOpen(false);
      setSubmitting(false);
    }
  };

  const openSubscribeModal = (initialPkgId = '') => {
    if (apiEnabled) {
      showToast?.(
        language === 'vi'
          ? 'Tính năng đăng ký trực tuyến hiện đang được bảo trì. Vui lòng liên hệ quầy tiếp tân để được hỗ trợ.'
          : 'Online registration is currently under maintenance. Please contact reception desk.',
        'warning'
      );
      return;
    }
    const defaultPkg = initialPkgId
      ? String(initialPkgId)
      : (contextPackages[0]?.id ? String(contextPackages[0].id) : '');
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
            disabled={apiEnabled}
            title={apiEnabled ? (language === 'vi' ? 'Tính năng đang bảo trì, vui lòng liên hệ quầy tiếp tân' : 'Feature temporarily unavailable, please contact reception') : undefined}
            className={`min-h-[44px] px-4 py-2 rounded text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors ${
              apiEnabled
                ? 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed opacity-75'
                : 'bg-[#BA0000] hover:bg-[#8E0000] text-white cursor-pointer'
            }`}
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

      {/* Main Active Package Card */}
      {(!apiEnabled || (!loading && !error)) && (
        <>
          {(apiEnabled ? activeSubscription : currentMember.currentPackageId) ? (
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-xs space-y-6">
              <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row justify-between gap-4">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase text-[#BA0000] bg-red-50 px-2.5 py-1 rounded border border-red-200">
                    GÓI DỊCH VỤ ĐANG HOẠT ĐỘNG
                  </span>
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
                  </p>
                </div>

                <div className="text-left md:text-right">
                  <div className="text-xs text-slate-500">Thời hạn sử dụng gói</div>
                  <div className="text-sm font-bold font-mono text-slate-900 tabular-nums mt-0.5">
                    {apiEnabled ? (
                      activeSubscription?.startDate && activeSubscription?.endDate ? (
                        `${formatDate(activeSubscription.startDate, language)} → ${formatDate(activeSubscription.endDate, language)}`
                      ) : (
                        <span className="text-slate-400 italic font-normal">Chưa xác định thời hạn</span>
                      )
                    ) : currentMember.startDate && currentMember.endDate ? (
                      `${formatDate(currentMember.startDate, language)} → ${formatDate(currentMember.endDate, language)}`
                    ) : (
                      <span className="text-slate-400 italic font-normal">
                        {language === 'vi' ? 'Chưa xác định thời hạn' : 'Undetermined validity period'}
                      </span>
                    )}
                  </div>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
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
                        disabled={apiEnabled}
                        title={apiEnabled ? (language === 'vi' ? 'Thao tác tạm thời bị khóa' : 'Temporarily unavailable') : undefined}
                        className={`w-full min-h-[44px] py-2 px-3 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1.5 ${
                          apiEnabled
                            ? 'bg-slate-200 text-slate-500 border border-slate-300 cursor-not-allowed opacity-75'
                            : isCurrent
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer'
                            : 'bg-[#BA0000] hover:bg-[#8E0000] text-white shadow-xs cursor-pointer'
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
                    {displayedSubscriptions.map((sub) => (
                      <tr key={sub.subscriptionId || sub.id} className="hover:bg-slate-50 h-[38px]">
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 tabular-nums">
                          #{sub.subscriptionId || sub.id}
                        </td>
                        <td className="py-2 px-3 font-semibold">{sub.packageName}</td>
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
                    ))}
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
                  disabled={submitting || apiEnabled}
                  title={apiEnabled ? (language === 'vi' ? 'Thao tác tạm thời bị khóa' : 'Temporarily unavailable') : undefined}
                  className={`min-h-[44px] px-5 py-2 text-xs font-bold rounded flex items-center gap-2 cursor-pointer transition-colors ${
                    apiEnabled
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-75'
                      : 'bg-[#BA0000] hover:bg-[#8E0000] text-white disabled:opacity-50'
                  }`}
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {submitting
                      ? (language === 'vi' ? 'Đang gửi...' : 'Submitting...')
                      : apiEnabled
                      ? (language === 'vi' ? 'Tạm khóa' : 'Temporarily locked')
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
