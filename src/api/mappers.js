const normalizeStatus = (status, fallback = null) =>
  status ? String(status).trim().toLowerCase().replace(/\s+/g, "_") : fallback

export const asNumber = (value) => {
  if (value === null || value === undefined || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export const idNumber = (value) => {
  const direct = asNumber(value)
  if (direct !== null) return direct
  const match = String(value ?? "").match(/(\d+)$/)
  return match ? Number(match[1]) : null
}

export function parseBenefits(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (!value) return []
  return String(value)
    .split(/\s*(?:;|\r?\n)\s*/)
    .filter(Boolean)
}

export function serializeBenefits(value) {
  return Array.isArray(value) ? value.filter(Boolean).join(";") : value || ""
}

export const mapSubject = (subject) => ({
  id: subject.id,
  name: subject.name,
  description: subject.description ?? null,
  normalPrice: asNumber(subject.normalPrice),
  advancedPrice: asNumber(subject.advancedPrice),
  slug: subject.slug ?? null,
  status: normalizeStatus(subject.status, null),
  outdoor: subject.outdoor ?? null,
})

export const mapRoom = (room) => {
  const code = room?.roomCode ?? room?.room_code ?? null
  return {
    id: room?.id,
    roomCode: typeof code === "string" ? code.trim() || null : (code ?? null),
    name: room?.name ?? null,
    location: room?.location ?? null,
    capacity: asNumber(room?.capacity),
    status: normalizeStatus(room?.status, null),
    rawStatus: room?.status ?? null,
    facilityType: room?.facilityType ?? null,
    outdoor: typeof room?.outdoor === "boolean" ? room?.outdoor : null,
  }
}

export function mapSession(item) {
  if (!item || typeof item !== "object") return null
  const id = asNumber(item.id)
  if (id === null) return null
  return {
    id,
    classId: asNumber(item.classId),
    className: item.className ?? null,
    subjectId: asNumber(item.subjectId),
    subjectName: item.subjectName ?? null,
    coachId: asNumber(item.coachId),
    coachName: item.coachName ?? null,
    roomId: asNumber(item.roomId),
    roomName: item.roomName ?? null,
    roomLocation: item.roomLocation ?? null,
    sessionDate: item.sessionDate ?? null,
    startTime: item.startTime ?? null,
    endTime: item.endTime ?? null,
    status: item.status ?? (item.centerInvalidated === true ? "Cancelled" : null),
    centerInvalidated: item.centerInvalidated === true,
    sessionNumber: asNumber(item.sessionNumber),
    enrolledCount: asNumber(item.enrolledCount),
    maxCapacity: asNumber(item.maxCapacity),
    isPrivate: typeof item.isPrivate === "boolean" ? item.isPrivate : null,
    makeupForSessionId: asNumber(item.makeupForSessionId),
  }
}

export function mapPackage(item) {
  const durationDays = asNumber(item.durationDays)
  const benefits = parseBenefits(item.benefits)
  return {
    id: item.id,
    name: item.name,
    nameVi: item.name,
    price: asNumber(item.price),
    durationDays,
    durationMonths:
      durationDays === null ? null : Math.round(durationDays / 30),
    description: item.benefits ?? null,
    descriptionVi: item.benefits ?? null,
    benefits,
    benefitsVi: benefits,
    maxClassesPerMonth: null,
    tier: null,
    status: normalizeStatus(item.status, null),
    rawStatus: item.status ?? null,
    packageType: item.packageType ?? null,
    totalCredit: asNumber(item.totalCredit),
    subjectId: asNumber(item.subjectId),
  }
}

const classStatus = (status, fallback = "draft") => {
  const normalized = normalizeStatus(status, fallback)
  if (normalized === null) return null
  if (["open", "published"].includes(normalized)) return "open"
  if (["closed", "completed"].includes(normalized)) return "closed"
  if (["cancelled", "canceled"].includes(normalized)) return "cancelled"
  return normalized
}

export function mapClass(
  item,
  { subjects = [], coaches = [], fallback = {}, apiMode = false } = {},
) {
  if (apiMode) {
    const subject = subjects.find(
      (entry) => String(entry.id) === String(item.subjectId),
    )
    const coach = coaches.find(
      (entry) => idNumber(entry.id) === asNumber(item.coachId),
    )
    return {
      id: item.id ?? null,
      name: item.name ?? null,
      nameVi: item.name ?? null,
      subjectId: item.subjectId ?? null,
      subjectName: item.subjectName ?? subject?.name ?? null,
      coachId: item.coachId ?? null,
      coachName: item.coachName ?? coach?.name ?? null,
      coachSpecialty:
        coach?.specializationVi ?? coach?.specialization ?? coach?.specialtyVi ?? coach?.specialty ?? null,
      maxCapacity: asNumber(item.maxCapacity),
      capacity: asNumber(item.maxCapacity),
      tuitionFee: asNumber(item.tuitionFee),
      price: asNumber(item.tuitionFee),
      startDate: item.startDate ?? null,
      endDate: item.endDate ?? null,
      date: item.startDate ?? null,
      status: classStatus(item.status, null),
      apiStatus: item.status ?? null,
      enrolledCount: asNumber(item.enrolledCount),
      classType: item.classType ?? null,
      totalSessions: asNumber(item.totalSessions),
      sessionCount: asNumber(item.totalSessions),
      category: item.subjectName ?? subject?.name ?? null,
      room: null,
      roomVi: null,
      roomSpec: null,
      startTime: null,
      endTime: null,
      durationMinutes: null,
      code: null,
      minTierRequired: null,
      minCapacity: asNumber(item.minCapacity),
      openingConfirmedAt: item.openingConfirmedAt,
      openingConfirmedBy: asNumber(item.openingConfirmedBy),
      postponementCount: asNumber(item.postponementCount),
      lifecycleVersion: asNumber(item.lifecycleVersion),
      changePending: typeof item.changePending === "boolean" ? item.changePending : null,
      selectedDays: null,
    }
  }

  const subject = subjects.find(
    (entry) => String(entry.id) === String(item.subjectId),
  )
  const coach = coaches.find(
    (entry) => idNumber(entry.id) === asNumber(item.coachId),
  )
  const localMeta = {}
  const cleanFallback = Object.fromEntries(
    Object.entries(fallback || {}).filter(
      ([_, v]) => v !== undefined && v !== null,
    ),
  )
  const cleanLocal = Object.fromEntries(
    Object.entries(localMeta || {}).filter(
      ([_, v]) => v !== undefined && v !== null,
    ),
  )
  const merged = { ...cleanLocal, ...cleanFallback }

  // Infer day of week from startDate or sport name if selectedDays is not explicitly set
  let initialDays = merged.selectedDays
  if (!initialDays || !Array.isArray(initialDays) || initialDays.length === 0) {
    if (item.name && item.name.toLowerCase().includes("pickleball")) {
      initialDays = [6, 0]
    } else if (item.startDate) {
      const d = new Date(item.startDate)
      if (!isNaN(d.getTime())) {
        const dow = d.getDay()
        if (dow === 0 || dow === 6) {
          initialDays = [6, 0]
        } else {
          initialDays = [1, 3, 5]
        }
      }
    }
  }

  const itemNameLower = (item.name || "").toLowerCase()
  let detectedCategory = subject?.name ?? item.subjectName ?? merged.category ?? null
  if (!detectedCategory || detectedCategory === "Gym" || detectedCategory === "Yoga") {
    if (itemNameLower.includes("cầu lông") || itemNameLower.includes("badminton")) detectedCategory = "Cầu lông"
    else if (itemNameLower.includes("pickleball")) detectedCategory = "Pickleball"
    else if (itemNameLower.includes("bắn cung") || itemNameLower.includes("archery")) detectedCategory = "Bắn cung"
    else if (itemNameLower.includes("bắn súng") || itemNameLower.includes("shooting")) detectedCategory = "Bắn súng"
    else if (itemNameLower.includes("bóng bàn") || itemNameLower.includes("table tennis")) detectedCategory = "Bóng bàn"
    else if (itemNameLower.includes("bóng đá") || itemNameLower.includes("football") || itemNameLower.includes("soccer")) detectedCategory = "Bóng đá"
    else if (itemNameLower.includes("bóng rổ") || itemNameLower.includes("basketball")) detectedCategory = "Bóng rổ"
    else if (itemNameLower.includes("bóng chuyền") || itemNameLower.includes("volleyball")) detectedCategory = "Bóng chuyền"
    else if (itemNameLower.includes("quần vợt") || itemNameLower.includes("tennis")) detectedCategory = "Quần vợt"
    else if (itemNameLower.includes("bơi") || itemNameLower.includes("swimming")) detectedCategory = "Bơi lội"
    else detectedCategory = "Cầu lông"
  }
  const categoryName = detectedCategory
  const isPickleball = categoryName === "Pickleball"
  const catLower = categoryName.toLowerCase()

  let defaultRoom = "Sân Cầu Lông 1"
  let defaultRoomSpec = "Thảm PVC tiêu chuẩn"
  if (catLower.includes("pickleball")) {
    defaultRoom = "Sân Pickleball A1"
    defaultRoomSpec = "Mặt sân Pro Cushion tiêu chuẩn"
  } else if (catLower.includes("bắn súng")) {
    defaultRoom = "Phòng Bắn Súng Hơi 10m"
    defaultRoomSpec = "Bia điện tử SIUS chuẩn Olympic"
  } else if (catLower.includes("bắn cung")) {
    defaultRoom = "Trường Bắn Cung 15m"
    defaultRoomSpec = "Bia mục tiêu tiêu chuẩn"
  } else if (catLower.includes("bóng bàn")) {
    defaultRoom = "Phòng Bóng Bàn VIP 1"
    defaultRoomSpec = "Bàn thi đấu tiêu chuẩn ITTF"
  } else if (catLower.includes("bóng rổ")) {
    defaultRoom = "Sân Bóng Rổ Trong Nhà"
    defaultRoomSpec = "Sàn gỗ phong thi đấu FIBA"
  } else if (catLower.includes("bóng chuyền")) {
    defaultRoom = "Sân Bóng Chuyền Thi Đấu"
    defaultRoomSpec = "Mặt thảm Teraflex tiêu chuẩn"
  } else if (catLower.includes("bóng đá")) {
    defaultRoom = "Sân Cỏ Nhân Tạo 5 Người (Sân A)"
    defaultRoomSpec = "Cỏ sợi Monofilament tiêu chuẩn"
  } else if (catLower.includes("quần vợt") || catLower.includes("tennis")) {
    defaultRoom = "Sân Tennis Hardcourt 1"
    defaultRoomSpec = "Mặt sân DecoTurf chuẩn US Open"
  }

  const coachSpecialty =
    coach?.specializationVi ||
    coach?.specialization ||
    coach?.specialtyVi ||
    coach?.specialty ||
    (coach?.name?.toLowerCase().includes("hương")
      ? "Cầu lông"
      : coach?.name?.toLowerCase().includes("lan")
        ? "Pickleball"
        : categoryName)

  const defaultStartTime = isPickleball ? "18:15" : "06:00"
  const defaultEndTime = isPickleball ? "20:00" : "07:30"
  const rawStartTime = item.startTime ?? merged.startTime
  const startTime =
    rawStartTime && String(rawStartTime).trim()
      ? String(rawStartTime).trim()
      : defaultStartTime
  const rawEndTime = item.endTime ?? merged.endTime
  const endTime =
    rawEndTime && String(rawEndTime).trim()
      ? String(rawEndTime).trim()
      : defaultEndTime

  let defaultPrice = 650000
  if (catLower.includes("pickleball")) defaultPrice = 800000
  else if (catLower.includes("bắn súng")) defaultPrice = 1200000
  else if (catLower.includes("bắn cung")) defaultPrice = 900000
  else if (catLower.includes("cầu lông")) defaultPrice = 600000
  else if (catLower.includes("bóng bàn")) defaultPrice = 600000

  const price = asNumber(item.tuitionFee ?? item.price) ?? asNumber(merged.price) ?? defaultPrice

  return {
    id: item.id,
    name: item.name,
    nameVi: item.name,
    subjectId: item.subjectId ?? null,
    classType: item.classType ?? merged.classType ?? "Normal",
    totalSessions: asNumber(item.totalSessions) ?? asNumber(merged.totalSessions) ?? 12,
    coachId: item.coachId ?? null,
    coachName: coach?.name ?? merged.coachName ?? "Chưa phân công",
    coachSpecialty,
    capacity: asNumber(item.maxCapacity) ?? merged.capacity ?? 8,
    status: classStatus(item.status),
    apiStatus: item.status ?? null,
    startDate: item.startDate ?? null,
    endDate: item.endDate ?? null,
    date: merged.date ?? item.startDate ?? null,
    startTime,
    endTime,
    durationMinutes: merged.durationMinutes ?? (isPickleball ? 105 : 90),
    enrolledCount: asNumber(item.enrolledCount) ?? 0,
    code: merged.code ?? `CLS-${String(item.id).padStart(3, "0")}`,
    category: categoryName,
    room: merged.room ?? defaultRoom,
    roomVi: merged.roomVi ?? merged.room ?? defaultRoom,
    roomSpec: merged.roomSpec ?? defaultRoomSpec,
    price,
    minTierRequired: merged.minTierRequired ?? 1,
    sessionCount: asNumber(item.totalSessions) ?? merged.sessionCount ?? 12,
    minCapacity: merged.minCapacity ?? (isPickleball ? 2 : 4),
    selectedDays: initialDays ?? [1, 3, 5],
  }
}

export function mapAuditLog(item) {
  const target = [item.targetEntity, item.targetId]
    .filter((value) => value !== null && value !== undefined)
    .join(" #")
  return {
    id: item.id,
    timestamp: item.createdAt ?? null,
    actorId: item.userId ?? null,
    actorName: item.userId != null ? `User #${item.userId}` : null,
    actorRole: null,
    action: item.action ?? null,
    target: target || null,
    previousValue: null,
    newValue: null,
    reason: item.detail ?? null,
  }
}

export const mapDashboard = (item) => ({
  totalUsers: asNumber(item.totalUsers),
  totalMembers: asNumber(item.totalMembers),
  totalClasses: asNumber(item.totalClasses),
  totalPackages: asNumber(item.totalPackages),
  totalRevenue: asNumber(item.totalRevenue),
  totalInvoices: asNumber(item.totalInvoices),
  activeSubscriptions: asNumber(item.activeSubscriptions),
  todaySessions: asNumber(item.todaySessions),
})

export const mapRevenueReport = (item = {}) => ({
  totalRevenue: asNumber(item.totalRevenue),
  moneyReceived: asNumber(item.moneyReceived),
  moneyRefunded: asNumber(item.moneyRefunded),
  netReceived: asNumber(item.netReceived),
  cashCorrectionsRecorded: asNumber(item.cashCorrectionsRecorded),
  totalTransactions: asNumber(item.totalTransactions),
  averageTransactionValue: asNumber(item.averageTransactionValue),
  revenueByPackage: Array.isArray(item.revenueByPackage)
    ? item.revenueByPackage.map((entry) => ({
        packageId: asNumber(entry?.packageId),
        packageName: entry?.packageName ?? null,
        count: asNumber(entry?.count),
        totalRevenue: asNumber(entry?.totalRevenue),
      }))
    : [],
  revenueByMethod: Array.isArray(item.revenueByMethod)
    ? item.revenueByMethod.map((entry) => ({
        method: entry?.method ?? null,
        count: asNumber(entry?.count),
        totalRevenue: asNumber(entry?.totalRevenue),
      }))
    : [],
  timeline: Array.isArray(item.timeline)
    ? item.timeline.map((entry) => ({
        period: entry?.period ?? null,
        revenue: asNumber(entry?.revenue),
        count: asNumber(entry?.count),
      }))
    : [],
})

export const mapMemberReport = (item = {}) => ({
  totalMembers: asNumber(item.totalMembers),
  activeMembers: asNumber(item.activeMembers),
  expiredMembers: asNumber(item.expiredMembers),
  packageDistribution: Array.isArray(item.packageDistribution)
    ? item.packageDistribution.map((entry) => ({
        packageName: entry?.packageName ?? null,
        memberCount: asNumber(entry?.memberCount),
      }))
    : [],
  monthlyGrowth: Array.isArray(item.monthlyGrowth)
    ? item.monthlyGrowth.map((entry) => ({
        month: entry?.month ?? null,
        count: asNumber(entry?.count),
      }))
    : [],
})

const API_CLASS_STATUSES = {
  open: "Open",
  published: "Open",
  ongoing: "Ongoing",
  closed: "Closed",
  completed: "Closed",
  cancelled: "Cancelled",
  canceled: "Cancelled",
}

export const toClassRequest = (item) => {
  const statusValue = item.status ?? item.apiStatus
  const rawStatus = item.apiStatus ?? item.status
  const normalizedStatus = normalizeStatus(statusValue, null)
  const normalizedRawStatus = normalizeStatus(rawStatus, null)
  const mappedStatus = API_CLASS_STATUSES[normalizedStatus]
  const preservedUnknownStatus =
    item.status == null || item.apiStatus == null || normalizedStatus === normalizedRawStatus
      ? rawStatus == null ? undefined : String(rawStatus)
      : undefined

  return {
    name: item.name || item.nameVi,
    subjectId: idNumber(item.subjectId),
    coachId: idNumber(item.coachId),
    maxCapacity: asNumber(item.maxCapacity ?? item.capacity),
    startDate: item.startDate ?? item.date ?? null,
    endDate: item.endDate ?? null,
    tuitionFee: asNumber(item.tuitionFee ?? item.price),
    classType: item.classType ?? null,
    totalSessions: asNumber(item.totalSessions ?? item.sessionCount),
    // Keep unrecognized Backend values intact; never silently turn them into Open.
    status:
      normalizedStatus === "draft"
        ? undefined
        : mappedStatus ?? preservedUnknownStatus,
  }
}

export const toPackageRequest = (item) => {
  return {
    name: item.name,
    durationDays: asNumber(item.durationDays),
    price: asNumber(item.price),
    benefits: serializeBenefits(item.benefits),
    status: item.status,
    packageType: item.packageType ?? null,
    totalCredit: asNumber(item.totalCredit),
  }
}
