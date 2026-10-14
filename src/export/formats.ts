import { buildIR, irToText } from '../core/ir';
import { nowISO, slug, str } from '../core/util';
import { h, render } from '../ui/h';
import { ResumeSheet, SHEET_CSS, sheetStyle } from '../ui/sheet';
import { buildDocx } from './docx';
import { buildPdf } from './pdf';
import { validateExport } from './validate';

/* ---------- HTML / text / json ---------- */
export function buildHtmlDoc(ir, resume) {
  const host = document.createElement('div'); render(h(ResumeSheet as any, { ir, resume }), host);
  const { pg } = sheetStyle(resume);
  const doc = '<!doctype html><html lang="' + ir.lang + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(ir.header.name || 'Resume') + '</title><style>' + SHEET_CSS + 'body{margin:0;background:#e9ebef;padding:24px}.rs{margin:0 auto;box-shadow:0 2px 14px rgba(0,0,0,.2);max-width:100%}@media print{body{padding:0;background:#fff}.rs{box-shadow:none}@page{size:' + pg.w + 'in ' + pg.h + 'in;margin:0}}</style></head><body>' + host.innerHTML + '</body></html>';
  render(null, host);
  return new Blob([doc], { type: 'text/html' });
}
export const esc = (s) => str(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function buildJson(ir, resume) {
  const o = { format: 'resumate.resume', version: 1, exportedAt: nowISO(), name: resume.name, meta: resume.meta, header: ir.header, sections: ir.sections.map((s) => ({ kind: s.kind, title: s.title, display: s.display, entries: s.entries.map(({ id, ...rest }) => rest) })) };
  return new Blob([JSON.stringify(o, null, 2)], { type: 'application/json' });
}
export const EXPORTS = {
  pdf: { label: 'PDF', ext: 'pdf', desc: 'Text-based, ATS-friendly. Best for applications.' },
  docx: { label: 'Word (.docx)', ext: 'docx', desc: 'Editable. Real headings and bullets; supports every script.' },
  txt: { label: 'Plain text', ext: 'txt', desc: 'For web forms and parsers.' },
  md: { label: 'Markdown', ext: 'md', desc: 'For notes and developer portfolios.' },
  html: { label: 'Web page (.html)', ext: 'html', desc: 'Self-contained page with print styles.' },
  json: { label: 'JSON', ext: 'json', desc: 'Structured data; can be imported back.' },
};
export async function buildExport(kind, master, resume) {
  const ir = buildIR(master, resume);
  if (!ir.header.name && !ir.sections.length) throw new Error('This resume has no visible content yet.');
  let out;
  if (kind === 'pdf') out = await buildPdf(ir, resume);
  else if (kind === 'docx') out = await buildDocx(ir, resume);
  else if (kind === 'txt') out = { blob: new Blob([irToText(ir, false)], { type: 'text/plain' }), note: '' };
  else if (kind === 'md') out = { blob: new Blob([irToText(ir, true)], { type: 'text/markdown' }), note: '' };
  else if (kind === 'html') out = { blob: buildHtmlDoc(ir, resume), note: '' };
  else out = { blob: buildJson(ir, resume), note: '' };
  const filename = slug((ir.header.name || 'resume') + '-' + resume.name) + '.' + EXPORTS[kind].ext;
  const checks = await validateExport(kind, out.blob, ir);
  return { ...out, filename, checks, ir };
}
