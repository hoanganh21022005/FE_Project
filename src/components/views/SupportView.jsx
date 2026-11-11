import React, { useCallback, useEffect, useRef, useState } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { chatApi } from "../../api/chatApi"
import { getErrorMessage } from "../../api/apiErrors"
import {
  HelpCircle,
  Phone,
  BookOpen,
  MessageSquare,
  Send,
  RefreshCw,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Bot,
  UserRound,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react"

const QUICK_TOPICS_VI = [
  "Hướng dẫn ngắn gọn cách thanh toán và đối soát hóa đơn VNPay",
  "So sánh ngắn gọn khóa Normal và HLV 1:1 Advanced, gồm giá và khác biệt chính",
  "Hướng dẫn ngắn gọn điểm danh QR và xem lịch học",
  "Cho biết ngắn gọn điều kiện bảo lưu hoặc gia hạn gói tập",
]

const QUICK_TOPICS_EN = [
  "Briefly explain payment and VNPay invoice reconciliation",
  "Briefly compare Normal and 1-on-1 Advanced, including price and key differences",
  "Briefly explain QR check-in and how to view my schedule",
  "Briefly explain membership freeze or extension eligibility",
]

const renderFormattedMessage = (text) => {
  const renderInline = (value, keyPrefix) =>
    value.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong className="font-bold" key={`${keyPrefix}-${index}`}>{part.slice(2, -2)}</strong>
        : part,
    )

  const lines = String(text ?? "").split(/\r?\n/)
  const output = []
  let bullets = []
  const flushBullets = () => {
    if (bullets.length) {
      output.push(
        <ul className="my-1 list-disc space-y-1 pl-5" key={`list-${output.length}`}>
          {bullets.map((item, index) => <li key={`item-${index}`}>{renderInline(item, `bullet-${output.length}-${index}`)}</li>)}
        </ul>,
      )
      bullets = []
    }
  }

  lines.forEach((line, index) => {
    const bullet = line.match(/^\s*-\s+(.+)$/)
    if (bullet) {
      bullets.push(bullet[1])
      return
    }
    flushBullets()
    output.push(<React.Fragment key={`line-${index}`}>{renderInline(line, `line-${index}`)}{index < lines.length - 1 ? <br /> : null}</React.Fragment>)
  })
  flushBullets()
  return output
}

