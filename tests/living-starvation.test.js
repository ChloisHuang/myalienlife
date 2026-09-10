import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,buyItem,enqueue,tick,restore,serialize} from '../src/simulation.js';

function quiet(){const g=createGame();g.autonomy.enabled=false;for(const p of Object.values(g.npcs))p.ai.enabled=false;return g;}
test('tree rest crosses to the other face before searching for a local resting position',()=>{
 const g=quiet();g.player.prayer.nether=10;const tree=buyItem(g,'spiritTree',0,0,0,{island:'home',side:'back'}).object;
 assert.equal(enqueue(g,'treeRest',tree.id).ok,true);tick(g,.1);assert.equal(g.queue[0].phase,'walking');assert.ok(g.queue[0].blinkTransit);
 for(let i=0;i<300;i++)tick(g,.1);assert.equal(g.player.side,'back');assert.equal(g.queue.length,0);
});
test('a previously saved cross-face waiting action resumes movement rather than waiting forever',()=>{
 const g=quiet();g.player.prayer.nether=10;const tree=buyItem(g,'spiritTree',0,0,0,{island:'home',side:'back'}).object;enqueue(g,'treeRest',tree.id);g.queue[0].phase='waiting';
 const loaded=restore(serialize(g));tick(loaded,.1);assert.equal(loaded.queue[0].phase,'walking');
});
test('critical hunger interrupts optional living activity and pending social invitations to actually eat',()=>{
 const g=quiet();g.autonomy.enabled=true;g.needs.hunger=5;g.needs.energy=0;const tree=buyItem(g,'spiritTree',0,4).object;enqueue(g,'treeRest',tree.id);g.queue[0].source='ai';
 g.queue.push({id:g.nextId++,type:'lounge',targetId:'sofa',target:{x:-3.6,z:0,island:'home',side:'front'},source:'manual',phase:'walking',elapsed:0,path:null,seat:null,invited:true});
 tick(g,.1,()=>.99);assert.equal(g.queue[0]?.type,'eat');
 for(let i=0;i<600;i++)tick(g,.1,()=>.99);assert.ok(g.needs.hunger>30);assert.equal(g.player.alive,true);
});
