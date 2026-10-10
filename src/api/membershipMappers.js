import { asNumber, parseBenefits, serializeBenefits } from './mappers.js';
import { isValidNumericId } from './schemaValidators.js';

export function normalizeSubscriptionStatus(status) {
  if (!status) return 'none';
  const s = String(status).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['active', 'valid'].includes(s)) return 'active';
  if (['pending_payment', 'pending', 'awaiting_payment'].includes(s)) return 'pending_payment';
  if (['grace_period', 'grace'].includes(s)) return 'grace_period';
  if (['expired', 'overdue'].includes(s)) return 'expired';
  if (['cancelled', 'canceled', 'revoked'].includes(s)) return 'cancelled';
  return s;
}

export function normalizePackageStatus(status) {
  if (!status) return 'active';
  const s = String(status).trim().toLowerCase();
  return ['inactive', 'disabled', 'closed'].includes(s) ? 'inactive' : 'active';
}

export function mapMembershipPackage(item) {
  if (!item || typeof item !== 'object') {
    return {
      id: null,
      name: '',
      nameVi: '',
      durationDays: 0,
      durationMonths: 1,
      price: 0,
      description: null,
      descriptionVi: null,
      benefits: [],
      benefitsVi: [],
      status: 'active',
      rawStatus: null,
    };
  }

  const durationDays = asNumber(item.durationDays);
  const benefits = parseBenefits(item.benefits);
  const price = asNumber(item.price) ?? 0;

  return {
    id: asNumber(item.id),
    name: item.name || '',
    nameVi: item.name || '',
    durationDays: durationDays ?? 0,
    durationMonths: durationDays !== null ? Math.max(1, Math.round(durationDays / 30)) : 1,
    price,
    description: item.benefits || null,
    descriptionVi: item.benefits || null,
    benefits,
    benefitsVi: benefits,
    status: normalizePackageStatus(item.status),
    rawStatus: item.status ?? null,
  };
}

export function toMembershipPackageRequest(item = {}) {
  if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
    throw new Error('Tên gói thành viên là bắt buộc.');
  }

  const durationDays = asNumber(item.durationDays);
  if (durationDays === null || durationDays <= 0 || !Number.isInteger(durationDays)) {
    throw new Error('Thời hạn gói (durationDays) phải là số nguyên dương.');
  }

  const price = asNumber(item.price);
  if (price === null || price < 0) {
    throw new Error('Giá gói thành viên phải lớn hơn hoặc bằng 0.');
  }

  return {
    name: item.name.trim(),
    durationDays,
    price,
    benefits: serializeBenefits(item.benefits),
    status: item.status ? String(item.status).toUpperCase() : 'ACTIVE',
  };
}

export function mapMemberSubscription(item) {
  if (!item || typeof item !== 'object') {
    return {
      subscriptionId: null,
      id: null,
      memberId: null,
      memberName: '',
      packageId: null,
      packageName: '',
      price: 0,
      startDate: null,
      endDate: null,
      status: 'none',
      rawStatus: null,
    };
  }

  const subId = asNumber(item.subscriptionId ?? item.id);
  const memberId = asNumber(item.memberId);
  const packageId = asNumber(item.packageId);
  const price = asNumber(item.price) ?? 0;

  return {
    subscriptionId: subId,
    id: subId,
    memberId,
    memberName: item.memberName || '',
    packageId,
    packageName: item.packageName || '',
    price,
    startDate: item.startDate || null,
    endDate: item.endDate || null,
    status: normalizeSubscriptionStatus(item.status),
    rawStatus: item.status ?? null,
  };
}

export function toMemberPackageRequest(data = {}) {
  const packageId = asNumber(data.packageId);
  if (!isValidNumericId(packageId)) {
    throw new Error('ID gói thành viên (packageId) không hợp lệ hoặc thiếu.');
  }

  const payload = {
    packageId,
  };

  if (data.startDate) {
    payload.startDate = String(data.startDate).trim().slice(0, 10);
  }

  if (data.durationDays !== undefined && data.durationDays !== null && data.durationDays !== '') {
    const days = asNumber(data.durationDays);
    if (days !== null && days > 0) {
      payload.durationDays = days;
    }
  }

  if (typeof data.isRenewal === 'boolean') {
    payload.isRenewal = data.isRenewal;
  }

  if (data.paymentMethod && typeof data.paymentMethod === 'string') {
    payload.paymentMethod = data.paymentMethod.trim();
  }

  if (data.notes && typeof data.notes === 'string') {
    payload.notes = data.notes.trim();
  }

  return payload;
}
