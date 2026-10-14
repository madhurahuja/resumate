import type { Resume } from '../types';
import { extractKeywords, hasVisiblePhone, keywordMatch, resumeHealth, textDiff, wordDiff } from '../core/analysis';
import { PALETTES, applyAppearance, loadAppearance, saveAppearance } from '../core/appearance';
import { FONTS, LANGS, PAGES, TEMPLATES } from '../core/constants';
import { buildIR, irPlain } from '../core/ir';
import { countOverrides, listOverrides, masterIsEmpty } from '../core/model';
import { clone, fullTime, str } from '../core/util';
import { EXPORTS, buildExport } from '../export/formats';
import { saveBlob } from '../export/validate';
import { resumateJsonToParsed, readImportFile } from '../import/files';
import { readLinkedInFiles } from '../import/linkedin';
import { parseResumeText } from '../import/text';
import { Dialog, Icon, Seg, SelectField, Switch, TextField, plural } from '../ui/base';
import { html, useEffect, useMemo, useRef, useState } from '../ui/h';

/* =====================================================================
   Export, diff, overrides, import dialogs; Compare and Data views
   ===================================================================== */
const CMDK_RECENT_KEY = 'resumate:cmdk:recent';
const CMDK_PINNED_KEY = 'resumate:cmdk:pinned';
function loadCmdkRecent() { try { return JSON.parse(localStorage.getItem(CMDK_RECENT_KEY) || '[]'); } catch (e) { return []; } }
function saveCmdkRecent(ids) { try { localStorage.setItem(CMDK_RECENT_KEY, JSON.stringify(ids.slice(0, 8))); } catch (e) { /* ignore */ } }
function loadCmdkPinned() { try { return JSON.parse(localStorage.getItem(CMDK_PINNED_KEY) || '[]'); } catch (e) { return []; } }
function saveCmdkPinned(ids) { try { localStorage.setItem(CMDK_PINNED_KEY, JSON.stringify(ids.slice(0, 16))); } catch (e) { /* ignore */ } }
function rememberCmdkAction(id) {
  const cur = loadCmdkRecent().filter((x) => x !== id);
  cur.unshift(id); saveCmdkRecent(cur);
}
function fuzzyScore(haystack, token) {
  const h = str(haystack).toLowerCase(); const t = str(token).toLowerCase();
  if (!t) return 0;
  const exact = h.indexOf(t);
  if (exact === 0) return 120 - t.length;
  if (exact > 0) return 80 - exact - t.length;
  let j = 0; let first = -1; let span = 0;
  for (let i = 0; i < h.length && j < t.length; i++) {
    if (h[i] === t[j]) { if (first < 0) first = i; j++; if (j === t.length) span = i - first + 1; }
  }
  if (j < t.length) return -1;
  return Math.max(10, 45 - span);
}
function buildExportChecklist(ir, resume) {
  const health = resumeHealth(ir, resume);
  const text = irPlain(ir);
  const bullets = ir.sections.reduce((n, s) => n + s.entries.reduce((m, e) => m + e.bullets.length, 0), 0);
  const exp = ir.sections.find((s) => s.kind === 'experience' && s.entries.length > 0);
  const contactMail = ir.header.contacts.some((c) => /@/.test(c));
  const contactPhone = ir.header.contacts.some((c) => hasVisiblePhone(c));
  const out = [
    { id: 'header-name', label: 'Name is present in the header', ok: !!ir.header.name, severity: 'high' },
    { id: 'header-email', label: 'Email is visible', ok: contactMail, severity: 'high' },
    { id: 'header-phone', label: 'Phone is visible', ok: contactPhone, severity: 'medium' },
    { id: 'experience', label: 'Experience section has visible entries', ok: !!exp, severity: 'high' },
    { id: 'impact-bullets', label: 'At least three impact bullets are present', ok: bullets >= 3, severity: 'medium' },
    { id: 'resume-health', label: 'Resume health is strong (65%+)', ok: health.score >= 65, severity: 'medium' },
  ];
  const jd = str(resume.meta.jobDescription).trim();
  if (jd) {
    const kws = extractKeywords(jd, 14);
    if (kws.length) {
      const match = keywordMatch(kws, text);
      out.push({ id: 'jd-coverage', label: 'Job-description keyword coverage is 55% or higher', ok: match.score >= 55, severity: 'medium' });
    }
  }
  return out;
}

