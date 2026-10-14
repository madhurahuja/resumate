import { INDUSTRIES } from '../core/constants';
import { atsNotes, bulletQualityInsights, extractKeywords, keywordMatch, resumeHealth } from '../core/analysis';
import { COUNTRIES, FONTS, HEADER_FIELDS, HEADINGS, KINDS, LANGS, PAGES, STATUSES, SWATCHES, TEMPLATES } from '../core/constants';
import { DATE_FORMATS } from '../core/dates';
import { buildIR, irPlain, shortUrl } from '../core/ir';
import { blankItem, countOverrides, defaultValue, itemLabel, itemSubLabel, makeSection, resolve } from '../core/model';
import { Saver } from '../core/storage';
import { clamp, clone, fullTime, moveItem, moveTo, relTime, str, uid } from '../core/util';
import { EXPORTS } from '../export/formats';
import { Dialog, FieldRow, Icon, IconBtn, Menu, Seg, SelectField, Switch, TagsEditor, TextField, deepEq, plural, useDragReorder, useUid } from '../ui/base';
import { html, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from '../ui/h';
import { ResumeSheet, resolveTemplateStyle, sheetStyle } from '../ui/sheet';
import { UndoBar } from './master';

/* =====================================================================
   Resume editor
   ===================================================================== */
export function SaveState({ st, mode }) {
  const cls = st.state === 'error' ? 'err' : st.state === 'saving' ? 'saving' : '';
  const text = st.state === 'saving' ? 'Saving…' : st.state === 'error' ? st.error : st.at ? 'Saved ' + new Date(st.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : mode === 'local' ? 'Stored in this browser' : 'All changes saved';
  return html`<span class=${'savestate ' + cls} role="status" aria-live="polite"><span class="dot"></span><span>${text}</span>${st.state === 'error' && html`<button type="button" class="btn sm" onClick=${() => Saver.retryNow()}><${Icon} n="restore" />Retry</button>`}</span>`;
}

export function Slider({ label, value, min, max, step, unit, onChange }) {
  const id = useUid();
  return html`<div class="field"><label for=${id}>${label}</label><div class="rng"><input id=${id} type="range" min=${min} max=${max} step=${step} value=${value} onInput=${(e) => onChange(+e.target.value)} /><span class="mono">${Number(value).toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0)}${unit}</span></div></div>`;
}

const TEMPLATE_FAVS_KEY = 'resumate:template:favorites';
function loadTemplateFavorites() { try { return JSON.parse(localStorage.getItem(TEMPLATE_FAVS_KEY) || '[]'); } catch (e) { return []; } }
function saveTemplateFavorites(ids) { try { localStorage.setItem(TEMPLATE_FAVS_KEY, JSON.stringify(ids.slice(0, 24))); } catch (e) { /* ignore */ } }

/* ----- preview ----- */
export function Preview({ ir, resume, zoom, setZoom, onPages, notes }) {
  const stage = useRef<any>(null); const holder = useRef<any>(null);
  const [m, setM] = useState({ sw: 816, sh: 1056, stw: 600, bottom: 0 }); const [showAts, setShowAts] = useState(false);
  const L = resume.layout; const pg = PAGES[L.pageSize] || PAGES.letter;
  const measure = useCallback(() => {
    const st = stage.current; const art = holder.current && holder.current.querySelector('.rs'); if (!st || !art) return;
    const last = art.lastElementChild; const next = { sw: art.offsetWidth, sh: art.offsetHeight, stw: st.clientWidth, bottom: last ? last.offsetTop + last.offsetHeight : 0 };
    setM((o) => (o.sw === next.sw && o.sh === next.sh && o.stw === next.stw && o.bottom === next.bottom ? o : next));
  }, []);
  useLayoutEffect(measure, [ir, resume.layout, resume.template]);
  useEffect(() => { const ro = new ResizeObserver(measure); if (stage.current) ro.observe(stage.current); return () => ro.disconnect(); }, []);
  const scale = zoom === 'fit' ? clamp((m.stw - 36) / m.sw, 0.25, 1.2) : zoom;
  const usable = (pg.h - 2 * L.margin) * 96; const contentH = Math.max(0, m.bottom - L.margin * 96);
  const pages = Math.max(1, Math.ceil(contentH / usable - 0.015));
  useEffect(() => { onPages(pages); }, [pages]);
  const bad = notes.filter((n) => n.lvl === 'bad' || n.lvl === 'warn').length;
  return html`<div class="ed-right">
    <div class="pv-bar">
      <span class="chip">${pg.label}</span><span class="chip">${TEMPLATES[resume.template].name}</span>
      <span class="muted">≈ ${plural(pages, 'page')}</span>
      <div class="row" style="margin-left:auto;gap:4px">
        <${IconBtn} n="minus" label="Zoom out" cls="sm" onClick=${() => setZoom(clamp((zoom === 'fit' ? scale : zoom) - 0.1, 0.3, 1.6))} />
        <button type="button" class="btn sm" onClick=${() => setZoom('fit')} aria-pressed=${zoom === 'fit'}>${zoom === 'fit' ? 'Fit' : Math.round(zoom * 100) + '%'}</button>
        <${IconBtn} n="plus" label="Zoom in" cls="sm" onClick=${() => setZoom(clamp((zoom === 'fit' ? scale : zoom) + 0.1, 0.3, 1.6))} />
      </div>
    </div>
    <div class="pv-stage" ref=${stage}>
      <div class="pv-holder" ref=${holder} style=${`width:${Math.round(m.sw * scale)}px;height:${Math.round(m.sh * scale)}px`}>
        <div class="sheet-wrap" style=${`transform:scale(${scale});width:${m.sw}px`}>
          <${ResumeSheet} ir=${ir} resume=${resume} />
          ${Array.from({ length: pages - 1 }, (_, k) => html`<div key=${k} aria-hidden="true" style=${`position:absolute;left:0;right:0;top:${Math.round(L.margin * 96 + (k + 1) * usable)}px;border-top:1.5px dashed #d33;opacity:.55;pointer-events:none`}><span style="position:absolute;right:6px;top:2px;font:600 10px/1 system-ui;color:#d33">Page ${k + 2} starts here (approx.)</span></div>`)}
        </div>
      </div>
    </div>
    <div class="pv-foot">
      <button type="button" class=${'chip ' + (bad ? 'warn' : 'ok')} aria-expanded=${showAts} onClick=${() => setShowAts(!showAts)} style="cursor:pointer"><${Icon} n=${bad ? 'alert' : 'check'} cls="" />ATS check: ${bad ? plural(bad, 'note') : 'looks good'}</button>
      <span class="muted">Layout is approximate; the exported file is validated when you export.</span>
      ${showAts && html`<ul style="flex-basis:100%;margin:4px 0 0;padding-left:18px;display:grid;gap:4px">${notes.map((n, i) => html`<li key=${i}><span class=${'chip ' + (n.lvl === 'bad' ? 'bad' : n.lvl === 'warn' ? 'warn' : n.lvl === 'ok' ? 'ok' : '')}>${n.lvl === 'info' ? 'tip' : n.lvl}</span> ${n.msg}</li>`)}</ul>`}
    </div>
  </div>`;
}

/* ----- content tab ----- */
export function HeaderCard({ A, r, R }) {
  const [open, setOpen] = useState(false); const H = R.header; const rid = r.id;
  const setV = (k, v) => A.updateResume(rid, (d) => { const mv = A.master.header.values[k]; if (v === mv) delete d.header.ov[k]; else d.header.ov[k] = v; }, 'hv' + k);
  const toggleHide = (k) => A.updateResume(rid, (d) => { if (d.header.hide[k]) delete d.header.hide[k]; else d.header.hide[k] = true; });
  const toggleIn = (arr, id) => A.updateResume(rid, (d) => { const a = d.header[arr]; const i = a.indexOf(id); if (i >= 0) a.splice(i, 1); else a.push(id); });
  const nOv = H.ovKeys.length;
  return html`<div class="sec-card">
    <div class="sec-head"><button type="button" class="t" style="all:unset;flex:1;min-width:0;cursor:pointer;display:flex;gap:8px;align-items:center;padding:8px 0" aria-expanded=${open} onClick=${() => setOpen(!open)}><h3>Personal details</h3>${nOv > 0 && html`<span class="chip accent">${nOv} edited</span>`}</button><${IconBtn} n=${open ? 'up' : 'down'} label=${open ? 'Collapse' : 'Expand'} onClick=${() => setOpen(!open)} /></div>
    ${open && html`<div class="sec-body">
      ${HEADER_FIELDS.map(([k, label, type]) => { const ov = H.ovKeys.includes(k); return html`<div key=${k} class=${'field ' + (ov ? 'fld-ov' : '')}>
        <label for=${'hv' + k}>${label}${ov && html`<span class="chip accent">Edited for this resume</span><button type="button" class="btn sm ghost" onClick=${() => A.updateResume(rid, (d) => { delete d.header.ov[k]; })}><${Icon} n="restore" />Use master</button>`}</label>
        <div class="row" style="flex-wrap:nowrap"><input id=${'hv' + k} class="in" type=${type === 'email' ? 'email' : 'text'} value=${H.values[k] || ''} disabled=${!!H.hide[k]} onInput=${(e) => setV(k, e.target.value)} /><${IconBtn} n=${H.hide[k] ? 'eyeoff' : 'eye'} label=${(H.hide[k] ? 'Show ' : 'Hide ') + label} on=${!H.hide[k]} onClick=${() => toggleHide(k)} /></div></div>`; })}
      ${(H.links.length > 0 || H.extra.length > 0) && html`<div class="lbl">Include from master</div>`}
      ${H.links.map((l) => html`<${Switch} key=${l.id} checked=${!l.hidden} onChange=${() => toggleIn('hiddenLinks', l.id)} label=${(l.label || 'Link') + ': ' + shortUrl(l.url)} />`)}
      ${H.extra.map((l) => html`<${Switch} key=${l.id} checked=${!l.hidden} onChange=${() => toggleIn('hiddenExtra', l.id)} label=${(l.label || 'Detail') + ': ' + l.value} />`)}
      <p class="hint">Contact details and links are edited in the master profile. Edits made here apply to this resume only.</p>
    </div>`}
  </div>`;
}

export function ResumeItem({ A, r, s, it, idx, n, drag }) {
  const [open, setOpen] = useState(false); const rid = r.id;
  const upItem = (fn, key?) => A.updateResume(rid, (d) => { const rs = d.sections.find((x) => x.id === s.id); fn(rs, rs.items.find((x) => x.id === it.id)); }, key);
  const fields = s.fields.filter((f) => !s.hiddenFields[f.key] && (f.role !== 'meta' || s.kind === 'summary'));
  const setField = (f, val) => upItem((rs, ri) => {
    if (ri.local) { ri.v = ri.v || {}; ri.v[f.key] = val; return; }
    const ms = A.master.sections.find((x) => x.id === rs.ref); const mi = ms && ms.items.find((x) => x.id === ri.ref); const mv = mi ? mi.v[f.key] : undefined;
    ri.ov = ri.ov || {}; if (deepEq(val, mv === undefined ? defaultValue(f) : mv)) delete ri.ov[f.key]; else ri.ov[f.key] = val;
  }, 'f' + it.id + f.key);
  const detach = () => upItem((rs, ri) => { ri.local = true; ri.v = clone(it.v); delete ri.ref; delete ri.ov; });
  const menu = [
    ...(it.ov.length ? [{ label: 'Use master text for all fields', icon: 'restore', fn: () => upItem((rs, ri) => { ri.ov = {}; }) }] : []),
    ...(!it.local ? [{ label: 'Detach from master', icon: 'unlink', fn: () => { detach(); A.toast('Detached. This entry is now a private copy in this resume.'); } }] : []),
    { label: 'Remove from this resume', icon: 'x', fn: () => A.updateResume(rid, (d) => { const rs = d.sections.find((x) => x.id === s.id); rs.items = rs.items.filter((x) => x.id !== it.id); }) },
  ];
  const dcls = drag ? (drag.isDragging ? ' dragging' : '') + (drag.isOver ? ' drag-over' : '') : '';
  return html`<div class=${'item' + dcls + ' ' + (it.visible ? '' : 'off')} role="group" aria-label=${itemLabel(s, it.v)} onDragOver=${drag && drag.container.onDragOver} onDragLeave=${drag && drag.container.onDragLeave} onDrop=${drag && drag.container.onDrop}>
    <div class="item-head">
      ${drag && html`<span class="drag-handle" aria-hidden="true" title="Drag to reorder" draggable="true" onDragStart=${drag.handle.onDragStart} onDragEnd=${drag.handle.onDragEnd}><${Icon} n="grip" /></span>`}
      <input type="checkbox" style="width:20px;height:20px;accent-color:var(--accent);flex:none" checked=${it.visible} aria-label=${'Include ' + itemLabel(s, it.v) + ' in this resume'} onChange=${(e) => upItem((rs, ri) => { ri.visible = e.target.checked; })} />
      <button type="button" class="t" aria-expanded=${open} onClick=${() => setOpen(!open)}><b>${itemLabel(s, it.v)}</b><small>${itemSubLabel(s, it.v) || (s.kind === 'summary' ? str(it.v.text).slice(0, 60) : '')}</small></button>
      ${it.ov.length > 0 && html`<span class="chip accent" title="Fields edited only in this resume">${it.ov.length} edited</span>`}
      ${it.local && html`<span class="chip" title="Exists only in this resume">this resume only</span>`}
      <${IconBtn} n="up" label="Move entry up" cls="sm" disabled=${idx === 0} onClick=${() => A.updateResume(rid, (d) => { const rs = d.sections.find((x) => x.id === s.id); rs.items = moveItem(rs.items, idx, -1); })} />
      <${IconBtn} n="down" label="Move entry down" cls="sm" disabled=${idx === n - 1} onClick=${() => A.updateResume(rid, (d) => { const rs = d.sections.find((x) => x.id === s.id); rs.items = moveItem(rs.items, idx, 1); })} />
      <${Menu} label="Entry actions" items=${menu} />
    </div>
    ${open && html`<div class="item-body"><div class="grid2" style="padding-top:12px">
      ${fields.map((f) => html`<${FieldRow} key=${f.key} f=${f} value=${it.v[f.key] === undefined ? defaultValue(f) : it.v[f.key]} overridden=${it.ov.includes(f.key)} onChange=${(val) => setField(f, val)} onRevert=${() => upItem((rs, ri) => { delete ri.ov[f.key]; })} />`)}
    </div></div>`}
  </div>`;
}

export function SectionCard({ A, r, s, idx, n, drag }) {
  const [open, setOpen] = useState(false); const rid = r.id; const [adding, setAdding] = useState(false);
  const upSec = (fn, key?) => A.updateResume(rid, (d) => fn(d.sections.find((x) => x.id === s.id), d), key);
  const inc = s.items.filter((i) => i.visible).length;
  const toggleField = (k) => upSec((rs) => { rs.fieldHide = rs.fieldHide || {}; if (rs.fieldHide[k]) delete rs.fieldHide[k]; else rs.fieldHide[k] = true; });
  const itemsDrag = useDragReorder((from, to) => upSec((rs) => { rs.items = moveTo(rs.items, from, to); }));
  const scls = drag ? (drag.isDragging ? ' dragging' : '') + (drag.isOver ? ' drag-over' : '') : '';
  return html`<div class=${'sec-card' + scls + ' ' + (s.visible ? '' : 'off')} onDragOver=${drag && drag.container.onDragOver} onDragLeave=${drag && drag.container.onDragLeave} onDrop=${drag && drag.container.onDrop}>
    <div class="sec-head">
      ${drag && html`<span class="drag-handle" aria-hidden="true" title="Drag to reorder" draggable="true" onDragStart=${drag.handle.onDragStart} onDragEnd=${drag.handle.onDragEnd}><${Icon} n="grip" /></span>`}
      <${IconBtn} n=${s.visible ? 'eye' : 'eyeoff'} label=${(s.visible ? 'Hide ' : 'Show ') + s.title + ' section'} on=${s.visible} onClick=${() => upSec((rs) => { rs.visible = !rs.visible; })} />
      <button type="button" style="all:unset;flex:1;min-width:0;cursor:pointer;display:flex;gap:8px;align-items:center;padding:8px 0" aria-expanded=${open} onClick=${() => setOpen(!open)}><h3>${s.title}</h3><span class="chip">${inc}/${s.items.length}</span>${s.titleOv && html`<span class="ov-dot" title="Renamed for this resume"></span>`}${s.local && html`<span class="chip">this resume only</span>`}</button>
      <${IconBtn} n="up" label="Move section up" cls="sm" disabled=${idx === 0} onClick=${() => A.updateResume(rid, (d) => { d.sections = moveItem(d.sections, idx, -1); })} />
      <${IconBtn} n="down" label="Move section down" cls="sm" disabled=${idx === n - 1} onClick=${() => A.updateResume(rid, (d) => { d.sections = moveItem(d.sections, idx, 1); })} />
      <${IconBtn} n=${open ? 'up' : 'down'} label=${open ? 'Collapse section' : 'Expand section'} cls="sm" onClick=${() => setOpen(!open)} />
    </div>
    ${open && html`<div class="sec-body">
      <div class=${'field ' + (s.titleOv ? 'fld-ov' : '')}><label for=${'st' + s.id}>Heading on this resume${s.titleOv && html`<button type="button" class="btn sm ghost" onClick=${() => upSec((rs) => { rs.title = null; })}><${Icon} n="restore" />Use "${s.ms.title}"</button>`}</label><input id=${'st' + s.id} class="in" value=${s.title} onInput=${(e) => upSec((rs) => { rs.title = e.target.value; }, 'sth')} /></div>
      ${(r.layout.columns || 1) === 2 && html`<div class="field"><span class="lbl">Column</span><${Seg} label=${'Column for ' + s.title} value=${s.col === 'side' ? 'side' : 'main'} onChange=${(v) => upSec((rs) => { rs.col = v; })} options=${[['main', 'Main'], ['side', 'Sidebar']]} /></div>`}
      ${s.kind === 'summary' && html`<p class="hint">Tick one summary version per resume, or edit its text for this resume only.</p>`}
      ${s.items.map((it, i) => html`<${ResumeItem} key=${it.id} A=${A} r=${r} s=${s} it=${it} idx=${i} n=${s.items.length} drag=${{ handle: itemsDrag.handle(i), container: itemsDrag.container(i), isDragging: itemsDrag.dragIdx === i, isOver: itemsDrag.overIdx === i && itemsDrag.dragIdx !== i }} />`)}
      <div class="row">
        ${s.unused.length > 0 && html`<button type="button" class="btn sm" aria-expanded=${adding} onClick=${() => setAdding(!adding)}><${Icon} n="link" />Add from master (${s.unused.length})</button>`}
        <button type="button" class="btn sm" onClick=${() => upSec((rs) => { const blank = blankItem(s.ms); rs.items.push({ id: uid('x_'), local: true, visible: true, v: blank.v }); })}><${Icon} n="plus" />New entry for this resume only</button>
      </div>
      ${adding && html`<div class="stack" style="gap:6px">${s.unused.map((mi) => html`<button type="button" class="btn" key=${mi.id} style="justify-content:flex-start;white-space:normal;text-align:left" onClick=${() => { upSec((rs) => { rs.items.push({ id: uid('x_'), ref: mi.id, visible: true, ov: {} }); }); }}><${Icon} n="plus" /><span><b>${itemLabel(s, mi.v)}</b> <span class="muted">${itemSubLabel(s, mi.v)}</span></span></button>`)}</div>`}
      <div class="field"><span class="lbl">Fields shown in this resume</span><div class="row">${s.fields.filter((f) => f.role !== 'meta').map((f) => html`<button type="button" class=${'chip ' + (s.hiddenFields[f.key] ? '' : 'accent')} style="cursor:pointer;min-height:30px" key=${f.key} aria-pressed=${!s.hiddenFields[f.key]} onClick=${() => toggleField(f.key)}><${Icon} n=${s.hiddenFields[f.key] ? 'eyeoff' : 'eye'} cls="" />${f.label}</button>`)}</div></div>
      <div><button type="button" class="btn sm danger" onClick=${() => { A.updateResume(rid, (d) => { d.sections = d.sections.filter((x) => x.id !== s.id); }); A.toast('Removed "' + s.title + '" from this resume.', { action: { label: 'Undo', fn: () => A.undo('res:' + rid) } }); }}><${Icon} n="trash" />Remove section from this resume</button></div>
    </div>`}
  </div>`;
}

export function ContentTab({ A, r, R }) {
  const ovN = countOverrides(A.master, r);
  const shownSections = R.sections.filter((s) => s.visible).length;
  const shownItems = R.sections.reduce((n, s) => n + s.items.filter((it) => it.visible).length, 0);
  const addLocalSection = (kind) => A.updateResume(r.id, (d) => { const sec = makeSection(kind, kind === 'custom' ? 'New section' : undefined); d.sections.push({ id: uid('r_'), ref: null, local: true, kind, title: sec.title, display: sec.display, fields: sec.fields, items: [], visible: true, fieldHide: {} }); });
  const secDrag = useDragReorder((from, to) => A.updateResume(r.id, (d) => { d.sections = moveTo(d.sections, from, to); }));
  return html`<div class="stack">
    <div class="callout"><b>Linked to your master profile.</b> ${ovN ? plural(ovN, 'change') + ' made only for this resume.' : 'No resume-specific changes yet.'} Edits you make here never touch other resumes or the master.
      ${ovN > 0 && html` <button type="button" class="btn sm" onClick=${() => A.dialog({ type: 'overrides', id: r.id })}>Review changes</button>`}</div>
    ${(shownSections === 0 || shownItems === 0) && html`<div class="callout warn"><b>This resume is currently sparse.</b> Show at least one section and a few entries so exports have enough content.<div class="row" style="margin-top:8px"><button type="button" class="btn sm" onClick=${() => addLocalSection('summary')}><${Icon} n="plus" />Add summary section</button><button type="button" class="btn sm" onClick=${() => addLocalSection('skills')}><${Icon} n="plus" />Add skills section</button></div></div>`}
    <${HeaderCard} A=${A} r=${r} R=${R} />
    ${R.sections.map((s, i) => html`<${SectionCard} key=${s.id} A=${A} r=${r} s=${s} idx=${i} n=${R.sections.length} drag=${{ handle: secDrag.handle(i), container: secDrag.container(i), isDragging: secDrag.dragIdx === i, isOver: secDrag.overIdx === i && secDrag.dragIdx !== i }} />`)}
    <div class="row">
      <${Menu} align="left" btn=${html`<${Icon} n="plus" />Add section`} btnCls="btn" items=${[
        ...(R.availableSections.length ? [{ heading: 'From master' }, ...R.availableSections.map((ms) => ({ label: ms.title, icon: 'link', fn: () => A.updateResume(r.id, (d) => { d.sections.push({ id: uid('r_'), ref: ms.id, title: null, visible: true, fieldHide: {}, items: ms.items.map((mi, k) => ({ id: uid('x_'), ref: mi.id, visible: ms.kind === 'summary' ? k === 0 : true, ov: {} })) }); }) })), '-'] : []),
        { heading: 'Only in this resume' }, { label: 'Custom section', icon: 'plus', fn: () => addLocalSection('custom') }, { label: 'Certifications', icon: 'plus', fn: () => addLocalSection('certifications') }, { label: 'Projects', icon: 'plus', fn: () => addLocalSection('projects') },
      ]} />
    </div>
  </div>`;
}

/* ----- design tab ----- */
function TemplatePreview({ ir, resume, templateId, preset }) {
  const demo = useMemo(() => {
    const d: any = { ...resume, sections: resume.sections.map((s) => ({ ...s })), template: templateId, layout: { ...resume.layout, ...preset, pageSize: resume.layout.pageSize, dateFormat: resume.layout.dateFormat } };
    delete d.layout.headerAlign; delete d.layout.headingRule; delete d.layout.headingColor; delete d.layout.headingCase; delete d.layout.headingTrack; delete d.layout.nameColorMode; delete d.layout.nameScale;
    if ((d.layout.columns || 1) === 2) d.sections.forEach((rs) => {
      if (rs.col) return;
      const kind = rs.local ? rs.kind : (ir.sections.find((x) => x.id === rs.id) || {}).kind;
      rs.col = ['skills', 'certifications', 'languages'].includes(kind) ? 'side' : 'main';
    });
    return d;
  }, [ir, resume, templateId, preset]);
  const { pg } = sheetStyle(demo); const W = 220; const s = W / (pg.w * 96);
  return html`<div class="template-preview" style=${`width:${W}px;height:${Math.round(pg.h * 96 * s)}px`} aria-hidden="true"><div style=${`transform:scale(${s});width:${pg.w * 96}px`}><${ResumeSheet} ir=${ir} resume=${demo} /></div></div>`;
}

export function DesignTab({ A, r, ir }) {
  const L = r.layout; const up = (p, key?) => A.updateResume(r.id, (d) => { Object.assign(d.layout, p); }, key);
  const styleT = resolveTemplateStyle(r);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateQuery, setTemplateQuery] = useState('');
  const [templateScope, setTemplateScope] = useState('all');
  const [templateFavs, setTemplateFavs] = useState(loadTemplateFavorites);
  const favSet = useMemo(() => new Set(templateFavs), [templateFavs]);
  const chooseTemplate = (k, t) => A.updateResume(r.id, (d) => {
    d.template = k; Object.assign(d.layout, t.preset);
    delete d.layout.headerAlign; delete d.layout.headingRule; delete d.layout.headingColor; delete d.layout.headingCase; delete d.layout.headingTrack; delete d.layout.nameColorMode; delete d.layout.nameScale;
    if (d.layout.columns === 2) d.sections.forEach((rs) => {
      if (rs.col) return;
      const kind = rs.local ? rs.kind : (A.master.sections.find((ms) => ms.id === rs.ref) || {}).kind;
      rs.col = ['skills', 'certifications', 'languages'].includes(kind) ? 'side' : 'main';
    });
  });
  const toggleTemplateFav = (id) => {
    const next = favSet.has(id) ? templateFavs.filter((x) => x !== id) : [id, ...templateFavs.filter((x) => x !== id)];
    setTemplateFavs(next); saveTemplateFavorites(next);
  };
  const templateRows = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    const row = Object.entries(TEMPLATES).map(([k, t]) => {
      const category = (t.preset.columns || 1) === 2 ? 'two-column' : t.head.rule === 'none' ? 'minimal' : t.nameColor === 'accent' || t.head.color === 'accent' ? 'modern' : 'classic';
      const ats = (t.preset.columns || 1) === 1 ? 'ats' : '';
      const searchable = [k, t.name, t.blurb, category, ats, (t.preset.columns || 1) === 2 ? 'sidebar split' : 'single column'].join(' ').toLowerCase();
      return { id: k, t, category, searchable };
    }).filter((x) => {
      if (templateScope === 'favorites' && !favSet.has(x.id)) return false;
      if (templateScope === 'single' && (x.t.preset.columns || 1) !== 1) return false;
      if (templateScope === 'double' && (x.t.preset.columns || 1) !== 2) return false;
      if (templateScope === 'ats' && (x.t.preset.columns || 1) !== 1) return false;
      if (templateScope === 'modern' && !(x.category === 'modern' || x.category === 'minimal')) return false;
      if (q && !x.searchable.includes(q)) return false;
      return true;
    });
    row.sort((a, b) => {
      if (a.id === r.template) return -1;
      if (b.id === r.template) return 1;
      const af = favSet.has(a.id); const bf = favSet.has(b.id);
      if (af !== bf) return af ? -1 : 1;
      return a.t.name.localeCompare(b.t.name);
    });
    return row;
  }, [templateQuery, templateScope, favSet, r.template]);
  const accentId = useUid();
  return html`<div class="stack">
    <div class="field"><span class="lbl">Template</span>
      <div class="panel stack template-picker-summary">
        <div class="row" style="justify-content:space-between;align-items:flex-start;gap:10px">
          <div>
            <b>${(TEMPLATES[r.template] || {}).name || r.template}</b>
            <div class="muted" style="font-size:13px;margin-top:2px">${(TEMPLATES[r.template] || {}).blurb || 'Current template style'}</div>
          </div>
          <button type="button" class="btn sm primary" onClick=${() => setTemplatePickerOpen(true)}><${Icon} n="layout" />Browse templates</button>
        </div>
      </div>
    </div>
    ${templatePickerOpen && html`<${Dialog} wide title="Choose template" onClose=${() => setTemplatePickerOpen(false)} foot=${html`<button type="button" class="btn" onClick=${() => setTemplatePickerOpen(false)}><${Icon} n="x" />Close</button>`}>
      <div class="stack" style="gap:10px">
        <div class="template-tools">
          <div class="search"><${Icon} n="search" /><input class="in" type="search" aria-label="Search templates" placeholder="Search templates by name or style…" value=${templateQuery} onInput=${(e) => setTemplateQuery(e.target.value)} /></div>
          <${Seg} label="Template filter" value=${templateScope} onChange=${setTemplateScope} options=${[['all', 'All'], ['favorites', 'Favorites'], ['ats', 'ATS-safe'], ['modern', 'Modern'], ['double', '2-column']]} />
        </div>
        <div class="row template-meta"><span class="chip">${templateRows.length} shown</span><span class="muted">Current: <b>${(TEMPLATES[r.template] || {}).name || r.template}</b></span></div>
        ${templateRows.length === 0 ? html`<div class="callout">No templates match this filter. Clear filters or try a different search.</div>` : html`<div class="tpl-grid">${templateRows.map(({ id: k, t }) => html`<div key=${k} class="tpl-choice">
          <button type="button" class=${'tpl template-card ' + (r.template === k ? 'on' : '')} aria-pressed=${r.template === k} onClick=${() => { chooseTemplate(k, t); setTemplatePickerOpen(false); }}>
            <${TemplatePreview} ir=${ir} resume=${r} templateId=${k} preset=${t.preset} />
            <b>${t.name}</b><small>${t.blurb}</small>
          </button>
          <button type="button" class=${'ibtn sm template-fav ' + (favSet.has(k) ? 'on' : '')} aria-label=${favSet.has(k) ? 'Remove template from favorites' : 'Add template to favorites'} title=${favSet.has(k) ? 'Unfavorite template' : 'Favorite template'} onClick=${() => toggleTemplateFav(k)}><${Icon} n="star" /></button>
        </div>`)}</div>`}
      </div>
    </${Dialog}>`}
    <div class="callout">${(L.columns || 1) === 2 ? 'Two-column layouts use real text in table/column form, which most applicant tracking systems can still read. If a job posting asks for a simple one-column resume, switch to single column below.' : 'All templates are single-column with real text and standard headings, which is what applicant tracking systems read best.'}</div>
    <div class="field"><span class="lbl">Columns</span><${Seg} label="Columns" value=${String(L.columns || 1)} onChange=${(v) => up({ columns: Number(v) })} options=${[['1', 'Single column'], ['2', 'Two column']]} /></div>
    ${(L.columns || 1) === 2 && html`<div class="field"><span class="lbl">Sidebar</span><${Seg} label="Sidebar side" value=${L.sidebarSide || 'left'} onChange=${(v) => up({ sidebarSide: v })} options=${[['left', 'On the left'], ['right', 'On the right']]} /></div>
      <${Slider} label="Sidebar width" value=${L.sidebarWidth || 2.3} min=${1.6} max=${3.2} step=${0.1} unit=" in" onChange=${(v) => up({ sidebarWidth: v }, 'sw')} />
      <div class="hint">Choose which sections sit in the sidebar from the Content tab.</div>`}
    <div class="field"><span class="lbl">Page size</span><${Seg} label="Page size" value=${L.pageSize} onChange=${(v) => up({ pageSize: v })} options=${Object.entries(PAGES).map(([k, p]) => [k, p.label])} /></div>
    <${SelectField} label="Font family" value=${FONTS[L.font] ? L.font : 'roboto'} onChange=${(v) => up({ font: v })} options=${Object.entries(FONTS).map(([k, f]) => [k, f.label])} hint="Preview and DOCX use your selected family. PDF stays on embedded Roboto for portable rendering." />
    <${Slider} label="Font size" value=${L.fontSize} min=${9} max=${12} step=${0.5} unit=" pt" onChange=${(v) => up({ fontSize: v }, 'fs')} />
    <${Slider} label="Line spacing" value=${L.lineHeight} min=${1.05} max=${1.6} step=${0.05} unit="" onChange=${(v) => up({ lineHeight: v }, 'lh')} />
    <${Slider} label="Page margins" value=${L.margin} min=${0.4} max=${1.1} step=${0.05} unit=" in" onChange=${(v) => up({ margin: v }, 'mg')} />
    <${Slider} label="Space between sections" value=${L.sectionGap} min=${4} max=${24} step=${1} unit=" pt" onChange=${(v) => up({ sectionGap: v }, 'sg')} />
    <div class="field"><span class="lbl">Header alignment</span><${Seg} label="Header alignment" value=${L.headerAlign || 'template'} onChange=${(v) => up({ headerAlign: v === 'template' ? null : v })} options=${[['template', 'Template default'], ['left', 'Left'], ['center', 'Center'], ['right', 'Right']]} /></div>
    <div class="grid3">
      <div class="field"><span class="lbl">Heading case</span><${Seg} label="Heading case" value=${L.headingCase || 'template'} onChange=${(v) => up({ headingCase: v === 'template' ? null : v })} options=${[['template', 'Template'], ['upper', 'UPPERCASE'], ['normal', 'Sentence case']]} /></div>
      <div class="field"><span class="lbl">Heading rule</span><${Seg} label="Heading rule" value=${L.headingRule || 'template'} onChange=${(v) => up({ headingRule: v === 'template' ? null : v })} options=${[['template', 'Template'], ['none', 'None'], ['accent', 'Accent'], ['ink', 'Ink'], ['grey', 'Grey']]} /></div>
      <div class="field"><span class="lbl">Heading colour</span><${Seg} label="Heading colour" value=${L.headingColor || 'template'} onChange=${(v) => up({ headingColor: v === 'template' ? null : v })} options=${[['template', 'Template'], ['accent', 'Accent'], ['ink', 'Ink']]} /></div>
    </div>
    <div class="grid2">
      <${Slider} label="Heading letter spacing" value=${styleT.head.track} min=${0} max=${0.2} step=${0.01} unit=" em" onChange=${(v) => up({ headingTrack: v }, 'ht')} />
      <${Slider} label="Name size scale" value=${styleT.nameSize} min=${1.6} max=${2.8} step=${0.05} unit=" em" onChange=${(v) => up({ nameScale: v }, 'ns')} />
    </div>
    <div class="field"><span class="lbl">Name colour</span><${Seg} label="Name colour" value=${L.nameColorMode || 'template'} onChange=${(v) => up({ nameColorMode: v === 'template' ? null : v })} options=${[['template', 'Template'], ['accent', 'Accent'], ['ink', 'Ink']]} /></div>
    <div class="field"><label for=${accentId}>Accent colour</label><div class="row"><div class="swatches">${SWATCHES.map((c) => html`<button type="button" class="swatch" key=${c} style=${'background:' + c} aria-label=${'Accent ' + c} aria-pressed=${L.accent.toLowerCase() === c} onClick=${() => up({ accent: c })}></button>`)}</div><input id=${accentId} type="color" value=${L.accent} aria-label="Custom accent colour" onInput=${(e) => up({ accent: e.target.value }, 'ac')} style="width:44px;height:36px;border:1px solid var(--line-2);border-radius:6px;background:none;padding:2px" /></div></div>
    <${SelectField} label="Date format" value=${L.dateFormat} onChange=${(v) => up({ dateFormat: v })} options=${DATE_FORMATS} hint="Month names follow the resume language." />
    <div><button type="button" class="btn sm" onClick=${() => A.updateResume(r.id, (d) => { Object.assign(d.layout, TEMPLATES[d.template].preset); delete d.layout.headerAlign; delete d.layout.headingRule; delete d.layout.headingColor; delete d.layout.headingCase; delete d.layout.headingTrack; delete d.layout.nameColorMode; delete d.layout.nameScale; })}><${Icon} n="restore" />Reset to template defaults</button></div>
  </div>`;
}

