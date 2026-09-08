import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,enqueue,tick} from '../src/simulation.js';
import {actionAccessError,spaceResearchYield} from '../src/action-access.js';
const run=(g,n)=>{for(let i=0;i<n*10;i++)tick(g,.1,()=>0);};
function setup(){const g=createGame();g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;return g;}
test('advanced space research checks both profession rank and actual displayed skill level',()=>{
 const g=setup();g.skills.science=100;g.career.id='botanist';assert.match(enqueue(g,'spaceResearch','lab').message,/量子科学/);
 g.career.id='scientist';assert.match(enqueue(g,'spaceResearch','lab').message,/2 阶/);g.career.level=2;g.skills.science=17;assert.match(enqueue(g,'spaceResearch','lab').message,/科学技能 4 级/);
 g.skills.science=18;assert.equal(enqueue(g,'spaceResearch','lab').ok,true);run(g,40);assert.equal(g.civilization.technology,5);
 assert.ok(spaceResearchYield({level:3},{science:60})>spaceResearchYield({level:2},{science:18}));
});
test('basic research remains a learning path, but cannot bypass professional technology requirements',()=>{
 const g=setup();g.career.id='botanist';enqueue(g,'research','lab');run(g,30);assert.equal(g.civilization.knowledge,1);assert.equal(g.civilization.technology,0);
});
test('changing jobs during queued research prevents its technological reward',()=>{
 const g=setup();g.career.level=2;g.skills.science=18;enqueue(g,'spaceResearch','lab');run(g,3);g.career.id='botanist';run(g,40);assert.equal(g.civilization.technology,0);assert.equal(g.queue.length,0);
});
test('NPC autonomous choices obey the same profession and level rules',()=>{
 const g=setup(),n=g.npcs.nova;n.ai.enabled=true;n.preferences={spaceResearch:100};n.skills.science=18;n.career={id:'botanist',level:2,shifts:0};tick(g,.1,()=>0);assert.notEqual(n.queue[0]?.type,'spaceResearch');
 n.queue=[];n.ai.cooldown=0;n.career={id:'scientist',level:2,shifts:0};tick(g,.1,()=>0);assert.equal(n.queue[0]?.type,'spaceResearch');
 assert.match(actionAccessError(g,{id:'player',position:g.player,skills:{science:8}},'restoreMemory'),/科学技能 3 级/);
});
