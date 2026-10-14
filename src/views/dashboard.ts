import type { Resume } from '../types';
import { INDUSTRIES } from '../core/constants';
import { COUNTRIES, LANGS, PAGES, STATUSES, TEMPLATES } from '../core/constants';
import { buildIR } from '../core/ir';
import { countOverrides, masterIsEmpty } from '../core/model';
import { fullTime, relTime } from '../core/util';
import { Dialog, Icon, Menu, SelectField, TextField, plural } from '../ui/base';
import { html, useEffect, useMemo, useState } from '../ui/h';
import { ResumeSheet, sheetStyle } from '../ui/sheet';

/* =====================================================================
   Dashboard
   ===================================================================== */
export function ResumeThumb({ master, resume }) {
  const ir = useMemo(() => buildIR(master, resume), [master, resume]);
  const { pg } = sheetStyle(resume); const W = 96; const s = W / (pg.w * 96);
  return html`<div class="thumb" style=${`width:${W}px;height:${Math.round(pg.h * 96 * s)}px`} aria-hidden="true"><div style=${`transform:scale(${s});width:${pg.w * 96}px`}><${ResumeSheet} ir=${ir} resume=${resume} /></div></div>`;
}
export const statusCls = { draft: '', ready: 'ok', sent: 'accent', archived: 'warn' };
export function StatusChip({ s }) { return html`<span class=${'chip ' + (statusCls[s] || '')}>${STATUSES[s] || s}</span>`; }

export function resumeMenu(A, r) {
  return [
    { label: 'Open', icon: 'edit', fn: () => A.go({ name: 'editor', id: r.id }) },
    { label: 'Rename', icon: 'edit', fn: () => A.dialog({ type: 'rename', id: r.id }) },
    { label: 'Duplicate', icon: 'copy', fn: () => A.duplicateResume(r.id) },
    '-',
    { heading: 'Export' },
    { label: 'PDF', icon: 'download', fn: () => A.dialog({ type: 'export', id: r.id, kind: 'pdf' }) },
    { label: 'Word (.docx)', icon: 'download', fn: () => A.dialog({ type: 'export', id: r.id, kind: 'docx' }) },
    { label: 'More formats…', icon: 'download', fn: () => A.go({ name: 'editor', id: r.id }) },
    '-',
    r.status === 'archived' ? { label: 'Restore from archive', icon: 'restore', fn: () => A.setStatus(r.id, 'draft') } : { label: 'Archive', icon: 'archive', fn: () => A.setStatus(r.id, 'archived') },
    { label: 'Delete…', icon: 'trash', danger: true, fn: () => A.dialog({ type: 'confirm', title: 'Delete "' + r.name + '"?', body: 'The resume and its ' + plural(r.vcount || 0, 'saved version') + ' will be removed. Your master profile is not affected. You can undo for a few seconds afterwards.', confirm: 'Delete resume', danger: true, onConfirm: () => A.deleteResume(r.id) }) },
  ];
}
export function ResumeCard({ A, r }) {
  const ov = countOverrides(A.master, r);
  return html`<article class="card rcard" aria-label=${r.name}>
    <${ResumeThumb} master=${A.master} resume=${r} />
    <div style="min-width:0">
      <div class="row" style="justify-content:space-between;align-items:flex-start;flex-wrap:nowrap;gap:4px">
        <h3><button type="button" class="open-link" onClick=${() => A.go({ name: 'editor', id: r.id })}>${r.name}</button></h3>
        <${Menu} label=${'Actions for ' + r.name} items=${resumeMenu(A, r)} />
      </div>
      <div class="muted" style="font-size:13.5px;overflow-wrap:anywhere">${[r.meta.jobTitle, r.meta.company].filter(Boolean).join(' @ ') || 'No job title yet'}</div>
      <div class="rmeta"><${StatusChip} s=${r.status} /><span class="chip">${r.meta.country}</span><span class="chip">${(LANGS[r.meta.language] || LANGS.en).name}</span>${r.meta.industry && html`<span class="chip">${r.meta.industry}</span>`}${r.meta.tags.slice(0, 3).map((t) => html`<span class="chip accent" key=${t}>${t}</span>`)}</div>
      <div class="rfoot"><span title=${fullTime(r.updated)}>Edited ${relTime(r.updated)}</span><span>${plural(r.vcount || 0, 'version')}</span><span>${ov ? plural(ov, 'override') : 'Fully linked'}</span><span>${TEMPLATES[r.template].name} · ${PAGES[r.layout.pageSize].label}</span></div>
    </div>
  </article>`;
}

