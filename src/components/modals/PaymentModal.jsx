import React, { useState, useEffect, useId } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { formatCurrency } from '../../locales/translations';
import { memberApi } from '../../api/memberApi';
import { membershipApi } from '../../api/membershipApi';
import { invoiceApi } from '../../api/invoiceApi';
import { getErrorMessage } from '../../api/apiErrors';
import { createMockPendingPayment } from '../../utils/mockFixtureSettlement';
import { CreditCard, CheckCircle2, X, AlertTriangle, RefreshCw, Loader2, Clock, Info } from 'lucide-react';

import {
  inProgressTransactionCache,
  getInProgressTransaction,
  setInProgressTransaction,
  clearInProgressTransaction,
} from '../../api/paymentSession.js';

const isValidPositiveInt = (n) => typeof n === 'number' && Number.isInteger(n) && n > 0;

export function PaymentModal({ isOpen, onClose, preselectedMemberId, onSuccess }) {
  const {
    members: contextMembers,
    packages: contextPackages,
    recordPayment,
    payments: contextPayments,
    t,
    language,
    apiEnabled,
    currentUser,
    showToast,
  } = useSCMS();

  const [memberId, setMemberId] = useState('');
  const [packageId, setPackageId] = useState('');
  const [method, setMethod] = useState('cash'); // 'cash' | 'bank_transfer' | 'online'
  const [gatewayRef, setGatewayRef] = useState('');
  const [notes, setNotes] = useState('');
  const [amountOverride, setAmountOverride] = useState('');

  // Async API state
  const [apiMembers, setApiMembers] = useState([]);
  const [apiPackages, setApiPackages] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [createdSubscriptionId, setCreatedSubscriptionId] = useState(null);
  const [createdInvoiceId, setCreatedInvoiceId] = useState(null);
  const [sessionRef, setSessionRef] = useState(null);
  const [unresolvedPendingInvoice, setUnresolvedPendingInvoice] = useState(null);
  const [preservedUnmatchedInvoice, setPreservedUnmatchedInvoice] = useState(null);
  const [memberSessions, setMemberSessions] = useState([]);
  const [ambiguousPendingSubInfo, setAmbiguousPendingSubInfo] = useState(null);

  const currentActorId = currentUser?.id ?? currentUser?.userId ?? 'anonymous';

  const memberSelectId = useId();
  const packageSelectId = useId();
  const notesInputId = useId();
  const gatewayRefId = useId();

  const isTransactionResumed = Boolean(createdSubscriptionId || createdInvoiceId);

  // Sync partial progress if exists for member and current actor
  const syncInProgressForMember = (mid) => {
    if (!mid) {
      setCreatedSubscriptionId(null);
      setCreatedInvoiceId(null);
      setSessionRef(null);
      setUnresolvedPendingInvoice(null);
      setPreservedUnmatchedInvoice(null);
      setAmbiguousPendingSubInfo(null);
      setMemberSessions([]);
      return;
    }
    const allSessions = inProgressTransactionCache.getAllSessionsForMember(String(mid), currentActorId);
    setMemberSessions(allSessions);

    const cached = inProgressTransactionCache.get(String(mid), currentActorId);
    if (cached) {
      setCreatedSubscriptionId(cached.subscriptionId || null);
      setCreatedInvoiceId(cached.invoiceId || null);
      setSessionRef(cached.sessionRef || null);
      setPreservedUnmatchedInvoice(cached.preservedUnmatchedInvoice || null);
      if (cached.packageId) setPackageId(String(cached.packageId));
      if (cached.method) setMethod(cached.method);
    } else {
      setCreatedSubscriptionId(null);
      setCreatedInvoiceId(null);
      setSessionRef(null);
      setPreservedUnmatchedInvoice(null);
    }
    setUnresolvedPendingInvoice(null);
    setAmbiguousPendingSubInfo(null);
  };

  const handleStartNewSession = () => {
    const newSessionRef = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const oldInvoice = unresolvedPendingInvoice;

    if (memberId) {
      inProgressTransactionCache.startNewSession(memberId, currentActorId, newSessionRef, {
        preservedUnmatchedInvoice: oldInvoice
          ? {
              id: oldInvoice.id ?? oldInvoice.invoiceId,
              amount: oldInvoice.amount,
              status: oldInvoice.paymentStatus || 'PENDING',
            }
          : undefined,
        packageId: Number(packageId) || undefined,
        method,
      });
      setMemberSessions(inProgressTransactionCache.getAllSessionsForMember(memberId, currentActorId));
    }

    setSessionRef(newSessionRef);
    setCreatedSubscriptionId(null);
    setCreatedInvoiceId(null);
    setPreservedUnmatchedInvoice(oldInvoice);
    setUnresolvedPendingInvoice(null);
    setAmbiguousPendingSubInfo(null);
    setSubmitError(null);

    showToast?.(
      language === 'vi'
        ? `Đã khởi tạo phiên giao dịch mới (${newSessionRef}). Hóa đơn cũ #${oldInvoice?.id ?? oldInvoice?.invoiceId} vẫn được bảo lưu an toàn.`
        : `Started new transaction session (${newSessionRef}). Previous invoice #${oldInvoice?.id ?? oldInvoice?.invoiceId} is safely preserved.`,
      'info'
    );
  };

  const handleResumeSession = (targetSessionRef) => {
    if (!targetSessionRef || !memberId) return;
    const resumed = inProgressTransactionCache.resumeSession(memberId, currentActorId, targetSessionRef);
    if (resumed) {
      setCreatedSubscriptionId(resumed.subscriptionId || null);
      setCreatedInvoiceId(resumed.invoiceId || null);
      setSessionRef(resumed.sessionRef);
      setPreservedUnmatchedInvoice(resumed.preservedUnmatchedInvoice || null);
      if (resumed.packageId) setPackageId(String(resumed.packageId));
      if (resumed.method) setMethod(resumed.method);
      setMemberSessions(inProgressTransactionCache.getAllSessionsForMember(memberId, currentActorId));
      setUnresolvedPendingInvoice(null);
      setAmbiguousPendingSubInfo(null);
      setSubmitError(null);

      showToast?.(
        language === 'vi'
          ? `Đã khôi phục phiên giao dịch (${resumed.sessionRef}).`
          : `Resumed transaction session (${resumed.sessionRef}).`,
        'info'
      );
    }
  };

  const handleResetInProgress = async () => {
    if (submitting) return;

    if (apiEnabled) {
      const lockMsg =
        language === 'vi'
          ? 'Hiện chưa thể hủy phiên này. Vui lòng thử lại sau.'
          : 'This session cannot be cancelled right now. Please try again later.';
      setSubmitError(lockMsg);
      showToast?.(lockMsg, 'warning');
      return;
    }

    const invIdToCancel = createdInvoiceId;
    const subIdToCancel = createdSubscriptionId;

    let invoiceCancelled = false;
    let subscriptionCancelled = false;
    const cancellationErrors = [];

    if (apiEnabled) {
      setSubmitting(true);
      if (isValidPositiveInt(invIdToCancel)) {
        try {
          await invoiceApi.updateInvoiceStatus(invIdToCancel, 'CANCELLED');
          invoiceCancelled = true;
        } catch (err) {
          cancellationErrors.push(`Hóa đơn #${invIdToCancel}: ${err.message || 'Lỗi cập nhật'}`);
        }
      } else {
        invoiceCancelled = true; // No invoice was created on BE
      }

      if (isValidPositiveInt(subIdToCancel)) {
        try {
          await membershipApi.updateSubscriptionStatus(subIdToCancel, 'CANCELLED');
          subscriptionCancelled = true;
        } catch (err) {
          cancellationErrors.push(`Gói đăng ký #${subIdToCancel}: ${err.message || 'Lỗi cập nhật'}`);
        }
      } else {
        subscriptionCancelled = true; // No subscription was created on BE
      }
      setSubmitting(false);
    } else {
      invoiceCancelled = true;
      subscriptionCancelled = true;
    }

    if (cancellationErrors.length > 0) {
      // Partial or complete failure on server:
      // DO NOT delete local cache. Preserve failed records so the operator knows they are still pending on server!
      const remainingSubId = subscriptionCancelled ? null : subIdToCancel;
      const remainingInvId = invoiceCancelled ? null : invIdToCancel;

      setCreatedSubscriptionId(remainingSubId);
      setCreatedInvoiceId(remainingInvId);

      if (memberId) {
        inProgressTransactionCache.set(
          String(memberId),
          {
            subscriptionId: remainingSubId,
            invoiceId: remainingInvId,
            packageId: Number(packageId) || undefined,
            method,
            sessionRef,
            preservedUnmatchedInvoice,
          },
          currentActorId,
          sessionRef
        );
        setMemberSessions(inProgressTransactionCache.getAllSessionsForMember(memberId, currentActorId));
      }

      const errMsg =
        language === 'vi'
          ? `Không thể hủy hoàn tất bản ghi trên máy chủ (${cancellationErrors.join('; ')}). Tiến trình dở dang vẫn được bảo lưu để tránh mất đồng bộ với máy chủ.`
          : `Failed to cancel records on server (${cancellationErrors.join('; ')}). In-progress state retained to prevent server desynchronization.`;

      setSubmitError(errMsg);
      showToast?.(errMsg, 'error');
      return;
    }

    // All cancelled on server (or mock mode): safe to clear local state & cache for this session
    if (memberId) {
      inProgressTransactionCache.delete(String(memberId), currentActorId, sessionRef);
      setMemberSessions(inProgressTransactionCache.getAllSessionsForMember(memberId, currentActorId));
    }
    setCreatedSubscriptionId(null);
    setCreatedInvoiceId(null);
    setSessionRef(null);
    setUnresolvedPendingInvoice(null);
    setAmbiguousPendingSubInfo(null);
    setSubmitError(null);
    showToast?.(
      language === 'vi'
        ? 'Đã hủy thành công các bản ghi dở dang trên máy chủ và giải phóng phiên làm việc.'
        : 'In-progress records successfully cancelled on server and transaction session cleared.',
      'info'
    );
  };

  const handleClose = () => {
    if (submitting) return;
    if (isTransactionResumed) {
      const confirmMsg =
        language === 'vi'
          ? 'Giao dịch đã được ghi nhận một phần trên máy chủ (đã tạo gói hoặc hóa đơn). Đóng cửa sổ sẽ bảo lưu tiến trình này để xử lý tiếp sau. Bạn có chắc chắn muốn đóng?'
          : 'Transaction was partially recorded on server. Exiting now preserves this progress for later resumption. Are you sure you want to close?';
      if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) {
        return;
      }
    }
    onClose();
  };

  // Handle Escape key to dismiss modal safely when not submitting
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        if (!submitting) {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, submitting]);

  // Reset form when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setSubmitError(null);
      setSubmitting(false);
      return;
    }

    setSubmitError(null);

    if (apiEnabled) {
      let isMounted = true;
      setLoadingData(true);
      setFetchError(null);

      Promise.all([
        memberApi.getMembers(),
        membershipApi.getPackages(),
      ])
        .then(([mList, pList]) => {
          if (!isMounted) return;
          const validMembers = Array.isArray(mList) ? mList : [];
          const validPackages = Array.isArray(pList) ? pList : [];
          setApiMembers(validMembers);
          setApiPackages(validPackages);

          const initialMember = preselectedMemberId
            ? validMembers.find((m) => String(m.id) === String(preselectedMemberId)) || validMembers[0]
            : validMembers[0];
          const chosenMid = initialMember ? String(initialMember.id) : '';
          setMemberId(chosenMid);

          const initialPkg = validPackages[0];
          setPackageId(initialPkg ? String(initialPkg.id) : '');

          syncInProgressForMember(chosenMid);
        })
        .catch((err) => {
          if (!isMounted) return;
          setFetchError(getErrorMessage(err, 'Không thể tải danh mục hội viên hoặc gói tập.'));
        })
        .finally(() => {
          if (isMounted) setLoadingData(false);
        });

      return () => {
        isMounted = false;
      };
    } else {
      const initialMember = preselectedMemberId
        ? contextMembers.find((m) => String(m.id) === String(preselectedMemberId)) || contextMembers[0]
        : contextMembers[0];
      setMemberId(initialMember ? String(initialMember.id) : '');

      const initialPkg = contextPackages[0];
      setPackageId(initialPkg ? String(initialPkg.id) : '');
    }
  }, [isOpen, apiEnabled, preselectedMemberId, contextMembers, contextPackages]);

  if (!isOpen) return null;

  const availableMembers = apiEnabled ? apiMembers : contextMembers;
  const availablePackages = apiEnabled ? apiPackages : contextPackages;

  const selectedPkg = availablePackages.find((p) => String(p.id) === String(packageId));
  const defaultAmount = selectedPkg ? selectedPkg.price : 0;
  const currentAmount = amountOverride !== '' ? Number(amountOverride) : defaultAmount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!memberId || !packageId) {
      setSubmitError(language === 'vi' ? 'Vui lòng chọn hội viên và gói dịch vụ.' : 'Please select member and membership package.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const numericMemberId = Number(memberId);
    const numericPackageId = Number(packageId);

    if (apiEnabled) {
      setSubmitError(
        language === 'vi'
          ? 'Hiện chưa thể ghi nhận giao dịch. Vui lòng thử lại sau.'
          : 'This transaction cannot be recorded right now. Please try again later.'
      );
      setSubmitting(false);
      return;
    }

    if (apiEnabled) {
      try {
        // Ensure a session reference exists for this transaction attempt
        const currentSessionRef =
          sessionRef || `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        if (!sessionRef) {
          setSessionRef(currentSessionRef);
        }

        let currentSubId = createdSubscriptionId;

        // Step 1: Subscribe member to package on BE (with strict deduplication check)
        if (!currentSubId) {
          // Strict GET query - fail closed on error, never swallow error as empty list
          let existingSubs;
          try {
            existingSubs = await membershipApi.getMemberSubscriptions(numericMemberId);
          } catch (getErr) {
            throw new Error(
              language === 'vi'
                ? `Không thể kiểm tra đăng ký hiện tại trên máy chủ (${getErr.message || 'Lỗi kết nối'}). Giao dịch tạm dừng để tránh tạo trùng lặp.`
                : `Failed to verify existing subscriptions on server (${getErr.message || 'Network error'}). Transaction halted to prevent duplicates.`
            );
          }

          // Correlated subscription strictly verified by retained positive numeric ID
          // Note: MemberPackageResponse and OpenAPI mapper do NOT include notes or sessionRef,
          // so correlation must strictly rely on locally retained positive numeric IDs.
          const correlatedSub = Array.isArray(existingSubs)
            ? existingSubs.find(
                (s) =>
                  String(s.packageId) === String(numericPackageId) &&
                  (s.status === 'pending_payment' || s.status === 'pending') &&
                  isValidPositiveInt(createdSubscriptionId) &&
                  (s.subscriptionId === createdSubscriptionId || s.id === createdSubscriptionId)
              )
            : null;

          // Ambiguous pending subscription for this package not correlated to current session
          const ambiguousPendingSub = Array.isArray(existingSubs)
            ? existingSubs.find(
                (s) =>
                  String(s.packageId) === String(numericPackageId) &&
                  (s.status === 'pending_payment' || s.status === 'pending') &&
                  !correlatedSub
              )
            : null;

          if (correlatedSub) {
            const subId = correlatedSub.subscriptionId ?? correlatedSub.id;
            if (!isValidPositiveInt(subId)) {
              throw new Error(
                language === 'vi'
                  ? 'Mã đăng ký gói liên kết không hợp lệ (yêu cầu số nguyên dương).'
                  : 'Correlated subscription ID is invalid (positive integer required).'
              );
            }
            currentSubId = subId;
          } else if (ambiguousPendingSub) {
            // Ambiguous pending subscription found: STOP BEFORE MUTATION
            const ambigId = ambiguousPendingSub.subscriptionId ?? ambiguousPendingSub.id;
            const owningSession = (memberSessions || []).find((s) => s.subscriptionId === ambigId);
            setAmbiguousPendingSubInfo({
              subId: ambigId,
              packageId: numericPackageId,
              matchingSessionRef: owningSession?.sessionRef || null,
            });
            throw new Error(
              language === 'vi'
                ? `Phát hiện đăng ký gói đang chờ (#${ambigId}) của hội viên này trên máy chủ. Do OpenAPI/mapper không trả sessionRef trong bản ghi đăng ký gói, phiên mới không thể tự động gán để tránh tạo trùng lặp. Vui lòng kiểm tra danh sách phiên bảo lưu bên dưới để tiếp tục phiên tương ứng hoặc đối soát trên hệ thống.`
                : `Ambiguous pending subscription (#${ambigId}) found on server without session correlation in OpenAPI mapper. Halting before mutation to prevent duplicate subscriptions. Please resume from preserved sessions or audit.`
            );
          } else {
            const subPayload = {
              packageId: numericPackageId,
              paymentMethod: method.toUpperCase(),
              notes: notes.trim()
                ? `${notes.trim()} [SessionRef: ${currentSessionRef}]`
                : `[SessionRef: ${currentSessionRef}]`,
            };
            const sub = await membershipApi.subscribePackage(numericMemberId, subPayload);
            const subId = sub?.subscriptionId ?? sub?.id;
            if (!isValidPositiveInt(subId)) {
              throw new Error(
                language === 'vi'
                  ? 'Đăng ký gói đã gửi nhưng máy chủ không trả về mã đăng ký (ID) số nguyên dương hợp lệ. Giao dịch tạm dừng để bảo toàn dữ liệu.'
                  : 'Subscription requested but server did not return a valid positive integer subscription ID.'
              );
            }
            currentSubId = subId;
          }

          setCreatedSubscriptionId(currentSubId);
          inProgressTransactionCache.set(
            String(numericMemberId),
            {
              subscriptionId: currentSubId,
              invoiceId: createdInvoiceId,
              packageId: numericPackageId,
              method,
              sessionRef: currentSessionRef,
              preservedUnmatchedInvoice,
            },
            currentActorId,
            currentSessionRef
          );
          setMemberSessions(inProgressTransactionCache.getAllSessionsForMember(numericMemberId, currentActorId));
        }

        // Step 2: Invoice creation / Correlating with BE to avoid duplicate invoice
        let invId = createdInvoiceId;
        if (!invId) {
          // Strict GET query - fail closed on error, never swallow error as empty list
          let existingPendingInvoices;
          try {
            existingPendingInvoices = await invoiceApi.getInvoices({
              memberId: numericMemberId,
              packageId: numericPackageId,
              status: 'pending',
            });
          } catch (getErr) {
            throw new Error(
              language === 'vi'
                ? `Không thể kiểm tra hóa đơn hiện tại trên máy chủ (${getErr.message || 'Lỗi kết nối'}). Giao dịch tạm dừng để tránh tạo hóa đơn trùng lặp.`
                : `Failed to verify existing invoices on server (${getErr.message || 'Network error'}). Transaction halted to prevent duplicate invoices.`
            );
          }

          // Strict correlation check:
          // An invoice belongs to THIS transaction session only if its gatewayTransactionRef matches currentSessionRef
          // or its retained ID matches createdInvoiceId. Note: OpenAPI mapper does not return notes for invoices.
          const correlatedInvoice = Array.isArray(existingPendingInvoices)
            ? existingPendingInvoices.find(
                (inv) =>
                  (currentSessionRef && inv.gatewayTransactionRef === currentSessionRef) ||
                  (isValidPositiveInt(createdInvoiceId) && (inv.id === createdInvoiceId || inv.invoiceId === createdInvoiceId))
              )
            : null;

          if (correlatedInvoice) {
            const invIdNum = correlatedInvoice.id ?? correlatedInvoice.invoiceId;
            if (!isValidPositiveInt(invIdNum)) {
              throw new Error(
                language === 'vi'
                  ? 'Mã hóa đơn liên kết không hợp lệ (yêu cầu số nguyên dương).'
                  : 'Correlated invoice ID is invalid (positive integer required).'
              );
            }
            invId = invIdNum;
          } else {
            // Check if there are unmatched pending invoices
            const unmatchedInvoice = Array.isArray(existingPendingInvoices)
              ? existingPendingInvoices.find(
                  (inv) =>
                    !currentSessionRef ||
                    inv.gatewayTransactionRef !== currentSessionRef
                )
              : null;

            if (
              unmatchedInvoice &&
              (!preservedUnmatchedInvoice ||
                (preservedUnmatchedInvoice.id !== unmatchedInvoice.id &&
                  preservedUnmatchedInvoice.invoiceId !== unmatchedInvoice.id))
            ) {
              // Unmatched pending invoice found: STOP and offer explicit "Tạo phiên mới"
              setUnresolvedPendingInvoice(unmatchedInvoice);
              setSubmitting(false);
              return;
            }

            // Create new invoice with sessionRef
            const invoicePayload = {
              memberId: numericMemberId,
              packageId: numericPackageId,
              receptionistId: currentUser?.id ? Number(currentUser.id) : undefined,
              amount: currentAmount,
              paymentMethod: method.toUpperCase(),
              paymentStatus: 'PENDING',
              gatewayTransactionRef: gatewayRef.trim() || currentSessionRef,
              notes: notes.trim()
                ? `${notes.trim()} [SessionRef: ${currentSessionRef}]`
                : `[SessionRef: ${currentSessionRef}]`,
            };
            const inv = await invoiceApi.createInvoice(invoicePayload);
            const invIdNum = inv?.id ?? inv?.invoiceId;
            if (!isValidPositiveInt(invIdNum)) {
              throw new Error(
                language === 'vi'
                  ? 'Hóa đơn đã được khởi tạo nhưng máy chủ không trả về mã hóa đơn (ID) số nguyên dương hợp lệ. Không thể hoàn tất bước thu tiền.'
                  : 'Invoice creation requested but server response did not include a valid positive integer invoice ID.'
              );
            }
            invId = invIdNum;
          }

          setCreatedInvoiceId(invId);
          inProgressTransactionCache.set(
            String(numericMemberId),
            {
              subscriptionId: currentSubId,
              invoiceId: invId,
              packageId: numericPackageId,
              method,
              sessionRef: currentSessionRef,
              preservedUnmatchedInvoice,
            },
            currentActorId,
            currentSessionRef
          );
          setMemberSessions(inProgressTransactionCache.getAllSessionsForMember(numericMemberId, currentActorId));
        }

        // Step 3: Cash Payment or Online/Bank settlement acknowledgment
        if (method === 'cash') {
          if (!isValidPositiveInt(invId)) {
            throw new Error(
              language === 'vi'
                ? 'Thiếu mã hóa đơn hợp lệ (số nguyên dương) để thực hiện thu tiền mặt.'
                : 'Missing valid positive integer invoice ID to execute cash payment.'
            );
          }
          await invoiceApi.payInvoice(invId, {
            paymentMethod: 'CASH',
            receptionistId: currentUser?.id ? Number(currentUser.id) : undefined,
            notes: notes.trim() || (language === 'vi' ? 'Thanh toán tiền mặt tại quầy' : 'Cash desk collection'),
          });

          showToast?.(
            language === 'vi'
              ? 'Đã đăng ký gói và thu tiền mặt thành công (Hóa đơn đã thanh toán)!'
              : 'Package registered and cash payment completed successfully!',
            'success',
          );
        } else {
          // Online or Bank Transfer: invoice created in PENDING status, awaiting external settlement/audit
          showToast?.(
            language === 'vi'
              ? 'Đã lập đăng ký gói và hóa đơn chờ thanh toán (Trạng thái: Chờ đối soát).'
              : 'Subscription & pending invoice created (Status: Pending verification).',
            'info',
          );
        }

        // Complete transaction: clear in-progress cache for this specific session
        inProgressTransactionCache.delete(String(numericMemberId), currentActorId, currentSessionRef);
        setCreatedSubscriptionId(null);
        setCreatedInvoiceId(null);
        setSessionRef(null);
        setUnresolvedPendingInvoice(null);
        setPreservedUnmatchedInvoice(null);

        onSuccess?.();
        onClose();
      } catch (err) {
        setSubmitError(
          getErrorMessage(
            err,
            'Lỗi ghi nhận giao dịch từ máy chủ. Giao dịch có thể đã được ghi nhận một phần, vui lòng kiểm tra lại.',
          ),
        );
      } finally {
        setSubmitting(false);
      }
    } else {
      // Mock mode
      try {
        if (method === 'cash') {
          recordPayment(memberId, packageId, currentAmount, method, notes);
        } else {
          const member = availableMembers.find((m) => String(m.id) === String(memberId));
          const pending = createMockPendingPayment({
            member,
            pkg: selectedPkg ? { ...selectedPkg, price: currentAmount } : null,
            method,
            notes,
          }, contextPayments);
          if (!pending.ok) throw new Error(pending.error);
        }
        showToast?.(
          language === 'vi'
            ? (method === 'cash' ? 'Đã ghi nhận thu tiền mặt.' : 'Đã tạo yêu cầu chờ đối soát thanh toán.')
            : (method === 'cash' ? 'Cash collection recorded.' : 'Payment request is pending reconciliation.'),
          method === 'cash' ? 'success' : 'info',
        );
        if (memberId) {
          inProgressTransactionCache.delete(String(memberId), currentActorId, sessionRef);
        }
        setCreatedSubscriptionId(null);
        setCreatedInvoiceId(null);
        setSessionRef(null);
        setUnresolvedPendingInvoice(null);
        setPreservedUnmatchedInvoice(null);
        onSuccess?.();
        onClose();
      } catch (err) {
        setSubmitError(getErrorMessage(err, 'Lỗi xử lý thanh toán.'));
        setSubmitting(false);
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto"
    >
      <div className="bg-white border border-slate-200 rounded-lg w-full max-w-lg shadow-xl p-6 my-8 text-[#181818]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
          <div className="flex items-center gap-2 font-bold text-sm text-[#181818]">
            <div className="p-2 bg-emerald-50 text-emerald-800 rounded border border-emerald-200">
              <CreditCard className="w-4 h-4" />
            </div>
            <span id="payment-modal-title">{t('recordPayment')}</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng cửa sổ"
            className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Loading state for API dependencies */}
        {loadingData ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 text-[#BA0000] animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-600 font-semibold">
              {language === 'vi' ? 'Đang tải thông tin hội viên và gói dịch vụ...' : 'Loading members and packages...'}
            </p>
          </div>
        ) : fetchError ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded text-xs space-y-3">
            <div className="flex items-center gap-2 text-rose-800 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{language === 'vi' ? 'Lỗi kết nối' : 'Connection Error'}</span>
            </div>
            <p className="text-rose-700">{fetchError}</p>
            <button
              type="button"
              onClick={() => {
                setLoadingData(true);
                setFetchError(null);
                Promise.all([memberApi.getMembers(), membershipApi.getPackages()])
                  .then(([mList, pList]) => {
                    setApiMembers(mList);
                    setApiPackages(pList);
                  })
                  .catch((err) => setFetchError(getErrorMessage(err)))
                  .finally(() => setLoadingData(false));
              }}
              className="px-3 py-1.5 bg-[#BA0000] text-white rounded text-xs font-bold hover:bg-[#8E0000] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{language === 'vi' ? 'Thử lại' : 'Retry'}</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">

            {submitError && (
              <div
                role="alert"
                className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold">{language === 'vi' ? 'Không thể hoàn tất:' : 'Failed:'}</span>{' '}
                  {submitError}
                </div>
              </div>
            )}

            {/* In-progress Resumed Banner */}
            {isTransactionResumed && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 space-y-1.5">
                <div className="font-bold flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{language === 'vi' ? 'Tiến trình giao dịch đang thực hiện dở dang' : 'In-progress Transaction Resumed'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetInProgress}
                    disabled={submitting || apiEnabled}
                    className={`text-[11px] font-bold underline ${
                      apiEnabled ? 'text-slate-400 cursor-not-allowed opacity-60' : 'text-rose-700 hover:text-rose-900 cursor-pointer'
                    }`}
                  >
                    {language === 'vi' ? 'Hủy phiên & Bắt đầu lại' : 'Discard & Reset'}
                  </button>
                </div>
                <div className="text-[11px] space-y-0.5 text-amber-800">
                  {createdSubscriptionId && (
                    <p>
                      • {language === 'vi' ? `Đã tạo đăng ký gói thành viên (ID #${createdSubscriptionId})` : `Subscription created (ID #${createdSubscriptionId})`}
                    </p>
                  )}
                  {createdInvoiceId && (
                    <p>
                      • {language === 'vi' ? `Đã lập hóa đơn (ID #${createdInvoiceId}, Trạng thái: Chờ thanh toán)` : `Invoice created (ID #${createdInvoiceId}, Status: Pending settlement)`}
                    </p>
                  )}
                </div>
                <p className="text-[11px] text-amber-700 italic">
                  {language === 'vi'
                    ? 'Thông tin hội viên, gói và phương thức đã được cố định để tránh tạo trùng lặp giao dịch.'
                    : 'Member, package, and method are fixed to prevent duplicate transactions.'}
                </p>
              </div>
            )}

            {/* Manual Resolution Box for Uncorrelated Pending Invoice */}
            {/* Unmatched Pending Invoice Alert & Start New Session Action */}
            {unresolvedPendingInvoice && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded text-xs text-amber-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{language === 'vi' ? 'Phát hiện hóa đơn chờ thanh toán chưa khớp mã phiên' : 'Unmatched Pending Invoice Detected'}</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  {language === 'vi'
                    ? `Hội viên này đang có hóa đơn #${unresolvedPendingInvoice.id ?? unresolvedPendingInvoice.invoiceId} (Số tiền: ${(unresolvedPendingInvoice.amount || 0).toLocaleString()} VNĐ) ở trạng thái chờ thanh toán. Hóa đơn này chưa được liên kết với phiên hiện tại và được giữ nguyên (không tự động gắn, không thu tiền và không hủy).`
                    : `This member has pending invoice #${unresolvedPendingInvoice.id ?? unresolvedPendingInvoice.invoiceId} (${(unresolvedPendingInvoice.amount || 0).toLocaleString()} VND). This invoice is not correlated to the current session and remains untouched.`}
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleStartNewSession}
                    className="px-3.5 py-1.5 bg-[#BA0000] hover:bg-[#8E0000] text-white rounded font-bold text-xs transition-colors cursor-pointer"
                  >
                    {language === 'vi' ? 'Tạo phiên mới' : 'Start New Session'}
                  </button>
                </div>
              </div>
            )}

            {/* Preserved Unmatched Invoice Informational Notice */}
            {preservedUnmatchedInvoice && !unresolvedPendingInvoice && (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-bold text-slate-800">
                    {language === 'vi' ? 'Hóa đơn chờ được bảo lưu:' : 'Preserved pending invoice:'}
                  </span>{' '}
                  {language === 'vi'
                    ? `Hóa đơn #${preservedUnmatchedInvoice.id ?? preservedUnmatchedInvoice.invoiceId} (${(preservedUnmatchedInvoice.amount || 0).toLocaleString()} VNĐ) được giữ nguyên ở trạng thái chờ thanh toán và không bị ảnh hưởng bởi phiên giao dịch mới (${sessionRef || 'mới'}).`
                    : `Invoice #${preservedUnmatchedInvoice.id ?? preservedUnmatchedInvoice.invoiceId} (${(preservedUnmatchedInvoice.amount || 0).toLocaleString()} VND) is preserved in pending status and will not be touched by this session.`}
                </div>
              </div>
            )}

            {/* Ambiguous Pending Subscription Alert */}
            {ambiguousPendingSubInfo && (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded text-xs text-rose-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    {language === 'vi'
                      ? `Phát hiện yêu cầu đăng ký gói đang chờ xử lý (#${ambiguousPendingSubInfo.subId})`
                      : `Pending Package Subscription (#${ambiguousPendingSubInfo.subId}) Detected`}
                  </span>
                </div>
                <p className="text-[11px] text-rose-800 leading-relaxed">
                  {language === 'vi'
                    ? 'Yêu cầu đăng ký gói chưa được đối soát với phiên hiện tại. Để đảm bảo an toàn và tránh phát sinh trùng lặp, giao dịch tạm dừng trước bước gửi mới.'
                    : 'Pending subscription request has not been reconciled with the current session. Transaction paused to prevent duplicates.'}
                </p>
                {ambiguousPendingSubInfo.matchingSessionRef && (
                  <div className="pt-1 flex items-center justify-between bg-white/60 p-2 rounded border border-rose-200">
                    <span className="text-[11px] text-rose-900">
                      {language === 'vi' ? 'Phiên bảo lưu khớp:' : 'Matching preserved session:'}{' '}
                      <strong className="font-mono">{ambiguousPendingSubInfo.matchingSessionRef}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleResumeSession(ambiguousPendingSubInfo.matchingSessionRef)}
                      className="px-2.5 py-1 bg-[#BA0000] hover:bg-[#8E0000] text-white rounded text-[11px] font-bold cursor-pointer"
                    >
                      {language === 'vi' ? 'Mở lại phiên này' : 'Resume Session'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Local Draft Indicator */}
            {sessionRef && !isTransactionResumed && (
              <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold">{language === 'vi' ? 'Phiên làm việc mới' : 'New Session'}:</span>
                  <span className="font-mono text-blue-800 font-bold">{sessionRef}</span>
                  <span className="px-1.5 py-0.5 bg-blue-200 text-blue-800 rounded text-[10px] font-bold">
                    {language === 'vi' ? 'Chưa hoàn tất' : 'In progress'}
                  </span>
                </div>
              </div>
            )}

            {/* Preserved Sessions List for Member */}
            {memberSessions.length > 0 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-600" />
                    {language === 'vi' ? 'Các phiên giao dịch đã bảo lưu của hội viên này' : 'Preserved Transactions for Member'}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">
                    {memberSessions.length} {language === 'vi' ? 'phiên' : 'session(s)'}
                  </span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {memberSessions.map((s) => {
                    const isCurrent = s.sessionRef === sessionRef;
                    return (
                      <div
                        key={s.sessionRef}
                        className={`p-2 rounded border text-[11px] flex items-center justify-between gap-2 ${
                          isCurrent
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium'
                            : 'bg-white border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="space-y-0.5 truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold">{s.sessionRef}</span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.2 bg-emerald-200 text-emerald-800 rounded text-[10px] font-bold">
                                {language === 'vi' ? 'Đang mở' : 'Active'}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {s.subscriptionId ? (language === 'vi' ? `Đăng ký #${s.subscriptionId}` : `Subscription #${s.subscriptionId}`) : (language === 'vi' ? 'Chưa có đăng ký' : 'No subscription')} • {s.invoiceId ? (language === 'vi' ? `Hóa đơn #${s.invoiceId}` : `Invoice #${s.invoiceId}`) : (language === 'vi' ? 'Chưa có hóa đơn' : 'No invoice')} • {s.method === 'bank_transfer' ? (language === 'vi' ? 'Chuyển khoản' : 'Bank transfer') : s.method === 'online' ? (language === 'vi' ? 'Trực tuyến' : 'Online') : (language === 'vi' ? 'Tiền mặt' : 'Cash')}
                          </div>
                        </div>
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => handleResumeSession(s.sessionRef)}
                            disabled={submitting}
                            className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded font-bold text-[10px] shrink-0 cursor-pointer disabled:opacity-50"
                          >
                            {language === 'vi' ? 'Tiếp tục phiên này' : 'Resume'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Member Selection */}
            <div>
              <label htmlFor={memberSelectId} className="text-xs font-bold text-slate-700 block mb-1">
                {language === 'vi' ? 'Chọn Thành viên' : 'Select Member'} <span className="text-rose-600">*</span>
              </label>
              <select
                id={memberSelectId}
                value={memberId}
                onChange={(e) => {
                  const newMid = e.target.value;
                  setMemberId(newMid);
                  syncInProgressForMember(newMid);
                }}
                disabled={submitting || isTransactionResumed}
                className="w-full min-h-[44px] bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#BA0000] focus:ring-2 focus:ring-[#D62323]/20 disabled:bg-slate-100 disabled:text-slate-500"
              >
                {availableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.code || `ID #${m.id}`}) {m.phone ? `- ${m.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Package Selection */}
            <div>
              <label htmlFor={packageSelectId} className="text-xs font-bold text-slate-700 block mb-1">
                {language === 'vi' ? 'Gói đăng ký' : 'Membership Package'} <span className="text-rose-600">*</span>
              </label>
              <select
                id={packageSelectId}
                value={packageId}
                onChange={(e) => {
                  setPackageId(e.target.value);
                  setAmountOverride('');
                }}
                disabled={submitting || isTransactionResumed}
                className="w-full min-h-[44px] bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-[#BA0000] focus:ring-2 focus:ring-[#D62323]/20 disabled:bg-slate-100 disabled:text-slate-500"
              >
                {availablePackages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {language === 'vi' ? (p.nameVi || p.name) : p.name} - {formatCurrency(p.price, language)} ({p.durationDays ? `${p.durationDays} ngày` : `${p.durationMonths || 1} tháng`})
                  </option>
                ))}
              </select>
            </div>

            {/* Amount Display */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-600 font-bold block">
                  {language === 'vi' ? 'Số tiền thanh toán:' : 'Total Amount:'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {language === 'vi' ? 'Giá niêm yết của gói' : 'Listed package price'}
                </span>
              </div>
              <span className="text-lg font-bold font-mono text-[#BA0000] tabular-nums">
                {formatCurrency(currentAmount, language)}
              </span>
            </div>

            {/* Payment Method Selector */}
            <div>
              <span className="text-xs font-bold text-slate-700 block mb-1">
                {language === 'vi' ? 'Phương thức thanh toán' : 'Payment Method'}
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'cash', label: language === 'vi' ? 'Tiền mặt tại quầy' : 'Cash at Desk' },
                  { key: 'bank_transfer', label: language === 'vi' ? 'Chuyển khoản / VietQR' : 'Bank Transfer' },
                  { key: 'online', label: language === 'vi' ? 'Trực tuyến' : 'Online' },
                ].map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    onClick={() => setMethod(item.key)}
                    disabled={submitting || isTransactionResumed}
                    className={`min-h-[44px] py-2 px-2 rounded text-xs font-bold border text-center transition-all cursor-pointer whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed ${
                      method === item.key
                        ? 'bg-[#181818] text-white border-[#181818] shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Gateway Reference (when bank transfer or online) */}
            {method !== 'cash' && (
              <div>
                <label htmlFor={gatewayRefId} className="text-xs font-bold text-slate-700 block mb-1">
                  {language === 'vi' ? 'Mã tham chiếu giao dịch / Mã chuyển khoản' : 'Transaction Reference Code'}
                </label>
                <input
                  id={gatewayRefId}
                  type="text"
                  value={gatewayRef}
                  onChange={(e) => setGatewayRef(e.target.value)}
                  disabled={submitting}
                  placeholder={language === 'vi' ? 'Ví dụ: VNPAY-123456 hoặc MB-889900...' : 'e.g. TXN-123456...'}
                  className="w-full min-h-[44px] bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#BA0000] focus:ring-2 focus:ring-[#D62323]/20 disabled:bg-slate-100"
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label htmlFor={notesInputId} className="text-xs font-bold text-slate-700 block mb-1">
                {language === 'vi' ? 'Ghi chú giao dịch' : 'Notes'}
              </label>
              <input
                id={notesInputId}
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitting}
                placeholder={language === 'vi' ? 'Ghi chú số biên lai, yêu cầu của khách...' : 'Receipt notes...'}
                className="w-full min-h-[44px] bg-slate-50 border border-slate-300 rounded px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#BA0000] focus:ring-2 focus:ring-[#D62323]/20 disabled:bg-slate-100"
              />
            </div>

            {/* Policy Notice */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded flex items-start gap-2 text-emerald-900 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                {method === 'cash'
                  ? (language === 'vi'
                    ? 'Sau khi xác nhận thu tiền mặt, trạng thái thanh toán và gói hội viên sẽ được cập nhật.'
                    : 'After cash collection is confirmed, payment and membership status will be updated.')
                  : (language === 'vi'
                    ? 'Giao dịch chuyển khoản/online sẽ khởi tạo hóa đơn ở trạng thái Chờ xử lý (Pending) tới khi hoàn tất đối soát.'
                    : 'Bank transfer/online initiates invoice in Pending status until audit confirmation.')}
              </span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="min-h-[44px] px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded shadow-xs cursor-pointer disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting || apiEnabled || (isTransactionResumed ? false : (!memberId || !packageId))}
                title={apiEnabled ? (language === 'vi' ? 'Thao tác tạm thời bị khóa' : 'Temporarily unavailable') : undefined}
                className={`min-h-[44px] px-5 py-2 font-bold rounded shadow-xs flex items-center gap-2 cursor-pointer transition-colors ${
                  apiEnabled
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-75'
                    : 'bg-[#BA0000] hover:bg-[#8E0000] text-white disabled:opacity-50'
                }`}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {submitting
                    ? (language === 'vi' ? 'Đang xử lý...' : 'Processing...')
                    : apiEnabled
                    ? (language === 'vi' ? 'Tạm khóa' : 'Temporarily locked')
                    : createdInvoiceId && method === 'cash'
                    ? (language === 'vi' ? 'Thử lại bước thu tiền mặt' : 'Retry Cash Collection')
                    : createdSubscriptionId
                    ? (language === 'vi' ? 'Thử lại bước tạo hóa đơn' : 'Retry Invoice Creation')
                    : (language === 'vi' ? 'Xác nhận & Ghi nhận' : 'Confirm & Record')}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default PaymentModal;
