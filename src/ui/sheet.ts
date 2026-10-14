import { FONTS, PAGES, TEMPLATES } from '../core/constants';
import { shortUrl } from '../core/ir';

import { html } from './h';

/* =====================================================================
   Renderers: HTML sheet, PDF (pdfmake), DOCX (docx), import parser, validation
   ===================================================================== */
export const SHEET_CSS = `
.rs{background:#fff;color:#111;position:relative;text-align:left;overflow-wrap:anywhere;font-kerning:normal}
.rs *{box-sizing:border-box}
.rs-head{margin-bottom:var(--gap)}
.rs-name{margin:0;font-family:inherit;font-weight:700;font-size:var(--ns);line-height:1.1;color:var(--nc);letter-spacing:0}
.rs-headline{margin-top:.2em;font-size:1.05em;color:#2b2b2b}
.rs-contact{margin-top:.35em;font-size:.95em;color:#2b2b2b}
.rs-sec{margin-top:var(--gap)}
.rs-h{margin:0 0 .4em;font-family:inherit;font-size:1em;font-weight:700;letter-spacing:var(--tr);color:var(--hc);line-height:1.2}
.rs-h.u{text-transform:uppercase}
.rs-h.r-ink{border-bottom:1px solid #111;padding-bottom:.15em}
.rs-h.r-accent{border-bottom:1.5px solid var(--a);padding-bottom:.15em}
.rs-h.r-grey{border-bottom:1px solid #b5b5b5;padding-bottom:.12em}
.rs-e{margin-top:.5em}
.rs-e:first-of-type{margin-top:0}
.rs-r{display:flex;justify-content:space-between;gap:1em;align-items:baseline}
.rs-t{font-weight:700}
.rs-d,.rs-l{flex:none;white-space:nowrap;color:#2b2b2b}
.rs-s{font-style:italic;color:#222}
.rs-p{margin:.2em 0 0;white-space:pre-line}
.rs ul{margin:.25em 0 0;padding-left:1.2em}
.rs li{margin:.1em 0}
.rs-x{margin-top:.15em}
.rs-cols{display:flex;gap:1.3em;align-items:flex-start}
.rs-side{width:var(--sidew);flex:none;min-width:0}
.rs-main{flex:1;min-width:0}
.rs.tpl-aura .rs-headline,.rs.tpl-halo .rs-headline{display:inline-block;margin-top:.45em;background:color-mix(in srgb,var(--a) 25%,#ffffff 75%);color:#245066;border-radius:999px;padding:.28em .85em;letter-spacing:.04em;font-size:1em}
.rs.tpl-aura .rs-h,.rs.tpl-halo .rs-h{display:flex;align-items:center;gap:.45em;font-size:1.02em}
.rs.tpl-aura .rs-h .sicon,.rs.tpl-halo .rs-h .sicon{display:inline-grid;place-items:center;width:1.2em;height:1.2em;border-radius:.28em;background:color-mix(in srgb,var(--a) 24%,#ffffff 76%);font-size:.78em}
.rs.tpl-aura .rs-sec.k-skills .rs-e,.rs.tpl-halo .rs-sec.k-skills .rs-e{margin-top:.35em}
.rs.tpl-aura .rs-sec.k-skills .rs-p,.rs.tpl-halo .rs-sec.k-skills .rs-p{display:flex;flex-wrap:wrap;gap:.35em}
.rs.tpl-aura .rs-sec.k-skills .rs-p .chip,.rs.tpl-halo .rs-sec.k-skills .rs-p .chip{display:inline-flex;align-items:center;padding:.12em .55em;border-radius:999px;background:color-mix(in srgb,var(--a) 20%,#ffffff 80%);font-size:.92em}
.rs.tpl-aura .rs-sec.k-languages .lang-row,.rs.tpl-halo .rs-sec.k-languages .lang-row{display:flex;justify-content:space-between;gap:.8em;align-items:center;margin:.18em 0}
.rs.tpl-aura .rs-sec.k-languages .lang-meta,.rs.tpl-halo .rs-sec.k-languages .lang-meta{display:flex;gap:.55em;align-items:center;color:#444}
.rs.tpl-aura .rs-sec.k-languages .ldots,.rs.tpl-halo .rs-sec.k-languages .ldots{display:inline-flex;gap:.2em}
.rs.tpl-aura .rs-sec.k-languages .ldots i,.rs.tpl-halo .rs-sec.k-languages .ldots i{width:.42em;height:.42em;border-radius:50%;display:inline-block;background:#d1d5db}
.rs.tpl-aura .rs-sec.k-languages .ldots i.on,.rs.tpl-halo .rs-sec.k-languages .ldots i.on{background:var(--a)}
`;
(function injectSheetCss() { const s = document.createElement('style'); s.id = 'sheet-css'; s.textContent = SHEET_CSS; document.head.appendChild(s); })();

