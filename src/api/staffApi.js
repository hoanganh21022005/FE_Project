import { httpClient } from './httpClient.js';
import { mapStaff, toStaffRequest, toStaffUpdateRequest } from './staffMappers.js';
import { extractList, isValidNumericId } from './schemaValidators.js';

export const getStaff = async ({ strict = false, ...options } = {}) => {
  const data = await httpClient.get('/api/staff', options);
  const list = extractList(data);
  if (strict && (!Array.isArray(list) || list.some((item) => !item || !isValidNumericId(item.id)))) {
    throw new Error('Phản hồi danh sách nhân viên không đúng định dạng.');
  }
  return Array.isArray(list) ? list.map(mapStaff).filter(Boolean) : [];
};

export const createStaff = async (data, options) => {
  const payload = toStaffRequest(data);
  const created = await httpClient.post('/api/staff', payload, options);
  return mapStaff(created);
};

export const updateStaff = async (id, data, options) => {
  if (id === null || id === undefined || id === '') {
    throw new Error('ID nhân viên không hợp lệ.');
  }
  const payload = toStaffUpdateRequest(data);
  const updated = await httpClient.put(`/api/staff/${id}`, payload, options);
  return mapStaff(updated);
};

export const getAssignableStaffRoles = async (options) => {
  const data = await httpClient.get('/api/roles', options);
  if (!Array.isArray(data)) throw new Error('Phản hồi danh sách vai trò không đúng định dạng.');
  const allowed = { coach: 'coach', receptionist: 'receptionist', centermanager: 'manager' };
  return data.filter((item) => item && isValidNumericId(item.id) &&
    Object.hasOwn(allowed, String(item.name ?? '').trim().toLowerCase()))
    .map((item) => ({ id: Number(item.id), name: item.name, role: allowed[String(item.name).trim().toLowerCase()] }));
};

export const updateStaffStatus = async (id, status, options) => {
  if (id === null || id === undefined || id === '') throw new Error('Staff ID is required.');
  const updated = await httpClient.patch(`/api/staff/${id}/status`, { status: String(status).toUpperCase() }, options);
  return mapStaff(updated);
};

export const staffApi = {
  getStaff,
  createStaff,
  updateStaff,
  updateStaffStatus,
};

export default staffApi;
