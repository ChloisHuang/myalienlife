#!/usr/bin/env node
// Proves whether WS delivery is batched by main-thread occupancy.
//
// For every message arrival we look at where it sits relative to rAF frame
// boundaries. If the main thread is the bottleneck, arrivals pile up right
// after a frame finishes (the task queue drains at frame boundaries) instead of
// spreading evenly at the server's fixed 200ms push cadence.
//
// Usage: node tools/diagnose-batching.mjs [url] [warmupSeconds] [sampleSeconds]
import { chromium } from '@playwright/test';

const url = process.argv[2] || 'https://www.doudouai.net:6443';
const warmup = Number(process.argv[3] || 30);
const sampleSeconds = Number(process.argv[4] || 40);

const browser = await chromium.launch({
  channel: process.env.PROFILE_CHANNEL || 'msedge',
  headless: false,
  args: ['--enable-gpu', '--ignore-certificate-errors', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();

await page.addInitScript(() => {
  window.__x = { msgs: [], raf: [] };
  requestAnimationFrame(function f(ts) { window.__x.raf.push(ts); requestAnimationFrame(f); });
  const O = globalThis.WebSocket;
  function W(...a) {
    const w = new O(...a);
    w.addEventListener('message', () => window.__x.msgs.push(performance.now()));
    return w;
  }
  W.prototype = O.prototype;
  Object.assign(W, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  globalThis.WebSocket = W;
});

await page.goto(url, { waitUntil: 'load', timeout: 60000 });
console.log(`warming up ${warmup}s...`);
await page.waitForTimeout(warmup * 1000);
await page.evaluate(() => { window.__x.msgs.length = 0; window.__x.raf.length = 0; });
await page.waitForTimeout(sampleSeconds * 1000);
const x = await page.evaluate(() => window.__x);

const raf = x.raf, msgs = x.msgs;
if (msgs.length < 10 || raf.length < 10) { console.log('not enough samples'); await browser.close(); process.exit(0); }

// time from the last frame boundary to each arrival
let ri = 0;
const sinceFrame = [];
for (const m of msgs) {
  while (ri + 1 < raf.length && raf[ri + 1] <= m) ri++;
  sinceFrame.push(m - raf[ri]);
}
const sf = [...sinceFrame].sort((a, b) => a - b);
const q = p => sf[Math.min(sf.length - 1, Math.ceil(sf.length * p) - 1)];
const near = sinceFrame.filter(d => d < 5).length;

// inter-arrival distribution
const iv = [];
for (let i = 1; i < msgs.length; i++) iv.push(msgs[i] - msgs[i - 1]);
const ivs = [...iv].sort((a, b) => a - b);
const qi = p => ivs[Math.min(ivs.length - 1, Math.ceil(ivs.length * p) - 1)];
const veryClose = iv.filter(d => d < 30).length;

// rAF gap stats
const gaps = [];
for (let i = 1; i < raf.length; i++) gaps.push(raf[i] - raf[i - 1]);
const gs = [...gaps].sort((a, b) => a - b);
const qg = p => gs[Math.min(gs.length - 1, Math.ceil(gs.length * p) - 1)];

console.log(`\nwindow ${sampleSeconds}s   messages ${msgs.length} (${(msgs.length / sampleSeconds).toFixed(1)}/s)   frames ${raf.length} (${(raf.length / sampleSeconds).toFixed(1)}/s)`);
console.log(`\nserver pushes on a fixed 200ms timer, so arrivals should sit near 200ms apart.`);
console.log(`observed inter-arrival: mean ${(iv.reduce((a, b) => a + b, 0) / iv.length).toFixed(0)}ms  p50 ${qi(.5).toFixed(0)}ms  p95 ${qi(.95).toFixed(0)}ms  max ${ivs.at(-1).toFixed(0)}ms`);
console.log(`arrivals within 30ms of the previous one (same task-queue drain): ${veryClose} of ${iv.length} = ${(veryClose / iv.length * 100).toFixed(0)}%`);

console.log(`\nframe timing: p50 ${qg(.5).toFixed(0)}ms  p95 ${qg(.95).toFixed(0)}ms  max ${gs.at(-1).toFixed(0)}ms`);
console.log(`\nwhere each arrival sits relative to the last frame boundary:`);
console.log(`   p50 ${q(.5).toFixed(1)}ms  p90 ${q(.9).toFixed(1)}ms  p99 ${q(.99).toFixed(1)}ms`);
console.log(`   arrivals within 5ms of a frame boundary: ${near} of ${msgs.length} = ${(near / msgs.length * 100).toFixed(0)}%`);

const verdict = (near / msgs.length) > 0.4 || (veryClose / iv.length) > 0.3;
console.log(`\n=> ${verdict
  ? 'BATCHED: deliveries cluster at frame boundaries, so the main thread (not the network) sets when remote data is applied.'
  : 'spread out: no strong sign of main-thread batching in this run.'}`);

await browser.close();
