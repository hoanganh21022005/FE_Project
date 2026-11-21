import assert from "node:assert/strict"
import test from "node:test"
import fs from "node:fs"
import path from "node:path"
import {
  extractNormalClassSequence,
  getMaxNormalClassSequence,
  hasDuplicateClassName,
  suggestNormalClassName,
} from "../src/components/modals/new-class/classNameSuggestion.js"

test("1. No existing classes -> suggests N01", () => {
  assert.equal(suggestNormalClassName({ sportName: "Cầu lông", classes: [] }), "Cầu lông Normal N01")
})

test("2. Existing N01, N02 -> suggests N03", () => {
  const classes = [
    { id: 1, name: "Cầu lông Normal N01", classType: "Normal" },
    { id: 2, name: "Bóng đá Normal N02", classType: "Normal" },
  ]
  assert.equal(suggestNormalClassName({ sportName: "Yoga", classes }), "Yoga Normal N03")
})

test("3. Existing N07, N10, N12 -> suggests N13", () => {
  const classes = [
    { id: 1, name: "Bóng đá Normal N07", classType: "Normal" },
    { id: 2, name: "Cầu lông Normal N10", classType: "Normal" },
    { id: 3, name: "Cầu lông Normal N12", classType: "Normal" },
  ]
  assert.equal(suggestNormalClassName({ sportName: "Pickleball", classes }), "Pickleball Normal N13")
})

test("4. Switching sport keeps shared N sequence across all Normal classes", () => {
  const classes = [
    { id: 1, name: "Yoga Normal N12", classType: "Normal" },
  ]
  assert.equal(suggestNormalClassName({ sportName: "Yoga", classes }), "Yoga Normal N13")
  assert.equal(suggestNormalClassName({ sportName: "Cầu lông", classes }), "Cầu lông Normal N13")
})

test("8. Cancelled and closed Normal classes are still included in max N calculation", () => {
  const classes = [
    { id: 1, name: "Cầu lông Normal N10", status: "closed", classType: "Normal" },
    { id: 2, name: "Cầu lông Normal N12", status: "cancelled", classType: "Normal" },
    { id: 3, name: "Bơi lội Normal N03", status: "open", classType: "Normal" },
  ]
  assert.equal(getMaxNormalClassSequence(classes), 12)
  assert.equal(suggestNormalClassName({ sportName: "Bơi lội", classes }), "Bơi lội Normal N13")
})

test("9. Non-matching names and Advanced classes do not affect sequence", () => {
  const classes = [
    { id: 1, name: "Bóng đá Test", classType: "Normal" },
    { id: 2, name: "ZZ E2E R2 20-11", classType: "Normal" },
    { id: 3, name: "Bóng đá K99", classType: "Normal" },
    { id: 4, name: "Normal 88", classType: "Normal" },
    { id: 5, name: "Tennis - Advanced #AR04", classType: "Advanced" },
    { id: 6, name: "Yoga Normal N99", classType: "Advanced" },
    { id: 7, name: "Cầu lông Normal N05", classType: "Normal" },
  ]
  assert.equal(extractNormalClassSequence("Bóng đá Test"), null)
  assert.equal(extractNormalClassSequence("Bóng đá K99"), null)
  assert.equal(getMaxNormalClassSequence(classes), 5)
  assert.equal(suggestNormalClassName({ sportName: "Cầu lông", classes }), "Cầu lông Normal N06")
})

test("10. N09 -> N10 and N99 -> N100 padding works without errors", () => {
  assert.equal(
    suggestNormalClassName({ sportName: "Yoga", classes: [{ name: "Cầu lông Normal N09" }] }),
    "Yoga Normal N10",
  )
  assert.equal(
    suggestNormalClassName({ sportName: "Yoga", classes: [{ name: "Cầu lông Normal N99" }] }),
    "Yoga Normal N100",
  )
})

test("Duplicate detection & bounded collision check", () => {
  const classes = [
    { id: 1, name: "Cầu lông Normal N01", classType: "Normal" },
  ]
  assert.equal(hasDuplicateClassName("  cầu lông normal n01 ", classes), true)
  assert.equal(hasDuplicateClassName("Cầu lông Normal N02", classes), false)
})

test("5,6,7,11,12,13. NewClassModal integrates auto-name, manual override, suggest button, i18n, and error retention", () => {
  const modalSource = fs.readFileSync(
    path.resolve("src/components/modals/NewClassModal.jsx"),
    "utf8",
  )
  assert.match(modalSource, /const \[isAutoName, setIsAutoName\] = useState\(true\)/)
  assert.match(modalSource, /if \(!isOpen \|\| !isAutoName \|\| classesLoading \|\| !currentSport\?\.name\) return/)
  assert.match(modalSource, /setIsAutoName\(false\)/)
  assert.match(modalSource, /isVi \? "Tên lớp học" : "Class name"/)
  assert.match(modalSource, /setSubmitError\(msg\)/)
  assert.doesNotMatch(modalSource, /isAutoName\s*:/)
})
