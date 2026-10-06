import React, { useState } from "react"
import { useSCMS } from "../../context/SCMSContext"
import { PublicFooter } from "../layout/PublicFooter"
import { Reveal, Stagger, Item } from "../common/Reveal"
import { ArrowDown, ArrowRight, Menu, X } from "lucide-react"

const courses = [
  {
    id: "badminton",
    title: "Cầu lông",
    titleEn: "Badminton",
    description:
      "Rèn tốc độ, sự linh hoạt và khả năng phối hợp qua từng đường cầu.",
    descriptionEn: "Build speed, agility and coordination with every rally.",
    image:
      "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=85&w=900&auto=format&fit=crop",
  },
  {
    id: "table-tennis",
    title: "Bóng bàn",
    titleEn: "Table tennis",
    description: "Luyện phản xạ, sự tập trung và khả năng kiểm soát bóng.",
    descriptionEn: "Train your reflexes, focus and ball control.",
    image:
      "https://images.unsplash.com/photo-1611251135345-18c56206b863?q=85&w=900&auto=format&fit=crop",
  },
  {
    id: "pickleball",
    title: "Pickleball",
    titleEn: "Pickleball",
    description:
      "Môn thể thao năng động, dễ bắt đầu và vui khi chơi cùng nhau.",
    descriptionEn:
      "An energetic sport that is easy to pick up and fun to play together.",
    image:
      "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?q=85&w=900&auto=format&fit=crop",
  },
  {
    id: "basketball",
    title: "Bóng rổ",
    titleEn: "Basketball",
    description: "Phát triển kỹ thuật, thể lực và tinh thần phối hợp đồng đội.",
    descriptionEn: "Develop your skills, fitness and teamwork on the court.",
    image:
      "https://images.unsplash.com/photo-1546519638-68e109498ffc?q=85&w=900&auto=format&fit=crop",
  },
  {
    id: "volleyball",
    title: "Bóng chuyền",
    titleEn: "Volleyball",
    description:
      "Học cách di chuyển, chuyền bóng và phối hợp trong mỗi pha bóng.",
    descriptionEn: "Learn movement, passing and teamwork through every play.",
    image:
      "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?q=85&w=900&auto=format&fit=crop",
  },
  {
    id: "archery",
    title: "Bắn cung",
    titleEn: "Archery",
    description:
      "Rèn sự tập trung, tư thế và khả năng kiểm soát từng phát bắn.",
    descriptionEn: "Practice focus, form and control with every shot.",
    image:
      "https://images.unsplash.com/photo-1531415074968-036ba1b575da?q=85&w=900&auto=format&fit=crop",
  },
  {
    id: "shooting",
    title: "Bắn súng",
    titleEn: "Sport shooting",
    description: "Tập trung vào độ chính xác, sự bình tĩnh và kỷ luật an toàn.",
    descriptionEn: "Focus on precision, composure and safe sporting practice.",
    image:
      "https://images.unsplash.com/photo-1595590424283-b8f17842773f?q=85&w=900&auto=format&fit=crop",
  },
  {
    id: "football",
    title: "Bóng đá",
    titleEn: "Football",
    description:
      "Nâng cao kỹ năng với bóng, tư duy chiến thuật và tinh thần đồng đội.",
    descriptionEn:
      "Build ball skills, game awareness and a team-first mindset.",
    image:
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=85&w=900&auto=format&fit=crop",
  },
  {
    id: "tennis",
    title: "Tennis",
    titleEn: "Tennis",
    description:
      "Hoàn thiện kỹ thuật giao bóng, di chuyển và kiểm soát trận đấu.",
    descriptionEn:
      "Practice your serve, movement and control across the court.",
    image:
      "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=85&w=900&auto=format&fit=crop",
  },
]

