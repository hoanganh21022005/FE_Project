import { createApiError } from "./apiErrors.js"

export const UNAUTHORIZED_EVENT = "scms:unauthorized"
export const FORBIDDEN_EVENT = "scms:forbidden"

const API_BASE_URL = String(
  import.meta?.env?.VITE_API_BASE_URL ||
    (import.meta?.env?.DEV ? "" : "https://scms-app-p1gy.onrender.com"),
).replace(/\/+$/, "")

function resolveUrl(path) {
  if (/^https?:\/\//i.test(path)) return path
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}

export async function httpRequest(path, options = {}) {
  const { expectedStatus, timeoutMs, responseType, ...fetchOptions } = options
  const headers = new Headers(options.headers)
  const hasBody = options.body !== undefined && options.body !== null
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData

  if (hasBody && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json")
  }

  let response
  let timedOut = false
  let timeoutId
  let externalSignal
  let externalAbortHandler
  const timeoutController =
    Number.isFinite(timeoutMs) && timeoutMs > 0 && typeof AbortController !== "undefined"
      ? new AbortController()
      : null
  if (timeoutController) {
    externalSignal = fetchOptions.signal
    if (externalSignal?.aborted) timeoutController.abort(externalSignal.reason)
    else if (externalSignal) {
      externalAbortHandler = () => timeoutController.abort(externalSignal.reason)
      externalSignal.addEventListener("abort", externalAbortHandler, { once: true })
    }
    timeoutId = setTimeout(() => {
      timedOut = true
      timeoutController.abort()
    }, timeoutMs)
    fetchOptions.signal = timeoutController.signal
  }
  try {
    response = await fetch(resolveUrl(path), {
      ...fetchOptions,
      headers,
      credentials: "include",
      body:
        hasBody && !isFormData && typeof options.body !== "string"
          ? JSON.stringify(options.body)
          : options.body,
    })
  } catch (error) {
    const apiError = createApiError(0, null)
    if (timedOut) {
      apiError.message =
        "Yêu cầu đã quá thời gian chờ. Vui lòng kiểm tra trạng thái rồi thử lại sau."
    } else if (error?.message) {
      apiError.details = { message: error.message }
    }
    throw apiError
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
    if (externalSignal && externalAbortHandler) {
      externalSignal.removeEventListener("abort", externalAbortHandler)
    }
  }

  const contentType = response.headers.get("content-type") || ""
  const body =
    response.status === 204
      ? null
      : response.ok && responseType === "blob"
        ? await response.blob()
      : contentType.includes("application/json")
        ? await response.json().catch(() => null)
        : await response.text().catch(() => "")

  if (!response.ok) {
    if (
      response.status === 401 &&
      options.notifyUnauthorized !== false &&
      typeof window !== "undefined"
    ) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
    }
    if (
      response.status === 403 &&
      options.notifyForbidden !== false &&
      typeof window !== "undefined"
    ) {
      window.dispatchEvent(
        new CustomEvent(FORBIDDEN_EVENT, {
          detail: { path, method: options.method || "GET", body, status: 403 },
        }),
      )
    }
    const apiError = createApiError(response.status, body)
    apiError.endpoint = path
    apiError.requestId =
      response.headers.get("x-request-id") ||
      response.headers.get("request-id") ||
      response.headers.get("traceparent")
    throw apiError
  }

  if (expectedStatus !== undefined && response.status !== expectedStatus) {
    const apiError = createApiError(
      response.status,
      body,
      `Máy chủ phản hồi trạng thái ${response.status}; kỳ vọng ${expectedStatus}.`,
    )
    apiError.endpoint = path
    throw apiError
  }

  if (responseType === "blob") {
    return {
      data: body,
      contentType: response.headers.get("content-type"),
      contentDisposition: response.headers.get("content-disposition"),
    }
  }

  return body
}

export const httpClient = {
  get: (path, options) => httpRequest(path, { ...options, method: "GET" }),
  getBlob: (path, options) => httpRequest(path, { ...options, method: "GET", responseType: "blob" }),
  post: (path, body, options) =>
    httpRequest(path, { ...options, method: "POST", body }),
  put: (path, body, options) =>
    httpRequest(path, { ...options, method: "PUT", body }),
  patch: (path, body, options) =>
    httpRequest(path, { ...options, method: "PATCH", body }),
  delete: (path, options) =>
    httpRequest(path, { ...options, method: "DELETE" }),
}

// Test hooks for CDP browser runner; strictly gated to mock mode and eliminated in production bundle
if (
  typeof window !== "undefined" &&
  typeof import.meta.env !== "undefined" &&
  import.meta.env.MODE === "mock"
) {
  window.__scms_httpClient = httpClient
  window.__scms_httpRequest = httpRequest
}
