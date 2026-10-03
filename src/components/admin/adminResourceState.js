export const ADMIN_RESOURCE_KEYS = [
  "users",
  "roles",
  "permissions",
  "auditLogs",
]

export const createAdminResourceState = () => ({
  data: [],
  status: "idle",
  error: null,
})

export const createAdminResources = () =>
  Object.fromEntries(
    ADMIN_RESOURCE_KEYS.map((key) => [key, createAdminResourceState()]),
  )

export const updateAdminResource = (resources, key, patch) => ({
  ...resources,
  [key]: { ...resources[key], ...patch },
})
