export const NORMAL_CLASS_API_BLOCKED_MESSAGE =
  'Không thể tạo lớp Normal ở API mode: Backend hiện chưa hỗ trợ lưu Draft hoặc tạo lớp cùng 12 session an toàn trong một transaction. Cần hoàn tất contract BE-01 trước khi mở chức năng này.'

export const isNormalClassApiCreationBlocked = (apiEnabled) => Boolean(apiEnabled)

export const toBackendDaysOfWeek = (daysOfWeek) => {
  if (!Array.isArray(daysOfWeek)) return daysOfWeek
  return daysOfWeek.map((day) => day === 0 ? 7 : day === '0' ? '7' : day)
}
