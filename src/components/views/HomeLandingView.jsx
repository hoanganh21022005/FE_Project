import React, { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useReducedMotion } from "motion/react"
import { useSCMS } from "../../context/SCMSContext"
import { publicCourses } from "../../data/publicCourses"
import { PublicFooter } from "../layout/PublicFooter"
import { Reveal, Stagger, Item } from "../common/Reveal"
import { ArrowDown, ArrowRight, ChevronDown, Menu, X } from "lucide-react"
import "../../styles/coaches.css"
import "../../styles/home-facilities.css"

const heroSlogan = ["Vitality", "Inspire", "Balance", "Energy"]

const courses = [
  {
    id: "badminton",
    title: "Cầu lông",
    titleEn: "Badminton",
    description:
      "Rèn tốc độ, sự linh hoạt và khả năng phối hợp qua từng đường cầu.",
    descriptionEn: "Build speed, agility and coordination with every rally.",
    image: "/images/MainPage/home-badminton.png",
  },
  {
    id: "table-tennis",
    title: "Bóng bàn",
    titleEn: "Table tennis",
    description: "Luyện phản xạ, sự tập trung và khả năng kiểm soát bóng.",
    descriptionEn: "Train your reflexes, focus and ball control.",
    image: "/images/MainPage/table-tennis-room.png",
  },
  {
    id: "pickleball",
    title: "Pickleball",
    titleEn: "Pickleball",
    description:
      "Môn thể thao năng động, dễ bắt đầu và vui khi chơi cùng nhau.",
    descriptionEn:
      "An energetic sport that is easy to pick up and fun to play together.",
    image: "/images/MainPage/home-pickleball.png",
  },
  {
    id: "basketball",
    title: "Bóng rổ",
    titleEn: "Basketball",
    description: "Phát triển kỹ thuật, thể lực và tinh thần phối hợp đồng đội.",
    descriptionEn: "Develop your skills, fitness and teamwork on the court.",
    image: "/images/MainPage/home-basketball.png",
  },
  {
    id: "volleyball",
    title: "Bóng chuyền",
    titleEn: "Volleyball",
    description:
      "Học cách di chuyển, chuyền bóng và phối hợp trong mỗi pha bóng.",
    descriptionEn: "Learn movement, passing and teamwork through every play.",
    image: "/images/MainPage/home-volleyball.jpeg",
  },
  {
    id: "archery",
    title: "Bắn cung",
    titleEn: "Archery",
    description:
      "Rèn sự tập trung, tư thế và khả năng kiểm soát từng phát bắn.",
    descriptionEn: "Practice focus, form and control with every shot.",
    image: "/images/MainPage/home-archery.png",
  },
  {
    id: "swimming",
    title: "Bơi lội",
    titleEn: "Swimming",
    description: "Rèn kỹ thuật bơi, điều hòa nhịp thở và nâng cao thể lực trong môi trường nước.",
    descriptionEn: "Build swimming technique, breathing control and fitness in the water.",
    image: "/images/MainPage/home-swimming.png",
  },
  {
    id: "football",
    title: "Bóng đá",
    titleEn: "Football",
    description:
      "Nâng cao kỹ năng với bóng, tư duy chiến thuật và tinh thần đồng đội.",
    descriptionEn:
      "Build ball skills, game awareness and a team-first mindset.",
    image: "/images/MainPage/home-football.png",
  },
  {
    id: "tennis",
    title: "Quần vợt",
    titleEn: "Tennis",
    description:
      "Hoàn thiện kỹ thuật giao bóng, di chuyển và kiểm soát trận đấu.",
    descriptionEn:
      "Practice your serve, movement and control across the court.",
    image: "/images/MainPage/home-tennis.png",
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

export function HomeLandingView({ onOpenLogin }) {
  const { language, setLanguage } = useSCMS()
  const prefersReducedMotion = useReducedMotion()
  const heroVideoRef = useRef(null)
  const heroMotionPaused = Boolean(prefersReducedMotion)
  const [menuOpen, setMenuOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState(null)
  const [activeCourse, setActiveCourse] = useState("all")
  const headerRef = useRef(null)
  const dropdownTriggerRefs = useRef({})
  const isVi = language === "vi"

  useEffect(() => {
    const video = heroVideoRef.current
    if (!video) return
    if (heroMotionPaused) {
      video.pause()
    } else {
      video.play().catch(() => {
        // Keep the local poster visible if the browser blocks autoplay.
      })
    }
  }, [heroMotionPaused])

  useEffect(() => {
    if (!openDropdown) return undefined

    const handlePointerDown = (event) => {
      if (!headerRef.current?.contains(event.target)) setOpenDropdown(null)
    }
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpenDropdown(null)
        dropdownTriggerRefs.current[openDropdown]?.focus()
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [openDropdown])

  const visibleCourses =
    activeCourse === "all"
      ? courses
      : courses.filter((course) => course.id === activeCourse)
  const navigation = [
    {
      href: "#top",
      label: isVi ? "Trang chủ" : "Home",
      isHome: true,
    },
    {
      href: "/about",
      label: isVi ? "Về chúng tôi" : "About us",
    },
    {
      id: "courses",
      label: isVi ? "Khóa học" : "Courses",
      children: [
        { href: "#courses", courseId: "all", label: isVi ? "Tất cả" : "All" },
        ...courses.map((course) => ({
          href: `/courses/${course.id}`,
          label: isVi ? course.title : course.titleEn,
        })),
      ],
    },
    { href: "/coaches", label: isVi ? "Huấn luyện viên" : "Coaches" },
    { href: "/facilities", label: isVi ? "Cơ sở vật chất" : "Facilities" },
  ]

  return (
    <div className="min-h-screen bg-white font-mlc text-mlc-ink antialiased selection:bg-mlc-red selection:text-white">
      <Link
        to="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-white focus:px-4 focus:py-3 focus:shadow-xl"
      >
        {isVi ? "Bỏ qua điều hướng" : "Skip to content"}
      </Link>

      <header ref={headerRef} className="sticky top-0 z-50 border-b border-mlc-border bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <Link
            to="#top"
            aria-label="Vibe Sport, trang chủ"
            className="flex items-center gap-3 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mlc-red"
          >
            <img
              src="/images/MainPage/vibe-sport-logo.png?v=4"
              alt="Vibe Sport"
              className="h-11 w-auto shrink-0 object-contain sm:h-14"
            />
          </Link>

          <nav
            aria-label={isVi ? "Điều hướng chính" : "Main navigation"}
            className="hidden items-center gap-4 lg:flex xl:gap-7"
          >
            {navigation.map((item) =>
              item.children ? (
                <div key={item.id} className="relative">
                  <button
                    ref={(node) => {
                      if (node) dropdownTriggerRefs.current[item.id] = node
                      else delete dropdownTriggerRefs.current[item.id]
                    }}
                    type="button"
                    aria-expanded={openDropdown === item.id}
                    aria-controls={`desktop-${item.id}-dropdown`}
                    onClick={() =>
                      setOpenDropdown((open) => (open === item.id ? null : item.id))
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold text-mlc-ink transition-colors hover:text-mlc-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mlc-red"
                  >
                    {item.label}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${openDropdown === item.id ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </button>
                  {openDropdown === item.id && (
                    <div
                      id={`desktop-${item.id}-dropdown`}
                      className="absolute left-0 top-full z-50 mt-3 max-h-[70vh] min-w-56 overflow-y-auto border border-mlc-border bg-white p-2 shadow-xl"
                    >
                      {item.children.map((child) => (
                        <Link
                          key={child.courseId || child.href}
                          to={child.href}
                          aria-current={
                            child.courseId && child.courseId === activeCourse
                              ? "true"
                              : undefined
                          }
                          onClick={() => {
                            if (child.courseId) setActiveCourse(child.courseId)
                            setOpenDropdown(null)
                          }}
                          className={`block whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors hover:bg-mlc-surface hover:text-mlc-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-mlc-red ${
                            child.courseId && child.courseId === activeCourse
                              ? "bg-mlc-surface text-mlc-red"
                              : "text-mlc-ink"
                          }`}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={item.href}
                  to={item.href}
                  aria-current={item.isHome ? "page" : undefined}
                  onClick={() => setOpenDropdown(null)}
                  className={`text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mlc-red ${
                    item.isHome
                      ? "-skew-x-6 bg-mlc-red px-4 py-3 text-white shadow-mlc hover:bg-brand-primary-hover hover:text-white"
                      : "text-mlc-ink hover:text-mlc-red"
                  }`}
                >
                  <span className={item.isHome ? "inline-block skew-x-6" : ""}>
                    {item.label}
                  </span>
                </Link>
              ),
            )}
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
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setLanguage(isVi ? "en" : "vi")}
              className="rounded-full px-2 py-2 text-xs font-bold text-mlc-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-mlc-red sm:hidden"
              aria-label={isVi ? "Switch to English" : "Chuyển sang tiếng Việt"}
            >
              {isVi ? "EN" : "VI"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen((open) => !open)
                setOpenDropdown(null)
              }}
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
            className="max-h-[calc(100dvh-76px)] overflow-y-auto border-t border-mlc-border bg-white px-5 py-4 lg:hidden"
          >
            <div className="flex flex-col">
              {navigation.map((item) =>
                item.children ? (
                  <div key={item.id} className="border-b border-mlc-border">
                    <button
                      ref={(node) => {
                        if (node) dropdownTriggerRefs.current[item.id] = node
                        else delete dropdownTriggerRefs.current[item.id]
                      }}
                      type="button"
                      aria-expanded={openDropdown === item.id}
                      aria-controls={`mobile-${item.id}-dropdown`}
                      onClick={() =>
                        setOpenDropdown((open) => (open === item.id ? null : item.id))
                      }
                      className="flex w-full items-center justify-between py-3 text-left text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-mlc-red"
                    >
                      {item.label}
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${openDropdown === item.id ? "rotate-180" : ""}`}
                        aria-hidden="true"
                      />
                    </button>
                    {openDropdown === item.id && (
                      <div id={`mobile-${item.id}-dropdown`} className="pb-2 pl-3">
                        {item.children.map((child) => (
                          <Link
                            key={child.courseId || child.href}
                            to={child.href}
                            aria-current={
                              child.courseId && child.courseId === activeCourse
                                ? "true"
                                : undefined
                            }
                            onClick={() => {
                              if (child.courseId) setActiveCourse(child.courseId)
                              setOpenDropdown(null)
                              setMenuOpen(false)
                            }}
                            className={`block px-3 py-2.5 text-sm transition-colors hover:text-mlc-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-mlc-red ${
                              child.courseId && child.courseId === activeCourse
                                ? "font-semibold text-mlc-red"
                                : "text-mlc-muted"
                            }`}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    key={item.href}
                    to={item.href}
                    aria-current={item.isHome ? "page" : undefined}
                    onClick={() => {
                      setMenuOpen(false)
                      setOpenDropdown(null)
                    }}
                    className={`border-b border-mlc-border py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-mlc-red ${
                      item.isHome
                        ? "bg-mlc-red px-3 text-white"
                        : "text-mlc-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                ),
              )}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onOpenLogin()
                }}
                className="py-3 text-left text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mlc-red"
              >
                {isVi ? "Đăng nhập" : "Sign in"}
              </button>
            </div>
          </nav>
        )}
      </header>

      <main id="main-content">
        <section
          id="top"
          data-paused={heroMotionPaused}
          className="vibe-hero relative isolate flex min-h-[620px] scroll-mt-20 items-center overflow-hidden bg-mlc-ink text-white sm:min-h-[700px] lg:min-h-[calc(100svh-76px)]"
        >
          <video
            ref={heroVideoRef}
            className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover object-center"
            autoPlay={!heroMotionPaused}
            loop
            muted
            playsInline
            preload="auto"
            poster="/videos/vibe-sport-poster.jpg"
            aria-hidden="true"
          >
            <source src="/videos/vibe-sport-montage-1080p.mp4?v=2" type="video/mp4" />
          </video>
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-mlc-ink/90 via-mlc-ink/65 to-mlc-ink/10" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-mlc-ink/50 via-transparent to-mlc-ink/15" />
          <div className="vibe-hero-accent" aria-hidden="true" />
          <div className="mx-auto w-full max-w-[1440px] px-5 py-24 sm:px-8 lg:px-12">
            <Reveal className="max-w-4xl">
              <p className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/85 sm:text-sm">
                <span className="h-0.5 w-10 bg-mlc-red" />
                VIBE SPORT
              </p>
              <h1 className="text-[clamp(3.75rem,12vw,10rem)] font-extrabold leading-[1.08] tracking-[0.02em]">
                <span className="sr-only">Vitality · Inspire · Balance · Energy</span>
                <span className="vibe-slogan-stage" aria-hidden="true">
                  {heroSlogan.map((word, index) => (
                    <span
                      key={word}
                      className="vibe-slogan-word"
                      data-pause-visible={index === 0}
                      style={{ animationDelay: `${index * 3}s` }}
                    >
                      {word}
                    </span>
                  ))}
                </span>
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-white/85 sm:text-lg sm:leading-8">
                {isVi
                  ? "Khám phá niềm vui vận động, phát triển kỹ năng và xây dựng tinh thần đồng đội qua những môn thể thao bạn yêu thích."
                  : "Discover the joy of movement, grow your skills and build teamwork through the sports you love."}
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="#courses"
                  className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-mlc-red px-7 text-sm font-bold text-white shadow-mlc transition hover:bg-brand-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  {isVi ? "Khám phá khóa học" : "Explore courses"}{" "}
                  <ArrowDown className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        <div
          className="overflow-hidden border-b border-mlc-border bg-mlc-red py-5"
          role="region"
          aria-label={isVi ? "Các môn thể thao" : "Sports"}
        >
          <div className="sports-marquee-track flex w-max items-center hover:[animation-play-state:paused]">
            {[0, 1].map((copy) => (
              <div
                key={copy}
                className="flex shrink-0 items-center gap-10 px-6 text-lg font-bold uppercase tracking-wider text-white sm:gap-14 sm:px-10 sm:text-xl"
                aria-hidden={copy === 1 ? "true" : undefined}
              >
                {courses.map((course) => (
                  <React.Fragment key={course.id}>
                    <span className="flex shrink-0 items-center whitespace-nowrap">
                      {isVi ? course.title : course.titleEn}
                    </span>
                    <span className="text-white/40 select-none" aria-hidden="true">
                      /
                    </span>
                  </React.Fragment>
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
                {isVi ? "TẠI SAO CHỌN VIBE SPORT" : "WHY CHOOSE VIBE SPORT"}
              </p>
              <h2 className="text-4xl font-extrabold leading-[1.22] tracking-normal sm:text-6xl sm:leading-[1.18]">
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
                  ? "VIBE Sport mang đến môi trường để học viên khám phá các môn thể thao, rèn luyện sức khỏe và phát triển những kỹ năng đồng hành cùng mình trong cuộc sống."
                  : "VIBE Sport creates space to explore sports, build healthy habits and develop skills that carry into everyday life."}
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
                  <h3 className="mt-6 text-base font-bold leading-snug tracking-wide">
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

        <section id="courses" className="scroll-mt-24 bg-bg-main py-20 text-brand-dark sm:py-28">
          <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
            <Reveal className="mb-10 flex flex-col justify-between gap-5 sm:mb-14 sm:flex-row sm:items-end">
              <div>
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-brand-accent-dark">
                  {isVi ? "TÌM MÔN THỂ THAO CỦA BẠN" : "FIND YOUR SPORT"}
                </p>
                <h2 className="font-mlc text-4xl font-extrabold leading-tight tracking-normal sm:text-6xl sm:leading-[1.15]">
                  {isVi
                    ? `${visibleCourses.length} KHÓA HỌC THỂ THAO`
                    : `${visibleCourses.length} SPORTS COURSES`}
                </h2>
              </div>
            </Reveal>
            <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCourses.map((course) => {
                const courseIndex = courses.findIndex((item) => item.id === course.id)
                return (
                <Item key={course.id} className="h-full">
                  <article className="group h-full overflow-hidden border border-brand-primary/20 border-b-4 border-b-brand-primary bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-brand-primary/50 hover:shadow-mlc">
                    <Link to={`/courses/${course.id}`} aria-label={isVi ? `Xem khóa học ${course.title}` : `View ${course.titleEn} course`} className="relative block aspect-[4/3] overflow-hidden bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-primary">
                      <img
                        src={course.image}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-mlc-ink/75 via-transparent to-black/10" />
                      <span className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center bg-mlc-red font-mlc text-sm font-bold text-white">
                        {String(courseIndex + 1).padStart(2, "0")}
                      </span>
                    </Link>
                    <div className="p-5 sm:p-6">
                      <h3 className="font-mlc text-2xl font-bold uppercase leading-snug tracking-normal">
                        <Link to={`/courses/${course.id}`} className="text-brand-dark hover:text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary">{isVi ? course.title : course.titleEn}</Link>
                      </h3>
                      <p className="mt-3 min-h-[48px] text-sm leading-6 text-text-secondary">
                        {isVi ? course.description : course.descriptionEn}
                      </p>
                      <Link to={`/courses/${course.id}`} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand-primary transition hover:text-brand-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary">
                        {isVi ? "Khám phá khóa học" : "Explore this course"}<ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </article>
                </Item>
                )
              })}
            </Stagger>
          </div>
        </section>

        <section id="facilities" className="home-facilities-section scroll-mt-24" aria-labelledby="home-facilities-title">
          <div className="home-facilities-inner">
            <Reveal className="home-facilities-heading">
              <h2 id="home-facilities-title">{isVi ? <>CƠ SỞ <span>VẬT CHẤT</span></> : <>OUR <span>FACILITIES</span></>}</h2>
            </Reveal>
            <div className="home-facilities-gallery">
              {publicCourses.map((course, index) => (
                <article key={course.id} className={`home-facility-tile ${index === 0 ? "is-featured" : ""}`}>
                  <img
                    src={course.spaceImage}
                    alt={isVi ? `Không gian tập luyện ${course.title}` : `${course.titleEn} training space`}
                    loading={index < 4 ? "eager" : "lazy"}
                    decoding="async"
                  />
                  <div className="home-facility-tile-shade" aria-hidden="true" />
                  <span className="home-facility-tile-number">{String(index + 1).padStart(2, "0")}</span>
                  <h3>{isVi ? course.title : course.titleEn}</h3>
                </article>
              ))}
            </div>
            <Link to="/facilities" className="home-facilities-link">
              {isVi ? "Xem chi tiết cơ sở vật chất" : "View facility details"}<ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </section>

      </main>

      <PublicFooter />
    </div>
  )
}
