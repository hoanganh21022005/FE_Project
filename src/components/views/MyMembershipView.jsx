import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Award, ArrowRight, CalendarDays, Check, CheckCircle2, Clock3, Copy, CreditCard, Dumbbell, FileText, RefreshCw, Search, UserRound, Wallet } from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import { membershipApi } from "../../api/membershipApi"
import { invoiceApi } from "../../api/invoiceApi"
import { classEnrollmentApi } from "../../api/classEnrollmentApi"
import { getErrorMessage } from "../../api/apiErrors"
import { getAuthoritativeProfileId } from "../../utils/memberSafetyHelpers"
import { partitionMemberMembershipData } from "../../utils/memberMembershipData"
import { isActiveNormalEnrollment } from "../../utils/memberScheduleUtils"
import { PageHeader } from "../ui/PageHeader"

const formatDate = (value, language) => {
  if (!value) return "–"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "–"
  return date.toLocaleDateString(language === "vi" ? "vi-VN" : "en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" })
}
const STATUS_KEYS = ["active", "grace_period", "pending_payment", "expired", "completed", "cancelled", "canceled", "pending", "registered", "confirmed", "enrolled", "withdrawn"]
const statusLabel = (status, t) => {
  const key = String(status || "").toLowerCase().replace(/[\s-]+/g, "_")
  if (t && STATUS_KEYS.includes(key)) return t(key)
  const fallbacks = {
    active: "Active", grace_period: "Grace Period", pending_payment: "Pending Payment",
    expired: "Expired", completed: "Completed", cancelled: "Cancelled", canceled: "Cancelled",
    registered: "Registered", confirmed: "Confirmed", enrolled: "Enrolled", withdrawn: "Withdrawn",
  }
  return fallbacks[key] || status || "–"
}

