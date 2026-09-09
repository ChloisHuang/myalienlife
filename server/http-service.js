import {createServer} from 'node:http';
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,join,sep} from 'node:path';
import {createAuthority} from './authority.js';
import {createProjectConfigStore} from './project-config-store.js';

const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const digest=value=>createHash('sha256').update(value).digest();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon'};

export async function createHttpService({directory,dist,token,origin,initial,autoStart=true,release='development'}={}){
 if(typeof token!=='string'||token.length<12||token.length>256)throw new Error('操作口令需要 12 到 256 个字符');
 const allowedOrigin=new URL(origin).origin,tokenHash=digest(token),root=resolve(dist);
 const configStore=createProjectConfigStore(join(directory,'project-config.json'));
 const authority=await createAuthority({directory,initial,config:await configStore.read(),autoStart});
 const sessions=new Map(),limits=new Map();let controller=null,epoch=0,stateSerial=0;
 function sessionFor(req){const header=req.headers.authorization;const key=typeof header==='string'&&header.startsWith('Bearer ')?header.slice(7):'';const session=sessions.get(key);if(!session||session.expires<Date.now()){sessions.delete(key);return null;}return key;}
 function clientFor(req){const client=req.headers['x-orbit-client'];if(typeof client!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(client))fail(400,'无效的浏览器标识');return client;}
 function owns(req,session){return !!session&&controller?.session===session&&controller.client===req.headers['x-orbit-client'];}
 function status(req){const session=sessionFor(req);return{authenticated:!!session,canOperate:owns(req,session),epoch,release,error:authority.error?'世界已因存档或模拟异常暂停':null};}
 function rate(req,kind,max){const key=`${req.socket.remoteAddress}:${kind}`,now=Date.now();let entry=limits.get(key);if(!entry||entry.until<now){entry={count:0,until:now+60000};limits.set(key,entry);}if(++entry.count>max)fail(429,'请求过于频繁，请稍后再试');}
 const cleanup=setInterval(()=>{const now=Date.now();for(const [id,s] of sessions)if(s.expires<now)sessions.delete(id);for(const [id,l]of limits)if(l.until<now)limits.delete(id);},60000);cleanup.unref();
 async function body(req){let size=0;const parts=[];for await(const chunk of req){size+=chunk.length;if(size>65536)fail(413,'请求过大');parts.push(chunk);}try{return JSON.parse(Buffer.concat(parts).toString());}catch{fail(400,'无效的 JSON');}}
 function json(res,value,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));}
 const server=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  try{
   const path=new URL(req.url,'http://localhost').pathname;
   if(path==='/healthz'&&req.method==='GET')return json(res,{ok:!authority.error,release},authority.error?503:200);
   if(path.startsWith('/api/')){
    rate(req,'api',6000);
    if(req.method==='GET'&&path==='/api/state')return json(res,{...status(req),state:authority.state,revision:authority.revision,serial:++stateSerial});
    if(req.method==='GET'&&path==='/api/session')return json(res,status(req));
    if(req.method!=='POST'||!['/api/login','/api/logout','/api/control/claim','/api/command','/api/checkpoint','/api/new-game','/api/project-config'].includes(path))fail(404,'接口不存在');
    if(req.headers.origin!==allowedOrigin)fail(403,'请求来源不匹配');
    if(!String(req.headers['content-type']).startsWith('application/json'))fail(415,'需要 JSON 请求');
    const input=await body(req);if(!input||typeof input!=='object'||Array.isArray(input))fail(400,'请求必须是对象');
    if(path==='/api/login'){
     rate(req,'login',10);
     if(typeof input.token!=='string'||input.token.length>256||!timingSafeEqual(digest(input.token),tokenHash))fail(401,'Token 不正确');
     if(sessions.size>=128)fail(429,'会话数量已达上限');
     const session=randomBytes(32).toString('base64url');sessions.set(session,{expires:Date.now()+12*3600000});
     // This host also serves other ports. Never send credentials in host-wide cookies.
     return json(res,{session,expiresIn:43200});
    }
    const session=sessionFor(req);if(!session)fail(401,'请先验证操作 Token');
    if(path==='/api/logout'){sessions.delete(session);if(owns(req,session)){controller=null;epoch++;}return json(res,{ok:true});}
    const client=clientFor(req);
    if(path==='/api/control/claim'){controller={session,client};epoch++;return json(res,{...status(req),ok:true});}
    if(!owns(req,session)||String(epoch)!==req.headers['x-orbit-epoch'])fail(409,'操作权已转移，请重新获取操作权');
    rate(req,'mutation',120);
    let result;
    if(path==='/api/command')result=await authority.command(input);
    if(path==='/api/checkpoint'){await authority.checkpoint();result={ok:true};}
    if(path==='/api/new-game'){const config=await configStore.read();if(!owns(req,session)||String(epoch)!==req.headers['x-orbit-epoch'])fail(409,'操作权已转移，请重新获取操作权');result=await authority.newGame(config);}
    if(path==='/api/project-config'){await configStore.write(authority.state.config);result={ok:true};}
    return json(res,{...result,...status(req),state:authority.state,revision:authority.revision,serial:++stateSerial});
   }
   if(!['GET','HEAD'].includes(req.method))fail(405,'不支持的请求方法');
   if(path!=='/'&&path!=='/index.html'&&path!=='/favicon.ico'&&!/^\/assets\/[a-zA-Z0-9_./-]+$/.test(path))fail(404,'文件不存在');
   if(path.split('/').some(s=>s==='..'||s==='.'||s.startsWith('.')))fail(404,'文件不存在');
   const file=resolve(root,path==='/'?'index.html':'.'+path);
   if(!file.startsWith(root+sep)||!Object.hasOwn(mime,extname(file)))fail(404,'文件不存在');
   const info=await stat(file);if(!info.isFile())fail(404,'文件不存在');
   res.writeHead(200,{'Content-Type':mime[extname(file)],'Content-Length':info.size,'Cache-Control':path.startsWith('/assets/')?'public, max-age=3600':'no-cache'});
   res.end(req.method==='HEAD'?undefined:await readFile(file));
  }catch(error){if(!res.headersSent)json(res,{error:error.status?error.message:error.code==='ENOENT'?'文件不存在':'服务暂时不可用'},error.status??(error.code==='ENOENT'?404:500));else res.destroy();}
 });
 server.requestTimeout=10000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxHeadersCount=40;server.maxConnections=128;
 return{server,authority,async close(){clearInterval(cleanup);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await authority.close();}};
}
