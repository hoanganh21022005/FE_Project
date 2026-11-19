import React, { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { ArrowDown, Target, Users, X } from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import { publicCoaches, publicSports } from "../../data/publicCoaches"
import { CoachesHeader } from "../layout/CoachesHeader"
import { PublicFooter } from "../layout/PublicFooter"
import { Reveal } from "../common/Reveal"
import "../../styles/coaches.css"

export function CoachesView() {
  const { language } = useSCMS()
  const isVi = language === "vi"
  const [activeSport, setActiveSport] = useState("all")
  const [selectedCoach, setSelectedCoach] = useState(null)
  const dialogCloseRef = useRef(null)
  const dialogRef = useRef(null)
  const lastTriggerRef = useRef(null)
  const visibleCoaches = activeSport === "all" ? publicCoaches : publicCoaches.filter((coach) => coach.sportId === activeSport)
  useEffect(() => {
    if (!selectedCoach) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    dialogCloseRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedCoach(null)
      }
      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll("button, a[href]")
        const first = focusable?.[0]
        const last = focusable?.[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleKeyDown)
      lastTriggerRef.current?.focus()
    }
  }, [selectedCoach])
  return (
    <div className="coaches-page min-h-screen bg-mlc-ink font-mlc text-white selection:bg-mlc-red">
      <Link to="#team" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-white focus:p-4 focus:text-mlc-ink">{isVi ? "Đến danh sách huấn luyện viên" : "Skip to the team"}</Link>
      <CoachesHeader showRegister={false} />
      <main id="main-content">
        <section className="coaches-hero" aria-labelledby="coaches-page-title">
          <div className="coaches-hero-photo coaches-hero-photo-left" aria-hidden="true" />
          <div className="coaches-hero-photo coaches-hero-photo-right" aria-hidden="true" />
          <div className="coaches-hero-shade" aria-hidden="true" />
          <div className="coaches-hero-grid" aria-hidden="true" />
          <div className="coaches-hero-ghost" aria-hidden="true">TEAM</div>
          <div className="relative mx-auto w-full max-w-[1280px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
            <Reveal className="max-w-3xl">
              <p className="coaches-eyebrow">AVT SPORT</p>
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

        <section id="team" className="coaches-grid-background scroll-mt-24 pb-20 pt-12 sm:pb-28 sm:pt-16" aria-label={isVi ? "Danh sách huấn luyện viên" : "Coach directory"}>
          <div className="mx-auto max-w-[1280px] px-5 sm:px-8 lg:px-12">
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
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 xl:gap-4" data-coach-grid>
              {visibleCoaches.map((coach) => (
                <button
                  key={coach.id}
                  type="button"
                  className="coaches-team-card"
                  aria-label={isVi ? `Xem thông tin huấn luyện viên ${coach.name}` : `View coach ${coach.name}'s profile`}
                  onClick={(event) => {
                    lastTriggerRef.current = event.currentTarget
                    setSelectedCoach(coach)
                  }}
                >
                  <img src={coach.image} alt={isVi ? `${coach.name} – ảnh minh họa môn ${coach.specialtyVi}` : `${coach.name} – illustrative ${coach.specialty} photo`} width="768" height="1024" loading="lazy" decoding="async" />
                  <div className="coaches-team-card-shade" aria-hidden="true" />
                  <span className="coaches-team-card-icon" aria-hidden="true"><Users className="h-5 w-5" /></span>
                  <div className="coaches-team-card-copy">
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-white/80 sm:text-xs">{isVi ? coach.specialtyVi : coach.specialty}</p>
                    <h3 className="font-display text-2xl font-extrabold uppercase leading-[1.02] sm:text-3xl">{coach.name}</h3>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
      {selectedCoach && (
        <div
          className="coaches-profile-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedCoach(null)
          }}
        >
          <section
            ref={dialogRef}
            className="coaches-profile-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="coach-profile-name"
            aria-describedby="coach-profile-description"
          >
            <div className="coaches-profile-photo-wrap">
              <img src={selectedCoach.image} alt={isVi ? `Ảnh minh họa môn ${selectedCoach.specialtyVi}` : `Illustrative ${selectedCoach.specialty} photo`} className="coaches-profile-photo" />
              <span className="coaches-profile-photo-label">AVT SPORT · COACH</span>
            </div>
            <div className="coaches-profile-content">
              <button ref={dialogCloseRef} type="button" className="coaches-profile-close" onClick={() => setSelectedCoach(null)} aria-label={isVi ? "Đóng hồ sơ" : "Close profile"}>
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
              <p className="coaches-eyebrow">{isVi ? "HUẤN LUYỆN VIÊN" : "COACH PROFILE"}</p>
              <h2 id="coach-profile-name" className="coaches-profile-name">{selectedCoach.name}</h2>
              <div className="coaches-profile-sport">
                <Target className="h-5 w-5 text-mlc-red" aria-hidden="true" />
                <span>{isVi ? selectedCoach.specialtyVi : selectedCoach.specialty}</span>
              </div>
              <p id="coach-profile-description" className="coaches-profile-description">
                {isVi
                  ? `Huấn luyện viên ${selectedCoach.specialtyVi} tại AVT Sport. Hãy liên hệ để được tư vấn lớp học phù hợp với mục tiêu và trình độ của bạn.`
                  : `A ${selectedCoach.specialty} coach at AVT Sport. Get in touch to find a class that fits your goals and experience.`}
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
