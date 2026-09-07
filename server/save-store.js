import {mkdir,readFile,open,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {restore} from '../src/simulation.js';

const failure=(status,message)=>Object.assign(new Error(message),{status});
export function createSaveStore(directory){
 const file=join(directory,'orbit-life.json');let pending=Promise.resolve();
 async function read(){
  let text;try{text=await readFile(file,'utf8');}catch(error){if(error.code==='ENOENT')return{revision:0,savedAt:null,state:null};throw error;}
  const saved=JSON.parse(text);
  if(saved.format!==1||!Number.isSafeInteger(saved.revision)||saved.revision<1)throw new Error('存档文件格式损坏');
  saved.state=restore(JSON.stringify(saved.state));return saved;
 }
 async function commit({state,baseRevision,clientId,sequence}){
  if(!Number.isSafeInteger(baseRevision)||baseRevision<0||typeof clientId!=='string'||!clientId||clientId.length>100||!Number.isSafeInteger(sequence)||sequence<1)throw failure(400,'无效的存档请求');
  try{state=restore(JSON.stringify(state));}catch{throw failure(400,'游戏存档校验失败');}
  const current=await read(),writer=current.writer;
  if(writer?.clientId===clientId&&sequence<=writer.sequence)throw failure(409,'该存档请求已过期');
  if(baseRevision!==current.revision&&!(writer?.clientId===clientId&&sequence>writer.sequence&&baseRevision>=writer.baseRevision&&baseRevision<=current.revision))throw failure(409,'其他页面已保存更新的进度');
  const saved={format:1,revision:current.revision+1,savedAt:new Date().toISOString(),writer:{clientId,sequence,baseRevision},state};
  await mkdir(directory,{recursive:true});const handle=await open(file+'.tmp','w');
  try{await handle.writeFile(JSON.stringify(saved));await handle.sync();}finally{await handle.close();}
  await rename(file+'.tmp',file);return saved;
 }
 return{read:()=>pending.then(read),write(request){if(!request||typeof request!=='object')return Promise.reject(failure(400,'无效的存档请求'));const result=pending.then(()=>commit(request));pending=result.catch(()=>{});return result;}};
}
