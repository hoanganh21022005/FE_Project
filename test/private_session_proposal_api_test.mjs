import assert from "node:assert/strict"
import fs from "node:fs"
import { memberPortalApi } from "../src/api/memberPortalApi.js"

const calls = []
globalThis.fetch = async (url, options) => {
  calls.push({ url: String(url), options })
  return new Response(JSON.stringify({
    id: 314,
    status: "Pending",
    sessionId: null,
    respondBy: "2026-11-19T18:00:00",
  }), {
    status: 201,
    headers: { "content-type": "application/json" },
  })
}

const payload = {
  subscriptionId: 42,
  subjectId: 3,
  coachId: 7,
  roomId: 5,
  sessionDate: "2026-11-20",
  startTime: "06:00",
  endTime: "07:30",
  agreementConfirmed: true,
  requestKey: "proposal-42-20261120-a",
}

const response = await memberPortalApi.createPrivateSessionProposal(payload)
assert.equal(calls.length, 1)
assert.match(calls[0].url, /\/api\/private-session-proposals$/)
assert.equal(calls[0].options.method, "POST")
assert.deepEqual(JSON.parse(calls[0].options.body), payload)
assert.equal(response.id, 314)
assert.equal(response.status, "Pending")
assert.equal(response.sessionId, null)
assert.equal(response.respondBy, "2026-11-19T18:00:00")

for (const invalid of [
  { ...payload, agreementConfirmed: false },
  { ...payload, startTime: "06:15", endTime: "07:45" },
  { ...payload, roomId: null },
  { ...payload, requestKey: "" },
]) {
  await assert.rejects(() => memberPortalApi.createPrivateSessionProposal(invalid))
}
assert.equal(calls.length, 1, "invalid proposal data must be blocked before POST")

const coachView = fs.readFileSync(new URL("../src/components/views/CoachAssignedMembersView.jsx", import.meta.url), "utf8")
const proposalHandler = coachView.split("const handleSendPrivateSessionProposal = async (e) => {")[1]?.split("\n  const [memberSearchQuery")[0]
assert.ok(proposalHandler, "Coach proposal submit handler exists")
assert.match(proposalHandler, /isSubmittingRef\.current \|\| bookingBusy/)
assert.match(proposalHandler, /isSubmittingRef\.current = true/)
assert.match(proposalHandler, /agreementConfirmed: true/)
assert.match(proposalHandler, /memberPortalApi\.createPrivateSessionProposal\(payload\)/)
assert.doesNotMatch(proposalHandler, /bookPrivateSession|book-private|setCoachSessions|remainingCredit\s*[-=]/)
assert.doesNotMatch(coachView, /memberPortalApi\.bookPrivateSession/)

console.log("Private session proposal API checks passed: 201 Pending response, exact payload, guardrails, no direct Coach booking.")
