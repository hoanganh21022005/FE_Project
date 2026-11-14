export const ADMIN_ORIGIN = "https://admin.vibesports.pages.dev"
export const MAIN_PRODUCTION_HOST = "vibesports.pages.dev"

function readSurfaceEnv(surfaceEnv) {
  if (surfaceEnv !== undefined) {
    return surfaceEnv
  }
  try {
    return import.meta?.env?.VITE_APP_SURFACE
  } catch {
    return undefined
  }
}

function resolveHostname(hostname) {
  if (hostname !== undefined) {
    return String(hostname || "").trim().toLowerCase()
  }
  if (typeof window !== "undefined" && window.location) {
    return String(window.location.hostname || "").trim().toLowerCase()
  }
  return ""
}

export function isAdminHost(hostname, surfaceEnv) {
  const surface = String(readSurfaceEnv(surfaceEnv) || "").trim().toLowerCase()
  if (surface === "admin") {
    return true
  }
  const resolvedHost = resolveHostname(hostname)
  return resolvedHost.startsWith("admin.")
}

export function getMainHostAdminRedirectUrl(
  pathname = "",
  search = "",
  hostname,
  surfaceEnv,
) {
  if (isAdminHost(hostname, surfaceEnv)) {
    return null
  }
  const resolvedHost = resolveHostname(hostname)
  if (resolvedHost !== MAIN_PRODUCTION_HOST) {
    return null
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return `${ADMIN_ORIGIN}${pathname}${search || ""}`
  }
  return null
}
