import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSCMS } from '../../context/SCMSContext';
import { formatDate } from '../../locales/translations';
import { CancelClassBookingModal } from '../modals/CancelClassBookingModal';
import { EnrollClassModal } from '../modals/EnrollClassModal';
import { publicCourses } from '../../data/publicCourses';
import { publicCoaches } from '../../data/publicCoaches';
import { MemberCourseCatalog } from './MemberCourseCatalog';
import {
  Users,
  Clock,
  MapPin,
  CheckCircle2,
  Search,
  X,
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Trash2,
  Sparkles,
  SlidersHorizontal,
  RotateCcw,
  BookOpen,
  CalendarDays,
  Info,
  Play,
  Video,
  Target,
  Compass,
  ExternalLink
} from 'lucide-react';

// Dedicated video for each sport (No more shared montage everywhere!)
const SPORT_VIDEOS = {
  'archery': '/videos/courses/archery.mp4',
  'badminton': '/videos/courses/badminton.mp4',
  'pickleball': '/videos/courses/pickleball.mp4',
  'table-tennis': '/videos/courses/table-tennis.mp4',
  'basketball': '/videos/courses/basketball.mp4',
  'volleyball': '/videos/courses/volleyball.mp4',
  'swimming': '/videos/courses/swimming.mp4',
  'football': '/videos/courses/football.mp4',
  'tennis': '/videos/courses/tennis.mp4',
};

const ALL_SPORTS_TABS = [
  { id: 'all', label: 'Toàn trung tâm (Montage)', video: '/videos/vibe-sport-montage-1080p.mp4', poster: '/images/courses/badminton.jpg' },
  { id: 'archery', label: 'Bắn cung', video: '/videos/courses/archery.mp4', poster: '/images/courses/archery.jpg' },
  { id: 'badminton', label: 'Cầu lông', video: '/videos/courses/badminton.mp4', poster: '/images/courses/badminton.jpg' },
  { id: 'pickleball', label: 'Pickleball', video: '/videos/courses/pickleball.mp4', poster: '/images/courses/pickleball.jpg' },
  { id: 'table-tennis', label: 'Bóng bàn', video: '/videos/courses/table-tennis.mp4', poster: '/images/courses/table-tennis.jpg' },
  { id: 'tennis', label: 'Quần vợt', video: '/videos/courses/tennis.mp4', poster: '/images/courses/tennis.jpg' },
  { id: 'basketball', label: 'Bóng rổ', video: '/videos/courses/basketball.mp4', poster: '/images/courses/basketball.jpg' },
  { id: 'volleyball', label: 'Bóng chuyền', video: '/videos/courses/volleyball.mp4', poster: '/images/courses/volleyball.jpg' },
  { id: 'swimming', label: 'Bơi lội', video: '/videos/courses/swimming.mp4', poster: '/images/courses/swimming.jpg' },
  { id: 'football', label: 'Bóng đá', video: '/videos/courses/football.mp4', poster: '/images/courses/football.jpg' },
];

function getSportIcon(cat = '') {
  const norm = (cat || '').toLowerCase();
  if (norm.includes('cung') || norm.includes('archery')) return '🎯';
  if (norm.includes('cầu lông') || norm.includes('badminton')) return '🏸';
  if (norm.includes('pickleball')) return '🏓';
  if (norm.includes('bóng bàn') || norm.includes('table-tennis')) return '🏓';
  if (norm.includes('quần vợt') || norm.includes('tennis')) return '🎾';
  if (norm.includes('bóng rổ') || norm.includes('basketball')) return '🏀';
  if (norm.includes('bóng chuyền') || norm.includes('volleyball')) return '🏐';
  if (norm.includes('bơi') || norm.includes('swimming')) return '🏊';
  if (norm.includes('bóng đá') || norm.includes('football')) return '⚽';
  return '🏆';
}

// Sport metadata with authentic high-resolution court/facility images, icons, and specifications
const SPORT_META = {
  'Cầu lông': {
    image: '/images/courses/badminton.jpg',
    badgeColor: 'bg-emerald-700',
    lightBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    defaultCourt: 'Sân Cầu Lông Thảm PVC Taraflex',
  },
  'Pickleball': {
    image: '/images/courses/pickleball.jpg',
    badgeColor: 'bg-blue-700',
    lightBg: 'bg-blue-50 text-blue-800 border-blue-200',
    defaultCourt: 'Sân Pickleball Pro Cushion DUPR',
  },
  'Bắn cung': {
    image: '/images/courses/archery.jpg',
    badgeColor: 'bg-amber-700',
    lightBg: 'bg-amber-50 text-amber-800 border-amber-200',
    defaultCourt: 'Trường bắn cự ly 18m - 30m bia điện tử',
  },
  'Bắn súng': {
    image: '/images/courses/archery.jpg',
    badgeColor: 'bg-rose-700',
    lightBg: 'bg-rose-50 text-rose-800 border-rose-200',
    defaultCourt: 'Trường bắn thể thao laser an toàn',
  },
  'Bóng bàn': {
    image: '/images/courses/table-tennis.jpg',
    badgeColor: 'bg-cyan-700',
    lightBg: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    defaultCourt: 'Bàn thi đấu tiêu chuẩn ITTF',
  },
  'Quần vợt': {
    image: '/images/courses/tennis.jpg',
    badgeColor: 'bg-indigo-700',
    lightBg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    defaultCourt: 'Mặt sân cứng Plexicushion đạt chuẩn ITF',
  },
  'Tennis': {
    image: '/images/courses/tennis.jpg',
    badgeColor: 'bg-indigo-700',
    lightBg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    defaultCourt: 'Mặt sân cứng Plexicushion đạt chuẩn ITF',
  },
  'Bóng đá': {
    image: '/images/courses/football.jpg',
    badgeColor: 'bg-lime-700',
    lightBg: 'bg-lime-50 text-lime-800 border-lime-200',
    defaultCourt: 'Sân cỏ nhân tạo sợi Monofilament tiêu chuẩn',
  },
  'Bóng rổ': {
    image: '/images/courses/basketball.jpg',
    badgeColor: 'bg-orange-700',
    lightBg: 'bg-orange-50 text-orange-800 border-orange-200',
    defaultCourt: 'Sân sàn gỗ phong Robbins tiêu chuẩn NBA',
  },
  'Bóng chuyền': {
    image: '/images/courses/volleyball.jpg',
    badgeColor: 'bg-teal-700',
    lightBg: 'bg-teal-50 text-teal-800 border-teal-200',
    defaultCourt: 'Sàn cao su giảm chấn thể thao chuyên dụng',
  },
  'Bơi lội': {
    image: '/images/courses/swimming.jpg',
    badgeColor: 'bg-sky-700',
    lightBg: 'bg-sky-50 text-sky-800 border-sky-200',
    defaultCourt: 'Bể bơi nước ấm 50m điện phân muối sinh học',
  },
};

const DEFAULT_SPORT_META = {
  image: '/images/courses/badminton.jpg',
  badgeColor: 'bg-slate-800',
  lightBg: 'bg-slate-100 text-slate-800 border-slate-200',
  defaultCourt: 'Sân thể thao chuyên dụng VIBE Sport',
};

// Format selected days helper
function formatSelectedDays(days) {
  if (!days || !Array.isArray(days) || days.length === 0) return 'Lịch linh hoạt';
  const dayNames = {
    1: 'Thứ 2',
    2: 'Thứ 3',
    3: 'Thứ 4',
    4: 'Thứ 5',
    5: 'Thứ 6',
    6: 'Thứ 7',
    0: 'Chủ Nhật',
  };
  const sorted = [...days].sort((a, b) => {
    const orderA = a === 0 ? 7 : a;
    const orderB = b === 0 ? 7 : b;
    return orderA - orderB;
  });
  return sorted.map(d => dayNames[d] || `T${d}`).join(', ');
}

