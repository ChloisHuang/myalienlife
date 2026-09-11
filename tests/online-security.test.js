import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WebSocket} from 'ws';
import {setTimeout as delay} from 'node:timers/promises';

test('public viewers cannot mutate; last explicit claim fences all old browser commands',async()=>{
 const {createHttpService}=await import('../server/http-service.js');const dir=await mkdtemp(join(tmpdir(),'orbit-http-'));
 let service;
 try{
  const token='test-passphrase';service=await createHttpService({directory:dir,dist:dir,token,origin:'https://game.example',autoStart:false});
  await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${service.server.address().port}`;
  const request=(path,body,extra={})=>fetch(base+path,{method:body?'POST':'GET',headers:{Origin:'https://game.example','Content-Type':'application/json','X-Orbit-Client':'browser-a',...extra},body:body?JSON.stringify(body):undefined});
  assert.equal((await request('/api/state')).status,200);
  assert.equal((await request('/api/visitors')).status,401);
  assert.equal((await request('/api/command',{name:'speed',args:[0]})).status,401);
  assert.equal((await request('/api/login',{token:'wrong'})).status,401);
  const login=await request('/api/login',{token});assert.equal(login.status,200);assert.equal(login.headers.get('set-cookie'),null);
  const session=(await login.json()).session;assert.notEqual(session,token);const Authorization=`Bearer ${session}`;
  const stats=await request('/api/visitors',undefined,{Authorization});assert.equal(stats.status,200);const summary=await stats.json();assert.equal(summary.totalVisits,1);assert.equal(summary.onlineCount,0);assert.equal(summary.operatorHeld,false);
  assert.equal((await request('/api/command',{name:'speed',args:[0]},{Authorization})).status,409);
  const a=await (await request('/api/control/claim',{}, {Authorization})).json();
  const held=await (await request('/api/visitors',undefined,{Authorization})).json();assert.equal(held.operatorHeld,true);
  const headersA={Authorization,'X-Orbit-Epoch':String(a.epoch)};
  assert.equal((await request('/api/command',{name:'speed',args:[0]},headersA)).status,200);
  const b=await (await request('/api/control/claim',{}, {Authorization,'X-Orbit-Client':'browser-b'})).json();
  assert.equal((await request('/api/command',{name:'speed',args:[3]},headersA)).status,409);
  assert.equal(service.authority.state.speed,0);
  const headersB={Authorization,'X-Orbit-Client':'browser-b','X-Orbit-Epoch':String(b.epoch)};
  assert.equal((await request('/api/command',{name:'speed',args:[1]},headersB)).status,200);
  assert.equal((await request('/api/command',{name:'replaceState',args:[{}]},headersB)).status,400);
  assert.equal((await request('/api/command',{name:'enqueue',args:['__proto__']},headersB)).status,400);
  assert.equal((await request('/api/save',{state:{money:999}},headersB)).status,404);
  assert.equal((await request('/api/command',{name:'speed',args:[0]},{...headersB,Origin:'https://evil.example'})).status,403);
  assert.equal((await request('/api/control/release',{})).status,401);
  assert.equal((await request('/api/control/release',{},headersA)).status,409);
  const released=await request('/api/control/release',{},headersB);assert.equal(released.status,200);
  const releasedStatus=await released.json();assert.equal(releasedStatus.authenticated,true);assert.equal(releasedStatus.canOperate,false);assert.ok(releasedStatus.epoch>b.epoch);
  assert.equal((await request('/api/command',{name:'speed',args:[3]},headersB)).status,409);
  assert.equal((await(await request('/api/visitors',undefined,{Authorization})).json()).operatorHeld,false);
  await writeFile(join(dir,'token.txt'),'private');assert.equal((await request('/token.txt')).status,404);
  assert.equal((await request('/api/state')).status,200);assert.equal(service.authority.state.speed,1);
 }finally{await service?.close();await rm(dir,{recursive:true,force:true});}
});

test('closing the controller websocket releases stale edit ownership',async()=>{
 const {createHttpService}=await import('../server/http-service.js');const dir=await mkdtemp(join(tmpdir(),'orbit-http-'));let service,socket;
 try{
  const token='test-passphrase';service=await createHttpService({directory:dir,dist:dir,token,origin:'https://game.example',autoStart:false});
  await new Promise(resolve=>service.server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${service.server.address().port}`;
  const request=(path,body,extra={})=>fetch(base+path,{method:body?'POST':'GET',headers:{Origin:'https://game.example','Content-Type':'application/json','X-Orbit-Client':'browser-a',...extra},body:body?JSON.stringify(body):undefined});
  const login=await request('/api/login',{token}),{session}=await login.json(),headers={Authorization:`Bearer ${session}`,'X-Orbit-Client':'browser-a'};
  socket=new WebSocket(base.replace('http','ws')+'/api/stream',{origin:'https://game.example'});
  await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
  const frame=new Promise((resolve,reject)=>{socket.once('message',data=>resolve(JSON.parse(data)));socket.once('error',reject);});socket.send(JSON.stringify({type:'auth',client:'browser-a',session,authVersion:0}));await frame;
  const claim=await(await request('/api/control/claim',{},headers)).json();assert.equal(claim.canOperate,true);assert.equal((await(await request('/api/visitors',undefined,headers)).json()).operatorHeld,true);
  await new Promise((resolve,reject)=>{socket.once('close',resolve);socket.once('error',reject);socket.close();});
  // The client close event can precede the server's close handler.
  let stats;const deadline=Date.now()+2000;
  do{stats=await(await request('/api/visitors',undefined,headers)).json();if(stats.onlineCount===0&&!stats.operatorHeld)break;await delay(20);}while(Date.now()<deadline);
  assert.equal(stats.onlineCount,0);assert.equal(stats.operatorHeld,false);
 }finally{socket?.terminate();await service?.close();await rm(dir,{recursive:true,force:true});}
});
