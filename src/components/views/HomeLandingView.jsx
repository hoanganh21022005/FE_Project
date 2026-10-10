import React, { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useReducedMotion } from "motion/react"
import { useSCMS } from "../../context/SCMSContext"
import { publicCoaches, publicSports } from "../../data/publicCoaches"
import { PublicFooter } from "../layout/PublicFooter"
import { Reveal, Stagger, Item } from "../common/Reveal"
import { ArrowDown, ArrowRight, ChevronDown, Mail, Menu, Newspaper, Phone, Users, X } from "lucide-react"
import "../../styles/coaches.css"

const heroSlogan = ["Vitality", "Inspire", "Balance", "Energy"]

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
    id: "swimming",
    title: "Bơi lội",
    titleEn: "Swimming",
    description: "Rèn kỹ thuật bơi, điều hòa nhịp thở và nâng cao thể lực trong môi trường nước.",
    descriptionEn: "Build swimming technique, breathing control and fitness in the water.",
    image: "/images/swimming-course.jpg",
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
    title: "Quần vợt",
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
  const { language, setLanguage } = useSCMS()
  const prefersReducedMotion = useReducedMotion()
  const heroVideoRef = useRef(null)
  const heroMotionPaused = Boolean(prefersReducedMotion)
  const [menuOpen, setMenuOpen] = useState(false)
  const [openDropdown, setOpenDropdown] = useState(null)
  const [activeCourse, setActiveCourse] = useState("all")
  const [activeSport, setActiveSport] = useState("all")
  const [selectedCoach, setSelectedCoach] = useState(null)
  const headerRef = useRef(null)
  const dropdownTriggerRefs = useRef({})
  const coachTriggerRef = useRef(null)
  const coachDialogRef = useRef(null)
  const closeCoachButtonRef = useRef(null)
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
    if (!selectedCoach) return undefined

    const previousOverflow = document.body.style.overflow
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedCoach(null)
        return
      }

      if (event.key === "Tab") {
        const focusable = coachDialogRef.current?.querySelectorAll(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        )
        if (!focusable?.length) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleKeyDown)
    closeCoachButtonRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleKeyDown)
      coachTriggerRef.current?.focus()
    }
  }, [selectedCoach])

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

  const openCoachProfile = (coachCard, event) => {
    coachTriggerRef.current = event.currentTarget
    setSelectedCoach(coachCard)
  }

  const handleCoachKeyDown = (event, coachCard) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      openCoachProfile(coachCard, event)
    }
  }
  const coaches = publicCoaches
  const coachCards = coaches.map((coach) => ({
    coach,
    sport: courses.find((sport) => sport.id === coach.sportId),
    image: coach.image,
  }))
  const visibleCoachCards =
    activeSport === "all"
      ? coachCards
      : coachCards.filter(({ coach }) => coach.sportId === activeSport)
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
    { href: "#facilities", label: isVi ? "Cơ sở vật chất" : "Facilities" },
    { href: "#admission", label: isVi ? "Tuyển sinh" : "Admissions" },
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
              src="/images/vibe-sport-logo.png?v=2"
              alt="Vibe Sport"
              className="h-14 w-24 shrink-0 object-contain sm:h-16 sm:w-32"
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
                      ? "-skew-x-6 bg-mlc-red px-4 py-3 text-white shadow-mlc hover:bg-rose-700 hover:text-white"
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
            <button
              type="button"
              onClick={() => onOpenRegister()}
              className="rounded-full bg-mlc-red px-5 py-3 text-xs font-bold text-white shadow-mlc transition hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mlc-ink"
            >
              {isVi ? "Đăng ký ngay" : "Register now"}
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
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onOpenRegister()
                }}
                className="rounded-full bg-mlc-red px-5 py-3 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mlc-red"
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
              <h1 className="text-[clamp(3.75rem,12vw,10rem)] font-extrabold leading-[0.98] tracking-[-0.055em]">
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
                  className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-mlc-red px-7 text-sm font-bold text-white shadow-mlc transition hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  {isVi ? "Khám phá khóa học" : "Explore courses"}{" "}
                  <ArrowDown className="h-4 w-4" />
                </Link>
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
          className="overflow-hidden border-b border-mlc-border bg-mlc-red py-5"
          role="region"
          aria-label={isVi ? "Các môn thể thao" : "Sports"}
        >
          <div className="sports-marquee-track flex w-max items-center hover:[animation-play-state:paused]">
            {[0, 1].map((copy) => (
              <div
                key={copy}
                className="flex shrink-0 items-center gap-12 px-6 text-lg font-bold text-white sm:gap-16 sm:px-10 sm:text-xl"
                aria-hidden={copy === 1 ? "true" : undefined}
              >
                {courses.map((course) => (
                  <span
                    key={course.id}
                    className="flex shrink-0 items-center whitespace-nowrap"
                  >
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
                {isVi ? "TẠI SAO CHỌN VIBE SPORT" : "WHY CHOOSE VIBE SPORT"}
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

        <section id="courses" className="scroll-mt-24 bg-mlc-surface-base py-20 text-white sm:py-28">
          <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
            <Reveal className="mb-10 flex flex-col justify-between gap-5 sm:mb-14 sm:flex-row sm:items-end">
              <div>
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-mlc-red">
                  {isVi ? "TÌM MÔN THỂ THAO CỦA BẠN" : "FIND YOUR SPORT"}
                </p>
                <h2 className="font-mlc text-4xl font-extrabold leading-[0.98] tracking-tight sm:text-6xl">
                  {isVi
                    ? `${visibleCourses.length} KHÓA HỌC THỂ THAO`
                    : `${visibleCourses.length} SPORTS COURSES`}
                </h2>
              </div>
              <p className="max-w-lg text-base leading-7 text-white/70">
                {isVi
                  ? "Từ những môn phối hợp đồng đội đến thử thách cá nhân, hãy chọn hoạt động khiến bạn muốn quay lại sân tập."
                  : "From team play to individual challenges, choose an activity that makes you want to come back."}
              </p>
            </Reveal>
            <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleCourses.map((course) => {
                const courseIndex = courses.findIndex((item) => item.id === course.id)
                return (
                <Item key={course.id} className="h-full">
                  <article className="group h-full overflow-hidden border border-white/15 border-b-4 border-b-mlc-red bg-white/[0.03] transition duration-300 hover:-translate-y-1 hover:border-white/35 hover:shadow-mlc">
                    <Link to={`/courses/${course.id}`} aria-label={isVi ? `Xem khóa học ${course.title}` : `View ${course.titleEn} course`} className="relative block aspect-[4/3] overflow-hidden bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white">
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
                      <h3 className="font-mlc text-2xl font-bold uppercase leading-tight">
                        <Link to={`/courses/${course.id}`} className="hover:text-mlc-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">{isVi ? course.title : course.titleEn}</Link>
                      </h3>
                      <p className="mt-3 min-h-[48px] text-sm leading-6 text-white/70">
                        {isVi ? course.description : course.descriptionEn}
                      </p>
                      <Link to={`/courses/${course.id}`} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-white transition hover:text-mlc-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
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

        <section
          id="coaches"
          className="coaches-grid-background scroll-mt-24 bg-mlc-ink py-14 text-white sm:py-20"
          aria-labelledby="home-coaches-title"
        >
          <div className="mx-auto max-w-[1280px] px-5 sm:px-8 lg:px-12">
            <Reveal>
              <p className="coaches-eyebrow">ALL TEAM</p>
              <h2 id="home-coaches-title" className="mt-5 font-display text-[clamp(2.5rem,5vw,4.5rem)] font-extrabold uppercase leading-[1.03] tracking-tight">
                {isVi ? "Huấn luyện viên" : "Coaches"}{" "}
                <span className="text-mlc-red">VIBE SPORT</span>
              </h2>
              <Link to="/coaches" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white/75 transition hover:text-white">
                {isVi ? "Khám phá đội ngũ huấn luyện viên" : "Meet our coaching team"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <div className="mb-9 mt-6 h-1 w-24 bg-mlc-red" />
            </Reveal>

            <div
              role="group"
              aria-label={isVi ? "Lọc theo môn thể thao" : "Filter by sport"}
              className="coaches-sport-filters"
            >
              {[{ id: "all", title: "Tất cả", titleEn: "All" }, ...publicSports].map((sport) => (
                <button
                  key={sport.id}
                  type="button"
                  aria-pressed={activeSport === sport.id}
                  onClick={() => setActiveSport(sport.id)}
                  className={`coaches-sport-filter focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${activeSport === sport.id ? "is-active" : ""}`}
                >
                  <span>{isVi ? sport.title : sport.titleEn}</span>
                </button>
              ))}
            </div>

            <p role="status" aria-live="polite" aria-atomic="true" className="mb-5 mt-6 text-xs text-white/50">
              {isVi
                ? `${visibleCoachCards.length} huấn luyện viên · ${activeSport === "all" ? "9 môn thể thao" : publicSports.find((sport) => sport.id === activeSport).title}`
                : `${visibleCoachCards.length} ${visibleCoachCards.length === 1 ? "coach" : "coaches"} · ${activeSport === "all" ? "9 sports" : publicSports.find((sport) => sport.id === activeSport).titleEn}`}
            </p>
            {visibleCoachCards.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 xl:gap-4" data-coach-grid>
                {visibleCoachCards.map(({ coach, sport, image }) => (
                  <div
                    key={coach.id}
                    className="coaches-team-card cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mlc-red"
                    role="button"
                    tabIndex={0}
                    aria-label={
                      isVi
                        ? `Xem hồ sơ huấn luyện viên ${coach.name}`
                        : `View coach profile for ${coach.name}`
                    }
                    onClick={(event) => openCoachProfile({ coach, sport, image }, event)}
                    onKeyDown={(event) =>
                      handleCoachKeyDown(event, { coach, sport, image })
                    }
                  >
                    <img
                      src={image}
                      alt={isVi ? `${coach.name} – ảnh minh họa môn ${coach.specialtyVi}` : `${coach.name} – illustrative ${coach.specialty} photo`}
                      width="768"
                      height="1024"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="coaches-team-card-shade" aria-hidden="true" />
                    <span className="coaches-team-card-icon" aria-hidden="true"><Users className="h-5 w-5" /></span>
                    <div className="coaches-team-card-copy">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/80 sm:text-xs">
                        {isVi ? sport.title : sport.titleEn}
                      </p>
                      <h3 className="font-display text-2xl font-extrabold uppercase leading-[1.02] sm:text-3xl">
                        {coach.name}
                      </h3>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="border border-white/15 bg-white/5 p-6 text-sm text-white/70">
                {coaches.length > 0
                  ? isVi
                    ? "Chưa có huấn luyện viên cho môn thể thao này."
                    : "There are no coaches for this sport yet."
                  : isVi
                    ? "Thông tin huấn luyện viên sẽ sớm được cập nhật."
                    : "Coach profiles will be available soon."}
              </p>
            )}
            <p className="mt-8 border-t border-white/10 pt-6 text-xs leading-6 text-white/45">
              {isVi ? "Hình ảnh huấn luyện viên mang tính minh họa." : "Coach images are illustrative."}
            </p>
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

        <section id="news" className="scroll-mt-24 bg-sc-paper py-20 text-white sm:py-24">
          <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
            <Reveal className="mb-8 max-w-3xl">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-sc-primary">
                {isVi ? "BẢN TIN VIBE Sport" : "VIBE Sport UPDATES"}
              </p>
              <h2 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
                {isVi ? "TIN TỨC VÀ SỰ KIỆN" : "NEWS AND EVENTS"}
              </h2>
              <p className="mt-4 text-base leading-7 text-sc-muted">
                {isVi
                  ? "Cập nhật hoạt động và thông báo mới của trung tâm."
                  : "Updates and announcements from the center."}
              </p>
            </Reveal>
            <div className="flex min-h-44 items-center gap-5 border border-sc-border bg-white/[0.03] p-6 sm:p-8">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-sc-primary/10 text-sc-primary">
                <Newspaper className="h-6 w-6" aria-hidden="true" />
              </span>
              <p className="text-sm leading-6 text-sc-muted sm:text-base">
                {isVi
                  ? "Chưa có tin tức hoặc sự kiện nào được đăng. Nội dung mới sẽ xuất hiện tại đây."
                  : "There are no news or event posts yet. New updates will appear here."}
              </p>
            </div>
          </div>
        </section>

        <section id="contact" className="scroll-mt-24 bg-sc-ink py-20 text-white sm:py-24">
          <div className="mx-auto grid max-w-[1440px] gap-10 px-5 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-12">
            <Reveal>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-sc-primary">
                {isVi ? "BỘ PHẬN QUAN HỆ HỘI VIÊN" : "MEMBER RELATIONS"}
              </p>
              <h2 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
                {isVi ? "LIÊN HỆ VIBE Sport" : "CONTACT VIBE Sport"}
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
                {isVi
                  ? "Liên hệ bộ phận Quan hệ Hội viên nếu bạn cần hỗ trợ về tài khoản hoặc dịch vụ của trung tâm."
                  : "Contact Member Relations for help with your account or center services."}
              </p>
            </Reveal>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <a
                href="tel:18006995"
                className="flex min-h-24 items-center gap-4 border border-white/15 bg-white/[0.03] p-5 transition hover:border-sc-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sc-primary"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-sc-primary/10 text-sc-primary">
                  <Phone className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-white/60">
                    {isVi ? "Điện thoại" : "Phone"}
                  </span>
                  <span className="mt-1 block font-semibold">1800 6995</span>
                </span>
              </a>
              <a
                href="mailto:memberrelations@scms.vn"
                className="flex min-h-24 items-center gap-4 border border-white/15 bg-white/[0.03] p-5 transition hover:border-sc-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sc-primary"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-sc-primary/10 text-sc-primary">
                  <Mail className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-white/60">
                    Email
                  </span>
                  <span className="mt-1 block break-all font-semibold">memberrelations@scms.vn</span>
                </span>
              </a>
            </div>
          </div>
        </section>

        <section id="admission" className="scroll-mt-24 bg-mlc-red py-16 text-white sm:py-20">
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

      {selectedCoach && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedCoach(null)
          }}
        >
          <div
            ref={coachDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="coach-profile-name"
            className="relative max-h-[calc(100vh-1.5rem)] w-full max-w-[1680px] overflow-y-auto border border-white/15 bg-mlc-ink p-3 text-white shadow-2xl sm:max-h-[calc(100vh-3rem)] sm:p-6"
          >
            <button
              ref={closeCoachButtonRef}
              type="button"
              onClick={() => setSelectedCoach(null)}
              aria-label={isVi ? "Đóng hồ sơ huấn luyện viên" : "Close coach profile"}
              className="absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center border border-white/30 bg-black/50 text-white transition hover:bg-mlc-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="grid gap-4 lg:grid-cols-2">
              <section
                className="grid min-h-[560px] grid-rows-[1fr_auto] border border-white/15 bg-white/[0.06]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)",
                  backgroundSize: "66px 66px",
                }}
              >
                <div className="grid md:grid-cols-2">
                  <div className="relative min-h-[340px] bg-black/30 md:min-h-0">
                    <img
                      src={selectedCoach.image}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-mlc-ink/70 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-mlc-ink/40" />
                  </div>
                  <div className="flex flex-col justify-center px-5 py-8 sm:px-8">
                    <p className="mb-4 inline-flex w-fit -skew-x-6 bg-mlc-red px-4 py-2 font-display text-xs font-extrabold uppercase tracking-wider text-white">
                      <span className="skew-x-6">
                        {isVi
                          ? `Huấn luyện viên ${selectedCoach.sport.title}`
                          : `${selectedCoach.sport.titleEn} coach`}
                      </span>
                    </p>
                    <h2
                      id="coach-profile-name"
                      className="font-display text-4xl font-extrabold uppercase leading-[0.95] text-mlc-red sm:text-5xl"
                    >
                      {selectedCoach.coach.name}
                    </h2>
                    <p className="mt-6 max-w-prose text-base font-medium leading-7 text-white/85 sm:text-lg sm:leading-8">
                      {isVi
                        ? `Huấn luyện viên ${selectedCoach.sport.title} tại VIBE Sport, đồng hành cùng học viên rèn kỹ thuật, phản xạ, tốc độ di chuyển và khả năng phối hợp chiến thuật trên sân.`
                        : `A ${selectedCoach.sport.titleEn} coach at VIBE Sport, supporting members as they build technique, reflexes, court movement and tactical coordination.`}
                    </p>
                  </div>
                </div>

                <div className="grid gap-2 border-t border-white/15 p-3 sm:grid-cols-2 sm:p-4">
                  <div className="flex min-h-16 items-center gap-3 border border-white/15 bg-white/[0.04] p-3 sm:p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-mlc-red text-lg font-bold text-white">✓</span>
                    <span className="text-sm font-semibold sm:text-base">
                      {isVi ? "Kỹ thuật & phối hợp" : "Technique & coordination"}
                    </span>
                  </div>
                  <div className="flex min-h-16 items-center gap-3 border border-white/15 bg-white/[0.04] p-3 sm:p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-mlc-red text-lg font-bold text-white">✓</span>
                    <span className="text-sm font-semibold sm:text-base">
                      {isVi ? "Phản xạ & di chuyển" : "Reflexes & movement"}
                    </span>
                  </div>
                </div>
              </section>

              <section className="group relative flex min-h-[420px] items-end overflow-hidden border-l-4 border-mlc-red bg-black sm:min-h-[560px]">
                <img
                  src={selectedCoach.sport.image}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-black/10" />
                <div className="relative max-w-3xl p-6 sm:p-9 lg:p-10">
                  <p className="mb-4 flex items-center gap-3 font-display text-sm font-extrabold uppercase tracking-[0.18em] text-white/80">
                    <span className="h-2 w-10 -skew-x-12 bg-mlc-red" />
                    {isVi ? "Cơ sở vật chất" : "Sports facilities"}
                  </p>
                  <h3 className="font-display text-3xl font-extrabold uppercase leading-[0.95] sm:text-5xl">
                    {isVi
                      ? `Không gian tập luyện ${selectedCoach.sport.title}`
                      : `${selectedCoach.sport.titleEn} training space`}
                  </h3>
                  <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-white/90 sm:text-xl sm:leading-8">
                    {isVi
                      ? "Không gian dành cho các bài tập kỹ thuật, phản xạ và di chuyển, giúp học viên thực hành trực tiếp trên sân."
                      : "A dedicated space for technique, reflex and movement drills, giving members room to practise on court."}
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      <PublicFooter />
    </div>
  )
}
