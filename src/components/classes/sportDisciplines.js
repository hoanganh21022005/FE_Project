export const SPORT_DISCIPLINES = [
  {
    id: "badminton",
    name: "Cầu lông",
    codePrefix: "CL",
    defaultDuration: 60,
    defaultCapacity: 8,
    backendSubjectId: 1,
    courts: [
      {
        id: "badminton-1",
        backendId: 1,
        name: "Sân Cầu Lông 1",
        spec: "Thảm PVC thi đấu",
        capacity: 8,
        location: "Tầng 1 - Khu Trong Nhà",
      },
      {
        id: "badminton-2",
        backendId: 1,
        name: "Sân Cầu Lông 2",
        spec: "Thảm tiêu chuẩn",
        capacity: 8,
        location: "Tầng 1 - Khu Trong Nhà",
      },
      {
        id: "badminton-vip",
        backendId: 5,
        name: "Nhà thi đấu Cầu Lông",
        spec: "Sàn gỗ đa năng",
        capacity: 16,
        location: "Nhà thi đấu",
      },
    ],
  },
  {
    id: "table_tennis",
    name: "Bóng bàn",
    codePrefix: "BB",
    defaultDuration: 60,
    defaultCapacity: 6,
    backendSubjectId: 3,
    courts: [
      {
        id: "tt-1",
        backendId: 2,
        name: "Phòng Bóng Bàn VIP 1",
        spec: "Bàn thi đấu tiêu chuẩn ITTF",
        capacity: 6,
        location: "Tầng 2 - Tòa Thể Thao",
      },
      {
        id: "tt-2",
        backendId: 2,
        name: "Khu Bóng Bàn Trong Nhà",
        spec: "Khu liên hợp 4 bàn",
        capacity: 12,
        location: "Tầng 2 - Tòa Thể Thao",
      },
    ],
  },
  {
    id: "pickleball",
    name: "Pickleball",
    codePrefix: "PK",
    defaultDuration: 60,
    defaultCapacity: 8,
    backendSubjectId: 2,
    courts: [
      {
        id: "pickle-1",
        backendId: 1,
        name: "Sân Pickleball A1",
        spec: "Mặt sân Pro Cushion tiêu chuẩn",
        capacity: 8,
        location: "Khu Sân Trung Tâm",
      },
      {
        id: "pickle-2",
        backendId: 1,
        name: "Sân Pickleball A2",
        spec: "Mặt sân Acrylic tiêu chuẩn",
        capacity: 8,
        location: "Khu Sân Trung Tâm",
      },
      {
        id: "pickle-roof",
        backendId: 1,
        name: "Sân Pickleball Mái Che VIP",
        spec: "Mái che & đèn LED ban đêm",
        capacity: 12,
        location: "Khu Mái Che Ngoài Trời",
      },
    ],
  },
  {
    id: "basketball",
    name: "Bóng rổ",
    codePrefix: "BR",
    defaultDuration: 90,
    defaultCapacity: 15,
    backendSubjectId: 5,
    courts: [
      {
        id: "basket-1",
        backendId: 5,
        name: "Sân Bóng Rổ Trong Nhà",
        spec: "Sàn gỗ phong thi đấu FIBA",
        capacity: 18,
        location: "Nhà thi đấu Đa năng",
      },
      {
        id: "basket-2",
        backendId: 5,
        name: "Sân Bóng Rổ Ngoài Trời",
        spec: "Mặt sân Acrylic chống trơn",
        capacity: 16,
        location: "Khu Sân Ngoài Trời",
      },
    ],
  },
  {
    id: "volleyball",
    name: "Bóng chuyền",
    codePrefix: "BC",
    defaultDuration: 90,
    defaultCapacity: 14,
    backendSubjectId: 6,
    courts: [
      {
        id: "volley-1",
        backendId: 5,
        name: "Sân Bóng Chuyền Thi Đấu",
        spec: "Mặt thảm Teraflex tiêu chuẩn",
        capacity: 16,
        location: "Nhà thi đấu Đa năng",
      },
      {
        id: "volley-2",
        backendId: 5,
        name: "Khu Thể Thao Đa Năng B",
        spec: "Sân đa năng linh hoạt",
        capacity: 14,
        location: "Nhà thi đấu Đa năng",
      },
    ],
  },
  {
    id: "archery",
    name: "Bắn cung",
    codePrefix: "BCU",
    defaultDuration: 60,
    defaultCapacity: 6,
    backendSubjectId: 4,
    courts: [
      {
        id: "archery-1",
        backendId: 3,
        name: "Trường Bắn Cung 15m",
        spec: "Bia mục tiêu tiêu chuẩn",
        capacity: 6,
        location: "Tầng 3 - Sân Chuyên Dụng",
      },
      {
        id: "archery-2",
        backendId: 3,
        name: "Trường Bắn Cung 30m",
        spec: "Cự ly thi đấu chuyên sâu",
        capacity: 8,
        location: "Tầng 3 - Sân Chuyên Dụng",
      },
    ],
  },
  {
    id: "shooting",
    name: "Bắn súng",
    codePrefix: "BS",
    defaultDuration: 60,
    defaultCapacity: 6,
    backendSubjectId: 7,
    courts: [
      {
        id: "shooting-1",
        backendId: 3,
        name: "Phòng Bắn Súng Hơi 10m",
        spec: "Bia điện tử SIUS chuẩn Olympic",
        capacity: 6,
        location: "Tầng 3 - Phòng Cách Âm",
      },
      {
        id: "shooting-2",
        backendId: 3,
        name: "Phòng Mô Phỏng Laser",
        spec: "Hệ thống hồng ngoại Scatt",
        capacity: 8,
        location: "Tầng 3 - Phòng Công Nghệ Cao",
      },
    ],
  },
  {
    id: "football",
    name: "Bóng đá",
    codePrefix: "BD",
    defaultDuration: 90,
    defaultCapacity: 18,
    backendSubjectId: 8,
    courts: [
      {
        id: "foot-1",
        backendId: 6,
        name: "Sân Cỏ Nhân Tạo 5 Người (Sân A)",
        spec: "Cỏ sợi Monofilament tiêu chuẩn",
        capacity: 16,
        location: "Khu Sân Cỏ Ngoài Trời",
      },
      {
        id: "foot-2",
        backendId: 6,
        name: "Sân Cỏ Nhân Tạo 7 Người (Sân B)",
        spec: "Cỏ nhân tạo hạt cao su",
        capacity: 22,
        location: "Khu Sân Cỏ Ngoài Trời",
      },
    ],
  },
  {
    id: "tennis",
    name: "Quần vợt",
    codePrefix: "QV",
    defaultDuration: 90,
    defaultCapacity: 8,
    backendSubjectId: 9,
    courts: [
      {
        id: "tennis-1",
        backendId: 4,
        name: "Sân Tennis Hardcourt 1",
        spec: "Mặt sân DecoTurf chuẩn US Open",
        capacity: 8,
        location: "Khu Ngoài Trời Mái Che",
      },
      {
        id: "tennis-2",
        backendId: 4,
        name: "Sân Tennis Trung Tâm",
        spec: "Mái che & giàn đèn LED 1000 Lux",
        capacity: 10,
        location: "Khu Ngoài Trời Mái Che",
      },
    ],
  },
]

