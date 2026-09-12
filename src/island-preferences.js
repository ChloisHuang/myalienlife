export const ENVIRONMENT_KEYS=['nature','community','discovery','calm'];
export const ENVIRONMENT_NAMES={nature:'自然',community:'社群',discovery:'探索',calm:'安静'};
export const DEFAULT_ENVIRONMENT_PREFERENCES=Object.freeze({nature:50,community:50,discovery:50,calm:50});
const INITIAL_PREFERENCES={
 player:{nature:75,community:40,discovery:85,calm:35},
 nova:{nature:95,community:35,discovery:55,calm:75},
 zig:{nature:25,community:25,discovery:98,calm:85},
 lumi:{nature:30,community:95,discovery:60,calm:25},
 pip:{nature:55,community:90,discovery:45,calm:40}
};
const HOME_ENVIRONMENT={nature:42,community:86,discovery:48,calm:78};
const FAIRYTALE_ENVIRONMENT={nature:92,community:58,discovery:72,calm:62};
const BIOME_ENVIRONMENTS={
 fungal:{nature:94,community:48,discovery:68,calm:70},
 crystalline:{nature:38,community:30,discovery:94,calm:68},
 ruins:{nature:25,community:34,discovery:98,calm:42},
 choral:{nature:45,community:94,discovery:62,calm:38}
};
export const MIGRATION_COOLDOWN_MINUTES=1440*5;
export const MIGRATION_MIN_ADVANTAGE=6;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const validVector=(value,min,max)=>value&&Object.keys(value).length===ENVIRONMENT_KEYS.length&&ENVIRONMENT_KEYS.every(key=>Number.isFinite(value[key])&&value[key]>=min&&value[key]<=max);
export const migrationCooldownRemaining=(person,now)=>Math.max(0,(person.migrationCooldownUntil??0)-now);

export const createEnvironmentPreferences=id=>({...DEFAULT_ENVIRONMENT_PREFERENCES,...(INITIAL_PREFERENCES[id]??{})});
export const createEnvironmentExperience=()=>Object.fromEntries(ENVIRONMENT_KEYS.map(key=>[key,0]));
export const validEnvironmentPreferences=value=>validVector(value,0,100);
export const validEnvironmentExperience=value=>validVector(value,-100,100);

export function environmentProfile(id,island){
 if(id==='home')return {...HOME_ENVIRONMENT};
 if(id==='spore'||island?.theme==='fairytale')return {...FAIRYTALE_ENVIRONMENT};
 if(island?.biome&&BIOME_ENVIRONMENTS[island.biome])return {...BIOME_ENVIRONMENTS[island.biome]};
 const interests=new Set(island?.interests??[]);
 return {
  nature:interests.has('garden')?86:38,
  community:interests.has('chat')||interests.has('dance')?86:34,
  discovery:interests.has('explore')||interests.has('research')||interests.has('observe')?84:48,
  calm:interests.has('chat')||interests.has('dance')?44:66
 };
}

export function environmentFit(person,profile){
 const preferences=person.environmentPreferences??DEFAULT_ENVIRONMENT_PREFERENCES,experience=person.environmentExperience??{};
 return ENVIRONMENT_KEYS.reduce((score,key)=>score+clamp((preferences[key]??50)+(experience[key]??0)*.35,0,100)*profile[key],0)/(ENVIRONMENT_KEYS.length*100);
}

export function migrationPreference(person,targetId,targetProfile,currentId,currentProfile){
 const targetFit=environmentFit(person,targetProfile),currentFit=environmentFit(person,currentProfile);
 return {targetFit,currentFit,advantage:targetFit-currentFit};
}

export function recordEnvironmentExperience(person,needs,profile,day){
 if((person.lastEnvironmentExperienceDay??0)>=day)return false;
 const average=Object.values(needs??{}).reduce((sum,value)=>sum+value,0)/Object.keys(needs??{}).length;
 if(!Number.isFinite(average))return false;
 const satisfaction=clamp((average-50)/50,-1,1),experience=person.environmentExperience??createEnvironmentExperience();
 for(const key of ENVIRONMENT_KEYS)experience[key]=clamp((experience[key]??0)+satisfaction*(profile[key]-50)/50*4,-100,100);
 person.environmentExperience=experience;person.lastEnvironmentExperienceDay=day;return true;
}

export function environmentPreferenceSummary(person){
 const preferences=person.environmentPreferences??DEFAULT_ENVIRONMENT_PREFERENCES,experience=person.environmentExperience??{};
 const value=key=>clamp((preferences[key]??50)+(experience[key]??0)*.35,0,100);
 return [...ENVIRONMENT_KEYS].sort((a,b)=>value(b)-value(a)).map(key=>`${ENVIRONMENT_NAMES[key]} ${Math.round(value(key))}`).join(' · ');
}
