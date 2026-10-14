import { parseDate } from '../core/dates';
import { str, uid } from '../core/util';

/* ---------- import: text -> structure ---------- */
export const HEADING_MAP: [string, RegExp][] = [
  ['summary', /^(summary|professional summary|profile|about( me)?|objective|career objective|overview|executive summary|profil|resumen|perfil|profilo|profiel|zusammenfassung)$/i],
  ['experience', /^(experience|work experience|professional experience|employment( history)?|work history|career history|relevant experience|expérience( professionnelle)?|experiencia|berufserfahrung|esperienza|werkervaring)$/i],
  ['education', /^(education|academic background|education & training|education and training|qualifications|formation|educación|ausbildung|istruzione|opleiding)$/i],
  ['skills', /^(skills|technical skills|key skills|core competencies|competencies|technologies|tech stack|expertise|top skills|compétences|habilidades|kenntnisse|competenze|vaardigheden)$/i],
  ['certifications', /^(certifications?|certificates?|licenses( & certifications)?|licences|courses|zertifikate|certificaciones)$/i],
  ['projects', /^(projects?|selected projects|personal projects|key projects|projets|proyectos|projekte|progetti)$/i],
  ['languages', /^(languages?|language skills|langues|idiomas|sprachen|lingue|talen)$/i],
  ['achievements', /^(achievements?|awards?|honou?rs( & awards)?|accomplishments|publications|réalisations|logros|erfolge)$/i],
];
export const BULLET_RE = /^\s*[•●▪■◦·\-–—*▪►➢✓]\s+/;
export const MON = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
export const DT = '(?:' + MON + '\\.?,?\\s+\\d{4}|\\d{1,2}[\\/.]\\d{4}|\\d{4}-\\d{1,2}|\\d{4})';
export const RANGE_RE = new RegExp('(' + DT + ')\\s*(?:-|–|—|to|until)\\s*(' + DT + '|present|current|now|today|ongoing)', 'i');
export const SINGLE_DATE_RE = new RegExp('\\b(' + MON + '\\.?,?\\s+\\d{4}|\\d{1,2}[\\/.]\\d{4})\\b', 'i');
export const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
export const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
export const URL_RE = /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|gitlab\.com|[a-z0-9-]+\.(?:com|io|dev|me|org|net|co))(?:\/[^\s,|]*)?/gi;