export const CLASS_LEVELS = ["Cơ bản", "Trung cấp", "Nâng cao", "Mọi cấp độ"]

export const SPORT_SYNONYMS = {
  "quần vợt": ["quần vợt", "tennis", "quan vot", "qv"],
  tennis: ["quần vợt", "tennis", "quan vot", "qv"],
  "bắn súng": ["bắn súng", "shooting", "ban sung", "súng", "sung"],
  "bắn cung": ["bắn cung", "archery", "ban cung", "cung"],
  "cầu lông": ["cầu lông", "badminton", "cau long"],
  "bóng bàn": ["bóng bàn", "table tennis", "ping pong", "bong ban"],
  "bóng đá": ["bóng đá", "football", "soccer", "bong da"],
  "bóng rổ": ["bóng rổ", "basketball", "bong ro"],
  "bóng chuyền": ["bóng chuyền", "volleyball", "bong chuyen"],
  "bơi lội": ["bơi lội", "swimming", "boi loi", "bơi"],
  pickleball: ["pickleball", "pickle ball", "dupr"],
}

/**
 * Checks whether a coach's specialization matches a given sport or category name.
 * Robust to synonyms like Quần vợt <-> Tennis, and strictly isolates Bắn súng from Bắn cung.
 */
export function isCoachMatchingSport(coach, sportNameOrCategory) {
  if (!coach || !sportNameOrCategory) return false
  const spec = (
    coach.specializationVi ||
    coach.specialization ||
    coach.specialtyVi ||
    coach.specialty ||
    ""
  )
    .toLowerCase()
    .trim()
  if (!spec) return false

  const target = String(sportNameOrCategory).toLowerCase().trim()

  // Safety: prevent false positive between "bắn súng" and "bắn cung"
  const isShootingTarget =
    target.includes("bắn súng") ||
    target.includes("shooting") ||
    target.includes("súng")
  const isArcheryTarget =
    target.includes("bắn cung") ||
    target.includes("archery") ||
    target.includes("cung")
  const isShootingSpec =
    spec.includes("bắn súng") ||
    spec.includes("shooting") ||
    spec.includes("súng")
  const isArcherySpec =
    spec.includes("bắn cung") ||
    spec.includes("archery") ||
    spec.includes("cung")

  if (isShootingTarget && !isArcheryTarget) {
    return isShootingSpec && !isArcherySpec
  }
  if (isArcheryTarget && !isShootingTarget) {
    return isArcherySpec && !isShootingSpec
  }

  // Exact or direct includes
  if (spec.includes(target) || target.includes(spec)) return true

  // Check synonym map
  for (const [key, synonyms] of Object.entries(SPORT_SYNONYMS)) {
    const isTarget =
      target === key ||
      target.includes(key) ||
      synonyms.some((s) => target.includes(s))
    if (isTarget) {
      const isSpec =
        spec === key ||
        spec.includes(key) ||
        synonyms.some((s) => spec.includes(s))
      if (isSpec) return true
    }
  }

  return false
}
