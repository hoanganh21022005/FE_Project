

export const translations = {
  vi: {
    // App Brand
    appName: 'HỆ THỐNG QUẢN LÝ TRUNG TÂM THỂ THAO',
    appShort: 'VIBE Sport',
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
    feedback: 'Đánh giá & Feedback',
    trainingProgress: 'Tiến độ tập luyện',
    payments: 'Thanh toán',
    reports: 'Báo cáo',
    auditLogs: 'Nhật ký hệ thống',
    myMembership: 'Gói hội viên của tôi',
    classCatalog: 'Đăng ký khóa học',
    assignedMembers: 'Học viên phân công',
    memberSearch: 'Tìm kiếm thành viên',
    personalProfile: 'Hồ sơ cá nhân',
    settings: 'Cài đặt',
    support: 'Hỗ trợ',
    logout: 'Đăng xuất',
    login: 'Đăng nhập',
    
    // Role names
    roleAdmin: 'Quản trị viên',
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
    courseCatalogTitle: 'Chọn khóa học của bạn', courseCatalogIntro: 'Khám phá các môn thể thao, so sánh học phí và chọn lớp phù hợp.',
    courseCatalogTrial: 'Học thử miễn phí', courseCatalogQuiz: 'Chọn môn giúp mình',
    courseCatalogGroupFit: 'Phù hợp nếu bạn thích học cùng nhóm và tối ưu chi phí.', courseCatalogCoachFit: 'Phù hợp nếu bạn muốn tiến bộ nhanh cùng coach riêng.',
    courseCatalogStartingAt: 'Từ', courseCatalogCompare: 'So sánh 2 gói', courseCatalogSearch: 'Tìm môn thể thao', courseCatalogSort: 'Sắp xếp',
    courseCatalogOpenFirst: 'Có lớp trước', courseCatalogPriceLow: 'Giá thấp đến cao', courseCatalogPopular: 'Phổ biến nhất', courseCatalogClear: 'Xóa bộ lọc',
    courseCatalogOpenClasses: 'lớp đang mở', courseCatalogSeatsLeft: 'Còn {count} chỗ', courseCatalogNoClasses: 'Chưa có lớp',
    courseCatalogNotify: 'Báo tôi khi có lớp', courseCatalogNotifySaved: 'Đã lưu nhắc nhở trên thiết bị này.',
    courseCatalogUpdatedAt: 'Cập nhật lúc {time}', courseCatalogLoading: 'Đang tải dữ liệu…', courseCatalogLoadError: 'Không tải được dữ liệu. Vui lòng thử lại.',
    courseCatalogChoose: 'Chọn lớp', courseCatalogNoClassesTitle: 'Chưa có lớp đang mở cho môn này',
    courseCatalogOtherSports: 'Xem môn khác đang có lớp', courseCatalogPolicy: 'Chính sách bảo lưu, hoàn phí và đổi lớp',
    courseCatalogLevel: 'Cấp độ', courseCatalogSchedule: 'Lịch học', courseCatalogLocation: 'Địa điểm',
    courseCatalogQuizTitle: 'Tìm môn phù hợp với bạn', courseCatalogGoal: 'Mục tiêu của bạn?', courseCatalogFitness: 'Mức vận động hiện tại?',
    courseCatalogBudget: 'Ngân sách ưu tiên?', courseCatalogHealth: 'Sức khỏe', courseCatalogWeight: 'Giảm cân',
    courseCatalogCompetition: 'Thi đấu', courseCatalogFun: 'Giải trí', courseCatalogBeginner: 'Mới bắt đầu',
    courseCatalogActive: 'Đã vận động thường xuyên', courseCatalogBudgetLow: 'Tiết kiệm', courseCatalogBudgetAny: 'Linh hoạt',
    courseCatalogGetSuggestion: 'Xem gợi ý', courseCatalogSuggestion: 'Môn gợi ý cho bạn', courseCatalogCompareTitle: 'So sánh gói học',
    courseCatalogSessions: 'Số buổi', courseCatalogDuration: 'Thời lượng', courseCatalogCapacity: 'Sĩ số', courseCatalogValidity: 'Hạn dùng',
    courseCatalogSelected: 'Đang chọn', courseCatalogViewClasses: 'Xem lớp', courseCatalogErrorRetry: 'Thử lại',
    courseCatalogDismiss: 'Đóng', courseCatalogTrialNote: 'Liên hệ trung tâm để đặt lịch học thử.',
    courseCatalogClassOpened: 'Lớp đang mở', courseCatalogIndicativeTuition: 'Học phí tham khảo', courseCatalogRefresh: 'Làm mới dữ liệu',
    courseCatalogCoachPending: 'HLV chưa phân công', courseCatalogSpotsOpen: 'chỗ trống', courseCatalogSchedulePending: 'Chưa có lịch',
    courseCatalogLocationPending: 'Địa điểm chưa cập nhật', courseCatalogClassFull: 'Đã đủ chỗ', courseCatalogFilterTraining: 'Luyện tập',
    courseCatalogAll: 'Tất cả', courseCatalogTeam: 'Đồng đội', courseCatalogIndividual: 'Cá nhân', courseCatalogSetting: 'Không gian',
    courseCatalogIndoorOutdoor: 'Trong/ngoài trời', courseCatalogIndoor: 'Trong nhà', courseCatalogOutdoor: 'Ngoài trời',
    courseCatalogPrice: 'Giá', courseCatalogAnyPrice: 'Mọi mức', courseCatalogPriceUpTo: 'Đến 1.200.000đ', courseCatalogPriceOver: 'Trên 1.200.000đ',
    courseCatalogSportGroup: 'Chọn môn thể thao', courseCatalogNoMatches: 'Không tìm thấy môn phù hợp.', courseCatalogFitReason: 'Gợi ý dựa trên mục tiêu và lựa chọn của bạn.',
    courseCatalogConfirmClass: 'Xác nhận chọn lớp', courseCatalogCancel: 'Để sau', courseCatalogSubmit: 'Gửi đăng ký', courseCatalogDetails: 'Xem chi tiết',
    courseCatalogDurationAdvanced: '90 phút/buổi', courseCatalogDurationGroup: 'Theo lịch lớp', courseCatalogValidityAdvanced: '45 ngày', courseCatalogValidityGroup: 'Theo lịch khóa',
    courseCatalogAccountMissing: 'Tài khoản chưa liên kết hồ sơ hội viên.', courseCatalogEnrollmentSuccess: 'Đã gửi đăng ký khóa học.',
    courseCatalogPerSession: '/buổi', courseCatalogFilterTitle: 'Bộ lọc', courseCatalogFilterCount: 'Bộ lọc đang bật: {count}',
    courseCatalogTrainingForm: 'Hình thức', courseCatalogResetFilters: 'Xóa bộ lọc', courseCatalogResultCount: 'Hiển thị {count} môn',
    courseCatalogNotifyAllTitle: 'Trung tâm chưa mở lớp {tier} nào.', courseCatalogNotifyAllText: 'Bật thông báo để biết ngay khi có lịch mới.',
    courseCatalogNotifyAllButton: 'Báo tôi khi có lớp (tất cả môn)', courseCatalogNotificationOn: 'Đã bật thông báo',
    courseCatalogOtherClassSuggestion: 'Môn khác đang có lớp: {sports}', courseCatalogAdvancedSuggestion: 'Gói Advanced đang có lớp {sport}. Xem ngay',
    courseCatalogClassError: 'Không tải được danh sách lớp. Vui lòng thử lại.', courseCatalogLoadingClasses: 'Đang tải lớp học…',
    courseCatalogDemo: 'Xem trạng thái demo', courseCatalogDemoLive: 'Dữ liệu thật', courseCatalogDemoEmpty: 'Không có lớp',
    courseCatalogDemoMixed: 'Lớp còn chỗ / sắp đầy / đã đầy', courseCatalogDemoLoading: 'Đang tải', courseCatalogDemoError: 'Lỗi API',
    courseCatalogConsultTitle: 'Đăng ký nhận tư vấn / học thử', courseCatalogConsultName: 'Họ và tên', courseCatalogConsultPhone: 'Số điện thoại',
    courseCatalogConsultSubmit: 'Gửi yêu cầu tư vấn', courseCatalogConsultSaved: 'Đã lưu yêu cầu trên thiết bị này. Trung tâm sẽ liên hệ khi kết nối được.',
    courseCatalogWaitlist: 'Vào danh sách chờ', courseCatalogWaitlistSaved: 'Đã lưu yêu cầu vào danh sách chờ trên thiết bị này.',
    courseCatalogNoClassHelp: 'Bạn có thể bật thông báo hoặc xem gợi ý lớp đang mở bên dưới.', courseCatalogClassCapacity: 'Sức chứa',
    courseCatalogConsultLocalNote: 'Yêu cầu sẽ được lưu trên thiết bị này vì hiện chưa có API gửi đăng ký tư vấn.',
    
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
    appShort: 'VIBE Sport',
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
    feedback: 'Class Feedback',
    trainingProgress: 'Training Progress',
    payments: 'Payments',
    reports: 'Reports',
    auditLogs: 'Audit Logs',
    myMembership: 'My Membership',
    classCatalog: 'Course Registration',
    assignedMembers: 'Assigned Members',
    memberSearch: 'Member Search',
    personalProfile: 'Personal Profile',
    settings: 'Settings',
    support: 'Support',
    logout: 'Log Out',
    login: 'Log In',

    // Role names
    roleAdmin: 'System Administrator',
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
    courseCatalogTitle: 'Choose your course', courseCatalogIntro: 'Explore sports, compare tuition and find a class that fits.',
    courseCatalogTrial: 'Free trial', courseCatalogQuiz: 'Help me choose',
    courseCatalogGroupFit: 'For members who enjoy group training and value savings.', courseCatalogCoachFit: 'For members who want faster progress with a personal coach.',
    courseCatalogStartingAt: 'From', courseCatalogCompare: 'Compare plans', courseCatalogSearch: 'Search sports', courseCatalogSort: 'Sort',
    courseCatalogOpenFirst: 'Classes available first', courseCatalogPriceLow: 'Price: low to high', courseCatalogPopular: 'Most popular', courseCatalogClear: 'Clear filters',
    courseCatalogOpenClasses: 'open classes', courseCatalogSeatsLeft: '{count} spots left', courseCatalogNoClasses: 'No classes yet',
    courseCatalogNotify: 'Notify me when available', courseCatalogNotifySaved: 'Reminder saved on this device.',
    courseCatalogUpdatedAt: 'Updated at {time}', courseCatalogLoading: 'Loading…', courseCatalogLoadError: 'Could not load data. Please try again.',
    courseCatalogChoose: 'Choose class', courseCatalogNoClassesTitle: 'No open class for this sport yet',
    courseCatalogOtherSports: 'See other sports with open classes', courseCatalogPolicy: 'Policies for holds, refunds and class changes',
    courseCatalogLevel: 'Level', courseCatalogSchedule: 'Schedule', courseCatalogLocation: 'Location',
    courseCatalogQuizTitle: 'Find a sport that fits you', courseCatalogGoal: 'What is your goal?', courseCatalogFitness: 'Your current activity level?',
    courseCatalogBudget: 'Preferred budget?', courseCatalogHealth: 'Fitness', courseCatalogWeight: 'Weight loss',
    courseCatalogCompetition: 'Competition', courseCatalogFun: 'Recreation', courseCatalogBeginner: 'Beginner',
    courseCatalogActive: 'Active regularly', courseCatalogBudgetLow: 'Budget friendly', courseCatalogBudgetAny: 'Flexible',
    courseCatalogGetSuggestion: 'Show suggestions', courseCatalogSuggestion: 'Suggested for you', courseCatalogCompareTitle: 'Compare plans',
    courseCatalogSessions: 'Sessions', courseCatalogDuration: 'Duration', courseCatalogCapacity: 'Class size', courseCatalogValidity: 'Validity',
    courseCatalogSelected: 'Selected', courseCatalogViewClasses: 'View classes', courseCatalogErrorRetry: 'Retry',
    courseCatalogDismiss: 'Close', courseCatalogTrialNote: 'Contact the center to book a trial session.',
    courseCatalogClassOpened: 'Available classes', courseCatalogIndicativeTuition: 'Indicative tuition', courseCatalogRefresh: 'Refresh data',
    courseCatalogCoachPending: 'Coach to be assigned', courseCatalogSpotsOpen: 'spots left', courseCatalogSchedulePending: 'Schedule pending',
    courseCatalogLocationPending: 'Location pending', courseCatalogClassFull: 'Full', courseCatalogFilterTraining: 'Training',
    courseCatalogAll: 'All', courseCatalogTeam: 'Group', courseCatalogIndividual: 'Individual', courseCatalogSetting: 'Setting',
    courseCatalogIndoorOutdoor: 'Indoor/outdoor', courseCatalogIndoor: 'Indoor', courseCatalogOutdoor: 'Outdoor',
    courseCatalogPrice: 'Price', courseCatalogAnyPrice: 'Any', courseCatalogPriceUpTo: 'Up to 1,200,000đ', courseCatalogPriceOver: 'Over 1,200,000đ',
    courseCatalogSportGroup: 'Choose a sport', courseCatalogNoMatches: 'No sports match these filters.', courseCatalogFitReason: 'Suggested based on your goals and preferences.',
    courseCatalogConfirmClass: 'Confirm class selection', courseCatalogCancel: 'Cancel', courseCatalogSubmit: 'Submit enrollment', courseCatalogDetails: 'Details',
    courseCatalogDurationAdvanced: '90 min/session', courseCatalogDurationGroup: 'Class schedule', courseCatalogValidityAdvanced: '45 days', courseCatalogValidityGroup: 'Course schedule',
    courseCatalogAccountMissing: 'This account is not linked to a member profile.', courseCatalogEnrollmentSuccess: 'Enrollment submitted.',
    courseCatalogPerSession: '/session', courseCatalogFilterTitle: 'Filters', courseCatalogFilterCount: 'Filters active: {count}',
    courseCatalogTrainingForm: 'Format', courseCatalogResetFilters: 'Clear filters', courseCatalogResultCount: 'Showing {count} sports',
    courseCatalogNotifyAllTitle: 'The center has no {tier} classes open yet.', courseCatalogNotifyAllText: 'Turn on notifications to hear when a schedule is published.',
    courseCatalogNotifyAllButton: 'Notify me when any class opens', courseCatalogNotificationOn: 'Notifications on',
    courseCatalogOtherClassSuggestion: 'Other sports with open classes: {sports}', courseCatalogAdvancedSuggestion: 'Advanced has an open {sport} class. View it',
    courseCatalogClassError: 'Could not load classes. Please try again.', courseCatalogLoadingClasses: 'Loading classes…',
    courseCatalogDemo: 'Preview states', courseCatalogDemoLive: 'Live data', courseCatalogDemoEmpty: 'No classes',
    courseCatalogDemoMixed: 'Available / nearly full / full', courseCatalogDemoLoading: 'Loading', courseCatalogDemoError: 'API error',
    courseCatalogConsultTitle: 'Request advice / a trial session', courseCatalogConsultName: 'Full name', courseCatalogConsultPhone: 'Phone number',
    courseCatalogConsultSubmit: 'Send consultation request', courseCatalogConsultSaved: 'Request saved on this device. The center can contact you when connected.',
    courseCatalogWaitlist: 'Join waitlist', courseCatalogWaitlistSaved: 'Waitlist request saved on this device.',
    courseCatalogNoClassHelp: 'Turn on notifications or explore the open class suggestions below.', courseCatalogClassCapacity: 'Capacity',
    courseCatalogConsultLocalNote: 'The request is saved on this device because no consultation API is available yet.',

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
