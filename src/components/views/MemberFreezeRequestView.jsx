import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  PauseCircle,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Info,
  Send,
  FileText,
  ArrowLeft,
  CalendarCheck2,
  Building2,
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import { membershipApi } from "../../api/membershipApi"
import { memberPortalApi } from "../../api/memberPortalApi"
import { getAuthoritativeProfileId } from "../../utils/memberSafetyHelpers"
import { getErrorMessage } from "../../api/apiErrors"
import { PageHeader } from "../ui/PageHeader"

const INITIAL_REQUESTS = [
  {
    id: "req-102",
    packageName: "VIBE Standard 6 Tháng",
    startDate: "2026-06-10",
    days: 14,
    reasonVi: "Đi công tác nước ngoài",
    reasonEn: "Overseas business trip",
    status: "approved",
    createdAt: "2026-06-05",
    adminNote: "Đã duyệt theo quy định gói 6 tháng (tối đa 30 ngày/năm).",
  },
]

export function isSubscriptionActive(sub) {
  if (!sub) return false
  const rawStatus = String(sub.status || sub.rawStatus || "").trim().toLowerCase()
  // Tuyệt đối không suy ra Active khi thiếu trạng thái
  if (!rawStatus) return false
  if (!["active", "grace_period"].includes(rawStatus)) return false

  const expiry = sub.expiresAt || sub.endDate
  if (expiry) {
    const expTime = new Date(expiry).getTime()
    if (!Number.isNaN(expTime)) {
      const effectiveExp = String(expiry).length === 10
        ? new Date(`${expiry}T23:59:59`).getTime()
        : expTime
      if (effectiveExp < Date.now()) return false
    }
  }
  return true
}

export function resolveSubscriptionBadge(sub, isVi) {
  if (!sub) {
    return {
      label: "—",
      className: "bg-stone-100 text-stone-600 border border-stone-200",
    }
  }
  const rawStatus = String(sub.status || sub.rawStatus || "").trim().toLowerCase()
  const expiry = sub.expiresAt || sub.endDate
  let isPastExpiry = false
  if (expiry) {
    const expTime = new Date(expiry).getTime()
    if (!Number.isNaN(expTime)) {
      const effectiveExp = String(expiry).length === 10
        ? new Date(`${expiry}T23:59:59`).getTime()
        : expTime
      isPastExpiry = effectiveExp < Date.now()
    }
  }

  if (rawStatus === "expired" || isPastExpiry) {
    return {
      label: isVi ? "Hết hạn" : "Expired",
      className: "bg-stone-100 text-stone-600 border border-stone-200",
    }
  }

  if (["active", "grace_period"].includes(rawStatus)) {
    return {
      label: rawStatus === "grace_period" ? (isVi ? "Gia hạn" : "Grace Period") : (isVi ? "Đang kích hoạt" : "Active"),
      className: "bg-emerald-50 text-emerald-800 border border-emerald-200",
    }
  }

  if (!rawStatus) {
    return {
      label: isVi ? "Chưa xác định" : "Unspecified",
      className: "bg-amber-50 text-amber-800 border border-amber-200",
    }
  }

  return {
    label: sub.status || rawStatus,
    className: "bg-slate-100 text-slate-700 border border-slate-200",
  }
}

