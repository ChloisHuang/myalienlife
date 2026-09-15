#!/usr/bin/env node
// Watches startup on the live site: console output, page errors, whether the
// WebGL canvas ever gets a real backing store, and DOM growth over time.
// Usage: node tools/diagnose-startup.mjs [url] [seconds]
import { chromium } from '@playwright/test';

const url = process.argv[2] || 'https://www.doudouai.net:6443';
const seconds = Number(process.argv[3] || 60);

const browser = await chromium.launch({
  channel: process.env.PROFILE_CHANNEL || 'msedge',
  headless: false,
  args: ['--enable-gpu', '--ignore-certificate-errors', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();

const logs = [];
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`); });
page.on('requestfailed', r => logs.push(`[reqfail] ${r.url().replace(url, '')} ${r.failure()?.errorText}`));

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
} catch (e) {
  console.log(`goto aborted: ${e.message.split('\n')[0]}  (continuing to observe)`);
}
console.log(`watching ${seconds}s...\n`);
const t0 = Date.now();
let last = '';
for (let i = 0; i < Math.ceil(seconds / 5); i++) {
  await page.waitForTimeout(5000);
  const s = await page.evaluate(() => {
    const cs = [...document.querySelectorAll('canvas')];
    const main = cs[0];
    return {
      dom: document.getElementsByTagName('*').length,
      canvas: main ? `${main.width}x${main.height}` : 'none',
      css: main ? `${main.clientWidth}x${main.clientHeight}` : '-',
      canvases: cs.length,
    };
  });
  const line = `  +${String(Math.round((Date.now() - t0) / 1000)).padStart(2)}s  dom=${String(s.dom).padStart(4)}  canvas=${s.canvas.padEnd(9)} css=${s.css.padEnd(9)} canvases=${s.canvases}`;
  if (line !== last) { console.log(line); last = line; }
}

console.log(`\nconsole / errors (${logs.length}):`);
if (!logs.length) console.log('   none');
for (const l of [...new Set(logs)].slice(0, 25)) console.log('   ' + l);

await browser.close();
