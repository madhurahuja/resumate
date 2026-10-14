import { launch } from './harness.mjs';
import fs from 'fs';
const { browser, page, errors } = await launch();
const log = (...a) => console.log(...a);
await page.goto('https://folio.test/');
await page.click('text=Try with sample data');
await page.waitForSelector('button.open-link');
await page.click('article:has-text("Principal Architect – Harbor") button.open-link');
await page.waitForSelector('.rs-name');
for (const [kind, label] of [['pdf', 'PDF'], ['docx', 'Word (.docx)'], ['txt', 'Plain text'], ['md', 'Markdown'], ['html', 'Web page (.html)'], ['json', 'JSON']]) {
  await page.click('button:has-text("Export")');
  await page.click(`role=menuitem[name="${label}"]`);
  await page.waitForSelector('.dialog ul[aria-label="Validation results"]', { timeout: 25000 });
  const checks = await page.$$eval('.dialog ul[aria-label="Validation results"] li', (els) => els.map((e) => e.innerText.replace(/\n/g, ' ')));
  log(kind.toUpperCase(), JSON.stringify(checks));
  if (kind === 'pdf') await page.screenshot({ path: 'e2e/out/20-export-pdf.png' });
  await page.click('.dialog button:has-text("Save file")');
  await page.waitForSelector('.dialog:has-text("Saved.")', { timeout: 5000 });
  await page.keyboard.press('Escape');
}
const saves = await page.evaluate(() => window.__saves);
for (const s of saves) { fs.writeFileSync('e2e/out/' + s.filename, Buffer.from(s.b64, 'base64')); log('saved', s.filename, Buffer.from(s.b64, 'base64').length); }
log('errors', errors.filter((e) => !e.includes('ERR_FAILED')));
await browser.close();
