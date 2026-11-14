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

export const STATUS_MESSAGES = {
  0: 'Không thể kết nối đến máy chủ. Kiểm tra kết nối mạng rồi thử lại.',
  400: 'Dữ liệu gửi lên không hợp lệ.',
  401: 'Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy dữ liệu được yêu cầu.',
  409: 'Dữ liệu đang xung đột với thông tin hiện có.',
  422: 'Dữ liệu không vượt qua kiểm tra hợp lệ.',
  429: 'Bạn đã gửi quá nhiều yêu cầu trong thời gian ngắn. Vui lòng chờ giây lát rồi thử lại.',
  500: 'Máy chủ gặp lỗi khi xử lý yêu cầu.',
};

export function sanitizeBackendMessage(rawMessage, status = 0) {
  if (!rawMessage || typeof rawMessage !== 'string') return '';
  let msg = rawMessage.trim();
  if (!msg) return '';

  // 1. Gỡ bỏ các tiền tố kỹ thuật nếu có
  const prefixRegex =
    /^(?:http\s*\d{3}\s*[:：\-]\s*|error\s*\d*\s*[:：\-]\s*|lỗi\s*(?:từ|của)?\s*(?:backend|api|server|máy\s*chủ|hệ\s*thống)?\s*[:：\-]\s*|(?:backend|api|server|system)\s*(?:error|failure)?\s*[:：\-]\s*)/i;
  msg = msg.replace(prefixRegex, '').trim();

  // 2. Nhận diện các mẫu chuỗi kỹ thuật rò rỉ endpoint hoặc hệ thống nội bộ
  const technicalPatterns = [
    /\/api(\/|\b)/i,
    /https?:\/\//i,
    /^\s*\/[a-z0-9_-]+/i,
    /\bendpoint\b/i,
    /\baccess\s*denied\b/i,
    /\bfull\s*authentication\s*is\s*required\b/i,
    /\bbad\s*credentials\b/i,
    /\bno\s*static\s*resource\b/i,
    /\binternal\s*server\s*error\b/i,
    /\bfailed\s*to\s*fetch\b/i,
    /\bnetwork\s*error\b/i,
    /\bnetworkrequestfailed\b/i,
    /\bload\s*failed\b/i,
    /\bconnection\s*refused\b/i,
    /\beconnrefused\b/i,
    /\btoo\s*many\s*requests\b/i,
    /\brate\s*limit\b/i,
    /\bmethod\s*not\s*allowed\b/i,
    /\brequest\s*method\b/i,
    /\bunsupported\s*media\s*type\b/i,
    /\bnot\s*supported\b/i,
    /\bbad\s*gateway\b/i,
    /\bservice\s*unavailable\b/i,
    /\bgateway\s*timeout\b/i,
    /\bbackend\s+(?:returned|sent|responded|threw|failed|error|failure|exception|server|service|cluster|database)\b/i,
    /\b(?:from|to|on)\s+backend\b/i,
    /\bapi\s+(?:error|failure|call|request|response|route)\b/i,
    /\bexpected\s+(?:http\s*)?\d{3}\b/i,
    /\b(exception|nullpointer|sql|sqlexception|stacktrace|servlet|traceparent|controller|repository|jdbc|postgres|postgresql|database|hibernate|jpa)\b/i,
    /^http\s*\d+/i,
    /\bhttp\s+[45]\d{2}\b/i,
    /\bstatus\s*code\s*\d+/i,
  ];

  const hasTechnicalTerms = technicalPatterns.some((pattern) => pattern.test(msg));

  if (hasTechnicalTerms) {
    const extractedStatus = Number(status) || Number(msg.match(/\bhttp\s*([45]\d{2})\b/i)?.[1]) || 0;
    if (STATUS_MESSAGES[extractedStatus]) {
      return STATUS_MESSAGES[extractedStatus];
    }
    if (extractedStatus === 429) {
      return STATUS_MESSAGES[429];
    }
    if (extractedStatus >= 400 && extractedStatus < 500) {
      return 'Yêu cầu không thể thực hiện được. Vui lòng kiểm tra lại thông tin.';
    }
    if (extractedStatus >= 500) {
      return STATUS_MESSAGES[500];
    }
    return STATUS_MESSAGES[0];
  }

  return msg;
}

export function readBackendMessage(body, status = 0) {
  let raw = '';
  if (typeof body === 'string' && body.trim()) {
    raw = body.trim();
  } else if (body && typeof body === 'object') {
    const code = String(body.code || body.errorCode || '').toUpperCase();
    if (code === 'FORBIDDEN_NOT_OWNER') {
      return 'Bạn không có quyền thao tác trên buổi tập của học viên khác.';
    }
    if (code === 'INVALID_ROLE') {
      return 'Tài khoản không đúng vai trò để thực hiện thao tác này.';
    }
    if (code === 'TOKEN_EXPIRED' || code === 'EXPIRED_TOKEN' || code === 'AUTH_EXPIRED') {
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    }
    for (const value of [body.message, body.error, body.detail]) {
      if (typeof value === 'string' && value.trim()) {
        raw = value.trim();
        break;
      }
    }
  }
  return sanitizeBackendMessage(raw, status);
}

