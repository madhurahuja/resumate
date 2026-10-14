import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
/* Where to find a Chromium. Override with CHROMIUM_PATH; otherwise Playwright's own lookup is used. */
const EXECUTABLE = process.env.CHROMIUM_PATH || undefined;

export const MOCK = `
(() => {
  const KEY = 'mockdb';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const save = (d) => localStorage.setItem(KEY, JSON.stringify(d));
  const listeners = [];
  const snap = (path, data) => ({ id: path.split('/').pop(), exists: data !== undefined, data: () => data === undefined ? undefined : JSON.parse(JSON.stringify(data)), metadata: { fromCache: false, hasPendingWrites: false } });
  const mk = () => ({
    doc(path) { return {
      id: path.split('/').pop(), path,
      async get() { return snap(path, load()[path]); },
      async set(data) { const d = load(); if (JSON.stringify(data).length > 262144) throw { code: 'invalid_argument', message: 'too big' }; d[path] = JSON.parse(JSON.stringify(data)); save(d); },
      async update(data) { const d = load(); d[path] = { ...d[path], ...data }; save(d); },
      async delete() { const d = load(); delete d[path]; save(d); },
      onSnapshot() { return () => {}; },
    }; },
    collection(coll) {
      const q = (filters) => ({
        where(f, op, v) { return q([...filters, [f, op, v]]); },
        orderBy() { return q(filters); }, limit() { return q(filters); },
        async get() { const d = load(); const docs = Object.keys(d).filter((k) => k.startsWith(coll + '/') && k.split('/').length === coll.split('/').length + 1).filter((k) => filters.every(([f, op, v]) => op === '==' ? d[k][f] === v : true)).map((k) => snap(k, d[k])); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: {} }; },
        onSnapshot() { return () => {}; },
      });
      return { ...q([]), path: coll, doc: (id) => mk().doc(coll + '/' + id), async add(data) { const id = Math.random().toString(36).slice(2); await mk().doc(coll + '/' + id).set(data); return mk().doc(coll + '/' + id); } };
    },
  });
  window.__saves = [];
  window.claude = { async use(n) {
    if (n === 'db') return mk();
    if (n === 'downloads') return { async save({ filename, data }) {
      const buf = data instanceof Blob ? await data.arrayBuffer() : new TextEncoder().encode(String(data)).buffer;
      let bin = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 8192) bin += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
      window.__saves.push({ filename, b64: btoa(bin) }); return { status: 'saved' };
    } };
    return null;
  } };
})();
`;
export async function launch({ width = 1360, height = 860, mock = true } = {}) {
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width, height }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|fonts\.g/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  /* Serve the production build from dist/ at https://folio.test/ (no server needed). */
  await page.route('https://folio.test/**', (route) => {
    const p = new URL(route.request().url()).pathname;
    const file = path.join(DIST, p === '/' ? 'index.html' : p);
    if (!file.startsWith(DIST) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  if (mock) await page.addInitScript(MOCK);
  return { browser, ctx, page, errors };
}
