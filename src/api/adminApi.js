import { httpClient } from "./httpClient.js"
import {
  mapAdminAuditLog,
  mapAdminPermission,
  mapAdminRole,
  mapAdminUser,
  mapSpecialization,
} from "./adminMappers.js"
import { isValidNumericId } from "./schemaValidators.js"

const mapCollection = (value, mapper) => {
  if (!Array.isArray(value)) return []
  return value.map(mapper)
}

export const getAdminUsers = async (params = {}) => {
  const query = new URLSearchParams()
  if (params.role) query.set("role", params.role)
  if (params.search) query.set("search", params.search)
  const qStr = query.toString()
  return mapCollection(
    await httpClient.get(`/api/users${qStr ? `?${qStr}` : ""}`),
    mapAdminUser,
  )
}

export const getUserById = async (id) => {
  if (!isValidNumericId(id)) throw new Error("ID người dùng không hợp lệ.")
  const data = await httpClient.get(`/api/users/${id}`)
  return mapAdminUser(data)
}

export const createUser = async (data) => {
  const res = await httpClient.post("/api/users", data)
  return mapAdminUser(res)
}

export const updateUser = async (id, data) => {
  if (!isValidNumericId(id)) throw new Error("ID người dùng không hợp lệ.")
  const res = await httpClient.put(`/api/users/${id}`, data)
  return mapAdminUser(res)
}

export const updateUserRole = async (id, roleId) => {
  if (!isValidNumericId(id)) throw new Error("ID người dùng không hợp lệ.")
  const res = await httpClient.patch(`/api/users/${id}/role`, {
    roleId: Number(roleId),
  })
  return mapAdminUser(res)
}

export const updateUserStatus = async (id, status) => {
  if (!isValidNumericId(id)) throw new Error("ID người dùng không hợp lệ.")
  const res = await httpClient.patch(`/api/users/${id}/status`, {
    status: String(status),
  })
  return mapAdminUser(res)
}

export const getAdminRoles = async () =>
  mapCollection(await httpClient.get("/api/roles"), mapAdminRole)

export const getRoleById = async (id) => {
  if (!isValidNumericId(id)) throw new Error("ID vai trò không hợp lệ.")
  const data = await httpClient.get(`/api/roles/${id}`)
  return mapAdminRole(data)
}

export const updateRolePermissions = async (roleId, permissionIds = []) => {
  if (!isValidNumericId(roleId)) throw new Error("ID vai trò không hợp lệ.")
  const res = await httpClient.put(`/api/roles/${roleId}/permissions`, {
    permissionIds: permissionIds.map(Number),
  })
  return mapAdminRole(res)
}

export const getAdminPermissions = async () =>
  mapCollection(await httpClient.get("/api/permissions"), mapAdminPermission)

export const getAdminAuditLogs = async (params = {}) => {
  const query = new URLSearchParams()
  if (params.startDate) query.set("startDate", params.startDate)
  if (params.endDate) query.set("endDate", params.endDate)
  if (params.action) query.set("action", params.action)
  if (params.targetEntity) query.set("targetEntity", params.targetEntity)
  if (params.actorId !== undefined && params.actorId !== null && params.actorId !== "") {
    query.set("actorId", params.actorId)
  }
  if (params.page !== undefined && params.page !== null && params.page !== "") {
    query.set("page", params.page)
  }
  if (params.size !== undefined && params.size !== null && params.size !== "") {
    query.set("size", params.size)
  }
  const qStr = query.toString()
  return mapCollection(
    await httpClient.get(`/api/audit-logs${qStr ? `?${qStr}` : ""}`),
    mapAdminAuditLog,
  )
}

export const getSpecializations = async (params = {}) => {
  const query = new URLSearchParams()
  if (params.status) query.set("status", params.status)
  if (params.subjectId) query.set("subjectId", params.subjectId)
  const qStr = query.toString()
  return mapCollection(
    await httpClient.get(`/api/specializations${qStr ? `?${qStr}` : ""}`),
    mapSpecialization,
  )
}

export const createSpecialization = async (data) => {
  const res = await httpClient.post("/api/specializations", data)
  return mapSpecialization(res)
}

export const updateSpecialization = async (id, data) => {
  if (!isValidNumericId(id)) throw new Error("ID chuyên môn không hợp lệ.")
  const res = await httpClient.put(`/api/specializations/${id}`, data)
  return mapSpecialization(res)
}

export const updateSpecializationStatus = async (id, status) => {
  if (!isValidNumericId(id)) throw new Error("ID chuyên môn không hợp lệ.")
  const res = await httpClient.patch(`/api/specializations/${id}/status`, {
    status: String(status),
  })
  return mapSpecialization(res)
}

export const adminApi = {
  getAdminUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserRole,
  updateUserStatus,
  getAdminRoles,
  getRoleById,
  updateRolePermissions,
  getAdminPermissions,
  getAdminAuditLogs,
  getSpecializations,
  createSpecialization,
  updateSpecialization,
  updateSpecializationStatus,
}

export default adminApi
