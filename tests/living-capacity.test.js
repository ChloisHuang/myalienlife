import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {gzipSync} from 'node:zlib';
import patch from 'fast-json-patch';
import {createGame} from '../src/simulation.js';
import {mutableResident,mutableSite,changeBond,validLiving,pruneLiving} from '../src/living-state.js';
import {advanceLiving} from '../src/living-world.js';

test('128 residents and 256 sites remain bounded under sustained pulse replication',()=>{
 const g=createGame();g.npcs={};
 for(let i=1;i<128;i++){const p=structuredClone(g.player);Object.assign(p,{uid:`load-${i}`,x:(i%16)*4,z:Math.floor(i/16)*4,island:'spore',side:i%2?'front':'back'});g.npcs[p.uid]=p;}
 const people=[g.player,...Object.values(g.npcs)];
 for(let i=0;i<people.length;i++){const p=people[i],s=mutableResident(g,p);s.garden=32;s.shadow=40;s.charge=80;s.fear=50;for(let j=1;j<=6;j++)changeBond(g,p,people[(i+j)%people.length],{trust:30});}
 for(let i=0;i<256;i++){const o={id:`load-plant-${i}`,type:'garden',island:'spore',side:'front',x:i%16*4,z:Math.floor(i/16)*4,plant:{health:70}};g.objects.push(o);mutableSite(g,o).keeper=people[i%128].uid;}
 const actors=people.map(p=>({position:p,needs:{comfort:100},queue:[]})),start=performance.now();let maxPatch=0,maxGzip=0;
 for(let i=0;i<144;i++){
  const before=structuredClone(g.living);g.minute+=10;if(g.minute>=1440){g.minute-=1440;g.day++;}advanceLiving(g,actors);
  const operations=patch.compare(before,g.living),encoded=JSON.stringify(operations);maxPatch=Math.max(maxPatch,Buffer.byteLength(encoded));maxGzip=Math.max(maxGzip,gzipSync(encoded).length);
  assert.deepEqual(patch.applyPatch(before,operations,true,false).newDocument,g.living);
 }
 const elapsed=performance.now()-start,bytes=Buffer.byteLength(JSON.stringify(g.living));
 assert.equal(validLiving(g),true);assert.ok(bytes<128*1000+256*100);assert.ok(maxPatch<60000);assert.ok(elapsed<15000);
 const uid=people[2].uid;delete g.npcs[uid];g.objects=g.objects.filter(o=>!o.id.startsWith('load-plant-'));pruneLiving(g);
 assert.equal(g.living.residents[uid],undefined);assert.ok(!Object.values(g.living.residents).some(s=>s.bonds.some(b=>b.uid===uid)));assert.equal(Object.keys(g.living.sites).length,0);
 console.log(JSON.stringify({residents:128,sites:256,pulses:144,livingBytes:bytes,maxPatchBytes:maxPatch,maxGzipBytes:maxGzip,elapsedMs:Math.round(elapsed)}));
});
