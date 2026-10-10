import { asNumber } from './mappers.js';
import { STAFF_ROLE_MAP } from './staffMappers.js';

/**
 * Schema and contract validation for Member and Staff DTO responses from backend.
 * Enforces type safety, integer identifiers (OpenAPI int32), non-empty names,
 * and exact allowed backend roles to guarantee functional frontend models.
 */

export const ALLOWED_STAFF_ROLES = new Set(Object.keys(STAFF_ROLE_MAP));

export function extractList(body) {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object') {
    if (Array.isArray(body.content)) return body.content;
    if (Array.isArray(body.data)) return body.data;
    if (Array.isArray(body.items)) return body.items;
  }
  return null;
}

/**
 * Validates that an identifier is a positive 32-bit integer per OpenAPI spec.
 * Disallows decimals (e.g., 1.5), non-integers, negative numbers, and zero.
 */
export function isValidNumericId(val) {
  const n = asNumber(val);
  return n !== null && Number.isInteger(n) && n > 0 && n <= 2147483647;
}

export function isNonEmptyString(val) {
  return typeof val === 'string' && val.trim().length > 0;
}

export function isAllowedStaffRole(role) {
  if (typeof role !== 'string') return false;
  return ALLOWED_STAFF_ROLES.has(role.trim().toLowerCase());
}

export function validateMemberItem(item) {
  if (!item || typeof item !== 'object') return false;

  // Must have a valid positive integer ID (int32)
  if (!isValidNumericId(item.id)) return false;

  // Must have a valid non-empty name (supports name or fullName)
  const hasValidName = isNonEmptyString(item.name) || isNonEmptyString(item.fullName);
  if (!hasValidName) return false;

  // If email is provided, must be a non-empty string containing '@'
  if (item.email !== undefined && item.email !== null) {
    if (!isNonEmptyString(item.email) || !item.email.includes('@')) {
      return false;
    }
  }

  return true;
}

export function validateMemberSchema(list) {
  if (!Array.isArray(list)) return false;
  if (list.length === 0) return true;
  return list.every(validateMemberItem);
}

export function validateStaffItem(item) {
  if (!item || typeof item !== 'object') return false;

  // Must have a valid positive integer ID (int32)
  if (!isValidNumericId(item.id)) return false;

  // Must have a valid non-empty name
  const hasValidName = isNonEmptyString(item.name) || isNonEmptyString(item.fullName);
  if (!hasValidName) return false;

  // Must match allowed backend roles exactly (case-insensitive), preventing substring false positives (e.g. 'NotCoach')
  const rawRole = item.role || item.roleName;
  if (!rawRole || !isAllowedStaffRole(rawRole)) return false;

  // If email is provided, must be a non-empty string containing '@'
  if (item.email !== undefined && item.email !== null) {
    if (!isNonEmptyString(item.email) || !item.email.includes('@')) {
      return false;
    }
  }

  return true;
}

export function validateStaffSchema(list) {
  if (!Array.isArray(list)) return false;
  if (list.length === 0) return true;
  return list.every(validateStaffItem);
}

export function validatePackageItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (!isValidNumericId(item.id)) return false;
  if (!isNonEmptyString(item.name)) return false;
  const price = asNumber(item.price);
  if (price === null || price < 0) return false;
  return true;
}

export function validatePackageSchema(list) {
  if (!Array.isArray(list)) return false;
  if (list.length === 0) return true;
  return list.every(validatePackageItem);
}

export function validateSubscriptionItem(item) {
  if (!item || typeof item !== 'object') return false;
  const subId = item.subscriptionId ?? item.id;
  if (!isValidNumericId(subId)) return false;
  if (!isValidNumericId(item.memberId)) return false;
  if (!isValidNumericId(item.packageId)) return false;
  return true;
}

export function validateSubscriptionSchema(list) {
  if (!Array.isArray(list)) return false;
  if (list.length === 0) return true;
  return list.every(validateSubscriptionItem);
}

export function validateInvoiceItem(item) {
  if (!item || typeof item !== 'object') return false;
  const invId = item.invoiceId ?? item.id;
  if (!isValidNumericId(invId)) return false;
  if (!isValidNumericId(item.memberId)) return false;
  const amount = asNumber(item.amount);
  if (amount === null || amount < 0) return false;
  return true;
}

export function validateInvoiceSchema(list) {
  if (!Array.isArray(list)) return false;
  if (list.length === 0) return true;
  return list.every(validateInvoiceItem);
}
