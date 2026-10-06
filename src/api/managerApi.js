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

export const getSubjects = async () => (await httpClient.get('/api/subjects')).map(mapSubject);
export const createSubject = async (data) => mapSubject(await httpClient.post('/api/subjects', data));
export const updateSubject = async (id, data) => mapSubject(await httpClient.put(`/api/subjects/${id}`, data));
export const deleteSubject = (id) => httpClient.delete(`/api/subjects/${id}`);

export const getRooms = async () => (await httpClient.get('/api/rooms')).map(mapRoom);
export const createRoom = async (data) => mapRoom(await httpClient.post('/api/rooms', data));
export const updateRoom = async (id, data) => mapRoom(await httpClient.put(`/api/rooms/${id}`, data));
export const updateRoomStatus = async (id, status) => mapRoom(await httpClient.patch(`/api/rooms/${id}/status`, { status }));

export const getClasses = async (lookups) => (await httpClient.get('/api/classes')).map((item) => mapClass(item, lookups));
export const createClass = async (data, lookups) => mapClass(
  await httpClient.post('/api/classes', toClassRequest(data)),
  { ...lookups, fallback: data },
);
export const updateClass = async (id, data, lookups) => mapClass(
  await httpClient.put(`/api/classes/${id}`, toClassRequest(data)),
  { ...lookups, fallback: data },
);
export const assignCoach = async (id, coachId, lookups) => mapClass(
  await httpClient.patch(`/api/classes/${id}/coach`, { coachId: Number(String(coachId).replace(/\D/g, '')) }),
  lookups,
);

export const getPackages = async () => (await httpClient.get('/api/packages')).map(mapPackage);
export const createPackage = async (data) => mapPackage(await httpClient.post('/api/packages', toPackageRequest(data)));
export const updatePackage = async (id, data) => mapPackage(await httpClient.put(`/api/packages/${id}`, toPackageRequest(data)));
export const updatePackageStatus = async (id, status) => mapPackage(await httpClient.patch(`/api/packages/${id}/status`, { status }));

export const getDashboard = async () => mapDashboard(await httpClient.get('/api/reports/dashboard'));
export const getAuditLogs = async () => (await httpClient.get('/api/audit-logs')).map(mapAuditLog);
