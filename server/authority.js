import {performance} from 'node:perf_hooks';
import {randomUUID} from 'node:crypto';
import {createGame,serialize,restore,tick} from '../src/simulation.js';
import {applyCommand} from '../src/game-commands.js';
import {createSaveStore} from './save-store.js';

export async function createAuthority({directory,initial,config,autoStart=true}={}){
 const store=createSaveStore(directory),saved=await store.read();
 let state=saved.state??restore(serialize(initial??createGame(config))),revision=saved.revision,sequence=0,accumulator=0,timer,last=performance.now(),saveAt=last,failed=null,closing=false;
 const clientId=randomUUID();let pending=Promise.resolve();
 async function checkpoint(){
  const snapshot=JSON.parse(serialize(state));
  const operation=pending.then(async()=>{const result=await store.write({state:snapshot,baseRevision:revision,clientId,sequence:++sequence});revision=result.revision;return result;});
  pending=operation.catch(error=>{failed=error;state.speed=0;});return operation;
 }
 function advance(milliseconds){
  if(failed||closing)return;
  accumulator+=milliseconds;
  // Same small steps as the browser. Never fast-forward days in a single tick.
  let steps=0;while(accumulator>=50&&steps++<200){tick(state,.05);accumulator-=50;}
 }
 if(!saved.state)await checkpoint();
 if(autoStart)timer=setInterval(()=>{try{const now=performance.now();advance(now-last);last=now;if(now-saveAt>=5000){saveAt=now;checkpoint().catch(()=>{});}}catch(error){failed=error;state.speed=0;}},50);
 return{
  get state(){return state;},get revision(){return revision;},get error(){return failed;},advance,checkpoint,
  async command(command){if(failed)throw Object.assign(new Error('存档服务异常，已暂停世界'),{status:503});const result=applyCommand(state,command);if(result.ok)await checkpoint();return result;},
  async newGame(config){if(failed)throw Object.assign(new Error('存档服务异常'),{status:503});state=createGame(config);await checkpoint();return{ok:true};},
  async close(){closing=true;clearInterval(timer);await pending;await checkpoint();}
 };
}
