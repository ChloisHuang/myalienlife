import {isNether} from './prayer.js';
import {islandOf,sideOf,sameSide} from './island.js';
export const BLINK_SECONDS=2.4;
export function canBlinkTo(g,person,target){return isNether(person)&&islandOf(person)===islandOf(target)&&(!sameSide(person,target)||Math.hypot(person.x-target.x,person.z-target.z)>.05)&&Math.abs(target.x)<=11&&Math.abs(target.z)<=7&&!g.objects.some(o=>sameSide(o,target)&&Math.hypot(o.x-target.x,o.z-target.z)<.8);}

export function undiscoveredBackTarget(g,person){
 const island=islandOf(person);if(!isNether(person)||g.space.backs[island]||sideOf(person)==='back')return null;
 const offsets=[[0,0]];for(let r=1;r<=3;r++)for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++)if(Math.max(Math.abs(x),Math.abs(z))===r)offsets.push([x,z]);
 return offsets.map(([x,z])=>({x:person.x+x,z:-person.z+z,island,side:'back'})).find(p=>canBlinkTo(g,person,p))??null;
}
