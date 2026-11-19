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

// Bảng dịch mã lỗi Backend dùng chung (vi/en). Mỗi mã có chữ mặc định; các màn có chữ riêng
// theo ngữ cảnh khai báo trong CONTEXT_CODE_TEXT bên dưới và tra qua translateErrorCode.
export const ERROR_CODE_TEXT = {
  NORMAL_CASH_COUNTER_ONLY: {
    vi: 'Lớp Normal chỉ nhận tiền mặt tại quầy lễ tân. Vui lòng thanh toán bằng VNPay hoặc đến quầy để đăng ký.',
    en: 'Normal classes accept cash at the reception counter only. Pay with VNPay or visit the counter to register.',
  },
  LOBBY_CHECKIN_DISABLED: {
    vi: 'Check-in thủ công tại quầy hiện đã tắt. Vui lòng quét mã QR theo buổi học.',
    en: 'Manual check-in at the counter is turned off. Please scan the session QR code.',
  },
  SESSION_REQUIRED: {
    vi: 'Thiếu mã buổi học. Vui lòng chọn buổi học trước khi quét mã.',
    en: 'The session is missing. Select a session before scanning the code.',
  },
  NORMAL_NOT_STARTED: {
    vi: 'Lớp học chưa khai giảng nên chưa thể thực hiện thao tác này.',
    en: 'The class has not started yet, so this action is not available.',
  },
  ATTENDANCE_WINDOW_CLOSED: {
    vi: 'Đã hết thời gian điểm danh cho buổi học này.',
    en: 'The attendance window for this session has closed.',
  },
  NORMAL_PROPOSAL_STALE: {
    vi: 'Đề xuất đã thay đổi. Vui lòng tải lại để xem phiên bản mới nhất.',
    en: 'The proposal has changed. Reload to see the latest version.',
  },
  NORMAL_VERSION_STALE: {
    vi: 'Thông tin lớp đã thay đổi. Vui lòng tải lại rồi thử lại.',
    en: 'The class information has changed. Reload and try again.',
  },
  NORMAL_CHANGE_PENDING: {
    vi: 'Lớp đang có một đề xuất thay đổi chưa xử lý xong.',
    en: 'This class has a change proposal that is not resolved yet.',
  },
  NORMAL_CHOICE_ALREADY_RECORDED: {
    vi: 'Bạn đã chọn khác cho đề xuất này trước đó.',
    en: 'You already recorded a different choice for this proposal.',
  },
  MEMBER_RESPONSES_PENDING: {
    vi: 'Vẫn còn học viên chưa phản hồi đề xuất. Không phản hồi không được tính là đồng ý.',
    en: 'Some members have not responded to the proposal. No response does not count as agreement.',
  },
  REFUND_VERSION_STALE: {
    vi: 'Hồ sơ hoàn tiền vừa được cập nhật. Vui lòng tải lại rồi thử lại.',
    en: 'The refund record was just updated. Reload and try again.',
  },
  REFUND_CLAIM_EXISTS: {
    vi: 'Hồ sơ này đã có giao dịch chuyển khoản đang xử lý. Cần đối soát trước khi nhận lại.',
    en: 'This record already has a bank transfer in progress. Reconcile it before claiming again.',
  },
  REFUND_APPROVAL_REQUIRED: {
    vi: 'Hồ sơ hoàn tiền chưa được duyệt tài khoản nhận.',
    en: 'The refund record has no approved receiving account yet.',
  },
  ATTEMPT_NOT_EDITABLE: {
    vi: 'Giao dịch chuyển khoản này không còn chỉnh sửa được.',
    en: 'This bank transfer can no longer be edited.',
  },
  REFUND_AMOUNT_MISMATCH: {
    vi: 'Số tiền phải đúng bằng số tiền hoàn đã duyệt (VND).',
    en: 'The amount must equal the approved refund amount (VND).',
  },
  REFUND_TIME_INVALID: {
    vi: 'Thời điểm chuyển khoản phải nằm giữa lúc nhận việc và hiện tại.',
    en: 'The transfer time must be between when the job was claimed and now.',
  },
  BANK_REFERENCE_REUSED: {
    vi: 'Mã tham chiếu chuyển khoản này đã được dùng cho giao dịch khác.',
    en: 'This bank reference was already used for another transfer.',
  },
  DOCUMENT_TYPE_INVALID: {
    vi: 'Chứng từ phải là ảnh PNG, JPEG hoặc tệp PDF.',
    en: 'The document must be a PNG, JPEG or PDF file.',
  },
  DOCUMENT_SIZE_INVALID: {
    vi: 'Chứng từ phải lớn hơn 0 và tối đa 5 MB.',
    en: 'The document must be larger than 0 and at most 5 MB.',
  },
  RECEIVER_INVALID: {
    vi: 'Thông tin tài khoản nhận chưa hợp lệ. Số tài khoản gồm 4 đến 40 chữ cái hoặc chữ số.',
    en: 'The receiving account details are invalid. The account number has 4 to 40 letters or digits.',
  },
  REFUND_BANK_ATTEMPT_EXISTS: {
    vi: 'Khoản này đã có giao dịch chuyển khoản, không thể đổi tài khoản nhận.',
    en: 'This refund already has a bank transfer, so the receiving account cannot be changed.',
  },
  RESULT_CONTENT_NOT_OPEN: {
    vi: 'Buổi học chưa kết thúc, chưa thể sửa nhận xét.',
    en: 'The session has not ended, so the comment cannot be edited yet.',
  },
  RESULT_CONTENT_DEADLINE_PASSED: {
    vi: 'Đã hết hạn sửa nhận xét của buổi học này.',
    en: 'The deadline to edit this session comment has passed.',
  },
  RESULT_CONTENT_FORBIDDEN: {
    vi: 'Chỉ Coach được giao buổi học và là người ghi nhận xét mới được sửa.',
    en: 'Only the assigned Coach who wrote the comment can edit it.',
  },
  CLASS_FULL: { vi: 'Lớp đã đủ chỗ.', en: 'The class is full.' },
  ALREADY_ENROLLED: {
    vi: 'Bạn đã đăng ký lớp này.',
    en: 'You are already enrolled in this class.',
  },
  SCHEDULE_CONFLICT: {
    vi: 'Lịch học bị trùng với lịch khác. Vui lòng chọn lớp hoặc khung giờ khác.',
    en: 'This schedule overlaps another one. Choose a different class or time slot.',
  },
  NORMAL_REGISTRATION_CLOSED: {
    vi: 'Lớp đã đóng đăng ký.',
    en: 'Registration for this class is closed.',
  },
  BOOKING_BLOCKED: {
    vi: 'Tài khoản đang bị tạm khóa đặt lịch. Vui lòng liên hệ quầy lễ tân.',
    en: 'Booking is temporarily blocked for this account. Please contact the reception counter.',
  },
  HOLIDAY_BLOCKED: {
    vi: 'Ngày này là ngày nghỉ của trung tâm.',
    en: 'This date is a center holiday.',
  },
  // Mã thêm theo contract hạn và quyền thao tác (19/11/2026).
  CANCEL_TOO_LATE: {
    vi: 'Đã quá hạn hủy buổi tập này.',
    en: 'The cancellation deadline for this session has passed.',
  },
  ADVANCED_BOOKING_TOO_LATE: {
    vi: 'Đã quá hạn đặt buổi tập Advanced này.',
    en: 'The booking deadline for this Advanced session has passed.',
  },
  NORMAL_OPENING_TOO_LATE: {
    vi: 'Đã quá hạn xác nhận khai giảng lớp này.',
    en: 'The deadline to confirm this class opening has passed.',
  },
  REGISTRATION_CONFIRMATION_EXPIRED: {
    vi: 'Đã hết hạn xác nhận mua gói của yêu cầu này.',
    en: 'The purchase confirmation window for this request has expired.',
  },
  PROPOSAL_EXPIRED: {
    vi: 'Đề xuất đã hết hạn phản hồi.',
    en: 'This proposal has expired.',
  },
  SESSION_ALREADY_ATTENDED: {
    vi: 'Buổi tập đã được điểm danh nên không thể hủy.',
    en: 'Attendance was already recorded for this session, so it cannot be cancelled.',
  },
  SESSION_ALREADY_CANCELLED: {
    vi: 'Buổi tập này đã được hủy trước đó.',
    en: 'This session was already cancelled.',
  },
  SESSION_HISTORY_IMMUTABLE: {
    vi: 'Buổi tập đã có lịch sử ghi nhận nên không thể thay đổi.',
    en: 'This session already has recorded history, so it cannot be changed.',
  },
  SUBSCRIPTION_LINK_REQUIRED: {
    vi: 'Buổi tập chưa gắn với gói của bạn nên chưa thể hủy hoàn credit.',
    en: 'This session is not linked to your package, so it cannot be cancelled with a refund.',
  },
  CREDIT_ALREADY_RETURNED: {
    vi: 'Credit của buổi tập này đã được hoàn trước đó.',
    en: 'The credit for this session was already returned.',
  },
  SESSION_COMPLETED: {
    vi: 'Buổi tập đã hoàn thành nên không thể thực hiện thao tác này.',
    en: 'This session is already completed, so this action is not available.',
  },
  PRIVATE_SESSION_REQUIRED: {
    vi: 'Thao tác này chỉ áp dụng cho buổi tập 1:1.',
    en: 'This action only applies to one-on-one sessions.',
  },
  CHECKIN_WINDOW_CLOSED: {
    vi: 'Đã hết thời gian check-in cho buổi học này.',
    en: 'The check-in window for this session has closed.',
  },
  SESSION_NOT_HELD: {
    vi: 'Buổi tập không diễn ra hoặc đã bị hủy.',
    en: 'Session was not held or was cancelled.',
  },
  SESSION_TIME_REQUIRED: {
    vi: 'Buổi tập chưa có thời gian kết thúc hợp lệ.',
    en: 'Session end time is required.',
  },
  COACH_REQUIRED: {
    vi: 'Cần có Coach phụ trách trước khi thực hiện thao tác này.',
    en: 'A responsible Coach is required before this action.',
  },
  WAITLIST_FULL: {
    vi: 'Danh sách chờ đã đầy.',
    en: 'The waitlist is full.',
  },
  WAITLIST_NOT_READY: {
    vi: 'Danh sách chờ của lớp này chưa sẵn sàng.',
    en: 'The waitlist for this class is not ready yet.',
  },
  LAST_ADMIN_REQUIRED: {
    vi: 'Hệ thống phải còn ít nhất một Admin đang hoạt động nên không thể thực hiện thay đổi này.',
    en: 'At least one active Admin must remain, so this change cannot be made.',
  },
  INVALID_PERMISSION_IDS: {
    vi: 'Danh sách quyền gửi lên có mã không hợp lệ. Vui lòng tải lại rồi thử lại.',
    en: 'The submitted permission list contains invalid IDs. Reload and try again.',
  },
};