export function DiffView({ a, b, labels }) {
  const [all, setAll] = useState(false);
  const d = useMemo(() => textDiff(a, b), [a, b]);
  const rows = useMemo(() => {
    const out = []; const ops = d.ops; let i = 0;
    while (i < ops.length) {
      if (ops[i].t === '=') { out.push({ t: '=', s: ops[i].s }); i++; continue; }
      const dels = [], adds = [];
      while (i < ops.length && ops[i].t !== '=') { (ops[i].t === '-' ? dels : adds).push(ops[i].s); i++; }
      const n = Math.min(dels.length, adds.length);
      for (let k = 0; k < n; k++) out.push({ t: '~', o: dels[k], n: adds[k] });
      for (let k = n; k < dels.length; k++) out.push({ t: '-', s: dels[k] });
      for (let k = n; k < adds.length; k++) out.push({ t: '+', s: adds[k] });
    }
    return out;
  }, [d]);
  const keep = rows.map((r, i) => r.t !== '=' || rows.slice(Math.max(0, i - 2), i + 3).some((x) => x.t !== '='));
  const el = []; let hidden = 0;
  rows.forEach((r, i) => {
    if (!all && !keep[i]) { hidden++; return; }
    if (hidden) { el.push(html`<div class="gap" key=${'g' + i}>… ${plural(hidden, 'unchanged line')} …</div>`); hidden = 0; }
    if (r.t === '=') el.push(html`<div key=${i}>${r.s || ' '}</div>`);
    else if (r.t === '-') el.push(html`<div class="del" key=${i}>− ${r.s}</div>`);
    else if (r.t === '+') el.push(html`<div class="add" key=${i}>+ ${r.s}</div>`);
    else { const w = wordDiff(r.o, r.n); el.push(html`<div class="del" key=${i + 'o'}>− ${w.filter((x) => x.t !== '+').map((x, j) => (x.t === '-' ? html`<mark key=${j}>${x.s}</mark>` : x.s))}</div>`); el.push(html`<div class="add" key=${i + 'n'}>+ ${w.filter((x) => x.t !== '-').map((x, j) => (x.t === '+' ? html`<mark key=${j}>${x.s}</mark>` : x.s))}</div>`); }
  });
  if (hidden) el.push(html`<div class="gap" key="gend">… ${plural(hidden, 'unchanged line')} …</div>`);
  const changed = d.added + d.removed;
  return html`<div class="stack">
    <div class="row" style="justify-content:space-between"><div class="row"><span class="chip ok">+${d.added} lines</span><span class="chip bad">−${d.removed} lines</span>${labels && html`<span class="muted" style="font-size:13px">− ${labels[0]} → + ${labels[1]}</span>`}</div>
      <${Switch} checked=${all} onChange=${setAll} label="Show unchanged lines" /></div>
    ${changed === 0 ? html`<div class="callout ok">The printed text is identical.</div>` : html`<div class="diff" role="region" aria-label="Text differences" tabindex="0">${el}</div>`}
  </div>`;
}
export function DiffDialog({ A, d }) {
  return html`<${Dialog} wide title=${d.title} onClose=${A.closeDialog} foot=${html`<button type="button" class="btn" onClick=${A.closeDialog}><${Icon} n="x" />Close</button>`}><${DiffView} a=${d.a.text} b=${d.b.text} labels=${[d.a.label, d.b.label]} /></${Dialog}>`;
}

export function OverridesDialog({ A, id }) {
  const r = A.resumes[id]; if (!r) return null;
  const list = listOverrides(A.master, r);
  return html`<${Dialog} title="Changes made only for this resume" onClose=${A.closeDialog} foot=${html`${list.length > 0 && html`<button type="button" class="btn danger" onClick=${() => { A.revertAll(id); A.closeDialog(); }}><${Icon} n="restore" />Revert everything to master</button>`}<button type="button" class="btn" onClick=${A.closeDialog}><${Icon} n="x" />Close</button>`}>
    ${list.length === 0 ? html`<div class="callout ok">This resume uses the master text exactly as written.</div>` : html`<p class="muted" style="font-size:13.5px">Everything else comes straight from the master profile and updates when the master changes.</p><div>${list.map((o, i) => html`<div class="schema-row" key=${i} style="grid-template-columns:minmax(0,1fr) auto"><div><b>${o.what}</b><div class="muted" style="font-size:12.5px">${o.where}</div></div><button type="button" class="btn sm" onClick=${() => A.revertOverride(id, o)}><${Icon} n="restore" />Revert</button></div>`)}</div>`}
  </${Dialog}>`;
}

