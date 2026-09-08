import {islandOf} from './island.js';
export function pruneGeneratedIslands(g){
 const removed=new Set(Object.keys(g.civilization.islands)),removedObjects=new Set(g.objects.filter(o=>removed.has(islandOf(o))).map(o=>o.id));
 const records=[{p:g.player,q:g.queue,ai:g.autonomy},...Object.values(g.npcs).map(p=>({p,q:p.queue,ai:p.ai}))],moved=new Set(records.filter(({p})=>removed.has(islandOf(p))).map(({p})=>p.uid));
 const homeSpot=()=>{for(let z=2;z<=6;z+=2)for(let x=-8;x<=8;x+=2)if(!g.objects.some(o=>islandOf(o)==='home'&&o.side==='front'&&Math.hypot(o.x-x,o.z-z)<1.8))return{x,z,island:'home',side:'front'};throw new Error('主岛没有安置空间');};
 const destination=homeSpot(),cancelled=new Set();
 for(const {p,q}of records)for(const a of q)if(moved.has(p.uid)||removedObjects.has(a.targetId)||removed.has(a.destinationId)||removed.has(islandOf(a.target))||(a.passengerUids??[]).some(id=>moved.has(id)))cancelled.add(a.id);
 let changed=true;while(changed){changed=false;for(const {q}of records)for(const a of q)if(a.hostActionId&&cancelled.has(a.hostActionId)&&!cancelled.has(a.id)){cancelled.add(a.id);changed=true;}}
 for(const {p,q,ai}of records){for(let i=q.length-1;i>=0;i--)if(cancelled.has(q[i].id))q.splice(i,1);if(moved.has(p.uid))Object.assign(p,destination);if(removedObjects.has(ai.lastTarget))ai.lastTarget=null;}
 let ships=0;for(const ship of g.space.ships){if(removed.has(ship.island)){ship.island='home';ship.side='front';ships++;}if(cancelled.has(ship.reservedBy))ship.reservedBy=null;}
 // Keep unborn residents and their occupied nursery when removing an island.
 const occupied=new Set(g.incubations.map(b=>b.podId));for(const o of g.objects)if(removedObjects.has(o.id)&&occupied.has(o.id)){Object.assign(o,homeSpot());removedObjects.delete(o.id);}
 g.objects=g.objects.filter(o=>!removedObjects.has(o.id));
 for(const id of removed){g.space.provisions.home=(g.space.provisions.home??0)+(g.space.provisions[id]??0);delete g.space.provisions[id];delete g.space.backs[id];for(const key of ['islands','visits','surveys','surveyDays'])delete g.civilization[key][id];}
 g.civilization.lastDiscoveryObservation=g.civilization.observations;
 if(removed.has(g.viewIsland)){g.viewIsland='home';g.viewSide='front';}
 g.log.unshift({text:`已清理 ${removed.size} 座后续星岛，岛上居民和 UFO 已返回主岛。`,at:g.minute});
 return {islands:removed.size,residents:moved.size,ships,objects:removedObjects.size};
}
