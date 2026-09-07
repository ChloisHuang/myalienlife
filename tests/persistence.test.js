import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {saveApi} from '../server/save-api.js';
import {createProjectConfigStore} from '../server/project-config-store.js';
import {createGame} from '../src/simulation.js';
const implementation=await import('../server/save-store.js').catch(()=>({}));
async function setup(t){assert.equal(typeof implementation.createSaveStore,'function');const dir=await mkdtemp(join(tmpdir(),'orbit-save-'));t.after(()=>rm(dir,{recursive:true,force:true}));return{dir,store:implementation.createSaveStore(dir)};}
const request=(state,baseRevision=0,clientId='client-a',sequence=1)=>({state,baseRevision,clientId,sequence});
test('reload reads wait for a save already being written',async t=>{const {store}=await setup(t),game=createGame();game.day=9;const writing=store.write(request(game));const loaded=await store.read();await writing;assert.equal(loaded.state?.day,9);});
test('server save persists the full game to disk and survives a new store instance',async t=>{const {store,dir}=await setup(t),g=createGame();g.day=9;g.money=4260;assert.equal((await store.read()).state,null);const saved=await store.write(request(g));assert.equal(saved.revision,1);const restarted=implementation.createSaveStore(dir);assert.deepEqual((await restarted.read()).state,g);assert.equal(JSON.parse(await readFile(join(dir,'orbit-life.json'),'utf8')).state.money,4260);});
test('stale browser cannot overwrite a newer save',async t=>{const {store}=await setup(t),g=createGame();await store.write(request(g));g.day=2;await store.write(request(g,1,'client-b',1));await assert.rejects(store.write(request(createGame(),1,'client-a',2)),e=>e.status===409);assert.equal((await store.read()).state.day,2);});
test('overlapping saves from one page retain the latest sequence and reject late old writes',async t=>{const {store}=await setup(t),g=createGame();await store.write(request(g));g.minute=600;await store.write(request(g,0,'client-a',3));await assert.rejects(store.write(request(createGame(),0,'client-a',2)),e=>e.status===409);assert.equal((await store.read()).state.minute,600);});
test('invalid incoming saves and damaged files never silently reset existing progress',async t=>{const {store,dir}=await setup(t),g=createGame();await store.write(request(g));g.needs.hunger=-1;await assert.rejects(store.write(request(g,1,'client-a',2)));assert.equal((await store.read()).revision,1);await writeFile(join(dir,'orbit-life.json'),'not json');await assert.rejects(store.read());});
test('HTTP API restores a saved world after restarting its server and refuses conflicting writes',async t=>{
 const {dir}=await setup(t);
 async function start(){const middleware=saveApi(implementation.createSaveStore(dir)),server=createServer((req,res)=>middleware(req,res,()=>{res.statusCode=404;res.end();}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return{url:`http://127.0.0.1:${server.address().port}/api/save`,close:()=>new Promise(resolve=>server.close(resolve))};}
 let server=await start();const game=createGame();game.day=9;game.money=4260;
 try{const response=await fetch(server.url,{method:'POST',body:JSON.stringify(request(game))});assert.equal(response.status,200);}finally{await server.close();}
 server=await start();try{
  const response=await fetch(server.url),saved=await response.json();assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(saved.state.day,9);assert.equal(saved.state.money,4260);
  assert.equal((await fetch(server.url,{method:'POST',body:JSON.stringify(request(createGame(),0,'client-b'))})).status,409);
  assert.equal((await fetch(server.url,{method:'POST',body:'not json'})).status,400);
  assert.equal((await fetch(server.url,{method:'POST',headers:{Origin:'http://different.example'},body:JSON.stringify(request(game,1))})).status,403);
  await writeFile(join(dir,'orbit-life.json'),'damaged');assert.equal((await fetch(server.url)).status,500);
 }finally{await server.close();}
});
test('project defaults persist the current configuration independently from a game save',async t=>{
 const {dir}=await setup(t),store=createProjectConfigStore(join(dir,'project-config.json')),config=createGame().config;
 assert.deepEqual(await store.read(),config);config.time.starYearDays=4;config.crops.garden.giantChance=7;
 await store.write(config);const restarted=createProjectConfigStore(join(dir,'project-config.json')),loaded=await restarted.read(),newGame=createGame(loaded);assert.equal(loaded.time.starYearDays,4);assert.equal(loaded.crops.garden.giantChance,7);assert.equal(newGame.config.time.starYearDays,4);assert.equal(newGame.config.crops.garden.giantChance,7);
});
