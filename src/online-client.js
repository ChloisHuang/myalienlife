export function createOnlineClient({onState,onStatus}){
 let session='',epoch=0,serial=0,generation=0,connected=false,authenticated=false,canOperate=false;
 const client=crypto.randomUUID();
 function status(value){authenticated=value.authenticated??authenticated;canOperate=value.canOperate??canOperate;epoch=value.epoch??epoch;onStatus?.({authenticated,canOperate:connected&&canOperate,connected,error:value.error});}
 async function request(path,input){
  const current=generation;
  const response=await fetch(path,{method:input===undefined?'GET':'POST',cache:'no-store',credentials:'omit',headers:{'Content-Type':'application/json','X-Orbit-Client':client,'X-Orbit-Epoch':String(epoch),...(session?{Authorization:`Bearer ${session}`}:{})},body:input===undefined?undefined:JSON.stringify(input),signal:AbortSignal.timeout(10000)});
  const value=await response.json();
  if(!response.ok){if(response.status===401||response.status===409){canOperate=false;if(response.status===401){session='';authenticated=false;}status({});}throw Object.assign(new Error(value.error||'操作失败'),{status:response.status});}
  if(current===generation){connected=true;status(value);if(value.state&&value.serial>serial){serial=value.serial;onState?.(value.state);}}
  return value;
 }
 return{
  get canOperate(){return connected&&canOperate;},
  async load(){const value=await request('/api/state');return value.state;},
  async login(token){generation++;const value=await request('/api/login',{token});session=value.session;authenticated=true;canOperate=false;status({});},
  async claim(){generation++;return request('/api/control/claim',{});},
  async logout(){generation++;try{await request('/api/logout',{});}finally{session='';authenticated=false;canOperate=false;status({});}},
  async mutate(path,input={}){if(!connected||!canOperate)throw new Error('当前为只读，请先获取操作权');return request(path,input);},
  start(){let stopped=false,timer;const poll=async()=>{try{await request('/api/state');}catch{connected=false;canOperate=false;status({});}finally{if(!stopped)timer=setTimeout(poll,250);}};poll();return()=>{stopped=true;clearTimeout(timer);};}
 };
}
