import {islandOf,sideOf,sameSide} from './island.js';
import {remainingConstructionMaterials} from './settlements.js';
export const UFOS=[
 {tier:1,name:'萤舟 UFO',technology:1,range:1,seats:2,cargoCapacity:20,price:600},
 {tier:2,name:'星梭 UFO',technology:2,range:2,seats:5,cargoCapacity:60,price:1400},
 {tier:3,name:'方舟 UFO',technology:3,range:18,seats:12,cargoCapacity:120,price:2600}
];
export const UFO_WEAR_PER_FLIGHT=10;
export function fleetLimit(g){return Math.floor(new Set([g.player,...Object.values(g.npcs)].filter(p=>p.alive).map(p=>p.uid)).size*2/3);}
export function fleetBuildError(g,actionId=null){const pending=new Set([g.queue,...Object.values(g.npcs).map(p=>p.queue)].flat().filter(q=>/^buildUfo[123]$/.test(q.type)&&q.id!==actionId).map(q=>q.id)).size;return g.space.ships.length+pending>=fleetLimit(g)?`UFO 数量上限 ${fleetLimit(g)} 艘（存活人数的 2/3，向下取整），含已排队制造。`:null;}
export function retireUfo(g,ship,reason){depositShipCargo(g,ship);const refund=Math.floor(ufoDefinition(ship).price*.5*ship.durability/100);g.space.provisions[ship.island]=(g.space.provisions[ship.island]??0)+ship.food;g.money+=refund;g.space.ships.splice(g.space.ships.indexOf(ship),1);g.log.unshift({text:`${ufoDefinition(ship).name}因${reason}回收，返还 ${refund} 星币及 ${ship.food} 份食物。`,at:g.minute});}
export const createSpaceLogistics=()=>({backs:{home:true},ships:[],provisions:{},materials:{},cargo:{}});
export const backDiscovered=(g,id)=>id==='home'||g.space.backs[id]===true;
export const ufoDefinition=ship=>UFOS[ship.tier-1];
export function hasLocalChef(g,island){return (g.player.alive&&islandOf(g.player)===island&&g.career.id==='chef')||Object.entries(g.npcs).some(([id,p])=>id!==g.controlledId&&p.uid!==g.player.uid&&p.alive&&islandOf(p)===island&&p.career.id==='chef');}
export function flightFoodAvailable(g,ship){return ship.food+(ship.reservedBy===null?(g.space.provisions[ship.island]??0):0);}
export function availableUfo(g,p,level,count=1,returning=false,actionId=null,shipId=null){
 return g.space.ships.filter(s=>sameSide(s,p)&&(shipId===null||s.id===shipId)&&(actionId===null?s.reservedBy===null:s.reservedBy===actionId)&&ufoDefinition(s).range>=level&&ufoDefinition(s).seats>=count&&s.durability>=UFO_WEAR_PER_FLIGHT*(returning?1:2)&&(!hasLocalChef(g,islandOf(p))||flightFoodAvailable(g,s)>=count)).sort((a,b)=>a.tier-b.tier)[0];
}
export function equipmentError(g,p,level,count,returning,actionId,shipId=null){
 const ships=g.space.ships.filter(s=>sameSide(s,p)&&(shipId===null||s.id===shipId)&&(actionId===null?s.reservedBy===null:s.reservedBy===actionId)&&ufoDefinition(s).range>=level);
 if(!ships.length)return '所在星岛没有空闲且航程足够的 UFO，请先研发并制造。';
 if(!ships.some(s=>ufoDefinition(s).seats>=count))return 'UFO 座位不足，请减少乘客或制造更大级别的 UFO。';
 if(!ships.some(s=>ufoDefinition(s).seats>=count&&s.durability>=UFO_WEAR_PER_FLIGHT*(returning?1:2)))return returning?'UFO 耐久不足，无法返航。':'UFO 耐久不足 20 点，只能返航，无法继续探索。';
 if(hasLocalChef(g,islandOf(p))&&!availableUfo(g,p,level,count,returning,actionId,shipId))return '当前星球有星厨，食物不足，请先在本星球储备足够本航段全员食用的食物。';
 return null;
}
export function finishLogistics(g,type,p,career,nextId,actionId=null){
 if(type==='prepareRations'){const amount=6+career.level*2;g.space.provisions[islandOf(p)]=(g.space.provisions[islandOf(p)]??0)+amount;return `星厨储备了 ${amount} 份航行食物。`;}
 const tier=Number(type.match(/^buildUfo([123])$/)?.[1]);
 if(tier){const issue=fleetBuildError(g,actionId);if(issue)return issue;const d=UFOS[tier-1];g.space.ships.push({id:`ufo-${nextId}`,tier,island:islandOf(p),side:sideOf(p),food:0,durability:100,reservedBy:null});return `${d.name}制造完成，可载 ${d.seats} 人；请由星厨准备航行食物。`;}
 return null;
}
export function validSpaceLogistics(s,catalog){
 const count=n=>Number.isSafeInteger(n)&&n>=0&&n<=1e9;
 if(!s?.materials||!s.cargo||!Object.entries(s.materials).every(([id,n])=>Object.hasOwn(catalog,id)&&count(n))||!Object.entries(s.cargo).every(([id,n])=>{const ship=s.ships?.find(ship=>ship.id===id);return ship&&count(n)&&n<=(UFOS[ship.tier-1]?.cargoCapacity??0);}))return false;
 return s&&s.backs?.home===true&&Object.entries(s.backs).every(([id,v])=>Object.hasOwn(catalog,id)&&v===true)&&s.provisions&&Object.entries(s.provisions).every(([id,n])=>Object.hasOwn(catalog,id)&&count(n))&&Array.isArray(s.ships)&&s.ships.length<=128&&new Set(s.ships.map(s=>s.id)).size===s.ships.length&&s.ships.every(s=>typeof s.id==='string'&&UFOS.some(d=>d.tier===s.tier)&&Object.hasOwn(catalog,s.island)&&['front','back'].includes(s.side)&&count(s.food)&&count(s.durability)&&s.durability<=100&&(s.reservedBy===null||count(s.reservedBy)));
}

