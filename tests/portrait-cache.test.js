import test from 'node:test';
import assert from 'node:assert/strict';
import {createPortraitCache} from '../src/portrait-cache.js';
import {portraitAppearanceKey} from '../src/portrait-appearance.js';
import {createGame} from '../src/simulation.js';
import {mutableResident} from '../src/living-state.js';

test('unchanged residents reuse images and one changed appearance renders only once',()=>{
 const calls=[],cache=createPortraitCache(id=>{calls.push(id);return `image-${calls.length}`;});
 const first=cache.get('uid-a','look-a','player');cache.get('uid-b','look-b','npc');
 assert.equal(cache.get('uid-a','look-a','player'),first);
 cache.get('uid-b','look-b2','npc');cache.get('uid-b','look-b2','npc');
 assert.deepEqual(calls,['player','npc','npc']);
});

test('portrait signatures ignore text, sub-stage birthdays, devotion and sub-threshold prayer',()=>{
 const game=createGame(),person=game.player,key=portraitAppearanceKey(game,person,true);
 person.name+=' renamed';person.devotion++;person.age++;person.prayer.radiance=1;person.x++;
 assert.equal(portraitAppearanceKey(game,person,true),key);
 assert.notEqual(portraitAppearanceKey(game,person,false),key);
});

test('portrait signatures track color, genes, life stages, prayer effects and living attachments',()=>{
 for(const change of [
  (g,p)=>p.color='#123456',(g,p)=>p.genome.headWidth+=.01,(g,p)=>p.age=1,
  (g,p)=>p.prayer.radiance=10,(g,p)=>p.prayer.nether=10,(g,p)=>p.prayer.mutations.push('freckles'),
  (g,p)=>g.config.lifeStages.adultEnd=p.age-1,
  (g,p)=>{const s=mutableResident(g,p);s.garden=24;s.charge=8;},
  (g,p)=>mutableResident(g,p).imprint='roots'
 ]){
  const game=createGame(),key=portraitAppearanceKey(game,game.player,true);change(game,game.player);
  assert.notEqual(portraitAppearanceKey(game,game.player,true),key);
 }
 const g=createGame(),p=g.player,s=mutableResident(g,p);s.garden=25;s.charge=8;
 const first=portraitAppearanceKey(g,p,true);s.garden=30;assert.notEqual(portraitAppearanceKey(g,p,true),first);
 const second=portraitAppearanceKey(g,p,true);s.charge=0;assert.notEqual(portraitAppearanceKey(g,p,true),second);
});

test('a failed render does not publish a successful cache entry',()=>{
 let fail=true,calls=0;const cache=createPortraitCache(()=>{calls++;if(fail)throw new Error('render failed');return 'ok';});
 assert.throws(()=>cache.get('a','key','player'),/render failed/);fail=false;
 assert.equal(cache.get('a','key','player'),'ok');assert.equal(calls,2);
});

test('cache identity is UID, not mutable player slots, and background changes invalidate',()=>{
 let calls=0;const cache=createPortraitCache(()=>++calls);
 const a=cache.get('a','look-green','player'),b=cache.get('b','look-purple','npc');
 assert.equal(cache.get('a','look-green','renamed-slot'),a);
 assert.notEqual(cache.get('a','look-purple','npc'),a);
 assert.notEqual(cache.get('b','look-green','player'),b);
 assert.equal(calls,4);
});

test('removed residents and new epochs release cached images',()=>{
 let calls=0;const cache=createPortraitCache(()=>++calls);
 cache.get('a','same','a');const b=cache.get('b','same','b');cache.retain(new Set(['b']));
 assert.equal(cache.get('b','same','b'),b);assert.equal(cache.get('a','same','a'),3);
 cache.clear();assert.equal(cache.get('b','same','b'),4);
});
