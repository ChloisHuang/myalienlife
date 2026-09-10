import {isNether} from './prayer.js';
import {islandOf,sideOf,sameSide} from './island.js';
import {livingPeople,bondTo,livingResident} from './living-state.js';
import {shadowActive} from './living-world.js';
export const BLINK_SECONDS=2.4;
export function canBlinkTo(g,person,target){
 if(!isNether(person))return false;
 const queue=person.uid===g.player.uid?g.queue:person.queue;
 const underway=!!queue?.[0]?.blinkTransit;
 if(!underway&&(!shadowActive(g,person)||queue?.[0]?.type==='accompany'))return false;
 const trusted=livingResident(g,person).bonds.some(b=>b.trust>=20);
 const companion=!underway&&trusted&&livingPeople(g).some(p=>p.uid!==person.uid&&sameSide(person,p)&&Math.hypot(p.x-person.x,p.z-person.z)<=3&&(bondTo(g,person,p)?.trust??0)>=20&&livingResident(g,p).fear>=25);
 return !companion&&islandOf(person)===islandOf(target)&&(!sameSide(person,target)||Math.hypot(person.x-target.x,person.z-target.z)>.05)&&Math.abs(target.x)<=11&&Math.abs(target.z)<=7&&!g.objects.some(o=>sameSide(o,target)&&Math.hypot(o.x-target.x,o.z-target.z)<.8);
}

export function undiscoveredBackTarget(g,person){
 const island=islandOf(person);if(!isNether(person)||g.space.backs[island]||sideOf(person)==='back')return null;
 const offsets=[[0,0]];for(let r=1;r<=3;r++)for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++)if(Math.max(Math.abs(x),Math.abs(z))===r)offsets.push([x,z]);
 return offsets.map(([x,z])=>({x:person.x+x,z:-person.z+z,island,side:'back'})).find(p=>canBlinkTo(g,person,p))??null;
}
