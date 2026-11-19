import { getErrorMessage } from "../api/apiErrors.js"

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

export const getPrivateSessionProposalErrorMessage = (error, isVi = true) => {
  const details = proposalErrorText(error)
  if (details.includes("PROPOSAL_EXPIRED")) {
    return isVi
      ? "Đề xuất đã hết hạn phản hồi. Trạng thái đã được tải lại; hãy nhờ Coach gửi lịch khác."
      : "This proposal has expired. Its status was reloaded; ask your Coach to send another schedule."
  }
  if (details.includes("ROOM_CONFLICT")) {
    return isVi
      ? "Phòng đã có lịch khác. Trạng thái đã được tải lại; hai bên cần thống nhất phòng hoặc ca khác."
      : "The room is no longer available. State was reloaded; agree on another room or time."
  }
  if (details.includes("COACH_CONFLICT")) {
    return isVi
      ? "Coach đã bận vào ca này. Trạng thái đã được tải lại; hai bên cần thống nhất lịch khác."
      : "The Coach is unavailable at this time. State was reloaded; agree on another schedule."
  }
  if (details.includes("MEMBER_CONFLICT") || details.includes("MEMBER_SCHEDULE_CONFLICT") || details.includes("HỘI VIÊN ĐÃ CÓ LỊCH")) {
    return isVi
      ? "Bạn đã có lịch tập trùng giờ. Trạng thái đã được tải lại; hãy thống nhất một lịch khác với Coach."
      : "You already have a session at this time. State was reloaded; agree on another schedule with your Coach."
  }
  if (details.includes("OUT_OF_CREDIT") || details.includes("CREDIT_LOW")) {
    return isVi
      ? "Gói Advanced không còn đủ credit cho buổi tập. Credit mới nhất đã được tải lại."
      : "The Advanced package does not have enough credits. The latest credit balance was reloaded."
  }
  if (details.includes("ADVANCED_PACKAGE_EXPIRED") || details.includes("SUBSCRIPTION_EXPIRED") || details.includes("ENTITLEMENT_EXPIRED")) {
    return isVi
      ? "Gói Advanced đã hết hạn hoặc buổi tập vượt thời hạn sử dụng. Trạng thái gói đã được tải lại."
      : "The Advanced package has expired or the session is beyond its validity period. Subscription state was reloaded."
  }
  if (details.includes("PRIMARY_COACH_REQUIRED") || details.includes("COACH_SUBJECT_MISMATCH") || details.includes("COACH_INACTIVE") || details.includes("COACH_CENTER_MISMATCH")) {
    return isVi
      ? "Coach không phù hợp với gói hoặc bộ môn này. Trạng thái đã được tải lại; hãy liên hệ Coach để thống nhất lịch khác."
      : "This Coach is not eligible for the package or subject. State was reloaded; contact your Coach to agree on another schedule."
  }
  if (details.includes("PROPOSAL_STATE_CONFLICT")) {
    return isVi
      ? "Đề xuất đã được phản hồi trước đó. Trạng thái hiện tại đã được tải lại."
      : "This proposal was already processed. Its current state was reloaded."
  }
  return getErrorMessage(error, isVi ? "Không thể xác nhận đề xuất lịch. Trạng thái đã được tải lại; hãy trao đổi với Coach nếu cần lịch khác." : "Could not accept the proposal. State was reloaded; agree on another schedule with your Coach if needed.")
}
