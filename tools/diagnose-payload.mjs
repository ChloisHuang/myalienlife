#!/usr/bin/env node
// Characterises what the incremental payload actually contains: how many of the
// patch operations are the SAME fields changing again and again, versus one-off
// changes. This decides whether raising the push rate costs proportionally more
// bandwidth (same op set re-sent more often) or not.
//
// Usage: node tools/diagnose-payload.mjs [url] [messages]
import { chromium } from '@playwright/test';

const url = process.argv[2] || 'https://www.doudouai.net:6443';
const want = Number(process.argv[3] || 12);

const browser = await chromium.launch({
  channel: process.env.PROFILE_CHANNEL || 'msedge',
  headless: false,
  args: ['--enable-gpu', '--ignore-certificate-errors', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();

await page.addInitScript(() => {
  window.__p = [];
  const O = globalThis.WebSocket;
  function W(...a) {
    const w = new O(...a);
    w.addEventListener('message', e => {
      if (window.__p.length >= 40) return;
      try {
        const v = JSON.parse(e.data);
        if (!v.patch) return;
        const ops = v.patch.map(o => o.path);
        const field = p => p.replace(/\/\d+/g, '/N');
        window.__p.push({
          bytes: e.data.length,
          t: performance.now(),
          ops: ops.length,
          families: ops.map(field),
          numeric: v.patch.filter(o => typeof o.value === 'number').map(o => {
            const s = String(o.value);
            return s.includes('.') ? s.split('.')[1].length : 0;
          }),
        });
      } catch {}
    });
    return w;
  }
  W.prototype = O.prototype;
  Object.assign(W, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  globalThis.WebSocket = W;
});

try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); }
catch (e) { console.log(`goto aborted (continuing)`); }

process.stdout.write('waiting for the world');
const t0 = Date.now();
for (;;) {
  const w = await page.evaluate(() => { const c = document.querySelector('canvas'); return c ? c.width : 0; });
  if (w > 400) break;
  if ((Date.now() - t0) / 1000 > 90) { console.log(' never became real'); await browser.close(); process.exit(1); }
  process.stdout.write('.');
  await page.waitForTimeout(1000);
}
console.log(' ready\n');

const t1 = Date.now();
while ((Date.now() - t1) / 1000 < 20 && (await page.evaluate(() => window.__p.length)) < want) await page.waitForTimeout(500);
const msgs = await page.evaluate(() => window.__p.slice(0, 12));
await browser.close();

if (msgs.length < 3) { console.log('not enough patches captured'); process.exit(1); }

const intervals = [];
for (let i = 1; i < msgs.length; i++) intervals.push(msgs[i].t - msgs[i - 1].t);
const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
console.log(`captured ${msgs.length} patches, mean interval ${mean.toFixed(0)}ms\n`);
console.log('  #   bytes   ops   ops-in-common-with-previous');
const prev = new Set();
let commonSum = 0, commonN = 0;
for (let i = 0; i < msgs.length; i++) {
  const cur = new Set(msgs[i].families);
  let common = 0;
  for (const f of cur) if (prev.has(f)) common++;
  if (i) { commonSum += common / cur.size; commonN++; }
  console.log(`  ${String(i).padStart(2)}  ${String(Math.round(msgs[i].bytes / 1024)).padStart(4)}KB  ${String(msgs[i].ops).padStart(4)}   ${i ? `${common}/${cur.size} (${(common / cur.size * 100).toFixed(0)}%)` : '-'}`);
  prev.clear(); for (const f of cur) prev.add(f);
}
console.log(`\nmean overlap with the previous patch: ${(commonSum / commonN * 100).toFixed(0)}%`);

// which field families dominate
const counts = new Map();
for (const m of msgs) for (const f of m.families) counts.set(f, (counts.get(f) || 0) + 1);
const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
console.log('\nmost frequent changed fields (across the capture):');
for (const [f, c] of top) console.log(`   ${String(c).padStart(3)}x  ${f}`);

// float precision
const dec = msgs.flatMap(m => m.numeric).filter(d => d > 0);
const avgDec = dec.reduce((a, b) => a + b, 0) / Math.max(1, dec.length);
console.log(`\nnumeric values sent: ${dec.length}, mean ${avgDec.toFixed(1)} decimal places`);
const oversized = dec.filter(d => d > 4).length;
console.log(`   with >4 decimals (pure waste for a 200ms tick): ${oversized} = ${(oversized / Math.max(1, dec.length) * 100).toFixed(0)}%`);

const bytesPerSec = msgs.reduce((a, m) => a + m.bytes, 0) / (intervals.reduce((a, b) => a + b, 0) / 1000);
console.log(`\ncurrent: ${Math.round(bytesPerSec / 1024)} KB/s at ${(1000 / mean).toFixed(1)} Hz`);
console.log(`if the op set is stable, doubling the push rate roughly doubles KB/s (same fields re-sent twice as often),`);
console.log(`unless the float precision is trimmed first.`);