// Calculate schedule details including exact first session date and end date
function calculateCourseSchedule(cls) {
  const startDateStr = cls.startDate || cls.date;
  const sessionCount = cls.sessionCount || 12;
  const days = Array.isArray(cls.selectedDays) && cls.selectedDays.length > 0
    ? cls.selectedDays
    : [1, 3, 5];

  if (!startDateStr) {
    return {
      daysText: formatSelectedDays(days),
      startFormatted: 'Sớm nhất',
      endFormatted: '',
      firstSessionDate: new Date(),
      endDateObj: new Date(),
      isPastEndDate: false,
      rangeText: `${sessionCount} buổi`,
    };
  }

  const rawStart = new Date(`${startDateStr}T${cls.startTime || '00:00'}:00`);
  // Ensure we find the actual first day matching selectedDays on or after startDateStr
  let firstSession = new Date(rawStart);
  let guard = 0;
  while (!days.includes(firstSession.getDay()) && guard < 7) {
    firstSession.setDate(firstSession.getDate() + 1);
    guard++;
  }

  // Walk through sessionCount sessions to compute the exact end date
  let current = new Date(firstSession);
  let sessionsLeft = sessionCount;
  while (sessionsLeft > 0) {
    if (days.includes(current.getDay())) {
      sessionsLeft--;
      if (sessionsLeft === 0) break;
    }
    current.setDate(current.getDate() + 1);
  }

  const [endH = 23, endM = 59] = (cls.endTime || '23:59').split(':').map(Number);
  current.setHours(endH, endM, 0, 0);

  const startFormatted = `${String(firstSession.getDate()).padStart(2, '0')}/${String(firstSession.getMonth() + 1).padStart(2, '0')}/${firstSession.getFullYear()}`;
  const endFormatted = `${String(current.getDate()).padStart(2, '0')}/${String(current.getMonth() + 1).padStart(2, '0')}/${current.getFullYear()}`;

  const now = new Date();
  const isPastEndDate = now.getTime() > current.getTime();

  return {
    daysText: formatSelectedDays(days),
    startFormatted,
    endFormatted,
    firstSessionDate: firstSession,
    endDateObj: current,
    isPastEndDate,
    rangeText: `${startFormatted} - ${endFormatted}`,
  };
}

// Uniform Status calculation (Đang mở đăng ký | Đã khai giảng | Hết chỗ | Chưa đủ sĩ số | Chỉ còn X chỗ)
function getClassStatus(cls, now = new Date()) {
  const maxCap = cls.capacity || 8;
  const enrolled = cls.enrolledCount || 0;
  const minCap = cls.minCapacity || 4;
  const spotsLeft = Math.max(0, maxCap - enrolled);
  const isFull = enrolled >= maxCap || spotsLeft <= 0;
  const schedule = calculateCourseSchedule(cls);
  const isStarted = now >= schedule.firstSessionDate;

  // Time calculations
  const hoursUntilStart = (schedule.firstSessionDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (isFull) {
    return {
      key: 'full',
      labelVi: 'Hết chỗ',
      labelEn: 'Class Full',
      pillClass: 'bg-rose-600 text-white',
      canEnroll: false,
      isAbnormal: true,
    };
  }
  if (schedule.isPastEndDate) {
    return {
      key: 'started',
      labelVi: 'Đã kết thúc',
      labelEn: 'Ended',
      pillClass: 'bg-slate-700 text-white',
      canEnroll: false,
      isAbnormal: true,
    };
  }
  // Abnormal state: Only 1 or 2 spots left
  if (spotsLeft <= 2) {
    return {
      key: 'near_full',
      labelVi: `Chỉ còn ${spotsLeft} chỗ`,
      labelEn: `Only ${spotsLeft} spots`,
      pillClass: 'bg-amber-500 text-white',
      canEnroll: true,
      isAbnormal: true,
    };
  }
  // Normal default state
  return {
    key: 'open',
    labelVi: 'Đang mở đăng ký',
    labelEn: 'Open for Registration',
    pillClass: 'bg-emerald-600 text-white',
    canEnroll: true,
    isAbnormal: false, // Normal state -> Do not clutter image with chip!
  };
}

function canEnroll(cls, now = new Date()) {
  return getClassStatus(cls, now).canEnroll;
}

// Sport icon square badge component (white icon inside red square)
function SportSquareBadge({ category = '' }) {
  const norm = (category || '').toLowerCase().trim();

  // 1. Cầu lông (Badminton shuttlecock)
  if (norm.includes('cầu lông') || norm.includes('badminton')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
        <path d="M12 21a2.5 2.5 0 0 0 2.5-2.5c0-.8-.4-1.5-1-2h-3c-.6.5-1 1.2-1 2A2.5 2.5 0 0 0 12 21z" fill="currentColor" />
        <path d="M10.5 16.5L7 5l5 2 5-2-3.5 11.5" />
        <path d="M8 9h8" />
        <path d="M9 13h6" />
      </svg>
    );
  }

  // 2. Pickleball (Paddle with perforated holes)
  if (norm.includes('pickleball')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
        <rect x="6" y="3" width="12" height="13" rx="4" />
        <circle cx="9.5" cy="7.5" r="0.75" fill="currentColor" />
        <circle cx="14.5" cy="7.5" r="0.75" fill="currentColor" />
        <circle cx="12" cy="10" r="0.75" fill="currentColor" />
        <path d="M12 16v5" strokeWidth="2.5" />
      </svg>
    );
  }

  // 3. Bóng bàn (Table Tennis - paddle & ball)
  if (norm.includes('bóng bàn') || norm.includes('table tennis') || norm.includes('ping pong')) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
        <circle cx="13" cy="9.5" r="5.8" />
        <path d="M9 13.5L4.5 18a1.5 1.5 0 0 0 2.1 2.1l4.5-4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="18.5" cy="17" r="2.2" />
      </svg>
    );
  }

  // 4. Bơi lội (Swimming - cap & goggles)
  if (norm.includes('bơi') || norm.includes('swim')) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
        <path d="M4 11C4 6.58 7.58 3 12 3s8 3.58 8 8v1H4v-1z" />
        <rect x="5.5" y="13.5" width="5.5" height="3.5" rx="1.75" fill="white" />
        <rect x="13" y="13.5" width="5.5" height="3.5" rx="1.75" fill="white" />
        <path d="M11 15.2h2" stroke="white" strokeWidth="1.8" />
      </svg>
    );
  }

  // 5. Bóng chuyền (Volleyball)
  if (norm.includes('bóng chuyền') || norm.includes('volleyball')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6 text-white">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 1 0 18" />
        <path d="M4.2 7.5A9 9 0 0 1 19.8 7.5" />
        <path d="M4.2 16.5a9 9 0 0 0 15.6 0" />
      </svg>
    );
  }

  // 6. Quần vợt / Tennis
  if (norm.includes('quần vợt') || norm.includes('tennis')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
        <ellipse cx="14" cy="8" rx="6" ry="5" transform="rotate(-35 14 8)" />
        <line x1="9.5" y1="12.5" x2="3" y2="21" strokeWidth="2.5" />
        <line x1="12" y1="6" x2="16" y2="10" strokeWidth="1" />
        <line x1="14" y1="4" x2="14" y2="12" strokeWidth="1" />
        <circle cx="19.5" cy="17.5" r="2.2" fill="currentColor" />
      </svg>
    );
  }

  // 7. Bắn cung (Archery)
  if (norm.includes('bắn cung') || norm.includes('archery')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5.5" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" strokeWidth="1.5" />
      </svg>
    );
  }

  // 8. Bắn súng (Shooting)
  if (norm.includes('bắn súng') || norm.includes('shooting')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
        <line x1="12" y1="2" x2="12" y2="6" strokeWidth="2" />
        <line x1="12" y1="18" x2="12" y2="22" strokeWidth="2" />
        <line x1="2" y1="12" x2="6" y2="12" strokeWidth="2" />
        <line x1="18" y1="12" x2="22" y2="12" strokeWidth="2" />
      </svg>
    );
  }

  // 9. Bóng đá (Football)
  if (norm.includes('bóng đá') || norm.includes('football') || norm.includes('soccer')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
        <circle cx="12" cy="12" r="9" />
        <polygon points="12 7 15 10 14 14 10 14 9 10" fill="currentColor" />
        <line x1="12" y1="7" x2="12" y2="3" />
        <line x1="15" y1="10" x2="18.5" y2="8" />
        <line x1="14" y1="14" x2="17" y2="18" />
        <line x1="10" y1="14" x2="7" y2="18" />
        <line x1="9" y1="10" x2="5.5" y2="8" />
      </svg>
    );
  }

  // 10. Bóng rổ (Basketball)
  if (norm.includes('bóng rổ') || norm.includes('basketball')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
        <circle cx="12" cy="12" r="9" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="12" y1="3" x2="12" y2="21" />
        <path d="M5.5 5.5a10 10 0 0 0 0 13" />
        <path d="M18.5 5.5a10 10 0 0 1 0 13" />
      </svg>
    );
  }

  // Default fallback (Sport shield)
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-white">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.45 1-1 1H7" />
      <path d="M14 14.66V17c0 .55.45 1 1 1h2" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

