export function validateHolidayForm(form, holidays = []) {
  const date = String(form?.holidayDate ?? '').trim()
  const name = String(form?.holidayName ?? '').trim()
  if (!isValidDate(date)) return 'Enter a valid holiday date.'
  if (!name) return 'Holiday name is required.'
  if (holidays.some((holiday) => holiday.holidayDate === date)) {
    return 'A holiday already exists for this date.'
  }
  return ''
}

export function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export function holidayRequestFromForm(form) {
  const payload = {
    holidayDate: String(form.holidayDate).trim(),
    holidayName: String(form.holidayName).trim(),
    active: form.active === true,
  }
  const tag = String(form.tag ?? '').trim()
  if (tag) payload.tag = tag
  return payload
}

export function canManageClasses(apiEnabled, authorities = []) {
  return !apiEnabled || (Array.isArray(authorities) && authorities.includes('MANAGE_CLASSES'))
}
