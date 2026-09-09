import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,switchControl,enqueue,enqueueStudy,tick,serialize,restore,autonomousCandidates} from '../src/simulation.js';
import {studyFacilitySkill,FOUNDATION_FOR} from '../src/education.js';

function setup(){const g=createGame();switchControl(g,'pip');g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;for(const k in g.config.needDecay)g.config.needDecay[k]=0;return g;}
function finish(g){for(let i=0;i<3000&&g.queue.length;i++)tick(g,.1);assert.equal(g.queue.length,0);}
test('each lesson uses its own scene and awards the corresponding foundation',()=>{
 for(const [type,skill] of Object.entries({music:'music',garden:'botany',lab:'science',stove:'cooking'})){
  const g=setup();let target=g.objects.find(o=>o.type===type);
  if(!target){target={...g.objects.find(o=>o.type==='lab'),type,id:'test-stove'};g.objects=g.objects.filter(o=>o.id!=='lab');g.objects.push(target);}
  g.player.education.focus=skill;assert.equal(enqueueStudy(g).ok,true);assert.equal(g.queue[0].targetId,target.id);assert.equal(g.queue[0].studySkill,skill);
  finish(g);assert.equal(g.player.education.foundation[FOUNDATION_FOR[skill]],1);assert.equal(g.skills[skill],0);
 }
});
test('language learning takes place with an idle resident and finishes',()=>{
 const g=setup();g.player.education.focus='social';assert.equal(enqueueStudy(g).ok,true);assert.ok(g.npcs[g.queue[0].targetId]);
 finish(g);assert.equal(g.player.education.foundation.expression,1);
});
test('missing music equipment does not redirect music to a blueprint table',()=>{
 const g=setup();g.objects=g.objects.filter(o=>o.type!=='music');g.player.education.focus='music';
 assert.equal(enqueueStudy(g).ok,false);assert.equal(g.queue.length,0);assert.equal(studyFacilitySkill({type:'blueprintTable'}),undefined);
});
test('direct interaction determines the subject and AI candidates match their target',()=>{
 const g=setup();g.player.education.focus='music';enqueue(g,'study','lab');assert.equal(g.queue[0].studySkill,'science');
 for(const c of autonomousCandidates(g,'player').filter(c=>c.type==='study'))assert.equal(c.studySkill,studyFacilitySkill(g.npcs[c.targetId]??g.objects.find(o=>o.id===c.targetId)));
});
test('obsolete workbench lessons are canceled without losing earned education',()=>{
 const g=setup();enqueue(g,'study','lab');g.queue[0].studySkill='music';delete g.queue[0].studyVersion;g.player.education.foundation.arts=4;
 const saved=restore(serialize(g));assert.equal(saved.queue.length,0);assert.equal(saved.player.education.foundation.arts,4);
});
