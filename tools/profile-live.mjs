#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';

const url = process.argv[2] || 'https://www.doudouai.net:6443';
const seconds = Number(process.env.PROFILE_SECONDS || 20);
const delayMs = Number(process.env.PROFILE_DELAY_MS || 5000);
const outDir = path.resolve('artifacts/performance');

const pct = (xs, p) => {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.ceil(a.length * p) - 1)];
};
const round = (n, d = 2) => Number((Number(n) || 0).toFixed(d));
const metricsMap = xs => Object.fromEntries((xs || []).map(x => [x.name, x.value]));

function cpuTop(profile, limit = 40) {
  const nodes = new Map(profile.nodes.map(n => [n.id, n]));
  const totals = new Map();
  for (let i = 0; i < (profile.samples || []).length; i++) {
    const n = nodes.get(profile.samples[i]);
    if (!n) continue;
    const f = n.callFrame || {};
    const name = f.functionName || '(anonymous)';
    if (name === '(idle)' || name === '(program)') continue;
    const url = f.url || '';
    const line = Number.isFinite(f.lineNumber) ? f.lineNumber + 1 : 0;
    const key = `${name}\n${url}\n${line}`;
    const x = totals.get(key) || { functionName: name, url, line, selfMs: 0, samples: 0 };
    x.selfMs += Number(profile.timeDeltas?.[i] || 0) / 1000;
    x.samples++;
    totals.set(key, x);
  }
  return [...totals.values()].sort((a, b) => b.selfMs - a.selfMs).slice(0, limit)
    .map((x, i) => ({ rank: i + 1, ...x, selfMs: round(x.selfMs) }));
}

function traceTop(events) {
  const wanted = new Set(['RunTask','FunctionCall','EventDispatch','TimerFire','FireAnimationFrame','UpdateLayoutTree','RecalculateStyles','Layout','PrePaint','Paint','CompositeLayers','RasterTask','MinorGC','MajorGC','V8.GCScavenger','V8.GCCompactor']);
  let pid = null, tid = null;
  for (const e of events) {
    if (e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain') {
      pid = e.pid; tid = e.tid; break;
    }
  }
  const m = new Map();
  for (const e of events) {
    if (e.ph !== 'X' || !Number.isFinite(e.dur) || !wanted.has(e.name)) continue;
    if (tid !== null && (e.pid !== pid || e.tid !== tid)) continue;
    const x = m.get(e.name) || { name: e.name, totalMs: 0, count: 0, maxMs: 0 };
    const ms = e.dur / 1000;
    x.totalMs += ms; x.count++; x.maxMs = Math.max(x.maxMs, ms); m.set(e.name, x);
  }
  return [...m.values()].sort((a, b) => b.totalMs - a.totalMs).map(x => ({ ...x, totalMs: round(x.totalMs), avgMs: round(x.totalMs / x.count), maxMs: round(x.maxMs) }));
}

