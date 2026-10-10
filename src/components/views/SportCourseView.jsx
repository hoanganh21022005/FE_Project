import React from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { ArrowDown, ArrowRight, CheckCircle2, ChevronRight, Compass, Target } from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import { publicCourses } from "../../data/publicCourses"
import { publicCoaches } from "../../data/publicCoaches"
import { CoachesHeader } from "../layout/CoachesHeader"
import { CoachEnrollmentFooter } from "../layout/CoachEnrollmentFooter"
import "../../styles/coaches.css"
import "../../styles/sport-course.css"

export function SportCourseView() {
  const { sportId } = useParams()
  const { hash } = useLocation()
  const { language } = useSCMS()
  const isVi = language === "vi"
  const course = publicCourses.find((item) => item.id === sportId)
  const coach = publicCoaches.find((item) => item.sportId === sportId)


  if (!course) return (
    <div className="coaches-page min-h-screen bg-mlc-ink font-mlc text-white">
      <CoachesHeader />
      <main className="mx-auto max-w-3xl px-5 py-24 text-center">
        <p className="coaches-eyebrow">VIBE SPORT</p>
        <h1 className="mt-6 font-display text-5xl font-bold">{isVi ? "Không tìm thấy môn học" : "Course not found"}</h1>
        <Link to="/#courses" className="mt-8 inline-flex items-center gap-3 text-mlc-red">{isVi ? "Khám phá các khóa học" : "Explore courses"}<ArrowRight className="h-4 w-4" /></Link>
      </main>
    </div>
  )

  const title = isVi ? course.title : course.titleEn
  return (
    <div className="sport-course-page coaches-page min-h-screen bg-mlc-ink font-mlc text-white" style={{ "--course-accent": course.accent }}>
      <Link to="#course-overview" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-white focus:p-4 focus:text-mlc-ink">{isVi ? "Đến thông tin khóa học" : "Skip to course information"}</Link>
      <CoachesHeader />
      <main>
        <section className="sport-course-hero" aria-labelledby="course-title">
          <img className="sport-course-hero-image" src={course.image} alt="" width="1600" height="900" fetchPriority="high" />
          <div className="sport-course-hero-shade" aria-hidden="true" />
          <div className="coaches-hero-grid absolute inset-0" aria-hidden="true" />
          <div className="sport-course-hero-wedge" aria-hidden="true" />
          <div className="sport-course-container relative py-16 sm:py-24">
            <nav aria-label={isVi ? "Đường dẫn trang" : "Breadcrumb"} className="mb-14 flex flex-wrap items-center gap-2 text-xs text-white/65 sm:mb-20">
              <Link to="/">{isVi ? "Trang chủ" : "Home"}</Link><ChevronRight className="h-3 w-3" aria-hidden="true" />
              <Link to="/#courses">{isVi ? "Khóa học" : "Courses"}</Link><ChevronRight className="h-3 w-3" aria-hidden="true" />
              <span aria-current="page" className="text-white">{title}</span>
            </nav>
            <p className="coaches-eyebrow">VIBE SPORT</p>
            <h1 id="course-title" className="mt-7 max-w-4xl font-display text-[clamp(3.75rem,9vw,8rem)] font-extrabold uppercase leading-[0.95] tracking-tight">{title}</h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-white/80 sm:text-base">{isVi ? "Bắt đầu từ nền tảng. Tiến bộ cùng người hướng dẫn. Tìm nhịp vận động của riêng bạn." : "Start with the foundations. Grow with your coach. Find your own rhythm."}</p>
            <Link to="#course-overview" className="mt-8 inline-flex items-center gap-3 border-b border-white/50 pb-2 text-xs font-bold uppercase tracking-wider">{isVi ? "Khám phá chương trình" : "Explore the programme"}<ArrowDown className="h-4 w-4" /></Link>
          </div>
        </section>

        <section id="course-overview" className="scroll-mt-24 bg-mlc-surface py-16 text-mlc-ink sm:py-24" aria-labelledby="course-overview-title">
          <div className="sport-course-container grid gap-8 lg:grid-cols-[0.8fr_1.4fr] lg:gap-10">
            <article className="sport-course-overview">
              <span className="sport-course-kicker">01 / {isVi ? "Chương trình" : "Programme"}</span>
              <h2 id="course-overview-title" className="mt-5 font-display text-4xl font-extrabold uppercase leading-none sm:text-5xl">{isVi ? "Tổng quan" : "Programme"}<br /><span className="sport-course-accent">{isVi ? "chương trình" : "overview"}</span></h2>
              <div className="sport-course-rule" />
              <p className="text-base leading-8 text-mlc-muted">{isVi ? course.intro : course.introEn}</p>
              <p className="mt-6 border-t border-mlc-border pt-5 text-xs leading-6 text-mlc-muted">{isVi ? "Lộ trình được tư vấn theo độ tuổi, trình độ và mục tiêu của học viên." : "Your learning path is discussed according to age, experience and goals."}</p>
            </article>
            <div>
              <h2 className="font-display text-4xl font-extrabold uppercase leading-none sm:text-5xl">{isVi ? "Danh sách" : "Course"} <span className="sport-course-accent">{isVi ? "khóa học" : "programme"}</span></h2>
              <div className="sport-course-rule" />
              <article className="sport-course-programme">
                <div className="sport-course-programme-head">
                  <span aria-hidden="true">BASIC</span>
                  <h3 className="relative font-display text-4xl font-extrabold uppercase">{isVi ? "Cơ bản" : "Foundations"}</h3>
                </div>
                <div className="p-6 sm:p-8">
                  <h4 className="flex items-center gap-3 font-display text-2xl font-bold uppercase sm:text-3xl"><CheckCircle2 className="sport-course-accent h-7 w-7 shrink-0" aria-hidden="true" />{isVi ? "Mục tiêu đầu ra" : "Learning goals"}</h4>
                  <p className="mb-5 mt-5 text-sm leading-7 text-mlc-muted">{isVi ? "Những kỹ năng nền tảng bạn sẽ làm quen và rèn luyện cùng HLV:" : "Foundational skills to discover and practise with your coach:"}</p>
                  <ul className="space-y-4 text-sm leading-7 sm:text-base">
                    {(isVi ? course.goals : course.goalsEn).map((goal) => <li key={goal} className="flex gap-3"><span className="sport-course-accent font-bold" aria-hidden="true">↗</span><span>{goal}</span></li>)}
                  </ul>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="coaches-grid-background py-16 sm:py-24" aria-labelledby="course-coach-title">
          <div className="sport-course-container">
            <div className="mb-9 flex items-end justify-between gap-6">
              <div><p className="sport-course-kicker text-white/50">02 / {isVi ? "Người đồng hành" : "Your support"}</p><h2 id="course-coach-title" className="mt-4 font-display text-4xl font-extrabold uppercase sm:text-5xl">{isVi ? "HLV & không gian học" : "Coach & training space"}</h2></div>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <article className="sport-course-coach">
                <img src={coach.image} alt={isVi ? `Ảnh minh họa HLV ${coach.name} – ${title}` : `Illustrative image of coach ${coach.name} – ${title}`} width="768" height="1024" loading="lazy" decoding="async" />
                <div className="sport-course-coach-copy">
                  <p className="sport-course-kicker text-white/60">{isVi ? "Huấn luyện viên" : "Your coach"}</p>
                  <h3 className="mt-4 font-display text-4xl font-extrabold uppercase leading-none">{coach.name}</h3>
                  <p className="sport-course-accent mt-3 text-xs font-bold uppercase tracking-wider">{title}</p>
                  <p className="mt-5 text-sm leading-7 text-white/75">{isVi ? `Đồng hành cùng bạn trong từng bài tập ${title.toLocaleLowerCase("vi")}, hướng dẫn kỹ thuật nền tảng và góp ý để bạn cải thiện qua mỗi buổi học.` : `Guidance in ${title.toLowerCase()} foundations, with feedback to help you develop through each session.`}</p>
                  <div className="mt-6 space-y-3 border-t border-white/10 pt-5 text-xs text-white/75">
                    <p className="flex items-center gap-2"><Target className="sport-course-accent h-4 w-4 shrink-0" />{isVi ? "Hướng dẫn kỹ thuật nền tảng" : "Foundational technique guidance"}</p>
                    <p className="flex items-center gap-2"><Compass className="sport-course-accent h-4 w-4 shrink-0" />{isVi ? "Đồng hành theo mục tiêu học tập" : "Support for your learning goals"}</p>
                  </div>
                  <Link to="/coaches" className="mt-6 inline-flex items-center gap-2 text-xs font-semibold hover:text-white/70">{isVi ? "Gặp đội ngũ VIBE Sport" : "Meet the VIBE Sport team"}<ArrowRight className="h-4 w-4" /></Link>
                </div>
              </article>
              <article className="sport-course-space">
                <img src={course.image} alt={isVi ? `Ảnh minh họa không gian tập ${title}` : `Illustrative ${title} practice space`} width="1600" height="900" loading="lazy" decoding="async" />
                <div className="sport-course-space-copy">
                  <p className="sport-course-kicker text-white/70">{isVi ? "Cơ sở vật chất" : "Training environment"}</p>
                  <h3 className="mt-4 font-display text-3xl font-extrabold uppercase leading-tight sm:text-4xl">{isVi ? `Không gian tập luyện ${title}` : `${title} training space`}</h3>
                  <p className="mt-4 text-sm leading-7 text-white/85">{isVi ? course.space : course.spaceEn}</p>
                </div>
              </article>
            </div>
            <p className="mt-5 text-xs text-white/45">{isVi ? "Hình ảnh HLV và không gian tập luyện mang tính minh họa." : "Coach and training-space images are illustrative."}</p>
          </div>
        </section>

        <section className="sport-course-training coaches-grid-background" aria-labelledby="course-training-title">
          <div className="sport-course-container relative py-20 text-center sm:py-28">
            <p className="sport-course-kicker text-white/50">03 / YOUR NEXT MOVE</p>
            <h2 id="course-training-title" className="mx-auto mt-5 max-w-4xl font-display text-4xl font-extrabold uppercase leading-tight sm:text-5xl lg:text-6xl">{isVi ? "Tập luyện cùng HLV" : "Train with coach"} <span className="sport-course-accent">{coach.name}</span></h2>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-white/70">{isVi ? `Khám phá lộ trình phù hợp và nhận tư vấn ghi danh cho môn ${title}.` : `Explore a learning path that suits you and discuss enrolment for ${title.toLowerCase()}.`}</p>
            <Link to="#tuition" className="sport-course-button mt-9">{isVi ? "Xem học phí" : "View tuition"}<ArrowRight className="h-4 w-4" /></Link>
            <div id="tuition" hidden={hash !== "#tuition"} className="sport-course-tuition scroll-mt-28">
              <h3 className="font-display text-3xl font-bold uppercase">{isVi ? `Học phí ${title}` : `${title} tuition`}</h3>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/75">{isVi ? "Bảng học phí sẽ được cập nhật. Hãy để lại thông tin để được tư vấn lộ trình, thời lượng và học phí phù hợp." : "Tuition will be updated soon. Leave your details to discuss a suitable programme, duration and fees."}</p>
              <Link to="#enrollment" className="mt-5 inline-flex items-center gap-2 text-sm font-bold">{isVi ? "Nhận tư vấn ghi danh" : "Discuss enrolment"}<ArrowDown className="h-4 w-4" /></Link>
            </div>
          </div>
        </section>
      </main>
      <CoachEnrollmentFooter key={sportId} defaultSportId={sportId} />
    </div>
  )
}
