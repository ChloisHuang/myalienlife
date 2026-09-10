import {islandOf,sideOf,sameSide} from './island.js';
import {livingPeople,livingResident,bondTo} from './living-state.js';
import {isNether} from './prayer.js';

// These are soft vegetation, never building footprints or island edges.
export const LIVING_TRAILS=Object.freeze([
 {kind:'garden',side:'front',x:-3,z:2},
 {kind:'shadow',side:'back',x:-3,z:-2}
]);
export const trailAt=p=>islandOf(p)==='spore'?LIVING_TRAILS.find(t=>t.side===sideOf(p)&&Math.abs(p.x-t.x)<=1&&Math.abs(p.z-t.z)<.45):null;
export function routeGift(g,p,kind){
 const s=livingResident(g,p);
 return kind==='garden'?(s.garden>=24||s.imprint==='bloom')&&s.charge>=8:s.shadow>=40||s.imprint==='shade'||isNether(p);
}
export function trailGuide(g,p,kind){
 if(routeGift(g,p,kind))return p;
 return livingPeople(g).find(other=>other.uid!==p.uid&&sameSide(p,other)&&Math.hypot(p.x-other.x,p.z-other.z)<=3&&routeGift(g,other,kind)&&(kind==='garden'||(bondTo(g,p,other)?.trust??0)>=15));
}
export function visibleTrail(g,t){
 return livingPeople(g).some(p=>{
  if(islandOf(p)!=='spore'||sideOf(p)!==t.side||Math.hypot(p.x-t.x,p.z-t.z)>=4)return false;
  const q=(p.uid===g.player.uid?g.queue:p.queue)?.[0];
  return t.kind==='garden'?routeGift(g,p,t.kind)||!!q?.gardenPass:isNether(p)||q?.scoutElapsed>=1;
 });
}
export function validRouteAction(q){
 return (q.scoutElapsed===undefined||Number.isFinite(q.scoutElapsed)&&q.scoutElapsed>=0&&q.scoutElapsed<=3.2)&&
  (q.gardenPass===undefined||q.gardenPass===true)&&
  (q.path===null||Array.isArray(q.path)&&q.path.every(p=>p.livingTrail===undefined||trailAt(p)?.kind===p.livingTrail));
}
