#!/usr/bin/env node
// Captures a real snapshot inter-arrival trace from the live site so the
// presentation delay estimator can be tested against genuine data rather than
// a synthetic distribution.
//
// Usage: node tools/capture-arrival-trace.mjs [url] [warmupSeconds] [seconds] > trace.json
import { chromium } from '@playwright/test';

const url = process.argv[2] || 'https://www.doudouai.net:6443';
const warmup = Number(process.argv[3] || 25);
const seconds = Number(process.argv[4] || 60);

const browser = await chromium.launch({
  channel: process.env.PROFILE_CHANNEL || 'msedge',
  headless: false,
  args: ['--enable-gpu', '--ignore-certificate-errors', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();

await page.addInitScript(() => {
  window.__t = [];
  const O = globalThis.WebSocket;
  function W(...a) {
    const w = new O(...a);
    w.addEventListener('message', () => window.__t.push(performance.now()));
    return w;
  }
  W.prototype = O.prototype;
  Object.assign(W, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  globalThis.WebSocket = W;
});

await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(warmup * 1000);
await page.evaluate(() => { window.__t.length = 0; });
await page.waitForTimeout(seconds * 1000);
const stamps = await page.evaluate(() => window.__t);
await browser.close();

const intervals = [];
for (let i = 1; i < stamps.length; i++) intervals.push(Math.round(stamps[i] - stamps[i - 1]));
const out = { url, seconds, count: intervals.length, mean: Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length), intervals };
console.error(`captured ${intervals.length} intervals over ${seconds}s, mean ${out.mean}ms`);
console.log(JSON.stringify(out));
