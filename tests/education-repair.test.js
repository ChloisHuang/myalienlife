import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,restore,serialize} from '../src/simulation.js';
import {createEducation,educationLevel,higherEducation,migrateEducation,completeStudy} from '../src/education.js';

test('new adults do not receive unearned school credits',()=>{assert.equal(createEducation(32).credits,0);});
test('Luowa legacy credits are repaired from actual foundations, once, without changing professional skills',()=>{
 const g=createGame(),p=g.npcs.pip;p.education={version:2,credits:51,focus:null,foundation:{practical:1,logic:0,nature:0,expression:1,arts:1},major:null};const before=structuredClone(p.skills);
 const fixed=restore(serialize(g));assert.equal(fixed.npcs.pip.education.credits,3);assert.equal(educationLevel(fixed.npcs.pip).name,'幼儿园');assert.deepEqual(fixed.npcs.pip.skills,before);assert.deepEqual(restore(serialize(fixed)),fixed);
});
test('credits alone cannot skip foundation requirements and college cannot award professional XP early',()=>{
 const g=createGame(),p=g.npcs.pip;p.education.credits=144;assert.equal(educationLevel(p).name,'幼儿园');assert.equal(higherEducation(p),false);
 completeStudy(p,p.skills,'music',()=>0);assert.equal(p.skills.music,0);assert.equal(p.education.foundation.arts,1);
 for(const key in p.education.foundation)p.education.foundation[key]=9;
 assert.equal(educationLevel(p).name,'高中');assert.equal(higherEducation(p),false);
 for(const key in p.education.foundation)p.education.foundation[key]=18;
 assert.equal(educationLevel(p).name,'博士');assert.equal(higherEducation(p),true);
});
test('repair preserves supported higher education and does not invent foundation XP',()=>{
 const p=createGame().player;p.education.version=2;p.education.credits=150;p.education.major='science';for(const key in p.education.foundation)p.education.foundation[key]=18;
 migrateEducation(p);assert.equal(p.education.credits,150);assert.equal(p.education.major,'science');assert.equal(p.education.version,3);
});
