import React from "react"
import { Link } from "react-router-dom"
import { ArrowUpRight, Mail, Phone } from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import { publicSports } from "../../data/publicCoaches"

const exploreLinks = [
  ["/about", "Về VIBE Sport", "About VIBE Sport"],
  ["/coaches", "Huấn luyện viên", "Coaches"],
  ["/facilities", "Cơ sở vật chất", "Facilities"],
  ["/privacy-policy", "Chính sách bảo mật", "Privacy policy"],
]

export function PublicFooter() {
  const { language } = useSCMS()
  const isVi = language === "vi"

  return (
    <footer className="relative overflow-hidden bg-[#151a22] text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="mx-auto max-w-[1440px] px-5 pb-7 pt-14 sm:px-8 sm:pt-16 lg:px-12 lg:pt-20">
        <div className="grid gap-11 border-b border-white/10 pb-11 sm:grid-cols-2 xl:grid-cols-[1.1fr_1.35fr_0.8fr_1fr] xl:gap-12 xl:pb-14">
          <section>
            <Link
              to="/"
              aria-label={isVi ? "VIBE Sport, về trang chủ" : "VIBE Sport, home"}
              className="inline-flex rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <img
                src="/images/MainPage/vibe-sport-logo.png?v=4"
                alt="VIBE Sport"
                className="h-12 w-auto object-contain object-left sm:h-14"
              />
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-7 text-white/65">
              {isVi
                ? "Vitality · Inspire · Balance · Energy. Cùng VIBE Sport tìm môn thể thao bạn yêu thích và phát triển qua từng buổi tập."
                : "Vitality · Inspire · Balance · Energy. Find the sport you love and grow through every training session."}
            </p>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-white/40">
              {isVi ? "Vận động hôm nay, trưởng thành mỗi ngày." : "Move today. Grow every day."}
            </p>
          </section>

          <nav aria-label={isVi ? "Các môn học" : "Sports courses"}>
            <h2 className="text-xs font-extrabold uppercase tracking-[0.18em] text-white">
              {isVi ? "Môn thể thao" : "Sports"}
            </h2>
            <ul className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 text-sm text-white/65">
              {publicSports.map((sport) => (
                <li key={sport.id}>
                  <Link
                    to={`/courses/${sport.id}`}
                    className="transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    {isVi ? sport.title : sport.titleEn}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label={isVi ? "Khám phá VIBE Sport" : "Explore VIBE Sport"}>
            <h2 className="text-xs font-extrabold uppercase tracking-[0.18em] text-white">
              {isVi ? "Khám phá" : "Explore"}
            </h2>
            <ul className="mt-5 space-y-3 text-sm text-white/65">
              {exploreLinks.map(([href, vi, en]) => (
                <li key={href}>
                  <Link
                    to={href}
                    className="inline-flex items-center gap-1 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    {isVi ? vi : en}
                    <ArrowUpRight className="h-3.5 w-3.5 opacity-50" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <section id="contact-info" className="scroll-mt-28">
            <h2 className="text-xs font-extrabold uppercase tracking-[0.18em] text-white">
              {isVi ? "Liên hệ với chúng tôi" : "Get in touch"}
            </h2>
            <p className="mt-5 text-sm leading-6 text-white/60">
              {isVi
                ? "Cần hỗ trợ? Liên hệ đội ngũ VIBE Sport qua điện thoại hoặc email."
                : "Need help? Contact the VIBE Sport team by phone or email."}
            </p>
            <a
              href="tel:18006995"
              className="mt-4 flex min-h-11 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-white/85 transition hover:border-mlc-red/60 hover:bg-white/[0.08] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Phone className="h-4 w-4 shrink-0 text-mlc-red" aria-hidden="true" />
              <span>1800 6995</span>
            </a>
            <a
              href="mailto:memberrelations@scms.vn"
              className="mt-2 flex min-h-11 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-white/85 transition hover:border-mlc-red/60 hover:bg-white/[0.08] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Mail className="h-4 w-4 shrink-0 text-mlc-red" aria-hidden="true" />
              <span className="break-all">memberrelations@scms.vn</span>
            </a>
          </section>
        </div>

        <div className="flex flex-col gap-3 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} VIBE Sport</span>
          <span>{isVi ? "Trân trọng đồng hành cùng hành trình vận động của bạn." : "Here for every step of your sporting journey."}</span>
        </div>
      </div>
    </footer>
  )
}
