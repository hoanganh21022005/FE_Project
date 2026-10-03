const asNumber = (value) => {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeStatus = (value) =>
  String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")

export function mapAdminPermission(item = {}) {
  return {
    id: asNumber(item.id),
    name: item.name ?? "",
    description: item.description ?? null,
  }
}

export function mapAdminRole(item = {}) {
  return {
    id: asNumber(item.id),
    name: item.name ?? "",
    description: item.description ?? null,
    permissions: Array.isArray(item.permissions)
      ? item.permissions.map(mapAdminPermission)
      : [],
  }
}

export function mapAdminUser(item = {}) {
  return {
    id: asNumber(item.id),
    code: item.code ?? null,
    fullName: item.fullName ?? "",
    email: item.email ?? "",
    phone: item.phone ?? null,
    address: item.address ?? null,
    gender: item.gender ?? null,
    dateOfBirth: item.dateOfBirth ?? null,
    status: normalizeStatus(item.status),
    roleId: asNumber(item.roleId),
    roleName: item.roleName ?? null,
    createdAt: item.createdAt ?? null,
    permissions: Array.isArray(item.permissions)
      ? item.permissions.filter(Boolean)
      : [],
  }
}

export function mapAdminAuditLog(item = {}) {
  const actorId = asNumber(item.userId)
  const targetId = asNumber(item.targetId)
  return {
    id: asNumber(item.id),
    actorId,
    actorLabel: actorId === null ? "System" : `User #${actorId}`,
    action: item.action ?? "UNKNOWN",
    targetEntity: item.targetEntity ?? null,
    targetId,
    targetLabel: item.targetEntity
      ? `${item.targetEntity}${targetId === null ? "" : ` #${targetId}`}`
      : targetId === null
        ? "N/A"
        : `#${targetId}`,
    detail: item.detail ?? null,
    createdAt: item.createdAt ?? null,
  }
}
