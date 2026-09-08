import {SKILLS,skillProgress,lifeStage} from './characters.js';

export const DEFAULT_PRAYER_CHANCES={skillChance:10,netherChance:10,mutationChance:1,rejuvenationChance:.1};
export const PRAYER_RULES={netherThreshold:10,celebrationSeconds:4};
export const PRAYER_MUTATIONS={crown:'晶冠角',spines:'脊晶',freckles:'星辉斑',eyes:'异色瞳'};
export const createPrayerState=()=>({nether:0,mutations:[]});
export const isNether=person=>person.prayer?.nether>=PRAYER_RULES.netherThreshold;
export function validPrayerState(state){return !!state&&Number.isSafeInteger(state.nether)&&state.nether>=0&&state.nether<=1e9&&Array.isArray(state.mutations)&&state.mutations.every(key=>Object.hasOwn(PRAYER_MUTATIONS,key))&&new Set(state.mutations).size===state.mutations.length;}
export const prayerSucceeded=result=>!!(result.skill||result.nether||result.mutation||result.rejuvenated);
export function validBlessing(result){return !!result&&['front','back'].includes(result.side)&&(result.skill===null||Object.hasOwn(SKILLS,result.skill))&&typeof result.nether==='boolean'&&typeof result.transformed==='boolean'&&(result.rejuvenated===undefined||typeof result.rejuvenated==='boolean')&&(result.mutation===null||Object.hasOwn(PRAYER_MUTATIONS,result.mutation))&&(!result.transformed||result.nether)&&prayerSucceeded(result)&&(result.side==='front'?!result.nether&&!result.mutation&&!result.transformed:result.skill===null&&!result.rejuvenated);}

// Called once at completion, never by rendering or save restoration.
export function resolvePrayer(person,skills,side,chances,lifeStages,random=Math.random){
 const result={side,skill:null,nether:false,mutation:null,transformed:false};
 if(side==='front'){
  const eligible=Object.keys(SKILLS).filter(key=>skillProgress(skills[key]).level<10);
  if(random()<chances.skillChance/100&&eligible.length){
   result.skill=eligible[Math.floor(random()*eligible.length)];
   const progress=skillProgress(skills[result.skill]);skills[result.skill]+=progress.next-progress.xp;
  }
  if(person.alive&&lifeStage(person.age,lifeStages)==='elder'&&random()<chances.rejuvenationChance/100){person.age=lifeStages.infantEnd;result.rejuvenated=true;}
 }else if(side==='back'){
  const wasNether=isNether(person);
  if(random()<chances.netherChance/100&&person.prayer.nether<1e9){person.prayer.nether++;result.nether=true;result.transformed=!wasNether&&isNether(person);}
  const available=Object.keys(PRAYER_MUTATIONS).filter(key=>!person.prayer.mutations.includes(key));
  if(random()<chances.mutationChance/100&&available.length){result.mutation=available[Math.floor(random()*available.length)];person.prayer.mutations.push(result.mutation);}
 }
 return result;
}

export function blessingMessage(result){
 const rewards=[];
 if(result.skill)rewards.push(`${SKILLS[result.skill].name}提升 1 级`);
 if(result.rejuvenated)rewards.push('返老还童，回到儿童阶段');
 if(result.nether)rewards.push('幽冥属性 +1');
 if(result.transformed)rewards.push('蜕变为幽冥族，身上浮现幽冥眼花纹');
 if(result.mutation)rewards.push(`获得永久变异「${PRAYER_MUTATIONS[result.mutation]}」`);
 return rewards.length?rewards.join('；'):'本次祈祷未获得赐福';
}