export function ExportDialog({ A, id, kind }) {
  const r = A.resumes[id]; const E = EXPORTS[kind];
  const [st, setSt] = useState<any>({ phase: 'working' });
  useEffect(() => {
    let live = true;
    (async () => { try { const out = await buildExport(kind, A.master, r); if (live) setSt({ phase: 'ready', out }); } catch (e) { if (live) setSt({ phase: 'error', msg: e.message || String(e) }); } })();
    return () => { live = false; };
  }, [kind, id]);
  const out = st.out; const failed = out && out.checks.some((c) => !c.ok);
  const save = async () => {
    try { await saveBlob(out.filename, out.blob); setSt({ ...st, phase: 'saved' }); A.toast('Saved ' + out.filename); }
    catch (e) { if (e && e.code === 'declined') return; setSt({ ...st, phase: 'ready', saveErr: e && e.code === 'unavailable' ? 'Saving files is not available in this view. Open the page in the Claude app or a browser tab.' : (e && e.message) || 'Could not save the file.' }); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(await out.blob.text()); A.toast('Copied to clipboard.'); } catch (e) { A.toast('Copy was blocked. Select the text in the saved file instead.', { kind: 'bad' }); } };
  const pages = out && out.checks.pages;
  const quality = out && out.ir ? buildExportChecklist(out.ir, r) : [];
  const qualityMiss = quality.filter((x) => !x.ok);
  const fixChecklist = (cid) => {
    try {
      const toTab = {
        'header-name': 'content',
        'header-email': 'content',
        'header-phone': 'content',
        experience: 'content',
        'impact-bullets': 'content',
        'resume-health': 'tailor',
        'jd-coverage': 'tailor',
      }[cid] || 'content';
      localStorage.setItem('resumate:editor:pendingTab', toTab);
    } catch (e) { /* ignore */ }
    A.closeDialog();
    A.go({ name: 'editor', id });
  };
  return html`<${Dialog} title=${'Export ' + E.label} onClose=${A.closeDialog} foot=${html`<button type="button" class="btn" onClick=${A.closeDialog}><${Icon} n="x" />Close</button>${(kind === 'txt' || kind === 'md') && out && html`<button type="button" class="btn" onClick=${copy}><${Icon} n="copy" />Copy</button>`}<button type="button" class="btn primary" disabled=${!out} onClick=${save}><${Icon} n="download" />${st.phase === 'saved' ? 'Save again' : 'Save file'}</button>`}>
    <p class="muted" style="font-size:13.5px">${E.desc}</p>
    ${st.phase === 'working' && html`<div class="callout" role="status">Building and checking the file…</div>`}
    ${st.phase === 'error' && html`<div class="callout bad" role="alert"><b>Could not export.</b> ${st.msg}</div>`}
    ${out && html`<div class="stack">
      <div class="row"><b style="overflow-wrap:anywhere">${out.filename}</b>${pages && html`<span class="chip">${plural(pages, 'page')}</span>`}</div>
      <div class="panel stack" style="padding:12px">
        <div class="row" style="justify-content:space-between"><b style="font-size:14px">Pre-export quality checklist</b>${qualityMiss.length === 0 ? html`<span class="chip ok">Ready</span>` : html`<span class="chip warn">${plural(qualityMiss.length, 'item')} to review</span>`}</div>
        <ul style="list-style:none;margin:0;padding:0;display:grid;gap:6px" aria-label="Pre-export quality checks">${quality.map((c, i) => html`<li key=${i} class="row" style="flex-wrap:nowrap;align-items:flex-start"><span class=${'chip ' + (c.ok ? 'ok' : c.severity === 'high' ? 'bad' : 'warn')} style="flex:none">${c.ok ? 'ok' : c.severity === 'high' ? 'required' : 'improve'}</span><span style="flex:1;min-width:0">${c.label}</span>${!c.ok && html`<button type="button" class="btn sm" onClick=${() => fixChecklist(c.id)}><${Icon} n="edit" />Fix</button>`}</li>`)}</ul>
      </div>
      <ul style="list-style:none;margin:0;padding:0;display:grid;gap:6px" aria-label="Validation results">${out.checks.map((c, i) => html`<li key=${i} class="row" style="flex-wrap:nowrap;align-items:flex-start"><span class=${'chip ' + (c.ok ? (c.soft ? 'warn' : 'ok') : 'bad')} style="flex:none">${c.ok ? (c.soft ? 'skipped' : 'passed') : 'failed'}</span><span>${c.label}</span></li>`)}</ul>
      ${out.note && html`<div class="callout warn">${out.note}</div>`}
      ${failed && html`<div class="callout bad">At least one check failed. Review the resume content before sending this file.</div>`}
      ${pages > 2 && html`<div class="callout warn">This runs to ${pages} pages. Most recruiters prefer two or fewer; try the Compact template or trim older roles.</div>`}
      ${st.saveErr && html`<div class="callout bad" role="alert">${st.saveErr}</div>`}
      ${st.phase === 'saved' && html`<div class="callout ok">Saved. Check the file in your downloads.</div>`}
    </div>`}
  </${Dialog}>`;
}

