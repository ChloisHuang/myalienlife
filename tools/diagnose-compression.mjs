#!/usr/bin/env node
// A/B test: does perMessageDeflate compression on the server delay snapshot
// delivery?
//
// A ws client that does NOT offer permessage-deflate makes the server send
// uncompressed frames; one that offers it gets compressed frames. Compression
// runs on the libuv threadpool, so it never shows up in event-loop-delay
// measurements - only in the arrival pattern.
//
// Usage: node tools/diagnose-compression.mjs [seconds]
import WebSocket from 'ws';
import {randomUUID} from 'node:crypto';

const seconds = Number(process.argv[2] || 35);
const url = process.env.ORBIT_WS || 'wss://www.doudouai.net:6443/api/stream';
const origin = process.env.ORBIT_ORIGIN || 'https://www.doudouai.net:6443';

function measure(deflate) {
  return new Promise(resolve => {
    const arrivals = [];
    const bytes = [];
    let settled = false;
    const ws = new WebSocket(url, { origin, perMessageDeflate: deflate, handshakeTimeout: 15000 });
    const done = () => { if (settled) return; settled = true; try { ws.close(); } catch {} resolve({ arrivals, bytes }); };
    ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', client: `probe-${randomUUID().slice(0, 8)}`, session: '', authVersion: 0 })));
    ws.on('message', d => { arrivals.push(Date.now()); bytes.push(d.length); });
    ws.on('error', e => { console.log(`   error (deflate=${deflate}): ${e.message}`); done(); });
    ws.on('close', c => { if (!settled) { console.log(`   closed early (deflate=${deflate}) code=${c}`); done(); } });
    setTimeout(done, seconds * 1000 + 500);
  });
}

const stat = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(s.length * p) - 1)] ?? 0; };

function report(label, r, secs) {
  const g = [];
  for (let i = 1; i < r.arrivals.length; i++) g.push(r.arrivals[i] - r.arrivals[i - 1]);
  const span = r.arrivals.length ? (r.arrivals.at(-1) - r.arrivals[0]) / 1000 : 0;
  if (!g.length) { console.log(`${label}: no messages received`); return; }
  const late = g.filter(x => x > 250);
  const bunched = g.filter(x => x < 50);
  const totalBytes = r.bytes.reduce((a, b) => a + b, 0);
  console.log(`${label}`);
  console.log(`   messages ${r.arrivals.length} over ${span.toFixed(1)}s = ${(r.arrivals.length / span).toFixed(2)}/s`);
  console.log(`   gap  mean ${(g.reduce((a, b) => a + b, 0) / g.length).toFixed(0)}ms  p50 ${stat(g, .5).toFixed(0)}ms  p90 ${stat(g, .9).toFixed(0)}ms  p99 ${stat(g, .99).toFixed(0)}ms  max ${Math.max(...g).toFixed(0)}ms`);
  console.log(`   late gaps >250ms: ${late.length}/${g.length} = ${(late.length / g.length * 100).toFixed(0)}%   bunched <50ms: ${(bunched.length / g.length * 100).toFixed(0)}%`);
  console.log(`   mean frame size ${(totalBytes / r.bytes.length / 1024).toFixed(1)}KB  -> ${(totalBytes / span / 1024).toFixed(0)} KB/s on the wire`);
}

console.log(`A/B on ${url} for ~${seconds}s each\n`);

console.log('A) client does NOT offer permessage-deflate  => server sends UNCOMPRESSED');
const a = await measure(false);
report('   result', a, seconds);

console.log('\nB) client offers permessage-deflate          => server COMPRESSES');
const b = await measure(true);
report('   result', b, seconds);

const gapStat = r => { const g = []; for (let i = 1; i < r.arrivals.length; i++) g.push(r.arrivals[i] - r.arrivals[i - 1]); return g; };
const ga = gapStat(a), gb = gapStat(b);
if (ga.length && gb.length) {
  const lateA = ga.filter(x => x > 250).length / ga.length * 100;
  const lateB = gb.filter(x => x > 250).length / gb.length * 100;
  console.log(`\n=> late-gap share: uncompressed ${lateA.toFixed(0)}%  vs  compressed ${lateB.toFixed(0)}%`);
  console.log(lateB - lateA > 10
    ? '   => compression is a significant contributor to irregular delivery.'
    : '   => compression is NOT the dominant cause; the irregularity is in the network path.');
}
