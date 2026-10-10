import React, { useState } from "react"
import { Link } from "react-router-dom"
import { ArrowDown, ArrowUpRight, Compass, Heart, Target, Users } from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import { publicCoaches, publicSports } from "../../data/publicCoaches"
import { CoachesHeader } from "../layout/CoachesHeader"
import { CoachEnrollmentFooter } from "../layout/CoachEnrollmentFooter"
import { Reveal } from "../common/Reveal"
import "../../styles/coaches.css"

export function CoachesView() {
  const { language } = useSCMS()
  const isVi = language === "vi"
  const [activeSport, setActiveSport] = useState("all")
  const visibleCoaches = activeSport === "all" ? publicCoaches : publicCoaches.filter((coach) => coach.sportId === activeSport)
  const statistics = [
    ["09", "Huấn luyện viên", "Specialist coaches", Users],
    ["09", "Bộ môn thể thao", "Sports to discover", Target],
    ["01", "Đội ngũ đồng hành", "Team by your side", Compass],
    ["04", "Giá trị VIBE", "VIBE values", Heart],
  ]

  return (
    <div className="coaches-page min-h-screen bg-mlc-ink font-mlc text-white selection:bg-mlc-red">
      <Link to="#team" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-white focus:p-4 focus:text-mlc-ink">{isVi ? "Đến danh sách huấn luyện viên" : "Skip to the team"}</Link>
      <CoachesHeader />
      <main id="main-content">
        <section className="coaches-hero" aria-labelledby="coaches-page-title">
          <div className="coaches-hero-photo coaches-hero-photo-left" aria-hidden="true" />
          <div className="coaches-hero-photo coaches-hero-photo-right" aria-hidden="true" />
          <div className="coaches-hero-shade" aria-hidden="true" />
          <div className="coaches-hero-grid" aria-hidden="true" />
          <div className="coaches-hero-ghost" aria-hidden="true">TEAM</div>
          <div className="relative mx-auto w-full max-w-[1280px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
            <Reveal className="max-w-3xl">
              <p className="coaches-eyebrow">VIBE SPORT</p>
              <h1 id="coaches-page-title" className="mt-7 font-display text-[clamp(3.5rem,7vw,6.5rem)] font-extrabold uppercase leading-[0.95] tracking-tight">
                {isVi ? "Đội ngũ" : "Our"} <span className="text-mlc-red">{isVi ? "HLV" : "coaches"}</span>
              </h1>
              <p className="mt-8 max-w-2xl border-l-[3px] border-mlc-red pl-5 text-base font-medium leading-7 text-white/85 sm:text-lg sm:leading-8">
                {isVi ? "Những huấn luyện viên tận tâm đồng hành cùng bạn trên hành trình chinh phục thể thao. Tìm người hướng dẫn phù hợp, rèn kỹ năng và tiến bộ qua từng buổi tập." : "Dedicated coaches to support your sporting journey. Find the right guide, build your skills and grow with every session."}
              </p>
              <Link to="#team" className="mt-9 inline-flex items-center gap-3 border-b border-white/40 pb-2 text-xs font-bold uppercase tracking-[0.12em] transition hover:border-mlc-red hover:text-white">
                {isVi ? "Gặp gỡ đội ngũ" : "Meet the team"}<ArrowDown className="h-4 w-4" />
              </Link>
            </Reveal>
          </div>
        </section>

        <section aria-label={isVi ? "Đội ngũ VIBE Sport" : "VIBE Sport at a glance"} className="coaches-grid-background">
          <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-3 px-5 py-9 sm:gap-4 sm:px-8 sm:py-12 lg:grid-cols-4 lg:px-12">
            {statistics.map(([number, vi, en, Icon]) => (
              <div key={vi} className="coaches-stat">
                <Icon className="h-6 w-6 shrink-0 text-mlc-red sm:h-7 sm:w-7" aria-hidden="true" />
                <div>
                  <span className="block font-display text-4xl font-extrabold leading-none text-mlc-red sm:text-5xl">{number}</span>
                  <span className="mt-3 block text-[10px] font-bold uppercase leading-4 tracking-wide sm:text-xs">{isVi ? vi : en}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="team" className="coaches-grid-background scroll-mt-24 pb-20 pt-12 sm:pb-28 sm:pt-16" aria-labelledby="coaches-team-title">
          <div className="mx-auto max-w-[1280px] px-5 sm:px-8 lg:px-12">
            <Reveal>
              <p className="coaches-eyebrow">ALL TEAM</p>
              <h2 id="coaches-team-title" className="mt-5 font-display text-[clamp(2.5rem,5vw,4.5rem)] font-extrabold uppercase leading-[1.03] tracking-tight">
                {isVi ? "Huấn luyện viên" : "Coaches"} <span className="text-mlc-red">VIBE Sport</span>
              </h2>
              <div className="mb-9 mt-6 h-1 w-24 bg-mlc-red" />
            </Reveal>
            <div role="group" aria-label={isVi ? "Lọc huấn luyện viên theo môn thể thao" : "Filter coaches by sport"} className="coaches-sport-filters">
              {[{ id: "all", title: "Tất cả", titleEn: "All" }, ...publicSports].map((sport) => (
                <button
                  key={sport.id}
                  type="button"
                  aria-pressed={activeSport === sport.id}
                  onClick={() => setActiveSport(sport.id)}
                  className={`coaches-sport-filter ${activeSport === sport.id ? "is-active" : ""}`}
                ><span>{isVi ? sport.title : sport.titleEn}</span></button>
              ))}
            </div>
            <p role="status" aria-live="polite" aria-atomic="true" className="mb-5 mt-6 text-xs text-white/50">
              {isVi ? `${visibleCoaches.length} huấn luyện viên${activeSport === "all" ? " · 9 môn thể thao" : ` · ${publicSports.find((sport) => sport.id === activeSport).title}`}` : `${visibleCoaches.length} ${visibleCoaches.length === 1 ? "coach" : "coaches"}${activeSport === "all" ? " · 9 sports" : ` · ${publicSports.find((sport) => sport.id === activeSport).titleEn}`}`}
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 xl:gap-4" data-coach-grid>
              {visibleCoaches.map((coach) => (
                <article key={coach.id} className="coaches-team-card">
                  <img src={coach.image} alt={isVi ? `${coach.name} – ảnh minh họa môn ${coach.specialtyVi}` : `${coach.name} – illustrative ${coach.specialty} photo`} width="768" height="1024" loading="lazy" decoding="async" />
                  <div className="coaches-team-card-shade" aria-hidden="true" />
                  <span className="coaches-team-card-icon" aria-hidden="true"><Users className="h-5 w-5" /></span>
                  <div className="coaches-team-card-copy">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/80 sm:text-xs">{isVi ? coach.specialtyVi : coach.specialty}</p>
                    <h3 className="font-display text-2xl font-extrabold uppercase leading-[1.02] sm:text-3xl">{coach.name}</h3>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-5 border-t border-white/10 pt-6">
              <p className="text-xs leading-6 text-white/45">{isVi ? "Hình ảnh huấn luyện viên mang tính minh họa." : "Coach images are illustrative."}</p>
              <Link to="#enrollment" className="inline-flex items-center gap-2 text-sm font-semibold transition hover:text-mlc-red">{isVi ? "Tìm môn học phù hợp với bạn" : "Find your sport"}<ArrowUpRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </section>
      </main>
      <CoachEnrollmentFooter />
    </div>
  )
}
