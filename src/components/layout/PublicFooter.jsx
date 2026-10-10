import React from "react"
import { Link } from "react-router-dom"
import { useSCMS } from "../../context/SCMSContext"
import { publicSports } from "../../data/publicCoaches"

export function PublicFooter() {
  const { language } = useSCMS()
  const isVi = language === "vi"

  return (
    <footer className="bg-mlc-ink py-14 text-white sm:py-16">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="grid gap-10 border-b border-white/15 pb-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <Link
              to="/#top"
              className="inline-flex items-center gap-3 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <img
                src="/images/vibe-sport-logo.png?v=2"
                alt="Vibe Sport"
                className="h-20 w-32 shrink-0 object-contain"
              />
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-6 text-white/65">
              {isVi
                ? "Khám phá các môn thể thao, xây dựng kỹ năng và phát triển qua từng buổi tập."
                : "Explore sports, build skills and grow through every session."}
            </p>
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.15em]">
              {isVi ? "KHÓA HỌC" : "COURSES"}
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-white/65">
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
          </div>

          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.15em]">
              {isVi ? "KHÁM PHÁ" : "EXPLORE"}
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-white/65">
              <li>
                <Link
                  to="/about"
                  className="transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {isVi ? "Về VIBE Sport" : "About VIBE Sport"}
                </Link>
              </li>
              <li>
                <Link
                  to="/coaches"
                  className="transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {isVi ? "Huấn luyện viên" : "Coaches"}
                </Link>
              </li>
              <li>
                <Link
                  to="/#facilities"
                  className="transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {isVi ? "Cơ sở vật chất" : "Facilities"}
                </Link>
              </li>
              <li>
                <Link
                  to="/privacy-policy"
                  className="transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {isVi ? "Chính sách bảo mật" : "Privacy policy"}
                </Link>
              </li>
              <li>
                <Link
                  to="/register"
                  className="font-semibold text-white transition-colors hover:text-mlc-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {isVi ? "Đăng ký tài khoản" : "Create an account"}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <span>VIBE Sport 2026</span>
          <span>
            {isVi
              ? "Vận động hôm nay, trưởng thành mỗi ngày."
              : "Move today. Grow every day."}
          </span>
        </div>
      </div>
    </footer>
  )
}
