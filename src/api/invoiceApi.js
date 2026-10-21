import { httpClient } from './httpClient.js';
import {
  mapInvoice,
} from './invoiceMappers.js';
import { extractList, isValidNumericId } from './schemaValidators.js';

export const getInvoices = async (filters = {}) => {
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

  const queryString = query.toString();
  const path = queryString ? `/api/invoices?${queryString}` : '/api/invoices';
  const data = await httpClient.get(path);
  const list = extractList(data);
  return Array.isArray(list) ? list.map(mapInvoice).filter(Boolean) : [];
};

// Member-only endpoint: the backend resolves ownership from the current session.
export const getMyInvoices = async () => {
  const data = await httpClient.get('/api/members/me/invoices');
  const list = extractList(data);
  return Array.isArray(list) ? list.map(mapInvoice).filter(Boolean) : [];
};

export const getInvoiceById = async (id) => {
  if (!isValidNumericId(id)) {
    throw new Error('ID hóa đơn không hợp lệ.');
  }
  const data = await httpClient.get(`/api/invoices/${id}`);
  return mapInvoice(data);
};

export const getMyInvoiceById = async (id) => {
  if (!isValidNumericId(id)) {
    throw new Error('Invalid invoice ID.');
  }
  const data = await httpClient.get(`/api/members/me/invoices/${id}`);
  return mapInvoice(data);
};

export const confirmCashPayment = async (id) => {
  if (!isValidNumericId(id)) {
    throw new Error('ID hóa đơn không hợp lệ.');
  }
  const response = await httpClient.post(`/api/invoices/${id}/confirm-cash`);
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

export const invoiceApi = {
  getInvoices,
  getMyInvoices,
  getInvoiceById,
  getMyInvoiceById,
  confirmCashPayment,
  startOnlinePayment,
  cancelInvoice,
};

export default invoiceApi;
