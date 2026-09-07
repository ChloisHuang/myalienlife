import {dirname} from 'node:path';
import {mkdir,readFile,open,rename} from 'node:fs/promises';
import {createDefaultConfig,normalizeConfig,validConfig} from '../src/simulation.js';

const failure=(status,message)=>Object.assign(new Error(message),{status});

export function createProjectConfigStore(file){
 async function read(){
  let text;try{text=await readFile(file,'utf8');}catch(error){if(error.code==='ENOENT')return createDefaultConfig();throw error;}
  let saved;try{saved=JSON.parse(text);}catch{throw new Error('项目配置文件格式损坏');}
  const config=normalizeConfig(saved?.format===1?saved.config:saved);if(!validConfig(config))throw new Error('项目配置校验失败');return config;
 }
 async function write(raw){
  const config=normalizeConfig(raw);if(!validConfig(config))throw failure(400,'项目配置校验失败');
  await mkdir(dirname(file),{recursive:true});const handle=await open(file+'.tmp','w');
  try{await handle.writeFile(JSON.stringify({format:1,updatedAt:new Date().toISOString(),config}));await handle.sync();}finally{await handle.close();}
  await rename(file+'.tmp',file);return config;
 }
 let pending=Promise.resolve();
 return{read:()=>pending.then(read),write(raw){const result=pending.then(()=>write(raw));pending=result.catch(()=>{});return result;}};
}
