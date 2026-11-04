import { httpClient } from './httpClient.js';
import {
  mapInvoice,
  toInvoiceRequest,
  toInvoicePaymentRequest,
  toInvoiceStatusRequest,
} from './invoiceMappers.js';
import { extractList, isValidNumericId } from './schemaValidators.js';

export const getInvoices = async (filters = {}, options = {}) => {
  const query = new URLSearchParams();

  if (filters.memberId !== undefined && filters.memberId !== null && filters.memberId !== '') {
    query.set('memberId', filters.memberId);
  }
  if (filters.packageId !== undefined && filters.packageId !== null && filters.packageId !== '') {
    query.set('packageId', filters.packageId);
  }
  if (filters.receptionistId !== undefined && filters.receptionistId !== null && filters.receptionistId !== '') {
    query.set('receptionistId', filters.receptionistId);
  }
  if (filters.status && filters.status !== 'all') {
    query.set('status', filters.status);
  }
  if (filters.method && filters.method !== 'all') {
    query.set('method', filters.method);
  }
  if (filters.startDate) {
    query.set('startDate', filters.startDate);
  }
  if (filters.endDate) {
    query.set('endDate', filters.endDate);
  }
  if (filters.keyword && String(filters.keyword).trim()) {
    query.set('keyword', String(filters.keyword).trim());
  }

  const queryString = query.toString();
  const path = queryString ? `/api/invoices?${queryString}` : '/api/invoices';
  const data = await httpClient.get(path, options);
  const list = extractList(data);
  return Array.isArray(list) ? list.map(mapInvoice).filter(Boolean) : [];
};

// Member-only endpoint: the backend resolves ownership from the current session.
export const getMyInvoices = async () => {
  const data = await httpClient.get('/api/members/me/invoices');
  const list = extractList(data);
  return Array.isArray(list) ? list.map(mapInvoice).filter(Boolean) : [];
};

export const getInvoiceById = async (id, options = {}) => {
  if (!isValidNumericId(id)) {
    throw new Error('ID hóa đơn không hợp lệ.');
  }
  const data = await httpClient.get(`/api/invoices/${id}`, options);
  return mapInvoice(data);
};

export const getMyInvoiceById = async (id) => {
  if (!isValidNumericId(id)) {
    throw new Error('Invalid invoice ID.');
  }
  const data = await httpClient.get(`/api/members/me/invoices/${id}`);
  return mapInvoice(data);
};

export const confirmCashPayment = async (id, options = {}) => {
  if (!isValidNumericId(id)) {
    throw new Error('ID hóa đơn không hợp lệ.');
  }
  const hasNote = options && typeof options === 'object' && typeof options.note === 'string' && options.note.trim();
  const payload = hasNote ? { note: options.note.trim() } : undefined;
  const response = await httpClient.post(`/api/invoices/${id}/confirm-cash`, payload, options);
  return mapInvoice(response);
};

export const startOnlinePayment = async (id) => {
  if (!isValidNumericId(id)) {
    throw new Error('ID hóa đơn không hợp lệ.');
  }
  return httpClient.post(`/api/invoices/${id}/pay-online`);
};

export const cancelInvoice = async (id) => {
  if (!isValidNumericId(id)) {
    throw new Error('Invalid invoice ID.');
  }
  const response = await httpClient.post(`/api/invoices/${id}/cancel`);
  return mapInvoice(response);
};

export const createInvoice = async (data) => {
  const payload = toInvoiceRequest(data);
  const created = await httpClient.post('/api/invoices', payload);
  return mapInvoice(created);
};

export const payInvoice = async (id, paymentData) => {
  if (!isValidNumericId(id)) throw new Error('ID hóa đơn không hợp lệ.');
  const payload = toInvoicePaymentRequest(paymentData);
  const response = await httpClient.post(`/api/invoices/${id}/pay`, payload);
  return mapInvoice(response);
};

