// Public editorial roster supplied by VIBE Sport; independent of staff accounts.
export const publicSports = [
  { id: "badminton", title: "Cầu lông", titleEn: "Badminton" },
  { id: "table-tennis", title: "Bóng bàn", titleEn: "Table tennis" },
  { id: "pickleball", title: "Pickleball", titleEn: "Pickleball" },
  { id: "basketball", title: "Bóng rổ", titleEn: "Basketball" },
  { id: "volleyball", title: "Bóng chuyền", titleEn: "Volleyball" },
  { id: "archery", title: "Bắn cung", titleEn: "Archery" },
  { id: "swimming", title: "Bơi lội", titleEn: "Swimming" },
  { id: "football", title: "Bóng đá", titleEn: "Football" },
  { id: "tennis", title: "Quần vợt", titleEn: "Tennis" },
]

export const publicCoaches = [
  ["Trần Thị Hương", "badminton"],
  ["Lê Minh Khoa", "table-tennis"],
  ["Phạm Thị Lan", "pickleball"],
  ["Trần Anh Dũng", "basketball"],
  ["Nguyễn Văn Hoàng", "volleyball"],
  ["Lê Nguyễn Thiên Phúc", "archery"],
  ["Lê Phương Anh", "swimming"],
  ["Lê Trần Phi", "football"],
  ["Huỳnh Diễm My", "tennis"],
].map(([name, sportId]) => {
  const sport = publicSports.find((item) => item.id === sportId)
  return {
    id: `public-coach-${sportId}`,
    name,
    sportId,
    specialty: sport.titleEn,
    specialtyVi: sport.title,
    image: `/images/coaches/${sportId}.jpg`,
    role: "coach",
    status: "active",
  }
})

const stripAccents = (str = "") =>
  String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim()
    .toLowerCase()

const SPORT_KEYWORDS = [
  ["table-tennis", ["bong ban", "table tennis", "table-tennis"]],
  ["badminton", ["cau long", "badminton"]],
  ["pickleball", ["pickleball"]],
  ["basketball", ["bong ro", "basketball"]],
  ["volleyball", ["bong chuyen", "volleyball", "dem bong", "chan bong"]],
  ["archery", ["ban cung", "archery", "cung thu"]],
  ["swimming", ["boi loi", "boi", "swimming", "sai", "ech"]],
  ["football", ["bong da", "football", "soccer", "chien thuat"]],
  ["tennis", ["quan vot", "tennis", "giao bong", "forehand"]],
]

export function findPublicCoachMatch(coach = {}) {
  if (!coach || typeof coach !== "object") return null
  const normalizedName = stripAccents(coach.name || coach.fullName || "")
  if (normalizedName) {
    const byName = publicCoaches.find(
      (pc) => stripAccents(pc.name) === normalizedName,
    )
    if (byName) return byName
  }

  const combinedText = stripAccents(
    [
      coach.specialization,
      coach.specializationVi,
      coach.specialty,
      coach.specialtyVi,
      ...(Array.isArray(coach.specializations) ? coach.specializations : []),
      coach.bio,
    ]
      .filter(Boolean)
      .join(" "),
  )

  if (combinedText) {
    for (const [sportId, keywords] of SPORT_KEYWORDS) {
      if (keywords.some((kw) => combinedText.includes(kw))) {
        return publicCoaches.find((pc) => pc.sportId === sportId) || null
      }
    }
  }

  return null
}

export function resolveCoachAvatar(coach = {}) {
  if (
    coach?.avatarUrl &&
    typeof coach.avatarUrl === "string" &&
    !coach.avatarUrl.includes("images.unsplash.com")
  ) {
    return coach.avatarUrl
  }
  if (
    coach?.image &&
    typeof coach.image === "string" &&
    !coach.image.includes("images.unsplash.com")
  ) {
    return coach.image
  }
  const matched = findPublicCoachMatch(coach)
  if (matched?.image) return matched.image

  const fallbackIdx =
    Math.abs(Number(coach?.id) || 0) % Math.max(1, publicCoaches.length)
  return publicCoaches[fallbackIdx]?.image || "/images/coaches/badminton.jpg"
}

export function filterOfficialPublicCoaches(apiCoaches = []) {
  if (!Array.isArray(apiCoaches) || apiCoaches.length === 0) return []
  const matchedList = []
  for (const pc of publicCoaches) {
    const targetName = stripAccents(pc.name)
    const found = apiCoaches.find(
      (c) => stripAccents(c?.name || c?.fullName || "") === targetName,
    )
    if (found) {
      matchedList.push({
        ...found,
        name: pc.name,
        avatarUrl: pc.image,
        specializations:
          Array.isArray(found.specializations) &&
          found.specializations.length > 0
            ? found.specializations
            : [pc.specialtyVi],
      })
    }
  }
  return matchedList.length > 0 ? matchedList : apiCoaches
}