export function createApiError(status, body, fallbackMessage) {
  const backendMessage = readBackendMessage(body, status);
  const fallback =
    STATUS_MESSAGES[status] ||
    (status === 429
      ? STATUS_MESSAGES[429]
      : status >= 400 && status < 500
        ? 'Yêu cầu không thể thực hiện được. Vui lòng kiểm tra lại thông tin.'
        : status >= 500
          ? STATUS_MESSAGES[500]
          : STATUS_MESSAGES[0]);
  const cleanFallback =
    fallbackMessage && !/^HTTP\s+\d+$/i.test(fallbackMessage)
      ? sanitizeBackendMessage(fallbackMessage, status) || fallback
      : fallback;
  const message = backendMessage || (status === 0 ? fallback : cleanFallback);
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
  const status = Number(error?.status ?? error?.response?.status) || 0;
  const backendMessage = readBackendMessage(error?.details ?? error?.response?.data, status);
  if (backendMessage) return backendMessage;
  if (error instanceof Error && error.message && !/^HTTP\s+\d+$/i.test(error.message)) {
    const cleanMsg = sanitizeBackendMessage(error.message, status);
    if (cleanMsg) return cleanMsg;
  }
  if (Number.isFinite(status)) {
    if (STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
    if (status === 429) return STATUS_MESSAGES[429];
    if (status >= 400 && status < 500) {
      return 'Yêu cầu không thể thực hiện được. Vui lòng kiểm tra lại thông tin.';
    }
    if (status >= 500) return STATUS_MESSAGES[500];
  }
  return sanitizeBackendMessage(fallback, status) || fallback;
}

/**
 * Trả về thông báo lỗi thân thiện cho người dùng.
 * Mã lỗi kỹ thuật (IDEMPOTENCY_CONFLICT, HTTP 409...) chỉ được ghi vào console, không hiển thị.
 * @param {unknown} error - Lỗi từ API
 * @param {{ language?: string }} options
 * @returns {string}
 */
export function getFriendlyError(error, { language = 'vi' } = {}) {
  const isVi = language === 'vi';
  const status = Number(error?.status ?? error?.response?.status) || 0;
  const rawMsg = String(
    error?.message || error?.details?.message || error?.response?.data?.message || ''
  ).toUpperCase();

  // Ghi mã lỗi gốc vào console để debug
  if (error) console.warn('[getFriendlyError]', error);

  // 409 idempotency — lịch đã tồn tại
  if (
    (status === 409 && rawMsg.includes('IDEMPOTENCY_CONFLICT')) ||
    rawMsg.includes('BOOKING KEY ALREADY')
  ) {
    return isVi
      ? 'Lịch này đã được đặt trước đó. Vui lòng tải lại trang để xem lịch mới nhất.'
      : 'This session was already booked. Please refresh to see the latest schedule.';
  }

  // 409 trùng lịch phòng / HLV
  if (
    status === 409 &&
    (rawMsg.includes('ROOM_CONFLICT') ||
      rawMsg.includes('COACH_CONFLICT') ||
      rawMsg.includes('TRÙNG LỊCH'))
  ) {
    return isVi
      ? 'Khung giờ này đã có lịch khác. Vui lòng chọn ca hoặc ngày khác.'
      : 'This time slot is already taken. Please choose a different slot or date.';
  }

  // 409 khác
  if (status === 409) {
    return isVi
      ? 'Có xung đột dữ liệu. Vui lòng tải lại trang rồi thử lại.'
      : 'A data conflict occurred. Please refresh the page and try again.';
  }

  // Lỗi mạng / timeout
  if (
    !status ||
    rawMsg.includes('NETWORK') ||
    rawMsg.includes('TIMEOUT') ||
    rawMsg.includes('FAILED TO FETCH')
  ) {
    return isVi
      ? 'Không kết nối được. Kiểm tra mạng rồi thử lại.'
      : 'Connection failed. Check your network and try again.';
  }

  // 5xx server error
  if (status >= 500) {
    return isVi
      ? 'Có lỗi xảy ra. Vui lòng thử lại sau.'
      : 'Something went wrong. Please try again later.';
  }

  // Fallback: dùng getErrorMessage để lọc jargon
  return getErrorMessage(error, isVi ? 'Có lỗi xảy ra. Vui lòng thử lại sau.' : 'Something went wrong. Please try again later.');
}
