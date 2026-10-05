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

/**
 * G4.5 Blocked: PATCH /api/members/{id}/status is blocked pending BE specification of body key and enum.
 */
export const updateMemberStatus = async (_id, _status) => {
  throw new Error('Thao tác cập nhật trạng thái hội viên (G4.5) đang bị khóa do Backend chưa công bố cấu trúc body và enum.');
};

export const memberApi = {
  getMembers,
  getMemberById,
  createMember,
  updateMember,
  updateMemberStatus,
};

export default memberApi;
