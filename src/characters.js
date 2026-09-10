import {glassPlatformHeight} from './glass-platforms.js';
import {fairytaleHeight} from './fairytale-definition.js';
export const GENDERS={male:'男性',female:'女性',nonbinary:'非二元'};
export const RESIDENTS={player:{gender:'male',age:28},nova:{gender:'female',age:32},zig:{gender:'male',age:68},lumi:{gender:'female',age:24},pip:{gender:'nonbinary',age:10}};
export const SKILLS={cooking:{name:'烹饪',icon:'Utensils',hint:'在星釜灶台烹制异星料理'},science:{name:'科学',icon:'Atom',hint:'研究晶体、观测星系'},botany:{name:'园艺',icon:'Sprout',hint:'照料发光孢子'},social:{name:'社交',icon:'MessagesSquare',hint:'交谈、讲笑话'},music:{name:'音乐',icon:'Music2',hint:'随星云音乐起舞'}};
export function skillProgress(total){
 let level=1,start=0;while(level<10&&total>=start+level*3){start+=level*3;level++;}
 return {level,xp:total-start,next:level===10?0:level*3,progress:level===10?100:Math.min(100,(total-start)/(level*3)*100)};
}
export const DEFAULT_LIFE_STAGES={infantEnd:3,childEnd:13,teenEnd:18,adultEnd:60,elderEnd:120};
export function lifeStage(age,stages=DEFAULT_LIFE_STAGES){const {infantEnd,childEnd,teenEnd,adultEnd}={...DEFAULT_LIFE_STAGES,...stages};return age<infantEnd?'infant':age<childEnd?'child':age<teenEnd?'teen':age<adultEnd?'adult':'elder';}
export const STAGES={infant:'幼体',child:'儿童',teen:'青少年',adult:'成年',elder:'长者'};
export const SOFA_SEATS=[-.72,0,.72];
export const isSeating=o=>o?.type==='sofa'||o?.type==='fairyBench';
export function appearance(person,stages=DEFAULT_LIFE_STAGES){
 const stage=lifeStage(person.age,stages),genes=person.genome;
 return {stage,scale:{infant:.35,child:.65,teen:.84,adult:1,elder:.94}[stage]*genes.stature,antenna:genes.antenna,head:(stage==='infant'?1.35:stage==='child'?1.18:stage==='teen'?1.07:1)*genes.head,shoulders:(person.gender==='male'?1.12:person.gender==='female'?.94:1)*genes.build,hips:(person.gender==='female'?1.1:1)*genes.build,stoop:stage==='elder'?.14:0};
}
// Coordinates are local to each item; simulation and animation use the same rotation.
export const APPROACHES={fairyBench:[1.4,0,0],blueprintTable:[0,0,1.4],constructionTerminal:[0,0,1.4],cultivator:[0,0,1.5],extractor:[0,0,1.5],materialCabinet:[0,0,1.2],loadingPlatform:[0,0,1.5],spiritTree:[0,0,1.6],polelight:[0,0,1.1],glowlight:[0,0,1.1],stove:[0,0,1.4],tea:[0,0,1.4],banquet:[0,0,1.4],relic:[0,0,1.4],beacon:[0,0,1.4],gate:[0,0,1.7],nursery:[0,0,1.4],pod:[1.1,0,.45],sofa:[1.4,0,0],food:[0,0,1.4],shower:[0,0,1.4],lab:[0,0,1.4],music:[0,0,1.4],garden:[0,0,1.4],portal:[0,0,1.7],telescope:[0,0,1.3],crystal:[0,0,1.4],mushroom:[0,0,1.4],lamp:[0,0,1.4]};
export function groundHeight(x,z,side='front',island='home'){
 if(island==='spore')return fairytaleHeight(x,z);
 if(island!=='home')return .29;
 if(side==='back')return .29;
 if(x>=-8.4&&x<=4.4&&z>=-6.2&&z<=1.25)return .29;
 const platformHeight=glassPlatformHeight(x,z);if(platformHeight!==null)return platformHeight;
 if(x>=-7.8&&x<=3.8&&z>=1.55&&z<=2.45)return .15;
 return -.08;
}
export function localToWorld(object,[x,y,z]){const c=Math.cos(object.rotation),s=Math.sin(object.rotation);return{x:object.x+x*c+z*s,y:.29+y,z:object.z-x*s+z*c};}
export function approachPosition(object){const p=localToWorld(object,APPROACHES[object.type]);return{x:p.x,z:p.z};}