/* ----- details tab ----- */
export function DetailsTab({ A, r }) {
  const up = (fn, key?) => A.updateResume(r.id, fn, key); const M = r.meta; const c = COUNTRIES[M.country];
  const localize = () => {
    const H = HEADINGS[M.language] || HEADINGS.en;
    up((d) => { d.sections.forEach((rs) => { const ms = rs.local ? rs : A.master.sections.find((s) => s.id === rs.ref); if (!ms || ms.kind === 'custom' || !H[ms.kind]) return; rs.title = M.language === 'en' && H[ms.kind] === KINDS[ms.kind].title && ms.title === H[ms.kind] ? null : H[ms.kind]; }); });
    A.toast('Section headings set to ' + LANGS[M.language].name + '. Entry text is not translated.');
  };
  return html`<div class="stack">
    ${(!M.jobTitle || !M.company) && html`<div class="callout"><b>Add target details for better tailoring.</b> Setting job title and company helps keep versions organized and focused.</div>`}
    <${TextField} label="Resume name" req value=${r.name} onInput=${(v) => up((d) => { d.name = v; }, 'nm')} error=${r.name.trim() ? '' : 'A name helps you find this resume on the dashboard.'} />
    <${SelectField} label="Status" value=${r.status} onChange=${(v) => up((d) => { d.status = v; })} options=${Object.entries(STATUSES)} />
    <div class="grid2"><${TextField} label="Target job title" value=${M.jobTitle} onInput=${(v) => up((d) => { d.meta.jobTitle = v; }, 'jt')} /><${TextField} label="Company" value=${M.company} onInput=${(v) => up((d) => { d.meta.company = v; }, 'co')} /></div>
    <${SelectField} label="Industry" value=${M.industry} onChange=${(v) => up((d) => { d.meta.industry = v; })} options=${[['', 'Not set'], ...INDUSTRIES]} />
    <div class="field"><${SelectField} label="Country" value=${M.country} onChange=${(v) => up((d) => { d.meta.country = v; })} options=${Object.keys(COUNTRIES)} />
      ${c && c.tip && html`<div class="hint">${c.tip}</div>`}
      <div><button type="button" class="btn sm" onClick=${() => { up((d) => { d.layout.pageSize = c.page; d.layout.dateFormat = c.date; }); A.toast('Page size and date format set for ' + M.country + '.'); }}><${Icon} n="globe" />Apply ${PAGES[c.page].label} and ${c.date} dates</button></div></div>
    <div class="field"><${SelectField} label="Language" value=${M.language} onChange=${(v) => up((d) => { d.meta.language = v; })} options=${Object.entries(LANGS).map(([k, v]) => [k, v.name])} hint="Sets month names and the word for the current job. Your own text is never translated." />
      <div><button type="button" class="btn sm" onClick=${localize}><${Icon} n="type" />Use ${LANGS[M.language].name} section headings</button></div></div>
    <div class="field"><label for="tagsin">Labels</label><${TagsEditor} id="tagsin" value=${M.tags} onChange=${(v) => up((d) => { d.meta.tags = v; })} placeholder="Add a label, for example remote" /></div>
    <${TextField} label="Job posting link" type="url" value=${M.jobUrl} onInput=${(v) => up((d) => { d.meta.jobUrl = v; }, 'ju')} placeholder="https://" right=${M.jobUrl && /^https?:\/\//.test(M.jobUrl) ? html` <a href=${M.jobUrl} target="_blank" rel="noopener noreferrer">open</a>` : null} />
    <${TextField} label="Notes" textarea value=${M.notes} onInput=${(v) => up((d) => { d.meta.notes = v; }, 'nt')} hint="Contact names, deadlines, what you changed and why." />
    <div class="muted" style="font-size:12.5px">Created ${fullTime(r.created)} · Last edited ${fullTime(r.updated)}</div>
    <div class="row"><button type="button" class="btn" onClick=${() => A.duplicateResume(r.id)}><${Icon} n="copy" />Duplicate</button>
      <button type="button" class="btn" onClick=${() => up((d) => { d.status = d.status === 'archived' ? 'draft' : 'archived'; })}><${Icon} n="archive" />${r.status === 'archived' ? 'Restore' : 'Archive'}</button>
      <button type="button" class="btn danger" onClick=${() => A.dialog({ type: 'confirm', title: 'Delete "' + r.name + '"?', body: 'This removes the resume and its saved versions. The master profile stays as it is.', confirm: 'Delete resume', danger: true, onConfirm: () => { A.go({ name: 'dashboard' }); A.deleteResume(r.id); } })}><${Icon} n="trash" />Delete</button></div>
  </div>`;
}

