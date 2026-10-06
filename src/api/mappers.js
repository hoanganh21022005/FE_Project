const normalizeStatus = (status, fallback = null) => status
  ? String(status).trim().toLowerCase().replace(/\s+/g, '_')
  : fallback;

const asNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const idNumber = (value) => {
  const direct = asNumber(value);
  if (direct !== null) return direct;
  const match = String(value ?? '').match(/(\d+)$/);
  return match ? Number(match[1]) : null;
};

export function parseBenefits(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value).split(/\s*(?:;|\r?\n)\s*/).filter(Boolean);
}

export function serializeBenefits(value) {
  return Array.isArray(value) ? value.filter(Boolean).join(';') : (value || '');
}

export const mapSubject = (subject) => ({
  id: subject.id,
  name: subject.name,
  description: subject.description ?? null,
});

export const mapRoom = (room) => ({
  id: room.id,
  name: room.name,
  location: room.location ?? null,
  capacity: asNumber(room.capacity),
  status: normalizeStatus(room.status, 'active'),
});

export function mapPackage(item) {
  const durationDays = asNumber(item.durationDays);
  const benefits = parseBenefits(item.benefits);
  return {
    id: item.id,
    name: item.name,
    nameVi: item.name,
    price: asNumber(item.price) ?? 0,
    durationDays,
    durationMonths: durationDays === null ? null : Math.round(durationDays / 30),
    description: item.benefits ?? null,
    descriptionVi: item.benefits ?? null,
    benefits,
    benefitsVi: benefits,
    maxClassesPerMonth: null,
    tier: null,
    status: normalizeStatus(item.status, 'active'),
  };
}

const classStatus = (status) => {
  const normalized = normalizeStatus(status, 'draft');
  if (['open', 'ongoing', 'active'].includes(normalized)) return 'published';
  if (normalized === 'closed') return 'completed';
  return normalized;
};

export function mapClass(item, { subjects = [], coaches = [], fallback = {} } = {}) {
  const subject = subjects.find((entry) => String(entry.id) === String(item.subjectId));
  const coach = coaches.find((entry) => idNumber(entry.id) === asNumber(item.coachId));
  return {
    id: item.id,
    name: item.name,
    nameVi: item.name,
    subjectId: item.subjectId ?? null,
    coachId: item.coachId ?? null,
    coachName: coach?.name ?? fallback.coachName ?? null,
    capacity: asNumber(item.maxCapacity) ?? 0,
    status: classStatus(item.status),
    apiStatus: item.status ?? null,
    startDate: item.startDate ?? null,
    endDate: item.endDate ?? null,
    date: fallback.date ?? item.startDate ?? null,
    startTime: fallback.startTime ?? null,
    endTime: fallback.endTime ?? null,
    durationMinutes: fallback.durationMinutes ?? null,
    enrolledCount: 0,
    code: null,
    category: subject?.name ?? fallback.category ?? null,
    room: fallback.room ?? null,
    roomVi: fallback.roomVi ?? fallback.room ?? null,
    minTierRequired: null,
  };
}

export function mapAuditLog(item) {
  const target = [item.targetEntity, item.targetId].filter((value) => value !== null && value !== undefined).join(' #');
  return {
    id: item.id,
    timestamp: item.createdAt ?? null,
    actorId: item.userId ?? null,
    actorName: item.userId ? `User #${item.userId}` : 'System',
    actorRole: null,
    action: item.action ?? 'UNKNOWN',
    target: target || 'N/A',
    previousValue: null,
    newValue: null,
    reason: item.detail ?? null,
  };
}

export const mapDashboard = (item) => ({
  totalUsers: asNumber(item.totalUsers) ?? 0,
  totalMembers: asNumber(item.totalMembers) ?? 0,
  totalClasses: asNumber(item.totalClasses) ?? 0,
  totalPackages: asNumber(item.totalPackages) ?? 0,
});

export const toClassRequest = (item) => ({
  name: item.name || item.nameVi,
  subjectId: idNumber(item.subjectId),
  coachId: idNumber(item.coachId),
  maxCapacity: asNumber(item.maxCapacity ?? item.capacity),
  startDate: item.startDate ?? item.date ?? null,
  endDate: item.endDate ?? item.date ?? null,
  status: item.apiStatus ?? (item.status === 'published' ? 'Open' : item.status),
});

export const toPackageRequest = (item) => {
  const durationDays = asNumber(item.durationDays);
  const durationMonths = asNumber(item.durationMonths);
  return {
    name: item.name,
    durationDays: durationDays ?? (durationMonths === null ? null : Math.round(durationMonths * 30)),
    price: asNumber(item.price),
    benefits: serializeBenefits(item.benefits),
    status: item.status,
  };
};
