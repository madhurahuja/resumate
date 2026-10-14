/* ---------- appearance ---------- */
export const PALETTES = {
  indigo: { label: 'Indigo', a: '#2243c9', d: '#8ba0ff' },
  forest: { label: 'Forest', a: '#1d6b4a', d: '#6fd3a0' },
  ember: { label: 'Ember', a: '#b2441f', d: '#ff9d78' },
  plum: { label: 'Plum', a: '#7a2e8e', d: '#d9a0ec' },
  ocean: { label: 'Ocean', a: '#0b6e7a', d: '#62d2de' },
  mono: { label: 'Mono', a: '#222a36', d: '#cfd6e3' },
};
export function loadAppearance() { try { const a = localStorage.getItem('resumate.appearance'); if (a) return JSON.parse(a); const o = JSON.parse(localStorage.getItem('resumate:prefs') || '{}'); return { palette: o.palette, mode: o.mode }; } catch (e) { return {}; } }
export function applyAppearance(p) {
  const r = document.documentElement;
  if (p.palette && PALETTES[p.palette] && p.palette !== 'indigo') r.setAttribute('data-palette', p.palette); else r.removeAttribute('data-palette');
  if (p.mode === 'light' || p.mode === 'dark') r.setAttribute('data-theme', p.mode); else r.removeAttribute('data-theme');
  if (p.motion === 'off' || p.motion === 'soft' || p.motion === 'snappy') r.setAttribute('data-motion', p.motion); else r.removeAttribute('data-motion');
}
export function saveAppearance(p) { try { localStorage.setItem('resumate.appearance', JSON.stringify(p)); } catch (e) { /* storage unavailable: theme lasts for this visit */ } }
applyAppearance(loadAppearance());
