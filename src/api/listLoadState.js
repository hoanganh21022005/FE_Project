import { getErrorMessage } from './apiErrors.js'

export function isListAccessError(error) {
  return [401, 403].includes(Number(error?.status))
}

export function listLoadErrorMessage(error, language, resource) {
  const vi = language === 'vi'
  const status = Number(error?.status)
  if (status === 401) return vi ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' : 'Your session has expired. Please sign in again.'
  if (status === 403) return vi ? `Bạn không có quyền xem ${resource}.` : `You do not have permission to view ${resource}.`
  if (status === 0 || error instanceof TypeError) return vi ? 'Không thể kết nối đến máy chủ. Vui lòng thử lại.' : 'Could not connect to the server. Please retry.'
  return vi ? `Không tải được ${resource}: ${getErrorMessage(error)}` : `Could not load ${resource}: ${getErrorMessage(error)}`
}
