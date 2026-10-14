
import { irPlain } from './ir';
import { str } from './util';

/* ---------- diff ---------- */
export function lcsDiff(a, b) {
  const n = a.length, m = b.length; const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { ops.push({ t: '=', s: a[i] }); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) ops.push({ t: '-', s: a[i++] }); else ops.push({ t: '+', s: b[j++] }); }
  while (i < n) ops.push({ t: '-', s: a[i++] }); while (j < m) ops.push({ t: '+', s: b[j++] });
  return ops;
}
export function textDiff(a, b) {
  const A = str(a).split('\n'), B = str(b).split('\n');
  if (A.length * B.length > 4e6) return { ops: [{ t: '-', s: '(documents too large to diff)' }], added: 0, removed: 0 };
  const ops = lcsDiff(A, B); let added = 0, removed = 0;
  ops.forEach((o) => { if (o.t === '+') added++; if (o.t === '-') removed++; });
  return { ops, added, removed };
}
export function wordDiff(a, b) {
  const A = str(a).split(/(\s+)/), B = str(b).split(/(\s+)/);
  const ops = lcsDiff(A, B); return ops;
}

/* ---------- job-description keyword matching (local, heuristic) ---------- */
export const STOP = new Set(('a about above after again all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its just me more most my no nor not of off on once only or other our out over own same she should so some such than that the their theirs them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours able across within including ensure etc per via using use used work working works team teams role roles looking join company years year experience experienced strong ability skills skill responsibilities responsible required requirements preferred plus must good great excellent new help helping one two three based related relevant other well like will new').split(' '));
export function extractKeywords(jd, limit = 28) {
  const toks = str(jd).toLowerCase().match(/[a-z][a-z0-9+#.\-]*[a-z0-9+#]|[a-z]/g) || [];
  const clean = toks.map((t) => t.replace(/^[.\-]+|[.\-]+$/g, '')).filter(Boolean);
  const freq = new Map(); const add = (k, w) => freq.set(k, (freq.get(k) || 0) + w);
  clean.forEach((t) => { if (t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t)) add(t, 1); });
  for (let i = 0; i < clean.length - 1; i++) { const a = clean[i], b = clean[i + 1]; if (a.length > 2 && b.length > 2 && !STOP.has(a) && !STOP.has(b)) add(a + ' ' + b, 0.01); }
  const arr = [...freq.entries()].filter(([k, c]) => (k.includes(' ') ? c >= 1.02 : c >= 1)).map(([k, c]) => [k, k.includes(' ') ? Math.round(c * 100) * 1.4 : c]);
  arr.sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
  const out = []; const used = new Set();
  for (const [k] of arr) { if (out.length >= limit) break; if (k.includes(' ')) { out.push(k); k.split(' ').forEach((w) => used.add(w)); } else if (!used.has(k)) out.push(k); }
  return out;
}
export function keywordMatch(keywords, text) {
  const t = ' ' + str(text).toLowerCase() + ' '; const found = [], missing = [];
  keywords.forEach((k) => { const re = new RegExp('(^|[^a-z0-9+#])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9+#])'); (re.test(t) ? found : missing).push(k); });
  return { found, missing, score: keywords.length ? Math.round((found.length / keywords.length) * 100) : 0 };
}

/* ---------- ATS notes (rule-based checks on the document, not a vendor score) ---------- */
export const PDF_SAFE = /^[\u0000-ɏͰ-ϿЀ-ӿḀ-ỿ -⁯₠-⃏℀-⅏←-⇿∀-⋿■-◿ﬀ-ﬆ]*$/;
export const WINANSI = /^[\u0000-ÿŒœŠšŸŽžƒˆ˜–—‘’‚“”„†‡•…‰‹›€™]*$/;
export function hasVisiblePhone(value) {
  const raw = str(value).trim();
  if (!raw || /@/.test(raw)) return false;
  const s = raw.toLowerCase();
  const digits = s.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return false;
  const hasPhoneHint = /\b(phone|tel|mobile|mob|cell|whatsapp|wa)\b/.test(s);
  const stripped = s.replace(/\b(ext|x)\b/g, '').trim();
  const hasLetters = /[a-z]/.test(stripped);
  if (hasLetters && !hasPhoneHint) return false;
  if (/^\+?\d{7,15}$/.test(stripped.replace(/\s+/g, ''))) return true;
  if (/\d[\s().-]+\d/.test(stripped)) return true;
  return hasPhoneHint;
}
export function atsNotes(ir, resume) {
  const n = []; const L = resume.layout; const txt = irPlain(ir);
  if (!ir.header.name) n.push({ lvl: 'bad', msg: 'No name in the header.' });
  if (!ir.header.contacts.some((c) => /@/.test(c))) n.push({ lvl: 'bad', msg: 'No email address is visible.' });
  if (!ir.header.contacts.some((c) => hasVisiblePhone(c))) n.push({ lvl: 'warn', msg: 'No phone number is visible.' });
  if (L.fontSize < 9) n.push({ lvl: 'warn', msg: 'Font size under 9 pt is hard to read and may extract poorly.' });
  const std = ['summary', 'experience', 'education', 'skills'];
  std.forEach((k) => { if (!ir.sections.some((s) => s.kind === k)) n.push({ lvl: 'info', msg: 'No visible ' + k + ' section. Recruiter software looks for it.' }); });
  const custom = ir.sections.filter((s) => s.kind === 'custom'); if (custom.length) n.push({ lvl: 'info', msg: custom.length + ' custom section(s). Non-standard headings can be skipped by older parsers.' });
  ir.sections.forEach((s) => s.entries.forEach((e) => { if (e.bullets.length > 8) n.push({ lvl: 'info', msg: '"' + (e.title || s.title) + '" has ' + e.bullets.length + ' bullets. Trim to the strongest 4 to 6.' }); }));
  if (!PDF_SAFE.test(txt)) n.push({ lvl: 'warn', msg: 'Contains scripts the PDF fonts cannot draw (for example Devanagari or CJK). Export DOCX instead.', code: 'pdf-script' });
  if (!n.length) n.push({ lvl: 'ok', msg: 'Single column, real text, standard headings, no images or tables.' });
  return n;
}
export const pdfScriptOk = (ir) => PDF_SAFE.test(irPlain(ir));

/* ---------- resume health / tailoring suggestions ---------- */
export function resumeHealth(ir, resume) {
  const text = irPlain(ir);
  const wordCount = (text.match(/\b[\w'-]+\b/g) || []).length;
  const totalBullets = ir.sections.reduce((sum, section) => sum + section.entries.reduce((count, entry) => count + entry.bullets.length, 0), 0);
  const email = ir.header.contacts.some((value) => /@/.test(value));
  const phone = ir.header.contacts.some((value) => hasVisiblePhone(value));
  const hasSummary = ir.sections.some((section) => section.kind === 'summary');
  const hasExperience = ir.sections.some((section) => section.kind === 'experience');
  const hasEducation = ir.sections.some((section) => section.kind === 'education');
  const hasSkills = ir.sections.some((section) => section.kind === 'skills');
  const checks = [
    { label: 'Contact details', ok: !!ir.header.name && email && phone },
    { label: 'Professional headline', ok: !!ir.header.headline },
    { label: 'Summary section', ok: hasSummary },
    { label: 'Experience section', ok: hasExperience },
    { label: 'Education section', ok: hasEducation },
    { label: 'Skills section', ok: hasSkills },
    { label: 'Impact details', ok: totalBullets >= 6 || wordCount >= 180 },
  ];
  const score = Math.max(0, Math.min(100, Math.round((checks.filter((c) => c.ok).length / checks.length) * 100)));
  const suggestions = [];
  if (!ir.header.name) suggestions.push('Add your full name at the top of the resume.');
  if (!ir.header.headline) suggestions.push('Add a short professional headline so recruiters understand your value quickly.');
  if (!email) suggestions.push('Add an email address so hiring teams can contact you.');
  if (!phone) suggestions.push('Add a phone number or a clear contact line.');
  if (!hasSummary) suggestions.push('Add a short summary or profile section that frames your fit for the role.');
  if (!hasExperience) suggestions.push('Add at least one experience section with impact-focused bullets.');
  if (!hasEducation && !resume.meta.industry) suggestions.push('Include education or relevant training if it strengthens the role.');
  if (!hasSkills) suggestions.push('List core skills, tools, or certifications the role expects.');
  if (totalBullets < 6 && wordCount < 180) suggestions.push('Expand strong bullet points with concrete metrics and outcomes.');
  if (resume.meta.jobDescription && resume.meta.jobDescription.trim()) {
    const kws = extractKeywords(resume.meta.jobDescription, 16);
    if (kws.length) {
      const match = keywordMatch(kws, text);
      if (match.score < 60) suggestions.push('Add more role-specific keywords from the job description to improve alignment.');
    }
  }
  if (!suggestions.length) suggestions.push('This resume looks polished and ready to share.');
  return { score, checks, suggestions, wordCount, totalBullets };
}

export function bulletQualityInsights(ir) {
  const bullets = ir.sections.flatMap((section) => section.entries.flatMap((entry) => entry.bullets || [])).map((b) => str(b).trim()).filter(Boolean);
  const metricLike = bullets.filter((b) => /(\d|%|\$|€|£|¥|₹|\b\d+[kmb]\b|\b(x|times)\b|\b(million|billion|hours?|days?|weeks?|months?)\b)/i.test(b));
  const leadCounts = new Map();
  bullets.forEach((b) => {
    const m = b.match(/^[^a-zA-Z]*([a-zA-Z][a-zA-Z'-]*)/);
    if (!m) return;
    const w = m[1].toLowerCase();
    if (w.length < 3) return;
    leadCounts.set(w, (leadCounts.get(w) || 0) + 1);
  });
  const repeatedLeadWords = [...leadCounts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([word, count]) => ({ word, count }));
  const totalBullets = bullets.length;
  const quantifiedBullets = metricLike.length;
  const metricCoverage = totalBullets ? Math.round((quantifiedBullets / totalBullets) * 100) : 0;
  return { totalBullets, quantifiedBullets, metricCoverage, repeatedLeadWords };
}
