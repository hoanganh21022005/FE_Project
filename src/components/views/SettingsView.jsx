import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  Clock3,
  CreditCard,
  Globe,
  Headphones,
  Languages,
  Shield,
  ShieldCheck,
  Sliders,
  UserRound,
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"

const NOTIFICATION_STORAGE_KEY = "vibe-member-notification-preferences"
const DEFAULT_NOTIFICATION_PREFERENCES = {
  trainingReminders: true,
  billingUpdates: true,
  supportReplies: true,
}

function LanguageCard({ code, title, description, active, onClick }) {
  const Icon = code === "VI" ? Languages : Globe
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition sm:p-5 ${
        active
          ? "border-blue-300 bg-blue-50/70 ring-2 ring-blue-100"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${active ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] font-extrabold tracking-wider text-slate-600">{code}</span>
          <span className="text-sm font-bold text-slate-900">{title}</span>
        </span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
      </span>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${active ? "bg-blue-700 text-white" : "border border-slate-300 bg-white text-transparent"}`}>
        {active && <Check className="h-4 w-4" />}
      </span>
    </button>
  )
}

function PreferenceToggle({ title, description, enabled, onToggle }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-800">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={title}
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${enabled ? "bg-blue-700" : "bg-slate-300"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${enabled ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </div>
  )
}

function ActionRow({ icon: Icon, title, description, onClick, tone = "blue" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    violet: "bg-violet-50 text-violet-700",
    emerald: "bg-emerald-50 text-emerald-700",
  }
  return (
    <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 rounded-xl border border-transparent bg-white p-3 text-left transition hover:border-slate-200 hover:bg-slate-50 hover:shadow-sm">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-4.5 w-4.5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-800">{title}</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span></span>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-700" />
    </button>
  )
}

export function SettingsView() {
  const { language, setLanguage, t, role, currentUser } = useSCMS()
  const navigate = useNavigate()
  const isVi = language === "vi"
  const isMember = String(role || currentUser?.role || "").toUpperCase() === "MEMBER"
  const [notificationPreferences, setNotificationPreferences] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_NOTIFICATION_PREFERENCES
    try {
      return {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...JSON.parse(window.localStorage.getItem(NOTIFICATION_STORAGE_KEY) || "{}"),
      }
    } catch {
      return DEFAULT_NOTIFICATION_PREFERENCES
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notificationPreferences))
    } catch {
      // Keep settings usable when browser storage is unavailable.
    }
  }, [notificationPreferences])

  const setPreference = (key) =>
    setNotificationPreferences((previous) => ({ ...previous, [key]: !previous[key] }))

  return (
    <main className="w-full space-y-6 px-4 py-5 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-br from-[#0f172a] via-[#172554] to-[#1e3a8a] p-6 text-white shadow-lg shadow-slate-950/10 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div>
            <span className="inline-flex rounded-full border border-blue-200/20 bg-blue-200/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-100">{isVi ? "TÙY CHỈNH HỆ THỐNG" : "SYSTEM PREFERENCES"}</span>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">{isMember ? (isVi ? "Cài đặt trải nghiệm & Thông báo" : "Experience & Notification Settings") : t("settings")}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/80">
              {isMember
                ? isVi
                  ? "Tùy chỉnh ngôn ngữ hiển thị, thông báo nhắc lịch tập và lối tắt tài khoản cá nhân."
                  : "Customize your display language, training reminders, and personal account shortcuts."
                : isVi
                  ? "Cấu hình ngôn ngữ, thông báo & tham số vận hành Trung tâm VIBE Sport"
                  : "Configure language, notifications & VIBE Sport operational parameters"}
            </p>
            {isMember && <span className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100">• {isVi ? "Ngôn ngữ: Tiếng Việt" : "Language: English"}</span>}
          </div>
          {isMember && <button type="button" onClick={() => navigate("/profile")} className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white shadow-sm backdrop-blur transition hover:bg-white/15">{isVi ? "Hồ sơ & Mật khẩu" : "Profile & Password"}<ArrowRight className="h-4 w-4" /></button>}
        </div>
      </section>

      <div className={isMember ? "grid grid-cols-1 items-start gap-6 lg:grid-cols-12" : "space-y-6"}>
        <div className={isMember ? "space-y-6 lg:col-span-8" : "space-y-6"}>
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] sm:p-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Globe className="h-5 w-5" /></span>
              <div><h2 className="text-lg font-black tracking-tight text-slate-950">{isVi ? "Cấu hình ngôn ngữ" : "Language"}</h2><p className="mt-0.5 text-xs text-slate-500">{isMember ? (isVi ? "Chọn ngôn ngữ hiển thị cho tài khoản hội viên." : "Choose your preferred member interface language.") : (isVi ? "Chọn ngôn ngữ mặc định cho toàn bộ giao diện" : "Choose the default language for the interface")}</p></div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <LanguageCard code="VI" title="Tiếng Việt" description={isMember ? "Giao diện mặc định tại trung tâm" : "Vietnamese interface"} active={language === "vi"} onClick={() => setLanguage("vi")} />
              <LanguageCard code="EN" title="English" description={isMember ? "International member interface" : "English interface"} active={language === "en"} onClick={() => setLanguage("en")} />
            </div>
          </section>

          {isMember ? (
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] sm:p-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Bell className="h-5 w-5" /></span><div><h2 className="text-lg font-black tracking-tight text-slate-950">{isVi ? "Tùy chọn thông báo" : "Notification preferences"}</h2><p className="mt-0.5 text-xs text-slate-500">{isVi ? "Lựa chọn loại cập nhật bạn muốn nhận trên thiết bị này." : "Choose which updates you want to receive on this device."}</p></div></div>
              <div className="space-y-3">
                <PreferenceToggle title={isVi ? "Nhắc nhở lịch tập sắp tới" : "Upcoming training reminders"} description={isVi ? "Thông báo trước buổi học Normal và HLV 1:1." : "Reminders before Normal and 1-on-1 training sessions."} enabled={notificationPreferences.trainingReminders} onToggle={() => setPreference("trainingReminders")} />
                <PreferenceToggle title={isVi ? "Biến động hóa đơn & gói hội viên" : "Invoice & membership updates"} description={isVi ? "Xác nhận thanh toán VNPay và nhắc khi gói sắp hết hạn." : "VNPay payment confirmations and membership expiry reminders."} enabled={notificationPreferences.billingUpdates} onToggle={() => setPreference("billingUpdates")} />
                <PreferenceToggle title={isVi ? "Phản hồi từ Trợ lý AI & Lễ tân" : "AI & reception replies"} description={isVi ? "Thông báo khi có tin nhắn hỗ trợ mới." : "Alerts when a new support message arrives."} enabled={notificationPreferences.supportReplies} onToggle={() => setPreference("supportReplies")} />
              </div>
              <p className="text-[11px] text-slate-400">{isVi ? "Tùy chọn được lưu trên trình duyệt này." : "Preferences are saved in this browser."}</p>
            </section>
          ) : (
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><Sliders className="h-5 w-5" /></span><h2 className="text-lg font-black text-slate-950">{isVi ? "Quy tắc vận hành VIBE Sport" : "VIBE Sport operating rules"}</h2></div>
              <div className="space-y-3 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4"><span>{isVi ? "Thời gian cho phép gia hạn tự động sau khi gói hết hạn:" : "Automatic grace period after package expiry:"}</span><strong className="shrink-0 tabular-nums text-slate-950">{isVi ? "72 giờ" : "72 hours"}</strong></div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4"><span>{isVi ? "Bắt buộc nhập lý do khi điều chỉnh điểm danh:" : "Require a reason when attendance is changed:"}</span><strong className="shrink-0 text-emerald-700">{isVi ? "Đang bật" : "Enabled"}</strong></div>
              </div>
            </section>
          )}
        </div>

        {isMember && <aside className="space-y-6 lg:col-span-4">
          <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.02] sm:p-6">
            <div className="mb-2 flex items-center gap-3 border-b border-slate-100 pb-4"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Shield className="h-5 w-5" /></span><div><h2 className="text-base font-black text-slate-950">{isVi ? "Lối tắt Tài khoản & Bảo mật" : "Account & security shortcuts"}</h2><p className="mt-0.5 text-xs text-slate-500">{isVi ? "Quản lý hồ sơ và nhận trợ giúp." : "Manage your profile or get support."}</p></div></div>
            <ActionRow icon={UserRound} title={isVi ? "Cập nhật thông tin cá nhân" : "Update personal information"} description={isVi ? "Hồ sơ, liên hệ và ảnh đại diện" : "Profile, contact details, and avatar"} onClick={() => navigate("/profile")} />
            <ActionRow icon={ShieldCheck} tone="violet" title={isVi ? "Đổi mật khẩu đăng nhập" : "Change login password"} description={isVi ? "Cập nhật thông tin bảo mật" : "Update your account security"} onClick={() => navigate("/profile")} />
            <ActionRow icon={Headphones} tone="emerald" title={isVi ? "Trung tâm Hỗ trợ 24/7" : "24/7 Support Center"} description={isVi ? "Trò chuyện với AI hoặc Lễ tân" : "Chat with AI or reception"} onClick={() => navigate("/support")} />
          </section>

          <section className="relative overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-br from-[#0f172a] to-[#172554] p-5 text-white shadow-lg shadow-slate-950/10 sm:p-6">
            <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-emerald-400/10 blur-2xl" />
            <div className="relative flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-emerald-300"><ShieldCheck className="h-5 w-5" /></span><h2 className="text-base font-black">{isVi ? "Chính sách Hội viên VIBE Sport" : "VIBE Sport member policies"}</h2></div>
            <div className="relative mt-5 space-y-3 text-xs leading-5 text-blue-100/85">
              <p className="flex gap-2"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />{isVi ? "Thời gian ân hạn gia hạn gói tập sau khi hết hạn: 72 giờ." : "Membership renewal grace period after expiry: 72 hours."}</p>
              <p className="flex gap-2"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />{isVi ? "Check-in mã QR tại quầy trước giờ tập." : "Check in with the QR code at reception before your session."}</p>
              <p className="flex gap-2"><CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />{isVi ? "Chính sách bảo lưu và hoàn phí áp dụng theo quy định của từng gói." : "Freeze and refund policies follow the terms of each membership package."}</p>
            </div>
          </section>
        </aside>}
      </div>
    </main>
  )
}

export default SettingsView