async function readStream(cdp, handle) {
  let text = '';
  for (;;) {
    const p = await cdp.send('IO.read', { handle });
    text += p.data || '';
    if (p.eof) break;
  }
  await cdp.send('IO.close', { handle });
  return text;
}

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PROFILE_CHANNEL || 'msedge', headless: process.env.PROFILE_HEADLESS === '1', args: ['--enable-gpu','--ignore-certificate-errors','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(process.env.PROFILE_DPR || 1) });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__perfProbe = { frames: [], longTasks: [], recording: false };
    let last = 0;
    requestAnimationFrame(function frame(ts) {
      const p = window.__perfProbe;
      if (p.recording) { if (last) p.frames.push(ts - last); last = ts; } else last = 0;
      requestAnimationFrame(frame);
    });
    try {
      new PerformanceObserver(list => {
        if (!window.__perfProbe.recording) return;
        for (const e of list.getEntries()) window.__perfProbe.longTasks.push({ startTime: e.startTime, duration: e.duration, name: e.name });
      }).observe({ entryTypes: ['longtask'] });
    } catch {}
  });

  console.log(`Opening ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(delayMs);

  const env = await page.evaluate(() => ({
    title: document.title,
    href: location.href,
    devicePixelRatio,
    viewport: { width: innerWidth, height: innerHeight },
    domNodes: document.getElementsByTagName('*').length,
    canvases: [...document.querySelectorAll('canvas')].map(c => ({ width: c.width, height: c.height, cssWidth: c.clientWidth, cssHeight: c.clientHeight })),
    bodyText: document.body?.innerText?.slice(0, 1000) || ''
  }));
  console.log('Scene:', JSON.stringify(env));

  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  const before = metricsMap((await cdp.send('Performance.getMetrics')).metrics);
  let resolveTrace;
  const traceDone = new Promise(r => { resolveTrace = r; });
  cdp.on('Tracing.tracingComplete', resolveTrace);
  await cdp.send('Tracing.start', { transferMode: 'ReturnAsStream', categories: 'toplevel,devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,blink.user_timing,v8.execute' });
  await cdp.send('Profiler.start');
  await page.evaluate(() => { window.__perfProbe.frames.length = 0; window.__perfProbe.longTasks.length = 0; window.__perfProbe.recording = true; });
  console.log(`Profiling ${seconds}s...`);
  await page.waitForTimeout(seconds * 1000);
  await page.evaluate(() => { window.__perfProbe.recording = false; });
  const probe = await page.evaluate(() => ({ frames: [...window.__perfProbe.frames], longTasks: [...window.__perfProbe.longTasks] }));
  const profile = (await cdp.send('Profiler.stop')).profile;
  const after = metricsMap((await cdp.send('Performance.getMetrics')).metrics);
  await cdp.send('Tracing.end');
  const traceEvent = await traceDone;
  const traceText = await readStream(cdp, traceEvent.stream);
  const trace = JSON.parse(traceText);

  const frames = probe.frames.filter(x => x > 0 && x < 1000);
  const avgMs = frames.reduce((a, b) => a + b, 0) / Math.max(1, frames.length);
  const delta = name => (after[name] || 0) - (before[name] || 0);
  const report = {
    url, createdAt: new Date().toISOString(), profileSeconds: seconds, environment: env,
    frameSummary: {
      sampleFrames: frames.length, avgFps: round(1000 / avgMs), avgFrameMs: round(avgMs),
      p50FrameMs: round(pct(frames, .50)), p95FrameMs: round(pct(frames, .95)), p99FrameMs: round(pct(frames, .99)),
      pctOver16_67ms: round(frames.filter(x => x > 16.67).length / Math.max(1, frames.length) * 100),
      pctOver33_33ms: round(frames.filter(x => x > 33.33).length / Math.max(1, frames.length) * 100),
      pctOver50ms: round(frames.filter(x => x > 50).length / Math.max(1, frames.length) * 100)
    },
    performanceMetricDeltas: {
      taskMs: round(delta('TaskDuration') * 1000), scriptMs: round(delta('ScriptDuration') * 1000),
      layoutMs: round(delta('LayoutDuration') * 1000), styleMs: round(delta('RecalcStyleDuration') * 1000),
      layoutCount: round(delta('LayoutCount'), 0), styleRecalcCount: round(delta('RecalcStyleCount'), 0),
      jsHeapUsedDeltaMB: round(delta('JSHeapUsedSize') / 1024 / 1024)
    },
    longTasks: { count: probe.longTasks.length, totalMs: round(probe.longTasks.reduce((s, x) => s + x.duration, 0)), top: [...probe.longTasks].sort((a,b) => b.duration-a.duration).slice(0,30) },
    topJsSelfTime: cpuTop(profile),
    traceMainThreadAggregates: traceTop(trace.traceEvents || [])
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = path.join(outDir, `live-${stamp}`);
  await fs.writeFile(`${base}.json`, JSON.stringify(report, null, 2));
  await fs.writeFile(`${base}.cpuprofile`, JSON.stringify(profile));
  await fs.writeFile(`${base}-trace.json`, traceText);
  await page.screenshot({ path: `${base}.png`, fullPage: true });
  console.log(JSON.stringify(report, null, 2));
  console.log(`REPORT=${base}.json`);
} finally {
  await browser.close();
}
