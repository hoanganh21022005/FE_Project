import { httpClient } from './httpClient.js'
import { getSessions } from './managerApi.js'
import { normalizeRole, ROLE_MANAGER } from '../utils/navigation.js'

const INT32_MAX = 2147483647
const positiveInt32 = (value) => Number.isInteger(value) && value > 0 && value <= INT32_MAX
const requestKeyPattern = /^[A-Za-z0-9_.:-]{1,80}$/
const knownIncidentStatuses = new Set(['WaitingForRecovery', 'Resolved'])

export class CenterIncidentValidationError extends Error {
  constructor(message, code = 'CENTER_INCIDENT_VALIDATION') {
    super(message)
    this.name = 'CenterIncidentValidationError'
    this.code = code
    this.status = 0
  }
}

const requireId = (value, label) => {
  const id = typeof value === 'number' ? value : Number(value)
  if (!positiveInt32(id)) throw new CenterIncidentValidationError(`${label} must be a positive int32.`, 'INVALID_ID')
  return id
}

const strictObject = (value, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CenterIncidentValidationError(`Backend returned an invalid ${label}.`, 'CENTER_INCIDENT_RESPONSE_INVALID')
  }
  return value
}

const requiredText = (value, field, maxLength = Infinity) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CenterIncidentValidationError(`${field} is required.`, `CENTER_INCIDENT_${field.toUpperCase()}_REQUIRED`)
  }
  const text = value.trim()
  if (text.length > maxLength) {
    throw new CenterIncidentValidationError(`${field} exceeds ${maxLength} characters.`, `CENTER_INCIDENT_${field.toUpperCase()}_TOO_LONG`)
  }
  return text
}

const assertOnlyKeys = (value, allowed) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CenterIncidentValidationError('Request input must be an object.')
  }
  const extra = Object.keys(value).find((key) => !allowed.includes(key))
  if (extra) throw new CenterIncidentValidationError(`Unsupported request field: ${extra}`, 'CENTER_INCIDENT_FIELD_UNSUPPORTED')
}

const pad2 = (value) => String(value).padStart(2, '0')
const validCalendarDate = (year, month, day) => {
  if (!Number.isInteger(year) || year < 1 || month < 1 || month > 12) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day >= 1 && day <= days[month - 1]
}

export const normalizeIncidentLocalDateTime = (value, field = 'date-time') => {
  if (typeof value !== 'string') throw new CenterIncidentValidationError(`${field} must be an Asia/Ho_Chi_Minh local date-time.`, 'INVALID_INCIDENT_TIME')
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim())
  if (!match) throw new CenterIncidentValidationError(`${field} must be a local date-time without a UTC offset.`, 'INVALID_INCIDENT_TIME')
  const [, y, mo, d, h, mi, s = '00'] = match
  const [year, month, day, hour, minute, second] = [y, mo, d, h, mi, s].map(Number)
  if (!validCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) {
    throw new CenterIncidentValidationError(`${field} is not a valid calendar date-time.`, 'INVALID_INCIDENT_TIME')
  }
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`
}

export const normalizeIncidentLocalDate = (value) => {
  if (typeof value !== 'string') throw new CenterIncidentValidationError('date must use YYYY-MM-DD.', 'MAKEUP_TIME_INVALID')
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match || !validCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))) {
    throw new CenterIncidentValidationError('date must be a valid YYYY-MM-DD date.', 'MAKEUP_TIME_INVALID')
  }
  return value.trim()
}

export const normalizeIncidentLocalTime = (value, field = 'time') => {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?$/.test(value.trim())) {
    throw new CenterIncidentValidationError(`${field} must be a valid Asia/Ho_Chi_Minh local time.`, 'MAKEUP_TIME_INVALID')
  }
  const time = value.trim()
  return time.length === 5 ? `${time}:00` : time
}

const vietnamLocalNow = (now = new Date()) => {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value
    return result
  }, {})
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`
}

export const createCenterIncidentRequestKey = () => {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (!uuid) throw new CenterIncidentValidationError('A cryptographically secure request key is unavailable.', 'REQUEST_KEY_UNAVAILABLE')
  return `ci:${uuid}`
}

