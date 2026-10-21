export class ApiError extends Error {
  constructor(message, { status = 0, code = null, details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends ApiError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'ForbiddenError';
  }
}

const STATUS_MESSAGES = {
  0: 'Không thể kết nối đến máy chủ. Kiểm tra kết nối mạng rồi thử lại.',
  400: 'Dữ liệu gửi lên không hợp lệ.',
  401: 'Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy dữ liệu được yêu cầu.',
  409: 'Dữ liệu đang xung đột với thông tin hiện có.',
  422: 'Dữ liệu không vượt qua kiểm tra hợp lệ.',
  500: 'Máy chủ gặp lỗi khi xử lý yêu cầu.',
};

function readBackendMessage(body) {
  if (typeof body === 'string' && body.trim()) return body.trim();
  if (!body || typeof body !== 'object') return '';

  for (const value of [body.message, body.error, body.detail]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export function createApiError(status, body, fallbackMessage) {
  const backendMessage = readBackendMessage(body);
  const fallback = STATUS_MESSAGES[status] || (status ? `Yêu cầu thất bại (HTTP ${status}).` : STATUS_MESSAGES[0]);
  const message = backendMessage || (status === 0
    ? fallback
    : fallbackMessage && !/^HTTP\s+\d+$/i.test(fallbackMessage)
      ? fallbackMessage
      : fallback);
  const options = {
    status,
    details: body,
    code: typeof body?.code === 'string' ? body.code : null,
  };

  if (status === 400 || status === 409 || status === 422) {
    return new ValidationError(message, options);
  }
  if (status === 401) {
    return new UnauthorizedError(message, options);
  }
  if (status === 403) {
    return new ForbiddenError(message, options);
  }
  if (status === 404) {
    return new NotFoundError(message, options);
  }
  return new ApiError(message, options);
}

export function getErrorMessage(error, fallback = STATUS_MESSAGES[0]) {
  const status = Number(error?.status ?? error?.response?.status);
  const backendMessage = readBackendMessage(error?.details ?? error?.response?.data);
  if (backendMessage) return backendMessage;
  if (error instanceof Error && error.message && !/^HTTP\s+\d+$/i.test(error.message)) {
    return error.message;
  }
  if (Number.isFinite(status) && STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  return fallback;
}
