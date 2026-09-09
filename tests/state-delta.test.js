import test from 'node:test';
import assert from 'node:assert/strict';
import patch from 'fast-json-patch';
import {createStateStream} from '../server/state-stream.js';
import {createGame,tick} from '../src/simulation.js';

test('delta stream reconstructs changes, deletes, arrays and independent viewer baselines',()=>{
 const stream=createStateStream();const a={money:10,people:[{x:1}],removed:true};
 const first=stream.snapshot(a);
 const b={money:20,people:[{x:2},{x:3}]};const second=stream.snapshot(b,first.stateId);
 assert.ok(second.patch);assert.equal(second.state,undefined);
 assert.deepEqual(patch.applyPatch(first.state,second.patch,true,false).newDocument,b);
 const unchanged=stream.snapshot(b,second.stateId);assert.deepEqual(unchanged.patch,[]);
 assert.deepEqual(patch.applyPatch(first.state,stream.snapshot(b,first.stateId).patch,true,false).newDocument,b);
 assert.deepEqual(stream.snapshot(b,'old-server:1').state,b);
 for(let i=0;i<40;i++)stream.snapshot({money:i});
 assert.deepEqual(stream.snapshot(b,first.stateId).state,b);
});
test('real simulation deltas match full state after skipped responses and baseline expiry',()=>{
 const stream=createStateStream(),game=createGame();let confirmed=stream.snapshot(game),local=confirmed.state;
 for(let i=0;i<100;i++){
  tick(game,.25);if(i===20)game.player.side='back';if(i===40)game.player.side='front';
  if(i%4===0){stream.snapshot(game,confirmed.stateId);continue;}
  if(i===50)for(let n=0;n<20;n++)stream.snapshot(game);
  const response=stream.snapshot(game,confirmed.stateId);
  local=response.patch?patch.applyPatch(local,response.patch,true,false).newDocument:response.state;
  assert.deepEqual(local,JSON.parse(JSON.stringify(game)));confirmed=response;
 }
});
