export const PACKAGE_TYPES = ['Normal', 'Advanced']

export function packageTypeOf(value) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return PACKAGE_TYPES.find((type) => type.toLowerCase() === normalized) ?? null
}

export function packagesForType(packages, type) {
  return (packages || []).filter((item) => packageTypeOf(item.packageType) === type)
}

export function unclassifiedPackages(packages) {
  return (packages || []).filter((item) => packageTypeOf(item.packageType) === null)
}

const HIDDEN_PACKAGE_IDS = new Set(['1', '2', '3', '4', '5', '9'])

export function isVisibleManagerPackage(item) {
  return item?.price !== 0 && !HIDDEN_PACKAGE_IDS.has(String(item?.id ?? ''))
}

export function subjectPriceForType(subject, type) {
  return type === 'Advanced' ? subject.advancedPrice : subject.normalPrice
}

export function subjectsWithNonzeroPrice(subjects, type) {
  return (subjects || []).filter((subject) => subjectPriceForType(subject, type) !== 0)
}

export function duplicateSubjectIds(subjects) {
  const groups = new Map()
  for (const subject of subjects || []) {
    for (const value of [subject.name, subject.slug]) {
      const key = String(value ?? '').trim().toLocaleLowerCase('vi')
      if (!key) continue
      const ids = groups.get(key) ?? new Set()
      ids.add(subject.id)
      groups.set(key, ids)
    }
  }
  return new Set([...groups.values()].filter((ids) => ids.size > 1).flatMap((ids) => [...ids]))
}

export async function loadPackageManagementData(api, onSubjects, onPackages) {
  const settle = (request, notify) => Promise.resolve()
    .then(() => request({ notifyForbidden: false }))
    .then(
      (value) => ({ status: 'fulfilled', value }),
      (reason) => ({ status: 'rejected', reason }),
    )
    .then((result) => { notify?.(result); return result })
  const [subjects, packages] = await Promise.all([
    settle(api.getSubjects, onSubjects),
    settle(api.getPackages, onPackages),
  ])
  return { subjects, packages }
}