/* ----- tailor tab ----- */
export function TailorTab({ A, r, ir }) {
  const jd = r.meta.jobDescription || '';
  const kws = useMemo(() => extractKeywords(jd), [jd]);
  const text = useMemo(() => irPlain(ir), [ir]);
  const match = useMemo(() => keywordMatch(kws, text), [kws, text]);
  const health = useMemo(() => resumeHealth(ir, r), [ir, r]);
  const bulletQ = useMemo(() => bulletQualityInsights(ir), [ir]);
  const jobMatchScore = useMemo(() => {
    const keywordPart = kws.length ? match.score * 0.5 : 35;
    const healthPart = health.score * 0.35;
    const metricPart = bulletQ.metricCoverage * 0.15;
    const repeatPenalty = Math.min(12, bulletQ.repeatedLeadWords.reduce((n, x) => n + Math.max(0, x.count - 2), 0) * 2);
    return Math.max(0, Math.min(100, Math.round(keywordPart + healthPart + metricPart - repeatPenalty)));
  }, [kws.length, match.score, health.score, bulletQ.metricCoverage, bulletQ.repeatedLeadWords]);
  const matchChecks = useMemo(() => {
    const contactOk = health.checks.find((c) => c.label === 'Contact details')?.ok;
    const summaryOk = health.checks.find((c) => c.label === 'Summary section')?.ok;
    const keywordOk = !kws.length || match.score >= 55;
    const metricsOk = bulletQ.totalBullets === 0 ? false : bulletQ.metricCoverage >= 40;
    const varietyOk = bulletQ.repeatedLeadWords.length === 0;
    return [
      { label: 'Contact details are complete', ok: !!contactOk, tip: 'Add email + phone in header contacts.' },
      { label: 'Summary section is visible', ok: !!summaryOk, tip: 'Add a short role-specific summary.' },
      { label: kws.length ? 'Keyword coverage is at least 55%' : 'Keyword coverage will appear once JD is pasted', ok: keywordOk, tip: 'Use employer wording in your real achievements.' },
      { label: 'At least 40% bullets include metrics', ok: metricsOk, tip: 'Add numbers: %, $, counts, time saved, SLA, revenue.' },
      { label: 'Bullet lead words are varied', ok: varietyOk, tip: 'Avoid starting many bullets with the same verb.' },
    ];
  }, [health.checks, kws.length, match.score, bulletQ.totalBullets, bulletQ.metricCoverage, bulletQ.repeatedLeadWords.length]);
  const addKw = (kw) => A.updateResume(r.id, (d) => {
    let rs = d.sections.find((s) => s.local && s.kind === 'skills' && s.__kw);
    if (!rs) { const sec = makeSection('skills', 'Additional skills'); rs = { id: uid('r_'), ref: null, local: true, __kw: true, kind: 'skills', title: 'Additional skills', display: 'groups', fields: sec.fields, items: [], visible: true, fieldHide: {} }; d.sections.push(rs); }
    let it = rs.items[0]; if (!it) { it = { id: uid('x_'), local: true, visible: true, v: { title: 'Role keywords', tags: [] } }; rs.items.push(it); }
    if (!it.v.tags.includes(kw)) it.v.tags.push(kw);
  });
  return html`<div class="stack">
    ${!jd.trim() && html`<div class="callout"><b>Start with the job description.</b> Paste the full posting here to unlock keyword guidance and stronger role alignment checks.</div>`}
    <div class="panel stack" style="padding:14px">
      <div class="row" style="align-items:flex-end;gap:16px"><span class="bigpct">${jobMatchScore}%</span><span class="muted" style="padding-bottom:4px">ATS-style job match score</span></div>
      <div class="meter" role="img" aria-label=${jobMatchScore + ' percent job match'}><i style=${`width:${jobMatchScore}%`}></i></div>
      <div class="muted" style="font-size:12.5px">
        ${kws.length ? match.found.length + '/' + kws.length + ' role terms found' : 'Paste a job description to unlock term matching'} · ${bulletQ.quantifiedBullets}/${bulletQ.totalBullets} bullets quantified
      </div>
      <ul style="list-style:none;margin:0;padding:0;display:grid;gap:6px" aria-label="Job match checks">
        ${matchChecks.map((c) => html`<li key=${c.label} class="row" style="flex-wrap:nowrap;align-items:flex-start"><span class=${'chip ' + (c.ok ? 'ok' : 'warn')} style="flex:none">${c.ok ? 'pass' : 'improve'}</span><span style="flex:1;min-width:0">${c.label}${!c.ok && html`<div class="hint" style="margin-top:3px">${c.tip}</div>`}</span></li>`)}
      </ul>
    </div>
    <div class="panel stack" style="padding:14px">
      <div class="row" style="align-items:flex-end;gap:16px"><span class="bigpct">${health.score}%</span><span class="muted" style="padding-bottom:4px">resume health</span></div>
      <div class="meter" role="img" aria-label=${health.score + ' percent resume health'}><i style=${`width:${health.score}%`}></i></div>
      <div class="muted" style="font-size:12.5px">${health.wordCount} words · ${health.totalBullets} impact bullets</div>
      <ul style="margin:0;padding-left:18px;display:grid;gap:6px">${health.suggestions.slice(0, 4).map((s) => html`<li key=${s}>${s}</li>`)}</ul>
    </div>
    ${bulletQ.repeatedLeadWords.length > 0 && html`<div class="callout warn">Repeated bullet starters detected: ${bulletQ.repeatedLeadWords.map((x) => x.word + ' (' + x.count + ')').join(', ')}. Vary lead verbs to sound less repetitive.</div>`}
    <p class="muted" style="font-size:13.5px">Paste the job description to see which of its terms already appear in this resume. It is a plain word-frequency comparison that runs on your device, so treat it as a prompt for honest editing, not a score to chase.</p>
    <${TextField} label="Job description" textarea rows=${8} value=${jd} onInput=${(v) => A.updateResume(r.id, (d) => { d.meta.jobDescription = v; }, 'jd')} placeholder="Paste the posting text here" />
    ${kws.length === 0 ? html`<div class="callout">${jd.trim() ? 'No distinctive terms found. Paste more of the posting.' : 'Nothing analysed yet.'}</div>` : html`
      <div class="panel stack" style="padding:14px">
        <div class="row" style="align-items:flex-end;gap:16px"><span class="bigpct">${match.score}%</span><span class="muted" style="padding-bottom:4px">of the ${kws.length} top terms appear in this resume</span></div>
        <div class="meter" role="img" aria-label=${match.score + ' percent keyword coverage'}><i style=${`width:${match.score}%`}></i></div>
        <div><div class="lbl">Already covered (${match.found.length})</div><div class="kw" style="margin-top:6px">${match.found.map((k) => html`<span class="chip ok" key=${k}>${k}</span>`)}</div></div>
        <div><div class="lbl">Not found (${match.missing.length})</div><div class="kw" style="margin-top:6px">${match.missing.map((k) => html`<button type="button" class="chip warn" style="cursor:pointer;min-height:30px" key=${k} title="Add as a skill in this resume only" onClick=${() => { addKw(k); A.toast('Added "' + k + '" under Additional skills in this resume.'); }}><${Icon} n="plus" cls="" />${k}</button>`)}</div>
          <p class="hint" style="margin-top:6px">Click a term to add it to this resume's own skills list. Only add what you can back up in an interview. Better still, reword a real achievement to use the employer's language.</p></div>
      </div>`}
  </div>`;
}

