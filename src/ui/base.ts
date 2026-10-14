import { parseDate } from '../core/dates';
import { isObj, moveItem, str } from '../core/util';
import { html, useEffect, useLayoutEffect, useRef, useState } from './h';

/* =====================================================================
   UI primitives
   ===================================================================== */
export const ICONS = {
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  archive: '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  more: '<circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.7-4 3-9 3s-9-1.3-9-3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/>',
  compare: '<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/>',
  undo: '<polyline points="1 4 1 10 7 10"/><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10"/>',
  redo: '<polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M17.9 17.9A10.1 10.1 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2"/><line x1="1" y1="1" x2="23" y2="23"/>',
  up: '<polyline points="18 15 12 9 6 15"/>',
  down: '<polyline points="6 9 12 15 18 9"/>',
  right: '<polyline points="9 18 15 12 9 6"/>',
  left: '<polyline points="15 18 9 12 15 6"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  history: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  unlink: '<path d="M18.8 13l1.7-1.7a5 5 0 0 0-7-7L12 6"/><path d="M5.2 11l-1.7 1.7a5 5 0 0 0 7 7L12 18"/><line x1="8" y1="2" x2="8" y2="5"/><line x1="2" y1="8" x2="5" y2="8"/><line x1="16" y1="19" x2="16" y2="22"/><line x1="19" y1="16" x2="22" y2="16"/>',
  alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
  plusfile: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>',
  restore: '<polyline points="1 4 1 10 7 10"/><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10"/>',
  grip: '<circle cx="9" cy="5" r="1.2"/><circle cx="15" cy="5" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="19" r="1.2"/><circle cx="15" cy="19" r="1.2"/>',
};
export function Icon({ n, cls }) { return html`<svg class=${'ico ' + (cls || '')} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: ICONS[n] || '' }}></svg>`; }

let _idc = 0;
export const useUid = () => useRef('u' + ++_idc).current;

/* ---------- drag-and-drop reordering (native HTML5 DnD, no dependency) ---------- */
export function useDragReorder(onMove: (from: number, to: number) => void) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const handle = (i: number) => ({
    draggable: true,
    onDragStart: (e) => { setDragIdx(i); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(i)); } catch (err) { /* ignore */ } },
    onDragEnd: () => { setDragIdx(null); setOverIdx(null); },
  });
  const container = (i: number) => ({
    onDragOver: (e) => { if (dragIdx === null) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (overIdx !== i) setOverIdx(i); },
    onDragLeave: () => { if (overIdx === i) setOverIdx(null); },
    onDrop: (e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== i) onMove(dragIdx, i); setDragIdx(null); setOverIdx(null); },
  });
  return { dragIdx, overIdx, handle, container };
}

export function IconBtn({ n, label, onClick, on, disabled, cls, title }) {
  return html`<button type="button" class=${'ibtn ' + (on ? 'on ' : '') + (cls || '')} aria-label=${label} title=${title || label} onClick=${onClick} disabled=${disabled} aria-pressed=${on === undefined ? undefined : !!on}><${Icon} n=${n} /></button>`;
}

export function useOutside(ref, open, close) {
  useEffect(() => {
    if (!open) return undefined;
    const f = (e) => { if (ref.current && !ref.current.contains(e.target)) close(); };
    document.addEventListener('pointerdown', f); return () => document.removeEventListener('pointerdown', f);
  }, [open]);
}
export function Menu({ icon, label, items, align, btn, btnCls, children }) {
  const [open, setOpen] = useState(false); const ref = useRef<any>(null);
  useOutside(ref, open, () => setOpen(false));
  return html`<div class="menu-wrap" ref=${ref} onKeyDown=${(e) => { if (e.key === 'Escape') setOpen(false); }}>
    ${btn ? html`<button type="button" class=${btnCls || 'btn'} aria-haspopup="menu" aria-expanded=${open} onClick=${() => setOpen(!open)}>${btn}</button>`
      : html`<button type="button" class=${'ibtn ' + (btnCls || '')} aria-haspopup="menu" aria-expanded=${open} aria-label=${label} title=${label} onClick=${() => setOpen(!open)}><${Icon} n=${icon || 'more'} /></button>`}
    ${open && html`<div class=${'menu ' + (align || '')} role="menu">
      ${items.map((it, i) => it === '-' ? html`<hr key=${i} />` : it.heading ? html`<div class="menu-label" key=${i}>${it.heading}</div>` : html`<button type="button" role="menuitem" key=${i} class=${it.danger ? 'danger' : ''} disabled=${it.disabled} onClick=${() => { setOpen(false); it.fn(); }}>${it.icon && html`<${Icon} n=${it.icon} />`}<span>${it.label}</span></button>`)}
    </div>`}
  </div>`;
}

