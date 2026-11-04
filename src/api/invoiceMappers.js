import { asNumber } from "./mappers.js"
import { isValidNumericId } from "./schemaValidators.js"

export function normalizePaymentMethod(method) {
  if (!method) return null
  const m = String(method).trim().toUpperCase()
  if (["CASH", "TIỀN MẶT", "TIEN_MAT"].includes(m)) return "cash"
  if (
    [
      "BANK_TRANSFER",
      "CHUYỂN KHOẢN",
      "CHUYEN_KHOAN",
      "VIETQR",
      "TRANSFER",
    ].includes(m)
  )
    return "bank_transfer"
  if (
    ["CARD_POS", "POS", "CARD", "THẺ", "CREDITCARD", "CREDIT_CARD"].includes(m)
  )
    return "card_pos"
  if (["ONLINE", "GATEWAY", "VNPAY", "PAYOS", "MOMO"].includes(m))
    return "online"
  return String(method).toLowerCase()
}

export function normalizePaymentStatus(status) {
  if (!status) return null
  const s = String(status).trim().toUpperCase()
  if (
    ["PAID", "SUCCESSFUL", "SUCCESS", "COMPLETED", "ĐÃ THANH TOÁN"].includes(s)
  )
    return "successful"
  if (["PENDING", "CHỜ THANH TOÁN", "UNPAID", "AWAITING_PAYMENT"].includes(s))
    return "pending"
  if (["FAILED", "THẤT BÀI", "ERROR"].includes(s)) return "failed"
  if (["CANCELLED", "CANCELED", "ĐÃ HỦY", "REVOKED"].includes(s))
    return "cancelled"
  if (["REVERSED", "HOÀN TIỀN", "REFUNDED"].includes(s)) return "reversed"
  if (["EXPIRED", "HẾT HẠN", "HET_HAN"].includes(s)) return "expired"
  return String(status).toLowerCase()
}

export function formatInvoiceCode(id) {
  const n = asNumber(id)
  return n !== null ? `INV-${String(n).padStart(5, "0")}` : "INV-00000"
}

export function mapInvoice(item) {
  if (!item || typeof item !== "object") {
    return null
  }

  const invoiceId = asNumber(item.invoiceId ?? item.id)
  if (!isValidNumericId(invoiceId)) return null
  const memberId = asNumber(item.memberId)
  const packageId = asNumber(item.packageId)
  const receptionistId = asNumber(item.receptionistId)
  const durationDays = asNumber(item.durationDays)
  const amount = asNumber(item.amount)
  const invoiceCode = item.invoiceCode || null

  return {
    id: invoiceId,
    invoiceId,
    code: invoiceCode,
    invoiceCode,
    memberId,
    memberName: item.memberName || "",
    memberEmail: item.memberEmail || "",
    memberPhone: item.memberPhone || "",
    packageId,
    packageName: item.packageName || "",
    durationDays,
    receptionistId,
    receptionistName: item.receptionistName || "",
    amount,
    paymentMethod: normalizePaymentMethod(item.paymentMethod),
    rawPaymentMethod: item.paymentMethod ?? null,
    paymentStatus: normalizePaymentStatus(item.paymentStatus),
    rawPaymentStatus: item.paymentStatus ?? null,
    paymentDate: item.paymentDate || null,
    gatewayTransactionRef: item.gatewayTransactionRef || null,
    createdAt: item.createdAt || null,
    expiresAt: item.expiresAt || null,
    serverTime: item.serverTime || null,
    reconciliationRequired: item.reconciliationRequired === true,
    cashNote: item.cashNote || null,
    resolutionStatus: item.resolutionStatus || null,
    cashConfirmationReversed: item.cashConfirmationReversed === true,
    classId: asNumber(item.classId),
    className: item.className || null,
  }
}

export function toInvoiceRequest(data = {}) {
  const memberId = asNumber(data.memberId)
  if (!isValidNumericId(memberId)) {
    throw new Error("ID hội viên (memberId) không hợp lệ hoặc thiếu.")
  }

  const amount = asNumber(data.amount)
  if (amount === null || amount < 0) {
    throw new Error("Số tiền thanh toán (amount) phải lớn hơn hoặc bằng 0.")
  }

  const payload = {
    memberId,
    amount,
  }

  if (
    data.packageId !== undefined &&
    data.packageId !== null &&
    data.packageId !== ""
  ) {
    const pkgId = asNumber(data.packageId)
    if (isValidNumericId(pkgId)) {
      payload.packageId = pkgId
    }
  }

  if (
    data.receptionistId !== undefined &&
    data.receptionistId !== null &&
    data.receptionistId !== ""
  ) {
    const recId = asNumber(data.receptionistId)
    if (isValidNumericId(recId)) {
      payload.receptionistId = recId
    }
  }

  if (data.paymentMethod && typeof data.paymentMethod === "string") {
    payload.paymentMethod = data.paymentMethod.trim().toUpperCase()
  }

  if (data.paymentStatus && typeof data.paymentStatus === "string") {
    payload.paymentStatus = data.paymentStatus.trim().toUpperCase()
  }

  if (
    data.gatewayTransactionRef &&
    typeof data.gatewayTransactionRef === "string"
  ) {
    payload.gatewayTransactionRef = data.gatewayTransactionRef.trim()
  }

  if (data.notes && typeof data.notes === "string") {
    payload.notes = data.notes.trim()
  }

  return payload
}

export function toInvoicePaymentRequest(data = {}) {
  if (
    !data.paymentMethod ||
    typeof data.paymentMethod !== "string" ||
    !data.paymentMethod.trim()
  ) {
    throw new Error("Phương thức thanh toán (paymentMethod) là bắt buộc.")
  }

  const payload = {
    paymentMethod: data.paymentMethod.trim().toUpperCase(),
  }

  if (
    data.gatewayTransactionRef &&
    typeof data.gatewayTransactionRef === "string"
  ) {
    payload.gatewayTransactionRef = data.gatewayTransactionRef.trim()
  }

  if (
    data.receptionistId !== undefined &&
    data.receptionistId !== null &&
    data.receptionistId !== ""
  ) {
    const recId = asNumber(data.receptionistId)
    if (isValidNumericId(recId)) {
      payload.receptionistId = recId
    }
  }

  if (data.notes && typeof data.notes === "string") {
    payload.notes = data.notes.trim()
  }

  return payload
}

export function toInvoiceStatusRequest(data = {}) {
  if (!data.status || typeof data.status !== "string" || !data.status.trim()) {
    throw new Error("Trạng thái hóa đơn (status) là bắt buộc.")
  }

  return {
    status: data.status.trim().toUpperCase(),
  }
}