/* ----- history tab ----- */
export function HistoryTab({ A, r }) {
  const [snaps, setSnaps] = useState(null); const [note, setNote] = useState(''); const [tick, setTick] = useState(0);
  useEffect(() => { let live = true; A.listSnapshots(r.id).then((s) => live && setSnaps(s)).catch(() => live && setSnaps([])); return () => { live = false; }; }, [r.id, r.vcount, tick]);
  const cur = () => irPlain(buildIR(A.master, r));
  const kindChip = { auto: 'Autosave', manual: 'Saved version', restore: 'Before restore', created: 'Created' };
  return html`<div class="stack">
    <div class="callout">Tip: save a named version before major edits, exports, or role pivots so you can compare and restore quickly.</div>
    <form class="row" onSubmit=${(e) => { e.preventDefault(); A.snapshot(r.id, note.trim() || 'Saved version', 'manual'); setNote(''); }}>
      <input class="in" style="flex:1 1 180px;width:auto" aria-label="Version note" placeholder="Note, for example Sent to Acme" value=${note} onInput=${(e) => setNote(e.target.value)} />
      <button type="submit" class="btn primary"><${Icon} n="history" />Save version</button></form>
    <p class="hint">Versions are saved automatically after about ten minutes of editing and before every restore. They store this resume's content, layout and overrides. Master profile text is read live, so restoring brings back this resume's choices, not older master wording; use Compare to see the text that was printed.</p>
    ${snaps === null ? html`<div class="muted">Loading versions…</div>` : snaps.length === 0 ? html`<div class="callout">No saved versions yet.</div>` : html`<div class="hist">${snaps.map((s) => html`<div class="hist-item" key=${s._id}>
      <div class="row" style="justify-content:space-between"><b style="overflow-wrap:anywhere">${s.label}</b><span class=${'chip ' + (s.kind === 'manual' ? 'accent' : '')}>${kindChip[s.kind] || s.kind}</span></div>
      <div class="muted" style="font-size:12.5px" title=${fullTime(s.at)}>${fullTime(s.at)} · ${relTime(s.at)}</div>
      <div class="row"><button type="button" class="btn sm" onClick=${() => A.dialog({ type: 'diff', title: 'Changes since "' + s.label + '"', a: { label: fullTime(s.at), text: s.text }, b: { label: 'Now', text: cur() } })}><${Icon} n="compare" />Compare with now</button>
        <button type="button" class="btn sm" onClick=${() => A.dialog({ type: 'confirm', title: 'Restore this version?', body: 'Your current state is saved as a new version first, so you can come back to it.', confirm: 'Restore', onConfirm: () => A.restoreSnapshot(r.id, s) })}><${Icon} n="restore" />Restore</button>
        <button type="button" class="btn sm ghost" onClick=${() => A.dialog({ type: 'confirm', title: 'Delete this saved version?', body: 'The version "' + s.label + '" is removed. The resume itself is not changed.', confirm: 'Delete version', danger: true, onConfirm: () => A.deleteSnapshot(r.id, s._id).then(() => setTick((t) => t + 1)) })}><${Icon} n="trash" />Delete</button></div>
    </div>`)}</div>`}
  </div>`;
}

