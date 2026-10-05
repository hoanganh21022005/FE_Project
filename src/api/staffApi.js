import { httpClient } from './httpClient.js';
import { mapStaff, toStaffRequest } from './staffMappers.js';
import { extractList } from './schemaValidators.js';

export const getStaff = async () => {
  const data = await httpClient.get('/api/staff');
  const list = extractList(data);
  return Array.isArray(list) ? list.map(mapStaff).filter(Boolean) : [];
};

export const createStaff = async (data) => {
  const payload = toStaffRequest(data);
  const created = await httpClient.post('/api/staff', payload);
  return mapStaff(created);
};

export const updateStaff = async (id, data) => {
  if (id === null || id === undefined || id === '') {
    throw new Error('ID nhân viên không hợp lệ.');
  }
  const payload = toStaffRequest(data);
  const updated = await httpClient.put(`/api/staff/${id}`, payload);
  return mapStaff(updated);
};

/**
 * G4.5 Blocked: PATCH /api/staff/{id}/status is blocked pending BE specification of body key and enum.
 */
export const updateStaffStatus = async (_id, _status) => {
  throw new Error('Thao tác cập nhật trạng thái nhân sự (G4.5) đang bị khóa do Backend chưa công bố cấu trúc body và enum.');
};

export const staffApi = {
  getStaff,
  createStaff,
  updateStaff,
  updateStaffStatus,
};

export default staffApi;
