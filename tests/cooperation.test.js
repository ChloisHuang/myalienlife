import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,buyItem,enqueue,tick,restore,serialize,autonomousCandidates,cancelAction} from '../src/simulation.js';
import {autonomousCooperationReady} from '../src/cooperation.js';
const run=(g,n)=>{for(let i=0;i<n*10;i++)tick(g,.1,()=>0);};
function setup(){const g=createGame();g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;for(const k in g.config.needDecay)g.config.needDecay[k]=0;g.objects=[];const o=buyItem(g,'lamp',0,0).object;return {g,o};}
function action(g,o,type){return{id:g.nextId++,type,targetId:o.id,target:{x:0,z:1.2,side:'front'},source:'manual',phase:'waiting',elapsed:0,path:[]};}
test('even a strong multiplayer preference leaves invitations uncommon in the action lottery',()=>{
 const {g}=setup();g.autonomy.enabled=true;g.player.preferences={passOrb:100};g.needs.fun=20;g.needs.social=10;const snapshot=serialize(g);let invitations=0;
 for(let i=0;i<200;i++){const trial=restore(snapshot);let draws=0;tick(trial,.1,()=>draws++===0?i/200:0);if(trial.queue[0]?.type==='passOrb')invitations++;}
 assert.ok(invitations>0);assert.ok(invitations<20,`${invitations} invitations out of 200 choices`);
});
test('both participants get six game hours without automatic invitations after completion, including reload',()=>{
 const {g,o}=setup();enqueue(g,'passOrb',o.id,undefined,'nova');run(g,40);o.wonder.cooldown=0;const saved=restore(serialize(g));
 const p={ai:saved.autonomy,queue:saved.queue};assert.equal(autonomousCooperationReady(saved,p),false);assert.equal(autonomousCooperationReady(saved,saved.npcs.nova),false);
 assert.equal(autonomousCandidates(saved,'player').some(c=>c.type==='passOrb'),false);
 // Explicit player arrangements still work during the automatic invitation interval.
 assert.equal(enqueue(saved,'passOrb',o.id,undefined,'nova').ok,true);cancelAction(saved,saved.queue[0].id);
 const expiry=saved.autonomy.cooperationAfter;saved.day=Math.floor(expiry/1440)+1;saved.minute=expiry%1440;
 assert.equal(autonomousCooperationReady(saved,{ai:saved.autonomy,queue:saved.queue}),true);
});
test('a queued sofa gathering prevents another kind of automatic invitation from stacking on that resident',()=>{
 const {g}=setup(),sofa=buyItem(g,'sofa',4,0).object;enqueue(g,'lounge',sofa.id);
 g.npcs.zig.side=g.npcs.lumi.side=g.npcs.pip.side='back';assert.equal(autonomousCandidates(g,'nova').some(c=>c.type==='passOrb'),false);
});
test('a waiting invitation does not reserve the device needed by the guests prior task',()=>{
 const {g,o}=setup();enqueue(g,'passOrb',o.id,undefined,'nova');g.npcs.nova.queue.unshift(action(g,o,'chaseOrb'));
 run(g,115);assert.equal(g.relationships.nova,33);assert.equal(g.queue.length,0);assert.equal(g.npcs.nova.queue.length,0);
});
test('cyclic invitations release the newer group immediately and the older group completes',()=>{
 const {g,o}=setup(),a=action(g,o,'passOrb'),b=action(g,o,'passOrb');Object.assign(a,{partnerId:'nova',invited:true});Object.assign(b,{partnerId:'player',invited:true});
 const guestA={...action(g,o,'passOrb'),hostId:'player',hostActionId:a.id},guestB={...action(g,o,'passOrb'),hostId:'nova',hostActionId:b.id};
 g.queue=[a,guestB];g.npcs.nova.queue=[b,guestA];tick(g,.1,()=>0);assert.equal(g.queue.length,1);assert.equal(g.npcs.nova.queue.length,1);
 run(g,40);assert.equal(g.relationships.nova,33);assert.equal(g.queue.length,0);assert.equal(g.npcs.nova.queue.length,0);
});
test('a prolonged wait releases both invitations and preserves the guests unrelated work across reload',()=>{
 const {g,o}=setup(),pod=buyItem(g,'pod',4,0).object;g.config.actionDurations.sleep=500;g.npcs.nova.queue=[{...action(g,pod,'sleep'),phase:'acting'}];enqueue(g,'passOrb',o.id,undefined,'nova');run(g,100);
 const loaded=restore(serialize(g));run(loaded,85);assert.equal(loaded.queue.length,0);assert.equal(loaded.npcs.nova.queue.length,1);assert.equal(loaded.npcs.nova.queue[0].type,'sleep');assert.equal(loaded.relationships.nova,15);
});
test('urgent hunger releases a shared activity instead of waiting until starvation',()=>{
 const {g,o}=setup();enqueue(g,'passOrb',o.id,undefined,'nova');g.npcs.nova.needs.hunger=5;run(g,.1);assert.equal(g.queue.length,0);assert.equal(g.npcs.nova.queue.length,0);
});
test('sofa hosts start without a busy guest and late guests never wait for a finished host',()=>{
 const {g}=setup(),sofa=buyItem(g,'sofa',4,0).object,pod=buyItem(g,'pod',-4,0).object;g.config.actionDurations.sleep=100;g.npcs.nova.queue=[{...action(g,pod,'sleep'),phase:'acting'}];enqueue(g,'lounge',sofa.id);run(g,40);
 assert.equal(g.queue.length,0);assert.equal(g.npcs.nova.queue[0].type,'sleep');run(g,110);assert.equal(g.npcs.nova.queue.length,0);
});