const formatChatTime = (value, isVi) => {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString(isVi ? "vi-VN" : "en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  })
}

export function SupportView() {
  const { t, language, apiEnabled, currentUser, role, showToast } = useSCMS()
  const isVi = language === "vi"
  const isMember = role === "member" || currentUser?.role === "member"

  const [conversation, setConversation] = useState(null)
  const [inboxList, setInboxList] = useState([])
  const [messages, setMessages] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [subjectInput, setSubjectInput] = useState("")
  const [messageInput, setMessageInput] = useState("")
  const [loading, setLoading] = useState(Boolean(apiEnabled))
  const [sending, setSending] = useState(false)
  const [waitingAI, setWaitingAI] = useState(false)
  const [actionBusy, setActionBusy] = useState(false)
  const [error, setError] = useState("")
  const messagesEndRef = useRef(null)
  const pendingReplyIdsRef = useRef(new Set())
  const isClosed = String(conversation?.status || "").toUpperCase() === "CLOSED"

  const loadMessages = useCallback(async (convId) => {
    if (!convId) {
      setMessages([])
      return
    }
    try {
      const list = await chatApi.getConversationMessages(convId, { limit: 100 })
      setMessages(Array.isArray(list) ? list : [])
      await chatApi.markConversationRead(convId).catch(() => {})
      setUnreadCount(0)
    } catch (err) {
      console.warn("Could not load chat messages:", err)
    }
  }, [])

  const refreshSupportChat = useCallback(async () => {
    if (!apiEnabled) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError("")
    try {
      const unread = await chatApi.getMyChatUnreadCount().catch(() => 0)
      setUnreadCount(Number(unread || 0))

      if (isMember) {
        const activeConv = await chatApi.getMyActiveConversation()
        setConversation(activeConv)
        if (activeConv?.id) {
          await loadMessages(activeConv.id)
        } else {
          setMessages([])
        }
      } else {
        const inbox = await chatApi.getConversationsInbox({ page: 0, size: 30 })
        const items = Array.isArray(inbox?.items) ? inbox.items : []
        setInboxList(items)
        const target =
          (conversation?.id &&
            items.find((c) => String(c.id) === String(conversation.id))) ||
          items[0] ||
          null
        setConversation(target)
        if (target?.id) {
          await loadMessages(target.id)
        } else {
          setMessages([])
        }
      }
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          isVi
            ? "Không thể kết nối kênh Chat hỗ trợ trực tuyến."
            : "Could not load online support chat.",
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [apiEnabled, conversation?.id, isMember, isVi, loadMessages])

  useEffect(() => {
    refreshSupportChat()
  }, [refreshSupportChat])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  const handleStartConversation = async (customSubject) => {
    const chosenSubject = String(
      customSubject !== undefined ? customSubject : subjectInput,
    ).trim()
    setActionBusy(true)
    setError("")
    try {
      if (!apiEnabled) {
        const demoConv = {
          id: 1,
          subject:
            chosenSubject ||
            (isVi ? "Hỗ trợ hội viên VIBE Sport" : "Member Support"),
          status: "OPEN",
          handlerType: "AI",
          createdAt: new Date().toISOString(),
        }
        setConversation(demoConv)
        setMessages([
          {
            id: 101,
            senderType: "AI",
            senderName: "VIBE AI Assistant",
            isMine: false,
            content: isVi
              ? "Xin chào! Tôi là trợ lý hỗ trợ trực tuyến của VIBE Sport. Bạn cần hỗ trợ về gói hội viên, lịch tập hay hóa đơn thanh toán ạ?"
              : "Hello! I am the VIBE Sport support assistant. How can I help you today?",
            createdAt: new Date().toISOString(),
          },
        ])
        return
      }
      const created = await chatApi.getOrCreateConversation({
        subject:
          chosenSubject ||
          (isVi ? "Hỗ trợ hội viên VIBE Sport" : "Member Support"),
      })
      setConversation(created)
      setSubjectInput("")
      if (created?.id) {
        await loadMessages(created.id)
      }
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          isVi
            ? "Không thể khởi tạo cuộc trò chuyện hỗ trợ."
            : "Could not start support conversation.",
        ),
      )
    } finally {
      setActionBusy(false)
    }
  }

  const handleSendMessage = async (e, quickContent) => {
    e?.preventDefault?.()
    const content = String(quickContent ?? messageInput).trim()
    if (!content || sending) return

    setSending(true)
    setError("")
    try {
      let targetConv = conversation
      if (!targetConv?.id || String(targetConv.status).toUpperCase() === "CLOSED") {
        if (apiEnabled) {
          targetConv = await chatApi.getOrCreateConversation({
            subject:
              subjectInput.trim() || content.slice(0, 80) || "Hỗ trợ hội viên",
          })
          setConversation(targetConv)
        } else {
          targetConv = {
            id: 1,
            subject: content.slice(0, 60),
            status: "OPEN",
            handlerType: "AI",
          }
          setConversation(targetConv)
        }
      }

      if (!apiEnabled) {
        const myMsg = {
          id: Date.now(),
          senderType: isMember ? "MEMBER" : "STAFF",
          senderName: currentUser?.name || "Hội viên",
          isMine: true,
          content,
          createdAt: new Date().toISOString(),
        }
        const botReply = {
          id: Date.now() + 1,
          senderType: "AI",
          senderName: "VIBE Support",
          isMine: false,
          content: isVi
            ? "Cảm ơn bạn đã gửi tin nhắn! Yêu cầu của bạn đã được ghi nhận, bộ phận Chăm sóc Hội viên sẽ phản hồi ngay."
            : "Thank you for your message! Our member support team has received your inquiry.",
          createdAt: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, myMsg, botReply])
        setMessageInput("")
        return
      }

      const knownMessageIds = new Set(messages.map((message) => String(message.id)))
      pendingReplyIdsRef.current = knownMessageIds
      const clientMessageId = globalThis.crypto?.randomUUID?.() || `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`
      await chatApi.sendConversationMessage(targetConv.id, { content, clientMessageId })
      setMessageInput("")
      if (targetConv.status === "CLOSED") targetConv = { ...targetConv, status: "OPEN" }
      const refreshedMessages = await chatApi.getConversationMessages(targetConv.id, { limit: 100 }).catch(() => null)
      if (refreshedMessages) setMessages(refreshedMessages)
      if (isMember) {
        const refreshedConv = await chatApi
          .getMyActiveConversation()
          .catch(() => targetConv)
        if (refreshedConv) setConversation(refreshedConv)

        setWaitingAI(String(refreshedConv?.handlerType || targetConv.handlerType).toUpperCase() === "AI")
        const latestMessages = await chatApi.getConversationMessages(targetConv.id, { limit: 100 }).catch(() => null)
        if (latestMessages) setMessages(latestMessages)
        const hasReply = latestMessages?.some((message) => !knownMessageIds.has(String(message.id)) && ["AI", "STAFF", "SYSTEM"].includes(String(message.senderType).toUpperCase()))
        if (hasReply) setWaitingAI(false)
      }
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          isVi ? "Không thể gửi tin nhắn." : "Could not send message.",
        ),
      )
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    if (!conversation?.id || isClosed || !apiEnabled) return undefined
    let active = true
    const poll = async () => {
      const [list, activeConv] = await Promise.all([
        chatApi.getConversationMessages(conversation.id, { limit: 100 }).catch(() => null),
        isMember ? chatApi.getMyActiveConversation().catch(() => null) : Promise.resolve(null),
      ])
      if (!active) return
      if (list) {
        setMessages(list)
        if (list.some((m) => !pendingReplyIdsRef.current.has(String(m.id)) && ["AI", "STAFF", "SYSTEM"].includes(String(m.senderType).toUpperCase()))) setWaitingAI(false)
      }
      if (activeConv) setConversation(activeConv)
    }
    const timer = window.setInterval(poll, waitingAI ? 1800 : 5000)
    const timeout = waitingAI ? window.setTimeout(() => { if (active) setWaitingAI(false) }, 15000) : null
    return () => { active = false; window.clearInterval(timer); if (timeout) window.clearTimeout(timeout) }
  }, [apiEnabled, conversation?.id, isClosed, isMember, waitingAI])

  const handleCloseConversation = async () => {
    if (!conversation?.id || actionBusy) return
    setActionBusy(true)
    setError("")
    try {
      if (apiEnabled) {
        const updated = await chatApi.closeConversation(conversation.id)
        setConversation(updated)
      } else {
        setConversation((prev) =>
          prev ? { ...prev, status: "CLOSED" } : prev,
        )
      }
      showToast?.(
        isVi
          ? "Đã đóng phiên hỗ trợ trực tuyến."
          : "Support conversation closed.",
        "info",
      )
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          isVi
            ? "Không thể đóng cuộc trò chuyện."
            : "Could not close conversation.",
        ),
      )
    } finally {
      setActionBusy(false)
    }
  }

  const handleReopenConversation = async () => {
    if (!conversation?.id || actionBusy) return
    setActionBusy(true)
    setError("")
    try {
      if (apiEnabled) {
        const updated = await chatApi.reopenConversation(conversation.id)
        setConversation(updated)
      } else {
        setConversation((prev) => (prev ? { ...prev, status: "OPEN" } : prev))
      }
      showToast?.(
        isVi
          ? "Đã mở lại cuộc trò chuyện hỗ trợ."
          : "Support conversation reopened.",
        "success",
      )
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          isVi
            ? "Không thể mở lại cuộc trò chuyện."
            : "Could not reopen conversation.",
        ),
      )
    } finally {
      setActionBusy(false)
    }
  }

  const handleStartNewConversation = () => {
    setConversation(null)
    setMessages([])
    setSubjectInput("")
    setError("")
  }

  const handleClaimOrRelease = async (mode) => {
    if (!conversation?.id || actionBusy || !apiEnabled) return
    setActionBusy(true)
    setError("")
    try {
      const updated =
        mode === "claim"
          ? await chatApi.claimConversation(conversation.id)
          : await chatApi.releaseConversation(conversation.id)
      setConversation(updated)
      await loadMessages(conversation.id)
      showToast?.(
        mode === "claim"
          ? isVi
            ? "Đã tiếp nhận xử lý cuộc trò chuyện."
            : "Claimed conversation."
          : isVi
            ? "Đã chuyển lại cuộc trò chuyện cho hệ thống."
            : "Released conversation.",
        "success",
      )
    } catch (err) {
      setError(getErrorMessage(err, "Không thể cập nhật phân công hội thoại."))
    } finally {
      setActionBusy(false)
    }
  }

  const quickTopics = isVi ? QUICK_TOPICS_VI : QUICK_TOPICS_EN
  const handleEscalate = async () => {
    if (!conversation?.id || actionBusy) return
    setActionBusy(true)
    setError("")
    try {
      const updated = await chatApi.escalateConversation(conversation.id)
      setConversation(updated)
      await loadMessages(conversation.id)
    } catch (err) {
      setError(getErrorMessage(err, isVi ? "Không thể kết nối lễ tân." : "Could not contact reception."))
    } finally { setActionBusy(false) }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-7 sm:py-8">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-brand-accent-soft text-brand-accent-dark rounded-xl border border-brand-accent/30">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900">
                {isVi
                  ? "Trung tâm Hỗ trợ & Chat Trực tuyến"
                  : "Support Center & Live Chat"}
              </h1>
              {unreadCount > 0 && (
                <span className="rounded-full bg-brand-primary px-2.5 py-0.5 text-xs font-bold text-white">
                  {unreadCount} {isVi ? "tin mới" : "unread"}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isVi
                ? "Trò chuyện trực tiếp với Trợ lý AI hoặc Chuyên viên lễ tân VIBE Sport về gói tập, lịch học và thanh toán."
                : "Chat directly with our AI Assistant or VIBE Sport Reception Staff regarding memberships, schedules, and billing."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={refreshSupportChat}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
          />
          <span>{isVi ? "Làm mới" : "Refresh"}</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Live Chat Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Quick Topics or Staff Inbox + Info Cards */}
        <div className="space-y-4">
          {!isMember && inboxList.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                {isVi
                  ? `Hộp thư hỗ trợ (${inboxList.length})`
                  : `Support Inbox (${inboxList.length})`}
              </h2>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {inboxList.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setConversation(item)
                      loadMessages(item.id)
                    }}
                    className={`w-full text-left rounded-xl border p-3 transition-all cursor-pointer ${
                      conversation?.id === item.id
                        ? "border-brand-primary bg-rose-50/40"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {item.memberName || `Hội viên #${item.memberUserId}`}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {item.handlerType || "AI"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 truncate mt-1">
                      {item.subject || item.lastMessage?.content || "—"}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick start topics for Member */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Sparkles className="w-4 h-4 text-brand-accent-dark" />
              <span>
                {isVi
                  ? "Chủ đề hỗ trợ nhanh"
                  : "Quick Support Topics"}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {isVi
                ? "Chọn một chủ đề bên dưới để bắt đầu hoặc gửi câu hỏi ngay:"
                : "Select a topic below to start a conversation immediately:"}
            </p>
            <div className="space-y-2">
              {quickTopics.map((topic, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={actionBusy}
                  onClick={() => handleSendMessage(null, topic)}
                  className="w-full text-left rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-100 hover:border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-800 transition-colors cursor-pointer"
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          {/* Info Cards */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>
                {isVi
                  ? "Quy trình Hỗ trợ VIBE Sport"
                  : "VIBE Sport Support Workflow"}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isVi
                ? "Hệ thống hỗ trợ tự động 24/7 kết hợp chuyên viên Quầy lễ tân. Khi bạn cần đối soát giao dịch tiền mặt/VNPay hoặc hỗ trợ lịch tập, nhân viên trực ca sẽ tiếp nhận (Claim) hội thoại để xử lý trực tiếp."
                : "24/7 automated AI support combined with live Reception specialists. Staff can claim your conversation at any time to resolve billing or scheduling requests."}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Phone className="w-4 h-4 text-emerald-600" />
              <span>
                {isVi
                  ? "Hotline Trực Trung Tâm"
                  : "Center Hotline Support"}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isVi
                ? "Hotline hỗ trợ khẩn cấp 24/7:"
                : "24/7 Emergency Support Hotline:"}{" "}
              <strong className="font-mono text-slate-900">1900 888 999</strong>
            </p>
          </div>
        </div>

        {/* Right 2 columns: Active Chat Window */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col min-h-[540px] max-h-[680px] overflow-hidden">
          {/* Conversation Top Bar */}
          <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  conversation?.handlerType === "STAFF"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {conversation?.handlerType === "STAFF" ? (
                  <ShieldCheck className="w-5 h-5" />
                ) : (
                  <Bot className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-extrabold text-slate-900 truncate">
                    {conversation?.subject ||
                      (isVi
                        ? "Kênh hỗ trợ trực tuyến VIBE Sport"
                        : "VIBE Sport Live Support")}
                  </h2>
                  {conversation && (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        isClosed
                          ? "bg-slate-200 text-slate-700"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      }`}
                    >
                      {isClosed
                        ? isVi
                          ? "Đã đóng"
                          : "Closed"
                        : isVi
                          ? "Đang mở"
                          : "Open"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {conversation
                    ? conversation.handlerType === "STAFF"
                      ? isVi
                        ? `Phụ trách: ${conversation.assignedStaffName || "Chuyên viên Hỗ trợ"}`
                        : `Assigned to: ${conversation.assignedStaffName || "Support Staff"}`
                      : isVi
                        ? "Đang hỗ trợ bởi Trợ lý AI & Đội ngũ Lễ tân"
                        : "Handled by AI Assistant & Reception Team"
                    : isVi
                      ? "Bắt đầu cuộc trò chuyện mới bên dưới"
                      : "Start a new conversation below"}
                </p>
              </div>
            </div>

            {conversation && (
              <div className="flex items-center gap-2">
                {!isMember && !isClosed && (
                  <>
                    {!conversation.assignedStaffUserId ? (
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => handleClaimOrRelease("claim")}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isVi ? "Tiếp nhận" : "Claim"}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => handleClaimOrRelease("release")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 cursor-pointer"
                      >
                        <span>{isVi ? "Chuyển lại AI" : "Release"}</span>
                      </button>
                    )}
                  </>
                )}

                {isMember && !isClosed && conversation.handlerType === "AI" && (
                  <button type="button" disabled={actionBusy} onClick={handleEscalate} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800 cursor-pointer">
                    <UserRound className="w-3.5 h-3.5" />
                    <span>{isVi ? "Gặp nhân viên lễ tân" : "Support from receptionist"}</span>
                  </button>
                )}

                {!isClosed ? (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={handleCloseConversation}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{isVi ? "Kết thúc" : "Close"}</span>
                  </button>
                ) : (
                  <>
                    {isMember && (
                      <button
                        type="button"
                        onClick={handleStartNewConversation}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{isVi ? "Hội thoại mới" : "New conversation"}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={handleReopenConversation}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 px-3 py-1.5 text-xs font-bold text-white transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{isVi ? "Mở lại hội thoại" : "Reopen"}</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2 py-16">
                <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                <span>
                  {isVi
                    ? "Đang tải cuộc trò chuyện..."
                    : "Loading conversation..."}
                </span>
              </div>
            ) : !conversation ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-12 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-accent-soft text-brand-accent-dark flex items-center justify-center">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {isVi
                      ? "Bạn cần hỗ trợ vấn đề gì hôm nay?"
                      : "How can we help you today?"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {isVi
                      ? "Nhập tiêu đề hỗ trợ hoặc gửi tin nhắn đầu tiên để kết nối ngay với trung tâm."
                      : "Enter a subject or send your first message to connect with the center."}
                  </p>
                </div>

                <div className="w-full flex gap-2">
                  <input
                    type="text"
                    value={subjectInput}
                    onChange={(e) => setSubjectInput(e.target.value)}
                    placeholder={
                      isVi
                        ? "Chủ đề cần hỗ trợ (tùy chọn)..."
                        : "Support subject (optional)..."
                    }
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs outline-none focus:border-brand-primary"
                  />
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleStartConversation()}
                    className="rounded-xl bg-brand-primary hover:bg-brand-primary-hover px-4 py-2 text-xs font-bold text-white cursor-pointer shrink-0"
                  >
                    {isVi ? "Bắt đầu Chat" : "Start Chat"}
                  </button>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500">
                {isVi
                  ? "Cuộc trò chuyện đã sẵn sàng. Hãy gửi tin nhắn bên dưới để bắt đầu!"
                  : "Conversation is open. Send a message below to begin!"}
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMine =
                  msg.isMine ||
                  (isMember && msg.senderType === "MEMBER") ||
                  (!isMember && msg.senderType === "STAFF")
                const isSystem = msg.senderType === "SYSTEM"
                if (isSystem) {
                  return (
                    <div
                      key={msg.id || idx}
                      className="flex justify-center my-2"
                    >
                      <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
                        {renderFormattedMessage(msg.content)}
                      </span>
                    </div>
                  )
                }
                return (
                  <div
                    key={msg.id || idx}
                    className={`flex flex-col ${
                      isMine ? "items-end" : "items-start"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      {!isMine && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600">
                          {msg.senderType === "AI" ? (
                            <Bot className="w-3 h-3 text-blue-600" />
                          ) : (
                            <UserRound className="w-3 h-3 text-emerald-600" />
                          )}
                          {msg.senderName ||
                            (msg.senderType === "AI"
                              ? "VIBE AI"
                              : "Chuyên viên Hỗ trợ")}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        {formatChatTime(msg.createdAt, isVi)}
                      </span>
                    </div>
                    <div
                      className={`max-w-[80%] break-words rounded-2xl px-4 py-2.5 text-xs leading-relaxed whitespace-pre-wrap shadow-2xs ${
                        isMine
                          ? "bg-slate-900 text-white rounded-br-xs"
                          : "bg-white border border-slate-200 text-slate-800 rounded-bl-xs"
                      }`}
                    >
                      {renderFormattedMessage(msg.content)}
                    </div>
                  </div>
                )
              })
            )}
            {waitingAI && (
              <div className="flex items-center gap-2 text-xs text-slate-500" role="status" aria-live="polite">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {isVi ? "Trợ lý AI đang trả lời..." : "AI assistant is replying..."}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input Footer */}
          <form
            onSubmit={handleSendMessage}
            className="border-t border-slate-200 bg-white p-3.5 flex items-center gap-2.5"
          >
            <input
              type="text"
              disabled={sending}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={
                isClosed
                  ? isVi
                    ? "Cuộc trò chuyện đã đóng. Nhấn 'Mở lại hội thoại' để tiếp tục nhắn tin."
                    : "Conversation is closed. Click 'Reopen' to send messages."
                  : isVi
                    ? "Nhập nội dung câu hỏi hoặc yêu cầu hỗ trợ..."
                    : "Type your message or support question..."
              }
              className="flex-1 rounded-xl border border-slate-300 bg-slate-50/60 focus:bg-white px-4 py-2.5 text-xs text-slate-900 outline-none focus:border-brand-primary disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={sending || !messageInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-50 px-4 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer shrink-0"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>{isVi ? "Gửi" : "Send"}</span>
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

export default SupportView
