import { launch } from './harness.mjs';
import fs from 'fs';
const { browser, page, errors } = await launch();
const log = (...a) => console.log(...a);
const ok = (c, m) => log(c ? 'PASS' : 'FAIL', m);
await page.goto('https://folio.test/');
await page.click('text=Try with sample data');
await page.waitForSelector('text=Principal Architect – Harbor (sample)');
await page.screenshot({ path: 'e2e/out/01-dashboard.png' });
const db = () => page.evaluate(() => JSON.parse(localStorage.getItem('mockdb')));
await page.waitForTimeout(1200);
let d = await db();
const resKeys = Object.keys(d).filter((k) => k.startsWith('resumes/'));
ok(resKeys.length === 2, 'two resumes persisted: ' + resKeys.length);
ok(!!d['profile/master'], 'master persisted');
// open first resume
await page.click('button.open-link >> text=Principal Architect – Harbor (sample)');
await page.waitForSelector('.rs-name');
await page.screenshot({ path: 'e2e/out/02-editor.png' });
ok((await page.textContent('.rs-name')) === 'Sample Person', 'preview shows name');
// edit: override headline in this resume via Content > Personal details
await page.click('text=Personal details >> nth=1').catch(()=>{});
await page.screenshot({ path: 'e2e/out/03-editor-open.png' });
await browser.close();
log('errors', errors.filter(e=>!e.includes('ERR_FAILED')));
