import type { Resume } from '../types';
import { DEFAULT_ROLE, DISPLAYS, FIELD_TYPES, HEADER_FIELDS, KINDS, TEXT_ROLES } from '../core/constants';
import { blankItem, defaultValue, itemLabel, itemSubLabel, makeSection, masterIsEmpty } from '../core/model';
import { clone, moveItem, moveTo, str, uid } from '../core/util';
import { FieldRow, Icon, IconBtn, Menu, SelectField, Switch, TextField, plural, useDragReorder } from '../ui/base';
import { html, useEffect, useMemo, useState } from '../ui/h';

/* =====================================================================
   Master profile
   ===================================================================== */
export function UndoBar({ A, scope }) {
  return html`<div class="row" style="gap:2px"><${IconBtn} n="undo" label="Undo" disabled=${!A.canUndo(scope)} onClick=${() => A.undo(scope)} /><${IconBtn} n="redo" label="Redo" disabled=${!A.canRedo(scope)} onClick=${() => A.redo(scope)} /></div>`;
}

export function HeaderEditor({ A }) {
  const m = A.master; const H = m.header; const v = H.values;
  const up = (fn, key?) => A.updateMaster(fn, key);
  const emailBad = v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email);
  return html`<div class="stack">
    <div class="panel stack">
      <h2 style="font-size:19px">Personal details</h2>
      <p class="muted" style="font-size:13.5px">Used by every resume. A resume can show, hide or override each value without changing this page.</p>
      <div class="grid2">
        ${HEADER_FIELDS.map(([k, label, type]) => html`<div style=${k === 'headline' ? 'grid-column:1/-1' : ''} key=${k}><${TextField} label=${label} req=${k === 'fullName'} type=${type === 'email' ? 'email' : type === 'tel' ? 'tel' : 'text'} value=${v[k]} onInput=${(x) => up((d) => { d.header.values[k] = x; }, 'h:' + k)} error=${k === 'email' && emailBad ? 'This does not look like an email address.' : ''} autoComplete=${type === 'name' ? 'name' : type === 'email' ? 'email' : type === 'tel' ? 'tel' : 'off'} /></div>`)}
      </div>
    </div>
    <div class="panel stack">
      <div class="row" style="justify-content:space-between"><h3 style="font-size:16px">Links</h3><button type="button" class="btn sm" onClick=${() => up((d) => { d.header.links.push({ id: uid('l_'), label: '', url: '' }); })}><${Icon} n="plus" />Add link</button></div>
      ${H.links.length === 0 && html`<p class="muted" style="font-size:13.5px">LinkedIn, GitHub, portfolio or publications.</p>`}
      ${H.links.map((l, i) => html`<div class="schema-row" key=${l.id} style="grid-template-columns:minmax(0,1fr) minmax(0,2fr) auto">
        <input class="in" aria-label="Link label" placeholder="Label" value=${l.label} onInput=${(e) => up((d) => { d.header.links[i].label = e.target.value; }, 'l' + l.id)} />
        <input class="in" aria-label="Link address" type="url" placeholder="https://" value=${l.url} onInput=${(e) => up((d) => { d.header.links[i].url = e.target.value; }, 'u' + l.id)} />
        <${IconBtn} n="trash" label="Remove link" onClick=${() => up((d) => { d.header.links.splice(i, 1); })} /></div>`)}
    </div>
    <div class="panel stack">
      <div class="row" style="justify-content:space-between"><h3 style="font-size:16px">Extra details</h3><button type="button" class="btn sm" onClick=${() => up((d) => { d.header.extra.push({ id: uid('e_'), label: '', value: '' }); })}><${Icon} n="plus" />Add detail</button></div>
      <p class="muted" style="font-size:13.5px">Country-specific facts such as nationality, visa status, date of birth or notice period. Each resume chooses which of these to show.</p>
      ${H.extra.map((l, i) => html`<div class="schema-row" key=${l.id} style="grid-template-columns:minmax(0,1fr) minmax(0,2fr) auto">
        <input class="in" aria-label="Detail label" placeholder="Label (for example Nationality)" value=${l.label} onInput=${(e) => up((d) => { d.header.extra[i].label = e.target.value; }, 'el' + l.id)} />
        <input class="in" aria-label="Detail value" placeholder="Value" value=${l.value} onInput=${(e) => up((d) => { d.header.extra[i].value = e.target.value; }, 'ev' + l.id)} />
        <${IconBtn} n="trash" label="Remove detail" onClick=${() => up((d) => { d.header.extra.splice(i, 1); })} /></div>`)}
    </div>
  </div>`;
}

