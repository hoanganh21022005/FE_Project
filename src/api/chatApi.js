import { httpClient } from "./httpClient.js"
import { extractList, isValidNumericId } from "./schemaValidators.js"

export const mapChatMessage = (msg = {}) => {
  if (!msg || typeof msg !== "object") return null
  return {
    id: msg.id ?? null,
    conversationId: msg.conversationId ?? null,
    senderType: msg.senderType || "MEMBER",
    senderName: msg.senderName || "",
    isMine: Boolean(msg.isMine),
    content: msg.content || "",
    contentType: msg.contentType || "TEXT",
    metadata: msg.metadata || null,
    clientMessageId: msg.clientMessageId || null,
    createdAt: msg.createdAt || null,
  }
}

export const mapChatConversation = (conv = {}) => {
  if (!conv || typeof conv !== "object") return null
  return {
    id: conv.id ?? null,
    memberUserId: conv.memberUserId ?? null,
    memberName: conv.memberName || "",
    status: conv.status || "OPEN",
    assignedStaffUserId: conv.assignedStaffUserId ?? null,
    assignedStaffName: conv.assignedStaffName || "",
    handlerType: conv.handlerType || "AI",
    subject: conv.subject || "",
    createdAt: conv.createdAt || null,
    updatedAt: conv.updatedAt || null,
    lastMessageAt: conv.lastMessageAt || null,
    closedAt: conv.closedAt || null,
    lastMessage: conv.lastMessage ? mapChatMessage(conv.lastMessage) : null,
    unreadCount: Number(conv.unreadCount ?? 0),
  }
}

export const getMyActiveConversation = async () => {
  try {
    const data = await httpClient.get("/api/chat/conversations/me/active")
    if (!data || typeof data !== "object" || !data.id) return null
    return mapChatConversation(data)
  } catch (error) {
    if (error?.status === 404 || error?.status === 204) return null
    throw error
  }
}

export const getMyChatUnreadCount = async () => {
  const data = await httpClient.get("/api/chat/me/unread-count")
  if (typeof data === "number") return data
  return Number(data?.unreadCount ?? data?.count ?? 0)
}

export const getOrCreateConversation = async ({ subject = "" } = {}) => {
  const payload = {
    subject: String(subject || "").trim().slice(0, 200),
  }
  const data = await httpClient.post("/api/chat/conversations", payload)
  return mapChatConversation(data)
}

export const getConversationMessages = async (
  conversationId,
  { afterId, limit = 50 } = {},
) => {
  if (!isValidNumericId(conversationId)) {
    throw new Error("ID cuộc trò chuyện không hợp lệ.")
  }
  const query = new URLSearchParams()
  if (afterId !== undefined && afterId !== null && afterId !== "") {
    query.set("afterId", String(afterId))
  }
  if (limit !== undefined && limit !== null) {
    query.set("limit", String(limit))
  }
  const qStr = query.toString() ? `?${query.toString()}` : ""
  const data = await httpClient.get(
    `/api/chat/conversations/${Number(conversationId)}/messages${qStr}`,
  )
  const list = extractList(data)
  return Array.isArray(list) ? list.map(mapChatMessage).filter(Boolean) : []
}

export const sendConversationMessage = async (
  conversationId,
  { content, clientMessageId } = {},
) => {
  if (!isValidNumericId(conversationId)) {
    throw new Error("ID cuộc trò chuyện không hợp lệ.")
  }
  const trimmed = String(content || "").trim()
  if (!trimmed) {
    throw new Error("Nội dung tin nhắn không được để trống.")
  }
  const payload = {
    content: trimmed,
    clientMessageId:
      clientMessageId ||
      `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  }
  const data = await httpClient.post(
    `/api/chat/conversations/${Number(conversationId)}/messages`,
    payload,
  )
  return mapChatMessage(data)
}

export const markConversationRead = async (conversationId) => {
  if (!isValidNumericId(conversationId)) return null
  return httpClient.post(
    `/api/chat/conversations/${Number(conversationId)}/read`,
  )
}

export const closeConversation = async (conversationId) => {
  if (!isValidNumericId(conversationId)) {
    throw new Error("ID cuộc trò chuyện không hợp lệ.")
  }
  const data = await httpClient.patch(
    `/api/chat/conversations/${Number(conversationId)}/close`,
  )
  return mapChatConversation(data)
}

export const reopenConversation = async (conversationId) => {
  if (!isValidNumericId(conversationId)) {
    throw new Error("ID cuộc trò chuyện không hợp lệ.")
  }
  const data = await httpClient.patch(
    `/api/chat/conversations/${Number(conversationId)}/reopen`,
  )
  return mapChatConversation(data)
}

export const getConversationsInbox = async ({
  status,
  assigned,
  unreadOnly,
  page = 0,
  size = 20,
} = {}) => {
  const query = new URLSearchParams()
  if (status) query.set("status", String(status))
  if (assigned !== undefined && assigned !== null) {
    query.set("assigned", String(Boolean(assigned)))
  }
  if (unreadOnly !== undefined && unreadOnly !== null) {
    query.set("unreadOnly", String(Boolean(unreadOnly)))
  }
  query.set("page", String(page))
  query.set("size", String(size))
  const data = await httpClient.get(
    `/api/chat/conversations?${query.toString()}`,
  )
  const content = Array.isArray(data?.content)
    ? data.content
    : extractList(data) || []
  return {
    items: content.map(mapChatConversation).filter(Boolean),
    totalElements: Number(data?.totalElements ?? content.length ?? 0),
    totalPages: Number(data?.totalPages ?? 1),
  }
}

export const claimConversation = async (conversationId) => {
  if (!isValidNumericId(conversationId)) {
    throw new Error("ID cuộc trò chuyện không hợp lệ.")
  }
  const data = await httpClient.post(
    `/api/chat/conversations/${Number(conversationId)}/claim`,
  )
  return mapChatConversation(data)
}

export const releaseConversation = async (conversationId) => {
  if (!isValidNumericId(conversationId)) {
    throw new Error("ID cuộc trò chuyện không hợp lệ.")
  }
  const data = await httpClient.post(
    `/api/chat/conversations/${Number(conversationId)}/release`,
  )
  return mapChatConversation(data)
}

export const chatApi = {
  getMyActiveConversation,
  getMyChatUnreadCount,
  getOrCreateConversation,
  getConversationMessages,
  sendConversationMessage,
  markConversationRead,
  closeConversation,
  reopenConversation,
  getConversationsInbox,
  claimConversation,
  releaseConversation,
  mapChatConversation,
  mapChatMessage,
}

export default chatApi
