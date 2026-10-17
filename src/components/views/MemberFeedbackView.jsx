import React, { useState, useMemo, useEffect } from 'react';
import { useSCMS } from '../../context/SCMSContext';
import { CLUB_COURSES } from './MemberAttendanceView';
import { motion, AnimatePresence } from 'motion/react';
import {
  Check,
  X,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Clock
} from 'lucide-react';

/**
 * FIXED SERVER DATE (Asia/Ho_Chi_Minh)
 * Standardized date: 2026-10-14 (Thứ Tư, 14 tháng 10 năm 2026)
 */
const SERVER_TODAY = '2026-10-14';

// Curated high-end appraisal tags (Thay thế tags CSAT thông thường)
const POSITIVE_APPRAISAL_TAGS = [
  'Giáo án chuẩn xác',
  'Cường độ bài tập lý tưởng',
  'Mặt sàn & Ánh sáng hoàn hảo',
  'Theo sát kỹ thuật',
  'Chăm sóc chu đáo',
  'Truyền cảm hứng',
];

const CRITICAL_APPRAISAL_TAGS = [
  'Cần chỉnh lại nhịp độ',
  'Mặt sàn chưa tối ưu',
  'Nhiệt độ phòng chưa chuẩn',
  'Cần hỗ trợ kỹ thuật sâu hơn',
  'Âm thanh hơi ồn',
  'Cần bổ sung dụng cụ bổ trợ',
];

// Thang định danh chuẩn mực VIP
const APPRAISAL_VERDICTS = {
  1: { label: 'Cần điều chỉnh chất lượng', desc: 'Chưa đạt kỳ vọng cơ bản' },
  2: { label: 'Chưa đạt chuẩn mực CLB', desc: 'Cần ban chuyên môn can thiệp' },
  3: { label: 'Đạt yêu cầu cơ bản', desc: 'Buổi tập diễn ra đúng kế hoạch' },
  4: { label: 'Chuẩn mực cao', desc: 'Chất lượng huấn luyện và sân bãi tốt' },
  5: { label: 'Xuất sắc · Vượt kỳ vọng', desc: 'Đẳng cấp huấn luyện và trải nghiệm tuyệt hảo' },
};

