const ROOM_STATUSES = new Map([
  ['available', 'Available'],
  ['maintenance', 'Maintenance'],
  ['closed', 'Closed'],
])

const FACILITY_TYPES = new Map([
  ['indoor', 'Indoor'],
  ['outdoor', 'Outdoor'],
])

export function roomStatusForApi(value) {
  return ROOM_STATUSES.get(String(value ?? '').trim().toLowerCase()) ?? null
}

function nullablePrice(value, fieldName) {
  if (value === '' || value === null || value === undefined) return null
  const price = Number(value)
  if (!Number.isFinite(price) || price < 0) {
    throw new Error(`${fieldName} must be a valid non-negative number.`)
  }
  return price
}

export function buildSubjectRequest(form) {
  const name = String(form.name ?? '').trim()
  if (!name) throw new Error('Subject name is required.')

  const normalizedStatus = String(form.status ?? 'Active').trim().toLowerCase() || 'active'
  const status = normalizedStatus === 'active'
    ? 'Active'
    : normalizedStatus === 'inactive'
      ? 'Inactive'
      : String(form.status).trim()
  return {
    name,
    description: String(form.description ?? '').trim(),
    status,
    slug: String(form.slug ?? '').trim() || null,
    normalPrice: nullablePrice(form.normalPrice, 'Normal price'),
    advancedPrice: nullablePrice(form.advancedPrice, 'Advanced price'),
  }
}

export function buildRoomRequest(form) {
  const name = String(form.name ?? '').trim()
  if (!name) throw new Error('Room name is required.')

  const capacity = Number(form.capacity)
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new Error('Capacity must be a positive whole number.')
  }

  const statusKey = String(form.status ?? '').trim().toLowerCase()
  const facilityTypeKey = String(form.facilityType ?? '').trim().toLowerCase()
  const status = roomStatusForApi(statusKey)
  const facilityType = FACILITY_TYPES.get(facilityTypeKey)
  if (!status) throw new Error('Room status must be Available, Maintenance, or Closed.')
  if (!facilityType) throw new Error('Facility type must be Indoor or Outdoor.')

  return {
    name,
    location: String(form.location ?? '').trim(),
    capacity,
    status,
    facilityType,
  }
}

export function isZeroOrMissingSubjectPrice(form) {
  return [form.normalPrice, form.advancedPrice].some(
    (value) => value === '' || value === null || value === undefined || Number(value) === 0,
  )
}
