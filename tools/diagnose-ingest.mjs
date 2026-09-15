#!/usr/bin/env node
// Measures the cost of INGESTING each incremental snapshot, on the live site.
//
// Per message the client does: JSON.parse(~26KB) -> fast-json-patch apply
// (~322 ops over a ~95KB state) -> structuredClone (in publish) -> and the
// renderer may structuredClone again in presentation.sample().
//
// Instruments structuredClone / JSON.parse, and times the whole message task.
// Waits for the WebGL canvas to become real (startup takes ~30-40s) first.
//
// Usage: node tools/diagnose-ingest.mjs [url] [seconds]
import { chromium } from '@playwright/test';

const url = process.argv[2] || 'https://www.doudouai.net:6443';
const seconds = Number(process.argv[3] || 30);

const browser = await chromium.launch({
  channel: process.env.PROFILE_CHANNEL || 'msedge',
  headless: false,
  args: ['--enable-gpu', '--ignore-certificate-errors', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();

await page.addInitScript(() => {
  const d = {
    sc: { n: 0, ms: 0, max: 0, over2: 0, samples: [] },
    parse: { n: 0, ms: 0, max: 0, sizes: [] },
    msgTasks: [], msgTasksWithFrame: [], raf: [], msgs: 0,
  };
  window.__ing = d;
  const origSC = globalThis.structuredClone;
  if (origSC) {
    globalThis.structuredClone = function (...a) {
      const t = performance.now();
      const r = origSC.apply(this, a);
      const e = performance.now() - t;
      d.sc.n++; d.sc.ms += e; d.sc.max = Math.max(d.sc.max, e); if (e > 2) d.sc.over2++;
      d.sc.samples.push(Math.round(e * 10) / 10);
      return r;
    };
  }
  const origParse = JSON.parse;
  JSON.parse = function (...a) {
    const t = performance.now();
    const r = origParse.apply(this, a);
    const e = performance.now() - t;
    d.parse.n++; d.parse.ms += e; d.parse.max = Math.max(d.parse.max, e);
    if (typeof a[0] === 'string') d.parse.sizes.push(Math.round(a[0].length / 1024));
    return r;
  };
  const O = globalThis.WebSocket;
  function W(...a) {
    const w = new O(...a);
    w.addEventListener('message', () => {
      d.msgs++;
      // queueMicrotask drains right after the whole message event dispatch
      // (all listeners), so this is the synchronous ingest cost only - a
      // setTimeout(0) would also swallow the next animation frame.
      const t0 = performance.now();
      queueMicrotask(() => d.msgTasks.push(performance.now() - t0));
      const t1 = performance.now();
      setTimeout(() => d.msgTasksWithFrame.push(performance.now() - t1), 0);
    });
    return w;
  }
  W.prototype = O.prototype;
  Object.assign(W, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  globalThis.WebSocket = W;
  let last = 0;
  requestAnimationFrame(function f(ts) { if (last) d.raf.push(ts - last); last = ts; requestAnimationFrame(f); });
});

try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); }
catch (e) { console.log(`goto aborted (continuing): ${e.message.split('\n')[0]}`); }

process.stdout.write('waiting for the 3D world to become real');
const t0 = Date.now();
for (;;) {
  const w = await page.evaluate(() => { const c = document.querySelector('canvas'); return c ? c.width : 0; });
  if (w > 400) break;
  if ((Date.now() - t0) / 1000 > 90) { console.log('\ncanvas never became real'); await browser.close(); process.exit(1); }
  process.stdout.write('.');
  await page.waitForTimeout(1000);
}
console.log(`\nready at +${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

await page.evaluate(() => {
  const d = window.__ing;
  d.sc = { n: 0, ms: 0, max: 0, over2: 0, samples: [] };
  d.parse = { n: 0, ms: 0, max: 0, sizes: [] };
  d.msgTasks = []; d.msgTasksWithFrame = []; d.raf = []; d.msgs = 0;
});
await page.waitForTimeout(seconds * 1000);
const d = await page.evaluate(() => window.__ing);

const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(s.length * p) - 1)] ?? 0; };
const sum = xs => xs.reduce((a, b) => a + b, 0);

console.log(`window ${seconds}s   ws messages ${d.msgs} (${(d.msgs / seconds).toFixed(1)}/s)`);
console.log(`\nstructuredClone (deep copy of the whole state):`);
console.log(`   calls ${d.sc.n} = ${(d.sc.n / seconds).toFixed(1)}/s   total ${d.sc.ms.toFixed(0)}ms = ${(d.sc.ms / seconds).toFixed(0)}ms/s of main thread`);
console.log(`   per call: p50 ${q(d.sc.samples, .5).toFixed(1)}ms  p95 ${q(d.sc.samples, .95).toFixed(1)}ms  max ${d.sc.max.toFixed(1)}ms   (calls >2ms: ${d.sc.over2})`);
console.log(`\nJSON.parse (the ws payload):`);
console.log(`   calls ${d.parse.n} = ${(d.parse.n / seconds).toFixed(1)}/s   total ${d.parse.ms.toFixed(0)}ms = ${(d.parse.ms / seconds).toFixed(0)}ms/s`);
console.log(`   per call p95 ${q(d.parse.samples ?? [], .95).toFixed(2)}ms  max ${d.parse.max.toFixed(2)}ms   payload p50 ${q(d.parse.sizes, .5)}KB`);
const closures = d.sc.n + d.parse.n;
console.log(`\nper-message synchronous ingest cost (parse + patch + clone + onState):`);
console.log(`   p50 ${q(d.msgTasks, .5).toFixed(2)}ms  p90 ${q(d.msgTasks, .9).toFixed(2)}ms  p99 ${q(d.msgTasks, .99).toFixed(2)}ms  max ${Math.max(0, ...d.msgTasks).toFixed(2)}ms`);
console.log(`   over one 16.7ms frame budget: ${d.msgTasks.filter(x => x > 16.7).length} of ${d.msgTasks.length}`);
const ingestMs = sum(d.msgTasks);
console.log(`   total ${ingestMs.toFixed(0)}ms over ${seconds}s = ${(ingestMs / seconds).toFixed(1)}ms/s of main thread`);
console.log(`\n(for contrast, the same measurement with setTimeout(0), which also swallows the next frame):`);
console.log(`   p50 ${q(d.msgTasksWithFrame, .5).toFixed(1)}ms  max ${Math.max(0, ...d.msgTasksWithFrame).toFixed(1)}ms  <- this is what I wrongly reported before`);
console.log(`\nframe gaps while this was happening:`);
console.log(`   p50 ${q(d.raf, .5).toFixed(1)}ms  p95 ${q(d.raf, .95).toFixed(1)}ms  max ${Math.max(0, ...d.raf).toFixed(1)}ms   frames >33ms: ${d.raf.filter(x => x > 33).length} of ${d.raf.length}`);

const cloneShare = d.sc.ms / (d.sc.ms + d.parse.ms) * 100;
console.log(`\n=> structuredClone accounts for ${cloneShare.toFixed(0)}% of the measured JSON/clone cost.`);
console.log(`=> ingest costs roughly ${((d.sc.ms + d.parse.ms) / seconds).toFixed(0)}ms of main thread per second, ${(d.msgs / seconds).toFixed(1)}x per second.`);

await browser.close();