// Chữ riêng theo ngữ cảnh của từng màn. Mã không có ở đây dùng chữ mặc định ở ERROR_CODE_TEXT.
export const CONTEXT_CODE_TEXT = {
  attendance: {
    NORMAL_NOT_STARTED: {
      vi: 'Lớp học chưa khai giảng nên chưa thể điểm danh.',
      en: 'This class has not started yet, so attendance cannot be recorded.',
    },
  },
  resultContent: {
    RESULT_CONTENT_NOT_OPEN: {
      vi: 'Buổi tập chưa kết thúc nên chưa thể sửa nhận xét.',
      en: 'Session has not ended yet.',
    },
    RESULT_CONTENT_DEADLINE_PASSED: {
      vi: 'Đã hết hạn sửa nhận xét (chỉ được sửa trước 00:00 ngày hôm sau).',
      en: 'Edit window has expired (must be edited before 00:00 the next day).',
    },
    RESULT_CONTENT_FORBIDDEN: {
      vi: 'Chỉ huấn luyện viên được giao buổi tập và là tác giả bản ghi mới có quyền sửa nhận xét này.',
      en: 'Only the assigned coach who authored this record can edit it.',
    },
    RESULT_CONTENT_REQUIRED: {
      vi: 'Nhận xét không được để trống.',
      en: 'Comment cannot be empty.',
    },
    NORMAL_NOT_STARTED: {
      vi: 'Lớp Normal chưa khai giảng nên chưa thể sửa nhận xét.',
      en: 'Normal class has not started yet.',
    },
    ATTENDANCE_SUPERSEDED: {
      vi: 'Dữ liệu điểm danh của buổi tập đã được thay thế.',
      en: 'Attendance record has been superseded.',
    },
    NOT_YOUR_CLASS: {
      vi: 'Bạn không phụ trách lớp học này.',
      en: 'You are not assigned to this class.',
    },
  },
  proposal: {
    PROPOSAL_EXPIRED: {
      vi: 'Đề xuất đã hết hạn phản hồi. Trạng thái đã được tải lại; hãy nhờ Coach gửi lịch khác.',
      en: 'This proposal has expired. Its status was reloaded; ask your Coach to send another schedule.',
    },
    ROOM_CONFLICT: {
      vi: 'Phòng đã có lịch khác. Trạng thái đã được tải lại; hai bên cần thống nhất phòng hoặc ca khác.',
      en: 'The room is no longer available. State was reloaded; agree on another room or time.',
    },
    COACH_CONFLICT: {
      vi: 'Coach đã bận vào ca này. Trạng thái đã được tải lại; hai bên cần thống nhất lịch khác.',
      en: 'The Coach is unavailable at this time. State was reloaded; agree on another schedule.',
    },
    MEMBER_CONFLICT: {
      vi: 'Bạn đã có lịch tập trùng giờ. Trạng thái đã được tải lại; hãy thống nhất một lịch khác với Coach.',
      en: 'You already have a session at this time. State was reloaded; agree on another schedule with your Coach.',
    },
    OUT_OF_CREDIT: {
      vi: 'Gói Advanced không còn đủ credit cho buổi tập. Credit mới nhất đã được tải lại.',
      en: 'The Advanced package does not have enough credits. The latest credit balance was reloaded.',
    },
    ADVANCED_PACKAGE_EXPIRED: {
      vi: 'Gói Advanced đã hết hạn hoặc buổi tập vượt thời hạn sử dụng. Trạng thái gói đã được tải lại.',
      en: 'The Advanced package has expired or the session is beyond its validity period. Subscription state was reloaded.',
    },
    PRIMARY_COACH_REQUIRED: {
      vi: 'Coach không phù hợp với gói hoặc bộ môn này. Trạng thái đã được tải lại; hãy liên hệ Coach để thống nhất lịch khác.',
      en: 'This Coach is not eligible for the package or subject. State was reloaded; contact your Coach to agree on another schedule.',
    },
    PROPOSAL_STATE_CONFLICT: {
      vi: 'Đề xuất đã được phản hồi trước đó. Trạng thái hiện tại đã được tải lại.',
      en: 'This proposal was already processed. Its current state was reloaded.',
    },
  },
};

