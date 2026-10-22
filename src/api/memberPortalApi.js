import { httpClient } from './httpClient.js';
import { extractList } from './schemaValidators.js';
import { getMemberEnrollments } from './classEnrollmentApi.js';

const list = async (path) => {
  const data = await httpClient.get(path);
  return extractList(data) || [];
};

// The member enrollment history is the documented source for enrolled Normal classes.
// /api/sessions is a general schedule lookup and is not member-scoped by the API contract.
export const getMemberClasses = (memberId) => getMemberEnrollments(memberId);
export const getClassSessions = () => list('/api/sessions');
export const hasScheduledClassSession = (classId, sessions = []) => Array.isArray(sessions)
  && sessions.some((session) => String(session.classId) === String(classId)
    && String(session.status || '').toLowerCase() === 'scheduled'
    && session.isPrivate !== true);
export const getMemberAttendances = (memberId) => list(`/api/attendances?memberId=${encodeURIComponent(memberId)}`);
export const getMemberCheckinCode = () => httpClient.get('/api/members/me/checkin-code');
export const getMemberTrainingPlans = (memberId) => list(`/api/training-plans?memberId=${encodeURIComponent(memberId)}`);
export const getMemberTrainingResults = (memberId) => list(`/api/training-results?memberId=${encodeURIComponent(memberId)}`);

export const memberPortalApi = {
  getMemberClasses,
  getClassSessions,
  getMemberAttendances,
  getMemberCheckinCode,
  getMemberTrainingPlans,
  getMemberTrainingResults,
};

export default memberPortalApi;
