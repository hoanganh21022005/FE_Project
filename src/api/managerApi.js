import { httpClient } from './httpClient.js';
import {
  mapAuditLog,
  mapClass,
  mapDashboard,
  mapPackage,
  mapRevenueReport,
  mapMemberReport,
  mapRoom,
  mapSession,
  mapSubject,
  toClassRequest,
  toPackageRequest,
} from './mappers.js';
import { extractList } from './schemaValidators.js';
import { buildRoomRequest, buildSubjectRequest, roomStatusForApi } from './resourceRequests.js';
import { validNormalClassOpeningRequest } from './normalClassOpening.js';
import {
  buildNormalClassWithSessionsRequest,
  computeNormalClassFingerprint,
  toBackendDaysOfWeek,
  verifyNormalClassSessions,
} from './normalClassCreation.js';

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
export const getClassById = async (id, lookups = {}, options) => {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error('Class ID must be a positive integer.');
  }
  return mapApiClass(
    await httpClient.get(`/api/classes/${numericId}`, options),
    lookups,
  );
};
const openingRequestsInFlight = new Map();
export const confirmNormalClassOpening = async (classId, payload = {}, options) => {
  const numericId = Number(classId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error('Class ID must be a positive integer.');
  }
  const requestPayload = validNormalClassOpeningRequest(payload);
  const inFlight = openingRequestsInFlight.get(numericId);
  if (inFlight) return inFlight;

  const request = httpClient
    .post(`/api/classes/${numericId}/confirm-opening`, requestPayload, options)
    .finally(() => openingRequestsInFlight.delete(numericId));
  openingRequestsInFlight.set(numericId, request);
  return request;
};
export const getHolidays = async (options) => mapListResponse(
  await httpClient.get('/api/holidays', options),
  (item) => ({
    id: item.id,
    holidayDate: item.holidayDate ?? null,
    holidayName: item.holidayName ?? null,
    tag: item.tag ?? null,
    active: item.active === true,
  }),
);
export const createHoliday = async (data, options) => httpClient.post('/api/holidays', {
  holidayDate: data.holidayDate,
  holidayName: data.holidayName,
  ...(data.tag ? { tag: data.tag } : {}),
  active: data.active,
}, options);
export const toggleHoliday = async (id, active, options) => httpClient.patch(
  `/api/holidays/${id}/toggle`,
  { active },
  options,
);
export const getSessions = async (filters = {}, options) => {
  const query = new URLSearchParams();
  for (const key of ['classId', 'coachId', 'roomId', 'startDate', 'endDate', 'status']) {
    const value = filters[key];
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  const suffix = query.size ? `?${query.toString()}` : '';
  return mapListResponse(await httpClient.get(`/api/sessions${suffix}`, options), mapSession);
};
export const getCatalogClassSessions = async (classId, options) => mapListResponse(
  await httpClient.get(`/api/sessions/catalog/${classId}`, options),
  mapSession,
);
export const getSessionTimeSlots = async (isOutdoor = false, options) => mapListResponse(
  await httpClient.get(`/api/sessions/time-slots?isOutdoor=${Boolean(isOutdoor)}`, options),
  (item) => ({
    slotNumber: item.slotNumber,
    name: item.name ?? null,
    startTime: item.startTime ?? null,
    endTime: item.endTime ?? null,
    outdoorAllowed: item.outdoorAllowed === true,
    displayName: item.displayName ?? null,
  }),
);
export const rescheduleSession = async (sessionId, request, options) => mapSession(
  await httpClient.post(`/api/sessions/${sessionId}/reschedule`, {
    newDate: request.newDate,
    newStartTime: request.newStartTime,
    newEndTime: request.newEndTime,
    newRoomId: request.newRoomId ?? null,
    reason: request.reason?.trim() || null,
  }, options),
);
export const substituteSessionCoach = async (sessionId, request, options) => mapSession(
  await httpClient.post(`/api/sessions/${sessionId}/substitute-coach`, {
    newCoachId: Number(request.newCoachId),
    reason: request.reason?.trim() || null,
  }, options),
);
export const getCoaches = async (options) => mapListResponse(
  await httpClient.get('/api/coaches', options),
  (item) => ({
    id: Number(item.id),
    name: item.name ?? null,
    specializations: Array.isArray(item.specializations) ? item.specializations.filter((value) => typeof value === 'string') : [],
  }),
).filter((coach) => Number.isInteger(coach.id) && coach.id > 0);
export const createClass = async (data, lookups, options) => mapClass(
  await httpClient.post('/api/classes', toClassRequest(data), options),
  { ...lookups, apiMode: true },
);
export const createNormalClassWithSessions = async (data, lookups = {}, options = {}) => {
  const {
    idempotencyStateRef = null,
    requestId = null,
    verifySessions = true,
    expectedSessionCount = 12,
    ...httpOptions
  } = options || {};

  const previousState =
    idempotencyStateRef && typeof idempotencyStateRef === 'object'
      ? idempotencyStateRef.current
      : null;

  const requestBody =
    data?.sportsClass && typeof data?.requestId === 'string' && data.requestId.trim()
      ? {
          requestId: data.requestId.trim(),
          sportsClass: data.sportsClass,
          roomId: Number(data.roomId),
          daysOfWeek: toBackendDaysOfWeek(data.daysOfWeek),
          startTime: data.startTime,
          endTime: data.endTime,
        }
      : buildNormalClassWithSessionsRequest(data, {
          stateRef: idempotencyStateRef,
          requestId,
        });

  const currentFingerprint = computeNormalClassFingerprint(requestBody);
  const authoritativeFingerprint =
    previousState &&
    previousState.requestId === requestBody.requestId &&
    typeof previousState.fingerprint === 'string'
      ? previousState.fingerprint
      : currentFingerprint;

  if (idempotencyStateRef && typeof idempotencyStateRef === 'object') {
    idempotencyStateRef.current = {
      fingerprint: authoritativeFingerprint,
      requestId: requestBody.requestId,
      idempotencyConflict: Boolean(
        previousState?.requestId === requestBody.requestId && previousState?.idempotencyConflict,
      ),
      attemptLocked: true,
    };
  }

  let rawCreated;
  try {
    rawCreated = await httpClient.post('/api/classes/normal-with-sessions', requestBody, httpOptions);
  } catch (err) {
    const isIdempotencyConflict =
      err?.code === 'IDEMPOTENCY_CONFLICT' || err?.details?.code === 'IDEMPOTENCY_CONFLICT';

    if (isIdempotencyConflict) {
      if (idempotencyStateRef && typeof idempotencyStateRef === 'object') {
        const hasPayloadChanged = authoritativeFingerprint !== currentFingerprint;
        if (hasPayloadChanged) {
          idempotencyStateRef.current = null;
        } else {
          idempotencyStateRef.current = {
            fingerprint: authoritativeFingerprint,
            requestId: requestBody.requestId,
            idempotencyConflict: true,
            attemptLocked: true,
          };
        }
      }
      const conflictErr = new Error(
        err.message ||
          'Xung đột mã yêu cầu tạo lớp (IDEMPOTENCY_CONFLICT): Mã requestId này đã được gửi trước đó với thông tin lớp học khác. Vui lòng kiểm tra lại danh sách lớp học trước khi gửi lại.',
      );
      conflictErr.code = 'IDEMPOTENCY_CONFLICT';
      conflictErr.status = err.status ?? 409;
      conflictErr.cause = err;
      throw conflictErr;
    }

    throw err;
  }

  const created = mapClass(rawCreated, { ...lookups, apiMode: true });
  created.requestId = requestBody.requestId;

  if (verifySessions) {
    const verification = await verifyNormalClassSessions(created.id, {
      getSessionsFn: (filters) => getSessions(filters, httpOptions),
      getCatalogSessionsFn: (cId) => getCatalogClassSessions(cId, httpOptions),
      expectedCount: expectedSessionCount,
    });
    created.verifiedSessionCount = verification.count;
    if (!created.endDate && verification.endDate) {
      created.endDate = verification.endDate;
    }
  }

  if (idempotencyStateRef && typeof idempotencyStateRef === 'object') {
    idempotencyStateRef.current = null;
  }

  return created;
};
export const previewRecurringSessions = (data) =>
  httpClient.post('/api/sessions/preview-recurring', {
    ...data,
    daysOfWeek: toBackendDaysOfWeek(data?.daysOfWeek),
  });
export const generateRecurringSessions = (data) =>
  httpClient.post('/api/sessions/generate', {
    ...data,
    daysOfWeek: toBackendDaysOfWeek(data?.daysOfWeek),
  });
export const updateClass = async (id, data, lookups, options) => mapClass(
  await httpClient.put(`/api/classes/${id}`, toClassRequest(data), options),
  { ...lookups, apiMode: true },
);
export const assignCoach = async (id, coachId, lookups, options) => mapClass(
  await httpClient.patch(`/api/classes/${id}/coach`, { coachId: Number(String(coachId).replace(/\D/g, '')) }, options),
  { ...lookups, apiMode: true },
);

export const getPackages = async (options) => {
  const data = await httpClient.get('/api/packages', options);
  const list = extractList(data);
  if (!Array.isArray(list)) throw new Error('Phản hồi danh sách gói không đúng định dạng.');
  return list.filter((item) => item && typeof item === 'object').map(mapPackage);
};
export const createPackage = async (data, options) => mapPackage(await httpClient.post('/api/packages', toPackageRequest(data), options));
export const updatePackage = async (id, data, options) => mapPackage(await httpClient.put(`/api/packages/${id}`, toPackageRequest(data), options));
export const updatePackageStatus = async (id, status, options) => mapPackage(await httpClient.patch(`/api/packages/${id}/status`, { status }, options));

export const getDashboard = async (options) => mapDashboard((await httpClient.get('/api/reports/dashboard', options)) || {});
export const getRevenueReport = async ({ startDate, endDate, groupBy = 'month' } = {}, options) => {
  const query = new URLSearchParams();
  if (startDate) query.set('startDate', startDate);
  if (endDate) query.set('endDate', endDate);
  if (groupBy) query.set('groupBy', groupBy);
  const suffix = query.size ? `?${query.toString()}` : '';
  return mapRevenueReport(await httpClient.get(`/api/reports/revenue${suffix}`, options) || {});
};
export const getMemberReport = async (options) =>
  mapMemberReport(await httpClient.get('/api/reports/members', options) || {});
export const getAuditLogs = async (options = {}) => {
  const data = await httpClient.get('/api/audit-logs', options);
  if (!Array.isArray(data) || data.some((item) => !item || typeof item !== 'object' || Array.isArray(item) || !Number.isInteger(item.id) || item.id <= 0)) {
    throw new Error('Phản hồi nhật ký hệ thống không đúng định dạng.');
  }
  return data.map(mapAuditLog);
};
