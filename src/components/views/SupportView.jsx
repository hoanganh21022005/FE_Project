import React, { useCallback, useEffect, useRef, useState } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { chatApi } from "../../api/chatApi"
import { getErrorMessage } from "../../api/apiErrors"
import {
  Phone,
  BookOpen,
  MessageSquare,
  Send,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  CreditCard,
  CalendarDays,
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
  { label: "Thanh toán & đối soát hóa đơn VNPay", subject: "Thanh toán & hóa đơn VNPay", prompt: "Hướng dẫn ngắn gọn cách thanh toán và đối soát hóa đơn VNPay tại trung tâm." },
  { label: "Tư vấn khóa Normal & HLV 1:1 Advanced", subject: "Tư vấn khóa học", prompt: "Tư vấn ngắn gọn sự khác nhau và mức học phí giữa lớp Normal và gói HLV 1:1 Advanced." },
  { label: "Điểm danh mã QR & lịch tập", subject: "Điểm danh và lịch tập", prompt: "Hướng dẫn ngắn gọn cách quét mã QR điểm danh và kiểm tra lịch tập hàng tuần." },
  { label: "Bảo lưu & gia hạn gói hội viên", subject: "Bảo lưu và gia hạn gói", prompt: "Cho biết ngắn gọn điều kiện và quy trình bảo lưu hoặc gia hạn gói tập." },
]

