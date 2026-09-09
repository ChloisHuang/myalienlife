import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {deploymentConfig} from './deploy-config.js';
import {root} from './build-release.js';
let input={};try{input=JSON.parse(await readFile(resolve(root,'deploy.config.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const {origin}=deploymentConfig(input),token=(await readFile(resolve(root,'.deploy/operator-token.txt'),'utf8')).trim();
async function request(path,body,headers={}){return fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});}
const before=await (await request('/api/state')).json();assert.ok(before.state);assert.equal(before.canOperate,false);
assert.equal((await request('/api/command',{name:'speed',args:[0]})).status,401);
assert.equal((await request('/api/save',{state:{}})).status,404);
assert.equal((await request('/production.mjs')).status,404);
const sessions=[];
try{
 for(const id of ['live-check-a','live-check-b']){const response=await request('/api/login',{token});assert.equal(response.status,200);const {session}=await response.json();const headers={Authorization:`Bearer ${session}`,'X-Orbit-Client':id};sessions.push(headers);const claim=await request('/api/control/claim',{},headers);assert.equal(claim.status,200);headers['X-Orbit-Epoch']=String((await claim.json()).epoch);}
 assert.equal((await request('/api/checkpoint',{},sessions[0])).status,409);
 assert.equal((await request('/api/checkpoint',{},sessions[1])).status,200);
}finally{for(const headers of sessions)await request('/api/logout',{},headers);}
await new Promise(r=>setTimeout(r,1500));const after=await (await request('/api/state')).json();
assert.ok(after.revision>=before.revision);assert.equal(after.error,null);
if(before.state.speed&&before.state.player.alive&&after.state.player.alive)assert.ok((after.state.day-1)*1440+after.state.minute>(before.state.day-1)*1440+before.state.minute);
console.log(JSON.stringify({release:after.release,revision:after.revision,day:after.state.day,backgroundRunning:after.state.speed>0,securityChecks:'passed'}));
