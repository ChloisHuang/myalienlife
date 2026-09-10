import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,enqueue,tick,restore,serialize,switchControl} from '../src/simulation.js';
import {EDUCATION_LEVELS,createEducation,completeStudy,chooseMajor,educationLevel} from '../src/education.js';
import {displayNumber} from '../src/display-number.js';

test('seven qualifications advance in order',()=>{assert.deepEqual(EDUCATION_LEVELS.map(l=>l.name),['幼儿园','小学','中学','高中','大学','研究生','博士']);});
test('school lessons develop foundations, never professional XP, including the university boundary',()=>{
 const p=createGame().npcs.pip,skills={...p.skills};p.education.credits=71;for(const key in p.education.foundation)p.education.foundation[key]=18;
 completeStudy(p,skills,'science',()=>0);assert.equal(p.education.foundation.logic,19);assert.deepEqual(skills,p.skills);assert.equal(educationLevel(p).name,'大学');assert.ok(p.education.major);
});
test('major is chosen autonomously from existing interests and foundations and stays fixed',()=>{
 const p=createGame().npcs.pip;p.education.credits=72;for(const key in p.education.foundation)p.education.foundation[key]=18;p.preferences={dance:100};chooseMajor(p,()=>.99);assert.equal(p.education.major,'music');
 p.preferences={research:100};chooseMajor(p,()=>0);assert.equal(p.education.major,'music');
 const skills={...p.skills};completeStudy(p,skills,'music',()=>0);assert.equal(skills.music,2);completeStudy(p,skills,'science',()=>0);assert.equal(skills.science,1);
 const saved=structuredClone(p.education);assert.equal(saved.major,'music');
});
test('an adult can continue education and switching control preserves foundation and major',()=>{
 const g=createGame();g.autonomy.enabled=false;for(const n of Object.values(g.npcs))n.ai.enabled=false;
 g.player.education.credits=72;for(const key in g.player.education.foundation)g.player.education.foundation[key]=18;g.player.education.major='science';g.player.education.focus='science';const before=g.skills.science;
 g.career.id='student';assert.equal(enqueue(g,'study','lab').ok,true);for(let i=0;i<1500&&g.queue.length;i++)tick(g,.1,()=>0);
 assert.equal(g.skills.science,before+2);switchControl(g,'pip');const restored=restore(serialize(g));assert.equal(restored.npcs.kai.education.major,'science');
});
test('old education upgrades explicitly without erasing existing professional skills',()=>{
 const g=createGame();g.player.education={credits:6,focus:'science'};g.skills.science=17.3333333333;
 const saved=restore(serialize(g));assert.equal(educationLevel(saved.player).name,'幼儿园');assert.equal(saved.skills.science,g.skills.science);assert.equal(saved.player.education.version,3);
 const invalid=createGame();invalid.player.education.foundation.logic=-1;assert.throws(()=>restore(serialize(invalid)));
});
test('display formatting hides noisy decimals without rounding simulation state',()=>{
 assert.equal(displayNumber(2.123456789),'2.12');assert.equal(displayNumber(2),'2');assert.equal(displayNumber(.30000000000004),'0.3');const p=createEducation(0);assert.equal(p.credits,0);
});
test('all majors retain a nonzero probability even with one overwhelming interest',()=>{
 const counts=Object.fromEntries(['cooking','science','botany','social','music'].map(key=>[key,0]));
 for(let i=0;i<1000;i++){const p=createGame().npcs.pip;p.preferences={dance:100};p.education.credits=72;for(const key in p.education.foundation)p.education.foundation[key]=18;chooseMajor(p,()=>i/1000);counts[p.education.major]++;}
 assert.ok(Object.values(counts).every(n=>n>0));assert.ok(counts.music>counts.science);assert.ok(counts.music>500);
});
test('university specialization and foundation XP round-trip exactly',()=>{
 const g=createGame();g.player.education.credits=71;for(const key in g.player.education.foundation)g.player.education.foundation[key]=18;g.player.education.focus='science';completeStudy(g.player,g.skills,'science',()=>0);
 const restored=restore(serialize(g));assert.deepEqual(restored.player.education,g.player.education);
});
