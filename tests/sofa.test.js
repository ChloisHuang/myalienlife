import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,enqueue,tick,cancelAction,serialize,restore} from '../src/simulation.js';
import {localToWorld,SOFA_SEATS} from '../src/characters.js';
const advance=(g,seconds)=>{for(let i=0;i<seconds*10;i++)tick(g,.1);};
const occupants=g=>[g.queue,...Object.values(g.npcs).map(n=>n.queue)].map(q=>q[0]).filter(q=>q&&['relax','lounge'].includes(q.type));
function gather(){const g=createGame();for(const n of Object.values(g.npcs))n.ai.enabled=false;assert.equal(enqueue(g,'lounge','sofa').ok,true);advance(g,8);return g;}

test('three residents can sit together, chat and retain separate seats after reload',()=>{
 const g=gather(),seats=occupants(g);assert.equal(seats.length,3);assert.ok(seats.every(q=>q.phase==='acting'));assert.equal(new Set(seats.map(q=>q.seat)).size,3);
 const before=g.needs.social,relationships={...g.relationships};advance(g,3);assert.ok(g.needs.social>before);assert.equal(Object.keys(g.relationships).filter(id=>g.relationships[id]>relationships[id]).length,2);
 assert.deepEqual(restore(serialize(g)),g);g.speed=0;const paused=serialize(g);tick(g,5);assert.equal(serialize(g),paused);
});
test('a fourth resident waits and takes a released seat without displacing anyone',()=>{
 const g=gather(),waiting=Object.values(g.npcs).find(n=>!n.queue.length);waiting.queue.push({id:g.nextId++,type:'relax',targetId:'sofa',target:{x:-3.7,z:0},source:'manual',elapsed:0,phase:'walking',path:null,seat:null});
 advance(g,1);assert.equal(waiting.queue[0].phase,'waiting');assert.equal(waiting.queue[0].seat,null);
 const released=g.queue[0].seat;cancelAction(g,g.queue[0].id);advance(g,.1);assert.equal(waiting.queue[0].seat,released);assert.equal(new Set(occupants(g).map(q=>q.seat)).size,3);
});
test('rotated sofas have distinct rotated approaches and reject overlapping saved seats',()=>{
 const g=createGame();for(const n of Object.values(g.npcs))n.ai.enabled=false;const sofa=g.objects.find(o=>o.id==='sofa');sofa.rotation=Math.PI/2;enqueue(g,'lounge','sofa');advance(g,8);
 for(const q of occupants(g)){const expected=localToWorld(sofa,[1.3,0,SOFA_SEATS[q.seat]]);assert.ok(Math.hypot(q.target.x-expected.x,q.target.z-expected.z)<1e-8);}
 const seats=occupants(g);seats[1].seat=seats[0].seat;assert.throws(()=>restore(serialize(g)),/座位重复/);
});
