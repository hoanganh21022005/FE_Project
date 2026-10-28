import React, { useState } from "react"
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
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"

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

export function MemberFreezeRequestView({ embedded = false }) {
  const navigate = useNavigate()
  const { language, apiEnabled } = useSCMS()
  const isVi = language === "vi"

  const [requests, setRequests] = useState(apiEnabled ? [] : INITIAL_REQUESTS)
  const [startDate, setStartDate] = useState("")
  const [days, setDays] = useState("7")
  const [reason, setReason] = useState("business")
  const [notes, setNotes] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!startDate || !days) return

    const newReq = {
      id: `req-${Date.now().toString().slice(-4)}`,
      packageName: isVi ? "Gói hội viên hiện tại" : "Current Membership",
      startDate,
      days: parseInt(days, 10),
      reasonVi:
        reason === "business"
          ? "Đi công tác"
          : reason === "medical"
            ? "Lý do sức khỏe / điều trị"
            : "Lý do cá nhân",
      reasonEn:
        reason === "business"
          ? "Business trip"
          : reason === "medical"
            ? "Medical reasons"
            : "Personal reasons",
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
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-red-700">
              VIBE SPORT · MEMBER
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              {isVi ? "Yêu cầu bảo lưu gói tập" : "Membership Freeze Request"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {isVi
                ? "Tạm dừng thời hạn gói khi bạn đi công tác, điều trị chấn thương hoặc có việc cá nhân."
                : "Put your membership on hold during trips, medical treatments, or personal leave."}
            </p>
          </div>
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
        </header>
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
      </section>

      {/* Request Form */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <PauseCircle className="w-5 h-5 text-red-700" />
          {isVi ? "Gửi đơn yêu cầu bảo lưu mới" : "Submit New Freeze Request"}
        </h2>

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

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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
                className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-red-500 font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isVi ? "Số ngày bảo lưu *" : "Duration (Days) *"}
              </label>
              <select
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-red-500 font-sans bg-white"
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
                      ? "border-red-600 bg-red-50 text-red-900 ring-1 ring-red-500"
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
              className="w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-red-500 resize-none"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-6 py-2.5 text-xs font-bold text-white hover:bg-red-800 transition-colors shadow-xs cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {isVi ? "Gửi yêu cầu bảo lưu" : "Submit Freeze Request"}
              </span>
            </button>
          </div>
        </form>
      </section>

      {/* History table */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:px-6">
          <h2 className="font-bold text-slate-900">
            {isVi ? "Lịch sử yêu cầu bảo lưu" : "Request History"}
          </h2>
        </div>

        {requests.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            {isVi ? "Chưa có yêu cầu bảo lưu nào." : "No freeze requests yet."}
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
