import React, { useEffect, useRef, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { ChevronDown, Menu, X } from "lucide-react"
import { useSCMS } from "../../context/SCMSContext"
import { publicSports } from "../../data/publicCoaches"

export function CoachesHeader({ enrollmentHref = "#enrollment" }) {
  const { language, setLanguage } = useSCMS()
  const isVi = language === "vi"
  const [menuOpen, setMenuOpen] = useState(false)
  const [coursesOpen, setCoursesOpen] = useState(false)
  const headerRef = useRef(null)
  const courseTriggerRef = useRef(null)
  const location = useLocation()
  const isCoursePage = location.pathname.startsWith("/courses/")
  useEffect(() => {
    setMenuOpen(false)
    setCoursesOpen(false)
  }, [location.pathname])
  useEffect(() => {
    if (!coursesOpen) return undefined
    const closeOnOutside = (event) => {
      if (!headerRef.current?.contains(event.target)) setCoursesOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setCoursesOpen(false)
        courseTriggerRef.current?.focus()
      }
    }
    document.addEventListener("pointerdown", closeOnOutside)
    document.addEventListener("keydown", closeOnEscape)
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside)
      document.removeEventListener("keydown", closeOnEscape)
    }
  }, [coursesOpen])
  const links = [
    ["/", "Trang chủ", "Home"],
    ["/about", "Về chúng tôi", "About us"],
    ["/#courses", "Khóa học", "Courses"],
    ["/coaches", "Huấn luyện viên", "Coaches"],
    ["/#facilities", "Cơ sở vật chất", "Facilities"],
    [enrollmentHref, "Tuyển sinh", "Admissions"],
  ]
  const renderLinks = (mobile = false) => links.map(([href, vi, en]) => href === "/#courses" ? (
    <div key={href} className="relative">
      <button
        ref={mobile === menuOpen ? courseTriggerRef : undefined}
        type="button"
        aria-expanded={coursesOpen}
        aria-controls={mobile ? "public-mobile-courses" : "public-desktop-courses"}
        onClick={() => setCoursesOpen(!coursesOpen)}
        className={`coaches-nav-link inline-flex items-center gap-2 ${mobile ? "coaches-nav-link-mobile w-full justify-between" : ""} ${isCoursePage ? "is-current" : ""}`}
      >{isVi ? vi : en}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${coursesOpen ? "rotate-180" : ""}`} aria-hidden="true" /></button>
      {coursesOpen && (
        <div id={mobile ? "public-mobile-courses" : "public-desktop-courses"} className={mobile ? "grid gap-1 pb-3 pl-3" : "absolute left-0 top-full mt-3 max-h-[70vh] min-w-56 overflow-y-auto border border-mlc-border bg-white p-2 shadow-xl"}>
          <Link to="/#courses" onClick={() => { setCoursesOpen(false); setMenuOpen(false) }} className="block px-3 py-2.5 text-xs font-semibold hover:bg-mlc-surface hover:text-mlc-red">{isVi ? "Tất cả khóa học" : "All courses"}</Link>
          {publicSports.map((sport) => (
            <Link key={sport.id} to={`/courses/${sport.id}`} onClick={() => { setCoursesOpen(false); setMenuOpen(false) }} aria-current={location.pathname === `/courses/${sport.id}` ? "page" : undefined} className={`block px-3 py-2.5 text-xs font-semibold hover:bg-mlc-surface hover:text-mlc-red ${location.pathname === `/courses/${sport.id}` ? "bg-mlc-surface text-mlc-red" : ""}`}>{isVi ? sport.title : sport.titleEn}</Link>
          ))}
        </div>
      )}
    </div>
  ) : (
    <Link
      key={href}
      to={href}
      aria-current={href === location.pathname ? "page" : undefined}
      onClick={() => { setMenuOpen(false); setCoursesOpen(false) }}
      className={`coaches-nav-link ${mobile ? "coaches-nav-link-mobile" : ""} ${href === location.pathname ? "is-current" : ""}`}
    >
      {isVi ? vi : en}
    </Link>
  ))

  return (
    <header ref={headerRef} className="sticky top-0 z-50 border-b border-mlc-border bg-white/95 text-mlc-ink backdrop-blur-md">
      <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-5 px-5 sm:px-8 lg:px-12">
        <Link to="/" aria-label={isVi ? "VIBE Sport, trang chủ" : "VIBE Sport, home"} className="shrink-0">
          <img src="/images/vibe-sport-logo.png?v=2" alt="VIBE Sport" className="h-14 w-24 object-contain sm:h-16 sm:w-28" />
        </Link>
        <nav aria-label={isVi ? "Điều hướng chính" : "Main navigation"} className="hidden items-center gap-4 xl:flex">
          {renderLinks()}
        </nav>
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-1 text-xs font-bold" aria-label={isVi ? "Ngôn ngữ" : "Language"}>
            <button type="button" onClick={() => setLanguage("vi")} aria-pressed={isVi} className={`p-1.5 ${isVi ? "text-mlc-red" : "text-mlc-muted"}`}>VI</button>
            <span aria-hidden="true" className="text-mlc-border">/</span>
            <button type="button" onClick={() => setLanguage("en")} aria-pressed={!isVi} className={`p-1.5 ${!isVi ? "text-mlc-red" : "text-mlc-muted"}`}>EN</button>
          </div>
          <Link to="/login" className="hidden text-xs font-bold hover:text-mlc-red sm:block">{isVi ? "Đăng nhập" : "Login"}</Link>
          <Link to="/register" className="hidden rounded-full bg-mlc-red px-5 py-3 text-xs font-bold text-white shadow-mlc transition hover:bg-rose-700 sm:block">
            {isVi ? "Đăng ký ngay" : "Join now"}
          </Link>
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="coaches-mobile-menu"
            aria-label={isVi ? (menuOpen ? "Đóng menu" : "Mở menu") : (menuOpen ? "Close menu" : "Open menu")}
            onClick={() => { setMenuOpen(!menuOpen); setCoursesOpen(false) }}
            onKeyDown={(event) => { if (event.key === "Escape") setMenuOpen(false) }}
            className="flex h-11 w-11 items-center justify-center xl:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav id="coaches-mobile-menu" aria-label={isVi ? "Điều hướng di động" : "Mobile navigation"} className="flex max-h-[calc(100dvh-76px)] flex-col overflow-y-auto border-t border-mlc-border px-5 pb-5 xl:hidden">
          {renderLinks(true)}
          <div className="mt-4 flex gap-4 text-sm font-bold">
            <Link to="/login">{isVi ? "Đăng nhập" : "Login"}</Link>
            <Link to="/register" className="text-mlc-red">{isVi ? "Đăng ký ngay" : "Join now"}</Link>
          </div>
        </nav>
      )}
    </header>
  )
}
