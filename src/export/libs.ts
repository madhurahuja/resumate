/* Heavy libraries are loaded on first use so the app starts fast. */
export async function loadPdfMake(): Promise<any> {
  const [pm, vfsSource]: any[] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts.js?raw')]);
  const pdfMake = pm.default ?? pm;
  if (!pdfMake.vfs) {
    /* vfs_fonts.js is a classic script that assigns to `this.pdfMake.vfs`; run it against a scratch object. */
    const holder: any = {};
    new Function(vfsSource.default).call(holder);
    pdfMake.vfs = holder.pdfMake.vfs;
  }
  return pdfMake;
}
export async function loadDocx(): Promise<any> { return import('docx'); }
export async function loadMammoth(): Promise<any> { const m: any = await import('mammoth/mammoth.browser'); return m.default ?? m; }
export async function loadJsZip(): Promise<any> { const m: any = await import('jszip'); return m.default ?? m; }
let pdfjs: any;
export async function loadPdfJs(): Promise<any> {
  if (pdfjs) return pdfjs;
  const lib: any = await import('pdfjs-dist/build/pdf.js');
  const worker: any = await import('pdfjs-dist/build/pdf.worker.min.js?url');
  pdfjs = lib.default ?? lib;
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}