export function loadPrefs() { try { return { view: 'cards', sort: 'updated', group: 'none', ...JSON.parse(localStorage.getItem('resumate:prefs') || '{}') }; } catch (e) { return { view: 'cards', sort: 'updated', group: 'none' }; } }
export function savePrefs(p) { try { localStorage.setItem('resumate:prefs', JSON.stringify(p)); } catch (e) { /* ignore */ } }
export function loadUxPrefs() { try { return { checklistDismissed: false, ...JSON.parse(localStorage.getItem('resumate:uxprefs') || '{}') }; } catch (e) { return { checklistDismissed: false }; } }
export function saveUxPrefs(p) { try { localStorage.setItem('resumate:uxprefs', JSON.stringify(p)); } catch (e) { /* ignore */ } }

export function UxChecklist({ A, list }) {
  const [ux, setUx] = useState(loadUxPrefs);
  const setUxPref = (p) => { const next = { ...ux, ...p }; setUx(next); saveUxPrefs(next); };
  const profileDone = !!(A.master.header.values.fullName || '').trim() && A.master.sections.some((s) => s.items.length > 0);
  const resumeDone = list.length > 0;
  const tailoringDone = list.some((r) => ((r.meta.jobDescription || '').trim()) || countOverrides(A.master, r) > 0);
  const checks = [
    { label: 'Complete your master profile', done: profileDone, action: () => A.go({ name: 'master' }), cta: 'Open profile' },
    { label: 'Create your first tailored resume', done: resumeDone, action: () => A.dialog({ type: 'new' }), cta: 'Create resume' },
    { label: 'Tailor at least one resume', done: tailoringDone, action: () => { const first = list[0]; if (first) A.go({ name: 'editor', id: first.id }); }, cta: 'Open editor' },
  ];
  const done = checks.filter((x) => x.done).length;
  if (ux.checklistDismissed) return null;
  return html`<section class="panel stack dashboard-checklist" aria-label="Getting started checklist">
    <div class="row checklist-head">
      <div>
        <h2 class="checklist-title">Getting started checklist</h2>
        <p class="muted checklist-subtitle">${done === checks.length ? 'You are all set. Keep tailoring for each job.' : 'Finish these essentials for a smoother workflow and better exports.'}</p>
      </div>
      <button type="button" class="btn sm ghost" onClick=${() => setUxPref({ checklistDismissed: true })}><${Icon} n="x" />Dismiss</button>
    </div>
    <div class="meter" role="img" aria-label=${done + ' of ' + checks.length + ' checklist steps complete'}><i style=${`width:${Math.round((done / checks.length) * 100)}%`}></i></div>
    <div class="row"><span class="chip">${done}/${checks.length} complete</span></div>
    <div class="stack checklist-items">
      ${checks.map((item, i) => html`<div key=${i} class="schema-row checklist-row">
        <div class="row checklist-label"><span class=${'chip ' + (item.done ? 'ok' : '')}>${item.done ? 'Done' : 'Pending'}</span><span>${item.label}</span></div>
        ${!item.done && html`<button type="button" class="btn sm" onClick=${item.action}>${item.cta}</button>`}
      </div>`)}
    </div>
  </section>`;
}

