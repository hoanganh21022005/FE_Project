import React, { useState } from "react"
import {
  UserCheck,
  Mail,
  Phone,
  Award,
  Calendar,
  MessageSquare,
  Clock,
  Star,
  CheckCircle2,
  Sparkles,
  Send,
  Dumbbell,
} from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"

export function MemberMyCoachView() {
  const { language } = useSCMS()
  const isVi = language === "vi"

  const [message, setMessage] = useState("")
  const [sentSuccess, setSentSuccess] = useState(false)

  // Example assigned coach data (can be mapped from SCMSContext / API)
  const coach = {
    name: "Nguyễn Văn Hùng",
    titleVi: "Huấn luyện viên Thể hình & Boxing Cao cấp",
    titleEn: "Senior Fitness & Boxing Coach",
    rating: 4.9,
    reviewCount: 128,
    phone: "0912 345 678",
    email: "hung.coach@scms.com",
    avatar:
      "https://images.unsplash.com/photo-1567013127542-490d757e51fc?w=300&auto=format&fit=crop&q=80",
    specialties: [
      "Strength Training",
      "Boxing & Kickfit",
      "Cardio Conditioning",
      "Nutrition",
    ],
    bioVi:
      "Hơn 7 năm kinh nghiệm huấn luyện thể chất chuyên sâu, từng đạt HCB Cúp các CLB Boxing toàn quốc.",
    bioEn:
      "Over 7 years of specialized conditioning experience, former national boxing club medalist.",
    workingDays: isVi
      ? "Thứ 2 - Thứ 7 (07:00 - 20:00)"
      : "Mon - Sat (07:00 - 20:00)",
  }

  const trainingFocus = [
    {
      targetVi: "Tăng sức bền & thể lực cốt lõi",
      targetEn: "Endurance & Core Conditioning",
      progress: 75,
      frequency: isVi ? "3 buổi / tuần" : "3 sessions / week",
    },
    {
      targetVi: "Cải thiện kỹ thuật đòn đấm & phản xạ",
      targetEn: "Punch Technique & Reaction",
      progress: 60,
      frequency: isVi ? "2 buổi / tuần" : "2 sessions / week",
    },
  ]

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!message.trim()) return
    setSentSuccess(true)
    setMessage("")
    setTimeout(() => setSentSuccess(false), 4000)
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-7 sm:py-8">
      {/* Header */}
      <header>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-red-700">
          VIBE SPORT · MEMBER
        </p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">
          {isVi ? "Huấn luyện viên của tôi" : "My Assigned Coach"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {isVi
            ? "Thông tin HLV cá nhân phụ trách lộ trình tập luyện và mục tiêu thể chất của bạn."
            : "Details about your dedicated coach overseeing your fitness roadmap."}
        </p>
      </header>

      {/* Coach Profile Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-stone-900 via-slate-900 to-stone-950 p-6 text-white sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <img
              src={coach.avatar}
              alt={coach.name}
              className="h-24 w-24 rounded-2xl border-2 border-red-500/80 object-cover shadow-md shrink-0 sm:h-28 sm:w-28"
            />
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-red-600/30 px-3 py-1 text-xs font-bold text-red-300 border border-red-500/40">
                  <UserCheck className="w-3.5 h-3.5" />
                  {isVi ? "HLV Phụ Trách Chính" : "Lead Coach"}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  {coach.rating} ({coach.reviewCount}{" "}
                  {isVi ? "đánh giá" : "reviews"})
                </span>
              </div>

              <h2 className="text-2xl font-black tracking-tight text-white">
                {coach.name}
              </h2>
              <p className="text-sm text-stone-300 font-medium">
                {isVi ? coach.titleVi : coach.titleEn}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-stone-400 pt-1">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-stone-300" />
                  {coach.phone}
                </span>
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-stone-300" />
                  {coach.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-stone-300" />
                  {coach.workingDays}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Coach Details & Specialties */}
        <div className="grid gap-6 p-6 sm:grid-cols-2 sm:p-8">
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm uppercase tracking-wider">
              <Award className="w-4 h-4 text-red-700" />
              {isVi ? "Chuyên môn & Thế mạnh" : "Specialties"}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isVi ? coach.bioVi : coach.bioEn}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {coach.specialties.map((spec, idx) => (
                <span
                  key={idx}
                  className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  {spec}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm uppercase tracking-wider">
              <Dumbbell className="w-4 h-4 text-red-700" />
              {isVi
                ? "Mục tiêu tập luyện được giao"
                : "Assigned Training Focus"}
            </h3>
            <div className="space-y-3">
              {trainingFocus.map((focus, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-3.5"
                >
                  <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                    <span>{isVi ? focus.targetVi : focus.targetEn}</span>
                    <span className="text-red-700 font-mono">
                      {focus.progress}%
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-red-600 rounded-full"
                      style={{ width: `${focus.progress}%` }}
                    />
                  </div>
                  <span className="mt-1.5 block text-[11px] text-slate-500 font-medium">
                    {focus.frequency}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Message Coach Section */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-2.5 text-slate-900 font-bold">
          <MessageSquare className="w-5 h-5 text-red-700" />
          <h2 className="text-lg">
            {isVi ? "Gửi lời nhắn cho Huấn luyện viên" : "Message your Coach"}
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {isVi
            ? "Trao đổi trước về mục tiêu buổi tập tiếp theo hoặc thông báo dời lịch tập riêng."
            : "Chat about your next session goals or request a schedule adjustment."}
        </p>

        {sentSuccess && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {isVi
                ? "Tin nhắn đã được gửi thành công! HLV sẽ phản hồi trong thời gian sớm nhất."
                : "Message sent successfully! Your coach will respond shortly."}
            </span>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="mt-4 space-y-3">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder={
              isVi
                ? "Nhập nội dung cần trao đổi với HLV Nguyễn Văn Hùng..."
                : "Type your message to coach Nguyen Van Hung..."
            }
            className="w-full rounded-xl border border-slate-200 p-3.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all resize-none"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!message.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isVi ? "Gửi tin nhắn" : "Send message"}</span>
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}

export default MemberMyCoachView
