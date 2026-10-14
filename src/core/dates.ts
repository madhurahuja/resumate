import { LANGS } from './constants';
import { clamp, isObj, str } from './util';

/* ---------- dates ---------- */
export const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export const PRESENT_RE = /^(present|current|now|today|ongoing|heute|actuel|actualidad|presente|heden|till date|to date)$/i;
export function parseDate(s) {
  s = str(s).trim(); if (!s) return null;
  if (PRESENT_RE.test(s)) return { present: true };
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/))) return { y: +m[1], m: clamp(+m[2], 1, 12) };
  if ((m = s.match(/^(\d{1,2})[\/.](\d{4})$/))) return { y: +m[2], m: clamp(+m[1], 1, 12) };
  if ((m = s.match(/^(\d{4})$/))) return { y: +m[1] };
  if ((m = s.match(/^([A-Za-z]{3,9})\.?,?\s+(\d{4})$/))) { const i = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()); if (i >= 0) return { y: +m[2], m: i + 1 }; }
  return null;
}
export const _mf = {};
export function monthName(y, m, locale, style) {
  const k = locale + style; _mf[k] = _mf[k] || new Intl.DateTimeFormat(locale, { month: style, timeZone: 'UTC' });
  return _mf[k].format(new Date(Date.UTC(y, m - 1, 1)));
}
export function fmtDate(s, lang, fmt) {
  const d = parseDate(s); const L = LANGS[lang] || LANGS.en;
  if (!d) return str(s).trim();
  if (d.present) return L.present;
  if (!d.m || fmt === 'YYYY') return String(d.y);
  if (fmt === 'MM/YYYY') return String(d.m).padStart(2, '0') + '/' + d.y;
  if (fmt === 'Month YYYY') return monthName(d.y, d.m, L.locale, 'long') + ' ' + d.y;
  let mn = monthName(d.y, d.m, L.locale, 'short'); if (lang === 'en') mn = mn.replace('.', '');
  return mn + ' ' + d.y;
}
export function fmtDateField(f, val, fmt, lang) {
  if (f.type === 'daterange') {
    const r = isObj(val) ? val : {}; const L = LANGS[lang] || LANGS.en;
    const a = fmtDate(r.s, lang, fmt); const b = r.cur ? L.present : fmtDate(r.e, lang, fmt);
    return a && b ? a + ' – ' + b : a || b || '';
  }
  return fmtDate(val, lang, fmt);
}
export const DATE_FORMATS = ['MMM YYYY', 'Month YYYY', 'MM/YYYY', 'YYYY'];

