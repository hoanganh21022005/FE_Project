import { httpClient } from './httpClient.js';
import {
  mapAuditLog,
  mapClass,
  mapDashboard,
  mapPackage,
  mapRoom,
  mapSubject,
  toClassRequest,
  toPackageRequest,
} from './mappers.js';
import { extractList } from './schemaValidators.js';
import { buildRoomRequest, buildSubjectRequest, roomStatusForApi } from './resourceRequests.js';

const mapListResponse = (data, mapper) => {
  const list = extractList(data);
  return Array.isArray(list)
    ? list.filter((item) => item && typeof item === 'object').map(mapper)
    : [];
};

const mapApiClass = (item, lookups) => mapClass(item, { ...lookups, apiMode: true });

export const getSubjects = async (options) => {
  const data = await httpClient.get('/api/subjects', options);
  return mapListResponse(data, mapSubject);
};
export const createSubject = async (data, options) => mapSubject(await httpClient.post('/api/subjects', buildSubjectRequest(data), options));
export const updateSubject = async (id, data, options) => mapSubject(await httpClient.put(`/api/subjects/${id}`, buildSubjectRequest(data), options));
export const deleteSubject = (id, options) => httpClient.delete(`/api/subjects/${id}`, options);

export const getRooms = async (options) => mapListResponse(await httpClient.get('/api/rooms', options), mapRoom);
export const createRoom = async (data, options) => mapRoom(await httpClient.post('/api/rooms', buildRoomRequest(data), options));
export const updateRoom = async (id, data, options) => mapRoom(await httpClient.put(`/api/rooms/${id}`, buildRoomRequest(data), options));
export const updateRoomStatus = async (id, status, options) => {
  const apiStatus = roomStatusForApi(status);
  if (!apiStatus) throw new Error('Room status must be Available, Maintenance, or Closed.');
  return mapRoom(await httpClient.patch(`/api/rooms/${id}/status`, { status: apiStatus }, options));
};

export const getClasses = async (lookups, options) => {
  const data = await httpClient.get('/api/classes', options);
  return mapListResponse(data, (item) => mapApiClass(item, lookups));
};
export const createClass = async (data, lookups, options) => mapClass(
  await httpClient.post('/api/classes', toClassRequest(data), options),
  { ...lookups, apiMode: true },
);
export const previewRecurringSessions = (data) =>
  httpClient.post('/api/sessions/preview-recurring', data);
export const generateRecurringSessions = (data) =>
  httpClient.post('/api/sessions/generate', data);
export const updateClass = async (id, data, lookups, options) => mapClass(
  await httpClient.put(`/api/classes/${id}`, toClassRequest(data), options),
  { ...lookups, apiMode: true },
);
export const assignCoach = async (id, coachId, lookups, options) => mapClass(
  await httpClient.patch(`/api/classes/${id}/coach`, { coachId: Number(String(coachId).replace(/\D/g, '')) }, options),
  { ...lookups, apiMode: true },
);

export const getPackages = async (options) => mapListResponse(await httpClient.get('/api/packages', options), mapPackage);
export const createPackage = async (data, options) => mapPackage(await httpClient.post('/api/packages', toPackageRequest(data), options));
export const updatePackage = async (id, data, options) => mapPackage(await httpClient.put(`/api/packages/${id}`, toPackageRequest(data), options));
export const updatePackageStatus = async (id, status, options) => mapPackage(await httpClient.patch(`/api/packages/${id}/status`, { status }, options));

export const getDashboard = async (options) => mapDashboard((await httpClient.get('/api/reports/dashboard', options)) || {});
export const getAuditLogs = async (options = {}) => mapListResponse(
  await httpClient.get('/api/audit-logs', options),
  mapAuditLog,
);
