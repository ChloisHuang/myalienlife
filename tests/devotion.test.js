import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,buyItem,tick,serialize,restore,updateResident,switchControl} from '../src/simulation.js';
test('higher devotion makes autonomous prayer more likely with identical needs and opportunities',()=>{
 const base=createGame();base.objects=[];buyItem(base,'spiritTree',0,0);buyItem(base,'lab',4,0);base.player.x=0;base.player.z=3;base.autonomy.enabled=true;for(const n of Object.values(base.npcs))n.ai.enabled=false;for(const k in base.needs)base.needs[k]=90;
 const count=value=>{let prayers=0;for(let i=0;i<100;i++){const g=restore(serialize(base));g.player.devotion=value;tick(g,.01,()=>(i+.5)/100);if(g.queue[0]?.type==='pray')prayers++;}return prayers;};const low=count(0),high=count(100);assert.equal(low,0);assert.ok(high>50,`${high} / 100 prayers`);
});
test('devotion can be edited, survives control changes and reload, and rejects invalid input',()=>{
 const g=createGame(),person=g.player;assert.equal(updateResident(g,'player',{gender:person.gender,age:28,devotion:93}).ok,true);switchControl(g,'nova');switchControl(g,'kai');assert.equal(g.player.devotion,93);assert.equal(restore(serialize(g)).player.devotion,93);
 assert.equal(updateResident(g,'player',{gender:g.player.gender,age:28,devotion:101}).ok,false);g.player.devotion=-1;assert.throws(()=>restore(serialize(g)));
});
test('version sixteen gets stable individual devotion without resetting progress or prayer attributes',()=>{
 const g=createGame();g.version=16;g.day=170;for(const p of [g.player,...Object.values(g.npcs)])delete p.devotion;g.player.prayer.nether=10;const a=restore(serialize(g)),b=restore(serialize(g));assert.equal(a.version,22);assert.equal(a.day,170);assert.equal(a.player.prayer.nether,10);assert.equal(a.player.devotion,b.player.devotion);assert.ok(new Set([a.player,...Object.values(a.npcs)].map(p=>p.devotion)).size>1);assert.deepEqual(a.objects,g.objects);
});