export const buildOpenCenterIncidentRequest = (input, { now = new Date() } = {}) => {
  assertOnlyKeys(input, ['sessionId', 'startedAt', 'reason', 'evidence', 'requestKey'])
  const sessionId = requireId(input.sessionId, 'sessionId')
  const startedAt = normalizeIncidentLocalDateTime(input.startedAt, 'startedAt')
  const nowLocal = vietnamLocalNow(now)
  if (!nowLocal) throw new CenterIncidentValidationError('Current time is unavailable to validate startedAt.', 'INVALID_INCIDENT_TIME')
  if (startedAt > nowLocal) throw new CenterIncidentValidationError('startedAt cannot be in the future.', 'INVALID_INCIDENT_TIME')
  const reason = requiredText(input.reason, 'reason', 2000)
  const evidence = requiredText(input.evidence, 'evidence', 2000)
  if (typeof input.requestKey !== 'string' || !requestKeyPattern.test(input.requestKey)) {
    throw new CenterIncidentValidationError('requestKey must contain 1-80 letters, digits, underscore, dot, colon, or hyphen.', 'INVALID_REQUEST_KEY')
  }
  return { sessionId, startedAt, reason, evidence, requestKey: input.requestKey }
}

export const buildResolveCenterIncidentRequest = (incident, input, { now = new Date() } = {}) => {
  strictObject(incident, 'CenterIncidentResponse')
  assertOnlyKeys(input, ['endedAt'])
  if (!knownIncidentStatuses.has(incident.status)) throw new CenterIncidentValidationError('Incident status is not verified for resolution.', 'INCIDENT_STATE_UNVERIFIED')
  if (incident.status !== 'WaitingForRecovery') throw new CenterIncidentValidationError('Only a WaitingForRecovery incident can be resolved.', 'INCIDENT_NOT_RESOLVABLE')
  const startedAt = normalizeIncidentLocalDateTime(incident.startedAt, 'startedAt')
  const endedAt = normalizeIncidentLocalDateTime(input.endedAt, 'endedAt')
  const nowLocal = vietnamLocalNow(now)
  if (!nowLocal) throw new CenterIncidentValidationError('Current time is unavailable to validate endedAt.', 'INVALID_INCIDENT_TIME')
  if (endedAt < startedAt || endedAt > nowLocal) throw new CenterIncidentValidationError('endedAt must be between startedAt and the current Vietnam time.', 'INVALID_INCIDENT_TIME')
  return { endedAt }
}

export const buildCompensateCenterIncidentRequest = (incident, input) => {
  strictObject(incident, 'CenterIncidentResponse')
  assertOnlyKeys(input, ['reason', 'verifiedNotHeld'])
  if (!knownIncidentStatuses.has(incident.status)) throw new CenterIncidentValidationError('Incident status is not verified for compensation.', 'INCIDENT_STATE_UNVERIFIED')
  if (incident.status !== 'WaitingForRecovery') throw new CenterIncidentValidationError('Only a WaitingForRecovery incident can be compensated.', 'INCIDENT_NOT_COMPENSATABLE')
  if (incident.sessionCompensated !== false) throw new CenterIncidentValidationError('Backend has not confirmed that this incident is uncompensated.', 'INCIDENT_COMPENSATION_UNVERIFIED')
  if (input.verifiedNotHeld !== true) throw new CenterIncidentValidationError('Manager must explicitly confirm that the session was not held.', 'NOT_HELD_CONFIRMATION_REQUIRED')
  return { reason: requiredText(input.reason, 'reason'), verifiedNotHeld: true }
}

export const getCenterIncidentSessionType = (incident, session) => {
  if (!incident || !session || !positiveInt32(Number(incident.sessionId)) || String(session.id) !== String(incident.sessionId)) return 'Unverified'
  if (session.isPrivate === true) return 'Advanced'
  if (session.isPrivate === false) return 'Normal'
  return 'Unverified'
}

