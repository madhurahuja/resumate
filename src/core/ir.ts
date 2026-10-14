import { fmtDateField } from './dates';
import { resolve } from './model';
import { str } from './util';

/* ---------- IR: the single neutral document every exporter reads ---------- */
export function joinNE(a, sep) { return a.filter((x) => str(x).trim()).join(sep); }
export function buildIR(master, resume) {
  const R = resolve(master, resume); const lang = resume.meta.language || 'en'; const fmt = resume.layout.dateFormat || 'MMM YYYY';
  const hv = R.header.values; const hide = R.header.hide;
  const contacts = [];
  ['email', 'phone', 'location'].forEach((k) => { if (hv[k] && !hide[k]) contacts.push(hv[k]); });
  R.header.extra.forEach((x) => { if (!x.hidden && str(x.value).trim()) contacts.push(x.label ? x.label + ': ' + x.value : x.value); });
  const links = R.header.links.filter((l) => !l.hidden && str(l.url).trim()).map((l) => ({ label: l.label, url: l.url }));
  const header = { name: hide.fullName ? '' : hv.fullName, headline: hide.headline ? '' : hv.headline, contacts, links };
  const sections = [];
  for (const s of R.sections) {
    if (!s.visible) continue;
    const fields = s.fields.filter((f) => !s.hiddenFields[f.key]);
    const entries = [];
    for (const it of s.items) {
      if (!it.visible) continue;
      const e = entryFrom(fields, it.v, lang, fmt); e.id = it.id;
      if (e.title || e.subtitle || e.text || e.bullets.length || e.tags.length || e.extras.length || e.links.length || e.dates) entries.push(e);
    }
    if (entries.length) sections.push({ id: s.id, kind: s.kind, title: s.title, display: s.display, entries, col: s.col || 'main' });
  }
  return { header, sections, lang };
}
export function entryFrom(fields, v, lang, fmt) {
  const e = { id: '', title: '', subtitle: '', location: '', dates: '', text: '', bullets: [], tags: [], links: [], extras: [] };
  for (const f of fields) {
    const val = v[f.key];
    switch (f.role) {
      case 'title': e.title = joinNE([e.title, str(val)], ' '); break;
      case 'subtitle': e.subtitle = joinNE([e.subtitle, str(val)], ', '); break;
      case 'location': e.location = joinNE([e.location, str(val)], ', '); break;
      case 'dates': e.dates = joinNE([e.dates, fmtDateField(f, val, fmt, lang)], ' · '); break;
      case 'text': e.text = joinNE([e.text, str(val).trim()], '\n'); break;
      case 'bullets': e.bullets.push(...(Array.isArray(val) ? val : str(val).split('\n')).map((x) => str(x).trim()).filter(Boolean)); break;
      case 'tags': e.tags.push(...(Array.isArray(val) ? val : str(val).split(',')).map((x) => str(x).trim()).filter(Boolean)); break;
      case 'link': if (str(val).trim()) e.links.push({ label: f.label, url: str(val).trim() }); break;
      case 'extra': { let x = Array.isArray(val) ? val.join(', ') : f.type === 'daterange' || f.type === 'date' ? fmtDateField(f, val, fmt, lang) : str(val).trim(); if (x) e.extras.push({ label: f.label, value: x }); break; }
      default: break;
    }
  }
  return e;
}
export const shortUrl = (u) => str(u).replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
export function irToText(ir, md) {
  const out = []; const H = ir.header;
  out.push(md ? '# ' + H.name : H.name);
  if (H.headline) out.push(md ? '**' + H.headline + '**' : H.headline);
  const cl = [...H.contacts, ...H.links.map((l) => shortUrl(l.url))]; if (cl.length) out.push(cl.join(md ? ' · ' : ' | '));
  for (const s of ir.sections) {
    out.push(''); out.push(md ? '## ' + s.title : s.title.toUpperCase());
    if (!md) out.push('-'.repeat(Math.min(40, s.title.length)));
    if (s.display === 'inline') { out.push(s.entries.map((e) => e.title + (e.subtitle ? ' (' + e.subtitle + ')' : '')).join(' · ')); continue; }
    for (const e of s.entries) {
      if (s.display === 'groups') { out.push((md ? '**' + e.title + ':** ' : e.title + ': ') + e.tags.join(', ') + (e.text ? ' ' + e.text : '')); continue; }
      const top = joinNE([md && e.title ? '**' + e.title + '**' : e.title, e.subtitle, e.location], ' | ');
      out.push(joinNE([top, e.dates], '  —  '));
      if (e.text) out.push(e.text);
      e.bullets.forEach((b) => out.push('- ' + b));
      if (e.tags.length) out.push(e.tags.join(', '));
      e.extras.forEach((x) => out.push(x.label + ': ' + x.value));
      e.links.forEach((l) => out.push(shortUrl(l.url)));
      if (s.display === 'entries' && (e.bullets.length || e.text)) out.push('');
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
export const irPlain = (ir) => irToText(ir, false);

