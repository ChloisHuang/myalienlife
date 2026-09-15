#!/usr/bin/env node
// Measures, against the live site: first-load transfer bytes (by resource type),
// runtime WebSocket traffic, and steady-state FPS.
// Usage: node tools/measure-transfer.mjs [url] [runtimeSeconds]
import { chromium } from '@playwright/test';

const url = process.argv[2] || 'https://www.doudouai.net:6443';
const runtimeSeconds = Number(process.argv[3] || 15);

const fmt = n => n >= 1024 * 1024
  ? `${(n / 1024 / 1024).toFixed(2)} MB`
  : n >= 1024 ? `${(n / 1024).toFixed(0)} KB` : `${n} B`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });

// --- capture every finished request's encoded (on-the-wire) size ---
const requests = new Map();
const finished = [];
const cdp = await page.context().newCDPSession(page);
await cdp.send('Network.enable');
cdp.on('Network.requestWillBeSent', e => {
  requests.set(e.requestId, { url: e.request.url, type: e.type });
});
cdp.on('Network.loadingFinished', e => {
  const r = requests.get(e.requestId);
  if (r) finished.push({ ...r, bytes: e.encodedDataLength || 0 });
});

// --- capture WebSocket frames ---
const wsFrames = [];
cdp.on('Network.webSocketFrameReceived', e => {
  wsFrames.push({ t: Date.now(), len: (e.response?.payloadData || '').length });
});

const loadStart = Date.now();
await page.goto(url, { waitUntil: 'load', timeout: 60000 });
const loadMs = Date.now() - loadStart;

// Wait for the WebGL scene + save restore to settle before measuring runtime.
await page.waitForTimeout(8000);
const wsMark = wsFrames.length;

// --- measure FPS from real animation frames ---
const fps = await page.evaluate(async (seconds) => {
  const deltas = [];
  await new Promise(resolve => {
    let last = performance.now();
    const t0 = last;
    function tick(now) {
      deltas.push(now - last);
      last = now;
      if (now - t0 < seconds * 1000) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
  const sorted = [...deltas].sort((a, b) => a - b);
  const p = q => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)] || 0;
  const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  return {
    frames: deltas.length,
    avgFps: 1000 / avg,
    avgFrameMs: avg,
    p50: p(0.5), p95: p(0.95), p99: p(0.99),
    pctOver16_67: deltas.filter(d => d > 16.67).length / deltas.length * 100,
    pctOver50: deltas.filter(d => d > 50).length / deltas.length * 100,
  };
}, runtimeSeconds);

const wsBytes = wsFrames.slice(wsMark).reduce((a, f) => a + f.len, 0);
const wsCount = wsFrames.length - wsMark;
const wsElapsed = (wsFrames.at(-1)?.t - wsFrames[wsMark]?.t) / 1000 || runtimeSeconds;

const dev = await page.evaluate(() => ({
  dpr: devicePixelRatio,
  canvases: [...document.querySelectorAll('canvas')].map(c => `${c.width}x${c.height}`),
  quality: (() => { try { return localStorage.getItem('orbit-quality') || '(default)'; } catch { return '?'; } })(),
}));

// --- aggregate transfer ---
const byType = {};
for (const f of finished) {
  const k = f.type || 'other';
  byType[k] = byType[k] || { n: 0, bytes: 0 };
  byType[k].n++; byType[k].bytes += f.bytes;
}
const total = finished.reduce((a, f) => a + f.bytes, 0);
const top = [...finished].sort((a, b) => b.bytes - a.bytes).slice(0, 12);

console.log('=== FIRST LOAD ===');
console.log(`load event: ${loadMs} ms   requests: ${finished.length}   total on-wire: ${fmt(total)}`);
for (const [k, v] of Object.entries(byType).sort((a, b) => b[1].bytes - a[1].bytes)) {
  console.log(`  ${k.padEnd(12)} ${String(v.n).padStart(3)} req  ${fmt(v.bytes)}`);
}
console.log('\n=== LARGEST RESOURCES ===');
for (const f of top) console.log(`  ${fmt(f.bytes).padStart(9)}  ${f.url.replace(url, '')}`);

console.log('\n=== RUNTIME ===');
console.log(`device DPR=${dev.dpr}  canvases=[${dev.canvases.join(', ')}]  quality=${dev.quality}`);
console.log(`avg FPS ${fps.avgFps.toFixed(2)}  avg frame ${fps.avgFrameMs.toFixed(2)} ms  p50 ${fps.p50.toFixed(1)}  p95 ${fps.p95.toFixed(1)}  p99 ${fps.p99.toFixed(1)}`);
console.log(`frames >16.67ms: ${fps.pctOver16_67.toFixed(1)}%   >50ms: ${fps.pctOver50.toFixed(1)}%`);
console.log(`WebSocket: ${wsCount} msgs / ${wsElapsed.toFixed(1)}s = ${(wsCount / wsElapsed).toFixed(1)} msg/s, ${fmt(wsBytes)} = ${fmt(wsBytes / wsElapsed)}/s`);

await browser.close();
