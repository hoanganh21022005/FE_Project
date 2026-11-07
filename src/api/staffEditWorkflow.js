import { isValidNumericId } from './schemaValidators.js'

const text = (value) => String(value ?? '').trim()

// StaffResponse.id is User.id; public coach directory records must not be used here.
export async function saveStaffChanges({ staff, form, roles, currentUserId, canEditProfile, canChangeRole, updateProfile, updateRole, reloadStaff }) {
  const userId = staff?.userId
  if (!isValidNumericId(userId)) throw new Error('Không xác minh được mã người dùng của nhân viên. Vui lòng tải lại danh sách nhân viên.')
  const nameChanged = text(form.name) !== text(staff.name)
  const phoneChanged = text(form.phone) !== text(staff.phone)
  const specializationChanged = staff.role === 'coach' && form.role === 'coach' && text(form.specialization) !== text(staff.specialization)
  const profileChanged = nameChanged || phoneChanged || specializationChanged
  const roleChanged = form.role !== staff.role
  const target = roles.find((role) => role.role === form.role)
  if (profileChanged && !canEditProfile) throw new Error('Bạn không có quyền cập nhật hồ sơ nhân viên.')
  if (roleChanged && (!isValidNumericId(currentUserId) || !canChangeRole || String(userId) === String(currentUserId))) throw new Error('Bạn không có quyền đổi vai trò của tài khoản này.')
  if (roleChanged && (!['coach', 'receptionist', 'manager'].includes(form.role) || !target || !isValidNumericId(target.id))) throw new Error('Không xác minh được mã vai trò từ máy chủ.')

  const result = {
    profile: { state: profileChanged ? 'pending' : 'unchanged' },
    role: { state: roleChanged ? 'pending' : 'unchanged' },
    latest: null,
    reloadError: null,
  }
  if (!profileChanged && !roleChanged) return result
  if (profileChanged) {
    const payload = { name: nameChanged ? text(form.name) : text(staff.serverName ?? staff.name), email: text(staff.email), role: staff.beRole || staff.role }
    if (phoneChanged) payload.phone = text(form.phone)
    if (specializationChanged) payload.specialization = text(form.specialization)
    try {
      const updated = await updateProfile(userId, payload)
      if (Number(updated?.userId) !== Number(userId)) throw new Error('Máy chủ chưa xác nhận hồ sơ nhân viên; cần tải lại để đối soát.')
      result.profile.state = 'saved'
    } catch (error) {
      result.profile = { state: 'failed', error }
    }
  }
  if (roleChanged) {
    if (result.profile.error?.status === 401) {
      result.role = { state: 'skipped', error: result.profile.error }
    } else {
      try {
        const updated = await updateRole(userId, target.id)
        if (Number(updated?.id) !== Number(userId) || Number(updated?.roleId) !== Number(target.id)) {
          throw new Error('Máy chủ chưa xác nhận vai trò; cần tải lại để đối soát.')
        }
        result.role.state = 'saved'
      } catch (error) {
        result.role = { state: 'failed', error }
      }
    }
  }
  if (result.profile.error?.status === 401 || result.role.error?.status === 401) return result
  try {
    const staffList = await reloadStaff()
    result.latest = staffList.find((item) => Number(item.userId) === Number(userId)) || null
    if (!result.latest) throw new Error('Không tìm thấy nhân viên trong danh sách vừa tải.')
    if (result.role.state === 'saved' && result.latest.role !== form.role) {
      result.role = { state: 'unconfirmed', error: new Error('Vai trò trong danh sách vừa tải chưa khớp với yêu cầu.') }
    }
    if (result.profile.state === 'saved' && (
      (nameChanged && text(result.latest.serverName ?? result.latest.name) !== text(form.name)) ||
      (phoneChanged && text(result.latest.phone) !== text(form.phone)) ||
      (specializationChanged && text(result.latest.specialization) !== text(form.specialization))
    )) {
      result.profile = { state: 'unconfirmed', error: new Error('Hồ sơ trong danh sách vừa tải chưa khớp với yêu cầu.') }
    }
  } catch (error) {
    result.reloadError = error
  }
  return result
}