export function shipFoodStatus(ship){const capacity=ufoDefinition(ship).seats*2;return {capacity,ratio:Math.min(1,ship.food/capacity),full:ship.food>=capacity};}
export function loadShipFood(g,id){
 const ship=g.space.ships.find(s=>s.id===id);if(!ship||!sameSide(ship,g.player))return {ok:false,message:'请先来到飞船所在岛面。'};
 if(ship.reservedBy!==null)return {ok:false,message:'正在集合登船，补给已由本次航行预留。'};
 const amount=Math.min(shipFoodStatus(ship).capacity-ship.food,g.space.provisions[ship.island]??0);
 if(amount<=0)return {ok:false,message:shipFoodStatus(ship).full?'飞船补给已满。':'岛上没有航行食物，请先让星厨储备。'};
 ship.food+=amount;g.space.provisions[ship.island]-=amount;return {ok:true,message:`已装入 ${amount} 份食物，舱内 ${ship.food} / ${shipFoodStatus(ship).capacity} 份。`};
}

export function loadShipMaterials(g,id,amount){
 const ship=g.space.ships.find(s=>s.id===id);
 if(!ship||!sameSide(ship,g.player))return {ok:false,message:'请先来到飞船所在岛面。'};
 if(ship.reservedBy!==null)return {ok:false,message:'飞船已预留航行，不能改变货物。'};
 const stock=g.space.materials[ship.island]??0,loaded=g.space.cargo[id]??0;
 if(!Number.isSafeInteger(amount)||amount<=0||amount>stock||amount+loaded>ufoDefinition(ship).cargoCapacity)return {ok:false,message:'请填写库存和剩余载货量以内的正整数。'};
 transferMaterialsToShip(g,ship,amount);
 return {ok:true,message:`已装载 ${amount} 份植生复材，抵达后自动卸入目标星岛仓库。`};
}
function transferMaterialsToShip(g,ship,amount){
 g.space.materials[ship.island]-=amount;g.space.cargo[ship.id]=(g.space.cargo[ship.id]??0)+amount;
}
export function loadConstructionCargo(g,flight){
 const ship=g.space.ships.find(s=>s.id===flight.shipId&&s.reservedBy===flight.id);
 if(flight.type!=='voyage'||flight.source!=='ai'||!ship)return 0;
 const target=flight.destinationId,loaded=g.space.cargo[ship.id]??0;
 // Reserved inbound cargo already covers part of the same island's construction.
 const incoming=new Set([g.queue,...Object.values(g.npcs).map(n=>n.queue)].flat().filter(q=>q.type==='voyage'&&q.destinationId===target&&g.space.ships.some(s=>s.id===q.shipId&&s.reservedBy===q.id)).map(q=>q.shipId));
 incoming.delete(ship.id);
 const inbound=[...incoming].reduce((sum,id)=>sum+(g.space.cargo[id]??0),0);
 const deficit=remainingConstructionMaterials(g,target)-(g.space.materials[target]??0)-inbound-loaded;
 const available=(g.space.materials[ship.island]??0)-remainingConstructionMaterials(g,ship.island);
 const amount=Math.max(0,Math.min(deficit,available,ufoDefinition(ship).cargoCapacity-loaded));
 if(amount)transferMaterialsToShip(g,ship,amount);
 return amount;
}
export function depositShipCargo(g,ship){
 const amount=g.space.cargo[ship.id]??0;
 if(amount)g.space.materials[ship.island]=(g.space.materials[ship.island]??0)+amount;
 delete g.space.cargo[ship.id];return amount;
}
export function unloadShipMaterials(g,id){
 const ship=g.space.ships.find(s=>s.id===id);
 if(!ship||!sameSide(ship,g.player))return {ok:false,message:'请先来到飞船所在岛面。'};
 if(ship.reservedBy!==null)return {ok:false,message:'飞船已预留航行，不能改变货物。'};
 const amount=depositShipCargo(g,ship);return {ok:amount>0,message:amount?`已卸下 ${amount} 份植生复材。`:'货舱为空。'};
}

export function ufoLandingSpot(g,id){return [[0,2],[2,2],[-2,2],[0,4],[4,4],[-4,4]].map(([x,z])=>({x,z,island:id,side:'front'})).find(p=>!g.objects.some(o=>sameSide(o,p)&&Math.hypot(o.x-p.x,o.z-p.z)<1.1));}

export function flightFoodPenalty(food,people){const missing=Math.max(0,people-food);return {missing,hunger:missing*10,energy:missing*5};}
