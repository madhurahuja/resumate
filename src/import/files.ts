import { KINDS } from '../core/constants';
import { PRESENT_RE } from '../core/dates';
import { blankItem, makeSection } from '../core/model';
import { uid } from '../core/util';
import { loadMammoth, loadPdfJs } from '../export/libs';

import { readLinkedInFiles } from './linkedin';
import { normDateText } from './text';

export async function readImportFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.zip') || name.endsWith('.csv')) return readLinkedInFiles([file]);
  if (file.size > 15 * 1024 * 1024) throw new Error('That file is larger than 15 MB.');
  if (name.endsWith('.json')) {
    const o = JSON.parse(await file.text());
    if (o.format === 'resumate.resume' || o.format === 'folio.resume') return { kind: 'resumate', data: o };
    if (o.format === 'resumate.backup' || o.format === 'folio.backup') return { kind: 'backup', data: o };
    throw new Error('This JSON file is not a Resumate export.');
  }
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.text')) return { kind: 'text', text: await file.text() };
  if (name.endsWith('.docx')) {
    const mammoth = await loadMammoth();
    const r = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    const doc = new DOMParser().parseFromString(r.value, 'text/html'); const out = [];
    doc.body.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li').forEach((el) => { const t = el.textContent.replace(/\s+/g, ' ').trim(); if (t) out.push((el.tagName === 'LI' ? '• ' : '') + t); });
    return { kind: 'text', text: out.join('\n') };
  }
  if (name.endsWith('.pdf')) {
    const pdfjsLib = await loadPdfJs();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useWorkerFetch: false, isEvalSupported: false }).promise;
    let text = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const tc = await (await pdf.getPage(p)).getTextContent(); let y = null; let ln = '';
      for (const it of tc.items) { const yy = it.transform ? it.transform[5] : null; if (y !== null && yy !== null && Math.abs(yy - y) > 3) { text += ln + '\n'; ln = ''; } ln += it.str; if (it.hasEOL) { text += ln + '\n'; ln = ''; y = null; continue; } y = yy; }
      text += ln + '\n';
    }
    if (text.replace(/\s/g, '').length < 40) throw new Error('No readable text found. This looks like a scanned image; export it as DOCX or paste the text instead.');
    return { kind: 'text', text };
  }
  throw new Error('Unsupported file type. Use PDF, DOCX, TXT, Markdown, Resumate JSON or a LinkedIn data export (.zip).');
}



/* Parsed structure -> master sections / resume-only sections */
export function parsedToSections(parsed) {
  return parsed.sections.map((ps) => {
    const sec = makeSection(KINDS[ps.kind] ? ps.kind : 'custom', ps.kind === 'custom' ? ps.title : undefined);
    if (ps.kind !== 'custom') sec.title = ps.title && ps.title.length < 30 ? (KINDS[ps.kind].title) : sec.title;
    sec.items = ps.items.map((v) => { const it = blankItem(sec); sec.fields.forEach((f) => { if (v[f.key] !== undefined) it.v[f.key] = v[f.key]; }); return it; });
    return sec;
  });
}
export function resumateJsonToParsed(o) {
  const header = { fullName: o.header.name || '', headline: o.header.headline || '', email: '', phone: '', location: '', links: [] };
  (o.header.contacts || []).forEach((c) => { if (/@/.test(c) && !header.email) header.email = c; else if (/^[+(\d]/.test(c) && !header.phone) header.phone = c; else if (!header.location) header.location = c; });
  (o.header.links || []).forEach((l) => header.links.push({ id: uid('l_'), label: l.label || 'Link', url: l.url }));
  const sections = (o.sections || []).map((s) => ({ kind: KINDS[s.kind] ? s.kind : 'custom', title: s.title, items: s.entries.map((e) => {
    const rng = { s: '', e: '', cur: false }; if (e.dates) { const m = e.dates.split(/\s[–-]\s/); rng.s = normDateText(m[0]); if (m[1]) { if (PRESENT_RE.test(m[1].trim()) || /Present|Présent|heute|Actualidad|Presente|Heden/i.test(m[1])) rng.cur = true; else rng.e = normDateText(m[1]); } }
    if (s.kind === 'summary') return { label: 'Imported', text: e.text || e.title };
    if (s.kind === 'skills') return { title: e.title, tags: e.tags };
    if (s.kind === 'languages') return { title: e.title, level: e.subtitle };
    if (s.kind === 'certifications') return { title: e.title, issuer: e.subtitle, date: rng.s };
    if (s.kind === 'achievements') return { title: e.title, text: e.text, date: rng.s };
    if (s.kind === 'education') return { title: e.title, degree: e.subtitle, location: e.location, dates: rng, bullets: e.bullets };
    if (s.kind === 'projects') return { title: e.title, role: e.subtitle, dates: rng, text: e.text, bullets: e.bullets };
    if (s.kind === 'experience') return { title: e.title, org: e.subtitle, location: e.location, dates: rng, text: e.text, bullets: e.bullets };
    return { title: e.title, sub: e.subtitle, dates: rng, text: e.text, bullets: e.bullets };
  }) }));
  return { header, sections };
}
