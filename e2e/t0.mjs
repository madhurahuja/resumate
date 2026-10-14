import { launch } from './harness.mjs';
const { browser, page, errors } = await launch();
await page.goto('https://folio.test/');
await page.waitForSelector('text=Start with one master profile', { timeout: 8000 });
await page.screenshot({ path: 'e2e/out/00-welcome.png' });
console.log('errors', errors);
await browser.close();
