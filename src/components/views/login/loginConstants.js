export const DEMO_EMAIL = "manager@scms.com"
// Mật khẩu demo chỉ có trong bản build chế độ giả (vite --mode mock). Bản build thật nhận null,
// nên chuỗi không lọt vào bundle và không mật khẩu nào khớp với null.
export const DEMO_PASSWORD = import.meta.env.MODE === "mock" ? "Scms@2026" : null
export const REGISTRATION_OTP_REQUEST_TIMEOUT_MS = 30000
export const RECENT_EMAILS_KEY = "scms_recent_login_emails"
export const EMAIL_DOMAIN_SUGGESTIONS = [
  "@gmail.com",
  "@fpt.edu.vn",
  "@vibesport.vn",
  "@scms.com",
]

export const SPORT_ONBOARDING_OPTIONS = [
  {
    id: "badminton",
    labelVi: "Cầu lông",
    labelEn: "Badminton",
    headlineTopVi: "CHINH PHỤC",
    headlineAccentVi: "CẦU LÔNG.",
    headlineTopEn: "MASTER",
    headlineAccentEn: "BADMINTON.",
    descVi:
      "Rèn tốc độ, sự linh hoạt và phản xạ qua từng đường cầu trên hệ thống sân thảm chuẩn BWF.",
    descEn:
      "Build speed, agility, and reflexes across every rally on BWF-standard courts.",
  },
  {
    id: "pickleball",
    labelVi: "Pickleball",
    labelEn: "Pickleball",
    headlineTopVi: "BÙNG NỔ CÙNG",
    headlineAccentVi: "PICKLEBALL.",
    headlineTopEn: "ENERGIZE WITH",
    headlineAccentEn: "PICKLEBALL.",
    descVi:
      "Môn thể thao xu hướng đầy năng lượng, dễ bắt đầu và kết nối cộng đồng trên mặt sân chuẩn DUPR.",
    descEn:
      "An energetic trending sport that is easy to pick up and fun to play together.",
  },
  {
    id: "swimming",
    labelVi: "Bơi lội",
    labelEn: "Swimming",
    headlineTopVi: "SỨC BỀN CÙNG",
    headlineAccentVi: "BƠI LỘI.",
    headlineTopEn: "ENDURANCE IN",
    headlineAccentEn: "SWIMMING.",
    descVi:
      "Hoàn thiện kỹ thuật bơi, điều hòa nhịp thở và nâng cao thể lực toàn diện trong hồ bơi 4 mùa.",
    descEn:
      "Build swimming technique, breathing control, and total fitness in our 4-season pool.",
  },
  {
    id: "archery",
    labelVi: "Bắn cung",
    labelEn: "Archery",
    headlineTopVi: "TẬP TRUNG CÙNG",
    headlineAccentVi: "BẮN CUNG.",
    headlineTopEn: "PRECISION IN",
    headlineAccentEn: "ARCHERY.",
    descVi:
      "Rèn sự tĩnh tại, tư thế chuẩn xác và khả năng làm chủ tâm lý qua từng phát bắn cự ly 15m.",
    descEn:
      "Practice focus, posture, and mental control across every 15m target shot.",
  },
  {
    id: "basketball",
    labelVi: "Bóng rổ",
    labelEn: "Basketball",
    headlineTopVi: "BỨT PHÁ CÙNG",
    headlineAccentVi: "BÓNG RỔ.",
    headlineTopEn: "ELEVATE WITH",
    headlineAccentEn: "BASKETBALL.",
    descVi:
      "Phát triển kỹ thuật dẫn bóng, sức bật và tinh thần phối hợp đồng đội trên mặt sân gỗ tiêu chuẩn.",
    descEn:
      "Develop ball handling, vertical power, and teamwork on pro hardwood courts.",
  },
  {
    id: "tennis",
    labelVi: "Quần vợt",
    labelEn: "Tennis",
    headlineTopVi: "LÀM CHỦ SÂN",
    headlineAccentVi: "QUẦN VỢT.",
    headlineTopEn: "COMMAND THE",
    headlineAccentEn: "TENNIS COURT.",
    descVi:
      "Hoàn thiện kỹ thuật giao bóng, bộ chân di chuyển và bản lĩnh kiểm soát trận đấu.",
    descEn:
      "Refine your serve, footwork, and match control with specialist coaches.",
  },
  {
    id: "football",
    labelVi: "Bóng đá",
    labelEn: "Football",
    headlineTopVi: "BỨT TỐC CÙNG",
    headlineAccentVi: "BÓNG ĐÁ.",
    headlineTopEn: "MOVE UP WITH",
    headlineAccentEn: "FOOTBALL.",
    descVi:
      "Rèn kỹ thuật, thể lực và phối hợp đồng đội qua từng buổi tập trên sân bóng.",
    descEn:
      "Build technique, fitness, and teamwork through focused football training.",
  },
  {
    id: "volleyball",
    labelVi: "Bóng chuyền",
    labelEn: "Volleyball",
    headlineTopVi: "CHINH PHỤC",
    headlineAccentVi: "BÓNG CHUYỀN.",
    headlineTopEn: "RISE TO",
    headlineAccentEn: "VOLLEYBALL.",
    descVi:
      "Hoàn thiện kỹ thuật chuyền, đập bóng và phối hợp chiến thuật cùng đồng đội.",
    descEn:
      "Improve your passing, attacking, and tactical teamwork on court.",
  },
  {
    id: "table-tennis",
    labelVi: "Bóng bàn",
    labelEn: "Table tennis",
    headlineTopVi: "LÀM CHỦ",
    headlineAccentVi: "BÓNG BÀN.",
    headlineTopEn: "MASTER",
    headlineAccentEn: "TABLE TENNIS.",
    descVi:
      "Phát triển phản xạ, độ chính xác và chiến thuật qua từng pha bóng tốc độ.",
    descEn:
      "Sharpen your reflexes, precision, and strategy in every fast-paced rally.",
  },
]