export function MemberFreezeRequestView({ embedded = false, initialSubscriptions = null }) {
  let navigate = () => {}
  try {
    navigate = useNavigate()
  } catch {
    // Graceful fallback when rendered outside Router context
  }
  const { language, apiEnabled, currentUser, t } = useSCMS()
  const isVi = language === "vi"

  const memberId =
    getAuthoritativeProfileId(currentUser) ?? currentUser?.memberId

  const [requests, setRequests] = useState(apiEnabled ? [] : INITIAL_REQUESTS)
  const [requestsLoading, setRequestsLoading] = useState(!!apiEnabled)
  const [subscriptions, setSubscriptions] = useState(
    Array.isArray(initialSubscriptions) ? initialSubscriptions : []
  )
  const [selectedSubId, setSelectedSubId] = useState("")
  const [activeHolidays, setActiveHolidays] = useState([])
  const [centerIncidents, setCenterIncidents] = useState([])
  const [startDate, setStartDate] = useState("")
  const [days, setDays] = useState("7")
  const [reason, setReason] = useState("business")
  const [notes, setNotes] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  useEffect(() => {
    if (!apiEnabled) return
    memberPortalApi
      .getActiveHolidays()
      .then((list) => setActiveHolidays(Array.isArray(list) ? list : []))
      .catch(() => {})
    memberPortalApi
      .getCenterIncidents()
      .then((list) => setCenterIncidents(Array.isArray(list) ? list : []))
      .catch(() => {})
    if (memberId) {
      membershipApi
        .getMemberSubscriptions(memberId)
        .then((subs) => {
          const list = Array.isArray(subs) ? subs : []
          setSubscriptions(list)
          const firstActive = list.find((s) =>
            ["active", "grace_period"].includes(
              String(s.status || "").toLowerCase(),
            ),
          )
          if (firstActive) {
            setSelectedSubId(
              String(firstActive.subscriptionId || firstActive.id),
            )
          } else if (list[0]) {
            setSelectedSubId(String(list[0].subscriptionId || list[0].id))
          }
        })
        .catch(() => {})
    }
    // Fetch lịch sử yêu cầu bảo lưu
    if (memberId) {
      setRequestsLoading(true)
      membershipApi
        .getFreezeRequests?.(memberId)
        .then((list) => setRequests(Array.isArray(list) ? list : []))
        .catch(() => {})
        .finally(() => setRequestsLoading(false))
    } else {
      setRequestsLoading(false)
    }
  }, [apiEnabled, memberId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!startDate || !days) return
    setSubmitError("")
    setSubmitted(false)

    // Khi bật API: chặn ngay trong handler để tuyệt đối không gọi POST /api/subscriptions/{id}/extend
    if (apiEnabled) {
      setSubmitting(false)
      setSubmitted(false)
      const explanation = isVi
        ? "Tính năng gửi yêu cầu bảo lưu trực tuyến đang tạm nâng cấp. Quý hội viên vui lòng liên hệ trực tiếp quầy Lễ tân hoặc Quản lý trung tâm để được tiếp nhận và xử lý thủ tục bảo lưu."
        : "Online freeze requests are temporarily under upgrade. Please contact Reception or Management directly for assistance."
      setSubmitError(explanation)
      return
    }

    const reasonTextVi =
      reason === "business"
        ? "Đi công tác"
        : reason === "medical"
          ? "Lý do sức khỏe / điều trị"
          : "Lý do cá nhân"
    const reasonTextEn =
      reason === "business"
        ? "Business trip"
        : reason === "medical"
          ? "Medical reasons"
          : "Personal reasons"
    const fullReason = notes.trim()
      ? `${reasonTextVi} (${startDate}): ${notes.trim()}`
      : `${reasonTextVi} (từ ${startDate})`

    const selectedSub = subscriptions.find(
      (s) => String(s.subscriptionId || s.id) === String(selectedSubId),
    )

    // Chế độ mock (!apiEnabled): tạo bản ghi mô phỏng giao diện
    const newReq = {
      id: `req-${Date.now().toString().slice(-4)}`,
      packageName:
        selectedSub?.packageName ||
        (isVi ? "Gói hội viên hiện tại" : "Current Membership"),
      startDate,
      days: parseInt(days, 10),
      reasonVi: reasonTextVi,
      reasonEn: reasonTextEn,
      status: "pending",
      createdAt: new Date().toISOString().slice(0, 10),
      adminNote: null,
    }

    setRequests([newReq, ...requests])
    setSubmitted(true)
    setStartDate("")
    setNotes("")
    setTimeout(() => setSubmitted(false), 5000)
  }

  const activeSubscriptions = subscriptions.filter(isSubscriptionActive)
  const otherSubscriptions = subscriptions.filter((s) => !isSubscriptionActive(s))

  return (
    <main
      className={
        embedded
          ? "space-y-6"
          : "mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-7 sm:py-8"
      }
    >
      {/* Header */}
      {!embedded && (
        <PageHeader
          title={isVi ? "Yêu cầu bảo lưu gói tập" : "Membership Freeze Request"}
          description={isVi
            ? "Tạm dừng thời hạn gói khi bạn đi công tác, điều trị chấn thương hoặc có việc cá nhân."
            : "Put your membership on hold during trips, medical treatments, or personal leave."}
          actions={
            <button
              type="button"
              onClick={() => navigate("/member/my-membership")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>
                {isVi ? "Quay lại Gói hội viên" : "Back to My Membership"}
              </span>
            </button>
          }
        />
      )}

      {/* Policy banner */}
      <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-xs text-amber-950 shadow-xs">
        <div className="flex items-center gap-2 font-bold text-amber-900 text-sm">
          <Info className="w-4 h-4 text-amber-700" />
          <span>
            {isVi
              ? "Quy định Gia hạn & Bảo lưu thời hạn gói (D08 / D12 / D14)"
              : "Validity Extension & Freeze Policy (D08 / D12 / D14)"}
          </span>
        </div>
        <ul className="mt-2.5 list-disc list-inside space-y-1 text-amber-900/90 leading-relaxed">
          <li>
            {isVi
              ? "Tự động cộng bù ngày nghỉ Trung tâm (D12/D14): Thời hạn 45 ngày sử dụng của gói Advanced được máy chủ tự động skip các ngày Trung tâm nghỉ lễ (Holiday) hoặc gián đoạn sự cố (Center Incident) mà không cần gửi đơn."
              : "Automatic Center Holiday & Incident skip (D12/D14): The 45-day usage period of Advanced packages automatically skips official Center Holidays and verified Center Incidents on the server."}
          </li>
          <li>
            {isVi
              ? "Yêu cầu bảo lưu cá nhân: Gói chung từ 3 tháng trở lên có thể gửi phiếu đề xuất bảo lưu cá nhân (tối thiểu 7 ngày, tối đa 30 ngày) để Lễ tân & Quản lý trung tâm xem xét hỗ trợ."
              : "Personal freeze request: Standard plans of 3+ months can submit a consultation request (7–30 days) for Reception & Center Management review."}
          </li>
          <li>
            {isVi
              ? "Thời hạn chính thức của gói luôn hiển thị theo trường expiresAt từ máy chủ sau khi đã đối soát."
              : "Authoritative package expiration is always governed by the server expiresAt timestamp."}
          </li>
        </ul>
        {(activeHolidays.length > 0 || centerIncidents.length > 0) && (
          <div className="mt-3 pt-3 border-t border-amber-200/80 flex flex-wrap gap-2">
            {activeHolidays.map((h) => (
              <span
                key={h.id || h.holidayDate}
                className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-amber-900 border border-amber-200"
              >
                <CalendarCheck2 className="w-3.5 h-3.5 text-amber-700" />
                {h.holidayName || "Ngày nghỉ lễ"} ({h.holidayDate})
              </span>
            ))}
            {centerIncidents.map((inc) => (
              <span
                key={inc.id}
                className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold text-rose-800 border border-rose-200"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                {inc.title || inc.reason || "Sự cố trung tâm"} ({inc.incidentDate || inc.startDate || ""})
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Request Form */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <PauseCircle className="w-5 h-5 text-brand-accent-dark" />
          {isVi ? "Yêu cầu bảo lưu thời hạn gói" : "Membership Freeze Request"}
        </h2>

        {apiEnabled ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-950 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-sm">
                  {t("memberFreezeUpgradeTitle")}
                </p>
                <p className="text-amber-900/90 leading-relaxed">
                  {t("memberFreezeUpgradeBody")}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-xs">
                <Building2 className="w-4 h-4 text-brand-primary" />
                <span>
                  {isVi
                    ? "Hướng dẫn liên hệ Lễ tân để hỗ trợ bảo lưu thủ công"
                    : "Contact Reception for Manual Freeze Support"}
                </span>
              </div>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-600 leading-relaxed">
                <li>
                  {isVi
                    ? "Quý hội viên có nhu cầu bảo lưu cá nhân (công tác, điều trị chấn thương, lý do sức khỏe) vui lòng liên hệ trực tiếp quầy Lễ tân tại cơ sở để được nhân viên lập phiếu đề xuất."
                    : "Members with personal leave needs (business trips, medical treatment) please visit Reception directly to submit a physical request."}
                </li>
                <li>
                  {isVi
                    ? "Áp dụng theo quy chế bảo lưu cho các gói hội viên có thời hạn từ 3 tháng trở lên."
                    : "Applicable under freeze policy for membership plans of 3+ months."}
                </li>
              </ul>
            </div>

            {subscriptions.length > 0 && (
              <div className="pt-2 space-y-3">
                {activeSubscriptions.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-2">
                      {isVi ? "Quyền học đang kích hoạt của bạn:" : "Your Active Subscriptions:"}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {activeSubscriptions.map((sub) => {
                        const sid = sub.subscriptionId || sub.id
                        const badge = resolveSubscriptionBadge(sub, isVi)
                        return (
                          <div
                            key={sid}
                            className="p-3 bg-white border border-slate-200 rounded-lg text-xs flex justify-between items-center"
                          >
                            <div>
                              <p className="font-bold text-slate-900">{sub.packageName || `Gói #${sid}`}</p>
                              <p className="text-[11px] text-slate-500 font-mono">
                                {isVi ? "Hết hạn:" : "Expires:"} {sub.endDate || sub.expiresAt || "—"}
                              </p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badge.className}`}>
                              {badge.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {otherSubscriptions.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-2">
                      {isVi ? "Quyền học khác / Lịch sử:" : "Other / Expired Subscriptions:"}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {otherSubscriptions.map((sub) => {
                        const sid = sub.subscriptionId || sub.id
                        const badge = resolveSubscriptionBadge(sub, isVi)
                        return (
                          <div
                            key={sid}
                            className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex justify-between items-center opacity-85"
                          >
                            <div>
                              <p className="font-semibold text-slate-700">{sub.packageName || `Gói #${sid}`}</p>
                              <p className="text-[11px] text-slate-400 font-mono">
                                {isVi ? "Thời hạn:" : "Expires:"} {sub.endDate || sub.expiresAt || "—"}
                              </p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badge.className}`}>
                              {badge.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {submitted && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {isVi
                    ? "Đơn bảo lưu của bạn đã được gửi thành công! Quản lý sẽ sớm phản hồi."
                    : "Your freeze request has been submitted and is awaiting approval."}
                </span>
              </div>
            )}

            {submitError && (
              <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-xs text-amber-900 leading-relaxed">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {subscriptions.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isVi ? "Chọn gói hội viên cần bảo lưu *" : "Select Membership *"}
              </label>
              <select
                value={selectedSubId}
                onChange={(e) => setSelectedSubId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand-primary font-sans bg-white"
              >
                {subscriptions.map((sub) => {
                  const sid = sub.subscriptionId || sub.id
                  return (
                    <option key={sid} value={sid}>
                      {sub.packageName || `Gói #${sid}`} ({sub.status || (isVi ? "Chưa xác định" : "Unspecified")})
                    </option>
                  )
                })}
              </select>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isVi ? "Ngày bắt đầu bảo lưu *" : "Freeze Start Date *"}
              </label>
              <input
                type="date"
                required
                value={startDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand-primary font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isVi ? "Số ngày bảo lưu *" : "Duration (Days) *"}
              </label>
              <select
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-brand-primary font-sans bg-white"
              >
                <option value="7">
                  7 {isVi ? "ngày (1 tuần)" : "days (1 week)"}
                </option>
                <option value="14">
                  14 {isVi ? "ngày (2 tuần)" : "days (2 weeks)"}
                </option>
                <option value="21">
                  21 {isVi ? "ngày (3 tuần)" : "days (3 weeks)"}
                </option>
                <option value="30">
                  30 {isVi ? "ngày (1 tháng)" : "days (1 month)"}
                </option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isVi ? "Lý do bảo lưu *" : "Reason for Freezing *"}
            </label>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                {
                  key: "business",
                  labelVi: "Đi công tác xa",
                  labelEn: "Business trip",
                },
                {
                  key: "medical",
                  labelVi: "Sức khỏe / Chấn thương",
                  labelEn: "Medical / Injury",
                },
                {
                  key: "personal",
                  labelVi: "Việc cá nhân khác",
                  labelEn: "Personal reasons",
                },
              ].map((item) => (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => setReason(item.key)}
                  className={`rounded-xl border p-3 text-xs font-bold transition-all text-center cursor-pointer ${
                    reason === item.key
                      ? "border-brand-primary bg-brand-blue-soft text-brand-dark ring-1 ring-brand-primary"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {isVi ? item.labelVi : item.labelEn}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {isVi ? "Ghi chú bổ sung (nếu có)" : "Additional Notes"}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={
                isVi
                  ? "Ví dụ: Đi công tác Đà Nẵng từ ngày 28/10..."
                  : "Additional details..."
              }
              className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-brand-primary resize-none"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-6 py-2.5 text-xs font-bold text-white hover:bg-brand-primary-hover transition-colors shadow-xs cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {isVi ? "Gửi yêu cầu bảo lưu" : "Submit Freeze Request"}
              </span>
            </button>
          </div>
        </form>
        </>
        )}
      </section>

      {/* History table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:px-6">
          <h2 className="font-bold text-slate-900">
            {isVi ? "Lịch sử yêu cầu bảo lưu" : "Request History"}
          </h2>
        </div>

        {requestsLoading ? (
          <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Clock className="h-4 w-4 animate-spin text-slate-400" />
            <span>{t("memberFreezeLoadingRequests")}</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            {t("memberFreezeNoRequests")}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((req) => (
              <div
                key={req.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-500">
                      #{req.id}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">
                      {req.packageName}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        req.status === "approved"
                          ? "bg-emerald-50 text-emerald-700"
                          : req.status === "rejected"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {req.status === "approved"
                        ? isVi
                          ? "Đã duyệt"
                          : "Approved"
                        : req.status === "rejected"
                          ? isVi
                            ? "Từ chối"
                            : "Rejected"
                          : isVi
                            ? "Đang chờ duyệt"
                            : "Pending"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">
                    {isVi ? "Thời gian:" : "Period:"}{" "}
                    <strong>{req.startDate}</strong> ({req.days}{" "}
                    {isVi ? "ngày" : "days"}) · {isVi ? "Lý do:" : "Reason:"}{" "}
                    {isVi ? req.reasonVi : req.reasonEn}
                  </p>

                  {req.adminNote && (
                    <p className="text-[11px] text-slate-500 italic">
                      {isVi ? "Phản hồi quản lý:" : "Admin note:"}{" "}
                      {req.adminNote}
                    </p>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 font-mono">
                  {isVi ? "Gửi lúc" : "Submitted"}: {req.createdAt}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default MemberFreezeRequestView
