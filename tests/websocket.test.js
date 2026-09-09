import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import WebSocket from 'ws';
import patch from 'fast-json-patch';
import {createHttpService} from '../server/http-service.js';

test('websocket sends full then ordered deltas and rejects foreign origins',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'orbit-ws-'));let service,socket;
 try{
  service=await createHttpService({directory:dir,dist:dir,token:'websocket-test-token',origin:'http://game.example',autoStart:false});
  await new Promise(r=>service.server.listen(0,'127.0.0.1',r));
  const url=`ws://127.0.0.1:${service.server.address().port}/api/stream`;
  socket=new WebSocket(url,{origin:'http://game.example',handshakeTimeout:1500});
  const frames=[];socket.on('message',data=>frames.push(JSON.parse(data)));
  await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
  socket.send(JSON.stringify({type:'auth',client:'viewer-a',session:'',authVersion:0}));
  await new Promise(r=>setTimeout(r,250));assert.ok(frames[0].state);assert.equal(frames[0].canOperate,false);
  service.authority.state.player.side='back';await new Promise(r=>setTimeout(r,450));
  let state=frames[0].state,id=frames[0].stateId;
  for(const frame of frames.slice(1)){assert.equal(frame.baseId,id);state=patch.applyPatch(state,frame.patch,true,false).newDocument;id=frame.stateId;}
  assert.equal(state.player.side,'back');assert.ok(frames.length>=3);
  const bad=new WebSocket(url,{origin:'http://evil.example'});await new Promise(resolve=>bad.once('error',resolve));
 }finally{socket?.terminate();await service?.close();await rm(dir,{recursive:true,force:true});}
});