// Chữ tiếng Việt của từng mã, dùng cho readBackendMessage.
export const BACKEND_CODE_MESSAGES = Object.fromEntries(
  Object.entries(ERROR_CODE_TEXT).map(([code, text]) => [code, text.vi]),
);

/**
 * Tra chữ của một mã lỗi theo ngôn ngữ ('vi' hoặc 'en'). `context` chọn chữ riêng của màn
 * (xem CONTEXT_CODE_TEXT); không có chữ riêng thì dùng chữ mặc định. Mã lạ trả null.
 */
export function translateErrorCode(code, language = 'vi', context = null) {
  const key = String(code || '').trim().toUpperCase();
  if (!key) return null;
  const entry =
    (context && CONTEXT_CODE_TEXT[context]?.[key]) || ERROR_CODE_TEXT[key] || null;
  if (!entry) return null;
  return language === 'vi' ? entry.vi : entry.en;
}

const errorTextSources = (error) => {
  const details = error?.details ?? error?.response?.data;
  return [
    error?.code,
    error?.message,
    details?.code,
    details?.errorCode,
    details?.message,
    details?.error,
    details?.detail,
  ].filter((value) => typeof value === 'string');
};

/** Mã lỗi (viết hoa) trong `error.code`, `details.code` hoặc `details.errorCode`; rỗng nếu không có. */
export function getErrorCode(error) {
  const details = error?.details ?? error?.response?.data;
  return String(error?.code || details?.code || details?.errorCode || '')
    .trim()
    .toUpperCase();
}

/** Lỗi có nhắc tới `code` ở trường mã hoặc trong câu thông báo (không phân biệt hoa thường). */
export function errorHasCode(error, code) {
  const key = String(code || '').trim().toUpperCase();
  if (!key) return false;
  return errorTextSources(error).some((value) => value.toUpperCase().includes(key));
}

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
