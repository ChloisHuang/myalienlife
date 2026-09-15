#!/usr/bin/env node
// Attributes irregular snapshot delivery to either the client main thread or
// the network/server.
//
// For every arrival gap longer than 250ms we look at what the main thread was
// doing inside that gap:
//   - rAF stopped for about as long  => the message was queued behind a busy
//     main thread (client-side)
//   - rAF kept running normally      => the client was idle waiting, so the
//     delay came from the network or the server
//
// Usage: node tools/diagnose-delivery.mjs [url] [seconds]
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

await page.addInitScript(() => {
  window.__d = { msgs: [], raf: [] };
  const O = globalThis.WebSocket;
  function W(...a) {
    const w = new O(...a);
    w.addEventListener('message', () => window.__d.msgs.push(performance.now()));
    return w;
  }
  W.prototype = O.prototype;
  Object.assign(W, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  globalThis.WebSocket = W;
  requestAnimationFrame(function f(ts) { window.__d.raf.push(ts); requestAnimationFrame(f); });
});

try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); }
catch { }
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

await page.evaluate(() => { window.__d.msgs.length = 0; window.__d.raf.length = 0; });
await page.waitForTimeout(seconds * 1000);
const d = await page.evaluate(() => window.__d);

const { msgs, raf } = d;
const gaps = [];
for (let i = 1; i < msgs.length; i++) gaps.push({ gap: msgs[i] - msgs[i - 1], from: msgs[i - 1], to: msgs[i] });
const long = gaps.filter(g => g.gap > 250);

let client = 0, network = 0;
const rows = [];
for (const g of long) {
  const inWin = raf.filter(t => t >= g.from && t <= g.to);
  let maxRafGap = 0;
  for (let i = 1; i < inWin.length; i++) maxRafGap = Math.max(maxRafGap, inWin[i] - inWin[i - 1]);
  const blocked = maxRafGap > g.gap * 0.6;
  if (blocked) client++; else network++;
  rows.push({ ...g, frames: inWin.length, maxRafGap, blocked });
}
rows.sort((a, b) => b.gap - a.gap);

const sum = xs => xs.reduce((a, b) => a + b, 0);
console.log(`window ${seconds}s   messages ${msgs.length} (${(msgs.length / seconds).toFixed(2)}/s)   frames ${raf.length} (${(raf.length / seconds).toFixed(1)}/s)`);
const allGaps = gaps.map(g => g.gap);
const q = p => { const s = [...allGaps].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(s.length * p) - 1)]; };
console.log(`arrival gap: mean ${(sum(allGaps) / allGaps.length).toFixed(0)}ms  p50 ${q(.5).toFixed(0)}ms  p90 ${q(.9).toFixed(0)}ms  max ${Math.max(...allGaps).toFixed(0)}ms`);
console.log(`late gaps (>250ms): ${long.length} of ${gaps.length} = ${(long.length / gaps.length * 100).toFixed(0)}%   lost time ${(sum(long.map(g => g.gap - 200)) / 1000).toFixed(1)}s\n`);

console.log(`attribution of the ${long.length} late gaps:`);
console.log(`   main thread was blocked for most of the gap : ${client}  (${(client / Math.max(1, long.length) * 100).toFixed(0)}%)`);
console.log(`   main thread idle, waiting on the wire       : ${network}  (${(network / Math.max(1, long.length) * 100).toFixed(0)}%)`);

console.log(`\nworst 12 gaps:`);
console.log(`   gap(ms)  frames-in-gap  worst-frame-gap(ms)  verdict`);
for (const r of rows.slice(0, 12)) {
  console.log(`   ${r.gap.toFixed(0).padStart(6)}  ${String(r.frames).padStart(12)}  ${r.maxRafGap.toFixed(0).padStart(18)}  ${r.blocked ? 'CLIENT blocked' : 'wire/server'}`);
}

console.log(`\nframe cadence overall: ${raf.length} frames in ${seconds}s`);
const rafGaps = [];
for (let i = 1; i < raf.length; i++) rafGaps.push(raf[i] - raf[i - 1]);
const qr = p => { const s = [...rafGaps].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(s.length * p) - 1)]; };
console.log(`   frame gap p50 ${qr(.5).toFixed(1)}ms  p95 ${qr(.95).toFixed(1)}ms  p99 ${qr(.99).toFixed(1)}ms  max ${Math.max(...rafGaps).toFixed(1)}ms`);

await browser.close();
