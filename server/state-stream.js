import {randomUUID} from 'node:crypto';
import patch from 'fast-json-patch';

export function createStateStream({limit=16,maxBytes=8*1024*1024}={}){
 const stream=randomUUID(),history=new Map();let sequence=0,bytes=0;
 return {snapshot(state,baseId){
  const encoded=JSON.stringify(state),next=JSON.parse(encoded),base=history.get(baseId);
  const stateId=`${stream}:${++sequence}`,size=Buffer.byteLength(encoded);
  history.set(stateId,{state:next,size});bytes+=size;
  while(history.size>limit||bytes>maxBytes){const [id,entry]=history.entries().next().value;history.delete(id);bytes-=entry.size;}
  return base?{stateId,baseId,patch:patch.compare(base.state,next)}:{stateId,state:next};
 }};
}
