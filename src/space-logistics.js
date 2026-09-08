import {islandOf,sideOf,sameSide} from './island.js';
export const UFOS=[
 {tier:1,name:'萤舟 UFO',technology:1,range:1,seats:2,price:600},
 {tier:2,name:'星梭 UFO',technology:2,range:2,seats:5,price:1400},
 {tier:3,name:'方舟 UFO',technology:3,range:18,seats:12,price:2600}
];
export const createSpaceLogistics=()=>({backs:{home:true},ships:[],provisions:{}});
export const backDiscovered=(g,id)=>id==='home'||g.space.backs[id]===true;
export const ufoDefinition=ship=>UFOS[ship.tier-1];
export function availableUfo(g,p,level,count=1,returning=false,actionId=null,shipId=null){
 const supplies=g.space.provisions[islandOf(p)]??0,required=count*(returning?1:2);
 return g.space.ships.filter(s=>sameSide(s,p)&&(shipId===null||s.id===shipId)&&(actionId===null?s.reservedBy===null:s.reservedBy===actionId)&&ufoDefinition(s).range>=level&&ufoDefinition(s).seats>=count&&s.food+supplies>=required).sort((a,b)=>a.tier-b.tier)[0];
}
export function equipmentError(g,p,level,count,returning,actionId,shipId=null){
 const ships=g.space.ships.filter(s=>sameSide(s,p)&&(shipId===null||s.id===shipId)&&(actionId===null?s.reservedBy===null:s.reservedBy===actionId)&&ufoDefinition(s).range>=level);
 if(!ships.length)return '所在星岛没有空闲且航程足够的 UFO，请先研发并制造。';
 if(!ships.some(s=>ufoDefinition(s).seats>=count))return 'UFO 座位不足，请减少乘客或制造更大级别的 UFO。';
 if(!availableUfo(g,p,level,count,returning,actionId,shipId))return '航行食物不足，请让星厨在孢火星釜储备食物；出航会预留返程份额。';
 return null;
}
export function finishLogistics(g,type,p,career,nextId){
 if(type==='senseNether'){g.space.backs[islandOf(p)]=true;return '已发现这座星岛的幽星面；可翻转查看，购买两面折跃门后通行。';}
 if(type==='prepareRations'){const amount=6+career.level*2;g.space.provisions[islandOf(p)]=(g.space.provisions[islandOf(p)]??0)+amount;return `星厨储备了 ${amount} 份航行食物。`;}
 const tier=Number(type.match(/^buildUfo([123])$/)?.[1]);
 if(tier){const d=UFOS[tier-1];g.space.ships.push({id:`ufo-${nextId}`,tier,island:islandOf(p),side:sideOf(p),food:0,reservedBy:null});return `${d.name}制造完成，可载 ${d.seats} 人；请由星厨准备航行食物。`;}
 return null;
}
export function validSpaceLogistics(s,catalog){
 const count=n=>Number.isSafeInteger(n)&&n>=0&&n<=1e9;
 return s&&s.backs?.home===true&&Object.entries(s.backs).every(([id,v])=>Object.hasOwn(catalog,id)&&v===true)&&s.provisions&&Object.entries(s.provisions).every(([id,n])=>Object.hasOwn(catalog,id)&&count(n))&&Array.isArray(s.ships)&&s.ships.length<=128&&new Set(s.ships.map(s=>s.id)).size===s.ships.length&&s.ships.every(s=>typeof s.id==='string'&&UFOS.some(d=>d.tier===s.tier)&&Object.hasOwn(catalog,s.island)&&['front','back'].includes(s.side)&&count(s.food)&&(s.reservedBy===null||count(s.reservedBy)));
}

export function shipFoodStatus(ship){const capacity=ufoDefinition(ship).seats*2;return {capacity,ratio:Math.min(1,ship.food/capacity),full:ship.food>=capacity};}
export function loadShipFood(g,id){
 const ship=g.space.ships.find(s=>s.id===id);if(!ship||!sameSide(ship,g.player))return {ok:false,message:'请先来到飞船所在岛面。'};
 if(ship.reservedBy!==null)return {ok:false,message:'正在集合登船，补给已由本次航行预留。'};
 const amount=Math.min(shipFoodStatus(ship).capacity-ship.food,g.space.provisions[ship.island]??0);
 if(amount<=0)return {ok:false,message:shipFoodStatus(ship).full?'飞船补给已满。':'岛上没有航行食物，请先让星厨储备。'};
 ship.food+=amount;g.space.provisions[ship.island]-=amount;return {ok:true,message:`已装入 ${amount} 份食物，舱内 ${ship.food} / ${shipFoodStatus(ship).capacity} 份。`};
}

export function ufoLandingSpot(g,id){return [[0,2],[2,2],[-2,2],[0,4],[4,4],[-4,4]].map(([x,z])=>({x,z,island:id,side:'front'})).find(p=>!g.objects.some(o=>sameSide(o,p)&&Math.hypot(o.x-p.x,o.z-p.z)<1.1));}