export function detectHeading(line) {
  const t = line.replace(/[:：]\s*$/, '').trim(); if (!t || t.length > 40 || /[.!?]$/.test(t)) return null;
  for (const [kind, re] of HEADING_MAP) if (re.test(t)) return { kind, title: t };
  if (t.length >= 4 && t === t.toUpperCase() && /[A-Z]/.test(t) && t.split(/\s+/).length <= 4 && !EMAIL_RE.test(t) && !/\d/.test(t)) return { kind: 'custom', title: t.charAt(0) + t.slice(1).toLowerCase() };
  return null;
}
export function toRange(s, e) { const cur = /^(present|current|now|today|ongoing)$/i.test(str(e)); return { s: normDateText(s), e: cur ? '' : normDateText(e), cur }; }
export function normDateText(s) { const d = parseDate(s); if (!d || d.present) return str(s).trim(); return d.m ? d.y + '-' + String(d.m).padStart(2, '0') : String(d.y); }
export function splitOrgLoc(sub) {
  let m = sub.match(/^(.*\S)\s+(Remote|Hybrid|On-?site)$/i); if (m) return [m[1], m[2]];
  m = sub.match(/^(.*\S)\s+([A-Z][A-Za-z\u00C0-\u024F.'-]+(?: [A-Z][A-Za-z\u00C0-\u024F.'-]+)*,\s*[A-Z][A-Za-z\u00C0-\u024F.'-]+(?: [A-Z][A-Za-z\u00C0-\u024F.'-]+)*)$/); if (m && !/\)$/.test(m[2])) return [m[1], m[2]];
  return [sub, ''];
}
export function parseEntryBlocks(ls) {
  const rows = ls.map((x) => x.trim()).filter(Boolean);
  const entries = []; let cur = null; let pending = []; let last = null; /* last body item: {kind:'b'|'t'} */
  const flush = () => { if (cur) entries.push(cur); cur = null; last = null; };
  const addBody = (line, forceNew?) => {
    if (last === 'b' && cur.bullets.length && !forceNew && (/^[a-z(]/.test(line) || !/[.!?;:]$/.test(cur.bullets[cur.bullets.length - 1]))) cur.bullets[cur.bullets.length - 1] += ' ' + line;
    else { cur.bullets.push(line); last = 'b'; }
  };
  const startEntry = (line, mm) => {
    flush();
    const rest = line.replace(mm[0], ' ').replace(/[()|,–—-]+\s*$/g, '').replace(/^\s*[|,–—-]+/, '').replace(/\s{2,}/g, ' ').trim();
    const parts = rest.split(/\s+[|–—-]\s+|\s*\|\s*/).map((x) => x.trim()).filter(Boolean);
    const cand = [...pending, ...parts].filter(Boolean); pending = [];
    cur = { title: cand[0] || '', sub: cand[1] || '', location: cand[2] || '', range: toRange(mm[1], mm[2]), text: '', bullets: [], subSet: !!cand[1] };
  };
  for (let i = 0; i < rows.length; i++) {
    const line = rows[i]; const rm = line.match(RANGE_RE);
    if (BULLET_RE.test(line)) { const b = line.replace(BULLET_RE, '').trim(); if (!cur) { cur = { title: pending.shift() || '', sub: pending.shift() || '', location: '', range: { s: '', e: '', cur: false }, text: '', bullets: [], subSet: true }; pending = []; } cur.bullets.push(b); last = 'b'; continue; }
    if (rm && line.length < 140) { startEntry(line, rm); continue; }
    const nextIsDate = rows[i + 1] && RANGE_RE.test(rows[i + 1]) && rows[i + 1].length < 140;
    if (cur && nextIsDate && line.length < 80 && !/[.!?]$/.test(line)) { flush(); pending.push(line); continue; }
    if (cur) {
      if (!cur.subSet && !cur.bullets.length && line.length < 80) { cur.subSet = true; if (!cur.sub) { const [o, l] = splitOrgLoc(line); cur.sub = o; if (l && !cur.location) cur.location = l; } else cur.sub = cur.sub; continue; }
      addBody(line); continue;
    }
    pending.push(line);
  }
  if (!cur && pending.length) { cur = { title: pending.shift(), sub: pending.shift() || '', location: '', range: { s: '', e: '', cur: false }, text: pending.join(' '), bullets: [] }; }
  flush();
  return entries.filter((e) => e.title || e.bullets.length || e.text);
}
/* LinkedIn "Save to PDF" puts a sidebar (Contact, Top Skills, Languages, Certifications) before the name, and lists company before job title. Reorder into a conventional resume layout. */
export function liPdfNormalize(text) {
  const ls = text.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!(ls.includes('Contact') && ls.includes('Top Skills') || ls.some((l) => /\(LinkedIn\)$/.test(l)) && ls.includes('Contact'))) return text;
  const main = ls.findIndex((l) => /^(Summary|Experience|Education)$/.test(l)); if (main < 4) return text;
  const side = ls.slice(0, main), rest = ls.slice(main);
  const idname = side.length - 3; const who = side.slice(idname); const sb = side.slice(0, idname).filter((l, i) => !(i === 0 && l === 'Contact'));
  let out = [...who, ...sb, ...rest];
  const isHead = (l) => HEADING_MAP.some(([, re]) => re.test(l));
  let sec = ''; const fixed = [];
  for (let i = 0; i < out.length; i++) {
    const l = out[i]; if (isHead(l)) sec = l.toLowerCase();
    if (sec === 'experience' && !isHead(l) && i + 2 < out.length && RANGE_RE.test(out[i + 2]) && !RANGE_RE.test(l) && !RANGE_RE.test(out[i + 1]) && !isHead(out[i + 1])) { const loc = out[i + 3]; const hasLoc = loc && loc.length < 50 && !/[.!?]$/.test(loc) && /,|remote|hybrid|on-?site|area|region/i.test(loc) && !RANGE_RE.test(loc) && !isHead(loc); fixed.push(out[i + 2] + ' | ' + out[i + 1] + ' | ' + l + (hasLoc ? ' | ' + loc : '')); i += hasLoc ? 3 : 2; continue; }
    const m = sec === 'education' && l.match(/^(.*?)\s*·\s*\(\s*(\d{4})\s*[-–]\s*(\d{4})?\s*\)\s*$/);
    if (m) { fixed.push(m[1] || ''); fixed.push(m[2] + ' - ' + (m[3] || 'Present')); continue; }
    fixed.push(l);
  }
  return fixed.join('\n');
}
export function parseResumeText(text) {
  text = text.replace(/^\s*Page \d+ of \d+\s*$/gim, '').replace(/\s*\((?:\d+\s+(?:years?|yrs?|months?|mos?)\s*)+\)/gi, '');
  text = text.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '').replace(/\*\*(.+?)\*\*/g, '$1'); /* Markdown headings and bold */
  text = liPdfNormalize(text);
  const ls = text.replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+$/g, ''));
  const secs = []; let curSec = null; const pre = [];
  for (const l of ls) { const hd = detectHeading(l.trim()); if (hd) { curSec = { ...hd, lines: [] }; secs.push(curSec); } else if (curSec) curSec.lines.push(l); else pre.push(l); }
  const header = { fullName: '', headline: '', email: '', phone: '', location: '', links: [] };
  const preClean = pre.map((l) => l.trim()).filter(Boolean);
  const used = new Set();
  preClean.forEach((l, i) => {
    const em = l.match(EMAIL_RE); if (em && !header.email) { header.email = em[0]; used.add(i); }
    const ph = l.replace(EMAIL_RE, '').match(PHONE_RE); if (ph && !header.phone && ph[0].replace(/\D/g, '').length >= 8) header.phone = ph[0].trim();
    const us = l.replace(EMAIL_RE, '').match(URL_RE); if (us) us.forEach((u) => { if (!header.links.some((x) => x.url === u)) header.links.push({ id: uid('l_'), label: /linkedin/i.test(u) ? 'LinkedIn' : /github/i.test(u) ? 'GitHub' : 'Website', url: u }); });
  });
  const isContactLine = (l) => EMAIL_RE.test(l) || PHONE_RE.test(l.replace(/[A-Za-z]/g, '')) && /\d{7,}/.test(l.replace(/\D/g, '')) || /https?:|www\.|linkedin|github/i.test(l);
  const nameLine = preClean.find((l) => !isContactLine(l) && l.split(/\s+/).length <= 5 && /[A-Za-zÀ-ɏ]/.test(l));
  if (nameLine) header.fullName = nameLine.replace(/\s{2,}/g, ' ');
  const rest = preClean.filter((l) => l !== nameLine && !isContactLine(l));
  if (rest[0] && rest[0].length < 90) header.headline = rest[0];
  const loc = preClean.map((l) => l.split(/\s*[|•·]\s*/)).flat().find((p) => /^[A-Z][A-Za-zÀ-ɏ .'-]+,\s*[A-Za-z .'-]{2,}$/.test(p.trim()) && !EMAIL_RE.test(p));
  if (loc) header.location = loc.trim();
  const sections = [];
  for (const s of secs) {
    const ls2 = s.lines; const items = [];
    if (s.kind === 'summary') { const t = ls2.map((x) => x.trim()).filter(Boolean).join(' '); if (t) items.push({ label: 'Imported summary', text: t }); }
    else if (s.kind === 'skills') {
      ls2.map((x) => x.replace(BULLET_RE, '').trim()).filter(Boolean).forEach((x) => {
        const m = x.match(/^([^:]{2,40}):\s*(.+)$/);
        if (m) items.push({ title: m[1].trim(), tags: m[2].split(/[,;|•·]/).map((t) => t.trim()).filter(Boolean) });
        else { const tags = x.split(/[,;|•·]/).map((t) => t.trim()).filter(Boolean); if (tags.length) { const last = items[items.length - 1]; if (last && last.title === 'Skills') last.tags.push(...tags); else items.push({ title: 'Skills', tags }); } }
      });
    } else if (s.kind === 'languages') {
      ls2.join(',').split(/[,;|•·\n]/).map((x) => x.replace(BULLET_RE, '').trim()).filter(Boolean).forEach((x) => { const m = x.match(/^(.+?)\s*[(\-–:]\s*(.+?)\)?$/); items.push(m ? { title: m[1].trim(), level: m[2].replace(/\)$/, '').trim() } : { title: x }); });
    } else if (s.kind === 'certifications' || s.kind === 'achievements') {
      ls2.map((x) => x.trim()).filter(Boolean).forEach((x) => { const b = x.replace(BULLET_RE, ''); const dm = b.match(SINGLE_DATE_RE) || b.match(/\b(19|20)\d{2}\b/); const t = b.replace(dm ? dm[0] : '', '').replace(/[()|,–—-]+\s*$/g, '').trim(); if (t) items.push(s.kind === 'certifications' ? { title: t, date: dm ? normDateText(dm[0]) : '' } : { title: t, date: dm ? normDateText(dm[0]) : '' }); });
    } else {
      parseEntryBlocks(ls2).forEach((e) => {
        if (s.kind === 'education') items.push({ title: e.title, degree: e.sub, location: e.location, dates: e.range, bullets: e.bullets });
        else if (s.kind === 'projects') items.push({ title: e.title, role: e.sub, dates: e.range, text: e.text, bullets: e.bullets });
        else if (s.kind === 'experience') items.push({ title: e.title, org: e.sub, location: e.location, dates: e.range, text: e.text, bullets: e.bullets });
        else items.push({ title: e.title, sub: e.sub, dates: e.range, text: e.text, bullets: e.bullets });
      });
    }
    if (items.length) sections.push({ kind: s.kind, title: s.title, items });
  }
  return { header, sections };
}

