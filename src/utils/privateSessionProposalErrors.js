import { getErrorMessage, translateErrorCode } from "../api/apiErrors.js"

const proposalErrorText = (error) => {
  const details = error?.details ?? error?.response?.data
  return [
    error?.code,
    error?.message,
    details?.code,
    details?.message,
    details?.error,
    details?.detail,
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toUpperCase()
}

// Thứ tự kiểm giữ nguyên: mã đầu tiên có dấu hiệu trong lỗi thì dùng chữ của mã đó (bảng chung, ngữ cảnh "proposal").
const PROPOSAL_ERROR_MATCHERS = [
  ["PROPOSAL_EXPIRED", ["PROPOSAL_EXPIRED"]],
  ["ROOM_CONFLICT", ["ROOM_CONFLICT"]],
  ["COACH_CONFLICT", ["COACH_CONFLICT"]],
  ["MEMBER_CONFLICT", ["MEMBER_CONFLICT", "MEMBER_SCHEDULE_CONFLICT", "HỘI VIÊN ĐÃ CÓ LỊCH"]],
  ["OUT_OF_CREDIT", ["OUT_OF_CREDIT", "CREDIT_LOW"]],
  ["ADVANCED_PACKAGE_EXPIRED", ["ADVANCED_PACKAGE_EXPIRED", "SUBSCRIPTION_EXPIRED", "ENTITLEMENT_EXPIRED"]],
  ["PRIMARY_COACH_REQUIRED", ["PRIMARY_COACH_REQUIRED", "COACH_SUBJECT_MISMATCH", "COACH_INACTIVE", "COACH_CENTER_MISMATCH"]],
  ["PROPOSAL_STATE_CONFLICT", ["PROPOSAL_STATE_CONFLICT"]],
]

export const getPrivateSessionProposalErrorMessage = (error, isVi = true) => {
  const details = proposalErrorText(error)
  const language = isVi ? "vi" : "en"
  for (const [code, signals] of PROPOSAL_ERROR_MATCHERS) {
    if (signals.some((signal) => details.includes(signal))) {
      return translateErrorCode(code, language, "proposal")
    }
  }
  return getErrorMessage(error, isVi ? "Không thể xác nhận đề xuất lịch. Trạng thái đã được tải lại; hãy trao đổi với Coach nếu cần lịch khác." : "Could not accept the proposal. State was reloaded; agree on another schedule with your Coach if needed.")
}
