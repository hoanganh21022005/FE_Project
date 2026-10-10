import React from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowRight, Mail, Phone } from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import { publicSports } from "../../data/publicCoaches"

export function CoachEnrollmentFooter({ defaultSportId = "" }) {
  const { language } = useSCMS()
  const isVi = language === "vi"
  const navigate = useNavigate()
  const handleSubmit = (event) => {
    event.preventDefault()
    const enrollment = Object.fromEntries(new FormData(event.currentTarget))
    navigate("/register", { state: { enrollment } })
  }

  return (
    <footer id="enrollment" className="coaches-contact scroll-mt-24">
      <div className="coaches-contact-inner">
        <div className="coaches-contact-info">
          <Link to="/" className="inline-block">
            <img src="/images/vibe-sport-logo.png?v=2" alt="VIBE Sport" width="144" height="96" className="h-24 w-36 object-contain" />
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-7 text-white/60">
            {isVi ? "Vitality · Inspire · Balance · Energy. Cùng VIBE Sport tìm môn thể thao bạn yêu thích và bắt đầu hành trình của riêng mình." : "Vitality · Inspire · Balance · Energy. Find the sport you love and start your own journey with VIBE Sport."}
          </p>
          <div className="mt-10 grid gap-10 sm:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="font-display text-xl font-bold uppercase">{isVi ? "Thông tin liên hệ" : "Contact us"}</h2>
              <a href="tel:18006995" className="mt-5 flex items-start gap-3 text-sm leading-6 text-white/80 hover:text-white">
                <Phone className="mt-1 h-4 w-4 shrink-0 text-mlc-red" />
                <span>1800 6995</span>
              </a>
              <a href="mailto:memberrelations@scms.vn" className="mt-4 flex items-start gap-3 text-sm leading-6 text-white/80 hover:text-white">
                <Mail className="mt-1 h-4 w-4 shrink-0 text-mlc-red" />
                <span className="break-all">memberrelations@scms.vn</span>
              </a>
            </div>
            <nav aria-label={isVi ? "Liên kết cuối trang" : "Footer links"}>
              <h2 className="font-display text-xl font-bold uppercase">{isVi ? "Liên kết" : "Explore"}</h2>
              <ul className="mt-5 space-y-3 text-sm text-white/80">
                {[["/", "Trang chủ", "Home"], ["/about", "Về chúng tôi", "About us"], ["/#courses", "Khóa học", "Courses"], ["/coaches", "Huấn luyện viên", "Coaches"], ["/#facilities", "Cơ sở vật chất", "Facilities"]].map(([href, vi, en]) => (
                  <li key={href}><Link to={href} className="hover:text-white">{isVi ? vi : en}</Link></li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
        <div className="coaches-contact-form-wrap">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">YOUR NEXT MOVE</span>
          <h2 className="mb-7 mt-3 font-display text-4xl font-extrabold uppercase sm:text-5xl">{isVi ? "Tư vấn ghi danh" : "Start your journey"}</h2>
          <form onSubmit={handleSubmit} className="coaches-enrollment-form">
            <label>
              <span className="sr-only">{isVi ? "Họ và tên" : "Full name"}</span>
              <input name="name" autoComplete="name" placeholder={isVi ? "Họ và tên *" : "Full name *"} required minLength={2} maxLength={100} />
            </label>
            <label>
              <span className="sr-only">{isVi ? "Số điện thoại" : "Phone number"}</span>
              <input name="phone" type="tel" autoComplete="tel" placeholder={isVi ? "Số điện thoại *" : "Phone number *"} required pattern="(0|\+84)[0-9]{8,10}" maxLength={16} title={isVi ? "Nhập số điện thoại bắt đầu bằng 0 hoặc +84, không có khoảng trắng." : "Enter a phone number starting with 0 or +84, without spaces."} />
            </label>
            <label>
              <span className="sr-only">Email</span>
              <input name="email" type="email" autoComplete="email" placeholder="Email *" required maxLength={254} />
            </label>
            <label>
              <span className="sr-only">{isVi ? "Môn học" : "Sport"}</span>
              <select name="sportId" required defaultValue={defaultSportId}>
                <option value="" disabled>{isVi ? "Môn học *" : "Choose a sport *"}</option>
                {publicSports.map((sport) => <option key={sport.id} value={sport.id}>{isVi ? sport.title : sport.titleEn}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">{isVi ? "Độ tuổi học viên" : "Student age"}</span>
              <input name="age" type="number" inputMode="numeric" min={1} max={120} step={1} placeholder={isVi ? "Độ tuổi học viên *" : "Student age *"} required />
            </label>
            <button type="submit" className="coaches-enrollment-submit">
              {isVi ? "Đăng ký ngay" : "Get started"}<ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-2 text-center text-xs leading-6 text-white/80">{isVi ? "Tiếp tục tạo tài khoản với thông tin đã nhập để hoàn tất đăng ký." : "Continue to create your account using these details to complete registration."}</p>
          </form>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1440px] flex-wrap justify-between gap-3 border-t border-white/15 px-5 py-5 text-xs text-white/55 sm:px-8 lg:px-12">
        <span>© {new Date().getFullYear()} VIBE Sport</span>
        <Link to="/privacy-policy" className="hover:text-white">{isVi ? "Chính sách bảo mật" : "Privacy policy"}</Link>
      </div>
    </footer>
  )
}
