import { httpClient } from './httpClient.js';
import {
  mapMembershipPackage,
  toMembershipPackageRequest,
  mapMemberSubscription,
  toMemberPackageRequest,
} from './membershipMappers.js';
import { extractList, isValidNumericId } from './schemaValidators.js';

export const getPackages = async () => {
  const data = await httpClient.get('/api/packages');
  const list = extractList(data);
  return Array.isArray(list) ? list.map(mapMembershipPackage).filter(Boolean) : [];
};

export const getPackageById = async (id) => {
  if (!isValidNumericId(id)) {
    throw new Error('ID gói thành viên không hợp lệ.');
  }
  const data = await httpClient.get(`/api/packages/${id}`);
  return mapMembershipPackage(data);
};

export const createPackage = async (data) => {
  const payload = toMembershipPackageRequest(data);
  const created = await httpClient.post('/api/packages', payload);
  return mapMembershipPackage(created);
};

export const updatePackage = async (id, data) => {
  if (!isValidNumericId(id)) {
    throw new Error('ID gói thành viên không hợp lệ.');
  }
  const payload = toMembershipPackageRequest(data);
  const updated = await httpClient.put(`/api/packages/${id}`, payload);
  return mapMembershipPackage(updated);
};

export const updatePackageStatus = async (id, status) => {
  if (!isValidNumericId(id)) {
    throw new Error('ID gói thành viên không hợp lệ.');
  }
  const updated = await httpClient.patch(`/api/packages/${id}/status`, { status: String(status) });
  return mapMembershipPackage(updated);
};

export const getMemberSubscriptions = async (memberId) => {
  if (!isValidNumericId(memberId)) {
    throw new Error('ID hội viên không hợp lệ.');
  }
  const data = await httpClient.get(`/api/members/${memberId}/packages`);
  const list = extractList(data);
  return Array.isArray(list) ? list.map(mapMemberSubscription).filter(Boolean) : [];
};

export const subscribePackage = async (memberId, data) => {
  if (!isValidNumericId(memberId)) {
    throw new Error('ID hội viên không hợp lệ.');
  }
  const payload = toMemberPackageRequest(data);
  const response = await httpClient.post(`/api/members/${memberId}/packages`, payload);
  return mapMemberSubscription(response);
};

export const getAllSubscriptions = async () => {
  const data = await httpClient.get('/api/member-packages');
  const list = extractList(data);
  return Array.isArray(list) ? list.map(mapMemberSubscription).filter(Boolean) : [];
};

export const updateSubscriptionStatus = async (id, status) => {
  if (!isValidNumericId(id)) {
    throw new Error('ID đăng ký gói không hợp lệ.');
  }
  const response = await httpClient.patch(`/api/member-packages/${id}/status`, { status: String(status) });
  return mapMemberSubscription(response);
};

export const membershipApi = {
  getPackages,
  getPackageById,
  createPackage,
  updatePackage,
  updatePackageStatus,
  getMemberSubscriptions,
  subscribePackage,
  getAllSubscriptions,
  updateSubscriptionStatus,
};

export default membershipApi;