/* ----- import ----- */
export function ImportDialog({ A }) {
  const [st, setSt] = useState<any>({ phase: 'pick', error: '' }); const [paste, setPaste] = useState(''); const [drag, setDrag] = useState(false);
  const fileRef = useRef<any>(null);
  const toReview = (parsed, fileName) => setSt({ phase: 'review', parsed: clone(parsed), file: fileName, include: parsed.sections.map(() => true), mode: masterIsEmpty(A.master) ? 'master' : 'local', name: (fileName ? fileName.replace(/\.[^.]+$/, '') : 'Imported resume') });
  const handle = async (fileOrList) => {
    const list = fileOrList && fileOrList.length !== undefined && !fileOrList.name ? Array.from(fileOrList) : fileOrList ? [fileOrList] : [];
    const file = list[0]; if (!file) return; setSt({ phase: 'loading', file: list.length > 1 ? list.length + ' files' : file.name });
    try {
      const li = list.length > 1 || /\.(zip|csv)$/i.test(file.name);
      const res: any = li ? await readLinkedInFiles(list) : await readImportFile(file);
      if (res.kind === 'backup') { setSt({ phase: 'backup', data: res.data }); return; }
      const parsed = res.kind === 'parsed' ? res.parsed : res.kind === 'resumate' ? resumateJsonToParsed(res.data) : parseResumeText(res.text);
      toReview(parsed, li ? 'LinkedIn profile' : file.name);
    } catch (e) { setSt({ phase: 'pick', error: e.message || 'Could not read that file.' }); }
  };
  if (st.phase === 'review') {
    const p = st.parsed; const setH = (k, v) => setSt({ ...st, parsed: { ...p, header: { ...p.header, [k]: v } } });
    const go = () => { A.closeDialog(); A.importParsed({ ...p, sections: p.sections.filter((_, i) => st.include[i]) }, st.mode, st.name.trim() || 'Imported resume'); };
    return html`<${Dialog} wide title="Review imported resume" onClose=${A.closeDialog} foot=${html`<button type="button" class="btn" onClick=${() => setSt({ phase: 'pick', error: '' })}><${Icon} n="left" />Back</button><button type="button" class="btn primary" disabled=${!p.header.fullName && !st.include.some(Boolean)} onClick=${go}><${Icon} n="upload" />Import</button>`}>
      <div class="callout warn">Reading a resume is a best-effort job, especially for PDFs. Check the details below and fix mistakes after importing.</div>
      <div class="grid3"><${TextField} label="Name" value=${p.header.fullName} onInput=${(v) => setH('fullName', v)} /><${TextField} label="Email" value=${p.header.email} onInput=${(v) => setH('email', v)} /><${TextField} label="Phone" value=${p.header.phone} onInput=${(v) => setH('phone', v)} /></div>
      <div class="grid2"><${TextField} label="Headline" value=${p.header.headline} onInput=${(v) => setH('headline', v)} /><${TextField} label="Location" value=${p.header.location} onInput=${(v) => setH('location', v)} /></div>
      ${p.sections.length === 0 ? html`<div class="callout bad">No sections were recognised. Headings such as Experience, Education and Skills need to be on their own lines.</div>` : html`<div class="stack"><span class="lbl">Sections found</span>${p.sections.map((s, i) => html`<div class="item" key=${i}><div class="item-head"><input type="checkbox" style="width:20px;height:20px;accent-color:var(--accent)" checked=${st.include[i]} aria-label=${'Import ' + s.title} onChange=${(e) => setSt({ ...st, include: st.include.map((x, j) => (j === i ? e.target.checked : x)) })} /><div class="t"><b>${s.title}</b><small>${plural(s.items.length, 'entry', 'entries')}: ${s.items.slice(0, 3).map((it) => it.title || it.label || str(it.text).slice(0, 30)).join(', ')}${s.items.length > 3 ? '…' : ''}</small></div></div></div>`)}</div>`}
      <div class="stack"><span class="lbl">Where should it go?</span>
        <label class="switch"><input type="radio" name="dest" checked=${st.mode === 'master'} onChange=${() => setSt({ ...st, mode: 'master' })} /><span><b>Add to my master profile</b> and create a resume from it. Best when this is your main resume.</span></label>
        <label class="switch"><input type="radio" name="dest" checked=${st.mode === 'local'} onChange=${() => setSt({ ...st, mode: 'local' })} /><span><b>Create a stand-alone resume</b>. The master profile is not changed.</span></label></div>
      <${TextField} label="New resume name" value=${st.name} onInput=${(v) => setSt({ ...st, name: v })} />
    </${Dialog}>`;
  }
  if (st.phase === 'backup') {
    const b = st.data;
    return html`<${Dialog} title="Restore a Resumate backup" onClose=${A.closeDialog} foot=${html`<button type="button" class="btn" onClick=${() => setSt({ phase: 'pick', error: '' })}><${Icon} n="left" />Back</button><button type="button" class="btn" onClick=${() => { A.closeDialog(); A.restoreBackup(b, 'merge'); }}><${Icon} n="plus" />Add as new resumes</button><button type="button" class="btn danger" onClick=${() => { A.closeDialog(); A.restoreBackup(b, 'replace'); }}><${Icon} n="restore" />Replace everything</button>`}>
      <p>This backup holds ${plural((b.resumes || []).length, 'resume')} and a master profile${b.master && b.master.header ? ' for ' + (b.master.header.values.fullName || 'an unnamed person') : ''}, exported ${fullTime(b.exportedAt)}.</p>
      <div class="callout warn"><b>Replace everything</b> overwrites the master profile and removes the current resumes. <b>Add as new resumes</b> keeps what you have and adds the backed-up resumes (they will link to the backed-up master items, which are added too).</div></${Dialog}>`;
  }
  return html`<${Dialog} title="Import a resume" onClose=${A.closeDialog} foot=${html`<button type="button" class="btn" onClick=${A.closeDialog}><${Icon} n="x" />Cancel</button>`}>
    ${st.error && html`<div class="callout bad" role="alert">${st.error}</div>`}
    <div class=${'card'} style=${`border-style:dashed;padding:28px 16px;text-align:center;display:grid;gap:10px;justify-items:center;${drag ? 'border-color:var(--accent);background:var(--accent-soft)' : ''}`}
      onDragOver=${(e) => { e.preventDefault(); setDrag(true); }} onDragLeave=${() => setDrag(false)} onDrop=${(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}>
      <${Icon} n="upload" cls="ico-xl" /><b>${st.phase === 'loading' ? 'Reading ' + st.file + '…' : 'Drop a file here'}</b>
      <span class="muted" style="font-size:13px">PDF (with selectable text), Word .docx, plain text, Markdown, a Resumate JSON export, or a LinkedIn data export (.zip). Files are read on this device.</span>
      <input ref=${fileRef} type="file" multiple accept=".pdf,.docx,.txt,.md,.json,.text,.zip,.csv" style="display:none" aria-label="Choose a file" onChange=${(e) => { handle(e.target.files); e.target.value = ''; }} />
      <button type="button" class="btn" data-autofocus onClick=${() => fileRef.current.click()}><${Icon} n="upload" />Choose file</button>
    </div>
    <details><summary style="cursor:pointer;font-weight:600;min-height:32px">Importing from LinkedIn</summary>
      <div class="stack" style="margin-top:8px;font-size:13.5px">
        <p class="muted" style="margin:0">LinkedIn does not allow other apps to read your profile directly, so Resumate reads the data export that LinkedIn gives you. It is the most complete and accurate route.</p>
        <ol style="margin:0;padding-left:20px;display:grid;gap:4px">
          <li>On LinkedIn open <b>Settings & Privacy</b>, then <b>Data privacy</b>, then <b>Get a copy of your data</b>.</li>
          <li>Choose <b>Want something in particular?</b> and tick Profile, Positions, Education, Skills, Certifications, Projects, Languages, Honors and Email addresses.</li>
          <li>Request the archive. LinkedIn emails a download link, usually within minutes (sometimes up to 24 hours).</li>
          <li>Drop the downloaded <b>.zip</b> above. You can also select the CSV files together.</li>
        </ol>
        <p class="muted" style="margin:0">Quicker, but less accurate: on your LinkedIn profile choose <b>More</b>, then <b>Save to PDF</b>, and import that PDF.</p>
      </div></details>
    <details><summary style="cursor:pointer;font-weight:600;min-height:32px">Or paste the text of a resume</summary>
      <div class="stack" style="margin-top:8px"><${TextField} label="Resume text" textarea rows=${6} value=${paste} onInput=${setPaste} /><div><button type="button" class="btn" disabled=${paste.trim().length < 20} onClick=${() => toReview(parseResumeText(paste), 'Pasted resume')}><${Icon} n="search" />Read pasted text</button></div></div></details>
  </${Dialog}>`;
}