export function SchemaEditor({ A, sec }) {
  const [nf, setNf] = useState({ label: '', type: 'text' });
  const upSec = (fn, key?) => A.updateMaster((d) => fn(d.sections.find((s) => s.id === sec.id)), key);
  const removeField = (f) => A.dialog({ type: 'confirm', title: 'Remove field "' + f.label + '"?', body: 'The values stored in this field are deleted from every entry in the master profile. Resumes that showed the field will stop showing it.', confirm: 'Remove field', danger: true, onConfirm: () => upSec((s) => { s.fields = s.fields.filter((x) => x.key !== f.key); s.items.forEach((it) => { delete it.v[f.key]; }); }) });
  return html`<div class="stack">
    <p class="muted" style="font-size:13.5px">Fields are what you fill in for each entry. Rename them, add your own, change how they print, or remove the ones you do not use.</p>
    <div>${sec.fields.map((f, i) => html`<div class="schema-row" key=${f.key}>
      <input class="in" aria-label="Field name" value=${f.label} onInput=${(e) => upSec((s) => { s.fields[i].label = e.target.value; }, 'fl' + f.key)} />
      ${f.builtin ? html`<span class="chip" style="justify-self:start">${FIELD_TYPES[f.type]}</span>` : html`<select class="in" aria-label="Field type" value=${f.type} onChange=${(e) => upSec((s) => { const t = e.target.value; const old = s.fields[i]; if (old.type !== t) { s.fields[i].type = t; s.fields[i].role = DEFAULT_ROLE[t]; s.items.forEach((it) => { it.v[old.key] = defaultValue(s.fields[i]); }); } })}>${Object.entries(FIELD_TYPES).map(([k, l]) => html`<option value=${k} selected=${f.type === k}>${l}</option>`)}</select>`}
      ${(f.type === 'text') && f.role !== 'meta' ? html`<select class="in" aria-label="Prints as" value=${f.role} onChange=${(e) => upSec((s) => { s.fields[i].role = e.target.value; })}>${Object.entries(TEXT_ROLES).map(([k, l]) => html`<option value=${k} selected=${f.role === k}>Prints as ${l.toLowerCase()}</option>`)}</select>` : html`<span class="muted" style="font-size:12.5px">${f.role === 'meta' ? 'Not printed' : 'Prints as ' + (ROLE_LABEL[f.role] || f.role)}</span>`}
      <div class="row" style="gap:0;flex-wrap:nowrap"><${IconBtn} n="up" label="Move field up" cls="sm" disabled=${i === 0} onClick=${() => upSec((s) => { s.fields = moveItem(s.fields, i, -1); })} /><${IconBtn} n="down" label="Move field down" cls="sm" disabled=${i === sec.fields.length - 1} onClick=${() => upSec((s) => { s.fields = moveItem(s.fields, i, 1); })} /><${IconBtn} n="trash" label=${'Remove field ' + f.label} cls="sm" disabled=${sec.fields.length <= 1} onClick=${() => removeField(f)} /></div>
    </div>`)}</div>
    <form class="row" onSubmit=${(e) => { e.preventDefault(); if (!nf.label.trim()) return; upSec((s) => { const f = { key: uid('f_'), label: nf.label.trim(), type: nf.type, role: DEFAULT_ROLE[nf.type], req: false, builtin: false }; s.fields.push(f); s.items.forEach((it) => { it.v[f.key] = defaultValue(f); }); }); setNf({ label: '', type: 'text' }); }}>
      <input class="in" style="flex:1 1 180px;width:auto" aria-label="New field name" placeholder="New field name, for example Team size" value=${nf.label} onInput=${(e) => setNf({ ...nf, label: e.target.value })} />
      <select class="in" style="width:auto" aria-label="New field type" value=${nf.type} onChange=${(e) => setNf({ ...nf, type: e.target.value })}>${Object.entries(FIELD_TYPES).map(([k, l]) => html`<option value=${k} selected=${nf.type === k}>${l}</option>`)}</select>
      <button type="submit" class="btn" disabled=${!nf.label.trim()}><${Icon} n="plus" />Add field</button>
    </form>
  </div>`;
}
export const ROLE_LABEL = { title: 'headline', subtitle: 'subheadline', location: 'location', dates: 'dates', text: 'paragraph', bullets: 'bullets', tags: 'tags', link: 'link', extra: 'labelled line' };

