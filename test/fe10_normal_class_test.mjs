import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { generateRecurringSessions, previewRecurringSessions } from '../src/api/managerApi.js'
import {
  isNormalClassApiCreationBlocked,
  NORMAL_CLASS_API_BLOCKED_MESSAGE,
  toBackendDaysOfWeek,
} from '../src/api/normalClassCreation.js'

const originalFetch = globalThis.fetch
const requests = []
globalThis.fetch = async (url, options) => {
  const requestUrl = String(url)
  requests.push({ url: requestUrl, options, body: JSON.parse(options.body) })
  const body = requestUrl.includes('preview-recurring')
    ? { totalSessions: 12, sessions: [], skippedHolidays: [] }
    : Array.from({ length: 12 }, (_, index) => ({ id: index + 1, status: 'Scheduled' }))
  return new Response(JSON.stringify(body), {
    status: 201,
    headers: { 'content-type': 'application/json' },
  })
}

try {
  assert.equal(isNormalClassApiCreationBlocked(true), true)
  assert.equal(isNormalClassApiCreationBlocked(false), false)
  assert.match(NORMAL_CLASS_API_BLOCKED_MESSAGE, /Backend.*Draft.*12 session/i)

  assert.deepEqual(toBackendDaysOfWeek([1]), [1], 'Monday stays 1')
  assert.deepEqual(toBackendDaysOfWeek([6]), [6], 'Saturday stays 6')
  assert.deepEqual(toBackendDaysOfWeek([0]), [7], 'Java Sunday is 7')
  assert.deepEqual(toBackendDaysOfWeek([null, '1']), [null, '1'], 'Other values remain unchanged')
  assert.deepEqual(toBackendDaysOfWeek([1, 6, 0]), [1, 6, 7])

  const schedule = {
    classId: 17,
    roomId: 8,
    startDate: '2026-11-02',
    daysOfWeek: [1, 6, 0],
    startTime: '06:00',
    endTime: '07:30',
  }
  await previewRecurringSessions(schedule)
  assert.deepEqual(requests.at(-1).body.daysOfWeek, [1, 6, 7])
  assert.equal(requests.at(-1).options.method, 'POST')
  assert.match(requests.at(-1).url, /preview-recurring$/)

  await generateRecurringSessions(schedule)
  assert.deepEqual(requests.at(-1).body.daysOfWeek, [1, 6, 7])
  assert.equal(requests.at(-1).options.method, 'POST')
  assert.match(requests.at(-1).url, /\/api\/sessions\/generate$/)

  const modalSource = await readFile(new URL('../src/components/modals/NewClassModal.jsx', import.meta.url), 'utf8')
  assert.match(modalSource, /isNormalClassApiCreationBlocked\(apiEnabled\)/)
  assert.match(modalSource, /disabled=\{isSubmitting \|\| conflict\?\.hasConflict \|\| isNormalClassApiCreationBlocked\(apiEnabled\)\}/)
  console.log('PASS: FE-10 API creation is blocked pending safe BE contract; weekdays map to Java numbering in mocked preview/generate requests.')
} finally {
  globalThis.fetch = originalFetch
}