export function resolveTemplateStyle(resume) {
  const base = TEMPLATES[resume.template] || TEMPLATES.classic;
  const L = resume.layout || {};
  const has = (k) => L[k] !== null && L[k] !== undefined && L[k] !== '';
  const align = ['left', 'center', 'right'].includes(L.headerAlign) ? L.headerAlign : base.headerAlign;
  const headRule = ['none', 'ink', 'accent', 'grey'].includes(L.headingRule) ? L.headingRule : base.head.rule;
  const headColor = ['ink', 'accent'].includes(L.headingColor) ? L.headingColor : base.head.color;
  const nameColor = ['ink', 'accent'].includes(L.nameColorMode) ? L.nameColorMode : base.nameColor;
  const upper = L.headingCase === 'upper' ? true : L.headingCase === 'normal' ? false : !!base.head.upper;
  const track = has('headingTrack') && Number.isFinite(Number(L.headingTrack)) ? Math.max(0, Math.min(0.25, Number(L.headingTrack))) : base.head.track;
  const nameSize = has('nameScale') && Number.isFinite(Number(L.nameScale)) ? Math.max(1.6, Math.min(2.8, Number(L.nameScale))) : base.nameSize;
  return { ...base, headerAlign: align, nameColor, nameSize, head: { ...base.head, upper, rule: headRule, color: headColor, track } };
}

export function sheetStyle(resume) {
  const L = resume.layout; const T = resolveTemplateStyle(resume); const pg = PAGES[L.pageSize] || PAGES.letter;
  const style = `width:${pg.w}in;min-height:${pg.h}in;padding:${L.margin}in;font-family:${(FONTS[L.font] || FONTS.roboto).css};font-size:${L.fontSize}pt;line-height:${L.lineHeight};--a:${L.accent};--gap:${L.sectionGap}pt;--ns:${T.nameSize}em;--nc:${T.nameColor === 'accent' ? L.accent : '#111'};--hc:${T.head.color === 'accent' ? L.accent : '#111'};--tr:${T.head.track}em;`;
  return { T, pg, style };
}

/* Shared per-entry model so preview, PDF and DOCX stay in step. */
export function layoutEntry(s, e) {
  const run = (text, o?) => ({ text, ...(o || {}) });
  const m = { left: [], right: '', sub: null, text: e.text, bullets: e.bullets, lines: [] };
  if (s.display === 'groups') {
    m.left = [run(e.title ? e.title + ': ' : '', { bold: true }), run(e.tags.join(', '))];
  } else if (s.display === 'compact') {
    m.left = [run(e.title, { bold: true })]; if (e.subtitle) m.left.push(run(' — ' + e.subtitle)); if (e.location) m.left.push(run(', ' + e.location)); m.right = e.dates;
  } else {
    m.left = [run(e.title, { bold: true })]; m.right = e.dates;
    if (e.subtitle || e.location) m.sub = { left: e.subtitle, right: e.location };
  }
  if (s.display !== 'groups' && e.tags.length) m.lines.push([run(e.tags.join(', '))]);
  e.extras.forEach((x) => m.lines.push([run(x.label + ': ', { bold: true }), run(x.value)]));
  e.links.forEach((l) => m.lines.push([run(shortUrl(l.url))]));
  return m;
}