export function Dialog({ title, onClose, children, foot, wide, label }) {
  const ref = useRef<any>(null); const tid = useUid();
  useEffect(() => {
    const prev = document.activeElement; const el = ref.current;
    const first = el && el.querySelector('[data-autofocus],input:not([type=hidden]),textarea,select,button.primary,button,[tabindex]:not([tabindex="-1"])');
    if (first) first.focus();
    else if (el && typeof el.focus === 'function') el.focus();
    return () => { if (prev && (prev as any).focus && document.contains(prev)) (prev as any).focus(); };
  }, []);
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab') return;
    const f = [...ref.current.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea,select,a[href],[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
    if (!f.length) return; const a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  };
  return html`<div class="scrim" onPointerDown=${(e) => { if (e.target === e.currentTarget) onClose(); }} onKeyDown=${onKey}>
    <div class=${'dialog ' + (wide ? 'wide' : '')} role="dialog" aria-modal="true" aria-labelledby=${label ? undefined : tid} aria-label=${label || undefined} tabIndex="-1" ref=${ref}>
      <div class="dialog-head"><h2 id=${tid}>${title}</h2><${IconBtn} n="x" label="Close" onClick=${onClose} /></div>
      <div class="dialog-body">${children}</div>
      ${foot && html`<div class="dialog-foot">${foot}</div>`}
    </div>
  </div>`;
}

export function Toasts({ items, dismiss }) {
  return html`<div class="toasts" role="status" aria-live="polite">${items.map((t) => html`<div class=${'toast ' + (t.kind || '')} key=${t.id}><span>${t.msg}</span>${t.action && html`<button type="button" onClick=${() => { t.action.fn(); dismiss(t.id); }}>${t.action.label}</button>`}<button type="button" aria-label="Dismiss" onClick=${() => dismiss(t.id)}>✕</button></div>`)}</div>`;
}

/* ---------- inputs ---------- */
export function AutoTextarea({ value, onInput, id, rows, placeholder, cls, invalid }) {
  const ref = useRef<any>(null);
  useLayoutEffect(() => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight + 2, 420) + 'px'; } }, [value]);
  return html`<textarea ref=${ref} id=${id} class=${'in ' + (cls || '')} rows=${rows || 3} value=${value || ''} placeholder=${placeholder} aria-invalid=${invalid ? 'true' : undefined} onInput=${(e) => onInput(e.target.value)}></textarea>`;
}
export function TextField({ label, value, onInput, type, placeholder, hint, error, textarea, rows, req, autoComplete, id: pid, right }) {
  const id = pid || useUid();
  return html`<div class="field">
    ${label && html`<label for=${id}>${label}${req && html`<span class="muted" aria-hidden="true"> *</span>`}${right}</label>`}
    ${textarea ? html`<${AutoTextarea} id=${id} value=${value} onInput=${onInput} rows=${rows} placeholder=${placeholder} invalid=${!!error} />`
      : html`<input id=${id} class="in" type=${type || 'text'} value=${value || ''} placeholder=${placeholder} autocomplete=${autoComplete || 'off'} aria-invalid=${error ? 'true' : undefined} aria-describedby=${error || hint ? id + 'h' : undefined} onInput=${(e) => onInput(e.target.value)} />`}
    ${(error || hint) && html`<div id=${id + 'h'} class=${error ? 'err' : 'hint'}>${error || hint}</div>`}
  </div>`;
}
export function SelectField({ label, value, onChange, options, hint, id: pid }) {
  const id = pid || useUid();
  return html`<div class="field">${label && html`<label for=${id}>${label}</label>`}
    <select id=${id} class="in" value=${value} onChange=${(e) => onChange(e.target.value)}>${options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return html`<option value=${v} selected=${v === value}>${l}</option>`; })}</select>
    ${hint && html`<div class="hint">${hint}</div>`}</div>`;
}
export function Switch({ checked, onChange, label, disabled }) {
  return html`<label class="switch"><input type="checkbox" checked=${!!checked} disabled=${disabled} onChange=${(e) => onChange(e.target.checked)} /><span>${label}</span></label>`;
}
export function Seg({ value, onChange, options, label }) {
  return html`<div class="seg" role="group" aria-label=${label}>${options.map(([v, l]) => html`<button type="button" key=${v} aria-pressed=${value === v} onClick=${() => onChange(v)}>${l}</button>`)}</div>`;
}

