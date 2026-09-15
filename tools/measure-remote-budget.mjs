#!/usr/bin/env node
// Breaks the remote-data budget into its parts, measured on one timeline:
//
//   1. snapshot staleness : how old is the newest snapshot's game time when it
//      lands in the browser (server push interval + transfer + apply)
//   2. render buffer      : the extra delay presentation.js adds on top
//   3. total              : what the 3D view is actually showing
//
// Extracts `minute` directly from each WS payload (patch op at /minute).
//
// Usage: node tools/measure-remote-budget.mjs [url] [warmupSeconds] [sampleSeconds]
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
  window.__b = { msgs: [] };
  const Orig = globalThis.WebSocket;
  function Patched(...a) {
    const ws = new Orig(...a);
    // `day` only changes once per 1440 game-minutes, so carry it forward.
    let carriedDay = null;
    ws.addEventListener('message', e => {
      const t = performance.now();
      let minute = null, kind = '?', bytes = (e.data || '').length, ops = 0;
      try {
        const v = JSON.parse(e.data);
        if (v.patch) {
          kind = 'patch'; ops = v.patch.length;
          const m = v.patch.find(o => o.path === '/minute');
          const d = v.patch.find(o => o.path === '/day');
          if (m) minute = m.value;
          if (d) carriedDay = d.value;
        } else if (v.state) {
          kind = 'full'; minute = v.state.minute; carriedDay = v.state.day;
        }
      } catch {}
      window.__b.msgs.push({ t, minute, day: carriedDay, kind, bytes, ops });
    });
    return ws;
  }
  Patched.prototype = Orig.prototype;
  Object.assign(Patched, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  globalThis.WebSocket = Patched;
});

await page.goto(url, { waitUntil: 'load', timeout: 60000 });
console.log(`warming up ${warmup}s...`);
await page.waitForTimeout(warmup * 1000);
await page.evaluate(() => { window.__b.msgs.length = 0; });

// Sample the server's authoritative clock in the page, on the same timeline.
await page.evaluate(async (secs) => {
  window.__b.server = [];
  const t0 = performance.now();
  while (performance.now() - t0 < secs * 1000) {
    const started = performance.now();
    try {
      const s = await fetch('/api/state', { cache: 'no-store', credentials: 'omit' }).then(r => r.json());
      // the payload reflects the server clock at roughly the midpoint of the round trip
      window.__b.server.push({ t: (started + performance.now()) / 2, total: (s.state.day - 1) * 1440 + s.state.minute });
    } catch {}
    await new Promise(r => setTimeout(r, 300));
  }
}, sampleSeconds);

const b = await page.evaluate(() => window.__b);
const msgs = b.msgs.filter(m => typeof m.minute === 'number' && typeof m.day === 'number');
const server = b.server || [];

if (msgs.length < 5 || server.length < 3) { console.log('not enough samples'); await browser.close(); process.exit(0); }

// game-min per real second, from the server trajectory
const rate = (server.at(-1).total - server[0].total) / ((server.at(-1).t - server[0].t) / 1000);

// 1. snapshot staleness: at each arrival, how far behind was the snapshot's
//    minute vs the server clock interpolated to that same instant?
const stales = [];
for (const m of msgs) {
  // bracket the arrival with the two nearest server samples
  let lo = null, hi = null;
  for (const s of server) { if (s.t <= m.t) lo = s; else { hi = s; break; } }
  if (!lo) continue;
  const serverAt = hi ? lo.total + (hi.total - lo.total) * ((m.t - lo.t) / (hi.t - lo.t)) : lo.total;
  const arrTotal = (m.day - 1) * 1440 + m.minute;
  stales.push({ ms: (serverAt - arrTotal) / rate * 1000, at: m.t });
}
stales.sort((a, b2) => a.ms - b2.ms);
const q = (arr, p) => arr[Math.min(arr.length - 1, Math.ceil(arr.length * p) - 1)] || 0;
const sArr = stales.map(s => s.ms);

// 2. render buffer: the OLD EWMA estimator vs the DEPLOYED median estimator
const intervals = [];
for (let i = 1; i < msgs.length; i++) intervals.push(msgs[i].t - msgs[i - 1].t);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const median = xs => { const s = [...xs].sort((a, b) => a - b), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
let gapOld = 250, win = [];
for (let i = 0; i < intervals.length; i++) {
  const v = intervals[i];
  if (v > 100) gapOld = i === 0 ? v : gapOld + (v - gapOld) * 0.2;
  if (v >= 1 && v <= 5000) { win.push(v); if (win.length > 24) win.shift(); }
}
const gapNew = win.length ? median(win) : 250;
const buffer = clamp(gapNew * 1.5, 250, 1500);
const bufferOld = clamp(gapOld * 1.5, 250, 1500);

const sInt = [...intervals].sort((a, b2) => a - b2);
const mean = intervals.reduce((a, b2) => a + b2, 0) / intervals.length;

console.log(`\nmeasured over ${sampleSeconds}s   game clock rate ${rate.toFixed(2)} game-min/s\n`);
console.log(`snapshot arrival: ${msgs.length} msgs (${(msgs.length / sampleSeconds).toFixed(1)}/s)`);
console.log(`   inter-arrival  mean ${mean.toFixed(0)}ms  p50 ${q(sInt, .5).toFixed(0)}ms  p95 ${q(sInt, .95).toFixed(0)}ms  max ${Math.max(...intervals).toFixed(0)}ms`);
console.log(`   payload        avg ${(msgs.reduce((a, m) => a + m.bytes, 0) / msgs.length / 1024).toFixed(1)}KB  ops avg ${(msgs.reduce((a, m) => a + m.ops, 0) / msgs.length).toFixed(0)}`);
console.log(`   -> ${(msgs.reduce((a, m) => a + m.bytes, 0) / sampleSeconds / 1024).toFixed(1)} KB/s downstream\n`);

console.log(`1. SNAPSHOT STALENESS when it lands in the browser (server sim -> client memory):`);
console.log(`   p50 ${q(sArr, .5).toFixed(0)}ms   p90 ${q(sArr, .9).toFixed(0)}ms   max ${sArr.at(-1).toFixed(0)}ms`);
console.log(`2. RENDER BUFFER added by presentation.js:`);
console.log(`   OLD ewma   estimator: gap ${gapOld.toFixed(0)}ms -> buffer ${bufferOld.toFixed(0)}ms`);
console.log(`   NEW median estimator: gap ${gapNew.toFixed(0)}ms -> buffer ${buffer.toFixed(0)}ms  (this is what is deployed)`);
console.log(`   TOTAL remote-data lag: p50 ~${(q(sArr, .5) + buffer).toFixed(0)}ms   worst ~${(sArr.at(-1) + buffer).toFixed(0)}ms`);

const theoretical = mean / 2 + 72; // avg half push interval + one-way network
console.log(`\n   theoretical floor (half push interval ${(mean / 2).toFixed(0)}ms + one-way ~72ms) = ~${theoretical.toFixed(0)}ms`);
console.log(`   excess over floor: ${(q(sArr, .5) - theoretical).toFixed(0)}ms`);

await browser.close();
