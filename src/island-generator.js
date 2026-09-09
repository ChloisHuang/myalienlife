// Versioned blueprints are stored in the save, so future generator changes never
// redraw an island that residents have already discovered or built upon.
import {BIOMES} from './planet-biomes.js';
export {BIOMES};
export function seededRandom(seed){let value=seed>>>0;return()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};}
export function generateIsland(seed,index){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!Number.isInteger(index)||index<0||index>=64)throw new Error('星岛生成参数无效');
 const random=seededRandom((seed^Math.imul(index+1,2654435761))>>>0),biome=Object.keys(BIOMES)[Math.floor(random()*Object.keys(BIOMES).length)],theme=BIOMES[biome];
 const phase=random()*Math.PI*2,tilt=(random()-.5)*.24,rx=16.1+random()*.4,rz=11.6+random()*.35;
 const outline=Array.from({length:48},(_,i)=>{const a=i*Math.PI/24,r=1+.048*Math.sin(a*3+phase)+.026*Math.cos(a*5-phase)+.012*Math.sin(a*8+phase*2),x=Math.cos(a)*rx*r,z=Math.sin(a)*rz*r;return{x:x*Math.cos(tilt)-z*Math.sin(tilt),z:x*Math.sin(tilt)+z*Math.cos(tilt)};});
 // Poisson spacing produces different clearings while preserving accessible approaches.
 const sites=[];for(let attempt=0;attempt<1200&&sites.length<7;attempt++){const x=Math.floor((random()-.5)*15+.5),z=Math.floor((random()-.5)*10+.5);if(Math.hypot(x,z)<3.4||sites.some(p=>Math.hypot(p.x-x,p.z-z)<3.4))continue;sites.push({x,z});}
 if(sites.length!==7)throw new Error('星岛布局空间不足');
 const layout=[{type:'portal',x:0,z:0,rotation:0},...['pod','food','shower','lab',...theme.resources].map((type,i)=>({type,...sites[i],rotation:0}))];
 // Distinct dense groves and open shoreline, rather than uniform perimeter spacing.
 const groves=Array.from({length:4},()=>random()*Math.PI*2),decor=[];
 for(let i=0;i<500&&decor.length<32;i++){const a=groves[Math.floor(random()*groves.length)]+(random()-.5)*1.1,r=.81+random()*.12,x=Math.cos(a)*rx*r,z=Math.sin(a)*rz*r;if(Math.abs(x)<11.8&&Math.abs(z)<8)continue;if(decor.some(p=>Math.hypot(p.x-x,p.z-z)<.85))continue;decor.push({x,z,size:.6+random()*.7,rotation:random()*Math.PI*2});}
 const prefixes=['澄雾','幽蓝','眠星','流萤','琉光','绛云','镜海','霜辉'];
 return {id:`wild-${index}`,generationVersion:2,seed,index,name:`${prefixes[Math.floor(random()*prefixes.length)]}${theme.name} ${index+1}`,biome,color:theme.color,accent:theme.accent,level:3+Math.floor(index/4),skill:theme.skill,required:18+Math.floor(index/4)*6,interests:[...theme.interests],outline,layout,decor};
}
export function validIslandBlueprint(b,id){
 const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(p.x)<=18&&Math.abs(p.z)<=13;
 const types=['portal','pod','food','shower','lab',...Object.values(BIOMES).flatMap(b=>b.resources)];
 return b&&b.id===id&&[1,2].includes(b.generationVersion)&&Number.isInteger(b.seed)&&b.seed>=0&&b.seed<=0xffffffff&&Number.isInteger(b.index)&&b.index>=0&&b.index<64&&id===`wild-${b.index}`&&typeof b.name==='string'&&b.name.length<60&&BIOMES[b.biome]&&Number.isInteger(b.level)&&b.level>=3&&b.level<=18&&b.skill===BIOMES[b.biome].skill&&Number.isInteger(b.required)&&b.required>=18&&b.required<=108&&Number.isInteger(b.color)&&b.color>=0&&b.color<=0xffffff&&Number.isInteger(b.accent)&&b.accent>=0&&b.accent<=0xffffff&&Array.isArray(b.interests)&&b.interests.length<=3&&b.interests.every(k=>BIOMES[b.biome].interests.includes(k))&&Array.isArray(b.outline)&&b.outline.length===48&&b.outline.every(point)&&Array.isArray(b.layout)&&b.layout.length===8&&b.layout.every(p=>point(p)&&types.includes(p.type)&&p.rotation===0)&&b.layout.filter(p=>p.type==='portal').length===1&&Array.isArray(b.decor)&&b.decor.length<=(b.generationVersion===1?26:32)&&b.decor.every(p=>point(p)&&Number.isFinite(p.size)&&p.size>=.6&&p.size<=1.3&&Number.isFinite(p.rotation));
}
