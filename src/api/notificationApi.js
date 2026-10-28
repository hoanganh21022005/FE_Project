import { httpClient } from "./httpClient.js"
import { extractList } from "./schemaValidators.js"

export const mapNotification = (item = {}) => ({
  id: item.id ?? null,
  type: String(item.type || "SYSTEM"),
  title: item.title || "",
  message: item.message || "",
  relatedType: item.relatedType || null,
  relatedId: item.relatedId ?? null,
  isRead: Boolean(item.isRead),
  createdAt: item.createdAt || null,
})

export const getMyNotifications = async ({
  unreadOnly = false,
  type,
  page = 0,
  size = 50,
} = {}) => {
  const query = new URLSearchParams()
  if (unreadOnly) query.set("unreadOnly", "true")
  if (type) query.set("type", String(type))
  query.set("page", String(page))
  query.set("size", String(size))

  const data = await httpClient.get(`/api/notifications/me?${query.toString()}`)
  const list = Array.isArray(data?.content)
    ? data.content
    : extractList(data) || []
  return {
    items: Array.isArray(list) ? list.map(mapNotification) : [],
    totalElements: Number(data?.totalElements ?? list.length ?? 0),
    totalPages: Number(data?.totalPages ?? 1),
  }
}

export const getMyUnreadCount = async () => {
  const data = await httpClient.get("/api/notifications/me/unread-count")
  if (typeof data === "number") return data
  return Number(data?.unreadCount ?? data?.count ?? 0)
}

export const markNotificationRead = async (id) => {
  if (!id) return null
  return httpClient.patch(`/api/notifications/${encodeURIComponent(id)}/read`)
}

export const markAllNotificationsRead = async () => {
  return httpClient.patch("/api/notifications/me/read-all")
}

export const notificationApi = {
  getMyNotifications,
  getMyUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  mapNotification,
}

export default notificationApi
