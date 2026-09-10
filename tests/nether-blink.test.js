import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,enqueue,tick,restore,ACTIONS} from '../src/simulation.js';
function fixture(){const g=createGame();g.player.prayer.nether=10;g.money=0;g.objects=g.objects.filter(o=>o.type!=='gate');g.objects.push({id:'back-lab',type:'lab',x:0,z:0,rotation:0,island:'home',side:'back'});g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;return g;}
test('cross-face research uses blink as movement and then completes the requested work',()=>{
 const g=fixture();assert.equal(ACTIONS.blink,undefined);assert.equal(enqueue(g,'research','back-lab').ok,true);tick(g,.6);assert.equal(g.queue[0].type,'research');assert.ok(g.queue[0].blinkTransit);assert.equal(g.player.side,'front');tick(g,2);assert.equal(g.player.side,'back');assert.equal(g.queue[0].blinkTransit,undefined);for(let i=0;i<200;i++)tick(g,.1);assert.equal(g.queue.length,0);assert.equal(g.money,0);assert.equal(enqueue(g,'research','lab').ok,true);tick(g,3);assert.equal(g.player.side,'front');
});
test('ordinary race cannot cross without gates; Nether same-face movement also blinks',()=>{
 const g=fixture();g.player.prayer.nether=0;assert.equal(enqueue(g,'research','back-lab').ok,false);g.player.prayer.nether=10;assert.equal(enqueue(g,'research','lab').ok,true);tick(g,.1);assert.ok(g.queue[0].blinkTransit);
});
test('autonomous work uses innate blink without selecting an independent blink activity',()=>{
 const g=fixture();g.objects=g.objects.filter(o=>o.id==='back-lab');g.npcs={};g.autonomy.enabled=true;g.autonomy.cooldown=0;g.player.preferences.research=10;for(const k in g.needs)g.needs[k]=75;tick(g,.1,()=>0);assert.equal(g.queue[0].type,'work');assert.ok(g.queue[0].blinkTransit);tick(g,3,()=>0);assert.equal(g.player.side,'back');
});
test('mid-movement save resumes the original action and migrates obsolete blink actions',()=>{
 const g=fixture();enqueue(g,'research','back-lab');tick(g,1.5);const loaded=restore(JSON.stringify(g));assert.ok(loaded.queue[0].blinkTransit);tick(loaded,1);assert.equal(loaded.player.side,'back');assert.equal(loaded.queue[0].type,'research');
 const old=fixture();old.version=17;old.queue=[{type:'blink'}];old.config.actionDurations.blink=2.4;const migrated=restore(JSON.stringify(old));assert.equal(migrated.version,23);assert.equal(migrated.queue.length,0);assert.equal(migrated.config.actionDurations.blink,undefined);assert.equal(migrated.money,old.money);
});
test('lost ability or newly obstructed landing cancels the crossing without teleporting',()=>{
 for(const block of [g=>g.player.prayer.nether=0,g=>g.objects.push({id:'block',type:'pod',...g.queue[0].path[0]})]){const g=fixture();enqueue(g,'research','back-lab');tick(g,.6);block(g);tick(g,3);assert.equal(g.player.side,'front');assert.equal(g.queue[0]?.blinkTransit,undefined);}
});

test('daily same-face blink never reveals a remote back; autonomous exploration discovers it without a portal',()=>{
 const g=fixture();g.player.island='spore';g.objects=[];g.npcs={};g.viewIsland='spore';g.viewSide='front';assert.equal(enqueue(g,'walk',null,{x:3,z:2}).ok,true);tick(g,3);assert.equal(g.space.backs.spore,undefined);assert.equal(g.player.x,3);
 g.autonomy.enabled=true;g.autonomy.cooldown=0;for(const k in g.needs)g.needs[k]=80;tick(g,.1,()=>0);assert.equal(g.queue[0].type,'walk');assert.equal(g.queue[0].target.side,'back');assert.ok(g.queue[0].blinkTransit);tick(g,3,()=>0);assert.equal(g.space.backs.spore,true);assert.equal(g.player.side,'back');assert.equal(ACTIONS.senseNether,undefined);
});
test('an existing walking route switches to blink without reissuing the action',()=>{
 const g=fixture();g.player.prayer.nether=0;enqueue(g,'research','lab');tick(g,.1);assert.equal(g.queue[0].blinkTransit,undefined);g.player.prayer.nether=10;tick(g,.1);assert.ok(g.queue[0].blinkTransit);assert.equal(g.queue[0].type,'research');
});
