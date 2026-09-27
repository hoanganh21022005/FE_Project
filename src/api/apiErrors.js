export class ApiError extends Error {
  constructor(message, { status = 0, code = 'HTTP_ERROR', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends ApiError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'VALIDATION_ERROR' });
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'NOT_FOUND' });
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'UNAUTHORIZED' });
    this.name = 'UnauthorizedError';
  }
}

export function createApiError(status, body, fallbackMessage) {
  const message = body?.message || body?.error || fallbackMessage || `HTTP ${status}`;
  const options = { status, details: body };

  if (status === 400 || status === 409 || status === 422) {
    return new ValidationError(message, options);
  }
  if (status === 401 || status === 403) {
    return new UnauthorizedError(message, options);
  }
  if (status === 404) {
    return new NotFoundError(message, options);
  }
  return new ApiError(message, options);
}

export function getErrorMessage(error, fallback = 'Không thể kết nối đến máy chủ.') {
  return error instanceof Error && error.message ? error.message : fallback;
}
