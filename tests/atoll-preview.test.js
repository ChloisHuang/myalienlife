import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../src/simulation.js';
import {readPreviewSave} from '../src/atoll-preview.js';

test('preview reads the existing server save without writing or advancing it',async()=>{
 const state=createGame();state.day=159;state.player.name='存档居民';
 const calls=[];
 const result=await readPreviewSave(async(...args)=>{calls.push(args);return {ok:true,json:async()=>({revision:42,state})};});
 assert.equal(result.game.day,159);assert.equal(result.game.player.name,'存档居民');assert.equal(result.revision,42);
 assert.deepEqual(calls,[['/api/save',{cache:'no-store'}]]);
});

test('missing and failed saves do not silently create a new game',async()=>{
 await assert.rejects(readPreviewSave(async()=>({ok:true,json:async()=>({revision:0,state:null})})),/暂无存档/);
 await assert.rejects(readPreviewSave(async()=>({ok:false,json:async()=>({error:'读取失败'})})),/读取失败/);
});