/* ----- compare view ----- */
export function CompareView({ A }) {
  const list = Object.values<Resume>(A.resumes).sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated));
  const [ia, setIa] = useState(list[0] ? list[0].id : ''); const [ib, setIb] = useState(list[1] ? list[1].id : '');
  const a = A.resumes[ia], b = A.resumes[ib];
  const ta = a ? irPlain(buildIR(A.master, a)) : '', tb = b ? irPlain(buildIR(A.master, b)) : '';
  const rows = a && b ? [['Template', TEMPLATES[a.template].name, TEMPLATES[b.template].name], ['Page size', PAGES[a.layout.pageSize].label, PAGES[b.layout.pageSize].label], ['Font', FONTS[a.layout.font].label, FONTS[b.layout.font].label], ['Font size', a.layout.fontSize + ' pt', b.layout.fontSize + ' pt'], ['Language', LANGS[a.meta.language].name, LANGS[b.meta.language].name], ['Country', a.meta.country, b.meta.country], ['Company', a.meta.company, b.meta.company], ['Job title', a.meta.jobTitle, b.meta.jobTitle], ['Overrides', countOverrides(A.master, a), countOverrides(A.master, b)], ['Words', ta.split(/\s+/).filter(Boolean).length, tb.split(/\s+/).filter(Boolean).length]] : [];
  return html`<div class="page">
    <div class="page-head"><div><h1>Compare versions</h1><p>See exactly what differs between two resumes: the words that print and the settings behind them. To compare an older saved version with the current one, use the History tab inside a resume.</p></div></div>
    ${list.length < 2 ? html`<div class="empty card"><${Icon} n="compare" cls="ico-xl" /><h2>Two resumes needed</h2><p>Create or duplicate a resume to compare it with another.</p><button type="button" class="btn primary" onClick=${() => A.dialog({ type: 'new' })}><${Icon} n="plus" />New resume</button></div>` : html`
      <div class="grid2"><${SelectField} label="Left (removed lines)" value=${ia} onChange=${setIa} options=${list.map((r) => [r.id, r.name])} /><${SelectField} label="Right (added lines)" value=${ib} onChange=${setIb} options=${list.map((r) => [r.id, r.name])} /></div>
      ${ia === ib && html`<div class="callout">Pick two different resumes to see differences.</div>`}
      <div class="panel stack"><h2 style="font-size:18px">Printed text</h2><${DiffView} a=${ta} b=${tb} labels=${[a ? a.name : '', b ? b.name : '']} /></div>
      <div class="panel"><h2 style="font-size:18px;margin-bottom:8px">Settings</h2><div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>${a && a.name}</th><th>${b && b.name}</th></tr></thead><tbody>${rows.map(([k, x, y]) => html`<tr key=${k}><td class="muted">${k}</td><td>${x}</td><td style=${str(x) !== str(y) ? 'font-weight:700;color:var(--accent)' : ''}>${y}</td></tr>`)}</tbody></table></div></div>`}
  </div>`;
}

