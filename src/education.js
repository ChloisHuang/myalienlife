import {DEFAULT_LIFE_STAGES,SKILLS,skillProgress} from './characters.js';
export const EDUCATION_LEVELS=[
 {name:'幼儿园',credits:0,foundationLevel:0,multiplier:.65},{name:'小学',credits:6,foundationLevel:2,multiplier:.75},
 {name:'中学',credits:18,foundationLevel:2,multiplier:.85},{name:'高中',credits:36,foundationLevel:3,multiplier:1},
 {name:'大学',credits:72,foundationLevel:4,multiplier:1.2},{name:'研究生',credits:144,foundationLevel:4,multiplier:1.4},{name:'博士',credits:240,foundationLevel:5,multiplier:1.6}
];
export const DEFAULT_STUDY_SUCCESS_CHANCE=60;
export const FOUNDATION_SKILLS={practical:{name:'生活实践',icon:'Utensils'},logic:{name:'逻辑思维',icon:'Atom'},nature:{name:'自然感知',icon:'Sprout'},expression:{name:'语言表达',icon:'MessagesSquare'},arts:{name:'艺术感知',icon:'Music2'}};
export const FOUNDATION_FOR={cooking:'practical',science:'logic',botany:'nature',social:'expression',music:'arts'};
export const MAJORS={cooking:'星膳学',science:'量子科学',botany:'异星生态',social:'星际传播',music:'星律艺术'};
export const CONTINUING_EDUCATION_CAREER='student';
const interests={cooking:['cook','brew'],science:['research','observe'],botany:['garden','harvest'],social:['chat','joke'],music:['dance']};
export const isLearner=(person,stages=DEFAULT_LIFE_STAGES)=>person.age<stages.teenEnd;
export const canStudy=(person,stages,career)=>isLearner(person,stages)||career?.id===CONTINUING_EDUCATION_CAREER;
const foundationState=()=>Object.fromEntries(Object.keys(FOUNDATION_SKILLS).map(key=>[key,0]));
export const createEducation=()=>({version:3,credits:0,focus:null,foundation:foundationState(),major:null});
const validFields=e=>e&&Number.isSafeInteger(e.credits)&&e.credits>=0&&(e.focus===null||Object.hasOwn(SKILLS,e.focus))&&(e.major===null||Object.hasOwn(MAJORS,e.major))&&e.foundation&&Object.keys(FOUNDATION_SKILLS).every(key=>Number.isSafeInteger(e.foundation[key])&&e.foundation[key]>=0);
export const validEducation=e=>e?.version===3&&validFields(e);
export function foundationQualified(education,level){
 const values=Object.keys(FOUNDATION_SKILLS).map(key=>skillProgress(education.foundation[key]).level),index=EDUCATION_LEVELS.indexOf(level);
 return index===0||index===1&&values.some(value=>value>=level.foundationLevel)||index>=2&&values.every(value=>value>=level.foundationLevel);
}
export const educationRequirements=level=>{const index=EDUCATION_LEVELS.indexOf(level);return index===1?`至少一项基础能力达到 Lv.${level.foundationLevel}`:index>=2?`五项基础能力全部达到 Lv.${level.foundationLevel}`:'';};
export const educationLevel=person=>EDUCATION_LEVELS.findLast(level=>person.education.credits>=level.credits&&foundationQualified(person.education,level));
export const higherEducation=person=>EDUCATION_LEVELS.indexOf(educationLevel(person))>=4;
export const educationWage=(person,base)=>Math.round(base*educationLevel(person).multiplier);
export const studyInterest=(person,skill)=>Math.max(...interests[skill].map(action=>person.preferences[action]??0));
export const studyName=(person,skill)=>higherEducation(person)?SKILLS[skill].name:FOUNDATION_SKILLS[FOUNDATION_FOR[skill]].name;
function weightedSubject(person,random,majorChoice=false){
 const subjects=Object.keys(SKILLS),weights=subjects.map(skill=>10+studyInterest(person,skill)+(majorChoice?skillProgress(person.education.foundation[FOUNDATION_FOR[skill]]).level*2:person.education.major===skill?40:0));let roll=random()*weights.reduce((a,b)=>a+b,0);
 return subjects.find((skill,i)=>(roll-=weights[i])<0)??subjects.at(-1);
}
export function chooseMajor(person,random=Math.random){
 if(higherEducation(person)&&person.education.major===null)person.education.major=weightedSubject(person,random,true);
}
export function studySubject(person,random=Math.random){chooseMajor(person,random);return person.education.focus??weightedSubject(person,random);}
export function studySucceeded(random=Math.random,chance=DEFAULT_STUDY_SUCCESS_CHANCE){return random()<chance/100;}
export function completeStudy(person,skills,subject,random=Math.random){
 chooseMajor(person,random);const advanced=higherEducation(person),name=studyName(person,subject),amount=advanced&&person.education.major===subject?2:1;
 if(advanced)skills[subject]+=amount;else person.education.foundation[FOUNDATION_FOR[subject]]+=amount;
 person.education.credits++;chooseMajor(person,random);return {name,amount};
}
export function migrateEducation(person){
 if(person.education===undefined){person.education=createEducation();return;}
 const old=person.education;
 if(old?.version===2&&validFields(old)){
  // Only recorded foundation study supports pre-college credits; retain professional XP elsewhere.
  const credits=foundationQualified(old,EDUCATION_LEVELS[4])?old.credits:Math.min(old.credits,Object.keys(FOUNDATION_SKILLS).reduce((sum,key)=>sum+old.foundation[key],0));
  person.education={...old,version:3,credits};return;
 }
 if(old?.version===undefined&&Number.isSafeInteger(old?.credits)&&old.credits>=0&&(old.focus===null||Object.hasOwn(SKILLS,old.focus)))person.education={...createEducation(),focus:old.focus};
}
export function studyError(person,stages,station,career){
 if(person.age<stages.infantEnd)return '幼体长大后才能开始学习。';
 if(!canStudy(person,stages,career))return '成年居民需要先切换为继续学习职业。';
 if(!studyFacilitySkill(station))return '这里没有对应的学习活动。';
 if(station.uid&&(station.uid===person.uid||!station.alive||station.age<stages.infantEnd))return '请选择其他能够交流的居民。';
 if(station.plant?.health<=0)return '请先恢复植物的健康再学习。';
 return null;
}
export const studyFacilitySkill=target=>target?.uid?'social':({music:'music',garden:'botany',mushroom:'botany',cultivator:'botany',lab:'science',stove:'cooking'})[target?.type];
export const STUDY_LOCATIONS={music:'音乐机',botany:'植物或种植设施',science:'研究台',cooking:'灶台',social:'可以交流的居民'};