export function MemberFeedbackView() {
  const {
    currentUser,
    members,
    feedbacks,
    submitFeedback,
    checkedInCourseSessions,
    showToast,
  } = useSCMS();

  // Active tab: 'pending' (Cần đánh giá) | 'submitted' (Lịch sử của tôi)
  const [activeTab, setActiveTab] = useState('pending');

  // Filter state for submitted reviews tab
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('all');
  const [selectedTimeFilter, setSelectedTimeFilter] = useState('all');

  // Drawer Sheet state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSessionForReview, setActiveSessionForReview] = useState(null);
  const [editingFeedbackId, setEditingFeedbackId] = useState(null);
  const [isThankYouMode, setIsThankYouMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Form states
  const [overallRating, setOverallRating] = useState(0);
  const [coachCriteria, setCoachCriteria] = useState({
    expertise: 5,
    interaction: 5,
    punctuality: 5
  });
  const [facilityCriteria, setFacilityCriteria] = useState({
    court: 5,
    lighting: 5,
    cleanliness: 5
  });
  const [selectedTags, setSelectedTags] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isPrivateContactRequested, setIsPrivateContactRequested] = useState(false);

  // Expanded reviews text & criteria breakdown toggle (reviewId -> boolean)
  const [expandedComments, setExpandedComments] = useState({});
  const [expandedBreakdowns, setExpandedBreakdowns] = useState({});

  // Set page background to unified quiet luxury canvas
  useEffect(() => {
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    const prevBodyBg = document.body.style.backgroundColor;
    document.documentElement.style.backgroundColor = '#F5F2EA';
    document.body.style.backgroundColor = '#F5F2EA';
    return () => {
      document.documentElement.style.backgroundColor = prevHtmlBg;
      document.body.style.backgroundColor = prevBodyBg;
    };
  }, []);

  // ESC key & scroll lock for drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false);
      }
    };
    if (drawerOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [drawerOpen]);

  // Current active member
  const member = useMemo(() => {
    return (
      (members || []).find(
        m =>
          String(m.id) === String(currentUser?.id) ||
          (m.email && currentUser?.email && m.email.toLowerCase() === currentUser.email.toLowerCase())
      ) ||
      currentUser ||
      members?.[0] || { id: 'mem-1', name: 'Bùi Văn Phúc', code: 'MEM-001', tier: 'Black' }
    );
  }, [members, currentUser]);

  /**
   * UNIFIED SESSIONS DERIVATION:
   * Sourced directly from CLUB_COURSES (Single Source of Truth across Attendance & Feedback)
   */
  const { attendedSessions, pendingSessions, submittedReviews } = useMemo(() => {
    const reviewsList = feedbacks || [];

    // Collect completed sessions across active courses
    const allAttended = [];

    // 1. Badminton Course Session 1
    const bdmCourse = CLUB_COURSES.badminton;
    if (bdmCourse?.sessions?.[0]) {
      const s = bdmCourse.sessions[0];
      allAttended.push({
        id: `badminton-session-${s.num}`,
        courseId: 'badminton',
        sessionNum: s.num,
        className: bdmCourse.name,
        discipline: bdmCourse.discipline,
        date: s.date,
        dayVi: 'Thứ Hai, 12/10',
        startTime: s.startTime,
        endTime: s.endTime,
        court: `${s.court} (${s.zone} · Thảm Taraflex)`,
        coach: `${s.coach}`,
        attendanceStatus: s.attendance,
        attendanceNote: s.attendance === 'late' ? 'Đi muộn 10 phút' : 'Có mặt đúng giờ',
        topic: s.topic,
        deadlineDays: 8,
      });
    }

    // 2. Pickleball Course Session 1
    const pkbCourse = CLUB_COURSES.pickleball;
    if (pkbCourse?.sessions?.[0]) {
      const s = pkbCourse.sessions[0];
      allAttended.push({
        id: `pickleball-session-${s.num}`,
        courseId: 'pickleball',
        sessionNum: s.num,
        className: pkbCourse.name,
        discipline: pkbCourse.discipline,
        date: s.date,
        dayVi: 'Thứ Sáu, 09/10',
        startTime: '18:15',
        endTime: '20:00',
        court: `${s.court} · Khu B`,
        coach: `${s.coach}`,
        attendanceStatus: 'late',
        attendanceNote: 'Đi muộn 10 phút',
        topic: s.topic,
        deadlineDays: 5,
      });
    }

    // 3. Dynamically checked-in sessions across all courses (e.g., Archery Session 1 after check-in)
    Object.values(CLUB_COURSES).forEach(course => {
      (course.sessions || []).forEach(s => {
        const sessionKey = `${course.id}-session-${s.num}`;
        const checkInInfo = checkedInCourseSessions?.[sessionKey];
        if (checkInInfo && !allAttended.some(a => a.id === sessionKey)) {
          allAttended.push({
            id: sessionKey,
            courseId: course.id,
            sessionNum: s.num,
            className: course.name,
            discipline: course.discipline,
            date: s.date,
            dayVi: `${s.dayOfWeek}, ${s.date.slice(8, 10)}/${s.date.slice(5, 7)}`,
            startTime: s.startTime,
            endTime: s.endTime,
            court: `${s.court} (${s.zone})`,
            coach: s.coach,
            attendanceStatus: checkInInfo.attendance || 'present',
            attendanceNote: `Có mặt · Điểm danh lúc ${checkInInfo.checkInTime || s.startTime}`,
            topic: s.topic,
            deadlineDays: 7,
          });
        }
      });
    });

    // Match each session against submitted feedbacks
    const submitted = [];
    const pending = [];

    for (const session of allAttended) {
      const existingFb = reviewsList.find(
        f =>
          f.classId === session.id ||
          (f.className === session.className && f.date === session.date) ||
          (f.date === session.date && f.coachName?.includes(session.coach.replace(/^HLV\s+/, '').split(' ')[0]))
      );

      if (existingFb) {
        submitted.push({
          ...existingFb,
          sessionMeta: session,
        });
      } else {
        pending.push(session);
      }
    }

    // Also include any other user reviews in submitted
    for (const fb of reviewsList) {
      if (!submitted.some(s => s.id === fb.id)) {
        submitted.push({
          ...fb,
          sessionMeta: {
            id: fb.classId || `session-${fb.id}`,
            className: fb.className || 'Cầu lông K01 (Nền tảng)',
            date: fb.date || '2026-10-12',
            dayVi: fb.dayVi || 'Thứ Hai, 12/10',
            startTime: fb.startTime || '06:00',
            endTime: fb.endTime || '07:30',
            court: fb.room || 'Sân 02 (Thảm Taraflex)',
            coach: fb.coachName || 'HLV Lê Thị Mai',
          },
        });
      }
    }

    return {
      attendedSessions: allAttended,
      pendingSessions: pending,
      submittedReviews: submitted,
    };
  }, [feedbacks, checkedInCourseSessions]);

  // Average rating calculated from submitted reviews
  const averageRating = useMemo(() => {
    if (submittedReviews.length === 0) return '—';
    const sum = submittedReviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
    return (sum / submittedReviews.length).toFixed(1);
  }, [submittedReviews]);

  // Filtered reviews in Tab 2
  const filteredSubmittedReviews = useMemo(() => {
    const serverDateMs = new Date(`${SERVER_TODAY}T23:59:59`).getTime();
    return submittedReviews.filter(r => {
      if (selectedCourseFilter !== 'all') {
        const nameMatch = (r.className || '').toLowerCase().includes(selectedCourseFilter.toLowerCase());
        if (!nameMatch) return false;
      }
      if (selectedTimeFilter !== 'all' && r.date) {
        const reviewDateMs = new Date(`${r.date}T12:00:00`).getTime();
        if (!Number.isNaN(reviewDateMs)) {
          const diffDays = (serverDateMs - reviewDateMs) / (1000 * 60 * 60 * 24);
          if (selectedTimeFilter === '30days' && diffDays > 30) return false;
          if (selectedTimeFilter === 'semester' && diffDays > 120) return false;
        }
      }
      return true;
    });
  }, [submittedReviews, selectedCourseFilter, selectedTimeFilter]);

  // Open Drawer to create or edit review
  const handleOpenReviewDrawer = (session, existingFeedback = null) => {
    setActiveSessionForReview(session);
    setSubmitError(null);
    setIsThankYouMode(false);

    if (existingFeedback) {
      setEditingFeedbackId(existingFeedback.id);
      setOverallRating(existingFeedback.rating || 5);
      setCoachCriteria({
        expertise: existingFeedback.criteria?.coachBreakdown?.expertise || 5,
        interaction: existingFeedback.criteria?.coachBreakdown?.interaction || 5,
        punctuality: existingFeedback.criteria?.coachBreakdown?.punctuality || 5,
      });
      setFacilityCriteria({
        court: existingFeedback.criteria?.facilityBreakdown?.court || 5,
        lighting: existingFeedback.criteria?.facilityBreakdown?.lighting || 5,
        cleanliness: existingFeedback.criteria?.facilityBreakdown?.cleanliness || 5,
      });
      setSelectedTags(existingFeedback.tags || []);
      setCommentText(existingFeedback.comment || '');
      setIsAnonymous(Boolean(existingFeedback.isAnonymous));
      setIsPrivateContactRequested(Boolean(existingFeedback.isPrivateContactRequested));
    } else {
      setEditingFeedbackId(null);
      setOverallRating(0); // Not chosen yet
      setCoachCriteria({ expertise: 5, interaction: 5, punctuality: 5 });
      setFacilityCriteria({ court: 5, lighting: 5, cleanliness: 5 });
      setSelectedTags([]);
      setCommentText('');
      setIsAnonymous(false);
      setIsPrivateContactRequested(false);
    }

    setDrawerOpen(true);
  };

  // Toggle tag selection
  const handleToggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // Submit Feedback from Drawer
  const handleSubmitReview = async () => {
    if (!overallRating || overallRating === 0) return;
    if (overallRating <= 2 && !commentText.trim()) {
      setSubmitError('Vui lòng cho Giám đốc Chuyên môn biết điều cần cải thiện để đảm bảo chuẩn mực dịch vụ.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        id: editingFeedbackId || `fb-${Date.now()}`,
        classId: activeSessionForReview.id,
        className: activeSessionForReview.className,
        coachName: activeSessionForReview.coach,
        memberId: member.id,
        memberName: member.name,
        rating: overallRating,
        date: activeSessionForReview.date,
        dayVi: activeSessionForReview.dayVi,
        startTime: activeSessionForReview.startTime,
        endTime: activeSessionForReview.endTime,
        room: activeSessionForReview.court,
        criteria: {
          coachQuality: 5,
          facilityQuality: 5,
          intensity: 'Vừa sức',
          coachBreakdown: coachCriteria,
          facilityBreakdown: facilityCriteria,
        },
        tags: selectedTags,
        comment: commentText.trim(),
        isAnonymous,
        isPrivateContactRequested,
        coachReply: editingFeedbackId
          ? submittedReviews.find(r => r.id === editingFeedbackId)?.coachReply
          : 'Chân thành cảm ơn Anh Phúc. Ban chuyên môn và Huấn luyện viên trưởng đã tiếp nhận ghi chú này để hoàn thiện giáo án buổi kế tiếp. Chúc anh có buổi phục hồi thể lực thật tốt!',
        createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      };

      await submitFeedback(payload);
      setIsThankYouMode(true);

    } catch (err) {
      setSubmitError('Không thể lưu bản ghi chép. Vui lòng kiểm tra lại kết nối mạng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle comment expanded in tab 2
  const toggleCommentExpand = (id) => {
    setExpandedComments(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen bg-[#F5F2EA] text-[#15171C] font-['Be_Vietnam_Pro',sans-serif] antialiased selection:bg-[#A8844F]/20 pb-24 sm:pb-16">
      <div className="w-full max-w-[1120px] mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-10">

        {/* ============================================================== */}
        {/* 1. HEADER: Tinh tế, chuẩn mực, không phù phiếm                */}
        {/* ============================================================== */}
        <header className="space-y-2">
          <span className="text-[11px] font-sans font-medium uppercase tracking-[0.14em] text-[#6A675F] block">
            PHẢN HỒI SAU BUỔI TẬP
          </span>
          <h1 className="font-['Newsreader',serif] font-normal text-4xl sm:text-[44px] text-[#15171C] tracking-tight leading-tight">
            Đánh giá & Phản hồi
          </h1>
          <p className="text-sm sm:text-[15px] text-[#6A675F] max-w-2xl font-normal leading-relaxed">
            Ý kiến của bạn giúp chúng tôi nâng chuẩn huấn luyện và hoàn thiện sân bãi.
          </p>
        </header>

        {/* ============================================================== */}
        {/* 2. DẢI CHỈ SỐ: 4 Cột chia đều, đường kẻ dọc 1px hairline       */}
        {/* ============================================================== */}
        <section className="grid grid-cols-2 md:grid-cols-4 border-y border-[rgba(21,23,28,0.12)] py-6 gap-y-6 md:gap-y-0">
          
          {/* Cột 1: Chờ đánh giá (Màu đồng khi > 0) */}
          <div className="px-4 sm:px-6 md:border-r border-[rgba(21,23,28,0.12)] space-y-2">
            <div className={`font-['Newsreader',serif] font-normal text-4xl sm:text-5xl tabular-nums lining-nums leading-none ${pendingSessions.length > 0 ? 'text-[#A8844F]' : 'text-[#15171C]'}`}>
              {pendingSessions.length}
            </div>
            <span className="text-[11px] font-sans font-medium uppercase tracking-[0.14em] text-[#6A675F] block">
              CHỜ ĐÁNH GIÁ
            </span>
          </div>

          {/* Cột 2: Đã gửi */}
          <div className="px-4 sm:px-6 border-l md:border-l-0 md:border-r border-[rgba(21,23,28,0.12)] space-y-2">
            <div className="font-['Newsreader',serif] font-normal text-4xl sm:text-5xl tabular-nums lining-nums leading-none text-[#15171C]">
              {submittedReviews.length}
            </div>
            <span className="text-[11px] font-sans font-medium uppercase tracking-[0.14em] text-[#6A675F] block">
              ĐÃ GỬI
            </span>
          </div>

          {/* Cột 3: Đã tham gia */}
          <div className="px-4 sm:px-6 md:border-r border-[rgba(21,23,28,0.12)] space-y-2">
            <div className="font-['Newsreader',serif] font-normal text-4xl sm:text-5xl tabular-nums lining-nums leading-none text-[#15171C]">
              {attendedSessions.length}
            </div>
            <span className="text-[11px] font-sans font-medium uppercase tracking-[0.14em] text-[#6A675F] block">
              ĐÃ THAM GIA
            </span>
          </div>

          {/* Cột 4: Điểm bạn đã cho */}
          <div className="px-4 sm:px-6 border-l md:border-l-0 border-[rgba(21,23,28,0.12)] space-y-1">
            <div className="font-['Newsreader',serif] font-normal text-4xl sm:text-5xl tabular-nums lining-nums leading-none text-[#15171C]">
              {averageRating}
            </div>
            <div className="text-[11px] text-[#6A675F] font-normal pt-1">
              {submittedReviews.length > 0 ? `trung bình, ${submittedReviews.length} đánh giá` : '—'}
            </div>
            <span className="text-[11px] font-sans font-medium uppercase tracking-[0.14em] text-[#6A675F] block pt-0.5">
              ĐIỂM BẠN ĐÃ CHO
            </span>
          </div>

        </section>

        {/* ============================================================== */}
        {/* 3. TABS: Chữ phẳng, gạch chân đồng 2px                          */}
        {/* ============================================================== */}
        <div className="border-b border-[rgba(21,23,28,0.12)] flex items-center gap-8 text-sm">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`pb-3 cursor-pointer transition-colors relative flex items-center gap-1.5 ${
              activeTab === 'pending'
                ? 'text-[#15171C] font-medium border-b-2 border-[#A8844F] -mb-[1px]'
                : 'text-[#6A675F] hover:text-[#15171C] font-normal'
            }`}
          >
            <span>Cần đánh giá</span>
            <span className="text-xs text-[#6A675F] font-normal">
              ({pendingSessions.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('submitted')}
            className={`pb-3 cursor-pointer transition-colors relative flex items-center gap-1.5 ${
              activeTab === 'submitted'
                ? 'text-[#15171C] font-medium border-b-2 border-[#A8844F] -mb-[1px]'
                : 'text-[#6A675F] hover:text-[#15171C] font-normal'
            }`}
          >
            <span>Lịch sử của tôi</span>
            <span className="text-xs text-[#6A675F] font-normal">
              ({submittedReviews.length})
            </span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* 4. TAB 1: CẦN ĐÁNH GIÁ (Mỗi buổi một hàng phẳng, không card)     */}
        {/* ============================================================== */}
        {activeTab === 'pending' && (
          <div className="space-y-2">
            {pendingSessions.length === 0 ? (
              <div className="py-20 text-center space-y-2">
                <h3 className="font-['Newsreader',serif] font-normal text-2xl text-[#15171C]">
                  Bạn đã hoàn tất mọi đánh giá
                </h3>
                <p className="text-sm text-[#6A675F] font-normal">
                  Các buổi tập mới sẽ sẵn sàng đánh giá ngay sau khi buổi học kết thúc.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[rgba(21,23,28,0.12)]">
                <AnimatePresence>
                  {pendingSessions.map((session) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                      transition={{ duration: 0.2 }}
                      className="py-6 first:pt-2 flex flex-col md:flex-row md:items-center justify-between gap-5 hover:bg-[rgba(21,23,28,0.02)] -mx-3 px-3 rounded transition-colors"
                    >
                      {/* Cột 1: Ngày & Giờ (160px) */}
                      <div className="md:w-44 shrink-0 space-y-0.5">
                        <div className="font-['Newsreader',serif] font-normal text-xl text-[#15171C] leading-snug">
                          {session.dayVi}
                        </div>
                        <div className="text-xs text-[#6A675F] font-normal tabular-nums">
                          {session.startTime} – {session.endTime}
                        </div>
                      </div>

                      {/* Cột 2: Nội dung khóa học & Tình trạng */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <h3 className="text-base font-medium text-[#15171C] truncate">
                          {session.className}
                        </h3>
                        
                        <p className="text-sm text-[#6A675F] font-normal">
                          {session.court} · Huấn luyện viên {session.coach?.replace(/^HLV\s+/, '')}
                        </p>

                        <div className="text-xs text-[#6A675F] flex items-center gap-2 pt-0.5">
                          <span>{session.attendanceNote}</span>
                          <span className="text-[#6A675F]/40">•</span>
                          <span className={session.deadlineDays <= 2 ? 'text-[#A8844F] font-medium' : 'text-[#6A675F]'}>
                            Còn {session.deadlineDays} ngày để đánh giá
                          </span>
                        </div>
                      </div>

                      {/* Cột 3: CTA Button (Viết đánh giá) */}
                      <div className="shrink-0 flex items-center">
                        <button
                          type="button"
                          onClick={() => handleOpenReviewDrawer(session)}
                          className="w-full md:w-auto px-5 py-2.5 rounded-[6px] text-xs font-medium cursor-pointer transition-all active:scale-[0.98] bg-[#15171C] hover:bg-[#2A2E37] text-[#FBF9F4] shadow-xs"
                        >
                          Viết đánh giá
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* 5. TAB 2: LỊCH SỬ CỦA TÔI (Hàng phẳng, không hộp lồng hộp)       */}
        {/* ============================================================== */}
        {activeTab === 'submitted' && (
          <div className="space-y-6">
            
            {/* Thanh lọc tối giản */}
            <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-[rgba(21,23,28,0.08)]">
              <div className="flex items-center gap-3">
                <select
                  value={selectedCourseFilter}
                  onChange={(e) => setSelectedCourseFilter(e.target.value)}
                  className="bg-[#FBF9F4] border border-[rgba(21,23,28,0.12)] text-xs text-[#15171C] rounded-[6px] px-3 py-1.5 cursor-pointer outline-none focus:border-[#A8844F]"
                >
                  <option value="all">Tất cả khóa học</option>
                  <option value="Cầu lông">Cầu lông K01</option>
                  <option value="Pickleball">Pickleball K01</option>
                  <option value="Bắn cung">Bắn cung K01</option>
                </select>

                <select
                  value={selectedTimeFilter}
                  onChange={(e) => setSelectedTimeFilter(e.target.value)}
                  className="bg-[#FBF9F4] border border-[rgba(21,23,28,0.12)] text-xs text-[#15171C] rounded-[6px] px-3 py-1.5 cursor-pointer outline-none focus:border-[#A8844F]"
                >
                  <option value="all">Tất cả thời gian</option>
                  <option value="30days">30 ngày qua</option>
                  <option value="semester">Học kỳ này</option>
                </select>
              </div>

              <span className="text-xs text-[#6A675F] font-normal">
                {filteredSubmittedReviews.length} đánh giá đã gửi
              </span>
            </div>

            {filteredSubmittedReviews.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <p className="font-['Newsreader',serif] text-2xl text-[#15171C]">
                  Bạn chưa có đánh giá nào
                </p>
                <p className="text-xs text-[#6A675F]">
                  Ý kiến của bạn sẽ lưu tại đây sau khi gửi đánh giá buổi học.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('pending')}
                  className="text-xs text-[#15171C] underline font-medium cursor-pointer"
                >
                  Xem danh sách cần đánh giá
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[rgba(21,23,28,0.12)]">
                {filteredSubmittedReviews.map(review => {
                  const isExpanded = Boolean(expandedComments[review.id]);
                  const isBreakdownOpen = Boolean(expandedBreakdowns[review.id]);
                  const coachBd = review.criteria?.coachBreakdown || { expertise: 5, interaction: 5, punctuality: 5 };
                  const facilityBd = review.criteria?.facilityBreakdown || { court: 5, lighting: 5, cleanliness: 5 };

                  return (
                    <div
                      key={review.id}
                      className="py-8 first:pt-2 flex flex-col md:flex-row md:items-start justify-between gap-6 hover:bg-[rgba(21,23,28,0.015)] -mx-3 px-3 rounded transition-colors"
                    >
                      {/* Cột 1: Ngày giờ buổi học */}
                      <div className="md:w-44 shrink-0 space-y-1">
                        <div className="font-['Newsreader',serif] font-normal text-xl text-[#15171C] leading-snug">
                          {review.dayVi || review.sessionMeta?.dayVi || 'Thứ Hai, 12/10'}
                        </div>
                        <div className="text-xs text-[#6A675F] font-normal tabular-nums">
                          {review.startTime || review.sessionMeta?.startTime || '06:00'} – {review.endTime || review.sessionMeta?.endTime || '07:30'}
                        </div>
                        <div className="text-[11px] text-[#6A675F] font-normal pt-1">
                          Đã gửi: {review.createdAt?.slice(0, 10)}
                          {review.updatedAt ? ' (Đã cập nhật)' : ''}
                        </div>
                      </div>

                      {/* Cột 2: Thông tin đánh giá & Nhận xét */}
                      <div className="flex-1 min-w-0 space-y-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-medium text-[#15171C]">
                              {review.className}
                            </h3>
                            <span className="text-[#6A675F]/40">•</span>
                            <span className="text-xs text-[#6A675F]">
                              {review.room || review.sessionMeta?.court}
                            </span>
                            {review.isAnonymous && (
                              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[#15171C]/5 text-[#6A675F] border border-[rgba(21,23,28,0.12)]">
                                Ẩn danh với HLV
                              </span>
                            )}
                            {review.isPrivateContactRequested && (
                              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-[#A8844F]/10 text-[#A8844F] border border-[#A8844F]/30">
                                Yêu cầu Ban Giám đốc liên hệ
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#6A675F] pt-0.5">
                            Huấn luyện viên: <span className="text-[#15171C] font-medium">{review.coachName}</span>
                          </p>
                        </div>

                        {/* Điểm số & Tags nhận định */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-[#A8844F] uppercase tracking-wider">
                            {APPRAISAL_VERDICTS[review.rating || 5]?.label || 'Xuất sắc'}
                          </span>

                          {review.tags && review.tags.length > 0 && (
                            <>
                              <span className="text-[#6A675F]/30">•</span>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {review.tags.map(tag => (
                                  <span
                                    key={tag}
                                    className="text-[11px] font-sans px-2 py-0.5 rounded-[4px] border border-[rgba(21,23,28,0.1)] text-[#15171C] bg-[#FBF9F4]"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Lời nhận xét của hội viên */}
                        {review.comment && (
                          <div className="pt-0.5 space-y-1">
                            <p className={`text-[#15171C] italic font-['Newsreader',serif] text-base leading-relaxed ${isExpanded ? '' : 'line-clamp-2'}`}>
                              “{review.comment}”
                            </p>
                            {review.comment.length > 120 && (
                              <button
                                type="button"
                                onClick={() => toggleCommentExpand(review.id)}
                                className="text-[11px] text-[#A8844F] hover:underline font-medium cursor-pointer block"
                              >
                                {isExpanded ? 'Thu gọn' : 'Xem toàn văn nhận xét'}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Bảng điểm thành phần chi tiết (Collapsible) */}
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedBreakdowns(prev => ({
                                ...prev,
                                [review.id]: !prev[review.id],
                              }))
                            }
                            className="text-[11px] text-[#6A675F] hover:text-[#15171C] underline underline-offset-4 cursor-pointer transition-colors"
                          >
                            {isBreakdownOpen ? 'Ẩn chi tiết 6 tiêu chí đánh giá' : 'Xem chi tiết 6 tiêu chí đánh giá (HLV & Sân tập)'}
                          </button>

                          {isBreakdownOpen && (
                            <div className="mt-2.5 p-3.5 rounded-[6px] bg-[#FBF9F4] border border-[rgba(21,23,28,0.1)] grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                              <div className="space-y-1.5">
                                <div className="text-[10px] font-mono uppercase tracking-wider text-[#A8844F] font-semibold">
                                  CHẤT LƯỢNG HUẤN LUYỆN
                                </div>
                                <div className="flex justify-between text-[#6A675F]">
                                  <span>Chuyên môn & Kỹ thuật</span>
                                  <span className="font-mono text-[#15171C] font-medium">{coachBd.expertise}/5</span>
                                </div>
                                <div className="flex justify-between text-[#6A675F]">
                                  <span>Tương tác & Sửa động tác</span>
                                  <span className="font-mono text-[#15171C] font-medium">{coachBd.interaction}/5</span>
                                </div>
                                <div className="flex justify-between text-[#6A675F]">
                                  <span>Đúng giờ & Nhịp độ giáo án</span>
                                  <span className="font-mono text-[#15171C] font-medium">{coachBd.punctuality}/5</span>
                                </div>
                              </div>

                              <div className="space-y-1.5 sm:border-l sm:border-[rgba(21,23,28,0.08)] sm:pl-4">
                                <div className="text-[10px] font-mono uppercase tracking-wider text-[#A8844F] font-semibold">
                                  CƠ SỞ VẬT CHẤT & SÂN BÃI
                                </div>
                                <div className="flex justify-between text-[#6A675F]">
                                  <span>Chất lượng mặt sân / Thảm</span>
                                  <span className="font-mono text-[#15171C] font-medium">{facilityBd.court}/5</span>
                                </div>
                                <div className="flex justify-between text-[#6A675F]">
                                  <span>Ánh sáng & Nhiệt độ</span>
                                  <span className="font-mono text-[#15171C] font-medium">{facilityBd.lighting}/5</span>
                                </div>
                                <div className="flex justify-between text-[#6A675F]">
                                  <span>Vệ sinh & Dụng cụ tập</span>
                                  <span className="font-mono text-[#15171C] font-medium">{facilityBd.cleanliness}/5</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Lời hồi đáp từ Huấn luyện viên: Một dòng trích dẫn thanh lịch, KHÔNG hộp lồng hộp */}
                        {review.coachReply && (
                          <div className="pl-4 border-l-2 border-[#A8844F]/40 space-y-1 pt-1">
                            <p className="text-xs sm:text-[13px] text-[#6A675F] italic font-['Newsreader',serif] leading-relaxed">
                              “{review.coachReply}”
                            </p>
                            <span className="text-[11px] text-[#6A675F] font-normal block font-sans">
                              — Huấn luyện viên {review.coachName?.replace(/^HLV\s+/, '')} · Phản hồi sau buổi tập
                            </span>
                          </div>
                        )}

                      </div>

                      {/* Cột 3: Điểm số & Chỉnh sửa */}
                      <div className="md:w-32 shrink-0 flex flex-col md:items-end justify-between pt-1">
                        <span className="font-['Newsreader',serif] font-normal text-3xl text-[#15171C] leading-none lining-nums">
                          {Number(review.rating || 5).toFixed(1)}
                        </span>
                        
                        <button
                          type="button"
                          onClick={() => handleOpenReviewDrawer(review.sessionMeta || review, review)}
                          className="text-xs text-[#A8844F] hover:text-[#15171C] hover:underline cursor-pointer font-medium pt-4"
                        >
                          Chỉnh sửa
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ============================================================== */}
      {/* 6. DRAWER ĐÁNH GIÁ (Slide-Over Sheet 480px)                    */}
      {/* ============================================================== */}
      <AnimatePresence>
        {drawerOpen && activeSessionForReview && (
          <div className="fixed inset-0 z-50 overflow-hidden font-['Be_Vietnam_Pro',sans-serif]">
            
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-[#15171C]/50 backdrop-blur-xs"
              onClick={() => !isSubmitting && setDrawerOpen(false)}
              aria-hidden="true"
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
              <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                className="w-screen max-w-[480px] bg-[#FBF9F4] text-[#15171C] shadow-2xl flex flex-col justify-between border-l border-[rgba(21,23,28,0.12)] z-10"
                role="dialog"
                aria-modal="true"
              >
                {/* Header Drawer */}
                <div className="p-6 border-b border-[rgba(21,23,28,0.12)] flex items-start justify-between gap-4 bg-[#FBF9F4] sticky top-0 z-10">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-medium uppercase tracking-[0.16em] text-[#A8844F] block">
                      {editingFeedbackId ? 'CHỈNH SỬA ĐÁNH GIÁ' : 'ĐÁNH GIÁ BUỔI HỌC'}
                    </span>
                    <h2 className="font-['Newsreader',serif] font-normal text-2xl sm:text-[28px] text-[#15171C] leading-snug">
                      {activeSessionForReview.className}
                    </h2>
                    <p className="text-xs text-[#6A675F] font-normal">
                      {activeSessionForReview.dayVi} · {activeSessionForReview.coach} · {activeSessionForReview.court}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => !isSubmitting && setDrawerOpen(false)}
                    className="p-1.5 text-[#6A675F] hover:text-[#15171C] rounded transition-colors cursor-pointer"
                    title="Đóng (ESC)"
                  >
                    <X className="w-5 h-5 stroke-[1.75]" />
                  </button>
                </div>

                {/* Drawer Body */}
                <div className="p-6 overflow-y-auto space-y-7 flex-1">
                  
                  {isThankYouMode ? (
                    /* XÁC NHẬN HOÀN TẤT LỊCH THIỆP */
                    <div className="py-12 flex flex-col items-center justify-center text-center space-y-5 animate-in fade-in duration-200">
                      
                      <div className="w-12 h-12 rounded-full border border-[#A8844F]/40 bg-[#A8844F]/10 flex items-center justify-center text-[#A8844F]">
                        <Check className="w-6 h-6 stroke-[2.25]" />
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-['Newsreader',serif] font-normal text-2xl text-[#15171C]">
                          {editingFeedbackId ? 'Đã cập nhật đánh giá' : 'Cảm ơn bạn đã phản hồi'}
                        </h3>
                        <p className="text-xs text-[#6A675F] max-w-xs mx-auto leading-relaxed">
                          Ý kiến của bạn đã được chuyển tới Huấn luyện viên và Ban Quản lý Chuyên môn để liên tục nâng cao chuẩn mực buổi tập.
                        </p>
                      </div>

                      <div className="pt-4 w-full space-y-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setDrawerOpen(false);
                            setIsThankYouMode(false);
                            setActiveTab('submitted');
                            if (typeof showToast === 'function') {
                              showToast(editingFeedbackId ? 'Đã cập nhật đánh giá thành công.' : 'Đã lưu đánh giá thành công.', 'success');
                            }
                          }}
                          className="w-full py-2.5 rounded-[6px] bg-[#15171C] text-[#FBF9F4] text-xs font-medium cursor-pointer hover:bg-[#2A2E37] transition-all"
                        >
                          Xem trong Lịch sử đánh giá
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDrawerOpen(false);
                            setIsThankYouMode(false);
                            if (typeof showToast === 'function') {
                              showToast(editingFeedbackId ? 'Đã cập nhật đánh giá thành công.' : 'Đã lưu đánh giá thành công.', 'success');
                            }
                          }}
                          className="w-full py-2 rounded-[6px] border border-[rgba(21,23,28,0.15)] text-[#15171C] text-xs font-medium cursor-pointer hover:bg-[rgba(21,23,28,0.04)] transition-all"
                        >
                          Đóng cửa sổ
                        </button>
                      </div>

                    </div>
                  ) : (
                    <>
                      {/* BƯỚC 1: THANG ĐIỂM CHẤM 1.0 – 5.0 */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-['Newsreader',serif] font-normal text-xl text-[#15171C]">
                            Đánh giá chất lượng buổi tập
                          </h3>
                          <span className="text-[11px] font-mono text-[#A8844F] uppercase">
                            SCALE 1.0 – 5.0
                          </span>
                        </div>

                        {/* 5 Phím chọn điểm */}
                        <div
                          role="radiogroup"
                          aria-label="Thang đo chất lượng buổi học"
                          className="grid grid-cols-5 gap-2 pt-1"
                        >
                          {[1, 2, 3, 4, 5].map((level) => {
                            const isSelected = overallRating === level;
                            const isFilled = overallRating >= level;
                            return (
                              <button
                                key={level}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                aria-label={`Mức ${level} trên 5: ${APPRAISAL_VERDICTS[level].label}`}
                                onClick={() => setOverallRating(level)}
                                className={`h-12 rounded-[6px] flex flex-col items-center justify-center transition-all cursor-pointer border ${
                                  isSelected
                                    ? 'bg-[#15171C] text-[#FBF9F4] border-[#A8844F] ring-1 ring-[#A8844F] shadow-sm scale-102'
                                    : isFilled
                                    ? 'bg-[#A8844F]/15 border-[#A8844F]/40 text-[#15171C]'
                                    : 'bg-[#FBF9F4] border-[rgba(21,23,28,0.15)] text-[#6A675F] hover:border-[#15171C]'
                                }`}
                              >
                                <span className="font-['Newsreader',serif] text-lg font-normal leading-none">
                                  {level}.0
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Label verdict dưới 5 mức */}
                        <div className="min-h-5 pt-0.5">
                          {overallRating > 0 ? (
                            <div className="flex items-baseline gap-2 animate-in fade-in duration-150">
                              <span className="text-xs font-semibold text-[#A8844F] uppercase tracking-wider">
                                {APPRAISAL_VERDICTS[overallRating].label}
                              </span>
                              <span className="text-[11px] text-[#6A675F]">
                                · {APPRAISAL_VERDICTS[overallRating].desc}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#6A675F]">
                              Chọn mức đánh giá từ 1.0 đến 5.0
                            </span>
                          )}
                        </div>
                      </div>

                      {/* BƯỚC 2: Tiêu chí chi tiết (Hiện khi đã chọn điểm tổng) */}
                      {overallRating > 0 && (
                        <div className="space-y-6 pt-3 border-t border-[rgba(21,23,28,0.08)] animate-in fade-in duration-200">
                          
                          {/* Nhóm 1: Huấn luyện viên */}
                          <div className="space-y-3">
                            <span className="text-[10px] font-mono font-medium uppercase tracking-[0.16em] text-[#A8844F] block">
                              TIÊU CHÍ HUẤN LUYỆN VIÊN
                            </span>

                            <div className="space-y-2.5">
                              {[
                                { key: 'expertise', label: 'Chuyên môn & Giáo án kỹ thuật' },
                                { key: 'interaction', label: 'Tương tác & Theo sát cá nhân' },
                                { key: 'punctuality', label: 'Tác phong & Đúng giờ' },
                              ].map(item => (
                                <div key={item.key} className="flex items-center justify-between text-xs py-1">
                                  <span className="text-[#15171C]">{item.label}</span>
                                  <div className="flex items-center gap-1.5">
                                    {[1, 2, 3, 4, 5].map(pt => (
                                      <button
                                        key={pt}
                                        type="button"
                                        onClick={() => setCoachCriteria(prev => ({ ...prev, [item.key]: pt }))}
                                        className={`w-6 h-6 rounded-full text-[10px] font-medium transition-all cursor-pointer ${
                                          coachCriteria[item.key] === pt
                                            ? 'bg-[#15171C] text-[#FBF9F4]'
                                            : coachCriteria[item.key] > pt
                                            ? 'bg-[#A8844F]/20 text-[#15171C]'
                                            : 'bg-white border border-[rgba(21,23,28,0.15)] text-[#6A675F]'
                                        }`}
                                      >
                                        {pt}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Nhóm 2: Sân bãi & Tiện nghi */}
                          <div className="space-y-3 pt-2">
                            <span className="text-[10px] font-mono font-medium uppercase tracking-[0.16em] text-[#A8844F] block">
                              TIÊU CHÍ SÂN BÃI & TIỆN NGHI
                            </span>

                            <div className="space-y-2.5">
                              {[
                                { key: 'court', label: 'Mặt sàn & Ánh sáng thi đấu' },
                                { key: 'lighting', label: 'Nhiệt độ không gian & Độ tĩnh âm' },
                                { key: 'cleanliness', label: 'Vệ sinh & Hậu cần sân bãi' },
                              ].map(item => (
                                <div key={item.key} className="flex items-center justify-between text-xs py-1">
                                  <span className="text-[#15171C]">{item.label}</span>
                                  <div className="flex items-center gap-1.5">
                                    {[1, 2, 3, 4, 5].map(pt => (
                                      <button
                                        key={pt}
                                        type="button"
                                        onClick={() => setFacilityCriteria(prev => ({ ...prev, [item.key]: pt }))}
                                        className={`w-6 h-6 rounded-full text-[10px] font-medium transition-all cursor-pointer ${
                                          facilityCriteria[item.key] === pt
                                            ? 'bg-[#15171C] text-[#FBF9F4]'
                                            : facilityCriteria[item.key] > pt
                                            ? 'bg-[#A8844F]/20 text-[#15171C]'
                                            : 'bg-white border border-[rgba(21,23,28,0.15)] text-[#6A675F]'
                                        }`}
                                      >
                                        {pt}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                        </div>
                      )}

                      {/* BƯỚC 3: Gợi ý nhận định nhanh */}
                      {overallRating > 0 && (
                        <div className="space-y-2.5 pt-3 border-t border-[rgba(21,23,28,0.08)]">
                          <span className="text-[10px] font-mono font-medium uppercase tracking-[0.16em] text-[#A8844F] block">
                            NHẬN ĐỊNH NHANH (CHỌN ĐỂ THÊM VÀO Ý KIẾN)
                          </span>
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            {(overallRating >= 4 ? POSITIVE_APPRAISAL_TAGS : CRITICAL_APPRAISAL_TAGS).map(tag => {
                              const isSelected = selectedTags.includes(tag);
                              return (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => handleToggleTag(tag)}
                                  className={`text-xs px-3 py-1.5 rounded-[4px] transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#15171C] text-[#FBF9F4] border border-[#15171C]'
                                      : 'bg-transparent border border-[rgba(21,23,28,0.15)] text-[#15171C] hover:border-[#15171C]'
                                  }`}
                                >
                                  {tag}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* BƯỚC 4: Nhận xét văn bản */}
                      {overallRating > 0 && (
                        <div className="space-y-2.5 pt-3 border-t border-[rgba(21,23,28,0.08)]">
                          <label className="text-[10px] font-mono font-medium uppercase tracking-[0.16em] text-[#A8844F] block">
                            Ý KIẾN ĐÓNG GÓP CHI TIẾT (TÙY CHỌN)
                          </label>

                          <textarea
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            rows={4}
                            placeholder="Ghi chú chi tiết về bài tập, động tác, nhịp độ hoặc chất lượng sân..."
                            className="w-full p-3.5 bg-white border border-[rgba(21,23,28,0.15)] rounded-[6px] text-xs text-[#15171C] placeholder:text-[#6A675F]/60 focus:outline-none focus:border-[#A8844F] focus:ring-1 focus:ring-[#A8844F] transition-all resize-none leading-relaxed"
                          />
                        </div>
                      )}

                      {/* BƯỚC 5: Quyền riêng tư & Đối thoại bảo mật */}
                      {overallRating > 0 && (
                        <div className="space-y-3 pt-3 border-t border-[rgba(21,23,28,0.08)]">
                          {/* Ẩn danh */}
                          <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[#15171C]">
                            <input
                              type="checkbox"
                              checked={isAnonymous}
                              onChange={(e) => setIsAnonymous(e.target.checked)}
                              className="w-4 h-4 rounded border-[rgba(21,23,28,0.2)] text-[#15171C] focus:ring-[#A8844F]"
                            />
                            <span>Gửi ẩn danh với Huấn luyện viên (chỉ Ban Giám đốc xem được)</span>
                          </label>

                          {/* Đối thoại riêng */}
                          <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[#15171C]">
                            <input
                              type="checkbox"
                              checked={isPrivateContactRequested}
                              onChange={(e) => setIsPrivateContactRequested(e.target.checked)}
                              className="w-4 h-4 rounded border-[rgba(21,23,28,0.2)] text-[#15171C] focus:ring-[#A8844F]"
                            />
                            <span>Đề nghị Giám đốc Chuyên môn liên hệ trực tiếp trao đổi thêm</span>
                          </label>
                        </div>
                      )}

                      {submitError && (
                        <div className="p-3 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700">
                          {submitError}
                        </div>
                      )}
                    </>
                  )}

                </div>

                {/* Footer Drawer */}
                {!isThankYouMode && (
                  <div className="p-6 border-t border-[rgba(21,23,28,0.12)] bg-[#FBF9F4] flex items-center justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => setDrawerOpen(false)}
                      className="px-4 py-2.5 text-xs text-[#6A675F] hover:text-[#15171C] font-medium cursor-pointer"
                    >
                      Hủy bỏ
                    </button>

                    <button
                      type="button"
                      disabled={overallRating === 0 || isSubmitting}
                      onClick={handleSubmitReview}
                      className={`px-6 py-2.5 rounded-[6px] text-xs font-medium cursor-pointer transition-all ${
                        overallRating > 0 && !isSubmitting
                          ? 'bg-[#15171C] hover:bg-[#2A2E37] text-[#FBF9F4] shadow-xs active:scale-[0.98]'
                          : 'bg-[rgba(21,23,28,0.1)] text-[#6A675F]/60 cursor-not-allowed'
                      }`}
                    >
                      {isSubmitting ? 'Đang gửi...' : editingFeedbackId ? 'Lưu cập nhật' : 'Gửi đánh giá'}
                    </button>
                  </div>
                )}

              </motion.aside>
            </div>

          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
