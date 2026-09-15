#!/usr/bin/env node
// Times the gap between page load and the WebGL canvas becoming real, then
// attributes it: resource timings, and how long the main thread sat idle
// afterwards (idle => CPU work, not the network).
// Usage: node tools/diagnose-startup-timing.mjs [url] [maxSeconds]
import { chromium } from '@playwright/test';

const url = process.argv[2] || 'https://www.doudouai.net:6443';
const maxSeconds = Number(process.argv[3] || 60);

const browser = await chromium.launch({
  channel: process.env.PROFILE_CHANNEL || 'msedge',
  headless: false,
  args: ['--enable-gpu', '--ignore-certificate-errors', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();

try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); }
catch (e) { console.log(`goto aborted (continuing): ${e.message.split('\n')[0]}`); }

const t0 = Date.now();
let readyAt = null;
while ((Date.now() - t0) / 1000 < maxSeconds) {
  const w = await page.evaluate(() => { const c = document.querySelector('canvas'); return c ? c.width : 0; });
  if (w > 400) { readyAt = (Date.now() - t0) / 1000; break; }
  await page.waitForTimeout(500);
}

console.log(readyAt === null
  ? `canvas never became real within ${maxSeconds}s`
  : `canvas became real at +${readyAt.toFixed(1)}s`);

const res = await page.evaluate(() => performance.getEntriesByType('resource').map(r => ({
  n: r.name.replace(location.origin, ''),
  start: Math.round(r.startTime),
  end: Math.round(r.responseEnd),
  dur: Math.round(r.duration),
  size: r.transferSize || 0,
  type: r.initiatorType,
})));

const slow = [...res].sort((a, b) => b.end - a.end).slice(0, 12);
console.log('\nlatest-finishing resources (start -> end, ms):');
for (const r of slow) console.log(`   ${String(r.start).padStart(6)} -> ${String(r.end).padStart(6)}  (${String(r.dur).padStart(5)}ms)  ${(r.size / 1024).toFixed(0).padStart(5)}KB  ${r.n.slice(0, 70)}`);

const early = [...res].sort((a, b) => a.start - b.start).slice(0, 14);
console.log('\nearliest-starting resources (the first 13s gap):');
for (const r of early) console.log(`   ${String(r.start).padStart(6)} -> ${String(r.end).padStart(6)}  (${String(r.dur).padStart(5)}ms)  ${(r.size / 1024).toFixed(0).padStart(5)}KB  ${r.n.slice(0, 70)}`);

// serialization check: does any request start before the previous one finished?
const byStart = [...res].filter(r => r.start > 0).sort((a, b) => a.start - b.start);
let serial = 0, parallel = 0;
for (let i = 1; i < byStart.length; i++) (byStart[i].start >= byStart[i - 1].end - 30 ? serial++ : parallel++);
console.log(`\nrequest ordering: ${serial} sequential, ${parallel} overlapping`);
const assets = res.filter(r => /\.(glb|webp|wasm)$/.test(r.n));
const assetBytes = assets.reduce((a, r) => a + r.size, 0);
console.log(`asset fetches: ${assets.length}  total ${(assetBytes / 1024 / 1024).toFixed(2)} MB  span ${Math.round((Math.max(...assets.map(r => r.end)) - Math.min(...assets.map(r => r.start))) / 1000)}s`);
console.log(`   => effective ${(assetBytes / 1024 / (Math.max(...assets.map(r => r.end)) - Math.min(...assets.map(r => r.start)))).toFixed(0)} KB/s across the asset phase`);

const lastEnd = Math.max(0, ...res.map(r => r.end));
console.log(`\nlast resource finished at +${(lastEnd / 1000).toFixed(1)}s`);
if (readyAt !== null) {
  const idle = readyAt * 1000 - lastEnd;
  console.log(`canvas became real at +${readyAt.toFixed(1)}s  =>  ${(idle / 1000).toFixed(1)}s elapsed AFTER the last byte arrived`);
  console.log(idle > 2000
    ? '   => the delay is NOT the network; it is client work after loading (decode/compile/generate).'
    : '   => the delay is dominated by asset transfer.');
}

await browser.close();
