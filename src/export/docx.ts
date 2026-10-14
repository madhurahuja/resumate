import { FONTS, PAGES } from '../core/constants';
import { shortUrl } from '../core/ir';
import { layoutEntry, resolveTemplateStyle } from '../ui/sheet';
import { loadDocx } from './libs';
import { clean } from './pdf';

/* ---------- DOCX ---------- */
export async function buildDocx(ir, resume) {
  const D = await loadDocx();
  const L = resume.layout; const T = resolveTemplateStyle(resume); const pg = PAGES[L.pageSize] || PAGES.letter;
  const font = (FONTS[L.font] || FONTS.roboto).docx; const hex = (c) => c.replace('#', '').toUpperCase();
  const size = Math.round(L.fontSize * 2); const marg = Math.round(L.margin * 1440); const cw = pg.tw[0] - 2 * marg;
  const line = Math.round(L.lineHeight * 240); const gapTw = Math.round(L.sectionGap * 20);
  const INK = '111111'; const ACC = hex(L.accent);
  const H = ir.header; const children = [];
  const TR = (text, o?) => new D.TextRun({ text: clean(text), font, size: (o && o.size) || size, bold: o && o.bold, italics: o && o.italic, color: (o && o.color) || INK, allCaps: o && o.caps, characterSpacing: o && o.spacing });
  const runs = (rs) => rs.filter((r) => r.text).map((r) => TR(r.text, { bold: r.bold, italic: r.italic }));
  const al = T.headerAlign === 'center' ? D.AlignmentType.CENTER : D.AlignmentType.LEFT;
  if (H.name) children.push(new D.Paragraph({ style: 'Title', alignment: al, children: [TR(H.name, { bold: true, size: Math.round(size * T.nameSize), color: T.nameColor === 'accent' ? ACC : INK })] }));
  if (H.headline) children.push(new D.Paragraph({ alignment: al, spacing: { before: 20 }, children: [TR(H.headline, { size: Math.round(size * 1.05) })] }));
  const contact = [...H.contacts, ...H.links.map((l) => shortUrl(l.url))].join('  |  ');
  if (contact) children.push(new D.Paragraph({ alignment: al, spacing: { before: 60 }, children: [TR(contact, { size: Math.round(size * 0.95) })] }));
  const bulletP = (b) => new D.Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { before: 10, after: 10 }, children: [TR(b)] });
  const borderOf = T.head.rule === 'none' ? undefined : { bottom: { style: D.BorderStyle.SINGLE, size: T.head.rule === 'accent' ? 8 : 6, color: T.head.rule === 'accent' ? ACC : T.head.rule === 'grey' ? 'B5B5B5' : INK, space: 1 } };

  const buildChildren = (sections) => {
    const out = [];
    sections.forEach((s) => {
      out.push(new D.Paragraph({ heading: D.HeadingLevel.HEADING_1, keepNext: true, spacing: { before: gapTw, after: 60 }, border: borderOf, children: [TR(s.title, { bold: true, caps: T.head.upper, color: T.head.color === 'accent' ? ACC : INK, spacing: Math.round(T.head.track * L.fontSize * 20) })] }));
      if (s.display === 'inline') { out.push(new D.Paragraph({ children: [TR(s.entries.map((e) => e.title + (e.subtitle ? ' (' + e.subtitle + ')' : '')).join('  •  '))] })); return; }
      if (s.display === 'text') { s.entries.forEach((e) => out.push(new D.Paragraph({ spacing: { after: 40 }, children: [TR(e.text || e.title)] }))); return; }
      s.entries.forEach((e, ei) => {
        const em = layoutEntry(s, e); const hasBody = em.text || em.bullets.length;
        const rowP = (leftRuns, right, opts) => new D.Paragraph({ keepNext: !!opts.keepNext, keepLines: true, spacing: { before: opts.before || 0 }, tabStops: right ? [{ type: D.TabStopType.RIGHT, position: cw }] : [], children: [...leftRuns, ...(right ? [new D.TextRun({ children: [new D.Tab(), clean(right)], font, size, color: INK })] : [])] });
        const hasTop = em.left.some((x) => x.text) || em.right;
        if (hasTop) out.push(rowP(runs(em.left), em.right, { keepNext: !!(em.sub || hasBody), before: ei === 0 ? 0 : 100 }));
        if (em.sub) out.push(rowP([TR(em.sub.left, { italic: true })], em.sub.right, { keepNext: !!hasBody }));
        if (em.text) out.push(new D.Paragraph({ keepNext: !!em.bullets.length, spacing: { before: 30 }, children: [TR(em.text)] }));
        em.bullets.forEach((b) => out.push(bulletP(b)));
        em.lines.forEach((ln) => out.push(new D.Paragraph({ spacing: { before: 30 }, children: runs(ln) })));
      });
    });
    if (!out.length) out.push(new D.Paragraph({ children: [TR('')] }));
    return out;
  };

  const twoCol = Number(L.columns) === 2;
  if (twoCol) {
    const sideWTw = Math.round((L.sidebarWidth || 2.3) * 1440); const mainWTw = cw - sideWTw;
    const side = ir.sections.filter((s) => s.col === 'side'); const main = ir.sections.filter((s) => s.col !== 'side');
    const right = L.sidebarSide === 'right';
    const NB = { style: D.BorderStyle.NONE, size: 0, color: 'FFFFFF' }; const cellNoBorders = { top: NB, bottom: NB, left: NB, right: NB };
    const cell = (secs, widthTw, gapRight) => new D.TableCell({
      width: { size: widthTw, type: D.WidthType.DXA }, borders: cellNoBorders, verticalAlign: D.VerticalAlign.TOP,
      margins: gapRight ? { right: 200 } : { left: 200 }, children: buildChildren(secs),
    });
    const cells = right ? [cell(main, mainWTw, true), cell(side, sideWTw, false)] : [cell(side, sideWTw, true), cell(main, mainWTw, false)];
    const colWidths = right ? [mainWTw, sideWTw] : [sideWTw, mainWTw];
    children.push(new D.Table({ width: { size: cw, type: D.WidthType.DXA }, columnWidths: colWidths, borders: D.TableBorders.NONE, rows: [new D.TableRow({ children: cells })] }));
  } else {
    children.push(...buildChildren(ir.sections));
  }

  if (!children.length) children.push(new D.Paragraph({ children: [TR('')] }));
  const doc = new D.Document({
    creator: H.name || 'Resumate', title: (H.name || 'Resume') + ' – Resume', description: resume.meta.jobTitle || '',
    styles: {
      default: { document: { run: { font, size, color: INK }, paragraph: { spacing: { line, lineRule: D.LineRuleType.AUTO, after: 0 } } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font, size, bold: true }, paragraph: { spacing: { before: gapTw, after: 60 }, outlineLevel: 0 } },
        { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font, size: Math.round(size * T.nameSize), bold: true }, paragraph: { spacing: { after: 0 } } },
      ],
    },
    numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: D.LevelFormat.BULLET, text: '•', alignment: D.AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }] },
    sections: [{ properties: { page: { size: { width: pg.tw[0], height: pg.tw[1] }, margin: { top: marg, right: marg, bottom: marg, left: marg } } }, children }],
  });
  return { blob: await D.Packer.toBlob(doc), note: '' };
}
