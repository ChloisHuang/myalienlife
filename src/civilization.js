import {isNether} from './prayer.js';
import {skillProgress} from './characters.js';
import {UFOS,backDiscovered,equipmentError} from './space-logistics.js';
import {spaceResearchYield} from './action-access.js';
import {generateIsland,validIslandBlueprint} from './island-generator.js';
import {islandOf} from './island.js';

export const STAR_ISLANDS={
 home:{name:'露米纳星湾',level:0,color:0xbce0d4,skill:null,required:0,interests:[]},
 spore:{name:'孢海浮洲',level:1,color:0x89bdba,skill:'botany',required:6,interests:['garden','observe','explore']},
 city:{name:'失落星城',level:2,color:0x9c8bcc,skill:'science',required:12,interests:['research','observe','explore']}
};
export const SPACE_LEVELS=Array.from({length:19},(_,level)=>({name:['地表时代','近星航行','深空跃迁'][level]??`星域航行 ${level-2} 阶`,points:20*level*(level+1)}));
const MAX_TECH=SPACE_LEVELS.at(-1).points;
export const islandCatalog=g=>({...STAR_ISLANDS,...g.civilization.islands});
export const islandDefinition=(g,id)=>STAR_ISLANDS[id]??g.civilization.islands[id];
export const SKILL_NAMES={science:'科学',botany:'植物学',social:'社交'};
export function discoverProceduralIslands(c){const count=Math.min(64,Math.max(0,Math.floor((c.observations-12)/6)+1));for(let index=Object.keys(c.islands).length;index<count;index++){const b=generateIsland(c.seed,index);c.islands[b.id]=b;c.visits[b.id]=0;c.surveys[b.id]=0;c.surveyDays[b.id]=0;}}
export const createCivilization=()=>({seed:crypto.getRandomValues(new Uint32Array(1))[0],islands:{},knowledge:0,technology:0,observations:0,surveys:{spore:0,city:0},surveyDays:{spore:0,city:0},visits:{home:1,spore:0,city:0}});
export const spaceLevel=g=>SPACE_LEVELS.reduce((level,s,i)=>g.civilization.technology>=s.points?i:level,0);
export const discovered=(g,id)=>id==='home'||id==='spore'&&g.civilization.observations>=3||id==='city'&&g.wonders.archive===3||Object.hasOwn(g.civilization.islands,id);
function destinationError(g,p,id){
 const island=islandDefinition(g,id);if(!island)return '请选择已知星岛。';
 if(islandOf(p)===id)return '已经位于这座星岛。';
 if(!discovered(g,id))return '请先通过观测或遗迹研究定位这座星岛。';
 if(spaceLevel(g)<island.level)return `需要太空科技 ${island.level} 级 · ${SPACE_LEVELS[island.level].name}。`;
 return null;
}
export function starVoyageError(g,p,skills,id){const career=p===g.player?g.career:p.career;return destinationError(g,p,id)||(career?.id!=='scientist'||skillProgress(skills.science).level<10?'需要量子科学职业且科学满级（10 级），才能独自通过星门航行。':null);}
export function voyageError(g,p,skills,id,count=1,actionId=null,shipId=null){return destinationError(g,p,id)||equipmentError(g,p,islandDefinition(g,id).level,count,id==='home',actionId,shipId);}
export function civilizationError(g,type,o,p,skills,id,count=1,actionId=null,shipId=null){
 if(type==='senseNether')return !isNether(p)?'只有幽冥族或两仪族能感知幽星面。':backDiscovered(g,islandOf(p))?'这座星岛的幽星面已经发现。':!['portal','beacon'].includes(o?.type)?'请在跃迁星门或幽光信标感知幽星面。':null;
 if(type==='prepareRations')return o?.type!=='stove'?'请使用孢火星釜储备食物。':null;
 const ufo=UFOS.find(d=>type===`buildUfo${d.tier}`);if(ufo)return o?.type!=='lab'?'请在全息研究台制造 UFO。':spaceLevel(g)<ufo.technology?`需要太空科技 ${ufo.technology} 级才能制造。`:g.space.ships.length>=128?'舰队已达到 128 艘上限。':null;
 if(type==='spaceResearch')return o?.type!=='lab'?'请使用全息研究台。':spaceLevel(g)===SPACE_LEVELS.length-1?'现有太空科技已研究完成。':null;
 if(type==='starVoyage')return o?.type!=='portal'?'请使用跃迁星门航行。':starVoyageError(g,p,skills,id);
 if(type==='voyage')return o?.type!=='portal'?'请使用跃迁星门出航。':voyageError(g,p,skills,id,count,actionId,shipId);
 if(type==='explore'&&o?.type!=='portal')return '请使用跃迁星门进行勘察。';
 if(type==='explore'&&islandOf(p)!=='home'&&g.civilization.surveyDays[islandOf(p)]===g.day)return '这座星岛今天已经完成勘察。';
 return null;
}
export function contributeCivilization(g,type,p,skills,career){
 const c=g.civilization,id=islandOf(p);
 const knowledge={research:1,observe:1,traceRelic:2,decodeRelic:3,decodeTogether:3,restoreMemory:5,memoryExpedition:4,explore:id==='home'?1:6}[type]??0;c.knowledge+=knowledge;
 if(type==='spaceResearch')c.technology=Math.min(MAX_TECH,c.technology+spaceResearchYield(career,skills));
 if(type==='observe'||type==='explore'&&id==='home'){c.observations++;discoverProceduralIslands(c);}
 if(type==='explore'&&id!=='home'){c.surveys[id]++;c.surveyDays[id]=g.day;}
}
export function validCivilization(c){
 const count=n=>Number.isSafeInteger(n)&&n>=0&&n<=1e9;
 return !!c&&Number.isInteger(c.seed)&&c.seed>=0&&c.seed<=0xffffffff&&c.islands&&Object.keys(c.islands).length<=64&&Object.entries(c.islands).every(([id,b])=>validIslandBlueprint(b,id)&&count(c.visits?.[id])&&count(c.surveys?.[id])&&count(c.surveyDays?.[id]))&&count(c.knowledge)&&count(c.technology)&&c.technology<=MAX_TECH&&count(c.observations)&&['spore','city'].every(id=>count(c.surveys?.[id])&&count(c.surveyDays?.[id]))&&Object.keys(STAR_ISLANDS).every(id=>count(c.visits?.[id]));
}
