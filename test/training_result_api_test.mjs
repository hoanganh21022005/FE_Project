import assert from 'node:assert/strict'
import { httpClient } from '../src/api/httpClient.js'
import {
  buildTrainingResultContentRequest,
  updateTrainingResultContent,
} from '../src/api/trainingResultApi.js'

const originalPatch = httpClient.patch
const requests = []

try {
  // buildTrainingResultContentRequest: hợp lệ với chuỗi thường và chuỗi rỗng
  assert.deepEqual(buildTrainingResultContentRequest('Tiến bộ tốt'), {
    content: 'Tiến bộ tốt',
  })
  assert.deepEqual(buildTrainingResultContentRequest(''), { content: '' })

  for (const invalid of [null, undefined, 123, {}, []]) {
    assert.throws(
      () => buildTrainingResultContentRequest(invalid),
      (err) => err.code === 'RESULT_CONTENT_REQUIRED',
    )
  }

  // Từ chối resultId không hợp lệ
  for (const badId of [0, -1, 1.5, 'abc', null, undefined, 2147483648]) {
    await assert.rejects(
      () => updateTrainingResultContent(badId, 'Nội dung'),
      (err) => err.code === 'TRAINING_RESULT_ID_INVALID',
    )
  }

  // Gửi PATCH đúng đường dẫn, phương thức và body
  httpClient.patch = async (path, body, options) => {
    requests.push({ path, body, options })
    return { resultId: 15, content: body.content }
  }

  const res = await updateTrainingResultContent(15, 'Cần tập thêm kỹ thuật di chuyển', {
    notifyForbidden: false,
  })
  assert.deepEqual(res, { resultId: 15, content: 'Cần tập thêm kỹ thuật di chuyển' })
  assert.deepEqual(requests.at(-1), {
    path: '/api/training-results/15/content',
    body: { content: 'Cần tập thêm kỹ thuật di chuyển' },
    options: { notifyForbidden: false },
  })

  // Chống gửi trùng khi cùng yêu cầu đang bay
  let resolveSlow
  let slowCount = 0
  httpClient.patch = () => {
    slowCount += 1
    return new Promise((resolve) => {
      resolveSlow = resolve
    })
  }
  const p1 = updateTrainingResultContent(20, 'Cùng nội dung')
  const p2 = updateTrainingResultContent(20, 'Cùng nội dung')
  assert.equal(slowCount, 1)
  resolveSlow({ resultId: 20, content: 'Cùng nội dung' })
  const [r1, r2] = await Promise.all([p1, p2])
  assert.deepEqual(r1, { resultId: 20, content: 'Cùng nội dung' })
  assert.deepEqual(r2, { resultId: 20, content: 'Cùng nội dung' })

  // Từ chối phản hồi không phải object
  httpClient.patch = async () => null
  await assert.rejects(
    () => updateTrainingResultContent(21, 'Test'),
    (err) => err.code === 'TRAINING_RESULT_RESPONSE_INVALID',
  )

  console.log('training_result_api_test.mjs: ALL PASSED')
} finally {
  httpClient.patch = originalPatch
}
