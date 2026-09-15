#!/usr/bin/env node
// Definitive test: intercept EVERY assignment to #clock.textContent so we can
// tell whether refresh() ran during a freeze, and whether the clock element was
// swapped out (which would silently detach a MutationObserver).
//
// Timeline records: clock sets, WS messages, rAF, socket events, element identity.
//
// Usage: node tools/diagnose-refresh.mjs [url] [warmupSeconds] [sampleSeconds]
import { chromium } from '@playwright/test';

const url = process.argv[2] || 'https://www.doudouai.net:6443';
const warmup = Number(process.argv[3] || 30);
const sampleSeconds = Number(process.argv[4] || 60);

const browser = await chromium.launch({
  channel: process.env.PROFILE_CHANNEL || 'msedge',
  headless: false,
  args: ['--enable-gpu', '--ignore-certificate-errors', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errs = [];
page.on('pageerror', e => errs.push(`${e.message}`));

await page.addInitScript(() => {
  window.__r = { sets: [], msgs: [], sockets: [], raf: 0, maxGap: 0, replaced: 0, lastEl: null };
  let last = 0;
  requestAnimationFrame(function f(ts) { window.__r.raf++; if (last) window.__r.maxGap = Math.max(window.__r.maxGap, ts - last); last = ts; requestAnimationFrame(f); });

  const Orig = globalThis.WebSocket;
  function Patched(...a) {
    const ws = new Orig(...a);
    ws.addEventListener('open', () => window.__r.sockets.push({ k: 'open', t: performance.now() }));
    ws.addEventListener('close', e => window.__r.sockets.push({ k: 'close', t: performance.now(), code: e.code }));
    ws.addEventListener('message', e => {
      let serial = null, kind = '?';
      try { const v = JSON.parse(e.data); serial = v.serial; kind = v.patch ? 'patch' : v.state ? 'full' : 'other'; } catch {}
      window.__r.msgs.push({ t: performance.now(), serial, kind });
    });
    return ws;
  }
  Patched.prototype = Orig.prototype;
  Object.assign(Patched, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  globalThis.WebSocket = Patched;

  // Hook textContent on #clock as soon as it exists.
  const desc = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  const hook = () => {
    const el = document.querySelector('#clock');
    if (!el) return setTimeout(hook, 200);
    if (window.__r.lastEl && window.__r.lastEl !== el) window.__r.replaced++;
    window.__r.lastEl = el;
    try {
      Object.defineProperty(el, 'textContent', {
        configurable: true,
        get() { return desc.get.call(el); },
        set(v) { window.__r.sets.push({ t: performance.now(), v: String(v) }); desc.set.call(el, v); },
      });
    } catch {}
    // detect the element being swapped out from under us
    setInterval(() => {
      const now = document.querySelector('#clock');
      if (now && now !== window.__r.lastEl) { window.__r.replaced++; window.__r.lastEl = now; hook(); }
    }, 500);
  };
  hook();
});

await page.goto(url, { waitUntil: 'load', timeout: 60000 });
console.log(`warming up ${warmup}s...`);
await page.waitForTimeout(warmup * 1000);
await page.evaluate(() => { window.__r.sets.length = 0; window.__r.msgs.length = 0; window.__r.sockets.length = 0; window.__r.raf = 0; window.__r.maxGap = 0; window.__r.replaced = 0; });

await page.waitForTimeout(sampleSeconds * 1000);
const r = await page.evaluate(() => ({ ...window.__r, lastEl: undefined }));

console.log(`\nwindow ${sampleSeconds}s`);
console.log(`rAF callbacks ${r.raf} (${(r.raf / sampleSeconds).toFixed(1)}/s)   worst gap ${r.maxGap.toFixed(0)}ms`);
console.log(`#clock textContent assignments: ${r.sets.length}  (${(r.sets.length / sampleSeconds).toFixed(1)}/s)`);
console.log(`#clock element replacements observed: ${r.replaced}`);
console.log(`ws messages ${r.msgs.length} (${(r.msgs.length / sampleSeconds).toFixed(1)}/s)   socket events: ${r.sockets.length ? r.sockets.map(s => s.k).join(',') : 'none'}`);

const sets = r.sets;
const gaps = [];
for (let i = 1; i < sets.length; i++) gaps.push({ g: sets[i].t - sets[i - 1].t, at: sets[i].t });
gaps.sort((a, b) => b.g - a.g);
console.log(`\nlargest gaps between refresh() clock updates:`);
for (const g of gaps.slice(0, 8)) console.log(`   ${(g.g / 1000).toFixed(2)}s  at +${((g.at - sets[0].t) / 1000).toFixed(1)}s`);

// for the worst gap, show what the socket was doing
const worst = gaps[0];
if (worst && worst.g > 2000) {
  const from = worst.at - worst.g, to = worst.at;
  const inWin = r.msgs.filter(m => m.t >= from && m.t <= to);
  const evWin = r.sockets.filter(e => e.t >= from && e.t <= to);
  console.log(`\nworst gap ${(worst.g / 1000).toFixed(1)}s — socket activity inside it:`);
  console.log(`   messages: ${inWin.length}` + (inWin.length ? `  serial ${inWin[0].serial} -> ${inWin.at(-1).serial}  kinds ${[...new Set(inWin.map(m => m.kind))].join(',')}` : '  <-- NO data arrived'));
  console.log(`   socket events: ${evWin.length ? evWin.map(e => e.k + (e.code ? `(${e.code})` : '')).join(', ') : 'none'}`);
  const dup = new Set(inWin.map(m => m.serial)).size;
  console.log(`   distinct serials: ${dup} of ${inWin.length}`);
}

// how many distinct printed values vs assignments
console.log(`\ndistinct values printed: ${new Set(sets.map(s => s.v)).size} of ${sets.length} assignments`);
console.log(`page errors: ${errs.length ? [...new Set(errs)].slice(0, 5).join(' | ') : 'none'}`);

await browser.close();
