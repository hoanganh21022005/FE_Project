import React from "react"
import { CoachesHeader } from "./CoachesHeader"

// Keep public navigation available at every screen size, including policy pages.
export function PublicHeader() {
  return <CoachesHeader enrollmentHref="/#admission" />
}
