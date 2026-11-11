export function revenueTimelineForDisplay(report) {
  if (!report || report.totalTransactions === 0) return []
  return Array.isArray(report.timeline) ? report.timeline : []
}

export function revenueSummaryCsvRows(report) {
  return [
    ['totalRevenue', report?.totalRevenue ?? null],
    ['moneyReceived', report?.moneyReceived ?? null],
    ['moneyRefunded', report?.moneyRefunded ?? null],
    ['netReceived', report?.netReceived ?? null],
    ['cashCorrectionsRecorded', report?.cashCorrectionsRecorded ?? null],
  ]
}

export function serializeCsvRows(rows) {
  return '\uFEFF' + rows.map((row) => row.map((value) => {
    const text = value === null || value === undefined ? 'null' : String(value)
    return `"${text.replace(/"/g, '""')}"`
  }).join(',')).join('\n')
}
