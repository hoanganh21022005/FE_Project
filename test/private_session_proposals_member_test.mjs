import assert from "node:assert/strict"
import fs from "node:fs"
import { memberPortalApi } from "../src/api/memberPortalApi.js"

const calls = []
const pending = {
  id: 314,
  subscriptionId: 42,
  memberId: 11,
  coachId: 7,
  roomId: 5,
  subjectId: 3,
  sessionDate: "2026-11-20",
  startTime: "06:00:00",
  endTime: "07:30:00",
  status: "Pending",
  sessionId: null,
  respondBy: "2026-11-19T18:00:00",
}
const rejected = { ...pending, status: "Rejected" }

globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options })
  const body = String(url).endsWith("/respond") ? rejected : [pending]
  return new Response(JSON.stringify(body), {
    status: String(url).endsWith("/respond") ? 200 : 200,
    headers: { "content-type": "application/json" },
  })
}

const proposals = await memberPortalApi.getPrivateSessionProposals()
assert.deepEqual(proposals, [pending])
assert.equal(calls[0].options.method || "GET", "GET")
assert.match(calls[0].url, /\/api\/private-session-proposals$/)
assert.doesNotMatch(calls[0].url, /\?/)

const response = await memberPortalApi.respondToPrivateSessionProposal(314, false)
assert.equal(response.status, "Rejected")
assert.equal(response.sessionId, null)
assert.match(calls[1].url, /\/api\/private-session-proposals\/314\/respond$/)
assert.equal(calls[1].options.method, "POST")
assert.deepEqual(JSON.parse(calls[1].options.body), { accepted: false })
assert.equal(new Headers(calls[1].options.headers).get("Content-Type"), "application/json")

await memberPortalApi.getPrivateSessionProposals()
assert.equal(calls.length, 3, "the UI flow must GET again after responding")
assert.match(calls[2].url, /\/api\/private-session-proposals$/)

await assert.rejects(() => memberPortalApi.respondToPrivateSessionProposal(0, false))
await assert.rejects(() => memberPortalApi.respondToPrivateSessionProposal(314, "false"))
assert.equal(calls.length, 3, "invalid response inputs must not make a request")

const view = fs.readFileSync(new URL("../src/components/views/MemberMyCoachView.jsx", import.meta.url), "utf8")
const rejectHandler = view.split("const handleRejectProposal = async (proposal) => {")[1]?.split("\n  useEffect(() => {", 1)[0]
assert.ok(rejectHandler, "Member reject handler exists")
assert.match(rejectHandler, /proposalDecisionInFlightRef\.current/)
assert.match(rejectHandler, /respondToPrivateSessionProposal\(proposal\.id, false\)/)
assert.match(rejectHandler, /await fetchPrivateSessionProposals\(\)/)
assert.match(view, /status \|\| ""\)\.toLowerCase\(\) === "pending" && proposal\.sessionId == null/)
assert.match(view, /isPositiveSessionId\(s\.id\)/)
assert.match(view, /scheduledStatuses\.has\(status\)/)
assert.doesNotMatch(view, /memberPortalApi\.bookPrivateSession/)
assert.doesNotMatch(view, /isBookingModalOpen|handleOpenBookingModal|handleBookingSubmit|MODAL 1: CHECK COACH AVAILABILITY/)
assert.match(view, /onClick=\{\(\) => setActiveTab\("my_sessions"\)\}/)
assert.match(view, /Schedule & proposals/)

console.log("Member private-session proposal checks passed: scoped list endpoint, Reject payload, reload, session separation, and no legacy self-book flow.")
