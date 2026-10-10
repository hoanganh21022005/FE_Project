import { useEffect } from "react"
import { useLocation } from "react-router-dom"

// Runs inside Suspense, after the destination page has mounted.
export function PublicPageScroll() {
  const { pathname, hash, key } = useLocation()
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" })
      return undefined
    }
    let sectionId
    try { sectionId = decodeURIComponent(hash.slice(1)) } catch { return undefined }
    let observer
    let timer
    const scrollToSection = () => {
      const target = document.getElementById(sectionId)
      if (!target) return false
      target.scrollIntoView({ block: "start", behavior: "instant" })
      observer?.disconnect()
      clearTimeout(timer)
      return true
    }
    const frame = requestAnimationFrame(() => {
      if (scrollToSection()) return
      observer = new MutationObserver(scrollToSection)
      observer.observe(document.body, { childList: true, subtree: true })
      timer = setTimeout(() => observer.disconnect(), 8000)
    })
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      clearTimeout(timer)
    }
  }, [pathname, hash, key])
  return null
}