function ResourceState({ loading, loadingText, error, onRetry, empty, emptyAction = false, children }) {
  const { language } = useSCMS()
  const languageTextAdvanced = language === "vi" ? "Chọn môn học và huấn luyện viên để bắt đầu." : "Choose a course and coach to get started."
  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500" role="status"><RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin" />{loadingText ?? "…"}</div>
  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800" role="alert"><p className="font-semibold">Chưa tải được dữ liệu</p><p className="mt-1 text-sm">{error}</p><button className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-rose-800 ring-1 ring-rose-200 hover:bg-rose-100" onClick={onRetry}><RefreshCw size={16} />Thử lại</button></div>
  if (empty) return emptyAction ? <div className="flex flex-col gap-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-brand-primary"><Dumbbell size={20} /></span><div><p className="font-semibold text-slate-900">{empty}</p><p className="mt-0.5 text-sm text-slate-500">{languageTextAdvanced}</p></div></div><Link to="/member/catalog" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-semibold text-white hover:bg-brand-primary-hover">Đăng ký khóa học ngay<ArrowRight size={16} /></Link></div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center"><p className="font-semibold text-slate-800">{empty}</p></div>
  return children
}
function Info({ icon: Icon, label, value, highlight, action = false }) {
  return <div className={"min-w-0 rounded-xl border p-3 transition " + (action ? "border-blue-100 bg-blue-50/50 hover:border-blue-200 hover:bg-blue-50" : "border-transparent bg-slate-50")}><p className="flex items-center gap-2 text-xs font-medium text-slate-500"><Icon size={14} />{label}</p><p className={"mt-1 break-words text-sm font-semibold " + (action ? "text-brand-primary" : highlight ? "text-amber-700" : "text-slate-800")}>{value}</p>{action && <ArrowRight className="ml-auto mt-1 h-4 w-4 text-brand-primary" />}</div>
}
function SubscriptionCard({ item, language, t, history = false }) {
  const subject = item.subjectName || (item.subjectId ? "Môn #" + item.subjectId : "Chưa có thông tin môn")
  const coach = item.primaryCoachName || (item.primaryCoachId ? "HLV #" + item.primaryCoachId : "Chưa có Primary Coach")
  const packageType = String(item.packageType || "").trim().toLowerCase()
  const kindLabel = packageType === "advanced" ? "Advanced · theo môn" : packageType === "normal" ? "Normal · gói hội viên cũ" : "Chưa phân loại · đang cập nhật thông tin"
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-lavender-soft text-brand-purple-dark"><Award size={21} /></div><div><p className="text-xs font-bold uppercase tracking-wide text-brand-purple-dark">{kindLabel}</p><h3 className="mt-1 text-lg font-bold text-slate-900">{item.packageName || (packageType === "advanced" ? "Quyền học Advanced" : "Khóa học")}</h3></div></div><MembershipStatusBadge status={item.rawStatus || item.status} label={statusLabel(item.rawStatus || item.status, t)} /></div>
    {packageType === "advanced" ? <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Info icon={Dumbbell} label="Môn học" value={subject} /><Info icon={UserRound} label="Primary Coach" value={coach} /><Info icon={CreditCard} label="Credit còn lại" value={item.remainingCredit == null ? "Chưa có thông tin" : item.remainingCredit + " credit"} highlight={item.remainingCredit === 0} /><Info icon={CalendarDays} label="Thời hạn" value={formatDate(item.activatedAt || item.startDate, language) + " – " + formatDate(item.expiresAt || item.endDate, language)} /></div> : <div className="mt-5 grid gap-4 sm:grid-cols-2"><Info icon={CalendarDays} label="Thời hạn hợp lệ" value={formatDate(item.activatedAt || item.startDate, language) + " – " + formatDate(item.expiresAt || item.endDate, language)} /><Info icon={CreditCard} label="Quyền sử dụng" value={packageType === "normal" ? "Gói Normal cũ; xem lớp đã đăng ký ở mục riêng." : "Chưa thể xác định loại gói tập; vui lòng liên hệ quầy lễ tân."} /></div>}
    {packageType === "advanced" && item.remainingCredit === 0 && !history && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Credit hiện còn 0. Quyền với các buổi đã đặt vẫn theo trạng thái lịch và xác nhận từ hệ thống.</p>}
    {packageType === "advanced" && !item.subjectName && !item.primaryCoachName && <p className="mt-4 text-xs text-slate-500">Thông tin chi tiết môn học/HLV đang được cập nhật; vui lòng liên hệ quầy lễ tân để được hỗ trợ.</p>}
  </article>
}
function EnrollmentCard({ item, t, language }) {
  const className = item.className || item.courseName || item.name || (item.classId ? "Lớp #" + item.classId : "Lớp học")
  const subject = item.subjectName || (item.subjectId ? "Môn #" + item.subjectId : "Chưa có thông tin môn")
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-blue-soft text-brand-primary"><Dumbbell size={21} /></div><div><p className="text-xs font-bold uppercase tracking-wide text-brand-primary">Normal · {t("enrolled")}</p><h3 className="mt-1 text-lg font-bold text-slate-900">{className}</h3></div></div><MembershipStatusBadge status={item.status} label={statusLabel(item.status, t)} /></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Info icon={Dumbbell} label={language === "vi" ? "Môn học" : "Subject"} value={subject} /><Info icon={UserRound} label={language === "vi" ? "Huấn luyện viên" : "Coach"} value={item.coachName || item.primaryCoachName || (language === "vi" ? "Chưa có thông tin" : "Not available")} /><Link to="/member/schedule" className="group block rounded-xl"><Info icon={CalendarDays} label={language === "vi" ? "Lịch học" : "Schedule"} value={language === "vi" ? "Xem lịch học của tôi" : "View my schedule"} action /></Link></div><p className="mt-4 border-t border-slate-100 pt-3 text-[12.5px] leading-5 text-slate-500">{language === "vi" ? "Đăng ký lớp Normal là quyền theo lớp; không hiển thị như gói hội viên Basic/Advanced." : "Normal course enrollment is class-based and is shown separately from Basic/Advanced memberships."}</p></article>
}