export const updateInvoiceStatus = async (id, status) => {
  if (!isValidNumericId(id)) throw new Error('ID hóa đơn không hợp lệ.');
  const payload = toInvoiceStatusRequest({ status });
  const response = await httpClient.patch(`/api/invoices/${id}/status`, payload);
  return mapInvoice(response);
};

export const getMemberOwnInvoices = async ({ strict = false } = {}) => {
  const data = await httpClient.get('/api/members/me/invoices');
  const list = extractList(data);
  if (strict && !Array.isArray(list)) throw new Error('Phản hồi danh sách hóa đơn không đúng định dạng.');
  return Array.isArray(list) ? list.map(mapInvoice).filter(Boolean) : [];
};

export const getMemberOwnInvoiceById = async (id) => {
  if (!isValidNumericId(id)) {
    throw new Error('ID hóa đơn không hợp lệ.');
  }
  const data = await httpClient.get(`/api/members/me/invoices/${id}`);
  return mapInvoice(data);
};

export const payInvoiceOnline = async (id) => {
  if (!isValidNumericId(id)) {
    throw new Error('ID hóa đơn không hợp lệ.');
  }
  const response = await httpClient.post(`/api/invoices/${id}/pay-online`);
  const paymentUrl =
    response?.paymentUrl ||
    response?.url ||
    response?.vnpayUrl ||
    (typeof response === 'string' ? response : null);
  return {
    paymentUrl: paymentUrl || null,
  };
};

export const getInvoiceReceipt = async (id, options = { notifyForbidden: false }) => {
  if (!isValidNumericId(id)) {
    throw new Error('ID hóa đơn không hợp lệ.');
  }
  const data = await httpClient.get(`/api/invoices/${id}/receipt`, options);
  return mapInvoice(data) || data;
};

export const getPaymentResolutions = async (options = { notifyForbidden: false }) => {
  const data = await httpClient.get('/api/payment-resolutions', options);
  const list = extractList(data);
  return Array.isArray(list) ? list : [];
};

export const openPaymentResolution = async ({ invoiceId, type = 'RECONCILIATION', reason = '' } = {}) => {
  if (!isValidNumericId(invoiceId)) {
    throw new Error('ID hóa đơn không hợp lệ.');
  }
  const trimmedReason = String(reason || '').trim();
  if (!trimmedReason) {
    throw new Error('Vui lòng nhập lý do cần đối soát hoặc xử lý thanh toán.');
  }
  return httpClient.post('/api/payment-resolutions', {
    invoiceId: Number(invoiceId),
    type: String(type || 'RECONCILIATION'),
    reason: trimmedReason,
  });
};

export const approvePaymentResolution = async (id) => {
  if (!isValidNumericId(id)) {
    throw new Error('ID yêu cầu xử lý thanh toán không hợp lệ.');
  }
  return httpClient.post(`/api/payment-resolutions/${id}/approve`);
};

export const completePaymentResolution = async (id, { evidence, performedAt, moneyNotReceived } = {}) => {
  if (!isValidNumericId(id)) {
    throw new Error('ID yêu cầu xử lý thanh toán không hợp lệ.');
  }
  const payload = {
    evidence: String(evidence || '').trim(),
  };
  if (performedAt) payload.performedAt = performedAt;
  if (moneyNotReceived !== undefined) payload.moneyNotReceived = Boolean(moneyNotReceived);
  return httpClient.post(`/api/payment-resolutions/${id}/complete`, payload);
};

export const invoiceApi = {
  getInvoices,
  getMyInvoices,
  getInvoiceById,
  getMyInvoiceById,
  getMemberOwnInvoices,
  getMemberOwnInvoiceById,
  getInvoiceReceipt,
  createInvoice,
  payInvoice,
  updateInvoiceStatus,
  confirmCashPayment,
  startOnlinePayment,
  cancelInvoice,
  payInvoiceOnline,
  getPaymentResolutions,
  openPaymentResolution,
  approvePaymentResolution,
  completePaymentResolution,
};

export default invoiceApi;
