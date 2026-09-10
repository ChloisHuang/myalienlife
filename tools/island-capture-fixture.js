import {activeDiscoveryPath,islandDefinition} from '../src/civilization.js';
import {islandOf,sideOf} from '../src/island.js';
import {canPlace} from '../src/simulation.js';
import {approachPosition,localToWorld} from '../src/characters.js';
import {seededRandom} from '../src/island-generator.js';

export const CAPTURE_FRAME={width:1920,height:1080};
export const CAPTURE_WEATHER={type:'spores',weights:{clear:0,mist:0,rain:0,spores:1},wind:.85,temperature:25,name:'孢子风',icon:'Wind',description:'截图固定孢子风',transitioning:false,nextName:'孢子风'};
export function captureIslands(state){return activeDiscoveryPath(state).map((id,i)=>({number:i+1,id,name:islandDefinition(state,id).name}));}

export function prepareIslandCapture(source,{islandNumber,side,seed}){
 const island=captureIslands(source).find(i=>i.number===islandNumber);
 if(!island)throw new Error(`存档中不存在第 ${islandNumber} 座岛，请先用 --list 查看编号。`);
 if(!['front','back'].includes(side))throw new Error('截图岛面必须是 front 或 back');
 const state=structuredClone(source),random=seededRandom(seed),placements=[];
 state.minute=720;state.speed=0;state.viewIsland=island.id;state.viewSide=side;
 state.autonomy.enabled=false;state.queue=[];state.space.backs[island.id]=true;
 state.space.ships=[{id:'screenshot-tier3',tier:3,island:island.id,side,food:24,durability:100,reservedBy:null}];
 const residents=[{id:'player',person:state.player},...Object.entries(state.npcs).map(([id,person])=>({id,person}))].filter(({person})=>person.alive);
 for(const {person}of residents){person.queue=[];if(person.ai)person.ai.enabled=false;}
 const objects=state.objects.filter(o=>islandOf(o)===island.id&&sideOf(o)===side);
 const poses={pod:'sleep',sofa:'relax',fairyBench:'relax',food:'eat',lab:'research',garden:'garden',music:'dance',spiritTree:'pray'};
 const facilities=objects.filter(o=>poses[o.type]);
 // Shuffle copies, never reorder or alter the saved object array.
 for(let i=facilities.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[facilities[i],facilities[j]]=[facilities[j],facilities[i]];}
 const occupied=[],free=[];
 for(let x=-9;x<=9;x+=1.5)for(let z=-5;z<=5;z+=1.5)if(canPlace(state,x,z,side,island.id))free.push({x,z});
 const distant=p=>occupied.every(q=>Math.hypot(p.x-q.x,p.z-q.z)>1.3);
 for(const [index,{id,person}]of residents.entries()){
  let position,action=null;
  const facility=person.age>=state.config.lifeStages.infantEnd?facilities.find(o=>distant(approachPosition(o))):null;
  if(facility&&index%3!==2){
   facilities.splice(facilities.indexOf(facility),1);position=approachPosition(facility);
   action={id:100000+index,type:poses[facility.type],targetId:facility.id,phase:'acting',elapsed:2+random()*3,seat:1};
   if(action.type==='relax')position=localToWorld(facility,[0,0,0]);
  }else{
   const candidates=free.filter(distant);
   if(!candidates.length)throw new Error(`第 ${islandNumber} 座岛没有足够空位摆放 ${person.name}；物品布局未改动。`);
   position=candidates[Math.floor(random()*candidates.length)];
   action={id:100000+index,type:'walk',phase:'walking',elapsed:0};
  }
  occupied.push(position);Object.assign(person,{x:position.x,z:position.z,island:island.id,side});
  if(id==='player')state.queue=[action];else person.queue=[action];
  placements.push({id,x:position.x,z:position.z,action:action.type,phase:random()*Math.PI*2,elapsed:action.elapsed});
 }
 return {state,island,side,seed,placements};
}

export function poseCaptureFrame(fixture,seconds){
 for(const placement of fixture.placements){
  const person=placement.id==='player'?fixture.state.player:fixture.state.npcs[placement.id];
  const action=(placement.id==='player'?fixture.state.queue:person.queue)[0];
  action.elapsed=placement.elapsed+seconds;
  if(action.phase==='walking'){person.x=placement.x+Math.sin(seconds*.8+placement.phase)*.22;person.z=placement.z+Math.cos(seconds*.8+placement.phase)*.22;}
 }
}
