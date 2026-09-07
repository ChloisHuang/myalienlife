import {createGame,restore,serialize} from './simulation.js';

export function createPersistence(){
 const clientId=crypto.randomUUID();let revision=0,sequence=0,acknowledged=0,lastSnapshot='',pending=new Map();
 async function request(options){
  const response=await fetch('/api/save',{cache:'no-store',...options});
  const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error),{status:response.status});return data;
 }
 async function requestProjectConfig(options){
  const response=await fetch('/api/project-config',{cache:'no-store',...options});
  const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error),{status:response.status});return data;
 }
 async function save(game){
  const snapshot=serialize(game);
  if(snapshot===lastSnapshot&&pending.size===0)return null;
  if(pending.has(snapshot))return pending.get(snapshot);
  restore(snapshot);const number=++sequence;
  const operation=request({method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({state:JSON.parse(snapshot),baseRevision:revision,clientId,sequence:number})}).then(data=>{
   if(number>acknowledged){acknowledged=number;revision=data.revision;lastSnapshot=snapshot;}return data;
  }).finally(()=>pending.delete(snapshot));
  pending.set(snapshot,operation);return operation;
 }
 async function load(){
  const saved=await request();revision=saved.revision;
  if(saved.state){const game=restore(JSON.stringify(saved.state));lastSnapshot=serialize(game);return game;}
  // Import the old browser save only when the server has no saved world.
  const legacy=localStorage.getItem('orbit-life-v1'),project=legacy?null:await requestProjectConfig(),game=legacy?restore(legacy):createGame(project.config);
  try{await save(game);}catch(error){if(error.status===409)return load();throw error;}
  return game;
 }
 async function saveProjectConfig(config){return requestProjectConfig({method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({config})});}
 async function createNewGame(){const project=await requestProjectConfig();const game=createGame(project.config);lastSnapshot='';await save(game);return game;}
 return{load,save,saveProjectConfig,createNewGame};
}
