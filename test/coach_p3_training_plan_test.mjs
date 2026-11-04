import assert from "node:assert/strict"
import { serializePlan, parsePlan } from "../src/utils/trainingPlan.js"

// 1. serializePlan & parsePlan round-trip (structured v1)
const serialized = serializePlan({
  exercises: [
    { name: "Back Squat", sets: 4, reps: "8-10", load: "60kg" },
    { name: "Footwork 4 góc sân", sets: 3, reps: "15 phút", load: "Tốc độ cao" },
  ],
  notes: "Khởi động kỹ khớp gối và cổ chân 10 phút trước buổi tập.",
})

const parsed = parsePlan(serialized)
assert.equal(parsed.structured, true)
assert.equal(parsed.exercises.length, 2)
assert.equal(parsed.exercises[0].name, "Back Squat")
assert.equal(parsed.exercises[0].sets, 4)
assert.equal(parsed.exercises[0].reps, "8-10")
assert.equal(parsed.exercises[0].load, "60kg")
assert.equal(
  parsed.notes,
  "Khởi động kỹ khớp gối và cổ chân 10 phút trước buổi tập.",
)

// 2. parsePlan backward-compatible with legacy plain text
const legacyText =
  "Buổi 1-4: Khởi động khớp chuyên sâu.\nBuổi 5-8: Kỹ thuật đánh cầu bền."
const parsedLegacy = parsePlan(legacyText)
assert.equal(parsedLegacy.structured, false)
assert.deepEqual(parsedLegacy.exercises, [])
assert.equal(parsedLegacy.notes, legacyText)

// 3. parsePlan with null / empty string / invalid JSON starting with '{'
assert.deepEqual(parsePlan(null), {
  structured: false,
  exercises: [],
  notes: "",
})
assert.deepEqual(parsePlan(""), {
  structured: false,
  exercises: [],
  notes: "",
})
const malformedJson = "{not valid json"
assert.deepEqual(parsePlan(malformedJson), {
  structured: false,
  exercises: [],
  notes: malformedJson,
})

console.log("PASS: coach_p3_training_plan_test.mjs")
