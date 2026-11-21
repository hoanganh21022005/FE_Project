import React from 'react'
import { MemberCourseCatalog } from './MemberCourseCatalog'

// The request workflow shares its API state and payment actions with the course
// catalog, while rendering as a dedicated member page.
export function MemberRegistrationRequestsView() {
  return <MemberCourseCatalog requestsOnly />
}

export default MemberRegistrationRequestsView
