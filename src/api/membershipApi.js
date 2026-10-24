import { httpClient } from "./httpClient.js"
import {
  mapMembershipPackage,
  toMembershipPackageRequest,
  mapMemberSubscription,
  toMemberPackageRequest,
  mapSubscriptionOrder,
} from "./membershipMappers.js"
import { extractList, isValidNumericId } from "./schemaValidators.js"
import { inProgressTransactionCache } from "./paymentSession.js"
import { invoiceApi } from "./invoiceApi.js"

const isValidPositiveInt = (n) =>
  typeof n === "number" && Number.isInteger(n) && n > 0

export const getPackages = async () => {
  const data = await httpClient.get("/api/packages")
  const list = extractList(data)
  return Array.isArray(list)
    ? list.map(mapMembershipPackage).filter(Boolean)
    : []
}

export const getPublicPackages = async (centerId = null) => {
  const query = centerId ? `?centerId=${encodeURIComponent(centerId)}` : ""
  const data = await httpClient.get(`/api/public/membership-packages${query}`)
  const list = extractList(data)
  return Array.isArray(list)
    ? list.map(mapMembershipPackage).filter(Boolean)
    : []
}

export const getPackageById = async (id) => {
  if (!isValidNumericId(id)) {
    throw new Error("ID gói thành viên không hợp lệ.")
  }
  const data = await httpClient.get(`/api/packages/${id}`)
  return mapMembershipPackage(data)
}

export const createPackage = async (data) => {
  const payload = toMembershipPackageRequest(data)
  const created = await httpClient.post("/api/packages", payload)
  return mapMembershipPackage(created)
}

export const updatePackage = async (id, data) => {
  if (!isValidNumericId(id)) {
    throw new Error("ID gói thành viên không hợp lệ.")
  }
  const payload = toMembershipPackageRequest(data)
  const updated = await httpClient.put(`/api/packages/${id}`, payload)
  return mapMembershipPackage(updated)
}

export const updatePackageStatus = async (id, status) => {
  if (!isValidNumericId(id)) {
    throw new Error("ID gói thành viên không hợp lệ.")
  }
  const updated = await httpClient.patch(`/api/packages/${id}/status`, {
    status: String(status),
  })
  return mapMembershipPackage(updated)
}

export const getMemberSubscriptions = async (memberId) => {
  if (!isValidNumericId(memberId)) {
    throw new Error("ID hội viên không hợp lệ.")
  }
  const data = await httpClient.get(`/api/members/${memberId}/packages`)
  const list = extractList(data)
  return Array.isArray(list)
    ? list.map(mapMemberSubscription).filter(Boolean)
    : []
}

export const subscribePackage = async (memberId, data) => {
  if (!isValidNumericId(memberId)) {
    throw new Error("ID hội viên không hợp lệ.")
  }
  const payload = toMemberPackageRequest(data)
  const response = await httpClient.post(
    `/api/members/${memberId}/packages`,
    payload,
  )
  const mapped = mapSubscriptionOrder(response)

  const hasValidSubscriptionId = isValidNumericId(mapped?.subscriptionId)
  const hasValidInvoiceId = isValidNumericId(mapped?.invoiceId)

  if (!hasValidSubscriptionId || !hasValidInvoiceId) {
    const missingParts = []
    if (!hasValidSubscriptionId)
      missingParts.push("mã đăng ký (subscriptionId)")
    if (!hasValidInvoiceId) missingParts.push("mã hóa đơn (invoiceId)")
    const error = new Error(
      `Phản hồi tạo đơn thiếu định danh bắt buộc (${missingParts.join(", ")}). Đơn có thể đã được tạo trên hệ thống; vui lòng thực hiện GET đối soát, không tự gửi lại yêu cầu đăng ký.`,
    )
    error.name = "IncompleteOrderResponseError"
    error.partialOrder = mapped
    error.requiresReconciliation = true
    throw error
  }

  return mapped
}

export const subscribeMe = async (data) => {
  const payload = toMemberPackageRequest(data)
  const response = await httpClient.post(
    "/api/members/me/subscriptions",
    payload,
  )
  const mapped = mapSubscriptionOrder(response)

  const hasValidSubscriptionId = isValidNumericId(mapped?.subscriptionId)
  const hasValidInvoiceId = isValidNumericId(mapped?.invoiceId)

  if (!hasValidSubscriptionId || !hasValidInvoiceId) {
    const error = new Error(
      "Phản hồi tạo đơn thiếu định danh bắt buộc (subscriptionId hoặc invoiceId). Đơn có thể đã được tạo trên hệ thống; vui lòng thực hiện GET đối soát, không tự gửi lại yêu cầu đăng ký.",
    )
    error.name = "IncompleteOrderResponseError"
    error.partialOrder = mapped
    error.requiresReconciliation = true
    throw error
  }

  return mapped
}
export const getAllSubscriptions = async () => {
  const data = await httpClient.get("/api/member-packages")
  const list = extractList(data)
  return Array.isArray(list)
    ? list.map(mapMemberSubscription).filter(Boolean)
    : []
}

