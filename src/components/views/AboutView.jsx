import React from "react"
import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import { publicSports } from "../../data/publicCoaches"
import { CoachesHeader } from "../layout/CoachesHeader"
import { CoachEnrollmentFooter } from "../layout/CoachEnrollmentFooter"
import "../../styles/coaches.css"

const values = [
  ["V", "Vitality", "Sức sống", "Tìm niềm vui vận động và xây dựng thói quen tập luyện mỗi ngày.", "Find joy in movement and build an active daily routine."],
  ["I", "Inspire", "Cảm hứng", "Cùng HLV và bạn tập khám phá khả năng của bản thân qua từng buổi học.", "Explore your abilities with your coach and training partners."],
  ["B", "Balance", "Cân bằng", "Tìm nhịp tập luyện phù hợp với thể lực, sở thích và mục tiêu của bạn.", "Find a training rhythm that suits your fitness, interests and goals."],
  ["E", "Energy", "Năng lượng", "Mang tinh thần tích cực từ sân tập vào học tập và cuộc sống.", "Bring positive energy from practice into learning and everyday life."],
]

export function AboutView() {
  const { language } = useSCMS()
  const isVi = language === "vi"
  return (
    <div className="coaches-page min-h-screen bg-mlc-ink font-mlc text-white">
      <CoachesHeader />
      <main id="main-content">
        <section className="coaches-hero" aria-labelledby="about-title">
          <div className="coaches-hero-photo coaches-hero-photo-left" aria-hidden="true" />
          <div className="coaches-hero-photo coaches-hero-photo-right" aria-hidden="true" />
          <div className="coaches-hero-shade" aria-hidden="true" />
          <div className="coaches-hero-grid" aria-hidden="true" />
          <div className="relative mx-auto w-full max-w-[1280px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
            <p className="coaches-eyebrow">VIBE SPORT</p>
            <h1 id="about-title" className="mt-7 font-display text-[clamp(3.5rem,7vw,6.5rem)] font-extrabold uppercase leading-none">{isVi ? "Về chúng tôi" : "About us"}</h1>
            <p className="mt-7 max-w-2xl border-l-[3px] border-mlc-red pl-5 text-base leading-8 text-white/85">{isVi ? "Lớn lên cùng thể thao. Khám phá môn học bạn yêu thích, xây dựng kỹ năng và tiến bộ theo nhịp độ của riêng mình cùng VIBE Sport." : "Grow through sport. Discover what you love, build skills and progress at your own pace with VIBE Sport."}</p>
          </div>
        </section>

        <section className="bg-mlc-surface py-16 text-mlc-ink sm:py-24" aria-labelledby="about-intro-title">
          <div className="mx-auto grid max-w-[1280px] gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:items-center lg:px-12">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-mlc-red">VITALITY · INSPIRE · BALANCE · ENERGY</p>
              <h2 id="about-intro-title" className="mt-5 font-display text-4xl font-extrabold uppercase leading-tight sm:text-5xl">{isVi ? "Không gian để bạn khám phá và phát triển" : "Space to discover and grow"}</h2>
              <p className="mt-6 text-base leading-8 text-mlc-muted">{isVi ? "VIBE Sport mang đến môi trường để học viên khám phá chín môn thể thao, rèn luyện sức khỏe và phát triển kỹ năng. Từ những bước đầu tiên đến từng mục tiêu mới, đội ngũ huấn luyện viên đồng hành cùng bạn trong quá trình tập luyện." : "VIBE Sport brings together nine sports to help learners discover movement, build fitness and develop skills. Our coaches support you from your first steps through each new goal."}</p>
              <Link to="/coaches" className="mt-7 inline-flex items-center gap-3 text-sm font-bold text-mlc-red">{isVi ? "Gặp đội ngũ huấn luyện viên" : "Meet our coaches"}<ArrowRight className="h-4 w-4" /></Link>
            </div>
            <img src="/images/courses/basketball.jpg" alt={isVi ? "Ảnh minh họa hoạt động bóng rổ" : "Illustrative basketball activity"} width="1600" height="900" loading="lazy" className="aspect-[4/3] w-full object-cover" />
          </div>
        </section>

        <section className="coaches-grid-background py-16 sm:py-24" aria-labelledby="about-values-title">
          <div className="mx-auto max-w-[1280px] px-5 sm:px-8 lg:px-12">
            <p className="coaches-eyebrow">THE VIBE WAY</p>
            <h2 id="about-values-title" className="mt-5 font-display text-4xl font-extrabold uppercase sm:text-5xl">{isVi ? "Giá trị của VIBE Sport" : "The values of VIBE Sport"}</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {values.map(([initial, word, vi, description, descriptionEn]) => (
                <article key={word} className="border border-white/10 border-b-[3px] border-b-mlc-red bg-white/5 p-6">
                  <span className="font-display text-6xl font-extrabold text-mlc-red" aria-hidden="true">{initial}</span>
                  <h3 className="mt-5 font-display text-3xl font-bold uppercase">{word}</h3>
                  {isVi && <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-white/50">{vi}</p>}
                  <p className="mt-4 text-sm leading-7 text-white/70">{isVi ? description : descriptionEn}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-mlc-surface py-16 text-mlc-ink sm:py-20" aria-labelledby="about-sports-title">
          <div className="mx-auto max-w-[1280px] px-5 sm:px-8 lg:px-12">
            <h2 id="about-sports-title" className="font-display text-4xl font-extrabold uppercase sm:text-5xl">{isVi ? "Chín môn thể thao. Một hành trình của bạn." : "Nine sports. Your own journey."}</h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {publicSports.map((sport) => <Link key={sport.id} to={`/courses/${sport.id}`} className="flex items-center justify-between gap-4 border border-mlc-border bg-white px-5 py-4 text-sm font-bold transition hover:border-mlc-red hover:text-mlc-red">{isVi ? sport.title : sport.titleEn}<ArrowRight className="h-4 w-4 shrink-0" /></Link>)}
            </div>
          </div>
        </section>
      </main>
      <CoachEnrollmentFooter />
    </div>
  )
}
