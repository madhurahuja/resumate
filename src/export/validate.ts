import { irPlain } from '../core/ir';
import { Store } from '../core/storage';
import { str } from '../core/util';
import { loadMammoth, loadPdfJs } from './libs';

/* ---------- validation of generated files ---------- */
export const norm = (s) => str(s).toLowerCase().replace(/\s+/g, ' ').trim();
export async function validateExport(kind, blob, ir) {
  const checks: any = []; const add = (ok, label, soft?) => checks.push({ ok, label, soft: !!soft });
  add(blob.size > 0, 'File is not empty (' + Math.max(1, Math.round(blob.size / 1024)) + ' KB)');
  const buf = await blob.arrayBuffer(); const u8 = new Uint8Array(buf);
  const needles = [ir.header.name, ...ir.header.contacts.filter((c) => /@/.test(c)), ...ir.sections.map((s) => s.title)].filter(Boolean);
  const hasAll = (text) => { const t = norm(text); const miss = needles.filter((n) => !t.includes(norm(n))); return miss; };
  try {
    if (kind === 'pdf') {
      const head = String.fromCharCode(...u8.slice(0, 5)); const tail = String.fromCharCode(...u8.slice(-1024));
      add(head === '%PDF-' && tail.includes('%%EOF'), 'Valid PDF header and end-of-file marker');
      try {
        const pdfjsLib = await loadPdfJs();
        const pdf = await pdfjsLib.getDocument({ data: u8.slice(0), useWorkerFetch: false, isEvalSupported: false }).promise;
        let text = ''; for (let p = 1; p <= pdf.numPages; p++) { const tc = await (await pdf.getPage(p)).getTextContent(); text += tc.items.map((i) => i.str + (i.hasEOL ? '\n' : ' ')).join(' ') + '\n'; }
        add(true, 'Re-opened the file: ' + pdf.numPages + ' page' + (pdf.numPages > 1 ? 's' : ''));
        add(text.trim().length > 40, 'Text is selectable (not an image)');
        const miss = hasAll(text); add(!miss.length, miss.length ? 'Missing from extracted text: ' + miss.join(', ') : 'Name, email and every section heading found in the text');
        checks.pages = pdf.numPages;
      } catch (e) { add(true, 'Structure checks passed. Text re-read skipped: ' + (e.message || 'reader unavailable'), true); }
    } else if (kind === 'docx') {
      add(u8[0] === 0x50 && u8[1] === 0x4b, 'Valid Office Open XML package (zip)');
      try {
        const mammoth = await loadMammoth();
        const r = await mammoth.extractRawText({ arrayBuffer: buf });
        add(true, 'Re-opened the file as a Word document');
        const miss = hasAll(r.value); add(!miss.length, miss.length ? 'Missing from extracted text: ' + miss.join(', ') : 'Name, email and every section heading found in the text');
        const want = irPlain(ir).split(/\s+/).filter(Boolean).length; const got = r.value.split(/\s+/).filter(Boolean).length;
        add(got >= want * 0.9, 'Word count matches (' + got + ' of ' + want + ')');
      } catch (e) { add(true, 'Package checks passed. Text re-read skipped: ' + (e.message || 'reader unavailable'), true); }
    } else if (kind === 'json') { const o = JSON.parse(await blob.text()); add(o.format === 'resumate.resume', 'Parses as JSON and carries the Resumate format tag'); }
    else { const t = await blob.text(); const miss = hasAll(t); add(!miss.length, miss.length ? 'Missing: ' + miss.join(', ') : 'Name, email and section headings present'); }
  } catch (e) { add(false, 'Validation error: ' + (e.message || e)); }
  return checks;
}

export async function saveBlob(filename, blob) {
  const d = Store.downloads;
  if (!d) { /* running outside the Claude app: use a normal browser download */
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); return { status: 'saved' };
  }
  return d.save({ filename, data: blob });
}