export const updateSubscriptionStatus = async (id, status) => {
  if (!isValidNumericId(id)) {
    throw new Error("ID đăng ký gói không hợp lệ.")
  }
  const response = await httpClient.patch(`/api/member-packages/${id}/status`, {
    status: String(status),
  })
  return mapMemberSubscription(response)
}

export const membershipApi = {
  getPackages,
  getPublicPackages,
  getPackageById,
  createPackage,
  updatePackage,
  updatePackageStatus,
  getMemberSubscriptions,
  subscribePackage,
  subscribeMe,
  getAllSubscriptions,
  updateSubscriptionStatus,
  executePaymentModalSubmit,
  executePaymentModalDiscard,
}

/**
 * Executes a PaymentModal submit transaction flow in API mode.
 * Encapsulates pre-checks, deduplication, subscription submission,
 * incomplete order reconciliation locking, and payment confirmation.
 */
export async function executePaymentModalSubmit({
  numericMemberId,
  numericPackageId,
  method = "cash",
  notes = "",
  amountOverride = "",
  currentActorId = "anonymous",
  sessionRef = null,
  createdSubscriptionId = null,
  createdInvoiceId = null,
  sessionNeedsReconciliation = false,
  preservedUnmatchedInvoice = null,
  memberSessions = [],
  apiEnabled = true,
  isMutationLocked = false,
  language = "vi",
  setters = {},
  apis = {},
  cache = inProgressTransactionCache,
  callbacks = {},
}) {
  const {
    setSessionRef = () => {},
    setCreatedSubscriptionId = () => {},
    setCreatedInvoiceId = () => {},
    setSessionNeedsReconciliation = () => {},
    setMemberSessions = () => {},
    setAmbiguousPendingSubInfo = () => {},
    setSubmitError = () => {},
  } = setters

  const membershipApiInstance = apis.membershipApi || membershipApi
  const invoiceApiInstance = apis.invoiceApi || invoiceApi

  if (isMutationLocked) {
    const lockMsg =
      language === "vi"
        ? "Hiện chưa thể ghi nhận giao dịch. Vui lòng thử lại sau."
        : "This transaction cannot be recorded right now. Please try again later."
    setSubmitError(lockMsg)
    const lockErr = new Error(lockMsg)
    lockErr.name = "MutationLockedError"
    throw lockErr
  }

  // Ensure a session reference exists for this transaction attempt
  const currentSessionRef =
    sessionRef ||
    `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
  if (!sessionRef) {
    setSessionRef(currentSessionRef)
  }

  // Guard: if current session requires reconciliation, block repeat POST until reconciled or discarded
  if (sessionNeedsReconciliation) {
    const reconMsg =
      language === "vi"
        ? 'Phiên giao dịch đang ở trạng thái cần đối soát do phản hồi tạo đơn trước đó chưa xác định rõ kết quả. Vui lòng kiểm tra đối soát trên máy chủ hoặc bấm "Hủy phiên & Bắt đầu lại", không tự gửi lại yêu cầu đăng ký.'
        : "This transaction session requires reconciliation because the previous registration response was incomplete. Please verify on server or discard session before proceeding."
    setSubmitError(reconMsg)
    const reconErr = new Error(reconMsg)
    reconErr.name = "ReconciliationRequiredError"
    reconErr.requiresReconciliation = true
    throw reconErr
  }

  let currentSubId = createdSubscriptionId
  let currentInvoiceId = createdInvoiceId

  // Step 1: Subscribe member to package on BE (with strict deduplication check)
  if (!currentSubId) {
    // Strict GET query - fail closed on error, never swallow error as empty list
    let existingSubs
    try {
      existingSubs =
        await membershipApiInstance.getMemberSubscriptions(numericMemberId)
    } catch (getErr) {
      const getErrMsg =
        language === "vi"
          ? `Không thể kiểm tra đăng ký hiện tại trên máy chủ (${getErr.message || "Lỗi kết nối"}). Giao dịch tạm dừng để tránh tạo trùng lặp.`
          : `Failed to verify existing subscriptions on server (${getErr.message || "Network error"}). Transaction halted to prevent duplicates.`
      setSubmitError(getErrMsg)
      throw new Error(getErrMsg)
    }

    const correlatedSub = Array.isArray(existingSubs)
      ? existingSubs.find(
          (s) =>
            String(s.packageId) === String(numericPackageId) &&
            (s.status === "pending_payment" || s.status === "pending") &&
            isValidPositiveInt(createdSubscriptionId) &&
            (s.subscriptionId === createdSubscriptionId ||
              s.id === createdSubscriptionId),
        )
      : null

    const ambiguousPendingSub = Array.isArray(existingSubs)
      ? existingSubs.find(
          (s) =>
            String(s.packageId) === String(numericPackageId) &&
            (s.status === "pending_payment" || s.status === "pending") &&
            !correlatedSub,
        )
      : null

    if (correlatedSub) {
      const subId = correlatedSub.subscriptionId ?? correlatedSub.id
      if (!isValidPositiveInt(subId)) {
        const invSubMsg =
          language === "vi"
            ? "Mã đăng ký gói liên kết không hợp lệ (yêu cầu số nguyên dương)."
            : "Correlated subscription ID is invalid (positive integer required)."
        setSubmitError(invSubMsg)
        throw new Error(invSubMsg)
      }
      currentSubId = subId
    } else if (ambiguousPendingSub) {
      const ambigId =
        ambiguousPendingSub.subscriptionId ?? ambiguousPendingSub.id
      const owningSession = (memberSessions || []).find(
        (s) => s.subscriptionId === ambigId,
      )
      setAmbiguousPendingSubInfo({
        subId: ambigId,
        packageId: numericPackageId,
        matchingSessionRef: owningSession?.sessionRef || null,
      })
      const ambigMsg =
        language === "vi"
          ? `Phát hiện đăng ký gói đang chờ (#${ambigId}) của hội viên này trên máy chủ. Do OpenAPI/mapper không trả sessionRef trong bản ghi đăng ký gói, phiên mới không thể tự động gán để tránh tạo trùng lặp. Vui lòng kiểm tra danh sách phiên bảo lưu bên dưới để tiếp tục phiên tương ứng hoặc đối soát trên hệ thống.`
          : `Ambiguous pending subscription (#${ambigId}) found on server without session correlation in OpenAPI mapper. Halting before mutation to prevent duplicate subscriptions. Please resume from preserved sessions or audit.`
      setSubmitError(ambigMsg)
      throw new Error(ambigMsg)
    } else {
      const subPayload = {
        packageId: numericPackageId,
        paymentMethod: method === "cash" ? "CASH" : "VNPAY",
        notes: notes.trim()
          ? `${notes.trim()} [SessionRef: ${currentSessionRef}]`
          : `[SessionRef: ${currentSessionRef}]`,
      }

      let sub
      try {
        sub = await membershipApiInstance.subscribePackage(
          numericMemberId,
          subPayload,
        )
      } catch (subErr) {
        if (subErr?.requiresReconciliation) {
          const partialSubId = subErr?.partialOrder?.subscriptionId
          const partialInvId = subErr?.partialOrder?.invoiceId
          const hasValidPartialSub = isValidPositiveInt(partialSubId)
          const hasValidPartialInv = isValidPositiveInt(partialInvId)

          if (hasValidPartialSub) {
            setCreatedSubscriptionId(partialSubId)
          }
          if (hasValidPartialInv) {
            setCreatedInvoiceId(partialInvId)
          }
          setSessionNeedsReconciliation(true)

          cache.set(
            String(numericMemberId),
            {
              subscriptionId: hasValidPartialSub ? partialSubId : null,
              invoiceId: hasValidPartialInv ? partialInvId : null,
              packageId: numericPackageId,
              method,
              sessionRef: currentSessionRef,
              preservedUnmatchedInvoice,
              needsReconciliation: true,
              reconciliationReason:
                subErr.message || "incomplete_order_response",
            },
            currentActorId,
            currentSessionRef,
          )
          setMemberSessions(
            cache.getAllSessionsForMember(numericMemberId, currentActorId),
          )
        }
        throw subErr
      }

      const subId = sub?.subscriptionId ?? sub?.id
      if (!isValidPositiveInt(subId)) {
        const invSubIdMsg =
          language === "vi"
            ? "Đăng ký gói đã gửi nhưng máy chủ không trả về mã đăng ký (ID) số nguyên dương hợp lệ. Giao dịch tạm dừng để bảo toàn dữ liệu."
            : "Subscription requested but server did not return a valid positive integer subscription ID."
        setSubmitError(invSubIdMsg)
        throw new Error(invSubIdMsg)
      }
      currentSubId = subId
      currentInvoiceId = sub?.invoiceId ?? null
      setCreatedInvoiceId(currentInvoiceId)
    }

    setCreatedSubscriptionId(currentSubId)
    cache.set(
      String(numericMemberId),
      {
        subscriptionId: currentSubId,
        invoiceId: currentInvoiceId,
        packageId: numericPackageId,
        method,
        sessionRef: currentSessionRef,
        preservedUnmatchedInvoice,
      },
      currentActorId,
      currentSessionRef,
    )
    setMemberSessions(
      cache.getAllSessionsForMember(numericMemberId, currentActorId),
    )
  }

  // Subscription creation also creates its invoice; use the returned ID.
  let invId = currentInvoiceId
  if (!isValidPositiveInt(invId)) {
    const noInvMsg =
      language === "vi"
        ? "Máy chủ không trả về mã hóa đơn cho đăng ký gói này."
        : "The server did not return an invoice ID for this subscription."
    setSubmitError(noInvMsg)
    throw new Error(noInvMsg)
  }

  // Step 2: Settle cash or start the online payment gateway.
  if (method === "cash") {
    if (!isValidPositiveInt(invId)) {
      const noValidInvMsg =
        language === "vi"
          ? "Thiếu mã hóa đơn hợp lệ (số nguyên dương) để thực hiện thu tiền mặt."
          : "Missing valid positive integer invoice ID to execute cash payment."
      setSubmitError(noValidInvMsg)
      throw new Error(noValidInvMsg)
    }
    await invoiceApiInstance.confirmCashPayment(invId)

    callbacks.showToast?.(
      language === "vi"
        ? "Đã đăng ký gói và thu tiền mặt thành công (Hóa đơn đã thanh toán)!"
        : "Package registered and cash payment completed successfully!",
      "success",
    )
  } else {
    if (method === "online") {
      const payment = await invoiceApiInstance.startOnlinePayment(invId)
      const paymentUrl = payment?.paymentUrl || payment?.url
      if (paymentUrl && typeof window !== "undefined")
        window.location.assign(paymentUrl)
    }
    callbacks.showToast?.(
      language === "vi"
        ? "Đã lập đăng ký gói và hóa đơn chờ thanh toán (Trạng thái: Chờ đối soát)."
        : "Subscription & pending invoice created (Status: Pending verification).",
      "info",
    )
  }

  // Complete transaction: clear in-progress cache for this specific session
  cache.delete(String(numericMemberId), currentActorId, currentSessionRef)
  setCreatedSubscriptionId(null)
  setCreatedInvoiceId(null)
  setSessionRef(null)
  setSessionNeedsReconciliation(false)

  callbacks.onSuccess?.()
  callbacks.onClose?.()
  return { success: true, subscriptionId: currentSubId, invoiceId: invId }
}

