import { httpClient } from './httpClient.js'

const INT32_MAX = 2147483647
const positiveInt32 = (value) => Number.isInteger(value) && value > 0 && value <= INT32_MAX

export class TrainingResultValidationError extends Error {
  constructor(message, code = 'TRAINING_RESULT_VALIDATION') {
    super(message)
    this.name = 'TrainingResultValidationError'
    this.code = code
    this.status = 0
  }
}

const requireResultId = (value) => {
  const id = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  if (!positiveInt32(id)) {
    throw new TrainingResultValidationError(
      'resultId must be a positive int32.',
      'TRAINING_RESULT_ID_INVALID',
    )
  }
  return id
}

export const buildTrainingResultContentRequest = (content) => {
  if (typeof content !== 'string') {
    throw new TrainingResultValidationError(
      'content must be a string.',
      'RESULT_CONTENT_REQUIRED',
    )
  }
  return { content }
}

const inFlight = new Map()

export const updateTrainingResultContent = async (resultId, content, options) => {
  const id = requireResultId(resultId)
  const body = buildTrainingResultContentRequest(content)
  const path = `/api/training-results/${id}/content`
  const key = `${path}:${JSON.stringify(body)}`

  const existing = inFlight.get(key)
  if (existing) return existing

  const request = httpClient
    .patch(path, body, options)
    .then((response) => {
      if (!response || typeof response !== 'object' || Array.isArray(response)) {
        throw new TrainingResultValidationError(
          'Backend returned an invalid TrainingResultResponse.',
          'TRAINING_RESULT_RESPONSE_INVALID',
        )
      }
      return response
    })
    .finally(() => inFlight.delete(key))

  inFlight.set(key, request)
  return request
}