export function MasterItem({ A, sec, it, idx, n, usage, open, setOpen, drag }) {
  const uses = usage[it.id] ? usage[it.id].size : 0;
  const upItem = (fn, key?) => A.updateMaster((d) => { const s = d.sections.find((x) => x.id === sec.id); fn(s, s.items.find((x) => x.id === it.id)); }, key);
  const del = () => {
    const doDel = (mode) => A.deleteMasterItem(sec.id, it.id, mode);
    if (!uses) return doDel('all');
    A.dialog({ type: 'confirm', title: 'Delete this entry from the master profile?', body: 'It is used in ' + plural(uses, 'resume') + ': ' + [...usage[it.id]].map((id) => (A.resumes[id] || {}).name).filter(Boolean).join(', ') + '.', confirm: 'Delete everywhere', danger: true, onConfirm: () => doDel('all'), extra: [{ label: 'Delete from master, keep copies in resumes', fn: () => doDel('keep') }] });
  };
  const fields = sec.fields.filter((f) => f.role !== 'meta' || sec.kind === 'summary');
  const dcls = drag ? (drag.isDragging ? ' dragging' : '') + (drag.isOver ? ' drag-over' : '') : '';
  return html`<div class=${'item' + dcls} role="group" aria-label=${itemLabel(sec, it.v)} onDragOver=${drag && drag.container.onDragOver} onDragLeave=${drag && drag.container.onDragLeave} onDrop=${drag && drag.container.onDrop}>
    <div class="item-head">
      ${drag && html`<span class="drag-handle" aria-hidden="true" title="Drag to reorder" draggable="true" onDragStart=${drag.handle.onDragStart} onDragEnd=${drag.handle.onDragEnd}><${Icon} n="grip" /></span>`}
      <button type="button" class="t" aria-expanded=${open} onClick=${() => setOpen(!open)}><b>${itemLabel(sec, it.v)}</b><small>${itemSubLabel(sec, it.v) || (sec.kind === 'summary' ? str(it.v.text).slice(0, 70) : '')}</small></button>
      ${uses > 0 && html`<span class="chip" title="Resumes using this entry">in ${plural(uses, 'resume')}</span>`}
      <${IconBtn} n="up" label="Move entry up" cls="sm" disabled=${idx === 0} onClick=${() => A.updateMaster((d) => { const s = d.sections.find((x) => x.id === sec.id); s.items = moveItem(s.items, idx, -1); })} />
      <${IconBtn} n="down" label="Move entry down" cls="sm" disabled=${idx === n - 1} onClick=${() => A.updateMaster((d) => { const s = d.sections.find((x) => x.id === sec.id); s.items = moveItem(s.items, idx, 1); })} />
      <${Menu} label="Entry actions" items=${[{ label: 'Duplicate entry', icon: 'copy', fn: () => A.updateMaster((d) => { const s = d.sections.find((x) => x.id === sec.id); const c = clone(it); c.id = uid('i_'); s.items.splice(idx + 1, 0, c); setOpen(false); }) }, { label: 'Delete entry…', icon: 'trash', danger: true, fn: del }]} />
    </div>
    ${open && html`<div class="item-body"><div class="grid2" style="padding-top:12px">
      ${uses > 0 && html`<div class="callout" style="grid-column:1/-1">Changes here update ${plural(uses, 'resume')} except where a resume has its own edit of the same field.</div>`}
      ${fields.map((f) => html`<${FieldRow} key=${f.key} f=${f} value=${it.v[f.key]} scope="master" onChange=${(val) => upItem((s, i) => { i.v[f.key] = val; }, 'v' + it.id + f.key)} />`)}
    </div></div>`}
  </div>`;
}