/* ----- data view ----- */
export function DataPage({ A }) {
  const [confirmTxt, setConfirmTxt] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState('');
  const size = useMemo(() => { try { return JSON.stringify({ m: A.master, r: A.resumes }).length; } catch (e) { return 0; } }, [A.master, A.resumes]);
  const nRes = Object.keys(A.resumes).length;
  const syncMode = A.mode === 'cloud' || A.mode === 'supabase';
  return html`<div class="page">
    <div class="page-head"><div><h1>Data and backup</h1><p>Your profile, resumes and saved versions are personal data. Here is where they live and how to take them with you.</p></div></div>
    <div class="grid2" style="align-items:start">
      <div class="panel stack"><h2 style="font-size:18px">Where your data is</h2>
        ${A.mode === 'cloud' ? html`<div class="callout ok">Stored in this page's private database, tied to the owner of this artifact. It syncs between your devices. Access is limited to the owner.</div>` : A.mode === 'supabase' ? html`<div class="callout ok">Stored in Supabase and protected with row-level policies. You are signed in as <b>${A.auth.user && A.auth.user.email ? A.auth.user.email : 'Google user'}</b>.</div>` : html`<div class="callout warn">The shared database is not available in this view, so data is kept in this browser only. Export a backup to avoid losing it.</div>`}
        <div class="stats"><span>Resumes <b>${nRes}</b></span><span>Master entries <b>${A.master.sections.reduce((n, s) => n + s.items.length, 0)}</b></span><span>Size <b>${(size / 1024).toFixed(1)} KB</b></span></div>
        <p class="muted" style="font-size:13px">${syncMode ? 'Your resume data is synced to your Supabase project. Resume files are still generated in your browser.' : 'Nothing is sent to any third-party service. Resume files are generated in your browser. Libraries for PDF and Word are fetched from public CDNs on first export.'}</p>
        ${A.mode === 'supabase' && html`<div class="row"><button type="button" class="btn" disabled=${authBusy} onClick=${async () => {
          setAuthErr(''); setAuthBusy(true);
          try { await A.signOut(); location.reload(); }
          catch (e) { setAuthErr((e && e.message) || 'Could not sign out.'); setAuthBusy(false); }
        }}><${Icon} n="x" />${authBusy ? 'Signing out…' : 'Sign out'}</button></div>`}
        ${authErr && html`<div class="callout bad" role="alert">${authErr}</div>`}
      </div>
      <div class="panel stack"><h2 style="font-size:18px">Backup and restore</h2>
        <p class="muted" style="font-size:13.5px">A backup contains the master profile and every resume, including overrides and layout. Saved version history is not included.</p>
        <div class="row"><button type="button" class="btn primary" onClick=${() => A.backup()}><${Icon} n="download" />Download backup</button><button type="button" class="btn" onClick=${() => A.dialog({ type: 'import' })}><${Icon} n="upload" />Restore or import</button></div></div>
    </div>
    <div class="panel stack"><h2 style="font-size:18px;color:var(--bad)">Erase everything</h2>
      <p class="muted" style="font-size:13.5px">Permanently deletes the master profile, all resumes and all saved versions. Download a backup first. Type ERASE to enable the button.</p>
      <div class="row"><input class="in" style="width:200px" aria-label="Type ERASE to confirm" value=${confirmTxt} onInput=${(e) => setConfirmTxt(e.target.value)} placeholder="ERASE" /><button type="button" class="btn danger solid" disabled=${confirmTxt !== 'ERASE'} onClick=${() => { A.eraseAll(); setConfirmTxt(''); }}><${Icon} n="trash" />Erase all data</button></div></div>
  </div>`;
}

/* ----- appearance ----- */
export function AppearanceDialog({ A }) {
  const [p, setP] = useState(() => ({ palette: 'indigo', mode: 'system', motion: 'system', ...loadAppearance() }));
  const set = (k, v) => { const n = { ...p, [k]: v }; setP(n); applyAppearance(n); saveAppearance(n); };
  return html`<${Dialog} title="Appearance" onClose=${A.closeDialog} foot=${html`<button type="button" class="btn primary" data-autofocus onClick=${A.closeDialog}><${Icon} n="check" />Done</button>`}>
    <div class="stack"><span class="lbl">Colour theme</span>
      <div class="row" role="group" aria-label="Colour theme" style="gap:10px">${Object.entries(PALETTES).map(([k, t]) => html`<button type="button" key=${k} aria-pressed=${p.palette === k} class="tpl" onClick=${() => set('palette', k)} style="width:104px;padding:10px;display:grid;gap:8px;text-align:left"><span style="display:flex;gap:4px"><i style=${'width:28px;height:28px;border-radius:50%;background:' + t.a}></i><i style=${'width:28px;height:28px;border-radius:50%;background:' + t.d}></i></span><b style="font-size:13px">${t.label}</b></button>`)}</div></div>
    <div class="stack"><span class="lbl">Mode</span>
      <${Seg} label="Mode" value=${p.mode} onChange=${(v) => set('mode', v)} options=${[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]} /></div>
    <div class="stack"><span class="lbl">Motion</span>
      <${Seg} label="Motion" value=${p.motion} onChange=${(v) => set('motion', v)} options=${[['system', 'System'], ['off', 'Off'], ['soft', 'Soft'], ['snappy', 'Snappy']]} /></div>
    <p class="muted" style="font-size:13px">Applies to the app only. Your resume's own colours are set in each resume's Design tab. Motion still respects reduced-motion accessibility settings. This choice is remembered on this device.</p>
  </${Dialog}>`;
}

export function ShortcutsDialog({ A }) {
  const rows = [
    ['Ctrl/Cmd + K', 'Open quick actions'],
    ['?', 'Open keyboard shortcuts'],
    ['N', 'Create a new resume'],
    ['/', 'Focus resume search (Dashboard)'],
    ['1', 'Go to Resumes'],
    ['2', 'Go to Master profile'],
    ['3', 'Go to Compare'],
    ['4', 'Go to Data & backup'],
    ['Esc', 'Close dialog'],
  ];
  return html`<${Dialog} title="Keyboard shortcuts" onClose=${A.closeDialog} foot=${html`<button type="button" class="btn" onClick=${A.closeDialog}><${Icon} n="x" />Close</button>`}>
    <p class="muted" style="font-size:13.5px">Shortcuts work when you are not typing in a text field.</p>
    <div class="card" style="padding:0">
      ${rows.map(([k, d], i) => html`<div key=${k} class="schema-row" style=${'grid-template-columns:90px minmax(0,1fr);padding:10px 12px' + (i < rows.length - 1 ? ';border-bottom:1px solid var(--line)' : '')}>
        <span class="chip mono">${k}</span><span>${d}</span>
      </div>`)}
    </div>
  </${Dialog}>`;
}

export function CommandPaletteDialog({ A }) {
  const list = Object.values<Resume>(A.resumes).sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated));
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState(loadCmdkRecent);
  const [pinned, setPinned] = useState(loadCmdkPinned);
  const run = (item) => { rememberCmdkAction(item.id); setRecent(loadCmdkRecent()); A.closeDialog(); item.fn(); };
  const togglePinned = (id) => {
    const next = pinned.includes(id) ? pinned.filter((x) => x !== id) : [id, ...pinned.filter((x) => x !== id)];
    setPinned(next); saveCmdkPinned(next);
  };
  const staticActions = [
    { id: 'new-resume', section: 'Actions', title: 'New resume', desc: 'Create a tailored resume', searchText: 'new resume create tailored', icon: 'plus', fn: () => A.dialog({ type: 'new' }) },
    { id: 'import-resume', section: 'Actions', title: 'Import resume', desc: 'Bring in PDF, DOCX, LinkedIn, JSON or text', searchText: 'import upload pdf docx linkedin json text', icon: 'upload', fn: () => A.dialog({ type: 'import' }) },
    { id: 'open-master', section: 'Navigation', title: 'Open master profile', desc: 'Edit source profile used by all resumes', searchText: 'master profile edit source', icon: 'user', fn: () => A.go({ name: 'master' }) },
    { id: 'open-compare', section: 'Navigation', title: 'Open compare view', desc: 'Compare two resumes side by side', searchText: 'compare resumes diff', icon: 'compare', fn: () => A.go({ name: 'compare' }) },
    { id: 'open-data', section: 'Navigation', title: 'Open data and backup', desc: 'Backups, restore, and data controls', searchText: 'data backup restore export', icon: 'database', fn: () => A.go({ name: 'data' }) },
    { id: 'open-appearance', section: 'Actions', title: 'Open appearance settings', desc: 'Theme, color palette, and motion', searchText: 'appearance theme palette dark light motion animation', icon: 'sliders', fn: () => A.dialog({ type: 'appearance' }) },
  ];
  const resumeActions = list.map((r) => {
    const ir = buildIR(A.master, r);
    const plain = irPlain(ir).replace(/\s+/g, ' ').trim();
    const snippet = plain.slice(0, 140);
    return {
      id: 'resume-' + r.id,
      section: 'Resumes',
      title: 'Open resume: ' + r.name,
      desc: [r.meta.jobTitle, r.meta.company, r.meta.country, r.meta.industry].filter(Boolean).join(' • ') || 'Resume editor',
      searchText: [r.name, r.meta.jobTitle, r.meta.company, r.meta.country, r.meta.industry, r.meta.notes, ...(r.meta.tags || []), plain, snippet].join(' ').toLowerCase(),
      icon: 'file',
      fn: () => A.go({ name: 'editor', id: r.id }),
    };
  });
  const all = [...staticActions, ...resumeActions];
  const toks = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const scored = all.map((item) => {
    const hay = (item.searchText || (item.title + ' ' + item.desc).toLowerCase());
    let score = 0;
    for (const t of toks) {
      const s = fuzzyScore(hay, t);
      if (s < 0) return null;
      score += s;
    }
    if (pinned.includes(item.id)) score += 260;
    if (!toks.length && recent.includes(item.id)) score += 200 - recent.indexOf(item.id) * 8;
    if (!toks.length && item.section === 'Navigation') score += 10;
    return { item, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  const filtered = scored.map((x) => x.item);
  useEffect(() => { setActive(0); }, [q]);
  const recentSet = new Set(recent);
  const pinnedSet = new Set(pinned);
  const grouped = [];
  const pinnedRows = filtered.filter((x) => pinnedSet.has(x.id));
  if (pinnedRows.length) grouped.push(['Pinned', pinnedRows]);
  if (!toks.length) {
    const recents = filtered.filter((x) => recentSet.has(x.id) && !pinnedSet.has(x.id));
    if (recents.length) grouped.push(['Recent', recents]);
  }
  const bySection = ['Actions', 'Navigation', 'Resumes'].map((name) => [name, filtered.filter((x) => x.section === name && !pinnedSet.has(x.id) && (!grouped.length || !recentSet.has(x.id)))]);
  bySection.forEach(([name, items]) => { if (items.length) grouped.push([name, items]); });
  const linear = grouped.flatMap(([, items]) => items);
  const onKeys = (e) => {
    if (!linear.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((n) => (n + 1) % linear.length); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((n) => (n - 1 + linear.length) % linear.length); return; }
    if (e.key === 'Enter') { e.preventDefault(); const item = linear[Math.max(0, Math.min(active, linear.length - 1))]; if (item) run(item); }
  };
  return html`<${Dialog} title="Quick actions" onClose=${A.closeDialog} wide foot=${html`<button type="button" class="btn" onClick=${() => { A.closeDialog(); A.dialog({ type: 'shortcuts' }); }}><${Icon} n="info" />Keyboard shortcuts</button><button type="button" class="btn" onClick=${A.closeDialog}><${Icon} n="x" />Close</button>`}>
    <div class="stack" onKeyDown=${onKeys}>
      <${TextField} label="Search actions" value=${q} onInput=${setQ} placeholder="Try: new resume, compare, import, backup…" id="cmdk-search" autoComplete="off" />
      ${linear.length === 0 ? html`<div class="callout">No matching actions.</div>` : html`<div class="cmdk-list" role="listbox" aria-label="Quick actions" aria-activedescendant=${'cmdk-item-' + active}>${grouped.map(([title, items]) => html`<div key=${title} class="stack" style="gap:6px"><div class="menu-label" style="padding:0 4px">${title}</div>${items.map((a) => { const i = linear.indexOf(a); return html`<div id=${'cmdk-item-' + i} key=${a.id} role="option" aria-selected=${active === i} class=${'cmdk-item ' + (active === i ? 'active' : '')} onMouseEnter=${() => setActive(i)}><button type="button" class="cmdk-main" onClick=${() => run(a)}><${Icon} n=${a.icon} /><span><b>${a.title}</b><small>${a.desc}</small></span></button><button type="button" class=${'ibtn sm ' + (pinnedSet.has(a.id) ? 'on' : '')} title=${pinnedSet.has(a.id) ? 'Unpin action' : 'Pin action'} aria-label=${pinnedSet.has(a.id) ? 'Unpin action' : 'Pin action'} onClick=${() => togglePinned(a.id)}><${Icon} n="star" /></button></div>`; })}</div>`)}</div>`}
    </div>
  </${Dialog}>`;
}