/**
 * Executes a PaymentModal discard/cancel transaction flow in API mode.
 * Encapsulates reconciliation locking rules: if session requires reconciliation,
 * it CANNOT be discarded solely due to missing identifiers without verified BE proof.
 */
export async function executePaymentModalDiscard({
  numericMemberId,
  currentActorId = "anonymous",
  sessionRef = null,
  createdSubscriptionId = null,
  createdInvoiceId = null,
  sessionNeedsReconciliation = false,
  verifiedReconciliationProof = null,
  apiEnabled = true,
  isMutationLocked = false,
  language = "vi",
  setters = {},
  apis = {},
  cache = inProgressTransactionCache,
  callbacks = {},
}) {
  const {
    setCreatedSubscriptionId = () => {},
    setCreatedInvoiceId = () => {},
    setSessionRef = () => {},
    setSessionNeedsReconciliation = () => {},
    setMemberSessions = () => {},
    setUnresolvedPendingInvoice = () => {},
    setPreservedUnmatchedInvoice = () => {},
    setAmbiguousPendingSubInfo = () => {},
    setSubmitError = () => {},
  } = setters

  const membershipApiInstance = apis.membershipApi || membershipApi
  const invoiceApiInstance = apis.invoiceApi || invoiceApi

  if (isMutationLocked) {
    const lockMsg =
      language === "vi"
        ? "Hiện chưa thể hủy phiên này. Vui lòng thử lại sau."
        : "This session cannot be cancelled right now. Please try again later."
    setSubmitError(lockMsg)
    callbacks.showToast?.(lockMsg, "warning")
    const err = new Error(lockMsg)
    err.name = "MutationLockedError"
    throw err
  }

  // CRITICAL RECONCILIATION GUARD:
  // When session requires reconciliation, discard button CANNOT delete cache or clear flag
  // solely due to missing identifiers (orders may exist on server).
  // Only release session if verified reconciliation proof exists from BE.
  if (sessionNeedsReconciliation && !verifiedReconciliationProof?.confirmed) {
    const unverifiedMsg =
      language === "vi"
        ? "Phiên giao dịch đang ở trạng thái cần đối soát và chưa có bằng chứng xác minh chắc chắn từ máy chủ. Không thể tự hủy phiên chỉ vì thiếu mã đăng ký hoặc mã hóa đơn. Vui lòng đối soát thủ công trên hệ thống máy chủ trước khi xử lý tiếp."
        : "This session requires reconciliation and lacks verified confirmation from the server. Cannot discard session solely due to missing identifiers. Please perform manual reconciliation on the server before proceeding."
    setSubmitError(unverifiedMsg)
    callbacks.showToast?.(unverifiedMsg, "warning")
    const err = new Error(unverifiedMsg)
    err.name = "ReconciliationRequiredError"
    err.requiresReconciliation = true
    throw err
  }

  const invIdToCancel = createdInvoiceId
  const subIdToCancel = createdSubscriptionId

  let invoiceCancelled = false
  let subscriptionCancelled = false
  const cancellationErrors = []

  if (apiEnabled) {
    if (isValidPositiveInt(invIdToCancel)) {
      try {
        await invoiceApiInstance.cancelInvoice(invIdToCancel)
        invoiceCancelled = true
      } catch (err) {
        cancellationErrors.push(
          `Hóa đơn #${invIdToCancel}: ${err.message || "Lỗi cập nhật"}`,
        )
      }
    } else {
      invoiceCancelled = true
    }

    if (isValidPositiveInt(subIdToCancel)) {
      try {
        await membershipApiInstance.updateSubscriptionStatus(
          subIdToCancel,
          "CANCELLED",
        )
        subscriptionCancelled = true
      } catch (err) {
        cancellationErrors.push(
          `Gói đăng ký #${subIdToCancel}: ${err.message || "Lỗi cập nhật"}`,
        )
      }
    } else {
      subscriptionCancelled = true
    }
  } else {
    invoiceCancelled = true
    subscriptionCancelled = true
  }

  if (cancellationErrors.length > 0) {
    const remainingSubId = subscriptionCancelled ? null : subIdToCancel
    const remainingInvId = invoiceCancelled ? null : invIdToCancel

    setCreatedSubscriptionId(remainingSubId)
    setCreatedInvoiceId(remainingInvId)

    if (numericMemberId) {
      cache.set(
        String(numericMemberId),
        {
          subscriptionId: remainingSubId,
          invoiceId: remainingInvId,
          sessionRef,
        },
        currentActorId,
        sessionRef,
      )
      setMemberSessions(
        cache.getAllSessionsForMember(numericMemberId, currentActorId),
      )
    }

    const errMsg =
      language === "vi"
        ? `Không thể hủy hoàn tất bản ghi trên máy chủ (${cancellationErrors.join("; ")}). Tiến trình dở dang vẫn được bảo lưu để tránh mất đồng bộ với máy chủ.`
        : `Failed to cancel records on server (${cancellationErrors.join("; ")}). In-progress state retained to prevent server desynchronization.`

    setSubmitError(errMsg)
    callbacks.showToast?.(errMsg, "error")
    const err = new Error(errMsg)
    err.name = "CancellationFailedError"
    throw err
  }

  // All verified/cancelled on server (or mock mode): safe to clear local state & cache for this session
  if (numericMemberId) {
    cache.delete(String(numericMemberId), currentActorId, sessionRef)
    setMemberSessions(
      cache.getAllSessionsForMember(numericMemberId, currentActorId),
    )
  }
  setCreatedSubscriptionId(null)
  setCreatedInvoiceId(null)
  setSessionRef(null)
  setSessionNeedsReconciliation(false)
  setUnresolvedPendingInvoice(null)
  setPreservedUnmatchedInvoice(null)
  setAmbiguousPendingSubInfo(null)
  setSubmitError(null)

  callbacks.showToast?.(
    language === "vi"
      ? "Đã hủy thành công các bản ghi dở dang trên máy chủ và giải phóng phiên làm việc."
      : "In-progress records successfully cancelled on server and transaction session cleared.",
    "info",
  )
  return { success: true }
}

export default membershipApi