export function MemberClassCatalog() {
  const { apiEnabled } = useSCMS();
  return apiEnabled ? <MemberCourseCatalog /> : <LegacyMemberClassCatalog />;
}

function LegacyMemberClassCatalog() {
  const navigate = useNavigate();
  const {
    classes,
    subjects,
    currentUser,
    bookClass,
    cancelBooking,
    bookings,
    members,
    packages,
    reloadClasses,
    showToast,
    t,
    language,
  } = useSCMS();

  // Filter & Search states
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTimeOfDay, setSelectedTimeOfDay] = useState('all'); // 'all' | 'morning' | 'afternoon' | 'evening'
  const [selectedAvailability, setSelectedAvailability] = useState('all'); // 'all' | 'available' | 'booked'
  const [sortBy, setSortBy] = useState('default'); // 'default' | 'price_asc' | 'price_desc' | 'spots_desc'
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  // Sport Detail & Video Modal
  const [selectedSportForDetail, setSelectedSportForDetail] = useState(null);
  const [modalMediaTab, setModalMediaTab] = useState('video'); // 'video' | 'photo'

  // Center Showcase Video Modal
  const [showCenterVideoModal, setShowCenterVideoModal] = useState(false);
  const [activeCenterVideoSport, setActiveCenterVideoSport] = useState('all'); // 'all' | sportId

  // Enrolled sports progress (matching member's active curriculum in the system)
  const enrolledSportsList = useMemo(() => {
    // 3 default courses for member Minh Anh matching user's reference screenshot
    const defaults = [
      {
        id: 'archery',
        title: 'Bắn cung',
        titleEn: 'Archery',
        category: 'Bắn cung',
        batch: 'Khóa K01',
        completedSessions: 0,
        totalSessions: 12,
        attendanceRate: 100,
        nextSessionTime: 'Thứ 4, 14/10 • 06:00',
        status: 'upcoming',
        statusLabel: 'Sắp khai giảng',
        coachName: 'Lê Nguyễn Thiên Phúc',
      },
      {
        id: 'badminton',
        title: 'Cầu lông',
        titleEn: 'Badminton',
        category: 'Cầu lông',
        batch: 'Khóa K01',
        completedSessions: 1,
        totalSessions: 12,
        attendanceRate: 100,
        nextSessionTime: 'Thứ 2, 19/10 • 06:00',
        status: 'in_progress',
        statusLabel: 'Đang học',
        coachName: 'Trần Thị Hương',
      },
      {
        id: 'pickleball',
        title: 'Pickleball',
        titleEn: 'Pickleball',
        category: 'Pickleball',
        batch: 'Khóa K01',
        completedSessions: 1,
        totalSessions: 12,
        attendanceRate: 100,
        nextSessionTime: 'Thứ 6, 16/10 • 18:15',
        status: 'in_progress',
        statusLabel: 'Đang học',
        coachName: 'Phạm Thị Lan',
      },
    ];

    return defaults.map(item => {
      const course = publicCourses.find(c => c.id === item.id) || {
        id: item.id,
        title: item.title,
        titleEn: item.titleEn,
        image: `/images/courses/${item.id}.jpg`,
        intro: 'Chương trình rèn luyện thể thao chuyên nghiệp cùng HLV đạt chuẩn.',
        goals: ['Làm quen kỹ thuật căn bản', 'Thực hành cùng HLV', 'Phát triển phản xạ và thể lực'],
        space: 'Khu phức hợp thể thao đa năng VIBE Sport',
      };
      const coach = publicCoaches.find(c => c.sportId === item.id) || {
        name: item.coachName,
        image: `/images/coaches/${item.id}.jpg`,
      };
      return {
        ...item,
        course,
        coach,
      };
    });
  }, []);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Action states
  const [bookingLoadingId, setBookingLoadingId] = useState(null);
  const [cancellingClass, setCancellingClass] = useState(null);
  const [enrollingClass, setEnrollingClass] = useState(null);

  // Scroll ref & dynamic scroll arrows state for horizontal sports bar
  const sportsScrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollState = () => {
    const el = sportsScrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 4;
    setCanScrollLeft(hasOverflow && el.scrollLeft > 5);
    setCanScrollRight(hasOverflow && el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  };

  const member = members?.find(m => String(m.id) === String(currentUser?.id)) || currentUser || members?.[0];
  const memberPkg = packages?.find(p => String(p.id) === String(member?.currentPackageId || currentUser?.currentPackageId));
  const isMember = Boolean(currentUser?.role === 'member' || member?.membershipStatus === 'active' || memberPkg);

  // Debounce search input (280ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setCurrentPage(1);
    }, 280);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Reset page when category or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, selectedTimeOfDay, selectedAvailability, sortBy]);

  // Polling data every 30 seconds for real-time capacity updates silently in background
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof reloadClasses === 'function') {
        reloadClasses().catch(() => {});
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [reloadClasses]);

  // Only consider published classes that have not passed their course end date
  const publishedClasses = useMemo(() => {
    return (classes || []).filter(cls => {
      if ((cls.status || 'published') !== 'published') return false;
      const sched = calculateCourseSchedule(cls);
      if (sched.isPastEndDate) return false;
      return true;
    });
  }, [classes]);

  // Count open classes that can currently be enrolled
  const openClassesCount = useMemo(() => {
    return publishedClasses.filter(c => canEnroll(c)).length;
  }, [publishedClasses]);

  // Count classes per sport for published classes that can currently be enrolled
  const sportCounts = useMemo(() => {
    const counts = { all: openClassesCount };
    publishedClasses.forEach(cls => {
      if (canEnroll(cls)) {
        const cat = cls.category || 'Thể thao';
        counts[cat] = (counts[cat] || 0) + 1;
      }
    });
    return counts;
  }, [publishedClasses, openClassesCount]);

  // Build sport categories dynamically and ONLY show sports that have open enrollable classes
  const activeSportCategories = useMemo(() => {
    const fromClasses = publishedClasses.filter(c => canEnroll(c)).map(c => c.category).filter(Boolean);
    const unique = Array.from(new Set(fromClasses));
    return unique.sort((a, b) => (sportCounts[b] || 0) - (sportCounts[a] || 0));
  }, [publishedClasses, sportCounts]);

  useEffect(() => {
    checkScrollState();
    window.addEventListener('resize', checkScrollState);
    return () => window.removeEventListener('resize', checkScrollState);
  }, [activeSportCategories]);

  // Filter and sort classes
  const filteredAndSortedClasses = useMemo(() => {
    const now = new Date();

    const list = publishedClasses.filter(cls => {
      // 1. Sport category
      if (selectedCategory !== 'all' && cls.category !== selectedCategory) {
        return false;
      }

      // 2. Time of day
      if (selectedTimeOfDay !== 'all') {
        const startHour = parseInt((cls.startTime || '00:00').split(':')[0], 10);
        if (selectedTimeOfDay === 'morning' && startHour >= 12) return false;
        if (selectedTimeOfDay === 'afternoon' && (startHour < 12 || startHour >= 18)) return false;
        if (selectedTimeOfDay === 'evening' && startHour < 18) return false;
      }

      // 3. Availability
      const isBooked = (bookings || []).some(
        b => String(b.classId) === String(cls.id) &&
             String(b.memberId) === String(member?.id) &&
             b.status === 'confirmed'
      );
      if (selectedAvailability === 'booked' && !isBooked) return false;
      if (selectedAvailability === 'available') {
        const status = getClassStatus(cls, now);
        if (!status.isOpen || isBooked) return false;
      }

      // 4. Smart Search term
      if (debouncedSearch) {
        const term = debouncedSearch.toLowerCase();
        const matchName = (cls.name || '').toLowerCase().includes(term);
        const matchNameVi = (cls.nameVi || '').toLowerCase().includes(term);
        const matchCoach = (cls.coachName || '').toLowerCase().includes(term);
        const matchRoom = (cls.room || '').toLowerCase().includes(term);
        const matchRoomVi = (cls.roomVi || '').toLowerCase().includes(term);
        const matchCode = (cls.code || '').toLowerCase().includes(term);
        const matchCat = (cls.category || '').toLowerCase().includes(term);
        if (!matchName && !matchNameVi && !matchCoach && !matchRoom && !matchRoomVi && !matchCode && !matchCat) {
          return false;
        }
      }

      return true;
    });

    // Sorting: Default sorts open classes first by nearest start date, pushing started/full to the bottom
    if (sortBy === 'default') {
      list.sort((a, b) => {
        const statusA = getClassStatus(a, now);
        const statusB = getClassStatus(b, now);

        if (statusA.isOpen && !statusB.isOpen) return -1;
        if (!statusA.isOpen && statusB.isOpen) return 1;

        const schedA = calculateCourseSchedule(a);
        const schedB = calculateCourseSchedule(b);
        return schedA.firstSessionDate.getTime() - schedB.firstSessionDate.getTime();
      });
    } else if (sortBy === 'price_asc') {
      list.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (sortBy === 'spots_desc') {
      list.sort((a, b) => {
        const spotsA = Math.max(0, a.capacity - (a.enrolledCount || 0));
        const spotsB = Math.max(0, b.capacity - (b.enrolledCount || 0));
        return spotsB - spotsA;
      });
    }

    return list;
  }, [
    publishedClasses,
    selectedCategory,
    selectedTimeOfDay,
    selectedAvailability,
    debouncedSearch,
    sortBy,
    bookings,
    member
  ]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredAndSortedClasses.length / itemsPerPage) || 1;
  const paginatedClasses = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedClasses.slice(start, start + itemsPerPage);
  }, [filteredAndSortedClasses, currentPage, itemsPerPage]);

  // Horizontal scroll buttons handler
  const handleScrollSports = (direction) => {
    if (sportsScrollRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      sportsScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Booking action
  const handleBook = async (classId) => {
    setBookingLoadingId(classId);
    try {
      const res = await bookClass(classId, member?.id);
      if (res && res.success === false) {
        showToast(res.message || 'Không thể đăng ký lớp học này.', 'error');
      }
    } catch (err) {
      showToast(
        err?.message || (language === 'vi' ? 'Đã xảy ra lỗi khi đăng ký.' : 'Failed to enroll in class.'),
        'error'
      );
    } finally {
      setBookingLoadingId(null);
    }
  };

  // Cancellation confirm handler
  const handleConfirmCancel = async (bookingIdOrClassId) => {
    try {
      await cancelBooking(bookingIdOrClassId);
    } catch (err) {
      showToast(
        err?.message || (language === 'vi' ? 'Đã xảy ra lỗi khi hủy đăng ký.' : 'Failed to cancel enrollment.'),
        'error'
      );
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedCategory('all');
    setSearchInput('');
    setDebouncedSearch('');
    setSelectedTimeOfDay('all');
    setSelectedAvailability('all');
    setSortBy('default');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    debouncedSearch !== '' ||
    selectedTimeOfDay !== 'all' ||
    selectedAvailability !== 'all' ||
    sortBy !== 'default';

  const now = new Date();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-10 animate-in fade-in duration-200 font-sans">
      {/* ============================================================== */}
      {/* 1. KHÓA HỌC ĐANG THAM GIA / LỚP HỌC CỦA TÔI                     */}
      {/* ============================================================== */}
      <section className="space-y-6 pb-8 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-mlc-red mb-1">
              Khóa học đang tham gia
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-title text-slate-950 uppercase tracking-tight">
              Lớp học của tôi
            </h2>
            <p className="text-[14px] text-slate-600 mt-1">
              Tiến độ rèn luyện theo chuẩn 12 buổi/khóa và thông tin huấn luyện viên phụ trách.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveCenterVideoSport('all');
              setShowCenterVideoModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-300 hover:border-slate-900 text-slate-800 text-[13px] font-bold transition-all cursor-pointer shrink-0 bg-white hover:bg-slate-50 shadow-xs"
          >
            <Video className="w-4 h-4 text-mlc-red" />
            <span>Video trung tâm VIBE Sport</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {enrolledSportsList.map(({ id, course, coach, completedSessions, totalSessions, nextSessionTime, statusLabel }, idx) => {
            const progressPercent = Math.round((completedSessions / totalSessions) * 100);
            const isFirst = idx === 0;

            return (
              <div
                key={id}
                className={`rounded-2xl border bg-white p-5 flex flex-col justify-between space-y-4 transition-all duration-200 hover:shadow-md ${
                  isFirst
                    ? 'border-slate-900 border-b-4 border-b-mlc-red ring-1 ring-slate-900/10'
                    : 'border-slate-200 border-b-4 border-b-slate-300 hover:border-b-slate-400'
                }`}
              >
                <div className="space-y-3">
                  {/* Top card row: Category Icon, Title, Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-2xl mb-1 block">{getSportIcon(course.title)}</span>
                      <h4 className="text-lg font-black font-title text-slate-950 leading-snug">
                        {course.title}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">
                        Khóa K01 &bull; {course.titleEn || id}
                      </p>
                    </div>

                    <span className="text-[12px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {statusLabel}
                    </span>
                  </div>

                  {/* Progress bar (X / 12 sessions) */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-slate-600 font-medium">
                        Tiến độ: <strong className="text-slate-900">{completedSessions}/{totalSessions} buổi</strong>
                      </span>
                      <span className="font-bold text-slate-900">{progressPercent}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-mlc-red rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(progressPercent === 0 ? 0 : 6, progressPercent)}%` }}
                      />
                    </div>
                  </div>

                  {/* Coach info */}
                  <div className="flex items-center gap-2.5 pt-2 border-t border-slate-100 text-[13px]">
                    <img
                      src={coach.image}
                      alt={coach.name}
                      className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0 flex-1 truncate">
                      <span className="text-slate-500 text-xs block leading-none mb-0.5">HLV phụ trách</span>
                      <strong className="text-slate-900 font-semibold">{coach.name}</strong>
                    </div>
                  </div>

                  {/* Next session reminder */}
                  <div className="text-[12px] text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Lịch tới: <strong className="text-slate-900">{nextSessionTime}</strong></span>
                  </div>
                </div>

                {/* Single Action: View details & sport training video */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSportForDetail(course);
                    setModalMediaTab('video');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-slate-800 text-[13px] font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs group"
                >
                  <Play className="w-3.5 h-3.5 fill-mlc-red text-mlc-red group-hover:scale-110 transition-transform" />
                  <span>Chi tiết môn &amp; Video</span>
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ============================================================== */}
      {/* 2. TẤT CẢ LỚP HỌC & HỌC PHÍ CÁC MÔN (ĐĂNG KÝ MỚI)               */}
      {/* ============================================================== */}
      <div className="bg-[#202B46] border border-slate-800/80 rounded-3xl p-4 sm:p-6 lg:p-7 text-white shadow-xl space-y-6">
        {/* Top Header Section with Reference System Signature: "HỌC PHÍ CÁC MÔN" + Red Underline */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white flex items-center gap-2">
              <span>HỌC PHÍ</span>
              <span className="text-[#24A9D2]">CÁC MÔN</span>
            </h2>
            <span className="text-[11px] font-bold text-[#98D9E8] bg-brand-dark border border-brand-accent/40 px-2.5 py-0.5 rounded-full">
              VIBE Sport Center
            </span>
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
              &bull; <strong className="text-white font-bold tabular-nums">{openClassesCount}</strong> lớp đang mở đăng ký
            </span>
          </div>
          {/* Distinct Red Underline Bar under "HỌC PHÍ" (From reference image) */}
          <div className="w-20 h-1 bg-brand-primary rounded-full mt-2 mb-2" />
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            {language === 'vi'
              ? 'Đăng ký các khóa đào tạo thể thao chuyên nghiệp cùng đội ngũ Huấn luyện viên đạt chuẩn quốc tế.'
              : 'Enrol in high-performance sports training courses with certified coaches at VIBE Sport Center.'}
          </p>
        </div>

        {/* Search bar & Filter trigger */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={language === 'vi' ? 'Tìm lớp, bộ môn, HLV, sân tập...' : 'Search class, coach, court...'}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-[#303B58] border border-slate-700/80 rounded-lg text-xs text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Advanced Filters Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
              showAdvancedFilters || hasActiveFilters
                ? 'bg-brand-blue-soft border-brand-primary text-brand-primary'
                : 'bg-[#303B58] border-slate-700/80 text-slate-300 hover:bg-slate-800'
            }`}
            title={language === 'vi' ? 'Bộ lọc nâng cao' : 'Advanced filters'}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">{language === 'vi' ? 'Bộ lọc' : 'Filters'}</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-brand-primary" />
            )}
          </button>
        </div>
      </div>

      {/* Scrollable Sport Category Bar on Dark Theme */}
      <div className="relative flex items-center rounded-2xl border border-slate-200 bg-white p-2.5 shadow-2xs">
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => handleScrollSports('left')}
            className="p-1.5 bg-[#303B58] hover:bg-slate-800 border border-slate-700/80 text-slate-300 rounded-md shadow-sm mr-1.5 shrink-0 cursor-pointer flex items-center justify-center transition-colors"
            title="Cuộn sang trái"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Clean Scroll Container with Hidden Scrollbar */}
        <div
          ref={sportsScrollRef}
          onScroll={checkScrollState}
          className="flex items-center gap-2 overflow-x-auto pb-1 scroll-smooth flex-1 scrollbar-none [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <label className="relative block min-w-56">
            <SlidersHorizontal className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} aria-label={language === 'vi' ? 'Lọc theo bộ môn' : 'Filter by sport'} className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/80 pl-8 pr-7 text-xs font-semibold text-slate-700 hover:bg-white focus:border-blue-500 focus:outline-none">
              <option value="all">{language === 'vi' ? `Tất cả bộ môn (${openClassesCount})` : `All sports (${openClassesCount})`}</option>
              {activeSportCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </label>

        </div>

        {canScrollRight && (
          <button
            type="button"
            onClick={() => handleScrollSports('right')}
            className="p-1.5 bg-[#303B58] hover:bg-slate-800 border border-slate-700/80 text-slate-300 rounded-md shadow-sm ml-1.5 shrink-0 cursor-pointer flex items-center justify-center transition-colors"
            title="Cuộn sang phải"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Active Filter Chips Bar */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="text-slate-400 font-medium text-[11px]">Đang lọc:</span>

          {selectedCategory !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#303B58] text-slate-200 text-[11px] font-semibold border border-slate-700">
              <span>Môn: {selectedCategory}</span>
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className="hover:text-brand-accent cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {selectedTimeOfDay !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#303B58] text-slate-200 text-[11px] font-semibold border border-slate-700">
              <span>
                Khung giờ: {selectedTimeOfDay === 'morning' ? 'Sáng' : selectedTimeOfDay === 'afternoon' ? 'Chiều' : 'Tối'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedTimeOfDay('all')}
                className="hover:text-brand-accent cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {selectedAvailability !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#303B58] text-slate-200 text-[11px] font-semibold border border-slate-700">
              <span>{selectedAvailability === 'available' ? 'Còn chỗ' : 'Đã ghi danh'}</span>
              <button
                type="button"
                onClick={() => setSelectedAvailability('all')}
                className="hover:text-brand-accent cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {debouncedSearch && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#303B58] text-slate-200 text-[11px] font-semibold border border-slate-700">
              <span>Từ khóa: "{debouncedSearch}"</span>
              <button
                type="button"
                onClick={() => { setSearchInput(''); setDebouncedSearch(''); }}
                className="hover:text-brand-accent cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={handleResetFilters}
            className="text-brand-accent hover:text-brand-sky-soft hover:underline font-semibold text-[11px] ml-1 cursor-pointer"
          >
            Xóa tất cả bộ lọc
          </button>
        </div>
      )}

      {/* Collapsible Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#303B58] p-4 rounded-xl border border-slate-800 animate-in slide-in-from-top-2 duration-150">
          {/* Filter by Time */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              {language === 'vi' ? 'Khung giờ học' : 'Time of Day'}
            </label>
            <select
              value={selectedTimeOfDay}
              onChange={(e) => setSelectedTimeOfDay(e.target.value)}
              className="w-full bg-[#202B46] border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:ring-1 focus:ring-brand-primary"
            >
              <option value="all">{language === 'vi' ? 'Tất cả khung giờ' : 'All Times'}</option>
              <option value="morning">{language === 'vi' ? 'Buổi sáng (trước 12:00)' : 'Morning (Before 12:00)'}</option>
              <option value="afternoon">{language === 'vi' ? 'Buổi chiều (12:00 - 18:00)' : 'Afternoon (12:00 - 18:00)'}</option>
              <option value="evening">{language === 'vi' ? 'Buổi tối (sau 18:00)' : 'Evening (After 18:00)'}</option>
            </select>
          </div>

          {/* Filter by Availability */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              {language === 'vi' ? 'Trạng thái chỗ' : 'Availability'}
            </label>
            <select
              value={selectedAvailability}
              onChange={(e) => setSelectedAvailability(e.target.value)}
              className="w-full bg-[#202B46] border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:ring-1 focus:ring-brand-primary"
            >
              <option value="all">{language === 'vi' ? 'Tất cả trạng thái' : 'All Status'}</option>
              <option value="available">{language === 'vi' ? 'Chỉ lớp còn chỗ trống' : 'Available Spots Only'}</option>
              <option value="booked">{language === 'vi' ? 'Lớp tôi đã ghi danh' : 'My Enrolled Classes'}</option>
            </select>
          </div>

          {/* Sort by */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              {language === 'vi' ? 'Sắp xếp theo' : 'Sort by'}
            </label>
            <div className="flex items-center gap-1.5">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-[#202B46] border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:ring-1 focus:ring-brand-primary"
              >
                <option value="default">{language === 'vi' ? 'Mặc định (Sắp diễn ra)' : 'Default'}</option>
                <option value="price_asc">{language === 'vi' ? 'Học phí: Thấp đến Cao' : 'Price: Low to High'}</option>
                <option value="price_desc">{language === 'vi' ? 'Học phí: Cao đến Thấp' : 'Price: High to Low'}</option>
                <option value="spots_desc">{language === 'vi' ? 'Chỗ trống: Nhiều nhất' : 'Most spots left'}</option>
              </select>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="p-1.5 text-slate-400 hover:text-white bg-[#202B46] hover:bg-slate-800 border border-slate-700 rounded-md transition-colors cursor-pointer shrink-0"
                  title={language === 'vi' ? 'Đặt lại bộ lọc' : 'Reset filters'}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightweight Policy & Privilege Notice Bar */}
      <div className="bg-[#303B58]/90 border border-slate-800 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-slate-300 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            {memberPkg && memberPkg.tier >= 2 ? (
              <span>
                {language === 'vi'
                  ? `Đang áp dụng ưu đãi ${memberPkg.nameVi || 'VIP'} (giảm ${memberPkg.tier >= 3 ? '20%' : '10%'} học phí khóa học).`
                  : `Applying ${memberPkg.nameVi || 'VIP'} benefit (${memberPkg.tier >= 3 ? '20%' : '10%'} off).`}
              </span>
            ) : (
              <span>
                {language === 'vi'
                  ? 'Lớp sinh hoạt miễn phí theo Gói Hội Viên. Nâng cấp thẻ VIP để được giảm tới 20% học phí mọi khóa học.'
                  : 'Free community classes included. Upgrade to VIP to enjoy up to 20% off all courses.'}
              </span>
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowPolicyModal(true)}
          className="text-[11px] font-bold text-brand-accent hover:text-brand-sky-soft hover:underline cursor-pointer inline-flex items-center gap-1 shrink-0"
        >
          <span>{language === 'vi' ? 'Xem chính sách ưu đãi' : 'View policy'}</span>
          <span>&rarr;</span>
        </button>
      </div>

      {/* Main Class Cards Grid (Dark Athletic System with Square Red Sport Badges) */}
      {filteredAndSortedClasses.length === 0 ? (
        <div className="bg-[#303B58] border border-slate-800 rounded-2xl p-12 text-center shadow-lg space-y-3">
          <div className="w-14 h-14 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto text-slate-400">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              {language === 'vi' ? 'Không tìm thấy lớp học phù hợp' : 'No classes found'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {language === 'vi'
                ? 'Không có lớp học nào thỏa mãn các điều kiện lọc hiện tại. Bạn vui lòng thử chọn bộ môn khác hoặc xóa từ khóa tìm kiếm.'
                : 'No classes match your current filter criteria. Try clearing filters or selecting another sport.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Xóa tất cả bộ lọc' : 'Clear All Filters'}</span>
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedClasses.map((cls) => {
              const meta = SPORT_META[cls.category] || DEFAULT_SPORT_META;
              const cardImage = meta.image || DEFAULT_SPORT_META.image;

              const bookedBooking = (bookings || []).find(
                b => String(b.classId) === String(cls.id) &&
                     String(b.memberId) === String(member?.id) &&
                     b.status === 'confirmed'
              );
              const isAlreadyBooked = Boolean(bookedBooking);
              const isFull = (cls.enrolledCount || 0) >= cls.capacity;
              const isTierBlocked = Boolean(memberPkg && cls.minTierRequired && memberPkg.tier < cls.minTierRequired);
              const spotsLeft = Math.max(0, cls.capacity - (cls.enrolledCount || 0));

              // Consistent enrollment progress calculation
              const enrollmentPercent = Math.min(100, Math.round(((cls.enrolledCount || 0) / cls.capacity) * 100));

              // Registration deadline check (closes 30 minutes before start)
              const startDateTime = new Date(`${cls.date || cls.startDate}T${cls.startTime}:00`);
              const isRegistrationClosed = now >= new Date(startDateTime.getTime() - 30 * 60 * 1000);

              // Cancellation policy check (free cancel before 24h)
              const hoursToStart = Math.round((startDateTime.getTime() - now.getTime()) / (1000 * 60 * 60));
              const canSelfCancel = hoursToStart >= 24;

              // Schedule info & status
              const schedule = calculateCourseSchedule(cls);
              const sessionCount = cls.sessionCount || 12;
              const totalCourseFee = cls.price == null ? null : Number(cls.price);
              const hasCoursePrice = Number.isFinite(totalCourseFee) && totalCourseFee >= 0;
              const isFreeClass = Boolean(cls.isFree) || (hasCoursePrice && totalCourseFee === 0);

              // Member Package & Tier Privileges (Hybrid Model)
              const memberTier = Number(memberPkg?.tier || 1);
              const discountRate = memberTier >= 3 ? 0.20 : memberTier === 2 ? 0.10 : 0;
              const hasVipDiscount = Boolean(memberPkg && memberPkg.tier >= 2 && discountRate > 0);
              const memberPrice = hasCoursePrice
                ? discountRate > 0 ? Math.round(totalCourseFee * (1 - discountRate)) : totalCourseFee
                : null;

              // Status determination
              const statusInfo = getClassStatus(cls, now);
              const hasCoach = cls.coachName && cls.coachName !== 'Chưa phân công' && !cls.coachName.includes('Chưa');

              return (
                <div
                  key={cls.id}
                  className="bg-[#303B58] border border-slate-800/90 hover:border-slate-700 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col h-full group"
                >
                  {/* Top Court Image Area (16:9 ratio) */}
                  <div className="relative aspect-16/9 w-full bg-slate-950 overflow-hidden shrink-0">
                    <img
                      src={cardImage}
                      alt={cls.category || 'Sport'}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#303B58] via-transparent to-transparent opacity-80" />

                    {/* Top Right: Distinct Red Square Sport Badge with white icon (Matches reference image) */}
                    <div className="absolute top-3 right-3 z-10">
                      <div className="w-11 h-11 rounded-xl bg-brand-primary shadow-lg flex items-center justify-center transition-transform group-hover:scale-110 duration-200">
                        <SportSquareBadge category={cls.category} />
                      </div>
                    </div>

                    {/* Top Left: Abnormal Status badge only if abnormal */}
                    {statusInfo.isAbnormal && (
                      <div className="absolute top-3 left-3 z-10">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md shadow-md uppercase tracking-wider ${statusInfo.pillClass}`}>
                          {language === 'vi' ? statusInfo.labelVi : statusInfo.labelEn}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Content Body */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      {/* Class Title (Bold Uppercase White) */}
                      <h3 className="text-lg font-black text-white uppercase tracking-wide group-hover:text-brand-accent transition-colors leading-tight">
                        {cls.nameVi || cls.name}
                      </h3>

                      {/* Tuition / Price line (From screenshot: "Từ 2.200.000 đ / 12 buổi") */}
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-xs text-slate-400 font-medium">
                          {language === 'vi' ? 'Học phí' : 'Tuition'}
                        </span>

                        {!hasCoursePrice ? (
                          <span className="text-sm font-bold text-amber-300">
                            {language === 'vi' ? 'Chưa có thông tin giá' : 'Price unavailable'}
                          </span>
                        ) : isFreeClass ? (
                          <span className="text-sm font-bold text-emerald-400 uppercase bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded">
                            {language === 'vi' ? 'Miễn phí' : 'Free'}
                          </span>
                        ) : hasVipDiscount ? (
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="line-through text-slate-500 text-xs tabular-nums">
                              {totalCourseFee.toLocaleString('vi-VN')} đ
                            </span>
                            <strong className="text-lg font-black text-[#24A9D2] tabular-nums">
                              {memberPrice.toLocaleString('vi-VN')} đ
                            </strong>
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 border border-amber-800/60 px-1 py-0.2 rounded">
                              VIP -{discountRate * 100}%
                            </span>
                          </div>
                        ) : (
                          <strong className="text-lg font-black text-[#24A9D2] tabular-nums">
                            {totalCourseFee.toLocaleString('vi-VN')} đ
                          </strong>
                        )}

                        <span className="text-xs text-slate-400">
                          / {sessionCount} buổi
                        </span>
                      </div>

                      {/* Specification List with distinct red dash (-) bullets (Matches screenshot) */}
                      <div className="space-y-1.5 pt-1 text-xs text-slate-300">
                        <div className="flex items-start gap-2">
                          <span className="text-[#24A9D2] font-bold shrink-0 text-sm leading-4">—</span>
                          <span>
                            <strong className="text-slate-200">Lịch:</strong> {schedule.daysText} &bull; {cls.startTime} - {cls.endTime || ''}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-[#24A9D2] font-bold shrink-0 text-sm leading-4">—</span>
                          <span>
                            <strong className="text-slate-200">Khai giảng:</strong> {schedule.startFormatted} - {schedule.endFormatted}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-[#24A9D2] font-bold shrink-0 text-sm leading-4">—</span>
                          <span className="truncate">
                            <strong className="text-slate-200">Sân tập:</strong> {language === 'vi' ? (cls.roomVi || cls.room) : cls.room}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-[#24A9D2] font-bold shrink-0 text-sm leading-4">—</span>
                          <span>
                            <strong className="text-slate-200">HLV:</strong> {hasCoach ? cls.coachName : (language === 'vi' ? 'Thông báo trước khai giảng' : 'To be announced')}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-[#24A9D2] font-bold shrink-0 text-sm leading-4">—</span>
                          <span>
                            <strong className="text-slate-200">Sức chứa:</strong> Còn <strong className="text-white font-bold tabular-nums">{spotsLeft}</strong> chỗ (Tối đa {cls.capacity} học viên)
                          </span>
                        </div>

                        {/* Progress bar only when enrolledCount > 0 */}
                        {(cls.enrolledCount || 0) > 0 && (
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                            <div
                              className={`h-full transition-all duration-300 ${isFull ? 'bg-rose-500' : 'bg-emerald-500'}`}
                              style={{ width: `${enrollmentPercent}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Area (Matches high-contrast button in screenshot) */}
                    <div className="pt-3 border-t border-slate-800/80">
                      {isAlreadyBooked ? (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 py-2.5 px-3 bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>{language === 'vi' ? 'ĐÃ GHI DANH' : 'ENROLLED'}</span>
                          </div>
                          {canSelfCancel && (
                            <button
                              type="button"
                              onClick={() => setCancellingClass(cls)}
                              className="text-xs text-rose-400 hover:text-rose-300 hover:underline px-2 py-2 cursor-pointer font-medium"
                            >
                              {language === 'vi' ? 'Hủy' : 'Cancel'}
                            </button>
                          )}
                        </div>
                      ) : statusInfo.key === 'started' ? (
                        <div className="w-full py-2.5 bg-slate-800/80 text-slate-400 border border-slate-700/60 rounded-lg text-xs font-bold text-center uppercase tracking-wider">
                          {language === 'vi' ? 'Đã khai giảng' : 'Started'}
                        </div>
                      ) : statusInfo.key === 'postponed' ? (
                        <div className="w-full py-2.5 bg-rose-950/80 text-rose-300 border border-rose-800/60 rounded-lg text-xs font-bold text-center uppercase tracking-wider">
                          {language === 'vi' ? 'Chưa đủ sĩ số' : 'Postponed'}
                        </div>
                      ) : isRegistrationClosed ? (
                        <div className="w-full py-2.5 bg-slate-800/80 text-slate-400 border border-slate-700/60 rounded-lg text-xs font-bold text-center uppercase tracking-wider">
                          {language === 'vi' ? 'Đã chốt danh sách' : 'Registration Closed'}
                        </div>
                      ) : !hasCoursePrice ? (
                        <div className="w-full py-2.5 bg-amber-950/60 text-amber-300 border border-amber-800/60 rounded-lg text-xs font-bold text-center uppercase tracking-wider">
                          {language === 'vi' ? 'Chưa có giá' : 'Price unavailable'}
                        </div>
                      ) : isTierBlocked ? (
                        <div className="w-full py-2.5 bg-slate-800/80 text-slate-400 border border-slate-700/60 rounded-lg text-xs font-bold text-center uppercase tracking-wider">
                          Yêu cầu thẻ VIP
                        </div>
                      ) : isFull ? (
                        <div className="w-full py-2.5 bg-rose-950/80 text-rose-300 border border-rose-800/60 rounded-lg text-xs font-bold text-center uppercase tracking-wider">
                          {language === 'vi' ? 'Hết chỗ' : 'Full'}
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={Boolean(bookingLoadingId)}
                          onClick={() => setEnrollingClass(cls)}
                          className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-brand-primary active:scale-[0.98] font-black uppercase text-xs tracking-wider rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {bookingLoadingId === cls.id ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                              <span>{language === 'vi' ? 'Đang gửi...' : 'Processing...'}</span>
                            </>
                          ) : (
                            <>
                              <span>{language === 'vi' ? 'ĐĂNG KÝ NGAY' : 'REGISTER NOW'}</span>
                              <span>&rarr;</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls on Dark Theme */}
          {totalPages > 1 && (
            <div className="bg-[#303B58] border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
              <div>
                {language === 'vi' ? (
                  <>
                    Hiển thị <strong className="text-white font-bold tabular-nums">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredAndSortedClasses.length)}</strong> trên tổng số <strong className="text-white font-bold tabular-nums">{filteredAndSortedClasses.length}</strong> lớp học
                  </>
                ) : (
                  <>
                    Showing <strong className="text-white font-bold tabular-nums">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredAndSortedClasses.length)}</strong> of <strong className="text-white font-bold tabular-nums">{filteredAndSortedClasses.length}</strong> classes
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-[#202B46] text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>{language === 'vi' ? 'Trước' : 'Prev'}</span>
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNumber => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setCurrentPage(pageNumber)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors cursor-pointer tabular-nums ${
                      currentPage === pageNumber
                        ? 'bg-brand-primary text-white shadow-md'
                        : 'bg-[#202B46] border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-[#202B46] text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>{language === 'vi' ? 'Sau' : 'Next'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
      </div>

      {/* Confirmation Dialog for Canceling Booking */}
      <CancelClassBookingModal
        isOpen={Boolean(cancellingClass)}
        onClose={() => setCancellingClass(null)}
        classItem={cancellingClass}
        bookingItem={(bookings || []).find(
          b => String(b.classId) === String(cancellingClass?.id) &&
               String(b.memberId) === String(member?.id) &&
               b.status === 'confirmed'
        )}
        onConfirmCancel={handleConfirmCancel}
        language={language}
      />

      {/* Enrollment Confirmation Modal */}
      <EnrollClassModal
        isOpen={Boolean(enrollingClass)}
        onClose={() => setEnrollingClass(null)}
        classItem={enrollingClass}
        member={member}
        language={language}
        onConfirmEnroll={async (classId) => {
          return await bookClass(classId);
        }}
        onNavigateAttendance={() => navigate('/member/attendance')}
      />

      {/* Policy & Privileges Modal */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>
                    {language === 'vi' ? 'Chính sách ưu đãi & ghi danh khóa học' : 'Course Privileges & Policies'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'vi'
                    ? 'Quy định hội viên, quyền lợi giảm học phí và chính sách hoàn hủy.'
                    : 'Membership tiers, tuition discounts and cancellation guidelines.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPolicyModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-600">
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 space-y-1.5">
                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                  <span>{language === 'vi' ? 'Ưu đãi theo hạng thẻ hội viên' : 'Membership Tier Benefits'}</span>
                </div>
                <ul className="space-y-1 text-amber-950 pl-4 list-disc">
                  <li>
                    <strong>Standard / Hội viên cơ bản:</strong> {language === 'vi' ? 'Miễn phí sinh hoạt định kỳ, học phí khóa học thu theo giá tiêu chuẩn.' : 'Free community sessions, standard course pricing.'}
                  </li>
                  <li>
                    <strong>Pro (Hạng 2):</strong> {language === 'vi' ? 'Giảm 10% học phí cho mọi khóa đào tạo chuyên sâu.' : '10% discount on all advanced coaching courses.'}
                  </li>
                  <li>
                    <strong>VIP / Diamond (Hạng 3):</strong> {language === 'vi' ? 'Giảm 20% học phí và ưu tiên giữ chỗ khi lớp mở đăng ký.' : '20% discount and priority booking when courses open.'}
                  </li>
                </ul>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                <div className="font-bold text-slate-800">
                  {language === 'vi' ? 'Chính sách hủy & hoàn phí' : 'Cancellation & Refund Rules'}
                </div>
                <ul className="space-y-1 pl-4 list-disc text-slate-600">
                  <li>
                    {language === 'vi'
                      ? 'Học viên có thể tự hủy đăng ký trước ngày khai giảng tối thiểu 24 giờ và nhận hoàn 100% học phí về số dư tài khoản.'
                      : 'Free cancellation at least 24 hours prior to course start date with 100% account credit refund.'}
                  </li>
                  <li>
                    {language === 'vi'
                      ? 'Sau khi khóa học đã khai giảng, hệ thống đóng quyền hủy. Trường hợp lý do y tế/bất khả kháng, vui lòng liên hệ quầy lễ tân để được bảo lưu tối đa 30 ngày.'
                      : 'Cancellations closed once course has started. Medical exemptions may apply for course retention up to 30 days.'}
                  </li>
                </ul>
              </div>

              <div className="text-[11px] text-slate-500 italic">
                {language === 'vi'
                  ? '* Tất cả lớp học đều cam kết Huấn luyện viên chuyên nghiệp, sân tập đạt chuẩn giải đấu.'
                  : '* All classes are guided by certified coaches on tournament-grade sports facilities.'}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPolicyModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                {language === 'vi' ? 'Đã hiểu' : 'Understood'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. MODAL: CHI TIẾT MÔN & VIDEO (TỪNG MÔN CÓ VIDEO RIÊNG BIỆT) */}
      {/* ============================================================== */}
      {selectedSportForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl text-white">
            {/* Modal Top Bar */}
            <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between gap-4 sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getSportIcon(selectedSportForDetail.title)}</span>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-mlc-red">
                    Khóa đào tạo chuyên sâu &bull; {selectedSportForDetail.titleEn || selectedSportForDetail.id}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black font-title text-white">
                    {selectedSportForDetail.title}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSportForDetail(null)}
                className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
                title="Đóng cửa sổ"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Media Player Area */}
            <div className="p-5 sm:p-6 space-y-4">
              <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-video shadow-lg">
                {modalMediaTab === 'video' ? (
                  <video
                    key={selectedSportForDetail.id}
                    src={SPORT_VIDEOS[selectedSportForDetail.id] || '/videos/courses/archery.mp4'}
                    controls
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                    poster={selectedSportForDetail.image}
                  />
                ) : (
                  <img
                    src={selectedSportForDetail.image}
                    alt={selectedSportForDetail.title}
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Media Switcher Tab inside media player */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-md p-1 rounded-full border border-white/20">
                  <button
                    type="button"
                    onClick={() => setModalMediaTab('video')}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      modalMediaTab === 'video'
                        ? 'bg-mlc-red text-white shadow-sm'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Video kỹ thuật</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalMediaTab('photo')}
                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      modalMediaTab === 'photo'
                        ? 'bg-mlc-red text-white shadow-sm'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ảnh sân tập</span>
                  </button>
                </div>
              </div>

              {/* Course Detailed Description & Objectives */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                {/* Column 1: Objectives & Curriculum */}
                <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3.5">
                  <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-wide">
                    <Target className="w-4 h-4 text-mlc-red" />
                    <span>Mục tiêu rèn luyện chuẩn 12 buổi</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {selectedSportForDetail.intro}
                  </p>
                  <div className="space-y-2 pt-1 border-t border-white/10">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Kỹ năng cốt lõi rèn luyện:
                    </span>
                    <ul className="space-y-2">
                      {(selectedSportForDetail.goals || [
                        'Làm quen kỹ thuật căn bản và tư thế chuyển động chuẩn',
                        'Thực hành nhịp nhàng cùng huấn luyện viên',
                        'Quan sát kết quả và chỉnh sửa động tác trực tiếp trên sân'
                      ]).map((goal, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-slate-200">
                          <span className="text-mlc-red font-bold shrink-0 mt-0.5">&bull;</span>
                          <span>{goal}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Column 2: Coach & Court specifications */}
                {(() => {
                  const coach = publicCoaches.find(c => c.sportId === selectedSportForDetail.id) || publicCoaches[0];
                  return (
                    <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-4">
                      <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-wide">
                        <Users className="w-4 h-4 text-mlc-red" />
                        <span>Huấn luyện viên &amp; Sân tập</span>
                      </div>

                      <div className="flex items-center gap-3.5">
                        <img
                          src={coach.image}
                          alt={coach.name}
                          className="w-13 h-13 rounded-2xl object-cover border border-white/20 shrink-0 shadow-md"
                        />
                        <div>
                          <strong className="text-base font-bold text-white block">
                            {coach.name}
                          </strong>
                          <span className="text-xs text-mlc-red font-semibold uppercase">
                            HLV Trưởng bộ môn {selectedSportForDetail.title}
                          </span>
                          <p className="text-[12px] text-slate-400 mt-0.5 leading-snug">
                            Chứng chỉ huấn luyện quốc tế, trực tiếp hướng dẫn và chỉnh sửa kỹ thuật từng học viên.
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/10 space-y-1.5 text-xs text-slate-300">
                        <div className="flex items-center gap-2 font-semibold text-white">
                          <MapPin className="w-3.5 h-3.5 text-mlc-red" />
                          <span>Khu vực sân tập tiêu chuẩn:</span>
                        </div>
                        <p className="pl-5 text-slate-400 leading-relaxed">
                          {selectedSportForDetail.space || 'Khu phức hợp thể thao đa năng VIBE Sport'} &bull; Cửa từ Turnstile kiểm soát tự động.
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Modal Bottom Footer */}
            <div className="p-5 sm:p-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/50">
              <div className="text-xs text-slate-400">
                Chuẩn đào tạo 12 buổi &bull; Học viên được bảo lưu tối đa 30 ngày theo quy chế.
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSelectedSportForDetail(null)}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-full border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/courses/${selectedSportForDetail.id}`);
                  }}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-full bg-mlc-red hover:bg-brand-primary-hover text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-mlc transition-all"
                >
                  <span>Xem trang giới thiệu</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. MODAL: VIDEO TRUNG TÂM VIBE SPORT (CHỌN TẤT CẢ 9 MÔN)      */}
      {/* ============================================================== */}
      {showCenterVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl text-white">
            <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between gap-4 sticky top-0 bg-slate-900/95 backdrop-blur-md z-10">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-mlc-red">
                  Cơ sở vật chất &bull; VIBE Sport Center
                </div>
                <h3 className="text-xl sm:text-2xl font-black font-title text-white">
                  Video Giới Thiệu Trung Tâm Thể Thao VIBE Sport
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setShowCenterVideoModal(false)}
                className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
                title="Đóng cửa sổ"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              {/* Category pills to switch videos */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {ALL_SPORTS_TABS.map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveCenterVideoSport(tab.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                      activeCenterVideoSport === tab.id
                        ? 'bg-mlc-red text-white shadow-md'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Video Player */}
              <div className="rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-video shadow-xl">
                {(() => {
                  const activeTab = ALL_SPORTS_TABS.find(t => t.id === activeCenterVideoSport) || ALL_SPORTS_TABS[0];
                  return (
                    <video
                      key={activeTab.id}
                      src={activeTab.video}
                      controls
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                      poster={activeTab.poster}
                    />
                  );
                })()}
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 text-xs text-slate-300 space-y-2">
                <div className="font-bold text-white text-sm">
                  Trung tâm Thể thao Đa năng Chuẩn Quốc Tế VIBE Sport
                </div>
                <p className="leading-relaxed text-slate-400">
                  Hệ thống 9 bộ môn thể thao với mặt sân Taraflex, Plexicushion, DUPR tiêu chuẩn giải đấu. Kiểm soát vào sân tự động bằng mã QR động và thẻ điện tử VIBE Access tại các cổng Turnstile.
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCenterVideoModal(false)}
                className="px-6 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
