import React from "react"
import { useSCMS } from "../../context/SCMSContext"

const courseNames = [
  ["Cầu lông", "Badminton"],
  ["Bóng bàn", "Table tennis"],
  ["Pickleball", "Pickleball"],
  ["Bóng rổ", "Basketball"],
  ["Bóng chuyền", "Volleyball"],
  ["Bắn cung", "Archery"],
  ["Bắn súng", "Sport shooting"],
  ["Bóng đá", "Football"],
  ["Tennis", "Tennis"],
]

export function PublicFooter() {
  const { language } = useSCMS()
  const isVi = language === "vi"

  return (
    <footer className="bg-[#181d25] py-14 text-white sm:py-16">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <div className="grid gap-10 border-b border-white/15 pb-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <a
              href="/#top"
              className="inline-flex items-center gap-3 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e31628] text-xs font-black">
                SC
              </span>
              <span>
                <span className="block text-sm font-bold tracking-wider">
                  SCMS SPORTS
                </span>
                <span className="mt-1 block text-[9px] font-medium tracking-[0.2em] text-white/60">
                  SPORTS CENTER
                </span>
              </span>
            </a>
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
              {courseNames.map(([vi, en]) => (
                <li key={vi}>
                  <a
                    href="/#courses"
                    className="transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  >
                    {isVi ? vi : en}
                  </a>
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
                <a
                  href="/#about"
                  className="transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {isVi ? "Về SCMS Sports" : "About SCMS Sports"}
                </a>
              </li>
              <li>
                <a
                  href="/#coaches"
                  className="transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {isVi ? "Huấn luyện viên" : "Coaches"}
                </a>
              </li>
              <li>
                <a
                  href="/#facilities"
                  className="transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {isVi ? "Cơ sở vật chất" : "Facilities"}
                </a>
              </li>
              <li>
                <a
                  href="/privacy-policy"
                  className="transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {isVi ? "Chính sách bảo mật" : "Privacy policy"}
                </a>
              </li>
              <li>
                <a
                  href="/register"
                  className="font-semibold text-white transition-colors hover:text-[#ff6671] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  {isVi ? "Đăng ký tài khoản" : "Create an account"}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-6 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <span>© SCMS Sports Center 2026</span>
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
