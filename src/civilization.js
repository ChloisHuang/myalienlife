import {islandOf} from './island.js';

export const STAR_ISLANDS={
 home:{name:'露米纳星湾',level:0,color:0xbce0d4,skill:null,required:0,interests:[]},
 spore:{name:'孢海浮洲',level:1,color:0x89bdba,skill:'botany',required:6,interests:['garden','observe','explore']},
 city:{name:'失落星城',level:2,color:0x9c8bcc,skill:'science',required:12,interests:['research','observe','explore']}
};
export const SPACE_LEVELS=[{name:'地表时代',points:0},{name:'近星航行',points:40},{name:'深空跃迁',points:120}];
export const createCivilization=()=>({technology:0,observations:0,surveys:{spore:0,city:0},surveyDays:{spore:0,city:0},visits:{home:1,spore:0,city:0}});
export const spaceLevel=g=>SPACE_LEVELS.reduce((level,s,i)=>g.civilization.technology>=s.points?i:level,0);
export const discovered=(g,id)=>id==='home'||id==='spore'&&g.civilization.observations>=3||id==='city'&&g.wonders.archive===3;
export function voyageError(g,p,skills,id){
 const island=STAR_ISLANDS[id];if(!island)return '请选择已知星岛。';
 if(islandOf(p)===id)return '已经位于这座星岛。';
 if(id==='home')return null;
 if(!discovered(g,id))return id==='spore'?'完成 3 次星空观测后定位孢海浮洲。':'完成三章文明记忆后定位失落星城。';
 if(spaceLevel(g)<island.level)return `需要太空科技 ${island.level} 级 · ${SPACE_LEVELS[island.level].name}。`;
 if(p.age<g.config.lifeStages.teenEnd)return '成年居民才能参加远航。';
 if(skills[island.skill]<island.required)return `需要${island.skill==='botany'?'植物学':'科学'}经验 ${island.required}（当前 ${Math.floor(skills[island.skill])}）。`;
 if(!island.interests.some(key=>(p.preferences[key]??0)>=5))return '需要相关兴趣至少 5：'+(id==='spore'?'种植、观测或探索。':'研究、观测或探索。');
 return null;
}
export function civilizationError(g,type,o,p,skills,id){
 if(type==='spaceResearch')return o?.type!=='lab'?'请使用全息研究台。':skills.science<6?'太空工程研究需要科学经验 6。':spaceLevel(g)===2?'现有太空科技已研究完成。':null;
 if(type==='voyage')return o?.type!=='portal'?'请使用跃迁星门出航。':voyageError(g,p,skills,id);
 if(type==='explore'&&o?.type!=='portal')return '请使用跃迁星门进行勘察。';
 if(type==='explore'&&islandOf(p)!=='home'&&g.civilization.surveyDays[islandOf(p)]===g.day)return '这座星岛今天已经完成勘察。';
 return null;
}
export function contributeCivilization(g,type,p){
 const c=g.civilization,id=islandOf(p);
 if(type==='research'||type==='spaceResearch')c.technology=Math.min(120,c.technology+(type==='spaceResearch'?4:1));
 if(type==='observe'||type==='explore'&&id==='home')c.observations++;
 if(type==='explore'&&id!=='home'){c.surveys[id]++;c.surveyDays[id]=g.day;c.technology=Math.min(120,c.technology+6);}
}
export function validCivilization(c){
 const count=n=>Number.isSafeInteger(n)&&n>=0&&n<=1e9;
 return !!c&&count(c.technology)&&c.technology<=120&&count(c.observations)&&['spore','city'].every(id=>count(c.surveys?.[id])&&count(c.surveyDays?.[id]))&&Object.keys(STAR_ISLANDS).every(id=>count(c.visits?.[id]));
}
