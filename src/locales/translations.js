

export const translations = {
  vi: {
    // App Brand
    appName: 'HỆ THỐNG QUẢN LÝ TRUNG TÂM THỂ THAO',
    appShort: 'SCMS',
    systemTitle: 'SPORTS CENTER MANAGEMENT SYSTEM',
    
    // Navigation & Roles
    dashboard: 'Tổng quan',
    staff: 'Nhân viên',
    members: 'Thành viên',
    packages: 'Gói thành viên',
    memberships: 'Hội viên',
    classes: 'Lớp học',
    schedule: 'Lịch học',
    bookings: 'Đăng ký lớp',
    attendance: 'Điểm danh',
    trainingProgress: 'Tiến độ tập luyện',
    payments: 'Thanh toán',
    reports: 'Báo cáo',
    auditLogs: 'Nhật ký hệ thống',
    myMembership: 'Hội viên của tôi',
    classCatalog: 'Danh mục lớp học',
    assignedMembers: 'Học viên phân công',
    memberSearch: 'Tìm kiếm thành viên',
    personalProfile: 'Hồ sơ cá nhân',
    settings: 'Cài đặt',
    support: 'Hỗ trợ',
    logout: 'Đăng xuất',
    login: 'Đăng nhập',
    
    // Role names
    roleManager: 'Quản lý trung tâm',
    roleCoach: 'Huấn luyện viên',
    roleReceptionist: 'Lễ tân',
    roleMember: 'Thành viên',
    switchRole: 'Chuyển vai trò thử nghiệm',

    // Language switcher
    language: 'Ngôn ngữ',
    vietnamese: 'Tiếng Việt',
    english: 'English',

    // Statuses - Membership
    none: 'Chưa có gói',
    pending_payment: 'Chờ thanh toán',
    active: 'Đang hoạt động',
    grace_period: 'Chờ gia hạn',
    expired: 'Hết hạn',
    cancelled: 'Đã hủy',

    // Statuses - Payment
    successful: 'Thành công',
    pending: 'Đang xử lý',
    failed: 'Thất bại',
    reversed: 'Đã hoàn tác',

    // Statuses - Class
    draft: 'Bản nháp',
    published: 'Đã xuất bản',
    full: 'Hết chỗ',
    completed: 'Hoàn thành',

    // Statuses - Attendance
    present: 'Có mặt',
    late: 'Đi muộn',
    absent: 'Vắng mặt',
    not_recorded: 'Chưa điểm danh',

    // Actions & Buttons
    saveChanges: 'Lưu thay đổi',
    cancel: 'Hủy',
    confirm: 'Xác nhận',
    search: 'Tìm kiếm',
    noData: 'Không có dữ liệu',
    createNew: 'Tạo mới',
    edit: 'Chỉnh sửa',
    delete: 'Xóa',
    filter: 'Bộ lọc',
    exportReport: 'Xuất báo cáo',
    details: 'Chi tiết',
    bookClass: 'Đăng ký lớp',
    cancelBooking: 'Hủy đăng ký',
    recordPayment: 'Ghi nhận thanh toán',
    correctAttendance: 'Sửa điểm danh',
    addStaff: 'Thêm nhân viên',
    addMember: 'Thêm thành viên',
    createClass: 'Tạo lớp học',
    viewProgress: 'Xem tiến độ',
    viewHistory: 'Xem lịch sử',

    // KPI Labels
    totalMembers: 'Tổng thành viên',
    activeMembers: 'Thành viên hoạt động',
    pendingPaymentCount: 'Hội viên chờ thanh toán',
    gracePeriodCount: 'Chờ gia hạn (72 giờ)',
    todayClasses: 'Lớp học hôm nay',
    totalBookings: 'Tổng lượt đăng ký',
    attendanceRate: 'Tỷ lệ điểm danh',
    totalRevenue: 'Doanh thu tháng',
    successfulTx: 'Giao dịch thành công',
    pendingTx: 'Giao dịch đang xử lý',

    // Messages & Tooltips
    attendanceAuditWarning: 'Thay đổi điểm danh sẽ được lưu trong nhật ký hệ thống.',
    paymentSuccessNotice: 'Thanh toán thành công. Gói thành viên đã được kích hoạt.',
    pendingNotice: 'Giao dịch đang xử lý nên gói thành viên chưa được kích hoạt.',
    bookingDeniedPayment: 'Không thể đăng ký lớp vì gói thành viên của bạn đang chờ thanh toán.',
    bookingDeniedFull: 'Lớp học đã đủ số lượng thành viên.',
    bookingDeniedAlready: 'Bạn đã đăng ký lớp học này.',
    bookingDeniedTier: 'Gói thành viên không bao gồm quyền tham gia lớp này.',
    noPermission: 'Bạn không có quyền truy cập chức năng này.',
    gracePeriodExplanation: 'Thời gian cho phép gia hạn kéo dài đúng 72 giờ sau khi gói hết hạn trước khi dịch vụ tự động bị khóa.',
    correctionReasonRequired: 'Bắt buộc nhập lý do khi sửa điểm danh!',
    
    // Audit Log Headers
    timestamp: 'Thời gian',
    actor: 'Người thực hiện',
    role: 'Vai trò',
    action: 'Hành động',
    target: 'Đối tượng tác động',
    previousValue: 'Giá trị trước',
    newValue: 'Giá trị sau',
    reason: 'Lý do',

    // Form labels
    fullName: 'Họ và tên',
    email: 'Email',
    phone: 'Số điện thoại',
    package: 'Gói thành viên',
    price: 'Mức giá',
    duration: 'Thời hạn (tháng)',
    method: 'Phương thức thanh toán',
    amount: 'Số tiền',
    notes: 'Ghi chú',
    room: 'Phòng tập',
    coach: 'Huấn luyện viên',
    capacity: 'Sức chứa',
    date: 'Ngày',
    time: 'Giờ',
  },
  en: {
    // App Brand
    appName: 'SPORTS CENTER MANAGEMENT SYSTEM',
    appShort: 'SCMS',
    systemTitle: 'SPORTS CENTER MANAGEMENT SYSTEM',
    
    // Navigation & Roles
    dashboard: 'Dashboard',
    staff: 'Staff',
    members: 'Members',
    packages: 'Membership Packages',
    memberships: 'Memberships',
    classes: 'Classes',
    schedule: 'Schedule',
    bookings: 'Class Bookings',
    attendance: 'Attendance',
    trainingProgress: 'Training Progress',
    payments: 'Payments',
    reports: 'Reports',
    auditLogs: 'Audit Logs',
    myMembership: 'My Membership',
    classCatalog: 'Class Catalog',
    assignedMembers: 'Assigned Members',
    memberSearch: 'Member Search',
    personalProfile: 'Personal Profile',
    settings: 'Settings',
    support: 'Support',
    logout: 'Log Out',
    login: 'Log In',

    // Role names
    roleManager: 'Center Manager',
    roleCoach: 'Coach',
    roleReceptionist: 'Receptionist',
    roleMember: 'Member',
    switchRole: 'Switch Simulation Role',

    // Language switcher
    language: 'Language',
    vietnamese: 'Tiếng Việt',
    english: 'English',

    // Statuses - Membership
    none: 'No Package',
    pending_payment: 'Pending Payment',
    active: 'Active',
    grace_period: 'Grace Period',
    expired: 'Expired',
    cancelled: 'Cancelled',

    // Statuses - Payment
    successful: 'Successful',
    pending: 'Pending',
    failed: 'Failed',
    reversed: 'Reversed',

    // Statuses - Class
    draft: 'Draft',
    published: 'Published',
    full: 'Full',
    completed: 'Completed',

    // Statuses - Attendance
    present: 'Present',
    late: 'Late',
    absent: 'Absent',
    not_recorded: 'Not Recorded',

    // Actions & Buttons
    saveChanges: 'Save Changes',
    cancel: 'Cancel',
    confirm: 'Confirm',
    search: 'Search',
    noData: 'No Data Available',
    createNew: 'Create New',
    edit: 'Edit',
    delete: 'Delete',
    filter: 'Filter',
    exportReport: 'Export Report',
    details: 'Details',
    bookClass: 'Book Class',
    cancelBooking: 'Cancel Booking',
    recordPayment: 'Record Payment',
    correctAttendance: 'Edit Attendance',
    addStaff: 'Add Staff',
    addMember: 'Add Member',
    createClass: 'Create Class',
    viewProgress: 'View Progress',
    viewHistory: 'View History',

    // KPI Labels
    totalMembers: 'Total Members',
    activeMembers: 'Active Members',
    pendingPaymentCount: 'Awaiting Payment',
    gracePeriodCount: 'In Grace Period (72h)',
    todayClasses: 'Classes Today',
    totalBookings: 'Total Bookings',
    attendanceRate: 'Attendance Rate',
    totalRevenue: 'Monthly Revenue',
    successfulTx: 'Successful Transactions',
    pendingTx: 'Pending Transactions',

    // Messages & Tooltips
    attendanceAuditWarning: 'This attendance change will be recorded in the audit log.',
    paymentSuccessNotice: 'Payment successful. The membership has been activated.',
    pendingNotice: 'The transaction is still pending, so the membership has not been activated.',
    bookingDeniedPayment: 'You cannot book this class because your membership is awaiting payment.',
    bookingDeniedFull: 'This class has reached its maximum capacity.',
    bookingDeniedAlready: 'You have already booked this class.',
    bookingDeniedTier: 'Your membership package does not include access to this class.',
    noPermission: 'You do not have permission to access this feature.',
    gracePeriodExplanation: 'Grace Period lasts exactly 72 hours after package expiration before locking service.',
    correctionReasonRequired: 'Correction reason is mandatory when modifying attendance!',

    // Audit Log Headers
    timestamp: 'Timestamp',
    actor: 'Actor',
    role: 'Role',
    action: 'Action',
    target: 'Impacted Target',
    previousValue: 'Previous Value',
    newValue: 'New Value',
    reason: 'Reason',

    // Form labels
    fullName: 'Full Name',
    email: 'Email',
    phone: 'Phone Number',
    package: 'Membership Package',
    price: 'Price',
    duration: 'Duration (months)',
    method: 'Payment Method',
    amount: 'Amount',
    notes: 'Notes',
    room: 'Room',
    coach: 'Coach',
    capacity: 'Capacity',
    date: 'Date',
    time: 'Time',
  }
};

export const formatCurrency = (amount, lang = 'vi') => {
  const value = Number(amount || 0);
  const formatted = new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
    maximumFractionDigits: 0
  }).format(value);

  return lang === 'vi' ? `${formatted} ₫` : `${formatted} VND`;
};

export const formatDate = (dateStr, lang = 'vi') => {
  if (!dateStr) return '';
  const dateOnly = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  if (lang === 'vi') {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } else {
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
};

export const formatDateTime = (dateTimeStr, lang = 'vi') => {
  if (!dateTimeStr) return '';
  const match = String(dateTimeStr).match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (!match) return formatDate(dateTimeStr, lang);
  return lang === 'vi'
    ? `${formatDate(match[1], lang)} ${match[2]}`
    : `${formatDate(match[1], lang)}, ${match[2]}`;
};