/* ----- editor shell ----- */
export function Editor({ A, id }) {
  const r = A.resumes[id];
  useEffect(() => { if (!r) A.go({ name: 'dashboard' }); }, [!r]);
  return r ? html`<${EditorInner} A=${A} id=${id} r=${r} key=${id} />` : null;
}
export function EditorInner({ A, id, r }) {
  const tabs = [['content', 'Content', 'layers'], ['design', 'Design', 'layout'], ['details', 'Details', 'info'], ['tailor', 'Tailor', 'target'], ['history', 'History', 'history']];
  const LEFT_PANEL_WIDTH_KEY = 'resumate:editor:left-panel-width';
  const LEFT_PANEL_MIN = 320;
  const LEFT_PANEL_MAX = 760;
  const [tab, setTab] = useState(() => {
    try {
      const t = localStorage.getItem('resumate:editor:pendingTab') || 'content';
      return tabs.some(([k]) => k === t) ? t : 'content';
    } catch (e) { return 'content'; }
  });
  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    try {
      const raw = Number(localStorage.getItem(LEFT_PANEL_WIDTH_KEY));
      return Number.isFinite(raw) ? clamp(raw, LEFT_PANEL_MIN, LEFT_PANEL_MAX) : 420;
    } catch (e) { return 420; }
  });
  const [isCompactLayout, setIsCompactLayout] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 820 : false));
  const [pane, setPane] = useState('edit'); const [focusMode, setFocusMode] = useState(false); const [zoom, setZoom] = useState('fit'); const [, setPages] = useState(1);
  const bodyRef = useRef<any>(null);
  const R = useMemo(() => resolve(A.master, r), [A.master, r]);
  const ir = useMemo(() => buildIR(A.master, r), [A.master, r]);
  const notes = useMemo(() => atsNotes(ir, r), [ir, r]);
  useEffect(() => { try { localStorage.removeItem('resumate:editor:pendingTab'); } catch (e) { /* ignore */ } }, []);
  useEffect(() => {
    const onResize = () => setIsCompactLayout(window.innerWidth <= 820);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const saveLeftPanelWidth = (n) => {
    try { localStorage.setItem(LEFT_PANEL_WIDTH_KEY, String(Math.round(n))); } catch (e) { /* ignore */ }
  };
  const resizeLeftPanel = (deltaX, startWidth) => {
    const hostWidth = bodyRef.current ? bodyRef.current.clientWidth : 0;
    const maxFromHost = hostWidth > 0 ? Math.max(LEFT_PANEL_MIN, Math.min(LEFT_PANEL_MAX, hostWidth - 360)) : LEFT_PANEL_MAX;
    const next = clamp(startWidth + deltaX, LEFT_PANEL_MIN, maxFromHost);
    setLeftPanelWidth(next);
    return next;
  };
  const onResizeStart = (e) => {
    if (isCompactLayout || focusMode) return;
    const startX = e.clientX;
    const startWidth = leftPanelWidth;
    const onMove = (ev) => resizeLeftPanel(ev.clientX - startX, startWidth);
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      saveLeftPanelWidth(resizeLeftPanel(ev.clientX - startX, startWidth));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  const onResizeKeyDown = (e) => {
    if (isCompactLayout || focusMode) return;
    const step = e.shiftKey ? 48 : 16;
    if (e.key === 'ArrowLeft') { e.preventDefault(); const next = resizeLeftPanel(-step, leftPanelWidth); saveLeftPanelWidth(next); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); const next = resizeLeftPanel(step, leftPanelWidth); saveLeftPanelWidth(next); }
  };
  const scope = 'res:' + id;
  const tabBtnId = 'ed-tab-' + tab;
  const tabPaneId = 'ed-tabpanel-' + tab;
  const tabIds = tabs.map(([k]) => k);
  const setTabByIndex = (idx) => {
    const next = tabIds[(idx + tabIds.length) % tabIds.length];
    setTab(next);
    const el = document.getElementById('ed-tab-' + next);
    if (el && typeof el.focus === 'function') el.focus();
  };
  const onTabsKeyDown = (e) => {
    const idx = tabIds.indexOf(tab);
    if (idx < 0) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); setTabByIndex(idx + 1); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setTabByIndex(idx - 1); return; }
    if (e.key === 'Home') { e.preventDefault(); setTabByIndex(0); return; }
    if (e.key === 'End') { e.preventDefault(); setTabByIndex(tabIds.length - 1); }
  };
  return html`<div class=${'ed ' + (focusMode ? 'focus' : '')} data-pane=${focusMode ? 'edit' : pane}>
    <div class="ed-top">
      <${IconBtn} n="left" label="Back to resumes" onClick=${() => A.go({ name: 'dashboard' })} />
      <div class="ed-title"><label class="sr" for="rname">Resume name</label><input id="rname" value=${r.name} onInput=${(e) => A.updateResume(id, (d) => { d.name = e.target.value; }, 'nm')} /></div>
      <select class="in" style="width:auto;min-height:36px" aria-label="Status" value=${r.status} onChange=${(e) => A.updateResume(id, (d) => { d.status = e.target.value; })}>${Object.entries(STATUSES).map(([k, v]) => html`<option value=${k} selected=${r.status === k}>${v}</option>`)}</select>
      <${SaveState} st=${A.saveStatus} mode=${A.mode} />
      <${UndoBar} A=${A} scope=${scope} />
      <button type="button" class=${'btn sm ' + (focusMode ? 'primary' : '')} aria-pressed=${focusMode} onClick=${() => setFocusMode(!focusMode)}><${Icon} n="type" />${focusMode ? 'Exit focus' : 'Focus mode'}</button>
      <div class="seg ed-switch" role="group" aria-label="Pane"><button type="button" aria-pressed=${pane === 'edit'} onClick=${() => setPane('edit')}><${Icon} n="edit" />Edit</button><button type="button" aria-pressed=${pane === 'preview'} onClick=${() => setPane('preview')}><${Icon} n="eye" />Preview</button></div>
      <${Menu} btnCls="btn primary" btn=${html`<${Icon} n="download" />Export`} items=${Object.entries(EXPORTS).map(([k, e]) => ({ label: e.label, icon: 'download', fn: () => A.dialog({ type: 'export', id, kind: k }) }))} />
    </div>
    <div class="ed-body" ref=${bodyRef} style=${!isCompactLayout && !focusMode ? `grid-template-columns:${Math.round(leftPanelWidth)}px 10px minmax(0,1fr)` : ''}>
      <div class="ed-left">
        <div class="tabs" role="tablist" aria-label="Editor sections" aria-orientation="horizontal" onKeyDown=${onTabsKeyDown}>${tabs.map(([k, l, ic]) => html`<button type="button" role="tab" id=${'ed-tab-' + k} key=${k} aria-selected=${tab === k} aria-controls=${'ed-tabpanel-' + k} tabIndex=${tab === k ? 0 : -1} onClick=${() => setTab(k)}><${Icon} n=${ic} /><span>${l}</span></button>`)}</div>
        <div class="tabpane" role="tabpanel" id=${tabPaneId} aria-labelledby=${tabBtnId}>
          ${tab === 'content' && html`<${ContentTab} A=${A} r=${r} R=${R} />`}
          ${tab === 'design' && html`<${DesignTab} A=${A} r=${r} ir=${ir} />`}
          ${tab === 'details' && html`<${DetailsTab} A=${A} r=${r} />`}
          ${tab === 'tailor' && html`<${TailorTab} A=${A} r=${r} ir=${ir} />`}
          ${tab === 'history' && html`<${HistoryTab} A=${A} r=${r} />`}
        </div>
      </div>
      <div
        class="ed-resize-handle"
        role="separator"
        aria-label="Resize editor panel"
        aria-orientation="vertical"
        aria-valuemin=${LEFT_PANEL_MIN}
        aria-valuemax=${LEFT_PANEL_MAX}
        aria-valuenow=${Math.round(leftPanelWidth)}
        tabIndex=${isCompactLayout || focusMode ? -1 : 0}
        onPointerDown=${onResizeStart}
        onKeyDown=${onResizeKeyDown}
      ><${Icon} n="grip" /></div>
      <${Preview} ir=${ir} resume=${r} zoom=${zoom} setZoom=${setZoom} onPages=${setPages} notes=${notes} />
    </div>
  </div>`;
}