const QUICK_TOPICS_EN = [
  { label: "Payment & VNPay invoice reconciliation", subject: "Payment & VNPay invoice", prompt: "Briefly explain how to pay and reconcile a VNPay invoice at the center." },
  { label: "Normal & 1-on-1 Advanced consultation", subject: "Course consultation", prompt: "Briefly compare Normal and 1-on-1 Advanced, including price and key differences." },
  { label: "QR check-in & training schedule", subject: "Check-in and schedule", prompt: "Briefly explain QR check-in and how to view my weekly training schedule." },
  { label: "Membership freeze & extension", subject: "Membership freeze or extension", prompt: "Briefly explain the eligibility and process for freezing or extending a membership." },
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
  const isMember = String(role || currentUser?.role || "").toLowerCase() === "member"

  const [conversation, setConversation] = useState(null)
  const [inboxList, setInboxList] = useState([])
  const [messages, setMessages] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
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
      if (isMember) {
        const activeConv = await chatApi.getMyActiveConversation()
        setConversation(activeConv)
        setUnreadCount(Number(activeConv?.unreadCount || 0))
        if (activeConv?.id) {
          await loadMessages(activeConv.id)
        } else {
          setUnreadCount(0)
          setMessages([])
        }
      } else {
        const unread = await chatApi.getMyChatUnreadCount().catch(() => 0)
        setUnreadCount(Number(unread || 0))
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

  const handleSendMessage = async (e, quickContent) => {
    e?.preventDefault?.()
    const content = String(quickContent?.prompt ?? quickContent ?? messageInput).trim()
    if (!content || sending) return

    setSending(true)
    setError("")
    try {
      let targetConv = conversation
      if (!targetConv?.id || String(targetConv.status).toUpperCase() === "CLOSED") {
        if (apiEnabled) {
          targetConv = await chatApi.getOrCreateConversation({
            subject: quickContent?.subject || content.slice(0, 80) || (isVi ? "Hỗ trợ hội viên" : "Member Support"),
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
        if (isMember) setUnreadCount(0)
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
  const quickTopicIcons = [CreditCard, BookOpen, CalendarDays, ShieldCheck]
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
    <main className="w-full space-y-6 px-4 py-5 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:p-6">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                {isVi ? "Trợ lý VIBE AI & Chăm sóc Hội viên" : "VIBE AI & Member Care"}
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">{isVi ? "Trò chuyện với Trợ lý AI hoặc kết nối lễ tân để được hỗ trợ." : "Chat with VIBE AI or connect with reception for help."}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-600">
              <span className="rounded-full bg-slate-100 px-2.5 py-1">• {isVi ? "AI phản hồi tức thì" : "Instant AI replies"}</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">• {isVi ? "Lễ tân trực ca" : "Reception on duty"}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={refreshSupportChat}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left column: Quick Topics or Staff Inbox + Info Cards */}
        <div className="space-y-4 lg:col-span-4 lg:col-start-9 lg:row-start-1">
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
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] space-y-3">
            <div className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-950">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Sparkles className="h-4 w-4" /></span>
              <span>
                {isVi
                  ? "Chủ đề hỗ trợ nhanh"
                  : "Quick Support Topics"}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              {isVi
                ? "Chọn một chủ đề bên dưới để bắt đầu hoặc gửi câu hỏi ngay:"
                : "Select a topic below to start a conversation immediately:"}
            </p>
            <div className="space-y-2">
              {quickTopics.map((topic, idx) => {
                const TopicIcon = quickTopicIcons[idx]
                const tones = ["bg-blue-50 text-blue-700", "bg-violet-50 text-violet-700", "bg-emerald-50 text-emerald-700", "bg-amber-50 text-amber-700"]
                return (
                  <button key={topic.subject} type="button" disabled={actionBusy || sending} onClick={() => handleSendMessage(null, topic)} className="group flex w-full items-center gap-3 rounded-xl border border-transparent bg-white px-3 py-3 text-left transition hover:border-slate-200 hover:bg-slate-50 hover:shadow-sm disabled:opacity-50">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[idx]}`}><TopicIcon className="h-4.5 w-4.5" /></span>
                    <span className="min-w-0 flex-1 text-xs font-bold leading-5 text-slate-800">{topic.label}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-700" />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Info Cards */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><BookOpen className="h-4 w-4" /></span>
              <span>
                {isVi
                  ? "Quy trình Hỗ trợ VIBE Sport"
                  : "VIBE Sport Support Workflow"}
              </span>
            </div>
            <div className="space-y-3">
              {[
                [Sparkles, isVi ? "Trợ lý AI tiếp nhận câu hỏi 24/7" : "AI receives questions 24/7", "bg-blue-50 text-blue-700"],
                [ShieldCheck, isVi ? "Thông tin được chuyển đúng bộ phận" : "Requests reach the right team", "bg-violet-50 text-violet-700"],
                [UserRound, isVi ? "Kết nối lễ tân khi cần hỗ trợ trực tiếp" : "Connect to reception for live help", "bg-emerald-50 text-emerald-700"],
              ].map(([StepIcon, label, tone], idx) => (
                <div key={label} className="flex items-center gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}><StepIcon className="h-4 w-4" /></span>
                  <p className="text-xs font-medium leading-5 text-slate-600">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-emerald-700"><Phone className="h-4 w-4" /></span>
              <span>
                {isVi
                  ? "Hotline Trực Trung Tâm"
                  : "Center Hotline Support"}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              {isVi
                ? "Hotline hỗ trợ khẩn cấp 24/7:"
                : "24/7 Emergency Support Hotline:"}{" "}
              <strong className="mt-1 block font-mono text-2xl font-black tracking-wide text-emerald-800">1900 888 999</strong>
            </p>
          </div>
        </div>

        {/* Right 2 columns: Active Chat Window */}
        <div className="lg:col-span-8 lg:col-start-1 lg:row-start-1 bg-white border border-slate-200 rounded-2xl shadow-sm shadow-slate-950/[0.03] flex flex-col min-h-[600px] max-h-[820px] overflow-hidden">
          {/* Conversation Top Bar */}
          <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0 after:absolute after:-bottom-0.5 after:-right-0.5 after:h-3 after:w-3 after:rounded-full after:border-2 after:border-white after:bg-emerald-500 ${
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
                    {!isMember && (
                      <button type="button" disabled={actionBusy} onClick={handleReopenConversation} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-slate-800">
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>{isVi ? "Mở lại hội thoại" : "Reopen"}</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/70 [&::-webkit-scrollbar-track]:bg-transparent p-5 space-y-4 bg-slate-50/30">
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
              <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                  <Bot className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-extrabold tracking-tight text-slate-900">
                  {isVi ? "Xin chào! Bạn cần hỗ trợ gì hôm nay?" : "Hello! How can we help today?"}
                </h3>
                <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-500">
                  {isVi ? "Chọn một chủ đề hỗ trợ bên phải hoặc nhập câu hỏi vào khung bên dưới để bắt đầu." : "Choose a support topic on the right or type your question below to get started."}
                </p>
                <div className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white/80 p-3.5"><CreditCard className="mb-2 h-4 w-4 text-blue-700" /><p className="text-[11px] font-semibold leading-4 text-slate-600">{isVi ? "Tra cứu học phí & gói tập" : "Membership & pricing"}</p></div>
                  <div className="rounded-xl border border-slate-200 bg-white/80 p-3.5"><BookOpen className="mb-2 h-4 w-4 text-violet-700" /><p className="text-[11px] font-semibold leading-4 text-slate-600">{isVi ? "Đối soát hóa đơn VNPay" : "VNPay invoice support"}</p></div>
                  <div className="rounded-xl border border-slate-200 bg-white/80 p-3.5"><UserRound className="mb-2 h-4 w-4 text-emerald-700" /><p className="text-[11px] font-semibold leading-4 text-slate-600">{isVi ? "Kết nối Lễ tân 1 chạm" : "One-touch reception support"}</p></div>
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
            className="border-t border-slate-200 bg-white p-4 flex items-center gap-2.5"
          >
            <input
              type="text"
              disabled={sending}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={
                isClosed
                  ? isVi
                ? "Cuộc trò chuyện đã đóng. Gửi tin nhắn để bắt đầu hội thoại mới."
                    : "This conversation is closed. Sending a message starts a new conversation."
                  : isVi
                    ? "Nhập nội dung câu hỏi hoặc yêu cầu hỗ trợ..."
                    : "Type your message or support question..."
              }
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={sending || !messageInput.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-blue-900/20 transition hover:bg-blue-800 disabled:opacity-50 cursor-pointer shrink-0"
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
