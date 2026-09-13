import test from 'node:test';
import assert from 'node:assert/strict';

const implementation=await import('../src/remote-save.js').catch(()=>({}));

test('local client requests a remote-to-local save import through the development endpoint',async()=>{
 assert.equal(typeof implementation.pullRemoteSave,'function');const calls=[];
 const result=await implementation.pullRemoteSave(async(url,options)=>{calls.push([url,options]);return{ok:true,status:200,json:async()=>({ok:true,revision:12,savedAt:'2026-09-13T08:00:00.000Z'})};});
 assert.deepEqual(calls,[['/api/pull-remote-save',{method:'POST',cache:'no-store'}]]);assert.equal(result.revision,12);
});
