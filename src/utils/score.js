/**
 * Coach Portal Progress Score Utilities (P1.4)
 * Single scale 0–10, 1 decimal place, no percentage labels or Math.round
 */

/**
 * Normalizes any numeric score (0–10 or 0–100) to 0.0–10.0 with 1 decimal place
 */
export function normalizeScore(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return 0;
  const scaled = num > 10 && num <= 100 ? num / 10 : num;
  const clamped = Math.max(0, Math.min(10, scaled));
  return Number(clamped.toFixed(1));
}

/**
 * Formats score as "6.5/10" without rounding to integer
 */
export function formatScore(val) {
  if (val === null || val === undefined || val === '') return '—';
  const num = Number(val);
  if (!Number.isFinite(num)) return '—';
  const normalized = normalizeScore(num);
  return `${normalized.toFixed(1)}/10`;
}

/**
 * Converts a 0–10 score to a CSS width percentage (0–100) for progress bar fill
 */
export function scoreToBarWidthPercent(val) {
  const normalized = normalizeScore(val);
  return Math.max(0, Math.min(100, Number((normalized * 10).toFixed(1))));
}
