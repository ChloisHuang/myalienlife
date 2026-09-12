import {islandOf,sideOf} from './island.js';

export function shouldAnimateActor({person,viewIsland,viewSide,flipping=false,blinkTransit=false,onboard=false}){
 if(blinkTransit||onboard)return true;
 return islandOf(person)===viewIsland&&(flipping||sideOf(person)===viewSide);
}
