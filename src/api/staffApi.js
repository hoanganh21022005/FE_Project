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

export const updateStaffStatus = async (id, status) => {
  if (id === null || id === undefined || id === '') throw new Error('Staff ID is required.');
  const updated = await httpClient.patch(`/api/staff/${id}/status`, { status: String(status).toUpperCase() });
  return mapStaff(updated);
};

export const staffApi = {
  getStaff,
  createStaff,
  updateStaff,
  updateStaffStatus,
};

export default staffApi;
