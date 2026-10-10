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
