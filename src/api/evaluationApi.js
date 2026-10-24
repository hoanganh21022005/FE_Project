import { httpClient } from "./httpClient.js"
import { extractList, isValidNumericId } from "./schemaValidators.js"

export const mapEvaluation = (item = {}) => ({
  id: item.evaluationId ?? item.id ?? null,
  evaluationId: item.evaluationId ?? item.id ?? null,
  memberId: item.memberId ?? null,
  memberName: item.memberName ?? "",
  memberCode: item.memberCode ?? "",
  coachId: item.coachId ?? null,
  coachName: item.coachName ?? "",
  evaluationDate: item.evaluationDate ?? null,
  comment: item.comment ?? "",
  progressScore:
    item.progressScore !== undefined && item.progressScore !== null
      ? Number(item.progressScore)
      : null,
})

export const getEvaluations = async (params = {}) => {
  const query = new URLSearchParams()
  if (params.memberId) query.set("memberId", params.memberId)
  if (params.coachId) query.set("coachId", params.coachId)
  const qStr = query.toString()
  const data = await httpClient.get(`/api/evaluations${qStr ? `?${qStr}` : ""}`)
  const list = extractList(data)
  return Array.isArray(list) ? list.map(mapEvaluation) : []
}

export const getEvaluationById = async (id) => {
  if (!isValidNumericId(id)) throw new Error("ID đánh giá không hợp lệ.")
  const data = await httpClient.get(`/api/evaluations/${id}`)
  return mapEvaluation(data)
}

export const createEvaluation = async (data) => {
  const payload = {
    memberId: Number(data.memberId),
    coachId: Number(data.coachId),
    evaluationDate:
      data.evaluationDate || new Date().toISOString().slice(0, 10),
    comment: String(data.comment || ""),
    progressScore:
      data.progressScore !== undefined && data.progressScore !== null
        ? Number(data.progressScore)
        : undefined,
  }
  const res = await httpClient.post("/api/evaluations", payload)
  return mapEvaluation(res)
}

export const updateEvaluation = async (id, data) => {
  if (!isValidNumericId(id)) throw new Error("ID đánh giá không hợp lệ.")
  const payload = {
    memberId: Number(data.memberId),
    coachId: Number(data.coachId),
    evaluationDate: data.evaluationDate,
    comment: String(data.comment || ""),
    progressScore:
      data.progressScore !== undefined && data.progressScore !== null
        ? Number(data.progressScore)
        : undefined,
  }
  const res = await httpClient.put(`/api/evaluations/${id}`, payload)
  return mapEvaluation(res)
}

export const deleteEvaluation = async (id) => {
  if (!isValidNumericId(id)) throw new Error("ID đánh giá không hợp lệ.")
  return httpClient.delete(`/api/evaluations/${id}`)
}

export const evaluationApi = {
  getEvaluations,
  getEvaluationById,
  createEvaluation,
  updateEvaluation,
  deleteEvaluation,
  mapEvaluation,
}

export default evaluationApi