export function SectionEditor({ A, sec, usage, secIdx }) {
  const [open, setOpen] = useState({}); const [schema, setSchema] = useState(false);
  const m = A.master; const nSec = m.sections.length;
  const upSec = (fn, key?) => A.updateMaster((d) => fn(d.sections.find((s) => s.id === sec.id)), key);
  const itemsDrag = useDragReorder((from, to) => upSec((s) => { s.items = moveTo(s.items, from, to); }));
  const secUses = Object.values<Resume>(A.resumes).filter((r) => r.sections.some((rs) => rs.ref === sec.id));
  const addItem = () => { const it = blankItem(sec); upSec((s) => { s.items.push(it); }); setOpen({ ...open, [it.id]: true }); };
  const delSec = () => {
    const go = (mode) => A.deleteMasterSection(sec.id, mode);
    A.dialog({ type: 'confirm', title: 'Delete the "' + sec.title + '" section?', body: 'It holds ' + plural(sec.items.length, 'entry', 'entries') + (secUses.length ? ' and appears in ' + plural(secUses.length, 'resume') + '.' : '.') + ' Undo is available right afterwards.', confirm: secUses.length ? 'Delete everywhere' : 'Delete section', danger: true, onConfirm: () => go('all'), extra: secUses.length ? [{ label: 'Delete from master, keep copies in resumes', fn: () => go('keep') }] : [] });
  };
  const noun = sec.kind === 'summary' ? 'summary version' : 'entry';
  return html`<div class="stack">
    <div class="panel stack">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div style="flex:1 1 220px;min-width:0"><${TextField} label="Section name" value=${sec.title} onInput=${(v) => upSec((s) => { s.title = v; }, 'st')} hint=${'Type: ' + (KINDS[sec.kind] ? KINDS[sec.kind].title : 'Custom') + '. Resumes can rename it for themselves.'} /></div>
        <div class="row"><${IconBtn} n="up" label="Move section up" disabled=${secIdx === 0} onClick=${() => A.updateMaster((d) => { d.sections = moveItem(d.sections, secIdx, -1); })} /><${IconBtn} n="down" label="Move section down" disabled=${secIdx === nSec - 1} onClick=${() => A.updateMaster((d) => { d.sections = moveItem(d.sections, secIdx, 1); })} /><${IconBtn} n="trash" label="Delete section" onClick=${delSec} /></div>
      </div>
      <div class="grid2" style="align-items:end">
        <${SelectField} label="Prints as" value=${sec.display} onChange=${(v) => upSec((s) => { s.display = v; })} options=${Object.entries(DISPLAYS)} />
        <${Switch} checked=${sec.defaultVisible !== false} onChange=${(c) => upSec((s) => { s.defaultVisible = c; })} label="Show in new resumes" />
      </div>
      <div><button type="button" class="btn sm" aria-expanded=${schema} onClick=${() => setSchema(!schema)}><${Icon} n="sliders" />Fields (${sec.fields.length})<${Icon} n=${schema ? 'up' : 'down'} /></button></div>
      ${schema && html`<${SchemaEditor} A=${A} sec=${sec} />`}
    </div>
    ${sec.items.length === 0 && html`<div class="empty card" style="padding:32px 16px"><h2 style="font-size:18px">No ${noun === 'entry' ? 'entries' : 'summary versions'} yet</h2><p>${sec.kind === 'summary' ? 'Write a few short summaries once, for example one for leadership roles and one for hands-on roles. Each resume picks the one it needs.' : 'Add your first entry. Everything here is reusable across resumes.'}</p></div>`}
    ${sec.items.map((it, i) => html`<${MasterItem} key=${it.id} A=${A} sec=${sec} it=${it} idx=${i} n=${sec.items.length} usage=${usage} open=${!!open[it.id]} setOpen=${(o) => setOpen({ ...open, [it.id]: o })} drag=${{ handle: itemsDrag.handle(i), container: itemsDrag.container(i), isDragging: itemsDrag.dragIdx === i, isOver: itemsDrag.overIdx === i && itemsDrag.dragIdx !== i }} />`)}
    <div><button type="button" class="btn primary" onClick=${addItem}><${Icon} n="plus" />Add ${noun}</button></div>
  </div>`;
}