export function Welcome({ A }) {
  return html`<div class="empty card roomy">
    <${Icon} n="layers" cls="ico-xl" />
    <h2>Start with one master profile</h2>
    <p>Keep every job, skill and achievement in one place. Then create as many tailored resumes as you need. Each one stays independent, and only the changes you make for it are stored with it.</p>
    <div class="actions welcome-actions">
      <button type="button" class="btn primary" onClick=${() => A.go({ name: 'master' })}><${Icon} n="user" />Fill in my profile</button>
      <button type="button" class="btn" onClick=${() => A.dialog({ type: 'import' })}><${Icon} n="upload" />Import an existing resume</button>
      <button type="button" class="btn" onClick=${() => A.loadSample()}><${Icon} n="file" />Try with tech sample</button>
      <button type="button" class="btn" onClick=${() => A.loadNehaSample()}><${Icon} n="file" />Try with BA sample</button>
    </div>
    <p class="muted empty-note">Sample data is fictional and goes to the same private store, so delete it from the Master profile page when you are done.</p>
  </div>`;
}

export function Dashboard({ A }) {
  const list = useMemo(() => Object.values<Resume>(A.resumes), [A.resumes]);
  useEffect(() => { (window as any).__resumateFocusSearch = () => { const el = document.getElementById('dashboard-search') as HTMLInputElement | null; if (el) { el.focus(); el.select(); } }; return () => { delete (window as any).__resumateFocusSearch; }; }, []);
  const [prefs, setPrefsS] = useState(loadPrefs); const setPrefs = (p) => { const n = { ...prefs, ...p }; setPrefsS(n); savePrefs(n); };
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeFilterFields, setActiveFilterFields] = useState<string[]>([]);
  const [q, setQ] = useState(''); const [f, setF] = useState({ status: 'active', country: '', language: '', industry: '', company: '', tag: '' });
  const uniq = (fn) => [...new Set(list.map(fn).filter(Boolean))].sort((a: any, b: any) => a.localeCompare(b));
  const opts = { country: uniq((r) => r.meta.country), language: uniq((r) => r.meta.language), industry: uniq((r) => r.meta.industry), company: uniq((r) => r.meta.company), tag: [...new Set(list.flatMap((r) => r.meta.tags))].sort() };
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    let out = list.filter((r) => {
      if (f.status === 'active' ? r.status === 'archived' : f.status !== 'all' && r.status !== f.status) return false;
      if (f.country && r.meta.country !== f.country) return false; if (f.language && r.meta.language !== f.language) return false;
      if (f.industry && r.meta.industry !== f.industry) return false; if (f.company && r.meta.company !== f.company) return false; if (f.tag && !r.meta.tags.includes(f.tag)) return false;
      if (t) { const hay = [r.name, r.meta.jobTitle, r.meta.company, r.meta.country, r.meta.industry, r.meta.notes, (LANGS[r.meta.language] || {}).name, ...r.meta.tags].join(' ').toLowerCase(); if (!t.split(/\s+/).every((w) => hay.includes(w))) return false; }
      return true;
    });
    const key = { updated: (a, b) => Date.parse(b.updated) - Date.parse(a.updated), created: (a, b) => Date.parse(b.created) - Date.parse(a.created), name: (a, b) => a.name.localeCompare(b.name), company: (a, b) => (a.meta.company || '~').localeCompare(b.meta.company || '~'), job: (a, b) => (a.meta.jobTitle || '~').localeCompare(b.meta.jobTitle || '~') }[prefs.sort];
    return out.sort(key);
  }, [list, q, f, prefs.sort]);
  const groups = useMemo(() => {
    if (prefs.group === 'none') return [['', filtered]];
    const get = { company: (r) => r.meta.company, country: (r) => r.meta.country, industry: (r) => r.meta.industry, status: (r) => STATUSES[r.status], language: (r) => (LANGS[r.meta.language] || LANGS.en).name, job: (r) => r.meta.jobTitle }[prefs.group];
    const m = new Map(); filtered.forEach((r) => { const k = get(r) || 'Not set'; if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, prefs.group]);
  useEffect(() => {
    const withValue = ['country', 'language', 'industry', 'company', 'tag'].filter((k) => !!f[k]);
    if (f.status !== 'active') withValue.unshift('status');
    if (withValue.length) setActiveFilterFields((cur) => Array.from(new Set([...cur, ...withValue])));
  }, [f.status, f.country, f.language, f.industry, f.company, f.tag]);
  const filtering = q || f.country || f.language || f.industry || f.company || f.tag || f.status !== 'active';
  const archived = list.filter((r) => r.status === 'archived').length;
  const clear = () => { setQ(''); setF({ status: 'active', country: '', language: '', industry: '', company: '', tag: '' }); setActiveFilterFields([]); };
  const sel = (label, k, options, fmt?) => options.length > 0 && html`<select class="in" aria-label=${label} value=${f[k]} onChange=${(e) => setF({ ...f, [k]: e.target.value })}><option value="">${label}: all</option>${options.map((o) => html`<option value=${o} selected=${f[k] === o}>${fmt ? fmt(o) : o}</option>`)}</select>`;
  const filterDefs = [
    { key: 'status', label: 'Status', node: html`<select class="in" aria-label="Status" value=${f.status} onChange=${(e) => setF({ ...f, status: e.target.value })}><option value="active" selected=${f.status === 'active'}>Status: active</option><option value="all" selected=${f.status === 'all'}>Status: all</option>${Object.entries(STATUSES).map(([k, v]) => html`<option value=${k} selected=${f.status === k}>${v} only</option>`)}</select>` },
    { key: 'country', label: 'Country', node: sel('Country', 'country', opts.country) },
    { key: 'language', label: 'Language', node: sel('Language', 'language', opts.language, (c) => (LANGS[c] || {}).name || c) },
    { key: 'industry', label: 'Industry', node: sel('Industry', 'industry', opts.industry) },
    { key: 'company', label: 'Company', node: sel('Company', 'company', opts.company) },
    { key: 'tag', label: 'Tag', node: sel('Tag', 'tag', opts.tag) },
  ];
  const addFilterItems = filterDefs.filter((d) => !activeFilterFields.includes(d.key)).map((d) => ({ label: d.label, icon: 'plus', fn: () => setActiveFilterFields((cur) => [...cur, d.key]) }));
  const canRemoveFilter = (_key) => true;
  const clearOneFilter = (key) => {
    setF((cur) => ({ ...cur, [key]: key === 'status' ? 'active' : '' }));
    setActiveFilterFields((cur) => cur.filter((x) => x !== key));
  };
  const empty = masterIsEmpty(A.master) && !list.length;
  return html`<div class="page">
    <div class="page-head">
      <div><h1>Resumes</h1><p>${list.length ? plural(list.length - archived, 'active resume') + (archived ? ', ' + archived + ' archived' : '') + '. Every one is generated from your master profile plus its own overrides.' : 'Create tailored versions for each role, company, country and language.'}</p></div>
      <div class="actions"><button type="button" class="btn" onClick=${() => A.dialog({ type: 'import' })}><${Icon} n="upload" />Import</button><button type="button" class="btn primary" onClick=${() => A.dialog({ type: 'new' })}><${Icon} n="plus" />New resume</button></div>
    </div>
    ${empty ? html`<${Welcome} A=${A} />` : list.length === 0 ? html`<div class="empty card"><${Icon} n="plusfile" cls="ico-xl" /><h2>Create your first resume</h2><p>Your master profile has ${plural(A.master.sections.reduce((n, s) => n + s.items.length, 0), 'entry', 'entries')}. A new resume starts as a linked copy of it that you can trim and tailor.</p><button type="button" class="btn primary" onClick=${() => A.dialog({ type: 'new' })}><${Icon} n="plus" />New resume</button></div>` : html`
      <${UxChecklist} A=${A} list=${list} />
      <div class="toolbar dashboard-toolbar">
        <div class="dashboard-toolbar-main">
          <div class="search"><${Icon} n="search" /><input id="dashboard-search" class="in" type="search" placeholder="Search name, role, company, tag (press /)" aria-label="Search resumes" value=${q} onInput=${(e) => setQ(e.target.value)} /></div>
          <button type="button" class="btn sm dashboard-filters-toggle" aria-expanded=${filtersOpen} aria-controls="dashboard-filters" onClick=${() => setFiltersOpen(!filtersOpen)}><${Icon} n="sliders" />${filtersOpen ? 'Hide filters' : 'Show filters'}</button>
          <div class="row toolbar-right">
            <select class="in in-auto" aria-label="Sort by" value=${prefs.sort} onChange=${(e) => setPrefs({ sort: e.target.value })}>${[['updated', 'Last modified'], ['created', 'Newest first'], ['name', 'Name'], ['company', 'Company'], ['job', 'Job title']].map(([v, l]) => html`<option value=${v} selected=${prefs.sort === v}>Sort: ${l}</option>`)}</select>
            <select class="in in-auto" aria-label="Group by" value=${prefs.group} onChange=${(e) => setPrefs({ group: e.target.value })}>${[['none', 'No grouping'], ['company', 'Company'], ['country', 'Country'], ['industry', 'Industry'], ['status', 'Status'], ['language', 'Language'], ['job', 'Job title']].map(([v, l]) => html`<option value=${v} selected=${prefs.group === v}>Group: ${l}</option>`)}</select>
            <div class="seg" role="group" aria-label="View"><button type="button" aria-pressed=${prefs.view === 'cards'} aria-label="Card view" onClick=${() => setPrefs({ view: 'cards' })}><${Icon} n="grid" /></button><button type="button" aria-pressed=${prefs.view === 'table'} aria-label="Table view" onClick=${() => setPrefs({ view: 'table' })}><${Icon} n="list" /></button></div>
          </div>
        </div>
        <div id="dashboard-filters" class=${'filters dashboard-filters' + (filtersOpen ? ' open' : '')}>
          ${addFilterItems.length > 0
            ? html`<${Menu} align="left" btnCls="btn sm dashboard-add-filter" btn=${html`<${Icon} n="plus" />Add filter${activeFilterFields.length ? html`<span class="chip mono">${activeFilterFields.length}</span>` : ''}`} items=${addFilterItems} />`
            : html`<button type="button" class="btn sm dashboard-add-filter" disabled><${Icon} n="check" />All filters added</button>`}
          <div class="filter-chip-list">
            ${activeFilterFields.length === 0
              ? html`<span class="muted filters-empty">No filters selected. Add one to narrow results.</span>`
              : activeFilterFields.map((k) => {
                const d = filterDefs.find((x) => x.key === k);
                if (!d || !d.node) return null;
                return html`<div key=${k} class="filter-chip">${d.node}<button type="button" class="ibtn sm" aria-label=${'Remove ' + d.label + ' filter'} title=${'Remove ' + d.label + ' filter'} disabled=${!canRemoveFilter(k)} onClick=${() => clearOneFilter(k)}><${Icon} n="x" /></button></div>`;
              })}
          </div>
          ${filtering && html`<button type="button" class="btn sm ghost filters-clear" onClick=${clear}><${Icon} n="restore" />Clear filters</button>`}
        </div>
      </div>
      <div class="stats" aria-live="polite"><span>Showing <b>${filtered.length}</b> of <b>${list.length}</b></span></div>
      ${filtered.length === 0 ? html`<div class="empty card"><${Icon} n="search" cls="ico-xl" /><h2>No resumes match</h2><p>Try a different search or clear the filters${archived && f.status === 'active' ? '. ' + plural(archived, 'archived resume') + ' hidden by the status filter' : ''}.</p><button type="button" class="btn" onClick=${clear}><${Icon} n="restore" />Clear filters</button></div>`
        : groups.map(([g, rs]) => html`<section key=${g} class="stack" aria-label=${g || 'Resumes'}>
          ${g && html`<div class="group-title">${g}<span class="muted mono">${rs.length}</span></div>`}
          ${prefs.view === 'cards' ? html`<div class="rgrid">${rs.map((r) => html`<${ResumeCard} key=${r.id} A=${A} r=${r} />`)}</div>`
            : html`<div class="card tbl-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Job title</th><th>Company</th><th>Country</th><th>Language</th><th>Industry</th><th>Status</th><th>Modified</th><th>Ver.</th><th><span class="sr">Actions</span></th></tr></thead><tbody>
              ${rs.map((r) => html`<tr key=${r.id}><td><button type="button" class="name-btn" onClick=${() => A.go({ name: 'editor', id: r.id })}>${r.name}</button></td><td>${r.meta.jobTitle}</td><td>${r.meta.company}</td><td>${r.meta.country}</td><td>${(LANGS[r.meta.language] || LANGS.en).name}</td><td>${r.meta.industry}</td><td><${StatusChip} s=${r.status} /></td><td title=${fullTime(r.updated)} class="nowrap">${relTime(r.updated)}</td><td class="mono">${r.vcount || 0}</td><td><${Menu} label=${'Actions for ' + r.name} items=${resumeMenu(A, r)} /></td></tr>`)}
            </tbody></table></div>`}
        </section>`)}`}
  </div>`;
}

export function NewResumeDialog({ A }) {
  const list = Object.values<Resume>(A.resumes).sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated));
  const [s, setS] = useState({ name: '', touched: false, source: 'master', jobTitle: '', company: '', country: 'United States', language: 'en', industry: '', template: 'classic' });
  const set = (p) => setS((o) => ({ ...o, ...p }));
  const applySmartDefaults = () => {
    const byIndustry = {
      'Software': 'technical',
      'Fintech': 'modern',
      'Banking & Finance': 'executive',
      'Healthcare': 'classic',
      'Education': 'academic',
      'Consulting': 'modern',
      'Public sector': 'classic',
      'Manufacturing': 'compact',
      'E-commerce': 'bold',
      'Telecom': 'modern',
      'Media': 'bold',
    };
    const byCountry = { Germany: 'de', France: 'fr', Spain: 'es', Italy: 'it', Netherlands: 'nl', India: 'en', Portugal: 'pt', 'United Kingdom': 'en', 'United States': 'en', Canada: 'en' };
    const nextTemplate = byIndustry[s.industry] || (COUNTRIES[s.country].page === 'a4' ? 'modern' : 'classic');
    const nextLang = byCountry[s.country] || s.language || 'en';
    set({
      template: nextTemplate,
      language: nextLang,
      touched: s.touched,
      name: s.name,
    });
  };
  const autoName = [s.jobTitle, s.company].filter(Boolean).join(' – ');
  const name = s.touched ? s.name : autoName;
  const dup = list.some((r) => r.name.trim().toLowerCase() === name.trim().toLowerCase() && name.trim());
  const create = () => { if (!name.trim()) return; A.closeDialog(); A.createResume({ ...s, name: name.trim() }, s.template, s.source === 'master' ? null : s.source); };
  const c = COUNTRIES[s.country];
  return html`<${Dialog} title="New resume" onClose=${A.closeDialog} foot=${html`<button type="button" class="btn" onClick=${A.closeDialog}><${Icon} n="x" />Cancel</button><button type="button" class="btn primary" disabled=${!name.trim()} onClick=${create}><${Icon} n="check" />Create resume</button>`}>
    <form class="stack" onSubmit=${(e) => { e.preventDefault(); create(); }}>
      <div class="callout"><b>Smart start:</b> choose role, country and industry, then click <b>Apply smart defaults</b> to prefill language and template for a cleaner first draft.</div>
      <${SelectField} label="Start from" value=${s.source} onChange=${(v) => set({ source: v })} options=${[['master', 'My master profile (linked)'], ...list.map((r) => [r.id, 'Copy of: ' + r.name])]} hint=${s.source === 'master' ? 'Includes every entry from the master profile. Hide what you do not need afterwards.' : 'Copies that resume\'s content, overrides and layout. The copy is fully independent.'} />
      <div class="grid2"><${TextField} label="Target job title" value=${s.jobTitle} onInput=${(v) => set({ jobTitle: v })} placeholder="Principal Architect" /><${TextField} label="Company" value=${s.company} onInput=${(v) => set({ company: v })} placeholder="Acme Corp" /></div>
      <${TextField} label="Resume name" req value=${name} onInput=${(v) => set({ name: v, touched: true })} placeholder="Principal Architect – Acme" error=${dup ? 'You already have a resume with this name. You can still use it.' : ''} />
      <div class="grid3"><${SelectField} label="Country" value=${s.country} onChange=${(v) => set({ country: v })} options=${Object.keys(COUNTRIES)} /><${SelectField} label="Language" value=${s.language} onChange=${(v) => set({ language: v })} options=${Object.entries(LANGS).map(([k, v]) => [k, v.name])} /><${SelectField} label="Industry" value=${s.industry} onChange=${(v) => set({ industry: v })} options=${[['', 'Not set'], ...INDUSTRIES]} /></div>
      <div class="row"><button type="button" class="btn sm" onClick=${applySmartDefaults}><${Icon} n="star" />Apply smart defaults</button></div>
      ${c && c.tip && html`<div class="callout"><b>${s.country}:</b> ${c.tip} Page size set to ${PAGES[c.page].label}.</div>`}
      ${s.source === 'master' && html`<div class="field"><span class="lbl">Template</span><div class="tpl-grid">${Object.entries(TEMPLATES).map(([k, t]) => html`<button type="button" class="tpl" key=${k} aria-pressed=${s.template === k} onClick=${() => set({ template: k })}><b>${t.name}</b><small>${t.blurb}</small></button>`)}</div></div>`}
      <button type="submit" class="sr" tabindex="-1">Create</button>
    </form>
  </${Dialog}>`;
}
export function RenameDialog({ A, id }) {
  const r = A.resumes[id]; const [n, setN] = useState(r ? r.name : '');
  if (!r) return null;
  const ok = () => { if (n.trim()) { A.renameResume(id, n.trim()); A.closeDialog(); } };
  return html`<${Dialog} title="Rename resume" onClose=${A.closeDialog} foot=${html`<button type="button" class="btn" onClick=${A.closeDialog}><${Icon} n="x" />Cancel</button><button type="button" class="btn primary" disabled=${!n.trim()} onClick=${ok}><${Icon} n="edit" />Rename</button>`}>
    <form onSubmit=${(e) => { e.preventDefault(); ok(); }}><${TextField} label="Name" req value=${n} onInput=${setN} /></form></${Dialog}>`;
}
export function ConfirmDialog({ A, d }) {
  return html`<${Dialog} title=${d.title} onClose=${A.closeDialog} foot=${html`<button type="button" class="btn" onClick=${A.closeDialog}><${Icon} n="x" />${d.cancel || 'Cancel'}</button>${(d.extra || []).map((x, i) => html`<button type="button" key=${i} class=${'btn ' + (x.danger ? 'danger' : '')} onClick=${() => { A.closeDialog(); x.fn(); }}><${Icon} n=${x.danger ? 'trash' : 'check'} />${x.label}</button>`)}<button type="button" class=${'btn ' + (d.danger ? 'danger solid' : 'primary')} data-autofocus onClick=${() => { A.closeDialog(); d.onConfirm(); }}><${Icon} n=${d.danger ? 'trash' : 'check'} />${d.confirm || 'Confirm'}</button>`}>
    <p>${d.body}</p>${d.list && html`<ul class="dialog-list">${d.list.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul>`}</${Dialog}>`;
}
