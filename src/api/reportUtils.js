export function revenueTimelineForDisplay(report) {
  if (!report || report.totalTransactions === 0) return []
  return Array.isArray(report.timeline) ? report.timeline : []
}
