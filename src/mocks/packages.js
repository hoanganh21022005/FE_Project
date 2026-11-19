export const INITIAL_PACKAGES = [
  {
    id: "pkg-1",
    name: "Basic Fitness",
    nameVi: "Gói Cơ Bản",
    price: 1200000,
    durationMonths: 1,
    description: "Access to gym facilities and basic cardio area.",
    descriptionVi:
      "Tập luyện không giới hạn tại khu vực tập tạ và máy chạy bộ.",
    benefits: [
      "Unlimited Gym & Cardio access",
      "Locker room & Sauna facilities",
      "1 free Personal Trainer orientation session",
    ],
    benefitsVi: [
      "Tập thể hình và máy chạy bộ không giới hạn",
      "Sử dụng tủ khóa cá nhân và phòng xông hơi",
      "1 buổi định hướng tập luyện cùng Huấn luyện viên",
    ],
    maxClassesPerMonth: 4,
    tier: 1,
    status: "active",
  },
  {
    id: "pkg-2",
    name: "Pro Performance",
    nameVi: "Gói Nâng Cao",
    price: 3200000,
    durationMonths: 3,
    description:
      "Full access + group classes (Yoga, Pilates, CrossFit) + priority booking.",
    descriptionVi:
      "Toàn quyền tập luyện, tham gia lớp nhóm và ưu tiên đặt chỗ trước.",
    benefits: [
      "Includes all Basic benefits",
      "Unlimited group fitness classes",
      "Priority booking during peak hours",
      "Periodic InBody body composition scan",
    ],
    benefitsVi: [
      "Bao gồm toàn bộ quyền lợi của Gói Cơ Bản",
      "Tham gia không giới hạn các lớp nhóm",
      "Ưu tiên đặt chỗ trước trong khung giờ cao điểm",
      "Đo và phân tích chỉ số cơ thể InBody định kỳ",
    ],
    maxClassesPerMonth: 16,
    tier: 2,
    status: "active",
  },
  {
    id: "pkg-3",
    name: "VIP Elite Club",
    nameVi: "Gói Thượng Hạng",
    price: 11500000,
    durationMonths: 12,
    description:
      "Ultimate all-access membership + Personal Coach assigned + VIP lounge.",
    descriptionVi:
      "Đặc quyền cao cấp nhất với Huấn luyện viên riêng và phòng chờ tiện nghi.",
    benefits: [
      "Includes all Pro benefits",
      "Dedicated Personal Trainer with custom plan",
      "Private VIP lounge & complimentary towels",
      "Unlimited access to all facilities & classes",
      "2 free guest passes per month",
    ],
    benefitsVi: [
      "Bao gồm toàn bộ quyền lợi của Gói Nâng Cao",
      "Huấn luyện viên cá nhân theo sát lộ trình riêng",
      "Phòng chờ riêng biệt và dịch vụ khăn tắm miễn phí",
      "Tham gia tất cả các lớp học không giới hạn",
      "Tặng 2 lượt vé mời người thân mỗi tháng",
    ],
    maxClassesPerMonth: 999,
    tier: 3,
    status: "active",
  },
]