function MembershipStatusBadge({ status, label }) {
  const key = String(status || "").trim().toLowerCase()
  const tone = key === "completed" ? "bg-teal-50 text-teal-700" : ["cancelled", "canceled"].includes(key) ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"
  const dot = key === "completed" ? "bg-teal-500" : ["cancelled", "canceled"].includes(key) ? "bg-rose-500" : "bg-slate-400"
  return <span className={"inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold " + tone}><span className={"h-1.5 w-1.5 rounded-full " + dot} />{label}</span>
}
function InvoiceRow({ invoice, language, t, copiedId, onCopy }) {
  const paid = invoice.paymentStatus === "successful"
  const code = invoice.invoiceCode || "Hóa đơn #" + (invoice.invoiceId || invoice.id)
  return <div className="grid gap-3 border-b border-slate-100 px-4 py-4 last:border-0 md:grid-cols-[minmax(240px,1.4fr)_minmax(160px,1fr)_minmax(150px,.8fr)_minmax(150px,.7fr)] md:items-center md:px-5"><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{invoice.packageName || invoice.className || "Giao dịch hội viên"}</p><div className="mt-1 flex items-center gap-1"><span className="truncate font-mono text-xs text-slate-500">{code}</span><button type="button" aria-label={copiedId === String(invoice.invoiceId || invoice.id) ? "Copied" : "Copy invoice ID"} onClick={() => onCopy(code, String(invoice.invoiceId || invoice.id))} className="rounded p-1 text-slate-400 hover:bg-slate-100">{copiedId === String(invoice.invoiceId || invoice.id) ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}</button></div></div><p className="text-sm text-slate-600">{formatDate(invoice.paymentDate || invoice.createdAt, language)}</p><span className={"inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold " + (paid ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}><span className={"h-1.5 w-1.5 rounded-full " + (paid ? "bg-emerald-500" : "bg-slate-400")} />{paid ? t("successful") : statusLabel(invoice.paymentStatus, t)}</span><p className="text-right text-sm font-bold tabular-nums text-slate-900">{invoice.amount == null ? "–" : Number(invoice.amount).toLocaleString(language === "vi" ? "vi-VN" : "en-US") + " ₫"}</p></div>
}

function MembershipKpi({ icon: Icon, tone, title, value, detail }) {
  const palette = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  }
  return <article className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"><span className={"grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[10px] " + palette[tone]}><Icon size={20} /></span><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-500">{title}</p><p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">{value}<span className="ml-1.5 text-xs font-medium text-slate-500">{detail}</span></p></div></article>
}

