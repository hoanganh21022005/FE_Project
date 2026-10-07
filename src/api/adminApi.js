import { httpClient } from "./httpClient.js"
import {
  mapAdminAuditLog,
  mapAdminPermission,
  mapAdminRole,
  mapAdminUser,
} from "./adminMappers.js"

const mapCollection = (value, mapper) => {
  if (!Array.isArray(value)) return []
  return value.map(mapper)
}

export const getAdminUsers = async () =>
  mapCollection(await httpClient.get("/api/users"), mapAdminUser)

export const getAdminRoles = async () =>
  mapCollection(await httpClient.get("/api/roles"), mapAdminRole)

export const getAdminPermissions = async () =>
  mapCollection(await httpClient.get("/api/permissions"), mapAdminPermission)

export const getAdminAuditLogs = async () =>
  mapCollection(await httpClient.get("/api/audit-logs"), mapAdminAuditLog)
