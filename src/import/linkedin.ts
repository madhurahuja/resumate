import { KINDS } from '../core/constants';
import { uid } from '../core/util';
import { loadJsZip } from '../export/libs';

import { BULLET_RE, normDateText } from './text';

/* ---------- LinkedIn data export (ZIP of CSV files) ---------- */
export function parseCsv(text) {
  text = String(text).replace(/^﻿/, ''); const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
/* rows -> array of {Header: value}; finds the header row even if a notes preamble precedes it */
export function csvRecords(text, mustHave) {
  const rows = parseCsv(text); let hi = rows.findIndex((r, i) => i < 6 && mustHave.some((h) => r.map((x) => x.trim().toLowerCase()).includes(h.toLowerCase())));
  if (hi < 0) return [];
  const head = rows[hi].map((x) => x.trim());
  return rows.slice(hi + 1).map((r) => { const o = {}; head.forEach((h, i) => { o[h] = (r[i] || '').trim(); }); return o; });
}
export const LI_FILES = { profile: /^profile\.csv$/i, positions: /^positions\.csv$/i, education: /^education\.csv$/i, skills: /^skills\.csv$/i, certifications: /^certifications\.csv$/i, projects: /^projects\.csv$/i, languages: /^languages\.csv$/i, honors: /^honors\.csv$/i, emails: /^email addresses\.csv$/i, phones: /^phonenumbers\.csv$/i };
export const LI_COLS = { profile: ['First Name', 'Headline'], positions: ['Company Name', 'Title'], education: ['School Name'], skills: ['Name'], certifications: ['Name', 'Authority'], projects: ['Title'], languages: ['Name', 'Proficiency'], honors: ['Title'], emails: ['Email Address'], phones: ['Number'] };
export async function readLinkedInFiles(files) {
  const texts = {}; let sawZip = false;
  const take = (name, text) => { const base = name.split('/').pop(); for (const k in LI_FILES) if (LI_FILES[k].test(base)) texts[k] = text; };
  for (const f of files) {
    const n = f.name.toLowerCase();
    if (f.size > 25 * 1024 * 1024) throw new Error(f.name + ' is larger than 25 MB.');
    if (n.endsWith('.zip')) {
      sawZip = true; const JSZip = await loadJsZip();
      let zip; try { zip = await JSZip.loadAsync(await f.arrayBuffer()); } catch (e) { throw new Error('That ZIP file could not be opened. Download the LinkedIn archive again and try once more.'); }
      let total = 0;
      for (const path of Object.keys(zip.files)) {
        const e = zip.files[path]; if (e.dir || !/\.csv$/i.test(path)) continue;
        if (!Object.values(LI_FILES).some((re) => re.test(path.split('/').pop()))) continue;
        const t = await e.async('string'); total += t.length; if (total > 20 * 1024 * 1024) throw new Error('That archive is unexpectedly large.');
        take(path, t);
      }
    } else if (n.endsWith('.csv')) take(f.name, await f.text());
    else throw new Error('Select the LinkedIn ZIP file, or its CSV files (Profile, Positions, Education, Skills…) together.');
  }
  if (!Object.keys(texts).length) throw new Error(sawZip ? 'No LinkedIn profile files were found in that ZIP. It should contain Profile.csv, Positions.csv and Education.csv. When requesting the archive, include the profile data.' : 'These CSV files are not recognised. Expected names such as Profile.csv or Positions.csv.');
  const R = {}; for (const k in texts) R[k] = csvRecords(texts[k], LI_COLS[k]);
  return { kind: 'parsed', parsed: linkedinToParsed(R) };
}
export const LI_LEVEL = { NATIVE_OR_BILINGUAL: 'Native or bilingual', FULL_PROFESSIONAL: 'Full professional', PROFESSIONAL_WORKING: 'Professional working', LIMITED_WORKING: 'Limited working', ELEMENTARY: 'Elementary' };
export function liText(desc) {
  const bullets = [], para = [];
  String(desc || '').replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean).forEach((l) => { if (BULLET_RE.test(l)) bullets.push(l.replace(BULLET_RE, '').trim()); else if (bullets.length) bullets[bullets.length - 1] += ' ' + l; else para.push(l); });
  return { text: para.join(' '), bullets };
}
export function liRange(s, e, openIsCurrent) { const cur = !e && !!s && !!openIsCurrent; return { s: normDateText(s), e: e ? normDateText(e) : '', cur }; }
export function linkedinToParsed(R) {
  const p = (R.profile && R.profile[0]) || {};
  const header = { fullName: [p['First Name'], p['Last Name']].filter(Boolean).join(' '), headline: p['Headline'] || '', email: '', phone: '', location: p['Geo Location'] || p['Address'] || '', links: [] };
  const em = (R.emails || []).find((x) => /^yes$/i.test(x['Primary'] || '')) || (R.emails || [])[0]; if (em) header.email = em['Email Address'] || '';
  const ph = (R.phones || [])[0]; if (ph) header.phone = ph['Number'] || '';
  String(p['Websites'] || '').split(/[,\s]+(?=\[|https?:)/).forEach((w) => { const m = w.match(/^\[?([A-Z_ ]+):\s*(https?:[^\]\s]+)\]?$/i) || w.match(/^()(https?:[^\]\s]+)/); if (m) header.links.push({ id: uid('l_'), label: m[1] ? m[1].charAt(0) + m[1].slice(1).toLowerCase().replace(/_/g, ' ') : 'Website', url: m[2] }); });
  const sections = [];
  const add = (kind, items) => { if (items.length) sections.push({ kind, title: KINDS[kind].title, items }); };
  if (p['Summary']) add('summary', [{ label: 'LinkedIn summary', text: p['Summary'].replace(/\s*\n\s*/g, ' ').trim() }]);
  add('experience', (R.positions || []).filter((x) => x['Title'] || x['Company Name']).map((x) => { const d = liText(x['Description']); return { title: x['Title'] || '', org: x['Company Name'] || '', location: x['Location'] || '', dates: liRange(x['Started On'], x['Finished On'], true), text: d.text, bullets: d.bullets }; }));
  add('education', (R.education || []).filter((x) => x['School Name']).map((x) => { const d = liText([x['Notes'], x['Activities']].filter(Boolean).join('\n')); const b = d.bullets.slice(); if (d.text) b.unshift(d.text); return { title: x['School Name'], degree: x['Degree Name'] || '', location: '', dates: liRange(x['Start Date'], x['End Date'], false), bullets: b }; }));
  const skills = (R.skills || []).map((x) => x['Name']).filter(Boolean);
  add('skills', skills.length ? [{ title: 'Skills', tags: skills }] : []);
  add('certifications', (R.certifications || []).filter((x) => x['Name']).map((x) => ({ title: x['Name'], issuer: x['Authority'] || '', date: normDateText(x['Started On'] || ''), url: x['Url'] || '' })));
  add('projects', (R.projects || []).filter((x) => x['Title']).map((x) => { const d = liText(x['Description']); return { title: x['Title'], role: '', dates: liRange(x['Started On'], x['Finished On'], false), url: x['Url'] || '', text: d.text, bullets: d.bullets }; }));
  add('languages', (R.languages || []).filter((x) => x['Name']).map((x) => ({ title: x['Name'], level: LI_LEVEL[x['Proficiency']] || (x['Proficiency'] || '').replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) })));
  add('achievements', (R.honors || []).filter((x) => x['Title']).map((x) => ({ title: x['Title'], date: normDateText(x['Issued On'] || ''), text: x['Description'] || '' })));
  return { header, sections };
}

