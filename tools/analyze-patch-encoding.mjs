#!/usr/bin/env node
// Offline evaluation of a LOSSLESS patch encoding change, on real captured
// states (see tools/capture-states.mjs).
//
// Idea: fast-json-patch diffs arrays element by element, so one changed array
// becomes many ops, each repeating a long path string. For any array container
// we can instead emit ONE replace of the whole container. Both encodings
// reproduce the identical state; we simply pick whichever is smaller, per
// container, so the payload can never grow.
//
// Also verifies equivalence: apply the fine patch and the coarse patch to the
// base and deep-compare against the next state.
//
// Usage: node tools/analyze-patch-encoding.mjs [statesFile]
import {readFileSync} from 'node:fs';
import patch from 'fast-json-patch';

const file = process.argv[2] || '/tmp/orbit-states.json';
const {states} = JSON.parse(readFileSync(file, 'utf8'));

const valueAt = (root, path) => {
  if (path === '') return root;
  let cur = root;
  for (const seg of path.split('/').slice(1)) {
    const key = seg.replace(/~1/g, '/').replace(/~0/g, '~');
    if (cur == null) return undefined;
    cur = cur[key];
  }
  return cur;
};

// deepest array that contains this path
function arrayContainer(path, root) {
  const segs = path.split('/').slice(1);
  for (let i = segs.length - 1; i >= 0; i--) {
    const candidate = '/' + segs.slice(0, i).join('/');
    if (Array.isArray(valueAt(root, candidate))) return candidate;
  }
  return null;
}

const bytes = v => Buffer.byteLength(JSON.stringify(v));
const isUnder = (path, container) => path !== container && path.startsWith(container + '/');

function coarseEncode(base, next, ops) {
  // Candidate containers: only where EVERY op beneath them is a `replace`.
  // An add/remove shifts array indices, so mixing it with a whole-array
  // replace is order-sensitive and unsafe - skip those containers entirely.
  const containers = new Map();
  for (const op of ops) {
    const c = arrayContainer(op.path, next);
    if (c) { if (!containers.has(c)) containers.set(c, []); containers.get(c).push(op); }
  }

  const chosen = new Map();
  for (const [container, list] of containers) {
    if (list.some(o => o.op !== 'replace')) continue;
    // never coarsen a container that some other op rewrites wholesale
    if (ops.some(o => o.path !== container && container.startsWith(o.path + '/'))) continue;
    const fineCost = list.reduce((a, o) => a + bytes(o), 0);
    const coarseOp = {op: 'replace', path: container, value: valueAt(next, container)};
    if (bytes(coarseOp) < fineCost) chosen.set(container, coarseOp);
  }

  // Re-emit in the ORIGINAL order, substituting each chosen container once at
  // the position of its first op.
  const out = [], emitted = new Set();
  for (const op of ops) {
    let host = null;
    for (const container of chosen.keys()) {
      if (op.path === container || isUnder(op.path, container)) { host = container; break; }
    }
    if (host) {
      if (!emitted.has(host)) { out.push(chosen.get(host)); emitted.add(host); }
      continue;
    }
    out.push(op);
  }
  return {result: out, chosen};
}

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let fineTotal = 0, coarseTotal = 0, opsTotal = 0, coarseOpsTotal = 0, mismatches = 0;
const savedByContainer = new Map();

for (let i = 1; i < states.length; i++) {
  const base = states[i - 1], next = states[i];
  const fine = patch.compare(base, next);
  const {result: coarse, chosen} = coarseEncode(base, next, fine);

  const fineBytes = bytes(fine), coarseBytes = bytes(coarse);
  fineTotal += fineBytes; coarseTotal += coarseBytes;
  opsTotal += fine.length; coarseOpsTotal += coarse.length;

  for (const [container, op] of chosen) {
    const list = fine.filter(o => o.path === container || isUnder(o.path, container));
    const key = container.replace(/\/\d+/g, '/N');
    const rec = savedByContainer.get(key) || {saved: 0, count: 0};
    rec.saved += list.reduce((a, o) => a + bytes(o), 0) - bytes(op);
    rec.count++;
    savedByContainer.set(key, rec);
  }

  let appliedCoarse;
  try { appliedCoarse = patch.applyPatch(structuredClone(base), coarse, true, false).newDocument; }
  catch (e) { mismatches++; console.log(`  !! pair ${i}: coarse patch failed to apply: ${e.name} ${e.operation?.op} ${e.operation?.path}`); continue; }
  if (!deepEqual(appliedCoarse, next)) {
    mismatches++;
    console.log(`  !! pair ${i}: coarse patch does NOT reproduce the state`);
  }
}

const n = states.length - 1;
console.log(`evaluated ${n} consecutive state pairs from ${file}\n`);
console.log(`              ops/patch      JSON bytes/patch   vs current`);
console.log(`  current        ${(opsTotal / n).toFixed(0).padStart(5)}          ${(fineTotal / n / 1024).toFixed(1).padStart(6)} KB       100%`);
console.log(`  coarse         ${(coarseOpsTotal / n).toFixed(0).padStart(5)}          ${(coarseTotal / n / 1024).toFixed(1).padStart(6)} KB       ${(coarseTotal / fineTotal * 100).toFixed(0)}%`);
console.log(`\n  uncompressed reduction: ${(100 - coarseTotal / fineTotal * 100).toFixed(1)}%`);
console.log(`  equivalence check: ${mismatches === 0 ? 'all coarse patches reproduce the state EXACTLY' : `${mismatches} MISMATCHES`}`);

console.log(`\ntop containers where coarsening wins (path normalised):`);
const top = [...savedByContainer.entries()].sort((a, b) => b[1].saved - a[1].saved).slice(0, 12);
for (const [k, v] of top) console.log(`   saved ${String(Math.round(v.saved / n)).padStart(5)} B/patch (${v.count}/${n} patches)  ${k}`);
