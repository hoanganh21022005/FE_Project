import { createApiError } from './apiErrors.js';

export const UNAUTHORIZED_EVENT = 'scms:unauthorized';
export const FORBIDDEN_EVENT = 'scms:forbidden';

const API_BASE_URL = String(import.meta?.env?.VITE_API_BASE_URL || '').replace(/\/+$/, '');

function resolveUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export async function httpRequest(path, options = {}) {
  const headers = new Headers(options.headers);
  const hasBody = options.body !== undefined && options.body !== null;

  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  let response;
  try {
    response = await fetch(resolveUrl(path), {
      ...options,
      headers,
      credentials: 'include',
      body: hasBody && typeof options.body !== 'string'
        ? JSON.stringify(options.body)
        : options.body,
    });
  } catch (error) {
    throw createApiError(0, null, error?.message || 'Không thể kết nối đến máy chủ.');
  }

  const contentType = response.headers.get('content-type') || '';
  const body = response.status === 204
    ? null
    : contentType.includes('application/json')
      ? await response.json().catch(() => null)
      : await response.text().catch(() => '');

  if (!response.ok) {
    if (response.status === 401
      && options.notifyUnauthorized !== false
      && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    if (response.status === 403
      && options.notifyForbidden !== false
      && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(FORBIDDEN_EVENT, { detail: { path, body, status: 403 } }));
    }
    throw createApiError(response.status, body, response.statusText);
  }

  return body;
}

export const httpClient = {
  get: (path, options) => httpRequest(path, { ...options, method: 'GET' }),
  post: (path, body, options) => httpRequest(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => httpRequest(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => httpRequest(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => httpRequest(path, { ...options, method: 'DELETE' }),
};

// Test hooks for CDP browser runner; strictly gated to mock mode and eliminated in production bundle
if (typeof window !== 'undefined' && typeof import.meta.env !== 'undefined' && import.meta.env.MODE === 'mock') {
  window.__scms_httpClient = httpClient;
  window.__scms_httpRequest = httpRequest;
}
