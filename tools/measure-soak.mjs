#!/usr/bin/env node
// Soak test: does the live game degrade the longer it stays open, or is it
// uniformly heavy? Samples FPS, JS heap, DOM nodes, main-thread blocking and
// WebSocket traffic at a fixed interval.
// Usage: node tools/measure-soak.mjs [url] [minutes] [sampleSeconds]
import { chromium } from '@playwright/test';

const url = process.argv[2] || 'https://www.doudouai.net:6443';
const minutes = Number(process.argv[3] || 6);
const sampleSeconds = Number(process.argv[4] || 30);

const fmtMB = n => `${(n / 1024 / 1024).toFixed(1)}MB`;

const browser = await chromium.launch({
  channel: process.env.PROFILE_CHANNEL || 'msedge',
  headless: false,
  args: ['--enable-gpu', '--ignore-certificate-errors', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();

// count long tasks and animation frames in the page itself
await page.addInitScript(() => {
  window.__soak = { frames: [], longTasks: [], wsBytes: 0, wsMsgs: 0 };
  let last = 0;
  requestAnimationFrame(function f(ts) { if (last) window.__soak.frames.push(ts - last); last = ts; requestAnimationFrame(f); });
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__soak.longTasks.push(e.duration); }).observe({ entryTypes: ['longtask'] }); } catch {}
});

const cdp = await context.newCDPSession(page);
await cdp.send('Network.enable');
let wsBytes = 0;
cdp.on('Network.webSocketFrameReceived', e => {
  wsBytes += (e.response?.payloadData || '').length;
});

await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(12000); // let the scene and save settle

console.log(`soak: ${minutes} min, sampling every ${sampleSeconds}s`);
console.log('  t     FPS    frame_ms  p95_ms  blocked_ms/s  longtasks  heap      DOM    canvas');
console.log('  ' + '-'.repeat(84));

const rows = [];
for (let i = 1; i <= Math.round(minutes * 60 / sampleSeconds); i++) {
  await page.evaluate(() => { window.__soak.frames.length = 0; window.__soak.longTasks.length = 0; });
  const wsBefore = wsBytes;
  const t0 = Date.now();
  await page.waitForTimeout(sampleSeconds * 1000);
  const elapsed = (Date.now() - t0) / 1000;

  const s = await page.evaluate(() => {
    const f = window.__soak.frames.filter(x => x > 0 && x < 2000);
    const sorted = [...f].sort((a, b) => a - b);
    const q = p => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] || 0;
    const avg = f.reduce((a, b) => a + b, 0) / Math.max(1, f.length);
    const main = document.querySelector('canvas');
    return {
      fps: avg ? 1000 / avg : 0,
      frameMs: avg,
      p95: q(0.95),
      blockedMs: window.__soak.longTasks.reduce((a, b) => a + b, 0),
      longTasks: window.__soak.longTasks.length,
      heap: performance.memory?.usedJSHeapSize || 0,
      dom: document.getElementsByTagName('*').length,
      canvas: main ? `${main.width}x${main.height}` : '?',
    };
  });
  const wsDelta = (wsBytes - wsBefore) / 1024;

  rows.push({ ...s, t: i * sampleSeconds });
  console.log('  ' + String(i * sampleSeconds + 's').padStart(5) +
    String(s.fps.toFixed(1)).padStart(7) +
    String(s.frameMs.toFixed(1)).padStart(11) +
    String(s.p95.toFixed(1)).padStart(8) +
    String((s.blockedMs / elapsed).toFixed(0)).padStart(14) +
    String(s.longTasks).padStart(11) +
    fmtMB(s.heap).padStart(10) +
    String(s.dom).padStart(7) +
    ('  ' + s.canvas + `  ws ${wsDelta.toFixed(0)}KB/${elapsed.toFixed(0)}s`));
}

const first = rows[0], last = rows.at(-1);
console.log('\n  first sample FPS ' + first.fps.toFixed(1) + '  ->  last sample FPS ' + last.fps.toFixed(1));
console.log('  heap ' + fmtMB(first.heap) + ' -> ' + fmtMB(last.heap) + '   DOM ' + first.dom + ' -> ' + last.dom);
const avgBlocked = rows.reduce((a, r) => a + r.blockedMs, 0) / (rows.length * sampleSeconds);
console.log('  mean main-thread blocking: ' + avgBlocked.toFixed(0) + ' ms/s');

await browser.close();
