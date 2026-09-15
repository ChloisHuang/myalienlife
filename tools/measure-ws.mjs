#!/usr/bin/env node
// Precisely characterises the /api/stream payload: message rate, size split
// between full-state and JSON-patch messages, and downstream bytes/second.
// Usage: node tools/measure-ws.mjs [url] [seconds]
import { chromium } from '@playwright/test';

const url = process.argv[2] || 'https://www.doudouai.net:6443';
const seconds = Number(process.argv[3] || 20);

const fmt = n => n >= 1024 * 1024
  ? `${(n / 1024 / 1024).toFixed(2)} MB`
  : n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Network.enable');

const msgs = [];
cdp.on('Network.webSocketFrameReceived', e => {
  const data = e.response?.payloadData || '';
  let kind = 'other', ops = 0;
  try {
    const v = JSON.parse(data);
    if (v.patch) { kind = 'patch'; ops = v.patch.length; }
    else if (v.state) { kind = 'full-state'; }
  } catch { kind = 'unparsed'; }
  msgs.push({ t: Date.now(), bytes: data.length, kind, ops });
});

await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(6000);
msgs.length = 0;
const t0 = Date.now();
await page.waitForTimeout(seconds * 1000);
const elapsed = (Date.now() - t0) / 1000;

const total = msgs.reduce((a, m) => a + m.bytes, 0);
const by = {};
for (const m of msgs) {
  by[m.kind] = by[m.kind] || { n: 0, bytes: 0 };
  by[m.kind].n++; by[m.kind].bytes += m.bytes;
}
const sizes = msgs.map(m => m.bytes).sort((a, b) => a - b);
const pct = q => sizes[Math.min(sizes.length - 1, Math.ceil(sizes.length * q) - 1)] || 0;

console.log(`window: ${elapsed.toFixed(1)}s   messages: ${msgs.length}   rate: ${(msgs.length / elapsed).toFixed(1)} msg/s`);
console.log(`downstream: ${fmt(total)}  =  ${fmt(total / elapsed)}/s  (${(total / elapsed / 1024 * 8 / 1024).toFixed(2)} Mbit/s)`);
console.log('\nby message kind:');
for (const [k, v] of Object.entries(by)) {
  console.log(`  ${k.padEnd(11)} ${String(v.n).padStart(4)} msgs  ${fmt(v.bytes).padStart(9)}  avg ${fmt(v.bytes / v.n)}`);
}
console.log(`\nmessage size: p50 ${fmt(pct(0.5))}  p95 ${fmt(pct(0.95))}  max ${fmt(sizes.at(-1) || 0)}`);
const patchOps = msgs.filter(m => m.kind === 'patch').map(m => m.ops).sort((a, b) => a - b);
if (patchOps.length) {
  console.log(`patch ops:    p50 ${patchOps[Math.floor(patchOps.length / 2)]}  max ${patchOps.at(-1)}  (across ${patchOps.length} patches)`);
}
console.log(`\nextrapolated: 30 min of play = ${fmt(total / elapsed * 1800)}`);

await browser.close();
