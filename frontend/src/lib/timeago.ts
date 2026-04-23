const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/**
 * Returns a human-friendly relative time string in Spanish.
 * - < 60 s  → "hace unos segundos"
 * - < 60 m  → "hace X minuto(s)"
 * - < 24 h  → "hace X hora(s)"
 * - < 7 d   → "hace X día(s)"
 * - < 4 w   → "hace X semana(s)"
 * - else    → exact date like "21 abr 2026, 15:09"
 */
export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();

  if (diff < MINUTE) return 'hace unos segundos';
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `hace ${m} ${m === 1 ? 'minuto' : 'minutos'}`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `hace ${h} ${h === 1 ? 'hora' : 'horas'}`;
  }
  if (diff < WEEK) {
    const d2 = Math.floor(diff / DAY);
    return `hace ${d2} ${d2 === 1 ? 'día' : 'días'}`;
  }
  if (diff < 4 * WEEK) {
    const w = Math.floor(diff / WEEK);
    return `hace ${w} ${w === 1 ? 'semana' : 'semanas'}`;
  }
  return formatExactDate(d);
}

const MONTHS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

/**
 * Returns the exact date & time (no seconds) in Spanish format.
 * E.g. "21 abr 2026, 15:09"
 */
export function formatExactDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hh}:${mm}`;
}