export const buildNormalMakeupCenterIncidentRequest = (incident, session, input, { now = new Date() } = {}) => {
  strictObject(incident, 'CenterIncidentResponse')
  assertOnlyKeys(input, ['date', 'startTime', 'endTime', 'roomId', 'coachId', 'reason'])
  if (getCenterIncidentSessionType(incident, session) !== 'Normal') {
    throw new CenterIncidentValidationError('Normal makeup requires a verified Normal session.', 'NORMAL_MAKEUP_EVIDENCE_REQUIRED')
  }
  if (incident.sessionCompensated !== true) {
    throw new CenterIncidentValidationError('Backend has not confirmed that the original session was not held.', 'NORMAL_MAKEUP_EVIDENCE_REQUIRED')
  }
  const date = normalizeIncidentLocalDate(input.date)
  const startTime = normalizeIncidentLocalTime(input.startTime, 'startTime')
  const endTime = normalizeIncidentLocalTime(input.endTime, 'endTime')
  const startAt = `${date}T${normalizeIncidentLocalDateTime(`${date}T${startTime}`, 'startTime').slice(11)}`
  const endAt = `${date}T${normalizeIncidentLocalDateTime(`${date}T${endTime}`, 'endTime').slice(11)}`
  const nowLocal = vietnamLocalNow(now)
  if (!nowLocal) throw new CenterIncidentValidationError('Current time is unavailable to validate makeup time.', 'MAKEUP_TIME_INVALID')
  if (startAt <= nowLocal || endAt <= startAt) throw new CenterIncidentValidationError('Makeup must be in the future and end after it starts.', 'MAKEUP_TIME_INVALID')
  return {
    date,
    startTime,
    endTime,
    roomId: requireId(Number(input.roomId), 'roomId'),
    coachId: requireId(Number(input.coachId), 'coachId'),
    reason: requiredText(input.reason, 'reason'),
  }
}

export const inspectCenterIncident = (incident) => {
  if (!incident || typeof incident !== 'object' || Array.isArray(incident)) return { verified: false }
  return {
    verified: true,
    id: incident.id ?? null,
    sessionId: incident.sessionId ?? null,
    status: incident.status ?? null,
    startedAt: incident.startedAt ?? null,
    endedAt: incident.endedAt ?? null,
    originalDeadline: incident.originalDeadline ?? null,
    deadlineBefore: incident.deadlineBefore ?? null,
    deadlineAfter: incident.deadlineAfter ?? null,
    recoveredCredits: incident.recoveredCredits ?? null,
    sessionCompensated: typeof incident.sessionCompensated === 'boolean' ? incident.sessionCompensated : null,
    affectedMemberIds: Array.isArray(incident.affectedMemberIds) ? incident.affectedMemberIds : null,
    reason: incident.reason ?? null,
    evidence: incident.evidence ?? null,
  }
}

export const getCenterIncidentError = (error) => {
  const status = Number(error?.status ?? error?.response?.status) || 0
  return {
    status,
    code: typeof error?.code === 'string' ? error.code : null,
    message: typeof error?.message === 'string' ? error.message : null,
    details: error?.details ?? error?.response?.data ?? null,
    outcomeUncertain: status === 0 || status >= 500,
    reloadBeforeNextAction: status === 0 || status === 409 || status >= 500,
  }
}

const actorAuthorities = (actor) => Array.isArray(actor?.authorities)
  ? actor.authorities.map((authority) => String(authority).trim().toUpperCase())
  : []

export const canManageCenterIncident = (actor, resource = null) => {
  if (normalizeRole(actor?.role, { isApiMode: true }) !== ROLE_MANAGER) return false
  if (actor?.authenticated !== true || !actorAuthorities(actor).includes('MANAGE_CLASSES')) return false
  if (typeof actor.status === 'string' && actor.status.trim().toLowerCase() !== 'active') return false
  if (actor.isActive === false || actor.enabled === false) return false
  const actorCenter = actor.centerId
  const resourceCenter = resource?.centerId
  if (actorCenter != null && resourceCenter != null && String(actorCenter) !== String(resourceCenter)) return false
  return true
}

const requireManager = (actor, resource = null) => {
  if (!canManageCenterIncident(actor, resource)) {
    throw new CenterIncidentValidationError('An active, authenticated Center Manager with MANAGE_CLASSES is required. Backend validates center scope.', 'CENTER_INCIDENT_MANAGER_ACCESS_REQUIRED')
  }
}

const requireList = (value) => {
  if (!Array.isArray(value) || value.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new CenterIncidentValidationError('Backend returned an invalid CenterIncidentResponse list.', 'CENTER_INCIDENT_RESPONSE_INVALID')
  }
  return value
}

