/**
 * Coach Portal Date/Time Formatting Utilities (P1.3)
 * Timezone: Asia/Ho_Chi_Minh
 */

const WEEKDAYS_VI = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
];

const WEEKDAYS_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function parseIsoOrDate(iso) {
  if (!iso) return null;
  if (iso instanceof Date) {
    return Number.isNaN(iso.getTime()) ? null : iso;
  }
  const str = String(iso).trim();
  if (!str) return null;
  const dateOnlyMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const normalized = str.includes('T') ? str : str.replace(' ', 'T');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * formatDate(iso) -> dd/MM/yyyy
 */
export function formatDate(iso) {
  if (!iso) return '—';
  const str = String(iso).trim();
  const dateOnlyMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch && !str.includes('Z') && !str.includes('+')) {
    const [, yyyy, mm, dd] = dateOnlyMatch;
    return `${dd}/${mm}/${yyyy}`;
  }
  const parsed = parseIsoOrDate(iso);
  if (!parsed) return str || '—';
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).formatToParts(parsed);
    const dd = parts.find((p) => p.type === 'day')?.value || '01';
    const mm = parts.find((p) => p.type === 'month')?.value || '01';
    const yyyy = parts.find((p) => p.type === 'year')?.value || '2026';
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const yyyy = parsed.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
}

/**
 * formatTime(str) -> HH:mm (strips :ss from 06:00:00)
 */
export function formatTime(str) {
  if (!str) return '—';
  const s = String(str).trim();
  const match = s.match(/(\d{2}:\d{2})(?::\d{2})?/);
  if (match) return match[1];
  return s.slice(0, 5) || '—';
}

/**
 * formatTimeRange(startTime, endTime) -> HH:mm – HH:mm
 */
export function formatTimeRange(startTime, endTime) {
  const start = startTime ? formatTime(startTime) : '';
  const end = endTime ? formatTime(endTime) : '';
  if (start && end && start !== '—' && end !== '—') return `${start} – ${end}`;
  if (start && start !== '—') return start;
  return '—';
}

/**
 * formatDateTime(iso) -> HH:mm dd/MM/yyyy
 */
export function formatDateTime(iso) {
  if (!iso) return '—';
  const str = String(iso).trim();
  const localMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/);
  if (localMatch && !str.includes('Z') && !str.includes('+')) {
    const [, yyyy, mm, dd, hhmm] = localMatch;
    return `${hhmm} ${dd}/${mm}/${yyyy}`;
  }
  const parsed = parseIsoOrDate(iso);
  if (!parsed) return str || '—';
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(parsed);
    const dd = parts.find((p) => p.type === 'day')?.value || '01';
    const mm = parts.find((p) => p.type === 'month')?.value || '01';
    const yyyy = parts.find((p) => p.type === 'year')?.value || '2026';
    const hh = parts.find((p) => p.type === 'hour')?.value || '00';
    const min = parts.find((p) => p.type === 'minute')?.value || '00';
    return `${hh}:${min} ${dd}/${mm}/${yyyy}`;
  } catch {
    return formatDate(iso);
  }
}

/**
 * formatWeekday(iso, lang) -> "Thứ Tư, 04/11/2026"
 */
export function formatWeekday(iso, lang = 'vi') {
  if (!iso) return '—';
  const parsed = parseIsoOrDate(String(iso).slice(0, 10));
  if (!parsed) return formatDate(iso);
  const dayIdx = parsed.getDay();
  const dayName = lang === 'en' ? WEEKDAYS_EN[dayIdx] : WEEKDAYS_VI[dayIdx];
  return `${dayName}, ${formatDate(iso)}`;
}
