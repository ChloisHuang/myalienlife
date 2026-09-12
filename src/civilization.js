import {isNether} from './prayer.js';
import {skillProgress} from './characters.js';
import {fleetBuildError,UFOS,backDiscovered,equipmentError} from './space-logistics.js';
import {spaceResearchYield} from './action-access.js';
import {validIslandBlueprint} from './island-generator.js';
import {islandOf} from './island.js';
import {createProject,projectError,validProjects} from './settlements.js';
import {materialSource,plantActionError} from './plants.js';
import {FAIRYTALE_LAYOUT} from './fairytale-definition.js';
import {OCEAN_LAYOUT} from './ocean-definition.js';

export const STAR_ISLANDS={
 home:{name:'露米纳星湾',level:0,color:0xbce0d4,skill:null,required:0,interests:[]},
 spore:{name:'童梦星屿',theme:'fairytale',layout:FAIRYTALE_LAYOUT,level:1,color:0x83b965,skill:'botany',required:6,interests:['garden','observe','explore']},
 ocean:{name:'珊瑚浅湾',theme:'ocean',layout:OCEAN_LAYOUT,level:2,color:0x52c9cb,accent:0xee9da5,skill:'science',required:12,interests:['research','relax','explore']}
};
export const SPACE_LEVELS=Array.from({length:19},(_,level)=>({name:['地表时代','近星航行','深空跃迁'][level]??`星域航行 ${level-2} 阶`,points:20*level*(level+1)}));
const MAX_TECH=SPACE_LEVELS.at(-1).points;
export const islandCatalog=g=>Object.fromEntries(Object.entries({...STAR_ISLANDS,...g.civilization.islands}).filter(([id])=>!g.civilization.destroyedIslands.includes(id)));
export const activeDiscoveryPath=g=>g.civilization.discoveryPath.filter(id=>!g.civilization.destroyedIslands.includes(id));
export const populationCapacity=g=>Object.keys(islandCatalog(g)).filter(id=>id==='home'||g.civilization.visits[id]>0).length*8;
export const islandDefinition=(g,id)=>STAR_ISLANDS[id]??g.civilization.islands[id];
export const SKILL_NAMES={science:'科学',botany:'植物学',social:'社交'};
// Keep discovery history (including destroyed nodes) so IDs never respawn or overwrite later islands.
export function discoverAdjacentIsland(g,source){
 const c=g.civilization;
 if(c.observations<=c.lastDiscoveryObservation)return null;c.lastDiscoveryObservation=c.observations;
 if(source!==activeDiscoveryPath(g).at(-1)||!(c.visits[source]>0))return null;
 if(!c.discoveryPath.includes('spore')){if(c.observations<3)return null;c.discoveryPath.push('spore');return STAR_ISLANDS.spore;}
 if(!c.discoveryPath.includes('ocean')){c.discoveryPath.push('ocean');return STAR_ISLANDS.ocean;}
 return null;
}
export const createCivilization=()=>({seed:crypto.getRandomValues(new Uint32Array(1))[0],islands:{},destroyedIslands:[],projects:{spore:createProject(),ocean:createProject()},discoveryPath:['home'],knowledge:0,technology:0,observations:0,lastDiscoveryObservation:0,surveys:{spore:0,ocean:0},surveyDays:{spore:0,ocean:0},visits:{home:1,spore:0,ocean:0}});
export const spaceLevel=g=>SPACE_LEVELS.reduce((level,s,i)=>g.civilization.technology>=s.points?i:level,0);
export const discovered=(g,id)=>g.civilization.discoveryPath.includes(id)&&!g.civilization.destroyedIslands.includes(id);
function destinationError(g,p,id){
 const island=islandDefinition(g,id);if(!island)return '请选择已知星岛。';
 if(islandOf(p)===id)return '已经位于这座星岛。';
 if(!discovered(g,id))return '请先定位尚未摧毁的星岛。';
 if(spaceLevel(g)<island.level)return `需要太空科技 ${island.level} 级 · ${SPACE_LEVELS[island.level].name}。`;
 return null;
}
export function starVoyageError(g,p,skills,id){const career=p===g.player?g.career:p.career;return destinationError(g,p,id)||(career?.id!=='scientist'||skillProgress(skills.science).level<10?'需要量子科学职业且科学满级（10 级），才能独自通过星门航行。':null);}
export function voyageError(g,p,skills,id,count=1,actionId=null,shipId=null){return destinationError(g,p,id)||equipmentError(g,p,islandDefinition(g,id).level,count,actionId,shipId);}
export function civilizationError(g,type,o,p,skills,id,count=1,actionId=null,shipId=null){
 if(type==='extractMaterials')return plantActionError(materialSource(g.objects,o),type);
 const issue=projectError(g,type,o,p);if(issue)return issue;
 if(type==='prepareRations')return o?.type!=='stove'?'请使用孢火星釜储备食物。':null;
 const ufo=UFOS.find(d=>type===`buildUfo${d.tier}`);if(ufo)return o?.type!=='lab'?'请在全息研究台制造 UFO。':spaceLevel(g)<ufo.technology?`需要太空科技 ${ufo.technology} 级才能制造。`:fleetBuildError(g,actionId);
 if(type==='spaceResearch')return o?.type!=='lab'?'请使用全息研究台。':spaceLevel(g)===SPACE_LEVELS.length-1?'现有太空科技已研究完成。':null;
 if(type==='starVoyage')return o?.type!=='portal'?'请使用跃迁星门航行。':starVoyageError(g,p,skills,id);
 if(type==='voyage')return o?.type!=='portal'?'请使用跃迁星门出航。':voyageError(g,p,skills,id,count,actionId,shipId);
 if(type==='explore'&&o?.type!=='portal')return '请使用跃迁星门进行勘察。';
 if(type==='explore'&&islandOf(p)!=='home'&&g.civilization.surveyDays[islandOf(p)]===g.day)return '这座星岛今天已经完成勘察。';
 return null;
}
export function contributeCivilization(g,type,p,skills,career){
 const c=g.civilization,id=islandOf(p);
 const knowledge={research:1,observe:1,traceRelic:2,decodeRelic:3,decodeTogether:3,restoreMemory:5,explore:id==='home'?1:6}[type]??0;c.knowledge+=knowledge;
 if(type==='spaceResearch')c.technology=Math.min(MAX_TECH,c.technology+spaceResearchYield(career,skills));
 if(type==='observe')c.observations++;
 if(type==='explore'){
  c.observations++;const next=discoverAdjacentIsland(g,id);
  if(next)g.log.unshift({text:`在${islandDefinition(g,id).name}勘察时发现${next.name}。`,at:g.minute});
 }
 if(type==='explore'&&id!=='home'){c.surveys[id]++;c.surveyDays[id]=g.day;}
}
export function validCivilization(c){
 const count=n=>Number.isSafeInteger(n)&&n>=0&&n<=1e9;
 if(!c||!Array.isArray(c.destroyedIslands)||new Set(c.destroyedIslands).size!==c.destroyedIslands.length||c.destroyedIslands.some(id=>id==='home'||!c.discoveryPath?.includes(id))||!validProjects(c))return false;
 const sequence=['home','spore',...Object.values(c?.islands??{}).sort((a,b)=>a.index-b.index).map(b=>b.id),'ocean'];
 if(!Array.isArray(c?.discoveryPath)||c.discoveryPath.length<1||c.discoveryPath.length>sequence.length||c.discoveryPath.some((id,i)=>id!==sequence[i])||Object.keys(c.islands??{}).some(id=>!c.discoveryPath.includes(id)))return false;
 return !!c&&Number.isInteger(c.seed)&&c.seed>=0&&c.seed<=0xffffffff&&c.islands&&Object.keys(c.islands).length<=64&&Object.entries(c.islands).every(([id,b])=>validIslandBlueprint(b,id)&&count(c.visits?.[id])&&count(c.surveys?.[id])&&count(c.surveyDays?.[id]))&&count(c.knowledge)&&count(c.technology)&&c.technology<=MAX_TECH&&count(c.observations)&&count(c.lastDiscoveryObservation)&&c.lastDiscoveryObservation<=c.observations&&['spore','ocean'].every(id=>count(c.surveys?.[id])&&count(c.surveyDays?.[id]))&&Object.keys(STAR_ISLANDS).every(id=>count(c.visits?.[id]));
}