export function MyMembershipView() {
  const { currentUser, language, apiEnabled, t } = useSCMS()
  const location = useLocation()
  const navigate = useNavigate()
  const isHistory = location.pathname.endsWith("/history")
  const memberId = getAuthoritativeProfileId(currentUser)
  const [data, setData] = useState({ subscriptions: [], enrollments: [], invoices: [] })
  const [loading, setLoading] = useState({ subscriptions: true, enrollments: true, invoices: true })
  const [errors, setErrors] = useState({ subscriptions: "", enrollments: "", invoices: "" })
  const [reloadKey, setReloadKey] = useState(0)
  const [historySearch, setHistorySearch] = useState("")
  const [copiedInvoiceId, setCopiedInvoiceId] = useState("")
  const [copyTimer, setCopyTimer] = useState(null)
  const load = useCallback(async () => {
    if (!apiEnabled || !memberId) {
      const message = !apiEnabled ? "Trang này cần kết nối máy chủ để hiển thị quyền hội viên." : "Không tìm thấy memberId của phiên đăng nhập; dữ liệu hội viên chưa được tải."
      setLoading({ subscriptions: false, enrollments: false, invoices: false })
      setErrors({ subscriptions: message, enrollments: message, invoices: message })
      return
    }
    setLoading({ subscriptions: true, enrollments: true, invoices: true })
    setErrors({ subscriptions: "", enrollments: "", invoices: "" })
    const requests = {
      subscriptions: membershipApi.getMemberSubscriptions(memberId, { strict: true }),
      enrollments: classEnrollmentApi.getMemberEnrollments(memberId, { strict: true }),
      invoices: invoiceApi.getMemberOwnInvoices({ strict: true }),
    }
    await Promise.all(Object.entries(requests).map(async ([key, request]) => {
      try {
        const result = await request
        if (!Array.isArray(result)) throw new Error("Dữ liệu từ máy chủ không đúng định dạng.")
        setData((previous) => ({ ...previous, [key]: result }))
      } catch (error) {
        setErrors((previous) => ({ ...previous, [key]: getErrorMessage(error, "Không thể tải dữ liệu.") }))
      } finally {
        setLoading((previous) => ({ ...previous, [key]: false }))
      }
    }))
  }, [apiEnabled, memberId])
  useEffect(() => { load() }, [load, reloadKey])
  const partition = useMemo(() => partitionMemberMembershipData(data), [data])
  const activeNormalCount = useMemo(
    () => data.enrollments.filter((row) => isActiveNormalEnrollment(row)).length,
    [data.enrollments],
  )
  const activeAdvancedCount = partition.usableSubscriptions.filter((item) => String(item.packageType || "").toLowerCase() === "advanced").length
  const historyTransactions = useMemo(() => {
    const query = historySearch.trim().toLocaleLowerCase()
    return [...partition.paidInvoices]
      .sort((a, b) => new Date(b.paymentDate || b.createdAt || 0) - new Date(a.paymentDate || a.createdAt || 0))
      .filter((invoice) => !query || [invoice.invoiceCode, invoice.packageName, invoice.className, invoice.invoiceId].some((value) => String(value || "").toLocaleLowerCase().includes(query)))
  }, [historySearch, partition.paidInvoices])
  const copyInvoice = async (value, id) => {
    if (!navigator.clipboard?.writeText) return
    try {
      await navigator.clipboard.writeText(String(value))
      setCopiedInvoiceId(id)
      window.clearTimeout(copyTimer)
      setCopyTimer(window.setTimeout(() => setCopiedInvoiceId(""), 1500))
    } catch { setCopiedInvoiceId("") }
  }
  const retry = () => setReloadKey((value) => value + 1)
  const tabClass = (selected) => "inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition " + (selected ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-800")
  return <main className="min-w-0 w-full space-y-6 px-4 py-5 sm:px-6 lg:px-8" aria-labelledby="membership-title">
    <PageHeader
      title={language === "vi" ? "Quyền học & Đăng ký của tôi" : "My memberships & enrollments"}
      description={language === "vi" ? "Theo dõi lớp Normal, quyền học Advanced và lịch sử thanh toán của bạn." : "Review your Normal courses, Advanced entitlements, and payment history."}
      actions={
        <button onClick={retry} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw size={16} />{language === "vi" ? "Làm mới" : "Refresh"}
        </button>
      }
    />
    <section className="grid gap-3 sm:grid-cols-3" aria-label={language === "vi" ? "Tóm tắt hội viên" : "Membership summary"}>
      <MembershipKpi icon={Award} tone="blue" title={language === "vi" ? "Quyền Advanced đang dùng" : "Active Advanced entitlements"} value={activeAdvancedCount} detail={language === "vi" ? "quyền hội viên" : "entitlements"} />
      <MembershipKpi icon={Dumbbell} tone="emerald" title={language === "vi" ? "Khóa học Normal đang dùng" : "Active Normal courses"} value={activeNormalCount} detail={language === "vi" ? "khóa học" : "courses"} />
      <MembershipKpi icon={Wallet} tone="amber" title={language === "vi" ? "Giao dịch đã thanh toán" : "Paid transactions"} value={partition.paidInvoices.length} detail={language === "vi" ? "giao dịch" : "transactions"} />
    </section>
    <nav className="flex w-fit max-w-full gap-1 rounded-xl bg-slate-100 p-1" aria-label={language === "vi" ? "Mục gói hội viên" : "Membership sections"}><button className={tabClass(!isHistory)} aria-current={!isHistory ? "page" : undefined} onClick={() => navigate("/member/my-membership")}><CheckCircle2 size={16} />{language === "vi" ? "Đang sử dụng" : "Active"}</button><button className={tabClass(isHistory)} aria-current={isHistory ? "page" : undefined} onClick={() => navigate("/member/my-membership/history")}><Clock3 size={16} />{language === "vi" ? "Lịch sử" : "History"}</button></nav>
    {!isHistory ? <div className="space-y-8">
      {partition.pendingInvoices.length > 0 && <aside className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center"><Clock3 className="shrink-0" size={19} /><p className="text-sm"><strong>Có {partition.pendingInvoices.length} hóa đơn đang chờ thanh toán.</strong> Hóa đơn chờ không được tính là quyền đang sử dụng.</p><button onClick={() => navigate("/member/invoices")} className="min-h-9 shrink-0 rounded-lg bg-white px-3 text-sm font-semibold ring-1 ring-amber-200 hover:bg-amber-100">Xem hóa đơn</button></aside>}
      <section className="space-y-4"><div><h2 className="text-xl font-bold text-slate-900">Quyền học Advanced</h2><p className="mt-1 text-sm text-slate-500">Quyền học Advanced được quản lý theo môn, Primary Coach và credit. Khóa Normal đã đăng ký hiển thị ở mục riêng bên dưới.</p></div><ResourceState loading={loading.subscriptions} loadingText={t("courseCatalogLoading")} error={errors.subscriptions} onRetry={retry} emptyAction empty={partition.usableSubscriptions.length === 0 ? (language === "vi" ? "Bạn chưa có quyền học Advanced đang hoạt động." : "No active Advanced entitlements yet.") : null}><div className="grid gap-4 xl:grid-cols-2">{partition.usableSubscriptions.map((item) => <SubscriptionCard key={item.subscriptionId || item.id} item={item} language={language} t={t} />)}</div></ResourceState></section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">{t("membershipNormalSectionTitle")}</h2>
        <ResourceState loading={loading.enrollments} loadingText={t("courseCatalogLoading")} error={errors.enrollments} onRetry={retry} empty={null}>
          {activeNormalCount > 0 ? (
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:px-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-blue-soft text-brand-primary">
                  <Dumbbell size={19} />
                </div>
                <div><p className="text-sm font-semibold text-slate-800">{t("membershipNormalActiveSummary").replace("{count}", String(activeNormalCount))}</p><span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{activeNormalCount} {language === "vi" ? "khóa học" : "courses"}</span></div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/member/enrollments")}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 text-sm font-semibold text-white transition hover:bg-brand-primary-hover"
              >
                {t("membershipBtnViewEnrollments")}
              </button>
            </div>
          ) : (
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:px-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                  <Dumbbell size={19} />
                </div>
                <p className="text-sm font-medium text-slate-600">{t("enrollmentsEmptyTitle")}</p>
              </div>
              <Link
                to="/member/catalog"
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-brand-primary transition hover:bg-slate-50"
              >
                {t("enrollmentsBtnRegisterCourse")}
              </Link>
            </div>
          )}
        </ResourceState>
      </section>
    </div> : <div className="space-y-8">
      <section className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-bold text-slate-900">{language === "vi" ? "Các giao dịch đã thanh toán" : "Paid transactions"}</h2><p className="mt-1 text-sm text-slate-500">{language === "vi" ? "Đối chiếu từ hóa đơn riêng của tài khoản hội viên." : "Transactions from your membership invoices."}</p></div><label className="relative block w-full sm:w-80"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder={language === "vi" ? "Tìm khóa học hoặc mã hóa đơn" : "Search course or invoice ID"} className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-blue-100" aria-label={language === "vi" ? "Tìm giao dịch" : "Search transactions"} /></label></div><ResourceState loading={loading.invoices} loadingText={t("courseCatalogLoading")} error={errors.invoices} onRetry={retry} empty={historyTransactions.length === 0 ? (historySearch ? (language === "vi" ? "Không tìm thấy giao dịch phù hợp." : "No matching transactions.") : (language === "vi" ? "Chưa có hóa đơn đã thanh toán." : "No paid transactions yet.")) : null}><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="hidden grid-cols-[minmax(240px,1.4fr)_minmax(160px,1fr)_minmax(150px,.8fr)_minmax(150px,.7fr)] gap-3 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid"><span>{language === "vi" ? "Dịch vụ / Mã hóa đơn" : "Service / Invoice ID"}</span><span>{language === "vi" ? "Ngày thanh toán" : "Paid date"}</span><span>{language === "vi" ? "Trạng thái" : "Status"}</span><span className="text-right">{language === "vi" ? "Số tiền" : "Amount"}</span></div>{historyTransactions.map((invoice) => <InvoiceRow key={invoice.invoiceId || invoice.id} invoice={invoice} language={language} t={t} copiedId={copiedInvoiceId} onCopy={copyInvoice} />)}</div></ResourceState></section>
      <section className="space-y-4"><div><h2 className="text-xl font-bold text-slate-900">{language === "vi" ? "Quyền hội viên đã kết thúc" : "Ended entitlements"}</h2><p className="mt-1 text-sm text-slate-500">{language === "vi" ? "Các trạng thái hết hạn, hoàn thành hoặc đã hủy được giữ riêng với quyền đang dùng." : "Expired, completed, and cancelled entitlements are kept separate from active benefits."}</p></div><ResourceState loading={loading.subscriptions || loading.enrollments} loadingText={t("courseCatalogLoading")} error={[errors.subscriptions, errors.enrollments].filter(Boolean).join(" · ")} onRetry={retry} empty={partition.historySubscriptions.length + partition.historyEnrollments.length === 0 ? (language === "vi" ? "Chưa có gói hoặc lớp trong lịch sử." : "No ended memberships or courses yet.") : null}><div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))]">{partition.historySubscriptions.map((item) => <SubscriptionCard key={item.subscriptionId || item.id} item={item} language={language} t={t} history />)}{partition.historyEnrollments.map((item) => <EnrollmentCard key={item.enrollmentId || item.id || (item.classId + "-" + item.subjectId)} item={item} t={t} language={language} />)}</div></ResourceState></section>
    </div>}
    <footer className="flex w-full items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs leading-5 text-slate-600"><FileText className="mt-0.5 shrink-0 text-brand-primary" size={15} />Dữ liệu gói, thời hạn, credit và hóa đơn được đồng bộ theo hệ thống trung tâm. Các gói ở trạng thái Chờ xử lý chưa cấp quyền tập luyện.</footer>
  </main>
}
export default MyMembershipView