const values = [
  {
    number: "01",
    title: "ĐA DẠNG MÔN HỌC",
    titleEn: "SPORTS FOR EVERY INTEREST",
    description:
      "Chín môn thể thao để bạn khám phá sở thích và tìm cách vận động phù hợp.",
    descriptionEn: "Nine sports to explore and find the way you love to move.",
  },
  {
    number: "02",
    title: "PHÁT TRIỂN TOÀN DIỆN",
    titleEn: "GROW THROUGH MOVEMENT",
    description:
      "Thể thao giúp bồi đắp thể lực, sự tự tin, tính kỷ luật và tinh thần đồng đội.",
    descriptionEn:
      "Build fitness, confidence, discipline and teamwork through sport.",
  },
  {
    number: "03",
    title: "HÀNH TRÌNH CỦA RIÊNG BẠN",
    titleEn: "YOUR OWN JOURNEY",
    description:
      "Bắt đầu từ môn học bạn yêu thích và tiến bộ theo nhịp độ của mình.",
    descriptionEn:
      "Start with a sport you enjoy and progress at your own pace.",
  },
]

const facilities = [
  {
    title: "Không gian tập luyện",
    titleEn: "Training spaces",
    image:
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?q=85&w=1100&auto=format&fit=crop",
  },
  {
    title: "Sân thể thao đa năng",
    titleEn: "Multi-sport courts",
    image:
      "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?q=85&w=1100&auto=format&fit=crop",
  },
  {
    title: "Cùng nhau vận động",
    titleEn: "Move together",
    image:
      "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?q=85&w=1100&auto=format&fit=crop",
  },
]

