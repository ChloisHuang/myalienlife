import {createHmac,randomBytes} from 'node:crypto';
import {isIP} from 'node:net';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {join} from 'node:path';

const day=ms=>new Date(ms+8*3600000).toISOString().slice(0,10);
export async function createVisitors({directory,lookup=()=>null,now=Date.now}){
 const file=join(directory,'visitors.json');let state;
 try{state=JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 state??={version:1,salt:randomBytes(32).toString('hex'),since:day(now()),totalVisits:0,countries:{},days:{},sessions:{},capped:false};
 if(state.version!==1||typeof state.salt!=='string')throw new Error('Invalid visitor statistics');
 let dirty=0,saved=0,pending=Promise.resolve(),error=null;
 function prune(time){const oldest=day(time-29*86400000);for(const key of Object.keys(state.days))if(key<oldest)delete state.days[key];for(const [key,last]of Object.entries(state.sessions))if(time-last>=30*60000)delete state.sessions[key];}
 function flush(){
  pending=pending.catch(()=>{}).then(async()=>{if(dirty===saved)return;const revision=dirty,data=JSON.stringify(state);await mkdir(directory,{recursive:true});await writeFile(file+'.tmp',data,{mode:0o600});await rename(file+'.tmp',file);saved=revision;error=null;});return pending;
 }
 const timer=setInterval(()=>flush().catch(()=>{error='访问统计暂未保存';}),30000);timer.unref();
 return {
  record(address){
   if(typeof address!=='string')return;const ip=address.replace(/^::ffff:/,'');if(!isIP(ip))return;
   const time=now();prune(time);const key=createHmac('sha256',state.salt).update(ip).digest('hex');
   const current=state.days[day(time)]??={visits:0,ips:{}};
   if(!Object.hasOwn(current.ips,key)&&Object.keys(current.ips).length>=10000){state.capped=true;dirty++;return;}
   current.ips[key]=true;
   if(!Object.hasOwn(state.sessions,key)){
    state.totalVisits++;current.visits++;const country=lookup(ip)?.country,code=/^[A-Z]{2}$/.test(country)?country:'ZZ';
    state.countries[code]=(state.countries[code]??0)+1;
   }
   state.sessions[key]=time;dirty++;
  },
  summary(){const time=now();return {since:state.since,totalVisits:state.totalVisits,timezone:'Asia/Shanghai',error,capped:state.capped,
   countries:Object.entries(state.countries).map(([country,visits])=>({country,visits})).sort((a,b)=>b.visits-a.visits),
   days:Array.from({length:30},(_,i)=>{const date=day(time-(29-i)*86400000),d=state.days[date];return {date,visits:d?.visits??0,visitors:Object.keys(d?.ips??{}).length};})};},
  async close(){clearInterval(timer);await flush();}
 };
}
