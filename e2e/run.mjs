/* Runs every browser journey against the production build in dist/ (run `npm run build` first). */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const order = ['t0', 't1', 't2', 't3', 't4', 't6', 't7', 't10'];
let failed = 0;
for (const t of order) {
  const r = spawnSync('node', [path.join(dir, `${t}.mjs`)], { encoding: 'utf8', timeout: 180000 });
  const out = (r.stdout || '') + (r.stderr || '');
  const fails = out.split('\n').filter((l) => /^FAIL/.test(l));
  const errs = /errors \[\s*'/.test(out) || /pageerror/.test(out);
  const ok = r.status === 0 && !fails.length && !errs;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${t}`);
  if (!ok) { failed++; console.log(out.split('\n').slice(-15).join('\n')); }
}
process.exit(failed ? 1 : 0);
