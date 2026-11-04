import React from "react"
import { Link } from "react-router-dom"
import { CoachesHeader } from "../layout/CoachesHeader"
import { PublicFooter } from "../layout/PublicFooter"
import { FacilitiesExperience } from "../facilities/FacilitiesExperience"
import { useSCMS } from "../../context/SCMSContext"

export function FacilitiesView() {
  const { language } = useSCMS()
  const isVi = language === "vi"

  return (
    <div className="min-h-screen bg-white font-mlc text-mlc-ink">
      <Link to="#facilities" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-white focus:p-4 focus:text-mlc-ink">
        {isVi ? "Bỏ qua điều hướng" : "Skip to facilities"}
      </Link>
      <CoachesHeader showRegister={false} />
      <main id="main-content">
        <FacilitiesExperience />
      </main>
      <PublicFooter />
    </div>
  )
}
