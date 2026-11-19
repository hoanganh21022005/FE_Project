import assert from "node:assert/strict"
import {
  PACKAGE_WRITES_RETIRED,
  arePackageWritesHidden,
  formatLegacyMembershipError,
} from "../src/utils/packageRetirement.js"

assert.equal(PACKAGE_WRITES_RETIRED, true)
assert.equal(arePackageWritesHidden(true), true)
assert.equal(arePackageWritesHidden(false), false)

const msgVi = formatLegacyMembershipError(
  { status: 400, code: "LEGACY_MEMBERSHIP_RETIRED", details: { code: "LEGACY_MEMBERSHIP_RETIRED" } },
  "vi",
)
assert.equal(typeof msgVi, "string")
assert.ok(msgVi.length > 0 && msgVi !== "LEGACY_MEMBERSHIP_RETIRED")

const msgEn = formatLegacyMembershipError(
  { status: 400, code: "LEGACY_MEMBERSHIP_RETIRED", details: { code: "LEGACY_MEMBERSHIP_RETIRED" } },
  "en",
)
assert.equal(typeof msgEn, "string")
assert.ok(msgEn.length > 0 && msgEn !== "LEGACY_MEMBERSHIP_RETIRED")

console.log("e5_package_retirement_test: all assertions passed")
