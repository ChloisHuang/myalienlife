import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPresentation} from '../src/presentation.js';
const state=(x,minute=510)=>({speed:1,day:1,minute,viewIsland:'eva',viewSide:'front',player:{uid:'a',x,z:0,island:'eva',side:'front'},queue:[{id:1,type:'walk',phase:'walking',elapsed:x}],npcs:{},money:100});
test('network snapshots become continuous render frames without changing authoritative state',()=>{
 const p=createPresentation(),a=state(0),b=state(3,511),saved=JSON.stringify(b);p.push(a,0);p.push(b,600);
 const samples=[];for(let t=950;t<=1400;t+=16)samples.push(p.sample(b,t).player.x);
 assert.ok(samples.every((x,i)=>!i||x>samples[i-1]));assert.ok(samples.every((x,i)=>!i||x-samples[i-1]<.1));assert.equal(JSON.stringify(b),saved);
 assert.equal(p.sample(b,10000).player.x,3);assert.equal(p.sample(b,10000).minute,511);
});
test('pause, new lives and teleports do not interpolate across incompatible states',()=>{
 const p=createPresentation(),a=state(0),b=state(3);p.push(a,0);b.speed=0;p.push(b,600);assert.equal(p.sample(b,650).player.x,3);
 const c=state(9);c.player.uid='new';p.push(c,1200);assert.equal(p.sample(c,1250).player.x,9);
 const d=state(-8);d.player.uid='new';d.player.side='back';p.push(d,1800);assert.equal(p.sample(d,2000).player.x,-8);
});

// The render delay is the lag between the newest snapshot and what is drawn, so
// it is the number that decides how far behind the world feels. Measure it as
// the first instant sample() reaches the final snapshot.
function renderDelay(pushTimes){
 const p=createPresentation(),a=state(0),b=state(3),target=pushTimes.at(-1);
 for(const at of pushTimes.slice(0,-1))p.push(a,at);
 p.push(b,target);
 for(let now=target;now<=target+6000;now++)if(p.sample(b,now).player.x===b.player.x)return now-target;
 return Infinity;
}
const steady=(interval,count)=>Array.from({length:count},(_,i)=>i*interval);
// a steady stream with one interval replaced by a stall
const withStall=(interval,count,stallAt,stallMs)=>{
 const times=[];let at=0;
 for(let i=0;i<count;i++){if(i===stallAt)at+=stallMs-interval;times.push(at);at+=interval;}
 return times;
};

test('render delay settles at 1.5x the server snapshot cadence',()=>{
 assert.equal(renderDelay(steady(200,30)),300);
 assert.equal(renderDelay(steady(500,30)),750);
});

test('a single stalled snapshot does not inflate the render delay',()=>{
 assert.equal(renderDelay(steady(200,30)),300);
 assert.equal(renderDelay(withStall(200,30,16,1500)),300);
});

test('a reconnect-sized gap is ignored by the cadence estimate',()=>{
 assert.equal(renderDelay(withStall(200,24,12,30000)),300);
});

test('recorded live arrivals keep the render delay near the trailing cadence',()=>{
 const trace=JSON.parse(readFileSync(new URL('./fixtures/snapshot-arrivals.json',import.meta.url),'utf8'));
 const pushTimes=[0];for(const interval of trace.intervals)pushTimes.push(pushTimes.at(-1)+interval);
 const tail=[...trace.intervals].slice(-24).sort((a,b)=>a-b);
 const cadence=(tail[11]+tail[12])/2,expected=Math.ceil(Math.min(1500,Math.max(250,cadence*1.5)));
 const delay=renderDelay(pushTimes);
 assert.equal(delay,expected,`delay ${delay}ms should match the ${cadence}ms trailing cadence`);
 assert.ok(delay<600,`delay ${delay}ms should stay bounded on live jitter`);
});

// Recorded from a worse network stretch: bursts of sub-10ms intervals mixed with
// multi-second stalls. The old EWMA counted the stalls and ignored the bursts,
// so the render delay drifted up to 662ms; the median holds at the floor.
test('a bursty live stream does not inflate the render delay',()=>{
 const trace=JSON.parse(readFileSync(new URL('./fixtures/snapshot-arrivals-jittery.json',import.meta.url),'utf8'));
 const pushTimes=[0];for(const interval of trace.intervals)pushTimes.push(pushTimes.at(-1)+interval);
 const delay=renderDelay(pushTimes);
 assert.ok(delay<=300,`delay ${delay}ms should hold near the floor, not chase the stalls`);
});
