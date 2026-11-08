import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Award, CalendarDays, CheckCircle2, Clock3, CreditCard, Dumbbell, FileText, RefreshCw, UserRound } from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import { membershipApi } from "../../api/membershipApi"
import { invoiceApi } from "../../api/invoiceApi"
import { classEnrollmentApi } from "../../api/classEnrollmentApi"
import { getErrorMessage } from "../../api/apiErrors"
import { getAuthoritativeProfileId } from "../../utils/memberSafetyHelpers"
import { partitionMemberMembershipData } from "../../utils/memberMembershipData"
import { isActiveNormalEnrollment } from "../../utils/memberScheduleUtils"

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

function ResourceState({ loading, loadingText, error, onRetry, empty, children }) {
  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500" role="status"><RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin" />{loadingText ?? "…"}</div>
  if (error) return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800" role="alert"><p className="font-semibold">Chưa tải được dữ liệu</p><p className="mt-1 text-sm">{error}</p><button className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-rose-800 ring-1 ring-rose-200 hover:bg-rose-100" onClick={onRetry}><RefreshCw size={16} />Thử lại</button></div>
  if (empty) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-500"><Dumbbell size={22} /></div><p className="font-semibold text-slate-800">{empty}</p><p className="mt-1 text-sm text-slate-500">Bạn chưa có đăng ký quyền học Advanced. Vui lòng vào Danh mục khóa học để chọn môn học và Huấn luyện viên.</p><div className="mt-4"><Link to="/member/catalog" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-brand-primary px-4 text-sm font-semibold text-white hover:bg-brand-primary-hover">Đăng ký khóa học ngay</Link></div></div>
  return children
}
function Info({ icon: Icon, label, value, highlight }) {
  return <div className="min-w-0 rounded-xl bg-slate-50 p-3"><p className="flex items-center gap-2 text-xs font-medium text-slate-500"><Icon size={14} />{label}</p><p className={"mt-1 break-words text-sm font-semibold " + (highlight ? "text-amber-700" : "text-slate-800")}>{value}</p></div>
}
function SubscriptionCard({ item, language, t, history = false }) {
  const subject = item.subjectName || (item.subjectId ? "Môn #" + item.subjectId : "Chưa có thông tin môn")
  const coach = item.primaryCoachName || (item.primaryCoachId ? "HLV #" + item.primaryCoachId : "Chưa có Primary Coach")
  const packageType = String(item.packageType || "").trim().toLowerCase()
  const kindLabel = packageType === "advanced" ? "Advanced · theo môn" : packageType === "normal" ? "Normal · gói hội viên cũ" : "Chưa phân loại · đang cập nhật thông tin"
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-lavender-soft text-brand-purple-dark"><Award size={21} /></div><div><p className="text-xs font-bold uppercase tracking-wide text-brand-purple-dark">{kindLabel}</p><h3 className="mt-1 text-lg font-bold text-slate-900">{item.packageName || (packageType === "advanced" ? "Quyền học Advanced" : "Khóa học")}</h3></div></div><span className={"rounded-full px-3 py-1 text-xs font-semibold " + (history ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700")}>{statusLabel(item.rawStatus || item.status, t)}</span></div>
    {packageType === "advanced" ? <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Info icon={Dumbbell} label="Môn học" value={subject} /><Info icon={UserRound} label="Primary Coach" value={coach} /><Info icon={CreditCard} label="Credit còn lại" value={item.remainingCredit == null ? "Chưa có thông tin" : item.remainingCredit + " credit"} highlight={item.remainingCredit === 0} /><Info icon={CalendarDays} label="Thời hạn" value={formatDate(item.activatedAt || item.startDate, language) + " – " + formatDate(item.expiresAt || item.endDate, language)} /></div> : <div className="mt-5 grid gap-4 sm:grid-cols-2"><Info icon={CalendarDays} label="Thời hạn hợp lệ" value={formatDate(item.activatedAt || item.startDate, language) + " – " + formatDate(item.expiresAt || item.endDate, language)} /><Info icon={CreditCard} label="Quyền sử dụng" value={packageType === "normal" ? "Gói Normal cũ; xem lớp đã đăng ký ở mục riêng." : "Chưa thể xác định loại gói tập; vui lòng liên hệ quầy lễ tân."} /></div>}
    {packageType === "advanced" && item.remainingCredit === 0 && !history && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Credit hiện còn 0. Quyền với các buổi đã đặt vẫn theo trạng thái lịch và xác nhận từ hệ thống.</p>}
    {packageType === "advanced" && !item.subjectName && !item.primaryCoachName && <p className="mt-4 text-xs text-slate-500">Thông tin chi tiết môn học/HLV đang được cập nhật; vui lòng liên hệ quầy lễ tân để được hỗ trợ.</p>}
  </article>
}
function EnrollmentCard({ item, t }) {
  const className = item.className || item.courseName || item.name || (item.classId ? "Lớp #" + item.classId : "Lớp học")
  const subject = item.subjectName || (item.subjectId ? "Môn #" + item.subjectId : "Chưa có thông tin môn")
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-blue-soft text-brand-primary"><Dumbbell size={21} /></div><div><p className="text-xs font-bold uppercase tracking-wide text-brand-primary">Normal · lớp đã đăng ký</p><h3 className="mt-1 text-lg font-bold text-slate-900">{className}</h3></div></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{statusLabel(item.status, t)}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Info icon={Dumbbell} label="Môn học" value={subject} /><Info icon={UserRound} label="Huấn luyện viên" value={item.coachName || item.primaryCoachName || "Chưa có thông tin"} /><Info icon={CalendarDays} label="Lịch học" value={item.scheduleText || item.schedule || item.sessionSchedule || "Xem lịch học của tôi"} /></div><p className="mt-4 text-sm text-slate-500">Đăng ký lớp Normal là quyền theo lớp; không hiển thị như gói hội viên Basic/Advanced.</p></article>
}
function InvoiceRow({ invoice, language, t }) {
  const paid = invoice.paymentStatus === "successful"
  return <div className="grid gap-3 border-b border-slate-100 px-4 py-4 last:border-0 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-center"><div><p className="font-semibold text-slate-800">{invoice.invoiceCode || "Hóa đơn #" + invoice.invoiceId}</p><p className="mt-1 text-xs text-slate-500">{invoice.packageName || invoice.className || "Giao dịch hội viên"}</p></div><p className="text-sm text-slate-600">{formatDate(invoice.createdAt, language)}</p><p className="text-sm font-semibold text-slate-800">{invoice.amount == null ? "Chưa có số tiền" : Number(invoice.amount).toLocaleString(language === "vi" ? "vi-VN" : "en-US") + " ₫"}</p><span className={"w-fit rounded-full px-3 py-1 text-xs font-semibold " + (paid ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>{paid ? t("successful") : statusLabel(invoice.paymentStatus, t)}</span></div>
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
  const retry = () => setReloadKey((value) => value + 1)
  const tabClass = (selected) => "inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition " + (selected ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100")
  return <main className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-5 sm:px-6 lg:px-8" aria-labelledby="membership-title">
    <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:p-6"><div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-blue-soft text-brand-primary"><Award size={24} /></div><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">VIBE Athletic Club</p><h1 id="membership-title" className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Quyền học & Đăng ký của tôi</h1><p className="mt-1 text-sm text-slate-600">Theo dõi lớp Normal, quyền học Advanced và lịch sử thanh toán của bạn.</p></div></div><button onClick={retry} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw size={16} />Làm mới</button></header>
    <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2" aria-label="Mục gói hội viên"><button className={tabClass(!isHistory)} aria-current={!isHistory ? "page" : undefined} onClick={() => navigate("/member/my-membership")}><CheckCircle2 size={16} />Đang sử dụng</button><button className={tabClass(isHistory)} aria-current={isHistory ? "page" : undefined} onClick={() => navigate("/member/my-membership/history")}><Clock3 size={16} />Lịch sử</button></nav>
    {!isHistory ? <div className="space-y-8">
      {partition.pendingInvoices.length > 0 && <aside className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 sm:flex-row sm:items-center"><Clock3 className="shrink-0" size={19} /><p className="text-sm"><strong>Có {partition.pendingInvoices.length} hóa đơn đang chờ thanh toán.</strong> Hóa đơn chờ không được tính là quyền đang sử dụng.</p><button onClick={() => navigate("/member/invoices")} className="min-h-9 shrink-0 rounded-lg bg-white px-3 text-sm font-semibold ring-1 ring-amber-200 hover:bg-amber-100">Xem hóa đơn</button></aside>}
      <section className="space-y-4"><div><h2 className="text-xl font-bold text-slate-900">Quyền học Advanced</h2><p className="mt-1 text-sm text-slate-500">Quyền học Advanced được quản lý theo môn, Primary Coach và credit. Khóa Normal đã đăng ký hiển thị ở mục riêng bên dưới.</p></div><ResourceState loading={loading.subscriptions} loadingText={t("courseCatalogLoading")} error={errors.subscriptions} onRetry={retry} empty={partition.usableSubscriptions.length === 0 ? "Bạn chưa có quyền học Advanced đang hoạt động." : null}><div className="grid gap-4 xl:grid-cols-2">{partition.usableSubscriptions.map((item) => <SubscriptionCard key={item.subscriptionId || item.id} item={item} language={language} t={t} />)}</div></ResourceState></section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">{t("membershipNormalSectionTitle")}</h2>
        <ResourceState loading={loading.enrollments} loadingText={t("courseCatalogLoading")} error={errors.enrollments} onRetry={retry} empty={null}>
          {activeNormalCount > 0 ? (
            <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:px-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-blue-soft text-brand-primary">
                  <Dumbbell size={19} />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {t("membershipNormalActiveSummary").replace("{count}", String(activeNormalCount))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/member/enrollments")}
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
      <section className="space-y-4"><div><h2 className="text-xl font-bold text-slate-900">Các giao dịch đã thanh toán</h2><p className="mt-1 text-sm text-slate-500">Đối chiếu từ hóa đơn riêng của tài khoản hội viên.</p></div><ResourceState loading={loading.invoices} loadingText={t("courseCatalogLoading")} error={errors.invoices} onRetry={retry} empty={partition.paidInvoices.length === 0 ? "Chưa có hóa đơn đã thanh toán." : null}><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="hidden grid-cols-[1.2fr_1fr_1fr_auto] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid"><span>Hóa đơn</span><span>Ngày</span><span>Số tiền</span><span>Trạng thái</span></div>{partition.paidInvoices.map((invoice) => <InvoiceRow key={invoice.invoiceId || invoice.id} invoice={invoice} language={language} t={t} />)}</div></ResourceState></section>
      <section className="space-y-4"><div><h2 className="text-xl font-bold text-slate-900">Quyền hội viên đã kết thúc</h2><p className="mt-1 text-sm text-slate-500">Các trạng thái hết hạn, hoàn thành hoặc đã hủy được giữ riêng với quyền đang dùng.</p></div><ResourceState loading={loading.subscriptions || loading.enrollments} loadingText={t("courseCatalogLoading")} error={[errors.subscriptions, errors.enrollments].filter(Boolean).join(" · ")} onRetry={retry} empty={partition.historySubscriptions.length + partition.historyEnrollments.length === 0 ? "Chưa có gói hoặc lớp trong lịch sử." : null}><div className="grid gap-4 xl:grid-cols-2">{partition.historySubscriptions.map((item) => <SubscriptionCard key={item.subscriptionId || item.id} item={item} language={language} t={t} history />)}{partition.historyEnrollments.map((item) => <EnrollmentCard key={item.enrollmentId || item.id || (item.classId + "-" + item.subjectId)} item={item} t={t} />)}</div></ResourceState></section>
    </div>}
    <footer className="flex items-start gap-2 rounded-xl bg-slate-100 p-4 text-xs leading-5 text-slate-600"><FileText className="mt-0.5 shrink-0" size={15} />Dữ liệu gói, thời hạn, credit và hóa đơn được đồng bộ theo hệ thống trung tâm. Các gói ở trạng thái Chờ xử lý chưa cấp quyền tập luyện.</footer>
  </main>
}
export default MyMembershipView
