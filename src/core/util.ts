

/* =====================================================================
   Resumate core: constants, data model, resolver, text tools, storage
   ===================================================================== */

export const CLIENT_ID = 'c' + Math.random().toString(36).slice(2, 9);
export const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
export const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
export const nowISO = () => new Date().toISOString();
export const str = (v) => (v == null ? '' : String(v));
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
export const slug = (s) => str(s).normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'resume';
export const moveItem = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return arr; const a = arr.slice(); [a[i], a[j]] = [a[j], a[i]]; return a; };
export const moveTo = (arr, from, to) => { if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr; const a = arr.slice(); const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; };
export function relTime(iso) {
  const t = Date.parse(iso); if (!t) return '';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' h ago';
  if (s < 86400 * 7) return Math.round(s / 86400) + ' d ago';
  return new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
export const fullTime = (iso) => { const t = Date.parse(iso); return t ? new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''; };
export const lines = (s) => str(s).split(/\r?\n/);