export function TagsEditor({ value, onChange, id, placeholder }) {
  const [draft, setDraft] = useState(''); const tags = Array.isArray(value) ? value : [];
  const commit = (txt) => { const parts = txt.split(/[,\n]/).map((x) => x.trim()).filter(Boolean); if (parts.length) onChange([...tags, ...parts.filter((p) => !tags.includes(p))]); setDraft(''); };
  return html`<div class="tagbox">
    ${tags.map((t, i) => html`<span class="chip" key=${t + i}>${t}<button type="button" aria-label=${'Remove ' + t} onClick=${() => onChange(tags.filter((_, j) => j !== i))}><${Icon} n="x" cls="" /></button></span>`)}
    <input id=${id} value=${draft} placeholder=${tags.length ? '' : (placeholder || 'Type and press Enter')} aria-label=${placeholder || 'Add item'}
      onInput=${(e) => { const v = e.target.value; if (/[,\n]/.test(v)) commit(v); else setDraft(v); }}
      onKeyDown=${(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(draft); } else if (e.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1)); }}
      onBlur=${() => draft.trim() && commit(draft)} />
  </div>`;
}
function bulletHint(text: string) {
  const t = str(text).trim();
  if (!t) return '';
  const hasMetric = /(\d|%|\$|₹|€|£|x\b|k\b|m\b)/i.test(t);
  const hasAction = /^(built|led|created|designed|improved|optimized|launched|reduced|increased|delivered|managed|implemented|drove|scaled|automated)\b/i.test(t);
  if (t.length < 32) return 'Add context and impact so this reads like an achievement, not a task.';
  if (!hasMetric) return 'Consider adding a measurable result (%, amount, time saved, or scale).';
  if (!hasAction) return 'Start with a strong action verb to make the impact clearer.';
  return '';
}
export function BulletsEditor({ value, onChange, id }) {
  const b = Array.isArray(value) ? value : []; const set = (i, v) => onChange(b.map((x, j) => (j === i ? v : x)));
  return html`<div class="bullets">
    ${b.map((x, i) => html`<div class="bullet-row" key=${i}>
      <div style="min-width:0;flex:1">
        <${AutoTextarea} id=${i === 0 ? id : undefined} value=${x} onInput=${(v) => set(i, v)} rows=${1} placeholder="Describe the outcome, with a number if you can" />
        ${bulletHint(x) && html`<div class="hint" style="margin-top:4px">${bulletHint(x)}</div>`}
      </div>
      <div class="row" style="gap:0;flex-wrap:nowrap"><${IconBtn} n="up" label="Move bullet up" cls="sm" disabled=${i === 0} onClick=${() => onChange(moveItem(b, i, -1))} /><${IconBtn} n="down" label="Move bullet down" cls="sm" disabled=${i === b.length - 1} onClick=${() => onChange(moveItem(b, i, 1))} /><${IconBtn} n="x" label="Remove bullet" cls="sm" onClick=${() => onChange(b.filter((_, j) => j !== i))} /></div>
    </div>`)}
    <div><button type="button" class="btn sm" onClick=${() => onChange([...b, ''])}><${Icon} n="plus" />Add bullet</button></div>
  </div>`;
}
export function DateInput({ value, onChange, id, label }) {
  const bad = str(value).trim() && !parseDate(value);
  return html`<div><input id=${id} class="in" value=${value || ''} placeholder="2021-03, Mar 2021 or 2021" aria-label=${label} aria-invalid=${bad ? 'true' : undefined} onInput=${(e) => onChange(e.target.value)} />${bad && html`<div class="err">Not recognised. It will print exactly as typed.</div>`}</div>`;
}
export function DateRangeInput({ value, onChange, id }) {
  const v = isObj(value) ? value : { s: '', e: '', cur: false }; const set = (p) => onChange({ ...v, ...p });
  return html`<div class="grid3" style="align-items:start">
    <div class="field"><label for=${id + 's'} class="hint">Start</label><${DateInput} id=${id + 's'} value=${v.s} onChange=${(x) => set({ s: x })} label="Start date" /></div>
    <div class="field"><label for=${id + 'e'} class="hint">End</label>${v.cur ? html`<input id=${id + 'e'} class="in" disabled value="Present" />` : html`<${DateInput} id=${id + 'e'} value=${v.e} onChange=${(x) => set({ e: x })} label="End date" />`}</div>
    <div class="field"><span class="hint">&nbsp;</span><${Switch} checked=${v.cur} onChange=${(c) => set({ cur: c })} label="I work here now" /></div>
  </div>`;
}
export function FieldInput({ f, value, onChange, id }) {
  switch (f.type) {
    case 'textarea': return html`<${AutoTextarea} id=${id} value=${value} onInput=${onChange} />`;
    case 'date': return html`<${DateInput} id=${id} value=${value} onChange=${onChange} label=${f.label} />`;
    case 'daterange': return html`<${DateRangeInput} id=${id} value=${value} onChange=${onChange} />`;
    case 'bullets': return html`<${BulletsEditor} id=${id} value=${value} onChange=${onChange} />`;
    case 'tags': return html`<${TagsEditor} id=${id} value=${value} onChange=${onChange} placeholder=${'Add ' + f.label.toLowerCase()} />`;
    case 'url': return html`<input id=${id} class="in" type="url" inputmode="url" value=${value || ''} placeholder="https://" onInput=${(e) => onChange(e.target.value)} />`;
    default: return html`<input id=${id} class="in" value=${value || ''} onInput=${(e) => onChange(e.target.value)} aria-required=${f.req ? 'true' : undefined} />`;
  }
}
export const WIDE = new Set(['textarea', 'bullets', 'tags', 'daterange']);
export function FieldRow({ f, value, onChange, overridden, onRevert, scope }) {
  const id = useUid(); const empty = f.req && !str(value).trim();
  return html`<div class=${'field ' + (overridden ? 'fld-ov' : '')} style=${WIDE.has(f.type) ? 'grid-column:1/-1' : ''}>
    <label for=${id}>${f.label}${f.req ? html`<span class="muted" aria-hidden="true"> *</span>` : html`<span class="muted" style="font-weight:400"> optional</span>`}
      ${overridden && html`<span class="chip accent">Edited for this ${scope || 'resume'}</span><button type="button" class="btn sm ghost" onClick=${onRevert}><${Icon} n="restore" />Use master</button>`}</label>
    <${FieldInput} f=${f} value=${value} onChange=${onChange} id=${id} />
    ${empty && html`<div class="err">Required so this entry can be recognised.</div>`}
  </div>`;
}
export const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const plural = (n: number, w: string, p?: string) => n + ' ' + (n === 1 ? w : p || w + 's');
