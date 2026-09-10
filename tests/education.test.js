import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,enqueue,tick,restore,serialize,switchControl,cancelAction,autonomousCandidates,setCareer} from '../src/simulation.js';
import {DEFAULT_STUDY_SUCCESS_CHANCE,createEducation,educationLevel,educationWage,studyInterest,studySubject} from '../src/education.js';

function setup(){const g=createGame();switchControl(g,'pip');g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;for(const k in g.config.needDecay)g.config.needDecay[k]=0;return g;}
function finish(g,random=()=>0){for(let i=0;i<3000&&g.queue.length;i++)tick(g,.1,random);assert.equal(g.queue.length,0);}
test('study records the selected subject at enrollment and persists it',()=>{
 const g=setup();g.player.education.focus='music';assert.equal(enqueue(g,'study',g.objects.find(o=>o.type==='music').id).ok,true);g.player.education.focus='science';
 const saved=restore(serialize(g));assert.ok(saved);finish(saved);assert.equal(saved.skills.music,0);assert.equal(saved.skills.science,0);assert.equal(saved.player.education.credits,1);assert.equal(saved.player.education.foundation.arts,1);
});
test('study progression is slower and each lesson can fail',()=>{
 const g=setup();assert.equal(g.config.actionDurations.study,60);assert.equal(g.config.education.studySuccessChance,DEFAULT_STUDY_SUCCESS_CHANCE);
 g.player.education.focus='music';assert.equal(enqueue(g,'study',g.objects.find(o=>o.type==='music').id).ok,true);finish(g,()=>.6);
 assert.equal(g.player.education.credits,0);assert.equal(g.player.education.foundation.arts,0);assert.match(g.log[0].text,/学习失败/);
 const success=setup();success.player.education.focus='music';assert.equal(enqueue(success,'study',success.objects.find(o=>o.type==='music').id).ok,true);finish(success,()=>.59);
 assert.equal(success.player.education.credits,1);assert.equal(success.player.education.foundation.arts,1);
});
test('canceled study earns nothing and infants cannot enroll',()=>{
 const g=setup();enqueue(g,'study','lab');cancelAction(g,g.queue[0].id);assert.equal(g.player.education.credits,0);
 for(const age of [1]){g.player.age=age;assert.equal(enqueue(g,'study','lab').ok,false);}
 assert.equal(enqueue(setup(),'study','pod').ok,false);
});
test('adult study requires the continuing-education career and has no work income',()=>{
 const g=setup();g.player.age=20;assert.equal(enqueue(g,'study','lab').ok,false);assert.match(enqueue(g,'study','lab').message,/继续学习/);
 assert.equal(setCareer(g,'student'),true);assert.equal(g.career.id,'student');assert.equal(enqueue(g,'work','lab').ok,false);assert.equal(enqueue(g,'study','lab').ok,true);
 const before=g.money;finish(g);assert.equal(g.money,before);assert.equal(g.player.education.credits,1);
});
test('education scales real wages while keeping adult legacy wages unchanged',()=>{
 for(const [credits,multiplier] of [[0,.65],[6,.75],[18,.85],[36,1],[72,1.2],[144,1.4],[240,1.6]]){
  const g=setup();g.player.age=20;g.player.education.credits=credits;for(const key in g.player.education.foundation)g.player.education.foundation[key]=30;g.career={id:'scientist',level:1,shifts:0};g.skills.science=6;
  const before=g.money;assert.equal(enqueue(g,'work','lab').ok,true);finish(g);assert.equal(g.money-before,Math.round(180*multiplier));
 }
 assert.equal(educationWage(createGame().player,180),117);
});
test('legacy migration and malformed education are distinguished',()=>{
 const g=createGame();delete g.player.education;delete g.npcs.pip.education;const old=restore(serialize(g));assert.equal(old.player.education.credits,0);assert.equal(old.npcs.pip.education.credits,0);
 g.player.education={credits:-1,focus:'music'};assert.throws(()=>restore(serialize(g)));
});
test('learning preferences gate adult study candidates behind the continuing-education career',()=>{
 const g=setup();assert.ok(studyInterest(g.player,'music')>studyInterest(g.player,'science'));
 assert.ok(autonomousCandidates(g,'player').some(c=>c.type==='study'));g.player.age=18;assert.ok(!autonomousCandidates(g,'player').some(c=>c.type==='study'));setCareer(g,'student');assert.ok(autonomousCandidates(g,'player').some(c=>c.type==='study'));
 g.player.education.credits=240;for(const key in g.player.education.foundation)g.player.education.foundation[key]=30;assert.equal(educationLevel(g.player).name,'博士');assert.equal(createEducation(0).credits,0);
});
test('autonomous study honors chosen skills and stronger interest increases study choices',()=>{
 const counts=[];
 for(const interest of [0,100]){let count=0;for(let i=0;i<100;i++){
  const g=setup();g.player.preferences={study:interest,garden:30};g.player.education.focus='music';g.autonomy.enabled=true;g.autonomy.cooldown=0;for(const key in g.needs)g.needs[key]=85;
  tick(g,.1,()=>i/100);if(g.queue[0]?.type==='study'){count++;assert.equal(g.queue[0].studySkill,'music');}
 }counts.push(count);}assert.ok(counts[1]>counts[0],`${counts}`);
 const g=setup();g.player.education.focus=null;g.player.preferences={dance:100};const subjects=Array.from({length:100},(_,i)=>studySubject(g.player,()=>i/100));assert.ok(subjects.filter(s=>s==='music').length>60);
});
test('education and pending study survive control switching and NPC wage payout',()=>{
 const g=setup();g.player.education.focus='botany';enqueue(g,'study',g.objects.find(o=>o.type==='garden').id);const uid=g.player.uid;switchControl(g,'nova');g.autonomy.enabled=false;
 for(let i=0;i<3000&&g.npcs[uid].queue.length;i++)tick(g,.1,()=>0);
 assert.equal(g.npcs[uid].education.credits,1);assert.equal(g.npcs[uid].education.foundation.nature,1);
 switchControl(g,uid);g.player.age=20;g.player.education.credits=240;for(const key in g.player.education.foundation)g.player.education.foundation[key]=30;g.career.id='scientist';g.skills.science=6;assert.equal(enqueue(g,'work','lab').ok,true);const before=g.money;switchControl(g,'nova');g.autonomy.enabled=false;
 for(let i=0;i<3000&&g.npcs[uid].queue.length;i++)tick(g,.1);
 assert.equal(g.npcs[uid].money-before,288);
});
test('initial education follows configured adulthood and invalid queued subjects are rejected',()=>{
 const g=createGame({lifeStages:{teenEnd:30,adultEnd:60}});assert.equal(g.player.education.credits,0);
 const child=setup();enqueue(child,'study','lab');child.queue[0].studySkill='unknown';assert.throws(()=>restore(serialize(child)));
});
