const normalized = (value) => String(value ?? '').trim().toLowerCase()

const knownNumber = (value) => {
  const number = Number(value)
  return value !== null && value !== undefined && value !== '' && Number.isFinite(number)
    ? number
    : null
}

export const evaluateNormalTransferTargetForUi = (source, target) => {
  if (!source || !target) return { canSelect: false, reason: 'unverified' }
  if (String(source.id) === String(target.id)) return { canSelect: false, reason: 'same-class' }
  if (normalized(target.classType) !== 'normal') return { canSelect: false, reason: 'not-normal' }
  if (normalized(target.apiStatus ?? target.status) !== 'open') return { canSelect: false, reason: 'not-open' }
  if (target.changePending === true) return { canSelect: false, reason: 'change-pending' }

  const sourceSubject = knownNumber(source.subjectId)
  const targetSubject = knownNumber(target.subjectId)
  if (sourceSubject === null || targetSubject === null) return { canSelect: false, reason: 'subject-unverified' }
  if (sourceSubject !== targetSubject) return { canSelect: false, reason: 'different-subject' }
  const sourceSubjectName = normalized(source.subjectName ?? source.category)
  const targetSubjectName = normalized(target.subjectName ?? target.category)
  if (sourceSubjectName && targetSubjectName && sourceSubjectName !== targetSubjectName) {
    return { canSelect: false, reason: 'subject-name-mismatch' }
  }

  const sourceFee = knownNumber(source.tuitionFee)
  const targetFee = knownNumber(target.tuitionFee)
  if (sourceFee === null || targetFee === null) return { canSelect: false, reason: 'fee-unverified' }
  if (sourceFee !== targetFee) return { canSelect: false, reason: 'different-fee' }

  const sourceCenter = knownNumber(source.centerId)
  const targetCenter = knownNumber(target.centerId)
  if (sourceCenter !== null && targetCenter !== null && sourceCenter !== targetCenter) {
    return { canSelect: false, reason: 'different-center' }
  }

  const centerUnverified = sourceCenter === null || targetCenter === null
  return {
    canSelect: true,
    reason: centerUnverified ? 'center-unverified' : null,
    requiresBackendCheck: centerUnverified || target.changePending == null,
  }
}

export const filterNormalTransferTargetsForUi = (source, classes) =>
  (Array.isArray(classes) ? classes : []).filter((target) =>
    evaluateNormalTransferTargetForUi(source, target).canSelect,
  )

export const summarizeNormalProposalChoices = (proposal) => {
  const choices = proposal?.choices
  if (!Array.isArray(choices) || choices.some((item) => !item || typeof item.choice !== 'string')) {
    return { verified: false, total: null, waiting: null, accepted: null, refunds: null, unknown: null }
  }
  const counts = { Waiting: 0, Accept: 0, Refund: 0 }
  let unknown = 0
  for (const item of choices) {
    const choice = Object.keys(counts).find((key) => key.toLowerCase() === normalized(item.choice))
    if (!choice) unknown += 1
    else counts[choice] += 1
  }
  if (unknown) return { verified: false, total: choices.length, waiting: null, accepted: null, refunds: null, unknown }
  return {
    verified: true,
    total: choices.length,
    waiting: counts.Waiting,
    accepted: counts.Accept,
    refunds: counts.Refund,
    unknown: 0,
  }
}

export const getNormalTransferRemainingSeats = (classItem) => {
  const capacity = knownNumber(classItem?.maxCapacity ?? classItem?.capacity)
  const enrolled = knownNumber(classItem?.enrolledCount)
  if (capacity === null || enrolled === null || capacity < 0 || enrolled < 0) return null
  return Math.max(0, capacity - enrolled)
}
