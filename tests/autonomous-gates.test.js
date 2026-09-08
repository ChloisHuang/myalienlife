import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,tick,restore,enqueue} from '../src/simulation.js';
function fixture(){const g=createGame();g.space.backs.spore=true;g.player.island='spore';g.player.x=0;g.player.z=2;g.player.prayer.nether=10;g.autonomy.cooldown=0;g.money=1500;for(const n of Object.values(g.npcs))n.ai.enabled=false;return g;}
const gates=g=>g.objects.filter(o=>o.type==='gate'&&o.island==='spore');
test('autonomous Nether resident buys both missing gates once using personal funds',()=>{
 const g=fixture();tick(g,.1,()=>.5);assert.equal(gates(g).length,2);assert.equal(g.money,660);assert.deepEqual(gates(g).map(o=>o.side).sort(),['back','front']);g.queue=[];g.autonomy.cooldown=0;tick(g,.1,()=>.5);assert.equal(gates(g).length,2);assert.equal(g.money,660);assert.ok(restore(JSON.stringify(g)));
});
test('unrevealed backs, other races, disabled autonomy and insufficient money do not purchase',()=>{
 for(const edit of [g=>delete g.space.backs.spore,g=>g.player.prayer.nether=0,g=>g.autonomy.enabled=false,g=>g.money=839]){const g=fixture();edit(g);const money=g.money;tick(g,.1,()=>.5);assert.equal(gates(g).length,0);assert.equal(g.money,money);}
});
test('NPC purchases only the missing face and leaves player wallet and camera untouched',()=>{
 const g=fixture();g.autonomy.enabled=false;const n=g.npcs.nova;n.island='spore';n.side='front';n.prayer.nether=10;n.money=900;n.ai.enabled=true;n.ai.cooldown=0;g.objects.push({id:'existing-front',type:'gate',x:-8,z:-4,rotation:0,island:'spore',side:'front'});tick(g,.1,()=>.5);assert.equal(gates(g).length,2);assert.equal(n.money,480);assert.equal(g.money,1500);assert.equal(g.viewIsland,'home');
});
test('blocked back placement does not buy a stranded front gate or spend money',()=>{
 const g=fixture();for(let z=-6;z<=6;z+=2)for(let x=-10;x<=10;x+=2)g.objects.push({id:`block-${x}-${z}`,type:'pod',x,z,rotation:0,island:'spore',side:'back'});tick(g,.1,()=>.5);assert.equal(gates(g).length,0);assert.equal(g.money,1500);
});

test('completing Nether discovery autonomously builds a usable cross-face route',()=>{
 const g=fixture();delete g.space.backs.spore;g.objects.push({id:'spore-portal',type:'portal',x:0,z:0,rotation:0,island:'spore',side:'front'});
 for(let i=0;i<300;i++)tick(g,.1,()=>.5);assert.equal(g.space.backs.spore,true);assert.equal(gates(g).length,2);g.autonomy.enabled=false;g.queue=[];
 const front=gates(g).find(o=>o.side==='front'),back=gates(g).find(o=>o.side==='back');assert.equal(enqueue(g,'travel',front.id,undefined,null,back.id).ok,true);for(let i=0;i<300;i++)tick(g,.1,()=>.5);assert.equal(g.player.side,'back');assert.equal(g.player.island,'spore');
});
