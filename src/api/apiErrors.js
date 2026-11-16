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

export const BACKEND_CODE_MESSAGES = {
  NORMAL_CASH_COUNTER_ONLY:
    'Lớp Normal chỉ nhận tiền mặt tại quầy lễ tân. Vui lòng thanh toán bằng VNPay hoặc đến quầy để đăng ký.',
  LOBBY_CHECKIN_DISABLED:
    'Check-in thủ công tại quầy hiện đã tắt. Vui lòng quét mã QR theo buổi học.',
  SESSION_REQUIRED:
    'Thiếu mã buổi học. Vui lòng chọn buổi học trước khi quét mã.',
  NORMAL_NOT_STARTED:
    'Lớp học chưa khai giảng nên chưa thể thực hiện thao tác này.',
  ATTENDANCE_WINDOW_CLOSED:
    'Đã hết thời gian điểm danh cho buổi học này.',
  NORMAL_PROPOSAL_STALE:
    'Đề xuất đã thay đổi. Vui lòng tải lại để xem phiên bản mới nhất.',
  NORMAL_VERSION_STALE:
    'Thông tin lớp đã thay đổi. Vui lòng tải lại rồi thử lại.',
  NORMAL_CHANGE_PENDING:
    'Lớp đang có một đề xuất thay đổi chưa xử lý xong.',
  NORMAL_CHOICE_ALREADY_RECORDED:
    'Bạn đã chọn khác cho đề xuất này trước đó.',
  MEMBER_RESPONSES_PENDING:
    'Vẫn còn học viên chưa phản hồi đề xuất. Không phản hồi không được tính là đồng ý.',
  REFUND_VERSION_STALE:
    'Hồ sơ hoàn tiền vừa được cập nhật. Vui lòng tải lại rồi thử lại.',
  REFUND_CLAIM_EXISTS:
    'Hồ sơ này đã có giao dịch chuyển khoản đang xử lý. Cần đối soát trước khi nhận lại.',
  REFUND_APPROVAL_REQUIRED:
    'Hồ sơ hoàn tiền chưa được duyệt tài khoản nhận.',
  ATTEMPT_NOT_EDITABLE:
    'Giao dịch chuyển khoản này không còn chỉnh sửa được.',
  REFUND_AMOUNT_MISMATCH:
    'Số tiền phải đúng bằng số tiền hoàn đã duyệt (VND).',
  REFUND_TIME_INVALID:
    'Thời điểm chuyển khoản phải nằm giữa lúc nhận việc và hiện tại.',
  BANK_REFERENCE_REUSED:
    'Mã tham chiếu chuyển khoản này đã được dùng cho giao dịch khác.',
  DOCUMENT_TYPE_INVALID:
    'Chứng từ phải là ảnh PNG, JPEG hoặc tệp PDF.',
  DOCUMENT_SIZE_INVALID:
    'Chứng từ phải lớn hơn 0 và tối đa 5 MB.',
  RECEIVER_INVALID:
    'Thông tin tài khoản nhận chưa hợp lệ. Số tài khoản gồm 4 đến 40 chữ cái hoặc chữ số.',
  REFUND_BANK_ATTEMPT_EXISTS:
    'Khoản này đã có giao dịch chuyển khoản, không thể đổi tài khoản nhận.',
  RESULT_CONTENT_NOT_OPEN:
    'Buổi học chưa kết thúc, chưa thể sửa nhận xét.',
  RESULT_CONTENT_DEADLINE_PASSED:
    'Đã hết hạn sửa nhận xét của buổi học này.',
  RESULT_CONTENT_FORBIDDEN:
    'Chỉ Coach được giao buổi học và là người ghi nhận xét mới được sửa.',
  CLASS_FULL: 'Lớp đã đủ chỗ.',
  ALREADY_ENROLLED: 'Bạn đã đăng ký lớp này.',
  SCHEDULE_CONFLICT:
    'Lịch học bị trùng với lịch khác. Vui lòng chọn lớp hoặc khung giờ khác.',
  NORMAL_REGISTRATION_CLOSED: 'Lớp đã đóng đăng ký.',
  BOOKING_BLOCKED:
    'Tài khoản đang bị tạm khóa đặt lịch. Vui lòng liên hệ quầy lễ tân.',
  HOLIDAY_BLOCKED: 'Ngày này là ngày nghỉ của trung tâm.',
};

