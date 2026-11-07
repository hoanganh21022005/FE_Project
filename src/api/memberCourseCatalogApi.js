import { httpClient } from './httpClient.js'
import { asNumber } from './mappers.js'
import { extractList, isValidNumericId } from './schemaValidators.js'

const readArray = (response, resourceName) => {
  const rows = extractList(response)
  if (!Array.isArray(rows)) throw new Error(`Danh sách ${resourceName} trả về không đúng định dạng.`)
  if (rows.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
    throw new Error(`Bản ghi ${resourceName} trả về không hợp lệ.`)
  }
  return rows
}

export async function getMemberCourseClasses() {
  const response = await httpClient.get('/api/classes')
  return readArray(response, 'lớp học').map((item) => ({
    id: asNumber(item.id),
    name: item.name ?? null,
    subjectId: asNumber(item.subjectId),
    subjectName: item.subjectName ?? null,
    coachId: asNumber(item.coachId),
    coachName: item.coachName ?? null,
    classType: item.classType ?? null,
    status: item.status ?? null,
    startDate: item.startDate ?? null,
    endDate: item.endDate ?? null,
    startTime: item.startTime ?? null,
    endTime: item.endTime ?? null,
    totalSessions: asNumber(item.totalSessions),
    maxCapacity: asNumber(item.maxCapacity),
    enrolledCount: asNumber(item.enrolledCount),
    tuitionFee: asNumber(item.tuitionFee),
    scheduleText: item.scheduleText ?? item.schedule ?? null,
  }))
}

export const memberCourseCatalogApi = { getMemberCourseClasses }
