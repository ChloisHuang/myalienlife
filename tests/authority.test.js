import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createGame,tick,serialize,restore} from '../src/simulation.js';

test('server advances the exact existing simulation without a browser and saves it',async()=>{
 const {createAuthority}=await import('../server/authority.js');
 const dir=await mkdtemp(join(tmpdir(),'orbit-authority-'));
 try{
  const initial=createGame(),reference=restore(serialize(initial));
  initial.autonomy.enabled=reference.autonomy.enabled=false;
  for(const g of [initial,reference])for(const n of Object.values(g.npcs))n.ai.enabled=false;
  const runtime=await createAuthority({directory:dir,initial,autoStart:false});
  for(let i=0;i<600;i++)tick(reference,.05);
  runtime.advance(30000);runtime.advance(0);runtime.advance(0);assert.deepEqual(runtime.state,reference);await runtime.close();
  const restarted=await createAuthority({directory:dir,autoStart:false});assert.deepEqual(restarted.state,reference);await restarted.close();
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('autonomous gameplay follows the same core under identical random draws',async()=>{
 const {createAuthority}=await import('../server/authority.js');const dir=await mkdtemp(join(tmpdir(),'orbit-replay-')),original=Math.random;
 const random=()=>{let s=12345;return()=>((s=Math.imul(s,1664525)+1013904223>>>0)/4294967296);};
 let runtime;
 try{
  const initial=createGame(),reference=restore(serialize(initial));runtime=await createAuthority({directory:dir,initial,autoStart:false});
  Math.random=random();for(let i=0;i<3600;i++)tick(reference,.05);
  Math.random=random();for(let i=0;i<18;i++)runtime.advance(10000);
  assert.deepEqual(runtime.state,reference);
 }finally{Math.random=original;await runtime?.close();await rm(dir,{recursive:true,force:true});}
});

test('corrupt saves stop migration rather than being replaced by a new world',async()=>{
 const {createAuthority}=await import('../server/authority.js');const dir=await mkdtemp(join(tmpdir(),'orbit-corrupt-'));
 try{await writeFile(join(dir,'orbit-life.json'),'broken');await assert.rejects(createAuthority({directory:dir,autoStart:false}));assert.equal(await readFile(join(dir,'orbit-life.json'),'utf8'),'broken');}
 finally{await rm(dir,{recursive:true,force:true});}
});

test('pause and original queued actions retain their behavior through authority commands',async()=>{
 const {applyCommand}=await import('../src/game-commands.js');const g=createGame();
 assert.equal(applyCommand(g,{name:'speed',args:[0]}).ok,true);tick(g,60);assert.equal(g.minute,510);
 assert.equal(applyCommand(g,{name:'enqueue',args:['garden','garden']}).ok,true);assert.equal(g.queue[0].type,'garden');
 assert.throws(()=>applyCommand(g,{name:'replaceState',args:[{}]}));
 assert.throws(()=>applyCommand(g,{name:'speed',args:[999]}));
});
