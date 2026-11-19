import assert from "node:assert/strict"
import fs from "node:fs"
import { memberPortalApi } from "../src/api/memberPortalApi.js"
import { membershipApi } from "../src/api/membershipApi.js"

const calls = []
const session = {
  id: 901,
  bookedMemberId: 11,
  coachId: 7,
  roomId: 5,
  isPrivate: true,
  status: "Scheduled",
  sessionDate: "2026-11-20",
  startTime: "06:00:00",
  endTime: "07:30:00",
}
const accepted = {
  id: 314,
  subscriptionId: 42,
  memberId: 11,
  coachId: 7,
  roomId: 5,
  subjectId: 3,
  status: "Accepted",
  sessionId: 901,
  session,
}

globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options })
  let body = accepted
  if (String(url).includes("/api/sessions?")) body = [session]
  if (String(url).endsWith("/subscriptions")) body = [{
    subscriptionId: 42,
    status: "Active",
    packageType: "Advanced",
    remainingCredit: 11,
  }]
  if (String(url).endsWith("/private-session-proposals")) body = [accepted]
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}

const postResponse = await memberPortalApi.respondToPrivateSessionProposal(314, true)
assert.equal(calls[0].options.method, "POST")
assert.match(calls[0].url, /\/api\/private-session-proposals\/314\/respond$/)
assert.deepEqual(JSON.parse(calls[0].options.body), { accepted: true })
assert.equal(postResponse.status, "Accepted")
assert.equal(postResponse.sessionId, 901)
assert.equal(postResponse.session.id, 901)
assert.equal(postResponse.session.status, "Scheduled")

const proposal = await memberPortalApi.getPrivateSessionProposalById(314)
const proposals = await memberPortalApi.getPrivateSessionProposals()
const schedule = await memberPortalApi.getClassSessions({ memberId: 11 })
const subscriptions = await membershipApi.getMemberSubscriptions(11)
assert.equal(proposal.status, "Accepted")
assert.equal(proposals[0].sessionId, 901)
assert.equal(schedule[0].id, 901)
assert.equal(subscriptions[0].remainingCredit, 11)
assert.deepEqual(calls.map(({ options }) => options.method || "GET"), ["POST", "GET", "GET", "GET", "GET"])
assert.match(calls[1].url, /\/api\/private-session-proposals\/314$/)
assert.match(calls[2].url, /\/api\/private-session-proposals$/)
assert.match(calls[3].url, /\/api\/sessions\?memberId=11$/)
assert.match(calls[4].url, /\/api\/members\/11\/subscriptions$/)

const view = fs.readFileSync(new URL("../src/components/views/MemberMyCoachView.jsx", import.meta.url), "utf8")
const acceptHandler = view.split("const handleAcceptProposal = async (proposal) => {")[1]?.split("\n  useEffect(() => {", 1)[0]
assert.ok(acceptHandler, "Member accept handler exists")
assert.match(acceptHandler, /proposalDecisionInFlightRef\.current/)
assert.match(acceptHandler, /respondToPrivateSessionProposal\(proposal\.id, true\)/)
assert.match(acceptHandler, /getPrivateSessionProposalById\(proposal\.id\)/)
assert.match(acceptHandler, /getClassSessions\(\{ memberId: memberProfileId \}\)/)
assert.match(acceptHandler, /getMemberSubscriptions\(memberProfileId\)/)
assert.match(acceptHandler, /confirmedSubscription\.remainingCredit/)
assert.doesNotMatch(view, /memberPortalApi\.bookPrivateSession/)

console.log("Member proposal Accept checks passed: exact request, authoritative Session, schedule and credit refresh.")
