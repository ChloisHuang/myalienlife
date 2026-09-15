#!/usr/bin/env node
// Instruments the WebGL context to count what the renderer actually submits
// each frame: draw calls, uniform uploads, and runtime shader compiles.
// This separates "too much data over the network" from "too many GL calls".
// Usage: node tools/measure-glcalls.mjs [url] [seconds]
import { chromium } from '@playwright/test';

const url = process.argv[2] || 'https://www.doudouai.net:6443';
const seconds = Number(process.argv[3] || 10);

const browser = await chromium.launch({
  channel: process.env.PROFILE_CHANNEL || 'msedge',
  headless: false,
  args: ['--enable-gpu', '--ignore-certificate-errors', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();

await page.addInitScript(() => {
  const counts = {};
  const bump = k => { counts[k] = (counts[k] || 0) + 1; };
  window.__gl = {
    counts,
    frames: 0,
    reset() { for (const k of Object.keys(counts)) delete counts[k]; this.frames = 0; },
  };
  const draw = ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced',
    'drawRangeElements', 'multiDrawElementsWEBGL'];
  const uniforms = ['uniformMatrix4fv', 'uniformMatrix3fv', 'uniform3f', 'uniform3fv',
    'uniform4fv', 'uniform1f', 'uniform1i', 'uniform2f', 'uniform4f', 'uniformMatrix2fv'];
  for (const proto of [globalThis.WebGLRenderingContext, globalThis.WebGL2RenderingContext]) {
    if (!proto) continue;
    for (const name of [...draw, ...uniforms, 'getProgramInfoLog', 'getShaderInfoLog',
      'linkProgram', 'compileShader', 'bindVertexArray', 'bufferData', 'bufferSubData', 'texImage2D']) {
      const orig = proto.prototype[name];
      if (typeof orig !== 'function') continue;
      proto.prototype[name] = function (...args) { bump(name); return orig.apply(this, args); };
    }
  }
  // count real composited frames
  const rafOrig = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = cb => rafOrig.call(globalThis, t => { window.__gl.frames++; return cb(t); });
});

await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(12000);

await page.evaluate(() => window.__gl.reset());
const t0 = Date.now();
await page.waitForTimeout(seconds * 1000);
const elapsed = (Date.now() - t0) / 1000;
const gl = await page.evaluate(() => ({ counts: window.__gl.counts, frames: window.__gl.frames }));
const dev = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  let renderer = 'unknown';
  try {
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  } catch {}
  return { canvas: `${c.width}x${c.height}`, dpr: devicePixelRatio, renderer };
});

const frames = gl.frames || 1;
const per = k => (gl.counts[k] || 0) / frames;
const draws = ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements', 'multiDrawElementsWEBGL']
  .reduce((a, k) => a + (gl.counts[k] || 0), 0);

console.log(`window ${elapsed.toFixed(1)}s   frames ${gl.frames}   fps ${(gl.frames / elapsed).toFixed(1)}`);
console.log(`canvas ${dev.canvas} @dpr ${dev.dpr}   GPU: ${dev.renderer}`);
console.log('\n  per frame:');
console.log(`    draw calls            ${(draws / frames).toFixed(0)}`);
for (const k of ['uniformMatrix4fv', 'uniformMatrix3fv', 'uniform3f', 'uniform1f', 'uniform4fv', 'bindVertexArray', 'texImage2D']) {
  if (gl.counts[k]) console.log(`    ${k.padEnd(21)} ${per(k).toFixed(0)}`);
}
console.log('\n  shader work during play (a steady-state run should be ~0):');
for (const k of ['compileShader', 'linkProgram', 'getProgramInfoLog', 'getShaderInfoLog']) {
  console.log(`    ${k.padEnd(21)} ${gl.counts[k] || 0} total, ${per(k).toFixed(1)} per frame`);
}
console.log(`\n  => ${(draws / elapsed).toFixed(0)} draw calls/second, ${((gl.counts.uniformMatrix4fv || 0) / elapsed).toFixed(0)} mat4 uploads/second`);

await browser.close();
