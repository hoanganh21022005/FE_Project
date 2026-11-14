import assert from "node:assert/strict"
import fs from "node:fs"
import { getPrivateSessionProposalErrorMessage } from "../src/utils/privateSessionProposalErrors.js"
import { resolveActiveSubscriptionDetails } from "../src/utils/memberSafetyHelpers.js"

const proposalErrors = [
  ["PROPOSAL_EXPIRED", "Đề xuất đã hết hạn"],
  ["ROOM_CONFLICT", "Phòng đã có lịch"],
  ["COACH_CONFLICT", "Coach đã bận"],
  ["MEMBER_SCHEDULE_CONFLICT", "trùng giờ"],
  ["OUT_OF_CREDIT", "không còn đủ credit"],
  ["ADVANCED_PACKAGE_EXPIRED", "đã hết hạn"],
  ["PRIMARY_COACH_REQUIRED", "Coach không phù hợp"],
]
for (const [code, expected] of proposalErrors) {
  const message = getPrivateSessionProposalErrorMessage({ status: 409, code, message: code })
  assert.ok(message.includes(expected), `${code} maps to a useful Member message`)
}

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8")
const courseCatalog = read("../src/components/views/MemberCourseCatalog.jsx")
const coachView = read("../src/components/views/CoachAssignedMembersView.jsx")
const memberCoachView = read("../src/components/views/MemberMyCoachView.jsx")
const memberScheduleView = read("../src/components/views/MemberScheduleView.jsx")
const scheduleModel = read("../src/utils/scheduleModel.js")
const proposalHelper = read("../src/utils/privateSessionProposalErrors.js")

const createOrderHandler = courseCatalog
  .split("const createOrder = async (registration) =>")[1]
  ?.split("\n  const checkOrderStatus = async (order) =>")[0]
assert.ok(createOrderHandler, "Advanced purchase order handler exists")
assert.match(createOrderHandler, /orderInFlightRef\.current\.has\(registrationKey\)/)
assert.match(createOrderHandler, /isConfirmationExpiredError\(error\)/)
assert.match(courseCatalog, /REGISTRATION_CONFIRMATION_EXPIRED/)
assert.match(createOrderHandler, /await refreshRegistrations\(\)\.catch\(\(\) => \{\}\)/)
assert.match(createOrderHandler, /setExpiredConfirmationIds/)
assert.match(createOrderHandler, /Please submit a new Advanced registration/)
assert.match(courseCatalog, /retryAfterExpiredSuffix/)
assert.doesNotMatch(createOrderHandler.split("if (isConfirmationExpiredError(error))")[1]?.split("return")[0] || "", /createAdvancedOrder/)
assert.match(createOrderHandler, /keepOrderLocked = true/)

const proposalSendHandler = coachView
  .split("const handleSendPrivateSessionProposal = async (e) => {")[1]
  ?.split("\n  const [memberSearchQuery")[0]
assert.ok(proposalSendHandler, "Coach proposal handler exists")
assert.match(coachView, /const \[requestKey, setRequestKey\] = useState\(\(\) => generateRequestKey\(\)\)/)
assert.match(proposalSendHandler, /isSubmittingRef\.current \|\| bookingBusy/)
assert.match(proposalSendHandler, /memberPortalApi\.createPrivateSessionProposal\(payload\)/)
assert.match(proposalSendHandler, /memberPortalApi\.getPrivateSessionProposals\(\)/)
assert.match(proposalSendHandler, /matchingProposal/)
assert.match(proposalSendHandler, /same schedule and requestKey/)
assert.match(proposalSendHandler, /item\.sessionId == null/)
assert.doesNotMatch(proposalSendHandler.split("} catch (error) {")[1] || "", /createPrivateSessionProposal\(payload\)/)

const acceptHandler = memberCoachView
  .split("const handleAcceptProposal = async (proposal) => {")[1]
  ?.split("\n  useEffect(() => {")[0]
assert.ok(acceptHandler, "Member Accept handler exists")
assert.match(acceptHandler, /proposalDecisionInFlightRef\.current/)
assert.match(acceptHandler, /respondToPrivateSessionProposal\(proposal\.id, true\)/)
assert.match(acceptHandler, /PROPOSAL_EXPIRED|reloadBackendState/)
assert.match(acceptHandler, /getPrivateSessionProposalById\(proposal\.id\)/)
assert.match(acceptHandler, /getClassSessions\(\{ memberId: memberProfileId \}\)/)
assert.match(acceptHandler, /getMemberSubscriptions\(memberProfileId\)/)
assert.match(memberCoachView, /const successMessage = isVi \? "Đã xác nhận lịch tập thành công"/)
assert.match(memberCoachView, /cancellationResult\?\.creditReturned === true/)
assert.doesNotMatch(memberCoachView, /memberPortalApi\.bookPrivateSession/)

const slotBlock = coachView.match(/const STANDARD_PRIVATE_SESSION_SLOTS = \[([\s\S]*?)\n\]/)?.[1]
assert.ok(slotBlock, "Advanced coach slots are defined")
const slots = [...slotBlock.matchAll(/\[(\d+), "(\d{2}:\d{2})", "(\d{2}:\d{2})"\]/g)]
assert.equal(slots.length, 7)
for (const [, , start, end] of slots) {
  const toMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
  assert.equal(toMinutes(end) - toMinutes(start), 90)
}
assert.match(courseCatalog, /45 days from activation/)
assert.match(courseCatalog, /subscription\.validityDays/)
assert.match(courseCatalog, /order\.expiresAt/)
assert.match(courseCatalog, /invoiceApi\.getMemberOwnInvoiceById\(order\.invoiceId\)/)
assert.deepEqual(resolveActiveSubscriptionDetails(null), {
  hasCredit: false,
  remainingCredit: null,
  hasValidityDays: false,
  validityDays: null,
  packageType: null,
  effectiveStartDate: null,
  effectiveEndDate: null,
})
assert.equal(resolveActiveSubscriptionDetails({ remainingCredit: 11, validityDays: 45 }).remainingCredit, 11)
assert.equal(resolveActiveSubscriptionDetails({ remainingCredit: 11, validityDays: 45 }).validityDays, 45)
assert.match(scheduleModel, /PT_CANCEL_REFUND_HOURS_BEFORE = 12/)
assert.match(memberScheduleView, /await cancelPrivateSession\(sid\)[\s\S]*?await refresh\(\)/)
assert.doesNotMatch(memberCoachView, /remainingCredit\s*[-+]=/)
assert.doesNotMatch(proposalHelper, /setRemainingCredit|remainingCredit\s*[-+]=/)

console.log("Part 8 Advanced edge-case and regression checks passed.")