export const listCenterIncidents = async (options) => requireList(await httpClient.get('/api/center-incidents', options))

const findCurrentIncident = async (id, options) => {
  const list = await listCenterIncidents(options)
  const incident = list.find((item) => String(item.id) === String(id))
  if (!incident) throw new CenterIncidentValidationError('Incident was not found in the current Backend list.', 'INCIDENT_NOT_FOUND')
  return incident
}

const mutationInFlight = new Map()
const once = (key, execute) => {
  const existing = mutationInFlight.get(key)
  if (existing) return existing
  const promise = Promise.resolve().then(execute).finally(() => mutationInFlight.delete(key))
  mutationInFlight.set(key, promise)
  return promise
}

const openKeyPayloads = new Map()
export const openCenterIncident = (input, options = {}) => {
  const { actor, now = new Date(), ...httpOptions } = options || {}
  const request = buildOpenCenterIncidentRequest(input, { now })
  requireManager(actor)
  const fingerprint = JSON.stringify(request)
  const previous = openKeyPayloads.get(request.requestKey)
  if (previous && previous !== fingerprint) {
    throw new CenterIncidentValidationError('requestKey has already been bound to different incident data.', 'IDEMPOTENCY_CONFLICT')
  }
  openKeyPayloads.set(request.requestKey, fingerprint)
  const key = `open:${request.requestKey}`
  return once(key, async () => {
    const sessions = await getSessions({}, httpOptions)
    const session = sessions.find((item) => String(item.id) === String(request.sessionId))
    if (!session) throw new CenterIncidentValidationError('The selected session was not found in the current center session list.', 'SESSION_NOT_FOUND')
    requireManager(actor, session)
    return strictObject(await httpClient.post('/api/center-incidents', request, httpOptions), 'CenterIncidentResponse')
  })
}

const incidentMutation = (action, incidentId, input, buildRequest, options = {}) => {
  const id = requireId(incidentId, 'incidentId')
  const { actor, now = new Date(), ...httpOptions } = options || {}
  const path = `/api/center-incidents/${id}/${action}`
  const key = `${path}:${JSON.stringify(input)}:${actor?.id ?? 'unknown'}`
  return once(key, async () => {
    requireManager(actor)
    const current = await findCurrentIncident(id, httpOptions)
    requireManager(actor, current)
    const request = buildRequest(current, input, { now })
    return strictObject(await httpClient.post(path, request, httpOptions), 'CenterIncidentResponse')
  })
}

export const resolveCenterIncident = (incidentId, input, options) =>
  incidentMutation('resolve', incidentId, input, buildResolveCenterIncidentRequest, options)

export const compensateCenterIncident = (incidentId, input, options) =>
  incidentMutation('compensate', incidentId, input, buildCompensateCenterIncidentRequest, options)

export const createNormalMakeup = (incidentId, input, options = {}) => {
  const id = requireId(incidentId, 'incidentId')
  const { actor, now = new Date(), ...httpOptions } = options || {}
  const path = `/api/center-incidents/${id}/normal-makeup`
  const key = `${path}:${JSON.stringify(input)}:${actor?.id ?? 'unknown'}`
  return once(key, async () => {
    requireManager(actor)
    const current = await findCurrentIncident(id, httpOptions)
    requireManager(actor, current)
    const sessions = await getSessions({}, httpOptions)
    const originalSession = sessions.find((item) => String(item.id) === String(current.sessionId))
    const request = buildNormalMakeupCenterIncidentRequest(current, originalSession, input, { now })
    if (sessions.some((item) => String(item.makeupForSessionId) === String(current.sessionId))) {
      throw new CenterIncidentValidationError('A makeup session already exists for this original session.', 'MAKEUP_ALREADY_CREATED')
    }
    return strictObject(await httpClient.post(path, request, httpOptions), 'SessionResponse')
  })
}

export const centerIncidentStatusSemantics = Object.freeze({
  waiting: 'WaitingForRecovery',
  resolved: 'Resolved',
  otherStatusHandling: 'Unknown status values are preserved and block state-dependent writes.',
  localDateTime: 'LocalDateTime strings are kept as Asia/Ho_Chi_Minh wall-clock values without adding Z or an offset.',
})
