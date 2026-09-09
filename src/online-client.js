import patch from 'fast-json-patch';

export function createOnlineClient({onState,onStatus}){
 const client=crypto.randomUUID();
 let session='',epoch=0,authVersion=0,connected=false,authenticated=false,canOperate=false;
 let socket,stopped=false,retry,watchdog,lastReceived=0,backoff=500,connection=0;
 let stateId='',wireState,displayed=-1,requests=Promise.resolve(),resolveLoad,rejectLoad;
 function status(value){
  if(value.epoch!==undefined&&value.epoch<epoch)return;
  authenticated=value.authenticated??authenticated;canOperate=value.canOperate??canOperate;epoch=value.epoch??epoch;
  onStatus?.({authenticated,canOperate:connected&&canOperate,connected,error:value.error});
 }
 function publish(value){if(value.serial<=displayed)return;displayed=value.serial;onState?.(structuredClone(value.state));}
 function authenticate(){if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'auth',client,session,authVersion}));}
 function disconnected(ws){
  if(socket!==ws)return;socket=null;connection++;connected=false;canOperate=false;status({});ws.close();
  if(!stopped){retry=setTimeout(connect,backoff);backoff=Math.min(5000,backoff*2);}
 }
 function connect(){
  if(stopped)return;const url=new URL('/api/stream',location.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';
  const ws=new WebSocket(url);socket=ws;connection++;stateId='';wireState=undefined;displayed=-1;epoch=0;lastReceived=Date.now();
  ws.onopen=()=>{if(socket===ws)authenticate();};
  ws.onmessage=event=>{
   if(socket!==ws)return;
   try{
    const value=JSON.parse(event.data);
    if(value.patch){if(value.baseId!==stateId||!wireState)throw new Error('状态版本不匹配');wireState=patch.applyPatch(wireState,value.patch,true,false).newDocument;}
    else {if(!value.state||typeof value.stateId!=='string')throw new Error('无效状态');wireState=value.state;}
    stateId=value.stateId;lastReceived=Date.now();connected=true;backoff=500;
    if(value.authVersion===authVersion)status(value);
    publish({...value,state:wireState});resolveLoad?.(structuredClone(wireState));resolveLoad=null;rejectLoad=null;
   }catch{disconnected(ws);}
  };
  ws.onerror=()=>disconnected(ws);ws.onclose=()=>disconnected(ws);
 }
 function stop(){stopped=true;clearTimeout(retry);clearInterval(watchdog);const ws=socket;socket=null;ws?.close();connected=false;canOperate=false;}
 function request(path,input){const result=requests.then(()=>send(path,input));requests=result.catch(()=>{});return result;}
 async function send(path,input){
  const version=authVersion,transport=connection;
  const response=await fetch(path,{method:input===undefined?'GET':'POST',cache:'no-store',credentials:'omit',headers:{'Content-Type':'application/json','X-Orbit-Client':client,'X-Orbit-Epoch':String(epoch),...(session?{Authorization:`Bearer ${session}`}:{})},body:input===undefined?undefined:JSON.stringify(input),signal:AbortSignal.timeout(10000)});
  const value=await response.json();
  if(transport!==connection)throw new Error('连接已变化，请确认最新状态；操作不会自动重试');
  if(!response.ok){if(response.status===401||response.status===409){canOperate=false;if(response.status===401){session='';authenticated=false;authVersion++;authenticate();}status({});}throw Object.assign(new Error(value.error||'操作失败'),{status:response.status});}
  if(version===authVersion){status(value);if(value.state)publish(value);}
  return value;
 }
 return {
  get canOperate(){return connected&&canOperate;},
  async load(){
   return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{rejectLoad?.(new Error('实时连接超时，请刷新重试'));stop();},15000);
    resolveLoad=value=>{clearTimeout(timeout);resolve(value);};rejectLoad=error=>{clearTimeout(timeout);reject(error);};
    watchdog=setInterval(()=>{if(socket&&Date.now()-lastReceived>10000)disconnected(socket);},2000);connect();
   });
  },
  start(){return stop;},
  async visitors(){return request('/api/visitors');},
  async login(token){authVersion++;const value=await request('/api/login',{token});session=value.session;authenticated=true;canOperate=false;authenticate();status({});},
  async claim(){return request('/api/control/claim',{});},
  async logout(){authVersion++;try{await request('/api/logout',{});}finally{session='';authenticated=false;canOperate=false;authenticate();status({});}},
  async mutate(path,input={}){if(!connected||!canOperate)throw new Error('当前为只读，请先获取操作权');return request(path,input);}
 };
}