export function MasterView({ A }) {
  const m = A.master; const [sel, setSel] = useState('header');
  const usage = useMemo(() => { const u = {}; Object.values<Resume>(A.resumes).forEach((r) => r.sections.forEach((rs) => rs.items.forEach((ri) => { if (ri.ref) (u[ri.ref] = u[ri.ref] || new Set()).add(r.id); }))); return u; }, [A.resumes]);
  const secIdx = m.sections.findIndex((s) => s.id === sel); const sec = m.sections[secIdx];
  useEffect(() => { if (sel !== 'header' && !sec) setSel('header'); }, [sel, sec]);
  const presentKinds = new Set(m.sections.map((s) => s.kind));
  const addSection = (kind) => { const s = makeSection(kind, kind === 'custom' ? 'New section' : undefined); A.updateMaster((d) => { d.sections.push(s); }); setSel(s.id); };
  const secDrag = useDragReorder((from, to) => A.updateMaster((d) => { d.sections = moveTo(d.sections, from, to); }));
  const empty = masterIsEmpty(m);
  return html`<div class="page">
    <div class="page-head"><div><h1>Master profile</h1><p>The single source of truth. Resumes link to it, so a correction here reaches every resume that has not overridden that field.</p></div>
      <div class="actions"><${UndoBar} A=${A} scope="master" /><button type="button" class="btn" onClick=${() => A.dialog({ type: 'import' })}><${Icon} n="upload" />Import resume</button></div></div>
    ${empty && html`<div class="callout">Your profile is empty. Fill in the details below, import an existing resume, or <button type="button" class="btn sm" onClick=${() => A.loadSample()}>load tech sample</button> / <button type="button" class="btn sm" onClick=${() => A.loadNehaSample()}>BA sample</button> to explore.</div>`}
    <div class="split">
      <nav class="seclist" aria-label="Profile sections">
        <button type="button" class="sec-btn" aria-current=${sel === 'header'} onClick=${() => setSel('header')}><${Icon} n="user" />Personal details</button>
        ${m.sections.map((s, i) => html`<div key=${s.id} class=${'sec-row' + (secDrag.dragIdx === i ? ' dragging' : '') + (secDrag.overIdx === i && secDrag.dragIdx !== i ? ' drag-over' : '')} onDragOver=${secDrag.container(i).onDragOver} onDragLeave=${secDrag.container(i).onDragLeave} onDrop=${secDrag.container(i).onDrop}>
          <span class="drag-handle" aria-hidden="true" title="Drag to reorder" draggable="true" onDragStart=${secDrag.handle(i).onDragStart} onDragEnd=${secDrag.handle(i).onDragEnd}><${Icon} n="grip" /></span>
          <button type="button" class="sec-btn" aria-current=${sel === s.id} onClick=${() => setSel(s.id)}><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.title}</span><span class="nav-count">${s.items.length}</span></button>
        </div>`)}
        <${Menu} align="left" btn=${html`<${Icon} n="plus" />Add section`} btnCls="btn sm" items=${[...Object.keys(KINDS).filter((k) => k !== 'custom' && !presentKinds.has(k)).map((k) => ({ label: KINDS[k].title, icon: 'plus', fn: () => addSection(k) })), { label: 'Custom section', icon: 'plus', fn: () => addSection('custom') }]} />
      </nav>
      <div style="min-width:0">${sel === 'header' || !sec ? html`<${HeaderEditor} A=${A} />` : html`<${SectionEditor} key=${sec.id} A=${A} sec=${sec} usage=${usage} secIdx=${secIdx} />`}</div>
    </div>
  </div>`;
}
