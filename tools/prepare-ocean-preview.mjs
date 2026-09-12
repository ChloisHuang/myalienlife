import {resolve} from 'node:path';
import {createGame,ensureStarIsland,buyItem,restore,serialize} from '../src/simulation.js';
import {createSaveStore} from '../server/save-store.js';

const directory=resolve('artifacts/ocean/preview-save'),store=createSaveStore(directory);
if((await store.read()).state)throw new Error('Preview save already exists; refusing to overwrite review progress.');
const g=createGame();
g.civilization.discoveryPath=['home','spore','ocean'];
g.civilization.technology=120;g.civilization.observations=6;
for(const id of ['spore','ocean']){
 g.civilization.visits[id]=1;g.space.backs[id]=true;
 g.civilization.projects[id].blueprint=300;g.civilization.projects[id].construction=600;
 ensureStarIsland(g,id);
}
g.viewIsland='ocean';g.viewSide='front';g.player.island='ocean';g.player.side='front';
g.player.x=-6;g.player.z=4;g.player.homeIsland='ocean';g.autonomy.enabled=false;
g.minute=720;g.money=20000;
for(const [type,x,z] of [['oceanPearlLamp',-3,4],['oceanShellPlanter',2,5],['oceanBubbleMobile',-4,-3]]){
 const result=buyItem(g,type,x,z,0,{side:'back',island:'ocean'});
 if(!result.ok)throw new Error(result.message);
}
restore(serialize(g));
await store.write({state:g,baseRevision:0,clientId:'ocean-local-preview',sequence:1});
console.log(directory);