export function SecBody({ s }) {
  const dotLevel = (v) => {
    const t = shortUrl(v || '').toLowerCase();
    if (/native|bilingual|c2/.test(t)) return 5;
    if (/fluent|advanced|professional|c1/.test(t)) return 4;
    if (/upper|intermediate|b2/.test(t)) return 3;
    if (/conversational|b1/.test(t)) return 2;
    if (/basic|beginner|a1|a2/.test(t)) return 1;
    return 3;
  };
  if (s.display === 'inline' && s.kind === 'languages' && (s.tpl?.languageDots)) {
    return html`<div>${s.entries.map((e) => { const lvl = dotLevel(e.subtitle); return html`<div class="lang-row" key=${e.id}><span class="lang-meta"><b>${e.title}</b>${e.subtitle && html`<span>${e.subtitle}</span>`}</span><span class="ldots">${[1, 2, 3, 4, 5].map((n) => html`<i key=${n} class=${n <= lvl ? 'on' : ''}></i>`)}</span></div>`; })}</div>`;
  }
  if (s.display === 'groups' && s.kind === 'skills' && s.tpl?.skillChips) {
    return s.entries.map((e) => html`<div class="rs-e" key=${e.id}><div class="rs-r"><span><b>${e.title}</b></span></div><p class="rs-p">${e.tags.map((tag) => html`<span class="chip" key=${tag}>${tag}</span>`)}</p></div>`);
  }
  if (s.display === 'inline') return html`<p class="rs-p">${s.entries.map((e) => e.title + (e.subtitle ? ' (' + e.subtitle + ')' : '')).join('  •  ')}</p>`;
  if (s.display === 'text') return s.entries.map((e) => html`<p class="rs-p" key=${e.id}>${e.text || e.title}</p>`);
  return s.entries.map((e) => {
    const m = layoutEntry(s, e);
    const runs = (r) => r.map((x, i) => (x.bold ? html`<b key=${i}>${x.text}</b>` : html`<span key=${i}>${x.text}</span>`));
    return html`<div class="rs-e" key=${e.id}>
      ${(m.left.some((x) => x.text) || m.right) && html`<div class="rs-r"><span>${runs(m.left)}</span>${m.right && html`<span class="rs-d">${m.right}</span>`}</div>`}
      ${m.sub && html`<div class="rs-r"><span class="rs-s">${m.sub.left}</span>${m.sub.right && html`<span class="rs-l">${m.sub.right}</span>`}</div>`}
      ${m.text && html`<p class="rs-p">${m.text}</p>`}
      ${m.bullets.length > 0 && html`<ul>${m.bullets.map((b, i) => html`<li key=${i}>${b}</li>`)}</ul>`}
      ${m.lines.map((ln, i) => html`<div class="rs-x" key=${i}>${runs(ln)}</div>`)}
    </div>`;
  });
}
export function ResumeSheet({ ir, resume, innerRef }) {
  const { T, style } = sheetStyle(resume); const H = ir.header; const L = resume.layout;
  const headCls = 'rs-h' + (T.head.upper ? ' u' : '') + ' r-' + T.head.rule;
  const secIcon = {
    summary: '✦', experience: '▣', education: '◈', skills: '⚙', certifications: '✓', projects: '⌁', languages: '◉', achievements: '★', custom: '•',
  };
  const contact = [...H.contacts, ...H.links.map((l) => shortUrl(l.url))].join('  |  ');
  const renderSec = (s) => html`<section class=${'rs-sec k-' + s.kind} key=${s.id}><h2 class=${headCls}>${T.showSectionIcons && html`<span class="sicon" aria-hidden="true">${secIcon[s.kind] || '•'}</span>`}${s.title}</h2><${SecBody} s=${{ ...s, tpl: T }} /></section>`;
  const twoCol = Number(L.columns) === 2;
  const side = twoCol ? ir.sections.filter((s) => s.col === 'side') : [];
  const main = twoCol ? ir.sections.filter((s) => s.col !== 'side') : ir.sections;
  const right = L.sidebarSide === 'right';
  return html`<article class=${'rs tpl-' + resume.template} style=${style} ref=${innerRef} lang=${ir.lang}>
    <header class="rs-head" style=${'text-align:' + T.headerAlign}>
      ${H.name && html`<h1 class="rs-name">${H.name}</h1>`}
      ${H.headline && html`<div class="rs-headline">${H.headline}</div>`}
      ${contact && html`<div class="rs-contact">${contact}</div>`}
    </header>
    ${twoCol
      ? html`<div class="rs-cols" style=${'--sidew:' + (L.sidebarWidth || 2.3) + 'in'}>
          <div class="rs-side" style=${'order:' + (right ? 2 : 1)}>${side.map(renderSec)}</div>
          <div class="rs-main" style=${'order:' + (right ? 1 : 2)}>${main.map(renderSec)}</div>
        </div>`
      : main.map(renderSec)}
  </article>`;
}