export function HomeLandingView({ onOpenLogin, onOpenRegister }) {
  const { language, setLanguage, staff } = useSCMS()
  const [menuOpen, setMenuOpen] = useState(false)
  const isVi = language === "vi"
  const coaches = staff
    .filter((member) => member.role === "coach" && member.status !== "inactive")
    .slice(0, 3)
  const navigation = [
    { href: "#about", label: isVi ? "Về chúng tôi" : "About" },
    { href: "#courses", label: isVi ? "Khóa học" : "Courses" },
    { href: "#coaches", label: isVi ? "Huấn luyện viên" : "Coaches" },
    { href: "#facilities", label: isVi ? "Cơ sở vật chất" : "Facilities" },
  ]

  return (
    <div className="min-h-screen bg-white font-mlc text-mlc-ink antialiased selection:bg-mlc-red selection:text-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-white focus:px-4 focus:py-3 focus:shadow-xl"
      >
        {isVi ? "Bỏ qua điều hướng" : "Skip to content"}
      </a>

      <header className="sticky top-0 z-50 border-b border-mlc-border bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <a
            href="#top"
            aria-label="SCMS Sports Center, trang chủ"
            className="flex items-center gap-3 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mlc-red"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-mlc-red text-sm font-black tracking-tight text-white shadow-mlc">
              S
            </span>
            <span className="leading-none">
              <span className="block text-base font-extrabold tracking-[0.06em] sm:text-lg">
                R E S I L I E N C E
              </span>
              <span className="mt-1 block text-[9px] font-semibold tracking-[0.2em] text-mlc-muted">
                SPORTS CENTER
              </span>
            </span>
          </a>

          <nav
            aria-label={isVi ? "Điều hướng chính" : "Main navigation"}
            className="hidden items-center gap-7 lg:flex"
          >
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-xs font-semibold text-mlc-ink transition-colors hover:text-mlc-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mlc-red"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
            <div
              className="flex items-center border-r border-mlc-border pr-3 text-xs font-semibold"
              aria-label={isVi ? "Ngôn ngữ" : "Language"}
            >
              <button
                type="button"
                aria-pressed={isVi}
                onClick={() => setLanguage("vi")}
                className={`px-1.5 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-mlc-red ${
                  isVi ? "text-mlc-red" : "text-mlc-muted hover:text-mlc-ink"
                }`}
              >
                VI
              </button>
              <span className="text-mlc-border" aria-hidden="true">
                /
              </span>
              <button
                type="button"
                aria-pressed={!isVi}
                onClick={() => setLanguage("en")}
                className={`px-1.5 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-mlc-red ${
                  !isVi ? "text-mlc-red" : "text-mlc-muted hover:text-mlc-ink"
                }`}
              >
                EN
              </button>
            </div>
            <button
              type="button"
              onClick={onOpenLogin}
              className="px-3 py-3 text-xs font-semibold text-mlc-ink transition-colors hover:text-mlc-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-mlc-red"
            >
              {isVi ? "Đăng nhập" : "Sign in"}
            </button>
            <button
              type="button"
              onClick={() => onOpenRegister()}
              className="rounded-full bg-mlc-red px-5 py-3 text-xs font-bold text-white shadow-mlc transition hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mlc-ink"
            >
              {isVi ? "Đăng ký ngay" : "Register now"}
            </button>
          </div>

          <div className="flex items-center gap-2 sm:hidden">
            <button
              type="button"
              onClick={() => setLanguage(isVi ? "en" : "vi")}
              className="rounded-full px-2 py-2 text-xs font-bold text-mlc-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-mlc-red"
              aria-label={isVi ? "Switch to English" : "Chuyển sang tiếng Việt"}
            >
              {isVi ? "EN" : "VI"}
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              aria-label={
                menuOpen
                  ? isVi
                    ? "Đóng menu"
                    : "Close menu"
                  : isVi
                    ? "Mở menu"
                    : "Open menu"
              }
              className="rounded-full p-2 text-mlc-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-mlc-red"
            >
              {menuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav
            id="mobile-navigation"
            aria-label={isVi ? "Điều hướng chính" : "Main navigation"}
            className="border-t border-mlc-border bg-white px-5 py-4 sm:hidden"
          >
            <div className="flex flex-col">
              {navigation.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="border-b border-mlc-border py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-mlc-red"
                >
                  {item.label}
                </a>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onOpenLogin()
                }}
                className="py-3 text-left text-sm font-semibold"
              >
                {isVi ? "Đăng nhập" : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onOpenRegister()
                }}
                className="rounded-full bg-mlc-red px-5 py-3 text-sm font-bold text-white"
              >
                {isVi ? "Đăng ký ngay" : "Register now"}
              </button>
            </div>
          </nav>
        )}
      </header>

      <main id="main-content">
        <section
          id="top"
          className="relative isolate flex min-h-[620px] scroll-mt-20 items-center overflow-hidden bg-mlc-ink text-white sm:min-h-[700px] lg:min-h-[calc(100svh-76px)]"
        >
          <img
            src="https://images.unsplash.com/photo-1526232761682-d26e03ac148e?q=90&w=2200&auto=format&fit=crop"
            alt=""
            fetchPriority="high"
            className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-mlc-ink/90 via-mlc-ink/65 to-mlc-ink/10" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-mlc-ink/50 via-transparent to-mlc-ink/15" />
          <div className="mx-auto w-full max-w-[1440px] px-5 py-24 sm:px-8 lg:px-12">
            <Reveal className="max-w-4xl">
              <p className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/85 sm:text-sm">
                <span className="h-0.5 w-10 bg-mlc-red" />
                {isVi ? "SCMS SPORTS CENTER" : "SCMS SPORTS CENTER"}
              </p>
              <h1 className="text-[clamp(3.25rem,9vw,7.5rem)] font-extrabold leading-[0.98] tracking-[-0.055em]">
                {isVi ? (
                  <>
                    RÈN BẢN LĨNH
                    <br />
                    <span className="text-mlc-red">VỮNG TƯƠNG LAI</span>
                  </>
                ) : (
                  <>
                    SHAPING RESILIENCE
                    <br />
                    <span className="text-mlc-red">THROUGH SPORTS</span>
                  </>
                )}
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-white/85 sm:text-lg sm:leading-8">
                {isVi
                  ? "Khám phá niềm vui vận động, phát triển kỹ năng và xây dựng tinh thần đồng đội qua những môn thể thao bạn yêu thích."
                  : "Discover the joy of movement, grow your skills and build teamwork through the sports you love."}
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#courses"
                  className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-mlc-red px-7 text-sm font-bold text-white shadow-mlc transition hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  {isVi ? "Khám phá khóa học" : "Explore courses"}{" "}
                  <ArrowDown className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => onOpenRegister()}
                  className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full border border-white/70 bg-white/10 px-7 text-sm font-bold text-white transition hover:bg-white hover:text-mlc-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  {isVi ? "Tạo tài khoản" : "Create an account"}{" "}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </Reveal>
          </div>
        </section>

        <div
          className="overflow-hidden border-b border-mlc-border bg-white py-5"
          role="region"
          aria-label={isVi ? "Các môn thể thao" : "Sports"}
        >
          <div className="sports-marquee-track flex w-max items-center hover:[animation-play-state:paused]">
            {[0, 1].map((copy) => (
              <div
                key={copy}
                className="flex shrink-0 items-center gap-8 px-5 text-xs font-semibold text-mlc-muted sm:gap-12 sm:px-8 sm:text-sm"
                aria-hidden={copy === 1 ? "true" : undefined}
              >
                {courses.map((course) => (
                  <span
                    key={course.id}
                    className="flex shrink-0 items-center gap-2 whitespace-nowrap"
                  >
                    <span className="h-2 w-2 rounded-full bg-mlc-red" />
                    {isVi ? course.title : course.titleEn}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <section
          id="about"
          className="scroll-mt-24 bg-mlc-surface py-20 sm:py-28"
        >
          <div className="mx-auto grid max-w-[1440px] gap-12 px-5 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20 lg:px-12">
            <Reveal>
              <p className="mb-5 text-xs font-bold uppercase tracking-[0.16em] text-mlc-red">
                {isVi ? "TẠI SAO CHỌN SCMS SPORTS" : "WHY CHOOSE SCMS SPORTS"}
              </p>
              <h2 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
                {isVi ? (
                  <>
                    LỚN LÊN CÙNG
                    <br />
                    <span className="text-mlc-red">THỂ THAO</span>
                  </>
                ) : (
                  <>
                    GROW STRONGER
                    <br />
                    <span className="text-mlc-red">THROUGH SPORT</span>
                  </>
                )}
              </h2>
              <p className="mt-6 max-w-xl text-base leading-7 text-mlc-muted">
                {isVi
                  ? "SCMS Sports Center mang đến môi trường để học viên khám phá các môn thể thao, rèn luyện sức khỏe và phát triển những kỹ năng đồng hành cùng mình trong cuộc sống."
                  : "SCMS Sports Center creates space to explore sports, build healthy habits and develop skills that carry into everyday life."}
              </p>
            </Reveal>
            <Stagger className="grid gap-4 sm:grid-cols-3">
              {values.map((value) => (
                <Item
                  key={value.number}
                  className="rounded-2xl border border-mlc-border bg-white p-5 shadow-sm sm:p-6"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-mlc-red/10 text-sm font-bold text-mlc-red">
                    {value.number}
                  </span>
                  <h3 className="mt-6 text-base font-bold leading-snug">
                    {isVi ? value.title : value.titleEn}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-mlc-muted">
                    {isVi ? value.description : value.descriptionEn}
                  </p>
                </Item>
              ))}
            </Stagger>
          </div>
        </section>

        <section id="courses" className="scroll-mt-24 bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
            <Reveal className="mb-10 flex flex-col justify-between gap-5 sm:mb-14 sm:flex-row sm:items-end">
              <div>
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-mlc-red">
                  {isVi ? "TÌM MÔN THỂ THAO CỦA BẠN" : "FIND YOUR SPORT"}
                </p>
                <h2 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
                  {isVi ? "9 KHÓA HỌC THỂ THAO" : "9 SPORTS COURSES"}
                </h2>
              </div>
              <p className="max-w-lg text-base leading-7 text-mlc-muted">
                {isVi
                  ? "Từ những môn phối hợp đồng đội đến thử thách cá nhân, hãy chọn hoạt động khiến bạn muốn quay lại sân tập."
                  : "From team play to individual challenges, choose an activity that makes you want to come back."}
              </p>
            </Reveal>
            <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course, index) => (
                <Item key={course.id}>
                  <article className="group h-full overflow-hidden rounded-2xl border border-mlc-border bg-white transition duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_-5px_rgba(227,22,40,0.18)]">
                    <div className="relative aspect-[4/3] overflow-hidden bg-mlc-surface">
                      <img
                        src={course.image}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <span className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xs font-bold text-mlc-red shadow-sm">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="p-5 sm:p-6">
                      <h3 className="text-xl font-bold">
                        {isVi ? course.title : course.titleEn}
                      </h3>
                      <p className="mt-2 min-h-[48px] text-sm leading-6 text-mlc-muted">
                        {isVi ? course.description : course.descriptionEn}
                      </p>
                    </div>
                  </article>
                </Item>
              ))}
            </Stagger>
          </div>
        </section>

        <section
          id="coaches"
          className="scroll-mt-24 bg-mlc-surface py-20 sm:py-28"
        >
          <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
            <Reveal className="mb-10 max-w-3xl sm:mb-14">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-mlc-red">
                {isVi ? "ĐỘI NGŨ HUẤN LUYỆN VIÊN" : "MEET THE COACHES"}
              </p>
              <h2 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
                {isVi
                  ? "NGƯỜI ĐỒNG HÀNH\nTRÊN SÂN TẬP"
                  : "COACHES WHO\nHELP YOU GROW"}
              </h2>
            </Reveal>
            {coaches.length > 0 ? (
              <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {coaches.map((coach, index) => (
                  <Item
                    key={coach.id}
                    className="overflow-hidden rounded-2xl border border-mlc-border bg-white"
                  >
                    <div className="relative flex aspect-[4/3] items-end overflow-hidden bg-mlc-ink p-5 text-white">
                      <img
                        src={`https://images.unsplash.com/${["photo-1560250097-0b93528c311a", "photo-1535713875002-d1d0cf377fde", "photo-1500648767791-00dcc994a43e"][index % 3]}?q=85&w=800&auto=format&fit=crop`}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover opacity-75"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-mlc-ink/80 to-transparent" />
                      <span className="relative rounded-full bg-white/95 px-4 py-2 text-xs font-semibold text-mlc-ink">
                        {coach.specialtyVi ||
                          coach.specialty ||
                          (isVi ? "Huấn luyện viên" : "Coach")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 p-5">
                      <div>
                        <h3 className="text-lg font-bold">{coach.name}</h3>
                        <p className="mt-1 text-sm text-mlc-muted">
                          {coach.activeClassesCount || 0}{" "}
                          {isVi ? "lớp đang phụ trách" : "active classes"}
                        </p>
                      </div>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mlc-red/10 text-mlc-red">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Item>
                ))}
              </Stagger>
            ) : (
              <p className="rounded-2xl border border-mlc-border bg-white p-6 text-sm text-mlc-muted">
                {isVi
                  ? "Thông tin huấn luyện viên sẽ sớm được cập nhật."
                  : "Coach profiles will be available soon."}
              </p>
            )}
          </div>
        </section>

        <section
          id="facilities"
          className="scroll-mt-24 bg-white py-20 sm:py-28"
        >
          <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
            <Reveal className="mb-10 max-w-3xl sm:mb-14">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-mlc-red">
                {isVi ? "KHÔNG GIAN THỂ THAO" : "SPORTS FACILITIES"}
              </p>
              <h2 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
                {isVi
                  ? "SẴN SÀNG CHO BẠN TỎA SÁNG"
                  : "A PLACE TO PLAY AND GROW"}
              </h2>
            </Reveal>
            <Stagger className="grid gap-5 md:grid-cols-3">
              {facilities.map((facility, index) => (
                <Item
                  key={facility.title}
                  className={`group relative min-h-[300px] overflow-hidden rounded-2xl bg-mlc-ink sm:min-h-[380px] ${
                    index === 1 ? "md:translate-y-8" : ""
                  }`}
                >
                  <img
                    src={facility.image}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-mlc-ink/80 via-mlc-ink/10 to-transparent" />
                  <h3 className="absolute bottom-5 left-5 right-5 text-xl font-bold text-white sm:bottom-7 sm:left-7">
                    {isVi ? facility.title : facility.titleEn}
                  </h3>
                </Item>
              ))}
            </Stagger>
          </div>
        </section>

        <section className="bg-mlc-red py-16 text-white sm:py-20">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-7 px-5 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
            <Reveal className="max-w-3xl">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
                {isVi ? "SẴN SÀNG BẮT ĐẦU?" : "READY TO GET STARTED?"}
              </p>
              <h2 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
                {isVi
                  ? "CHỌN MÔN BẠN YÊU THÍCH. BẮT ĐẦU HÔM NAY."
                  : "PICK YOUR SPORT. START TODAY."}
              </h2>
            </Reveal>
            <button
              type="button"
              onClick={() => onOpenRegister()}
              className="inline-flex min-h-14 shrink-0 items-center justify-center gap-3 self-start rounded-full bg-white px-7 text-sm font-bold text-mlc-red shadow-lg transition hover:bg-mlc-ink hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white md:self-center"
            >
              {isVi ? "Đăng ký ngay" : "Register now"}{" "}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
