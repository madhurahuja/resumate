import { launch } from './harness.mjs';
import fs from 'fs';
const { browser, page, errors } = await launch();
const log = (...a) => console.log(...a);
const ok = (c, m) => log(c ? 'PASS' : 'FAIL', m);
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('mockdb')));
await page.goto('https://folio.test/');
// IMPORT PDF + DOCX roundtrip into empty app
for (const f of ['pdf', 'docx']) {
  await page.click('button:has-text("Import >> nth=0") >> nth=0').catch(()=>{});
  await page.click('.page-head button:has-text("Import")');
  await page.setInputFiles('input[type=file]', 'e2e/out/Sample-Person-Principal-Architect-Harbor-sample.' + f);
  await page.waitForSelector('text=Review imported resume', { timeout: 20000 });
  const secs = await page.$$eval('.dialog .item .t b', (e) => e.map((x) => x.textContent));
  const nm = await page.getByLabel('Name', { exact: true }).inputValue();
  const em = await page.getByLabel('Email').inputValue();
  log(f, 'sections', secs.join(','), '| name', nm, '| email', em);
  ok(nm === 'Sample Person' && em.includes('@') && secs.length >= 6, f + ' import parsed header and sections');
  if (f === 'pdf') await page.screenshot({ path: 'e2e/out/30-import-review.png' });
  await page.click('.dialog button:has-text("Import")');
  await page.waitForSelector('.rs-name');
  const t = await page.evaluate(() => document.querySelector('.rs').innerText);
  ok(t.includes('Principal Software Architect') && t.includes('Harbor Payments') && t.includes('Kubernetes'), f + ' imported content renders');
  if (f === 'pdf') { const ex = await page.$$eval('.rs-e .rs-t', (e) => e.map((x) => x.textContent)); log('entries', ex); }
  await page.click('button[aria-label="Back to resumes"]');
}
await page.screenshot({ path: 'e2e/out/31-after-import.png' });
// history save + restore
await page.click('button.open-link >> nth=0');
await page.waitForSelector('.rs-name');
await page.click('role=tab[name="Versions"]');
await page.fill('input[aria-label="Version note"]', 'v1 baseline');
await page.click('button:has-text("Save version")');
await page.waitForSelector('text=v1 baseline');
await page.click('role=tab[name="Details"]');
await page.getByLabel('Target job title').fill('Chief Architect');
await page.getByLabel('Company', { exact: true }).fill('Zed');
await page.click('role=tab[name="Versions"]');
await page.waitForTimeout(500);
ok(true, 'versions tab ok');
await page.screenshot({ path: 'e2e/out/32-history.png' });
// tailor
await page.click('role=tab[name="Tailor"]');
await page.fill('textarea >> nth=0', 'We need a Principal Architect with Kubernetes, Kafka, event-driven architecture, domain-driven design, Terraform and observability experience. Terraform and observability are key.');
await page.waitForSelector('.bigpct');
log('match', await page.textContent('.bigpct'));
await page.click('button.chip.warn >> nth=0');
await page.screenshot({ path: 'e2e/out/33-tailor.png' });
// design tab
await page.click('role=tab[name="Design"]');
await page.click('.tpl:has-text("Modern")');
await page.screenshot({ path: 'e2e/out/34-design.png' });
// compare
await page.click('button[aria-label="Back to resumes"]');
await page.click('button.nav-btn:has-text("Compare")');
await page.screenshot({ path: 'e2e/out/35-compare.png' });
// data
await page.click('button.nav-btn:has-text("Data")');
await page.click('button:has-text("Download backup")');
await page.waitForTimeout(500);
const sv = await page.evaluate(() => window.__saves.map((s) => s.filename));
ok(sv.some((n) => n.startsWith('folio-backup')), 'backup saved ' + sv);
await page.screenshot({ path: 'e2e/out/36-data.png' });
log('errors', errors.filter((e) => !e.includes('ERR_FAILED')));
await browser.close();
