import { httpClient } from './httpClient.js';
import { mapMember, toMemberRequest } from './memberMappers.js';
import { extractList } from './schemaValidators.js';

export const getMembers = async () => {
  const data = await httpClient.get('/api/members');
  const list = extractList(data);
  return Array.isArray(list) ? list.map(mapMember).filter(Boolean) : [];
};

export const getMemberById = async (id) => {
  if (id === null || id === undefined || id === '') {
    throw new Error('ID hội viên không hợp lệ.');
  }
  const data = await httpClient.get(`/api/members/${id}`);
  return mapMember(data);
};

export const createMember = async (data) => {
  const payload = toMemberRequest(data);
  const created = await httpClient.post('/api/members', payload);
  return mapMember(created);
};

export const updateMember = async (id, data) => {
  if (id === null || id === undefined || id === '') {
    throw new Error('ID hội viên không hợp lệ.');
  }
  const payload = toMemberRequest(data);
  const updated = await httpClient.put(`/api/members/${id}`, payload);
  return mapMember(updated);
};

export const updateMemberStatus = async (id, status) => {
  if (id === null || id === undefined || id === '') throw new Error('Member ID is required.');
  const updated = await httpClient.patch(`/api/members/${id}/status`, { status: String(status).toUpperCase() });
  return mapMember(updated);
};

export const memberApi = {
  getMembers,
  getMemberById,
  createMember,
  updateMember,
  updateMemberStatus,
};

export default memberApi;
