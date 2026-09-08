import {isNether} from './prayer.js';
import {islandOf,sideOf,sameSide} from './island.js';
export const BLINK_SECONDS=2.4;
export function canBlinkTo(g,person,target){return isNether(person)&&islandOf(person)===islandOf(target)&&sideOf(person)!==sideOf(target)&&Math.abs(target.x)<=11&&Math.abs(target.z)<=7&&!g.objects.some(o=>sameSide(o,target)&&Math.hypot(o.x-target.x,o.z-target.z)<.8);}
