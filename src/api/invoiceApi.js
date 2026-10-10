import { httpClient } from './httpClient.js';
import {
  mapInvoice,
  toInvoiceRequest,
  toInvoicePaymentRequest,
  toInvoiceStatusRequest,
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

export const getInvoiceById = async (id) => {
  if (!isValidNumericId(id)) {
    throw new Error('ID hóa đơn không hợp lệ.');
  }
  const data = await httpClient.get(`/api/invoices/${id}`);
  return mapInvoice(data);
};

export const createInvoice = async (data) => {
  const payload = toInvoiceRequest(data);
  const created = await httpClient.post('/api/invoices', payload);
  return mapInvoice(created);
};

export const payInvoice = async (id, paymentData) => {
  if (!isValidNumericId(id)) {
    throw new Error('ID hóa đơn không hợp lệ.');
  }
  const payload = toInvoicePaymentRequest(paymentData);
  const response = await httpClient.post(`/api/invoices/${id}/pay`, payload);
  return mapInvoice(response);
};

export const updateInvoiceStatus = async (id, status) => {
  if (!isValidNumericId(id)) {
    throw new Error('ID hóa đơn không hợp lệ.');
  }
  const payload = toInvoiceStatusRequest({ status });
  const response = await httpClient.patch(`/api/invoices/${id}/status`, payload);
  return mapInvoice(response);
};

export const invoiceApi = {
  getInvoices,
  getInvoiceById,
  createInvoice,
  payInvoice,
  updateInvoiceStatus,
};

export default invoiceApi;