export const BACKEND_FORBIDDEN_MESSAGES = {
  'Financial staff required':
    'Chức năng này chỉ dành cho nhân sự phụ trách tài chính.',
  'Schedule access requires an assigned operational permission':
    'Tài khoản chưa được cấp quyền xem lịch học.',
  'Authentication required':
    'Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.',
  'Authenticated account required':
    'Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.',
  'Account not found': 'Không tìm thấy tài khoản đang đăng nhập.',
  'Authenticated account not found': 'Không tìm thấy tài khoản đang đăng nhập.',
  'Authenticated user account was not found':
    'Không tìm thấy tài khoản đang đăng nhập.',
  'Authenticated member account was not found':
    'Không tìm thấy tài khoản đang đăng nhập.',
  'Account is not Active': 'Tài khoản hiện không ở trạng thái hoạt động.',
  'Active account required': 'Tài khoản hiện không ở trạng thái hoạt động.',
  'Current account permission required':
    'Tài khoản không có quyền thực hiện thao tác này.',
  'Training write permission required':
    'Tài khoản không có quyền ghi nội dung buổi tập.',
  'VIEW_AUDIT_LOG required': 'Tài khoản không có quyền xem nhật ký hệ thống.',
  'VIEW_REPORTS required': 'Tài khoản không có quyền xem báo cáo.',
  'Admin or CenterManager required':
    'Chức năng này chỉ dành cho Admin hoặc Quản lý trung tâm.',
  'Only active Admin with MANAGE_PERMISSIONS may change role permissions':
    'Chỉ Admin đang hoạt động có quyền quản lý phân quyền mới được đổi quyền của vai trò.',
  'Only the assigned Coach may write professional training content':
    'Chỉ Coach được phân công mới được ghi nội dung chuyên môn của buổi tập.',
  'Coach is not assigned to this class':
    'Bạn không được phân công phụ trách lớp này.',
  'Coaches may only view their assigned schedule':
    'Coach chỉ xem được lịch dạy được phân công cho mình.',
  'Members may only view their own schedule':
    'Hội viên chỉ xem được lịch học của chính mình.',
  'Members may only view their own subscriptions':
    'Hội viên chỉ xem được gói của chính mình.',
  'Members may only view their own training plans':
    'Hội viên chỉ xem được kế hoạch tập luyện của chính mình.',
  'Members may only view their own evaluations':
    'Hội viên chỉ xem được đánh giá của chính mình.',
  'Member required': 'Thao tác này chỉ dành cho hội viên.',
  'Member confirmation required': 'Thao tác này chỉ dành cho hội viên.',
  'Member consent required': 'Thao tác này chỉ dành cho hội viên.',
  'Member response required': 'Thao tác này chỉ dành cho hội viên.',
  'Own paid proposal required':
    'Chỉ hội viên đã thanh toán lớp này mới phản hồi được đề xuất.',
  'Proposal belongs to another account':
    'Đề xuất này thuộc tài khoản khác.',
  'Registration owner required':
    'Chỉ người tạo đăng ký mới thực hiện được thao tác này.',
  'Only approved financial work is visible to Receptionist':
    'Lễ tân chỉ xem được các việc hoàn tiền đã được duyệt.',
  'Invoice belongs to another center': 'Dữ liệu này thuộc trung tâm khác.',
  'User is outside the current center scope':
    'Dữ liệu này thuộc trung tâm khác.',
  'Members may only be managed within the current center':
    'Dữ liệu này thuộc trung tâm khác.',
  'Feedback is allowed only for Ongoing or Closed classes':
    'Chỉ được đánh giá lớp đang học hoặc đã kết thúc.',
  'You must be registered or have completed this class to submit feedback':
    'Bạn phải đã đăng ký hoặc hoàn thành lớp này mới gửi được đánh giá.',
  'Only the booked Member may report absence':
    'Chỉ hội viên đã đặt buổi này mới báo nghỉ được.',
  'Insufficient permission to reissue this account password':
    'Bạn không đủ quyền cấp lại mật khẩu cho tài khoản này.',
};

const BACKEND_FORBIDDEN_LOOKUP = Object.fromEntries(
  Object.entries(BACKEND_FORBIDDEN_MESSAGES).map(([k, v]) => [
    k.toLowerCase(),
    v,
  ]),
);

const VIETNAMESE_DIACRITIC_REGEX =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;

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
    const prefixMatch = raw.match(/^([A-Z][A-Z0-9_]{3,}):\s*(.*)$/);
    const resolvedCode = code || (prefixMatch ? prefixMatch[1] : '');
    const strippedText = prefixMatch ? prefixMatch[2].trim() : raw;
    if (resolvedCode && BACKEND_CODE_MESSAGES[resolvedCode]) {
      const isPlainCodeOrNonVi =
        !raw ||
        raw.toUpperCase() === resolvedCode ||
        !VIETNAMESE_DIACRITIC_REGEX.test(strippedText);
      if (isPlainCodeOrNonVi) {
        return BACKEND_CODE_MESSAGES[resolvedCode];
      }
      return sanitizeBackendMessage(strippedText, status);
    }
    if (prefixMatch && VIETNAMESE_DIACRITIC_REGEX.test(strippedText)) {
      return sanitizeBackendMessage(strippedText, status);
    }
    if (!code && !prefixMatch && raw) {
      const forbiddenVi = BACKEND_FORBIDDEN_LOOKUP[raw.toLowerCase()];
      if (forbiddenVi) {
        return forbiddenVi;
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
  const inferredCode =
    typeof body?.code === 'string' && body.code
      ? body.code
      : typeof body?.message === 'string'
        ? body.message.trim().match(/^([A-Z][A-Z0-9_]{3,}):\s*/)?.[1] ?? null
        : null;
  const options = {
    status,
    details: body,
    code: inferredCode,
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
