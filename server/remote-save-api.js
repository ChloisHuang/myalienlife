import {randomUUID} from 'node:crypto';

const DEFAULT_REMOTE_ORIGIN='https://www.doudouai.net:6443';
const failure=(status,message)=>Object.assign(new Error(message),{status});
function json(res,value,status=200){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(value));}

export function remoteSaveApi(store,{remoteOrigin=process.env.ORBIT_REMOTE_ORIGIN??DEFAULT_REMOTE_ORIGIN,fetchImpl=fetch,timeoutMs=15000}={}){
 const origin=remoteOrigin.replace(/\/+$/,'');
 return async(req,res,next)=>{
  if(req.url?.split('?')[0]!=='/api/pull-remote-save')return next();
  if(req.method!=='POST')return json(res,{error:'不支持的请求方法'},405);
  if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return json(res,{error:'请求来源不匹配'},403);
  try{
   let response;try{response=await fetchImpl(`${origin}/api/state`,{method:'GET',headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(timeoutMs)});}catch(error){throw failure(502,`读取线上存档失败：${error.message}`);}
   let remote;try{remote=await response.json();}catch{throw failure(502,'线上存档响应不是有效 JSON');}
   if(!response.ok)throw failure(502,remote?.error||`线上存档接口返回 ${response.status}`);
   if(!remote?.state||typeof remote.state!=='object')throw failure(502,'线上接口没有返回有效存档');
   const saved=await store.replace(remote.state,{clientId:`remote-import-${randomUUID()}`});
   return json(res,{ok:true,revision:saved.revision,savedAt:saved.savedAt,remoteRevision:Number.isSafeInteger(remote.revision)?remote.revision:null});
  }catch(error){return json(res,{error:error?.message||'拉取线上存档失败'},Number.isInteger(error?.status)?error.status:500);}
 };
}
