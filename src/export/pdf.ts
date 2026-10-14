import { PDF_SAFE } from '../core/analysis';
import { FONTS, PAGES } from '../core/constants';
import { irPlain, shortUrl } from '../core/ir';
import { str } from '../core/util';
import { layoutEntry, resolveTemplateStyle } from '../ui/sheet';
import { loadPdfMake } from './libs';

/* ---------- PDF ---------- */
export const clean = (s) => str(s).replace(/[​-‍﻿]/g, '');
export async function buildPdf(ir, resume) {
  const pdfMake = await loadPdfMake();
  const L = resume.layout; const T = resolveTemplateStyle(resume); const pg = PAGES[L.pageSize] || PAGES.letter;
  const txt = irPlain(ir);
  if (!PDF_SAFE.test(txt)) throw new Error('This resume uses scripts the PDF fonts cannot draw (for example Devanagari or CJK). Export DOCX instead.');
  const requestedFont = FONTS[L.font] ? L.font : 'roboto';
  const fontName = 'Roboto'; const fontSwitched = requestedFont !== 'roboto';
  pdfMake.fonts = {
    Roboto: { normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf', italics: 'Roboto-Italic.ttf', bolditalics: 'Roboto-MediumItalic.ttf' },
  };
  const m = Math.round(L.margin * 72); const cw = pg.pt[0] - 2 * m; const fs = L.fontSize; const gap = L.sectionGap;
  const INK = '#111111'; const ACC = L.accent; const GREY = '#2b2b2b';
  const rich = (runs) => runs.filter((r) => r.text).map((r) => ({ text: clean(r.text), bold: !!r.bold, italics: !!r.italic }));
  const H = ir.header;
  const align = T.headerAlign;
  const headerContent: any[] = [];
  if (H.name) headerContent.push({ text: clean(H.name), fontSize: fs * T.nameSize, bold: true, color: T.nameColor === 'accent' ? ACC : INK, alignment: align, lineHeight: 1.1 });
  if (H.headline) headerContent.push({ text: clean(H.headline), fontSize: fs * 1.05, color: '#2b2b2b', alignment: align, margin: [0, 2, 0, 0] });
  const contact = [...H.contacts, ...H.links.map((l) => shortUrl(l.url))].join('  |  ');
  if (contact) headerContent.push({ text: clean(contact), fontSize: fs * 0.95, color: GREY, alignment: align, margin: [0, 3, 0, 0] });
  const hasHeader = !!(H.name || H.headline || contact);

  const buildSections = (sections, colWidth) => {
    const content: any[] = [];
    sections.forEach((s, si) => {
      const title = T.head.upper ? s.title.toUpperCase() : s.title;
      const headNodes: any[] = [{ text: clean(title), bold: true, fontSize: fs, characterSpacing: T.head.track * fs, color: T.head.color === 'accent' ? ACC : INK, margin: [0, 0, 0, 2] }];
      if (T.head.rule !== 'none') headNodes.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: colWidth, y2: 0, lineWidth: T.head.rule === 'accent' ? 1.2 : 0.8, lineColor: T.head.rule === 'accent' ? ACC : T.head.rule === 'grey' ? '#b5b5b5' : INK }], margin: [0, 0, 0, 4] });
      else headNodes.push({ text: '', margin: [0, 0, 0, 2] });
      const topGap = si === 0 && !hasHeader ? 0 : gap;
      const blocks = [];
      if (s.display === 'inline') blocks.push({ text: clean(s.entries.map((e) => e.title + (e.subtitle ? ' (' + e.subtitle + ')' : '')).join('  •  ')) });
      else if (s.display === 'text') s.entries.forEach((e) => blocks.push({ text: clean(e.text || e.title), margin: [0, 0, 0, 2] }));
      else s.entries.forEach((e, ei) => {
        const em = layoutEntry(s, e); const head = [];
        const lr = rich(em.left);
        if (lr.length || em.right) head.push(em.right ? { columns: [{ text: lr, width: '*' }, { text: clean(em.right), width: 'auto', alignment: 'right', color: GREY }], columnGap: 8 } : { text: lr });
        if (em.sub) head.push(em.sub.right ? { columns: [{ text: clean(em.sub.left), italics: true, width: '*' }, { text: clean(em.sub.right), width: 'auto', alignment: 'right', color: GREY }], columnGap: 8 } : { text: clean(em.sub.left), italics: true });
        if (em.text) head.push({ text: clean(em.text), margin: [0, 2, 0, 0] });
        const bl = em.bullets.map((b) => ({ text: clean(b), margin: [0, 0.5, 0, 0.5] }));
        let first = null; if (bl.length) first = bl.shift();
        if (first) head.push({ ul: [first], margin: [0, 2, 0, 0] });
        const lines = em.lines.map((ln) => ({ text: rich(ln), margin: [0, 2, 0, 0] }));
        blocks.push({ stack: head, unbreakable: true, margin: [0, ei === 0 ? 0 : 5, 0, 0] });
        if (bl.length) blocks.push({ ul: bl, margin: [0, 0, 0, 0] });
        lines.forEach((l) => blocks.push(l));
      });
      // Keep the heading attached to the start of the section.
      const firstBlock = blocks.shift();
      content.push({ stack: [...headNodes, firstBlock || { text: '' }], unbreakable: true, margin: [0, topGap, 0, 0] });
      blocks.forEach((b) => content.push(b));
    });
    return content;
  };

  const twoCol = Number(L.columns) === 2;
  let content: any[] = [...headerContent];
  if (twoCol) {
    const sideW = Math.round((L.sidebarWidth || 2.3) * 72); const colGap = 16; const mainW = cw - sideW - colGap;
    const side = ir.sections.filter((s) => s.col === 'side'); const main = ir.sections.filter((s) => s.col !== 'side');
    const right = L.sidebarSide === 'right';
    const sideStack = buildSections(side, sideW); const mainStack = buildSections(main, mainW);
    const cols = right ? [{ width: mainW, stack: mainStack }, { width: sideW, stack: sideStack }] : [{ width: sideW, stack: sideStack }, { width: mainW, stack: mainStack }];
    content.push({ columns: cols, columnGap: colGap, margin: [0, hasHeader ? gap : 0, 0, 0] });
  } else {
    content = content.concat(buildSections(ir.sections, cw));
  }

  const dd = {
    pageSize: { width: pg.pt[0], height: pg.pt[1] }, pageMargins: [m, m, m, m],
    info: { title: (H.name || 'Resume') + ' – Resume', author: H.name || '', creator: 'Resumate', subject: resume.meta.jobTitle || '' },
    defaultStyle: { font: fontName, fontSize: fs, lineHeight: L.lineHeight, color: INK },
    content,
  };
  const blob = await new Promise((res, rej) => { try { pdfMake.createPdf(dd).getBlob(res); } catch (e) { rej(e); } });
  return { blob, note: fontSwitched ? 'PDF uses embedded Roboto for reliable rendering across devices. Your selected font is still used in preview and DOCX exports.' : '' };
}
