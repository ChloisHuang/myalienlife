#!/usr/bin/env node
// Captures real consecutive authoritative states from the live stream by
// replaying the JSON patches, so the patch encoder can be evaluated offline on
// genuine data (byte sizes, operation counts) without deploying anything.
//
// Usage: node tools/capture-states.mjs [count] [outfile]
import WebSocket from 'ws';
import {randomUUID} from 'node:crypto';
import patch from 'fast-json-patch';
import {writeFileSync} from 'node:fs';

const count = Number(process.argv[2] || 8);
const out = process.argv[3] || '/tmp/orbit-states.json';
const url = process.env.ORBIT_WS || 'wss://www.doudouai.net:6443/api/stream';
const origin = process.env.ORBIT_ORIGIN || 'https://www.doudouai.net:6443';

const states = [];
let wire = 0, base = 0;
const ws = new WebSocket(url, { origin, perMessageDeflate: true, handshakeTimeout: 15000 });
ws.on('open', () => ws.send(JSON.stringify({ type: 'auth', client: `probe-${randomUUID().slice(0, 8)}`, session: '', authVersion: 0 })));
ws.on('message', d => {
  if (!base) base = ws._socket?.bytesRead ?? 0;
  let v; try { v = JSON.parse(d); } catch { return; }
  if (v.state) states.push(v.state);
  else if (v.patch && states.length) {
    try { states.push(patch.applyPatch(states.at(-1), v.patch, true, false).newDocument); } catch (e) { console.log('patch apply failed:', e.message); return; }
  }
  if (states.length >= count + 1) {
    wire = (ws._socket?.bytesRead ?? 0) - base;
    try { ws.close(); } catch {}
    finish();
  }
});
ws.on('error', e => { console.log('error:', e.message); finish(); });
setTimeout(() => { try { ws.close(); } catch {} finish(); }, 40000);

let done = false;
function finish() {
  if (done) return; done = true;
  if (states.length < 3) { console.log(`only ${states.length} states captured`); process.exit(1); }
  const sizes = states.map(s => Buffer.byteLength(JSON.stringify(s)));
  writeFileSync(out, JSON.stringify({ capturedAt: new Date().toISOString(), wireBytes: wire, states }));
  console.log(`captured ${states.length} consecutive states -> ${out}`);
  console.log(`   per-state size: ${sizes.map(s => (s / 1024).toFixed(0) + 'KB').join(', ')}`);
  console.log(`   wire bytes for the whole capture (compressed): ${(wire / 1024).toFixed(0)}KB over ${states.length - 1} pushes = ${(wire / (states.length - 1) / 1024).toFixed(1)}KB/push`);
  process.exit(0);
}
