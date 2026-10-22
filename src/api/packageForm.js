const optionalNumber = (value) => {
  if (value === null || value === undefined || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function packageFormFromItem(item, { apiMode = false } = {}) {
  const benefits = item?.benefits
  const benefitsText = typeof benefits === "string"
    ? benefits.split(/\s*(?:;|\r?\n)\s*/).filter(Boolean).join("\n")
    : Array.isArray(benefits) ? benefits.join("\n") : ""

  return {
    name: item?.name ?? "",
    packageType: item?.packageType ?? "Normal",
    durationDays: item?.durationDays ?? (!apiMode && item?.durationMonths != null ? Number(item.durationMonths) * 30 : ""),
    price: item?.price ?? "",
    benefits: item?.benefits ?? [],
    status: String(item?.rawStatus ?? item?.status ?? "active").toLowerCase(),
    totalCredit: item?.totalCredit ?? "",
    benefitsText,
  }
}

export function buildPackageFormPayload(form, benefitsText) {
  return {
    name: String(form.name ?? "").trim(),
    packageType: form.packageType || "Normal",
    durationDays: optionalNumber(form.durationDays),
    price: optionalNumber(form.price),
    benefits: String(benefitsText ?? "")
      .split(/\r?\n|;/)
      .map((value) => value.trim())
      .filter(Boolean),
    status: form.status || "active",
    totalCredit: optionalNumber(form.totalCredit),
  }
}

export function validatePackageForm(payload, language = "en") {
  const vi = language === "vi"
  if (!payload.name) return vi ? "Vui lòng nhập tên gói." : "Package name is required."
  if (!Number.isInteger(payload.durationDays) || payload.durationDays <= 0) {
    return vi ? "Thời hạn phải là số ngày nguyên lớn hơn 0." : "Duration must be a positive whole number of days."
  }
  if (payload.price === null || payload.price < 0) {
    return vi ? "Giá phải là số lớn hơn hoặc bằng 0." : "Price must be zero or greater."
  }
  if (payload.packageType === "Advanced" &&
    (payload.totalCredit === null || !Number.isInteger(payload.totalCredit) || payload.totalCredit < 0)) {
    return vi ? "Gói Advanced cần số credit nguyên từ 0 trở lên." : "Advanced packages require a whole number of credits (0 or more)."
  }
  return ""
}

export function packageStatusForApi(status) {
  return String(status).toLowerCase() === "active" ? "INACTIVE" : "ACTIVE"
}
