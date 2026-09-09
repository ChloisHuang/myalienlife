import test from 'node:test';
import assert from 'node:assert/strict';
import {createPresentation} from '../src/presentation.js';
const state=(x,minute=510)=>({speed:1,day:1,minute,viewIsland:'home',viewSide:'front',player:{uid:'a',x,z:0,island:'home',side:'front'},queue:[{id:1,type:'walk',phase:'walking',elapsed:x}],npcs:{},money:100});
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
