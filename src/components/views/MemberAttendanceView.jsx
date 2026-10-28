import React, { useState, useMemo, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useSCMS } from "../../context/SCMSContext"
import { ClassFeedbackModal } from "../modals/ClassFeedbackModal"
import {
  AttendancePolicyModal,
  ATTENDANCE_POLICY,
} from "../modals/AttendancePolicyModal"
import { LeaveRequestModal } from "../modals/LeaveRequestModal"
import { SportTargetVisual } from "../common/SportTargetVisual"
import { memberPortalApi } from "../../api/memberPortalApi"
import { getAuthoritativeProfileId } from "../../utils/memberSafetyHelpers"
import { QRCodeSVG } from "qrcode.react"
import { motion, AnimatePresence } from "motion/react"
import {
  Check,
  Minus,
  Lock,
  QrCode,
  SlidersHorizontal,
  ArrowRight,
  X,
  Star,
  Sparkles,
  ShieldCheck,
  Radio,
  Award,
  Calendar,
  RefreshCw,
  Loader2,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react"

/**
 * FIXED SERVER DATE (Asia/Ho_Chi_Minh)
 * Standardized date: 2026-10-14 (Thứ 4, 14 tháng 10 năm 2026)
 */
const SERVER_TODAY = "2026-10-14"

/**
 * STATE MACHINE ENUM FOR SESSIONS
 * upcoming -> gate_locked -> check_in_open -> checked_in -> completed | absent
 */
export const SESSION_STATE = {
  UPCOMING: "upcoming", // Chưa đến ngày / giờ (còn hơn 30 phút trước mở cổng)
  GATE_LOCKED: "gate_locked", // Ngày diễn ra nhưng cổng soát vé đang khóa
  CHECK_IN_OPEN: "check_in_open", // Cổng đang mở (-30m trước giờ học đến +15m sau giờ học)
  CHECKED_IN: "checked_in", // Quý hội viên đã hoàn tất check-in vào sân
  COMPLETED: "completed", // Buổi học đã kết thúc
  ABSENT: "absent", // Quá 15 phút sau giờ bắt đầu không check-in -> Vắng
}

/**
 * SINGLE SOURCE OF TRUTH: CLUB COURSES & VIP MASTERY PASSPORT CURRICULUM
 * Fully enriched with 12 technical topics, skill evaluation benchmarks, and club amenities.
 */
export const CLUB_COURSES = {
  badminton: {
    id: "badminton",
    code: "BDM-K01",
    name: "Cầu lông K01",
    discipline: "Cầu lông",
    totalSessions: 12,
    threshold: 9,
    maxAbsent: 3,
    coach: "HLV Lê Thị Mai",
    coachTitle: "HLV Chuyên nghiệp Cầu lông",
    coachImage: "/images/coaches/badminton.jpg",
    courseImage: "/images/courses/badminton.jpg",
    court: "Sân 02",
    zone: "Khu A · Thảm Taraflex tiêu chuẩn BWF",
    gate: "Cổng số 02",
    scheduleDay: "Thứ 2 hàng tuần",
    timeRange: "06:00 – 07:30",
    startTime: "06:00",
    endTime: "07:30",
    amenities: {
      locker: "Tủ Locker VIP #18 (Khu Thay Đồ Block A)",
      courtReady:
        "Sân 02 thảm Taraflex đã kiểm tra độ nảy & chuẩn bị cầu thi đấu Victor Champion",
      concierge:
        "Khăn lạnh ướp hương sả & bình nước ion thể thao sẵn sàng tại bàn HLV",
      vipLane: "Cổng số 02 · Làn ưu tiên VIP (Fast Track)",
    },
    sessions: [
      {
        num: 1,
        date: "2026-10-12",
        dayVi: "Thứ 2, 12/10",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Thị Mai",
        court: "Sân 02",
        zone: "Khu A · Thảm Taraflex tiêu chuẩn BWF",
        status: "completed",
        attendance: "present",
        checkinTime: "05:55",
        topic: "Nhập môn V-Grip & Bộ chân di chuyển 6 góc sân",
        skillScores: {
          control: 5.0,
          movement: 4.8,
          tactics: 4.5,
          stamina: 4.8,
        },
        coachRemark:
          "Tiếp thu kỹ thuật rất nhanh, chuyển trọng tâm linh hoạt và động tác vung vợt mượt.",
        feedback: {
          rating: 5,
          comment: "HLV hướng dẫn kỹ thuật di chuyển và đập cầu rất kỹ.",
        },
      },
      {
        num: 2,
        date: "2026-10-19",
        dayVi: "Thứ 2, 19/10",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Thị Mai",
        court: "Sân 02",
        zone: "Khu A · Thảm Taraflex tiêu chuẩn BWF",
        status: "upcoming",
        topic: "Giao bóng cao sâu & Kỹ thuật phông cầu cuối sân",
        curriculumAdaptation:
          "Dành 15 phút đầu giờ bổ trợ phản xạ lưới & kỹ thuật di chuyển 6 góc theo ghi chú của bạn ở Buổi 1.",
      },
      {
        num: 3,
        date: "2026-10-26",
        dayVi: "Thứ 2, 26/10",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Thị Mai",
        court: "Sân 02",
        zone: "Khu A · Thảm Taraflex tiêu chuẩn BWF",
        status: "upcoming",
        topic: "Kỹ thuật đập cầu (Smash) & Bật nhảy tấn công",
      },
      {
        num: 4,
        date: "2026-11-02",
        dayVi: "Thứ 2, 02/11",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Thị Mai",
        court: "Sân 02",
        zone: "Khu A · Thảm Taraflex tiêu chuẩn BWF",
        status: "upcoming",
        topic: "Kỹ thuật cắt cầu sát lưới (Drop shot) & Chém cầu",
      },
      {
        num: 5,
        date: "2026-11-09",
        dayVi: "Thứ 2, 09/11",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Thị Mai",
        court: "Sân 02",
        zone: "Khu A · Thảm Taraflex tiêu chuẩn BWF",
        status: "upcoming",
        topic: "Kỹ thuật đẩy cầu nhanh & Đỡ đập cầu sát mép lưới",
      },
      {
        num: 6,
        date: "2026-11-16",
        dayVi: "Thứ 2, 16/11",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Thị Mai",
        court: "Sân 02",
        zone: "Khu A · Thảm Taraflex tiêu chuẩn BWF",
        status: "upcoming",
        topic: "Chiến thuật thi đấu đơn: Kiểm soát 4 góc sân",
      },
      {
        num: 7,
        date: "2026-11-23",
        dayVi: "Thứ 2, 23/11",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Thị Mai",
        court: "Sân 02",
        zone: "Khu A · Thảm Taraflex tiêu chuẩn BWF",
        status: "upcoming",
        topic: "Chiến thuật thi đấu đôi: Công thủ & Bọc lót vị trí",
      },
      {
        num: 8,
        date: "2026-11-30",
        dayVi: "Thứ 2, 30/11",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Thị Mai",
        court: "Sân 02",
        zone: "Khu A · Thảm Taraflex tiêu chuẩn BWF",
        status: "upcoming",
        topic: "Xử lý cầu khó ngoài tầm với & Kỹ thuật lùi đánh vòng đầu",
      },
      {
        num: 9,
        date: "2026-12-07",
        dayVi: "Thứ 2, 07/12",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Thị Mai",
        court: "Sân 02",
        zone: "Khu A · Thảm Taraflex tiêu chuẩn BWF",
        status: "upcoming",
        isMilestone: true,
        topic: "★ THẨM ĐỊNH BWF RATING & CẤP CHỨNG CHỈ BẬC 1",
      },
      {
        num: 10,
        date: "2026-12-14",
        dayVi: "Thứ 2, 14/12",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Thị Mai",
        court: "Sân 02",
        zone: "Khu A · Thảm Taraflex tiêu chuẩn BWF",
        status: "upcoming",
        topic: "Phân tích lối đánh đối thủ & Điều phối nhịp độ trận đấu",
      },
      {
        num: 11,
        date: "2026-12-21",
        dayVi: "Thứ 2, 21/12",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Thị Mai",
        court: "Sân 02",
        zone: "Khu A · Thảm Taraflex tiêu chuẩn BWF",
        status: "upcoming",
        topic: "Mô phỏng thi đấu giải phong trào có trọng tài",
      },
      {
        num: 12,
        date: "2026-12-28",
        dayVi: "Thứ 2, 28/12",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Thị Mai",
        court: "Sân 02",
        zone: "Khu A · Thảm Taraflex tiêu chuẩn BWF",
        status: "upcoming",
        topic: "Mini Tournament nội bộ & Trao huy hiệu hoàn thành",
      },
    ],
  },
  pickleball: {
    id: "pickleball",
    code: "PKB-K01",
    name: "Pickleball K01",
    discipline: "Pickleball",
    totalSessions: 12,
    threshold: 9,
    maxAbsent: 3,
    coach: "HLV Trần Đình Trọng",
    coachTitle: "HLV Chuyên nghiệp Pickleball",
    coachImage: "/images/coaches/pickleball.jpg",
    courseImage: "/images/courses/pickleball.jpg",
    court: "Sân B3",
    zone: "Khu B · Chuẩn DUPR ngoài trời",
    gate: "Cổng số 02",
    scheduleDay: "Thứ 6 hàng tuần",
    timeRange: "17:30 – 19:00",
    startTime: "17:30",
    endTime: "19:00",
    amenities: {
      locker: "Tủ Locker VIP #42 (Khu Thay Đồ Block B)",
      courtReady:
        "Sân B3 đã bật hệ thống đèn LED thi đấu 500 lux & chuẩn bị bóng mới Wilson Tru 32",
      concierge:
        "Khăn lạnh thể thao & nước khoáng bù điện giải sẵn sàng tại bàn HLV",
      vipLane: "Cổng số 02 · Làn ưu tiên VIP (Fast Track)",
    },
    sessions: [
      {
        num: 1,
        date: "2026-10-09",
        dayVi: "Thứ 6, 09/10",
        startTime: "17:30",
        endTime: "19:00",
        coach: "HLV Trần Đình Trọng",
        court: "Sân B3",
        zone: "Khu B · Chuẩn DUPR ngoài trời",
        status: "completed",
        attendance: "present",
        checkinTime: "17:25",
        topic: "Quy tắc sân bãi, cầm vợt Continental & Giao bóng chuẩn DUPR",
        skillScores: {
          control: 5.0,
          movement: 4.8,
          tactics: 4.6,
          stamina: 4.9,
        },
        coachRemark:
          "Cảm giác bóng rất tốt, động tác backhand dink ổn định và tư thế chuẩn bị sẵn sàng nhanh.",
        feedback: null,
        canFeedback: true,
      },
      {
        num: 2,
        date: "2026-10-16",
        dayVi: "Thứ 6, 16/10",
        startTime: "17:30",
        endTime: "19:00",
        coach: "HLV Trần Đình Trọng",
        court: "Sân B3",
        zone: "Khu B · Chuẩn DUPR ngoài trời",
        status: "upcoming",
        topic: "Kiểm soát Non-Volley Zone (Kitchen) & Kỹ thuật Dinking cơ bản",
      },
      {
        num: 3,
        date: "2026-10-23",
        dayVi: "Thứ 6, 23/10",
        startTime: "17:30",
        endTime: "19:00",
        coach: "HLV Trần Đình Trọng",
        court: "Sân B3",
        zone: "Khu B · Chuẩn DUPR ngoài trời",
        status: "upcoming",
        topic: "Third Shot Drop (Thả bóng bước 3) & Chuyển đổi công thủ",
      },
      {
        num: 4,
        date: "2026-10-30",
        dayVi: "Thứ 6, 30/10",
        startTime: "17:30",
        endTime: "19:00",
        coach: "HLV Trần Đình Trọng",
        court: "Sân B3",
        zone: "Khu B · Chuẩn DUPR ngoài trời",
        status: "upcoming",
        topic: "Kỹ thuật Forehand Drive & Backhand Reset",
      },
      {
        num: 5,
        date: "2026-11-06",
        dayVi: "Thứ 6, 06/11",
        startTime: "17:30",
        endTime: "19:00",
        coach: "HLV Trần Đình Trọng",
        court: "Sân B3",
        zone: "Khu B · Chuẩn DUPR ngoài trời",
        status: "upcoming",
        topic: "Chiến thuật đôi: Phân chia khu vực & Bọc lót vị trí",
      },
      {
        num: 6,
        date: "2026-11-13",
        dayVi: "Thứ 6, 13/11",
        startTime: "17:30",
        endTime: "19:00",
        coach: "HLV Trần Đình Trọng",
        court: "Sân B3",
        zone: "Khu B · Chuẩn DUPR ngoài trời",
        status: "upcoming",
        topic: "Đập bóng trên cao (Overhead Smash) & Đỡ đập (Smash Defense)",
      },
      {
        num: 7,
        date: "2026-11-20",
        dayVi: "Thứ 6, 20/11",
        startTime: "17:30",
        endTime: "19:00",
        coach: "HLV Trần Đình Trọng",
        court: "Sân B3",
        zone: "Khu B · Chuẩn DUPR ngoài trời",
        status: "upcoming",
        topic: "Kỹ thuật Lob (Bổng) & Đối phó với đối thủ tấn công nhanh",
      },
      {
        num: 8,
        date: "2026-11-27",
        dayVi: "Thứ 6, 27/11",
        startTime: "17:30",
        endTime: "19:00",
        coach: "HLV Trần Đình Trọng",
        court: "Sân B3",
        zone: "Khu B · Chuẩn DUPR ngoài trời",
        status: "upcoming",
        topic: "Speed-up bóng & Đấu súng cự ly gần tại vạch Kitchen",
      },
      {
        num: 9,
        date: "2026-12-04",
        dayVi: "Thứ 6, 04/12",
        startTime: "17:30",
        endTime: "19:00",
        coach: "HLV Trần Đình Trọng",
        court: "Sân B3",
        zone: "Khu B · Chuẩn DUPR ngoài trời",
        status: "upcoming",
        isMilestone: true,
        topic: "★ THẨM ĐỊNH DUPR RATING & CẤP CHỨNG CHỈ BẬC 1",
      },
      {
        num: 10,
        date: "2026-12-11",
        dayVi: "Thứ 6, 11/12",
        startTime: "17:30",
        endTime: "19:00",
        coach: "HLV Trần Đình Trọng",
        court: "Sân B3",
        zone: "Khu B · Chuẩn DUPR ngoài trời",
        status: "upcoming",
        topic: "Chiến thuật thi đấu đối kháng nâng cao & Xử lý tình huống khó",
      },
      {
        num: 11,
        date: "2026-12-18",
        dayVi: "Thứ 6, 18/12",
        startTime: "17:30",
        endTime: "19:00",
        coach: "HLV Trần Đình Trọng",
        court: "Sân B3",
        zone: "Khu B · Chuẩn DUPR ngoài trời",
        status: "upcoming",
        topic: "Mô phỏng kịch bản thi đấu giải & Kiểm soát nhịp độ trận đấu",
      },
      {
        num: 12,
        date: "2026-12-25",
        dayVi: "Thứ 6, 25/12",
        startTime: "17:30",
        endTime: "19:00",
        coach: "HLV Trần Đình Trọng",
        court: "Sân B3",
        zone: "Khu B · Chuẩn DUPR ngoài trời",
        status: "upcoming",
        topic: "Mini Tournament nội bộ CLB & Bế giảng khóa học",
      },
    ],
  },
  archery: {
    id: "archery",
    code: "ARC-K01",
    name: "Bắn cung K01",
    discipline: "Bắn cung",
    totalSessions: 12,
    threshold: 9,
    maxAbsent: 3,
    coach: "HLV Lê Nguyễn Thiên Phúc",
    coachTitle: "HLV Chuyên nghiệp Bắn cung",
    coachImage: "/images/coaches/archery.jpg",
    courseImage: "/images/courses/archery.jpg",
    court: "Lane 04",
    zone: "Khu C · Bia điện tử 15m có mái che",
    gate: "Cổng số 02",
    scheduleDay: "Thứ 4 hàng tuần",
    timeRange: "06:00 – 07:30",
    startTime: "06:00",
    endTime: "07:30",
    amenities: {
      locker: "Tủ Locker VIP #08 (Khu Thay Đồ Block C)",
      courtReady:
        "Lane 04 bia điện tử cảm ứng 15m đã hiệu chuẩn & chuẩn bị 12 mũi tên carbon chuyên dụng",
      concierge:
        "Bao tay da bảo hộ & đệm ngực được khử trùng sẵn sàng tại bàn bắn",
      vipLane: "Cổng số 02 · Làn ưu tiên VIP (Fast Track)",
    },
    sessions: [
      {
        num: 1,
        date: "2026-10-14",
        dayVi: "Hôm nay, Thứ 4, 14/10",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Nguyễn Thiên Phúc",
        court: "Lane 04",
        zone: "Khu C · Bia điện tử 15m có mái che",
        status: "today",
        isToday: true,
        topic: "Tư thế đứng chuẩn Olympic & Điểm neo (Anchor point)",
        skillScores: {
          control: 5.0,
          movement: 4.9,
          tactics: 4.6,
          stamina: 4.8,
        },
        coachRemark:
          "Độ ổn định của vai và cổ tay rất tốt, nhịp thở tĩnh và độ tập trung cao.",
      },
      {
        num: 2,
        date: "2026-10-21",
        dayVi: "Thứ 4, 21/10",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Nguyễn Thiên Phúc",
        court: "Lane 04",
        zone: "Khu C · Bia điện tử 15m có mái che",
        status: "upcoming",
        topic: "Kỹ thuật giương cung, ngắm bia & Thả dây tĩnh (Static release)",
      },
      {
        num: 3,
        date: "2026-10-28",
        dayVi: "Thứ 4, 28/10",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Nguyễn Thiên Phúc",
        court: "Lane 04",
        zone: "Khu C · Bia điện tử 15m có mái che",
        status: "upcoming",
        topic: "Điều chỉnh thước ngắm & Kiểm soát nhịp thở",
      },
      {
        num: 4,
        date: "2026-11-04",
        dayVi: "Thứ 4, 04/11",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Nguyễn Thiên Phúc",
        court: "Lane 04",
        zone: "Khu C · Bia điện tử 15m có mái che",
        status: "upcoming",
        topic: "Kỹ thuật bắn cự ly 10m & Nhóm mũi tên (Grouping)",
      },
      {
        num: 5,
        date: "2026-11-11",
        dayVi: "Thứ 4, 11/11",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Nguyễn Thiên Phúc",
        court: "Lane 04",
        zone: "Khu C · Bia điện tử 15m có mái che",
        status: "upcoming",
        topic: "Kỹ thuật bắn cự ly 15m tiêu chuẩn trong nhà",
      },
      {
        num: 6,
        date: "2026-11-18",
        dayVi: "Thứ 4, 18/11",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Nguyễn Thiên Phúc",
        court: "Lane 04",
        zone: "Khu C · Bia điện tử 15m có mái che",
        status: "upcoming",
        topic: "Xử lý lỗi lệch mũi tên & Cân chỉnh cung",
      },
      {
        num: 7,
        date: "2026-11-25",
        dayVi: "Thứ 4, 25/11",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Nguyễn Thiên Phúc",
        court: "Lane 04",
        zone: "Khu C · Bia điện tử 15m có mái che",
        status: "upcoming",
        topic: "Kỹ thuật duy trì sự tập trung & Độ bền cơ vai",
      },
      {
        num: 8,
        date: "2026-12-02",
        dayVi: "Thứ 4, 02/12",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Nguyễn Thiên Phúc",
        court: "Lane 04",
        zone: "Khu C · Bia điện tử 15m có mái che",
        status: "upcoming",
        topic: "Bắn tính điểm theo lượt 3 tên chuẩn World Archery",
      },
      {
        num: 9,
        date: "2026-12-09",
        dayVi: "Thứ 4, 09/12",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Nguyễn Thiên Phúc",
        court: "Lane 04",
        zone: "Khu C · Bia điện tử 15m có mái che",
        status: "upcoming",
        isMilestone: true,
        topic: "★ THẨM ĐỊNH ĐIỂM CHUẨN CLB & CẤP CHỨNG CHỈ XẠ THỦ BẬC 1",
      },
      {
        num: 10,
        date: "2026-12-16",
        dayVi: "Thứ 4, 16/12",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Nguyễn Thiên Phúc",
        court: "Lane 04",
        zone: "Khu C · Bia điện tử 15m có mái che",
        status: "upcoming",
        topic: "Thử thách cự ly 18m & Bắn bia kích thước thu nhỏ",
      },
      {
        num: 11,
        date: "2026-12-23",
        dayVi: "Thứ 4, 23/12",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Nguyễn Thiên Phúc",
        court: "Lane 04",
        zone: "Khu C · Bia điện tử 15m có mái che",
        status: "upcoming",
        topic: "Thi đấu đối kháng trực tiếp 1-1 (Elimination round)",
      },
      {
        num: 12,
        date: "2026-12-30",
        dayVi: "Thứ 4, 30/12",
        startTime: "06:00",
        endTime: "07:30",
        coach: "HLV Lê Nguyễn Thiên Phúc",
        court: "Lane 04",
        zone: "Khu C · Bia điện tử 15m có mái che",
        status: "upcoming",
        topic: "Giải đấu nội bộ CLB & Bế giảng khóa học",
      },
    ],
  },
}

/**
 * Dynamically computes Google Calendar URL
 */
function getGoogleCalendarUrl(session, course) {
  if (!session || !course) return "#"
  const title = encodeURIComponent(`${course.name} • ${session.court}`)
  const details = encodeURIComponent(
    `Buổi tập thể thao cùng ${session.coach}.\n` +
      `Nội dung: ${session.topic || "Kỹ thuật thi đấu chuyên sâu"}\n` +
      `Địa điểm: ${session.court} (${session.zone})\n` +
      `Cổng soát vé: ${course.gate} (Làn ưu tiên VIP Fast Track)`,
  )
  const location = encodeURIComponent(`${session.court}, ${session.zone}`)
  const dateFormatted = String(session.date || "").replace(/-/g, "")
  const startFormatted =
    String(session.startTime || "06:00").replace(":", "") + "00"
  const endFormatted =
    String(session.endTime || "07:30").replace(":", "") + "00"
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateFormatted}T${startFormatted}/${dateFormatted}T${endFormatted}&details=${details}&location=${location}`
}

/**
 * Dynamically calculates gate opening time = session.startTime - 30 minutes
 * e.g. 17:30 -> 17:00, 06:00 -> 05:30
 */
function getGateOpeningTime(startTimeStr) {
  if (!startTimeStr || !startTimeStr.includes(":")) return "05:30"
  const [hStr, mStr] = startTimeStr.split(":")
  let totalMin = parseInt(hStr, 10) * 60 + parseInt(mStr, 10) - 30
  if (totalMin < 0) totalMin += 24 * 60
  const gh = String(Math.floor(totalMin / 60)).padStart(2, "0")
  const gm = String(totalMin % 60).padStart(2, "0")
  return `${gh}:${gm}`
}

/**
 * Checks if a session is eligible for leave request (> 12 hours before session start)
 * Policy: Requests must be submitted at least 12h in advance via the app.
 */
function canRequestLeave(sessionDate, startTimeStr) {
  if (!sessionDate || !startTimeStr) return false
  try {
    const sessionTime = new Date(`${sessionDate}T${startTimeStr}:00`).getTime()
    const simulatedNow = new Date(`${SERVER_TODAY}T05:30:00`).getTime()
    const hoursRemaining = (sessionTime - simulatedNow) / (1000 * 60 * 60)
    return hoursRemaining >= (ATTENDANCE_POLICY?.leaveNoticeHours || 12)
  } catch {
    return false
  }
}

export function MemberAttendanceView() {
  const navigate = useNavigate()
  const {
    currentUser,
    members,
    packages,
    feedbacks,
    leaveRequests,
    attendanceDisputes,
    checkedInCourseSessions,
    submitLeaveRequest,
    cancelLeaveRequest,
    reportAttendanceDispute,
    markCourseSessionCheckedIn,
    language,
    apiEnabled,
    showToast,
  } = useSCMS()

  // Real Backend API state when apiEnabled === true
  const [apiAttendances, setApiAttendances] = useState([])
  const [apiEnrollments, setApiEnrollments] = useState([])
  const [apiLoading, setApiLoading] = useState(false)
  const [apiStatusFilter, setApiStatusFilter] = useState("all")
  const [liveQrPayload, setLiveQrPayload] = useState("")
  const [liveQrSeconds, setLiveQrSeconds] = useState(60)
  const [liveQrLoading, setLiveQrLoading] = useState(false)

  // Active sport tab: 'badminton' | 'pickleball' | 'archery'
  const [activeSportId, setActiveSportId] = useState("badminton")

  // Main UI view state: 'normal' | 'loading' | 'empty' | 'error'
  const [viewState, setViewState] = useState("normal")

  // Interactive session state override (null = auto from state machine)
  const [stateOverride, setStateOverride] = useState(null)

  // Modals & Inline Dispute Form
  const [selectedClassForFeedback, setSelectedClassForFeedback] = useState(null)
  const [feedbackViewData, setFeedbackViewData] = useState(null)
  const [showPolicyModal, setShowPolicyModal] = useState(false)
  const [showQrPassModal, setShowQrPassModal] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [sessionForLeave, setSessionForLeave] = useState(null)
  const [leaveRequestInitialType, setLeaveRequestInitialType] =
    useState("leave")
  const [disputingSessionNum, setDisputingSessionNum] = useState(null)
  const [disputeReasonText, setDisputeReasonText] = useState("")

  // Dev simulation panel (hidden by default)
  const [showDevPanel, setShowDevPanel] = useState(false)

  // Dynamic OTP backup code (changes every 30s)
  const [qrCountdown, setQrCountdown] = useState(30)

  // Progressive disclosure detail slide-over drawer: null | 'attendance' | 'log'
  const [activeDrawer, setActiveDrawer] = useState(null)

  // Inspected session in the 12-dots strip (defaults to heroSession.num)
  const [inspectedSessionNum, setInspectedSessionNum] = useState(null)

  // Hero right widget tab: 'pass' | 'map'
  const [heroWidgetTab, setHeroWidgetTab] = useState("pass")

  // Manage drawer ESC key and body scroll lock
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setActiveDrawer(null)
    }
    if (activeDrawer) {
      document.addEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "unset"
    }
  }, [activeDrawer])

  // Set page background coverage across full html/body canvas to #F5F2EA
  useEffect(() => {
    const prevHtmlBg = document.documentElement.style.backgroundColor
    const prevBodyBg = document.body.style.backgroundColor
    document.documentElement.style.backgroundColor = "#F5F2EA"
    document.body.style.backgroundColor = "#F5F2EA"
    return () => {
      document.documentElement.style.backgroundColor = prevHtmlBg
      document.body.style.backgroundColor = prevBodyBg
    }
  }, [])

  // Current member profile
  const member = useMemo(() => {
    return (
      (members || []).find(
        (m) =>
          String(m.id) === String(currentUser?.id) ||
          (m.email &&
            currentUser?.email &&
            m.email.toLowerCase() === currentUser.email.toLowerCase()),
      ) ||
      currentUser ||
      members?.[0] || { id: "mem-1", name: "Bùi Văn Phúc", code: "MEM-001" }
    )
  }, [members, currentUser])

  // Member package & VIP privilege status (Truth check)
  const memberPkg = useMemo(() => {
    return (packages || []).find((p) => p.id === member?.currentPackageId)
  }, [packages, member])

  const isVip = useMemo(() => {
    if (member?.tier === "vip" || member?.isVip) return true
    if (
      memberPkg?.tier >= 2 ||
      memberPkg?.nameVi?.toLowerCase?.().includes("vip") ||
      member?.currentPackageName?.toLowerCase?.().includes("vip")
    )
      return true
    return true // Default club attendance view demonstrates VIP Founding tier
  }, [member, memberPkg])

  // Selected course dynamically enriched with live context state
  const activeCourse = useMemo(() => {
    const baseCourse = CLUB_COURSES[activeSportId] || CLUB_COURSES.badminton
    const enrichedSessions = baseCourse.sessions.map((s) => {
      const sessionId = `${baseCourse.id}-session-${s.num}`
      const checkedInRecord = checkedInCourseSessions?.[sessionId]
      const isSessionCheckedIn =
        Boolean(checkedInRecord) ||
        (stateOverride === SESSION_STATE.CHECKED_IN && s.date === SERVER_TODAY)

      const matchedFeedback =
        (feedbacks || []).find(
          (f) =>
            String(f.classId) === sessionId ||
            (String(f.classId) === baseCourse.id && f.date === s.date) ||
            (f.className === baseCourse.name && f.date === s.date),
        ) ||
        s.feedback ||
        null

      const matchedLeave =
        (leaveRequests || []).find((lv) => lv.sessionId === sessionId) || null

      const matchedDispute =
        (attendanceDisputes || []).find((d) => d.sessionId === sessionId) ||
        null

      const effectiveStatus = isSessionCheckedIn ? "completed" : s.status
      const effectiveAttendance = isSessionCheckedIn ? "present" : s.attendance
      const effectiveCheckinTime =
        checkedInRecord?.checkinTime ||
        s.checkinTime ||
        (isSessionCheckedIn ? "05:55" : undefined)
      const effectiveCanFeedback =
        effectiveStatus === "completed" &&
        (effectiveAttendance === "present" || effectiveAttendance === "late")

      return {
        ...s,
        id: sessionId,
        courseId: baseCourse.id,
        status: effectiveStatus,
        attendance: effectiveAttendance,
        checkinTime: effectiveCheckinTime,
        feedback: matchedFeedback,
        canFeedback: effectiveCanFeedback,
        leaveRequest: matchedLeave,
        dispute: matchedDispute,
      }
    })

    return {
      ...baseCourse,
      sessions: enrichedSessions,
    }
  }, [
    activeSportId,
    feedbacks,
    leaveRequests,
    attendanceDisputes,
    checkedInCourseSessions,
    stateOverride,
  ])

  /**
   * HERO SESSION SELECTION
   * Today's session OR earliest upcoming session of the selected sport
   */
  const heroSession = useMemo(() => {
    const todaySession = activeCourse.sessions.find(
      (s) => s.date === SERVER_TODAY,
    )
    if (todaySession) return todaySession

    const upcoming = activeCourse.sessions.find(
      (s) => s.date >= SERVER_TODAY && s.status !== "completed",
    )
    if (upcoming) return upcoming

    return (
      activeCourse.sessions.find((s) => s.status === "upcoming") ||
      activeCourse.sessions[0]
    )
  }, [activeCourse])

  const heroSessionWithMeta = useMemo(() => {
    return {
      ...heroSession,
      id: `${activeCourse.id}-session-${heroSession.num}`,
      bookingId: `${activeCourse.id}-session-${heroSession.num}`,
      courseId: activeCourse.id,
      className: activeCourse.name,
      coachName: heroSession.coach,
      room: `${heroSession.court} (${heroSession.zone})`,
    }
  }, [heroSession, activeCourse])

  const eligibleLeaveSessions = useMemo(() => {
    const list = activeCourse.sessions
      .filter(
        (s) => s.status === "upcoming" && canRequestLeave(s.date, s.startTime),
      )
      .map((s) => ({
        ...s,
        id: `${activeCourse.id}-session-${s.num}`,
        bookingId: `${activeCourse.id}-session-${s.num}`,
        courseId: activeCourse.id,
        className: activeCourse.name,
        coachName: s.coach,
        room: `${s.court} (${s.zone})`,
      }))
    return list.length > 0 ? list : [heroSessionWithMeta]
  }, [activeCourse, heroSessionWithMeta])

  // Session currently inspected by clicking on 12-dots strip
  const inspectedSession = useMemo(() => {
    if (!inspectedSessionNum) return heroSession
    return (
      activeCourse.sessions.find((s) => s.num === inspectedSessionNum) ||
      heroSession
    )
  }, [inspectedSessionNum, activeCourse, heroSession])

  /**
   * STATE MACHINE RESOLUTION
   */
  const sessionState = useMemo(() => {
    if (stateOverride) return stateOverride

    const heroSessionId = `${activeCourse.id}-session-${heroSession.num}`
    if (checkedInCourseSessions?.[heroSessionId]) {
      return SESSION_STATE.CHECKED_IN
    }

    const sessionDate = heroSession.date

    if (sessionDate < SERVER_TODAY) {
      return SESSION_STATE.COMPLETED
    }

    if (sessionDate === SERVER_TODAY) {
      return SESSION_STATE.CHECK_IN_OPEN
    }

    return SESSION_STATE.UPCOMING
  }, [heroSession, activeCourse.id, stateOverride, checkedInCourseSessions])

  const isCheckedIn = sessionState === SESSION_STATE.CHECKED_IN
  const isCheckInOpen = sessionState === SESSION_STATE.CHECK_IN_OPEN

  // Countdown timer for OTP
  useEffect(() => {
    if (!isCheckInOpen) return
    const timer = setInterval(() => {
      setQrCountdown((prev) => (prev <= 1 ? 30 : prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [isCheckInOpen])

  // Rolling OTP code
  const otpBackupCode = useMemo(() => {
    const seed = Math.floor(Date.now() / 30000)
    const code = String(Math.abs(Math.sin(seed + 88)) * 900000 + 100000).slice(
      0,
      6,
    )
    return `${code.slice(0, 3)}-${code.slice(3, 6)}`
  }, [Math.floor(Date.now() / 30000)])

  /**
   * ATTENDANCE STATS CALCULATION
   */
  const stats = useMemo(() => {
    const course = activeCourse
    const completedSessions = course.sessions.filter(
      (s) => s.status === "completed",
    )
    const attended = completedSessions.filter(
      (s) => s.attendance === "present" || s.attendance === "late",
    ).length
    const absent = completedSessions.filter(
      (s) => s.attendance === "absent",
    ).length
    const sessionsHeld = completedSessions.length
    const remainingSessions = course.totalSessions - sessionsHeld

    const needed = Math.max(0, course.threshold - attended)
    const isAchievable = attended + remainingSessions >= course.threshold

    let progressLabel = "Đúng tiến độ"
    let progressColor = "text-[#2F6B4F]"

    if (!isAchievable) {
      progressLabel = "Nguy cơ không đạt"
      progressColor = "text-[#8A2B32]"
    } else if (absent >= course.maxAbsent) {
      progressLabel = "Cảnh báo · Đã hết hạn mức vắng"
      progressColor = "text-[#8A2B32]"
    } else if (
      course.maxAbsent - absent <=
        (ATTENDANCE_POLICY?.warningAbsentRemaining || 1) &&
      absent > 0
    ) {
      progressLabel = "Cần chú ý · Còn 1 buổi vắng cuối cùng"
      progressColor = "text-[#8A5A2B]"
    }

    return {
      attended,
      absent,
      sessionsHeld,
      remainingSessions,
      needed,
      threshold: course.threshold,
      totalSessions: course.totalSessions,
      maxAbsent: course.maxAbsent,
      allowedAbsentRemaining: Math.max(0, course.maxAbsent - absent),
      progressLabel,
      progressColor,
      isAchievable,
    }
  }, [activeCourse])

  // Past attended sessions for diary
  const pastSessions = useMemo(() => {
    return activeCourse.sessions.filter((s) => s.status === "completed")
  }, [activeCourse])

  // Perform Check-in action
  const handlePerformCheckin = () => {
    const sessionId = `${activeCourse.id}-session-${heroSession.num}`
    setStateOverride(SESSION_STATE.CHECKED_IN)
    if (typeof markCourseSessionCheckedIn === "function") {
      markCourseSessionCheckedIn(sessionId, {
        courseId: activeCourse.id,
        sessionNum: heroSession.num,
        className: activeCourse.name,
        date: heroSession.date,
        dayVi: heroSession.dayVi,
        startTime: heroSession.startTime,
        endTime: heroSession.endTime,
        court: `${heroSession.court} (${heroSession.zone})`,
        coach: heroSession.coach,
        topic: heroSession.topic,
        checkinTime: "05:55",
      })
    }
    if (typeof showToast === "function") {
      showToast(
        `Quý hội viên đã hoàn tất check-in ${activeCourse.name} qua làn Fast Track!`,
        "success",
      )
    }
  }

  // Submit leave
  const handleLeaveSubmit = async (leavePayload) => {
    if (typeof submitLeaveRequest === "function") {
      await submitLeaveRequest(leavePayload)
    }
    if (typeof showToast === "function") {
      const typeLabel =
        leavePayload?.type === "swap"
          ? "đơn xin đổi ca"
          : "đơn xin nghỉ bảo lưu"
      showToast(
        `Đã ghi nhận ${typeLabel} cho ${activeCourse.name} (Buổi ${leavePayload?.session?.num || ""}). Hệ thống đã thông báo tới HLV.`,
        "success",
      )
    }
  }

  // Cancel leave request
  const handleCancelLeave = (session) => {
    if (!session) return
    const sessionId = session.id || `${activeCourse.id}-session-${session.num}`
    if (typeof cancelLeaveRequest === "function") {
      cancelLeaveRequest(sessionId)
    }
    if (typeof showToast === "function") {
      showToast(
        `Đã hủy đơn xin nghỉ/đổi ca cho Buổi ${session.num}. Lịch học của quý hội viên đã được khôi phục bình thường.`,
        "info",
      )
    }
  }

  // Report attendance dispute
  const handleReportDispute = (session, customReason = "") => {
    if (!session) return
    const finalReason =
      customReason.trim() ||
      disputeReasonText.trim() ||
      "Đã có mặt tại sân nhưng cổng từ chưa ghi nhận"
    if (typeof reportAttendanceDispute === "function") {
      reportAttendanceDispute({
        sessionId: session.id || `${activeCourse.id}-session-${session.num}`,
        courseId: activeCourse.id,
        sessionNum: session.num,
        className: activeCourse.name,
        date: session.date,
        currentAttendance: session.attendance,
        reason: finalReason,
      })
    }
    setDisputingSessionNum(null)
    setDisputeReasonText("")
    if (typeof showToast === "function") {
      showToast(
        `Đã tiếp nhận yêu cầu đối soát camera điểm danh buổi ${session.num}. Bộ phận Lễ tân & HLV sẽ xác minh trong 24h.`,
        "info",
      )
    }
  }

  // Open feedback modal for a session (create or view/edit)
  const handleOpenSessionFeedback = (session, existingFb = null) => {
    if (!session) return
    setFeedbackViewData(existingFb || null)
    setSelectedClassForFeedback({
      id: `${activeCourse.id}-session-${session.num}`,
      classId: `${activeCourse.id}-session-${session.num}`,
      className: activeCourse.name,
      name: activeCourse.name,
      coachName: session.coach,
      coachId: activeCourse.id === "badminton" ? 14 : 16,
      date: session.date,
      dayVi: session.dayVi,
      startTime: session.startTime,
      endTime: session.endTime,
      room: `${session.court} (${session.zone})`,
    })
  }

  // Real Backend API loader when apiEnabled === true
  const memberProfileId = useMemo(
    () =>
      getAuthoritativeProfileId(currentUser) || currentUser?.id || member?.id,
    [currentUser, member],
  )

  const loadLiveQrCode = useCallback(async () => {
    if (!apiEnabled) return
    setLiveQrLoading(true)
    try {
      const res = await memberPortalApi.getMemberCheckinCode()
      const ttl = Math.max(
        1,
        Math.min(
          30,
          Number(res?.expiresInSeconds || res?.validitySeconds || 30),
        ),
      )
      if (res?.code || res?.payload) {
        setLiveQrPayload(res.code || res.payload)
        setLiveQrSeconds(ttl)
      }
    } catch {
      setLiveQrPayload(`SCMS:${memberProfileId || 1}:0:OFFLINE`)
      setLiveQrSeconds(30)
    } finally {
      setLiveQrLoading(false)
    }
  }, [apiEnabled, memberProfileId])

  const loadApiAttendanceData = useCallback(async () => {
    if (!apiEnabled) return
    setApiLoading(true)
    try {
      const [attRes, enrRes] = await Promise.all([
        memberProfileId
          ? memberPortalApi
              .getMemberAttendances(memberProfileId)
              .catch(() => [])
          : Promise.resolve([]),
        memberProfileId
          ? memberPortalApi.getMemberClasses(memberProfileId).catch(() => [])
          : Promise.resolve([]),
      ])
      setApiAttendances(Array.isArray(attRes) ? attRes : [])
      setApiEnrollments(Array.isArray(enrRes) ? enrRes : [])
    } finally {
      setApiLoading(false)
    }
  }, [apiEnabled, memberProfileId])

  useEffect(() => {
    if (!apiEnabled) return
    loadApiAttendanceData()
    loadLiveQrCode()
  }, [apiEnabled, loadApiAttendanceData, loadLiveQrCode])

  useEffect(() => {
    if (!apiEnabled || liveQrSeconds <= 0) return
    const timer = setInterval(() => {
      setLiveQrSeconds((prev) => {
        if (prev <= 1) {
          loadLiveQrCode()
          return 30
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [apiEnabled, liveQrSeconds, loadLiveQrCode])

  const filteredApiAttendances = useMemo(() => {
    return apiAttendances.filter((a) => {
      if (apiStatusFilter === "all") return true
      const raw = String(
        a.status || a.attendanceStatus || "present",
      ).toLowerCase()
      return raw === apiStatusFilter
    })
  }, [apiAttendances, apiStatusFilter])

  if (apiEnabled) {
    const presentCount = apiAttendances.filter((a) => {
      const st = String(
        a.status || a.attendanceStatus || "present",
      ).toLowerCase()
      return st === "present" || st === "checked_in"
    }).length
    const lateCount = apiAttendances.filter(
      (a) =>
        String(a.status || a.attendanceStatus || "").toLowerCase() === "late",
    ).length
    const absentCount = apiAttendances.filter(
      (a) =>
        String(a.status || a.attendanceStatus || "").toLowerCase() === "absent",
    ).length

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6 font-sans antialiased">
        {/* Header */}
        <div className="pb-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-red-700 font-bold bg-red-50 border border-red-200/60 px-2 py-0.5 rounded-sm">
              ĐIỂM DANH & CHUYÊN CẦN THỰC TẾ · BACKEND API
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight mt-1.5">
              Lịch Sử Điểm Danh & Mã QR Vào Sân
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Hội viên:{" "}
              <strong className="text-slate-900">{member?.name}</strong> (
              {member?.code || "MB-1001"}) &bull; Đồng bộ trực tiếp từ hệ thống
              điểm danh CLB
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                loadApiAttendanceData()
                loadLiveQrCode()
              }}
              disabled={apiLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${apiLoading ? "animate-spin" : ""}`}
              />
              <span>Làm mới dữ liệu</span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/member/schedule")}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Lịch học & Báo vắng</span>
            </button>
          </div>
        </div>

        {/* Summary KPI Row + Live QR Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Tổng lượt ghi nhận
              </span>
              <div className="text-3xl font-black text-slate-900 font-mono mt-2 tabular-nums">
                {apiAttendances.length}
              </div>
              <span className="text-[11px] text-slate-500 mt-1">
                {apiEnrollments.length} khóa học đã đăng ký
              </span>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Có mặt đúng giờ
              </span>
              <div className="text-3xl font-black text-emerald-700 font-mono mt-2 tabular-nums">
                {presentCount}
              </div>
              <span className="text-[11px] text-emerald-700/80 mt-1">
                Đã xác thực tại quầy
              </span>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                Đi muộn (Late)
              </span>
              <div className="text-3xl font-black text-amber-700 font-mono mt-2 tabular-nums">
                {lateCount}
              </div>
              <span className="text-[11px] text-amber-700/80 mt-1">
                Sau giờ bắt đầu ca tập
              </span>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                Vắng mặt (Absent)
              </span>
              <div className="text-3xl font-black text-rose-700 font-mono mt-2 tabular-nums">
                {absentCount}
              </div>
              <span className="text-[11px] text-rose-700/80 mt-1">
                Buổi nghỉ / báo vắng
              </span>
            </div>
          </div>

          {/* Live QR Pass Card */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-red-700">
                <QrCode className="w-3.5 h-3.5" />
                <span>Mã QR Check-in Động</span>
              </div>
              <div className="font-mono text-lg font-black text-slate-900 tracking-wider break-all">
                {liveQrPayload || member?.code || "MB-1001"}
              </div>
              <p className="text-xs text-slate-500">
                Tự động làm mới sau{" "}
                <strong className="text-red-700 font-mono">
                  {liveQrSeconds}s
                </strong>
                . Đưa mã này cho Lễ tân quét khi đến phòng tập.
              </p>
              <button
                type="button"
                onClick={loadLiveQrCode}
                disabled={liveQrLoading}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-red-700 cursor-pointer pt-1"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    liveQrLoading ? "animate-spin" : ""
                  }`}
                />
                <span>Cấp mã mới ngay</span>
              </button>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl shrink-0">
              {liveQrLoading ? (
                <div className="w-[104px] h-[104px] flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-red-600" />
                </div>
              ) : (
                <QRCodeSVG
                  value={liveQrPayload || "SCMS-MEMBER"}
                  size={104}
                  level="M"
                />
              )}
            </div>
          </div>
        </div>

        {/* Attendance Log Table */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-900" />
              <h3 className="text-sm font-bold text-slate-900">
                Nhật Ký Điểm Danh Chi Tiết
              </h3>
              <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-sm">
                {filteredApiAttendances.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: "all", label: "Tất cả" },
                { id: "present", label: "Có mặt" },
                { id: "late", label: "Đi muộn" },
                { id: "absent", label: "Vắng mặt" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setApiStatusFilter(tab.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    apiStatusFilter === tab.id
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {apiLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-red-600" />
              <span className="text-xs">
                Đang tải lịch sử điểm danh từ máy chủ...
              </span>
            </div>
          ) : filteredApiAttendances.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                <QrCode className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Chưa có bản ghi điểm danh nào phù hợp với bộ lọc hiện tại.
              </p>
              <button
                type="button"
                onClick={() => navigate("/member/schedule")}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Xem lịch học & báo vắng</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
                    <th className="py-3 pr-4">Thời gian Check-in</th>
                    <th className="py-3 px-4">Thời gian Check-out</th>
                    <th className="py-3 px-4">Lớp học / Nội dung</th>
                    <th className="py-3 px-4">Phương thức</th>
                    <th className="py-3 pl-4 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredApiAttendances.map((att, idx) => {
                    const rawSt = String(
                      att.status || att.attendanceStatus || "present",
                    ).toLowerCase()
                    const checkInStr = att.checkInTime || att.createdAt || "—"
                    const checkOutStr = att.checkOutTime || "—"
                    return (
                      <tr
                        key={att.attendanceId || att.id || idx}
                        className="hover:bg-slate-50/80"
                      >
                        <td className="py-3.5 pr-4 font-mono font-bold text-slate-900">
                          {String(checkInStr).replace("T", " ").slice(0, 16)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {checkOutStr !== "—"
                            ? String(checkOutStr).replace("T", " ").slice(0, 16)
                            : "—"}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {att.className ||
                            att.trainingClassName ||
                            att.note ||
                            "Check-in tập luyện tại CLB"}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {att.checkInMethod ||
                            att.method ||
                            "QR / Quầy Lễ tân"}
                        </td>
                        <td className="py-3.5 pl-4 text-right">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              rawSt === "absent"
                                ? "bg-rose-100 text-rose-800"
                                : rawSt === "late"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {rawSt === "absent" ? (
                              <>
                                <AlertTriangle className="w-3 h-3" />
                                <span>Vắng mặt</span>
                              </>
                            ) : rawSt === "late" ? (
                              <>
                                <Clock className="w-3 h-3" />
                                <span>Đi muộn</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Có mặt</span>
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ==============================================================
  // CONDITIONAL SYSTEM STATES (Offline Demo Mode)
  // ==============================================================

  if (viewState === "loading") {
    return (
      <div className="min-h-screen bg-[#F5F2EA] py-16 px-6 font-['Be_Vietnam_Pro',sans-serif] animate-pulse">
        <div className="max-w-[1120px] mx-auto space-y-12">
          <div className="h-8 bg-[#15171C]/10 rounded w-1/4" />
          <div className="border-t border-[rgba(21,23,28,0.12)] pt-8 space-y-4">
            <div className="h-10 bg-[#15171C]/10 rounded w-1/2" />
            <div className="h-6 bg-[#15171C]/5 rounded w-1/3" />
          </div>
        </div>
      </div>
    )
  }

  if (viewState === "error") {
    return (
      <div className="min-h-screen bg-[#F5F2EA] py-20 px-4 font-['Be_Vietnam_Pro',sans-serif] flex items-center justify-center">
        <div className="max-w-md w-full text-center space-y-4 bg-[#FBF9F4] p-8 rounded-lg border border-[rgba(21,23,28,0.12)]">
          <h2 className="font-['Newsreader',serif] text-2xl text-[#15171C]">
            Không thể kết nối máy chủ
          </h2>
          <p className="text-sm text-[#6A675F] leading-relaxed">
            Dữ liệu điểm danh tạm thời không thể đồng bộ. Quý hội viên vui lòng
            kiểm tra kết nối mạng và thử lại.
          </p>
          <button
            type="button"
            onClick={() => setViewState("normal")}
            className="px-6 py-2.5 rounded bg-[#15171C] text-[#FBF9F4] text-xs font-medium cursor-pointer hover:bg-[#2A2E37] transition-colors"
          >
            Thử lại kết nối
          </button>
        </div>
      </div>
    )
  }

  if (viewState === "empty") {
    return (
      <div className="min-h-screen bg-[#F5F2EA] py-20 px-4 font-['Be_Vietnam_Pro',sans-serif] flex items-center justify-center">
        <div className="max-w-md w-full text-center space-y-4 bg-[#FBF9F4] p-8 rounded-lg border border-[rgba(21,23,28,0.12)]">
          <h2 className="font-['Newsreader',serif] text-2xl text-[#15171C]">
            Chưa có lịch điểm danh
          </h2>
          <p className="text-sm text-[#6A675F] leading-relaxed">
            Quý hội viên hiện chưa có lịch điểm danh hoặc chưa đăng ký lớp thể
            thao nào trong học kỳ này.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate("/member/catalog")}
              className="px-6 py-2.5 rounded bg-[#15171C] text-[#FBF9F4] text-xs font-medium cursor-pointer hover:bg-[#2A2E37] transition-colors"
            >
              Đăng ký lớp thể thao
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==============================================================
  // MAIN VIEW: ATHLETIC LUXURY CLUB • VIP BLACK TIER EDITION
  // Perfectly centered, high contrast, clean typography, zero clutter
  // ==============================================================
  return (
    <div className="min-h-screen bg-[#F5F2EA] text-[#15171C] font-['Be_Vietnam_Pro',sans-serif] antialiased selection:bg-[#A8844F]/20">
      <div className="w-full max-w-[1120px] mx-auto px-4 sm:px-8 py-8 sm:py-12 pb-24 sm:pb-16 space-y-8">
        {/* ============================================================== */}
        {/* 1. VIP PRIVILEGE HEADER (Clean, high-end club style)           */}
        {/* ============================================================== */}
        <header className="pb-6 border-b border-[rgba(21,23,28,0.12)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="h-px w-6 bg-[#A8844F]" />
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-sans tracking-[0.14em] uppercase font-medium text-[#A8844F] bg-[#15171C] border border-[#A8844F]/40 shadow-xs">
                <Award className="w-3 h-3 text-[#A8844F]" />
                <span>
                  {isVip
                    ? "VIBE ATHLETIC CLUB • THẺ VIP"
                    : "VIBE ATHLETIC CLUB • THẺ HỘI VIÊN"}
                </span>
              </span>
              <span className="text-[#6A675F]/50">•</span>
              <span className="font-mono text-xs text-[#6A675F]">
                {member?.code || "MEM-001"}
              </span>
              <span className="text-[#6A675F]/50">•</span>
              <span className="text-[11px] text-[#6A675F]">
                Hạn thẻ: 31/12/2026 (Còn 78 ngày)
              </span>
            </div>

            <h1 className="font-['Newsreader',serif] font-normal text-3xl sm:text-4xl text-[#15171C] tracking-tight leading-tight">
              Điểm danh & Chuyên cần
            </h1>
            <p className="text-xs sm:text-sm text-[#6A675F] font-normal">
              Hội viên:{" "}
              <strong className="font-medium text-[#15171C]">
                {member?.name || "Bùi Văn Phúc"}
              </strong>{" "}
              • Trạng thái:{" "}
              <span className="text-[#2F6B4F] font-medium">
                {isVip
                  ? "Đặc quyền VIP đang kích hoạt"
                  : "Thẻ hội viên đang hoạt động"}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowPolicyModal(true)}
              className="px-4 py-2 rounded border border-[rgba(21,23,28,0.12)] bg-[#FBF9F4] hover:border-[#15171C] text-xs text-[#15171C] font-medium cursor-pointer transition-colors"
            >
              Quy chế điểm danh & vắng mặt
            </button>
          </div>
        </header>

        {/* ============================================================== */}
        {/* 2. SPORT SELECTOR TABS (Clean, high-end club style)            */}
        {/* ============================================================== */}
        <div className="flex items-center justify-between gap-4 overflow-x-auto pb-1">
          <div className="flex items-center gap-2">
            {Object.values(CLUB_COURSES).map((c) => {
              const isSelected = c.id === activeSportId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setActiveSportId(c.id)
                    setStateOverride(null)
                    setInspectedSessionNum(null)
                  }}
                  className={`px-4 py-2 text-xs tracking-wider uppercase font-medium cursor-pointer transition-all rounded flex items-center gap-2 ${
                    isSelected
                      ? "bg-[#15171C] text-[#FBF9F4] border border-[#A8844F]/40 shadow-xs"
                      : "bg-[#FBF9F4] text-[#6A675F] border border-[rgba(21,23,28,0.12)] hover:text-[#15171C] hover:border-[#15171C]"
                  }`}
                >
                  <span>{c.name}</span>
                </button>
              )
            })}
          </div>

          <div className="hidden md:flex items-center text-xs text-[#6A675F] font-normal">
            <span>{Object.values(CLUB_COURSES).length} khóa học đang theo</span>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3. HERO SECTION: STADIUM STAGE (Obsidian Foil & Apple Wallet)  */}
        {/* ============================================================== */}
        <section className="relative rounded-xl overflow-hidden bg-[#15171C] text-[#FBF9F4] border border-[#15171C] isolate">
          {/* Subtle warm bronze ambient glow */}
          <div className="absolute -top-32 right-1/4 -z-10 w-96 h-96 bg-[#A8844F]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="p-6 sm:p-8 lg:p-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              {/* Left Column (8/12): Eyebrow, Large Date, Specs, Action CTA */}
              <div className="lg:col-span-8 space-y-6">
                {/* Eyebrow & Focus Topic */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="h-px w-6 bg-[#C9A96E]" />
                    <span className="text-[11px] font-sans font-medium uppercase tracking-[0.14em] text-[#C9A96E]">
                      {heroSession.isToday || heroSession.date === SERVER_TODAY
                        ? `Hôm nay · ${heroSession.startTime}`
                        : "Buổi kế tiếp"}
                    </span>
                    <span className="text-[#6A675F]">•</span>
                    <span className="text-xs text-[#FBF9F4]/70 font-normal">
                      {activeCourse.scheduleDay}
                    </span>
                  </div>

                  {/* Date Heading in Serif */}
                  <h2 className="font-['Newsreader',serif] font-normal text-3xl sm:text-4xl text-[#FBF9F4] tracking-tight leading-tight">
                    {heroSession.dayVi}
                  </h2>

                  {/* Curriculum Focus: Italic Serif line (~18px) directly under Date */}
                  {heroSession.topic && (
                    <p className="font-['Newsreader',serif] italic text-lg sm:text-[19px] text-[#C9A96E] leading-snug pt-0.5">
                      Trọng tâm: {heroSession.topic}
                    </p>
                  )}
                </div>

                {/* Stadium Specs Block (Bronze accent hairline, clean text) */}
                <div className="space-y-1.5 border-l-2 border-[#C9A96E] pl-4 text-sm sm:text-[15px]">
                  <div className="text-xl sm:text-2xl font-light text-[#FBF9F4] flex items-center gap-3 tabular-nums">
                    <span>
                      {heroSession.startTime} – {heroSession.endTime}
                    </span>
                    <span className="text-xs text-[#FBF9F4]/60 font-normal">
                      (90 phút)
                    </span>
                  </div>
                  <div className="text-[#FBF9F4]/80 leading-relaxed font-normal">
                    <span className="text-[#FBF9F4] font-medium">
                      {heroSession.court}
                    </span>{" "}
                    • {heroSession.zone} •{" "}
                    <span className="text-[#C9A96E] font-medium">
                      {activeCourse.gate}
                      {isVip ? " (Làn VIP)" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 pt-1 text-xs text-[#FBF9F4]/70">
                    <img
                      src={activeCourse.coachImage}
                      alt={heroSession.coach}
                      className="w-6 h-6 rounded-full object-cover border border-white/20"
                    />
                    <span>
                      Huấn luyện viên:{" "}
                      <span className="text-[#FBF9F4] font-medium">
                        {heroSession.coach?.replace(/^HLV\s+/, "")}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Live Gate Status Indicator (Only shown when open or checked in to avoid repeating QR card) */}
                {(isCheckedIn || isCheckInOpen) && (
                  <div className="text-sm">
                    {isCheckedIn ? (
                      <div className="text-[#68D391] flex items-center gap-2 font-medium">
                        <span className="w-2 h-2 rounded-full bg-[#2F6B4F]" />
                        <span>
                          Quý khách đã hoàn tất check-in lúc{" "}
                          {heroSession.checkinTime || "05:55"} (Đúng giờ)
                        </span>
                      </div>
                    ) : (
                      <div className="text-[#E0C99E] flex items-center gap-2 font-medium">
                        <span className="w-2 h-2 rounded-full bg-[#C9A96E] animate-ping" />
                        <span>
                          Cổng soát vé {isVip ? "VIP " : ""}đang mở • Mời quý
                          hội viên quét mã vào sân{isVip ? " (Fast Track)" : ""}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Row: Primary Action + Secondary Links */}
                <div className="pt-2 flex items-center gap-5 flex-wrap">
                  {isCheckedIn ? (
                    <button
                      type="button"
                      onClick={() => setShowQrPassModal(true)}
                      className="px-6 py-2.5 rounded bg-[#FBF9F4] text-[#15171C] text-sm font-medium hover:bg-white transition-colors inline-flex items-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Xem thẻ vào sân</span>
                    </button>
                  ) : isCheckInOpen ? (
                    <button
                      type="button"
                      onClick={handlePerformCheckin}
                      className="px-7 py-3 rounded bg-[#C9A96E] hover:bg-[#b89558] text-[#15171C] text-sm font-semibold transition-all inline-flex items-center gap-2.5 cursor-pointer shadow-md active:scale-[0.98]"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>
                        Check-in vào sân ngay{isVip ? " (Fast Track)" : ""}
                      </span>
                    </button>
                  ) : (
                    <a
                      href={getGoogleCalendarUrl(heroSession, activeCourse)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-2.5 rounded bg-[#C9A96E] hover:bg-[#b89558] text-[#15171C] text-sm font-semibold transition-all inline-flex items-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
                    >
                      <Calendar className="w-4 h-4 text-[#15171C]" />
                      <span>Thêm vào lịch</span>
                    </a>
                  )}

                  {/* Secondary Links */}
                  <div className="flex items-center gap-5 text-sm">
                    {(isCheckedIn || isCheckInOpen) && (
                      <a
                        href={getGoogleCalendarUrl(heroSession, activeCourse)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#FBF9F4]/70 hover:text-[#FBF9F4] underline underline-offset-4 cursor-pointer font-normal transition-colors"
                      >
                        Thêm vào lịch
                      </a>
                    )}

                    {!isCheckedIn &&
                      (heroSession.leaveRequest ? (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSessionForLeave(heroSessionWithMeta)
                              setLeaveRequestInitialType(
                                heroSession.leaveRequest.type || "leave",
                              )
                              setShowLeaveModal(true)
                            }}
                            className="text-[#C9A96E] hover:text-[#E0C99E] underline underline-offset-4 cursor-pointer font-medium transition-colors"
                          >
                            ✓{" "}
                            {heroSession.leaveRequest.type === "swap"
                              ? "Đã đăng ký đổi ca"
                              : "Đã đăng ký nghỉ phép (Bảo lưu)"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleCancelLeave(heroSessionWithMeta)
                            }
                            className="text-xs text-[#FBF9F4]/60 hover:text-rose-300 underline underline-offset-4 cursor-pointer transition-colors"
                          >
                            Hủy đơn
                          </button>
                        </div>
                      ) : canRequestLeave(
                          heroSession.date,
                          heroSession.startTime,
                        ) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSessionForLeave(heroSessionWithMeta)
                            setLeaveRequestInitialType("leave")
                            setShowLeaveModal(true)
                          }}
                          className="text-[#FBF9F4]/70 hover:text-[#FBF9F4] underline underline-offset-4 cursor-pointer font-normal transition-colors"
                        >
                          Xin nghỉ buổi này
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof showToast === "function") {
                              showToast(
                                "Buổi học diễn ra trong vòng 12 giờ. Quý hội viên vui lòng liên hệ Lễ tân/HLV để được hỗ trợ.",
                                "info",
                              )
                            }
                          }}
                          className="text-[#FBF9F4]/40 hover:text-[#FBF9F4]/60 text-xs underline underline-offset-4 cursor-pointer font-normal transition-colors"
                          title="Quy định: Chỉ được xin nghỉ trước tối thiểu 12 giờ qua ứng dụng. Nhấn để xem hướng dẫn."
                        >
                          Xin nghỉ (&lt; 12h: Báo Lễ tân)
                        </button>
                      ))}
                  </div>
                </div>
              </div>

              {/* Right Column (4/12): Digital Pass Widget with qrcode.react */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center">
                <div className="w-full max-w-[320px] bg-[#15171C] border border-white/10 rounded-xl p-5 space-y-4 shadow-xl relative overflow-hidden">
                  {/* Segmented Control (Single Line) */}
                  <div className="flex items-center justify-center border-b border-white/10 pb-3">
                    <div className="flex items-center bg-white/5 p-0.5 rounded border border-white/10">
                      <button
                        type="button"
                        onClick={() => setHeroWidgetTab("pass")}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-all cursor-pointer whitespace-nowrap ${
                          heroWidgetTab === "pass"
                            ? "bg-[#FBF9F4] text-[#15171C]"
                            : "text-[#FBF9F4]/70 hover:text-white"
                        }`}
                      >
                        Thẻ vào sân
                      </button>
                      <button
                        type="button"
                        onClick={() => setHeroWidgetTab("map")}
                        className={`px-3 py-1.5 text-xs font-medium rounded transition-all cursor-pointer whitespace-nowrap ${
                          heroWidgetTab === "map"
                            ? "bg-[#FBF9F4] text-[#15171C]"
                            : "text-[#FBF9F4]/70 hover:text-white"
                        }`}
                      >
                        Sơ đồ sân
                      </button>
                    </div>
                  </div>

                  {/* Tab 1: QR Pass View (Powered by qrcode.react with Dynamic Security) */}
                  {heroWidgetTab === "pass" ? (
                    <div
                      onClick={() => setShowQrPassModal(true)}
                      className="cursor-pointer group space-y-3"
                      role="button"
                      tabIndex={0}
                    >
                      <div className="relative aspect-square w-full max-w-[170px] mx-auto bg-white p-3 rounded-lg flex items-center justify-center overflow-hidden shadow-xs">
                        {/* Real SVG QR code rendered via qrcode.react */}
                        <div
                          className={`w-full h-full flex items-center justify-center transition-all duration-300 ${
                            !isCheckInOpen && !isCheckedIn
                              ? "blur-[4px] opacity-25"
                              : ""
                          }`}
                        >
                          <QRCodeSVG
                            value={`SCMS://PASS/${activeCourse.code}/${heroSession.num}/${member?.code}/${otpBackupCode}`}
                            size={146}
                            level="M"
                            fgColor="#15171C"
                            bgColor="#FFFFFF"
                            className="w-full h-full"
                          />
                        </div>

                        {/* If gate is locked and member hasn't checked in: Frosted vault overlay with lock */}
                        {!isCheckInOpen && !isCheckedIn && (
                          <div className="absolute inset-0 bg-[#15171C]/75 backdrop-blur-xs flex flex-col items-center justify-center p-2 text-center space-y-1.5">
                            <div className="w-8 h-8 rounded-full bg-[#15171C] border border-[#C9A96E] flex items-center justify-center text-[#C9A96E] shadow-sm">
                              <Lock className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-medium text-white/90 leading-tight">
                              Cổng mở lúc{" "}
                              {getGateOpeningTime(heroSession.startTime)}
                            </span>
                          </div>
                        )}

                        {isCheckedIn && (
                          <div className="absolute inset-0 bg-white flex flex-col items-center justify-center text-center p-2 space-y-1 text-[#2F6B4F]">
                            <div className="w-10 h-10 rounded-full bg-[#2F6B4F]/10 border border-[#2F6B4F]/30 flex items-center justify-center text-[#2F6B4F]">
                              <Check className="w-5 h-5 stroke-[2.5]" />
                            </div>
                            <span className="text-[11px] font-bold tracking-tight text-[#15171C]">
                              {isVip ? "FAST TRACK" : "ĐÃ CHECK-IN"}
                            </span>
                            <span className="text-[9px] font-mono text-[#6A675F]">
                              {heroSession.checkinTime
                                ? `CHECKED-IN ${heroSession.checkinTime}`
                                : "CHECKED-IN"}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1 text-center">
                        <div className="text-xs text-[#FBF9F4]/90 font-medium truncate">
                          {heroSession.court} • {activeCourse.name}
                        </div>

                        {/* Dynamic Circular Timer for OTP (Only visible when gate is open) */}
                        {isCheckInOpen && (
                          <div className="text-[11px] text-[#FBF9F4]/60 flex items-center justify-center gap-1.5">
                            <span>Mã OTP:</span>
                            <span className="font-['JetBrains_Mono',monospace] font-medium text-white tracking-widest">
                              {otpBackupCode}
                            </span>
                            <svg className="w-3.5 h-3.5 -rotate-90">
                              <circle
                                cx="7"
                                cy="7"
                                r="5"
                                stroke="rgba(255,255,255,0.15)"
                                strokeWidth="1.5"
                                fill="none"
                              />
                              <circle
                                cx="7"
                                cy="7"
                                r="5"
                                stroke="#C9A96E"
                                strokeWidth="1.5"
                                fill="none"
                                strokeDasharray="31.4"
                                strokeDashoffset={31.4 * (1 - qrCountdown / 30)}
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-white/10 flex items-center justify-center gap-1.5 text-[11px] text-[#C9A96E] font-normal group-hover:text-[#E0C99E] transition-colors">
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Chạm để mở rộng thẻ</span>
                      </div>
                    </div>
                  ) : (
                    /* Tab 2: Court Map Line-Art (Seamless Dark Theme) */
                    <div className="py-1">
                      <SportTargetVisual
                        category={activeCourse.discipline}
                        state={sessionState}
                        court={heroSession.court}
                        zone={heroSession.zone}
                        theme="dark"
                        onOpenQrPass={() => setShowQrPassModal(true)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================== */}
        {/* ============================================================== */}
        {/* 4. COURSE ATTENDANCE PROGRESS TRACK (Lộ trình 12 buổi)        */}
        {/* ============================================================== */}
        <section className="w-full">
          {/* Card: Chuyên cần & Lộ trình 12 buổi */}
          <div
            onClick={() => setActiveDrawer("attendance")}
            className="border border-[rgba(21,23,28,0.12)] hover:border-[#A8844F]/50 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C9A96E] rounded-lg p-6 sm:p-7 bg-[#FBF9F4] cursor-pointer transition-all flex flex-col justify-between space-y-6 w-full"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                setActiveDrawer("attendance")
              }
            }}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-[#6A675F] font-medium block">
                    TIẾN ĐỘ KHÓA HỌC
                  </span>
                  <h3 className="font-['Newsreader',serif] font-normal text-2xl text-[#15171C]">
                    Chuyên cần & Điều kiện cấp chứng chỉ
                  </h3>
                </div>
                <span
                  className={`text-xs ${stats.progressColor} font-medium flex items-center gap-1.5`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  <span>{stats.progressLabel}</span>
                </span>
              </div>

              <div className="flex items-baseline gap-2 pt-1">
                <span className="font-['Newsreader',serif] font-normal text-4xl sm:text-5xl text-[#15171C] leading-none lining-nums tabular-nums">
                  {stats.attended}
                </span>
                <span className="text-base text-[#6A675F] font-normal">
                  / {stats.threshold} buổi chuẩn (75%)
                </span>
              </div>

              {/* 12-Session Track: 12 bars with milestone pin at 75% (Session 9) */}
              <div className="space-y-2 pt-1">
                <div className="text-xs text-[#6A675F] font-normal">
                  <span>
                    Đã hoàn thành {stats.attended}/{activeCourse.totalSessions}{" "}
                    buổi của khóa học
                  </span>
                </div>

                <div className="relative pt-5 pb-1">
                  {/* Milestone Pin pinned at 75% directly over Milestone 9 */}
                  <div
                    className="absolute top-0 flex flex-col items-center -translate-x-1/2 pointer-events-none"
                    style={{ left: "75%" }}
                  >
                    <span className="text-[10px] font-medium text-[#A8844F] whitespace-nowrap flex items-center gap-1">
                      <Award className="w-3 h-3 text-[#A8844F]" />
                      <span>Mốc đạt · Buổi 9</span>
                    </span>
                    <div className="w-px h-1.5 bg-[#A8844F]" />
                  </div>

                  {/* 12 Segment Bars */}
                  <div className="grid grid-cols-12 gap-1.5 sm:gap-2 h-3 items-center w-full">
                    {Array.from({ length: 12 }).map((_, idx) => {
                      const sessionNum = idx + 1
                      const isPastAttended = sessionNum <= stats.attended
                      const isMilestone = sessionNum === 9
                      return (
                        <div
                          key={sessionNum}
                          className={`h-3 rounded-xs transition-colors ${
                            isPastAttended ? "bg-[#2F6B4F]" : "bg-[#E5E0D5]"
                          }`}
                          title={`Buổi ${sessionNum}${
                            isPastAttended
                              ? " (Đã tham gia)"
                              : " (Chưa diễn ra)"
                          }${isMilestone ? " - Mốc đạt chuẩn 75%" : ""}`}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-1 text-[13px] text-[#6A675F] leading-relaxed font-normal">
                <p>
                  Còn{" "}
                  <strong className="text-[#15171C] font-medium tabular-nums">
                    {stats.remainingSessions} buổi
                  </strong>{" "}
                  chưa diễn ra • Cần tham gia tối thiểu{" "}
                  <strong className="text-[#15171C] font-medium tabular-nums">
                    {stats.needed}/{stats.remainingSessions} buổi
                  </strong>{" "}
                  để đạt chuẩn cấp chứng chỉ.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-[rgba(21,23,28,0.08)] flex items-center justify-between text-xs font-medium text-[#15171C] mt-auto">
              <span>Xem chi tiết lộ trình 12 buổi & quy chế chuyên cần</span>
              <ArrowRight className="w-4 h-4 stroke-[1.75]" />
            </div>
          </div>
        </section>
      </div>

      {/* ============================================================== */}
      {/* 5. SLIDE-OVER DETAIL DRAWER (Framed via Framer Motion & Radix) */}
      {/* ============================================================== */}
      <AnimatePresence>
        {activeDrawer && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop Fade */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-[#15171C]/50 backdrop-blur-xs"
              onClick={() => setActiveDrawer(null)}
              aria-hidden="true"
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
              <motion.aside
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 300 }}
                className="w-screen max-w-lg bg-[#FBF9F4] text-[#15171C] shadow-2xl flex flex-col justify-between border-l border-[rgba(21,23,28,0.12)] z-10 font-['Be_Vietnam_Pro',sans-serif]"
                role="dialog"
                aria-modal="true"
              >
                {/* Drawer Header with Sub-Tabs */}
                <div className="border-b border-[rgba(21,23,28,0.12)] bg-[#FBF9F4] sticky top-0 z-10">
                  <div className="p-6 pb-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="h-px w-5 bg-[#A8844F]" />
                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#6A675F]">
                          VIBE ATHLETIC CLUB • LỘ TRÌNH 12 BUỔI
                        </span>
                      </div>
                      <h3 className="font-['Newsreader',serif] font-normal text-2xl text-[#15171C]">
                        {activeCourse.name} • {heroSession.coach}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveDrawer(null)}
                      className="p-1.5 text-[#6A675F] hover:text-[#15171C] rounded transition-colors cursor-pointer"
                      title="Đóng bảng chi tiết (ESC)"
                    >
                      <X className="w-5 h-5 stroke-[1.75]" />
                    </button>
                  </div>

                  {/* Sub-Tabs Switcher inside Drawer */}
                  <div className="flex items-center px-6 gap-6 text-sm">
                    <button
                      type="button"
                      onClick={() => setActiveDrawer("attendance")}
                      className={`pb-3 transition-colors cursor-pointer font-normal relative ${
                        activeDrawer === "attendance"
                          ? "text-[#15171C] font-medium border-b-2 border-[#A8844F]"
                          : "text-[#6A675F] hover:text-[#15171C]"
                      }`}
                    >
                      <span>Lộ trình 12 buổi</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveDrawer("log")}
                      className={`pb-3 transition-colors cursor-pointer font-normal relative flex items-center gap-1.5 ${
                        activeDrawer === "log"
                          ? "text-[#15171C] font-medium border-b-2 border-[#A8844F]"
                          : "text-[#6A675F] hover:text-[#15171C]"
                      }`}
                    >
                      <span>Nhật ký học ({pastSessions.length})</span>
                      {pastSessions.some(
                        (s) => s.canFeedback && !s.feedback,
                      ) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#A8844F]" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Drawer Body (Uniform 24px padding on both tabs) */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                  {activeDrawer === "attendance" ? (
                    <div className="space-y-6">
                      {/* Metric Display */}
                      <div className="space-y-2 border-b border-[rgba(21,23,28,0.08)] pb-5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] uppercase tracking-[0.14em] text-[#6A675F] font-medium">
                            TỶ LỆ HOÀN THÀNH
                          </span>
                          <span
                            className={`text-xs ${stats.progressColor} font-medium flex items-center gap-1.5`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            <span>{stats.progressLabel}</span>
                          </span>
                        </div>

                        <div className="flex items-baseline gap-2">
                          <span className="font-['Newsreader',serif] font-normal text-5xl text-[#15171C] leading-none lining-nums tabular-nums">
                            {stats.attended}
                          </span>
                          <span className="text-2xl text-[#6A675F] font-normal">
                            / {stats.threshold}
                          </span>
                          <span className="text-xs text-[#6A675F] ml-2">
                            buổi tối thiểu đạt chuẩn 75%
                          </span>
                        </div>
                      </div>

                      {/* 12-Dots Interactive Strip: Zero clipping with fluid scaling */}
                      <div className="space-y-3 border-b border-[rgba(21,23,28,0.08)] pb-6">
                        <div className="flex items-center justify-between text-xs text-[#6A675F] flex-wrap gap-2">
                          <span className="text-[#15171C] font-medium">
                            Lộ trình 12 buổi học
                          </span>
                          <div className="flex items-center gap-3 text-[11px]">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-[#15171C]" />
                              <span>Đã đi</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-[#A8844F]/30 ring-1 ring-[#A8844F]" />
                              <span>Có phép</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-transparent ring-1 ring-[#15171C]" />
                              <span>Buổi kế tiếp</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-[#E5E0D5]" />
                              <span>Chưa học</span>
                            </span>
                          </div>
                        </div>

                        {/* Fluid Responsive 12 Dots + 1 Hairline Column */}
                        <div className="py-2 w-full overflow-hidden">
                          <div className="grid grid-cols-[repeat(9,minmax(0,1fr))_2px_repeat(3,minmax(0,1fr))] gap-1 sm:gap-1.5 items-center w-full">
                            {/* Dots 1 to 9 */}
                            {activeCourse.sessions.slice(0, 9).map((s) => {
                              const isCompleted =
                                s.status === "completed" &&
                                s.attendance === "present"
                              const isAbsent =
                                s.status === "completed" &&
                                s.attendance === "absent"
                              const isExcused = Boolean(s.leaveRequest)
                              const isNext =
                                s.status === "today" ||
                                s.num === stats.attended + 1
                              const isSelectedDot =
                                inspectedSession.num === s.num

                              return (
                                <button
                                  key={s.num}
                                  type="button"
                                  onClick={() => setInspectedSessionNum(s.num)}
                                  className="flex items-center justify-center cursor-pointer transition-all p-0 w-full"
                                  title={`Buổi ${s.num}: ${s.dayVi} • ${s.topic || ""} • Chạm để xem chi tiết`}
                                >
                                  <div
                                    className={`w-full aspect-square max-w-[28px] max-h-[28px] rounded-full flex items-center justify-center text-[10px] sm:text-xs tabular-nums transition-all ${
                                      isSelectedDot
                                        ? "ring-2 ring-[#15171C] ring-offset-2 ring-offset-[#FBF9F4]"
                                        : ""
                                    } ${
                                      isCompleted
                                        ? "bg-[#15171C] text-[#FBF9F4] font-medium"
                                        : isExcused
                                          ? "bg-[#A8844F]/20 text-[#A8844F] ring-1 ring-[#A8844F] font-semibold"
                                          : isAbsent
                                            ? "bg-[#E5E0D5] text-[#6A675F]"
                                            : isNext
                                              ? "bg-transparent text-[#15171C] ring-1 ring-[#15171C] font-medium"
                                              : "bg-[#E5E0D5] text-[#6A675F]"
                                    }`}
                                  >
                                    {isCompleted ? (
                                      <Check className="w-3 h-3 stroke-[2.5]" />
                                    ) : isAbsent ? (
                                      <Minus className="w-3 h-3 stroke-[2]" />
                                    ) : (
                                      s.num
                                    )}
                                  </div>
                                </button>
                              )
                            })}

                            {/* Milestone Hairline Pin at Column 10 (Between 9 and 10) */}
                            <div
                              className="w-[1.5px] h-6 bg-[#A8844F] justify-self-center rounded-full"
                              title="Mốc chuẩn 75% (Buổi 9)"
                            />

                            {/* Dots 10 to 12 */}
                            {activeCourse.sessions.slice(9, 12).map((s) => {
                              const isCompleted =
                                s.status === "completed" &&
                                s.attendance === "present"
                              const isAbsent =
                                s.status === "completed" &&
                                s.attendance === "absent"
                              const isExcused = Boolean(s.leaveRequest)
                              const isNext =
                                s.status === "today" ||
                                s.num === stats.attended + 1
                              const isSelectedDot =
                                inspectedSession.num === s.num

                              return (
                                <button
                                  key={s.num}
                                  type="button"
                                  onClick={() => setInspectedSessionNum(s.num)}
                                  className="flex items-center justify-center cursor-pointer transition-all p-0 w-full"
                                  title={`Buổi ${s.num}: ${s.dayVi} • ${s.topic || ""} • Chạm để xem chi tiết`}
                                >
                                  <div
                                    className={`w-full aspect-square max-w-[28px] max-h-[28px] rounded-full flex items-center justify-center text-[10px] sm:text-xs tabular-nums transition-all ${
                                      isSelectedDot
                                        ? "ring-2 ring-[#15171C] ring-offset-2 ring-offset-[#FBF9F4]"
                                        : ""
                                    } ${
                                      isCompleted
                                        ? "bg-[#15171C] text-[#FBF9F4] font-medium"
                                        : isExcused
                                          ? "bg-[#A8844F]/20 text-[#A8844F] ring-1 ring-[#A8844F] font-semibold"
                                          : isAbsent
                                            ? "bg-[#E5E0D5] text-[#6A675F]"
                                            : isNext
                                              ? "bg-transparent text-[#15171C] ring-1 ring-[#15171C] font-medium"
                                              : "bg-[#E5E0D5] text-[#6A675F]"
                                    }`}
                                  >
                                    {isCompleted ? (
                                      <Check className="w-3 h-3 stroke-[2.5]" />
                                    ) : isAbsent ? (
                                      <Minus className="w-3 h-3 stroke-[2]" />
                                    ) : (
                                      s.num
                                    )}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Inspected Session Card with Technical Topic & Skill Radar */}
                      {inspectedSession && (
                        <div className="bg-[#F5F2EA] border border-[rgba(21,23,28,0.12)] rounded-lg p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-[#15171C] text-[#FBF9F4] px-2 py-0.5 rounded font-medium tabular-nums">
                                Buổi {inspectedSession.num}/12
                              </span>
                              <span className="text-sm font-medium text-[#15171C]">
                                {inspectedSession.dayVi}
                              </span>
                            </div>
                            <span className="text-xs">
                              {inspectedSession.status === "completed" &&
                              inspectedSession.attendance === "present" ? (
                                <span className="text-[#2F6B4F] flex items-center gap-1 font-medium">
                                  <Check className="w-3.5 h-3.5 stroke-[2]" />
                                  Có mặt ({inspectedSession.checkinTime})
                                </span>
                              ) : inspectedSession.status === "completed" &&
                                inspectedSession.attendance === "absent" ? (
                                <span className="text-[#8A2B32] font-medium">
                                  Vắng mặt
                                </span>
                              ) : inspectedSession.leaveRequest ? (
                                <span className="text-[#A8844F] font-medium">
                                  {inspectedSession.leaveRequest.type === "swap"
                                    ? "Đã đăng ký đổi ca"
                                    : "Nghỉ phép (Bảo lưu)"}
                                </span>
                              ) : inspectedSession.status === "today" ? (
                                <span className="text-[#A8844F] font-medium">
                                  Hôm nay ({inspectedSession.startTime})
                                </span>
                              ) : (
                                <span className="text-[#6A675F]">
                                  Sắp diễn ra
                                </span>
                              )}
                            </span>
                          </div>

                          {/* Technical Topic Highlight */}
                          <div className="p-3 rounded bg-white border border-[rgba(21,23,28,0.08)] space-y-1">
                            <div className="text-[10px] font-sans uppercase tracking-wider text-[#A8844F] font-bold">
                              NỘI DUNG BUỔI TẬP
                            </div>
                            <p className="text-xs font-semibold text-[#15171C]">
                              {inspectedSession.topic ||
                                "Kỹ thuật thi đấu chuyên sâu & Kiểm soát trận đấu"}
                            </p>
                          </div>

                          {/* Leave Request Notice if present */}
                          {inspectedSession.leaveRequest && (
                            <div className="p-3 rounded-[6px] bg-[#2F6B4F]/10 border border-[#2F6B4F]/30 text-xs space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-[#2F6B4F]">
                                  ✓{" "}
                                  {inspectedSession.leaveRequest.type === "swap"
                                    ? "Đã ghi nhận yêu cầu đổi ca học"
                                    : "Đã duyệt đơn nghỉ phép có bảo lưu"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCancelLeave(inspectedSession)
                                  }
                                  className="text-[11px] text-[#8A2B32] hover:underline font-medium cursor-pointer shrink-0"
                                >
                                  Hủy đơn xin nghỉ
                                </button>
                              </div>
                              <div className="text-[#6A675F]">
                                Lý do: {inspectedSession.leaveRequest.reason}
                                {inspectedSession.leaveRequest.note
                                  ? ` • "${inspectedSession.leaveRequest.note}"`
                                  : ""}
                              </div>
                            </div>
                          )}

                          {/* Detailed Skill Radar / Evaluation from Coach (if completed) */}
                          {inspectedSession.skillScores && (
                            <div className="space-y-2 pt-1 border-t border-[rgba(21,23,28,0.08)]">
                              <div className="text-[11px] font-medium text-[#15171C] flex items-center justify-between">
                                <span>Thẩm định kỹ thuật từ HLV:</span>
                                <span className="font-mono text-[#2F6B4F]">
                                  Xuất sắc
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                <div className="p-2 rounded bg-white border border-[rgba(21,23,28,0.06)] flex justify-between">
                                  <span className="text-[#6A675F]">
                                    Cảm giác bóng
                                  </span>
                                  <span className="text-[#15171C] font-bold">
                                    {inspectedSession.skillScores.control} / 5.0
                                  </span>
                                </div>
                                <div className="p-2 rounded bg-white border border-[rgba(21,23,28,0.06)] flex justify-between">
                                  <span className="text-[#6A675F]">
                                    Bộ chân
                                  </span>
                                  <span className="text-[#15171C] font-bold">
                                    {inspectedSession.skillScores.movement} /
                                    5.0
                                  </span>
                                </div>
                                <div className="p-2 rounded bg-white border border-[rgba(21,23,28,0.06)] flex justify-between">
                                  <span className="text-[#6A675F]">
                                    Chiến thuật
                                  </span>
                                  <span className="text-[#15171C] font-bold">
                                    {inspectedSession.skillScores.tactics} / 5.0
                                  </span>
                                </div>
                                <div className="p-2 rounded bg-white border border-[rgba(21,23,28,0.06)] flex justify-between">
                                  <span className="text-[#6A675F]">
                                    Thể lực
                                  </span>
                                  <span className="text-[#15171C] font-bold">
                                    {inspectedSession.skillScores.stamina} / 5.0
                                  </span>
                                </div>
                              </div>
                              {inspectedSession.coachRemark && (
                                <p className="text-xs text-[#6A675F] italic pt-1">
                                  "{inspectedSession.coachRemark}"
                                </p>
                              )}
                            </div>
                          )}

                          {inspectedSession.curriculumAdaptation && (
                            <div className="p-3 rounded-[6px] bg-[#A8844F]/10 border border-[#A8844F]/30 flex items-start gap-2.5 text-xs">
                              <Sparkles className="w-4 h-4 text-[#A8844F] shrink-0 mt-0.5" />
                              <div className="space-y-0.5">
                                <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#A8844F] font-semibold block">
                                  GIÁO ÁN ĐÃ HIỆU CHỈNH THEO GÓP Ý CỦA BẠN
                                </span>
                                <p className="text-xs text-[#15171C] leading-relaxed">
                                  {inspectedSession.curriculumAdaptation}
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="text-xs text-[#6A675F] space-y-1 font-normal pt-1">
                            <div>
                              Thời gian:{" "}
                              <span className="text-[#15171C] font-medium">
                                {inspectedSession.startTime} –{" "}
                                {inspectedSession.endTime}
                              </span>
                            </div>
                            <div>
                              Địa điểm:{" "}
                              <span className="text-[#15171C] font-medium">
                                {inspectedSession.court}
                              </span>{" "}
                              • {inspectedSession.zone}
                            </div>
                            <div>
                              Giảng viên:{" "}
                              <span className="text-[#15171C] font-medium">
                                {inspectedSession.coach}
                              </span>
                            </div>
                          </div>

                          {/* Inline Dispute Reason Form when triggered */}
                          {disputingSessionNum === inspectedSession.num &&
                            !inspectedSession.dispute && (
                              <div className="p-3 rounded-[6px] bg-white border border-[#A8844F]/40 space-y-2.5 text-xs">
                                <div className="font-medium text-[#15171C]">
                                  Ghi chú đối soát điểm danh gửi Ban Giáo vụ:
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {[
                                    "Đã vào sân nhưng quên quét thẻ cổng từ",
                                    "Cổng soát vé báo lỗi khi quét QR",
                                    "Điểm danh hộ qua Lễ tân chưa đồng bộ",
                                  ].map((preset) => (
                                    <button
                                      key={preset}
                                      type="button"
                                      onClick={() =>
                                        setDisputeReasonText(preset)
                                      }
                                      className={`px-2 py-1 rounded text-[11px] border cursor-pointer transition-colors ${
                                        disputeReasonText === preset
                                          ? "bg-[#15171C] text-[#FBF9F4] border-[#15171C]"
                                          : "bg-[#F5F2EA] text-[#15171C] border-[rgba(21,23,28,0.12)] hover:border-[#A8844F]"
                                      }`}
                                    >
                                      {preset}
                                    </button>
                                  ))}
                                </div>
                                <input
                                  type="text"
                                  value={disputeReasonText}
                                  onChange={(e) =>
                                    setDisputeReasonText(e.target.value)
                                  }
                                  placeholder="Nhập chi tiết thời gian vào sân hoặc lý do..."
                                  className="w-full px-2.5 py-1.5 rounded border border-[rgba(21,23,28,0.15)] bg-[#FBF9F4] text-xs text-[#15171C] outline-none focus:border-[#A8844F]"
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDisputingSessionNum(null)
                                      setDisputeReasonText("")
                                    }}
                                    className="px-2.5 py-1 text-[11px] text-[#6A675F] hover:text-[#15171C] cursor-pointer"
                                  >
                                    Hủy
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleReportDispute(inspectedSession)
                                    }
                                    className="px-3 py-1 rounded bg-[#15171C] text-[#FBF9F4] text-[11px] font-medium cursor-pointer hover:bg-[#2A2E37]"
                                  >
                                    Gửi yêu cầu đối soát
                                  </button>
                                </div>
                              </div>
                            )}

                          {/* Contextual Actions */}
                          <div className="pt-2 border-t border-[rgba(21,23,28,0.08)] flex items-center justify-between gap-3 text-xs flex-wrap">
                            <div>
                              {inspectedSession.status === "completed" &&
                                (inspectedSession.dispute ? (
                                  <div className="space-y-0.5">
                                    <span className="text-xs text-[#A8844F] font-medium block">
                                      ✓ Đang chờ đối soát camera (24h)
                                    </span>
                                    {inspectedSession.dispute.reason && (
                                      <span className="text-[11px] text-[#6A675F] italic block">
                                        “{inspectedSession.dispute.reason}”
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDisputingSessionNum(
                                        inspectedSession.num,
                                      )
                                      setDisputeReasonText(
                                        "Đã vào sân nhưng quên quét thẻ cổng từ",
                                      )
                                    }}
                                    className="text-xs text-[#6A675F] hover:text-[#15171C] underline underline-offset-4 cursor-pointer transition-colors"
                                  >
                                    Báo sai điểm danh
                                  </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-3">
                              {inspectedSession.status === "completed" &&
                                inspectedSession.feedback && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenSessionFeedback(
                                        inspectedSession,
                                        inspectedSession.feedback,
                                      )
                                    }
                                    className="text-[#15171C] hover:border-[#15171C] border border-[rgba(21,23,28,0.15)] font-medium bg-white px-2.5 py-1 rounded cursor-pointer transition-colors"
                                  >
                                    ✓ Đã đánh giá{" "}
                                    {Number(
                                      inspectedSession.feedback.rating || 5,
                                    ).toFixed(1)}
                                    ★ · Xem
                                  </button>
                                )}

                              {inspectedSession.status === "completed" &&
                                inspectedSession.canFeedback &&
                                !inspectedSession.feedback && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenSessionFeedback(
                                        inspectedSession,
                                        null,
                                      )
                                    }
                                    className="px-3 py-1.5 rounded bg-[#15171C] text-[#FBF9F4] hover:bg-[#2A2E37] font-medium transition-colors cursor-pointer"
                                  >
                                    Đánh giá HLV buổi này
                                  </button>
                                )}

                              {inspectedSession.status === "upcoming" &&
                                (inspectedSession.leaveRequest ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSessionForLeave({
                                        ...inspectedSession,
                                        id: `${activeCourse.id}-session-${inspectedSession.num}`,
                                        bookingId: `${activeCourse.id}-session-${inspectedSession.num}`,
                                        courseId: activeCourse.id,
                                        className: activeCourse.name,
                                        coachName: inspectedSession.coach,
                                        room: `${inspectedSession.court} (${inspectedSession.zone})`,
                                      })
                                      setLeaveRequestInitialType(
                                        inspectedSession.leaveRequest.type ||
                                          "leave",
                                      )
                                      setShowLeaveModal(true)
                                    }}
                                    className="text-[#A8844F] hover:underline font-medium cursor-pointer"
                                  >
                                    Đổi thông tin xin nghỉ buổi{" "}
                                    {inspectedSession.num}
                                  </button>
                                ) : canRequestLeave(
                                    inspectedSession.date,
                                    inspectedSession.startTime,
                                  ) ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSessionForLeave({
                                        ...inspectedSession,
                                        id: `${activeCourse.id}-session-${inspectedSession.num}`,
                                        bookingId: `${activeCourse.id}-session-${inspectedSession.num}`,
                                        courseId: activeCourse.id,
                                        className: activeCourse.name,
                                        coachName: inspectedSession.coach,
                                        room: `${inspectedSession.court} (${inspectedSession.zone})`,
                                      })
                                      setLeaveRequestInitialType("leave")
                                      setShowLeaveModal(true)
                                    }}
                                    className="text-[#15171C] hover:underline font-medium cursor-pointer"
                                  >
                                    Xin nghỉ buổi {inspectedSession.num}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (typeof showToast === "function") {
                                        showToast(
                                          "Buổi học diễn ra trong vòng 12 giờ. Quý hội viên vui lòng liên hệ Lễ tân/HLV để được hỗ trợ.",
                                          "info",
                                        )
                                      }
                                    }}
                                    className="text-[#6A675F]/60 text-xs underline underline-offset-4 cursor-pointer"
                                    title="Theo quy định, đơn xin nghỉ phải gửi trước tối thiểu 12 giờ."
                                  >
                                    Xin nghỉ (&lt; 12h: Báo Lễ tân)
                                  </button>
                                ))}

                              {inspectedSession.status === "today" &&
                                !isCheckedIn && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveDrawer(null)
                                      handlePerformCheckin()
                                    }}
                                    className="px-3 py-1.5 rounded bg-[#C9A96E] text-[#15171C] hover:bg-[#b89558] font-semibold transition-colors cursor-pointer"
                                  >
                                    Check-in buổi hôm nay
                                  </button>
                                )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Quota details */}
                      <div className="space-y-2 bg-[#F5F2EA] rounded-lg p-4 text-[13px] text-[#6A675F] leading-relaxed">
                        <div>
                          • Còn{" "}
                          <strong className="text-[#15171C] font-medium tabular-nums">
                            {stats.remainingSessions} buổi
                          </strong>{" "}
                          chưa diễn ra, bạn cần tham gia ít nhất{" "}
                          <strong className="text-[#15171C] font-medium tabular-nums">
                            {stats.needed}/{stats.remainingSessions} buổi
                          </strong>{" "}
                          để đạt chuẩn cấp chứng chỉ.
                        </div>
                        <div>
                          • Hạn mức vắng cho phép: còn{" "}
                          <strong className="text-[#15171C] font-medium tabular-nums">
                            {stats.allowedAbsentRemaining}/{stats.maxAbsent}
                          </strong>{" "}
                          buổi.
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Tab 2: Nhật ký học (Uniform padding, complete skills and notes) */
                    <div className="space-y-4">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-[#6A675F] font-medium pb-2 border-b border-[rgba(21,23,28,0.08)]">
                        LỊCH SỬ {pastSessions.length} BUỔI HỌC ĐÃ QUA
                      </div>

                      {pastSessions.length === 0 ? (
                        <div className="py-12 text-center text-sm text-[#6A675F] italic">
                          Chưa có buổi học nào kết thúc.
                        </div>
                      ) : (
                        <div className="divide-y divide-[rgba(21,23,28,0.08)]">
                          {pastSessions.map((session) => (
                            <div
                              key={session.num}
                              className="py-4 first:pt-0 last:pb-0 space-y-2"
                            >
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-[#15171C] font-medium">
                                  {session.dayVi}
                                </span>
                                <span className="text-xs text-[#2F6B4F] flex items-center gap-1 font-medium">
                                  <Check className="w-3.5 h-3.5 stroke-[2]" />
                                  <span>Có mặt ({session.checkinTime})</span>
                                </span>
                              </div>

                              <div className="text-xs text-[#15171C] font-medium">
                                Nội dung: {session.topic}
                              </div>

                              <div className="text-xs text-[#6A675F]">
                                {session.startTime} – {session.endTime} •{" "}
                                {session.court} • {session.coach}
                              </div>

                              {session.skillScores && (
                                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                                  <div className="p-1.5 rounded bg-white border border-[rgba(21,23,28,0.06)] flex justify-between">
                                    <span className="text-[#6A675F]">
                                      Cảm giác bóng
                                    </span>
                                    <span className="text-[#15171C] font-semibold tabular-nums">
                                      {session.skillScores.control}/5.0
                                    </span>
                                  </div>
                                  <div className="p-1.5 rounded bg-white border border-[rgba(21,23,28,0.06)] flex justify-between">
                                    <span className="text-[#6A675F]">
                                      Bộ chân
                                    </span>
                                    <span className="text-[#15171C] font-semibold tabular-nums">
                                      {session.skillScores.movement}/5.0
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Coach feedback status or action & Dispute action */}
                              <div className="pt-2 flex items-center justify-between text-xs">
                                {session.dispute ? (
                                  <div className="space-y-0.5">
                                    <span className="text-xs text-[#A8844F] font-medium block">
                                      ✓ Đang chờ đối soát camera (24h)
                                    </span>
                                    {session.dispute.reason && (
                                      <span className="text-[11px] text-[#6A675F] italic block">
                                        “{session.dispute.reason}”
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveDrawer("attendance")
                                      setInspectedSessionNum(session.num)
                                      setDisputingSessionNum(session.num)
                                      setDisputeReasonText(
                                        "Đã vào sân nhưng quên quét thẻ cổng từ",
                                      )
                                    }}
                                    className="text-xs text-[#6A675F] hover:text-[#15171C] underline underline-offset-4 cursor-pointer transition-colors"
                                  >
                                    Báo sai điểm danh
                                  </button>
                                )}

                                <div>
                                  {session.feedback ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenSessionFeedback(
                                          session,
                                          session.feedback,
                                        )
                                      }
                                      className="text-[#15171C] hover:border-[#15171C] border border-[rgba(21,23,28,0.12)] font-medium bg-[#F5F2EA] px-2.5 py-1 rounded cursor-pointer transition-colors"
                                    >
                                      ✓ Đã đánh giá{" "}
                                      {Number(
                                        session.feedback.rating || 5,
                                      ).toFixed(1)}
                                      ★ · Xem / Sửa
                                    </button>
                                  ) : session.canFeedback ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleOpenSessionFeedback(session, null)
                                      }
                                      className="px-3 py-1.5 rounded bg-[#15171C] text-[#FBF9F4] hover:bg-[#2A2E37] transition-colors cursor-pointer font-medium"
                                    >
                                      Đánh giá HLV
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Drawer Footer (Seamless Surface Color) */}
                <div className="p-4 border-t border-[rgba(21,23,28,0.08)] bg-[#FBF9F4] flex items-center justify-between text-xs text-[#6A675F]">
                  <span>Dữ liệu đồng bộ từ máy quét cửa tự động</span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDrawer(null)
                      setShowPolicyModal(true)
                    }}
                    className="text-[#15171C] hover:underline font-medium cursor-pointer"
                  >
                    Quy chế điểm danh
                  </button>
                </div>
              </motion.aside>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================================== */}
      {/* 6. DEV CONTROLLER (Hidden when Drawer is open)                 */}
      {/* ============================================================== */}
      {!activeDrawer && (
        <div className="fixed bottom-20 sm:bottom-4 right-4 z-50">
          <button
            type="button"
            onClick={() => setShowDevPanel((prev) => !prev)}
            className="p-2 rounded-full bg-[#15171C]/80 hover:bg-[#15171C] text-[#FBF9F4] text-xs shadow-md backdrop-blur-xs cursor-pointer transition-all"
            title="Tùy chọn giả lập kiểm thử"
          >
            <SlidersHorizontal className="w-4 h-4 stroke-[1.5]" />
          </button>

          {showDevPanel && (
            <div className="absolute bottom-10 right-0 w-72 bg-[#FBF9F4] border border-[rgba(21,23,28,0.15)] shadow-xl rounded-md p-4 space-y-3 text-xs text-[#15171C]">
              <div className="flex items-center justify-between border-b border-[rgba(21,23,28,0.08)] pb-2 font-medium">
                <span>Kiểm thử trạng thái</span>
                <button
                  type="button"
                  onClick={() => setShowDevPanel(false)}
                  className="text-[#6A675F] hover:text-[#15171C]"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="text-[11px] text-[#6A675F]">
                  Trạng thái buổi học:
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStateOverride(SESSION_STATE.UPCOMING)}
                    className={`p-1.5 border rounded text-[11px] ${
                      sessionState === SESSION_STATE.UPCOMING
                        ? "bg-[#15171C] text-[#FBF9F4]"
                        : "bg-[#F5F2EA]"
                    }`}
                  >
                    Cổng khóa
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setStateOverride(SESSION_STATE.CHECK_IN_OPEN)
                    }
                    className={`p-1.5 border rounded text-[11px] ${
                      sessionState === SESSION_STATE.CHECK_IN_OPEN
                        ? "bg-[#15171C] text-[#FBF9F4]"
                        : "bg-[#F5F2EA]"
                    }`}
                  >
                    Mở cổng
                  </button>
                  <button
                    type="button"
                    onClick={() => setStateOverride(SESSION_STATE.CHECKED_IN)}
                    className={`p-1.5 border rounded text-[11px] ${
                      sessionState === SESSION_STATE.CHECKED_IN
                        ? "bg-[#15171C] text-[#FBF9F4]"
                        : "bg-[#F5F2EA]"
                    }`}
                  >
                    Đã check-in
                  </button>
                  <button
                    type="button"
                    onClick={() => setStateOverride(null)}
                    className="p-1.5 border rounded text-[11px] bg-[#F5F2EA] text-[#6A675F]"
                  >
                    Tự động
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-[rgba(21,23,28,0.08)]">
                <div className="text-[11px] text-[#6A675F]">
                  Trạng thái hệ thống:
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => setViewState("normal")}
                    className={`p-1 border rounded text-[10px] ${
                      viewState === "normal" ? "bg-[#15171C] text-white" : ""
                    }`}
                  >
                    Bình thường
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewState("loading")}
                    className={`p-1 border rounded text-[10px] ${
                      viewState === "loading" ? "bg-[#15171C] text-white" : ""
                    }`}
                  >
                    Loading
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewState("error")}
                    className={`p-1 border rounded text-[10px] ${
                      viewState === "error" ? "bg-[#15171C] text-white" : ""
                    }`}
                  >
                    Lỗi mạng
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. MODALS                                                      */}
      {/* ============================================================== */}

      {/* Class Feedback Modal */}
      {selectedClassForFeedback && (
        <ClassFeedbackModal
          isOpen={Boolean(selectedClassForFeedback)}
          onClose={() => {
            setSelectedClassForFeedback(null)
            setFeedbackViewData(null)
          }}
          classItem={selectedClassForFeedback}
          existingFeedback={feedbackViewData}
        />
      )}

      {/* Attendance Policy Modal */}
      <AttendancePolicyModal
        isOpen={showPolicyModal}
        onClose={() => setShowPolicyModal(false)}
        language={language}
      />

      {/* Leave Request Modal */}
      <LeaveRequestModal
        isOpen={showLeaveModal}
        onClose={() => {
          setShowLeaveModal(false)
          setSessionForLeave(null)
        }}
        upcomingSessions={eligibleLeaveSessions}
        defaultSession={sessionForLeave || heroSessionWithMeta}
        onSubmitLeave={handleLeaveSubmit}
        absentQuota={activeCourse.maxAbsent}
        currentAbsent={stats.absent}
        language={language}
        initialRequestType={leaveRequestInitialType}
      />

      {/* Digital Pass / QR Modal: Apple Wallet Black Edition with qrcode.react */}
      {showQrPassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#15171C]/75 backdrop-blur-md animate-in fade-in duration-200 font-['Be_Vietnam_Pro',sans-serif]">
          <div className="max-w-sm w-full bg-[#15171C] text-[#FBF9F4] border border-white/10 rounded-2xl p-6 sm:p-7 space-y-6 relative overflow-hidden shadow-2xl">
            {/* Ambient subtle light glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#C9A96E]/15 rounded-full blur-3xl pointer-events-none" />

            {/* Top Bar */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 relative z-10">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C9A96E] animate-pulse" />
                <span className="text-[11px] tracking-[0.14em] uppercase font-sans font-medium text-[#C9A96E]">
                  VIBE ATHLETIC • {isVip ? "THẺ VÀO SÂN VIP" : "THẺ VÀO SÂN"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowQrPassModal(false)}
                className="text-[#6A675F] hover:text-white p-1 rounded transition-colors cursor-pointer"
                title="Đóng thẻ (ESC)"
              >
                <X className="w-5 h-5 stroke-[1.75]" />
              </button>
            </div>

            {/* Pass Metadata Block */}
            <div className="space-y-1 relative z-10">
              <div className="flex items-center justify-between text-xs">
                <span className="uppercase tracking-wider text-[#6A675F] font-medium">
                  Khóa học đăng ký
                </span>
                <span className="text-[10px] font-sans text-[#C9A96E] font-medium border border-[#C9A96E]/40 px-2 py-0.5 rounded bg-[#15171C]">
                  {isVip ? "FOUNDING MEMBER" : "HỘI VIÊN TIÊU CHUẨN"}
                </span>
              </div>
              <div className="font-['Newsreader',serif] text-2xl text-[#FBF9F4] tracking-tight">
                {activeCourse.name}
              </div>
              <div className="text-xs text-[#FBF9F4]/70 leading-relaxed pt-0.5">
                <strong className="text-white font-medium">
                  {heroSession.court}
                </strong>{" "}
                • {heroSession.zone} • {activeCourse.gate}
              </div>
            </div>

            {/* Ticket Stub Notch Line */}
            <div className="relative py-1">
              <div className="border-t border-dashed border-white/10 w-full" />
              <div className="absolute -left-10 -top-2.5 w-5 h-5 rounded-full bg-[#15171C]" />
              <div className="absolute -right-10 -top-2.5 w-5 h-5 rounded-full bg-[#15171C]" />
            </div>

            {/* QR / Attendance State Block (Real QRCodeSVG) */}
            <div className="flex flex-col items-center justify-center text-center space-y-4 relative z-10">
              {isCheckedIn ? (
                <div className="w-56 h-56 rounded-xl border border-[#2F6B4F]/40 bg-[#2F6B4F]/10 p-6 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[#2F6B4F]/20 border border-[#2F6B4F]/40 flex items-center justify-center text-[#68D391]">
                    <Check className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div className="font-medium text-sm text-[#68D391] tracking-wide">
                    ĐÃ QUA CỔNG SOÁT VÉ
                  </div>
                  <div className="text-xs text-[#FBF9F4]/70 font-mono">
                    Có mặt: {heroSession.checkinTime || "05:55"} •{" "}
                    {activeCourse.gate}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative w-56 h-56 bg-white p-4 rounded-xl flex items-center justify-center overflow-hidden shadow-md">
                    <div
                      className={`w-full h-full flex items-center justify-center transition-all duration-300 ${
                        !isCheckInOpen ? "blur-[5px] opacity-20" : ""
                      }`}
                    >
                      <QRCodeSVG
                        value={`SCMS://PASS/${activeCourse.code}/${heroSession.num}/${member?.code}/${otpBackupCode}`}
                        size={192}
                        level="H"
                        fgColor="#15171C"
                        bgColor="#FFFFFF"
                        className="w-full h-full"
                      />
                    </div>

                    {!isCheckInOpen && (
                      <div className="absolute inset-0 bg-[#15171C]/75 backdrop-blur-xs flex flex-col items-center justify-center p-3 text-center space-y-2">
                        <div className="w-10 h-10 rounded-full bg-[#15171C] border border-[#C9A96E] flex items-center justify-center text-[#C9A96E]">
                          <Lock className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-medium text-white/90">
                          Cổng mở lúc{" "}
                          {getGateOpeningTime(heroSession.startTime)}
                        </span>
                        <span className="text-[11px] text-[#FBF9F4]/60">
                          Mã sẽ tự động kích hoạt khi mở cổng
                        </span>
                      </div>
                    )}
                  </div>

                  {isCheckInOpen && (
                    <div className="flex items-center justify-center gap-2 text-xs text-[#FBF9F4]/70">
                      <span>Mã OTP tự động làm mới sau:</span>
                      <span className="font-['JetBrains_Mono',monospace] text-white font-medium tabular-nums bg-white/10 px-2 py-0.5 rounded">
                        {qrCountdown}s
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Apple / Google Wallet Buttons */}
            <div className="pt-2 grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  if (typeof showToast === "function") {
                    showToast(
                      "Đã tạo liên kết Apple Wallet Pass cho thiết bị của bạn.",
                      "success",
                    )
                  }
                }}
                className="py-2 px-3 rounded-lg bg-black hover:bg-neutral-900 border border-white/20 text-white font-mono text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <span> Add to Apple Wallet</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (typeof showToast === "function") {
                    showToast(
                      "Đã tạo liên kết Google Wallet Pass cho thiết bị của bạn.",
                      "success",
                    )
                  }
                }}
                className="py-2 px-3 rounded-lg bg-[#202124] hover:bg-[#303134] border border-white/20 text-white font-mono text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <span>Google Wallet</span>
              </button>
            </div>

            {/* Pass Footer / Actions */}
            <div className="border-t border-white/10 pt-4 flex items-center justify-between relative z-10">
              <div className="space-y-0.5">
                <div className="text-[10px] uppercase tracking-wider text-[#6A675F] font-medium">
                  Chủ thẻ hội viên
                </div>
                <div className="text-xs text-[#FBF9F4] font-medium">
                  {member?.name || "Bùi Văn Phúc"}
                </div>
              </div>

              {isCheckedIn ? (
                <button
                  type="button"
                  onClick={() => setShowQrPassModal(false)}
                  className="px-4 py-2 rounded bg-white/10 hover:bg-white/15 text-[#FBF9F4] text-xs font-medium cursor-pointer transition-colors"
                >
                  Đóng thẻ
                </button>
              ) : isCheckInOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    handlePerformCheckin()
                    setShowQrPassModal(false)
                  }}
                  className="px-4 py-2 rounded bg-[#C9A96E] hover:bg-[#b89558] text-[#15171C] text-xs font-semibold cursor-pointer transition-colors"
                >
                  Xác nhận check-in
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowQrPassModal(false)}
                  className="px-4 py-2 rounded bg-white/10 hover:bg-white/15 text-[#FBF9F4] text-xs font-medium cursor-pointer transition-colors"
                >
                  Đóng
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
