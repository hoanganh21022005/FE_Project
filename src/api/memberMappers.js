import { asNumber } from './mappers.js';

export function normalizeMemberStatus(status, fallback = 'active') {
  if (!status) return fallback;
  const s = String(status).trim().toLowerCase();
  if (['active', 'hoạt động'].includes(s)) return 'active';
  if (['locked', 'đã khóa', 'suspended'].includes(s)) return 'locked';
  if (['inactive', 'không hoạt động'].includes(s)) return 'inactive';
  return s;
}

export function normalizeMembershipStatus(status, fallback = 'none') {
  if (!status) return fallback;
  const s = String(status).trim().toLowerCase();
  if (['active', 'hoạt động'].includes(s)) return 'active';
  if (['expired', 'hết hạn'].includes(s)) return 'expired';
  if (['grace_period', 'grace period', 'ân hạn'].includes(s)) return 'grace_period';
  if (['pending_payment', 'pending payment', 'chờ thanh toán'].includes(s)) return 'pending_payment';
  return s;
}

/**
 * Maps MemberResponse from BE to the frontend member model.
 * ID is strictly preserved as a number.
 */
export function mapMember(dto) {
  if (!dto || typeof dto !== 'object') return null;

  const id = asNumber(dto.id);
  const rawStatus = dto.status || 'Active';
  const accountStatus = normalizeMemberStatus(rawStatus, 'active');
  const membershipStatus = normalizeMembershipStatus(dto.membershipStatus, 'none');

  return {
    id,
    code: dto.code ? String(dto.code).trim() : '',
    name: dto.name ? String(dto.name).trim() : (dto.fullName ? String(dto.fullName).trim() : ''),
    email: dto.email ? String(dto.email).trim() : '',
    phone: dto.phone ? String(dto.phone).trim() : '',
    avatar: dto.avatar || '',
    joinDate: dto.joinDate || dto.joinedDate || null,
    currentPackageId: asNumber(dto.currentPackageId),
    currentPackageName: dto.currentPackageName || '',
    membershipStatus,
    primaryCoachId: asNumber(dto.primaryCoachId),
    primaryCoachName: dto.primaryCoachName || '',
    totalSpent: asNumber(dto.totalSpent) || 0,
    goal: dto.goal || '',
    healthNote: dto.healthNote || '',
    address: dto.address || '',
    gender: dto.gender || '',
    dateOfBirth: dto.dateOfBirth || null,
    status: accountStatus,
    rawStatus,
    accountStatus,
  };
}

/**
 * Creates MemberRequest payload for POST /api/members and PUT /api/members/{id}.
 * Whitelists allowed fields, trims strings, strips UI-only fields, and handles password rules.
 * G4 Scope: packageId is omitted as membership lifecycle belongs to G5.
 */
export function toMemberRequest(input = {}) {
  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim();

  if (!name) {
    throw new Error('Họ và tên hội viên là bắt buộc.');
  }
  if (!email) {
    throw new Error('Địa chỉ email hội viên là bắt buộc.');
  }

  const payload = {
    name,
    email,
  };

  if (input.phone !== undefined && input.phone !== null && String(input.phone).trim()) {
    payload.phone = String(input.phone).trim();
  }
  if (input.address !== undefined && input.address !== null && String(input.address).trim()) {
    payload.address = String(input.address).trim();
  }
  if (input.gender !== undefined && input.gender !== null && String(input.gender).trim()) {
    payload.gender = String(input.gender).trim();
  }
  if (input.dateOfBirth !== undefined && input.dateOfBirth !== null && String(input.dateOfBirth).trim()) {
    payload.dateOfBirth = String(input.dateOfBirth).trim();
  }
  if (input.goal !== undefined && input.goal !== null && String(input.goal).trim()) {
    payload.goal = String(input.goal).trim();
  }
  if (input.healthNote !== undefined && input.healthNote !== null && String(input.healthNote).trim()) {
    payload.healthNote = String(input.healthNote).trim();
  }
  if (input.status !== undefined && input.status !== null && String(input.status).trim()) {
    payload.status = String(input.status).trim();
  }

  // Only include password if a non-empty string is explicitly provided
  if (typeof input.password === 'string' && input.password.trim().length > 0) {
    payload.password = input.password.trim();
  }

  return payload;
}
