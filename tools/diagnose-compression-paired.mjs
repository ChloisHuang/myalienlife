#!/usr/bin/env node
// PAIRED experiment: does per-message compression change delivery regularity?
//
// The earlier test compared an uncompressed run and a compressed run
// sequentially, so a drifting network could confound the result. This opens
// three connections AT THE SAME TIME on the same link, driven by the same
// server-side 200ms timer:
//
//   A  uncompressed   ~25KB/msg
//   B  compressed      ~4KB/msg
//   C  uncompressed   ~25KB/msg   <- control for run-to-run noise (A vs C)
//
// If message size drives the long gaps, A and C should be markedly worse than
// B. If A and C differ from each other by about as much as they differ from B,
// the effect is noise.
//
// Usage: node tools/diagnose-compression-paired.mjs [seconds]
import WebSocket from 'ws';
import {randomUUID} from 'node:crypto';

const seconds = Number(process.argv[2] || 60);
const url = process.env.ORBIT_WS || 'wss://www.doudouai.net:6443/api/stream';
const origin = process.env.ORBIT_ORIGIN || 'https://www.doudouai.net:6443';

function open(label, deflate) {
  const rec = { label, deflate, arrivals: [], wire: 0, msgs: 0, err: null };
  const ws = new WebSocket(url, { origin, perMessageDeflate: deflate, handshakeTimeout: 15000 });
  ws.on('open', () => {
    rec.wireStart = ws._socket.bytesRead;
    ws.send(JSON.stringify({ type: 'auth', client: `probe-${randomUUID().slice(0, 8)}`, session: '', authVersion: 0 }));
  });
  ws.on('message', d => { rec.msgs++; rec.arrivals.push(Date.now()); });
  ws.on('error', e => { rec.err = e.message; });
  rec.close = () => { try { rec.wire = ws._socket.bytesRead - (rec.wireStart ?? 0); } catch {} try { ws.close(); } catch {} };
  return rec;
}

const conns = [open('A uncompressed', false), open('B compressed', true), open('C uncompressed', false)];
console.log(`three simultaneous connections to ${url} for ${seconds}s`);
await new Promise(r => setTimeout(r, seconds * 1000));
conns.forEach(c => c.close());
await new Promise(r => setTimeout(r, 300));

const stat = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(s.length * p) - 1)] ?? 0; };
const gapsOf = c => { const g = []; for (let i = 1; i < c.arrivals.length; i++) g.push(c.arrivals[i] - c.arrivals[i - 1]); return g; };

console.log('');
for (const c of conns) {
  if (c.err) { console.log(`${c.label}: error ${c.err}`); continue; }
  const g = gapsOf(c);
  if (!g.length) { console.log(`${c.label}: no messages`); continue; }
  const span = (c.arrivals.at(-1) - c.arrivals[0]) / 1000;
  const late = g.filter(x => x > 250).length;
  const veryLate = g.filter(x => x > 400).length;
  console.log(`${c.label}`);
  console.log(`   ${c.msgs} msgs / ${span.toFixed(1)}s = ${(c.msgs / span).toFixed(2)}/s   wire ${(c.wire / 1024).toFixed(0)}KB = ${(c.wire / c.msgs / 1024).toFixed(1)}KB/msg`);
  console.log(`   gap  p50 ${stat(g, .5)}ms  p90 ${stat(g, .9)}ms  p99 ${stat(g, .99)}ms  max ${Math.max(...g)}ms`);
  console.log(`   late >250ms ${late}/${g.length} = ${(late / g.length * 100).toFixed(0)}%    >400ms ${(veryLate / g.length * 100).toFixed(0)}%`);
}

// paired comparison per 5-second window
const A = conns[0], B = conns[1], C = conns[2];
if (A.arrivals.length && B.arrivals.length && C.arrivals.length) {
  console.log('\npaired 5s windows (late-gap count per window):');
  const t0 = Math.min(A.arrivals[0], B.arrivals[0], C.arrivals[0]);
  const bucket = (c, lo, hi) => {
    const a = c.arrivals.filter(t => t - t0 >= lo && t - t0 < hi);
    const g = []; for (let i = 1; i < a.length; i++) g.push(a[i] - a[i - 1]);
    return { n: a.length, late: g.filter(x => x > 250).length };
  };
  const wins = Math.floor(seconds / 5);
  let totA = 0, totB = 0, totC = 0;
  for (let i = 0; i < wins; i++) {
    const a = bucket(A, i * 5000, (i + 1) * 5000), b = bucket(B, i * 5000, (i + 1) * 5000), c = bucket(C, i * 5000, (i + 1) * 5000);
    totA += a.late; totB += b.late; totC += c.late;
    console.log(`   +${String(i * 5).padStart(2)}s   A(uncompressed) ${a.late}/${a.n}   B(compressed) ${b.late}/${b.n}   C(uncompressed) ${c.late}/${c.n}`);
  }
  console.log(`\n   totals:  A ${totA}   B ${totB}   C ${totC}`);
  console.log(`   noise floor (A vs C, identical settings): ${Math.abs(totA - totC)}`);
  console.log(`   compression effect (mean(A,C) vs B):      ${Math.abs((totA + totC) / 2 - totB).toFixed(0)}`);
  const noise = Math.abs(totA - totC), effect = Math.abs((totA + totC) / 2 - totB);
  console.log(effect > noise * 2
    ? '\n   => the compression effect EXCEEDS the run-to-run noise, so message size does matter here.'
    : '\n   => the compression effect is within run-to-run noise; this experiment cannot attribute the gaps to message size.');
}
